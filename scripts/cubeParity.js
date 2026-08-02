// Proves the extracted engine (`src/game/cube/engine.js`) resolves a line identically to the
// original that shipped inside `src/interactions/cube/functions.js`.
//
// This is the gate on the whole Activity port. The engine decides how many truguts change hands,
// so a divergence here is not a rendering bug, it is a currency bug — and it would be invisible
// until somebody's balance was wrong.
//
// **How it stays honest.** Both engines draw from `crypto.randomInt`, which this script replaces
// with a seeded PRNG before either module is loaded. Each roll is run twice from the *same* seed,
// once through each engine, and the two results compared. That means the engines must consume the
// same number of random values in the same order as well as reach the same answer — a real
// equivalence rather than a matching summary.
//
// The old engine reports faces as Discord emoji and the new one as abstract ids, so the new
// output is mapped through `data/discord/cube_emoji.js` before comparing. That checks the id
// scheme and the glyph table at the same time: if `mult:blue` ever stopped meaning PraiseMaja,
// this would catch it.
//
//   node scripts/cubeParity.js [rolls]

const assert = require('assert');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Seeded randomness, installed before the engines load
// ---------------------------------------------------------------------------

let state = 1;
const seed = function (n) { state = n >>> 0 || 1; };
// mulberry32. Not cryptographic and doesn't need to be — it stands in for the CSPRNG only so the
// same sequence can be replayed through two engines.
const next = function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
crypto.randomInt = (min, max) => (max === undefined
    ? Math.floor(next() * min)
    : min + Math.floor(next() * (max - min)));

const orig = require('../src/interactions/cube/functions.js');
const engine = require('../src/game/cube/engine.js');
const { faceGlyph } = require('../src/data/discord/cube_emoji.js');
const { SPECIALS } = require('../src/game/cube/tuning.js');

const ROLLS = Number(process.argv[2]) || 50000;
const ALL = SPECIALS.map(s => s.id);

// ---------------------------------------------------------------------------
// One climb, played identically by whichever engine it is handed
// ---------------------------------------------------------------------------

// Runs a full 1→5 climb and returns everything the two engines must agree on. `topLevel` varies so
// short lines and long ones are both exercised; `rack` varies so the empty-rack path (no specials
// at all) is covered as well as the full one.
const climb = function (e, rack, topLevel, call) {
    const bag = e.fillBag(rack);
    let set = [];
    const out = [];
    for (let lv = 0; lv <= topLevel; lv++) {
        const drawn = e.drawCubes(set, bag, lv);
        set = drawn.set;
        const line = e.throwSet(set);
        const rolled = e.rolledFaces(line);
        const res = e.resolveLine(line, call);
        out.push({ rolled, res });
        set = res.set;
        if (res.ended) break;
    }
    return out;
};

// The new engine's ids, drawn as the old engine's glyphs.
const asGlyphs = ids => ids.map(faceGlyph);

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

const failures = [];
const record = function (roll, field, got, want) {
    if (failures.length < 8) {
        failures.push(`roll ${roll} · ${field}\n    new: ${JSON.stringify(got)}\n    old: ${JSON.stringify(want)}`);
    }
};

const same = function (roll, field, got, want) {
    try {
        assert.deepStrictEqual(got, want);
        return true;
    } catch (err) {
        record(roll, field, got, want);
        return false;
    }
};

let compared = 0;
let mismatched = 0;
const stats = { ended: 0, broken: 0, grew: 0, steps: 0, pays: 0, ties: 0, pures: 0, longest: 0 };

for (let i = 0; i < ROLLS; i++) {
    // Rack size cycles 0..10 so every path gets exercised, including no specials at all.
    const rackSize = i % (ALL.length + 1);
    const rack = ALL.slice(0, rackSize);
    const top = i % 5;
    const call = i % 2 ? 'red' : 'blue';

    seed(i + 1);
    const a = climb(orig, rack, top, call);
    seed(i + 1);
    const b = climb(engine, rack, top, call);

    let bad = false;
    if (!same(i, 'level count', b.length, a.length)) { bad = true; }

    for (let lv = 0; lv < Math.min(a.length, b.length); lv++) {
        const A = a[lv].res;
        const B = b[lv].res;
        const w = f => `L${lv} ${f}`;

        // The line as thrown, before anything resolved.
        if (!same(i, w('rolled'), asGlyphs(b[lv].rolled), a[lv].rolled)) bad = true;
        // The line as resolved — the one that gets paid on.
        if (!same(i, w('faces'), asGlyphs(B.faceIds), A.faces)) bad = true;

        for (const f of ['cubes', 'set', 'majority', 'pure', 'swept', 'mult', 'mults',
            'shortcut', 'rerolls', 'broken', 'ended', 'specials', 'faceLog']) {
            if (!same(i, w(f), B[f], A[f])) bad = true;
        }

        // Every effect frame: same count, same line, same pointer.
        if (!same(i, w('steps.length'), B.steps.length, A.steps.length)) bad = true;
        for (let s = 0; s < Math.min(A.steps.length, B.steps.length); s++) {
            if (!same(i, w(`steps[${s}].faces`), asGlyphs(B.steps[s].faceIds), A.steps[s].faces)) bad = true;
            if (!same(i, w(`steps[${s}].at`), B.steps[s].at, A.steps[s].at)) bad = true;
        }

        // The multiplier walk. `label` is deliberately not compared — it was Discord markdown and
        // is now structured data; the note renderer is what checks that, not this.
        if (!same(i, w('pays.length'), B.pays.length, A.pays.length)) bad = true;
        for (let p = 0; p < Math.min(A.pays.length, B.pays.length); p++) {
            for (const f of ['kind', 'side', 'at']) {
                if (!same(i, w(`pays[${p}].${f}`), B.pays[p][f], A.pays[p][f])) bad = true;
            }
        }

        // A note per event, in the same order, even though their contents differ in shape.
        if (!same(i, w('notes.length'), B.notes.length, A.notes.length)) bad = true;

        // The multiplier walk replayed, which is where `multSteps` is exercised at all.
        const msA = orig.multSteps(2, A.pays, A.majority);
        const msB = engine.multSteps(2, B.pays, B.majority);
        if (!same(i, w('multSteps.length'), msB.length, msA.length)) bad = true;
        for (let m = 0; m < Math.min(msA.length, msB.length); m++) {
            if (!same(i, w(`multSteps[${m}].multiple`), msB[m].multiple, msA[m].multiple)) bad = true;
            if (!same(i, w(`multSteps[${m}].paid`), msB[m].paid, msA[m].paid)) bad = true;
        }

        // Invariants worth asserting on their own, because they are the contracts the port most
        // easily breaks and they hold regardless of what the old engine did.
        if (B.cubes.length > B.faceIds.length) record(i, w('invariant'), 'cubes longer than faceIds', '');
        if (B.set.length > B.faceIds.length) record(i, w('invariant'), 'set longer than faceIds', '');
        if (B.faceIds.some(x => !x)) record(i, w('invariant'), 'empty face id in line', '');
        // The run ends if and only if Ratts is visible on the resolved line.
        const rattsShowing = B.faceIds.includes('end');
        if (rattsShowing !== !!B.ended) record(i, w('invariant'), `ratts shown ${rattsShowing} but ended ${B.ended}`, '');

        stats.steps += B.steps.length;
        stats.pays += B.pays.length;
        if (B.ended) stats.ended++;
        if (B.broken.length) stats.broken++;
        if (B.majority === null) stats.ties++;
        if (B.pure) stats.pures++;
        stats.longest = Math.max(stats.longest, B.faceIds.length);
        compared++;
    }
    if (bad) mismatched++;
}

console.log(`Compared ${compared} resolved lines across ${ROLLS} climbs.`);
console.log(`  ended ${stats.ended} · shattered ${stats.broken} · ties ${stats.ties} · pures ${stats.pures}`);
console.log(`  effect steps ${stats.steps} · paying faces ${stats.pays} · longest line ${stats.longest}`);

if (failures.length) {
    console.log(`\n${mismatched} climb(s) diverged. First ${failures.length}:\n`);
    failures.forEach(f => console.log(`  ${f}\n`));
    process.exit(1);
}
console.log('\nThe extracted engine matches the original exactly.');
