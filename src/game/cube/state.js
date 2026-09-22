const moment = require('moment');
require('moment-timezone');

const {
    SPECIALS, TREE, TREES, SKIN_FREE, SKIN_SETS, SKIN_VARIANTS, cube: config,
} = require('./tuning.js');
const engine = require('./engine.js');

const { specialById } = engine;

const { MAX_LEVEL } = engine;
exports.MAX_LEVEL = MAX_LEVEL;

const pair = v => ({ blue: Number(v?.blue) || 0, red: Number(v?.red) || 0 });

// Every counter read off a stored profile goes through this. Storage is whatever Firebase last
// took, so a counter can come back a string, a float, a negative or absent; spelling the clamp out
// at each site is how one of them ends up spelled differently.
const count = v => Math.max(0, Math.floor(Number(v) || 0));
exports.count = count;

// The tie ledger, in the order the client shows it. A new counter is a new entry here and nowhere
// else — the previous shape restated the same coercion once per key.
const TIE_KEYS = [
    'total', 'rolled', 'bribed', 'boonta',
    'blue', 'red', 'won', 'wonBlue', 'wonRed', 'lostBlue', 'lostRed',
];

const OFF_RACK = new Set(['octahedron']);
exports.OFF_RACK = OFF_RACK;

const maxStakeFor = prestige => config.maxStake * (config.maxStakeStep ** prestige);
exports.maxStakeFor = maxStakeFor;

const rerollCostFor = (prestige, stock = 0) => Math.floor(
    config.rerollCost * (config.maxStakeStep ** prestige) * (config.rerollPriceStep ** stock),
);
exports.rerollCostFor = rerollCostFor;

const weldRerollCostFor = prestige => Math.floor(
    config.weldRerollCost * (config.maxStakeStep ** prestige),
);
exports.weldRerollCostFor = weldRerollCostFor;

const weekKey = function (now) {
    const d = moment(now).tz('America/New_York');
    return `${d.isoWeekYear()}-${String(d.isoWeek()).padStart(2, '0')}`;
};
exports.weekKey = weekKey;

const monthKey = now => moment(now).tz('America/New_York').format('YYYY-MM');
exports.monthKey = monthKey;

const WINDOWS = { week: weekKey, month: monthKey };
exports.WINDOWS = WINDOWS;

const stampsOf = stored => ({
    multiple: Number(stored?.multiple) || 0,
    cubes: Number(stored?.cubes) || 0,
    streak: Number(stored?.streak) || 0,
});
exports.stampsOf = stampsOf;

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

const FACE_CUBES = new Map();
for (const sp of SPECIALS) {
    for (const f of sp.faces || []) {
        if (!FACE_CUBES.has(f.id)) FACE_CUBES.set(f.id, []);
        const on = FACE_CUBES.get(f.id);
        if (!on.includes(sp.id)) on.push(sp.id);
    }
}
exports.FACE_CUBES = FACE_CUBES;

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

const pairKeyOf = function (id) {
    const parents = engine.weldParents(id);
    return parents ? parents.join(engine.WELD_SEP) : null;
};
exports.pairKeyOf = pairKeyOf;

const bribeShareFor = nudge => (nudge ? 1 - config.nudgeLean : config.tieLean) * (1 + config.bribeEdge);
exports.bribeShareFor = bribeShareFor;

exports.bribeCostFor = (standing, bribes = 0, nudge = false) => Math.floor(
    standing * bribeShareFor(nudge) * (config.bribeStep ** bribes),
);

const SKIN_IDS = new Set(SKIN_VARIANTS);
const SKIN_SET_BY_ID = new Map(SKIN_SETS.map(set => [set.id, set]));

const skinSetById = id => (typeof id === 'string' ? SKIN_SET_BY_ID.get(id) || null : null);
exports.skinSetById = skinSetById;

const ownedSkins = function (c) {
    const held = new Set(Object.keys(c?.skins || {}).filter(id => c.skins[id] && SKIN_IDS.has(id)));
    for (const id of SKIN_FREE) held.add(id);
    return SKIN_VARIANTS.filter(id => held.has(id));
};
exports.ownedSkins = ownedSkins;

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

const SKIN_STOCK = { blue: 'sq:blue', red: 'sq:red' };
exports.SKIN_STOCK = SKIN_STOCK;

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

exports.wornSides = (c, owned) => settleSides(c?.sides, new Set(owned));

exports.equipSide = function (s, patch, side, id) {
    if (side !== 'blue' && side !== 'red') return { ok: false, code: 'bad_side' };
    if (!SKIN_IDS.has(id)) return { ok: false, code: 'no_such_skin' };
    if (!s.skins.includes(id)) return { ok: false, code: 'not_owned' };
    const other = engine.OTHER[side];
    if (skinsClash(id, s.sides[other])) return { ok: false, code: 'clash' };
    s.sides = { ...s.sides, [side]: id };
    patch.sides = s.sides;
    return { ok: true, sides: s.sides };
};

const combOf = function (c, prestige) {
    const raw = Array.isArray(c?.comb) ? c.comb : Object.values(c?.comb || {});
    const seen = raw.map(id => (typeof id === 'string' && SKIN_IDS.has(id) ? id : null));
    const pad = Math.max(0, prestige - seen.length);
    return [...Array.from({ length: pad }, () => null), ...seen].slice(0, prestige);
};
exports.combOf = combOf;

const emblemOf = function (c, comb) {
    const want = c?.emblem;
    return typeof want === 'string' && comb.includes(want) ? want : null;
};
exports.emblemOf = emblemOf;

exports.pressWinner = function (s) {
    const at = id => Number(s.pressed[id]) || 0;
    const ids = Object.keys(s.pressed).filter(id => SKIN_IDS.has(id) && at(id) > 0);
    if (!ids.length) return null;
    const most = Math.max(...ids.map(at));
    const tied = ids.filter(id => at(id) === most);
    if (tied.length === 1) return tied[0];
    return tied.includes(s.pressedLast) ? s.pressedLast : tied[0];
};

exports.pickEmblem = function (s, patch, id) {
    if (typeof id !== 'string') return { ok: false, code: 'not_in_comb' };
    if (!s.comb.includes(id)) return { ok: false, code: 'not_in_comb' };
    s.emblem = id;
    s.pick = false;
    patch.emblem = id;
    patch.pick = null;
    return { ok: true, emblem: id };
};

exports.grantSkins = function (s, patch, ids) {
    const held = new Set(s.skins);
    for (const id of ids) if (SKIN_IDS.has(id)) held.add(id);
    s.skins = SKIN_VARIANTS.filter(id => held.has(id));
    patch.skins = Object.fromEntries(
        s.skins.filter(id => !SKIN_FREE.includes(id)).map(id => [id, true]),
    );
};

const ownedCubes = function (c) {
    const owned = Object.keys(c?.cubes || {}).filter(id => c.cubes[id]);
    const declared = SPECIALS.filter(sp => owned.includes(sp.id)).map(sp => sp.id);
    const welds = owned.filter(id => !declared.includes(id) && specialById(id)).sort();
    return [...declared, ...welds];
};

const COLLECTED = { grand_circuit: 'octahedron' };

const pressCubesFor = tier => (tier >= 3 ? 3 : 2);

exports.cubeState = function (user_profile) {
    const c = user_profile?.cube || {};
    const effects = user_profile?.effects || {};
    const unlocked = Math.min(Number(c.unlocked) || 0, MAX_LEVEL);
    const prestige = Math.max(Number(c.prestige) || 0, 0);
    const comb = combOf(c, prestige);
    const maxStake = maxStakeFor(prestige);
    const stored = Math.floor(Number(c.stake) || 0);
    const collected = Object.entries(COLLECTED)
        .filter(([flag]) => effects[flag])
        .map(([, id]) => id)
        .filter(id => specialById(id));
    const owned = ownedCubes(c);
    const skins = ownedSkins(c);
    const cubes = [
        ...SPECIALS.map(sp => sp.id).filter(id => owned.includes(id) || collected.includes(id)),
        ...owned.filter(id => !SPECIALS.some(sp => sp.id === id)),
    ];
    const equipped = Object.values(c.equipped || {})
        .filter(id => cubes.includes(id))
        .slice(0, engine.bagSize());
    const stock = count(c.rerolls);
    const pressTier = Math.max(0, Math.min(config.weldTiers.length, Math.floor(Number(c.pressTier) || 0)));
    const weldSeen = {};
    for (const [k, v] of Object.entries(c.weldSeen || {})) {
        const list = (Array.isArray(v) ? v : Object.values(v || {})).filter(x => typeof x === 'string');
        if (list.length) weldSeen[k] = list;
    }
    return {
        cubes,
        equipped,
        slots: engine.bagSize(),
        rerolls: stock,
        buyReroll: !!c.buyReroll,
        rerollCost: rerollCostFor(prestige, stock),
        scrap: !!c.scrap,
        double: !!c.double,
        pressTier,
        pressCubes: pressCubesFor(pressTier),
        keeper: !!c.keeper,
        split: !!c.split,
        heavy: !!c.heavy,
        premonition: !!c.premonition,
        shuffle: !!c.shuffle,
        sidebet: !!c.sidebet,
        weldRerollCost: weldRerollCostFor(prestige),
        weldSeen,
        ties: Object.fromEntries(TIE_KEYS.map(k => [k, count(c.ties?.[k])])),
        week: windowOf(c?.week, weekKey()),
        month: windowOf(c?.month, monthKey()),
        faceProgress: faceProgressOf(c, cubes),
        skins,
        sides: exports.wornSides(c, skins),
        pressed: (c.pressed && typeof c.pressed === 'object') ? c.pressed : {},
        pressedLast: typeof c.pressedLast === 'string' ? c.pressedLast : null,
        comb: comb,
        emblem: emblemOf(c, comb),
        // Only while there is something to choose. A prestige that pressed no skin appends an empty
        // cell, so a comb of nothing but empties raised a prompt with no answer — and `/emblem`,
        // the only thing that lowers it, refuses every id a player could send it.
        pick: !!c.pick && comb.some(Boolean),
        nudge: !!c.nudge,
        bribe: !!c.bribe,
        bribes: count(c.bribes),
        faces: (c.faces && typeof c.faces === 'object') ? c.faces : {},
        prestige,
        points: count(c.points),
        stake: Math.min(stored >= config.minStake ? stored : config.defaultStake, maxStake),
        maxStake,
        turn: Number(c.turn) || 0,
        unlocked,
        clears: Number(c.clears) || 0,
        calls: pair(c.calls),
        wins: pair(c.wins),
        rolled: pair(c.rolled),
        bestLevel: Math.min(Number(c.bestLevel) || 0, MAX_LEVEL),
        bestStanding: Number(c.bestStanding) || 0,
        bestCubes: Number(c.bestCubes) || 0,
        bestMultiple: Number(c.bestMultiple) || 0,
        streak: Number(c.streak) || 0,
        bestStreak: Number(c.bestStreak) || 0,
        cold: count(c.cold),
        coldest: Math.max(count(c.cold), count(c.coldest)),
        bestAt: stampsOf(c.bestAt),
        totalWon: Number(c.totalWon) || 0,
        totalLost: Number(c.totalLost) || 0,
        totalSpent: Number(c.totalSpent) || 0,
    };
};

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

exports.recordSpent = function (s, patch, amount) {
    if (amount <= 0) return;
    s.totalSpent += amount;
    patch.totalSpent = s.totalSpent;
};

exports.unrecordLost = function (s, patch, amount) {
    if (amount <= 0) return;
    s.totalLost = Math.max(0, s.totalLost - amount);
    patch.totalLost = s.totalLost;
};

exports.recordRoll = function (s, patch, {
    call, won, cubes, level, standing, line = 0, multiple = 0, opening = false,
}) {
    const records = {
        level: level > s.bestLevel,
        standing: standing > s.bestStanding,
        cubes: line > s.bestCubes,
        multiple: multiple > s.bestMultiple,
    };
    const blue = cubes.filter(c => c === 'blue').length;
    s.calls = { ...s.calls, [call]: s.calls[call] + 1 };
    s.rolled = { blue: s.rolled.blue + blue, red: s.rolled.red + (cubes.length - blue) };
    patch.calls = s.calls;
    patch.rolled = s.rolled;
    const wore = s.sides[call];
    if (wore) {
        s.pressed = { ...s.pressed, [wore]: (Number(s.pressed[wore]) || 0) + 1 };
        patch.pressed = s.pressed;
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
    records.streak = s.streak > s.bestStreak;
    if (records.streak) {
        s.bestStreak = s.streak;
        patch.bestStreak = s.streak;
        stamp('streak');
    }

    if (opening) {
        s.cold = won ? 0 : s.cold + 1;
        patch.cold = s.cold;
        records.cold = !won && s.cold > s.coldest;
        if (records.cold) {
            s.coldest = s.cold;
            patch.coldest = s.coldest;
        }
    }

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

exports.recordTie = function (s, patch, { bribed, breaker, call }) {
    const t = { ...s.ties };
    t.total += 1;
    if (bribed) t.bribed += 1;
    else if (breaker) {
        t.rolled += 1;
        if (breaker === 'blue') t.blue += 1;
        if (breaker === 'red') t.red += 1;
        if (breaker === call) t.won += 1;
        if (breaker === 'blue') breaker === call ? t.wonBlue += 1 : t.lostBlue += 1;
        else if (breaker === 'red') breaker === call ? t.wonRed += 1 : t.lostRed += 1;
    }
    s.ties = t;
    patch.ties = t;
};

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

const topOf = s => Math.min(s.unlocked, MAX_LEVEL);
exports.topOf = topOf;

const gapSize = s => Math.min(
    config.clearsToUnlock + Math.floor(s.prestige / config.clearsPrestigeStep),
    config.maxClears,
);
exports.gapSize = gapSize;

const goalOf = s => (s.unlocked >= MAX_LEVEL ? config.clearsToPrestige : gapSize(s));
exports.goalOf = goalOf;

exports.canPrestige = s => s.unlocked >= MAX_LEVEL && s.clears >= config.clearsToPrestige;

exports.routeOf = function (s) {
    const g = gapSize(s);
    const top = topOf(s);
    const rungs = [];
    for (let level = 0; level <= MAX_LEVEL; level++) {
        rungs.push({ kind: 'level', level, index: 0, cleared: level <= top, locked: level > top });
        if (level === MAX_LEVEL) break;
        const done = level < top ? g : (level === top ? Math.min(s.clears, g) : 0);
        for (let index = 0; index < g; index++) {
            rungs.push({
                kind: 'again', level, index, cleared: index < done, locked: level > top,
            });
        }
    }
    return { rungs, gap: g, top, endless: true };
};

const nextRung = function (s, level) {
    const at = Math.max(0, Math.min(Number(level) || 0, MAX_LEVEL));
    if (at >= MAX_LEVEL) return { kind: 'overtime', level: MAX_LEVEL };
    if (at < topOf(s)) return { kind: 'level', level: at + 1 };
    return s.clears < gapSize(s)
        ? { kind: 'again', level: at }
        : { kind: 'level', level: at + 1 };
};
exports.nextRung = nextRung;

exports.rungClears = (level, again) => (level >= MAX_LEVEL
    ? !again
    : !!again);

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

const holds = function (s, value, held) {
    if (value.startsWith('cube:')) return (held || cubesHeld(s)).has(value.slice(5));
    const test = HELD[value];
    return test ? !!test(s) : false;
};
exports.holds = holds;

const PERKS = {
    reroll: {
        kind: 'reroll',
        label: 'Purchase Rerolls',
        description: 'Buy rerolls with truguts and bank them for a losing roll.',
    },
    nudge: {
        kind: 'nudge',
        label: "Qui-Gon's Nudge",
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
        label: 'Fusioncutter',
        description: 'Armed for a rung, either cut a welded cube on the line back into the cubes it was '
            + 'pressed from, or fuse two neighbours into one seat for the rest of the climb. A fused seat '
            + 'can be cut apart on a later rung, and comes back as the cubes that went in.',
    },
    premonition: {
        kind: 'premonition',
        label: 'Premonition',
        description: 'Once a run, see one face of the next roll before you call it.',
    },
    shuffle: {
        kind: 'shuffle',
        label: 'Swap',
        description: 'Once a run, swap two cubes on the line before anything they do happens.',
    },
    sidebet: {
        kind: 'sidebet',
        label: 'Side Bet',
        description: 'Each rung, ante one off the multiple to name one of the three prices Watto has chalked up. A hit pays the price back onto the multiple — long odds pay best, and the deeper you leave it the less a hit compounds.',
    },
};

const TREE_BY_ID = new Map(TREES.map(t => [t.id, t]));

const treeOpen = function (s, id) {
    const tree = TREE_BY_ID.get(id);
    if (!tree || !tree.opens) return true;
    if (tree.opens === 'overflow') return s.cubes.length > engine.bagSize();
    return true;
};
exports.treeOpen = treeOpen;

const reachable = function (s, node, held) {
    if (node.requires && !node.requires.every(v => holds(s, v, held))) return false;
    if (node.requiresAny && !node.requiresAny.some(v => holds(s, v, held))) return false;
    if (node.pressTier && s.pressTier < node.pressTier) return false;
    return true;
};

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

exports.rewardChoices = function (s) {
    const out = [];
    const held = cubesHeld(s);
    for (const [value, node] of Object.entries(TREE)) {
        if (!treeOpen(s, node.tree)) continue;
        if (holds(s, value, held)) continue;
        if (!reachable(s, node, held)) continue;
        out.push({ ...entryOf(s, value, node), tree: node.tree });
    }
    return out;
};

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
            pressTier: node.pressTier || 0,
            label: perk.label,
            description: perk.description,
        });
    }
    return out;
};

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

const grantReward = function (s, patch, value) {
    const flag = FLAGS[value];
    if (flag) {
        s[flag] = true;
        patch[flag] = true;
        return;
    }
    if (value === 'press') {
        if (s.pressTier >= config.weldTiers.length) return;
        s.pressTier += 1;
        s.pressCubes = pressCubesFor(s.pressTier);
        patch.pressTier = s.pressTier;
        return;
    }
    const id = value.startsWith('cube:') ? value.slice(5) : null;
    if (!id || !specialById(id) || cubesHeld(s).has(id) || OFF_RACK.has(id)) return;
    s.cubes = [...s.cubes, id].filter(cid => specialById(cid));
    patch.cubes = Object.fromEntries(s.cubes.map(cid => [cid, true]));
    if (s.equipped.length < engine.bagSize()) {
        s.equipped = [...s.equipped, id];
        patch.equipped = s.equipped;
    }
};

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
    s.bribes = 0;
    patch.bribes = 0;
    s.comb = [...s.comb, exports.pressWinner(s)];
    patch.comb = s.comb;
    s.pick = true;
    patch.pick = true;
    s.pressed = {};
    patch.pressed = null;
    s.pressedLast = null;
    patch.pressedLast = null;
};

exports.spendPoint = function (s, patch, value) {
    exports.spendPoints(s, patch);
    grantReward(s, patch, value);
};

exports.refundDeadHeavy = function (s, patch) {
    if (!s.heavy) return false;
    s.heavy = false;
    s.points += 1;
    patch.heavy = false;
    patch.points = s.points;
    return true;
};

exports.spendPoints = function (s, patch, n = 1) {
    s.points = Math.max(0, s.points - n);
    patch.points = s.points;
};

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

exports.rememberWeld = function (s, patch, id) {
    const key = pairKeyOf(id);
    const parents = engine.weldParents(id);
    if (!key || !parents) return;
    const cap = Math.max(0, Math.min(config.weldMemory, engine.weldDrawSpace(parents) - 1));
    const seen = [id, ...(s.weldSeen[key] || []).filter(x => x !== id)].slice(0, cap);
    s.weldSeen = { ...s.weldSeen };
    if (seen.length) s.weldSeen[key] = seen;
    else delete s.weldSeen[key];
    patch.weldSeen = s.weldSeen;
};

exports.weldCubes = function (s, patch, ids, id) {
    swapCubes(s, patch, ids, [id]);
    exports.rememberWeld(s, patch, id);
};

exports.recutWeld = function (s, patch, from, to) {
    swapCubes(s, patch, [from], [to]);
    exports.rememberWeld(s, patch, to);
};

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

exports.setLoadout = function (s, patch, ids) {
    const equipped = [...new Set(ids)]
        .filter(id => s.cubes.includes(id))
        .slice(0, engine.bagSize());
    s.equipped = equipped;
    patch.equipped = equipped;
    return equipped;
};

exports.addReroll = function (s, patch, n) {
    s.rerolls = Math.max(0, s.rerolls + n);
    patch.rerolls = s.rerolls;
};

exports.addBribe = function (s, patch) {
    s.bribes += 1;
    patch.bribes = s.bribes;
};
