// The bot's HTTP surface, and the only one it has ever had.
//
// It exists to back the chance cube Discord Activity, and it runs **inside the bot process** on
// purpose. Three reasons, in order of how much they matter:
//
//   1. Truguts must have exactly one writer. `manageTruguts` is a read-modify-write against the
//      in-memory mirror; one process makes that safe, and a second service writing the same value
//      would silently lose updates.
//   2. All the state is in the Realtime Database mirror this process maintains — botto-api is
//      Firestore-only and has no `databaseURL` at all.
//   3. The two services key users differently: Firestore auto-ids there, RTDB push keys here, and
//      the cube's state hangs off the push key.
//
// Heroku only routes HTTP to a `web` dyno, which is why the Procfile changed.

const express = require('express');
const { warnIfUnconfigured } = require('./auth.js');
const mountCube = require('./cube.js');

// Requests reach us through Discord's proxy, which fronts the Activity at
// `https://<application-id>.discordsays.com` and rewrites `/cube/*` to this origin. Anything else
// is a browser poking at the API directly.
const allowedOrigin = function (origin) {
    if (!origin) return true;
    if (/^https:\/\/[0-9]+\.discordsays\.com$/.test(origin)) return true;
    // The Vite dev server, for building the Activity before it is proxied.
    if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
    return false;
};

const cors = function (req, res, next) {
    const origin = req.get('origin');
    if (origin && allowedOrigin(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigin(origin) ? 204 : 403);
    return next();
};

exports.createApi = function (ctx) {
    const app = express();
    // Behind Discord's proxy and Heroku's router.
    app.set('trust proxy', true);
    app.use(express.json({ limit: '64kb' }));
    app.use(cors);

    // Cheap liveness, unauthenticated: Heroku's router wants something to hit and so does anyone
    // debugging a URL mapping.
    app.get('/health', (req, res) => res.json({ ok: true, bot: !!ctx.client?.isReady?.() }));

    mountCube(app, ctx);

    // Anything else is a mapping mistake, and should say so rather than returning Express's HTML.
    app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

    // Nothing should reach here — every handler catches — but an unhandled throw must not take
    // the bot down with it, and must not leak a stack to a browser either.
    app.use((err, req, res, _next) => {
        console.error('[api] unhandled:', err);
        res.status(500).json({ error: 'Something broke on our end.' });
    });

    return app;
};

exports.startApi = function (ctx) {
    // Heroku hands the port in; locally anything free will do.
    const port = Number(process.env.PORT) || 3030;
    const app = exports.createApi(ctx);
    warnIfUnconfigured();
    const server = app.listen(port, () => console.log(`[api] listening on ${port}`));
    server.on('error', err => console.error('[api] failed to bind:', err.message));
    return server;
};
