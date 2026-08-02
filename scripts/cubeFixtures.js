// Dumps real roll responses to JSON, for the Activity to animate without staking anything.
//
// The reveal is the part of the client that most needs iterating on and the part that is most
// expensive to trigger: every roll costs truguts and most of them are a plain win or a plain bust.
// So this plays against a throwaway player until it has caught one of each interesting shape, and
// writes them out in exactly the form `/cube/roll` returns.
//
// Generated rather than hand-written on purpose. A hand-written fixture drifts from the API the
// first time a field is added, and then the animation is being built against something that no
// longer exists.
//
//   node scripts/cubeFixtures.js [outFile]

const fs = require('fs');
const path = require('path');

const actions = require('../src/game/cube/actions.js');
const engine = require('../src/game/cube/engine.js');
const pstate = require('../src/game/cube/state.js');
const persist = require('../src/game/cube/persist.js');
const { SPECIALS } = require('../src/game/cube/tuning.js');

const OUT = process.argv[2]
    || path.join(__dirname, '..', '..', 'junkyard', 'src', 'activity', 'fixtures.json');

const ALL = SPECIALS.map(s => s.id);
const ME = 'fixture-player';

// A world that exists only in this process.
const makeWorld = function ({ bribe = true } = {}) {
    const profile = {
        name: 'Fixtures',
        truguts_earned: 1000000000,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 4, unlocked: 4, clears: 0, slots: ALL.length, stake: 1000,
            cubes: Object.fromEntries(ALL.map(id => [id, true])),
            equipped: ALL, buyReroll: true, bribe, nudge: true,
        },
    };
    const db = { user: { K: { random: profile, discordID: ME } }, ch: { cube: { pot: 180000000, ladders: {} } } };
    const remote = { pot: db.ch.cube.pot };
    const ref = p => ({
        child: c => ref(`${p}/${c}`),
        update: (v) => { Object.assign(profile.cube, v); return Promise.resolve(); },
        set: (v) => {
            const m = p.match(/ladders\/(.+)$/);
            if (m) db.ch.cube.ladders[m[1]] = v;
            return Promise.resolve();
        },
        remove: () => {
            const m = p.match(/ladders\/(.+)$/);
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
    persist.addToPot = (d, mirror, amount) => {
        const add = Math.floor(amount);
        remote.pot = Math.max(0, remote.pot + add);
        mirror.ch.cube.pot = Math.max(0, (mirror.ch.cube.pot || 0) + add);
    };
    const moveTruguts = ({ transaction, amount }) => {
        const n = Math.floor(Number(amount) || 0);
        if (transaction === 'w') profile.truguts_spent += n;
        if (transaction === 'd') profile.truguts_earned += n;
        if (transaction === 'r') profile.truguts_spent -= n;
    };
    const ctxOf = () => ({
        db, database, profile, profileRef: database.ref('users/K/random'),
        discordId: ME, s: pstate.cubeState(profile), moveTruguts,
    });
    return { db, database, profile, ctxOf };
};

// The same shape `src/api/cube.js` builds. Kept deliberately close to it — if the two drift, the
// animation is being written against a response that never arrives.
const responseOf = (thrown, settled) => ({
    thrown: thrown.rolled,
    line: thrown.res.faceIds,
    steps: thrown.res.steps,
    notes: thrown.res.notes,
    pays: engine.multSteps(thrown.opening, thrown.res.pays, settled ? settled.majority : null),
    level: thrown.run.level,
    call: thrown.run.call,
    stake: thrown.run.stake,
    opening: thrown.opening,
    breaker: thrown.breaker,
    ended: thrown.res.ended,
    ...(settled ? { settled } : {}),
});

// What makes a roll worth keeping. First one of each wins, so the file stays small and every
// entry is a distinct beat to animate.
const WANTED = {
    plainWin: r => r.settled?.outcome === 'live' && !r.steps.length && !r.pays.length,
    plainBust: r => r.settled?.outcome === 'bust' && r.settled.reason === 'bust' && !r.steps.length,
    effects: r => r.steps.length >= 3,
    manyEffects: r => r.steps.length >= 6,
    paying: r => r.pays.length >= 3,
    ratts: r => r.settled?.reason === 'ratts',
    shattered: r => r.settled?.shattered?.length >= 1,
    tieBroken: r => !!r.breaker,
    tieAsking: r => !r.settled,
    longLine: r => r.line.length >= 14,
    pure: r => r.settled?.pure,
    cackle: r => r.settled?.reason === 'cackle',
    banked: r => r.settled?.outcome === 'bank',
};

const sweep = async function (found, opts, budget) {
    const world = makeWorld(opts);
    let attempts = 0;

    while (Object.keys(found).length < Object.keys(WANTED).length && attempts < budget) {
        attempts++;
        persist.clearLadder(world.database, world.db, ME);
        const started = actions.startRun(world.ctxOf(), { call: attempts % 2 ? 'red' : 'blue' });
        if (!started.ok) break;
        let run = started.run;

        for (let lv = 0; lv < 6; lv++) {
            const ctx = world.ctxOf();
            const thrown = actions.throwLevel(ctx, run);
            let response;
            if (thrown.asking) {
                actions.parkTie(ctx, thrown);
                response = responseOf(thrown, null);
                persist.clearLadder(world.database, world.db, ME);
            } else {
                const settled = await actions.settleThrow(ctx, { thrown });
                response = responseOf(thrown, settled);
            }

            for (const [name, test] of Object.entries(WANTED)) {
                if (!found[name] && test(response)) found[name] = response;
            }

            if (!response.settled || response.settled.outcome !== 'live') break;
            const pushed = actions.pushRun(world.ctxOf(), { call: attempts % 3 ? 'blue' : 'red' });
            if (!pushed.ok) break;
            run = pushed.run;
        }
    }
    return attempts;
};

(async () => {
    const found = {};
    // Most shapes come out of a fully-equipped player who owns everything.
    let attempts = await sweep(found, {}, 300000);
    // Except a tie Watto actually *breaks*: owning Bribe means he asks instead of rolling, so the
    // only way to see his cube land is a player who cannot buy the tie off him.
    if (!found.tieBroken) attempts += await sweep(found, { bribe: false }, 100000);

    const missing = Object.keys(WANTED).filter(k => !found[k]);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(found, null, 2)}\n`);

    console.error(`${Object.keys(found).length}/${Object.keys(WANTED).length} shapes in ${attempts} runs`);
    Object.entries(found).forEach(([k, v]) => console.error(
        `  ${k.padEnd(12)} ${String(v.line.length).padStart(3)} cubes · ${String(v.steps.length).padStart(2)} effects `
        + `· ${String(v.pays.length).padStart(2)} pays · ${v.settled ? v.settled.outcome : 'tie pending'}`,
    ));
    if (missing.length) console.error(`  not found: ${missing.join(', ')}`);
    console.error(`\nwritten to ${OUT}`);
})();
