# The Split — Design Proposal

> *"Two cubes, one seat."* — until you need two cubes.

**Status: built. Covered by `scripts/cubeSplit.js`; no press screen, so a weld is still unreachable in
production and the pick has nothing to act on until there is one.**

The rules are implemented — `splitAt` / `canSplitAt` in the engine, `splittable` and the `splitting`
branch of `alterShown` in the actions, `split` on `POST /held`, and the button, the marked cubes and the
kit pip in the Activity. `heavy` is off the rack and `refundDeadHeavy` hands its point back. §4's two press picks are
wired, and measured in `scripts/cubeWeld.js`.

Replaces **The Heavy Half** in The Forger with a once-a-run action on a held line: one welded position
comes apart into the cubes it was pressed from, thrown live, in place. The weld is untouched when the
run ends.

`docs/the-weld.md` documents the press this reverses. This documents the tab's missing verb, and the
two dead perks found on the way to it.

---

## 1. The hole it fills

**Four of the five trees do something while you are playing. The Forger does not.**

The note on `scrap` in `tuning.js` states the rule the trees were built to:

> *Swindler looks, Dealer moves, Gambler prices, and this one scraps.*

Five trees, four verbs. `press`, `keeper` and `heavy` are all things that happen **at the press**, out
of run, on a screen the player opens between climbs. So the tab that unlocks last — gated on
`opens: 'overflow'`, the first cube you own that you cannot field — is the only one that never puts a
button in front of you while the cubes are down.

That is the hole. It is not a power gap; The Forger is the strongest tab in the game. It is that a
player who has walked four rungs of the press has nothing to *do* with it at the only moment the mode
asks them anything.

### 1.1 The Heavy Half was the right node to take it from, for a reason that is not balance

Heavy is passive and untimed, which is the exact charge the record already brings against a perk it
replaced. From `tuning.js` on `scrap`:

> ***Replaces Salvage Rights**, which worked and was the wrong shape: passive, untimed, certain and
> indifferent to what you owned — a ledger adjustment sitting where the other four trees put a move.*

Heavy fails three of those four tests. It is not certain — it does nothing until an uneven cut turns
up, ~9% of presses — but it is passive, untimed, and indifferent: it changes a number in a table on a
screen with no run attached.

### 1.2 And it has never worked

**`major` and `keep` are never passed. The Keeper and The Heavy Half do nothing at all.**

The engine implements both. `orderFor(n, major)` in `engine.js:210` names the parent the major share
lands on, `pickWith(parent, want, from, faceId)` at `engine.js:223` guarantees a face through the cut,
and `rollWeld` accepts both as options — with a comment stating the gate is elsewhere:

> *Nothing here checks whether the perk is owned; `weldCubes` in `actions.js` is the gate, for the
> same reason it is the gate on everything else a client can ask for.*

It is not. `weldCubes` calls `engine.rollWeld(ids, { tier: s.pressTier })` and `rerollWeld` calls
`engine.rollWeld(parents, { seen: [...seen, id], tier: s.pressTier })`. Neither passes `major`.
Neither passes `keep`. Nothing else in `actions.js`, `src/api/cube.js`, or the Activity client
mentions either. Both perks are sold on the rack, written to the profile, reported by `cubeState`,
and drawn with an emoji at `rack.js:742` — and both are inert.

So the framing in the conversation that opened this was too generous. Heavy is not the weakest perk
in the game; it is one of two perks that are not in the game. §4 wires them both.

---

## 2. What it does

**Once a run, while the line is held, one welded position comes apart into its parents.**

The parents are thrown live, in place, in the position the weld was standing in. The line grows by
`parents − 1`. Nothing already on the line is re-thrown.

They stay apart **for the rest of the climb** — the set carries across levels, so both parents roll
again at every rung above this one — and the profile is never touched, so the weld is whole and in its
seat the moment the run ends.

It is the mirror of Scrap, which is what makes it cheap to build:

|                        | Scrap                    | Split                            |
| ---------------------- | ------------------------ | -------------------------------- |
| when                   | line held, before effects fire | same                       |
| positions              | −1                       | +1, or +2 off a three-cube weld  |
| once a run             | `run.scrapped`           | `run.split`                      |
| owned by               | The Junker, tier 4       | The Forger, tier 4               |
| lives in               | `alterShown`             | `alterShown`                     |

### 2.1 What prices it

**The parents come back whole, mines included.**

`weldPurity` is `0.01`. The entire truguts sink of the mode is players paying `weldRerollCost` — 📀2,500
scaled by the stake ceiling, 📀21.5T at prestige 33 — for a cut that dropped its parents' downside
faces. §7 of `the-weld.md` prices the chase; the measurement it turns on is that one surviving mine
roughly halves a weld's EV:

```
wild+greed weld        EV
no mine               2.99
one mine (greed)      1.89
one mine (wild)       1.70
two mines             1.40
```

A split hands all of that back. A clean `wild+greed` at 2.99 becomes a Wild and a Greed with both
Ratts faces live, on the table, for every rung left in the climb. **The thing the player spent the
most truguts in the mode to remove is the thing the button puts back**, and it puts it back for the
rest of the run rather than for one line.

What it buys is a position and a vote, now, on a line that is losing. That is the read: a table
sitting 2–3 against your call is a bust, and one weld coming apart into two cubes is two fresh sides
plus whatever their faces do — which can be 3–3 and a tie, or 4–3 and a win, or two mines and the run
ending on the spot.

**No dial.** There is nothing to tune: the odds are the parents' own face lists, which are already
measured, and the trade is entirely a function of which cubes the player chose to press together.
A player who welded two mineless cubes — Mirror, Gungan Shield, Symbiont — has a free split forever,
and that is correct: they gave up the payers to get it.

### 2.2 It is the only way to field more cubes than the bag holds

`bagSize()` is `cubesPerLevel * (LEVELS.length - 1)` — eight, and it is the hard cap on the loadout
that the whole press exists to answer. A weld is two cubes in one seat *on the way in*.

A split spends that fiction: for the rest of the climb, one seat is standing on the table as two
cubes. Nothing else in the game does that, and it is the sentence the tab's blurb already implies —
*"Two cubes, one seat"* — read the other way round.

The line's own ceiling is untouched by this. `maxCubes` is `Infinity` and the real brake is
`overflowAt: 100`, the turn budget that busts a roll which never finishes resolving. A split adds one
or two positions and therefore one or two turns; against a hundred it is noise. The bound is written
anyway, because every other face that lengthens the line writes it (`engine.js:1805`, `1819`, `1844`,
`1879`) and a grower that skips the check is the one that breaks the day the ceiling comes back.

### 2.3 Where the parents land, and why the player does not choose

`throwSet` shuffles, so the parents land in the weld's positions in an order nobody picked.

That is deliberate and it is the press's own rule — *"the press is not precision equipment"*
(`engine.js:311`). Position decides almost everything a face does: the Mirror reflects left onto right,
the Binder copies left to right, Sebulba's engines point, Ben eats both neighbours. Letting the player
arrange the parents would make Split a placement tool, which is The Dealer's job.

**And the player does not get to fix it afterwards either.** When this shipped, `alterShown` allowed
every pick a player owned on the same hold — *"one after the other, seeing what the first did before
deciding the second"* — which made split-then-shuffle a real cross-tree combination: split, see where
the parents fell, move one. That is gone, and deliberately: **a hold now takes one change.** The flags
are run-scoped either way, so nothing was lost but same-line combos, and what they cost was a hold that
ended in a `Continue` the player had to press to say they were finished. The reasoning is on the record
in `alterShown`.

What survives is the better half of the idea. The parents land where they land, and the player who wants
them somewhere else spends their Swap on the *next* rung — the set carries, so both parents are still
on the table. The synergy moved a rung later rather than being deleted, which is closer to how the rest
of the loadout works anyway: §"Five trees, and they do not touch" puts the interactions in the bag, not
in a single moment.

### 2.4 What does not come across

**Scorch marks, ice and heat stay with the weld and are not distributed.** The split hands back
`parents.map(id => ({ ...plainSlot(), id }))` and nothing else.

- `burned` is a multiset of **face ids** that `liveFaces` matches against the cube's own face list.
  A weld's faces are its parents' faces, so the ids would technically match — but a scorch burned a
  face off *that cube*, and that cube has just come apart. Splitting a scorched weld into two whole
  cubes is the cube going back to what it was, which is the flavour of the button.
- `heat` is the Turbine's own counter, and a weld carrying heat faces has been paying on its own
  tally. Handing that tally to whichever parent contributed the face is arithmetic no player can
  follow on a held line with ten seconds on the clock.
- `hauled` cannot occur: a hauled cube is in the hold, not on the line.

The alternative — route each burn to the parent whose `from` matches — is buildable and rejected. It
is invisible on screen and it makes the button's outcome depend on a history the player cannot read.

### 2.5 Refusals

Named in the existing style, one code each:

| code          | when                                                              |
| ------------- | ----------------------------------------------------------------- |
| `not_owned`   | the pick is not on the profile                                    |
| `spent`       | `live.split` is already set                                       |
| `not_a_weld`  | `engine.weldParents(slot.id)` is null for that position           |
| `bad_split`   | the index is not on the line                                      |
| `too_cold`    | the position is frozen                                            |
| `one_thing`   | more than one change in a single request — the existing rule       |

**`too_cold` is the one that is not obvious.** Ando Prime's freeze holds a cube on the face it is
showing and gives it no turn — `if (slot.frozen)` in `throwSet` serves the held face and clears the
flag. A frozen weld has one face committed and two cubes' worth of faces to commit it to, and there is
no honest answer to which parent inherits the ice. It refuses, which also gives the freeze a use it
did not have: it locks a weld shut for a throw.

---

## 3. Where it sits

```js
// tuning.js — exports.TREE
split: { tree: 'forger', tier: 4, pressTier: 3 },
```

The slot Heavy vacates, unchanged: six nodes, four tiers, one layout for all five tabs.

`pressTier: 3` rather than 1, and the rung is the reason rather than the pacing. **The Third Cube is
where a split stops being a coin and starts being a swing** — two parents is +1 position, three is
+2 — and gating on rung 3 means the first split a player ever presses can be the big one. It also puts
the tab's verb at the same depth the other four put theirs.

`requires` stays empty, as Heavy's did: `pressTier` is a floor on `s.pressTier` rather than an entry in
`requires`, because the press is one reward value bought four times.

Copy, for `PERKS` in `state.js`:

```js
split: {
    kind: 'split',
    label: 'Split',
    description: 'Once a run, break a welded cube on the line back into the cubes it was pressed from.',
},
```

---

## 4. The Deep Cuts fold

Heavy's effect does not get deleted with its node, because it has never run and the balance work it
was written for is still needed: `weldSplits` gives a useful 5+1 at *"roughly one press in 220"*
precisely because the major share is a coin flip, and naming the parent halves that to one in 110.

**Fold it into the rung that already charges for it.** Deep Cuts is press rung 4 and 5+1 is the only
thing it unlocks; the choice of where the five faces land belongs to the same purchase.

*(Revised while the press screen was being built: the choice moved again, off Deep Cuts and onto the
uneven cut itself. `pressPicks` now honours `major` at **any** rung — only an uneven cut reads it, so
below rung 2 the request is moot rather than gated, and a rung-2 player naming the four-face parent of
a 4+2 is the point rather than a leak. Deep Cuts keeps 5+1 as its whole value, and the "you name which"
clause lives on the Uneven Cuts blurb now. The Keeper's gate on `keep` is unchanged.)*

One helper in `actions.js`, used by both `weldCubes` and `rerollWeld` — the reroll included, because it
already re-cuts at the player's *current* tier, so buying rung 4 applies to welds already standing:

```js
const pressPicks = function (s, ids, { major, keep } = {}) {
    const at = id => (typeof id === 'string' ? ids.indexOf(id) : -1);
    const majorAt = at(major);
    const keepAt = keep ? at(keep.parent) : -1;
    return {
        major: majorAt >= 0 ? majorAt : null,
        keep: s.keeper && keepAt >= 0 && typeof keep.faceId === 'string'
            ? { parent: keepAt, faceId: keep.faceId } : null,
    };
};
```

**Both name a cube by id on the wire and by position in the engine, and that translation is the whole
reason this is a function.** `orderFor` and `pickWith` index into the parent array, which is the caller's
own `ids` — so an index on the wire is an index against an ordering the client has to guess right, and
guessing wrong aims the entire pick at the other cube with nothing anywhere to say so.

Which is not hypothetical. The first cut of this passed The Keeper's `parent` straight through as a cube
id, `keep.parent === k` in `rollWeld` was therefore never true, and the perk went on doing nothing while
looking wired — the same failure it was being rescued from, one layer down.

Measured in `scripts/cubeWeld.js`, 20k presses a row:

```
the named shares            the keeper
  wild named     1.000        mult:red named   1.000
  nothing named  0.495        nothing named    0.754
```

The first pair is the halving `weldSplits` promised: a useful 5+1 goes from one press in 220 to one in 110.
The second is measured on a face that is neither certain nor a downside, because `weldPurity` holds a mine
on 99% of welds and a downside face therefore has no room to show a difference.

Both are dropped rather than refused when they cannot apply — `keep` when The Keeper is not owned,
`major` when the cut comes out even — so a client that sends them early presses exactly as it always
did. The Activity's press screen sends both: the first press slot is the major, and The Keeper's face
is named on the sheet of a cube sitting in the slots.

The "you name which" clause rides on `weldTiers[1]` — Uneven Cuts, the rung where a cut first has a
bigger share to name:

```js
blurb: 'The press sometimes takes four faces from one cube and two from the other — '
    + 'and you name which cube gives more.',
```

### 4.1 The point already spent on Heavy

A player holding `heavy: true` paid a build token for a flag that has never done anything. Three
options, in order of preference:

1. **Refund it.** `s.points += 1` and clear the flag, once, on the first read of a profile carrying
   `heavy` after the node is gone. One branch in the `cubeState` reader, and it is the honest answer:
   they were sold something that did not exist.
2. Grant Split instead. Cheaper to write, wrong on the merits — Split is gated on rung 3 and Heavy was
   sold at rung 3, so it mostly works, but it hands out a pick nobody chose.
3. Leave the dead flag. `HELD.heavy` keeps reading it, the node is simply never offered again. Zero
   work, and the player keeps paying for it.

Took (1). `refundDeadHeavy` in `state.js` clears the flag and adds the point, and `spendPoint` calls it
**before its own balance check** — so the refund lands as something to spend on this visit rather than as a
number to notice and come back for. It is the one screen that can pay it out, and the one place a player
touches the rack.

`heavy` is out of `TREE`, `PERKS`, `FLAGS` and `HELD`, so it can neither be offered nor re-bought. The only
thing that still reads it is `cubeState`, so the refund has something to fire on; delete those two
together once no live profile carries the flag.

---

## 5. Implementation

Nothing here needs a new store, a new codec, or a migration. The run-scoped flag and the held-line
framework both already exist and Split is a third tenant of each.

### 5.1 The engine — one function

```js
// engine.js, beside throwSet
exports.splitAt = function (line, at) {
    const pos = (line || [])[at];
    if (!pos || pos.frozen) return null;
    const parents = exports.weldParents(pos.slot && pos.slot.id);
    if (!parents) return null;
    return exports.throwSet(parents.map(id => ({ ...plainSlot(), id })));
};
```

`throwSet` is doing all of the work: it copies slots, rolls faces off `liveFaces`, handles charring,
and returns positions in exactly the shape the line holds. The parents are specials by construction —
`parseWeld` resolves every one through `baseById` and rejects anything with `noWeld` — so nothing
plain can enter through a split and `rollSide` is never reached.

**The round trip is what makes this safe**, and it is already measured. `parkThrow`'s contract is
*"Nothing rolled here is rolled again"*: a held line is stored as `encodeLine` — slots, one face id
per position, `lineState` for the rest — and rebuilt by `relineFrom`, over `scripts/cubeLine.js`'s
hundred thousand positions. Freshly thrown parent positions are ordinary positions, so they store and
rebuild by the same path with nothing added.

### 5.2 The actions

`alterShown` gains a third branch beside `swapping` and `scrapping`:

```js
const splitting = Number.isInteger(split);
// the existing `swapping === scrapping` guard becomes a count
if ([swapping, scrapping, splitting].filter(Boolean).length !== 1) {
    return refuse('one_thing', 'One change at a time.');
}
...
if (splitting) {
    if (!s.split) return refuse('not_owned', "You haven't taken Split off the rack.");
    if (live.split) return refuse('spent', 'You have already split a cube this run.');
    if (split < 0 || split >= n) return refuse('bad_split', 'That is not on the line.');
    const parts = engine.splitAt(took.line, split);
    if (!parts) {
        return took.line[split] && took.line[split].frozen
            ? refuse('too_cold', 'That cube is frozen shut.')
            : refuse('not_a_weld', 'That is not a welded cube.');
    }
    if (n + parts.length - 1 > config.maxCubes) return refuse('too_many', 'The table is full.');
    took.line.splice(split, 1, ...parts);
    if (seen === split) seen = null;
    else if (seen != null && seen > split) seen += parts.length - 1;
}
```

The `seen` bookkeeping is Scrap's, inverted — a premonition's tile has to go on pointing at the cube it
was about, and a split at or before that position moves it. Pointing it at a parent would be a lie:
the face the player was shown belongs to a cube that no longer exists, so it clears.

Then `run` carries `split: took.run.split || splitting`, and `can` gains its entry.

`holdRoll` needs three changes: the ownership guard `if (!s.shuffle && !s.scrap && !s.split)`, a
`canSplit`, and — the one with teeth — **`can.split` is a list of positions, not a boolean.**

```js
const splittable = !!s.split && !live.split
    ? held.line.map((c, i) => (engine.splitAt(held.line, i) ? i : -1)).filter(i => i >= 0)
    : [];
```

Two reasons it is a list. The client cannot otherwise tell which position is a weld — `holdRoll`
returns `faces`, `state`, `call` and `can`, and none of those carries a slot id — and it needs to know
in order to light the cubes that can be pressed. And a boolean would stop every rung to ask a question
with no answer on a line with no weld standing on it, which is the dead end `holdIdle` and the
`held.line.length < 2` refusal both exist to avoid.

That is a wasted `throwSet` per position purely to test splittability. Cheap at nine positions, and
avoidable — split the test out of `splitAt` as `canSplitAt(line, at)` and have both call it.

The run-scoped flag then has to be spread everywhere `saw` / `swapped` / `scrapped` already are.
Eight sites, all mechanical, and `parkThrow` carries the note explaining why they come off the run and
not off the stored node: `actions.js:237`, `262`, `445`, `574`, `658`, `710`, `748`, `1304`.

### 5.3 The API

`POST /held` takes a `split` index alongside `a`, `b` and `scrap`, and joins the `changing` test:

```js
const split = Number.isInteger(req.body?.split) ? req.body.split : null;
const changing = a != null || b != null || scrap != null || split != null;
```

The route's own comment — *"a client that could alter a line twice would be a client that could spend
two trees' worth of agency on one rung"* — now covers three trees, and the rule it describes is
unchanged: one change per request, the roll stays held, only an empty body settles.

### 5.4 The client

Five edits in `junkyard`, all following Scrap's:

- `api.js` — nothing. `finishHeld(opts)` already forwards the whole body.
- `activity/index.html:105` — a `#held-split` button beside `#held-swap` and `#held-scrap`.
- `board.js:385` — `const splitting = holdCan('split') && one && canSplit(holdPick[0]);` and the
  button into the `hidden` / `disabled` / `showAct` lines. One selected cube can now mean two
  different presses, so both buttons appear together when the selected position is a weld — which is
  the first time the hold row offers a genuine choice rather than naming the only press available.
- `board.js:301` — `holdIdle` gains `!out?.can?.split?.length`, so a hold with only a spent or
  unusable Split in it is not asked.
- `board.js:788` — a `KIT` entry, `gone: board => !!board.run?.split`, and `split: '🔨'` in `rack.js` to
  replace `heavy: '⚖️'`.

Lighting the splittable positions is the one piece with no precedent to copy: `can.split` is a list of
indexes and the line's cubes are already datasetted per position at the bottom of `drawHeld`, so it is a
second attribute in that same loop — `data-splittable`.

**Drawn as a dashed outline and not as a seam.** A line down the middle of the cube was the obvious
picture and `::after` is not available for it: on `.cube` it is the count walk's ring and the banking flash
already, and a third tenant would fight both. So availability and aim share the `outline` — dashed in
`--primary-light` for *could*, solid in `--warn` for *am* — with the aimed rule written second so it wins,
which is the ordering this stylesheet already uses for the marked ring.

**And one thing the plan missed entirely: a weld has no name in the client.** `learnSpecials` is filled
from `/tuning`, which carries the cubes that exist for everyone; a weld exists for one player and arrives
on `board.welds`, which nothing consumed. So `cubeNameOf` answered "A cube" for one, and the feed line for
a split would have read *"You split a A cube"*. `weldOf` / `lineNameOf` in `board.js` read the board's own
list and fall back to `cubeNameOf` for everything else. **The gap is wider than this fix**: every other
place that names a cube on the line still goes through `cubeNameOf`, and a weld is unreachable today only
because the press screen does not exist. Learning `board.welds` where the board is ingested is the real
answer, and there is no single place a board is ingested — six assignments, no `takeBoard`. Worth doing
before the press ships and not as part of this.

The feed row itself uses `made`, which is the affordance a Padmé slipping two cubes in already draws
through: the parents are **shown** rather than counted, read off the answer, because what they landed on is
not known until the server has thrown them.

---

## 6. What to measure before it ships

`scripts/cubeSplit.js` covers what a split does to a line: 20k splits against the invariants in §2, plus
the refusals driven through `alterShown` itself. `scripts/cubeWeld.js` gained §4's two rows. What none of
them answers is whether the pick is *priced* right, which is three numbers and a decision:

1. **EV of a split rack against the same rack unsplit**, on the `the-weld.md` table's terms — 100k
   runs, seven welds covering fourteen cubes. The prediction is that always-split is *worse* than
   never-split, because it re-inherits every mine the presses dropped, and that a player splitting
   only on a losing line is better than both. If always-split wins, the button is a free +1 and the
   inheritance is not paying for it.
2. **How often a run reaches a rung with a weld on the line at all.** Eight seats, three welds, nine
   positions at Level 5: if the answer is under half, Split is a pick that does nothing most runs and
   `pressTier: 3` is too deep for it.
3. **The turn count.** `overflowAt: 100` busts a roll that will not finish, and a split adds positions
   to a table that is already the widest the mode produces. The expectation is noise; it is one
   histogram to confirm it.

All three want a rack-level EV harness rather than a line-level one — `cubeLean.js` and `cubeEconomy.js` are
the two that walk whole climbs — and all three are blocked on the same thing the pick itself is: **a weld
has to be reachable before a split can be measured in a real run.** Until the press has a screen, the only
honest statement about balance is the one in §2.1, which is that the mechanic has no dial to get wrong.

## References

- `docs/the-weld.md` — the press, the splits, the purity dial, the chase
- `docs/chance-cube.md` — the shipped mode
- `src/game/cube/tuning.js` — `TREE`, `weldSplits`, `weldPurity`, `weldTiers`
- `src/game/cube/engine.js` — `parseWeld`, `weldParents`, `rollWeld`, `orderFor`, `pickWith`,
  `throwSet`, `relineFrom`, `encodeLine`
- `src/game/cube/actions.js` — `alterShown`, `holdRoll`, `parkThrow`, `takeThrow`, `weldCubes`,
  `rerollWeld`
