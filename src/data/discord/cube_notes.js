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
const SAY = {
    end: () => '**the run ends here.**',
    wild: n => `landed on ${chip(n.side)}.`,
    side: n => `came up ${chip(n.side)}.`,
    greed: n => `payout **+${n.bonus}×**.`,
    mult: n => `**+${n.bonus}×** if ${SIDES[n.side].toLowerCase()} wins.`,
    shortcut: () => 'a free clear, if you win the level.',
    reroll: () => '**+1 reroll** banked.',

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
    'raze.nothing': () => 'nothing beside it.',
    raze: n => `destroyed the cube${n.both ? 's either side' : ' beside it'}.`,
    'pair.noroom': () => 'no room for a pair.',
    pair: n => `slipped ${chip(n.side)} and ${chip(OTHER[n.side])} in either side of it.`,
    'twins.noroom': () => 'no room for twins.',
    twins: n => `slipped twin ${chip(n.side)} in either side of it.`,

    // Phase two of the reveal. Past tense, because by the time these are drawn the roll knows
    // whether the side a Multiplier named is the side that won.
    'pay.greed': n => `payout **+${n.bonus}×**.`,
    'pay.won': n => `${chip(n.side)} took it: **+${n.bonus}×**.`,
    'pay.lost': n => `${chip(n.side)} didn't win. **No bonus.**`,
};

// One note as a line of prose. Null in, null out — a face that changed nothing has no note, and
// the reveal passes that straight through.
const renderNote = function (n) {
    if (!n) return null;
    const say = SAY[n.kind];
    return say ? `${label(n)} — ${say(n)}` : label(n);
};
exports.renderNote = renderNote;

exports.renderNotes = notes => (notes || []).map(renderNote);

// Exported so the reward menu can quote the same numbers the tuning holds, rather than a copy.
exports.config = config;
