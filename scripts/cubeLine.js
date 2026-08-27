// Proves a thrown line survives being written down and read back.
//
// The mode is about to grow two picks that stop a roll *between* the cubes landing and the effects
// firing — Premonition, which shows you one face before you call, and The Shuffle, which lets you put
// two of them the other way round. Both mean the line has to be stored and picked up in a second
// request, and both are wrong in a way nobody would notice if the pickup differs from the throw even
// slightly: the player is shown one line and settled on another.
//
// `parkTie` has stored a roll for a long time, but it stores a **resolved** one — the effects have run
// and consumed the state that makes an unresolved line awkward. This is the harder direction, so it is
// measured rather than trusted.
//
// What it asserts, over every cube in the game and a lot of throws:
//
//   1. Face for face, the rebuilt line is the thrown one — `rolledFaces` identical at every position.
//   2. Position for position, so is everything a face id cannot say: frozen, charred, the burnt faces
//      on the cube standing there, and which cube that is.
//   3. The slots come back as slots — a charred position keeps its id, a frozen one is still holding,
//      and `burned` is a list rather than the object Firebase hands back.
//   4. It survives a JSON round trip, because between the two requests it is in the database.
//
// Deliberately includes cubes mid-climb rather than only fresh ones: a scorched Turbine with heat on
// it and a frozen neighbour is the line that breaks a naive codec, and a set of untouched cubes is the
// one case that would pass no matter what.
//
//   node scripts/cubeLine.js [throws]
//
// Read-only. It touches no database and stakes nothing.

const engine = require('../src/game/cube/engine.js');
const actions = require('../src/game/cube/actions.js');
const { SPECIALS, cube: config } = require('../src/game/cube/tuning.js');

const THROWS = Number(process.argv[2]) || 20000;

const RACK = SPECIALS.filter(sp => !sp.noWeld).map(sp => sp.id);
const OCTA = SPECIALS.find(sp => sp.noWeld);

let checked = 0;
let bad = 0;
const seen = new Set();

const fail = (why, at, a, b) => {
    if (bad < 12) console.error(`FAIL  ${why} at ${at}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
    bad += 1;
};

// A set with something done to it. Half the positions are ordinary and the rest carry the three
// things a slot can be carrying — a scorched face, a held one, a stint in the Scavenger's hold.
const messySet = function (n) {
    const out = [];
    for (let i = 0; i < n; i += 1) {
        const roll = Math.random();
        if (roll < 0.15) { out.push(null); continue; }
        const id = roll < 0.2 && OCTA ? OCTA.id : RACK[Math.floor(Math.random() * RACK.length)];
        const sp = SPECIALS.find(s => s.id === id);
        const slot = { id, burned: [], painted: [], frozen: null, heat: 0, hauled: false };
        // Scorch a face or two off it, so the codec is measured on a cube the fire has been at.
        if (Math.random() < 0.35) {
            const f = sp.faces[Math.floor(Math.random() * sp.faces.length)];
            slot.burned.push(f.id);
            if (Math.random() < 0.4) slot.burned.push(f.id);
        }
        // The crowd has been at it. Marks go on by face id, one per copy, so a cube can carry two of
        // them under one id and the codec has to bring both back — a `painted` that round-trips as a
        // single mark is a cube that quietly un-fuses itself on the next reload.
        if (Math.random() < 0.3) {
            const f = sp.faces[Math.floor(Math.random() * sp.faces.length)];
            const side = Math.random() < 0.5 ? 'red' : 'blue';
            slot.painted.push(`${f.id}|${side}`);
            if (Math.random() < 0.4) slot.painted.push(`${f.id}|${side}`);
        }
        // Ando Prime is holding it on the face it was showing.
        if (Math.random() < 0.2) {
            const f = sp.faces[Math.floor(Math.random() * sp.faces.length)];
            slot.frozen = f.id;
        }
        if (Math.random() < 0.15) slot.heat = 1 + Math.floor(Math.random() * 4);
        if (Math.random() < 0.1) slot.hauled = true;
        out.push(slot);
    }
    return out;
};

for (let t = 0; t < THROWS; t += 1) {
    const set = messySet(1 + Math.floor(Math.random() * 9));
    const line = engine.throwSet(set);

    // Through JSON, because the trip this is standing in for goes through the database.
    const stored = JSON.parse(JSON.stringify(engine.encodeLine(line)));
    const back = engine.relineFrom(stored.set, stored.faces, stored.state);

    const wasF = engine.rolledFaces(line);
    const nowF = engine.rolledFaces(back);
    const wasS = engine.lineState(line);
    const nowS = engine.lineState(back);

    if (back.length !== line.length) fail('length', t, line.length, back.length);

    for (let i = 0; i < line.length; i += 1) {
        checked += 1;
        seen.add(wasF[i]);
        if (wasF[i] !== nowF[i]) fail('face', `${t}.${i}`, wasF[i], nowF[i]);
        if (wasS.frozen[i] !== nowS.frozen[i]) fail('frozen', `${t}.${i}`, wasS.frozen[i], nowS.frozen[i]);
        if (wasS.cubeIds[i] !== nowS.cubeIds[i]) fail('cube', `${t}.${i}`, wasS.cubeIds[i], nowS.cubeIds[i]);
        if (wasS.painted[i] !== nowS.painted[i]) fail('painted', `${t}.${i}`, wasS.painted[i], nowS.painted[i]);
        if (wasS.burned[i].join(',') !== nowS.burned[i].join(',')) {
            fail('burned', `${t}.${i}`, wasS.burned[i], nowS.burned[i]);
        }
        // The slot has to come back a slot, not the shape Firebase would hand back.
        const slot = back[i].slot;
        if (!slot || !Array.isArray(slot.burned)) fail('slot', `${t}.${i}`, 'a slot', slot);
        if ((line[i].slot.id || null) !== (slot.id || null)) fail('slot id', `${t}.${i}`, line[i].slot.id, slot.id);
        if ((Number(line[i].slot.heat) || 0) !== (Number(slot.heat) || 0)) {
            fail('heat', `${t}.${i}`, line[i].slot.heat, slot.heat);
        }
        if (!!line[i].slot.hauled !== !!slot.hauled) fail('hauled', `${t}.${i}`, line[i].slot.hauled, slot.hauled);
        // Every mark, in order. A `painted` that comes back one short is a cube that un-fuses itself.
        if ((line[i].slot.painted || []).join(',') !== (slot.painted || []).join(',')) {
            fail('painted marks', `${t}.${i}`, line[i].slot.painted, slot.painted);
        }
    }
}

// A codec that never met a scorched cube is a codec that hasn't been tested on one, so the coverage
// is reported rather than assumed.
const every = new Set();
for (const sp of SPECIALS) for (const f of sp.faces) every.add(f.id);
every.add(`side:${'red'}`);
every.add(`side:${'blue'}`);
const missed = [...every].filter(id => !seen.has(id));

// ---------------------------------------------------------------------------
// The same trip through the layer that actually makes it
// ---------------------------------------------------------------------------
//
// The codec above is proved against itself. This proves it against `takeThrow`, which is what a real
// roll goes through — and picks up the one thing a plain JSON trip does not: **Firebase hands an array
// back as an object**. Every list on a ladder node already goes through `Object.values` for that
// reason, and a `faces` list that forgot to would come back as `[]` and reline a table of blanks.
let picked = 0;
let wrong = 0;
for (let t = 0; t < 400; t += 1) {
    const set = messySet(2 + Math.floor(Math.random() * 8));
    const line = engine.throwSet(set);
    const shown = { ...engine.encodeLine(line), level: 2, again: 0, kind: 'level', bag: [], rungs: 1 };

    // As the database gives it back: arrays become objects keyed by index, at every depth.
    const asFirebase = v => (Array.isArray(v) ? { ...v.map(asFirebase) } : v);
    const stored = {
        ...shown,
        set: asFirebase(shown.set),
        faces: asFirebase(shown.faces),
        state: {
            frozen: asFirebase(shown.state.frozen),
            painted: asFirebase(shown.state.painted),
            cubeIds: asFirebase(shown.state.cubeIds),
            burned: asFirebase(shown.state.burned.map(asFirebase)),
        },
    };

    const live = {
        stake: 100, standing: 200, mult: 2, spent: [], jail: [], hold: [], locked: false, sealed: null,
    };
    const took = actions.takeThrow(live, stored, 'blue');
    const was = engine.rolledFaces(line);
    const now = engine.rolledFaces(took.line);
    picked += was.length;
    if (was.join('|') !== now.join('|')) {
        wrong += 1;
        if (wrong < 5) console.error(`FAIL  takeThrow at ${t}: ${was.join(',')} != ${now.join(',')}`);
    }
    if (took.run.call !== 'blue') { wrong += 1; console.error('FAIL  the call is the one handed in'); }
    if (took.run.level !== 2) { wrong += 1; console.error('FAIL  the rung is the parked one'); }
}
bad += wrong;

console.log(`throws      ${THROWS}`);
console.log(`positions   ${checked} thrown, ${picked} through takeThrow`);
console.log(`face ids    ${seen.size} of ${every.size} seen${missed.length ? ` — missed ${missed.join(', ')}` : ''}`);
console.log(`cubes       ${RACK.length} on the rack${OCTA ? ' + the die' : ''}, max line ${config.maxCubes}`);
console.log('');
console.log(bad ? `${bad} mismatches` : 'OK — every line came back exactly as it was thrown');
if (bad) process.exitCode = 1;
