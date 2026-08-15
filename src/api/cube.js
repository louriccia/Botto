// The chance cube's HTTP surface, for the Discord Activity.
//
// Everything here is **server-authoritative**. The client says "I call blue"; it never says what
// the cubes did. The reason is absolute and survives the cube being fair: the payouts are real
// truguts, so a client that reported its own outcomes would be a client that could mint them.
//
// Responses carry abstract face ids (`greed`, `mult:blue`) and structured notes, never emoji or
// prose — see `src/game/cube/engine.js`. What a face looks like and what it says are the client's
// business, which is the whole reason the engine was pulled out of the embed.

const {
    tokenHandler, requireAuth, requireCube, browserAuthStart, browserAuthCallback,
} = require('./auth.js');
const { rateLimit } = require('./ratelimit.js');

const engine = require('../game/cube/engine.js');
const pstate = require('../game/cube/state.js');
const persist = require('../game/cube/persist.js');
const actions = require('../game/cube/actions.js');
const {
    LEVELS, SPECIALS, SIDES, WATTO, cube: config,
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
        // Exactly one of these is ever set: a run in progress, a bust holding a reroll offer, or a
        // roll parked on a tie. They share one node and are not the same thing.
        run: live || null,
        dead: dead || null,
        tie: tie || null,
        // Derived progression the client would otherwise have to reimplement — and reimplementing
        // it is how two clients start disagreeing about whether a level is open.
        //
        // `route` is the whole road in order: the five levels and every **Again** still standing
        // between them, each flagged `cleared` or not. Cleared ones are **sent** rather than
        // filtered out, because the map is a progress bar and a progress bar has to show the ground
        // already covered — the *run* skips them, which is a different question and one only
        // `next` answers.
        progress: {
            top: pstate.topOf(s),
            goal: pstate.goalOf(s),
            // Agains per gap. `perLevel` is the name the client grew up with and means the same
            // number; `gap` is what it is called now.
            gap: pstate.gapSize(s),
            perLevel: pstate.gapSize(s),
            canPrestige: pstate.canPrestige(s),
            maxLevel: pstate.MAX_LEVEL,
            ...pstate.routeOf(s),
            // The rung a live run would push onto, so the client can draw the bank-or-push offer
            // without walking the route itself. Null between runs, where there is nothing to push.
            next: live ? pstate.nextRung(s, live.level) : null,
        },
        // What a prestige point buys, which is a function of what is already owned rather than of
        // whether there is a point to spend — `player.points` is what decides affordability. Sent
        // with the board so a rack screen needs no second request, and so there is only ever one
        // answer on screen about what is on offer.
        choices: pstate.rewardChoices(s),
        // **The player's welds, built.** `/tuning` carries the cubes that exist for everyone; a weld
        // exists for one player and is assembled from an id, so this is the only place a client can
        // learn what is on one.
        //
        // Built here rather than parsed there on purpose. The id *is* the recipe and the client holds
        // every parent's face list, so it could do this itself — and then there would be two
        // implementations of what a weld is, which is the thing pulling the engine out of the embed
        // was meant to stop. Same shape as a `/tuning` special, so the rack draws it with the same
        // code that draws everything else.
        welds: s.cubes
            .map(id => engine.specialById(id))
            .filter(sp => sp && sp.welded)
            .map(sp => ({
                id: sp.id, name: sp.name, blurb: sp.blurb, welded: sp.welded, faces: sp.faces,
            })),
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
    const STATUS = {
        insufficient: 402, locked: 403, bad_reward: 400, bad_stake: 400, too_small: 400,
        // A loadout longer than the bag is a bad request rather than a conflict: nothing about the
        // player's state would make it succeed, so 400 is what tells a client to fix the list.
        too_many: 400,
    };
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

    // Inside Discord: the Embedded SDK hands over a code and this exchanges it.
    app.post('/auth/token', tokenHandler(ctx));

    // In a browser: an ordinary OAuth redirect, run by this service, so the Activity is playable as
    // a page on the site by anyone logged in there. Both flows end at the same cube token and the
    // same player — see the note in `auth.js` for why the site's own session is not reused.
    //
    // Unauthenticated by necessity, like the exchange above: they *are* the sign-in.
    app.get('/auth/discord', browserAuthStart);
    app.get('/auth/callback', browserAuthCallback(ctx));

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
        watto: WATTO,
        config: wireConfig,
    }));

    // -----------------------------------------------------------------------
    // The board
    // -----------------------------------------------------------------------

    app.get('/state', auth, async (req, res) => {
        try {
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

    // The loadout. `setLoadout` collapses duplicates, drops unknown or unowned ids and **refuses more
    // than `bagSize()` of them** with `too_many`, so nothing here has to trust the request. The cap is
    // the bag: a run draws eight cubes across the climb, so eight is what a rack can field.
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
        // **What a face id cannot say about the position it is standing on**, index for index against
        // the line beside it — see `lineState` in the engine. `frozen` is Ando Prime holding a cube on
        // the face it is showing, `burned` is what Baroonda has scorched off the cube standing there,
        // and `cubeIds` is which cube it is at all — the one thing a client naming the casualties of
        // an effect cannot work out from the faces alone.
        //
        // Two copies rather than one, because the two lines genuinely disagree and the difference is
        // the beat: a scorch applied on this rung is on the resolved line and not on the thrown one,
        // and a cube whose ice an effect broke against is held on the throw and thawed by the payout.
        // Every step carries its own for the same reason.
        thrownState: thrown.rolledState,
        // The line as it ended up, and the walk that got there.
        line: thrown.res.faceIds,
        frozen: thrown.res.frozen,
        burned: thrown.res.burned,
        // Which positions landed on a face Baroonda had already been at — dead where they stand, and
        // counting toward nothing. See `lineState`.
        charred: thrown.res.charred,
        cubeIds: thrown.res.cubeIds,
        steps: thrown.res.steps,
        notes: thrown.res.notes,
        pays: engine.multSteps(thrown.opening, thrown.res.pays,
            settled ? settled.majority : null),
        level: thrown.run.level,
        // Which rung this was. `kind` is 'level' or 'again'; `again` is which time round, so a
        // client can draw `Again ×3` without inferring it from anything.
        kind: thrown.kind,
        again: thrown.run.again || 0,
        call: thrown.run.call,
        stake: thrown.run.stake,
        opening: thrown.opening,
        breaker: thrown.breaker,
        // What the line *held*, as totals rather than as faces — and the client cannot derive either
        // from `line`. Both pay in the first pass and can be written over in the second, which leaves
        // the line with no position to count them off; a mirrored copy pays without ever having been
        // thrown. Sent for the same reason a razed greed still gets a `pays` entry with no `at`: a
        // readout that climbs with nothing on screen to explain it reads as a bug.
        //
        // **Held, not banked.** Neither is awarded off a roll that ends the run — see `settleThrow` —
        // so a client counting these up has to check `settled.won` first, exactly as it does for `pays`.
        rerolls: thrown.res.rerolls,
        shortcuts: thrown.res.shortcuts,
        ended: thrown.res.ended,
        // How many cubes the table had spawned when the engine gave up on it, 0 on every roll that
        // resolved. The bust reason already says `overflow`; this is the number, which is the only
        // part of that ending a client can't work out from the line in front of it — the line stops
        // at whatever `maxCubes` and the effects left standing, not at the count that tripped it.
        overflow: thrown.res.overflow,
        // **How many cubes the bag had left when this roll finished.** The client reads that off the
        // run the roll left behind, which works until there is no run left to read: a bust by a player
        // with no reroll banked clears the ladder outright — see `settleLoss` — so a run that died on
        // its opening throw could never say what it had been drawing from. Sent on every roll rather
        // than only on that one, because a figure a client has to fetch two ways is a figure that will
        // disagree with itself.
        bag: (thrown.bag || []).length,
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

        // Whether the roll is on the books. Past this point the stake is not the API's to hand back:
        // the parked tie holds that same stake and pays out on it, so refunding as well credits the
        // player twice for one roll and leaves a tie on the board that has already been paid for.
        let committed = false;
        try {
            const thrown = actions.throwLevel(ctx, opened.run);

            // A tie Watto is *asking* about is the one throw that does not settle here. The whole
            // roll is parked where settlement would have written, so it can be picked up and
            // finished later — and it blocks the board until it is.
            if (thrown.asking) {
                actions.parkTie(ctx, thrown, { reverse: opened.reverse || 0 });
                committed = true;
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
            if (opened.staked && !committed) ctx.moveTruguts({ transaction: 'r', amount: opened.staked });
            console.error('[api] /cube/roll:', err);
            return res.status(500).json({
                error: committed
                    ? 'The roll landed but the answer did not — reopen the board to pick it up.'
                    : 'The roll failed — your stake was returned.',
            });
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

    // Handing the ladder back for a bigger ceiling and a point to spend. Takes no body: what the
    // point buys is a separate decision, made whenever the player feels like making it.
    app.post('/prestige', auth, rateLimit({ perMinute: 10 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.prestige(ctx);
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // Spending one banked point. `boardOf` carries the remaining balance and the shortened list of
    // what is left on offer, so a client never has to work either out for itself.
    app.post('/point', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.spendPoint(ctx, { reward: req.body?.reward });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // ---------------------------------------------------------------------
    // The board of records
    // ---------------------------------------------------------------------
    //
    // **Weekly, not all-time**, and the reasoning is in `weekKey`: in a mode this swingy an all-time
    // board is won once by whoever was standing on a fresh prestige road when a ×140 landed and is
    // dead content afterwards. A week gives everyone a live shot every Monday.
    //
    // **No new storage and no new writes.** `db.user` is the whole user tree, already in memory from
    // the Firebase listener, and `challenge/leaderboard.js` established that scanning it is what a
    // leaderboard here does. The numbers are the ones `recordRoll` already files.
    //
    // Three columns and not truguts won: a wealth board ranks volume, and the point of ranking a
    // multiple is that nobody can grind their way to one.
    // **All three ranges come back from one scan.** The client toggles between week, month and
    // all-time without refetching, which is the difference between a toggle that feels like a filter
    // and one that feels like a page load — and the expensive half is the walk over the user tree,
    // which happens once either way.
    app.get('/leaderboard', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        try {
            const me = req.player.discordId;
            const keys = { week: pstate.weekKey(), month: pstate.monthKey() };
            const rows = { week: [], month: [], all: [] };
            for (const u of Object.values(ctx.db.user || {})) {
                const c = u?.random?.cube;
                if (!u?.discordID || !c) continue;
                const who = { id: String(u.discordID), name: u.random?.name || u.name || null };
                // A rolling window only counts if its stored key is the current one — a stale block is
                // last week's numbers and must not be ranked against this week's.
                for (const name of ['week', 'month']) {
                    const w = c[name];
                    if (!w || w.id !== keys[name]) continue;
                    rows[name].push({
                        ...who,
                        multiple: Number(w.multiple) || 0,
                        cubes: Number(w.cubes) || 0,
                        streak: Number(w.streak) || 0,
                        // When each of those landed, so the board can date its rows. Zero for anything
                        // filed before the stamps existed — see `stampsOf`.
                        at: pstate.stampsOf(w.at),
                    });
                }
                rows.all.push({
                    ...who,
                    multiple: Number(c.bestMultiple) || 0,
                    cubes: Number(c.bestCubes) || 0,
                    streak: Number(c.bestStreak) || 0,
                    at: pstate.stampsOf(c.bestAt),
                });
            }
            // One ranking per column rather than one sorted list: a player can lead the multiple and
            // be nowhere on the streak, and collapsing that into a single score invents a composite
            // nobody asked for.
            const rank = function (list) {
                const board = {};
                for (const key of ['multiple', 'cubes', 'streak']) {
                    const ranked = list.filter(r => r[key] > 0).sort((a, b) => b[key] - a[key]);
                    const at = ranked.findIndex(r => r.id === me);
                    board[key] = {
                        top: ranked.slice(0, 10).map((r, i) => ({
                            rank: i + 1, id: r.id, name: r.name, value: r[key], you: r.id === me,
                            at: r.at?.[key] || 0,
                        })),
                        // Where the caller sits, so a player outside the top ten is told something
                        // rather than left to assume the board is broken.
                        you: at < 0 ? null : { rank: at + 1, value: ranked[at][key], at: ranked[at].at?.[key] || 0 },
                        players: ranked.length,
                    };
                }
                return board;
            };
            return res.json({
                keys,
                ranges: { week: rank(rows.week), month: rank(rows.month), all: rank(rows.all) },
            });
        } catch (err) {
            console.error('[api] /cube/leaderboard:', err);
            return res.status(500).json({ error: 'Could not read the board.' });
        }
    });

    // ---------------------------------------------------------------------
    // The press
    // ---------------------------------------------------------------------
    //
    // Three routes, and every one of them answers with the whole board — welding rewrites `cubes`,
    // `equipped` and `points` at once, so a client reconciling three separate deltas is a client
    // that will eventually disagree with the server about what is on the table.
    //
    // Rate limits are tighter than the shop's on purpose: a press is a spend, and the reroll is the
    // one action in the mode a player might reasonably want to hammer.

    // Two cubes in, one out. Costs a prestige point.
    app.post('/weld', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(x => typeof x === 'string') : [];
        const out = actions.weldCubes(ctx, { ids });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // A fresh cut of the same two cubes. `paying` picks the currency — anything other than the
    // literal `points` is truguts, so a malformed body spends the abundant one rather than the
    // scarce one.
    app.post('/weld/reroll', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.rerollWeld(ctx, {
            id: req.body?.id,
            paying: req.body?.paying === 'points' ? 'points' : 'truguts',
        });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // Breaking one apart. Free, and the roll is lost — the client is responsible for saying so
    // before it calls this, because there is nothing to undo it with.
    app.post('/weld/break', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        const out = actions.unweld(ctx, { id: req.body?.id });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });
};
