// View builders, component builders, trade-quote math, and the QuickChart
// price-graph generator for the Wald Street Exchange stock market. Follows the
// codebase convention of one bespoke EmbedBuilder per view (see
// challenge/functions.js menuEmbed etc.).

const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, AttachmentBuilder
} = require('discord.js');
const moment = require('moment');
require('moment-timezone');
const { number_with_commas } = require('../../generic.js');
const { trugut_color } = require('../../colors.js');
const { COMPANIES } = require('../../data/stock/companies.js');
const { config, TREND_LABEL, RANGE_POINTS, DEFAULT_RANGE, isMarketOpen } = require('../../data/stock/config.js');

const UP = "#57F287";
const DOWN = "#ED4245";

const easternTime = () => moment().tz('America/New_York');

// Isolated axios instance — the shared `axios` default is globally mutated
// elsewhere (lookup.js sets baseURL/headers), so never reuse it for QuickChart.
const chartAxios = require('axios').create();

// ---- formatting helpers -------------------------------------------------

const money = v => number_with_commas(Number(v || 0).toFixed(2));
const tg = v => number_with_commas(Math.round(Number(v) || 0));
const pctText = v => `${v > 0 ? "+" : ""}${(Number(v) * 100).toFixed(2)}%`;

function changeParts(lastChange) {
    const c = Number(lastChange) || 0;
    const arrow = c > 0 ? "▲" : c < 0 ? "▼" : "–";
    return { arrow, text: `${arrow} ${pctText(c)}`, up: c > 0, down: c < 0 };
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
        // Preserve the canonical COMPANIES order.
        return COMPANIES.map(c => stored[c.symbol] || { ...c, lastChange: 0, history: [] });
    }
    return COMPANIES.map(c => ({ ...c, anchor: c.price, histHigh: c.price, histLow: c.price, boostTicks: 0, exposed: false, newsToday: false, buyVolume: 0, sellVolume: 0, lastChange: 0, history: [] }));
}

function getCompany(db, symbol) {
    if (!symbol) return null;
    return getCompanies(db).find(c => c.symbol === String(symbol).toUpperCase()) || null;
}

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
// moves against you. Cost grows ~linearly with the impact fraction; small orders
// are barely affected. Returns the average-fill multiplier on the quoted price.
function slippageMult(grossNotional, side) {
    const impact = Math.min((Number(grossNotional) || 0) / config.slippageLiquidity, config.maxImpact);
    const half = impact / 2;
    return side === 'buy' ? 1 + half : Math.max(0.1, 1 - half);
}

// Full cost/proceeds breakdown for a `shares`-sized order at the current price.
// Truguts are whole, so base/fee/total are rounded; fillPrice stays at 2dp for
// display. Callers (confirm + execute) must both go through this so the numbers
// they show and charge match.
function quoteTrade({ db, user_profile, kind, price, shares }) {
    const p = Number(price) || 0;
    const gross = p * shares;
    const slip = slippageMult(gross, kind);
    const fillPrice = p * slip;
    const base = Math.round(fillPrice * shares);
    const rate = brokerRate(db, user_profile);
    const fee = Math.round(fillPrice * shares * rate);
    const total = kind === 'buy' ? base + fee : base - fee;
    return { gross, slip, fillPrice, base, rate, fee, total };
}

// ---- embeds -------------------------------------------------------------

function marketEmbed({ db, user_profile } = {}) {
    const companies = getCompanies(db);
    const meta = getMeta(db);
    const status = marketStatus();

    const header = "SYM    PRICE        CHANGE";
    const rows = companies.map(c => {
        const { text } = changeParts(c.lastChange);
        const fire = Number(c.boostTicks) > 0 ? " 🔥" : "";
        return `${c.symbol.padEnd(6)}${money(c.price).padStart(9)}   ${text}${fire}`;
    });
    let desc = "```\n" + header + "\n" + rows.join("\n") + "\n```";

    desc += `\n🕒 **Market:** ${status.open ? "🟢 OPEN" : "🔴 CLOSED"} — broker fee ${(brokerRate(db, user_profile) * 100).toFixed(1)}%`;
    if (meta.todayAppearance) desc += `\n🏁 **Featured pod:** ${meta.todayAppearance}`;
    if (meta.todayNews) desc += `\n📰 ${meta.todayNews}`;

    const balance = balanceOf(user_profile);
    const holdings = holdingsValue(db, user_profile);
    const whaleTag = isWhale(db, user_profile) ? " 🐋" : "";
    desc += `\n\n💰 **Truguts:** ${tg(balance)} 📦 **Holdings:** ${tg(holdings)} 📊 **Net worth:** ${tg(balance + holdings)}${whaleTag}`;

    return new EmbedBuilder()
        .setTitle("📈 Wald Street Exchange")
        .setDescription(desc)
        .setColor(trugut_color)
        .setFooter({ text: "Pick a company below • ticks 4×/day (12a/6a/12p/6p ET) • 🔥 volatility boosted" });
}

function stockDetailEmbed({ db, user_profile, symbol } = {}) {
    const c = getCompany(db, symbol);
    if (!c) return new EmbedBuilder().setTitle("Unknown company").setColor(DOWN);

    const { text, up, down } = changeParts(c.lastChange);
    const pos = getPortfolio(user_profile)[c.symbol];
    const owned = Number(pos?.shares) || 0;

    let desc =
        `**Price:** ${money(c.price)} ${text}\n` +
        `**Range:** ${money(c.histLow)} – ${money(c.histHigh)}\n` +
        `**Trend:** ${TREND_LABEL[c.trend] || c.trend} **Sentiment:** ${sentiment(c)}`;
    const tags = [];
    if (Number(c.boostTicks) > 0 || c.exposed) tags.push("🔥 *Featured today — volatility boosted.*");
    if (c.newsToday) tags.push("📰 *Moved by today's news.*");
    if (tags.length) desc += `\n${tags.join("\n")}`;

    const embed = new EmbedBuilder()
        .setTitle(`${c.symbol} — ${c.name}`)
        .setDescription(desc)
        .setColor(up ? UP : down ? DOWN : trugut_color);

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
            `You have no positions yet.\n\n💰 **Truguts:** ${tg(balance)}\nUse \`/market\` to start trading.`
        );
        return embed;
    }

    let totalValue = 0, totalCost = 0;
    const header = "SYM    SHARES     VALUE       P/L";
    const rows = entries.map(([sym, p]) => {
        const c = companies.find(x => x.symbol === sym) || { price: 0 };
        const shares = Number(p.shares) || 0;
        const avg = Number(p.averageCost) || 0;
        const value = Number(c.price) * shares;
        const cost = avg * shares;
        const pl = value - cost;
        totalValue += value;
        totalCost += cost;
        const plSign = pl >= 0 ? "+" : "-";
        return `${sym.padEnd(6)}${number_with_commas(shares).padStart(8)}${money(value).padStart(12)}   ${plSign}${money(Math.abs(pl))}`;
    });

    const totalPl = totalValue - totalCost;
    const plSign = totalPl >= 0 ? "+" : "-";
    const whaleTag = isWhale(db, user_profile) ? " 🐋" : "";
    embed.setDescription(
        "```\n" + header + "\n" + rows.join("\n") + "\n```" +
        `\n💰 **Truguts:** ${tg(balance)} 📦 **Holdings:** ${tg(totalValue)}` +
        `\n📊 **Net worth:** ${tg(balance + totalValue)}${whaleTag} 📈 **Total P/L:** ${plSign}${money(Math.abs(totalPl))}`
    );
    return embed;
}

// Confirmation shown (ephemerally) after the buy/sell modal, before the trade
// goes through — surfaces slippage, the market-hours broker fee, and any whale rake.
function confirmEmbed({ kind, symbol, name, shares, quote, balance, whale } = {}) {
    const buying = kind === "buy";
    const status = marketStatus();
    const slipPct = ((quote.slip - 1) * 100);
    const slipLine = Math.abs(slipPct) >= 0.05
        ? `\n**Fill price:** ${money(quote.fillPrice)} each (slippage ${slipPct > 0 ? "+" : ""}${slipPct.toFixed(1)}%)`
        : "";
    return new EmbedBuilder()
        .setTitle(`${buying ? "🛒 Confirm Buy" : "💵 Confirm Sell"} — ${symbol}`)
        .setColor(trugut_color)
        .setDescription(
            `${name}\n\n` +
            `**Shares:** ${number_with_commas(shares)}\n` +
            `**Quoted price:** ${money(quote.fillPrice ? quote.gross / shares : 0)} each` +
            slipLine + `\n` +
            `**${buying ? "Cost" : "Gross"}:** ${tg(quote.base)}\n` +
            `**Broker fee (${(quote.rate * 100).toFixed(1)}%${whale ? " 🐋" : ""}, market ${status.open ? "open" : "closed"}):** ${buying ? "+" : "-"}${tg(quote.fee)}\n` +
            `**${buying ? "Total to pay" : "You receive"}:** ${tg(quote.total)}\n\n` +
            `Your truguts: ${tg(balance)}`
        );
}

function resultEmbed({ kind, symbol, shares, quote } = {}) {
    const buying = kind === "buy";
    return new EmbedBuilder()
        .setTitle(buying ? "✅ Purchase complete" : "✅ Sale complete")
        .setColor(UP)
        .setDescription(
            `${buying ? "Bought" : "Sold"} **${number_with_commas(shares)}** ${symbol} @ ${money(quote.fillPrice)}.\n` +
            `${buying ? "Paid" : "Received"} **${tg(quote.total)}** truguts (fee ${tg(quote.fee)}).`
        );
}

// ---- components ---------------------------------------------------------

// Dropdown of all 21 companies -> stock_detail (value = symbol).
function companySelect(selected) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("stock_detail")
        .setPlaceholder("Select a company for details")
        .setMinValues(1)
        .setMaxValues(1);
    COMPANIES.forEach(c => {
        menu.addOptions({
            label: `${c.symbol} — ${c.name}`.substring(0, 100),
            value: c.symbol,
            default: selected === c.symbol,
        });
    });
    return new ActionRowBuilder().addComponents(menu);
}

function marketComponents(db, opts = {}) {
    const portfolioBtn = new ButtonBuilder()
        .setCustomId("stock_portfolio")
        .setLabel("My Portfolio")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📦");
    return [companySelect(opts.selected), new ActionRowBuilder().addComponents(portfolioBtn)];
}

function historySelect(symbol, range) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`stock_history_${symbol}`)
        .setPlaceholder("Graph range")
        .setMinValues(1)
        .setMaxValues(1);
    [["1D", "Today"], ["1W", "1 Week"], ["1M", "1 Month"], ["ALL", "All time"]].forEach(([value, label]) => {
        menu.addOptions({ label, value, default: (range || DEFAULT_RANGE) === value });
    });
    return new ActionRowBuilder().addComponents(menu);
}

function detailComponents({ symbol, range } = {}) {
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_buy_${symbol}`).setLabel("Buy").setStyle(ButtonStyle.Success).setEmoji("🛒"),
        new ButtonBuilder().setCustomId(`stock_sell_${symbol}`).setLabel("Sell").setStyle(ButtonStyle.Danger).setEmoji("💵"),
        new ButtonBuilder().setCustomId("stock_portfolio").setLabel("Portfolio").setStyle(ButtonStyle.Secondary).setEmoji("📦"),
        new ButtonBuilder().setCustomId("stock_market").setLabel("Market").setStyle(ButtonStyle.Secondary).setEmoji("📈"),
    );
    return [historySelect(symbol, range), buttons];
}

function portfolioComponents(db) {
    const backBtn = new ButtonBuilder()
        .setCustomId("stock_market")
        .setLabel("Back to Market")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📈");
    return [companySelect(), new ActionRowBuilder().addComponents(backBtn)];
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

// ---- chart --------------------------------------------------------------

// Build a QuickChart line graph of a company's price history for the given
// range. Returns an AttachmentBuilder (attachment://chart.png) or null on
// failure — callers must handle null (render the embed without an image).
async function priceChart({ company, range } = {}) {
    try {
        const points = RANGE_POINTS[range] || RANGE_POINTS[DEFAULT_RANGE];
        const history = (Array.isArray(company.history) ? company.history : []).slice(-points);
        if (history.length < 2) return null; // nothing meaningful to plot yet

        const data = history.map(h => Number(h.price)).filter(Number.isFinite);
        if (data.length < 2) return null;
        const rising = data[data.length - 1] >= data[0];
        const line = rising ? UP : DOWN;

        const chart = {
            type: "line",
            data: {
                labels: data.map((_, i) => i),
                datasets: [{
                    label: company.symbol,
                    data,
                    borderColor: line,
                    backgroundColor: line + "33",
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2,
                    tension: 0.2,
                }],
            },
            options: {
                legend: { display: false },
                title: { display: true, text: `${company.symbol} — ${range}` },
                scales: {
                    xAxes: [{ display: false }],
                    yAxes: [{ ticks: { beginAtZero: false } }],
                },
            },
        };

        const res = await chartAxios.post(
            "https://quickchart.io/chart",
            { chart, width: 600, height: 300, backgroundColor: "white", format: "png" },
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
    money, tg, changeParts, sentiment,
    // state
    getCompanies, getCompany, getPortfolio, getMeta, holdingsValue, balanceOf, netWorth, isWhale,
    // trade math
    marketStatus, brokerRate, slippageMult, quoteTrade,
    // embeds
    marketEmbed, stockDetailEmbed, portfolioEmbed, confirmEmbed, resultEmbed,
    // components
    marketComponents, detailComponents, portfolioComponents, confirmComponents,
    // chart
    priceChart,
    // constants re-export
    config, DEFAULT_RANGE,
};
