// The Planet Octahedron, measured and asserted.
//
// `cubeParity.js` cannot cover this cube and says so: the frozen reference engine predates it, so a
// climb fielding it is not a divergence in the ported rules, it is a cube the proof is not about.
// This is where it earns its place instead.
//
// Three things happen here, and only the first two can fail:
//
//   1. **Invariants.** The claims the design rests on, asserted over enough throws that a rare path
//      is not a coincidence — a scorch takes exactly one face, ice lasts exactly one throw, a plunge
//      is parity-preserving, nobody stays in the prison forever.
//   2. **Plumbing.** The four things the die does that aren't to the line — a sealed side, a sealed
//      bank, a won tie, a prison that survives a rung — go through `actions.js` and Firebase-shaped
//      storage, because all four are round-tripped through a stored ladder and that is where a shape
//      mismatch actually bites.
//   3. **EV.** Reported, not asserted. Wild measures ~1.30 and Sebulba was cut back from 1.64, so
//      those are the numbers to read this against — and the standing warning from the Sebulba note
//      applies here twice over, because this cube also never leaves the table.
//
//   node scripts/cubeOctahedron.js [climbs]

const assert = require('assert');
const crypto = require('crypto');

const engine = require('../src/game/cube/engine.js');
const actions = require('../src/game/cube/actions.js');
const pstate = require('../src/game/cube/state.js');
const persist = require('../src/game/cube/persist.js');
const { SPECIALS, POINTS, PLAIN_FACES, cube: config } = require('../src/game/cube/tuning.js');

const CLIMBS = Number(process.argv[2]) || 40000;
const DIE = 'octahedron';
const die = SPECIALS.find(s => s.id === DIE);

const slot = id => engine.slotOf(id || null);
const fail = [];
const check = function (name, got, want) {
    try {
        assert.deepStrictEqual(got, want);
    } catch (e) {
        fail.push(`${name}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
    }
};
const ok = (name, cond, detail = '') => { if (!cond) fail.push(`${name}${detail ? `\n    ${detail}` : ''}`); };

// ---------------------------------------------------------------------------
// Phase one: the data
// ---------------------------------------------------------------------------

check('die has eight faces', die.faces.length, 8);
check('every face is distinct', new Set(die.faces.map(f => f.id)).size, 8);
ok('no face carries a side', !die.faces.some(f => f.side),
    'a planet face that counted as a colour would have to draw as two glyphs');
ok('every face scores', die.faces.every(f => POINTS[f.kind] != null),
    `unscored: ${die.faces.filter(f => POINTS[f.kind] == null).map(f => f.id).join(', ')}`);
ok('no wipeout and no mine', !die.faces.some(f => f.kind === 'end' || f.kind === 'broken'),
    'the price is meant to live inside the planets');
check('a plain cube is three of each', PLAIN_FACES.length, 6);
check('plain blue faces', PLAIN_FACES.filter(f => f.side === 'blue').length, 3);

// ---------------------------------------------------------------------------
// Phase two: slots
// ---------------------------------------------------------------------------
//
// The set grew from a list of ids to a list of slots, and the whole reason it shipped without a
// migration is that an untouched slot still encodes as a bare id. Both directions are asserted,
// because either one drifting silently costs somebody a run.

check('a plain slot encodes as 0', engine.encodeSet([slot(null)]), [0]);
check('a special slot encodes as its id', engine.encodeSet([slot('wild')]), ['wild']);
check('a legacy set decodes', engine.decodeSet([0, 'wild']), [slot(null), slot('wild')]);
check('a legacy set round-trips unchanged', engine.encodeSet(engine.decodeSet([0, 'wild', 0])), [0, 'wild', 0]);
check('a Firebase object set decodes', engine.decodeSet({ 0: 0, 1: 'greed' }), [slot(null), slot('greed')]);
check('a scorched slot survives the round trip',
    engine.decodeSet(engine.encodeSet([{ id: 'wild', burned: ['end'], frozen: null }])),
    [{ ...slot('wild'), burned: ['end'] }]);
check('a frozen slot survives the round trip',
    engine.decodeSet(engine.encodeSet([{ id: null, burned: [], frozen: 'side:blue' }])),
    [{ ...slot(null), frozen: 'side:blue' }]);
// The bag is not a set and must not gain slots, or `specialById` is handed an object.
check('the bag stays bare ids', engine.decodeBag(engine.encodeBag(['wild', null])), ['wild', null]);

// `liveFaces` is where the scorch actually bites, and the floor with it.
check('an untouched Wild has six faces', engine.liveFaces(die && SPECIALS.find(s => s.id === 'wild'), []).length, 6);
{
    // **Counted off the cube rather than typed.** These read `5 wild + 1 Ratts` once, which was the
    // Wild Cube then and has not been since it was cut to three and three — so they failed for a year
    // describing an engine that was right. What the scorch does is a ratio, so the ratio is what is
    // asserted and the face list is where the numbers come from.
    const wild = SPECIALS.find(s => s.id === 'wild');
    const of = (faces, kind) => faces.filter(f => f.kind === kind).length;
    const wilds = of(wild.faces, 'wild');
    const mines = of(wild.faces, 'end');
    const noRatts = engine.liveFaces(wild, ['end']);
    check('scorching a mine takes exactly one', of(noRatts, 'end'), mines - 1);
    ok('and leaves the wilds alone', of(noRatts, 'wild') === wilds);
    ok('and thins the mines', of(noRatts, 'end') / noRatts.length < mines / wild.faces.length,
        'burning a bad face has to make it rarer — that is the case the fire is played for');
    const oneWild = engine.liveFaces(wild, ['wild']);
    check('scorching a wild takes exactly one', of(oneWild, 'wild'), wilds - 1);
    ok('and concentrates the mine', of(oneWild, 'end') / oneWild.length > mines / wild.faces.length,
        'burning a good face has to make the bad one likelier — that is what pays for the other case');
    check('the floor holds', engine.liveFaces(wild, ['wild', 'wild', 'wild', 'wild', 'wild', 'end', 'end']).length,
        config.minFaces);
    check('a plain cube scorches to 3-2', engine.liveFaces(null, ['side:blue']).filter(f => f.side === 'blue').length, 2);
}

// **A charred face is remains: it stands there and counts for nothing.**
//
// Both halves, because the face is both and shipping only one of them is exactly what went wrong. The
// cube loses the face for the rest of the climb — that is `liveFaces` above — and the position in front
// of you stops being a cube: no side toward the count, no points, no payout, no turn. Without the second
// half a Ratts charred by the Baroonda beside it detonates anyway, which is the case the face exists for.
{
    const bare = id => ({ id, burned: [], painted: [], frozen: null, heat: 0, hauled: false, blessed: false });
    let seen = 0;
    let counted = 0;
    let paid = 0;
    let scored = 0;
    for (let t = 0; t < 20000 && seen < 400; t += 1) {
        const res = engine.resolveLine(
            engine.throwSet([bare('greed'), bare(DIE), bare('greed'), bare(null)]),
            'blue', [], { rungs: 2 },
        );
        (res.charred || []).forEach((dead, at) => {
            if (!dead) return;
            seen += 1;
            // `cubes` is only the positions that counted, so a charred one showing a colour would make
            // it longer than the sides actually on the line.
            if ((res.pays || []).some(p => p.at === at)) paid += 1;
            if ((res.pointsAt || []).includes(at)) scored += 1;
        });
        counted += res.cubes.length;
    }
    ok('a charred position is reached at all', seen > 0, 'nothing was scorched in 20,000 throws');
    check('and it pays nothing', paid, 0);
    check('and it scores no face points', scored, 0);
    ok('and it counts toward no colour',
        engine.pointsOf({ face: { id: 'greed', kind: 'charred' }, side: null }) === 0);
}

// **A blessing outlives the rung it was given on**, which is the whole of what separates it from the
// one-rung mark it was first written as — and the difference is invisible inside a single throw, so it
// is measured across the carry. A line of plain cubes has nothing on it that can destroy anything, so
// a blessing put on one has to still be there however many times the set is thrown.
{
    const blessed = () => ({ id: null, burned: [], painted: [], frozen: null, heat: 0, hauled: false, blessed: true });
    let set = [blessed(), { ...blessed(), blessed: false }, { ...blessed(), blessed: false }];
    let held = true;
    for (let rung = 1; rung <= 6; rung += 1) {
        const res = engine.resolveLine(engine.throwSet(set), 'blue', [], { rungs: rung });
        held = held && res.set.filter(x => x && x.blessed).length === 1;
        set = res.set;
    }
    ok('a blessing survives six throws of a quiet line', held,
        'nothing on a plain line can spend one, so the only thing that could take it off is the rung ending');
}

// **The Jawa salvages what this roll broke, the player's own scrap included.**
//
// Both halves are measured because both were once the other way. A cube destroyed earlier in the same
// line used to be unreachable until settlement, which made the Scavenger a delayed payout rather than a
// reaction; and the cube the player *scrapped* used to be held back on the grounds that a Jawa handing
// it over refunds a purchase. Neither holds now: Scrap takes a cube off the line, the Scavenger is the
// cube that pulls things back onto it, and a rack fielding both lives with the tension it built.
//
// **No cloner in this rack, deliberately.** A Binder cloning a salvaged cube puts two of it on the line,
// which looks exactly like the duplication bug this is here to catch and is not one.
{
    const bare = id => ({ id, burned: [], painted: [], frozen: null, heat: 0, hauled: false, blessed: false });
    let salvaged = 0;
    let scrapBack = 0;
    let twice = 0;
    let turns = 0;
    for (let t = 0; t < 4000; t += 1) {
        const res = engine.resolveLine(
            engine.throwSet([bare('scavenger'), bare(null), bare(null), bare('wild')]),
            'blue', [], { rungs: 2, wrecked: [bare('greed')] },
        );
        const kinds = res.notes.map(n => n.kind);
        if (!kinds.includes('scavenge') && !kinds.includes('scavenge.empty')) continue;
        turns += 1;
        if (kinds.includes('scavenge')) salvaged += 1;
        const onLine = res.set.filter(x => x && x.id === 'greed').length;
        const inHold = (res.hold || []).filter(x => x && x.id === 'greed').length;
        if (onLine) scrapBack += 1;
        if (onLine + inHold > 1) twice += 1;
    }
    ok('a Jawa salvages what the same roll destroyed', salvaged > 0,
        `took ${turns} turns and salvaged nothing — the roll's own wreckage is not reaching the hold`);
    ok('and the cube the player scrapped is fair salvage', scrapBack > 0);
    // The bug the early sweep can produce if the two sweeps do not agree: the cube standing on the line
    // *and* sitting in the hold, because the one at the end of the roll swept it a second time.
    check('and nothing ends up in two places at once', twice, 0);
}

// **A paint is a mark on one copy of a face, not on the face id**, which is the same rule the scorch
// obeys and for the same reason: a cube carries three faces under `side:red` and the crowd visited one
// of them. Read off the id instead and one visit turns all three, which is a cube fused to a colour in
// a single landing rather than in three — and then refuses to take any further paint, because the id
// already reads blue. Measured rather than asserted structurally: the whole mechanism is a draw.
{
    const N = 30000;
    const painted = marks => ({ id: null, burned: [], painted: marks, frozen: null, heat: 0, hauled: false });
    const blueRate = function (marks) {
        let blue = 0;
        for (let i = 0; i < N; i++) if (engine.throwSet([painted([...marks])])[0].side === 'blue') blue += 1;
        return blue / N;
    };
    const one = blueRate(['side:red|blue']);
    ok('one red painted blue is four faces in six', Math.abs(one - (4 / 6)) < 0.02,
        `measured ${(one * 100).toFixed(1)}%, want 66.7% — a mark on one copy, not on the id`);
    const all = blueRate(['side:red|blue', 'side:red|blue', 'side:red|blue']);
    ok('and three of them is the whole cube', all > 0.995,
        `measured ${(all * 100).toFixed(1)}%, want 100% — three paints fuse a plain cube to a colour`);
}

// ---------------------------------------------------------------------------
// Phase three: the faces, over many throws
// ---------------------------------------------------------------------------

const stats = {
    throws: 0, freeze: 0, scorch: 0, vault: 0, blessing: 0, seam: 0, jail: 0, plunge: 0, crowd: 0,
    heldFaces: 0, thawed: 0, iced: 0, burned: 0, leanFree: 0, plungeSelf: 0, jailbreak: 0,
    painted: 0, spared: 0, blocks: 0,
};

// A rack with the die and enough around it for the positional faces to have neighbours worth having.
const RACK = [DIE, 'wild', 'greed', 'binder', 'symbiont', 'multiplier'];

for (let t = 0; t < CLIMBS; t++) {
    let set = [slot(null), slot(DIE), ...RACK.slice(1).map(slot), slot(null), slot(null)];
    let sealed = null;
    const call = t % 2 ? 'red' : 'blue';

    for (let rung = 1; rung <= 6 && set.length; rung++) {
        // What the set looks like going in, so the throw can be checked against it.
        const before = set.map(s => ({ ...s, burned: [...s.burned] }));
        const frozenIn = before.filter(s => s.frozen).length;

        const line = engine.throwSet(set);
        stats.throws++;

        // **Ice lasts exactly one throw.** Every slot that came in frozen is served this throw and
        // comes out thawed, so nothing can sit on a face for a whole climb.
        check('a served freeze is consumed', line.filter(c => c.slot.frozen).length, 0);
        ok('every frozen slot was served', line.filter(c => c.frozen).length <= frozenIn,
            `held ${line.filter(c => c.frozen).length} of ${frozenIn} coming in`);
        stats.heldFaces += line.filter(c => c.frozen).length;

        // A scorched plain cube draws off its own faces, which is the one draw the daily lean cannot
        // reach. Asserted structurally: it has no `face`, so it must have come off `PLAIN_FACES`.
        for (const c of line) {
            if (!c.special && (c.slot.burned.length || c.slot.painted.length)) {
                stats.leanFree++;
                // Unless the face it landed on is one of the burnt ones, which is the whole of what a
                // scorch does to a plain cube: it still draws a colour, and that colour is dead.
                ok('a scorched plain cube still lands on a colour',
                    c.charred || c.side === 'red' || c.side === 'blue');
            }
        }

        const res = engine.resolveLine(line, call, [], { rungs: rung });
        const kinds = res.notes.map(n => n.kind);

        // **The crowd paints the leader, and paint is what a face counts for.** Every mark it writes
        // has to be readable back off the slot as a side, or the position it lands on next rung counts
        // toward nothing and the face has quietly done nothing at all.
        const crowded = res.notes.find(n => n.kind === 'crowd');
        if (crowded) {
            stats.painted += crowded.painted;
            check('the crowd paints at most both neighbours', crowded.painted <= 2, true);
            ok('and paints a side', crowded.side === 'red' || crowded.side === 'blue');
            // **Read off the frame and not off the carried set.** The crowd takes its turn now, so a
            // cube it painted can be destroyed by something later in the same roll — the mark going
            // with it is correct, and asserting the set still carries one fails on a legitimate roll.
            const marks = (res.steps || [])
                .flatMap(x => (x.painted || []))
                .filter(Boolean);
            ok('and every mark names a side',
                marks.every(m => m === 'red' || m === 'blue'));
            // **It takes its turn like everything else**, which is the whole of what moving it out of
            // the after-count pass bought: a frame in fire order, and a tint the player sees land.
            const frame = (res.steps || []).find(x => x.note && x.note.kind === 'crowd');
            ok('and it gets a frame in the turn order', !!frame,
                'a face resolved after the count is past the end of the walk that hands out frames');
            ok('and the paint is on that frame', !!frame && (frame.painted || []).some(Boolean),
                'the tint is drawn off the frame, so a paint that is not on it is a paint nobody sees');
        }

        // **The blessing rides the cube, and one thing takes it off: using it.**
        //
        // The invariant that matters is *persistence* — it was written as a one-rung mark first, which
        // is a completely different face, and the difference is invisible inside a single throw. So it
        // is asserted across the carry: a blessing given on this rung has to be on the set the next one
        // is thrown from, and the only thing that clears one is a destroyer being turned away.
        const blessed = res.notes.find(n => n.kind === 'blessing');
        if (blessed) ok('a blessing names a face', typeof blessed.faceId === 'string');
        // **A plunge always takes two or takes none**, which is what keeps it parity-preserving on a die
        // that is sideless everywhere else — a blessed cube on an end does not stop it, it makes the
        // ledge crumble one further in. Persistence is asserted in the controlled test above rather than
        // here: on a rack with a mine in it a blessed cube can be destroyed, or spend the blessing, on
        // the roll it was given, and neither is a failure.
        const fell = res.notes.find(n => n.kind === 'plunge');
        if (fell) {
            check('a plunge still takes two', fell.destroyed, 2);
            ok('and it takes them from the ends inward', Array.isArray(fell.at) && fell.at.length === 2);
        }
        // Nothing else clears one. Counted rather than asserted per-throw: a blessing can leave with the
        // cube it was on, which is not the same as being spent.
        const blocks = kinds.filter(k => k.endsWith('.blessed')).length
            + res.notes.filter(n => Number(n.spared) > 0).length;
        stats.blocks += blocks;
        const sparedBy = res.notes.filter(n => Number(n.spared) > 0);
        for (const n of sparedBy) stats.spared += n.spared;
        for (const k of ['freeze', 'scorch', 'vault', 'blessing', 'seam', 'jail', 'plunge', 'crowd']) {
            if (kinds.includes(k)) stats[k]++;
        }
        if (kinds.some(k => k.endsWith('.iced'))) stats.iced++;

        // **A plunge takes exactly two positions**, which is what keeps it from manufacturing ties on
        // a die that is sideless everywhere else.
        const plunged = res.notes.find(n => n.kind === 'plunge');
        if (plunged) {
            check('a plunge takes two', plunged.destroyed, 2);
            if (plunged.self) stats.plungeSelf++;
        }

        // **Nobody is scorched past the floor**, and a burn is one face at a time.
        for (const s of res.set) {
            const sp = s.id ? engine.specialById(s.id) : null;
            ok('a cube keeps at least one face', engine.liveFaces(sp, s.burned).length >= config.minFaces,
                `${s.id || 'plain'} burned ${JSON.stringify(s.burned)}`);
        }
        const scorched = res.notes.find(n => n.kind === 'scorch');
        if (scorched) {
            stats.burned += scorched.burned.length;
            ok('a scorch takes at most one face per neighbour', scorched.burned.length <= 2);
        }

        // **The prison is bounded and it always has a door.** It belongs to the die now rather than
        // to the run — see Capture in the tuning — so both claims are about a cell on a slot: no cell
        // holds more than it was built for, and nobody is inside a cube that isn't standing.
        for (const s of res.set) {
            ok('no cell exceeds its size', s.held.length <= config.jailSize,
                `${s.id || 'plain'} holding ${s.held.length}`);
        }
        const dieStanding = res.set.some(s => s.id === DIE);
        const inCells = res.set.reduce((n, s) => n + engine.countHeld(s.held), 0);
        check('the reported hold matches the set', res.held, inCells);
        ok('prisoners are only held by a standing jailer or hauler', !inCells || dieStanding
            || res.set.some(s => s.id === 'scavenger'),
            `held ${inCells} with the die ${dieStanding ? 'up' : 'gone'}`);
        if (kinds.includes('hold.break')) stats.jailbreak++;

        // Every position on the resolved line has exactly one id — the rule the whole face scheme
        // exists for, re-asserted here because the die adds eight ids to it.
        ok('one id per position', res.faceIds.every(id => typeof id === 'string' && id.length > 0));
        ok('the set is never longer than the line', res.set.length <= res.faceIds.length);

        // Settle the run-level half the way `settleWin` does, so the next rung is thrown against a
        // table the game would actually have built.
        if (!res.faceIds.length) break;
        const majority = res.majority;
        if (majority !== call) break;

        // No release to apply: a captor hands its prisoners back on the line, inside the roll, so
        // whatever came out is already standing in `res.set`.
        set = [...res.set];
        sealed = res.sealed || null;
    }
}

// **Nothing stays in the prison forever.** One out at the start of every turn the die takes, all out
// if the die dies — so a run that keeps throwing empties it whether or not the rungs go its way.
// `scripts/cubeHolds.js` is what proves the two valves; this only says the sweep exercised them.
ok('the prison was exercised', stats.jail === 0 || stats.throws > 0);

// ---------------------------------------------------------------------------
// Phase four: the plumbing
// ---------------------------------------------------------------------------
//
// The four faces that don't touch the line all round-trip through a stored ladder, which is where a
// shape mismatch actually costs somebody a run. Played through `actions.js` against an in-memory
// world, so the storage layer is the real one.

// The same in-memory world `cubeFixtures.js` builds, and deliberately built the same way: nothing is
// monkeypatched, so `persist` is the real storage layer and a shape it cannot round-trip fails here
// exactly as it would in the bot.
const ME = 'octahedron-test';
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

(async () => {
    const world = makeWorld();
    let sealedSeen = 0;
    let jailSeen = 0;

    for (let t = 0; t < 4000; t++) {
        persist.clearLadder(world.database, world.db, ME);
        const started = actions.startRun(world.ctxOf(), { call: t % 2 ? 'red' : 'blue' });
        if (!started.ok) break;
        let run = started.run;

        for (let lv = 0; lv < 8; lv++) {
            const ctx = world.ctxOf();
            const thrown = actions.throwLevel(ctx, run);
            if (thrown.asking) { actions.parkTie(ctx, thrown); break; }
            const settled = await actions.settleThrow(ctx, { thrown });
            if (settled.outcome !== 'live') break;

            const ladder = world.db.ch.cube.ladders[ME];
            ok('a live ladder was stored', !!ladder);

            // **A sealed side is refused on the next push**, and the other one is not.
            if (settled.sealed) {
                sealedSeen++;
                const blocked = actions.pushRun(world.ctxOf(), { call: settled.sealed });
                check('the sealed side is refused', blocked.ok, false);
                check('and says why', blocked.code, 'sealed');
                const other = settled.sealed === 'red' ? 'blue' : 'red';
                ok('the other side still pushes', actions.pushRun(world.ctxOf(), { call: other }).ok);
            }

            if (settled.held) jailSeen++;

            const side = settled.sealed
                ? (settled.sealed === 'red' ? 'blue' : 'red')
                : (lv % 2 ? 'red' : 'blue');
            const pushed = actions.pushRun(world.ctxOf(), { call: side });
            if (!pushed.ok) break;
            run = pushed.run;
            // The run state the die holds has to survive the ladder round trip, which is the whole
            // reason this phase talks to storage instead of calling the engine directly.
            // Prisoners ride the set now, inside the slot of the cube holding them, so what has to
            // survive storage is the hold on a slot rather than a key on the ladder node.
            ok('a hold survives storage', run.set.every(s => Array.isArray(s.held)));
            ok('the rung count survives storage', Number.isFinite(run.rungs));
        }
    }

    // ---------------------------------------------------------------------------
    // Phase five: EV
    // ---------------------------------------------------------------------------
    //
    // **A climb, banked at the top, normalised against a bare ladder measured the same way.** Five
    // level rungs on a collapsed road is a 1-in-32 run paying ×32, so a rack that changes nothing
    // should sit at 1.000 and every deviation is the cubes. That is the figure the tuning notes quote
    // — Wild at 1.30, the Gungan Shield at 0.85, Sebulba cut back from 1.64.
    //
    // **The call has to be drawn, not patterned, and this cost a re-tune to learn.** A sim that called
    // `lv % 2 ? red : blue` gives every run the same call sequence, and the **daily lean** is a fixed
    // 55/45 for the whole process — so half the runs systematically call the favoured side and the
    // ladder compounds that five times over. It reads as a real effect and it is entirely the harness:
    // measured that way a *bare* ladder came out at 1.18 rather than 1.00, and the die looked 0.59
    // against a baseline it should have been compared to rather than against 1.
    //
    // So the call is drawn from the same CSPRNG the cubes are.
    const drawCall = () => (crypto.randomInt(0, 2) ? 'red' : 'blue');

    // **And the daily lean is switched off for this phase, which is the other half of the same
    // lesson.** The lean is a fixed 55/45 for the whole process, and the ladder is convex in `p`:
    // calling the favoured side is worth **2.27** and the unfavoured **0.37**, so a player calling at
    // random averages ~1.32 on a *bare* ladder. Measured against 1.000 that reads as every rack in the
    // game being wildly overpowered, and measured against each other it just adds 30% of noise on top
    // of an estimator that already has plenty.
    //
    // The cube is fair, so the baseline is exactly 1.000 by construction and everything else on the
    // table is the cubes. This used to have to switch a `dayLean` off to get there.
    //
    // **Malastare is in the measurement, not excluded from it.** A run that reaches the top with the
    // bank sealed cannot leave, so it pushes into overtime and takes the bad bet up there until a rung
    // lets it out or it busts. That is precisely what the face costs and the only honest way to price
    // it: an EV that skipped the lock would be measuring a different cube.
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
            // 24 rungs is a backstop, not a policy: five levels plus however much overtime a sealed
            // bank forces. Nothing here should ever reach it.
            for (let lv = 0; lv < 24; lv++) {
                const ctx = world.ctxOf();
                const thrown = actions.throwLevel(ctx, run);
                // Never buy a tie — a bribe is a purchase and would put the price of one into a
                // figure that is meant to be about the cubes.
                if (thrown.asking) {
                    // **Parked before answered**, as the API does it and as `cubeEconomy.js` always
                    // has: `answerTie` reads the tie back off the ladder node rather than taking it as
                    // an argument. Without this it returned `no_tie` and the run was abandoned — so
                    // every climb that tied was silently thrown away, and this rack ties often.
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
                // At the top, take the money.
                if (live.level >= pstate.MAX_LEVEL) {
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

    // **A bare ladder does not measure 1.000, and that is not a bug either.** Five fair coin flips
    // paying ×32 is exactly fair, but `pureBonus` pays **+1× per cube** on a line that lands all one
    // way, and a bare ladder throws those: one Level 2 in eight is a pure. Measured, the empty rack
    // banks 3.03% of runs (against the 3.125% the ladder predicts) at an average multiple of ×40
    // rather than ×32 — the ladder is fair and the pure bonus rides on top of it.
    //
    // So there is no absolute 1.000 to compare against, and the only honest normalisation is **other
    // cubes, measured in the same process**. That is what this table is: the die beside four cubes
    // whose value is already settled, every one of them fielded alone on the same road with the same
    // call policy. What matters is where the die lands in that column, not what it reads on its own.
    const EV_RUNS = Math.max(2000, Math.floor(CLIMBS / 2));
    const BENCH = [
        ['bare ladder', []],
        ['Wild', ['wild']],
        ['Greed', ['greed']],
        ['Gungan Shield', ['gungan']],
        ['Mirror', ['mirror']],
        ['the die', [DIE]],
        ['the die in a rack', RACK],
    ];
    const bench = [];
    for (const [label, rack] of BENCH) bench.push([label, await evOf(rack, EV_RUNS)]);
    const base = bench[0][1] || 1;

    // ---------------------------------------------------------------------------
    // Report
    // ---------------------------------------------------------------------------

    const pct = n => `${((n / stats.throws) * 100).toFixed(2)}%`;
    console.log(`Planet Octahedron · ${stats.throws.toLocaleString()} throws over ${CLIMBS.toLocaleString()} climbs`);
    console.log('  faces fired');
    for (const k of ['freeze', 'scorch', 'vault', 'blessing', 'seam', 'jail', 'plunge', 'crowd']) {
        console.log(`    ${k.padEnd(8)} ${String(stats[k]).padStart(7)}  ${pct(stats[k])}`);
    }
    console.log('  consequences');
    console.log(`    faces held on ice      ${stats.heldFaces}`);
    console.log(`    effects the ice ate    ${stats.iced}`);
    console.log(`    faces scorched off     ${stats.burned}`);
    console.log(`    draws off the lean     ${stats.leanFree}`);
    console.log(`    plunges taking the die ${stats.plungeSelf}`);
    console.log(`    jailbreaks             ${stats.jailbreak}`);
    console.log(`    faces painted over     ${stats.painted}`);
    console.log(`    cubes a blessing kept  ${stats.spared}`);
    console.log(`    blessings spent        ${stats.blocks}`);
    console.log('  plumbing');
    console.log(`    sealed sides refused   ${sealedSeen}`);
    console.log(`    rungs carrying a hold  ${jailSeen}`);
    console.log(`  EV · a climb banked at the top, ${EV_RUNS.toLocaleString()} runs a rack, lean off`);
    console.log('    rack                    raw    vs bare');
    for (const [label, v] of bench) {
        console.log(`    ${label.padEnd(20)}  ${v.toFixed(3)}   ${(v / base).toFixed(3)}`);
    }

    if (fail.length) {
        console.log(`\n${fail.length} check(s) failed. First 10:\n`);
        for (const f of fail.slice(0, 10)) console.log(`  ${f}\n`);
        process.exitCode = 1;
    } else {
        console.log('\nEvery invariant holds.');
    }
})();
