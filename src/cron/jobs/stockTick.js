// Wald Street Exchange price engine.
//
// Advances every company's price on the three daily ticks (Open/Midday/Close,
// see config.TICK_TIMES). The cron fires every 5 minutes but SELF-GATES on
// Eastern-time tick boundaries via an absolute-slot counter stored in
// stock/meta.lastAbs — the same "run constantly, act only on a boundary"
// pattern used by dailyChallenge/monthlyChallenge. On first run (no data) it
// seeds the market. Requires ENABLE_CRON=true (see bot.js).
//
// Price math is ported verbatim from stock_market.html:
//   total = clamp(trendBias + gaussianNoise(vol) + playerPressure, -0.35, 0.35)
//   price = max(minPrice, price * (1 + total))

const moment = require('moment');
require('moment-timezone');

const scheduler = require('../scheduler');
const { database, db } = require('../../firebase');
const { COMPANIES } = require('../../data/stock/companies');
const {
    config, TREND_ORDER, TREND_BIAS, TICK_TIMES, HISTORY_CAP, MAX_CATCHUP
} = require('../../data/stock/config');

const easternTime = () => moment().tz('America/New_York');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Box-Muller gaussian.
function randomNormal(mean = 0, sd = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

function rollTrend() {
    const r = Math.random();
    if (r < 0.12) return "strong_bearish";
    if (r < 0.32) return "bearish";
    if (r < 0.68) return "neutral";
    if (r < 0.88) return "bullish";
    return "strong_bullish";
}

function shiftTrend(current) {
    const i = TREND_ORDER.indexOf(current);
    if (i < 0) return "neutral";
    return TREND_ORDER[clamp(i + (Math.random() < 0.5 ? -1 : 1), 0, TREND_ORDER.length - 1)];
}

function playerPressure(c) {
    const net = ((Number(c.buyVolume) || 0) - (Number(c.sellVolume) || 0)) / config.pressureReference;
    return clamp(net * config.playerPressureCap, -config.playerPressureCap, config.playerPressureCap);
}

// Pick one company for the day's public exposure: reroll its trend, boost its
// volatility for the next few ticks. Clears everyone else's exposed flag.
function exposeRandomCompany(companies, meta) {
    const symbols = Object.keys(companies);
    if (!symbols.length) return;
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    symbols.forEach(s => { companies[s].exposed = false; });
    companies[sym].trend = rollTrend();
    companies[sym].boostTicks = config.appearanceBoostTicks;
    companies[sym].exposed = true;
    meta.exposureSymbol = sym;
}

// Advance one tick. slotIndex is 0=Open, 1=Midday, 2=Close. Exposure + trend
// drift happen on the open, so the exposed company's boost covers all 3 ticks.
function runTick(companies, meta, slotIndex) {
    const isOpen = slotIndex === 0;
    if (isOpen) {
        exposeRandomCompany(companies, meta);
        meta.day = (Number(meta.day) || 1) + 1;
    }
    for (const sym of Object.keys(companies)) {
        const c = companies[sym];
        const vol = (Number(c.baseVolatility) || 0) * (c.boostTicks > 0 ? config.appearanceVolatilityMultiplier : 1);
        const trend = TREND_BIAS[c.trend] ?? 0;
        const noise = randomNormal(0, vol);
        const player = playerPressure(c);
        let total = clamp(trend + noise + player, -0.35, 0.35);
        if (!Number.isFinite(total)) total = 0;

        let price = Math.max(config.minPrice, (Number(c.price) || config.minPrice) * (1 + total));
        price = Math.round(price * 100) / 100;
        if (!Number.isFinite(price)) price = Number(c.price) || config.minPrice;

        c.price = price;
        c.lastChange = total;
        c.buyVolume = 0;
        c.sellVolume = 0;

        if (c.boostTicks > 0 && --c.boostTicks === 0) c.exposed = false;

        if (isOpen && sym !== meta.exposureSymbol && Math.random() < config.trendDriftChance) {
            c.trend = shiftTrend(c.trend);
        }

        c.history = Array.isArray(c.history) ? c.history : [];
        c.history.push({ t: Date.now(), price });
        if (c.history.length > HISTORY_CAP) c.history = c.history.slice(-HISTORY_CAP);
    }
    meta.tickIndex = slotIndex;
}

// The most recent tick slot that should have fired, as a monotonic absolute
// index (so we can measure how many ticks are pending since lastAbs). Before
// today's open we belong to yesterday's close (index 2).
// 400 > max dayOfYear keeps absDay*3 divisible by 3, so absSlot % 3 === index.
function currentSlot(now) {
    const hour = now.hour();
    let index = -1;
    for (let i = 0; i < TICK_TIMES.length; i++) {
        if (hour >= TICK_TIMES[i]) index = i;
    }
    let base = now;
    if (index === -1) {
        base = now.clone().subtract(1, 'day');
        index = TICK_TIMES.length - 1;
    }
    const absDay = base.year() * 400 + base.dayOfYear();
    return { absSlot: absDay * TICK_TIMES.length + index, index };
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
            boostTicks: 0,
            exposed: false,
            buyVolume: 0,
            sellVolume: 0,
            lastChange: 0,
            history: [{ t: Date.now(), price: c.price }]
        };
    }
    const meta = { day: 1, tickIndex: 0, exposureSymbol: null, lastAbs: currentSlot(now).absSlot };
    exposeRandomCompany(companies, meta);
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
        const meta = db.stock.meta || { day: 1, tickIndex: 0, exposureSymbol: null };

        const cur = currentSlot(now);
        const lastAbs = Number.isFinite(meta.lastAbs) ? meta.lastAbs : cur.absSlot - 1;
        if (cur.absSlot <= lastAbs) return; // no boundary crossed since last tick

        // Replay the most recent pending ticks (capped), so the final tick lands
        // on the current wall-clock slot even after downtime.
        const ticksToRun = Math.min(cur.absSlot - lastAbs, MAX_CATCHUP);
        for (let s = cur.absSlot - ticksToRun + 1; s <= cur.absSlot; s++) {
            const idx = ((s % TICK_TIMES.length) + TICK_TIMES.length) % TICK_TIMES.length;
            runTick(companies, meta, idx);
        }
        meta.lastAbs = cur.absSlot;

        await database.ref('stock/companies').set(companies);
        await database.ref('stock/meta').set(meta);
        console.log(`[cron:stockTick] ran ${ticksToRun} tick(s) -> day ${meta.day} tick ${meta.tickIndex} (lastAbs ${cur.absSlot})`);
    } catch (err) {
        console.error('[cron:stockTick] threw', err?.message ?? err);
    } finally {
        running = false;
    }
}

scheduler.register({
    name: 'stockTick',
    // Every 5 minutes; self-gates on the 9:00/13:00/17:00 ET tick boundaries.
    schedule: '*/5 * * * *',
    run,
});

// Exported for manual invocation / verification (e.g. force a tick in a REPL).
module.exports = { run, seed, runTick, currentSlot };
