// Proves The Split does exactly one thing to a held line, and that the thing it does is honest.
//
// The pick takes one welded position off the line and puts the cubes it was pressed from in its place,
// thrown live — see `splitAt` in the engine and the `splitting` branch of `alterShown`. Three of its
// properties are the kind nobody notices being wrong until a player is paid for a line they were never
// shown, so they are measured rather than trusted:
//
//   1. **Nothing else on the line moves.** Every position except the one that came apart is face for
//      face what it was, and the line grows by exactly `parents - 1`.
//   2. **The parents come back whole.** The faces they land on are drawn from their own full face lists,
//      downside faces included — which is the entire cost of the pick, and would be silently deleted by
//      a version that re-cut the weld instead of undoing it.
//   3. **The result is still a line that survives being written down**, because it is parked again
//      afterwards and settled in a later request. `cubeLine.js` proves that for a thrown line; this
//      proves it for one that has been taken apart.
//
// Then the refusals, which are the half a measurement cannot reach: a weld comes apart once a run, a
// plain cube never does, and a frozen one is held shut.
//
//   node scripts/cubeSplit.js [splits]
//
// Read-only. It touches no database and stakes nothing.

const engine = require('../src/game/cube/engine.js');
const actions = require('../src/game/cube/actions.js');
const pstate = require('../src/game/cube/state.js');
const { SPECIALS, cube: config } = require('../src/game/cube/tuning.js');

const SPLITS = Number(process.argv[2]) || 20000;

// Everything the press will take, which is everything but the die.
const RACK = SPECIALS.filter(sp => !sp.noWeld).map(sp => sp.id);
const DOWNSIDE = new Set(['end', 'broken']);

let bad = 0;
const fail = function (why, extra) {
    if (bad < 12) console.error(`FAIL  ${why}${extra ? `: ${extra}` : ''}`);
    bad += 1;
};
const check = function (ok, why, extra) {
    if (!ok) fail(why, extra);
    return ok;
};

const pick = list => list[Math.floor(Math.random() * list.length)];

// A weld of two or three cubes, cut at the top of the press so both uneven splits are in the draw.
const someWeld = function () {
    const want = Math.random() < 0.25 ? 3 : 2;
    const ids = [];
    while (ids.length < want) {
        const id = pick(RACK);
        if (!ids.includes(id)) ids.push(id);
    }
    return engine.rollWeld(ids, { tier: config.weldTiers.length });
};

// ---------------------------------------------------------------------------
// 1 & 2 — what a split does to the line, and what it puts on it
// ---------------------------------------------------------------------------

// Which faces each cube can ever land on, to test that a parent came back whole rather than as its
// half of the weld. Face **ids**, because that is what a thrown position reports.
const facesOf = function (id) {
    const sp = engine.specialById(id);
    return new Set((sp.faces || []).map(f => f.id));
};

let splits = 0;
let grew = 0;
const landed = new Map();
const inherited = new Map();

for (let t = 0; t < SPLITS; t++) {
    const weldId = someWeld();
    if (!check(!!weldId, 'the press refused a pairing at the top tier')) break;
    const parents = engine.weldParents(weldId);

    // A line with the weld somewhere in it and ordinary cubes either side, which is the shape a real
    // rung produces — the split has to be indifferent to where it lands.
    const n = 3 + Math.floor(Math.random() * 5);
    const at = Math.floor(Math.random() * n);
    const set = Array.from({ length: n }, (_, i) => (i === at ? { ...engine.plainSlot(), id: weldId } : engine.plainSlot()));
    const line = engine.relineFrom(set, set.map((slot, i) => (i === at
        ? engine.specialById(weldId).faces[0].id
        : 'side:blue')), {});

    const was = engine.rolledFaces(line);
    const parts = engine.splitAt(line, at);
    if (!check(!!parts, 'a welded position refused to come apart', weldId)) continue;
    check(parts.length === parents.length, 'the split handed back the wrong number of cubes',
        `${parts.length} for ${parents.length}`);

    const after = [...line.slice(0, at), ...parts, ...line.slice(at + 1)];
    splits += 1;
    grew += after.length - line.length;

    // 1 — the line either side of the split is untouched, and only it.
    check(after.length === line.length + parents.length - 1, 'the line grew by the wrong amount',
        `${line.length} -> ${after.length}`);
    const now = engine.rolledFaces(after);
    check(was.slice(0, at).join('|') === now.slice(0, at).join('|'),
        'a position before the split changed face', `${was.slice(0, at)} != ${now.slice(0, at)}`);
    check(was.slice(at + 1).join('|') === now.slice(at + parents.length).join('|'),
        'a position after the split changed face');

    // 2 — the cubes standing there are the parents, whole.
    const ids = parts.map(p => p.slot.id).sort();
    check(ids.join('|') === [...parents].sort().join('|'), 'the wrong cubes came out of the weld',
        `${ids} != ${parents}`);
    for (const p of parts) {
        const own = facesOf(p.slot.id);
        const id = engine.rolledFaces([p])[0];
        check(own.has(id), 'a parent landed on a face it does not carry', `${p.slot.id} -> ${id}`);
        landed.set(p.slot.id, (landed.get(p.slot.id) || 0) + 1);
        const face = (p.face && p.face.kind) || (p.side ? 'side' : null);
        if (DOWNSIDE.has(face)) inherited.set(p.slot.id, (inherited.get(p.slot.id) || 0) + 1);
        // The weld's own state stays with the weld — a fresh slot, every time.
        check(!p.slot.burned.length && !p.slot.heat && !p.slot.frozen && !p.slot.hauled,
            'a parent came back carrying the weld\'s state', p.slot.id);
    }

    // 3 — and the line it leaves behind still survives a trip through the database.
    const stored = JSON.parse(JSON.stringify(engine.encodeLine(after)));
    const back = engine.relineFrom(
        engine.decodeSet(stored.set), Object.values(stored.faces || {}), stored.state || {},
    );
    check(engine.rolledFaces(back).join('|') === now.join('|'),
        'a split line did not come back the way it went in');
    check(back.map(c => c.slot.id || 0).join('|') === after.map(c => c.slot.id || 0).join('|'),
        'a split line came back holding different cubes');
}

// **The downside faces are the whole cost, so their absence is a failure and not a quiet pass.** A
// parent with a mine has to be seen landing on it; if this is ever zero the split is re-cutting the
// weld rather than undoing it, and the pick is free.
const carriers = RACK.filter(id => [...facesOf(id)].some((fid) => {
    const sp = engine.specialById(id);
    return (sp.faces || []).some(f => f.id === fid && DOWNSIDE.has(f.kind));
}));
const dry = carriers.filter(id => (landed.get(id) || 0) > 60 && !inherited.get(id));
check(!dry.length, 'a parent with a downside face never once landed on one', dry.join(', '));

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

// `alterShown` wants a profile, a parked throw and somewhere to write. All three are fakes: the point
// is the branch, not the storage.
const weldId = someWeld();
const held = (function build() {
    const set = [{ ...engine.plainSlot(), id: weldId }, engine.plainSlot(), engine.plainSlot()];
    const faces = [engine.specialById(weldId).faces[0].id, 'side:blue', 'side:red'];
    return { set, line: engine.relineFrom(set, faces, {}) };
}());

const ctxWith = function (over) {
    const shown = {
        ...engine.encodeLine(held.line),
        level: 2, again: 0, kind: 'level', called: 'blue', bag: [], rungs: 1, seen: null,
    };
    const ladder = {
        stake: 100, standing: 200, mult: 2, spent: {}, jail: [], hold: [], level: 2,
        shown, ...over,
    };
    const db = { ch: { cube: { ladders: { me: ladder } } } };
    const database = { ref: () => ({ set: () => Promise.resolve(), remove: () => Promise.resolve() }) };
    const s = pstate.cubeState({
        cube: { cubes: { [weldId]: true }, split: true, pressTier: 4 },
        effects: { chance_cube: true },
    });
    return { s, db, database, discordId: 'me' };
};

const one = actions.alterShown(ctxWith({}), { split: 0 });
check(one.ok, 'a weld on a held line would not split', one.code);
check((one.can?.split || []).length === 0, 'the split was still on offer after being spent');
check(one.faces && one.faces.length === held.line.length + engine.weldParents(weldId).length - 1,
    'the held line came back the wrong length');

const twice = actions.alterShown(ctxWith({ split: true }), { split: 0 });
check(!twice.ok && twice.code === 'spent', 'a second split in one run was allowed', twice.code);

// **One change per hold**, which is a different limit from once a run and refuses with its own code: the
// run may have two picks left and this line has still had its one change. See `alterShown`.
const again = actions.alterShown(ctxWith({ shown: null }), { split: 0 });
check(!again.ok && again.code === 'nothing_shown', 'a hold with no line answered', again.code);
const altered = ctxWith({});
altered.db.ch.cube.ladders.me.shown.changed = true;
const second = actions.alterShown(altered, { split: 0 });
check(!second.ok && second.code === 'changed', 'a second change to one line was allowed', second.code);

const plain = actions.alterShown(ctxWith({}), { split: 1 });
check(!plain.ok && plain.code === 'not_a_weld', 'a plain cube was split', plain.code);

const off = actions.alterShown(ctxWith({}), { split: 99 });
check(!off.ok && off.code === 'bad_split', 'a position off the line was split', off.code);

const both = actions.alterShown(ctxWith({}), { split: 0, scrap: 1 });
check(!both.ok && both.code === 'one_thing', 'two changes went through in one request', both.code);

// Ice holds a weld shut — there is no honest answer to which parent inherits the held face.
const iced = (function build() {
    const set = [{ ...engine.plainSlot(), id: weldId, frozen: engine.specialById(weldId).faces[0].id }];
    return engine.relineFrom(set, [engine.specialById(weldId).faces[0].id], { frozen: [true] });
}());
check(!engine.canSplitAt(iced, 0), 'a frozen weld came apart');
check(engine.splitAt(iced, 0) === null, 'a frozen weld handed back cubes');

// And the offer itself: only welds, and only while it is unspent.
check(engine.canSplitAt(held.line, 0), 'the weld was not offered as splittable');
check(!engine.canSplitAt(held.line, 1), 'a plain cube was offered as splittable');

// ---------------------------------------------------------------------------

const rate = splits ? (grew / splits).toFixed(3) : '—';
console.log(`splits      ${splits} of ${SPLITS} attempted`);
console.log(`positions   +${rate} per split, averaged over two- and three-cube welds`);
console.log(`parents     ${landed.size} distinct cubes came out of a press`);
console.log(`inherited   ${[...inherited.values()].reduce((a, b) => a + b, 0)} downside faces landed on a parent`);
console.log('');
console.log(bad ? `${bad} failures` : 'OK — a split takes one cube apart and touches nothing else');
if (bad) process.exitCode = 1;
