// Proves the Tusken's shot has to travel, and that a shield is the only thing that stops it.
//
// The cull used to pick uniformly from every other position on the line, which made it the one
// destructive face in the game with unlimited range and no counter. It now picks out of what it can
// **see** — everything as far as the nearest live shield on either flank, that shield included — so
// the Gungan Shield reads as one sentence rather than a list of exceptions: it stops whatever would
// have to cross it, and is spent by whatever reaches its own position. That is the mine's rule
// already; this is the second face to use it.
//
// Two properties are worth measuring rather than trusting, because both are invisible in play until
// somebody loses a cube they were standing a shield in front of:
//
//   1. **Nothing behind a shield is ever culled.** Over a lot of throws, on lines built so that the
//      answer is unambiguous — the shielded positions must come through every single time, not
//      merely usually.
//   2. **The shield is a target, not a wall.** It sits inside the range it defines, so it takes the
//      shot itself at exactly the rate a uniform pick over the visible positions predicts. A shield
//      that could never be hit would be strictly better than one that can, and the cost is the
//      whole reason the rule is worth having.
//
// Faces are forced rather than rolled, the way `cubeThree.js` builds its Guide lines: the reach is a
// pure function of where the shields are standing, so a line built by hand is the only honest test
// of it.
//
//   node scripts/cubeTusken.js [throws]
//
// Read-only. It touches no database and stakes nothing.

const tuning = require('../src/game/cube/tuning.js');
const engine = require('../src/game/cube/engine.js');

const { SPECIALS } = tuning;
const THROWS = Number(process.argv[2]) || 20000;

const fail = [];
const ok = (name, cond, detail = '') => { if (!cond) fail.push(`${name}${detail ? `\n    ${detail}` : ''}`); };
const near = function (name, got, want, tol, detail = '') {
    if (Math.abs(got - want) > tol) {
        fail.push(`${name}\n    got ${got.toFixed(4)}, want ${want.toFixed(4)} +/-${tol}${detail ? `\n    ${detail}` : ''}`);
    }
};

const byId = id => SPECIALS.find(sp => sp.id === id);
const faceOf = (sp, kind) => sp.faces.find(f => f.kind === kind);

// A position is spelled by what it is: `red`/`blue` for a plain cube, `T` for the Tusken, `S` for a
// shield, and a `!` suffix for either frozen. Ice matters here — a frozen shield is still a shield
// standing in the way, and a frozen target eats the cull instead of dying to it.
const build = spec => spec.map(function (x) {
    const frozen = x.endsWith('!');
    const key = frozen ? x.slice(0, -1) : x;
    if (key === 'T' || key === 'S') {
        const id = key === 'T' ? 'symbiont' : 'gungan';
        const sp = byId(id);
        const face = faceOf(sp, key === 'T' ? 'cull' : 'shield');
        return {
            side: null,
            special: sp,
            face,
            frozen,
            slot: {
                id, burned: [], frozen: frozen ? { ...face } : null, heat: 0, hauled: false,
            },
        };
    }
    return {
        side: key, special: null, face: null, frozen, slot: engine.plainSlot(),
    };
});

const faceIdOf = x => (x === 'T' ? 'cull' : x === 'S' ? 'shield' : `side:${x}`);

// Which position the cull took, as an index into the line as thrown — found by walking the resolved
// face ids against the thrown ones and stopping at the first that does not line up, which is the
// same walk the Activity uses to point at the victim. `null` when nothing left the line.
const shotAt = function (spec) {
    const thrown = spec.map(x => (x.endsWith('!') ? x.slice(0, -1) : x));
    const res = engine.resolveLine(build(spec), 'red', []);
    const kinds = res.notes.map(n => n.kind);
    const after = res.faceIds;
    if (after.length === thrown.length) return { at: null, kinds };
    for (let i = 0; i < thrown.length; i++) {
        if (after[i] !== faceIdOf(thrown[i])) return { at: i, kinds };
    }
    return { at: thrown.length - 1, kinds };
};

// Every position the shot could reach, worked out the way a player would: walk out from the Tusken
// in both directions and stop **on** the first shield. Deliberately not the engine's own loops — a
// test that computes the reach the way the code does proves only that the code is itself.
const reachOf = function (spec) {
    const i = spec.findIndex(x => x === 'T' || x === 'T!');
    const shield = k => spec[k] === 'S' || spec[k] === 'S!';
    let first = 0;
    let last = spec.length - 1;
    for (let k = i - 1; k >= 0; k--) if (shield(k)) { first = k; break; }
    for (let k = i + 1; k < spec.length; k++) if (shield(k)) { last = k; break; }
    const seen = [];
    for (let k = first; k <= last; k++) if (k !== i) seen.push(k);
    return seen;
};

// ---------------------------------------------------------------------------
// Phase one: the reach
// ---------------------------------------------------------------------------
//
// Each line is thrown many times and every position the cull ever took is recorded. Two assertions
// per line, and they are opposite failures: a position outside the reach that was hit even once is
// the shield not working, and a position inside it that was never hit in thousands of throws is the
// reach being narrower than it should be.
const LINES = [
    // No shield anywhere: unchanged, the whole line is in range.
    ['red', 'T', 'blue', 'red', 'blue'],
    // A shield down the line. Everything up to and including it is fair game; nothing past it.
    ['red', 'T', 'blue', 'S', 'red', 'blue'],
    // The Tusken pinned against the end of the line with a shield beside it: the shield is the only
    // thing it can see, so it takes the shot every time.
    ['S', 'T'],
    ['red', 'S', 'T', 'blue', 'red'],
    // Boxed in on both flanks. Four visible positions out of six.
    ['red', 'S', 'blue', 'T', 'red', 'S', 'blue'],
    // Two shields on one side. Only the nearer one matters — the far one is already behind cover.
    ['S', 'red', 'S', 'blue', 'T', 'red'],
];

for (const spec of LINES) {
    const want = reachOf(spec);
    const hits = new Map(want.map(k => [k, 0]));
    let missed = 0;
    let shielded = 0;
    for (let n = 0; n < THROWS; n++) {
        const { at, kinds } = shotAt(spec);
        if (at === null) { missed++; continue; }
        if (kinds.includes('cull.shield')) shielded++;
        hits.set(at, (hits.get(at) || 0) + 1);
    }
    const name = spec.join(' ');

    const stray = [...hits.keys()].filter(k => !want.includes(k));
    ok(`${name} — the shot never gets past a shield`, !stray.length,
        `hit ${JSON.stringify(stray)}, reach is ${JSON.stringify(want)}`);
    ok(`${name} — nothing in the open is safe`, want.every(k => hits.get(k) > 0),
        `never hit ${JSON.stringify(want.filter(k => !hits.get(k)))}`);
    ok(`${name} — the Tusken always hits something`, missed === 0, `${missed} throws took nothing`);

    // Uniform over what it can see. The tolerance is loose enough to survive the noise of a few
    // thousand throws and tight enough that a shield quietly kept out of the pool would show up.
    for (const k of want) {
        near(`${name} — position ${k} is picked evenly`, hits.get(k) / THROWS, 1 / want.length, 0.03);
    }

    // The shield is noted separately, so the feed can say what ate the shot rather than reporting a
    // cube going missing. Every hit on a shield must carry that note and no other hit may.
    const onShields = want.filter(k => spec[k] === 'S' || spec[k] === 'S!')
        .reduce((sum, k) => sum + (hits.get(k) || 0), 0);
    ok(`${name} — a shielded hit is noted as one`, shielded === onShields,
        `${shielded} notes for ${onShields} hits on a shield`);
}

// ---------------------------------------------------------------------------
// Phase two: the two ways the shot comes to nothing
// ---------------------------------------------------------------------------
//
// Both were already true and neither should have changed, which is why they are checked here: the
// reach decides *what can be picked*, and everything that happens to the pick afterwards is
// untouched by it.

{
    // Ice takes the cull, and the cube walks away thawed. One target, so there is no ambiguity
    // about what was picked.
    const res = engine.resolveLine(build(['red!', 'T']), 'red', []);
    ok('the ice takes the cull', res.notes.some(n => n.kind === 'cull.iced'));
    ok('a cube that ate the cull is still standing', res.faceIds.length === 2,
        JSON.stringify(res.faceIds));
}

{
    // **A frozen shield is still a shield**, and the ice is not what does the stopping: it is not
    // spent by a shot that never arrives, so everything behind it comes through exactly as it does
    // behind a live one. The only difference is at the shield's own position, where the two rules
    // stack in the order they are written — the ice takes the hit first, so the shot shatters the
    // ice and the Gungan walks away thawed, still standing and still in the way. Which is the ice's
    // whole job everywhere else on the table, and this is not the place to carve an exception into
    // it: a Tusken firing at a frozen cube is a target, not a blast.
    const spec = ['red', 'T', 'blue', 'S!', 'red'];
    const hits = new Map();
    let iced = 0;
    for (let n = 0; n < THROWS; n++) {
        const { at, kinds } = shotAt(spec);
        if (kinds.includes('cull.iced')) iced++;
        if (at !== null) hits.set(at, (hits.get(at) || 0) + 1);
    }
    ok('a frozen shield stops the shot as a live one does', !hits.has(4),
        `position 4 was hit ${hits.get(4)} times`);
    ok('the open positions in front of it are still fair game', hits.get(0) > 0 && hits.get(2) > 0,
        JSON.stringify([...hits]));
    ok('a shot at a frozen shield goes into the ice', !hits.has(3) && iced > 0,
        `${iced} shattered the ice, ${hits.get(3) || 0} killed the shield`);
    // One in three shots is aimed at it — the reach is unchanged by the ice, only the outcome is.
    near('the frozen shield is aimed at as often as anything else', iced / THROWS, 1 / 3, 0.03);
}

{
    // A Tusken alone. It never culls itself, so there is nothing to take.
    const res = engine.resolveLine(build(['T']), 'red', []);
    ok('a Tusken alone takes nothing', res.notes.some(n => n.kind === 'cull.nothing'));
    ok('and is still standing', res.faceIds.length === 1, JSON.stringify(res.faceIds));
}

// ---------------------------------------------------------------------------

if (fail.length) {
    console.error(`\n${fail.length} failed:\n`);
    for (const f of fail) console.error(`  x ${f}`);
    process.exit(1);
}
console.log(`ok - ${LINES.length} lines x ${THROWS} throws, the shot stops at the shield.`);
