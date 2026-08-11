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

const { LEVELS, SPECIALS, cube: config } = require('./tuning.js');
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
// prestige point strictly worse than unwelding and welding again.
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

// One window's bests, reset lazily. **Nothing sweeps at midnight**: a stored window that is not the
// current one simply reads back as zeroes and the next write files under the new key. So a player who
// has not rolled since last Tuesday has no standing on this week's board rather than a stale one.
const windowOf = function (stored, id) {
    if (!stored || stored.id !== id) return { id, multiple: 0, cubes: 0, streak: 0 };
    return {
        id,
        multiple: Number(stored.multiple) || 0,
        cubes: Number(stored.cubes) || 0,
        streak: Number(stored.streak) || 0,
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
exports.bribeCostFor = (standing, bribes = 0) => Math.floor(
    standing * config.bribeShare * (config.bribeStep ** bribes),
);

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
        // The weld press: how far up it the player has bought, what a reroll costs in truguts, how
        // many cubes it takes at that tier, and what each pairing has already thrown.
        pressTier,
        pressCubes: pressTier >= 3 ? 3 : 2,
        weldRerollCost: weldRerollCostFor(prestige),
        weldSeen,
        // Lifetime tie tallies, by how each one was settled. Read defensively for the same reason
        // `calls` and `rolled` are: a profile written before this existed has none of it.
        ties: {
            total: Math.max(0, Math.floor(Number(c.ties?.total) || 0)),
            rolled: Math.max(0, Math.floor(Number(c.ties?.rolled) || 0)),
            bribed: Math.max(0, Math.floor(Number(c.ties?.bribed) || 0)),
            boonta: Math.max(0, Math.floor(Number(c.ties?.boonta) || 0)),
            blue: Math.max(0, Math.floor(Number(c.ties?.blue) || 0)),
            red: Math.max(0, Math.floor(Number(c.ties?.red) || 0)),
            won: Math.max(0, Math.floor(Number(c.ties?.won) || 0)),
        },
        // This week's and this month's bests, for the board's two rolling windows. Reset lazily —
        // see `windowOf`. All-time needs no entry: it is `bestMultiple` and friends.
        week: windowOf(c?.week, weekKey()),
        month: windowOf(c?.month, monthKey()),
        // How much of the game's face art the player has actually met. **Not `faces`** — that is the
        // raw `{ cubeId: { faceKey: n } }` tally the rack screen draws its per-face counts from, and
        // this is the summary over it.
        faceProgress: faceProgressOf(c, cubes),
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
exports.recordRoll = function (s, patch, { call, won, cubes, level, standing, line = 0, multiple = 0 }) {
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
    if (line > s.bestCubes) {
        s.bestCubes = line;
        patch.bestCubes = line;
    }
    if (multiple > s.bestMultiple) {
        s.bestMultiple = multiple;
        patch.bestMultiple = multiple;
    }
    s.streak = won ? s.streak + 1 : 0;
    patch.streak = s.streak;
    if (s.streak > s.bestStreak) {
        s.bestStreak = s.streak;
        patch.bestStreak = s.streak;
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
        if (multiple > was.multiple || line > was.cubes || s.streak > was.streak || s[name].id !== id) {
            s[name] = {
                id,
                multiple: Math.max(was.multiple, multiple),
                cubes: Math.max(was.cubes, line),
                streak: Math.max(was.streak, s.streak),
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
exports.recordTie = function (s, patch, { bribed, breaker, boonta, call }) {
    const t = { ...s.ties };
    t.total += 1;
    if (boonta) t.boonta += 1;
    else if (bribed) t.bribed += 1;
    else if (breaker) {
        t.rolled += 1;
        if (breaker === 'blue') t.blue += 1;
        if (breaker === 'red') t.red += 1;
        if (breaker === call) t.won += 1;
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

// What a prestige point buys: any special cube you don't own yet, or — once each — the right to buy
// rerolls and the two tie picks. The stake ceiling comes with the prestige itself, so this is the
// choice, not the payment.
//
// **The list is finite and it empties.** Every entry here is a thing that changes a roll, and once
// they are all taken a prestige is worth its stake ceiling and nothing else. That is deliberate: the
// alternative was the `+1 slot` pick, which never ran out precisely because it had stopped doing
// anything. See the note where it used to be pushed.
//
// Returned as plain data. The description is copy, so it is built here where the numbers it
// quotes live, but nothing about the shape assumes a select menu — the fourteen entries happen to
// fit one, and that is the client's good luck rather than this function's contract.
exports.rewardChoices = function (s) {
    const out = SPECIALS
        .filter(sp => !s.cubes.includes(sp.id) && !OFF_RACK.has(sp.id))
        .map(sp => ({
            value: `cube:${sp.id}`, kind: 'cube', id: sp.id, label: sp.name, description: sp.blurb,
        }));
    // **`+1 Special Cube Slot` used to be here, and it is gone.** It was the only entry on the rack
    // that was worth nothing on its own — a slot needs a benched cube and a benched cube needs a slot,
    // so the two of them ate a prestige each to deliver one cube's worth of change, and the pick was
    // never a choice: whichever you were short of was the answer. Past `bagSize()` it stopped even
    // being that, because there is nothing above the bag to sell.
    //
    // So the cap survived and the *purchase* didn't. Every rack fields `bagSize()` from the first
    // prestige onwards, which is the number the bag was always going to allow — the pick was only ever
    // charging a prestige for the right to reach it.
    //
    // Which leaves the rack **finite**: every cube, then three perks, then nothing. A player who takes
    // every pick has taken every pick, and a prestige past that is worth its stake ceiling and no more
    // — which is a cleaner endgame than an infinitely repeatable pick that did nothing.
    if (!s.buyReroll) {
        out.push({
            value: 'reroll',
            kind: 'reroll',
            label: 'Purchase Rerolls',
            description: 'Buy rerolls with truguts and bank them for a losing roll.',
        });
    }
    // Both of these only ever fire on a tie, which nothing but a destructive special can cause —
    // so they are worth exactly as much as the rack that causes them, and worth nothing on their
    // own. They are offered once each, like the reroll perk.
    if (!s.nudge) {
        out.push({
            value: 'nudge',
            kind: 'nudge',
            label: "Qui-Gon's Nudge",
            description: `Watto's tie-breaker leans ${Math.round(config.tieLean * 100)}/${Math.round((1 - config.tieLean) * 100)} your way instead of his.`,
        });
    }
    if (!s.bribe) {
        out.push({
            value: 'bribe',
            kind: 'bribe',
            label: 'Bribe Ties',
            description: 'Buy a tie off him outright instead of trusting his cube.',
        });
    }
    // **The press, one rung at a time**, and it is what stops the paragraph above being the end of the
    // story. The rack was finite by design and that was the whole problem: a player past every pick
    // had a prestige worth a stake ceiling they could already not reach. Four rungs is not an infinite
    // rack either — but what the last one hands over is a *press*, and rerolling one is the sink that
    // does not run out.
    //
    // Offered strictly in order, one at a time, so the menu never asks a question with four answers
    // that all have to be taken anyway.
    if (s.pressTier < config.weldTiers.length) {
        const next = config.weldTiers[s.pressTier];
        out.push({
            value: 'press',
            kind: 'press',
            tier: s.pressTier + 1,
            label: next.name,
            description: next.blurb,
        });
    }
    return out;
};

// Grants one reward. Reached only through `spendPoint`, which is what charges for it.
const grantReward = function (s, patch, value) {
    if (value === 'reroll') {
        s.buyReroll = true;
        patch.buyReroll = true;
        return;
    }
    if (value === 'nudge') {
        s.nudge = true;
        patch.nudge = true;
        return;
    }
    if (value === 'bribe') {
        s.bribe = true;
        patch.bribe = true;
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
    // prestige point on a cube that was never for sale.
    if (!id || !specialById(id) || s.cubes.includes(id) || OFF_RACK.has(id)) return;
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
};

// Spends one banked point on one thing off the rack. The caller checks the value is actually on
// offer — see `actions.spendPoint`, which is where a refusal has somewhere to go.
exports.spendPoint = function (s, patch, value) {
    exports.spendPoints(s, patch);
    grantReward(s, patch, value);
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
    const cap = Math.max(0, Math.min(config.weldMemory, engine.weldSpace(parents) - 1));
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
