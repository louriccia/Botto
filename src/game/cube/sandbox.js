// Throwing a line somebody chose, in a world that does not exist.
//
// **What this is for.** The reveal is the part of the Activity that most needs iterating on and the
// part that is most expensive to reach: a face fires when the bag hands you the cube and the cube
// rolls the face, which for half the rack is a run you cannot ask for. `scripts/cubeFixtures.js`
// answers that by playing thousands of runs and keeping the interesting ones — but a fixture is a
// roll that already happened, so the loop is "regenerate the file and hope the shape you wanted
// turned up". This is the other half: name the cubes, name the faces, and watch *that* line resolve.
//
// **Nothing here is playable.** The world is built per request and thrown away with it — a profile
// object, a database whose `ref()` is inert, and a purse that exists only so the stake has something
// to come out of. So the roll settles for real, against a player who does not exist, and the
// caller's own profile is never opened. That is the whole safety argument and it is why this takes
// no `ctx`: there is no path from here to a real balance, because a real balance is never in scope.
//
// **The rules are the real rules.** `relineFrom` and `resolveThrown` are the same two functions a
// parked roll comes back through — see the note above `resolveThrown` — so a forced line resolves
// down the one code path every other line does. A sandbox with its own resolver would be a sandbox
// that agrees with the game right up until it matters.
//
// `scripts/cubeFixtures.js` builds a near-identical world and is left alone rather than made to call
// this one. That is a copy and is expected to drift: it wants a different rack per attempt and holds
// one world across many runs, where this wants a fresh world per request. If the two ever need to
// agree on more than they do now, the seam to cut is a memory-backed store in `persist.js` — which
// owns the paths both of them stand in for — not a script reaching into a server module.

const engine = require('./engine.js');
const actions = require('./actions.js');
const pstate = require('./state.js');
const { rollResponse } = require('./wire.js');
const { SPECIALS, LEVELS, SIDES, PLAIN_FACES } = require('./tuning.js');

const ALL = SPECIALS.map(s => s.id);
const ME = 'sandbox-player';

// Enough that nothing here can ever refuse for being poor, and small enough to read in a log.
// Load-bearing rather than decoration: `startRun` refuses a stake it cannot cover, and `settleThrow`
// puts `balanceOf(profile)` on the wire, so both of them read this.
const PURSE = 1000000000;

// The longest line the caller may name, and the deepest a single position may arrive already stacked.
// Neither is a rule of the game — a real run tops out near nine cubes and `config.overflowAt` bounds
// the resolve queue — they are only what this route is willing to build before it says no.
const MAX_SPOTS = 64;
const MAX_HELD = 24;

// -----------------------------------------------------------------------------
// Coercing what a caller named
// -----------------------------------------------------------------------------

// One spelling for every number a request can carry. Seven hand-tuned clamps is seven chances for
// one of them to fall out of step with the rest, which is how `mult` ended up the only one that was
// not floored — and it still is, because a multiple is the one number here that is legitimately
// fractional. That is now a named option rather than an omission a reader has to notice.
const num = function (v, { min = 0, max = Infinity, def = 0, floor = true } = {}) {
    const n = Number(v) || def;
    return Math.max(min, Math.min(floor ? Math.floor(n) : n, max));
};

// `SIDES` is `tuning.js`', not a local set: the same two colours are already named there, and a
// private second copy is a constant that can disagree with the one the rest of the game reads.
const sideOf = (v, def = null) => (Object.hasOwn(SIDES, v) ? v : def);

// The bag and the hold are the same thing — a list of cube ids, or nothing. This is
// `engine.decodeBag`'s `.map` half with a caller-supplied fallback.
const idsOf = (v, fallback) => (Array.isArray(v) ? v.map(id => (id ? String(id) : null)) : fallback);

// -----------------------------------------------------------------------------
// The world
// -----------------------------------------------------------------------------

// **The world is the ctx.** Everything a run touches arrives through this one object, so there is
// nothing else worth handing back — no handle on the profile or the database is used from outside,
// because no caller outside `throwLine` exists.
//
// `stake` goes in raw. `pstate.cubeState` floors it and holds it inside `[minStake, maxStake]` on
// read, which is the same clamp `/stake` gets, so a second one here could only disagree with
// `tuning.js` rather than add anything.
const makeWorld = function ({ stake, bribe }) {
    const profile = {
        name: 'Sandbox',
        truguts_earned: PURSE,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 4, unlocked: 4, clears: 0, stake,
            cubes: Object.fromEntries(ALL.map(id => [id, true])),
            equipped: ALL,
            // Every pick owned, so nothing the caller asks for is refused for want of a rung. It
            // changes no outcome on this path — none of the picks act on a line that was handed to
            // us already thrown — but `bribe` decides whether a tie is *asked* about or broken by
            // Watto's cube, and both of those are shapes worth being able to reach.
            buyReroll: true, bribe, nudge: true, scrap: true, shuffle: true, split: true,
        },
    };

    // **An inert ref, rather than one that stands in for storage.** `persist.js` writes its
    // in-memory mirror *itself*, and before the database, every time: `writeCube` assigns
    // `profile.cube`, `saveLadder` and `clearLadder` assign and delete `db.ch.cube.ladders[ME]`. So
    // by the time a write reaches here the world already holds exactly what a working fake would
    // have put in it. The version that matched `ladders/(.+)` off the path string was reproducing a
    // mutation that had already happened — and would have gone silently inert the day `persist.js`
    // renamed a path, since `fireAndForget` swallows the trip either way.
    const inert = { update: async () => { }, set: async () => { }, remove: async () => { } };
    inert.child = () => inert;

    // Only `ch.cube.ladders` is ever read — `persist.nodeOf` is this object's sole reader, and
    // nothing on this path looks a user up.
    const db = { ch: { cube: { ladders: {} } } };

    // `w` and `d` are the only transactions the run path issues; a refund is an API-level move that
    // never reaches here.
    const moveTruguts = ({ transaction, amount }) => {
        const n = Math.floor(Number(amount) || 0);
        if (transaction === 'w') profile.truguts_spent += n;
        if (transaction === 'd') profile.truguts_earned += n;
    };

    return {
        db, profile, database: { ref: () => inert }, profileRef: inert,
        discordId: ME, s: pstate.cubeState(profile), moveTruguts,
    };
};

// -----------------------------------------------------------------------------
// What the caller may ask for
// -----------------------------------------------------------------------------

// **One entry per position, rather than the parallel arrays the wire uses.** The wire's shape is
// index-for-index because it is read that way — a client holding `faceIds` subscripts everything
// else off the same number — but nobody *writes* a line that way, and a request with six lists in it
// that have to stay the same length is a request that is wrong more often than it is right.
//
// So: `[{ id, face, frozen, burned, painted, blessed, heat, holds }]`, and this pulls it apart.
//
//   id       which cube stands here, or null/absent for an ordinary one.
//   face     which face it shows. Absent means **roll it** — a position the caller does not care
//            about, which is most of them on a line being built to test one face.
//   frozen   Ando Prime is holding this cube on the face it shows: no turn, no pay.
//   burned   face ids Baroonda has taken off this cube for good.
//   painted  'red' | 'blue' — the crowd's mark on the face showing, which is what it counts for.
//   blessed  Nugtosh's blessing, riding the cube.
//   heat     Turbine heat already on it.
//   holds    how many cubes it is already carrying, as facedown plain cubes.
//
// The special is resolved by the caller and handed in: `relineFrom` looks it up again anyway, and
// there is no reason for this pass to make that a third time.
//
// Not `engine.slotOf`, which is otherwise this exact normalizer: it reads `painted` as a Firebase
// map, so the plain `'red'` a spot carries would decode to `['r', 'e', 'd']`. Paint stays off the
// slot and rides the `relineFrom` state instead, which is where the engine wants it.
const slotFor = function (spot, special) {
    return {
        ...engine.plainSlot(),
        id: special ? special.id : null,
        burned: Array.isArray(spot && spot.burned) ? spot.burned.map(String) : [],
        blessed: !!(spot && spot.blessed),
        heat: num(spot && spot.heat),
        // Facedown plain cubes, which is exactly what a fixture's `holds` replays as and what the
        // board draws for a captive it cannot name.
        held: Array.from({ length: num(spot && spot.holds, { max: MAX_HELD }) }, engine.plainSlot),
    };
};

// -----------------------------------------------------------------------------
// The throw
// -----------------------------------------------------------------------------

// Throws a named line and settles it, and hands back exactly what `POST /cube/roll` hands back.
//
// `level`/`again`/`mult` place the rung, because half of what a reveal draws is a function of where
// it is standing rather than of what is on the table: an Again pays +1 against a base of 32 and
// draws no road movement, Mon Gazza's seam pays off `rungs`, and the count walk builds from
// `opening`. A sandbox pinned to the opening rung could not show any of it.
//
// `bag` and `hold` are the two things a line reaches *off* the table: the Pit Droid draws from the
// first and the Scavenger fetches out of the second. Both default to something rather than to
// nothing, because a droid that always finds an empty bag is a droid nobody can watch work.
exports.throwLine = async function (spec = {}) {
    const spots = Array.isArray(spec.cubes) ? spec.cubes.slice(0, MAX_SPOTS) : [];
    if (!spots.length) return { ok: false, code: 'no_cubes', message: 'Name at least one cube.' };

    const call = sideOf(spec.call, 'blue');
    const level = num(spec.level, { max: engine.MAX_LEVEL });
    const again = num(spec.again);

    // **Whether Watto asks about a tie or breaks it himself**, which is the one thing about this
    // world worth being able to turn off: owning Bribe Ties means every tie is a question, so the
    // shape where his cube actually lands is unreachable while it is on. Defaults to on, because a
    // parked tie is the shape with a panel to draw.
    //
    // One ctx for the whole request, the way `src/api/cube.js` builds one per call. `startRun` moves
    // truguts and clears a ladder but touches nothing `cubeState` derives from, so rebuilding the
    // snapshot after it would compute the same ninety fields a second time to reach the same answer.
    const ctx = makeWorld({ stake: spec.stake, bribe: spec.bribe !== false });

    // Through `startRun` rather than by writing a ladder, so the run descriptor is the one the game
    // makes — a hand-built one is a shape that drifts the first time a field is added to it. It
    // clears the ladder on its way through, which is why nothing does so here.
    const started = actions.startRun(ctx, { call });
    if (!started.ok) return started;

    // **One pass, in the file whose own request format exists to argue against parallel arrays.**
    // The four lists below are index-for-index because `relineFrom` reads them that way, so they are
    // filled together and pulled apart at the single call that wants them, rather than built by four
    // separate traversals that have to be kept the same length by hand.
    //
    // `relineFrom` degrades a face the cube does not carry into a position that counts toward
    // nothing — correct for a stale freeze, wrong here, where it would silently swallow a typo. So a
    // named face the cube cannot show is collected as `bad`, and an unnamed one is rolled off the
    // cube standing there. A plain cube's face list is its six sides, so that roll is `rollSide` by
    // another route and lands on `side:red`/`side:blue` as it should.
    const set = [];
    const faces = [];
    const frozen = [];
    const painted = [];
    const bad = [];
    spots.forEach((spot, at) => {
        // Through `specialById` rather than trusted, so a typo'd cube id is an ordinary cube rather
        // than a special with no faces — which resolves to a position that counts for nobody and
        // reads as the engine having eaten the request.
        const special = spot && spot.id ? engine.specialById(String(spot.id)) : null;
        const slot = slotFor(spot, special);
        const rolled = engine.rollFaces(special, slot);
        const want = spot && spot.face ? String(spot.face) : null;
        if (want && !rolled.some(f => f.id === want)) {
            bad.push({ at, said: `${want} on ${slot.id || 'a plain cube'} at ${at}` });
        }
        const roll = rolled.length ? rolled[Math.floor(Math.random() * rolled.length)] : null;
        set.push(slot);
        faces.push(want || (roll ? roll.id : null));
        frozen.push(!!(spot && spot.frozen));
        painted.push(sideOf(spot && spot.painted));
    });

    if (bad.length) {
        return {
            ok: false,
            code: 'no_such_face',
            message: `Nothing rolls that: ${bad.map(b => b.said).join(', ')}.`,
            at: bad.map(b => b.at),
        };
    }

    const line = engine.relineFrom(set, faces, { frozen, painted });

    // What the run is standing on when this rung is thrown. Patched onto `startRun`'s descriptor
    // rather than replacing it, so every field the game puts there is still there — including the
    // bag it filled, which is discarded on purpose because the caller is allowed to name their own.
    const kind = engine.rungKind(level, again);
    const taken = new Set(set.map(s => s.id).filter(Boolean));
    const run = {
        ...started.run,
        level,
        again,
        mult: num(spec.mult, { floor: false }),
        rungs: num(spec.rungs),
        set,
        // A bag with something in it by default, because the droid is one of the eight faces this is
        // most needed for. Named ids if the caller named them; otherwise whatever a fresh run holds
        // less what is already on the table, which is the honest answer to "what could still arrive".
        bag: idsOf(spec.bag, engine.fillBag(ALL).filter(id => !taken.has(id))),
        // The run's wreckage, for the Jawa to reach into. Ids, which is what the hold holds.
        hold: idsOf(spec.hold, []),
        sealed: sideOf(spec.sealed),
        bet: spec.bet ? String(spec.bet) : null,
    };

    const thrown = actions.resolveThrown(ctx, run, { line, set, bag: run.bag, kind });

    // A tie the player would be *asked* about parks instead of settling, exactly as it does on the
    // real route — the response comes back with no `settled` and the client draws the tie panel. The
    // park writes into the throwaway world, so there is nothing to clean up.
    if (thrown.asking) {
        actions.parkTie(ctx, thrown);
        return { ok: true, roll: rollResponse(thrown, null) };
    }

    const settled = await actions.settleThrow(ctx, { thrown });
    return { ok: true, roll: rollResponse(thrown, settled) };
};

// Everything the sandbox's own picker needs to offer, which is *not* what `/tuning` offers: that is
// the rack a player owns, and this is every cube and every face in the game whether or not anybody
// has one. Faces per cube, because the picker's second column is a function of its first.
// **Counted rather than listed.** A cube carries six faces and several of them share an id — three
// Greeds, three wilds — so the raw list offers the same face three times and says nothing about the
// odds. One entry per distinct id with how many of the six it is, which is both shorter and the thing
// worth knowing.
const countFaces = function (faces) {
    const seen = new Map();
    for (const f of faces || []) {
        const at = seen.get(f.id);
        if (at) at.of += 1;
        else seen.set(f.id, { id: f.id, side: f.side || null, of: 1 });
    }
    return [...seen.values()];
};

// Built once and held. Every input is a `tuning.js` constant that is fixed by the time this module
// loads, so recomputing it per request would be nineteen maps rebuilt to reach the same answer.
let catalogue = null;
exports.catalogue = function () {
    if (!catalogue) {
        catalogue = {
            cubes: SPECIALS.map(sp => ({ id: sp.id, name: sp.name, faces: countFaces(sp.faces) })),
            // The ordinary cube, which has no entry in `SPECIALS` and is half of most lines. Off
            // `PLAIN_FACES` directly — reaching it through `rollFaces(null, plainSlot())` built a
            // slot and went through the heat filter to arrive at a constant.
            plain: countFaces(PLAIN_FACES),
            levels: LEVELS.length,
        };
    }
    return catalogue;
};
