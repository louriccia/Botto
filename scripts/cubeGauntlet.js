// Every interaction one cube can have with another, fired off in a row.
//
// **The problem this exists for.** The mode's rules are almost entirely *relational*: a face rarely
// does anything to the cube that threw it, it does something to a neighbour, and what it does
// depends on what that neighbour is wearing. Sixteen cubes, forty-odd acting faces and seven pieces
// of state a target can be carrying — ice, a blessing, paint, a scorch, a dome, prisoners, a
// reflection — is a space no amount of play reaches on purpose. `cubeFixtures.js` chases shapes by
// playing until one turns up, which is the right tool for "catch an interesting roll" and the wrong
// one for "check that a Binder's fire spends a blessing", because the roll that would prove it comes
// up once in ten thousand and nothing notices when it stops coming up at all.
//
// So this names the line instead. Every entry below is a hand-built table with the faces forced, a
// stated expectation, and a sentence saying what is being claimed — and it goes down
// `sandbox.throwLine`, which is `POST /cube/sandbox/roll`'s own function: `cubeState`, `startRun`,
// `relineFrom`, `resolveThrown`, `resolveLine`, `multSteps`, `settleThrow`, `persist` and
// `rollResponse`, in that order, which is every layer a real roll passes between the profile and the
// wire. A harness that called `engine.resolveLine` directly would be testing the rules and not the
// game: the codec, the pay walk, the settle and the tie park are all downstream of the engine and
// every one of them has been wrong at some point while the engine was right.
//
// **Where that stops, which is worth being exact about.** Four layers are outside it and none of
// them is tested here:
//
//   * **The route.** `src/api/cube.js` — auth, the rate limit, and the coercion of a request body
//     into a spec. `scripts/cubeApiSmoke.js` is the tool for that end.
//   * **Storage.** The sandbox's database ref is inert by design, so `persist.js` is *called* and
//     nothing is written. A roll here cannot move a real balance, which is the whole safety
//     argument for the route and the reason this can run anywhere.
//   * **The climb.** One rung, from a world built for it. `pushRun` and `resumeTie` carry state
//     between rungs and only the park half of a tie is reached — `cubeFixtures.js` climbs.
//   * **Discord and the client.** No embed and no reveal. `--presets` is the answer to the second
//     of those: it writes this playlist into the Activity's sandbox picker, where the same lines
//     are thrown over HTTP and drawn by `reveal.js` — which does test the route and the client, by
//     hand, one line at a time.
//
// **Four phases, and the last two are the ones that find things.**
//
//   1. THE PLAYLIST   One line per interaction, repeated, every expectation checked every time.
//   2. THE MEDLEYS    The same fragments welded onto one long line, several at a time, shuffled.
//                     Interactions are written and read one pair at a time and then meet on a real
//                     table nine cubes wide; a fragment that only works in isolation is a rule that
//                     does not survive a Level 5 rack.
//   3. THE HUNT       Random lines chasing whatever the first two never produced. A kind the hunt
//                     finds is a hole in the playlist. A kind neither finds is either unreachable
//                     by construction or a note the engine can no longer emit, and telling those
//                     two apart is worth a pair of eyes.
//   4. COVERAGE       Every note kind in the game against every note kind seen, plus a scan of
//                     `engine.js` for kinds this file has never heard of — so a face added next
//                     month reports itself as untested rather than passing silently.
//
// **The invariants run on every roll in every phase**, not only on the ones with an expectation.
// Nine parallel lists go on the wire beside the line and every one of them has to be the line's
// length, at the top level and on each step; `held` cannot be less than `holds` sums to; a settled
// roll has to have settled. They cost nothing per roll and are how a shape breaks without a single
// named scenario failing.
//
// **Two ways to watch it rather than take its word for it.** `--show` draws every interaction as
// the walk the engine took — thrown line, one row per turn, settled line — which is the same data
// the Activity animates, as text. `--presets` writes the whole playlist into the Activity's own
// sandbox picker, where each one is thrown live over HTTP and stepped through frame by frame.
//
//   node scripts/cubeGauntlet.js [--reps N] [--hunt N] [--medleys N] [--only substring] [-v]
//                                [--show] [--presets [path]]
//
// Read-only. The sandbox builds a throwaway player per roll, so this touches no database, stakes
// nothing, and cannot reach a real balance — see the header of `src/game/cube/sandbox.js`.

const sandbox = require('../src/game/cube/sandbox.js');
const { SPECIALS, cube: config } = require('../src/game/cube/tuning.js');

const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
// A value only counts as a value if it is not the next flag, so `--presets` and `--presets out.json`
// are both spellings of the same option.
const flag = function (name, def) {
    const at = argv.indexOf(`--${name}`);
    if (at < 0) return def;
    const next = argv[at + 1];
    return next && !next.startsWith('--') ? next : def;
};
const has = name => argv.includes(`--${name}`);

const REPS = Number(flag('reps', 24));
const HUNT = Number(flag('hunt', 4000));
const MEDLEYS = Number(flag('medleys', 400));
const ONLY = flag('only', null);
const LOUD = argv.includes('-v') || argv.includes('--verbose');
const SHOW = has('show');
// Where the Activity's sandbox picker reads its presets from, beside the fixtures it already loads.
const PRESETS = has('presets')
    ? flag('presets', path.join(__dirname, '..', '..', 'junkyard', 'src', 'activity', 'gauntlet.json'))
    : null;

// ---------------------------------------------------------------------------
// Spelling a cube
// ---------------------------------------------------------------------------

// The sandbox takes `{ id, face, frozen, burned, painted, blessed, mirrored, heat, holds }` per
// position, and the scenarios below are mostly two or three of those — so the whole file is written
// in shorthand. `P` is an ordinary cube; `C` names a cube and the face it must show.
const P = (x = {}) => ({ ...x });
const C = (id, face, x = {}) => ({ id, face, ...x });

// The two cubes that carry a *guaranteed* colour, which is what makes a side deterministic here. A
// plain cube rolls its own, so any scenario whose answer depends on what colour a neighbour is
// wearing has to name Anakin or Shmi and force the face.
const BLUE = (x = {}) => C('anakin', 'side:blue', x);
const RED = (x = {}) => C('shmi', 'side:red', x);

// A plain cube worn down to its last face. There is no floor any more, so this is the cube that
// proves it: the sixth face burns like the first five and what stands there afterwards is a blank.
const BARE = {
    burned: ['side:blue', 'side:blue', 'side:blue', 'side:red', 'side:red'],
    face: 'side:red',
};

// A weld, because a welded cube is a cube and everything below has to hold for one. Three Flamejets
// off the Binder and three Greeds off the Greed Cube, in the id format `rollWeld` produces.
const WELD = 'binder:012+greed:012';

// ---------------------------------------------------------------------------
// What an entry may assert
// ---------------------------------------------------------------------------
//
//   want    note kinds that must be in the roll, every repetition
//   never   note kinds that must not be, ever
//   len     the resolved line's length
//   check   anything else, returning a string to fail with
//   some    a *sometimes*: passes if the kind lands at least once across the reps. For the handful
//           of faces that pick their target at random — the warrant, the blessing, a drawn cube's
//           own face — where forcing the answer would be testing a different thing from the one the
//           face does.
//   medley  safe to weld onto a long line beside other fragments, off by default. Most of what
//           makes an interaction worth testing is also what makes it reach across a whole table: a
//           mine has a blast, Order 66 and the chasm see every seat, a Tusken picks at random and a
//           Mirror copies everything behind it. Those are proved alone and left out of phase 2.

const notesOf = roll => (roll.notes || []).map(n => n.kind);
const noteOf = (roll, kind) => (roll.notes || []).find(n => n.kind === kind) || null;
// The line as it stood on one note's own beat. The ice is spent *during* a roll now — a held cube
// melts on its turn — so "the ice was not spent on a turn" is a claim about the frame the turn was
// taken on and cannot be read off the line the roll ended with, where every hold has melted.
const frameOf = (roll, kind) => (roll.steps || []).find(s => s.note && s.note.kind === kind) || null;
const paidKind = (roll, kind) => (roll.pays || []).filter(p => p.note && p.note.kind === kind);

const PLAY = [
    // -----------------------------------------------------------------------
    // The Mirror
    // -----------------------------------------------------------------------
    {
        id: 'mirror',
        say: 'reflects what is behind it onto the seats ahead',
        cubes: [C('greed', 'greed'), C('mirror', 'mirror')],
        want: ['mirror'],
        len: 3,
        check: r => (noteOf(r, 'mirror').copied === 1 ? null : 'wanted exactly one copy'),
    },
    {
        id: 'mirror.nothing',
        say: 'with nothing behind it has nothing to reflect',
        cubes: [C('mirror', 'mirror'), P()],
        want: ['mirror.nothing'],
        len: 2,
    },
    {
        id: 'mirror.walled',
        say: 'cannot write onto a seat sheltering under a dome it stands outside',
        cubes: [C('greed', 'greed'), C('mirror', 'mirror'), P(), C('gungan', 'shield')],
        want: ['mirror'],
        check: r => (noteOf(r, 'mirror').walled === 1 ? null : 'the write was not turned away'),
    },
    {
        id: 'mirror.blessed',
        say: 'spends a blessing rather than writing over the cube wearing it',
        cubes: [C('greed', 'greed'), C('mirror', 'mirror'), P({ blessed: true })],
        want: ['mirror'],
        check: r => (noteOf(r, 'mirror').froze === 1 ? null : 'the blessing was not spent'),
    },
    {
        id: 'mirror.turns',
        say: 'hands back a copy that is turned around — a reflection, not a print',
        cubes: [C('greed', 'greed'), C('mirror', 'mirror')],
        want: ['mirror'],
        check: r => (r.mirrored[2] === true ? null : 'the copy came back the same way round'),
    },
    {
        id: 'invert',
        say: 'turns every cube it can reach onto the other colour',
        cubes: [BLUE(), C('mirror', 'invert')],
        call: 'blue',
        want: ['invert'],
        // Read off the verdict, because a turned cube *does* change the face it is showing: an
        // unpainted one is rerolled onto the other colour rather than repainted, so an Anakin comes
        // back showing `side:red` having never lost a red face. The cube is untouched — next rung
        // it rolls four blues in six again — and that is the distinction being pinned.
        check: r => (r.settled && r.settled.majority === 'red' ? null : 'the cube did not turn')
            || (r.cubeIds[0] === 'anakin' ? null : 'the cube itself was recut'),
    },
    {
        id: 'invert.wild',
        say: 'cannot turn a wild, which is put back to the call every throw',
        cubes: [C('wild', 'wild'), C('mirror', 'invert')],
        call: 'blue',
        want: ['invert', 'wild'],
        check: r => (r.settled && r.settled.majority === 'blue' ? null : 'the wild was turned'),
    },
    {
        id: 'invert.painted',
        say: "moves the crowd's mark rather than clearing it",
        cubes: [RED({ painted: 'blue' }), C('mirror', 'invert')],
        call: 'blue',
        want: ['invert'],
        // Turning a face back onto its own colour **removes** the mark rather than writing a second
        // one over it — a red side painted blue and then turned red is just a red side again. So
        // the proof the mark moved is that it is gone, on a cube that came in wearing one.
        check: r => (noteOf(r, 'invert').repainted === 1 ? null : 'the mark was not moved')
            || (r.painted[0] === null ? null : `the mark is still at ${r.painted[0]}`),
    },
    {
        id: 'invert.frozen',
        say: 'leaves a frozen cube alone, and the ice is not spent on a turn',
        // The Mirror stands to the *left* of the ice, which is now the whole of the interaction:
        // a held cube melts on its own turn, so a turn taken after that one finds an ordinary cube.
        // See `thaw` for the same two cubes the other way round.
        // Painted, because an unpainted cube a turn *did* reach still reports `repainted: 0` — the
        // mark is the only thing a turn leaves behind that a check can read. Same pair as
        // `invert.painted`, with the ice deciding whether the mark moves.
        cubes: [C('mirror', 'invert'), RED({ frozen: true, painted: 'blue' })],
        call: 'blue',
        want: ['invert', 'thaw'],
        check: r => (r.painted[1] === 'blue' ? null : 'the frozen cube was turned')
            || (frameOf(r, 'invert').frozen[1] === true ? null : 'the ice was spent on a turn')
            || (r.frozen[1] === false ? null : 'the hold outlived the roll'),
    },
    {
        id: 'thaw',
        say: 'melts on its own turn, and is an ordinary cube to everything after it',
        cubes: [RED({ frozen: true, painted: 'blue' }), C('mirror', 'invert')],
        call: 'blue',
        want: ['thaw', 'invert'],
        check: r => (noteOf(r, 'invert').repainted === 1 ? null : 'the thawed cube was still held')
            || (r.painted[0] === null ? null : 'the mark did not move')
            || (r.frozen[0] === false ? null : 'the ice outlived its turn'),
    },

    // -----------------------------------------------------------------------
    // The mine, and the wipeout
    // -----------------------------------------------------------------------
    {
        id: 'end',
        say: 'takes itself and everything within two seats with it',
        cubes: [P(), P(), C('greed', 'end'), P(), P()],
        want: ['end'],
        len: 0,
        check: r => (r.settled && r.settled.reason === 'ratts' ? null : 'an empty line did not end the run'),
    },
    {
        id: 'end.reach',
        say: 'stops at two seats, which is what makes a mine cost cubes instead of the run',
        cubes: [P(), P(), P(), C('greed', 'end'), P(), P(), P()],
        want: ['end'],
        len: 2,
    },
    {
        id: 'end.shielded',
        say: 'stops dead at a dome wall rather than being absorbed by the shield',
        cubes: [C('greed', 'end'), P(), C('gungan', 'shield'), P()],
        want: ['end.shielded'],
        len: 3,
        check: r => (noteOf(r, 'end.shielded').shields === 2 ? null : 'wanted two seats walled off'),
    },
    {
        id: 'end.blessed',
        say: 'spares a blessed neighbour, and the blessing is spent',
        cubes: [C('greed', 'end'), P({ blessed: true })],
        want: ['end'],
        len: 1,
        check: r => (r.blessed[0] === false ? null : 'the blessing was not spent'),
    },
    {
        id: 'broken',
        say: 'comes apart where it stands, and no dome has anything to say about it',
        cubes: [C('reroll', 'broken'), C('gungan', 'shield')],
        want: ['broken'],
        len: 1,
    },

    // -----------------------------------------------------------------------
    // The Binder
    // -----------------------------------------------------------------------
    {
        id: 'burn',
        say: 'burns the cube on its right off the table',
        cubes: [C('binder', 'burn'), C('greed', 'greed')],
        want: ['burn'],
        len: 1,
        medley: true,
    },
    {
        id: 'burn.mirrored',
        say: 'fires the other way when the cube has been turned around',
        cubes: [C('greed', 'greed'), C('binder', 'burn', { mirrored: true }), C('greed', 'greed')],
        want: ['burn'],
        len: 2,
        check: r => (noteOf(r, 'burn').at === 0 ? null : 'the fire went the way it was drawn'),
    },
    {
        id: 'burn.nothing',
        say: 'pointing off the edge of the table finds nothing to burn',
        cubes: [C('binder', 'burn', { mirrored: true }), P()],
        want: ['burn.nothing'],
        len: 2,
        medley: true,
    },
    {
        id: 'burn.fireproof',
        say: 'cannot burn a Binder — the whole cube is fireproof, not just the Flamejet',
        cubes: [C('binder', 'burn'), C('binder', 'clone')],
        want: ['burn.fireproof'],
        medley: true,
    },
    {
        id: 'burn.walled',
        say: 'cannot reach a cube sheltering under a dome it stands outside',
        cubes: [C('binder', 'burn'), P(), C('gungan', 'shield')],
        want: ['burn.walled'],
        len: 3,
        medley: true,
    },
    {
        id: 'burn.inside',
        say: 'standing under the dome, can destroy the shield holding it up',
        cubes: [C('binder', 'burn'), C('gungan', 'shield'), P()],
        want: ['burn'],
        len: 2,
        check: r => (r.cubeIds.includes('gungan') ? 'the shield survived a cube inside its own dome' : null),
    },
    {
        id: 'burn.iced',
        say: 'shatters the ice instead of the cube — fire is the one thing a freeze answers',
        cubes: [C('binder', 'burn'), C('greed', 'greed', { frozen: true })],
        want: ['burn.iced'],
        len: 2,
        medley: true,
        check: r => (r.frozen[1] === false ? null : 'the ice was not spent'),
    },
    {
        id: 'burn.blessed',
        say: 'spends a blessing rather than the cube wearing it',
        cubes: [C('binder', 'burn'), C('greed', 'greed', { blessed: true })],
        want: ['burn.blessed'],
        len: 2,
        medley: true,
    },
    {
        id: 'clone',
        say: 'makes the cube on its right a copy of the cube on its left',
        cubes: [C('greed', 'greed'), C('binder', 'clone'), P()],
        want: ['clone'],
        len: 3,
        medley: true,
        check: r => (r.cubeIds[2] === 'greed' ? null : `it printed ${r.cubeIds[2]}`),
    },
    {
        id: 'clone.handed',
        say: 'reads left and writes right however the cube is turned — the pairing is the face',
        cubes: [C('greed', 'greed'), C('binder', 'clone', { mirrored: true }), P()],
        want: ['clone'],
        check: r => (r.cubeIds[2] === 'greed' ? null : 'a mirrored Binder copied the wrong way'),
    },
    {
        id: 'clone.keeps.hand',
        say: 'hands back a copy the same way round — a print, not a reflection',
        cubes: [C('greed', 'greed'), C('binder', 'clone'), P()],
        want: ['clone'],
        check: r => (r.mirrored[2] === false ? null : 'the Binder handed back a mirrored cube'),
    },
    {
        id: 'clone.alone',
        say: 'with no neighbour either side has nothing to do',
        cubes: [C('binder', 'clone')],
        want: ['clone.alone'],
        len: 1,
    },
    {
        id: 'clone.destroy',
        say: 'with nothing on its left, electrocutes the cube on its right instead',
        cubes: [C('binder', 'clone'), C('greed', 'greed')],
        want: ['clone.destroy'],
        len: 1,
    },
    {
        id: 'clone.destroy.blessed',
        say: 'and the electrocution wards like every other destruction',
        cubes: [C('binder', 'clone'), C('greed', 'greed', { blessed: true })],
        want: ['clone.blessed'],
        len: 2,
    },
    {
        id: 'clone.append',
        say: 'at the tail, puts the copy on the end rather than over a cube',
        cubes: [C('greed', 'greed'), C('binder', 'clone')],
        want: ['clone.append'],
        len: 3,
    },
    {
        id: 'clone.blessed',
        say: 'spends a blessing rather than writing over the cube wearing it',
        cubes: [C('greed', 'greed'), C('binder', 'clone'), P({ blessed: true })],
        want: ['clone.blessed'],
        len: 3,
        medley: true,
    },
    {
        id: 'clone.walled',
        say: 'cannot write onto a seat under a dome it stands outside',
        cubes: [C('greed', 'greed'), C('binder', 'clone'), P(), C('gungan', 'shield')],
        want: ['clone.walled'],
        medley: true,
    },
    {
        id: 'clone.prisoners',
        say: 'copies a captor with prisoners of its own, freshly named rather than shared',
        // A plain cube carrying two, rather than a Sandcrawler: a crawler standing left of the
        // Binder would swallow it before it ever took a turn.
        cubes: [P({ holds: 2 }), C('binder', 'clone'), P()],
        want: ['clone'],
        check: r => (r.holds[2] === 2 ? null : `the copy came out holding ${r.holds[2]}`),
    },

    // -----------------------------------------------------------------------
    // The Symbiont
    // -----------------------------------------------------------------------
    {
        id: 'cull',
        say: 'shoots one other cube off the line',
        cubes: [C('symbiont', 'cull'), P(), P()],
        want: ['cull'],
        len: 2,
    },
    {
        id: 'cull.nothing',
        say: 'alone, has nothing to shoot',
        cubes: [C('symbiont', 'cull')],
        want: ['cull.nothing'],
        len: 1,
    },
    {
        id: 'cull.sheltered',
        say: 'cannot touch anything under a dome, even standing right beside it',
        cubes: [C('symbiont', 'cull'), P(), C('gungan', 'shield'), P()],
        want: ['cull.nothing'],
        len: 4,
    },
    {
        id: 'cull.over',
        say: 'shoots clean over a dome to the open air on the far side',
        cubes: [C('symbiont', 'cull'), P(), C('gungan', 'shield'), P(), C('greed', 'greed')],
        want: ['cull'],
        len: 4,
        check: r => (r.cubeIds.includes('greed') ? 'it took something under the dome instead' : null),
    },
    {
        id: 'cull.shield',
        say: 'standing under the dome, can take the shield itself',
        cubes: [C('symbiont', 'cull'), C('gungan', 'shield')],
        want: ['cull.shield'],
        len: 1,
    },
    {
        id: 'cull.blessed',
        say: 'is turned away by a blessing',
        cubes: [C('symbiont', 'cull'), P({ blessed: true })],
        want: ['cull.blessed'],
        len: 2,
    },
    {
        id: 'raze',
        say: 'flattens the cube either side of it into rubble',
        cubes: [C('greed', 'greed'), C('symbiont', 'raze'), C('greed', 'greed')],
        want: ['raze'],
        len: 3,
        medley: true,
        check: r => (noteOf(r, 'raze').both === true ? null : 'wanted both wings'),
    },
    {
        id: 'raze.nothing',
        say: 'alone, has nothing to flatten',
        cubes: [C('symbiont', 'raze')],
        want: ['raze.nothing'],
        len: 1,
    },
    {
        id: 'raze.blessed',
        say: 'is stopped by a blessing on both sides at once',
        cubes: [P({ blessed: true }), C('symbiont', 'raze'), P({ blessed: true })],
        want: ['raze.blessed'],
        len: 3,
        medley: true,
    },
    {
        id: 'raze.painted',
        say: 'cuts its wings in whatever it is wearing, so a painted Ben is three matching cubes',
        cubes: [C('symbiont', 'raze', { painted: 'blue' }), RED()],
        call: 'blue',
        want: ['raze'],
        check: r => (r.settled && r.settled.majority === 'blue' ? null : 'the wing did not vote'),
    },
    {
        id: 'pair',
        say: 'grows a red and a blue either side of it',
        cubes: [C('symbiont', 'pair')],
        want: ['pair'],
        len: 3,
        medley: true,
    },
    {
        id: 'twins',
        say: 'grows matching twins either side of it',
        cubes: [C('symbiont', 'twins')],
        want: ['twins'],
        len: 3,
        medley: true,
    },

    // -----------------------------------------------------------------------
    // The Pit Droid
    // -----------------------------------------------------------------------
    {
        id: 'draw',
        say: 'pulls a cube out of the bag and seats it on its right',
        cubes: [C('pitdroid', 'draw'), P()],
        // The Gungan rather than a Greed: all six of its faces are the shield, so the drawn cube's
        // own turn cannot move the line. A Greed draws a mine one time in six and takes the whole
        // table with it, which is a true roll and a useless assertion.
        bag: ['gungan'],
        want: ['draw'],
        len: 3,
        medley: true,
        check: r => (r.cubeIds[1] === 'gungan' ? null : `it seated ${r.cubeIds[1]}`),
    },
    {
        id: 'draw.mirrored',
        say: 'seats what it found on its left when the droid has been turned around',
        cubes: [P(), C('pitdroid', 'draw', { mirrored: true })],
        bag: ['gungan'],
        want: ['draw'],
        len: 3,
        check: r => (r.cubeIds[1] === 'gungan' ? null : `it seated ${r.cubeIds[1]}`),
    },
    {
        id: 'draw.empty',
        say: 'with an empty bag has nothing to hand over',
        cubes: [C('pitdroid', 'draw'), P()],
        bag: [],
        want: ['draw.empty'],
        len: 2,
        medley: true,
    },
    {
        id: 'draw.acts',
        say: 'hands the drawn cube a turn of its own, in the seat it was put in',
        cubes: [C('pitdroid', 'draw'), C('greed', 'greed')],
        bag: ['symbiont'],
        want: ['draw'],
        some: ['pair', 'twins', 'cull', 'raze'],
        // Its own repetition count, not the run's: the drawn Symbiont rolls one of four faces and
        // two of them are one in six, so a dozen throws misses a face about one run in ten. Eighty
        // puts that at a few in ten million, which is the difference between a test and a coin.
        reps: 80,
    },
    {
        id: 'purge',
        say: 'scraps every special on the table, itself included',
        cubes: [C('pitdroid', 'purge'), C('greed', 'greed'), P()],
        want: ['purge'],
        len: 1,
        check: r => (noteOf(r, 'purge').destroyed === 2 ? null : 'wanted both specials'),
    },
    {
        id: 'purge.walled',
        say: 'reaches nothing sheltering under a dome it stands outside',
        cubes: [C('pitdroid', 'purge'), P(), C('gungan', 'shield'), C('greed', 'greed')],
        want: ['purge'],
        check: r => (noteOf(r, 'purge').destroyed === 1 ? null : 'Order 66 crossed a dome wall'),
    },
    {
        id: 'purge.blessed',
        say: 'is turned away by a blessing, one cube at a time',
        cubes: [C('pitdroid', 'purge'), C('greed', 'greed', { blessed: true })],
        want: ['purge'],
        len: 1,
        check: r => (noteOf(r, 'purge').destroyed === 1 ? null : 'the blessing did not hold'),
    },

    // -----------------------------------------------------------------------
    // The Scavenger and the Sandcrawler
    // -----------------------------------------------------------------------
    {
        id: 'scavenge',
        say: "pulls a cube back out of the run's wreckage",
        cubes: [C('scavenger', 'scavenge'), P()],
        // The Gungan for the same reason the droid's bag holds one: what comes back out rolls a
        // face and takes a turn, and a salvaged Greed is a mine one time in six.
        hold: ['gungan'],
        want: ['scavenge'],
        len: 3,
        check: r => (noteOf(r, 'scavenge').own === false ? null : 'it went to its own hold'),
    },
    {
        id: 'scavenge.own',
        say: 'empties its own hold before it reaches into the wreckage',
        cubes: [C('scavenger', 'scavenge', { holds: 1 })],
        hold: ['gungan'],
        want: ['scavenge'],
        check: r => (noteOf(r, 'scavenge').own === true ? null : 'it skipped its own hold'),
    },
    {
        id: 'scavenge.empty',
        say: 'with nothing wrecked and nothing held, finds nothing',
        cubes: [C('scavenger', 'scavenge')],
        hold: [],
        want: ['scavenge.empty'],
        len: 1,
    },
    {
        id: 'scavenge.mends',
        say: 'says whether it handed a burned face back on what it dragged out',
        cubes: [C('scavenger', 'scavenge')],
        hold: ['gungan'],
        want: ['scavenge'],
        // Stated on the note rather than read off `burned`: proving the mend needs a wrecked slot
        // already carrying a scorch, and the sandbox's `hold` is a list of plain ids.
        check: r => ('mended' in noteOf(r, 'scavenge') ? null : 'the note said nothing about mending'),
    },
    {
        id: 'haul',
        say: 'swallows the cube on its right into its own hold',
        cubes: [C('scavenger', 'haul'), C('greed', 'greed')],
        want: ['haul'],
        len: 1,
        medley: true,
        check: r => (r.holds[0] === 1 && r.held === 1 ? null : `it is holding ${r.holds[0]}`),
    },
    {
        id: 'haul.nothing',
        say: 'at the tail has nothing on its right to take',
        cubes: [P(), C('scavenger', 'haul')],
        want: ['haul.nothing'],
        len: 2,
    },
    {
        id: 'haul.walled',
        say: 'cannot reach into a dome it stands outside',
        cubes: [C('scavenger', 'haul'), P(), C('gungan', 'shield')],
        want: ['haul.walled'],
        len: 3,
        medley: true,
    },
    {
        id: 'haul.handed',
        say: 'turned over, reaches the other way — the arm goes where the picture points',
        cubes: [P(), C('scavenger', 'haul', { mirrored: true }), C('greed', 'greed')],
        want: ['haul'],
        len: 2,
        check: r => (noteOf(r, 'haul').at === 0 ? null : 'a mirrored crawler still took its right'),
    },
    {
        id: 'haul.rubble',
        say: "takes one of Ben's wings and gets nothing for it — rubble is cleared, not kept",
        // **It takes a turned-over crawler to reach a wing at all.** A wing is only ever made at a
        // razer's shoulder, so a crawler standing beside one is standing to its right — and a crawler
        // reaches in front of itself, which for an unturned one is further right still. The line
        // resolves left to right, so by the time the raze has made the wing every seat left of it has
        // already acted. Turn the crawler over and its arm points back at the wreckage.
        //
        //   raze  ·  P  ·  haul (turned)
        //     0      1          2
        //
        // Ben flattens seat 1. The crawler at 2 reaches left into it, clears the seat and keeps
        // nothing — a wing in a hold would be a cube nobody owned.
        cubes: [C('symbiont', 'raze'), P(), C('scavenger', 'haul', { mirrored: true })],
        want: ['raze', 'haul.rubble'],
    },
    {
        id: 'hold.break',
        say: 'coming apart lets everything it was carrying back onto the line',
        cubes: [C('scavenger', 'broken', { holds: 2 }), P()],
        want: ['broken', 'hold.break'],
        check: r => (noteOf(r, 'hold.break').freed === 2 ? null : 'wanted both prisoners out'),
    },

    // -----------------------------------------------------------------------
    // Sebulba
    // -----------------------------------------------------------------------
    {
        id: 'engine',
        say: 'burns the cube it points at over to your call',
        cubes: [C('sebulba', 'engine:right'), RED()],
        call: 'blue',
        want: ['engine'],
        medley: true,
        check: r => (r.settled && r.settled.majority === 'blue' ? null : 'the cube did not turn'),
    },
    {
        id: 'engine.left',
        say: 'points the other way on its other face',
        cubes: [RED(), C('sebulba', 'engine:left')],
        call: 'blue',
        want: ['engine'],
        medley: true,
        check: r => (noteOf(r, 'engine').dir === 'left' ? null : 'it fired right'),
    },
    {
        id: 'engine.mirrored',
        say: 'fires the opposite way when the cube has been turned around',
        cubes: [C('sebulba', 'engine:left', { mirrored: true }), RED()],
        call: 'blue',
        want: ['engine'],
        check: r => (noteOf(r, 'engine').dir === 'right' ? null : 'a mirrored engine fired as drawn'),
    },
    {
        id: 'engine.already',
        say: 'says so when it points at a cube already on your side',
        cubes: [C('sebulba', 'engine:right'), BLUE()],
        call: 'blue',
        want: ['engine.already'],
        medley: true,
    },
    {
        id: 'engine.nothing',
        say: 'finds nothing when it points at a face that is not a side',
        cubes: [C('sebulba', 'engine:right'), C('greed', 'greed')],
        call: 'blue',
        want: ['engine.nothing'],
        medley: true,
    },
    {
        id: 'engine.edge',
        say: 'finds nothing pointing off the end of the line',
        cubes: [C('sebulba', 'engine:left'), RED()],
        call: 'blue',
        want: ['engine.nothing'],
    },
    {
        id: 'engine.iced',
        say: 'bounces off a frozen cube — and the ice is *not* spent, because a turn is not damage',
        cubes: [C('sebulba', 'engine:right'), RED({ frozen: true })],
        call: 'blue',
        want: ['engine.iced', 'thaw'],
        medley: true,
        check: r => (frameOf(r, 'engine.iced').frozen[1] === true
            ? null : 'the ice was spent on a turn'),
    },
    {
        id: 'engine.walled',
        say: 'cannot fire into a dome it stands outside',
        cubes: [C('sebulba', 'engine:right'), P(), C('gungan', 'shield')],
        call: 'blue',
        want: ['engine.walled'],
        medley: true,
    },
    {
        id: 'engine.repaints',
        say: "moves the crowd's mark permanently rather than turning the cube for one rung",
        cubes: [C('sebulba', 'engine:right'), RED({ painted: 'red' })],
        call: 'blue',
        want: ['engine'],
        check: r => (noteOf(r, 'engine').repainted === true ? null : 'the mark was not moved')
            || (r.painted[1] === 'blue' ? null : `the mark is at ${r.painted[1]}`),
    },

    // -----------------------------------------------------------------------
    // The Gungan Shield's geometry
    // -----------------------------------------------------------------------
    //
    // One probe, four arrangements. A Binder outside a dome is turned away and a Binder inside is
    // not, so `burn` against `burn.walled` reads the boundary off the engine rather than off a
    // comment. Shields at seats p and q cover p-1..p+1 and q-1..q+1 and fuse while q <= p + 3, so
    // the seam is at three cubes apart — which is the whole cost of the fusion rule and the one
    // arrangement worth pinning in both directions.
    {
        id: 'dome.fuse.0',
        say: 'two shields side by side are one dome four seats wide',
        cubes: [C('binder', 'burn'), P(), C('gungan', 'shield'), C('gungan', 'shield'), P()],
        want: ['burn.walled'],
    },
    {
        id: 'dome.fuse.2',
        say: 'two cubes apart, still one dome — six seats of it',
        cubes: [C('binder', 'burn'), P(), C('gungan', 'shield'), P(), P(), C('gungan', 'shield')],
        want: ['burn.walled'],
    },
    {
        id: 'dome.split',
        say: 'three apart, the domes come apart and the seats between them are open air',
        cubes: [C('gungan', 'shield'), P(), C('binder', 'burn'), C('greed', 'greed'), P(),
            C('gungan', 'shield')],
        want: ['burn'],
        // Shields at 0 and 5 cover 0–1 and 4–5. Seats 2 and 3 are under neither, so the Binder at 2
        // reaches 3 in the open. One cube closer either side and this reads `burn.walled`.
    },
    {
        id: 'dome.inside',
        say: 'a cube in cover reaches what is in cover with it',
        // Shields at 1 and 4 cover 0–2 and 3–5, which touch and so fuse into one dome over the
        // whole line: the Binder at 2 reaches its target at 3 across a seam that is not a wall.
        cubes: [P(), C('gungan', 'shield'), C('binder', 'burn'), C('greed', 'greed'),
            C('gungan', 'shield')],
        want: ['burn'],
        len: 4,
    },
    {
        id: 'dome.outward',
        say: 'and nothing further — the wall holds a cube in as firmly as it keeps others out',
        // One shield, at 1, covering 0–2. The Binder is under it at 2 and its target at 3 is not.
        cubes: [P(), C('gungan', 'shield'), C('binder', 'burn'), C('greed', 'greed')],
        want: ['burn.walled'],
        len: 4,
    },

    // -----------------------------------------------------------------------
    // The Planet Octahedron
    // -----------------------------------------------------------------------
    {
        id: 'freeze',
        say: 'holds both neighbours on the face they are showing',
        cubes: [C('greed', 'greed'), C('octahedron', 'freeze'), C('greed', 'greed')],
        want: ['freeze'],
        medley: true,
        check: r => (r.frozen[0] && r.frozen[2] ? null : 'wanted both held'),
    },
    {
        id: 'freeze.already',
        say: 'finds nothing to do beside a cube the ice is already on',
        // To the left of the hold, because a hold melts on its own turn: stand Ando Prime after it
        // and there is nothing already on, which is a different scenario and a legal freeze.
        cubes: [C('octahedron', 'freeze'), C('greed', 'greed', { frozen: true })],
        want: ['freeze.already'],
        medley: true,
    },
    {
        id: 'freeze.nothing',
        say: 'alone, has nobody to hold',
        cubes: [C('octahedron', 'freeze')],
        want: ['freeze.nothing'],
        len: 1,
    },
    {
        id: 'freeze.walled',
        say: 'reaches nothing across a dome wall',
        cubes: [C('gungan', 'shield'), P(), C('octahedron', 'freeze'), C('greed', 'greed')],
        want: ['freeze'],
        check: r => (noteOf(r, 'freeze').frozen === 1 ? null : 'the frost crossed a wall'),
    },
    {
        id: 'freeze.pays',
        say: 'suspends the turn and not the cube, so a frozen paying face still pays',
        cubes: [C('octahedron', 'freeze'), C('greed', 'greed')],
        want: ['freeze', 'greed'],
        check: r => (paidKind(r, 'pay.greed').length === 1 ? null : 'the frozen Greed paid nothing'),
    },
    {
        id: 'scorch',
        say: 'takes a face off both neighbours for good, and kills the face where it stands',
        cubes: [C('greed', 'greed'), C('octahedron', 'scorch'), C('greed', 'greed')],
        want: ['scorch'],
        medley: true,
        check: r => (r.burned[0].length === 1 ? null : 'no face came off')
            || (r.charred[0] === true ? null : 'the charred face still counted'),
    },
    {
        id: 'scorch.nothing',
        say: 'alone, has nothing to burn',
        cubes: [C('octahedron', 'scorch')],
        want: ['scorch.nothing'],
        len: 1,
    },
    {
        id: 'scorch.fireproof',
        say: 'says so when the Binder turns it away, rather than reporting nothing',
        // The die first, because a Binder with nothing on its left electrocutes what is on its
        // right — the other way round, the scorch never gets a turn to be turned away.
        cubes: [C('octahedron', 'scorch'), C('binder', 'clone')],
        want: ['scorch.spared'],
        check: r => (noteOf(r, 'scorch.spared').spared[0] === 'fireproof' ? null : 'the wrong reason'),
    },
    {
        id: 'scorch.iced',
        say: 'is eaten by the ice, which is spent — and says so, where it once said nothing',
        cubes: [C('octahedron', 'scorch'), C('greed', 'greed', { frozen: true })],
        want: ['scorch.spared'],
        medley: true,
        check: r => (noteOf(r, 'scorch.spared').spared[0] === 'iced' ? null : 'the wrong reason')
            || (r.frozen[1] === false ? null : 'the ice was not spent')
            || (notesOf(r).includes('thaw') ? 'the fire left a thaw to take a turn over' : null),
    },
    {
        id: 'scorch.blessed',
        say: 'is answered by a blessing, because a permanent scorch is harm',
        cubes: [C('greed', 'greed', { blessed: true }), C('octahedron', 'scorch')],
        want: ['scorch.spared'],
        medley: true,
        check: r => (noteOf(r, 'scorch.spared').spared[0] === 'blessed' ? null : 'the wrong reason'),
    },
    {
        id: 'scorch.blank',
        say: 'burns the last face off a worn cube — there is no floor, and what is left rolls nothing',
        cubes: [P(BARE), C('octahedron', 'scorch')],
        want: ['scorch'],
        len: 2,
        check: r => (r.burned[0].length === 6 ? null : 'the last face was spared')
            || (r.charred[0] === true ? null : 'the blank still showed a face'),
    },
    {
        id: 'scorch.dome',
        say: 'switches a dome off — the shield is the one cube whose face works without being rolled',
        cubes: [C('gungan', 'shield'), C('octahedron', 'scorch'), C('symbiont', 'cull'), P()],
        want: ['scorch', 'cull'],
        // Read off the note, not off `charred`: the Tusken goes next and may well take the charred
        // shield off the line, and a seat that is gone carries no state to read.
        check: r => (noteOf(r, 'scorch').burned[0] === 'shield' ? null : 'the shield was not singed'),
        // The Tusken goes second and finds the dome down, which is what lets the shot land at all:
        // with the shield standing he is outside a dome covering every seat he could reach.
    },
    {
        id: 'vault',
        say: 'seals the side you called, so the next rung cannot repeat it',
        // On a line that *wins*. The seal rides the ladder the next rung is thrown from, so
        // `settleLoss` has nowhere to put it and a busted vault reports nothing at all — two
        // Anakins make the call the majority whatever the die does.
        cubes: [C('octahedron', 'vault'), BLUE(), BLUE()],
        call: 'blue',
        want: ['vault'],
        check: r => (r.settled && r.settled.sealed === 'blue'
            ? null : `it sealed ${r.settled && r.settled.sealed}`),
    },
    {
        id: 'vault.twice',
        say: 'a second vault swings the door across rather than shutting it again',
        cubes: [C('octahedron', 'vault'), C('octahedron', 'vault'), BLUE(), BLUE()],
        call: 'blue',
        want: ['vault'],
        check: r => (r.settled && r.settled.sealed === 'red' ? null : 'the second vault did nothing'),
    },
    {
        id: 'blessing',
        say: 'rides a cube until something tries to destroy it',
        cubes: [C('octahedron', 'blessing'), P()],
        want: ['blessing'],
        check: r => (r.blessed[1] === true ? null : 'nobody was blessed'),
    },
    {
        id: 'blessing.nothing',
        say: 'alone, has nobody to bless — it cannot bless itself',
        cubes: [C('octahedron', 'blessing')],
        want: ['blessing.nothing'],
        len: 1,
    },
    {
        id: 'seam',
        say: 'pays off the rungs behind it, on the count walk rather than in the turn',
        cubes: [C('octahedron', 'seam'), P()],
        rungs: 4,
        want: ['seam'],
        // Five, not four: `throwLevel` counts the rung being thrown, so a run with four behind it
        // pays the seam for five. Checked against the note's own `rungs` as well, or this passes
        // for a seam that paid the right amount off the wrong count.
        check: r => (noteOf(r, 'seam').rungs === 5
            ? null : `it counted ${noteOf(r, 'seam').rungs} rungs`)
            || (noteOf(r, 'seam').bonus === config.seamBonus * 5 ? null : 'it paid the wrong amount'),
    },
    {
        id: 'jail',
        say: 'takes as many as the cell holds, off the line and into it',
        cubes: [C('octahedron', 'jail'), P(), P(), P(), P(), P()],
        want: ['jail'],
        len: 2,
        check: r => (r.holds[0] === config.jailSize ? null : `the cell holds ${r.holds[0]}`),
    },
    {
        id: 'jail.nothing',
        say: 'alone, has nobody to arrest',
        cubes: [C('octahedron', 'jail')],
        want: ['jail.nothing'],
        len: 1,
    },
    {
        id: 'parole',
        say: 'lets one out on its own turn, whatever the cube rolled',
        cubes: [C('octahedron', 'jail', { holds: 2 }), P()],
        want: ['parole'],
    },
    {
        id: 'parole.then.jail',
        say: 'a full cell paroles one and then has room for exactly one more',
        cubes: [C('octahedron', 'jail', { holds: config.jailSize }), P(), P()],
        want: ['parole', 'jail'],
        check: r => (noteOf(r, 'jail').taken === 1 ? null : `it took ${noteOf(r, 'jail').taken}`),
    },
    {
        // **Alone, so the chasm cannot miss it.** A plunge takes the two ends of the line and the
        // cell only breaks if the captor is one of them — and the cube it paroled into the throw
        // lands wherever the throw puts it, so on a longer line it can come down on the near end and
        // leave the jailer standing in the middle with its cell intact. That is a correct roll and a
        // useless one to assert. A line of one is a line of two once the prisoner walks, and on a
        // line of two both cubes are ends.
        id: 'jail.break',
        say: 'a captor destroyed empties its cell back onto the line',
        cubes: [C('octahedron', 'plunge', { holds: 2 })],
        want: ['plunge', 'hold.break'],
    },
    {
        id: 'plunge',
        say: 'drops both ends of the line off the road, itself included',
        cubes: [P(), P(), C('octahedron', 'plunge')],
        want: ['plunge'],
        len: 1,
        check: r => (noteOf(r, 'plunge').self === true ? null : 'the die spared itself'),
    },
    {
        id: 'plunge.alone',
        say: 'alone, there is no second position, so the chasm takes only the cube that opened it',
        cubes: [C('octahedron', 'plunge')],
        want: ['plunge'],
        len: 0,
        check: r => (noteOf(r, 'plunge').destroyed === 1 ? null : 'a lone chasm took more than itself')
            || (noteOf(r, 'plunge').self === true ? null : 'the die spared itself'),
    },
    {
        id: 'plunge.blessed',
        say: 'crumbles past a blessed cube and spends the blessing doing it, then falls alone',
        cubes: [P({ blessed: true }), C('octahedron', 'plunge')],
        want: ['plunge'],
        len: 1,
        check: r => (noteOf(r, 'plunge').destroyed === 1 ? null : 'the blessed cube went over too')
            || (r.blessed[0] === false ? null : 'the blessing was read and not spent'),
    },
    {
        id: 'crowd',
        say: 'paints its neighbours onto whichever side is winning',
        cubes: [BLUE(), C('octahedron', 'crowd'), RED(), RED(), RED()],
        call: 'blue',
        want: ['crowd'],
        check: r => (r.painted[0] === 'red' ? null : `it painted ${r.painted[0]}`),
    },
    {
        id: 'crowd.nothing',
        say: 'alone, has nobody to paint',
        cubes: [C('octahedron', 'crowd')],
        want: ['crowd.nothing'],
        len: 1,
    },
    {
        id: 'crowd.wild',
        say: 'steps over a wild, which cannot hold a mark',
        cubes: [C('wild', 'wild'), C('octahedron', 'crowd'), RED(), RED(), RED()],
        call: 'blue',
        want: ['crowd.nothing'],
        check: r => (r.painted[0] === null ? null : 'a wild was painted'),
    },
    {
        id: 'crowd.frozen',
        say: 'steps over a frozen cube, which is held on the face it is showing',
        cubes: [C('octahedron', 'crowd'), BLUE({ frozen: true }), RED(), RED(), RED()],
        call: 'blue',
        want: ['crowd.nothing', 'thaw'],
    },
    {
        id: 'crowd.plain',
        say: 'paints an ordinary cube, which carries no face object at all',
        // An ordinary cube forced onto red while the line leans blue. `P({ face })` is the only way
        // to name a plain cube's colour — there is no special to pin it with — and it is exactly
        // the case the crowd used to step over, having read the id off a face object that is not
        // there on an ordinary cube.
        cubes: [P({ face: 'side:red' }), C('octahedron', 'crowd'), BLUE(), BLUE(), BLUE()],
        call: 'blue',
        want: ['crowd'],
        check: r => (r.painted[0] === 'blue' ? null : 'an ordinary cube was not painted'),
    },

    // -----------------------------------------------------------------------
    // The paying faces, which read the line rather than a neighbour
    // -----------------------------------------------------------------------
    {
        id: 'guide',
        say: 'pays for every cube in the unbroken run of your call touching it',
        cubes: [BLUE(), BLUE(), C('guide', 'guide'), BLUE()],
        call: 'blue',
        want: ['guide'],
        check: r => (paidKind(r, 'pay.guide').some(p => p.note.positions === 3)
            ? null : 'wanted a run of three'),
    },
    {
        id: 'guide.broken',
        say: 'counts no further than the first cube that is not yours',
        cubes: [BLUE(), RED(), C('guide', 'guide'), BLUE()],
        call: 'blue',
        want: ['guide'],
        check: r => (paidKind(r, 'pay.guide').some(p => p.note.positions === 1)
            ? null : 'the run crossed a red'),
    },
    {
        id: 'boost',
        say: 'pays for every cube standing when the dust settles, not every cube thrown',
        cubes: [C('boost', 'boost'), C('symbiont', 'twins')],
        want: ['boost'],
        check: r => (paidKind(r, 'pay.boost').some(p => p.note.positions === 4)
            ? null : 'it did not count the grown line'),
    },
    {
        id: 'heat',
        say: 'pays more every time, off the heat already on the cube',
        cubes: [C('turbine', 'heat', { heat: 3 })],
        want: ['heat'],
        check: r => (noteOf(r, 'heat').bonus === config.heatBonus * 4 ? null : 'the wrong step'),
    },
    {
        id: 'heat.iced',
        say: 'held by the ice, pays the same step again rather than spending it',
        cubes: [C('turbine', 'heat', { heat: 1, frozen: true }), P()],
        want: ['heat'],
        check: r => (paidKind(r, 'pay.heat').some(p => p.note.positions === 2)
            ? null : 'the frozen Turbine did not pay its step'),
    },
    {
        id: 'greed.razed',
        say: "pays off the resolved line, so a Greed under Ben's wing pays nothing",
        cubes: [C('greed', 'greed'), C('symbiont', 'raze'), P()],
        want: ['raze'],
        check: r => (paidKind(r, 'pay.greed').length
            ? 'a flattened Greed paid from beyond the grave' : null),
    },
    {
        id: 'greed.mirrored',
        say: 'and the other way round: a reflected Greed pays twice, because there are two',
        cubes: [C('greed', 'greed'), C('mirror', 'mirror')],
        want: ['mirror'],
        check: r => (paidKind(r, 'pay.greed').length === 2 ? null : 'the copy did not pay'),
    },
    {
        id: 'mult.won',
        say: 'doubles only when its own side wins the line',
        cubes: [C('multiplier', 'mult:blue'), BLUE(), BLUE()],
        call: 'blue',
        want: ['mult'],
        check: r => (paidKind(r, 'pay.won').length ? null : 'the Multiplier did not pay'),
    },
    {
        id: 'mult.lost',
        say: 'and pays nothing when it does not',
        cubes: [C('multiplier', 'mult:red'), BLUE(), BLUE()],
        call: 'blue',
        want: ['mult'],
        check: r => (paidKind(r, 'pay.lost').length ? null : 'the Multiplier paid anyway'),
    },
    {
        id: 'pure',
        say: 'pays a bonus per cube when every position on the line is yours',
        cubes: [BLUE(), BLUE(), BLUE()],
        call: 'blue',
        check: r => (r.settled && r.settled.pure ? null : 'not counted as a pure')
            || (paidKind(r, 'pay.pure').length ? null : 'the pure did not pay'),
    },
    {
        id: 'pure.denied',
        say: 'and does not, when a position on the line is not a cube at all',
        cubes: [BLUE(), BLUE(), BLUE(), C('greed', 'greed')],
        call: 'blue',
        check: r => (r.settled && !r.settled.pure ? null : 'an effect face counted toward a sweep'),
    },
    {
        id: 'shortcut',
        say: 'banks a free clear, held rather than awarded until the rung is won',
        cubes: [C('shortcut', 'shortcut'), BLUE(), BLUE()],
        call: 'blue',
        want: ['shortcut'],
        check: r => (r.shortcuts === 1 ? null : `it banked ${r.shortcuts}`),
    },
    {
        id: 'reroll',
        say: 'banks a reroll the same way',
        cubes: [C('reroll', 'reroll'), BLUE(), BLUE()],
        call: 'blue',
        want: ['reroll'],
        check: r => (r.rerolls === 1 ? null : `it banked ${r.rerolls}`),
    },

    // -----------------------------------------------------------------------
    // Welds, which are cubes the press made and every rule above has to hold for
    // -----------------------------------------------------------------------
    {
        id: 'weld.burns',
        say: 'a welded Binder burns like a Binder',
        cubes: [C(WELD, 'burn'), C('greed', 'greed')],
        want: ['burn'],
        len: 1,
    },
    {
        id: 'weld.pays',
        say: "and pays on the Greed Cube's record when it shows the other parent's face",
        cubes: [C(WELD, 'greed'), P()],
        want: ['greed'],
        check: r => (paidKind(r, 'pay.greed').length ? null : 'the weld did not pay')
            || (noteOf(r, 'greed').specialId === WELD ? null : 'the note named the wrong cube'),
    },
    {
        id: 'weld.target',
        say: 'and is an ordinary target while it is showing an ordinary face',
        cubes: [C('binder', 'burn'), C(WELD, 'greed')],
        want: ['burn'],
        len: 1,
        // The Binder's immunity is a property of the *cube*, and a weld carrying Flamejets is a
        // Binder by that reading. It is not: the engine tests the face being shown, and a weld
        // showing Greed burns. Pinned because the other reading is defensible and is not the one.
    },

    // -----------------------------------------------------------------------
    // The endings, and the two shapes that are not one
    // -----------------------------------------------------------------------
    {
        id: 'tie.asked',
        say: 'an even line is parked as a question when the player owns the bribe',
        cubes: [BLUE(), RED()],
        call: 'blue',
        bribe: true,
        check: r => (r.settled ? 'the tie settled instead of parking' : null),
    },
    {
        id: 'tie.broken',
        say: "and is broken by Watto's own cube when they do not",
        cubes: [BLUE(), RED()],
        call: 'blue',
        bribe: false,
        check: r => (r.breaker ? null : 'nobody broke the tie'),
    },
    {
        id: 'overflow',
        say: 'a table that spawns faster than it resolves is given up on rather than hung',
        cubes: Array.from({ length: 7 }, () => C('mirror', 'mirror')),
        check: r => (r.overflow >= config.overflowAt ? null : `it gave up at ${r.overflow}`)
            || (r.settled && r.settled.reason === 'overflow' ? null : 'the wrong ending'),
    },
    {
        id: 'ratts',
        say: 'a line blown away entirely ends the run, and names the cube that did it',
        cubes: [C('greed', 'end')],
        want: ['end'],
        len: 0,
        check: r => (r.settled && r.settled.reason === 'ratts' ? null : 'the wrong ending'),
    },

    // -----------------------------------------------------------------------
    // Side bets, which read the resolved line from outside it
    // -----------------------------------------------------------------------
    {
        id: 'bet.hit',
        say: 'a proposition that landed pays off the same line the cubes were counted on',
        cubes: [C('binder', 'burn'), C('greed', 'greed'), BLUE(), BLUE()],
        call: 'blue',
        bet: 'burn',
        want: ['burn'],
        check: r => (r.betPaid > 0 ? null : `it paid ${r.betPaid}`),
    },
    {
        id: 'bet.miss',
        say: 'and one that did not is reported as a loss rather than as nothing',
        cubes: [BLUE(), BLUE(), BLUE()],
        call: 'blue',
        bet: 'burn',
        check: r => (r.betPaid === 0 ? null : `it paid ${r.betPaid}`),
    },
];

// ---------------------------------------------------------------------------
// The invariants, run on every roll in every phase
// ---------------------------------------------------------------------------

// The nine lists that go on the wire index-for-index against the line. Named here rather than
// spelled out at each place they are checked, because `wire.js` says in as many words that this list
// is a thing that goes stale: a field added to `lineState` and not to the response is a whole
// feature the client cannot see, and it has happened.
const PARALLEL = ['uids', 'mirrored', 'frozen', 'burned', 'painted', 'charred', 'blessed', 'cubeIds', 'holds'];

const invariants = function (roll, where, bad) {
    const n = roll.line.length;
    for (const k of PARALLEL) {
        if (!Array.isArray(roll[k])) { bad(`${where}: ${k} is not a list`); continue; }
        if (roll[k].length !== n) bad(`${where}: ${k} is ${roll[k].length} long, the line is ${n}`);
    }
    if (roll.thrown.length !== roll.thrownState.uids.length) {
        bad(`${where}: the thrown line and its state disagree on length`);
    }
    for (const k of PARALLEL) {
        if (roll.thrownState[k] && roll.thrownState[k].length !== roll.thrown.length) {
            bad(`${where}: thrownState.${k} is the wrong length`);
        }
    }
    (roll.steps || []).forEach((s, i) => {
        for (const k of PARALLEL) {
            if (!Array.isArray(s[k])) { bad(`${where}: step ${i} has no ${k}`); continue; }
            if (s[k].length !== s.faceIds.length) bad(`${where}: step ${i} ${k} is the wrong length`);
        }
        if (!Number.isInteger(s.at)) bad(`${where}: step ${i} has no position`);
    });
    // `held` counts nested holds and `holds` counts only what each position carries, so the total is
    // a floor rather than an equality: a prisoner carrying prisoners is deeper than the row shows.
    const rows = (roll.holds || []).reduce((a, b) => a + b, 0);
    if (roll.held < rows) bad(`${where}: held is ${roll.held}, the row sums to ${rows}`);
    (roll.pays || []).forEach((p, i) => {
        if (!Number.isFinite(p.multiple)) bad(`${where}: pay ${i} has no running multiple`);
        if (p.at < -1 || p.at >= n) bad(`${where}: pay ${i} points at seat ${p.at} of ${n}`);
    });
    for (const note of roll.notes || []) if (!note.kind) bad(`${where}: a note with no kind`);
    if (roll.settled && !['live', 'bust', 'bank'].includes(roll.settled.outcome)) {
        bad(`${where}: it settled as ${roll.settled.outcome}`);
    }
};

// ---------------------------------------------------------------------------
// Throwing one
// ---------------------------------------------------------------------------

const seen = new Set();
const harvest = roll => notesOf(roll).forEach(k => seen.add(k));

// Level 2 and a multiple of 1 by default, which is deep enough that the pay walk has something to
// build on and shallow enough that nothing below depends on where the rung is. The handful that do
// say so.
const roll = spec => sandbox.throwLine({
    call: spec.call || 'blue',
    level: spec.level == null ? 2 : spec.level,
    rungs: spec.rungs || 1,
    mult: spec.mult == null ? 1 : spec.mult,
    bribe: spec.bribe !== false,
    cubes: spec.cubes,
    ...(spec.bag ? { bag: spec.bag } : {}),
    ...(spec.hold ? { hold: spec.hold } : {}),
    ...(spec.bet ? { bet: spec.bet } : {}),
});

// ---------------------------------------------------------------------------
// Watching one
// ---------------------------------------------------------------------------
//
// **A pass is a claim and this is the evidence for it.** `--show` draws every interaction as the
// walk the engine actually took: the line as thrown, one row per turn with the note that turn
// produced, and the line as it settled. It is the same data the Activity animates — `steps` is
// literally what `reveal.js` walks — rendered as text so the whole playlist scrolls past in one
// screenful instead of 127 separate page loads.
//
// A position is drawn as its face id with what it is carrying hung off it, because a face id alone
// cannot tell a frozen Greed from a blessed one and those are most of the interactions here.

const MARKS = [
    ['frozen', '#'],
    ['blessed', '*'],
    ['charred', '!'],
    ['mirrored', '<'],
];

const drawSeat = function (state, i) {
    const id = state.faceIds ? state.faceIds[i] : state.line[i];
    let out = id == null ? '·' : String(id);
    for (const [key, mark] of MARKS) if (state[key] && state[key][i]) out += mark;
    if (state.painted && state.painted[i]) out += state.painted[i] === 'blue' ? '~b' : '~r';
    const burnt = state.burned && state.burned[i];
    if (burnt && burnt.length) out += `-${burnt.length}`;
    if (state.holds && state.holds[i]) out += `+${state.holds[i]}`;
    return out;
};

const drawLine = function (state, faces) {
    const n = (faces || state.faceIds || state.line || []).length;
    if (!n) return '(nothing left)';
    return Array.from({ length: n }, (_, i) => drawSeat(state, i)).join('  ');
};

// The resolved line's state is flat on the response rather than nested, so it is gathered back into
// the shape the steps already use instead of teaching the renderer two layouts.
const settledState = r => ({
    line: r.line,
    frozen: r.frozen,
    blessed: r.blessed,
    charred: r.charred,
    mirrored: r.mirrored,
    painted: r.painted,
    burned: r.burned,
    holds: r.holds,
});

// One column width for every row, or the lines do not stack and the whole point of drawing them
// one above another is lost.
const GUTTER = 20;
const row = (label, body) => `    ${label.padEnd(GUTTER)}${body}`;

const showRoll = function (entry, r) {
    console.log('');
    console.log(`  ${entry.id}  —  ${entry.say}`);
    console.log(row('thrown', drawLine({ ...r.thrownState, faceIds: r.thrown }, r.thrown)));
    for (const step of r.steps || []) {
        const kind = (step.note && step.note.kind) || 'step';
        const where = step.at >= 0 ? `@${step.at}` : '';
        console.log(row(`${kind}${where}`, drawLine(step) + (step.quiet ? '   (nothing moved)' : '')));
    }
    console.log(row('settled', drawLine(settledState(r))));
    const end = r.settled
        ? `${r.settled.outcome}${r.settled.reason ? ` · ${r.settled.reason}` : ''}`
        : 'parked — Watto is asking about the tie';
    const paid = (r.pays || []).length
        ? ` · ×${(r.pays[r.pays.length - 1].multiple).toFixed(2)}`
        : '';
    console.log(row('', `${end}${paid}`));
};

// ---------------------------------------------------------------------------
// Phase 1 — the playlist
// ---------------------------------------------------------------------------

const runPlaylist = async function (fails) {
    let ran = 0;
    const lines = [];
    for (const entry of PLAY) {
        if (ONLY && !entry.id.includes(ONLY)) continue;
        const reps = entry.reps || REPS;
        const problems = [];
        const ever = new Set();
        for (let n = 0; n < reps; n++) {
            const out = await roll(entry);
            ran += 1;
            if (!out.ok) { problems.push(`${out.code}: ${out.message}`); break; }
            const r = out.roll;
            harvest(r);
            // The first repetition only: the rest are the same line thrown again, and a playlist
            // that printed all twenty-four of them would bury the one that is different.
            if (SHOW && !n) showRoll(entry, r);
            const got = notesOf(r);
            got.forEach(k => ever.add(k));
            invariants(r, entry.id, m => problems.push(m));
            for (const kind of entry.want || []) {
                if (!got.includes(kind)) problems.push(`no ${kind} — got ${got.join(', ') || 'nothing'}`);
            }
            for (const kind of entry.never || []) {
                if (got.includes(kind)) problems.push(`${kind} fired and should not have`);
            }
            if (entry.len != null && r.line.length !== entry.len) {
                problems.push(`the line is ${r.line.length} long, wanted ${entry.len}`);
            }
            // The custom check runs only once the wanted notes are all present, because nearly
            // every one of them reaches into a note by kind — a missing note would be reported as a
            // `TypeError` from inside the scenario rather than as the missing note it is.
            if (entry.check && !problems.length) {
                const why = entry.check(r);
                if (why) problems.push(why);
            }
            if (problems.length) break;
        }
        for (const kind of entry.some || []) {
            if (!ever.has(kind)) problems.push(`${kind} never landed in ${reps} throws`);
        }
        const bad = [...new Set(problems)];
        if (bad.length) {
            fails.push(`${entry.id} — ${entry.say}\n    ${bad.slice(0, 3).join('\n    ')}`);
            lines.push(`  FAIL  ${entry.id.padEnd(22)} ${entry.say}`);
        } else if (LOUD) {
            lines.push(`  ok    ${entry.id.padEnd(22)} ${entry.say}`);
        }
    }
    return { ran, lines };
};

// ---------------------------------------------------------------------------
// Phase 2 — the medleys
// ---------------------------------------------------------------------------
//
// Fragments welded end to end with three ordinary cubes between them — one more than a mine's blast
// reach and one more than a dome is wide either side, so the gap is the narrowest one that keeps two
// fragments from becoming a single interaction.
//
// Only fragments marked `medley` go in, and three further rules cut that set down. All three say
// the same thing — a fragment is welded onto a line only when its expectation is a property of the
// fragment and not of the table it is standing on:
//
//   * **No expectation of an absence.** `burn.nothing`, `freeze.already`, `draw.empty` and every
//     `scorch.spared` are claims that a neighbour was missing or was the only one there. Give the
//     cube a spacer to its other side and the claim is false, correctly — so these are proved alone
//     and left out here rather than marked as failures for behaving.
//   * **Nothing that reaches off the table.** A fragment naming a `bag` or a `hold` shares it with
//     every other fragment on the line, and two droids drawing from one bag is a different
//     scenario from the one that was written.
//   * **One call.** The engine takes a single `call` for the whole line and the fragments about
//     sides disagree about which, so a medley is thrown only on a call they all named.

const SPACER = 3;

const ABSENCE = /\.(nothing|already|empty|spared)$/;
const weldable = e => e.medley
    && !(e.want || []).some(k => ABSENCE.test(k))
    && !(e.bag || e.hold);

const medleys = async function (fails) {
    const pool = PLAY.filter(e => weldable(e) && (!ONLY || e.id.includes(ONLY)));
    if (pool.length < 2) return { ran: 0, longest: 0 };
    let ran = 0;
    let longest = 0;
    for (let m = 0; m < MEDLEYS; m++) {
        const take = 2 + Math.floor(Math.random() * 4);
        const picks = Array.from({ length: take },
            () => pool[Math.floor(Math.random() * pool.length)]);
        const calls = new Set(picks.map(p => p.call || 'blue'));
        if (calls.size > 1) continue;

        const cubes = [];
        for (const p of picks) {
            if (cubes.length) for (let s = 0; s < SPACER; s++) cubes.push(P());
            cubes.push(...p.cubes);
        }
        const out = await roll({ cubes, call: [...calls][0] });
        ran += 1;
        longest = Math.max(longest, cubes.length);
        if (!out.ok) {
            fails.push(`medley — ${picks.map(p => p.id).join(' + ')}\n    ${out.code}: ${out.message}`);
            continue;
        }
        const r = out.roll;
        harvest(r);
        const problems = [];
        invariants(r, 'medley', msg => problems.push(msg));
        const got = notesOf(r);
        for (const entry of picks) {
            for (const kind of entry.want || []) {
                if (!got.includes(kind)) problems.push(`${entry.id} lost its ${kind}`);
            }
        }
        if (problems.length) {
            fails.push(`medley, ${cubes.length} cubes — ${picks.map(p => p.id).join(' + ')}`
                + `\n    ${[...new Set(problems)].slice(0, 4).join('\n    ')}`);
        }
    }
    return { ran, longest };
};

// ---------------------------------------------------------------------------
// Phase 3 — the hunt
// ---------------------------------------------------------------------------

const ALL_IDS = SPECIALS.map(s => s.id);
const FACES = new Map(SPECIALS.map(sp => [sp.id, [...new Set(sp.faces.map(f => f.id))]]));
const pick = a => a[Math.floor(Math.random() * a.length)];

const wildSpot = function () {
    if (Math.random() < 0.2) {
        return {
            frozen: Math.random() < 0.3,
            blessed: Math.random() < 0.3,
            painted: Math.random() < 0.3 ? pick(['red', 'blue']) : null,
        };
    }
    const id = pick(ALL_IDS);
    return {
        id,
        // A face left unnamed is rolled off the cube standing there, which is the only way the hunt
        // reaches a weld-free face distribution rather than a uniform one.
        face: Math.random() < 0.85 ? pick(FACES.get(id)) : null,
        frozen: Math.random() < 0.15,
        blessed: Math.random() < 0.15,
        mirrored: Math.random() < 0.2,
        heat: Math.random() < 0.15 ? 1 + Math.floor(Math.random() * 3) : 0,
        holds: Math.random() < 0.15 ? 1 + Math.floor(Math.random() * 4) : 0,
        painted: Math.random() < 0.15 ? pick(['red', 'blue']) : null,
    };
};

// Always the full budget, even when the playlist already reached every kind. Chasing a missing note
// is half of what this phase is for; the other half is running the invariants over lines nobody
// would think to write, and that half does not stop being worth doing on a green run.
const hunt = async function (fails, wanted) {
    const found = new Map();
    let ran = 0;
    for (let n = 0; n < HUNT; n++) {
        const cubes = Array.from({ length: 1 + Math.floor(Math.random() * 10) }, wildSpot);
        const out = await roll({
            cubes,
            call: pick(['red', 'blue']),
            level: Math.floor(Math.random() * 5),
            rungs: 1 + Math.floor(Math.random() * 4),
            bribe: Math.random() < 0.5,
            bag: Math.random() < 0.7 ? [pick(ALL_IDS), pick(ALL_IDS)] : [],
            hold: Math.random() < 0.5 ? [pick(ALL_IDS)] : [],
        });
        ran += 1;
        if (!out.ok) {
            // A rolled face the cube cannot show is this generator's mistake and not the engine's;
            // anything else is a refusal worth seeing.
            if (out.code !== 'no_such_face') fails.push(`hunt: ${out.code}: ${out.message}`);
            continue;
        }
        const r = out.roll;
        invariants(r, 'hunt', msg => fails.push(`hunt — ${msg}\n    ${JSON.stringify(cubes)}`));
        for (const kind of notesOf(r)) {
            seen.add(kind);
            if (wanted.has(kind) && !found.has(kind)) found.set(kind, cubes);
        }
    }
    return { ran, found };
};

// ---------------------------------------------------------------------------
// Phase 4 — coverage
// ---------------------------------------------------------------------------

// Every note kind the engine can emit. Written out rather than derived, because the point of the
// list is to be *disagreed with*: `stray()` scans `engine.js` for kinds this does not name, so a
// face added next month shows up as untested instead of quietly never being thrown.
const ALL_NOTES = [
    'side', 'wild', 'greed', 'seam', 'boost', 'mult', 'heat', 'guide', 'shortcut', 'reroll',
    'mirror', 'mirror.nothing', 'mirror.noroom', 'invert',
    'end', 'end.shielded', 'broken',
    'burn', 'burn.nothing', 'burn.fireproof', 'burn.walled', 'burn.iced', 'burn.blessed',
    'clone', 'clone.alone', 'clone.walled', 'clone.blessed', 'clone.destroy', 'clone.append',
    'clone.noroom',
    'cull', 'cull.shield', 'cull.nothing', 'cull.blessed',
    'raze', 'raze.nothing', 'raze.blessed',
    'pair', 'pair.noroom', 'twins', 'twins.noroom',
    'draw', 'draw.empty', 'draw.noroom',
    'scavenge', 'scavenge.empty', 'scavenge.noroom',
    'haul', 'haul.nothing', 'haul.walled', 'haul.rubble',
    'purge', 'purge.nothing',
    'engine', 'engine.walled', 'engine.nothing', 'engine.already', 'engine.iced',
    'freeze', 'freeze.already', 'freeze.nothing', 'thaw',
    'scorch', 'scorch.nothing', 'scorch.spared',
    'vault', 'jail', 'jail.nothing',
    'plunge', 'plunge.nothing',
    'crowd', 'crowd.nothing',
    'blessing', 'blessing.nothing',
    'parole', 'hold.break', 'overflow',
];

// Kinds nothing can produce, and why — so an empty column reads as a fact about the rules rather
// than as a gap in this file. They are left in `ALL_NOTES` on purpose: the day one of these reasons
// stops being true they stop being unreachable, and should start being tested rather than forgotten.
const UNREACHABLE = {
    'mirror.noroom': 'maxCubes is Infinity, so no growing face has ever met a full table',
    'clone.noroom': 'maxCubes is Infinity',
    'pair.noroom': 'maxCubes is Infinity',
    'twins.noroom': 'maxCubes is Infinity',
    'draw.noroom': 'maxCubes is Infinity',
    'scavenge.noroom': 'maxCubes is Infinity',
    'purge.nothing': 'the Pit Droid is itself a special, so Order 66 always has one target',
    'plunge.nothing': 'both walks stop at the thrower at the latest, so a chasm always has itself',
};

// What `engine.js` emits that this file has never heard of. A regex over source is a blunt
// instrument and the right one here: the alternative is a list that goes quietly stale, which is the
// exact failure the scan exists to catch.
const stray = function () {
    const src = fs.readFileSync(require.resolve('../src/game/cube/engine.js'), 'utf8');
    const out = new Set();
    // Three spellings, and only three: `note(c, 'kind'`, the ternary form `note(c, x ? 'a' : 'b'`,
    // and a note pushed by hand. Anchored on `note` and `notes.push` rather than searching for
    // `kind:` anywhere, which also matches face kinds, pay kinds and the two `kind:` fields on a
    // step — every one of which reported itself as an unknown note the first time this ran.
    for (const m of src.matchAll(/note\(c,\s*'([a-z.0-9]+)'/g)) out.add(m[1]);
    for (const m of src.matchAll(/note\(c,[^,]*\?\s*'([a-z.0-9]+)'\s*:\s*'([a-z.0-9]+)'/g)) {
        out.add(m[1]);
        out.add(m[2]);
    }
    for (const m of src.matchAll(/notes\.push\(\{\s*\n?\s*kind:\s*'([a-z.]+)'/g)) out.add(m[1]);
    // A ward suffixes its note with a reason worked out at the site — `burn.${warded(x)}` and the
    // two beside it — so the halves are spelled apart and cannot be scanned for. Named here so the
    // scan does not have to understand them, and so that removing a ward shows up as a note this
    // file still lists and nothing produces.
    const composed = ['burn.iced', 'burn.blessed', 'clone.blessed', 'cull.blessed'];
    return [...out, ...composed].filter(k => !ALL_NOTES.includes(k));
};

// ---------------------------------------------------------------------------
// The playlist, as something you can watch
// ---------------------------------------------------------------------------
//
// **The Activity already has the page for this.** `junkyard/src/activity/sandbox.js` is the picker
// this file's scenarios are written in longhand — name the cubes, name the faces, throw *that* — and
// it draws the result as steppable frames with the real reveal. What it has never had is a list of
// lines worth throwing: its preset dropdown loads `fixtures.json`, which is rolls a sweep *caught*,
// so every entry in it is a shape that happened to turn up rather than an interaction somebody meant
// to look at.
//
// This is that list. Every scenario below, in the exact shape the picker's spots already use, with
// the sentence saying what it is for — so the dropdown becomes a guided tour of the rules and each
// entry is thrown live against `POST /cube/sandbox/roll` rather than replayed from a recording.
//
// Written rather than imported because the two repos do not share a module. It is generated on
// purpose, for the reason `cubeFixtures.js` gives: a hand-kept copy of this list drifts from the
// scenarios the first time one is added, and then the tour is missing the newest rule.

const asSpot = spot => ({
    id: spot.id || null,
    face: spot.face || null,
    frozen: !!spot.frozen,
    blessed: !!spot.blessed,
    mirrored: !!spot.mirrored,
    painted: spot.painted || null,
    burned: [...(spot.burned || [])],
    heat: Number(spot.heat) || 0,
    holds: Number(spot.holds) || 0,
});

const writePresets = function (to) {
    const out = {};
    for (const entry of PLAY) {
        out[entry.id] = {
            say: entry.say,
            call: entry.call || 'blue',
            level: entry.level == null ? 2 : entry.level,
            rungs: entry.rungs || 1,
            mult: entry.mult == null ? 1 : entry.mult,
            bribe: entry.bribe !== false,
            // Only when the scenario named one. An empty bag and an empty hold are meaningfully
            // different from "whatever a fresh run would hold", which is what the route fills in.
            ...(entry.bag ? { bag: [...entry.bag] } : {}),
            ...(entry.hold ? { hold: [...entry.hold] } : {}),
            ...(entry.bet ? { bet: entry.bet } : {}),
            cubes: entry.cubes.map(asSpot),
        };
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, `${JSON.stringify(out, null, 2)}\n`);
    return Object.keys(out).length;
};

// ---------------------------------------------------------------------------

(async () => {
    const started = Date.now();
    const fails = [];

    const one = await runPlaylist(fails);
    const two = await medleys(fails);

    const missing = new Set(ALL_NOTES.filter(k => !seen.has(k) && !UNREACHABLE[k]));
    const three = await hunt(fails, missing);

    if (one.lines.length) console.log(one.lines.join('\n'));

    const played = ONLY ? PLAY.filter(e => e.id.includes(ONLY)).length : PLAY.length;
    console.log('');
    console.log(`playlist    ${played} interactions, ${one.ran} throws`);
    console.log(`medleys     ${two.ran} long lines, up to ${two.longest} cubes`);
    console.log(`hunt        ${three.ran} random lines`);
    console.log(`coverage    ${seen.size} of ${ALL_NOTES.length} note kinds`);

    const holes = [...three.found.keys()];
    if (holes.length) {
        console.log('');
        console.log('These fire in the game and no scenario above asks for one. A hole in the');
        console.log('playlist, not in the engine:');
        for (const k of holes) console.log(`  ${k}`);
    }

    const still = ALL_NOTES.filter(k => !seen.has(k));
    const dead = still.filter(k => !UNREACHABLE[k]);
    if (dead.length) {
        console.log('');
        console.log('Nothing reached these, by hand or at random. Either the line that produces one is');
        console.log('harder to build than the hunt is wide, or the engine no longer emits it:');
        for (const k of dead) console.log(`  ${k}`);
    }

    const byDesign = still.filter(k => UNREACHABLE[k]);
    if (byDesign.length) {
        console.log('');
        console.log('Unreachable by construction, which is a fact about the rules:');
        for (const k of byDesign) console.log(`  ${k.padEnd(17)} ${UNREACHABLE[k]}`);
    }

    const unknown = stray();
    if (unknown.length) {
        console.log('');
        console.log('`engine.js` emits these and this file has never heard of them — add them above:');
        for (const k of unknown) console.log(`  ${k}`);
    }

    if (PRESETS) {
        // After the run, not before: a preset that does not do what its sentence says is worse than
        // no preset, so the tour is only written once the playlist has agreed it is honest.
        const n = writePresets(PRESETS);
        console.log('');
        console.log(`${n} presets written to ${PRESETS}`);
        console.log('Pick one from "load a preset" on the Activity\'s sandbox page.');
    }

    console.log('');
    if (fails.length) {
        console.log(`${fails.length} failures`);
        console.log('');
        for (const f of fails.slice(0, 40)) console.log(`  ${f}`);
        if (fails.length > 40) console.log(`  ...and ${fails.length - 40} more`);
        process.exitCode = 1;
    } else {
        console.log(`OK — every interaction behaved, in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
})();
