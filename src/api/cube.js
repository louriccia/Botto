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
    LEVELS, SPECIALS, SIDES, WATTO, TREE, TREES, SIDE_BETS, SKIN_SETS, cube: config,
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
    const shown = persist.shownOf(ctx.db, discordId);
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
        // What a build token buys, which is a function of what is already owned rather than of
        // whether there is a point to spend — `player.points` is what decides affordability. Sent
        // with the board so a rack screen needs no second request, and so there is only ever one
        // answer on screen about what is on offer.
        choices: pstate.rewardChoices(s),
        // **Watto's book for the rung ahead**, dressed. Three ids are written onto the ladder by the
        // settlement that opened the rung; this is what they say and what they pay, so the client
        // holds no copy of the table — the same split `choices` follows.
        //
        // Empty between runs, on Level 1, and for anyone who has not bought the Side Bet: the draw
        // itself is what decides, and it offers nothing a rack cannot actually produce.
        book: (live ? Object.values(live.book || {}) : [])
            .map(id => SIDE_BETS.find(b => b.id === id))
            .filter(Boolean)
            .map(b => ({
                id: b.id, band: b.band, price: b.price, say: b.say,
                // **What the multiple actually moves by if it lands**, which is the price *plus the
                // ante back* — see `betPaid`. Sent rather than left to the client to add, for the same
                // reason the arm prices are: the figure on the card has to be the figure the reveal
                // shows climbing, or the two disagree on screen and one of them is wrong.
                pays: b.price + engine.betPriceOf(),
                ante: engine.betPriceOf(),
            })),
        // **What everything Watto sells costs on this rung, already worked out.** The rules are on
        // `/tuning` and the client could round them itself, but two roundings are two prices — and the
        // one on the button has to be the one the server will actually charge or the standing jumps
        // when it is pressed. So the arithmetic is done once, here, against the live multiple.
        //
        // `armed` rides beside them because the pair is one question on screen: what is already bought
        // for this rung, and what the rest would cost. Null between runs, where nothing is for sale.
        prices: live ? {
            // **Per arm, because they are no longer one price.** Scrap and Swap are priced separately —
            // see `armShares` in `tuning.js` — so a single `arm` figure would put Scrap's price on Swap's
            // button and the standing would jump when it was pressed. `arm` is kept as the fallback for
            // anything unlisted, which today is Split.
            arm: engine.armPriceOf(live.mult),
            arms: {
                scrap: engine.armPriceOf(live.mult, 'scrap'),
                swap: engine.armPriceOf(live.mult, 'swap'),
                split: engine.armPriceOf(live.mult, 'split'),
            },
            // The look is a share of the standing now rather than a flat mult, so it has to be worked out
            // against the live multiple like the arms are.
            look: engine.lookPriceOf(live.mult),
            bet: engine.betPriceOf(),
            // Which of the three are paid up for the rung ahead. Cleared by every settlement, so a
            // board drawn between rungs shows an empty set even if the last rung was fully armed.
            armed: {
                scrap: !!(live.armed || {}).scrap,
                swap: !!(live.armed || {}).swap,
                split: !!(live.armed || {}).split,
            },
            // Whether the standing can carry one more purchase at all. `spendMultiple` refuses a price
            // that would leave nothing behind, and a button that offers a refusal is a bug on screen.
            canAfford: (Number(live.mult) || 0) > engine.armPriceOf(live.mult),
            // Per arm too: Swap can be affordable on a standing that cannot carry Scrap.
            canAffordArm: {
                scrap: (Number(live.mult) || 0) > engine.armPriceOf(live.mult, 'scrap'),
                swap: (Number(live.mult) || 0) > engine.armPriceOf(live.mult, 'swap'),
                split: (Number(live.mult) || 0) > engine.armPriceOf(live.mult, 'split'),
            },
            canLook: (Number(live.mult) || 0) > engine.lookPriceOf(live.mult),
            // **The ante has its own test.** The board was reading `canAfford` for it, which is the *arm*
            // test — so on a standing that covers an arm but not the ante it offered a bet the server
            // would refuse. They were the same number once and are not now.
            canAnte: (Number(live.mult) || 0) > engine.betPriceOf(),
        } : null,
        // **A roll stopped with the cubes down, for a board that has just re-mounted.** Sent for the
        // same reason `seen` is: the hold is a state of the *run*, not of the frame it was drawn in,
        // and a client that could only learn about it from the answer to its own `/roll` came back
        // from a reload offering a call on a rung that was already called and already thrown. Null on
        // every board that is not mid-hold, which is nearly all of them.
        held: actions.heldRoll({ s, db: ctx.db, discordId }),
        // **The face a premonition showed**, for as long as the roll it was taken on is still parked.
        // Sent rather than left to the client to hold, so it survives the Activity re-mounting — and
        // so there is one answer on screen about what was seen.
        seen: shown && shown.seen != null
            ? {
                at: shown.seen,
                face: Object.values(shown.faces || {})[shown.seen] || null,
                // How many cubes the look was one of, which is what makes it a glimpse rather than a
                // report. Off the parked line rather than the level's own count: a rung the bag ran
                // dry on is shorter than the table says.
                cubes: Object.values(shown.faces || {}).length,
            }
            : null,
        // Which of the three is named, if any. On the run node too, but lifted here beside the book it
        // belongs to rather than left for a client to go looking for.
        bet: (live && live.bet) || null,
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

// The two things a press request can name, read off the body and nothing more. Whether either is
// **allowed** is `pressPicks` in the actions, which is where every other ownership test lives — and so is
// turning a cube id into the position the engine wants.
const pressPickOf = req => (typeof req.body?.major === 'string' ? req.body.major : null);
const keeperOf = function (req) {
    const keep = req.body?.keep;
    if (!keep || typeof keep.parent !== 'string' || typeof keep.faceId !== 'string') return null;
    return { parent: keep.parent, faceId: keep.faceId };
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
        // A set id nothing on the shelf answers to is a request naming something that does not
        // exist, which is a 404 rather than a state the player could get into.
        no_such_set: 404,
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
        // The shape of the rack: five trees and every node's tier and prerequisites. Static, so it
        // belongs here beside `specials` rather than on the board — what changes per player is which
        // of these are *offered*, and that is `choices`.
        //
        // Sent whole, including nodes the player will never see this prestige, because a client that
        // only knew about reachable nodes could not draw a locked one — and a tree you cannot see the
        // top of is a tree you cannot choose a branch of. Locked nodes are the point.
        //
        // Dressed by `treeCatalogue` rather than sent raw, so the copy on a locked node comes from
        // the same place as the copy on an offered one. The alternative was a client holding its own
        // table of perk names, which is two answers to what a thing is called.
        trees: TREES,
        tree: pstate.treeCatalogue(),
        // The cosmetics shelf: every set on sale, what it grants, what it costs and what opens it.
        // Static like `specials` — what changes per player is which of them are *held* and which
        // gates are open, and that is `player.skins` on the board.
        //
        // **Sent so the client stops holding a price list.** It shipped with its own copy of this
        // table beside the art, which is two answers to what something costs; the shape here is the
        // one it already reads, so the day it takes this it takes the whole thing rather than merging
        // — a price half from the server and half from a bundle is the version that overcharges
        // somebody quietly.
        skins: SKIN_SETS,
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
        // **The side bet this rung was carrying, and what it paid.** Both are already worked out by the
        // settlement — see `settleThrow` — and neither is derivable on the other side: the board's `bet`
        // is nulled the moment the rung settles, and whether a proposition *hit* is a predicate in
        // `SIDE_BETS` that only this side holds. `betPaid` folds into the rung's multiple beside the
        // roll's own paying faces, so a client that cannot see it has a readout climbing by a figure
        // with nothing on screen to explain it — the same reason a razed greed still gets a `pays` entry.
        //
        // `0` on a bet that missed and `null` on a rung nobody bet, which are different facts: one is a
        // proposition that lost and has to be shown losing, the other is nothing to show.
        bet: thrown.bet || null,
        betPaid: thrown.bet ? (Number(thrown.betPaid) || 0) : null,
        ...(settled ? { settled } : {}),
    });

    // Stake and call, or push and call. Both end in a throw, which is settled immediately — the
    // client animates a result that is already final, so a closed tab cannot cost a standing.
    app.post('/roll', auth, rateLimit({ perMinute: 60 }), async (req, res) => {
        const ctx = ctxOf(req);
        const call = req.body?.call === 'red' ? 'red' : 'blue';
        const live = persist.ladderOf(ctx.db, ctx.discordId);

        // A throw parked by a premonition: the rung has already advanced and the cubes are already
        // down, so this roll names the side and settles rather than pushing again.
        const shown = persist.shownOf(ctx.db, ctx.discordId);
        const opened = shown && !shown.called
            ? { ok: true, staked: 0, run: null }
            : (live ? actions.pushRun(ctx, { call }) : actions.startRun(ctx, { call }));
        if (!opened.ok) return refused(res, opened);

        // Whether the roll is on the books. Past this point the stake is not the API's to hand back:
        // the parked tie holds that same stake and pays out on it, so refunding as well credits the
        // player twice for one roll and leaves a tie on the board that has already been paid for.
        let committed = false;
        try {
            // **A rung already holding a thrown line settles that one.** A premonition threw these
            // cubes before the side was named — the whole point of it — so throwing again here would
            // hand back a different roll from the one the player was shown a face of. `takeThrow`
            // rebuilds it and the call arrives now, which is the order that makes the look worth
            // having. See `parkThrow`.
            const parked = shown && !shown.called ? actions.takeThrow(live, shown, call) : null;

            // **A roll stops with the cubes down whenever there is still something that could change
            // them.** Swap, Scrap and Split all act in the gap before effects fire, and the decision
            // they exist for is a *read of the line* — so asking for it in advance, blind, is asking
            // the one question the player has no way to answer. Held, they see the roll and then
            // choose; `Roll on` is the answer when there is nothing worth doing, which is most rungs.
            //
            // `holdRoll` refuses when nothing was armed for this rung, and that refusal is the ordinary
            // path rather than an error: it means this roll simply settles. Since arming is a purchase
            // made before the call, most rolls take it.
            {
                const run = parked ? { ...parked.run, call } : opened.run;
                const out = actions.holdRoll(ctx, run, parked);
                if (out.ok) {
                    committed = true;
                    return res.json({ ...out, board: boardOf(ctx, req) });
                }
                // **Every one of these means "this roll simply settles", not "something went wrong".**
                // Nothing armed for the rung, no pick owned at all, no ladder yet because this is the
                // run's opening roll, or a rung too short to change. Anything else is a genuine refusal
                // and is handed back.
                //
                // `unarmed` is the common one now and it is the whole point of the change: a player who
                // bought nothing for this rung gets the plain roll they used to get before any of these
                // picks existed. `spent` is kept for a client mid-flight across the deploy.
                const settles = ['unarmed', 'not_owned', 'spent', 'no_run', 'too_few'];
                if (!settles.includes(out.code)) return refused(res, out);
            }

            const thrown = parked
                ? actions.resolveThrown(ctx, parked.run, parked)
                : actions.throwLevel(ctx, opened.run);

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

    // **Premonition.** Throws the next rung early and hands back one face off it.
    //
    // Nothing is spent and nothing settles: the rung advances onto a parked throw pinned to the live
    // run, so a player who looks and then banks walks away with exactly what they had. The roll that
    // follows settles *this* line — `/roll` looks before it throws.
    app.post('/premonition', auth, rateLimit({ perMinute: 30 }), (req, res) => {
        const rctx = ctxOf(req);
        const out = actions.premonition(rctx);
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(rctx, req) });
    });

    // **Finishes a roll held for a look at the line**, doing at most one thing to it on the way past:
    // Swap exchanges two positions, Scrap takes one off, Split breaks a weld into the cubes it was
    // pressed from, and passing does none of them. One route rather than four because they are one moment
    // — the line is down, unresolved, and this is what closes it — and because a client that could alter a
    // line twice would be a client that could spend three trees' worth of agency on one rung.
    //
    // It settles, which is why it is a post and not a patch — the swap and the resolution are one
    // step, and a client that swapped and then failed to settle would leave a called rung in the air.
    app.post('/held', auth, rateLimit({ perMinute: 30 }), async (req, res) => {
        const rctx = ctxOf(req);
        const a = Number.isInteger(req.body?.a) ? req.body.a : null;
        const b = Number.isInteger(req.body?.b) ? req.body.b : null;
        const scrap = Number.isInteger(req.body?.scrap) ? req.body.scrap : null;
        const split = Number.isInteger(req.body?.split) ? req.body.split : null;
        // **A change leaves the roll held; only an empty body ends it.** Not so a second change can be
        // made — one hold is one change, see `alterShown` — but so the change is *watchable*: the board
        // replays the line with the cube that moved, then settles of its own accord. Applying and
        // settling in one request would resolve the effects onto a line the player never saw.
        const changing = a != null || b != null || scrap != null || split != null;
        if (changing) {
            const alt = actions.alterShown(rctx, {
                a, b, scrap, split,
            });
            if (!alt.ok) return refused(res, alt);
            return res.json({ ...alt, board: boardOf(rctx, req) });
        }
        const out = actions.finishShown(rctx);
        if (!out.ok) return refused(res, out);
        try {
            const thrown = actions.resolveThrown(rctx, out.run, out.thrown);
            if (thrown.asking) {
                actions.parkTie(rctx, thrown);
                return res.json({
                    ...rollResponse(thrown, null),
                    tie: { asking: true, cost: thrown.cost, worth: thrown.worth },
                    board: boardOf(rctx, req),
                });
            }
            const settled = await actions.settleThrow(rctx, { thrown });
            return res.json({ ...rollResponse(thrown, settled), board: boardOf(rctx, req) });
        } catch (err) {
            // The rung was already called and the cubes are already down, so there is no stake to hand
            // back — the same position `/roll` is in once it has committed.
            console.error('[api] /cube/held:', err);
            return res.status(500).json({
                error: 'The roll landed but the answer did not — reopen the board to pick it up.',
            });
        }
    });

    // **Buying a pick for the rung ahead, out of the standing.** One route for all three because they
    // are one moment and one price — see `arm` in `actions.js`, and `armShare` in `tuning.js` for why
    // the price is here rather than on the pick's use.
    //
    // Rated with the calls rather than with the shop: a player deciding rung by rung will touch this as
    // often as they touch `/roll`, and three picks a rung is three requests.
    app.post('/arm', auth, rateLimit({ perMinute: 60 }), (req, res) => {
        const rctx = ctxOf(req);
        const pick = typeof req.body?.pick === 'string' ? req.body.pick : null;
        const out = actions.arm(rctx, { pick });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(rctx, req) });
    });

    // Naming one of the three, or taking the name back. The ante moves with the name; see `placeBet`.
    app.post('/sidebet', auth, rateLimit({ perMinute: 60 }), (req, res) => {
        const rctx = ctxOf(req);
        const id = typeof req.body?.id === 'string' ? req.body.id : null;
        const out = actions.placeBet(rctx, { id });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(rctx, req) });
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

    // Buying a side skin off the cosmetics shelf. Truguts, and the only thing they buy in this mode
    // that is not spent again — what comes back is on the profile for good.
    //
    // The **set** id, not the variant ids: the price and the gate are then checked against the thing
    // that was actually offered rather than against a list the client assembled. What the sets are is
    // `/tuning`; what this player holds is `player.skins` on every board.
    app.post('/skin', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        if (typeof req.body?.id !== 'string') {
            return res.status(400).json({ error: 'Expected { id }.', code: 'bad_body' });
        }
        const out = actions.buySkin(ctx, { id: req.body.id });
        if (!out.ok) return refused(res, out);
        return res.json({ ...out, board: boardOf(ctx, req) });
    });

    // Wearing one. Separate from buying it for the same reason spending a point is separate from the
    // prestige that earned it: owning a picture and choosing to field it are two decisions, and the
    // second one is made over and over.
    app.post('/sides', auth, rateLimit({ perMinute: 60 }), (req, res) => {
        const ctx = ctxOf(req);
        if (typeof req.body?.side !== 'string' || typeof req.body?.id !== 'string') {
            return res.status(400).json({ error: 'Expected { side, id }.', code: 'bad_body' });
        }
        const out = actions.equipSide(ctx, { side: req.body.side, id: req.body.id });
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

    // Wearing one cell of the comb, which is only offered at a prestige — `player.pick` on the board is
    // whether one is waiting, and it is on the board rather than only in the answer above so a client
    // that re-mounted mid-prompt still knows to raise it.
    app.post('/emblem', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        if (typeof req.body?.id !== 'string') {
            return res.status(400).json({ error: 'Expected { id }.', code: 'bad_body' });
        }
        const out = actions.pickEmblem(ctx, { id: req.body.id });
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
                // **Who, and what they rep.** The emblem is the cell of their comb they are wearing and
                // the prestige count is what the rings around it are drawn from, so the pair travels
                // together — one is unreadable without the other. Read through the same guards a board
                // does: a stale emblem naming a cell no longer in the comb is nothing, not a claim.
                const prestige = Math.max(Number(c.prestige) || 0, 0);
                const who = {
                    id: String(u.discordID),
                    name: u.random?.name || u.name || null,
                    emblem: pstate.emblemOf(c, pstate.combOf(c, prestige)),
                    prestige,
                };
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
                            // Projected explicitly like everything else on a row: the rank objects are
                            // built rather than spread, so a field added to `who` above reaches the
                            // board only by being named here.
                            emblem: r.emblem, prestige: r.prestige,
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

    // Two cubes in, one out. Costs a build token.
    //
    // **`major` and `keep` are the two the press has never been sent.** `major` is a cube id — which
    // parent an uneven cut pours the most faces from, part of Deep Cuts. `keep` is The Keeper,
    // `{ parent, faceId }`, one face the cut has to carry. Both are validated against the profile by
    // `pressPicks` in the actions, which is also what turns the ids into positions, and both are dropped
    // rather than refused when they are not owned — so a client that sends them before the rung is bought
    // presses exactly as it always did.
    app.post('/weld', auth, rateLimit({ perMinute: 20 }), (req, res) => {
        const ctx = ctxOf(req);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(x => typeof x === 'string') : [];
        const out = actions.weldCubes(ctx, { ids, major: pressPickOf(req), keep: keeperOf(req) });
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
            major: pressPickOf(req),
            keep: keeperOf(req),
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
