// Compatibility shim for the Discord embed.
//
// The chance cube's rules and tuning now live in `src/game/cube/tuning.js`, which names every
// face with an abstract id and carries no presentation at all — so the same rules can drive the
// embed and the Activity without either owning them. This file rebuilds the **old** shape the
// embed was written against: faces with `.emoji` on them, cubes with an icon, levels with a medal,
// and `cube` carrying the embed's pacing config alongside the game's numbers.
//
// It is deliberately mechanical, and it is temporary. When the embed retires, this file goes with
// it and `src/interactions/cube/` reads the tuning directly.
//
// **There is still exactly one source of truth.** Nothing is redeclared here: every value is read
// out of the tuning and dressed. Change a number in `game/cube/tuning.js` and both clients move.

const tuning = require('../../game/cube/tuning.js');
const {
    FACES, LEVEL_EMOJI, SPECIAL_EMOJI, CUBE_GAP, RENDER, faceGlyph,
} = require('../discord/cube_emoji.js');

exports.SIDES = tuning.SIDES;
exports.FACES = FACES;
exports.CUBE_GAP = CUBE_GAP;
exports.WATTO = tuning.WATTO;

exports.LEVELS = tuning.LEVELS.map((l, i) => ({ ...l, emoji: LEVEL_EMOJI[i] }));

// Dresses one face. `wings` and `mirrored` are ids in the tuning and emoji strings in the shape
// the embed expects, so both are translated rather than passed through — Ben's handedness depends
// on `mirrored` being the glyph his reflection becomes.
const dress = function (face) {
    const out = { ...face, emoji: faceGlyph(face.id) };
    if (face.wings) {
        out.wings = { left: faceGlyph(face.wings.left), right: faceGlyph(face.wings.right) };
    }
    if (face.mirrored) out.mirrored = faceGlyph(face.mirrored);
    return out;
};

exports.SPECIALS = tuning.SPECIALS.map(sp => ({
    ...sp,
    emoji: SPECIAL_EMOJI[sp.id],
    faces: sp.faces.map(dress),
}));

// The game's numbers, plus the embed's pacing and layout. They were one object while the embed was
// the only client and the code reads them off one object still; the split that matters is which
// file each half is declared in.
exports.cube = { ...tuning.cube, ...RENDER };
