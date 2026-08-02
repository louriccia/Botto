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

const { LEVELS, SPECIALS, cube: config } = require('./tuning.js');
const { specialById } = require('./engine.js');

const MAX_LEVEL = LEVELS.length - 1;
exports.MAX_LEVEL = MAX_LEVEL;

const pair = v => ({ blue: Number(v?.blue) || 0, red: Number(v?.red) || 0 });

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
const ownedCubes = c => SPECIALS.filter(sp => c?.cubes?.[sp.id]).map(sp => sp.id);

exports.cubeState = function (user_profile) {
    const c = user_profile?.cube || {};
    const unlocked = Math.min(Number(c.unlocked) || 0, MAX_LEVEL);
    const prestige = Math.max(Number(c.prestige) || 0, 0);
    const maxStake = maxStakeFor(prestige);
    const stored = Math.floor(Number(c.stake) || 0);
    const cubes = ownedCubes(c);
    // Slots are clamped on read as well as on write, and the loadout is filtered against both
    // what is owned and how many slots there are — a cube sold out from under a saved loadout,
    // or a loadout saved when there were more slots, can't put an extra cube on the table.
    const slots = Math.max(config.startingSlots, Math.floor(Number(c.slots) || 0));
    const equipped = Object.values(c.equipped || {})
        .filter(id => cubes.includes(id))
        .slice(0, slots);
    const stock = Math.max(0, Math.floor(Number(c.rerolls) || 0));
    return {
        // Special cubes owned, which of them are on the table, and how many may be.
        cubes,
        equipped,
        slots,
        // Rerolls in stock — bought, or banked off a Reroll Cube — and whether buying is
        // unlocked at all. Spent on a game over screen, never automatically.
        rerolls: stock,
        buyReroll: !!c.buyReroll,
        rerollCost: rerollCostFor(prestige, stock),
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
    return records;
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
// Clears and unlocks
// ---------------------------------------------------------------------------

// The deepest level this player may put on the table. Everything past it is locked, so a
// win there has nowhere to push and banks itself.
const topOf = s => Math.min(s.unlocked, MAX_LEVEL);
exports.topOf = topOf;

// Clears needed to fill the meter: a level unlock most of the way up, the option to prestige
// once there is nothing left to unlock.
//
// Every *other* prestige adds one more clear to each level, so re-climbing lengthens without
// running away from you — one per prestige turned the fourth re-climb into a slog. The prestige
// gate itself does not scale at all: clearing the top level is a 1-in-32 run before you count
// the clears at every level below it, and doubling that would price prestige out of reach.
//
// And it **stops** at `maxClears`. The growth is paid for by the rack, and the rack is finite —
// once every pick is taken there is nothing left to accelerate with, so an uncapped requirement
// would go on charging more for less forever.
const clearsPerLevel = s => Math.min(
    config.clearsToUnlock + Math.floor(s.prestige / config.clearsPrestigeStep),
    config.maxClears,
);
exports.clearsPerLevel = clearsPerLevel;

const goalOf = s => (s.unlocked >= MAX_LEVEL ? config.clearsToPrestige : clearsPerLevel(s));
exports.goalOf = goalOf;

// Prestige is offered, never forced. It sits there until the player takes it.
exports.canPrestige = s => s.unlocked >= MAX_LEVEL && s.clears >= config.clearsToPrestige;

// Banking at your top unlocked level is a clear — surviving your own ceiling, not just
// reaching it. Enough of them and Watto grudgingly puts more cubes on the table; at the top of
// the ladder they buy the option to start over instead.
//
// Mutates `s` and `patch`. Returns null when there was nothing left to bank toward, otherwise
// `{ unlocked, prestige }` — the index of a level this clear opened, and whether it earned the
// prestige offer. Either of those means the meter just filled.
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

// What a prestige is worth picking from: any special cube you don't own yet, another slot to
// field one in, or — once each — the right to buy rerolls and the two tie picks. The stake
// ceiling goes up either way, so this is the choice, not the payment.
//
// Returned as plain data. The description is copy, so it is built here where the numbers it
// quotes live, but nothing about the shape assumes a select menu — the fourteen entries happen to
// fit one, and that is the client's good luck rather than this function's contract.
exports.rewardChoices = function (s) {
    const out = SPECIALS
        .filter(sp => !s.cubes.includes(sp.id))
        .map(sp => ({
            value: `cube:${sp.id}`, kind: 'cube', id: sp.id, label: sp.name, description: sp.blurb,
        }));
    out.push({
        value: 'slot',
        kind: 'slot',
        label: '+1 Special Cube Slot',
        description: `Field ${s.slots + 1} special cubes at once instead of ${s.slots}.`,
    });
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
    return out;
};

// Grants one reward. Kept separate from the prestige itself so the two things a prestige does
// — reset the ladder, hand something over — can be read independently.
const grantReward = function (s, patch, value) {
    if (value === 'slot') {
        s.slots += 1;
        patch.slots = s.slots;
        // Fill the new slot with something, so a slot bought while cubes sit on the bench is
        // useful the moment it's granted rather than after a trip to the loadout screen.
        const bench = s.cubes.find(id => !s.equipped.includes(id));
        if (bench) {
            s.equipped = [...s.equipped, bench];
            patch.equipped = s.equipped;
        }
        return;
    }
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
    const id = value.startsWith('cube:') ? value.slice(5) : null;
    if (!id || !specialById(id) || s.cubes.includes(id)) return;
    s.cubes = [...s.cubes, id].filter(cid => specialById(cid));
    patch.cubes = Object.fromEntries(s.cubes.map(cid => [cid, true]));
    // A cube nobody equipped never rolls, so a first cube (or one that fits a spare slot) goes
    // straight onto the table.
    if (s.equipped.length < s.slots) {
        s.equipped = [...s.equipped, id];
        patch.equipped = s.equipped;
    }
};

// Hand the whole ladder back for a bigger ceiling and one reward. Everything about
// the climb resets; the lifetime record, the truguts and everything already granted do not.
exports.applyPrestige = function (s, patch, value) {
    s.prestige += 1;
    s.unlocked = 0;
    s.clears = 0;
    s.maxStake = maxStakeFor(s.prestige);
    s.rerollCost = rerollCostFor(s.prestige);
    patch.prestige = s.prestige;
    patch.unlocked = 0;
    patch.clears = 0;
    // Watto's price for a tie goes back to the bottom of its ladder. It is the one thing a
    // prestige *gives* back, and it's what stops the bribe pricing itself out of the game
    // permanently — the ladder it climbs is per-prestige, like the ladder of levels.
    s.bribes = 0;
    patch.bribes = 0;
    grantReward(s, patch, value);
};

// Saves a loadout. Trusts nothing from the client: unknown ids, cubes that aren't owned and
// anything past the slot count are dropped, so a stale menu can't field a cube.
exports.setLoadout = function (s, patch, ids) {
    const equipped = [...new Set(ids)].filter(id => s.cubes.includes(id)).slice(0, s.slots);
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
