# Heat — Game Design

> *"Yes, I'm a bit short on truguts... but you're not the only one who can make deals, eh?"*

A risk/reward layer on bribes in the random challenge system. Bribing is currently a flat
fee, which means it is a wall for new players and free for rich ones. **Heat** replaces the
price with a rate — and gives the two most-ignored collection abilities a job.

**This is a proposal, not shipped behaviour** — with one exception: §7.1, surfacing the
abilities that already exist, is built and marked as such. Every file reference below points
at code as it exists today; everything under "the model" is a design to be argued with.

---

## 1. The problem

A bribe costs a flat `5,000` truguts — `truguts.bribe_track` and `truguts.bribe_racer` in
`src/data/challenge/trugut.js`. A typical challenge pays out somewhere around `1,000`–`3,000`
before multipliers (`challengeWinnings`, `src/interactions/challenge/functions.js:894`+).

So the fee lands in exactly the wrong place on both ends:

| Player | Balance | What 5,000 truguts means |
|---|---|---|
| New | ~10,000 | Two bribes and you're broke. Never bribes. |
| Established | ~500,000 | A hundred bribes. Notices the number. |
| Endgame | 50,000,000+ | Nothing. Bribes every challenge, forever. |

Flat fees always break this way against an unbounded currency. And for the endgame player
the fee is often **literally zero** — three separate paths already zero out `delta.cost`:

- `smuggling_routes` — same-planet track bribes are free (`functions.js:1851`)
- Citizenship — all bribes on your citizen planet are free (`functions.js:1899`)
- `free_bribes` — the shop's *Credits WILL Do Fine*, currently commented out
  (`functions.js:2301`), and its handler `src/interactions/challenge/shop/bribes.js`

Price is not the constraint at the top of the economy. It is already gone.

**Heat is the one cost a full wallet can't pay off.** That is the entire thesis. It also
means `free_bribes` becomes sellable again — free bribes still run hot, so the item stops
being an economy-ender and starts being a build choice.

---

## 2. The fiction

`src/data/sw_racer/planet.js` already names a **host** for every planet:

| Planet | Host | Citizen title |
|---|---|---|
| Ando Prime | Ten-Abu Donba | Bendu Monk |
| Aquilaris | Nave Vengaris | Aquilaris Tourist |
| Baroonda | Maja Fey'ja | Proud Majan |
| Malastare | Nugtosh | Malastare Miscreant |
| Mon Gazza | Groff Zugga | Spice Miner |
| Oovo IV | Fenn Booda | Oovo IV Prisoner |
| Ord Ibanna | Dethro Glok | Cloud Scrapper |
| Tatooine | Jabba the Hutt | Tatooine Native |

Heat is not a police meter. It is **how tired the pit bosses are of your money.** Every
penalty is delivered by a named host on a named planet, which is where all the flavour text
comes from and why citizenship means anything at all.

---

## 3. The model

One number. Not eight.

```
user_profile.heat = {
    value:  0-100,          // the gauge
    updated: <timestamp>,   // for time decay
    recent: [3, 7, 3],      // last few planets bribed — flavour + ability checks
    penalties: { ... }      // active effects, see §5
}
```

An earlier draft tracked heat per planet. Eight gauges is a spreadsheet, and the player
can't hold it in their head. Heat stays **global**; the planet only modifies the *rate* you
gain it and the *severity* of the roll. One gauge, local weather.

### 3.1 Gaining

Keyed off `delta.changes`, which `bribeDelta` already returns as a discrete array
(`functions.js:1842`) — so there is no new bookkeeping to invent.

| Bribe | Heat |
|---|---|
| Track swap | **+15** |
| Racer swap | **+15** |
| Each condition change (`altered_deal`) | **+8** |

Then modified, in order:

```
heat_gain = base
          × (citizen_planet ? 0.5 : 1)      // Home Turf
          × (citizen_elsewhere ? 1.25 : 1)  // Outlander
          × (smuggling_same_planet ? 0 : 1) // Quiet Routes
          × (launderer ? 0.75 : 1)          // shop item, §9
```

**Free bribes generate full heat.** Citizenship, Smuggling Routes and `free_bribes` reduce
or remove the *cost*; only the abilities in §7 touch the *heat*, and only within their
planet. This is the load-bearing rule of the whole system.

### 3.2 Decaying

Both paths, applied together:

- **−12** per challenge completed without bribing it
- **−1 per hour** of wall clock (~24/day), computed lazily from `heat.updated`

Both matter. Time-only decay lets an endgame player alternate bribed and unbribed
challenges forever with no accumulation. Completion-only decay leaves a casual player who
bribed once permanently hot for weeks. Together, "play clean" and "back off" are both real
answers, and the player picks the one that fits how they play.

**The daily and monthly count as clean challenges.** They can't be bribed at all (§12.3), so
they're unbribed by construction — and letting them cool you off is the right read: a hot
player who shows up for the cotd is still choosing to race something they didn't pick, which
is exactly the behaviour heat is trying to encourage.

### 3.3 What that feels like

| Behaviour | Settles around |
|---|---|
| Bribe one element every few challenges | 0–10 🔥 — effectively free, which is correct |
| Bribe one element every other challenge | 15–25 🔥 — a real but cheap gamble |
| Bribe track+racer every challenge | 80 🔥 within ~4 challenges |
| Stop entirely | Clean in ~3–4 days |

The point of the top row is that **the system must be invisible to the player who bribes
occasionally.** If a casual bribe ever feels scary, the design has failed.

---

## 4. The roll

> **The penalty is rolled the moment the bribe is submitted, before the player races.**

This is the single most important rule in the document. Everything else is tuning.

You press Bribe, the roll resolves, you see the result, *then* you decide whether to race.
A risk resolved before you turn a wheel is a gamble you chose. A risk that fires after a
fifteen-minute grind and eats the result is the mechanic everyone will hate. It goes in
`bribe.js` at the `args[2] == 'submit'` branch (`src/interactions/challenge/bribe.js:55`),
alongside the existing `manageTruguts` call — never in `challengeWinnings`.

Chance is `heat.value`, capped:

```
P(penalty) = min(heat.value, 80) / 100
```

**Never 100%.** At full heat you are still getting away with one bribe in five, and that
survivor's high is most of the fun.

### 4.1 Inviolable rules

1. A penalty never voids a submitted time, a PB, or a leaderboard entry.
2. A penalty never blocks bribing outright — worst case it costs more or hurts more.
3. The odds are on the button before you commit (§8).
4. The roll happens once per bribe *submission*, not once per element changed.

Rules 1 and 2 are what separate "interesting" from "annoying". Take truguts, take
difficulty, take the player's dignity. Never take the run.

---

## 5. Penalties

Weighted by tier, rolled on the bribe. The host of the challenge's planet delivers every
one of them by name.

### Tier I — Skimmed (heat 1–33)

- **Short Count** — the bribe costs 2× what the button said. You still get what you paid for.
- **Wrong Guy** — the fixer delivers a *random* track or racer instead of the one you picked.
  You paid, something changed, it just wasn't your call.

*Wrong Guy is the best low-tier penalty in the set — it's funny, it's survivable, and it
still leaves you a challenge you can race.*

### Tier II — Shakedown (heat 34–66)

- **The Handicap** — the host demands a condition. One of Mirror / Backwards / No Upgrades
  is forced on for free, on top of what you bribed for.
- **The Cut** — the challenge pays `×0.5` earnings.

*The Handicap is the mechanical heart of the system. The run stays completely valid — the
time counts, the PB counts, the leaderboard counts — you just have to actually earn it. It
writes straight into the existing `conditions` object, no new plumbing at all.*

### Tier III — Busted (heat 67+)

- **Nothing For You** — the challenge earns `0` truguts. Time still counts, PB still counts.
- **The Fine** — an immediate `3×` bribe cost, taken on the spot.
- **Blacklisted** — no bribes for 30 minutes.
- **Banished** — only if you hold a citizenship on the challenge's planet: the host strips the
  role until you pay a fine or complete three clean challenges there. See §7.2.

The tier is picked by heat; the specific penalty is rolled within the tier. A citizen on
their home planet rolls one tier lower (§7.2), which is the whole payoff of the ability.

---

## 6. Danger money

Heat has to pay, or it's just a tax with extra steps.

```
earnings × (1 + heat.value / 100)
```

A 60-heat run pays `1.6×`. This is what turns "increasing chance of bad thing" into a
decision players enjoy making:

- The endgame player who bribes constantly isn't being punished — they're riding an edge
  with bigger swings in both directions, which is the first time bribing has been
  *interesting* for them.
- The new player who bribes once gets a small bonus for it, which is a nice consolation and
  teaches the mechanic gently.
- Running hot becomes a **choice you can make on purpose**, before a challenge you're
  confident about.

It slots into the multiplier block in `challengeWinnings` (`functions.js:1041`+) next to
Trugut Boost, Fame and Fortune and the rest, and reads on the receipt the same way:

```
`×1.6` *🔥Running Hot*
```

Sizing note: this is the number most likely to need tuning after launch. If bribing becomes
strictly profitable at high heat, drop the coefficient to `heat/200` before touching
anything else.

---

## 7. The abilities

Both of the bribe-adjacent collection rewards are currently invisible and nearly inert.
Heat is what makes them matter.

### 7.1 Why nobody engaged with them — **shipped**

`bribeDelta` zeroed `delta.cost` silently while `bribeComponents` still rendered the select
placeholder at full price, so **a citizen read 5,000 on the menu and 0 on the button with
nothing saying why.** Smuggling Routes was worse: it only fires on a track→track swap
*within the same planet*, a case most players would never deliberately hit, and nothing in
the UI had ever mentioned it existed.

Two outright bugs came out of the same root:

- The Bribe button was gated on `current_truguts >= truguts.bribe_track`, so a citizen or
  smuggler holding **under 5,000 truguts couldn't see the button at all** — locked out of an
  ability they'd finished a whole collection for.
- The citizen check was duplicated between `bribe.js` and `updateChallenge`, with two
  different freshness stories for the role lookup.

Fixed by `exports.bribePerks()` — one resolver for "which bribe abilities are live on this
challenge and what are they called" — plus `full_cost` and `discounts` on `bribeDelta` so
every surface can name the ability that changed the price. See §8 for what it renders.

### 7.2 Citizenship

Eight planet collections, one role equipped at a time (`setMaxValues(1)`,
`functions.js:2775`), unlocked by completing that planet's collection
(`inventory.js:438`). Today: free bribes and free rerolls on that planet's tracks.

The exclusivity is already good. It just isn't *consequential*.

| Effect | Rule |
|---|---|
| **Home Turf** | Bribes on your citizen planet generate **half heat** |
| **Friends in High Places** | A penalty rolled on your home planet is **downgraded one tier** — Busted → Shakedown → Skimmed → nothing |
| **Outlander** | Bribes on **any other** planet generate **+25% heat** |

Outlander is what makes the other two mean anything. Without a downside, citizenship is a
free stack that everyone maxes and then ignores — which is precisely the state it's in
today. With it, you are choosing which ~3 tracks of the pool are your safe harbour and
accepting that the other 22 are hostile ground. That decision gets re-evaluated every time
a collection fills in, and it gives the equip select an actual reason to exist.

Two supports it needs:

**A 24-hour switching cooldown.** Otherwise anyone holding several planet collections
hot-swaps to whatever planet the challenge rolled, and Home Turf becomes Always Home Turf.
Flavour: the host needs time to vouch for you. A freshly claimed citizenship should also
start at elevated suspicion for its first few challenges.

**Banishment as the top-tier penalty.** Max heat on your home planet and the host strips the role
until you pay a fine or run three clean challenges there. This is the best high-tier penalty
in the system: it only bites players who opted into citizenship, it costs nothing on the
leaderboard, and it is recovered through *play* rather than through wallet.

Non-heat perks, so the role is worth equipping for players who never bribe at all:

- **+10% earnings** on home-planet tracks
- Your citizen title rendered on your challenge cards
- Home-planet challenges count double toward the day streak

### 7.3 Smuggling Routes

The narrowest reward in `src/data/challenge/collection.js` — *Sorts of Transports*, free
same-planet track bribes. Rather than widen it, lean into the narrowness: it becomes the
**heat management** ability.

| Effect | Rule |
|---|---|
| **Quiet Routes** | Same-planet track bribes generate **zero heat** (and stay free) |
| **Cover Your Tracks** | Heat decays roughly 2× as fast — an extra **−10** per clean challenge |
| **Spice Run** | Once per day, dump **25 heat** for truguts. You sold the goods and skipped town. |

Quiet Routes turns a trivia condition into a tactic: want a different track? Staying
in-system is the quiet option, going off-world is the loud one. Players will learn which
tracks share a planet, which is a pleasant side effect. Racer bribes and cross-planet swaps
stay fully hot, so Smuggling specialises rather than trivialises.

**Spice Run is the one to push hardest for.** It makes heat a resource with a market price
rather than a pure debuff, gives hot players an off-ramp they have to pay for, and creates
a natural pre-bribe ritual: dump heat, then make the big play.

### 7.4 The combo

Citizen **+** Smuggling Routes — two completed collections — gives you free, heatless track
shuffling inside your home planet. That's a genuine endgame build, and it's bounded: ~3
tracks, and it never covers racer bribes or conditions.

This is the actual point of the exercise. Collections should feel worth finishing.

### 7.5 Altered Deal

Condition bribes (*Arrow Dynamics* → `altered_deal`, `functions.js:1865`) should be the
**heat-hungriest** bribe in the game and take **no discount from anything**. Rewriting
Mirror / Backwards / No Upgrades / lap count is far stronger than swapping a racer, and
rewriting the rules of the race is not something a local fixer can cover for you.

---

## 8. Surfacing it

Nothing above matters if it's invisible, which is the lesson of §7.1.

**On the bribe button** — the odds go where the price already is
(`bribeComponents`, `functions.js:1951`):

```
[ Bribe (📀5,000 · 🔥42%) ]  [ Cancel ]
```

**On the selects** — the placeholder carries the baseline price, and individual options
annotate only the rows that differ from it. A uniform price repeated down 25 rows is
noise; a price that varies *per option* is the only way to say "free" on exactly the
right ones, which is what Smuggling Routes needs:

```
[ Bribe Track (📀5,000) ]                 <- a smuggler on a Mon Gazza challenge
    Mon Gazza Speedway   Current · Amateur Circuit | Race 1 | Mon Gazza
    Spice Mine Run       Free · Smuggling Routes · Amateur Circuit | Race 1 | Mon Gazza
    Zugga Challenge      Free · Smuggling Routes · Semi-Pro Circuit | Race 1 | Mon Gazza
    Beedo's Wild Ride    Amateur Circuit | Race 1 | Ando Prime

[ Bribe Track (Free · Spice Miner) ]        <- a citizen: uniform, so the placeholder
    Mon Gazza Speedway   Current · Amateur Circuit | Race 1 | Mon Gazza
    Spice Mine Run       Amateur Circuit | Race 1 | Mon Gazza
```

`trackSelector` and `racerSelector` take an optional `price(value)` callback for this;
returning nothing leaves that option's description alone, so the six other callers of
those helpers are untouched. The challenge's own track and racer are annotated
`Current`, since they're selectable but bribing to them is a no-op.

**On the challenge card** — one line, only when heat is non-zero:

```
🔥 Heat 42 · Groff Zugga is watching you
```

**On the receipt** — the multiplier, in the existing block:

```
`×1.4` *🔥Running Hot*
```

**When a penalty fires** — the host, by name, delivering it, drawn from a flavour table in
the same shape as `src/data/flavor/`:

```
💥 Groff Zugga took your money and sent you to the wrong garage.
   You're racing Mars Guo, not Sebulba.
```

---

## 9. New items and effects

All of these fit the existing `effects` flag pattern and the shop item shape at
`functions.js:2320`.

| Item | Kind | Effect |
|---|---|---|
| **Clean Record** | Consumable | Wipe heat to 0 |
| **Launderer** | Shop, one-time | Heat gains −25% |
| **Alibi** | Consumable | Negate the next penalty |
| **Credits WILL Do Fine** | Shop, one-time — *un-shelve it* | `free_bribes`: bribes cost nothing, still run hot |

That last row is the point worth repeating: the item was shelved because free bribes broke
the economy. Under heat, "free" only removes the cost — the risk is untouched — so it can
finally ship at its 384,000,000 price tag.

**PvP hook:** a Sabotage Kit could be spent to *tip off the pit bosses* about a rival,
adding heat or forcing their next roll. The plumbing already exists at `functions.js:1077`.

---

## 10. Implementation sketch

Touch points, smallest first:

| # | Where | What |
|---|---|---|
| 1 | `src/data/challenge/heat.js` *(new)* | Tuning table — gains, decay, tiers, weights, flavour. Follows `src/game/cube/tuning.js`: data only, no presentation. |
| 2 | `functions.js` — `heatValue()`, `applyHeat()` *(new)* | Lazy time decay on read, gain/decay on write. Everything else calls these. |
| 3 | `bribeComponents` `:1907` | Odds on the button, ability names on the selects |
| 4 | `bribe.js` `:55` | Roll on submit, apply penalty, write heat |
| 5 | `challengeWinnings` `:1041` | Running Hot multiplier; Nothing For You / The Cut |
| 6 | `challengeContainer` `:1477` | Heat line on the card |
| 7 | `inventory.js` `:432` | Citizenship cooldown, banishment state |
| 8 | Shop / usables | Clean Record, Launderer, Alibi, un-shelf `free_bribes` |

Steps 1–4 are the whole mechanic and could ship alone. 5 is danger money, which shouldn't
ship separately — heat without upside is a nerf, and it will read as one.

### Sequencing

§7.1 (surfacing the existing abilities) **shipped first and on its own** — valuable with or
without heat, and it tells us whether anyone cares about these abilities before a whole
system gets built on top of them. `bribePerks` is also the seam heat plugs into: it already
resolves the planet, the citizenship and the smuggling flag that §3.1's gain formula needs.

---

## 11. Cut on purpose

- **Per-planet heat gauges.** Eight numbers the player can't hold in their head. The planet
  modifies the rate, it doesn't get its own bar.
- **Rolling the penalty at submit time.** See §4. Non-negotiable.
- **100% penalty chance at max heat.** Capped at 80. Getting away with it has to stay possible.
- **Penalties that touch times, PBs, or leaderboards.** Never.
- **Heat on rerolls.** Rerolls are cheap (`1,200` / `600`) and already rate-limited by their
  own cost. Bribes are the problem; keep the mechanic aimed at them.
- **Blocking bribes outright at max heat.** A hard lockout is the same feature as a rate
  limit with none of the drama.

---

## 12. Decisions

1. **Heat survives a challenge refund.** The bounty refund path (`functions.js:1165`) returns
   the bribe cost; heat stays on the player either way — you made the approach, and refunding
   it would open a bribe→abandon→repeat loop. The bounty system gets its own pass later; this
   is deliberately the no-change option until then.
2. **Public heat is deferred.** A "Most Wanted" board is good theatre and would give the
   Sabotage tip-off hook a target list, but it also invites pile-on. Not in the first cut.
3. **`cotd` / `cotm` can't be bribed at all**, so there's nothing to price. The Bribe button
   only renders under `type == 'private'` (`functions.js:1684`) and `bribe.js` requires the
   presser to be `current_challenge.player.member`, which a daily or monthly has no concept
   of. Heat is a private-challenge mechanic by construction. If bribing ever opens up to the
   daily or monthly, revisit — those are the challenges most worth fixing, and they should
   run hotter.
4. **Banishment stays, and it is not opt-out.** It's the harshest thing in this doc, and that's
   the point — it's the one penalty that costs a player something they ground a whole
   collection for. What keeps it fair is that it has **two independent recovery paths**: pay
   the host off in truguts, or run three clean challenges on the planet. A player who has the
   money buys their way back in; a player who doesn't races their way back in. Nobody is ever
   stuck, and neither route is strictly better than the other — which is the same risk/reward
   shape as the rest of the system.

---

## References

| Thing | Where |
|---|---|
| Bribe interaction | `src/interactions/challenge/bribe.js` |
| `bribeDelta` / `bribeComponents` | `src/interactions/challenge/functions.js:1838` |
| Earnings and multipliers | `src/interactions/challenge/functions.js:894`+ |
| Prices | `src/data/challenge/trugut.js` |
| Collections and rewards | `src/data/challenge/collection.js` |
| Planets, hosts, citizen titles | `src/data/sw_racer/planet.js` |
| Citizenship equip | `src/interactions/challenge/inventory.js:432` |
| Shelved shop items | `src/interactions/challenge/functions.js:2277`–`2317` |
| Tuning-file precedent | `src/game/cube/tuning.js` |
