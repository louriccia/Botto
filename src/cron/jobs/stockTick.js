// Wald Street Exchange price engine.
//
// Advances every company's price on the four daily ticks. The cron fires every
// 5 minutes but SELF-GATES on Eastern-time tick boundaries via an absolute-slot
// counter stored in stock/meta.lastAbs — the same "run constantly, act only on a
// boundary" pattern used by dailyChallenge/monthlyChallenge. On first run (no
// data) it seeds the market. Requires ENABLE_CRON=true (see bot.js).
//
// One real day = four ticks at 12am/6am/12pm/6pm ET, each with a role:
//   12am  postDaily  — feature a random pod (exposure); light trend drift on the rest
//   6am   arm boost  — the featured pod's volatility spikes; market opens
//   12pm  postNews   — a headline drops (staged for 6pm)
//   6pm   applyNews  — the headline moves the affected stock's trend; market closes
//
// Per-tick price math (ported from stock_market.html):
//   reversion = meanReversionStrength * ln(anchor / price)   // pull toward fair value
//   total     = clamp(trendBias + reversion + noise(vol) + playerPressure*impact, -0.35, 0.35)
//   price     = max(minPrice, price * (1 + total))
// This build has no simulated crowd — playerPressure comes only from real trades.

const moment = require('moment');
require('moment-timezone');

const scheduler = require('../scheduler');
const { database, db } = require('../../firebase');
const { COMPANIES } = require('../../data/stock/companies');
const { NEWS, PILOTS, SHAREHOLDERS } = require('../../data/stock/news');
const {
    config, TICKS, TREND_ORDER, TREND_BIAS, HISTORY_CAP, MAX_CATCHUP, isWeekday
} = require('../../data/stock/config');

const easternTime = () => moment().tz('America/New_York');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = n => Math.floor(Math.random() * n);
const trendSign = t => Math.sign(TREND_BIAS[t] || 0);

// Box-Muller gaussian.
function randomNormal(mean = 0, sd = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Random one-step trend nudge. The bullish extreme must bounce back inward; the
// bearish extreme is allowed to stay stuck (matches the prototype).
function shiftTrend(current) {
    const i = TREND_ORDER.indexOf(current);
    if (i < 0) return "neutral";
    let step = Math.random() < 0.5 ? -1 : 1;
    if (i + step > TREND_ORDER.length - 1) step = -step;
    return TREND_ORDER[clamp(i + step, 0, TREND_ORDER.length - 1)];
}

const shiftTrendBy = (t, delta) =>
    TREND_ORDER[clamp(TREND_ORDER.indexOf(t) + delta, 0, TREND_ORDER.length - 1)];
const mirrorTrend = t => TREND_ORDER[TREND_ORDER.length - 1 - TREND_ORDER.indexOf(t)];

function playerPressure(c) {
    const net = ((Number(c.buyVolume) || 0) - (Number(c.sellVolume) || 0)) / config.pressureReference;
    return clamp(net * config.playerPressureCap, -config.playerPressureCap, config.playerPressureCap);
}

// ---- daily events -------------------------------------------------------

// 12am: feature a random pod for the day. Its maker gets "exposure" — volatility
// spikes from the 6am tick (armed here, applied then). Trend is NOT rerolled
// (that is the noon news' job). Everyone else gets a light trend random-walk so
// the board isn't static between news events.
function postDaily(companies, meta) {
    const symbols = Object.keys(companies);
    if (!symbols.length) return;
    const sym = symbols[randInt(symbols.length)];
    symbols.forEach(s => { companies[s].exposed = false; companies[s].newsToday = false; });
    const c = companies[sym];
    c.exposed = true;
    c.boostArmed = true;
    meta.appearanceSymbol = sym;
    meta.todayAppearance = `${c.symbol} — ${c.name}`;
    meta.todayNews = null;
    symbols.forEach(s => {
        if (s !== sym && Math.random() < config.trendDriftChance) companies[s].trend = shiftTrend(companies[s].trend);
    });
}

// Replace {company}/{pilot}/{shareholder} placeholders; a filled {company} sets
// the affected stock when the headline didn't already name one.
function fillTemplate(entry) {
    let text = entry.text;
    let stock = entry.stock || null;
    if (text.includes("{company}")) {
        const c = COMPANIES[randInt(COMPANIES.length)];
        text = text.replaceAll("{company}", c.name);
        if (!stock) stock = c.symbol;
    }
    if (text.includes("{pilot}")) text = text.replaceAll("{pilot}", PILOTS[randInt(PILOTS.length)]);
    if (text.includes("{shareholder}")) text = text.replaceAll("{shareholder}", SHAREHOLDERS[randInt(SHAREHOLDERS.length)]);
    return { text, stock };
}

// 12pm: pick a headline, resolve its stock/sentiment, stage the effect for 6pm.
function postNews(meta) {
    const entry = NEWS[randInt(NEWS.length)];
    const filled = fillTemplate(entry);
    meta.pendingNews = { text: filled.text, sentiment: entry.sentiment, level: entry.level, stock: filled.stock };
    meta.todayNews = filled.text;
}

// 6pm: news moves trend. A named stock shifts toward the sentiment (scaled by
// level; L3 jumps to the strong extreme). A stockless headline flips 3 random
// stocks currently trending opposite to the sentiment.
function applyNews(companies, meta) {
    const n = meta.pendingNews;
    meta.pendingNews = null;
    if (!n) return;
    const dir = n.sentiment === "boom" ? 1 : n.sentiment === "crisis" ? -1 : 0;
    if (dir === 0) return; // slow news: flavor only

    if (n.stock) {
        const c = companies[n.stock];
        if (!c) return;
        c.trend = n.level >= 3
            ? (dir > 0 ? "strong_bullish" : "strong_bearish")
            : shiftTrendBy(c.trend, dir * n.level);
        c.newsToday = true;
        c.newsEventTick = true;
    } else {
        const oppositeSign = -dir; // boom => flip currently-bearish; crisis => flip currently-bullish
        const picks = shuffle(Object.values(companies).filter(c => trendSign(c.trend) === oppositeSign)).slice(0, 3);
        picks.forEach(c => { c.trend = mirrorTrend(c.trend); c.newsToday = true; c.newsEventTick = true; });
    }
}

// ---- tick ---------------------------------------------------------------

// Fill any fields a company is missing (schema migration for markets seeded by
// an earlier build, so old data ticks forward cleanly instead of NaN-ing).
function normalizeCompany(c) {
    const price = Number(c.price) || config.minPrice;
    if (!Number.isFinite(Number(c.anchor))) c.anchor = price;
    if (!Number.isFinite(Number(c.histHigh))) c.histHigh = price;
    if (!Number.isFinite(Number(c.histLow))) c.histLow = price;
    if (!Number.isFinite(Number(c.boostTicks))) c.boostTicks = 0;
    if (typeof c.boostArmed !== 'boolean') c.boostArmed = false;
    if (typeof c.exposed !== 'boolean') c.exposed = false;
    if (typeof c.newsToday !== 'boolean') c.newsToday = false;
    if (typeof c.newsEventTick !== 'boolean') c.newsEventTick = false;
    if (!Number.isFinite(Number(c.buyVolume))) c.buyVolume = 0;
    if (!Number.isFinite(Number(c.sellVolume))) c.sellVolume = 0;
    if (!Array.isArray(c.history)) c.history = [];
    return c;
}

// Advance one tick. slotIndex is 0=12am, 1=6am, 2=12pm, 3=6pm.
function runTick(companies, meta, slotIndex, now) {
    const slot = TICKS[slotIndex];
    const isOpen = slot.open && isWeekday(now);
    const sentimentImpact = isOpen ? config.sentimentImpactOpen : config.sentimentImpactClosed;

    // Slot-tied events, resolved before prices move.
    if (slot.role === 'daily') { meta.day = (Number(meta.day) || 1) + 1; postDaily(companies, meta); }
    if (slot.role === 'news') postNews(meta);
    if (slot.label === '6am') {
        const app = companies[meta.appearanceSymbol];
        if (app && app.boostArmed) { app.boostTicks = config.appearanceBoostTicks; app.boostArmed = false; }
    }
    if (slot.label === '6pm') applyNews(companies, meta);

    for (const sym of Object.keys(companies)) {
        const c = normalizeCompany(companies[sym]);
        const boosted = c.boostTicks > 0;
        const vol = (Number(c.baseVolatility) || 0) * (boosted ? config.appearanceVolatilityMultiplier : 1);
        const price0 = Number(c.price) || config.minPrice;
        const trend = TREND_BIAS[c.trend] ?? 0;
        const reversion = config.meanReversionStrength * Math.log((Number(c.anchor) || price0) / price0);
        const noise = randomNormal(0, vol);
        const player = playerPressure(c) * sentimentImpact;
        let total = clamp(trend + reversion + noise + player, -0.35, 0.35);
        if (!Number.isFinite(total)) total = 0;

        let price = Math.max(config.minPrice, price0 * (1 + total));
        price = Math.round(price * 100) / 100;
        if (!Number.isFinite(price)) price = price0;

        c.price = price;
        if (price > c.histHigh) c.histHigh = price;
        if (price < c.histLow) c.histLow = price;
        c.lastChange = total;
        c.lastDebug = { trend, reversion, noise, player, total };

        c.history.push({ t: Date.now(), price, boosted, newsFlag: !!c.newsEventTick });
        if (c.history.length > HISTORY_CAP) c.history = c.history.slice(-HISTORY_CAP);
        c.newsEventTick = false;

        c.buyVolume = 0;
        c.sellVolume = 0;
        if (c.boostTicks > 0) c.boostTicks--;
    }
    meta.tickIndex = slotIndex;
}

// The most recent tick slot that should have fired, as a monotonic absolute
// index. TICKS[0] is at hour 0, so every wall-clock hour maps to some slot and
// index is never negative. 400 > max dayOfYear keeps absDay*4 divisible by 4,
// so absSlot % 4 === index.
function currentSlot(now) {
    const hour = now.hour();
    let index = 0;
    for (let i = 0; i < TICKS.length; i++) {
        if (hour >= TICKS[i].hour) index = i;
    }
    const absDay = now.year() * 400 + now.dayOfYear();
    return { absSlot: absDay * TICKS.length + index, index };
}

function seed(now) {
    const companies = {};
    for (const c of COMPANIES) {
        companies[c.symbol] = {
            symbol: c.symbol,
            name: c.name,
            price: c.price,
            baseVolatility: c.baseVolatility,
            trend: c.trend,
            anchor: c.price,
            histHigh: c.price,
            histLow: c.price,
            boostTicks: 0,
            boostArmed: false,
            exposed: false,
            newsToday: false,
            newsEventTick: false,
            buyVolume: 0,
            sellVolume: 0,
            lastChange: 0,
            lastDebug: { trend: 0, reversion: 0, noise: 0, player: 0, total: 0 },
            history: [{ t: Date.now(), price: c.price, boosted: false, newsFlag: false }]
        };
    }
    const meta = {
        day: 1, tickIndex: 0, appearanceSymbol: null, todayAppearance: null,
        todayNews: null, pendingNews: null, lastAbs: currentSlot(now).absSlot
    };
    postDaily(companies, meta);
    return { companies, meta };
}

let running = false;

async function run() {
    if (running) return;
    running = true;
    try {
        const now = easternTime();

        // First run ever: seed the market and wait for the next boundary.
        if (!db.stock || !db.stock.companies || !Object.keys(db.stock.companies).length) {
            const { companies, meta } = seed(now);
            await database.ref('stock/companies').set(companies);
            await database.ref('stock/meta').set(meta);
            console.log('[cron:stockTick] seeded market (21 companies @ 100)');
            return;
        }

        const companies = db.stock.companies;
        const meta = db.stock.meta || { day: 1, tickIndex: 0, appearanceSymbol: null, pendingNews: null };

        const cur = currentSlot(now);
        const lastAbs = Number.isFinite(meta.lastAbs) ? meta.lastAbs : cur.absSlot - 1;
        if (cur.absSlot <= lastAbs) return; // no boundary crossed since last tick

        // Replay the most recent pending ticks (capped), so the final tick lands
        // on the current wall-clock slot even after downtime.
        const ticksToRun = Math.min(cur.absSlot - lastAbs, MAX_CATCHUP);
        for (let s = cur.absSlot - ticksToRun + 1; s <= cur.absSlot; s++) {
            const idx = ((s % TICKS.length) + TICKS.length) % TICKS.length;
            runTick(companies, meta, idx, now);
        }
        meta.lastAbs = cur.absSlot;

        await database.ref('stock/companies').set(companies);
        await database.ref('stock/meta').set(meta);
        console.log(`[cron:stockTick] ran ${ticksToRun} tick(s) -> day ${meta.day} ${TICKS[meta.tickIndex].label} (lastAbs ${cur.absSlot})`);
    } catch (err) {
        console.error('[cron:stockTick] threw', err?.message ?? err);
    } finally {
        running = false;
    }
}

scheduler.register({
    name: 'stockTick',
    // Every 5 minutes; self-gates on the 12am/6am/12pm/6pm ET tick boundaries.
    schedule: '*/5 * * * *',
    run,
});

// Exported for manual invocation / verification (e.g. force a tick in a REPL).
module.exports = { run, seed, runTick, currentSlot };
