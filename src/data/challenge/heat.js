// Static tuning for the bribe heat system -- the risk/reward layer on random challenge
// bribes. See docs/heat.md for the design these numbers come from.
//
// Heat is one 0-100 value on the player's profile. Bribing raises it, finishing a
// challenge without bribing lowers it, and it drains on its own over time. Once it is up,
// it prices the chance that a bribe goes wrong -- and pays a bonus on the challenges it
// doesn't. Every number here is a starting default rather than a measurement; the ones
// most likely to need moving say so where they appear.
//
// ---------------------------------------------------------------------------
// This file carries no presentation and no behaviour -- only the numbers and the strings,
// so there is one place to argue with them. What a penalty *does* lives in
// interactions/challenge/functions.js; this file only says which ones exist, how often,
// and what the host says while doing it.
// ---------------------------------------------------------------------------

exports.MAX = 100;

// What one bribed element adds, before modifiers. A condition change is worth less per
// change than a track or racer swap only because Altered Deal bills every changed
// condition separately -- rewriting four of them is the hottest single bribe in the game.
exports.GAIN = {
    track: 15,
    racer: 15,
    condition: 8
};

// Multipliers on that gain. At most one of home_turf/outlander applies -- they are the
// two sides of where the player holds citizenship -- and quiet_routes zeroes the track
// portion before either of them is considered.
//
// The load-bearing rule these encode: a *free* bribe still runs hot. Citizenship,
// Smuggling Routes and free_bribes discount the trugut cost; only the modifiers here
// touch the heat, and only within their own planet.
exports.MODIFIERS = {
    // Home Turf: a citizen bribing on their own planet has someone to vouch for them
    home_turf: 0.5,
    // Outlander: a citizenship worn somewhere else marks you as the offworlder who
    // turned up with money. Someone holding no citizenship at all pays no surcharge.
    outlander: 1.25,
    // Quiet Routes: a track swap that never leaves the system is nobody's business
    quiet_routes: 0,
    // Launderer: a shop purchase, so unlike the others this one is bought rather than
    // earned. Deliberately a shaving rather than a halving -- truguts should be able to
    // soften heat a little and never buy their way out of it, which is the whole reason
    // the mechanic exists.
    launderer: 0.75
};

// Heat drains two ways at once, and both matter. Time-only decay would let a player
// alternate bribed and clean challenges forever with no accumulation; completion-only
// decay would leave someone who bribed once hot for weeks without playing.
exports.DECAY = {
    // per challenge finished without bribing it. The daily and the monthly can't be
    // bribed at all, so they always count as clean.
    per_clean_challenge: 12,
    // per hour of wall clock, applied lazily whenever the value is read
    per_hour: 1,
    // Cover Your Tracks: a smuggler knows how to disappear
    cover_your_tracks: 10
};

// A note appended to the gauge on every card. It existed because the gauge shipped one
// stage ahead of the roll; now that penalties are live it would be a lie, so it's off.
// Set it to a string to put an announcement back on every card in one edit.
exports.PREVIEW_NOTE = null;

// ---------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------

// The chance a bribe goes wrong is the player's heat, as a percentage, capped here.
// Never 100: at the top of the gauge you still get away with one bribe in five, and that
// survivor's high is most of what makes the mechanic fun rather than punitive.
//
// The roll reads the heat the player walked in *with*, before this bribe's own gain. A
// first bribe from a cold profile is therefore always safe, which is the promise the
// design was built on: with no heat, the bribe is fine.
exports.ROLL = {
    cap: 80
};

// Penalty tiers, coldest first. `min` is the heat at which a tier takes over; the tier a
// roll lands in is the last one whose min it has reached.
//
// ** The weights below are the single most tuneable set of numbers in the system and they
// ** are my defaults, not measured ones. Nothing downstream cares what they are: they are
// ** a weighted pick inside the tier, so any of them can move without touching behaviour.
// ** Within a tier the weights are relative, not percentages, and need not sum to 100.
//
// Each tier keeps a `fallback` that costs the player nothing up front and always applies.
// A roll that lands on a penalty which can't apply -- Wrong Guy when there's no pick to
// misdeliver, a cost penalty the player can't cover -- substitutes the fallback rather
// than being thrown away, so there are no dead rolls and nothing to retry for.
//
// Banished is deliberately absent from this table. Friends in High Places softens a
// citizen's tier by one, so a citizen never reaches Busted at all and a Tier III entry
// could never fire; it is a threshold instead, checked at max heat in rollHeatPenalty.
// See BANISHMENT below.
exports.TIERS = [
    {
        key: 'skimmed',
        name: 'Skimmed',
        min: 1,
        fallback: 'short_count',
        penalties: [
            // the characterful one, so it's the common case: you paid, something changed,
            // it just wasn't your call. Costs nothing you can't absorb.
            { key: 'wrong_guy', weight: 60 },
            { key: 'short_count', weight: 40 }
        ]
    },
    {
        key: 'shakedown',
        name: 'Shakedown',
        min: 34,
        fallback: 'cut',
        penalties: [
            // the mechanical heart of the system -- the run stays completely valid, you
            // just have to earn it -- so it stays dominant here
            { key: 'handicap', weight: 65 },
            { key: 'cut', weight: 35 }
        ]
    },
    {
        key: 'busted',
        name: 'Busted',
        min: 67,
        fallback: 'nothing_for_you',
        penalties: [
            { key: 'nothing_for_you', weight: 40 },
            { key: 'fine', weight: 35 },
            { key: 'blacklisted', weight: 25 }
        ]
    }
];

// What each penalty is called and what the host says while doing it. ${host} is the
// planet's own host from data/sw_racer/planet.js -- heat is their patience running out, so
// it is always somebody by name, never an abstract meter.
exports.PENALTIES = {
    wrong_guy: {
        title: 'Whoops',
        flavor: [
            '${host} took your money but set up the wrong race.',
        ]
    },
    short_count: {
        title: "The Price Just Went Up",
        // doubles the bribe: you get exactly what you paid for, at twice the price.
        // cost_of names which of bribeDelta's numbers the surcharge is billed against and
        // cost_times how many extra multiples of it to charge. One rule then serves both
        // the can-the-player-cover-this check and the charge itself.
        cost_of: 'cost',
        cost_times: 1,
        flavor: [
            '${host} says this one costs extra.'
        ]
    },
    handicap: {
        title: 'The Handicap',
        // forces one condition on. Order is the order they're tried in.
        conditions: ['mirror', 'backwards', 'nu'],
        flavor: [
            '${host} will allow it, on one condition...',
        ]
    },
    cut: {
        title: 'The Cut',
        earnings: 0.5,
        flavor: [
            '${host} is taking a cut of this one.',
        ]
    },
    nothing_for_you: {
        title: 'Nothing For You',
        earnings: 0,
        flavor: [
            "${host}'s officials have seized your winnings for this race."
        ]
    },
    fine: {
        title: 'The Fine',
        // three times what the bribe would have cost undiscounted -- a citizen is not
        // exempt from a fine just because they're local, and Friends in High Places has
        // already softened their tier by the time this can land
        cost_of: 'full_cost',
        cost_times: 3,
        flavor: [
            '${host} made an example of you and charged you a fine.'
        ]
    },
    banished: {
        title: 'Banished',
        flavor: [
            '${host} revoked your citizenship on the spot.',
            '${host} told the whole planet you are no longer one of them.'
        ]
    },
    blacklisted: {
        title: 'Blacklisted',
        minutes: 30,
        flavor: [
            "${host} put the word out. Nobody's taking your money for a while.",
        ]
    }
};

// Rerolling a challenge that carries a verdict is the one escape hatch the design left
// open, and it was mispriced: a reroll is 1,200 truguts flat (600 discounted, and free for
// free_rerolls, a sponsor, the record holder, or a citizen on their home planet) while the
// penalty it voids scales with heat and with whatever multipliers the challenge was
// carrying. A citizen on home turf had a zero-trugut retry loop.
//
// So walking away costs heat instead of truguts. It scales on its own -- every escape
// worsens the next roll and pushes toward the cap -- and, the point, it bites even when
// the reroll itself is free. Deliberately NOT run through MODIFIERS: fleeing isn't a
// bribe, and Home Turf halving it would leave the hole it is here to close.
//
// ** My default, not a measured number. Equal to one bribed element, so escaping costs
// ** about what the bribe did.
exports.FLEE = {
    heat: 15
};

// Spice Run, from Smuggling Routes: sell the heat instead of waiting it out. Once a day,
// and it requires having earned the heat in the first place. This is the one place heat
// converts to truguts rather than the other way round -- gated behind a finished
// collection and a daily cooldown so it stays a ritual rather than an income.
//
// ** My defaults. The payout is roughly one bribe's worth.
exports.SPICE_RUN = {
    heat: 25,
    truguts: 5000,
    cooldown_hours: 24
};

// ---------------------------------------------------------------------------
// Citizenship
// ---------------------------------------------------------------------------

// Home Turf halves heat and Friends in High Places softens a verdict, both of which would
// be worth hot-swapping citizenship for if you could do it per challenge. You can't: a
// claim has to sit for a day before another one will take.
//
// The design also wanted a freshly claimed citizenship to start under suspicion, with the
// perks withheld for its first few challenges. Dropped: the cooldown already closes the
// hot-swap it was aimed at, so all suspicion would add is a tax on somebody's first ever
// claim, which is the one moment the feature should feel like a reward.
exports.CITIZENSHIP = {
    switch_cooldown_hours: 24
};

// Banished. The harshest thing in the system, and the only one that takes something the
// player ground a whole collection for.
//
// It is a *threshold*, not a weighted tier entry, which resolves a contradiction in the
// design: Friends in High Places softens a citizen's tier by one, so a citizen can never
// roll Busted at all, and a Tier III Banished would have been unreachable by construction.
// Firing it at max heat on your own planet instead says the right thing anyway -- you
// pushed it too far in the one place that was supposed to be safe, and being a local is
// exactly why the host takes it personally.
//
// Two independent ways back, so nobody is ever stuck and neither route is strictly better:
// pay the host off, or race clean on their planet until they come round.
//
// ** My defaults. The fine is roughly ten bribes.
exports.BANISHMENT = {
    fine: 50000,
    clean_challenges: 3
};

// What citizenship is worth beyond heat, so the role is worth wearing for players who
// never bribe at all.
exports.HOME = {
    // earnings multiplier on your own planet's tracks
    earnings: 1.1,
    // your day streak pays double for showing up at home
    day_streak: 2
};
