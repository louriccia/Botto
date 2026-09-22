// Proves the Tusken's shot respects the dome, and nothing else.
//
// **The Gungan Shield is a bubble, not a barricade**, and the difference is the whole of this file.
// It used to bound the cull at the nearest shield on either flank, so a Gungan cast a shadow down
// the entire line behind it. A dome does not: it encloses itself and its two neighbours, nothing
// crosses that boundary in either direction, and everything outside it is as reachable as it ever
// was. So the shot now travels *over* a dome to the far side, and cannot touch what shelters under
// one. Two consequences that look opposite and come out of the same sentence:
//
//   1. **Nothing under a dome is ever culled**, on lines built so the answer is unambiguous — the
//      sheltered positions must come through every single time, not merely usually.
//   2. **A Tusken under a dome can only shoot what is under it with him.** The wall holds him in as
//      firmly as it keeps everything else out, which is the price of standing in cover.
//
// The shield is still a target rather than a wall: it stands inside its own dome, so anything else
// under there can take it. A shield nothing could ever hit would be strictly better than one that
// can, and that cost is the reason the rule is worth having.
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
// shield, `F` for the Singe, and a `!` suffix for any of them frozen. Ice matters here — a frozen
// shield is still a shield standing in the way, and a frozen target eats the cull instead of dying to
// it.
const build = spec => spec.map(function (x) {
    const frozen = x.endsWith('!');
    const key = frozen ? x.slice(0, -1) : x;
    if (key === 'T' || key === 'S' || key === 'F') {
        const id = key === 'T' ? 'symbiont' : key === 'S' ? 'gungan' : 'octahedron';
        const sp = byId(id);
        const face = faceOf(sp, key === 'T' ? 'cull' : key === 'S' ? 'shield' : 'scorch');
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

const faceIdOf = x => (x === 'T' ? 'cull' : x === 'S' ? 'shield' : x === 'F' ? 'scorch' : `side:${x}`);

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

// Every position the shot could reach, worked out the way a player would: a shield covers itself and
// the position either side of it, **shields whose covers touch are one dome**, and two positions can
// reach each other when they stand under the same dome or both in the open.
//
// The fusing is the part worth spelling out, because it is a rule about the gap rather than about the
// shields: covers run `s - 1 .. s + 1`, so two shields join while they are at most three apart. In
// seats that is 4, 5 and 6 wide at 0, 1 and 2 cubes between them, and two separate 3-seat domes from
// the third cube on. Written here as "sort the shields, start a new dome when the gap is too wide",
// which is the sentence a player would say; the engine merges spans instead, and the two agreeing is
// the point. Deliberately not the engine's own loops — a test that computes the reach the way the
// code does proves only that the code is itself.
const reachOf = function (spec) {
    const i = spec.findIndex(x => x === 'T' || x === 'T!');
    const shield = k => spec[k] === 'S' || spec[k] === 'S!';
    const domes = [];
    for (let s = 0; s < spec.length; s++) {
        if (!shield(s)) continue;
        const last = domes[domes.length - 1];
        if (last && s - last.hi <= 3) last.hi = s;
        else domes.push({ lo: s, hi: s });
    }
    const under = k => domes.findIndex(d => k >= d.lo - 1 && k <= d.hi + 1);
    const mine = under(i);
    const seen = [];
    for (let k = 0; k < spec.length; k++) {
        if (k !== i && under(k) === mine) seen.push(k);
    }
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
    // A dome down the line. The three positions under it are safe and **the one past it is not** —
    // the case that inverts against the old rule, where everything beyond a shield was cover.
    ['red', 'T', 'blue', 'S', 'red', 'blue', 'red'],
    // The Tusken pinned against the end with a shield beside it: he is inside that dome, and the
    // shield is the only other thing under it.
    ['S', 'T'],
    // The Tusken *under* a dome. He can take the shield or the cube on its far side, and nothing in
    // the open beyond — the wall holds him in.
    ['red', 'S', 'T', 'blue', 'red'],
    // Two domes with open ground between them, and the Tusken standing in the open.
    ['S', 'red', 'blue', 'T', 'red', 'blue', 'S'],
    // Overlapping domes: the two fuse into one bubble over positions 0-3, and the Tusken standing
    // outside it reaches only the open cube past his shoulder.
    ['S', 'red', 'S', 'blue', 'T', 'red'],
    // **Two shields back to back: one 4-wide dome.** The Tusken is under it at position 3 and can
    // take anything beneath it, including both shields — and nothing in the open beyond.
    ['red', 'S', 'S', 'T', 'blue', 'red'],
    // **One cube between them: 5 wide.** Standing at the far end of the bubble, the Tusken reaches
    // straight through to the other end of it — the case the un-merged rule got wrong, where the two
    // outermost seats shared no single shield and read as walled off from each other.
    ['red', 'T', 'S', 'blue', 'S', 'red', 'blue'],
    // **Two cubes between them: 6 wide**, and every seat under it is in reach of every other.
    ['red', 'T', 'S', 'blue', 'red', 'S', 'blue', 'red'],
    // **Three cubes between them: the dome breaks in half.** One more cube than the line above and
    // the same two shields are two separate 3-seat domes again, so the Tusken under the left one is
    // shut out of the right one entirely.
    ['red', 'T', 'S', 'blue', 'red', 'blue', 'S', 'red', 'blue'],
    // **Fusing is transitive, so a third shield extends the same bubble rather than starting one.**
    // Three shields at arm's length each: the middle one is what joins the outer two, and every seat
    // from the first shield's left neighbour to the last one's right is one dome.
    ['T', 'S', 'red', 'S', 'blue', 'S', 'red'],
    // And a chain that breaks once in the middle: the first two fuse, the third is four seats past
    // and stands alone. The Tusken is in the wide one and cannot reach the lone one at all.
    ['red', 'T', 'S', 'blue', 'S', 'red', 'blue', 'blue', 'S', 'red'],
];

// **Two identical cubes side by side are one target as far as this file can see.** `shotAt` names the
// victim by walking the resolved faces against the thrown ones and stopping at the first that does not
// line up — and taking either half of an `S S` pair leaves the same line behind, so the walk reports
// the *end* of the run both times. That is a limit of reading the result, not of the reach, and it
// only shows up now because a 4-wide dome cannot be built without standing two shields together.
//
// So positions are folded into runs of the same token before they are counted: a run is one bucket,
// and it is expected to be picked as often as it has members.
const runEndIn = function (thrown, k) {
    let e = k;
    while (e + 1 < thrown.length && thrown[e + 1] === thrown[k]) e++;
    return e;
};

for (const spec of LINES) {
    const thrown = spec.map(x => (x.endsWith('!') ? x.slice(0, -1) : x));
    const want = reachOf(spec);
    // Bucket -> how many reachable positions report into it.
    const share = new Map();
    for (const k of want) {
        const r = runEndIn(thrown, k);
        share.set(r, (share.get(r) || 0) + 1);
    }
    const hits = new Map([...share.keys()].map(k => [k, 0]));
    let missed = 0;
    let shielded = 0;
    for (let n = 0; n < THROWS; n++) {
        const { at, kinds } = shotAt(spec);
        if (at === null) { missed++; continue; }
        if (kinds.includes('cull.shield')) shielded++;
        hits.set(at, (hits.get(at) || 0) + 1);
    }
    const name = spec.join(' ');

    const stray = [...hits.keys()].filter(k => !share.has(k));
    ok(`${name} — the shot never reaches under a dome`, !stray.length,
        `hit ${JSON.stringify(stray)}, reach is ${JSON.stringify(want)}`);
    ok(`${name} — nothing in reach is safe`, [...share.keys()].every(k => hits.get(k) > 0),
        `never hit ${JSON.stringify([...share.keys()].filter(k => !hits.get(k)))}`);
    // **A Tusken can now come up with nothing to shoot** — boxed in by domes he is not under, or
    // standing under one with nothing else beneath it. That is a real outcome rather than a hole in
    // the reach, so it is asserted both ways round.
    if (want.length) {
        ok(`${name} — the Tusken always hits something`, missed === 0, `${missed} throws took nothing`);
    } else {
        ok(`${name} — a Tusken with no one in reach takes nothing`, missed === THROWS,
            `${THROWS - missed} throws took something`);
    }

    // Uniform over what it can see. The tolerance is loose enough to survive the noise of a few
    // thousand throws and tight enough that a shield quietly kept out of the pool would show up.
    for (const [k, n] of share) {
        near(`${name} — position ${k} is picked evenly`, hits.get(k) / THROWS, n / want.length, 0.03);
    }

    // The shield is noted separately, so the feed can say what ate the shot rather than reporting a
    // cube going missing. Every hit on a shield must carry that note and no other hit may.
    const onShields = [...share.keys()].filter(k => spec[k] === 'S' || spec[k] === 'S!')
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
    // **The ice does not take the cull any more.** It used to, and the cube walked away thawed —
    // which made a freeze a second Malastare handed out by a face that costs nothing, and left the
    // ward table with no two destroyers agreeing on what stopped them. A freeze now holds a face and
    // nothing else; only Flamejet and Singe answer it, because fire meeting ice is the one reading
    // that is not arbitrary. One target, so there is no ambiguity about what was picked.
    const res = engine.resolveLine(build(['red!', 'T']), 'red', []);
    ok('the shot goes through the ice', res.notes.some(n => n.kind === 'cull'),
        JSON.stringify(res.notes.map(n => n.kind)));
    ok('a frozen cube that ate the cull is gone', res.faceIds.length === 1,
        JSON.stringify(res.faceIds));
}

{
    // **A frozen shield still raises its dome, and the ice adds nothing on top of it.** Cover is the
    // shield's job and the frost was never what did the stopping, so the boundary stands exactly
    // where a live one would. Two things it does not do, checked because both were once true: it no
    // longer eats the shot on the shield's own position — the ice stopped being a ward, so a Tusken
    // under the dome kills the Gungan it is sheltering with — and it does not extend cover by a
    // single position.
    //
    // The Tusken is placed **under** the dome here, because that is now the only place a shot at the
    // shield can come from. Position 0 is open ground one step outside it, and is unreachable from
    // in there: the wall holds him in as firmly as it keeps anything else out.
    const spec = ['blue', 'T', 'S!', 'red'];
    const hits = new Map();
    let iced = 0;
    let ate = 0;
    for (let n = 0; n < THROWS; n++) {
        const { at, kinds } = shotAt(spec);
        if (kinds.includes('cull.iced')) iced++;
        if (kinds.includes('cull.shield')) ate++;
        if (at !== null) hits.set(at, (hits.get(at) || 0) + 1);
    }
    ok('a Tusken under a frozen dome cannot shoot out of it', !hits.has(0),
        `position 0 was hit ${hits.get(0)} times`);
    ok('a shot at a frozen shield eats the shield', hits.get(2) > 0 && ate > 0,
        `${ate} ate the shield, ${hits.get(2) || 0} hits at position 2`);
    ok('the far side of the dome is still fair game', hits.get(3) > 0,
        JSON.stringify([...hits]));
    ok('no shot is absorbed by the ice any more', iced === 0, `${iced} went into the ice`);
    // One shot in two, over the two positions sharing the dome with him.
    near('the frozen shield is aimed at as often as anything else under it',
        (hits.get(2) || 0) / THROWS, 1 / 2, 0.03);
}

// ---------------------------------------------------------------------------
// Phase three: a dome the fire put out
// ---------------------------------------------------------------------------
//
// **A charred shield is not a shield.** The Gungan is the only cube in the game whose face does a job
// without being rolled for, so it is the only one a *partially* destructive effect can interrupt: a
// Singe burns one of its six shield faces off and chars the one it is standing on, and the cube is
// still there wearing a dead face. The engine reads the face's *kind*, which is now `charred`, so the
// dome is down for the rest of the rung — it comes back next throw, off one of the five shield faces
// the cube has left.
//
// Worth pinning down because the face *id* does not say it. `faceIdOf` still reports `shield` — the id
// is what was burnt — and only the `charred` flag beside it says the position counts for nothing. Both
// halves are asserted, because anything reading the ids alone draws a dome that is not there.
{
    const res = engine.resolveLine(build(['red', 'S', 'F', 'S', 'blue']), 'red', []);
    ok('a Singe between two shields chars both', res.notes.some(n => n.kind === 'scorch'),
        JSON.stringify(res.notes.map(n => n.kind)));
    ok('both shields are charred', res.charred[1] && res.charred[3], JSON.stringify(res.charred));
    ok('a shield face came off each of them',
        res.burned[1].includes('shield') && res.burned[3].includes('shield'),
        JSON.stringify(res.burned));
    ok('and the face id still reads as a shield',
        res.faceIds[1] === 'shield' && res.faceIds[3] === 'shield', JSON.stringify(res.faceIds));
}

{
    // The Tusken's own answer to the same thing: a charred shield projects nothing, so a cube that was
    // sheltering under it is in the open the moment the fire lands. The Singe fires before the cull —
    // `red S F T` puts the Tusken next to the Singe and outside the shield's dome, and the shield is
    // out of his reach while it stands. Charred, it is not.
    //
    // Both are long enough to be certain rather than likely: a dome that survived the fire would keep
    // position 1 out of reach every single throw, not merely most of them.
    const hits = new Map();
    for (let n = 0; n < THROWS; n++) {
        const { at } = shotAt(['red', 'S', 'F', 'T']);
        if (at !== null) hits.set(at, (hits.get(at) || 0) + 1);
    }
    ok('a charred shield no longer shelters anything', (hits.get(0) || 0) > 0,
        `the cube under the dead dome was never hit: ${JSON.stringify([...hits])}`);
    ok('and is no longer sheltered itself', (hits.get(1) || 0) > 0,
        `the charred shield was never hit: ${JSON.stringify([...hits])}`);
}

{
    // The control, and the reason the line above proves anything: the same line with the Singe swapped
    // for a plain cube keeps its dome, and the Tusken standing outside it reaches neither the shield
    // nor what is under it.
    const hits = new Map();
    for (let n = 0; n < THROWS; n++) {
        const { at } = shotAt(['red', 'S', 'blue', 'T']);
        if (at !== null) hits.set(at, (hits.get(at) || 0) + 1);
    }
    ok('an unburnt dome still shelters', !hits.has(0) && !hits.has(1),
        JSON.stringify([...hits]));
}

{
    // **A frozen shield keeps its dome, and the fire says so.** This is the case that reads as the
    // rule being broken: the Singe goes off, a neighbour visibly burns, and the shield beside it is
    // untouched and still blocking. It is correct — ice answers fire, so the freeze is spent instead
    // of the face — but the engine used to report only the positions that *did* burn, which made a
    // spent ward indistinguishable from a dome that had ignored the fire. Every other destroyer
    // suffixes its note; this one swallowed the ward in silence.
    const res = engine.resolveLine(build(['red', 'S!', 'F', 'red']), 'red', []);
    const n = res.notes.find(x => x.kind === 'scorch' || x.kind === 'scorch.spared');
    ok('the singe reports the shield it could not burn', !!n && (n.sparedAt || []).includes(1),
        JSON.stringify(res.notes));
    ok('and names the ice as what stopped it',
        !!n && n.spared[(n.sparedAt || []).indexOf(1)] === 'iced', JSON.stringify(n));
    ok('the shield is not charred', !res.charred[1], JSON.stringify(res.charred));
    ok('and lost no face', !res.burned[1].length, JSON.stringify(res.burned));
}

{
    // The same for a blessed shield, and this is the one that was actively misreported: with nothing
    // else in reach the note was `scorch.nothing` — "the fire found nothing" — on a roll that had just
    // spent the player's blessing.
    const line = build(['S', 'F']);
    line[0].slot.blessed = true;
    const res = engine.resolveLine(line, 'red', []);
    const n = res.notes.find(x => x.kind === 'scorch.spared');
    ok('a fire put out by a blessing is not a fire that found nothing',
        !!n && !res.notes.some(x => x.kind === 'scorch.nothing'),
        JSON.stringify(res.notes.map(x => x.kind)));
    ok('and it names the blessing', !!n && n.spared.includes('blessed'), JSON.stringify(n));
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
console.log(`ok - ${LINES.length} lines x ${THROWS} throws, the shot goes over a dome and never under one.`);
