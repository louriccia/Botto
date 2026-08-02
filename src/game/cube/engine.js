// The rules of Botto's Chance Cube. No Discord, no database, no rendering — throw a set of cubes
// in, get back what the line resolved to and everything it did to the run.
//
// **Notes are structured, not written.** Every effect reports what it did as data — a kind and its
// parameters — and the client turns that into prose. The engine used to emit Discord markdown with
// custom emoji baked into it, which meant the rules could only be played in an embed. What a face
// looks like and what it says about itself are both somebody else's problem now.
//
// Randomness is `crypto.randomInt` throughout, the same CSPRNG that decides every payout. Nothing
// here is seedable by design; the parity harness patches the module when it needs determinism.

const crypto = require('crypto');
const moment = require('moment');
require('moment-timezone');

const { LEVELS, SPECIALS, SIDES, cube: config } = require('./tuning.js');

const OTHER = { blue: 'red', red: 'blue' };
exports.OTHER = OTHER;

const specialById = id => SPECIALS.find(s => s.id === id) || null;
exports.specialById = specialById;

exports.MAX_LEVEL = LEVELS.length - 1;

// ---------------------------------------------------------------------------
// Randomness and the daily lean
// ---------------------------------------------------------------------------

// Every weighted coin in the mode goes through here.
const chance = p => crypto.randomInt(0, 10000) < Math.round(p * 10000);
exports.chance = chance;

// Which side Watto leans on today. Derived from the date rather than stored: no rollover race,
// no extra node to keep in sync, and the same day always leans the same way — so two players
// rolling an hour apart are playing the same cube. Memoised because a nine-cube roll would
// otherwise hash the date nine times.
//
// Eastern time, matching the daily challenge boundary, so the cube turns over when the rest of
// the bot's day does.
//
// **The salt is secret and has to be.** A lean is unguessable to a human — spotting 55/45 needs
// a few hundred cubes tallied inside one Eastern day, through the noise of every special cube
// that forces a side — but this repo is public, so a hardcoded salt makes the day's favoured
// side a two-line script rather than an inference. Knowing it is worth a great deal: calling the
// favoured side lifts a level 5 run from 1-in-32 to about 1-in-14, which is an EV of 2.27 on a
// ladder that is otherwise exactly fair. Out of the source and into the environment, so the
// property that makes the lean fun — everyone rolling the same cube — costs nothing to keep.
//
// Every client must share the salt, or two players on the same day are no longer on the same cube,
// which is the one property the whole mechanic is for.
const LEAN_SALT = process.env.CUBE_LEAN_SALT;
if (!LEAN_SALT) {
    console.warn('[cube] CUBE_LEAN_SALT is not set — the daily lean is derived from a public '
        + 'fallback and can be computed by anyone with the source. Set it in the environment.');
}
let leanCache = null;
const dailyLean = function () {
    const day = moment().tz('America/New_York').format('YYYY-DDDD');
    if (!leanCache || leanCache.day !== day) {
        const h = crypto.createHash('sha256')
            .update(`${LEAN_SALT || 'chance-cube-lean'}:${day}`).digest();
        leanCache = { day, side: h[0] % 2 ? 'red' : 'blue' };
    }
    return leanCache;
};
exports.dailyLean = dailyLean;

// Every plain cube in the game comes through here, so the lean applies to the whole table at
// once — the level's own cubes and any a special spawns.
const rollSide = function () {
    const { side } = dailyLean();
    return chance(config.dayLean) ? side : OTHER[side];
};
exports.rollSide = rollSide;

// Watto's tie-breaker. Deliberately *not* a plain cube and deliberately not drawn through
// `rollSide`: the daily lean favours a colour, and this thing favours the house — it leans
// against whatever you called, whichever colour that is. Qui-Gon's Nudge doesn't remove the
// weight, it turns it around, so a tie is always somebody's coin flip and never a fair one.
exports.rollTiebreak = function (call, nudge) {
    const favoured = nudge ? call : OTHER[call];
    return chance(config.tieLean) ? favoured : OTHER[favoured];
};

// ---------------------------------------------------------------------------
// The payout multiple
// ---------------------------------------------------------------------------

// Multiplier Cubes only pay if their own side is the side that won, which isn't known until the
// line is counted — and on a tie, not until Watto's cube has landed on top of it. So the sides
// come back out of `resolveLine` unspent and the caller applies them once it has a winner.
//
// Each one **adds** `multBonus` to the running multiplier rather than multiplying it, so three of
// them on the winning side is ×4 rather than ×8 — see `greedBonus` in the tuning data for why.
const applyMults = (mult, mults, side) => (side
    ? Object.values(mults || {}).reduce((m, s) => (s === side ? m + config.multBonus : m), mult)
    : mult);
exports.applyMults = applyMults;

// Phase two of a reveal: the paying faces counted out one at a time, with the multiple the roll
// stands at after each one.
//
// It exists because the multiple used to arrive fully formed on the payout frame. A rack that
// threw three paying faces showed ×4 on the throw and ×6.5 on the payout, and which cubes did that
// — or that three of them did anything at all — was left to be inferred from a row of glyphs. The
// multiple is the one number in the mode that builds rather than being drawn, so it is worth
// watching build.
//
// Deliberately **after** the cubes and the effects, and not merged into them. A Multiplier only
// pays if its own named side is the side that won, so there is nothing to count until the line has
// an answer — and on a tie, not until Watto's cube has landed on top of it. Greed could have gone
// earlier, but splitting the two would mean two different rules for the same climbing number.
//
// `start` is the multiple with none of them counted, so the last step lands exactly on what
// `applyMults` pays. This decides nothing: it replays a sum that has already been settled.
exports.multSteps = function (start, pays, side) {
    let running = Number(start) || 0;
    return (pays || []).map((p) => {
        const paid = p.kind === 'greed' || (!!side && p.side === side);
        if (paid) running += p.kind === 'greed' ? config.greedBonus : config.multBonus;
        // Past tense, and that is the point of reporting it here rather than reusing the note the
        // first pass wrote. On the throw a Multiplier is a promise — `+1× if red wins` — and by
        // this frame the roll knows whether red did. A face that named the losing side gets a step
        // of its own rather than being skipped: it was on the table, it is still on the table, and
        // silence would read as a bug.
        const note = {
            kind: p.kind === 'greed' ? 'pay.greed' : paid ? 'pay.won' : 'pay.lost',
            faceId: p.faceId,
            specialId: p.specialId,
            specialName: p.specialName,
            side: p.side,
            bonus: p.kind === 'greed' ? config.greedBonus : config.multBonus,
        };
        return { at: p.at, paid, note, multiple: running };
    });
};

// Payouts are a clean double per level, cumulative on the original stake. `mult` is whatever
// the Greed and Multiplier cubes have piled on during the run — it rides the standing rather
// than being re-earned, so a multiplier caught early compounds all the way up.
//
// The multiple doubles on every push, exactly as `LEVELS` does, and a paying face adds to it:
//
//     L1  ×2   →  L2  ×4  ── a Multiplier lands ──▸ ×5
//                  L3  ×10      L4  ×20      L5  ×40
//
// So a +1 caught early is worth +8 by the top, and one caught on the last rung is worth +1. That is
// the whole point of catching one early, and it is what neither of the two previous shapes did:
// multiplying the *whole* payout made a single cube worth 32× a stake at Level 5 and exploded on a
// copying rack, while adding to the level's own multiple left the bonus shrinking to 3% of a ×32 —
// unplayable at depth however large the number was made.
exports.bankPayout = (stake, multiple) => Math.floor(stake * (Number(multiple) || 0));

// What one push does to the multiple: the ratio between this level's multiple and the one below.
// Read off `LEVELS` rather than hardcoded at 2, so re-tuning the ladder carries the multiple with it.
const ladderStep = levelIdx => (levelIdx > 0
    ? LEVELS[levelIdx].payout / LEVELS[levelIdx - 1].payout
    : 1);
exports.ladderStep = ladderStep;

// The multiple a run stands at on a given level: what it carried in, stepped up for the push, plus
// anything this level's own faces added.
const levelMultiple = (levelIdx, carried, added = 0) => (Number(carried) || 0
    ? (Number(carried) * ladderStep(levelIdx)) + added
    : LEVELS[levelIdx].payout + added);
exports.levelMultiple = levelMultiple;

// ---------------------------------------------------------------------------
// The bag
// ---------------------------------------------------------------------------

const bagSize = () => config.cubesPerLevel * (LEVELS.length - 1);
exports.bagSize = bagSize;

// The bag a run draws from, shuffled once when the run starts and never refilled.
//
// It holds **one entry per cube the climb will ever add** — every special on the rack, padded out
// with ordinary cubes — and each level pulls `cubesPerLevel` off the top. Nothing goes back in.
//
// Drawing *without replacement* is the whole mechanic, and it gives the escalation for free: a rack
// you equipped is a rack you will actually meet, and the only question is when. With one special in
// a bag of eight the four pulls run **25% → 33% → 50% → certain**, climbing exactly as long as the
// bag keeps handing you ordinary cubes. That first 25% is precisely the flat per-cube chance this
// replaced, so a run opens feeling the same and everything after it is the bag doing the work.
//
// It also retires `spent` as a draw rule: a special can only be in the bag once, so a shattered one
// can never come back simply because there is nothing left to draw.
//
// Two cubes are never from the bag — the one Level 1 opens with, which is always ordinary so the
// set has something to decide a roll with, and Watto's tie-breaker, which is his.
const fillBag = function (equipped) {
    const n = bagSize();
    const specials = (equipped || []).filter(id => specialById(id)).slice(0, n);
    const bag = [...specials, ...Array.from({ length: Math.max(0, n - specials.length) }, () => null)];
    for (let i = bag.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
};
exports.fillBag = fillBag;

// Adds this level's cubes to the set, off the top of the bag. Returns both, because drawing spends
// the bag and the run has to carry what's left of it.
exports.drawCubes = function (set, bag, levelIdx) {
    const rest = [...(bag || [])];
    // Level 1 opens the run, with one ordinary cube that doesn't come out of the bag.
    if (levelIdx === 0) return { set: [null], bag: rest };

    const out = [...(set || [])];
    for (let i = 0; i < config.cubesPerLevel && rest.length; i++) out.push(rest.shift());

    // A set with nothing ordinary left in it has nothing to decide a roll. Only reachable when the
    // rack fills the bag outright and the opening cube has since been destroyed.
    if (out.length && !out.some(slot => !slot)) out[out.length - 1] = null;
    // A mirrored set can already be at the ceiling; adding to it would put the table past what a
    // line can hold. Trimmed from the end, so the cubes a level just added are the ones that don't
    // fit rather than the ones that have been carried the furthest.
    return {
        set: out.length > config.maxCubes ? out.slice(0, config.maxCubes) : out,
        bag: rest,
    };
};

// The set crosses Firebase, and **Firebase deletes nulls** — writing `null` to a key removes it. A
// set is mostly plain cubes, which are `null` in memory, so it round-tripped catastrophically:
//
//   [null]                 ->  the whole key vanishes
//   [null, null, null]     ->  the whole key vanishes
//   [null, null, 'greed']  ->  { 2: 'greed' }, which reads back as a set of ONE
//
// A run therefore lost every plain cube it owned on the way to the database and grew from whatever
// survived, which is why levels appeared to add one cube instead of two. Plain cubes are stored as
// `0` instead — a real value RTDB keeps, and one that can't collide with a special's id.
//
// Every read of a stored set goes through `decodeSet` and every write through `encodeSet`. Any
// other transport must preserve this: it looks like a quirk to clean up and it is load-bearing.
exports.encodeSet = set => (set || []).map(id => id || 0);
exports.decodeSet = raw => Object.values(raw || {}).map(v => (v ? String(v) : null));

// ---------------------------------------------------------------------------
// Throwing and resolving
// ---------------------------------------------------------------------------

// Throws every cube in the set. Plain cubes roll a side; special cubes roll a face, and their side
// is settled by `resolveLine` — an effect face has none at all.
//
// **The cubes land in a new order every throw.** Position is a property of the throw, not of the
// cube: a Binder that burned the cube on its right last level comes down somewhere else entirely
// this one, a Mirror has a different half of the line behind it, and the two cubes a level adds
// aren't stuck on the end where they were appended. Without this, every position-dependent face
// resolved against the same neighbours for the whole climb, which made a carried set far more
// predictable than a thrown one has any business being.
//
// Fisher-Yates off the CSPRNG, like every other draw that decides a payout.
exports.throwSet = function (set) {
    const order = [...(set || [])];
    for (let i = order.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order.map(id => {
        const special = id ? specialById(id) : null;
        return {
            side: rollSide(),
            special,
            face: special ? special.faces[crypto.randomInt(0, special.faces.length)] : null,
        };
    });
};

// How a face is keyed in the lifetime tallies, and the id it draws as. The kind alone isn't
// enough — Shmi's four red and one blue are both `side`, and the Multiplier's two halves are both
// `mult` — and those are exactly the splits worth seeing. Safe as a Firebase key: no dots, slashes
// or brackets.
//
// The tuning declares the same string as each face's `id`, so this and `faceIdOf` agree by
// construction rather than by coincidence.
const faceKey = f => (f.side ? `${f.kind}:${f.side}` : f.kind);
exports.faceKey = faceKey;

// The id for one position. Exactly one per position, always — a face either *is* a side, in which
// case it draws as that side, or it *does* something, in which case it draws as the thing it does
// and counts toward neither colour. Nothing is ever composed out of two, because a position that
// draws as two is a position players count as two.
const faceIdOf = function (cube) {
    if (cube.wild) return 'wild';
    // A face with no id of its own is an ordinary cube's face — the plain half of a hybrid — and
    // draws as whichever side it rolled, exactly like the cube it stands in for.
    if (cube.face && cube.face.id) return cube.face.id;
    return cube.side ? `side:${cube.side}` : 'hidden';
};
exports.faceIdOf = faceIdOf;

// What the reveal animates: one id per position, snapshotted *before* resolution, because
// resolving inverts and reorders the line the payout frame draws.
exports.rolledFaces = line => line.map(faceIdOf);

// Resolves a composed line into the cubes that actually get counted, plus everything the
// special cubes did to the payout and the run.
//
// Two passes, because a cube's own side has to be settled before anything starts copying,
// inverting or fusing cubes around it:
//   1. faces that decide the side of the position they landed on, and the modifiers that
//      only touch the payout or the run.
//   2. faces that restructure the line, left to right — the order they were rolled in. A
//      cube burned or bound away by an earlier effect no longer gets its turn.
//
// **This mutates `line`.** The first pass strips the side off every effect face in place, and
// `enliven` marks copies on objects the caller handed in. Snapshot `rolledFaces(line)` before
// calling if you need the line as it was thrown — the reveal does exactly that.
//
// Returns the final line, notes describing what fired (in fire order, for the payout frame),
// and the modifiers the caller settles with.
const resolveLine = function (line, call) {
    // Every special face **as thrown**, for the lifetime tallies on the rack screen. Taken here,
    // before anything resolves, because resolution rewrites faces — an invert strips a Shmi's art,
    // a bind swaps a Binder for a hybrid — and the tally is about what the cube rolled, not what it
    // was left as.
    const faceLog = line
        .filter(c => c.special && c.face)
        .map(c => ({ id: c.special.id, key: faceKey(c.face) }));

    const notes = [];
    const broken = [];
    // What this roll **adds** to the run's payout multiplier, not a factor to scale it by. Starts at
    // zero because a roll with no paying faces in it adds nothing; the run's own ×1 lives on the
    // ladder and the caller sums the two.
    let mult = 0;
    let shortcut = false;
    let rerolls = 0;
    let ended = null;

    // Every face that moves the payout multiple, recorded **where the multiple is actually moved**
    // rather than reconstructed afterwards from the line. That is the whole reliability of phase two
    // of the reveal: what plays back on screen is the same list of additions that got paid, in the
    // same order, so the walk cannot drift from the number at the end of it. See `multSteps`.
    const pays = [];

    // One note is one thing that happened, as data. `kind` is the note's own kind rather than the
    // face's, because several faces report differently depending on what they found next to them —
    // a clone at the head of the line destroys, and that is a different sentence from a clone.
    const note = (c, kind, data) => notes.push({
        kind,
        faceId: faceIdOf(c),
        specialId: c.special ? c.special.id : null,
        specialName: c.special ? c.special.name : null,
        ...data,
    });
    // What a paying face records for the multiplier walk: enough to name and draw itself later,
    // when the line it was standing on has already been resolved out from under it.
    const pay = (c, kind, side) => pays.push({
        cube: c,
        kind,
        side,
        faceId: faceIdOf(c),
        specialId: c.special ? c.special.id : null,
        specialName: c.special ? c.special.name : null,
    });

    // A face either *is* a side or *does* a thing. Every position starts life as a plain cube with
    // a rolled side; a special that lands an effect face on one takes that side away, so the
    // position holds its place in the line and contributes to neither colour.
    //
    // This is what stops a face having to say two things at once, which is what forced effect faces
    // to be drawn as a colour square plus an effect and made a seven-cube line read as nine. It also
    // means an effect takes a cube out of the count without shortening the line, so even counts are
    // now common — survivable only because a tie goes to Watto's tie-breaker instead of the house.
    const SIDED = new Set(['wild', 'side']);
    for (const c of line) {
        if (c.face && !SIDED.has(c.face.kind)) c.side = null;
    }

    for (const c of line) {
        if (!c.face) continue;
        switch (c.face.kind) {
            case 'end':
                // RIPratts. Whether he actually ends the run isn't decided here — it depends on
                // whether he is still on the table once the effects have finished with it. See
                // below the second pass.
                note(c, 'end');
                break;
            case 'broken':
                // Wipeout. Handled in the **second** pass, not here — see the `broken` case there.
                break;
            case 'wild':
                c.side = call;
                note(c, 'wild', { side: call });
                break;
            case 'side':
                c.side = c.face.side;
                note(c, 'side', { side: c.face.side });
                break;
            case 'greed':
                mult += config.greedBonus;
                note(c, 'greed', { bonus: config.greedBonus });
                pay(c, 'greed', null);
                break;
            case 'mult':
                // The one face that *names* a side without being one: it says which way it pays,
                // and like every other effect face it counts toward neither. Whether it actually
                // pays is settled after the second pass, not here — see `mults` below.
                note(c, 'mult', { side: c.face.side, bonus: config.multBonus });
                break;
            case 'shortcut':
                shortcut = true;
                note(c, 'shortcut');
                break;
            case 'reroll':
                // Banks a reroll and the cube stays on the table. It used to shatter itself here,
                // which meant every single payout reported a shatter and the cube never once
                // rendered as the thing that actually breaks it. Only a wipeout shatters, on this
                // cube as on every other — that is what the shatter line is for.
                rerolls += 1;
                note(c, 'reroll');
                break;
            default:
                break;
        }
    }

    // The working line. Overwritten, reflected and fused cubes are plain — they carry no face of
    // their own, so nothing can cascade off them.
    let final = line.slice();
    const plain = side => ({ side, special: null, face: null });
    const at = c => final.indexOf(c);
    // A position that counts. Destructive faces work on positions — burning an effect off the line
    // is as legitimate as burning a cube — but anything that *copies* or *fuses* sides needs a side
    // to work with, and an effect hasn't got one.
    const isCube = c => !!c && !!c.side;
    // A cube destroyed *in place*: it holds its position so the line can draw what happened to it,
    // counts toward neither side, and is dropped from the set — so the table is genuinely shorter
    // from the next level on, it just doesn't vanish mid-picture. Ben's wings are the only user.
    // `mirrored` is the same picture facing the other way, for art that has a handedness. Ben's
    // left third is the only user: reflected, it has to come back as his right third or the
    // reflection draws him inside out.
    const razed = (id, mirrored) => ({
        side: null, special: null, gone: true,
        face: { kind: 'razed', id, mirrored },
    });

    // The line as each restructuring face leaves it, in fire order, so the roll can be played back
    // one effect at a time instead of cutting from the throw straight to the aftermath. A step is
    // only recorded when the face actually changed something — a mirror with nothing behind it, or
    // a bind at the end of the line, did nothing worth a frame.
    const steps = [];

    // A copy of a face is a real face and gets its own turn — a cloned Greed pays twice, a
    // reflected Tusken culls twice. That needs a **work queue** rather than a walk over the thrown
    // line, because the line grows turns as it resolves.
    //
    // Two rules bound it, and without them it doesn't terminate:
    //
    //   1. **Only an original hands out turns.** A copy acts, but anything *it* copies is inert.
    //      One level deep, so a Binder cloning a Binder cloning a Binder stops at the second.
    //   2. **A mirror reflected by a mirror never acts.** That is the one cascade with no natural
    //      end — a reflection that reflects reflects again — and it is also the only case the two
    //      rules disagree about. A Binder *cloning* a mirror does work: cloning is a single copy
    //      with a fixed target, so it can't feed itself.
    const queue = line.slice();

    for (let q = 0; q < queue.length; q++) {
        const c = queue[q];
        if (!c.face) continue;
        const i = at(c);
        // Destroyed before its turn came round.
        if (i < 0) continue;
        const was = final.map(faceIdOf);
        const noteAt = notes.length;

        // A copy never went through the first pass, so the payout-side half of its face is applied
        // here, the first time it comes up. Originals already had theirs.
        //
        // `mult` and `end` are deliberately absent: both are read off the *resolved* line further
        // down, so a copy of either already counts without being told to. `broken` is absent too —
        // the special shattered once, and the copy carries `gone` across on its own.
        if (c.copy) {
            switch (c.face.kind) {
                case 'greed':
                    mult += config.greedBonus;
                    // A copy gets no entry in `notes` — nothing has ever shown them — but it very
                    // much gets a frame, because it moved the multiple like any other face.
                    pay(c, 'greed', null);
                    break;
                case 'shortcut':
                    shortcut = true;
                    break;
                case 'reroll':
                    rerolls += 1;
                    break;
                default:
                    break;
            }
        }

        // Hands a freshly made copy its own turn, subject to the two rules above. `reflected` marks
        // copies a mirror made, which is the only place rule 2 applies.
        const enliven = function (x, reflected) {
            if (c.copy) return x;
            if (reflected && x.face && x.face.kind === 'mirror') return x;
            x.copy = true;
            queue.push(x);
            return x;
        };
        // Art with a handedness turns around when it is duplicated — Ben's left third becomes his
        // right — so three thirds of him never come back as three of the same. Anything symmetrical
        // declares no counterpart and is copied as it stands.
        const turned = function (src) {
            const x = { ...src, copy: false };
            const f = x.face;
            if (f && f.mirrored) x.face = { ...f, id: f.mirrored, mirrored: f.id };
            return x;
        };

        switch (c.face.kind) {
            case 'mirror': {
                // A mirror standing in the line. The `n` cubes behind it are written onto the
                // `n` positions in front of it, nearest the glass first — *overwriting* what
                // was there, so the line never changes length. [A B 🪞 C D] becomes
                // [A B 🪞 B A]: C and D are gone, not pushed along.
                //
                // Only cubes reflect. An effect standing behind the glass has no side to copy, so
                // it passes straight through and the position opposite it is left as it was —
                // a mirror duplicating effects would cascade, which is the one thing the two-pass
                // resolution exists to prevent.
                const left = final.slice(0, i).reverse();
                if (!left.length) {
                    note(c, 'mirror.nothing');
                    break;
                }
                // **The reflection completes itself.** Where there aren't enough cubes on the right
                // to receive it, the mirror puts new ones there — it duplicates the table rather
                // than being truncated by the end of the line. Capped at `maxCubes`, because a
                // mirror standing at the very end of a full set would otherwise nearly double it,
                // and those cubes carry into every level above.
                const wanted = Math.min(left.length, Math.max(0, config.maxCubes - (i + 1)));
                if (wanted < 1) {
                    note(c, 'mirror.noroom');
                    break;
                }
                // **A true image of the line, special cubes included.** A Binder behind the glass
                // comes back as a Binder, drawing the face its original drew and counting whatever
                // its original counts.
                //
                // Nothing cascades, and it can't: pass two walks the cubes that were **thrown**, and
                // a reflection was never thrown, so a copied effect gets no turn of its own. It is
                // an image this roll and a real cube from the next one, which is how a Mirror ends
                // up handing you a **second copy** of something off your own rack.
                let copied = 0;
                let made = 0;
                for (let k = 0; k < wanted; k++) {
                    const to = i + 1 + k;
                    if (to >= final.length) made++;
                    final[to] = enliven(turned(left[k]), true);
                    copied++;
                }
                // Anything the mirror skipped past that has no cube yet is filled in, so the line
                // never comes back with a hole in it.
                for (let k = 0; k < final.length; k++) if (!final[k]) final[k] = plain(rollSide());
                note(c, 'mirror', { copied, made });
                break;
            }
            case 'invert':
                // Cubes only. An effect has no side to flip, and giving it one here would sneak it
                // back into the count through the back door.
                final.forEach((x) => {
                    if (!isCube(x)) return;
                    // **A wild is immune.** It isn't a side, it is *whatever you called* — and an
                    // invert flips the line, not your call. So it keeps counting your way and keeps
                    // drawing as Qui-Gon, which is the same statement it was making before.
                    //
                    // This is also the honest reading of the screen. A real Level 5 roll came out
                    // `:restart: 🔄 :DyeGon: 🟦 :DyeGon: :andotent: 🟥` on a blue call: everyone who
                    // looked at it read a blue majority, and flipping the wilds made it 1 blue to 3
                    // red. The cubes were right and the rule was wrong.
                    if (x.wild || x.face?.kind === 'wild') return;
                    x.side = OTHER[x.side];
                    // A face that asserts a *fixed* side — Shmi's red, Anakin's blue — is wrong the
                    // moment it's flipped, so it drops its art and draws as the side it now counts
                    // as. Without that a Shmi could sit there showing 🟥 while counting blue.
                    if (x.face && SIDED.has(x.face.kind)) x.face = null;
                });
                note(c, 'invert');
                break;
            case 'broken':
                // Wipeout. The cube **comes off the line**, in turn with everything else — it is
                // destroyed, and a destroyed cube shouldn't sit there being drawn as though it were
                // still a position. Resolving it here rather than in the first pass is what gives it
                // a frame of its own: the throw shows the wipeout face landing, and its step shows
                // the row closing over the gap.
                //
                // `spent` keeps the special off the table for the rest of the run, and because the
                // position is gone rather than merely flagged, the set is a cube shorter with no
                // extra bookkeeping.
                broken.push(c.special.id);
                final.splice(i, 1);
                note(c, 'broken');
                break;
            case 'burn':
                if (i + 1 >= final.length) {
                    note(c, 'burn.nothing');
                    break;
                }
                final.splice(i + 1, 1);
                note(c, 'burn');
                break;
            case 'clone': {
                // The cube on its right becomes a copy of the cube on its left. It destroys
                // nothing and adds nothing — the line is the same length, one position of it is
                // just now a duplicate — and it copies whatever is there, so a special on the left
                // comes out twice.
                const hasLeft = i - 1 >= 0;
                const hasRight = i + 1 < final.length;
                if (!hasLeft && !hasRight) {
                    note(c, 'clone.alone');
                    break;
                }
                // **At the head of the line it has nothing to copy, so it destroys instead.** The
                // cube's whole idea is that the position on its right becomes something else; with
                // no source for that, taking it off the table is the honest version of the same
                // sentence, and it beats the cube doing nothing at all.
                if (!hasLeft) {
                    final.splice(i + 1, 1);
                    note(c, 'clone.destroy');
                    break;
                }
                const src = final[i - 1];
                // Turned, like a reflection: cloning Ben's left third onto the right would
                // otherwise put two of the same third on the table. A cloned wing is junk either
                // way — it carries `gone` across, so it drops out of the set next level.
                const copy = enliven(turned(src), false);
                // **At the tail it makes room rather than giving up** — the one case where a clone
                // lengthens the line, and the only reason it needs the ceiling.
                if (!hasRight) {
                    if (final.length >= config.maxCubes) {
                        note(c, 'clone.noroom');
                        break;
                    }
                    final.push(copy);
                    note(c, 'clone.append', { srcFaceId: faceIdOf(src) });
                    break;
                }
                final[i + 1] = copy;
                note(c, 'clone', { srcFaceId: faceIdOf(src) });
                break;
            }
            case 'cull': {
                // One other cube, anywhere in the line, gone.
                const others = final.map((_, j) => j).filter(j => j !== i);
                if (!others.length) {
                    note(c, 'cull.nothing');
                    break;
                }
                final.splice(others[crypto.randomInt(0, others.length)], 1);
                note(c, 'cull');
                break;
            }
            case 'raze': {
                // Both neighbours at once, which keeps the count's parity intact.
                //
                // They are replaced rather than removed: each becomes the matching third of Ben, so
                // the three positions read as one wide picture of him lying across the line. The
                // cubes are as destroyed as they ever were — the wings contribute no side and are
                // dropped from the set — but the destruction is something you can see happen rather
                // than two cubes quietly absent from a shorter row.
                const left = i - 1 >= 0;
                const right = i + 1 < final.length;
                if (!left && !right) {
                    note(c, 'raze.nothing');
                    break;
                }
                const wings = c.face.wings || {};
                if (right) final[i + 1] = razed(wings.right, wings.left);
                if (left) final[i - 1] = razed(wings.left, wings.right);
                note(c, 'raze', { both: !!(left && right) });
                break;
            }
            case 'pair': {
                // Fode and Beed: two heads that never agree. A cube is **inserted** either side of
                // him — nothing already on the table is overwritten, the line simply gets two
                // longer — and the two are always opposite sides, so the pair is a wash in the
                // count and pure structure. What it really does is push his neighbours apart,
                // which is what everything positional downstream then has to deal with.
                if (final.length + 2 > config.maxCubes) {
                    note(c, 'pair.noroom');
                    break;
                }
                const left = rollSide();
                final.splice(i + 1, 0, plain(OTHER[left]));
                final.splice(i, 0, plain(left));
                note(c, 'pair', { side: left });
                break;
            }
            case 'twins': {
                // Padme, twice over: the same two insertions, but the pair **match**. A two-cube
                // swing rather than a wash, and the only face in the game that can hand one side
                // two cubes out of nowhere.
                if (final.length + 2 > config.maxCubes) {
                    note(c, 'twins.noroom');
                    break;
                }
                const side = rollSide();
                final.splice(i + 1, 0, plain(side));
                final.splice(i, 0, plain(side));
                note(c, 'twins', { side });
                break;
            }
            default:
                break;
        }

        // Worth a frame only if the line moved under it. The note that came with it is the label.
        const now = final.map(faceIdOf);
        if (now.length !== was.length || now.some((e, k) => e !== was[k])) {
            // Where the acting cube ended up, so the frame can point at it. Read *after* the effect
            // because inserting and destroying move it — a Padmé slipping a cube in on its left
            // shifts it one to the right. `-1` when the cube destroyed itself out of the line.
            steps.push({ faceIds: now, note: notes[noteAt] || null, at: at(c) });
        }
    }

    // **Ratts only ends the run if he is still standing when the dust settles.** He is checked
    // against the *resolved* line rather than the thrown one, so a burn, a cull, a raze or a mirror
    // writing over his position takes him off the table and the run survives — the cubes can save
    // you from him. That is the whole reason the check lives here instead of in the first pass.
    //
    // A reflected Ratts counts: the copy is on the table like anything else. `gone` positions don't
    // — a destroyed cube is still drawn, but it isn't there.
    const ender = final.find(c => !c.gone && c.face && c.face.kind === 'end' && c.special);
    if (ender) ended = ender.special.name;

    // **Multipliers are counted off the resolved line too, for the same reason.** Collected here
    // rather than in the first pass, so a Multiplier a Tusken culled or a clone wrote over doesn't
    // pay from beyond the grave — and, the other way round, a mult face the Binder cloned or the
    // Mirror reflected pays **twice**, because there really are two of them on the table.
    const mults = [];
    for (const c of final) {
        if (c.gone || !c.face || c.face.kind !== 'mult') continue;
        mults.push(c.face.side);
        pay(c, 'mult', c.face.side);
    }

    // The paying faces in reading order, each tied to the position it ended up on so the walk can
    // point at it. Sorted here rather than collected in order because greed is scored off the
    // *thrown* line and multipliers off the resolved one — two passes, one row.
    //
    // A greed the line destroyed after it paid has no position left and comes back `-1`, which
    // draws as a frame with no pointer on it. It still gets its frame: it paid, and a step missing
    // from the walk would leave the multiple jumping with nothing on screen to explain it.
    const payOrder = p => (p.at < 0 ? Number.MAX_SAFE_INTEGER : p.at);
    const payWalk = pays
        .map(p => ({
            kind: p.kind,
            side: p.side,
            faceId: p.faceId,
            specialId: p.specialId,
            specialName: p.specialName,
            at: final.indexOf(p.cube),
        }))
        .sort((a, b) => payOrder(a) - payOrder(b));

    // Only positions that are cubes are counted. `red` is counted rather than inferred from the
    // length, because the line now holds positions that are neither colour.
    const cubes = final.filter(isCube);
    const blue = cubes.filter(c => c.side === 'blue').length;
    const red = cubes.length - blue;
    // No majority means no answer from the line — an even count of cubes, or none at all. `null`
    // here doesn't decide anything; it hands the roll to Watto's tie-breaker, which is the caller's
    // business rather than the line's. Every effect face takes a cube out of the count without
    // shortening the line, so this happens far more often than it used to.
    const majority = blue > red ? 'blue' : red > blue ? 'red' : null;
    // Every position on one side — and **every position has to be a cube**. A line with an effect
    // in it is not swept however the rest of it landed, which keeps `all nine landed blue` literally
    // true and stops a rack of effect cubes farming pures off a shortened count while still being
    // paid at the level's nominal tier. Swept your way is a Pure Cube; swept the other way is
    // Watto's Cackle. A tie is never either, since a swept line has a majority by definition.
    const swept = final.length >= 3 && cubes.length === final.length
        && (blue === final.length || red === final.length);
    const pure = swept && majority === call;

    return {
        // `cubes` is the sides that counted — effects are not in it, so it is shorter than the line
        // whenever one landed. That is deliberate: it drives the majority and the lifetime `rolled`
        // tallies, and an effect face didn't land on a colour, so it shouldn't be tallied as one.
        //
        // `faceIds` is every *position*, one id each, for the payout frame. So the two differ in
        // length, and anything indexing one against the other would be wrong — see `decidedAt`.
        cubes: cubes.map(c => c.side),
        faceIds: final.map(faceIdOf),
        // What the run carries into the next level: one slot per surviving position, holding the
        // special that is still sitting on it or `null` for an ordinary cube. Everything the roll
        // did to the table is in here — cubes destroyed are simply absent, a special written over
        // by Fode, Padme, a mirror or a bind comes back as `null`, and so does one that broke.
        //
        // `gone` positions are dropped. A cube razed by Ben, or shattered by a wipeout, is still
        // drawn on *this* line so the player can see what happened to it — but it is not on the
        // table any more, and the next level is a cube short because of it. That is why this is
        // shorter than `faceIds` whenever something was destroyed, and the second of the two places
        // the three lengths intentionally disagree.
        set: final.filter(c => !c.gone).map(c => (c.special ? c.special.id : null)),
        majority,
        pure,
        swept,
        // `mult` is everything already earned outright — the Greed Cube. `mults` is the sides the
        // Multiplier Cubes landed on, still unspent, because whether they pay depends on who wins
        // and a tie doesn't know that yet. See `applyMults`.
        mult,
        mults,
        // The same additions `mult` and `mults` describe, itemised and in line order, for phase two
        // of the reveal to count out one at a time. Purely a playback record — nothing reads a
        // payout off it.
        pays: payWalk,
        shortcut,
        // Rerolls this roll banked, cube ids knocked out for the rest of the climb, and the cube
        // that ended the run outright, if one did.
        rerolls,
        broken,
        ended,
        notes,
        // One entry per restructuring face that actually moved the line, in fire order — the reveal
        // plays these back so the effects happen on screen rather than between frames.
        //
        // **Every step is here, however many there are.** Copies can act, so a full rack has been
        // measured at nine in one roll. The embed could only afford to draw three; that cap is a
        // property of a message edit and belongs to the client, not to the rules.
        steps,
        faceLog,
        specials: line.filter(c => c.special).map(c => c.special.id),
    };
};
exports.resolveLine = resolveLine;

// The cube at which one side became the guaranteed majority. Past this point the rest of
// the roll cannot change who won, so a reveal has no tension left to spend on it.
//
// Indexes into the *counted* cubes, which is only the same thing as the drawn line when no
// special landed — see the note on `cubes` and `faceIds` above.
const decidedAt = function (cubes) {
    const need = Math.floor(cubes.length / 2) + 1;
    let blue = 0;
    let red = 0;
    for (let i = 0; i < cubes.length; i++) {
        if (cubes[i] === 'blue') blue++; else red++;
        if (blue >= need || red >= need) return i + 1;
    }
    return cubes.length;
};
exports.decidedAt = decidedAt;

exports.SIDES = SIDES;
exports.LEVELS = LEVELS;
exports.SPECIALS = SPECIALS;
exports.config = config;
