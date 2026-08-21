// Proves the extracted engine (`src/game/cube/engine.js`) resolves a line identically to the
// original that shipped inside `src/interactions/cube/functions.js`, checked out of the commit
// before the port. See REFERENCE_COMMIT below.
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
// **Three engines, not two.** The frozen original, the extracted engine, and the wrapper the bot
// actually loads (`interactions/cube/functions.js`), which dresses the engine back up in emoji and
// prose. All three play the same climb from the same seed:
//
//   original ↔ engine    the rules are unchanged. Faces are mapped through the glyph table to
//                        compare, which checks the id scheme too — if `mult:blue` ever stopped
//                        meaning PraiseMaja, this catches it.
//   original ↔ wrapper   the embed still gets exactly what it always got, compared with no
//                        mapping at all.
//
// The third pass is not redundant. A bulk re-export in the wrapper once silently overwrote its
// Discord-shaped `resolveLine` with the raw engine's, leaving `res.faces` undefined for every
// caller — and the first pass could not see it, because it never loads the file the bot runs.
//
//   node scripts/cubeParity.js [rolls]

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const moment = require('moment');
require('moment-timezone');

// ---------------------------------------------------------------------------
// The reference implementation
// ---------------------------------------------------------------------------
//
// The original engine no longer exists in the working tree — `interactions/cube/functions.js` is
// a thin wrapper over `game/cube/` now, so comparing against it would be comparing the extraction
// against itself and would pass no matter what broke.
//
// So the reference is checked out of the commit **before** the port, written next to where it used
// to live (so its relative requires still resolve), loaded, and deleted. It reads the tuning
// through `data/challenge/cube.js`, which is the shim — and the shim is verified to reproduce the
// original tuning exactly, so the reference behaves as it did the day it was frozen.
const REFERENCE_COMMIT = 'e8228cf1';
const REFERENCE_PATH = 'src/interactions/cube/functions.js';
const tmp = path.join(__dirname, '..', 'src', 'interactions', 'cube', '.parity-reference.js');

let source;
try {
    source = execFileSync('git', ['show', `${REFERENCE_COMMIT}:${REFERENCE_PATH}`],
        { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 1 << 24 });
} catch (err) {
    console.error(`Could not read the reference engine from ${REFERENCE_COMMIT}:${REFERENCE_PATH}`);
    console.error('Without it there is nothing to compare against, so this proves nothing.');
    process.exit(2);
}
fs.writeFileSync(tmp, source);
process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (e) { /* already gone */ } });

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

// **The daily lean is a deliberate divergence that needs a stub rather than an exemption.**
//
// `dayLean` is gone: `rollSide` is a fair coin now, drawn as one `chance(0.5) ? 'blue' : 'red'`. The
// frozen engine still leans — it hashes `CUBE_LEAN_SALT` with the date for a favoured side, then draws
// `chance(config.dayLean)` to decide whether to use it. Both spend exactly one random value per cube,
// so the streams stay aligned; the only thing that differs is which colour a given draw names.
//
// So the reference is pinned rather than excused. A salt is chosen here that makes **today's** favoured
// side blue, and `dayLean` is put back on the shim's config at the one value that is not a lean. The
// frozen engine then draws `chance(0.5) ? 'blue' : 'red'` — the current `rollSide`, expression for
// expression — and every other rule it carries goes on being compared honestly.
//
// Excusing it instead would have retired the roll phase altogether: a favoured side that disagrees with
// blue inverts every plain cube, which is not a divergence anyone could read past.
const day = moment().tz('America/New_York').format('YYYY-DDDD');
let pin = 0;
while (crypto.createHash('sha256').update(`parity-${pin}:${day}`).digest()[0] % 2) pin += 1;
process.env.CUBE_LEAN_SALT = `parity-${pin}`;

const orig = require('../src/interactions/cube/.parity-reference.js');
// The shim **copies** the tuning (`{ ...tuning.cube, ...RENDER }`), so this has to be set on the shim's
// own object and after the reference has pulled it in, not on the tuning it was copied from.
require('../src/data/challenge/cube.js').cube.dayLean = 0.5;
const engine = require('../src/game/cube/engine.js');
// The file the bot actually loads: the engine with Discord's clothes on.
const wrapper = require('../src/interactions/cube/functions.js');
const pstate = require('../src/game/cube/state.js');
const { faceGlyph } = require('../src/data/discord/cube_emoji.js');
const { renderNote, renderNotes } = require('../src/data/discord/cube_notes.js');
const { SPECIALS, cube: tuningConfig } = require('../src/game/cube/tuning.js');

const ROLLS = Number(process.argv[2]) || 50000;

// **The Planet Octahedron is the third deliberate divergence, and the plainest of them.** It did not
// exist at the reference commit, so the frozen engine has no `octahedron` in `SPECIALS` and would throw
// it as an ordinary cube — which is not a divergence in the rules, it is a cube the proof cannot be
// about. This gate says *the ported rules resolve a line identically*, and a cube added afterwards is
// outside that claim by construction. Its own coverage is `scripts/cubeOctahedron.js`.
//
// Everything else about it is still exercised here: the slot representation goes through every roll
// below, because a set of untouched slots is what a rack without this cube produces.
const ALL = SPECIALS.map(s => s.id).filter(id => id !== 'octahedron');

// ---------------------------------------------------------------------------
// Phase one: player state
// ---------------------------------------------------------------------------
//
// `cubeState` reads a stored profile and every other function in state.js mutates what it
// returned. Both halves are compared against the original across a spread of profiles — empty,
// partial, maxed, and deliberately malformed — because the clamping on read is what stops a
// profile saved under older rules from fielding an extra cube or an oversized stake.

const profiles = [];
// Nothing stored at all: a player who has just unlocked the collection.
profiles.push({});
profiles.push({ cube: {} });
for (let p = 0; p <= 9; p++) {
    for (let owned = 0; owned <= ALL.length; owned++) {
        profiles.push({
            cube: {
                prestige: p,
                unlocked: p % 6,
                clears: p % 4,
                slots: 1 + (p % 4),
                cubes: Object.fromEntries(ALL.slice(0, owned).map(id => [id, true])),
                equipped: ALL.slice(0, Math.min(owned, 3)),
                stake: [0, 50, 1000, 999999999][p % 4],
                rerolls: p % 5,
                buyReroll: p % 2 === 0,
                nudge: p % 3 === 0,
                bribe: p % 3 === 1,
                bribes: p % 4,
                calls: { blue: p * 7, red: p * 3 },
                wins: { blue: p * 2, red: p },
                rolled: { blue: p * 11, red: p * 9 },
                faces: { wild: { wild: p, end: 1 } },
                bestLevel: p % 6,
                bestStanding: p * 1000,
                bestCubes: p * 3,
                bestMultiple: p * 2.5,
                streak: p,
                bestStreak: p * 2,
                totalWon: p * 100,
                totalLost: p * 50,
                totalSpent: p * 10,
                turn: p,
            },
        });
    }
}
// Deliberately malformed: values that a hand-edited or migrated profile could actually hold.
profiles.push({ cube: { prestige: -3, unlocked: 99, slots: -1, stake: 'x', cubes: { nope: true } } });
profiles.push({ cube: { equipped: { 0: 'wild', 1: 'ghost' }, cubes: { wild: true }, slots: 0 } });
profiles.push({ cube: { calls: null, wins: 'x', rolled: undefined, faces: 'not an object' } });

const stateFailures = [];
const stateSame = function (label, got, want) {
    try {
        assert.deepStrictEqual(got, want);
    } catch (err) {
        if (stateFailures.length < 8) {
            stateFailures.push(`${label}\n    new: ${JSON.stringify(got)}\n    old: ${JSON.stringify(want)}`);
        }
    }
};

// **Build tokens are the one deliberate divergence from the frozen original.**
//
// The original made prestiging and picking a reward the same call; a point is what decouples them,
// so there is no field to compare `points` against and no way for the old engine to grow one. It is
// asserted on its own below and then taken off both sides — never simply ignored, or a counter this
// far from the money could drift unnoticed.
//
// **The press and the board add five more of the same kind.** `weldRerollCost` is a derived price,
// `weldSeen` the press memory, `pressTier`/`pressCubes` how far up the press has been bought, `week`
// this week's bests for the board, and `faceProgress` a summary over the face tallies. None of them
// existed at the reference commit and none can be grown by an engine with no press and no board.
// Every one is asserted on its own below.
const NEW_KEYS = ['points', 'weldRerollCost', 'weldSeen', 'pressTier', 'pressCubes', 'week', 'month', 'faceProgress', 'ties'];
const noPoints = function (s) {
    const out = { ...s };
    for (const k of NEW_KEYS) delete out[k];
    return out;
};

// **The rack is the second deliberate divergence, and it is handled exactly like the first.**
//
// The reference caps a loadout at a per-profile `slots` count, bought one prestige at a time off a
// `+1 Special Cube Slot` pick. The cap survived and the purchase didn't: `slots` is now `bagSize()` on
// every profile there has ever been, `equipped` is trimmed to that rather than to a stored number, and
// `rewardChoices` no longer sells the difference. Comparing any of that against the frozen engine would
// be asserting the rule this change exists to remove — the harness would be pinning the bug.
//
// So the two affected keys come off both sides and are asserted **on their own** against the new rule,
// below. Never simply dropped: the loadout is still the thing that decides which cubes reach a line,
// which is as close to the money as anything in this file.
const noRack = function (s) {
    const out = noPoints(s);
    delete out.slots;
    delete out.equipped;
    return out;
};

profiles.forEach((profile, n) => {
    // Each engine gets its own copy: these functions mutate what they are handed.
    const a = orig.cubeState(JSON.parse(JSON.stringify(profile)));
    const b = pstate.cubeState(JSON.parse(JSON.stringify(profile)));
    stateSame(`profile ${n} · cubeState points`, b.points, Math.max(0, Math.floor(Number(profile.cube?.points) || 0)));
    stateSame(`profile ${n} · cubeState`, noRack(b), noRack(a));

    // The press, asserted against its own rules rather than against an engine that has no press.
    // The price is derived from the ceiling and nothing else; the memory is read defensively, so a
    // profile that never touched a weld reads back an empty object rather than undefined.
    stateSame(`profile ${n} · weld reroll price`, b.weldRerollCost, pstate.weldRerollCostFor(b.prestige));
    stateSame(`profile ${n} · weld memory is an object`, typeof b.weldSeen, 'object');
    stateSame(`profile ${n} · weld memory holds only string lists`,
        Object.values(b.weldSeen).every(v => Array.isArray(v) && v.every(x => typeof x === 'string')), true);

    // The press ladder, clamped on read: a hand-edited profile must not be able to field a tier the
    // data has no cuts for, and `pressCubes` is a pure function of the tier rather than a second fact.
    const wanted = Math.max(0, Math.min(tuningConfig.weldTiers.length,
        Math.floor(Number(profile.cube?.pressTier) || 0)));
    stateSame(`profile ${n} · press tier is clamped`, b.pressTier, wanted);
    stateSame(`profile ${n} · press cubes follow the tier`, b.pressCubes, wanted >= 3 ? 3 : 2);
    stateSame(`profile ${n} · the press is offered until it is bought`,
        pstate.rewardChoices(b).some(c => c.kind === 'press'), wanted < tuningConfig.weldTiers.length);

    // This week's bests read back under the current key or as zeroes — never as last week's numbers.
    stateSame(`profile ${n} · the week is current`, b.week.id, pstate.weekKey());
    stateSame(`profile ${n} · a stale week reads as nothing`,
        profile.cube?.week?.id === b.week.id ? true : b.week.multiple === 0 && b.week.cubes === 0,
        true);

    // **The collection is one entry per distinct face, not per cube-face pair** — a mine sits on four
    // cubes and a wipeout on six, and the number worth showing is how often a face has landed at all.
    // So the count is summed across every cube carrying it, and `owned` means *some* cube of yours
    // does, which is the difference between a face that has not turned up and one that cannot.
    const distinct = new Set(SPECIALS.flatMap(sp => (sp.faces || []).map(f => f.id)));
    stateSame(`profile ${n} · every distinct face is listed once`,
        b.faceProgress.length, distinct.size);
    stateSame(`profile ${n} · and none of them twice`,
        new Set(b.faceProgress.map(f => f.id)).size, b.faceProgress.length);
    // `owned` is about the rack, **not** about the tally. A stored count can name a cube the profile
    // does not list — a hand-edited profile does exactly that, and so does history from before a
    // cube's id changed — so a face can have landed without being carried by anything owned today.
    // Asserting otherwise made this harness demand the count be thrown away, which is the opposite of
    // what a lifetime tally is for.
    stateSame(`profile ${n} · owned means some cube of yours carries it`,
        b.faceProgress.every(f => f.owned === SPECIALS.some(sp => b.cubes.includes(sp.id)
            && (sp.faces || []).some(x => x.id === f.id))), true);
    // Summed rather than sampled: the stored tally is per cube, so a face on two owned cubes has to
    // report both. Recomputed here from the raw profile rather than trusting the same code twice.
    const summed = function (id) {
        let total = 0;
        for (const sp of SPECIALS) {
            if (!(sp.faces || []).some(f => f.id === id)) continue;
            total += Number(profile.cube?.faces?.[sp.id]?.[id]) || 0;
        }
        return total;
    };
    stateSame(`profile ${n} · counts are summed across every cube carrying the face`,
        b.faceProgress.every(f => f.n === summed(f.id)), true);

    // Ties are read defensively and clamped, like every other tally a profile written before them
    // has none of. `total` is the sum of the three settlement paths and nothing else — a tie is
    // settled exactly one way, so anything that does not add up is a double count somewhere.
    stateSame(`profile ${n} · tie counts are whole and non-negative`,
        Object.values(b.ties).every(v => Number.isInteger(v) && v >= 0), true);
    stateSame(`profile ${n} · his cube's colours sum to his cube's ties`,
        b.ties.blue + b.ties.red <= b.ties.rolled, true);
    stateSame(`profile ${n} · only his cube's ties can be won or lost`,
        b.ties.won <= b.ties.rolled, true);

    // The month window follows the same rules as the week: current key, or nothing.
    stateSame(`profile ${n} · the month is current`, b.month.id, pstate.monthKey());

    // The loadout, asserted against the rule rather than against the old engine: everything stored
    // that is actually owned, in stored order, cut to the bag. The **stored** `slots` is still not read
    // — a profile carrying one from the days when the cap was bought reads back the same as one that
    // never had it — and the `slots` that comes back out is the ladder's constant, identical on every
    // profile in this list.
    stateSame(`profile ${n} · cubeState equipped is owned, ordered and capped`, b.equipped,
        Object.values(profile.cube?.equipped || {})
            .filter(id => b.cubes.includes(id))
            .slice(0, engine.bagSize()));
    // Constant across every profile in this list, including the ones storing `slots: 1` and
    // `slots: -1` — which is the whole claim: the cap is the ladder's, not the profile's.
    stateSame(`profile ${n} · cubeState reports the bag as the cap`, b.slots, engine.bagSize());

    // Pricing, which the ceiling and the shop both read off.
    stateSame(`profile ${n} · maxStakeFor`, pstate.maxStakeFor(a.prestige), orig.maxStakeFor(a.prestige));
    stateSame(`profile ${n} · rerollCostFor`, pstate.rerollCostFor(a.prestige, a.rerolls), orig.rerollCostFor(a.prestige, a.rerolls));
    // **A deliberate divergence, like the octahedron and the three cubes.** The reference prices a
    // bribe at a flat quarter of the standing; this engine prices it off the lean the tie is actually
    // settled by, because a quarter against a 45–60% chance of losing the lot was free money twice per
    // prestige. So the shape is asserted here rather than the number: the price still steps with the
    // count, and it now sits above what the tie risks instead of a third of it. See `bribeEdge`.
    stateSame(`profile ${n} · bribeCostFor steps with the count`,
        pstate.bribeCostFor(16000, a.bribes, false) > pstate.bribeCostFor(16000, Math.max(0, a.bribes - 1), false)
            || a.bribes === 0,
        true);
    stateSame(`profile ${n} · bribeCostFor covers what the tie risks`,
        pstate.bribeCostFor(16000, 0, false) >= Math.floor(16000 * tuningConfig.tieLean),
        true);
    stateSame(`profile ${n} · bribeCostFor covers what a nudged tie risks`,
        pstate.bribeCostFor(16000, 0, true) >= Math.floor(16000 * (1 - tuningConfig.nudgeLean)),
        true);
    stateSame(`profile ${n} · clearsPerLevel`, pstate.clearsPerLevel(a), orig.clearsPerLevel(a));
    stateSame(`profile ${n} · goalOf`, pstate.goalOf(a), orig.goalOf(a));
    stateSame(`profile ${n} · canPrestige`, pstate.canPrestige(a), orig.canPrestige(a));
    stateSame(`profile ${n} · topOf`, pstate.topOf(a), orig.topOf(a));

    // The reward menu, minus the emoji the original attached — that is the presentation this
    // split exists to remove, so it is checked by the glyph table rather than here.
    //
    // **Two entries come off both sides, and they are the two deliberate divergences above wearing
    // their menu clothes.** The `slot` entry is off the reference side because the cap it bought no
    // longer exists; `cube:octahedron` is off it because `OFF_RACK` did not exist at the reference
    // commit, so the frozen engine happily offers a cube that is earned by collecting eight planet
    // faces rather than bought with a prestige. Neither is a divergence in the ported rules — one is
    // a rule deleted on purpose and the other is a cube the proof cannot be about, exactly as the
    // note on `ALL` says. Everything else about the list, including the order the cubes and perks
    // come in, still has to match.
    //
    // Both are then asserted **on their own** against the new rule, because a list that quietly
    // stopped offering something is the failure this strip could otherwise hide.
    // `press` joins them for the same reason: the frozen engine has no press to sell, so its absence
    // from the old list is the feature rather than a divergence. Asserted on its own below.
    const OFF_MENU = new Set(['slot', 'cube:octahedron', 'press']);
    // **Qui-Gon's Nudge is a fourth deliberate divergence, and the smallest: only its sentence moved.**
    // The pick used to reuse `tieLean` reversed, so taking it turned a 40/60 tie into a 60/40 one and the
    // copy quoted his number back. `nudgeLean` gives it a weight of its own, so the promise is now 55/45
    // and the frozen engine has no field that could ever say so.
    //
    // The **entry** still has to be there, in the same position, with the same label — that is what this
    // comparison is for and none of it is allowed to move. So the description is blanked on both sides
    // rather than the row being dropped, and the new copy is asserted on its own below, because a
    // description that quietly went back to quoting `tieLean` is exactly the regression this could hide.
    const RECOPIED = new Set(['nudge']);
    const strip = o => o.map(x => ({
        value: x.value,
        label: x.label,
        description: RECOPIED.has(x.value) ? null : x.description,
    })).filter(x => !OFF_MENU.has(x.value));
    stateSame(`profile ${n} · rewardChoices`, strip(pstate.rewardChoices(b)), strip(orig.rewardChoices(a)));
    stateSame(`profile ${n} · rewardChoices offers no slot`,
        pstate.rewardChoices(b).some(c => c.value === 'slot'), false);
    stateSame(`profile ${n} · rewardChoices offers no octahedron`,
        pstate.rewardChoices(b).some(c => c.value === 'cube:octahedron'), false);
    const nudgeOffer = pstate.rewardChoices(b).find(c => c.value === 'nudge');
    if (nudgeOffer) {
        const pct = Math.round(tuningConfig.nudgeLean * 100);
        stateSame(`profile ${n} · the Nudge quotes nudgeLean, not tieLean`, nudgeOffer.description,
            `Watto's tie-breaker leans ${pct}/${100 - pct} your way instead of his.`);
    }

    // Every mutator, each on its own fresh pair so one can't contaminate the next.
    const pairOf = () => [orig.cubeState(JSON.parse(JSON.stringify(profile))),
        pstate.cubeState(JSON.parse(JSON.stringify(profile)))];

    let [x, y] = pairOf();
    let px = {}; let py = {};
    stateSame(`profile ${n} · awardClear`, pstate.awardClear(y, py), orig.awardClear(x, px));
    stateSame(`profile ${n} · awardClear patch`, py, px);
    stateSame(`profile ${n} · awardClear state`, noRack(y), noRack(x));

    // Prestige-then-spend against the old prestige-with-a-reward. The composition has to land in
    // exactly the state the single call used to, which is what proves the split changed the *timing*
    // of the pick and nothing about what it grants: the point is banked and immediately spent, so it
    // nets back to the balance it started at.
    // `slot` is off the list, because it is off the rack — there is nothing left for the reference to
    // be compared against on that one. The cube rewards stay, with the rack keys stripped: the
    // reference equips a granted cube only if a slot was free under a cap it sold, and this equips it
    // if there is a seat under a cap every rack shares. Asserted directly underneath.
    for (const reward of ['reroll', 'nudge', 'bribe', 'cube:wild', 'cube:greed', 'cube:nope']) {
        [x, y] = pairOf();
        px = {}; py = {};
        const held = y.points;
        orig.applyPrestige(x, px, reward);
        pstate.applyPrestige(y, py);
        stateSame(`profile ${n} · applyPrestige banks a point`, y.points, held + 1);
        pstate.spendPoint(y, py, reward);
        stateSame(`profile ${n} · spendPoint(${reward}) nets the point back`, y.points, held);
        stateSame(`profile ${n} · prestige+spend(${reward}) patch`, noRack(py), noRack(px));
        stateSame(`profile ${n} · prestige+spend(${reward}) state`, noRack(y), noRack(x));
    }

    // A granted cube lands on the table if there is a seat for it, and stays owned either way. The
    // complaint the reward half of this came out of was a pick that reported success and quietly did
    // nothing — so the only case where it may arrive benched is the one where fielding it would have
    // had to throw off a cube the player chose.
    [x, y] = pairOf();
    py = {};
    if (!y.cubes.includes('boost')) {
        const room = y.equipped.length < engine.bagSize();
        pstate.spendPoint(y, py, 'cube:boost');
        stateSame(`profile ${n} · a granted cube is owned`, y.cubes.includes('boost'), true);
        stateSame(`profile ${n} · a granted cube takes a free seat`,
            y.equipped.includes('boost'), room);
        stateSame(`profile ${n} · a granted cube is equipped in the patch`,
            (py.equipped || []).includes('boost'), room);
        stateSame(`profile ${n} · a granted cube never displaces one`,
            y.equipped.length <= engine.bagSize(), true);
    }

    // Nothing on the rack raises the cap, because the cap is the bag and the bag is not for sale.
    // Spending on every entry still on offer must leave `slots` exactly where it started.
    [x, y] = pairOf();
    py = {};
    for (const c of pstate.rewardChoices(y)) pstate.spendPoint(y, py, c.value);
    stateSame(`profile ${n} · spending the whole rack raises no cap`, y.slots, engine.bagSize());
    stateSame(`profile ${n} · spending the whole rack overfills nothing`,
        y.equipped.length <= engine.bagSize(), true);

    [x, y] = pairOf();
    px = {}; py = {};
    // Asserted against the rule instead of the reference, which trimmed to a `slots` it sold.
    // Duplicates collapse, `ghost` is not a cube and unowned ids are dropped — and what survives that
    // is cut to the bag.
    const ids = ['greed', 'wild', 'wild', 'ghost', 'mirror', 'binder'];
    const want = [...new Set(ids)].filter(id => y.cubes.includes(id)).slice(0, engine.bagSize());
    stateSame(`profile ${n} · setLoadout`, pstate.setLoadout(y, py, ids), want);
    stateSame(`profile ${n} · setLoadout patch`, py, { equipped: want });
    stateSame(`profile ${n} · setLoadout never exceeds the bag`,
        y.equipped.length <= engine.bagSize(), true);

    [x, y] = pairOf();
    px = {}; py = {};
    const roll = { call: 'blue', won: n % 2 === 0, cubes: ['blue', 'red', 'blue'], level: n % 5, standing: n * 500, line: n % 13, multiple: (n % 9) * 1.5 };
    // **`streak` is a fifth deliberate divergence, and it is a record the frozen engine never reported.**
    // It tracked `bestStreak` and moved it, but told nobody — so the client could badge a record multiple
    // and a record line and had no way to badge the third. Off both sides and asserted on its own below,
    // which is the same treatment `slots`, `points`, `press` and the Nudge's copy get.
    // **Read before either engine runs.** `recordRoll` moves `streak` and `bestStreak` on the state it
    // is handed, so asking the state afterwards what the streak *was* gets the answer it has become —
    // which is how the first version of this check managed to disagree with correct code.
    const wasStreak = y.streak;
    const wasBest = y.bestStreak;
    const got = pstate.recordRoll(y, py, roll);
    const { streak: gotStreak, ...gotRest } = got;
    stateSame(`profile ${n} · recordRoll`, gotRest, orig.recordRoll(x, px, roll));
    // A won roll takes the streak to `was + 1`; the record is whether that beat the stored best. A lost
    // roll zeroes it, and zero is never a record.
    stateSame(`profile ${n} · recordRoll flags a streak record`,
        gotStreak, roll.won && (wasStreak + 1) > wasBest);
    // `week` comes off the patch for the same reason it comes off the state: the frozen engine files
    // no weekly bests and cannot grow a key for them. Asserted on its own immediately below, against
    // the roll that was just recorded — which is a stronger check than comparing it to nothing.
    const { week, month, ...pyRest } = py;
    stateSame(`profile ${n} · recordRoll patch`, pyRest, px);
    if (week) {
        stateSame(`profile ${n} · the week filed is this one`, week.id, pstate.weekKey());
        stateSame(`profile ${n} · the week holds the roll's own numbers`,
            week.multiple >= roll.multiple && week.cubes >= roll.line, true);
    }
    stateSame(`profile ${n} · recordRoll state`, noRack(y), noRack(x));

    [x, y] = pairOf();
    px = {}; py = {};
    const log = [{ id: 'wild', key: 'wild' }, { id: 'wild', key: 'end' }, { id: 'greed', key: 'greed' }];
    orig.recordFaces(x, px, log);
    pstate.recordFaces(y, py, log);
    stateSame(`profile ${n} · recordFaces patch`, py, px);
    stateSame(`profile ${n} · recordFaces state`, noRack(y), noRack(x));

    for (const fn of ['recordWon', 'recordLost', 'recordSpent', 'unrecordLost']) {
        [x, y] = pairOf();
        px = {}; py = {};
        orig[fn](x, px, 1234);
        pstate[fn](y, py, 1234);
        stateSame(`profile ${n} · ${fn} patch`, py, px);
        stateSame(`profile ${n} · ${fn} state`, noRack(y), noRack(x));
    }

    [x, y] = pairOf();
    px = {}; py = {};
    orig.addReroll(x, px, 3);
    pstate.addReroll(y, py, 3);
    stateSame(`profile ${n} · addReroll`, py, px);
    orig.addBribe(x, px);
    pstate.addBribe(y, py);
    stateSame(`profile ${n} · addBribe`, py, px);
});

if (stateFailures.length) {
    console.log(`Player state diverged across ${profiles.length} profiles:\n`);
    stateFailures.forEach(f => console.log(`  ${f}\n`));
    process.exit(1);
}
console.log(`Player state matches across ${profiles.length} profiles.`);

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

// A set of **slots** flattened back to the bare ids the reference engine deals in.
//
// The set grew from `['wild', null]` to a list of objects when the Planet Octahedron needed somewhere
// to hang a cube's scorch marks and its ice. On a rack without that cube nothing ever writes either,
// so the two representations describe the same table and this is the whole of the translation.
//
// **Deliberately not a blanket unwrap.** A slot carrying state would compare equal to a bare id under
// a lazier version of this, which would let a real divergence through — so any set entry with
// anything on it is left as the object it is, and fails loudly against the reference's `null`.
const asIds = set => (set || []).map((x) => {
    if (!x || typeof x !== 'object') return x || null;
    if ((x.burned && x.burned.length) || x.frozen) return x;
    return x.id || null;
});

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
    // **Rack size cycles 0..`bagSize()`, which is every rack there is.** The cap makes the ceiling the
    // frozen reference happened to share with this engine the only ceiling either of them has, so the
    // whole legal range is compared rather than a slice of it.
    //
    // Above it the two were never comparable anyway: the reference *cut* a longer rack down, spending
    // an extra `shuffle` to pick which cubes survived, so a mismatch up there would have said nothing
    // about whether either was correct. Nothing can get up there now — see the cap phase at the bottom,
    // which asserts that at each of the three places a loadout is written.
    const rackSize = i % (Math.min(ALL.length, engine.bagSize()) + 1);
    const rack = ALL.slice(0, rackSize);
    const top = i % 5;
    const call = i % 2 ? 'red' : 'blue';

    seed(i + 1);
    const a = climb(orig, rack, top, call);
    seed(i + 1);
    const b = climb(engine, rack, top, call);
    // The embed's wrapper, played identically. Compared **without** any mapping, because it is
    // supposed to produce exactly what the original produced — emoji and finished prose.
    //
    // This third pass exists because the first two could not see a real bug: the wrapper's
    // Discord-shaped `resolveLine` was being silently overwritten by a bulk re-export of the raw
    // engine, so `res.faces` was undefined for every caller. Comparing the engine to the original
    // proved nothing about the file the bot actually loads.
    seed(i + 1);
    const c = climb(wrapper, rack, top, call);

    let bad = false;
    if (!same(i, 'level count', b.length, a.length)) { bad = true; }
    if (!same(i, 'wrapper level count', c.length, a.length)) { bad = true; }

    for (let lv = 0; lv < Math.min(a.length, c.length); lv++) {
        const A = a[lv].res;
        const C = c[lv].res;
        const w = f => `L${lv} wrapper ${f}`;
        if (!same(i, w('rolled'), c[lv].rolled, a[lv].rolled)) bad = true;
        if (!same(i, w('faces'), C.faces, A.faces)) bad = true;
        if (!same(i, w('notes'), C.notes, A.notes)) bad = true;
        if (!same(i, w('steps.length'), C.steps.length, A.steps.length)) bad = true;
        for (let s = 0; s < Math.min(A.steps.length, C.steps.length); s++) {
            if (!same(i, w(`steps[${s}].faces`), C.steps[s].faces, A.steps[s].faces)) bad = true;
            if (!same(i, w(`steps[${s}].note`), C.steps[s].note, A.steps[s].note)) bad = true;
            if (!same(i, w(`steps[${s}].at`), C.steps[s].at, A.steps[s].at)) bad = true;
        }
        const wmA = orig.multSteps(2, A.pays, A.majority);
        const wmC = wrapper.multSteps(2, C.pays, C.majority);
        if (!same(i, w('multSteps.length'), wmC.length, wmA.length)) bad = true;
        for (let m = 0; m < Math.min(wmA.length, wmC.length); m++) {
            if (!same(i, w(`multSteps[${m}].note`), wmC[m].note, wmA[m].note)) bad = true;
            if (!same(i, w(`multSteps[${m}].multiple`), wmC[m].multiple, wmA[m].multiple)) bad = true;
        }
        for (const f of ['cubes', 'set', 'majority', 'pure', 'swept', 'mult', 'mults',
            'rerolls', 'broken', 'ended', 'specials', 'faceLog']) {
            if (!same(i, w(f), f === 'set' ? asIds(C[f]) : C[f], A[f])) bad = true;
        }
        // Shortcuts pay per face and the reference only ever flagged that one had, so the most this
        // can still prove is that the same lines pay something.
        if (!same(i, w('shortcut'), C.shortcuts > 0, A.shortcut)) bad = true;
    }

    for (let lv = 0; lv < Math.min(a.length, b.length); lv++) {
        const A = a[lv].res;
        const B = b[lv].res;
        const w = f => `L${lv} ${f}`;

        // The line as thrown, before anything resolved.
        if (!same(i, w('rolled'), asGlyphs(b[lv].rolled), a[lv].rolled)) bad = true;
        // The line as resolved — the one that gets paid on.
        if (!same(i, w('faces'), asGlyphs(B.faceIds), A.faces)) bad = true;

        for (const f of ['cubes', 'set', 'majority', 'pure', 'swept', 'mult', 'mults',
            'rerolls', 'broken', 'ended', 'specials', 'faceLog']) {
            if (!same(i, w(f), f === 'set' ? asIds(B[f]) : B[f], A[f])) bad = true;
        }
        if (!same(i, w('shortcut'), B.shortcuts > 0, A.shortcut)) bad = true;

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

        // **The notes, rendered back to prose and compared character for character.** This is the
        // completeness check on the structured note schema: if a kind ever forgot to carry a
        // count, a side or a source face, the sentence it produces would differ from the one the
        // original wrote, and nothing else in this script would notice.
        if (!same(i, w('notes'), renderNotes(B.notes), A.notes)) bad = true;

        // The steps carry their own note, and the reveal draws that one rather than the list.
        for (let s = 0; s < Math.min(A.steps.length, B.steps.length); s++) {
            if (!same(i, w(`steps[${s}].note`), renderNote(B.steps[s].note), A.steps[s].note)) bad = true;
        }

        // The multiplier walk replayed, which is where `multSteps` is exercised at all.
        const msA = orig.multSteps(2, A.pays, A.majority);
        const msB = engine.multSteps(2, B.pays, B.majority);
        if (!same(i, w('multSteps.length'), msB.length, msA.length)) bad = true;
        for (let m = 0; m < Math.min(msA.length, msB.length); m++) {
            if (!same(i, w(`multSteps[${m}].multiple`), msB[m].multiple, msA[m].multiple)) bad = true;
            if (!same(i, w(`multSteps[${m}].paid`), msB[m].paid, msA[m].paid)) bad = true;
            if (!same(i, w(`multSteps[${m}].note`), renderNote(msB[m].note), msA[m].note)) bad = true;
        }

        // Invariants worth asserting on their own, because they are the contracts the port most
        // easily breaks and they hold regardless of what the old engine did.
        if (B.cubes.length > B.faceIds.length) record(i, w('invariant'), 'cubes longer than faceIds', '');
        if (B.set.length > B.faceIds.length) record(i, w('invariant'), 'set longer than faceIds', '');
        if (B.faceIds.some(x => !x)) record(i, w('invariant'), 'empty face id in line', '');
        // **A mine never survives onto a resolved line**, because it goes with its own blast.
        //
        // This assertion used to read "the run ends if and only if Ratts is visible", which was the
        // invariant while he stayed put in his own crater — and it made his position the one place on
        // the line the blast could not reach. It became false the day the blast started taking him too,
        // and went on failing on every single detonation, which is a stale assertion rather than a
        // divergence: it was checking a rule the engine had deliberately replaced.
        if (B.faceIds.includes('end')) record(i, w('invariant'), 'a mine survived onto the resolved line', '');
        // What replaced it. The run ends when there is nothing left on the table, so an ending and a
        // standing position are mutually exclusive — a shielded blast survives precisely because the
        // shield it was stopped by is still there.
        if (B.ended && B.faceIds.length) {
            record(i, w('invariant'), `ended with ${B.faceIds.length} positions standing`, '');
        }

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

// ---------------------------------------------------------------------------
// The cap
// ---------------------------------------------------------------------------
//
// Racks bigger than the bag, which are no longer a thing a player can field. This used to be the
// overflow phase, playing a rack of nine-plus through the engine and the wrapper and proving they
// agreed about a bench that no level could reach. **The bench is gone**: `equipped` is capped at
// `bagSize()` where it is written, where a reward grants a cube and again where a profile is read, so
// every cube on a rack is a cube the climb will meet.
//
// There is nothing to compare against the frozen reference here — it capped at a `slots` it sold — so
// this asserts the rule at each place a loadout could grow past the bag, plus the defensive cut in
// `fillBag` that catches a hand-edited profile getting past all three.
let capChecked = 0;
const bigRacks = ALL.length > engine.bagSize();
if (bigRacks) {
    const everything = Object.fromEntries(ALL.map(id => [id, true]));
    for (let i = 0; i < Math.max(40, Math.floor(ROLLS / 10)); i++) {
        const rack = ALL.slice(0, engine.bagSize() + 1 + (i % (ALL.length - engine.bagSize())));

        // 1. The read. A profile written when the loadout was uncapped comes back fielding the first
        //    `bagSize()` of what it stored — kept, in order, not rejected and not reshuffled.
        const s = pstate.cubeState({ cube: { cubes: everything, equipped: rack } });
        if (!same(`cap ${i}`, 'a stored overflow reads back cut to the bag',
            s.equipped, rack.slice(0, engine.bagSize()))) mismatched++;
        if (!same(`cap ${i}`, 'the overflow is still owned',
            rack.every(id => s.cubes.includes(id)), true)) mismatched++;

        // 2. The write. Same cut, from the other direction.
        const patch = {};
        if (!same(`cap ${i}`, 'setLoadout cuts an over-long list',
            pstate.setLoadout(s, patch, rack), rack.slice(0, engine.bagSize()))) mismatched++;

        // 3. The bag. Never longer than the levels can draw, whatever it is handed.
        seed(10_000 + i);
        const bag = engine.fillBag(rack);
        if (!same(`cap ${i}`, 'the bag is the bag', bag.length, engine.bagSize())) mismatched++;
        if (!same(`cap ${i}`, 'a full rack leaves no plain padding',
            bag.filter(x => !x).length, 0)) mismatched++;
        if (!same(`cap ${i}`, 'every cube in the bag came off the rack',
            bag.every(id => rack.includes(id)), true)) mismatched++;
        capChecked++;
    }
}

console.log(`Compared ${compared} resolved lines across ${ROLLS} climbs.`);
console.log(`  ended ${stats.ended} · shattered ${stats.broken} · ties ${stats.ties} · pures ${stats.pures}`);
console.log(`  effect steps ${stats.steps} · paying faces ${stats.pays} · longest line ${stats.longest}`);
console.log(`  the ${engine.bagSize()}-cube cap held on ${capChecked} racks bigger than the bag`);

if (failures.length) {
    console.log(`\n${mismatched} climb(s) diverged. First ${failures.length}:\n`);
    failures.forEach(f => console.log(`  ${f}\n`));
    process.exit(1);
}
console.log('\nThe extracted engine matches the original exactly.');
