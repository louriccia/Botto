// Static design data for Botto's Chance Cube — the betting minigame unlocked by the
// "Red vs Blue" collection (3× Red Side + 3× Blue Side, see data/challenge/collection.js).
//
// The cube is fair: every face is a straight 50/50 draw from the CSPRNG, and every level
// is a clean double, so the ladder itself has no house edge at all. A **share** of every
// trugut lost on a bust feeds the Pure Cube pot, which is where the drama lives instead —
// see `potShare`, which is the one number keeping the mode from minting truguts.
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
//   end         the run ends, right there, whatever the rest of the line says
//   broken      nothing this roll, and the cube is out for the rest of the climb
//   greed       payout multiplier + greedBonus
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

const rep = (n, face) => Array.from({ length: n }, () => face);

// RIPratts. Not a dud — the run is over.
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
];

// What a cube destroyed by a raze is replaced with. Not on any cube's face list — it is never
// rolled, only written onto the line by `raze` — but it needs a declaration because it is the one
// piece of art with a **handedness**: reflected, Ben's left third has to come back as his right or
// the mirror draws him inside out. `mirrored` names the id it becomes in the glass.
//
// The mechanism is general. Any face declaring a `mirrored` counterpart flips when it is copied by
// a reflection; anything symmetrical declares none and is copied as it stands.
exports.RAZED = {
    'razed:left': { kind: 'razed', id: 'razed:left', mirrored: 'razed:right' },
    'razed:right': { kind: 'razed', id: 'razed:right', mirrored: 'razed:left' },
};

// Share of the Pure Cube pot paid when every cube lands on your called side, by cube count.
//
// Frequencies per roll at that level: pure 3 = 1/8, pure 5 = 1/32, pure 7 = 1/128, pure 9 =
// 1/512 — and each needs the wins to get there first, so per *run* it's roughly 1 in 128 for a
// pure 5, 1 in 1,000 for a pure 7 and 1 in 8,000 for a pure 9. Three paying tiers rather than
// one keeps the pot circulating: the 5% tier is the one most players will ever actually see
// land, and it is deliberately the smallest because it fires often enough to set where the pot
// rests.
//
// These decide **how the pot is spent, not how much of it there is.** That distinction is worth
// holding on to, because the arithmetic misleads: with inflow `i`, a payout chance `q` and a
// share `s`, the jar settles at `P* = i / (q·s)`, so a rarer or stingier tier just rests bigger
// and the long-run outflow is unchanged. Shrinking a share here makes the headline number
// larger, never the payout smaller. The size of the jar is `potShare`.
//
// Pure 3 stays at nothing. At 1-in-8 on a level nearly every run passes through, any share at
// all would drain the pot faster than busts fill it.
//
// Keyed on the level's *nominal* cube count, not the length of the resolved line — a Binder
// or a Mirror can leave a level 4 roll six or nine cubes long, and there is no sensible share
// for a count the ladder doesn't have.
exports.SWEEP_SHARE = { 3: 0, 5: 0.05, 7: 0.25, 9: 1.00 };

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
    // Every cube on your side, but the level pays nothing from the pot.
    pure: [
        "Alla one side. Pretty. Pretty don'ta pay, eh?",
        'Hmph. A trick roll. Costs me nothing.',
    ],
    // Pure cube that actually takes a share of the pot.
    jackpot: [
        "Whaaat?! Alla them?! ...Take it. TAKE IT and stop lookin' at me.",
        'No — no no NO! My pot! You cheated me somehow, I know it!',
        "That's not possible! Nobody rolls that! Nobody!",
    ],
    // Cashed out on purpose.
    bank: [
        "Feh. Take it and get outta my shop.",
        "Cashing out already? Coward's money spends the same, eh?",
        'Fine. FINE. Go count it somewhere else.',
    ],
    // Survived your ceiling — the deepest level you've unlocked, which banks itself.
    ceiling: [
        "That's as far as you go, outsider. Take it and be happy.",
        'Ha! You hit the wall. Watto keeps the rest of the cubes.',
        "Enough. You want more cubes on the table, you gotta earn 'em.",
        'Hmph. Cleared. Do it again and maybe we talk about more cubes.',
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
    potSeed: 25000,
    // Share of a busted stake that feeds the Pure Cube pot. The rest leaves the economy, which
    // is the whole reason this number is not 1.
    //
    // The ladder is a martingale — 2^k paid on a 1-in-2^k run, so EV is exactly the stake at
    // every rung and no stopping strategy beats another. That is the right shape for the game
    // and the wrong shape for a faucet, because a fair ladder has **no spare money in it**: the
    // busted stakes are already precisely what funds the winners. Routing them into the pot as
    // well spends them twice, and a pot in steady state pays out exactly what it takes in — so
    // at a share of 1 the mode returned `1 + bustRate` per trugut staked, which is 1.5× for a
    // player who banks at level 1 and 1.97× for one who pushes to the top.
    //
    // Rarity does not help, which is the counter-intuitive part. With inflow `i`, a payout
    // chance `q` and a share `s`, the pot settles at `P* = i / (q·s)` — rarity is in the
    // *denominator*, so a jackpot that fires ten times less often simply rests ten times bigger
    // and the long-run outflow is identical. Measured from the other side in §2.8 of the design
    // doc: dropping the tier share 10% → 5% *raised* the resting pot 440× → 660× average stake.
    //
    // So the fix is the inflow, not the tiers. Total return is `1 + potShare · bustRate`, and
    // the resting pot scales linearly with this number:
    //
    //   1.0  →  ~660× average stake  ·  up to 1.97× returned per trugut staked
    //   0.25 →  ~165× average stake  ·  up to 1.24×
    //   0.10 →   ~66× average stake  ·  up to 1.10×
    //
    // A quarter keeps a jackpot worth announcing in the channel and takes three quarters of the
    // leak out. Raising it inflates the headline and the faucet together, in step.
    potShare: 0.25,
    // Stops the pot being seeded a trugut at a time by spam runs.
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
    dayLean: 0.55,
    // Banks at your top unlocked level needed to open the next one. Every level starts
    // locked except the first, so the 32× is earned rather than handed over.
    clearsToUnlock: 2,
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
    // The **xp bar is the hard limit**, though. The Discord meter draws one tile per clear
    // needed: five is a meter you can read at a glance, twelve wraps on a phone and stops being
    // countable. A client with room to draw a real meter could raise this; the number is a
    // presentation limit that ended up in the rules, and it should be re-examined rather than
    // inherited.
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
    // Special cubes you can have equipped at once. Every "+1 slot" pick at prestige adds one;
    // you may own more cubes than you can field.
    startingSlots: 1,
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
    // it lands *against* your call. Qui-Gon's Nudge turns the same weight around rather than
    // removing it, so a tie is always a coin flip that somebody owns.
    tieLean: 0.6,
    // Buying a tie off him instead, once the rack has handed that over. Priced as a share of
    // the standing it buys, because a tie at the top of the ladder is worth thirty-two times one
    // at the bottom and a flat price would be free money up there. Every bribe already paid makes
    // the next dearer — and once the price passes what the tie pays, he stops offering and just
    // rolls. The count resets at prestige, so the option can never price itself out for good.
    bribeShare: 0.25,
    bribeStep: 1.5,
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
    // Base price of a bought reroll, once the perk is unlocked. Scaled by the stake ceiling so
    // it keeps pace with prestige — a reroll is only worth it if you mean to push deep.
    rerollCost: 2500,
    // Each reroll already in stock makes the next one this much dearer, so stockpiling gets
    // expensive fast and the price falls back on its own once they're spent. No extra counter
    // to keep: the stock *is* the escalation.
    rerollPriceStep: 1.5,
};
