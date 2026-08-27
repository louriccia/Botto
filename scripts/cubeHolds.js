// **Capture**, proved: what happens to a cube that another cube is holding.
//
// Three faces take a cube off the line without destroying it — `haul` on the Scavenger and `jail` on
// the Planet Octahedron take them, `scavenge` puts one back — and a captured cube is the one thing
// in the mode that is neither standing nor gone. That is exactly the state a cube can be lost in.
// A captor overwritten by a reflection, a hold that doesn't survive the trip to Firebase, a prisoner
// freed to the left of a strictly left-to-right walk: none of those throw. They quietly shrink the
// run, and nothing on screen says a cube the player owns stopped existing.
//
// So the four rules in the tuning's Capture section are checked by construction rather than by
// sampling:
//
//   1. a captor can be captured, to any depth
//   2. a copy of a captor copies the hold, and the two holds are independent
//   3. destroying a captor frees its prisoners at once, beside the cube taking the turn
//   4. a jailer hands one back at the start of every turn it takes, whatever it is showing
//
// Part one builds lines by hand and asserts what came out. Part two throws climbs and asserts what
// must hold on every roll — including **conservation**: on a rack that can only capture and release,
// no cube may appear or vanish, and the count of them is the same at the end of the roll as it was
// at the start.
//
//   node scripts/cubeHolds.js [climbs]

const assert = require('assert');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Seeded randomness, installed before the engine loads
// ---------------------------------------------------------------------------

let state = 1;
const seed = function (n) { state = n >>> 0 || 1; };
// mulberry32, as `cubeParity.js` uses it: not cryptographic and doesn't need to be — it stands in
// for the CSPRNG only so a roll can be replayed.
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

const engine = require('../src/game/cube/engine.js');
const { SPECIALS, cube: config } = require('../src/game/cube/tuning.js');

const CLIMBS = Number(process.argv[2]) || 20000;

const failures = [];
const check = function (label, fn) {
    try {
        fn();
    } catch (err) {
        failures.push(`${label}\n    ${err.message.split('\n').join('\n    ')}`);
    }
};

// ---------------------------------------------------------------------------
// Building a line by hand
// ---------------------------------------------------------------------------

const CRAWLER = 'scavenger';
const DIE = 'octahedron';

const specialOf = id => SPECIALS.find(s => s.id === id);
const faceOf = (id, kind) => specialOf(id).faces.find(f => f.kind === kind);

// One position, as `throwSet` would have built it: a cube, the face it landed on, and the slot it
// carries. `side` is only read for plain cubes and the two faces that are sides, so a fixed blue
// keeps the counting out of the way of what is being measured.
const at = function (id, kind, held = []) {
    const slot = { ...engine.plainSlot(), id: id || null, held: held.map(engine.slotOf) };
    return {
        side: 'blue',
        special: id ? specialOf(id) : null,
        face: kind ? faceOf(id, kind) : null,
        slot,
    };
};
const plain = () => at(null, null);

// Every cube a set is carrying, holds included, at any depth — the number conservation is written
// against.
const total = set => set.reduce((n, s) => n + 1 + engine.countHeld(s.held), 0);
const holdsOf = set => set.reduce((n, s) => n + engine.countHeld(s.held), 0);

// ---------------------------------------------------------------------------
// Part one: the four rules, one line each
// ---------------------------------------------------------------------------

seed(4242);

// A captured cube is off the line and inside its captor — not destroyed, not counted, not drawn.
check('a haul takes the cube on its right into the hold', () => {
    const res = engine.resolveLine([at(CRAWLER, 'haul'), plain()], 'blue', [], {});
    assert.strictEqual(res.faceIds.length, 1, 'the line is one position shorter');
    assert.strictEqual(res.cubes.length, 0, 'a held cube counts toward neither side');
    assert.strictEqual(res.set.length, 1, 'and it is not standing on the table');
    assert.strictEqual(res.held, 1, 'it is in the hold');
    assert.strictEqual(res.hold.length, 0, 'and not in the wreckage — it was never destroyed');
});

// The one that saves runs. A mine in a hold is a mine off the table.
check('a hauled mine cannot go off', () => {
    const res = engine.resolveLine([at(CRAWLER, 'haul'), at('wild', 'end')], 'blue', [], {});
    assert.strictEqual(res.ended, null, 'the run survives');
    assert.ok(!res.faceIds.includes('end'), 'and he is not on the line to say otherwise');
    assert.deepStrictEqual(res.set[0].held.map(s => s.id), ['wild']);
});

// Rule 1. A hold holds whole cubes, holds and all.
check('rule 1 · a captor can be captured, holding what it held', () => {
    // A crawler holding a Greed, hauled off the line by a second crawler: the hold goes in with it.
    const res = engine.resolveLine([
        at(CRAWLER, 'haul'),
        at(CRAWLER, null, [{ id: 'greed' }]),
    ], 'blue', [], {});
    const [outer] = res.set;
    assert.strictEqual(outer.held.length, 1, 'one cube in the crawler');
    assert.strictEqual(outer.held[0].id, CRAWLER, 'and it is a crawler');
    assert.deepStrictEqual(outer.held[0].held.map(s => s.id), ['greed'], 'still holding its own');
    assert.strictEqual(res.held, 2, 'two cubes off the table and both still in the run');
});

// And it nests as deep as it is asked to, through storage as well as through the roll.
check('rule 1 · nesting has no floor', () => {
    let held = [{ id: 'greed' }];
    for (let d = 0; d < 6; d++) held = [{ id: CRAWLER, held }];
    const res = engine.resolveLine([at(CRAWLER, 'haul'), at(CRAWLER, null, held)], 'blue', [], {});
    assert.strictEqual(res.held, 8, 'eight cubes inside');
    const round = engine.decodeSet(JSON.parse(JSON.stringify(engine.encodeSet(res.set))));
    assert.deepStrictEqual(round, res.set, 'and the whole nest survives storage');
});

// Rule 2. A clone of a captor comes with the prisoners — as a copy of them, so the two cubes are
// two cubes.
check('rule 2 · a clone copies the hold, independently', () => {
    const res = engine.resolveLine([
        at(CRAWLER, null, [{ id: 'greed' }]),
        at('binder', 'clone'),
        plain(),
    ], 'blue', [], {});
    const crawlers = res.set.filter(s => s.id === CRAWLER);
    assert.strictEqual(crawlers.length, 2, 'two crawlers on the table');
    crawlers.forEach(c => assert.deepStrictEqual(c.held.map(s => s.id), ['greed']));
    assert.notStrictEqual(crawlers[0].held, crawlers[1].held, 'and not one hold twice');
    assert.notStrictEqual(crawlers[0].held[0], crawlers[1].held[0], 'nor one prisoner twice');
});

// The same rule through the glass, which is where it matters most: a reflected Oovo IV is a second
// cell rather than a second door onto the first.
check('rule 2 · a reflection copies the hold', () => {
    const res = engine.resolveLine([
        at(DIE, null, [{ id: 'gungan' }, { id: 'boost' }]),
        at('mirror', 'mirror'),
        plain(),
    ], 'blue', [], {});
    const dice = res.set.filter(s => s.id === DIE);
    assert.strictEqual(dice.length, 2, 'the reflection is a real cube, cell and all');
    dice.forEach(d => assert.strictEqual(engine.countHeld(d.held), 2));
    assert.strictEqual(res.held, 4, 'four cubes held where there were two');
});

// Rule 3, and the reason it is worded the way it is. Ben razes the crawler standing on his left, so
// the prisoners come back on **his** right — past his own right wing — rather than at the dead
// crawler's position, which the walk has already gone past.
check('rule 3 · freed cubes come back beside the cube taking the turn', () => {
    const res = engine.resolveLine([
        at(CRAWLER, null, [{ id: 'gungan' }, { id: 'boost' }]),
        at('symbiont', 'raze'),
        plain(),
    ], 'blue', [], {});
    assert.deepStrictEqual(res.faceIds.slice(0, 3), ['razed:left', 'raze', 'razed:right'],
        'Ben still reads as one wide picture');
    const ids = res.set.map(s => s.id);
    assert.ok(ids.includes('gungan') && ids.includes('boost'), 'both prisoners are on the table');
    assert.ok(!ids.includes(CRAWLER), 'and the crawler is not');
    assert.strictEqual(res.held, 0, 'nobody is left inside');
    // Where they landed is the whole point: after Ben, not back at position 0.
    assert.ok(res.faceIds.length > 3, 'they came back to the right of him');
});

// The same rule with the actor in the hole: a captor that destroys itself spills where it stood.
check('rule 3 · a wipeout spills its own hold', () => {
    const res = engine.resolveLine([
        plain(),
        at(CRAWLER, 'broken', [{ id: 'gungan' }, { id: 'boost' }]),
        plain(),
    ], 'blue', [], {});
    assert.deepStrictEqual(res.broken, [CRAWLER]);
    const ids = res.set.map(s => s.id);
    assert.ok(ids.includes('gungan') && ids.includes('boost'), 'both walked');
    assert.strictEqual(res.held, 0);
});

// A freed cube is a real cube: thrown, live, and it takes its turn. Checked through the prisoner
// *acting*, which is the part that is easy to lose.
check('rule 3 · a freed cube takes its turn', () => {
    seed(11);
    let acted = 0;
    for (let i = 0; i < 200; i++) {
        // The Binder at the head has nothing on its left, so it destroys the crawler on its right;
        // the Symbiont that walks out then acts on the line it landed on.
        const res = engine.resolveLine([
            at('binder', 'clone'),
            at(CRAWLER, null, [{ id: 'symbiont' }]),
            plain(),
        ], 'blue', [], {});
        if (res.notes.some(n => n.specialId === 'symbiont')) acted++;
    }
    assert.ok(acted > 150, `the freed Symbiont acted on ${acted}/200 rolls`);
});

// Rule 4. One back at the start of every turn the die takes, in the order they went in, whatever it
// is showing — and the roll that paroles can still arrest, because the parole comes first.
check('rule 4 · a jailer paroles one per turn, in order', () => {
    // Three prisoners that cannot destroy anything on their way out, which is a shorter list than it
    // looks: a released cube is thrown live and takes its own turn, and **at `blastReach 2` a wipeout
    // is no longer a cube that takes only itself** — it takes the die standing beside it, which is a
    // different rule being tested by accident. So no mine and no wipeout: the shield, the Boost and
    // the Multiplier roll nothing that reaches a neighbour, and they stay three distinct ids so the
    // order below is still worth asserting.
    let cell = engine.slotOf({ id: DIE, held: [{ id: 'gungan' }, { id: 'boost' }, { id: 'multiplier' }] });
    const out = [];
    for (let turn = 0; turn < 3; turn++) {
        // `seam` pays and touches nothing, so what the line does is the parole and only the parole.
        // Read off the **cell** rather than off the line: what a released cube then does with its own
        // turn — a mine going off, a wipeout shattering it — is not what this is measuring.
        const line = [{ ...at(DIE, 'seam'), slot: cell }];
        const inside = cell.held.map(s => s.id);
        const res = engine.resolveLine(line, 'blue', [], {});
        const after = res.set.find(s => s.id === DIE);
        assert.ok(after, `the die is still standing on turn ${turn}`);
        assert.deepStrictEqual(after.held.map(s => s.id), inside.slice(1),
            `turn ${turn} handed back exactly the first one`);
        out.push(inside[0]);
        cell = after;
    }
    assert.deepStrictEqual(out, ['gungan', 'boost', 'multiplier'], 'first in, first out');
    assert.strictEqual(engine.countHeld(cell.held), 0, 'and the cell is empty');
});

// The parole is a turn the cube takes, not a face it rolls — so it happens on a rung the die spends
// doing something else entirely.
check('rule 4 · parole happens whatever the die is showing', () => {
    seed(77);
    const kinds = new Set();
    for (let i = 0; i < 400; i++) {
        const line = [
            { ...at(DIE, null, [{ id: 'greed' }]) },
            plain(),
            plain(),
        ];
        // Give it a random face off its own die, as a throw would.
        const faces = specialOf(DIE).faces;
        line[0].face = faces[crypto.randomInt(0, faces.length)];
        line[0].side = null;
        const res = engine.resolveLine(line, 'blue', [], {});
        const paroled = res.notes.some(n => n.kind === 'parole');
        kinds.add(line[0].face.kind);
        assert.ok(paroled, `no parole on a ${line[0].face.kind} turn`);
    }
    assert.ok(kinds.size >= 6, `only ${kinds.size} of the die's faces were exercised`);
});

// A cell is the die's, not the run's, so it fills to `jailSize` and stops.
check('a cell takes up to jailSize and no more', () => {
    seed(99);
    for (let i = 0; i < 200; i++) {
        const line = [at(DIE, 'jail'), ...Array.from({ length: 8 }, plain)];
        const res = engine.resolveLine(line, 'blue', [], {});
        const cell = res.set.find(s => s.id === DIE);
        assert.strictEqual(cell.held.length, config.jailSize);
        assert.strictEqual(res.faceIds.length, 9 - config.jailSize);
    }
});

// The Scavenger's two halves are a loop on one cube: what it hauled is what it fetches back first.
check('scavenge takes its own hold before the wreckage', () => {
    const res = engine.resolveLine([
        at(CRAWLER, 'scavenge', [{ id: 'greed' }]),
        plain(),
    ], 'blue', [], { hold: [engine.slotOf('wild')] });
    const ids = res.set.map(s => s.id);
    assert.ok(ids.includes('greed'), 'its own prisoner came back');
    assert.strictEqual(res.hold.length, 1, 'and the wreckage was not touched');
});

check('scavenge reaches into the wreckage when its own hold is empty', () => {
    const res = engine.resolveLine([
        at(CRAWLER, 'scavenge'),
        plain(),
    ], 'blue', [], { hold: [engine.slotOf('wild')] });
    assert.ok(res.set.map(s => s.id).includes('wild'), 'the wreck came back');
    assert.strictEqual(res.hold.length, 0, 'out of the junkyard');
});

// The other half of the wreckage rule: a captured cube is not wreckage and must never be swept into
// it, or the same cube is in two places and can be scavenged out while it is still a prisoner.
check('a captured cube is never swept into the wreckage', () => {
    const res = engine.resolveLine([at(CRAWLER, 'haul'), at('greed', 'greed')], 'blue', [], {});
    assert.strictEqual(res.hold.length, 0, 'the junkyard stays empty');
    assert.deepStrictEqual(res.set[0].held.map(s => s.id), ['greed']);
});

// ---------------------------------------------------------------------------
// Part two: invariants over climbs
// ---------------------------------------------------------------------------

// A rack that can only capture and release. The Scavenger's wipeout is the one thing on it that
// destroys, and it destroys exactly the cube it shattered — so the arithmetic closes and any cube
// that goes missing is a bug rather than a face doing its job.
const HOLDERS = [CRAWLER, DIE];
const ALL = SPECIALS.map(s => s.id);

const climb = function (rack, conserve) {
    const bag = engine.fillBag(rack);
    let set = [];
    for (let lv = 0; lv <= engine.MAX_LEVEL; lv++) {
        const drawn = engine.drawCubes(set, bag, lv);
        const before = total(drawn.set);
        const line = engine.throwSet(drawn.set);
        const res = engine.resolveLine(line, 'blue', drawn.bag, { hold: [], rungs: lv + 1 });

        // Every position draws as exactly one face, always — the rule the whole face scheme rests on
        // and the one a new state is most likely to break by leaving a position with no id.
        assert.ok(res.faceIds.every(id => typeof id === 'string' && id),
            `empty face id in ${JSON.stringify(res.faceIds)}`);
        // A held cube is not on the line, so it counts toward nothing and cannot be swept. Whether a
        // mine that is *standing* takes the run with it is the mine's own rule and belongs to
        // `cubeOctahedron.js`; the capture half of it — a mine in a hold never goes off — is asserted
        // on a built line above, where it can be stated exactly.
        // Nothing that isn't a cube ends up in a hold, at any depth.
        const walk = function (slots) {
            for (const s of slots) {
                assert.ok(s.id === null || SPECIALS.some(sp => sp.id === s.id), `bad id: ${s.id}`);
                assert.ok(Array.isArray(s.held), 'a slot with no hold');
                walk(s.held);
            }
        };
        walk(res.set);
        // The reported count is the count in the set. A client draws the first and the run carries
        // the second, and the day they disagree is the day cubes go missing on screen only.
        assert.strictEqual(res.held, holdsOf(res.set), 'the reported hold is not what is held');
        // The set crosses Firebase, and a hold that doesn't survive the trip is a cube the player
        // owned yesterday and doesn't own today.
        assert.deepStrictEqual(
            engine.decodeSet(JSON.parse(JSON.stringify(engine.encodeSet(res.set)))),
            res.set, 'the set did not survive encode/decode',
        );
        if (conserve) {
            // **Conservation.** Nothing on this rack creates a cube and nothing takes one out of the
            // run: everything that came in is standing, held by something standing, or wreckage in
            // the junkyard. A shattered cube is in the third pile, not gone — which is exactly what
            // makes the arithmetic close, and what a lost hold would break.
            // The junkyard is counted the same way the table is — a wrecked captor with anyone still
            // inside it would otherwise hide behind a length.
            const after = total(res.set) + total(res.hold);
            assert.strictEqual(after, before,
                `cubes appeared or vanished: ${before} in, ${after} out`);
        }

        set = res.set;
        if (res.ended || !res.faceIds.length) break;
    }
};

seed(20260827);
let climbs = 0;
try {
    for (let i = 0; i < CLIMBS; i++) {
        // Half the climbs on the holders-only rack, where conservation is exact; half on the full
        // rack, where every other face in the game is in play alongside the holds.
        const conserve = i % 2 === 0;
        climb(conserve ? HOLDERS : ALL.slice(0, 1 + (i % ALL.length)), conserve);
        climbs++;
    }
} catch (err) {
    failures.push(`climb ${climbs}\n    ${err.message}`);
}

// A harness that never filled a hold proves nothing, so say whether it did.
seed(5);
let deepest = 0;
let filled = 0;
let rolls = 0;
for (let i = 0; i < 3000; i++) {
    const bag = engine.fillBag(HOLDERS);
    let set = [];
    for (let lv = 0; lv <= engine.MAX_LEVEL; lv++) {
        const drawn = engine.drawCubes(set, bag, lv);
        const res = engine.resolveLine(engine.throwSet(drawn.set), 'blue', drawn.bag, { hold: [] });
        rolls++;
        set = res.set;
        deepest = Math.max(deepest, res.held);
        if (res.held) filled++;
        if (res.ended || !res.faceIds.length) break;
    }
}

console.log(`Checked ${climbs} climbs · ${failures.length ? 'FAILURES' : 'all invariants held'}`);
console.log(`  rolls ending with something held: ${filled}/${rolls}`
    + ` · most held at once: ${deepest}`);

if (failures.length) {
    console.log(`\n${failures.length} check(s) failed:\n`);
    failures.forEach(f => console.log(`  ${f}\n`));
    process.exit(1);
}
console.log('\nHolds: nothing lost, nothing conjured, nobody left in the cell.');
