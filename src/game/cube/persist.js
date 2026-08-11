// Where the chance cube's state lives, and the only file in `game/cube/` that knows a database
// exists.
//
// Nothing is imported: the `database` handle and the player's profile ref are **passed in**, and
// the in-memory mirror is passed in as `db`. That is what lets the same code run inside the bot
// process, where those come from `src/firebase.js`, and inside an API server, where they don't.
//
//   challenge/cube/live/ladders/<discordId>   one live run per player
//   users/<user_key>/random/cube              the player's standing
//
// The mirror is written **before** the database and read back from immediately, because a reveal
// animation renders several frames off it inside one interaction and none of them can wait for a
// round trip. Read-your-own-writes is a requirement here, not an optimisation.

const { LEVELS } = require('./tuning.js');

const LIVE = 'challenge/cube/live';
exports.LIVE = LIVE;

// **What the database will not take, and what it does about it.** Firebase refuses `undefined`
// anywhere in a payload — and it refuses by *throwing*, synchronously, out of `set` and `update`
// rather than by rejecting the promise they return. So a `.catch` on the write does not cover it,
// and an optional field nobody filled in does not cost a write: it takes down whatever request was
// making one. A parked tie stores the roll's Multiplier records, which carry `positions` only when a
// Boost paid, so a tie with a Multiplier on the line 500'd the roll it had just committed.
//
// Pruned rather than defaulted field by field, because the shape belongs to the callers and there
// are a dozen of them — and pruned for the **mirror** too, so what is held in memory is what a
// read-back would return instead of drifting from it by one key.
const pruned = function (value) {
    if (Array.isArray(value)) return value.map(v => (v === undefined ? null : pruned(v)));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = pruned(v);
    return out;
};

// Every write here is deliberately un-awaited — a reveal has frames to draw and none of them are
// waiting on a round trip — which means a failure is this file's business and never the caller's.
// `.catch` covers the trip; the `try` covers the call itself, which is where a payload the database
// refuses fails. Loud, because a write that silently did not happen is a standing that quietly
// disagrees with the screen.
const fireAndForget = function (what, write) {
    try {
        const out = write();
        if (out && typeof out.catch === 'function') out.catch(() => { });
    } catch (err) {
        console.error(`[cube] ${what} was refused by the database:`, err.message);
    }
};

// ---------------------------------------------------------------------------
// The player's standing
// ---------------------------------------------------------------------------

// Applies a patch to the profile, in memory first so everything rendered after this call sees the
// new numbers, then to the database. The write is deliberately not awaited: a reveal has frames to
// draw and a settled ledger is not something any of them are waiting on.
exports.writeCube = function (profile_ref, user_profile, patch) {
    const clean = pruned(patch);
    user_profile.cube = { ...(user_profile.cube || {}), ...clean };
    fireAndForget('a profile patch', () => profile_ref.child('cube').update(clean));
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
    const stored = pruned({ ...value, updated: Date.now() });
    db.ch.cube.ladders[member_id] = stored;
    fireAndForget('a live run', () => database.ref(`${LIVE}/ladders/${member_id}`).set(stored));
};

exports.clearLadder = function (database, db, member_id) {
    if (db.ch.cube?.ladders) delete db.ch.cube.ladders[member_id];
    fireAndForget('clearing a live run', () => database.ref(`${LIVE}/ladders/${member_id}`).remove());
};
