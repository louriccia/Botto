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
// `unlocked` is a parameter because the road made it one. A collapsed road (4) is where nearly every
// shape comes from — the deepest levels, the longest lines, the fullest rack — but it has no gaps
// left in it, so nothing rolled on it can ever fill one. `opened` needs a road with Agains still
// standing, which is a different starting profile rather than a rarer roll.
// `rack` is a parameter for the same reason `unlocked` is. Everything interesting about a *line*
// comes off a player fielding a full table — but four of those cubes carry a mine, so that rack
// rarely survives more than a rung or two, and the shapes that need a long unbroken run of wins
// (`overtime`, six rungs deep) never turn up on it at any budget. A bare ladder is a clean 50/50 a
// rung, which is 1-in-64 rather than never.
// The table holds `bagSize()`, so `rack` longer than that is cut on read — see `rackAt`, which is how
// the sweep still reaches every cube.
const makeWorld = function ({ bribe = true, unlocked = 4, rack = ALL } = {}) {
    const profile = {
        name: 'Fixtures',
        truguts_earned: 1000000000,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            // No `slots`: the cap is `bagSize()` for every rack and `cubeState` applies it on read,
            // so a `rack` longer than the bag is fielded as its first eight and the rest is benched.
            prestige: 4, unlocked, clears: 0, stake: 1000,
            cubes: Object.fromEntries(rack.map(id => [id, true])),
            equipped: rack, buyReroll: true, bribe, nudge: true,
        },
    };
    const db = { user: { K: { random: profile, discordID: ME } }, ch: { cube: { ladders: {} } } };
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
    });
    const database = { ref };
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
    // Ice and scorch marks, index for index against the line beside them. Two copies because the two
    // lines disagree and the difference is the beat — a scorch applied this rung is on the resolved
    // line and not on the throw. Mirrors `rollResponse` in `src/api/cube.js`; a field missing here is
    // a field the replayed fixture cannot draw, which is what this whole shape is written against.
    thrownState: thrown.rolledState,
    line: thrown.res.faceIds,
    frozen: thrown.res.frozen,
    burned: thrown.res.burned,
    cubeIds: thrown.res.cubeIds,
    // `charred` and `holds` complete the set against `rollResponse`: which positions landed on a face
    // the fire had already taken, and how many cubes each one is carrying off the line.
    charred: thrown.res.charred,
    holds: thrown.res.holds,
    steps: thrown.res.steps,
    notes: thrown.res.notes,
    pays: engine.multSteps(thrown.opening, thrown.res.pays, settled ? settled.majority : null),
    level: thrown.run.level,
    // Which rung this was, mirroring `rollResponse` in `src/api/cube.js` — this shape *is* that
    // shape, and a field missing here is a field the replayed fixture cannot draw.
    kind: thrown.kind,
    again: thrown.run.again || 0,
    call: thrown.run.call,
    stake: thrown.run.stake,
    opening: thrown.opening,
    breaker: thrown.breaker,
    rerolls: thrown.res.rerolls,
    shortcuts: thrown.res.shortcuts,
    ended: thrown.res.ended,
    held: thrown.res.held,
    overflow: thrown.res.overflow,
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
    // **The runaway.** Copies act, so a Mirror and a Binder on the same rack draw lines that spawn
    // faster than they resolve, and the engine gives up at `overflowAt` — the longest line and the
    // longest run of frames the client will ever be asked to draw, by a wide margin. It wants the two
    // cubes in the same eight, which the rotating rack only sometimes gives it, so this is one of the
    // entries a sweep can legitimately come back without.
    overflow: r => r.settled?.reason === 'overflow',
    shattered: r => r.settled?.shattered?.length >= 1,
    tieBroken: r => !!r.breaker,
    // A tie he breaks that also has something waiting on the answer: a Multiplier naming a side, or a
    // Shortcut. Those labels are held back until his cube lands, so this is the only shape that exercises
    // the second half of the count — with plain `tieBroken` there is nothing to hold and the walk looks
    // no different from any other.
    tieBrokenHeld: r => !!r.breaker && ((r.pays || []).some(p => p.note?.side) || r.shortcuts > 0),
    tieAsking: r => !r.settled,
    longLine: r => r.line.length >= 14,
    pure: r => r.settled?.pure,
    cackle: r => r.settled?.reason === 'cackle',
    // A run that opened a level mid-roll: two more cubes onto the table and the standing pushing
    // straight into it. This slot used to be `banked`, a throw that settled as a bank — which the
    // route retired, because nothing force-banks any more and a win is always `live`. The frame
    // worth capturing on that rung is the unlock, not the ending that used to follow it.
    opened: r => r.settled?.opened != null,
    // Rolling past Level 5, where an Again clears nothing and pays +1 against a base of 32. Its own
    // fixture because it is the one rung the client draws with an `Again ×n` counter and no road
    // movement at all — everything else on screen is inert, which is easy to get wrong twice.
    overtime: r => r.again > 0 && r.level >= 4,
    // A banked reroll with its face still on the line, so the walk's `+1 reroll` has a cube to come
    // off. Nothing in the set had one, which meant the one readout with two sources was the one
    // nothing could animate.
    reroll: r => r.rerolls > 0 && r.line.includes('reroll'),
    // A reroll banked by a face the line no longer shows — written over in the second pass, or paid by
    // a copy that was never thrown. The stock moves with no cube under it, which is the only shape
    // that exercises counting it off the middle of the row instead.
    orphanReroll: r => r.rerolls > r.line.filter(id => id === 'reroll').length,
    // Two clears banked off one line, which only a copied Shortcut can produce. The road has to
    // collapse by as many pips as the ladder took, and neither number is countable off the line — so
    // this is the only shape that catches the count walk paying per face instead of per clear. It
    // needs a gapped road: a collapsed one has no clear to pay, which is the other half of the shape
    // and the one every other Shortcut in the file already shows.
    shortcutPair: r => r.shortcuts >= 2 && r.settled?.extra?.length >= 2,
    // The other end of it: a won line whose Shortcuts the ladder had no room for, which is what a
    // collapsed road does to every one of them. The labels have to come off the total or this pays
    // clears that were never banked.
    shortcutSpent: r => r.shortcuts >= 1 && r.settled?.won && !r.settled.extra?.length,

    // A mine stopped by a Gungan Shield: the run survives with Ratts still sitting on the line, which is
    // the one shape where his presence and the verdict disagree. Nothing else in the set exercises the
    // `blocked` label, the `Blocked!` pop, or a count walk that has to carry on past him.
    shielded: r => r.steps.some(s => s.note?.kind === 'end.shielded') && r.settled?.reason !== 'ratts',
    // The other half of the shield: a wipeout beside it that didn't shatter. It is the frequent case and
    // the reason the cube isn't dead weight, and it is a step whose line doesn't change length.
    shieldHeld: r => r.steps.some(s => s.note?.kind === 'broken.saved')
        || r.notes.some(n => n.kind === 'broken.saved'),
    // The Pit Droid handing over a cube out of the bag. Mid-line rather than at the tail if the sweep
    // finds one, since that is the case the stated `born` exists for.
    drawn: r => r.steps.some(s => s.note?.kind === 'draw'),
    drawnSpecial: r => r.steps.some(s => s.note?.kind === 'draw' && s.note.special),
    // Order 66. The largest single change to a line in the game — every special off the table at once.
    purge: r => r.steps.some(s => s.note?.kind === 'purge'),
    // Sebulba burning a cube over to the call, and the no-op that says he pointed at one already on your
    // side. Two entries because the second is half of what the cube does and shows nothing at all.
    engine: r => r.steps.some(s => s.note?.kind === 'engine'),
    engineIdle: r => r.notes.some(n => n.kind === 'engine.already' || n.kind === 'engine.nothing'),
    // A Boost Cube paying, which is the only pay whose amount is a function of the line it stood on —
    // so it is the only one where the walk's number cannot be predicted from the face.
    //
    // Matched on `note.kind`, because `pays` here is `multSteps` output rather than the engine's raw
    // pay walk: the entries are `{ at, paid, note, multiple }` and there is no top-level `kind` to test.
    boost: r => (r.pays || []).some(p => p.note?.kind === 'pay.boost'),

    // -----------------------------------------------------------------------
    // The Planet Octahedron
    // -----------------------------------------------------------------------
    //
    // **A face with no fixture is a face nobody ever watches.** This list had nothing for any of the
    // eight, which is precisely how the Activity shipped a build where every one of them fired and
    // said nothing: there was no roll on file that would have shown it. One shape per face, because
    // each is a different beat and half of them are beats nothing else in the game makes.
    //
    // Matched on the note kind rather than on the face id, so a face that took its turn and found
    // nothing to do — `jail.nothing`, `scorch.nothing` — is not mistaken for one that worked.
    octaFreeze: r => r.steps.some(s => s.note?.kind === 'freeze'),
    octaScorch: r => r.steps.some(s => s.note?.kind === 'scorch'),
    octaJail: r => r.steps.some(s => s.note?.kind === 'jail'),
    octaPlunge: r => r.steps.some(s => s.note?.kind === 'plunge'),
    // The two that change what a *button* does rather than what the line does. They are the only
    // fixtures in the file whose whole point is the frame after the roll, so the client has something
    // to build the struck-through call and the struck-through bank against.
    octaSealed: r => !!r.settled?.sealed,
    octaLocked: r => !!r.settled?.locked,
    // A tie won outright, which draws with no cube of Watto's on screen at all — the one tie in the
    // game that resolves without his.
    octaBoonta: r => r.steps.some(s => s.note?.kind === 'boonta'),
    // The die's only payer, on the count walk, where its number is a function of the rung rather than
    // of the face. Same reason `boost` earns its own entry.
    octaSeam: r => (r.pays || []).some(p => p.note?.kind === 'pay.seam'),
    // The ice absorbing an effect — the pairing that makes Ando Prime and Baroonda one mechanic
    // pointed two ways, and a step whose line does not change length.
    octaIced: r => r.steps.some(s => s.note?.kind?.endsWith('.iced'))
        || r.notes.some(n => n.kind?.endsWith('.iced')),
    // A hold emptying because the cube carrying it was destroyed — the prison or the sandcrawler,
    // which are one mechanic now. It gets a frame of its own with `at: -1`, so it exercises both the
    // arrival animation and the path where a note names a cube that is no longer on the line.
    octaJailbreak: r => r.notes.some(n => n.kind === 'hold.break'),
    // The other half of the same rule: a jailer letting one out on its own turn, whatever it rolled.
    octaParole: r => r.notes.some(n => n.kind === 'parole'),
    // **The two that show what the last rung did rather than what this one is doing**, and the only
    // fixtures in the file that exist for a *cube's* state instead of a roll's.
    //
    // `octaFreeze` catches the roll where Ando Prime casts the ice; the frost is on the roll
    // *after*, because the freeze reaches forward. Same for a scorch, which is permanent — the burn
    // happens once and the mark is on every throw from then on. Without these two the client has
    // fixtures for both effects firing and none for either being visible.
    octaIce: r => (r.thrownState?.frozen || []).some(Boolean),
    octaBurnt: r => (r.thrownState?.burned || []).some(b => b.length),
};

// **Eight seats, more cubes than that.** A rack fields `bagSize()`, so no single loadout can put
// every cube on the table any more — a sweep pinned to one of them would never see a Pit Droid draw
// or an Octahedron face, and those shapes would silently drop out of the fixture file.
//
// So the rack **rotates**: a different eight every attempt, stepping a whole rack at a time, which
// covers all of them in `⌈cubes ÷ seats⌉` attempts and then comes round again. Ownership is still the
// full list — it is only the table that rotates.
const rackAt = function (i) {
    const seats = engine.bagSize();
    return Array.from({ length: Math.min(seats, ALL.length) },
        (_, k) => ALL[((i * seats) + k) % ALL.length]);
};

const sweep = async function (found, opts, budget) {
    // A pass that names its own rack — the bare ladder — gets exactly what it asked for and one world
    // for the whole pass. Everything else rotates, so the world is rebuilt per attempt.
    const fixed = opts.rack !== undefined ? makeWorld(opts) : null;
    let attempts = 0;

    while (Object.keys(found).length < Object.keys(WANTED).length && attempts < budget) {
        attempts++;
        const world = fixed || makeWorld({ ...opts, rack: rackAt(attempts) });
        persist.clearLadder(world.database, world.db, ME);
        const started = actions.startRun(world.ctxOf(), { call: attempts % 2 ? 'red' : 'blue' });
        if (!started.ok) break;
        let run = started.run;

        // Rungs, not levels — the road is longer than the ladder and there is no rung at which the
        // game stops offering another. Eighteen covers a full prestige-4 road (5 levels + 4 gaps of
        // 3) with room for a few Agains past the top, which is where `overtime` comes from. It is a
        // budget rather than a rule: nothing here should ever hit it, because surviving eighteen
        // coin flips is one run in 260,000.
        for (let lv = 0; lv < 18; lv++) {
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
            // **Aquilaris seals the side just called**, and `pushRun` refuses it. Breaking on that
            // would end the climb early on every roll the vault came up — which quietly shortens the
            // runs the deep shapes need, and those are exactly the shapes that are hardest to catch.
            // Switching is what the face is for and it costs nothing, so the sweep switches.
            let want = attempts % 3 ? 'blue' : 'red';
            if (response.settled.sealed === want) want = want === 'blue' ? 'red' : 'blue';
            const pushed = actions.pushRun(world.ctxOf(), { call: want });
            if (!pushed.ok) break;
            run = pushed.run;
        }
    }
    return attempts;
};

(async () => {
    const found = {};
    // Most shapes come out of a player who owns everything, fielding a full table — a different eight
    // of them each attempt, so every cube gets its turn on the table within a few runs of the start.
    let attempts = await sweep(found, {}, 300000);
    // Except a tie Watto actually *breaks*: owning Bribe means he asks instead of rolling, so the
    // only way to see his cube land is a player who cannot buy the tie off him. Both breaker shapes come
    // from that pass, so it runs while either is still missing rather than only for the first.
    if (!found.tieBroken || !found.tieBrokenHeld) {
        attempts += await sweep(found, { bribe: false }, 300000);
    }
    // One more pass for whatever is still missing. Several shapes are rare enough that a fixed budget
    // catches them only sometimes — `orphanReroll` wants a reroll face written off the line by a second
    // pass — and a regeneration that quietly drops an entry the last one had is a coverage loss nobody
    // notices until the animation it was for is being changed.
    // A road with gaps still in it, for the shapes a collapsed one cannot produce — `opened` above
    // all, which needs a level left to open.
    if (Object.keys(WANTED).some(k => !found[k])) {
        attempts += await sweep(found, { unlocked: 0 }, 300000);
    }
    // A bare ladder, for the shapes that need a long unbroken run rather than an exotic line.
    if (Object.keys(WANTED).some(k => !found[k])) {
        attempts += await sweep(found, { rack: [] }, 200000);
    }
    if (Object.keys(WANTED).some(k => !found[k])) {
        attempts += await sweep(found, {}, 600000);
    }

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
