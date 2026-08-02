// A per-player request cap.
//
// In memory, and that is correct rather than a shortcut: there is exactly one bot process and it
// is the only writer of everything the API touches. (The same assumption would be wrong in
// botto-api, which runs two Cloud Run instances and would need a shared store.)
//
// Keyed on the **player**, not the IP. Every request arrives through Discord's proxy, so an IP
// limit would throttle a whole channel instead of one person.
//
// Its own module because `index.js` mounts the routes and the routes need the limiter — requiring
// it back out of `index.js` gave a half-initialised module and an undefined middleware.

const buckets = new Map();

// Each route gets its own bucket per player, not one shared bucket per player. Sharing meant the
// tightest `perMinute` on any route became the effective limit for all of them — ten prestige
// attempts a minute would silently cap rolling at ten a minute too.
let nextId = 0;

exports.rateLimit = ({ perMinute }) => {
    const route = `r${nextId += 1}`;
    return function (req, res, next) {
        const key = `${route}:${req.player?.discordId || req.ip}`;
        const now = Date.now();
        const b = buckets.get(key);
        if (!b || now > b.until) {
            buckets.set(key, { n: 1, until: now + 60000 });
            return next();
        }
        if (b.n >= perMinute) {
            res.set('Retry-After', String(Math.ceil((b.until - now) / 1000)));
            return res.status(429).json({ error: 'Slow down — the cubes need a moment.' });
        }
        b.n += 1;
        return next();
    };
};

// Swept on a timer rather than on every request, so a busy minute doesn't pay for the tidying.
// Unref'd so it can never be the reason the process stays alive.
setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (now > b.until) buckets.delete(k);
}, 120000).unref();
