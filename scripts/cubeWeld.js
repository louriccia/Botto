// The weld, measured and asserted.
//
// A weld is two cubes pressed into one seat carrying **three faces from each**, drawn at random —
// see `buildWeld` / `rollWeld` in the engine and `docs/the-weld.md`. Five things are checked here and
// only the first four can fail:
//
//   1. **Construction.** Ids are canonical, refusals refuse, and a weld's faces are its parents'.
//   2. **Rolling.** Splits turn up at the weighted rate, and the major share is rolled rather than
//      chosen. This is the only control on how often a 5+1 exists, so it is asserted rather than
//      assumed.
//   3. **The press memory.** A reroll cannot hand back the last `weldMemory` cuts. The outcome
//      spaces are tiny — a `gungan+wild` pairing has *two* distinct welds — so this is where the
//      rule either works or silently does nothing.
//   4. **The actions.** Ownership, both currencies, and every refusal, through `actions.js` and
//      Firebase-shaped storage.
//   5. **EV.** Reported, not asserted, and bracketed: a rack where every weld kept its downside
//      faces against one where every weld dropped them. A player lands between the two and moves up
//      it by rerolling, so the gap *is* what a reroll is worth.
//
//   node scripts/cubeWeld.js [climbs]

const assert = require('assert');
const crypto = require('crypto');

const tuning = require('../src/game/cube/tuning.js');
const engine = require('../src/game/cube/engine.js');
const actions = require('../src/game/cube/actions.js');
const pstate = require('../src/game/cube/state.js');
const persist = require('../src/game/cube/persist.js');

const { SPECIALS, cube: config } = tuning;
const CLIMBS = Number(process.argv[2]) || 20000;
const ME = 'weld-test';

const DOWN = new Set(['end', 'broken']);
const isDown = f => DOWN.has(f.kind);
const WELDABLE = SPECIALS.filter(sp => !sp.noWeld).map(sp => sp.id);

const fail = [];
const check = function (name, got, want) {
    try {
        assert.deepStrictEqual(got, want);
    } catch (e) {
        fail.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
    }
};
const ok = (name, cond, detail = '') => { if (!cond) fail.push(`${name}${detail ? `\n    ${detail}` : ''}`); };
const near = function (name, got, want, tol, detail = '') {
    if (Math.abs(got - want) > tol) {
        fail.push(`${name}\n    got ${got.toFixed(4)}, want ${want.toFixed(4)} ±${tol}${detail ? `\n    ${detail}` : ''}`);
    }
};

// ---------------------------------------------------------------------------
// Phase one: construction
// ---------------------------------------------------------------------------

{
    const w = engine.specialById('greed:012+wild:015');
    check('a weld is six faces', w.faces.length, 6);
    check('and they are its parents\'', w.faces.map(f => f.id),
        ['greed', 'greed', 'greed', 'wild', 'wild', 'end']);
    check('every face remembers its parent',
        [...new Set(w.faces.map(f => f.from))].sort(), ['greed', 'wild']);
    check('it knows what went into it', w.welded, ['greed', 'wild']);
    check('the id is canonical', w.id, 'greed:012+wild:015');

    // **The id names the cube, not the draw.** Wild's faces 0-4 are identical, so any three of them
    // are the same half and must collapse onto one spelling — otherwise "never hand back the same
    // weld" compares ids that differ while the cube does not.
    check('identical faces collapse', engine.weldId([{ id: 'wild', idx: [1, 2, 3] }]), 'wild:012');
    check('and so does the whole weld',
        engine.specialById('greed:234+wild:123').id, engine.specialById('greed:012+wild:012').id);
    check('parent order does not matter',
        engine.specialById('wild:012+greed:012').id, engine.specialById('greed:012+wild:012').id);

    check('the parents are readable', engine.weldParents('greed:012+wild:034'), ['greed', 'wild']);
    ok('and null for a plain cube', engine.weldParents('greed') === null);

    // Refusals. Each returns null, the answer an unknown id has always given — the set decoder
    // throws such a position as an ordinary cube rather than crashing.
    const refused = {
        'greed:012': 'one part is not a weld',
        'greed:012+greed:034': 'a cube cannot be welded to itself',
        'greed:012+nope:012': 'unknown parent',
        'greed:012+octahedron:012': 'the Planet Octahedron carries noWeld',
        'greed:067+wild:012': 'position 6 does not exist on a six-sider',
        'greed:abc+wild:012': 'positions must be digits',
        'greed:+wild:012': 'a parent must give up something',
        'greed:011+wild:012': 'a position cannot be given up twice',
    };
    for (const [id, why] of Object.entries(refused)) {
        ok(`refused: ${id}`, engine.specialById(id) === null, why);
    }

    check('an ordinary cube is untouched', engine.specialById('greed').faces.length, 6);
    check('the die is untouched', engine.specialById('octahedron').faces.length, 8);
    check('good faces are counted right',
        ['wild', 'multiplier', 'reroll', 'gungan'].map(id => engine.goodFaces(engine.specialById(id))),
        [5, 4, 3, 6]);

    // The outcome spaces the press memory has to survive.
    check('greed+wild has four distinct welds', engine.weldSpace(['greed', 'wild']), 4);
    check('gungan+wild has two', engine.weldSpace(['gungan', 'wild']), 2);
    check('gungan+reroll has six', engine.weldSpace(['gungan', 'reroll']), 6);

    // The state layer has to carry a weld through, or nothing below can be measured at all.
    const s = pstate.cubeState({
        effects: { chance_cube: true },
        cube: { cubes: { 'greed:012+wild:015': true, mirror: true }, equipped: ['greed:012+wild:015', 'mirror'] },
    });
    ok('a weld is owned', s.cubes.includes('greed:012+wild:015'));
    check('and reaches the bag', engine.fillBag(s.equipped).filter(Boolean).sort(),
        ['greed:012+wild:015', 'mirror']);
}

// ---------------------------------------------------------------------------
// Phase two: rolling
// ---------------------------------------------------------------------------

const ROLLS = Math.max(60000, CLIMBS * 3);
{
    const splits = {};
    let major = 0;
    let wrongParent = 0;
    for (let i = 0; i < ROLLS; i++) {
        const id = engine.rollWeld(['greed', 'wild'], { tier: 4 });
        const w = engine.specialById(id);
        ok('every roll builds', !!w);
        const n = {};
        for (const f of w.faces) n[f.from] = (n[f.from] || 0) + 1;
        const shape = Object.values(n).sort((a, b) => b - a).join('+');
        splits[shape] = (splits[shape] || 0) + 1;
        if (shape !== '3+3') {
            major += 1;
            if ((n.greed || 0) < (n.wild || 0)) wrongParent += 1;
        }
    }
    const cuts = config.weldSplits[2];
    const total = cuts.reduce((a, s) => a + s.weight, 0);
    for (const s of cuts) {
        const shape = [...s.take].sort((a, b) => b - a).join('+');
        near(`${shape} turns up at its weight`, (splits[shape] || 0) / ROLLS, s.weight / total, 0.01);
    }
    check('nothing else is ever produced', Object.keys(splits).sort(), ['3+3', '4+2', '5+1']);
    // **The major share is rolled, not chosen**, which is what halves how often a rare split lands
    // where the player wanted it. If this ever became a choice the 5+1 rate would double.
    near('the major share lands either way', wrongParent / Math.max(major, 1), 0.5, 0.03);
}

// ---------------------------------------------------------------------------
// Phase two and a half: the tiers
// ---------------------------------------------------------------------------
//
// **A rung the player has not bought is absent, not rare.** That is the difference between an upgrade
// that changes the table and one that nudges a number, and it is the only thing making the four-rung
// journey worth walking — so each rung is asserted to add exactly what it promises and nothing else.

{
    const shapesAt = function (ids, tier, n = 6000) {
        const seen = new Set();
        for (let i = 0; i < n; i++) {
            const id = engine.rollWeld(ids, { tier });
            if (!id) { seen.add('refused'); continue; }
            const w = engine.specialById(id);
            const c = {};
            for (const f of w.faces) c[f.from] = (c[f.from] || 0) + 1;
            seen.add(Object.values(c).sort((a, b) => b - a).join('+'));
        }
        return [...seen].sort();
    };

    check('tier 0 has no press at all', shapesAt(['greed', 'wild'], 0), ['refused']);
    check('tier 1 cuts evenly and nothing else', shapesAt(['greed', 'wild'], 1), ['3+3']);
    check('tier 2 adds the uneven cut', shapesAt(['greed', 'wild'], 2), ['3+3', '4+2']);
    check('tier 3 adds no new two-cube cut', shapesAt(['greed', 'wild'], 3), ['3+3', '4+2']);
    check('tier 4 adds the deep cut', shapesAt(['greed', 'wild'], 4), ['3+3', '4+2', '5+1']);

    check('a third cube is refused below its rung', shapesAt(['greed', 'wild', 'mirror'], 2), ['refused']);
    check('tier 3 takes three', shapesAt(['greed', 'wild', 'mirror'], 3), ['2+2+2', '3+2+1']);
    check('tier 4 deepens the three too',
        shapesAt(['greed', 'wild', 'mirror'], 4), ['2+2+2', '3+2+1', '4+1+1']);

    // A three-cube weld is still a six-sider, which is the whole reason it is 2+2+2 rather than
    // 3+3+3: one kind of cube on the table, however many went into it.
    const w = engine.specialById(engine.rollWeld(['greed', 'wild', 'mirror'], { tier: 3 }));
    check('and it is still six faces', w.faces.length, 6);
    check('from three parents', w.welded.length, 3);
}

// ---------------------------------------------------------------------------
// Phase three: the press memory
// ---------------------------------------------------------------------------
//
// The rule that matters and the one most easily written wrong. It applies to the **whole weld**: a
// per-half version cannot work, because the Gungan Shield has exactly one possible half and a
// `greed+wild` pairing has two per side — forcing both halves to change would leave a 2×2 pairing
// oscillating between two of its four welds forever, with the other two unreachable.

{
    for (const pair of [['greed', 'wild'], ['gungan', 'reroll'], ['gungan', 'wild'], ['boost', 'multiplier']]) {
        const space = engine.weldSpace(pair);
        const cap = Math.max(0, Math.min(config.weldMemory, space - 1));
        let held = [];
        let repeats = 0;
        const seenEver = new Set();
        for (let i = 0; i < 4000; i++) {
            const id = engine.rollWeld(pair, { seen: held, tier: 1 });
            if (held.includes(id)) repeats += 1;
            seenEver.add(id);
            held = [id, ...held.filter(x => x !== id)].slice(0, cap);
        }
        check(`${pair.join('+')} never repeats inside the memory`, repeats, 0);
        // And the whole space stays reachable — the failure the per-half rule would have caused.
        ok(`${pair.join('+')} reaches its whole space`, seenEver.size >= space,
            `saw ${seenEver.size} of ${space}`);
    }

    // A pairing with only one possible weld must not be excluded to nothing. Nothing on the rack
    // pairs to a space of one today, so this is asserted against the floor rather than a real pair.
    check('the memory floors below the space', Math.min(config.weldMemory, 1 - 1), 0);
}

// ---------------------------------------------------------------------------
// Phase four: tallies credit the parent
// ---------------------------------------------------------------------------

{
    const id = engine.rollWeld(['anakin', 'shmi'], { tier: 1 });
    const s = pstate.cubeState({
        effects: { chance_cube: true },
        cube: { cubes: { [id]: true }, equipped: [id] },
    });
    const patch = {};
    const slot = x => ({ id: x || null, burned: [], frozen: null });
    for (let i = 0; i < 400; i++) {
        const res = engine.resolveLine(engine.throwSet([slot(id), slot(null)]), 'blue', []);
        pstate.recordFaces(s, patch, res.faceLog);
    }
    const keys = Object.keys(s.faces).sort();
    ok('tallies are filed under the parents, never the weld',
        keys.every(k => k === 'anakin' || k === 'shmi'), `got ${keys.join(', ')}`);
    ok('and the weld id appears nowhere', !keys.includes(id));
}

// ---------------------------------------------------------------------------
// A database that only exists in this process
// ---------------------------------------------------------------------------

const makeWorld = function (cube = {}) {
    const profile = {
        name: 'Weld',
        truguts_earned: 10_000_000_000,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 4, unlocked: 4, clears: 0, stake: 1000,
            cubes: {}, equipped: [], buyReroll: true, bribe: true, nudge: true, ...cube,
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
        profile,
        ctxOf: () => ({
            db, database, profile, profileRef: database.ref('users/K/random'),
            discordId: ME, s: pstate.cubeState(profile), moveTruguts,
        }),
    };
};

// ---------------------------------------------------------------------------
// Phase five: the actions
// ---------------------------------------------------------------------------

{
    const owned = { greed: true, wild: true, mirror: true };
    const world = makeWorld({ cubes: owned, equipped: ['greed', 'wild', 'mirror'], points: 3, pressTier: 1 });

    const pressed = actions.weldCubes(world.ctxOf(), { ids: ['greed', 'wild'] });
    ok('welding succeeds', pressed.ok, pressed.message);
    check('it costs one point', pressed.points, 2);
    const id = pressed.weld;
    ok('the weld is owned', pressed.cubes.includes(id));
    ok('and the parents are gone', !pressed.cubes.includes('greed') && !pressed.cubes.includes('wild'));
    // **A weld inherits its parents' seat** rather than being appended, so a loadout the player
    // arranged is not quietly reshuffled by pressing two of its cubes together.
    check('it takes their place in the loadout', pressed.equipped, [id, 'mirror']);

    // **What was benched stays benched.** Pressing two spares together must not field the result.
    {
        const w = makeWorld({
            cubes: { greed: true, wild: true, mirror: true },
            equipped: ['mirror'],
            points: 2,
            pressTier: 1,
        });
        const out = actions.weldCubes(w.ctxOf(), { ids: ['greed', 'wild'] });
        ok('welding two benched cubes succeeds', out.ok, out.message);
        ok('the weld is owned', out.cubes.includes(out.weld));
        check('and it stays on the bench', out.equipped, ['mirror']);
        const back = actions.unweld(w.ctxOf(), { id: out.weld });
        check('breaking it leaves them benched too', back.equipped, ['mirror']);
    }

    // **Breaking a weld on a full table hands back two cubes for one seat.** The rack is capped at
    // `bagSize()`, so the first parent takes the seat the weld was in and the second lands on the
    // bench — nothing the player put on the table is thrown off to make room for it.
    {
        const spares = SPECIALS.map(sp => sp.id)
            .filter(x => !['greed', 'wild', 'octahedron'].includes(x))
            .slice(0, engine.bagSize() - 1);
        const w = makeWorld({
            cubes: Object.fromEntries([...spares, 'greed', 'wild'].map(id => [id, true])),
            equipped: [...spares, 'greed'],
            points: 2,
            pressTier: 1,
        });
        check('the table starts full', w.ctxOf().s.equipped.length, engine.bagSize());
        const out = actions.weldCubes(w.ctxOf(), { ids: ['greed', 'wild'] });
        ok('welding into a full table succeeds', out.ok, out.message);
        check('the weld takes the seat its parent had', out.equipped, [...spares, out.weld]);
        const back = actions.unweld(w.ctxOf(), { id: out.weld });
        ok('breaking it succeeds', back.ok, back.message);
        check('the table is still the size of the bag', back.equipped.length, engine.bagSize());
        check('one parent takes the seat', back.equipped, [...spares, back.parents[0]]);
        ok('and the other is owned but benched',
            back.cubes.includes(back.parents[1]) && !back.equipped.includes(back.parents[1]));
    }

    // Rerolling with truguts.
    const before = world.profile.truguts_spent;
    const cheap = actions.rerollWeld(world.ctxOf(), { id, paying: 'truguts' });
    ok('rerolling for truguts succeeds', cheap.ok, cheap.message);
    check('it spends no point', cheap.points, 2);
    check('and it charges the ceiling price', world.profile.truguts_spent - before,
        pstate.weldRerollCostFor(4));
    ok('the old weld is gone', !cheap.cubes.includes(id));
    ok('the new one is owned', cheap.cubes.includes(cheap.weld));
    check('the seat is unchanged', cheap.equipped, [cheap.weld, 'mirror']);
    check('and it is still the same two cubes', engine.weldParents(cheap.weld), ['greed', 'wild']);

    // Rerolling with a point.
    const dear = actions.rerollWeld(world.ctxOf(), { id: cheap.weld, paying: 'points' });
    ok('rerolling for a point succeeds', dear.ok, dear.message);
    check('it costs one point', dear.points, 1);

    // Unwelding.
    const broke = actions.unweld(world.ctxOf(), { id: dear.weld });
    ok('unwelding succeeds', broke.ok, broke.message);
    check('both cubes come back whole', broke.parents, ['greed', 'wild']);
    ok('and they are owned again',
        broke.cubes.includes('greed') && broke.cubes.includes('wild'));
    ok('the weld is gone', !broke.cubes.includes(dear.weld));
    check('it costs nothing', broke.ok && world.profile.cube.points, 1);
    check('and the memory goes with it',
        (pstate.cubeState(world.profile).weldSeen['greed+wild'] || []).length, 0);

    // Refusals.
    const w2 = makeWorld({ cubes: { greed: true, wild: true, octahedron: true }, equipped: [], points: 0, pressTier: 1 });
    check('no points, no weld', actions.weldCubes(w2.ctxOf(), { ids: ['greed', 'wild'] }).code, 'no_points');
    w2.profile.cube.points = 2;
    check('a cube cannot be welded to itself',
        actions.weldCubes(w2.ctxOf(), { ids: ['greed', 'greed'] }).code, 'bad_pair');
    check('three is not a pair',
        actions.weldCubes(w2.ctxOf(), { ids: ['greed', 'wild', 'mirror'] }).code, 'bad_pair');
    check('an unowned cube is refused',
        actions.weldCubes(w2.ctxOf(), { ids: ['greed', 'mirror'] }).code, 'not_owned');
    // The Octahedron is owned through the collection, so this is the one refusal that has to come
    // from the cube rather than from ownership.
    const w3 = makeWorld({ cubes: { greed: true }, equipped: [], points: 2, pressTier: 1 });
    w3.profile.effects.grand_circuit = true;
    check('the Planet Octahedron will not go in the press',
        actions.weldCubes(w3.ctxOf(), { ids: ['greed', 'octahedron'] }).code, 'cannot_weld');
    check('rerolling something that is not a weld',
        actions.rerollWeld(w3.ctxOf(), { id: 'greed' }).code, 'not_a_weld');
    check('unwelding something that is not a weld',
        actions.unweld(w3.ctxOf(), { id: 'greed' }).code, 'not_a_weld');

    // Mid-run the press is closed, like the loadout and for the same reason: the bag is shuffled when
    // a run starts, so changing what is in it halfway through either does nothing or does something
    // incoherent.
    //
    // The ladder is written straight to the mirror rather than played into existence — `startRun`
    // hands back a run object and does not persist one until the first throw settles, so a test that
    // called it and stopped would be asserting against a run that is not live yet.
    const w4 = makeWorld({ cubes: { greed: true, wild: true }, equipped: ['greed', 'wild'], points: 2, pressTier: 1 });
    persist.saveLadder(w4.database, w4.db, ME, { stake: 1000, level: 0, call: 'blue', set: [], bag: [] });
    ok('the run is live', !!persist.ladderOf(w4.db, ME));
    check('the press is closed mid-run',
        actions.weldCubes(w4.ctxOf(), { ids: ['greed', 'wild'] }).code, 'run_live');
    check('and so is the reroll',
        actions.rerollWeld(w4.ctxOf(), { id: 'greed:012+wild:012' }).code, 'run_live');
    check('and unwelding',
        actions.unweld(w4.ctxOf(), { id: 'greed:012+wild:012' }).code, 'run_live');
}

// ---------------------------------------------------------------------------
// Phase six: EV
// ---------------------------------------------------------------------------

(async function main() {
    const drawCall = () => (crypto.randomInt(0, 2) ? 'red' : 'blue');
    const leanWas = config.dayLean;
    config.dayLean = 0.5;

    const runOf = async function (rack, runs) {
        const world = makeWorld({
            cubes: Object.fromEntries(rack.map(id => [id, true])),
            equipped: rack,
        });
        const inBag = engine.fillBag(pstate.cubeState(world.profile).equipped).filter(Boolean);
        if (rack.length && inBag.length !== Math.min(rack.length, engine.bagSize())) {
            throw new Error(`rack did not reach the bag: ${rack.length} equipped, ${inBag.length} drawn`);
        }
        const st = { staked: 0, returned: 0, throws: 0, ties: 0 };
        for (let t = 0; t < runs; t++) {
            persist.clearLadder(world.database, world.db, ME);
            const started = actions.startRun(world.ctxOf(), { call: drawCall() });
            if (!started.ok) break;
            st.staked += started.staked;
            let run = started.run;
            for (let lv = 0; lv < 24; lv++) {
                const ctx = world.ctxOf();
                const thrown = actions.throwLevel(ctx, run);
                st.throws++;
                let settled;
                if (thrown.asking) {
                    st.ties++;
                    // **Parked before answered, exactly as the API does it.** `answerTie` reads the
                    // tie back off the ladder node rather than taking it as an argument, so a harness
                    // that skipped this got `no_tie` and abandoned the run — which silently threw away
                    // every climb that tied, and welded racks tie on one throw in nine.
                    actions.parkTie(world.ctxOf(), thrown);
                    const answered = actions.answerTie(world.ctxOf(), { buying: false });
                    if (!answered.ok) break;
                    settled = await actions.settleThrow(world.ctxOf(), {
                        thrown: answered.thrown, reverse: answered.reverse,
                    });
                    run = { ...run };
                } else {
                    settled = await actions.settleThrow(ctx, { thrown });
                }
                if (settled && settled.outcome !== 'live') break;
                const live = persist.ladderOf(world.db, ME);
                if (!live) break;
                if (live.level >= pstate.MAX_LEVEL && !live.locked) {
                    const banked = actions.bank(world.ctxOf());
                    if (banked.ok) st.returned += banked.standing;
                    break;
                }
                let want = drawCall();
                if (live.sealed && want === live.sealed) want = live.sealed === 'red' ? 'blue' : 'red';
                const pushed = actions.pushRun(world.ctxOf(), { call: want });
                if (!pushed.ok) break;
                run = pushed.run;
            }
        }
        return st;
    };

    // The seven pairings that cover all fourteen weldable cubes, each mine-carrier sitting with a
    // cube that has no downside face.
    const PAIRS = [
        ['mirror', 'wild'], ['greed', 'symbiont'], ['binder', 'shortcut'], ['gungan', 'reroll'],
        ['anakin', 'shmi'], ['boost', 'multiplier'], ['pitdroid', 'sebulba'],
    ];

    // **Brackets, built rather than rolled.** A player cannot ask for a clean weld — they reroll
    // toward one — so the two ends of the range are constructed directly and the rolled rack sits
    // between them. The gap is what a reroll is buying.
    const bracket = function (lucky, tag) {
        return PAIRS.map(([a, b]) => {
            const A = SPECIALS.find(s => s.id === a);
            const B = SPECIALS.find(s => s.id === b);
            const pick = (sp) => {
                const good = sp.faces.map((f, i) => [f, i]).filter(([f]) => !isDown(f)).map(([, i]) => i);
                const bad = sp.faces.map((f, i) => [f, i]).filter(([f]) => isDown(f)).map(([, i]) => i);
                return (lucky ? [...good, ...bad] : [...bad, ...good]).slice(0, 3);
            };
            // Registered as a synthetic cube so the engine throws it without a real weld id — the
            // id would name the positions, and these are chosen rather than rolled.
            const id = `br${tag}_${a}_${b}`;
            SPECIALS.push({
                id,
                name: `${A.name}/${B.name}`,
                blurb: 'bracket',
                faces: [
                    ...pick(A).map(i => ({ ...A.faces[i], from: a })),
                    ...pick(B).map(i => ({ ...B.faces[i], from: b })),
                ],
            });
            return id;
        });
    };

    const UNLUCKY = bracket(false, 'U');
    const LUCKY = bracket(true, 'L');
    // What the press actually hands you with no rerolling at all.
    const ROLLED = PAIRS.map(p => engine.rollWeld(p, { tier: 4 }));
    const EIGHT = WELDABLE.slice(0, 8);
    const PICKED = ['wild', 'mirror', 'symbiont', 'binder', 'gungan', 'boost', 'sebulba', 'multiplier'];

    const RUNS = Math.max(2000, Math.floor(CLIMBS / 2));
    const BENCH = [
        ['bare ladder', []],
        ['eight unwelded', EIGHT],
        ['eight unwelded · picked', PICKED],
        ['seven welds · unlucky', UNLUCKY],
        ['seven welds · as rolled', ROLLED],
        ['seven welds · lucky', LUCKY],
        ['seven welds + the die', [...LUCKY, 'octahedron']],
    ];

    const bench = [];
    for (const [label, rack] of BENCH) bench.push([label, await runOf(rack, RUNS)]);
    config.dayLean = leanWas;
    const base = bench[0][1].returned / bench[0][1].staked;

    console.log('');
    console.log('The weld');
    console.log('');
    console.log(`  EV · ${RUNS.toLocaleString()} runs a rack, lean off, normalised to a bare ladder`);
    console.log('    rack                       seats    raw   vs bare    tie%');
    for (const [label, st] of bench) {
        const ev = st.staked ? st.returned / st.staked : 0;
        const tie = st.throws ? (st.ties / st.throws) * 100 : 0;
        console.log(`    ${label.padEnd(24)}  ${String(BENCH.find(b => b[0] === label)[1].length).padStart(4)}  `
            + `${ev.toFixed(3)}   ${(ev / base).toFixed(3)}   ${tie.toFixed(2).padStart(6)}`);
    }
    console.log('');
    console.log('  the chase · rerolls expected to reach a weld with no downside face on it');
    console.log('    weld                    clean    rerolls');
    const choose = (n, k) => (k < 0 || k > n ? 0 : Array.from({ length: k })
        .reduce((acc, _, i) => (acc * (n - i)) / (i + 1), 1));
    for (const [a, b] of PAIRS) {
        const p = [a, b].reduce((acc, id) => {
            const sp = SPECIALS.find(s => s.id === id);
            const good = sp.faces.filter(f => !isDown(f)).length;
            return acc * (choose(good, 3) / choose(sp.faces.length, 3));
        }, 1);
        console.log(`    ${`${a}+${b}`.padEnd(22)}  ${p.toFixed(3)}   ${p ? `${(1 / p).toFixed(0)}×` : 'never'}`);
    }
    console.log('');

    if (fail.length) {
        console.log(`  ${fail.length} check(s) failed:\n`);
        fail.forEach(f => console.log(`  ${f}\n`));
        process.exit(1);
    }
    console.log('  Every invariant holds.');
    console.log('');
}());
