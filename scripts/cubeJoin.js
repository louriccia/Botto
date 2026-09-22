// Proves the Fusioncutter's second half — fusing two neighbours into one seat — does what it says, and
// that cutting a fused seat apart hands back the cubes that went in.
//
// The arm is `split` on the profile and on the wire, and one charge buys either a split or a join. A
// join is the press run on the table: the same split table at the player's press tier and the same
// downside rule, but cut from each cube's **live** faces and kept only for the climb. Its properties:
//
//   1. **Nothing else on the line moves.** The two neighbours become one seat and every other
//      position is face for face and name for name what it was.
//   2. **The cut comes out of what is left.** A burned face or a spent heat never reappears on the
//      fused cube, and a cut still carries a downside whenever one is live, bar `weldPurity`.
//   3. **Splitting a fused seat returns the originals** — the same names and the same marks — plus
//      whatever the seat picked up while fused, handed to the parent whose face it landed on.
//   4. **It survives being written down**, parked and picked back up, and a copy of a fused seat is
//      fused from copies rather than from the originals.
//
// Then the refusals, and then (with `--price`) the measurement the price in `tuning.js` came from: a
// player who sees the line and takes the best change, against the same player holding Scrap.
//
//   node scripts/cubeJoin.js [--price [lines] [samples]]
//
// Read-only. It builds a world in this process, touches no database and stakes nothing real.

const engine = require('../src/game/cube/engine.js');
const actions = require('../src/game/cube/actions.js');
const pstate = require('../src/game/cube/state.js');
const { SPECIALS, cube: config } = require('../src/game/cube/tuning.js');

const { plainSlot } = engine;
const DOWNSIDE = new Set(['end', 'broken']);
const WELDABLE = SPECIALS.filter(sp => !sp.noWeld).map(sp => sp.id);

let failures = 0;
let checks = 0;
const ok = function (what, cond, detail) {
    checks++;
    if (cond) return true;
    failures++;
    console.log(`  FAIL  ${what}${detail == null ? '' : `  — ${detail}`}`);
    return false;
};
const eq = (what, got, want) => ok(what, JSON.stringify(got) === JSON.stringify(want),
    `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const slot = (id, extra = {}) => ({ ...plainSlot(), id, ...extra });
const lineOf = slots => slots.map((sl) => {
    const [c] = engine.throwSet([sl]);
    return c;
});

console.log('\nTHE LINE — two neighbours become one seat and nothing else moves');
{
    let moved = 0;
    let shape = 0;
    for (let t = 0; t < 2000; t++) {
        const ids = [...WELDABLE].sort(() => Math.random() - 0.5).slice(0, 5);
        const line = lineOf([slot(ids[0]), slot(ids[1]), slot(ids[2]), plainSlot(), slot(ids[3])]);
        const before = engine.encodeLine(line);
        const x = engine.joinAt(line, 1, 2, config.weldTiers.length);
        if (!x) { shape++; continue; }
        line.splice(1, 2, x);
        const after = engine.encodeLine(line);
        // Seats 0, 3 and 4 before are seats 0, 2 and 3 after.
        if ([[0, 0], [3, 2], [4, 3]].some(([i, k]) => before.faces[i] !== after.faces[k]
            || before.state.uids[i] !== after.state.uids[k])) moved++;
        const parents = engine.weldParents(x.slot.id);
        if (!parents || parents.slice().sort().join() !== [ids[1], ids[2]].sort().join()) shape++;
        if (x.slot.joined.map(p => p.uid).join() !== [before.state.uids[1], before.state.uids[2]].join()) shape++;
    }
    eq('every other position keeps its face and its name', moved, 0);
    eq('the seat is a weld of exactly the two neighbours, carrying both originals', shape, 0);
}

console.log('\nTHE CUT — out of what is left, and a downside when there is one to keep');
{
    // A Greed with its End burned and two of its greeds gone, beside a Turbine with two heats spent.
    const greed = slot('greed', { burned: ['end', 'greed', 'greed'].map(k => SPECIALS.find(s => s.id === 'greed').faces.find(f => f.kind === k).id) });
    let resurrected = 0;
    let n = 0;
    for (let t = 0; t < 3000; t++) {
        const line = lineOf([slot(greed.id, { burned: [...greed.burned] }), slot('turbine', { heat: 2 })]);
        const x = engine.joinAt(line, 0, 1, config.weldTiers.length);
        if (!x) continue;
        n++;
        const faces = engine.specialById(x.slot.id).faces;
        const fromGreed = faces.filter(f => f.from === 'greed');
        const fromTurbine = faces.filter(f => f.from === 'turbine');
        if (fromGreed.some(f => f.kind === 'end') || fromGreed.length > 3) resurrected++;
        if (fromTurbine.filter(f => f.kind === 'heat').length > 3) resurrected++;
    }
    ok('the join fused at all', n > 2500, `${n} of 3000`);
    eq('no burned face or spent heat comes back on the fused cube', resurrected, 0);

    let clean = 0;
    const trials = 20000;
    for (let t = 0; t < trials; t++) {
        const id = engine.joinCut([slot('greed'), slot('guide')], 1);
        if (!engine.specialById(id).faces.some(f => DOWNSIDE.has(f.kind))) clean++;
    }
    const rate = clean / trials;
    ok('a cut keeps a downside whenever one is live, bar weldPurity',
        rate < config.weldPurity * 3 + 0.002, `${(rate * 100).toFixed(2)}% clean against weldPurity ${config.weldPurity}`);

    const noDown = engine.joinCut([slot('gungan'), slot(greed.id, { burned: [...greed.burned] })], 1);
    ok('a pair with no live downside still fuses', !!engine.specialById(noDown));
}

console.log('\nTHE SPLIT — a fused seat comes apart into the cubes that went in');
{
    const a = slot('greed', { painted: ['greed|red'], blessed: true });
    const b = slot('multiplier', { mirrored: true });
    const line = lineOf([slot(a.id, { ...a, painted: [...a.painted] }), slot(b.id, { ...b })]);
    const uids = line.map(c => c.slot.uid);
    const x = engine.joinAt(line, 0, 1, 1);
    line.splice(0, 2, x);
    ok('the fused seat carries no marks of its own',
        !x.slot.burned.length && !x.slot.painted.length && !x.slot.blessed && !x.slot.mirrored);

    const back = engine.splitAt(line, 0);
    eq('the split hands back the same two names', back.map(c => c.slot.uid).sort(), [...uids].sort());
    const g = back.find(c => c.slot.id === 'greed').slot;
    const m = back.find(c => c.slot.id === 'multiplier').slot;
    eq('and their own marks, untouched', [g.painted, g.blessed, m.mirrored], [['greed|red'], true, true]);

    // What the seat picked up while it was one cube goes to the parent whose face it landed on.
    const line2 = lineOf([slot('greed'), slot('multiplier')]);
    const y = engine.joinAt(line2, 0, 1, 1);
    const faces = engine.specialById(y.slot.id).faces;
    const gFace = faces.find(f => f.from === 'greed');
    const mFace = faces.find(f => f.from === 'multiplier');
    y.slot.burned.push(gFace.id);
    y.slot.painted.push(`${mFace.id}|blue`);
    y.slot.blessed = true;
    y.slot.mirrored = true;
    const parts = engine.splitAt([y], 0);
    const pg = parts.find(c => c.slot.id === 'greed').slot;
    const pm = parts.find(c => c.slot.id === 'multiplier').slot;
    eq('a burn lands on the parent that gave the face', [pg.burned, pm.burned], [[gFace.id], []]);
    eq('so does a paint', [pg.painted, pm.painted], [[], [`${mFace.id}|blue`]]);
    eq('a blessing goes to one parent', [pg.blessed, pm.blessed].filter(Boolean).length, 1);
    eq('a reflection turns both', [pg.mirrored, pm.mirrored], [true, true]);

    // The same hand-back for a weld out of the press, which used to come apart clean.
    const pressed = engine.rollWeld(['greed', 'wild'], { tier: 1 });
    const pf = engine.specialById(pressed).faces.find(f => f.from === 'wild');
    const w = lineOf([slot(pressed, { burned: [pf.id] })]);
    const wp = engine.splitAt(w, 0);
    eq('a pressed weld hands its burns back too',
        wp.find(c => c.slot.id === 'wild').slot.burned, [pf.id]);
}

console.log('\nTHE WIRE — parked, picked up, and copied');
{
    const line = lineOf([slot('greed', { painted: ['greed|red'] }), slot('wild'), plainSlot()]);
    const x = engine.joinAt(line, 0, 1, 1);
    line.splice(0, 2, x);
    const enc = engine.encodeLine(line);
    const set = engine.decodeSet(JSON.parse(JSON.stringify(enc.set)));
    eq('the originals survive being written down',
        set[0].joined.map(p => [p.uid, p.id, p.painted]),
        x.slot.joined.map(p => [p.uid, p.id, p.painted]));
    const re = engine.relineFrom(set, enc.faces, enc.state);
    ok('and a parked line picked back up can still be split', engine.canSplitAt(re, 0));

    const copy = engine.cloneHeld(x.slot.joined, true);
    ok('a copy of a fused seat is fused from new cubes',
        copy.every((p, i) => p.uid !== x.slot.joined[i].uid && p.id === x.slot.joined[i].id));
}

console.log('\nTHE REFUSALS');
{
    const gold = SPECIALS.find(sp => sp.noWeld).id;
    const pressed = engine.rollWeld(['greed', 'wild'], { tier: 1 });
    const frozen = lineOf([slot('greed'), slot('wild')]);
    frozen[0].frozen = true;
    const cases = [
        ['two cubes not side by side', lineOf([slot('greed'), plainSlot(), slot('wild')]), 0, 2],
        ['a plain cube', lineOf([slot('greed'), plainSlot()]), 0, 1],
        ['a frozen cube', frozen, 0, 1],
        ['a weld out of the press', lineOf([slot(pressed), slot('boost')]), 0, 1],
        ['two of the same cube', lineOf([slot('greed'), slot('greed')]), 0, 1],
        ['a cube the press will not take', lineOf([slot(gold), slot('greed')]), 0, 1],
        ['a cube burned to nothing', lineOf([slot('gungan', { burned: Array(6).fill(SPECIALS.find(s => s.id === 'gungan').faces[0].id) }), slot('greed')]), 0, 1],
    ];
    for (const [what, line, i, j] of cases) ok(`refuses ${what}`, !engine.canJoinAt(line, i, j));
    ok('fuses an ordinary pair', engine.canJoinAt(lineOf([slot('greed'), slot('wild')]), 0, 1));
}

console.log('\nTHE ARM — one charge, a join or a split, and a join split on a later rung');
{
    const ME = 'join-test';
    const profile = {
        name: 'Join test',
        truguts_earned: 1e12,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 8, unlocked: 4, clears: 0, stake: 1000, pressTier: 4,
            cubes: { greed: true, wild: true, boost: true }, equipped: ['greed', 'wild', 'boost'],
            split: true, scrap: true,
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
        remove: () => Promise.resolve(),
    });
    const database = { ref };
    const ctx = () => ({
        db, database, profile, profileRef: database.ref('users/K/random'),
        discordId: ME, s: pstate.cubeState(profile), moveTruguts: () => {},
    });
    const stand = () => {
        db.ch.cube.ladders[ME] = {
            stake: 1000, mult: 8, standing: 8000, level: 1, again: 0, rungs: 1, set: {}, bag: [],
        };
    };
    const hold = (line) => {
        const run = {
            level: 1, again: 0, call: 'blue', rungs: 1, set: [], bag: [], armed: db.ch.cube.ladders[ME].armed,
        };
        return actions.holdRoll(ctx(), run, { line, bag: [] });
    };

    stand();
    ok('arming the Fusioncutter is charged the split share',
        actions.arm(ctx(), { pick: 'split' }).paid === engine.armPriceOf(8, 'split'));
    eq('the split share is 0.15 of the standing multiple', engine.armPriceOf(8, 'split'), 1.2);
    const line = lineOf([slot('greed'), slot('wild'), slot('boost')]);
    const uids = line.map(c => c.slot.uid);
    const held = hold(line);
    eq('the hold offers every fusible neighbouring pair', held.can.join, [[0, 1], [1, 2]]);
    eq('and nothing to split on a line with no weld', held.can.split, []);

    ok('refuses a pair that is not side by side',
        actions.alterShown(ctx(), { join: [0, 2] }).code === 'not_neighbours');
    const fused = actions.alterShown(ctx(), { join: [0, 1] });
    ok('fuses a pair', fused.ok, fused.message);
    eq('the line is one shorter', fused.faces.length, 2);
    eq('the fused seat is now offered for a split, not a second join', [fused.can.split, fused.can.join], [[], []]);
    ok('a second change this rung is refused',
        actions.alterShown(ctx(), { split: 0 }).code === 'not_armed');

    // The roll can destroy the fused seat, so it is thrown until one leaves the rung standing.
    let kept = null;
    for (let t = 0; t < 200 && !kept; t++) {
        const took = actions.finishShown(ctx());
        const res = engine.resolveLine(took.thrown.line, 'blue', [], { hold: [], wrecked: [], rungs: 2 });
        kept = res.set.find(sl => (sl.joined || []).length) || null;
    }
    if (kept) {
        eq('the fused seat stands on in the set it leaves the rung with',
            kept.joined.map(p => p.uid), uids.slice(0, 2));
        stand();
        actions.arm(ctx(), { pick: 'split' });
        const next = engine.throwSet(engine.decodeSet(engine.encodeSet([kept, slot('boost')])));
        const at = next.findIndex(c => c.slot.uid === kept.uid);
        const again = hold(next);
        ok('a later rung offers the fused seat for a split', again.can.split.includes(at));
        const cut = actions.alterShown(ctx(), { split: at });
        ok('and cuts it apart', cut.ok, cut.message);
        eq('into the two cubes that went in', cut.state.uids.filter(u => uids.slice(0, 2).includes(u)).sort(),
            uids.slice(0, 2).sort());
    } else {
        console.log('  (the fused seat did not survive its roll this time — the later-rung check is skipped)');
    }
}

// ---------------------------------------------------------------------------
// --price: what the arm is worth, next to Scrap
// ---------------------------------------------------------------------------

const priceAt = process.argv.indexOf('--price');
if (priceAt >= 0) {
    const LINES = Number(process.argv[priceAt + 1]) || 300;
    const K = Number(process.argv[priceAt + 2]) || 10;
    const clone = x => JSON.parse(JSON.stringify(x));
    const snap = line => ({ ...engine.encodeLine(line) });
    const rebuild = s => engine.relineFrom(engine.decodeSet(clone(s.set)), s.faces, clone(s.state));
    const valueOf = function (line, call) {
        const res = engine.resolveLine(line, call, [], { hold: [], wrecked: [], rungs: 1 });
        if (res.overflow || res.ended || !res.faceIds.length) return 0;
        const base = engine.rungMultiple('level', 1, res.mult);
        const won = engine.applyMults(base, res.mults, call);
        if (!res.majority) return (1 - config.tieLean) * won;
        return res.majority === call ? won : 0;
    };
    const mean = (build, call) => {
        let t = 0;
        for (let i = 0; i < K; i++) t += valueOf(build(), call);
        return t / K;
    };
    const moves = function (line, s, arm) {
        const out = [];
        for (let i = 0; i < line.length; i++) {
            if (arm === 'scrap' && line.length > 1) out.push(() => { const l = rebuild(s); l.splice(i, 1); return l; });
            if (arm === 'split' && engine.canSplitAt(line, i)) {
                out.push(() => { const l = rebuild(s); l.splice(i, 1, ...engine.splitAt(l, i)); return l; });
            }
            if (arm === 'split' && engine.canJoinAt(line, i, i + 1)) {
                out.push(() => {
                    const l = rebuild(s);
                    l.splice(i, 2, engine.joinAt(l, i, i + 1, config.weldTiers.length));
                    return l;
                });
            }
        }
        return out;
    };
    const measure = function (label, makeSet) {
        const tot = { none: 0, scrap: 0, split: 0 };
        for (let t = 0; t < LINES; t++) {
            const call = Math.random() < 0.5 ? 'blue' : 'red';
            const line = engine.throwSet(makeSet());
            const s = snap(line);
            const none = () => rebuild(s);
            const noneV = mean(none, call);
            const fresh = mean(none, call);
            tot.none += fresh;
            for (const arm of ['scrap', 'split']) {
                let best = null;
                let bestV = noneV;
                for (const m of moves(line, s, arm)) {
                    const v = mean(m, call);
                    if (v > bestV) { bestV = v; best = m; }
                }
                tot[arm] += best ? mean(best, call) : fresh;
            }
        }
        const be = a => 1 - tot.none / tot[a];
        const ratio = be('split') / be('scrap');
        console.log(`  ${label.padEnd(34)} scrap ${be('scrap').toFixed(3)}  cutter ${be('split').toFixed(3)}`
            + `  → ${(ratio * 100).toFixed(0)}% of Scrap, fair share ${(ratio * config.armShares.scrap).toFixed(3)}`);
        return ratio;
    };
    const pickN = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
    console.log(`\nTHE PRICE — break-even share of the multiple, ${LINES} lines, ${K} samples a move`);
    console.log('  (the player searches every move, so absolute shares run high; the ratio is the reading)');
    const ratios = [];
    for (const L of [2, 4]) {
        const seats = engine.nominalCubes(L);
        ratios.push(measure(`L${L + 1}, singles`, () => [...pickN(WELDABLE, seats - 1).map(id => slot(id)), plainSlot()]));
        ratios.push(measure(`L${L + 1}, two welds`, () => {
            const ids = pickN(WELDABLE, seats + 1);
            const w = [0, 2].map(k => engine.rollWeld(ids.slice(k, k + 2), { tier: config.weldTiers.length }));
            return [...[...w, ...ids.slice(4, seats + 1)].map(id => slot(id)), plainSlot()];
        }));
    }
    const avg = ratios.reduce((n, r) => n + r, 0) / ratios.length;
    console.log(`  mean ${(avg * 100).toFixed(0)}% of Scrap → ${(avg * config.armShares.scrap).toFixed(3)}`
        + ` against the shipped ${config.armShares.split}`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
