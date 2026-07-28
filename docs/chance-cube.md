# Botto's Chance Cube — Game Design

> *"We'll let fate decide. Blue — it's the boy. Red — his mother."*

Design doc for the chance cube betting minigame unlocked by the **Red vs Blue** item
collection. This is a design spec, not an implementation. Numbers in here are derived,
not guessed — see [Math](#math) for the tables and [Tuning](#tuning--economy-safety)
for the levers.

---

## 1. Why this fiction works

The unlock already exists in the data and it is almost suspiciously perfect:

| Piece | Where | Meaning |
|---|---|---|
| Collection `Red vs Blue` → `chance_cube` | `src/data/challenge/collection.js:59` | "Botto's Chance Cube - Unlocks a chance cube betting minigame" |
| Item 95 `Red Side` — *"it's the mother..."*, `limit: 3` | `src/data/challenge/item.js:1467` | 3 red faces |
| Item 96 `Blue Side` — *"it's the boy..."*, `limit: 3` | `src/data/challenge/item.js:1488` | 3 blue faces |
| Reward flag `rewards.chance_cube = true` | `src/interactions/challenge/functions.js:3649` | already granted on claim |
| `<a:chance_cube:1235055236138270760>` | `src/data/discord/emoji.js:4` | animated cube emoji exists |

You collect **3 red faces + 3 blue faces and physically assemble one six-sided cube.**
That is the whole game's thesis handed over for free: *the cube you built is fair —
3 and 3. The cube Watto rolls is not.*

Qui-Gon nudged Watto's cube with the Force. Watto weighted it in the first place. So
the fiction supports the central mechanic without any strain: **every day, Botto loads
the cube, and nobody is told which way.**

---

## 2. The design in one paragraph

You wager truguts, call **blue** or **red**, and roll. Win and your stake multiplies —
then you choose to **bank** it or **push**. Each push adds cubes to the table (1 → 3 →
5 → 7 → 9) and you must call the *majority* colour. Because the majority of an odd
number of fair coins is always exactly 50/50, adding cubes **does not change your odds
if you're guessing** — it only amplifies the day's hidden lean. So the ladder is a pure
double-or-nothing to a blind player and a genuine skill ladder to someone who has read
the day's cube correctly. Everyone's rolls, everywhere, feed one public daily tally, so
the server reads the cube together.

That single property is the design. Everything else serves it.

---

## 3. Core mechanic: the Ladder

### 3.1 Majority-of-N

Rung `L` rolls `N` cubes at once. You call a colour before the roll. **You win the rung
if your colour is the majority** (N is always odd, so there are no ties).

| Rung | Name | Cubes | Payout | Blind P(win) | P(win) with a 54% lean, called right | called wrong |
|---|---|---|---|---|---|---|
| L1 | Fair Wager | 1 | **1.95×** | 50.0% | 54.0% | 46.0% |
| L2 | Double or Nothing | 3 | **3.8×** | 50.0% | 56.0% | 44.0% |
| L3 | Watto's Greed | 5 | **7.4×** | 50.0% | 57.5% | 42.5% |
| L4 | The Whole Pod | 7 | **14×** | 50.0% | 58.7% | 41.3% |
| L5 | Boonta Eve | 9 | **26×** | 50.0% | 59.8% | 40.2% |

Payouts are cumulative on the original stake, not per-rung. Reaching L5 and banking on a
📀1,000 stake pays 📀26,000 gross.

The middle column is the trick. **A guesser faces exactly 50% at every single rung, no
matter how many cubes are on the table.** The rightmost columns are why the day's lean
matters: a 54/46 cube becomes a 59.8/40.2 proposition once nine of them roll at once.
Small daily bias, large effect on deep runs.

### 3.2 The push/bank decision

After every winning roll:

- **BANK** — take the current multiple, round over, Watto's cut applied.
- **PUSH** — add two cubes, re-call your colour, roll again. Lose and you lose
  everything staked *and* everything accumulated.

Losing at any rung loses the whole run. There is no partial credit, no laddering back
down. This is the `press your luck` core: *settle for existing gains, or risk them all.*

### 3.3 The Rack — building up to more cubes

You assembled **one** cube. You cannot put nine on the table on day one.

Your **Rack** is how many cubes you personally own, and it caps how deep you can climb.
You earn cubes from Watto by proving you can cash out at your current ceiling:

| Rack | Top rung playable | Clears at top rung to advance |
|---|---|---|
| 1 cube | L1 | 3 |
| 3 cubes | L2 | 3 |
| 5 cubes | L3 | 4 |
| 7 cubes | L4 | 5 |
| 9 cubes | L5 (max) | — |

A "clear" is **banking** at your top rung — surviving it, not just reaching it. 15 total
clears to a full rack. This gives the mode a long tail, gates the 26× top rung behind
real play, and pays off thematically: *you win cubes off Watto one grudging pair at a
time.*

---

## 4. The daily lean

### 4.1 The Loading

At Eastern midnight (`easternTime().dayOfYear()`, matching the existing daily-challenge
boundary) Botto secretly loads the cube:

| Weight | Chance of that day | Feel |
|---|---|---|
| 50 / 50 — **True Cube** | 25% | there is nothing to find |
| 52 / 48 — **Slight Lean** | 45% | barely readable in a day of rolls |
| 54 / 46 — **Watto's Thumb** | 30% | readable if the server pays attention |

The favoured colour is a coin flip. **The lean never exceeds 54%** — see
[Tuning](#tuning--economy-safety) for why that ceiling is load-bearing.

**True Cube days are the most important entry in that table.** A quarter of the time
there is no pattern at all, so a player who "reads" a lean is reading noise and betting
deep on it. Overconfidence has to be punishable or the information game is just a tax
on people who don't check the ledger.

### 4.2 The Ledger

Every cube rolled by anybody — single player or at a table — is tallied into one public,
server-wide daily count:

```
📓 Today's Ledger      🟦 137  ·  🟥 119      (256 cubes rolled)
```

This is the social spine of the mode. It gives:

- a reason to check in daily,
- a reason for single-player play to matter to everyone else,
- a genuine, self-correcting information market — the tally is *suggestive, never
  conclusive.*

How suggestive, precisely — probability the ledger's leader is actually the loaded colour:

| True lean | 40 cubes in | 100 | 250 | 600 |
|---|---|---|---|---|
| 52 / 48 | 60% | 66% | 74% | 84% |
| 54 / 46 | 69% | 79% | 90% | 98% |

Early in the day the ledger is nearly worthless and everyone is gambling blind. Late in
the day on a Thumb day it becomes real information — and that is exactly when the deep
rungs are worth attempting. **The mode has a natural daily arc**: cautious morning,
sharp evening. That arc is free content, and it emerges from the math rather than from a
schedule.

### 4.3 Last Call

At day's end Botto reveals the loading and the seed:

```
🎲 The cube is retired. Today it leaned 🟥 RED, 54/46.
📓 The ledger closed 🟥 291 — 🟦 247. You read it right.
🏆 Deepest run: @someone banked L5 for 📀312,000
🔓 seed a3f9… (sha256 published at 00:00 ET)
```

Publish `sha256(daySeed + colour + weight)` at day open, reveal `daySeed` at close. This
is standard provably-fair commitment from crash-game design, it costs almost nothing to
implement, and in a community that will absolutely accuse the bot of cheating after a
bad L4 it is worth far more than it costs. It also makes Last Call a small daily event.

### 4.4 Force Sense (optional consumable)

A rare drop that reveals the exact loading privately, once, for the rest of the day. The
lore is already written for it — Qui-Gon nudging the cube is the single most famous thing
about this object. Slots into the existing "Special Items" inventory section alongside
Trugut Boosts and Sabotage Kits. Strong enough to be exciting, bounded because it can't
change the odds, only tell you which way to lean.

---

## 5. Single player

`/chancecube` → opens your private ladder.

```
        <a:chance_cube> BOTTO'S CHANCE CUBE

  Stake  📀2,000            Rack  ▮▮▮▯▯  5 cubes (L3 max)
  📓 Ledger today  🟦 137 · 🟥 119

  ── Rung 2 · Double or Nothing ── 3 cubes ── 3.8× ──
  Standing:  📀7,600   ·   one more rung pays 📀14,800

  🟦 🟥 🟦   ✅ called BLUE — majority BLUE

     [ 🟦 Call Blue ]  [ 🟥 Call Red ]  [ 💰 Bank 📀7,600 ]
```

Flow: stake → call → roll → bank or push → repeat. One active ladder per player,
persisted, so a disconnect or bot restart doesn't eat a live pot.

The roll should animate across two or three message edits — cubes landing one at a time,
running count visible — because at L5 the ninth cube deciding a 26× pot is the single
best moment this mode has to offer and it should not resolve instantly.

---

## 6. Multiplayer: The Boonta Table

`/chancecube table [ante] [min] [max]` opens a public table in the channel. This borrows
the structure of the dice game **Bank**, which is the proven multiplayer press-your-luck
shape: *shared rolls, individual banking.*

### 6.1 Structure

1. **Ante up** — 60-second join window. Players stake individually within the table's
   min/max (mirroring the min/max convention already in `/bet`).
2. **Call** — every player secretly calls blue or red. Calls stay hidden.
3. **One shared roll** — the table rolls the rung's cubes **once, for everybody.**
   Calls are revealed with the result.
4. **Sort the living from the dead** — players who called the majority survive and their
   stake multiplies. Players who called wrong are out, and their stake drops into **the Pot**.
5. **Bank or push** — every survivor chooses, on a 30-second timer, simultaneously
   revealed.
6. Repeat until the table is empty.

### 6.2 The Pot

Eliminated players' stakes accumulate into a Pot, claimed by **the last player still
pushing** — but only if they survive one further roll alone. Bank before you're last and
you forfeit your claim to it.

This is the mechanic that makes the mode social rather than parallel-single-player:

- Banking is safe but hands the Pot to whoever is braver than you.
- Being last is worth real money, so the Pot pulls people deeper than they'd go alone.
- Watching a table's last two players stare each other down over a Pot is *the show.*
- It's pure redistribution between players, so it costs the economy nothing.

### 6.3 Why the shared roll is the right call

One roll for the whole table means:

- **One dramatic beat per rung.** Nine cubes land, and half the channel dies at once.
- **The colour call is where players differentiate**, so hidden-then-revealed calls turn
  the table into a visible referendum on the day's lean. You find out who reads the
  ledger and who doesn't.
- **It's cheap in Discord terms** — one message edited in place, not N parallel games.

### 6.4 Racks stagger the table naturally

Each player is capped by their own Rack and is **force-banked** on reaching it. A newer
player with 3 cubes is out at L2 with their winnings intact while a veteran with a full
rack rides to L5. Nobody is blocked from playing, veterans are the ones positioned to
scoop the Pot, and progression pays off publicly and legibly.

### 6.5 Spectator side bets

Anyone in the channel — including players without the unlock — can bet on the next
rung's majority colour, or on whether the table reaches L5. The `/bet` machinery
already exists (`betEmbed`/`betComponents` in `src/interactions/trugut_functions.js`,
5% house fee) and pointing it at a live table costs little. It turns the table into
something a whole channel participates in and gives non-unlocked players a reason to
care about a mode they can't play yet. Ship this after the core.

---

## 7. Math

Payout ladder `1.95 / 3.8 / 7.4 / 14 / 26`, rake 5% of profit on bank.

### 7.1 Blind player — cumulative survival and EV

Pushing to rung L and banking, no information:

| Bank at | Survival | EV per stake |
|---|---|---|
| L1 | 50.0% | **0.951** |
| L2 | 25.0% | 0.915 |
| L3 | 12.5% | 0.885 |
| L4 | 6.3% | 0.834 |
| L5 | 3.1% | **0.773** |

The ladder is deliberately **sub-double**. A blind player bleeds ~5% at L1 and ~23% if
they push blind to L5. That gradient is the point: *pushing deep without information is
punished, and information is the only thing that makes depth pay.*

### 7.2 Informed player — reading the lean correctly

| Bank at | on a 52/48 day | on a 54/46 day |
|---|---|---|
| L1 | 0.989 | 1.027 |
| L3 | 1.049 | 1.230 |
| L5 | 1.094 | **1.508** |

A player who reads a Thumb day correctly and rides it to L5 is meaningfully +EV. That is
the reward the mode is built to hand out, and it is gated behind a read that's only ~79%
reliable at 100 cubes and worthless before that — and behind the 25% of days where there
is nothing to read and confidence is a trap.

### 7.3 Rake

Watto takes **5% of profit** on bank — not per rung. Matching `bet_house_fee: 0.05` in
`src/data/challenge/trugut.js` keeps it consistent with existing betting.

Rake on profit rather than per-push is deliberate: a per-step rake compounds and would
make deep runs mathematically stupid, killing the exact behaviour the mode is about.
Flat-on-profit keeps the house edge identical at every depth, so depth is a pure
variance choice.

On a 📀1,000 stake:

| Bank at | Gross | You keep | Watto's cut |
|---|---|---|---|
| L1 | 1,950 | 1,903 | 48 |
| L3 | 7,400 | 7,080 | 320 |
| L5 | 26,000 | 24,750 | 1,250 |

---

## 8. Tuning & economy safety

Three interlocking levers keep this from becoming a trugut printer. They matter because
the mode's whole appeal — *knowable bias* — is also its failure mode.

**1. The 54% ceiling on the lean is load-bearing.** A 58% lean is ~95% readable off a
100-cube ledger, and a player with that read pushing to L5 sits at **EV 2.66×**. That is
an economy leak, not a game. Strong leans feel great and cannot be allowed to exist while
the ledger is public. Pick one: subtle leans with a public ledger, or strong leans with a
private one. This design picks the first, because the public ledger is what makes the
mode social.

**2. Sub-double payouts.** `1.95/3.8/7.4/14/26` against a fair `2/4/8/16/32`. Taxes deep
runs specifically, which is where informed play concentrates.

**3. A per-player daily stake cap.** The absolute backstop, and the only lever that
bounds the worst case regardless of how well players read the cube. Suggest a flat cap
or a percentage of net worth, tuned after watching real play.

Additional guardrails:

- One active ladder per player; one active table per channel.
- Min stake to keep the ledger from being farmed by 📀1 spam — the ledger is shared
  state and cheap rolls pollute everyone's information. Ledger entries could also be
  weighted by stake if spam becomes a problem.
- Never allow a negative balance; verify funds at stake time and again at push.
- Persist live ladders and tables so a restart doesn't destroy or duplicate a pot.
- Resolve rolls server-side only, from the committed day seed.

**On variance:** L5 survival is 3–6%. The overwhelming majority of runs end in a loss,
and the EV tables assume perfectly optimal banking that almost nobody executes. Real
observed drain will run below theoretical. Instrument first, tune second.

---

## 9. Implementation notes

Fits existing patterns; no new infrastructure.

**Command.** `src/commands/chancecube.js` currently returns a single random square, plus
an easter egg in guild `1199872145354915920` (a 48-bit string) that **must be preserved**
— it's a hidden joke someone will notice is gone. Add subcommands (`play`, `table`,
`ledger`, `stats`) and gate the game behind `user_profile.rewards.chance_cube`, leaving
the bare `/chancecube` roll and the easter egg intact as the unlockless fallback.

**Handlers.** `src/interactions/cube/` + `src/interactions/cube.js`, routed by the
existing convention — `interaction.customId.split("_")`, handler name first, rest as
`args` (`src/bot.js:148`). Buttons, not collectors: this codebase drives interactive
state through persisted Firebase state and `client.buttons`, and no file uses
`createMessageComponentCollector`. Follow that — it's what makes state survive restarts.

**State.**

```
ch/cube/day/<dayOfYear>/     hash, colour, weight (hidden until close),
                             tally {blue, red}, best runs
ch/cube/ladders/<discordId>/ live single-player run
ch/cube/tables/<messageId>/  live multiplayer table
users/<key>/random/cube/     rack, rungClears, staked_today, lifetime stats
```

**Daily rollover.** Needs a once-a-day tick to close out the ledger, post Last Call, and
load tomorrow's cube. `src/bot.js` already runs minute-by-minute tasks; the market cron
in `src/interactions/stock/functions.js` is the closest existing precedent.

**Table timers.** Join and bank windows need a deadline check on the minute tick rather
than in-process timers, so a restart mid-table doesn't hang a pot forever.

### Phasing

1. **Core loop** — single-player ladder, daily loading, ledger, rake, rack progression.
   This is the whole game; ship it alone and it stands up.
2. **The Boonta Table** — multiplayer, shared rolls, the Pot, force-banking on rack.
3. **Trimmings** — Last Call post, spectator side bets via `/bet`, Force Sense
   consumable, achievements (bank an L5, win a Pot, full rack), daily leaderboard.

---

## 10. Constraint check

| Asked for | Delivered |
|---|---|
| Wagers + a red/blue die | Every run opens with a trugut stake and a colour call; tables add antes and a contested Pot. |
| Daily slight favourite | The Loading — hidden 52/48 or 54/46, 25% of days truly fair, committed by hash and revealed at Last Call. |
| Single **or** multiplayer in a channel | Private ladder, or a public table with shared rolls and individual banking. |
| Stacking risk / double-or-nothing | Bank-or-push at every rung; a loss takes the entire accumulated pot. |
| Multiple dice, starting at 1, building up | 1 → 3 → 5 → 7 → 9 within a run; **and** a persistent Rack that starts at one assembled cube and grows to nine over ~15 clears. |

The two requirements that could have fought each other — "slight daily bias" and "more
dice as you climb" — turn out to reinforce each other instead. Majority-of-N holds a
guesser at exactly 50% forever while sharpening a 54% lean into a 59.8% edge, so
**more cubes don't make the game harder, they make information more valuable.** The
bias requirement gives the escalating-dice requirement its reason to exist.

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
  risk per throw and "hot dice" re-rolling the whole set.
- [Bank dice game](https://familygameshelf.com/2024/08/06/how-to-play-the-bank-dice-game/)
  and [playbankdice.com](https://playbankdice.com/) — shared communal rolls with
  independent per-player banking; the basis for the Boonta Table.
- [Double or nothing](https://en.wikipedia.org/wiki/Double_or_nothing), Wikipedia —
  the 50/50 stacking wager.
- [Crash Gambling: The Math Behind The Multiplier](https://crashgamegambling.com/2025/11/29/provably-fair-crash-gambling-guide/)
  and [Crash games: what they are and how they're built](https://game-ace.com/blog/crash-games-explained/),
  Game-Ace — hash-committed provably-fair seeds, and holding house edge constant across
  cash-out targets so depth is variance rather than a penalty.
- [Dice betting systems explained](https://wolfbet.com/blog/dice-betting-systems/),
  Wolfbet — Martingale and friends, i.e. what a daily stake cap is defending against.
