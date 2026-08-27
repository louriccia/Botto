// Turns the engine's structured notes into the sentences the embed prints.
//
// `resolveLine` reports what each face did as data — a kind and its parameters — and this is
// Discord's answer to "say that in words". The Activity will have its own, and the two are free
// to disagree: the same `clone.destroy` can be a sentence here and an animation there.
//
// **Every kind the engine can emit has a case.** An unrecognised one renders as the cube's name
// alone rather than as `undefined`, for the same reason an unknown face draws face-down: a note
// with a word missing beats a note that throws mid-reveal.

const { SIDES, cube: config } = require('../../game/cube/tuning.js');
const { FACES, faceGlyph } = require('./cube_emoji.js');

// A side, named and coloured. The two always travel together in prose — the glyph alone is
// ambiguous in a sentence and the word alone loses the colour the whole game is about.
const chip = side => `${FACES[side]} ${SIDES[side]}`;
exports.chip = chip;

const OTHER = { blue: 'red', red: 'blue' };

// Which cube is speaking: its face as it landed, and its name.
const label = n => `${faceGlyph(n.faceId)} **${n.specialName}**`;

// What each note kind says. Keyed by the engine's kind, so adding a face means adding a line
// here and the missing-case fallback covers the gap until someone does.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const SAY = {
    // A mine, and the two sentences are the two outcomes. Unshielded it takes the whole row and the
    // run is over; shielded it takes one flank and whatever is behind the shield decides the roll.
    end: n => `**detonated** — ${n.destroyed ? `${plural(n.destroyed, 'cube')} gone` : 'nothing left'} `
        + 'and nothing standing.',
    'end.shielded': n => `**detonated** — ${plural(n.destroyed, 'cube')} gone, `
        + `stopped by ${n.shields > 1 ? 'the shields' : 'the shield'}.`,
    wild: n => `landed on ${chip(n.side)}.`,
    side: n => `came up ${chip(n.side)}.`,
    greed: n => `payout **+${n.bonus}×**.`,
    // A rate on the throw, because how much it is worth depends on a line that hasn't finished
    // changing length yet. The sum arrives on the payout walk — see `pay.boost`.
    boost: n => `**+${n.bonus}×** for every cube on the table.`,
    mult: n => `**+${n.bonus}×** if ${SIDES[n.side].toLowerCase()} wins.`,
    shortcut: () => 'a free clear, if you win the level.',
    // Hedged the same way the clear is, and for the same reason: neither is banked off a roll that
    // busts. This said "banked" outright, on a frame drawn before there was an outcome to bank against.
    reroll: () => '**+1 reroll**, if you win the level.',

    'mirror.nothing': () => 'nothing to reflect.',
    'mirror.noroom': () => 'no room to reflect.',
    mirror: n => (n.copied
        ? `reflected the ${n.copied} cube${n.copied > 1 ? 's' : ''} behind it`
          + (n.made ? `, conjuring **${n.made}** more` : '') + '.'
        : 'nothing behind it to reflect.'),
    invert: () => 'inverted every cube.',
    broken: () => 'shattered — the table is a cube shorter.',
    'burn.nothing': () => 'nothing on its right to burn.',
    burn: () => 'burned the cube on its right.',
    'clone.alone': () => 'nothing beside it.',
    'clone.destroy': () => 'nothing to copy — took the cube on its right off the table.',
    'clone.noroom': () => 'no room to copy.',
    'clone.append': n => `copied ${faceGlyph(n.srcFaceId)} onto a new cube.`,
    clone: n => `copied ${faceGlyph(n.srcFaceId)} onto the cube on its right.`,
    'cull.nothing': () => 'nothing else on the table.',
    cull: () => 'took a cube off the table.',
    // The shot has to cross the line, so a shield turns it away — and is the only thing on its
    // far side the Tusken can hit.
    'cull.shield': () => 'took the shield off the table.',
    'raze.nothing': () => 'nothing beside it.',
    raze: n => `destroyed the cube${n.both ? 's either side' : ' beside it'}.`,
    'pair.noroom': () => 'no room for a pair.',
    pair: n => `slipped ${chip(n.side)} and ${chip(OTHER[n.side])} in either side of it.`,
    'twins.noroom': () => 'no room for twins.',
    twins: n => `slipped twin ${chip(n.side)} in either side of it.`,

    // The shield's other half, and the reason it isn't dead weight on the great majority of throws that
    // have no mine anywhere near them. The cube throws again rather than merely surviving, so the second
    // half of the sentence is what it is worth now — `rolledFaceId` is absent only on a cube with no
    // other face to come up as, which nothing in the tuning is.
    'broken.saved': n => (n.rolledFaceId
        ? `held together by the shield, and came up **${faceGlyph(n.rolledFaceId)}** instead.`
        : 'held together by the shield.'),
    'draw.empty': () => 'nothing left in the bag.',
    'draw.noroom': () => 'no room for another cube.',
    draw: n => `pulled ${faceGlyph(n.faceId)} out of the bag`
        + (n.special ? ' — **a special**, and it counts on this roll.' : '.'),
    'purge.nothing': () => 'no specials on the table.',
    purge: n => `**scrapped every special on the table** — ${plural(n.destroyed, 'cube')}, itself included.`,
    'engine.nothing': n => `pointed an engine ${n.dir} at nothing.`,
    'engine.already': n => `pointed ${n.dir} — already ${chip(n.side)}.`,
    engine: n => `burned the cube on its ${n.dir} over to ${chip(n.side)}.`,

    // -----------------------------------------------------------------------
    // The Planet Octahedron
    // -----------------------------------------------------------------------
    //
    // Four of these describe something that happens **next** rung rather than this one, which is the
    // whole of what makes this cube different — so they are written in the future tense the Multiplier
    // already uses for a promise. The player reads them on the frame that fires and meets them on the
    // one after.
    'freeze.nothing': () => 'nothing beside it to freeze.',
    'freeze.already': () => 'the ice was already set.',
    freeze: n => `froze ${n.both ? 'both cubes beside it' : 'the cube beside it'} — `
        + `${n.both ? 'they hold their faces' : 'it holds its face'} next roll.`,
    'scorch.nothing': () => 'nothing beside it to burn.',
    // Names the faces it took, because which one it took is the entire value of the effect and the
    // cube it came off is about to lose it forever. **Taken off the cube, not left to land dead**: the
    // face is gone from the list, so every face still on it comes up likelier.
    scorch: n => `burned ${n.burned.map(faceGlyph).join(' ')} off `
        + `${n.both ? 'the cubes' : 'the cube'} beside it — gone for the rest of the climb.`,
    vault: n => `sealed ${chip(n.side)} — call the other way next roll.`,
    blessing: n => `**blessed ${faceGlyph(n.faceId)}** — nothing can destroy it this rung.`,
    // Past tense, unlike the Greed's flat rate, because what it pays is a function of how far the run
    // has already come and that number is settled the moment it lands.
    seam: n => `**+${n.bonus}×** for ${plural(n.rungs, 'rung')} walked.`,
    'jail.nothing': () => 'nobody left to take.',
    jail: n => `took ${plural(n.taken, 'cube')} into the cell — **${n.held}** inside, `
        + 'one out every turn it takes.',
    // The two halves of the Scavenger. Both say *hold* rather than destroyed or conjured, because
    // the difference is the whole mechanic and the line cannot show it: a cube in a hold isn't drawn.
    'haul.nothing': () => 'nothing on its right to carry off.',
    haul: n => `carried ${faceGlyph(n.faceId)} off the line — **${n.held}** in the hold.`,
    'scavenge.empty': () => 'nothing to salvage.',
    'scavenge.noroom': () => 'no room on the table.',
    scavenge: n => `salvaged ${faceGlyph(n.faceId)}`
        + (n.own ? ' out of its own hold.' : ' out of the wreckage.'),
    // The turn a captor takes whatever it is showing: one prisoner back on the line, on its right.
    parole: n => `let ${faceGlyph(n.faceId)} out`
        + (n.left ? ` — **${n.left}** still inside.` : ' — the cell is empty.'),
    // Said by the cube that was holding them, at the moment something broke it open — so the face
    // here is the one *it* was showing rather than the one that did it.
    'hold.break': n => `**broke open** — ${plural(n.freed, 'cube')} back on the table.`,
    'plunge.nothing': () => 'nothing standing at the ends.',
    plunge: n => 'the ends of the line fell away'
        + (n.self ? ' — **the die went with them**.' : '.'),
    crowd: n => `the crowd **painted ${n.painted.map(faceGlyph).join(' ')}** ${n.side}`
        + ' for the rest of the climb.',
    // No face behind it either: the table stopped resolving, which is not something a cube did.
    overflow: n => `**Memory overflow** — ${plural(n.spawned, 'cube')} on the table and still growing.`,

    // What the ice ate. Every one of these is an effect that found a frozen cube and broke against
    // it — the cube survives, thawed, and the effect is spent. They are separate kinds rather than one
    // because the sentence has to name what was stopped.
    'burn.iced': () => 'the ice took the burn.',
    'clone.iced': () => 'the ice took the copy.',
    'cull.iced': () => 'the ice took the cull.',
    'raze.iced': () => 'the ice held both sides.',
    'engine.iced': n => `pointed ${n.dir} — the ice took it.`,

    // Phase two of the reveal. Past tense, because by the time these are drawn the roll knows
    // whether the side a Multiplier named is the side that won.
    'pay.greed': n => `payout **+${n.bonus}×**.`,
    // The sum rather than the rate, and it shows its working — the number is only interesting next to
    // the count that produced it.
    'pay.boost': n => `${plural(n.positions, 'cube')} on the table: **+${n.bonus}×**.`,
    // Same shape as the Boost Cube's, and for the same reason: the amount is a function of something
    // outside the face, so the walk quotes what it counted rather than restating a fixed rate. `positions`
    // carries the rung count here, which is the only figure this cube has ever been paid off.
    'pay.seam': n => `${plural(n.positions, 'rung')} deep: **+${n.bonus}×**.`,
    'pay.won': n => `${chip(n.side)} took it: **+${n.bonus}×**.`,
    'pay.lost': n => `${chip(n.side)} didn't win. **No bonus.**`,
    // The one note about the **line** rather than about a face standing on it. It names itself, because
    // there is no cube for `label` to put in front of it — see `renderNote`.
    'pay.pure': n => `**PURE CUBE** — all ${plural(n.positions, 'cube')} came up ${chip(n.side)}: `
        + `**+${n.bonus}×**.`,
};

// One note as a line of prose. Null in, null out — a face that changed nothing has no note, and
// the reveal passes that straight through.
//
// A note that names no face is about the whole line, and it says so itself rather than being
// introduced by a cube — the pure bonus is the only one, and `label` on it would render the glyph
// for `null` in front of the word **null**.
const renderNote = function (n) {
    if (!n) return null;
    const say = SAY[n.kind];
    if (!n.faceId && !n.specialName) return say ? say(n) : null;
    return say ? `${label(n)} — ${say(n)}` : label(n);
};
exports.renderNote = renderNote;

exports.renderNotes = notes => (notes || []).map(renderNote);

// Exported so the reward menu can quote the same numbers the tuning holds, rather than a copy.
exports.config = config;
