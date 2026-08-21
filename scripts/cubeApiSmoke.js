// Exercises the cube API without Discord, a browser, or the real bot.
//
// It builds the Express app against a **fake** mirror and a fake database ref, mints its own JWT,
// and walks every route. That covers the parts most likely to be wrong on a first run — route
// wiring, the auth gate, the collection gate, CORS, clamping, the 501s — none of which need a
// Discord app to be configured.
//
// What it deliberately does NOT cover: the OAuth code exchange, which needs a real client secret
// and a real code from the Embedded App SDK. That one gets verified in a test guild.
//
//   node scripts/cubeApiSmoke.js

process.env.CUBE_JWT_SECRET = process.env.CUBE_JWT_SECRET || 'smoke-test-secret';

const jwt = require('jsonwebtoken');

// A profile with the collection unlocked, a rack, and a balance to bet with.
const PLAYER = {
    random: {
        name: 'Smoke Tester',
        truguts_earned: 250000,
        truguts_spent: 50000,
        effects: { chance_cube: true },
        cube: { prestige: 2, unlocked: 2, clears: 1, slots: 2, stake: 4000, cubes: { wild: true, greed: true } },
    },
};
// A second player who has never collected the cube, for the lock gate.
const LOCKED = { random: { name: 'No Cube', truguts_earned: 1000, truguts_spent: 0, cube: {} } };

const db = {
    user: { KEY: PLAYER, LOCKEDKEY: LOCKED },
    ch: { cube: { ladders: {} } },
};

// Records writes instead of performing them, so nothing here can touch the real database.
const writes = [];
const fakeRef = path => ({
    path,
    child: c => fakeRef(`${path}/${c}`),
    update: (v) => { writes.push({ op: 'update', path, value: v }); return Promise.resolve(); },
    set: (v) => { writes.push({ op: 'set', path, value: v }); return Promise.resolve(); },
    remove: () => { writes.push({ op: 'remove', path }); return Promise.resolve(); },
});
const database = { ref: fakeRef };

const { createApi } = require('../src/api/index.js');
// The rules, so what the tuning route serves can be checked against the tuning rather than against a
// count written down here — which is a number that goes stale every time the rack grows.
const { LEVELS, SPECIALS, SKIN_SETS, SKIN_FREE } = require('../src/game/cube/tuning.js');
const { bagSize } = require('../src/game/cube/engine.js');

// The real one lives in a module that initialises Firebase on load. Injected here so the play
// routes can be exercised, and so this file can assert that they move the right numbers.
const moves = [];
const moveTrugutsFor = (profile) => ({ transaction, amount }) => {
    const n = Math.floor(Number(amount) || 0);
    if (transaction === 'w') profile.truguts_spent += n;
    if (transaction === 'd') profile.truguts_earned += n;
    if (transaction === 'r') profile.truguts_spent -= n;
    moves.push({ transaction, amount: n });
};

const app = createApi({ db, database, client: { isReady: () => true }, moveTrugutsFor });

const token = k => jwt.sign({ discordId: `d-${k}`, userKey: k }, process.env.CUBE_JWT_SECRET, { expiresIn: '5m' });

// ---------------------------------------------------------------------------

let server;
let base;
const call = async function (method, path, { auth, body, origin } = {}) {
    const headers = {};
    if (auth) headers.Authorization = `Bearer ${auth}`;
    if (body) headers['Content-Type'] = 'application/json';
    if (origin) headers.Origin = origin;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
};

const results = [];
const check = function (name, ok, detail) {
    results.push({ name, ok });
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n         ${detail}`}`);
};

(async () => {
    server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;

    // --- unauthenticated -----------------------------------------------------
    let r = await call('GET', '/health');
    check('health is open', r.status === 200 && r.json.ok === true, `${r.status} ${r.text}`);

    r = await call('GET', '/cube/state');
    check('state refuses without a token', r.status === 401, `${r.status} ${r.text}`);

    r = await call('GET', '/cube/state', { auth: 'not-a-jwt' });
    check('state refuses a junk token', r.status === 401, `${r.status} ${r.text}`);

    r = await call('GET', '/cube/state', { auth: jwt.sign({ discordId: 'x', userKey: 'GHOST' }, process.env.CUBE_JWT_SECRET) });
    check('state refuses an unknown player', r.status === 401, `${r.status} ${r.text}`);

    r = await call('POST', '/cube/auth/token', { body: {} });
    check('token exchange needs a code', r.status === 400 || r.status === 503, `${r.status} ${r.text}`);

    // --- the collection gate -------------------------------------------------
    r = await call('GET', '/cube/state', { auth: token('LOCKEDKEY') });
    check('locked player is refused', r.status === 403 && r.json.locked === true, `${r.status} ${r.text}`);

    // --- the board -----------------------------------------------------------
    const t = token('KEY');
    r = await call('GET', '/cube/state', { auth: t });
    const board = r.json;
    check('state returns the board', r.status === 200 && !!board?.player, `${r.status} ${r.text}`);
    check('balance is earned minus spent', board?.balance === 200000, `got ${board?.balance}`);
    check('stake ceiling follows prestige', board?.player?.maxStake === 4000, `got ${board?.player?.maxStake}`);
    check('owned cubes come back in SPECIALS order',
        JSON.stringify(board?.player?.cubes) === JSON.stringify(['wild', 'greed']),
        JSON.stringify(board?.player?.cubes));
    check('no run in progress', board?.run === null && board?.dead === null && board?.tie === null,
        JSON.stringify({ run: board?.run, dead: board?.dead, tie: board?.tie }));
    check('progress is derived server-side',
        board?.progress?.maxLevel === 4 && typeof board?.progress?.goal === 'number',
        JSON.stringify(board?.progress));

    // --- tuning --------------------------------------------------------------
    r = await call('GET', '/cube/tuning', { auth: t });
    check('tuning serves the ladder and the rack',
        r.status === 200 && r.json.levels?.length === LEVELS.length
        && r.json.specials?.length === SPECIALS.length,
        `${r.status} levels=${r.json?.levels?.length}/${LEVELS.length} `
        + `specials=${r.json?.specials?.length}/${SPECIALS.length}`);
    check('tuning serves the cosmetics shelf',
        r.json.skins?.length === SKIN_SETS.length
        && r.json.skins.every(s => s.id && s.name && Array.isArray(s.ids) && s.price > 0),
        `skins=${r.json?.skins?.length}/${SKIN_SETS.length}`);
    const leaks = JSON.stringify(r.json).match(/<a?:[a-zA-Z0-9_]+:\d+>/g);
    check('tuning carries no Discord emoji', !leaks, leaks && leaks.slice(0, 3).join(' '));

    // --- stake ---------------------------------------------------------------
    r = await call('POST', '/cube/stake', { auth: t, body: { stake: 2000 } });
    check('stake accepts a legal value', r.status === 200 && r.json.stake === 2000, `${r.status} ${r.text}`);

    r = await call('POST', '/cube/stake', { auth: t, body: { stake: 999999999 } });
    check('stake is clamped to the ceiling',
        r.status === 200 && r.json.stake === 4000 && r.json.clamped === true, `${r.status} ${r.text}`);

    r = await call('POST', '/cube/stake', { auth: t, body: { stake: 5 } });
    check('stake below the minimum is refused', r.status === 400, `${r.status} ${r.text}`);

    r = await call('POST', '/cube/stake', { auth: t, body: { stake: 'lots' } });
    check('non-numeric stake is refused', r.status === 400, `${r.status} ${r.text}`);

    // --- loadout -------------------------------------------------------------
    r = await call('POST', '/cube/loadout', { auth: t, body: { ids: ['greed', 'wild', 'mirror', 'ghost', 'wild'] } });
    check('loadout drops unowned, unknown and duplicate ids',
        r.status === 200 && JSON.stringify(r.json.equipped) === JSON.stringify(['greed', 'wild']),
        `${r.status} ${r.text}`);

    r = await call('POST', '/cube/loadout', { auth: t, body: {} });
    check('loadout needs an array', r.status === 400, `${r.status} ${r.text}`);

    // **The cap is a bad request, not a trim.** Which of the nine to drop is the decision the request
    // is making, so a list longer than the bag comes back refused rather than silently shortened —
    // checked before ownership, which is why nine junk ids are enough to trip it.
    const tooMany = Array.from({ length: bagSize() + 1 }, (_, i) => `cube${i}`);
    r = await call('POST', '/cube/loadout', { auth: t, body: { ids: tooMany } });
    check('a loadout bigger than the bag is refused',
        r.status === 400 && r.json.code === 'too_many', `${r.status} ${r.text}`);

    r = await call('POST', '/cube/loadout', { auth: t, body: { ids: ['greed', 'wild'] } });
    check('and the bag-sized one still saves',
        r.status === 200 && r.json.slots === bagSize()
        && JSON.stringify(r.json.equipped) === JSON.stringify(['greed', 'wild']),
        `${r.status} ${r.text}`);

    // --- a live run blocks the between-run settings ---------------------------
    db.ch.cube.ladders['d-KEY'] = { level: 1, stake: 1000, standing: 4000, call: 'blue' };
    r = await call('POST', '/cube/stake', { auth: t, body: { stake: 1000 } });
    check('stake is locked mid-run', r.status === 409, `${r.status} ${r.text}`);
    r = await call('POST', '/cube/loadout', { auth: t, body: { ids: ['wild'] } });
    check('rack is locked mid-run', r.status === 409, `${r.status} ${r.text}`);
    r = await call('GET', '/cube/state', { auth: t });
    check('state reports the live run', r.json?.run?.level === 1, JSON.stringify(r.json?.run));
    delete db.ch.cube.ladders['d-KEY'];

    // --- playing --------------------------------------------------------------

    r = await call('POST', '/cube/bank', { auth: t, body: {} });
    check('bank refuses with no run', r.status === 409 && r.json.code === 'no_run', `${r.status} ${r.text}`);
    r = await call('POST', '/cube/tie', { auth: t, body: {} });
    check('tie refuses with no tie', r.status === 409 && r.json.code === 'no_tie', `${r.status} ${r.text}`);
    r = await call('POST', '/cube/reroll', { auth: t, body: {} });
    check('reroll refuses with nothing dead', r.status === 409 && r.json.code === 'no_reroll', `${r.status} ${r.text}`);
    r = await call('POST', '/cube/prestige', { auth: t, body: {} });
    check('prestige refuses when not earned', r.status === 409 && r.json.code === 'not_eligible', `${r.status} ${r.text}`);
    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'cube:mirror' } });
    check('spending refuses with no points', r.status === 409 && r.json.code === 'no_points', `${r.status} ${r.text}`);

    // A real roll. Level 1 is a single plain cube, so this is a straight coin flip and the
    // response has to describe it fully either way.
    const before = PLAYER.random.truguts_earned - PLAYER.random.truguts_spent;
    const stakeNow = (await call('GET', '/cube/state', { auth: t })).json.player.stake;
    r = await call('POST', '/cube/roll', { auth: t, body: { call: 'blue' } });
    const roll = r.json;
    check('roll returns a result', r.status === 200 && !!roll?.settled, `${r.status} ${r.text}`);
    check('roll reports the thrown line', Array.isArray(roll?.thrown) && roll.thrown.length === 1,
        JSON.stringify(roll?.thrown));
    // Face ids legitimately contain a colon (`side:red`, `mult:blue`), so this looks for Discord's
    // emoji syntax specifically rather than for punctuation.
    check('roll reports abstract ids, not emoji',
        !/<a?:[a-zA-Z0-9_]+:\d+>/.test(JSON.stringify(roll || {})), JSON.stringify(roll?.line));
    check('roll carries the board with it', typeof roll?.board?.balance === 'number', JSON.stringify(roll?.board));
    // The two totals the count walk cannot derive from `line`. Both pay in the first pass and can be
    // written over in the second, so a client left to count the faces it can still see undercounts —
    // while the readout moves anyway, off the settled board, with nothing on screen to explain it.
    // Typed even at zero: to a client reading `|| 0`, a missing field and "banked none" are the same
    // answer, and this is the check that tells them apart.
    check('roll reports what it banked, not just the faces it kept',
        typeof roll?.rerolls === 'number' && typeof roll?.shortcuts === 'number',
        `rerolls ${JSON.stringify(roll?.rerolls)}, shortcuts ${JSON.stringify(roll?.shortcuts)}`);
    check('the stake left the balance',
        roll?.board?.balance === before - stakeNow + (roll?.settled?.outcome === 'bank' ? roll.settled.standing : 0),
        `balance ${roll?.board?.balance}, before ${before}, stake ${stakeNow}, outcome ${roll?.settled?.outcome}`);

    const won = roll?.settled?.outcome !== 'bust';
    if (won) {
        check('a win leaves a live run', !!roll.board.run, JSON.stringify(roll.board.run));
        r = await call('POST', '/cube/bank', { auth: t, body: {} });
        check('bank pays the standing out', r.status === 200 && r.json.standing > 0, `${r.status} ${r.text}`);
        check('bank clears the run', r.json?.board?.run === null, JSON.stringify(r.json?.board?.run));
    } else {
        check('a bust leaves no live run', roll.board.run === null, JSON.stringify(roll.board.run));
        check('a bust reports why', ['bust', 'ratts', 'cackle', 'tie'].includes(roll.settled.reason),
            roll.settled.reason);
        // Checked against the mirror, not `board.run`: a dead node also reads as no live run, so the
        // board cannot tell "cleared" from "kept on file".
        check('a bust with no reroll banked leaves no node at all',
            db.ch.cube.ladders['d-KEY'] === undefined, JSON.stringify(db.ch.cube.ladders['d-KEY']));
    }

    // Whatever happened, the ledger has to reconcile against the balance that moved.
    const st = (await call('GET', '/cube/state', { auth: t })).json;
    const ledger = st.player.totalWon - st.player.totalLost - st.player.totalSpent;
    check('the ledger reconciles with the balance', st.balance - before === ledger,
        `balance moved ${st.balance - before}, ledger says ${ledger}`);

    // --- CORS ----------------------------------------------------------------
    r = await call('OPTIONS', '/cube/state', { origin: 'https://1234567890.discordsays.com' });
    check('preflight allows the Discord proxy',
        r.status === 204 && r.headers.get('access-control-allow-origin') === 'https://1234567890.discordsays.com',
        `${r.status} ${r.headers.get('access-control-allow-origin')}`);

    r = await call('OPTIONS', '/cube/state', { origin: 'https://evil.example.com' });
    check('preflight refuses anything else', r.status === 403, `${r.status}`);

    // --- 404 -----------------------------------------------------------------
    r = await call('GET', '/cube/nope', { auth: t });
    check('unknown route answers json, not html', r.status === 404 && !!r.json?.error, `${r.status} ${r.text}`);

    // --- nothing touched the real database ------------------------------------
    // Only two subtrees are the cube's to write: the player's profile and the live-run node.
    // Anything else would mean a route reached somewhere it has no business being.
    const strayWrites = writes.filter(w =>
        !w.path.startsWith('users/') && !w.path.startsWith('challenge/cube/live'));
    check('every write went to the fake ref, in the cube\'s own subtrees', strayWrites.length === 0,
        JSON.stringify(strayWrites.map(w => w.path)));
    check('the roll wrote a profile patch', writes.some(w => w.path.endsWith('/cube')),
        JSON.stringify([...new Set(writes.map(w => w.path))]));
    // The whole cube writes to two places and one of them is the pot — it used to. There is no jar
    // now, so a bust moves nothing but the profile, which the check above already covers.
    check('a roll writes nowhere but the profile and the live run',
        writes.every(w => w.path.startsWith('users/') || w.path.startsWith('challenge/cube/live/ladders')),
        JSON.stringify([...new Set(writes.map(w => w.path))]));

    // --- a dead run is something a reroll can replay --------------------------
    //
    // Guards the field names, which are the whole contract between `settleLoss` writing this node and
    // `spendReroll` reading it back: rename one and the reroll silently replays the wrong table.
    // Seeded rather than played, because whether a real roll busts is a coin flip. Three plain cubes,
    // so the throw is an odd count and can never park on a tie.
    PLAYER.random.cube.rerolls = 1;
    db.ch.cube.ladders['d-KEY'] = {
        stake: 1000, standing: 0, level: 1, call: 'blue', mult: 0, spent: [],
        set: [0, 0, 0], bag: [0],
        faces: ['side:blue', 'side:red', 'side:blue'], roll: ['blue', 'red', 'blue'],
        reason: 'bust', dead: true,
    };
    r = await call('GET', '/cube/state', { auth: t });
    check('a dead run is reported as dead, not as live',
        r.json?.run === null && r.json?.dead?.level === 1,
        `run ${JSON.stringify(r.json?.run)}, dead ${JSON.stringify(r.json?.dead?.level)}`);

    r = await call('POST', '/cube/reroll', { auth: t, body: {} });
    check('reroll replays a dead run', r.status === 200 && Array.isArray(r.json?.thrown),
        `${r.status} ${r.text}`);
    check('reroll replays the same level', r.json?.level === 1, JSON.stringify(r.json?.level));
    check('reroll throws the stored table rather than drawing a new one',
        r.json?.thrown?.length === 3, JSON.stringify(r.json?.thrown));
    check('reroll spends the banked stock', r.json?.board?.player?.rerolls === 0,
        JSON.stringify(r.json?.board?.player?.rerolls));
    check('a spent reroll leaves nothing further to reroll',
        !r.json?.board?.dead, JSON.stringify(r.json?.board?.dead));

    // --- a held roll survives the board going away ----------------------------
    //
    // A hold is a pause in the middle of a roll, and the Activity re-mounts whenever Discord feels
    // like it. So the two halves of that are checked together: the parked line comes back on
    // `/state`, and rolling again does not walk past it. Without the second, reloading mid-hold was
    // a free reroll of any line the player did not like the look of — the rung already called and
    // already thrown, silently discarded, and the standing kept.
    //
    // Seeded onto a standing run rather than played up to one, and Swap granted outright: whether a
    // real climb reaches a rung long enough to hold on is a coin flip several times over.
    PLAYER.random.cube.shuffle = true;
    db.ch.cube.ladders['d-KEY'] = {
        stake: 1000, standing: 4000, level: 1, again: 0, call: 'blue', mult: 0, spent: [],
        set: [0, 0, 0], bag: [0, 0], jail: [], hold: [], rungs: 1, locked: false, sealed: null,
    };
    r = await call('POST', '/cube/roll', { auth: t, body: { call: 'blue' } });
    const heldRoll = r.json;
    check('a roll with a pick to spend stops with the cubes down',
        r.status === 200 && heldRoll?.held === true && Array.isArray(heldRoll?.faces),
        `${r.status} ${r.text}`);
    if (heldRoll?.held) {
        r = await call('GET', '/cube/state', { auth: t });
        check('a reloaded board is handed the hold back',
            JSON.stringify(r.json?.held?.faces) === JSON.stringify(heldRoll.faces)
            && r.json?.held?.call === heldRoll.call,
            JSON.stringify(r.json?.held));
        r = await call('POST', '/cube/roll', { auth: t, body: { call: 'red' } });
        check('a second roll cannot walk past a called line',
            r.status === 409 && r.json.code === 'roll_live', `${r.status} ${r.text}`);
        r = await call('POST', '/cube/bank', { auth: t, body: {} });
        check('nor can banking', r.status === 409 && r.json.code === 'roll_live', `${r.status} ${r.text}`);
        r = await call('POST', '/cube/held', { auth: t, body: {} });
        check('and rolling on still settles it', r.status === 200 && !r.json?.held,
            `${r.status} ${r.text}`);
        r = await call('GET', '/cube/state', { auth: t });
        check('a settled roll leaves no hold behind', r.json?.held == null,
            JSON.stringify(r.json?.held));
    }
    delete PLAYER.random.cube.shuffle;
    delete db.ch.cube.ladders['d-KEY'];

    // --- build tokens ------------------------------------------------------
    //
    // The point of a point: prestiging and picking are separate, so a player who never opens the
    // rack accumulates rather than being blocked. Seeded rather than played — reaching the top of
    // the ladder honestly is thirty-odd runs of coin flips.
    //
    // After the reroll block because it clears the ladder node, and `prestige` refuses while one
    // stands.
    delete db.ch.cube.ladders['d-KEY'];
    const atTop = () => Object.assign(PLAYER.random.cube, { unlocked: 4, clears: 5 });

    atTop();
    r = await call('POST', '/cube/prestige', { auth: t, body: {} });
    check('prestige takes no reward and banks a point',
        r.status === 200 && r.json?.points === 1, `${r.status} ${r.text}`);
    check('prestige resets the ladder', r.json?.board?.progress?.top === 0,
        JSON.stringify(r.json?.board?.progress));

    // The whole behaviour change: a second prestige with the first point unspent stacks.
    atTop();
    r = await call('POST', '/cube/prestige', { auth: t, body: {} });
    check('an unspent point does not block the next prestige',
        r.status === 200 && r.json?.points === 2, `${r.status} ${r.text}`);

    r = await call('GET', '/cube/state', { auth: t });
    check('the board carries the balance', r.json?.player?.points === 2,
        JSON.stringify(r.json?.player?.points));
    // **The rack is five trees now, so what a point buys is a frontier rather than a catalogue.**
    // Binder roots The Dealer and is on offer from the first prestige; the Mirror sits behind it and
    // is not. Asserting both halves is what makes this a test of the gate rather than of the list.
    check('the board offers the roots',
        Array.isArray(r.json?.choices) && r.json.choices.some(c => c.value === 'cube:binder'),
        JSON.stringify(r.json?.choices?.map(c => c.value)));
    check('the board withholds what is gated',
        !r.json.choices.some(c => c.value === 'cube:mirror'),
        JSON.stringify(r.json?.choices?.map(c => c.value)));
    check('every offer carries its tree and tier',
        r.json.choices.every(c => c.tree && (c.tier || c.kind === 'press')),
        JSON.stringify(r.json?.choices?.[0]));
    // The rack is finite now: no `+1 Special Cube Slot`. The cap it used to sell is still there and is
    // reported — but it is the bag, identical on every profile, and nothing on the rack moves it.
    check('the rack no longer sells a slot',
        !r.json.choices.some(c => c.value === 'slot'),
        JSON.stringify(r.json.choices.map(c => c.value)));
    check('the player carries the bag as its cap', r.json?.player?.slots === bagSize(),
        JSON.stringify(r.json?.player?.slots));

    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'slot' } });
    check('spending refuses a slot, which is no longer on the rack',
        r.status === 400 && r.json.code === 'bad_reward', `${r.status} ${r.text}`);

    // **The gate is enforced where the point is spent, not only where the menu is built.** A client
    // holding a stale list — or one that never read the tree at all — must not be able to buy past a
    // prerequisite, and this is the check that says so.
    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'cube:mirror' } });
    check('spending refuses a node whose tree has not reached it',
        r.status === 400 && r.json.code === 'bad_reward', `${r.status} ${r.text}`);

    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'cube:nope' } });
    check('spending refuses a reward that is not on the rack',
        r.status === 400 && r.json.code === 'bad_reward', `${r.status} ${r.text}`);

    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'cube:binder' } });
    check('spending a point grants a root', r.status === 200 && r.json?.points === 1,
        `${r.status} ${r.text}`);
    check('a bought cube is owned', r.json?.cubes?.includes('binder'),
        JSON.stringify(r.json?.cubes));
    // The whole reason the cap came off: a granted cube plays immediately, with no second trip to
    // the loadout screen and no second prestige to make room for it.
    check('a bought cube is on the table', r.json?.equipped?.includes('binder'),
        JSON.stringify(r.json?.equipped));
    // The point of a tree: buying the root is what puts the next one on the rack.
    check('the branch above it opens',
        r.json?.board?.choices?.some(c => c.value === 'cube:mirror'),
        JSON.stringify(r.json?.board?.choices?.map(c => c.value)));

    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'cube:mirror' } });
    check('spending the last point empties the balance',
        r.status === 200 && r.json?.points === 0, `${r.status} ${r.text}`);
    check('the node behind the gate is now owned', r.json?.cubes?.includes('mirror'),
        JSON.stringify(r.json?.cubes));

    r = await call('POST', '/cube/point', { auth: t, body: { reward: 'cube:shortcut' } });
    check('an empty balance cannot spend', r.status === 409 && r.json.code === 'no_points',
        `${r.status} ${r.text}`);

    // --- the cosmetics shelf --------------------------------------------------
    //
    // Nothing here touches a run, so it goes last: the profile is at prestige 2 with a handful of
    // cubes by now, which is exactly the state that has some of the shelf open and the rest of it
    // shut.
    const prestigeNow = (await call('GET', '/cube/state', { auth: t })).json.player.prestige;
    const openSet = SKIN_SETS.find(s => s.gate?.prestige != null && s.gate.prestige <= prestigeNow);
    const shutSet = SKIN_SETS.find(s => s.gate?.prestige != null && s.gate.prestige > prestigeNow);

    r = await call('POST', '/cube/skin', { auth: t, body: {} });
    check('a skin purchase needs an id', r.status === 400 && r.json.code === 'bad_body',
        `${r.status} ${r.text}`);

    r = await call('POST', '/cube/skin', { auth: t, body: { id: 'set:sq:chartreuse+beige' } });
    check('a set nothing answers to is a 404',
        r.status === 404 && r.json.code === 'no_such_set', `${r.status} ${r.text}`);

    // **The gate is enforced where the truguts move**, not only where the row is drawn — the same
    // thing the point-spend checks above prove about the rack.
    r = await call('POST', '/cube/skin', { auth: t, body: { id: shutSet.id } });
    check('a shut gate refuses the purchase',
        r.status === 403 && r.json.code === 'locked', `${r.status} ${r.text}`);

    const purse = () => PLAYER.random.truguts_earned - PLAYER.random.truguts_spent;
    const owed = purse();
    r = await call('POST', '/cube/skin', { auth: t, body: { id: openSet.id } });
    check('an open set sells', r.status === 200 && r.json.spent === openSet.price,
        `${r.status} ${r.text}`);
    check('and charges exactly its price', purse() === owed - openSet.price,
        `${owed} -> ${purse()}`);
    check('both halves of a pair are granted',
        openSet.ids.every(id => r.json.skins?.includes(id)), JSON.stringify(r.json.skins));
    // The board is what the client repaints from, so the purchase has to be visible on it and not
    // only in the reply that reported it.
    check('the board carries what was bought',
        openSet.ids.every(id => r.json.board?.player?.skins?.includes(id)),
        JSON.stringify(r.json.board?.player?.skins));
    // Free, and never written: a fact true of everybody has no business on one profile.
    check('the free four come with the board',
        SKIN_FREE.every(id => r.json.board?.player?.skins?.includes(id)),
        JSON.stringify(r.json.board?.player?.skins));
    const written = writes.filter(w => w.value?.skins).slice(-1)[0];
    check('and are not in what was written',
        written && SKIN_FREE.every(id => !(id in written.value.skins)),
        JSON.stringify(written?.value?.skins));

    r = await call('POST', '/cube/skin', { auth: t, body: { id: openSet.id } });
    check('a set already held is not sold twice',
        r.status === 409 && r.json.code === 'owned', `${r.status} ${r.text}`);

    // A purse that cannot cover the price is a 402 and not a negative balance, which is the same
    // refusal a bought reroll gives.
    const flag = SKIN_SETS.find(s => s.group === 'flag' && s.gate.prestige <= prestigeNow);
    const held = PLAYER.random.truguts_earned;
    PLAYER.random.truguts_earned = PLAYER.random.truguts_spent + 10;
    r = await call('POST', '/cube/skin', { auth: t, body: { id: flag.id } });
    check('a purse that cannot cover it is refused',
        r.status === 402 && r.json.code === 'insufficient', `${r.status} ${r.text}`);
    PLAYER.random.truguts_earned = held;

    server.close();
    const failed = results.filter(x => !x.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
    process.exit(failed.length ? 1 : 0);
})().catch((err) => {
    console.error(err);
    if (server) server.close();
    process.exit(1);
});
