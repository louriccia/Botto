# The Interaction Matrix — Every Face Against Every Effect

> Thirty-three face kinds. Twenty-two of them reach another position. **Eight of the thirty-three
> are ever read by one.**

**Status: an audit, not a proposal.** It reads `src/game/cube/engine.js` and states what the code
does, cell by cell. `docs/behaviour-matrix.md` plots what each face *does* against how far it
reaches; this plots what happens when one lands **on** another. Nothing here changes a rule.

**Rewritten after the revisions in `docs/face-interaction-revisions.md` landed.** Four things this
document used to say are no longer true, and they are the four biggest facts in it: the ice was a
ward, the Gungan Shield did three unrelated jobs, a flattened wing never counted, and a frozen face
never paid. None of those hold now.

---

## 1. Why the target axis collapses

The obvious shape of this document is 33 faces down the side, 22 effects across the top, 726 cells.
That grid is almost empty of information, because of one fact:

> **An effect that reaches a position almost never looks at what is standing there.** It looks at
> the position's *state* — frozen, blessed, gone, holding prisoners, freed this turn — at whether a
> dome stands between them, and at where it stands. The face is furniture.

Eight face kinds are read by another face, and here is the whole list:

| Face | Who reads it | What changes |
|---|---|---|
| `shield` | **everything targeted** | It raises a dome over itself and both neighbours. Every reach in the game asks `reaches(i, j)` before it lands |
| `wild` | `invert`, `crowd` | Both step over it. A wild re-settles to your call every throw, so a flip or a coat of paint on one is a landing spent on a mark nothing can read |
| `side` | `invert`, `engine` | An **unpainted** side face is erased rather than flipped — a turned side has no colour of its own left to reassert |
| `burn` | `scorch`, `burn` | Fire does not burn fire, and the Singe steps over the whole Binder |
| `clone` | `scorch` | The other half of the Binder, immune for the same reason |
| `engine` | `mirror`, `clone` | A copy is *turned*, and the direction turns with it |
| `raze` | `mirror`, `clone` | Same: the wings swap, so Ben reflects into a whole Ben facing the other way |
| `jail` | its own turn | A jailer paroles one prisoner at the **start** of every turn it takes, before its face resolves |

Plus one non-face property: **`purge` asks only whether the position is a special at all.** Plain
cubes survive Order 66. Nothing else in the game discriminates on that.

The other twenty-five kinds are **invisible**. Standing in front of a Greed Cube and an Ord Ibanna
are the same cube.

---

## 2. The matrix

Rows are the twenty-two faces that reach another position. `✓` means *hit, exactly as a plain cube
would be*. `—` means the effect cannot reach this at all. **Every row is additionally gated by the
dome**: a reach only lands when actor and target stand under the same shield, or both in the open.

| Effect | Itself | An ordinary position | Frozen (Ando Prime) | Blessed (Malastare) | Across a dome | A razed wing | A wild | Holding prisoners | Freed this turn | Nothing to hit |
|---|---|---|---|---|---|---|---|---|---|---|
| **mirror** | — | Overwritten by a turned copy; the original becomes wreckage | ✓ overwritten — the ice is no answer | Blessing spent, spared | `walled` | ✓ overwritten, and a legal **source** | ✓ | Hold breaks | ✓ | `mirror.nothing` / `.noroom` |
| **invert** | — (no side) | Side flips; a **painted** face has its mark rewritten | Skipped, ice kept | ✓ | Not reached | — (no side) | **Skipped** | — | ✓ | n/a |
| **end** (Ratts) | **Always dies** | Destroyed inside reach 2 | ✓ destroyed | Blessing spent, spared | **Blast stops at the wall** (`end.shielded`) | ✓ destroyed | ✓ | Hold breaks | ✓ | Run ends only if the line empties |
| **broken** (wipeout) | Shatters, spent for the run | — | Never fires — no turn | — | **No longer saved by a shield** | — | — | Hold breaks | — | — |
| **burn** (Flamejet) | — | The position on its right, destroyed | **Thaws it** (`burn.iced`) | Blessing spent | `burn.walled` | ✓ destroyed | ✓ | Hold breaks | ✓ | `burn.nothing`; `burn.fireproof` against another Flamejet |
| **clone** (Electrocution) | — | Right overwritten by a copy of the left | ✓ destroyed | Blessing spent, **at the head too** | `clone.walled` | ✓ | ✓ | Copied deep, or broken open | ✓ | `clone.alone`; appends at the tail |
| **cull** (Tusken) | Never | One at random, from everything it can reach | ✓ shot through | Blessing spent | **Shoots over a dome, never under it** | ✓ legal victim | ✓ | Hold breaks | ✓ | `cull.nothing` — and it can now be left with nothing |
| **raze** (Ben) | — | Both neighbours become wings, **cut in his colour** | ✓ flattened | Blessing spent, that side spared | Not reached | ✓ | ✓ | Hold breaks | ✓ | `raze.nothing` / `raze.blessed` |
| **pair** / **twins** | — | — | — | — | — | — | — | — | — | Inserts two plain cubes either side |
| **draw** | — | — | — | — | — | — | — | — | — | `draw.empty` |
| **scavenge** | — | — | — | — | — | — | — | **Own cell first**, junkyard second | — | `scavenge.empty` — and it **mends one singe** on whatever it brings back |
| **haul** | — | The position on its right, captured whole | Captured, ice intact | Captured — blessing not read | `haul.walled` | **Destroyed, not kept** (`haul.rubble`) | ✓ | Nested inside it | **Skipped** | `haul.nothing` |
| **purge** (Order 66) | Dies | **A plain cube survives.** Every special dies | ✓ destroyed | Spared, blessing spent | Not reached | ✓ destroyed | ✓ | Hold breaks | ✓ | `purge.nothing` |
| **engine** (Sebulba) | — | Turned to your call; a **painted** face is repainted for good | Blocked, ice kept | ✓ | `engine.walled` | — (no side) | `engine.already` | — | ✓ | `engine.nothing` |
| **freeze** | — | Both neighbours hold their face **and their place** | Skipped | ✓ frozen | Not reached | ✓ (wasted) | ✓ | ✓ | ✓ | `freeze.nothing` |
| **scorch** (Singe) | — | The shown face burned off for the climb; the cube charred | **Thaws it** | **Blessing spent, spared** | Not reached | ✓ (wasted) | ✓ | ✓ | ✓ | Skips the **whole Binder**; a cube on its last face is spared |
| **vault** | — | — | — | — | — | — | — | — | — | Seals the side you called |
| **jail** (Oovo IV) | — | Up to four at random | Jailed, ice intact | Jailed — blessing not read | Not reached | **Taken and destroyed** (`scrapped`) | ✓ | Nested inside it | **Skipped** | `jail.nothing` |
| **plunge** | **Always falls** | The head and the tail | ✓ destroyed | Ledge walks in; blessing spent | Ledge walks in | ✓ destroyed | ✓ | Hold breaks | ✓ | `plunge.nothing` |
| **crowd** (Tatooine) | — | The shown face painted the leading colour, for the climb | Skipped, ice kept | ✓ | Not reached | ✓ — **and a painted wing counts** | **Skipped** | ✓ | ✓ | `crowd.nothing` |
| **blessing** | Excluded | One other standing position at random | Eligible | Excluded | Not reached | ✓ (wasted) | ✓ | ✓ | ✓ | `blessing.nothing` |
| **shield** (Gungan) | — | Passive. It raises the dome every other row is gated by, and takes no turn | — | — | — | — | — | — | — | — |

Eleven faces have no row, because they reach no other position: `side`, `wild`, `greed`, `seam`,
`boost`, `mult`, `heat`, `guide`, `shortcut`, `reroll`, `shield`.

---

## 3. How a position survives something

There are **two** ways, and they are told apart by shape rather than by strength. Ice is on neither
list, which is the point of it.

| | What it is | What it answers |
|---|---|---|
| **The blessing** (Malastare) | A charge on one cube, spent once | Anything that takes a cube off the table **or a face off a cube** |
| **The dome** (Gungan Shield) | A boundary over three positions | Anything that would have to *cross* it, in either direction |

The blessing now answers every destroyer plus the Singe. It does **not** answer anything reversible:
paint, ice, or capture by a Sandcrawler or a prison. *A cube that is jailed is not destroyed, it is
late.*

The dome is a **bubble, not a barricade**. It shelters what is under it and does not block passage
past it — a Tusken outside shoots clean over one to the far side, and a Tusken under one can only
shoot what is under it with him. Only a cube already inside can bring the shield down.

**Ice is persistence, not protection.** A frozen cube holds the face it is showing *and the place it
is standing*, takes no turn, and is otherwise ordinary: it counts, it pays, and anything that
reaches it destroys it. Only the two fires answer it — Flamejet and Singe thaw rather than destroy.
`invert`, `crowd` and `engine` bounce off a frozen cube without spending anything, because a turn or
a coat of paint is not worth a freeze.

---

## 4. Copies, and what rides along

`mirror` and `clone` both build their copy through `turned`, so the two faces share one answer. A
copy is a cube: it takes its own turn, in order, to the right of the face that made it.

| Carried | Not carried |
|---|---|
| Scorch marks (`burned`) — a reflected Turbine keeps its spent heat | **The ice.** A freeze is a property of the cube Ando Prime froze, not of its picture |
| The blessing | |
| Prisoners, **deep-copied** — a reflected Oovo IV arrives with a second full cell | |
| Handedness, **turned around**: `engine:left` becomes `engine:right`, Ben's wings swap | |

The overwritten position is **wreckage, not a shatter**: it never enters `broken`, so it is not spent
for the run, and a Jawa can pull it straight back out.

---

## 5. Position, side, and the things that are not cubes

**A cube can be turned around.** `slot.mirrored` is permanent and read by all seven handed faces —
`burn`, `clone`, `haul`, `engine`, `mirror`, `draw`, `scavenge`. A reflection sets it, and reflecting
a mirrored cube turns it back. So every row above that names a side — *the position on its right*,
*reads left and writes right* — means *the side this cube faces*, not a fixed direction.

**A cube is an instance, and it has a name.** `SPECIALS` is the class; a slot is one cube built from
it, carrying its own singes, paint, ice, heat, blessing and prisoners, plus a `uid` that survives the
shuffle and the wire. Two Greed Cubes on one line are two cubes, not one string twice — which is what
lets anything downstream say *which* of them was singed. A copy is a new cube with its own name;
wreckage keeps the name it died with, so a salvage hands back the cube that was lost.

**A chance cube is one of these too.** An untouched one is a coin — six interchangeable sides,
nothing has happened to it — but the moment it carries a mark it keeps the face it rolled, and from
then on it is as much an individual as a Greed. That is what lets a turn move paint on one.

Four things can occupy a position:

| | Takes a turn | Counts for a colour | Pays | Holds its place |
|---|---|---|---|---|
| A cube | yes | if its face is a side, a wild, or painted | yes | no — the line reshuffles every throw |
| **Frozen** | **no** | yes — the face it is holding | **yes** | **yes** |
| **Charred** (scorched) | no | no | no | no |
| **A razed wing** (`gone`) | no | **yes, if it has a colour** | no | no — discarded before the next throw |

Three consequences worth stating outright, because none is visible from any single face:

**A frozen cube is silent, not absent.** It takes no turn — a frozen Ratts does not detonate, a
frozen wipeout does not shatter — but it counts for its colour and pays like anything else. `heat` is
the one exception: it pays its current step and does **not** advance, because the ice is holding the
face against its own schedule.

**A position is a cube when it has a colour, and flattened is not an exception.** Ben cuts his wings
out of himself, so a painted Ben comes up as three matching cubes rather than one cube lying on two
holes — and those three vote, pay and extend a Guide's run. A bare wing is still a hole. None of it
outlives the rung.

**Paint is the only way an effect face counts for a colour.** `settle` reads the mark before it reads
the face, and the scoring pass reads the face regardless of side — so a Greed that Tatooine painted
blue pays +0.5 *and* counts as a blue cube. A turn moves that mark rather than clearing it, so
turning a painted face is permanent; turning an **unmarked** chance cube is a reroll that lasts one
throw. A chance cube's face has a natural colour, so turning a painted one means *back to its own
colour* and the mark comes off; a special's face has no colour of its own, so there the mark moves.

---

## 6. What the grid says now

**A — the wards line up.** The previous version of this document opened on a seventeen-row table in
which no two destroyers agreed on what stopped them, and called it the emptiest-looking part of the
grid. There are now two answers with two shapes — a charge on a cube, and a boundary over three
positions — and one rule for ice that is not about protection at all. §3 is six sentences where it
used to be a table.

**B — something finally guards the table.** The dome stops `purge`, `plunge`, `invert`, `jail` and
`mirror` from reaching inside it. Order 66 has an answer for the first time.

**C — nothing reads a face except to skip it.** Seven of the eight entries in §1 are *exclusions* —
don't flip a wild, don't paint a wild, don't burn a Binder, don't turn what has no side. Only the
shield is read in order to *do* something different, and what it does is gate everything else.

**D — `purge` is still the only effect that discriminates on what a cube is.** Plain cubes survive
Order 66; every other effect treats a plain cube and a Pit Droid identically.

**E — the self column is nearly empty.** Four faces touch themselves: `end` and `broken` destroy
themselves, `plunge` falls with the line's ends, and `purge` includes itself. Nothing *changes*
itself, which is finding **H** of `docs/behaviour-matrix.md` arriving from the other direction — and
that finding is still open. Nothing in the game repairs a cube.
