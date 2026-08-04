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

`/chubacubes` opens one embed in the channel and the entire game happens inside it. The board is
**public** — the whole channel watches the cubes land — which costs one extra guard, see
[Ownership](#26-a-public-board). Errors stay ephemeral: a stale button or a short balance is
nobody else's business.

```
        <a:chance_cube> Botto's Chance Cube

  <:silver:> Level 2 · Test Your Luck · 3 cubes · 4×    ← records badge the value that broke them:
                                                          `5 cubes <a:newrecord:>`, `6.5× <a:newrecord:>`
  ▰▰▱ → 🔓 Level 3                       ← only on your ceiling level

  Called 🟦 Blue · 1,000 staked ✅        ← subtext, sits right on the cubes
  # 🟦 🟦 🟥                              ← heading-size cubes

  "Hmph. Lucky roll. Don'ta let it go to your head, eh?"

  Bank 4,000 or keep playing for 8,000

  [ 🟦 Push Blue ]  [ 🟥 Push Red ]  [ 💰 Bank 4,000 ]  [ ? ]

  📀 499,000  ·  ✨ Pure Cube pot 101,000        ← footer
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

Both amounts are **net** — what actually changed hands — so they match the footer balance
moving. The clears counter is deliberately not spelled out in words anywhere; the xp bar is
the only place it lives.

An end screen that earned a clear also gets one forward-looking line — `Keep playing to
unlock <:gold:> **Level 3 · Rolling Thunder** (5 dice) **8×**` — so the reason to press Play
again is on screen at the moment the player is deciding whether to.

While a run is live, the bank-or-push decision is a single line rather than a standing plus a
pitch: `Bank **4,000** or keep playing for **8,000**`.

### 2.1 The daily lean

The cube is not quite fair. **Every day one side is favoured 55/45**, and which side is never
announced — a run of red is either the lean or nothing at all, and there's no way to tell from
inside one game.

It's derived from the date rather than stored: `sha256(secret salt + ':' + eastern day)`, one
bit off the digest. No rollover race, no extra node to keep in sync, and every player rolling on
the same day is playing the same cube — which is the property that makes it worth talking about
in the channel. Memoised per day, because a nine-cube roll would otherwise hash the date nine
times. Eastern midnight, matching the daily challenge boundary.

**The salt lives in `CUBE_LEAN_SALT`, and it has to.** The lean is safe from a human — spotting
55/45 takes a few hundred cubes tallied inside one Eastern day, through the noise of every
special cube that forces a side, with no per-day readout anywhere in the UI to help. It is not
safe from a public repo. A hardcoded salt makes the day's favoured side a two-line script, and
knowing it is worth a great deal: calling the favoured side takes a Level 5 run from 1-in-32 to
about 1-in-14, an **EV of 2.27** on a ladder that is otherwise exactly fair. In the environment
it costs nothing and the shared-cube property survives intact. The bot warns at startup if it
isn't set.

Every plain cube in the game draws through `rollSide`, so the lean covers the level's own cubes
and any a special spawns, in one place.

A 55/45 edge is small enough that it never decides a call for you — over nine cubes it moves the
majority from 50% to about 60% — but it's large enough to be real across a day's play, which is
the point: it gives the table something to argue about.

### 2.2 How a roll plays back

The buttons come off and every cube goes face-down as the animated cube emoji. Then the
cubes land **a few at a time**, slot-machine style — but only up to the cube that settles
the majority. Past that point the result cannot change, so there is no tension left to milk
and everything still face-down lands at once. `decidedAt` finds that cube; `revealSteps`
spaces the frames out to it.

Each frame is a message edit, which is the binding constraint: nine cubes revealed one at a
time would spend a whole rate-limit bucket on a single roll. `maxRevealFrames` caps it at
three groups plus the full reveal, so the worst case is five edits over ~4 seconds.

Firebase settlement runs *during* the first beat, so Discord's 3s response window is never
spent waiting on a write and a crash mid-animation still leaves the ledger correct. That
creates one trap worth knowing about: **by the time the cubes start landing, the player's
balance and clears have already changed.** Frames drawn while cubes are face-down therefore
render from a snapshot taken before settlement — otherwise the footer balance and the xp bar
give the result away a full second before the reveal.

Layout constraints that took a couple of passes to find:

- **Markdown headings render in an embed description but not in a field value.** The cubes
  get `# ` for heading-size faces, which silently did nothing while the roll still lived in
  a field — that difference, not the emoji, was the problem. The called side uses `-# `
  subtext at the other end of the same scale.
- **The roll steps down through four markdown sizes as the line grows**, each threshold being the
  count at which the row stops fitting at the size above it:

  | cubes | 1–9 | 10–11 | 12–14 | 15+ |
  |---|---|---|---|---|
  | drawn at | `#` | `##` | plain | `-#` |

  A wrapped row is much worse than a smaller one — it stops being something you can count at a
  glance, which is the entire job of the line. Watto's tie-breaker adds a glyph the count doesn't
  know about, which is the headroom these numbers carry. This was two steps for a while, and the
  drop from heading straight to ordinary text was too far in one go; `##` is the rung that was
  missing.
- **Footers are plain text** — unicode emoji only, no markup, no custom emoji. Truguts and
  the pot live there precisely because they are reference numbers, not part of the roll.
- Blank lines separate the header block, the roll, Watto's line, and the result, so each beat
  reads as its own thing rather than one paragraph that keeps growing. The called side is the
  exception — it sits directly on top of the cubes with no gap, because it's a label for them.
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
- **Two action rows, and nothing in either that can't be pressed.** The top row is the roll —
  call, bank, help. The bottom row is everything you set up *before* one: the stake, the rack,
  rerolls, prestige. All of that is locked for the duration of a run and none of it is about a
  result, so the bottom row disappears entirely mid-run and on an end screen, where the top row
  collapses to `Play again`. It was one row until the rack arrived; a rack button and a reroll
  button would have put seven things in it against a limit of five.

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

Three cubes carry restructuring faces — Mirror, Symbiont, Binder — and each can hold at most one
position in a set, so **three is the real ceiling** as well as the configured one (`maxEffectFrames`).

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

The walk is capped at `maxPayFrames` (4), and unlike the effect faces that cap is doing real work —
the Greed Cube pays on five faces in six, and a Binder or a Mirror can put a second copy of it on the
table, so there is no natural ceiling on how many a roll can throw. Over the cap it keeps the **last**
frames rather than the first: each header shows the running total, so the walk simply starts partway
along and no frame ever shows a number that isn't true.

Worst case a roll is now four reveal frames, three effect frames, four multiplier frames, a tie beat
and the payout: thirteen edits over about eleven seconds, against five over four before the specials
existed. That is the price of a roll explaining itself, and it is only paid by a rack that earned it.

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

  Your rack · 2/2 slots
  <a:DyeGon:> Wild Cube · <a:binder:> Binder Cube
  On the bench: 💰 Greed Cube · 🪞 Mirror Cube
  <a:restart:> Rerolls banked 3 · next costs 33,750

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

That page has no fixed size — it grows with every cube owned, and a custom emoji costs about
twenty-five characters of the 4,096 allowed however small it looks. Six faces per cube plus tallies
runs a full rack past the limit, and discord.js **throws** on an over-long description rather than
trimming it. So the screen sheds weight in three tiers, dropping the least valuable thing first: the
blurbs go before the preamble, because they are the most re-read; the preamble goes before any cube
does; and a hard cut backstops both so this can never fail in front of a player. Measured across
every rack size against tallies up to nine digits, the worst case is **4,079** and nothing throws.

**Your rack** is the only field that isn't history, and it only appears once a prestige has
handed something over — so most of a first climb never sees it at all. Everything owned is
listed, split into what's on the table and what's on the bench, because a cube nobody equipped
never rolls and that is exactly the kind of thing a player should not have to go looking for.

**On a tie** is a separate field and has to be, because *Your rack* is headed by a **slot count**
and neither [tie pick](#210-ties) is a cube: they can't be equipped, they don't take a slot, and
they aren't drawn into a line. Anything listed under a slot count reads as something that fills
one. They earn a place on the screen for the same reason the bench does — a prestige each, and
they only fire on a roll most climbs never see.

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
the result lines quote — busted stakes on one side, banked profit and pot prizes on the other.
So the totals are the literal sum of everything the player was ever told, and `won - lost - spent`
reconciles against the balance the mode has moved. `recordWon`/`recordLost` are called at the
three points where truguts actually move (bust, bank, pot payout), never inferred afterwards.

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

| Level | Name | Cubes | Payout | P(win) |
|---|---|---|---|---|
| 1 🥉 | A Friendly Wager | 1 | **2×** | 50% |
| 2 🥈 | Test Your Luck | 3 | **4×** | 50% |
| 3 🥇 | Rolling Thunder | 5 | **8×** | 50% |
| 4 <:platinum:> | Gamblers and Swindlers | 7 | **16×** | 50% |
| 5 💎 | Fate Decides | 9 | **32×** | 50% |

Payouts are a clean double per level, cumulative on the original stake: reaching Level 5 and
banking a 📀1,000 stake pays 📀32,000. The doubling is not a lookup — it is applied to a multiple
the run carries, which is what lets a paying cube raise the whole rest of the ladder rather than
one rung of it. See [the economy](#41-the-economy).

**The majority of an odd number of fair cubes is exactly 50/50 at every level.** Nine cubes
are no harder to call than one — depth buys multiple and variance, nothing else.

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
thirteen — so what matters about the step is not how impressive it reads on the offer screen but
how long the cap goes on binding. Measured against live balances (median holder 📀77,418, p75
📀478k), a ×5 ceiling passes the median player's entire net worth at **prestige 3**, about 217
runs in. From there the headline reward is a number they can never reach, and every prestige
after it is carried by the rack alone. At ×2 it binds through **prestige 7**, which is roughly as
long as there are picks left to take — the two halves of a prestige run out together instead of
one dying five prestiges early.

The old step also set the reroll price, which is scaled by the same figure: a prestige-8 reroll
cost 📀977M at ×5 against 📀640k at ×2. Scaling rerolls with the ceiling is right; ×5 made it
meaningless.

**Prestige is offered, never forced.** Clear the top level once and the offer sits there
indefinitely; you can keep playing a maxed ladder at the old stake ceiling as long as you like.
Taking it locks Levels 2–5 again, resets clears, doubles the ceiling, and lets you take one
thing off Watto's rack. Nothing in the lifetime record resets — deepest level, best standing,
won/lost, the rack and the per-side rates all carry across.

Level names live only in `LEVELS`; every line of copy about the top of the ladder interpolates
`LEVELS[MAX_LEVEL].name`, and Watto's top-level dialogue says "nine cubes" rather than naming
it — so renaming a level can't leave a stale string behind.

**Every *other* prestige adds one more clear to each level, and it stops at five** — 2 per level
at prestige 0 and 1, 3 at prestige 2 and 3, 4, then 5 from prestige 6 onward and never more. One
per prestige made the fourth re-climb a slog: the ladder stays the same five levels, so the grind
has to grow slower than the reward. The meter simply grows a segment, so the visual language
doesn't change.

The cost of a whole prestige cycle is exactly **30c + 2 runs**, where `c` is the clears each level
takes — a closed form the simulation reproduces to the run. The `+2` rather than `+32` is
[the rule that a clear opening a level doesn't end the run](#27-clears--how-levels-open), which is
worth a flat 30 runs a cycle all by itself. So the first prestige is 62 runs, about half an hour,
and every extra clear adds 30 runs to every cycle after it.

**What pays for that growth is the rack**, not patience: a Shortcut cube measures a **2.2×**
speedup on a re-climb, which is close to exactly what +1 clear every other prestige costs. That
pairing is why the rate is right and why the cap has to exist — the rack is *finite*. Watto's rack
holds thirteen distinct picks, and once they are gone there is nothing left to accelerate with,
while an uncapped requirement would go on charging more for less forever: 243 runs a cycle at
prestige 13, and 362 — nearly three hours — by prestige 22, for a slot you may not need.

Five is where it stops for two reasons. It is 152 runs a cycle on an empty rack and about 69 with
one, which is a steady state a player can sit in indefinitely; and it costs almost nothing over
the progression the mode is actually designed for, taking the run to prestige 13 from 1,890 runs
to 1,614. The cap is for the endgame past the rack, not for the climb through it.

The **xp bar is what ultimately sets the number.** `barOf` draws one custom emoji per clear
needed, inline in the description. Five tiles is a meter you can read at a glance; twelve wraps on
a phone and stops being countable — the same failure [the roll itself](#22-how-a-roll-plays-back)
steps down through four markdown sizes to avoid, except the meter has no equivalent step-down to
save it.

At the top of the ladder the clears meter retargets from a level unlock to the prestige offer,
so the same bar and the same `awardClear` path drive both. That gate is the one thing that
does **not** scale — `clearsToPrestige` stays at **1**. Clearing the top level is a 1-in-32 run
on top of every clear at every level beneath it, and the re-climb already got longer; scaling
the gate as well would price prestige out of reach.

The prestige icon is `<:grandmaster:>`, the top of the existing rank-symbol ladder, taken as
`level_symbols[length - 1]` so it tracks whatever that ladder's top rank is. It replaces the
padlock on the clears meter at max level — a level unlock is a padlock, a prestige is a rank.
One Discord constraint: **embed titles don't render custom emoji**, so the prestige screen wears
it at the head of the body instead of in the title.

The **thing you take off the rack is the confirmation** — there is no separate confirm button,
which keeps a destructive action to one deliberate gesture while still stating plainly what it
costs. The handler re-checks both eligibility *and* the reward on the select rather than trusting
the offer screen, so a stale menu can neither reset a ladder twice nor grant a cube twice.

**Watto's rack** — the pool you pick *from*, not to be confused with *Your rack*, the loadout on
the start screen — holds fourteen things: the ten [special cubes](#28-special-cubes), **+1 special
cube slot**, and three **one-time perks that are not cubes at all**: **purchase rerolls** and the
two [tie](#210-ties) picks, **Qui-Gon's Nudge** and **Bribe Ties**. Cubes already owned drop off
the list and each perk is offered once, so a very long-lived player eventually has nothing left but
slots — which stay worth taking until slots outnumber cubes. Fourteen options against a select-menu
limit of twenty-five means the list never needs paging.

The three perks are stored as plain flags rather than in `cubes`, so nothing about them touches the
loadout: they can't be equipped, can't be benched, can't take a slot and never appear in a line.
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

### 2.6 A public board

A public message means **anyone in the channel can press its buttons**, and the handler reads
state for whoever pressed. Left alone, a bystander clicking Blue on someone else's board would
stake their *own* truguts against a screen they don't own — and the turn guard wouldn't stop it,
since two players' turn counters collide as often as not.

So every component carries its owner's discord id as the **last segment** of the custom_id, and
a press from anyone else is turned away before the unlock gate — a passer-by gets told whose
cube it is rather than pitched the collection. Two exemptions: slash commands (no owner segment
yet) and modal submits (a modal can only ever reach the user it was shown to).

Encoding the owner in the id rather than reading `message.interactionMetadata` is deliberate:
it doesn't depend on how Discord treats that field when a message is edited by a component
response, and it fails safe for boards posted before the guard existed — their ids have no owner
segment, so every press is politely refused and the player is told to run `/chubacubes` again.

Because the board is public, the channel is already watching every roll — so the separate
in-channel announcement is reserved for two things: **clearing the top level**, and **any Pure
Cube that pays off the pot**. Taking a bite out of a jar everyone has been feeding is the one
result that's genuinely other people's business, so all three paying tiers announce — a pure 3
doesn't, because it pays nothing. When a roll is both a jackpot and a top-level clear, the
jackpot line wins and only one message goes out.

### 2.7 Clears — how levels open

**Only Level 1 starts unlocked** — after every prestige as well as at the very beginning. Your
deepest unlocked level has nothing to push into, so
winning there banks itself automatically — and surviving your own ceiling like that is a
**clear**. Enough clears — two at first, [rising to five](#25-prestige-and-the-stake-ceiling) — and
Watto grudgingly puts two more cubes on the table.

The xp-bar tiles under the level header are that progress: `clearsToUnlock` segments, green
`new` tiles behind you for clears already banked, the blue `filled` tile marking the one
being attempted, empty ahead. The blue tile comes off on an end screen — nothing is being
attempted there, so nothing should look live — except on a bust, where the attempted segment
shows the **error** tile instead. A bust only ever carries a bar when the roll was at the
ceiling, which is exactly a failed clear, so it leaves a visible mark rather than reverting to a
blank meter. Progress itself is untouched: a failed clear costs the run, not the clears
already banked.

**The bar only appears on the level the clears are earned at** — your ceiling. Rolling Level
1 on the way up to a Level 3 ceiling shows no bar, because clears at Level 1 aren't a thing
any more. It disappears for good once every level is open.

That test is against the ceiling **as it stood when the cubes left the cup**, captured before
settlement. A third clear moves the ceiling a level deeper, and reading it live would make the
meter vanish from the very frame that earned it — the one place it most needs to be.

The frame that *fills* a meter shows it **completed** — `▰▰▰ → 🔓 Level 4` — rather than the
next level's empty counter. The new meter belongs to a level the player hasn't rolled yet, so
it isn't theirs to look at until they get there. Each frame therefore carries the progress
state it should draw rather than reading live state, which by then has already moved on.

Cashing out *short* of your ceiling is not a clear. That is the whole tension of the gate:
the only way to progress is to walk up to your own limit and survive it, which is exactly
the roll you would rather bank before.

**The clear that opens a level does not end the run.** The ceiling only banks itself because
there is nothing unlocked to push into — so a clear that unlocks something makes that reason
false, and the run stays live with the offer to carry the standing straight into the level it
just earned. This is an ordering rule as much as a design one: the clear is awarded *before* the
bank/continue decision, because deciding first and unlocking second handed the player a key and
shut the door in the same breath. It also turned the loop's biggest moment — surviving your
ceiling — into a forced stop followed by a re-climb of everything below it.

It can't chain: clears reset to zero on an unlock, so a run opens at most one level, pushes into
it, and then meets a wall that is genuinely there. Nothing extra is paid out either — the clear
was earned either way, and the player is choosing to put a banked standing back at risk.

A run that ends — either way — turns the embed **red** for a bust or **green** for a bank and
collapses the row to a single **Play again**, so there is never any question about whether
something is still live.

One live run per player, persisted at `challenge/cube/live/ladders/<discordId>`, so a
restart or a closed ephemeral never eats a standing. Every action button carries a turn
counter checked on arrival; without it a double-click on Call would stake twice against
one run.

### 2.8 The Pure Cube pot

Every cube landing on your called side is a **Pure Cube**. All nine against you is
**Watto's Cackle**.

| Pure | Odds at that level | Share of the pot |
|---|---|---|
| 3 | 1 in 8 | — |
| 5 | 1 in 32 | **5%** |
| 7 | 1 in 128 | **25%** |
| 9 | 1 in 512 | **100%** |

Three paying tiers rather than one keeps the pot circulating: the 5% tier is the one most
players will ever actually see land, and it is deliberately the smallest of the three because it
fires often enough to set where the pot rests. Pure 3 stays at nothing — at 1-in-8 on a level
nearly every run passes through, any share at all would drain the pot faster than busts fill it.

These tiers set **how the pot is spent**, not how much of it there is. They shape the payout
into one headline prize instead of a drip — which is their whole job — but they can't change
the total going out, for the reason in the next section. The size of the jar is `potShare`.

A pure 7 needs three straight
wins first — about 1 in 1,000 runs — and is the payout that carries the feature. A pure 9
is 1 in 8,000 runs and takes the whole pot; both are announced in-channel, as is any clear of
the top level — which is what `bankNote` actually gates on, the two cases
[§2.6](#26-a-public-board) names and nothing else.

**A quarter of every trugut lost on a bust feeds the pot; the rest leaves the economy.** It
seeds at 📀25,000 and is paid out transactionally, so two simultaneous pure rolls can't both be
paid off the same balance.

That share used to be all of it, and it made the mode a money printer. The reasoning is worth
keeping, because the mistake is an easy one to make twice:

- The ladder is a **martingale** — 2^k paid on a 1-in-2^k run — so EV is exactly the stake at
  every rung and no stopping strategy beats another. That's the right shape for the game.
- But it means a fair ladder has **no spare money in it**. The busted stakes are already
  precisely what funds the winners; there is nothing left over to fill a jar with.
- And a pot in steady state pays out exactly what it takes in — that's what an equilibrium pot
  size *is*. So routing every bust into it spent the same truguts twice, returning
  `1 + bustRate` per trugut staked: **1.5× for a player who banks at level 1 and 1.97× for one
  who pushes to the top.**

**Rarity doesn't help, and this is the part that misleads.** With inflow `i`, a payout chance
`q` and a tier share `s`, the pot settles where `P* = i / (q·s)`. Rarity sits in the
*denominator* — a jackpot that fires ten times less often simply rests ten times bigger, and
the truguts leaving the jar over a year are identical. The tuning above measures this from the
other side without naming it: dropping the tier share 10% → 5% *raised* the resting pot 440× →
660×. The jar was compensating.

So the lever is the inflow, not the tiers. Total return is `1 + potShare × bustRate` and the
resting pot scales linearly with the same number, which puts the headline and the leak on one
dial: at **0.25** the jar rests around **165× the average stake** and the worst-case return is
**1.24×**, against 660× and 1.97× before. A jackpot still worth announcing, with three quarters
of the leak gone.

One number to watch that the maths above doesn't cover: the pot's **half-life to equilibrium is
around 900 runs**, so the mode reads as a net *sink* for its first thousand-odd runs while the
jar is still filling. It stops absorbing right about when you've concluded it's fine.

A pure roll is judged on the **resolved** line, and needs **every position on it to be a cube, all
of them your way**. An effect face in the line kills a pure however the rest of it landed — which
keeps *all nine landed blue* literally true, and closes an exploit the sideless rule would otherwise
open: without it, a rack of effect cubes would shorten the counted line, hit "pures" far more often
off fewer cubes, and still be paid at the level's nominal tier. The share stays keyed on that
nominal count, because a Symbiont or a Mirror can leave a Level 4 roll six or nine cubes long and there is no
sensible pot share for a count the ladder doesn't have.

So the pot is now the other half of a real decision — and the split falls exactly along the
[is-a-side / does-a-thing](#28-special-cubes) line, which is the strongest sign that rule is
carrying its weight:

- **Effect cubes cost you the pot.** Every effect face is a position that can't be swept, so a pure
  5 falls from **3.11%** of Level 3 rolls on an empty rack to **0.45%** on a full one, and a pure 9
  from 0.19% to 0.03%. Nobody fielding ten cubes is taking the jackpot; that is the trade.
- **Side cubes buy it.** A **wild counts as whatever you called**, so it is a guaranteed match and
  you only need the *rest* of the line to agree — a Wild Cube equipped takes the pure 5 rate
  **up**, to **3.68%**, above an empty rack. Over 400k rolls, 35.7% of pure 5s had a wild in them.
  Shmi and Anakin do the same on the side they force.

Outflow therefore drops on any rack built for effects while inflow doesn't, so the equilibrium pot
sits **higher** than the figures below — worth watching before adding anything more to the rack.

### 2.8 Special cubes

Ten cubes, one taken off the rack per prestige, and they are the only thing the ladder's flat
50/50 ever bends for. A special cube **substitutes** one of the level's plain cubes rather than
joining them, so the line stays the length the header says and the base count stays odd.

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

One guardrail: **a set always keeps at least one ordinary cube**, because a set with nothing plain
in it has nothing to decide a roll. That is also what keeps a special off Level 1, where the set is
one cube long.

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

Each equipped cube independently rolls a **25% chance** per roll to take a position, so a full
rack usually shows one of them and occasionally all. Each can hold at most one position, so a
loadout can't stack the same cube twice. **Slots** cap how many you can equip, not how many you
own — the bench is real, and choosing what to field off it is the whole point of the rack screen.

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
| **Reroll** | 4 × reroll, **1 × Ratts**, 1 × wipeout | Banks **+1 reroll** and stays on the table. Only the wipeout shatters it. |
| **Binder** | 3 burn, 3 clone | Burns the cube on its right, or makes it a **copy of the cube on its left**. A clone at the head of the line destroys instead; at the tail it adds. |
| **Multiplier** | 2 red, 2 blue, 2 × wipeout | **+1** on the run's multiple, but only if that face's side is the one that wins. |

Two faces are the price of all that, and they are on the cubes that pay best:

- **Ratts ends the run — if he is still standing when the dust settles.** He is checked against the
  *resolved* line rather than the thrown one, so a cull, a raze, a clone or a mirror writing over his
  position takes him off the table and **the run survives**. The cubes can save you from him, which
  turns a destructive rack from pure downside into an insurance policy, and turns the reveal into a
  real beat: Ratts lands, then something eats him. On a five-cube rack **19.4%** of the rolls that
  throw him end up saved. He is 1 face on Wild, Greed, Shortcut and Reroll.

  The invariant this buys is worth stating: the run ends **if and only if** Ratts is visible on the
  final line. Measured at 0 phantom deaths and 0 missed ones over 200k rolls, so the screen and the
  outcome can never disagree about why a run stopped.
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

**A copy of a face is a face, and takes its own turn.** A cloned Greed pays, a reflected Tusken
culls. That means the second pass can't be a walk over the thrown line — it is a **work queue**, and
the line grows turns as it resolves. Two rules bound it, and without them it doesn't terminate:

1. **Only an original hands out turns.** A copy acts, but anything *it* copies is inert. One level
   deep, so a Binder cloning a Binder cloning a Binder stops at the second.
2. **A mirror reflected by a mirror never acts** — the one cascade with no natural end. A Binder
   *cloning* a mirror does work, because a clone is one copy onto one fixed target and cannot feed
   itself.

A copy also never went through the first pass, so the payout half of its face is applied when it
comes up in the queue — which is what makes a cloned Greed add **+1** rather than +0.5. `mult` and
`end` are deliberately excluded there, because both are read off the resolved line anyway and a copy
of either already counts; so is `broken`, since the special shattered once and the copy carries
`gone` across on its own.

Stress-tested at 200k full-rack rolls of fifteen cubes: no hangs, slowest single roll **6ms**, most
effect steps in one roll **9**. That last number retires a claim in
[§2.2](#22-how-a-roll-plays-back) that three was the natural ceiling — it was, until copies could
act. `maxEffectFrames` still caps the *animation* at three; the rest resolve into the payout frame.

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

What uncapping does need is a **drawing** budget, because a description that runs past 4,096
characters makes discord.js throw. `LINE_BUDGET` in the engine draws as many cubes as fit and counts
the rest (`… **+37**`), at the one place every frame renders through. Tested at 9, 40, 120, 400 and
2,000 cubes: all draw, none exceed 2,813 characters. A table that got away from you should read as a
triumph, not a crash.

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

Two sources, one stock: a **Reroll Cube** face banks one whatever the roll did — so it is never a
punishment for having won — and once the rack has handed over **Purchase Rerolls**, a button on the
idle board sells them.

The offer lives on that screen and nowhere else. `Play again`, calling a side, or anything else
declines it; `/chubacubes` walks back to it, so a standing offer survives being closed. That is the whole
lifecycle, and it works because **the bust is already fully settled before the offer appears** —
the stake is in the pot, the loss is on the ledger, the streak is broken. Letting an offer lapse
leaks nothing, and a crash mid-offer leaves a correctly-busted run.

**A reroll buys back the roll, not the draw.** The same cubes are picked up and thrown again: same
count, same specials, nothing added, removed or swapped — only the sides, the faces and the order
move. The dead run therefore stores the table **as it was thrown**, and the replay skips `growSet`
entirely (`regrow: false`). Regrowing would have quietly rerolled the *loadout* as well, handing
back a different pair of cubes and sometimes different specials, which is a second thing the player
never asked to gamble on.

Which means spending a reroll is a **reversal of exactly two numbers**: the stake comes back out of
the pot and off the lifetime loss. Nothing else needs undoing, because the stake left the player's
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

**A Shortcut clear is the only progress ever made below your ceiling** — it pays wherever it
lands, and the run carries on. It can therefore open a level *mid-run*, which then becomes
pushable immediately. One guard: it pays nothing once the whole ladder is open, because there is
no next locked level to pay toward. Without that, a shortcut on a one-cube Level 1 wager would
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

It is deliberately **not** drawn through `rollSide`, so the daily lean doesn't touch it — the lean
favours a colour and this favours the house, and mixing the two would make one of them unreadable.
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
eventually price the pick out of the game for good, and a rack slot that stops doing anything is
worse than one that was never offered.

**He stops asking once his price passes what the tie pays.** At that point there is nothing to
weigh, so the roll doesn't stop for it — it just plays the tie-breaker like any other. That is
what keeps every button on the tie screen one you might actually press. On a 📀16,000 standing the
ladder runs 4,000 → 6,000 → 9,000 → 13,500 → *withdrawn*.

Which makes the two picks **interact**, and against each other: his cube pays you 0.4 × the
standing in expectation, so a bribe is worth taking under 40% of it — the first two on that ladder.
Hold the Nudge as well and his cube is worth 0.6 × the standing, so the bribe has to beat a much
better alternative and only the first is clearly worth buying. Owning both makes each one worth
less than owning either.

**A tie broken your way is a win in every sense** — it pays, it clears, it keeps the streak — with
one exception: it is **never a Pure Cube**. A swept line has a majority in it by definition, so a
line that tied can't have been swept, and the pot never pays on a tie.

#### What a parked tie is

A tie the player is being *asked* about is the only place a roll stops mid-flight, and it settles
**nothing** while it waits — no tallies, no clears, no pot, no ledger. The whole roll is written to
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

Nothing is raked and every level is a clean double, so **the ladder has no house edge at
all.** A 2× payout on a 50/50 is exactly fair, and it stays exactly fair all the way up:

| Bank at | Survival | Payout | EV per stake |
|---|---|---|---|
| Level 1 | 50.0% | 2× | **1.000** |
| Level 2 | 25.0% | 4× | 1.000 |
| Level 3 | 12.5% | 8× | 1.000 |
| Level 4 | 6.3% | 16× | 1.000 |
| Level 5 | 3.1% | 32× | **1.000** |

Depth is therefore a pure variance choice and nothing else — which is the cleanest version
of a press-your-luck ladder, and it means the mode's entire economic behaviour is the pot.

**The pot is a faucet, and worth watching.** Payouts are gross on the original stake, so
the 2× table already assumes busted stakes are what pays winners. Routing 100% of busted
stakes into the pot *as well* funds the jackpot with newly minted truguts rather than
recycled ones. Inflow is 0.5× every stake for a Level 1 bank and rises to ~0.97× for
someone pushing to the top level; outflow is ~0.04% of the pot per run. So the pot climbs to
an equilibrium somewhere around **1,400–2,700× the average stake** and, once there, hands
the entire inflow back out. Aggregate EV including pot payouts lands between **+50% and
+97%**, concentrated into rare jackpots rather than spread across players.

That is a deliberate faucet, but it is a faucet, and with a fair ladder underneath it there
is nothing else pulling the other way. The knob if it runs hot is the fraction of a busted
stake that reaches the pot (`settleLoss` in `src/interactions/cube.js`) — the pot still
grows visibly at a much smaller share.

**Special cubes are the second faucet, and half of them are drains.** The bare ladder is still
exactly fair — measured over 200k simulated climbs per row with an empty rack, EV per stake is
1.000 at every level, unchanged. A rack bends it either way, and it bends further the deeper you
push, because a multiplier caught early rides every level above it and Ratts gets more chances to
turn up:

Rerolls are banked *and spent* in this measurement, and **clears per climb** is carried alongside
EV because it is a second currency that one cube trades in almost exclusively.

| Rack (1 slot unless noted) | L1 | L3 | L5 | clears/climb at L5 |
|---|---|---|---|---|
| empty | 1.00 | 1.00 | 1.00 | 0.03 |
| Anakin *calling blue* | 1.00 | 1.15 | **1.38** | 0.04 |
| Wild | 1.00 | 1.16 | 1.32 | 0.04 |
| **Reroll** | 1.00 | 1.01 | 1.22 | 0.04 |
| Binder + Nudge | 1.00 | 1.02 | 1.06 | 0.03 |
| Binder + Bribe | 1.00 | 1.03 | 1.01 | 0.03 |
| Wild + Greed + Multiplier + Binder (4 slots) | 1.00 | 1.03 | 0.97 | 0.03 |
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

**The bag is what makes slots the real prize.** A single special got slightly *weaker* — the old
flat chance rolled per cube, so two cubes a level gave it a 44% look-in and it usually landed early;
the bag gives it one uniformly-placed seat in eight, so it arrives later on average even though it
now always arrives. A **four-cube rack fills half the bag**, so the whole thing deploys and deploys
fast, and the tie picks are what turn that deployment into an edge: **0.97 → 1.26** at Level 5. The
bag size, or capping how much of the bag a rack may occupy, are the levers if a loaded rack ever
outruns the pot; on these numbers it does not.

**The two paying cubes are currently the worst things you can equip, and that is a live problem.**
Greed measures **0.60** and the Multiplier **0.89** at Level 5. The compounding helped both — Greed
was 0.57 and the Multiplier 0.88 under the flat-bonus model — but not nearly enough, because the
cost and the benefit are different *kinds* of quantity. A paying face is sideless, so the cube it
sits on contributes nothing to the majority, and under carry-over that liability is re-thrown every
level for the rest of the climb. That is a multiplicative cost against a *linear* +0.5 or +1. The
survivors bear it out: a Greed rack banks at ×34.5 on average against a clean ×32, an 8% better
payout bought with a 40% worse survival rate.

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
you climb with it. Measured over 1M climbs per cell with the daily lean switched off, which puts
**±0.006** on the Level 5 column — the lean is left out because it is *not* EV-neutral on a deep
climb (per-level probabilities multiply, so calling the leaned side compounds and calling against
it decays, and the two don't cancel: with the lean on, an empty rack measures ~1.30 at Level 5).
That is a property of the lean rather than of the cubes, and this table is about the cubes.

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

| Concern | Where |
|---|---|
| Command | `src/commands/cube.js` — bare `/chubacubes`, no subcommands |
| Router + handlers | `src/interactions/cube.js` |
| Engine + views | `src/interactions/cube/functions.js` |
| Tuning | `src/data/challenge/cube.js` |
| Special cubes | `SPECIALS` in the tuning data — six faces each; resolved by `resolveLine` |
| Ties | `rollTiebreak` + `applyMults` in the engine; `finishTie` + `settleRoll` in the router |
| Face art | one emoji per face in `SPECIALS`, never composed — see `faceEmoji`, one glyph per position |
| Live state mirror | `src/firebase.js` listener on `challenge/cube/live` |
| Inspector | `scripts/inspectChanceCube.js` |

**State.**

```
challenge/cube/live/pot                   the Pure Cube pot
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
                                            cubes, equipped, slots, rerolls, buyReroll,
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
roll, and `equipped` is filtered against both what is owned and the slot count on **read as well as
write** — a loadout saved when there were more slots can't field an extra cube.

**No subcommands, deliberately.** Discord forces a subcommand choice once any exist.
`/chubacubes` is separate from `/chancecube` for the same reason — that command stays a plain
coin flip plus a guild-specific easter egg in `1199872145354915920` that **must be
preserved**.

Navigation is buttons routed through `client.buttons` by the existing
`interaction.customId.split("_")` convention (`src/bot.js:148`), not collectors: this
codebase drives interactive state through persisted Firebase state, which is what makes it
survive restarts.

Two guards on a public board, not one: the owner id in every custom_id, and the turn counter.
Both matter more now that a press can change a loadout or spend truguts on a reroll — every one
of the new components carries the owner as its last segment, and the rack is refused mid-run for
the same reason the stake is.

### Cut on purpose

An earlier draft had a hidden daily loading with a public server-wide ledger to read it
from, a rake, a per-player daily stake cap with prestige tiers, cosmetic face palettes, and
a multiplayer shared table. All of it went: the mode is a fast, legible press-your-luck
ladder in one embed, and every one of those systems was a second screen or a paragraph of
rules standing between the player and a roll. The ideas are in git history if the loop
proves too thin.

The one piece of that draft that came back is the unlock gate — the old "rack" of cubes won
off Watto, rebuilt as the much smaller clears counter in §2.3. A ladder where a new player
can stake into the 32× immediately has no shape to it.

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
