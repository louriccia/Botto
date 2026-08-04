// What a player can *do* in Botto's Chance Cube: start a run, push, bank, answer a tie, spend a
// reroll, prestige. Everything that moves truguts is here, once.
//
// This is the layer that used to live inside the Discord handler, tangled up with message edits.
// Two clients now need it — the embed and the Activity — and a second implementation of a payout
// is the bug nobody finds until somebody's balance is wrong.
//
// **Outcomes are data, not prose.** A bust reports `reason: 'ratts'`, not Watto saying something
// about Ratts; a win reports `opened: 3`, not a sentence about Level 4. What that means in words is
// the client's business, exactly as it is for the engine's notes.
//
// ---------------------------------------------------------------------------
// The context
// ---------------------------------------------------------------------------
//
// Every function takes a `ctx` carrying the things this module refuses to import:
//
//   db, database    the Firebase mirror and handle
//   profile         the player's `users/<key>/random` object, live
//   profileRef      a ref to the same
//   discordId       the ladder key
//   s               `cubeState(profile)` — mutated in place, as the state layer expects
//   moveTruguts     ({ transaction, amount }) => void
//
// `moveTruguts` is injected rather than imported because the bot's implementation lives in a
// 3,700-line challenge module that drags in discord.js. It is also the reason this file cannot
// simply call `manageTruguts`: keeping it at arm's length is what lets the API and the embed share
// this code without sharing that dependency.

const engine = require('./engine.js');
const pstate = require('./state.js');
const persist = require('./persist.js');
const { LEVELS, SWEEP_SHARE, cube: config } = require('./tuning.js');

const MAX_LEVEL = LEVELS.length - 1;

// Balance is derived, never stored: two lifetime counters and the difference between them.
const balanceOf = p => (Number(p?.truguts_earned) || 0) - (Number(p?.truguts_spent) || 0);
exports.balanceOf = balanceOf;

// A refusal the caller can render however it likes. `code` is for the client to branch on; the
// message is a fallback for anything that just wants to print something.
const refuse = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

// ---------------------------------------------------------------------------
// Throwing a level
// ---------------------------------------------------------------------------

// Draws this level's cubes, throws the set and resolves the line. **Every random draw for the roll
// happens here**, before anything is rendered or awaited, so the outcome is fixed before a single
// frame goes out and a crash mid-animation cannot change what was rolled.
//
// A **reroll** arrives with `regrow: false` and the table exactly as it was thrown. It buys back
// the roll, not the draw: the same cubes are picked up and thrown again — new sides, new faces, new
// order — but nothing comes out of the bag. Drawing here would have quietly rerolled the *loadout*
// as well.
//
// Returns everything both the settlement and an animation need. Nothing here writes.
const throwLevel = function (ctx, run) {
    const { s } = ctx;
    const drawn = run.regrow === false
        ? { set: run.set || [], bag: run.bag || [] }
        : engine.drawCubes(run.set || [], run.bag || [], run.level);

    const line = engine.throwSet(drawn.set);
    // Snapshotted before resolution, which mutates the line — see the note on `resolveLine`.
    const rolled = engine.rolledFaces(line);
    const res = engine.resolveLine(line, run.call);

    // An even line has no majority in it, and only a destructive special face can leave one. Watto
    // breaks it with a cube of his own — unless the player owns the right to buy the tie instead.
    //
    // Ratts trumps a tie: the run is over whatever the cubes said, so there is nothing left to
    // break and nothing worth buying.
    const tie = !res.ended && !res.majority;

    // The multiple this roll is played for: whatever the run carried, stepped one rung up the
    // ladder, plus what this roll's greed added. Computed **once**, here, and carried — a resumed
    // tie arrives with it already stepped and must not be stepped twice.
    const base = engine.levelMultiple(run.level, run.mult, res.mult);
    // What the roll is worth with none of its paying faces counted. Every frame before the payout
    // walk is drawn at this, and the walk builds it up.
    const opening = engine.levelMultiple(run.level, run.mult, 0);

    // What the tie is worth if it goes the player's way, and what Watto wants for it. The
    // multipliers still waiting on a winner count, because either answer produces one.
    const worth = tie ? engine.bankPayout(run.stake, engine.applyMults(base, res.mults, run.call)) : 0;
    const cost = tie && s.bribe ? pstate.bribeCostFor(worth, s.bribes) : 0;
    // He only asks while the answer is worth weighing. Once his price is past what the tie pays
    // there is nothing to think about, so he stops asking and just rolls.
    const asking = tie && s.bribe && cost < worth;
    // His cube, drawn here with every other draw. A tie he is *asking* about draws its own when the
    // answer arrives — there is nothing to fix until then.
    const breaker = tie && !asking ? engine.rollTiebreak(run.call, s.nudge) : null;

    return {
        run, res, rolled, set: drawn.set, bag: drawn.bag, line,
        level: LEVELS[run.level],
        tie, asking, breaker, base, opening, worth, cost,
    };
};
exports.throwLevel = throwLevel;

// ---------------------------------------------------------------------------
// Settling one throw
// ---------------------------------------------------------------------------

// Everything a resolved throw does to the world: the lifetime tallies, the pot, the clears, the
// ladder, and the truguts. Call it exactly once per throw.
//
// `bribed` is what the player paid to buy the tie, `reverse` the stake of a bust a reroll is
// undoing. Both are zero on an ordinary roll.
const settleThrow = async function (ctx, { thrown, bribed = 0, reverse = 0 }) {
    const { s, db, database, profile, profileRef, discordId, moveTruguts } = ctx;
    const { run, res, level, breaker, bag } = thrown;

    // Whoever ended up with the roll: the line's own majority, Watto's cube on top of it, or a call
    // bought outright.
    const majority = res.majority || breaker || (bribed ? run.call : null);
    const cubes = res.cubes;
    // Ratts ends a run outright, so the majority stops mattering the moment he lands.
    const won = !res.ended && !!majority && majority === run.call;
    const pure = won && res.pure;
    const spent = run.spent || [];
    // Wipeouts take a cube off the table for the rest of the climb.
    const stillSpent = res.broken.length ? [...new Set([...spent, ...res.broken])] : spent;
    // Greed and Multiplier cubes ride the standing for the rest of the run. The multipliers only
    // cash in here, because only here is there a winning side to check them against.
    const mult = engine.applyMults(thrown.base, res.mults, majority);
    const standing = won ? engine.bankPayout(run.stake, mult) : 0;

    // Read **before** anything settles: `recordRoll` is about to move both of these, and a roll
    // that set a new record would otherwise never be able to say so.
    const brokeCubes = res.faceIds.length > s.bestCubes;
    const brokeMultiple = mult > s.bestMultiple;

    // One profile write for the whole throw.
    const patch = {};
    const records = pstate.recordRoll(s, patch, {
        call: run.call, won, cubes, level: run.level, standing,
        // Positions left standing after the effects — not the cubes that counted toward the
        // majority. A Mirror that conjured four and a Padmé that slipped in two both count.
        line: res.faceIds.length,
        // What the roll ended up worth per trugut staked, counted win or lose.
        multiple: mult,
    });
    // Kept out of `recordRoll` because it counts faces rather than cubes — and because a resumed
    // tie must not tally the same throw twice, which is why the reconstructed `res` carries no log.
    pstate.recordFaces(s, patch, res.faceLog);
    // A Reroll Cube banks its reroll whatever the roll did, so it is never a punishment for winning.
    if (res.rerolls) pstate.addReroll(s, patch, res.rerolls);

    // Undoing the bust a reroll was spent on. Only the pot and the ledger need reversing: the stake
    // left the balance when the run started, not on this roll.
    //
    // Each is undone in the currency it was done in — the pot only ever received `potCut(stake)`,
    // so that is all that comes back out, while the ledger recorded the whole stake and gives back
    // the whole stake. Both `potCut` calls floor the same number, so the jar lands where it started.
    if (reverse) {
        persist.addToPot(database, db, -persist.potCut(reverse));
        pstate.unrecordLost(s, patch, reverse);
    }
    // A bought tie is a price paid, like a bought reroll — and it makes the next one dearer. Not on
    // the loss ledger: half the time it is the price of a win.
    if (bribed) {
        pstate.recordSpent(s, patch, bribed);
        pstate.addBribe(s, patch);
    }

    const outcome = won
        ? await settleWin(ctx, { run, level, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag })
        : settleLoss(ctx, { run, res, thrown, patch });

    persist.writeCube(profileRef, profile, patch);

    return {
        ...outcome,
        majority, won, pure, mult, standing, cubes,
        // The cubes a wipeout destroyed, by id, so the client can name them — this is the one
        // special-cube effect worth saying out loud, because it changes what the *next* roll can do.
        shattered: res.broken,
        records: { ...records, cubes: brokeCubes, multiple: brokeMultiple },
        balance: balanceOf(profile),
        pot: persist.potOf(db),
    };
};
exports.settleThrow = settleThrow;

// A bust. A quarter of the stake feeds the pot and the rest leaves the economy.
const settleLoss = function (ctx, { run, res, thrown, patch }) {
    const { s, db, database, discordId } = ctx;
    persist.addToPot(database, db, persist.potCut(run.stake));
    pstate.recordLost(s, patch, run.stake);
    // Four ways to lose, reported as which one rather than as a sentence. A line with no majority
    // only reaches here once the tie-breaker has already gone the house's way; Ratts is checked
    // first because he ends the run whatever the cubes said.
    const reason = res.ended ? 'ratts'
        : !res.majority ? 'tie'
            : res.swept ? 'cackle'
                : 'bust';

    // A bust with a reroll banked stays on file, because that is what `spendReroll` replays. Kept in
    // the live run's own node and marked `dead`, which `ladderOf` refuses — so this *replaces* the
    // clear rather than following it, one write to one key instead of a `remove()` and a `set()`
    // racing on the same ref.
    //
    // `mult` is the multiple the run carried *into* the level, not the one this roll played for:
    // `throwLevel` steps it again on the way back. The cubes are stored as they were **thrown**, since
    // a reroll picks that table up again — `res.set` is post-effects and would shrink it.
    //
    // The embed writes its own richer node over this one, which is where `flavor` and `lines` come
    // from; `deadFrame` reads both as optional.
    if (s.rerolls > 0) {
        persist.saveLadder(database, db, discordId, {
            stake: run.stake,
            standing: run.standing || 0,
            level: run.level,
            call: run.call,
            mult: Number(run.mult) || 0,
            spent: run.spent || [],
            set: engine.encodeSet(thrown.set),
            bag: engine.encodeSet(thrown.bag),
            faces: res.faceIds,
            roll: res.cubes,
            reason,
            dead: true,
        });
    } else {
        persist.clearLadder(database, db, discordId);
    }

    return {
        outcome: 'bust',
        reason,
        lostStake: run.stake,
        lostStanding: run.standing || 0,
        ladder: null,
        ended: res.ended || null,
    };
};

// A win. Either the run carries on, or it hits a ceiling with nothing unlocked to push into and
// banks itself.
const settleWin = async function (ctx, { run, level, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag = [] }) {
    const { s, db, database, profile, profileRef, discordId, moveTruguts } = ctx;

    // A Shortcut Cube is a clear toward *the next locked level*, so once the ladder is fully open
    // it has nothing to pay. Without this, a shortcut on a Level 1 roll would hand over the
    // prestige gate — meant to cost a run at the top of the ladder, not a one-cube wager.
    const shortcut = res.shortcut && s.unlocked < MAX_LEVEL;
    let prize = 0;

    if (pure) {
        prize = await persist.payFromPot(database, db, SWEEP_SHARE[level.cubes] || 0);
        if (prize > 0) {
            moveTruguts({ transaction: 'd', amount: prize });
            pstate.recordWon(s, patch, prize);
        }
    }

    const topped = run.level >= pstate.topOf(s);

    // Award the clear **before** deciding whether the run ends, because a clear that opens the next
    // level changes that answer. The ceiling only banks itself because there is nothing unlocked to
    // push into — and if this very roll unlocked something, that stopped being true. Deciding first
    // and unlocking second handed the player a key and shut the door in the same breath.
    let clear = null;
    let extra = null;
    if (topped) {
        clear = pstate.awardClear(s, patch);
        // A Shortcut Cube is a second clear on top of the one surviving the ceiling already earned,
        // so it can be the one that opens the level.
        extra = shortcut ? pstate.awardClear(s, patch) : null;
    } else if (shortcut) {
        // A Shortcut Cube pays its clear wherever it lands, which is the only way progress is ever
        // made below your ceiling. The run carries on regardless.
        pstate.awardClear(s, patch);
    }
    const opened = extra?.unlocked ?? clear?.unlocked ?? null;
    // The wall moved. Stay live and let them carry the standing into the new level.
    const reopened = topped && opened != null && run.level < pstate.topOf(s);
    const ends = topped && !reopened;

    if (ends) {
        moveTruguts({ transaction: 'd', amount: standing });
        persist.clearLadder(database, db, discordId);
        pstate.recordWon(s, patch, standing - run.stake);
        return {
            outcome: 'bank',
            profit: standing - run.stake,
            prize,
            pureTier: pure ? (SWEEP_SHARE[level.cubes] || 0) : 0,
            opened,
            clear,
            extra,
            // The meter just filled — the frame that fills one shows it completed rather than the
            // next level's empty counter.
            filled: !!(clear || extra) && (opened != null || clear?.prestige || extra?.prestige),
            prestigeOffered: !!(clear?.prestige || extra?.prestige),
            atTop: run.level >= MAX_LEVEL,
            ladder: null,
        };
    }

    // Still standing — either below the ceiling, or because the clear just moved it.
    const live = {
        stake: run.stake, level: run.level, call: run.call, standing, roll: cubes,
        mult, faces: res.faceIds, spent: stillSpent,
        // The table the next level builds on, and what is left in the bag to build it with.
        // Everything this roll destroyed, broke or wrote over is already baked into the set.
        set: engine.encodeSet(res.set), bag: engine.encodeSet(bag),
    };
    persist.saveLadder(database, db, discordId, live);
    return {
        outcome: 'live',
        profit: standing - run.stake,
        prize,
        pureTier: pure ? (SWEEP_SHARE[level.cubes] || 0) : 0,
        opened,
        clear,
        extra,
        reopened,
        filled: reopened,
        ladder: live,
    };
};

// ---------------------------------------------------------------------------
// Starting, pushing, rerolling
// ---------------------------------------------------------------------------

// Stake and call, from the idle board. The stake leaves the balance here and the ladder carries it
// — a push never pays again.
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

    // Calling with a reroll offer still on screen is the same answer as Play again.
    persist.clearLadder(database, db, discordId);
    moveTruguts({ transaction: 'w', amount: stake });

    // A new run starts with an empty table and a freshly shuffled bag. Level 1 puts the first cube
    // down without touching it.
    return {
        ok: true,
        staked: stake,
        run: {
            stake, standing: 0, level: 0, call: side, mult: 0, spent: [], set: [],
            bag: engine.fillBag(s.equipped),
        },
    };
};

// Push into the next level. Spends nothing new — the ladder already holds the stake — and the
// multiple rides along, so a Greed caught early pays on every level above it.
exports.pushRun = function (ctx, { call }) {
    const { s, db, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const ladder = persist.ladderOf(db, discordId);
    if (!ladder || !ladder.standing) return refuse('no_run', 'There is no run to push.');
    if (ladder.level >= pstate.topOf(s)) {
        return refuse('at_ceiling', 'That is as deep as the ladder goes for now.');
    }
    const side = call === 'red' ? 'red' : 'blue';
    return {
        ok: true,
        staked: 0,
        run: {
            stake: ladder.stake, standing: ladder.standing, level: ladder.level + 1, call: side,
            mult: Number(ladder.mult) || 0,
            // Cubes a wipeout broke earlier in this climb stay off the table.
            spent: Object.values(ladder.spent || {}),
            // A run stored before either of these existed carries neither, and starts fresh.
            set: engine.decodeSet(ladder.set), bag: engine.decodeSet(ladder.bag),
        },
    };
};

// Buys back the roll that just killed the run: same level, same call, same stake. The bust was
// already settled, so `settleThrow` reverses the two numbers it moved.
//
// The tallies from the void roll are deliberately *not* reversed. It was rolled, it was called, and
// it broke the streak — a reroll is a second call rather than a rewrite.
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
            mult: Number(dead.mult) || 0, spent: Object.values(dead.spent || {}),
            set: engine.decodeSet(dead.set), bag: engine.decodeSet(dead.bag),
            // What makes this a reroll rather than a re-draw: nothing comes out of the bag.
            regrow: false,
        },
    };
};

// ---------------------------------------------------------------------------
// Banking
// ---------------------------------------------------------------------------

// Cashing out short of your ceiling. **Not a clear** — the gate is surviving your top level, which
// banks itself. The profit still goes on the lifetime ledger.
exports.bank = function (ctx) {
    const { s, db, database, profile, profileRef, discordId, moveTruguts } = ctx;
    const ladder = persist.ladderOf(db, discordId);
    if (!ladder || !ladder.standing) return refuse('no_run', 'There is nothing to bank.');

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

// ---------------------------------------------------------------------------
// The shop and the rack
// ---------------------------------------------------------------------------

exports.buyReroll = function (ctx) {
    const { s, db, profile, profileRef, discordId, moveTruguts } = ctx;
    if (!s.buyReroll) return refuse('locked', 'You cannot buy rerolls yet.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');
    const cost = s.rerollCost;
    const balance = balanceOf(profile);
    if (cost > balance) {
        return refuse('insufficient', `That costs ${cost} but you only have ${balance}.`, { cost, balance });
    }
    moveTruguts({ transaction: 'w', amount: cost });
    const patch = {};
    pstate.addReroll(s, patch, 1);
    pstate.recordSpent(s, patch, cost);
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, rerolls: s.rerolls, spent: cost, nextCost: s.rerollCost, balance: balanceOf(profile) };
};

// Hand the ladder back for a bigger ceiling and one thing off Watto's rack.
//
// Both the eligibility and the reward are re-checked here rather than trusted from whatever menu
// the request came off, so a stale screen can neither reset a ladder twice nor grant a cube twice.
exports.prestige = function (ctx, { reward }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (!pstate.canPrestige(s)) return refuse('not_eligible', 'You have not earned a prestige.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');
    const offered = pstate.rewardChoices(s).some(c => c.value === reward);
    if (!offered) return refuse('bad_reward', 'That is not on the rack.');

    const patch = {};
    pstate.applyPrestige(s, patch, reward);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        prestige: s.prestige,
        maxStake: s.maxStake,
        reward,
        cubes: s.cubes,
        equipped: s.equipped,
        slots: s.slots,
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
    persist.writeCube(profileRef, profile, { stake: clamped });
    s.stake = clamped;
    return { ok: true, stake: clamped, maxStake: s.maxStake, clamped: clamped !== wanted };
};

exports.setLoadout = function (ctx, { ids }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'The rack is locked while a run is live.');
    const patch = {};
    const equipped = pstate.setLoadout(s, patch, Array.isArray(ids) ? ids : []);
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, equipped, slots: s.slots, owned: s.cubes };
};

// ---------------------------------------------------------------------------
// Ties
// ---------------------------------------------------------------------------

// Parks a tie Watto is asking about. **Nothing has settled** — the whole roll goes onto the ladder
// node, which is exactly where settlement would have written, so a crash between the question and
// the answer leaves a tie that can still be picked up and finished.
exports.parkTie = function (ctx, thrown, { reverse = 0 } = {}) {
    const { database, db, discordId } = ctx;
    const { run, res, set, bag } = thrown;
    persist.saveLadder(database, db, discordId, {
        stake: run.stake, standing: run.standing, level: run.level, call: run.call,
        // Both multiples. `mult` is what this roll is playing for, already stepped up the ladder;
        // `carry` is what the run brought into the level. Answering the tie needs the first; a
        // reroll of a tie that busts needs the second, or the ladder gets stepped twice.
        mult: thrown.base, carry: run.mult || 0,
        mults: res.mults, spent: run.spent || [], roll: res.cubes, faces: res.faceIds,
        // Only the Multiplier faces. The greed this roll threw is already folded into `mult`, so
        // replaying it when the tie is answered would count it twice.
        pays: (res.pays || []).filter(p => p.kind === 'mult'),
        shortcut: res.shortcut, rerolls: res.rerolls, broken: res.broken,
        // Both halves of the table: what survived this throw to carry on with, and the cubes as
        // they were thrown, in case the tie resolves into a bust a reroll then buys back.
        set: engine.encodeSet(res.set), thrown: engine.encodeSet(set), bag: engine.encodeSet(bag),
        reverse, cost: thrown.cost, worth: thrown.worth, tie: true,
    });
};

// Rebuilds the throw a parked tie is waiting on.
//
// **It does not throw anything.** The cubes already landed; the only new information is which way
// the tie went. Re-rolling here would quietly hand the player a different roll from the one they
// were asked about — which is a bug the API had until both clients started sharing this.
//
// `faces` on nodes parked before the engine split holds Discord emoji rather than face ids. They
// draw as face-down cubes and everything else about the settlement is correct, which is the right
// way for a stale node to degrade.
const resumeTie = function (parked) {
    const run = {
        stake: Number(parked.stake) || 0,
        standing: Number(parked.standing) || 0,
        level: parked.level,
        call: parked.call,
        // What the run *entered* the level with, which is what a reroll of this level steps from.
        mult: Number(parked.carry) || 0,
        spent: Object.values(parked.spent || {}),
        set: engine.decodeSet(parked.thrown),
        bag: engine.decodeSet(parked.bag),
    };
    const res = {
        cubes: Object.values(parked.roll || {}),
        faceIds: Object.values(parked.faces || {}),
        majority: null,
        pure: false,
        swept: false,
        // Zero, not one: this is what the roll *adds*, and its greed is already baked into
        // `parked.mult`. A one here would hand out a free ×1 on every tie.
        mult: 0,
        mults: Object.values(parked.mults || {}),
        pays: Object.values(parked.pays || {}),
        shortcut: !!parked.shortcut,
        rerolls: Number(parked.rerolls) || 0,
        broken: Object.values(parked.broken || {}),
        ended: null,
        notes: [],
        steps: [],
        // A resumed tie must not tally the same throw twice, so it carries no face log.
        faceLog: [],
        specials: [],
        set: engine.decodeSet(parked.set),
    };
    // Taken as-is rather than recomputed: it was stepped up the ladder when the tie was parked and
    // would be stepped a second time here.
    const base = Number(parked.mult) || LEVELS[parked.level].payout;
    return {
        run, res, base, opening: base,
        level: LEVELS[parked.level],
        rolled: res.faceIds, set: run.set, bag: run.bag,
        tie: true, asking: false, breaker: null,
        cost: Number(parked.cost) || 0, worth: Number(parked.worth) || 0,
        reverse: Number(parked.reverse) || 0,
    };
};
exports.resumeTie = resumeTie;

// A parked tie owes exactly one answer: roll his cube, or buy the tie outright. Nothing about that
// roll was settled, so all of it happens now — exactly as it would have at the time.
//
// The price is worked out from the stored standing rather than taken from the request, so a screen
// left open across a prestige cannot buy a tie at yesterday's rate.
exports.answerTie = function (ctx, { buying }) {
    const { s, db, discordId, profile, moveTruguts } = ctx;
    const parked = persist.tieOf(db, discordId);
    if (!parked) return refuse('no_tie', 'There is no tie waiting.');

    const thrown = resumeTie(parked);

    if (buying) {
        if (!s.bribe) return refuse('locked', 'You cannot buy a tie.');
        const worth = engine.bankPayout(thrown.run.stake,
            engine.applyMults(thrown.base, thrown.res.mults, thrown.run.call));
        const cost = pstate.bribeCostFor(worth, s.bribes);
        const balance = balanceOf(profile);
        if (cost > balance) {
            return refuse('insufficient', `That costs ${cost} but you only have ${balance}.`, { cost, balance });
        }
        moveTruguts({ transaction: 'w', amount: cost });
        return { ok: true, bribed: cost, thrown, reverse: thrown.reverse };
    }

    // His cube is weighted against whatever you called; Qui-Gon's Nudge turns the weight around
    // rather than removing it, so a tie is always somebody's coin flip and never a fair one.
    return {
        ok: true,
        bribed: 0,
        thrown: { ...thrown, breaker: engine.rollTiebreak(thrown.run.call, s.nudge) },
        reverse: thrown.reverse,
    };
};

exports.MAX_LEVEL = MAX_LEVEL;
