// The rules of Botto's Chance Cube. No Discord, no database, no rendering — throw a set of cubes
// in, get back what the line resolved to and everything it did to the run.
//
// **Notes are structured, not written.** Every effect reports what it did as data — a kind and its
// parameters — and the client turns that into prose. The engine used to emit Discord markdown with
// custom emoji baked into it, which meant the rules could only be played in an embed. What a face
// looks like and what it says about itself are both somebody else's problem now.
//
// Randomness is `crypto.randomInt` throughout, the same CSPRNG that decides every payout. Nothing
// here is seedable by design; the parity harness patches the module when it needs determinism.

const crypto = require('crypto');

const {
    LEVELS, SPECIALS, SIDES, POINTS, PLAIN_FACES, SIDE_IDS, SIDE_BETS, cube: config,
} = require('./tuning.js');

const OTHER = { blue: 'red', red: 'blue' };
exports.OTHER = OTHER;

// ---------------------------------------------------------------------------
// Cubes, welded and not
// ---------------------------------------------------------------------------
//
// **A weld is two cubes pressed into one, carrying three faces from each.** It takes one seat in the
// bag and one position on the line, and it throws one of its six faces per throw like any other cube.
//
// **Which three is a roll, not a choice.** The faces that made the cut *are* the cube, so a weld that
// came out badly is a weld worth rerolling — that is the whole mechanic. Rarely the press cuts
// unevenly, 4+2 or even 5+1; see `weldSplits` in the tuning and `docs/the-weld.md`.
//
// It is the only shape that survives the rule the rest of the game is built on: **a face either IS a
// side, or DOES a thing.** The obvious alternative — one face carrying *both* parents' effects, which
// is what a forged ring does in Stardew — would have to draw as two glyphs, and a position drawn as
// two glyphs is a position players count as two. Selecting faces obeys the one-glyph rule for free,
// because every face a weld throws is one of its parents' faces unchanged.
//
// **It replaced a pooled weld**, which carried all twelve faces at half the rate each. That is
// throughput-neutral and risk-neutral by arithmetic and it measured as a *downgrade* anyway: a rack's
// value is not spread evenly across its cubes — Wild measures 1.31 fielded alone against Greed's 0.31
// — so halving everything takes more off the cube carrying the rack than it gives back to the ones
// dragging it down. A pooled rack of all fourteen came out at 0.37 against a hand-picked eight at
// 0.90. `docs/the-weld.md` §4 is the record.
//
// ---------------------------------------------------------------------------
//
// **The id is the recipe**: `greed:012+wild:034`, each parent naming the face positions it gave up,
// parents sorted, positions sorted. That is what lets `specialById` stay a **pure function** — a weld
// needs nothing stored beyond its id, so the set, the bag and the loadout carry it exactly as they
// carry an ordinary cube, and an id this build cannot parse returns `null` and throws as a plain cube
// rather than crashing.
//
// Flat rather than nested, so `a:01+b:2+c:034` needs no special case. Only two-parent welds can be
// *rolled* (`rollWeld`), but three-parent ids parse and build, which is what leaves welding a weld
// open without committing to it.
const WELD_SEP = '+';
const PICK_SEP = ':';
exports.WELD_SEP = WELD_SEP;

const baseById = id => SPECIALS.find(s => s.id === id) || null;

// Faces that are not a downside. `end` is the mine and `broken` the wipeout; everything else is a
// face you would keep. Read off the face list so a new downside kind is covered by declaring it here
// and nowhere else.
const DOWNSIDE = new Set(['end', 'broken']);
const goodFaces = sp => (sp ? sp.faces.filter(f => !DOWNSIDE.has(f.kind)).length : 0);
exports.goodFaces = goodFaces;

// **Positions are canonicalised to the cube they produce, not the draw that produced it.** A cube's
// faces repeat — Wild is five identical wilds and a mine — so `wild:012` and `wild:013` are the same
// three wilds wearing different ids. Rebuilding the positions from the sorted face *ids* collapses
// every spelling of a cube onto one, which is what makes the id an identity: the reroll exclusion can
// compare ids instead of unpacking faces, and a player can never own two welds that are secretly the
// same cube.
const canonIdx = function (parent, idx) {
    const wanted = idx.map(i => parent.faces[i].id).sort();
    const used = new Set();
    const out = [];
    for (const fid of wanted) {
        const k = parent.faces.findIndex((f, i) => f.id === fid && !used.has(i));
        if (k < 0) return null;
        used.add(k);
        out.push(k);
    }
    return out.sort((a, b) => a - b);
};

// Picks in, canonical id out.
const weldId = picks => picks
    .map(p => ({ id: p.id, idx: canonIdx(baseById(p.id), p.idx) }))
    .filter(p => p.idx)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(p => `${p.id}${PICK_SEP}${p.idx.join('')}`)
    .join(WELD_SEP);
exports.weldId = weldId;

// **A weld refuses rather than half-builds.** An unknown parent, a repeat, a single part, a position
// that does not exist, a cube that is not weldable — all return null, which is the answer an unknown
// id has always given.
//
// Positions are single digits, which is sound because nothing weldable has ten faces: the eight-sided
// Planet Octahedron is the only cube past six and it carries `noWeld`. A weldable cube with ten faces
// would need this to change, and `parseWeld` would start rejecting it rather than silently misreading
// it, because every position has to be a digit *and* be in range.
const parseWeld = function (id) {
    const parts = id.split(WELD_SEP);
    if (parts.length < 2) return null;
    const picks = [];
    for (const part of parts) {
        const bits = part.split(PICK_SEP);
        if (bits.length !== 2) return null;
        const [pid, digits] = bits;
        const parent = baseById(pid);
        if (!parent || parent.noWeld) return null;
        if (!/^[0-9]+$/.test(digits)) return null;
        const idx = [...digits].map(Number);
        if (new Set(idx).size !== idx.length) return null;
        if (idx.some(i => i >= parent.faces.length)) return null;
        picks.push({ parent, id: pid, idx: idx.sort((a, b) => a - b) });
    }
    if (new Set(picks.map(p => p.id)).size !== picks.length) return null;
    return picks.sort((a, b) => (a.id < b.id ? -1 : 1));
};

// The parents of a weld, in canonical order — the stable identity of a *pairing*, which is what the
// reroll memory is keyed by. A weld's own id changes on every reroll; the pair it is made of does not.
exports.weldParents = function (id) {
    const picks = typeof id === 'string' && id.includes(WELD_SEP) ? parseWeld(id) : null;
    return picks ? picks.map(p => p.id) : null;
};

// Built once per distinct id rather than per throw: `specialById` is called for every position of
// every throw, and rebuilding a face list on each one would put an allocation in the hottest loop in
// the engine.
const weldCache = new Map();

const buildWeld = function (id) {
    const picks = parseWeld(id);
    if (!picks) return null;
    return {
        id: weldId(picks),
        name: picks.map(p => p.parent.name.replace(/ Cube$/, '')).join('-'),
        blurb: `${picks.length} cubes in one seat, and only the faces the press kept.`,
        // What went into it, in canonical order. The rack screen reads this to draw a weld as its
        // parents' records side by side.
        welded: picks.map(p => p.id),
        // **Every face remembers which cube it came from.** `from` is what keeps the lifetime tallies
        // keyed to the parent: a greed face thrown by a weld counts on the Greed Cube's record, so
        // the record survives unwelding and Shmi's `side:red` never merges with Anakin's. Keying the
        // tally by the weld's own id would destroy exactly the split the per-face record exists for.
        faces: picks.flatMap(p => p.idx.map(i => ({ ...p.parent.faces[i], from: p.id }))),
    };
};

const specialById = function (id) {
    if (!id || typeof id !== 'string') return null;
    if (!id.includes(WELD_SEP)) return baseById(id);
    if (weldCache.has(id)) return weldCache.get(id);
    const built = buildWeld(id);
    weldCache.set(id, built);
    return built;
};
exports.specialById = specialById;

// ---------------------------------------------------------------------------
// Rolling a weld
// ---------------------------------------------------------------------------

// Every cut this press can make at this tier, for this many cubes. **A rung the player has not bought
// is absent from the draw, not merely rare** — which is what makes an upgrade change the table rather
// than nudge a number.
const cutsFor = (parents, tier) => ((config.weldSplits || {})[parents] || [])
    .filter(s => (s.tier || 1) <= tier);
exports.cutsFor = cutsFor;

// How the press cuts this time. Weighted, and the weights are the entire control on how often an
// uneven cut turns up — there is no other brake, deliberately. See `weldSplits`.
const rollSplit = function (parents, tier) {
    const splits = cutsFor(parents, tier);
    const total = splits.reduce((n, s) => n + (s.weight || 0), 0);
    if (!total) return null;
    let r = crypto.randomInt(0, total);
    for (const s of splits) {
        r -= s.weight || 0;
        if (r < 0) return s.take;
    }
    return splits[0].take;
};

// `take` distinct positions from `n`, uniformly. Partial Fisher-Yates, off the same CSPRNG as
// everything else that decides a payout.
const pickIdx = function (n, take, from) {
    const all = from ? [...from] : Array.from({ length: n }, (_, i) => i);
    const len = all.length;
    for (let i = 0; i < take && i < len; i++) {
        const j = i + crypto.randomInt(0, len - i);
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, take).sort((a, b) => a - b);
};

// Which parent gets which share of the cut.
//
// `take` is written biggest-first, so the parent whose entry here is `0` takes the major share. Left
// alone that is a shuffle — see the note on `rollWeld` for why the press is not precision equipment.
// **Naming `major` buys exactly one choice**: the named parent takes the major share and the rest are
// still shuffled below it, so a 3+2+1 is half-decided rather than arranged. The choice comes with the
// uneven cut itself — any press that can cut unevenly honours it — and nothing here translates ids;
// `pressPicks` in `actions.js` is where a wire id becomes this index.
const orderFor = function (n, major) {
    const idx = Array.from({ length: n }, (_, i) => i);
    if (!Number.isInteger(major) || major < 0 || major >= n) return shuffle(idx);
    const order = [];
    order[major] = 0;
    shuffle(idx.filter(i => i !== major)).forEach((p, i) => { order[p] = i + 1; });
    return order;
};

// `take` positions off one parent with a named face guaranteed among them — The Keeper.
//
// It names a **face id**, not a position, so any position carrying that id satisfies it and a cube
// with five wilds is not five times harder to keep a wild from. A face the parent doesn't carry is
// ignored rather than refused: the draw falls back to the ordinary one, which is what a stale client
// naming a face off the wrong cube should get.
//
// **It does not touch `weldPurity`.** The anchor is drawn from the same pool as everything else, so
// on a pure press it is confined to the good faces with the rest, and on an ordinary one the
// remaining positions still roll for a downside exactly as they did.
const pickWith = function (parent, want, from, faceId) {
    const pool = from || Array.from({ length: parent.faces.length }, (_, i) => i);
    const hits = pool.filter(i => parent.faces[i].id === faceId);
    if (!hits.length || want < 1) return pickIdx(parent.faces.length, want, from);
    const anchor = hits[crypto.randomInt(0, hits.length)];
    const rest = pool.filter(i => i !== anchor);
    return [anchor, ...pickIdx(parent.faces.length, want - 1, rest)].sort((a, b) => a - b);
};

// How many **distinct** halves a cube can give up, which is far fewer than the positions suggest
// because its faces repeat: Wild is five identical wilds and a mine, so three-of-six is either three
// wilds or two and the mine. Two outcomes, not twenty.
// `goodOnly` counts the halves a **pure** press could produce — the draw confined to non-downside
// positions. `weldSpace` needs both totals to work out how big the space the press routinely draws
// from actually is.
const halvesCache = new Map();
const distinctHalves = function (parent, take, goodOnly) {
    const key = `${parent.id}|${take}|${goodOnly ? 'good' : 'all'}`;
    if (halvesCache.has(key)) return halvesCache.get(key);
    const from = parent.faces
        .map((f, i) => ((goodOnly && DOWNSIDE.has(f.kind)) ? -1 : i))
        .filter(i => i >= 0);
    const seen = new Set();
    const walk = function (at, chosen) {
        if (chosen.length === take) {
            seen.add(chosen.map(k => parent.faces[k].id).sort().join(','));
            return;
        }
        if (at >= from.length) return;
        walk(at + 1, [...chosen, from[at]]);
        walk(at + 1, chosen);
    };
    walk(0, []);
    halvesCache.set(key, seen.size);
    return seen.size;
};

// The size of a pairing's outcome space at the commonest split — what `rememberWeld` floors the
// reroll memory against so a pairing can never be excluded to nothing.
//
// **The floor earns its keep on any parent with few distinct faces**, and the Gungan Shield used to be
// the extreme case: at six shield faces it had exactly *one* half, so a pairing containing it had an
// outcome space of one. It carries a wipeout now and has two, which doubles every space it appears in —
// the reason the counts in `scripts/cubeWeld.js` moved without this arithmetic changing.
//
const spaceCache = new Map();
const spaceOf = function (ids, routine) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    const key = `${ids.join('+')}|${routine ? 'routine' : 'all'}`;
    if (spaceCache.has(key)) return spaceCache.get(key);
    const parents = ids.map(baseById);
    let n = 0;
    if (!parents.some(p => !p)) {
        // Measured at the **commonest** cut for this many cubes — the one every tier has — since that
        // is the draw the memory is nearly always excluding against.
        const cuts = (config.weldSplits || {})[ids.length] || [];
        const take = (cuts[0] && cuts[0].take) || parents.map(() => 3);
        const want = k => Math.min(take[k] ?? 3, parents[k].faces.length);
        n = parents.reduce((acc, p, k) => acc * distinctHalves(p, want(k)), 1);
        // A pairing with no downside face anywhere is never constrained, so all of its space is routine.
        const anyDownside = parents.some(p => p.faces.some(f => DOWNSIDE.has(f.kind)));
        if (routine && anyDownside) {
            const clean = parents.reduce((acc, p, k) => acc * distinctHalves(p, want(k), true), 1);
            n = Math.max(1, n - clean);
        }
    }
    spaceCache.set(key, n);
    return n;
};
exports.weldSpace = ids => spaceOf(ids, false);

// **What the press routinely produces, which is not the whole space.** `weldPurity` confines all but 1%
// of presses to welds carrying a downside face, so the clean ones have to come off the total before the
// reroll memory is floored against it — this is the number `rememberWeld` needs and `weldSpace` is not.
//
// Gungan+Wild is the pairing that proved the difference, and it is worth keeping the case even though
// the cubes have since moved out from under it. When the Shield was six shield faces the pairing had
// **two** distinct welds and exactly one of them kept Wild's mine, so flooring the memory against 2 let
// it exclude the only weld the press could hand back and the roll repeated inside its own memory.
// Against the routine space the floor was 1, which is the honest answer for a pairing with one routine
// outcome.
//
// Both cubes have changed since — the Wild gained a second mine, the Shield traded its mine for a
// wipeout — so the pairing now measures 6 total against 5 routine and no longer demonstrates anything.
// The distinction it was built to prove is unaffected: `weldPurity` still confines all but ~1% of
// presses to welds carrying a downside face, so the clean ones still have to come off the total, and
// mineless pairings like Mirror+Binder still have all 16 of their space routine.
exports.weldDrawSpace = ids => spaceOf(ids, true);

// **Roll a weld of two cubes.** `seen` is the ids this pairing has already produced and must not
// produce again — see `weldMemory`.
//
// The major share of an uneven split goes to a **rolled** parent, not a chosen one. That halves how
// often a rare split lands where the player wanted it, which is deliberate: the press is not
// precision equipment, and a 5+1 on the wrong cube is exactly the kind of near-miss that makes the
// next reroll worth buying. `major` is the one thing that buys the coin flip back — see `orderFor`.
//
// `keep` is The Keeper: `{ parent, faceId }`, one face the cut has to carry. Both of these arrive
// already checked against the profile; this function honours what it is handed.
//
// A split asking for more faces than a parent has is clamped rather than refused — nothing weldable
// has fewer than six faces today, so this is a guard against a future cube rather than a live path.
exports.rollWeld = function (ids, {
    seen = [], tier = 1, major = null, keep = null,
} = {}) {
    if (!Array.isArray(ids) || ids.length < 2) return null;
    if (new Set(ids).size !== ids.length) return null;
    const parents = ids.map(baseById);
    if (parents.some(p => !p || p.noWeld)) return null;
    // No cut for this many cubes at this tier is a refusal rather than a fallback: a player who has
    // not bought The Third Cube must not get one because the two-cube table happened to be reachable.
    if (!cutsFor(ids.length, tier).length) return null;

    const block = new Set(seen);

    // **The press keeps a downside face unless it very rarely doesn't.** `take` decides how many faces
    // come from each parent and says nothing about which, so left alone a 3+3 of two one-mine cubes
    // dropped both mines a quarter of the time — see `weldPurity` for what that was worth.
    //
    // A pairing with no downside face anywhere among its parents has nothing to inherit, so the rule
    // does not apply to it and the press does not invent one.
    const anyDownside = parents.some(p => p.faces.some(f => DOWNSIDE.has(f.kind)));
    // **Rolled once for the press, not once per attempt.** Per attempt, sixty draws each with a 1%
    // chance would let the rare case through about half the time — the loop below exists to dodge the
    // reroll memory and must not become sixty rolls of this.
    //
    // When it fires the draw is confined to the good faces rather than merely unconstrained, so
    // `weldPurity` **is** the rate a clean weld appears. Lifting the constraint instead would make the
    // rate `weldPurity × P(clean by chance)`, which is a different number for every pairing — 0.25% for
    // Greed+Wild against 0.04% for Multiplier+Boost — and would leave the dial naming something no
    // player could ever observe. It also has to be a real jackpot when it lands: a rare roll that then
    // hands you a 25% shot at the prize is not one.
    let pure = anyDownside && chance(config.weldPurity);
    // Which positions are worth keeping, per parent. Only consulted on a pure press.
    const goodIdx = parents.map(p => p.faces
        .map((f, i) => (DOWNSIDE.has(f.kind) ? -1 : i))
        .filter(i => i >= 0));

    // Bounded because the outcome space is tiny — six to twenty-one distinct welds for a real pairing
    // — so a handful of draws covers it, and falling through to an excluded roll is better than
    // looping. `weldMemory` is floored below the space size by `rememberWeld`, so this rarely bites.
    //
    // The floor is against the *whole* space, though, and this loop now rejects part of it: a Greed+Wild
    // pairing has four distinct welds, three of which carry a mine, so with two remembered there is
    // exactly one draw left to find. It terminates — a clean weld is never the only option, since the
    // downside faces are a minority of every parent — but a reroll on the smallest pairings is close to
    // deterministic, which is a property of those pairings being four cubes wide rather than of this rule.
    let last = null;
    for (let attempt = 0; attempt < 60; attempt++) {
        const take = rollSplit(ids.length, tier);
        if (!take) return null;
        // **The shares are dealt in a shuffled order, not to fixed positions.** With two cubes that is
        // the coin flip deciding which of them the major share lands on; with three it is the whole
        // arrangement of 3+2+1. Either way the player chose the cubes and the press chose the rest.
        // Fisher-Yates off the same CSPRNG as everything else — a comparator that returns random
        // numbers is not a shuffle and is biased in ways that depend on the sort implementation.
        const order = orderFor(parents.length, major);
        const picks = parents.map((p, k) => {
            const want = Math.min(take[order[k]] ?? take[take.length - 1], p.faces.length);
            // A cut deeper than the parent has good faces cannot be pure — five off the Reroll Cube,
            // which carries three downsides — so it falls back to the ordinary draw and comes out
            // carrying one. That is the right answer rather than an edge case: some cuts have no clean
            // version, and it only nudges the effective rate below `weldPurity` on the rarest splits.
            const from = pure && goodIdx[k].length >= want ? goodIdx[k] : null;
            const anchor = keep && keep.parent === k ? keep.faceId : null;
            return {
                id: p.id,
                idx: anchor
                    ? pickWith(p, want, from, anchor)
                    : pickIdx(p.faces.length, want, from),
            };
        });
        // Read off the drawn positions rather than the id, because `weldId` canonicalises — which maps
        // positions onto the same *face ids* and so preserves whether a downside is among them, but
        // there is no reason to make that a thing this has to know.
        const keeps = picks.some((pk, k) => pk.idx.some(i => DOWNSIDE.has(parents[k].faces[i].kind)));
        last = weldId(picks);
        if (block.has(last)) {
            // **The memory can decline the jackpot.** A pure draw is confined to the good faces, so it
            // produces the *same* clean weld every attempt — if the player already holds that one, sixty
            // more tries produce it sixty more times and the loop would hand back a weld it is meant to
            // be excluding. Offered once, then the press goes back to cutting normally.
            pure = false;
            continue;
        }
        if (anyDownside && !pure && !keeps) continue;
        return last;
    }
    return last;
};

// **Which cubes hand a prisoner back on their own.** Read off the face data rather than named, so a
// second jailer — or a weld carrying Oovo IV's face — is covered the day it exists rather than the
// day somebody remembers to add it here.
//
// This is the one asymmetry between the two cubes that capture. Both hold; only a jailer *owes*. A
// sentence is served a rung at a time whatever the die is showing, and the parole is a turn the cube
// takes rather than a face it rolls — so it belongs to the cube, and the cube is identified here.
// The Scavenger's hold has no drip at all: a `scavenge` face is what fetches its scrap back, which
// is the whole difference between a hold and a prison.
const JAILERS = new Set(
    SPECIALS.filter(sp => (sp.faces || []).some(f => f && f.kind === 'jail')).map(sp => sp.id),
);
exports.JAILERS = JAILERS;

exports.MAX_LEVEL = LEVELS.length - 1;

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

// Every weighted coin in the mode goes through here.
const chance = p => crypto.randomInt(0, 10000) < Math.round(p * 10000);
exports.chance = chance;

// Every plain cube in the game comes through here — the level's own cubes and any a special
// spawns. It is an honest coin, and that is a **pricing** decision rather than a fairness one.
//
// A `dayLean` used to sit here: one side quietly favoured every day, the day derived from a hash
// of a secret salt so everyone rolled the same cube. It was 0.52 and it was worth **+0.37 EV to
// the player**, for two reasons that are both properties of the ladder rather than of the number:
//
//   - **Majority-of-N amplifies a per-cube bias with depth.** A level's winner is the majority of
//     an odd number of cubes, so a 52/48 cube is 52/48 at Level 1 and 54.9/45.1 at Level 5. Every
//     rung is mispriced by a different amount and the deepest is worst, so no single `levelStep`
//     prices them all and whichever rung is loosest gets farmed.
//   - **It is not zero-sum against a player who never works out the day's side.** `E[∏P] > ∏P(E[p])`
//     by convexity, and the ladder pays exponentially in streak length, so *any* p ≠ 0.5 mints
//     truguts in either direction. Blind play measured 1.66 at 0.55. There is no EV-neutral value
//     of that dial except 0.500 — which is to say, no lean.
//
// A fair coin is what makes an edge priceable at all: at 0.500 the majority of any odd number of
// cubes is exactly 0.500 too, so one multiple prices every rung and there is no loose one to find.
// The house takes its cut in the pay table, the way a wheel that is honestly balanced still pays
// 35:1 on a 37:1 shot. See `levelStep`.
const rollSide = () => (chance(0.5) ? 'blue' : 'red');
exports.rollSide = rollSide;

// Watto's tie-breaker. Deliberately *not* a plain cube and deliberately not drawn through
// `rollSide`: the daily lean favours a colour, and this thing favours the house — it leans
// against whatever you called, whichever colour that is. A tie is always somebody's coin flip and
// never a fair one.
//
// **Qui-Gon's Nudge has its own weight rather than turning Watto's around.** It used to reuse
// `tieLean` reversed, which made the pick a 20-point swing — 40/60 against becomes 60/40 for — and
// measured +23% EV on any rack, so every dial in the tuning data had to be read twice. `nudgeLean`
// is the same idea at a price the rest of the file can be tuned against; see the note there, including
// why the gap between the two populations cannot be closed while the pick exists.
exports.rollTiebreak = function (call, nudge) {
    if (nudge) return chance(config.nudgeLean) ? call : OTHER[call];
    return chance(config.tieLean) ? OTHER[call] : call;
};

// ---------------------------------------------------------------------------
// The payout multiple
// ---------------------------------------------------------------------------

// Multiplier Cubes only pay if their own side is the side that won, which isn't known until the
// line is counted — and on a tie, not until Watto's cube has landed on top of it. So the sides
// come back out of `resolveLine` unspent and the caller applies them once it has a winner.
//
// Each one **adds** `multBonus` to the running multiplier rather than multiplying it, so three of
// them on the winning side is ×4 rather than ×8 — see `greedBonus` in the tuning data for why.
const applyMults = (mult, mults, side) => (side
    ? Object.values(mults || {}).reduce((m, s) => (s === side ? m + config.multBonus : m), mult)
    : mult);
exports.applyMults = applyMults;

// Phase two of a reveal: the paying faces counted out one at a time, with the multiple the roll
// stands at after each one.
//
// It exists because the multiple used to arrive fully formed on the payout frame. A rack that
// threw three paying faces showed ×4 on the throw and ×6.5 on the payout, and which cubes did that
// — or that three of them did anything at all — was left to be inferred from a row of glyphs. The
// multiple is the one number in the mode that builds rather than being drawn, so it is worth
// watching build.
//
// Deliberately **after** the cubes and the effects, and not merged into them. A Multiplier only
// pays if its own named side is the side that won, so there is nothing to count until the line has
// an answer — and on a tie, not until Watto's cube has landed on top of it. Greed could have gone
// earlier, but splitting the two would mean two different rules for the same climbing number.
//
// `start` is the multiple with none of them counted, so the last step lands exactly on what
// `applyMults` pays. This decides nothing: it replays a sum that has already been settled.
exports.multSteps = function (start, pays, side) {
    let running = Number(start) || 0;
    return (pays || []).map((p) => {
        // Greed and Boost are unconditional; a Multiplier waits for its own named side to win. The
        // amount comes off the pay record rather than being re-derived from the kind, because the Boost
        // Cube's is a function of the line it was standing on and this walk no longer has that line.
        const paid = p.kind !== 'mult' || (!!side && p.side === side);
        if (paid) running += p.bonus;
        // Past tense, and that is the point of reporting it here rather than reusing the note the
        // first pass wrote. On the throw a Multiplier is a promise — `+1× if red wins` — and by
        // this frame the roll knows whether red did. A face that named the losing side gets a step
        // of its own rather than being skipped: it was on the table, it is still on the table, and
        // silence would read as a bug.
        const note = {
            kind: p.kind === 'mult' ? (paid ? 'pay.won' : 'pay.lost') : `pay.${p.kind}`,
            faceId: p.faceId,
            specialId: p.specialId,
            specialName: p.specialName,
            side: p.side,
            bonus: p.bonus,
            // Only the Boost Cube uses this: how many positions it was paid for, which is the whole
            // of why its number is what it is.
            positions: p.positions,
        };
        return { at: p.at, paid, note, multiple: running };
    });
};

// Payouts are cumulative on the original stake. `mult` is what the run is carrying — the rungs it
// has survived plus whatever the Greed and Multiplier cubes have piled on — and it rides the
// standing rather than being re-earned, so a bonus caught early compounds all the way up.
exports.bankPayout = (stake, multiple) => Math.floor(stake * (Number(multiple) || 0));

// ---------------------------------------------------------------------------
// What a pick costs, mid-run
// ---------------------------------------------------------------------------

// **The price of arming one pick for the rung ahead, in whole mults.** See `armShare` in `tuning.js`
// for why the price exists at all and why it is paid before the throw rather than on use.
//
// **A share of what is actually standing, rounded — not a table per rung.** The two measure the same
// on a nominal ladder (L3 0.86 against 0.90) and come apart the moment a run goes hot: every paying
// face in the Gambler tree lifts the multiple off nominal, and a fixed table would then sell the pick
// at a discount exactly when it is worth most. That is the mirror of the argument at `pointValue` —
// a flat sum against a scaling standing always favours one end of the range. It is also the safer
// shape to own: a table has to be keyed to something, and keying an early draft to the rung's *payout*
// rather than the multiple being *stood on* dropped usage from 22% of rungs to 6% and made the pick
// worse than never buying it. A share cannot be mis-keyed.
//
// ---------------------------------------------------------------------------
// **Prices are rounded to a tenth of a mult, not to a whole one.**
// ---------------------------------------------------------------------------
//
// This used to round to whole mults, and the note here defended it: "a rate that reads evenly on paper
// would need fractional mults on the board, and the wobble is bounded". The wobble was **not** bounded
// in the way that mattered. `armShare 0.35` produced these:
//
//     standing   1.94   3.76   7.30   14.16   27.48
//     whole         1      1      3       5      10      = 52%  27%  41%  35%  36%
//     tenths      0.7    1.3    2.6     5.0     9.6      = 35%  35%  35%  35%  35%
//
// The 52% at the opening rung is the whole problem. `armFloor` could not go below 1, so the cheapest
// possible option cost more than half of a shallow standing — and an arm is bought **blind**, before the
// throw, so that is paid on every rung the perk turns out to be useless on. Scrap, Swap and Split all
// measured as dead picks and the floor was the binding term, not the share.
//
// The board already prints fractional multiples — `levelStep 1.94` gives 1.94, 3.76, 7.30 — so a price
// of 0.7 is no stranger on screen than the number it is subtracted from. Whole mults were never a
// display constraint, only an assumed one.
//
// A tenth is the granularity, not a free-for-all: it keeps prices readable, it keeps `againBonus` 1 as a
// meaningful unit to compare against, and it is fine enough that a share means what it says at every
// rung on the road.
const TENTH = 10;
const toTenth = n => Math.round((Number(n) || 0) * TENTH) / TENTH;
exports.toTenth = toTenth;

// **Priced per arm, because they are not the same size.** Scrap *removes* a problem from the line; Swap
// can only move one. Measured with each played to the same priorities — fix the count, then survive, then
// maximise — the gap is about four-fold (dg x1e-4, best / shield / symbiont racks):
//
//     share    scrap                  swap
//     0.21     +8.0  +2.2  +0.2      -5.7  -1.5  +0.0
//     0.12    +62.3 +45.8  +9.6      -5.1  -2.3  -0.0
//     0.05   +106.7 +87.4 +36.1      +4.7 +12.4  -0.5
//
// One share cannot serve both: priced for Scrap, Swap is dead; priced for Swap, Scrap prints. So
// `armShares` names each and `armShare` is the fallback for anything unlisted.
const armPriceOf = function (multiple, pick) {
    const m = Number(multiple) || 0;
    const share = (config.armShares || {})[pick];
    const rate = Number.isFinite(share) ? share : config.armShare;
    return Math.max(config.armFloor, toTenth(rate * m));
};
exports.armPriceOf = armPriceOf;

// **The look is a share too, and the flat price is what made Premonition look like a dead pick.**
//
// At `lookCost 1` the look cost 52% of an opening standing and 3.6% of a Level 5 one — the same
// flat-price-against-a-compounding-multiple problem as `pureBonus` and the arms. Priced as a share it
// charges the same fraction at every rung. `lookShare` supersedes `lookCost`; the flat value is kept as
// a fallback so a profile or a test that sets it still behaves.
exports.lookPriceOf = function (multiple) {
    if (!Number.isFinite(config.lookShare)) return config.lookCost;
    const m = Number(multiple) || 0;
    return Math.max(config.armFloor, toTenth(config.lookShare * m));
};
exports.betPriceOf = () => config.betAnte;

// **Taking a price out of a live run.** The multiple is the run's currency, so a purchase is a
// subtraction from it and the standing is re-derived — never the other way round, or the two drift by
// a rounding step and the board shows a number the bank will not honour.
//
// Refuses to leave nothing behind: a spend has to keep the multiple strictly positive, because a run
// standing on zero pays zero at every rung after it and is a dead thing still holding a button.
exports.spendMultiple = function (stake, multiple, price) {
    const m = Number(multiple) || 0;
    const p = Number(price) || 0;
    if (!(p > 0) || p >= m) return null;
    const left = m - p;
    return { mult: left, standing: exports.bankPayout(stake, left), paid: p };
};

// ---------------------------------------------------------------------------
// The multiple
// ---------------------------------------------------------------------------
//
// **A level multiplies the multiple; an Again adds to it.** A run opens holding ×1 — its own stake,
// unrisked — and every rung it survives works on that number:
//
//     🥉 ×1.94 ─ again ─▸ ×2.94 ─ again ─▸ ×3.94 ─ 🥈 ─▸ ×7.64 ── a Multiplier lands ──▸ ×8.64
//
// Two things fall out of it, and both are why the split is this way round rather than the other:
//
// - **A level push is priced, and evenly.** M → M×`levelStep` on a coin flip whose fair price is
//   M → 2M, so the house keeps 3% — the same 3% at all five rungs, because a fair cube makes the
//   majority of any odd number of cubes exactly 0.500. The Agains are the steeper price on top.
// - **An Again compounds.** A +1 banked before four levels is worth 14.16 by the top; the same +1
//   banked in the last gap is worth 1.94. So catching one early matters, a collapsed route tops out
//   at 27.48 where a fresh one runs far higher, and collapsing the route permanently lowers the
//   biggest number you will ever be able to reach on it.
//
// It is also what keeps the paying faces meaningful at depth: a Greed's +0.5 is still doubled by
// every level above it, exactly as it was measured.
//
// **Past Level 5 there is no level left to multiply what an Again adds**, so an Again there pays
// `overtimeBonus` instead — the whole reason overtime is a decision rather than a formality. See the
// note on that dial for why the number is safe below the multiple the top of the road arrives at.
const BONUS = { again: 'againBonus', overtime: 'overtimeBonus' };

const rungMultiple = function (kind, carried, added = 0) {
    // A run that hasn't rolled yet is holding its own stake and nothing more.
    const base = Number(carried) || 1;
    const bonus = BONUS[kind];
    return (bonus
        ? base + config[bonus]
        : base * config.levelStep) + added;
};
exports.rungMultiple = rungMultiple;

// What the *next* rung would take the multiple to, with nothing added. The bank-or-push line reads
// the push figure off this, so the offer on screen is the number the roll will actually play for.
exports.nextMultiple = (kind, carried) => rungMultiple(kind, carried, 0);

// ---------------------------------------------------------------------------
// The bag
// ---------------------------------------------------------------------------

const bagSize = () => config.cubesPerLevel * (LEVELS.length - 1);
exports.bagSize = bagSize;

// The bag a run draws from, shuffled once when the run starts and never refilled.
//
// It holds **one entry per cube the climb will ever add** — every special on the rack, padded out
// with ordinary cubes — and each level pulls `cubesPerLevel` off the top. Nothing goes back in.
//
// Drawing *without replacement* is the whole mechanic, and it gives the escalation for free: a rack
// you equipped is a rack you will actually meet, and the only question is when. With one special in
// a bag of eight the four pulls run **25% → 33% → 50% → certain**, climbing exactly as long as the
// bag keeps handing you ordinary cubes. That first 25% is precisely the flat per-cube chance this
// replaced, so a run opens feeling the same and everything after it is the bag doing the work.
//
// It also retires `spent` as a draw rule: a special can only be in the bag once, so a shattered one
// can never come back simply because there is nothing left to draw.
//
// Two cubes are never from the bag — the one Level 1 opens with, which is always ordinary so the
// set has something to decide a roll with, and Watto's tie-breaker, which is his.
const shuffle = function (a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// **The rack fits the bag exactly, and that is enforced upstream.** `bagSize()` is the hard cap on
// `equipped` — applied where a loadout is written, where a reward is granted, and again where a
// profile is read — so what arrives here is at most `n` ids, padded out with ordinary cubes to the
// `cubesPerLevel × (levels − 1)` entries the four drawing levels will take.
//
// So there is no bench in the bag and no tail behind the levels: every cube fielded is in it, and
// every cube in it is one the climb reaches. That is what makes the promise above — a cube you
// equipped is a cube you will meet — true with no exception hanging off it.
//
// Two rules died to get here, in order. First, **the first eight in `SPECIALS` order**, which meant a
// player fielding more than eight silently never met the tail of the list on any run, ever — and the
// tail was the six newest cubes. Then a **random cut to eight**, which fixed the bias and kept the
// loss. Then no cut at all, which kept a longer bag whose tail no level could reach and called it a
// bench. Capping the loadout is what removes the overflow rather than deciding what to do with it.
//
// The slice is defence, not policy: a hand-edited profile must not be able to hand a run a longer bag
// than the ladder was measured against.
const fillBag = function (equipped) {
    const n = bagSize();
    const owned = (equipped || []).filter(id => specialById(id)).slice(0, n);
    return shuffle([
        ...owned,
        ...Array.from({ length: Math.max(0, n - owned.length) }, () => null),
    ]);
};
exports.fillBag = fillBag;

// ---------------------------------------------------------------------------
// The set, and what a cube carries between throws
// ---------------------------------------------------------------------------
//
// A **slot** is one cube in the set: which special is sitting there, plus everything done to it that
// outlives the throw that did it. It used to be a bare id, and for a long time nothing needed more —
// the cubes persisted, the sides never did, and a cube was either on the table or destroyed.
//
// The Planet Octahedron is what changed that. Three of its faces attach something to a cube that has
// to survive to the next throw: **scorched** faces, gone for the rest of the climb, and **ice**, which
// holds a cube on the face it is showing for exactly one more throw. Neither has anywhere to live in
// an array of strings, and a parallel structure keyed by position would be wrong the first time a cube
// was destroyed or inserted — positions move on every throw.
//
// So a slot is an object, and it **travels with the cube through the line**. `throwSet` hangs it on
// the position it threw, every effect that copies a cube copies its slot, and `resolveLine` reads the
// next set straight off the positions that survived. Anything destroyed loses its state by virtue of
// not being there, which is exactly the behaviour that used to be free.
//
// **A slot also carries what its cube has captured.** `held` is a list of slots exactly like this
// one, so a captor holds whole cubes — scorch marks, heat and their own prisoners included — and a
// captor can hold a captor to any depth. See "Capture" in the tuning data for the four rules; what
// matters here is only that the inventory belongs to the *cube* rather than to the run, which is
// why it lives on the slot and travels with it through the line, through a copy, and into the set.
const slotOf = function (v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        return {
            id: v.id ? String(v.id) : null,
            // Firebase hands back an object where an array went in, so both go through `Object.values`.
            burned: Object.values(v.burned || {}).map(String),
            // **What the crowd has painted on this cube**, as `faceId|side` — see `paintOn`. A flat
            // list of strings for the same reason `burned` is one: it is what survives Firebase
            // without a codec of its own. The pipe rather than a colon because half the face ids in
            // the game already carry one, and `side:blue|red` has to come apart the right way.
            painted: Object.values(v.painted || {}).map(String),
            frozen: v.frozen ? String(v.frozen) : null,
            heat: Number(v.heat) || 0,
            // **Nugtosh's blessing rides the cube until something spends it.** On the slot rather than
            // on the position, which is the difference between a blessing and a rung: a position is
            // gone when the throw is, and this has to still be there next rung and the one after.
            blessed: !!v.blessed,
            // **And what this cube has captured**, which is the same reason again and the strongest
            // case of it: a prisoner is a whole cube, so it is a whole slot, and a captor that is
            // itself captured nests. `hauled` used to mark a cube in the run's hold as carried rather
            // than wrecked; the hold that carried it owns it now, so the flag has nothing left to say.
            held: Object.values(v.held || {}).map(slotOf),
        };
    }
    return {
        id: v ? String(v) : null,
        burned: [], painted: [], frozen: null, heat: 0, blessed: false, held: [],
    };
};
exports.slotOf = slotOf;

// An ordinary cube with nothing done to it — the thing most of a set is.
const plainSlot = () => ({
    id: null, burned: [], painted: [], frozen: null, heat: 0, blessed: false, held: [],
});
exports.plainSlot = plainSlot;

// Every cube inside a slot's inventory, nested holds included. What the header counts and what the
// harness's conservation law is written against.
const countHeld = function (slots) {
    return (slots || []).reduce((n, s) => n + 1 + countHeld(s && s.held), 0);
};
exports.countHeld = countHeld;

// A hold, copied deeply, all the way down. Rule 2 of capture: a cloned or reflected captor comes
// with the same prisoners and they are a **copy** of them — sharing the array would make one hold
// that two cubes are looking at, so cracking either open would empty both.
const cloneHeld = slots => (slots || []).map(s => ({ ...s, held: cloneHeld(s.held) }));
exports.cloneHeld = cloneHeld;

// The faces a cube can actually still land on. **A scorch takes one face of the six, not a kind** —
// burning a wild off a Wild Cube leaves four wilds and a Ratts, so every remaining face gets more
// likely and what a burn is worth depends entirely on which one it took. That is the whole mechanic:
// it changes a cube's odds rather than its length.
//
// `burned` is a multiset of face ids and each entry removes exactly one match. `minFaces` is the floor
// and it is checked per removal, so a cube can be scorched down to its last face and no further.
const liveFaces = function (special, burned) {
    const all = (special ? special.faces : PLAIN_FACES).slice();
    for (const id of (burned || [])) {
        if (all.length <= config.minFaces) break;
        const k = all.findIndex(f => f && f.id === id);
        if (k >= 0) all.splice(k, 1);
    }
    return all;
};
exports.liveFaces = liveFaces;

// **What colour a face has been painted, if the one that just landed is a painted one.**
//
// The mirror image of the scorch, and it borrows the scorch's trick wholesale. `painted` is keyed by
// face **id**, and a cube can carry several faces under one id — three Greeds, four wilds — so which
// of them the crowd got at is not recorded and does not need to be: drawing one of them and calling
// it painted with probability `painted of that id / all of that id` is the same distribution as
// having painted a particular one and asking whether this is it.
//
// Two marks on the same id and opposite colours resolve to whichever the draw lands in, which is the
// honest answer for a cube the crowd has been at twice from different sides.
const paintOn = function (faces, painted, face) {
    const id = face && face.id;
    if (!id || !(painted || []).length) return null;
    const marks = painted.filter(p => p.slice(0, id.length + 1) === `${id}|`);
    if (!marks.length) return null;
    const of = faces.filter(f => f && f.id === id).length;
    if (!of) return null;
    const k = crypto.randomInt(0, of);
    return k < marks.length ? marks[k].slice(id.length + 1) : null;
};

// **What a scorch leaves standing.** The id survives and the kind does not, which is the whole of the
// mechanic in one object: the client still knows which face it was and draws it burnt, and every pass
// that dispatches on `kind` — the two effect switches, the paying faces, the `SIDED` test that decides
// whether a position keeps its colour — falls through to nothing without a single case of its own.
//
// **Mutated in place, never replaced.** Pass two walks a queue of the position objects themselves, so a
// cube handed a fresh object would go on holding the old one and take its turn out of it: a Ratts
// charred by the Baroonda beside it would detonate anyway, which is the exact case the face exists for.
//
// `charred` on the position rather than only on the face, because `lineState` reports it per position
// and a face object is not what the line is indexed by.
const charFace = function (cube, id) {
    cube.side = null;
    cube.charred = true;
    cube.face = { id, kind: 'charred' };
    return cube;
};

// The marks the crowd has left on one face id of this cube.
const marksOn = (slot, id) => (slot.painted || []).filter(p => p.slice(0, id.length + 1) === `${id}|`);

// **How many copies of a face id are still not counting for `side`.**
//
// The whole reason this is a count rather than a test: `painted` is keyed by face **id**, and a cube
// carries several faces under one id — three Greeds, three blue sides. A mark is a mark on *one of
// them*, exactly as a scorch is, and asking "is this id painted blue" would repaint all three off one
// visit and then refuse to paint any of the rest. So a copy counts for `side` if it carries a mark
// saying so, or if it carries no mark at all and the face is that side on its own.
const openOn = function (faces, slot, id, side) {
    const of = faces.filter(f => f && f.id === id).length;
    if (!of) return 0;
    const marks = marksOn(slot, id);
    const own = (faces.find(f => f && f.id === id) || {}).side || null;
    const already = marks.filter(m => m.slice(id.length + 1) === side).length
        + (own === side ? of - marks.length : 0);
    return Math.max(0, of - already);
};

// **What the crowd can actually paint on a cube**, which is a copy of a face that is not already that
// colour. Painting the shown face is the readable choice — the thing being changed is on screen at the
// moment it changes — but the leading colour is by definition the majority of what is showing, so on a
// plain table the shown face already matches it most of the time and the face would be a no-op on the
// majority of its landings. So it takes the shown face where it can and another where it cannot, and
// passes over a cube already painted end to end, which is a real endpoint the way the scorch floor is.
const paintable = function (special, slot, shown, side) {
    const faces = liveFaces(special, slot.burned);
    const ids = [...new Set(faces.map(f => f && f.id).filter(Boolean))]
        .filter(id => openOn(faces, slot, id, side) > 0);
    if (!ids.length) return null;
    if (shown && ids.includes(shown.id)) return shown.id;
    return ids[crypto.randomInt(0, ids.length)];
};

// What a cube actually throws from: what it has left, less the heats it has already spent.
//
// **Both take faces off the cube and they are not the same mechanic.** A scorch removes a face for the
// rest of the climb and is floored by `minFaces`; a heat is consumed by being landed on and has no
// floor, which is what makes the Turbine's wipeout climb from 1-in-6 to certain across five landings
// and what makes 0 through 5 heats equally likely. They compose here rather than sharing a field,
// because a Turbine that has been at by Baroonda has had both done to it.
//
// **This used to draw off every face the cube ever had**, charring the burnt ones where they landed
// instead of removing them — see the note on the `scorch` case for why that is gone. Nothing is left
// of it: a burnt face is not rolled, so there is no such thing as a position standing on one.
const rollFaces = function (special, slot) {
    const all = liveFaces(special, slot && slot.burned);
    let n = (slot && slot.heat) || 0;
    if (!n) return all;
    return all.filter((f) => {
        if (n > 0 && f && f.kind === 'heat') { n -= 1; return false; }
        return true;
    });
};
exports.rollFaces = rollFaces;

// What a frozen slot comes back up as: the face it was holding when the ice took it, rebuilt off the
// cube it belongs to. `null` when that face isn't there any anymore — scorched off in the meantime, or
// stored by an older build — and the caller falls back to an ordinary throw, which is the right way
// for a stale freeze to degrade.
const frozenCube = function (special, id) {
    if (!special) {
        const side = id === SIDE_IDS.red ? 'red' : id === SIDE_IDS.blue ? 'blue' : null;
        // Rebuilt as a genuinely plain cube rather than as a `side` face, so a frozen ordinary cube
        // draws, scores and narrates exactly like every other ordinary cube.
        return side ? { side, special: null, face: null } : null;
    }
    const face = (special.faces || []).find(f => f && f.id === id);
    return face ? { side: null, special, face: { ...face } } : null;
};

// Adds this level's cubes to the set, off the top of the bag. Returns both, because drawing spends
// the bag and the run has to carry what's left of it.
exports.drawCubes = function (set, bag, levelIdx) {
    const rest = [...(bag || [])];
    // Level 1 opens the run, with one ordinary cube that doesn't come out of the bag.
    if (levelIdx === 0) return { set: [plainSlot()], bag: rest };

    const out = (set || []).map(slotOf);
    for (let i = 0; i < config.cubesPerLevel && rest.length; i++) out.push(slotOf(rest.shift()));

    // A set with nothing ordinary left in it has nothing to decide a roll. Only reachable when the
    // rack fills the bag outright and the opening cube has since been destroyed.
    if (out.length && !out.some(slot => !slot.id)) out[out.length - 1] = plainSlot();
    // A mirrored set can already be at the ceiling; adding to it would put the table past what a
    // line can hold. Trimmed from the end, so the cubes a level just added are the ones that don't
    // fit rather than the ones that have been carried the furthest.
    return {
        set: out.length > config.maxCubes ? out.slice(0, config.maxCubes) : out,
        bag: rest,
    };
};

// The set crosses Firebase, and **Firebase deletes nulls** — writing `null` to a key removes it. A
// set is mostly plain cubes, which are `null` in memory, so it round-tripped catastrophically:
//
//   [null]                 ->  the whole key vanishes
//   [null, null, null]     ->  the whole key vanishes
//   [null, null, 'greed']  ->  { 2: 'greed' }, which reads back as a set of ONE
//
// A run therefore lost every plain cube it owned on the way to the database and grew from whatever
// survived, which is why levels appeared to add one cube instead of two. Plain cubes are stored as
// `0` instead — a real value RTDB keeps, and one that can't collide with a special's id.
//
// Every read of a stored set goes through `decodeSet` and every write through `encodeSet`. Any
// other transport must preserve this: it looks like a quirk to clean up and it is load-bearing.
//
// **A slot with nothing done to it still encodes as a bare id**, exactly as it always did, and only
// one carrying scorch marks or ice encodes as an object. That is not tidiness — it is what let this
// ship without a migration in either direction. Every set written before slots existed decodes as a
// set of untouched slots, and every set a run without the Planet Octahedron produces is byte-for-byte
// what the old encoder wrote.
exports.encodeSet = function (set) {
    const one = function (c) {
        const slot = slotOf(c);
        if (!slot.burned.length && !slot.painted.length && !slot.frozen && !slot.heat
            && !slot.blessed && !slot.held.length) {
            return slot.id || 0;
        }
        const out = { id: slot.id || 0 };
        if (slot.burned.length) out.burned = slot.burned;
        if (slot.painted.length) out.painted = slot.painted;
        if (slot.blessed) out.blessed = true;
        if (slot.frozen) out.frozen = slot.frozen;
        if (slot.heat) out.heat = slot.heat;
        // The inventory, encoded exactly like the set it is part of — so a nest of any depth is one
        // slot on the table and a prisoner keeps its own ice and scorch marks while it is inside.
        if (slot.held.length) out.held = slot.held.map(one);
        return out;
    };
    return (set || []).map(one);
};
exports.decodeSet = raw => Object.values(raw || {}).map(slotOf);

// **The bag is not a set and must not be decoded as one.** It holds bare ids — what a level will put
// on the table, not what is on it — and nothing has ever been done to a cube that hasn't been thrown
// yet. These are the old set codec verbatim, split off when slots arrived: `drawCubes` wraps an id in
// a slot on the way out of the bag, and `drawOne` needs the id itself to look the cube up.
exports.encodeBag = bag => (bag || []).map(id => id || 0);
exports.decodeBag = raw => Object.values(raw || {}).map(v => (v ? String(v) : null));

// ---------------------------------------------------------------------------
// Throwing and resolving
// ---------------------------------------------------------------------------

// Throws every cube in the set. Plain cubes roll a side; special cubes roll a face, and their side
// is settled by `resolveLine` — an effect face has none at all.
//
// **The cubes land in a new order every throw.** Position is a property of the throw, not of the
// cube: a Binder that burned the cube on its right last level comes down somewhere else entirely
// this one, a Mirror has a different half of the line behind it, and the two cubes a level adds
// aren't stuck on the end where they were appended. Without this, every position-dependent face
// resolved against the same neighbours for the whole climb, which made a carried set far more
// predictable than a thrown one has any business being.
//
// Fisher-Yates off the CSPRNG, like every other draw that decides a payout.
//
// **Slots are copied on the way in**, so nothing here mutates the set it was handed. That is what lets
// a reroll pick the table up exactly as it was — including the ice this throw is about to spend.
exports.throwSet = function (set) {
    return shuffle((set || []).map(slotOf)).map((slot) => {
        const special = slot.id ? specialById(slot.id) : null;

        // **Ice is consumed the moment it is served.** The slot is cleared here rather than after the
        // roll, which is the whole of what stops Ando Prime's freeze from needing a second flag: the
        // face it froze is spent on this throw, and the freeze it hands out in pass two of this same
        // throw is written into a slot that is already empty. Frozen on throw N, held on N+1, ordinary
        // on N+2, with no bookkeeping in between.
        if (slot.frozen) {
            const held = frozenCube(special, slot.frozen);
            slot.frozen = null;
            // `frozen` on the position is what makes it take no turn and pay nothing while the ice
            // lasts — a frozen mine does not detonate and a frozen Greed does not pay.
            if (held) return { ...held, slot, frozen: true };
        }

        const faces = rollFaces(special, slot);
        if (!special) {
            // **An untouched plain cube draws through `rollSide`; one that has been got at does not.**
            // A cube drawing off a face list never calls it, so a cube Baroonda or Tatooine has reached
            // is drawing from three blue and three red less what the fire took and plus what the crowd
            // painted — which is what makes it *loaded* rather than nudged, and readable as a count
            // rather than felt as a bias. Nothing here is a special case; it is where the two draws
            // already were, and the paint arrives on the same side of the fork as the fire.
            if (!slot.burned.length && !slot.painted.length) {
                return { side: rollSide(), special: null, face: null, slot };
            }
            const face = faces[crypto.randomInt(0, faces.length)];
            // **Through `paintOn`, exactly as a special's face is.** A plain cube is three blue and
            // three red under two ids, so reading the mark straight off the id would turn all three
            // reds blue on one visit from the crowd. One mark, one copy, one throw in three.
            const paint = paintOn(faces, slot.painted, face);
            return { side: paint || face.side || null, special: null, face: null, slot, paint };
        }
        const face = faces.length ? faces[crypto.randomInt(0, faces.length)] : null;
        return {
            side: rollSide(),
            special,
            face,
            slot,
            // Resolved here rather than at the count, for the reason the face itself is: which of three
            // Greeds landed is a fact about this throw, and asking twice would answer differently.
            paint: paintOn(faces, slot.painted, face),
        };
    });
};

// ---------------------------------------------------------------------------
// Splitting a weld, mid-run
// ---------------------------------------------------------------------------

// **Whether a position on the line can come apart**, which is two questions and not one: is it a weld,
// and is it free to move.
//
// Ice is the second. Ando Prime's freeze commits a cube to the face it is showing and gives it no turn
// — `throwSet` serves the held face and clears the flag — so a frozen weld has one face committed and
// two cubes' worth of faces to commit it to, and there is no honest answer to which parent inherits it.
// It refuses, which hands the freeze a use it did not have: for one throw, it holds a weld shut.
exports.canSplitAt = function (line, at) {
    const pos = (line || [])[at];
    if (!pos || pos.frozen) return false;
    return !!exports.weldParents(pos.slot && pos.slot.id);
};

// **A welded position, taken back to the cubes it was pressed from and thrown.** Split, off The
// Forger — see `TREE`. Returns the positions to put in its place, or null if it will not come apart.
//
// `throwSet` does all of the work, which is the whole reason this is four lines: it copies slots, rolls
// each parent off `liveFaces` and hands back positions in exactly the shape the
// line already holds. The parents are specials by construction — `parseWeld` resolves every one through
// `baseById` — so nothing plain can enter the line this way and `rollSide` is never reached.
//
// **The parents come back whole and in no chosen order.** Fresh slots, so the weld's scorch marks, its
// ice and its heat stay with the cube that came apart rather than being distributed: a burn took a face
// off *that* cube, and that cube no longer exists. And `throwSet` shuffles, so which parent lands where
// is not the player's to pick — the press is not precision equipment, and position is The Dealer's tree.
exports.splitAt = function (line, at) {
    if (!exports.canSplitAt(line, at)) return null;
    const parents = exports.weldParents(line[at].slot.id);
    return exports.throwSet(parents.map(id => ({ ...plainSlot(), id })));
};

// **A thrown line, put down and picked up again**, without throwing it a second time.
//
// The one thing the mode could not do until now is stop *between* the cubes landing and the effects
// firing. `parkTie` parks a roll, but it parks a **resolved** one — the effects have already run and
// consumed the state that makes a line hard to store — and every question worth asking a player
// mid-roll lands in the gap this fills instead: which face is that, put those two the other way
// round. A rethrow is not an option for either. The player is answering about *this* line.
//
// **Nothing new is stored to make it work.** A thrown line is three things the engine already emits
// and already puts on the wire: the slots in the order they landed (`encodeSet`), one face id per
// position (`rolledFaces`), and the per-position extras a face id cannot carry (`lineState`). This is
// the inverse of that, and the round trip is measured rather than assumed — see `scripts/cubeLine.js`.
//
// The rebuild is `frozenCube`'s, which has done exactly this job since Ando Prime shipped: a slot and
// a face id back into the position it was. A face the cube no longer carries comes back as a position
// that counts toward nothing, which is the same way a stale freeze degrades and for the same reason.
exports.relineFrom = function (set, faces, state = {}) {
    const frozen = state.frozen || [];
    const painted = state.painted || [];
    const ids = faces || [];
    return (set || []).map(slotOf).map((slot, i) => {
        const special = slot.id ? specialById(slot.id) : null;
        const built = frozenCube(special, ids[i]);
        // **The paint comes back off the state rather than being re-rolled off the slot.** Which of
        // three Greeds was the painted one is a fact about the throw, and `paintOn` would answer it
        // differently the second time — so a relined position would count for a colour the roll it is
        // rebuilding never gave it.
        const paint = painted[i] || null;
        if (!built) return { side: paint, special, face: null, slot, paint };
        const side = paint || built.side;
        return frozen[i]
            ? { ...built, side, slot, frozen: true, paint }
            : { ...built, side, slot, paint };
    });
};

// **Watto chalks up three prices, one from each band.**
//
// Redrawn every rung, which costs nothing and is the only thing that makes the book feel like a book:
// the offer you turn down at Level 2 is not the offer waiting at Level 3.
//
// **Only what the rack can actually produce.** Four propositions measure a flat 0.0% without a
// specific cube in the bag — Ben razes, the line grows, Sebulba turns one, Order 66 — and a bet that
// cannot be won is not a long shot, it is a trap. Filtering costs nothing the mechanic was for: judging
// 4% against 20% is still the whole skill, and it is still the player's job to know which of the three
// their own cubes are good at.
//
// One likely, one middle, one long shot. A band with nothing eligible in it simply contributes
// nothing, so a thin rack is offered a shorter book rather than a padded one.
//
// **`spoiled` is what a look has already answered.** Every price here is derived blind — see
// `scripts/cubeSideBet.js`, which measures each proposition against the rung's own distribution — so a
// card offered to somebody who has seen a face that settles it is not mispriced by a little. A
// premonition showing Sebulba turns `engine` from a 4.8% long shot into a near-certain +20.
//
// The fix is to re-chalk rather than to refuse, which is the whole reason this takes a kind: a look
// hands its face's kind in, every card that kind could settle comes off the pool, and the three drawn
// against what is left are blind again. So the book stays three cards deep and the ante stays honest,
// and the two abilities can be played in either order — which is the point.
//
// **Off `spoils` and not off `needs`**, which are the same list for twelve of the thirteen cards and
// deliberately not for `saved` — see its note. `needs` answers what a rack must own to produce the
// event; `spoils` answers what a player who has seen one face already knows about it, and a card that
// waits on two things has its second one in the second list only.
//
// Two notes on the edges. A plain side spoils nothing and arrives here as null, so an unlucky look
// re-chalks a book drawn from the same pool it was drawn from. And `tie` names no faces and is left
// standing: one face out of three to nine is thin evidence about a majority, and closing it on any
// look at all would cost the thinnest racks their only card in the band.
//
// **Measured card-by-card against every face that can land**, and two racks come out with no +EV
// conditional left anywhere in the book. Two things it does not correct, both worth knowing.
//
// The first is the rack gap, which has nothing to do with looking: `grow` measures 46% on a rack built
// for it against a price shaved for 20%, and `broken` 29% against 22%, *blind*. That is the mechanic's
// own skill and it is priced deliberately — see `scripts/cubeSideBet.js`, which measures three racks for
// exactly this reason. Most of what a post-look sweep flags on such a rack is that baseline showing
// through, and the conditional is usually *below* it.
//
// The second is real and small and left standing: a growth face — `pair`, `twins`, `draw` — means a
// longer line, and a longer line raises every per-cube effect at once. On a growth rack a look showing
// `draw` takes `broken` from 28.7% to 32.9%, which is about +15% relative. The blunt fix is to have the
// growth kinds spoil the whole book, and that is worse than the leak: it hands back an empty book on the
// one rack that plays for line length. Priced out card by card it would want its own pass through
// `cubeSideBet.js`, against a distribution conditioned on line length rather than on level.
exports.drawBook = function (equipped, spoiled) {
    const kinds = new Set();
    for (const id of equipped || []) {
        const sp = specialById(id);
        for (const f of (sp && sp.faces) || []) kinds.add(f.kind);
    }
    const off = (Array.isArray(spoiled) ? spoiled : [spoiled]).filter(Boolean);
    // A plain cube is always in the bag and only ever rolls a side, so nothing is added for it — which
    // is also what makes the fallback right. A proposition naming no faces still needs *something*
    // special on the table: every level is an odd number of cubes, so a line of plain ones always has
    // a majority in it and can never tie. Measured at 0.0% on an empty rack, like everything else.
    const can = bet => (bet.needs ? bet.needs.some(k => kinds.has(k)) : kinds.size > 0)
        && !(bet.spoils || bet.needs || []).some(k => off.includes(k));
    const out = [];
    for (const band of ['likely', 'middle', 'long']) {
        const pool = SIDE_BETS.filter(b => b.band === band && can(b));
        if (pool.length) out.push(pool[crypto.randomInt(0, pool.length)].id);
    }
    return out;
};

// What a placed bet paid, as a bonus onto the rung's multiple. Zero when nothing was named, when the
// named proposition is not one this build has, or when it simply did not happen.
//
// It goes in beside the roll's own paying faces rather than anywhere new — `rungMultiple` takes the
// added bonus and has always taken it — so a side bet compounds, shrinks and is capped by exactly the
// same rules a Greed is.
//
// **The ante comes back inside the payout, and leaving it out was a second house edge nobody chose.**
// `scripts/cubeSideBet.js` derives every `price` as `1/p - 1`, which is the **net** return on a
// one-unit stake — the profit, with the stake already excluded. So a card is a whole bet in two halves:
// `betAnte` off the standing when it is named, and `price + betAnte` back if it lands. Paying only
// `price` charged the stake and then never returned it, which costs the player a further `p` on top of
// the ~15% the prices already shave:
//
//     card      price   implied p   paid `price`   paid `price + ante`
//     broken        3       0.250        -0.250                  0.000
//     clone         5       0.167        -0.167                  0.000
//     engine       20       0.048        -0.048                  0.000
//
// The right-hand column is the fair bet the price list was written for; the middle one is what a
// straight `bet.price` actually settled. The card still *advertises* `price`, because that is the net
// profit and net is how odds are quoted — what moves on the multiple is the gross.
exports.betPaid = function (id, res) {
    const bet = id ? SIDE_BETS.find(b => b.id === id) : null;
    if (!bet || !res) return 0;
    return bet.hit(res) ? bet.price + config.betAnte : 0;
};

// The other half of the same trip: everything about a thrown line that has to survive being written
// down. Kept beside the rebuild so the two are read together and cannot drift apart quietly.
exports.encodeLine = line => ({
    set: exports.encodeSet((line || []).map(c => c.slot)),
    faces: exports.rolledFaces(line || []),
    state: lineState(line || []),
});

// How a face is keyed in the lifetime tallies, and the id it draws as. The kind alone isn't
// enough — Shmi's four red and one blue are both `side`, and the Multiplier's two halves are both
// `mult` — and those are exactly the splits worth seeing. Safe as a Firebase key: no dots, slashes
// or brackets.
//
// `dir` is the same idea for a face whose *heading* is what distinguishes it rather than its side:
// Sebulba's two engines are both `engine`, and which one you keep drawing is exactly what the rack
// screen is for. A face never declares both.
//
// The tuning declares the same string as each face's `id`, so this and `faceIdOf` agree by
// construction rather than by coincidence.
const faceKey = f => (f.side ? `${f.kind}:${f.side}` : f.dir ? `${f.kind}:${f.dir}` : f.kind);
exports.faceKey = faceKey;

// What a position on the resolved line is worth in **face points**, which land on the stake rather
// than on the multiple — see the `POINTS` note in the tuning data for why the line pays as a whole.
//
// Keyed off `kind` alone, so a plain cube (a side and no face at all) scores `side`, and a Shmi's red
// scores the same as any other red, which is right: this pays for the position, not for the cube that
// produced it. An unlisted kind scores nothing rather than throwing, so a face added to the data
// without a point value is merely worth zero until somebody gives it one.
//
// **A destroyed position scores nothing**, and `gone` is the only test that needs making. Ratts leaves
// with his own blast, a wipeout takes its cube off the table, and Ben's wings are the two thirds of a
// razed neighbour he is lying across — all three are still *drawn*, so the player can see what happened,
// and none of them is a cube standing on the table any more.
const pointsOf = function (c) {
    if (!c || c.gone) return 0;
    if (c.face) return POINTS[c.face.kind] || 0;
    return c.side ? POINTS.side : 0;
};
exports.pointsOf = pointsOf;

// The line's points and the positions that earned them — corpses excluded from both, so a wipeout
// simply isn't there rather than being counted as a zero and dragging the average down. Being
// destroyed already costs the cube its turn; it should not also fine the payout.
const scoreLine = function (line) {
    let points = 0;
    let positions = 0;
    for (const c of (line || [])) {
        if (!c || c.gone) continue;
        positions++;
        points += pointsOf(c);
    }
    return { points, positions };
};
exports.scoreLine = scoreLine;

// What the line's points are worth, in **stake-units added beside the ladder** rather than folded into
// it: a rung pays `stake × (multiple + bonus)`. Watto throws a few coins in the pot; the pot is not what
// doubles.
//
// **Beside, not inside, and that is the whole of why this is simple.** Folded in — `stake × bonus ×
// multiple` — the bonus compounds with the line, which grows every level, and every push comes out
// 4–5% above even money on a collapsed road. Fixing *that* needs a per-position average and a baseline
// and a special case for Level 1. Added, a fixed bonus shrinks against a doubling multiple all by
// itself, so the push ratio returns to 1.000 with no correction at all: measured across every rack and
// rung it sits inside ±0.3%, and the residue leans toward the house. Totals are fine. See
// `scripts/cubePoints.js`, which measures both.
//
// **Stake-units, not flat truguts**, which is the one thing that isn't free. A flat sum makes the return
// on risk `M + b/S` — maximised by staking as little as possible, and worth *more* than the wager itself
// at the floor, which is the Pure Cube pot's exploit exactly (see the note at the top of the tuning
// data). Scaling with the stake removes it completely while changing nothing the player sees: they read
// `+📀90`, the engine holds `+0.09`.
//
// The honest cost: a bonus that doesn't ride the ladder **fades at depth**. It is a few percent of a
// Level 2 payout and a rounding error on a Level 5 one. That is the right shape for a sweetener and the
// wrong shape for a second scoring axis, and it is worth being clear which this is.
const pointBonus = points => (points || 0) * config.pointValue;
exports.pointBonus = pointBonus;

// The id for one position. Exactly one per position, always — a face either *is* a side, in which
// case it draws as that side, or it *does* something, in which case it draws as the thing it does
// and counts toward neither colour. Nothing is ever composed out of two, because a position that
// draws as two is a position players count as two.
const faceIdOf = function (cube) {
    if (cube.wild) return 'wild';
    // A face with no id of its own is an ordinary cube's face — the plain half of a hybrid — and
    // draws as whichever side it rolled, exactly like the cube it stands in for.
    if (cube.face && cube.face.id) return cube.face.id;
    return cube.side ? `side:${cube.side}` : 'hidden';
};
exports.faceIdOf = faceIdOf;

// What the reveal animates: one id per position, snapshotted *before* resolution, because
// resolving inverts and reorders the line the payout frame draws.
exports.rolledFaces = line => line.map(faceIdOf);

// **What a position carries that its face id cannot say.**
//
// A face id answers *what came up*, and three things about a position are not answerable from it:
//
//   `frozen`   Ando Prime is holding this cube on the face it is showing. It takes no turn and pays
//              nothing while the ice lasts, and it did not tumble to get here — which is the whole
//              tell, and a client with no way to know it would draw a held cube as an ordinary one.
//   `burned`   the faces Baroonda has scorched off the cube standing here, for the rest of the climb.
//              A cube down to four faces draws identically to a fresh one without this, which makes
//              the one permanent effect in the game the one nobody can see.
//   `cubeIds`  **which cube is standing here**, or `null` for an ordinary one. A face does not name
//              its cube and often cannot: a mine sits on four of the specials and a wipeout on six,
//              so a client watching a Binder burn the position beside it can see the face that died
//              and has no way to say whose cube it was. Notes name the cube that *acts* — see
//              `specialName` — and this is the same answer for every other position on the line.
//
// Index for index against the line it was taken from, so a caller holding `faceIds` can read all
// three off the same subscript. Taken separately for the thrown line and the resolved one, because a
// scorch applied *this* rung is on the second and not the first — which is exactly the beat.
const lineState = line => ({
    frozen: (line || []).map(c => !!(c && c.frozen)),
    // What the fire has taken off the cube over the whole climb. There is no companion flag for "this
    // position is standing on a burnt face" because there is no such position: a burnt face is not
    // rolled. What this is for is the rack screen — a cube's odds are its face list less this.
    burned: (line || []).map(c => ((c && c.slot && c.slot.burned) ? [...c.slot.burned] : [])),
    // **This position is standing on a face the fire has just taken.** Not the same fact as `burned`,
    // which is what the cube has lost over the whole climb: this is about the face showing *now*, and
    // it is what makes a charred position draw dark and count for nobody instead of looking like an
    // ordinary cube the count is ignoring for no reason.
    charred: (line || []).map(c => !!(c && c.charred)),
    // **Which positions are carrying a blessing.** It rides the cube rather than the rung, so unlike
    // the ice this is not a fact about the throw — a cube blessed three rungs ago is still wearing it,
    // and the player has to be able to see which one it is or the whole face works off screen.
    blessed: (line || []).map(c => !!(c && c.slot && c.slot.blessed)),
    // **The colour this position's face has been painted**, or null. Per position rather than per cube
    // because that is what the client draws: the art is tinted to the side the face in front of you
    // counts for, which is the whole of how one picture goes on saying two things. The cube's marks are
    // on its slot and travel with it; this is which of them landed.
    painted: (line || []).map(c => ((c && c.paint) ? c.paint : null)),
    // Off `special` rather than off `slot.id`, which is the cube the position *arrived* with: a clone
    // or a reflection rewrites the cube standing here and only the first of the two follows it.
    cubeIds: (line || []).map(c => ((c && c.special) ? c.special.id : null)),
    // **How many cubes the cube standing here is carrying**, nested holds included. The one thing on
    // this list that isn't visible on the position at all: a captured cube is off the line, so a
    // sandcrawler with four in it and one with none draw exactly alike. Zero everywhere on a table
    // with nothing captured, which is nearly every table.
    holds: (line || []).map(c => ((c && c.slot) ? countHeld(c.slot.held) : 0)),
});
exports.lineState = lineState;

// Resolves a composed line into the cubes that actually get counted, plus everything the
// special cubes did to the payout and the run.
//
// Two passes, because a cube's own side has to be settled before anything starts copying,
// inverting or fusing cubes around it:
//   1. faces that decide the side of the position they landed on, and the modifiers that
//      only touch the payout or the run.
//   2. faces that restructure the line, left to right — the order they were rolled in. A
//      cube burned or bound away by an earlier effect no longer gets its turn.
//
// **This mutates `line`.** The first pass strips the side off every effect face in place, and
// `enliven` marks copies on objects the caller handed in. Snapshot `rolledFaces(line)` before
// calling if you need the line as it was thrown — the reveal does exactly that.
//
// `bag` is what the run has left to draw from, and it is here because the Pit Droid's `draw` face
// pulls from it mid-resolution. It is copied rather than mutated and handed back on the result, so a
// caller that ignores it simply gets a Pit Droid that never finds anything.
//
// Returns the final line, notes describing what fired (in fire order, for the payout frame),
// and the modifiers the caller settles with.
const resolveLine = function (line, call, bag, opts = {}) {
    // Every special face **as thrown**, for the lifetime tallies on the rack screen. Taken here,
    // before anything resolves, because resolution rewrites faces — an invert strips a Shmi's art,
    // a bind swaps a Binder for a hybrid — and the tally is about what the cube rolled, not what it
    // was left as.
    // `from` is set on a welded face and names the cube it came off, so a weld's faces are tallied
    // against their parents rather than against the weld. See `buildWeld`.
    const faceLog = line
        .filter(c => c.special && c.face)
        .map(c => ({ id: c.face.from || c.special.id, key: faceKey(c.face) }));

    // **Every slot on the line has a hold, even if it arrived without one.** `throwSet` builds slots
    // through `slotOf` and those always do, but `resolveLine` is a public entry point and a line
    // built by hand — a harness, a client replaying a stored roll — can hand over a slot from before
    // holds existed. Normalised once here so nothing downstream has to ask.
    for (const c of line) if (c.slot && !Array.isArray(c.slot.held)) c.slot.held = [];

    // The bag, as this roll leaves it. Only the Pit Droid touches it.
    const rest = [...(bag || [])];

    // **The wreckage.** Everything the run has destroyed, swept up at the end of each roll and kept
    // in the order it was lost — a junkyard, carried by the run because nothing owns it. `scavenge`
    // reaches into it when the cube doing the scavenging has nothing of its own to fetch.
    //
    // Cubes a captor is **holding** are not in here and never were. They are not destroyed, they are
    // somewhere — inside the cube that took them, on that cube's slot — which is what lets them come
    // back out with the ice and the scorch marks they went in with, and what makes a captor worth
    // breaking open. See `slotOf`.
    const hold = [...(opts.hold || [])];
    // **What this roll has already put in the hold**, so the sweep at the end does not put it there a
    // second time. A Jawa taking its turn sweeps the wreckage in early — see the `scavenge` case — and
    // the two sweeps are looking at the same cubes from opposite ends of the roll. Identity rather than
    // contents: what goes into the hold is a copy, so the only thing that can be compared afterwards is
    // the slot it was copied from.
    const takenIn = new Set();
    // Cubes the *player* took off this line before it resolved — Scrap, and nothing else so far. They
    // are wreckage like anything else the roll took, so they belong in the hold; they arrive here
    // rather than being swept up below because the line they were on no longer holds them, and a cube
    // the player scrapped is exactly the sort of thing the Jawa exists to fetch back.
    const wrecked = [...(opts.wrecked || [])];
    // Specials this roll pulled back out of the hold, so the caller can take them off `spent`. A cube
    // standing on the table and listed as shattered is a lie the rack screen would eventually tell.
    const recovered = [];
    // Cubes that **joined the table mid-roll** and were part of the run before they did: one drawn
    // off the bag, one salvaged out of the wreckage, one that walked out of a hold. The sweep at the
    // end has to see these as well as the thrown line, or a cube that came back and was then
    // destroyed in the same roll leaves the run entirely — it is in neither pile.
    //
    // Cubes *conjured* — a reflection, a Fode, a Padmé — are deliberately not in here. They never
    // joined the set, so a runaway throw cannot fill the junkyard with cubes nobody ever owned.
    const joined = [];
    // How many rungs this run has walked, **including the one being thrown.** Mon Gazza is the only
    // face that needs it and it is the only number in a roll that is about the run rather than the
    // line, which is why it comes in rather than being derivable from anything here.
    const rungs = Math.max(1, Number(opts.rungs) || 1);

    const notes = [];
    const broken = [];
    // What this roll **adds** to the run's payout multiplier, not a factor to scale it by. Starts at
    // zero because a roll with no paying faces in it adds nothing; the run's own ×1 lives on the
    // ladder and the caller sums the two.
    let mult = 0;
    let shortcuts = 0;
    let rerolls = 0;
    let ended = null;
    // The mine that went off, by cube name, and nothing about whether the run survived it. That is
    // decided after the line has finished resolving, on whether anything countable is left standing.
    let detonated = null;
    // The three things the Planet Octahedron does that aren't to the line at all. They are reported
    // rather than applied here, because none of them is the line's business: a sealed side and a
    // sealed bank are the *run's* state, and a won tie is the caller's verdict to hand out.
    let sealed = null;


    // Every face that moves the payout multiple, recorded **where the multiple is actually moved**
    // rather than reconstructed afterwards from the line. That is the whole reliability of phase two
    // of the reveal: what plays back on screen is the same list of additions that got paid, in the
    // same order, so the walk cannot drift from the number at the end of it. See `multSteps`.
    const pays = [];

    // One note is one thing that happened, as data. `kind` is the note's own kind rather than the
    // face's, because several faces report differently depending on what they found next to them —
    // a clone at the head of the line destroys, and that is a different sentence from a clone.
    const note = (c, kind, data) => notes.push({
        kind,
        faceId: faceIdOf(c),
        specialId: c.special ? c.special.id : null,
        specialName: c.special ? c.special.name : null,
        ...data,
    });
    // What a paying face records for the multiplier walk: enough to name and draw itself later,
    // when the line it was standing on has already been resolved out from under it.
    //
    // `bonus` is carried rather than re-derived from the kind, because the Boost Cube's is a function
    // of how long the line was — and by the time the walk plays back, that line is gone.
    // `positions` defaults rather than being left off: only the Seam and the Boost pass one, and a
    // record carrying `undefined` is one a database will not take — see `pruned` in `persist.js`.
    // A parked tie stores its Multiplier records verbatim, so this was the difference between a tie
    // saving and the whole roll failing.
    const pay = (c, kind, side, bonus, positions = null) => pays.push({
        cube: c,
        kind,
        side,
        bonus,
        positions,
        faceId: faceIdOf(c),
        specialId: c.special ? c.special.id : null,
        specialName: c.special ? c.special.name : null,
    });

    // A face either *is* a side or *does* a thing. Every position starts life as a plain cube with
    // a rolled side; a special that lands an effect face on one takes that side away, so the
    // position holds its place in the line and contributes to neither colour.
    //
    // This is what stops a face having to say two things at once, which is what forced effect faces
    // to be drawn as a colour square plus an effect and made a seven-cube line read as nine. It also
    // means an effect takes a cube out of the count without shortening the line, so even counts are
    // now common — survivable only because a tie goes to Watto's tie-breaker instead of the house.
    const SIDED = new Set(['wild', 'side']);

    // Pass one for **one** position, factored out because the Pit Droid can put a cube on the table
    // halfway through pass two and it has to arrive settled — with its side stripped or asserted and
    // its note written — exactly as though it had been in the line from the start.
    const settle = function (c) {
        // **Paint decides the side, whatever the face is.** This is the whole of the rule change the
        // crowd brought with it — see `docs/planet-octahedron.md` §1. An unpainted effect face is
        // stripped exactly as it always was; a painted one keeps the colour it was painted, which is
        // the only way a face in this game does a thing *and* counts for a side. It overrides a wild
        // too, deliberately: paint is not a bonus on top of what a face is, it is what the position
        // counts as, and a wild the crowd painted the wrong way is the sharpest thing on the cube.
        if (c.face && (c.paint || !SIDED.has(c.face.kind))) c.side = c.paint || null;
        if (!c.face) return c;
        switch (c.face.kind) {
            case 'end':
                // RIPratts, and nothing is said about him here. He is a mine: he goes off in his turn
                // in pass two, and a mine that never got its turn — because something ate it first —
                // did nothing and should say nothing. This used to note "the run ends here"
                // unconditionally, on rolls that then went on to survive him.
                break;
            case 'broken':
                // Wipeout. Handled in the **second** pass, not here — see the `broken` case there.
                break;
            case 'wild':
                c.side = call;
                note(c, 'wild', { side: call });
                break;
            case 'side':
                c.side = c.face.side;
                note(c, 'side', { side: c.face.side });
                break;
            // The four paying faces say what they are here and are **scored nowhere near here** — see
            // the pass over the resolved line below, which is the only place any of them counts. This
            // pass reads the line as thrown, and what a cube was thrown as is not yet what it is worth:
            // Ben has not lain across it yet, the Tusken has not taken it, the Binder has not written
            // over it. A note is a description of a face and survives all of that; a payout is a claim
            // about the table and must not.
            case 'greed':
                note(c, 'greed', { bonus: config.greedBonus });
                break;
            case 'boost':
                // What it will be worth isn't knowable yet — it pays per position and the line hasn't
                // finished changing length. So the throw promises a rate and the payout walk quotes
                // the sum, which is the same past-tense/future-tense split the Multiplier already has.
                note(c, 'boost', { bonus: config.boostBonus });
                break;
            case 'mult':
                // The one face that *names* a side without being one: it says which way it pays,
                // and like every other effect face it counts toward neither.
                note(c, 'mult', { side: c.face.side, bonus: config.multBonus });
                break;
            case 'heat':
                // The rate is knowable here and nowhere else is it cheaper: it comes off how many
                // heats this cube has already spent, which the slot carried in. The face burns itself
                // off in the payout pass, where it is also counted, so what the throw promises and what
                // the walk quotes are the same number read at two moments.
                note(c, 'heat', { bonus: config.heatBonus * (((c.slot && c.slot.heat) || 0) + 1) });
                break;
            case 'guide':
                // What it will be worth isn't knowable yet — it pays for a run of cubes the line has
                // not finished rearranging — so the throw says nothing about the amount and the payout
                // walk quotes it, the same split the Boost Cube has.
                note(c, 'guide');
                break;
            case 'shortcut':
                note(c, 'shortcut');
                break;
            case 'reroll':
                // The cube stays on the table. It used to shatter itself here, which meant every single
                // payout reported a shatter and the cube never once rendered as the thing that actually
                // breaks it. Only a wipeout shatters, on this cube as on every other — that is what the
                // shatter line is for.
                note(c, 'reroll');
                break;
            default:
                break;
        }
        return c;
    };

    for (const c of line) settle(c);

    // The working line. Overwritten, reflected and fused cubes are plain — they carry no face of
    // their own, so nothing can cascade off them.
    let final = line.slice();
    // A cube conjured mid-resolution gets a slot of its own — it is a real cube from the next level
    // on, so it needs somewhere for a future scorch or freeze to land.
    const plain = side => ({ side, special: null, face: null, slot: plainSlot() });
    const at = c => final.indexOf(c);
    // A position that counts. Destructive faces work on positions — burning an effect off the line
    // is as legitimate as burning a cube — but anything that *copies* or *fuses* sides needs a side
    // to work with, and an effect hasn't got one.
    const isCube = c => !!c && !!c.side;
    // How long a run of the called side a position is standing in, counted outward both ways and not
    // counting the position itself. A corpse is not a cube, so a razed wing stops it exactly as an
    // opposing colour does — and so does any effect face, which is what makes what the Guide pays the
    // same thing a player counts by looking at the line.
    const ours = x => !!x && !x.gone && x.side === call;
    const guideRun = function (idx) {
        if (idx < 0) return 0;
        let n = 0;
        for (let k = idx - 1; k >= 0 && ours(final[k]); k--) n += 1;
        for (let k = idx + 1; k < final.length && ours(final[k]); k++) n += 1;
        return n;
    };
    // A cube destroyed *in place*: it holds its position so the line can draw what happened to it,
    // counts toward neither side, and is dropped from the set — so the table is genuinely shorter
    // from the next level on, it just doesn't vanish mid-picture. Ben's wings are the only user.
    // `mirrored` is the same picture facing the other way, for art that has a handedness. Ben's
    // left third is the only user: reflected, it has to come back as his right third or the
    // reflection draws him inside out.
    const razed = (id, mirrored) => ({
        side: null, special: null, gone: true, slot: plainSlot(),
        face: { kind: 'razed', id, mirrored },
    });

    // The line as each restructuring face leaves it, in fire order, so the roll can be played back
    // one effect at a time instead of cutting from the throw straight to the aftermath. A step is
    // only recorded when the face actually changed something — a mirror with nothing behind it, or
    // a bind at the end of the line, did nothing worth a frame.
    const steps = [];

    // How many times a blessing turned something away this roll, for the frame that reports it. The
    // blessings themselves ride the cubes and outlive the roll; this is only the count of the ones
    // spent here.
    let saves = 0;

    // A copy of a face is a real face and gets its own turn — a cloned Greed pays twice, a
    // reflected Tusken culls twice. That needs a **work queue** rather than a walk over the thrown
    // line, because the line grows turns as it resolves.
    //
    // **A copy is a cube, so it acts exactly like one, and there is no depth rule.** A reflected
    // Mirror reflects. A cloned Binder clones. A Binder off a Mirror off a Binder goes on going.
    // Copies used to be inert one level down — a Binder cloning a Binder stopped at the second — for
    // the obvious reason: without that, the queue feeds itself and never empties.
    //
    // It feeds itself. That is the point. The one rule that stopped it was also the rule that made
    // two Mirrors on a rack the dullest thing the mode could draw, and the runaway it was holding
    // back is a better outcome than the sentence it was written in. **The overflow is what stops
    // it** — `overflowAt` cubes handed a turn and the roll is abandoned where it stands — so the
    // bound is a budget rather than a rule about what a copy is allowed to be.
    //
    // A copied Pit Droid draws like any other: `drawOne` spends the bag, which is finite and never
    // refilled, so it was never the thing that needed bounding.
    // **Nugtosh's blessing, marked before pass two rather than during it.** Every other face on the
    // die acts in its turn; this one has to be in force for the whole rung or it protects only
    // whatever happened to be destroyed after it came up, which is a rule about firing order rather
    // than about the cube. So it is read off the thrown line here, between the two passes, and the
    // destroyers below simply find it already there.
    //
    // **It never blesses itself** — the same rule the prison carries, and for a sharper reason: a die
    // that cannot be destroyed cannot be plunged, and the plunge is the key to the prison.
    for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (!c || c.gone || c.frozen || !c.face || c.face.kind !== 'blessing') continue;
        // **Never a cube that is already blessed**, which is the same rule the crowd paints under: a
        // face that can land on a target it cannot change is a face doing nothing on a table it is
        // supposed to be improving. A line where every cube already carries one is a real endpoint and
        // it says so rather than blessing somebody twice.
        const pool = line.filter((x, j) => j !== i && x && !x.gone && x.slot && !x.slot.blessed);
        if (!pool.length) {
            note(c, 'blessing.nothing');
            continue;
        }
        const lucky = pool[crypto.randomInt(0, pool.length)];
        lucky.slot.blessed = true;
        note(c, 'blessing', {
            faceId: faceIdOf(lucky), special: !!lucky.special, at: i, hitAt: [line.indexOf(lucky)],
        });
        // Its own frame, for the reason the crowd needs one: this is marked before pass two rather
        // than taking a turn in it, so the walk that hands every other face a frame never reaches it.
        // Without this the blessing lands, saves a cube three frames later, and the save has no cause
        // on screen — the worst version of an effect, which is one that works invisibly.
        steps.push({
            faceIds: line.map(faceIdOf),
            note: notes[notes.length - 1],
            at: i,
            ...lineState(line),
        });
    }

    const queue = line.slice();

    // Every cube handed a turn after the throw — reflections, clones, draws off the bag, a wipeout
    // the shield held together. The line as thrown is not in it: this counts the *growth*, which is
    // the only thing here that has no end of its own.
    let spawned = 0;
    // Tripped when the budget runs out, and it takes the run with it. See `overflowAt`.
    let overflow = false;

    for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        if (!c.face) continue;
        // **Frozen cubes take no turn.** The ice holds the face it landed on and stops it doing
        // anything with it, which is what disarms a frozen mine for a rung — and, in the other
        // direction, what stops a frozen Greed paying. It gets no frame either: a cube that was never
        // going to act is not an effect that found nothing to do.
        if (c.frozen) continue;
        const i = at(c);
        // Destroyed before its turn came round. A **captured** cube lands here too: it is off the
        // line and inside somebody, so its turn passes with it.
        if (i < 0) continue;
        // The slots standing when this turn began, each with the face it was showing. Slots are
        // objects and the line holds references to them, so the check after the turn can tell by
        // identity what this turn took off the line — the same trick the wreckage sweep uses at the
        // end of the roll, and the reason neither needs the destruction sites to know it exists.
        const stood = final.filter(x => !x.gone && x.slot).map(x => ({ slot: x.slot, faceId: faceIdOf(x) }));
        // And the slots this turn **makes**, which is the one way a hold can appear on the line
        // after `stood` was taken: a clone or a reflection of a captor comes with a copy of the
        // prisoners. A mirror that writes over a copy it made earlier in the same reflection would
        // otherwise take that copy's hold down with it, unseen by either end of the check.
        const made = [];
        // Cubes this turn has put **back** on the line — a parole, or a hold cracked open. The cube
        // taking the turn cannot take them again in the same breath: a sentence handed straight back
        // down would make the parole a lie, and it is the one interaction the two halves of Oovo IV's
        // turn have with each other.
        const freshlyFreed = new Set();
        let was = final.map(faceIdOf);
        let noteAt = notes.length;

        // **A copy needs no payout-side turn of its own.** It used to get one here, because the
        // originals were scored in the first pass and a copy was never in it — every paying kind but
        // `mult` and `end` had to be applied a second time, from a second place, with a second set of
        // rules for which. Now that every one of them is read off the resolved line, a copy counts by
        // standing on it, exactly like the cube it was copied from.

        // Where a turn handed out during this one goes: **next**, not last.
        //
        // The queue starts as the line in reading order and pass two walks it that way, so a cube
        // conjured onto the acting face's right belongs at the point the walk has just reached. Appending
        // put it behind every original still waiting, which meant a Mirror's reflections acted *after*
        // cubes standing to their right — the line resolving out of order, and the reveal playing it
        // that way: an effect at position 9 firing before the reflection at position 4 that was already
        // on the table when it did.
        //
        // `handed` keeps a face that hands out several — a Mirror reflecting a run — in the order it made
        // them, which is nearest-the-glass first and so left to right like everything else. Without it
        // each insertion would land in front of the one before and the run would resolve backwards.
        let handed = 0;
        const giveTurn = (x) => {
            queue.splice(q + 1 + handed, 0, x);
            handed += 1;
            spawned += 1;
            if (spawned >= config.overflowAt) overflow = true;
            return x;
        };

        // Hands a freshly made copy its own turn. Unconditional: see the note on the queue.
        const enliven = function (x) {
            x.copy = true;
            return giveTurn(x);
        };
        // Art with a handedness turns around when it is duplicated — Ben's left third becomes his
        // right — so three thirds of him never come back as three of the same. Anything symmetrical
        // declares no counterpart and is copied as it stands.
        //
        // A `dir` turns around with the art, and for a reflection that is the whole of what turning
        // around means: a reflected cube gets a turn of its own, so an engine that came back out of
        // the glass still pointing the way its original pointed would aim at the cube its original
        // has already burned, from the far side of the mirror. The heading and the id it draws as are
        // declared together, so they flip together.
        const turned = function (src) {
            const x = { ...src, copy: false };
            // **A copy inherits the scorch marks and never the ice.** Which faces a cube has left is a
            // property of the cube, so a burnt Wild reflects as a burnt Wild; ice is a property of the
            // *original*, which is the thing Ando Prime froze. The slot is copied rather than shared,
            // or the two would end up as one entry in the set wearing two positions.
            //
            // **And it inherits the prisoners.** Rule 2 of capture: a cloned or reflected captor comes
            // with what it was holding, deep-copied all the way down, so the two cubes are two cubes —
            // cracking one open has nothing to do with the other. It is the one place in the game that
            // makes cubes out of nothing and it is deliberate: the copy is a real second cube, and a
            // real second cube full of real cubes.
            x.slot = {
                ...(src.slot || plainSlot()),
                burned: [...(src.slot ? src.slot.burned : [])],
                held: cloneHeld(src.slot ? src.slot.held : []),
                frozen: null,
            };
            if (x.slot.held.length) made.push({ slot: x.slot, faceId: faceIdOf(x) });
            x.frozen = false;
            const f = x.face;
            if (f && f.mirrored) {
                x.face = { ...f, id: f.mirrored, mirrored: f.id };
                if (f.dir) x.face.dir = f.dir === 'left' ? 'right' : 'left';
            }
            return x;
        };
        // One cube off the bag, thrown and brought up to where the rest of the line already is — the
        // Pit Droid hands it over halfway through pass two, so it needs pass one applied to it and a
        // turn of its own, or a drawn special would sit there inert. `enliven` is what grants that
        // turn, which also means a drawn cube obeys the same one-level rule every copy does.
        const drawOne = function () {
            // **Off the back of the bag.** A level takes from the front, and with the loadout capped to
            // `bagSize()` there is no tail behind the levels — front and back are one shuffled pile, so
            // which end this takes from changes nothing except that it cannot collide with the cube the
            // next level is about to draw. What the droid buys is *earlier*, not *more*.
            const id = rest.pop();
            const special = id ? specialById(id) : null;
            // Straight off the bag, so it arrives with a clean slot: nothing has been done to a cube
            // that has not been on the table yet.
            const slot = slotOf(id);
            // Straight off the bag and therefore unburnt — nothing has been at a cube that has not been
            // on the table yet — so there is nothing here for the fire to have taken. Drawn through the
            // same list the throw uses all the same, so the two draws cannot drift apart.
            const faces = rollFaces(special, slot);
            const x = settle({
                side: rollSide(),
                special,
                face: special && faces.length ? faces[crypto.randomInt(0, faces.length)] : null,
                slot,
            });
            // It was genuinely thrown, so it belongs in the lifetime face tallies like any other throw
            // — against the parent cube if this is a weld, exactly as the thrown line above does it.
            if (special && x.face) faceLog.push({ id: x.face.from || special.id, key: faceKey(x.face) });
            joined.push(x);
            // **Always live, whoever drew it.** A cube handed over that never acted put a Ratts on the
            // resolved line as a mine that never went off, which is the one face that must never be able
            // to do that. It goes in next, like every other turn handed out mid-pass: slipped in on the
            // droid's right, so the walk reaches it there rather than after everything to the right of it.
            //
            // `copy` still goes on. It no longer gates anything — see the queue — but it is what the
            // line means by a position that was not thrown, and the drawn cube wasn't.
            x.copy = true;
            return giveTurn(x);
        };
        // The hold's answer to `drawOne`, and the difference between them is the whole of the two
        // cubes: the droid takes a cube the climb had not reached yet, this takes one the climb has
        // already lost. It arrives with the state it left with — a Turbine comes back as hot as it was,
        // a scorched cube as burnt, its own prisoners still inside it — because the slot **is** the
        // cube and it was never destroyed, only put somewhere.
        //
        // `from` is the list it comes out of and `pick` which end: a cube's own inventory and the
        // run's wreckage are both piles of slots, and this is what puts one back on the table
        // whichever pile it was in.
        const liftOne = function (from, pick = 'pop') {
            const raw = pick === 'shift' ? from.shift() : from.pop();
            // **The slot itself where there is one, not a copy of it.** A cube coming out of a hold
            // is the same cube that went into it, and the sweep at the end of the roll works out
            // what left the table by slot *identity* — so a fresh object here would leave the
            // original looking destroyed while the copy stands, and one cube would be in two places:
            // on the table and in the junkyard, ready to be scavenged back out a second time.
            const slot = (raw && typeof raw === 'object' && Array.isArray(raw.held)) ? raw : slotOf(raw);
            const special = slot.id ? specialById(slot.id) : null;
            const faces = rollFaces(special, slot);
            const x = settle({
                side: rollSide(),
                special,
                face: special && faces.length ? faces[crypto.randomInt(0, faces.length)] : null,
                slot,
            });
            if (special && x.face) faceLog.push({ id: x.face.from || special.id, key: faceKey(x.face) });
            if (special) recovered.push(special.id);
            joined.push(x);
            // A cube that walks out of a hold can be holding cubes of its own, and it can be
            // destroyed in the same turn that freed it — a plunge taking the end of the line a
            // parole just put a cube on. `stood` was taken before it existed, so the check needs
            // telling about it or that second hold goes down with it, unseen.
            if (x.slot.held.length) made.push({ slot: x.slot, faceId: faceIdOf(x) });
            x.copy = true;
            return giveTurn(x);
        };
        // **Where a cube coming back onto the table goes.** Immediately to the right of the cube
        // *taking the turn*, not of the cube that was holding it — the line resolves strictly left to
        // right, so anything put back behind the walk would sit out the roll it was freed into, and
        // being freed into a roll you then take no part in is barely being freed at all.
        //
        // Anything the actor destroyed **in place** is stepped over, so a released cube cannot land in
        // the middle of Ben. `i` is the fallback for the one case with no actor left to stand beside:
        // a captor that destroyed itself, which is where it was standing when it did.
        const releasePoint = function () {
            let k = at(c);
            if (k < 0) return Math.min(Math.max(i, 0), final.length);
            k += 1;
            while (k < final.length && final[k].gone) k++;
            return k;
        };

        // **Cracks a hold open.** Every prisoner walks, in the order they were taken, thrown and live
        // — they were never destroyed, so they come back with the ice, the scorch marks, the heat and
        // the prisoners of their own that they went in with.
        //
        // Built before anything is spliced, so the block lands in order rather than each one landing
        // in front of the last.
        const spring = function (slot) {
            if (!slot.held.length) return [];
            const out = [];
            while (slot.held.length) out.push(liftOne(slot.held, 'shift'));
            final.splice(releasePoint(), 0, ...out);
            out.forEach(x => freshlyFreed.add(x));
            return out;
        };

        // A live shield on the line: not itself destroyed, and not one that has already been spent
        // stopping something.
        // A live shield on the line. It needs no "already spent" flag: a shield that blocks a mine goes
        // with it, so it is off the line and cannot be found twice.
        const shielding = x => !!x && !x.gone && x.face && x.face.kind === 'shield';

        // The positions an effect standing at `i` can reach: clipped to `reach` on each side when it
        // has one, and stopped at the nearest live shield on either flank. The shield sits *inside*
        // the span — it stops what reaches its own position — and `stopped` names the shields that
        // did, for the effects that break what stops them.
        const shieldSpan = function (i, reach = Infinity) {
            const stopped = [];
            let first = Math.max(0, i - reach);
            let last = Math.min(final.length - 1, i + reach);
            for (let k = i - 1; k >= first; k--) if (shielding(final[k])) { first = k; stopped.push(k); break; }
            for (let k = i + 1; k <= last; k++) if (shielding(final[k])) { last = k; stopped.push(k); break; }
            return { first, last, stopped };
        };

        // **The ice takes one hit.** Anything that would destroy, overwrite or switch a frozen cube
        // shatters the ice instead: the effect is spent, the face it was holding survives, and the cube
        // walks away thawed. That gives Ando Prime's freeze a second identity as one-shot armour whose
        // release condition is the table rather than a counter — and it is what makes the die's own
        // pairing resolve against itself with no rule of its own. **Fire melts ice**: Baroonda scorching
        // a frozen neighbour burns the ice off and the face survives.
        //
        // **A mine is not a hit.** The blast is a range rather than a target, and stopping one is the
        // Gungan Shield's whole job — ice that stopped a detonation would be a second shield with none
        // of the cost, on a cube that already carries no downside face.
        const iced = function (x) {
            if (!x || !x.frozen) return false;
            x.frozen = false;
            if (x.slot) x.slot.frozen = null;
            return true;
        };

        // **Nugtosh's blessing, from the receiving end.**
        //
        // **It stays on the cube and one thing takes it off: using it.** The blessing is a property of
        // the cube rather than of the rung — it is given once and it waits, through settlements, into
        // the next level and the one after, until something tries to destroy the cube it is on and it
        // spends itself turning that away. A cube can carry one; a table can carry several, and a climb
        // that meets Malastare four times has four cubes it is hard to lose.
        //
        // Two functions and not one, which the ice does not need: `iced` is asked exactly where the ice
        // is consumed, and this is asked in two different ways. `holy` is a look — the plunge walks the
        // line asking which cubes are protected before it knows which two it is taking, and a look that
        // spent the blessing would burn one off every cube it merely walked past. `spend` is the
        // consuming half, called only where a blessing actually turned something away.
        //
        // **It does not stop a cube destroying itself.** A wipeout is the cube coming apart and a mine
        // goes with its own blast; protecting either would make this "cannot leave the table" instead of
        // "cannot be destroyed", which would also stall the Turbine's schedule. So the acting position is
        // never covered against its own face.
        const holy = x => !!(x && x.slot && x.slot.blessed);
        const spend = function (x) {
            if (!holy(x)) return false;
            x.slot.blessed = false;
            saves += 1;
            return true;
        };

        // The two faces a rescued cube can never come up as, because both of them are the cube leaving
        // the table again: another wipeout would make the save no save at all, and a mine handed over by
        // a shield is a rescue that ends the run. Only the Reroll Cube carries both.
        const OFF_TABLE = new Set(['broken', 'end']);
        // What a shielded wipeout comes up as instead — one of the cube's **own** other faces, drawn at
        // the cube's own odds, so a saved Multiplier is far likelier to pay than a saved Sebulba is.
        // `null` when the cube has nothing else it could be, which no cube in the tuning currently is.
        const refaced = function (c) {
            const pool = c.special ? c.special.faces.filter(f => f && !OFF_TABLE.has(f.kind)) : [];
            return pool.length ? { ...pool[crypto.randomInt(0, pool.length)] } : null;
        };

        // **Parole, before the face is even looked at.** Rule 4 of capture: a jailer hands one
        // prisoner back at the start of every turn it takes, whatever it is showing that rung. The
        // promise belongs to the **cube** and not to any face on it — the sentence outlives the throw
        // that handed it down — so a die that came up Baroonda this rung still opens the door, and a
        // die that came up Oovo IV again pays one out before it takes four more in.
        //
        // Its own frame, because a cube walking back onto the line is a thing that happened rather
        // than a footnote to whatever the die did next. That is what `was` and `noteAt` are re-taken
        // for: the face that follows gets a clean frame of its own.
        if (c.slot && c.slot.held.length && c.special && JAILERS.has(c.special.id)) {
            const out = liftOne(c.slot.held, 'shift');
            final.splice(releasePoint(), 0, out);
            freshlyFreed.add(out);
            note(c, 'parole', { faceId: faceIdOf(out), left: c.slot.held.length });
            const after = final.map(faceIdOf);
            steps.push({
                faceIds: after, note: notes[noteAt] || null, at: at(c), ...lineState(final),
            });
            was = after;
            noteAt = notes.length;
        }

        switch (c.face.kind) {
            case 'mirror': {
                // A mirror standing in the line. The `n` cubes behind it are written onto the
                // `n` positions in front of it, nearest the glass first — *overwriting* what
                // was there, so the line never changes length. [A B 🪞 C D] becomes
                // [A B 🪞 B A]: C and D are gone, not pushed along.
                //
                // **Everything behind the glass reflects**, effects included. It used to be cubes
                // only, on the grounds that a mirror duplicating effects would cascade. It does
                // cascade; that is now the budget's problem rather than the rule's.
                const left = final.slice(0, i).reverse();
                if (!left.length) {
                    note(c, 'mirror.nothing');
                    break;
                }
                // **The reflection completes itself.** Where there aren't enough cubes on the right
                // to receive it, the mirror puts new ones there — it duplicates the table rather
                // than being truncated by the end of the line. Capped at `maxCubes`, because a
                // mirror standing at the very end of a full set would otherwise nearly double it,
                // and those cubes carry into every level above.
                const wanted = Math.min(left.length, Math.max(0, config.maxCubes - (i + 1)));
                if (wanted < 1) {
                    note(c, 'mirror.noroom');
                    break;
                }
                // **A true image of the line, special cubes included.** A Binder behind the glass
                // comes back as a Binder, drawing the face its original drew and counting whatever
                // its original counts.
                //
                // **And it cascades.** A reflected effect takes its turn like anything else on the
                // line, so a Mirror behind a Mirror reflects the reflection, and the pair of them
                // will run the table off the end of the world if the budget lets them. The image is
                // also a real cube from the next roll on, which is how a Mirror ends up handing you a
                // **second copy** of something off your own rack.
                let copied = 0;
                let made = 0;
                let froze = 0;
                for (let k = 0; k < wanted; k++) {
                    const to = i + 1 + k;
                    // A frozen cube is not overwritten — the reflection breaks against the ice and the
                    // image comes back with a hole in it, which is a picture worth having. Past the end
                    // of the line there is nothing to freeze, so a conjured position never hits this.
                    if (iced(final[to])) {
                        froze++;
                        continue;
                    }
                    // The reflection breaks against a blessing the same way it breaks against the ice —
                    // a cube written over is a cube destroyed, however tidily the image does it.
                    if (spend(final[to])) {
                        froze++;
                        continue;
                    }
                    if (to >= final.length) made++;
                    final[to] = enliven(turned(left[k]));
                    copied++;
                }
                // Anything the mirror skipped past that has no cube yet is filled in, so the line
                // never comes back with a hole in it.
                for (let k = 0; k < final.length; k++) if (!final[k]) final[k] = plain(rollSide());
                note(c, 'mirror', { copied, made, froze });
                break;
            }
            case 'invert':
                // Cubes only. An effect has no side to flip, and giving it one here would sneak it
                // back into the count through the back door.
                final.forEach((x) => {
                    if (!isCube(x)) return;
                    // **A wild is immune.** It isn't a side, it is *whatever you called* — and an
                    // invert flips the line, not your call. So it keeps counting your way and keeps
                    // drawing as Qui-Gon, which is the same statement it was making before.
                    //
                    // This is also the honest reading of the screen. A real Level 5 roll came out
                    // `:restart: 🔄 :DyeGon: 🟦 :DyeGon: :andotent: 🟥` on a blue call: everyone who
                    // looked at it read a blue majority, and flipping the wilds made it 1 blue to 3
                    // red. The cubes were right and the rule was wrong.
                    if (x.wild || x.face?.kind === 'wild') return;
                    x.side = OTHER[x.side];
                    // A face that asserts a *fixed* side — Shmi's red, Anakin's blue — is wrong the
                    // moment it's flipped, so it drops its art and draws as the side it now counts
                    // as. Without that a Shmi could sit there showing 🟥 while counting blue.
                    if (x.face && SIDED.has(x.face.kind)) x.face = null;
                });
                note(c, 'invert');
                break;
            case 'end': {
                // **A mine, not a verdict.** It destroys every cube on its own side of the nearest
                // shield and the run ends only if nothing countable is left standing — which on an
                // unshielded line is always, because the blast takes everything. So this reads as a
                // rewrite and behaves, on every rack without a Gungan Shield on it, exactly as the old
                // rule did.
                //
                // Two shields contain it between them, one stops it on its own flank, and none lets it
                // take the row. All three fall out of the same two lookups rather than needing cases.

                // **He goes with it.** A mine that survives its own detonation is not a mine, and leaving
                // him standing in the crater made his own position the one place on the line the blast
                // could not reach. Everything downstream then had to special-case him: the count walked
                // over a cube that was not there any more, and "the run is over" was read off his presence
                // rather than off what was left of the table.
                //
                // So the blast is now always at least one position — his — and an unshielded one takes
                // the whole row, which is what leaves nothing to look at and ends the run.
                // **The shields go too, and still stop it.** The blast reaches them and no further: it
                // takes them off the line along with everything between, and the positions beyond them
                // are untouched. A shield dies holding the line rather than instead of holding it — it
                // is destroyed, off the table, out of the count and reported as shattered, and the run
                // survives on whatever was standing behind it.
                //
                // Which also means a shielded blast can empty the line, if there was nothing behind it
                // to save. That is the right answer: the shield stopped the blast from reaching further,
                // and there was no further.
                // ---------------------------------------------------------------------
                // **The blast has a reach, and that is what makes a mine affordable.**
                // ---------------------------------------------------------------------
                //
                // Everything above describes an unbounded blast, and an unbounded blast cannot be carried.
                // The set persists, so a cube drawn at Level 2 is thrown four more times and one mine face
                // has a **51.8%** chance of ending the run before the top; for the cube to pay for that it
                // must multiply the run by `(6/5)^throws` — **2.07x** — and the only cube in the game in
                // that class is the Wild. Every other carrier measured *below an empty seat*, which is why
                // the strongest rack a greedy build finds contains no mine at all, and why every mine-facing
                // tool in the mode — this shield, Scrap, Swap, Premonition — had nothing to point at.
                //
                // `blastReach` bounds it, so a mine costs **cubes** instead of the run. Its price stops
                // being a share of everything and starts being a thing the pay table can be measured
                // against, which is the whole of the fix.
                //
                // **The shield's job changes with it, and it had to.** A bounded blast never reaches past
                // a neighbour, so "stops it further along" is inert at reach 1 — the old rule would have
                // left the Gungan doing nothing at all against the face it exists for. So a shield inside
                // the blast now **absorbs** it: the shield and the mine go, and every other position in
                // the reach walks away. That is a clearer promise than the old one ("stops it *here*"
                // rather than "stops it *somewhere*") and it is worth more the wider the reach.
                // ---------------------------------------------------------------------
                // **The blast travels out from Ratts, and a shield stops it.**
                // ---------------------------------------------------------------------
                //
                // This is the original rule with one thing added: a **reach**. It spreads from the mine in
                // both directions, a shield stops it on that side and dies holding, and everything behind
                // the shield lives. `blastReach` caps how far it can travel when nothing stops it.
                //
                // The reach is what makes a mine affordable at all, and it is the whole of the fix. The
                // set persists, so a cube drawn at Level 2 is thrown four more times and one mine face had
                // a **51.8%** chance of ending the run; paying for that needed a cube that doubled the run,
                // only the Wild was in that class, and every other carrier measured *below an empty seat*.
                // That is why the strongest rack contained no mine and why every mine-facing pick — this
                // shield, Scrap, Swap, Premonition — had nothing to act on.
                //
                // **A detour is recorded here because it wasted effort.** At `blastReach 1` this rule is
                // inert — a three-position blast has nothing "beyond a neighbour" to save — so it was
                // replaced with a shield that covered the whole line, survived, and *deflected*: the blast
                // turned and took the other side's cubes inside the window. That worked, but it was a
                // more complicated way to reach the same place, because a directional blast stopped on one
                // side **already** eats the far side and leaves your flank standing. Once the reach went to
                // 2 the original rule had room again and the deflection logic was pure overhead: an extra
                // dial, a side-comparison per position, and a rule a player had to be taught.
                //
                // So: no `shieldDeflects`, no colour test, no per-throw spent flag. The shield dies holding
                // the line, which is also the one thing it costs.
                const reach = Math.max(0, Number(config.blastReach) || 0);
                const { first, last, stopped } = shieldSpan(i, reach);
                const blast = [];
                // A blessed cube inside the reach is walked over, and it is the one case where an
                // unshielded blast does not take the row — which is exactly the case worth having:
                // the run ends when nothing is left standing, so one cube left standing is one run
                // that carries on. The mine itself is never spared from its own blast.
                for (let k = first; k <= last; k++) if (k === i || !spend(final[k])) blast.push(k);
                const spared = (last - first + 1) - blast.length;
                for (const k of stopped) if (final[k].special) broken.push(final[k].special.id);
                for (const k of [...blast].reverse()) final.splice(k, 1);

                detonated = c.special ? c.special.name : 'the cube';
                note(c, stopped.length ? 'end.shielded' : 'end', {
                    destroyed: blast.length,
                    shields: stopped.length,
                    // How many the blessing walked over, so the frame can say why a cube is still
                    // standing in the crater instead of leaving it as a hole in the count.
                    spared,
                    // Positions in the line the step was **handed**, all three of them, because the client
                    // cannot work any of it out for itself. `step.at` is the acting cube's index *after*
                    // the effect and this one took itself off the line, so the frame has no cube left to
                    // point at; the range is not derivable from `destroyed`, since the reach is clipped at
                    // the ends of the line; and `stopped` names the shield that ate it so the frame can
                    // point at the cube that did the work. `at` is what the blast spreads out from on
                    // screen. **The shields in `stopped` are gone by the end of the frame** — they die
                    // holding the line — so the only way for the client to label the ones that stopped it
                    // is to be told where they stood.
                    at: i,
                    from: blast[0],
                    stopped,
                });
                break;
            }
            case 'broken':
                // Wipeout. The cube **comes off the line**, in turn with everything else — it is
                // destroyed, and a destroyed cube shouldn't sit there being drawn as though it were
                // still a position. Resolving it here rather than in the first pass is what gives it
                // a frame of its own: the throw shows the wipeout face landing, and its step shows
                // the row closing over the gap.
                //
                // `spent` keeps the special off the table for the rest of the run, and because the
                // position is gone rather than merely flagged, the set is a cube shorter with no
                // extra bookkeeping.
                //
                // **Unless a shield is standing next to it**, in which case the cube holds together and
                // **throws again.** This costs the shield nothing — a cube coming apart is not a blast —
                // and it is what stops the Gungan Shield being dead weight on the great majority of
                // throws, which have no mine anywhere near them.
                //
                // The cube used to merely survive, and that left the shield's frequent case reading as
                // barely a save at all: a dead wipeout face standing in the line, holding a position,
                // counting toward neither side and doing nothing for the rest of the roll. Held together
                // is not the same as working, so it comes up as something it could have rolled instead.
                //
                // It arrives settled and live, exactly like a cube out of the bag — see `drawOne`, which
                // is the other place a face joins the line mid-pass and needs pass one applied to it and
                // a turn of its own. It costs a cube out of the overflow budget like every other turn
                // handed out mid-pass, which is the only thing bounding any of them now.
                if (shielding(final[i - 1]) || shielding(final[i + 1])) {
                    const swap = refaced(c);
                    if (!swap) {
                        note(c, 'broken.saved');
                        break;
                    }
                    // Noted **before** the swap, so the frame is labelled with the wipeout that was saved
                    // and carries what it became rather than the other way round. The new face writes its
                    // own note next, out of `settle`, and the two read in the order they happened.
                    note(c, 'broken.saved', { rolledFaceId: swap.id });
                    c.face = swap;
                    // Deliberately **not** added to the lifetime face tallies, unlike a drawn cube: a draw
                    // is a different cube off the bag, so one entry per cube per throw still holds there,
                    // and this would be the same cube counted twice on one roll.
                    settle(c);
                    c.copy = true;
                    giveTurn(c);
                    break;
                }
                broken.push(c.special.id);
                final.splice(i, 1);
                // **Which position went, stated, for the same reason the mine states its blast.** The cube
                // takes itself off the line, so `step.at` is `-1` and the frame has nothing left to point
                // at — and the client cannot work it out by walking the two lines either. Two wipeouts
                // standing next to each other leave a before and an after that read equally well as either
                // of them having gone, and a greedy walk resolves that by blaming the *later* position: a
                // row of them came apart right to left, in the opposite order to the one they fired in.
                note(c, 'broken', { at: i });
                break;
            case 'burn':
                if (i + 1 >= final.length) {
                    note(c, 'burn.nothing');
                    break;
                }
                if (iced(final[i + 1])) {
                    note(c, 'burn.iced');
                    break;
                }
                if (spend(final[i + 1])) {
                    note(c, 'burn.blessed');
                    break;
                }
                final.splice(i + 1, 1);
                note(c, 'burn');
                break;
            case 'clone': {
                // The cube on its right becomes a copy of the cube on its left. It destroys
                // nothing and adds nothing — the line is the same length, one position of it is
                // just now a duplicate — and it copies whatever is there, so a special on the left
                // comes out twice.
                const hasLeft = i - 1 >= 0;
                const hasRight = i + 1 < final.length;
                if (!hasLeft && !hasRight) {
                    note(c, 'clone.alone');
                    break;
                }
                // **At the head of the line it has nothing to copy, so it destroys instead.** The
                // cube's whole idea is that the position on its right becomes something else; with
                // no source for that, taking it off the table is the honest version of the same
                // sentence, and it beats the cube doing nothing at all.
                if (!hasLeft) {
                    if (iced(final[i + 1])) {
                        note(c, 'clone.iced');
                        break;
                    }
                    final.splice(i + 1, 1);
                    note(c, 'clone.destroy');
                    break;
                }
                if (hasRight && iced(final[i + 1])) {
                    note(c, 'clone.iced');
                    break;
                }
                // A clone destroys the position it writes over, which is destruction however tidily it
                // is done — the feed says *was overwritten by* and means it.
                if (hasRight && spend(final[i + 1])) {
                    note(c, 'clone.blessed');
                    break;
                }
                const src = final[i - 1];
                // Turned, like a reflection: cloning Ben's left third onto the right would
                // otherwise put two of the same third on the table. A cloned wing is junk either
                // way — it carries `gone` across, so it drops out of the set next level.
                const copy = enliven(turned(src));
                // **At the tail it makes room rather than giving up** — the one case where a clone
                // lengthens the line, and the only reason it needs the ceiling.
                if (!hasRight) {
                    if (final.length >= config.maxCubes) {
                        note(c, 'clone.noroom');
                        break;
                    }
                    final.push(copy);
                    note(c, 'clone.append', { srcFaceId: faceIdOf(src) });
                    break;
                }
                final[i + 1] = copy;
                note(c, 'clone', { srcFaceId: faceIdOf(src) });
                break;
            }
            case 'cull': {
                // One other cube gone — but the shot has to **cross the line to get there**, and that
                // is the one thing a shield stops. So the Tusken's targets are the positions it can
                // see: out to the nearest live shield on either flank, and no further.
                //
                // **This is the mine's rule, reused** — `shieldSpan`, the same walk the blast makes. A
                // shield stops what reaches its own position and dies where it is stopped; it turns
                // away everything behind it and pays nothing for that. Which means the shield is
                // one sentence rather than a list — *it stops anything that has to cross it* — and
                // every other destructive face falls out of that sentence for free: burn, Ben and the
                // Sandcrawler all act on a position they are touching, so nothing can ever stand
                // between them and it, and a purge is not travel at all.
                //
                // **The shield is a target, not a wall.** It sits inside the range it defines, so a
                // Tusken next to one is quite likely to shoot the shield itself — which is the
                // picture. That is also why the reach shapes the *choice* rather than being checked
                // after it: rolling a victim first and whiffing on a block would spend nothing, show
                // nothing and read as the face being broken, where culling out of what it can see
                // means the Tusken always hits something and the shield draws fire instead of
                // deleting the effect.
                const { first, last } = shieldSpan(i);
                const others = [];
                for (let k = first; k <= last; k++) if (k !== i) others.push(k);
                if (!others.length) {
                    note(c, 'cull.nothing');
                    break;
                }
                const victim = others[crypto.randomInt(0, others.length)];
                if (iced(final[victim])) {
                    note(c, 'cull.iced');
                    break;
                }
                if (spend(final[victim])) {
                    note(c, 'cull.blessed');
                    break;
                }
                const ate = shielding(final[victim]);
                final.splice(victim, 1);
                note(c, ate ? 'cull.shield' : 'cull');
                break;
            }
            case 'raze': {
                // Both neighbours at once, which keeps the count's parity intact.
                //
                // They are replaced rather than removed: each becomes the matching third of Ben, so
                // the three positions read as one wide picture of him lying across the line. The
                // cubes are as destroyed as they ever were — the wings contribute no side and are
                // dropped from the set — but the destruction is something you can see happen rather
                // than two cubes quietly absent from a shorter row.
                const left = i - 1 >= 0;
                const right = i + 1 < final.length;
                if (!left && !right) {
                    note(c, 'raze.nothing');
                    break;
                }
                // Ice on either side stops him on that flank and nowhere else, so a raze can come out
                // as half a Ben — which is the same picture he already makes at the end of a line.
                const wings = c.face.wings || {};
                // Ice first, then the blessing, and the ice is consumed either way: `iced` thaws what it
                // tests, and a cube that was both frozen and blessed has spent its ice turning away a
                // blow the blessing would have turned away anyway. That is the ice behaving as it does
                // everywhere else rather than a rule about the pair.
                const tookRight = right && !iced(final[i + 1]) && !spend(final[i + 1]);
                const tookLeft = left && !iced(final[i - 1]) && !spend(final[i - 1]);
                if (tookRight) final[i + 1] = razed(wings.right, wings.left);
                if (tookLeft) final[i - 1] = razed(wings.left, wings.right);
                if (!tookLeft && !tookRight) {
                    note(c, 'raze.iced');
                    break;
                }
                note(c, 'raze', { both: !!(tookLeft && tookRight) });
                break;
            }
            case 'pair': {
                // Fode and Beed: two heads that never agree. A cube is **inserted** either side of
                // him — nothing already on the table is overwritten, the line simply gets two
                // longer — and the two are always opposite sides, so the pair is a wash in the
                // count and pure structure. What it really does is push his neighbours apart,
                // which is what everything positional downstream then has to deal with.
                if (final.length + 2 > config.maxCubes) {
                    note(c, 'pair.noroom');
                    break;
                }
                const left = rollSide();
                final.splice(i + 1, 0, plain(OTHER[left]));
                final.splice(i, 0, plain(left));
                note(c, 'pair', { side: left });
                break;
            }
            case 'twins': {
                // Padme, twice over: the same two insertions, but the pair **match**. A two-cube
                // swing rather than a wash, and the only face in the game that can hand one side
                // two cubes out of nowhere.
                if (final.length + 2 > config.maxCubes) {
                    note(c, 'twins.noroom');
                    break;
                }
                const side = rollSide();
                final.splice(i + 1, 0, plain(side));
                final.splice(i, 0, plain(side));
                note(c, 'twins', { side });
                break;
            }
            case 'draw': {
                // One more cube off the bag, slipped in on its right — thrown, settled and live, so a
                // special it hands you takes its turn on this very roll.
                //
                // **It moves the climb forward rather than adding to it.** The bag holds exactly what a
                // full climb draws, so a cube taken here is one fewer at Level 5: the droid front-loads
                // the run, and burns itself out for free once the bag is dry.
                //
                // That is worth more than it sounds — a special met at Level 2 throws four more times
                // than the same cube met at Level 5, and `purge` charges for exactly how much this one
                // managed to put down.
                if (!rest.length) {
                    note(c, 'draw.empty');
                    break;
                }
                if (final.length + 1 > config.maxCubes) {
                    note(c, 'draw.noroom');
                    break;
                }
                // **The droid's note has to come first, and `drawOne` writes one of its own.** A frame is
                // labelled with the first note its turn produced, and pass one applied to the drawn cube
                // writes that cube's note — so pulling a *special* out of the bag, which is the whole
                // reason the face is worth watching, put the ring on the droid under a sentence about the
                // Greed Cube. The draw itself went unmentioned, on exactly the draws worth mentioning.
                //
                // So the drawn cube's notes are lifted back off and re-appended behind the droid's. Both
                // are still reported and the order they read in is now the order they happened in.
                const before = notes.length;
                const got = drawOne();
                const its = notes.splice(before);
                final.splice(i + 1, 0, got);
                note(c, 'draw', { faceId: faceIdOf(got), special: !!got.special });
                notes.push(...its);
                break;
            }
            case 'scavenge': {
                // The Jawa goes through the hold and puts the last thing in it back on the line, in on
                // its right, thrown and live — the same geometry and the same liveness the droid's draw
                // has, for the same reason: a special handed over inert would be a Ratts that never went
                // off.
                //
                // **It reads the hold as it stands at this moment**, and the sweep below brings this
                // roll's own wreckage into it first — so a cube that went up two positions ago can come
                // straight back on the same line. That is the whole of what makes the Jawa a *reaction*
                // rather than a delayed payout: the interesting throw is the one where you watch a cube
                // go and watch it come back, and it was unreachable while the hold only filled at
                // settlement.
                //
                // **The cube the player scrapped is salvage too**, and that is a deliberate reversal.
                // The end-of-roll sweep existed so a Jawa could not hand back a scrap the player had
                // paid for, on the grounds that it refunds the purchase — but Scrap takes a cube off the
                // *line* and the Scavenger is the cube that pulls things back onto it, and a rack
                // fielding both should have to live with that rather than be protected from it. It is a
                // tension the player built, on two picks they chose.
                //
                // Swept here rather than at each destroyer for the reason the end sweep reads the thrown
                // line rather than the working one: a cube a Mirror conjured and a Tusken then ate never
                // really joined the set, and sweeping at the site would put cubes nobody ever owned into
                // the hold. One place, one rule, asked at the only moment anything reads it.
                //
                // The scrapped cube is swept separately because it is **not on the thrown line** — it
                // was taken off before the line was re-parked, which is exactly why the end sweep has
                // always handled it apart from the rest.
                //
                // **A captured cube is not wreckage**, at any depth, so what a captor is carrying counts
                // as standing here exactly as it does in the end sweep — otherwise this would fetch a
                // prisoner out of the junkyard while its captor is still holding it, and the same cube
                // would be in two places.
                const up = new Set();
                const stow = (slots) => { for (const sl of slots) { up.add(sl); stow(sl.held); } };
                for (const x of final) {
                    if (!x || x.gone || !x.slot) continue;
                    up.add(x.slot);
                    stow(x.slot.held);
                }
                const already = new Set(hold);
                for (const w of wrecked) {
                    if (!w || takenIn.has(w)) continue;
                    hold.push({ ...w });
                    takenIn.add(w);
                }
                for (const x of line) {
                    if (!x.slot || up.has(x.slot) || already.has(x.slot) || takenIn.has(x.slot)) continue;
                    hold.push({ ...x.slot });
                    takenIn.add(x.slot);
                }
                // **Its own hold first, the junkyard second.** A cube it hauled off the line is
                // this cube's to fetch back; the wreckage belongs to nobody and is what it reaches
                // into once its own hold is empty. Both are piles of slots and `liftOne` does not
                // care which — the order is the whole of the rule, and it is what keeps the two
                // halves of this cube a loop rather than two unrelated faces sharing a die.
                const own = (c.slot && c.slot.held.length) ? c.slot.held : null;
                const from = own || hold;
                if (!from.length) {
                    note(c, 'scavenge.empty');
                    break;
                }
                if (final.length + 1 > config.maxCubes) {
                    note(c, 'scavenge.noroom');
                    break;
                }
                // The recovered cube's own note is lifted off and re-appended behind the Jawa's, so the
                // frame is labelled with the salvage rather than with whatever the cube happened to roll
                // on the way back. Same trick and same reason as `draw`.
                const before = notes.length;
                const got = liftOne(from);
                const its = notes.splice(before);
                final.splice(i + 1, 0, got);
                note(c, 'scavenge', { faceId: faceIdOf(got), special: !!got.special, own: !!own });
                notes.push(...its);
                break;
            }
            case 'haul': {
                // The sandcrawler takes the cube on its right off the line and into the hold. Not
                // destroyed — held, exactly as Oovo IV holds a prisoner, and a later `scavenge` is what
                // fetches it back.
                //
                // It is the cube's price and its setup at once. The line is a position shorter for the
                // rest of the roll, which pushes an odd count even on a mode that loses 60% of its ties;
                // it takes whatever is standing there, up to and including a hot Turbine; and a run that
                // ends before a `scavenge` comes up never sees the cube again.
                const target = final[i + 1];
                if (!target || target.gone || freshlyFreed.has(target)) {
                    note(c, 'haul.nothing');
                    break;
                }
                // **Into this cube's own hold**, not into a pile the run keeps: the sandcrawler is
                // carrying it, which is what makes breaking the sandcrawler open worth doing and what
                // gives a reflected copy a hold of its own rather than a second door onto the same one.
                //
                // The slot itself rather than a copy of it, so the sweep at the end of the roll can
                // tell a cube that was carried off from one that was destroyed — they leave the line
                // the same way and only identity separates them.
                const mine = c.slot || (c.slot = plainSlot());
                mine.held.push(target.slot || plainSlot());
                final.splice(i + 1, 1);
                note(c, 'haul', {
                    faceId: faceIdOf(target), special: !!target.special, at: i + 1,
                    held: mine.held.length,
                });
                break;
            }
            case 'purge': {
                // Order 66. Every special standing on the line is shattered, **this cube included**, so
                // it fires once a run and never twice — and the more the Pit Droid has already put on
                // the table, the more it takes with it. Cost and reward come off the same cube.
                //
                // The bag is deliberately untouched. Draining that as well would make a purge on the
                // level it arrives just as ruinous as one at Level 4, which is the only interesting
                // thing about the shape of this face.
                //
                // **Ben's wings count.** A razed wing is a corpse everywhere else, but it is a third of
                // a special cube lying across the line and the purge takes the picture with the rest —
                // so a wide Ben goes off the table whole rather than losing his middle and leaving two
                // thirds of himself behind. There is no holding to lose: the cube the wing replaced was
                // already destroyed, so it adds to the count and nothing to `broken`.
                const doomed = [];
                for (let k = 0; k < final.length; k++) {
                    const x = final[k];
                    // Blessed, and not the cube giving the order — Order 66 always goes with its own
                    // purge, which is what makes it fire once a run.
                    if (k !== i && spend(x)) continue;
                    if (x.face && x.face.kind === 'razed') doomed.push(k);
                    else if (x.special && !x.gone) doomed.push(k);
                }
                if (!doomed.length) {
                    note(c, 'purge.nothing');
                    break;
                }
                for (const k of doomed) if (final[k].special) broken.push(final[k].special.id);
                for (const k of [...doomed].reverse()) final.splice(k, 1);
                note(c, 'purge', { destroyed: doomed.length });
                break;
            }
            case 'engine': {
                // Sebulba's cheat, and the smallest one worth a slot: the cube he points at is burned
                // over to your call — but only if it landed against you. One already on your side is
                // left alone, so the target ends up your way either way and half the times it fires
                // there is nothing to see.
                //
                // Only a **cube** can be pointed at. An effect face has no side to switch, and an
                // engine aimed off the end of the line has nothing there at all.
                const j = c.face.dir === 'left' ? i - 1 : i + 1;
                const target = final[j];
                if (!isCube(target)) {
                    note(c, 'engine.nothing', { dir: c.face.dir });
                    break;
                }
                // A wild already counts as whatever you called, so it is never a target — it lands in
                // this branch rather than needing a rule of its own.
                if (target.side === call) {
                    note(c, 'engine.already', { dir: c.face.dir, side: call });
                    break;
                }
                if (iced(target)) {
                    note(c, 'engine.iced', { dir: c.face.dir });
                    break;
                }
                target.side = call;
                // A face asserting a *fixed* side is wrong the moment it's switched, so it drops its
                // art and draws as the side it now counts as — exactly what an invert does to a Shmi,
                // and for the same reason.
                if (target.face && SIDED.has(target.face.kind)) target.face = null;
                note(c, 'engine', { dir: c.face.dir, side: call });
                break;
            }
            // -----------------------------------------------------------------
            // The Planet Octahedron
            // -----------------------------------------------------------------
            case 'freeze': {
                // **Ando Prime.** Both neighbours keep the face they are showing into the next throw
                // and take no turn while they hold it.
                //
                // **The freeze reaches forward, and it has to.** A freeze that only held for the throw
                // it landed on would be nearly invisible, because the set is reshuffled every throw
                // anyway — the whole value is that it reaches into a throw whose sides are supposed to
                // be random. It is the only thing in the game that breaks *the cubes persist, the sides
                // never do*: freeze a blue on a blue call and next rung has a guaranteed vote in it,
                // freeze a red and it has one against you.
                //
                // The forward reach is also what keeps this cube's two both-neighbour faces from
                // needing a precedence rule. Ice lands on the *next* throw, so it cannot silence a
                // scorch standing beside it on this one, and the order they resolve in does not matter.
                const targets = [i - 1, i + 1]
                    .filter(j => j >= 0 && j < final.length && final[j] && !final[j].gone);
                if (!targets.length) {
                    note(c, 'freeze.nothing');
                    break;
                }
                const iced = [];
                for (const j of targets) {
                    const x = final[j];
                    // A cube already holding ice is not frozen again — the ice is one throw deep and
                    // stacking it would let one cube sit on a face for a whole climb.
                    if (x.frozen || !x.slot) continue;
                    x.slot.frozen = faceIdOf(x);
                    iced.push(j);
                }
                // **`hitAt` is what makes the freeze visible on the frame it happens.** The ice reaches
                // *forward* — the cube wears its frost on the next throw, not this one — so on the frame
                // Ando Prime fires there is nothing on the line to show for it, which is the same gap the
                // crowd's paint had. The positions travel with the note so the board can ice them over
                // where they stand.
                note(c, iced.length ? 'freeze' : 'freeze.already',
                    { frozen: iced.length, both: iced.length > 1, at: i, hitAt: iced });
                break;
            }
            case 'scorch': {
                // **Baroonda.** Chars the face each neighbour is *currently showing*, permanently, for
                // the rest of the climb.
                //
                // The landed face rather than a random one, which is what makes it readable: the thing
                // being destroyed is on screen at the moment it is destroyed. It also flips how a line
                // reads — a wipeout or a Ratts landing next to Baroonda is good news.
                //
                // **One face of six, never a kind.** A Wild scorched of a wild is four wilds and a
                // Ratts, not a cube with no wilds on it — so a burn changes a cube's *odds* rather than
                // only its length, and what one is worth depends entirely on which face it took.
                //
                // **It concentrates what is left, and that is the price rather than a flaw.** Burning a
                // wild off a Wild Cube walks its mine from 1-in-6 to 1-in-5; burning the mine off hands
                // you a pure wild for the rest of the climb. One face in six is the best thing that can
                // happen to a rack and five in six make the cube a little more dangerous, which is the
                // trade the fire is, and it is the counterweight the good case has to be paid for with.
                //
                // This was briefly the other thing — the face left in the pile to land and do nothing,
                // so the fire only ever subtracted — which made Baroonda purely punitive and made a
                // scorched cube duller rather than loaded. See `docs/planet-octahedron.md` §3.
                // `liveFaces` is where the floor on how much of a cube can be killed lives.
                const targets = [i - 1, i + 1]
                    .filter(j => j >= 0 && j < final.length && final[j] && !final[j].gone);
                if (!targets.length) {
                    note(c, 'scorch.nothing');
                    break;
                }
                const burned = [];
                for (const j of targets) {
                    const x = final[j];
                    // **Fire does not burn fire.** The Binder's flamejet is the one face on the table
                    // that is already alight, and Baroonda has nothing to do to it — she passes over it
                    // entirely, which is why this is checked before the ice: a frozen flamejet does not
                    // even spend the thaw. It is also the pairing the two cubes are worth having on a
                    // rack together for, so it should not be the pairing that quietly kills one of them.
                    if (x.face && x.face.kind === 'burn') continue;
                    // Fire melts ice, and takes the whole of its turn on that neighbour doing it —
                    // **either kind of ice**. `iced` is the cube being held on this face right now; the
                    // line below is a freeze that landed earlier in this same pass and would otherwise
                    // hold it through the *next* roll. Both are ice on the cube the fire reached, and a
                    // scorch that melted one and left the other standing would be answering half a
                    // question. Neither loses a face: the turn went on the thaw.
                    if (iced(x)) continue;
                    if (!x.slot) continue;
                    if (x.slot.frozen) { x.slot.frozen = null; continue; }
                    // Nothing to take: the cube is already down to its last live face.
                    if (liveFaces(x.special, x.slot.burned).length <= config.minFaces) continue;
                    const id = faceIdOf(x);
                    x.slot.burned = [...x.slot.burned, id];
                    burned.push(id);
                    // **And it is dead where it stands, not only gone from the cube.** Both halves are
                    // the face: the cube loses the face for the rest of the climb, and the position in
                    // front of you stops counting, stops paying and never takes its turn. Without the
                    // second half the fire is a thing that happens to a cube's odds and to nothing you
                    // can see — and the line it is supposed to flip stays exactly as dangerous, because
                    // a Ratts charred by Baroonda would go off anyway. That is what makes a wipeout or
                    // a mine landing next to her **good news**, which is the whole of why she burns the
                    // face a neighbour *landed on* rather than a face off its list.
                    charFace(x, id);
                }
                if (!burned.length) {
                    note(c, 'scorch.nothing');
                    break;
                }
                note(c, 'scorch', { burned, both: burned.length > 1 });
                break;
            }
            case 'vault':
                // **Aquilaris.** The vault doors seal the side just called; the next rung has to be
                // called the other way.
                //
                // The side *last called* rather than a random one, which makes it a rule instead of a
                // coin flip: it forces a switch, and it breaks a streak-rider's pattern. It costs
                // nothing in EV — the call is 50/50 either way — and a great deal in position, because
                // locked onto blue with a Shmi on the table, or with a plain cube Baroonda fused red
                // three rungs ago, is a genuinely bad rung. Rack-dependent rather than flat.
                //
                // Reported, not applied. The seal is the run's state and it lives on the ladder node,
                // where it lasts exactly one rung because that node is rewritten on every one.
                sealed = call;
                note(c, 'vault', { side: call });
                break;
            case 'seam':
                // **Mon Gazza.** The only paying face on the die, and the only one in the game that
                // pays for **depth** — greed is flat, boost is per position, mult is conditional on a
                // side. Scored down in the pass over the resolved line with every other payer; this
                // just says what it is.
                note(c, 'seam', { bonus: config.seamBonus * rungs, rungs });
                break;
            case 'jail': {
                // **Oovo IV.** Up to `jailSize` cubes are taken off the table and held — not
                // destroyed — in **this die's own cell**, which is the whole of what has changed about
                // the face: the prisoners belong to the cube that took them rather than to the run.
                // One walks out at the start of every turn the die takes (see the parole above), and
                // if the die is destroyed they all walk at once (see the crack-open below). Both
                // valves are the line's now, and both are the same two lines every other hold uses.
                //
                // It never takes itself, and it never takes a corpse — a razed wing is already off the
                // table and imprisoning it would be arresting a body.
                //
                // **`jailSize` is the size of the cell, not of one arrest**, so a die that already has
                // three inside can only take one more. A Binder cloning the die or a Mirror reflecting
                // it now puts a second *cell* on the line rather than a second door onto one — four
                // apiece, and each with its own parole to serve — which is rule 2 of capture doing
                // exactly what it says and is a good deal more dangerous than the shared prison was.
                const room = Math.max(0, config.jailSize - (c.slot ? c.slot.held.length : 0));
                const pool = final
                    .map((_, j) => j)
                    .filter(j => j !== i && final[j] && !final[j].gone && final[j].slot
                        && !freshlyFreed.has(final[j]));
                if (!pool.length || !room) {
                    note(c, 'jail.nothing');
                    break;
                }
                const taking = [];
                const rest2 = [...pool];
                while (taking.length < room && rest2.length) {
                    taking.push(...rest2.splice(crypto.randomInt(0, rest2.length), 1));
                }
                taking.sort((a, b) => a - b);
                const cell = c.slot || (c.slot = plainSlot());
                for (const j of taking) cell.held.push(final[j].slot);
                for (const j of [...taking].reverse()) final.splice(j, 1);
                note(c, 'jail', { taken: taking.length, at: i, held: cell.held.length });
                break;
            }
            case 'plunge': {
                // **Ord Ibanna.** The cubes standing on the head and the tail of the line fall into the
                // chasm. Two positions, so it is parity-preserving and does not manufacture ties —
                // which matters on a die that is sideless everywhere else.
                //
                // **It takes whatever is on an end, this cube included**, and that is the whole reason
                // the die works as one object: it is the only self-destruct on a cube carrying no
                // wipeout and no mine, it is the jailbreak that frees everything Oovo IV is holding,
                // and it is the release for Malastare's lock. Three cruelties, one key, and the key is
                // a cube nobody can aim.
                if (final.length < 2) {
                    note(c, 'plunge.nothing');
                    break;
                }
                // **A blessed cube holds its ground and the ledge crumbles past it.**
                //
                // The blessing turns this away like everything else, and the way it does it is the
                // rule rather than an exception to one: the chasm still takes **two** positions, it
                // just takes the next one along on that side. Two is what keeps a plunge
                // parity-preserving, which is what stops it manufacturing ties on a die that is
                // sideless everywhere else — and *"the blessing works on everything except the
                // chasm"* is a sentence a player would have to be taught and would never guess.
                //
                // **Two or none.** On a line short enough that the two walks meet in the middle there
                // is no second position to take, and taking one would break the parity the whole face
                // is shaped around. So it takes nothing, which is the same answer it already gives on
                // a line of one.
                //
                // The die is never blessed — nothing paints or blesses itself — so it still always
                // falls when it is standing on an end, and the plunge is still the key nobody can aim.
                // **The cube that threw it always falls**, blessed or not, and that is the one carve-out
                // in here. A Binder or a Mirror can put a second die on the line and the two can bless
                // each other, so a plunging die *can* be carrying one — and a plunge that spared itself
                // would take away the die's only self-destruct, which is the jailbreak and the key the
                // whole object is built around. Every other blessed cube on the ledge holds.
                const edge = function (from, step) {
                    for (let k = from; k >= 0 && k < final.length; k += step) {
                        if (k === i || !holy(final[k])) return k;
                    }
                    return -1;
                };
                const head = edge(0, 1);
                const tail = edge(final.length - 1, -1);
                if (head < 0 || tail < 0 || head === tail) {
                    note(c, 'plunge.blessed');
                    break;
                }
                // Only the ones that actually held the ledge: a blessing between the true end and the
                // position the chasm reached is a blessing that was used, and the rest of the line
                // never came near it.
                for (let k = 0; k < head; k += 1) spend(final[k]);
                for (let k = final.length - 1; k > tail; k -= 1) spend(final[k]);
                const ends = [head, tail];
                const selfless = !ends.includes(i);
                for (const k of [...ends].reverse()) final.splice(k, 1);
                note(c, 'plunge', { destroyed: 2, self: !selfless, at: ends });
                break;
            }
            case 'crowd': {
                // **Tatooine's crowd backs whoever is ahead, and paints it on.**
                //
                // The face each neighbour is **showing** is painted the leading colour, for the rest of
                // the climb — so the cube in front of you visibly becomes that side, and goes on
                // counting for it every time that face comes up again.
                //
                // **Read off the line as it stands, in its turn**, like every other face. It resolved
                // after the count at first, on the grounds that "whoever is ahead" is not settled until
                // the count is in. That was true and it cost more than it bought: the face took no turn,
                // could be cancelled outright by a mine three positions away, and painted a face nobody
                // could see. The crowd backs whoever is ahead *now* — and if a Sebulba turns the line
                // over after it, the crowd backed the wrong racer, which is a thing crowds do.
                //
                // **On a tie it paints the side you called.** Not a fallback: this die eats a voter on
                // every throw and drives a quarter of all rungs to Watto's cube, so a crowd that idled
                // on a level line would idle on a third of its own landings. Nobody to back, so it backs
                // the home racer.
                const ahead = { blue: 0, red: 0 };
                for (const x of final) if (x && !x.gone && ahead[x.side] != null) ahead[x.side] += 1;
                const side = ahead.blue > ahead.red ? 'blue' : ahead.red > ahead.blue ? 'red' : call;
                const hit = [];
                for (const j of [i - 1, i + 1]) {
                    const x = final[j];
                    if (!x || x.gone || !x.slot) continue;
                    // Ice turns it away as it turns the fire away, and a corpse has no cube under it:
                    // Ben's wings are a picture lying across the line and the cubes they replaced are
                    // already off the table.
                    if (iced(x)) continue;
                    if (x.face && x.face.kind === 'razed') continue;
                    // Already counting for that side, so there is nothing to paint. On a plain cube
                    // showing the leading colour that is most of the time; on anything with an effect
                    // face up it is never, which is the half of the table this face is really about.
                    if (x.side === side) continue;
                    // **Through `faceIdOf` and not `x.face.id`.** A plain cube carries no face object at
                    // all — it is a side and nothing else — so reading the id off one skipped every
                    // ordinary cube on the table, which is most of them and the whole point of the face.
                    // Taken before the side is changed, or the mark names the colour it is becoming.
                    const id = faceIdOf(x);
                    if (!id) continue;
                    x.slot.painted = [...(x.slot.painted || []), `${id}|${side}`];
                    // **The position counts for it from this moment**, which is what makes the paint
                    // visible at all: the tint is drawn off the resolved line, and a mark that only
                    // showed when that face next landed would be a face that did nothing on screen. It
                    // counts this rung too — the crowd acts before the count, like everything else.
                    x.paint = side;
                    x.side = side;
                    hit.push(j);
                }
                if (!hit.length) {
                    note(c, 'crowd.nothing');
                    break;
                }
                note(c, 'crowd', { side, painted: hit.length, both: hit.length > 1 });
                break;
            }
            // `blessing` has no turn of its own either. It is read before pass two starts and by
            // everything below that takes a cube off the line; by the time the queue reaches the face
            // itself there is nothing left for it to do. See the loop above the queue.
            // `shield` has no turn of its own. It is read by the mine and by the wipeout, which is the
            // whole of what it does — a shield on a line with neither has genuinely done nothing, and
            // should say nothing.
            default:
                break;
        }

        // A frame for every face that took a turn, whether or not the line moved under it. The note that
        // came with it is the label.
        //
        // **A turn that changed nothing is not the same as no turn**, and the reveal used to draw them
        // identically: only a changed line got a step, so a Binder with nothing on its right to burn, a
        // Pit Droid reaching into an empty bag, a Mirror with no room — all took their turn, wrote their
        // note, and vanished from the playback. On screen that is an effect cube sitting there doing
        // nothing, with no more explanation than a cube that never came up at all.
        //
        // It reads worst on exactly the cubes most likely to hit it. A Mirror writes its copies onto the
        // **tail** of the line, where there is nothing to the right — so a reflected Binder is the single
        // likeliest face in the game to take a turn with nothing to do, and the reflection is the one
        // moment the player is watching those cubes to see what they will do.
        //
        // `quiet` marks them, and the flag outlived the client it was added for: the embed paid a
        // message edit per frame, could afford three, and spent them on faces that changed something.
        // The Activity plays all of them, so the flag is now a hint about emphasis rather than a
        // filter — but it stays, because "took its turn and found nothing to do" is a real distinction
        // from "never got a turn" and only the engine knows which happened.
        const now = final.map(faceIdOf);
        const changed = now.length !== was.length || now.some((e, k) => e !== was[k]);
        if (changed || notes.length > noteAt) {
            // Where the acting cube ended up, so the frame can point at it. Read *after* the effect
            // because inserting and destroying move it — a Padmé slipping a cube in on its left
            // shifts it one to the right. `-1` when the cube destroyed itself out of the line.
            // The ice and the scorch marks as *this* frame leaves them, so a step that froze a
            // neighbour or burned a face off one draws the consequence on the frame that caused it
            // rather than on the payout, where it would read as having happened between frames.
            const step = {
                faceIds: now, note: notes[noteAt] || null, at: at(c), ...lineState(final),
            };
            if (!changed) step.quiet = true;
            steps.push(step);
        }

        // **Cracking open whatever this turn took off the line.** Rule 3 of capture: destroying a
        // captor frees its prisoners immediately, and they come back beside the cube taking the turn.
        //
        // Checked here rather than at each destruction site, for the same reason the wreckage is swept
        // in one place: there are a dozen ways off the line — the blast, the wipeout, the burn, the
        // cull, the raze, the purge, the plunge, a clone or a reflection writing over the position —
        // and none of them should have to know a hold exists, nor should a path added later be able to
        // forget. What left the line is what was standing when the turn began and isn't now.
        //
        // A cube that was **captured** rather than destroyed is not a cube that left: it is off the
        // line and inside somebody, which is exactly where it is meant to be. So anything now sitting
        // in a hold is skipped, at whatever depth it is sitting.
        //
        // **After the frame the destruction was drawn on, and with a frame of its own**, because they
        // are two things: the cube that was carrying them goes, and then they walk back out. Drawn on
        // one frame it reads as a line that grew for no reason in the middle of something eating it.
        if (stood.some(x => x.slot.held.length) || made.length) {
            const standing = new Set();
            const put = (slots) => { for (const sl of slots) { standing.add(sl); put(sl.held); } };
            for (const x of final) if (!x.gone && x.slot) { standing.add(x.slot); put(x.slot.held); }
            for (const { slot, faceId } of [...stood, ...made]) {
                if (!slot.held.length || standing.has(slot)) continue;
                const sp = slot.id ? specialById(slot.id) : null;
                const from = notes.length;
                const freed = spring(slot);
                notes.push({
                    kind: 'hold.break',
                    faceId,
                    specialId: sp ? sp.id : null,
                    specialName: sp ? sp.name : null,
                    freed: freed.length,
                });
                steps.push({
                    faceIds: final.map(faceIdOf),
                    note: notes[from],
                    // The cube that was holding them is gone, so the frame points at nothing rather
                    // than at whichever cube happens to be standing where it was.
                    at: -1,
                    ...lineState(final),
                });
            }
        }

        // **The table ran away with itself.** Broken *after* the frame, so the last thing that fired
        // is drawn like every other effect and the line stops on the cube that tripped it rather than
        // one short of it. Whatever is still in the queue never gets its turn, which is the whole of
        // what an abandoned roll means — nothing here tidies the line up, because a line the engine
        // gave up on is exactly the picture worth keeping.
        if (overflow) {
            notes.push({
                kind: 'overflow', faceId: null, specialId: null, specialName: null, spawned,
            });
            break;
        }
    }

    // **And so is everything that pays, for exactly the same reason.** What is not on the table does
    // not pay. A Multiplier a Tusken culled, a Greed Cube Ben razed, a Shortcut a clone wrote over: all
    // of them are cubes the line destroyed, and a payout off one is a payout from beyond the grave. The
    // other way round, a paying face the Binder cloned or the Mirror reflected pays **twice**, because
    // there really are two of them on the table.
    //
    // Greed used to be scored in the first pass, off the line as thrown, and it was the last of these
    // to move. That is what let Ben lie across a Greed Cube and leave the multiple standing at what it
    // had already added — a number on the board with nothing on the board behind it, which is precisely
    // the reading the payout walk was built to make impossible.
    //
    // Greed and the Multiplier are still not the same thing, and the split below is the difference:
    // greed is banked here, outright, while a Multiplier only cashes if its own side is the side that
    // wins — which is not known until the line has been counted and, on a tie, not until Watto's cube
    // has landed on top of it. So the sides go out unspent and `applyMults` settles them.
    // **And a frozen face pays nothing**, for the same reason it takes no turn: the ice holds the cube
    // on the face it landed on and stops it doing anything with it. A frozen Greed is a Greed sitting
    // there in a block of ice, and that is the price Ando Prime charges for the guaranteed vote it
    // bought — the freeze does not care whose cube it is.
    const mults = [];
    for (const c of final) {
        if (c.gone || c.frozen || !c.face) continue;
        switch (c.face.kind) {
            case 'greed':
                mult += config.greedBonus;
                pay(c, 'greed', null, config.greedBonus);
                break;
            case 'seam': {
                // Mon Gazza pays per rung the run has walked, the one it is standing on included, so
                // the shallow case lands exactly on a Greed and everything above it is the cube's own
                // argument. Like the Boost Cube the amount isn't fixed at design time, so it is carried
                // on the pay record rather than re-derived by the walk from a run it can no longer see.
                const earned = config.seamBonus * rungs;
                mult += earned;
                pay(c, 'seam', null, earned, rungs);
                break;
            }
            case 'boost': {
                // Paid per **position**, counted off the same `final.length` that `bestCubes` is
                // chasing — so every position a Mirror conjured, a Padmé slipped in or a Pit Droid
                // pulled out of the bag is a position it pays for, and a Tusken eating one takes money
                // off it. The one paying face whose value isn't fixed until the line stops moving.
                const earned = config.boostBonus * final.length;
                mult += earned;
                pay(c, 'boost', null, earned, final.length);
                break;
            }
            case 'mult':
                mults.push(c.face.side);
                pay(c, 'mult', c.face.side, config.multBonus);
                break;
            case 'heat': {
                // Paid off how many heats the cube has already spent and then **spending this one**,
                // which is why the increment lives here rather than at the throw: a heat that never
                // reached the payout — culled, razed, cloned over — did not pay and must not have
                // burned either. The slot travels with the position, so writing it here is what carries
                // it into the next rung.
                const spent = (c.slot.heat || 0) + 1;
                const earned = config.heatBonus * spent;
                mult += earned;
                pay(c, 'heat', null, earned, spent);
                c.slot.heat = spent;
                break;
            }
            case 'guide': {
                // The unbroken run of the called side this cube is standing in, counted outward from
                // its own position both ways. **Its own position is the only transparent one** — it is
                // the thing doing the looking — and every other stops the count, effect faces included,
                // so what it pays is what a player counts by looking at the line.
                const run = guideRun(at(c));
                if (!run) break;
                const earned = config.guideBonus * run;
                mult += earned;
                pay(c, 'guide', null, earned, run);
                break;
            }
            case 'shortcut':
                shortcuts += 1;
                break;
            case 'reroll':
                rerolls += 1;
                break;
            default:
                break;
        }
    }

    // The paying faces in reading order, each tied to the position it ended up on so the walk can point
    // at it. In order by construction now that they are all collected off the one line in the one pass —
    // this used to need a sort, and a `-1` for a greed that had paid off a position the line no longer
    // had. Neither can arise: every entry here came off a cube standing in `final`.
    //
    // The pure bonus is appended below, after the line has a majority to be pure *of*, and it is the one
    // entry with no cube behind it. It goes last on purpose: it is the verdict on the whole line, so it
    // is counted once every position has been.
    const payWalk = pays.map(p => ({
        kind: p.kind,
        side: p.side,
        bonus: p.bonus,
        positions: p.positions,
        faceId: p.faceId,
        specialId: p.specialId,
        specialName: p.specialName,
        at: final.indexOf(p.cube),
    }));

    // Only positions that are cubes are counted. `red` is counted rather than inferred from the
    // length, because the line now holds positions that are neither colour.
    const cubes = final.filter(isCube);

    // **The run ends when there is nothing left on the table.** Not nothing that *counts* — an effect
    // face is still a cube standing there and a spent shield is still standing in front of you. A line
    // with positions on it but no countable cubes has no majority, which is a tie for Watto to break,
    // and that has always been a survivable roll: `razed:left raze razed:right` counts zero and plays
    // on. Having no line at all is the different thing, and the only thing this is about.
    //
    // Two ways to get there and both take the whole row: an unshielded mine, whose blast is now every
    // position including its own, and a purge on a line of nothing but specials. A shielded mine never
    // does — the shield it was stopped by is left standing, which is a position, which is a roll that
    // is still going.
    //
    // `ended` stays the *name* of the mine, for prose. A line emptied without one is still over, and
    // `settleLoss` reads the emptiness off `faceIds` rather than being told Ratts did it.
    if (detonated && !final.length) ended = detonated;
    const blue = cubes.filter(c => c.side === 'blue').length;
    const red = cubes.length - blue;
    // No majority means no answer from the line — an even count of cubes, or none at all. `null`
    // here doesn't decide anything; it hands the roll to Watto's tie-breaker, which is the caller's
    // business rather than the line's. Every effect face takes a cube out of the count without
    // shortening the line, so this happens far more often than it used to.
    const majority = blue > red ? 'blue' : red > blue ? 'red' : null;
    // Every position on one side — and **every position has to be a cube**. A line with an effect
    // in it is not swept however the rest of it landed, which keeps `all nine landed blue` literally
    // true and stops a rack of effect cubes farming pures off a shortened count while still being
    // paid at the level's nominal tier. Swept your way is a Pure Cube; swept the other way is
    // Watto's Cackle. A tie is never either, since a swept line has a majority by definition.
    const swept = final.length >= 3 && cubes.length === final.length
        && (blue === final.length || red === final.length);
    const pure = swept && majority === call;

    // **The pure bonus: `pureBonus` per cube on the table.**
    //
    // A pure used to pay a share of the pot and nothing else, and when the pot came out it was left
    // paying the level flat — the rarest thing the mode can draw, worth exactly as much as any other
    // win. This puts a price back on it in the one currency that cannot bring the pot's exploit back
    // with it: a **multiple** rides the standing, so it scales with the stake, where the pot paid a
    // share of a jar however little had been risked to reach it. Minimum stake gains nothing here.
    //
    // Per cube, because that is what a pure is scarce *in*. Sweeping three is a coin flip twice over;
    // sweeping nine is one line in 256, and a bonus that paid both the same would be flattest exactly
    // where the mode is most interesting. It is self-limiting for the same reason — the payout doubles
    // per extra cube while the odds of collecting it halve.
    //
    // Counted off `cubes` rather than `final`, which are the same number by construction: `swept`
    // requires every position on the line to be a counting cube. Named off the count because that is
    // what the prose says — "all nine landed blue".
    if (pure) {
        const bonus = cubes.length * config.pureBonus;
        mult += bonus;
        // No cube to hang it on: it is the line as a whole that did this, not a face standing on it.
        // `at: -1` is the walk's own word for that — see the orphan pass in the clients, which counts
        // it off the middle of the row exactly as it does the clear an Again banks.
        payWalk.push({
            kind: 'pure',
            side: majority,
            bonus,
            positions: cubes.length,
            faceId: null,
            specialId: null,
            specialName: null,
            at: -1,
        });
    }

    // **The hold takes everything the roll took**, swept up once here rather than at nine separate
    // destruction sites. A slot is an object and the line holds references to it, so what left the
    // table is exactly the slots that came in and are not standing at the end — which catches the
    // blast, the wipeout, the burn, the cull, the raze, the purge and the plunge without any of them
    // knowing the hold exists, and cannot be missed by a path added later.
    //
    // Swept *after* resolution and not during it, which is what stops a cube shattering and being
    // scavenged back on the same throw. A haul is different and happens in its turn: it is a cube
    // being put somewhere rather than destroyed, and the loop it makes with `scavenge` is meant to
    // close inside one roll.
    // The line **as thrown**, so the wreckage grows with the table rather than with the roll: a cube a
    // Mirror conjured and a Tusken then ate never really joined the set, and sweeping it up would let
    // one runaway throw fill the junkyard with cubes nobody ever owned.
    //
    // **A captured cube is not wreckage.** It left the line without being destroyed and it is sitting
    // in somebody's hold, at whatever depth — so `standing` counts what a captor is carrying as
    // standing, or the same cube would be in two places at once: inside its captor and in the
    // junkyard, to be scavenged back out while it is still a prisoner.
    const standing = new Set();
    const stow = (slots) => { for (const sl of slots) { standing.add(sl); stow(sl.held); } };
    for (const c of final) {
        if (c.gone || !c.slot) continue;
        standing.add(c.slot);
        stow(c.slot.held);
    }
    //
    // **Once each.** A slot can now appear twice in what is swept — thrown, carried off into a hold,
    // let back out mid-roll and destroyed — so the set of what has already been picked up grows as
    // the sweep runs rather than being taken once at the top of it. Two entries for one cube is a
    // cube the junkyard would hand back twice.
    // `takenIn` is the other half of that: a Jawa taking its turn sweeps this roll's wreckage in early
    // — see the `scavenge` case — and what goes into the hold is a copy, so identity is the only thing
    // the two sweeps can compare. Without it a cube that broke, was salvaged and is standing again
    // would also be sitting in the junkyard, which is one cube in two places.
    const carried = new Set(hold);
    for (const c of [...line, ...joined]) {
        if (!c.slot || standing.has(c.slot) || carried.has(c.slot) || takenIn.has(c.slot)) continue;
        carried.add(c.slot);
        hold.push({ ...c.slot });
    }

    // The slot a surviving position carries into the next level. Read off the cube rather than trusted
    // from the slot it arrived with, so a position something rewrote in place can never carry the
    // previous cube's scorch marks into the next throw.
    const slotFor = function (c) {
        const id = c.special ? c.special.id : null;
        const s = c.slot || plainSlot();
        return id === s.id ? s : { ...plainSlot(), id };
    };

    return {
        // `cubes` is the sides that counted — effects are not in it, so it is shorter than the line
        // whenever one landed. That is deliberate: it drives the majority and the lifetime `rolled`
        // tallies, and an effect face didn't land on a colour, so it shouldn't be tallied as one.
        //
        // `faceIds` is every *position*, one id each, for the payout frame. So the two differ in
        // length, and anything indexing one against the other would be wrong — see `decidedAt`.
        cubes: cubes.map(c => c.side),
        faceIds: final.map(faceIdOf),
        // Ice and scorch marks for the resolved line, index for index against `faceIds` — see
        // `lineState`. The payout frame draws from these; the reveal draws from the throw's own copy
        // and from each step's.
        ...lineState(final),
        // **Face points for the line as it finished**, which is the Chips half of the payout and the
        // only figure here that is about the *whole* line rather than the part of it that counted. It
        // rides the stake, not the multiple, and it is scored per roll rather than carried — so this is
        // this rung's number and the next rung throws for its own. See `POINTS` in the tuning data.
        //
        // Read off `final` rather than `faceIds`, because `pointsOf` needs the `gone` flag to refuse to
        // pay for a corpse and the id alone cannot say whether the cube is still standing.
        //
        // Both numbers, not just the total: the multiplier is points *per position*, so a caller handed
        // only the sum could not work out what it was worth. See `pointMultiple`.
        ...scoreLine(final),
        // What the run carries into the next level: one slot per surviving position, holding the
        // special that is still sitting on it or `null` for an ordinary cube. Everything the roll
        // did to the table is in here — cubes destroyed are simply absent, a special written over
        // by Fode, Padme, a mirror or a bind comes back as `null`, and so does one that broke.
        //
        // `gone` positions are dropped. A cube razed by Ben, or shattered by a wipeout, is still
        // drawn on *this* line so the player can see what happened to it — but it is not on the
        // table any more, and the next level is a cube short because of it. That is why this is
        // shorter than `faceIds` whenever something was destroyed, and the second of the two places
        // the three lengths intentionally disagree.
        set: final.filter(c => !c.gone).map(slotFor),
        majority,
        pure,
        swept,
        // What the Planet Octahedron did that isn't to the line. All three are the *run's* business
        // rather than the table's, so they are reported and applied by the caller: `sealed` is the side
        // the next rung can't be called on, and it is the only one left: `lockout` and `boonta` were
        // retired for the blessing and the crowd, both of which do their work on the cubes and need
        // nothing from the caller.
        //
        // The prison used to be here too. It isn't any more — prisoners belong to the die that took
        // them and ride the set inside its slot, so they need no valve in the caller and no key on the
        // ladder node: they come back out on the line, in the roll, where the player can watch it.
        sealed,
        // **Cubes the line is holding when the dust settles**, nested holds included. Not in
        // `faceIds`, not in `cubes`, not counted toward anything — they are off the table — but very
        // much in the run, and impossible to read off the line, because a held cube isn't drawn. A
        // client that doesn't say this is one where cubes go missing.
        held: final.reduce((n, c) => n + (c.gone || !c.slot ? 0 : countHeld(c.slot.held)), 0),
        // The run's wreckage as this roll leaves it, and `recovered` the specials a `scavenge` put
        // back on the table so the caller can take them off `spent`.
        hold,
        recovered,
        // `mult` is everything already earned outright — the Greed Cube, and the pure bonus, which
        // needs no winner because a swept line *is* one. `mults` is the sides the Multiplier Cubes
        // landed on, still unspent, because whether they pay depends on who wins and a tie doesn't
        // know that yet. See `applyMults`.
        mult,
        mults,
        // The same additions `mult` and `mults` describe, itemised and in line order, for phase two
        // of the reveal to count out one at a time. Purely a playback record — nothing reads a
        // payout off it.
        pays: payWalk,
        // Free clears and rerolls this roll banked, cube ids knocked out for the rest of the climb,
        // and the cube that ended the run outright, if one did. Both are counted per paying face, so
        // a Mirror that copies a Shortcut pays twice.
        shortcuts,
        rerolls,
        broken,
        ended,
        // **How many cubes the runaway spawned before the engine gave up**, or 0 on every roll that
        // resolved. Truthy is the whole of the signal: the caller busts the run on it and pays nothing,
        // exactly as it does for an empty table. Kept as the count rather than a flag because the
        // number is the story — it is the one ending that says how far it got.
        overflow: overflow ? spawned : 0,
        // The bag as this roll leaves it. Only the Pit Droid's `draw` ever spends from it here, so on
        // every other roll this is the bag that came in — but the caller must carry *this* one, or a
        // drawn cube comes out of the bag twice.
        bag: rest,
        notes,
        // One entry per restructuring face that actually moved the line, in fire order — the reveal
        // plays these back so the effects happen on screen rather than between frames.
        //
        // **Every step is here, however many there are.** Copies can act, so a full rack has been
        // measured at nine in one roll. The embed could only afford to draw three; that cap is a
        // property of a message edit and belongs to the client, not to the rules.
        steps,
        faceLog,
        specials: line.filter(c => c.special).map(c => c.special.id),
    };
};
exports.resolveLine = resolveLine;

// The cube at which one side became the guaranteed majority. Past this point the rest of
// the roll cannot change who won, so a reveal has no tension left to spend on it.
//
// Indexes into the *counted* cubes, which is only the same thing as the drawn line when no
// special landed — see the note on `cubes` and `faceIds` above.
const decidedAt = function (cubes) {
    const need = Math.floor(cubes.length / 2) + 1;
    let blue = 0;
    let red = 0;
    for (let i = 0; i < cubes.length; i++) {
        if (cubes[i] === 'blue') blue++; else red++;
        if (blue >= need || red >= need) return i + 1;
    }
    return cubes.length;
};
exports.decidedAt = decidedAt;

exports.SIDES = SIDES;
exports.LEVELS = LEVELS;
exports.SPECIALS = SPECIALS;
exports.config = config;
