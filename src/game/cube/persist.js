// Where the chance cube's state lives, and the only file in `game/cube/` that knows a database
// exists.
//
// Nothing is imported: the `database` handle and the player's profile ref are **passed in**, and
// the in-memory mirror is passed in as `db`. That is what lets the same code run inside the bot
// process, where those come from `src/firebase.js`, and inside an API server, where they don't.
//
//   challenge/cube/live/pot                   the Pure Cube pot
//   challenge/cube/live/ladders/<discordId>   one live run per player
//   users/<user_key>/random/cube              the player's standing
//
// The mirror is written **before** the database and read back from immediately, because a reveal
// animation renders several frames off it inside one interaction and none of them can wait for a
// round trip. Read-your-own-writes is a requirement here, not an optimisation.

const admin = require('firebase-admin');
const { LEVELS, cube: config } = require('./tuning.js');

const LIVE = 'challenge/cube/live';
exports.LIVE = LIVE;

const inc = n => admin.database.ServerValue.increment(n);

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
exports.potCut = stake => Math.floor((Number(stake) || 0) * config.potShare);

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
// The player's standing
// ---------------------------------------------------------------------------

// Applies a patch to the profile, in memory first so everything rendered after this call sees the
// new numbers, then to the database. The write is deliberately not awaited: a reveal has frames to
// draw and a settled ledger is not something any of them are waiting on.
exports.writeCube = function (profile_ref, user_profile, patch) {
    user_profile.cube = { ...(user_profile.cube || {}), ...patch };
    profile_ref.child('cube').update(patch);
};

// ---------------------------------------------------------------------------
// The live run
// ---------------------------------------------------------------------------

// `level` was called `rung` before the rename; a run persisted under the old name still
// resolves rather than indexing LEVELS with undefined.
const nodeOf = function (db, member_id) {
    const l = db.ch.cube?.ladders?.[member_id];
    return l ? { ...l, level: Number(l.level ?? l.rung) || 0 } : null;
};
exports.nodeOf = nodeOf;

// A live run. Three things share this node and are *not* one: a run in progress, a busted run held
// open for a reroll offer, which has no standing to bank and nothing to push into, and a roll
// parked on a tie, which has no result yet at all.
exports.ladderOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && !l.dead && !l.tie ? l : null;
};

// A run that just died and still has a reroll on the table. Holds the state the roll was made
// from, so spending a reroll can replay exactly that roll.
exports.deadOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && l.dead ? l : null;
};

// A roll that came back even and is waiting on an answer: roll Watto's tie-breaker, or buy the
// tie off him. Nothing about it is settled — that's the whole reason it's parked — so it holds
// everything the settlement will need, and it blocks every other action until it's answered.
exports.tieOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    // The level is checked here rather than at the point of use because a parked tie *blocks* the
    // board: one stored against a level the data no longer has would throw on every render and
    // leave the player with no way back. Refused here it is simply invisible, and the next call
    // clears the node on its way past.
    return l && l.tie && LEVELS[l.level] ? l : null;
};

// One live run per player, so a restart or a closed screen never eats a standing. Written to the
// mirror first and not awaited, for the reason at the top of this file.
exports.saveLadder = function (database, db, member_id, value) {
    if (!db.ch.cube) db.ch.cube = {};
    if (!db.ch.cube.ladders) db.ch.cube.ladders = {};
    const stored = { ...value, updated: Date.now() };
    db.ch.cube.ladders[member_id] = stored;
    database.ref(`${LIVE}/ladders/${member_id}`).set(stored).catch(() => { });
};

exports.clearLadder = function (database, db, member_id) {
    if (db.ch.cube?.ladders) delete db.ch.cube.ladders[member_id];
    database.ref(`${LIVE}/ladders/${member_id}`).remove().catch(() => { });
};
