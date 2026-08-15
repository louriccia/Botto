# The Planet Octahedron — Design Proposal

> *"We'll let fate decide."* — and then eight planets decide instead.

**Status: built, measured, not yet played by anyone.** `docs/chance-cube.md` documents what is on the
table; this documents the eight-sided planet die that now sits beside it — the rules, the reasoning,
and everything the measurement said that the design did not.

Coverage is `scripts/cubeOctahedron.js`, which `cubeParity.js` deliberately does not cover: the frozen
reference engine predates this cube, so a climb fielding it is not a divergence in the ported rules.

An eight-sided die whose every face is one of the eight planets, each doing something no other cube
does. It is not another special cube with a bigger number on it — it is the first cube that reaches
outside the line, changes other cubes permanently, and takes the player's buttons away.

---

## 1. The three constraints that shaped it

Everything below falls out of these, and none of them is negotiable.

**A face either IS a side, or DOES a thing.** A planet face that secretly counted as blue would have
to draw as a planet *and* as a colour, and the one-glyph-one-position rule exists precisely because a
position drawn as two glyphs is a position players count as two. So no planet face can produce a
side, which means **the die is sideless on all eight faces, on every throw.** It is a permanent tie
machine. That is the single biggest balance fact about it and §6 is where it gets paid for.

**A cube with no wipeout and no mine never leaves the table.** The Sebulba note in `tuning.js` is the
record of what that does: an effect that only ever helps is re-applied at every level for the rest of
the climb and compounds against a ladder that doubles, which is how six engine faces measured **1.64
EV at Level 5** and had to be cut back to four. With eight unique planets there is no room for a
shared Ratts or wipeout face, so **the price has to live inside the planets.** Three of the eight
below are bad for you, and one of them is the only way the die ever dies.

**Three faces need state that does not exist.** Freeze, scorch and jail all attach something to a
cube that has to survive to the next throw. The set is a flat array of ids and has nowhere to put it.
See §7 — it is one change, not three, and it is the thing to scope before any face logic.

---

## 2. The faces

| Planet | Kind | What it does | Pts |
|---|---|---|---|
| **Ando Prime** | `freeze` | Both neighbours keep the face they are showing into the next rung and take no turn. | 2 |
| **Aquilaris** | `vault` | The side you just called is sealed. Next rung, you must call the other one. | 2 |
| **Baroonda** | `scorch` | Burns the face each neighbour is showing **off that cube**, for the rest of the climb. | 3 |
| **Malastare** | `lockout` | Seals the bank. You cannot cash out until you clear the next level rung. | 1 |
| **Mon Gazza** | `seam` | **+0.5** on the run's multiple for every rung already cleared this run. | 1 |
| **Oovo IV** | `jail` | Imprisons up to four cubes. One out per rung won; all out if the die is destroyed. | 3 |
| **Ord Ibanna** | `plunge` | The cubes at the **head and the tail** of the line fall into the chasm. | 3 |
| **Tatooine** | `boonta` | If the roll ties, you win it. | 2 |

Points follow the existing convention in `POINTS`: **3** restructures the shape of the line, **2** is
positional or otherwise moves one thing, **1** is the floor for turning up, **0** is a corpse. The die
averages **2.125** against a plain cube's 1, so it is a strong points cube as well as an effect one —
worth about +1.1% of the stake a throw at `pointValue`, which is a sweetener rather than a second
scoring axis, exactly as intended.

---

## 3. Ice and fire

**Ando Prime and Baroonda are one mechanic pointed two ways.** Both take both neighbours — the
geometry Symbiont's raze already uses, so it is a shape players have seen. Ice locks a face **on**;
fire takes a face **off**.

### Ando Prime — `freeze`

> The cubes either side of it freeze. A frozen cube is not thrown next rung — it keeps the face it is
> already showing — and it takes no turn while it is frozen.

The freeze reaches **forward**, and it has to. A freeze that only held for the throw it landed on
would be nearly invisible, because the set is reshuffled every throw anyway; the whole value is that
it reaches into a throw whose sides are supposed to be random. That makes it the only thing in the
game that breaks *"the cubes persist; the sides never do."*

- Freeze a plain blue on a blue call and you have bought a guaranteed vote next level. Freeze a red
  and you have bought one against yourself.
- Freeze a **Ratts** and the mine is disarmed for a rung — it sits there showing its face and takes no
  turn.
- Freeze your own **Greed** and it stops paying. The face does not care whose cube it is.

**Two thaw rules, and both ship:**

1. **It thaws at the end of the throw it was frozen for.** One rung, always. The full lifecycle is
   frozen on throw N, locked on N+1, ordinary on N+2. No timer, no stacking, and the player can see
   the whole thing coming.
2. **It thaws early the moment anything touches it.** A burn, a clone writing over it, a mirror
   copying onto it, an engine, a cull, a raze, a blast, a scorch — **the ice takes the hit instead of
   the cube**, shatters, and the cube walks away thawed and intact. The release condition is the
   table rather than a counter, and it gives the freeze a second identity as one-shot armour.

Freeze governs the **face, not the position** — the set still shuffles, because position is a
property of the throw and nothing should change that. A destroyed position cannot be frozen.

**The forward reach is what keeps the pair from needing a precedence rule.** Ando's freeze lands on
the *next* throw, so it cannot silence a Baroonda standing beside it on this one. Had the freeze been
a same-throw effect, two both-neighbour faces on one die would have needed an ordering rule
immediately.

*In the Activity:* a frost overlay, and the frozen cube **does not tumble** during the throw — it is
already showing its face while everything else is still face-down. That is the tell, and it is a beat
the embed could never have drawn.

### Baroonda — `scorch`

> Burns the face each neighbour is currently showing off that cube, permanently, for the rest of the
> climb.

Burning the **landed** face rather than a random one is what makes it readable and self-selecting:
the thing being destroyed is on screen at the moment it is destroyed. It also flips how a line reads
— a wipeout or a Ratts landing next to Baroonda is suddenly **good news**.

**One face of the six, and only that one.** A scorch takes the single face the cube landed on out of
its face list — it does not take the *kind*. A Wild Cube is five wilds and a Ratts; scorching a wild
leaves **four wilds and a Ratts**, not a cube with no wilds on it.

**Which means a scorch changes a cube's odds, not just its length**, and that is the whole of what
makes it interesting. Every face left on a scorched cube gets more likely, so what a burn is worth
depends entirely on which face it took:

| Cube | Scorched face | Becomes | Effect |
|---|---|---|---|
| Wild (5 wild, 1 Ratts) | the **Ratts** | 5 wild | pure wild, no downside, for the rest of the climb |
| Wild (5 wild, 1 Ratts) | a **wild** | 4 wild, 1 Ratts | the mine goes from 1-in-6 to **1-in-5** |
| Multiplier (2 red, 2 blue, 2 wipeout) | a **wipeout** | 2 / 2 / 1 | shatters 1-in-5 instead of 1-in-3 |
| Plain (3 blue, 3 red) | a **blue** | 3 red, 2 blue | a **60/40** cube, tilted red for the climb |

So burning a good face is not a small loss — it **concentrates the bad ones**, which is the honest
counterweight to burning a Ratts off a Wild being the best thing that can happen to a rack.

**On a plain cube it is a nudge, not a transformation.** Three blue and three red is the cube the
Red vs Blue collection literally assembles, so one scorch is 60/40 and it takes **five** to fuse one
to a colour. That endpoint still exists — a cube that always lands blue — but it has to be earned by
Baroonda finding the same cube five times, which almost never happens in one climb.

**A scorched cube carries the only bias left in the mode**, and it is the only cube in the game that
ever did. There was a daily lean once — a cosmic thumb on the scale, never announced and never
readable from inside one game — and it is gone, because a bias nobody can read is also a bias nobody
can be charged for. A cube Baroonda has been at is not being nudged by anything; it is **physically
loaded**, and its bias is sitting right there on the rack screen to be counted. So the die hands the
player a bias they can *read*, in a mode whose other
bias can only be sensed — and, if the day is running against you, taking a cube out of the Force's
reach is a real use for a burn that nobody will find on their first climb.

**Floor: a cube can never be scorched below one face.** With six faces to start that is five burns
deep, so it is a genuine backstop rather than a constraint the mechanic runs into — but it is what
keeps the *"a set always keeps something on it that can decide a roll"* guardrail intact.

**Fire melts ice, with no special case.** Scorching a frozen neighbour hits the ice, which shatters;
the face survives and the cube thaws. That is thaw rule 2 doing its job, not a carve-out.

**It is self-limiting in a way the other faces are not.** A cube has to survive on the table long
enough for Baroonda to find it, and Baroonda is one face in eight — so most climbs see one or two
scorches total, spread across whatever happened to be adjacent. If it does measure hot the dial is the
target rather than the count: *specials only, plain cubes immune* removes the common case and leaves
the rack-reshaping half intact.

---

## 4. The vault and the arena

**Aquilaris and Malastare are the second pair, and they are about the buttons rather than the cubes.**
The call and the bank are the only two things a player actually decides in this mode, and no cube has
ever reached either.

### Aquilaris — `vault`

> The vault doors seal the side you just called. Next rung, that side cannot be called.

Sealing the side you *last called* rather than a random one is what makes it a rule instead of a coin
flip: it forces you to switch, which is a door closing behind you, and it breaks a streak-rider's
pattern.

**It costs nothing in EV and a great deal in position.** The call is 50/50 either way, so being forced
onto a side is free — right up until your rack has an opinion. Locked onto blue with a **Shmi Cube**
on the table, or with a plain cube Baroonda fused red three rungs ago, is a genuinely bad rung. The
cost is rack-dependent rather than flat, which is the good kind.

One rung to start. Sealing for the **rest of the run** is the harsher dial and can always be turned
later; taking the only choice the game offers away for a whole climb is much harder to walk back.

### Malastare — `lockout`

> The bank is sealed. You cannot cash out until you clear the next level rung.

Malastare is merciless in the lore and this is the mechanical version of it: not taking your money,
taking your way out.

**It aims the punishment at exactly the right rungs.** A level push is EV **1.000** — forcing one
costs nothing but nerve. An **Again** push is `M → M+1`, and the entire house edge in this mode lives
in the Agains. So *locked until the next level* is precisely a rule that marches the player through
the only stretch of road the house makes money on. Malastare is not a punishment bolted onto the
economy; it is the house's own face on the die.

**And the cost scales with how much road is left.** On a collapsed route the next rung *is* a level,
so it is one fair push and barely a scratch. On a fresh prestige with a full gap of Agains standing
in it — five, at `maxClears` — it is that many bad bets in a row with no exit. Malastare is at its
most merciless immediately after a prestige and nearly harmless by the end of a cycle — the opposite
of how a flat punishment behaves.

Past Level 5 there are no level rungs left to clear, so **in overtime it lasts one rung**. That is
preferred over an exemption because it keeps the face live everywhere and needs no "does this apply"
check.

*In the Activity:* the Bank button is struck through and wears Malastare's mark, so the player can see
*why* it is dead.

---

## 5. The four singles

### Mon Gazza — `seam`

The die's only paying face, and it is on the one axis nothing occupies. `greed` is flat, `boost` is
per-position, `mult` is conditional on a side — **none of them pay for depth.** A seam caught on a
fresh Level 2 is worth +0.5; the same face near the top of a padded road is worth +3 or more, and
then compounds up whatever ladder is left above it.

### Oovo IV — `jail`

> Imprisons up to four cubes at random. One walks out for every rung you win. If the die itself is
> destroyed, they all walk out at once.

An imprisoned cube is off the line entirely — not thrown, does not count, takes no turn — but it is
**not destroyed**. The die never imprisons itself.

The drip is the main valve and it is thematically right: you race your way out. Without it, "released
when the die is destroyed" can mean *never*, because a rack with nothing destructive in it has no way
to break a die that carries no wipeout and no mine — and four cubes gone permanently from a
five-cube table is the deadlock the design already measured at **9.6% of full-rack runs** and
engineered around.

The existing rule that a **won tie puts a plain cube on the table** is a second, slower valve that
costs nothing to inherit: a gutted table ties, and a survived tie feeds it.

### Ord Ibanna — `plunge`

> The cubes at the head and the tail of the line fall into the chasm.

Removes two, so it is **parity-preserving** and does not manufacture ties — which matters on a die
that is already sideless everywhere.

**And it is the key to the whole object.** The plunge takes whatever is on an end, *including the die
itself*. That single fact makes it:

- the die's **only** self-destruct path, in the absence of a wipeout face;
- the **jailbreak** — every prisoner Oovo IV was holding spills back onto the table;
- the **release** for Malastare's bank lock.

Three cruelties, one key, and the key is a cube you cannot aim. That is what makes eight rules read as
one object rather than a list.

### Tatooine — `boonta`

> If the resolved line ties, you win it.

No roll, no lean, no interaction with Qui-Gon's Nudge to reason about. It is dead unless the roll
ties — but the die is sideless on all eight faces and three of them actively chew the count, so
Tatooine fires far more often on this die than the same face would anywhere else. **The die creates
the problem one of its own faces solves**, which is the loop that makes it whole.

---

## 6. What the shape adds up to

Two pairs and four singles:

```
  ice / fire        Ando Prime  ·  Baroonda      both neighbours; lock a face on / burn one off
  the controls      Aquilaris   ·  Malastare     takes your call / takes your exit
  the singles       Mon Gazza      pays for depth
                    Oovo IV        imprisons
                    Ord Ibanna     destroys — and is the key to all three cruelties
                    Tatooine       wins the ties the rest of the die causes
```

**The die's cost is paid three times over**, which it has to be, because nothing on it shatters:
Malastare takes the exit, Ord Ibanna takes cubes, Oovo IV takes cubes and hands them back slowly. Set
against one payer, one guaranteed tie-win, and two faces that are as likely to hurt as help. If the
measurement comes back over Wild's ~1.3 the first dial is **Mon Gazza's rate** and the second is
Baroonda's target — not the downside faces, which are what make it interesting.

**The nastiest combination on the die is `jail` + `lockout`.** Four cubes gone and no way to leave the
gutted line, pushing a short and tie-prone table through a gap. Both faces are on the same object.
That is the merciless read taken all the way and it is probably correct for a mythical, but it is the
pairing that will produce the complaints, and it should be chosen deliberately rather than discovered.

---

## 7. What it costs to build

**Face count is already free.** `engine.js:320` and `engine.js:688` pick a face with
`randomInt(0, special.faces.length)` — nothing assumes six. An eight-face cube works today.

**Glyphs are nearly free.** Every planet already carries a custom emoji in
`src/data/sw_racer/planet.js` for the bot side; the Activity needs eight sprites added to
`junkyard/src/activity/faces.js` the way every other face is imported there.

**The one real change is the set.** It is a flat array of ids —

```js
exports.encodeSet = set => (set || []).map(id => id || 0);              // engine.js:291
set: final.filter(c => !c.gone).map(c => (c.special ? c.special.id : null)),  // engine.js:1306
```

— with `null`/`0` meaning a plain cube. There is nowhere to hang a frozen flag, a scorched face list,
or a prisoner roster. So the set becomes **a list of cubes with state rather than a list of ids**, and
`encodeSet`/`decodeSet` learn a shape. That is one change serving three faces, and it is worth doing
once and deliberately rather than three times by accident.

**It must read back.** Live runs are persisted at `challenge/cube/live/ladders/<discordId>`, and a
profile written under the old shape has to decode as a valid set — the precedent is the road, which
shipped without a migration because `unlocked` and `clears` already described it completely.

**A plain cube needs a real face list before it can be scorched.** It does not have one — a plain cube
is `null` in the set and draws through `rollSide`. Making it burnable means it becomes what the
collection says it is: **three blue faces and three red.**

**And that is where the lean question answers itself.** `rollSide` is the one place the daily 55/45
lives, and a cube drawing off a face list never calls it — which is already true of every special in
the game. So a scorched cube leaving the lean behind is not a carve-out to write, it is what happens
when a plain cube stops being plain. Untouched cubes keep calling `rollSide` and keep drawing exactly
as they do now.

**Everything else is small:** eight new kinds need `POINTS` entries and cases in the engine's two
passes, and Malastare's lock is one flag on the ladder node beside `mult` and `carry`, cleared on a
level push.

**One thing turned out not to be small, and it was the thing dismissed as an embed problem.** The rack
screen sheds weight in tiers because discord.js throws on a description over 4,096 characters, and it
shipped measured at **4,079** — seventeen under, with a hard cut nothing was expected to reach. A
fifteenth cube wearing *eight* faces and eight tally entries costs more than seventeen characters: the
worst case landed on 4,096 exactly, the cut fired, and the die vanished off the bottom of its own rack
screen. There is a fourth tier now that drops the tallies before the cut does, and the worst case is
back to 2,949. The Activity has no such limit; the embed is still a client.

---

## 8. The unlock

Every track carries a `planet` index — `{ "name": "Mon Gazza Speedway", ..., "planet": 4 }` in
`src/data/sw_racer/track.js`. So:

> **Clear a challenge on a planet's track, earn that planet's face. Collect all eight and the die is
> assembled.**

It is the same shape as the **Red vs Blue** collection that unlocked the mode in the first place — six
pieces, one cube — which means building the die is a tour of the Galactic Podracing Circuit, self-paced
and gated on playing the game.

As built: **items 269–276**, one per planet, each carrying that planet's track indices in `track` so it
drops only on challenges raced there — Ando Prime on 2/8/17/21, Tatooine on 0/20, and so on. The
**Grand Circuit** collection in `collection.js` takes all eight and sets `effects.grand_circuit`, and
`cubeState` reads that flag through `COLLECTED` to put the die in `cubes`. Ownership lives in exactly
one place; nothing is mirrored into `cube.cubes` on claim, so there is no second copy to fall out of
step.

**It sits outside Watto's rack, and that is the point.** The rack holds seventeen picks and empties;
past that a prestige buys the stake ceiling and stops. A die earned through the challenge system does
not have to compete with the seventeen, and it gives the endgame something to be for. `OFF_RACK` in
`state.js` is what keeps it off — checked in `rewardChoices` *and* again in `grantReward`, so a stale
menu cannot spend a prestige point on a cube that was never for sale.

---

## 9. What the measurement said

`scripts/cubeOctahedron.js` asserts the invariants and prints the numbers. Every claim below survives
20,000 climbs; the EV table is 5,000 runs a rack.

**The die measures 0.69 against a bare ladder, which puts it mid-pack among cubes that already ship:**

| rack | vs bare |
|---|---|
| Wild | 1.63 |
| **the die** | **0.69** |
| Mirror | 0.58 |
| Gungan Shield | 0.47 |
| Greed | 0.34 |

Stronger than Greed and the Gungan Shield, weaker than the Mirror, nowhere near Wild. **No dial was
turned** — `seamBonus` shipped at the 0.5 it was designed at.

**Three things about that number are worth more than the number.**

**A bare ladder does not measure 1.000, and finding out why took a re-tune that nearly happened.**
Five fair coin flips paying ×32 would be exactly fair — that is what the ladder paid when this was
measured, and it is now priced at ×27.48 on purpose — but `pureBonus` pays +1× per cube on a line
that lands all one way, and a bare ladder throws those. Measured, an empty rack banks 3.03% of runs against
the 3.125% the ladder predicts, at an average multiple of **×40** rather than ×32. There is no
absolute 1.000 to compare against, so the harness measures other cubes in the same process and
normalises against them. Against a presumed 1.000 the die reads 0.59 and looks unshippable; against
the cubes that exist it is ordinary.

**The daily lean had to come out of an EV measurement, and then out of the game.** The ladder is
convex in `p`: calling the favoured side was worth **2.27** and the unfavoured **0.37**, so a player
calling at random averaged ~1.32 on a bare ladder. Worse, a sim that called in a *pattern* rather
than drawing correlated with a lean that was fixed for the whole process — measured that way the
bare ladder came out at **1.18**. The harness still draws the call from the CSPRNG; the half it used
to force `dayLean` to is now what the cube does on its own.

**The tie tax is the die's real cost and it is bigger than the design assumed.** 22–26% of rungs tie
with the die on the table, each lost 60% of the time to Watto's cube, and `boonta` only answers one
throw in eight. That is the whole of the gap between the ~1.2 the design predicted and the 0.69 it
measured. It is a price worth paying at this level, but the design's claim that "boonta closes the
loop" is *softer* than it reads: boonta closes an eighth of it.

Everything else held. Faces fire at 8.2–9.0% apiece, a scorch never takes a cube below its last face,
ice lasts exactly one throw, a plunge takes exactly two positions, the prison never exceeds four and
never holds anyone with no jailer standing.

---

## Cut on purpose

- **`sink`** — Aquilaris pulling a cube off the line and back into the bag. Cut because `sink`,
  `jail` and `plunge` are three faces spending on the same verb, and the vault is the only mechanic in
  the design that reaches the **call**, which no cube has ever touched.
- **`erupt`** — Baroonda re-throwing every side-carrying cube on the line. Cut for `scorch`, which is
  permanent, per-cube and visible where a re-throw is a one-rung shrug.
- **Malastare as a forced bank** — right instinct, wrong direction. Merciless is taking the exit, not
  handing over the money; and the forced bank re-introduces the ending the design already removed for
  coming out of a database field rather than off the table.
- **Tatooine leaning the tie-breaker 60/40** — winning the tie outright is simpler, needs no
  interaction with Qui-Gon's Nudge, and is a better story.
- **A planet face that IS a side.** It would need a planet glyph that draws as red or blue, which is
  exactly the two-glyphs-one-position failure the whole face rule exists to prevent.
