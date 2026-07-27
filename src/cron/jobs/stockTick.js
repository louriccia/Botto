// Wald Street Exchange price engine.
//
// Advances every company's price on the four daily ticks. The cron fires every
// 5 minutes but SELF-GATES on Eastern-time tick boundaries via an absolute-slot
// counter stored in stock/meta.lastAbs — the same "run constantly, act only on a
// boundary" pattern used by dailyChallenge/monthlyChallenge. On first run (no
// data) it seeds the market. Requires ENABLE_CRON=true (see bot.js).
//
// One real day = four ticks at 12am/6am/12pm/6pm ET, each with a role:
//   12am  postDaily  — reset exposure/news flags; light trend drift
//   6am   feature    — the day's Challenge-of-the-Day pod maker gets exposure
//                       (volatility boost); market opens. Selection happens here,
//                       not at 12am, because the new cotd is only posted by the
//                       minuteUpdater shortly AFTER midnight.
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
const { racers } = require('../../data/sw_racer/racer');
const { tracks } = require('../../data/sw_racer/track');
const { planets } = require('../../data/sw_racer/planet');
const { NEWS, SHAREHOLDERS, OUTLETS } = require('../../data/stock/news');
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

// The featured company each day is the maker of the current Random Challenge of
// the Day's pod. Each racer carries a hardcoded `stock` symbol (see racer.js);
// we read the LATEST cotd challenge — a reroll posts a newer cotd, so "latest"
// automatically tracks rerolls — and resolve its racer -> stock symbol. Returns
// null when there's no cotd, the racer has no company (the secret pods), or the
// symbol isn't a live company, so featureDailyPod can fall back to a random pick.
function dailyPodSymbol(companies) {
    const challenges = db && db.ch && db.ch.challenges;
    if (!challenges) return null;
    const latest = Object.values(challenges)
        .filter(c => c && c.type === 'cotd')
        .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))[0];
    const sym = latest && racers[latest.racer] && racers[latest.racer].stock;
    return sym && companies[sym] ? sym : null;
}

// 12am: reset the day — clear yesterday's exposure/news flags and give every
// company a light trend random-walk so the board isn't static between news.
// The featured pod is deliberately NOT chosen here: at 00:00:00 the day's new
// cotd doesn't exist yet (the minuteUpdater posts it up to a minute later), so
// selecting now would feature YESTERDAY's pod. Selection waits for the 6am tick.
function postDaily(companies, meta) {
    const symbols = Object.keys(companies);
    if (!symbols.length) return;
    symbols.forEach(s => { companies[s].exposed = false; companies[s].newsToday = false; companies[s].boostArmed = false; });
    meta.appearanceSymbol = null;
    meta.todayAppearance = null;
    meta.todayNews = null;
    symbols.forEach(s => {
        if (Math.random() < config.trendDriftChance) companies[s].trend = shiftTrend(companies[s].trend);
    });
}

// 6am: feature the day's Challenge-of-the-Day pod maker (random fallback) — the
// cotd was posted just after midnight, so it exists by now. Exposure = volatility
// boost for the rest of today's ticks (6am/12pm/6pm). Trend is NOT rerolled
// (that is the noon news' job).
function featureDailyPod(companies, meta) {
    const symbols = Object.keys(companies);
    if (!symbols.length) return;
    const sym = dailyPodSymbol(companies) || symbols[randInt(symbols.length)];
    const c = companies[sym];
    c.exposed = true;
    c.boostTicks = config.appearanceBoostTicks;
    meta.appearanceSymbol = sym;
    meta.todayAppearance = `${c.symbol} — ${c.name}`;
}

// The {shareholder} fill pool, drawn from real players: current stockholders and
// recent trugut-drop recipients. Falls back to the in-universe SHAREHOLDERS list
// when there aren't any (e.g. a fresh market).
function shareholderPool() {
    const users = (db && db.user) || {};
    const idToName = {};
    const pool = new Set();
    for (const key of Object.keys(users)) {
        const u = users[key];
        if (!u) continue;
        const prof = u.random || {};
        const name = prof.name;
        if (u.discordID != null && name) idToName[String(u.discordID)] = name;
        const port = prof.portfolio;
        if (name && port && Object.values(port).some(p => (Number(p.shares) || 0) > 0)) pool.add(name);
    }
    const drops = (db && db.ch && db.ch.drops) || {};
    Object.values(drops)
        .filter(d => d && d.member != null && typeof d.drop === 'number' && d.drop > 0)
        .sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0))
        .slice(0, 30)
        .forEach(d => { const n = idToName[String(d.member)]; if (n) pool.add(n); });
    const list = [...pool];
    return list.length ? list : SHAREHOLDERS;
}

// Replace every occurrence of `token`, each with a fresh pick (distinct while the
// pool is large enough) — so "{shareholder} and {shareholder}" reads as two people.
function fillToken(text, token, pool) {
    const used = [];
    while (text.includes(token)) {
        let choices = pool.filter(x => !used.includes(x));
        if (!choices.length) choices = pool;
        const pick = choices[randInt(choices.length)];
        used.push(pick);
        // Function replacement — player names are user-controlled and a plain
        // string would have $&, $', $` etc. interpreted as replacement patterns.
        text = text.replace(token, () => pick);
    }
    return text;
}

// Racers eligible for {pilot}/{racer}: real pods mapped to a tradeable company
// (secret pods with no company are excluded).
function racerPool() {
    return racers.filter(r => r && r.name && r.stock && COMPANIES.some(c => c.symbol === r.stock));
}

// Replace {company}/{pilot}/{racer}/{track}/{planet}/{quarter}/{dip}/{shareholder}
// tokens. {pilot} and {racer} both name a racer pulled from racer.js and map the
// headline to that racer's company. When a headline has BOTH a racer token and
// {company}, they resolve from the SAME racer so the named pilot and company always
// match — and that company's stock is the one affected. Returns { text, stock } with
// stock as an array of symbols (empty => broad-market), or null when the headline
// can't be filled from the current market (see {dip}).
//
// {dip} prints a real number off the last completed tick, so it must land on a
// company that actually fell — it requires {company} in the same headline and picks
// only from losers. Nothing fell => null, and postNews draws a different headline.
function fillTemplate(entry, companies) {
    let text = entry.text;
    let stock = entry.stock == null ? [] : (Array.isArray(entry.stock) ? entry.stock.slice() : [entry.stock]);

    const hasRacer = text.includes("{pilot}") || text.includes("{racer}");
    const hasCompany = text.includes("{company}");
    const hasDip = text.includes("{dip}");
    const lastChange = sym => Number((companies[sym] || {}).lastChange) || 0;

    if (hasRacer) {
        const pool = racerPool();
        const r = pool[randInt(pool.length)];
        if (r) {
            if (hasCompany) {
                const co = COMPANIES.find(c => c.symbol === r.stock);
                if (co) text = text.replaceAll("{company}", co.name);
            }
            text = text.replaceAll("{pilot}", r.name).replaceAll("{racer}", r.name);
            if (!stock.length && r.stock) stock = [r.stock];
        }
    } else if (hasCompany) {
        const pool = hasDip ? COMPANIES.filter(c => lastChange(c.symbol) < 0) : COMPANIES;
        if (!pool.length) return null;
        const c = pool[randInt(pool.length)];
        text = text.replaceAll("{company}", c.name);
        if (!stock.length) stock = [c.symbol];
        if (hasDip) text = text.replaceAll("{dip}", `${(Math.abs(lastChange(c.symbol)) * 100).toFixed(2)}%`);
    }

    if (text.includes("{track}")) text = fillToken(text, "{track}", (tracks || []).map(t => t && t.name).filter(Boolean));
    if (text.includes("{planet}")) text = fillToken(text, "{planet}", (planets || []).map(p => p && p.name).filter(Boolean));
    if (text.includes("{quarter}")) text = fillToken(text, "{quarter}", ["1", "2", "3", "4"]);
    if (text.includes("{shareholder}")) text = fillToken(text, "{shareholder}", shareholderPool());
    if (text.includes("{dip}")) return null; // {dip} without a {company} to hang it on
    return { text, stock };
}

// 12pm: pick a headline + a random publication, resolve its stock/impact,
// stage the effect for 6pm. A headline the current market can't fill (see
// fillTemplate) is redrawn rather than printed with a hole in it; on the (vanishing)
// chance every draw fails, the day simply runs without news.
function postNews(companies, meta) {
    let entry = null;
    let filled = null;
    for (let i = 0; i < 10 && !filled; i++) {
        entry = NEWS[randInt(NEWS.length)];
        filled = fillTemplate(entry, companies);
    }
    if (!filled) return;
    const outlet = OUTLETS[randInt(OUTLETS.length)];
    const text = `**${outlet}:** ${filled.text}`;
    meta.pendingNews = { text, impact: entry.impact, stock: filled.stock };
    meta.todayNews = text;
}

// 6pm: news moves trend. A named stock shifts toward the headline's impact
// (|impact| 1-2 nudges a step at a time; |impact| 3 jumps to the strong extreme).
// A stockless headline flips 3 random stocks currently trending against the impact.
function applyNews(companies, meta) {
    const n = meta.pendingNews;
    meta.pendingNews = null;
    if (!n) return;
    // Legacy shape: pendingNews staged by an older build carries {sentiment, level}
    // instead of impact — map it so a headline published pre-deploy still lands.
    const impact = Number(n.impact ?? (n.sentiment === 'boom' ? n.level : n.sentiment === 'crisis' ? -n.level : 0)) || 0;
    const dir = Math.sign(impact);
    if (dir === 0) return; // neutral news: flavor only

    const symbols = Array.isArray(n.stock) ? n.stock : (n.stock ? [n.stock] : []);
    if (symbols.length) {
        symbols.forEach(sym => {
            const c = companies[sym];
            if (!c) return;
            c.trend = Math.abs(impact) >= 3
                ? (dir > 0 ? "strong_bullish" : "strong_bearish")
                : shiftTrendBy(c.trend, impact);
            c.newsToday = true;
            c.newsEventTick = true;
        });
    } else {
        const oppositeSign = -dir; // positive => flip currently-bearish; negative => flip currently-bullish
        const picks = shuffle(Object.values(companies).filter(c => trendSign(c.trend) === oppositeSign)).slice(0, 3);
        picks.forEach(c => { c.trend = mirrorTrend(c.trend); c.newsToday = true; c.newsEventTick = true; });
    }
}

// ---- tick ---------------------------------------------------------------

const STATIC_COMPANY = Object.fromEntries(COMPANIES.map(c => [c.symbol, c]));

// Fill any fields a company is missing (schema migration for markets seeded by
// an earlier build, so old data ticks forward cleanly instead of NaN-ing), and
// re-sync the static brand facts (name, baseVolatility) from companies.js so a
// rebalance or rename reaches markets seeded before it. Runtime state (price,
// trend, history, volumes) is never touched.
function normalizeCompany(c) {
    const def = STATIC_COMPANY[c.symbol];
    if (def) {
        c.name = def.name;
        c.baseVolatility = def.baseVolatility;
    }
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
    if (slot.role === 'news') postNews(companies, meta);
    if (slot.label === '6am') featureDailyPod(companies, meta);
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
            // Guard against a startup race: right after boot the in-memory cache may
            // simply not be hydrated yet. Confirm against the DB with an authoritative
            // read before seeding, so a cron tick that fires before the listener
            // populates db.stock can never clobber an existing market.
            const snap = await database.ref('stock/companies').once('value');
            if (snap.exists() && Object.keys(snap.val() || {}).length) {
                console.log('[cron:stockTick] cache not hydrated yet; market exists, skipping seed');
                return;
            }
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
