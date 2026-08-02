// Plays the chance cube against a fake database, thousands of runs at a time, and checks that the
// money adds up.
//
// The engine has a parity harness; the *actions* cannot have one, because the implementation they
// replaced is welded to a Discord interaction and cannot be called headlessly. So this proves the
// thing that actually matters instead: **every trugut is accounted for.**
//
//   balance delta  ==  won - lost - spent          the ledger is the literal sum of what happened
//   pot delta      ==  inflow - prizes             the jar neither mints nor loses truguts
//
// The design doc's §2.3 makes the first claim about the lifetime ledger, and §2.8 derives the
// second. Neither had anything checking it.
//
//   node scripts/cubeEconomy.js [runs]

const assert = require('assert');

const actions = require('../src/game/cube/actions.js');
const pstate = require('../src/game/cube/state.js');
const persist = require('../src/game/cube/persist.js');
const { SPECIALS, cube: config } = require('../src/game/cube/tuning.js');

const RUNS = Number(process.argv[2]) || 20000;
const ALL = SPECIALS.map(s => s.id);
const ME = 'player-1';

// ---------------------------------------------------------------------------
// A database that only exists in this process
// ---------------------------------------------------------------------------

const makeWorld = function (rack) {
    const profile = {
        name: 'Sim',
        truguts_earned: 100000000,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 3,
            unlocked: 4,
            clears: 0,
            slots: rack.length || 1,
            stake: 1000,
            cubes: Object.fromEntries(rack.map(id => [id, true])),
            equipped: rack,
            buyReroll: true,
            bribe: true,
            nudge: true,
        },
    };
    const db = { user: { KEY: { random: profile, discordID: ME } }, ch: { cube: { pot: 5000000, ladders: {} } } };

    // **Remote and mirror are separate here, because they are separate in production.** A real
    // `.transaction()` writes to Firebase and returns a snapshot; the *mirror* is then updated by
    // the caller — `payFromPot` subtracts the prize from `db.ch.cube.pot` itself. A fake whose
    // transaction also wrote to the mirror would apply every prize twice, which is exactly the
    // false failure this replaces.
    const remote = { pot: db.ch.cube.pot };

    const ref = path => ({
        child: c => ref(`${path}/${c}`),
        update: (v) => { Object.assign(profile.cube, v); return Promise.resolve(); },
        set: (v) => {
            const m = path.match(/ladders\/(.+)$/);
            if (m) db.ch.cube.ladders[m[1]] = v;
            return Promise.resolve();
        },
        remove: () => {
            const m = path.match(/ladders\/(.+)$/);
            if (m) delete db.ch.cube.ladders[m[1]];
            return Promise.resolve();
        },
        transaction: (fn) => {
            const next = fn(remote.pot);
            if (next !== undefined) remote.pot = next;
            return Promise.resolve({ snapshot: { val: () => remote.pot } });
        },
    });
    const database = { ref };

    // `addToPot` writes `set(ServerValue.increment(n))`, which is a sentinel object the fake ref
    // cannot interpret. Intercepted here where the amount is still a number, and applied to both
    // sides exactly as the increment would be.
    const potMoves = [];
    const realAdd = persist.addToPot;
    persist.addToPot = (dbase, mirror, amount) => {
        const add = Math.floor(amount);
        if (!add) return;
        potMoves.push(add);
        remote.pot = Math.max(0, remote.pot + add);
        mirror.ch.cube.pot = Math.max(0, (Number(mirror.ch.cube.pot) || 0) + add);
    };

    return { profile, db, database, remote, potMoves, restore: () => { persist.addToPot = realAdd; } };
};

// The one thing `actions.js` refuses to import, injected the way the bot injects it.
const makeMoveTruguts = (profile, log) => ({ transaction, amount }) => {
    const n = Math.floor(Number(amount) || 0);
    if (transaction === 'w') { profile.truguts_spent += n; log.push({ t: 'w', n }); }
    if (transaction === 'd') { profile.truguts_earned += n; log.push({ t: 'd', n }); }
    if (transaction === 'r') { profile.truguts_spent -= n; log.push({ t: 'r', n }); }
};

// ---------------------------------------------------------------------------

const play = async function (rack, runs, label) {
    const world = makeWorld(rack);
    const { profile, db, database } = world;
    const moves = [];
    const moveTruguts = makeMoveTruguts(profile, moves);

    const startBalance = actions.balanceOf(profile);
    const startPot = db.ch.cube.pot;

    const stats = { runs: 0, throws: 0, busts: 0, banks: 0, ties: 0, bribes: 0, rerolls: 0, prizes: 0, prizeTotal: 0, prestiges: 0, ratts: 0 };

    const ctxOf = () => ({
        db, database, profile,
        profileRef: database.ref('users/KEY/random'),
        discordId: ME,
        s: pstate.cubeState(profile),
        moveTruguts,
    });

    for (let i = 0; i < runs; i++) {
        let ctx = ctxOf();
        const started = actions.startRun(ctx, { call: i % 2 ? 'red' : 'blue' });
        if (!started.ok) {
            // Only ever a genuine refusal — out of money, or a run left behind. Both would be bugs
            // here, so surface rather than skip.
            throw new Error(`startRun refused: ${started.code} ${started.message}`);
        }
        stats.runs++;
        let run = started.run;

        // Climb until something stops us. A simple strategy: always push while allowed.
        for (let guard = 0; guard < 40; guard++) {
            ctx = ctxOf();
            const thrown = actions.throwLevel(ctx, run);
            stats.throws++;
            if (thrown.res.ended) stats.ratts++;

            let bribed = 0;
            let settleCtx = ctx;
            let toSettle = thrown;

            if (thrown.tie) {
                stats.ties++;
                if (thrown.asking) {
                    // Park it and answer it, which is the path a real player takes through two
                    // separate interactions. Buying every other one exercises both branches.
                    const buying = i % 2 === 0;
                    persist.saveLadder(database, db, ME, {
                        stake: run.stake, level: run.level, call: run.call, standing: run.standing,
                        mult: run.mult, tie: true, cost: thrown.cost,
                        set: require('../src/game/cube/engine.js').encodeSet(thrown.set),
                        bag: require('../src/game/cube/engine.js').encodeSet(thrown.bag),
                    });
                    settleCtx = ctxOf();
                    const answered = actions.answerTie(settleCtx, { buying });
                    if (!answered.ok) throw new Error(`answerTie refused: ${answered.code}`);
                    bribed = answered.bribed;
                    if (bribed) stats.bribes++;
                    // The parked node is replaced by whatever settlement decides.
                    persist.clearLadder(database, db, ME);
                    toSettle = { ...thrown, breaker: answered.breaker };
                }
            }

            const out = await actions.settleThrow(settleCtx, { thrown: toSettle, bribed });

            if (out.outcome === 'bust') {
                stats.busts++;
                // Spend a reroll when one is banked, which exercises the reversal path.
                const rctx = ctxOf();
                if (rctx.s.rerolls > 0) {
                    persist.saveLadder(database, db, ME, {
                        ...run, dead: true,
                        set: require('../src/game/cube/engine.js').encodeSet(thrown.set),
                        bag: require('../src/game/cube/engine.js').encodeSet(thrown.bag),
                    });
                    const again = actions.spendReroll(ctxOf());
                    if (again.ok) {
                        stats.rerolls++;
                        run = again.run;
                        // The reversal is applied by the next settle, via `reverse`.
                        const rethrown = actions.throwLevel(ctxOf(), run);
                        stats.throws++;
                        const reout = await actions.settleThrow(ctxOf(), { thrown: rethrown, reverse: again.reverse });
                        if (reout.prize > 0) { stats.prizes++; stats.prizeTotal += reout.prize; }
                        if (reout.outcome === 'bust') { stats.busts++; break; }
                        if (reout.outcome === 'bank') { stats.banks++; break; }
                        run = { ...run, level: run.level + 1, standing: reout.standing, mult: reout.mult, spent: reout.ladder.spent, set: reout.ladder.set, bag: reout.ladder.bag };
                        continue;
                    }
                }
                break;
            }

            if (out.prize > 0) { stats.prizes++; stats.prizeTotal += out.prize; }

            if (out.outcome === 'bank') { stats.banks++; break; }

            // Live: push on.
            const pushed = actions.pushRun(ctxOf(), { call: i % 3 ? 'blue' : 'red' });
            if (!pushed.ok) {
                // At the ceiling with nothing to push into — bank what is standing.
                const banked = actions.bank(ctxOf());
                if (banked.ok) stats.banks++;
                break;
            }
            run = pushed.run;
        }

        // Take the prestige whenever it is offered, so the whole cycle gets exercised.
        const pctx = ctxOf();
        if (pstate.canPrestige(pctx.s)) {
            const choices = pstate.rewardChoices(pctx.s);
            const got = actions.prestige(pctx, { reward: choices[0].value });
            if (got.ok) stats.prestiges++;
        }
    }

    const endBalance = actions.balanceOf(profile);
    const endPot = db.ch.cube.pot;
    const s = pstate.cubeState(profile);
    world.restore();

    // --- the two invariants --------------------------------------------------
    const ledger = s.totalWon - s.totalLost - s.totalSpent;
    const actual = endBalance - startBalance;
    const potIn = world.potMoves.filter(n => n > 0).reduce((a, b) => a + b, 0);
    const potOut = -world.potMoves.filter(n => n < 0).reduce((a, b) => a + b, 0);
    const potDelta = endPot - startPot;

    console.log(`\n${label}`);
    console.log(`  ${stats.runs} runs · ${stats.throws} throws · ${stats.banks} banked · ${stats.busts} bust`);
    console.log(`  ties ${stats.ties} (${stats.bribes} bought) · rerolls ${stats.rerolls} · ratts ${stats.ratts} · prestiges ${stats.prestiges}`);
    console.log(`  pot prizes ${stats.prizes} totalling ${stats.prizeTotal}`);
    console.log(`  ledger  won ${s.totalWon} - lost ${s.totalLost} - spent ${s.totalSpent} = ${ledger}`);
    console.log(`  balance moved ${actual}`);
    console.log(`  pot     in ${potIn} - out ${potOut} - prizes ${stats.prizeTotal} · moved ${potDelta}`);

    const problems = [];
    if (ledger !== actual) problems.push(`ledger says ${ledger}, balance moved ${actual} (out by ${actual - ledger})`);
    if (endPot < 0) problems.push(`pot went negative: ${endPot}`);
    if (potDelta !== potIn - potOut - stats.prizeTotal) {
        problems.push(`pot moved ${potDelta}, expected ${potIn - potOut - stats.prizeTotal}`);
    }
    // The mirror and the database must agree about the jar. They are updated by different lines of
    // `payFromPot`, and a drift between them would mean the pot on screen is not the pot being paid
    // out of.
    if (world.remote.pot !== endPot) {
        problems.push(`mirror says the pot is ${endPot}, the database says ${world.remote.pot}`);
    }
    if (Object.keys(db.ch.cube.ladders).length) {
        problems.push(`${Object.keys(db.ch.cube.ladders).length} ladder(s) left behind`);
    }
    return problems;
};

(async () => {
    const all = [];
    all.push(...await play([], Math.floor(RUNS / 2), 'Starting empty (the rack grows as it prestiges)'));
    all.push(...await play(['greed', 'wild'], Math.floor(RUNS / 4), 'Two cubes'));
    all.push(...await play(ALL, Math.floor(RUNS / 4), 'Full rack'));

    if (all.length) {
        console.log('\nFAILED:');
        all.forEach(p => console.log(`  - ${p}`));
        process.exit(1);
    }
    console.log('\nEvery trugut is accounted for, in all three racks.');
})().catch((err) => { console.error(err); process.exit(1); });
