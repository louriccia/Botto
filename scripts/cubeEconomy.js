// Plays the chance cube against a fake database, thousands of runs at a time, and checks that the
// money adds up.
//
// The engine has a parity harness; the *actions* cannot have one, because the implementation they
// replaced is welded to a Discord interaction and cannot be called headlessly. So this proves the
// thing that actually matters instead: **every trugut is accounted for.**
//
//   balance delta  ==  won - lost - spent          the ledger is the literal sum of what happened
//
// The design doc's §2.3 makes that claim about the lifetime ledger, and nothing was checking it.
//
// There was a second invariant here — `pot delta == inflow - prizes`, that the Pure Cube jar
// neither minted nor lost truguts. The jar is gone, and with it the only thing in the mode that
// could mint anything: a busted stake now simply leaves. So the ledger check is all that is left,
// and it is the one that was always doing the work.
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
        // **Not a realistic balance, and it does not want to be.** The sim buys every tie it is
        // offered, and a bribe is a share of the standing with a 1.5× step on it, so a full rack —
        // which ties constantly — spends orders of magnitude more than any player would. This used
        // to sit at 100M and survive; with the pot gone there are no prizes flowing back, and the
        // full-rack row went insolvent partway through and took the harness down with it. The
        // invariant under test is `won - lost - spent == balance delta`, which has nothing to do
        // with how rich the player is, so the fix is to stop the policy running out of road.
        name: 'Sim',
        truguts_earned: 10000000000,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 3,
            unlocked: 4,
            clears: 0,
            // No `slots` — the cap is `bagSize()` and `cubeState` applies it on read, so a `rack`
            // longer than the bag measures its first eight rather than all of it.
            stake: 1000,
            cubes: Object.fromEntries(rack.map(id => [id, true])),
            equipped: rack,
            buyReroll: true,
            bribe: true,
            nudge: true,
        },
    };
    const db = { user: { KEY: { random: profile, discordID: ME } }, ch: { cube: { ladders: {} } } };

    // No `transaction` on this fake any more. It existed for `payFromPot`, and the care it needed
    // — a separate remote and mirror, because a real transaction writes to Firebase and lets the
    // caller update the mirror, so a fake that wrote both applied every prize twice — went out with
    // the pot. Ladders are plain `set`/`remove`.
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
    });
    const database = { ref };

    return { profile, db, database };
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

    // `sealed` and `locked` are the Planet Octahedron's two refusals: a call turned away by the vault
    // and a bank turned away by Malastare. Both are states the sim now has to play through rather than
    // fail on, so both are counted — a run of zeroes means the die never reached the table.
    const stats = {
        runs: 0, throws: 0, busts: 0, banks: 0, ties: 0, bribes: 0, rerolls: 0, prestiges: 0,
        ratts: 0, sealed: 0, locked: 0,
    };

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
            // **Going broke is a result, not a bug.** It used to be neither — the sim's bankroll was
            // never in any danger, so any refusal here was a run left behind and worth throwing on.
            // A rack that can seal the bank changes that: a run Malastare will not let you leave is a
            // run that ends on a bust far more often, and a policy of "climb until the lock lifts"
            // will genuinely drain a bankroll. Reported, so the ledger checks below still run against
            // however many runs the money lasted for.
            if (started.code === 'insufficient') {
                stats.broke = i;
                break;
            }
            throw new Error(`startRun refused: ${started.code} ${started.message}`);
        }
        stats.runs++;
        let run = started.run;

        // Walk the road until something stops us — a bust, or the policy below deciding to bank.
        // The guard is a backstop, not the policy: nothing in the rules ends a run any more.
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
                    // Parked and answered through the real path — two separate interactions, and
                    // the second one rebuilds the roll off the stored node rather than throwing
                    // again. Buying every other one exercises both branches.
                    actions.parkTie(ctx, thrown);
                    settleCtx = ctxOf();
                    // Buy every other one, but only when it is actually affordable. The route made
                    // that check necessary: runs are longer, so ties are far more frequent, and a
                    // sim that bought unconditionally drained a hundred million truguts and fell
                    // over on `insufficient` — which is the harness running out of money, not the
                    // game doing anything wrong. Falling back to his cube keeps both branches in
                    // the sample either way.
                    let answered = actions.answerTie(settleCtx, { buying: i % 2 === 0 });
                    if (!answered.ok && answered.code === 'insufficient') {
                        answered = actions.answerTie(settleCtx, { buying: false });
                    }
                    if (!answered.ok) throw new Error(`answerTie refused: ${answered.code}`);
                    bribed = answered.bribed;
                    if (bribed) stats.bribes++;
                    // The parked node is replaced by whatever settlement decides.
                    persist.clearLadder(database, db, ME);
                    // The **resumed** throw, not the one that was parked: same cubes, now with an
                    // answer on top. Settling `thrown` here would work by accident and would stop
                    // testing the thing that matters.
                    toSettle = answered.thrown;
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
                        if (reout.outcome === 'bust') { stats.busts++; break; }
                        // **Advanced through `pushRun`, not by adding one to the level.** Hand-rolling
                        // the step was survivable while every rung was a level; on the route it walks
                        // straight past Level 5 into a level index the data does not have, and the
                        // next tie parks on a node `tieOf` then refuses to hand back — a soft-lock in
                        // production and a `no_tie` here. The route is the only thing that knows what
                        // comes next.
                        // Same seal, same answer as the main loop: the vault is a rule to play by, not
                        // a failure. A rerolled rung can throw one exactly like any other.
                        let side = i % 3 ? 'blue' : 'red';
                        if (reout.sealed && side === reout.sealed) {
                            side = reout.sealed === 'red' ? 'blue' : 'red';
                            stats.sealed++;
                        }
                        const on = actions.pushRun(ctxOf(), { call: side });
                        if (!on.ok) throw new Error(`pushRun refused after a reroll: ${on.code}`);
                        run = on.run;
                        continue;
                    }
                }
                break;
            }

            // A throw can no longer settle as a bank: nothing force-banks, so a win is always
            // `live`. Kept as an assertion rather than deleted — if it ever fires again the route
            // has grown an ending nobody designed.
            assert.notStrictEqual(out.outcome, 'bank', 'a throw settled as a bank');

            // **The route always offers another rung, so the sim needs a stopping policy of its
            // own.** Pushing "while allowed" used to mean climbing to the ceiling and being shown
            // the door; it would now run to the 40-rung guard on every survived run, spend the
            // whole measurement in overtime — where an Again buys +1 against a base of 32 — and
            // never exercise `bank` at all.
            //
            // So it stops where a player with any sense would: at the end of the road, or one run
            // in eight somewhere short of it, which is what keeps a deliberate bank in the sample.
            const nxt = out.next || pstate.nextRung(ctxOf().s, run.level);
            const overtime = nxt.kind === 'again' && nxt.level >= pstate.MAX_LEVEL;
            if (overtime || (i % 8 === 0 && guard >= 2)) {
                const banked = actions.bank(ctxOf());
                if (banked.ok) stats.banks++;
                // **Malastare seals the bank**, and a sim that treated that as fatal would measure a
                // cube by crashing on it. The lock lifts on a level rung, so the answer is the one a
                // player has: carry on climbing. Counted, because how often a run is made to push is
                // most of what that face is worth.
                if (!banked.ok && banked.code === 'locked') stats.locked++;
                else break;
            }

            // **Aquilaris seals the side just called**, so the sim's call has to respect it — this is
            // the first refusal `pushRun` has ever had that isn't a bug. Switching is exactly what the
            // face is for, and it costs nothing in EV, so the policy is simply to call the other way.
            let want = i % 3 ? 'blue' : 'red';
            if (out.sealed && want === out.sealed) {
                want = out.sealed === 'red' ? 'blue' : 'red';
                stats.sealed++;
            }
            const pushed = actions.pushRun(ctxOf(), { call: want });
            // Anything else left for `pushRun` to refuse would be a bug here rather than a state to
            // handle — there is no run, or a seal the branch above failed to respect.
            if (!pushed.ok) throw new Error(`pushRun refused: ${pushed.code} ${pushed.message}`);
            run = pushed.run;
        }

        // Take the prestige whenever it is offered, and spend the point it banks straight away, so
        // the whole cycle gets exercised. Letting points pile up instead would model a player who
        // never visits the rack — a rack that never grows, which is the opposite of what this
        // measures.
        const pctx = ctxOf();
        if (pstate.canPrestige(pctx.s)) {
            const got = actions.prestige(pctx);
            if (got.ok) stats.prestiges++;
        }
        if (pctx.s.points > 0) {
            const choices = pstate.rewardChoices(pctx.s);
            if (choices.length) actions.spendPoint(pctx, { reward: choices[0].value });
        }
    }

    const endBalance = actions.balanceOf(profile);
    const s = pstate.cubeState(profile);

    // --- the invariant -------------------------------------------------------
    const ledger = s.totalWon - s.totalLost - s.totalSpent;
    const actual = endBalance - startBalance;

    console.log(`\n${label}`);
    console.log(`  ${stats.runs} runs · ${stats.throws} throws · ${stats.banks} banked · ${stats.busts} bust`);
    console.log(`  ties ${stats.ties} (${stats.bribes} bought) · rerolls ${stats.rerolls} · ratts ${stats.ratts} · prestiges ${stats.prestiges}`);
    console.log(`  ledger  won ${s.totalWon} - lost ${s.totalLost} - spent ${s.totalSpent} = ${ledger}`);
    console.log(`  balance moved ${actual}`);

    const problems = [];
    if (ledger !== actual) problems.push(`ledger says ${ledger}, balance moved ${actual} (out by ${actual - ledger})`);
    if (Object.keys(db.ch.cube.ladders).length) {
        problems.push(`${Object.keys(db.ch.cube.ladders).length} ladder(s) left behind`);
    }
    return problems;
};

// ---------------------------------------------------------------------------
// The stake can never exceed the purse
// ---------------------------------------------------------------------------
//
// `startRun` has always checked the balance before it charges, so this was never a currency bug — but
// `setStake` checked only the prestige ceiling, which let a stake be *stored* at any value the ceiling
// allowed however little was in the purse. The symptom was a board that accepted 📀1,000,000 against a
// balance of 📀5,000, reported it as unclamped, and then refused to play it.
//
// Both halves are asserted here: that the write path says no, and that the charge path still says no for
// a stake stored before it did — a legacy profile cannot be fixed by a validation added later.
const stakeGuards = function () {
    const problems = [];
    const check = function (label, got, want) {
        if (JSON.stringify(got) !== JSON.stringify(want)) {
            problems.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
        }
    };

    // `balance` is set by moving `truguts_spent`, which is how a real profile gets poor.
    const at = function (balance, stake) {
        const world = makeWorld([]);
        world.profile.truguts_earned = balance;
        world.profile.truguts_spent = 0;
        world.profile.cube.stake = stake;
        const moved = [];
        const ctx = () => ({
            db: world.db,
            database: world.database,
            profile: world.profile,
            profileRef: world.database.ref('users/KEY/random'),
            discordId: ME,
            s: pstate.cubeState(world.profile),
            moveTruguts: makeMoveTruguts(world.profile, moved),
        });
        return { world, ctx, moved };
    };

    {
        const { ctx, world } = at(5000, 1000);
        const out = actions.setStake(ctx(), { stake: 1000000 });
        check('setStake over the purse is refused', out.code, 'insufficient');
        check('and does not store it', world.profile.cube.stake, 1000);
    }
    {
        // Over the ceiling but inside the purse: still a silent clamp, which is the case that must not
        // regress into a refusal.
        const { ctx } = at(10 ** 12, 1000);
        const out = actions.setStake(ctx(), { stake: 10 ** 9 });
        check('setStake over the ceiling still clamps', [out.ok, out.clamped], [true, true]);
    }
    {
        const { ctx } = at(5000, 1000);
        const out = actions.setStake(ctx(), { stake: 5000 });
        check('a stake of exactly the purse is allowed', [out.ok, out.stake], [true, 5000]);
    }
    {
        // A stake stored while rich, with the purse spent down afterwards. Nothing re-clamps it, so the
        // charge path is the only thing standing between it and an overdraft.
        const { ctx, moved } = at(5000, 500000);
        const out = actions.startRun(ctx(), { call: 'red' });
        check('startRun refuses a stored stake over the purse', out.code, 'insufficient');
        check('and withdraws nothing', moved, []);
    }
    {
        const { ctx, moved } = at(5000, 5000);
        const out = actions.startRun(ctx(), { call: 'red' });
        check('startRun allows a stake of exactly the purse', [out.ok, out.staked], [true, 5000]);
        check('and withdraws exactly that', moved, [{ t: 'w', n: 5000 }]);
    }

    console.log(`\nStake guards: ${problems.length ? `${problems.length} failed` : 'the stake can never exceed the purse'}`);
    return problems;
};

(async () => {
    const all = [];
    all.push(...stakeGuards());
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
