// The Turbine, the Scavenger and the Guide, measured and asserted.
//
// Same job `cubeOctahedron.js` does for the die, and for the same reason: the frozen reference engine
// `cubeParity.js` proves against predates all three, so a climb fielding one is not a divergence in
// the ported rules. This is where they earn their place instead.
//
//   1. **Invariants.** The claims each cube's design rests on. The Turbine's distribution is derived
//      rather than measured and so is asserted exactly; the Scavenger's hold has to conserve cubes;
//      the Guide has to pay what a player would count off the line.
//   2. **Plumbing.** The hold is round-tripped through `encodeSet`/`decodeSet`, because that is the
//      shape a stored ladder is written in and where a mismatch actually bites.
//   3. **EV.** Reported, not asserted. Wild measures ~1.30 and the die 0.69; read these against those.
//
//   node scripts/cubeThree.js [climbs]

const assert = require('assert');
const crypto = require('crypto');

const engine = require('../src/game/cube/engine.js');
const actions = require('../src/game/cube/actions.js');
const pstate = require('../src/game/cube/state.js');
const persist = require('../src/game/cube/persist.js');
const { SPECIALS, POINTS, cube: config } = require('../src/game/cube/tuning.js');

const ME = '1';

const CLIMBS = Number(process.argv[2]) || 40000;
const byId = id => SPECIALS.find(s => s.id === id);
const turbine = byId('turbine');
const scavenger = byId('scavenger');
const guide = byId('guide');

const fail = [];
const check = function (name, got, want) {
    try {
        assert.deepStrictEqual(got, want);
    } catch (e) {
        fail.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
    }
};
const ok = (name, cond, detail = '') => { if (!cond) fail.push(`${name}${detail ? `\n    ${detail}` : ''}`); };
const near = function (name, got, want, tol) {
    if (Math.abs(got - want) > tol) fail.push(`${name}\n    got:  ${got}\n    want: ${want} ±${tol}`);
};

// ---------------------------------------------------------------------------
// Phase one: the data
// ---------------------------------------------------------------------------

check('turbine faces', turbine.faces.length, 6);
check('turbine heat faces', turbine.faces.filter(f => f.kind === 'heat').length, 5);
check('turbine wipeouts', turbine.faces.filter(f => f.kind === 'broken').length, 1);
ok('turbine carries no mine', !turbine.faces.some(f => f.kind === 'end'),
    'its whole price is that it destroys itself');

check('scavenger faces', scavenger.faces.length, 6);
check('scavenge faces', scavenger.faces.filter(f => f.kind === 'scavenge').length, 3);
check('haul faces', scavenger.faces.filter(f => f.kind === 'haul').length, 2);
check('scavenger wipeouts', scavenger.faces.filter(f => f.kind === 'broken').length, 1);

check('guide faces', guide.faces.length, 6);
check('guide pay faces', guide.faces.filter(f => f.kind === 'guide').length, 5);
check('guide mines', guide.faces.filter(f => f.kind === 'end').length, 1);

for (const sp of [turbine, scavenger, guide]) {
    ok(`${sp.id}: every face scores`, sp.faces.every(f => POINTS[f.kind] != null),
        `unscored: ${sp.faces.filter(f => POINTS[f.kind] == null).map(f => f.id).join(', ')}`);
    ok(`${sp.id}: no face carries a side`, !sp.faces.some(f => f.side),
        'a face is a side or it does a thing, never both');
}

ok('guideBonus is half pureBonus', config.guideBonus * 2 === config.pureBonus,
    `guide ${config.guideBonus} against pure ${config.pureBonus}`);

// ---------------------------------------------------------------------------
// Phase two: the slot round-trips
// ---------------------------------------------------------------------------

check('a clean slot still encodes as a bare id',
    engine.encodeSet([{ id: 'wild', burned: [], frozen: null, heat: 0, hauled: false }]), ['wild']);
check('a plain clean slot still encodes as 0', engine.encodeSet([engine.plainSlot()]), [0]);
check('heat encodes as an object',
    engine.encodeSet([{ id: 'turbine', burned: [], frozen: null, heat: 3, hauled: false }]),
    [{ id: 'turbine', heat: 3 }]);
check('hauled encodes as an object',
    engine.encodeSet([{ id: 'wild', burned: [], frozen: null, heat: 0, hauled: true }]),
    [{ id: 'wild', hauled: true }]);
check('heat round-trips', engine.decodeSet(engine.encodeSet([
    { id: 'turbine', burned: [], frozen: null, heat: 4, hauled: false },
]))[0].heat, 4);
check('hauled round-trips', engine.decodeSet(engine.encodeSet([
    { id: 'wild', burned: [], frozen: null, heat: 0, hauled: true },
]))[0].hauled, true);
check('a set written before either existed reads back clean',
    engine.decodeSet(['wild', 0])[0], {
        id: 'wild', burned: [], frozen: null, heat: 0, hauled: false,
    });

// ---------------------------------------------------------------------------
// Phase three: the Turbine burns its own list
// ---------------------------------------------------------------------------

for (let n = 0; n <= 5; n++) {
    const left = engine.rollFaces(turbine, { heat: n });
    check(`heat ${n}: faces left`, left.length, 6 - n);
    check(`heat ${n}: heat faces left`, left.filter(f => f.kind === 'heat').length, 5 - n);
    check(`heat ${n}: the wipeout never leaves`, left.filter(f => f.kind === 'broken').length, 1);
}
ok('a scorch is not a heat',
    engine.rollFaces(byId('wild'), { heat: 3 }).length === 6,
    'rollFaces must only ever spend heat faces');

// The derivation the design rests on: heats leave, the wipeout does not, so a Turbine is a uniform
// shuffle of six faces read until the wipeout — and the number of heats before it is uniform on 0..5.
const heats = new Array(6).fill(0);
let paidTotal = 0;
for (let r = 0; r < CLIMBS; r++) {
    let slot = { id: 'turbine', burned: [], frozen: null, heat: 0, hauled: false };
    let n = 0;
    let paid = 0;
    for (;;) {
        const line = engine.throwSet([slot]);
        const face = line[0].face;
        if (!face || face.kind === 'broken') break;
        paid += config.heatBonus * (slot.heat + 1);
        n += 1;
        slot = { ...slot, heat: slot.heat + 1 };
    }
    heats[n] += 1;
    paidTotal += paid;
}
for (let n = 0; n <= 5; n++) {
    near(`P(exactly ${n} heats) is 1/6`, heats[n] / CLIMBS, 1 / 6, 0.012);
}
check('a turbine can never land a sixth heat', heats.length, 6);
near('E[total paid] is 2.92', paidTotal / CLIMBS, 2.9166, 0.05);

// ---------------------------------------------------------------------------
// Phase four: the Guide counts what a player would
// ---------------------------------------------------------------------------

// Faces are forced rather than rolled: the payout is a pure function of the resolved line, so the
// only honest test of it is a line built by hand.
const faceOf = (sp, kind) => sp.faces.find(f => f.kind === kind);
const plainOf = side => ({
    side, special: null, face: null, slot: engine.plainSlot(),
});
const specialOf = function (id, kind) {
    const sp = byId(id);
    return {
        side: null,
        special: sp,
        face: faceOf(sp, kind),
        slot: { id, burned: [], frozen: null, heat: 0, hauled: false },
    };
};
const guideOn = function (spec, call) {
    const line = spec.map(x => (x === 'g' ? specialOf('guide', 'guide')
        : x === 'e' ? specialOf('greed', 'greed')
            : plainOf(x)));
    return engine.resolveLine(line, call, []);
};

check('a guide inside four of your own pays 2.0',
    guideOn(['red', 'red', 'g', 'red', 'red'], 'red').mult, 2 + config.greedBonus * 0);
check('a guide at the tail sees one way',
    guideOn(['red', 'red', 'red', 'red', 'g'], 'red').mult, 2);
check('a guide alone in traffic pays nothing',
    guideOn(['blue', 'g', 'blue'], 'red').mult, 0);
check('an opposing cube stops the count',
    guideOn(['red', 'g', 'blue', 'red', 'red', 'red'], 'red').mult, 0.5);
check('an effect face stops the count too',
    guideOn(['red', 'g', 'e', 'red', 'red'], 'red').mult, 0.5 + config.greedBonus);
check('two guides block each other',
    guideOn(['red', 'g', 'g', 'red'], 'red').mult, 1);

const swept = guideOn(['red', 'g', 'red'], 'red');
ok('a guide on the line disqualifies the pure', !swept.pure,
    'the guide is not a side, so the line is not every-position-a-cube');

// ---------------------------------------------------------------------------
// Phase five: the Scavenger conserves cubes
// ---------------------------------------------------------------------------

const scav = (spec, call, opts) => engine.resolveLine(
    spec.map(x => (typeof x === 'string' && x !== 'red' && x !== 'blue'
        ? specialOf(...x.split('.'))
        : plainOf(x))),
    call,
    [],
    opts,
);

const hauled = scav(['red', 'scavenger.haul', 'blue', 'red'], 'red');
check('a haul takes the cube on its right off the line', hauled.faceIds.length, 3);
check('a haul puts it in the hold', hauled.hold.length, 1);
check('a hauled cube is flagged as held', hauled.hold.filter(h => h.hauled).length, 1);

const nothing = scav(['red', 'red', 'scavenger.haul'], 'red');
check('a haul at the tail takes nothing', nothing.faceIds.length, 3);
ok('and says so', nothing.notes.some(n => n.kind === 'haul.nothing'));

const back = scav(['red', 'scavenger.scavenge', 'red'], 'red', {
    hold: [{ id: 'wild', burned: [], frozen: null, heat: 0, hauled: false }],
});
check('a scavenge puts the cube back on the line', back.faceIds.length, 4);
check('and empties the hold by one', back.hold.length, 0);
check('and reports what it recovered', back.recovered, ['wild']);

const empty = scav(['red', 'scavenger.scavenge', 'red'], 'red');
check('an empty hold is a quiet frame', empty.faceIds.length, 3);
ok('and says so', empty.notes.some(n => n.kind === 'scavenge.empty'));

// The rescue: hauled cubes walk the moment no Scavenger is standing, and wreckage does not.
const springs = scav(['red', 'scavenger.haul', 'blue', 'red'], 'red');
ok('a haul with the scavenger still standing holds', !springs.sprung.length,
    'the sandcrawler is on the line, so nothing walks');

const gone = scav(['red', 'scavenger.haul', 'blue', 'symbiont.raze'], 'red', {});
ok('a scavenger razed off the line springs its hold',
    !gone.set.some(s => s.id === 'scavenger') ? gone.sprung.length > 0 : true,
    `sprung ${gone.sprung.length} with set ${JSON.stringify(gone.set.map(s => s.id))}`);

const wreck = scav(['red', 'symbiont.cull', 'blue', 'red'], 'red');
ok('wreckage lands in the hold', wreck.hold.length > 0, JSON.stringify(wreck.hold));
ok('and none of it is flagged as held', !wreck.hold.some(h => h.hauled),
    'nothing is holding scrap, so nothing can break it out');
ok('so wreckage alone never springs', !wreck.sprung.length,
    'a hold that spilled its scrap would fire on every climb in the game');

// Conservation, over real climbs: a cube in the hold is a cube that is not on the table, and it is
// never both and never neither.
let holdMax = 0;
let leaks = 0;
for (let r = 0; r < Math.min(CLIMBS, 20000); r++) {
    let set = [
        { id: 'scavenger', burned: [], frozen: null, heat: 0, hauled: false },
        engine.plainSlot(), engine.plainSlot(), engine.plainSlot(), engine.plainSlot(),
    ];
    let hold = [];
    for (let rung = 0; rung < 6 && (set.length || hold.length); rung++) {
        const res = engine.resolveLine(engine.throwSet(set), 'blue', [], { hold });
        hold = engine.decodeSet(engine.encodeSet(res.hold));
        set = [...res.set, ...(res.sprung || [])];
        if (hold.some(h => h.id === undefined)) leaks += 1;
        holdMax = Math.max(holdMax, hold.length);
    }
}
check('nothing in the hold is malformed', leaks, 0);
ok('the hold actually fills', holdMax > 0, `deepest hold seen: ${holdMax}`);

// ---------------------------------------------------------------------------
// Phase six: EV, reported and never asserted
// ---------------------------------------------------------------------------

// The same world and the same bench `cubeOctahedron.js` uses, and for the reason its note gives:
// **a bare ladder does not measure 1.000**, because `pureBonus` rides on top of a fair ladder. There
// is no absolute to compare against, so the only honest normalisation is other cubes measured in the
// same process, on the same road, under the same call policy.
const RACK = ['turbine', 'scavenger', 'guide', 'wild', 'greed', 'binder'];
const drawCall = () => (crypto.randomInt(0, 2) ? 'red' : 'blue');

const makeWorld = function () {
    const profile = {
        name: 'Circuit',
        truguts_earned: 1_000_000_000,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 4, unlocked: 4, clears: 0, stake: 1000,
            cubes: Object.fromEntries(RACK.map(id => [id, true])),
            equipped: RACK, buyReroll: true, bribe: true, nudge: true,
        },
    };
    const db = { user: { K: { random: profile, discordID: ME } }, ch: { cube: { ladders: {} } } };
    const ref = p => ({
        child: c => ref(`${p}/${c}`),
        update: (v) => { Object.assign(profile.cube, v); return Promise.resolve(); },
        set: (v) => {
            const m = p.match(/ladders\/(.+)$/);
            if (m) db.ch.cube.ladders[m[1]] = v;
            return Promise.resolve();
        },
        remove: () => {
            const m = p.match(/ladders\/(.+)$/);
            if (m) delete db.ch.cube.ladders[m[1]];
            return Promise.resolve();
        },
    });
    const database = { ref };
    const moveTruguts = ({ transaction, amount }) => {
        const n = Math.floor(Number(amount) || 0);
        if (transaction === 'w') profile.truguts_spent += n;
        if (transaction === 'd') profile.truguts_earned += n;
    };
    return {
        db,
        database,
        ctxOf: () => ({
            db, database, profile, profileRef: database.ref('users/K/random'),
            discordId: ME, s: pstate.cubeState(profile), moveTruguts,
        }),
    };
};

const evOf = async function (rack, runs) {
    const world = makeWorld();
    const ctx0 = world.ctxOf();
    ctx0.profile.cube.cubes = Object.fromEntries(rack.map(id => [id, true]));
    ctx0.profile.cube.equipped = rack;
    let staked = 0;
    let returned = 0;
    for (let t = 0; t < runs; t++) {
        persist.clearLadder(world.database, world.db, ME);
        const started = actions.startRun(world.ctxOf(), { call: drawCall() });
        if (!started.ok) break;
        staked += started.staked;
        let run = started.run;
        for (let lv = 0; lv < 24; lv++) {
            const ctx = world.ctxOf();
            const thrown = actions.throwLevel(ctx, run);
            // Never buy a tie: a bribe is a purchase, and its price has no business in a figure that
            // is meant to be about the cubes.
            if (thrown.asking) {
                actions.parkTie(world.ctxOf(), thrown);
                const answered = actions.answerTie(world.ctxOf(), { buying: false });
                if (!answered.ok) break;
                const done = await actions.settleThrow(world.ctxOf(), {
                    thrown: answered.thrown, reverse: answered.reverse,
                });
                if (done.outcome !== 'live') break;
                run = { ...run };
            }
            const settled = thrown.asking ? null : await actions.settleThrow(ctx, { thrown });
            if (settled && settled.outcome !== 'live') break;
            const live = persist.ladderOf(world.db, ME);
            if (!live) break;
            if (live.level >= pstate.MAX_LEVEL && !live.locked) {
                const banked = actions.bank(world.ctxOf());
                if (banked.ok) returned += banked.standing;
                break;
            }
            let want = drawCall();
            if (live.sealed && want === live.sealed) want = live.sealed === 'red' ? 'blue' : 'red';
            const pushed = actions.pushRun(world.ctxOf(), { call: want });
            if (!pushed.ok) break;
            run = pushed.run;
        }
    }
    return staked ? returned / staked : 0;
};

const EV_RUNS = Math.max(2000, Math.floor(CLIMBS / 10));
const BENCH = [
    ['bare ladder', []],
    ['Wild', ['wild']],
    ['Greed', ['greed']],
    ['Mirror', ['mirror']],
    ['Turbine', ['turbine']],
    ['Scavenger', ['scavenger']],
    ['Guide', ['guide']],
    ['all three', ['turbine', 'scavenger', 'guide']],
    ['all three in a rack', RACK],
];

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

(async () => {
const bench = [];
for (const [label, rack] of BENCH) bench.push([label, await evOf(rack, EV_RUNS)]);
const base = bench[0][1] || 1;

console.log('');
console.log(`Turbine — heats before the wipeout, over ${CLIMBS.toLocaleString()} cubes`);
for (let n = 0; n <= 5; n++) {
    const pct = (100 * heats[n] / CLIMBS).toFixed(2);
    console.log(`  ${n} heat${n === 1 ? ' ' : 's'}  ${pct.padStart(6)}%   run total +${(0.25 * n * (n + 1)).toFixed(2)}`);
}
console.log(`  E[total] ${(paidTotal / CLIMBS).toFixed(3)} against a derived 2.917`);
console.log('');
console.log(`Scavenger — deepest hold over ${Math.min(CLIMBS, 20000).toLocaleString()} climbs: ${holdMax}`);
console.log('');
console.log(`EV · a climb banked at the top, ${EV_RUNS.toLocaleString()} runs a rack`);
console.log('  rack                    raw    vs bare');
for (const [label, v] of bench) {
    console.log(`  ${label.padEnd(20)}  ${v.toFixed(3)}   ${(v / base).toFixed(3)}`);
}
console.log('');

if (fail.length) {
    console.error(`${fail.length} failed:\n`);
    for (const f of fail) console.error(`  ✗ ${f}\n`);
    process.exit(1);
}
console.log('all checks passed');
})();
