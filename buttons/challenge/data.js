exports.achievement_data = {
    galaxy_famous: { name: "Galaxy Famous", description: "Race on every track", role: "819514261289828362", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    pod_champ: { name: "Pod Champ", description: "Race as every pod", role: "819514029218463774", limit: 23, count: 0, collection: {}, array: [], missing: [] },
    light_skipper: { name: "Lightspeed Skipper", description: "Race every track with a Skip", role: "819514330985922621", limit: 12, count: 0, collection: {}, array: [], missing: [] },
    slow_steady: { name: "Slow 'n Steady", description: "Race as every pod with No Upgrades", role: "819514431472926721", limit: 23, count: 0, collection: {}, array: [], missing: [] },
    mirror_dimension: { name: "Mirror Dimension", description: "Race Mirrored on every track", role: "843573636119134219", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    crowd_favorite: { name: "Crowd Favorite", description: "Race as every track favorite on his track", role: "819514487852761138", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    true_jedi: { name: "True Jedi", description: "Race as every pod on every track", role: "819514600827519008", limit: 575, count: 0, collection: {}, array: [], missing: [] },
    backwards_compatible: { name: "Backwards Compatible", description: "Race every track backwards", role: "1064620122276384909", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    big_time_swindler: { name: "Big-Time Swindler", description: "Earn or spend 1,000,000 total truguts", role: "844307520997949481", limit: 1000000, count: 0, collection: {}, array: [], missing: [] },
}

exports.swe1r_guild = "441839750555369474"

exports.truguts = {
    mp: 100,
    non_standard: 200,
    beat_opponent: 150,
    personal_best: 500,
    first: 200,
    rated: 50,
    bribe_track: 8400,
    bribe_racer: 8400,
    hint_basic: 200,
    hint_standard: 1000,
    hint_deluxe: 5000,
    reroll: 1200,
    reroll_discount: 600,
    bonus_basic: 50000,
    bonus_standard: 20000,
    bonus_deluxe: 10000,
    long: 200,
    extra_long: 400
}

exports.hints = [
    { name: "Basic Hint", price: truguts.hint_basic, bonus: truguts.bonus_basic, description: "Single-part hint", hunt: "Force-Intuitive" },
    { name: "Standard Hint", price: truguts.hint_standard, bonus: truguts.bonus_standard, description: "Two-part hint", hunt: "Force-Attuned" },
    { name: "Deluxe Hint", price: truguts.hint_deluxe, bonus: truguts.bonus_deluxe, description: "Three-part hint", hunt: "Force-Sensitive" }
]

exports.tips = [
    "You have 15 minutes to complete Random Challenges",
    "Don't forget to rate completed challenges for a small trugut bonus",
    "Need to know what challenges you have left for achievements? Buy a :bulb: Hint!",
    "The more you pay, the better the :bulb: Hint",
    "Need truguts? Try the :dart: Challenge Hunt",
    "You can customize your condition odds in the :gear: Settings",
    "You can select your winnings pattern in the :gear: Settings",
    "Rerolls are free for record-holders",
    "Rerolls are discounted if you've already played a challenge",
    "Bribes are refunded when used to successfully find a :dart: Challenge Hunt",
    "The default conditions are max upgrades, 3-lap, full track",
    "Get a 📀" + truguts.beat_opponent + " bonus for beating another player's best time",
    "Get a 📀" + truguts.personal_best + " bonus for beating your own best time",
    "Get a 📀" + truguts.first + " bonus for being the first to complete a challenge",
    "You could win up to 📀" + tools.numberWithCommas(truguts.bonus_basic) + " bonus for completing a :dart: Challenge Hunt",
    "Earn a 📀" + truguts.non_standard + " bonus for completing non-standard challenges",
    "After rolling a challenge, you can bribe Botto for a specific track or racer",
    ":dart: Challenge Hunts give you one hour to find a trugut bonus on a random challenge",
    "Check out your random challenge :bust_in_silhouette: Profile to check your career stats and achievements",
    "Earn a special role for getting achievements in the SWE1R Discord",
    "Hints help you narrow down what challenges you need to complete for :trophy: Achievements",
    "Check out top-5 times for Random Challenges in :trophy: Leaderboards",
    "Click :grey_question: About to learn more about Random Challenges",
    "You can return to the Random Challenge menu from anywhere by clicking <:menu:862620287735955487>"
]

exports.settings_default = {
    winnings: 1,
    skips: 25,
    no_upgrades: 15,
    non_3_lap: 5,
    mirrored: 5,
    backwards: 5
}
exports.winnings_map = [
    { name: "Fair", text: ":gem: 36%\n:first_place: 32%\n:second_place: 27%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%" },
    { name: "Skilled", text: ":gem: 55%\n:first_place: 27%\n:second_place: 14%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%" },
    { name: "Winner Takes All", text: ":gem: 100%\n:first_place: 0%\n:second_place: 0%\n:third_place: 0%\n<:bumpythumb:703107780860575875> 0%" }
]