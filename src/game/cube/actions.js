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

const crypto = require('crypto');
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
// What is armed, for the rung ahead
// ---------------------------------------------------------------------------
//
// The three picks that act on a thrown line are **armed per rung and out of the multiple**, before the
// cubes land — see `armShare` in `tuning.js` for the measurement that put the price there rather than
// on use. What that leaves here is bookkeeping with one rule in it: an arm belongs to *one rung* and is
// gone at the end of it, spent or not.
//
// Stored as a set of truthy keys rather than three booleans because that is what survives the round
// trip: Firebase drops a `false` as readily as it drops an absent key, so "nothing armed" and "armed
// nothing" have to be the same value or a reload invents a charge the player never paid.
const ARMS = ['scrap', 'swap', 'split'];
// **The arm key is not always the profile flag.** Swap is stored as `shuffle` — the reward value could
// not move once it was sold — so the two names are mapped here rather than papered over at each site.
const PERK_FOR = { scrap: 'scrap', swap: 'shuffle', split: 'split' };
const armsOf = a => Object.fromEntries(ARMS.filter(k => a && a[k]).map(k => [k, true]));
const isArmed = (a, k) => !!(a && a[k]);
const disarm = (a, k) => Object.fromEntries(ARMS.filter(x => x !== k && a && a[x]).map(x => [x, true]));

// ---------------------------------------------------------------------------
// Paying for it, out of the multiple
// ---------------------------------------------------------------------------

// **Everything Watto sells inside a run comes out of the multiple, in whole mults.** One helper, so the
// four prices move the same numbers in the same order and the standing is always re-derived from the
// multiple rather than adjusted alongside it — see `spendMultiple`, where the reason lives.
//
// Returns the patched ladder for the caller to write, or a refusal. The refusal is deliberately about
// the *standing* rather than the price: "you cannot afford it" is the same sentence whether the run is
// shallow or the player has already bought three things this rung.
const chargeLadder = function (live, price) {
    const spent = engine.spendMultiple(Number(live.stake) || 0, Number(live.mult) || 0, price);
    if (!spent) {
        return refuse('too_poor', `That costs ${price}\u00d7 and you are standing on less.`, { price });
    }
    return { ok: true, price, live: { ...live, mult: spent.mult, standing: spent.standing } };
};


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
    return resolveThrown(ctx, run, {
        line, set, bag: drawn.bag, kind,
    });
};
exports.throwLevel = throwLevel;

// **Everything a throw does after the cubes have landed**, split out so it has one implementation and
// two ways in.
//
// The second way is a throw that was **parked** — see `parkThrow`. Premonition and Swap both
// stop a roll in the gap between the cubes landing and the effects firing, which means the line is
// thrown in one request and settled in another; rebuilt off `relineFrom`, it arrives here exactly as
// a fresh one does and nothing below this line can tell the difference. That is the point of the
// split: a parked roll must not settle down a second code path, because the two would drift and the
// drift would only ever show up as a player being shown one line and paid for another.
const resolveThrown = function (ctx, run, { line, set, bag: drawnBag, kind, wrecked = [] }) {
    const { s } = ctx;
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
    const res = engine.resolveLine(line, run.call, drawnBag, {
        jail: run.jail || [],
        hold: run.hold || [],
        // What the player scrapped off this line while it was held. Swept into the hold with the rest
        // of the roll's wreckage, so a scrapped cube is something the Jawa can fetch back on a later
        // rung — but never on the throw it was scrapped from.
        wrecked,
        rungs: (Number(run.rungs) || 0) + 1,
    });

    // An even line has no majority in it, and only a destructive special face can leave one. Watto
    // breaks it with a cube of his own — unless the player owns the right to buy the tie instead.
    //
    // An empty table trumps a tie: there is nothing left to break and nothing worth buying. Read off
    // the line's length rather than off `res.ended`, because that is the whole of the rule — a mine is
    // only the usual way a line gets to zero positions, not an ending of its own. A line with faces on
    // it but nothing countable is still a tie, and still survivable.
    //
    // An overflow trumps both. The roll was abandoned part-resolved, so the line on the table is a
    // snapshot of a table still moving rather than a result — there is nothing on it for Watto to
    // break and nothing worth selling. It busts below whatever the cubes said.
    const tie = !res.overflow && !!res.faceIds.length && !res.majority;

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
    // **A side bet pays in beside the roll's own faces**, which is what makes it obey every rule they
    // do: `rungMultiple` takes the added bonus, so the price compounds against the ladder, shrinks
    // against a doubling multiple and dies with a bust exactly as a Greed does. Anywhere else and a
    // fixed price would have to be re-priced per level.
    const betPaid = engine.betPaid(run.bet, res);
    const base = engine.rungMultiple(kind, run.mult, res.mult + betPaid);
    // What the roll is worth with none of its paying faces counted. Every frame before the payout
    // walk is drawn at this, and the walk builds it up.
    const opening = engine.rungMultiple(kind, run.mult, 0);

    // What the tie is worth if it goes the player's way, and what Watto wants for it. The
    // multipliers still waiting on a winner count, because either answer produces one.
    const worth = tie ? engine.bankPayout(run.stake, engine.applyMults(base, res.mults, run.call)) : 0;
    const cost = tie && s.bribe && !boonta ? pstate.bribeCostFor(worth, s.bribes, s.nudge) : 0;
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
        run, res, rolled, rolledState, set, bag: res.bag || drawnBag, line, wrecked,
        level: LEVELS[run.level],
        // Tatooine took the tie. Carried so the client can say who did it — it is Watto's cube that
        // normally settles one, and a tie that resolves with no cube of his on screen needs a reason.
        boonta,
        // Which rung this is. The client draws an Again differently and the settlement decides
        // whether it banks a clear off it, so it travels with the throw rather than being
        // re-derived from `run.again` in three places.
        kind,
        tie, asking, breaker, base, opening, worth, cost,
        bet: run.bet || null, betPaid,
    };
};

// ---------------------------------------------------------------------------
// Parking a throw
// ---------------------------------------------------------------------------

// **Puts a thrown line down without settling it**, so the player can be asked something about it.
//
// Pinned onto the live run rather than replacing it — see `shownOf` — which is what makes asking free:
// the rung has not advanced, the bag has not been spent, and banking instead of answering costs the
// player nothing they had before. The draw is carried here rather than committed, and it is committed
// only when the roll it belongs to actually settles.
//
// **Nothing rolled here is rolled again.** That is the whole point and the whole risk: `relineFrom`
// rebuilds this into the same line, face for face, and `scripts/cubeLine.js` is what says so over a
// hundred thousand positions. A rethrow would show one line and pay for another.
const parkThrow = function (ctx, run, { line, bag, kind, seen = null, changed = false, wrecked = [] }) {
    const { database, db, discordId } = ctx;
    const live = persist.ladderOf(db, discordId);
    if (!live) return null;
    const shown = {
        ...engine.encodeLine(line),
        // The rung this was thrown *for*, which is not the rung the run is standing on — a park sits
        // between the two. `level` is also what `shownOf` guards on.
        level: run.level,
        again: run.again || 0,
        kind,
        // The side, if one has been named. A park made *before* the call — a premonition — has none,
        // and that is what tells `bank` the two apart: a look costs nothing and can be walked away
        // from, where a roll already called for is a rung in the air and cannot.
        called: run.call || null,
        // The bag as the draw left it. The run's own `bag` still holds what it had before, so an
        // unanswered park costs nothing; this is what the settlement carries on with instead.
        bag: engine.encodeBag(bag),
        rungs: Number(run.rungs) || 0,
        // Which position the look was spent on, so the face can be shown again after a reload. An
        // Activity re-mounts whenever Discord feels like it, and a premonition the client alone
        // remembered would vanish with the frame it was drawn in.
        seen,
        // **Whether this line has already been altered.** One change per hold — see `alterShown` — and
        // the flag lives on the parked throw rather than on the run because that is its scope: the next
        // rung is a new line and a new question. It has to be *stored* rather than inferred because the
        // Activity can re-mount mid-hold, and a limit the client alone remembered would not be one.
        changed,
        // **What the player has taken off this line**, which is not on the line any more and so has
        // nowhere else to be stored. Scrap is the only thing that puts anything here. It rides the node
        // rather than the run because it belongs to *this* throw: the settlement sweeps it into the
        // Scavenger's hold along with whatever the roll itself breaks, and a park that is banked away
        // from instead of settled never sweeps it at all — the rung did not happen.
        wrecked: engine.encodeSet(wrecked),
    };
    // **The run-scoped flags come off the run, not off the node.** Parking is one of the four things
    // that writes a ladder, and it was the one that forgot: `premonition` marks the look spent by
    // handing in a run with `saw` set, and spreading the stored node over the top dropped it every
    // time. The look was then once per *park* rather than once per run — spendable again the moment
    // the parked roll was settled.
    persist.saveLadder(database, db, discordId, {
        ...live,
        shown,
        saw: !!run.saw,
        armed: armsOf(run.armed),
    });
    return shown;
};
exports.parkThrow = parkThrow;

// Picks a parked throw back up as a run and a line, ready for `resolveThrown`.
//
// `call` arrives with the roll rather than off the node, which is the reason a premonition is worth
// anything: the cubes landed before the side was named, so what the look tells you can still change
// the answer. Everything else comes back exactly as it was put down.
const takeThrow = function (live, shown, call) {
    const run = {
        stake: Number(live.stake) || 0,
        standing: Number(live.standing) || 0,
        level: shown.level,
        again: Number(shown.again) || 0,
        call,
        mult: Number(live.mult) || 0,
        spent: Object.values(live.spent || {}),
        jail: engine.decodeSet(live.jail),
        hold: engine.decodeSet(live.hold),
        rungs: Number(shown.rungs) || 0,
        locked: !!live.locked,
        sealed: live.sealed || null,
        saw: !!live.saw, armed: armsOf(live.armed),
        // **The bet comes back up with the throw**, and this is the line it was missing. Everything
        // else that builds a run descriptor carries these two — `continueRun` off the ladder,
        // `takeTie` off the parked tie — and a parked *throw* is the same run in the same rung with
        // the same chalk on the board. Dropped, `settleThrow` read a run whose bet was undefined and
        // did three wrong things with it in a row: `betPaid` paid nothing, the roll reported no bet
        // where the client had a marker standing over the line, and `betUsed` came out false, which
        // chalked up a fresh book and offered a second bet inside the same run.
        //
        // Every roll that parks goes through here, which is every held roll and every roll a
        // Premonition was taken on — so a player using either of those picks lost the bet they had
        // placed and was then handed another one.
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
    // An overflowed roll wins nothing however it was going: the engine gave up part way through, so
    // the majority standing on the table is a majority of a line that had not finished moving. The
    // same sentence the empty table is refused under — you are paid on a resolved line or not at all.
    const won = !res.overflow && !!res.faceIds.length && !!majority && majority === run.call;
    const pure = won && res.pure;
    const spent = run.spent || [];
    // Wipeouts take a cube off the table for the rest of the climb — and a Scavenger takes one back,
    // so what it recovered comes off the list. A cube standing on the table and still listed as
    // shattered is a lie the rack screen would eventually tell.
    const shattered = res.broken.length ? [...new Set([...spent, ...res.broken])] : spent;
    const back = new Set(res.recovered || []);
    const stillSpent = back.size ? shattered.filter(id => !back.has(id)) : shattered;
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
        // **Whether this is the rung the run opened on**, which is the only rung the cold streak counts.
        // Off `rungs` rather than off the level, because a run always starts at rung one but level 1 is
        // not only ever the opening: the Agains in the gap above it are thrown at the same level, and a
        // bust on one of those is not a lost coin flip.
        opening: !(Number(run.rungs) || 0),
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
//
const settleLoss = function (ctx, { run, res, thrown, patch }) {
    const { s, db, database, discordId } = ctx;
    // Six ways to lose, reported as which one rather than as a sentence. A line with no majority only
    // reaches here once the tie-breaker has already gone the house's way.
    //
    // The two empty-table endings are told apart rather than merged: a mine names itself, and anything
    // else that swept the line to nothing — a purge on a rack of pure specials is the only real way —
    // gets `empty`, because "Ratts stood up" is not true of a roll he was not on.
    //
    // `overflow` goes first because it is the only one of the six that isn't about the line: the rest
    // all read the table the roll left, and an overflowed roll never finished leaving one.
    const reason = res.overflow ? 'overflow'
        : res.ended ? 'ratts'
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
            // **Plus whatever the player scrapped off the rung being bought back.** The hold is stored
            // as it was entering the rung for the same reason the table is — a reroll buys the roll
            // back, not the run — but a scrap is not bought back with it: `thrown.set` is the table
            // *after* the scrap and the flag stays spent on the corpse, so the cube is off the table
            // either way and the hold is the only place it can honestly be.
            hold: engine.encodeSet([...(run.hold || []), ...(thrown.wrecked || [])]),
            rungs: Number(run.rungs) || 0,
            locked: !!run.locked,
            sealed: run.sealed || null,
            faces: res.faceIds,
            roll: res.cubes,
            reason,
            // Carried onto the corpse too: a reroll buys this rung back and resumes the same run, so
            // an ability already spent on it must not come back with the roll.
            saw: !!run.saw, armed: armsOf(run.armed),
            // **The bet, on the same rule as the four above.** `betUsed` is the run's one bet gone, and
            // a reroll resumes the run rather than starting one — so without this the settlement that
            // follows the bought-back roll chalked up a fresh book and offered a second bet. `bet` is
            // the proposition that was standing when the rung was lost: the reroll buys that roll back,
            // and it comes back with what was riding on it. A bust pays nothing, so nothing was paid
            // for it the first time and there is nothing here to pay twice.
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
        // **Whether the coin took it**, so the bust screen can say how many in a row that is. The corpse
        // carries `rungs` already, so a resumed bust works this out for itself and needs nothing stored.
        opening: !(Number(run.rungs) || 0),
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

    // The Scavenger's hold has one valve and the engine works it out on its own: hauled cubes walk the
    // moment no Scavenger is standing. There is no drip to add here — a rung won is not what fetches
    // scrap back, a `scavenge` face is, which is the whole difference between a hold and a prison.
    const hold = [...(res.hold || [])];
    released.push(...(res.sprung || []));

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
        hold: engine.encodeSet(hold),
        rungs: (Number(run.rungs) || 0) + 1,
        // **The rung's purse, emptied.** Arms expire with the rung they were bought for and the look
        // goes with them — see `armExpires` in `tuning.js` for why carrying either is the same exploit
        // in a different hat. A player who wants Scrap on the next rung buys it on the next rung.
        saw: false, armed: {},
        // **One bet a rung, and it is the ante that spends it.** The bet used to be one a *run* and
        // free, which is how it went out: `scripts/cubeSideBet.js` derives every price in `SIDE_BETS`
        // as `1/p - 1`, the fair return on a one-unit wager, and nothing ever staked the unit. A free
        // card worth `price x p` on top of the rung is not a bet, it is a bonus with a menu.
        //
        // With `betAnte` charged at the moment one is named, the pick is priced as it was always meant
        // to be and the run-scope is redundant: a bet costs a mult wherever it is placed, so nothing
        // has to ration how many rungs may carry one. The book is redrawn every rung.
        //
        // The prices are flat and the multiple they pay onto compounds, so the same proposition is
        // worth proportionally less every rung it is held for — a `+4` on a multiple of 8 is half
        // again, and on a multiple of 40 is a tenth. That is the diminishing return in the pick, and
        // it is what makes *when* to bet the decision rather than *whether* to.
        bet: null,
        betUsed: false,
        book: s.sidebet ? engine.drawBook(s.equipped) : [],
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
            jail: [], hold: [], rungs: 0, locked: false, sealed: null,
            // **Run-scoped, not rung-scoped.** Premonition and Swap are each once a run, and
            // the ladder node is rewritten on every rung — so these travel on the run descriptor and
            // are written back by every one of the four things that save a ladder. A flag that lived
            // only on the node would be spent again free on the next rung.
            saw: false, armed: {},
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
    // **A called line already on the table is not something a second roll may walk past.** The same
    // rule `bank` states, from the other side: once the side is named the cubes are in the air, and a
    // push from here would throw the next rung while the last one sat unresolved — the line the player
    // has already *seen* quietly discarded, the standing kept, and nothing paid for either way. That is
    // a reroll of any line worth rerolling, and the way to reach it is simply to reload the Activity
    // mid-hold. `/held` is the only thing that ends one; see `finishShown`.
    const shown = persist.shownOf(db, discordId);
    if (shown && shown.called) {
        return refuse('roll_live', 'The cubes are down and called. Finish the roll.');
    }
    // **A null call advances the rung without naming a side**, which is what a premonition needs: the
    // cubes are thrown before the call so that seeing one of them can still change it. Nothing else
    // passes null, and the throw it produces is parked rather than resolved — `resolveLine` is the
    // only thing that reads a call and it is not reached until the roll comes back with one.
    const side = call == null ? null : (call === 'red' ? 'red' : 'blue');
    // **Aquilaris sealed this side last rung.** Refused rather than silently switched: the call is the
    // one decision the mode hands over, and quietly making it for somebody is worse than telling them
    // it has been made. The client disables the button; this is what stops a stale one getting past.
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
            hold: engine.decodeSet(ladder.hold),
            rungs: Number(ladder.rungs) || 0,
            locked: !!ladder.locked,
            sealed: ladder.sealed || null,
            saw: !!ladder.saw, armed: armsOf(ladder.armed),
            bet: ladder.bet || null,
            // A run stored before the pick was once-a-run carries nothing here and reads back as a run
            // with its bet still to spend, which is the harmless way round.
            betUsed: !!ladder.betUsed,
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
            hold: engine.decodeSet(dead.hold),
            rungs: Number(dead.rungs) || 0,
            locked: !!dead.locked,
            sealed: dead.sealed || null,
            saw: !!dead.saw, armed: armsOf(dead.armed),
            // The other end of the pair the corpse now carries. A run stored before this existed has
            // neither and reads back as a run with its bet still to spend, which is the harmless way
            // round — the same fallback `continueRun` takes.
            bet: dead.bet || null,
            betUsed: !!dead.betUsed || !!dead.bet,
            // What makes this a reroll rather than a re-draw: nothing comes out of the bag.
            regrow: false,
        },
    };
};

// ---------------------------------------------------------------------------
// Looking, and moving
// ---------------------------------------------------------------------------

// **Premonition.** Throws the next rung early, parks it, and hands back one face off it.
//
// The rung advances and the cubes land, but nothing is resolved and nothing is spent — see
// `parkThrow` for why that is free. The call is *not* taken here, which is the whole of what makes
// the look worth having: the cubes are on the table before the side is named, so what you see can
// still change what you say.
//
// **Uniformly random, over the positions.** Weighting it toward the interesting faces was the
// tempting version and it is worse: it makes an ordinary side into information — "the line is
// unusually plain" — and a worst-face-first rule turns a glimpse into a report, where no warning
// nearly guarantees no mine. Uniform needs no footnote, and the rack makes it generous on its own:
// fourteen of the seventeen cubes carry no side faces at all.
exports.premonition = function (ctx) {
    const { s, db, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const live = persist.ladderOf(db, discordId);
    if (!live || !live.standing) return refuse('no_run', 'There is no run to look at.');
    if (!s.premonition) return refuse('not_owned', "You haven't taken Premonition off the rack.");
    // Ordered so the *reason* is the one the player can act on: a look already spent says so, and a
    // look spent with its cubes still on the table says what to do about them.
    if (persist.shownOf(db, discordId)) {
        return refuse('already_shown', 'The cubes are already down — call a side to play them.');
    }
    // **Once a rung now, not once a run** — the same scope every other mid-run purchase moved to when
    // it stopped being free. There is nothing left on a rung to look at twice anyway: the throw is
    // parked by the first look and the second would be re-reading it.
    if (live.saw) return refuse('spent', 'You have already looked at this rung.');
    // **The look is paid for, flat, out of the standing.** Free and played well it measured a small
    // faucet — L2 1.04 against 0.84 for not owning it — because the walk-away is a free option on the
    // rung ahead. `lookCost` is flat rather than a share because the look is worth about the same
    // whatever is standing: one face, and the right to leave. See the dial for what that does to *when*
    // a player spends it.
    const charged = chargeLadder(live, engine.lookPriceOf(live.mult));
    if (!charged.ok) return charged;
    persist.saveLadder(ctx.database, db, discordId, charged.live);

    const opened = exports.pushRun(ctx, { call: null });
    if (!opened.ok) return opened;
    const run = opened.run;
    const kind = run.again ? (run.level >= MAX_LEVEL ? 'overtime' : 'again') : 'level';
    const drawn = kind !== 'level'
        ? { set: run.set || [], bag: run.bag || [] }
        : engine.drawCubes(run.set || [], run.bag || [], run.level);

    // **One cube is the whole line**, so a look at it is not a glimpse, it is the answer. The rule is
    // written against the table rather than against the rung because that is what it is actually
    // about — and `LEVELS` being 1, 3, 5, 7, 9 means it excludes Level 1 and its Agains, and nothing
    // else, without naming either.
    if ((drawn.set || []).length < 2) {
        // **Refunded, because nothing was sold.** The charge lands before the draw is known — it has to,
        // or a look that reveals a one-cube rung would be a free peek at the table size — so the one
        // refusal that happens *after* it has to put the mult back.
        persist.saveLadder(ctx.database, db, discordId, live);
        return refuse('too_few', 'There is nothing to foresee on a single cube.');
    }

    const line = engine.throwSet(drawn.set);
    const at = crypto.randomInt(0, line.length);

    // **The look re-chalks the book**, so the two can be played in either order.
    //
    // `placeBet` used to refuse outright once a throw was parked, which made this pair a sequencing
    // puzzle: bet-then-look worked, look-then-bet did not, and the only way to find that out was to
    // lose the option for a rung. The refusal was right about *why* — every price in `SIDE_BETS` is
    // derived blind, so a card whose face you have already seen is not mispriced by a little — but
    // wrong about the remedy, because there is a cheaper one. Hand the seen face's kind to `drawBook`,
    // and the three cards it draws are three the look could not have answered. Blind again, three deep
    // again, in whichever order the player likes.
    //
    // **Only where nothing is named.** A card placed before the look is a blind bet already made and
    // it rides the line — see `takeThrow`, which carries it across the park. Re-chalking under a
    // standing bet would swap the proposition out from beneath a paid ante.
    //
    // A plain side spoils nothing, so most looks re-chalk against the same pool and simply hand back a
    // fresh three. That makes a look a paid re-roll of a book the player did not fancy, which is a
    // real new use for it: it costs `lookPriceOf`, the pool it draws from never grows, and reading the
    // rung ahead in order to change what is on offer for it is the ability doing its job.
    // **Above `parkThrow` and not below it**, which is the one ordering constraint here: parking spreads
    // the *stored* node to write the throw onto it, so a book chalked afterwards would be overwritten by
    // a save carrying the one it replaced. `saveLadder` writes the cache synchronously, so this is the
    // node parking then reads.
    if (s.sidebet && !charged.live.bet) {
        persist.saveLadder(ctx.database, db, discordId, {
            ...charged.live,
            book: engine.drawBook(s.equipped, line[at].face?.kind),
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

// **Swap**, and the pass that goes with it. Finishes a roll that was held for a look at the
// line: swaps two positions if it is given a pair, and settles either way.
//
// A swap is two positions on the *thrown* line, before any effect has fired — which is the only
// moment it could be, since resolving is what makes position stop being editable.
// **Which positions Split could take, as a list rather than a flag**, and the list is what goes on
// the wire.
//
// Two reasons it cannot be a boolean. A client is sent `faces`, `state` and `call`, and none of those
// carries a slot id — so it has no way of its own to know which position is a weld, and it has to know
// in order to light the cubes that can be pressed. And a flag would stop a rung to ask a question with
// no answer on a line with no weld standing on it, which is the dead end `holdIdle` and the single-cube
// refusal both exist to avoid.
//
// `run` is either the live ladder or a run mid-alteration; both carry `split` the same way.
const splittable = function (s, run, line) {
    if (!s.split || !isArmed(run.armed, 'split')) return [];
    return (line || []).map((c, i) => (engine.canSplitAt(line, i) ? i : -1)).filter(i => i >= 0);
};

// **Changes the held line, and leaves it held for as long as the player wants.**
//
// **As many changes as were armed, and no clock on them.** Both of the old rules here are gone, and one
// measurement retired the pair: what made these picks a faucet was never how many of them landed on one
// line, it was that they were *free* and aimed at a line already showing every face. Priced up front —
// see `armShare` in `tuning.js` — the count stops mattering, because a second change is a second premium
// paid before the cubes landed. Measured with a scrap and a swap both allowed on one line:
// 0.96 / 0.90 / 0.85 / 0.93 against 0.95 / 0.93 / 0.94 / 0.82 for one-only, which is inside the error bar.
//
// So `changed` is no longer a limit, only a record, and the ten-second hold it was written against is
// gone with it. The old note argued the restriction was "the clock rather than the power": a second read
// had to fit in whatever was left of one countdown. Arming settles the *whether* before the throw, which
// leaves the hold asking only where to point it, and that is not a question worth racing.
//
// Re-parks rather than resolving, so what comes back is the same shape the hold came back as and the
// board simply redraws. The change has to be watchable before the effects take it.
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
    // **Exactly one per call, still**, but as a wire rule rather than a game rule. The board plays one
    // change at a time so the player can watch it land, and the node re-parks between each; what used to
    // be a limit on the rung is now only a limit on the message.
    if ([swapping, scrapping, splitting].filter(Boolean).length !== 1) {
        return refuse('one_thing', 'One change at a time.');
    }

    // Where the premonition's face ended up, so the tile goes on pointing at the cube it was about.
    let seen = shown.seen == null ? null : Number(shown.seen);
    // Carried across the re-park rather than started empty: a node that forgot what an earlier change
    // had taken off would quietly drop it out of the game.
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
        // **Kept, not dropped.** A scrapped cube is wreckage, and wreckage is what the Scavenger's hold
        // is made of, so it goes where a cube a mine took goes and a Jawa on a later rung can pull it
        // back out. Held on the node until the throw settles; see `parkThrow`.
        const [gone] = took.line.splice(scrap, 1);
        if (gone?.slot) wrecked.push(gone.slot);
        if (seen === scrap) seen = null; else if (seen != null && seen > scrap) seen -= 1;
        armed = disarm(armed, 'scrap');
    }
    // **Split, and it is Scrap inverted line for line.** One position becomes two or three where a
    // scrap took one off, and the cubes that arrive are thrown here and live for the rest of the climb.
    // The set carries across levels, so nothing has to remember that a weld came apart.
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
        // Written even though `maxCubes` is `Infinity` today, because every other face that lengthens the
        // line writes it. A grower that skips the check is the one that breaks the day a ceiling is put
        // back.
        if (n + parts.length - 1 > config.maxCubes) return refuse('too_many', 'The table is full.');
        took.line.splice(split, 1, ...parts);
        // **A premonition's face belonged to the weld, so a split clears it rather than moving it.**
        // Pointing the tile at a parent would be a lie: the cube the player was shown a face of is not on
        // the table any more. A split before it shifts it by whatever the line grew.
        if (seen === split) seen = null;
        else if (seen != null && seen > split) seen += parts.length - 1;
        armed = disarm(armed, 'split');
    }

    const run = { ...took.run, armed };
    const back = parkThrow(ctx, run, {
        line: took.line, bag: took.bag, kind: took.kind, seen, changed: true, wrecked,
    });
    if (!back) return refuse('no_run', 'There is no run to hold.');
    const pair = took.line.length > 1;
    return {
        ok: true,
        held: true,
        faces: engine.rolledFaces(took.line),
        state: engine.lineState(took.line),
        // Same shape a fresh hold answers with, so the board has one way to read either.
        call: shown.called,
        // **Whatever is still armed and still has somewhere to go.** The spent pick came off `armed`
        // above, so a player who armed two gets the second offer here and a player who armed one gets an
        // empty `can`, which is what the board already reads as "play it and roll on".
        can: {
            swap: pair && !!s.shuffle && isArmed(armed, 'swap'),
            scrap: pair && !!s.scrap && isArmed(armed, 'scrap'),
            split: splittable(s, { armed }, took.line),
        },
    };
};

// Ends a held roll, leaving the line exactly as it stands. Everything that could have changed it has
// already been applied and re-parked, so this only picks it up for resolution.
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

// **The held roll as it stands**, in the shape `holdRoll` answers with, or null when nothing is held.
//
// A hold is a pause in the middle of a roll, and the Activity re-mounts whenever Discord feels like it
// — so the pause has to survive a reload or the board comes back showing a call to make over a rung
// that is already called and already thrown. The node has held everything needed for this since
// `parkThrow`; what was missing was anywhere for the board to read it off, which is why it rides on
// `/state` rather than only on the answer to `/roll`.
exports.heldRoll = function (ctx) {
    const { s, db, discordId } = ctx;
    const live = persist.ladderOf(db, discordId);
    const shown = persist.shownOf(db, discordId);
    if (!live || !shown || !shown.called) return null;
    const took = takeThrow(live, shown, shown.called);
    // **Read off what is still armed, not off whether the line has been touched.** A hold used to allow
    // one change and `shown.changed` was the gate; now the gate is the purse, and a player who paid for
    // two gets two. `changed` stays on the node as a record for the board's animation, not as a rule.
    const pair = took.line.length > 1;
    return {
        held: true,
        faces: engine.rolledFaces(took.line),
        state: engine.lineState(took.line),
        call: shown.called,
        can: {
            swap: pair && !!s.shuffle && isArmed(live.armed, 'swap'),
            scrap: pair && !!s.scrap && isArmed(live.armed, 'scrap'),
            split: splittable(s, live, took.line),
        },
    };
};

// **Arms one pick for the rung ahead, and takes its price out of the standing.**
//
// This is the whole of the fix for what made this mode a faucet, and the argument is at `armShare` in
// `tuning.js`: the picks were not too strong, they were *free and aimed at a line already showing every
// face*. A price paid on use cannot repair that — it is a fraction of a standing being rescued from
// zero, so price and prize scale together and 90% still gets paid on a third of rungs. A price paid
// **before the cubes land** buys an option instead of a rescue, and 40% is then enough.
//
// So the shape of this node is the mechanic: it is callable only while the rung ahead is still unthrown
// and unnamed, it charges whether or not the pick turns out to be needed, and what it buys expires with
// the rung. A player who arms Scrap into a clean line has paid for nothing, and that is not a bug —
// it is the wasted premium that prices the option.
//
// **No cap beyond the purse.** All three can be armed on one rung if the standing can carry all three,
// which is a decision the price makes for itself. The old once-a-run limits are gone: a ration is what
// you need when the thing is free, and this is not.
exports.arm = function (ctx, { pick } = {}) {
    const { s, db, database, discordId } = ctx;
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    if (!ARMS.includes(pick)) return refuse('bad_pick', 'That is not something you can arm.');
    if (!s[PERK_FOR[pick]]) return refuse('not_owned', "You haven't taken that off the rack.");

    const live = persist.ladderOf(db, discordId);
    if (!live || !live.standing) return refuse('no_run', 'There is no rung to arm for.');
    // **Armed before the throw, and the call is what throws.** A pick bought against a line already on
    // the table is the exact thing the price exists to stop, so this refuses the moment a rung is
    // called — and refuses here rather than only in the client, because a stale board would otherwise
    // walk straight through it. A *premonition's* park is not called, and is deliberately allowed: the
    // ordering rule that would forbid it buys about 0.15 EV and costs a rule nobody can hold in mind.
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
        // What the *next* one would cost, so a board offering three buttons can price all three off one
        // answer instead of asking again between each.
        price: engine.armPriceOf(charged.live.mult, pick),
    };
};

// **Holds the roll instead of settling it**, so the line can be looked at before its effects fire.
//
// This is what Swap, Scrap and Split are asking for, and it is opt-in on purpose: every roll would be
// a two-step for anyone who owns either, and most rungs there is nothing worth changing. The player
// says "show me first" and gets a line and a decision; everyone else rolls as they always have.
//
// A premonition already parked this rung — the cubes are down and the side was not named — so this
// takes that line rather than throwing a second one. Same rule `/roll` follows and for the same
// reason: the player has been shown a face off *this* throw.
exports.holdRoll = function (ctx, run, parked) {
    const { s, db, discordId } = ctx;
    if (!s.shuffle && !s.scrap && !s.split) {
        return refuse('not_owned', 'You have nothing to change a line with.');
    }
    // **The opening roll has no ladder to hold onto.** `startRun` clears the node and writes nothing —
    // a run exists once its first roll settles — so there is nothing here to pin a park to. It is also
    // a single cube, which the length check below would refuse anyway.
    const live = persist.ladderOf(db, discordId);
    if (!live) return refuse('no_run', 'There is no run to hold.');
    // **A hold is for what was armed for this rung.** Owning the pick is no longer enough and neither
    // is having an unspent run-flag: the player paid for these before the throw, and the ones they paid
    // for are the ones the line stops to offer. Nothing armed means nothing to ask about, so the roll
    // settles the way it does for everybody else.
    const canSwap = !!s.shuffle && isArmed(live.armed, 'swap');
    const canScrap = !!s.scrap && isArmed(live.armed, 'scrap');
    const canSplit = !!s.split && isArmed(live.armed, 'split');
    if (!canSwap && !canScrap && !canSplit) {
        return refuse('unarmed', 'You armed nothing for this rung.');
    }

    const kind = run.again ? (run.level >= MAX_LEVEL ? 'overtime' : 'again') : 'level';
    const held = parked || (() => {
        const drawn = kind !== 'level'
            ? { set: run.set || [], bag: run.bag || [] }
            : engine.drawCubes(run.set || [], run.bag || [], run.level);
        return { line: engine.throwSet(drawn.set), bag: drawn.bag };
    })();
    // **Nothing can be done to a line of one.** A swap needs two positions and a scrap would leave
    // none — so a rung this short settles rather than stopping to ask a question with no answers.
    // Level 1 is the only rung the table makes this way, but a bag run dry can make another.
    // **A Split alone can act on a line of one**, because one weld coming apart *is* the second cube —
    // so the short-line refusal is asked of the two picks that need a neighbour and not of this one.
    if (held.line.length < 2 && !(canSplit && engine.canSplitAt(held.line, 0))) {
        return refuse('too_few', 'There is nothing to change on a single cube.');
    }

    // Carried through from a premonition's node, which has nothing on it today — a look is spent
    // before the call and nothing can have been scrapped yet. Passed anyway, so the one place that
    // re-parks a line someone else parked does not decide it can forget half of it.
    const shown = parkThrow(ctx, run, {
        line: held.line, bag: held.bag, kind, wrecked: held.wrecked || [],
    });
    if (!shown) return refuse('no_run', 'There is no run to hold.');
    return {
        ok: true,
        held: true,
        faces: engine.rolledFaces(held.line),
        state: engine.lineState(held.line),
        // The side, so the board can light the call it is holding for rather than the last one.
        call: run.call,
        can: { swap: canSwap, scrap: canScrap, split: canSplit ? splittable(s, live, held.line) : [] },
    };
};

// **Names one of the three Watto has chalked up**, or takes the name back.
//
// **The ante is what makes it a bet.** `scripts/cubeSideBet.js` prices every card as `1/p - 1` — the
// fair return on a one-unit wager, with about 15% shaved off — and the wager was never staked, so each
// card was a free option worth roughly `price x p` added to the rung. This charges the unit, in the same
// whole mults as everything else Watto sells mid-run.
//
// Still changeable right up until the cubes are thrown, and taking the name back **returns the ante**:
// a bet is a reading of the rung ahead and nothing has been risked until the rung is rolled. What that
// costs is one edge case worth naming — a player can name, un-name and re-name freely, which is fine,
// because the three on the board do not change while they do it.
//
// **One a rung rather than one a run**, which the ante makes safe: rationing is what a free thing needs.
//
// **Validated against the stored book, not against the whole table.** The three are drawn per rung and
// written onto the ladder by the settlement that opened it, so this is what stops a client naming the
// long shot it fancies rather than the one it was offered.
exports.placeBet = function (ctx, { id }) {
    const { s, db, database, discordId } = ctx;
    if (!s.sidebet) return refuse('not_owned', "You haven't taken the Side Bet off the rack.");
    if (persist.tieOf(db, discordId)) return refuse('tie_pending', 'Answer the tie first.');
    const live = persist.ladderOf(db, discordId);
    if (!live || !live.standing) return refuse('no_run', 'There is no rung to bet on.');
    // **A called line is the answer, not a reading of it.** A held roll parks its throw with the side
    // already named, so every face on it is known and settled and there is nothing left to bet on —
    // the same rule that stops `bank` taking a called rung back. A *premonition's* park is deliberately
    // not caught here: it names no side, shows one face, and re-chalks the book against it.
    const parked = persist.shownOf(db, discordId);
    if (parked && parked.called) return refuse('already_shown', 'The cubes are already down.');

    const standing = live.bet || null;
    const want = id || null;
    if (want === standing) return { ok: true, bet: standing, paid: 0, standing: live.standing };

    // **Once the cubes are down the book may be named but not un-named.**
    //
    // This was one refusal on `shownOf` above and it has split in two, because the two halves are not
    // the same question. *Naming* a card after a look is honest now: `premonition` re-chalks the book
    // against the face it showed, so the three on the board are three the look did not answer, and
    // they are priced as blind as they ever were. That is what lets the look and the bet be played in
    // either order.
    //
    // *Clearing* one is not, and that is what stays shut. Taking the name back returns the ante, so a
    // player who looks and dislikes what they see would be walking away from a wager for nothing — the
    // free option on the rung that `betAnte` was added to close in the first place. Swapping one card
    // for another is a clear and a name in one press, and goes with it: it would let a look pick the
    // card the look has already read.
    if (standing && parked) {
        return refuse('already_shown', 'The cubes are down — this card rides on the line.');
    }

    // **One cube is the whole line, so there is nothing on it to bet on.** No majority to read, no
    // line to grow, no second cube for anything to happen to — the same reason Premonition is refused
    // on one, and the same note applies: written against the rung ahead rather than named as a level,
    // and `LEVELS` being 1, 3, 5, 7, 9 means it excludes Level 1 and its Agains and nothing else.
    //
    // **Off the parked line where there is one**, which is now reachable: a look throws the rung before
    // the bet is named, and a rung the bag ran dry on is shorter than its level says. Reading `LEVELS`
    // through a park would refuse a bet the table can carry, or offer one it cannot.
    const wide = parked
        ? Object.values(parked.faces || {}).length
        : (LEVELS[pstate.nextRung(s, live.level).level] || {}).cubes;
    if (want && !(wide > 1)) {
        return refuse('too_few', 'There is nothing to bet on a single cube.');
    }
    const book = Object.values(live.book || {});
    if (want && !book.includes(want)) return refuse('bad_bet', 'That is not chalked up.');

    // The ante moves only on the edge: onto a board with nothing named, or off one being cleared.
    // Swapping one card for another leaves it where it is, because the same single unit is still up.
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
    // **A look can be walked away from; a called rung cannot.**
    //
    // A premonition parks a throw with no side named, and the run under it is untouched — so banking
    // is exactly as available as it was before the look, which is what stops the ability costing
    // anything to use. Once the side *is* named the cubes are in the air: the line is known and
    // banking on it would be taking a decision back after seeing the answer.
    const shown = persist.shownOf(db, discordId);
    if (shown && shown.called) {
        return refuse('roll_live', 'The cubes are down and called. Finish the roll.');
    }
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


// Buys one set off the cosmetics shelf — a matched colour pair, or one racer's flag.
//
// **Named by set id, and every term of the sale is looked up from it.** The client sends the id of a
// row it drew and nothing else: the price, the gate and the variants all come off `SKIN_SETS` here, so
// a client cannot pair one set's price with another set's contents. Same reason `spendPoint` re-checks
// eligibility on the select rather than trusting the menu that offered it.
//
// **Not refused mid-run**, which is the one place this differs from `buyReroll` above. A reroll changes
// what a bust can do next, so buying one halfway through a run is a change to a live game; a skin
// changes a picture, touches neither the bag nor the ladder, and the client only greys the button to
// keep the shop quiet while a roll is in the air. There is nothing here for a run to be inconsistent
// with.
//
// The truguts are filed as **spent** rather than lost, like a bought reroll and a bought tie: nothing
// was ever riding on it, and a purchase on the loss ledger reads as if the cubes had taken it.
exports.buySkin = function (ctx, { id }) {
    const { s, profile, profileRef, moveTruguts } = ctx;
    const set = pstate.skinSetById(id);
    if (!set) return refuse('no_such_set', 'Nothing on the shelf goes by that.');
    if (set.ids.every(v => s.skins.includes(v))) return refuse('owned', 'That one is already yours.');
    const gate = pstate.skinGate(s, set.gate);
    if (!gate.open) return refuse('locked', gate.need || 'That is not for sale yet.');
    const cost = Math.round(set.price);
    const balance = balanceOf(profile);
    if (cost > balance) {
        return refuse('insufficient', `That costs ${cost} but you only have ${balance}.`, { cost, balance });
    }
    moveTruguts({ transaction: 'w', amount: cost });
    const patch = {};
    pstate.grantSkins(s, patch, set.ids);
    pstate.recordSpent(s, patch, cost);
    persist.writeCube(profileRef, profile, patch);
    return {
        ok: true,
        set: set.id,
        // What the purchase actually put on the profile, so a client can paint the row it just bought
        // without waiting for the board that follows.
        ids: set.ids,
        skins: s.skins,
        spent: cost,
        balance: balanceOf(profile),
    };
};

// ---------------------------------------------------------------------------
// The press
// ---------------------------------------------------------------------------
//
// Three actions and one shared guard. Everything here is refused **mid-run** for the same reason the
// loadout is: the bag is shuffled when a run starts, so changing what is in it halfway through would
// either do nothing or do something incoherent.
//
//   weld    two cubes in, one out          1 build token
//   reroll  a fresh cut of the same two    truguts, or 1 build token
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

// **What the press has to be told, and never was.**
//
// `rollWeld` has always accepted both of these and no caller has ever passed either, so The Keeper and
// The Heavy Half were sold off the rack, written to the profile and reported to the client while doing
// nothing whatsoever. This is the gate the note on `orderFor` promised was here.
//
// `major` is an index into `ids` — which parent the major share of an uneven cut lands on. It used to be
// The Heavy Half and is now part of **Deep Cuts**, press rung 4, because 5+1 is the only thing that rung
// unlocks and a useful 5+1 is "one press in 220" precisely because the choice is otherwise a coin flip.
// Below rung 4 the request is dropped rather than refused: an even cut has no major share to name, so a
// client sending one at rung 1 is early rather than wrong.
//
// `keep` is The Keeper: one **face id**, and the parent it has to survive on. `pickWith` already ignores
// a face the parent does not carry, so a stale client naming a face off the wrong cube gets the ordinary
// draw instead of an error.
const pressPicks = function (s, ids, { major, keep } = {}) {
    // **Both name a cube by id on the wire and by position in the engine**, and the translation is here.
    // `orderFor` and `pickWith` both index into the parent list, which is the caller's own array — so a
    // client sending an index would be sending one against an ordering it has to guess right, and getting
    // it wrong points the whole pick at the other cube with nothing to say it went wrong.
    const at = id => (typeof id === 'string' ? ids.indexOf(id) : -1);
    const majorAt = at(major);
    const keepAt = keep ? at(keep.parent) : -1;
    return {
        // Deep Cuts, press rung 4. Below it an even cut has no major share to name, so an early request is
        // dropped rather than refused.
        major: s.pressTier >= config.weldTiers.length && majorAt >= 0 ? majorAt : null,
        keep: s.keeper && keepAt >= 0 && typeof keep.faceId === 'string'
            ? { parent: keepAt, faceId: keep.faceId }
            : null,
    };
};

// Presses two cubes into one. **Both are consumed** and the weld takes their seat in the loadout.
//
// Re-checked here rather than trusted from the screen it came off, exactly as `spendPoint` is: a
// stale press must not be able to spend one point and eat four cubes.
exports.weldCubes = function (ctx, { ids, major = null, keep = null }) {
    const { s, profile, profileRef } = ctx;
    const stop = pressReady(ctx);
    if (stop) return stop;
    if (s.pressTier < 1) return refuse('no_press', "You haven't taken the press off Watto's rack.");
    if (s.points < 1) return refuse('no_points', 'You have no build tokens to spend. A prestige pays one.');
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

// A fresh cut of the same two cubes, paid for either way. The old weld is destroyed by definition —
// there is only ever one cube in that seat.
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

    // **The press will not hand back the last `weldMemory` cuts of this pairing**, which matters far
    // more than it sounds: a cube's faces repeat, so a pairing has as few as six distinct welds and
    // without this a reroll returns the identical cube a third of the time.
    // Rerolled at the player's **current** tier, not the one the weld was made at — so buying Deep
    // Cuts puts 5+1 on the table for every weld already standing, rather than only for ones pressed
    // afterwards. An upgrade that only applied to future welds would quietly punish having used the
    // press before buying it.
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
    // **The Heavy Half's point comes back before the balance is read**, so it lands as something to spend
    // on this visit rather than as a number to notice and come back for. See `refundDeadHeavy` — it is a
    // migration with an expiry date, and this is the one screen that can pay it out.
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
        hold: engine.encodeSet(res.hold || []),
        sprung: engine.encodeSet(res.sprung || []),
        recovered: res.recovered || [],
        carryJail: engine.encodeSet(run.jail || []),
        carryHold: engine.encodeSet(run.hold || []),
        // Already swept into `hold` above, and stored a second time on its own because a *bust* settled
        // off this node is filed against `carryHold` — the hold as the rung began — and the corpse a
        // reroll replays has to carry the scrap forward all the same. See `settleLoss`.
        wrecked: engine.encodeSet(thrown.wrecked || []),
        carryRungs: Number(run.rungs) || 0,
        carryLocked: !!run.locked,
        carrySealed: run.sealed || null,
        saw: !!run.saw, armed: armsOf(run.armed),
        // **The bet the tied rung was riding on, and that the run has spent it.** This node is built
        // from scratch rather than spread over the stored one — see the note in `parkThrow` about the
        // run-scoped flags, which is the same trap — so anything not named here is gone by the time the
        // tie is answered. Without `betUsed` a run could park on a tie and be handed a second bet by the
        // settlement that picked it back up.
        bet: run.bet || null,
        betUsed: !!run.betUsed || !!run.bet,
        // **What it paid, stored rather than recomputed.** `mult` above is `thrown.base`, which already
        // has the bet folded into it — the money is settled and this is only how much of it the bet was.
        // It cannot be worked out again on the way back: `betPaid` reads the roll's *notes*, and the
        // `res` a resumed tie is rebuilt from deliberately carries none, so asking a second time would
        // report a proposition that hit as one that missed.
        betPaid: Number(thrown.betPaid) || 0,
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
        hold: engine.decodeSet(parked.carryHold),
        rungs: Number(parked.carryRungs) || 0,
        locked: !!parked.carryLocked,
        sealed: parked.carrySealed || null,
        saw: !!parked.saw, armed: armsOf(parked.armed),
        // The run's bet, and spent whichever way the tie goes.
        bet: parked.bet || null,
        betUsed: !!parked.betUsed || !!parked.bet,
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
        hold: engine.decodeSet(parked.hold),
        sprung: engine.decodeSet(parked.sprung),
        recovered: Object.values(parked.recovered || {}),
        boonta: false,
    };
    // Taken as-is rather than recomputed: it was stepped up the ladder when the tie was parked and
    // would be stepped a second time here.
    const base = Number(parked.mult) || LEVELS[parked.level].payout;
    return {
        run, res, base, opening: base,
        // **The bet, reported rather than re-settled.** It was paid when the tie was parked — `base`
        // above is the figure it was folded into — so both of these are read back off the node instead
        // of being asked of `betPaid` again, which would answer off a `res` that carries no notes. A tie
        // used to answer with neither, which paid the bet and then told the player it had missed.
        bet: parked.bet || null,
        betPaid: Number(parked.betPaid) || 0,
        level: LEVELS[parked.level],
        kind: run.again ? 'again' : 'level',
        rolled: res.faceIds, set: run.set, bag: run.bag,
        wrecked: engine.decodeSet(parked.wrecked),
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
        const cost = pstate.bribeCostFor(worth, s.bribes, s.nudge);
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

exports.resolveThrown = resolveThrown;
exports.MAX_LEVEL = MAX_LEVEL;
