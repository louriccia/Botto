// Measures the three dials that decide whether the mode is a sink or a faucet: `dayLean`, `nudgeLean`
// and `weldPurity`.
//
// It exists because all three were shipped on reasoning rather than measurement, and all three were
// wrong in the same direction. The mode paid one holder 20T → 800T in an afternoon at ~1% of purse a
// roll, and no single dial was the cause — it was `dayLean` amplified by majority-of-N, a weld that had
// dropped both its parents' mines, and a tie pick that reversed the house edge instead of softening it.
//
// **The thing to understand before touching any of them.** A level's winner is the majority of an odd
// number of cubes, and majority-of-N *amplifies* a per-cube bias with depth. So a 55/45 cube is not a
// 55/45 game: it is 55/45 at Level 1 and 62/38 at Level 5, against a ladder that doubles at every rung.
// That is what section one prints, and it is why trimming a dial by 10% does not trim the exploit by
// 10%.
//
// Every figure is at the **collapsed road** — five level rungs with no Agains standing between them,
// which is what a maxed player's road looks like and where the leak is worst. Growth is quoted at
// **1.07% of purse a roll**, which is `maxStake` at prestige 33 against an 800T purse: a player that
// deep is not choosing a stake fraction, they are pinned at the ceiling.
//
//   node scripts/cubeLean.js [climbs]
//
// Read-only. It touches no database and stakes nothing.

const engine = require('../src/game/cube/engine.js');
const { SPECIALS, LEVELS, cube: config } = require('../src/game/cube/tuning.js');

const CLIMBS = Number(process.argv[2]) || 40000;
const CUBES = LEVELS.map(l => l.cubes);
const ALL = SPECIALS.map(s => s.id);
const OTHER = { red: 'blue', blue: 'red' };

// The side the cube is actually leaning on today. Read rather than forced, so this measures the game
// as it will be played — an informed player is one who has worked out this value, which takes about
// thirty-six nine-cube throws to do to 95% confidence.
const LEANED = engine.dailyLean().side;

// **The stake fraction a deep player is pinned to.** `maxStakeFor` is `maxStake × maxStakeStep^prestige`
// with no cap, so it grows forever — but a printing purse outgrows it, and the fraction shrinks. At
// prestige 33 against 800T it is 1.07%, which is where the measured growth below is quoted.
const FRACTION = 0.0107;

// ---------------------------------------------------------------------------
// One climb
// ---------------------------------------------------------------------------

// Walks the collapsed road and returns the standing after every rung it survived, so one sample scores
// every bank-at-level-k policy at once. A rack does not get credit for punishing a player who overstays.
const climb = function (rack, call, nudge) {
    let bag = engine.fillBag(rack);
    let set = [];
    let mult = 1;
    let sealed = null;
    const standing = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
        // Aquilaris seals the side just called, so the call has to respect it. Switching costs nothing
        // in EV — it is the one refusal in the mode that is a rule rather than a bug.
        let want = call;
        if (sealed && want === sealed) want = OTHER[want];
        sealed = null;

        const drawn = engine.drawCubes(set, bag, lv);
        set = drawn.set;
        bag = drawn.bag;
        const res = engine.resolveLine(engine.throwSet(set), want, bag);
        bag = res.bag;
        set = res.set;
        sealed = res.sealed || null;

        // Tatooine wins a tie outright; otherwise Watto's cube settles it, leaning his way or the
        // player's depending on the Nudge. Bribes are left out — they are a spend, not a payout, and
        // this file is about what the cube pays.
        let maj = res.majority;
        if (!maj && res.faceIds.length) maj = res.boonta ? want : engine.rollTiebreak(want, nudge);
        mult = engine.applyMults(engine.rungMultiple('level', mult, res.mult), res.mults, maj);
        if (!(res.faceIds.length && maj && maj === want) || res.ended) break;
        standing[lv] = mult;
    }
    return standing;
};

// EV and log-growth for every stopping level, plus the standard error — printed because the EV rides on
// deep wins that land a few percent of the time, so a difference smaller than the error bar is not a
// difference. An earlier version of this measurement was under-sampled and reported a knob as doing
// three times what it does.
const measure = function (rack, nudge, climbs = CLIMBS) {
    const pay = LEVELS.map(() => []);
    for (let i = 0; i < climbs; i++) {
        const st = climb(rack, LEANED, nudge);
        LEVELS.forEach((_, lv) => pay[lv].push(st[lv] || 0));
    }
    const rows = pay.map((s) => {
        const ev = s.reduce((a, b) => a + b, 0) / s.length;
        const sq = s.reduce((a, b) => a + b * b, 0) / s.length;
        return {
            ev,
            se: Math.sqrt(Math.max(0, sq - ev * ev) / s.length),
            g: s.reduce((a, m) => a + Math.log(1 + FRACTION * (m - 1)), 0) / s.length,
        };
    });
    // Scored at the best stopping level, which is the policy an optimising player actually has.
    let best = 0;
    rows.forEach((r, i) => { if (r.g > rows[best].g) best = i; });
    return { best, ...rows[best], top: rows[rows.length - 1] };
};

const evening = g => (g > 0 ? `${Math.exp(g * 250).toFixed(2)}×` : 'bleeds');

// ---------------------------------------------------------------------------
// 1. The amplification — exact, and the reason the rest of the file exists
// ---------------------------------------------------------------------------

const choose = (n, k) => {
    if (k < 0 || k > n) return 0;
    let c = 1;
    for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
    return c;
};
const majority = function (n, p) {
    let w = 0;
    for (let k = Math.ceil((n + 1) / 2); k <= n; k++) w += choose(n, k) * (p ** k) * ((1 - p) ** (n - k));
    return w;
};

console.log(`${CLIMBS.toLocaleString()} climbs a row · collapsed road · today leans ${LEANED}`);
console.log(`stake ${(FRACTION * 100).toFixed(2)}% of purse (maxStake at prestige 33 against 800T)`);

console.log(`\n\nAMPLIFICATION — a ${Math.round(config.dayLean * 100)}/${Math.round((1 - config.dayLean) * 100)}`
    + ' cube seen as a per-rung win rate (exact)');
console.log('  level  cubes  per-cube  P(rung)  × levelStep   fair step');
CUBES.forEach((n, lv) => {
    const w = majority(n, config.dayLean);
    console.log(`  L${lv + 1}     ${String(n).padStart(2)}      ${config.dayLean.toFixed(3)}`
        + `    ${w.toFixed(4)}     ${(config.levelStep * w).toFixed(3)}`
        + `        ${(1 / w).toFixed(3)}`);
});
console.log('  Every rung above 1.000 is farmable on its own, and the deepest is the worst — which is');
console.log('  why no single `levelStep` prices both ends and why a rake cannot absorb this.');

// ---------------------------------------------------------------------------
// 2. Racks, informed against blind
// ---------------------------------------------------------------------------
//
// `informed` calls the leaned side every run. `blind` picks one colour and never adapts, so half its
// days are wrong — and it is **still** a faucet, because `E[∏P] > ∏P(E[p])` by convexity: the ladder
// pays exponentially in streak length, so any p ≠ 0.5 mints truguts in either direction.

const RACKS = [
    { rack: [], label: 'empty (0 seats)' },
    { rack: ['greed', 'wild'], label: 'greed + wild (2)' },
    { rack: ['wild', 'greed', 'shmi', 'anakin', 'sebulba', 'mirror', 'gungan', 'multiplier'], label: 'hand-picked eight' },
    { rack: ALL, label: 'every cube (bag caps at 8)' },
];

console.log('\n\nRACKS — best stopping level, at the shipped dials');
console.log('  rack                          nudge   bank    EV     an evening   top of road');
for (const { rack, label } of RACKS) {
    for (const nudge of [false, true]) {
        const m = measure(rack, nudge);
        console.log(`  ${label.padEnd(28)}  ${(nudge ? 'yes' : 'no ').padEnd(5)}  L${m.best + 1}`
            + `   ${m.ev.toFixed(3).padStart(6)}   ${evening(m.g).padStart(9)}`
            + `      ${m.top.ev.toFixed(3)}`);
    }
}

// **A hand-picked rack is above water with no lean at all.** That is a separate leak from anything this
// file tunes and it is not fixed by any of the three dials: the cubes were measured one at a time when
// they were built — Wild 1.30, Sebulba 1.20, Greed 0.60, each "fielded alone" — and never as a chosen
// eight together. Printed so nobody mistakes a tamed lean for a tamed mode.
console.log('\n  the same racks with the lean switched off entirely (dayLean 0.500)');
const shippedDay = config.dayLean;
config.dayLean = 0.5;
for (const { rack, label } of RACKS) {
    const m = measure(rack, true);
    console.log(`  ${label.padEnd(28)}  yes    L${m.best + 1}   ${m.ev.toFixed(3).padStart(6)}`
        + `   ${evening(m.g).padStart(9)}      ${m.top.ev.toFixed(3)}`);
}
config.dayLean = shippedDay;

// ---------------------------------------------------------------------------
// 3. dayLean
// ---------------------------------------------------------------------------

console.log('\n\ndayLean — a bare ladder, which is what the dial alone is worth');
console.log('  dayLean   reads as   informed EV   blind EV   informed evening');
for (const p of [0.55, 0.53, 0.52, 0.51, 0.50]) {
    config.dayLean = p;
    const inf = measure([], true);
    // Blind is the average of both directions: calling the leaned side and calling against it.
    const against = (() => {
        const saved = LEANED;
        // Calling against the lean is the same as leaning against the call, so flip the dial instead
        // of the call and reuse the same path.
        config.dayLean = 1 - p;
        const m = measure([], true);
        config.dayLean = p;
        void saved;
        return m;
    })();
    const blindEv = (inf.ev + against.ev) / 2;
    console.log(`  ${p.toFixed(3)}     ${Math.round(p * 100)}/${Math.round((1 - p) * 100)}`
        + `       ${inf.ev.toFixed(3).padStart(6)}       ${blindEv.toFixed(3).padStart(6)}`
        + `     ${evening(inf.g).padStart(9)}${p === shippedDay ? '   ← shipped' : ''}`);
}
config.dayLean = shippedDay;

// ---------------------------------------------------------------------------
// 4. nudgeLean, and the fork it leaves behind
// ---------------------------------------------------------------------------
//
// The fork is the tuning cost the pick imposes on every other dial in the file, because each one has to
// be read twice — once for the population holding the Nudge and once for the population without it.
//
// **It cannot be closed while the pick exists.** At `nudgeLean 0.500` the Nudge makes a tie *fair*,
// which is still a 10-point gain over losing 60% of them, so it is still worth double digits. The dial
// chooses the fork's width, not whether there is one.

const NUDGE_RACK = ['shmi', 'greed:015+wild:012', 'mirror', 'binder'];
// **This section needs five times the samples and it is not optional.** Every row differs from the next
// by a few points, where the sections above differ by whole multiples — and ties are only ~8% of rungs,
// so the signal is a small change to a small fraction. At the default count the error bar is ±4% on an
// ±8% effect and the fork comes out non-monotone, which reads as the dial doing something erratic
// instead of the measurement being too thin to see it. Watch the printed ±: a gap inside it is not a gap.
const NUDGE_CLIMBS = CLIMBS * 5;
console.log('\n\nnudgeLean — measured on a rack that ties often (shmi + a one-mine weld + mirror + binder)');
console.log(`  ${NUDGE_CLIMBS.toLocaleString()} climbs a row — five times the rest, because these rows`
    + ' sit a few points apart');
const shippedNudge = config.nudgeLean;
const base = measure(NUDGE_RACK, false, NUDGE_CLIMBS);
console.log(`  un-nudged baseline: EV ${base.ev.toFixed(3)} ±${base.se.toFixed(3)}`
    + `  (Watto's cube, tieLean ${config.tieLean})`);
console.log('  nudgeLean  reads as   nudged EV        fork      an evening');
for (const n of [0.60, 0.575, 0.55, 0.525, 0.50]) {
    config.nudgeLean = n;
    const on = measure(NUDGE_RACK, true, NUDGE_CLIMBS);
    const fork = ((on.ev / base.ev) - 1) * 100;
    const forkSe = 100 * (on.ev / base.ev)
        * Math.sqrt((on.se / on.ev) ** 2 + (base.se / base.ev) ** 2);
    console.log(`  ${n.toFixed(3)}      ${Math.round(n * 100)}/${Math.round((1 - n) * 100)}`
        + `      ${on.ev.toFixed(3).padStart(6)} ±${on.se.toFixed(3)}`
        + `   ${`${fork >= 0 ? '+' : ''}${fork.toFixed(1)}%`.padStart(6)} ±${forkSe.toFixed(1)}`
        + `   ${evening(on.g).padStart(9)}${n === shippedNudge ? '   ← shipped' : ''}`);
}
config.nudgeLean = shippedNudge;

// ---------------------------------------------------------------------------
// 5. weldPurity — the rate, and what the chase is worth as a sink
// ---------------------------------------------------------------------------
//
// `scripts/cubeWeld.js` owns the weld's invariants; this is only the half that belongs to the economy.
// The point of the dial is not its EV — by 1% the expected weld has bottomed out — it is that the chase
// is the first thing in the mode priced in multiples of a whale's purse.

const DOWN = new Set(['end', 'broken']);
const WELDS = [
    ['greed', 'wild'], ['wild', 'shortcut'], ['wild', 'gungan'], ['multiplier', 'boost'],
];
console.log('\n\nweldPurity — the jackpot rate, and the sink behind it');
console.log(`  weldPurity ${config.weldPurity} · weldRerollCost 📀${config.weldRerollCost.toLocaleString()}`
    + ` scaled by maxStakeStep^prestige`);
console.log('  pairing                measured   rerolls   at prestige 20      at prestige 33');
const TRIES = 100000;
for (const pair of WELDS) {
    let clean = 0;
    for (let i = 0; i < TRIES; i++) {
        const sp = engine.specialById(engine.rollWeld(pair, { tier: 1 }));
        if (sp && !sp.faces.some(f => DOWN.has(f.kind))) clean += 1;
    }
    const rate = clean / TRIES;
    const n = rate ? 1 / rate : 0;
    const at = pr => (rate ? n * config.weldRerollCost * (config.maxStakeStep ** pr) : 0);
    console.log(`  ${pair.join('+').padEnd(22)}   ${(rate * 100).toFixed(2).padStart(5)}%`
        + `   ${`${n.toFixed(0)}×`.padStart(6)}`
        + `   ${`📀${(at(20) / 1e9).toFixed(1)}B`.padStart(14)}`
        + `      ${`📀${(at(33) / 1e12).toFixed(0)}T`.padStart(9)}`);
}
console.log('\n  A pairing with no downside face on either parent — Mirror + Gungan Shield — is untouched:');
console.log('  there is nothing to inherit, so every weld of it is clean and always was.');
