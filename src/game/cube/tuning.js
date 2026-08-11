// Static design data for Botto's Chance Cube — the betting minigame unlocked by the
// "Red vs Blue" collection (3× Red Side + 3× Blue Side, see data/challenge/collection.js).
//
// The cube is fair: every face is a straight 50/50 draw from the CSPRNG, and every level
// is a clean double, so the ladder itself has no house edge at all. The **Agains** standing
// in the gaps are the entire edge — `M → M+1` on a coin flip — and a busted stake simply
// leaves the economy. Nothing is raked and nothing is minted; see `againBonus`.
//
// There was a **Pure Cube pot** here once: a jar fed by a share of every bust, paying a share
// of itself out on a line that landed all one way. It came out, and the reason is worth keeping
// because it is not a tuning argument. Every other payout in the mode scales with the stake —
// the level double, greed, mult, boost — and the pot did not: it paid a share of the *jar*
// however little you had risked to reach it. That made the minimum stake strictly dominant, and
// it was not fixable by shrinking the share, because the share scaled the prize and the exploit
// in lockstep and never the ratio between them. The only setting with no exploit in it was the
// setting with no pot in it.
//
// It left a pure paying the level flat, though — the rarest thing the mode can draw, worth exactly
// what any other win was worth. `pureBonus` puts a price back on it in the one currency the argument
// above permits: a **multiple**, which rides the standing and therefore scales with the stake. The
// jar was the problem, not the payout.
//
// ---------------------------------------------------------------------------
// This file carries **no presentation**. Every face names itself with an `id` and nothing
// else; what an id looks like is somebody else's problem. Discord's answer is
// `data/discord/cube_emoji.js`, the web client's is its own sprite sheet, and neither is
// reachable from here — which is the whole point, because the game outlived the embed it
// was written for.
//
// An id is exactly `faceKey(face)` — `kind`, or `kind:side` where a face names one. The
// two exceptions are Ben's wings (`razed:left` / `razed:right`), which are drawn but never
// tallied, and `hidden`, which is a face-down cube rather than a face at all.
// ---------------------------------------------------------------------------

exports.SIDES = { blue: 'Blue', red: 'Red' };

// The two sides a cube can land on. There is exactly one pair, because the two sides are
// *named* Blue and Red — the drama comes from the special cubes, not from recolouring these.
const SIDE_IDS = { blue: 'side:blue', red: 'side:red' };
exports.SIDE_IDS = SIDE_IDS;

// A position with nothing shown on it yet: the face-down cube the reveal opens on.
exports.HIDDEN = 'hidden';

// N is always odd, so a bare level always has a majority in it and only a special cube can
// leave a tie. The majority of an odd number of fair cubes is always exactly 50/50, so climbing
// never changes your odds — it only doubles the multiple and the size of the crater.
//
// **`payout` is the multiple a level pays on a fully collapsed route, and nothing else.** A run
// walks a *route* of rungs — these five levels, plus the uncleared `Again` rungs still standing in
// the gaps between them — and the multiple is carried by the run rather than looked up here: a
// level rung doubles it, an Again rung adds one. On a route with nothing left in the gaps those
// two facts reproduce this column exactly, which is what it is for. On a padded route Level 2 sits
// further along and pays more, because more coin flips went into it. See `levelStep`/`againBonus`.
exports.LEVELS = [
    { name: 'A Friendly Wager', cubes: 1, payout: 2 },
    { name: 'Test Your Luck', cubes: 3, payout: 4 },
    { name: 'Rolling Thunder', cubes: 5, payout: 8 },
    { name: 'Gamblers and Swindlers', cubes: 7, payout: 16 },
    { name: 'Fate Decides', cubes: 9, payout: 32 },
];

// ---------------------------------------------------------------------------
// Special cubes
// ---------------------------------------------------------------------------
//
// One is picked at every prestige and they are the only thing the ladder's flat 50/50 ever
// bends for. A special cube *substitutes* one of the level's plain cubes, so the line starts the
// length the level says.
//
// **A line can grow as well as shrink.** The Symbiont's cull and raze shorten it; three faces
// lengthen it — the **Mirror**, which conjures the cubes it needs to finish a reflection, and the
// Symbiont's **pair** and **twins**, which insert a cube either side of themselves rather than
// overwriting what is already there. All three are capped at `maxCubes`, and they are the only ways
// a set ever grows past the level's own count. Everything else overwrites in place.
// Removing an odd number is how a roll ends up with an even count and no majority in it, which
// is settled by Watto's own tie-breaker cube — see `tieLean` below.
//
// Six faces each, drawn uniformly, and every one of them obeys one rule:
//
//   **A face either IS a side, or DOES a thing. Never both.**
//
// A face that carries an effect — greed, mirror, burn, shortcut, all of them — contributes
// **nothing to the red or blue count**. It holds a position in the line, it does what it does, and
// it is simply not a cube for the purposes of deciding who won. Only `wild` and `side` produce a
// side, because producing a side is the whole of what they do.
//
// That rule is why every face here is a **single glyph**. The earlier version had effect faces
// counting toward a side as well, which meant each one had to be drawn as a colour square plus an
// effect — two glyphs for one cube — and a seven-cube line holding two specials looked like nine.
// No amount of spacing fixed that; the fix was to stop asking one face to say two things.
//
// It also means an effect face **takes a cube out of the count** without shortening the line, so
// even counts — and ties — are now common rather than exceptional. That is only survivable because
// a tie is settled by Watto's tie-breaker rather than being an automatic bust; see `tieLean`.
//
// Face kinds, resolved in `engine.js`. Only the two marked ▸ contribute to the count:
// ▸ wild        the position lands on whatever side you called
// ▸ side        the position lands on this face's own side
//   end         a **mine**. It detonates in its turn and destroys every cube on its own side of the
//               nearest shield — the whole line, if nothing is shielding it. The run ends if and only
//               if nothing countable survived the blast, which on an unshielded line is always, so a
//               rack with no Gungan Shield in it behaves exactly as it always did.
//   shield      blocks a mine's blast on its own flank, and is consumed doing it. Also holds an
//               adjacent cube together through a wipeout, which costs it nothing.
//   broken      nothing this roll, and the cube is out for the rest of the climb
//   greed       payout multiplier + greedBonus
//   boost       payout multiplier + boostBonus for **every position on the resolved line**, so it
//               pays for a table that got away from you rather than for anything it did itself
//   draw        pulls one more cube off the bag and slips it in on its right, thrown and live. It
//               takes from the levels above rather than adding — the bag is all a climb ever gets
//   purge       shatters every special cube on the line, this one included
//   engine      switches the cube it points at over to your call, if that cube landed against it.
//               Sideless like every other effect face, so it pays a vote for the privilege
//   mult        payout multiplier + multBonus if this face's *named* side is the one that wins — it
//               names a side without being one, so it still doesn't count toward the majority
//   shortcut    a free clear toward the next locked level, if the level is won
//   reroll      banks one reroll, to spend on a game over screen
//   mirror      overwrites the cubes on its right with the ones on its left, reversed
//   invert      flips every cube in the line to the other side — except a `wild`, which is not a
//               side but *whatever you called*, and an invert doesn't change what you called
//   clone       overwrites the position on its right with a copy of the one on its left
//   cull        destroys one other position at random
//   raze        destroys both positions next to it
//   pair        inserts a cube either side of it, one red and one blue — the line grows by two
//   twins       inserts a cube either side of it, both the same side — the line grows by two
//   razed       not a rollable face: what a cube destroyed by a raze is replaced with, so the
//               three positions read as one wide picture instead of two cubes going missing
//
// The eight faces of the Planet Octahedron are the only ones in the game that reach outside the
// line — see the note on that cube for what each is for and what pays for it:
//   freeze      both neighbours keep the face they are showing into the next throw and take no turn
//   scorch      burns the face each neighbour is showing **off that cube**, for the rest of the climb
//   vault       seals the side just called; the next rung has to be called the other way
//   lockout     seals the bank until a level rung is cleared
//   seam        payout multiplier + seamBonus for every rung this run has walked
//   jail        holds up to `jailSize` other cubes off the table until the run wins them back out
//   plunge      the head and the tail of the line fall away — the die included, if it is on an end
//   boonta      a tie on this line is won outright rather than rolled for

// ---------------------------------------------------------------------------
// Face points
// ---------------------------------------------------------------------------
//
// **Every position on a resolved line is worth something, whatever it did.** Points are totted up
// across the line and land on the *stake* — the Chips half of a game that until now had only a Mult.
//
// The problem this solves is that most of a line has never been worth anything. `🟦 🟥 💰 🟦 🟥 🪞 🟥`
// is seven positions of which five count, and the Mirror and the Greed contribute nothing *as
// positions* — they are furniture between the cubes that pay. Points make the whole line the payout
// rather than the countable part of it, which also hands three things a floor they never had:
//
//   - **Dead effects still pay.** A mirror with nothing behind it, a clone at the head of the line, a
//     burn with nothing on its right — `mirror.nothing`, `clone.alone`, `burn.nothing` are all frames
//     that currently resolve to no change and no reward. The face still showed up.
//   - **Growing the line pays twice.** A Mirror conjuring, Padmé's twins, a Binder appending, the Pit
//     Droid drawing — each adds positions, and positions are now worth truguts.
//   - **The number moves on every roll**, where today most rolls leave the multiple exactly as it was.
//
// **Points are a fraction of the stake, never a flat sum, and that is not a tuning choice.** A flat
// bonus makes the payout `(S + b) × M`, so return on risk is `M × (1 + b/S)` and the minimum stake is
// strictly dominant — the exact exploit that killed the Pure Cube pot, see the note at the top of this
// file. Denominated in `pointValue` the whole thing is stake-invariant and the exploit cannot exist.
// The UI still shows truguts: the player reads `📀1,000 → 📀1,225`, the engine holds `×1.225`.
//
// **Scored per roll, not accumulated over the run.** That is what keeps the ladder honest and it is
// the more interesting rule besides. A run's multiple rides the standing; its points are thrown fresh
// every rung, so `standing = stake × points × multiple` where only the multiple carries. The push then
// prices itself off the line you are looking at:
//
//     push EV = ½ × (M' × E[P]) / (M × P) = E[P] / P
//
// A rung that threw a long fat line leaves you *above* the average and pushing gives up a good board;
// a thin one leaves you below it and pushing is the better bet. Today every level push is EV exactly
// 1.000 — mathematically a shrug — and this is what turns the bank-or-push line into a read. What it
// costs is that the average push is no longer exactly fair: `E[P] × E[1/P] ≥ 1` by Jensen, and how far
// above 1 decides whether `levelStep` needs trimming. Measured rather than guessed — see
// `scripts/cubePoints.js`.
//
// Keyed by face **kind**, so a plain cube (which has a side and no face at all) scores `side` and a new
// face is covered the day it is added. A position that has been destroyed scores nothing: Ratts, a
// wipeout and Ben's wings are all corpses, and a corpse is not a cube on the table.
// **Four values and no arithmetic for the player to do.** A face is worth 1, 2, 3 or nothing, and a
// cube drawn as `2` is plainly better than one drawn as `1` without anyone totting up a column.
// Deliberately small: these are meant to be readable *on the face* in the client, and 10/15/20 was a
// spreadsheet pretending to be a game.
exports.POINTS = {
    // An ordinary cube. The thing everything else is better than, and worth **nothing extra** — see
    // `pointMultiple` for why the baseline sits here and not at zero.
    side: 1,
    // A side and a guarantee.
    wild: 2,
    // The restructurers: they change the shape of the line, which is the biggest thing a face can do.
    mirror: 3,
    invert: 3,
    cull: 3,
    raze: 3,
    draw: 3,
    purge: 3,
    // Positional effects — they move one cube, not the shape of the board.
    clone: 2,
    burn: 2,
    pair: 2,
    twins: 2,
    shield: 2,
    engine: 2,
    // Already paid on the multiple. They score as an ordinary cube: a floor for turning up, never a
    // second reward for the same face.
    greed: 1,
    mult: 1,
    boost: 1,
    shortcut: 1,
    reroll: 1,
    // The Planet Octahedron, scored by the same rule as everything above it: 3 changes the shape of
    // the board, 2 moves one thing, 1 is the floor for turning up. `scorch`, `jail` and `plunge`
    // restructure; `freeze`, `vault` and `boonta` move one thing each — a face, a call, a verdict;
    // `seam` is already paid on the multiple, and `lockout` did nothing to the line at all but is
    // still a cube standing on it.
    freeze: 2,
    scorch: 3,
    vault: 2,
    lockout: 1,
    seam: 1,
    jail: 3,
    plunge: 3,
    boonta: 2,
    // Corpses. The mine that went off, the cube that came apart, and the two thirds of a razed
    // neighbour Ben is lying across. None of them is on the table any more.
    end: 0,
    broken: 0,
    razed: 0,
};

const rep = (n, face) => Array.from({ length: n }, () => face);

// RIPratts. Not a dud — a **mine**.
//
// He used to end the run on sight. He now detonates in his turn and destroys every cube on his own
// side of the nearest shield, and the run ends only if nothing countable is left standing. On a line
// with no Gungan Shield on it those are the same sentence — the blast takes the whole line, so
// nothing survives and the run is over exactly as it always was. The rule only bends for a rack that
// paid a slot to bend it, which is why this could be changed globally without touching a single
// measured EV row.
//
// One thing it fixed on the way past: the note used to be written in pass one, unconditionally, so a
// Ratts a Tusken had already eaten still printed "the run ends here" on a roll that survived him. The
// note is written where the mine actually goes off now, so a mine that never got its turn says
// nothing at all.
//
// **One face, on every cube that carries him.** Shortcut and Reroll used to carry two, back when a
// special was drawn independently on every roll and two Ratts was simply a steep price for a cube
// that pays without risking anything. Under carry-over a cube joins the set and throws again
// at every level above it, so a cube drawn at Level 2 faces him at 3, 4 and 5 — and at two faces
// that is `(4/6)³ ≈ 30%` survival, which is not a price but a death sentence. Measured, both cubes
// sat near **0.32 EV**, far and away the worst things you could put on the table.
//
// Carry-over already charges what the second face was there to charge, in a harsher currency. So
// the rule is one face each, and the thing that stops these two being free money is now the number
// of levels they have to survive rather than the number of ways they can fail.
const END = { kind: 'end', id: 'end' };
// Wipeout. Does nothing to this roll and takes the cube off the table for the rest of the climb.
const BROKEN = { kind: 'broken', id: 'broken' };

exports.SPECIALS = [
    {
        id: 'wild', name: 'Wild Cube',
        blurb: 'Five faces land on the side you called. One ends the run.',
        faces: [...rep(5, { kind: 'wild', id: 'wild' }), END],
    },
    {
        id: 'greed', name: 'Greed Cube',
        blurb: 'Five faces pay +50% on the level. One ends the run.',
        faces: [...rep(5, { kind: 'greed', id: 'greed' }), END],
    },
    {
        id: 'shmi', name: 'Shmi Cube',
        blurb: 'Red four times in six, blue once — red was his mother.',
        faces: [
            ...rep(4, { kind: 'side', side: 'red', id: SIDE_IDS.red }),
            { kind: 'side', side: 'blue', id: SIDE_IDS.blue },
            BROKEN,
        ],
    },
    {
        id: 'anakin', name: 'Anakin Cube',
        blurb: 'Blue four times in six, red once — blue was the boy.',
        faces: [
            ...rep(4, { kind: 'side', side: 'blue', id: SIDE_IDS.blue }),
            { kind: 'side', side: 'red', id: SIDE_IDS.red },
            BROKEN,
        ],
    },
    {
        id: 'mirror', name: 'Mirror Cube',
        blurb: 'Half reflect everything behind it onto the cubes ahead, special cubes included; half invert the line.',
        faces: [
            ...rep(3, { kind: 'mirror', id: 'mirror' }),
            ...rep(3, { kind: 'invert', id: 'invert' }),
        ],
    },
    {
        id: 'symbiont', name: 'Symbiont Cube',
        blurb: 'Slips a red and a blue in either side of it, or matching twins — or takes cubes off the table.',
        faces: [
            { kind: 'cull', id: 'cull' },
            // Ben spreads. `wings` are what the cubes he destroys are replaced with — his left and
            // right thirds — so a raze draws as one wide Ben lying across three positions instead
            // of two cubes silently going missing. The cubes are still destroyed: the wings count
            // toward neither side and drop out of the set.
            { kind: 'raze', id: 'raze', wings: { left: 'razed:left', right: 'razed:right' } },
            ...rep(2, { kind: 'pair', id: 'pair' }),
            ...rep(2, { kind: 'twins', id: 'twins' }),
        ],
    },
    {
        id: 'shortcut', name: 'Shortcut Cube',
        blurb: 'Five faces pay a free clear if you win. One ends the run.',
        faces: [...rep(5, { kind: 'shortcut', id: 'shortcut' }), END],
    },
    {
        // A reroll banked is a permanent resource, so this is the cube that most needs a brake on
        // how often it pays. It used to shatter *itself* on every payout, which capped it at one
        // reroll a run — but it also meant the cube reported a shatter every single time it did its
        // job and never once showed the face that actually breaks it. So the brake is a **wipeout**
        // instead: two faces in six take the cube off the table, as on the Multiplier — Shmi and
        // Anakin carry one apiece — and it renders as the wipeout because that is what it is.
        //
        // The face list below is the third distribution this cube has had and the blurb had been left
        // describing the first. Read it off `faces`, not off the prose around it: three faces bank,
        // two shatter, one is Ratts.
        id: 'reroll', name: 'Reroll Cube',
        blurb: 'Three faces bank a reroll. Two shatter the cube, one ends the run.',
        faces: [...rep(3, { kind: 'reroll', id: 'reroll' }), END, ...rep(2, BROKEN)],
    },
    {
        // Half burn, half clone — the split this cube always had. What was simplified away was the
        // *bind*, which used to turn the Binder into a synthetic hybrid of its two neighbours and
        // needed a whole cube-construction system to exist; cloning left onto right says the same
        // idea in one sentence. The burn was never the complicated half and stays as it was.
        id: 'binder', name: 'Binder Cube',
        blurb: 'Burns the cube on its right, or makes it a copy of the cube on its left.',
        faces: [
            ...rep(3, { kind: 'burn', id: 'burn' }),
            ...rep(3, { kind: 'clone', id: 'clone' }),
        ],
    },
    {
        id: 'multiplier', name: 'Multiplier Cube',
        blurb: 'Four faces double the payout if their own side wins. Two break the cube.',
        faces: [
            ...rep(2, { kind: 'mult', side: 'red', id: 'mult:red' }),
            ...rep(2, { kind: 'mult', side: 'blue', id: 'mult:blue' }),
            ...rep(2, BROKEN),
        ],
    },
    {
        // The one cube that answers the mine, and the reason the mine exists. It splits the line:
        // the blast takes everything on the mine's side of it and everything on the far side walks
        // away, which is the Gungan shield doing in a row of cubes exactly what it does on the
        // Naboo plains.
        //
        // **At an edge it protects nothing**, and that falls out of the geometry rather than being a
        // rule of its own — a shield at the head of the line with the mine to its right has no far
        // side, so the wipe is total. Position is re-rolled every level by `throwSet`, so whether it
        // lands somewhere useful is a fresh gamble on every throw rather than a property of the run.
        //
        // The wipeout save is the other half, and it is what stops the cube being dead on the ~85% of
        // throws with no mine on them. It costs the shield nothing, because a cube coming apart is not
        // a blast — and it covers Shmi, Anakin, the Multiplier, the Reroll Cube and the Boost Cube, so
        // its hit rate scales with how much fragile kit is on the table. Same shape as the mine half.
        // **All six faces, no downside face** — the Mirror's and the Binder's shape, and for the same
        // reason: the effect is defensive, so permanence can't run away with a climb. It measures
        // **0.85 at Level 5 fielded alone**, which is a real price for a slot and exactly the "worth
        // nothing without the rack it's for" shape the three prestige perks have.
        //
        // The face count was swept, and it is the difference between the cube working and not:
        //
        //                    alone   +greed   greed+shortcut+wild+shield
        //   4 shield 2 wipeout  0.83    0.70    0.72
        //   5 shield 1 wipeout  0.85    0.73    0.80
        //   6 shield            0.85    0.78    **0.98**
        //
        // That last column is the whole argument. Greed, Shortcut and Wild fielded together — three of
        // the four cubes that carry a mine — measure **0.56** on their own, which is unplayable. A
        // six-face shield takes them to **0.98**. Every wipeout face taken off this cube is a level it
        // is still on the table for, and the mine it stops is the only thing it exists to stop.
        //
        // Note what it does *not* do: it barely moves Greed alone (0.60 → 0.78), because one shield
        // against one mine-carrier still has to land in a useful position on a short line. It repairs a
        // mine-heavy *rack*, not the Greed Cube.
        //
        // **The table above predates the save being a re-throw.** A rescued cube used to hold its
        // position and nothing else — a dead wipeout face, counting toward neither side for the rest of
        // the roll — and it now comes up as one of its own other faces and takes a turn with it. Every
        // number here is therefore a floor rather than a measurement, and by the most on the racks the
        // last column is about: what a saved Multiplier or Reroll Cube is worth is the whole difference.
        id: 'gungan', name: 'Gungan Shield Cube',
        blurb: 'Stops a mine on its own side of the line. A neighbour that wipes out holds '
            + 'together and throws again.',
        faces: rep(6, { kind: 'shield', id: 'shield' }),
    },
    {
        // Tempo, not size. Every cube it hands you comes off the **bag**, and the bag is the whole of
        // what a climb ever gets — so it doesn't lengthen the run's table, it front-loads it, spending
        // Level 5's cubes at Level 2. That is worth a great deal precisely because the multiple
        // compounds: a Greed deployed two levels early is doubled twice more on the way up.
        //
        // It burns itself out, and needs no cap to do it. Once the bag is empty `draw` has nothing to
        // pull and the levels above stop growing at all, so the cube's own success is what ends it.
        //
        // `purge` is the price, and it is the only downside face in the set that scales with the
        // reward. It shatters every special standing on the line — this cube included, so it fires
        // once a run and never twice. A purge on the level it arrives costs almost nothing; a purge at
        // Level 4, after it has put your whole rack on the table, takes the whole rack with it. The
        // bag is deliberately left alone: draining that too would make an early purge as ruinous as a
        // late one and flatten the only interesting thing about the curve.
        id: 'pitdroid', name: 'Pit Droid Cube',
        blurb: 'Five faces pull another cube out of the bag. One scraps every special on the table.',
        faces: [...rep(5, { kind: 'draw', id: 'draw' }), { kind: 'purge', id: 'purge' }],
    },
    {
        // The first cube that pays for the **length** of a line. `maxCubes` has been Infinity for a
        // while and a runaway table has never been worth a trugut — `bestCubes` was the only thing
        // that noticed. So the Mirror conjuring, Padmé's twins, a Binder appending at the tail and the
        // Pit Droid's draws finally have something to be *for*, which is four cubes that previously
        // shared no goal at all.
        //
        // Four paying faces and two wipeouts rather than five and a mine, and that shape is measured
        // rather than chosen: a sideless cube pays its count liability again on every level it
        // survives, so a wipeout — which retires the liability — is worth far more to it than a mine,
        // which cashes it in. That is the whole difference between the Multiplier at 0.89 and Greed at
        // 0.60.
        id: 'boost', name: 'Boost Cube',
        blurb: 'Four faces pay for every cube on the table. Two shatter the cube.',
        faces: [...rep(4, { kind: 'boost', id: 'boost' }), ...rep(2, BROKEN)],
    },
    {
        // Sebulba cheats, and this is the smallest cheat that is still worth a slot: one cube beside
        // him is burned over to your call, but only if it landed against you. A cube already on your
        // side is left alone, so the target ends up your way either way and the effect is invisible
        // half the time it fires.
        //
        // **His direction is rolled**, which nothing else in the game does — burn always looks right,
        // clone always copies left, a mirror always reflects forward. Two engines mean position
        // matters twice over: which end of the line he came down on, *and* which way he was pointing
        // when he got there.
        //
        // **Two wipeouts, and they are not optional.** Per-level arithmetic said this cube would land
        // just under a Wild — 65% against 68.75% on a five-cube line — and measured over 150k climbs at
        // six engine faces it came out at **1.64 EV at Level 5**, the strongest thing in the game by a
        // distance. The single-level sum was right and irrelevant: what it missed is that a cube with
        // no downside face **never leaves the table**, so a one-sided effect is re-applied at every
        // level for the rest of the climb and compounds against a ladder that doubles.
        //
        // The Mirror and the Binder carry no downside face either and that is not the same case — their
        // effects are neutral-to-negative, so permanence costs them nothing. Every cube here whose
        // effect only ever helps pays for it: Wild and Greed carry Ratts, the Multiplier carries two
        // wipeouts. Sebulba is in that second group and now pays the same price.
        //
        //   3L 3R              1.18 / 1.64      ← measured, far too strong
        //   3L 2R + wipeout    1.13 / 1.37
        //   2L 2R + 2 wipeout  1.09 / 1.20      ← shipped, just under Wild's 1.30
        //   2L 2R + Ratts + wipeout  0.97 / 0.88
        //   2L 2R + 2 Ratts    0.87 / 0.59
        //
        // A mine rather than a wipeout overcorrects, and for the reason the Greed note gives: a mine
        // cashes the sideless liability in on every level above, where a wipeout retires it.
        //
        // The engines are effect faces, so nothing here bends "a face either IS a side, or DOES a
        // thing". An earlier draft had him counting *and* forcing his neighbour, which needed a
        // carve-out in that rule and came out strictly stronger than a wild. This version needs
        // neither.
        id: 'sebulba', name: 'Sebulba Cube',
        blurb: 'Two faces point an engine either way and burn that cube over to your call. '
            + 'Two shatter the cube.',
        //
        // The second face with a handedness, and the first whose handedness is a *rule* rather than
        // only a picture — see `RAZED` below for the mechanism. In the glass he faces the other way and
        // points the other way with it: an engine reflected as its own heading would have Sebulba come
        // back out of a mirror aiming at the cube his original already burned.
        faces: [
            ...rep(2, { kind: 'engine', dir: 'left', id: 'engine:left', mirrored: 'engine:right' }),
            ...rep(2, { kind: 'engine', dir: 'right', id: 'engine:right', mirrored: 'engine:left' }),
            ...rep(2, BROKEN),
        ],
    },
    {
        // **Eight faces, one per planet, and not one of them is a side.**
        //
        // Every other cube in the game acts on the line. This one reaches outside it: at the cubes
        // themselves (`freeze`, `scorch`), at the two buttons the player actually presses (`vault`,
        // `lockout`), and at the verdict (`boonta`). It is the only cube whose effects survive the
        // throw that produced them.
        //
        // **Eight faces is free and it is not cosmetic.** Nothing in the engine assumes six — a face is
        // drawn with `randomInt(0, faces.length)` — so the shape costs nothing to build, and it changes
        // the odds it is built on: any one planet is 12.5% a throw against a six-sider's 16.7%. Each face
        // therefore has to be worth meeting, which is why several of them are as sweeping as they are.
        //
        // **It is sideless on all eight faces, on every throw**, which is a consequence of the rule
        // rather than a choice: a planet face that also counted as blue would have to draw as a planet
        // *and* as a colour, and a position drawn as two glyphs is a position players count as two. So
        // the die is a permanent tie machine — and `boonta` is one face in eight that answers ties,
        // which is the loop that makes the eight rules one object.
        //
        // **No wipeout and no mine, so the price lives inside the planets.** A cube with no downside
        // face never leaves the table, and the Sebulba note above is the record of what that does to an
        // effect that only ever helps. Three faces here are bad for you: `lockout` takes the exit,
        // `plunge` takes cubes, `jail` takes cubes and hands them back slowly. Against that: one payer,
        // one guaranteed tie-win, and two faces as likely to hurt as help.
        //
        // **`plunge` is the key to all of it.** It takes whatever is standing on the ends of the line,
        // this cube included, which makes it the die's only self-destruct, the jailbreak that frees
        // everything `jail` is holding, and the release for `lockout`. Three cruelties, one key, and the
        // key is a cube nobody can aim.
        //
        // Two pairs and four singles, which is what makes it learnable: **ice and fire** take both
        // neighbours and do opposite things to a face; **the vault and the arena** take the call and the
        // bank. Then Mon Gazza pays for depth, Oovo IV imprisons, Ord Ibanna destroys, Tatooine collects.
        //
        // Unlike every other cube here it is not on Watto's rack — it is assembled from eight faces
        // earned one per planet through the challenge system, the way the chance cube itself is
        // assembled from three red sides and three blue. See `docs/planet-octahedron.md`.
        id: 'octahedron',
        name: 'Planet Octahedron',
        blurb: 'Eight faces, one per planet. None of them is a side and all of them reach off the line.',
        // **Never welded**, and the easy reason is the weaker one: it is not Watto's to sell, so it is
        // held out of `rewardChoices` by `OFF_RACK` already.
        //
        // The mechanical reason is `plunge`. It is this cube's only self-destruct, the jailbreak that
        // frees everything `jail` is holding, and the release for `lockout` — three cruelties and one
        // key. A weld halves the rate of every face on it, so the key thins out at exactly the same
        // rate as the locks do; but `jail` also drips one prisoner out per rung won, so the two do not
        // cancel and the prison fills faster than it empties. Diluting this cube reintroduces the
        // deadlock the road had to engineer the tie rule around, measured at 9.6% of full-rack runs.
        //
        // Read off the cube rather than a list of ids, so a second unweldable cube is covered the day
        // somebody adds one.
        noWeld: true,
        faces: [
            { kind: 'freeze', id: 'freeze' },
            { kind: 'vault', id: 'vault' },
            { kind: 'scorch', id: 'scorch' },
            { kind: 'lockout', id: 'lockout' },
            { kind: 'seam', id: 'seam' },
            { kind: 'jail', id: 'jail' },
            { kind: 'plunge', id: 'plunge' },
            { kind: 'boonta', id: 'boonta' },
        ],
    },
];

// The two faces of an ordinary cube, as a real face list.
//
// A plain cube has never needed one — it is `null` in the set and draws through `rollSide`, which is
// also the one place the daily lean is applied. It needs one now because **a scorch burns a single
// face off a cube**, and three blue against three red is exactly what the Red vs Blue collection
// assembles: one burn leaves a 3–2 cube, and it takes five to fuse one to a colour.
//
// **A scorched cube leaves the daily lean behind, and that needs no rule of its own.** A cube drawing
// off a face list never calls `rollSide` — already true of every special in the game — so the lean
// simply stops applying the moment a plain cube stops being plain. The flavour is exact: the lean is a
// thumb on the scale nobody can read from inside one game, and a cube Baroonda has been at is not
// being nudged by anything. It is physically loaded, and its bias is on the rack screen to be counted.
exports.PLAIN_FACES = [
    ...rep(3, { kind: 'side', side: 'blue', id: SIDE_IDS.blue }),
    ...rep(3, { kind: 'side', side: 'red', id: SIDE_IDS.red }),
];

// What a cube destroyed by a raze is replaced with. Not on any cube's face list — it is never
// rolled, only written onto the line by `raze` — but it needs a declaration because it has a
// **handedness**: reflected, Ben's left third has to come back as his right or the mirror draws him
// inside out. `mirrored` names the id it becomes in the glass.
//
// The mechanism is general. Any face declaring a `mirrored` counterpart flips when it is copied by
// a reflection; anything symmetrical declares none and is copied as it stands. A face carrying a
// `dir` turns that around with it, which is what makes the flip a rule and not just a picture —
// Sebulba's two engines are the pair that needs it.
exports.RAZED = {
    'razed:left': { kind: 'razed', id: 'razed:left', mirrored: 'razed:right' },
    'razed:right': { kind: 'razed', id: 'razed:right', mirrored: 'razed:left' },
};

// Watto calls every roll himself. Broken, greedy, and never on your side — he is the
// house, so he is delighted when you lose and insulted when you don't.
exports.WATTO = {
    // Survived a level and left something standing.
    win: [
        "Hmph. Lucky roll. Don'ta let it go to your head, eh?",
        "Ha! You wanna push? Push. Watto's patient.",
        'Not bad... for an outsider.',
        "Feh. The cube's in a generous mood. She'll get over it.",
        "You feelin' brave, eh? Brave costs extra.",
    ],
    // Called it wrong. The stake is gone.
    bust: [
        'Ha! You wanna gamble, gamble somewhere else, eh?',
        "Hehehe! Watto's truguts now. Alla them.",
        'Whatsa matter? You look like you swallowed a sand flea.',
        'No luck, no truguts, no deal!',
        "Outsider. You never had it. Hehehe.",
    ],
    // RIPratts. The run just ended on the spot, whatever the cubes said.
    ripratts: [
        "Ratts! Hehehe! You know what happened to Ratts, eh? That's what happened to your truguts.",
        "Ohhh, bad face. Very bad face. Run's over, outsider.",
        'HA! The cube says no. The cube says get out.',
    ],
    // A special cube left an even line with no majority in it, so Watto brings out a cube of
    // his own. Said before it lands, on the one frame that has a question on it.
    tiebreak: [
        "No majority? Hehehe. Then we use Watto's cube. Watto's cube is very fair, eh?",
        "Even cubes, nobody wins. Lucky for you I gotta cube right here.",
        "You broke my line, outsider. So now we do this my way.",
    ],
    // His tie-breaker went his way, which it usually does.
    tie: [
        'Hehehe! My cube likes me better. Funny, eh?',
        'You see? Even fate does business with Watto.',
        "My cube, my truguts. That's how it works, outsider.",
    ],
    // His own tie-breaker went the player's way.
    tiewin: [
        "What?! My own cube?! ...Bah. Take it. TAKE IT.",
        "Traitor! You hear me? My own cube, a traitor!",
        "Hmph. Me and that cube, we're gonna have words later.",
    ],
    // Paid off rather than rolled for. He is delighted, which is the point.
    bribe: [
        "Truguts? For me? Hehehe... then it's a win. Whatever you say it is.",
        "A deal's a deal. The cube never happened, eh?",
        "See? Everything's negotiable. Everything but the price.",
    ],
    // Every cube against you.
    cackle: [
        "HEHEHE! Every last one against you! Even the cube don'ta like you!",
        'Alla them! You see? The cube, she knows a mark when she sees one.',
        "Not one! Not ONE! Oh, this is a good day for Watto.",
    ],
    // Every cube on your side. It wins the level like any other majority and not a trugut more —
    // which is the whole joke, and the reason these two lines survived the pot being cut. They
    // were written for the non-paying tier and they generalise for free.
    pure: [
        "Alla one side. Pretty. Pretty don'ta pay, eh?",
        'Hmph. A trick roll. Costs me nothing.',
        "Every one your way and it buys you nothin' extra. Beautiful, eh?",
    ],
    // Cashed out on purpose.
    bank: [
        "Feh. Take it and get outta my shop.",
        "Cashing out already? Coward's money spends the same, eh?",
        'Fine. FINE. Go count it somewhere else.',
    ],
    // Survived an **Again** — one off the road, for good. He hates this one specifically, because
    // it is the only thing in the game that costs him something permanently.
    //
    // The last line here is the one the mechanic was named out of: it used to be a `ceiling` line,
    // said while the game was force-banking the player, where it was a taunt about a thing they
    // could not do. It is a taunt about a thing they just did now.
    again: [
        "Bah! One less. You think I don'ta count, eh? I count.",
        'Again. AGAIN. Watto has all day, outsider.',
        "Hmph. Cleared. Do it again and maybe we talk about more cubes.",
        "You keep chippin' away. Fine. Chip.",
    ],
    // The gap filled and a level opened — two more cubes go on the table, and the run is still
    // standing to push into it.
    opened: [
        "Fine! FINE. Two more cubes. Don'ta make me regret it.",
        "You earned 'em. I'm not sayin' it twice.",
        'Ha! More cubes, more ways to lose. Enjoy, outsider.',
    ],
    // Still rolling past the top, where an Again clears nothing and pays +1. He is thrilled.
    overtime: [
        "Still goin'? Hehehe! Watto likes you. Watto likes you a LOT.",
        'Plus one. PLUS ONE! And you keep rollin! Beautiful.',
        "There's nothin' left up here, outsider. Roll again, eh?",
    ],
    // Cleared the top of the ladder — nine cubes and all. Deliberately says "nine cubes"
    // rather than naming the level, so renaming a level can never make Watto sound wrong.
    final: [
        "Alla nine! Fine — FINE. Take your winnings, outsider.",
        "Nine cubes and you're still standin'. ...Get out. Go on, get out!",
        "We let fate decide and fate likes you. Bah! Fate has no taste.",
    ],
};

exports.cube = {
    // A floor under the stake, so a run is always worth something to lose. It used to be here to
    // stop the pot being seeded a trugut at a time; with the pot gone what it stops is a player
    // farming clears and records off wagers too small to feel — the road is progress, and progress
    // should cost.
    minStake: 100,
    defaultStake: 1000,
    // Ceiling on a single roll, and how much each prestige raises it. Tying wager size to
    // progression rather than to a bank balance is what stops a new player from putting their
    // whole net worth on one coin flip — and it's the whole reward for starting over.
    //
    // **The step is 2, and it used to be 5.** The ceiling is the only *guaranteed* thing a
    // prestige hands over — the rack pick runs out after thirteen — so the number that matters
    // is how long it keeps binding, and a steep step burns through that faster than anything
    // else in the mode. Measured against live balances (median holder 📀77,418, p75 📀478k):
    //
    //   step   ceiling stops binding for the median holder
    //   ×5     prestige 3   — ~217 runs in, about 1.7 hours
    //   ×3     prestige 4
    //   ×2     prestige 7   — ~706 runs, and roughly the length of the rack's 13 picks
    //
    // Past that point the headline reward is a number the player can never reach, and prestige
    // is carried entirely by the rack. ×2 is the only step that keeps the ceiling alive for as
    // long as there is something to pick.
    //
    // It also sets the reroll price, which is scaled by the same figure — at ×5 a prestige-8
    // reroll cost 📀977M against 📀640k at ×2. The coupling is right; the old step made it absurd.
    maxStake: 1000,
    maxStakeStep: 2,
    // Watto leans on the cube. Every day one side is quietly favoured this much and the other
    // takes the rest — enough to be worth noticing over a day's rolls, not enough to make a
    // call feel decided for you. Which side is never announced.
    //
    // **It was 0.55 and that was a money printer.** The reason is that the lean does not stay 55/45:
    // a level's winner is the *majority* of an odd number of cubes, and majority-of-N amplifies a
    // per-cube bias with depth. Measured on a collapsed road:
    //
    //     level   cubes   P(call wins)   × levelStep
    //     L1        1        0.5500         1.100
    //     L2        3        0.5748         1.150
    //     L3        5        0.5931         1.186
    //     L4        7        0.6083         1.217
    //     L5        9        0.6214         1.243
    //
    // Every rung is independently above even money, so a player who knows the day's side has no reason
    // ever to bank and the ladder's "a level push is exactly fair" property — the thing §3 of the design
    // doc is built on — is simply gone. Compounded, a bare ladder measures **EV 2.27** at 0.55 against
    // 1.000 at 0.50, and a real rack took one holder from 20T to 800T in an afternoon at ~1% of purse
    // a roll. The salt being secret does not help: a nine-cube line is enough information that ~36
    // throws identify the day's side to 95% confidence, so it is inferred from the table rather than
    // read out of the source.
    //
    // **It is also not zero-sum against a player who never works it out.** Blind play — one colour
    // forever, half the days wrong — measured EV 1.66 at 0.55, because `E[∏P] > ∏P(E[p])` by convexity:
    // the ladder pays exponentially in streak length, so *any* p ≠ 0.5 mints truguts in either
    // direction. There is no value of this dial that is EV-neutral except 0.500.
    //
    // So the number is chosen for how much flavour survives per unit of leak, not for fairness. Measured
    // by `scripts/cubeLean.js` on a bare ladder — the dial with nothing else in the sample — scored at
    // the best stopping level and staked at 1.07% of purse, which is `maxStake` at prestige 33:
    //
    //     dayLean   reads as   informed EV   blind EV   informed, 250 runs
    //     0.550      55/45        2.937        1.921          45×
    //     0.530      53/47        2.078        1.541         6.8×
    //     0.520      52/48        1.579        1.318         3.2×      ← shipped
    //     0.510      51/49        1.493        1.311         2.6×
    //     0.500      50/50        1.190        1.229         1.6×
    //
    // **0.52 is the floor of perceptibility, not a fairness target.** A 52/48 day is still genuinely
    // noticeable across a few hundred rolls, which is the only timescale the lean was ever meant to be
    // felt on. Below 0.51 the mode pays the whole cost of the mechanic for a bias nobody can perceive,
    // and at that point the honest move is to delete it rather than trim it again.
    //
    // The residual ~1.19 at a perfectly fair 0.500 is `pureBonus`, not this dial — see the note there.
    // A hand-picked rack measures ~2.2 with the lean switched off entirely, which is a third leak this
    // number cannot touch: the cubes were each measured alone when they were built and never as a chosen
    // eight together. `cubeLean.js` prints that row on purpose.
    dayLean: 0.52,
    // ---------------------------------------------------------------------
    // The route
    // ---------------------------------------------------------------------
    //
    // The ladder is not five levels, it is a **route of rungs**. Five of them are levels — where
    // two more cubes come out of the bag — and between each pair sits a gap holding
    // `clearsToUnlock` **Again** rungs: the same table thrown again, for nothing but the right to
    // move on.
    //
    // Surviving an Again **collapses it permanently.** It is never on your route again, so every
    // run that gets one rung further than the last makes a visible, permanent change to the board
    // and the road to the top gets shorter. Fill a gap and the next level unlocks *mid-run* — two
    // cubes hit the table and you push straight into it. Eventually a prestige run is exactly
    // 🥉🥈🥇💠💎 with nothing in between, and then a prestige pads it out again.
    //
    // **Nothing forces a stop.** A run ends because it busted or because the player banked, never
    // because the game ran out of things to offer. Past Level 5 the Agains simply keep coming.
    //
    // **Agains per gap**, and the number the pacing hangs off. Every *other* prestige adds one, up
    // to `maxClears`.
    //
    // It is **1 where the forced-bank model had 2**, and that is not a loosening — it is what keeps
    // the pacing identical. Measured over 20k cycles a side, the route at `g` costs exactly what
    // the old ladder cost at `g + 1`:
    //
    //     g      1      2      3      4      5
    //     route  61.7   92.5   121.8  153.0  181.3
    //     old    31.7   62.1   92.3   121.6  152.2      ← `30c + 2`, reproduced to the run
    //
    // The reason is one rung. A ceiling clear sat at rung `k+1` and the run force-banked with
    // exactly one; the frontier Again sits at rung `k+2`, which is twice as deep. Being able to
    // chain several in a run *nearly* pays that back — `Σ 2^-(k+i) = 2^-k`, which is where the
    // "pacing is unchanged at the same g" claim came from — but the chain is **capped at the size
    // of the gap**, and a truncated geometric is worth much less than a whole one. At g=2 that cap
    // costs 50%; it fades as the gap grows, which is exactly the g→g+1 shift above.
    //
    // So `clearsToUnlock: 1` and `maxClears: 4` reproduce the shipped curve rung for rung: 62 runs
    // a cycle at prestige 0, 92 from prestige 2, 122 from 4, 153 from 6 and never more. Every
    // pacing decision in the design doc survives; only the number they are written against moved.
    clearsToUnlock: 1,
    // Prestiges between each extra required clear. Every prestige adding one made the
    // re-climb balloon; every *other* prestige keeps it growing without the grind running
    // away from the reward.
    //
    // The cost of one prestige cycle is exactly **30c + 2 runs**, where c is the clears each
    // level takes — a closed form the simulation reproduces to the run. (The `+2` rather than
    // `+32` is the rule that a clear opening a level doesn't end the run: it is worth a flat 30
    // runs a cycle.) So c = 2 is 62 runs, c = 5 is 152, and every extra clear is another 30.
    //
    // Two adds one, because the **rack** is what pays for the growth: a Shortcut cube measures a
    // 2.2× speedup on a re-climb, which is close to what +1 clear every other prestige costs.
    // Adding one every prestige outran that and turned the fourth re-climb into a slog.
    clearsPrestigeStep: 2,
    // Where that growth stops. **Without a cap it never does** — the requirement was
    // `clearsToUnlock + floor(prestige / step)`, which climbs forever against a reward that does
    // not: Watto's rack holds thirteen distinct picks, and once they are gone a prestige is worth
    // a slot you may not need. Uncapped, a cycle reaches 243 runs at prestige 13 and 362 (~2.7
    // hours) by prestige 22, by which point the rack can't accelerate any further either.
    //
    // Five, for two reasons. It is 152 runs a cycle on an empty rack and about 69 with one, which
    // is a steady state a player can sit in; and it costs almost nothing over the progression the
    // mode is actually designed for — the run to prestige 13 goes 1,890 → 1,614 runs. The cap is
    // there for the endgame past it, not for the climb.
    //
    // This **used to be a drawing limit wearing a rule's clothes.** The old meter drew one custom
    // emoji per clear needed, and twelve of those wrap on a phone. The route map replaced it and
    // draws the Agains in plain unicode, so twenty tiles fit on a line and the constraint is gone;
    // what is left is pacing, and pacing is why it is now **4 rather than 5** — one step down, to
    // match `clearsToUnlock` moving the same way. Four Agains a gap is the 153-run steady state the
    // old five-clear cap bought at 152, and the road is sixteen tiles long by then.
    maxClears: 4,
    // Banks at the top level needed before prestige is offered. One, because surviving five
    // straight calls is already a 1-in-32 run — three of those would be a hundred-run grind.
    clearsToPrestige: 1,
    // `specialChance` used to live here: a flat per-cube chance that an equipped special turned up
    // in a roll. The **bag** replaced it — see `fillBag`. A run shuffles one bag holding every cube
    // on the rack padded out with plain ones, and draws `cubesPerLevel` from it per level without
    // replacement, which produces the same 25% on the opening pull and then climbs on its own as
    // the bag empties. There is nothing left to tune here: the odds fall out of the rack size and
    // the bag size, and the bag size falls out of the ladder.
    // `startingSlots` used to live here too, with a `+1 Special Cube Slot` pick on the rack raising it
    // one prestige at a time. **There is still a cap and it is still eight — but it is not a number on
    // this object and it is not for sale.** It is `bagSize()`, which falls out of the ladder: two cubes
    // a level across four drawing levels.
    //
    // The purchase went because a slot and a cube were **complements dressed up as substitutes**. A slot
    // with an empty bench did nothing, a benched cube with no slot did nothing, and because their values
    // were exactly anti-correlated the pick never had two answers — whichever you were short of was the
    // one to take. So half of every prestige went on making the other half work, and above `bagSize()`
    // the pick bought *nothing measurable at all*, because there is nothing above the bag to sell.
    //
    // For a while afterwards the loadout was uncapped, on the theory that fielding more than the bag
    // holds traded certainty for variety. It doesn't read that way in play: it reads as cubes that
    // don't turn up. A rack is eight seats, every seat is a cube the climb will meet, and the decision
    // is which eight — not how many. Nothing to tune here either way.
    // A run carries a **set** of cubes rather than composing a fresh line each level. It opens with
    // one, and every level after puts two more on the table — so an untouched set runs 1-3-5-7-9,
    // exactly the counts in LEVELS, and the payout ladder is unchanged.
    //
    // What makes it a set rather than a line is that the whole thing is thrown again every level.
    // The cubes persist; the sides never do. So a Tusken that culls one at Level 2 leaves you a cube
    // short for the rest of the climb — and an even count, and a live tie — while the call itself
    // stays a fresh 50/50 every time.
    startingCubes: 1,
    cubesPerLevel: 2,
    // **No ceiling.** A Mirror finishing its reflection, a Fode or Padmé slipping cubes in, a Binder
    // appending at the tail — none of them are held back any more, and because the set carries
    // across levels a table that grows keeps on growing. That is the point: a run where the line
    // gets away from you is the interesting one.
    //
    // Nothing about this is unbounded in *time* — a throw resolves in one pass over a queue that
    // only originals feed — so the risk is purely how much of a screen a very long row can eat.
    // That is handled where it belongs, at the point of drawing. Set a number here to put the cap
    // back.
    maxCubes: Infinity,
    // Watto's tie-breaker cube. A destructive face can leave an even line with no majority in
    // it, so he brings out a cube of his own — and his own cube is weighted. This is the chance
    // it lands *against* your call.
    tieLean: 0.6,
    // What Qui-Gon's Nudge makes a tie worth instead — the chance it lands *your* way once the pick is
    // taken. Its own lean rather than a mirror of Watto's, which is the whole change: the Nudge used to
    // reuse `tieLean` reversed, so taking it swung a tie from 40/60 against to 60/40 for, and that
    // 20-point swing measured **+23% EV on any rack**.
    //
    // The problem with that is not the size, it is that every other dial in this file then has to be
    // tuned twice — once for the population holding the pick and once for the population without it —
    // and `rewardChoices` describes these tie picks as "worth exactly as much as the rack that causes
    // them, and worth nothing on their own". A flat quarter of a player's EV is not that.
    //
    // Measured by `scripts/cubeLean.js` on a tie-heavy rack at the shipped dials, 200k climbs a row,
    // against an un-nudged baseline of EV 1.356 ±0.008:
    //
    //     nudgeLean   reads as    EV      fork vs un-nudged
    //     0.600        60/40     1.692        +24.7% ±1.1       ← the old reversal
    //     0.575        57/43     1.641        +21.0%
    //     0.550        55/45     1.625        +19.8%            ← shipped
    //     0.525        53/48     1.583        +16.7%
    //     0.500        50/50     1.556        +14.8%
    //
    // That section of the script runs at five times the sample count of the rest, and the ± is printed,
    // because the rows sit a few points apart and ties are only ~8% of rungs. Under-sampled, this table
    // comes out non-monotone and reads as the dial behaving erratically. It isn't; the measurement was.
    //
    // **The fork cannot be closed while the pick exists**, and that is worth knowing before anybody
    // tries: at 0.500 the Nudge makes a tie *fair*, which is still a 10-point gain over losing 60% of
    // them, so it is still worth +15%. Only removing the pick takes it to zero. The dial chooses the
    // width, not whether there is one.
    //
    // 0.55, because the pick has to stay obviously worth a prestige point — going from losing 60% of
    // ties to winning 55% is a 15-point swing and reads as a real prize — while it gives up a third of
    // the old reversal's fork, which is the most that can be bought without gutting the pick.
    //
    // A tie is still always a coin flip that somebody owns; the two owners just no longer hold the
    // same weight.
    nudgeLean: 0.55,
    // Buying a tie off him instead, once the rack has handed that over. Priced as a share of
    // the standing it buys, because a tie at the top of the ladder is worth thirty-two times one
    // at the bottom and a flat price would be free money up there. Every bribe already paid makes
    // the next dearer, and the count resets at prestige so the option can never price itself out for
    // good. **The offer itself is never withdrawn** — the price climbs past what the tie pays and he
    // goes on asking, because a lost tie is a bust and what that is worth avoiding is the player's
    // sum to do. See `asking` in actions.js.
    bribeShare: 0.25,
    bribeStep: 1.5,
    // What a rung does to the run's multiple. **A level multiplies it; an Again adds.**
    //
    // That split is the whole economy of the route, and it is the only shape that does all three
    // jobs at once:
    //
    // - **The ladder stays exactly fair.** A level push turns M into 2M on a coin flip, so its
    //   marginal EV is 1.000 — unchanged from the flat ladder the mode shipped with, and the
    //   property §3 of the design doc is built on. The entire house edge lives in the Agains,
    //   which is a far cleaner place for it than smeared across every rung.
    // - **The Agains compound.** Because the levels multiply, a +1 banked in gap 1 is doubled by
    //   L2, L3, L4 and L5 — worth **16×** what it added. One banked in gap 4 is worth 2×. So the
    //   peak a route can reach is `32 + 30g`, and every Again you bank takes its compounded value
    //   off that peak *forever*: 92× on a fresh g=2 route decays to 32× on a collapsed one. The
    //   biggest number in the game exists only on a fresh prestige, which is the whole reason to
    //   try to sweep a gap in one run instead of chipping at it.
    // - **The tail stays bounded** without a house limit or any other new furniture, because
    //   `32 + 30g` is linear in the padding rather than exponential in the depth.
    //
    // Past Level 5 every rung is an Again, so a push there buys +1 against a base of 32 or more:
    // marginal EV ~0.52, asymptotically 0.5. That is deliberately a bad deal rather than a wall.
    // The player can always keep rolling; the game just stops pretending it is a good idea.
    levelStep: 2,
    againBonus: 1,
    // What an Again is worth **past Level 5**, where there are no levels left to double it.
    //
    // At the ordinary `againBonus` an overtime push buys +1 against a base of 32 or more — marginal
    // EV 0.516, falling toward 0.5 — which is not a decision, it is a formality nobody sane takes.
    // The road is built so that nothing forces a stop, and an option nobody would ever choose is a
    // stop wearing a button.
    //
    // Five makes it merely bad instead of absurd, and it is **safe by construction**: an overtime
    // push is `(M + N) / 2M`, which stays under even money for any `N < M`, and `M` is never below
    // 32 up there. Measured across the multiples overtime can actually start from:
    //
    //          M=32    M=46    M=62    M=92
    //   +1     0.516   0.511   0.508   0.505
    //   +5     0.578   0.554   0.540   0.527    ← shipped
    //   +8     0.625   0.587   0.565   0.543
    //
    // So the ceiling on this dial is `32`, not a matter of taste — anything at or above it would
    // make rolling forever a winning strategy, which is the one thing the top of the road must not
    // be. Five is a long way clear of that and still triples the reason to press the button.
    overtimeBonus: 5,
    // What the Greed Cube and the Multiplier Cube do to a payout. **They add to a running
    // multiplier rather than multiplying it** — the run carries an ×N that starts at 1 and every
    // paying face nudges it up, Balatro-style. Two multipliers and a greed is ×3.5, not ×6.
    //
    // Multiplying them was the wrong shape twice over. It made a rack of paying cubes explode
    // rather than build — every copy a Binder or a Mirror made squared the effect, which is how a
    // four-slot rack ended up at 6× EV — and it made a single cube caught early worth more than the
    // same cube caught late, for no reason a player could see. Adding is legible: each face is worth
    // exactly what it says, wherever it turns up.
    //
    // They still ride the standing for the rest of the run, so catching one early still means it
    // pays on every level above.
    greedBonus: 0.5,
    multBonus: 1,
    // What the Boost Cube pays, **per position on the resolved line.** It is the one paying face whose
    // value isn't fixed at design time: a nine-cube line is +2.25 and a twenty-cube runaway is +5, and
    // whatever it lands on then compounds up the ladder like any other bonus.
    //
    // A quarter, because a clean Level 3 line is five positions and that puts it at +1.25 — a shade
    // over a Multiplier face, which is the right neighbourhood for a face that has to be *earned* by a
    // table the other cubes grew. Raising it rewards the growth racks specifically, which is the only
    // thing in the mode this dial touches.
    boostBonus: 0.25,
    // ---------------------------------------------------------------------
    // The Planet Octahedron
    // ---------------------------------------------------------------------
    //
    // What Mon Gazza's seam pays, **per rung this run has walked** — the rung it is standing on
    // included, so it is never worth nothing. It is the only paying face on the one axis nothing else
    // occupies: greed is flat, boost is per-position, mult is conditional on a side, and **none of
    // them pays for depth**. A seam on a fresh Level 1 is a Greed; the same face deep in a padded
    // route is worth several, and then compounds up whatever ladder is left above it.
    //
    // Half, so the shallow case lands exactly on a Greed and everything above it is the cube's own
    // argument for itself. This is the first dial to trim if the die measures hot: it is the only face
    // on it that adds money, so it is the only one that can be cut without taking away a decision.
    seamBonus: 0.5,
    // How many cubes Oovo IV takes. Four, against a Level 3 line of five, is a table gutted rather
    // than trimmed — which is the point, and why the release valves are not optional: **one prisoner
    // walks out per rung won**, and if the die is destroyed they all walk at once.
    //
    // Without the drip, "released when the die is destroyed" can mean *never*, because this cube
    // carries no wipeout and no mine and a rack with nothing destructive in it has no way to break it.
    // Four cubes gone permanently off a five-cube table is the deadlock measured at 9.6% of full-rack
    // runs and engineered around; a prison with no door would put it straight back.
    jailSize: 4,
    // The floor a scorch can never burn a cube past. **One**, so a plain cube fused to a colour is a
    // real endpoint rather than an impossible one — it just costs five separate burns to reach, which
    // is not something one climb will do.
    //
    // It is also what keeps the "a set always keeps something on it that can decide a roll" guardrail
    // intact: a cube with faces is a cube that can still land on one.
    minFaces: 1,
    // What one face point is worth, **as a share of the stake**. See the note on `POINTS` for why it
    // has to be a share and cannot be a flat sum: a flat one makes the minimum stake strictly dominant,
    // which is the Pure Cube pot's exploit exactly.
    //
    // What one face point is worth, as a share of the stake. A rung pays `stake × (multiple + points ×
    // pointValue)` — the points sit **beside** the ladder rather than being doubled by it, which is what
    // keeps the whole mechanic free of side effects. See `pointBonus` in the engine.
    //
    // One percent, so on a 📀1,000 stake:
    //
    //   Level 1, one ordinary cube          1 pt   →  +📀10
    //   Level 3, five ordinary cubes        5 pts  →  +📀50
    //   Level 5, nine ordinary cubes        9 pts  →  +📀90
    //   Level 5 with a Mirror and a Tusken  13 pts →  +📀130
    //
    // Sized as a **sweetener, not a second scoring axis**. It fires on every roll, where a Greed fires on
    // one face in six, so it has to stay small per-roll or it out-earns the multiple inside a level —
    // and because it doesn't ride the ladder it is deliberately most visible early, where a payout is
    // small enough for a hundred truguts to be worth noticing.
    pointValue: 0.01,
    // What a **pure line** pays, per cube on it. A sweep of nine is +9×, on top of whatever the ladder
    // and the paying faces had already built.
    //
    // Per cube rather than a flat figure, because the odds of collecting it halve with every cube the
    // line grows while the bonus only climbs by one. That makes it generous at three positions, where
    // a pure is a coin flip twice over, and self-limiting at nineteen, where it is one line in 262,144
    // — the payout it rides is already doubling per cube and this does not have to.
    //
    // Cheap on the ledger for the same reason: a pure lands on roughly 0.2% of rolls even on a full
    // rack — see the measurement in `settleWin` — and the sweeps that pay the most are the ones almost
    // nobody ever sees. What this buys is the moment, not a payout tier.
    //
    // See the note at the top of this file for why it is a multiple and not a jar: a multiple rides the
    // standing, so it scales with the stake, which is the exact property the pot lacked and the exact
    // reason the pot had to go.
    pureBonus: 1,
    // ---------------------------------------------------------------------
    // The weld
    // ---------------------------------------------------------------------
    //
    // ---------------------------------------------------------------------
    // The press, unlocked a rung at a time
    // ---------------------------------------------------------------------
    //
    // **Four picks off Watto's rack rather than one**, taken in order, each costing a prestige point.
    // The rack held seventeen things and then emptied — which is the hole the weld exists to fill, so
    // handing the whole mechanic over for a single point would have refilled it by four runs' worth
    // and left the same cliff four picks further along.
    //
    // Sequential because each rung is only interesting once the one below it is worn out: uneven cuts
    // are a rarity you notice after a dozen presses, a third cube is a shape you want once you have
    // run out of seats, and 5+1 is the prize at the end. A tier rather than four flags, because they
    // can only ever be taken in this order and a number says so where four booleans would not.
    //
    //   0  locked — no press at all
    //   1  The Press          two cubes, three faces each
    //   2  Uneven Cuts        4+2 becomes possible
    //   3  The Third Cube     the press takes three
    //   4  Deep Cuts          5+1 becomes possible
    //
    // `name` is what the rack calls the pick; `blurb` is what it promises.
    weldTiers: [
        {
            name: 'The Press',
            blurb: 'Weld two cubes into one seat, carrying three faces from each.',
        },
        {
            name: 'Uneven Cuts',
            blurb: 'The press sometimes takes four faces from one cube and two from the other.',
        },
        {
            name: 'The Third Cube',
            blurb: 'The press takes three cubes at once, two faces from each.',
        },
        {
            name: 'Deep Cuts',
            blurb: 'Rarely the press takes five faces from one cube and one from the other.',
        },
    ],
    // **How the press cuts, and how often**, keyed by how many cubes went in. A weld takes `take[k]`
    // faces from each parent, so the shipped table is a six-sided cube almost always and something
    // stranger once in a while. Weights are relative; the major share goes to a rolled parent.
    //
    // `tier` is the press rung a cut needs. Everything at or below the player's tier is in the draw
    // and everything above it simply is not there, so an upgrade **changes the table** rather than
    // adding a number — which is the whole reason the journey is worth walking.
    //
    // Three parents is 2+2+2 rather than 3+3+3 for one reason: a weld is a six-sider, and keeping it
    // one is what stops the press quietly inventing a second kind of cube. The rate per parent is
    // identical either way — 2/6 and 3/9 are both a third — so the six-face version costs nothing.
    //
    // **These weights are the only brake on an uneven split, deliberately.** Measured over 100k runs
    // a rack, seven welds covering all fourteen cubes, against a bare ladder:
    //
    //     3+3 every downside face survived   0.13     ← the floor a bad draw lands on
    //     3+3 every downside face dropped    0.83
    //     4+2 downsides dropped              0.95
    //     5+1 downsides dropped              1.09
    //     one 4+2 in an otherwise 3+3 rack   0.98
    //     one 5+1 in an otherwise 3+3 rack   1.15     ← 28% clear of optimal unwelded play
    //
    // For comparison a hand-picked eight left unwelded measures **0.90**, so 3+3 sits just under
    // optimal play and never obsoletes the choice of which cubes to bring. 4+2 and 5+1 are above it.
    //
    // **5+1 is a deliberate override rather than an oversight.** A parent pouring five of its six good
    // faces keeps its solo rate with the downside deleted, which is strictly better than the cube it
    // came from — Wild without Ratts. It ships because this mode is built to reward luck: `pureBonus`
    // pays for a 1-in-512 sweep that took no skill, and a cube that comes out of the press better than
    // either parent, once in a very long while, is the same idea applied to the one thing a player
    // keeps. The argument against is on the record in `docs/the-weld.md` §5.2 — every *other* luck
    // reward here is per-roll and evaporates, where this one is permanent.
    //
    // At these weights, once both rungs are bought, 4+2 is ~9% of presses and 5+1 ~0.9% — halved again
    // by the major share landing on the parent you wanted, so a useful 5+1 is roughly one press in 220.
    // Below those tiers they are not rare, they are **absent**, and the common cut is the whole table.
    weldSplits: {
        2: [
            { take: [3, 3], weight: 100, tier: 1 },
            { take: [4, 2], weight: 10, tier: 2 },
            { take: [5, 1], weight: 1, tier: 4 },
        ],
        3: [
            { take: [2, 2, 2], weight: 100, tier: 3 },
            { take: [3, 2, 1], weight: 10, tier: 3 },
            { take: [4, 1, 1], weight: 1, tier: 4 },
        ],
    },
    // **The chance a weld is allowed to drop every downside face its parents had.** Otherwise the press
    // keeps at least one, and which one is still a roll.
    //
    // The note above treats a downside-free weld as the rare prize at the end of the press. It was not
    // rare. `take` says how many faces come from each parent and nothing about *which*, so a 3+3 of two
    // one-mine cubes drops both mines a quarter of the time:
    //
    //     pairing                        downsides   P(clean) before this dial
    //     Greed + Wild                     1 + 1            25.0%
    //     Wild + Shortcut                  1 + 1            25.0%
    //     Wild + Gungan Shield             1 + 0            50.0%    ← the partner has none to inherit
    //     Greed + Mirror                   1 + 0            50.0%
    //     Wild + Multiplier                1 + 2            10.0%
    //     Multiplier + Boost               2 + 2             4.0%
    //
    // A quarter is the modal outcome, and welding a payer to the Shield or the Mirror was a coin flip,
    // because neither of those carries a downside face to pass on. What that produced is the cube the
    // Sebulba note warns about in so many words — *"a cube with no downside face never leaves the
    // table, so a one-sided effect is re-applied at every level for the rest of the climb and compounds
    // against a ladder that doubles"* — except welded, so it is also two cubes' worth of good faces.
    //
    // Measured in a real rack, one surviving mine roughly halves the weld:
    //
    //     wild+greed weld        EV     an evening at 1% of purse
    //     no mine               2.99          56×
    //     one mine (greed)      1.89           7×
    //     one mine (wild)       1.70           4×
    //     two mines             1.40         2.5×
    //
    //     expected weld, 25% clean (before)     1.997
    //     expected weld at weldPurity 0.01      1.679
    //
    // **1%, and the number is chosen for the sink rather than the EV.** By 0.01 the expected weld has
    // effectively bottomed out — 0.005 buys another 0.007 and nothing else — so everything below it is
    // bought purely as something to spend truguts on. `weldRerollCost` scales with the stake ceiling, so
    // at prestige 33 a reroll is 📀21.5T and a hundred of them is **📀2,147T**: about 2.7× the entire
    // purse the old faucet produced, which makes this the first thing in the mode that can absorb a
    // whale. See `weldRerollCost` for why the truguts price and the prestige-point path both stay live —
    // at a hundred attempts the point path is ~15,000 runs, so a rich player pays truguts and a normal
    // one simply never sees a clean weld, which is the right shape for a jackpot.
    //
    // It also makes 5+1 safe to keep rather than something to argue about: five good faces plus an
    // inherited mine is a superb cube instead of a strictly-better-than-its-parent one, which was the
    // objection `docs/the-weld.md` §5.2 records.
    //
    // A pairing where **no** parent has a downside face — Mirror, Gungan Shield, Symbiont — is untouched
    // by this. There is nothing to inherit, so the press cannot invent one and does not try.
    weldPurity: 0.01,
    // How many of a pairing's previous welds the press will not hand back. **Two, which is the rule
    // Stardew's forge uses** — a tool there tracks the last two enchantments so neither is reselected.
    //
    // It is load-bearing here rather than a courtesy, because the outcome spaces are *tiny*: a cube's
    // faces repeat, so drawing three of six positions gives Wild exactly **two** possible halves and
    // the Gungan Shield exactly **one**. A `greed+wild` pairing has four distinct welds in total. With
    // no exclusion a reroll hands back the identical cube about a third of the time; at two it cannot
    // hand back either of the last two, which on a space of six still leaves four to draw from.
    //
    // `rememberWeld` floors it below the space size so a pairing can never be excluded to nothing.
    weldMemory: 2,
    // What a weld reroll costs in truguts. Scaled by the stake ceiling exactly as `rerollCost` is, and
    // for a sharper reason: **a flat price means truguts always win and prestige points never get
    // spent**, which is the whole problem the weld exists to solve. Tying it to the ceiling grows the
    // cost with the thing that makes truguts easy to come by, so the choice between the two currencies
    // stays live forever.
    //
    // It is deliberately **not** escalated per weld. Unwelding is free and welding costs a point, so
    // unweld-then-reweld is *already* a one-point reroll — had this escalated, that path would also
    // reset the escalation and strictly dominate paying a point, making the point option a button
    // nobody should ever press. With nothing to reset the two cost the same and neither dominates.
    weldRerollCost: 2500,
    // Base price of a bought reroll, once the perk is unlocked. Scaled by the stake ceiling so
    // it keeps pace with prestige — a reroll is only worth it if you mean to push deep.
    rerollCost: 2500,
    // Each reroll already in stock makes the next one this much dearer, so stockpiling gets
    // expensive fast and the price falls back on its own once they're spent. No extra counter
    // to keep: the stock *is* the escalation.
    rerollPriceStep: 1.5,
};
