// Static design data for Botto's Chance Cube — the betting minigame unlocked by the
// "Red vs Blue" collection (3× Red Side + 3× Blue Side, see data/challenge/collection.js).
//
// The cube is fair: every face is a straight 50/50 draw from the CSPRNG. **The house edge is in
// the pay table, not in the cube** — a level rung is a coin flip worth 2× and pays `levelStep`,
// keeping 3% of every push, and the **Agains** standing in the gaps are the steeper price on top
// of that: `M → M+1` on a coin flip. Nothing is raked at the door, nothing is minted, and a
// busted stake simply leaves the economy. See `levelStep` and `againBonus`.
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

// What a level rung multiplies the run's multiple by, and the mode's entire house edge: a rung is a
// coin flip worth 2.000 and it pays this. Declared up here rather than beside its siblings in `cube`
// because the `payout` column below is derived from it — see `levelStep` for the argument, which is
// where anyone changing it will look.
const LEVEL_STEP = 1.94;

// N is always odd, so a bare level always has a majority in it and only a special cube can
// leave a tie. The majority of an odd number of fair cubes is always exactly 50/50, so climbing
// never changes your odds — it only raises the multiple and the size of the crater.
//
// **`payout` is the multiple a level pays on a fully collapsed route, and nothing else.** A run
// walks a *route* of rungs — these five levels, plus the uncleared `Again` rungs still standing in
// the gaps between them — and the multiple is carried by the run rather than looked up here: a
// level rung multiplies it, an Again rung adds one. On a route with nothing left in the gaps those
// two facts reproduce this column exactly, which is what it is for. On a padded route Level 2 sits
// further along and pays more, because more coin flips went into it. See `levelStep`/`againBonus`.
//
// **Computed rather than typed, because it is not independent.** It was `2, 4, 8, 16, 32` by hand
// while the step was a clean double, and a hand-typed column is a column that goes stale the first
// time the step is priced — which it now has been. This is `LEVEL_STEP^(n+1)` exactly, which is what
// a run walking a collapsed route arrives at, to the last place.
//
// **Not rounded here.** It is a base multiple as well as a readout — `settleTie` falls back to it for
// a parked tie — and money is `stake × multiple`, so a rounded column pays a rounded prize. The
// client rounds it to one decimal when it draws it; see `dec` in the Activity's `sheets.js`.
exports.LEVELS = [
    { name: 'A Friendly Wager', cubes: 1 },
    { name: 'Test Your Luck', cubes: 3 },
    { name: 'Rolling Thunder', cubes: 5 },
    { name: 'Gamblers and Swindlers', cubes: 7 },
    { name: 'Fate Decides', cubes: 9 },
].map((l, i) => ({ ...l, payout: LEVEL_STEP ** (i + 1) }));

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
//   heat        payout multiplier + heatBonus for every heat face this cube has already landed, this
//               one included — then burns itself off the cube, so it pays more and dies sooner
//   scavenge    takes the last cube to enter the hold and slips it in on its right, thrown and live
//   haul        takes the cube on its right off the line and into the hold, to be scavenged back
//   guide       payout multiplier + guideBonus for every cube in the unbroken run of the called side
//               touching it, counted outward both ways from its own position
//
// The eight faces of the Planet Octahedron are the only ones in the game that reach outside the
// line — see the note on that cube for what each is for and what pays for it:
//   freeze      both neighbours keep the face they are showing into the next throw and take no turn
//   scorch      burns the face each neighbour is showing **off that cube**, for the rest of the climb
//   vault       seals the side just called; the next rung has to be called the other way
//   blessing    one cube at random cannot be destroyed this rung, a mine included
//   seam        payout multiplier + seamBonus for every rung this run has walked
//   jail        takes up to `jailSize` other cubes into this die's own cell — see Capture below
//   plunge      the head and the tail of the line fall away — the die included, if it is on an end
//   crowd       paints a face on each neighbour in the colour leading the line, for the climb
//
// ---------------------------------------------------------------------------
// Capture: cubes that hold other cubes
// ---------------------------------------------------------------------------
//
// Three faces take a cube off the line **without destroying it** — `haul` on the Scavenger and
// `jail` on the Planet Octahedron take them, `scavenge` puts one back. A captured cube draws
// nothing, counts toward neither side and cannot end the run; and it is still in the run, sitting
// in the **hold of the cube that took it**, on that cube's slot, where it keeps its ice, its scorch
// marks, its heat and whatever it was holding itself.
//
// That the inventory belongs to the cube rather than to the run is the whole of the design, and
// four rules fall out of it. They are stated here because they are rules rather than tuning;
// `resolveLine` is where they are enforced:
//
//   1. **A captor can be captured, to any depth.** A hold holds whole cubes, holds and all. It
//      cannot loop: a cube goes into exactly one hold and leaves the line when it does, so it can
//      never end up inside itself.
//   2. **A copy of a captor copies the hold**, deep, so the two are two cubes and cracking one open
//      has nothing to do with the other. A Mirror reflecting Oovo IV puts a second *cell* on the
//      line rather than a second door onto the first — four more arrests, and a second parole to
//      serve. It is the one place the game makes cubes out of nothing and it is deliberate.
//   3. **Destroying a captor frees its prisoners immediately** — burned, culled, razed, plunged,
//      purged, blasted, cloned or reflected over, all the same — onto the line **to the right of the
//      cube taking the turn**, not of the cube that was holding them. The line resolves strictly
//      left to right, so a cube put back where its captor stood would be behind the walk and would
//      sit out the roll it was freed into. They come back thrown and live, holding what they held.
//   4. **A jailer hands one prisoner back at the start of every turn it takes**, whatever face it is
//      showing that rung. The promise belongs to the cube and not to any face on it — the sentence
//      outlives the throw that handed it down. `JAILERS` in the engine is what carries it, read off
//      the face data so a weld or a second jailer is covered the day it exists.
//
// The Scavenger has no parole: a `scavenge` face is what fetches its hold back, and that is the
// whole difference between a hold and a prison. What it reaches into when its own hold is empty is
// the run's **wreckage** — every cube the climb has destroyed, which belongs to nobody.

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
    heat: 1,
    guide: 1,
    // The Scavenger. `scavenge` changes the shape of the line and `haul` moves one thing off it, which
    // is the same split `draw` and `burn` already sit either side of.
    scavenge: 3,
    haul: 2,
    // The Planet Octahedron, scored by the same rule as everything above it: 3 changes the shape of
    // the board, 2 moves one thing, 1 is the floor for turning up. `scorch`, `jail`, `plunge` and
    // `crowd` restructure — the first three the line, the last a cube, which is the more permanent of
    // the two; `freeze`, `vault` and `blessing` move one thing each — a face, a call, a cube's odds of
    // surviving the rung; `seam` is already paid on the multiple.
    freeze: 2,
    scorch: 3,
    vault: 2,
    blessing: 2,
    seam: 1,
    jail: 3,
    plunge: 3,
    crowd: 3,
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
//
// **This is a floor, not an invariant, and the Wild Cube is the measured exception.** The reasoning
// above was derived from two cubes sitting at 0.32 EV — it says a second Ratts is ruinous *for a
// cube that is already marginal*, which is a claim about that regime and not about every cube. The
// Wild was never in it: it carries the only guaranteed vote in the game, and a guaranteed vote is
// worth more than any downside face can price. At two mines it still measures 1.139 EV fielded
// alone, comfortably above the 1.0 the rule exists to keep cubes clear of, and above what most of
// the rack manages with one. See the note on the cube itself for what the second face is buying.
const END = { kind: 'end', id: 'end' };
// Wipeout. Does nothing to this roll and takes the cube off the table for the rest of the climb.
const BROKEN = { kind: 'broken', id: 'broken' };

exports.SPECIALS = [
    {
        // **The only guaranteed vote in the game, and the reason it costs two mines.**
        //
        // A rung pays `levelStep` 1.94 against a fair 2.000, so a rung is worth taking at any
        // `P(win) > 0.5155`. A wild does not nudge that number, it removes a cube from the coin flip
        // and hands the position to the player outright — which is majority-of-N amplification, the
        // exact property `dayLean` was deleted for, except the player owns it and it never rotates:
        //
        //     level  cubes   fair    +1 wild   +2 wilds   +3 wilds
        //     L3       5    0.5000   0.6875     0.8750     1.0000
        //     L5       9    0.5000   0.6367     0.7734     0.8906
        //
        // Every one of those is 23–33% clear of break-even, on a ladder that compounds five times —
        // and because the set carries over, a wild drawn at Level 1 is standing on the line for the
        // whole climb. At five faces this was the single largest term in the mode: dropping it from a
        // hand-picked eight took 92% of the rack's log-growth with it, and a best-of-breed eight
        // measured **4.10 EV a run**, which is a purse doubling every few dozen rolls at any stake
        // fraction a player cares to pick. No `levelStep` reaches that — 1.75 prices this rack at 40×
        // an evening and has the *empty* rack bleeding, which is the wrong player to charge.
        //
        // So the fix is on the cube. Four wild faces and two Ratts, measured at 150k climbs a cell:
        //
        //     faces                     best-of-breed 8   wild alone   empty rack
        //     5 wild + 1 mine (was)        4.095 EV          1.428        1.126
        //     4 wild + 1 mine + 1 wipe     2.398 EV          1.247        1.122
        //     4 wild + 2 mines             1.829 EV          1.139        1.131   ← shipped
        //
        // The empty rack does not move in any row, which is the whole argument for fixing this here
        // rather than in the pay table.
        // ---------------------------------------------------------------------
        // **Three and three, because `blastReach` changed what a mine costs.**
        // ---------------------------------------------------------------------
        //
        // Every number in the sweep above was measured against an *unbounded* blast, where a mine took
        // the whole row and therefore cost the run. Two of them were the price of this cube's guaranteed
        // vote. Bounding the blast to one position either side (see `blastReach`) cut that price hard,
        // and this cube felt it more than anything else in the game because it was the only one paying
        // it willingly: at 4 wild + 2 mines it measured **1.740** in a seat against an empty seat at
        // 1.048, and the best seven a greedy build could find came back at **1.66 EV** — a 66% edge.
        //
        // Re-swept at `blastReach 1`, 250k climbs a cell:
        //
        //     wild faces                  in a seat   best-seven L5   best-seven L3
        //     4 wild + 2 mines              1.740         1.656          1.160
        //     3 wild + 3 mines              1.305         1.345          1.057   <- shipped
        //     3 wild + 2 mines + 1 wipe     1.340         1.447          1.094
        //     2 wild + 4 mines              1.143         1.133          0.983
        //     2 wild + 3 mines + 1 wipe     1.170         1.188          1.008
        //
        // **3 and 3 rather than 2 and 4**, even though 2+4 prices closer to even, because the cube has to
        // stay the thing its name says. A Wild that votes your way twice in six and detonates four times
        // is a bomb with a colour preference, not a wild — and the remaining edge belongs to the pay
        // table rather than to this face list, which is the same argument the sweep above makes.
        //
        // It also reads as what it now is. Half the faces hand you the position and half blow a hole in
        // the line, which is the cube the bounded blast wants: something that destroys and can be
        // destroyed, on a table with enough cubes on it for that to be a trade rather than an ending.
        id: 'wild', name: 'Wild Cube',
        blurb: 'Three faces land on the side you called. Three blow a hole in the line.',
        faces: [...rep(3, { kind: 'wild', id: 'wild' }), ...rep(3, END)],
    },
    {
        id: 'greed', name: 'Greed Cube',
        blurb: 'Five faces pay +50% on the level. One ends the run.',
        faces: [...rep(5, { kind: 'greed', id: 'greed' }), END],
    },
    {
        // **The Wild Cube's disease at four fifths strength, and it went untreated for exactly as long
        // as it took to measure a rack that leaned one way.** The note above prices a guaranteed vote;
        // this is a 4:1 vote, which is the same property with the certainty filed off — majority-of-N
        // amplification with the player holding the dial, and the dial is which colour they say.
        //
        // What hid it is that a lean *inside a rack* cancels. The shipped hand-picked eight fields Shmi
        // and Anakin together, and `cubeLean.js` called one fixed colour, so the pair measured as two
        // ordinary cubes and the mode was priced against that. A rack holding one of them and a player
        // saying its colour is a different game, on a rack of otherwise safe cubes at 5% of purse:
        //
        //     shmi faces        call red   growth/roll   call blue   red/blue gap
        //     4R 1B 1wipe        1.266       +0.29%        0.959         32%      ← was
        //     4R 1B 1mine        1.073       -0.02%        0.978         10%      ← shipped
        //     4R 2mines          1.018       -0.29%        0.971          5%
        //     3R 2B 1wipe        1.062       -0.08%        1.033          3%
        //
        // **The face that changed is the downside one, and that is the whole of the fix.** A wipeout
        // costs a cube; a mine costs the run. Every other biased or guaranteed vote in the game is
        // fenced by mines — the Wild pays two for its certainty — and these two were fenced by the one
        // downside face in the mode that a climb can shrug off, which is why the bias was free.
        //
        // The face list is also the flavour, so trimming the bias to 3:2 was the wrong lever even though
        // it measures well: "red four times in six" is the line, and a Shmi Cube that calls red three
        // times in six is not a Shmi Cube. The mine keeps the character and prices it.
        id: 'shmi', name: 'Shmi Cube',
        blurb: 'Red four times in six, blue once — red was his mother. One face ends the run.',
        faces: [
            ...rep(4, { kind: 'side', side: 'red', id: SIDE_IDS.red }),
            { kind: 'side', side: 'blue', id: SIDE_IDS.blue },
            END,
        ],
    },
    {
        // Shmi's mirror in every respect, including the mine — see her note for why it is a mine and
        // not a wipeout. A one-sided rack is one-sided whichever colour it leans, so a change to one of
        // these that is not made to the other just moves the exploit to the other colour.
        id: 'anakin', name: 'Anakin Cube',
        blurb: 'Blue four times in six, red once — blue was the boy. One face ends the run.',
        faces: [
            ...rep(4, { kind: 'side', side: 'blue', id: SIDE_IDS.blue }),
            { kind: 'side', side: 'red', id: SIDE_IDS.red },
            END,
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
        // **The name is flavour and the id is not.** `multiplier` stays the id, `mult:red` and
        // `mult:blue` stay the face ids, and `SPECIAL_EMOJI` and `FACE_EMOJI` are keyed off both — so
        // the Discord side and every lookup in the engine are untouched by what it is called.
        //
        // It was "Multiplier Cube", which was the one name on the rack that was a stat rather than a
        // thing, sitting between Greed and the Turbine and the Boost. A midi-chlorian count is a
        // measure of latent potential, which is what this cube pays for: it doubles what was already
        // there and pays nothing at all if you called the wrong side. It also pairs with the Symbiont
        // Cube, which is the other half of the same speech.
        id: 'multiplier', name: 'Midi-chlorian Cube',
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
        // a blast — and it covers the Reroll Cube, the Midi-chlorian, the Boost, the Sebulba, the
        // Turbine and the Scavenger, so its hit rate scales with how much fragile kit is on the table.
        // **Not itself, any more:** it carries no wipeout face now, because blocking a blast is the whole
        // of what this cube costs. See the note on its face list.
        //
        // **It used to cover Shmi and Anakin and no longer does**, because those two traded their
        // wipeout for a mine — see Shmi's note. That moves them from the save's list to the blast's,
        // which is a straight loss to this cube on a rack fielding either: measured on a fragile eight
        // the save fires 0.19 times a run, and the two of them were the only members of the list that
        // cast a vote when rescued.
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
        // the mine-carrying cubes of the day — measure **0.56** on their own, which is unplayable. A
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
        //
        // ---------------------------------------------------------------------
        // **The sweep above is superseded, and this is what it missed.**
        // ---------------------------------------------------------------------
        //
        // Every row of it prices the cube by what it *rescues*, which is the right question for one
        // cube and the wrong one for a rack. What a six-face shield with no downside on it actually
        // does is **delete the price of every mine-carrying cube in the game** — Wild, Greed,
        // Shortcut and Guide are each balanced by exactly one Ratts face, and this cube is a
        // permanent, unbreakable, six-in-six answer to all of them at once. It is not a defensive
        // cube in the rack it matters in; it is the enabler that lets four paying cubes be fielded
        // without the thing that pays for them.
        //
        // That reads straight off a drop-one: on the hand-picked eight the Gungan carried **70% of
        // the rack's log-growth**, second only to the Wild's 92% and ahead of every cube that
        // actually pays. A cube whose blurb is "stops a mine" has no business being the second
        // largest term in the mode's economy.
        //
        // So it takes a price of its own, in both currencies: a Ratts, so that the answer to every
        // mine on the rack carries one itself, and a wipeout, so that the answer is not permanent.
        // Re-swept with the Wild's own re-cut in place, 120k climbs a cell, against a best-of-breed
        // eight measured **without** the Gungan at 1.431 EV — so the last column is what the slot
        // itself is worth, which is the number the original sweep never asked for:
        //
        //     gungan faces              best-of-breed 8   the slot is worth
        //     6 shield (was)               2.832 EV            +97.9%
        //     5 shield + 1 wipeout         2.593 EV            +81.1%
        //     4 shield + 2 wipeout         2.449 EV            +71.1%      ← the old sweep's floor
        //     5 shield + 1 mine            1.924 EV            +34.4%
        //     4 shield + mine + wipeout    1.790 EV            +25.1%      ← shipped
        //
        // **The mine is the load-bearing half and the wipeout is not a substitute for it.** Every
        // configuration the old sweep considered varied only the shield count, and the whole of that
        // axis is worth 27 points where a single Ratts is worth 64. Taking shields off leaves the
        // cube free at the door — it still answers every mine on the rack for the levels it survives,
        // and answering them is the whole of what the slot is being paid for.
        //
        // +25% is the target rather than zero, and deliberately so: this is still the second-best
        // cube in the game and should still read as a prize. What it is no longer is the second
        // largest term in the mode's economy.
        //
        // **It does not become a trap, and the first draft of this note wrongly said it might.** A
        // small mine-heavy rack — Greed + Shortcut + Wild — does measure worse with the Gungan added
        // than without it, but it measures worse at **six** shields too (1.003 against 1.017), so
        // that is a property of spending a bag seat on a cube that casts no vote and not of anything
        // changed here. Comparing racks of different sizes is what produces the false reading.
        // ---------------------------------------------------------------------
        // **The mine came back off, and the sweep above is the reason it should never have gone on.**
        // ---------------------------------------------------------------------
        //
        // Every row of that sweep prices the cube against a *mine-heavy* best-of-breed eight, and that
        // rack is no longer what a best-of-breed eight is. Greedily building the strongest seven from
        // the whole set, one cube at a time, gets **sebulba, boost, multiplier, turbine, pitdroid,
        // mirror, symbiont** at 1.10 EV banking L3 — and not one of them carries a mine. Wild, Greed,
        // Shortcut, Guide, Shmi, Anakin and the Reroll Cube are all left on the bench.
        //
        // So the premise is gone. Re-swept against that seven, 40k climbs a cell, slot 8 measured
        // against the same seat holding Greed:
        //
        //     gungan faces              slot worth   mines blocked   wipeouts saved   own mine's
        //                                              per run          per run       share of busts
        //     6 shield                     +14.4%       0.000            0.064             —
        //     5 shield + 1 wipeout         +22.6%       0.000            0.052             —      ← shipped
        //     5 shield + 1 mine             -2.9%       0.005            0.051           90.0%
        //     4 shield + mine + wipeout     +0.3%       0.002            0.036           87.7%    ← was
        //
        // **The mine-stop fires 0.000 times a run.** Not rarely — never. The cube exists to answer a
        // mine and the strongest rack in the game has no mine in it, so the whole of its stated job is
        // dead content on the only loadout worth building. Everything it is actually worth is the
        // wipeout save, the half the note above calls "the other half".
        //
        // And with nothing else on the rack carrying a mine, **its own Ratts became 90% of that rack's
        // deaths.** A cube whose blurb leads with "stops a mine" was, in practice, the mine. That is
        // not a price for a strong effect, it is the cube inverting itself: -2.9% for the slot, against
        // +22.6% for the same cube with the Ratts taken off. The old configuration measured +0.3%,
        // which is a prestige reward worth precisely nothing.
        //
        // **+25% is still the target and 5 shield + 1 wipeout is the row that hits it** — the note above
        // says so in as many words, and the mine was the reason nothing did. 6 shield is not cleanly
        // separated from it on this data (+14.4% ±0.026 against +22.6% ±0.026) and there is no argument
        // for handing back the downside face as well, so the wipeout stays: the answer to the rack's
        // fragile kit should be able to come apart too.
        //
        // **What this does not fix**, and it is the larger finding: the mine-block half is dead content
        // because *mine-carrying cubes are unfieldable*, not because this cube is mispriced. Nine cubes
        // the greedy build refuses to touch is the thing to look at next, and it is a question about the
        // Wild's and Greed's prices rather than about this one.
        id: 'gungan', name: 'Gungan Shield Cube',
        // ---------------------------------------------------------------------
        // **Six shield faces. One rule: it stops the blast on its side and dies holding.**
        // ---------------------------------------------------------------------
        //
        // This cube collected costs it did not need. At various points it carried a **mine**, a
        // **wipeout**, a per-throw "already spent" flag, and a **deflection** rule that checked the colour
        // of everything inside the blast window. Four mechanisms, and a player could not say what the cube
        // did or cost without reading all of them.
        //
        // What it does now is the original rule with a reach on it: the blast travels out from Ratts, a
        // shield stops it on that flank, the shield goes, and everything behind the shield lives. Position
        // is the whole of the skill and it needs no second mechanic — a blast stopped on one side already
        // eats the other side, which is what the deflection rule was reinventing at the cost of a dial
        // and a comparison per position.
        //
        // **Side faces were tried as a price and they are a trap worth recording.** The idea was to trade
        // shield faces for faces that simply vote, so the cube had a cost with no downside. Measured on
        // log-growth against the same seat holding a Boost, four repeats a row:
        //
        //     faces                  dg x1e-4     note
        //     5 shield + 1 red         +6.57      best measured, and the reason is bad
        //     3 shield + 3 sides       +3.66      2 red to 1 blue
        //     6 shield                 +2.85      shipped
        //     4 shield + 1R + 1B       +0.51      balanced, and nearly worthless
        //
        // The ranking is non-monotonic in both shield count and side count, and the cause is colour bias.
        // A side face on a special is a *fixed* vote, so an unbalanced pair is a lean — and by the
        // convexity argument at `rollSide` in `engine.js`, any lean mints truguts whichever way it points.
        // Measured by fixed call on a Shmi rack: 6 shield spreads 225/148 red-to-blue, and adding one red
        // face widens it to 245/137 while lifting the average 2.5%. A *balanced* pair adds 0.2% and is
        // therefore not a price at all. So side filler is either an exploit or a no-op, and neither is
        // useful. That is the same lesson Shmi's mine exists to teach.
        //
        // Which leaves six shields and no downside face, and that is fine now in a way it was not before.
        // The old note argued a downside-free shield was worth +97.9% — true when a blast took the row and
        // stopping it saved the *run*. At `blastReach 2` it saves some cubes, and the cube measures around
        // **+17%**: a real prize, not the second-largest term in the economy.
        blurb: 'Every face stops the blast from a mine on its own side of the line, and is destroyed '
            + 'doing it. It also holds a neighbour that wipes out together.',
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
        // **The one cube that grows, and it grows by spending itself.**
        //
        // Every other payer is flat (`greed`), per-position (`boost`), conditional on a side (`mult`)
        // or per-rung (`seam`). None of them has a memory of itself, so no cube on the rack is worth
        // more at Level 5 than it was at Level 2. This one pays `heatBonus` more on every landing than
        // it paid on the last, and burns one of its own faces off to do it.
        //
        // **The distribution is exact rather than measured.** Heat faces leave and the wipeout does
        // not, so the cube is a uniform shuffle of six faces read in order until the wipeout turns up:
        // the number of heats before it is uniform on 0–5 at 1/6 apiece, and the run totals are
        // 0, +0.5, +1.5, +3, +5, +7.5 for E = **+2.92**.
        //
        // Two things hold it down and neither is a dial. It is **back-loaded against a ladder that
        // doubles** — a +0.5 caught at Level 2 is doubled three more times and lands worth 4, where the
        // +2.5 arriving at Level 5 is worth 2.5 — so the big numbers turn up where they buy least. And
        // it carries **no mine**: it cannot end a run, its whole price is that it destroys itself on a
        // schedule the player can count off the rack screen.
        //
        // It needs no state of its own. `burned` already exists for Baroonda's scorch and a burnt face
        // is already filtered out of the roll, so the payout is read off the cube's own damage.
        id: 'turbine', name: 'Turbine Cube',
        blurb: 'Five faces pay more every time, and burn themselves off the cube. One shatters it.',
        faces: [...rep(5, { kind: 'heat', id: 'heat' }), BROKEN],
    },
    {
        // **The only thing in the game that puts a cube back.**
        //
        // There are nine ways to destroy one and none to recover it, and that asymmetry is measured:
        // 9.6% of full-rack runs reached a table that could not decide a roll, which is why a won tie
        // hands over a plain cube. That rule is the mode apologising for a hole in the rack; this is
        // the cube that fills it.
        //
        // **`haul` is the price, and it is also the setup.** Four salvage faces and two wipeouts left
        // the cube dead on a clean run — nothing destroyed, nothing to recover. Jawas do not wait for
        // scrap: the sandcrawler takes the cube on its right off the line and into the hold, and a
        // later `scavenge` puts it back. It costs a position for the rest of the roll, which pushes an
        // odd count even on a mode where a tie is lost 60% of the time; it takes whatever is standing
        // there, which can be a Wild or a hot Turbine; and if the run ends first the cube never comes
        // back at all.
        //
        // **What it hauls goes into its own hold**, not into a pile the run keeps — see Capture at the
        // top of this file. So the two halves of the cube are a loop on one object: haul, then
        // salvage. And the price of that is real, because a hold with an owner is a hold that can be
        // taken away: break the Scavenger and everything in it walks back onto the line at once,
        // which is a windfall for the player and the end of the cube's own scrap supply.
        //
        // **`scavenge` reaches into its own hold first and the wreckage second**, which is what keeps
        // the correlation the cube is for. The wreckage is every cube the run has destroyed and
        // belongs to nobody, so a Scavenger that shatters lands in it and a reflected copy can pull
        // the original back out — the loop the old shared hold had, kept deliberately.
        //
        // **One wipeout stays** for the reason the Sebulba note gives: a cube with no wipeout and no
        // mine never leaves the table, and `haul` is frequently a cost the player is glad to pay.
        //
        // What earns it a seat is the correlation rather than the recovery. Every other cube is worth
        // more when the run is going well; this one is worth exactly as much as the rest of the rack
        // has failed.
        id: 'scavenger', name: 'Scavenger Cube',
        blurb: 'Three faces salvage a cube — out of its own hold first, the wreckage second. '
            + 'Two haul one off the line into it. One shatters the cube.',
        faces: [
            ...rep(3, { kind: 'scavenge', id: 'scavenge' }),
            ...rep(2, { kind: 'haul', id: 'haul' }),
            BROKEN,
        ],
    },
    {
        // **The first face that pays for the shape of the line.**
        //
        // Ten faces care intensely about position — the Mirror reflects left onto right, the Binder
        // copies left to right, Sebulba's engines point, Ben eats both neighbours, the plunge takes the
        // ends — and the only patterns anything ever *reads* are majority and all-one-side. Position
        // decides everything about what happens and nothing about what it pays.
        //
        // **It is the pure bonus for racks that can never have one.** Effect cubes hold positions
        // without being sides, so a full rack takes the Level 3 pure-5 rate from 3.11% to 0.45% and a
        // player who actually built a rack is locked out of the one thing that pays for clean colour.
        // `pureBonus` pays +1 per cube for a whole clean line; this pays `guideBonus` per cube for a
        // clean stretch. Half rate, for a strictly easier condition.
        //
        // **And the two can never both be collected**, by construction rather than by a rule: a pure
        // needs every position on the resolved line to be a cube on the called side, and this face is
        // not a side, so a Guide on the line disqualifies the pure it is paying in place of. There is
        // no stacking case to price.
        //
        // It counts outward from its own position **both ways**, stopping at the first position that
        // is not a cube on the called side. One direction would be worth zero from position alone
        // about half the time, and "the clear stretch it is standing in" is one object a player counts
        // at a glance where "the run to its right" is a rule they have to remember. Both-neighbour
        // geometry is already Ando Prime's and Baroonda's.
        //
        // Every other position stops it, effect faces included. Making them transparent would pay more
        // and read worse: the justification for the whole cube is that the payout can be counted by
        // looking at the line, and a rule that asks the player to mentally skip positions gives that up.
        id: 'guide', name: 'Guide Cube',
        blurb: 'Five faces pay for every cube in the unbroken run of your call touching it. '
            + 'One ends the run.',
        faces: [...rep(5, { kind: 'guide', id: 'guide' }), END],
    },
    {
        // **Eight faces, one per planet, and not one of them is a side.**
        //
        // Every other cube in the game acts on the line. This one reaches outside it: at the cubes
        // themselves (`freeze`, `scorch`, `crowd`, `blessing`) and at the one button the player
        // actually presses (`vault`). It is the only cube whose effects survive the throw that
        // produced them.
        //
        // **Eight faces is free and it is not cosmetic.** Nothing in the engine assumes six — a face is
        // drawn with `randomInt(0, faces.length)` — so the shape costs nothing to build, and it changes
        // the odds it is built on: any one planet is 12.5% a throw against a six-sider's 16.7%. Each face
        // therefore has to be worth meeting, which is why several of them are as sweeping as they are.
        //
        // **It is sideless on all eight faces as it comes off the shelf**, so the die is a permanent
        // tie machine: it eats a voter on every throw, which is what drives 22–26% of rungs to Watto's
        // cube. `boonta` used to answer one throw in eight of that and has been replaced — see
        // `docs/planet-octahedron.md` — because one throw in eight of a problem the cube causes on all
        // eight is a loop that does not close.
        //
        // **A painted planet face is the one exception, and it needs another die to happen.** Nothing
        // paints itself, so only a Binder or a Mirror that has duplicated this cube can put a painted
        // face on one. Rare enough to be a story rather than a rule, which is why no special case is
        // written for it.
        //
        // **No wipeout and no mine, so the price lives inside the planets.** A cube with no downside
        // face never leaves the table, and the Sebulba note above is the record of what that does to an
        // effect that only ever helps. **Two faces here are bad for you and it used to be three:**
        // `plunge` takes cubes, `jail` takes cubes and hands them back slowly, and the exit is no
        // longer taken at all. Against that: one payer, one guard, and a `crowd` that is as likely to
        // paint a table against its owner as for it — which is a real cost and a slower one, and is
        // the thing the re-measure has to answer for.
        //
        // **`plunge` is the key to all of it.** It takes whatever is standing on the ends of the line,
        // this cube included, which makes it the die's only self-destruct, the jailbreak that frees
        // everything `jail` is holding. Two cruelties, one key, and the
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
        // frees everything `jail` is holding — two cruelties and one
        // key. A weld halves the rate of every face on it, so the key thins out at exactly the same
        // rate as the prison does; but `jail` also drips one prisoner out per turn the die takes, so
        // the two do not cancel and the prison fills faster than it empties. Diluting this cube reintroduces the
        // deadlock the road had to engineer the tie rule around, measured at 9.6% of full-rack runs.
        //
        // Read off the cube rather than a list of ids, so a second unweldable cube is covered the day
        // somebody adds one.
        noWeld: true,
        faces: [
            { kind: 'freeze', id: 'freeze' },
            { kind: 'vault', id: 'vault' },
            { kind: 'scorch', id: 'scorch' },
            { kind: 'blessing', id: 'blessing' },
            { kind: 'seam', id: 'seam' },
            { kind: 'jail', id: 'jail' },
            { kind: 'plunge', id: 'plunge' },
            { kind: 'crowd', id: 'crowd' },
        ],
    },
];

// ---------------------------------------------------------------------------
// Watto's book
// ---------------------------------------------------------------------------
//
// A side bet names an **event** rather than an outcome — a cube gets copied, Ben razes a neighbour, a
// shield holds — and adds its price to the rung's multiple if it happens. Every one of those events is
// already a note the engine emits, so a proposition is a predicate over a resolved roll and nothing
// more.
//
// **Added, never multiplied.** `cubePoints.js` measured why and the finding governs this table too: a
// bonus that doesn't compound shrinks against a doubling multiple on its own, so a fixed price cannot
// run away from a rack built to farm it. Multiplied, one player specialising in one row would break
// the mode.
//
// **One price per proposition, at every level, and that is deliberate.** Hit rates roughly triple from
// Level 2 to Level 5 — so a flat price looks like it should favour betting late. It does not, because
// an added bonus at rung 2 is multiplied by three more levels (`1.94³ ≈ 7.3`) and the rate only
// improves by 1.1× to 4.8× over the same stretch. Measured, betting early is worth 1.5× to 6.5× more:
//
//     proposition            L2      L5    rate    ladder   early wins by
//     a cube gets copied    4.9%   23.4%   4.8×     7.3×       1.5×
//     a cube gets burned    9.1%   28.1%   3.1×     7.3×       2.4×
//     the line gets longer 31.3%   35.2%   1.1×     7.3×       6.5×
//
// So the interesting decision — bet early into a short line for a bonus that compounds, or late into a
// thick one for a bonus that barely does — falls out of the ladder rather than being tuned in, and the
// book needs no per-level column.
//
// **Level 1 is not in the table because nothing can happen on it.** One cube is no interactions at all:
// every proposition measures 0.0% there. The book opens from the rung that has a neighbour on it.
//
// `band` is what the three-card draw takes one of each from, `needs` is the face kinds a rack must be
// able to produce for the bet to be offered at all, and `price` is the L3 fair value with about 15%
// shaved off. See `scripts/cubeSideBet.js`, which is where all of these came from.
exports.SIDE_BETS = [
    // Likely — 17-23% on a rack that can do them at all.
    {
        id: 'broken', band: 'likely', price: 2, say: 'A cube shatters',
        needs: ['broken'], hit: r => r.notes.some(n => n.kind === 'broken'),
    },
    {
        id: 'invert', band: 'likely', price: 3, say: 'The line flips',
        needs: ['invert'], hit: r => r.notes.some(n => n.kind === 'invert'),
    },
    {
        // The Gambler reading itself: every paying face in that tree is sideless, so the tree that
        // sells this bet is the one that manufactures the thing it is betting on.
        //
        // **The widest `spoils` in the book, because the predicate has two halves and a face can leak
        // either.** A tie is a rung that survived *and* came out with no majority, so a look leaks it
        // twice over — and these three are the faces measured leaking enough to matter.
        //
        // `wild` is the survival half. The Wild Cube is 4 paying faces to 2 ending ones, the densest
        // ending cube in the game, so seeing one of its faces is the strongest available news that the
        // run did not stop: 19.0% to 26.4%, or +5.7% on a price shaved to lose 33%. The other five cubes
        // carrying an `end` face all stay negative — shortcut -29.5%, guide -29.7%, greed -36.4%,
        // reroll -33.3%, the Gungan's shield the nearest miss at -9.3%.
        //
        // `raze` and `cull` are the majority half, and they are the larger hole of the two: both take a
        // neighbour off the line, and a line with cubes removed from it is far likelier to come out
        // level. 41.4% and 32.1% against 19.0% blind, which is +65.8% and +28.5%. Nothing else that
        // shortens a line comes near — `purge` measures -69.7% because Order 66 ends the run instead.
        id: 'tie', band: 'likely', price: 7.1, say: 'Nobody wins the line',
        needs: null, spoils: ['wild', 'raze', 'cull'],
        hit: r => !r.ended && !!r.faceIds.length && !r.majority,
    },
    {
        id: 'burn', band: 'likely', price: 6.0, say: 'A cube gets burned',
        needs: ['burn'], hit: r => r.notes.some(n => n.kind === 'burn'),
    },
    // Middle — 12-17%.
    {
        id: 'mirror', band: 'middle', price: 4, say: 'A reflection lands',
        needs: ['mirror'], hit: r => r.notes.some(n => n.kind === 'mirror' && n.copied > 0),
    },
    {
        id: 'clone', band: 'middle', price: 7.7, say: 'A cube gets copied',
        needs: ['clone'], hit: r => r.notes.some(n => n.kind === 'clone'),
    },
    {
        // Three faces feed this and no rack without one of them can ever win it — 0.0% on a spread
        // against 46.8% on a rack holding the Symbiont or the Pit Droid. The widest gap in the table,
        // and the clearest argument for offering only what a rack can actually produce.
        //
        // ---------------------------------------------------------------------
        // **Narrowed from "the line gets longer" over three note kinds, and repriced.**
        // ---------------------------------------------------------------------
        //
        // Three separate mechanics fed one card — the Symbiont's Fode insert, its Padme twins, and the
        // Pit Droid's draw — so a rack holding two of those cubes hit it on nearly **half of all rungs**,
        // 52.9% at its peak across five farming racks. Against `price: 4` that measured **+0.71 an ante**,
        // the largest edge in the book, on the only card a player could deliberately farm.
        //
        // **The narrowing is a design call, not an arithmetic necessity**, and the first version of this
        // note wrongly claimed otherwise — it said no whole price could cover the broad predicate. That
        // was an artifact of the wrong fair-value formula (see `betAnte`): the broad card prices fine at
        // 2. Measured peaks, with the corrected `p*(price+ante) - ante*levelStep`:
        //
        //     predicate                    peak    priced at    EV there
        //     any of the three (was)       52.9%       2          -0.35
        //     Symbiont inserts only        40.3%       3          -0.33
        //     Pit Droid draw only          30.7%       5          -0.10
        //     matching twins only          26.2%       6          -0.11   <- shipped
        //
        // So the reason to take twins is that it is the better card. "The line gets longer" was three
        // different things wearing one name, and a player could not tell which of them they were betting
        // on; twins is a specific thing that visibly happens, which is what every other proposition in
        // this list already is. It also lands in the same rate band as the rest of the book, so it needs
        // no special pleading in the price.
        //
        // **The id stays `grow`.** A book is chalked up and stored per rung, so a live run may be holding
        // this id right now and renaming it would fail that player's bet validation in `nameBet`. The id
        // is a key, not a label — `say` is the label and it has changed.
        id: 'grow', band: 'middle', price: 9.5, say: 'Padmé slips in matching twins',
        needs: ['twins'],
        hit: r => r.notes.some(n => n.kind === 'twins'),
    },
    // Long shots — 4-7%.
    {
        id: 'raze', band: 'long', price: 19.9, say: 'Ben razes a neighbour',
        needs: ['raze'], hit: r => r.notes.some(n => n.kind === 'raze'),
    },
    {
        id: 'purge', band: 'long', price: 15, say: 'Order 66',
        needs: ['purge'], hit: r => r.notes.some(n => n.kind === 'purge'),
    },
    {
        // The Gungan's wipeout save. Rare because it needs two things at once — a shield standing, and
        // something fragile beside it coming apart — which is exactly the shape a long shot wants.
        //
        // **And the only card whose `spoils` is wider than its `needs`**, for the same reason: `needs`
        // is what a rack must own to produce the event, and a shield is the half you buy. The mine is
        // the half you wait for, so a look that shows one has settled half a 2.4% proposition without
        // touching anything in `needs` — measured at 8.2% after, which is +31% on a card priced to lose
        // 66%. Every other card is a single event and its two lists are the same. See `drawBook`.
        id: 'saved', band: 'long', price: 11, say: 'A cube holds together',
        needs: ['shield'], spoils: ['shield', 'broken'],
        hit: r => r.notes.some(n => n.kind === 'broken.saved'),
    },
    {
        id: 'engine', band: 'long', price: 23, say: 'Sebulba turns a cube',
        needs: ['engine'], hit: r => r.notes.some(n => n.kind === 'engine'),
    },
];

// **Two propositions measured out of the book rather than into it**, and they are worth keeping on the
// record because both are tempting.
//
// `scavenge` — something comes back — runs 0.1% at Level 3, which prices at +857. `pure` is stranger:
// it is the only event in the game that gets *rarer* as the line grows, 12.7% at Level 2 down to 0.2%
// at Level 5, because every effect face on the line disqualifies it. That is the same rule the Guide
// Cube's note is built on, and it makes a lovely cube and an unpriceable bet.

// ---------------------------------------------------------------------------
// The rack, as five trees
// ---------------------------------------------------------------------------
//
// Watto's rack used to be one flat list: every cube you did not own, plus three perks and the next
// press rung, all offered at once for one build token apiece. That list is still what a point
// buys — nothing here is new content and nothing has been priced differently. What it is missing is
// an **order**, and the order is what makes a point a decision instead of a shopping trip.
//
// **The dependencies were already written; they were just written in prose.** Half the notes in
// `SPECIALS` above say some version of "this is worth nothing without the rack it is for" — the
// Gungan Shield repairs a mine-heavy rack and barely moves Greed alone, Boost exists so the cubes
// that lengthen a line finally have something to be *for*, the tie picks are "worth exactly as much
// as the rack that causes them", the Scavenger is "worth exactly as much as the rest of the rack has
// failed". A flat menu sells all four of those first, where they do nothing. This table is those
// sentences made mechanical, and almost every edge in it can be traced back to one of them.
//
// **Five trees, and they do not touch.** No node in one tree ever requires a node in another. That
// costs something real — Guide wants a long line and Boost wants a full table, and neither tree
// contains the cubes that provide one — and it buys something worth more: the trees can be five tabs
// on a phone, each legible on its own, with no line crossing between them and no tab that cannot be
// walked without first walking another. The synergies did not go away; they moved from the unlock
// graph to the loadout, which is where a player already makes that decision every run.
//
// **Every tree is six nodes and four tiers deep.** Not for symmetry — it is what fell out of putting
// each cube where its own note says it belongs — but it means one layout renders all five, and a
// tier reads as "minimum picks to own this".
//
// `requires` is all-of. `requiresAny` is at-least-one-of, and exactly one node uses it: Shmi and
// Anakin are perfect mirrors of each other, so which of the two colours you lean is a choice with no
// wrong answer and no reason to make it twice.
//
// `pressTier` is a floor on `s.pressTier` rather than an entry in `requires`, because the press is
// four nodes sharing one reward value — see `weldTiers` below, and `rewardChoices` in `state.js`,
// which offers the rungs strictly in order off that counter.
exports.TREES = [
    { id: 'swindler', name: 'The Swindler', blurb: 'Make your colour land.' },
    { id: 'gambler', name: 'The Gambler', blurb: 'Make it pay.' },
    { id: 'dealer', name: 'The Dealer', blurb: 'Decide what is standing on the line.' },
    { id: 'junker', name: 'The Junker', blurb: 'Lose less of it.' },
    // **The one tree that is not open from the start**, and the condition is the seat count rather
    // than a number chosen to feel right: `opens: 'overflow'` is `cubes > bagSize()`, so the press
    // appears on the first cube you own that you cannot field. Before that it answers a question
    // nobody has asked yet; after it, it is the only answer there is.
    { id: 'forger', name: 'The Forger', blurb: 'Two cubes, one seat.', opens: 'overflow' },
];

exports.TREE = {
    // THE SWINDLER — the call. Bias it, then guarantee it, then force it, then get paid for it.
    'cube:shmi': { tree: 'swindler', tier: 1 },
    'cube:anakin': { tree: 'swindler', tier: 1 },
    'cube:wild': { tree: 'swindler', tier: 2, requiresAny: ['cube:shmi', 'cube:anakin'] },
    'cube:sebulba': { tree: 'swindler', tier: 3, requires: ['cube:wild'] },
    // **Off the Wild rather than off Sebulba**, which is the one edge in this table that contradicts
    // the obvious reading. Guide counts outward until it hits a position that is not a cube on the
    // called side, and *"every other position stops it, effect faces included"* — so Sebulba's engine
    // face breaks the run at its own square, and the Wild, which is always the side you called,
    // extends it every time. Chaining Guide behind Sebulba would have charged a prestige for its
    // worst neighbour on the way to it.
    'cube:guide': { tree: 'swindler', tier: 3, requires: ['cube:wild'] },
    // Throws the next rung early and shows one face off it, once a run, before the side is named.
    // It is this tree's armour rather than its payout: The Swindler carries two mine-carriers — the
    // Wild and Guide — and no shield, so knowing when to walk away is the whole of what answers them.
    premonition: { tree: 'swindler', tier: 4, requires: ['cube:sebulba'] },

    // THE GAMBLER — every paying face in this tree is sideless, so it is also the tree that
    // manufactures the most ties in the game. That is why a tie pick lives in it.
    'cube:greed': { tree: 'gambler', tier: 1 },
    'cube:multiplier': { tree: 'gambler', tier: 2, requires: ['cube:greed'] },
    // The Midi-chlorian only pays *"if red/blue wins the line"*, and a tie is precisely the case
    // where nobody won — so the cube above this one is the exact failure mode it repairs. Watto says
    // as much on a bribe: "then it's a win. Whatever you say it is."
    bribe: { tree: 'gambler', tier: 3, requires: ['cube:multiplier'] },
    'cube:turbine': { tree: 'gambler', tier: 3, requires: ['cube:multiplier'] },
    'cube:boost': { tree: 'gambler', tier: 4, requires: ['cube:turbine'] },
    // Watto's book, three cards a rung. The only one of the five capstones that pays money rather than
    // touching the line — Swindler looks, Dealer moves, Junker removes, and this one prices — which is
    // what keeps each tree's verb its own. See `SIDE_BETS`.
    sidebet: { tree: 'gambler', tier: 4, requires: ['cube:turbine'] },
    // **Double or Nothing belongs here and is not sold yet**, because no charge for it is a decision.
    //
    // The intent was the terminal fork's cheap half — Boost costs a seat out of `bagSize()` and a perk
    // does not — with the perk doubling the increment on one rung a climb. Priced at a flat stake that
    // is not a choice at any rung and is a faucet at the top:
    //
    //     rung        hold     push      doubled    gain at 50%, per stake of fee
    //     L1          1.94     3.76       5.59      +0.85
    //     L3          7.30    14.16      21.03      +3.21
    //     L5         27.48    53.31      79.14     +12.09
    //
    // A fee that scales with the standing instead makes it a coin flip that clears no rung, and a
    // *fair* one of those is the exact arbitrage `levelStep` shaves 3% off every push to prevent —
    // so it has to pay below fair, at which point nobody takes it. The shape that works is a real
    // balance question and the node stays off the rack until it has an answer. The profile flag,
    // `FLAGS` and `PERKS` entries in `state.js` are already in place: this is one line when it does.
    // double: { tree: 'gambler', tier: 4, requires: ['cube:turbine'] },

    // THE DEALER — what is standing on the line. The spine is an escalation of reach: one neighbour,
    // then everything behind you, then both neighbours plus insertions, then the whole bag.
    'cube:binder': { tree: 'dealer', tier: 1 },
    'cube:mirror': { tree: 'dealer', tier: 2, requires: ['cube:binder'] },
    // Binder is the first cube in the tree that changes the *count* — a burn takes a position out of
    // it — and changing the count is what flips parity into a line with no majority. So the free
    // permanent lean is live the moment it is offered, and putting it here is also what stops this
    // tab opening with three picks in a straight line.
    nudge: { tree: 'dealer', tier: 2, requires: ['cube:binder'] },
    'cube:symbiont': { tree: 'dealer', tier: 3, requires: ['cube:mirror'] },
    // Two positions on the thrown line, exchanged before a single effect fires. Ten faces in this game
    // care intensely about where they landed — burn right, clone left, engines point, Ben eats both
    // neighbours — and until now the player had no say in any of it. This is the tree that lives on
    // position, so this is the tree that gets to touch it.
    shuffle: { tree: 'dealer', tier: 3, requires: ['cube:mirror'] },
    'cube:pitdroid': { tree: 'dealer', tier: 4, requires: ['cube:symbiont'] },

    // THE JUNKER — two mine-carriers, then the cube that answers mines, then the cube that recovers
    // what died anyway. The only tree that hands you its own problem before it sells you the fix.
    'cube:shortcut': { tree: 'junker', tier: 1 },
    'cube:reroll': { tree: 'junker', tier: 2, requires: ['cube:shortcut'] },
    // `reroll` the perk under `cube:reroll` the cube, and the order is the scarcity curve rather
    // than the flavour: the cube costs a seat and carries Ratts, which is cheap when you own four
    // cubes and have eight seats; the perk costs truguts, which you do not have yet. Early answer
    // first, late answer second.
    reroll: { tree: 'junker', tier: 3, requires: ['cube:reroll'] },
    // The Shield stops mines **and** saves wipeouts, and the note above names the cubes it covers —
    // the Reroll Cube among them. Its parent's entire downside is one mine and two wipeouts, so the
    // child here is the complete answer to the node directly under it.
    'cube:gungan': { tree: 'junker', tier: 3, requires: ['cube:reroll'] },
    'cube:scavenger': { tree: 'junker', tier: 4, requires: ['cube:gungan'] },
    // **Replaces Salvage Rights**, which worked and was the wrong shape: passive, untimed, certain and
    // indifferent to what you owned — a ledger adjustment sitting where the other four trees put a
    // move. This is the Junker's verb. Swindler looks, Dealer moves, Gambler prices, and this one
    // scraps: one cube off the line, before anything it was going to do happens.
    //
    // **What it actually does is move the count by one**, and that is the whole of the mechanic.
    //
    // Pulling a mine is the obvious use and it is nearly free: Ratts is an effect face, so he counts
    // toward neither side and taking him off leaves the tally exactly where it was. The interesting
    // use is the other one — a line reading 2 blue to 3 red on a blue call is a loss, and scrapping a
    // red makes it 2–2, which is a tie, which is Watto's cube and a real chance. One cube converts a
    // certain loss into a coin flip, or a tie into a win.
    //
    // So the risk is not parity, it is **spending it on a line that was going to be fine** — once a
    // run, on a table you have to read correctly before the effects fire.
    //
    // It is also the aimed version of what the Gungan Shield does blind, which is why it sits above it.
    scrap: { tree: 'junker', tier: 4, requires: ['cube:gungan'] },

    // THE FORGER — the press ladder, plus the two things it does not currently sell. `press` is one
    // reward value bought four times, so it has no `tier` of its own: the rung is `s.pressTier + 1`
    // and the client lays the four out at tiers 1–4.
    press: { tree: 'forger', ladder: 'weldTiers' },
    // Names one face that must survive the cut. It is the only node in this tab that acts on *every*
    // press rather than changing what is in the draw, which is why it forks off the first rung —
    // and it has to, because The Heavy Half has nothing to name until an uneven cut exists.
    //
    // Worth knowing which way it scales: it guarantees a face that a 3-face share would have found
    // half the time and a 1-face share one time in six, so it is worth **more** the further up the
    // ladder you are, not less. That makes it the tab's balance risk rather than its safe pick.
    keeper: { tree: 'forger', tier: 2, pressTier: 1 },
    // **The tab's verb, and it was the one tree that had none.** The note on `scrap` names the other
    // four — Swindler looks, Dealer moves, Gambler prices, Junker scraps — and every node in here
    // before this one acts on the press instead, between runs, on a screen with no cubes on it.
    //
    // Once a run, on a held line, one welded position comes apart into the cubes it was pressed from,
    // thrown live, in place. They stay apart for the rest of the climb and the weld is whole again the
    // moment the run ends: nothing here writes to the profile.
    //
    // **What prices it needs no dial.** The parents come back whole, downside faces included, so a
    // split hands back exactly what `weldPurity` charges 📀21.5T a reroll to remove — and hands it back
    // for every rung left rather than for this one. The odds are the parents' own face lists, already
    // measured; the trade is entirely which cubes the player chose to press together, which is why a
    // weld of two mineless cubes splits for free and a weld of two payers barely splits at all.
    //
    // It is Scrap read backwards — one position off the line, against one seat becoming two cubes on
    // it — and it is the only thing in the mode that fields more cubes than `bagSize()` holds.
    //
    // **`pressTier: 3` because The Third Cube is where a split stops being a coin and starts being a
    // swing**: two parents is one extra position, three is two. It also puts this tree's verb at the
    // depth the other four put theirs.
    //
    // Replaces **The Heavy Half**, which was passive and untimed — the same charge `scrap` records
    // against Salvage Rights — and which had never run: nothing passed `major` to `rollWeld`. That
    // choice is not lost, it is folded into Deep Cuts, the rung that already sells the cut it decides.
    split: { tree: 'forger', tier: 4, pressTier: 3 },
};

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
    // **`dayLean` used to live here and it is gone on purpose.** Watto leaned on the cube: one side
    // quietly favoured every day, 0.52 at the end and 0.55 before that. It read as flavour and
    // measured as a **money printer worth +0.37 EV to the player** — the argument is kept at
    // `rollSide` in `engine.js`, because the reason is a property of the ladder rather than of the
    // number, and anything put here in its place would inherit it.
    //
    // The short version: majority-of-N amplifies a per-cube bias with depth, so a leaned cube
    // mispriced every rung by a different amount; and by convexity any p ≠ 0.5 mints truguts in
    // either direction whether or not the player ever works out the day's side. A fair coin is the
    // only value that lets one `levelStep` price the whole road, which is what makes a house edge
    // expressible at all.
    //
    // What is left of that measurement and still true: a bare ladder at a fair coin measured **1.24**,
    // and a hand-picked rack **2.15**. Neither is the lean's doing. The first is `pureBonus` and the
    // pay table; the second is the rack, whose cubes were each measured alone when they were built
    // and never as a chosen eight together. `cubeLean.js` prints both on purpose.
    //
    // **The second half of that has since been chased down and the number is stale.** A rack chosen
    // to win rather than to read well measured **4.10**, not 2.15, and it was two cubes: the Wild,
    // whose guaranteed vote is majority-of-N amplification with the player holding the dial, and the
    // Gungan Shield, which deleted the mine that every other paying cube is priced by. Both have been
    // re-cut — see their own notes — and the same rack now measures **1.82**. The bare ladder is
    // untouched at 1.12, which is the point: the leak was never in the pay table, so nothing in the
    // pay table moved to close it.
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
    // So `clearsToUnlock: 1` reproduces the shipped curve rung for rung — 62 runs a cycle at
    // prestige 0, 92 from prestige 2, 122 from 4, 153 from 6 — and `maxClears: 5` carries it one
    // gap past anything the old ladder ever charged: 181 from prestige 8, and never more. Every
    // pacing decision in the design doc survives; only the number they are written against moved.
    // **How far a mine's blast reaches, in positions either side of it.**
    //
    // It was effectively infinite — an unshielded blast took the whole row, which is why a mine cost the
    // *run* rather than some cubes. That is the most consequential number in the mode and it was never a
    // number at all. See the note at `case 'end'` in `engine.js` for the measurement: an unbounded mine
    // demands a cube that doubles the run, only the Wild was in that class, and every other carrier
    // measured below an empty seat. Bounding it is what lets a mine be common enough for the mine-facing
    // picks — the Gungan Shield, Scrap, Swap, Premonition — to have anything to act on.
    //
    // **2, and the reason is the survivability curve rather than the EV.** At reach 1 the geometry is
    // almost toothless, and worse, it makes Ratts a *raze that dies* — Ben already takes both neighbours,
    // so the two faces collide. Exact survivors by line length and mine position:
    //
    //     line   reach 1                    wiped    reach 2                    wiped
    //       3    [1 0 1]                     33%     [0 0 0]                    100%
    //       5    [3 2 2 2 3]                  0%     [2 1 0 1 2]                 20%
    //       7    [5 4 4 4 4 4 5]              0%     [4 3 2 2 2 3 4]              0%
    //       9    [7 6 6 6 6 6 6 6 7]          0%     [6 5 4 4 4 4 4 5 6]          0%
    //
    // So a three-cube line is certain death, a five survives unless he lands dead centre, and a seven or
    // a nine always leaves something standing — with *how much* depending on where he fell. That is the
    // shape worth having: the mine keeps its menace on a short table, the table itself is the defence on
    // a long one, and position matters at every length instead of none. Reach 1 gave a flat 0% above
    // three cubes, which is no curve at all.
    //
    // It also keeps him distinct from the raze at five positions against three, and it prices closer:
    // the Wild measures 1.54 in a seat at reach 2 against 1.70 at reach 1.
    blastReach: 2,
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
    // Five, which the table above prices at **181 runs a cycle** on an empty rack and about 82 with
    // a Shortcut on it — the steady state from prestige 8 onward, and one a player can sit in. It
    // binds nowhere before that, so it costs the climb the mode is actually designed around nothing
    // at all: the cap is for the endgame past the rack, not for the road up to it.
    //
    // This **used to be a drawing limit wearing a rule's clothes.** The old meter drew one custom
    // emoji per clear needed, and twelve of those wrap on a phone. The route map replaced it and
    // draws the Agains as plain tiles, so the twenty a five-Again road carries still hold one line
    // at full size on a 375px phone — measured, in `.route` in the Activity's stylesheet, which is
    // where raising this number has to be checked. What is left here is pacing.
    maxClears: 5,
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
    // How much of a screen a very long row can eat is handled where it belongs, at the point of
    // drawing. Set a number here to put the cap back.
    maxCubes: Infinity,
    // **And no ceiling in time either, so this is the one that catches it.**
    //
    // Copies act — a reflected Mirror reflects, a cloned Binder clones — so a rack carrying two of
    // them draws lines that feed themselves and a throw that never finishes resolving. There is no
    // rule that ends it, deliberately: see the queue in `resolveLine`. This is the budget instead.
    // Past this many cubes handed a turn, the roll is abandoned where it stands and the run dies of a
    // **memory overflow**.
    //
    // Which is not an apology for a limit, it is the ending. The game this mode is named after does
    // exactly this — pile enough onto a track and Racer falls over — and a player who builds the rack
    // that does it has found something rather than hit something. It should stay findable: rare
    // enough that most players never see it, cheap enough at 100 that the reveal is still watchable
    // when they do.
    overflowAt: 100,
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
    // 0.55, because the pick has to stay obviously worth a build token — going from losing 60% of
    // ties to winning 55% is a 15-point swing and reads as a real prize — while it gives up a third of
    // the old reversal's fork, which is the most that can be bought without gutting the pick.
    //
    // A tie is still always a coin flip that somebody owns; the two owners just no longer hold the
    // same weight.
    // **0.500 — the Nudge makes Watto's cube fair, it does not turn it around.** `tieLean` stays 0.60
    // against you; this hands back exactly that lean and no more, which is the whole of the pick in one
    // sentence a player can hold in their head.
    //
    // It was 0.55, and the 5 points it gave back on top of fair were never doing design work — they were
    // the reason every dial in this file had to be read twice, once for the population holding the pick
    // and once for the population without it. Measured on a best-of-breed seven, the pick is worth
    // **+15.4% at 0.500** against +20.1% at 0.55: the fork narrows and does not close, which is the
    // known cost of the pick existing at all.
    //
    // **A consumable was considered and measured and it does not work.** One charge a run captures
    // **79%** of the permanent pick's value, and that ratio held at every lean tried (75–80%) — because
    // ties are only **0.20 a run** and just **17.3%** of runs meet even one, so the natural usage rate
    // is already about one and capping it caps nothing. Guaranteeing a single tie instead of leaning it
    // measured **+63.5%**, three times the permanent pick: a tie is a coin flip you lose 60% of, it lands
    // deep where the standing is largest, and losing it is a full bust, so removing the randomness is
    // worth far more than removing the repeats. The charge-count axis is dead; the lean is the only live
    // dial, and 0.500 is the one value on it with a sentence attached.
    nudgeLean: 0.50,
    // Buying a tie off him instead, once the rack has handed that over. Priced as a share of
    // the standing it buys, because a tie at the top of the ladder is worth thirty-two times one
    // at the bottom and a flat price would be free money up there. Every bribe already paid makes
    // the next dearer, and the count resets at prestige so the option can never price itself out for
    // good. **The offer itself is never withdrawn** — the price climbs past what the tie pays and he
    // goes on asking, because a lost tie is a bust and what that is worth avoiding is the player's
    // sum to do. See `asking` in actions.js.
    //
    // **The share is derived from the lean, not typed, and that is the whole of the fix here.** It was
    // a flat `bribeShare: 0.25` against a tie you lose 45% of the time nudged and 60% un-nudged, so
    // the first bribe bought a 45–60% risk of losing the entire standing for a quarter of it. That is
    // free money by subtraction, at every level, on every rack, for every player — and because
    // `bribes` resets at prestige it came back every prestige. A live account reached prestige 26 and
    // 📀2.8T on it, with `bribe (7 paid)` still on the clock:
    //
    //     bribe #   old share   P(lose the tie), nudged   verdict
    //     1           25.0%              45.0%            free money
    //     2           37.5%              45.0%            free money
    //     3           56.3%              45.0%            priced
    //
    // Measured on a tie-heavy rack at 2.39% of purse, buying exactly the two underpriced bribes and
    // then prestiging to refill them took an evening from 20.5× to 33.3×. Buying *every* tie bled,
    // which is why it never showed up as a bad-policy leak: the exploit was to stop at two.
    //
    // A typed share cannot be right for both populations at once — the un-nudged player loses 60% of
    // ties and the nudged one 45%, so any single number is a subsidy to one of them. So the floor is
    // `P(lose the tie)`, read off whichever lean actually applies, and `bribeEdge` is what the house
    // keeps on top. See `bribeCostFor` in state.js, which is where the two are put together.
    //
    // **Fair on the standing is still a good deal, and that is deliberate.** Winning a tie does not
    // just pay the standing, it keeps the climb alive to push again — so at exactly `P(lose)` the
    // bribe still carries the whole option value of the rest of the run for nothing. The mechanic
    // stays worth taking off the rack; it just stops being worth taking *twice and prestiging*.
    bribeEdge: 0.03,
    bribeStep: 1.5,
    // What a rung does to the run's multiple. **A level multiplies it; an Again adds.**
    //
    // That split is the whole economy of the route, and it is the only shape that does all three
    // jobs at once:
    //
    // - **The ladder carries the house edge, and this number is the whole of it.** A rung is a coin
    //   flip, so the fair price of a push is exactly 2.000. It pays `LEVEL_STEP` instead, which
    //   keeps **3% of every push** — and because a fair cube makes the majority of any odd number of
    //   cubes exactly 0.500, that 3% is the same at all five rungs. One number prices the whole
    //   road, no rung is looser than any other, and there is nothing to farm. See `rollSide`.
    //
    //   This reverses what §3 of the design doc was built on. The ladder used to be a clean double —
    //   marginal EV exactly 1.000, with the entire edge in the Agains — and measurement is what
    //   overturned it: at a fair cube and a clean double, an **empty rack still returned 1.31 and a
    //   hand-picked eight 2.09**. A mode whose ladder is exactly fair and whose cubes are better
    //   than fair is a faucet, and the ladder is the only surface every player touches every roll.
    //
    //   3% is the crash/mines number rather than a guess: that genre prices a cash-out ladder at
    //   96–99% RTP a step, and the shave belongs in the pay table where it is invisible. Over a
    //   five-rung climb it compounds to **86% RTP**, which is a real edge without being a wall.
    //   Steeper was measured and rejected — 1.90 keeps 23% of a full climb, which is keno.
    // - **The Agains still compound.** Because the levels multiply, a +1 banked in gap 1 is
    //   multiplied by L2, L3, L4 and L5 — worth **14×** what it added at this step. One banked in
    //   gap 4 is worth 1.94×. So every Again you bank takes its compounded value off the route's
    //   peak *forever*, and the biggest number in the game exists only on a fresh prestige, which is
    //   the whole reason to try to sweep a gap in one run instead of chipping at it.
    // - **The tail stays bounded** without a house limit or any other new furniture, because the
    //   peak is linear in the padding rather than exponential in the depth.
    //
    // Past Level 5 every rung is an Again, so a push there buys +1 against a base of 27 or more:
    // marginal EV ~0.52, asymptotically 0.5. That is deliberately a bad deal rather than a wall.
    // The player can always keep rolling; the game just stops pretending it is a good idea.
    levelStep: LEVEL_STEP,
    againBonus: 1,

    // ---------------------------------------------------------------------------
    // What Watto sells you mid-run, and why it is paid for in multiple
    // ---------------------------------------------------------------------------
    //
    // Every pick that touches a live line — Premonition, the side bet, Swap, Scrap, Split — used to
    // be **free and once a run**, and that pair of properties is what made the mode a faucet. Measured
    // on a maxed rack banking at Level 3, the ladder prices correctly at **0.83** with none of them and
    // ran at **2.29** with Scrap and Swap in hand. Neither cube nor pay table was the leak: an empty
    // rack with the same picks measured *stronger* than a chosen eight.
    //
    // **The leak was information, not power.** `alterShown` fires on a line whose every face is already
    // showing, so the pick is aimed at a known answer — and the commonest thing it is aimed at is the
    // mine about to end the run. A line loses by exactly one about a third of the time, and the rack's
    // wipeouts are on the table in plain sight. Four repairs were measured and all four failed:
    //
    //     scrapped line's tie goes to Watto        L3 2.21
    //     nudgeLean 0.50 / 0.45 / 0.40             L3 2.21 / 2.27 / 2.13
    //     Scrap may only take a cube that counts   L3 2.05
    //     an edit re-throws the rest of the line   L3 2.15
    //     levelStep down to 1.75                   L3 1.02, and 1.75 is keno
    //
    // **A price paid on use cannot work either, and the reason is the one that took the Pure Cube pot
    // out of this file.** The pick is spent precisely when the run is about to die, so its value is the
    // whole standing rescued from zero — and any price denominated in the run is a fraction of the very
    // thing being rescued. Price and prize scale together and the ratio never moves. Measured: a toll on
    // use needs **90%** before the mode is a sink, and the player still pays it on 37% of rungs. Sealing
    // the ladder on use measured 2.14. There is no number in there.
    //
    // **So the price is paid before the reveal.** A pick is *armed* for the rung ahead, out of the
    // multiple, before the cubes land — which prices the **option** rather than the rescue. The player
    // is buying against a ~45% chance of needing it, wastes the premium more than half the time, and
    // that is what finally makes the ratio move. 40% before the throw does what 90% after it could not:
    //
    //     armShare   L1     L2     L3     L4     L5     armed   used
    //     free      0.99   1.52   2.38   4.32   7.01      —      23%     ← what shipped
    //     0.30      0.98   0.82   0.91   0.88   1.10     21%     10%
    //     0.35      0.99   0.81   0.88   0.85   0.94     20%      9%     ← shipped
    //     0.40      0.98   0.80   0.78   0.73   0.74     19%      9%
    //     none      0.94   0.96   0.79   0.76   0.60      —       —
    //
    // **0.35 rather than 0.40, and the reason is the bottom row.** These are meant to be endgame picks
    // worth having, not a tax with an animation — and against "never owned" a rack at 0.40 measures
    // 0.78 against 0.79 at L3 and 0.74 against 0.60 at L5, which is a pick you buy out of habit. At 0.35
    // it is 0.88 against 0.79 and 0.94 against 0.60: clearly worth owning at every depth, still a sink
    // at every stopping level, and still armed on only about one rung in five.
    //
    // **0.30 was measured and it breaks.** L5 comes back 1.10 — marginal, and marginal is exactly what
    // this whole initiative is about: the mode did not go to hundreds of billions on a big edge, it went
    // there on a small one compounded a few thousand times at a stake pinned to the ceiling. The band
    // between "worth owning" and "prints" is one notch of this dial wide, which is what the whole-number
    // rounding costs and is worth knowing before anyone nudges it again.
    // =====================================================================
    // HOW TO PRICE A PERK
    // =====================================================================
    //
    // Three of these were shipped as dead picks and none of them was a weak design. Every one was a
    // pricing or measurement mistake, and they were the same three mistakes each time. Read this before
    // touching `armShare`, `armShares`, `lookShare` or `betAnte`.
    //
    // ---------------------------------------------------------------------
    // 1. Price the shape to the perk's LEVEL PROFILE, not by default.
    // ---------------------------------------------------------------------
    //
    // There are two shapes available and they push a player in opposite directions.
    //
    //   - **A share of the standing** charges a constant *fraction*. The multiple roughly doubles every
    //     level, so a flat share makes the shallow rungs the best buy: it pushes purchases EARLY.
    //   - **A price locked to the level** charges a constant *amount*. As a fraction of a growing
    //     standing that shrinks with depth, so it pushes purchases LATE.
    //
    // Which is right depends on where the perk is actually worth something. Measured free, allowed at
    // exactly one level, on the rack a greedy build picks (dg x1e-4):
    //
    //     level  cubes   Scrap    Swap    Premonition
    //     L2       3     +28.98   -0.96     +27.24
    //     L3       5     +20.59   +6.99     +18.21
    //     L4       7     +21.73  +13.38     +14.57
    //     L5       9     +19.26   +4.48     +15.34
    //
    // Three perks, three different curves. **Premonition declines** — one face out of nine is thin
    // evidence about a majority, and on a mineless rack it is worth -0.59 by L5. **Swap peaks at L4** —
    // it needs room to reposition and a three-cube line has nowhere useful to move anything. **Scrap is
    // roughly flat** — there is always something worth taking off.
    //
    // So Premonition wants a share (buy early, where the information is thick) and Swap is the one
    // candidate for a locked price. Measured head to head on Premonition, share beat locked **+6.21
    // against +1.61**. Swap is left on a share only because at 0.05 it is already affordable everywhere,
    // and a second pricing shape for one perk is a rule that does not earn itself.
    //
    // **The failure mode to remember**: a price that does not scale with the standing is cheapest at the
    // deep rungs. `lookCost 1` was 52% of an opening standing and 3.6% of a Level 5 one, so it sold the
    // look most cheaply exactly where the look is worth least. That is what made Premonition read as a
    // dead pick for as long as it did.
    //
    // ---------------------------------------------------------------------
    // 2. A perk is worth what GOOD PLAY extracts from it.
    // ---------------------------------------------------------------------
    //
    // Scrap was priced at `armShare 0.13` against a policy that removed a mine or an opposing vote and
    // nothing else. It measured a slight edge. Re-measured at the *same price* against a policy playing
    // the real priorities — fix the count first, survive when the blast would clear the table, then
    // protect the payers — it measured **+48**. A weak policy under-prices a perk by however much it
    // fails to play it.
    //
    // Worse, the mistake is not always a policy detail. Premonition measured negative at every price
    // including free, because it was modelled as buying bank-or-push. It does not: `exports.premonition`
    // calls `pushRun({ call: null })`, so the look lands *before a side is named* and what it buys is
    // which side to call. Modelled correctly, one free look is worth **+96**. Check what a perk actually
    // decides before pricing what it costs.
    //
    // ---------------------------------------------------------------------
    // 3. Rank on log-growth. EV cannot rank these.
    // ---------------------------------------------------------------------
    //
    // The ladder's EV is dominated by rare deep wins, so at 400k climbs a cell one repeat in three comes
    // back tens of points away from its neighbours and the ordering is noise. Every figure above is
    // paired log-growth, which damps the tail and ranks reliably. If a sweep comes out non-monotonic,
    // that is the tell — re-run it on `g` before believing it.
    //
    // =====================================================================

    // **The fallback share, for any arm `armShares` does not name.** Today that is Split alone.
    //
    // It only became a meaningful number when prices went to tenths. The note that stood here swept
    // 0.40 / 0.35 / 0.30 and concluded the band between "worth owning" and "prints" was one notch wide.
    // It was not: at whole-mult rounding the **floor** set the price, not this dial. `armFloor 1` charged
    // 52% of an opening standing however low the share went, and an arm is bought blind before the
    // throw, so Scrap, Swap and Split measured dead at every value of it.
    //
    // **0.21, and an earlier pass set it to 0.13 — see point 2 above for why that was wrong.** 0.13 was
    // measured against a policy that scrapped a mine or an opposing vote and nothing else, and read as a
    // slight edge; against a policy playing the real priorities the same 0.13 measured +48. Re-swept on
    // log-growth (dg x1e-4, best / shield racks):
    //
    //     armShare    scrap
    //     0.22       +3.3   -1.0
    //     0.21       +8.0   +2.2      <- shipped
    //     0.18      +26.8  +11.6
    //     0.14      +45.0  +29.0
    //     0.12      +62.3  +45.8
    //
    // The curve is steep — a hundredth of this dial is worth several points of growth — so it wants
    // re-measuring rather than nudging, and re-measuring against a policy that plays the perk properly.
    armShare: 0.21,
    // **Per-arm shares, because the three picks are not the same size.** See `armPriceOf`. Scrap takes a
    // problem off the line; Swap can only relocate one, and measured about four times weaker for it.
    // Split is unlisted and falls back to `armShare` — it needs a weld on the line to do anything, which
    // this harness does not model, so pricing it would be a guess dressed as a measurement.
    //
    // A caution worth leaving here: **these numbers are only as good as the policy they were measured
    // against.** An earlier pass priced Scrap at 0.13 using a policy that scrapped a mine or an opposing
    // vote and nothing else, and it measured a slight edge. Re-measured against a policy that plays the
    // real priorities — fix the count, then survive, then protect the payers — the *same* 0.13 measured
    // **+48**. A perk is worth what good play extracts from it, so a weak policy under-prices it.
    armShares: { scrap: 0.21, swap: 0.05 },
    // **Never free, whatever the rounding says.** Still the point of this, but it is a tenth now rather
    // than a whole mult — see `armPriceOf`. At 1 it was the binding term in the arms' price rather than a
    // safety net: the cheapest possible option cost 52% of an opening standing, on a purchase made blind
    // before the throw, which is why Scrap, Swap and Split all measured as dead picks. A floor exists to
    // stop a price rounding away to free, and 0.1 does that without setting the price itself.
    armFloor: 0.1,
    // **An arm is for one rung and expires unspent, and that is load-bearing rather than tidy.**
    //
    // Letting it carry until used is the same exploit wearing a different hat: one payment then covers
    // every remaining rung, so the pick is bought at rung 2 — where 40% of 1.94 rounds to **1** — and
    // exercised at rung 5, where it rescues a standing of 27. Buying early does cost more in final
    // terms (7.30 against 6.00, because the deduction compounds through every rung after it), but that
    // 22% premium does not touch a 3.6× coverage advantage.
    //
    // **And whole numbers remove the room to price around it.** Rounding pins the shallow rungs:
    //
    //     rate     price at rungs 2-5      carrying, measured L1-L5
    //     40%      1 / 2 / 3 / 6           1.00 0.76 0.85 1.01 1.22   faucet
    //     60%      1 / 2 / 4 / 8           0.96 0.80 0.84 0.95 1.04   borderline
    //     80%      2 / 3 / 6 / 11          0.96 0.97 0.82 0.71 0.67   armed on 2% of rungs
    //
    // 40% and 60% charge the *same* 1 mult at the rung a carrying player buys on, and by the time the
    // rate reaches the shallow price the pick is dead. There is no working number, so there is no carry.
    armExpires: true,
    // **The look, at a flat price rather than a share.** Premonition's value is roughly constant — one
    // face, and the right to walk — where Scrap's scales with what is standing. So a flat 1 is 52% of an
    // opening standing and 3.7% of an overtime one, which self-selects the look toward the deep rungs
    // where the walk-away is worth having. Free and played well it measured a small faucet (L2 1.04
    // against 0.84 for not owning it), so it does want a price; every level measures a sink at 1.
    // **`lookShare` supersedes this, and the story is worth keeping because the mistake was mine to
    // make twice.**
    //
    // Premonition measured as a dead pick at every price I tried — negative even when free — and the
    // reason was the model, not the dial. `exports.premonition` calls `pushRun({ call: null })`: the look
    // parks the roll **before a side is named**, so what it buys is *which side to call*. It had been
    // modelled as buying bank-or-push only, which at `blastReach 2` is worth almost nothing because runs
    // rarely end. Modelled correctly, one free look is worth **+96** (dg x1e-4) on the best rack.
    //
    // So the pick was never weak, it was priced flat: `lookCost 1` is 52% of an opening standing and 3.6%
    // of a Level 5 one. As a share it charges the same fraction everywhere. One look, swept:
    //
    //     lookShare   best   shield  mineless  mine-heavy
    //     0.14       +15.01   -1.79    +0.30     +0.20
    //     0.16        +9.84   +0.41    +0.67     -0.11
    //     0.17        +4.36   -0.35    +1.18     -0.33     <- shipped
    //     0.20        -4.54   -2.80    -4.10     +0.06
    //
    // **A second look is never worth buying** and that was measured rather than assumed: at every
    // per-look price, k=1 beat k=2 and k=3 (at 0.07 a look: +54.96 against +21.52 and +19.67). Information
    // has diminishing returns and a flat marginal price does not, so the first look is always the best
    // buy. A single charge for several reveals does work — 3 reveals at 0.25 measured +5.77/+5.17 — but it
    // is a second pricing shape for no gain over one look priced properly.
    lookShare: 0.17,
    lookCost: 1,
    // **The side bet's missing half.** `scripts/cubeSideBet.js` derives every price in `SIDE_BETS` as
    // `1/p - 1` — the fair return on a **one-unit wager** — and nothing ever staked the unit, so each
    // card was a free option worth `price x p` on top of the rung. This is that unit. Whole, flat, and
    // in the same currency as everything else on this list.
    //
    // **It is a stake, so it comes back when the card lands.** `price` is *net* odds — profit with the
    // stake already excluded — which makes a card a bet in two halves: this off the standing when it is
    // named, and `price + betAnte` back if the proposition happens. `betPaid` pays the gross for exactly
    // this reason; taking the ante and then paying only `price` charges the stake twice and costs the
    // player a further `p` a card on top of the ~15% the prices already shave. See `betPaid`.
    //
    // ---------------------------------------------------------------------
    // **The two halves do not touch the multiple at the same time, and every price above was
    // derived as though they did.**
    // ---------------------------------------------------------------------
    //
    // The ante comes off `live.mult` in `nameBet`, which happens *before* the rung resolves — so
    // `rungMultiple`'s `carried * levelStep` multiplies the reduced figure and the ante really costs
    // `betAnte * levelStep`. The payout arrives in `added`, which `rungMultiple` applies *after* the
    // multiplication, so it is worth exactly `price + betAnte`. A level rung therefore charges
    // `levelStep` for every unit it pays flat, and the true break-even is
    //
    //     p = betAnte * levelStep / (price + betAnte)
    //
    // — at `levelStep 1.94`, nearly **twice** the rate `1/p - 1` asks for. Verified against the engine
    // rather than argued: betting one prop at a fixed rung and differencing the resulting multiple
    // reproduces this to three decimals across four props and two levels, where the naive formula is
    // out by `betAnte * (levelStep - 1)` every single time.
    //
    // Every `price` in `SIDE_BETS` has been re-derived from it. The correction went in both directions,
    // which is why it was worth doing rather than shaving everything: `saved` and `broken` were **faucets**
    // (+0.54 and +0.47 an ante at their peak farmable rates) and seven cards were **over-shaved**, `tie`
    // and `grow` worst at -0.93 and -0.89 — a house edge nobody chose either.
    //
    // (An **Again** adds rather than multiplying, so the naive formula is right there. The collapsed road
    // is all levels, which is the case a price has to survive.)
    betAnte: 1,
    // **Prices are tenths now, and it is what made the book priceable at all.** See `armPriceOf` in
    // `engine.js` for the change. Two props were previously *impossible* to price: fair value came out
    // at 0.6 and 1 was the floor a card could pay, so `grow` and `broken` were left either a faucet or
    // a heavy shave with nothing in between. A tenth removes that whole class of problem.
    //
    // Re-derived against the median rate across racks actually *dealt* the card, targeting a slight
    // player edge per the design goal that these are endgame picks and should never read as dead:
    //
    //     prop      median   peak    spread   price   EV@median   EV@peak
    //     tie        24.6%   25.1%    1.02x    7.1      +0.05      +0.09   <- priced
    //     burn       28.5%   31.2%    1.09x    6.0      +0.05      +0.24   <- priced
    //     clone      23.1%   26.0%    1.13x    7.7      +0.07      +0.32   <- priced
    //     grow       19.1%   20.7%    1.08x    9.5      +0.07      +0.24   <- priced
    //     raze        9.6%   10.4%    1.08x   19.9      +0.06      +0.24   <- priced
    //     invert     28.5%   42.3%    1.48x    6.0      +0.05      +1.02   held
    //     mirror     23.8%   36.1%    1.52x    7.4      +0.06      +1.09   held
    //     broken     10.7%   53.2%    4.97x   17.6      +0.05      +7.96   held
    //
    // **Granularity was only half the problem.** The five priced above have a median-to-peak spread inside
    // 13%, so one number serves every rack that sees the card. The three held do not: `needs` gates whether
    // a card is *offered* and never what it costs, so a player who builds for `broken` sees five times the
    // rate a random eight does and pricing it to the target hands them +7.96 an ante. Those want their
    // predicates tightened until the spread closes — the same treatment `grow` had — and they are left at
    // a house edge until then, knowingly.
    betPriceTenths: true,
    // **The design target for the book changed after this was written: a card should be a slight edge to
    // the player, not a shave.** These are endgame picks and a pick nobody takes is a dead node.
    //
    // That is deliverable only where a proposition's rate does not swing on rack choice, because `price`
    // is one flat number and `needs` gates whether a card is *offered*, never what it costs. Measured as
    // the best-rung rate across racks that are actually dealt the card — median against peak:
    //
    //     prop      median   peak   spread   slight-edge price   EV@median   EV@peak
    //     burn       29.0%   29.9%   1.03x          6              +0.09      +0.15   <- shipped
    //     clone      25.3%   25.8%   1.02x          7              +0.08      +0.13   <- shipped
    //     tie        20.7%   25.3%   1.22x          9              +0.13      +0.59
    //     grow       18.4%   25.7%   1.40x         10              +0.08      +0.89
    //     mirror     24.0%   34.5%   1.44x          8              +0.22      +1.17
    //     invert     27.5%   43.5%   1.58x          7              +0.26      +1.54
    //     raze        9.5%   13.6%   1.43x         21              +0.14      +1.05
    //     broken     10.2%   61.2%   6.00x         19              +0.11     +10.30
    //
    // `burn` and `clone` have spreads inside 3% and are priced to the target. **Everything below them
    // buys a slight edge for a typical rack at the cost of a faucet for a built one**, and `broken` is
    // the reductio: a rack assembled from wipeout-carriers sees six times the rate a random eight does,
    // so no single number is both live and safe. Those want their predicates tightened until the spread
    // closes — `broken` narrowed to *two or more shatter* measures 24.7% peak against 10% before — and
    // pricing them to the target before that is shipping the exploit back.
    //
    // Left at a house edge in the meantime, which is a knowing interim state and not the target.
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
    // **0.10, down from 0.25.** The Boost pays for every cube *on the table*, so the bonus grows with
    // the line — which made it the largest single term in the late game: zeroing it took a
    // best-of-breed seven from 1.234 to 1.055 at Level 4, more than any other dial in the file.
    //
    // It is `pureBonus`'s mirror image and was mistuned in the same direction for the same reason. That
    // one paid per cube on a *short* line, where sweeping everything is cheap; this one pays per cube on
    // a *long* one, where there are the most cubes to be paid for. Both were priced as though the
    // per-cube count were a cost rather than the thing that scales.
    //
    // Measured at `pureBonus 0.25 / heatBonus 0.25`, and note the early column does not move — this is a
    // late-game dial the way `pureBonus` is an early-game one:
    //
    //     boostBonus   empty   4 cubes   best-of-breed 7   full 8
    //     0.25         0.991   0.972         1.104          1.129
    //     0.15         0.985   0.968         1.059          1.087
    //     0.10         0.989   0.974         1.044          1.071      ← shipped
    boostBonus: 0.10,
    // What the Turbine's first heat pays. The *n*th pays `heatBonus × n`, so the step and the floor are
    // the same dial and the cube's whole run totals `heatBonus × n(n+1)/2`. Half, so a Turbine that
    // blows on its first landing has paid exactly a Greed and everything above that is what the cube
    // is arguing for. Raising it steepens the tail rather than lifting the floor, because the top of
    // the curve is where the multiplier is doing the most work.
    // **0.25, down from 0.50.** The Turbine pays more every time and burns its own faces off, so the
    // bonus is escalating *and* the cube is priced by how long it survives — two multipliers on one
    // face. Zeroing it took a best-of-breed seven from 1.234 to 1.088 at Level 4, second only to
    // `boostBonus`, which makes it one of the two dials that were carrying the late game.
    //
    // Matched to `boostBonus` deliberately: both are per-something bonuses that grow with the table, so
    // pricing them at one number means a rack fielding both is not paying two different rates for the
    // same shape of effect.
    heatBonus: 0.25,
    // What the Guide pays, **per cube in the unbroken run of the called side touching it**. Half of
    // `pureBonus`, deliberately and not by coincidence: a pure pays 1 per cube for a whole clean line,
    // and this is the same reward at a coarser resolution for a rack that can never draw one. The two
    // can never both be collected — this face is not a side, so its presence disqualifies the pure —
    // so the ratio between them is the only thing this dial has to get right.
    guideBonus: 0.5,
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
    // How many cubes Oovo IV takes, and the size of **one die's cell** rather than of the run's
    // prison — a die already holding three can only take one more, and a reflected copy brings a
    // cell of its own. Four, against a Level 3 line of five, is a table gutted rather than trimmed —
    // which is the point, and why the release valves are not optional: **one prisoner walks out at
    // the start of every turn the die takes**, and if the die is destroyed they all walk at once.
    //
    // Without the drip, "released when the die is destroyed" can mean *never*, because this cube
    // carries no wipeout and no mine and a rack with nothing destructive in it has no way to break it.
    // Four cubes gone permanently off a five-cube table is the deadlock measured at 9.6% of full-rack
    // runs and engineered around; a prison with no door would put it straight back.
    //
    // The drip used to be per rung *won*, which made the door something the player had to buy with a
    // survived roll. Per turn is the same valve tied to the thing actually doing the holding: the die
    // is on the table either way, and a prison that empties whether or not the rung goes your way is
    // one the run can dig itself out of. It also empties faster than it used to — four arrests take
    // four turns to undo, and the die throws every rung.
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
    // **0.25 per cube, down from 1, and the argument above is the reason it had to move.**
    //
    // The note says a pure is self-limiting because "the payout doubles per extra cube while the odds of
    // collecting it halve". That is true *within* a level and it is not the mechanism that mattered:
    // `mult += bonus` lands on the **running** multiple, and every level above doubles it again. So a
    // pure on a three-cube line is a **1-in-4** event paying **+3** that then rides four more doublings
    // to the top of the road. It was cheapest to collect exactly where it had the most ladder left.
    //
    // Measured, and the number is not subtle: **a bare ladder — no cubes, no picks, nothing equipped —
    // paid the player 12.8%**, and zeroing this one dial turned the same ladder into a sink. Every other
    // bonus dial zeroed on an empty rack changed nothing, because none of them have a cube to fire on.
    // On a bare ladder `pureBonus` *was* every bonus.
    //
    // It also produced an inversion worth naming, because it is the whole reason this dial is the first
    // thing that moved. A pure needs **every** position on the line to be a counting cube, and effect
    // faces count for neither side — so the pure rate collapses **70x** from an empty rack (0.071 a run)
    // to a fully kitted one (0.001). The mode's entire player edge sat on an event that owning cubes
    // deletes, which is why 15 of 18 cubes measured *worse than an empty rack* when fielded alone.
    // Prestige was handing out rewards that made a player weaker.
    //
    //     pureBonus      empty     1 cube    4 cubes    best-of-breed 7
    //     1.00           1.139     1.044     0.966      1.221
    //     0.50           1.027     0.967     0.968      1.191
    //     0.25           0.969     0.967     0.968      1.214      <- shipped
    //
    // **The late-game column does not move**, at any value, because a kitted rack never pures. That is
    // what makes this the right dial for the early end specifically: it is the only one in the file that
    // acts on the bare ladder and leaves a built rack alone. The late end is `boostBonus` and
    // `heatBonus`, and it is tuned there.
    pureBonus: 0.25,
    // ---------------------------------------------------------------------
    // The weld
    // ---------------------------------------------------------------------
    //
    // ---------------------------------------------------------------------
    // The press, unlocked a rung at a time
    // ---------------------------------------------------------------------
    //
    // **Four picks off Watto's rack rather than one**, taken in order, each costing a build token.
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
            // **Naming the parent the major share lands on belongs to the uneven cut itself** — the
            // moment a cut *has* a bigger share, the player says where it goes — rather than to a
            // rung of its own, which would sell the choice separately from the thing being chosen
            // about. See `pressPicks`, which honours `major` at any rung for exactly that reason.
            name: 'Uneven Cuts',
            blurb: 'The press sometimes takes four faces from one cube and two from the other — '
                + 'and you name which cube gives more.',
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
    // At these weights, once both rungs are bought, 4+2 is ~9% of presses and 5+1 ~0.9% — and the major
    // share lands on the parent the player named, so a useful 5+1 is roughly one press in 110. Below
    // those tiers they are not rare, they are **absent**, and the common cut is the whole table.
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
    // whale. See `weldRerollCost` for why the truguts price and the build-token path both stay live —
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
    // for a sharper reason: **a flat price means truguts always win and build tokens never get
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

// ---------------------------------------------------------------------------
// The cosmetics shelf
// ---------------------------------------------------------------------------
//
// **The two sides, as something the player bought.** Every other face in the game draws as one fixed
// picture and has to — a face that *does* something has to look like the thing it does — so
// `side:blue` and `side:red` are the only two faces in the mode whose picture is free: the rules name
// the position and nothing in the rules can read the hue. That freedom is what is for sale here.
//
// **The engine is never told, and neither is the ledger.** A skin is a lookup one level deep in the
// client's `faceOf`, so nothing here is an advantage and nothing here has to be balanced against
// anything. What this file owns is the two things a client must not: the **price** and the **gate**.
// The pictures themselves — the SVG paths, the hexes, the flag art — stay client-side, which is the
// same split every other face already follows: what a face looks like is the client's business.
//
// An earlier draft of the mode had cosmetic face palettes and cut them — see the note beside the
// prestige picks in `docs/chance-cube.md` — on the grounds that a palette was a second screen's worth
// of plumbing in exchange for nothing to play with. What brings it back is that the plumbing turned
// out to be one lookup and the screen already existed: the shop and the cubes screen are both drawn,
// and this is a shelf on one and a picker on the other. It is also the only thing in the mode that
// truguts buy and *keep* — everything else they buy is spent — which is what gives a rich late player
// something to want.

// Ten colours and three shapes, which is thirty variants. Names rather than art: the client builds
// every square from one path with the fill swapped, and the server never needs to know which fill.
//
// `pink` is the tenth and the only one with no square emoji behind it. Ten is what makes the shelf
// pair up cleanly — nine colours leaves one variant per shape with nobody to be sold beside.
const SKIN_SHAPES = [
    { id: 'sq', name: 'Square' },
    { id: 'ci', name: 'Circle' },
    { id: 'ht', name: 'Heart' },
];
exports.SKIN_SHAPES = SKIN_SHAPES;

const SKIN_COLORS = [
    { id: 'red', name: 'Red' },
    { id: 'orange', name: 'Orange' },
    { id: 'yellow', name: 'Yellow' },
    { id: 'green', name: 'Green' },
    { id: 'blue', name: 'Blue' },
    { id: 'purple', name: 'Purple' },
    { id: 'pink', name: 'Pink' },
    { id: 'brown', name: 'Brown' },
    { id: 'black', name: 'Black' },
    { id: 'white', name: 'White' },
];
exports.SKIN_COLORS = SKIN_COLORS;

// **Flag `n` is the `n`th racer of the in-game roster**, which is `racernum` and the order the art was
// cut to. Read off the bot's own racer table rather than written out again: the roster is a fact this
// process already holds, and two lists of twenty-three names is two lists to keep in step. (The
// Activity *does* write them out — it is a separate bundle and importing the site's whole game
// database to name a flag is the dearer of its two answers there, which is not true here.)
//
// `racernum` 9 is declared three times in the data — Mars Guo, then two non-canon racers sharing his
// slot — so this takes the first, which is the one the roster means.
const RACER_FLAGS = 23;
const racerName = function (n) {
    // eslint-disable-next-line global-require
    const { racers } = require('../../data/sw_racer/racer.js');
    const found = racers.find(r => Number(r.racernum) === n);
    return found ? found.name : `Racer ${n}`;
};

// Every variant that exists, whether or not anybody owns it, keyed by the one id the profile stores.
// Flat: the shelf sells matched pairs and the picker equips one side at a time, so a pair is
// something a *set* holds and never something the model does. Store pairs and the first job on every
// read is prying them apart again.
const SKIN_VARIANTS = [
    ...SKIN_SHAPES.flatMap(s => SKIN_COLORS.map(c => `${s.id}:${c.id}`)),
    ...Array.from({ length: RACER_FLAGS }, (_, i) => `flag:${i}`),
];
exports.SKIN_VARIANTS = SKIN_VARIANTS;

// What a player owns before they have done anything at all: one square each in the two colours the
// game shipped in — so a first-run board looks exactly like a board with no skins in it — plus the
// circle pair, which is the only variant that reads for a player who cannot tell the two colours
// apart. Never sold, and granted on read rather than written to any profile: a free thing stored per
// player is a free thing that can go missing.
const SKIN_FREE = ['sq:blue', 'sq:red', 'ci:blue', 'ci:red'];
exports.SKIN_FREE = SKIN_FREE;

// **Flat, and deliberately not scaled by the stake ceiling the way `rerollCost` is.** A reroll is
// scaled because it is spent and bought again, so its price has to keep pace with what a run earns.
// These are bought once and kept forever, and scaling a one-time price means the longer you admire
// something the dearer it gets — the shelf would be pushing every player to buy on the prestige a set
// unlocks rather than on the one they actually want it on. A price that stops binding at a high
// ceiling is the cheaper of the two mistakes.
//
// A pair is two variants and both slots' worth of use, so it is dearer than a flag.
const SKIN_PAIR_PRICE = 5000;
const SKIN_FLAG_PRICE = 3000;

// **The three kinds of gate, and each one a different question.** `prestige` is how far round the
// ladder you have been, `cubes` is how much of the rack you own, and `faces` is the collection —
// every face on a cube of yours having landed at least once. A shelf gated only on prestige would
// make the shop a second ladder readout; these three make it three separate reasons to play.
//
// The shapes climb on prestige, the circles on the rack, and the hearts run past both — a heart is
// the shape you finish with. `blue+red` is missing from squares and circles because that pair is the
// four variants everybody starts with.
const SKIN_SHELF = [
    { shape: 'sq', pair: 'purple+orange', gate: { prestige: 1 } },
    { shape: 'sq', pair: 'green+pink', gate: { prestige: 2 } },
    { shape: 'sq', pair: 'white+black', gate: { prestige: 3 } },
    { shape: 'sq', pair: 'yellow+brown', gate: { prestige: 4 } },
    { shape: 'ci', pair: 'purple+orange', gate: { cubes: 4 } },
    { shape: 'ci', pair: 'green+pink', gate: { cubes: 6 } },
    { shape: 'ci', pair: 'white+black', gate: { cubes: 8 } },
    { shape: 'ci', pair: 'yellow+brown', gate: { cubes: 10 } },
    { shape: 'ht', pair: 'blue+red', gate: { prestige: 2 } },
    { shape: 'ht', pair: 'purple+orange', gate: { prestige: 3 } },
    { shape: 'ht', pair: 'green+pink', gate: { cubes: 12 } },
    { shape: 'ht', pair: 'white+black', gate: { prestige: 5 } },
    // The collection's reward, and the only thing on the shelf a prestige cannot buy.
    { shape: 'ht', pair: 'yellow+brown', gate: { faces: 'all' } },
];

// Every flag opens on one condition rather than twenty-three, because a racer is not a rung: which
// flag you want is about who you play, and staggering them would mean telling a Gasgano player to
// earn six other people's flags first.
const SKIN_FLAG_GATE = { prestige: 3 };

const skinShape = id => SKIN_SHAPES.find(s => s.id === id);
const skinColor = id => SKIN_COLORS.find(c => c.id === id);

// **One entry per thing on sale, and the id is what a purchase names.** The set id rather than the
// variant ids, so the price and the gate are checked against the thing that was actually offered
// instead of against a list the client assembled — a client that could name variants could name a
// cheap set's price beside an expensive set's contents.
//
// `ids` is what the purchase grants, and a pair and a flag both come out of it: a colour is sold as a
// matched pair because two contrasting colours is what a *side* skin is for and nobody wants half of
// one, and a flag is sold alone because a flag is a racer and picking one is the point. Same field
// either way, so nothing downstream has to know which kind it was looking at.
exports.SKIN_SETS = [
    ...SKIN_SHELF.map(({ shape, pair, gate }) => {
        const [a, b] = pair.split('+');
        return {
            id: `set:${shape}:${pair}`,
            name: `${skinColor(a).name} & ${skinColor(b).name} ${skinShape(shape).name}s`,
            ids: [`${shape}:${a}`, `${shape}:${b}`],
            group: shape,
            price: SKIN_PAIR_PRICE,
            gate,
        };
    }),
    ...Array.from({ length: RACER_FLAGS }, (_, i) => ({
        id: `set:flag:${i}`,
        name: racerName(i + 1),
        ids: [`flag:${i}`],
        group: 'flag',
        price: SKIN_FLAG_PRICE,
        gate: SKIN_FLAG_GATE,
    })),
];
