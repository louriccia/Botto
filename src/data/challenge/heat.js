// Static tuning for the bribe heat system -- the risk/reward layer on random challenge
// bribes. See docs/heat.md for the design these numbers come from.
//
// Heat is one 0-100 value on the player's profile. Bribing raises it, finishing a
// challenge without bribing lowers it, and it drains on its own over time. Nothing reads
// it against the player yet: stages 1 and 2 only accrue and decay it, so that every
// number below can be checked against real play before it is allowed to cost anybody
// anything.
//
// ---------------------------------------------------------------------------
// This file carries no presentation and no behaviour -- only the numbers, so there is one
// place to argue with them. The penalty tiers, the roll, and the host flavour text arrive
// with the roll itself rather than sitting here unused: dead tuning data reads as shipped
// behaviour and it is worse than no data at all.
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
    quiet_routes: 0
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
