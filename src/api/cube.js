// The chance cube's HTTP surface, for the Discord Activity.
//
// Everything here is **server-authoritative**. The client says "I call blue"; it never says what
// the cubes did. Two reasons, and both are absolute: `CUBE_LEAN_SALT` decides the day's favoured
// side and cannot ship to a browser, and the payouts are real truguts.
//
// Responses carry abstract face ids (`greed`, `mult:blue`) and structured notes, never emoji or
// prose — see `src/game/cube/engine.js`. What a face looks like and what it says are the client's
// business, which is the whole reason the engine was pulled out of the embed.

const { tokenHandler, requireAuth, requireCube } = require('./auth.js');
const { rateLimit } = require('./ratelimit.js');

const engine = require('../game/cube/engine.js');
const pstate = require('../game/cube/state.js');
const persist = require('../game/cube/persist.js');
const {
    LEVELS, SPECIALS, SIDES, SWEEP_SHARE, WATTO, cube: config,
} = require('../game/cube/tuning.js');

// Balance is derived, never stored — the profile keeps two lifetime counters and the difference
// between them is what the player has.
const balanceOf = p => (Number(p?.truguts_earned) || 0) - (Number(p?.truguts_spent) || 0);

// Everything the board needs in one response. The client renders from this and nothing else, so a
// field missing here is a field the Activity cannot draw.
const boardOf = function (ctx, req) {
    const { profile, discordId } = req.player;
    const s = pstate.cubeState(profile);
    const live = persist.ladderOf(ctx.db, discordId);
    const dead = persist.deadOf(ctx.db, discordId);
    const tie = persist.tieOf(ctx.db, discordId);
    return {
        player: s,
        balance: balanceOf(profile),
        pot: persist.potOf(ctx.db),
        // Exactly one of these is ever set: a run in progress, a bust holding a reroll offer, or a
        // roll parked on a tie. They share one node and are not the same thing.
        run: live || null,
        dead: dead || null,
        tie: tie || null,
        // Derived progression the client would otherwise have to reimplement — and reimplementing
        // it is how two clients start disagreeing about whether a level is open.
        progress: {
            top: pstate.topOf(s),
            goal: pstate.goalOf(s),
            perLevel: pstate.clearsPerLevel(s),
            canPrestige: pstate.canPrestige(s),
            maxLevel: pstate.MAX_LEVEL,
        },
    };
};

module.exports = function mountCube(app, ctx) {
    const auth = [requireAuth(ctx), requireCube];

    // -----------------------------------------------------------------------
    // Signing in
    // -----------------------------------------------------------------------

    app.post('/cube/auth/token', tokenHandler(ctx));

    // -----------------------------------------------------------------------
    // Static data
    // -----------------------------------------------------------------------

    // `config.maxCubes` is `Infinity`, which JSON turns into `null` without saying so. Sent as an
    // explicit `null` with a flag beside it, because a client reading a silently-nulled number is
    // one `if (n > maxCubes)` away from believing the cap is zero.
    const wireConfig = {
        ...config,
        maxCubes: Number.isFinite(config.maxCubes) ? config.maxCubes : null,
        maxCubesUncapped: !Number.isFinite(config.maxCubes),
    };

    // The rules, so the client can draw a rack and a ladder without hardcoding either. Behind auth
    // only because there is no reason to serve it to anyone else; it is not a secret, and the one
    // thing that *is* — the daily lean salt — is nowhere near this.
    app.get('/cube/tuning', requireAuth(ctx), (req, res) => res.json({
        levels: LEVELS,
        specials: SPECIALS,
        sides: SIDES,
        sweepShare: SWEEP_SHARE,
        watto: WATTO,
        config: wireConfig,
    }));

    // -----------------------------------------------------------------------
    // The board
    // -----------------------------------------------------------------------

    app.get('/cube/state', auth, async (req, res) => {
        try {
            await persist.ensurePot(ctx.database, ctx.db);
            res.json(boardOf(ctx, req));
        } catch (err) {
            console.error('[api] /cube/state:', err);
            res.status(500).json({ error: 'Could not read the board.' });
        }
    });

    // -----------------------------------------------------------------------
    // Settings you change between runs
    // -----------------------------------------------------------------------

    // The stake. Clamped to the prestige ceiling here as well as on read, so a client that ignores
    // `maxStake` cannot put more on the table than the ladder allows.
    app.post('/cube/stake', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        const { profile, ref } = req.player;
        const s = pstate.cubeState(profile);
        const wanted = Math.floor(Number(req.body?.stake));
        if (!Number.isFinite(wanted)) return res.status(400).json({ error: 'Not a number.' });
        if (wanted < config.minStake) {
            return res.status(400).json({ error: `The minimum stake is ${config.minStake}.` });
        }
        if (persist.ladderOf(ctx.db, req.player.discordId)) {
            return res.status(409).json({ error: 'You have a run in progress.' });
        }
        const stake = Math.min(wanted, s.maxStake);
        persist.writeCube(ref, profile, { stake });
        res.json({ stake, maxStake: s.maxStake, clamped: stake !== wanted });
    });

    // The loadout. `setLoadout` drops unknown ids, cubes that aren't owned and anything past the
    // slot count, so nothing here has to trust the request.
    app.post('/cube/loadout', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        const { profile, ref } = req.player;
        if (persist.ladderOf(ctx.db, req.player.discordId)) {
            return res.status(409).json({ error: 'The rack is locked while a run is live.' });
        }
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(x => typeof x === 'string') : null;
        if (!ids) return res.status(400).json({ error: 'Expected { ids: [] }.' });
        const s = pstate.cubeState(profile);
        const patch = {};
        const equipped = pstate.setLoadout(s, patch, ids);
        persist.writeCube(ref, profile, patch);
        res.json({ equipped, slots: s.slots, owned: s.cubes });
    });

    // -----------------------------------------------------------------------
    // Playing
    // -----------------------------------------------------------------------

    // Not yet. These move truguts, and the orchestration that does it correctly — the stake debit,
    // the settlement mid-reveal, the pot, the clears, the tie park — currently lives inside the
    // Discord handler, tangled up with message edits. It is being lifted into `game/cube/actions.js`
    // rather than written twice: two implementations of a payout is exactly the bug nobody finds
    // until a balance is wrong.
    const pending = (req, res) => res.status(501).json({
        error: 'Not implemented yet — the play actions are still being lifted out of the Discord handler.',
    });
    for (const route of ['/cube/roll', '/cube/bank', '/cube/tie', '/cube/prestige', '/cube/reroll']) {
        app.post(route, auth, pending);
    }
};
