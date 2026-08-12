// What a player can *do* in Botto's Chance Cube: start a run, push, bank, answer a tie, spend a
// reroll, prestige. Everything that moves truguts is here, once.
//
// This is the layer that used to live inside the Discord handler, tangled up with message edits.
// It was pulled out when a second client needed it, and it stayed out when that client became the
// only one: the Activity plays the game now and the embed draws none of it. A second
// implementation of a payout is the bug nobody finds until somebody's balance is wrong.
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
// simply call `manageTruguts`: keeping it at arm's length is what lets the API serve this code
// without dragging discord.js into a web request, and what lets the harnesses run it with no
// Firebase at all.

const engine = require('./engine.js');
const pstate = require('./state.js');
const persist = require('./persist.js');
const { LEVELS, cube: config } = require('./tuning.js');

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

// Draws this rung's cubes, throws the set and resolves the line. **Every random draw for the roll
// happens here**, before anything is rendered or awaited, so the outcome is fixed before a single
// frame goes out and a crash mid-animation cannot change what was rolled.
//
// Two kinds of rung arrive here and the difference is one line: a **level** puts two more cubes on
// the table out of the bag, an **Again** throws the table exactly as it stands. That is the whole
// mechanical difference between them — clears buy cubes, and the rungs in between buy nothing but
// the right to move on.
//
// A **reroll** arrives with `regrow: false` for a different reason and lands in the same branch. It
// buys back the roll, not the draw: the same cubes are picked up and thrown again — new sides, new
// faces, new order — but nothing comes out of the bag. Drawing here would have quietly rerolled the
// *loadout* as well.
//
// Returns everything both the settlement and an animation need. Nothing here writes.
const throwLevel = function (ctx, run) {
    const { s } = ctx;
    // Three kinds, not two: an Again past Level 5 has no level above it to double what it added, so
    // it pays `overtimeBonus` instead. Everything else treats the two the same.
    const kind = run.again
        ? (run.level >= MAX_LEVEL ? 'overtime' : 'again')
        : 'level';
    // `!== 'level'` rather than `=== 'again'`: overtime is an Again too, and testing for the one
    // name would have had a rung past Level 5 draw two cubes out of the bag.
    const drawn = (run.regrow === false || kind !== 'level')
        ? { set: run.set || [], bag: run.bag || [] }
        : engine.drawCubes(run.set || [], run.bag || [], run.level);

    const set = drawn.set;
    const line = engine.throwSet(set);
    // Snapshotted before resolution, which mutates the line — see the note on `resolveLine`. The ice
    // goes with it and has to: `iced()` clears the flag when an effect breaks against a frozen cube,
    // so by the payout the line no longer remembers which cubes were held when they landed. That is
    // the frame the frost belongs on.
    const rolled = engine.rolledFaces(line);
    const rolledState = engine.lineState(line);
    // The bag goes **in** as well as out, because a Pit Droid draws from it mid-roll. What comes back
    // is what the run carries on with; taking `drawn.bag` here instead would hand the same cube out
    // again next level.
    // The two things a roll needs that aren't on the table. `jail` is Oovo IV's prisoners, held by the
    // run rather than by the line; `rungs` is how many this run has walked including this one, which is
    // the only thing Mon Gazza's seam pays off.
    const res = engine.resolveLine(line, run.call, drawn.bag, {
        jail: run.jail || [],
        rungs: (Number(run.rungs) || 0) + 1,
    });

    // An even line has no majority in it, and only a destructive special face can leave one. Watto
    // breaks it with a cube of his own — unless the player owns the right to buy the tie instead.
    //
    // An empty table trumps a tie: there is nothing left to break and nothing worth buying. Read off
    // the line's length rather than off `res.ended`, because that is the whole of the rule — a mine is
    // only the usual way a line gets to zero positions, not an ending of its own. A line with faces on
    // it but nothing countable is still a tie, and still survivable.
    const tie = !!res.faceIds.length && !res.majority;

    // **Tatooine collects.** A tie on a line with a Boonta face standing on it is simply won — no
    // lean, no cube of Watto's, nothing to ask about. It short-circuits both branches below, so a
    // player holding Bribe Ties is never offered a price for something they have already won.
    //
    // It settles through `breaker` rather than through a channel of its own, which means a Boonta tie
    // also earns the plain cube a rolled tie earns. That is deliberate: the rescue exists to break a
    // table that can no longer decide a roll, and a table this die has chewed down is exactly that
    // table. What the rule refuses is a tie *bought*, and this one wasn't.
    const boonta = tie && !!res.boonta;

    // The multiple this roll is played for: whatever the run carried, worked on by this rung —
    // **doubled** by a level, **+1** by an Again — plus what this roll's greed added. Computed
    // **once**, here, and carried: a resumed tie arrives with it already stepped and must not be
    // stepped twice.
    const base = engine.rungMultiple(kind, run.mult, res.mult);
    // What the roll is worth with none of its paying faces counted. Every frame before the payout
    // walk is drawn at this, and the walk builds it up.
    const opening = engine.rungMultiple(kind, run.mult, 0);

    // What the tie is worth if it goes the player's way, and what Watto wants for it. The
    // multipliers still waiting on a winner count, because either answer produces one.
    const worth = tie ? engine.bankPayout(run.stake, engine.applyMults(base, res.mults, run.call)) : 0;
    const cost = tie && s.bribe && !boonta ? pstate.bribeCostFor(worth, s.bribes) : 0;
    // **He always asks.** Owning the pick is the whole gate: if the rack handed over the right to buy a
    // tie, every tie is one you get offered.
    //
    // He used to withdraw the offer once his price passed what the tie pays, on the grounds that there was
    // nothing left to weigh. There was. Losing a tie is a **bust** — the stake and the standing both go and
    // the run is over — while buying one keeps the climb alive to push again at double. So the price is not
    // being weighed against this level's payout, it is being weighed against the rest of the run, and that
    // is not a sum this file can do on the player's behalf. Withdrawing the offer did it for them, and it
    // did it wrong: at a deep level a tie well over the level's own payout can still be the cheapest thing
    // on the table.
    const asking = tie && s.bribe && !boonta;
    // His cube, drawn here with every other draw. A tie he is *asking* about draws its own when the
    // answer arrives — there is nothing to fix until then. A Boonta tie never reaches his cube at all.
    const breaker = boonta ? run.call
        : (tie && !asking ? engine.rollTiebreak(run.call, s.nudge) : null);

    return {
        run, res, rolled, rolledState, set, bag: res.bag || drawn.bag, line,
        level: LEVELS[run.level],
        // Tatooine took the tie. Carried so the client can say who did it — it is Watto's cube that
        // normally settles one, and a tie that resolves with no cube of his on screen needs a reason.
        boonta,
        // Which rung this is. The client draws an Again differently and the settlement decides
        // whether it banks a clear off it, so it travels with the throw rather than being
        // re-derived from `run.again` in three places.
        kind,
        tie, asking, breaker, base, opening, worth, cost,
    };
};
exports.throwLevel = throwLevel;

// ---------------------------------------------------------------------------
// Settling one throw
// ---------------------------------------------------------------------------

// Everything a resolved throw does to the world: the lifetime tallies, the clears, the ladder,
// and the truguts. Call it exactly once per throw.
//
// `bribed` is what the player paid to buy the tie, `reverse` the stake of a bust a reroll is
// undoing. Both are zero on an ordinary roll.
const settleThrow = async function (ctx, { thrown, bribed = 0, reverse = 0 }) {
    const { s, profile, profileRef } = ctx;
    const { run, res, breaker, bag } = thrown;

    // Whoever ended up with the roll: the line's own majority, Watto's cube on top of it, or a call
    // bought outright.
    const majority = res.majority || breaker || (bribed ? run.call : null);
    const cubes = res.cubes;
    // A table with nothing left on it wins nothing, whatever was called and whoever it was called
    // against. Belt and braces — an empty line has no majority to win with either, and no tie, so no
    // breaker and no bought call can reach here — but this is the sentence the rule is written in.
    const won = !!res.faceIds.length && !!majority && majority === run.call;
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
    // **Only off a roll that survived.** Nothing a line does pays if the run ends on it — the standing
    // goes, no clear is awarded, and the multiple was only ever a multiple of a standing — and a reroll
    // is not the exception it used to be. It banked whatever the roll did, which meant a Reroll Cube in
    // the line that busted handed back the means to undo that very bust: the cube that lost the run paid
    // for a second attempt at it.
    //
    // Load-bearing for `settleLoss` below, which reads `s.rerolls` to decide whether the bust is worth
    // keeping on file. Unbanked here, that is the stock the player *brought* to this roll, which is the
    // only stock that should be able to buy it back.
    if (won && res.rerolls) pstate.addReroll(s, patch, res.rerolls);

    // Undoing the bust a reroll was spent on. Only the ledger needs reversing: the stake left the
    // balance when the run started, not on this roll.
    //
    // This used to have a second half — the pot received `potCut(stake)` on the bust and gave the
    // same floored integer back here, the two calls kept in step so the jar landed exactly where it
    // started. With the pot gone the whole reversal is one line, and a busted stake is simply gone.
    if (reverse) pstate.unrecordLost(s, patch, reverse);
    // A bought tie is a price paid, like a bought reroll — and it makes the next one dearer. Not on
    // the loss ledger: half the time it is the price of a win.
    if (bribed) {
        pstate.recordSpent(s, patch, bribed);
        pstate.addBribe(s, patch);
    }
    // **Every settled tie is filed here, whichever way it went.** This is the one point all three
    // paths reach — his cube, a bribe, a Boonta — and it runs exactly once per throw, because a tie he
    // is *asking* about parks without settling and only reaches this on the answer.
    if (thrown.tie) {
        pstate.recordTie(s, patch, {
            bribed, breaker, boonta: thrown.boonta, call: run.call,
        });
    }

    const outcome = won
        ? settleWin(ctx, { run, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag })
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
    };
};
exports.settleThrow = settleThrow;

// A bust. The whole stake leaves the economy — there is nothing to route a share of it into any
// more, which is what makes the mode a clean sink rather than a faucet with a governor on it.
const settleLoss = function (ctx, { run, res, thrown, patch }) {
    const { s, db, database, discordId } = ctx;
    pstate.recordLost(s, patch, run.stake);
    // Five ways to lose, reported as which one rather than as a sentence. A line with no majority only
    // reaches here once the tie-breaker has already gone the house's way.
    //
    // The two empty-table endings are told apart rather than merged: a mine names itself, and anything
    // else that swept the line to nothing — a purge on a rack of pure specials is the only real way —
    // gets `empty`, because "Ratts stood up" is not true of a roll he was not on.
    const reason = res.ended ? 'ratts'
        : !res.faceIds.length ? 'empty'
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
    // The **bag** is stored as the roll left it, not as it found it, which matters only for a Pit
    // Droid: a cube it drew on the roll being bought back stays spent, so the replayed climb is one
    // cube short at the top. That is the deliberate side of the trade — restoring the bag instead
    // would let a *winning* resumed roll draw the same special twice, once off the table it is already
    // standing on and once out of the bag again. A reroll doesn't un-spend the tallies either.
    //
    // `flavor` and `lines` are optional on this node and always have been: the embed used to write a
    // richer one over it, and nothing does now. Readers must keep treating both as absent.
    if (s.rerolls > 0) {
        persist.saveLadder(database, db, discordId, {
            stake: run.stake,
            standing: run.standing || 0,
            level: run.level,
            // Which rung died, so the replay is the same rung — a reroll of an Again must not come
            // back as the level rung and quietly draw two cubes out of the bag.
            again: run.again || 0,
            call: run.call,
            mult: Number(run.mult) || 0,
            spent: run.spent || [],
            set: engine.encodeSet(thrown.set),
            bag: engine.encodeBag(thrown.bag),
            // The run's own state, stored as it was **entering** the rung — a reroll buys the roll
            // back, so the prison, the seal, the lock and the rung count all have to come back with
            // it. `thrown.set` is already the table as it was thrown for the same reason.
            jail: engine.encodeSet(run.jail || []),
            rungs: Number(run.rungs) || 0,
            locked: !!run.locked,
            sealed: run.sealed || null,
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

// A win. **The run always carries on** — it can only end on a bust or on the player banking, and
// there is always another rung to offer: the rest of this gap, the level it opens, or an Again past
// the top for as long as somebody wants one.
//
// It used to force-bank here whenever the roll was at the player's ceiling, because there was
// nothing unlocked to push into. That was the one ending in the mode that came out of a database
// field rather than off the table, and it fired on the best roll of the run.
// `pure` is still passed and still reported — a line all one way is the prettiest thing the mode
// draws and Watto has words for it. What it pays is **not** settled here, though: the engine folds
// `pureBonus` per cube into `res.mult` the moment it knows the line swept, so the bonus arrives in
// `thrown.base` like a Greed and this function sees a standing that already has it in. Doing it
// there rather than here is what keeps the payout walk honest — the itemised `pays` entry and the
// number it lands on come out of the same pass.
const settleWin = function (ctx, { run, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag = [] }) {
    const { s, db, database, discordId } = ctx;

    // Surviving an **Again** collapses it off the route for good. A level rung banks nothing —
    // that level is already open — with one exception at each end of the route: Level 5 *is* the
    // prestige gate, and the Agains past it are worth truguts and nothing else.
    const banks = pstate.rungClears(run.level, run.again);
    const clear = banks ? pstate.awardClear(s, patch) : null;

    // A Shortcut Cube is a clear toward *the next locked level*, on top of whatever the rung earned
    // and wherever it lands — the only progress ever made off a rung that isn't one of the Agains.
    // The gate is re-read every time round, because a clear that opens Level 5 must not let the one
    // behind it hand over the prestige gate: that is meant to cost a run, not a one-cube wager.
    const extra = [];
    for (let n = Number(res.shortcuts) || 0; n > 0 && s.unlocked < MAX_LEVEL; n--) {
        const banked = pstate.awardClear(s, patch);
        if (!banked) break;
        extra.push(banked);
    }

    const awards = [clear, ...extra].filter(Boolean);
    const opened = awards.reduce((at, a) => (a.unlocked ?? at), null);
    // A gap just filled. Either a level opened — two more cubes, and the run pushes straight into
    // it — or, at the top, the prestige was earned. `awardClear` has already written both into the
    // patch, so a player who pushes on from here and busts three Agains later keeps them.
    const filled = opened != null || awards.some(a => a.prestige);

    // **A tie you rolled for and won puts a plain cube on the table.**
    //
    // The table could not call it, so Watto throws one in — but **only for a player who rolled his
    // cube**, never for one who bought the tie. `breaker` is set by the roll and absent on a bribe,
    // so the rule needs no flag of its own.
    //
    // That gate is the whole design. A table with nothing on it that can produce a side ties *every*
    // throw for the rest of the run, and three cubes make that permanent because they carry no
    // downside face and so never leave the table — the Mirror, the Binder and the Gungan Shield.
    // Granting on a roll breaks that loop on the first won tie; refusing on a bribe means buying
    // your way past a deadlock leaves you in it. So the trap is a decision rather than a rescue:
    // take the 40% and fix the table, or pay to survive this rung and meet the same wall on the next
    // one at a price 1.5× dearer against a standing that has grown.
    //
    // A player without Bribe Ties is never asked, so their tie always rolls and always breaks the
    // loop. The trap exists only for someone holding the way out and declining to use the cubes.
    //
    // It applies to **every** tie rather than only to a table that can never recover, and that is
    // measured rather than generous: it lands about once in twelve runs, because a tie has to be
    // survived at 40% to collect. Over 40k runs a full rack's average end table moved 2.2 → 2.3
    // cubes and the pure rate 0.16% → 0.21%. One rule, no special case, and the same guarantee.
    const rescued = !!breaker && !bribed;

    // **Oovo IV's prisoners come back two ways, and both of them settle here.**
    //
    // `freed` is a jailbreak — the die was destroyed and the whole prison emptied at once, which the
    // engine works out for itself. The drip is this function's business, because it is the one place
    // that knows the rung was *won*: one prisoner walks out for every rung the run survives, which is
    // what stops "released when the cube is destroyed" meaning never on a rack with nothing
    // destructive in it.
    const jail = [...(res.jail || [])];
    const released = [...(res.freed || [])];
    if (jail.length) released.push(jail.shift());

    const survivors = [...res.set, ...released];
    if (rescued) survivors.push(engine.plainSlot());

    // **Malastare's lock lifts on a level rung**, which is the whole of the rule: an Again is
    // `M → M+1` and the entire house edge lives in the Agains, so being unable to bank marches the
    // player through exactly that stretch. Past the top there are no level rungs left to clear, so it
    // lasts one rung instead of never lifting.
    //
    // Checked against the rung that came *in*, then re-sealed, so a level rung that also threw
    // Malastare lifts the old lock and starts a new one rather than cancelling itself out.
    let locked = !!run.locked;
    if (locked && (run.level >= MAX_LEVEL || !run.again)) locked = false;
    if (res.lockout) locked = true;

    // Still standing, which is now the only thing a win can be.
    const live = {
        stake: run.stake, level: run.level, again: run.again || 0,
        call: run.call, standing, roll: cubes,
        mult, faces: res.faceIds, spent: stillSpent,
        // The table the next rung builds on, and what is left in the bag to build it with.
        // Everything this roll destroyed, broke or wrote over is already baked into the set.
        set: engine.encodeSet(survivors), bag: engine.encodeBag(bag),
        // What the Planet Octahedron is holding over the run. `sealed` is a side that can't be called
        // next rung and lasts exactly one because this node is rewritten on every one; `locked` is the
        // bank; `jail` is whoever is still inside; `rungs` is what Mon Gazza's seam is paid off.
        sealed: res.sealed || null,
        locked,
        jail: engine.encodeSet(jail),
        rungs: (Number(run.rungs) || 0) + 1,
    };
    persist.saveLadder(database, db, discordId, live);
    return {
        outcome: 'live',
        profit: standing - run.stake,
        opened,
        clear,
        // One entry per Shortcut Cube that actually banked, which is shorter than the faces on the
        // line once the ladder runs out of gaps to fill.
        extra,
        filled,
        // Earned here and written here. The offer stands from this moment whatever the run does
        // next — the one thing a later bust must not be able to take back.
        prestigeOffered: awards.some(a => a.prestige),
        // Watto threw a plain cube onto a table that could not call it. Reported because a cube
        // appearing from nowhere reads as a bug, and because it is the reward for having rolled his
        // cube rather than bought it.
        seeded: rescued,
        // Cubes back out of Oovo IV, and whether the door came off or one of them served their time.
        // Same argument as `seeded`: a cube arriving unannounced reads as a bug.
        released: released.length,
        jailbreak: (res.freed || []).length > 0,
        jailed: jail.length,
        // The bank is sealed, and the client needs to know so the button can say why it is dead.
        locked,
        // The side the next rung cannot be called on.
        sealed: res.sealed || null,
        atTop: run.level >= MAX_LEVEL,
        // Where the standing goes if they push, **and what it is worth** — the second half so no
        // client has to re-derive it. Three kinds of rung now pay three different ways, and a client
        // guessing wrong puts a number on screen the roll will not honour.
        next: {
            ...pstate.nextRung(s, run.level),
            multiple: engine.nextMultiple(pstate.nextRung(s, run.level).kind, mult),
        },
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

    // **A run always starts at rung one**, however far up the route the player has got. What
    // progress buys is a *shorter* route, not a later start: the Agains already collapsed simply
    // aren't on it any more.
    return {
        ok: true,
        staked: stake,
        run: {
            stake, standing: 0, level: 0, again: 0, call: side, mult: 0, spent: [], set: [],
            bag: engine.fillBag(s.equipped),
            // A fresh run owes the Planet Octahedron nothing: nobody is in the prison, no side is
            // sealed, the bank is open, and no rungs have been walked.
            jail: [], rungs: 0, locked: false, sealed: null,
        },
    };
};

// Push onto the next rung. Spends nothing new — the ladder already holds the stake — and the
// multiple rides along, so a Greed caught early pays on every level above it.
//
// **There is no refusal for being deep enough.** `nextRung` always has an answer: the rest of this
// gap, the level it opens, or another Again past the top. What used to be a wall at the ceiling is
// now just a rung that pays badly, and whether to take it is the player's sum to do.
exports.pushRun = function (ctx, { call }) {
    const { s, db, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const ladder = persist.ladderOf(db, discordId);
    if (!ladder || !ladder.standing) return refuse('no_run', 'There is no run to push.');
    const side = call === 'red' ? 'red' : 'blue';
    // **Aquilaris sealed this side last rung.** Refused rather than silently switched: the call is the
    // one decision the mode hands over, and quietly making it for somebody is worse than telling them
    // it has been made. The client disables the button; this is what stops a stale one getting past.
    if (ladder.sealed && side === ladder.sealed) {
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
            // An Again stays on its level and counts up; a level rung starts a fresh count. The
            // route itself is read off `unlocked`/`clears`, so this is only how deep into the gap
            // *this run* has got — which is what names the rung and picks the multiple's shape.
            again: next.kind !== 'level' ? (Number(ladder.again) || 0) + 1 : 0,
            call: side,
            mult: Number(ladder.mult) || 0,
            // Cubes a wipeout broke earlier in this climb stay off the table.
            spent: Object.values(ladder.spent || {}),
            // A run stored before either of these existed carries neither, and starts fresh.
            set: engine.decodeSet(ladder.set), bag: engine.decodeBag(ladder.bag),
            // Whatever the Planet Octahedron is holding over the run. All four default to nothing, so
            // a ladder written before the die existed reads back as a run it was never on.
            jail: engine.decodeSet(ladder.jail),
            rungs: Number(ladder.rungs) || 0,
            locked: !!ladder.locked,
            sealed: ladder.sealed || null,
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
            again: Number(dead.again) || 0,
            mult: Number(dead.mult) || 0, spent: Object.values(dead.spent || {}),
            set: engine.decodeSet(dead.set), bag: engine.decodeBag(dead.bag),
            // The run as it entered the rung that killed it — prison, seal, lock and rung count all
            // come back, because buying the roll back has to buy back the state it was rolled under.
            jail: engine.decodeSet(dead.jail),
            rungs: Number(dead.rungs) || 0,
            locked: !!dead.locked,
            sealed: dead.sealed || null,
            // What makes this a reroll rather than a re-draw: nothing comes out of the bag.
            regrow: false,
        },
    };
};

// ---------------------------------------------------------------------------
// Banking
// ---------------------------------------------------------------------------

// Cashing out. **Not a clear** — walking away from a rung is not surviving it, and the route only
// shortens for rungs you actually stood on. The profit goes on the lifetime ledger.
//
// This is now one of exactly two ways a run can end, the other being a bust. Nothing else stops it.
exports.bank = function (ctx) {
    const { s, db, database, profile, profileRef, discordId, moveTruguts } = ctx;
    const ladder = persist.ladderOf(db, discordId);
    if (!ladder || !ladder.standing) return refuse('no_run', 'There is nothing to bank.');
    // **Malastare sealed the bank.** The only refusal in the mode that stops a player leaving with
    // money they have already won, and it is deliberately a refusal rather than a hidden button: the
    // run is still live, the standing is still theirs, and what they are short of is a level rung.
    if (ladder.locked) {
        return refuse('locked', 'Malastare sealed the bank. Clear a level to get out.',
            { locked: true, level: ladder.level });
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

// ---------------------------------------------------------------------------
// The press
// ---------------------------------------------------------------------------
//
// Three actions and one shared guard. Everything here is refused **mid-run** for the same reason the
// loadout is: the bag is shuffled when a run starts, so changing what is in it halfway through would
// either do nothing or do something incoherent.
//
//   weld    two cubes in, one out          1 prestige point
//   reroll  a fresh cut of the same two    truguts, or 1 prestige point
//   unweld  the two cubes back, whole      free
//
// **Either currency buys a reroll**, which is simpler to explain than splitting them across the split
// and the faces, and it works because the trugut price is tied to the stake ceiling rather than
// escalated — see `weldRerollCost`.

// Shared by all three: the press is closed while a run is live, and a weld has to be one this player
// actually owns.
const pressReady = function (ctx, id) {
    const { s, db, discordId } = ctx;
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'The press is closed while a run is live.');
    if (id !== undefined) {
        if (!s.cubes.includes(id)) return refuse('not_owned', "That isn't yours.");
        if (!pstate.pairKeyOf(id)) return refuse('not_a_weld', 'That is not a welded cube.');
    }
    return null;
};

// Presses two cubes into one. **Both are consumed** and the weld takes their seat in the loadout.
//
// Re-checked here rather than trusted from the screen it came off, exactly as `spendPoint` is: a
// stale press must not be able to spend one point and eat four cubes.
exports.weldCubes = function (ctx, { ids }) {
    const { s, profile, profileRef } = ctx;
    const stop = pressReady(ctx);
    if (stop) return stop;
    if (s.pressTier < 1) return refuse('no_press', "You haven't taken the press off Watto's rack.");
    if (s.points < 1) return refuse('no_points', 'You have no prestige points to spend.');
    // **How many cubes go in is a tier, not a constant.** Two until The Third Cube is bought, and the
    // refusal names the number rather than saying "wrong" — a player who has not bought that rung has
    // no way to know it exists otherwise.
    const want = s.pressCubes;
    if (!Array.isArray(ids) || ids.length !== want) {
        return refuse('bad_pair', `The press takes exactly ${want} cubes.`);
    }
    if (new Set(ids).size !== ids.length) return refuse('bad_pair', 'A cube cannot be welded to itself.');
    // Owned, and none of them already a weld: welding a weld is representable in an id but is not
    // offered, so the rule is enforced where the decision is made rather than left to the parser.
    if (!ids.every(id => s.cubes.includes(id))) return refuse('not_owned', "That isn't yours.");
    if (ids.some(id => pstate.pairKeyOf(id))) return refuse('already_welded', 'Break it apart first.');

    const id = engine.rollWeld(ids, { tier: s.pressTier });
    if (!id) return refuse('cannot_weld', 'Those will not go in the press.');

    const patch = {};
    pstate.spendPoints(s, patch);
    pstate.weldCubes(s, patch, ids, id);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true, weld: id, from: ids, points: s.points, cubes: s.cubes, equipped: s.equipped,
    };
};

// A fresh cut of the same two cubes, paid for either way. The old weld is destroyed by definition —
// there is only ever one cube in that seat.
exports.rerollWeld = function (ctx, { id, paying = 'truguts' }) {
    const { s, profile, profileRef, moveTruguts } = ctx;
    const stop = pressReady(ctx, id);
    if (stop) return stop;
    const parents = engine.weldParents(id);
    if (!parents) return refuse('not_a_weld', 'That is not a welded cube.');

    const points = paying === 'points';
    const cost = points ? 0 : s.weldRerollCost;
    const balance = balanceOf(profile);
    if (points && s.points < 1) return refuse('no_points', 'You have no prestige points to spend.');
    if (!points && cost > balance) {
        return refuse('insufficient', `That costs ${cost} but you only have ${balance}.`, { cost, balance });
    }

    // **The press will not hand back the last `weldMemory` cuts of this pairing**, which matters far
    // more than it sounds: a cube's faces repeat, so a pairing has as few as six distinct welds and
    // without this a reroll returns the identical cube a third of the time.
    // Rerolled at the player's **current** tier, not the one the weld was made at — so buying Deep
    // Cuts puts 5+1 on the table for every weld already standing, rather than only for ones pressed
    // afterwards. An upgrade that only applied to future welds would quietly punish having used the
    // press before buying it.
    const seen = s.weldSeen[pstate.pairKeyOf(id)] || [];
    const next = engine.rollWeld(parents, { seen: [...seen, id], tier: s.pressTier });
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

// Breaks a weld back into two whole cubes. **Free, and the roll is lost** — see `unweldCube`.
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

// Hand the ladder back for a bigger ceiling and a point to spend off Watto's rack.
//
// Eligibility is re-checked here rather than trusted from whatever screen the request came off, so a
// stale one cannot reset a ladder twice.
exports.prestige = function (ctx) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (!pstate.canPrestige(s)) return refuse('not_eligible', 'You have not earned a prestige.');
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');

    const patch = {};
    pstate.applyPrestige(s, patch);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        prestige: s.prestige,
        maxStake: s.maxStake,
        points: s.points,
    };
};

// Spends one banked point on one thing off the rack.
//
// Separate from the prestige that earned it, which is the whole point of it being a point: nothing
// forces a decision at the moment the ladder resets, and several can sit here unspent. Re-checked
// here for the same reason the prestige is — a stale menu must not grant a cube twice.
//
// Refused mid-run like the loadout, and for the same reason: the bag is shuffled when the run
// starts, so a cube unlocked halfway up could not join it anyway.
exports.spendPoint = function (ctx, { reward }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (s.points < 1) return refuse('no_points', 'You have no prestige points to spend.');
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

// **The ceiling is clamped to silently; the balance is refused.** They look like the same check and they
// are not. `maxStake` is a permanent rule — a number the player cannot change and will not cross again
// this prestige — so quietly holding a request down to it loses nothing. A balance is a transient, and
// rewriting a stake the player deliberately configured because they happen to be poor this minute throws
// away the only copy of that intent. So one clamps and the other says no.
//
// It used to consult neither, which let a stake be stored at any value up to the ceiling however little
// was in the purse — 📀1,000,000 against a balance of 📀5,000, stored, reported back as `clamped: false`.
// No trugut was ever mis-withdrawn, because `startRun` checks the balance before it charges, so the whole
// symptom was a board that accepted a stake and then refused to play it. Refusing here moves the answer
// to where the mistake is made.
//
// `insufficient` deliberately reuses `startRun`'s code and message shape: it is the same refusal for the
// same reason, and every client already handles it.
exports.setStake = function (ctx, { stake }) {
    const { s, db, profile, profileRef, discordId } = ctx;
    if (persist.ladderOf(db, discordId)) return refuse('run_live', 'Not while a run is live.');
    const wanted = Math.floor(Number(stake));
    if (!Number.isFinite(wanted)) return refuse('bad_stake', 'That is not a number.');
    if (wanted < config.minStake) {
        return refuse('too_small', `The minimum stake is ${config.minStake}.`, { min: config.minStake });
    }
    const clamped = Math.min(wanted, s.maxStake);
    // Checked against the **clamped** figure, so a request over both limits is refused for the one the
    // player can do something about. Nobody needs telling that a stake they cannot afford is also over a
    // ceiling they were never going to reach.
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
    // **Refused rather than trimmed.** A run draws `bagSize()` cubes, so a request naming more than
    // that has no honest answer — *which* of them to drop is the whole decision, and picking by list
    // order would answer it silently and wrongly. The select menu can't send an over-long list at all;
    // this catches a stale one, and the API, where the caller deserves to be told.
    if (new Set(want).size > slots) {
        return refuse('too_many', `Watto's bag only holds ${slots} cubes.`, { slots });
    }
    const patch = {};
    const equipped = pstate.setLoadout(s, patch, want);
    persist.writeCube(profileRef, profile, patch);
    return { ok: true, equipped, owned: s.cubes, slots };
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
        stake: run.stake, standing: run.standing, level: run.level, again: run.again || 0,
        call: run.call,
        // Both multiples. `mult` is what this roll is playing for, already stepped up the ladder;
        // `carry` is what the run brought into the level. Answering the tie needs the first; a
        // reroll of a tie that busts needs the second, or the ladder gets stepped twice.
        mult: thrown.base, carry: run.mult || 0,
        mults: res.mults, spent: run.spent || [], roll: res.cubes, faces: res.faceIds,
        // Only the Multiplier faces. The greed this roll threw is already folded into `mult`, so
        // replaying it when the tie is answered would count it twice.
        pays: (res.pays || []).filter(p => p.kind === 'mult'),
        shortcuts: res.shortcuts, rerolls: res.rerolls, broken: res.broken,
        // Both halves of the table: what survived this throw to carry on with, and the cubes as
        // they were thrown, in case the tie resolves into a bust a reroll then buys back.
        set: engine.encodeSet(res.set), thrown: engine.encodeSet(set), bag: engine.encodeBag(bag),
        // The Planet Octahedron's state, in the same two halves and for the same reason the multiple
        // is: the un-prefixed fields are what *this roll* did, and `carry*` is what the run brought
        // into the rung. Settling the tie needs both — the first to apply, the second to step from —
        // and a reroll of a tie that busts needs the second on its own.
        sealed: res.sealed || null,
        lockout: !!res.lockout,
        jail: engine.encodeSet(res.jail || []),
        freed: engine.encodeSet(res.freed || []),
        carryJail: engine.encodeSet(run.jail || []),
        carryRungs: Number(run.rungs) || 0,
        carryLocked: !!run.locked,
        carrySealed: run.sealed || null,
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
        again: Number(parked.again) || 0,
        call: parked.call,
        // What the run *entered* the level with, which is what a reroll of this level steps from.
        mult: Number(parked.carry) || 0,
        spent: Object.values(parked.spent || {}),
        set: engine.decodeSet(parked.thrown),
        bag: engine.decodeBag(parked.bag),
        // What the run *entered* the rung with, which is what the settlement steps from — the same
        // rule `carry` follows for the multiple.
        jail: engine.decodeSet(parked.carryJail),
        rungs: Number(parked.carryRungs) || 0,
        locked: !!parked.carryLocked,
        sealed: parked.carrySealed || null,
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
        // A tie parked before shortcuts were counted stored a flag, which reads back as the one
        // clear it meant.
        shortcuts: Number(parked.shortcuts ?? parked.shortcut) || 0,
        rerolls: Number(parked.rerolls) || 0,
        broken: Object.values(parked.broken || {}),
        ended: null,
        notes: [],
        steps: [],
        // A resumed tie must not tally the same throw twice, so it carries no face log.
        faceLog: [],
        specials: [],
        set: engine.decodeSet(parked.set),
        // What the die did on the roll being resumed. `boonta` is always false here by construction:
        // a Boonta tie is won on the spot and is never parked, because there is nothing to ask about.
        sealed: parked.sealed || null,
        lockout: !!parked.lockout,
        jail: engine.decodeSet(parked.jail),
        freed: engine.decodeSet(parked.freed),
        boonta: false,
    };
    // Taken as-is rather than recomputed: it was stepped up the ladder when the tie was parked and
    // would be stepped a second time here.
    const base = Number(parked.mult) || LEVELS[parked.level].payout;
    return {
        run, res, base, opening: base,
        level: LEVELS[parked.level],
        kind: run.again ? 'again' : 'level',
        rolled: res.faceIds, set: run.set, bag: run.bag,
        tie: true, asking: false, breaker: null, boonta: false,
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
