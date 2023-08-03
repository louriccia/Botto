const tools = require('../../tools.js')

exports.achievement_data = {
    galaxy_famous: { name: "Galaxy Famous", description: "Race on every track", role: "819514261289828362", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    pod_champ: { name: "Pod Champ", description: "Race as every pod", role: "819514029218463774", limit: 23, count: 0, collection: {}, array: [], missing: [] },
    light_skipper: { name: "Lightspeed Skipper", description: "Race every track with a Skip", role: "819514330985922621", limit: 14, count: 0, collection: {}, array: [], missing: [] },
    slow_steady: { name: "Slow 'n Steady", description: "Race as every pod with No Upgrades", role: "819514431472926721", limit: 23, count: 0, collection: {}, array: [], missing: [] },
    mirror_dimension: { name: "Mirror Dimension", description: "Race Mirrored on every track", role: "843573636119134219", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    backwards_compatible: { name: "Backwards Compatible", description: "Race every track backwards", role: "1064620122276384909", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    lap_god: { name: "Lap God", description: "Race 100 laps in non 3-lap challenges", role: "1074073710635532359", limit: 100, count: 0, collection: {}, array: [], missing: [] },
    crowd_favorite: { name: "Crowd Favorite", description: "Race as every track favorite on his track", role: "819514487852761138", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    true_jedi: { name: "True Jedi", description: "Race as every pod on every track", role: "819514600827519008", limit: 575, count: 0, collection: {}, array: [], missing: [] },

    big_time_swindler: { name: "Big-Time Swindler", description: "Earn or spend 1,000,000 total truguts", role: "844307520997949481", limit: 1000000, count: 0, collection: {}, array: [], missing: [] },
    bounty_hunter: { name: "Bounty Hunter", description: "Complete 25 bounties", role: "1074074050772615199", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    bankroller_clan: { name: "Bankroller Clan", description: "Sponsor 25 challenges", role: "1074073925258059808", limit: 25, count: 0, collection: {}, array: [], missing: [] },
    force_sight: { name: "Force Sight", description: "Make 10 predictions less than a second over the submitted time", role: "1074073801773559808", limit: 10, count: 0, collection: {}, array: [], missing: [] }
}

exports.swe1r_guild = "441839750555369474"

exports.goal_symbols = ["<:diamond:1136554333723435068>", "<:platinum:1136554336705597510>", "<:gold:1136554335426318406>", "<:silver:1136554338895011850>", "<:bronze:1136554332586786879>"]

exports.truguts = {
    starter: 400,
    mp: 100,
    non_standard: 200,
    beat_opponent: 150,
    personal_best: 500,
    first: 200,
    rated: 50,
    bribe_track: 5000,
    bribe_racer: 5000,
    hint_basic: 100,
    hint_standard: 500,
    hint_deluxe: 1200,
    reroll: 1200,
    reroll_discount: 600,
    bonus_basic: 20000,
    bonus_standard: 10000,
    bonus_deluxe: 5000,
    long: 200,
    extra_long: 400,
    prediction_max: 500,
    streak: 25,
    beat_sponsor: 1200,
    sponsor_cut: 0.20,
    abandoned: 0.5
}

exports.hints = [
    { name: "Basic Hint", price: exports.truguts.hint_basic, bonus: exports.truguts.bonus_basic, description: "Single-part hint", hunt: "Force-Intuitive" },
    { name: "Standard Hint", price: exports.truguts.hint_standard, bonus: exports.truguts.bonus_standard, description: "Two-part hint", hunt: "Force-Attuned" },
    { name: "Deluxe Hint", price: exports.truguts.hint_deluxe, bonus: exports.truguts.bonus_deluxe, description: "Three-part hint", hunt: "Force-Sensitive" }
]

exports.tips = [
    "You have 15 minutes to complete Random Challenges",
    "Don't forget to rate completed challenges for a small trugut bonus",
    "Need to know what challenges you have left for achievements? Buy a :bulb: Hint!",
    "The more you pay, the better the :bulb: Hint",
    "Need truguts? Try the :dart: Challenge Bounty",
    "You can customize your condition odds in the :gear: Settings",
    "You can select your winnings pattern in the :gear: Settings",
    "Rerolls are free for record-holders",
    "Rerolls are discounted if you've already played a challenge",
    "Bribes are refunded when used to successfully find a :dart: Challenge Bounty",
    "The default conditions are max upgrades, 3-lap, full track",
    "Get a 📀" + exports.truguts.beat_opponent + " bonus for beating another player's best time",
    "Get a 📀" + exports.truguts.personal_best + " bonus for beating your own best time",
    "Get a 📀" + exports.truguts.first + " bonus for being the first to complete a challenge",
    "You could win up to 📀" + tools.numberWithCommas(exports.truguts.bonus_basic) + " bonus for completing a :dart: Challenge Bounty",
    "Earn a 📀" + exports.truguts.non_standard + " bonus for completing non-standard challenges",
    "After rolling a challenge, you can bribe Botto for a specific track or racer",
    ":dart: Challenge Bounties give you one hour to find a trugut bonus on a random challenge",
    "Check out your random challenge :bust_in_silhouette: Profile to check your career stats and achievements",
    "Earn a special role for getting achievements in the SWE1R Discord",
    "Hints help you narrow down what challenges you need to complete for :trophy: Achievements",
    "Check out top-5 times for Random Challenges in :trophy: Leaderboards",
    "Click :grey_question: About to learn more about Random Challenges",
    "You can return to the Random Challenge menu from anywhere by clicking <:menu:862620287735955487>",
]

exports.emoji = {
    goal: ["💎", "🥇", "🥈", "🥉", "<:BumpyThumb:703107780860575875>"],
    trugut: "📀",
    submit: "⏱️",
    reroll: "🔄",
    bribe: "💰",
    predict: "🔮",
    first: "❄️",
    bounty: "🎯",
    completed: "✅",
    sponsor: "📢",
    play: "🎲",
    settings: "⚙️",
    abandoned: "💨",
    achievement: "🏆",
    multiplayer: "🏁",
    feedback_positive: "👍",
    feedback_negative: "👎",
    menu: "<:menu:862620287735955487>",
    profile: "👤",
    help: "❔",
    hint: "💡",
    details: "🏷️",
    conditions: {
        mirrored: "",
        backwards: "",
        no_upgrades: "",
        skips: "",
        laps: ""
    }
}

exports.settings_default = {
    winnings: 1,
    skips: 25,
    no_upgrades: 15,
    non_3_lap: 5,
    mirror_mode: 5,
    backwards: 5,
    predictions: true
}
exports.winnings_map = [
    { name: "Fair", text: ":gem: 36%\n:first_place: 32%\n:second_place: 27%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%" },
    { name: "Skilled", text: ":gem: 55%\n:first_place: 27%\n:second_place: 14%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%" },
    { name: "Winner Takes All", text: ":gem: 100%\n:first_place: 0%\n:second_place: 0%\n:third_place: 0%\n<:bumpythumb:703107780860575875> 0%" }
]

exports.about = {
    rchallenge: {
        name: "Random Challenge", emoji: "🎲", desc: "A random challenge is a randomly generated configuration of track, racer, and other conditions for you to race. For challenges that don't specify conditions, it is implied that you race forwards with upgrades, for 3-laps, using no skips. Specified conditions may include no upgrades, mirror mode, skips, backwards, and alternate lap counts. The odds of rolling a challenge that has one of these special conditions can be adjusted in your ⚙️ Settings. Private challenges must be completed in 15 minutes to earn full winnings. After 15 minutes, a private challenge is marked 💨 Abandoned and can be completed by anyone for half the original winnings."
    },
    swinnings: {
        name: "Submissions and Winnings", emoji: "⏱️", desc: "When you've finished the challenge and you're happy with your time, you can click the submit button and a modal should pop up. Submit your time in the same format as it appears in the results screen and you may add a small note as well. Truguts are awarded depending on how fast your submitted time is compared to the given goal times and how your winnings are set up. In addition to the goal time winnings, bonuses are available for beating other players' best times, beating your own time, rating challenges, daily streaks, and completing non-standard or long challenges ."
    },
    reroll: {
        name: "Rerolls", emoji: "🔄", desc: "Once you have rolled a challenge, you will be locked out of starting a new one until 15 minutes has elapsed or you spend truguts to reroll the challenge. Rerolls are useful for avoiding difficult or tedious challenges. Rerolls are discounted if you already have a time submitted for the challenge or free if you are the current record holder."
    },
    settings: {
        name: "Settings", emoji: "⚙️", desc: "Under settings, you can modify the odds that each special condition will be added to your challenges. In order to be eligible for the non-standard bonus, any given odd must be less than or equal to 25%. Your winnings pattern which determines the share of truguts your submitted time will earn can be adjusted as well as the ability for other players to make predictions on your times."
    },
    predictions: {
        name: "Predictions", emoji: "🔮", desc: "While a private challenge is in progress, onlookers can guess what time the current challenger is going to get and submit a prediction by clicking 🔮. The closer a prediction is to the submitted time (without underbidding), the more truguts earned. You can disable predictions on your private challenges in your random challenge settings."
    },
    bribes: {
        name: "Bribes", emoji: "💰", desc: "If you slip a few truguts under the table, Botto will let you change the track and/or racer to any active challenge once. Bribes are useful for finding achievement-specific challenges, bounties, or beating the awful RNG. Submitting a bribe will reset the 15 minute timer on private challenges."
    },
    hints: {
        name: "Hints", emoji: "💡", desc: "Hints can be used to help figure out what challenges remain for specific achievements. There are 3 tiers of hints, ranging from giving a 1-part hint to a 3-part hint. The hints often apply to more than one track or racer, but if you're feeling lucky there's a chance that a 1-part hint is specific enough to guide you to the right challenge."
    },
    bounties: {
        name: "Bounties", emoji: "🎯", desc: "Bounties are a way to earn big truguts fast. Based on your bounty selection, you'll receive a number of leads for a randomly generated challenge. You have one hour to find this bounty by rolling and bribing to get to a challenge that fits the description of the bounty's track and racer. You'll receive the bounty bonus only when you complete the challenge marked **:dart: Challenge Bounty**. Bounties are only available for private challenges."
    },
    sponsorships: {
        name: "Sponsorships", emoji: "📢", desc: "• You can use your truguts to sponsor a random challenge from the menu by clicking the 📢 button. Sponsorship fees vary by circuit.\n• When a challenge is rolled for the sponsorship, it will use your current odds so you might want to adjust your odds depending on what kind of challenge you want to sponsor.\n• Sponsoring a challenge attaches the sponsor's name to that specific challenge forever and nets the sponsor 20% on every trugut earned through that challenge, including predictions. Rerolling a sponsored challenge is always free to its sponsors and any reroll costs will be pocketed by its sponsors. \n• When sponsoring a challenge, you will have the opportunity to give it a custom name and set a sponsor time  that will grant a large bonus if beaten by a player.  These are optional.\n• Sponsoring a challenge starts an open challenge. This open challenge lasts 24 hours and can be completed once by anyone.\n• A user can only sponsor one challenge per day. Sponsorships stack (in the rare chance of rolling the same sponsorship)."
    },
    achievements: {
        name: "Achievements", emoji: "🏆", desc: "Who doesn't want to earn achievements? There are achievements for just about any type of challenge. In your challenge description, you will see if a challenge counts toward any achievements which is a good thing to know before considering any rerolls or bribes. Special achievement roles are automatically awarded to applicable players in the Star Wars Episode I: Racer Discord."
    },
    multiplayer: {
        name: "Multiplayer Challenges", emoji: "🏁", desc: "When a player is in the Multiplayer Lobby voice channel and rolls a challenge, a full track/max upgrade challenge will appear. Like a private challenge, a multiplayer challenge is available to anyone to complete once within 15 minutes."
    },
    rcotd: {
        name: "Random Challenge of the Day", emoji: "🎲", desc: "Every day at 12am ET, a new random challenge is rolled in #bottos-junkyard. This challenge is available to anyone to complete once for 24 hours."
    },
    dbounty: {
        name: "Daily Bounty", emoji: "🎯", desc: "Every day at 12pm ET, a new random challenge bounty is started in #bottos-junkyard. This bounty has a random number of hints and a randomly generated bonus. The first player to find this challenge will earn a large trugut bonus upon completing the challenge. This bounty is available for 24 hrs.}"
    }
}