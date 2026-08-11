// How Botto's Chance Cube looks *in Discord*.
//
// The game itself (`src/game/cube/`) names every face with an abstract id and knows nothing
// about emoji. This is the one place that answers "what does `mult:blue` look like", and it
// exists so that a second client — the Activity — can answer the same question differently
// without the rules having an opinion.
//
// Every id the engine can put in a line has an entry here. A missing one draws as a face-down
// cube rather than as `undefined`, which is the failure mode worth designing for: a line with a
// hole in it is far better than a line that throws.

const { goal_symbols, emojimap } = require('./emoji.js');
const { ChanceCube } = require('./emoji.js');
const { planets } = require('../sw_racer/planet.js');

// One planet's emoji, by the index it sits at in `planet.js`. Falls back to the face-down cube rather
// than to `undefined`, which is the failure mode this whole file is written for: a line with a hole in
// it beats a line that throws.
const planetGlyph = i => (planets[i] && planets[i].emoji) || null;
const {
    DyeGon, RIPratts, wipeout, TuskenRaider, WideBen1, WideBen2, WideBen3, Fodesinbeed, PadmeWhat,
    andotent, restart, flamejet, binder, BallQuadinaros, PraiseMaja,
    PitDroid, OdyOhNo, speedo, Sebulba, seb_engine_l, seb_engine_r,
} = emojimap;

// The two faces of a plain cube. There is exactly one pair, because the two sides are
// *named* Blue and Red — the drama comes from the special cubes, not from recolouring these.
const FACES = { blue: '🟦', red: '🟥' };
exports.FACES = FACES;

// One glyph per face id, and exactly one — a face either *is* a side, in which case it draws as
// that side, or it *does* something, in which case it draws as the thing it does and counts
// toward neither colour. Nothing is ever composed out of two glyphs, because a position that
// draws as two is a position players count as two.
const FACE_EMOJI = {
    'side:blue': FACES.blue,
    'side:red': FACES.red,
    wild: DyeGon,
    end: RIPratts,
    broken: wipeout,
    greed: '💰',
    'mult:red': BallQuadinaros,
    'mult:blue': PraiseMaja,
    shortcut: andotent,
    reroll: restart,
    mirror: '🪞',
    invert: '🔄',
    clone: binder,
    burn: flamejet,
    cull: TuskenRaider,
    // Three thirds of one wide Ben: the raze face itself is his middle, and the two cubes he
    // destroys are replaced with his left and right, so the three positions read as one picture
    // lying across the line rather than two cubes going missing.
    raze: WideBen2,
    'razed:left': WideBen1,
    'razed:right': WideBen3,
    pair: Fodesinbeed,
    twins: PadmeWhat,
    // The Gungan energy shield, doing in a row of cubes what it does on the Naboo plains: it stops a
    // blast and lets everything else through. Unicode, like 💰 and 🪞 — the picture is the mechanic and
    // there is nothing a custom emoji would add to it.
    shield: '🛡️',
    // The pit droid hands you a cube; Ody Mandrell is what happens when one gets into the engines,
    // which is the canonical version of this cube's downside face.
    draw: PitDroid,
    purge: OdyOhNo,
    // A number that climbs, for the one paying face whose number isn't fixed until the line stops
    // moving. Phase two of the reveal is already a climbing readout, so the glyph and the mechanic say
    // the same thing.
    boost: speedo,
    // Sebulba's two engines, pointing the two ways he can cheat. The only face in the game whose
    // *heading* is what distinguishes it, and the art carries that without a word of explanation.
    'engine:left': seb_engine_l,
    'engine:right': seb_engine_r,
    // The eight faces of the Planet Octahedron, drawn as the eight planets — which is the one place in
    // this table where the artwork already existed. `planet.js` has carried a custom emoji per planet
    // since long before the cube did, so the die costs nothing here but the mapping.
    //
    // Read out of that list by index rather than pasted in, so a planet emoji re-uploaded to the guild
    // is re-uploaded once. The order is the order the planets are declared in, which is alphabetical
    // and is also the order the faces are declared in the tuning — the two lists line up on purpose.
    freeze: planetGlyph(0), // Ando Prime — ice holds a face
    vault: planetGlyph(1), // Aquilaris — the doors seal a side
    scorch: planetGlyph(2), // Baroonda — lava takes a face off a cube
    lockout: planetGlyph(3), // Malastare — the arena seals the bank
    seam: planetGlyph(4), // Mon Gazza — the spice seam pays for depth
    jail: planetGlyph(5), // Oovo IV — the prison
    plunge: planetGlyph(6), // Ord Ibanna — the chasm
    boonta: planetGlyph(7), // Tatooine — the Boonta, and the tie
    // A position the reveal hasn't turned over yet.
    hidden: ChanceCube,
};
exports.FACE_EMOJI = FACE_EMOJI;

// A face id, as the engine writes them: lowercase, optionally `kind:side`.
const IS_FACE_ID = /^[a-z]+(:[a-z]+)?$/;

// The glyph for one position.
//
// **Values that are already glyphs pass straight through.** Live runs and parked ties stored
// before the engine split hold emoji in the slots that now hold face ids, and one of those still
// on the table when this shipped has to keep drawing correctly rather than turning into a row of
// face-down cubes. An unrecognised *id* still draws face-down — that is the failure worth
// designing for, and it is a different case from a glyph that needs no lookup.
exports.faceGlyph = function (id) {
    if (FACE_EMOJI[id]) return FACE_EMOJI[id];
    if (typeof id === 'string' && id && !IS_FACE_ID.test(id)) return id;
    return ChanceCube;
};

// A cube's own icon, for the rack and the prestige menu. Shmi and Anakin wear the side they
// force, which says more about them than a portrait would.
exports.SPECIAL_EMOJI = {
    wild: DyeGon,
    greed: '💰',
    shmi: FACES.red,
    anakin: FACES.blue,
    mirror: '🪞',
    symbiont: Fodesinbeed,
    shortcut: andotent,
    reroll: restart,
    binder: binder,
    multiplier: BallQuadinaros,
    gungan: '🛡️',
    pitdroid: PitDroid,
    boost: speedo,
    sebulba: Sebulba,
};

// Level medals run the goal-time symbols backwards — bronze at Level 1, diamond at the top —
// so depth reads at a glance the same way a goal time does.
exports.LEVEL_EMOJI = [...goal_symbols].reverse();

// The gap between one position and the next, and the only spacing left in a line.
//
// A plain space, which is what it always was. It was briefly widened to an em space, back when an
// effect face was drawn as a colour square *plus* an effect — two glyphs for one position, so the
// gap between positions had to be visibly bigger than the gap inside one, or a seven-cube line read
// as nine. Effect faces then stopped carrying a side, every face became a single emoji, and that
// whole problem went away: one glyph is one position, with nothing left to disambiguate.
//
// So the wide gap outlived its reason and was only spending horizontal room, which nine cubes at
// `# ` heading size cannot spare.
exports.CUBE_GAP = ' ';

// Everything below is pacing and layout for the **embed**, and none of it is a rule. It lived in
// the tuning data while the embed was the only client; it is here now because a message edit is
// the constraint it is written against, and a web client has none of these limits.
//
// **It is also, as of the Activity, dead configuration.** `/chubacubes` launches the Activity and
// the embed board draws no game any more, so nothing outside `src/interactions/cube*.js` reads a
// single value below. It is kept because that board is still the parity harness's subject — the
// frozen reference it is checked against renders through this table — and deleting it would retire
// the only independent check that the extracted rules still resolve a line the way the original
// did. Read it as a record of what a message-edit budget costs a reveal, not as tuning anyone can
// usefully change: the numbers the player actually meets are `BEAT` in the Activity's `board.js`.
exports.RENDER = {
    // The roll is drawn at heading size, which is what makes a handful of cubes read as an event
    // rather than a sentence. It doesn't survive a long line on a phone: nine heading-sized emoji
    // already wrap, and a wrapped line is far worse to read than a smaller one — the cubes stop
    // being a row you can count at a glance.
    //
    // So the line steps down through four markdown sizes as it grows, each threshold being the
    // count at which the row stops fitting at the size above it:
    //
    //     1-9   `#`     big enough to read as an event
    //    10-11  `##`
    //    12-14  plain
    //    15+    `-#`    the runaway tier
    //
    // Watto's tie-breaker adds one more glyph than the count knows about, which is the headroom
    // these numbers carry. Two steps used to do this job and the drop from heading straight to
    // ordinary text was too far in one go — `##` is the rung that was missing.
    h2At: 10,
    plainAt: 12,
    subtextAt: 15,
    // Each restructuring face gets its own frame in the reveal, so a roll plays back one effect at
    // a time instead of cutting from the throw to the aftermath. The engine emits every step it
    // took — up to nine, once copies can act — and this is how many of them the embed can afford
    // to draw. A client that isn't paying a message edit per frame should not have this cap.
    maxEffectFrames: 3,
    // Written out at the floor rather than under it: `minFrameGap` clamps every gap, so the
    // old 900 was silently a 1000 and the number here was describing a beat that never played.
    effectDelay: 1000,
    // Phase two of the reveal: the Greed and Multiplier faces counted out one at a time, with the
    // multiple climbing in the header. Unlike the effect faces there is no natural ceiling on how
    // many a roll can throw — the Greed Cube pays on five faces in six, and a Binder or a Mirror
    // can put a second copy of it on the table — so this cap is doing real work rather than
    // restating a limit the cubes already have.
    //
    // Over the cap it keeps the **last** frames rather than the first. Each frame's header shows
    // the running total, so the first one drawn already has everything before it folded in and no
    // frame is ever showing a number that isn't true — the walk just starts partway along.
    maxPayFrames: 4,
    // Beat before the cubes start landing, and again before the payout. Longer than the two
    // below so it still reads as a pause now that `minFrameGap` has lifted them to a second —
    // at the old 1000 it was identical to every other beat, and the hold on the last group of
    // cubes, which is the one the whole reveal is building toward, had nothing left to hold.
    rollDelay: 1400,
    // Gap between groups of cubes as a big roll comes out.
    revealDelay: 1000,
    // Each reveal group is a message edit, so a nine-cube roll can't have nine of them.
    maxRevealFrames: 3,
    // Floor under every gap above, enforced by the pacer in `interactions/cube.js`. The delays
    // either side of it are pacing choices; this one is a rate limit. A full roll is up to a
    // dozen edits of a single message, the edit bucket is five in five seconds, and Discord
    // does not simply drop the sixth — it holds it for a second or more and then lets what
    // queued behind it through together, which is what a reveal freezing and then skipping two
    // beats at once actually is. One edit a second is the fastest that bucket sustains.
    //
    // No client-side pacing can rescue a request that has already been held, so this is the
    // only lever that matters for that half of the problem.
    minFrameGap: 1000,
    // How long a single edit has to take before it's worth a line in the log. Every beat the
    // player waits is its gap plus the edit that opened it, so an edit over this is a beat
    // visibly longer than it was written to be. A roll that stutters and logs nothing is a
    // pacing problem to solve here; one that logs a string of these is Discord holding the
    // edits, which no delay can fix — only sending fewer of them, further apart.
    slowFrameWarn: 400,
};
