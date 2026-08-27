# The Planet Octahedron — Design Proposal

> *"We'll let fate decide."* — and then eight planets decide instead.

**Status: built, measured, not yet played by anyone.** `docs/chance-cube.md` documents what is on the
table; this documents the eight-sided planet die that now sits beside it — the rules, the reasoning,
and everything the measurement said that the design did not.

**Amended once, and the amendment is marked throughout.** Two faces were replaced — `boonta` and
`lockout`, for the **crowd** and the **blessing** — and one of §1's constraints was revised to allow
them. What drove it was `docs/behaviour-matrix.md`, which plots every face in the game by what it does
against how far it reaches: the die held four of the game's five `binds` faces, and two of the emptiest
cells on the whole grid — *nothing guards a cube*, and *nothing ever adds to one* — turned out to be
this cube's to fill. §9's numbers predate all of it and are marked where they are now stale.

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

> **Amended — this was two rules wearing one coat.** *One picture per position* is absolute and
> stands. *A face is either a side or an effect* was a consequence of it, true given the tools of the
> time, and it is no longer: a position now carries state that is not a glyph. `paintState` already
> writes `frozen`, `charred` and `burning` onto one, and the char is the proof — a charred face
> **lands, counts toward no colour, and does nothing**, which is the engine already holding "what a
> face does" and "which side it counts for" apart and setting both to nothing.
>
> So a face may now do a thing *and* count for a side, provided the side rides on the face's colour
> rather than on a second glyph. The picture says what it does; the tint says who it votes for. See
> *The third layer* in §3. The die is still sideless on all eight faces as it comes off the shelf —
> nothing paints itself, and only another die can paint one.

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
| **Malastare** | `blessing` | One cube at random cannot be destroyed this rung — a mine included. | 2 |
| **Mon Gazza** | `seam` | **+0.5** on the run's multiple for every rung already cleared this run. | 1 |
| **Oovo IV** | `jail` | Imprisons up to four cubes in its own cell. One out at the start of every turn it takes; all out if the die is destroyed. | 3 |
| **Ord Ibanna** | `plunge` | The cubes at the **head and the tail** of the line fall into the chasm. | 3 |
| **Tatooine** | `crowd` | Paints one face on each neighbour over in the colour leading the line, for the rest of the climb. | 3 |

Points follow the existing convention in `POINTS`: **3** restructures the shape of the line, **2** is
positional or otherwise moves one thing, **1** is the floor for turning up, **0** is a corpse. The
crowd scores 3 because it restructures a *cube* rather than the line, which is the more permanent of
the two; the blessing scores 2 for protecting one thing, the same as the Gungan Shield.

The die averages **2.375** against a plain cube's 1, up from 2.125 — worth about +1.4% of the stake a
throw at `pointValue`, still a sweetener rather than a second scoring axis, but a slightly richer one
than the design signed off on. It is on the list in §6 of things this amendment made stronger.

---

## 3. Ice, fire and paint

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

> **The engine diverged from this section and is being brought back to it.** At some point after
> shipping, `scorch` stopped removing the face and started leaving it in the pile to land and do
> nothing — `allFaces` and `isCharred`, added in `7df11e6b` alongside the Turbine. The reason is
> recorded at `engine.js:2298`: removing a face *concentrates the rest*, so a Wild Cube charred of a
> wild went from a 1-in-6 mine to a 1-in-5 one, and the fire made the cube more dangerous.
>
> This section already answered that — see the counterweight paragraph below — and the removal model
> is what the amendment restores. Everything in this section is true again as written. What goes with
> it: `isCharred`, `charredFace` and `lineState.charred` are deleted, and the Turbine keeps its own
> `slot.heat` rather than going back to piggybacking `burned`. The two are separate mechanics now and
> should stay that way: **a heat is consumed, a scorch is removed, and only one of them shortens the
> cube on purpose.**

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

### Tatooine — `crowd`

> The crowd backs whoever is ahead. One face on each neighbour is painted over in the colour leading
> the line, for the rest of the climb. On a tie, the crowd has nobody to back and paints the home
> colours — the side you called.

**It is the third face on the same target**, and that is why it lives here rather than with the
singles. Ando Prime holds the face a neighbour is showing, Baroonda burns it off, Tatooine paints it
over. One target, three verbs, and a player who has learned one has most of the other two.

**It paints; it does not flip.** This was the first draft and the difference is the whole face. A flip
turns the neighbours' shown sides and decides *this* rung; a paint changes the cube and decides every
rung after it. The flip version was almost free to be hit by — amplifying a lead that is already
against you costs nothing, because a loss is a loss whatever the margin. **The paint is not free**: a
cube painted the enemy colour votes against you for the rest of the climb, on a table you keep
drawing from. That is what makes the face genuinely two-way rather than a bandwagon with no downside.

**A face that isn't already that colour.** Painting the shown face would be a no-op most of the time —
the leading colour is by definition the majority of what is showing, so a neighbour's shown face
usually already matches it. It takes the shown face where that face isn't already the leader, and
another where it is. A cube already painted end to end is a real endpoint and the face passes over
it, exactly as the scorch floor works.

**Both neighbours**, matching Baroonda. Two faces of permanent change per landing is a lot over a
climb, which is the point: this is the face that makes a run's table *drift*.

**And the drift is what sharpens Aquilaris.** §4 argues that the vault costs nothing in EV and a great
deal in position, rack-dependent rather than flat. The crowd makes the rack change under the player:
a climb that keeps winning on blue ends up with a blue-leaning table, and then the vault seals blue
and shoves it onto red with a table that no longer votes for it. Two faces on one object, one loading
over a whole climb and the other pulling the trigger. Nothing about the vault changed; it just got a
partner.

**It replaces `boonta`, and the measurement is what condemned it** — see §9: 22–26% of rungs tie with
the die on the table and `boonta` answered one throw in eight, so the design's "boonta closes the
loop" was closing an eighth of it. The crowd does not close it either, but it does something on the
other seven eighths, and on the tie it hands over a permanent asset rather than a single rung.

*In the Activity:* a painted face draws its own art tinted to the side it counts for, so one position
is still one picture. See *The third layer* in §3.

### The third layer — what a face is now

The amendment in §1 is a rules change above the level of any one face, so it is written here rather
than inside Tatooine's section. **A face now has four properties, and one die face touches each:**

| | what it is | who touches it |
|---|---|---|
| the picture | what the face does | — |
| alive or charred | whether it does it | **Baroonda** removes it |
| held or free | whether it turns over | **Ando Prime** freezes it |
| which side it counts for | how the line counts it | **Tatooine** paints it |

**Storage is the scorch's, mirrored.** `burned` is a multiset of face *ids* on the slot, and which of
four identical wilds got burnt is never recorded — `isCharred` rolls it per landing at *burnt-of-that-id
over all-of-that-id*, which is the same distribution as tracking a particular one. `painted` is the
same list with a side attached, stored as `id:side` strings so the Firebase codec stays the flat string
array it already is. A cube with three Greeds and one painted blue is *each Greed landing has a
one-in-three chance of being the blue one*, which needs no new machinery and no new round-trip.

**Invert needs no rule.** It changes how the line counts, not what the cubes are — a plain cube's blue
face is not repainted red by an invert, it counts red for that roll and comes up blue next throw. A
painted face is a side on the line and gets exactly that treatment.

**A painted planet face does its thing and votes.** That only happens if a Binder or a Mirror has
duplicated the die and the copy is standing next to the original, so it is rare enough to be a story
rather than a rule, and no special case is written for it. Nothing paints itself.

---

## 4. The vault

**Aquilaris is about the buttons rather than the cubes.** The call and the bank are the only two
things a player actually decides in this mode, and no cube had ever reached either. It was a pair with
Malastare's bank lock; the amendment spent the lock, so the vault stands alone — and gains a partner
of a different kind in the crowd, which changes the table the vault then locks you out of half of.

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

---

## 5. The four singles

### Malastare — `blessing`

> Nugtosh's blessing. One cube on the line, chosen at random, cannot be destroyed this rung. A mine
> included. It never blesses the die.

**It is the only thing in the game that guards a cube.** `docs/behaviour-matrix.md` is what turned
this up: ten faces destroy something, three guard anything at all, and not one of them guards a cube —
the Gungan Shield guards a boundary, the Reroll guards the run, and `boonta` guarded an outcome. The
emptiest region on the grid, on the cube that does most of the destroying.

**One rung, and that is the whole of the balance.** The mine question answers itself once the duration
is fixed. A blessing that lasts *until spent* accumulates — a deep run holds several, mine-immunity
stops being an event and becomes a state, and the one thing that ends a run stops being real. A
blessing that lasts **one rung** cannot be hoarded, planned around or stacked, so letting it stop a
mine costs nothing and buys the best moment on the cube: *while Malastare is showing, the run cannot
end.* Under the wipe rule in `engine.js:1793` any survivor keeps the run alive, so one blessed cube is
one saved climb.

**It does not undercut the Gungan Shield.** The shield is aimable, contains a blast across a whole
flank, persists as a boundary and can be built toward. The blessing saves one cube nobody picked,
once, and cannot be planned for. Strictly worse in every respect except that it is free.

**Random rather than handed**, which is the more expensive choice and the right one. A handed blessing
is a rule; a random one is a moment, and this is the one face on the die whose whole value is the
moment.

**It replaces `lockout`, and that is this amendment's real cost.** §6 accounts for it.

### Mon Gazza — `seam`

The die's only paying face, and it is on the one axis nothing occupies. `greed` is flat, `boost` is
per-position, `mult` is conditional on a side — **none of them pay for depth.** A seam caught on a
fresh Level 2 is worth +0.5; the same face near the top of a padded road is worth +3 or more, and
then compounds up whatever ladder is left above it.

### Oovo IV — `jail`

> Imprisons up to four cubes at random, in **this die's own cell**. One walks out at the start of
> every turn the die takes. If the die itself is destroyed, they all walk out at once.

An imprisoned cube is off the line entirely — not thrown, does not count, takes no turn — but it is
**not destroyed**. The die never imprisons itself.

**The cell belongs to the die, not to the run**, which is the general rule the Scavenger's hold
follows too — see *Capture* in `tuning.js`. Three things fall out of it that the shared prison could
not do: a reflected Oovo IV brings a **second cell**, four more arrests and a parole of its own; a
prisoner keeps its ice, its scorch marks and its own prisoners while it is inside; and "destroyed"
means the cube that took them, not the last jailer standing — so with two dice on the table, breaking
one frees exactly the cubes it was holding.

The drip is the main valve and it is thematically right: you serve your way out, a rung at a time.
Without it, "released when the die is destroyed" can mean *never*, because a rack with nothing
destructive in it has no way to break a die that carries no wipeout and no mine — and four cubes gone
permanently from a five-cube table is the deadlock the design already measured at **9.6% of
full-rack runs** and engineered around.

**It drips per turn the die takes rather than per rung won**, and the difference is who has to pay
for the door. Per rung won made the release something the player bought with a survived roll, which
compounds the wrong way: the rolls a gutted table is least likely to win are exactly the ones it
needs to win to get its cubes back. Per turn ties the valve to the thing doing the holding — the die
is on the table either way, it throws every rung, and it hands one back whatever face it comes up on.
Parole runs **before** the face, so a die that rolls `jail` again pays one out before it takes four
more in, and it cannot re-arrest the cube it just released on the same turn.

The existing rule that a **won tie puts a plain cube on the table** is a second, slower valve that
costs nothing to inherit: a gutted table ties, and a survived tie feeds it.

### Ord Ibanna — `plunge`

> The cubes at the head and the tail of the line fall into the chasm.

Removes two, so it is **parity-preserving** and does not manufacture ties — which matters on a die
that is already sideless everywhere.

**And it is the key to the whole object.** The plunge takes whatever is on an end, *including the die
itself*. That single fact makes it:

- the die's **only** self-destruct path, in the absence of a wipeout face;
- the **jailbreak** — every prisoner Oovo IV was holding spills back onto the table, at once, on the
  spot, beside the cube taking the turn rather than where the die stood.

Two cruelties and one key, and the key is a cube you cannot aim. It was three before the amendment
spent the bank lock; the key got simpler rather than weaker, and it still opens the one lock the
design had to engineer the tie rule around.

---

## 6. What the shape adds up to

One trio and five singles:

```
  the shown face    Ando Prime  ·  Baroonda  ·  Tatooine
                    hold it        burn it off     paint it over
  the singles       Aquilaris      takes your call
                    Malastare      saves one cube, once
                    Mon Gazza      pays for depth
                    Oovo IV        imprisons
                    Ord Ibanna     destroys — and is the key to the prison
```

**The die's cost is now paid twice, not three times**, and that is the thing to watch. Ord Ibanna
takes cubes and Oovo IV takes cubes and hands them back slowly; the exit is no longer taken at all.
Set against that: one payer, one guard, and a trio on the shown face of which one burns, one holds and
one paints either way. Nothing on this cube shatters, so the price still has to live inside the
planets, and the amendment moved the price in the wrong direction on three counts at once —

- **a negative left** (`lockout` took the exit, and it was the house's own face: a level push is EV
  1.000, an Again push is `M → M+1`, and locking the bank until the next level marched the player
  through the only stretch of road the house makes money on);
- **a positive arrived** (`blessing` saves a climb outright, one throw in eight);
- **the points average rose** from 2.125 to 2.375.

Against which the crowd is genuinely two-way and can paint a table against its owner for a whole
climb, and `boonta`'s guaranteed tie-win is gone.

**Measured, and the die is up about four points.** See §9 — it reads **1.077** against a bare ladder
where it read 1.038 before. That is small, and it is the one figure in three sweeps that moved in the
opposite direction to every untouched cube in the same run, which is what makes it a reading rather
than noise. The mechanism is almost certainly the **tie tax**: the crowd converts a straggler to the
leading side *on the rung it fires*, which breaks ties before they happen — and §9 already names the
tie tax as the die's real cost, at 22–26% of rungs lost 60% of the time.

If that wants trimming, the dials in order are **Mon Gazza's rate**, Baroonda's target, and — new —
whether the crowd paints one neighbour rather than two.

**The nastiest combination on the die was `jail` + `lockout`** — four cubes gone and no way to leave
the gutted line — and the amendment removed it by removing half of it. What replaces it as the worst
roll is `jail` followed by `plunge` on a short table, which is two faces doing the same thing rather
than two faces compounding, and is a milder object.

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

**And the roster went on the slot in the end**, which is what this section did not foresee: a `held`
list of slots exactly like the one carrying it, so a prisoner keeps everything a cube can carry and a
captor can hold a captor to any depth. The prison was a run-level list first — a `jail` key on the
ladder node beside the set — and the shape it wanted was a slot all along, because the thing doing
the holding is a cube and everything else a cube carries already lives there. The same list is the
Scavenger's hold, which is why *Capture* is one set of rules in `tuning.js` rather than two.

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

> **Amended.** The lock and its flag come out entirely. What arrives in their place is a fourth slot
> field, `painted`, which is `burned` with a side attached and rides the same codec — see *The third layer* in §3 — and
> a per-rung "cannot be destroyed" mark for the blessing, which needs no storage at all because it
> does not survive the throw.

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
menu cannot spend a build token on a cube that was never for sale.

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

> **This paragraph is what condemned `boonta`**, and the amendment does not claim to fix it. The tie
> tax is unchanged and the eighth that was being closed is now closed by nothing. What the crowd buys
> instead is that the same eighth does something on the other seven — and, over a climb, paint reduces
> ties on its own by giving effect faces a colour to count toward. Whether that is worth more or less
> than a guaranteed tie-win is the first thing the re-measure should answer.

> **Everything below this line predates the amendment**, and was measured with `boonta` and `lockout`
> on the cube. The tie figures and the deadlock rate still stand; the EV table is superseded by the
> sweep immediately below.

### The amendment, swept

`scripts/cubeOctahedron.js 400000` — 200,000 runs a rack, the same process either side, the amendment
being the only difference between them.

| rack | before | after | Δ |
|---|---|---|---|
| bare ladder | 1.000 | 1.000 | — |
| Wild | 1.149 | 1.138 | −0.011 |
| Greed | 1.042 | 0.991 | −0.051 |
| Gungan Shield | 0.994 | 0.964 | −0.030 |
| Mirror | 0.960 | 0.957 | −0.003 |
| **the die** | **1.038** | **1.077** | **+0.039** |
| **the die in a rack** | **1.158** | **1.167** | **+0.009** |

**The four cubes in the middle are the measurement.** Wild, Greed, the Gungan Shield and the Mirror are
fielded alone, no die on the table, so not one rule touching them changed. They are what the noise looks
like — and in this run all four moved **down**, between −0.003 and −0.051, while the die moved **up**.
The magnitude is inside their spread; the direction is not, and that is the whole of the signal.

**Three sweeps, and the third is the one that moved.** The first two — the amendment with the crowd
resolving after the count, and again with the blessing made persistent — both read the die at 1.025 to
1.030 and were called flat, correctly. What changed for the third is that the crowd was moved into the
turn order, which had a consequence nobody costed: a painted position counts for its new colour **on the
rung it was painted**, so the crowd now converts stragglers to the leading side *before the count*. That
breaks ties before they happen, and the tie tax is the die's largest single cost.

So the amendment's own three — a negative gone, a positive arrived, the points average up — really do
cancel. The four points are the crowd's turn order, and they were bought for legibility rather than
balance: the face was invisible where it was.

What it cannot say is anything about how the paint plays. The harness banks at the top on a fixed call
policy and every run starts from a fresh set, so it collects the crowd's drift *within* a climb and has
no way to play around a table painted against it — which is precisely the decision the face exists to
create. That is a thing to watch on a real table rather than a thing to sweep for.

**What the faces did**, over 709,535 throws:

```
  blessing   10.28%    the only face that finds something to do on every landing
  crowd       6.85%    a third of its landings are cancelled by the die dying first
  the rest     ~8.1%   uniform, as they have always been
  78,693 faces painted over
  12,635 cubes a blessing kept on the table
```

Everything else held. Faces fire at 8.2–9.0% apiece, a scorch never takes a cube below its last face,
ice lasts exactly one throw, a plunge takes exactly two positions, no cell exceeds four and nobody is
held by a cube that isn't standing. The capture rules themselves — nesting, copies, immediate release,
the parole — are proved in `scripts/cubeHolds.js`, which owns them because they are shared with the
Scavenger rather than being this die's.

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
  exactly the two-glyphs-one-position failure the whole face rule exists to prevent. **Amended** — a
  face may now *count* for a side while drawing as itself, because the side rides on a tint rather
  than a second glyph. What stays cut is a face that is *only* a side. See §1 and *The third layer* in §3.
- **`boonta`** — Tatooine winning a tie outright. Cut for the crowd, on the strength of §9: it
  answered one throw in eight of a problem the die causes on every one, and it duplicated an outcome
  the player could already buy with a Bribe. It was also the closest legal approximation of a wild
  under the old §1 constraint — which is exactly why it read as a wild with extra steps.
- **`lockout`** — Malastare sealing the bank. Cut for the blessing, and it is the one cut in this list
  that costs more than it saves: it was the house's own face on the die and the die's third price.
  Rehousing it onto Oovo IV was considered and rejected — §6 already named `jail` + `lockout` as the
  pairing that would produce the complaints, and merging them would fire it on every prison instead of
  on one throw in sixty-four.

---

## Parked

Not cut — waiting for somewhere to live.

- **The bounty** — *pays for every cube in the hold.* It fills the one gap on the die's own row in
  `docs/behaviour-matrix.md` that nothing else does: the bag, the hold and the prison are three
  stockpiles that grow all run, and **nothing pays for them, protects them or destroys them.** It is
  also the rare payer that is anti-correlated with the run going well.

  It is not on the die, because a payer that scales with carnage sitting on the cube that causes most
  of it is a rebate on the price the die has to pay. It is not on the **Scavenger** either, which is
  the perfect mechanical fit — its own note already says *"every other cube is worth more when the run
  is going well; this one is worth exactly as much as the rest of the rack has failed"*, which is the
  bounty's thesis word for word — because "Scavenger" does not read like a bounty, and the rack is at
  sixteen cubes of six faces each, which is a shape worth protecting.

  So it waits for a **sixth tree**: a bounty wants siblings that share its axis, and *pays for what the
  run has lost* has more than one cube in it.
