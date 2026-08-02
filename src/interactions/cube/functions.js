// Engine for Botto's Chance Cube: the run in progress, the Pure Cube pot, and the one
// embed the whole game is played in. See src/data/challenge/cube.js for the tuning and
// docs/chance-cube.md for the design.
//
// State layout (live state is listened to by firebase.js, so it mirrors into memory):
//   challenge/cube/live/pot                   the Pure Cube pot
//   challenge/cube/live/ladders/<discordId>   one live run per player
//   users/<key>/random/cube                   { stake, turn }

const crypto = require('crypto');
const admin = require('firebase-admin');
const moment = require('moment');
require('moment-timezone');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { number_with_commas } = require('../../generic.js');
const { ChanceCube, WhyNobodyBuy, bar_symbols, emojimap, level_symbols } = require('../../data/discord/emoji.js');
const { newrecord, DyeGon, RIPratts, wipeout, Whatto, SlyGon } = emojimap;
// Buying a tie off Watto. Not a cube, so it gets a gesture rather than a face.
const BRIBE = '🤝';
// Grandmaster — the top of the rank ladder, which is exactly what a prestige is.
const PRESTIGE = level_symbols[level_symbols.length - 1];
const {
    SIDES, FACES, SPECIALS, LEVELS, WATTO, SWEEP_SHARE, CUBE_GAP, cube: config,
} = require('../../data/challenge/cube.js');

const specialById = id => (id ? SPECIALS.find(sp => sp.id === id) || null : null);
exports.specialById = specialById;

const LIVE = 'challenge/cube/live';
const COLOR = '#F0B232';
const OTHER = { blue: 'red', red: 'blue' };
const inc = n => admin.database.ServerValue.increment(n);
const tg = v => number_with_commas(Math.round(Number(v) || 0));

const MAX_LEVEL = LEVELS.length - 1;
exports.MAX_LEVEL = MAX_LEVEL;
// Named once, from the data, so copy about the top of the ladder survives a rename.
const TOP_NAME = LEVELS[MAX_LEVEL].name;

// ---------------------------------------------------------------------------
// The pot
// ---------------------------------------------------------------------------

// Self-healing pot seed, run on first touch. The in-memory check keeps this to a single
// write for the lifetime of the pot rather than a transaction on every interaction, and
// it also recovers if the node is ever removed. The transaction aborts when a pot
// already exists, so a concurrent first touch can't double-seed.
exports.ensurePot = async function (database, db) {
    if (!db.ch.cube) db.ch.cube = {};
    if (db.ch.cube.pot === null || db.ch.cube.pot === undefined) {
        const seeded = await database.ref(`${LIVE}/pot`).transaction(current =>
            (current === null || current === undefined) ? config.potSeed : undefined);
        db.ch.cube.pot = Number(seeded.snapshot.val()) || 0;
    }
    return db.ch.cube.pot;
};

exports.potOf = db => Number(db.ch.cube?.pot) || 0;

// What a busted stake actually puts in the jar. Only a share of it — the rest leaves the
// economy, which is what stops the mode paying out more than it takes in; see `potShare`.
//
// Both the deposit and the reroll that reverses it go through here, so they can never disagree
// about the rounding. It floors, and it is called on the same stake both ways, so the reversal
// takes out exactly the integer that went in rather than a trugut either side of it.
const potCut = stake => Math.floor((Number(stake) || 0) * config.potShare);
exports.potCut = potCut;

// Increment rather than read-modify-write: busted stakes land here from every player at
// once. A negative amount takes one back out again, which is what a reroll bought off the game
// over screen does to the bust it undoes — never more than was just put in.
exports.addToPot = function (database, db, amount) {
    const add = Math.floor(amount);
    if (!add) return;
    database.ref(`${LIVE}/pot`).set(inc(add));
    if (db.ch.cube) db.ch.cube.pot = Math.max(0, (Number(db.ch.cube.pot) || 0) + add);
};

// Pays a share of the pot and returns what was actually paid. Transactional because two
// simultaneous pure rolls must not both be paid off the same pre-payout balance.
exports.payFromPot = async function (database, db, share) {
    if (!share) return 0;
    let prize = 0;
    await database.ref(`${LIVE}/pot`).transaction(current => {
        const pot = Number(current) || 0;
        prize = Math.floor(pot * share);
        return pot - prize;
    });
    if (db.ch.cube) db.ch.cube.pot = Math.max(0, (Number(db.ch.cube.pot) || 0) - prize);
    return prize;
};

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------

const pair = v => ({ blue: Number(v?.blue) || 0, red: Number(v?.red) || 0 });

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
const bribeCostFor = (standing, bribes = 0) => Math.floor(
    standing * config.bribeShare * (config.bribeStep ** bribes),
);
exports.bribeCostFor = bribeCostFor;

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
// would go on charging more for less forever. See `maxClears` for the arithmetic, and for the
// meter width that ultimately sets the number.
const clearsPerLevel = s => Math.min(
    config.clearsToUnlock + Math.floor(s.prestige / config.clearsPrestigeStep),
    config.maxClears,
);
exports.clearsPerLevel = clearsPerLevel;

const goalOf = s => (s.unlocked >= MAX_LEVEL ? config.clearsToPrestige : clearsPerLevel(s));
exports.goalOf = goalOf;

// Prestige is offered, never forced. It sits there until the player takes it.
const canPrestige = s => s.unlocked >= MAX_LEVEL && s.clears >= config.clearsToPrestige;
exports.canPrestige = canPrestige;

// Banking at your top unlocked level is a clear — surviving your own ceiling, not just
// reaching it. Enough of them and Watto grudgingly puts more cubes on the table; at the top of
// the ladder they buy the option to start over instead.
//
// Mutates `s` and `patch`. Returns null when there was nothing left to bank toward, otherwise
// `{ unlocked, prestige }` — the index of a level this clear opened, and whether it earned the
// prestige offer. Either of those means the meter just filled. The counter itself is never
// spelled out in words; that is what the xp bar on screen is for.
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
// field one in, or — once — the right to buy rerolls. The stake ceiling goes up either way, so
// this is the choice, not the payment.
//
// The list is short enough to always fit a select menu (ten cubes plus two items, against a
// limit of twenty-five), so it never needs paging.
const rewardChoices = function (s) {
    const out = SPECIALS
        .filter(sp => !s.cubes.includes(sp.id))
        .map(sp => ({ value: `cube:${sp.id}`, label: sp.name, emoji: sp.emoji, description: sp.blurb }));
    out.push({
        value: 'slot',
        label: '+1 Special Cube Slot',
        emoji: ChanceCube,
        description: `Field ${s.slots + 1} special cubes at once instead of ${s.slots}.`,
    });
    if (!s.buyReroll) {
        out.push({
            value: 'reroll',
            label: 'Purchase Rerolls',
            emoji: emojimap.restart,
            description: 'Buy rerolls with truguts and bank them for a losing roll.',
        });
    }
    // Both of these only ever fire on a tie, which nothing but a destructive special can cause —
    // so they are worth exactly as much as the rack that causes them, and worth nothing on their
    // own. They are offered once each, like the reroll perk.
    if (!s.nudge) {
        out.push({
            value: 'nudge',
            label: "Qui-Gon's Nudge",
            emoji: SlyGon,
            description: `Watto's tie-breaker leans ${Math.round(config.tieLean * 100)}/${Math.round((1 - config.tieLean) * 100)} your way instead of his.`,
        });
    }
    if (!s.bribe) {
        out.push({
            value: 'bribe',
            label: 'Bribe Ties',
            emoji: BRIBE,
            description: 'Buy a tie off him outright instead of trusting his cube.',
        });
    }
    return out;
};
exports.rewardChoices = rewardChoices;

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

// Saves a loadout. Trusts nothing from the select: unknown ids, cubes that aren't owned and
// anything past the slot count are dropped, so a stale menu can't field a cube.
exports.setLoadout = function (s, patch, ids) {
    const equipped = [...new Set(ids)].filter(id => s.cubes.includes(id)).slice(0, s.slots);
    s.equipped = equipped;
    patch.equipped = equipped;
    return equipped;
};

// Bought rerolls, in and out. The stock is a plain counter on the profile — spent
// automatically by the first roll that would otherwise bust.
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

// The one line that says plainly what just happened to the player's truguts.
exports.wonLine = function (amount, unlockedIdx, record) {
    const level = unlockedIdx != null ? LEVELS[unlockedIdx] : null;
    return `**Congrats!** You won **${tg(amount)}** truguts`
        + (level ? ` and unlocked **Level ${unlockedIdx + 1} · ${level.name}**` : '')
        + '!' + badge(record);
};

exports.lostLine = (stake, standing) =>
    `**Sorry!** You lost **${tg(stake)}** truguts`
    + (standing ? ` and a **${tg(standing)}** standing` : '')
    + '.';

exports.writeCube = function (profile_ref, user_profile, patch) {
    user_profile.cube = { ...(user_profile.cube || {}), ...patch };
    profile_ref.child('cube').update(patch);
};

// `level` was called `rung` before the rename; a run persisted under the old name still
// resolves rather than indexing LEVELS with undefined.
const nodeOf = function (db, member_id) {
    const l = db.ch.cube?.ladders?.[member_id];
    return l ? { ...l, level: Number(l.level ?? l.rung) || 0 } : null;
};

// A live run. Two things share this node and are *not* one: a busted run held open for a reroll
// offer, which has no standing to bank and nothing to push into, and a roll parked on a tie,
// which has no result yet at all. Keeping both out here is what lets every existing caller —
// bank, push, prestige — keep working unchanged.
const ladderOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && !l.dead && !l.tie ? l : null;
};
exports.ladderOf = ladderOf;

// A run that just died and still has a reroll on the table. Holds the state the roll was made
// from, so spending a reroll can replay exactly that roll.
exports.deadOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && l.dead ? l : null;
};

// A roll that came back even and is waiting on an answer: roll Watto's tie-breaker, or buy the
// tie off him. Nothing about it is settled — that's the whole reason it's parked — so it holds
// everything the settlement will need, and it blocks every other action until it's answered.
const tieOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    // The level is checked here rather than at the point of use because a parked tie *blocks* the
    // board: one stored against a level the data no longer has would throw on every render and
    // leave the player with no way back. Refused here it is simply invisible, and the next call
    // clears the node on its way past.
    return l && l.tie && LEVELS[l.level] ? l : null;
};
exports.tieOf = tieOf;

// ---------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------

// Cryptographic RNG rather than Math.random — this decides real trugut payouts. Every draw in
// this section goes through these two.
const chance = p => crypto.randomInt(0, 10000) < Math.round(p * 10000);

// Which side Watto leans on today. Derived from the date rather than stored: no rollover race,
// no extra node to keep in sync, and the same day always leans the same way — so two players
// rolling an hour apart are playing the same cube. Memoised because a nine-cube roll would
// otherwise hash the date nine times.
//
// Eastern time, matching the daily challenge boundary, so the cube turns over when the rest of
// the bot's day does.
//
// **The salt is secret and has to be.** A lean is unguessable to a human — spotting 55/45 needs
// a few hundred cubes tallied inside one Eastern day, through the noise of every special cube
// that forces a side — but this repo is public, so a hardcoded salt makes the day's favoured
// side a two-line script rather than an inference. Knowing it is worth a great deal: calling the
// favoured side lifts a level 5 run from 1-in-32 to about 1-in-14, which is an EV of 2.27 on a
// ladder that is otherwise exactly fair. Out of the source and into the environment, so the
// property that makes the lean fun — everyone rolling the same cube — costs nothing to keep.
const LEAN_SALT = process.env.CUBE_LEAN_SALT;
if (!LEAN_SALT) {
    console.warn('[cube] CUBE_LEAN_SALT is not set — the daily lean is derived from a public '
        + 'fallback and can be computed by anyone with the source. Set it in the environment.');
}
let leanCache = null;
const dailyLean = function () {
    const day = moment().tz('America/New_York').format('YYYY-DDDD');
    if (!leanCache || leanCache.day !== day) {
        const h = crypto.createHash('sha256')
            .update(`${LEAN_SALT || 'chance-cube-lean'}:${day}`).digest();
        leanCache = { day, side: h[0] % 2 ? 'red' : 'blue' };
    }
    return leanCache;
};
exports.dailyLean = dailyLean;

// Every plain cube in the game comes through here, so the lean applies to the whole table at
// once — the level's own cubes and any a special spawns.
const rollSide = function () {
    const { side } = dailyLean();
    return chance(config.dayLean) ? side : OTHER[side];
};

const rollCubes = function (n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(rollSide());
    return out;
};
exports.rollCubes = rollCubes;

// Watto's tie-breaker. Deliberately *not* a plain cube and deliberately not drawn through
// `rollSide`: the daily lean favours a colour, and this thing favours the house — it leans
// against whatever you called, whichever colour that is. Qui-Gon's Nudge doesn't remove the
// weight, it turns it around, so a tie is always somebody's coin flip and never a fair one.
const rollTiebreak = function (call, nudge) {
    const favoured = nudge ? call : OTHER[call];
    return chance(config.tieLean) ? favoured : OTHER[favoured];
};
exports.rollTiebreak = rollTiebreak;

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
// — or that three of them did anything at all — was left to be inferred from a row of emoji. The
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
const multSteps = function (start, pays, side) {
    let running = Number(start) || 0;
    return (pays || []).map((p) => {
        const paid = p.kind === 'greed' || (!!side && p.side === side);
        if (paid) running += p.kind === 'greed' ? config.greedBonus : config.multBonus;
        // Past tense, and that is the point of saying it here rather than reusing the note the
        // first pass wrote. On the throw a Multiplier is a promise — `+1× if red wins` — and by
        // this frame the roll knows whether red did. A face that named the losing side gets a line
        // of its own rather than being skipped: it was on the table, it is still on the table, and
        // silence would read as a bug.
        const note = p.kind === 'greed'
            ? `${p.label} — payout **+${config.greedBonus}×**.`
            : paid
                ? `${p.label} — ${chip(p.side)} took it: **+${config.multBonus}×**.`
                : `${p.label} — ${chip(p.side)} didn't win. **No bonus.**`;
        return { at: p.at, paid, note, multiple: running };
    });
};
exports.multSteps = multSteps;

// Payouts are a clean double per level, cumulative on the original stake. `mult` is whatever
// the Greed and Multiplier cubes have piled on during the run — it rides the standing rather
// than being re-earned, so a multiplier caught early compounds all the way up.
// A run carries its **payout multiple** as live state rather than reading it off the level, because
// a paying cube nudges that multiple and the nudge then rides the ladder up with everything else.
//
// The multiple doubles on every push, exactly as `LEVELS` does, and a paying face adds to it:
//
//     L1  ×2   →  L2  ×4  ── a Multiplier lands ──▸ ×5
//                  L3  ×10      L4  ×20      L5  ×40
//
// So a +1 caught early is worth +8 by the top, and one caught on the last rung is worth +1. That is
// the whole point of catching one early, and it is what neither of the two previous shapes did:
// multiplying the *whole* payout made a single cube worth 32× a stake at Level 5 and exploded on a
// copying rack, while adding to the level's own multiple left the bonus shrinking to 3% of a ×32 —
// unplayable at depth however large the number was made.
const bankPayout = (stake, multiple) => Math.floor(stake * (Number(multiple) || 0));
exports.bankPayout = bankPayout;

// What one push does to the multiple: the ratio between this level's multiple and the one below.
// Read off `LEVELS` rather than hardcoded at 2, so re-tuning the ladder carries the multiple with it.
const ladderStep = levelIdx => (levelIdx > 0
    ? LEVELS[levelIdx].payout / LEVELS[levelIdx - 1].payout
    : 1);
exports.ladderStep = ladderStep;

// The multiple a roll is played for: whatever the run carried, doubled for this level, plus what
// this roll's greed added. A run with nothing carried starts at the opening level's own multiple.
const levelMultiple = (levelIdx, carried, added = 0) => (Number(carried) || 0
    ? (Number(carried) || 0) * ladderStep(levelIdx) + added
    : LEVELS[levelIdx].payout + added);
exports.levelMultiple = levelMultiple;

// ---------------------------------------------------------------------------
// Special cubes in a roll
// ---------------------------------------------------------------------------

// A run carries a **set** of cubes, not a line it rebuilds each level. The set is a plain array of
// slots: a special cube's id, or `null` for an ordinary cube. It is the whole memory of a climb —
// a cube a Tusken culled at Level 2 is missing from every throw after it, and a special that Fode
// or Padme wrote over is an ordinary cube for the rest of the run.
//
// Two functions, and the split is the point:
//
//   growSet   what you own going into this level — one cube to open with, two more every level
//   throwSet  what those cubes did this time
//
// The cubes persist; the sides never do. That is what keeps every level a fresh 50/50 call instead
// of a defence of the last one, while still letting damage compound down the climb.

// How many cubes a run draws out of the bag over a whole climb: two a level for every level above
// the first. Level 1's cube is not one of them.
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
const fillBag = function (equipped) {
    const n = bagSize();
    const specials = (equipped || []).filter(id => specialById(id)).slice(0, n);
    const bag = [...specials, ...Array.from({ length: Math.max(0, n - specials.length) }, () => null)];
    for (let i = bag.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
};
exports.fillBag = fillBag;

// Adds this level's cubes to the set, off the top of the bag. Returns both, because drawing spends
// the bag and the run has to carry what's left of it.
const drawCubes = function (set, bag, levelIdx) {
    const rest = [...(bag || [])];
    // Level 1 opens the run, with one ordinary cube that doesn't come out of the bag.
    if (levelIdx === 0) return { set: [null], bag: rest };

    const out = [...(set || [])];
    for (let i = 0; i < config.cubesPerLevel && rest.length; i++) out.push(rest.shift());

    // A set with nothing ordinary left in it has nothing to decide a roll. Only reachable when the
    // rack fills the bag outright and the opening cube has since been destroyed.
    if (out.length && !out.some(slot => !slot)) out[out.length - 1] = null;
    // A mirrored set can already be at the ceiling; adding to it would put the table past what a
    // line can hold. Trimmed from the end, so the cubes a level just added are the ones that don't
    // fit rather than the ones that have been carried the furthest.
    return {
        set: out.length > config.maxCubes ? out.slice(0, config.maxCubes) : out,
        bag: rest,
    };
};
exports.drawCubes = drawCubes;

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
// Every read of a stored set goes through `decodeSet` and every write through `encodeSet`; nothing
// else in the node needs this, because no other stored array can contain a null.
const encodeSet = set => (set || []).map(id => id || 0);
exports.encodeSet = encodeSet;

const decodeSet = raw => Object.values(raw || {}).map(v => (v ? String(v) : null));
exports.decodeSet = decodeSet;

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
const throwSet = function (set) {
    const order = [...(set || [])];
    for (let i = order.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order.map(id => {
        const special = id ? specialById(id) : null;
        return {
            side: rollSide(),
            special,
            face: special ? special.faces[crypto.randomInt(0, special.faces.length)] : null,
        };
    });
};
exports.throwSet = throwSet;

// How a face is keyed in the lifetime tallies. The kind alone isn't enough — Shmi's four red and
// one blue are both `side`, and the Multiplier's two halves are both `mult` — and those are exactly
// the splits worth seeing. Safe as a Firebase key: no dots, slashes or brackets.
const faceKey = f => (f.side ? `${f.kind}:${f.side}` : f.kind);
exports.faceKey = faceKey;

// The emoji for one position. Exactly one glyph, always — a face either *is* a side, in which case
// it draws as that side, or it *does* something, in which case it draws as the thing it does and
// counts toward neither colour. Nothing is ever composed out of two glyphs, because a position that
// draws as two is a position players count as two.
const faceEmoji = function (cube) {
    if (cube.wild) return DyeGon;
    // A face with no emoji of its own is an ordinary cube's face — the plain half of a hybrid — and
    // draws as whichever side it rolled, exactly like the cube it stands in for.
    if (cube.face && cube.face.emoji) return cube.face.emoji;
    return FACES[cube.side] || ChanceCube;
};
exports.faceEmoji = faceEmoji;

// What the reveal animates: one emoji per position, snapshotted *before* resolution, because
// resolving inverts and reorders the line the payout frame draws.
exports.rolledFaces = line => line.map(faceEmoji);

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
// Returns the final line, notes describing what fired (in fire order, for the payout frame),
// and the modifiers the caller settles with.
const resolveLine = function (line, call) {
    // Every special face **as thrown**, for the lifetime tallies on the rack screen. Taken here,
    // before anything resolves, because resolution rewrites faces — an invert strips a Shmi's art,
    // a bind swaps a Binder for a hybrid — and the tally is about what the cube rolled, not what it
    // was left as. Hybrids are skipped: their ids are pairings rather than cubes, they never appear
    // on the rack, and tracking them would add a key per combination.
    const faceLog = line
        .filter(c => c.special && c.face)
        .map(c => ({ id: c.special.id, key: faceKey(c.face) }));

    const notes = [];
    const broken = [];
    // What this roll **adds** to the run's payout multiplier, not a factor to scale it by. Starts at
    // zero because a roll with no paying faces in it adds nothing; the run's own ×1 lives on the
    // ladder and the caller sums the two.
    let mult = 0;
    let shortcut = false;
    let rerolls = 0;
    let ended = null;

    // Every face that moves the payout multiple, recorded **where the multiple is actually moved**
    // rather than reconstructed afterwards from the line. That is the whole reliability of phase two
    // of the reveal: what plays back on screen is the same list of additions that got paid, in the
    // same order, so the walk cannot drift from the number at the end of it. See `multSteps`.
    const pays = [];

    const label = c => `${faceEmoji(c)} **${c.special.name}**`;
    const note = (c, text) => notes.push(`${label(c)} — ${text}`);

    // A face either *is* a side or *does* a thing. Every position starts life as a plain cube with
    // a rolled side; a special that lands an effect face on one takes that side away, so the
    // position holds its place in the line and contributes to neither colour.
    //
    // This is what stops a face having to say two things at once, which is what forced effect faces
    // to be drawn as a colour square plus an effect and made a seven-cube line read as nine. It also
    // means an effect takes a cube out of the count without shortening the line, so even counts are
    // now common — survivable only because a tie goes to Watto's tie-breaker instead of the house.
    const SIDED = new Set(['wild', 'side']);
    for (const c of line) {
        if (c.face && !SIDED.has(c.face.kind)) c.side = null;
    }

    for (const c of line) {
        if (!c.face) continue;
        switch (c.face.kind) {
            case 'end':
                // RIPratts. Whether he actually ends the run isn't decided here — it depends on
                // whether he is still on the table once the effects have finished with it. See
                // below the second pass.
                note(c, '**the run ends here.**');
                break;
            case 'broken':
                // Wipeout. Handled in the **second** pass, not here — see the `broken` case there.
                break;
            case 'wild':
                c.side = call;
                note(c, `landed on ${chip(call)}.`);
                break;
            case 'side':
                c.side = c.face.side;
                note(c, `came up ${chip(c.face.side)}.`);
                break;
            case 'greed':
                mult += config.greedBonus;
                note(c, `payout **+${config.greedBonus}×**.`);
                pays.push({ cube: c, kind: 'greed', side: null, label: label(c) });
                break;
            case 'mult':
                // The one face that *names* a side without being one: it says which way it pays,
                // and like every other effect face it counts toward neither. Whether it actually
                // pays is settled after the second pass, not here — see `mults` below.
                note(c, `**+${config.multBonus}×** if ${SIDES[c.face.side].toLowerCase()} wins.`);
                break;
            case 'shortcut':
                shortcut = true;
                note(c, 'a free clear, if you win the level.');
                break;
            case 'reroll':
                // Banks a reroll and the cube stays on the table. It used to shatter itself here,
                // which meant every single payout reported a shatter and the cube never once
                // rendered as the thing that actually breaks it. Only a wipeout shatters, on this
                // cube as on every other — that is what the shatter line is for.
                rerolls += 1;
                note(c, '**+1 reroll** banked.');
                break;
            default:
                break;
        }
    }

    // The working line. Overwritten, reflected and fused cubes are plain — they carry no face of
    // their own, so nothing can cascade off them.
    let final = line.slice();
    const plain = side => ({ side, special: null, face: null });
    const at = c => final.indexOf(c);
    // A position that counts. Destructive faces work on positions — burning an effect off the line
    // is as legitimate as burning a cube — but anything that *copies* or *fuses* sides needs a side
    // to work with, and an effect hasn't got one.
    const isCube = c => !!c && !!c.side;
    // A cube destroyed *in place*: it holds its position so the line can draw what happened to it,
    // counts toward neither side, and is dropped from the set — so the table is genuinely shorter
    // from the next level on, it just doesn't vanish mid-picture. Ben's wings are the only user.
    // `mirrored` is the same picture facing the other way, for art that has a handedness. Ben's
    // left third is the only user: reflected, it has to come back as his right third or the
    // reflection draws him inside out.
    const razed = (emoji, mirrored) => ({
        side: null, special: null, gone: true,
        face: { kind: 'razed', emoji, mirrored },
    });

    // The line as each restructuring face leaves it, in fire order, so the roll can be played back
    // one effect at a time instead of cutting from the throw straight to the aftermath. A step is
    // only recorded when the face actually changed something — a mirror with nothing behind it, or
    // a bind at the end of the line, did nothing worth a frame.
    const steps = [];

    // A copy of a face is a real face and gets its own turn — a cloned Greed pays twice, a
    // reflected Tusken culls twice. That needs a **work queue** rather than a walk over the thrown
    // line, because the line grows turns as it resolves.
    //
    // Two rules bound it, and without them it doesn't terminate:
    //
    //   1. **Only an original hands out turns.** A copy acts, but anything *it* copies is inert.
    //      One level deep, so a Binder cloning a Binder cloning a Binder stops at the second.
    //   2. **A mirror reflected by a mirror never acts.** That is the one cascade with no natural
    //      end — a reflection that reflects reflects again — and it is also the only case the two
    //      rules disagree about. A Binder *cloning* a mirror does work: cloning is a single copy
    //      with a fixed target, so it can't feed itself.
    const queue = line.slice();

    for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        if (!c.face) continue;
        const i = at(c);
        // Destroyed before its turn came round.
        if (i < 0) continue;
        const was = final.map(faceEmoji);
        const noteAt = notes.length;

        // A copy never went through the first pass, so the payout-side half of its face is applied
        // here, the first time it comes up. Originals already had theirs.
        //
        // `mult` and `end` are deliberately absent: both are read off the *resolved* line further
        // down, so a copy of either already counts without being told to. `broken` is absent too —
        // the special shattered once, and the copy carries `gone` across on its own.
        if (c.copy) {
            switch (c.face.kind) {
                case 'greed':
                    mult += config.greedBonus;
                    // A copy gets no entry in `notes` — nothing has ever shown them — but it very
                    // much gets a frame, because it moved the multiple like any other face.
                    pays.push({ cube: c, kind: 'greed', side: null, label: label(c) });
                    break;
                case 'shortcut':
                    shortcut = true;
                    break;
                case 'reroll':
                    rerolls += 1;
                    break;
                default:
                    break;
            }
        }

        // Hands a freshly made copy its own turn, subject to the two rules above. `reflected` marks
        // copies a mirror made, which is the only place rule 2 applies.
        const enliven = function (x, reflected) {
            if (c.copy) return x;
            if (reflected && x.face && x.face.kind === 'mirror') return x;
            x.copy = true;
            queue.push(x);
            return x;
        };
        // Art with a handedness turns around when it is duplicated — Ben's left third becomes his
        // right — so three thirds of him never come back as three of the same. Anything symmetrical
        // declares no counterpart and is copied as it stands.
        const turned = function (src) {
            const x = { ...src, copy: false };
            const f = x.face;
            if (f && f.mirrored) x.face = { ...f, emoji: f.mirrored, mirrored: f.emoji };
            return x;
        };

        switch (c.face.kind) {
            case 'mirror': {
                // A mirror standing in the line. The `n` cubes behind it are written onto the
                // `n` positions in front of it, nearest the glass first — *overwriting* what
                // was there, so the line never changes length. [A B 🪞 C D] becomes
                // [A B 🪞 B A]: C and D are gone, not pushed along.
                //
                // Every reflected cube now cancels its original in the count, which is the
                // point of the thing — a full reflection hands the decision to the mirror's own
                // side and whatever lies beyond the reflection.
                //
                // Only cubes reflect. An effect standing behind the glass has no side to copy, so
                // it passes straight through and the position opposite it is left as it was —
                // a mirror duplicating effects would cascade, which is the one thing the two-pass
                // resolution exists to prevent.
                const left = final.slice(0, i).reverse();
                if (!left.length) {
                    note(c, 'nothing to reflect.');
                    break;
                }
                // **The reflection completes itself.** Where there aren't enough cubes on the right
                // to receive it, the mirror puts new ones there — it duplicates the table rather
                // than being truncated by the end of the line. Capped at `maxCubes`, because a
                // mirror standing at the very end of a full set would otherwise nearly double it,
                // and those cubes carry into every level above.
                const wanted = Math.min(left.length, Math.max(0, config.maxCubes - (i + 1)));
                if (wanted < 1) {
                    note(c, 'no room to reflect.');
                    break;
                }
                // **A true image of the line, special cubes included.** A Binder behind the glass
                // comes back as a Binder, drawing the face its original drew and counting whatever
                // its original counts — so `🟥 :binder: 🪞` reflects to `🟥 :binder: 🪞 :binder: 🟥`.
                //
                // Nothing cascades, and it can't: pass two walks the cubes that were **thrown**, and
                // a reflection was never thrown, so a copied effect gets no turn of its own. It is
                // an image this roll and a real cube from the next one, which is how a Mirror ends
                // up handing you a **second copy** of something off your own rack.
                let copied = 0;
                let made = 0;
                for (let k = 0; k < wanted; k++) {
                    const at = i + 1 + k;
                    if (at >= final.length) made++;
                    final[at] = enliven(turned(left[k]), true);
                    copied++;
                }
                // Anything the mirror skipped past that has no cube yet is filled in, so the line
                // never comes back with a hole in it.
                for (let k = 0; k < final.length; k++) if (!final[k]) final[k] = plain(rollSide());
                note(c, copied
                    ? `reflected the ${copied} cube${copied > 1 ? 's' : ''} behind it`
                    + (made ? `, conjuring **${made}** more` : '') + '.'
                    : 'nothing behind it to reflect.');
                break;
            }
            case 'invert':
                // Cubes only. An effect has no side to flip, and giving it one here would sneak it
                // back into the count through the back door.
                final.forEach(x => {
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
                note(c, 'inverted every cube.');
                break;
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
                broken.push(c.special.id);
                final.splice(i, 1);
                note(c, 'shattered — the table is a cube shorter.');
                break;
            case 'burn':
                if (i + 1 >= final.length) {
                    note(c, 'nothing on its right to burn.');
                    break;
                }
                final.splice(i + 1, 1);
                note(c, 'burned the cube on its right.');
                break;
            case 'clone': {
                // The cube on its right becomes a copy of the cube on its left. It destroys
                // nothing and adds nothing — the line is the same length, one position of it is
                // just now a duplicate — and it copies whatever is there, so a special on the left
                // comes out twice. The copy doesn't act this roll: pass two walks the cubes that
                // were **thrown**, and a copy was never thrown.
                const hasLeft = i - 1 >= 0;
                const hasRight = i + 1 < final.length;
                if (!hasLeft && !hasRight) {
                    note(c, 'nothing beside it.');
                    break;
                }
                // **At the head of the line it has nothing to copy, so it destroys instead.** The
                // cube's whole idea is that the position on its right becomes something else; with
                // no source for that, taking it off the table is the honest version of the same
                // sentence, and it beats the cube doing nothing at all.
                if (!hasLeft) {
                    final.splice(i + 1, 1);
                    note(c, 'nothing to copy — took the cube on its right off the table.');
                    break;
                }
                const src = final[i - 1];
                // Turned, like a reflection: cloning Ben's left third onto the right would
                // otherwise put two of the same third on the table. A cloned wing is junk either
                // way — it carries `gone` across, so it drops out of the set next level.
                const copy = enliven(turned(src), false);
                // **At the tail it makes room rather than giving up** — the one case where a clone
                // lengthens the line, and the only reason it needs the ceiling.
                if (!hasRight) {
                    if (final.length >= config.maxCubes) {
                        note(c, 'no room to copy.');
                        break;
                    }
                    final.push(copy);
                    note(c, `copied ${faceEmoji(src)} onto a new cube.`);
                    break;
                }
                final[i + 1] = copy;
                note(c, `copied ${faceEmoji(src)} onto the cube on its right.`);
                break;
            }
            case 'cull': {
                // One other cube, anywhere in the line, gone.
                const others = final.map((_, j) => j).filter(j => j !== i);
                if (!others.length) {
                    note(c, 'nothing else on the table.');
                    break;
                }
                final.splice(others[crypto.randomInt(0, others.length)], 1);
                note(c, 'took a cube off the table.');
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
                    note(c, 'nothing beside it.');
                    break;
                }
                const wings = c.face.wings || {};
                if (right) final[i + 1] = razed(wings.right, wings.left);
                if (left) final[i - 1] = razed(wings.left, wings.right);
                note(c, `destroyed the cube${left && right ? 's either side' : ' beside it'}.`);
                break;
            }
            case 'pair': {
                // Fode and Beed: two heads that never agree. A cube is **inserted** either side of
                // him — nothing already on the table is overwritten, the line simply gets two
                // longer — and the two are always opposite sides, so the pair is a wash in the
                // count and pure structure. What it really does is push his neighbours apart,
                // which is what everything positional downstream then has to deal with.
                if (final.length + 2 > config.maxCubes) {
                    note(c, 'no room for a pair.');
                    break;
                }
                const left = rollSide();
                final.splice(i + 1, 0, plain(OTHER[left]));
                final.splice(i, 0, plain(left));
                note(c, `slipped ${chip(left)} and ${chip(OTHER[left])} in either side of it.`);
                break;
            }
            case 'twins': {
                // Padme, twice over: the same two insertions, but the pair **match**. A two-cube
                // swing rather than a wash, and the only face in the game that can hand one side
                // two cubes out of nowhere.
                if (final.length + 2 > config.maxCubes) {
                    note(c, 'no room for twins.');
                    break;
                }
                const side = rollSide();
                final.splice(i + 1, 0, plain(side));
                final.splice(i, 0, plain(side));
                note(c, `slipped twin ${chip(side)} in either side of it.`);
                break;
            }
            default:
                break;
        }

        // Worth a frame only if the line moved under it. The note that came with it is the label —
        // these have always been written and never shown anywhere.
        const now = final.map(faceEmoji);
        if (now.length !== was.length || now.some((e, k) => e !== was[k])) {
            // Where the acting cube ended up, so the frame can point at it. Read *after* the effect
            // because inserting and destroying move it — a Padmé slipping a cube in on its left
            // shifts it one to the right. `-1` when the cube destroyed itself out of the line.
            steps.push({ faces: now, note: notes[noteAt] || null, at: at(c) });
        }
    }

    // **Ratts only ends the run if he is still standing when the dust settles.** He is checked
    // against the *resolved* line rather than the thrown one, so a burn, a cull, a raze or a mirror
    // writing over his position takes him off the table and the run survives — the cubes can save
    // you from him. That is the whole reason the check lives here instead of in the first pass.
    //
    // A reflected Ratts counts: the copy is on the table like anything else. `gone` positions don't
    // — a destroyed cube is still drawn, but it isn't there.
    const ender = final.find(c => !c.gone && c.face && c.face.kind === 'end' && c.special);
    if (ender) ended = ender.special.name;

    // **Multipliers are counted off the resolved line too, for the same reason.** Collected here
    // rather than in the first pass, so a Multiplier a Tusken culled or a clone wrote over doesn't
    // pay from beyond the grave — and, the other way round, a mult face the Binder cloned or the
    // Mirror reflected pays **twice**, because there really are two of them on the table.
    //
    // They compound: every surviving face whose named side ends up winning multiplies the payout
    // again, so two on the winning side is ×4. `applyMults` does that folding, and the caller runs
    // it last of all — after the tie-breaker, so a tie broken your way still cashes them in.
    const mults = [];
    for (const c of final) {
        if (c.gone || !c.face || c.face.kind !== 'mult') continue;
        mults.push(c.face.side);
        pays.push({ cube: c, kind: 'mult', side: c.face.side, label: label(c) });
    }

    // The paying faces in reading order, each tied to the position it ended up on so the walk can
    // point at it. Sorted here rather than collected in order because greed is scored off the
    // *thrown* line and multipliers off the resolved one — two passes, one row.
    //
    // A greed the line destroyed after it paid has no position left and comes back `-1`, which
    // draws as a frame with no pointer on it. It still gets its frame: it paid, and a step missing
    // from the walk would leave the multiple jumping with nothing on screen to explain it.
    const payOrder = p => (p.at < 0 ? Number.MAX_SAFE_INTEGER : p.at);
    const payWalk = pays
        .map(p => ({ kind: p.kind, side: p.side, label: p.label, at: final.indexOf(p.cube) }))
        .sort((a, b) => payOrder(a) - payOrder(b));

    // Only positions that are cubes are counted. `red` is counted rather than inferred from the
    // length, because the line now holds positions that are neither colour.
    const cubes = final.filter(isCube);
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

    return {
        // `cubes` is the sides that counted — effects are not in it, so it is shorter than the line
        // whenever one landed. That is deliberate: it drives the majority and the lifetime `rolled`
        // tallies, and an effect face didn't land on a colour, so it shouldn't be tallied as one.
        //
        // `faces` is every *position*, one emoji each, for the payout frame. So the two differ in
        // length, and anything indexing one against the other would be wrong — see `decidedAt`.
        cubes: cubes.map(c => c.side),
        faces: final.map(faceEmoji),
        // What the run carries into the next level: one slot per surviving position, holding the
        // special that is still sitting on it or `null` for an ordinary cube. Everything the roll
        // did to the table is in here — cubes destroyed are simply absent, a special written over
        // by Fode, Padme, a mirror or a bind comes back as `null`, and so does one that broke.
        //
        // `gone` positions are dropped. A cube razed by Ben, or shattered by a wipeout, or spent by
        // the Reroll Cube paying out, is still drawn on *this* line so the player can see what
        // happened to it — but it is not on the table any more, and the next level is a cube short
        // because of it. That is why this is shorter than `faces` whenever something was destroyed,
        // and the only place the two intentionally disagree.
        set: final.filter(c => !c.gone).map(c => (c.special ? c.special.id : null)),
        majority,
        pure,
        swept,
        // `mult` is everything already earned outright — the Greed Cube. `mults` is the sides the
        // Multiplier Cubes landed on, still unspent, because whether they pay depends on who wins
        // and a tie doesn't know that yet. See `applyMults`.
        mult,
        mults,
        // The same additions `mult` and `mults` describe, itemised and in line order, for phase two
        // of the reveal to count out one at a time. Purely a playback record — nothing reads a
        // payout off it.
        pays: payWalk,
        shortcut,
        // Rerolls this roll banked, cube ids knocked out for the rest of the climb, and the cube
        // that ended the run outright, if one did.
        rerolls,
        broken,
        ended,
        notes,
        // One entry per restructuring face that actually moved the line, in fire order — the reveal
        // plays these back so the effects happen on screen rather than between frames.
        steps,
        faceLog,
        specials: line.filter(c => c.special).map(c => c.special.id),
    };
};
exports.resolveLine = resolveLine;

// The cube at which one side became the guaranteed majority. Past this point the rest of
// the roll cannot change who won.
//
// Indexes into the *counted* cubes, which is only the same thing as the drawn line when no special
// landed at all. That is exactly when the caller uses it — any special in the roll and the reveal
// runs to the end anyway, because a special can rewrite the line after it lands.
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

// How many cubes each reveal frame shows. Big rolls come out a few at a time like a slot
// machine — but only up to the cube that settles it. Once the majority is certain there is
// no tension left to milk, so everything still face-down lands at once.
//
// Capped at `maxRevealFrames` steps because each one is a message edit, and nine cubes
// revealed one at a time would spend the whole rate limit on a single roll.
exports.revealSteps = function (n, settled) {
    if (n <= 1) return [n];
    const stops = [];
    const step = Math.max(1, Math.ceil(settled / config.maxRevealFrames));
    for (let shown = step; shown < settled; shown += step) stops.push(shown);
    stops.push(settled);
    if (settled < n) stops.push(n);
    return stops;
};

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const chip = side => `${FACES[side]} ${SIDES[side]}`;
exports.chip = chip;

// The cubes on the table: the first `shown` face-up, the rest still tumbling. Spaced out
// and alone on their own line, because embeds don't render `#` headings and there is no
// other way to draw them any larger.
//
// Takes emoji, not sides, because a rolled line shows special cubes as the face they landed
// on, and a resolved line redraws them after the effects — see `rolledFaces` and `faceEmoji`.
// With `maxCubes` uncapped a row has no length the game will stop it reaching, and an embed
// description very much does: discord.js **throws** past 4,096 rather than trimming, and a custom
// emoji costs about thirty characters however small it looks. So the row is budgeted here, at the
// one place every frame draws through — a run whose table got away from it should read as a triumph,
// not as a crash.
//
// Draw as many as fit, then say how many are missing. The budget leaves room for everything else on
// the frame: header, called side, Watto's line, the payout.
const LINE_BUDGET = 2600;
const fit = function (list, sep) {
    const gapAt = sep || (() => CUBE_GAP);
    let len = 0;
    let out = '';
    for (let i = 0; i < list.length; i++) {
        const piece = (i ? gapAt(i) : '') + list[i];
        // Leave room for the `+N` that replaces what doesn't fit.
        if (len + piece.length > LINE_BUDGET - 12) {
            return `${out}${CUBE_GAP}**+${list.length - i}**`;
        }
        out += piece;
        len += piece.length;
    }
    return out;
};

// The cubes on the table: the first `shown` face-up, the rest still tumbling. Spaced out
// and alone on their own line, because embeds don't render `#` headings and there is no
// other way to draw them any larger.
//
// Takes emoji, not sides, because a rolled line shows special cubes as the face they landed
// on, and a resolved line redraws them after the effects — see `rolledFaces` and `faceEmoji`.
const faces = (emoji, shown) => fit(emoji.map((e, i) => (i < shown ? e : ChanceCube)));
exports.faces = faces;

// The same row, with a pointer at the cube currently resolving.
//
// It goes in the **gap before** the cube rather than under it. Emoji can't be underlined, and their
// widths line up with nothing else — any marker on a second row would drift further out of true the
// longer the line got, and be worst exactly where it matters most. A glyph in the separator is
// unambiguous at any length, and small enough beside an emoji that it never reads as a cube.
// Both sides, pointing inward, so the cube is bracketed rather than merely preceded — a single
// leading arrow is ambiguous about whether it belongs to the cube before it or the one after.
//
// Deliberately `▸◂` and not `▶◀`: the filled-triangle pair has emoji presentation on most platforms
// and would render cube-sized, which would break the one-glyph-per-position reading the whole row
// depends on. These two are text-only and stay small beside an emoji.
// The arrows **take the place of the gaps** rather than sitting inside them, so nothing on the row
// moves when the pointer appears — the cubes stay exactly where they were on the frame before, and
// only the two separators either side of the acting cube change character. A marker that shunted
// the row along would be a marker you had to re-find every frame.
// **Single angle quotes, and the width is the whole point.** They replace the two gaps either side
// of the acting cube rather than squeezing in beside them, so the row does not grow, and because
// they are punctuation — roughly a space wide — swapping a gap for one barely moves anything. The
// cubes stay where they were on the previous frame and only two separators change character.
//
// `▸◂` was tried first and is too heavy: Geometric Shapes glyphs run about twice the width of a
// space, so the marked cube visibly shouldered its neighbours apart every time the pointer moved.
//
// A pointer on a **line underneath** was also tried and abandoned. Aligning under emoji needs a
// spacer exactly as wide as one, and no text character is: U+3000, the widest invisible option,
// still drifted — and drift accumulates rightward, so it was worst on the long lines where the
// pointer matters most. It could only be made exact with a transparent custom emoji uploaded to the
// guild, which is a real option if this ever needs revisiting, but it is not worth an upload when a
// glyph in the gap cannot be wrong at any length.
const MARK_L = '›';
const MARK_R = '‹';
const facesMarked = (emoji, at) => fit(
    emoji.map((e, i) => (i === at ? `${MARK_L}${e}${MARK_R}` : e)),
    // The gap before the marked cube is carried by `›`, and the gap after it by `‹`, so neither is
    // drawn again. At either end of the row there is no gap to take over and the mark simply sits
    // outside the line, which costs nothing because there is nothing beyond it to push.
    i => ((i === at || i === at + 1) ? '' : CUBE_GAP),
);
exports.facesMarked = facesMarked;

// Sides in, plain faces out — the fallback for a run persisted before cubes stored their own
// rendered faces.
const sideFaces = sides => (sides || []).map(side => FACES[side] || ChanceCube);
exports.sideFaces = sideFaces;

// Watto's tie-breaker, set apart from the line by a **visible mark**, not by spacing. It is not one
// of the level's cubes — it's his, it came out of his pocket after the line failed to decide, and
// it must never read as the roll having grown a cube.
//
// The dot carries that on its own precisely because spacing turned out to be the thing that
// couldn't: a separator that has to survive being glanced at gets a character. The gaps either side
// of it are only breathing room, so they stay in step with the gap between cubes rather than
// competing with it.
const BREAKER_GAP = `${CUBE_GAP}${CUBE_GAP}`;
const withBreaker = (line, side) => `${line}${BREAKER_GAP}·${BREAKER_GAP}${side ? FACES[side] : ChanceCube}`;
exports.withBreaker = withBreaker;

// What the tie-breaker is weighted at, said out loud. This is the only number in the game that is
// quietly against the player, so it doesn't get to stay quiet — and Qui-Gon's Nudge would be
// invisible otherwise, since all it does is turn the same weight around.
const tieOddsLine = function (s) {
    const pct = Math.round(config.tieLean * 100);
    return s.nudge
        ? `${SlyGon} **Qui-Gon's Nudge** — his cube leans **${pct}/${100 - pct}** *your* way.`
        : `${Whatto} His cube is weighted **${pct}/${100 - pct}** against you.`;
};
exports.tieOddsLine = tieOddsLine;

// An xp bar of `goal` segments: green `new` tiles behind you for what's already done, then
// the blue `filled` tile marking the one being attempted, empty tiles ahead. `current` is
// off on an end screen — nothing is being attempted there, so nothing should look live.
// `failed` marks the segment that was just attempted and lost, so a run that dies at the ceiling
// leaves a visible mark on the meter rather than quietly reverting to an empty one. Progress
// itself is untouched — a failed clear costs the run, not the clears already banked.
const barOf = (done, goal, current, failed) => Array.from({ length: goal }, (_, i) => {
    if (i < done) return bar_symbols.new;
    if (i !== done) return bar_symbols.empty;
    if (failed) return bar_symbols.error;
    return current ? bar_symbols.filled : bar_symbols.empty;
}).join('');
exports.barOf = barOf;

// Clears toward whatever the next milestone is — a level, or the prestige offer at the top of
// the ladder. Whether it shows at all is the frame's call, see `playEmbed`.
const progressLine = function (s, current, failed) {
    const goal = goalOf(s);
    const bar = barOf(Math.min(s.clears, goal), goal, current, failed);
    // The padlock stays shut for the whole climb and springs open on exactly one screen: the
    // results frame whose clear filled the meter, which passes a state with `clears` at the
    // goal. Every other frame — including the idle board after the level opened, whose counter
    // has already reset toward the *next* one — is still looking at something locked.
    const open = s.clears >= goal;
    // A level unlock wears the padlock; a prestige wears the grandmaster.
    return s.unlocked >= MAX_LEVEL
        ? `${bar} → ${PRESTIGE} **Prestige ${s.prestige + 1}**`
        : `${bar} → **${open ? '🔓' : '🔒'} Level ${s.unlocked + 2}**`;
};
exports.progressLine = progressLine;

// A level opened by a clear on a run that is *still standing*. The choice line underneath it is
// the offer to take the standing straight into it, which is the whole point of not banking.
exports.openedLine = idx =>
    `🔓 ${LEVELS[idx].emoji} **Level ${idx + 1} · ${LEVELS[idx].name}** is open — and you're still standing.`;

// What the next clear is worth, for the end screen. At the top of the ladder the prize is the
// prestige offer rather than another level.
exports.nextUnlockLine = function (s) {
    const next = LEVELS[s.unlocked + 1];
    if (next) {
        return `Keep playing to unlock ${next.emoji} **Level ${s.unlocked + 2} · ${next.name}** (${next.cubes} dice) **${next.payout}×**`;
    }
    if (canPrestige(s)) {
        return `${PRESTIGE} **Prestige ${s.prestige + 1} is ready** — start the ladder over for a **${tg(maxStakeFor(s.prestige + 1))}** max stake and a pick off Watto's rack.`;
    }
    return `${PRESTIGE} Clear **${TOP_NAME}** to unlock **Prestige ${s.prestige + 1}** — ${config.maxStakeStep}× stakes and a pick off Watto's rack.`;
};

// The paying Pure Cube tiers, read straight off the share table so the help screen can't drift
// from what the pot actually pays.
const payingTiers = () => Object.entries(SWEEP_SHARE)
    .filter(([, share]) => share > 0)
    .map(([n, share]) => `**a pure ${n}** takes ${share >= 1 ? 'the **whole pot**' : `**${Math.round(share * 100)}%**`}`)
    .join(', ');

// Badged the same way records are badged everywhere else in the bot — appended to the value
// that broke, not announced on a line of its own.
const badge = record => (record ? ` ${newrecord}` : '');

// `cubes` is how many are actually on the table, which is only the level's nominal count while the
// run is undamaged — a cull, a raze, a burn or a bind leaves it short, and a Mirror, a Fodé or a
// Padmé leaves it long.
//
// It shows **that number and nothing else.** It used to read `5 of 7 cubes` whenever the two
// disagreed, which was written when the only thing that could move the count was damage — the
// level's own number was the thing you had lost against. Then the line started growing as often as
// it shrinks, and `7 of 5 cubes` reads as an arithmetic error rather than as a windfall. There is
// no framing that works in both directions, and the count on the table is the only one the roll is
// actually played with.
const levelHeader = function (levelIdx, frame) {
    const { record, cubes, cubeRecord, multiple, multRecord } = frame || {};
    const level = LEVELS[levelIdx];
    const n = Number.isFinite(cubes) ? cubes : level.cubes;
    const count = `${n} cube${n === 1 ? '' : 's'}`;
    // The cube-count record is badged on the count itself, the way every other record is badged on
    // the value that broke it. Only ever passed on a paying frame: the count is known the moment the
    // line resolves, but the *player* doesn't know it until the effects have played out, and a badge
    // during the reveal would give away that something grew the line.
    // The multiple shown is the run's, not the level's. They are the same until a paying cube lands;
    // after that the level's own number is no longer what the roll pays, and showing it would be a
    // lie sitting directly above the cubes that made it false. Boosted, it wears bold.
    //
    // Its own record badges here, on the same terms as the count beside it: paying frame only. The
    // multiple is finished the moment the line resolves, but the player watches it build across
    // phase two, and a badge sitting on it from the first frame would announce the ending.
    const base = level.payout;
    const m = Number.isFinite(multiple) && multiple > 0 ? multiple : base;
    const paid = m === base ? `${base}×` : `**${Number(m.toFixed(2))}×**`;
    // Every badge sits on the value it belongs to — the level record on the level, the count record
    // on the count, the multiple record on the multiple. The first of those used to be parked at the
    // end of the line, which read fine while it was the only thing that could be there.
    return `${level.emoji} **Level ${levelIdx + 1} · ${level.name}**${badge(record)}`
        + ` · ${count}${badge(cubeRecord)}`
        + ` · ${paid}${badge(multRecord)}`;
};
exports.levelHeader = levelHeader;

// Watto calls the roll. Cosmetic, so Math.random is fine here.
exports.watto = kind => {
    const lines = WATTO[kind] || [];
    return lines.length ? `*"${lines[Math.floor(Math.random() * lines.length)]}"*` : null;
};

// The whole bank-or-push decision as one line: the two numbers, side by side. `mult` is the
// run's accumulated payout multiplier, so a Greed or Multiplier cube shows up in both numbers
// rather than surprising the player at the bank.
// `multiple` is the run's live payout multiple, so the push figure is simply it stepped one rung up
// the ladder — a boosted multiple carries its boost into the number being offered.
const choiceLine = function (stake, levelIdx, record, multiple) {
    const standing = bankPayout(stake, multiple);
    const next = LEVELS[levelIdx + 1];
    return next
        ? `Bank **${tg(standing)}**${badge(record)} or keep playing for **${tg(bankPayout(stake, multiple * ladderStep(levelIdx + 1)))}**`
        : `Bank **${tg(standing)}**${badge(record)}`;
};
exports.choiceLine = choiceLine;

exports.errorEmbed = (title, desc) => new EmbedBuilder()
    .setTitle(`${WhyNobodyBuy} ${title}`)
    .setDescription(desc)
    .setColor('#ED4245');

// Lifetime record and per-side rates, for the start screen only — mid-roll they would just
// be noise around the cubes. Percentages are of this player's own history, so someone who
// has never rolled gets nothing at all rather than a wall of dashes.
const statsFields = function (s) {
    const calls = s.calls.blue + s.calls.red;
    if (!calls) return [];
    const rolled = s.rolled.blue + s.rolled.red;
    const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
    const rates = side => `${FACES[side]} picked **${pct(s.calls[side], calls)}**`
        + ` · won **${pct(s.wins[side], s.calls[side])}**`
        + ` · rolled **${pct(s.rolled[side], rolled)}**`;

    return [
        {
            name: 'Your record',
            // Once you've prestiged, "deepest level" stops saying anything — you've been to the
            // top of the ladder and handed it back, so a Level 2 on the current climb would read
            // as a downgrade. The prestige takes its place as the mark of how far you've got, and
            // brings the stake ceiling it bought along with it.
            value: (s.prestige > 0
                ? `${PRESTIGE} Prestige **${s.prestige}** · max stake **${tg(s.maxStake)}**`
                : `${LEVELS[s.bestLevel].emoji} Deepest **Level ${s.bestLevel + 1} · ${LEVELS[s.bestLevel].name}**`)
                + `\n💰 Best standing **${tg(s.bestStanding)}**`
                + (s.bestCubes ? `\n${ChanceCube} Biggest roll **${s.bestCubes}** cubes` : '')
                // Only worth a line once a paying face has actually moved it. Without a rack the
                // multiple is just the deepest level's own payout restated, and the line above
                // already says how deep they got.
                + (s.bestMultiple > LEVELS[s.bestLevel].payout
                    ? `\n✖️ Biggest multiple **${Number(s.bestMultiple.toFixed(2))}×**`
                    : '')
                // A live streak belongs on the screen you see right before calling again. The
                // badge marks a streak that *is* the record — a true statement about now,
                // rather than a moment flag that would linger on the board.
                + `\n🔥 ${s.streak ? `On **${s.streak}** in a row · best ` : 'Best streak '}**${s.bestStreak}**`
                + badge(s.streak > 0 && s.streak === s.bestStreak)
                + `\n📈 Won **${tg(s.totalWon)}**  ·  📉 Lost **${tg(s.totalLost)}**`
                // Rerolls and bought ties, on the end of the ledger line rather than a line of
                // their own — and only for a player who has bought either, which is nobody until
                // a prestige hands over the right to.
                + (s.totalSpent ? `  ·  🧾 Spent **${tg(s.totalSpent)}**` : ''),
        },
        {
            name: `${SIDES.blue} vs ${SIDES.red}`,
            value: `${rates('blue')}\n${rates('red')}\n-# *${calls} calls · ${rolled} cubes rolled*`,
        },
    ];
};
exports.statsFields = statsFields;

// The rack: what's equipped, what's on the bench, and any rerolls in stock. Only on the start
// screen, and only for a player who has something to show — everything here is won at prestige,
// so most of the ladder never sees this field at all.
const loadoutFields = function (s) {
    const bench = s.cubes.filter(id => !s.equipped.includes(id));
    const line = ids => ids.map(id => specialById(id)).filter(Boolean)
        .map(sp => `${sp.emoji} ${sp.name}`).join(' · ');
    const fields = [];

    if (s.cubes.length || s.rerolls || s.buyReroll) {
        fields.push({
            name: `Your rack · ${s.equipped.length}/${s.slots} slot${s.slots > 1 ? 's' : ''}`,
            value: [
                s.equipped.length
                    ? line(s.equipped)
                    : `*No special cubes on the table — ${s.cubes.length ? 'load some up' : 'win one at prestige'}.*`,
                bench.length ? `-# *On the bench: ${line(bench)}*` : null,
                s.rerolls || s.buyReroll
                    ? `${emojimap.restart} Rerolls banked **${s.rerolls}**`
                    + (s.buyReroll ? ` · next costs ${tg(s.rerollCost)}` : '')
                    : null,
            ].filter(Boolean).join('\n'),
        });
    }

    // The tie picks get a field of their own rather than a line in the rack, because the rack is
    // headed by a **slot count** and neither of these is a cube, takes a slot or can be equipped.
    // Listed at all for the same reason the bench is: they cost a prestige each and only fire on
    // a roll most climbs never see, so owning one should never be something you have to remember.
    if (s.nudge || s.bribe) {
        fields.push({
            name: 'On a tie',
            value: [
                s.nudge
                    ? `${SlyGon} **Qui-Gon's Nudge** — his tie-breaker leans **${Math.round(config.tieLean * 100)}/${Math.round((1 - config.tieLean) * 100)}** your way`
                    : null,
                s.bribe
                    ? `${BRIBE} **Bribe ties** — next one costs **${Math.round(config.bribeShare * (config.bribeStep ** s.bribes) * 100)}%** of the standing`
                    : null,
            ].filter(Boolean).join('\n'),
        });
    }

    return fields;
};
exports.loadoutFields = loadoutFields;

// The markdown a row of `n` cubes is drawn at. It steps down through four sizes as the row grows —
// `#`, `##`, ordinary text, `-#` — because the cubes getting smaller costs far less than the row
// folding in half, which is what actually stops you counting it. Thresholds live in the tuning data.
const rollSize = function (n) {
    if (n >= config.subtextAt) return '-# ';
    if (n >= config.plainAt) return '';
    if (n >= config.h2At) return '## ';
    return '# ';
};
exports.rollSize = rollSize;

// Run over, one way or the other — the embed turns red or green and the buttons collapse
// to a single "Play again", so there is no ambiguity about whether anything is still live.
const OUTCOME_COLOR = { bust: '#ED4245', bank: '#57F287' };

// The one embed the game lives in. `frame` is the current beat of the run and is the same
// shape whether the cubes are still tumbling, just landed, or already paid out:
//   { levelIdx, context, faces, flavor, lines, outcome }
// `flavor` is Watto's line and gets its own block — he talks first, then the numbers.
// Truguts and the pot sit in the footer so the body is nothing but the roll.
exports.playEmbed = function ({ balance, pot, s, frame }) {
    const levelIdx = frame ? frame.levelIdx : 0;
    // Clears belong to the level they're earned at, so each frame carries the progress state
    // it should draw — or null to leave the meter off. An idle board is Level 1, which only
    // qualifies for a player whose ceiling it still is. The blue "attempting this one" tile
    // comes off as soon as the run has an outcome.
    const barState = frame ? frame.bar : (topOf(s) === 0 ? s : null);
    // A bust only ever carries a bar when the roll was at the ceiling — which is exactly a
    // failed clear, so the attempted segment shows the error tile rather than going blank.
    const bar = barState
        ? progressLine(barState, !frame?.outcome, frame?.outcome === 'bust')
        : null;
    const body = [
        [levelHeader(levelIdx, frame), bar]
            .filter(Boolean).join('\n'),
        // The called side sits directly on top of the cubes it applies to, no gap. `# `
        // renders them at heading size — markdown headings work in an embed *description*
        // but not in a field value, which is why this looked broken while the roll still
        // lived in a field.
        //
        // Long lines step down out of the heading, because nine heading-sized emoji wrap on a
        // phone and a wrapped row of cubes is much harder to count than a smaller one.
        frame ? `${frame.context}\n${rollSize(frame.cubes ?? LEVELS[levelIdx].cubes)}${frame.faces}` : null,
        // Watto gets his own block so his line reads as dialogue rather than as the first
        // bullet of the payout.
        frame?.flavor || null,
        frame ? frame.lines.filter(Boolean).join('\n') : 'Call a side to roll.',
    ];

    const embed = new EmbedBuilder()
        .setTitle(`${ChanceCube} Chuba Cubes`)
        .setColor(OUTCOME_COLOR[frame?.outcome] || COLOR)
        // Blank lines between the header, the cubes and the result, so each beat of the
        // roll reads as its own block.
        .setDescription(body.filter(Boolean).join('\n\n'))
        // Footers are plain text — unicode emoji only, no markup, no custom emoji.
        .setFooter({ text: `📀 ${tg(balance)}  ·  ✨ Pure Cube pot ${tg(pot)}` });

    // Only the start screen carries the record and the rack; every other frame is about this
    // roll.
    if (!frame) embed.addFields(...statsFields(s), ...loadoutFields(s));
    return embed;
};

// Two rows, and nothing in either that can't be pressed. The top row is the roll — call, bank,
// help — and the bottom row is everything you set up *before* one: the stake, the rack, rerolls,
// prestige. The bottom row disappears entirely mid-run and on an end screen, because all of it
// is locked for the duration of a run and none of it is about a result.
//
// It was one row until the rack arrived, and a rack button plus a reroll button would have put
// seven things in it against a limit of five.
exports.playComponents = function ({ turn, ladder, stake, s, ended, owner, dead }) {
    const live = !!ladder;
    const row = [];
    const setup = [];

    if (ended) {
        // Run over. "Play again" is always first and always the primary, so the button under the
        // reflex click is the one that costs nothing and does the expected thing. A reroll spends
        // something the player bought, and a spend should never be the button muscle memory hits
        // — it sits second and quieter, chosen deliberately or not at all.
        row.push(new ButtonBuilder()
            .setCustomId(`cube_play_${owner}`)
            .setLabel('Play again')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Primary));

        // Offered here and nowhere else, so walking away from this screen is how you decline it.
        if (dead && s.rerolls > 0) {
            row.push(new ButtonBuilder()
                .setCustomId(`cube_reroll_${turn}_${owner}`)
                .setLabel(`Reroll ×${s.rerolls}`)
                .setEmoji(emojimap.restart)
                .setStyle(ButtonStyle.Secondary));
        }
    } else {
        // Calling again while standing means pushing, which only exists while there is a
        // deeper level unlocked to push into.
        if (!live || ladder.level < topOf(s)) {
            row.push(
                new ButtonBuilder()
                    .setCustomId(`cube_call_blue_${turn}_${owner}`)
                    .setLabel(SIDES.blue)
                    .setEmoji(FACES.blue)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`cube_call_red_${turn}_${owner}`)
                    .setLabel(SIDES.red)
                    .setEmoji(FACES.red)
                    .setStyle(ButtonStyle.Danger),
            );
        }
        if (live) {
            row.push(new ButtonBuilder()
                .setCustomId(`cube_bank_${turn}_${owner}`)
                .setLabel(`Bank ${tg(ladder.standing)}`)
                .setEmoji('💰')
                .setStyle(ButtonStyle.Success));
        }
    }

    row.push(new ButtonBuilder()
        .setCustomId(`cube_help_${owner}`)
        .setLabel('?')
        .setStyle(ButtonStyle.Secondary));

    // Everything below is locked for the duration of a run, and an end screen is about the
    // result rather than the next wager, so the whole row only exists on the idle board.
    if (!live && !ended) {
        setup.push(new ButtonBuilder()
            .setCustomId(`cube_stake_${turn}_${owner}`)
            .setLabel(`Stake: ${tg(stake)}`)
            .setEmoji('📀')
            .setStyle(ButtonStyle.Secondary));

        // Nothing to load until a prestige has handed over a cube.
        if (s.cubes.length) {
            setup.push(new ButtonBuilder()
                .setCustomId(`cube_loadout_${turn}_${owner}`)
                .setLabel(`Rack: ${s.equipped.length}/${s.slots}`)
                .setEmoji(ChanceCube)
                .setStyle(ButtonStyle.Secondary));
        }

        // Every reroll already in stock makes the next dearer, so the label carries the price
        // rather than making the player press to find out.
        if (s.buyReroll) {
            setup.push(new ButtonBuilder()
                .setCustomId(`cube_buyreroll_${turn}_${owner}`)
                .setLabel(`Buy reroll ×${s.rerolls} · ${tg(s.rerollCost)}`)
                .setEmoji(emojimap.restart)
                .setStyle(ButtonStyle.Secondary));
        }

        // Offered once the top level has been cleared, never mid-run and never forced.
        if (canPrestige(s)) {
            setup.push(new ButtonBuilder()
                .setCustomId(`cube_prestige_${turn}_${owner}`)
                .setLabel(`Prestige ${s.prestige + 1}`)
                .setEmoji(PRESTIGE)
                .setStyle(ButtonStyle.Success));
        }
    }

    const rows = [new ActionRowBuilder().addComponents(...row)];
    if (setup.length) rows.push(new ActionRowBuilder().addComponents(...setup));
    return rows;
};

// The called side, the stake, and whatever the paying cubes have added to the level's multiple —
// context for the roll, so it rides with the header.
//
// The multiple deliberately isn't here any more — it lives in the header, which is where a player
// already looks for what a level pays, and two numbers for one thing on one screen is one too many.
//
// `result` is 'win' | 'bust' | null — the tick or the cross that says at a glance whether the
// call was right, on the one line that names the call. Absent while the cubes are still
// face-down, because that's the whole question the reveal is asking.
const contextLine = (call, stake, bonus = 0, result = null) => `-# *Called ${chip(call)} · ${tg(stake)} staked`
    + '*'
    + (result === 'win' ? ' ✅' : result === 'bust' ? ' ❌' : '');
exports.contextLine = contextLine;

// The cubes a stored run left on the table. `faces` is written from the resolved line; `roll`
// is the plain sides, which is all a run persisted before special cubes existed has.
const storedFaces = function (ladder) {
    const shown = ladder.faces ? Object.values(ladder.faces) : sideFaces(ladder.roll || []);
    return faces(shown, shown.length);
};
exports.storedFaces = storedFaces;

// How many cubes a stored run left on the table, for the header. Read off the rendered faces rather
// than the set, because the faces are what the frame is drawing and the two are the same length.
const storedCount = function (ladder) {
    return (ladder.faces ? Object.values(ladder.faces) : (ladder.roll || [])).length;
};
exports.storedCount = storedCount;

// What a run in progress looks like when you come back to it.
exports.liveFrame = function (ladder, s) {
    // A stored run carries the multiple it was won at. Runs saved before the multiple became run
    // state fall back to the level's own, which is what they were paying anyway.
    const mult = Number(ladder.mult) || LEVELS[ladder.level].payout;
    return {
        levelIdx: ladder.level,
        bar: ladder.level === topOf(s) ? s : null,
        cubes: storedCount(ladder),
        multiple: mult,
        // A standing run is a call that came good, so the line it's resting on wears the tick.
        context: contextLine(ladder.call, ladder.stake, mult, 'win'),
        faces: storedFaces(ladder),
        lines: [choiceLine(ladder.stake, ladder.level, false, mult)],
    };
};

// The game over screen, rebuilt from a dead run — what `/chubacubes` shows if the reroll offer is
// still standing when the player comes back to it.
exports.deadFrame = function (dead, s) {
    return {
        levelIdx: dead.level,
        bar: null,
        cubes: storedCount(dead),
        multiple: Number(dead.mult) || LEVELS[dead.level].payout,
        context: contextLine(dead.call, dead.stake, Number(dead.mult) || 0, 'bust'),
        faces: storedFaces(dead),
        flavor: dead.flavor || null,
        lines: Object.values(dead.lines || {}),
        outcome: 'bust',
    };
};

// What a tie would pay if it went your way — the standing the bribe is buying. Multipliers count
// here, because buying the tie makes your call the winning side, which is exactly what they're
// waiting on.
const tieStanding = function (pending) {
    const stored = Number(pending.mult) || LEVELS[pending.level].payout;
    return bankPayout(pending.stake, applyMults(stored, pending.mults, pending.call));
};
exports.tieStanding = tieStanding;

exports.tieCostOf = (pending, s) => bribeCostFor(tieStanding(pending), s.bribes);

// The tie screen. The line came back even, Watto's cube is face-down on the table, and the roll is
// parked until the player answers. Rebuilt entirely from the stored run, because it has to draw the
// same thing an hour later if they closed the channel and came back with `/chubacubes`.
//
// Nothing on it is settled yet, which is what makes that safe: `bestLevel` and the clears meter
// still read exactly as they did when the cubes left the cup.
exports.tieFrame = function (pending, s) {
    const cost = bribeCostFor(tieStanding(pending), s.bribes);
    return {
        levelIdx: pending.level,
        bar: pending.level === topOf(s) ? s : null,
        record: pending.level > s.bestLevel,
        cubes: storedCount(pending),
        multiple: Number(pending.mult) || LEVELS[pending.level].payout,
        // No tick and no cross: the whole question is still open, which is the point of the screen.
        context: contextLine(pending.call, pending.stake, Number(pending.mult) || 0),
        faces: withBreaker(storedFaces(pending), null),
        flavor: pending.flavor || null,
        // A roll only ever parks for someone holding the pick, so the second line is all but
        // guaranteed — but the frame is rebuilt from stored state, and a frame that assumes
        // something about the player is a frame that can lie about it.
        lines: [tieOddsLine(s), s.bribe ? `${BRIBE} Or buy the tie off him for **${tg(cost)}**.` : null]
            .filter(Boolean),
    };
};

// One row, two answers and the help button. Rolling his cube is the **primary**, because it is the
// choice that costs nothing — the same rule that keeps `Play again` under the reflex click on a
// game over screen. A bribe spends truguts, so it never gets to be the button muscle memory hits.
exports.tieComponents = function (turn, cost, owner) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cube_tiebreak_${turn}_${owner}`)
            .setLabel("Roll Watto's cube")
            .setEmoji(ChanceCube)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`cube_bribe_${turn}_${owner}`)
            .setLabel(`Bribe ${tg(cost)}`)
            .setEmoji(BRIBE)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`cube_help_${owner}`)
            .setLabel('?')
            .setStyle(ButtonStyle.Secondary),
    )];
};

// The prestige offer. Destructive and optional, so it says plainly what it costs — and the
// reward you pick is the confirmation, which keeps it to one deliberate action.
exports.prestigeEmbed = function (s) {
    const next = s.prestige + 1;
    return new EmbedBuilder()
        // Embed titles don't render custom emoji, so the grandmaster leads the body instead.
        .setTitle(`Prestige ${next}`)
        .setColor(COLOR)
        .setDescription([
            `${PRESTIGE} *"You cleared ${TOP_NAME}. So now we play for real money, eh?"*`,
            '',
            `Watto sweeps the table. **Level 2 through ${LEVELS.length} lock again** and your clears reset — you start over from one cube${clearsPerLevel({ prestige: next }) > clearsPerLevel(s) ? `, and every level will take **${clearsPerLevel({ prestige: next })} clears** to open instead of ${clearsPerLevel(s)}` : ''}.`,
            '',
            `In exchange, every roll from here can carry ${config.maxStakeStep} times as much: max stake **${tg(maxStakeFor(next))}**, up from ${tg(s.maxStake)}.`,
            '',
            `And you take something off the rack — a **special cube** that rolls itself into your line from here on, another **slot** to field one in, the right to **buy rerolls**, or a way to survive a **tie**. **The pick commits the prestige.**`,
        ].join('\n'));
};

exports.prestigeComponents = function (turn, s, owner) {
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`cube_reward_${turn}_${owner}`)
                .setPlaceholder('Take one off the rack — this prestiges you')
                .addOptions(rewardChoices(s)),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cube_play_${owner}`)
                .setLabel('Not yet')
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
};

// A cube's lifetime record, one entry per distinct face, in the order the faces sit on the cube —
// so the line reads the way the cube is built and a player can see at a glance which half of a
// Mirror they keep getting.
//
// The two faces that cost something are named rather than left as a bare number, because "shattered
// 3" and "ended 3 runs" are the numbers anyone actually came to this screen for. A cube that has
// never been thrown gets no line at all, rather than a row of zeroes.
const faceStats = function (sp, faces) {
    const tally = (faces || {})[sp.id] || {};
    const total = Object.values(tally).reduce((n, v) => n + (Number(v) || 0), 0);
    if (!total) return null;

    // Distinct faces, first occurrence wins, so `5 × greed` collapses to one entry.
    const distinct = new Map();
    for (const f of sp.faces) if (!distinct.has(faceKey(f))) distinct.set(faceKey(f), f);

    const parts = [...distinct].map(([key, f]) => {
        const n = Number(tally[key]) || 0;
        const emoji = typeof f.emoji === 'string' ? f.emoji : (FACES[f.side] || ChanceCube);
        const label = key === 'end' ? ` ended` : key === 'broken' ? ` shattered` : '';
        return `${emoji} **${n}**${label}`;
    });
    return `-# **${total}** thrown · ${parts.join(' · ')}`;
};

// The rack. Everything owned, with what it does, and a multi-select limited to the slots
// available — the select itself is the save, so there is no separate confirm.
// This page has no fixed size: it grows with every cube owned, and a custom emoji costs about
// twenty-five characters of the 4,096 allowed however small it looks. A full rack drawing six faces
// per cube plus lifetime tallies runs well past the limit, and discord.js **throws** on an
// over-long description rather than trimming — so the screen has to shed weight on its own.
//
// Three tiers, dropping the least valuable thing first. The blurbs go before the preamble because
// they are the most re-read; the preamble goes before any cube does. The last tier is a hard cut,
// which should be unreachable but means this can never throw in a player's face.
const EMBED_LIMIT = 4096;

exports.loadoutEmbed = function (s) {
    const page = ({ blurbs = true, intro = true } = {}) => (intro ? [
            `${ChanceCube} *"You wanna put your own cubes in my game? ...Fine. ${s.slots} of 'em."*`,
            '',
            `A run **keeps the cubes it has thrown**. Level 1 opens with one plain cube, and every level after draws **${config.cubesPerLevel} more** out of a **bag** shuffled when the run started — a bag holding every cube on this rack, padded out with plain ones. Once one of yours comes out it **stays on the table** and throws again every level.`,
            '',
            `${ChanceCube} Nothing goes back in the bag, so the longer it hands you plain cubes the likelier the next pull is one of yours — and a cube you equipped is a cube you **will** meet before the top of the ladder. With one special in a bag of ${bagSize()}, the four pulls run **25% → 33% → 50% → certain**.`,
            '',
            `Which cuts both ways. A ${'💰'} caught at Level 2 pays on every level above it — and a ${RIPratts} face it rolls three levels later still ends the run. Anything destroyed is destroyed **for the rest of the climb**, so the table only ever gets smaller.`,
            '',
            `${RIPratts} **Ratts ends the run** on the spot, whatever the rest of the line says. ${wipeout} **breaks the cube** — no effect, and it's off the table until the run ends. Both are on the cubes that pay best.`,
            '',
            // Deliberately no mention of the tie picks here. This screen is only ever about which
            // cubes go on the table, and neither of them is a cube — putting them on the one screen
            // with an equip menu on it is exactly how a one-time prestige perk gets mistaken for
            // something you field. They live on the help screen and in their own start-screen field.
            `${Whatto} A cube that **destroys** cubes can leave the line **even**, with no majority in it — which Watto settles with a weighted cube of his own. Press **?** for how that goes.`,
            '',
        ] : [
            `${ChanceCube} *"You wanna put your own cubes in my game? ...Fine. ${s.slots} of 'em."*`,
            '',
        ]).concat([
            s.cubes.map(id => specialById(id)).filter(Boolean).map(sp => [
                // All six faces rather than the cube's one icon: the *shape* of a cube is what you
                // are choosing between on this screen, and four reds against one blue and a wipeout
                // says more about Shmi than her name does. The counts underneath say how it has
                // actually landed; this says how it is built.
                `${sp.faces.map(f => f.emoji).join(' ')} **${sp.name}**`
                + `${s.equipped.includes(sp.id) ? ' · *on the table*' : ''}`,
                blurbs ? `-# ${sp.blurb}` : null,
                faceStats(sp, s.faces),
            ].filter(Boolean).join('\n')).join('\n'),
        ]).join('\n');

    const tiers = [
        page(),
        page({ blurbs: false }),
        page({ blurbs: false, intro: false }),
    ];
    const body = tiers.find(t => t.length <= EMBED_LIMIT) ?? tiers[tiers.length - 1].slice(0, EMBED_LIMIT);

    return new EmbedBuilder()
        .setTitle('Your rack')
        .setColor(COLOR)
        .setDescription(body);
};

exports.loadoutComponents = function (turn, s, owner) {
    const options = s.cubes.map(id => specialById(id)).filter(Boolean).map(sp => ({
        label: sp.name,
        value: sp.id,
        emoji: sp.emoji,
        description: sp.blurb.slice(0, 100),
        default: s.equipped.includes(sp.id),
    }));
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`cube_setloadout_${turn}_${owner}`)
                .setPlaceholder(`Pick up to ${s.slots}`)
                .setMinValues(0)
                .setMaxValues(Math.min(s.slots, options.length))
                .addOptions(options),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cube_play_${owner}`)
                .setLabel('Back')
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
};

// The ceiling goes in the title and the way to raise it goes in the label, because those are
// the only two strings a modal always shows — a placeholder is invisible behind a prefilled
// value.
exports.stakeModal = function (stake, maxStake) {
    return new ModalBuilder()
        .setCustomId('cube_setstake')
        .setTitle(`Set your stake (max ${tg(maxStake)})`)
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('stake')
                .setLabel(`Each prestige raises the max ${config.maxStakeStep}×`)
                .setStyle(TextInputStyle.Short)
                .setValue(String(stake))
                .setRequired(true),
        ));
};

exports.helpEmbed = function ({ pot, s }) {
    const top = topOf(s);
    return new EmbedBuilder()
        .setTitle(`${ChanceCube} Chuba Cubes`)
        .setColor(COLOR)
        .setDescription([
            `Stake truguts, call ${chip('blue')} or ${chip('red')}, and roll. Win the level if your side is the **majority** — then **bank** the double or **push** for two more cubes. Bust and you lose the stake and everything standing on it.`,
            '',
            LEVELS.map((l, i) => {
                const line = `**Level ${i + 1}** ${l.name} — ${l.cubes} cube${l.cubes > 1 ? 's' : ''} · **${l.payout}×**`;
                return i > top ? `🔒 ${line}` : `${l.emoji} ${line}`;
            }).join('\n'),
            '',
            // The "every other prestige" clause is only true while the requirement is still
            // growing. At `maxClears` it stops, and a help screen still promising more would be
            // the one place the mode lies about its own progression.
            `🎯 Levels open one at a time. Your deepest level has nothing to push into, so it banks itself — do that **${clearsPerLevel(s)} times** and Watto puts two more cubes on the table.${clearsPerLevel(s) < config.maxClears ? ` Every other prestige adds one more, up to **${config.maxClears}**.` : ''}`,
            '',
            `📀 One roll takes at most **${tg(s.maxStake)}**. Clear **${TOP_NAME}** and you may **prestige** — the ladder locks back to Level 1, but the ceiling goes up **${config.maxStakeStep}×** and you take a **special cube** (or a slot to field one in, or a way to survive a tie) off Watto's rack.`,
            '',
            `${ChanceCube} A run **keeps the cubes it throws**. Level 1 opens with one plain cube, and every level after draws **${config.cubesPerLevel} more** out of a **bag** shuffled at the start of the run — every **special cube** on your rack is in it, padded out with plain ones. Nothing goes back in, so the longer the bag hands you plain cubes the likelier the next pull is one of yours, and a cube you equipped is one you **will** meet before the top. Once out, it stays on the table and throws again every level. They force a side, multiply the payout, reflect the line, burn a cube. One face bites back: ${RIPratts} **ends the run** outright.`,
            '',
            `🧨 **Damage is permanent.** A cube destroyed at Level 2 is gone for the rest of the climb, so the table only ever gets smaller — and a short table is an **even** one, which is where ties come from.`,
            '',
            `${Whatto} A cube that **destroys** cubes can leave the line **even**, with no majority in it. Watto breaks that with a cube of his own — weighted **${Math.round(config.tieLean * 100)}/${Math.round((1 - config.tieLean) * 100)}** against your call${s.nudge ? `, though ${SlyGon} **Qui-Gon's Nudge** leans it back your way` : ''}.${s.bribe ? ` Or ${BRIBE} **buy the tie** off him for a share of what it pays — a share that climbs with every one you've bought and resets when you prestige.` : ''}`,
            '',
            `${emojimap.restart} A **reroll** buys back the roll that killed you, offered on the game over screen and nowhere else. Bank them off a Reroll Cube${s.buyReroll ? ` or buy them — the next one costs **${tg(s.rerollCost)}**, and each one you're holding makes the next dearer` : ''}.`,
            '',
            `✨ Every cube landing on your called side is a **Pure Cube**, and the deeper ones pay off the pot: ${payingTiers()}. **${Math.round(config.potShare * 100)}%** of every trugut lost feeds that pot, currently **${tg(pot)}**.`,
        ].join('\n'));
};

exports.tg = tg;
exports.config = config;
