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

// ---------------------------------------------------------------------------
// Playing outside Discord
// ---------------------------------------------------------------------------
//
// The Activity is also a page on the site, and a logged-in junkyard user should be able to play it
// there. That needs a second way in, because the handshake above is the *Embedded SDK* flow: it
// starts from a code the SDK hands over, and outside a Discord client there is no SDK to hand one.
//
// So the browser gets an ordinary OAuth redirect, run by **this** service. Botto already holds both
// halves of it — `clientId` and `DISCORD_CLIENT_SECRET` are what the code exchange above uses — so
// this adds no secret and no new trust between services. It deliberately does *not* reuse the
// site's own session: botto-api signs `{ id, username, roles }` where `id` is a Firestore document,
// and the cube keys off a Discord id resolved to an RTDB push key. Bridging those would mean either
// sharing botto-api's signing secret with a third service or making cube sign-in depend on
// botto-api being up. Asking Discord directly costs one bounce and owes nobody anything.
//
// `CUBE_OAUTH_REDIRECT` is this service's own callback and **must match a Redirect URI registered
// in the Discord Developer Portal exactly** — that is the one piece of this that lives outside the
// repo. `CUBE_SITE_ORIGINS` is a comma-separated allow-list of sites permitted to receive a token.
const OAUTH_REDIRECT = process.env.CUBE_OAUTH_REDIRECT;
const SITE_ORIGINS = (process.env.CUBE_SITE_ORIGINS || '')
    .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

// **The single most important check in this file.** The callback finishes by sending the player
// back to wherever they started, carrying a token that *is* their account — so an unvalidated
// `redirect` would be an open redirect that hands any site a working cube session. Only origins on
// the allow-list are ever sent one.
//
// Localhost is allowed only when the process is not in production, which is the same latitude the
// CORS policy already takes for the Vite dev server.
const allowedRedirect = function (target) {
    let url;
    try { url = new URL(target); } catch (err) { return false; }
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return false;
    if (SITE_ORIGINS.includes(url.origin)) return true;
    return process.env.NODE_ENV !== 'production' && url.hostname === 'localhost';
};
exports.allowedRedirect = allowedRedirect;

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
    // Warned separately, because these two only gate playing on the **site**. Without them the
    // Activity still works perfectly well launched from Discord, so this is a missing feature
    // rather than a broken one and should not read like the same problem.
    const browser = [];
    if (!OAUTH_REDIRECT) browser.push('CUBE_OAUTH_REDIRECT');
    if (!SITE_ORIGINS.length) browser.push('CUBE_SITE_ORIGINS');
    if (browser.length && !missing.length) {
        console.warn(`[api] the cube cannot be played outside Discord: ${browser.join(', ')} not `
            + 'set. Launching from Discord is unaffected.');
    }
    return missing;
};

// Exchanges a code for an access token, then reads the user behind it.
//
// `redirectUri` is the one difference between the two flows and it is not optional in either
// direction. The **embedded** flow must omit it — an embedded app has nowhere to redirect to and
// Discord does not expect one for that grant — while the **browser** flow must send exactly the URI
// the authorize call was started with, or Discord rejects the exchange.
const exchange = async function (code, redirectUri = null) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
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
    let discordToken;
    try {
        ({ user: discordUser, access: discordToken } = await exchange(code));
    } catch (err) {
        // Discord's own message is not something to hand a browser verbatim, and a failed
        // exchange is a failed exchange whatever the reason.
        console.error('[api] code exchange failed:', err.response?.data || err.message);
        return res.status(401).json({ error: 'Discord would not accept that sign-in.' });
    }

    const name = discordUser.global_name || discordUser.username;
    const { userKey } = await resolvePlayer(ctx.db, ctx.database, discordUser.id, name);

    const token = mintToken(discordUser.id, userKey);
    return res.json({
        // Ours, for this API. Signed with CUBE_JWT_SECRET and meaningless to anyone else.
        token,
        // **Discord's**, for `sdk.commands.authenticate()`. The SDK hands it straight back to
        // Discord, which validates it against `/oauth2/@me` — so our JWT cannot stand in for it,
        // and passing one there is a 401 every time.
        //
        // Returning it is the documented flow rather than a leak: the client is what obtained the
        // code in the first place, and the scope is `identify` and nothing else.
        accessToken: discordToken,
        user: {
            id: discordUser.id,
            username: name,
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
        },
    });
};

// Mints the session every authenticated route checks. One place, so the two ways in cannot drift
// about what a cube token contains.
const mintToken = (discordId, userKey) =>
    jwt.sign({ discordId, userKey }, JWT_SECRET, { expiresIn: TOKEN_TTL });

// GET /cube/auth/discord?redirect=<where to come back to>
//
// Step one of the browser flow: remember where the player came from and send them to Discord.
//
// The return address rides in `state` as a **signed, short-lived JWT** rather than as a plain query
// parameter. Discord echoes `state` back verbatim and does not care what is in it, so an unsigned
// one is attacker-controlled by the time we read it again — and what we do with it is send a token
// there. Signing it means the callback can only ever honour a destination this route approved.
exports.browserAuthStart = function (req, res) {
    if (!CLIENT_ID || !CLIENT_SECRET || !JWT_SECRET || !OAUTH_REDIRECT) {
        return res.status(503).send('Sign-in is not configured on this server.');
    }
    const target = req.query?.redirect;
    if (typeof target !== 'string' || !allowedRedirect(target)) {
        // Deliberately terse and deliberately not echoing the value back: this is the branch an
        // open-redirect probe lands in.
        return res.status(400).send('That is not somewhere this can send you.');
    }
    const state = jwt.sign({ r: target }, JWT_SECRET, { expiresIn: '10m' });
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', OAUTH_REDIRECT);
    // `identify` and nothing else, the same scope the embedded flow asks for: the bot resolves
    // everything it needs off its own userbase.
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    return res.redirect(url.toString());
};

// GET /cube/auth/callback?code=&state=
//
// Step two: Discord sends the player back here. Exchange, resolve, mint, and bounce them home.
//
// **The token goes home in the URL fragment, not the query string.** A fragment is never sent to a
// server, so it stays out of access logs, out of `Referer` on the next navigation, and out of any
// proxy in between — and the client strips it from the address bar as soon as it has read it. A
// query parameter would put a live session in all three.
exports.browserAuthCallback = ctx => async function (req, res) {
    if (!CLIENT_SECRET || !JWT_SECRET || !OAUTH_REDIRECT) {
        return res.status(503).send('Sign-in is not configured on this server.');
    }
    const { code, state } = req.query || {};
    if (typeof code !== 'string' || !code) return res.status(400).send('Discord sent no code.');

    let target;
    try {
        target = jwt.verify(String(state || ''), JWT_SECRET).r;
    } catch (err) {
        return res.status(400).send('That sign-in has expired. Start it again.');
    }
    // Re-checked rather than trusted from the signature. The allow-list is configuration and can
    // have changed since the state was minted; a signature only proves *we* wrote it, not that it
    // is still somewhere we are willing to send an account.
    if (!allowedRedirect(target)) return res.status(400).send('That is not somewhere this can send you.');

    let discordUser;
    try {
        ({ user: discordUser } = await exchange(code, OAUTH_REDIRECT));
    } catch (err) {
        console.error('[api] browser code exchange failed:', err.response?.data || err.message);
        return res.status(401).send('Discord would not accept that sign-in.');
    }

    const name = discordUser.global_name || discordUser.username;
    const { userKey } = await resolvePlayer(ctx.db, ctx.database, discordUser.id, name);
    const token = mintToken(discordUser.id, userKey);

    const back = new URL(target);
    // Appended to whatever fragment was already there rather than replacing it, so a redirect back
    // to a routed page keeps its route.
    back.hash = `${back.hash ? `${back.hash.replace(/^#/, '')}&` : ''}cubeToken=${encodeURIComponent(token)}`;
    return res.redirect(back.toString());
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
