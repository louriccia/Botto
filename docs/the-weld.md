# The Weld — Design Proposal

> *"We'll let fate decide."* — six faces of it, and fate picks which six.

**Status: built and measured. No screen, so nobody can press anything yet.**

The rules are implemented — `rollWeld` / `buildWeld` / `weldSpace` in the engine, `weldCubes` /
`recutWeld` / `unweldCube` in the state layer, `weldCubes` / `rerollWeld` / `unweld` in the actions,
and `POST /weld`, `/weld/reroll`, `/weld/break` on the API. Coverage is `scripts/cubeWeld.js`. What
does not exist is the **Activity screen**, so no player can reach any of it and the mode is unchanged
in production.

The earlier **pooled** prototype — a twelve-sided weld carrying every face of both parents, with a
`weldBurns` dial removing one downside face — is gone from the engine.
[§4](#4-pooling-and-why-it-failed) is the record of why it had to be.

`docs/chance-cube.md` documents what ships. This documents a prestige-point sink for the endgame past
Watto's rack, and the hard loadout cap it is built on.

---

## 1. The hole it fills

The mode currently has an endgame that stops.

**Watto's rack holds seventeen picks and it empties** — fourteen special cubes and three perks —
after which `rewardChoices` returns a shorter and shorter list and then nothing. **The stake ceiling
stops binding around prestige 7** for a typical holder, which is roughly when the rack runs dry too;
that pairing was deliberate, and §2.5 of the design doc is explicit that past seventeen "a prestige
buys the ceiling and stops."

So a player at prestige 18 is doing 153 runs a cycle for a number they cannot spend and a menu with
nothing on it. That is the whole problem.

**The currency already exists.** `applyPrestige` does `s.points += 1`, `spendPoint` takes one, and
points accumulate unspent — the API smoke test asserts *an unspent point does not block the next
prestige*. Prestige points are already decoupled from the thing they buy, deliberately, so "nothing
forces a decision at the moment the ladder resets." They simply have exactly one sink, and the sink
runs out.

The weld is a second sink for the same currency. Nothing new is minted and nothing new is counted.

> **Naming hazard.** `POINTS` in `tuning.js` is already taken — it is the per-face score feeding
> `pointValue`, the Chips half of the payout. That is a different thing from `s.points`, the prestige
> currency. The state field should stay `points` because it already exists and is already persisted,
> but every line of copy about the weld has to say **prestige point** in full, and any new tuning key
> should be `weld*` rather than `point*`.

---

## 2. The three constraints that shaped it

**A face either IS a side, or DOES a thing.** This rules out the obvious design. Stardew's ring forge
is *additive* — [two different rings combine into one with stacked effects](https://wiki.stardewvalley.net/Forge)
— and the equivalent here is a face carrying both parents' effects at once. It dies immediately: a
stacked Wild+Greed face would be a side *and* a thing, would have to draw as two glyphs, and a
position drawn as two glyphs is a position players count as two. That is the exact failure that
forced the one-glyph rule, and it is asserted over 80,000 rolls in the harness.

**One glyph, one position.** Falling out of the above: a weld needs **no new face art at all**. Every
face it throws is one of its parents' faces, drawn exactly as it already draws. This is the same
argument the Planet Octahedron made about the planet emoji already existing, except stronger — there
is nothing to draw.

**The bag is eight seats.** `bagSize()` is `cubesPerLevel * (LEVELS.length - 1)` — two cubes a level
across four drawing levels. Everything about what a weld is worth is measured against that eight.

---

## 3. What it does

Two cubes go into the press and one comes out. It takes **three faces from each**, drawn at random,
and the result is an ordinary six-sided cube that occupies one entry in `equipped`, one seat in the
bag, and one position on the line.

**Which three is not a choice, it is a roll.** That is the whole mechanic: the faces that made the cut
*are* the cube, and a weld that came out badly is a weld worth rerolling. Watto's press is not
precision equipment.

Rarely it cuts unevenly — see [§5](#5-the-splits) — and takes four from one parent and two from the
other, or, almost never, five and one.

Nothing about resolution changes. `randomInt(0, faces.length)` already draws from a list of any
length, a welded face resolves exactly as its parent face resolved, takes its own turn in the second
pass, scores its own `POINTS`, and is copied by a Mirror or a Binder like anything else.

**The guardrail is covered for free.** "A set always keeps something on it that can decide a roll"
tests a cube's own face list for `side` / `wild` / `twins` rather than checking a list of ids — which
the design doc notes means "a new cube is covered the day it is added." A weld holding a side face
passes; one holding none is treated exactly like the effect cubes it was made from.

---

## 4. Pooling, and why it failed

The first prototype **pooled** instead of selecting: a weld carried all twelve faces, so every face
came up half as often. The arithmetic was clean and it is worth keeping, because it is exactly right
and exactly beside the point.

Under a hard cap of eight seats, pooling is **throughput-neutral and risk-neutral**. Eight cubes fire
eight faces a throw; eight welds also fire eight faces a throw, each from a twice-as-deep pool. The
rate of any specific face halves and the number you can field doubles, and those cancel. Measured over
600k throws:

```
                pays    mine
  Greed         0.833   0.167      5/6 and 1/6
  greed+mirror  0.418   0.084      5/12 and 1/12   — halved
  greed+wild    0.418   0.166      5/12 and 2/12   — the mine did NOT halve
```

**Pooling is linear, so the pairing never changes the rack's total.** Welding a mine-carrier to a
clean cube halves *that seat's* mine rate; welding two mine-carriers halves neither. The number of
mine faces across a whole welded rack is whatever you started with — pairing moves risk between seats
and never out of the rack.

**And that is why it failed.** A rack's value is not spread evenly across its cubes. Wild measures
**1.310** fielded alone; Greed **0.308**, the Mirror **0.456**. Halving everything takes far more off
the cube carrying the rack than it gives back to the ones dragging it down, so a pooled rack of all
fourteen cubes measured a **third** of what a hand-picked eight left alone did. Welding was a
downgrade you paid a prestige point for — the exact failure the `+1 Special Cube Slot` pick was cut
for, arriving by a different route. (Both figures came from the broken tie path described in
[§10](#10-what-it-measured); the *ratio* is what the argument rests on and it survives the fix.)

`weldBurns` was the patch: the press removed one downside face, worst first, which roughly doubled
the pooled rack and still left it under hand-picking. **Selection replaces it entirely** — under
the selective model whether a mine survives is decided by the draw, which is more interesting than a
guarantee and needs no dial. When the engine moves over, `weldBurns` goes with it.

---

## 5. The splits

A weld is normally **3+3**. Rarely it is **4+2**, and almost never **5+1**, always favouring one
parent. Measured over 100k runs a rack, seven welds covering all fourteen cubes:

| weld shape | vs bare |
|---|---|
| 3+3 · every downside face survived | 0.427 |
| 3+3 · every downside face dropped | **2.116** |
| 4+2 · downsides dropped | *not re-measured* |
| 5+1 · downsides dropped | *not re-measured* |

**3+3 opens a 6.2× spread between a bad draw and a good one**, and that gap is the entire reason to
reroll. A perfected even rack also lands **level with** a hand-picked eight, so fielding all fourteen
and choosing your best eight are alternative strategies rather than one obsoleting the other.

**Eight-sided welds were tried and rejected.** Taking four from each spreads only 3.0× against 3+3's
6.2×, because eight faces dilute the selection back toward the average. It also cannot clean a cube
with fewer than four good faces — the Reroll Cube has three, so an eight-sided weld of it *always*
carries something that breaks it. Six faces is the shape with the variance in it.

### 5.1 Why the ceiling sits between 4+2 and 5+1

Wild has five good faces of six. A weld taking `k` of them, all good, throws wild at `k/6` against a
solo rate of `5/6`:

- **k=4** is a genuine trade. 0.667 against 0.833 — you pay wild-rate to shed the mine and gain a
  partner face.
- **k=5** is not. Same rate as solo, mine deleted, plus a bonus face. **Strictly better than the cube
  it came from.**

Which gives a rule that is arithmetic rather than taste, and covers any cube added later the way the
side-maker guardrail does:

> **A parent may never contribute as many faces as it has good ones.** `take < goodFaces(parent)`.

Wild, Greed, Shmi and Anakin have five good faces, so they can pour at most four. The Multiplier has
four, so at most three. The Reroll Cube has three, so at most **two** — it can never be the major half
of a weld. None of that was designed; it falls straight out of the existing face lists.

### 5.2 The 5+1 exception, taken deliberately

**5+1 breaks that rule and ships anyway.** Measured on the old harness a single one in an otherwise
ordinary rack came out clearly ahead of optimal unwelded play — and *stronger* than a rack made
entirely of them, because seven 5+1s means every seat is dominated by one cube and the partners stop
contributing. That ordering is structural and survives; the margin has not been re-measured since the
tie fix in [§10](#10-what-it-measured).

It is allowed because **this mode is built to reward luck.** `pureBonus` pays for a 1-in-512 sweep
that took no skill; the daily lean gives the whole server a coin nobody can read. A cube that comes
out of the press strictly better than either parent, once in a very long while, is the same idea
applied to the one part of the game a player keeps.

The argument against it is recorded rather than hidden, because it is a real one and the call could go
back the other way: **every other luck reward in the mode is per-roll and evaporates.** A pure pays
once and is gone; the lean resets at Eastern midnight. A 5+1 weld is a permanent 28% that sits on the
table for every run afterwards. That is a different category of reward, not a bigger one.

What makes it survivable is that **rarity does all the work and the currency enforces it.** At
1-in-50 welds, chasing one costs roughly 50 prestige cycles — about 7,600 runs — which is a
multi-hundred-hour goal rather than something farmed in a week. It is also self-correcting in a way
the pooled model never was: a 5+1 that draws badly keeps its parent's mine at full rate and is *worse*
than a 3+3, so the split alone is not the prize.

---

## 6. Rerolling

**A reroll rolls the whole weld** — the split and the faces together. One thing to explain, and it
puts the tension in the right place: rerolling a perfected 3+3 to chase a rare split risks the faces
you already paid for.

### 6.1 A reroll never returns what you are holding

The faces on a cube repeat, so choosing three of six positions does **not** give twenty different
halves. Wild is five identical wilds and a mine: every draw is either three wilds or two wilds and the
mine. **Two outcomes, and that is the entire space.** Counted across the seven pairings:

| weld | halves | distinct welds |
|---|---|---|
| mirror+wild | 4 × 2 | 8 |
| greed+symbiont | 2 × 10 | 20 |
| binder+shortcut | 4 × 2 | 8 |
| gungan+reroll | **1** × 6 | 6 |
| anakin+shmi | 4 × 4 | 16 |
| boost+multiplier | 3 × 7 | 21 |
| pitdroid+sebulba | 2 × 7 | 14 |

Spaces that small make the exclusion rule load-bearing, and they make one version of it **broken**.

**The rule applies to the weld as a whole, never to the halves.** Per-half anti-repeat — "each side
must change" — fails two ways on real cubes. The Gungan Shield is six shield faces, so it has exactly
**one** possible half and the rule has no legal move at all. And a `greed+wild` weld has 2 × 2 = 4
states, so forcing both halves to change makes it oscillate `(A,P) → (B,Q) → (A,P)` forever, with half
the outcome space permanently unreachable. Whole-weld exclusion keeps all three alternatives live.

### 6.2 Two, not one, and where it lives

[Stardew tracks the previous **two**](https://wiki.stardewvalley.net/Forge) enchantments on a tool so
neither is reselected, and that is the right depth here too: on a space of 8–21 it meaningfully
accelerates coverage, and on the smallest space (6) it still leaves four to draw from. It needs a
floor — `exclude = min(2, space − 1)` — so a pair with only two possible welds can never be excluded
to nothing.

**The memory lives on the weld and unwelding discards it.** That is safe precisely because the memory
is a *benefit* to the player: throwing it away is a mild self-inflicted cost, so nobody games it, and
the profile carries no per-pair bookkeeping.

Worth knowing about the prior art: Stardew's exclusion applies to tools but **not** to melee weapons,
and its roll is driven by a global counter of how many times the player has enchanted anything — so
the stream advances across items and cannot lock to one. Seeding off total welds performed would give
the same property here for free.

---

## 7. What it costs

> **Weld** two cubes — 1 prestige point. They come out as one cube carrying three faces from each.
> **Reroll** the weld — truguts, or 1 prestige point. New faces, and a fresh shot at a rare split.
> **Unweld** — free. Both cubes come back whole, and the weld is gone.

**Either currency buys a reroll**, and that is simpler to convey than splitting them across the split
and the faces. It works because of one specific choice:

**The trugut price is scaled off the stake ceiling**, not escalated per weld — the `rerollCost` idiom,
📀2,500 doubling per prestige, so about 📀2.5M a reroll at prestige 10. Two reasons:

- **A flat price means truguts always win and prestige points still have no sink**, which is the whole
  problem this exists to solve. Ceiling-pricing grows the cost with exactly the thing that makes
  truguts easy to get, so the choice stays live forever.
- **It closes an exploit the simple version would otherwise open.** Unwelding is free and welding costs
  a point, so *unweld-then-reweld is already a 1-point reroll*. Had the trugut price escalated per
  weld, that path would also reset the escalation and strictly dominate the point-reroll, making the
  point-reroll a button nobody should ever press. With ceiling pricing there is nothing to reset, the
  two cost the same, and neither dominates.

**Unwelding is free and lossy**, which is the one place this diverges from the prior art. Stardew's
ring unforge is free *and* lossless — a combined ring carries no random state, so splitting and
recombining it returns the identical ring. A weld carries a rolled selection, so unwelding hands both
cubes back whole and destroys the roll. That is what makes pairing a commitment and gives the
"settle the pairing, then perfect it" sequencing any weight — but it means the confirm has to name
what is being destroyed, because losing twenty rerolls of work on a `gungan+reroll` to a speculative
press is the one genuinely infuriating outcome available.

Purchases go on the lifetime **spend** ledger via `recordSpent`, not the loss ledger — a weld is a
price, not a wager — so `won - lost - spent` still reconciles.

### 7.1 The chase, and how long it is

Rerolls expected to reach a weld with no downside face on it, at 3+3:

```
  mirror+wild        2×        gungan+reroll      20×
  greed+symbiont     2×        boost+multiplier   25×
  binder+shortcut    2×        pitdroid+sebulba    5×
  anakin+shmi        4×
```

**Nobody designed that spread and it is the best thing about the mechanic.** Some welds perfect in two
draws; `boost+multiplier` is a lifetime project. It falls straight out of how many downside faces the
parents carry.

### 7.2 The complete rack

Fourteen cubes are weldable — `SPECIALS` holds fifteen and the Octahedron is out. So:

```
14 weldable cubes  ->  7 welds  +  the Planet Octahedron  =  8 items  =  8 seats
```

**Seven welds is a complete rack**, filling every seat with everything you own, for seven prestige
points — about seven cycles past the rack emptying, roughly 1,070 runs. The endgame gets a shape and
an end you can see from the start of it, and everything after that is the chase.

---

## 8. The hard cap of eight

**Shipped ahead of the press.** The weld is built on a cap that reverses what `chance-cube.md` §2.8
used to say — *"Nothing caps the loadout — the bag does. You may equip every cube you own."* — and
that reversal is now the live rule rather than a proposal attached to this one.

An uncapped rack was padded into a longer bag and the levels reached the first eight of a shuffle,
trading certainty for variety: a different eight every run. `equipped` is now capped at `bagSize()` on
write, on grant and on read: **the bag is exactly full, and every cube you field is one you will meet.**

**This is not the cap that was cut.** The old `startingSlots` cap was *purchasable*, one slot per
prestige, which made slots and cubes complements sold as substitutes — a slot with an empty bench did
nothing, a benched cube with no slot did nothing, and half of every prestige went on making the other
half work. A **fixed** cap has none of that in it, because it is never something you buy instead of a
cube.

It also costs the player nothing they have now: a complete welded rack measures well above today's
uncapped fourteen, so the cap takes away the shuffle and the weld gives back more than it took.

### 8.1 Two things the cap broke, and how they were settled

- **`grantCube` equipped unconditionally.** Its own comment was emphatic — a reward that arrives inert
  "is the single worst thing a reward screen can hand over," which is what happened under the old
  purchasable cap. At eight seats that guarantee cannot hold once a player owns nine cubes, so a grant
  made with the table full now arrives **benched**: it is owned, it is listed under *On the bench*, and
  the equip menu opens on the same press that spent the point. Fielding it instead would have had to
  throw off a cube the player chose, which is the worse of the two.
- **The Pit Droid lost half its justification.** Its `draw` pulls off the *back* of the bag, and the
  old rationale was that it is "the **only** way to reach the cubes the levels never get to" on an
  over-sized rack. With no overflow there is no tail, so it reverts to front-loading — still worth a
  seat, because a special met at Level 2 throws four more times than the same cube met at Level 5. The
  notes in `tuning.js` and `engine.js` say that now instead of describing a tail that cannot exist.

---

## 9. What is not weldable

**The Planet Octahedron.** The easy reason is that it is not Watto's to sell — it is assembled from
eight planet faces earned through the challenge system, and `OFF_RACK` already holds it out of
`rewardChoices` for that reason.

The mechanical reason is better. **`plunge` is the key to the whole die**: its only self-destruct, the
jailbreak that frees everything `jail` is holding, and the release for `lockout`. A weld thins every
face on it — but `jail` also drips one prisoner out per rung won, so thinning both does not preserve
the ratio between a cruelty and its key. Diluting this cube reintroduces the deadlock the road had to
engineer the tie rule around, measured at 9.6% of full-rack runs.

Enforced by `noWeld` on the cube itself rather than a list of ids, so a second unweldable cube is
covered the day somebody adds one.

---

## 10. What it measured

`scripts/cubeWeld.js` (pooled) and `scripts/cubeWeldSelect.js` (selective), 100k runs a rack, daily
lean off, call drawn rather than patterned, normalised against a bare ladder measured in the same
process.

**Two scripts, so the column is not one experiment.** Every figure is normalised against its own
run's bare ladder, which is what makes them comparable at all — but the unwelded rows come from
`cubeWeld.js` and the welded ones from `cubeWeldSelect.js`, and run-to-run noise on this estimator is
roughly **±5%** even at 30k runs. Gaps smaller than that mean nothing — which is why a perfected
welded rack and a hand-picked eight are called *level* rather than one being ahead.

| rack | seats | vs bare |
|---|---|---|
| eight cubes, unwelded | 8 | 0.452 |
| **eight cubes, hand-picked** | 8 | **2.085** |
| seven welds, every downside face kept | 7 | 0.427 |
| **seven welds, as the press rolled them** | 7 | **0.942** |
| **seven welds, all perfected** | 7 | **2.116** |
| seven welds perfected + the Octahedron | 8 | **2.272** |

**The middle row is the one that matters.** A rack taken straight out of the press measures **0.942**
— about a bare ladder, and less than half what the same cubes are worth once their cuts are chased.
So the mechanic ships as a **flat rack that rerolling inflates**, and essentially all of a weld's
value is bought rather than granted: the press hands you something ordinary and the chase is the
product.

**A perfected welded rack lands level with a hand-picked eight** — 2.116 against 2.085, inside the
noise. That is a better answer than the design was aiming for: welding all fourteen into seven seats
is *worth the same* as choosing your best eight and leaving them alone, so the two are genuinely
alternative strategies rather than one obsoleting the other. Adding the Octahedron to the spare seat
is what pulls ahead, at **2.272**.

> **Every figure in this doc was understated before 2026-08-10, and the reason is worth recording.**
> `cubeWeld.js` and `cubeOctahedron.js` answered a tie by calling `answerTie` directly — but that
> function reads the tie back off the ladder node rather than taking it as an argument, so without a
> `parkTie` first it returned `no_tie` and the harness **abandoned the run**. The stake was counted and
> the return never was, so every climb that tied was scored as a total loss.
>
> The understatement therefore scaled with how often a rack ties, which is exactly the axis welding
> moves along. Wild, which never ties, measured 1.342 before and 1.342 after; the Planet Octahedron,
> a permanent tie machine, went from **0.716 to 1.067** and stopped reading as a cost at all.
> `cubeEconomy.js` always parked correctly, which is why its ledger check never caught it.
>
> **The EV notes in `tuning.js` predate the fix and have not been re-measured.** Anything there quoted
> for a cube that ties — the Gungan Shield, the Mirror, Greed, Sebulba — is a floor rather than a
> figure.

Historic figures from the pooled prototype are not comparable to the table above and have been left
out rather than rescaled: they were measured through the same broken tie path, and re-running them
would mean rebuilding a mechanic that no longer exists. [§4](#4-pooling-and-why-it-failed) is an
argument about the *shape* of pooling, and that argument does not turn on the exact numbers.

**The tie risk was the thing most likely to kill this, and it did not.** Welded racks run ~11–12%
against 8.5–9.0% unwelded — up, but a point or two rather than the step-change feared. The reason is
structural: sideless positions scale with **seats**, and welding does not add seats. Two cubes in two
seats, one of them all-effect, contribute one sideless position in expectation; welded into one seat
they contribute half of one.

Three caveats on every number above, none of them fixable in these harnesses:

- **The Reroll Cube and the Shortcut Cube read low.** EV is `banked / staked` over independent runs,
  so banked rerolls are never spent and free clears never pay — both hand the *next* run something,
  and every run here starts from the same road.
- **There is no absolute 1.000.** A bare ladder is five fair coin flips paying ×32, but `pureBonus`
  rides on top, so the empty rack lands near 1.23 raw. Only the normalised column means anything.
- **These are collapsed roads with no Agains in them**, which is the most player-favourable route in
  the game and skips where the entire house edge lives. A 5+1 rack's edge compounds on a baseline that
  is already a faucet under this policy, and truguts are a shared economy across the whole bot. That
  is the thing to watch after release, not before it.

---

## 11. Implementation notes

**The id is the recipe.** A selective weld's faces cannot be derived from `greed+wild` alone — the
selection has to persist or the cube changes every throw. Encoding the chosen positions in the id
(`greed:0134+wild:0125`, parents sorted) keeps `specialById` a **pure function**, keeps welds
derivable with nothing extra stored, and preserves the property that an unparseable id returns `null`
and throws as an ordinary cube. Colons and plus are both legal in Firebase keys.

That also makes welds of welds free rather than forbidden — ids stay flat, so `a+b+c` needs no special
case. Stardew forbids recombining a combined ring; we do not have to.

**`specialById` builds them.** Today it is `SPECIALS.find(s => s.id === id) || null`, and that
`|| null` is already the graceful failure the cut-hybrid note recorded. Welds need it to construct on
demand: split, look each parent up, select the named faces, refuse if any parent is unknown or
`noWeld`. Cache by id — it is called once per position per throw.

**Face tallies stay keyed to the parent.** `s.faces` is `{ cubeId: { faceKey: n } }`, written by
`recordFaces`, and a greed face thrown by a weld should count on the **Greed Cube's** record. Each
welded face carries `from` naming its parent, which is what makes that work. Three reasons, and the
third decides it:

- No migration, and records survive unwelding.
- The rack screen can draw a weld as its parents' records side by side.
- Keying by the weld id would **merge Shmi's and Anakin's `side:red` tallies** — and §2.3 is explicit
  that faces are keyed by kind *and* side precisely because "that split is exactly what's worth
  seeing." A weld id would destroy the distinction the per-face record exists for.

**Naming needs no table.** Fourteen cubes give **91 pairings** and there is no writing 91 names. The
rack screen already titles every cube with all six of its faces rather than a single icon, on the
grounds that the *shape* of a cube is what you are choosing between — so a weld is titled with its
six, and its name is both parents joined. The face list says what it does; the name says what went in.

**Where the button goes.** The rack screen, not the board. That is where loadout decisions already
live, it is the screen that already lists what is on the table against what is on the bench, and it
keeps the weld out of the two control groups that are about a run.

---

## References

- [Forge — Stardew Valley Wiki](https://wiki.stardewvalley.net/Forge). Combining takes two *different*
  rings and stacks both effects; a combined ring cannot be combined again; unforging is **free** and
  splits it back into the originals. Enchantments are random, rerolled by overwriting, and a tool
  tracks the **previous two** so neither is reselected — the rule [§6.2](#62-two-not-one-and-where-it-lives)
  borrows.
- `docs/chance-cube.md` §2.5 (the rack, and what a prestige is worth once it empties), §2.8 (the bag,
  the loadout, and the one-glyph rule), and the **Cut on purpose** note on the Binder's `bind` face —
  the hybrid this is a second attempt at.
- `docs/planet-octahedron.md` — the other cube that is assembled rather than bought.
