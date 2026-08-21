// Proves the cold streak counts what it says it counts, and that the thing it counts is a fair coin.
//
// The figure is *openings lost in a row* — runs that died on the rung they opened on. It exists because
// that rung is the one place in the mode where a loss is nobody's fault, and the whole claim rests on
// two facts that are worth measuring rather than asserting:
//
//   1. **The opening rung is one plain cube and does not touch the bag.** `drawCubes` at level 0 returns
//      `[plainSlot()]` whatever is equipped, so the opening call is a 50/50 at every prestige with every
//      cube owned. If a rack could bend it, a cold streak would be a diagnosis rather than bad luck — and
//      the note on `dayLean` in `tuning.js` is the record of what a bent coin does to this ladder.
//   2. **Only that rung moves the counter.** A bust at Level 5 says nothing about the coin, and a run
//      that survived its opening resets it however it ended later.
//
// Then the counter itself, against a recomputed answer over a long random sequence: `cold` is the length
// of the current run of lost openings, `coldest` is the longest such run ever seen, and `records.cold`
// fires exactly on the rolls that moved the record.
//
//   node scripts/cubeCold.js [runs]
//
// Read-only. It touches no database and stakes nothing.

const crypto = require('crypto');
const engine = require('../src/game/cube/engine.js');
const pstate = require('../src/game/cube/state.js');
const { SPECIALS } = require('../src/game/cube/tuning.js');

const RUNS = Number(process.argv[2]) || 200000;

const fail = [];
const ok = (name, cond, detail = '') => { if (!cond) fail.push(`${name}${detail ? `\n    ${detail}` : ''}`); };
const near = function (name, got, want, tol) {
    if (Math.abs(got - want) > tol) {
        fail.push(`${name}\n    got ${got.toFixed(4)}, want ${want.toFixed(4)} ±${tol}`);
    }
};

// ---------------------------------------------------------------------------
// 1 — the opening rung is a coin, and nothing in the rack reaches it
// ---------------------------------------------------------------------------

const openingWin = function (equipped) {
    const bag = engine.fillBag(equipped);
    const drawn = engine.drawCubes([], bag, 0);
    ok('the opening rung is one cube', drawn.set.length === 1, `got ${drawn.set.length}`);
    ok('the opening cube is a plain one', !drawn.set[0].id, `got ${drawn.set[0].id}`);
    ok('the opening rung spends nothing out of the bag', drawn.bag.length === bag.length);
    const call = crypto.randomInt(0, 2) ? 'blue' : 'red';
    const res = engine.resolveLine(engine.throwSet(drawn.set), call, drawn.bag, { rungs: 1 });
    return res.majority === call;
};

console.log('  the opening call · one plain cube, whatever is in the rack');
const RACKS = [
    ['nothing equipped', []],
    ['a full bag', SPECIALS.filter(sp => !sp.noWeld).slice(0, engine.bagSize()).map(sp => sp.id)],
    ['the die and the payers', ['octahedron', 'greed', 'multiplier', 'boost', 'turbine']],
];
for (const [name, equipped] of RACKS) {
    let won = 0;
    for (let i = 0; i < RUNS; i++) if (openingWin(equipped)) won += 1;
    const rate = won / RUNS;
    console.log(`    ${name.padEnd(22)}  ${rate.toFixed(4)}`);
    // **Four sigma, derived rather than typed.** A fixed tolerance is either flaky at a low count or
    // useless at a high one — 0.005 fails about one row in a thousand at 20k and would miss a real lean
    // at 20M. `dayLean`, the bias this is standing guard against, was 0.52: caught here at any count
    // above about 2,500.
    near(`${name}: the opening call is a fair coin`, rate, 0.5, 2 / Math.sqrt(RUNS));
}
console.log('');

// ---------------------------------------------------------------------------
// 2 — the counter, against a recomputed answer
// ---------------------------------------------------------------------------

const s = pstate.cubeState({ cube: {}, effects: {} });
// What the counter should hold, kept alongside it off the same sequence of rolls.
let cold = 0;
let coldest = 0;
let records = 0;
let expectedRecords = 0;
let opens = 0;
let deep = 0;

for (let i = 0; i < RUNS; i++) {
    // A run: the opening rung, then a random number of rungs above it that resolve however they like.
    // The rolls that are not the opening must leave both counters exactly as they found them.
    const openWon = !!crypto.randomInt(0, 2);
    const patch = {};
    const got = pstate.recordRoll(s, patch, {
        call: 'blue', won: openWon, cubes: ['blue'], level: 0, standing: 0, opening: true,
    });
    opens += 1;
    cold = openWon ? 0 : cold + 1;
    if (!openWon && cold > coldest) { coldest = cold; expectedRecords += 1; }
    if (got.cold) records += 1;
    ok('cold tracks the run of lost openings', s.cold === cold, `${s.cold} != ${cold} at run ${i}`);
    ok('coldest is the longest run of them', s.coldest === coldest, `${s.coldest} != ${coldest} at run ${i}`);
    ok('the counter is written to the patch', patch.cold === cold);

    if (!openWon) continue;
    for (let rung = 0; rung < crypto.randomInt(1, 6); rung++) {
        const was = { cold: s.cold, coldest: s.coldest };
        const p2 = {};
        const r2 = pstate.recordRoll(s, p2, {
            call: 'blue', won: !!crypto.randomInt(0, 2), cubes: ['blue'], level: rung, standing: 0,
        });
        deep += 1;
        ok('a rung above the opening leaves cold alone', s.cold === was.cold && s.coldest === was.coldest);
        ok('a rung above the opening claims no cold record', !r2.cold);
        ok('a rung above the opening writes no cold counter',
            p2.cold === undefined && p2.coldest === undefined);
    }
}

console.log('  the counter · over a random sequence of runs');
console.log(`    openings              ${opens}`);
console.log(`    rungs above them      ${deep}`);
console.log(`    coldest run seen      ${coldest} openings`);
console.log(`    records claimed       ${records}`);
ok('a record is claimed exactly when one is set', records === expectedRecords,
    `${records} != ${expectedRecords}`);

// A fresh profile carrying a live streak longer than its own record cannot exist — `cubeState` floors
// `coldest` at `cold`, which is what stops a hand-edited profile reading back as impossible.
const edited = pstate.cubeState({ cube: { cold: 9, coldest: 2 }, effects: {} });
ok('a stored record below the live streak is floored to it', edited.coldest === 9, `got ${edited.coldest}`);
const fresh = pstate.cubeState({ cube: {}, effects: {} });
ok('a profile written before this existed reads as zero',
    fresh.cold === 0 && fresh.coldest === 0);

console.log('');
if (fail.length) {
    console.log(`  ${fail.length} check(s) failed:\n`);
    fail.forEach(f => console.log(`  ${f}\n`));
    process.exit(1);
}
console.log('  The opening is a coin, and only the opening is counted.');
