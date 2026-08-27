// A player's standing in Botto's Chance Cube: what they own, what they've unlocked, and the
// lifetime record behind the start screen.
//
// Every function here takes a state object `s` and a `patch`, mutates the first and accumulates
// the second. The patch is what gets written; `s` is what the caller goes on rendering from. That
// split is deliberate and load-bearing — a reveal animation is still holding a pre-roll snapshot
// while settlement runs, so nested values are **replaced** rather than mutated in place or the
// snapshot follows the reference into the new numbers and gives the result away early.
//
// No Discord, no Firebase. `cubeState` reads a plain object and the writer lives in `persist.js`.

const moment = require('moment');
require('moment-timezone');

const {
    LEVELS, SPECIALS, TREE, TREES, SKIN_FREE, SKIN_SETS, SKIN_VARIANTS, cube: config,
} = require('./tuning.js');
const engine = require('./engine.js');

const { specialById } = engine;

const MAX_LEVEL = LEVELS.length - 1;
exports.MAX_LEVEL = MAX_LEVEL;

const pair = v => ({ blue: Number(v?.blue) || 0, red: Number(v?.red) || 0 });

// Cubes that exist in the data but are **not on Watto's rack**, because they are not his to sell.
//
// The Planet Octahedron is the only one, and it is the whole of why this set exists: it is assembled
// from eight planet faces earned through the challenge system, the way the chance cube itself is
// assembled from three red sides and three blue. Leaving it in `rewardChoices` would quietly make it
// an eighteenth prestige pick — which is exactly the endgame competition the design put it outside the
// rack to avoid.
//
// `grantReward` is guarded by the same set, so a stale menu holding the old list cannot buy it either.
const OFF_RACK = new Set(['octahedron']);
exports.OFF_RACK = OFF_RACK;

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

// The most that can go on one roll: the base ceiling, `maxStakeStep` times higher per prestige.
// Wager size grows with progression rather than with a bank balance.
const maxStakeFor = prestige => config.maxStake * (config.maxStakeStep ** prestige);
exports.maxStakeFor = maxStakeFor;

// What the next bought reroll costs. Tied to the stake ceiling rather than to the stake on the
// table, because the stock is bought on the idle board and spent later — pricing it off the
// current stake would just mean buying cheap and cashing in deep. Every reroll already in stock
// makes the next one dearer, so the price is its own anti-hoarding rule and needs no counter of
// its own: spend them and it falls back.
const rerollCostFor = (prestige, stock = 0) => Math.floor(
    config.rerollCost * (config.maxStakeStep ** prestige) * (config.rerollPriceStep ** stock),
);
exports.rerollCostFor = rerollCostFor;

// What rerolling a weld costs in truguts. Scaled by the stake ceiling like a bought reroll, and
// **not** escalated per weld — see `weldRerollCost` for why escalating it would make paying a
// build token strictly worse than unwelding and welding again.
const weldRerollCostFor = prestige => Math.floor(
    config.weldRerollCost * (config.maxStakeStep ** prestige),
);
exports.weldRerollCostFor = weldRerollCostFor;

// ---------------------------------------------------------------------------
// Records that reset
// ---------------------------------------------------------------------------

// **Which week it is, Eastern**, on the same boundary the daily lean uses — so a week rolls over when
// a day does and the two can never disagree about what day it is.
//
// The board this keys is deliberately **weekly rather than all-time**. In a mode this swingy an
// all-time board is won once by whoever happened to be standing on a fresh prestige road when a ×140
// landed, and is then dead: nobody else has a reason to look at it again. A week gives every player a
// live shot every Monday, which is the difference between a trophy cabinet and something the channel
// argues about.
const weekKey = function (now) {
    const d = moment(now).tz('America/New_York');
    return `${d.isoWeekYear()}-${String(d.isoWeek()).padStart(2, '0')}`;
};
exports.weekKey = weekKey;

const monthKey = now => moment(now).tz('America/New_York').format('YYYY-MM');
exports.monthKey = monthKey;

// The two windows the board offers beside all-time, and the key each is filed under. All-time needs
// no entry here: it is `bestMultiple` and friends, which have been kept since the mode shipped.
const WINDOWS = { week: weekKey, month: monthKey };
exports.WINDOWS = WINDOWS;

// When each of the three records was set, in milliseconds. A best with no stamp reads back as 0 —
// every record filed before this existed has one, and the board prints nothing rather than a date it
// had to invent. Kept beside the figures rather than derived: a best is a moment, and the tallies it
// is folded into remember nothing about when anything landed.
const stampsOf = stored => ({
    multiple: Number(stored?.multiple) || 0,
    cubes: Number(stored?.cubes) || 0,
    streak: Number(stored?.streak) || 0,
});
exports.stampsOf = stampsOf;

// One window's bests, reset lazily. **Nothing sweeps at midnight**: a stored window that is not the
// current one simply reads back as zeroes and the next write files under the new key. So a player who
// has not rolled since last Tuesday has no standing on this week's board rather than a stale one.
const windowOf = function (stored, id) {
    if (!stored || stored.id !== id) return { id, multiple: 0, cubes: 0, streak: 0, at: stampsOf(null) };
    return {
        id,
        multiple: Number(stored.multiple) || 0,
        cubes: Number(stored.cubes) || 0,
        streak: Number(stored.streak) || 0,
        at: stampsOf(stored.at),
    };
};
exports.windowOf = windowOf;
exports.weekOf = (c, now) => windowOf(c?.week, weekKey(now));
exports.monthOf = (c, now) => windowOf(c?.month, monthKey(now));

// ---------------------------------------------------------------------------
// Face completion
// ---------------------------------------------------------------------------

// **Every distinct face in the game, and which cubes carry it.** Deduped across cubes on purpose: a
// mine sits on four of them and a wipeout on six, so a per-cube list showed the same face over and
// over and never answered the question worth asking — how many times has this face actually landed.
//
// Ben's wings are never rolled and a plain cube has no tally, so neither is reachable and neither is
// here. Built once: it is a property of the data, not of the player.
//
// Declaration order rather than sorted, so the grid is stable between visits and related faces stay
// together — a cube's own faces are declared side by side and read that way.
const FACE_CUBES = new Map();
for (const sp of SPECIALS) {
    for (const f of sp.faces || []) {
        if (!FACE_CUBES.has(f.id)) FACE_CUBES.set(f.id, []);
        const on = FACE_CUBES.get(f.id);
        if (!on.includes(sp.id)) on.push(sp.id);
    }
}
exports.FACE_CUBES = FACE_CUBES;

// How much of the game a player has actually *seen*, off the tallies the rack screen already keeps.
// A face counts once it has landed once, so this is a collection rather than a grind — and some of it
// is genuinely rare: the Symbiont's raze is one face in six on a cube most racks never field, and the
// Planet Octahedron's eight planets are one in eight each.
//
// **One entry per distinct face, counting every time it has landed** — summed across every cube that
// carries it, because a mine is a mine whichever cube threw it and the player is collecting *faces*
// rather than cube-face pairs.
//
// `owned` is whether any cube carrying it is on the rack, which is the difference between a face
// that has not turned up yet and one that cannot.
const faceProgressOf = function (c, owned) {
    const have = c?.faces || {};
    const held = new Set(owned || []);
    return [...FACE_CUBES.entries()].map(([id, on]) => ({
        id,
        n: on.reduce((sum, cube) => sum + (Number(have[cube]?.[id]) || 0), 0),
        owned: on.some(cube => held.has(cube)),
    }));
};
exports.faceProgressOf = faceProgressOf;

// The key a pairing's reroll memory is filed under: its parents, canonically ordered. A weld's own
// id changes on every reroll — the whole point of it is that it names the faces — so the memory
// cannot hang off it. The pairing is the thing that persists.
const pairKeyOf = function (id) {
    const parents = engine.weldParents(id);
    return parents ? parents.join('+') : null;
};
exports.pairKeyOf = pairKeyOf;

// What buying a tie costs. A share of the standing it buys rather than a flat price, because the
// standing doubles every level and a flat price would be free money at the top; dearer with every
// bribe already paid, and the count resets at prestige so it can't price itself out for good.
//
// **The share starts at what the tie actually risks.** Losing a tie costs the whole standing, so a
// bribe priced below `P(lose the tie)` is a straight subtraction in the player's favour however the
// rest of the mode is tuned — see the note on `bribeEdge`, which is what the house keeps over that
// floor. `nudge` is which lean applies: Watto's cube lands against you `tieLean` of the time, and
// Qui-Gon's Nudge replaces that with landing your way `nudgeLean` of the time.
//
// Taking the flag rather than the probability because every caller already holds `s.nudge` and none
// of them holds the lean — a caller that had to work out the odds itself is a caller that can get
// them wrong, and there are five of them.
const bribeShareFor = nudge => (nudge ? 1 - config.nudgeLean : config.tieLean) * (1 + config.bribeEdge);
exports.bribeShareFor = bribeShareFor;

exports.bribeCostFor = (standing, bribes = 0, nudge = false) => Math.floor(
    standing * bribeShareFor(nudge) * (config.bribeStep ** bribes),
);

// ---------------------------------------------------------------------------
// The cosmetics shelf
// ---------------------------------------------------------------------------
//
// **Ownership is the only half of a skin the server has an opinion about.** What a variant looks like
// is the client's, what it costs and what opens it is `tuning.js`, and this is the part that is a fact
// about one player: which of the fifty-three they hold. See the section head in `tuning.js` for why
// the mode sells cosmetics at all.

const SKIN_IDS = new Set(SKIN_VARIANTS);
const SKIN_SET_BY_ID = new Map(SKIN_SETS.map(set => [set.id, set]));

const skinSetById = id => (typeof id === 'string' ? SKIN_SET_BY_ID.get(id) || null : null);
exports.skinSetById = skinSetById;

// Stored as a `{ id: true }` map for the same reason `cubes` is — a grant is a single key — and read
// back in catalogue order so a picker never reshuffles itself. Unknown ids are dropped rather than
// trusted: a variant the shipped catalogue no longer has is a picture nothing can draw.
//
// **The free four are added on read and never stored.** They cost nothing, so writing them to a
// profile would be storing a fact that is true of everybody — and a fact stored per player is a fact
// that can go missing.
const ownedSkins = function (c) {
    const held = new Set(Object.keys(c?.skins || {}).filter(id => c.skins[id] && SKIN_IDS.has(id)));
    for (const id of SKIN_FREE) held.add(id);
    return SKIN_VARIANTS.filter(id => held.has(id));
};
exports.ownedSkins = ownedSkins;

// Whether a set's gate is open, and if not, what it is waiting for. The sentence is the server's
// because the condition is: a client that worded its own would be one release away from telling a
// player to reach a prestige the shelf no longer asks for.
//
// The three gates ask three different questions — see `SKIN_SHELF` — and `faces` is the only one that
// can be *unanswerable*: a player who owns no cube carrying a tallied face has nothing to complete, so
// it is shut with the generic sentence rather than reported as zero-to-go and open.
const skinGate = function (s, gate) {
    if (!gate) return { open: true, need: null };
    if (gate.prestige != null) {
        return s.prestige >= gate.prestige
            ? { open: true, need: null }
            : { open: false, need: `Opens at Prestige ${gate.prestige}` };
    }
    if (gate.cubes != null) {
        const at = s.cubes.length;
        return at >= gate.cubes
            ? { open: true, need: null }
            : { open: false, need: `Opens at ${gate.cubes} cubes — you own ${at}` };
    }
    if (gate.faces === 'all') {
        // Against the faces on cubes the player owns, which is the same count the collection screen
        // draws against: a bar that cannot fill until the rack is bought out is not a goal.
        const mine = s.faceProgress.filter(f => f.owned);
        const left = mine.filter(f => !(f.n > 0)).length;
        if (!mine.length) return { open: false, need: 'Opens when you complete the collection' };
        return left === 0
            ? { open: true, need: null }
            : { open: false, need: `Opens when you complete the collection — ${left} to go` };
    }
    return { open: true, need: null };
};
exports.skinGate = skinGate;

// The shelf as a screen draws it: every set, whether it is held, whether it can be bought and what it
// is waiting for. Locked sets are included for the reason the rack's tree is sent whole — a catalogue
// you cannot see the top of is one you cannot choose a branch of.
//
// **Held outranks the gate.** A set can be owned and still sit behind a shut one — a retuned gate, or a
// variant granted some other way — and in that case the gate is a fact about buying it, which is over.
// Reporting it locked would have the shelf offering to sell something back.
exports.skinShelf = function (s) {
    const held = new Set(s.skins);
    return SKIN_SETS.map((set) => {
        const has = set.ids.every(id => held.has(id));
        const { open, need } = skinGate(s, set.gate);
        return { ...set, owned: has, open: has || open, need: has ? null : need };
    });
};

// ---------------------------------------------------------------------------
// Which skin is worn on which side
// ---------------------------------------------------------------------------
//
// **The half of a skin the server used not to have an opinion about, and now needs one.** Ownership
// was always here; the *choice* lived in one browser's `localStorage`, on the argument that nothing
// in the rules can read it and a board is single-player. Both halves of that are still true — the
// engine goes on naming positions `side:blue` forever — and it stopped being the whole story the
// moment a press became something the profile counts. A tally of which button was pressed cannot be
// derived from a fact only one client knows.
//
// It also fixes a wart that was never about the comb: a choice kept per browser meant a phone and a
// desktop drew two different boards for the same player. `skins.js` anticipated this — its `worn` is
// commented as local "for as long as ownership is stubbed", and `learnSkins` already reads a
// `profile.sides` nothing has ever sent.

// What a slot falls back to, and what the mode has always drawn. The two stock variants are one
// colour each and different, which is what makes them a safe last resort for either side.
const SKIN_STOCK = { blue: 'sq:blue', red: 'sq:red' };
exports.SKIN_STOCK = SKIN_STOCK;

// **What the two sides may not have in common: the colour, not the variant.** Two sides in purple are
// unreadable whether one of them is a heart or not, so a shape is never enough to tell them apart. Read
// off the id rather than the catalogue, which is all it takes — every variant is `shape:colour` except a
// flag, which is a racer and has no colour, so it clashes only with itself.
const skinColorOf = function (id) {
    if (typeof id !== 'string') return null;
    const [shape, rest] = id.split(':');
    return shape === 'flag' ? null : rest || null;
};

const skinsClash = function (a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ca = skinColorOf(a);
    return !!ca && ca === skinColorOf(b);
};

// The stored pair, made safe to draw. Mirrors `settle` in the client's `skins.js` and has to: both
// ends read the same field, and a pair one of them would correct and the other would not is a board
// disagreeing with the profile behind it.
//
// Three ways a stored pair can be wrong, and all three are reachable without anybody cheating: a
// variant dropped from the catalogue between releases, a variant sold back or never owned, and a
// clash written by a build that did not have this rule. **Red gives way**, because Blue is the side
// the picker opens on. Two fallbacks, because the first still clashes if Blue happens to be wearing
// the stock red — and the second cannot fail.
const settleSides = function (worn, held) {
    const out = { ...SKIN_STOCK };
    for (const side of ['blue', 'red']) {
        const want = worn?.[side];
        if (typeof want === 'string' && SKIN_IDS.has(want) && held.has(want)) out[side] = want;
    }
    if (skinsClash(out.red, out.blue)) out.red = SKIN_STOCK.red;
    if (skinsClash(out.red, out.blue)) out.red = SKIN_STOCK.blue;
    return out;
};
exports.settleSides = settleSides;

// Which picture is worn on which side, as the profile stores it and off the skins actually held.
// `ownedSkins` is passed in rather than re-derived so a read never disagrees with the list beside it.
exports.wornSides = (c, owned) => settleSides(c?.sides, new Set(owned));

// Puts one variant on one side. Refuses for the two reasons the picker greys a tile out — not owned,
// and it would clash with the other slot — because a rule enforced only in the picker is a rule the
// next client to be written does not have.
//
// Written as the whole pair rather than one key, so the patch says exactly what the state says. The
// caller is `actions.equipSide`, which is where a refusal has somewhere to go.
exports.equipSide = function (s, patch, side, id) {
    if (side !== 'blue' && side !== 'red') return { ok: false, code: 'bad_side' };
    if (!SKIN_IDS.has(id)) return { ok: false, code: 'no_such_skin' };
    if (!s.skins.includes(id)) return { ok: false, code: 'not_owned' };
    const other = side === 'blue' ? 'red' : 'blue';
    if (skinsClash(id, s.sides[other])) return { ok: false, code: 'clash' };
    s.sides = { ...s.sides, [side]: id };
    patch.sides = s.sides;
    return { ok: true, sides: s.sides };
};

// ---------------------------------------------------------------------------
// The comb
// ---------------------------------------------------------------------------
//
// **One cell per prestige, and the cell is the skin that took the most calls in it.** The comb is the
// whole of what a prestige leaves behind besides the ceiling and the token: a record of which button
// the player actually pressed, laid out in hexagonal rings.
//
// **What it buys is an option set.** The cells in a player's comb are the only symbols they may wear —
// so a player who spends every period on the stock red square has exactly one emblem available to
// them, and a rarer one has to be *played for*, in a stretch of a period, with a skin they went and
// bought. Nothing here can be shortcut with truguts, and nothing here can be caught up on: the cell
// for ring two is gone the moment ring two is behind you.
//
// **Positional, and one-indexed by prestige.** `comb[0]` is the first prestige ever taken. That is
// what lets a ring count be read straight off the length, and it is why a gap is stored as a hole
// rather than closed up — see `combOf`.

// Which prestige numbers close a ring. Centred hex rings add `6n` cells, so the gaps run 6, 12, 18,
// 24 — **not** doubling, which would put the fourth landmark at 91 and out of anybody's reach.
//
// Derived rather than tabled: a table of five numbers is a table that disagrees with the geometry the
// first time somebody adds a ring to the drawing.
const combRings = function (n) {
    const rings = [];
    for (let ring = 0, at = 1; at <= n; ring += 1) {
        rings.push(at);
        at += 6 * (ring + 1);
    }
    return rings;
};
exports.combRings = combRings;

// How many rings are *complete*, which is what the emblem wears as outlines. One more than the number
// of landmarks passed, and zero until the first prestige — an emblem with no rings is a player who has
// never handed the road back.
exports.combRing = n => combRings(n).length;

// The stored comb, made safe to draw and padded to the prestige count.
//
// **Three things it has to survive.** Firebase turns a sparse array into a keyed object, so the read
// takes either shape. A cell naming a variant the catalogue has dropped is a picture nothing can paint
// and comes back as a hole. And a profile older than this feature has a prestige count and no comb at
// all, which is the interesting one:
//
// **The unrecorded past is padded at the front, and the holes are honest.** A player at prestige 40
// when this shipped has forty rings' worth of geometry and no record of what they pressed for any of
// it. Their comb is forty holes, filling from here — because the alternative is either inventing a
// history the server never watched, or starting their comb at zero and having the emblem's ring count
// disagree with the prestige count it exists to show. A hole cannot be worn, which is the honest part:
// it says *a prestige happened here and nobody was counting*, and it says it in the one place a player
// can see how much of their own history predates the record.
const combOf = function (c, prestige) {
    const raw = Array.isArray(c?.comb) ? c.comb : Object.values(c?.comb || {});
    const seen = raw.map(id => (typeof id === 'string' && SKIN_IDS.has(id) ? id : null));
    const pad = Math.max(0, prestige - seen.length);
    return [...Array.from({ length: pad }, () => null), ...seen].slice(0, prestige);
};
exports.combOf = combOf;

// Which cell of the comb the player is wearing. Held to the comb on read rather than trusted: an
// emblem is a *choice among cells*, so one naming a variant that is not in there is not a stale
// preference to honour, it is a claim to something never earned.
const emblemOf = function (c, comb) {
    const want = c?.emblem;
    return typeof want === 'string' && comb.includes(want) ? want : null;
};
exports.emblemOf = emblemOf;

// The winner of a period, off the tally. **Most-pressed, and a tie goes to whichever of the tied was
// pressed most recently** — which is what `pressedLast` is for and the only reason it is stored. A
// tie broken by catalogue order would hand a dead heat to whichever colour happens to be listed first
// forever, and a player who split a period evenly between two skins and finished on one of them has
// said which one they meant.
//
// Null on a period with no calls in it at all, which is a prestige taken off a banked offer without
// rolling since the last one.
exports.pressWinner = function (s) {
    const at = id => Number(s.pressed[id]) || 0;
    const ids = Object.keys(s.pressed).filter(id => SKIN_IDS.has(id) && at(id) > 0);
    if (!ids.length) return null;
    const most = Math.max(...ids.map(at));
    const tied = ids.filter(id => at(id) === most);
    if (tied.length === 1) return tied[0];
    return tied.includes(s.pressedLast) ? s.pressedLast : tied[0];
};

// Wears one cell. Refused for anything not in the comb — including a hole, which is what `null` in
// there means and is deliberately unwearable.
exports.pickEmblem = function (s, patch, id) {
    // **The string test is the half that refuses a hole**, and it is not redundant with the membership
    // test below it: a comb with an unrecorded prestige in it *contains* `null`, so `includes` alone
    // hands back `ok` for a cell that is by definition nothing to wear.
    if (typeof id !== 'string') return { ok: false, code: 'not_in_comb' };
    if (!s.comb.includes(id)) return { ok: false, code: 'not_in_comb' };
    s.emblem = id;
    s.pick = false;
    patch.emblem = id;
    patch.pick = null;
    return { ok: true, emblem: id };
};

// Grants every variant in a set. Reached only through `buySkin`, which is what charges for it, and
// written as the whole map rather than one key so the patch says the same thing the state does.
exports.grantSkins = function (s, patch, ids) {
    const held = new Set(s.skins);
    for (const id of ids) if (SKIN_IDS.has(id)) held.add(id);
    s.skins = SKIN_VARIANTS.filter(id => held.has(id));
    // The free four are excluded from what is written for the reason `ownedSkins` adds them on read.
    patch.skins = Object.fromEntries(
        s.skins.filter(id => !SKIN_FREE.includes(id)).map(id => [id, true]),
    );
};

// ---------------------------------------------------------------------------
// Reading a profile
// ---------------------------------------------------------------------------

// Special cubes are stored as a `{ id: true }` map so a grant is a single key, and read back in
// SPECIALS order so the loadout screen never reshuffles itself. Anything unrecognised is
// dropped rather than trusted — an id that no longer exists in the data would crash a roll.
//
// **Welds are stored the same way and are not in SPECIALS**, because a weld is built on demand from
// its parents rather than declared. So they are validated through `specialById`, which is the one
// thing that knows how to make one, and appended after the declared cubes in id order — a weld has
// no natural place in SPECIALS order and inventing one would move it every time a cube is added.
//
// A weld **consumes its parents** while it exists, so nothing here has to reconcile the two: the
// stored map either has `greed` or has `greed+wild`, never both, and unwelding is what puts the
// parents back.
const ownedCubes = function (c) {
    const owned = Object.keys(c?.cubes || {}).filter(id => c.cubes[id]);
    const declared = SPECIALS.filter(sp => owned.includes(sp.id)).map(sp => sp.id);
    const welds = owned.filter(id => !declared.includes(id) && specialById(id)).sort();
    return [...declared, ...welds];
};

// Cubes owned by having **collected** them rather than by having picked them off the rack, keyed by
// the collection reward flag that grants them. The Planet Octahedron is the only one and the whole
// reason this exists: it is assembled from eight planet faces through the challenge system, so its
// ownership lives in `effects` beside every other collection reward — including `chance_cube`, which
// is what unlocked the mode in the first place.
//
// Read here rather than mirrored into `cube.cubes` on claim, so there is exactly one fact about
// whether a player has built it and no second copy to fall out of step. A profile that loses the
// effect loses the cube, which is the correct behaviour and not a case anything has to handle.
const COLLECTED = { grand_circuit: 'octahedron' };

exports.cubeState = function (user_profile) {
    const c = user_profile?.cube || {};
    const effects = user_profile?.effects || {};
    const unlocked = Math.min(Number(c.unlocked) || 0, MAX_LEVEL);
    const prestige = Math.max(Number(c.prestige) || 0, 0);
    // Read here rather than inline below, because the emblem is held against it and two reads of a
    // padded array are two chances for the pair to disagree about what is in the comb.
    const comb = combOf(c, prestige);
    const maxStake = maxStakeFor(prestige);
    const stored = Math.floor(Number(c.stake) || 0);
    // Kept in SPECIALS order like the rack picks, so the loadout screen never reshuffles itself when a
    // collection completes.
    const collected = Object.entries(COLLECTED)
        .filter(([flag]) => effects[flag])
        .map(([, id]) => id)
        .filter(id => specialById(id));
    const owned = ownedCubes(c);
    const cubes = [
        ...SPECIALS.map(sp => sp.id).filter(id => owned.includes(id) || collected.includes(id)),
        // Welds, which are owned but not declared — see `ownedCubes`.
        ...owned.filter(id => !SPECIALS.some(sp => sp.id === id)),
    ];
    // The loadout is filtered against two things: what is actually owned, and **how many the bag
    // holds**. A cube sold out from under a saved loadout still can't reach the table, and a loadout
    // longer than `bagSize()` is cut to it.
    //
    // **The cap is the bag, and it is a hard eight.** `fillBag` draws `bagSize()` cubes across the
    // climb and no more, so a ninth equipped cube could only ever be one of two things: a cube that
    // silently never plays, or a cube that displaces one you did want. Both were on offer before this
    // — a longer rack made a longer bag whose tail no level reached — and neither is a choice worth
    // giving anyone. Field eight and every one of them is a cube you will meet.
    //
    // Clamped on **read** as well as write, so a profile saved when the rack was uncapped comes back
    // fielding its first eight rather than being rejected, and a hand-edited one cannot field nine.
    // The overflow stays owned — it is on the bench, not gone.
    //
    // A stored `slots` from the days when the cap was bought a prestige at a time is still ignored:
    // the cap is fixed by the ladder now and is not for sale. See `rewardChoices`.
    const equipped = Object.values(c.equipped || {})
        .filter(id => cubes.includes(id))
        .slice(0, engine.bagSize());
    const stock = Math.max(0, Math.floor(Number(c.rerolls) || 0));
    // How far up the press the player has bought. Clamped on read as well as write, so a hand-edited
    // profile cannot field a tier the data has no cuts for.
    const pressTier = Math.max(0, Math.min(config.weldTiers.length, Math.floor(Number(c.pressTier) || 0)));
    // What each pairing's press has already produced, keyed by `pairKeyOf` and holding at most
    // `weldMemory` ids. Read defensively — it is a nested map and a hand-edited profile should not be
    // able to put a non-array in the reroll path.
    const weldSeen = {};
    for (const [k, v] of Object.entries(c.weldSeen || {})) {
        const list = (Array.isArray(v) ? v : Object.values(v || {})).filter(x => typeof x === 'string');
        if (list.length) weldSeen[k] = list;
    }
    return {
        // Special cubes owned, which of them are on the table, and how many the table has room for.
        //
        // `slots` is **a constant of the ladder, not a number on the profile** — it is `bagSize()`,
        // the count a run draws, and nothing a player does moves it. It is reported all the same so a
        // client can render `3/8` without knowing how the bag is built. The old per-profile `slots`,
        // bought a prestige at a time, is a different thing entirely and is gone.
        cubes,
        equipped,
        slots: engine.bagSize(),
        // Rerolls in stock — bought, or banked off a Reroll Cube — and whether buying is
        // unlocked at all. Spent on a game over screen, never automatically.
        rerolls: stock,
        buyReroll: !!c.buyReroll,
        rerollCost: rerollCostFor(prestige, stock),
        // Salvage Rights, off The Junker, and Double or Nothing, off The Gambler. Read defensively
        // like every other pick on the rack: a profile written before either existed has neither.
        scrap: !!c.scrap,
        double: !!c.double,
        // The weld press: how far up it the player has bought, what a reroll costs in truguts, how
        // many cubes it takes at that tier, and what each pairing has already thrown.
        pressTier,
        pressCubes: pressTier >= 3 ? 3 : 2,
        // The two picks off The Forger that are not rungs. The Keeper names a face the cut must
        // carry; The Heavy Half names the parent the major share lands on, which `weldSplits`
        // otherwise decides with a coin flip.
        keeper: !!c.keeper,
        split: !!c.split,
        // **`heavy` is read for one reason only: to hand its point back.** The perk never ran, the
        // node is gone from `TREE`, and its choice now comes with press rung 4 — so nothing consults
        // this to decide anything. See `refundDeadHeavy`, which is also what will delete it.
        heavy: !!c.heavy,
        // The two that stop a roll between the cubes landing and the effects firing.
        premonition: !!c.premonition,
        shuffle: !!c.shuffle,
        sidebet: !!c.sidebet,
        weldRerollCost: weldRerollCostFor(prestige),
        weldSeen,
        // Lifetime tie tallies, by how each one was settled. Read defensively for the same reason
        // `calls` and `rolled` are: a profile written before this existed has none of it.
        ties: {
            total: Math.max(0, Math.floor(Number(c.ties?.total) || 0)),
            rolled: Math.max(0, Math.floor(Number(c.ties?.rolled) || 0)),
            bribed: Math.max(0, Math.floor(Number(c.ties?.bribed) || 0)),
            // **Read but never written any more.** Tatooine took a tie outright until `boonta` was
            // retired; the tally stays so a profile that earned some keeps them, and so the lifetime
            // total still adds up on a player who was there for it.
            boonta: Math.max(0, Math.floor(Number(c.ties?.boonta) || 0)),
            blue: Math.max(0, Math.floor(Number(c.ties?.blue) || 0)),
            red: Math.max(0, Math.floor(Number(c.ties?.red) || 0)),
            won: Math.max(0, Math.floor(Number(c.ties?.won) || 0)),
            // **His cube's colour crossed with the result, which the four above cannot reconstruct.**
            // `blue`/`red` and `won` are two margins of the same table and the table has a degree of
            // freedom neither of them fixes: `won` is `breaker === call` summed over both colours, so how
            // many *blue* breakers came good is not derivable from any combination of them. All four cells
            // are kept rather than two and the rest inferred, because a profile written before this
            // existed has `blue` and `red` covering ties these four know nothing about — `blue - wonBlue`
            // would then count legacy ties as losses. Summing all four gives the covered total instead,
            // and whatever `rolled` has beyond it is honestly unattributed.
            wonBlue: Math.max(0, Math.floor(Number(c.ties?.wonBlue) || 0)),
            wonRed: Math.max(0, Math.floor(Number(c.ties?.wonRed) || 0)),
            lostBlue: Math.max(0, Math.floor(Number(c.ties?.lostBlue) || 0)),
            lostRed: Math.max(0, Math.floor(Number(c.ties?.lostRed) || 0)),
        },
        // This week's and this month's bests, for the board's two rolling windows. Reset lazily —
        // see `windowOf`. All-time needs no entry: it is `bestMultiple` and friends.
        week: windowOf(c?.week, weekKey()),
        month: windowOf(c?.month, monthKey()),
        // How much of the game's face art the player has actually met. **Not `faces`** — that is the
        // raw `{ cubeId: { faceKey: n } }` tally the rack screen draws its per-face counts from, and
        // this is the summary over it.
        faceProgress: faceProgressOf(c, cubes),
        // **Which side skins the player holds**, in catalogue order and with the free four folded in —
        // see `ownedSkins`.
        skins: ownedSkins(c),
        // **And which of them is worn on which side.** Cosmetic still — the engine names positions
        // `side:blue` and `side:red` forever, and nothing in the rules reads this — but no longer only
        // the client's, because `pressed` below counts it. Settled on read rather than trusted: see
        // `settleSides` for the three ways a stored pair goes stale.
        sides: exports.wornSides(c, ownedSkins(c)),
        // **How many calls each skin has taken since the last prestige.** `{ [variantId]: n }`, bumped
        // by `recordRoll` and cleared by `applyPrestige` — which is what makes it a period rather than a
        // lifetime. Not to be confused with `calls` below, which counts *sides* and counts them forever.
        pressed: (c.pressed && typeof c.pressed === 'object') ? c.pressed : {},
        // The last variant a call was made on, which exists for one job: breaking a tie in the tally
        // toward the skin the player finished the period on. See `pressWinner`.
        pressedLast: typeof c.pressedLast === 'string' ? c.pressedLast : null,
        // **One cell per prestige, and the cell is what won that period's tally.** Positional and
        // padded to the prestige count, so a ring count reads off the length — see `combOf` for what a
        // hole in it means.
        comb: comb,
        // Which cell is being worn. Held to the comb on read, because an emblem is a choice among cells
        // rather than a preference to be honoured.
        emblem: emblemOf(c, comb),
        // **A prestige waiting for its emblem to be chosen.** Stored rather than held by the client
        // because the Activity re-mounts whenever Discord feels like it, and the one press that can only
        // be made at a prestige must not be lost with the frame that offered it.
        pick: !!c.pick,
        // The two things off the rack that only ever matter on a tie: the Nudge turns Watto's
        // tie-breaker cube around, and the bribe lets you buy the tie instead of rolling for it.
        // `bribes` is how many have been paid since the last prestige, which is the price ladder.
        nudge: !!c.nudge,
        bribe: !!c.bribe,
        bribes: Math.max(0, Math.floor(Number(c.bribes) || 0)),
        // Lifetime face tallies per special cube, for the rack screen. `{ cubeId: { faceKey: n } }`.
        faces: (c.faces && typeof c.faces === 'object') ? c.faces : {},
        // Times the ladder has been handed back. Drives the stake ceiling and the faces on
        // offer; resets nothing about the lifetime record.
        prestige,
        // Unspent picks off the rack, one banked per prestige. A prestige taken with nothing in
        // mind to buy costs nothing to take: the point keeps until it is spent.
        points: Math.max(0, Math.floor(Number(c.points) || 0)),
        // A stake carried across runs, so it survives restarts. Clamped on read as well as on
        // write, so a stake saved before the ceiling existed can't stay oversized.
        stake: Math.min(stored >= config.minStake ? stored : config.defaultStake, maxStake),
        maxStake,
        turn: Number(c.turn) || 0,
        // Deepest level unlocked, and clears banked toward opening the next one.
        unlocked,
        clears: Number(c.clears) || 0,
        // Lifetime tallies behind the start screen: sides called, calls that won, and every
        // individual cube face that has landed.
        calls: pair(c.calls),
        wins: pair(c.wins),
        rolled: pair(c.rolled),
        bestLevel: Math.min(Number(c.bestLevel) || 0, MAX_LEVEL),
        bestStanding: Number(c.bestStanding) || 0,
        // The longest line ever left standing *after* the effects finished with it — the record a
        // Mirror conjuring and a Symbiont inserting are chasing.
        bestCubes: Number(c.bestCubes) || 0,
        // The biggest payout multiple a roll ever stood at, greed and multipliers included. Not an
        // integer — the ladder step needn't be one and the paying faces add fractions — so it is
        // kept as the raw number and rounded only where it's printed.
        bestMultiple: Number(c.bestMultiple) || 0,
        // Consecutive correct calls. Only a wrong call breaks it — banking doesn't, so a
        // streak runs across games and can outlive any single run.
        streak: Number(c.streak) || 0,
        bestStreak: Number(c.bestStreak) || 0,
        // **The cold streak: openings lost in a row, and the worst run of them.**
        //
        // The opposite figure to the two above and not the same one negated. `streak` counts every
        // correct call at any depth and survives a bank; this counts **runs**, and only the rung they
        // open on. That rung is the one place in the mode where a loss is pure chance: `drawCubes` at
        // level 0 returns one plain cube and does not touch the bag, so the opening call is a fair coin
        // every single time, at every prestige, whatever is in the rack. Nothing a player owns or
        // chooses moves it — which is what makes a run of them worth counting rather than diagnosing.
        //
        // Read defensively like every tally added after the mode shipped, and `coldest` is floored at
        // `cold` so a hand-edited profile cannot hold a live streak longer than its own record.
        cold: Math.max(0, Math.floor(Number(c.cold) || 0)),
        coldest: Math.max(
            Math.max(0, Math.floor(Number(c.cold) || 0)),
            Math.max(0, Math.floor(Number(c.coldest) || 0)),
        ),
        // When each of the three lifetime bests was set. The rolling windows keep their own; see
        // `stampsOf`.
        bestAt: stampsOf(c.bestAt),
        // Lifetime trugut ledger, in the same net numbers the result lines quote.
        totalWon: Number(c.totalWon) || 0,
        totalLost: Number(c.totalLost) || 0,
        // Truguts handed over for something rather than wagered: bought rerolls and bought ties.
        // Kept off the loss ledger because nothing was ever riding on them — a bribe that wins the
        // run still cost what it cost, and filing it as a loss would make `won - lost` read as if
        // the cubes had taken it.
        totalSpent: Number(c.totalSpent) || 0,
    };
};

// ---------------------------------------------------------------------------
// The lifetime ledger
// ---------------------------------------------------------------------------

// Adds to the lifetime ledger. Called wherever truguts actually move, with the same amount
// the player was told about, so the totals are literally the sum of the result lines.
exports.recordWon = function (s, patch, amount) {
    if (amount <= 0) return;
    s.totalWon += amount;
    patch.totalWon = s.totalWon;
};

exports.recordLost = function (s, patch, amount) {
    if (amount <= 0) return;
    s.totalLost += amount;
    patch.totalLost = s.totalLost;
};

// Adds to the lifetime spend: rerolls off the shelf and ties bought off Watto. Same idea as the
// two above — called where the truguts actually move, with the amount the player was quoted — but
// its own total, because a purchase is a price paid rather than a wager lost.
exports.recordSpent = function (s, patch, amount) {
    if (amount <= 0) return;
    s.totalSpent += amount;
    patch.totalSpent = s.totalSpent;
};

// Takes a loss back off the ledger. Only ever used to un-record a bust that a reroll bought
// back, so the totals stay the literal sum of what the player was told.
exports.unrecordLost = function (s, patch, amount) {
    if (amount <= 0) return;
    s.totalLost = Math.max(0, s.totalLost - amount);
    patch.totalLost = s.totalLost;
};

// Folds one roll into the lifetime tallies and reports which personal bests it broke. Every
// nested value is *replaced* rather than mutated in place, so a frame still holding a
// pre-roll snapshot keeps rendering the old numbers instead of following the reference.
exports.recordRoll = function (s, patch, {
    call, won, cubes, level, standing, line = 0, multiple = 0, opening = false,
}) {
    // Read the records before anything moves.
    const records = {
        level: level > s.bestLevel,
        standing: standing > s.bestStanding,
        // `line` is how many positions the roll *ended* with, so a Mirror that conjured four and a
        // Padmé that slipped in two both count toward it — and a Tusken that ate one counts against.
        cubes: line > s.bestCubes,
        // The multiple the roll was *played for*, win or lose, which is the same rule the cube count
        // goes by: it's a record of what the cubes built, not of what got banked. A bust at ×48 threw
        // the biggest multiple this player has ever stood at, and pretending otherwise would hide the
        // one number a Greed rack exists to move.
        multiple: multiple > s.bestMultiple,
    };
    const blue = cubes.filter(c => c === 'blue').length;
    s.calls = { ...s.calls, [call]: s.calls[call] + 1 };
    s.rolled = { blue: s.rolled.blue + blue, red: s.rolled.red + (cubes.length - blue) };
    patch.calls = s.calls;
    patch.rolled = s.rolled;
    // **The same press, counted by its picture.** `calls` above is the side and is kept forever;
    // this is the skin that side was wearing and is kept only until the next prestige, because what
    // it feeds is one period's answer to which button the player actually pressed.
    //
    // Here rather than in a writer of its own for the reason `calls` is: `call` is in hand, this runs
    // exactly once per settled throw, and a second counter of the same event written somewhere else is
    // a second thing to keep in step. Replaced rather than mutated, like every level around it — a
    // frame mid-reveal is still holding the pre-roll object.
    const wore = s.sides[call];
    if (wore) {
        s.pressed = { ...s.pressed, [wore]: (Number(s.pressed[wore]) || 0) + 1 };
        patch.pressed = s.pressed;
        // Which one the period finished on, for the one job of breaking a dead heat toward it. Written
        // every call rather than only on a tie, because a tie is only knowable at the prestige and by
        // then every call it would be about has been made.
        s.pressedLast = wore;
        patch.pressedLast = wore;
    }
    if (won) {
        s.wins = { ...s.wins, [call]: s.wins[call] + 1 };
        patch.wins = s.wins;
    }
    if (level > s.bestLevel) {
        s.bestLevel = level;
        patch.bestLevel = level;
    }
    if (standing > s.bestStanding) {
        s.bestStanding = standing;
        patch.bestStanding = standing;
    }
    // Every stamp below is this one, so the three records a single roll can break all carry the same
    // moment rather than three readings of the clock taken microseconds apart.
    const now = Date.now();
    const stamp = function (key) {
        s.bestAt = { ...s.bestAt, [key]: now };
        patch.bestAt = s.bestAt;
    };
    if (line > s.bestCubes) {
        s.bestCubes = line;
        patch.bestCubes = line;
        stamp('cubes');
    }
    if (multiple > s.bestMultiple) {
        s.bestMultiple = multiple;
        patch.bestMultiple = multiple;
        stamp('multiple');
    }
    s.streak = won ? s.streak + 1 : 0;
    patch.streak = s.streak;
    // **Filed here rather than with the others at the top, and it has to be.** Every record above is
    // read off a figure the roll arrived carrying, so all of them can be judged before anything moves.
    // A streak record cannot: the streak *is* the thing this roll changes, so there is nothing to
    // compare until it has changed. Written onto the same object all the same, because a caller asking
    // "what did this roll break" should not have to know that one of the answers is late.
    records.streak = s.streak > s.bestStreak;
    if (records.streak) {
        s.bestStreak = s.streak;
        patch.bestStreak = s.streak;
        stamp('streak');
    }

    // **The cold streak, which only the opening rung can move.** Late for the same reason the streak is,
    // and conditional where the streak is not: a roll that is not the rung a run opens on leaves both
    // counters exactly as it found them, so a bust at Level 5 says nothing about the coin.
    //
    // **No window entry and no stamp**, unlike every record above. Those two exist for the board, and
    // this is deliberately not on it: a leaderboard of misfortune is a thing to farm, and the whole
    // point of the figure is that nobody can influence it. It is a stat and a line on a bust screen.
    if (opening) {
        s.cold = won ? 0 : s.cold + 1;
        patch.cold = s.cold;
        records.cold = !won && s.cold > s.coldest;
        if (records.cold) {
            s.coldest = s.cold;
            patch.coldest = s.coldest;
        }
    }

    // **This week's and this month's bests, for the board**, kept alongside the lifetime ones rather
    // than derived from them — a lifetime best carries no date, so there is nothing to derive from.
    //
    // Written whole and only when something moved, which also does the reset: the stored window was
    // read back as zeroes if its key was stale, so the first roll of a new week files fresh numbers
    // under the new id and last week's simply stop being read.
    for (const [name, keyOf] of Object.entries(WINDOWS)) {
        const id = keyOf();
        const was = windowOf(s[name], id);
        const now3 = { multiple, cubes: line, streak: s.streak };
        const beat = key => now3[key] > was[key];
        if (beat('multiple') || beat('cubes') || beat('streak') || s[name].id !== id) {
            s[name] = {
                id,
                multiple: Math.max(was.multiple, multiple),
                cubes: Math.max(was.cubes, line),
                streak: Math.max(was.streak, s.streak),
                // A window's stamp only moves when that window's figure does, which is not the same
                // question as whether the lifetime best moved: a player can set this week's biggest
                // multiple with a roll that is nowhere near their own record.
                at: {
                    multiple: beat('multiple') ? now : was.at.multiple,
                    cubes: beat('cubes') ? now : was.at.cubes,
                    streak: beat('streak') ? now : was.at.streak,
                },
            };
            patch[name] = s[name];
        }
    }
    return records;
};

// **A tie, however it was settled.** Three paths reach a settled tie and they are not the same event:
// Watto rolls his own cube, the player buys the tie outright, or a Boonta face on the line wins it
// without asking anybody. Only the first has a result in doubt, which is why it is the only one whose
// win rate is worth reading — a bought tie and a Boonta are wins by construction.
//
// `blue`/`red` count **his cube only**. A bribe throws nothing and a Boonta throws nothing, so giving
// either one a colour would put a face on the board that never landed. His cube is weighted against
// your *call* rather than toward a colour, so the split is the check on that: it should sit near even
// however the tie-lean is tuned, and a drift means the lean is leaking into a side.
//
// Called from `settleThrow`, which runs exactly once per throw — a parked tie does not settle until it
// is answered, so there is no double count on the resume.
exports.recordTie = function (s, patch, { bribed, breaker, call }) {
    const t = { ...s.ties };
    t.total += 1;
    if (bribed) t.bribed += 1;
    else if (breaker) {
        t.rolled += 1;
        if (breaker === 'blue') t.blue += 1;
        if (breaker === 'red') t.red += 1;
        if (breaker === call) t.won += 1;
        // The same throw filed a second way: colour crossed with result rather than each on its own. It is
        // the one thing the flat tallies cannot be asked afterwards — see the note on `wonBlue` in
        // `cubeState` — and it costs a branch on a path that runs once per throw.
        if (breaker === 'blue') breaker === call ? t.wonBlue += 1 : t.lostBlue += 1;
        else if (breaker === 'red') breaker === call ? t.wonRed += 1 : t.lostRed += 1;
    }
    s.ties = t;
    patch.ties = t;
};

// Folds a roll's special faces into the lifetime tallies behind the rack screen: `{ cubeId: { key:
// count } }`, one key per distinct face. `end` is runs this cube has killed and `broken` is times
// it has shattered, so those two fall out of the same counter rather than needing their own.
//
// Every level is **replaced** rather than mutated, for the same reason `recordRoll` does it: a
// frame mid-reveal is still holding a pre-roll snapshot and would otherwise follow the reference
// into the new numbers.
exports.recordFaces = function (s, patch, log) {
    if (!log || !log.length) return;
    const faces = { ...s.faces };
    for (const { id, key } of log) {
        const cube = { ...(faces[id] || {}) };
        cube[key] = (Number(cube[key]) || 0) + 1;
        faces[id] = cube;
    }
    s.faces = faces;
    patch.faces = faces;
};

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------
//
// A run walks a route of **rungs**: the five levels, plus the `Again` rungs still standing in the
// gaps between them. An Again is the same table thrown again — no new cubes, no new draw — and
// surviving one collapses it for good, so the road to the top gets shorter every time a run gets
// one rung further than the last.
//
// **The route needs no state of its own.** Gaps fill strictly in order, so `unlocked` (how many
// have filled) and `clears` (how far into the current one you are) describe it completely. Those
// are the two fields the old clears meter already kept, which is why this could replace it without
// a migration: a profile written by the previous model reads back as a valid route.

// The deepest level this player may put on the table, and the gap they are currently working.
// Nothing stops a run *here* any more — the route simply carries on with Agains — but this is
// still where new cubes stop coming and where clears are earned.
const topOf = s => Math.min(s.unlocked, MAX_LEVEL);
exports.topOf = topOf;

// Agains per gap. Every *other* prestige adds one, so re-walking the route lengthens without
// running away from you — one per prestige turned the fourth re-climb into a slog — and it
// **stops** at `maxClears`, because the growth is paid for by the rack and the rack is finite.
//
// A cycle costs `30(g+1) + 2` runs — the forced-bank model's `30c + 2` with `c = g + 1`, measured
// to the run. See `clearsToUnlock` for why the shift is exactly one and why the shipped numbers
// moved down a step to absorb it.
const gapSize = s => Math.min(
    config.clearsToUnlock + Math.floor(s.prestige / config.clearsPrestigeStep),
    config.maxClears,
);
exports.gapSize = gapSize;
// The name the scripts and the API grew up with. Same number, and the route is what it means now.
exports.clearsPerLevel = gapSize;

const goalOf = s => (s.unlocked >= MAX_LEVEL ? config.clearsToPrestige : gapSize(s));
exports.goalOf = goalOf;

// Prestige is offered, never forced. Earned by surviving Level 5 and **written to the profile the
// moment it is** — pushing on past the top and busting cannot take it back, because the throw that
// earned it has already had its patch written. It then sits there until the player takes it.
exports.canPrestige = s => s.unlocked >= MAX_LEVEL && s.clears >= config.clearsToPrestige;

// The whole route, in order, for anything that wants to draw it. Cleared Agains are **kept** and
// flagged rather than dropped: the run skips them, but the map is a progress bar and a progress bar
// needs to show the ground already covered. Levels past `unlocked` are marked locked.
//
// Past Level 5 the route is endless, which no map can draw — see `endless` on the return.
exports.routeOf = function (s) {
    const g = gapSize(s);
    const top = topOf(s);
    const rungs = [];
    for (let level = 0; level <= MAX_LEVEL; level++) {
        rungs.push({ kind: 'level', level, index: 0, cleared: level <= top, locked: level > top });
        if (level === MAX_LEVEL) break;
        // Gaps below the frontier are spent; the frontier's is however far `clears` has got;
        // everything above is untouched and unreachable.
        const done = level < top ? g : (level === top ? Math.min(s.clears, g) : 0);
        for (let index = 0; index < g; index++) {
            rungs.push({
                kind: 'again', level, index, cleared: index < done, locked: level > top,
            });
        }
    }
    return { rungs, gap: g, top, endless: true };
};

// Where a run standing on `level` goes if it pushes. Three cases and no others:
//
//   below the frontier   the gap under it is already spent, so the next level
//   at the frontier      whatever is left of this gap, then the level it opens
//   at Level 5           an Again, forever
//
// It reads `clears` live rather than counting the run's own Agains, and it has to: `awardClear`
// banks each one as it lands and moves `unlocked` when the gap fills, so the live state is already
// the answer. Counting them twice was the bug this shape avoids.
// `overtime` rather than `again` past the top, and it is a third kind rather than a flag because
// the two pay differently — there is no level left above to double what an Again adds up there, so
// it pays `overtimeBonus` instead. Callers that only care whether a rung is a level test against
// `'level'`, never against `'again'`.
const nextRung = function (s, level) {
    const at = Math.max(0, Math.min(Number(level) || 0, MAX_LEVEL));
    if (at >= MAX_LEVEL) return { kind: 'overtime', level: MAX_LEVEL };
    if (at < topOf(s)) return { kind: 'level', level: at + 1 };
    return s.clears < gapSize(s)
        ? { kind: 'again', level: at }
        : { kind: 'level', level: at + 1 };
};
exports.nextRung = nextRung;

// Whether surviving the rung a run is standing on banks a clear. An Again in a gap does; the level
// rung above it does not, because that level is already open. Level 5 is the exception at both
// ends — it is the prestige gate, and the Agains past it are worth nothing but truguts.
exports.rungClears = (level, again) => (level >= MAX_LEVEL
    ? !again
    : !!again);

// ---------------------------------------------------------------------------
// Clears and unlocks
// ---------------------------------------------------------------------------

// One Again collapsed off the route, or — at the top — the prestige earned. Enough of them and the
// gap fills, the next level unlocks, and Watto grudgingly puts two more cubes on the table.
//
// **This no longer ends anything.** It used to be called on a roll that was already force-banking;
// it is now called on a roll that is still live, can be called several times in one run, and the
// unlock it hands over is something the run pushes straight into.
//
// Mutates `s` and `patch`. Returns null when there was nothing left to bank toward, otherwise
// `{ unlocked, prestige }` — the index of a level this clear opened, and whether it earned the
// prestige offer. Either of those means a gap just filled.
exports.awardClear = function (s, patch) {
    const goal = goalOf(s);
    if (s.clears >= goal) return null;
    const clears = s.clears + 1;
    if (clears < goal) {
        patch.clears = clears;
        s.clears = clears;
        return { unlocked: null, prestige: false };
    }
    if (s.unlocked >= MAX_LEVEL) {
        patch.clears = clears;
        s.clears = clears;
        return { unlocked: null, prestige: true };
    }
    s.unlocked += 1;
    s.clears = 0;
    patch.unlocked = s.unlocked;
    patch.clears = 0;
    return { unlocked: s.unlocked, prestige: false };
};

// ---------------------------------------------------------------------------
// Prestige rewards
// ---------------------------------------------------------------------------

// What each pick looks like once it is owned.
//
// `TREE` is keyed by reward value, so this is the one place a node id turns into a question about
// the profile — and it is why the tree table can name a prerequisite without knowing whether it is a
// cube, a perk or a rung. `press` is the odd one: it is a single value bought `weldTiers.length`
// times, so it counts as held only once the ladder is finished.
const HELD = {
    reroll: s => s.buyReroll,
    nudge: s => s.nudge,
    bribe: s => s.bribe,
    scrap: s => s.scrap,
    double: s => s.double,
    keeper: s => s.keeper,
    split: s => s.split,
    premonition: s => s.premonition,
    shuffle: s => s.shuffle,
    sidebet: s => s.sidebet,
    press: s => s.pressTier >= config.weldTiers.length,
};

// **Every cube the player has bought, including the ones standing inside a weld.**
//
// A weld consumes its parents: `weldCubes` swaps the two ids out of `s.cubes` for the weld's, because
// there is one cube in that seat now and the bag has to say so. That is the right answer to *where is
// this cube* and the wrong one to *have I bought this node* — and `s.cubes` was answering both. So
// pressing two cubes together put both of their nodes back on the rack: they lit up as buyable, their
// children fell back to locked, and a build token would buy a cube the player already owned.
//
// The rack is a record of what has been bought. Nothing you own ever leaves it, and a weld is a place
// two cubes are standing rather than proof they are gone.
//
// A worklist rather than one pass, because a parent that is itself a weld is representable in an id
// even though `weldCubes` refuses to make one — and a rule that only holds while another rule holds
// is the kind that comes apart the day the second one changes.
const cubesHeld = function (s) {
    const out = new Set();
    const rest = [...s.cubes];
    while (rest.length) {
        const id = rest.pop();
        if (out.has(id)) continue;
        out.add(id);
        for (const parent of engine.weldParents(id) || []) rest.push(parent);
    }
    return out;
};
exports.cubesHeld = cubesHeld;

const holds = function (s, value) {
    if (value.startsWith('cube:')) return cubesHeld(s).has(value.slice(5));
    const test = HELD[value];
    return test ? !!test(s) : false;
};
exports.holds = holds;

// The copy for everything that isn't a cube. Cubes carry their own name and blurb in `SPECIALS`, so
// only the perks need it written out — here, where the numbers they quote live.
const PERKS = {
    reroll: {
        kind: 'reroll',
        label: 'Purchase Rerolls',
        description: 'Buy rerolls with truguts and bank them for a losing roll.',
    },
    nudge: {
        kind: 'nudge',
        label: "Qui-Gon's Nudge",
        // Reads off `nudgeLean`, not `tieLean`. The Nudge holds its own weight rather than turning
        // his around, so quoting his numbers here would promise a 60/40 the pick no longer pays.
        description: `Watto's tie-breaker leans ${Math.round(config.nudgeLean * 100)}/${Math.round((1 - config.nudgeLean) * 100)} your way instead of his.`,
    },
    bribe: {
        kind: 'bribe',
        label: 'Bribe Ties',
        description: 'Buy a tie off him outright instead of trusting his cube.',
    },
    scrap: {
        kind: 'scrap',
        label: 'Scrap',
        description: 'Once a run, take one cube off the line before anything it does happens.',
    },
    double: {
        kind: 'double',
        label: 'Double or Nothing',
        description: 'Once a climb, double the stake on a rung. A loss takes all of it.',
    },
    keeper: {
        kind: 'keeper',
        label: 'The Keeper',
        description: 'Name one face the press must carry through the cut.',
    },
    split: {
        kind: 'split',
        label: 'Split',
        description: 'Once a run, break a welded cube on the line back into the cubes it was pressed from.',
    },
    premonition: {
        kind: 'premonition',
        label: 'Premonition',
        description: 'Once a run, see one face of the next roll before you call it.',
    },
    // **`shuffle` the value, Swap the name.** The stored flag and the reward value cannot move — the
    // one is on saved profiles and the other is what a stale client sends — but the label can, and it
    // had to: the pick exchanges exactly two named positions, where a shuffle randomises a whole set.
    // The engine has always called it a swap (`can.swap`, `run.swapped`, the `a`/`b` fields); this is
    // the screen catching up with it. It also puts the three picks that act on a held line into one
    // shape — Swap, Scrap, Split — which is what they are: one-syllable verbs on a ten-second clock.
    shuffle: {
        kind: 'shuffle',
        label: 'Swap',
        description: 'Once a run, swap two cubes on the line before anything they do happens.',
    },
    sidebet: {
        kind: 'sidebet',
        label: 'Side Bet',
        description: 'Once a run, name one of the three prices Watto has chalked up. It pays onto the multiple, and the deeper you leave it the less it is worth.',
    },
};

// Whether a tree is open at all.
//
// Only The Forger has a condition and it is not a number: `overflow` is `cubes > bagSize()`, so the
// press tab appears on the first cube you own that you cannot field. That is the whole argument for
// the press stated as a gate — before it, the tab answers a question nobody has asked; after it, it
// is the only answer there is. Derived rather than written down, so it moves if the bag ever does.
const treeOpen = function (s, id) {
    const tree = TREES.find(t => t.id === id);
    if (!tree || !tree.opens) return true;
    if (tree.opens === 'overflow') return s.cubes.length > engine.bagSize();
    return true;
};
exports.treeOpen = treeOpen;

const reachable = function (s, node) {
    if (node.requires && !node.requires.every(v => holds(s, v))) return false;
    if (node.requiresAny && !node.requiresAny.some(v => holds(s, v))) return false;
    if (node.pressTier && s.pressTier < node.pressTier) return false;
    return true;
};

// One entry, dressed. Cubes read off `SPECIALS`, perks off `PERKS`, and the press off whichever rung
// is next — which is also where its tier comes from, since it has no fixed one.
const entryOf = function (s, value, node) {
    if (node.ladder === 'weldTiers') {
        const next = config.weldTiers[s.pressTier];
        return {
            value, kind: 'press', tier: s.pressTier + 1, label: next.name, description: next.blurb,
        };
    }
    if (value.startsWith('cube:')) {
        const sp = specialById(value.slice(5));
        return {
            value, kind: 'cube', id: sp.id, tier: node.tier, label: sp.name, description: sp.blurb,
        };
    }
    const perk = PERKS[value];
    return {
        value, kind: perk.kind, tier: node.tier, label: perk.label, description: perk.description,
    };
};

// What a build token buys **right now**: every node in `TREE` whose tree is open, whose
// prerequisites are all owned, and which isn't owned already.
//
// **The rack is the same rack.** Nothing here is new content and nothing is priced differently — the
// list is still finite and it still empties, and the press is still the sink at the end that does
// not. What changed is that it now has an order, and the order is what turns a point into a decision
// instead of a shopping trip. The reasoning for every edge lives on the table in `tuning.js`.
//
// **Prerequisites gate the offer, never the ownership.** A profile that bought its cubes off the old
// flat list keeps every one of them; `s.cubes` is read exactly as it always was. A player who owns
// Guide without owning the Wild simply sees Guide as held and the Wild as still on the rack, which is
// the right answer — nothing was taken away and nothing is granted for free.
//
// Returned as plain data, with `tree` and `tier` on every entry so a client can lay the graph out
// without holding a second copy of it. The Discord select menu this also feeds caps at 25 options and
// the flat list had grown to 21 of them; gated, it never returns close to that.
exports.rewardChoices = function (s) {
    const out = [];
    for (const [value, node] of Object.entries(TREE)) {
        if (!treeOpen(s, node.tree)) continue;
        if (holds(s, value)) continue;
        if (!reachable(s, node)) continue;
        out.push({ ...entryOf(s, value, node), tree: node.tree });
    }
    return out;
};

// The whole rack, dressed, with no player in it.
//
// `rewardChoices` answers *what can I buy now*; this answers *what is there*, which is a different
// question and the one a tree drawing needs. A client that only knew about reachable nodes could not
// draw a locked one — and the top of a tree you cannot see is a branch you cannot choose.
//
// **The press is expanded here and nowhere else.** Four rungs share one reward value, which is right
// for a purchase and wrong for a drawing, so this is where they become four entries with a `rung`
// apiece. Everything downstream — the tab layout, the owned test, the prerequisite label — reads
// them as four ordinary nodes.
exports.treeCatalogue = function () {
    const out = [];
    for (const [value, node] of Object.entries(TREE)) {
        const common = {
            value,
            tree: node.tree,
            requires: node.requires || [],
            requiresAny: node.requiresAny || [],
        };
        if (node.ladder === 'weldTiers') {
            config.weldTiers.forEach((rung, i) => out.push({
                ...common, kind: 'press', rung: i + 1, tier: i + 1, label: rung.name, description: rung.blurb,
            }));
            continue;
        }
        if (value.startsWith('cube:')) {
            const sp = specialById(value.slice(5));
            out.push({
                ...common, kind: 'cube', id: sp.id, tier: node.tier, label: sp.name, description: sp.blurb,
            });
            continue;
        }
        const perk = PERKS[value];
        out.push({
            ...common,
            kind: perk.kind,
            tier: node.tier,
            // A node that needs a press rung is drawn hanging off that rung, so the prerequisite has
            // to survive as something a client can name — see `pressTier` in `TREE`.
            pressTier: node.pressTier || 0,
            label: perk.label,
            description: perk.description,
        });
    }
    return out;
};

// Which profile flag each once-only perk sets. Every one of them is a plain boolean — the perk is
// either on the rack or on the profile — so they are a table rather than seven near-identical
// branches, and adding an eighth is a line here and a line in `TREE`.
//
// `buyReroll` is the one name that doesn't match its reward value, and it stays that way: the value
// is what a stale client sends and the flag is what a stored profile already holds, so neither is
// free to move.
const FLAGS = {
    reroll: 'buyReroll',
    nudge: 'nudge',
    bribe: 'bribe',
    scrap: 'scrap',
    double: 'double',
    keeper: 'keeper',
    split: 'split',
    premonition: 'premonition',
    shuffle: 'shuffle',
    sidebet: 'sidebet',
};

// Grants one reward. Reached only through `spendPoint`, which is what charges for it.
const grantReward = function (s, patch, value) {
    const flag = FLAGS[value];
    if (flag) {
        s[flag] = true;
        patch[flag] = true;
        return;
    }
    // One rung up the press. Clamped rather than trusted: a stale menu holding `press` after the last
    // rung has been bought must not be able to push the tier past what `weldSplits` has cuts for.
    if (value === 'press') {
        if (s.pressTier >= config.weldTiers.length) return;
        s.pressTier += 1;
        s.pressCubes = s.pressTier >= 3 ? 3 : 2;
        patch.pressTier = s.pressTier;
        return;
    }
    const id = value.startsWith('cube:') ? value.slice(5) : null;
    // `OFF_RACK` is re-checked here and not only in `rewardChoices`, for the same reason eligibility is
    // re-checked on the select: a menu rendered before this rule existed must not be able to spend a
    // build token on a cube that was never for sale.
    // **`cubesHeld` rather than `s.cubes`**, which is the difference between a cube you do not have and
    // a cube standing inside one of your welds. On `s.cubes` alone, pressing two cubes together handed
    // both of their nodes back to the rack and this would sell one of them a second time.
    if (!id || !specialById(id) || cubesHeld(s).has(id) || OFF_RACK.has(id)) return;
    s.cubes = [...s.cubes, id].filter(cid => specialById(cid));
    patch.cubes = Object.fromEntries(s.cubes.map(cid => [cid, true]));
    // **A cube you picked goes on the table if there is a seat for it**, and onto the bench if there
    // isn't. The bag holds `bagSize()` and the loadout is capped to it, so a pick made with eight
    // already fielded cannot join them without silently throwing one of them off — which is worse than
    // arriving benched, because the cube it displaced was one the player chose.
    //
    // Benched is still visible: the rack screen lists it under *On the bench* and the equip menu opens
    // on the same press that spent the point. What must never happen again is the pick reporting
    // success while nothing on the screen changed, which is what the old `if (s.equipped.length <
    // s.slots)` did when the cap was a number you bought rather than one every rack shares.
    if (s.equipped.length < engine.bagSize()) {
        s.equipped = [...s.equipped, id];
        patch.equipped = s.equipped;
    }
};

// Hand the whole ladder back for a bigger ceiling and a point to spend off the rack. Everything
// about the climb resets; the lifetime record, the truguts and everything already granted do not.
//
// **The pick is not made here.** A prestige banks a point and stops, so nothing about handing the
// ladder back depends on having decided what to buy with it — and an unspent point is no longer an
// offer standing in the way of the clear meter. See `spendPoint`.
exports.applyPrestige = function (s, patch) {
    s.prestige += 1;
    s.unlocked = 0;
    s.clears = 0;
    s.maxStake = maxStakeFor(s.prestige);
    s.rerollCost = rerollCostFor(s.prestige);
    s.points += 1;
    patch.prestige = s.prestige;
    patch.unlocked = 0;
    patch.clears = 0;
    patch.points = s.points;
    // Watto's price for a tie goes back to the bottom of its ladder. It is the one thing a
    // prestige *gives* back, and it's what stops the bribe pricing itself out of the game
    // permanently — the ladder it climbs is per-prestige, like the ladder of levels.
    s.bribes = 0;
    patch.bribes = 0;
    // **The press tally is a period, and this is the end of one.** Cleared here beside the other three
    // per-prestige counters, which is what makes the figure the prestige screen quotes an answer about
    // the stretch just finished rather than a lifetime total nothing could ever move off its winner.
    //
    // `null` rather than `{}` in the patch, which is a Firebase delete: `pruned` strips only
    // `undefined`, so the null survives the trip and takes the whole map with it. Written as an empty
    // object in memory, because that is what the read hands back and the two must agree.
    // **Banked before it is cleared**, which is the whole of what a prestige leaves behind here: the
    // winner of the tally becomes the cell for the prestige just taken. Appended at `prestige - 1`
    // because the comb is positional, and the increment above has already happened — so this lands at
    // the end of an array `combOf` will read back as exactly `prestige` long.
    //
    // A period with no calls in it banks a hole, the same as an unrecorded past one. A prestige taken
    // off an offer banked long ago, with nothing rolled since, has nothing to say about what was
    // pressed — and saying so is better than crediting it to whatever happens to be equipped.
    s.comb = [...s.comb, exports.pressWinner(s)];
    patch.comb = s.comb;
    // **And the choice it opens.** Every prestige is a chance to re-wear any cell in the comb, and this
    // is the only press that offers it — so the offer is stored, not held, and it survives the Activity
    // being re-mounted under it.
    s.pick = true;
    patch.pick = true;
    s.pressed = {};
    patch.pressed = null;
    s.pressedLast = null;
    patch.pressedLast = null;
};

// Spends one banked point on one thing off the rack. The caller checks the value is actually on
// offer — see `actions.spendPoint`, which is where a refusal has somewhere to go.
exports.spendPoint = function (s, patch, value) {
    exports.spendPoints(s, patch);
    grantReward(s, patch, value);
};

// **The Heavy Half's point, handed back.** A migration with an expiry date rather than a rule.
//
// `heavy` was sold off The Forger for a build token and never did anything: `orderFor` in the engine
// implements it, `rollWeld` accepts it as `major`, and no caller ever passed it — so every profile
// holding the flag paid for a mechanic that has never once run. The node is gone and the choice it
// bought now comes with press rung 4, which means there is nothing left to grant those players and a
// point to return.
//
// Called from `spendPoint` **before** its own balance check, so the refund lands as spendable rather
// than as a number that has to be noticed and re-visited. Clearing the flag is what makes it once.
//
// Nothing tests the flag any more — `heavy` is out of `TREE`, `PERKS`, `FLAGS` and `HELD`, so it can
// neither be offered nor re-bought. **Delete this and the `heavy` read in `cubeState` together**, once
// no live profile carries it.
exports.refundDeadHeavy = function (s, patch) {
    if (!s.heavy) return false;
    s.heavy = false;
    s.points += 1;
    patch.heavy = false;
    patch.points = s.points;
    return true;
};

// Points out, with nothing granted for them. The press spends this way: a weld is not a thing off
// Watto's rack, so routing it through `grantReward` would mean handing that function a reward id it
// has no case for and trusting it to do nothing.
exports.spendPoints = function (s, patch, n = 1) {
    s.points = Math.max(0, s.points - n);
    patch.points = s.points;
};

// ---------------------------------------------------------------------------
// The press
// ---------------------------------------------------------------------------
//
// Three mutators, and between them they own every write the weld makes. The **actions** decide
// whether a press is allowed and what it costs; these decide what the profile looks like afterwards.

// Writes both halves of ownership at once — `cubes` is the stored `{ id: true }` map and `equipped`
// the ordered loadout — so a cube can never end up fielded but unowned, or owned in one and not the
// other. `gone` comes off both, `got` goes onto both.
//
// **A weld inherits its parents' seat.** It lands at the position of the first parent it replaces
// rather than on the end, because the loadout is an ordered list the player arranged and a press
// should not quietly reshuffle it.
// **What was benched stays benched.** If neither cube being replaced was on the table, what replaces
// them is not either — pressing two spares together should not quietly field the result, and breaking
// a benched weld should not field its parents.
// **And nothing is displaced to make room.** Breaking a weld on a full rack hands back two cubes for
// one seat, so only what fits goes in and the rest lands on the bench. Trimming the tail instead would
// throw off a cube the player put there to make room for one they didn't ask to field.
const swapCubes = function (s, patch, gone, got) {
    const drop = new Set(gone);
    const at = s.equipped.findIndex(id => drop.has(id));
    s.cubes = [...s.cubes.filter(id => !drop.has(id)), ...got].filter(id => specialById(id));
    const kept = s.equipped.filter(id => !drop.has(id));
    const was = s.equipped.slice(0, Math.max(at, 0)).filter(id => !drop.has(id)).length;
    const fits = got.slice(0, Math.max(0, engine.bagSize() - kept.length));
    s.equipped = (at < 0 ? kept : [...kept.slice(0, was), ...fits, ...kept.slice(was)])
        .filter(id => s.cubes.includes(id));
    patch.cubes = Object.fromEntries(s.cubes.map(id => [id, true]));
    patch.equipped = s.equipped;
};

// Files a weld under its pairing so the press will not hand it back. Capped at `weldMemory` and
// **floored below the pairing's outcome space**, because a pairing with only one possible weld — the
// Gungan Shield gives up exactly one half — must not be excluded to nothing.
exports.rememberWeld = function (s, patch, id) {
    const key = pairKeyOf(id);
    const parents = engine.weldParents(id);
    if (!key || !parents) return;
    // Floored against what the press **routinely** produces rather than the whole space: `weldPurity`
    // keeps all but 1% of presses to welds carrying a downside face, and excluding against a total that
    // includes the clean ones let a small pairing be excluded down to nothing. See `weldDrawSpace`.
    const cap = Math.max(0, Math.min(config.weldMemory, engine.weldDrawSpace(parents) - 1));
    const seen = [id, ...(s.weldSeen[key] || []).filter(x => x !== id)].slice(0, cap);
    s.weldSeen = { ...s.weldSeen };
    if (seen.length) s.weldSeen[key] = seen;
    else delete s.weldSeen[key];
    // Written whole rather than by key, for the reason `recordRoll` replaces its objects: a frame
    // holding a pre-press snapshot would otherwise follow the reference into the new list.
    patch.weldSeen = s.weldSeen;
};

// Presses two cubes into one. The parents are consumed; the weld takes their seat.
exports.weldCubes = function (s, patch, ids, id) {
    swapCubes(s, patch, ids, [id]);
    exports.rememberWeld(s, patch, id);
};

// Replaces a weld with another cut of the same two cubes. Ownership swaps, and the new one is filed.
exports.recutWeld = function (s, patch, from, to) {
    swapCubes(s, patch, [from], [to]);
    exports.rememberWeld(s, patch, to);
};

// Breaks a weld back into the cubes it was made of. **The roll is lost and the memory with it** —
// unwelding is free, so the price of experimenting is the work, not truguts. Stardew's ring unforge
// is free *and* lossless because a combined ring carries no random state; a weld does, and that is
// what makes a pairing a commitment rather than a free experiment.
exports.unweldCube = function (s, patch, id) {
    const parents = engine.weldParents(id);
    if (!parents) return null;
    swapCubes(s, patch, [id], parents);
    const key = pairKeyOf(id);
    if (key && s.weldSeen[key]) {
        s.weldSeen = { ...s.weldSeen };
        delete s.weldSeen[key];
        patch.weldSeen = s.weldSeen;
    }
    return parents;
};

// Saves a loadout. Trusts nothing from the client: duplicates collapse, unknown or unowned ids are
// dropped, and **the list is cut to `bagSize()`** — so a stale menu can neither field a cube that
// isn't owned nor field more of them than a run can draw. The caller refuses an over-long request
// outright rather than letting it land here; this cut is the backstop under that, and the same one
// `cubeState` applies on read.
exports.setLoadout = function (s, patch, ids) {
    const equipped = [...new Set(ids)]
        .filter(id => s.cubes.includes(id))
        .slice(0, engine.bagSize());
    s.equipped = equipped;
    patch.equipped = equipped;
    return equipped;
};

// Bought rerolls, in and out. The stock is a plain counter on the profile — spent
// on a game over screen, never automatically.
exports.addReroll = function (s, patch, n) {
    s.rerolls = Math.max(0, s.rerolls + n);
    patch.rerolls = s.rerolls;
};

// One more tie bought, which makes the next one dearer. Counted rather than priced, so the
// escalation lives in one place and the price is always derived from it.
exports.addBribe = function (s, patch) {
    s.bribes += 1;
    patch.bribes = s.bribes;
};
