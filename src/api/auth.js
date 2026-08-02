// Who is playing, for the Discord Activity.
//
// The Activity runs in a sandboxed iframe, so the usual browser-redirect OAuth dance is not
// available: the Embedded App SDK hands the client an authorization **code** and the client posts
// it here. We exchange it with Discord, read the user, resolve them against the bot's own userbase
// and hand back a short-lived JWT that every other route checks.
//
// **This is not botto-api's auth and can't be.** That service resolves Discord ids to Firestore
// documents; the chance cube's state hangs off a Realtime Database push key (`users/<key>/random`)
// which only this process has a mirror of. Two different user stores, so two different resolvers.

const axios = require('axios');
const jwt = require('jsonwebtoken');

const DISCORD_API = 'https://discord.com/api/v10';
const TOKEN_TTL = '2h';

const CLIENT_ID = process.env.clientId;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const JWT_SECRET = process.env.CUBE_JWT_SECRET;

// Warned once at startup rather than per request, in the same shape as the lean salt's warning:
// the API still mounts, and says plainly why nobody can sign in.
exports.warnIfUnconfigured = function () {
    const missing = [];
    if (!CLIENT_ID) missing.push('clientId');
    if (!CLIENT_SECRET) missing.push('DISCORD_CLIENT_SECRET');
    if (!JWT_SECRET) missing.push('CUBE_JWT_SECRET');
    if (missing.length) {
        console.warn(`[api] the cube Activity cannot authenticate anyone: ${missing.join(', ')} `
            + 'not set. The API is up but every sign-in will fail.');
    }
    return missing;
};

// Exchanges the SDK's code for an access token, then reads the user behind it.
//
// `redirect_uri` is deliberately absent: an embedded app has nowhere to redirect to, and Discord
// does not expect one for this grant.
const exchange = async function (code) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
    });
    const token = await axios.post(`${DISCORD_API}/oauth2/token`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const access = token.data?.access_token;
    if (!access) throw new Error('Discord returned no access token');

    const me = await axios.get(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${access}` },
    });
    return { access, user: me.data };
};

// Finds — or creates — the bot's record for this Discord user. Exactly what the interaction
// handler does at bot.js:111-118, because the Activity and a slash command have to land on the
// same player.
const resolvePlayer = async function (db, database, discordId, name) {
    // Required here rather than at the top of the file. `src/user.js` initialises firebase-admin
    // as a side effect of being loaded, and this module is otherwise fully injectable — everything
    // else takes `db` and `database` as arguments. Keeping the import inside the one function that
    // needs it means the API can be built and exercised against a fake mirror without opening a
    // connection to the real database.
    // eslint-disable-next-line global-require
    const { get_user_key_by_discord_id, initializePlayer, initializeUser } = require('../user.js');
    let userKey = get_user_key_by_discord_id(db, discordId);
    if (!userKey) userKey = await initializeUser(database.ref('users'), discordId, name);
    let profile = db.user[userKey]?.random;
    if (!profile) profile = initializePlayer(database.ref(`users/${userKey}/random`), name);
    return { userKey, profile };
};
exports.resolvePlayer = resolvePlayer;

// POST /cube/auth/token — the only unauthenticated route.
exports.tokenHandler = ctx => async function (req, res) {
    if (!CLIENT_SECRET || !JWT_SECRET) {
        return res.status(503).json({ error: 'Sign-in is not configured on this server.' });
    }
    const code = req.body?.code;
    if (typeof code !== 'string' || !code) {
        return res.status(400).json({ error: 'Missing code.' });
    }
    let discordUser;
    try {
        ({ user: discordUser } = await exchange(code));
    } catch (err) {
        // Discord's own message is not something to hand a browser verbatim, and a failed
        // exchange is a failed exchange whatever the reason.
        console.error('[api] code exchange failed:', err.response?.data || err.message);
        return res.status(401).json({ error: 'Discord would not accept that sign-in.' });
    }

    const name = discordUser.global_name || discordUser.username;
    const { userKey } = await resolvePlayer(ctx.db, ctx.database, discordUser.id, name);

    const token = jwt.sign({ discordId: discordUser.id, userKey }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    return res.json({
        token,
        user: {
            id: discordUser.id,
            username: name,
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
        },
    });
};

// Verifies the JWT and puts the live profile on the request. Every route but the exchange goes
// through this.
//
// The profile is re-read from the mirror on **every** request rather than carried in the token:
// truguts and the player's standing move constantly, and a token minted two hours ago must never
// be the reason a balance check passes.
exports.requireAuth = ctx => function (req, res, next) {
    if (!JWT_SECRET) return res.status(503).json({ error: 'Sign-in is not configured on this server.' });
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not signed in.' });

    let claims;
    try {
        claims = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Session expired. Open the activity again.' });
    }

    const profile = ctx.db.user[claims.userKey]?.random;
    if (!profile) return res.status(401).json({ error: 'No player record.' });

    req.player = {
        discordId: claims.discordId,
        userKey: claims.userKey,
        profile,
        ref: ctx.database.ref(`users/${claims.userKey}/random`),
    };
    return next();
};

// The chance cube is unlocked by the "Red vs Blue" collection, and the Activity respects that gate
// exactly as the slash command does — see `isUnlocked` in src/interactions/cube.js.
exports.requireCube = function (req, res, next) {
    if (!req.player.profile?.effects?.chance_cube) {
        return res.status(403).json({
            error: "You haven't got a chance cube. Collect three red sides and three blue ones.",
            locked: true,
        });
    }
    return next();
};
