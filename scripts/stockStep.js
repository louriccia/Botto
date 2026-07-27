// Manually advance the Wald Street Exchange simulation — a testing tool.
//
// The live cron only ticks on the 12a/6a/12p/6p ET boundaries; this steps the
// market on demand against the live Realtime Database so you can watch prices,
// news, and charts move without waiting 6 hours.
//
// Usage:
//   node scripts/stockStep.js         # advance 1 tick
//   node scripts/stockStep.js 4       # advance 4 ticks (a full trading day)
//
// Notes:
// - Seeds a fresh market first if stock/ is empty.
// - Re-stamps history 6h apart ending "now" each run, so the chart's date axis
//   always shows a clean, evenly-spaced window.
// - Bumps meta.lastAbs to the current slot so the automatic cron won't
//   immediately re-tick on top of your manual steps.
//
// Requires the same env the bot uses (FIREBASE_*), loaded from .env.

require('dotenv').config({ path: __dirname + '/../.env' });
const moment = require('moment');
require('moment-timezone');

const { database, db } = require('../src/firebase');
const { seed, runTick, currentSlot } = require('../src/cron/jobs/stockTick');
const { TICKS } = require('../src/data/stock/config');

const easternTime = () => moment().tz('America/New_York');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIX_H = 6 * 60 * 60 * 1000;

const STEPS = Math.max(1, parseInt(process.argv[2], 10) || 1);

async function main() {
    // Give the firebase listener a moment to hydrate db.stock from the live DB.
    await sleep(6000);
    const now = easternTime();

    let companies = db.stock && db.stock.companies;
    let meta = db.stock && db.stock.meta;

    if (!companies || !Object.keys(companies).length) {
        const seeded = seed(now);
        companies = seeded.companies;
        meta = seeded.meta;
        console.log('[step] stock/ was empty — seeded a fresh market.');
    }
    meta = meta || { day: 1, tickIndex: 0, appearanceSymbol: null, pendingNews: null };

    for (let i = 0; i < STEPS; i++) {
        const nextSlot = ((Number(meta.tickIndex) || 0) + 1) % TICKS.length;
        runTick(companies, meta, nextSlot, now);
    }

    // Even, chronological timestamps so the chart date axis stays tidy.
    const end = Date.now();
    for (const sym of Object.keys(companies)) {
        const h = companies[sym].history;
        if (!Array.isArray(h) || !h.length) continue;
        const n = h.length;
        h.forEach((p, idx) => { p.t = end - (n - 1 - idx) * SIX_H; });
    }

    // Keep the automatic cron from immediately re-ticking on top of manual steps.
    meta.lastAbs = currentSlot(now).absSlot;

    await database.ref('stock/companies').set(companies);
    await database.ref('stock/meta').set(meta);

    const slot = TICKS[meta.tickIndex] || {};
    console.log(`[step] advanced ${STEPS} tick(s) -> day ${meta.day}, slot ${slot.label} (${slot.role})`);
    console.log(`[step] exposure: ${meta.appearanceSymbol || '—'} | news: ${meta.todayNews || '—'}`);
    const sample = ['BALT', 'KURT', 'ELCO', 'VLP', 'PZER'];
    for (const s of sample) {
        const c = companies[s];
        if (!c) continue;
        const chg = (Number(c.lastChange) || 0) * 100;
        console.log(`  ${s.padEnd(5)} ${Number(c.price).toFixed(2).padStart(9)}  ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%  (${c.trend})`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error('[step] failed:', err); process.exit(1); });
