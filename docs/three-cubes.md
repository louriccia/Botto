# Three Cubes — Design Proposal

> *"Now THIS is podracing."*

**Status: built and measured, not yet played by anyone.** `docs/chance-cube.md` documents what is on
the table and `docs/the-weld.md` what the press does to it; this documents three more special cubes on
Watto's rack, taking it from fifteen to eighteen and the rack's picks from seventeen to twenty — still
inside the select menu's twenty-five.

Coverage is `scripts/cubeThree.js`, which `cubeParity.js` deliberately does not cover, for the reason
the octahedron gives: the frozen reference engine predates these cubes, so a climb fielding one is not
a divergence in the ported rules.

They are not three more numbers on three more faces. Each one occupies an axis the shipped fifteen
leave completely empty, and §1 is the whole argument for why these three and not any other three.

---

## 1. The three holes

**Nothing grows.** Every payer in the game is flat (`greed`, +0.5 whenever it lands), per-position
(`boost`, +0.25 a cube), conditional on a side (`mult`, +1 if its colour wins) or per-rung-walked
(`seam`, +0.5 a rung). Not one of them has a memory of *itself*. A cube you have been nursing since
Level 2 pays exactly what the same cube drawn at Level 5 pays, so there is nothing on the rack a
player gets attached to and nothing whose loss is worse than its absence.

**Nothing recovers.** Ratts, wipeout, cull, raze, burn, purge, plunge, scorch and a clone writing over
a position — nine ways to destroy a cube and zero ways to get one back. That asymmetry is not an
oversight, it is a measured problem: 9.6% of full-rack runs reached a table that could not decide a
roll, and the fix was the [tie rule](chance-cube.md#28-special-cubes), which hands the player a plain
cube for surviving a 40% shot. **That rule is the game apologising for a hole in the rack.** A cube
that fills it turns an engineered rescue into something the player chose to field.

**Nothing pays for shape.** The line is a string of red and blue. Ten faces care intensely about
*position* — the Mirror reflects left onto right, the Binder copies left to right, Sebulba's engines
point, Ben eats both neighbours, ice and fire take both neighbours, the plunge takes the ends — and
the only patterns anything ever *reads* are **majority** and **all one side**. Position decides
everything about what happens and nothing about what it pays.

Everything below falls out of those three sentences.

---

## 2. The cubes

| Cube | Faces | What it does | Art |
|---|---|---|---|
| **Turbine** | 5 × `heat`, 1 × wipeout | Pays more every time it lands, and burns one of its own faces off doing it. | `anakin_eng` |
| **Scavenger** | 3 × `scavenge`, 2 × `haul`, 1 × wipeout | Pulls the last cube out of the hold and onto the line — or takes one off the line and into it. | `jawa`, `sandcrawler` |
| **Guide** | 5 × `guide`, 1 × Ratts | **+0.5** for every cube in the unbroken run of your called side touching it. | `guidearrow` |

`POINTS`: `heat: 1` and `guide: 1` — already paid on the multiple, so the floor for turning up, same
as `greed`, `mult`, `boost`, `shortcut`, `reroll` and `seam`. `scavenge: 3` — it restructures the
line, same as `draw`, which is the face it is closest to. `haul: 2` — it moves one thing, same as
`clone`, `burn` and `engine`.

---

## 3. The Turbine — `heat`

> Every heat face that lands pays **+0.5 more than the last one did** and then **burns itself off the
> cube**, for the rest of the climb.

The face list walks `5 heat / 1 wipeout → 4/1 → 3/1 → 2/1 → 1/1 → dead`, and the payout walks
`+0.5, +1, +1.5, +2, +2.5` beside it. It is the engine gauge in the game the whole mode is named
after: you hold the boost, you go faster, and the longer you hold it the closer you are to blowing
the pod apart. The Boost Cube took the name and left the mechanic on the table.

**It is exactly a d6, rolled one face at a time across a whole climb.** Heat faces leave and the
wipeout does not, so the cube is a uniform shuffle of six faces read in order until the wipeout turns
up — and the number of heats you get before it is **uniform on 0 through 5, at 1/6 each**:

| Landing | Faces left | P(heat) | Paid this landing | Paid in total |
|---|---|---|---|---|
| 1 | 5 heat, 1 wipeout | 5/6 | +0.5 | 0.5 |
| 2 | 4 heat, 1 wipeout | 4/5 | +1.0 | 1.5 |
| 3 | 3 heat, 1 wipeout | 3/4 | +1.5 | 3.0 |
| 4 | 2 heat, 1 wipeout | 2/3 | +2.0 | 5.0 |
| 5 | 1 heat, 1 wipeout | 1/2 | +2.5 | 7.5 |
| 6 | 1 wipeout | 0 | — | shatters |

So the six outcomes are `0, +0.5, +1.5, +3, +5, +7.5` at one in six apiece, for **E = +2.92 on the
run's multiple**. That is derived rather than measured and it will hold exactly; what needs
`scripts/cubeEconomy.js` is what it is worth *against the ladder*, which is a different question.

**Two things hold it down without a dial.**

**It is back-loaded, and the ladder pays the opposite way.** The multiple doubles at every level, so
a +0.5 caught at Level 2 is doubled three more times and lands worth **4**, where the +2.5 arriving at
Level 5 is worth **2.5**. The big numbers turn up where they are worth least. Nothing else on the rack
is self-limiting in that direction.

**It never carries Ratts.** It cannot end a run — its entire price is that it destroys itself, on a
schedule the player can read off the rack screen. "Two heats left" is a fact, not a feeling, and it is
the first time this game has let anyone count how much cube they have got left.

**The Pit Droid wants this cube more than any other.** A Turbine met at Level 2 gets seven or so
throws on a bare road and three times that on a padded one, so it usually completes; one drawn at
Level 5 gets one or two and pays +0.5 for the privilege. `draw` pulling off the back of the bag is
the only thing that moves a cube earlier, and the Turbine is where that is worth the most.

**A copy of a hot Turbine pays at the original's rate.** `engine.js:1202` already gives a copy the
scorch marks, so a Mirror or a Binder duplicating a four-heat Turbine hands you a face paying **+2.5**
on a cube that was never yours — and the copy burns its own list, not the original's.

**It costs nothing to build, and this is the whole reason it takes this shape rather than a nicer
one.** `burned` is already on the slot for Baroonda's scorch (`engine.js:605`), a burnt face is
already filtered out of the roll (`engine.js:616`), and the floor rule that stops a cube being
scorched past its last face already leaves the wipeout standing. So there is **no new state field**:
the payout is `heatBonus × (burned.length + 1)` and **the cube's pay is read off its own damage**. The
first draft converted `heat` faces into wipeouts instead, which needed a new operation, produced a
scruffier distribution and was worse in every way.

---

## 4. The Scavenger — `scavenge` and `haul`

> **`scavenge`** takes the last cube to enter the hold and slips it in on its right, thrown and live.
> **`haul`** takes the cube on its right off the line and into the hold.

The run currently remembers nothing about what it has killed. Corpses come off the line and that is
the end of them. But Oovo IV's prisoner roster (`engine.js:954`) already proves the run can carry a
list of cubes that are off the table without being gone — round-tripped like the bag, for the same
reason — and `draw` already knows how to insert a live cube on somebody's right. **Both halves exist;
this is a list and two verbs.**

### The hold

One list, carried by the run. **Everything that leaves the line goes into it** — destroyed cubes get
swept up, hauled cubes get carried off — and `scavenge` takes the most recent, whichever way it got
there. Order is the whole of the data structure: push on the way out, pop on the way back.

The two ways in are not the same, and the difference is one flag:

- A **wrecked** entry is a cube something destroyed. Nobody is holding it; it is lying in the hold
  because that is where scrap goes.
- A **hauled** entry is a cube the sandcrawler took. Somebody *is* holding it — and **if the Scavenger
  is no longer standing on the line, every hauled cube walks out at once.**

That release is Oovo IV's jailbreak, tested the same way (`JAILERS` reads the face data rather than a
list of ids, so `HOLDERS` costs one line) and it is R2 coming back out of the sandcrawler. It is also
what makes the flag load-bearing rather than tidy: without it, a run with no Scavenger anywhere in it
would accumulate wreckage, find no Scavenger standing, and spill the lot onto the line every rung.
A hauled entry can only exist if a Scavenger fired, so the guard is self-arming.

Wrecked entries stay wrecked. Nothing is holding them, so there is nothing to break out of.

### Why `haul` is the price, and not two wipeouts

The first draft was `4 × scavenge, 2 × wipeout` and it left the cube with a real weakness: **dead on a
clean run.** `haul` fixes that in character. Jawas do not wait for scrap, they make scrap — the
sandcrawler rolls up and takes a working cube off the line, and a later `scavenge` puts it back. The
cube becomes its own supply.

It is genuinely double-edged, which is what qualifies it as the price:

- The line is **one position shorter** for the rest of that roll, so an odd count goes even and the
  tie rate climbs on a mode where a tie is already lost 60% of the time.
- It takes **whatever is on its right**, which can be a Wild, or a four-heat Turbine, and losing that
  cube's next landing is expensive.
- If the run ends before a `scavenge` comes up, the hauled cube never comes back at all.

**One wipeout stays.** A cube with no wipeout and no mine never leaves the table, and the Sebulba note
in `tuning.js` is the record of what that does — an effect re-applied at every rung compounds against
a ladder that doubles, which is how six engine faces measured 1.64 EV at Level 5. `haul` is a cost,
but it is frequently a cost the player is glad to pay, so it cannot be the only one.

There is a loop in that last face: a Scavenger that shatters goes into the hold it reads, so a
Mirror-reflected copy can pull the original back out.

### The rest of it

**On an empty hold `scavenge` is a quiet frame**, which is a shape the reveal already has:
`mirror.nothing`, `clone.alone` and `burn.nothing` all take their turn, find nothing to do, write their
note and get a frame marked `quiet`. Points give them a floor. Same for a `haul` with nothing on its
right.

**What makes it worth a seat is not the recovery, it is the correlation.** Every other cube on the
rack is worth more when the run is going well. This one is worth **exactly as much as the rest of your
rack has failed** — dead on a clean climb, priceless on a gutted one. Eight seats have never been able
to buy a hedge, because there has never been anything in the game negatively correlated with
everything else in it.

It pairs with every wipeout-carrier that ships — the Turbine, the Multiplier, Shmi, Anakin, the Reroll
Cube, Sebulba, Boost — and with Ratts himself: a blast a Gungan Shield stopped leaves a hold with
something in it.

**It clears `spent`.** A Scavenger that returned a special as an ordinary cube would be a plain cube
with extra steps, and the whole point is that the thing you lost comes back. **It never touches the
bag.** The bag is drawn from once and never refilled, which is what makes "a cube you equipped is a
cube you will meet" true; the recovered cube arrives **on the table**, the way the tie rule's plain
cube does and for the same reason.

Dials, in the order to reach for them: last-in versus drawn at random from the hold; whether the hold
survives a level push or only a rung; and whether a returned special comes back with its scorch marks
or clean.

---

## 5. The Guide — `guide`

> **+0.5 for every cube in the unbroken run of your called side touching it**, counted outward in both
> directions from its own position and stopping at the first cube that is not yours.

Read off the **resolved** line, in phase two with the other paying faces. `🟦 🟦 🟦 [guide] 🟥` on a
blue call is **+1.5**. `🟥 [guide] 🟥` is **+0**.

**Your colour is clear track; the other colour is traffic; the arrow pays for how far it can see
before it hits some.** That is the whole rule and it is the reason the art is the in-race guide arrow
rather than anything cleverer.

**It is the pure bonus for racks that can never have one, and that is the argument for it.** A full
rack takes the Level 3 pure-5 rate from **3.11% down to 0.45%** — effect cubes hold positions without
being sides, so a player who has actually built a rack is structurally locked out of the only thing
the game pays for clean colour. `pureBonus` pays **+1× per cube for a whole clean line**; `guide` pays
**+0.5 per cube for a clean stretch**. Half rate, for a strictly easier condition.

**And the two can never be collected together**, by construction rather than by a rule: a pure needs
every position on the resolved line to be a cube on your side, `guide` produces no side, so **a Guide
on the line disqualifies the pure it is paying in place of.** They are the same reward at two
resolutions, one for each kind of rack, and there is no stacking case to price.

**It is the rack's first real combo target.** Shmi and Anakin force a side. Sebulba burns a cube over
to your call. Padmé slips in a matching pair. The Binder clones a neighbour. The Mirror doubles the
half behind it and comes back 6–2 where it went 3–1. Every one of those currently pays nothing extra
for doing it, and with a Guide on the table they are all building the same object.

**It counts both ways rather than following the point.** A Guide that read only to its right would be
worth zero from position alone roughly half the time, and this game already has enough position
lottery in it. "The clear stretch it is standing in" is also one visual object a player counts at a
glance, where "the run to its right" asks them to remember which way the art is facing — and *the line
has to stay countable* is the oldest layout rule in the mode. Both-neighbour geometry is already
established by Ando Prime and Baroonda.

**Its price is Ratts**, one face, the shape every pure payer takes — Wild, Greed, Shortcut and Reroll
all carry exactly one, and [the argument for one rather than two](chance-cube.md#28-special-cubes) is
that carry-over already charges what the second face was there to charge.

The number to measure before this ships is what it does at Level 5, where a nine-cube line can hold a
long clean stretch and the multiple has already doubled four times. If it runs hot the dial is a cap
on the run it counts, not the step.

---

## 6. What it costs to build

**Art is done.** `anakin_eng.webp`, `jawa.webp` and `guidearrow.webp` are already in
`junkyard/public/img/emojis/`. Each cube's rack icon is `iconOf()`, which picks its most common face,
so all three wear their own signature face and need nothing else. The Turbine's wipeout and the Guide's
Ratts draw as the art those faces already have.

**The Turbine needs no state at all** — see §3. `burned` carries it.

**The Scavenger needs one list on the run**, modelled on `prison`: pushed to wherever a cube leaves
the line, popped by `scavenge`, encoded and decoded with the rest of the run so a resumed board keeps
its hold. `encodeSet` already emits a bare id for a stateless slot and an object for one carrying
scorch marks or ice, so `hauled` rides along in the object form and round-trips for free.

**The Guide needs no state**, only a walk outward from its own index over the resolved line in the
payout pass, which is where `boost` already reads the whole line from.

Beyond that it is three `POINTS` entries, three cases in the payout pass, one case in the second
resolution pass for `scavenge`, and the Discord emoji for the bot's rack screen — which sheds weight
in tiers and has [hit its 4,096-character ceiling once already](planet-octahedron.md#7-what-it-costs-to-build);
three more six-face cubes is well inside the fourth tier's headroom, but it is worth re-running.

**All three are weldable.** None of them is the key to its own cube the way `plunge` is, so `noWeld`
stays a one-cube rule. A welded Turbine holds whatever heat faces the press gave it and the self-burn
operates on what it has, with no rule of its own.

---

## 7. What the measurement said

`scripts/cubeThree.js` asserts the invariants and prints the numbers. Everything below survives 150,000
throws; the EV table is 15,000 climbs a rack.

**The Turbine's distribution is exact and it holds.** Heats before the wipeout come out uniform on 0–5
at 16.3–16.9% apiece over 30,000 cubes, and the total pays **2.919** against the derived 2.9167.

**The three measure mid-pack, and the Guide is the one with a question over it:**

| rack | vs bare |
|---|---|
| Wild | 1.357 |
| **Scavenger** | **1.062** |
| **Turbine** | **1.058** |
| Mirror | 0.947 |
| **Guide** | **0.763** |
| Greed | 0.682 |

The Turbine and the Scavenger land just above the Mirror and nowhere near Wild, which is the right
neighbourhood and needed no dial — `heatBonus` shipped at the 0.5 it was designed at. The Guide sits
between the Mirror and Greed, which is low for a cube that also carries a mine. **The dial is the
mine, not the bonus**: `guideBonus` is pinned to half `pureBonus` by the argument in §5 and the
harness asserts the ratio, so the honest correction is a wipeout in place of Ratts rather than a
number nobody can justify.

**Fielded together they measure worse than any of them alone** — 0.805 for the three and 0.784 for the
three in a full rack, against 1.058 and 1.062 individually. That is the **tie tax** the octahedron
measured, and it is the standing cost of the design rule rather than anything these cubes do wrong: a
face is a side or it does a thing, so every effect face takes a cube out of the count without
shortening the line, and a tie is lost 60% of the time. Three sideless cubes is a lot of even counts.
It is worth recording because it is the opposite of what a player will assume when they field all
three, and because it is the number that would move if the tie-breaker's 60/40 ever did.

**The hold stays small.** Four cubes deep at the worst over 20,000 climbs on a Scavenger rack, which is
what the sweep taking only the line *as thrown* buys: a runaway throw cannot fill it with cubes nobody
ever owned.

---

## Cut on purpose

- **Baroonda cooling a Turbine.** The first draft claimed a scorch could burn a wipeout off it. It
  cannot: a scorch takes the face a neighbour *landed on*, and a cube that landed on its wipeout has
  already shattered. There is no wipeout standing there to burn. Ando Prime does not rescue it either —
  a freeze holds a cube on the face it is showing and gives it no turn, so freezing a Turbine stops it
  paying. The Gungan Shield already holds a neighbour together through a wipeout and that is the whole
  of the wipeout-survival story.
- **A face that touches the stake.** The stake ceiling *is* the prestige reward — it is the only thing
  a prestige guarantees once the rack empties. A cube that raised it would be selling the thing
  prestige sells.
- **A face that hands the player a choice mid-reveal.** The reveal is three uninterrupted seconds and
  [§2.2](chance-cube.md#22-how-a-roll-plays-back) is right that it should stay that. Every decision in
  this mode is made before a roll or after one.
- **A face that reaches the bench.** `draw`, `purge` and a bench-tutor are three faces spending on the
  same verb, which is exactly why [`sink` was cut from Aquilaris](planet-octahedron.md#cut-on-purpose).
- **A one-directional Guide**, and **`Sandcrawler` as its art** — a slow train overtaking Sebulba is a
  funny picture for a cube about long runs, but the arrow keeps three visual families clean: the pod,
  the desert, the track. The sandcrawler went to the Scavenger's `haul` instead, which is what it is
  actually a picture of.
- **One hold with no flag on it**, spilling entirely when the Scavenger dies. A better story and a
  broken rule: wreckage fills on every run whether a Scavenger is fielded or not, so the release
  condition would fire on the first destroyed cube of every climb in the game. See §4.
- **A `strip` face that destroyed a neighbour into the hold** rather than storing it. It says the same
  sentence as `haul` and throws away the half that makes the cube interesting — the reversibility is
  the whole idea, and a Jawa that only breaks things is a Tusken.
- **Anything aimed at the shared-object gap.** [§2.6](chance-cube.md#26-whose-board-it-is) names it and
  it is still open, but a cube cannot fill it: whatever replaces the daily lean has to be visible to a
  whole channel without being farmable by one, which is a feature rather than a face.

---

## References

Prior art consulted, beyond what `chance-cube.md` already lists:

- [Guide: Scaling](https://balatrowiki.org/w/Guide:_Scaling), Balatro Wiki — the Glass Joker scales off
  Glass Cards destroying themselves, and Glass Cards self-shatter for a bigger payout. The Turbine is
  both objects fused into one, so the thing that scales and the thing that breaks are the same cube.
- [Dice Forge rules](https://www.ultraboardgames.com/dice-forge/game-rules.php), UltraBoardGames — a die
  whose faces are physically removed and replaced over the course of a game. The Turbine is that with
  no shop: it spends its own faces.
- [Symbols](https://luck-be-a-landlord.fandom.com/wiki/Symbols) and
  [a general guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2404409704), Luck be a
  Landlord — *adjacency is the strongest thing in the game*, on a board that is nothing but adjacency.
  The Guide is that lesson in a two-symbol alphabet.
- [The Forge](https://wiki.stardewvalley.net/Forge), Stardew Valley — already the weld's prior art;
  cited again here for the reclaim, which is the half the press does not do.
