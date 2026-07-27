// View builders, component builders, trade-quote math, and the QuickChart
// price-graph generator for the Wald Street Exchange stock market. Follows the
// codebase convention of one bespoke EmbedBuilder per view (see
// challenge/functions.js menuEmbed etc.).

const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, AttachmentBuilder,
    ModalBuilder, LabelBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const moment = require('moment');
require('moment-timezone');
const path = require('path');
const fs = require('fs');
const { number_with_commas, big_number } = require('../../generic.js');
const { trugut_color } = require('../../colors.js');
const { COMPANIES } = require('../../data/stock/companies.js');
const { config, RANGE_POINTS, DEFAULT_RANGE, isMarketOpen } = require('../../data/stock/config.js');

const UP = "#57F287";
const DOWN = "#ED4245";

// Change arrows. Custom emoji only render OUTSIDE code blocks, so the market
// list uses inline-code cells (not a fenced block) to keep these visible.
const ARROW_UP = "<:green_arrow:852392123093614642>";
const ARROW_DOWN = "🔻"; // :small_red_triangle_down:
const ARROW_FLAT = "▪️";
const WHALE = "<:opee:1530250612258770944>";

const easternTime = () => moment().tz('America/New_York');

// The market cron updates every 6 hours (12a/6a/12p/6p ET). Returns the moment
// of the next update in Eastern time — always strictly in the future, so the
// slot that just fired rolls to the following one.
function nextMarketUpdate() {
    const next = easternTime().startOf('hour');
    do { next.add(1, 'hour'); } while (next.hour() % 6 !== 0);
    return next;
}

// Isolated axios instance — the shared `axios` default is globally mutated
// elsewhere (lookup.js sets baseURL/headers), so never reuse it for QuickChart.
const chartAxios = require('axios').create();

// ---- formatting helpers -------------------------------------------------

// Prices keep 2-decimal precision; truguts amounts use the big_number money formatter.
const money = v => number_with_commas(Number(v || 0).toFixed(2));
const tg = v => big_number(Math.round(Number(v) || 0));
// Exact (unabbreviated) truguts — for financial consent surfaces: trade
// confirmations, results, and insufficient-funds errors, where the displayed
// number must match the amount actually charged to the trugut.
const tgx = v => number_with_commas(Math.round(Number(v) || 0));
const pctText = v => `${v > 0 ? "+" : ""}${(Number(v) * 100).toFixed(2)}%`;

// Graph ranges arrive from custom_ids, so anything unrecognised falls back to
// the default rather than rendering a range dropdown with nothing selected.
const normalizeRange = r => Object.prototype.hasOwnProperty.call(RANGE_POINTS, r) ? r : DEFAULT_RANGE;

function changeParts(lastChange) {
    const c = Number(lastChange) || 0;
    const emoji = c > 0 ? ARROW_UP : c < 0 ? ARROW_DOWN : ARROW_FLAT;
    return { emoji, pct: pctText(c), text: `${emoji} ${pctText(c)}`, up: c > 0, down: c < 0 };
}

// Buy/sell pressure label (ported from prototype sentiment()).
function sentiment(c) {
    const buy = Number(c.buyVolume) || 0;
    const sell = Number(c.sellVolume) || 0;
    const total = buy + sell;
    if (total < 1) return "Quiet";
    const ratio = (buy - sell) / total;
    if (ratio > 0.45) return "Heavy Buying";
    if (ratio > 0.12) return "Buying";
    if (ratio < -0.45) return "Heavy Selling";
    if (ratio < -0.12) return "Selling";
    return "Mixed";
}

// ---- state access -------------------------------------------------------

// All companies as an array. Falls back to seed defaults (price 100, no history)
// if the market hasn't been seeded by the cron yet, so views always render.
function getCompanies(db) {
    const stored = db?.stock?.companies;
    if (stored && Object.keys(stored).length) {
        // Preserve the canonical COMPANIES order. Static brand facts (name,
        // baseVolatility) overlay the stored record so a rename/rebalance in
        // companies.js shows immediately, even before the next cron tick
        // re-syncs the stored copy.
        return COMPANIES.map(c => stored[c.symbol]
            ? { ...stored[c.symbol], name: c.name, baseVolatility: c.baseVolatility }
            : { ...c, lastChange: 0, history: [] });
    }
    return COMPANIES.map(c => ({ ...c, anchor: c.price, histHigh: c.price, histLow: c.price, boostTicks: 0, exposed: false, newsToday: false, buyVolume: 0, sellVolume: 0, lastChange: 0, history: [] }));
}

function getCompany(db, symbol) {
    if (!symbol) return null;
    return getCompanies(db).find(c => c.symbol === String(symbol).toUpperCase()) || null;
}

// True once the firebase listener has actually populated the live market.
//
// getCompanies() deliberately falls back to the companies.js seed (price 100) so
// the read-only views always render, but a TRADE must never price off that
// fallback: for the first moments after a restart — or for as long as the
// listener is erroring — the cache is empty while the real market sits at a
// completely different price, and quoting the seed hands out shares at 100
// apiece. Every path that moves truguts gates on this.
const isMarketLive = db => !!(db?.stock?.companies && Object.keys(db.stock.companies).length);

const getMeta = db => (db?.stock?.meta) || {};
const getPortfolio = user_profile => (user_profile && user_profile.portfolio) || {};

function holdingsValue(db, user_profile) {
    const portfolio = getPortfolio(user_profile);
    const companies = getCompanies(db);
    return Object.entries(portfolio).reduce((sum, [sym, pos]) => {
        const c = companies.find(x => x.symbol === sym);
        return sum + (c ? Number(c.price) * (Number(pos.shares) || 0) : 0);
    }, 0);
}

const balanceOf = user_profile =>
    (Number(user_profile?.truguts_earned) || 0) - (Number(user_profile?.truguts_spent) || 0);

const netWorth = (db, user_profile) => balanceOf(user_profile) + holdingsValue(db, user_profile);
const isWhale = (db, user_profile) => netWorth(db, user_profile) >= config.whaleThreshold;

// ---- trade quote math ---------------------------------------------------

// Live market status, driven by the real Eastern-time clock (weekday 6am–5pm).
function marketStatus() {
    const open = isMarketOpen(easternTime());
    return {
        open,
        baseFee: open ? config.brokerFeeOpen : config.brokerFeeClosed,
        sentimentImpact: open ? config.sentimentImpactOpen : config.sentimentImpactClosed,
    };
}

// Whales pay a multiple of the base broker fee. The base still switches on
// market hours, so a whale keeps feeling the open-vs-closed effect too.
function brokerRate(db, user_profile) {
    return marketStatus().baseFee * (isWhale(db, user_profile) ? config.whaleFeeMultiplier : 1);
}

// Order-size slippage: a large order walks the book, so the average fill price
// moves against you. Small orders are barely affected. Returns the average-fill
// multiplier on the quoted price.
//
// A buy pays (1 + half); a sell receives the RECIPROCAL, not (1 - half). The old
// linear form went negative past impact 2 and had to be clamped at a flat 0.1, so
// any position above ~1.8x slippageLiquidity was stuck taking a 90% haircut on
// every exit. 1/(1 + half) matches the linear form to within a rounding error for
// small orders, can never reach zero, and makes a flat round trip cost exactly
// (1 + half)^2 — steep for a whale, but survivable and symmetric.
function slippageMult(grossNotional, side) {
    const impact = Math.min((Number(grossNotional) || 0) / config.slippageLiquidity, config.maxImpact);
    const half = impact / 2;
    return side === 'buy' ? 1 + half : 1 / (1 + half);
}

// Full cost/proceeds breakdown for a `shares`-sized order at the current price.
// Truguts are whole, so base/fee/total are rounded; fillPrice stays at 2dp for
// display. Callers (confirm + execute) must both go through this so the numbers
// they show and charge match.
function quoteTrade({ db, user_profile, kind, price, shares, symbol }) {
    const p = Number(price) || 0;
    const gross = p * shares;
    // The friction lives on the ENTRY, not the exit.
    //
    // Buys are position-keyed (held + shares): each buy slips harder as the stake
    // grows, so splitting a big purchase into many tiny ones can't dodge the rake
    // and accumulating a corner-sized position is progressively punishing.
    //
    // Sells are ORDER-keyed (shares alone). Keying them to the position instead
    // meant a large holder could never unwind at any size — selling one share out
    // of a big stake paid that whole stake's impact, permanently destroying ~90% of
    // it. Because building the position was already taxed on the way in, the exit
    // doesn't also need to be a trap: dump it all at once and you still eat the
    // full impact, or work the order down over time and pay less, exactly as you
    // would in a real book.
    const held = Number(getPortfolio(user_profile)[symbol]?.shares) || 0;
    const slipNotional = (kind === 'buy' ? held + shares : shares) * p;
    const slip = slippageMult(slipNotional, kind);
    const fillPrice = p * slip;
    const base = Math.round(fillPrice * shares);
    const rate = brokerRate(db, user_profile);
    const fee = Math.round(fillPrice * shares * rate);
    const total = kind === 'buy' ? base + fee : base - fee;
    return { gross, slip, fillPrice, base, rate, fee, total };
}

// ---- logos --------------------------------------------------------------

// Company logos live in resources/img/companies/<SYM>.png (one per ticker).
const LOGO_DIR = path.join(__dirname, '../../resources/img/companies');
// Symbols that actually have a logo file, read once at startup so per-view calls
// don't hit the disk. Empty set (missing dir) => logos silently disabled.
const LOGOS = (() => {
    try {
        return new Set(fs.readdirSync(LOGO_DIR)
            .filter(f => /\.png$/i.test(f))
            .map(f => f.replace(/\.png$/i, '').toUpperCase()));
    } catch { return new Set(); }
})();

const hasLogo = symbol => LOGOS.has(String(symbol || '').toUpperCase());

// A company's brand color (extracted from its logo, see companies.js) for embed
// accents. Falls back to the trugut theme color for anything unmapped.
const brandColor = symbol => {
    const c = COMPANIES.find(x => x.symbol === String(symbol || '').toUpperCase());
    return (c && c.color) || trugut_color;
};

// AttachmentBuilder for a company's logo, or null when no file exists. The
// attachment is named "<SYM>.png", so embeds reference it as
// attachment://<SYM>.png (distinct from the chart's chart.png).
function companyLogo(symbol) {
    const sym = String(symbol || '').toUpperCase();
    if (!LOGOS.has(sym)) return null;
    return new AttachmentBuilder(path.join(LOGO_DIR, `${sym}.png`), { name: `${sym}.png` });
}

// ---- embeds -------------------------------------------------------------

function marketEmbed({ db, user_profile } = {}) {
    const companies = getCompanies(db);
    const meta = getMeta(db);
    const status = marketStatus();
    let desc = ''
    desc += `${status.open ? "🟢 OPEN" : "🔴 CLOSED"} | Broker Fee: ${(brokerRate(db, user_profile) * 100).toFixed(1)}%\n`;
    if (meta.todayNews) desc += `📰 ${meta.todayNews}\n`;

    const rows = companies.map(c => {
        const { emoji, pct } = changeParts(c.lastChange);
        return `\`${c.symbol.padEnd(5)}${money(c.price).padStart(11)}\` ${emoji} ${pct}`;
    });
    desc += rows.join("\n");

    const balance = balanceOf(user_profile);
    const holdings = holdingsValue(db, user_profile);
    const whaleTag = isWhale(db, user_profile) ? ` ${WHALE}` : "";
    desc += `\n\n**Truguts:** ${tg(balance)}\n**Holdings:** ${tg(holdings)}\n**Net worth:** ${tg(balance + holdings)}${whaleTag}\n`;
    desc += `-# Next market update <t:${nextMarketUpdate().unix()}:R> (every 6 hours)`;

    return new EmbedBuilder()
        .setTitle("📈 Wald Street Exchange")
        .setDescription(desc)
        .setColor(trugut_color);
}

function stockDetailEmbed({ db, user_profile, symbol } = {}) {
    const c = getCompany(db, symbol);
    if (!c) return new EmbedBuilder().setTitle("Unknown company").setColor(DOWN);

    const { text } = changeParts(c.lastChange);
    const pos = getPortfolio(user_profile)[c.symbol];
    const owned = Number(pos?.shares) || 0;

    let desc =
        `**Price:** ${money(c.price)} ${text}\n` +
        `**Range:** ${money(c.histLow)} – ${money(c.histHigh)}`;
    const tags = [];
    if (c.newsToday) tags.push("📰 *Moved by today's news.*");
    if (tags.length) desc += `\n${tags.join("\n")}`;

    const embed = new EmbedBuilder()
        .setAuthor({ name: c.symbol })
        .setTitle(c.name)
        .setDescription(desc)
        .setColor(brandColor(c.symbol));
    if (hasLogo(c.symbol)) embed.setThumbnail(`attachment://${c.symbol}.png`);

    if (owned > 0) {
        const avg = Number(pos.averageCost) || 0;
        const value = Number(c.price) * owned;
        const cost = avg * owned;
        const pl = value - cost;
        const plPct = cost > 0 ? (pl / cost) * 100 : 0;
        const plSign = pl >= 0 ? "+" : "-";
        embed.addFields(
            { name: "Your Shares", value: number_with_commas(owned), inline: true },
            { name: "Avg Cost", value: money(avg), inline: true },
            { name: "Value", value: money(value), inline: true },
            { name: "P/L", value: `${plSign}${money(Math.abs(pl))} (${plSign}${Math.abs(plPct).toFixed(2)}%)`, inline: true },
        );
    } else {
        embed.addFields({ name: "Your Shares", value: "You don't own any yet.", inline: false });
    }
    return embed;
}

function portfolioEmbed({ db, user_profile } = {}) {
    const portfolio = getPortfolio(user_profile);
    const companies = getCompanies(db);
    const entries = Object.entries(portfolio).filter(([, p]) => (Number(p.shares) || 0) > 0);
    const balance = balanceOf(user_profile);

    const embed = new EmbedBuilder()
        .setTitle("📦 Your Portfolio")
        .setColor(trugut_color);

    if (!entries.length) {
        embed.setDescription(
            `You have no positions yet.\n\n**Truguts:** ${tg(balance)}\nUse \`/market\` to start trading.`
        );
        return embed;
    }

    let totalValue = 0, totalCost = 0;
    // Value and P/L are abbreviated (1.2M) rather than exact: this is an
    // at-a-glance table, and a full 12-digit trugut figure would blow past the
    // width a phone can show. Exact numbers live on the detail view and on every
    // trade confirmation.
    const cells = entries.map(([sym, p]) => {
        const c = companies.find(x => x.symbol === sym) || { price: 0 };
        const shares = Number(p.shares) || 0;
        const avg = Number(p.averageCost) || 0;
        const value = Number(c.price) * shares;
        const cost = avg * shares;
        const pl = value - cost;
        totalValue += value;
        totalCost += cost;
        return [sym, number_with_commas(shares), tg(value), `${pl >= 0 ? "+" : "-"}${tg(Math.abs(pl))}`];
    });

    // Column widths are measured from the actual content (and the header), so a
    // large share count or value can never run into the next column.
    const headers = ["SYM", "SHARES", "VALUE", "P/L"];
    const widths = headers.map((h, i) => Math.max(h.length, ...cells.map(r => r[i].length)));
    const line = r => r.map((cell, i) => i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i])).join("  ");

    const totalPl = totalValue - totalCost;
    const plSign = totalPl >= 0 ? "+" : "-";
    const whaleTag = isWhale(db, user_profile) ? ` ${WHALE}` : "";
    embed.setDescription(
        "```\n" + line(headers) + "\n" + cells.map(line).join("\n") + "\n```" +
        `\n**Truguts:** ${tg(balance)}\n**Holdings:** ${tg(totalValue)}` +
        `\n**Net worth:** ${tg(balance + totalValue)}${whaleTag}\n**Total P/L:** ${plSign}${tg(Math.abs(totalPl))}`
    );
    return embed;
}

// Amount-first receipt lines, matching the challenge winnings receipt: the figure
// in inline code, then what it's for. Each span is right-aligned to a common
// width — the padding leads the span, ahead of the sign and the 📀 — so the
// amounts form a column and every code span is the same width. Padding is only
// ever leading, never trailing, which Discord would trim.
// Plain strings pass through as literal lines (rules, blanks).
const RULE = "▬▬▬▬▬▬▬▬▬▬▬";

function receiptLines(rows) {
    const amounts = rows.filter(r => typeof r === "object");
    const width = Math.max(...amounts.map(r => (r.sign || "").length + r.amount.length));
    return rows.map(r => {
        if (typeof r === "string") return r;
        const sign = r.sign || "";
        const pad = " ".repeat(Math.max(0, width - sign.length - r.amount.length));
        const cell = `\`${pad}${sign}📀${r.amount}\``;
        return r.bold ? `**${cell} ${r.label}**` : `${cell} ${r.label}`;
    }).join("\n");
}

// Confirmation shown (ephemerally) after the buy/sell modal, before the trade
// goes through — surfaces slippage, the market-hours broker fee, and any whale rake.
function confirmEmbed({ kind, symbol, name, shares, quote, balance, whale } = {}) {
    const buying = kind === "buy";
    const status = marketStatus();
    const slipPct = ((quote.slip - 1) * 100);
    const slipLine = Math.abs(slipPct) >= 0.05
        ? `-# Filled at ${money(quote.fillPrice)} vs quoted ${money(shares ? quote.gross / shares : 0)} — slippage ${slipPct > 0 ? "+" : ""}${slipPct.toFixed(1)}%`
        : "";
    return new EmbedBuilder()
        .setTitle(`${buying ? "🛒 Confirm Buy" : "💵 Confirm Sell"} — ${symbol}`)
        .setColor(trugut_color)
        .setDescription(
            `${name}\n\n` +
            receiptLines([
                { amount: tgx(quote.base), label: `${number_with_commas(shares)} shares @ 📀${money(quote.fillPrice)}` },
                { sign: buying ? "+" : "-", amount: tgx(quote.fee), label: `Broker fee (${(quote.rate * 100).toFixed(1)}%${whale ? ` ${WHALE}` : ""}, market ${status.open ? "open" : "closed"})` },
                RULE,
                { amount: tgx(quote.total), label: buying ? "Total to pay" : "You receive", bold: true },
                "",
                { amount: tgx(balance), label: "Your truguts" },
            ]) +
            (slipLine ? `\n${slipLine}` : "")
        );
}

// The "?" explainer. Numbers come from config so the text can't drift from the
// actual market rules.
function helpEmbed() {
    const pct = v => `${+(v * 100).toFixed(2)}%`;
    return new EmbedBuilder()
        .setTitle("📈 How the Wald Street Exchange works")
        .setColor(trugut_color)
        .setDescription(
            "Buy shares in podracer manufacturers with your truguts, then sell them for more (hopefully) than you paid."
        )
        .addFields(
            {
                name: "Prices move 4× a day",
                value: `Every company reprices at **12am, 6am, 12pm and 6pm ET**. A price moves on its trend, random volatility, and pressure from what players are actually buying and selling.`,
            },
            {
                name: "News & the featured pod",
                value: `A headline drops at noon and hits the affected company's trend at 6pm. Each morning the maker of the **Random Challenge of the Day**'s pod gets featured — its volatility spikes for the day, so it swings harder both ways.`,
            },
            {
                name: "Fees",
                value: `Every trade pays a broker fee: **${pct(config.brokerFeeOpen)}** while the market is open (weekdays ${'6am–6pm ET'}) and **${pct(config.brokerFeeClosed)}** when it's closed. Trades also pay slippage. Buying slips on the size of the **position you'd end up with**, so the bigger your stake in a company the worse every further share fills — you can't corner a stock for free, and splitting a big buy into small ones doesn't help. Selling slips on the size of **that order**, so you can always work a large position back down a piece at a time instead of dumping it all at once. Net worth at or above **${tg(config.whaleThreshold)}** marks you as a ${WHALE} (whale) and doubles your fee.`,
            },
            {
                name: "Getting around",
                value: "`/market` — the full board\n`/stock <company>` — one company, with a price graph and Buy/Sell\n`/portfolio` — what you hold, your cost basis, and profit/loss\n\n`/stock <company> buy:10` skips straight to the confirmation.",
            },
        )
        .setFooter({ text: "Nothing here is real money. Prices can go to 1 and stay there." });
}

function resultEmbed({ kind, symbol, shares, quote } = {}) {
    const buying = kind === "buy";
    return new EmbedBuilder()
        .setTitle(buying ? "✅ Purchase complete" : "✅ Sale complete")
        .setColor(UP)
        .setDescription(
            `${buying ? "Bought" : "Sold"} **${number_with_commas(shares)}** ${symbol} @ 📀${money(quote.fillPrice)}\n\n` +
            receiptLines([
                { amount: tgx(quote.base), label: `${number_with_commas(shares)} shares` },
                { sign: buying ? "+" : "-", amount: tgx(quote.fee), label: "Broker fee" },
                RULE,
                { amount: tgx(quote.total), label: buying ? "Paid" : "Received", bold: true },
            ])
        );
}

// ---- components ---------------------------------------------------------

// Dropdown of all 21 companies -> stock_detail_<RANGE> (value = symbol). The
// graph range rides along in the custom_id so switching companies from a detail
// view keeps the range you were looking at instead of snapping back to the
// default. Range keys contain no "_", so they parse cleanly as args[1].
// The label (name line) carries the symbol + price movement; the movement arrow
// is the option emoji (custom emoji only render in the emoji slot, not option
// text). The description carries name / price, plus the user's share count when
// they hold any.
function companySelect(db, user_profile, selected, range) {
    const portfolio = getPortfolio(user_profile);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`stock_detail_${normalizeRange(range)}`)
        .setPlaceholder("Select a company for details")
        .setMinValues(1)
        .setMaxValues(1);
    getCompanies(db).forEach(c => {
        const change = Number(c.lastChange) || 0;
        const emoji = change > 0 ? { id: "852392123093614642", name: "green_arrow" }
            : change < 0 ? { name: "🔻" } : { name: "▪️" };
        const owned = Number(portfolio[c.symbol]?.shares) || 0;
        const desc = [c.name, money(c.price)];
        if (owned > 0) desc.push(`${number_with_commas(owned)} shares`);
        menu.addOptions({
            label: `${c.symbol} ${pctText(change)}`.substring(0, 100),
            description: desc.join(" / ").substring(0, 100),
            emoji,
            value: c.symbol,
            default: selected === c.symbol,
        });
    });
    return new ActionRowBuilder().addComponents(menu);
}

// Shown on every view so the rules are always one click away.
const helpButton = () => new ButtonBuilder()
    .setCustomId("stock_help")
    .setLabel("?")
    .setStyle(ButtonStyle.Secondary);

function marketComponents(db, user_profile, opts = {}) {
    const portfolioBtn = new ButtonBuilder()
        .setCustomId("stock_portfolio")
        .setLabel("My Portfolio")
        .setStyle(ButtonStyle.Secondary);
    return [companySelect(db, user_profile, opts.selected), new ActionRowBuilder().addComponents(portfolioBtn, helpButton())];
}

function historySelect(symbol, range) {
    const active = normalizeRange(range);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`stock_history_${symbol}`)
        .setPlaceholder("Graph range")
        .setMinValues(1)
        .setMaxValues(1);
    [["1D", "Today"], ["1W", "1 Week"], ["1M", "1 Month"], ["ALL", "All time"]].forEach(([value, label]) => {
        menu.addOptions({ label, value, default: active === value });
    });
    return new ActionRowBuilder().addComponents(menu);
}

function detailComponents({ db, user_profile, symbol, range } = {}) {
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_buy_${symbol}`).setLabel("Buy").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`stock_sell_${symbol}`).setLabel("Sell").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("stock_portfolio").setLabel("Portfolio").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("stock_market").setLabel("Market").setStyle(ButtonStyle.Secondary),
        helpButton(),
    );
    return [companySelect(db, user_profile, symbol, range), historySelect(symbol, range), buttons];
}

function portfolioComponents(db, user_profile) {
    const backBtn = new ButtonBuilder()
        .setCustomId("stock_market")
        .setLabel("Back to Market")
        .setStyle(ButtonStyle.Secondary);
    return [companySelect(db, user_profile), new ActionRowBuilder().addComponents(backBtn, helpButton())];
}

function confirmComponents({ kind, symbol, shares } = {}) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`stock_do${kind}_${symbol}_${shares}`)
            .setLabel(kind === "buy" ? "Confirm Buy" : "Confirm Sell")
            .setStyle(kind === "buy" ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("stock_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    )];
}

// ---- buy/sell modal ------------------------------------------------------

// Largest whole share count this user can afford right now, accounting for
// slippage + fee (which only ever raise the cost). Binary search on quoteTrade;
// balance/price is a safe upper bound since frictions can't make it cheaper.
function maxAffordableShares(db, user_profile, price, symbol) {
    const balance = balanceOf(user_profile);
    if (!(price > 0) || balance <= 0) return 0;
    let lo = 0, hi = Math.floor(balance / price) + 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const q = quoteTrade({ db, user_profile, kind: 'buy', price, shares: mid, symbol });
        if (q.total <= balance) lo = mid; else hi = mid - 1;
    }
    return lo;
}

// Build the Components V2 buy/sell modal: a text-display block with pre-computed
// cost/proceeds for 10 / 100 / max shares, plus the share-count input. The input
// keeps customId "shares" so the modal-submit handler reads it unchanged.
function buildTradeModal({ db, user_profile, kind, company } = {}) {
    const buying = kind === 'buy';
    const symbol = company.symbol;
    const price = Number(company.price);
    const owned = Number(getPortfolio(user_profile)[symbol]?.shares) || 0;
    const status = marketStatus();
    const rate = brokerRate(db, user_profile);
    const total = n => quoteTrade({ db, user_profile, kind, price, shares: n, symbol }).total;

    const head = [
        `**${company.name}** — 📀${money(price)} / share`,
        `Broker fee ${(rate * 100).toFixed(1)}% (market ${status.open ? 'open' : 'closed'})`,
    ];
    // Same amount-first, padded style as the confirmation receipt.
    const rows = [];
    let placeholder = 'e.g. 10';
    if (buying) {
        const max = maxAffordableShares(db, user_profile, price, symbol);
        rows.push({ amount: tgx(balanceOf(user_profile)), label: "You have" }, RULE);
        [10, 100, 1000].forEach(n => rows.push({ amount: tgx(total(n)), label: `for ${number_with_commas(n)} shares` }));
        if (max > 0) rows.push({ amount: tgx(total(max)), label: `for ${number_with_commas(max)} shares (max you can afford)`, bold: true });
        placeholder = max > 0 ? `1 – ${number_with_commas(max)}` : 'not enough truguts';
    } else if (owned <= 0) {
        head.push(`You don't own any ${symbol}.`);
    } else {
        head.push(`You own **${number_with_commas(owned)}** shares (≈ 📀${tg(owned * price)})`);
        [10, 100, 1000].filter(n => owned >= n).forEach(n => rows.push({ amount: tgx(total(n)), label: `for ${number_with_commas(n)} shares` }));
        rows.push({ amount: tgx(total(owned)), label: `for all ${number_with_commas(owned)} shares`, bold: true });
        placeholder = `1 – ${number_with_commas(owned)}`;
    }

    const content = head.join('\n') + (rows.length ? `\n\n${receiptLines(rows)}` : '');

    return new ModalBuilder()
        .setCustomId(`stock_confirm${kind}_${symbol}`)
        .setTitle(`${buying ? 'Buy' : 'Sell'} ${symbol}`)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
        .addLabelComponents(new LabelBuilder()
            .setLabel('Number of shares')
            .setTextInputComponent(new TextInputBuilder()
                .setCustomId('shares')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(12)
                .setPlaceholder(placeholder)));
}

// ---- chart --------------------------------------------------------------

// Build a QuickChart line graph of a company's price history for the given
// range. Returns an AttachmentBuilder (attachment://chart.png) or null on
// failure — callers must handle null (render the embed without an image).
async function priceChart({ company, range } = {}) {
    try {
        const points = RANGE_POINTS[range] || RANGE_POINTS[DEFAULT_RANGE];
        // Keep timestamp + price together so x-axis date labels stay aligned with
        // the plotted points even after dropping any non-finite prices.
        const history = (Array.isArray(company.history) ? company.history : [])
            .slice(-points)
            .filter(h => Number.isFinite(Number(h.price)));
        if (history.length < 2) return null; // nothing meaningful to plot yet

        const data = history.map(h => Number(h.price));
        const labels = history.map(h => h.t ? moment(h.t).tz('America/New_York').format('M/D') : '');

        // Per-stock line color from static data (dark-mode charts).
        const meta = COMPANIES.find(c => c.symbol === company.symbol);
        const line = meta?.color || "#4FC3F7";

        const chart = {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: company.symbol,
                    data,
                    borderColor: line,
                    backgroundColor: line + "22",
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.25,
                }],
            },
            options: {
                legend: { display: false },
                title: { display: true, text: `${company.symbol} — ${range}`, fontColor: "#E0E0E0", fontSize: 16 },
                scales: {
                    xAxes: [{ display: true, ticks: { fontColor: "#B0B0B0", maxTicksLimit: 6, autoSkip: true, maxRotation: 0 }, gridLines: { color: "rgba(255,255,255,0.05)", zeroLineColor: "rgba(255,255,255,0.05)" } }],
                    yAxes: [{ ticks: { beginAtZero: false, fontColor: "#B0B0B0" }, gridLines: { color: "rgba(255,255,255,0.08)", zeroLineColor: "rgba(255,255,255,0.08)" } }],
                },
            },
        };

        const res = await chartAxios.post(
            "https://quickchart.io/chart",
            { chart, width: 600, height: 300, backgroundColor: "#1e1f22", format: "png" },
            { responseType: "arraybuffer", timeout: 8000 }
        );
        return new AttachmentBuilder(Buffer.from(res.data), { name: "chart.png" });
    } catch (err) {
        console.error("[stock] priceChart failed:", err?.message ?? err);
        return null;
    }
}

module.exports = {
    // formatting
    money, tg, tgx, changeParts, sentiment,
    // state
    getCompanies, getCompany, getPortfolio, getMeta, holdingsValue, balanceOf, netWorth, isWhale, isMarketLive,
    // trade math
    marketStatus, brokerRate, slippageMult, quoteTrade,
    // embeds
    marketEmbed, stockDetailEmbed, portfolioEmbed, confirmEmbed, resultEmbed, helpEmbed,
    // components
    marketComponents, detailComponents, portfolioComponents, confirmComponents, buildTradeModal, maxAffordableShares,
    // chart
    priceChart,
    // logos
    companyLogo, hasLogo,
    // constants re-export
    config, DEFAULT_RANGE, normalizeRange,
};
