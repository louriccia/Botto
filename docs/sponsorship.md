# Sponsorship — Game Design

> *"Everything in Mos Espa has an owner. The trick is being the one who collects."*

One system for everything sponsors do in the random challenge system. Today there are two
unrelated features — challenge sponsorships (live) and player sponsorships (disabled) — and both
were built to pay sponsors truguts that nobody paid in. This replaces them with **syndicates**
that invest in **deeds** to exact challenge setups and sign **racers** to contracts, where every
trugut a sponsor earns is one somebody else spent.

**Status: stage 0 committed on `challenge/sponsor-rent`, not yet deployed** — and production is
still paying player sponsors (§1.3), so deploying it is urgent. Everything past stage 0 (§13) is
plan. Every number is a starting value, not a measurement; the ones most likely to move are
called out where they appear.

---

## 1. The problem

### 1.1 Challenge sponsorships print truguts

Before stage 0, `submit.js` paid each sponsor `total_revenue × take` **on top of** what the player
earned. Nobody was charged for it:

- `take` stacked: every sponsorship of the same setup added `sponsor_cut` (20%) in `getSponsors`,
  and *Sorry About the Mess* doubled it. Five sponsorships with the effect paid out 200% of the
  challenge's revenue, all of it new money.
- `total_revenue` included prediction payouts, so sponsors took a cut of other people's bets.
- Sponsorships never expire. A one-off `2,200`–`5,500` purchase (`circuits[n].sponsor`) earned on
  that setup forever.
- `reroll.js` paid the **full** reroll cost to **every** sponsor. One sponsor was a transfer; two
  or more was money printing.
- The sponsor typed their own sponsor time, and beating it pays `+1,200` from the house — so a
  deliberately slow one minted `1,200` for every racer.

### 1.2 Player sponsorships printed truguts too

The disabled `sponsorplayer` paid the sponsor `take%` of a player's revenue on top of it, the same
bug. It's commented out in `submit.js` and the shop, but `users/*/random/sponsors` still holds the
records.

### 1.3 What the live data shows

Read from Firebase on 2026-09-27:

- **300 challenge sponsorships** on 280 setups, from 11 accounts; 20 setups sponsored twice. About
  📀1.19M was spent on them in all.
- **They paid out 📀20.19B**, all of it minted — about 17,000× what was spent. One account took 40%.
- **Player sponsorships paid out 📀507.68B** before they were retired — 25× more. Together, sponsors
  minted 📀528B, about 4.9% of every trugut in circulation.
- **Player sponsorships are still paying in production.** 📀2.05B has gone to racers' player sponsors
  since the 2026-07-27 retirement commit, the latest on 2026-09-25, plus 📀1.62B to accounts that
  match no sponsorship. Every local branch has the retirement; production doesn't.
- **Racers land on a setup that's already sponsored 6.2% of the time**, and on those runs the old
  code paid sponsors 27% on top of what the racers earned.
- **Most racing on sponsored setups is by the setup's own sponsor.** Run over the last 90 days of
  live challenges, stage 0 charges 📀0.09B of rent where the old code paid 📀24.49B: sponsoring has
  mostly been a way to multiply your own winnings.
- **The economy's scale:** the median payout per run over the last 90 days is 📀40.1M (15 active
  racers); the median balance is 📀120k, and one account holds 92.9% of the 📀10.76 trillion in
  circulation. Flat amounts in this design — the 📀1,000 minimum, Grand Opening's circuit price,
  `beat_sponsor`'s 📀1,200 — are rounding errors to active racers and real money to everyone else.
- **Data problems:** sponsorship records carry stale names (key by member id, never name); one
  stored a Discord id as a number, which rounded it to an id that matches no account; and 155
  payouts landed on challenges whose saved `sponsors` list was empty, because that list is rebuilt
  at render. Migration has to work from the sponsorship records.

### 1.4 Everything that's missing

- No way to choose what you sponsor — the shop rolls a random setup and that's it.
- No identity: no sponsor name, no ledger of what you hold or what it earned.
- No way to accept, refuse, negotiate or end a sponsorship.
- No way to settle co-sponsors of one setup, or outbid them.

---

## 2. Two bodies: racers and syndicates

- **A racer** races. Times, XP, challenge winnings, contracts.
- **A syndicate** sponsors. A name, an emoji, a motto, **stakes in deeds**, and a **roster** of
  racers: its founder plus everyone it has signed.

Every player is a racer; any player can also found one syndicate. **Only syndicates invest, and
only syndicates collect rent. Contracts only ever bind racers.** So a player can race for someone
else's syndicate and run their own at the same time; the conflict of interest that creates is
handled in §9.9.

Rolling a random challenge is rolling the dice. Racing a setup is what lets your syndicate invest
in it. Landing on one somebody else has invested in means paying them rent.

---

## 3. The rule

**Sponsors are paid in truguts that already exist. Nothing is minted.**

| Flow | From → to | Effect on the economy |
|---|---|---|
| Investing in a deed (§5.1) | syndicate → nobody | sink |
| Grand Opening (§5.4) | syndicate → nobody | sink |
| Training Program charge (§9.6) | syndicate → nobody | sink |
| Interest on contract debt (§9.3, proposed) | racer → nobody | sink |
| Rent (§6) | racer's winnings → the deed's investing syndicates | transfer |
| *Sorry About the Mess* cut (§8) | part of a new investment → existing holders | transfer (shrinks that investment's sink) |
| Contract fee, take, shortfall repayment (§9) | between syndicate and racer | transfer |
| Reroll cost on a deed with investors (§6.6) | racer → investors | transfer (the cost was a sink before) |

The one exception is the house bonus for beating a sponsor time (`beat_sponsor`, `+1,200`). It pays
the racer, not the sponsor, and stays — but only against a real time: the Ace's (§5.3), once per
racer per deed.

Any payout goes through `splitByWeight` or an equivalent that guarantees the shares add up to the
amount taken.

---

## 4. The board

### 4.1 What a deed is

A deed is **one exact single-track setup** — exactly what `matchingChallenge` compares:

```
track · racer · laps · nu · mirror · skips · backwards
```

| Axis | Values |
|---|---|
| Racer | 23 |
| Track, with its skips options | 39 (14 tracks with and without skips, 11 without only) |
| Laps | 5 |
| Upgrades, Mirror, Backwards | on / off each |

**23 × 39 × 5 × 2 × 2 × 2 = 35,880 deeds.** Multi-track challenges (Challenge of the Month) can't
be sponsored.

Deed id, used as the Firebase key: `{track}_{racer}_{laps}_{nu}_{mirror}_{skips}_{backwards}`,
e.g. `5_12_3_0_1_0_0`. Every existing entry in `challenge/sponsorships` is already a deed.

### 4.2 How often each deed lands

Racer and track are uniform (1/575 per pair). Conditions follow the roller's odds; with
`settings_default` — skips 25% (tracks that have them), no upgrades 15%, non-3-lap 5%, mirror 5%,
backwards 5% — the most common deed (3 laps, upgrades on, not mirrored, forwards) lands about
**once in 790 rolls**, and the rarest about **once in 490 million**. Players who change their own
odds move this a lot, which is what makes the board more than a fixed table.

---

## 5. Investing

### 5.1 Stakes and control

**A deed's rent is split by how much each investing syndicate has put in, out of everything
invested in it.**

> Your syndicate invests 📀10k in a deed: it gets 100% of the rent. Hutt & Sons invests 📀20k: the
> deed now holds 📀30k, so Hutt & Sons gets 67% and you get 33%.

- **Investments are sunk** — destroyed, never refunded or withdrawn. Otherwise a rich syndicate
  could park huge amounts on the best deeds, collect rent risk-free, and pull out when it liked.
- **Minimum 📀1,000 per investment**, first or not.
- **Control:** the syndicate that has invested the most. It sets the title on the deed's cards,
  can hold Grand Openings (§5.4), and counts the deed toward its Garages (§6.3). Ties go to the
  faster time, then to whoever reached that amount first.
- **Every deed levels itself out.** Rent is a fixed share of racers' winnings, so every trugut
  invested lowers everyone's return. Popular deeds attract money until they pay no better than
  anything else. Nobody sets prices.
- **Hoarding is impossible.** Any syndicate that races a deed can dilute its investors.

**Whale risk, and the fallback.** A linear split lets the richest syndicate take most of any deed
it reaches. Having to race a deed first (§5.2) is the limit on how fast it reaches them. If that's
not enough, weight stakes by `sqrt(invested)` — 10k against 20k then splits 41/59. Start linear.

### 5.2 You have to race a deed to sponsor it

A syndicate can make its first investment in a deed once **one of its racers** — its founder, or a
racer under contract — has submitted a time on that exact deed. Topping up a deed it already holds
works any time.

- **The 📜 Sponsor button** shows on a challenge card once you've submitted a time on it, for your
  own syndicate and for every syndicate you're signed to, and on the deed's page in
  `/syndicate lookup` for any deed your racers have raced.
- **Only times submitted after investing launches count.** Otherwise veterans would open with
  access to thousands of deeds on day one.
- **Signing racers widens a syndicate's reach.** Every deed a signed racer races during their
  contract opens to their sponsor. A whale can reach far more deeds that way — but only by paying
  real contracts, which is money moving to active racers. When a contract ends, the syndicate keeps
  its stakes and can still top them up.
- **The Challenge of the Day** works the same way: race it, and your syndicates can invest in it.
  The daily itself pays no rent (§6.4).
- **Bribed challenges count like any other.** Bribing is how a racer aims at a deed; heat is what
  that costs, and the deed still has to be raced.
- **No cooldown, no limit on amount.** Racing is the limit.

**Why a race and not a cooldown.** Today's one-sponsorship-per-23-hours rule throttled a faucet:
each sponsorship minted forever, so the clock capped how fast the leak grew. With sunk investments
and transferred rent, that job is gone. What's left is fishing — free rerolls let a player roll as
fast as they can click — and a clock would stop a whale only by punishing everyone else equally.
**A submitted time ties the limit to play:** each entry costs a real race. It fits the fiction —
you know what you're buying — and it means every investing syndicate has a racer's time on record
for the Ace. Times are on the honor system (§10).

### 5.3 The Ace

Every investing syndicate got in through a racer's time, so a deed's investors can be ranked by
time as well as by money:

- **Controller:** the syndicate that has invested the most. Money.
- **Ace:** the investing syndicate whose racer has the fastest time with a proof link. Skill.

**The Ace takes 20% of the deed's rent off the top;** the other 80% is split by stake, the Ace's
included. It's carved out of the same rent, so racers pay nothing extra.

> Hutt & Sons has 📀90k in a deed; your syndicate has 📀10k, and your time is the fastest. Racers
> pay 📀1,000 of rent: you get 📀200 as Ace plus 📀80 as a 10% investor, Hutt & Sons gets 📀720.
> Without the Ace you'd get 📀100.

- **A syndicate's times** are its founder's and those of every racer it has under contract, for
  the term (with one exception, §9.9).
- **Skill counters money.** Buying control doesn't buy the Ace — but signing fast racers can.
- **The Ace changes** whenever an investing syndicate's racer posts a faster time, with an alert:
  *"Hutt & Sons took Ace on Anakin on Boonta Training, 3 laps, mirrored — Kiro, 1:02.345, 0.4s
  faster than you."*
- **The Ace's time is the deed's sponsor time.** Racers chase the fastest time among the
  investors; beating it pays `beat_sponsor` once per racer per deed. The typed *Custom Time* field
  goes away. No time with a proof link among the investors means no sponsor time.

### 5.4 Grand Openings

The existing *Sponsor Challenge* shop item becomes **Grand Opening**: the controller of a deed pays
its circuit's price (`circuits[n].sponsor`, destroyed) to publish the deed as an open challenge,
with its title and sponsor time — today's publish flow. Every submission to an open challenge pays
rent, so it's advertising for the deed, and for its signed racers a training camp (§9.6).

### 5.5 Outbid alerts

When someone invests in a deed your syndicate holds, you get a DM — *"Hutt & Sons put 📀20k into
Anakin on Boonta Training, 3 laps, mirrored. You're now at 33%, and they control it."* — with a
button to top up. At most one alert per deed per hour; later ones are rolled into it.

---

## 6. Rent

### 6.1 Money buys share, Garages buy rate

**How much is invested in a deed never changes what racers pay on it.** Investment only decides the
split. The rate depends on one thing: the Garage its controller has built (§6.3). A whale pouring
📀10M into one deed takes the rent from the deed's other investors; racers don't notice.

### 6.2 Base rent — shipped in stage 0

When someone submits to a challenge on a deed with investors, the investors split **10% of what the
racer keeps** (`sponsor_rent`), after any sabotage cut and before anything else. It's deducted on
the receipt as `-📀X 📢 Sponsor Rent` and saved at `earnings/{member}/rent`, so re-rendered receipts
show what was charged. Prediction payouts aren't part of rent.

### 6.3 Garages (the Monopoly part)

A deed's **Garage** is the other deeds with the same racer and track — its other condition
variants: 40 in all, or 80 on a track with skips.

```
rent = 10% + 0.375% × (other deeds in the Garage the controller also controls)      capped at 25%
```

| Controller also controls | Rent |
|---|---|
| Nothing else | 10.0% |
| 4 other variants | 11.5% |
| 20 other variants | 17.5% |
| All 40 (the **Full Garage**) | 24.6% |
| 40 or more on a track with skips | 25.0% (cap) |

A **Full Garage** also makes that syndicate the pair's named sponsor on its cards. Every step is
small, so rent never jumps, and a player can work it out in their head. Rare variants are the hard
part of a Full Garage: they have to be raced to be invested in (§5.2).

### 6.4 Limits and exemptions

- **25% of a payout, per deed.** For comparison, sabotage takes 50%.
- **The rate is shown on the card** when it's rolled (`📢 Hutt & Sons · rent 15%`), before the
  racer commits.
- **No rent on the Challenge of the Day.** Most of the server races it; whoever held its deed would
  collect from everyone.
- **No rent below player level 5** (`sponsor_level`). A new player's first brush with sponsorship
  shouldn't be a bill. Level 5 is 230 racer XP in total — about 10 per podracer, roughly 80–115
  challenges.
- **A racer never pays their own syndicate's share,** and a signed racer never pays their sponsor's
  (Team rate, §9.6).

### 6.5 Keeping the bite honest

- **Taking one deed breaks a Garage.** When control of a deed changes hands, every other deed in
  the old controller's Garage drops a step. Racers annoyed by a high-rent Garage can fight it: race
  one of its deeds and out-invest its controller.
- **Minority investors ride along** at the controller's rate, which draws money to strong Garages
  — and that money can flip control.
- **An economy-wide measure:** rent paid ÷ everything racers kept, reported by the stage 1 audit
  and tracked from then on. With no limit on how many deeds a syndicate holds, most deeds that get
  raced will soon have an investor, so **rent on most rolls is the intended state and about 10% is
  the intended bite** — enough to notice, not enough to hurt. The measure is there to catch Garages
  pushing it much above that; if they do, lower the step, not the base.

### 6.6 Rerolls — shipped in stage 0

Rerolling a challenge on a deed with investors pays the reroll cost to them, split by stake,
instead of the full cost to each. A racer whose own syndicate has invested in the deed rerolls it
free.

---

## 7. The syndicate

- **Separate from its founder's racer**, one per player. Its roster is its founder plus everyone
  under contract. It can't sign its own founder.
- **Founding:** free, from `/syndicate` or the first time you invest. Name (≤32 characters, unique),
  emoji, motto (≤100). Stored at `users/{key}/random/syndicate`.
- **Wallet:** spends and earns from its founder's trugut balance.
- **Ledger:** every deed and contract, with lifetime invested and earned and 30-day earnings,
  appended to `challenge/deeds/{id}/ledger` and `challenge/contracts/{id}/ledger`.
- **`/syndicate`:** holdings and shares, where it controls and where it's Ace, Garages, top
  earners, the roster, recent outbids. **`/syndicate lookup`:** anyone else's.
- **Leaderboards:** by 30-day rent, and a team leaderboard by the racer XP its roster earns each
  month.
- **On challenge cards:** `📢 {emoji} {Syndicate} · rent 12%`.
- `bankroller_clan` becomes "control N deeds".

---

## 8. Sorry About the Mess

The *Space Bar* collection's effect used to double the sponsor's take. Under proportional stakes,
doubled weight would mean outbidding at half price, so it gets a new job:

**When another syndicate invests in a deed you hold, you get a cut of their investment: 10% × your
share of the deed just before they invested.**

- Paid once, at the moment of the investment. It has nothing to do with rent.
- Never on your own top-ups. The investor's stake counts their full investment; the cut comes out
  of what would have been destroyed.
- With several holders, each with the effect gets 10% × their share. The total never exceeds 10%.

| Step | Action | Cut paid | Stakes after | Split |
|---|---|---|---|---|
| 1 | You invest 📀10k | nothing | 10k / 0 | 100 / 0 |
| 2 | Hutt & Sons invests 📀20k | **you get 📀2,000** (10% × 100%) | 10k / 20k | 33 / 67 |
| 3 | You top up 📀15k | **they get 📀1,000** (10% × 67%) | 25k / 20k | 56 / 44 |
| 4 | They top up 📀10k | **you get 📀556** (10% × 56%) | 25k / 30k | 45 / 55 |

It doesn't escalate — a bidding war between two holders costs both about 10% less — and it can't
be farmed: every alt loop destroys at least 90% of what goes in. It doesn't help you attack; it
makes being attacked pay. **Stage 0:** the effect does nothing yet, and the collection text says so.

---

## 9. Contracts

**The syndicate pays you a fee now. You race a quota, and it takes a share of what you win in
it.** A contract binds the racer only — never rent, and never the racer's own syndicate.

### 9.1 Who can be signed

**Player level 5 or higher**, which keeps fresh and alt accounts out. A syndicate can't sign its
own founder, and a racer who still owes on a contract (§9.3) can't sign a new one.

### 9.2 The deal

- **A fee,** paid at signing. **Minimum: `1.25 × take × expected winnings over the quota`.** At the
  form they're already in, a racer who meets the quota comes out 25% ahead.
- **A take:** 5–25% of all the racer's random challenge winnings — every challenge type, plus
  prediction and bounty payouts — **after rent and after every multiplier**, the racer's own
  included (*Trugut Boost*, *Fame and Fortune*, *Fan Service*). Never level-up rewards, market
  trades, refunds or shop sales.
- **A quota,** one of two kinds:

| | **Races** (paid by the mile) | **Days** (paid by the hour) |
|---|---|---|
| Quota | N races, 20–300 | D qualifying days, 7–30 |
| Window | 60 days | D days |
| A day qualifies when | — | the racer completes the daily minimum |
| Expected winnings | average payout per race × N | average winnings per racing day × D |
| Suits | Grinders who race in bursts | Players who do a careful run or two a day |

- **The daily minimum** (days quotas only) defaults to the racer's average races per racing day. A
  racer can counter it lower, and the minimum fee drops in proportion — one race a day instead of
  five means a fifth of the fee. It's a real bargaining term rather than a loophole.
- **Optionally, exclusivity:** the racer can't sign any other contract while it runs.

Averages come from the racer's last 30 days.

### 9.3 Falling short

When the window closes, or the racer leaves early, the **shortfall** is races not raced ÷ N, or
qualifying days missed ÷ D, and the racer **repays `fee × shortfall`** to the syndicate.

- **The syndicate gets back exactly the shortfall, never more.** It's made whole, and it never
  profits from a racer falling short. If it could, the best business would be signing racers you
  expect to fail.
- **The racer chooses how to repay:** in full straight away, or a share of every challenge payout
  that they set (10–100%), shown on receipts as `-📀X ↩️ {Syndicate}`.
- **Proposed: interest on what's still owed, destroyed.** A small daily rate on the outstanding
  balance, paid by the racer and sunk rather than paid to the syndicate. Repaying slowly costs
  something, so the knob is a real trade-off; the syndicate still only ever gets its shortfall.
- **No new contracts while owing** (§9.1).

The quota is where the racer's stake lies. The fee is theirs to keep only if they race for it.

### 9.4 The bargaining axis

The two kinds of quota are the same deal priced for different play styles, like truckers paid by
the mile or by the hour:

- **A races quota rewards volume.** A grinder burns through it quickly. The syndicate's risk is
  sloppy runs: the fee is fixed while its take shrinks with worse results.
- **A days quota rewards showing up.** The syndicate's risk is thin days, which the daily minimum
  prices: a syndicate that wants volume asks for more races a day; a racer who wants an easy daily
  rhythm takes less money for fewer.
- **The take keeps both honest.** It's a share of winnings, so the syndicate always wants good
  runs, and it prices each racer on what kind of racer they are.
- **Timing is its own game.** The take applies after multipliers, so a racer will save their own
  *Trugut Boost* for after a contract ends, and a syndicate will want contracts running through
  Anniversary Month.

### 9.5 Who wins when

| The racer's… | Result |
|---|---|
| Form improves | **Syndicate** wins — its take outgrows the fee |
| Form stays the same | **Racer** wins — the 25% margin |
| Form drops, or runs get sloppy | **Racer** wins — the fee cushions them |
| Quota falls short | About even — the shortfall is repaid |
| Winnings get multiplied during the contract | **Syndicate** wins, unless the racer times their boosts around it |

A contract is the syndicate **buying a share of the racer's upside and selling them protection on
the downside.** The syndicate bets on the racer; the racer bets the syndicate overpaid, and has to
race to keep the fee.

### 9.6 What's in it for the racer

- **Money up front, ahead of their pace.**
- **Team rate** — automatic. Their sponsor's share of rent is waived on every deed it's invested
  in. A syndicate with a big portfolio is a better sponsor.
- **Training Program** — automatic. Double racer XP on challenges whose deed the sponsor
  **controls**, checked at submission. A syndicate controlling 10 common deeds triggers it on about
  1% of a racer's rolls; one controlling 100, about 13%. Grand Openings become training camps. The
  sponsor pays a flat charge each time it triggers, destroyed — level-ups pay truguts, so extra XP
  is indirectly minted money, and the charge is set above what it pulls forward.
- **Status:** *Racing for {emoji} {Syndicate}* on their cards, leaderboard entries and profile, and
  a place on the team leaderboard.
- **A launchpad:** the fee is capital for their own syndicate.

### 9.7 What's in it for the syndicate

- **The growth bet.** The minimum is priced on the racer's last 30 days, so it underprices exactly
  the racers who are about to get better. Spotting them first is the scouting game.
- **The Ace.** A signed racer's times count for their sponsor (§5.3), so signing fast racers makes
  your syndicate the Ace on your own deeds: the 20% stays home, and your deeds carry a hard sponsor
  time. This is the works team, and it needs no special rule.
- **Reach.** Every deed a signed racer races opens up for investing (§5.2).
- **Standing:** the team leaderboard and the *Racing for* tag.

### 9.8 Offers, running and renewing

- **Offers are unlimited.** They arrive as a DM plus a post in the challenge channel, with **Accept
  · Counter · Decline**; a counter changes any term and passes it back. Offers expire after 48
  hours, and every round is kept on `challenge/contracts/{id}/offers`. A racer can mute offers or
  set a minimum fee below which they're declined automatically.
- **Every offer carries a scouting report:** the racer's races per day, average payout, medal mix
  and trend, **for the last 30 days and lifetime**, side by side — so a returning veteran isn't
  priced on a quiet month — plus the conflict-of-interest disclosure (§9.9).
- **Several contracts at once**, unless one is exclusive, up to a **combined take of 75%** of the
  post-rent payout. One race counts toward every quota it falls under.
- **Receipts** show one line per contract: `-📀X 🤝 {Syndicate}`.
- **Renewal:** in a contract's last few days, the syndicate can send a renewal — the same terms,
  with the fee re-checked against the racer's new minimum. The racer accepts in one click or
  counters. It matters most for works Aces, whose times stop counting for the sponsor the moment a
  contract ends.

### 9.9 Conflicts of interest

A signed racer can still run their own syndicate, and the two can meet on the same deeds.

- **One team at a time.** On a deed both the racer's own syndicate and their sponsor have invested
  in, the racer's times count for the sponsor only, for the term. One time can't make two
  syndicates the Ace. With several sponsors on the same deed, the contract signed first gets the
  racer's times.
- **Disclosure.** Every offer shows the racer's own syndicate and every deed where it has invested
  alongside the sponsor, so the sponsor sees the conflict before pricing the deal.

Beyond that, the racer's syndicate competing with its sponsor for control is ordinary competition.

### 9.10 The shapes contracts take

Worked examples at the minimum fee unless noted. Illustrative numbers.

| Shape | Terms | How it plays out |
|---|---|---|
| **Rookie Scout** — a small syndicate signs a racer who just hit level 5 | 50 races, 15%, fee 📀12,000 (min 11,250); averages 📀1,200 and climbing | Breakout to 📀2,000: syndicate +3,000. Plateau: racer +3,000. Stops after 20: repays 60%, racer +1,200. **Venture capital** — many small bets, won on the breakouts. |
| **Works Ace** — a tycoon signs a fast, proven racer | 14 days at 2 races, 10%, exclusive, fee 📀40,000 (min 10,500) | The tycoon is buying the Ace on its deeds, not the take. Aces lapse when the contract does, so **renewal** is the real negotiation. |
| **Volume Deal** — a grinder who races in bursts | 300 races, 25%, fee 📀168,750; averages 📀1,800 | Usual form: racer +33,750. Rushes to 📀1,300: racer +71,250. Hot streak or Anniversary Month to 📀3,600: syndicate +101,250. **Big and swingy.** |
| **Daily Regular** — one or two careful runs a day | 30 days, minimum 1, 20%, fee 📀26,250; average day 📀3,500 | All 30 days: racer +5,250. Misses 6: repays 20%, racer +4,200. A steady presence for reach and the team leaderboard. |
| **Comeback** — a strong veteran back from a break | Near-zero 30-day form; offered 📀5,000 for 100 races at 25% | Back to 📀2,500 a race: syndicate +57,500. The lifetime column of the scouting report is the racer's defence: they counter to what they're worth. |
| **Stack** — three non-exclusive contracts | 3 × 100 races at 25%, 📀62,500 each; averages 📀2,000 | Steady form: racer +37,500 across all three, one set of races filling every quota. Improves: three syndicates share the upside. Why exclusivity has a price. |
| **Friendly Deal** — friends, or an alt | A fee far above the minimum, 5%, 20 races | A gift dressed as a contract (§10). |

### 9.11 The old player sponsorships

`users/*/random/sponsors` holds purchases of 📀50k, 📀100k and 📀200k (a 5%, 10% or 20% take) that
stopped paying out when the feature was turned off. **They're refunded in full** (`take × 10,000`
each, as a `manageTruguts` refund) in stage 1, and the records are archived. Earlier payouts aren't
deducted — they were minted, so there's no one to return them to.

---

## 10. Exploits and the honor system

**Times are on the honor system, and this design keeps it that way.** The random challenge system
has always trusted what racers submit, and the community polices it as it polices the leaderboards.
Nothing here adds verification. The Ace's proof link is there for people to look at, like every
proof link today.

**Accepted by design** — each needs a fake time: unlocking the 📜 Sponsor button on a deed you
haven't raced, taking the Ace, earning Training Program XP from runs that didn't happen.

**The one mechanical check** is the existing impossible-time check: a time faster than the time
since the challenge was rolled is rejected and counted as `funny_business`. It had been silently
disabled by an operator-precedence bug; stage 0 fixes it.

**Guards**

- **Outbid-alert spam** — each alert already costs 📀1,000, and alerts are batched (§5.5).
- **Contracts as a gift pipe** — the fee has a floor but no ceiling, so any syndicate can move any
  amount to any racer at level 5+. **Open:** accept it, or cap fees at about 3× the minimum.
- **Fees as free loans** — without a cost to repaying slowly, a racer could fall short and repay a
  sliver of each payout forever. The proposed interest on outstanding debt (§9.3) is the guard.

**Watching**

- **Alts and *Sorry About the Mess*:** every loop loses at least 90% (§8).
- **Rookie alts** playing rent-free: their winnings are minted by the house either way, and rookies
  are a small share of payouts.

---

## 11. How players see it

The rules above are for building it. Players should never need them: **every screen shows the
result of an action before the player takes it**, in plain words, and each feature appears only
when it becomes relevant.

### 11.1 Vocabulary

| In this doc | On screen |
|---|---|
| Deed | **the challenge** — "Anakin · Boonta Training · 3 laps · mirrored" |
| Stake | **your sponsorship**, "you've put in 📀10k" |
| Controller | **Lead sponsor** |
| Ace | **Ace** |
| Garage | **Garage** — "21 of 40 variants" |
| Sponsor's rent waiver (§9.6) | **Team rate** — "no rent to your team" |
| Fee, take, quota | the deal in a sentence: "they pay you X now, you race N, they take Y%" |
| Shortfall | **Payback** |

### 11.2 The five lines

The whole system, for `/syndicate help` and the first-time popup. A player who can repeat these
back can play; everything else is detail they meet as it comes up.

> 1. Race a challenge, and you can sponsor it.
> 2. Sponsors split the rent — 10% of what racers win on it — by how much each put in.
> 3. The lead sponsor sets the rent. Sponsor more variants of that racer and track, and it climbs
>    to 25%.
> 4. The fastest sponsor is the **Ace** and takes a fifth of the rent.
> 5. Syndicates sign racers: pay them now, take a share of their next races.

Before building, try these on a few community members and see which line they get wrong.

### 11.3 Surfaces

**Challenge card** — one line:
```
📢 Hutt & Sons · rent 17.5% · ⚡ Ace: Kiro 1:02.345
```

**Receipt:**
```
-📀350  📢 Sponsor rent (17.5%)
-📀400  🤝 Hutt & Sons (20%)
```

**The 📜 Sponsor preview** — a calculator, not a form:
```
Sponsor  Anakin · Boonta Training · 3 laps · mirrored
Sponsors: 📀100,000 in total — Hutt & Sons 90% (lead), you 10%
Last 30 days: 12 runs, 📀4,200 rent paid
Rent here: 17.5%  (Hutt's Garage: 21 of 40 variants)
Ace: Hutt & Sons (Kiro 1:02.345) · your best: 1:02.745

Put in 📀[ 20,000 ] →
  your share 10% → 25%  ·  ≈📀1,000/month at last month's pace
  Not enough to become lead sponsor (need 📀80,001)
  Money put in is spent for good. It can't be withdrawn.
```
When an amount would make you lead sponsor, it says what that does: *"You'd become lead sponsor.
Rent here drops to 10% (your Garage: 0 of 40)."* That surfaces the cost of taking control (§6.5)
exactly when it matters, with no explanation needed.

**The challenge's page** in `/syndicate lookup`: its sponsors and shares, the lead sponsor and their
Garage, the Ace and their time, and 30 days of runs and rent.

**Contract offer:**
```
🤝 Hutt & Sons offers you 📀50,000 now.
   Race 100 challenges within 60 days. They take 20% of your winnings on them.
   At your usual pace: you hand over ≈📀40,000 → ≈📀10,000 ahead.
   Fall short: pay back the unraced share (60 of 100 raced → 📀20,000).
   Perks: no rent to your team · double XP on their 34 lead sponsorships
[Accept] [Counter] [Decline]
```
The scouting report (§9.8) sits under it for the syndicate's side.

**Alerts** say what happened, what it did, and what you can do:
- *"Hutt & Sons put in 📀20k on Anakin · Boonta Training · 3 laps · mirrored. You're now at 33%.
  [Top up]"*
- *"Kiro took lead on Anakin · Boonta Training · 1 lap. Your Garage is now 20 of 40 — rent on your
  other variants drops to 17.1%."*
- *"Hutt & Sons took Ace on … — Kiro, 1:02.345, 0.4s faster than you."*

**`/syndicate`** always shows what you owe and to whom, if anything.

### 11.4 Features appear when they're relevant

- **Most racers** only ever see the rent line, the Ace time and their receipt. That's enough to
  play.
- **Sponsoring** appears once you've raced a challenge — the 📜 Sponsor button — and the rest of
  `/syndicate` once you've founded one.
- **Contracts** appear at level 5.
- **Rare rules explain themselves where they apply.** The conflict-of-interest rule is one line on
  the screen it affects: *"Your times count for Hutt & Sons here while your contract runs."*

### 11.5 Where confusion is still likely

- **"I paid — why can't I get it back?"** The spent-for-good warning is on the confirm step every
  time, not once.
- **"My rent went down and I didn't do anything."** Someone took lead on one of your variants; the
  alert says so, with the new rate.
- **Payback from several contracts** — always visible in `/syndicate`, with who it's owed to.

---

## 12. Personas

| Persona | Who | Wants | Where they live in the design |
|---|---|---|---|
| **Newcomer** | Below level 5 | To race and level up without getting fleeced | Pays no rent; can found a syndicate and invest in anything they've raced; can't be signed yet |
| **Up-and-comer** | Level 5+, improving fast | Money, momentum, a way in | The main contract target; their own small syndicate can hold the Ace on deeds nobody fast has raced |
| **Ace hunter** | Fast, not necessarily rich | Money for skill | Small stakes in many deeds, holding the Ace; the most valuable signing |
| **Grinder** | Races in long bursts | Pay for volume | Races quotas |
| **Daily racer** | One or two careful runs a day | Pay for showing up | Days quotas; the daily is rent-free |
| **Tycoon** | Rich, established syndicate | Rent, Garages, prestige | Controls Garages, signs racers to be its Aces and widen its reach |
| **Collector** | Devoted to one racer and track | A Full Garage | Races every variant; *Sorry About the Mess* pays them when raided |
| **Raider** | Wants to break a rival's Garage, or pay less rent | One key deed | Races it and out-invests its controller (§6.5) |
| **Casual** | Plays now and then | To race without thinking about this | Barely touched: rent-free daily, rent capped and shown up front |

**Why a tycoon signs an up-and-comer:** the growth bet, the Ace on its own deeds, reach, and
standing (§9.7). **Why an up-and-comer signs:** money up front and ahead of their pace, perks that
grow with the sponsor's portfolio — which pulls them toward established syndicates — faster levels,
status, and capital for their own syndicate (§9.6). **What they give up** is a share of their
growth, and short quotas keep that from being a trap. §9.10 walks through the shapes this takes.

**The other way round:** a small syndicate rarely signs an established star — the star's minimum
is high, there's little growth left to bet on, and a small portfolio makes thin perks. So small
syndicates scout racers the moment they reach level 5, when they're cheapest, and renew the ones
who improve before a tycoon outbids them. Scouting early is a small syndicate's business model.

| Persona | Threat | Protection |
|---|---|---|
| Newcomer, Casual | Rent eating their winnings | 25% cap, rate shown up front, rent-free daily, no rent below level 5 |
| Up-and-comer | Signing away their growth | Short quotas, the minimum fee, the lifetime column of the scouting report |
| Ace hunter | A whale buying their deeds out from under them | Control can be bought; the Ace can't |
| Collector | A raider taking one deed from their Garage | *Sorry About the Mess*, outbid alerts, topping up any time |
| Tycoon | A racer who signs and coasts | The quota and shortfall repayment; the daily minimum; the take |
| Everyone | A whale clicking through setups | Having to race a deed before investing |

---

## 13. Implementation plan

### Stage 0 — Stop the printing · **committed, not yet deployed**
Branch `challenge/sponsor-rent`, rebased on `master`. **Deploying it is urgent:** production is
running code from before the player-sponsorship retirement and is still minting for player sponsors
(§1.3). `master` already has that retirement, so deploying stage 0 stops both leaks at once. Sponsor income is 10% of the racer's winnings, split by weight
(`sponsorHolders`, `splitByWeight`, `sponsorRent`). No stacking, no prediction revenue, no rent on
the daily or below level 5, no *Sorry About the Mess* doubling, and reroll costs are split instead of
paid to each sponsor. Rent is saved per submission for receipts. Also fixes the impossible-time
check in `submit.js` (§10).

### Stage 1 — Data and audit
The first audit ran on 2026-09-27 (§1.3); its scripts become the repo's audit script. Open from it:
**whether flat amounts should scale** with a setup's typical payouts or the investor's balance.

- `deedId(challenge)` and a `challenge/deeds/{id}` store with per-syndicate totals.
- The read-only audit, kept runnable: sponsorships per deed, stacking, lifetime `sponsor_earnings` paid, landing
  frequency from `challenge/times`, how many active players are past level 5, and the economy-wide
  rent rate (§6.5).
- A migration dry run (§14), reviewed before anything is written.
- Refund the old player sponsorships (§9.8).
- Sponsor time against a real time, once per racer per deed. Until stage 3 there's no Ace, so it's
  the sponsor's own best time on the setup.

### Stage 2 — Syndicates
Founding, the ledger and `/syndicate`, on migrated data. No change to how money moves.

### Stage 3 — Investing
The race-to-invest rule and the 📜 Sponsor button, stakes and control, the Ace and its sponsor time,
Grand Openings in the shop, outbid alerts, *Sorry About the Mess*. Rent splits by stake. The
📜 Sponsor preview calculator and the challenge's page ship with it — they're what makes investing
readable, not a finishing touch (§11).

### Stage 4 — Garages
The Garage rate, the cap and the rate shown on cards. Tuned once stage 3 has built real holdings.

### Stage 5 — Contracts
The fee, take and quota, the minimum fee, the daily minimum, shortfall repayment and its knob,
exclusivity, Team rate and the Training Program, offers with the scouting report, counters and
renewals, the 75% ceiling, conflict of interest, the team leaderboard.

**Why this order:** each stage moves money only through pieces already live and measured. Rent had
to stop minting first; investing has to run before Garages can be tuned; contracts depend on
investing for the Team rate, the Training Program, reach and the Ace.

---

## 14. Migration

- Every player with a sponsorship gets a syndicate, named after them until they rename it.
- Each `challenge/sponsorships` record becomes an investment of its circuit's sponsor price in its
  deed. A deed several people sponsored becomes a proportional split; one sponsored several times by
  one person becomes a larger stake. Multi-track entries keep their titles and pay nothing.
- Titles go to the controller. Typed sponsor times are dropped.
- Published open challenges stay as they are and pay rent under the new rules.
- **No clawback** of truguts earned under the old payouts.

---

## 15. Cut on purpose

- **Tracks as properties.** Too coarse: it would erase the exact sponsorships that already exist.
- **Fixed shares, self-assessed prices, a holding tax.** Proportional stakes settle outbidding,
  co-ownership and hoarding with nothing to price or collect.
- **Withdrawable investments.** Risk-free rent for whoever has the most money.
- **A rent rate tied to how much is invested.** One wallet would raise what every racer pays.
- **Opening prices.** A probability-based price on the first investment only; anyone who races the
  deed can outbid it straight away. A flat 📀1,000 minimum does the job.
- **Circuit, Stable and Territory boosts, and a rent curve.** Small weights, costly to compute, hard
  to explain. The Garage and a straight line carry the idea.
- **Scouting without racing.** It needed its own cooldown. The shop item became Grand Opening.
- **A bribe surcharge.** A bribed challenge still has to be raced, and heat already prices aiming.
- **Money perks** — expense accounts, performance bonuses, sabotage insurance, stake grants. Each was
  a fee in disguise, and together they caused most of the exploits: refund laundering, reroll
  drains, alt sabotage, fake-PB bonuses, a stake market. A syndicate that wants to be generous pays
  more.
- **Daily salary, per-race pay, buyouts and escrow.** A fee paid against a take mostly cancels out
  and was hard to read. One fee up front plus a quota says the same thing plainly, and the
  shortfall repayment does the job a buyout did.
- **Interest paid to the syndicate.** It would pay sponsors for racers failing.
- **Portfolio and roster limits.** Capping how many deeds a syndicate can hold, or how many racers it
  can sign, would make each one a sharper choice — but it would also cap how far a syndicate can
  grow, and racing already paces how fast it reaches new deeds. So a syndicate that races widely,
  or signs widely, holds widely.
- **Poaching and non-compete terms.** Racers can leave freely, and a racer's syndicate competing
  with its sponsor is ordinary competition. Either can come back if it turns out to matter.
- **Minted rent paid by the house.** That's the bug.
- **Multi-track deeds.** Too few COTM rolls to be worth owning.

---

## 16. Future: Wald Street listing

Parked, not planned. A syndicate could list on the Wald Street Exchange, anchored on its rent and
paying dividends from it. It needs its own treasury (shareholders would own part of it) and an
anchor alts can't inflate — rent from racers outside its roster only. Design it once the rest has
real history to price from.

---

## 17. Decisions

**Made**

- Deeds are exact single-track setups; multi-track challenges can't be sponsored.
- Racers and syndicates are separate bodies. Only syndicates invest and collect rent; contracts
  bind racers.
- Rent comes out of the racer's winnings, 10% base, split by proportional, non-refundable stakes;
  the biggest investor controls the deed.
- A syndicate can invest in a deed once one of its racers has raced it (after launch). No cooldown.
  Minimum 📀1,000.
- The Ace: the investing syndicate with the fastest time with a proof link takes 20% of rent off the
  top, and its time is the sponsor time. `beat_sponsor` pays once per racer per deed.
- Garages: +0.375% per other controlled variant of the same racer and track, capped at 25%.
- No rent on the Challenge of the Day or below level 5.
- *Sorry About the Mess* is a cut of rivals' investments.
- The shop item becomes Grand Opening.
- Contracts are a fee up front, a take and a quota of races or days. Level 5+; minimum fee 1.25×
  the expected take; take 5–25% of all random challenge winnings, after every multiplier; a daily
  minimum on days quotas that defaults to the racer's average and scales the minimum fee; optional
  exclusivity; a 75% combined ceiling; unlimited offers.
- A shortfall is repaid to the syndicate at exactly its share of the fee, never more. The racer
  chooses how fast, and can't sign a new contract while owing.
- Offers carry a scouting report with 30-day and lifetime form. Syndicates can send renewals.
- Team rate and the Training Program are automatic for signed racers.
- No limit on how many deeds a syndicate holds or how many racers it signs.
- 10% base rent, and about 10% economy-wide is the intended bite.
- On deeds a racer's own syndicate shares with their sponsor, the racer's times count for the
  sponsor; offers disclose the overlap. A syndicate can't sign its founder.
- Old player sponsorships are refunded in full.
- Times stay on the honor system; only the impossible-time check is enforced.

**Open**

1. Cap contract fees at about 3× the minimum, or leave them uncapped (§10).
2. Interest on outstanding contract debt, destroyed, and its rate (§9.3).

**Set from the audit**

3. The Garage step, checked against the economy-wide rate (§6).
4. The Training Program charge per trigger (§9.6).
5. The *Sorry About the Mess* rate, 10% to start (§8).
6. Contract bounds: take and quota sizes (§9.2).

**Only if needed**

7. Square-root stake weighting, if racing to enter isn't enough to contain whales (§5.1).

---

## References

- Rent and payout: `sponsorHolders`, `splitByWeight`, `sponsorRent`, `challengeWinnings`
  (`src/interactions/challenge/functions.js`); `src/interactions/challenge/submit.js`;
  `src/interactions/challenge/reroll.js`
- Matching and rolls: `matchingChallenge`, `getSponsors`, `initializeChallenge` (`functions.js`);
  `settings_default` (`src/interactions/challenge/data.js`)
- Levels: `playerLevel`, `challengeProgression`, `progressionReward` (`functions.js`)
- Current sponsorship flow: `src/interactions/challenge/sponsor.js`,
  `src/interactions/challenge/shop/sponsorchallenge.js`,
  `src/interactions/challenge/shop/sponsorplayer.js`
- Rates: `sponsor_cut`, `sponsor_rent`, `sponsor_level`, `beat_sponsor`
  (`src/data/challenge/trugut.js`); circuit prices (`src/data/sw_racer/circuit.js`)
- *Sorry About the Mess*: `src/data/challenge/collection.js` (`sorry_mess`)
- Bribes and heat: `docs/heat.md`
