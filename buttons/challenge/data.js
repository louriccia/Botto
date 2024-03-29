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
    force_sight: { name: "Force Sight", description: "Make 10 predictions <1s over", role: "1074073801773559808", limit: 10, count: 0, collection: {}, array: [], missing: [] }
}

exports.swe1r_guild = "441839750555369474"

exports.goal_symbols = ["<:diamond:1136554333723435068>", "<:platinum:1136554336705597510>", "<:gold:1136554335426318406>", "<:silver:1136554338895011850>", "<:bronze:1136554332586786879>"]

exports.level_symbols = ["<:bronze:1136554332586786879>", "<:silver:1136554338895011850>", "<:gold:1136554335426318406>", "<:platinum:1136554336705597510>", "<:diamond:1136554333723435068>", "<:master:1145487065912447026>", "<:grandmaster:1145487067682447442>"]

exports.flavormap = {
    quote: {
        label: 'Quote',
        emoji: '<:quotes:1211508813824524380>',
        placeholder: '(if desired, type $player to insert the name of the player)'
    },
    tip: {
        label: 'Game Tip',
        emoji: '💡',
        placeholder: 'write a gameplay tip to help players race better'
    },
    fact: {
        label: 'Fun Fact',
        emoji: '💬',
        placeholder: 'write a fun fact about the game or movie'
    },
}

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
    hint: {
        basic: 100,
        standard: 500,
        deluxe: 1200
    },
    reroll: 1200,
    reroll_discount: 600,
    bonus: {
        basic: 20000,
        standard: 10000,
        deluxe: 5000
    },
    sponsor: {
        "5": 50000,
        "10": 100000,
        "20": 200000
    },
    long: 200,
    extra_long: 400,
    prediction_max: 500,
    day_streak: 25,
    challenge_streak: 10,
    beat_sponsor: 1200,
    sponsor_cut: 0.20,
    abandoned: 0.5,
    shuffle: 1200,
    lotto: 200,
    sabotage: 15000,
    rival: 500
}

exports.shoplines = [
    "Aahhhhh, welcome to Botto's shop, eh?",
    "Take a look around. I've got everything thing you need.",
    'No? This option no good for you, huh?',
    'You want to buy this option, huh?',
    'Leta me see...',
    'No money. No parts. No deal.',
    "Mind tricks don't work on me. Only money!",
    "Ehhh, maybe you find what you need out back in the junkyard, huh?",
    'Mmmmmmmmmm... deal!',
    'You want that one, huh?',
    'So. What do you want, huh?',
    'That too?',
    'Another, huh?',
    'Something else?',
    "You're gonna lose unless you upgrade your podrace I think",
    'Ahhh yes! We have lots of that.',
    'Back again, huh?',
    'Change your mind?',
    'You race pretty good, no doubts there, huh?',
    'You cannot beat Sebulba, he always wins!',
    'Maybe next time you win, huh?',
    'Only the best parts you find here in my shop, huh?',
    "You'll not find better deal anywhere I think, heh?",
    "What? You think you're gonna beat Sebulba with that podracer of yours? Whahh!",
    "Better stop betting or I'll own you!",
    'Have you seen my chance cube?',
    'Booty na nolia',
    'Ah chuba na naliya',
    'Coona tee-tocky malia?',
    'Chut! Chut! Gando doe wallya. Me dwana no bata.',
    'Outmians',
    'Tinka me chasa hopoe ma booty na nolia.',
    'Fweepa niaga.',
    'Tolpa da bunky dunko. Hmmmmm.',
    'Yo bana pee ho-tah meendee ya.',
    'I am betting heavily on Sebulba. He always wins!',
    'Bonapa keesa',
    'O wanna meete chobodda',
    'Ne wata, ne bata!',
    'Outlanders. They come here, how do they find me?',
    'They come here, they mess up my store-- Hey!',
    'They come here. They look around. They no buy.',
    'Why nobody buy? Eyyyyyyyy',
    'You break, you buy, huh!?',
    'Look around! I got lots of junk.',
    'Suit yourself!',
    'What you want?',
    'You come back, huh?',
]

exports.hints = [
    { value: 'basic', name: "Basic Hint", price: exports.truguts.hint.basic, bonus: exports.truguts.bonus.basic, description: "Single-part hint", hunt: "Force-Intuitive" },
    { value: 'standard', name: "Standard Hint", price: exports.truguts.hint.standard, bonus: exports.truguts.bonus.standard, description: "Two-part hint", hunt: "Force-Attuned" },
    { value: 'deluxe', name: "Deluxe Hint", price: exports.truguts.hint.deluxe, bonus: exports.truguts.bonus.deluxe, description: "Three-part hint", hunt: "Force-Sensitive" }
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
    predictions: true,
    flavor: true
}
exports.winnings_map = [
    { name: "Fair", text: "<:diamond:1136554333723435068> 36%\n<:platinum:1136554336705597510> 32%\n<:gold:1136554335426318406> 27%\n<:silver:1136554338895011850> 5%\n<:bronze:1136554332586786879> 0%" },
    { name: "Skilled", text: "<:diamond:1136554333723435068> 55%\n<:platinum:1136554336705597510> 27%\n<:gold:1136554335426318406> 14%\n<:silver:1136554338895011850> 5%\n<:bronze:1136554332586786879> 0%" },
    { name: "Winner Takes All", text: "<:diamond:1136554333723435068> 100%\n<:platinum:1136554336705597510> 0%\n<:gold:1136554335426318406> 0%\n<:silver:1136554338895011850> 0%\n<:bronze:1136554332586786879> 0%" }
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

exports.inventorySections = [
    {
        label: 'Collections',
        value: 'collections',
        description: 'Complete collections and claim rewards',
        emoji: {
            name: '🗃'
        },
        info: "Select a collection to view its progress and claim a reward. When a reward is claimed, items in that collection become locked and can no longer be scrapped, traded, or count toward collections. However, droids and parts can still be used in repairs and crafting.",
        abilities: []
    },
    {
        label: 'Special Items',
        value: 'usables',
        description: 'Use Trugut Boosts, Sabotage Kits, and Collectible Coffers',
        emoji: {
            name: '💥'
        },
        info: "Use your special items. Special items can be obtained from progression rewards (Level 10, 26+) and occasionaly from challenges.",
        abilities: ['doubled_powers', 'favor_ancients']
    },
    {
        label: 'Trade Federation',
        value: 'trade',
        description: "Browse other players' items and invite them to trade",
        emoji: {
            name: '↔'
        },
        info: "Trade items and truguts with other players!",
        abilities: []
    },
    {
        label: 'Trash Compactor',
        value: 'duplicates',
        description: 'Scrap and reroll items',
        emoji: {
            name: '♻'
        },
        info: "Turn your items into scrap and truguts!",
        abilities: ['efficient_scrapper', 'sarlacc_snack']
    },
    {
        label: 'Pit Crew',
        value: 'droids',
        description: 'Manage your droids and repair parts',
        emoji: {
            name: '🔧'
        },
        info: "Task your droids to damaged parts to repair them back to full health. ",
        abilities: ['pitdroid_team']
    },
    {
        label: 'Roles',
        value: 'roles',
        description: 'Equip and unequip your special roles',
        emoji: {
            name: '🏷'
        },
        info: "Manage your special roles!\n**<:anakin:671598858983178251> Racer Fan Role**: Join a racer fandom and rep their flag as your role icon. This is a free role that can be selected in <id:customize>.\n\n**<:tatooine:862053955860168734> Citizen Role**: Unlock by completing its respective collection. Declare your planetary citizenship and get free bribes and rerolls on this planet's tracks while its role is equiped.\n\n**✨Emoji Icon Role**: Can be purchased at Botto's shop. Displays a SWE1R Discord emoji as your role icon.\n\n**🎨Trillion Trugut Tri-Coat**: The most expensive role in the galaxy. Can be purchased at Botto's shop. Its color can be changed at any time.",
        abilities: ['fan_service']
    }
]