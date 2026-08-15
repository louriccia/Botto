# Botto's Chance Cube — Game Design

> *"We'll let fate decide. Blue — it's the boy. Red — his mother."*

Design notes for the chance cube betting minigame unlocked by the **Red vs Blue** item
collection. This documents what ships, not a wishlist.

---

## 1. The unlock

The collection already existed in the data and is almost suspiciously perfect:

| Piece | Where | Meaning |
|---|---|---|
| Collection `Red vs Blue` → `chance_cube` | `src/data/challenge/collection.js:62` | "Botto's Chance Cube - Unlocks a chance cube betting minigame" |
| Item 95 `Red Side`, `limit: 3` | `src/data/challenge/item.js` | 3 red faces |
| Item 96 `Blue Side`, `limit: 3` | `src/data/challenge/item.js` | 3 blue faces |
| Reward flag `effects.chance_cube = true` | `src/interactions/challenge/functions.js:3649` | already granted on claim |
| `<a:chance_cube:1235055236138270760>` | `src/data/discord/emoji.js:4` | animated cube emoji, used as the tumbling frame |

You collect **3 red faces + 3 blue faces and assemble one six-sided cube.** The cube is
fair; what makes the game is the ladder you choose to climb with it.

---

## 2. The loop

`/chubacubes` launches the **Activity** and the entire game happens inside it. The bot's whole job
is the unlock gate and the iframe — the board is drawn by `../junkyard`'s `src/activity/`, which
reads the same `game/cube/` rules through `src/api/cube.js`.

**Everything is server-authoritative.** The client says "I call blue"; it never says what the cubes
did. The reason is absolute and outlived the secret the mode used to keep: the payouts are real
truguts, so a client that reported its own outcomes would be a client that could mint them. Responses carry abstract face ids
(`greed`, `mult:blue`) and structured notes, never emoji or prose — what a face looks like and what
it says about itself are the client's business, which is the whole reason the engine was pulled out
of the embed in the first place.

```
        <a:chance_cube> Botto's Chance Cube

  <:silver:> Level 2 · Test Your Luck · <a:restart:> Again ×1 · 3 cubes · 9×
                                         ↑ records badge the value that broke them:
                                           `5 cubes <a:newrecord:>`, `6.5× <a:newrecord:>`
  <:bronze:> ▰ <:silver:> ▨ <:gold:> ▱ <:platinum:> ▱ <:diamond:> → 🔒 <:grandmaster:> Prestige 1
                                         ↑ the road, on every frame

  Called 🟦 Blue · 1,000 staked ✅        ← small, sits right on the cubes
  🟦 🟦 🟥                                ← the line, drawn large

  "Hmph. Lucky roll. Don'ta let it go to your head, eh?"

  Bank 4,000 or keep playing for 8,000

  [ 🟦 Push Blue ]  [ 🟥 Push Red ]  [ 💰 Bank 4,000 ]  [ ? ]

  📀 499,000                                     ← the balance readout
```

Set a stake, call a side, roll. Win the level if your side is the **majority** — then bank
the double or push for two more cubes. Bust and you lose the stake and everything standing
on it.

**Watto calls every roll himself.** He is the house, so he is delighted when you lose and
personally insulted when you don't. His dialogue comes first, in a block of its own, drawn at
random from `WATTO` in the tuning data — then exactly one plain line saying what happened to the
player's truguts:

- `**Congrats!** You won **1,000** truguts and unlocked **Level 2 · Test Your Luck**!`
- `**Sorry!** You lost **1,000** truguts and a **16,000** standing.`

Both amounts are **net** — what actually changed hands — so they match the balance readout
moving. The clears counter is deliberately not spelled out in words anywhere; [the road
map](#the-map) is the only place it lives.

An end screen that earned a clear also gets one forward-looking line — `Keep playing to
unlock <:gold:> **Level 3 · Rolling Thunder** (5 dice) **8×**` — so the reason to press Play
again is on screen at the moment the player is deciding whether to.

While a run is live, the bank-or-push decision is a single line rather than a standing plus a
pitch: `Bank **4,000** or keep playing for **8,000**`.

### 2.1 The cube is fair, and the edge is in the pay table

**Every plain cube is an honest 50/50**, drawn through `rollSide` so the level's own cubes and any a
special spawns all come from one place.

There used to be a **daily lean** here: one side favoured every day — 55/45, later 52/48 — derived
from `sha256(secret salt + ':' + eastern day)` so that every player rolling on the same day was
playing the same cube, and never announced. It was the mode's best table-talk object and it is gone,
because it could not be priced and it was not what it looked like.

**It was a player edge, not a house edge, and it stayed one in both directions.** Two properties of
the ladder, neither of them fixable by trimming the number:

- **Majority-of-N amplifies a per-cube bias with depth.** A level's winner is the majority of an odd
  number of cubes, so a 52/48 cube is 52/48 at Level 1 and 54.9/45.1 at Level 5. Every rung ends up
  mispriced by a different amount and the deepest by the most, so no single `levelStep` prices them
  all and whichever rung is loosest is the one that gets farmed. This is also why a flat rake could
  never absorb it.
- **It paid the uninformed too.** `E[∏P] > ∏P(E[p])` by convexity, and the ladder pays exponentially
  in streak length, so *any* p ≠ 0.5 mints truguts whichever way the player calls. Blind play — one
  colour forever, half the days wrong — measured **EV 1.66** at 0.55. There is no EV-neutral value of
  that dial except 0.500, which is to say: no lean.

Measured at the end, 0.52 was worth **+0.37 EV to the player** on a bare ladder. The secrecy of the
salt never helped: a nine-cube line carries enough information that ~36 throws identify the day's
side to 95% confidence, so it was inferred from the table rather than read out of the source.

**What a fair coin buys is the ability to charge for the game at all.** At 0.500 the majority of any
odd number of cubes is exactly 0.500 too, so one multiple prices every rung, the edge is uniform, and
there is no loose rung to find. That is the same arrangement a casino runs: the wheel is honestly
balanced and pays 35:1 on a 37:1 shot. `scripts/cubeLean.js` prints the pricing table as a standing
check that the property still holds.

`CUBE_LEAN_SALT` is no longer read by anything and can come out of the environment, Heroku included.

### 2.2 How a roll plays back

The controls come off and every cube goes face-down. Then they turn over **one at a time**, and the
whole reveal takes about the same three seconds however long the line is: `cubeBeat` divides
`throwTime` by the count and floors it, so a nine-cube line turns faster per cube than a three
rather than taking three times as long.

**The pacing is measured in milliseconds, not in frames**, and that is the single biggest thing the
Activity changed. The embed drew the board in message edits, which is a rate-limit budget rather
than a frame budget: nine cubes revealed one at a time would have spent a whole bucket on one roll,
so the reveal was grouped into at most three batches and stopped early at the cube that settled the
majority — past that point the result could not change, so there was no tension left to milk.
**None of that survives.** A DOM update costs nothing, so every cube gets its own turn and every
effect gets its own beat. `BEAT` in `board.js` is the whole of the pacing, and `reduceMotion` is
the one thing that overrides it.

Settlement still runs *during* the first beat, so a crash mid-animation leaves the ledger correct.
The trap that used to create is gone with the client that had it: the embed re-rendered the entire
board on every frame, so a balance or a road tile drawn after settlement gave the result away
before the cubes landed, and every face-down frame had to be rendered from a pre-settlement
snapshot to stop it. The Activity animates the line **in place** — `syncLine` and `diffLine` touch
the cubes that moved and nothing else — so the numbers that would spoil it are simply not part of
the frame.

Layout rules, and what is left of them now the client can lay out:

- **The line has to stay countable at a glance**, which is the entire job of it. A row that wraps
  stops being something you can count, so the cubes shrink as the line grows rather than spilling
  onto a second row. This used to be four hand-picked markdown sizes with a lookup table behind
  them — `#`, `##`, plain, `-#`, each threshold being the count at which the row stopped fitting at
  the size above — because an embed has four text sizes and no way to measure anything. CSS does it
  properly and the table is gone.
- **The balance is a reference number, not part of the roll**, so it sits apart from the line and
  changes only when truguts actually move. It lived in the embed's footer for exactly this reason,
  which was the one thing that layout got for free.
- Space separates the header block, the roll, Watto's line, and the result, so each beat reads as
  its own thing rather than one paragraph that keeps growing. The called side is the exception — it
  sits directly on top of the cubes with no gap, because it's a label for them.
- The called-side line carries a **✅ or ❌** once the roll has an answer, and nothing while the
  cubes are still face-down — that mark is the whole question the reveal is asking, so showing it
  early would give the roll away.
- **Special cubes never narrate themselves**, with one exception. They change the line, the
  payout and the meter; what they did is left on the table to be read off the cubes rather than
  explained in prose, so the result block stays two or three lines however exotic the roll was.
  The exception is a **shatter**, which is called out by name — it is the only effect that
  changes what the *next* roll can do, and a player who wasn't told would just find their loadout
  quietly a cube short later in the climb.
- The clears meter keeps a **🔒** for the whole climb and springs to **🔓** on exactly one screen:
  the results frame whose clear filled it. That frame is already passed a state with `clears` at
  the goal, so the padlock reads straight off it — and the idle board that follows, whose counter
  has reset toward the next level, is correctly locked again.
- **Two groups of controls, and nothing in either that can't be pressed.** One is the roll — call,
  bank, help. The other is everything you set up *before* one: the stake, the rack, rerolls,
  prestige. All of that is locked for the duration of a run and none of it is about a result, so
  the second group disappears entirely mid-run and on an end screen, where the first collapses to
  `Play again`. The split was forced originally — Discord allows five components to an action row,
  and a rack button plus a reroll button made seven — but it outlived the constraint because it is
  the right split anyway: what you configure and what you press are different kinds of thing.

**Every effect gets its own frame.** `resolveLine` settles the line in two passes — the first fixes
every side and modifier, the second restructures, **left to right in the order the cubes were
thrown**, with a cube destroyed by an earlier effect never getting its turn. That second pass is a
sequence, so the reveal plays it as one: after the cubes land, each restructuring face fires on its
own frame, showing the line as that cube left it with what it did written underneath. A clone, a
reflection or a raze is something you watch happen rather than a difference between two frames you
have to spot.

The labels are the `notes` the engine has always generated and nothing has ever displayed —
"reflected the 4 cubes behind it, conjuring **3** more", "bound 🟦 Blue and 🟥 Red into a **wild**".
They live on these frames only and are gone by the payout, which keeps the [result block short](#22-how-a-roll-plays-back)
while still letting the roll explain itself. A face that changed nothing gets no frame.

**Nothing caps this any more.** The embed capped the effect walk at three frames (`maxEffectFrames`)
and resolved the rest silently into the payout, which was affordable only because three cubes carry
restructuring faces and each can hold at most one position in a set. That stopped being true the day
a copy could take its own turn — the stress harness has measured **nine** effect steps in a single
roll — and the Activity simply plays all of them.

**Then the multiple builds, one paying face at a time.** Phase two of the reveal walks the Greed and
Multiplier faces the same way phase one walks the effects: a frame each, the pointer on the face
being counted, and the multiple in the level header climbing as it goes — `×16 → ×16.5 → ×17.5`. It
exists because the multiple used to arrive fully formed. A rack that threw three paying faces showed
×4 on the throw and ×6.5 on the payout, and which cubes did that — or that three of them had done
anything at all — was left to be inferred from a row of emoji. The multiple is the one number in the
mode that *builds* rather than being drawn, and it is worth watching build.

Two things follow from that, and both are load-bearing:

- **Every frame before phase two is drawn at the multiple with none of the paying faces counted.**
  They used to open at the finished number, which meant phase two had nowhere to start but *below*
  the figure the previous frame had already shown.
- **A face is counted the moment it can be counted, and not before.** Greed is unconditional and goes
  straight away. A Multiplier only pays if its own named side is the side that won, so it waits for
  an answer — from the line, or from Watto's cube, or, on a [tie he is asking about](#210-ties), from
  the player minutes later. In that last case the greed is walked before the roll parks and the
  multipliers are walked when the tie is answered, which is exactly what the tie screen is waiting on.

The frames say what happened in the past tense, because by then the roll knows: `+1× if red wins`
on the throw becomes `🟥 Red took it: +1×` or `🟥 Red didn't win. No bonus.` A face that named the
losing side still gets a frame — it was on the table, and silence would read as a bug. Ratts skips
the phase entirely: the run ended when he stood up, and a multiple climbing toward a payout that was
never coming is a fake-out rather than a reveal.

This walk had a cap too (`maxPayFrames`, 4) and it was the one doing real work — the Greed Cube pays
on five faces in six, and a Binder or a Mirror can put a second copy of it on the table, so there is
no natural ceiling on how many a roll can throw. The embed kept the **last** frames rather than the
first, so the walk started partway along and no frame ever showed a number that wasn't true.

Both caps are dead letters now: they live in `RENDER` in `data/discord/cube_emoji.js` and are read
only by `src/interactions/cube*.js`, which is the retired board. **A long roll is paced rather than
truncated** — `BEAT.effect` and `BEAT.pay` are about a second each, so a rack that throws a dozen
paying faces takes its time and says all of it. That is the price of a roll explaining itself, and
it is only paid by a rack that earned it.

Once special cubes are in play a roll gets one more beat, because the line that lands is not
necessarily the line that counts. The reveal animates the cubes **as rolled** — a special shows
the face it landed on — and the payout frame swaps in the **resolved** line with the effects
listed underneath it as subtext. A reroll adds one frame before all that: the roll that didn't
count, shown once in full, with what saved it. See [Special cubes](#28-special-cubes).

### 2.3 The start screen

The idle board is the only frame that carries fields, because it's the only one not about a
roll in progress:

```
  Your record
  <:grandmaster:> Prestige 2 · max stake 4,000     ← "Deepest Level 4 · …" before any prestige
  💰 Best standing 16,000
  <a:chance_cube:> Biggest roll 13 cubes
  ✖️ Biggest multiple 27.5×                        ← only once a rack has moved it off the ladder
  🔥 On 9 in a row · best 9  <a:newrecord:>
  📈 Won 142,000  ·  📉 Lost 98,000  ·  🧾 Spent 4,500

  Blue vs Red
  🟦 picked 52% · won 52% · rolled 51%
  🟥 picked 48% · won 46% · rolled 49%
  100 calls · 316 cubes rolled

  Your rack · 8/8 on the table
  <a:DyeGon:> Wild Cube · <a:binder:> Binder Cube · …      ← eight seats, because eight is what a
  The bag is full — swap one out to field another.           run draws. The line below it appears
  On the bench: 💰 Greed Cube · 🪞 Mirror Cube               only with the table full and cubes
  <a:restart:> Rerolls banked 3 · next costs 33,750          still on the bench

  On a tie
  <:SlyGon:> Qui-Gon's Nudge — his tie-breaker leans 60/40 your way
  🤝 Bribe ties — next one costs 25% of the standing

  [ 🟦 Blue ] [ 🟥 Red ] [ ? ]
  [ 📀 Stake: 1,000 ] [ Rack: 2/2 ] [ Buy reroll ×3 · 33,750 ] [ Prestige 3 ]
```

The headline of that field swaps once you've prestiged. "Deepest level" stops meaning anything
after a reset — you've been to the top and handed it back, so a Level 2 on the current climb
would read as a downgrade — and the prestige takes its place, bringing the stake ceiling it
bought along with it.

**picked** is the share of calls that went to that side, **won** is how often calls on it came
good, **rolled** is the share of individual cube faces that landed there. All three are the
player's own lifetime history — a fresh account gets no fields at all rather than a wall of
dashes, and a side never called shows `—` for its win rate instead of a fake 0%.

**The rack screen carries a lifetime record per cube**, one entry per distinct face, in the order
the faces sit on the cube — so the line reads the way the cube is built and you can see which half
of a Mirror you keep getting:

```
<:BallQuadinaros:> Multiplier Cube · on the table
  Four faces double the payout if their own side wins. Two break the cube.
  47 thrown · <Ball> 12 · <Maja> 11 · <wipeout> 24 shattered
```

Faces are keyed by kind *and* side (`side:red`, `mult:blue`), because Shmi's four red and one blue
are both `side` and that split is exactly what's worth seeing. `end` is runs the cube has killed and
`broken` is times it has shattered, so those two fall out of the same counter rather than needing
their own — and they are the two named in words, since "ended 3 runs" is the number people open this
screen for.

**Each cube is titled with all six of its faces**, not its single icon — `🟥 🟥 🟥 🟥 🟦 <:wipeout:>
**Shmi Cube**`. The *shape* of a cube is what you are choosing between on this screen, and four reds
against one blue and a wipeout says more about Shmi than her name does. The title says how a cube is
built; the counts underneath say how it has actually landed.

That page has no fixed size — it grows with every cube owned — and in the Activity that costs
nothing: it is a scrolling panel, so every cube gets its faces, its blurb and its tallies however
many are owned.

**Your rack** is the only field that isn't history, and it only appears once a prestige has
handed something over — so most of a first climb never sees it at all. Everything owned is
listed, split into what's on the table and what's on the bench, because a cube nobody equipped
never rolls and that is exactly the kind of thing a player should not have to go looking for.

**On a tie** is a separate field and has to be, because *Your rack* is a list of **things you field**
and neither [tie pick](#210-ties) is a cube: they can't be equipped and they aren't drawn into a line.
Anything listed under that heading reads as something that goes on the table. They earn a place on the
screen for the same reason the bench does — a prestige each, and they only fire on a roll most climbs
never see.

**Biggest roll** is the longest line ever left standing *after* the effects finished with it, so it
is the record a Mirror conjuring and a Symbiont inserting are actually chasing — and it counts
**positions**, not the cubes that counted toward the majority, because a line of thirteen is a line
of thirteen however many of them were effects. It badges on the count in the level header
(`13 cubes <a:newrecord:>`) and only ever on the **paying** frame: the length is known the
moment the line resolves, but the player doesn't know it until the effects have played out, and a
badge during the reveal would give away that something grew the line.

**Biggest multiple** is the same idea applied to the other number in that header: the largest
payout multiple a roll has ever stood at, ladder and paying faces together. It is recorded **win or
lose**, exactly like the cube count — a bust at ×48 is still the biggest multiple that player has
ever built, and filing it only on a win would hide the one number a [Greed](#28-special-cubes) rack
exists to move. It badges on the multiple in the header (`27.5× <a:newrecord:>`) and, like the
count, only on the **paying** frame: the number is settled the moment the line resolves, but the
player watches it build across [phase two](#22-how-a-roll-plays-back), and a badge riding it from
the throw would announce the ending.

On the start screen it only earns a line once a rack has actually moved it. Without paying cubes the
multiple is just the deepest level's own payout restated, and the line above already says how deep
they got.

Beating any of these records wears `<a:newrecord:>`, appended to the value that broke it the way the
daily challenge and tourney results do it — no separate announcement line. The level header can
therefore carry three at once on a first climb, one on each value: the deepest-level badge on the
level, the count badge on the count, the multiple badge on the multiple. The deepest-level badge is
safe from the very first frame, because *reaching* a level is settled the moment you push into it;
the standing badge only appears on the payout line, since it depends on how the cubes land.

**Streak** is consecutive correct calls, and it is the one stat that genuinely spans games:
only a wrong call breaks it, so banking carries it forward and a long streak can outlive several
runs. It sits on the start screen deliberately — that's the screen you're looking at in the
second before you call again, which is where a live streak creates the most tension.

Its `<a:newrecord:>` badge works differently from the other two: it marks a streak that *is*
the record (`streak === bestStreak`), which is a true statement about the present rather than a
moment flag that would linger on the board until the next roll.

Because it's a personal sample, `rolled` drifting off 50/50 says nothing about the cube; it
takes hundreds of cubes to mean anything, which is half the fun of showing it. A server-wide
version would be a separate counter node, and is the ghost of the ledger that used to be here.

**Won** and **Lost** are the lifetime trugut ledger, accumulated in exactly the net amounts
the result lines quote — busted stakes on one side, banked profit on the other.
So the totals are the literal sum of everything the player was ever told, and `won - lost - spent`
reconciles against the balance the mode has moved. `recordWon`/`recordLost` are called at the
two points where truguts actually move (bust, bank), never inferred afterwards. There was a third
until the pot came out, and dropping it is the whole of what that removal did to this ledger.

**Spent** is the third column: truguts handed over for *something* rather than wagered — [bought
rerolls](#29-rerolls) and [bought ties](#210-ties), via `recordSpent`. They were on the loss ledger
until they earned their own, and they don't belong there: nothing was ever riding on them. A bribe
that wins the run still cost what it cost, and counting it as a loss made `📉 Lost` read as though
the cubes had taken money the player chose to spend. Both are things you can only buy after a
prestige hands over the right to, so the line only appears once one of them has been bought —
until then there is nothing to say and the ledger stays two numbers wide. Historic spends stay
where they were recorded; nothing is migrated backwards out of `Lost`.

Tallies live at `users/<key>/random/cube` as whole `calls`/`wins`/`rolled` objects, written
once per roll alongside whatever else the settlement changed. `recordRoll` **replaces** those
objects rather than mutating them, because a frame mid-reveal is still holding a shallow
pre-roll snapshot and would otherwise follow the reference into the new numbers.

### 2.4 The ladder

A run carries a **set of cubes** and throws the whole thing every level. It opens with one cube, and
every level after puts **two more** on the table — so an undamaged set runs 1→3→5→7→9, exactly the
counts below, and the payout ladder is unchanged.

**The cubes persist; the sides never do.** Every level throws all of them again, so each call stays
a fresh 50/50 rather than a defence of the last one — but anything destroyed is destroyed for the
rest of the climb. A Tusken that culls a cube at Level 2 leaves you a cube short at Levels 3, 4 and
5, which also means an **even** count and a live [tie](#210-ties) all the way up. `N` below is
therefore the count of an *undamaged* set; the header shows **what is actually on the table** and
nothing else, which is the only framing that survives a line that grows — see
[the level header](#22-how-a-roll-plays-back).

**Neither does position.** The set is shuffled on every throw, so where a cube lands is a property
of the throw rather than of the cube. A Binder that cloned onto the cube at its right last level comes
down somewhere else this one, a Mirror has a different half of the line behind it, and the two cubes
a level adds are not stuck on the end where they were appended. Without it every position-dependent
face resolved against the same neighbours for a whole climb, which made a carried set far more
predictable than a thrown one has any business being — and it costs the Binder real value, because a
randomly-placed cube meets the ends of the line, where a clone has nothing to copy from or nowhere
to put it, more often than a settled one does.

Each level wears the goal-time symbol for its depth — the set run backwards, bronze at Level 1 up to
diamond at the top.

| Level | Name | Cubes | Pays | P(win) |
|---|---|---|---|---|
| 1 🥉 | A Friendly Wager | 1 | **1.9×** | 50% |
| 2 🥈 | Test Your Luck | 3 | **3.8×** | 50% |
| 3 🥇 | Rolling Thunder | 5 | **7.3×** | 50% |
| 4 <:platinum:> | Gamblers and Swindlers | 7 | **14.2×** | 50% |
| 5 💎 | Fate Decides | 9 | **27.5×** | 50% |

**That `Pays` column is computed, not chosen.** It is `levelStep^n` exactly — so it cannot go stale
the way a hand-typed `2, 4, 8, 16, 32` did the moment the step was priced — and it is quoted here at
**one decimal, which is how the client draws every multiple**. The exact figures are what the wire
carries and what the money is computed from; a run's multiple is a float from its first rung, and
`×7.301384000000001` is what an unrounded readout printed. It is also what a
level is worth on a fully collapsed road and nothing else: the five levels are not the whole route —
see [the road](#27-the-road) — and the multiple is carried by the run rather than looked up. **A
level multiplies it by `levelStep`, an Again adds one.** On a padded road Level 2 sits further along
and pays more, because more coin flips went into reaching it.

**The majority of an odd number of fair cubes is exactly 50/50 at every level.** Nine cubes
are no harder to call than one — depth buys multiple and variance, nothing else.

**So a level push is a priced bet and an Again is a worse one.** A rung is a coin flip, so its fair
price is `2×`; it pays `1.94×`, which keeps 3% of every push. `M → M+1` on an Again is a bad bet that
gets worse as `M` grows, bottoming out at 0.5. The house edge now lives on both kinds of rung — 3%
uniformly on the levels, because a fair cube makes every rung the same coin flip and one number
prices them all, and the rest on the Agains, which is still where a player pays for *progress* rather
than for depth. See [the economy](#3-economy).

### 2.5 Prestige and the stake ceiling

A single roll is capped, and the cap is the whole reward for prestiging — **📀1,000, doubled per
prestige**:

| Prestige | Max stake | | Prestige | Max stake |
|---|---|---|---|---|
| 0 | 📀1,000 | | 5 | 📀32,000 |
| 1 | 📀2,000 | | 6 | 📀64,000 |
| 2 | 📀4,000 | | 7 | 📀128,000 |
| 3 | 📀8,000 | | 8 | 📀256,000 |
| 4 | 📀16,000 | | 9 | 📀512,000 |

Tying wager size to progression rather than to a bank balance is what stops a new player
putting their net worth on one coin flip. It also means the ladder is always the same five
levels — what changes is what a level is worth.

**The step was ×5 and is now ×2**, which is the single biggest correction the progression has
taken. The ceiling is the only thing a prestige *guarantees* — the rack pick runs out after
seventeen — so what matters about the step is not how impressive it reads on the offer screen but
how long the cap goes on binding. Measured against live balances (median holder 📀77,418, p75
📀478k), a ×5 ceiling passes the median player's entire net worth at **prestige 3**, about 217
runs in. From there the headline reward is a number they can never reach, and every prestige
after it is carried by the rack alone. At ×2 it binds through **prestige 7**, which is roughly as
long as there are picks left to take — the two halves of a prestige run out together instead of
one dying five prestiges early.

The old step also set the reroll price, which is scaled by the same figure: a prestige-8 reroll
cost 📀977M at ×5 against 📀640k at ×2. Scaling rerolls with the ceiling is right; ×5 made it
meaningless.

**Prestige is offered, never forced.** Survive Level 5 once and the offer sits there indefinitely;
you can keep playing a collapsed road at the old stake ceiling as long as you like, Agains past the
top included. Taking it locks Levels 2–5 again, **fills the gaps back in with Agains**, doubles the
ceiling, and lets you take one thing off Watto's rack. Nothing in the lifetime record resets — deepest level, best standing,
won/lost, the rack and the per-side rates all carry across.

Level names live only in `LEVELS`; every line of copy about the top of the ladder interpolates
`LEVELS[MAX_LEVEL].name`, and Watto's top-level dialogue says "nine cubes" rather than naming
it — so renaming a level can't leave a stale string behind.

**Every *other* prestige adds one more Again to each gap, and it stops at five** — 1 per gap at
prestige 0 and 1, 2 at prestige 2 and 3, 3 at 4 and 5, 4 at 6 and 7, then 5 from prestige 8 onward
and never more. One per prestige made the fourth re-walk a slog: the road stays the same five
levels, so the grind has to grow slower than the reward. The map simply grows a tile per gap, so the
visual language doesn't change — and the road getting visibly longer is now what a prestige *looks*
like.

The cost of a whole prestige cycle is **`30(g+1) + 2` runs**, where `g` is the Agains per gap — the
forced-bank model's `30c + 2` with `c = g + 1`, measured to the run and derived in
[§2.7](#27-the-road). So the first prestige is 62 runs, about half an hour, and every extra Again
adds 30 runs to every cycle after it. Those are the same numbers the ladder shipped with; the
one-step offset in `g` is what absorbs the frontier moving a rung deeper.

**What pays for that growth is the rack**, not patience: a Shortcut cube measures a **2.2×**
speedup on a re-climb, which is close to exactly what +1 clear every other prestige costs. That
pairing is why the rate is right and why the cap has to exist — the rack is *finite*. Watto's rack
holds seventeen distinct picks, and once they are gone there is nothing left to accelerate with,
while an uncapped requirement would go on charging more for less forever: 243 runs a cycle at
prestige 13, and 362 — nearly three hours — by prestige 22, for nothing at all. That last clause used
to read "for a slot you may not need", which was the `+1 slot` pick standing in as the thing an
endgame prestige was still worth. It isn't on the rack any more, so past seventeen a prestige buys the
ceiling and stops — which is why the cap on the requirement matters more now, not less.

Five is where it stops. That is 181 runs a cycle on an empty rack and about 82 with a Shortcut on
it — a steady state a player can sit in indefinitely — and it binds nowhere before prestige 8, so
it costs the progression the mode is actually designed for nothing at all. The cap is for the
endgame past the rack, not for the climb through it.

**The number used to be set by what could be drawn.** The old xp bar spent one custom emoji per
clear needed, inline in an embed description, and twelve of those wrap on a phone — so the cap was a
drawing limit wearing a rule's clothes. [The road map](#the-map) replaced it and the constraint went
with it, which is why `maxClears` is now argued for on pacing alone.

At the top of the ladder the clears meter retargets from a level unlock to the prestige offer,
so the same bar and the same `awardClear` path drive both. That gate is the one thing that
does **not** scale — `clearsToPrestige` stays at **1**. Clearing the top level is a 1-in-32 run
on top of every clear at every level beneath it, and the re-climb already got longer; scaling
the gate as well would price prestige out of reach.

The prestige icon is `<:grandmaster:>`, the top of the existing rank-symbol ladder, taken as
`level_symbols[length - 1]` so it tracks whatever that ladder's top rank is. It replaces the
padlock on the clears meter at max level — a level unlock is a padlock, a prestige is a rank.

The **thing you take off the rack is the confirmation** — there is no separate confirm button,
which keeps a destructive action to one deliberate gesture while still stating plainly what it
costs. The handler re-checks both eligibility *and* the reward on the select rather than trusting
the offer screen, so a stale menu can neither reset a ladder twice nor grant a cube twice.

**Watto's rack** — the pool you pick *from*, not to be confused with *Your rack*, the loadout on
the start screen — holds seventeen things: the fourteen [special cubes](#28-special-cubes) and three
**one-time perks that are not cubes at all**: **purchase rerolls** and the two [tie](#210-ties) picks,
**Qui-Gon's Nudge** and **Bribe Ties**. Cubes already owned drop off the list and each perk is offered
once, so **the rack is finite and it empties** — take all seventeen and a prestige is worth its stake
ceiling and nothing more. Seventeen options against a select-menu limit of twenty-five means the list
never needs paging.

**There was an eighteenth, and cutting it is the biggest correction the prestige rack has taken.**
`+1 Special Cube Slot` raised a cap on how many cubes could be equipped at once, one prestige at a
time — and it was the only entry on the rack worth **nothing on its own**. A slot with an empty bench
does nothing; a benched cube with no slot does nothing. Because their values were exactly
anti-correlated the pick never had two answers: whichever you were short of was the one to take, so
half of every prestige went on making the other half work, and a cube taken with the rack full arrived
**inert** — the pick reported success and changed nothing you could see.

Past the [bag's](#28-special-cubes) eight seats it was worse than pointless: there is nothing above
the bag to sell, so slots nine and up bought *nothing measurable at all*, and the game charged a
prestige for each and said so nowhere.

So the **purchase** is gone and the cap isn't: every rack fields eight from the first prestige
onwards, which is what the bag was always going to allow. What you choose is *which* eight — the
rest sit on the bench, owned and swappable between runs. See [the bag](#28-special-cubes).

The three perks are stored as plain flags rather than in `cubes`, so nothing about them touches the
loadout: they can't be equipped, can't be benched and never appear in a line.
They are also all worth **nothing on their own**, and that is deliberate: rerolls need a run
that busts, and the tie picks need a rack destructive enough to leave an even line. Every one of
them is a bet on a rack you already have.

An earlier draft made the prestige pick a **cosmetic face palette** instead, six pairs of blue
and red emoji. That went: a palette is a second screen's worth of plumbing threaded through every
function that draws a cube, in exchange for nothing the player can play with. There is one pair
of faces now — 🟦 and 🟥 — and prestige buys something that changes a roll.

The stored stake is clamped **on read as well as on write**, so a stake saved before the
ceiling existed can't stay oversized. A modal only ever renders two strings the user is sure
to see — the title and the input label — so the current cap goes in the title and the way to
raise it goes in the label. A placeholder would be invisible behind the prefilled value.

The cap does eventually stop binding — funds are verified at stake time anyway, so nothing breaks
when it does — but under ×2 that happens around prestige 7 for a typical holder rather than
prestige 3, which is the whole reason the step changed. It binds where it matters, and it goes on
mattering for about as long as the rack does.

### 2.6 Whose board it is

**Every board is its own player's, and the token is what says so.** The API is reached through
`requireAuth` — a JWT minted from the player's own Discord OAuth — and then `requireCube`, which
checks the collection and returns `locked: true` rather than a board. Every route serves the player
the token names, so ownership is not something the board has to defend; it is the only thing the
server can answer.

That replaced a real guard rather than a theoretical one. The embed board was a **public message**,
so anyone in the channel could press its buttons and the handler would read state for whoever
pressed — a bystander clicking Blue on someone else's board would have staked their *own* truguts
against a screen they didn't own. Every component therefore carried its owner's discord id as the
last segment of its custom_id, and a press from anyone else was refused before the unlock gate.
None of that is needed when the transport is an authenticated request instead of a shared message.

**What went with it is the audience**, and that is worth recording as a gap rather than a decision.
The channel used to watch every roll land, which is exactly why the separate in-channel
announcement was reserved for **clearing the top level** and nothing else — everything smaller was
already on screen for everyone who cared. That announcement still exists, in `interactions/cube.js`,
which is the retired board; nothing on the Activity path has replaced it. **The mode now has no
shared object at all** — the daily lean was the last one, and [pricing it honestly meant deleting
it](#21-the-cube-is-fair-and-the-edge-is-in-the-pay-table). Whatever replaces it has to be something
the whole channel can see without it also being something the whole channel can farm.

### 2.7 The road

The ladder is not five levels, it is a **road of rungs**. Five of them are levels — where two more
cubes come out of the bag — and between each pair sits a gap holding **Agains**: the same table
thrown again, for nothing but the right to move on.

```
run 1   🥉 ─ ▱ ─ 🔒          win L1, win the Again → it's gone
run 2   🥉 ─ 🔒              win L1, bust
run 3   🥉 ─ 🔒              …
        🥉 ─ 🥈 ─ ▱ ─ 🔒     the gap closed: 🥈 opens mid-run, two cubes hit the
                              table, and the standing pushes straight into it
```

**Surviving an Again collapses it permanently.** It is never on your road again, so every run that
gets one rung further than the last makes a visible, permanent change to the board. Eventually a
prestige run is exactly 🥉🥈🥇💠💎 with nothing in between — and then a prestige pads it out again.

**Nothing forces a stop.** A run ends because it busted or because the player banked, and those are
the only two. What this replaced was a rule that force-banked you for *winning* at your ceiling —
the one ending in the mode that came out of a database field rather than off the table, and it fired
on the best roll of the run.

Past Level 5 the Agains keep coming. They clear nothing — the prestige is already earned — so they
are worth truguts and nothing else, and there is no level above them to double what they add. That
makes them a **third kind of rung**: `overtime`, paying `overtimeBonus` rather than the usual +1.

At +1 an overtime push bought one trugut per stake against a base of 27.48, marginal EV 0.518 falling
toward 0.5 — which is not a decision, it is a formality nobody sane takes, and an option nobody
would ever choose is a stop wearing a button. At **+5** it is merely a bad bet: 0.591 at ×27.48,
0.531 at ×81.82. It is safe at any value below the collapsed top, because an overtime push is
`(M + N) / 2M` and `M` is never lower than 27.48 up there — so the ceiling on that dial is arithmetic
rather than taste, and it moves with `levelStep`.

**The road needs no state of its own.** Gaps fill strictly in order, so `unlocked` (how many have
filled) and `clears` (how far into the current one you are) describe it completely — the same two
fields the old clears meter kept. A profile written by the previous model reads back as a valid
road, which is why this shipped without a migration.

#### Why a gap holds one Again where the meter took two

The pacing had to survive the change, and the first attempt at it was wrong in a way worth keeping
on the record. A ceiling clear sat at rung `k+1` and the run force-banked with exactly one, so
`E[clears/run] = 2^-(k+1)`. A frontier Again sits at rung `k+2` — twice as deep — but the run
doesn't stop, so it can chain several, and `Σ 2^-(k+1+i) = 2^-(k+1)` exactly. That identity is real
and it is not the answer: **the chain is capped at the size of the gap**, and a truncated geometric
is worth much less than a whole one. At two Agains a gap the cap costs 50%.

Measured over 20k cycles a side, the route at `g` costs exactly what the ladder cost at `g + 1`:

| Agains per gap | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| road | 61.7 | 92.5 | 121.8 | 153.0 | 181.3 |
| old ladder | 31.7 | 62.1 | 92.3 | 121.6 | 152.2 |

The bottom row reproduces `30c + 2` to the run, so the closed form is intact and only its argument
moved. `clearsToUnlock: 1` therefore holds the shipped curve rung for rung — 62 runs a cycle at
prestige 0, 92 from prestige 2, 122 from 4, 153 from 6 — and `maxClears: 5` carries it one gap past
anything the old ladder charged: 181 from prestige 8, and never more.

#### Clears, and what they buy

**Only Level 1 starts unlocked** — after every prestige as well as at the very beginning. Filling a
gap is what opens the next level, and Watto grudgingly puts two more cubes on the table.

#### The map

The old xp bar is gone and the **road map** replaced it: the five levels drawn left to right with
the Agains still standing between them, `🥉 ▰▱ 🥈 ▱▱ 🥇 ▱▱ 💠 ▱▱ 💎 → 🔒 Prestige 3`.

**Cleared Agains are kept and filled in, never dropped.** The run skips them — that is the whole
reward — but a map that deleted them would shorten mysteriously instead of visibly, and the visible
part is the point. So it is a progress bar a player watches over a whole prestige rather than a
counter that resets at every level.

**The road has to fit on one line at its longest**, and in the Activity that is a measurement rather
than a guess. At `maxClears: 5` the longest road is five medals and twenty tiles: 7px tiles and 2px
gaps bring it to 332px of the 335px a 375px phone leaves, with the medals still at their full 24px —
so it fits, and it fits with nothing to spare. Overshooting would not overflow, which is why this
has to be measured rather than watched for: every tile is a flex item with a definite width, so the
row shrinks its own children instead and the medals go first. That is what 9px tiles and a 4px gap
were quietly already doing at sixteen tiles. A sixth Again needs thinner tiles first. The
sketch above draws the tiles as plain unicode and the levels as custom emoji, which is how the embed
made it fit — a text tile being a fraction of the width of an emoji was the whole trick, and it is
what let `maxClears` go back to being about pacing instead of about wrapping.

The frontier tile is `▨` while a run is rolling toward it, `✖` on the Again a bust just died on, and
flat otherwise. Progress itself is untouched either way — **a failed Again costs the run, not the
road**.

Each frame carries the road state it should draw rather than reading live state, and that is
load-bearing rather than tidy: settlement runs during the first beat of the reveal, so a frame drawn
while the cubes are still face-down is describing a road the server has already moved on. Reading
live would fill the tile a second before the cubes said whether it had been earned. The frame that
*fills* a gap shows
it completed rather than the next gap's empty tiles.

Cashing out short of a rung is not a clear. The road only shortens for rungs you actually stood on.

#### Unlocking mid-run

**A gap that fills does not end the run** — nothing does. Two more cubes come out of the bag and the
standing pushes straight into the level it just opened. This is an ordering rule as much as a design
one: the clear is awarded *before* the bank/push decision, because deciding first and unlocking
second handed the player a key and shut the door in the same breath.

**And it chains.** A run that clears the last Again of one gap can push into the level it opened and
start on the next gap in the same breath — the old rule capped this at one level per run, because
the run was ending anyway. A lucky enough run can take a whole prestige cycle.

The same ordering protects the prestige. Surviving Level 5 earns it, and `awardClear` writes it into
that throw's patch, which `settleThrow` commits before the frame is drawn. So a player who pushes on
into overtime and busts three Agains later **keeps it** — the one thing a later bust must not be
able to take back.

A run that ends — either way — turns the board **red** for a bust or **green** for a bank and
collapses the controls to a single **Play again**, so there is never any question about whether
something is still live.

One live run per player, persisted at `challenge/cube/live/ladders/<discordId>`, so a restart or a
closed window never eats a standing. Every action carries a turn counter checked on arrival;
without it a double-click on Call would stake twice against one run.

### 2.8 Special cubes

Fourteen cubes, one taken off the rack per prestige, and they are the only thing the ladder's flat
50/50 ever bends for. A special cube **substitutes** one of the level's plain cubes rather than
joining them, so the line stays the length the header says and the base count stays odd.

**Pure Cubes live here now.** Every cube landing on your called side is a **Pure Cube**; all of
them against you is **Watto's Cackle**. A pure pays **`pureBonus` per cube on the line** — a swept
nine is `+9×` on top of whatever the ladder and the paying faces had already built. The Cackle pays
nothing, because it is a bust. Both are called out on the board because they are the prettiest
things the mode can draw.

There was a jackpot **pot** behind the pure once, and this bonus is deliberately not a second run
at it; see [Cut on purpose](#cut-on-purpose). The pot paid a share of a *jar*, which did not scale
with the stake and made the minimum stake strictly dominant. A multiple rides the standing, so it
scales with the stake exactly as every other payout in the mode does. Per cube rather than flat
because the odds of collecting it halve with every cube the line grows while the bonus only climbs
by one — generous on a three, self-limiting on a nineteen.

A pure is judged on the **resolved** line and needs **every position on it to be a cube, all of
them your way**. An effect face kills a pure however the rest of it landed, which keeps *all nine
landed blue* literally true — and now that a pure pays, it is also what stops a rack of effect
cubes farming the bonus off a shortened count. It is what makes the is-a-side / does-a-thing
split below visible in play too: a rack of effect cubes
almost never sweeps — a pure 5 falls from **3.11%** of Level 3 rolls on an empty rack to **0.45%**
on a full one — while a **wild counts as whatever you called** and takes the same rate *up* to
**3.68%**, above an empty rack. Shmi and Anakin do the same on the side they force.

**Cubes come out of a bag, and the bag is shuffled once per run.** It holds one entry per cube the
climb will ever add — every special on your rack, padded out with ordinary cubes — and each level
pulls two off the top. Nothing goes back in. Once a special is out it stays on the table and throws
again every level for the rest of the run.

Drawing **without replacement** is the whole mechanic, and the escalation falls out of it rather
than being bolted on: the longer the bag hands you ordinary cubes, the shorter it gets and the
likelier the next pull is one of yours. With a single special in a bag of eight, the four pulls run:

| Pull | L2 | L3 | L4 | L5 |
|---|---|---|---|---|
| chance of a special, given none yet | 25% | 33% | 50% | **certain** |

Measured at 24.9 / 33.4 / 50.1 / 100 over 200k climbs, against the hypergeometric prediction of
25 / 33.3 / 50 / 100. **A cube you equipped is a cube you will meet** — the only question is when,
and the answer gets more urgent every level it hasn't shown up.

It also retires the old `spent` draw rule for free: a special is in the bag exactly once, so a
shattered one can never come back because there is nothing left to draw.

Two cubes are never from the bag, and they are the two exceptions worth naming: the cube **Level 1
opens with**, which is always ordinary so the set has something to decide a roll with, and
**Watto's tie-breaker**, which is his and was never part of the ladder's count anyway.

That is the single biggest lever in the mode now, and it cuts both ways hard. A Greed caught at
Level 2 adds to a multiple that every level above it then doubles — and a Ratts face it rolls three
levels later still ends the run. Damage is permanent in the same way: a special a Fode, a Padmé, a mirror or a clone writes over
is an ordinary cube from then on, and a wipeout takes the special off the table for good while
leaving the cube behind.

One guardrail: **a set always keeps something on it that can decide a roll**, because a set with
nothing plain in it has nothing to decide one. That is also what keeps a special off Level 1, where
the set is one cube long.

**The road turned that into a real trap, and the way out has to be rolled for.** The guardrail used
to live only in `drawCubes`, which runs when a level adds cubes — but damage happens during
*resolution* and was never re-checked, and an Again does not draw at all. So a set chewed down to
cubes that carry no side stayed that way for every rung after it: the line lands, nothing counts,
and Watto's cube settles it, over and over. Three cubes make that permanent rather than temporary,
because they have no downside face and so never leave the table — the **Mirror**, the **Binder** and
the **Gungan Shield**.

Measured over 30k runs on a full rack: **9.6% reached a table that could not decide a roll**, 6.9%
reached one that could never recover, and the worst run tied **twelve times in a row**.

So **a tie you rolled for and won puts a plain cube on the table** — never one you bought. That is
the whole of the rule, and it turns the trap into a decision rather than a rescue:

- **Roll it.** A 40% shot (60% with the Nudge). Survive and the table can decide again, for good.
- **Bribe it.** Certain survival on this rung, and the same wall on the next one — at a price
  [1.5× dearer every time](#210-ties), against a standing that has grown.

A player who does not own Bribe Ties is never asked, so their tie always rolls and always breaks the
loop. The trap exists only for someone holding the way out and repeatedly declining to use the cubes,
which is the shape a trap should have.

**It applies to every tie, not only to a table that can never recover**, and that is measured rather
than generous. A tie has to be *survived* at 40% to collect, so it lands about once in twelve runs.
Over 40k runs a full rack's average end table moved **2.2 → 2.3** cubes, the pure rate **0.16% →
0.21%**, and tie streaks got shorter rather than longer — more countable cubes is fewer even counts,
so the rule damps the thing that causes it. The narrower version needed a "can this table ever
decide" test and a special case for the three cubes that can't; this needs neither, and gives the
same guarantee, because a deadlocked table ties *every* roll and so meets the rule immediately.

The cube **arrives rather than replacing one**, which is the opposite of what `drawCubes` does and
deliberately so. On a draw, cubes are arriving anyway and turning one plain costs nothing the player
had; here the set is whatever damage left behind, and converting would destroy somebody's last cube
as a punishment for a state their own rack created. It is said out loud on the frame — a cube
appearing from nowhere reads as a bug otherwise.

It is also, deliberately, **not his tie-breaker**. That cube is weighted 60/40 against your call, and
a weighted cube joining the set permanently would cost 5–10% of the win rate on every remaining rung
(EV 0.80 on a one-cube line, 0.945 on nine) — and, worse, **invert with the Nudge** to 1.20 and 1.075,
putting the ladder above even money, which is the one thing the whole payout design forbids. What
arrives is an ordinary cube.

A face counts as a side-maker if it lands on one: `side`, `wild`, and the Symbiont's `twins`, which
inserts a matching pair and so conjures a majority. `pair` is excluded on purpose — it inserts one
of each and leaves the count exactly as even as it found it. The test reads the cube's own face
list rather than a list of ids, so a new cube is covered the day it is added.

**A line can grow as well as shrink.** Three faces lengthen it: the **Mirror**, conjuring the cubes
it needs to finish a reflection, and the Symbiont's **Fode** and **Padmé**, which *insert* a cube
either side of themselves rather than overwriting what is already there — a red and a blue for Fode,
so the pair is a wash in the count and pure structure, and a matching pair for Padmé, the only face
that hands one side two cubes out of nowhere. None of the three is capped — see below. Everything else shortens
the line or leaves it alone, and the header stays honest by showing the count on the table rather
than the count the level is named for.

That is why the header no longer reads `5 of 7 cubes`. The comparison was written when damage was
the only thing that could move the count and the level's own number was the thing you had lost
against; once the line started growing at least as often as it shrinks, the same format produced
`7 of 5 cubes`, which reads as an arithmetic error rather than as a windfall. No framing works in
both directions, so the header shows one number.

Inserting rather than overwriting is also what makes those two *visible*: they push their neighbours
apart, which every positional face resolving after them then has to deal with.

An equipped cube reaches the table by being **drawn**, not by passing a per-roll check — the flat
25% this paragraph used to describe is now the *first* pull out of the bag and it climbs from there.
Each cube is in the bag exactly once, so a loadout can't stack the same cube twice and a full rack is
met in full over a climb.

**The loadout is capped at eight, and the cap is the bag.** Eight is what the four drawing levels
take, so eight is what a rack fields: the bag holds one entry per equipped cube, *padded* out to the
eight seats. Everything else you own sits on the bench, swappable between runs and never in the bag.

That makes the loadout a decision about **which** rather than **how many** — and it is what lets the
promise above stand without an asterisk: every cube on your table is a cube the climb will reach. The
[Pit Droid](#28-special-cubes) doesn't change that, it changes *when*: its `draw` pulls off the back of
the bag, front-loading a cube the levels would have got to later, which is worth having because a
special met at Level 2 throws four more times than the same cube met at Level 5.

The cap is enforced in three places — the loadout save, a granted cube, and again when the profile is
read, so a rack saved under an older rule comes back fielding its first eight rather than breaking.

Two other models were tried and both leaked. A **cap bought a prestige at a time** is what
[§2.5](#25-prestige-and-the-stake-ceiling) is about: a slot and a cube were complements sold as
substitutes, and above eight the slot bought nothing at all. Then an **uncapped loadout**, where a
longer rack made a longer bag and everything behind the eighth entry was a bench inside the bag — sold
as trading certainty for variety, it played as cubes that don't turn up.

**A face either IS a side, or DOES a thing. Never both.** An effect face — greed, mirror, clone,
shortcut, all of them — holds its position in the line and contributes **nothing to the red or blue
count**. Only `wild` and `side` produce a side, because producing a side is the whole of what they
do. The Multiplier is the edge that proves the rule: its faces *name* the side they pay on without
*being* one, so they don't count either.

That rule exists because the alternative was tried and it broke the screen. Effect faces used to
carry a side as well, which meant each one had to be drawn as a colour square **plus** an effect —
`🟦💰`, `🟥🪞` — two glyphs for one position. At the `# ` heading size the cubes are drawn at, a
seven-cube line holding two specials read as **nine cubes**. Widening the gaps didn't fix it and
couldn't: the fix was to stop asking one face to say two things at once. Every face is a single
emoji now, and one glyph is one position, always — which is verifiable rather than a matter of
taste, and is asserted over 80,000 rolls in the test harness.

The cost is real and was worth paying: an effect face **takes a cube out of the count without
shortening the line**, so even counts are common rather than exceptional. Ties go from 0% on an
empty rack to ~6% with one cube equipped and ~11–16% with several. That is only survivable because
a tie now goes to [Watto's tie-breaker](#210-ties) instead of straight to the house — this change
and that one only work together, and neither would have shipped alone.

It also means the line says something it never used to. `🟦 🟥 💰 🟦 🟥 🪞 🟥` is seven positions
of which **five count**, and you can see that by looking at it.

| Cube | Faces | What it does |
|---|---|---|
| **Wild** | 5 × wild, **1 × Ratts** | The position lands on whatever side you called. |
| **Greed** | 5 × 💰, **1 × Ratts** | **+0.5** on the run's multiple, which every level above it then doubles. |
| **Shmi** | 4 red, 1 blue, 1 × wipeout | Forces red — red was his mother. |
| **Anakin** | 4 blue, 1 red, 1 × wipeout | Forces blue — blue was the boy. |
| **Mirror** | 3 × 🪞, 3 × 🔄 | Reflects everything to its left onto its right — **special cubes included** — or inverts the whole line. |
| **Symbiont** | Tusken, Ben, 2 × Fode, 2 × Padme | Takes one cube at random, razes both neighbours into **one wide Ben**, or **slips two new cubes in** either side of itself — a red and a blue for Fode, matching twins for Padmé. |
| **Shortcut** | 5 × shortcut, **1 × Ratts** | A free clear, if the level is won. |
| **Reroll** | 3 × reroll, **1 × Ratts**, 2 × wipeout | Banks **+1 reroll** if the level is won, and stays on the table. Only a wipeout shatters it. |
| **Binder** | 3 burn, 3 clone | Burns the cube on its right, or makes it a **copy of the cube on its left**. A clone at the head of the line destroys instead; at the tail it adds. |
| **Multiplier** | 2 red, 2 blue, 2 × wipeout | **+1** on the run's multiple, but only if that face's side is the one that wins. |
| **Gungan Shield** | 6 × shield | Stops a mine's blast on its own side of the line, and is destroyed doing it. Also holds a neighbouring cube together through a wipeout, which costs it nothing. No downside face. |
| **Pit Droid** | 5 × draw, 1 × purge | Pulls another cube out of the **back of the bag** and slips it in on its right, thrown and live. On a rack of eight or fewer that front-loads the climb; on a bigger one it is the **only** way to reach the cubes the levels never get to. The purge scraps every special on the line, itself included. |
| **Boost** | 4 × boost, 2 × wipeout | **+0.25** per position on the resolved line — it pays for a table that got away from you rather than for anything it did itself. |
| **Sebulba** | 2 × engine left, 2 × engine right, 2 × wipeout | Points an engine one way and burns that cube over to your call, but only if it landed against you. The direction is rolled, which nothing else in the game does. |

Two faces are the price of all that, and they are on the cubes that pay best:

- **Ratts is a mine, and he takes himself with him.** He detonates in his turn during the second pass:
  the blast starts on his own position and spreads out from it in both directions, stopped only by a
  Gungan Shield. Everything it reaches leaves the line, himself included. He is 1 face on Wild, Greed,
  Shortcut and Reroll.

  Something can still get to him first — a cull, a raze, a clone or a mirror writing over his position
  takes him off the table before his turn comes and **the run survives**. The cubes can save you from
  him, which turns a destructive rack from pure downside into an insurance policy, and turns the reveal
  into a real beat: Ratts lands, then something eats him. On a five-cube rack **19.4%** of the rolls
  that throw him end up saved.

  **A shield is broken by the blast and stops it anyway.** The blast reaches it and no further: it goes
  off the line with everything between, and every position beyond it is untouched. It dies holding the
  line rather than instead of holding it. Two shields contain a mine between them, one stops it on its
  own flank, and none lets it take the row; all three fall out of the same two lookups.

  It is genuinely destroyed — not spent-but-standing, which is what it was first built as, and which put
  an intact shield on the line after a blast and left the player to read the note to find out it had done
  anything. **So a shielded blast can still empty the line**, when the shield was at the edge with
  nothing behind it to save. Measured over 400k throws: 7,757 shielded detonations, of which **1,392
  (18%) ended the run anyway** and 6,365 were survived. The shield buys you what was standing behind it,
  which is not the same as buying you the roll.

  **The run ends when there is nothing left on the table.** Not nothing that counts — an effect face is
  still a cube standing there, and a line with positions but no countable cubes has no majority, which
  is a tie for Watto to break and has always been survivable. Having no line *at all* is the different
  thing. An unshielded blast takes every position and gets there; a shielded one never does, because the
  shield it was stopped by is left standing, and a position on the table is a roll still going.

  He used to end it by *being visible on the final line*, which was the invariant while he stayed put in
  his own crater. That had to go with him: it made his position the one place the blast could not reach,
  so the count walked over a cube that was not there and the ending was read off his presence rather than
  off the table. Measured over 400k throws: `end` never survives onto a resolved line, every detonation
  takes at least one position, and no shielded mine has ever emptied a line.
- **A wipeout shatters the cube, and it comes off the line.** Not replaced by an ordinary cube, not
  flagged and left sitting there being drawn — **removed**, in its turn during the second pass like
  every other effect, so the throw shows the wipeout face landing and its own step shows the row
  closing over the gap. The table is a cube shorter for every level above it, and the special is
  `spent` and can't be drawn again. On a rack of one that turns the rest of the climb plain *and*
  short. It sits on Shmi, Anakin, the Multiplier and the Reroll Cube.

  Resolving it in the second pass rather than the first is what buys the frame — and it means the
  set shrinks with no extra bookkeeping, because the position is genuinely gone rather than merely
  marked. Measured over 200k rolls: a shattered cube is **never** still drawn, the line is exactly
  as many cubes shorter as there were shatters, and every shatter gets its own reveal frame.

**A shatter is the wipeout's job and nothing else's.** The Reroll Cube briefly shattered *itself* on
every payout, as a brake on how often it could bank — which worked, and cost the cube its own
identity: it reported a shatter every single time it did its job, and never once showed the face
that actually breaks it. The brake is a wipeout face now — **two** in six, as on the Multiplier;
Shmi and Anakin carry one apiece. Anything the shatter line names has genuinely been destroyed, and
it draws as the wipeout, because that is what happened to it.

**The variant table further down predates this brake and has not been re-measured against it.** Its
shipped row is `2 Ratts, cracks` — four banking faces, two Ratts, and the reroll face spending the
cube on payout. What ships now is three banking faces, one Ratts and two wipeouts, which is a third
distribution again: the once-per-run cap survived the redesign but is enforced by a face the player
can see rather than by the payout, and the EV of that has never been simulated. Read `tuning.js` for
what the cube does; treat **1.72** as the number for a cube that no longer exists.

Resolution is **two passes over the line**, because a cube's own side has to be settled before
anything starts copying or fusing cubes around it: first every face that decides a side or sets a
modifier, then every face that restructures, left to right in the order they were rolled. A cube
destroyed or overwritten by an earlier effect doesn't get its turn.

**A turn that changed nothing is still a turn, and the reveal says so.** A Binder with nothing on its
right to burn, a Pit Droid reaching into an empty bag, a Mirror with no room — each writes its note and
gets a frame, marked `quiet` because the line did not move. They used to be dropped outright, which
made a face that took its turn and found nothing to do indistinguishable on screen from one that
never got a turn at all. The flag survives the client that needed it — the embed could afford three
effect frames and spent them on faces that did something, where the Activity draws every one.

**A copy of a face is a face, and takes its own turn.** A cloned Greed pays, a reflected Tusken
culls. That means the second pass can't be a walk over the thrown line — it is a **work queue**, and
the line grows turns as it resolves. Three rules bound it, and without them it doesn't terminate:

1. **Only an original hands out turns.** A copy acts, but anything *it* copies is inert. One level
   deep, so a Binder cloning a Binder cloning a Binder stops at the second.
2. **A mirror reflected by a mirror never acts** — the one cascade with no natural end. A Binder
   *cloning* a mirror does work, because a clone is one copy onto one fixed target and cannot feed
   itself.
3. **A copied Pit Droid still draws**, whoever copied it — the exception to rule 1, and the same
   exception a cube off the bag already gets. A `draw` spends the bag, which is finite and never
   refilled, so it cannot feed itself however deep the copying goes.

**A turn handed out mid-pass goes next, not last.** Every cube a face conjures lands on its *right* — a
reflection, a clone, a cube off the Pit Droid's bag — which is where the walk is heading, so that is
where its turn belongs. Appending it instead put it behind every original still waiting, and the line
stopped resolving left to right: a Tusken at position 9 culling before a reflection at position 4 that
was already on the table when its turn came.

That is not just an ordering nicety, because acting late means acting into a line other cubes have
already chewed through. Measured over 400k throws, of the Binders a Mirror reflected: **3,772 clones and
119 burns never got a turn at all**, destroyed while they waited, and a further 1,451 burns took their
turn to find nothing left on their right. Giving them the next turn instead: **640 and 0**, and no burn
finds an empty space. A Mirror reflecting a Binder now does what it looks like it does.

Where a face hands out several — a Mirror reflecting a run — they keep the order it made them in,
nearest the glass first, so the run resolves left to right like everything else rather than backwards.

A copy needs no payout turn of its own, and a cloned Greed still adds **+1** rather than +0.5 — it
adds it by standing on the resolved line twice, which is where every payout is now read from. It used
to need one: the originals were scored in the first pass and a copy was never in it, so each paying
kind had to be applied a second time from a second place, with `mult`, `end` and `broken` carved out
of that list for three different reasons. One pass over one line replaces all of it.

**A cube off the bag is live whoever drew it**, and that is deliberately not the one-level rule. A Pit
Droid that was itself a copy used to hand over an inert cube, because the rule that stops copies
multiplying was doing the queueing for both. Draws cannot multiply — the bag is finite and never
refilled, so every draw is one fewer cube later in the climb — and the cost of lumping them in was a
**Ratts that never went off**: a mine sitting on the resolved line, doing nothing, on a roll it should
have ended. Six of those in 400k throws, all on lines a Mirror had reflected a Pit Droid onto. A drawn
cube is still marked `copy`, so what *it* hands out stays bounded the same way everything else is.

Stress-tested at 200k full-rack rolls of fifteen cubes: no hangs, slowest single roll **6ms**, most
effect steps in one roll **9**. That last number retires a claim in
[§2.2](#22-how-a-roll-plays-back) that three was the natural ceiling — it was, until copies could
act. Nothing caps the animation now, so all nine play.

**Symbiont's raze is the only destructive face that keeps parity**, because it takes both neighbours
at once; Tusken's cull takes exactly one — never itself, chosen uniformly from every other position
on the line — so it flips it.

**The Mirror doubles the half behind it.** This section used to claim the reflection *cancelled*
what it copied, so that a full one handed the decision to whatever lay beyond it. That was simply
wrong, and measurement says so: a reflection copies **sides**, and a copy of blue is blue, so a left
half running 3–1 blue comes back 6–2 blue. The mirror doesn't neutralise the line, it makes the half
behind it decide the whole roll, twice over. It only produces a tie when that half was already even.

**The reflection completes itself.** Where there aren't enough cubes on its right to receive the
copy, the Mirror **conjures the ones it needs** — it duplicates the table rather than being
truncated by the end of the line. It grows the line on about 43% of reflections.

**And it reflects special cubes as themselves.** A Binder behind the glass comes back as a Binder,
drawing the face its original drew and counting whatever its original counts, so `🟥 :binder: 🪞`
reflects to `🟥 :binder: 🪞 :binder: 🟥` — a real image rather than a colour-only rubbing.

**A copy takes its own turn.** A reflected Tusken culls, a reflected Greed pays, a reflected mult
multiplies — the copy is a real face, not a picture of one. It is also a **real cube from the next
level**, which is how a Mirror ends up handing you a second copy of something off your own rack:
32.5% of reflections do, and that duplicate throws its own face and can be destroyed independently
of the original.

That needs bounding, and two rules do it — see [§2.8](#28-special-cubes). The one that belongs here:
**a mirror reflected by a mirror never acts.** A reflection that reflects, reflects again, and that
is the single cascade with no natural end. A Binder *cloning* a mirror is fine and does work, because
a clone is one copy onto one fixed target and cannot feed itself.

It is worth almost nothing in EV (0.87, unmoved) and a great deal in texture, and the reason is
worth keeping: a lone Mirror has nothing to duplicate, and on a mixed rack copying a Wild is exactly
as likely as copying a Shortcut.

**There is no ceiling on this.** `maxCubes` is `Infinity`: a Mirror finishing its reflection, a Fode
or Padmé slipping cubes in, a Binder appending at the tail — none of them are held back, and because
the set carries across levels a table that grows keeps growing. A run where the line gets away from
you is the interesting one.

In practice it stays modest, because the ladder is only five levels and the bag only holds eight
cubes: over 40,000 full-rack climbs **64% finished under ten cubes**, 29% between ten and twenty,
and the longest line ever drawn was **114**. Nothing is unbounded in *time* either — a throw resolves
in one pass over a queue only originals feed, and the slowest single throw measured 4ms.

Drawing a runaway table is the client's problem and no longer the engine's. The embed needed a
`LINE_BUDGET` — it drew as many cubes as fit and counted the rest (`… **+37**`) — because a
description running past 4,096 characters made discord.js throw rather than trim. That budget still
sits in `interactions/cube/functions.js` with the rest of the retired board; the Activity lays the
line out and scrolls it. A table that got away from you should read as a triumph, not a crash.

**Ben is drawn across three positions.** A raze doesn't delete its neighbours from the line — it
replaces them with his left and right thirds, so `<:WideBen1:> <:WideBen2:> <:WideBen3:>` reads as
one wide Ben lying over the cubes he just ate.

**And he survives the mirror.** A reflection reverses the order it copies in, so his thirds would
come back `right · middle · left` — Ben inside out. Each wing therefore carries the emoji it becomes
when reflected, and the copy swaps them, so a whole Ben reflects into another whole Ben facing the
right way. The mechanism is general — any face declaring a `mirrored` counterpart flips in the glass
— but Ben is the only art in the game with a handedness to lose. The destruction is entirely real: the wings carry no
side, they can't be swept, and they are dropped from the set, so the table is two cubes shorter from
the next level on. What changed is only that you get to watch it happen instead of finding a row
mysteriously two cubes short. At the end of a line he loses the wing that has nowhere to go, which
reads as him hanging off the edge. The art lives on the face itself as `wings` in `SPECIALS`,
alongside every other piece of face art.

**A wild is immune to an invert.** It isn't a side — it is *whatever you called* — and an invert
flips the line, not your call. So it keeps counting your way and keeps drawing as Qui-Gon.

This was found the hard way. A real Level 5 roll came out
`:restart: 🔄 :DyeGon: 🟦 :DyeGon: :andotent: 🟥` on a blue call, which anyone reads as a comfortable
blue majority — and it was scored **1 blue to 3 red** and paid out as a bust, because the invert had
flipped both wilds while they carried on drawing as Qui-Gon. Two things were wrong at once: the rule,
and the art. With wilds immune that roll is **3 blue to 1 red, a win**, which is what the cubes said
all along.

**A face asserting a *fixed* side still drops its art when flipped.** Shmi's red and Anakin's blue
are genuine sides, so an invert does flip them — and the cube then draws as the side it now counts
as, rather than sitting there showing 🟥 while counting blue. Measured at 0 cubes drawing a colour
they don't count, over 200k rolls of which half contained an invert.

**The Binder does one thing: the cube on its right becomes a copy of the cube on its left.** It
destroys nothing and adds nothing — the line is exactly as long afterwards, one position of it is
just now a duplicate — and it copies whatever is there, so a special on its left comes out twice.
`💰 :binder: 🟥` resolves to `💰 :binder: 💰` and leaves the set `[greed, binder, greed]` — **and the
copy pays**, so that roll adds +1 to the run's multiple rather than +0.5.

It is one of two ways to get a second copy of a cube off your own rack, the Mirror being the other,
and the only one that does it without a reflection.

**At the edges it does the same sentence a different way, rather than nothing.** At the head of the
line it has no source to copy, so it **destroys** the cube on its right — the position was going to
become something else either way, and taking it off the table is the honest version of that. At the
tail it has nowhere to put the copy, so it **makes room**: the copy is appended as a new cube. That
is the only case where a clone lengthens a line, and the only reason it needs the ceiling.

```
:binder: 🟥 🟦   ->   :binder: 🟦            head: destroys
🟥 🟦 :binder:   ->   🟥 🟦 :binder: 🟦      tail: adds
```

A cloned cube is **turned**, like a reflected one: cloning Ben's left third onto the right would
otherwise put two of the same third on the table. A cloned wing is junk either way — it carries
`gone` across, so it drops out of the set next level.

> **Cut:** this cube used to burn on half its faces and turn into a **hybrid** of its two neighbours
> on the other half — a synthetic cube whose faces were both parents' pooled, giving 45 pairings.
> It worked, and it needed a whole cube-construction system to exist: composite ids in the set,
> `specialById` building cubes on demand, a `roll` face so an ordinary cube could be half of one, and
> a rule forbidding hybrids of hybrids. That is a great deal of machinery for a cube whose idea is
> *copying*, and cloning says the same thing in one sentence. A set persisted with a hybrid id in it
> degrades gracefully — `specialById` returns null and the position throws as an ordinary cube.

**A tie is settled by Watto's own cube.** See [Ties](#210-ties).

**The multiple rides the run, not the roll.** The ladder node carries a `mult` that *is* the
payout multiple — not a bonus applied to one. Each push doubles it, Greed and Multiplier add to it,
and the header, the bank figure and the push figure all read it from the moment it lands. A run
that never triggers one doubles 2 → 4 → 8 → 16 → 32 and matches the published ladder exactly.

Two places must not re-step it, and both are easy to get wrong. A **parked tie** stores the multiple
it was already playing for, so answering the tie takes it as-is; and a **reroll** replays a level
that was already stepped, so it has to start from what the run *entered* that level with. The ladder
node therefore keeps both figures — `mult`, what this roll is playing for, and `carry`, what came in
— and the dead node a reroll picks up stores the second.

### 2.9 Rerolls

**Rerolls are banked, and spent on a game over screen.** A run that dies with one in the bank gets
a `🔄 Reroll ×n` button beside `Play again`, and pressing it buys back the roll that killed you:
the same level, the same call, the same stake, rolled again.

`Play again` is **always the first button and always the primary**, whether or not a reroll is on
offer. A reroll spends something the player bought, and a spend must never be what muscle memory
hits — so the reflex position holds the action that costs nothing, and the reroll sits second and
quieter, taken deliberately or not at all. Keeping `Play again` in the same slot on every game
over screen is the point: a button that moves depending on your stock is a button that eventually
gets pressed by accident.

Two sources, one stock: a **Reroll Cube** face banks one **if the roll survives**, and once the rack
has handed over **Purchase Rerolls**, a button on the idle board sells them.

It used to bank whatever the roll did. That made the cube that lost the run pay for a second attempt
at it: a Reroll Cube standing in the busting line handed back the very thing that undoes the bust, and
the game-over screen offered a reroll earned by the roll it was offering to erase. Nothing else on a
line pays off a bust — the standing goes, the clear is not awarded, the multiple was only ever a
multiple of a standing — and this is no longer the exception. **Only the stock the player brought to
the roll can buy it back.**

The offer lives on that screen and nowhere else. `Play again`, calling a side, or anything else
declines it; `/chubacubes` walks back to it, so a standing offer survives being closed. That is the whole
lifecycle, and it works because **the bust is already fully settled before the offer appears** —
the stake is gone, the loss is on the ledger, the streak is broken. Letting an offer lapse
leaks nothing, and a crash mid-offer leaves a correctly-busted run.

**A reroll buys back the roll, not the draw.** The same cubes are picked up and thrown again: same
count, same specials, nothing added, removed or swapped — only the sides, the faces and the order
move. The dead run therefore stores the table **as it was thrown**, and the replay skips `growSet`
entirely (`regrow: false`). Regrowing would have quietly rerolled the *loadout* as well, handing
back a different pair of cubes and sometimes different specials, which is a second thing the player
never asked to gamble on.

Which means spending a reroll is a **reversal of exactly one number**: the stake comes back off
the lifetime loss. It was two while the pot existed — the jar had to give back precisely the
floored share it took — and that pairing is gone with it. Nothing else needs undoing, because the stake left the player's
balance when the *run* started, not on the roll that killed it. The dead run is held at the usual
`ladders/<id>` node marked `dead`, so `ladderOf` refuses it everywhere a standing would be assumed
and only `deadOf` can see it.

The tallies from the void roll are deliberately **not** reversed. It was rolled, it was called, and
it broke the streak — a reroll is a second call rather than a rewrite, and `100 calls` on the start
screen means a hundred rolls.

Bought rerolls are priced off the **stake ceiling** rather than the stake on the table, because
they are bought on the idle board and spent later; pricing them off the current stake would just
mean buying at 📀100 and cashing in at the cap. 📀2,500 at prestige 0, doubling per prestige — and
**×1.5 for every reroll already in stock**, which is the whole anti-hoarding rule and needs no
counter of its own: the stock *is* the escalation, so spending them brings the price back down.
That matters more than it looks, because a stocked reroll is the strongest thing in the mode.

A purchase goes on the lifetime **spend** with `recordSpent` rather than on the loss ledger — it is
a price, not a wager — so `won - lost - spent` still reconciles against the balance the mode has
moved. See [the start screen](#23-the-start-screen).

**A Shortcut clear is the only progress ever made off a rung that isn't an Again** — it collapses
one wherever it lands, including from a level rung, and the run carries on. It can therefore open a
level *mid-run*, which then becomes pushable immediately. One guard: it pays nothing once the whole
road is open, because there is no gap left to pay into. Without that, a shortcut on a one-cube Level 1 wager would
hand over the prestige gate that is meant to cost a run at the top of the ladder.

### 2.10 Ties

A roll ties when the cubes that **count** come out even. The ladder's own cube counts are all odd
precisely so that can't happen on its own, so a tie is always something a special cube did — either
a destructive face shortening the line, or, far more often, an [effect face](#28-special-cubes)
holding a position without counting toward either colour.

That makes ties a **core mechanic rather than an edge case**: none at all on an empty rack, ~6% of
rolls with one cube equipped, and 11–16% with several. The tie-breaker is not a rare curiosity you
might see once a week — on a loaded rack it decides roughly one roll in seven.

**Watto settles it with a cube of his own, and his own cube is weighted 60/40 against your call.**
Not toward a colour — against *you*, whichever side you picked. That is the one number in the mode
that is quietly on the house's side, so it doesn't get to stay quiet: it's printed on the frame
where his cube comes out.

It reads as an extra beat rather than an extra rule. The line lands as usual, fails to decide, and
then one more cube tumbles out beside it — set apart by a wider gap than the one between cubes,
because it is **not one of the level's cubes** and must never read as the roll having grown a
tenth. It stays there face-up on the payout frame, since it decided the roll.

```
  🥇 Level 3 · Rolling Thunder · 5 cubes · 8×
  Called 🟦 Blue · 1,000 staked
# 🟦 🟥 🟦 🟥  ·  <a:chance_cube>          ← his cube, face-down, apart from the line

  "Even cubes, nobody wins. Lucky for you I gotta cube right here."

  <a:Whatto> His cube is weighted 60/40 against you.
```

It is deliberately **not** drawn through `rollSide`. That is the one place in the mode where a
weighted coin is still correct: `rollSide` is a fair cube and this leans against *your call* rather
than toward a colour, so keeping them apart is what lets the fair one stay provably fair.
It is also **not** counted in the player's `rolled` tallies, for the same reason: it isn't theirs.

Two things change that, and they are the only things in the game that do. **Neither is a special
cube.** They are one-time picks off Watto's rack, granted at a prestige and held for good — like
*Purchase Rerolls*, and unlike everything in [§2.8](#28-special-cubes). They are never equipped,
never occupy a slot, never appear in a line, and are stored as plain flags on the profile rather
than in `cubes`:

| One-time prestige pick | What it does |
|---|---|
| <:SlyGon:> **Qui-Gon's Nudge** | The same weight, turned around — his cube lands **60/40 your way**. |
| 🤝 **Bribe Ties** | Adds the option to buy a tie outright, for a share of what it pays. |

The Nudge doesn't make the tie-breaker *fair*; it makes it yours. A tie is always somebody's coin
flip and never a neutral one, which is a more interesting object than a 50/50 would be — and it
keeps the Nudge legible, because it's the same number pointing the other way.

**The bribe is the only decision a roll ever asks for**, and it only appears for a player holding
that pick. Everything else in a roll is settled before the cubes are drawn.

```
  [ 🎲 Roll Watto's cube ]  [ 🤝 Bribe 4,000 ]  [ ? ]
```

Rolling his cube is the **primary**, because it's the choice that costs nothing — the same rule
that keeps `Play again` under the reflex click on a game over screen. A spend never gets to be the
button muscle memory hits.

The price is **25% of the standing the tie would pay, ×1.5 for every bribe already paid**, and the
count **resets at prestige**. A share rather than a flat price because the standing doubles every
level and a flat price would be free money at the top; a reset because a permanent escalation would
eventually price the pick out of the game for good, and a rack pick that stops doing anything is
worse than one that was never offered — which is exactly the charge that eventually retired
[`+1 Special Cube Slot`](#25-prestige-and-the-stake-ceiling).

**The offer is never withdrawn.** Own the pick and every tie is one you get asked about, at whatever
the ladder has climbed to. On a 📀16,000 standing it runs 4,000 → 6,000 → 9,000 → 13,500 → 20,250 →
30,375 and keeps going, and the fourth rung onward costs more than the tie itself pays.

He used to stop asking at that crossover, on the grounds that there was nothing left to weigh. There
was, and the sum was being done wrong on the player's behalf. **A lost tie is a bust** — the stake
and the standing both go and the run is over — while a bought one keeps the climb alive to push again
at double. So the price is not weighed against this level's payout but against the rest of the run,
and at Level 4 with a standing worth pushing, a tie dearer than the level pays can still be the
cheapest thing on the table. Whether it is depends on what the player means to do next, which is
exactly the thing the game cannot know.

The two picks still **interact**, and against each other: his cube pays you 0.4 × the standing in
expectation, so measured on *this level alone* a bribe beats rolling under 40% of it — the first two
rungs. Hold the Nudge as well and his cube is worth 0.6 × the standing, so only the first rung clears
that bar. Owning both makes each one worth less than owning either. Read those as the floor rather
than the answer: they price the tie as if banking immediately, and a run that intends to push is
buying more than the tie.

**A tie broken your way is a win in every sense** — it pays, it clears, it keeps the streak — with
one exception: it is **never a Pure Cube**. A swept line has a majority in it by definition, so a
line that tied can't have been swept.

#### What a parked tie is

A tie the player is being *asked* about is the only place a roll stops mid-flight, and it settles
**nothing** while it waits — no tallies, no clears, no ledger. The whole roll is written to
the usual `ladders/<id>` node marked `tie` during the same beat settlement would have used, which
buys three things:

- A crash mid-animation leaves a tie `/chubacubes` can still walk back to and finish.
- Because nothing was written, every frame drawn off that node an hour later reads the same state
  it read at the time — the clears meter and the deepest-level badge included.
- `ladderOf` refuses it, exactly like a `dead` run, so **bank** and **push** can't see a standing
  that hasn't been won yet. Everything else that refuses to run mid-run — the stake, the rack, the
  prestige offer — has to ask for it by name, which is what `busy()` is for.

A parked tie **blocks the board** until it's answered, and that is not a soft-lock, because rolling
his cube is always free. The one thing that would be a soft-lock is guarded: a stored tie on a level
the data no longer has is released rather than left blocking forever.

---

## 3. Economy

Nothing is raked at the door. **The levels are priced instead: a rung is a coin flip worth `2×` and
it pays `1.94×`, so the house keeps 3% of every push.** Because the cube is fair, the majority of any
odd number of cubes is also exactly 0.500, so that 3% is identical at all five rungs — one number
prices the whole road and no rung is looser than another:

| Bank at | Survival | Pays | EV per stake |
|---|---|---|---|
| Level 1 | 50.0% | 1.94× | **0.970** |
| Level 2 | 25.0% | 3.76× | 0.941 |
| Level 3 | 12.5% | 7.3× | 0.913 |
| Level 4 | 6.3% | 14.16× | 0.885 |
| Level 5 | 3.1% | 27.48× | **0.859** |

Depth is therefore no longer free: it is variance **and** compounding cost, 3% a rung, 14% over a
full collapsed climb.

**This reverses what §3 used to say, and measurement is what reversed it.** The ladder was a clean
double — EV exactly 1.000 at every level, the whole edge in the Agains, depth a pure variance choice.
It read beautifully and it did not survive being measured: with the cube fair and the ladder exactly
fair, an **empty rack still returned 1.31 and a hand-picked eight 2.09**, because `pureBonus` and the
special cubes sit on top of the ladder and nothing sat against them. A mode whose ladder is exactly
fair and whose cubes are better than fair is a faucet. The ladder is the one surface every player
touches on every roll, which makes it the cheapest place to charge and the only place a single number
can charge evenly.

**3% is the genre's number, not a guess.** Crash, Mines and Tower are the same cash-out ladder and all
price it the same way — `payout = RTP × fair odds`, 96–99% a step, with the shave folded into the
multiplier where it is invisible. A steeper step was measured and rejected: `1.90` keeps 23% of a full
climb, which is keno rather than a casino.

**The Agains are still the steeper edge by a long way.** An Again turns `M` into `M+1` on a coin flip,
which is EV `(M+1)/2M` — 0.72 on the first one out of Level 1, and asymptotically 0.5 as the base
grows, against a flat 0.97 on a level. So the two prices stay legible and stay in the same order:
progress is expensive, depth is merely not free.

**And because the levels multiply, an Again compounds.** One banked in the first gap is multiplied by
L2, L3, L4 and L5, so it is worth **14.16×** what it added; one banked in the last gap is worth 1.94.
A collapsed road tops out at **27.48×**, a fresh one runs 54.65× at `g=1` to 163.33× at `g=5`, and
**every Again you bank takes its compounded value off that peak forever**:

| Road (g=2) | Rungs | Peak | Odds of sweeping it |
|---|---|---|---|
| fresh prestige | 13 | **81.82×** | 1 in 8,192 |
| gap 1 closed | 11 | 53.49× | 1 in 2,048 |
| gap 2 closed | 9 | 38.89× | 1 in 512 |
| gap 3 closed | 7 | 31.36× | 1 in 128 |
| collapsed | 5 | 27.48× | 1 in 32 |

The peak is no longer the tidy `32 + 30g` it was under a clean double — the closed form went when the
step stopped being 2, and these are computed from `levelStep` and `againBonus` rather than quoted.

The prize shrinks as the odds improve, so the biggest number in the game exists **only on a fresh
prestige**. That is the one thing a player gives up by making progress, and it is why the prestige
screen quotes the peak the new road is worth.

**Sub-exponential schemes were tried first and all of them failed the same way.** Ordinal addends
(`rung n adds n`), flat addends (an Again adds its level's number), and `2^n` levels with `+1`
Agains were each measured. Two results killed them. The shallow rungs are where the grind actually
lives — the frontier Again sits at rung `k+2` for `k` in 1–4 — and every additive schedule taxes
exactly those hardest; flat addends charge 25% on the very first clear a player ever earns. And a
rung is fair **only if it doubles the multiple**, since you are risking `M` to hold `M'` on a coin
flip, so any schedule steep enough to stay fair *is* the exponential — which is exactly why the edge
is expressed as a *fraction of that double* rather than as a different shape. Multiplying the levels
and adding on the Agains is the only form that keeps the ladder legible, bounds the tail linearly in
the padding, and leaves the compounding the paying cubes were measured against intact.

**Nothing in the mode mints, and that is new.** Payouts are gross on the original stake, so the
2× table already assumes busted stakes are what pays winners — which means a fair ladder has no
spare money in it, and anything skimming off a bust to fund a second prize is spending the same
truguts twice. The Pure Cube pot did exactly that and was the mode's only faucet; it is gone, and
the reasoning is in [Cut on purpose](#cut-on-purpose). A busted stake now simply leaves.

So the whole economy is three numbers: the levels keep **3% a rung**, the **Agains** keep far more,
and `pureBonus` and the rack pay some of it back. That makes the cube a sink at the ladder and not yet
a sink at the table — worth stating plainly rather than claiming the win. Measured on the priced
ladder at a fair cube, 20k climbs a row, banking wherever it pays best: an **empty rack 1.10–1.15**,
**greed + wild 1.14–1.16**, a **hand-picked eight 1.55–1.99**, and only *every cube at once* — the bag
caps at eight, so that rack is deliberately bad — bleeding at 0.97.

**`pureBonus` and the rack are what is left above water, and they are the next job.** The pure bonus
adds `n × pureBonus` to a rung of `n` cubes, and that term is **front-loaded at the shallow end**,
because a short line is the one that sweeps often enough to matter:

| rung | cubes | pure rate | EV/stake, bonus off | on | change |
|---|---|---|---|---|---|
| Level 2 | 3 | 12.9% | 1.00 | 1.39 | **+40%** |
| Level 3 | 5 | 3.4% | 1.00 | 1.17 | +17% |
| Level 4 | 7 | 0.96% | 1.00 | 1.06 | +6% |
| Level 5 | 9 | 0.27% | 1.00 | 1.03 | +2% |

*400k rolls per row, empty rack, `pureBonus: 1`.* **Measured against the clean-double ladder, so the
`bonus off` column is now 0.941, 0.913, 0.885 and 0.859 rather than 1.00.** `pureBonus` itself is
untouched and the shape of the table holds, but the *relative* uplift is now slightly larger, not
smaller — the same additive bonus lands on a smaller base. The rows want re-measuring before anyone
quotes them as current.

**This is a real edge and it is worth stating rather than burying.** A three-cube line sweeps your
way one time in eight, which is not rare, so a bonus proportional to the count is worth most exactly
at the shallow end, where the priced ladder is charging least in absolute terms. It does not bring the
pot's *exploit* back — this scales with the stake, so min-staking still gains nothing — but it is most
of the reason a bare rack still measures above 1.00 on a ladder that charges 3% a rung.

Three dials, if that trade is not wanted: drop `pureBonus` (0.25 puts Level 2 at +10%), raise the
`final.length >= 3` floor in `resolveLine` so short lines are called out but not paid, or pay
`cubes - 4` so the bonus starts at a five and the shallow end drops out entirely. The last keeps the
headline number on the rare sweeps, which is the whole point of it, without paying for a coin flip.

**Special cubes are the other faucet, and half of them are drains.** A rack bends the ladder either
way, and it bends further the deeper you push, because a multiplier caught early rides every level
above it and Ratts gets more chances to turn up:

Rerolls are banked *and spent* in this measurement, and **clears per climb** is carried alongside
EV because it is a second currency that one cube trades in almost exclusively.

| Rack (1 cube fielded unless noted) | L1 | L3 | L5 | clears/climb at L5 |
|---|---|---|---|---|
| empty | 1.00 | 1.00 | 1.00 | 0.03 |
| Anakin *calling blue* | 1.00 | 1.15 | **1.38** | 0.04 |
| Wild | 1.00 | 1.16 | 1.32 | 0.04 |
| **Reroll** | 1.00 | 1.01 | 1.22 | 0.04 |
| Binder + Nudge | 1.00 | 1.02 | 1.06 | 0.03 |
| Binder + Bribe | 1.00 | 1.03 | 1.01 | 0.03 |
| Wild + Greed + Multiplier + Binder (4 fielded) | 1.00 | 1.03 | 0.97 | 0.03 |
| Binder | 1.00 | 0.98 | 0.93 | 0.03 |
| Symbiont | 1.00 | 0.96 | 0.92 | 0.03 |
| Multiplier | 1.00 | 0.97 | 0.89 | 0.03 |
| Mirror | 1.00 | 0.95 | 0.88 | 0.03 |
| Anakin *calling red* | 1.00 | 0.86 | 0.67 | 0.02 |
| Greed | 1.00 | 0.85 | 0.60 | 0.02 |
| **Shortcut** | 1.00 | 0.83 | **0.56** | **0.15** |
| …the same four, with Nudge + Bribe | 1.00 | 1.20 | 1.26 | 0.04 |

**The payout multiple is run state that doubles with the level, and paying faces add to it.** The
ladder is not a table the payout is looked up in; it is the *shape* of a number the run carries.
Each level doubles whatever the run is holding, every Greed then adds **+0.5** and every Multiplier
whose named side wins adds **+1**. A run that never sees a paying face doubles 2 → 4 → 8 → 16 → 32
and lands exactly on the published ladder, which is what makes the model invisible to a player who
never triggers it.

What it buys is that **a bonus caught early is doubled by every level above it.** A Multiplier won
on Level 2 turns ×4 into ×5, and that ×5 rides up as 10 → 20 → **40**, not 32. The same +1 caught on
Level 5 is worth exactly +1. Early is worth 16× late, and the ladder itself is the compounding
engine:

| +1 caught at | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| finishes at | ×48 | ×40 | ×36 | ×34 | ×33 |

Two earlier shapes were wrong. **Multiplying the payout** made a rack of paying cubes explode rather
than build — every copy a Binder or a Mirror made squared the effect, and a four-slot rack reached
**6.09 EV** with a ±0.34 error bar. **Adding a flat bonus to the level's multiple** fixed the
explosion but flattened the climb: it made the cube worth the same wherever it landed, which is the
one thing a press-your-luck ladder should never say. Compounding is the shape that has it both ways
— bounded, because a bonus is added once and then only doubled, and *steep*, because the doubling is
the same doubling the ladder already advertises.

They are still counted off the **resolved** line and folded in last. One a Tusken culled doesn't pay
from beyond the grave (0 ghost payouts over 66,433 culls); one a Binder cloned or a Mirror reflected
pays twice, because there really are two of them on the table; and `applyMults` runs after the
tie-breaker, so a tie broken your way still cashes them in.

**And so is every other paying face, which took a second pass to get right.** The Multiplier and Ratts
were read off the resolved line; the Greed Cube, the Shortcut and the Reroll Cube were scored in the
first pass, off the line as *thrown*. So the cubes could save you from Ratts but could not take a
payout back, and Ben lying across a Greed Cube left the multiple standing at what it had already
added — a number on the board with nothing on the board behind it, on a payout walk built to make
exactly that unreadable. Measured over 450,000 throws on a Ben-heavy rack it hit **15% of throws that
razed anything**. All four now come off one pass over the resolved line: **what is not on the table
does not pay**, and a copy counts by standing there rather than by being handed a turn of its own.

The engine's parity harness (`scripts/cubeParity.js`) diverges from its frozen pre-port reference
because of this, and should: over 3,000 climbs it reports `mult`/`pays` on 41, `rerolls` on 14,
`shortcut` on 11, and the reroll note's wording on 196 — and nothing else at all. That harness was the
gate on the *port* being faithful; it cannot also be the gate on the rules never changing.

**The bag is what makes a big rack worth building.** A single special got slightly *weaker* — the old
flat chance rolled per cube, so two cubes a level gave it a 44% look-in and it usually landed early;
the bag gives it one uniformly-placed seat in eight, so it arrives later on average even though it
now always arrives. A **four-cube rack fills half the bag**, so the whole thing deploys and deploys
fast, and the tie picks are what turn that deployment into an edge: **0.97 → 1.26** at Level 5. The
bag size, or capping how much of the bag a rack may occupy, are the levers if a loaded rack ever
takes the mode above even money on its own; on these numbers it does not.

**The two paying cubes are currently the worst things you can equip, and that is a live problem.**
Greed measures **0.60** and the Multiplier **0.89** at Level 5. The compounding helped both — Greed
was 0.57 and the Multiplier 0.88 under the flat-bonus model — but not nearly enough, because the
cost and the benefit are different *kinds* of quantity. A paying face is sideless, so the cube it
sits on contributes nothing to the majority, and under carry-over that liability is re-thrown every
level for the rest of the climb. That is a multiplicative cost against a *linear* +0.5 or +1. The
survivors bear it out: a Greed rack banks at ×34.5 on average against the clean ×32 the ladder paid
when this was measured, an 8% better payout bought with a 40% worse survival rate. (Both figures are
from the clean-double ladder; the ratio is what the row is about, and the ratio holds.)

Greed is the worse of the two and the reason is structural rather than a matter of tuning. Its sixth
face is **Ratts**, so it carries a 1-in-6 run-ender that fires on every level after it is drawn; the
Multiplier's two off-faces merely **shatter** it, which retires the sideless liability instead of
cashing it in. Sweeping the bonus confirms the shape — the Multiplier crosses 1.00 at `multBonus: 3`,
while Greed is still at **0.90 with `greedBonus: 4`**, eight times its current value:

| `multBonus` / `greedBonus` | Greed | Multiplier | 4 cubes |
|---|---|---|---|
| 1 / 0.5 *(current)* | 0.60 | 0.89 | 0.99 |
| 2 / 1 | 0.65 | 0.94 | 1.09 |
| 3 / 1.5 | 0.70 | **1.01** | 1.21 |
| 4 / 2 | 0.73 | 1.00 | 1.34 |
| 8 / 4 | 0.90 | 1.21 | 1.83 |

No bonus buys Greed out of this. The fix, if it is wanted, is to the **cube** rather than the knob:
swapping its Ratts face for a wipeout would make it shatter like the Multiplier does instead of
ending the run, at which point the sideless cost is paid once rather than every level. Left as it
is, Greed is a deliberate gamble that the numbers say is never worth taking — which is a different
thing from a hard cube, and worth deciding on rather than shipping by default.

Level 1 is 1.00 in every row, which is the guardrail doing its job: a rack is worth nothing until
you climb with it. Measured over 1M climbs per cell, which puts **±0.006** on the Level 5 column.
The figures were originally taken with the daily lean forced off, because it was *not* EV-neutral
on a deep climb — per-level probabilities multiply, so calling the leaned side compounded and
calling against it decayed, and the two never cancelled. The cube is fair now, so what was once a
correction is simply the game.

**Carry-over is what reshaped this table**, and it did so along one axis: a cube that survives on
the table fires again every level, so a good cube compounds — and a cube carrying a run-ending face
gets repeated chances to kill you. Two cubes had to be repaired for it, in opposite directions.

**Shortcut went to one Ratts face.** Two was priced for the old model, where each roll drew specials
independently; under carry-over a cube drawn at Level 2 throws again at 3, 4 and 5, and `(4/6)³ ≈
30%` survival is not a price but a death sentence. At one face it sits at **0.53 EV and 0.19
clears per climb** — against 0.03 for an empty rack. That is the cube working exactly as intended:
it is the one you equip to get *through* the ladder rather than to get paid by it, and the EV column
structurally cannot see what it actually buys.

**Reroll went the other way, and needed a new mechanic.** Left alone it banked a reroll on nearly
every level it survived — five times the old accrual rate — and measured **4.6 EV against 1.6 for
the next best cube on the rack**. More Ratts faces was the wrong lever: three of them dragged it to
0.93 and made half the cube a loss. So the **reroll face now spends the cube**: it banks the reroll
and cracks, leaving an ordinary cube behind, which makes it pay once per run instead of once per
level. With its two Ratts faces kept, that lands it at **1.72** — still the strongest thing on the
rack, as the mode's oldest note about rerolls says it should be, but 9% ahead of Greed rather than
three times the field.

| Reroll Cube variant | L3 | L5 |
|---|---|---|
| 1 Ratts, persists | 1.54 | 4.59 |
| 2 Ratts, persists | 1.12 | 2.33 |
| 1 Ratts, cracks | 1.41 | 2.34 |
| **2 Ratts, cracks** *(shipped)* | **1.13** | **1.72** |
| 3 Ratts, persists | 0.79 | 0.93 |

Five more things fall out of that table worth keeping:

- **Shmi and Anakin are side-locked mirrors.** 1.20 at Level 5 when you call the side they force,
  0.85 when you don't. They are the only cubes whose value depends on a decision you make after
  equipping them, which is the most interesting thing in the set.
- **Shortcut is the worst cube in the game and that is fine** — 0.70 at Level 5, because a third
  of its faces are Ratts and a clear is worth progress rather than truguts. It is the one cube you
  equip to get *through* the ladder rather than to get paid by it.
- **Effect cubes now pay for their effects in count, and it shows.** Every effect face takes a cube
  out of the majority, and Watto's tie-breaker leans against you, so the cubes with the most effect
  faces gave up the most: **Multiplier 1.47 → 1.21**, **Greed 1.26 → 1.17**, **Mirror 0.99 → 0.93**,
  **Symbiont 1.01 → 0.94**. The cubes whose faces *are* sides barely moved — **Wild 1.14 → 1.16**,
  **Anakin 1.20 → 1.19** — which is the rule doing exactly what it says on the tin, and a good check
  that nothing else leaked. Binder went *up* slightly (1.01 → 1.05): its faces already removed
  positions outright, so it lost less than the others to a shortened count.
- **The 60/40 tie-breaker is now a live house edge rather than a rare one.** It used to settle 2.4%
  of rolls and now settles 6–16% depending on the rack, all of it leaning toward Watto. That is the
  single biggest reason the table moved down. **`tieLean` is the dial** if it bites too hard — at
  0.55 it is barely a lean, at 0.5 a tie is an honest coin flip and the Nudge stops meaning
  anything.
- **The two tie picks don't stack.** On a Binder, the Nudge is worth **+0.10** at Level 5 and the
  Bribe **+0.05** — but holding both is worth **+0.10**, the same as the Nudge alone. They fight
  over the same rolls in both directions: the Nudge raises the bar the bribe has to beat (his cube
  now pays 0.6× the standing, not 0.4×), and the bribe's price ladder means only the first one or
  two per prestige are worth buying anyway. If they should stack, the knobs are `bribeShare` down
  or `bribeStep` down. The Bribe still earns its slot on something the EV doesn't measure — it is
  the only way to make a tie *certain*, which is worth more than its EV when a deep standing is
  riding on it.
- **Both picks are worth exactly nothing on an empty rack**, and nothing at Level 1. Like the
  reroll perk, they are a bet on a rack you already have.

Mirror's row was re-measured at **0.99/0.99** rather than the 0.98/0.95 recorded here before.
Nothing about the Mirror changed — it overwrites in place and has never been able to cause a tie —
and every other untouched row reproduces its old figure to three decimals, so the old number looks
to have been stale rather than wrong at the time.

**A stocked reroll is the strongest thing in the mode by a distance** — 3.93 against 1.14 for the
same rack without one, because it converts the first bust of a climb into another go at it. That is
what the ×1.5-per-held-reroll price is defending against, and it is the number to watch first if the
economy runs hot.

The knobs, all in `src/data/challenge/cube.js`: `specialChance` (how often a rack shows up at
all — the single strongest lever), `rerollCost` and `rerollPriceStep`, then `greedBonus` and
`multBonus`.

Guardrails in place: minimum stake 📀100, the stake ceiling above, funds verified at stake time, one live run per
player, rolls resolved server-side from `crypto.randomInt`, and no path that can produce a
negative balance.

---

## 4. Implementation

**Three layers, and the split is the point.** The rules know nothing about how they are drawn, the
API knows nothing about how they are played, and the client knows nothing it was not told.

| Concern | Where |
|---|---|
| Command | `src/commands/cube.js` — bare `/chubacubes`, no subcommands; gates and launches the Activity |
| Rules | `src/game/cube/` — `tuning.js` (every number), `engine.js` (resolution), `state.js` (the profile), `actions.js` (run lifecycle), `persist.js` |
| HTTP surface | `src/api/cube.js` — server-authoritative; abstract face ids and structured notes, never emoji or prose |
| Client | `../junkyard/src/activity/` — `board.js`, `faces.js`, `notes.js`, `rack.js`, `sheets.js`, `feed.js` |
| Special cubes | `SPECIALS` in `game/cube/tuning.js`; resolved by `resolveLine` |
| Ties | `rollTiebreak` + `applyMults` in the engine; `parkTie` / `resumeTie` / `answerTie` in `actions.js` |
| Face art | one glyph per face, never composed — Discord's map is `data/discord/cube_emoji.js`, the Activity's is `activity/faces.js` |
| Live state mirror | `src/firebase.js` listener on `challenge/cube/live` |
| Retired board | `src/interactions/cube.js`, `cube/functions.js`, `data/challenge/cube.js` — the embed. Still loaded for `isUnlocked`/`lockedEmbed` and as the parity harness's subject; it draws no game any more |
| Harnesses | `scripts/cubeParity.js` (the port is faithful), `cubeOctahedron.js`, `cubeEconomy.js`, `cubePoints.js`, `cubeFixtures.js` (client fixtures), `cubeApiSmoke.js`, `cubeActivityCheck.js` |
| Inspector | `scripts/inspectChanceCube.js` |

**State.**

```
challenge/cube/live/ladders/<discordId>   one live run per player — or one dead one, or one
                                          parked on a tie
                                          { stake, level, call, standing, mult, spent,
                                            set, roll, faces, notes, dead?, lines?,
                                            tie?, setBefore?, mults?, shortcut?, rerolls?,
                                            broken?, reverse?, flavor? }
users/<key>/random/cube                   { stake, turn, unlocked, clears,
                                            calls, wins, rolled, bestLevel, bestStanding,
                                            totalWon, totalLost, totalSpent, prestige,
                                            streak, bestStreak,
                                            cubes, equipped, rerolls, buyReroll,
                                            nudge, bribe, bribes, faces, bestCubes,
                                            bestMultiple }
```

`bag` is what the run has left to draw from — shuffled by `fillBag` when the run starts, and drawn
down two cubes a level by `drawCubes`. It uses the same `0`-for-plain encoding as `set`, for the
same Firebase reason.

`set` is the run's memory: one slot per cube on the table, holding a special's id or `null` for an
ordinary cube. It is what makes damage permanent — a destroyed cube is simply absent from it, and a
special written over comes back as `null`. `growSet` adds the level's two new cubes to it and
`throwSet` throws the result; `resolveLine` returns the survivors as the next level's set. `setBefore`
is the same thing one level earlier, kept only on a [parked tie](#210-ties) so a reroll can replay
the level from the table as it stood before its new cubes went on.

**A plain cube is stored as `0`, never `null`, and this is not cosmetic.** Firebase treats a null as
*delete this key*, and a set is mostly plain cubes — so `[null]` round-tripped as nothing at all and
`[null, null, 'greed']` came back as a set of one. A run silently lost every ordinary cube it owned
on the way to the database and regrew from the wreckage, which presented as levels adding one cube
instead of two. Every write goes through `encodeSet` and every read through `decodeSet`; no other
stored array can hold a null, so nothing else needs it.

`roll` is the resolved sides, for the count and the tallies; `faces` is the rendered emoji, so a run
picked back up draws the cubes it actually left on the table rather than flattening them to plain
colours (a run persisted before `faces` existed falls back to `sideFaces`). `dead` marks a busted
run held open for a [reroll offer](#29-rerolls) and `tie` a roll parked on the [tie
question](#210-ties); both are invisible to `ladderOf`, and the extra keys are only written for a
tie, which is the only node that has to hold an *unsettled* roll.

`cubes` is a `{ id: true }` map so a grant is a single key; `equipped` is an ordered list. Both are
read back through `SPECIALS`, so an id the data no longer has is dropped rather than trusted into a
roll, and `equipped` is filtered against what is owned on **read as well as write** — a cube sold out
from under a saved loadout can't reach the table. It is **cut to `bagSize()` on read as well**, so a
loadout stored while the rack was uncapped comes back as its first eight with the rest benched, and a
hand-edited profile cannot field nine. The write path refuses an over-long list outright (`too_many`)
rather than choosing for you. A `slots` key written by the old model is ignored either way; nothing
was migrated, because the cap it bought is now the same eight for everybody.

**No subcommands, deliberately.** Discord forces a subcommand choice once any exist.
`/chubacubes` is separate from `/chancecube` for the same reason — that command stays a plain
coin flip plus a guild-specific easter egg in `1199872145354915920` that **must be
preserved**.

**Nothing is held in memory between actions.** Every action is a fresh authenticated request that
reads the run back out of Firebase, settles, and writes — which is what makes a run survive a bot
restart, a reload, or a closed window. The embed reached the same property through persisted state
rather than collectors, and the Activity gets it for free by being stateless over HTTP.

The turn counter is the guard that survived the transport change: every action carries one and it is
checked on arrival, because without it a double-click on Call stakes twice against one run. The
owner-id-in-the-custom_id guard did not survive and did not need to — see [§2.6](#26-whose-board-it-is).

### Cut on purpose

An earlier draft had a hidden daily loading with a public server-wide ledger to read it
from, a rake, a per-player daily stake cap with prestige tiers, cosmetic face palettes, and
a multiplayer shared table. All of it went: the mode is a fast, legible press-your-luck
ladder on one screen, and every one of those systems was a second screen or a paragraph of
rules standing between the player and a roll. The ideas are in git history if the loop
proves too thin.

The one piece of that draft that came back is the unlock gate — the old "rack" of cubes won
off Watto, rebuilt as the much smaller clears counter in §2.3. A ladder where a new player
can stake into the top multiple immediately has no shape to it.

**The Pure Cube pot**, which did ship and then came out. A jar seeded at 📀25,000, fed by a
quarter of every busted stake, paying 5% / 25% / 100% of itself on a pure 5, 7 or 9. The
reasoning is worth keeping because the shape of the mistake is general rather than a tuning
miss:

- **The prize did not scale with the stake, and every other payout in the mode does.** A level
  double, a Greed, a Multiplier, a Boost — all of them multiply what you risked. The pot paid a
  share of the *jar* however little you had put up. That made the minimum stake strictly
  dominant: the ladder underneath is exactly fair at every size, so stake size bought nothing
  except a smaller share of a fixed prize. Min-stake and push deep was the whole game.
- **Shrinking the share could not fix it.** The share scaled the prize and the exploit in
  lockstep and never the ratio between them, which is what a min-staker is actually playing for.
  The only setting with no exploit in it was the setting with no pot in it.
- **It was also the mode's only faucet.** Total return was `1 + potShare × bustRate` — up to
  **1.24×** per trugut staked at `potShare: 0.25`, and 1.97× when the share was 1. A fair ladder
  has no spare money in it: busted stakes are already precisely what funds the winners, so
  routing them into a jar as well spent the same truguts twice.
- **Rarity never helped, and that is the part that misleads.** With inflow `i`, payout chance `q`
  and share `s` the jar settles at `P* = i / (q·s)` — rarity sits in the *denominator*, so a
  jackpot firing ten times less often simply rests ten times bigger and the truguts leaving over
  a year are identical. There was no tier schedule that leaked less. Measured from the other
  side: dropping the tier share 10% → 5% *raised* the resting pot 440× → 660× average stake.

What went with it was the mode's only shared object and its only prize bigger than a capped
stake. The first was covered by the daily lean for a while, and [that is gone
too](#21-the-cube-is-fair-and-the-edge-is-in-the-pay-table) — so the gap is open and §2.6 records
it. The second was never really the pot's — the peak of a fresh prestige road is the
biggest number in the game, and §3 is where it lives.

What it bought is that **every trugut lost now simply leaves.** The mode is a clean sink, the
Agains are the whole of the house edge, and there is nothing in it that mints.

**What came back, and why it is not the pot again.** Cutting the jar left a pure paying the level
flat — the rarest thing the mode can draw, worth exactly what any other win was worth. `pureBonus`
puts a price back on it as a **multiple** rather than a prize, and that single change answers every
bullet above. It scales with the stake, because a multiple rides the standing. It is not a faucet,
because it comes out of the same fair ladder every other payout does rather than out of a jar fed by
busts. And rarity now works the right way round: a bonus of one per cube grows linearly while the
odds of collecting it halve per cube, where the jar's resting size grew as fast as its rarity fell.
The pot's mistake was the jar, not the idea that a swept line should be worth something.

---

## References

Prior art consulted:

- [Watto's chance cube](https://starwars.fandom.com/wiki/Watto's_chance_cube) and
  [chance cube](https://starwars.fandom.com/wiki/Chance_cube/Legends), Wookieepedia — blue
  for the boy, red for his mother; Watto's cube was weighted and Qui-Gon nudged it.
- [Push Your Luck](https://boardgamegeek.com/boardgamemechanic/2661/push-your-luck),
  BoardGameGeek, and
  [Game Mechanics: Sometimes You Want to Push Your Luck](https://boardgamedesigncourse.com/game-mechanics-sometimes-you-want-to-push-your-luck/),
  Board Game Design Course — the bank-or-continue decision point.
- [Farkle rules](https://www.dicegamedepot.com/farkle-rules/), Dice Game Depot — escalating
  risk per throw.
- [Double or nothing](https://en.wikipedia.org/wiki/Double_or_nothing), Wikipedia —
  the 50/50 stacking wager.
- [Crash games: what they are and how they're built](https://game-ace.com/blog/crash-games-explained/),
  Game-Ace — holding house edge constant across cash-out targets so depth is variance
  rather than a penalty.
