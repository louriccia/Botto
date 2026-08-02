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
const actions = require('../game/cube/actions.js');
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

// The one thing `actions.js` refuses to import. `manageTruguts` lives in a 3,700-line challenge
// module that initialises Firebase and pulls in discord.js as a side effect of loading, so it is
// required at first use rather than at the top — the same reason `auth.js` defers `src/user.js`.
//
// `ctx.moveTrugutsFor` overrides it, which is how the smoke test exercises the play routes without
// a database. Nothing else should: there is one trugut writer and this is it.
let manageTruguts = null;
const defaultMoveTrugutsFor = (profile, ref) => function ({ transaction, amount }) {
    // eslint-disable-next-line global-require
    if (!manageTruguts) ({ manageTruguts } = require('../interactions/challenge/functions.js'));
    return manageTruguts({ user_profile: profile, profile_ref: ref, transaction, amount });
};

// `app` here is an express.Router, mounted at both /cube and / — see the note in index.js.
// Paths are therefore written without the /cube prefix.
module.exports = function mountCube(app, ctx) {
    const auth = [requireAuth(ctx), requireCube];
    const moveTrugutsFor = ctx.moveTrugutsFor || defaultMoveTrugutsFor;

    // A refusal from `actions.js` carries a code the client can branch on. 409 is the right status
    // for nearly all of them — they mean "not in that state" — with the genuine exceptions listed.
    const STATUS = { insufficient: 402, locked: 403, bad_reward: 400, bad_stake: 400, too_small: 400 };
    const refused = (res, r) => res.status(STATUS[r.code] || 409).json({ error: r.message, code: r.code });

    // What every action needs. `s` is rebuilt per request rather than cached: the actions mutate
    // it in place and a stale one would settle against numbers that have already moved.
    const ctxOf = req => ({
        db: ctx.db,
        database: ctx.database,
        profile: req.player.profile,
        profileRef: req.player.ref,
        discordId: req.player.discordId,
        s: pstate.cubeState(req.player.profile),
        moveTruguts: moveTrugutsFor(req.player.profile, req.player.ref),
    });

    // -----------------------------------------------------------------------
    // Signing in
    // -----------------------------------------------------------------------

    app.post('/auth/token', tokenHandler(ctx));

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
    app.get('/tuning', requireAuth(ctx), (req, res) => res.json({
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

    app.get('/state', auth, async (req, res) => {
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

    // The stake. Clamped to the prestige ceiling in `actions.setStake`, so a client that ignores
    // `maxStake` cannot put more on the table than the ladder allows.
    app.post('/stake', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        const out = actions.setStake(ctxOf(req), { stake: req.body?.stake });
        return out.ok ? res.json(out) : refused(res, out);
    });

    // The loadout. `setLoadout` drops unknown ids, cubes that aren't owned and anything past the
    // slot count, so nothing here has to trust the request.
    app.post('/loadout', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        if (!Array.isArray(req.body?.ids)) {
            return res.status(400).json({ error: 'Expected { ids: [] }.', code: 'bad_body' });
        }
        const ids = req.body.ids.filter(x => typeof x === 'string');
        const out = actions.setLoadout(ctxOf(req), { ids });
        return out.ok ? res.json(out) : refused(res, out);
    });

    // -----------------------------------------------------------------------
    // Playing
    // -----------------------------------------------------------------------

    // Everything the client needs to animate a throw and then show what it paid. The reveal caps
    // the embed lives with — three effect frames, four pay frames — are **not** applied: they are a
    // property of a message edit, and this client has no such limit.
    const rollResponse = (thrown, settled) => ({
        // The line as thrown, one id per position, before any effect resolved.
        thrown: thrown.rolled,
        // The line as it ended up, and the walk that got there.
        line: thrown.res.faceIds,
        steps: thrown.res.steps,
        notes: thrown.res.notes,
        pays: engine.multSteps(thrown.opening, thrown.res.pays,
            settled ? settled.majority : null),
        level: thrown.run.level,
        call: thrown.run.call,
        stake: thrown.run.stake,
        opening: thrown.opening,
        breaker: thrown.breaker,
        ended: thrown.res.ended,
        ...(settled ? { settled } : {}),
    });

    // Stake and call, or push and call. Both end in a throw, which is settled immediately — the
    // client animates a result that is already final, so a closed tab cannot cost a standing.
    app.post('/roll', auth, rateLimit({ perMinute: 60 }), async (req, res) => {
        const ctx = ctxOf(req);
        const call = req.body?.call === 'red' ? 'red' : 'blue';
        const live = persist.ladderOf(ctx.db, ctx.discordId);

        const opened = live ? actions.pushRun(ctx, { call }) : actions.startRun(ctx, { call });
        if (!opened.ok) return refused(res, opened);

        try {
            const thrown = actions.throwLevel(ctx, opened.run);

            // A tie Watto is *asking* about is the one throw that does not settle here. The whole
            // roll is parked where settlement would have written, so it can be picked up and
            // finished later — and it blocks the board until it is.
            if (thrown.asking) {
                actions.parkTie(ctx, thrown, { reverse: opened.reverse || 0 });
                return res.json({
                    ...rollResponse(thrown, null),
                    tie: { asking: true, cost: thrown.cost, worth: thrown.worth },
                    board: boardOf(ctx, req),
                });
            }

            const settled = await actions.settleThrow(ctx, { thrown, reverse: opened.reverse || 0 });
            return res.json({ ...rollResponse(thrown, settled), board: boardOf(ctx, req) });
        } catch (err) {
            // The stake is already spent but nothing settled, so the run would simply vanish. Hand
            // it back, exactly as the embed does when Discord is unreachable mid-roll.
            if (opened.staked) ctx.moveTruguts({ transaction: 'r', amount: opened.staked });
            console.error('[api] /cube/roll:', err);
            return res.status(500).json({ error: 'The roll failed — your stake was returned.' });
        }
    });

    // Cashing out short of the ceiling.
    app.post('/bank', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.bank(ctx);
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // The answer to a parked tie: roll his cube, or buy it off him.
    app.post('/tie', auth, rateLimit({ perMinute: 30 }), async (req, res) => {
        const ctx = ctxOf(req);
        const parked = persist.tieOf(ctx.db, ctx.discordId);
        if (!parked) return refused(res, { code: 'no_tie', message: 'There is no tie waiting.' });

        const answered = actions.answerTie(ctx, { buying: !!req.body?.buy });
        if (!answered.ok) return refused(res, answered);

        try {
            // Off the node before anything settles, so a tie can only ever be answered once — the
            // same job the turn counter does for a double-clicked call in the embed.
            persist.clearLadder(ctx.database, ctx.db, ctx.discordId);
            const settled = await actions.settleThrow(ctx, {
                thrown: answered.thrown,
                bribed: answered.bribed,
                reverse: answered.reverse,
            });
            return res.json({
                ...rollResponse(answered.thrown, settled),
                bribed: answered.bribed,
                board: boardOf(ctx, req),
            });
        } catch (err) {
            console.error('[api] /cube/tie:', err);
            return res.status(500).json({ error: 'Could not settle the tie.' });
        }
    });

    // Spending a banked reroll on the bust that just happened.
    app.post('/reroll', auth, rateLimit({ perMinute: 30 }), async (req, res) => {
        const ctx = ctxOf(req);
        const again = actions.spendReroll(ctx);
        if (!again.ok) return refused(res, again);
        try {
            const thrown = actions.throwLevel(ctx, again.run);
            if (thrown.asking) {
                // The bust this reroll is undoing has to be carried onto the parked node, or
                // answering the tie would settle without reversing it.
                actions.parkTie(ctx, thrown, { reverse: again.reverse });
                return res.json({
                    ...rollResponse(thrown, null),
                    tie: { asking: true, cost: thrown.cost, worth: thrown.worth },
                    board: boardOf(ctx, req),
                });
            }
            const settled = await actions.settleThrow(ctx, { thrown, reverse: again.reverse });
            return res.json({ ...rollResponse(thrown, settled), board: boardOf(ctx, req) });
        } catch (err) {
            console.error('[api] /cube/reroll:', err);
            return res.status(500).json({ error: 'The reroll failed.' });
        }
    });

    // Buying one off the shelf, between runs.
    app.post('/buyreroll', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.buyReroll(ctx);
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // Handing the ladder back for a bigger ceiling and one thing off the rack.
    app.post('/prestige', auth, rateLimit({ perMinute: 10 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.prestige(ctx, { reward: req.body?.reward });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, choices: pstate.rewardChoices(ctx.s), board: boardOf(ctx, req) });
    });

    // What a prestige is worth picking from, so the client can draw the menu.
    app.get('/prestige/choices', auth, (req, res) => {
        const ctx = ctxOf(req);
        if (!pstate.canPrestige(ctx.s)) {
            return res.status(409).json({ error: 'You have not earned a prestige.', code: 'not_eligible' });
        }
        return res.json({ choices: pstate.rewardChoices(ctx.s) });
    });
};
