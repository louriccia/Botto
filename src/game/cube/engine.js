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

const pickWith = function (parent, want, from, faceId) {
    const pool = from || Array.from({ length: parent.faces.length }, (_, i) => i);
    const hits = pool.filter(i => parent.faces[i].id === faceId);
    if (!hits.length || want < 1) return pickIdx(parent.faces.length, want, from);
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

// What the press *routinely* produces, which is not the whole space: `weldPurity` confines all but
// ~1% of presses to welds carrying a downside, so the clean ones come off the total before
// `rememberWeld` floors against it. Flooring against the whole space let the memory exclude the only
// weld a pairing could produce, and the roll repeated inside its own memory.
exports.weldDrawSpace = ids => spaceOf(ids, true);

exports.rollWeld = function (ids, {
    seen = [], tier = 1, major = null, keep = null,
} = {}) {
    if (!Array.isArray(ids) || ids.length < 2) return null;
    if (new Set(ids).size !== ids.length) return null;
    const parents = ids.map(baseById);
    if (parents.some(p => !p || p.noWeld)) return null;
    if (!cutsFor(ids.length, tier).length) return null;

    const block = new Set(seen);

    const anyDownside = parents.some(p => p.faces.some(f => DOWNSIDE.has(f.kind)));
    // **Rolled once for the press, not once per attempt** — sixty attempts each at 1% would let the
    // rare case through about half the time. When it fires the draw is *confined* to the good faces,
    // so `weldPurity` is the rate a clean weld appears; merely lifting the constraint would make the
    // real rate `weldPurity × P(clean by chance)` — 0.25% for Greed+Wild against 0.04% for Mult+Boost.
    let pure = anyDownside && chance(config.weldPurity);
    const goodIdx = parents.map(p => p.faces
        .map((f, i) => (DOWNSIDE.has(f.kind) ? -1 : i))
        .filter(i => i >= 0));

    let last = null;
    for (let attempt = 0; attempt < 60; attempt++) {
        const take = rollSplit(ids.length, tier);
        if (!take) return null;
        const order = orderFor(parents.length, major);
        const picks = parents.map((p, k) => {
            const want = Math.min(take[order[k]] ?? take[take.length - 1], p.faces.length);
            const from = pure && goodIdx[k].length >= want ? goodIdx[k] : null;
            const anchor = keep && keep.parent === k ? keep.faceId : null;
            return {
                id: p.id,
                idx: anchor
                    ? pickWith(p, want, from, anchor)
                    : pickIdx(p.faces.length, want, from),
            };
        });
        const keeps = picks.some((pk, k) => pk.idx.some(i => DOWNSIDE.has(parents[k].faces[i].kind)));
        last = weldId(picks);
        if (block.has(last)) {
            // The memory can decline the jackpot: a pure draw is confined to the good faces, so it
            // produces the *same* clean weld every attempt. Offered once, then the press cuts normally.
            pure = false;
            continue;
        }
        if (anyDownside && !pure && !keeps) continue;
        return last;
    }
    return last;
};

const JAILERS = new Set(
    SPECIALS.filter(sp => (sp.faces || []).some(f => f && f.kind === 'jail')).map(sp => sp.id),
);
exports.JAILERS = JAILERS;

const HOISTED = new Set(['blessing']);
exports.HOISTED = HOISTED;

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

const slotOf = function (v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        return {
            id: v.id ? String(v.id) : null,
            burned: Object.values(v.burned || {}).map(String),
            painted: Object.values(v.painted || {}).map(String),
            frozen: v.frozen ? String(v.frozen) : null,
            heat: Number(v.heat) || 0,
            blessed: !!v.blessed,
            held: Object.values(v.held || {}).map(slotOf),
        };
    }
    return {
        id: v ? String(v) : null,
        burned: [], painted: [], frozen: null, heat: 0, blessed: false, held: [],
    };
};
exports.slotOf = slotOf;

const plainSlot = () => ({
    id: null, burned: [], painted: [], frozen: null, heat: 0, blessed: false, held: [],
});
exports.plainSlot = plainSlot;

const countHeld = function (slots) {
    return (slots || []).reduce((n, s) => n + 1 + countHeld(s && s.held), 0);
};
exports.countHeld = countHeld;

const cloneHeld = slots => (slots || []).map(s => ({ ...s, held: cloneHeld(s.held) }));
exports.cloneHeld = cloneHeld;

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
        return side ? { side, special: null, face: null } : null;
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
        if (slot.held.length) out.held = slot.held.map(one);
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
exports.throwSet = function (set) {
    return shuffle((set || []).map(slotOf)).map((slot) => {
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
            if (!slot.burned.length && !slot.painted.length) {
                return { side: rollSide(), special: null, face: null, slot };
            }
            const face = faces[crypto.randomInt(0, faces.length)];
            const paint = paintOn(faces, slot.painted, face);
            return { side: paint || face.side || null, special: null, face: null, slot, paint };
        }
        const face = faces.length ? faces[crypto.randomInt(0, faces.length)] : null;
        return {
            side: rollSide(),
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

exports.splitAt = function (line, at) {
    if (!exports.canSplitAt(line, at)) return null;
    const parents = exports.weldParents(line[at].slot.id);
    return exports.throwSet(parents.map(id => ({ ...plainSlot(), id })));
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

// **Only propositions the rack can actually produce.** Four measure a flat 0.0% without a specific
// cube in the bag, and a bet that cannot be won is not a long shot, it is a trap.
//
// **`spoiled` is what a look has already answered.** Every price is derived blind, so a card offered
// to somebody who has seen a face that settles it is not mispriced by a little — a premonition showing
// Sebulba turns `engine` from a 4.8% long shot into a near-certain +20. Re-chalking rather than
// refusing is what lets the two abilities be played in either order. Off `spoils` and not `needs`,
// which differ only for `saved`. Known and left standing: a growth face means a longer line and so
// lifts every per-cube effect at once — a look showing `draw` takes `broken` from 28.7% to 32.9%.
// Spoiling the whole book on growth is worse than the leak; it empties the book on the one rack that
// plays for line length.
exports.drawBook = function (equipped, spoiled) {
    const kinds = new Set();
    for (const id of equipped || []) {
        const sp = specialById(id);
        for (const f of (sp && sp.faces) || []) kinds.add(f.kind);
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

// **The ante comes back inside the payout.** `cubeSideBet.js` derives every `price` as `1/p - 1`,
// the **net** return on a one-unit stake — so a card pays `price + betAnte`. Paying only `price`
// charged the stake and never returned it, a second house edge of a further `p` per card on top of
// the ~15% the prices already shave. The card still advertises `price`, because net is how odds quote.
exports.betPaid = function (id, res) {
    const bet = id ? SIDE_BETS.find(b => b.id === id) : null;
    if (!bet || !res) return 0;
    return bet.hit(res) ? bet.price + config.betAnte : 0;
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
    frozen: (line || []).map(c => !!(c && c.frozen)),
    burned: (line || []).map(c => ((c && c.slot && c.slot.burned) ? [...c.slot.burned] : [])),
    charred: (line || []).map(c => !!(c && c.charred)),
    blessed: (line || []).map(c => !!(c && c.slot && c.slot.blessed)),
    painted: (line || []).map(c => ((c && c.paint) ? c.paint : null)),
    cubeIds: (line || []).map(c => ((c && c.special) ? c.special.id : null)),
    holds: (line || []).map(c => ((c && c.slot) ? countHeld(c.slot.held) : 0)),
});
exports.lineState = lineState;

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
                note(c, 'wild', { side: call });
                break;
            case 'side':
                c.side = c.face.side;
                note(c, 'side', { side: c.face.side });
                break;
            case 'greed':
                note(c, 'greed', { bonus: config.greedBonus });
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

    for (const c of line) settle(c);

    let final = line.slice();
    const plain = side => ({ side, special: null, face: null, slot: plainSlot() });
    const at = c => final.indexOf(c);
    const isCube = c => !!c && !!c.side;
    const ours = x => !!x && !x.gone && x.side === call;
    const guideRun = function (idx) {
        if (idx < 0) return 0;
        let n = 0;
        for (let k = idx - 1; k >= 0 && ours(final[k]); k--) n += 1;
        for (let k = idx + 1; k < final.length && ours(final[k]); k++) n += 1;
        return n;
    };
    const razed = (id, mirrored) => ({
        side: null, special: null, gone: true, slot: plainSlot(),
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
    // `HOISTED` faces go to the head: a blessing has to be in force for the whole rung or it protects
    // only whatever was destroyed after it came up, which is a rule about where it landed rather than
    // about the cube. Thrown line only — one that arrives mid-pass takes its turn where it is spliced.
    const queue = [];
    const inTurn = [];
    for (const c of line) ((c.face && HOISTED.has(c.face.kind)) ? queue : inTurn).push(c);
    for (const c of inTurn) queue.push(c);

    let spawned = 0;
    let overflow = false;

    for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        if (!c.face) continue;
        if (c.frozen) continue;
        const i = at(c);
        if (i < 0) continue;
        const stood = final.filter(x => !x.gone && x.slot).map(x => ({ slot: x.slot, faceId: faceIdOf(x) }));
        const made = [];
        const freshlyFreed = new Set();
        let was = final.map(faceIdOf);
        let wasMarks = stateKey(final);
        let noteAt = notes.length;

        let handed = 0;
        const giveTurn = (x) => {
            queue.splice(q + 1 + handed, 0, x);
            handed += 1;
            spawned += 1;
            if (spawned >= config.overflowAt) overflow = true;
            return x;
        };

        const enliven = function (x) {
            x.copy = true;
            return giveTurn(x);
        };
        // A copy inherits the scorch marks and the prisoners (deep-copied, or cracking one hold would
        // empty both) and **never the ice**, which is a property of the original Ando Prime froze.
        // Art with a handedness turns around, `dir` included — a reflected engine still pointing the
        // way its original pointed would aim from the far side of the mirror.
        const turned = function (src) {
            const x = { ...src, copy: false };
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
        const liftOne = function (from, pick = 'pop') {
            const raw = pick === 'shift' ? from.shift() : from.pop();
            // **The slot itself where there is one, never a copy.** The end-of-roll sweep works out
            // what left the table by slot *identity*, so a fresh object here would leave the original
            // looking destroyed while the copy stands — one cube on the table and in the junkyard at
            // once, ready to be scavenged back out a second time.
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
            if (x.slot.held.length) made.push({ slot: x.slot, faceId: faceIdOf(x) });
            x.copy = true;
            return giveTurn(x);
        };
        // Immediately right of the cube **taking the turn**, not of the cube that was holding it: the
        // line resolves strictly left to right, so anything put back behind the walk sits out the roll
        // it was freed into. Anything the actor destroyed in place is stepped over, so a released cube
        // cannot land in the middle of Ben.
        const releasePoint = function () {
            let k = at(c);
            if (k < 0) return Math.min(Math.max(i, 0), final.length);
            k += 1;
            while (k < final.length && final[k].gone) k++;
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

        const shielding = x => !!x && !x.gone && x.face && x.face.kind === 'shield';

        const shieldSpan = function (i, reach = Infinity) {
            const stopped = [];
            let first = Math.max(0, i - reach);
            let last = Math.min(final.length - 1, i + reach);
            for (let k = i - 1; k >= first; k--) if (shielding(final[k])) { first = k; stopped.push(k); break; }
            for (let k = i + 1; k <= last; k++) if (shielding(final[k])) { last = k; stopped.push(k); break; }
            return { first, last, stopped };
        };

        // **The ice takes one hit** — anything that would destroy, overwrite or switch a frozen cube
        // shatters the ice instead and the face survives, which is what makes the die's own pairing
        // resolve against itself with no rule of its own. **A mine is not a hit**: the blast is a range
        // rather than a target, and ice that stopped one would be a second Gungan Shield at no cost.
        const iced = function (x) {
            if (!x || !x.frozen) return false;
            x.frozen = false;
            if (x.slot) x.slot.frozen = null;
            return true;
        };

        // Two functions and not one: `holy` is a *look* — the plunge walks the line asking which cubes
        // are protected before it knows which two it is taking, and a look that spent the blessing
        // would burn one off every cube it merely walked past. `spend` is the consuming half.
        //
        // It does not stop a cube destroying itself. A wipeout is the cube coming apart and a mine
        // goes with its own blast; covering those would make this "cannot leave the table" instead of
        // "cannot be destroyed", and would stall the Turbine's schedule.
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
        const warded = x => (iced(x) ? 'iced' : (spend(x) ? 'blessed' : null));

        const OFF_TABLE = new Set(['broken', 'end']);
        const refaced = function (c) {
            const pool = c.special ? c.special.faces.filter(f => f && !OFF_TABLE.has(f.kind)) : [];
            return pool.length ? { ...pool[crypto.randomInt(0, pool.length)] } : null;
        };

        if (c.slot && c.slot.held.length && c.special && JAILERS.has(c.special.id)) {
            const before = notes.length;
            const out = liftOne(c.slot.held, 'shift');
            const its = notes.splice(before);
            const back = releasePoint();
            final.splice(back, 0, out);
            freshlyFreed.add(out);
            note(c, 'parole', { faceId: faceIdOf(out), left: c.slot.held.length, at: back });
            notes.push(...its);
            const after = final.map(faceIdOf);
            const parole = lineState(final);
            steps.push({
                faceIds: after, note: notes[noteAt] || null, at: at(c), ...parole,
            });
            was = after;
            wasMarks = keyOf(parole);
            noteAt = notes.length;
        }

        switch (c.face.kind) {
            case 'mirror': {
                const left = final.slice(0, i).reverse();
                if (!left.length) {
                    note(c, 'mirror.nothing');
                    break;
                }
                const wanted = Math.min(left.length, Math.max(0, config.maxCubes - (i + 1)));
                if (wanted < 1) {
                    note(c, 'mirror.noroom');
                    break;
                }
                let copied = 0;
                let made = 0;
                let froze = 0;
                for (let k = 0; k < wanted; k++) {
                    const to = i + 1 + k;
                    if (iced(final[to])) {
                        froze++;
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
                note(c, 'mirror', { copied, made, froze });
                break;
            }
            case 'invert':
                final.forEach((x) => {
                    if (!isCube(x)) return;
                    if (x.wild || x.face?.kind === 'wild') return;
                    x.side = OTHER[x.side];
                    if (x.face && SIDED.has(x.face.kind)) x.face = null;
                });
                note(c, 'invert');
                break;
            case 'end': {
                const reach = Math.max(0, Number(config.blastReach) || 0);
                const { first, last, stopped } = shieldSpan(i, reach);
                // **The blast has a reach, and that is what makes a mine affordable.** Unbounded, the
                // set persists so a cube drawn at Level 2 is thrown four more times and one mine face
                // had a 51.8% chance of ending the run before the top; paying for that needed a cube
                // that multiplied the run by (6/5)^throws — 2.07x — and only the Wild was in that
                // class. Every other carrier measured *below an empty seat*, so the strongest greedy
                // rack held no mine and every mine-facing tool had nothing to point at. `blastReach`
                // makes a mine cost cubes instead of the run. The shield absorbs rather than merely
                // stopping, because at reach 1 "stops it further along" is inert.
                const blast = [];
                for (let k = first; k <= last; k++) if (k === i || !spend(final[k])) blast.push(k);
                const spared = (last - first + 1) - blast.length;
                for (const k of stopped) if (final[k].special) broken.push(final[k].special.id);
                for (const k of [...blast].reverse()) final.splice(k, 1);

                detonated = c.special ? c.special.name : 'the cube';
                note(c, stopped.length ? 'end.shielded' : 'end', {
                    destroyed: blast.length,
                    shields: stopped.length,
                    spared,
                    at: i,
                    from: blast[0],
                    stopped,
                });
                break;
            }
            case 'broken':
                if (shielding(final[i - 1]) || shielding(final[i + 1])) {
                    const swap = refaced(c);
                    if (!swap) {
                        note(c, 'broken.saved');
                        break;
                    }
                    note(c, 'broken.saved', { rolledFaceId: swap.id });
                    c.face = swap;
                    settle(c);
                    c.copy = true;
                    giveTurn(c);
                    break;
                }
                broken.push(c.special.id);
                final.splice(i, 1);
                note(c, 'broken', { at: i });
                break;
            case 'burn':
                if (i + 1 >= final.length) {
                    note(c, 'burn.nothing');
                    break;
                }
                const burnWard = warded(final[i + 1]);
                if (burnWard) {
                    note(c, `burn.${burnWard}`);
                    break;
                }
                final.splice(i + 1, 1);
                note(c, 'burn');
                break;
            case 'clone': {
                const hasLeft = i - 1 >= 0;
                const hasRight = i + 1 < final.length;
                if (!hasLeft && !hasRight) {
                    note(c, 'clone.alone');
                    break;
                }
                if (!hasLeft) {
                    if (iced(final[i + 1])) {
                        note(c, 'clone.iced');
                        break;
                    }
                    final.splice(i + 1, 1);
                    note(c, 'clone.destroy');
                    break;
                }
                const cloneWard = hasRight ? warded(final[i + 1]) : null;
                if (cloneWard) {
                    note(c, `clone.${cloneWard}`);
                    break;
                }
                const src = final[i - 1];
                const copy = enliven(turned(src));
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
                const { first, last } = shieldSpan(i);
                const others = [];
                for (let k = first; k <= last; k++) if (k !== i) others.push(k);
                if (!others.length) {
                    note(c, 'cull.nothing');
                    break;
                }
                const victim = others[crypto.randomInt(0, others.length)];
                const cullWard = warded(final[victim]);
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
                final.splice(i + 1, 0, got);
                note(c, 'draw', { faceId: faceIdOf(got), special: !!got.special });
                notes.push(...its);
                break;
            }
            case 'scavenge': {
                const up = standingSlots(final);
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
                const got = liftOne(from);
                const its = notes.splice(before);
                final.splice(i + 1, 0, got);
                note(c, 'scavenge', {
                    faceId: faceIdOf(got), special: !!got.special, own: !!own, at: i + 1,
                });
                notes.push(...its);
                break;
            }
            case 'haul': {
                const target = final[i + 1];
                if (!target || target.gone || freshlyFreed.has(target)) {
                    note(c, 'haul.nothing');
                    break;
                }
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
                const doomed = [];
                for (let k = 0; k < final.length; k++) {
                    const x = final[k];
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
                const j = c.face.dir === 'left' ? i - 1 : i + 1;
                const target = final[j];
                if (!isCube(target)) {
                    note(c, 'engine.nothing', { dir: c.face.dir });
                    break;
                }
                if (target.side === call) {
                    note(c, 'engine.already', { dir: c.face.dir, side: call });
                    break;
                }
                if (iced(target)) {
                    note(c, 'engine.iced', { dir: c.face.dir });
                    break;
                }
                target.side = call;
                if (target.face && SIDED.has(target.face.kind)) target.face = null;
                note(c, 'engine', { dir: c.face.dir, side: call });
                break;
            }
            case 'freeze': {
                const targets = [i - 1, i + 1]
                    .filter(j => j >= 0 && j < final.length && final[j] && !final[j].gone);
                if (!targets.length) {
                    note(c, 'freeze.nothing');
                    break;
                }
                const iced = [];
                for (const j of targets) {
                    const x = final[j];
                    if (x.frozen || !x.slot) continue;
                    x.slot.frozen = faceIdOf(x);
                    x.frozen = true;
                    iced.push(j);
                }
                note(c, iced.length ? 'freeze' : 'freeze.already',
                    { frozen: iced.length, both: iced.length > 1, at: i, hitAt: iced });
                break;
            }
            case 'scorch': {
                const targets = [i - 1, i + 1]
                    .filter(j => j >= 0 && j < final.length && final[j] && !final[j].gone);
                if (!targets.length) {
                    note(c, 'scorch.nothing');
                    break;
                }
                const burned = [];
                for (const j of targets) {
                    const x = final[j];
                    if (x.face && x.face.kind === 'burn') continue;
                    if (iced(x)) continue;
                    if (!x.slot) continue;
                    if (x.slot.frozen) { x.slot.frozen = null; continue; }
                    if (liveFaces(x.special, x.slot.burned).length <= config.minFaces) continue;
                    const id = faceIdOf(x);
                    x.slot.burned = [...x.slot.burned, id];
                    burned.push(id);
                    // Dead where it stands, not only gone from the cube: without the second half a
                    // Ratts charred by Baroonda would still detonate, and the fire would change a
                    // cube's odds and nothing you can see.
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
                sealed = call;
                note(c, 'vault', { side: call });
                break;
            case 'seam':
                note(c, 'seam', { bonus: config.seamBonus * rungs, rungs });
                break;
            case 'jail': {
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
                note(c, 'jail', {
                    taken: taking.length, at: i, held: cell.held.length, hitAt: taking,
                });
                break;
            }
            case 'plunge': {
                if (final.length < 2) {
                    note(c, 'plunge.nothing');
                    break;
                }
                // A blessed cube holds and the ledge crumbles past it — the chasm still takes **two**
                // positions, just the next one along. Two is what keeps a plunge parity-preserving,
                // which stops it manufacturing ties on a die that is sideless everywhere else. Two or
                // none: where the walks meet there is no second position, so it takes nothing.
                //
                // **The cube that threw it always falls**, blessed or not — a plunge that spared
                // itself would take away the die's only self-destruct, which is the jailbreak and the
                // release for Malastare's lock.
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
                for (let k = 0; k < head; k += 1) spend(final[k]);
                for (let k = final.length - 1; k > tail; k -= 1) spend(final[k]);
                const ends = [head, tail];
                const selfless = !ends.includes(i);
                for (const k of [...ends].reverse()) final.splice(k, 1);
                note(c, 'plunge', { destroyed: 2, self: !selfless, at: ends });
                break;
            }
            case 'crowd': {
                const ahead = { blue: 0, red: 0 };
                for (const x of final) if (x && !x.gone && ahead[x.side] != null) ahead[x.side] += 1;
                const side = ahead.blue > ahead.red ? 'blue' : ahead.red > ahead.blue ? 'red' : call;
                const hit = [];
                for (const j of [i - 1, i + 1]) {
                    const x = final[j];
                    if (!x || x.gone || !x.slot) continue;
                    if (iced(x)) continue;
                    if (x.face && x.face.kind === 'razed') continue;
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
                note(c, 'crowd', { side, painted: hit.length, both: hit.length > 1 });
                break;
            }
            case 'blessing': {
                const pool = [];
                for (let j = 0; j < final.length; j += 1) {
                    const x = final[j];
                    if (x !== c && !x.gone && x.slot && !x.slot.blessed) pool.push(j);
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
            || marks !== wasMarks;
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
    // and leave the multiple standing on nothing. A frozen face pays nothing, for the same reason it
    // takes no turn.
    const mults = [];
    for (const c of final) {
        if (c.gone || c.frozen || !c.face) continue;
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
                c.slot.heat = spent;
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
        hold.push({ ...c.slot });
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
        specials: line.filter(c => c.special).map(c => c.special.id),
    };
};
exports.resolveLine = resolveLine;

exports.SIDES = SIDES;
exports.LEVELS = LEVELS;
exports.SPECIALS = SPECIALS;
exports.config = config;
