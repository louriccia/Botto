const crypto = require('crypto');
const engine = require('./engine.js');
const pstate = require('./state.js');
const persist = require('./persist.js');
const { cube: config } = require('./tuning.js');

const { MAX_LEVEL } = engine;

const balanceOf = p => (Number(p?.truguts_earned) || 0) - (Number(p?.truguts_spent) || 0);
exports.balanceOf = balanceOf;

const refuse = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

const ARMS = ['scrap', 'swap', 'split'];
exports.ARMS = ARMS;
const PERK_FOR = { scrap: 'scrap', swap: 'shuffle', split: 'split' };
const armsOf = a => Object.fromEntries(ARMS.filter(k => a && a[k]).map(k => [k, true]));
const isArmed = (a, k) => !!(a && a[k]);
const disarm = (a, k) => Object.fromEntries(ARMS.filter(x => x !== k && a && a[x]).map(x => [x, true]));

// The trugut twin of `chargeLadder`: check the purse, refuse in the one wording every refusal uses,
// then withdraw. Three shops charge truguts and each had written out the same three lines.
const chargeTruguts = function (ctx, cost) {
    const balance = balanceOf(ctx.profile);
    if (cost > balance) {
        return refuse('insufficient', `That costs ${cost} but you only have ${balance}.`, { cost, balance });
    }
    ctx.moveTruguts({ transaction: 'w', amount: cost });
    return { ok: true, cost, balance };
};

const chargeLadder = function (live, price) {
    const spent = engine.spendMultiple(Number(live.stake) || 0, Number(live.mult) || 0, price);
    if (!spent) {
        return refuse('too_poor', `That costs ${price}\u00d7 and you are standing on less.`, { price });
    }
    return { ok: true, price, live: { ...live, mult: spent.mult, standing: spent.standing } };
};

const throwLevel = function (ctx, run) {
    const { s } = ctx;
    const kind = engine.rungKind(run.level, run.again);
    const drawn = (run.regrow === false || kind !== 'level')
        ? { set: run.set || [], bag: run.bag || [] }
        : engine.drawCubes(run.set || [], run.bag || [], run.level);

    const set = drawn.set;
    const line = engine.throwSet(set);
    return resolveThrown(ctx, run, {
        line, set, bag: drawn.bag, kind,
    });
};
exports.throwLevel = throwLevel;

const resolveThrown = function (ctx, run, { line, set, bag: drawnBag, kind, wrecked = [] }) {
    const { s } = ctx;
    const rolled = engine.rolledFaces(line);
    const rolledState = engine.lineState(line);
    const res = engine.resolveLine(line, run.call, drawnBag, {
        hold: run.hold || [],
        wrecked,
        rungs: (Number(run.rungs) || 0) + 1,
    });

    const tie = !res.overflow && !!res.faceIds.length && !res.majority;

    const betPaid = engine.betPaid(run.bet, res, run.call);
    const base = engine.rungMultiple(kind, run.mult, res.mult + betPaid);
    const opening = engine.rungMultiple(kind, run.mult, 0);

    const worth = tie ? engine.bankPayout(run.stake, engine.applyMults(base, res.mults, run.call)) : 0;
    const cost = tie && s.bribe ? pstate.bribeCostFor(worth, s.bribes, s.nudge) : 0;
    const asking = tie && s.bribe;
    const breaker = tie && !asking ? engine.rollTiebreak(run.call, s.nudge) : null;

    return {
        run, res, rolled, rolledState, set, bag: res.bag || drawnBag, line, wrecked,
        kind,
        tie, asking, breaker, base, opening, worth, cost,
        bet: run.bet || null, betPaid,
    };
};

const parkThrow = function (ctx, run, { line, bag, kind, seen = null, changed = false, wrecked = [] }) {
    const { database, db, discordId } = ctx;
    const live = persist.ladderOf(db, discordId);
    if (!live) return null;
    const shown = {
        ...engine.encodeLine(line),
        level: run.level,
        again: run.again || 0,
        kind,
        called: run.call || null,
        bag: engine.encodeBag(bag),
        rungs: Number(run.rungs) || 0,
        seen,
        changed,
        wrecked: engine.encodeSet(wrecked),
    };
    persist.saveLadder(database, db, discordId, {
        ...live,
        shown,
        saw: !!run.saw,
        armed: armsOf(run.armed),
    });
    return shown;
};
exports.parkThrow = parkThrow;

const takeThrow = function (live, shown, call) {
    const run = {
        stake: Number(live.stake) || 0,
        standing: Number(live.standing) || 0,
        level: shown.level,
        again: Number(shown.again) || 0,
        call,
        mult: Number(live.mult) || 0,
        spent: Object.values(live.spent || {}),
        hold: engine.decodeSet(live.hold),
        rungs: Number(shown.rungs) || 0,
        sealed: live.sealed || null,
        saw: !!live.saw, armed: armsOf(live.armed),
        bet: live.bet || null,
        betUsed: !!live.betUsed || !!live.bet,
    };
    const set = engine.decodeSet(shown.set);
    return {
        run,
        set,
        line: engine.relineFrom(set, Object.values(shown.faces || {}), shown.state || {}),
        bag: engine.decodeBag(shown.bag),
        kind: shown.kind,
        wrecked: engine.decodeSet(shown.wrecked),
    };
};
exports.takeThrow = takeThrow;

const settleThrow = async function (ctx, { thrown, bribed = 0, reverse = 0 }) {
    const { s, profile, profileRef } = ctx;
    const { run, res, breaker, bag } = thrown;

    const majority = res.majority || breaker || (bribed ? run.call : null);
    const cubes = res.cubes;
    const won = !res.overflow && !!res.faceIds.length && !!majority && majority === run.call;
    const pure = won && res.pure;
    const spent = run.spent || [];
    const shattered = res.broken.length ? [...new Set([...spent, ...res.broken])] : spent;
    const back = new Set(res.recovered || []);
    const stillSpent = back.size ? shattered.filter(id => !back.has(id)) : shattered;
    const mult = engine.applyMults(thrown.base, res.mults, majority);
    const standing = won ? engine.bankPayout(run.stake, mult) : 0;

    const patch = {};
    const records = pstate.recordRoll(s, patch, {
        call: run.call, won, cubes, level: run.level, standing,
        opening: !(Number(run.rungs) || 0),
        line: res.faceIds.length,
        multiple: mult,
    });
    pstate.recordFaces(s, patch, res.faceLog);
    if (won && res.rerolls) pstate.addReroll(s, patch, res.rerolls);

    if (reverse) pstate.unrecordLost(s, patch, reverse);
    if (bribed) {
        pstate.recordSpent(s, patch, bribed);
        pstate.addBribe(s, patch);
    }
    if (thrown.tie) {
        pstate.recordTie(s, patch, {
            bribed, breaker, call: run.call,
        });
    }

    const outcome = won
        ? settleWin(ctx, { run, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag })
        : settleLoss(ctx, { run, res, thrown, patch });

    persist.writeCube(profileRef, profile, patch);

    return {
        ...outcome,
        majority, won, pure, mult, standing, cubes,
        shattered: res.broken,
        records,
        balance: balanceOf(profile),
    };
};
exports.settleThrow = settleThrow;

const settleLoss = function (ctx, { run, res, thrown, patch }) {
    const { s, db, database, discordId } = ctx;
    const reason = res.overflow ? 'overflow'
        : res.ended ? 'ratts'
            : !res.faceIds.length ? 'empty'
                : !res.majority ? 'tie'
                    : res.swept ? 'cackle'
                        : 'bust';

    if (s.rerolls > 0) {
        persist.saveLadder(database, db, discordId, {
            stake: run.stake,
            standing: run.standing || 0,
            level: run.level,
            again: run.again || 0,
            call: run.call,
            mult: Number(run.mult) || 0,
            spent: run.spent || [],
            set: engine.encodeSet(thrown.set),
            bag: engine.encodeBag(thrown.bag),
            hold: engine.encodeSet([...(run.hold || []), ...(thrown.wrecked || [])]),
            rungs: Number(run.rungs) || 0,
            sealed: run.sealed || null,
            faces: res.faceIds,
            cubeIds: (res.cubeIds || []).map(id => id || 0),
            roll: res.cubes,
            reason,
            saw: !!run.saw, armed: armsOf(run.armed),
            bet: run.bet || null,
            betUsed: !!run.betUsed || !!run.bet,
            dead: true,
        });
    } else {
        persist.clearLadder(database, db, discordId);
    }

    pstate.recordLost(s, patch, run.stake);

    return {
        outcome: 'bust',
        reason,
        lostStake: run.stake,
        lostStanding: run.standing || 0,
        ladder: null,
        ended: res.ended || null,
        opening: !(Number(run.rungs) || 0),
    };
};

const settleWin = function (ctx, { run, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag = [] }) {
    const { s, db, database, discordId } = ctx;

    const banks = pstate.rungClears(run.level, run.again);
    const clear = banks ? pstate.awardClear(s, patch) : null;

    const extra = [];
    for (let n = Number(res.shortcuts) || 0; n > 0 && s.unlocked < MAX_LEVEL; n--) {
        const banked = pstate.awardClear(s, patch);
        if (!banked) break;
        extra.push(banked);
    }

    const awards = [clear, ...extra].filter(Boolean);
    const opened = awards.reduce((at, a) => (a.unlocked ?? at), null);
    const filled = opened != null || awards.some(a => a.prestige);

    const rescued = !!breaker && !bribed;

    const hold = [...(res.hold || [])];

    const survivors = [...res.set];
    if (rescued) survivors.push(engine.plainSlot());

    const live = {
        stake: run.stake, level: run.level, again: run.again || 0,
        call: run.call, standing, roll: cubes,
        mult, faces: res.faceIds, spent: stillSpent,
        set: engine.encodeSet(survivors), bag: engine.encodeBag(bag),
        sealed: res.sealed || null,
        hold: engine.encodeSet(hold),
        held: res.held || 0,
        rungs: (Number(run.rungs) || 0) + 1,
        saw: false, armed: {},
        bet: null,
        betUsed: false,
        book: s.sidebet ? engine.drawBook({ set: survivors, bag, hold }) : [],
    };
    persist.saveLadder(database, db, discordId, live);
    return {
        outcome: 'live',
        profit: standing - run.stake,
        opened,
        clear,
        extra,
        filled,
        prestigeOffered: awards.some(a => a.prestige),
        seeded: rescued,
        held: res.held || 0,
        sealed: res.sealed || null,
        atTop: run.level >= MAX_LEVEL,
        next: {
            ...pstate.nextRung(s, run.level),
            multiple: engine.nextMultiple(pstate.nextRung(s, run.level).kind, mult),
        },
        ladder: live,
    };
};

exports.startRun = function (ctx, { call }) {
    const { s, db, database, profile, discordId, moveTruguts } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'You already have a run going.');

    const side = call === 'red' ? 'red' : 'blue';
    const stake = s.stake;
    const balance = balanceOf(profile);
    if (stake > balance) {
        return refuse('insufficient', `That stake is ${stake} but you only have ${balance}.`,
            { stake, balance });
    }

    persist.clearLadder(database, db, discordId);
    moveTruguts({ transaction: 'w', amount: stake });

    return {
        ok: true,
        staked: stake,
        run: {
            stake, standing: 0, level: 0, again: 0, call: side, mult: 0, spent: [], set: [],
            bag: engine.fillBag(s.equipped),
            hold: [], rungs: 0, sealed: null,
            saw: false, armed: {},
        },
    };
};

exports.pushRun = function (ctx, { call }) {
    const { s, db, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const ladder = persist.ladderOf(db, discordId);
    if (!ladder || !ladder.standing) return refuse('no_run', 'There is no run to push.');
    const shown = persist.shownOf(db, discordId);
    if (shown && shown.called) {
        return refuse('roll_live', 'The cubes are down and called. Finish the roll.');
    }
    const side = call == null ? null : (call === 'red' ? 'red' : 'blue');
    if (side && ladder.sealed && side === ladder.sealed) {
        return refuse('sealed', `The vault sealed ${side}. Call the other way.`, { sealed: side });
    }
    const next = pstate.nextRung(s, ladder.level);
    return {
        ok: true,
        staked: 0,
        run: {
            stake: ladder.stake,
            standing: ladder.standing,
            level: next.level,
            again: next.kind !== 'level' ? (Number(ladder.again) || 0) + 1 : 0,
            call: side,
            mult: Number(ladder.mult) || 0,
            spent: Object.values(ladder.spent || {}),
            set: engine.decodeSet(ladder.set), bag: engine.decodeBag(ladder.bag),
            hold: engine.decodeSet(ladder.hold),
            rungs: Number(ladder.rungs) || 0,
            sealed: ladder.sealed || null,
            saw: !!ladder.saw, armed: armsOf(ladder.armed),
            bet: ladder.bet || null,
            betUsed: !!ladder.betUsed,
        },
    };
};

exports.spendReroll = function (ctx) {
    const { s, db, database, profile, profileRef, discordId } = ctx;
    const dead = persist.deadOf(db, discordId);
    if (!dead) return refuse('no_reroll', 'There is nothing to reroll.');
    if (s.rerolls < 1) return refuse('no_stock', 'You have no rerolls banked.');

    persist.clearLadder(database, db, discordId);
    const patch = {};
    pstate.addReroll(s, patch, -1);
    persist.writeCube(profileRef, profile, patch);

    return {
        ok: true,
        staked: 0,
        reverse: dead.stake,
        run: {
            stake: dead.stake, standing: dead.standing, level: dead.level, call: dead.call,
            again: Number(dead.again) || 0,
            mult: Number(dead.mult) || 0, spent: Object.values(dead.spent || {}),
            set: engine.decodeSet(dead.set), bag: engine.decodeBag(dead.bag),
            hold: engine.decodeSet(dead.hold),
            rungs: Number(dead.rungs) || 0,
            sealed: dead.sealed || null,
            saw: !!dead.saw, armed: armsOf(dead.armed),
            bet: dead.bet || null,
            betUsed: !!dead.betUsed || !!dead.bet,
            regrow: false,
        },
    };
};

exports.premonition = function (ctx) {
    const { s, db, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const live = persist.ladderOf(db, discordId);
    if (!live || !live.standing) return refuse('no_run', 'There is no run to look at.');
    if (!s.premonition) return refuse('not_owned', "You haven't taken Premonition off the rack.");
    if (persist.shownOf(db, discordId)) {
        return refuse('already_shown', 'The cubes are already down — call a side to play them.');
    }
    if (live.saw) return refuse('spent', 'You have already looked at this rung.');
    const charged = chargeLadder(live, engine.lookPriceOf(live.mult));
    if (!charged.ok) return charged;
    persist.saveLadder(ctx.database, db, discordId, charged.live);

    const opened = exports.pushRun(ctx, { call: null });
    if (!opened.ok) return opened;
    const run = opened.run;
    const kind = engine.rungKind(run.level, run.again);
    const drawn = kind !== 'level'
        ? { set: run.set || [], bag: run.bag || [] }
        : engine.drawCubes(run.set || [], run.bag || [], run.level);

    if ((drawn.set || []).length < 2) {
        persist.saveLadder(ctx.database, db, discordId, live);
        return refuse('too_few', 'There is nothing to foresee on a single cube.');
    }

    const line = engine.throwSet(drawn.set);
    const at = crypto.randomInt(0, line.length);

    if (s.sidebet && !charged.live.bet) {
        persist.saveLadder(ctx.database, db, discordId, {
            ...charged.live,
            book: engine.drawBook(
                { set: drawn.set, bag: drawn.bag, hold: run.hold },
                line[at].face?.kind,
            ),
        });
    }

    const shown = parkThrow(ctx, { ...run, saw: true }, {
        line, bag: drawn.bag, kind, seen: at,
    });
    if (!shown) return refuse('no_run', 'There is no run to look at.');
    return {
        ok: true,
        at,
        face: engine.rolledFaces(line)[at],
        cubes: line.length,
        level: run.level,
    };
};

const splittable = function (s, run, line) {
    if (!s.split || !isArmed(run.armed, 'split')) return [];
    return (line || []).map((c, i) => (engine.canSplitAt(line, i) ? i : -1)).filter(i => i >= 0);
};

// What can still be done to a line that is down. Three places answer this — the hold, the board and
// an alteration's own reply — and the client reads all three, so three spellings of it are three
// chances for the buttons to disagree with each other. Swap and Scrap need a second cube; Split
// answers with the positions, which is its own emptiness test.
const offers = function (s, armed, line) {
    const pair = (line || []).length > 1;
    return {
        swap: pair && !!s.shuffle && isArmed(armed, 'swap'),
        scrap: pair && !!s.scrap && isArmed(armed, 'scrap'),
        split: splittable(s, { armed }, line),
    };
};

exports.alterShown = function (ctx, { a, b, scrap, split } = {}) {
    const { s, db, discordId } = ctx;
    const live = persist.ladderOf(db, discordId);
    const shown = persist.shownOf(db, discordId);
    if (!live || !shown) return refuse('nothing_shown', 'There is no roll waiting.');
    if (!shown.called) return refuse('no_call', 'Call a side first.');

    const took = takeThrow(live, shown, shown.called);
    const n = took.line.length;
    const swapping = Number.isInteger(a) && Number.isInteger(b) && a !== b;
    const scrapping = Number.isInteger(scrap);
    const splitting = Number.isInteger(split);
    if ([swapping, scrapping, splitting].filter(Boolean).length !== 1) {
        return refuse('one_thing', 'One change at a time.');
    }

    let seen = shown.seen == null ? null : Number(shown.seen);
    const wrecked = [...took.wrecked];
    let armed = took.run.armed;
    if (swapping) {
        if (!s.shuffle) return refuse('not_owned', "You haven't taken Swap off the rack.");
        if (!isArmed(armed, 'swap')) return refuse('not_armed', 'Swap is not armed for this rung.');
        if (a < 0 || b < 0 || a >= n || b >= n) return refuse('bad_swap', 'Those are not both on the line.');
        [took.line[a], took.line[b]] = [took.line[b], took.line[a]];
        if (seen === a) seen = b; else if (seen === b) seen = a;
        armed = disarm(armed, 'swap');
    }
    if (scrapping) {
        if (!s.scrap) return refuse('not_owned', "You haven't taken Scrap off the rack.");
        if (!isArmed(armed, 'scrap')) return refuse('not_armed', 'Scrap is not armed for this rung.');
        if (scrap < 0 || scrap >= n) return refuse('bad_scrap', 'That is not on the line.');
        if (n < 2) return refuse('too_few', 'That is the only cube on the line.');
        const [gone] = took.line.splice(scrap, 1);
        if (gone?.slot) wrecked.push(gone.slot);
        if (seen === scrap) seen = null; else if (seen != null && seen > scrap) seen -= 1;
        armed = disarm(armed, 'scrap');
    }
    if (splitting) {
        if (!s.split) return refuse('not_owned', "You haven't taken Split off the rack.");
        if (!isArmed(armed, 'split')) return refuse('not_armed', 'Split is not armed for this rung.');
        if (split < 0 || split >= n) return refuse('bad_split', 'That is not on the line.');
        const parts = engine.splitAt(took.line, split);
        if (!parts) {
            return took.line[split].frozen
                ? refuse('too_cold', 'That cube is frozen shut.')
                : refuse('not_a_weld', 'That is not a welded cube.');
        }
        if (n + parts.length - 1 > config.maxCubes) return refuse('too_many', 'The table is full.');
        took.line.splice(split, 1, ...parts);
        if (seen === split) seen = null;
        else if (seen != null && seen > split) seen += parts.length - 1;
        armed = disarm(armed, 'split');
    }

    const run = { ...took.run, armed };
    const back = parkThrow(ctx, run, {
        line: took.line, bag: took.bag, kind: took.kind, seen, changed: true, wrecked,
    });
    if (!back) return refuse('no_run', 'There is no run to hold.');
    return {
        ok: true,
        held: true,
        faces: engine.rolledFaces(took.line),
        state: engine.lineState(took.line),
        call: shown.called,
        can: offers(s, armed, took.line),
    };
};

exports.finishShown = function (ctx) {
    const { db, discordId } = ctx;
    const live = persist.ladderOf(db, discordId);
    const shown = persist.shownOf(db, discordId);
    if (!live || !shown) return refuse('nothing_shown', 'There is no roll waiting.');
    if (!shown.called) return refuse('no_call', 'Call a side first.');
    const took = takeThrow(live, shown, shown.called);
    return {
        ok: true,
        run: took.run,
        thrown: {
            line: took.line, set: took.set, bag: took.bag, kind: took.kind, wrecked: took.wrecked,
        },
    };
};

exports.heldRoll = function (ctx) {
    const { s, db, discordId } = ctx;
    const live = persist.ladderOf(db, discordId);
    const shown = persist.shownOf(db, discordId);
    if (!live || !shown || !shown.called) return null;
    const took = takeThrow(live, shown, shown.called);
    return {
        held: true,
        faces: engine.rolledFaces(took.line),
        state: engine.lineState(took.line),
        call: shown.called,
        can: offers(s, live.armed, took.line),
    };
};

exports.arm = function (ctx, { pick } = {}) {
    const { s, db, database, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    if (!ARMS.includes(pick)) return refuse('bad_pick', 'That is not something you can arm.');
    if (!s[PERK_FOR[pick]]) return refuse('not_owned', "You haven't taken that off the rack.");

    const live = persist.ladderOf(db, discordId);
    if (!live || !live.standing) return refuse('no_run', 'There is no rung to arm for.');
    const shown = persist.shownOf(db, discordId);
    if (shown && shown.called) return refuse('roll_live', 'The cubes are down and called.');
    if (isArmed(live.armed, pick)) return refuse('already_armed', 'That is already armed for this rung.');

    const charged = chargeLadder(live, engine.armPriceOf(live.mult, pick));
    if (!charged.ok) return charged;
    const armed = { ...armsOf(live.armed), [pick]: true };
    persist.saveLadder(database, db, discordId, { ...charged.live, armed });

    return {
        ok: true,
        pick,
        paid: charged.price,
        armed,
        standing: charged.live.standing,
        mult: charged.live.mult,
        price: engine.armPriceOf(charged.live.mult, pick),
    };
};

exports.holdRoll = function (ctx, run, parked) {
    const { s, db, discordId } = ctx;
    if (!s.shuffle && !s.scrap && !s.split) {
        return refuse('not_owned', 'You have nothing to change a line with.');
    }
    const live = persist.ladderOf(db, discordId);
    if (!live) return refuse('no_run', 'There is no run to hold.');
    const canSwap = !!s.shuffle && isArmed(live.armed, 'swap');
    const canScrap = !!s.scrap && isArmed(live.armed, 'scrap');
    const canSplit = !!s.split && isArmed(live.armed, 'split');
    if (!canSwap && !canScrap && !canSplit) {
        return refuse('unarmed', 'You armed nothing for this rung.');
    }

    const kind = engine.rungKind(run.level, run.again);
    const held = parked || (() => {
        const drawn = kind !== 'level'
            ? { set: run.set || [], bag: run.bag || [] }
            : engine.drawCubes(run.set || [], run.bag || [], run.level);
        return { line: engine.throwSet(drawn.set), bag: drawn.bag };
    })();
    if (held.line.length < 2 && !(canSplit && engine.canSplitAt(held.line, 0))) {
        return refuse('too_few', 'There is nothing to change on a single cube.');
    }

    const shown = parkThrow(ctx, run, {
        line: held.line, bag: held.bag, kind, wrecked: held.wrecked || [],
    });
    if (!shown) return refuse('no_run', 'There is no run to hold.');
    return {
        ok: true,
        held: true,
        faces: engine.rolledFaces(held.line),
        state: engine.lineState(held.line),
        call: run.call,
        can: offers(s, live.armed, held.line),
    };
};

exports.placeBet = function (ctx, { id }) {
    const { s, db, database, discordId } = ctx;
    if (!s.sidebet) return refuse('not_owned', "You haven't taken the Side Bet off the rack.");
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const live = persist.ladderOf(db, discordId);
    if (!live || !live.standing) return refuse('no_run', 'There is no rung to bet on.');
    const parked = persist.shownOf(db, discordId);
    if (parked && parked.called) return refuse('already_shown', 'The cubes are already down.');

    const standing = live.bet || null;
    const want = id || null;
    if (want === standing) return { ok: true, bet: standing, paid: 0, standing: live.standing };

    if (standing && parked) {
        return refuse('already_shown', 'The cubes are down — this card rides on the line.');
    }

    const wide = parked
        ? Object.values(parked.faces || {}).length
        : engine.nominalCubes(pstate.nextRung(s, live.level).level);
    if (want && !(wide > 1)) {
        return refuse('too_few', 'There is nothing to bet on a single cube.');
    }
    const book = Object.values(live.book || {});
    if (want && !book.includes(want)) return refuse('bad_bet', 'That is not chalked up.');

    const ante = engine.betPriceOf();
    let node = { ...live, bet: want };
    let paid = 0;
    if (!standing && want) {
        const charged = chargeLadder(live, ante);
        if (!charged.ok) return charged;
        node = { ...charged.live, bet: want };
        paid = charged.price;
    } else if (standing && !want) {
        const back = (Number(live.mult) || 0) + ante;
        node = { ...live, bet: null, mult: back, standing: engine.bankPayout(live.stake, back) };
        paid = -ante;
    }
    persist.saveLadder(database, db, discordId, node);
    return { ok: true, bet: want, paid, standing: node.standing, mult: node.mult };
};

exports.bank = function (ctx) {
    const { s, db, database, profile, profileRef, discordId, moveTruguts } = ctx;
    const ladder = persist.ladderOf(db, discordId);
    if (!ladder || !ladder.standing) return refuse('no_run', 'There is nothing to bank.');
    const shown = persist.shownOf(db, discordId);
    if (shown && shown.called) {
        return refuse('roll_live', 'The cubes are down and called. Finish the roll.');
    }
    moveTruguts({ transaction: 'd', amount: ladder.standing });
    persist.clearLadder(database, db, discordId);

    const patch = {};
    pstate.recordWon(s, patch, ladder.standing - ladder.stake);
    persist.writeCube(profileRef, profile, patch);

    return {
        ok: true,
        outcome: 'bank',
        standing: ladder.standing,
        profit: ladder.standing - ladder.stake,
        level: ladder.level,
        atTop: ladder.level >= MAX_LEVEL,
        balance: balanceOf(profile),
    };
};

exports.buyReroll = function (ctx) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (!s.buyReroll) return refuse('locked', 'You cannot buy rerolls yet.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');
    const cost = s.rerollCost;
    const paid = chargeTruguts(ctx, cost);
    if (!paid.ok) return paid;
    const patch = {};
    pstate.addReroll(s, patch, 1);
    pstate.recordSpent(s, patch, cost);
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, rerolls: s.rerolls, spent: cost, nextCost: s.rerollCost, balance: balanceOf(profile) };
};

exports.buySkin = function (ctx, { id }) {
    const { s, profile, profileRef } = ctx;
    const set = pstate.skinSetById(id);
    if (!set) return refuse('no_such_set', 'Nothing on the shelf goes by that.');
    if (set.ids.every(v => s.skins.includes(v))) return refuse('owned', 'That one is already yours.');
    const gate = pstate.skinGate(s, set.gate);
    if (!gate.open) return refuse('locked', gate.need || 'That is not for sale yet.');
    const cost = Math.round(set.price);
    const paid = chargeTruguts(ctx, cost);
    if (!paid.ok) return paid;
    const patch = {};
    pstate.grantSkins(s, patch, set.ids);
    pstate.recordSpent(s, patch, cost);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        set: set.id,
        ids: set.ids,
        skins: s.skins,
        spent: cost,
        balance: balanceOf(profile),
    };
};

exports.equipSide = function (ctx, { side, id }) {
    const { s, profile, profileRef } = ctx;
    const patch = {};
    const out = pstate.equipSide(s, patch, side, id);
    if (!out.ok) {
        const say = {
            bad_side: 'A skin goes on blue or on red.',
            no_such_skin: 'Nothing in the catalogue goes by that.',
            not_owned: "That one isn't yours yet.",
            clash: 'The two sides cannot both wear the same colour.',
        };
        return refuse(out.code, say[out.code] || 'That cannot go on.');
    }
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, sides: s.sides };
};

const pressReady = function (ctx, id) {
    const { s, db, discordId } = ctx;
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'The press is closed while a run is live.');
    if (id !== undefined) {
        if (!s.cubes.includes(id)) return refuse('not_owned', "That isn't yours.");
        if (!pstate.pairKeyOf(id)) return refuse('not_a_weld', 'That is not a welded cube.');
    }
    return null;
};

const pressPicks = function (s, ids, { major, keep } = {}) {
    const at = id => (typeof id === 'string' ? ids.indexOf(id) : -1);
    const majorAt = at(major);
    const keepAt = keep ? at(keep.parent) : -1;
    return {
        major: majorAt >= 0 ? majorAt : null,
        keep: s.keeper && keepAt >= 0 && typeof keep.faceId === 'string'
            ? { parent: keepAt, faceId: keep.faceId }
            : null,
    };
};

exports.weldCubes = function (ctx, { ids, major = null, keep = null }) {
    const { s, profile, profileRef } = ctx;
    const stop = pressReady(ctx);
    if (stop) return stop;
    if (s.pressTier < 1) return refuse('no_press', "You haven't taken the press off Watto's rack.");
    if (s.points < 1) return refuse('no_points', 'You have no build tokens to spend. A prestige pays one.');
    // **The third cube is an option, not a quota.** `pressCubes` is the widest cut the rung can make
    // — the number of slots — and reading it as the required count made a two-cube press illegal for
    // anyone who had bought The Third Cube. The legal counts come off the split table the engine rolls
    // from, so nothing here can offer a shape `rollWeld` would then refuse.
    const counts = engine.weldCounts(s.pressTier).filter(n => n <= s.pressCubes);
    if (!Array.isArray(ids) || !counts.includes(ids.length)) {
        return refuse('bad_pair', `The press takes ${counts.join(' or ')} cubes.`);
    }
    if (new Set(ids).size !== ids.length) return refuse('bad_pair', 'A cube cannot be welded to itself.');
    if (!ids.every(id => s.cubes.includes(id))) return refuse('not_owned', "That isn't yours.");
    if (ids.some(id => pstate.pairKeyOf(id))) return refuse('already_welded', 'Break it apart first.');

    const id = engine.rollWeld(ids, { tier: s.pressTier, ...pressPicks(s, ids, { major, keep }) });
    if (!id) return refuse('cannot_weld', 'Those will not go in the press.');

    const patch = {};
    pstate.spendPoints(s, patch);
    pstate.weldCubes(s, patch, ids, id);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true, weld: id, from: ids, points: s.points, cubes: s.cubes, equipped: s.equipped,
    };
};

exports.rerollWeld = function (ctx, { id, paying = 'truguts', major = null, keep = null }) {
    const { s, profile, profileRef, moveTruguts } = ctx;
    const stop = pressReady(ctx, id);
    if (stop) return stop;
    const parents = engine.weldParents(id);
    if (!parents) return refuse('not_a_weld', 'That is not a welded cube.');

    const points = paying === 'points';
    const cost = points ? 0 : s.weldRerollCost;
    const balance = balanceOf(profile);
    if (points && s.points < 1) return refuse('no_points', 'You have no build tokens to spend. A prestige pays one.');
    if (!points && cost > balance) {
        return refuse('insufficient', `That costs ${cost} but you only have ${balance}.`, { cost, balance });
    }

    const seen = s.weldSeen[pstate.pairKeyOf(id)] || [];
    const next = engine.rollWeld(parents, {
        seen: [...seen, id], tier: s.pressTier, ...pressPicks(s, parents, { major, keep }),
    });
    if (!next) return refuse('cannot_weld', 'The press jammed.');

    const patch = {};
    if (points) pstate.spendPoints(s, patch);
    else {
        moveTruguts({ transaction: 'w', amount: cost });
        pstate.recordSpent(s, patch, cost);
    }
    pstate.recutWeld(s, patch, id, next);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        weld: next,
        was: id,
        paid: points ? 'points' : 'truguts',
        spent: cost,
        points: s.points,
        cubes: s.cubes,
        equipped: s.equipped,
        balance: balanceOf(profile),
    };
};

exports.unweld = function (ctx, { id }) {
    const { s, profile, profileRef } = ctx;
    const stop = pressReady(ctx, id);
    if (stop) return stop;

    const patch = {};
    const parents = pstate.unweldCube(s, patch, id);
    if (!parents) return refuse('not_a_weld', 'That is not a welded cube.');
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, was: id, cubes: s.cubes, equipped: s.equipped, parents };
};

exports.prestige = function (ctx) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (!pstate.canPrestige(s)) return refuse('not_eligible', 'You have not earned a prestige.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');

    const patch = {};
    const pressed = { ...s.pressed };
    pstate.applyPrestige(s, patch);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        prestige: s.prestige,
        maxStake: s.maxStake,
        points: s.points,
        pressed,
        cell: s.comb[s.comb.length - 1] || null,
        comb: s.comb,
    };
};

exports.pickEmblem = function (ctx, { id }) {
    const { s, profile, profileRef } = ctx;
    if (!s.pick) return refuse('no_pick', 'There is no emblem waiting to be chosen.');
    const patch = {};
    const out = pstate.pickEmblem(s, patch, id);
    if (!out.ok) {
        return refuse(out.code, 'That is not a cell of your comb.');
    }
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, emblem: s.emblem };
};

exports.spendPoint = function (ctx, { reward }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    const refund = {};
    const refunded = pstate.refundDeadHeavy(s, refund);
    if (refunded) persist.writeCube(profileRef, profile, refund);
    if (s.points < 1) return refuse('no_points', 'You have no build tokens to spend. A prestige pays one.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'The rack is locked while a run is live.');
    const offered = pstate.rewardChoices(s).some(c => c.value === reward);
    if (!offered) return refuse('bad_reward', 'That is not on the rack.');

    const patch = {};
    pstate.spendPoint(s, patch, reward);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        reward,
        points: s.points,
        cubes: s.cubes,
        equipped: s.equipped,
    };
};

exports.setStake = function (ctx, { stake }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');
    const wanted = Math.floor(Number(stake));
    if (!Number.isFinite(wanted)) return refuse('bad_stake', 'That is not a number.');
    if (wanted < config.minStake) {
        return refuse('too_small', `The minimum stake is ${config.minStake}.`, { min: config.minStake });
    }
    const clamped = Math.min(wanted, s.maxStake);
    const balance = balanceOf(profile);
    if (clamped > balance) {
        return refuse('insufficient', `That stake is ${clamped} but you only have ${balance}.`,
            { stake: clamped, balance });
    }
    persist.writeCube(profileRef, profile, { stake: clamped });
    s.stake = clamped;
    return { ok: true, stake: clamped, maxStake: s.maxStake, clamped: clamped !== wanted };
};

exports.setLoadout = function (ctx, { ids }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'The rack is locked while a run is live.');
    const want = Array.isArray(ids) ? ids : [];
    const slots = engine.bagSize();
    if (new Set(want).size > slots) {
        return refuse('too_many', `Watto's bag only holds ${slots} cubes.`, { slots });
    }
    const patch = {};
    const equipped = pstate.setLoadout(s, patch, want);
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, equipped, owned: s.cubes, slots };
};

exports.parkTie = function (ctx, thrown, { reverse = 0 } = {}) {
    const { database, db, discordId } = ctx;
    const { run, res, set, bag } = thrown;
    persist.saveLadder(database, db, discordId, {
        stake: run.stake, standing: run.standing, level: run.level, again: run.again || 0,
        call: run.call,
        mult: thrown.base, carry: run.mult || 0,
        mults: res.mults, spent: run.spent || [], roll: res.cubes, faces: res.faceIds,
        pays: (res.pays || []).filter(p => p.kind === 'mult'),
        shortcuts: res.shortcuts, rerolls: res.rerolls, broken: res.broken,
        set: engine.encodeSet(res.set), thrown: engine.encodeSet(set), bag: engine.encodeBag(bag),
        sealed: res.sealed || null,
        hold: engine.encodeSet(res.hold || []),
        recovered: res.recovered || [],
        held: res.held || 0,
        carryHold: engine.encodeSet(run.hold || []),
        wrecked: engine.encodeSet(thrown.wrecked || []),
        carryRungs: Number(run.rungs) || 0,
        carrySealed: run.sealed || null,
        saw: !!run.saw, armed: armsOf(run.armed),
        bet: run.bet || null,
        betUsed: !!run.betUsed || !!run.bet,
        betPaid: Number(thrown.betPaid) || 0,
        reverse, cost: thrown.cost, worth: thrown.worth, tie: true,
    });
};

const resumeTie = function (parked) {
    const run = {
        stake: Number(parked.stake) || 0,
        standing: Number(parked.standing) || 0,
        level: parked.level,
        again: Number(parked.again) || 0,
        call: parked.call,
        mult: Number(parked.carry) || 0,
        spent: Object.values(parked.spent || {}),
        set: engine.decodeSet(parked.thrown),
        bag: engine.decodeBag(parked.bag),
        hold: engine.decodeSet(parked.carryHold),
        rungs: Number(parked.carryRungs) || 0,
        sealed: parked.carrySealed || null,
        saw: !!parked.saw, armed: armsOf(parked.armed),
        bet: parked.bet || null,
        betUsed: !!parked.betUsed || !!parked.bet,
    };
    const res = {
        cubes: Object.values(parked.roll || {}),
        faceIds: Object.values(parked.faces || {}),
        majority: null,
        pure: false,
        swept: false,
        mult: 0,
        mults: Object.values(parked.mults || {}),
        pays: Object.values(parked.pays || {}),
        shortcuts: Number(parked.shortcuts ?? parked.shortcut) || 0,
        rerolls: Number(parked.rerolls) || 0,
        broken: Object.values(parked.broken || {}),
        ended: null,
        notes: [],
        steps: [],
        faceLog: [],
        specials: [],
        set: engine.decodeSet(parked.set),
        sealed: parked.sealed || null,
        hold: engine.decodeSet(parked.hold),
        recovered: Object.values(parked.recovered || {}),
        held: Number(parked.held) || 0,
    };
    const base = Number(parked.mult) || engine.openingMultiple(parked.level);
    return {
        run, res, base, opening: base,
        bet: parked.bet || null,
        betPaid: Number(parked.betPaid) || 0,
        kind: run.again ? 'again' : 'level',
        rolled: res.faceIds, set: run.set, bag: run.bag,
        wrecked: engine.decodeSet(parked.wrecked),
        tie: true, asking: false, breaker: null,
        cost: Number(parked.cost) || 0, worth: Number(parked.worth) || 0,
        reverse: Number(parked.reverse) || 0,
    };
};
exports.resumeTie = resumeTie;

exports.answerTie = function (ctx, { buying }) {
    const { s, db, discordId } = ctx;
    const parked = persist.tieOf(db, discordId);
    if (!parked) return refuse('no_tie', 'There is no tie waiting.');

    const thrown = resumeTie(parked);

    if (buying) {
        if (!s.bribe) return refuse('locked', 'You cannot buy a tie.');
        const worth = engine.bankPayout(thrown.run.stake,
            engine.applyMults(thrown.base, thrown.res.mults, thrown.run.call));
        const cost = pstate.bribeCostFor(worth, s.bribes, s.nudge);
        const paid = chargeTruguts(ctx, cost);
        if (!paid.ok) return paid;
        return { ok: true, bribed: cost, thrown, reverse: thrown.reverse };
    }

    return {
        ok: true,
        bribed: 0,
        thrown: { ...thrown, breaker: engine.rollTiebreak(thrown.run.call, s.nudge) },
        reverse: thrown.reverse,
    };
};

exports.resolveThrown = resolveThrown;
