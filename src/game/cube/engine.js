// The rules of Botto's Chance Cube. No Discord, no database, no rendering.
//
// Notes are structured data, never prose — the client writes the sentences. Randomness is
// `crypto.randomInt` throughout and is not seedable; the parity harness patches the module.
const crypto = require('crypto');

const {
    LEVELS, SPECIALS, SIDES, PLAIN_FACES, SIDE_IDS, SIDE_BETS, faceKey, cube: config,
} = require('./tuning.js');

const OTHER = { blue: 'red', red: 'blue' };
exports.OTHER = OTHER;

// Faces Ando Prime cannot hold: the Flamejet and Baroonda. See `case 'freeze'`.
const FIREPROOF_ICE = new Set(['burn', 'scorch']);

const WELD_SEP = '+';
const PICK_SEP = ':';
exports.WELD_SEP = WELD_SEP;

// Every cube drawn, lifted or re-faced resolves its id through here, inside the roll loop — a
// linear scan of SPECIALS per lookup is a scan the hot path does not need.
const BASE_BY_ID = new Map(SPECIALS.map(s => [s.id, s]));
const baseById = id => BASE_BY_ID.get(id) || null;

const DOWNSIDE = new Set(['end', 'broken']);
const goodFaces = sp => (sp ? sp.faces.filter(f => !DOWNSIDE.has(f.kind)).length : 0);
exports.goodFaces = goodFaces;

// Positions canonicalise to the cube they produce, not the draw that produced it — a cube's faces
// repeat, so `wild:012` and `wild:013` are the same three wilds. This is what makes the id an
// identity, and what stops a player owning two welds that are secretly the same cube.
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

const weldId = picks => picks
    .map(p => ({ id: p.id, idx: canonIdx(baseById(p.id), p.idx) }))
    .filter(p => p.idx)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(p => `${p.id}${PICK_SEP}${p.idx.join('')}`)
    .join(WELD_SEP);
exports.weldId = weldId;

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

exports.weldParents = function (id) {
    const picks = typeof id === 'string' && id.includes(WELD_SEP) ? parseWeld(id) : null;
    return picks ? picks.map(p => p.id) : null;
};

const weldCache = new Map();

const buildWeld = function (id) {
    const picks = parseWeld(id);
    if (!picks) return null;
    return {
        id: weldId(picks),
        name: picks.map(p => p.parent.name.replace(/ Cube$/, '')).join('-'),
        blurb: `${picks.length} cubes in one seat, and only the faces the press kept.`,
        welded: picks.map(p => p.id),
        // `from` keys the lifetime tallies to the parent, so a greed face thrown by a weld counts on
        // the Greed Cube's record. Keying by the weld's own id destroys the split the record is for.
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

const cutsFor = (parents, tier) => ((config.weldSplits || {})[parents] || [])
    .filter(s => (s.tier || 1) <= tier);
exports.cutsFor = cutsFor;

// How many cubes the press can take at a rung — every count it can cut, rather than the widest one.
// A rung that gains the third cube *adds* a shape to this table; it does not retire the two-cube cut
// below it, so two stays legal all the way up. Read off `weldSplits` itself, so the counts a caller
// offers and the counts `rollWeld` can actually roll a split for cannot drift apart.
exports.weldCounts = tier => Object.keys(config.weldSplits || {})
    .map(Number)
    .filter(n => n >= 2 && cutsFor(n, tier).length)
    .sort((a, b) => a - b);

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

const pickIdx = function (n, take, from) {
    const all = from ? [...from] : Array.from({ length: n }, (_, i) => i);
    const len = all.length;
    for (let i = 0; i < take && i < len; i++) {
        const j = i + crypto.randomInt(0, len - i);
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, take).sort((a, b) => a - b);
};

const orderFor = function (n, major) {
    const idx = Array.from({ length: n }, (_, i) => i);
    if (!Number.isInteger(major) || major < 0 || major >= n) return shuffle(idx);
    const order = [];
    order[major] = 0;
    shuffle(idx.filter(i => i !== major)).forEach((p, i) => { order[p] = i + 1; });
    return order;
};

const pickWith = function (parent, want, faceId) {
    const pool = Array.from({ length: parent.faces.length }, (_, i) => i);
    const hits = pool.filter(i => parent.faces[i].id === faceId);
    if (!hits.length || want < 1) return pickIdx(parent.faces.length, want);
    const anchor = hits[crypto.randomInt(0, hits.length)];
    const rest = pool.filter(i => i !== anchor);
    return [anchor, ...pickIdx(parent.faces.length, want - 1, rest)].sort((a, b) => a - b);
};

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

const spaceCache = new Map();
const spaceOf = function (ids, routine) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    const key = `${ids.join('+')}|${routine ? 'routine' : 'all'}`;
    if (spaceCache.has(key)) return spaceCache.get(key);
    const parents = ids.map(baseById);
    let n = 0;
    if (!parents.some(p => !p)) {
        const cuts = (config.weldSplits || {})[ids.length] || [];
        const take = (cuts[0] && cuts[0].take) || parents.map(() => 3);
        const want = k => Math.min(take[k] ?? 3, parents[k].faces.length);
        n = parents.reduce((acc, p, k) => acc * distinctHalves(p, want(k)), 1);
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

// What the press can produce, which is not the whole space: a cut keeps a downside whenever either
// parent has one, so the clean welds come off the total before `rememberWeld` floors against it.
// Flooring against the whole space let the memory exclude the only weld a pairing could produce, and
// the roll repeated inside its own memory.
exports.weldDrawSpace = ids => spaceOf(ids, true);

// Draws until one is allowed. The allowed cut can be a rare one — Gungan+Wild with the other two
// remembered leaves only three Ratts, about one draw in twenty — and giving up returns a cut the rules
// refuse, so the budget is sized for rare, not for typical.
const WELD_DRAWS = 2000;

exports.rollWeld = function (ids, {
    seen = [], tier = 1, major = null, keep = null,
} = {}) {
    if (!Array.isArray(ids) || ids.length < 2) return null;
    if (new Set(ids).size !== ids.length) return null;
    const parents = ids.map(baseById);
    if (parents.some(p => !p || p.noWeld)) return null;
    if (!cutsFor(ids.length, tier).length) return null;

    const block = new Set(seen);

    // **A cut keeps a downside whenever either parent has one.** A clean weld is worth about twice a
    // pressed one, and a reroll costs the same at every prestige while the stake it pays on doubles, so
    // a chase toward one would pay for itself within an evening at any depth.
    const anyDownside = parents.some(p => p.faces.some(f => DOWNSIDE.has(f.kind)));

    let last = null;
    let kept = null;
    for (let attempt = 0; attempt < WELD_DRAWS; attempt++) {
        const take = rollSplit(ids.length, tier);
        if (!take) return null;
        const order = orderFor(parents.length, major);
        const picks = parents.map((p, k) => {
            const want = Math.min(take[order[k]] ?? take[take.length - 1], p.faces.length);
            const anchor = keep && keep.parent === k ? keep.faceId : null;
            return {
                id: p.id,
                idx: anchor
                    ? pickWith(p, want, anchor)
                    : pickIdx(p.faces.length, want),
            };
        });
        const keeps = picks.some((pk, k) => pk.idx.some(i => DOWNSIDE.has(parents[k].faces[i].kind)));
        last = weldId(picks);
        if (anyDownside && !keeps) continue;
        kept = last;
        if (block.has(last)) continue;
        return last;
    }
    return kept || last;
};

const JAILERS = new Set(
    SPECIALS.filter(sp => (sp.faces || []).some(f => f && f.kind === 'jail')).map(sp => sp.id),
);
exports.JAILERS = JAILERS;

const MAX_LEVEL = LEVELS.length - 1;
exports.MAX_LEVEL = MAX_LEVEL;

// Three kinds, not two: an Again past the top level has no level above it to double what it added,
// so it pays `overtimeBonus` instead. Everything else treats the two the same. It lives here rather
// than at the four call sites that used to spell it out because `BONUS` below is keyed on the answer
// — moving where overtime starts should be one edit, not five.
const rungKind = (level, again) => (again ? (level >= MAX_LEVEL ? 'overtime' : 'again') : 'level');
exports.rungKind = rungKind;

const chance = p => crypto.randomInt(0, 10000) < Math.round(p * 10000);
exports.chance = chance;

// **An honest coin, and there is no EV-neutral value of a lean except 0.500.** A `dayLean` used to
// sit here at 0.52 and was worth +0.37 EV to the player, for two reasons that are properties of the
// ladder rather than of the number: majority-of-N amplifies a per-cube bias with depth (52/48 at L1
// becomes 54.9/45.1 at L5, so no single `levelStep` prices every rung and the loosest gets farmed),
// and it is not zero-sum even against a player who never works out the day's side — `E[∏P] > ∏P(E[p])`
// by convexity, and the ladder pays exponentially in streak length, so *any* p ≠ 0.5 mints truguts in
// either direction. Blind play measured 1.66 at 0.55. Do not put a lean back here.
const rollSide = () => (chance(0.5) ? 'blue' : 'red');
exports.rollSide = rollSide;

// Watto's tie-breaker leans against whatever you called, whichever colour that is. Qui-Gon's Nudge
// has its **own** weight rather than turning Watto's around: reusing `tieLean` reversed made the pick
// a 20-point swing and measured +23% EV on any rack.
exports.rollTiebreak = function (call, nudge) {
    if (nudge) return chance(config.nudgeLean) ? call : OTHER[call];
    return chance(config.tieLean) ? OTHER[call] : call;
};

// Each Multiplier **adds** `multBonus` rather than multiplying, so three on the winning side is ×4
// and not ×8. Applied by the caller because a Multiplier only pays if its side won, which isn't known
// until the line is counted — and on a tie, not until Watto's cube has landed on top of it.
const applyMults = (mult, mults, side) => (side
    ? Object.values(mults || {}).reduce((m, s) => (s === side ? m + config.multBonus : m), mult)
    : mult);
exports.applyMults = applyMults;

exports.multSteps = function (start, pays, side) {
    let running = Number(start) || 0;
    return (pays || []).map((p) => {
        const paid = p.kind !== 'mult' || (!!side && p.side === side);
        if (paid) running += p.bonus;
        const note = {
            kind: p.kind === 'mult' ? (paid ? 'pay.won' : 'pay.lost') : `pay.${p.kind}`,
            faceId: p.faceId,
            specialId: p.specialId,
            specialName: p.specialName,
            side: p.side,
            bonus: p.bonus,
            positions: p.positions,
        };
        return { at: p.at, paid, note, multiple: running };
    });
};

exports.bankPayout = (stake, multiple) => Math.floor(stake * (Number(multiple) || 0));

// **Prices round to a tenth of a mult, not a whole one.** Whole mults could not go below `armFloor`
// 1, which made the cheapest option cost 52% of an opening standing — paid blind, before the throw,
// on every rung the perk turns out to be useless on. Scrap, Swap and Split all measured as dead picks
// and the floor was the binding term, not the share. The board already prints fractional multiples.
const TENTH = 10;
const toTenth = n => Math.round((Number(n) || 0) * TENTH) / TENTH;
exports.toTenth = toTenth;

// **Priced per arm, because they are not the same size.** Scrap *removes* a problem from the line;
// Swap can only move one, and measured to the same priorities the gap is about four-fold. One share
// cannot serve both — priced for Scrap, Swap is dead; priced for Swap, Scrap prints. A share rather
// than a table per rung: a fixed table sells the pick at a discount exactly when a hot run makes it
// worth most, and an early draft keyed to the rung's *payout* dropped usage from 22% of rungs to 6%.
const armPriceOf = function (multiple, pick) {
    const m = Number(multiple) || 0;
    const share = (config.armShares || {})[pick];
    const rate = Number.isFinite(share) ? share : config.armShare;
    return Math.max(config.armFloor, toTenth(rate * m));
};
exports.armPriceOf = armPriceOf;

// A share for the same reason the arms are: flat, the look cost 52% of an opening standing and 3.6%
// of a Level 5 one.
exports.lookPriceOf = function (multiple) {
    const m = Number(multiple) || 0;
    return Math.max(config.armFloor, toTenth(config.lookShare * m));
};
exports.betPriceOf = () => config.betAnte;

exports.spendMultiple = function (stake, multiple, price) {
    const m = Number(multiple) || 0;
    const p = Number(price) || 0;
    if (!(p > 0) || p >= m) return null;
    const left = m - p;
    return { mult: left, standing: exports.bankPayout(stake, left), paid: p };
};

const BONUS = { again: 'againBonus', overtime: 'overtimeBonus' };

const rungMultiple = function (kind, carried, added = 0) {
    const base = Number(carried) || 1;
    const bonus = BONUS[kind];
    return (bonus
        ? base + config[bonus]
        : base * config.levelStep) + added;
};
exports.rungMultiple = rungMultiple;

exports.nextMultiple = (kind, carried) => rungMultiple(kind, carried, 0);

// What a rung opens on before anything is added to it. Compounded from `levelStep` rather than read
// off `LEVELS[i].payout` so the level ladder has one formula, shared with `rungMultiple` above: a
// table entry and a series that agree today drift the moment the ladder stops being pure geometric.
exports.openingMultiple = levelIdx => config.levelStep ** (levelIdx + 1);

const nominalCubes = levelIdx => Math.min(
    config.maxCubes,
    config.startingCubes + config.cubesPerLevel * levelIdx,
);
exports.nominalCubes = nominalCubes;

const bagSize = () => nominalCubes(MAX_LEVEL) - config.startingCubes;
exports.bagSize = bagSize;

const shuffle = function (a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// **The rack fits the bag exactly, and that is enforced upstream** — `bagSize()` caps `equipped`
// where a loadout is written, where a reward is granted and where a profile is read. So there is no
// bench and no tail behind the levels: every cube fielded is one the climb reaches. Two rules died to
// get here — "the first eight in `SPECIALS` order", which silently hid the six newest cubes from
// every run, and a random cut to eight, which fixed the bias and kept the loss. The slice is defence:
// a hand-edited profile must not hand a run a longer bag than the ladder was measured against.
const fillBag = function (equipped) {
    const n = bagSize();
    const owned = (equipped || []).filter(id => specialById(id)).slice(0, n);
    return shuffle([
        ...owned,
        ...Array.from({ length: Math.max(0, n - owned.length) }, () => null),
    ]);
};
exports.fillBag = fillBag;

// **A cube on the line is an instance, and an instance has a name.** `SPECIALS` is the class — one
// shared, immutable definition per cube — and a slot is one cube built from it, carrying the state
// that makes it itself: what has been singed off it, what it has been painted, whether it is on ice,
// how hot it is, who it is holding.
//
// That much was always true. What a slot did not have was a **name**, and the consequence was that
// its identity existed only as a JavaScript object reference. Inside one roll that was enough, and it
// is load-bearing — `liftOne` insists on the slot itself rather than a copy, and the end-of-roll
// sweep works out what left the table by comparing references. But a reference does not survive
// Firebase and does not survive `throwSet`, which reshuffles every rung on purpose. So the moment a
// cube crossed either boundary the only thing identifying it was its position in an array, and two
// Greed Cubes standing side by side were genuinely indistinguishable to anything downstream.
//
// `uid` closes that. It is minted once, at the point a slot is first built, and from then on it is
// the cube — through the shuffle, through the wire, into the junkyard and back out again on a
// scavenge. A **copy is a new cube** and gets its own, which is what keeps a reflected Oovo IV's
// prisoners distinct from the ones still in the original cell.
const newUid = () => crypto.randomBytes(4).toString('hex');
exports.newUid = newUid;

const slotOf = function (v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        return {
            // Minted on read when it is missing, which is the whole migration: a set stored before
            // cubes had names decodes into named cubes the first time it is picked up.
            uid: v.uid ? String(v.uid) : newUid(),
            mirrored: !!v.mirrored,
            id: v.id ? String(v.id) : null,
            burned: Object.values(v.burned || {}).map(String),
            painted: Object.values(v.painted || {}).map(String),
            frozen: v.frozen ? String(v.frozen) : null,
            heat: Number(v.heat) || 0,
            blessed: !!v.blessed,
            held: Object.values(v.held || {}).map(slotOf),
            joined: Object.values(v.joined || {}).map(slotOf),
        };
    }
    return {
        uid: newUid(),
        mirrored: false,
        id: v ? String(v) : null,
        burned: [], painted: [], frozen: null, heat: 0, blessed: false, held: [], joined: [],
    };
};

// **Which way round a cube is.** A reflection turns the **cube**, not the picture on the face it
// happened to be showing: a mirrored cube stays mirrored for the rest of the climb, and reflecting
// a mirrored cube turns it back, so a reflection of a reflection is the original.
//
// **Four faces are handed, and the rest only look it.** Plenty of faces reach in a direction, but
// reaching one way is not the same as being a thing with a hand. The Binder's clone reads its left
// and writes its right; that pairing *is* the face, and a Binder doing it the other way round is a
// different cube rather than the same one seen from behind. Same for the Mirror, whose whole
// subject is reflection, and for the Sandcrawler's haul. Those three act as drawn however the cube
// is turned.
//
// What does read this flag: `burn`, `draw`, `scavenge` and `engine` — the Binder's fire, which side
// of itself the Pit Droid and the Scavenger seat what they bring in, and which way Sebulba's engine
// points.
//
// The *art* is a separate question and the client answers it for every face: a mirrored cube is
// drawn turned over whether or not anything it does changes. See `mirrored` on the wire.
// Named `flipped` rather than `handed`: `resolveLine` already keeps a local `handed` counter for
// the turn queue, and a module-level function of the same name is silently shadowed by it — which
// is a `TypeError` at the one call site inside the loop and nowhere else.
const flipped = c => !!(c && c.slot && c.slot.mirrored);
exports.flipped = flipped;

// The direction a cube reaches in, as a step: +1 the normal way round, -1 mirrored.
const stepOf = c => (flipped(c) ? -1 : 1);
const OTHER_DIR = { left: 'right', right: 'left' };
exports.slotOf = slotOf;

const plainSlot = () => ({
    uid: newUid(),
    mirrored: false,
    id: null, burned: [], painted: [], frozen: null, heat: 0, blessed: false, held: [], joined: [],
});
exports.plainSlot = plainSlot;

const countHeld = function (slots) {
    return (slots || []).reduce((n, s) => n + 1 + countHeld(s && s.held), 0);
};
exports.countHeld = countHeld;

// `fresh` is the difference between a copy and a corpse. A reflected captor arrives with its own
// prisoners — new cubes, new names — while a slot swept into the junkyard is the same cube that died
// and keeps the name it had, so a scavenger hands back the cube you lost rather than one like it.
const cloneHeld = (slots, fresh) => (slots || []).map(s => ({
    ...s,
    ...(fresh ? { uid: newUid() } : {}),
    held: cloneHeld(s.held, fresh),
}));
exports.cloneHeld = cloneHeld;

// **A slot going into the junkyard is copied whole, arrays included.** A bare spread shares
// `burned`, `painted` and `held` with the dead slot it came from — harmless only for as long as
// nothing touches a slot after it leaves the table, which is not a property anything enforces. What
// a scavenger pulls back out has to be the cube as it died, and a cube as it died cannot be sharing
// its scorch marks with anything still standing.
const keepSlot = sl => ({
    ...sl,
    burned: [...(sl.burned || [])],
    painted: [...(sl.painted || [])],
    held: cloneHeld(sl.held),
    joined: cloneHeld(sl.joined),
});

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

// `painted` is keyed by face **id** and a cube carries several faces under one id — three Greeds,
// four wilds — so which copy the crowd got at is not recorded and does not need to be: calling a drawn
// copy painted with probability `marks of that id / all of that id` is the same distribution as having
// painted a particular one and asking whether this is it. Reading the mark straight off the id would
// turn all three reds blue on one visit.
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

const charFace = function (cube, id) {
    cube.side = null;
    cube.charred = true;
    cube.face = { id, kind: 'charred' };
    return cube;
};

const marksOn = (slot, id) => (slot.painted || []).filter(p => p.slice(0, id.length + 1) === `${id}|`);

const openOn = function (faces, slot, id, side) {
    const of = faces.filter(f => f && f.id === id).length;
    if (!of) return 0;
    const marks = marksOn(slot, id);
    const own = (faces.find(f => f && f.id === id) || {}).side || null;
    const already = marks.filter(m => m.slice(id.length + 1) === side).length
        + (own === side ? of - marks.length : 0);
    return Math.max(0, of - already);
};

const paintable = function (special, slot, shown, side) {
    const faces = liveFaces(special, slot.burned);
    const ids = [...new Set(faces.map(f => f && f.id).filter(Boolean))]
        .filter(id => openOn(faces, slot, id, side) > 0);
    if (!ids.length) return null;
    if (shown && ids.includes(shown.id)) return shown.id;
    return ids[crypto.randomInt(0, ids.length)];
};

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

const frozenCube = function (special, id) {
    if (!special) {
        const side = id === SIDE_IDS.red ? 'red' : id === SIDE_IDS.blue ? 'blue' : null;
        if (!side) return null;
        // Rebuilt with its face, for the reason `throwSet` keeps one: a chance cube picked back up
        // off the wire has to be the same cube that was put down, marks and all.
        const face = PLAIN_FACES.find(f => f && f.id === id);
        return { side, special: null, face: face ? { ...face } : null };
    }
    const face = (special.faces || []).find(f => f && f.id === id);
    return face ? { side: null, special, face: { ...face } } : null;
};

exports.drawCubes = function (set, bag, levelIdx) {
    const rest = [...(bag || [])];
    if (levelIdx === 0) return { set: Array.from({ length: nominalCubes(0) }, plainSlot), bag: rest };

    const out = (set || []).map(slotOf);
    for (let i = 0; i < config.cubesPerLevel && rest.length; i++) out.push(slotOf(rest.shift()));

    if (out.length && !out.some(slot => !slot.id)) out[out.length - 1] = plainSlot();
    return {
        set: out.length > config.maxCubes ? out.slice(0, config.maxCubes) : out,
        bag: rest,
    };
};

// **Firebase deletes nulls** — writing `null` to a key removes it — and a set is mostly plain cubes,
// which are `null` in memory. So it round-tripped catastrophically: `[null, null, 'greed']` came back
// as `{ 2: 'greed' }`, a set of ONE, and a run lost every plain cube on the way to the database. Plain
// cubes store as `0` instead. This looks like a quirk to clean up and it is load-bearing; any other
// transport must preserve it. A slot with nothing done to it still encodes as a bare id, which is what
// let slots ship without a migration in either direction.
exports.encodeSet = function (set) {
    const one = function (c) {
        const slot = slotOf(c);
        // **Always an object now, because every cube has a name to carry.** The bare-id shortcut that
        // used to live here was a migration aid — it let slots ship onto an array of plain ids with
        // no rewrite in either direction — and it is what kept instances anonymous on the wire. The
        // rule it was really protecting still holds: Firebase deletes nulls, so a plain cube encodes
        // its id as `0` rather than as nothing. `decodeSet` still reads the old bare form and mints a
        // name for it, so stored runs pick up unharmed.
        const out = { uid: slot.uid, id: slot.id || 0 };
        if (slot.mirrored) out.mirrored = true;
        if (slot.burned.length) out.burned = slot.burned;
        if (slot.painted.length) out.painted = slot.painted;
        if (slot.blessed) out.blessed = true;
        if (slot.frozen) out.frozen = slot.frozen;
        if (slot.heat) out.heat = slot.heat;
        if (slot.held.length) out.held = slot.held.map(one);
        if (slot.joined.length) out.joined = slot.joined.map(one);
        return out;
    };
    return (set || []).map(one);
};
exports.decodeSet = raw => Object.values(raw || {}).map(slotOf);

// **The bag is not a set and must not be decoded as one.** It holds bare ids — nothing has been done
// to a cube that hasn't been thrown yet.
exports.encodeBag = bag => (bag || []).map(id => id || 0);
exports.decodeBag = raw => Object.values(raw || {}).map(v => (v ? String(v) : null));

// **The cubes land in a new order every throw.** Position is a property of the throw, not of the cube
// — without this every position-dependent face resolved against the same neighbours for a whole climb.
// Slots are copied on the way in, so nothing here mutates the set it was handed, which is what lets a
// reroll pick the table up exactly as it was.
// **A frozen cube holds its place as well as its face**, for the throw it is served on — the hold
// ends inside that roll, on the cube's own turn, and the walk is where that is written down.
// Everything else lands in a new order every
// rung, which is the rule above and worth keeping: without it, every position-dependent face resolves
// against the same neighbours for a whole climb. Ice is the one exception and has to be — a freeze
// that kept the face but moved the cube is not holding anything a player can aim at, and after the
// ice stopped being a ward, position is most of what is left to give it. Hold a wild inside a Guide's
// run, hold a cube inside Ben's reach, hold a shield where the blast is coming from.
//
// **Relative order, not an absolute index.** Only the open positions are shuffled, and only among
// themselves, so the line can still grow and shrink around a held cube without the ice having to
// know how long the line is. Read before the map, because serving the ice clears `slot.frozen`.
exports.throwSet = function (set) {
    const slots = (set || []).map(slotOf);
    const open = slots.map((sl, k) => (sl && sl.frozen ? -1 : k)).filter(k => k >= 0);
    const mixed = shuffle(open.map(k => slots[k]));
    const order = slots.slice();
    open.forEach((k, n) => { order[k] = mixed[n]; });
    return order.map((slot) => {
        const special = slot.id ? specialById(slot.id) : null;

        // **Ice is consumed the moment it is served.** Clearing the slot here rather than after the
        // roll is what stops a freeze handed out in pass two of this same throw from being re-served:
        // frozen on throw N, held on N+1, ordinary on N+2, with no bookkeeping in between.
        if (slot.frozen) {
            const held = frozenCube(special, slot.frozen);
            slot.frozen = null;
            if (held) return { ...held, slot, frozen: true };
        }

        const faces = rollFaces(special, slot);
        if (!special) {
            // **A chance cube that has had something done to it is a cube, not a colour.** An
            // untouched one is still just a coin — it has six interchangeable sides, nothing has
            // happened to it, and rolling a face object for it would put a `side` note on every
            // plain position on the table for no information.
            //
            // The moment it carries a mark it stops being interchangeable, and it has to keep
            // **which of its six faces is up**, because that is the key every mark is filed under.
            // Handing it back with `face: null` threw that away one line after computing it, which
            // is why a turn could not move paint on a chance cube: there was no face left to move
            // the mark off. A cube accumulates; this is what lets it.
            if (!slot.burned.length && !slot.painted.length) {
                return { side: rollSide(), special: null, face: null, slot };
            }
            // A chance cube burned down to nothing rolls the same blank a special does: no face and
            // no colour. `rollSide` here would hand a charred coin a side it has no face to show.
            if (!faces.length) return { side: null, special: null, face: null, slot };
            const face = faces[crypto.randomInt(0, faces.length)];
            const paint = paintOn(faces, slot.painted, face);
            return {
                side: paint || face.side || null, special: null, face: { ...face }, slot, paint,
            };
        }
        const face = faces.length ? faces[crypto.randomInt(0, faces.length)] : null;
        return {
            side: face ? rollSide() : null,
            special,
            face,
            slot,
            paint: paintOn(faces, slot.painted, face),
        };
    });
};

// Ice refuses a split: a frozen weld has one face committed and two cubes' worth of faces to commit
// it to, and there is no honest answer to which parent inherits it.
exports.canSplitAt = function (line, at) {
    const pos = (line || [])[at];
    if (!pos || pos.frozen) return false;
    return !!exports.weldParents(pos.slot && pos.slot.id);
};

// **What a weld picked up goes back to the cube whose face it landed on.** Every face on a weld
// carries `from`, so a burn or a paint on one is a burn or a paint on a face of a particular parent —
// up to how many of that face the parent put into the cut. Heat goes to the parent that brought heat
// faces; a blessing is one charge and goes to one parent; a reflection turned the whole seat, so it
// turns every parent. Without this a split was a free cleanse: a charred weld came apart into two
// fresh cubes.
const handBack = function (special, slot, parents) {
    const room = (k, id) => special.faces
        .filter(f => f.from === parents[k].id && (id === null ? f.kind === 'heat' : f.id === id)).length;
    const give = function (marks, idOf, put) {
        const used = parents.map(() => new Map());
        for (const m of marks) {
            const id = idOf(m);
            const k = parents.findIndex((p, n) => (used[n].get(id) || 0) < room(n, id));
            if (k < 0) continue;
            used[k].set(id, (used[k].get(id) || 0) + 1);
            put(parents[k], m);
        }
    };
    give(slot.burned || [], m => m, (p, m) => p.burned.push(m));
    give(slot.painted || [], m => m.slice(0, m.lastIndexOf('|')), (p, m) => p.painted.push(m));
    give(Array.from({ length: slot.heat || 0 }), () => null, (p) => { p.heat += 1; });
    if (slot.blessed) {
        const k = parents.findIndex(p => !p.blessed);
        if (k >= 0) parents[k].blessed = true;
    }
    if (slot.mirrored) for (const p of parents) p.mirrored = !p.mirrored;
    return parents;
};

// **A fused seat comes apart into the cubes that went in**, names and marks and all; a pressed weld
// has no originals on the table and comes apart into new ones. Either way, what the weld picked up
// while it was one cube is handed back to the parent it belongs to.
exports.splitAt = function (line, at) {
    if (!exports.canSplitAt(line, at)) return null;
    const { slot, special } = line[at];
    const kept = slot.joined || [];
    const parents = kept.length
        ? kept.map(p => ({ ...keepSlot(p), frozen: null }))
        : exports.weldParents(slot.id).map(id => ({ ...plainSlot(), id }));
    return exports.throwSet(handBack(special || specialById(slot.id), slot, parents));
};

// **Fusing: two neighbours into one seat, for the rest of the climb.** Cut the way the press cuts —
// the same split table at the player's press tier, and the same rule that a cut carries a downside
// whenever either cube still has one — but out of each cube's **live** faces only,
// so a burned face or a spent heat stays gone rather than coming back on the fused cube. The originals
// ride inside the new seat untouched, marks and all, and a split hands them back.
//
// Refused for anything the press would refuse, plus ice (a frozen cube holds its place), a cube with
// prisoners, and a cube already fused or pressed — two into one, not three.
const fusible = function (c) {
    if (!c || c.frozen || c.gone || !c.special || !c.slot || c.special.noWeld) return false;
    if (exports.weldParents(c.slot.id)) return false;
    if ((c.slot.held || []).length) return false;
    return rollFaces(c.special, c.slot).length > 0;
};

exports.canJoinAt = function (line, a, b) {
    const l = line || [];
    if (!Number.isInteger(a) || !Number.isInteger(b) || Math.abs(a - b) !== 1) return false;
    const x = l[a];
    const y = l[b];
    return fusible(x) && fusible(y) && x.special.id !== y.special.id;
};

exports.joinCut = function (slots, tier = 1) {
    const parents = slots.map(sl => baseById(sl.id));
    if (parents.some(p => !p || p.noWeld)) return null;
    const live = slots.map((sl, k) => rollFaces(parents[k], sl));
    const anyDownside = live.some(fs => fs.some(f => DOWNSIDE.has(f.kind)));
    let last = null;
    for (let attempt = 0; attempt < 60; attempt++) {
        const take = rollSplit(slots.length, tier) || slots.map(() => 3);
        const order = orderFor(slots.length, null);
        const picks = parents.map((p, k) => {
            const from = live[k];
            const want = Math.min(take[order[k]] ?? take[take.length - 1], from.length);
            const chosen = pickIdx(from.length, want).map(i => from[i].id);
            const used = new Set();
            const idx = chosen.map((fid) => {
                const i = p.faces.findIndex((f, n) => f.id === fid && !used.has(n));
                used.add(i);
                return i;
            });
            return { id: p.id, idx, keeps: chosen.some(fid => DOWNSIDE.has((p.faces.find(f => f.id === fid) || {}).kind)) };
        });
        last = weldId(picks);
        if (!anyDownside || picks.some(pk => pk.keeps)) return last;
    }
    return last;
};

exports.joinAt = function (line, a, b, tier = 1) {
    if (!exports.canJoinAt(line, a, b)) return null;
    const pair = [line[Math.min(a, b)], line[Math.max(a, b)]];
    const id = exports.joinCut(pair.map(c => c.slot), tier);
    if (!id || !specialById(id)) return null;
    const [x] = exports.throwSet([{
        ...plainSlot(),
        id,
        joined: pair.map(c => ({ ...keepSlot(c.slot), frozen: null })),
    }]);
    return x;
};

exports.relineFrom = function (set, faces, state = {}) {
    const frozen = state.frozen || [];
    const painted = state.painted || [];
    const ids = faces || [];
    return (set || []).map(slotOf).map((slot, i) => {
        const special = slot.id ? specialById(slot.id) : null;
        const built = frozenCube(special, ids[i]);
        const paint = painted[i] || null;
        if (!built) return { side: paint, special, face: null, slot, paint };
        const side = paint || built.side;
        return frozen[i]
            ? { ...built, side, slot, frozen: true, paint }
            : { ...built, side, slot, paint };
    });
};

// **Only propositions the run can still produce.** Most measure a flat 0.0% without a specific cube
// in the bag, and a bet that cannot be won is not a long shot, it is a trap. Chalked from the run —
// the table, the bag, and what they hold — rather than from the rack as bought: a run is a war of
// attrition, and a book read off `equipped` kept offering the Binder's cards after the Binder had
// shattered. Three refinements, each because the coarser reading offered a dead card:
//   - a face burned off a cube (a scorch, a spent heat) cannot land again, so it is subtracted per
//     instance before its kind counts;
//   - a captive inside a jail or a sandcrawler counts, because parole or a hold-break walks it
//     straight back onto the line;
//   - the wreckage counts only while a scavenger is still in play, because salvage is the only road
//     out of it.
// An id array still works — that is the rack-as-bought reading, for tests and anything with no run
// in hand.
//
// **`spoiled` is what a look has already answered.** Every price is derived blind, so a card offered
// to somebody who has seen a face that settles it is not mispriced by a little — a premonition showing
// Sebulba turns `engine` from a ~5% long shot into a near-certain +34. Re-chalking rather than
// refusing is what lets the two abilities be played in either order. Off `spoils` and not `needs`,
// which differ only for `saved`. Known and left standing: a growth face means a longer line and so
// lifts every per-cube effect at once — a look showing `draw` takes `broken` from 28.7% to 32.9%.
// Spoiling the whole book on growth is worse than the leak; it empties the book on the one rack that
// plays for line length.
exports.drawBook = function (pool, spoiled) {
    const kinds = new Set();
    const addSpecial = (sp) => { for (const f of (sp && sp.faces) || []) kinds.add(f.kind); };
    const walk = function (raw) {
        const slot = slotOf(raw);
        const sp = slot.id ? specialById(slot.id) : null;
        if (sp) {
            const burned = [...slot.burned];
            for (const f of sp.faces || []) {
                const b = burned.indexOf(f.id);
                if (b >= 0) burned.splice(b, 1);
                else kinds.add(f.kind);
            }
        }
        for (const h of slot.held) walk(h);
    };
    if (Array.isArray(pool)) {
        for (const id of pool) addSpecial(specialById(id));
    } else {
        const { set, bag, hold } = pool || {};
        for (const sl of set || []) walk(sl);
        for (const id of bag || []) addSpecial(specialById(id));
        if (kinds.has('scavenge')) for (const sl of hold || []) walk(sl);
    }
    const off = (Array.isArray(spoiled) ? spoiled : [spoiled]).filter(Boolean);
    const can = bet => (bet.needs ? bet.needs.some(k => kinds.has(k)) : kinds.size > 0)
        && !(bet.spoils || bet.needs || []).some(k => off.includes(k));
    const out = [];
    for (const band of ['likely', 'middle', 'long']) {
        const pool = SIDE_BETS.filter(b => b.band === band && can(b));
        if (pool.length) out.push(pool[crypto.randomInt(0, pool.length)].id);
    }
    return out;
};

// **The ante comes back inside the payout.** Every `price` is a **net** return on the one-mult ante —
// `cubeSideBet.js` derives it as `levelStep / p - 1` at the best measured rate, because the ante is
// spent *before* the rung multiplies and the payout lands *after* — so a card pays `price + betAnte`.
// Paying only `price` charged the stake and never returned it, a second house edge of a further `p`
// per card. The card still advertises `price`, because net is how odds quote.
exports.betPaid = function (id, res, call) {
    const bet = id ? SIDE_BETS.find(b => b.id === id) : null;
    if (!bet || !res) return 0;
    return bet.hit(res, call || null) ? bet.price + config.betAnte : 0;
};

exports.encodeLine = line => ({
    set: exports.encodeSet((line || []).map(c => c.slot)),
    faces: exports.rolledFaces(line || []),
    state: lineState(line || []),
});

const faceIdOf = function (cube) {
    if (cube.wild) return 'wild';
    if (cube.face && cube.face.id) return cube.face.id;
    return cube.side ? `side:${cube.side}` : 'hidden';
};
exports.faceIdOf = faceIdOf;

exports.rolledFaces = line => line.map(faceIdOf);

// Everything `lineState` says, as one comparable string, so `changed` can ask "would a frame show a
// difference". Face ids alone are not that: the ice, the paint, the char and the blessing are all
// drawn on the cube and every one can land without moving a face — so Ando Prime, Tatooine and
// Baroonda all came out `quiet` and a client filtering on the flag drew none of them.
// Taking the whole state rather than re-listing its fields is the point: the bug above came back
// once already because a field was added to `lineState` and not to the key. `keyOf` is separate so
// a caller that already has the state does not build it twice.
const keyOf = st => JSON.stringify(st);
const stateKey = line => keyOf(lineState(line));
exports.keyOf = keyOf;

const lineState = line => ({
    // The names, position for position. This is what lets a client tell two identical cubes apart —
    // and follow one across a shuffle, which no amount of position data can do.
    uids: (line || []).map(c => ((c && c.slot) ? c.slot.uid : null)),
    mirrored: (line || []).map(c => flipped(c)),
    frozen: (line || []).map(c => !!(c && c.frozen)),
    burned: (line || []).map(c => ((c && c.slot && c.slot.burned) ? [...c.slot.burned] : [])),
    charred: (line || []).map(c => !!(c && c.charred)),
    blessed: (line || []).map(c => !!(c && c.slot && c.slot.blessed)),
    painted: (line || []).map(c => ((c && c.paint) ? c.paint : null)),
    cubeIds: (line || []).map(c => ((c && c.special) ? c.special.id : null)),
    holds: (line || []).map(c => ((c && c.slot) ? countHeld(c.slot.held) : 0)),
});
exports.lineState = lineState;

// **The state's own field list, so anything carrying it as a unit cannot fall behind it.** `parkTie`
// stores the state and `resumeTie` puts it back, and the flat copy on the wire has already gone
// stale twice by being typed out. Read off the function rather than written down again.
exports.STATE_KEYS = Object.keys(lineState([]));

// Every slot still on the table, captives included at any depth. Three places ask this — the Jawa's
// sweep, the hold-break check and the end-of-roll wreckage sweep — and all three depend on the same
// rule, that a captured cube is not wreckage however deep it is held. One definition, so a change to
// what counts as standing cannot reach two of the three.
const standingSlots = function (line) {
    const standing = new Set();
    const walk = (slots) => { for (const sl of slots) { standing.add(sl); walk(sl.held); } };
    for (const c of line || []) {
        if (!c || c.gone || !c.slot) continue;
        standing.add(c.slot);
        walk(c.slot.held);
    }
    return standing;
};
exports.standingSlots = standingSlots;

const resolveLine = function (line, call, bag, opts = {}) {
    const faceLog = line
        .filter(c => c.special && c.face)
        .map(c => ({ id: c.face.from || c.special.id, key: faceKey(c.face) }));

    for (const c of line) if (c.slot && !Array.isArray(c.slot.held)) c.slot.held = [];

    const rest = [...(bag || [])];

    const hold = [...(opts.hold || [])];
    const takenIn = new Set();
    const wrecked = [...(opts.wrecked || [])];
    const recovered = [];
    const joined = [];
    const rungs = Math.max(1, Number(opts.rungs) || 1);

    const notes = [];
    const broken = [];
    let mult = 0;
    let shortcuts = 0;
    let rerolls = 0;
    let ended = null;
    let detonated = null;
    let sealed = null;

    const pays = [];

    const note = (c, kind, data) => notes.push({
        kind,
        faceId: faceIdOf(c),
        specialId: c.special ? c.special.id : null,
        specialName: c.special ? c.special.name : null,
        ...data,
    });
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

    // **A face either IS a side or DOES a thing**, never both. This is what stops an effect face
    // being drawn as a colour square plus an effect, which made a seven-cube line read as nine. It
    // also takes a cube out of the count without shortening the line, so even counts are common —
    // survivable only because a tie goes to Watto's tie-breaker instead of to the house.
    const SIDED = new Set(['wild', 'side']);

    const settle = function (c) {
        if (c.face && (c.paint || !SIDED.has(c.face.kind))) c.side = c.paint || null;
        if (!c.face) return c;
        switch (c.face.kind) {
            case 'end':
                break;
            case 'broken':
                break;
            case 'wild':
                c.side = call;
                c.paint = null;
                note(c, 'wild', { side: call });
                break;
            // **The paint outranks the face's own colour, and this is the only place that was true
            // and then untrue.** The line above settles `c.side` to the paint for every face on the
            // die; this case then read the colour straight off the face and put it back, so a mark
            // the crowd had spent a landing to write was erased on the next throw before anything
            // could count it. Only `side` faces were hit — an effect face has no colour of its own to
            // reassert — which is why the Greed measured right at one-in-six while Anakin and Shmi
            // measured a flat zero. The mark itself was never lost: it sat on the slot being
            // overwritten every throw, so the cube looked unpainted for the rest of the climb.
            case 'side': {
                const side = c.paint || c.face.side;
                c.side = side;
                note(c, 'side', { side, painted: !!c.paint });
                break;
            }
            case 'greed':
                note(c, 'greed', { bonus: config.greedBonus });
                break;
            // **Announced here with the rest of the multiple, not in the turn walk.** Mon Gazza's seam
            // pays off the rungs behind it and moves nothing on the table, so a turn-phase note gave it
            // a step that changed no position — which is exactly what `quiet` marks, and the reveal
            // shakes a quiet step off as a cube that found nothing to do. It found the same thing every
            // other paying face finds, and none of them takes a turn to find it.
            case 'seam':
                note(c, 'seam', { bonus: config.seamBonus * rungs, rungs });
                break;
            case 'boost':
                note(c, 'boost', { bonus: config.boostBonus });
                break;
            case 'mult':
                note(c, 'mult', { side: c.face.side, bonus: config.multBonus });
                break;
            case 'heat':
                note(c, 'heat', { bonus: config.heatBonus * (((c.slot && c.slot.heat) || 0) + 1) });
                break;
            case 'guide':
                note(c, 'guide');
                break;
            case 'shortcut':
                note(c, 'shortcut');
                break;
            case 'reroll':
                note(c, 'reroll');
                break;
            default:
                break;
        }
        return c;
    };

    // -------------------------------------------------------------------------
    // Parole, which happens to the throw rather than during it
    // -------------------------------------------------------------------------

    // **A prisoner walks as the line is thrown, not when its jailer's turn comes up.** Both readings
    // free one cube per jailer per rung, so the cell empties at the same rate either way; what they
    // disagree about is whether the player ever sees a cube arrive. Freeing it mid-walk made it an
    // *event* — a seat the line did not have, appearing on the captor's frame, with a turn of its own
    // handed to it and a slot in the spawn budget spent on it — and that is a story about a cube
    // being produced. It is the wrong story. Nothing is produced: the cube was in this throw all
    // along, it was simply serving its sentence off the table, and the rung it walks on is the rung
    // it comes down with the rest of them.
    //
    // So it lands with the toss and is an ordinary cube from that moment: it rolls its own face, it
    // takes its turn in line order like every other position rather than being spliced in behind the
    // walk, and it counts for the payout. The whole of what is left to say about it is a note, which
    // is the label the board throws over the seat as the line comes down.
    //
    // **It is reachable, and that is the price.** Held cubes used to be untouchable until released
    // and then protected for the rest of the turn that released them; a cube standing in the line
    // from the throw can be burned, frozen, taken over a chasm — and arrested again by the very cell
    // it walked out of, if that cell rolls `jail` this rung. That last one is the sharp edge of the
    // rule and it is left sharp: a cube on the table is a cube on the table, and a position the rest
    // of the line has to pretend is not there is the thing this change exists to get rid of.
    //
    // **And it lands where the throw puts it, not beside the cell.** Right of its captor is where a
    // cube freed *during* the walk had to go — the line resolves left to right, so anything put back
    // behind the walk sits out the roll it was freed into — but a cube coming down with the toss has
    // no walk to be behind. Pinning it to the jailer would be the one position on the table that is
    // a function of something other than the throw, and it would give the octahedron a neighbour it
    // chose, every rung, for free. `throwSet` shuffles for exactly this reason; a parole shuffles in
    // with it.
    //
    // Two passes: every cell gives up its first prisoner before any of them is seated, so a jailer
    // cannot free a cube into a seat that changes what the next jailer is. Seats are read back at
    // the end, once the inserting has stopped moving them.
    // **Which cell each freed cube walked out of**, so the same cell cannot put it straight back in.
    // Keyed by the slot rather than by the cube standing on it: a cell is a property of the die that
    // owns it, so a reflection's copy — a different slot carrying the same id — is a different prison
    // and is free to arrest what the original let go.
    const walkedOut = new Map();
    const freed = [];
    for (const c of line) {
        if (!c || c.gone || !c.slot || !c.special || !JAILERS.has(c.special.id)) continue;
        if (!Array.isArray(c.slot.held) || !c.slot.held.length) continue;
        // First in, first out, and the slot itself where there is one — the same two rules `liftOne`
        // is written to, and for the same reason: the end-of-roll sweep tells cubes apart by slot
        // identity, so a copy here is a cube standing on the table and lying in the wreckage at once.
        const raw = c.slot.held.shift();
        const slot = (raw && typeof raw === 'object' && Array.isArray(raw.held)) ? raw : slotOf(raw);
        const special = slot.id ? specialById(slot.id) : null;
        const faces = rollFaces(special, slot);
        const x = {
            side: rollSide(),
            special,
            face: special && faces.length ? faces[crypto.randomInt(0, faces.length)] : null,
            slot,
        };
        if (special && x.face) faceLog.push({ id: x.face.from || special.id, key: faceKey(x.face) });
        if (special) recovered.push(special.id);
        joined.push(x);
        walkedOut.set(x, c.slot);
        freed.push({ cube: x, by: c, left: c.slot.held.length });
    }
    for (const f of freed) line.splice(crypto.randomInt(0, line.length + 1), 0, f.cube);
    // Recorded against the jailer, because the jailer is who did it — but wearing the freed cube's
    // face, which is the one the label is pointing at. Same shape the walk used to emit.
    for (const f of freed) {
        notes.push({
            kind: 'parole',
            faceId: faceIdOf(f.cube),
            specialId: f.by.special.id,
            specialName: f.by.special.name,
            left: f.left,
            at: line.indexOf(f.cube),
        });
    }
    const paroled = freed.map(f => line.indexOf(f.cube)).sort((a, b) => a - b);

    // **The line as thrown, and the one honest moment to read it.** This used to be taken by the
    // caller just before handing the line over, which was the same instant — until a parole started
    // arriving with the throw, and a snapshot taken outside would miss the cube it puts on the table.
    // Before `settle`, exactly as it was: a chance cube turned by the run's effect is a thing that
    // happens *to* the throw, and the thrown line is what came down.
    const rolled = exports.rolledFaces(line);
    const rolledState = lineState(line);

    for (const c of line) settle(c);

    let final = line.slice();
    const plain = side => ({ side, special: null, face: null, slot: plainSlot() });
    const at = c => final.indexOf(c);
    // **A flattened position is not a cube, whatever colour is on it.** Ben's wings carry no side of
    // their own, so this used to hold without the `gone` test — and then the crowd was allowed to
    // paint a wing, which handed one a side and let rubble vote in the majority. Tested here rather
    // than at the crowd, because every other way a `gone` position could acquire a side is a bug too.
    // **A position is a cube when it has a colour, and flattened is not an exception.** Ben cuts his
    // wings in whatever he is wearing, so a painted Ben comes up as three matching cubes rather than
    // one cube lying on two holes — and those three vote, pay, extend a Guide's run and can be turned
    // one at a time, because there is nothing left to tell them apart from any other coloured
    // position. A **bare** wing is still a hole: no colour, no vote, and it breaks a sweep the way it
    // always did. The gate is the colour, which is the same gate every other position answers to.
    //
    // None of this outlives the rung. A wing is dropped from `set` before the next throw whatever
    // colour it is wearing, so this is three positions for one roll and never a cube you own.
    const isCube = c => !!c && !!c.side;
    const ours = x => !!x && x.side === call;
    const guideRun = function (idx) {
        if (idx < 0) return 0;
        let n = 0;
        for (let k = idx - 1; k >= 0 && ours(final[k]); k--) n += 1;
        for (let k = idx + 1; k < final.length && ours(final[k]); k++) n += 1;
        return n;
    };
    // **A painted Ben lies down in his own colour.** The wings are cut from him, so they are cut in
    // whatever he is wearing: paint him and all three positions come up matching, which is the one
    // way a wide Ben is ever a colour rather than a hole in the line.
    //
    // **Inherited once, at the moment they are made, and never again.** The wings are ordinary
    // positions afterwards — a crowd or an engine reaching one of them changes that one and leaves
    // the other two alone. Anything that kept the three tied together would be a fourth kind of
    // cube, and the whole line is read on the rule that a position is a position.
    const razed = (id, mirrored, paint) => ({
        side: paint || null, paint: paint || null, special: null, gone: true, slot: plainSlot(),
        face: { kind: 'razed', id, mirrored },
    });

    const steps = [];

    let saves = 0;

    // **A copy is a cube, so it acts like one, and there is no depth rule.** Copies used to be inert
    // one level down for the obvious reason — without that the queue feeds itself. It feeds itself;
    // that is the point, and the rule that stopped it also made two Mirrors the dullest thing the mode
    // could draw. `overflowAt` is the bound, so it is a budget rather than a rule about what a copy is
    // allowed to be.
    //
    // **Every face takes its turn where it stands, left to right, with no exceptions.** The blessing
    // used to be hoisted to the head of the queue so it was in force for the whole rung; that bought
    // it a little reach at the cost of the one rule the line is read by, and a face that resolves
    // before the cube to its left is a face the player cannot plan around. It waits its turn like
    // everything else, so it protects what is still standing when Malastare comes up — and since a
    // blessing rides the cube until it is spent, nothing it would have saved is lost for good.
    const queue = line.slice();

    // **The ice a cube arrived on is the only ice this roll can melt.** `frozen` says two opposite
    // things to the walk depending on where it came from: a cube served on ice is holding the face
    // *this* roll is looking at and owes its thaw here, while a cube Ando Prime freezes during the
    // walk is holding a face for the *next* throw and must still be on ice when the roll ends. One
    // flag, two meanings, and the walk cannot tell them apart after the fact — so the arrivals are
    // marked before anything moves.
    for (const c of line) if (c && c.frozen) c.onIce = true;

    let spawned = 0;
    let overflow = false;

    for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        // **A held cube spends its turn thawing.** The hold used to cover the whole roll and end
        // off-screen between two throws: the frost was there, the next throw came up, and it was
        // not. Melting it where the walk reaches it puts the end of the hold on the table, in the
        // one place a player is already watching — and makes the ice a matter of *timing* rather
        // than of a rung. Everything to the left has already had its turn and found a cube it
        // could not touch; everything to the right meets an ordinary cube. Freeze the Greed on
        // Sebulba's right and it is held; freeze the one on his left and the thaw lands first.
        //
        // The turn is spent on the thaw and the face does not fire, which is the half of the old
        // rule worth keeping: ice suspends the turn, and the cube pays either way.
        if (c.frozen && c.onIce) {
            const seat = at(c);
            if (seat < 0) continue;
            c.frozen = false;
            c.onIce = false;
            // Held for the length of a throw even though the ice is gone before the payout reads
            // it — see the Turbine's schedule at the bottom of the roll.
            c.thawed = true;
            note(c, 'thaw', { at: seat });
            steps.push({
                faceIds: final.map(faceIdOf),
                note: notes[notes.length - 1],
                at: seat,
                ...lineState(final),
            });
            continue;
        }
        if (!c.face) continue;
        if (c.frozen) continue;
        const i = at(c);
        if (i < 0) continue;
        const stood = final.filter(x => !x.gone && x.slot).map(x => ({ slot: x.slot, faceId: faceIdOf(x) }));
        const made = [];
        const freshlyFreed = new Set();
        let was = final.map(faceIdOf);
        let wasMarks = stateKey(final);
        const wasSealed = sealed;
        let noteAt = notes.length;

        let handed = 0;
        const handedOut = new Set();
        const giveTurn = (x) => {
            queue.splice(q + 1 + handed, 0, x);
            handed += 1;
            handedOut.add(x);
            spawned += 1;
            if (spawned >= config.overflowAt) overflow = true;
            return x;
        };

        const enliven = function (x) {
            x.copy = true;
            return giveTurn(x);
        };
        // **A new cube off an old one, made two ways.** Both inherit the scorch marks and the
        // prisoners (deep-copied, or cracking one hold would empty both). They come out thawed here;
        // the Binder's `copied` puts the ice back on, because a clone is exact and a reflection is
        // not. The other thing they disagree about is the handedness, and that disagreement is the
        // difference between the two cubes that make them.
        const born = function (src, mirrored) {
            const x = { ...src, copy: false };
            x.slot = {
                ...(src.slot || plainSlot()),
                burned: [...(src.slot ? src.slot.burned : [])],
                uid: newUid(),
                mirrored,
                held: cloneHeld(src.slot ? src.slot.held : [], true),
                // A copy of a fused seat is fused from copies: splitting it later hands back two new
                // cubes, not a second set of the originals.
                joined: cloneHeld(src.slot ? src.slot.joined : [], true),
                frozen: null,
            };
            if (x.slot.held.length) made.push({ slot: x.slot, faceId: faceIdOf(x) });
            x.frozen = false;
            x.onIce = false;
            x.thawed = false;
            return x;
        };

        // **The Mirror reflects: the cube comes out turned around, and the face is left alone.**
        // Reflecting a mirrored cube turns it back — the status is an involution, so a reflection of
        // a reflection is the cube you started with.
        //
        // The face is untouched on purpose. This used to rewrite the art as well — swapping
        // `engine:left` for `engine:right` and turning `dir` over with it — which was wrong twice.
        // Once because the resolver *also* turns a mirrored engine over, so the two flips cancelled
        // and a reflected Sebulba fired the way he always had. And once because a rewritten face
        // only lasts as long as that face does: the next throw picks a fresh one out of the tuning
        // with the original `dir` on it, so even a single flip would have been good for one rung.
        // A reflection is permanent, so it lives on the slot, and the face is just a face.
        const turned = src => born(src, !(src.slot && src.slot.mirrored));

        // **The Binder copies: the cube comes out the same way round, and the face turns over.**
        // The exact opposite arrangement, and for the exact opposite reason. A clone is not a
        // reflection — it makes the cube beside it into *that* cube, and which way round that cube
        // was is part of what is being copied, so the handedness comes across untouched. There is no
        // such thing as a Binder handing you a mirrored cube.
        //
        // What does turn over is art drawn as one of a pair: Sebulba's two engines, Ben's two wings.
        // Those are the only faces in the tuning with a `mirrored` partner named on them, and on a
        // copy the partner is what gets written — a cloned Sebulba faces back at the one he was cut
        // from. `dir` travels with the id so the picture and the shot agree; nothing else on the
        // cube reads it, and it lasts exactly one throw, which is all a copied face ever lasts. The
        // next rung this cube rolls its own face out of its own tuning like everything else.
        const copied = function (src) {
            const x = born(src, !!(src.slot && src.slot.mirrored));
            const f = x.face;
            if (f && f.mirrored) {
                x.face = { ...f, id: f.mirrored, mirrored: f.id };
                if (f.dir) x.face.dir = OTHER_DIR[f.dir];
            }
            // **And the ice comes across too.** A clone is the cube on its left, and a held cube is
            // held — so the copy is on ice in whichever of the two senses the original is: served on
            // it and owing a thaw on its own turn, or frozen this walk and holding a face for the
            // next throw. The held face is the copy's own, read after the flip above, so a cloned
            // frozen Sebulba holds the engine it is actually showing. Only the Binder does this; a
            // reflection still comes out thawed.
            x.frozen = !!src.frozen;
            x.onIce = !!src.onIce;
            x.thawed = !!src.thawed;
            if (src.slot && src.slot.frozen) x.slot.frozen = faceIdOf(x);
            return x;
        };
        const drawOne = function () {
            const id = rest.pop();
            const special = id ? specialById(id) : null;
            const slot = slotOf(id);
            const faces = rollFaces(special, slot);
            const x = settle({
                side: rollSide(),
                special,
                face: special && faces.length ? faces[crypto.randomInt(0, faces.length)] : null,
                slot,
            });
            if (special && x.face) faceLog.push({ id: x.face.from || special.id, key: faceKey(x.face) });
            joined.push(x);
            x.copy = true;
            return giveTurn(x);
        };
        // `mend` is the Scavenger's, and only the Scavenger's. A parole and a hold-break both come
        // through here too, and neither is salvage — a prisoner walking out is the cube it went in as.
        const liftOne = function (from, pick = 'pop', mend = false) {
            const raw = pick === 'shift' ? from.shift() : from.pop();
            // **The slot itself where there is one, never a copy.** The end-of-roll sweep works out
            // what left the table by slot *identity*, so a fresh object here would leave the original
            // looking destroyed while the copy stands — one cube on the table and in the junkyard at
            // once, ready to be scavenged back out a second time.
            const slot = (raw && typeof raw === 'object' && Array.isArray(raw.held)) ? raw : slotOf(raw);
            // **The one thing in the game that undoes permanent damage.** A singe is the only harm a
            // cube cannot walk off — paint can be turned back, ice is not damage, and a spent heat
            // face is how the Turbine pays. So the Jawa hands back one burned face on whatever it
            // drags out of the wreckage, which is never a wasted landing because it only happens when
            // there is something to salvage. Healed before the roll, so the face it gives back is a
            // face this throw can land on.
            const mended = (mend && slot.burned.length) ? slot.burned.pop() : null;
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
            if (x.slot.held.length) made.push({ slot: x.slot, faceId: faceIdOf(x) });
            x.mended = mended;
            x.copy = true;
            return giveTurn(x);
        };
        // Immediately right of the cube **taking the turn**, not of the cube that was holding it: the
        // line resolves strictly left to right, so anything put back behind the walk sits out the roll
        // it was freed into. Anything the actor destroyed in place is stepped over, so a released cube
        // cannot land in the middle of Ben.
        //
        // Anything already handed a turn this pass is stepped over for the same reason: one turn can
        // put several cubes to the right of the actor — a raze takes the cube either side of it and
        // both can be carrying — and each is queued in the order it was made. Splicing every release
        // at the same index stacks them in the reverse of that, so the cubes freed second would sit
        // left of the ones freed first and act after them.
        //
        // **An actor that took itself off the table has no "right of it" to measure from**: the line
        // has closed over the gap and the index it stood at can now be held by a cube that is still
        // waiting. What the walk is really pointing at is the first cube with a turn coming, so that
        // is what is measured instead.
        const releasePoint = function () {
            const here = at(c);
            if (here >= 0) {
                let k = here + 1;
                while (k < final.length && (final[k].gone || handedOut.has(final[k]))) k++;
                return k;
            }
            const waiting = new Set(queue.slice(q + 1));
            const next = x => waiting.has(x) && !handedOut.has(x) && !x.gone && !!x.face && !x.frozen;
            let k = 0;
            while (k < final.length && !next(final[k])) k++;
            return k;
        };

        const spring = function (slot) {
            if (!slot.held.length) return { out: [], at: -1 };
            const out = [];
            while (slot.held.length) out.push(liftOne(slot.held, 'shift'));
            const back = releasePoint();
            final.splice(back, 0, ...out);
            out.forEach(x => freshlyFreed.add(x));
            return { out, at: back };
        };

        // **Turning a chance cube and turning a painted face are two different things**, and the
        // engine used to do the same wrong thing to both.
        //
        // A regular chance cube is *rerolled* onto the other colour: the die itself is untouched, so
        // the turn lasts this throw and the cube comes up 3/3 again next rung. Nothing about a turn
        // should permanently recut a die, and a chance cube is all die.
        //
        // A **painted** face is a different object. The mark is permanent, so moving it is permanent
        // — and moving it rather than clearing it is the fix. `x.paint = null` only cleared the paint
        // *on the throw*; `slot.painted` was never touched, so the mark came back on the next
        // `throwSet` and the cube quietly reverted one rung later. The turn looked like it worked and
        // did not, on every painted cube in the game.
        //
        // Turning a face back to its own colour **removes** the mark rather than writing a second
        // one over it: a red side painted blue and then turned red is just a red side again.
        //
        // **A chance cube is not a special case.** It used to be — its face id did not survive the
        // throw, so there was no key to move its mark under and the turn quietly lasted one rung.
        // `throwSet` keeps the face now, so a painted chance cube repaints exactly like a painted
        // Greed. The only cube that still takes the first branch is one wearing no mark at all,
        // which is the whole of the rule: unpainted is a reroll, painted is a repaint.
        const turnTo = function (x, side) {
            if (!x.paint || !x.face) {
                x.side = side;
                x.paint = null;
                if (x.face && SIDED.has(x.face.kind)) x.face = null;
                return false;
            }
            const id = faceIdOf(x);
            const marks = [...(x.slot.painted || [])];
            const at = marks.indexOf(`${id}|${x.paint}`);
            const own = (x.face && x.face.side) || null;
            if (own === side) {
                if (at >= 0) marks.splice(at, 1);
            } else if (at >= 0) {
                marks[at] = `${id}|${side}`;
            } else {
                marks.push(`${id}|${side}`);
            }
            x.slot.painted = marks;
            x.paint = own === side ? null : side;
            x.side = side;
            return true;
        };

        const shielding = x => !!x && !x.gone && x.face && x.face.kind === 'shield';

        // **The Gungan Shield is a dome, not a wall.** It used to do three unrelated jobs — bound a
        // blast and die absorbing it, bound what a Tusken could see, and hold a neighbour together
        // through a wipeout for free, with a fresh face and a second turn on top. The last of those
        // read as a bug because it was the only ward in the game that cost nothing, and the three
        // together could not be said in one sentence. This can:
        //
        //   **A shield encloses itself and both its neighbours. Nothing crosses the boundary, in or
        //   out. Only a cube inside the dome can destroy the shield.**
        //
        // A bubble rather than a barricade, which is the difference that matters: it protects what is
        // under it and does **not** block passage past it. A Tusken outside can shoot clean over a
        // dome to a position on the far side — it simply cannot reach anything sheltering under one.
        //
        // **It gates what an effect can change, never what it can see.** A reflection may copy a cube
        // that is under a dome, because copying it alters nothing there; what it may not do is write
        // onto a position on the other side of a wall. One rule at every destination, and reads left
        // alone, is what keeps this to a single predicate instead of a second table of exceptions.
        //
        // **Domes that meet fuse into one dome.** Two shields close enough that their covers touch
        // are one boundary, not two nested ones — projectors on the same line reinforcing each other
        // rather than each drawing its own wall through the other's shelter. The spans merge when
        // they overlap *or* sit flush, so a pair of shields covers 4, 5 or 6 seats at 0, 1 and 2
        // cubes apart, and falls back to two separate 3-seat domes at 3 apart. That last step is the
        // rule's whole cost: one more cube between them and the fused dome breaks in half.
        //
        // The old shape asked "which shields cover this seat" and called two seats connected when
        // they shared one. That is the same answer for a lone dome and the wrong one for a pair —
        // with shields two apart the seat between them was under both, but the outermost seats were
        // under one each and read as walled off from each other while standing in the same bubble.
        // Merged spans are the fix and are the thing the client draws, so both ends agree on where
        // a boundary is by agreeing on what a dome is.
        const domeSpans = function () {
            const out = [];
            for (let s = 0; s < final.length; s++) {
                if (!shielding(final[s])) continue;
                const from = Math.max(0, s - 1);
                const to = Math.min(final.length - 1, s + 1);
                const last = out[out.length - 1];
                // `from <= last.to + 1` is touching-or-overlapping; `+ 1` is what fuses the flush
                // pair, since a walk left to right only ever extends the span it is holding.
                if (last && from <= last.to + 1) last.to = Math.max(last.to, to);
                else out.push({ from, to });
            }
            return out;
        };

        // Which dome a seat is under, or -1 for open air. `spans` is for a face that writes several
        // seats in one turn and has to measure every write against the walls it started with.
        const domeAt = function (k, spans = domeSpans()) {
            for (let d = 0; d < spans.length; d++) {
                if (k >= spans[d].from && k <= spans[d].to) return d;
            }
            return -1;
        };

        // Same dome, or open air on both sides — and -1 === -1 says the second of those, so there is
        // one comparison rather than two cases. A position sheltering under a dome the actor is not
        // standing in is unreachable, and so is the whole table seen from inside one.
        const reaches = function (i, j, spans = domeSpans()) {
            if (i === j) return true;
            return domeAt(i, spans) === domeAt(j, spans);
        };

        // **A seat past the tail is behind the wall too.** Appending used to be exempt, so a cube
        // under a dome that ran to the end of the line could grow the line straight out through it
        // — a Mirror inside wrote its copies into open air while one outside was turned away at the
        // same wall. A new seat is a place like any other: it is under the dome of a shield standing
        // last, since it becomes that shield's right-hand neighbour, and in the open otherwise.
        // Only the first new seat can be the shield's neighbour; every one after it is open air.
        const reachesNew = function (i) {
            const tail = final.length - 1;
            return domeAt(i) === (shielding(final[tail]) ? domeAt(tail) : -1);
        };

        // **The ice takes one hit** — anything that would destroy or overwrite a frozen cube shatters
        // the ice instead and the face survives, which is what makes the die's own pairing resolve
        // against itself with no rule of its own. **A mine is not a hit**: the blast is a range rather
        // than a target, and ice that stopped one would be a second Gungan Shield at no cost.
        //
        // **Destruction, heat and the blessing are the only things a frozen face answers to.** A turn
        // or a coat of paint is neither: it bounces off with the ice intact rather than spending it,
        // so those sites test `frozen` and never call this. Spending ice on a Sebulba that changed
        // nothing made the freeze read as a one-roll trinket any neighbour could cash.
        //
        // **All of that is true until the held cube's own turn**, where it melts — so every one of
        // these readings is about a cube standing to the *left* of the ice. See the top of the walk.
        // Fire ends the hold however early it arrives, so `onIce` goes with it: a cube the flames
        // thawed is live again for the rest of this roll and has no thaw left to take a turn over.
        const iced = function (x) {
            if (!x || !x.frozen) return false;
            x.frozen = false;
            x.onIce = false;
            if (x.slot) x.slot.frozen = null;
            return true;
        };

        // Two functions and not one: `holy` is a *look* — the plunge walks the line asking which cubes
        // are protected before it knows which two it is taking, and a look that spent the blessing
        // would burn one off every cube it merely walked past. `spend` is the consuming half.
        //
        // A mine still goes with its own blast — covering that would make this "cannot leave the
        // table" instead of "cannot be destroyed", and would stall the Turbine's schedule. A wipeout
        // is the one piece of self-destruction the blessing does answer, and it answers it by
        // re-rolling the face rather than by standing in the way: see `case 'broken'`.
        const holy = x => !!(x && x.slot && x.slot.blessed);
        const spend = function (x) {
            if (!holy(x)) return false;
            x.slot.blessed = false;
            saves += 1;
            return true;
        };

        // The order matters and is the same everywhere a destroyer meets a protected cube: the ice is
        // consumed first, the blessing second. Returns the note suffix, or null if nothing shielded it
        // — so the ordering lives in one place rather than being restated at each destruction site.
        // **The ice is not a ward, and only fire answers it.** It used to spare a cube from the
        // Mirror, the Binder, the Tusken and Ben as well, which made it a second Malastare handed out
        // by a face that costs nothing — and made the ward table unlearnable, because no two
        // destroyers agreed on what stopped them. A freeze now holds a face and nothing more: what
        // reaches a frozen cube destroys it. Flamejet and Singe still thaw rather than destroy, which
        // is the one reading of ice-meets-fire that is not arbitrary, so `warded` is the burn's alone.
        const warded = x => (iced(x) ? 'iced' : (spend(x) ? 'blessed' : null));
        const blest = x => (spend(x) ? 'blessed' : null);

        switch (c.face.kind) {
            case 'mirror': {
                // **The Mirror is not itself handed.** Reflecting a reflection is a thing this face
                // does to other cubes, not something it can have done to it: a mirrored Mirror that
                // read forwards and wrote backwards would be a second, differently-shaped face
                // wearing the same picture. It reads everything behind it and writes ahead however
                // it is turned. Nearest-first, so `left[k]` is the cube `k + 1` steps back from the
                // one being written.
                const left = final.slice(0, i).reverse();
                if (!left.length) {
                    note(c, 'mirror.nothing');
                    break;
                }
                const room = Math.max(0, config.maxCubes - (i + 1));
                const wanted = Math.min(left.length, room);
                if (wanted < 1) {
                    note(c, 'mirror.noroom');
                    break;
                }
                let copied = 0;
                let made = 0;
                // Blessings only. The ice used to be counted here too, which is why the field is
                // named for the frost — kept because nothing downstream reads it by any other name.
                let froze = 0;
                let walled = 0;
                // **The walls are measured once, before the first write.** Reflecting a Gungan puts
                // a second shield on the table, and measuring after it moved the dome partway
                // through the Mirror's own turn — the same seat could be open for one copy and
                // walled for the next. The line as it stood when the Mirror acted is what it reads,
                // so it is also what it writes against.
                const spans = domeSpans();
                const end = final.length;
                const firstNew = reachesNew(i);
                const pastNew = domeAt(i, spans) === -1;
                for (let k = 0; k < wanted; k++) {
                    const to = i + k + 1;
                    const ok = to < end ? reaches(i, to, spans) : (to === end ? firstNew : pastNew);
                    if (!ok) {
                        walled += 1;
                        // A new seat that cannot be written cannot be stepped over either: every seat
                        // past it would be conjured with a hole in front of it.
                        if (to >= end) break;
                        continue;
                    }
                    if (spend(final[to])) {
                        froze++;
                        continue;
                    }
                    if (to >= final.length) made++;
                    final[to] = enliven(turned(left[k]));
                    copied++;
                }
                for (let k = 0; k < final.length; k++) if (!final[k]) final[k] = plain(rollSide());
                note(c, 'mirror', { copied, made, froze, walled });
                break;
            }
            case 'invert': {
                let repainted = 0;
                final.forEach((x, k) => {
                    if (!isCube(x)) return;
                    if (!reaches(i, k)) return;
                    if (x.frozen) return;
                    if (x.wild || x.face?.kind === 'wild') return;
                    if (turnTo(x, OTHER[x.side])) repainted += 1;
                });
                note(c, 'invert', { repainted });
                break;
            }
            case 'end': {
                const reach = Math.max(0, Number(config.blastReach) || 0);
                const first = Math.max(0, i - reach);
                const last = Math.min(final.length - 1, i + reach);
                // **The blast has a reach, and that is what makes a mine affordable.** Unbounded, the
                // set persists so a cube drawn at Level 2 is thrown four more times and one mine face
                // had a 51.8% chance of ending the run before the top; paying for that needed a cube
                // that multiplied the run by (6/5)^throws — 2.07x — and only the Wild was in that
                // class. Every other carrier measured *below an empty seat*, so the strongest greedy
                // rack held no mine and every mine-facing tool had nothing to point at. `blastReach`
                // makes a mine cost cubes instead of the run.
                //
                // **A dome stops the blast dead at its wall.** It no longer absorbs — there is no
                // shield left standing in the way to absorb anything, because a mine inside a dome
                // takes the shield with everything else, and a mine outside never reaches in. So a
                // shield destroyed here is an ordinary victim: wreckage a Jawa can pull back, rather
                // than a shatter spent for the run.
                const blast = [];
                const walledAt = [];
                for (let k = first; k <= last; k++) {
                    if (k !== i && !reaches(i, k)) { walledAt.push(k); continue; }
                    if (k === i || !spend(final[k])) blast.push(k);
                }
                const spared = (last - first + 1) - blast.length - walledAt.length;
                for (const k of [...blast].reverse()) final.splice(k, 1);

                detonated = c.special ? c.special.name : 'the cube';
                // `walledAt` is what the client pops a "blocked" mark on. It replaced `stopped`,
                // which named the shields the blast was absorbed by — there are none now, because a
                // dome is a boundary rather than a thing in the way. Dropping it silently left
                // `blockedBy` returning nothing and the stop invisible.
                note(c, walledAt.length ? 'end.shielded' : 'end', {
                    destroyed: blast.length,
                    shields: walledAt.length,
                    spared,
                    at: i,
                    from: blast[0],
                    walledAt,
                });
                break;
            }
            // **A wipeout is a cube coming apart where it stands, so no dome has anything to say
            // about it.** Nothing crosses a wall, and nothing here crosses anything. A neighbouring
            // shield used to hold the cube together for free, re-roll its face and hand it a second
            // turn on top — the only ward in the game that cost its owner nothing, and the reason the
            // shield read as three cubes wearing one name. It is gone with `shieldSpan`.
            //
            // **A blessing buys the old save back, and pays for it.** Malastare's ward is the one
            // thing that reaches a cube coming apart under its own weight: the cube stops short of
            // shattering, re-rolls onto a face that is not a wipeout and not a mine, and takes its
            // turn on that face instead. Handed out by a face rather than by a neighbour standing
            // there, spent when it lands, and one per blessing — which is the whole difference from
            // the shield that used to do it. The blessing has to arrive *first*: a cube resolves
            // where it stands in the line, so a Malastare to its right is a blessing that came too
            // late, exactly as it is for every other destroyer.
            //
            // A cube with nothing else to show — every other face burned off — is still held
            // together, because the blessing was spent holding it. Its face re-rolls with the
            // rest of the line on the next throw.
            case 'broken': {
                if (spend(c)) {
                    const pool = rollFaces(c.special, c.slot).filter(f => f && !DOWNSIDE.has(f.kind));
                    const swap = pool.length ? { ...pool[crypto.randomInt(0, pool.length)] } : null;
                    if (!swap) {
                        note(c, 'broken.blessed', { at: i });
                        break;
                    }
                    note(c, 'broken.blessed', { at: i, rolledFaceId: swap.id });
                    c.face = swap;
                    settle(c);
                    giveTurn(c);
                    break;
                }
                broken.push(c.special.id);
                final.splice(i, 1);
                note(c, 'broken', { at: i });
                break;
            }
            case 'burn': {
                const j = i + stepOf(c);
                if (j < 0 || j >= final.length) {
                    note(c, 'burn.nothing');
                    break;
                }
                // **The Binder cannot burn the Binder.** Fire does not burn fire, and the Singe
                // already stepped over both halves of the cube — a Flamejet that refused another
                // Flamejet but happily took an Electrocution made the immunity read as a property of
                // the picture rather than of the cube. It is the cube.
                if (final[j].face && ['burn', 'clone'].includes(final[j].face.kind)) {
                    note(c, 'burn.fireproof', { at: j });
                    break;
                }
                if (!reaches(i, j)) {
                    note(c, 'burn.walled', { at: j, walledAt: [j] });
                    break;
                }
                const burnWard = warded(final[j]);
                if (burnWard) {
                    note(c, `burn.${burnWard}`);
                    break;
                }
                final.splice(j, 1);
                note(c, 'burn', { at: j });
                break;
            }
            case 'clone': {
                // **Not handed, though the Binder's other face is.** Burning is something the cube
                // does in a direction; copying its left onto its right is the whole identity of
                // this face, and a Binder that read right and wrote left would be a different cube
                // rather than the same one seen from behind. Reads left, writes right, always.
                const from = i - 1;
                const to = i + 1;
                const hasLeft = from >= 0 && from < final.length;
                const hasRight = to >= 0 && to < final.length;
                if (!hasLeft && !hasRight) {
                    note(c, 'clone.alone');
                    break;
                }
                if (hasRight ? !reaches(i, to) : (hasLeft && !reachesNew(i))) {
                    note(c, 'clone.walled', { at: to, walledAt: [to] });
                    break;
                }
                if (!hasLeft) {
                    // **The electrocution wards like everything else now.** It was the one
                    // destruction in the game a blessing could not stop, and the exception was an
                    // oversight rather than a rule: every other branch of this same face asked.
                    if (spend(final[to])) {
                        note(c, 'clone.blessed');
                        break;
                    }
                    final.splice(to, 1);
                    note(c, 'clone.destroy', { at: to });
                    break;
                }
                const cloneWard = hasRight ? blest(final[to]) : null;
                if (cloneWard) {
                    note(c, `clone.${cloneWard}`);
                    break;
                }
                const src = final[from];
                const copy = enliven(copied(src));
                if (!hasRight) {
                    if (final.length >= config.maxCubes) {
                        note(c, 'clone.noroom');
                        break;
                    }
                    final.push(copy);
                    note(c, 'clone.append', { srcFaceId: faceIdOf(src) });
                    break;
                }
                final[to] = copy;
                note(c, 'clone', { srcFaceId: faceIdOf(src) });
                break;
            }
            case 'cull': {
                // **A dome no longer blocks the shot, it only shelters what is under it.** The span
                // used to stop at the nearest shield either way, so a Gungan cast a shadow down the
                // whole line behind it; a bubble does not. The Tusken can shoot clean over a dome to
                // a position on the far side, and cannot touch anything sheltering beneath one.
                const others = [];
                for (let k = 0; k < final.length; k++) if (k !== i && reaches(i, k)) others.push(k);
                if (!others.length) {
                    note(c, 'cull.nothing');
                    break;
                }
                const victim = others[crypto.randomInt(0, others.length)];
                const cullWard = blest(final[victim]);
                if (cullWard) {
                    note(c, `cull.${cullWard}`);
                    break;
                }
                const ate = shielding(final[victim]);
                final.splice(victim, 1);
                note(c, ate ? 'cull.shield' : 'cull', { hitAt: [victim] });
                break;
            }
            case 'raze': {
                const left = i - 1 >= 0;
                const right = i + 1 < final.length;
                if (!left && !right) {
                    note(c, 'raze.nothing');
                    break;
                }
                const wings = c.face.wings || {};
                // Whatever Ben is standing in at this moment — the crowd's mark, or an engine that
                // turned him earlier in the walk. Bare unless something painted him, since `raze` is
                // not a side and has no colour of its own.
                const worn = c.side || null;
                const canRight = right && reaches(i, i + 1);
                const canLeft = left && reaches(i, i - 1);
                const tookRight = canRight && !spend(final[i + 1]);
                const tookLeft = canLeft && !spend(final[i - 1]);
                if (tookRight) final[i + 1] = razed(wings.right, wings.left, worn);
                if (tookLeft) final[i - 1] = razed(wings.left, wings.right, worn);
                if (!tookLeft && !tookRight) {
                    note(c, 'raze.blessed');
                    break;
                }
                note(c, 'raze', { both: !!(tookLeft && tookRight) });
                break;
            }
            case 'pair': {
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
                if (!rest.length) {
                    note(c, 'draw.empty');
                    break;
                }
                if (final.length + 1 > config.maxCubes) {
                    note(c, 'draw.noroom');
                    break;
                }
                const before = notes.length;
                const got = drawOne();
                const its = notes.splice(before);
                const seat = stepOf(c) === 1 ? i + 1 : i;
                final.splice(seat, 0, got);
                note(c, 'draw', { faceId: faceIdOf(got), special: !!got.special, at: seat });
                notes.push(...its);
                break;
            }
            case 'scavenge': {
                const up = standingSlots(final);
                const already = new Set(hold);
                for (const w of wrecked) {
                    if (!w || takenIn.has(w)) continue;
                    hold.push(keepSlot(w));
                    takenIn.add(w);
                }
                for (const x of line) {
                    if (!x.slot || up.has(x.slot) || already.has(x.slot) || takenIn.has(x.slot)) continue;
                    hold.push(keepSlot(x.slot));
                    takenIn.add(x.slot);
                }
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
                const before = notes.length;
                const got = liftOne(from, 'pop', true);
                const its = notes.splice(before);
                const seat = stepOf(c) === 1 ? i + 1 : i;
                final.splice(seat, 0, got);
                note(c, 'scavenge', {
                    faceId: faceIdOf(got), special: !!got.special, own: !!own, at: seat,
                    mended: got.mended,
                });
                notes.push(...its);
                break;
            }
            case 'haul': {
                // Handed, like the Binder and the Scavenger: the crawler takes what is in front of
                // it, and turning it over turns it round. A crawler that read right whichever way up
                // it lay was the one mirrored face whose picture pointed somewhere its arm did not.
                const j = i + stepOf(c);
                const target = (j >= 0 && j < final.length) ? final[j] : null;
                if (!target || freshlyFreed.has(target)) {
                    note(c, 'haul.nothing');
                    break;
                }
                if (!reaches(i, j)) {
                    note(c, 'haul.walled', { at: j, walledAt: [j] });
                    break;
                }
                // **Rubble is taken and not kept.** A wing's slot is a bare `plainSlot` — nothing on
                // it says it was ever a wing, because wing-ness lives on the position rather than on
                // the cube. So a wing put into a hold is already laundered: what comes back out on a
                // parole or a hold-break is an ordinary cube nobody owned. The crawler still clears
                // the position, and gets nothing for it.
                if (target.gone) {
                    final.splice(j, 1);
                    note(c, 'haul.rubble', { faceId: faceIdOf(target), at: j });
                    break;
                }
                const mine = c.slot || (c.slot = plainSlot());
                mine.held.push(target.slot || plainSlot());
                final.splice(j, 1);
                note(c, 'haul', {
                    faceId: faceIdOf(target), special: !!target.special, at: j,
                    held: mine.held.length,
                });
                break;
            }
            case 'purge': {
                const doomed = [];
                for (let k = 0; k < final.length; k++) {
                    const x = final[k];
                    if (k !== i && !reaches(i, k)) continue;
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
                note(c, 'purge', { destroyed: doomed.length, hitAt: doomed });
                break;
            }
            case 'engine': {
                // A mirrored Sebulba points the other way, and the note reports the direction the
                // engine actually fired in rather than the one painted on the face.
                const dir = flipped(c) ? OTHER_DIR[c.face.dir] : c.face.dir;
                const j = dir === 'left' ? i - 1 : i + 1;
                const target = final[j];
                if (target && !reaches(i, j)) {
                    note(c, 'engine.walled', { dir, at: j, walledAt: [j] });
                    break;
                }
                if (!isCube(target)) {
                    note(c, 'engine.nothing', { dir });
                    break;
                }
                if (target.side === call) {
                    note(c, 'engine.already', { dir, side: call });
                    break;
                }
                if (target.frozen) {
                    note(c, 'engine.iced', { dir });
                    break;
                }
                const repainted = turnTo(target, call);
                note(c, 'engine', { dir, side: call, repainted });
                break;
            }
            case 'freeze': {
                // **A wing is a legal target for everything.** Six faces used to step over a
                // flattened position, which made Ben's rubble selectively invisible — and the
                // selection was arbitrary, since a mine, a Tusken and Order 66 all hit one happily.
                // A landing spent on a wing is wasted, because the wing is discarded before the next
                // throw either way, and that is the point: Ben is now a decoy that soaks effects.
                const targets = [i - 1, i + 1]
                    .filter(j => j >= 0 && j < final.length && final[j] && reaches(i, j));
                if (!targets.length) {
                    note(c, 'freeze.nothing');
                    break;
                }
                const iced = [];
                // **Fire does not freeze.** A Flamejet or a Baroonda showing is the one face the ice
                // cannot take — the same fire that thaws a held cube early cannot be held itself. By
                // face and not by cube: the freeze holds the face that is up, and a Binder showing its
                // clone has nothing burning on it.
                const immuneAt = [];
                for (const j of targets) {
                    const x = final[j];
                    if (x.frozen || !x.slot) continue;
                    if (x.face && FIREPROOF_ICE.has(x.face.kind)) { immuneAt.push(j); continue; }
                    x.slot.frozen = faceIdOf(x);
                    x.frozen = true;
                    iced.push(j);
                }
                const kind = iced.length ? 'freeze' : (immuneAt.length ? 'freeze.immune' : 'freeze.already');
                note(c, kind,
                    { frozen: iced.length, both: iced.length > 1, at: i, hitAt: iced, immuneAt });
                break;
            }
            case 'scorch': {
                const targets = [i - 1, i + 1]
                    .filter(j => j >= 0 && j < final.length && final[j] && reaches(i, j));
                if (!targets.length) {
                    note(c, 'scorch.nothing');
                    break;
                }
                const burned = [];
                // **Which position, not just how many.** A Singe takes one neighbour or both, and a
                // count cannot tell two identical cubes apart — the client had to diff the state
                // arrays to work out which Greed lost a face. Positions are the only handle a cube
                // has on the wire, so an effect that hits one has to say which.
                const singed = [];
                // **A singe that was turned away says so, like every other destroyer.** This was the
                // one effect in the game that swallowed a ward in silence: ice, a blessing and a cube
                // down to its last face each made it `continue`, and the note that came out named only
                // the positions that *did* burn. Every other destroyer suffixes its note — `cull.iced`,
                // `raze.blessed`, `clone.blessed`, `engine.iced` — so the fire was alone in spending a
                // blessing and reporting nothing.
                //
                // **It reads worst on a Gungan, which is why it surfaced there.** The shield is the
                // only cube whose face does a job without being rolled for, so it is the only one a
                // partial destroyer can switch *off*: singe it and the dome drops for the rest of the
                // rung. Singe a *frozen* one and the ice eats the fire, the cube is not charred, and
                // the dome stands — correct by the ward table and indistinguishable on screen from the
                // dome having ignored the fire, because nothing said the ice was spent. Reported as a
                // pair of parallel lists, the same shape `singed`/`burned` already use.
                const sparedAt = [];
                const spared = [];
                const bounce = function (j, why) { sparedAt.push(j); spared.push(why); };
                for (const j of targets) {
                    const x = final[j];
                    // **A face already burnt out has nothing left to burn.** The fire takes the face a
                    // cube is standing on, and a charred cube is standing on one it took before — so
                    // a second fire took another copy off the cube, one it was not showing. A copied
                    // Baroonda beside a copied charred cube is where that comes up: every Mirror that
                    // reflects a singe reflects the Baroonda that did it.
                    if (x.charred) continue;
                    // **The whole Binder is fireproof, not just the Flamejet.** Half the cube being
                    // immune and the other half not made the immunity read as a bug on the face it
                    // did not cover; the cube is one object and answers as one.
                    if (x.face && (x.face.kind === 'burn' || x.face.kind === 'clone')) { bounce(j, 'fireproof'); continue; }
                    if (iced(x)) { bounce(j, 'iced'); continue; }
                    if (!x.slot) continue;
                    // The blessing answers the fire. It is not destruction — the cube stands — but it
                    // takes a face off for the rest of the climb, which is the only other permanent
                    // harm in the game, and a ward that ignored it was a ward with a hole in it.
                    if (spend(x)) { bounce(j, 'blessed'); continue; }
                    if (x.slot.frozen) { x.slot.frozen = null; bounce(j, 'iced'); continue; }
                    // **There is no floor.** A fire used to stop at the last face — `minFaces` — and
                    // spare a worn cube for no reason a player could learn: it was a tuning dial worn
                    // as a ward, and the only thing on the table that stopped a destroyer without
                    // being spent. The last face burns like the first, and what is left standing is a
                    // blank: it rolls nothing, shows nothing, sides with nobody, and takes no turn.
                    // It is not wreckage, so a Jawa cannot drag it out of the junkyard — but it is
                    // still a cube in a seat, and the Scavenger hands a burned face back to whatever
                    // it lifts, which is the one way a blank comes back.
                    const id = faceIdOf(x);
                    x.slot.burned = [...x.slot.burned, id];
                    burned.push(id);
                    singed.push(j);
                    // Dead where it stands, not only gone from the cube: without the second half a
                    // Ratts charred by Baroonda would still detonate, and the fire would change a
                    // cube's odds and nothing you can see.
                    charFace(x, id);
                }
                if (!burned.length) {
                    // **`scorch.nothing` is for a fire that found nothing, not one that was put out.**
                    // A blessing spent with "nothing happened" on the wire is the misreport this whole
                    // branch exists to stop.
                    if (sparedAt.length) note(c, 'scorch.spared', { at: i, sparedAt, spared });
                    else note(c, 'scorch.nothing');
                    break;
                }
                note(c, 'scorch', {
                    burned, both: burned.length > 1, at: i, hitAt: singed, sparedAt, spared,
                });
                break;
            }
            case 'vault':
                // A second vault on the same rung does not re-seal the door the first one shut, it
                // swings it across — so an even number of them seals the side you did *not* call and
                // forces the repeat the rule normally forbids.
                sealed = sealed === null ? call : OTHER[sealed];
                note(c, 'vault', { side: sealed, moved: sealed !== call });
                break;
            case 'jail': {
                const room = Math.max(0, config.jailSize - (c.slot ? c.slot.held.length : 0));
                // **A cell cannot re-arrest what it let out this rung.** The prisoner stands in the
                // line from the throw now, so without this the warrant can land on the very cube this
                // same die paroled a moment ago — a sentence served and reimposed inside one roll,
                // which reads as the parole never having happened. The cell it walked out of is the
                // only one that owes it that much: any other prison on the table is one it has not
                // served in, and to everything else in the game a freed cube is an ordinary cube.
                const pool = final
                    .map((_, j) => j)
                    .filter(j => j !== i && final[j] && final[j].slot
                        && reaches(i, j) && !freshlyFreed.has(final[j])
                        && walkedOut.get(final[j]) !== c.slot);
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
                // **An arrest can come up holding rubble**, and rubble does not go in a cell — see
                // the crawler above for why a wing in a hold is a cube nobody owned. The warrant is
                // spent either way: a wing takes one of the four and gives the cell nothing back, so
                // a prison that lands beside a wide Ben arrests less than it looks like it did.
                let scrapped = 0;
                for (const j of taking) {
                    if (final[j].gone) scrapped += 1;
                    else cell.held.push(final[j].slot);
                }
                for (const j of [...taking].reverse()) final.splice(j, 1);
                note(c, 'jail', {
                    taken: taking.length - scrapped,
                    scrapped,
                    at: i,
                    held: cell.held.length,
                    hitAt: taking,
                });
                break;
            }
            case 'plunge': {
                // A blessed cube holds and the ledge crumbles past it — the chasm takes the far end
                // of each walk instead, and **the blessing that turned the walk aside is spent doing
                // it**. It used to be read and not taken: `holy` is a look, so a Malastare could turn
                // both walks every rung of the climb and never run out. A ward that costs nothing is
                // not a ward, and this was the only one on the table.
                //
                // **The cube that threw it always falls**, blessed or not — a plunge that spared
                // itself would take away the die's only self-destruct, which is the jailbreak and the
                // release for Malastare's lock. So the two walks always meet at worst on the thrower,
                // and a chasm with nothing else to take **takes only itself**: one position, not two.
                // Two used to be the rule, for parity — an even number of cubes leaving keeps the die
                // from manufacturing ties — but paying for that with a chasm that opened and swallowed
                // nothing made the lone plunge read as a dud face rather than as a cube going over
                // the edge. Parity is worth less than the face doing what its picture says.
                const edge = function (from, step) {
                    for (let k = from; k >= 0 && k < final.length; k += step) {
                        if (k === i) return k;
                        if (!holy(final[k]) && reaches(i, k)) return k;
                    }
                    return -1;
                };
                const head = edge(0, 1);
                const tail = edge(final.length - 1, -1);
                // Both walks pass through `i` and stop there at the latest, so neither can come back
                // empty while the thrower is standing in the line.
                if (head < 0 || tail < 0) {
                    note(c, 'plunge.nothing');
                    break;
                }
                for (let k = 0; k < head; k += 1) if (reaches(i, k)) spend(final[k]);
                for (let k = final.length - 1; k > tail; k -= 1) if (reaches(i, k)) spend(final[k]);
                const ends = head === tail ? [head] : [head, tail];
                const selfless = !ends.includes(i);
                for (const k of [...ends].reverse()) final.splice(k, 1);
                note(c, 'plunge', { destroyed: ends.length, self: !selfless, at: ends });
                break;
            }
            case 'crowd': {
                const ahead = { blue: 0, red: 0 };
                // Coloured wings are in the count for the same reason they are in the majority — the
                // leader the crowd runs to is what the line actually looks like.
                for (const x of final) if (x && ahead[x.side] != null) ahead[x.side] += 1;
                const side = ahead.blue > ahead.red ? 'blue' : ahead.red > ahead.blue ? 'red' : call;
                const hit = [];
                for (const j of [i - 1, i + 1]) {
                    const x = final[j];
                    if (!x || !x.slot) continue;
                    if (!reaches(i, j)) continue;
                    if (x.frozen) continue;
                    // **A wild cannot hold paint**, so painting one spends half a landing on a mark
                    // that will never be read: `settle` puts a wild back to the call every throw, by
                    // the rule that makes it a wild at all. Passed over rather than painted, the same
                    // way a face already counting for the leader is — the crowd has two paints and
                    // both of them should land somewhere they can still be seen next rung.
                    if (x.face && x.face.kind === 'wild') continue;
                    if (x.side === side) continue;
                    // **Through `faceIdOf`, not `x.face.id`.** A plain cube carries no face object at
                    // all, so reading the id off one skipped every ordinary cube on the table — most
                    // of them, and the whole point of the face. Taken before the side changes, or the
                    // mark names the colour it is becoming.
                    const id = faceIdOf(x);
                    if (!id) continue;
                    x.slot.painted = [...(x.slot.painted || []), `${id}|${side}`];
                    x.paint = side;
                    x.side = side;
                    hit.push(j);
                }
                if (!hit.length) {
                    note(c, 'crowd.nothing');
                    break;
                }
                note(c, 'crowd', {
                    side, painted: hit.length, both: hit.length > 1, at: i, hitAt: hit,
                });
                break;
            }
            case 'blessing': {
                const pool = [];
                for (let j = 0; j < final.length; j += 1) {
                    const x = final[j];
                    if (x !== c && x.slot && !x.slot.blessed && reaches(i, j)) pool.push(j);
                }
                if (!pool.length) {
                    note(c, 'blessing.nothing');
                    break;
                }
                const where = pool[crypto.randomInt(0, pool.length)];
                const lucky = final[where];
                lucky.slot.blessed = true;
                note(c, 'blessing', {
                    faceId: faceIdOf(lucky), special: !!lucky.special, at: i, hitAt: [where],
                });
                break;
            }
            default:
                break;
        }

        const now = final.map(faceIdOf);
        const st = lineState(final);
        const marks = keyOf(st);
        const changed = now.length !== was.length
            || now.some((e, k) => e !== was[k])
            || marks !== wasMarks
            || sealed !== wasSealed;
        if (changed || notes.length > noteAt) {
            const step = {
                faceIds: now, note: notes[noteAt] || null, at: at(c), ...st,
            };
            // **A turn that changed nothing is not the same as no turn.** Only changed lines used to
            // get a step, so a Binder with nothing to burn or a Mirror with no room took its turn and
            // vanished from the playback — worst on exactly the cubes most likely to hit it, since a
            // Mirror writes onto the tail where there is nothing to the right. A hint, not a filter.
            if (!changed) step.quiet = true;
            steps.push(step);
        }

        // **Destroying a captor frees its prisoners.** Checked here rather than at each destruction
        // site for the reason the wreckage is swept in one place: there are a dozen ways off the line
        // and none of them should have to know a hold exists. What left is what was standing when the
        // turn began and isn't now — a *captured* cube is not that, at any depth.
        if (stood.some(x => x.slot.held.length) || made.length) {
            const standing = standingSlots(final);
            for (const { slot, faceId } of [...stood, ...made]) {
                if (!slot.held.length || standing.has(slot)) continue;
                const sp = slot.id ? specialById(slot.id) : null;
                const from = notes.length;
                const { out: freed, at: back } = spring(slot);
                const theirs = notes.splice(from);
                notes.push({
                    kind: 'hold.break',
                    faceId,
                    specialId: sp ? sp.id : null,
                    specialName: sp ? sp.name : null,
                    freed: freed.length,
                    at: back,
                });
                notes.push(...theirs);
                steps.push({
                    faceIds: final.map(faceIdOf),
                    note: notes[from],
                    at: -1,
                    ...lineState(final),
                });
            }
        }

        if (overflow) {
            notes.push({
                kind: 'overflow', faceId: null, specialId: null, specialName: null, spawned,
            });
            break;
        }
    }

    // **Everything pays off the resolved line: what is not on the table does not pay.** A Multiplier
    // a Tusken culled or a Greed Ben razed is a payout from beyond the grave; the other way round, a
    // paying face the Mirror reflected pays twice, because there really are two on the table. Greed
    // was the last to move here, and scoring it in pass one is what let Ben lie across a Greed Cube
    // and leave the multiple standing on nothing.
    //
    // **A frozen face pays.** It used to be skipped here alongside the `gone` positions, which put
    // the ice on both sides of one rule at once: a frozen cube still counted for its colour, still
    // took its place in the line, and then silently paid nothing — so Ando Prime landing beside a
    // Greed read as a cube quietly eating the multiple. Ice suspends the **turn**, not the cube.
    const mults = [];
    for (const c of final) {
        if (c.gone || !c.face) continue;
        switch (c.face.kind) {
            case 'greed':
                mult += config.greedBonus;
                pay(c, 'greed', null, config.greedBonus);
                break;
            case 'seam': {
                const earned = config.seamBonus * rungs;
                mult += earned;
                pay(c, 'seam', null, earned, rungs);
                break;
            }
            case 'boost': {
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
                const spent = (c.slot.heat || 0) + 1;
                const earned = config.heatBonus * spent;
                mult += earned;
                pay(c, 'heat', null, earned, spent);
                // **The ice holds the face against its own schedule.** Heat is the one paying face
                // that spends itself as it pays, so a frozen Turbine that advanced would both erase
                // the face and hold it. The freeze wins: it pays this step again next rung, which is
                // what "the ice holds the face you are looking at" has to mean to stay true.
                //
                // `thawed` and not `frozen`, because the hold is over by the time the payout runs —
                // the cube melted on its own turn. What the schedule answers to is the throw the
                // face was held *through*, and that is the only mark of it left down here. A cube
                // the flames thawed is not held: it was live for most of the roll and advances.
                if (!c.frozen && !c.thawed) c.slot.heat = spent;
                break;
            }
            case 'guide': {
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

    const cubes = final.filter(isCube);

    if (detonated && !final.length) ended = detonated;
    const blue = cubes.filter(c => c.side === 'blue').length;
    const red = cubes.length - blue;
    const majority = blue > red ? 'blue' : red > blue ? 'red' : null;
    // **Every position has to be a cube**, not merely every counted one — otherwise a rack of effect
    // cubes farms pures off a shortened count while still being paid at the level's nominal tier.
    const swept = final.length >= 3 && cubes.length === final.length
        && (blue === final.length || red === final.length);
    const pure = swept && majority === call;

    // **A multiple, not a pot.** The pure used to pay a share of a jar however little had been risked
    // to reach it, which is the Pure Cube exploit exactly; a multiple rides the standing, so minimum
    // stake gains nothing. Per cube, because that is what a pure is scarce in — sweeping three is a
    // coin flip twice over, sweeping nine is one line in 256 — and self-limiting for the same reason.
    if (pure) {
        const bonus = cubes.length * config.pureBonus;
        mult += bonus;
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

    const standing = standingSlots(final);
    // **The hold takes everything the roll took**, swept once here rather than at nine destruction
    // sites: a slot is an object, so what left the table is exactly the slots that came in and are not
    // standing — which no destroyer has to know about and no path added later can forget. Read off the
    // line **as thrown**, or a cube a Mirror conjured and a Tusken ate would fill the junkyard with
    // cubes nobody owned. A **captured** cube is not wreckage at any depth, or it would be inside its
    // captor and in the junkyard at once. `takenIn` is the other half: a Jawa sweeps this roll's
    // wreckage in early, and what goes into the hold is a copy, so identity is all the two can compare.
    const carried = new Set(hold);
    for (const c of [...line, ...joined]) {
        if (!c.slot || standing.has(c.slot) || carried.has(c.slot) || takenIn.has(c.slot)) continue;
        carried.add(c.slot);
        hold.push(keepSlot(c.slot));
    }

    const slotFor = function (c) {
        const id = c.special ? c.special.id : null;
        const s = c.slot || plainSlot();
        return id === s.id ? s : { ...plainSlot(), id };
    };

    return {
        // **Three lengths that intentionally disagree.** `cubes` is only the sides that counted, so it
        // is shorter than the line whenever an effect landed; `faceIds` is every position; `set` drops
        // `gone` positions, which are drawn on this line but off the table next level. Anything
        // indexing one against another is wrong.
        cubes: cubes.map(c => c.side),
        faceIds: final.map(faceIdOf),
        ...lineState(final),
        set: final.filter(c => !c.gone).map(slotFor),
        majority,
        pure,
        swept,
        sealed,
        held: final.reduce((n, c) => n + (c.gone || !c.slot ? 0 : countHeld(c.slot.held)), 0),
        hold,
        recovered,
        mult,
        mults,
        pays: payWalk,
        shortcuts,
        rerolls,
        broken,
        ended,
        overflow: overflow ? spawned : 0,
        bag: rest,
        notes,
        steps,
        faceLog,
        // The throw itself, read before anything resolved — see the snapshot above.
        rolled,
        rolledState,
        // Seats in that thrown line that walked out of a cell rather than out of the bag. The only
        // trace a parole leaves on the reveal: the board pops a label over these as the line lands.
        paroled,
        specials: line.filter(c => c.special).map(c => c.special.id),
    };
};
exports.resolveLine = resolveLine;

exports.SIDES = SIDES;
exports.LEVELS = LEVELS;
exports.SPECIALS = SPECIALS;
exports.config = config;
