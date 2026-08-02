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
    ch: { cube: { pot: 123456, ladders: {} } },
};

// Records writes instead of performing them, so nothing here can touch the real database.
const writes = [];
const fakeRef = path => ({
    path,
    child: c => fakeRef(`${path}/${c}`),
    update: (v) => { writes.push({ op: 'update', path, value: v }); return Promise.resolve(); },
    set: (v) => { writes.push({ op: 'set', path, value: v }); return Promise.resolve(); },
    remove: () => { writes.push({ op: 'remove', path }); return Promise.resolve(); },
    transaction: (fn) => {
        const next = fn(db.ch.cube.pot);
        return Promise.resolve({ snapshot: { val: () => (next === undefined ? db.ch.cube.pot : next) } });
    },
});
const database = { ref: fakeRef };

const { createApi } = require('../src/api/index.js');

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
    check('pot is reported', board?.pot === 123456, `got ${board?.pot}`);
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
        r.status === 200 && r.json.levels?.length === 5 && r.json.specials?.length === 10,
        `${r.status} levels=${r.json?.levels?.length} specials=${r.json?.specials?.length}`);
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
    r = await call('POST', '/cube/prestige', { auth: t, body: { reward: 'slot' } });
    check('prestige refuses when not earned', r.status === 409 && r.json.code === 'not_eligible', `${r.status} ${r.text}`);

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
    check('the roll wrote a profile patch and touched the pot',
        writes.some(w => w.path.endsWith('/cube')) && writes.some(w => w.path.endsWith('/pot')),
        JSON.stringify([...new Set(writes.map(w => w.path))]));

    server.close();
    const failed = results.filter(x => !x.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
    process.exit(failed.length ? 1 : 0);
})().catch((err) => {
    console.error(err);
    if (server) server.close();
    process.exit(1);
});
