// The chance cube's state, and the only file in `game/cube/` that knows a database exists.
// Nothing is imported: `database` and the profile ref are passed in, so the same code runs inside
// the bot and inside an API server. The mirror is written before the database and read back from
// immediately, because a reveal renders several frames off it inside one interaction.
//
//   challenge/cube/live/ladders/<discordId>   one live run per player
//   users/<user_key>/random/cube              the player's standing

const { LEVELS } = require('./tuning.js');

const LIVE = 'challenge/cube/live';
exports.LIVE = LIVE;

// Firebase refuses `undefined` by throwing synchronously out of `set`/`update`, so one optional
// field nobody filled in takes down the request. The net, not the fix — a storable shape belongs in
// `engine.js`'s `encode*`. Pruned for the mirror too, so memory matches a read-back.
const pruned = function (value) {
    if (Array.isArray(value)) return value.map(v => (v === undefined ? null : pruned(v)));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = pruned(v);
    return out;
};

// Writes are un-awaited, so failure is this file's business. `.catch` covers the trip, `try` covers
// the synchronous throw above. Either way the mirror already holds the write and the database does
// not, so the log is the only record of what a restart would lose.
const fireAndForget = function (what, write) {
    try {
        write().catch((err) => {
            console.error(`[cube] ${what} did not reach the database:`, err.message);
        });
    } catch (err) {
        console.error(`[cube] ${what} was refused by the database:`, err.message);
    }
};

// ---------------------------------------------------------------------------
// The player's standing
// ---------------------------------------------------------------------------

exports.writeCube = function (profile_ref, user_profile, patch) {
    const clean = pruned(patch);
    user_profile.cube = { ...(user_profile.cube || {}), ...clean };
    fireAndForget('a profile patch', () => profile_ref.child('cube').update(clean));
};

// ---------------------------------------------------------------------------
// The live run
// ---------------------------------------------------------------------------

// `level` was called `rung` before the rename; old runs still resolve.
const nodeOf = function (db, member_id) {
    const l = db.ch.cube?.ladders?.[member_id];
    return l ? { ...l, level: Number(l.level ?? l.rung) || 0 } : null;
};
exports.nodeOf = nodeOf;

// Three things share this node and are not one: a run in progress, a busted run held open for a
// reroll offer, and a roll parked on a tie.
const ladderOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && !l.dead && !l.tie ? l : null;
};
exports.ladderOf = ladderOf;

// A throw that has landed and not been settled. Additive rather than a fourth state: the run
// underneath is untouched, so banking after a look pays exactly what it would have before. The roll
// path owes it a settle — a rung already holding a throw settles that one.
exports.shownOf = function (db, member_id) {
    const l = ladderOf(db, member_id);
    const shown = l && l.shown;
    return shown && LEVELS[shown.level] ? shown : null;
};

// A run that just died and still has a reroll on the table, holding the state the roll was made from.
exports.deadOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && l.dead ? l : null;
};

// A roll that came back even, waiting on Watto's tie-breaker or a buyout. Nothing about it is
// settled, and it blocks every other action. The level is guarded here rather than at the point of
// use because a parked tie against a level the data no longer has would throw on every render and
// leave the player with no way back.
exports.tieOf = function (db, member_id) {
    const l = nodeOf(db, member_id);
    return l && l.tie && LEVELS[l.level] ? l : null;
};

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
