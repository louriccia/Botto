# The Behaviour Matrix — What Every Face Does, And How Far It Reaches

> Thirty-three effect faces. Seventy cells. Twenty-five of them occupied.

**Status: an audit, not a proposal.** It plots what the game already has so the holes can be looked
at. Nothing here changes a rule; `docs/planet-octahedron.md` is where a change gets argued.

It came out of the Activity's face classification — the six *acts* every face now carries in
`src/activity/faces.js`, drawn as a colour and a mark on the cube sheet. Once every face had one
word for what it does, the question "what does the game never do?" became answerable by putting the
words in a grid.

---

## 1. The two axes

**The act** is what a face does to the line. Six of them, and they are told apart by shape rather
than by whether they are good for you:

| Act | | What it means |
|---|---|---|
| `pays` | ▲ | Value out of the line |
| `grows` | ✚ | Cubes onto it |
| `breaks` | ✕ | Cubes off it, for good |
| `guards` | ◎ | The run survives something |
| `turns` | ↻ | A face changed in place |
| `binds` | ⊘ | Something taken away on a clock — it ends by itself |

`breaks` and `binds` are separated by whether it comes back, not by what is taken. A scorch leaves
the cube standing and takes one of its six faces and is `breaks`, because the char is gone for the
rest of the climb. A prison takes the whole cube and is `binds`, because the prisoner walks out on
the next rung won.

A seventh column is carried through this document that is **not** a class:

| | | |
|---|---|---|
| `moves` | ⇄ | A cube changes position, and nothing else about it changes |

No face in the game does it. See finding **F**.

**The reach** is how far a face can touch, ordered nearest first — from its own position out to the
run itself.

---

## 2. The matrix

| Reach | `pays` | `grows` | `breaks` | `guards` | `turns` | `binds` | `moves` |
|---|---|---|---|---|---|---|---|
| **Itself** | Greed · Heat | **H** | Wipeout | — | — | — | n/a |
| **One neighbour** | **D** | Binder | Burn · Binder | **A** | Sebulba L · Sebulba R | Sandcrawler | **F** |
| **Both neighbours** | — | Fode · Padmé | Ben · Baroonda | Shield | **C** | Ando Prime | **F** |
| **A distant cube** | — | — | Tusken | — | — | — | **F** |
| **The ends** | — | **G** | Ord Ibanna | — | — | — | — |
| **A region** | Guide | — | Ratts | Gungan Shield | — | — | — |
| **The whole line** | Boost · Multiplier | Mirror | Mirror | **B** | Invert | Oovo IV | — |
| **Every cube of a kind** | — | — | Order 66 | — | — | — | n/a |
| **Off the line** | **E** | Pit Droid · Scavenger | — | — | — | — | — |
| **The run** | Mon Gazza · Shortcut | n/a | — | Reroll · Tatooine | — | Aquilaris · Malastare | n/a |
| | **8 faces** | **6 faces** | **10 faces** | **3 faces** | **3 faces** | **5 faces** | **none** |

A letter is a gap argued below. An em dash is a cell nothing occupies and nothing obviously should.
`n/a` is a cell the rules cannot produce.

The Mirror and the Binder appear twice, because they grow the line and break it in the same breath —
they are the only faces that destroy a position by writing over it, which is the same thing `turns`
in `VERBS` has always marked them with.

---

## 3. What is missing

### A — Nothing protects a cube

Ten faces destroy something. **Three guard anything at all**, and not one of them guards a cube: the
Gungan Shield guards a boundary, Tatooine guards an outcome, the Reroll guards the run. There is no
face that answers a mine by saving what it hit.

This is the emptiest region on the grid and the one a player is most likely to feel the absence of,
because destruction is the thing the mode does most.

### B — Nothing protects the table

The whole-line row has a payer, a grower, a breaker, a turner and a binder, and no guard. Order 66, a
Mirror and Ord Ibanna can each gut a table in one throw, and there is no line-wide answer to any of
them.

### C — `turns` reaches two places out of ten

One neighbour, twice, and the whole line, once. Nothing turns **both** neighbours, the ends, a
region, or every cube of a kind — even though turning is the cheapest effect in the game to reason
about, because the line neither grows nor shrinks and no state has to survive the throw.

### D — No payer ever points at a cube

Every paying face counts something: itself, a region, the line, the road. *Pays for the cube on its
right* does not exist, so no payer is positional and none of them interacts with where anything
stands. Every other act on the grid has at least one positional member.

### E — The off-line pools are write-only or read-only, never both

The bag is drawn from and never added to. The hold receives and gives back. The prison receives and
drips out on a clock. **Nothing pays for what is in them, nothing protects them, and nothing destroys
them** — three stockpiles that grow across a run and that no other mechanic can see.

Worth reading beside "Cut on purpose" in `docs/planet-octahedron.md`: `sink` was cut because it,
`jail` and `plunge` were "three faces spending on the same verb". That was this classification
arrived at by feel, two years before there was a word for it.

### F — No face changes position

The line is reordered exactly once in the whole game, by the player's Swap. Yet handedness is
everywhere — Burn hits its right, the Binder writes left to right, the Sandcrawler carries off its
right, Sebulba points one engine or the other, Ben lies across both.

Position already changes on its own: `throwSet` lands the cubes in a new order every throw, because
position is a property of the throw rather than of the cube. So the model is there, and nothing on
the line uses it.

### G — The ends are touched once

Ord Ibanna drops whatever stands on the head and the tail. It is the only face in the game that knows
the line **has** ends. A positional idea with a single inhabitant, and the obvious home for its
inverse.

### H — Permanence only ever runs one way

A scorch takes a face off a cube for the rest of the climb. A heat burns itself off as it pays. The
prison holds and releases; the frost holds and thaws.

**Nothing ever adds a face to a cube.** Outside the rack, a cube can only get worse — which means
there is no such thing as a run that improves what it is holding, only one that spends it.

---

## 4. What the player can do that no face can

The picks and the perks are the same system from the other side, and the two halves do not overlap
the way you would expect.

| Pick | Act | Reach | |
|---|---|---|---|
| **Scrap** | `breaks` | one chosen cube | The only aimed destruction in the game. Every destroying face hits a position, not a choice. |
| **Swap** | `moves` | two chosen positions | The only thing that changes where a cube stands. |
| **Split** | `grows` | one chosen weld | A source of cubes nothing else uses. |
| **Premonition** | `reads` | one face of the rung ahead | An act with no column at all: it changes nothing and tells you something. |
| **Side Bet** | `pays` | the line's shape | The only payer that reads shape rather than counting cubes. |
| **Bribe · Nudge** | `guards` | a tie | Two of the three ways the game guards anything are purchases rather than faces. |

So the player owns two acts the faces do not have — **moves** and **reads** — and the faces own two
the player cannot reach: **turns** and **binds**. Nothing on the rack flips a side or seals anything.

That split may well be right. It was never decided; it fell out.

---

## 5. Where the octahedron sits in it

Six of the die's eight faces are in the bottom two rows — off the line, or in the run. The prison,
the bank, the call, the road. That is exactly what makes it feel unlike anything on the rack, and it
is also why it stacks four faces into one act:

| | `pays` | `grows` | `breaks` | `guards` | `turns` | `binds` | `moves` |
|---|---|---|---|---|---|---|---|
| **The die** | Mon Gazza | — | Baroonda · Ord Ibanna | Tatooine | — | Ando Prime · Aquilaris · Malastare · Oovo IV | — |

`binds ×4`. Six classes need six of eight slots, so no class may appear more than three times — which
means **covering the spread is impossible until one of the four binds converts.**

It also makes the die the natural owner of finding **E**. It is the only cube in the game that
reaches the off-line pools at all, and the only one that puts anything into one.
