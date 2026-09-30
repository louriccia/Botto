# Interaction Revisions — Triage Of The Matrix Notes

**Status: §2 and §4 are built, bar §4.4b.** It takes the notes written against
`docs/face-interaction-matrix.md` and sorts them into what the engine already did, what has now been
changed, and what is still open.

- **§1** — four notes that needed no change, and the small gaps found while checking them.
- **§2** — five rulings, **implemented** in `src/game/cube/engine.js`, with §4.1 folded in because
  §2.4 could not ship without it. Verified; see §6.
- **§4.1, §4.2, §4.3, §4.6** — **implemented.** The dome is the largest single change here, and
  the largest mover in the re-priced book.
- **§5** — the whole side-bet book **re-measured, re-priced and re-banded** at 40,000 climbs.
- **§4.7** — cubes are **named instances**, so two identical cubes are two cubes on the wire.
- **§4.4** (the Scavenger's repair rider) and **§4.5** (a persistent `mirrored` status) are **implemented**.
  **§4.4b**, faces that repair, is still open.

Vocabulary, because three of these names are not in the engine:

| Note's word | Engine kind | Note |
|---|---|---|
| **Flamejet** | `burn` | The Binder's right-hand kill |
| **Singe** | `scorch` | Baroonda. The client renames `burned` → `singed` |
| **Electrocution** | `clone` at the head of the line | The `clone.destroy` branch |
| **Turning faces** | `invert`, `engine:left`, `engine:right` | The `turns` act |

---

## 1. Already true — four notes need no change

**Turning faces cannot affect frozen cubes.** `invert` skips a frozen position and keeps the ice;
`engine` reports `engine.iced` and keeps it too. Neither spends the freeze, which is the intended
half — a turn is not worth a freeze.

**Ben's wings are silently discarded between rungs.** `set` is built from
`final.filter(c => !c.gone)`, so a wing never reaches the next throw. No cleanup step is needed and
none exists.

**Oovo IV's parole is one per rung, and a jailbreak dumps everyone to the right of the active cube.**
Confirmed, with two deltas from the note:

- Parole fires **at the start of every turn the octahedron takes**, whatever face it is showing —
  not on a timer. So a rung in which the die is frozen, or has already left the line, paroles nobody.
  If the intent is *four rungs, come what may*, that is a change.
- It is **not silent**: the release emits a `parole` note and its own playback step. "Silently" may
  just mean *without the player choosing it*, in which case this is already right.

**A scavenged cube keeps what it had.** The wreckage sweep copies the slot, so `burned`, `painted`,
`blessed`, `heat` and `held` all survive salvage. Two gaps, both small:

- The copy was **shallow** — `{ ...c.slot }` — so `burned`, `painted` and `held` were shared by
  reference with the dead slot. Harmless today because nothing touches a dead slot, and a latent
  aliasing bug the moment something does. **Fixed**: `keepSlot` deep-copies the arrays and the cell.
- `liftOne` **re-rolls the face** and ignores `slot.frozen`, so a cube salvaged while frozen rolls
  fresh on the rung it comes back into and serves its held face the rung *after*. **Left alone** —
  it is a behaviour change rather than a bug fix, and the notes did not ask for it.
- Prisoners are the exception by design: a captor that dies releases everyone through `hold.break`
  *before* the sweep, so what gets salvaged is an empty cell. That is correct and should stay.

---

## 2. Decided, and what each one costs

### 2.1 The whole Binder is immune to Singe; Flamejet is immune to Flamejet

`scorch` skipped `burn` only. The skip now covers `clone` as well, and `burn` refuses another `burn`.

**Closed cube-wide in both directions.** It shipped face-wide first — Flamejet refusing another
Flamejet but happily taking an Electrocution — which is literally what the note said and is the kind
of asymmetry this whole exercise exists to catch. The Binder cannot burn or singe the Binder. One
condition, and the cube now reads as one object rather than as two faces that happen to share art.

### 2.2 Malastare covers Singe and Electrocution

Two `spend()` calls, both in: one in the `scorch` target loop, one in the `clone`-at-head destroy
branch. The second closes the asymmetry the matrix flagged — the only destruction a blessing could not stop.

The first is a genuine widening of what the blessing *means*. It stops being "answers destruction"
and becomes "answers harm", which immediately raises the three it still would not answer: `crowd`'s
paint, `freeze`'s ice, and capture by `haul` or `jail`. Recommend holding the line exactly where the
notes put it and writing the rule down as: **the blessing answers anything that takes a cube off the
table or takes a face off a cube. It does not answer anything reversible.** Paint, ice and capture
are all reversible or additive; destruction and singe are not.

### 2.3 Ice stops being a ward

Ice was spent to spare the cube against `mirror`, `clone`, `burn`, `cull`, `raze` and `scorch`. The
note keeps fire and drops the rest:

| Effect | Today | After |
|---|---|---|
| `burn` (Flamejet) | ice spent, cube spared | **unchanged** — thaws |
| `scorch` (Singe) | ice spent, cube spared | **unchanged** — thaws |
| `mirror` | ice spent, position spared | overwrites through the ice |
| `clone` | ice spent, cube spared | destroys/overwrites through the ice |
| `cull` (Tusken) | ice spent, shot wasted | shoots through the ice |
| `raze` (Ben) | ice spent, that side spared | flattens through the ice |
| `end`, `purge`, `plunge`, `haul`, `jail` | already through | unchanged |

In code it was mostly deletion. `warded()` is now the burn's alone; `cull` and `clone` use a new
blessing-only `blest()`; `mirror` and `raze` call `spend()` directly. `invert`, `crowd` and `engine` keep bouncing off frozen cubes without spending anything
— those are turns and paint, not damage, and §1 says the notes want that kept.

### 2.4 A frozen face still pays

The `c.frozen` check is gone from the scoring pass. A frozen Greed, Multiplier, Boost, Guide, Mon Gazza,
Shortcut or Reroll all count. A frozen cube already counts for its colour, so this makes the rule
whole: **ice suspends the turn, not the cube.**

**`heat` is the exception, and §4.1 rules on it**: a frozen Turbine pays but does not advance
`slot.heat`, so the ice holds the face against its own schedule.

### 2.5 A Ben wing takes effects, and is a cube when it has a colour

Six effects skipped `gone` positions: `freeze`, `scorch`, `crowd`, `haul`, `jail`, `blessing`.
Removing the exclusion deletes the special cases and makes a wing an ordinary position for the rung
it exists in.

Built for `freeze`, `scorch`, `crowd` and `blessing`, and for `haul` and `jail` in the narrow
sense set out below.

**And a wing is a cube when it has a colour.** Ben cuts his wings out of himself, so they are cut in
whatever he is wearing: paint him and all three positions come up matching. Those three **vote in
the majority, pay, extend a Guide's run, feed the crowd's leader count and can be turned one at a
time** — there is nothing left to tell a coloured wing apart from any other coloured position, and
the gate is the colour rather than the rubble.

A **bare** wing is still a hole. No colour, no vote, and it breaks a sweep exactly as it always did.
So `isCube` and the Guide's `ours` stopped testing `gone` and now test only the side, which is the
same gate every other position answers to. The `gone` flag keeps its one real job: **a wing is
dropped from `set` before the next throw whatever colour it is wearing**, so this is three positions
for one roll and never a cube you own.

**Inherited once, at the cut, and never again.** The wings are ordinary positions afterwards — a
crowd or an engine reaching one changes that one and leaves the other two alone. An earlier pass of
this document tied the three together at render time so they always matched; that was wrong, and it
is gone. Anything that kept them married would be a fourth kind of position, and the line is read on
the rule that a position is a position.

**This is the largest EV mover in §2.** A painted Ben flips from destroying two cubes to fielding
three of your colour, and three matching positions are a `swept` line, so it reaches `pure`, `sweep`
and `landslide` at once. The crowd gains a use it did not have — painting rubble is now worth a
landing. §5 applies with force.

**`haul` and `jail` take rubble and keep none of it.** The grab lands — the position clears — but
nothing goes into the hold.

The reason is a fact about the slot rather than a design preference. **Wing-ness lives on the
position, never on the slot**: a wing's `slot` is a bare `plainSlot()` with no id and no marker, and
`slotOf` rebuilds a fixed set of keys, so there is nothing on it that could say what it was. A wing
put into a hold is therefore laundered *at capture time* — what walks out on a parole or a
hold-break is an ordinary cube nobody owned. Scrubbing held wings before the next roll cannot work,
because by then there is nothing left to recognise.

Two ways to make holding a wing legal, neither built:

- Give the slot a `razed` flag and carry it through `slotOf`, `plainSlot`, `encodeSet` and
  `decodeSet`, scrub at the end of the roll, and reconstitute a wing freed mid-rung as a wing rather
  than as a cube. About seven touchpoints, and it buys the same end state.
- Take and destroy. *(what ships)* One condition each in `haul` and `jail`, no new state, and
  laundering is impossible rather than merely cleaned up afterwards.

The prison's warrant is spent either way: a wing takes one of the four and gives the cell nothing
back, so **Oovo IV landing beside a wide Ben arrests less than it looks like it did.** `jail`'s note
now carries `scrapped` alongside `taken` so the two can be told apart.

---

## 3. The through-line these notes are drawing

Four of the decided items are the same idea arriving four times, and it is worth naming because it
makes the next fifty rulings answer themselves:

> **Ice is about persistence. The blessing is about harm. They are not two grades of the same shield.**

After §2.3 and §2.4, being frozen means exactly: *this cube holds the face it is showing, takes no
turn, and is otherwise an ordinary cube* — it counts, it pays, it can be destroyed, painted around,
captured, jailed. The only things that undo it are the two fires.

That is a much better mechanic than a half-strength Malastare, and it also answers the matrix's
finding **A**: the reason no two ward columns agreed is that the ice was being asked to be a ward at
all.

After this there are **two** ways a cube survives something, and they are told apart by shape rather
than by strength:

| | What it is | What it answers |
|---|---|---|
| **The blessing** | A charge on one cube, spent once | Anything that takes a cube off the table or a face off a cube |
| **The dome** (§4.3) | A boundary around three positions | Anything that would have to *cross* it, in either direction |

Two rules a player can hold in their head, instead of seventeen rows that disagree. Ice is on neither
list, which is the point.

---

## 4. The four forks, answered

### 4.1 `heat` while frozen — **pays, does not burn off**

The ice protects the face from its own schedule. A frozen Turbine pays its current step and **does
not advance `slot.heat`**, so it pays the same amount again next rung and the face is still there.

This is the only reading under which *the ice holds the face you are looking at* stays literally
true, and it hands Ando Prime a real combination: freezing a hot Turbine banks its best step for a
rung. Implementation is one line — the scoring pass writes `c.slot.heat = spent` only when the cube
is not frozen.

### 4.2 Turning a chance cube and turning a painted face are two different things. **Built.**

**The ruling, and the distinction that matters:** a *regular chance cube* — the plain red-and-blue
die, no special — and *a special cube's face that Tatooine has painted* are not the same target, and
a turn does something different to each.

| Target | What `invert` and `engine` do | Does it last? |
|---|---|---|
| A **chance cube's own side**, unpainted | Rerolls it into the opposite colour | **No.** The cube is unchanged; next rung it rolls 3/3 as always |
| A face that is **already painted** | Changes the paint to the opposite colour | **Yes.** The mark is permanent, so rewriting it is permanent |
| An **unpainted effect face** | Nothing — it has no colour to turn | n/a |
| A **wild** | Nothing — it re-settles to your call every throw | n/a |
| A **frozen** cube | Nothing, and the ice is not spent | n/a |

**Sebulba does not paint a regular chance cube side.** He flips it for the throw, exactly as today.
He only writes when there is already a mark to rewrite.

This is much smaller than the first pass of this document, which read the note as *turning always
writes paint* and then worried at length about `invert` permanently recolouring a whole line off one
Mirror face. That worry was mine and it is gone: turning a plain line is temporary, so `invert`
keeps today's balance, and the only permanent turns are on faces Tatooine had already painted. The
buff is bounded by how much paint is on the table, which is a thing the player can see.

**There is still a real bug underneath it.** Both faces set `x.paint = null` on the throw and never
touch `slot.painted`, so on a painted cube the turn is undone by the next `throwSet` — the mark comes
straight back and the cube reverts. That is what "repaint the face if needed" fixes: the turn should
**rewrite** the mark in `slot.painted` from `<id>|<old>` to `<id>|<new>`, not clear it. "If needed"
is the no-op case — a mark already the target colour is left alone, which for `engine` is the
existing `engine.already`.

**Built as `turnTo`, shared by `invert` and `engine`.** A turn on a painted face rewrites the mark
in `slot.painted` instead of clearing `x.paint`, so it survives the next `throwSet`. Turning a face
back to its *own* colour removes the mark rather than stacking a second one over it — a red side
painted blue and then turned red is just a red side again. Both notes now carry whether a repaint
happened (`engine.repainted`, and a count on `invert`).

**A chance cube is not a special case, and an earlier pass of this document said it was.** That pass
carved painted plain cubes out of the repaint, because `throwSet` handed a plain cube back with
`face: null` — it rolled a real face, computed the paint from it, and threw the face away one line
later, so there was no key left to move the mark under. That was a limitation being worked around
rather than removed.

`throwSet` and `frozenCube` now keep the face on a chance cube **that carries a mark**, so a painted
chance cube repaints exactly like a painted Greed. An *untouched* one still comes back faceless on
purpose: nothing has happened to it, its six sides are interchangeable, and rolling a face object for
it would put a `side` note on every plain position on the table for no information. A cube becomes
fully identified at the moment it stops being interchangeable.

One property falls out of the difference between the two. A chance cube's face has a natural colour,
so turning a painted one always means *back to its own colour* and the mark is **removed**; a
special's face has no colour of its own, so there the mark **moves**. Same rule, two outcomes.

**The edge case — one regular face and five painted the same colour — needs one more decision.**
Under per-face resolution it does not arise: the rule is read off the face that is *showing*, and
nothing searches the cube for a face of the opposite colour. But "reroll the chance cube into an
opposite colour" can also be read literally — the die re-lands on a face of the other colour — and
then a cube whose six faces are all effectively one colour has nowhere to land. If that literal
reading is what is wanted, the failure mode has to be named: the turn finds nothing and the cube
stands, or it falls back to painting the face it is on. **Not blocking** — per-face resolution is
the assumption until told otherwise, and it needs no failure mode.

### 4.3 The Gungan Shield — a dome, not a wall. **Built.**

> **A Gungan Shield encloses itself and both its neighbours. Nothing crosses the boundary, in or
> out. Only a cube inside the dome can destroy the shield.**

The three unrelated jobs collapse into one sentence, and the weird wipeout save disappears without
needing a rule of its own: a Wipeout is a cube coming apart where it stands, so it never crosses
anything and the dome has nothing to say about it. The free save, the re-face and the bonus turn are
all gone, along with `shieldSpan` and `refaced`.

**A bubble, not a barricade**, and that distinction is the biggest single behaviour change. A dome
protects what is under it and does **not** block passage past it — so a Tusken outside can now shoot
clean *over* a dome to a position on the far side, where the old shield cast cover down the whole
line behind it. The rule cuts both ways: a Tusken standing **under** a dome can only shoot what is
under it with him.

**It gates what an effect can change, never what it can see.** A reflection may copy a cube that is
sheltering under a dome, because copying it alters nothing there; what it may not do is write onto a
position across a wall. One check at every destination, and reads left alone, is what keeps this to
a single predicate rather than a second table of exceptions.

Implementation is `domesAt(k)` and `reaches(i, j)` in place of `shieldSpan`, consulted at fourteen
sites: `mirror`, `invert`, `end`, `burn`, `clone`, `cull`, `raze`, `haul`, `purge`, `engine`,
`freeze`, `scorch`, `jail`, `crowd`, `blessing` and `plunge`. New notes: `burn.walled`,
`clone.walled`, `haul.walled`, `engine.walled`, and `mirror`'s note gains a `walled` count.

The five open questions from the first pass, as built:

1. **Line-wide faces are stopped.** `purge`, `plunge`, `invert`, `jail` and `mirror` cannot reach
   under a dome. This is a large buff and it is the point — a shield is now the only answer Order 66
   has ever had, which is finding **B** of `docs/behaviour-matrix.md`.
2. **Good effects are stopped too.** A blessing or a salvage from outside cannot reach in. One rule
   beats two.
3. **Overlapping domes share.** A position can stand under more than one, and a reach is legal when
   actor and target share at least one.
4. **What kills it**: only something already under it. With two plain neighbours a shield is
   untouchable for that rung — acceptable, because the line reshuffles every throw.
5. **The edges**: a shield at the head or tail covers two positions instead of three.

**Two consequences worth stating.** A mine no longer *absorbs* against a shield, because there is no
shield left in the way to absorb it — a mine inside a dome takes the Gungan with everything else, and
one outside never reaches in. So a shield killed by a blast is now an ordinary victim: wreckage a
Jawa can pull back, rather than a shatter spent for the run. And a Tusken can now come up with
nothing at all to shoot, boxed in by domes he is not under.

**The `saved` side bet is deleted and replaced, and the replacement had to be re-priced rather than
inherited.** `saved` paid on `broken.saved`, which the engine no longer emits — a card that cannot be
won is a trap, not a long shot. Its replacement `walled` pays when a dome turns something away, and
that is **not** a rare event: `cubeSideBet.js` measures it at **26.9%** at the best rack and level,
which prices at +6.2. So it ships at **6 in the middle band**, not at `saved`'s 24 in the long band.
Carrying the old price across would have been a faucet of exactly the kind `tuning.js`'s header
warns about — a 24 payout on a better-than-one-in-four event.

### 4.4 Repair — a rider on the Scavenger. **Built.**

**Going looking for what a repair face would repair narrowed the problem to almost nothing.** Only
three things are ever written permanently to a cube: `slot.painted`, `slot.burned` and `slot.heat`.
Of those, **paint has been reversible since §4.2** — `turnTo` moves or removes a mark, which was the
first thing in the game to undo a permanent change and which neither document had noticed. **Heat is
not damage**: spending a heat face is how the Turbine pays more, so healing it would be a nerf. And
**ice is not damage either**, not since it started holding face and place and paying.

So there is exactly **one irreversible harm in the game: Baroonda's singe.** A whole face dedicated
to undoing one other face would be dead most games — it needs a singed cube to exist first, which is
the trap-card problem wearing a different hat.

**So it is a rider rather than a face.** `liftOne` takes a `mend` flag, and the Scavenger passes it:
a cube dragged out of the wreckage comes back with one burned face healed. It can never be a wasted
landing, because it only happens when there is something to salvage; a Jawa repairing what it
recovers is the right story; and it gives the Junker tree an identity past "lose less of it".

**The flag is the Scavenger's alone.** A parole and a hold-break come through `liftOne` too, and
neither is salvage — a prisoner walks out as the cube it went in as, singes and all.

### 4.4b Faces that repair — the rest of the shield answer

The note's second half — *other faces that fix breaking or damaged cubes* — is finding **H** of the
behaviour matrix stated as a feature: **nothing in the game has ever added anything to a cube.**
Outside the rack a cube can only get worse.

Three shapes, cheapest first, none of them specced yet:

- **Unsinge** — hands a cube back one face Baroonda burned off. Reads straight off `slot.burned`, so
  it is nearly free to build, and it is the exact inverse of an existing mechanic.
- **Thaw / scrub** — clears ice, char or paint off a neighbour. Cheap, and after §2.3 ice is no
  longer a ward, so removing it is a real favour rather than a mercy.
- **Repair** — pulls a cube out of the wreckage and puts it back whole. This is the Jawa's job
  already; the difference would be that salvage restores rather than merely returns.

Worth its own pass once the shield lands, since the two were proposed together and a dome plus a
repair face is a coherent Junker identity.

### 4.5 A persistent `mirrored` status. **Built.**

**A reflection now turns the cube, not just the picture.** Handedness is everywhere in this game —
seven faces have one: `burn` and `haul` reach right, `clone` reads left and writes right, `engine`
points, `mirror` writes left to right, `draw` and `scavenge` seat what they bring on the right — and
none of it could ever change. A reflection turned the handedness of the *face being shown* and
nothing else, so a reflected Sebulba pointed the other way for exactly one throw and then forgot.

`slot.mirrored` is one boolean that all seven read. A mirrored Binder burns its left and clones
rightward; a mirrored Sandcrawler carries off its left; a mirrored Mirror reflects the cubes in front
of it onto the ones behind. **The status is an involution** — reflecting a mirrored cube turns it
back, so a reflection of a reflection is the cube you started with.

**The uid work paid for this.** Slots already encode as objects, so the status costs one optional
field on the wire; before §4.7 it would have forced exactly the encoding change that work already
made.

One trap worth recording: `resolveLine` keeps a local `handed` counter for the turn queue, which
silently shadowed a module-level helper of that name — a `TypeError` at one call site inside the loop
and nowhere else. The helper is `flipped`.

### 4.5b The original proposal

Unchanged from the first pass: the largest item in the notes, a feature rather than a ruling, and the
direct answer to finding **F**. Today only the shown face's handedness flips, through `face.mirrored`
and `face.dir`. A flag on the slot would flip the cube's whole behaviour for the rest of the climb,
reaching `engine`, `burn`, `clone`, `haul`, `mirror`, `draw`, `scavenge` and Ben's wings.

Needs `mirrored` through `slotOf` / `encodeSet` / `decodeSet`, a read at every handed site, and a
drawing in the client or it is invisible state. Recommend it stays after the rulings above.

### 4.6 Where a frozen cube stands — it holds its place in the order. **Built.**

`throwSet` shuffles only the unfrozen slots, and deals them into the unfrozen positions. **Relative
order, not absolute index**, so the line can still grow and shrink around a held cube.

Three reasons, and after §2.3 the third is the important one. It is the only reading under which
"frozen" means frozen. It makes ice combine with every positional face at once — hold a wild inside
the Guide's run, hold a cube inside Ben's reach, hold a shield where the blast is coming from. And
since stripping ice of its defensive job leaves it thin, position is most of what is left to give it.

---

### 4.7 Cubes are named instances. **Built.**

`SPECIALS` is the class — one shared, immutable definition per cube — and a slot is one cube built
from it, carrying the state that makes it itself. That much was always true, and identity-by-
reference was already load-bearing: `liftOne` insists on the slot itself rather than a copy, and the
end-of-roll sweep works out what left the table by comparing references.

**What a slot did not have was a name.** A reference does not survive Firebase and does not survive
`throwSet`, which reshuffles every rung on purpose — so past either boundary the only thing
identifying a cube was its position in an array, and two Greed Cubes side by side were genuinely
indistinguishable to anything downstream.

The reason was visible in `encodeSet`'s own comment: slots were retrofitted onto what had been a bare
array of type ids, and kept encoding as bare ids so the upgrade would ship "without a migration in
either direction". That shortcut is exactly what kept instances anonymous, and it is gone.

| | |
|---|---|
| `uid` minted in `slotOf` and `plainSlot` | Minting on read **is** the migration — a set stored before this decodes into named cubes the first time it is picked up |
| `encodeSet` always writes an object | The rule it was really protecting still holds: Firebase deletes nulls, so a plain cube's id encodes as `0`. `decodeSet` still reads the legacy bare form |
| A copy is a new cube | `turned` mints a fresh name, and `cloneHeld` gained a `fresh` flag — a reflected Oovo IV arrives with its own prisoners |
| Wreckage keeps its name | `keepSlot` preserves it, so a scavenger hands back *the cube you lost*, not one like it |
| `lineState` carries `uids` | Position for position. The client can tell two identical cubes apart, and follow one across a shuffle |

**Two notes gained targets with it.** Of every effect that hits a position, only five carried
`hitAt`. `burn`, `clone`, `haul` and `engine` are inferable from a fixed direction — but `scorch` and
`crowd` hit *one or both* neighbours and reported only a count, so hitting one of two identical cubes
said nothing about which. Both now carry `at` and `hitAt`.

**Still open here:** the bag is bare ids, so a cube becomes an instance when it is drawn rather than
when it is bought. If a specific Greed should be *the* one that comes out, that is a separate call.

---

## 5. The book, re-measured and re-priced

**Done.** `scripts/cubeSideBet.js` was run at 40,000 climbs across all seven racks, and every price in
`SIDE_BETS` is now the fair net return at the highest rate any rack reached at any level, rounded
down to the half — the rule the file's own header states.

**22 of 30 cards had drifted off it.** Sixteen were paying *more* than the odds now justify, which is
the faucet this branch is named for; six were paying less.

| | Card | Was | Now | Peak rate |
|---|---|---|---|---|
| **Overpaying** | `raze` | 18 | **16** | 11.2% |
| | `crowd` | 30 | **28** | 6.6% |
| | `cull` | 18 | **16.5** | 11.0% |
| | `sweep` | 54 | **52.5** | 3.6% |
| | `pair`, `grow` | 8.5 | **7.5** | 22.3%, 22.5% |
| | `purge` | 19 | **18** | 10.2% |
| | `planet`, `shortcut`, `draw`, `invert`, `mirror`, `scavenge`, `carnage`, `jail`, `plunge` | | −0.5 each | |
| **Underpaying** | `engine` | 34 | **44** | 4.3% |
| | `blessing` | 20 | **23.5** | 7.9% |
| | `holdbreak` | 19 | **21.5** | 8.6% |
| | `haul` | 11.5 | **13.5** | 13.3% |
| | `reroll` | 5.5 | **6.5** | 25.5% |
| | `tie` | 5.5 | **6** | 27.2% |

`walled` measured 26.6% and priced at 6, confirming the figure it shipped with.

**The four biggest moves are all the dome**, and they are worth reading as one result rather than
four. `engine`, `blessing` and `holdbreak` all became *rarer* — Sebulba cannot turn what shelters
under a dome, a blessing cannot reach in, and a prison cannot arrest through one. `crowd` and `cull`
moved the other way for the same reason: the Tusken now shoots over a dome instead of being stopped
dead by it, so he finds a victim more often than the old rule let him.

**A correction to what §2.5 predicted.** That section calls the coloured-wings change "the largest EV
mover" and warns it would push `pure`, `sweep` and `landslide` hardest. The measurement does not
support that: `pure` and `landslide` did not move at all, and `sweep` came down by 1.5 — less than
`raze` or `crowd`. A painted Ben fielding three matching cubes is real, but it is rare enough at the
rack level that it never became the ceiling for any of those three cards. The dome was the larger
mover by some distance.

**The bands were rebalanced, and it came to exactly one card.** Sorting all thirty by measured rate
showed the grouping was already monotone apart from `reroll`, which at 25.5% sat in `likely` below
both `walled` (26.6%) and `mirror` (26.4%) in `middle`. It moves down. Nothing else needed to.

| Band | Cards | Rate range |
|---|---|---|
| `likely` | 8 | 27.2% – 57.1% |
| `middle` | 12 | 13.3% – 26.6% |
| `long` | 10 | 3.6% – 11.2% |

Strictly monotone: every card in a band is more likely than every card in the band below it.

**The bands are sorted on rate, not on price, and that matters at one boundary.** Rounding the fair
return down to the half compresses the top of `middle` into the bottom of `likely` — `tie` (27.2%),
`walled` (26.6%) and `mirror` (26.4%) all price at 6 despite straddling the boundary. Reading the
book by price would make that look like a mistake; reading it by odds, which is what `likely` and
`long` actually name, it is strict.

**`tie` stays in `likely` for a second reason worth writing down.** It is the only `likely` card with
`needs: null`, so it is the one that keeps the band non-empty on a rack matching nothing else — a
Symbiont-only or Guide-only rack has no planet, no draw, no burn and no wild to offer. Checked across
every single-cube rack and all seven measured racks: every non-empty rack is still offered all three
bands. A bare ladder draws no book at all, which is unchanged and correct — there is nothing on the
table to bet on.

The Gungan's own `blurb` was also rewritten; it still described the cube that absorbed blasts and
held neighbours together.

---

## 6. What was run

`§2` and `§4.3` landed in `src/game/cube/engine.js`. Two harnesses moved with them.

**`scripts/cubeTusken.js` was rewritten for the dome.** Its whole premise was the old rule — reach
bounded by the nearest shield on either flank — so `reachOf`, the line fixtures and the frozen-shield
phase were all rebuilt around *same dome, or open air on both sides*, computed independently of the
engine's own loops. One assertion is new and had to be: a Tusken can now be left with nothing to
shoot, so an empty reach is asserted as an outcome rather than treated as a hole. `cubeSideBet.js`
gained the `walled` proposition so the new card could be priced from measurement.

It had earlier asserted the old ice-as-ward rule in four places — *the ice takes the cull*, *a cube that ate the
cull is still standing*, *a shot at a frozen shield goes into the ice*, and the aiming distribution
that followed from them. Those are now written the other way round, and the structural claims around
them — the reach, the boundary, the fair-game positions — were left exactly as they were.

| Harness | Result |
|---|---|
| `cubeLine.js` | 20,000 throws, 100,016 positions, 36/36 face ids seen — every line came back as thrown |
| `cubeHolds.js` | 20,000 climbs — nothing lost, nothing conjured, nobody left in the cell |
| `cubeTusken.js` | 6 lines × 20,000 throws — passes, after a rewrite for the dome (see below) |
| `cubeOctahedron.js` | every invariant holds |
| `cubeThree.js` | all checks passed |
| `cubeTree.js`, `cubeCold.js` | pass |

Plus a targeted pass over the rulings themselves — 64 checks over hand-built lines, covering each
cell §2 changes and each one it must not: Ben and the Tusken now reach through ice while Flamejet
still thaws, the blessing answers a Singe and an Electrocution, the Binder immunities, a frozen
Greed and Multiplier paying, a frozen Turbine paying its step without advancing, an unfrozen one
still advancing, a painted Ben cutting both wings in his colour and all three voting, sweeping and
feeding a Guide's run, a bare Ben cutting bare wings that neither vote nor sweep, wings keeping
their own colour against the middle once cut, a Sandcrawler and a prison clearing wings off the
line while holding nothing for them and still carrying off a real cube, a dome that turns a burn and
a blast away while letting a cube beneath it destroy the shield, a Tusken shooting over a dome and
never under one, a wipeout no longer rescued by a neighbouring shield, Order 66 unable to reach
under cover, a turn moving a painted mark rather than clearing it and the moved mark being what
comes back on the next throw, a turn to a face's own colour clearing the mark instead of stacking
one, a chance cube turned for the throw with nothing written to the die, a frozen cube holding its
index across 3,000 throws while the open positions still produce all 24 orderings, and a plain line
still counting.

**Three harnesses fail, and all three failed identically before any of this.** Checked against a
detached worktree at `HEAD`, so this is not an inference:

- `cubeArm.js` — every failure is arm *pricing*: it still asserts the whole-number ladder
  `[1,1,1,3,5,10]` while the uncommitted `toTenth` work produces `[0.2,0.4,0.8,1.5,3,5.8]`. Six
  checks pass at `HEAD` and six pass now; the extra failures in the dirty tree come from that
  pricing change, not from anything here.
- `cubeSplit.js` — 6 failures at `HEAD`, the same 6 now.
- `cubeWeld.js` — throws `rack did not reach the bag: 7 equipped, 0 drawn` at `HEAD` and now.

None of the three touches wards, freezing, paint or the wings. They are the branch's own in-flight
work and are left alone.

**`cubeSideBet.js` was run in full**, 40,000 climbs across all seven racks, and every price rewritten
from it. See §5.
