const { number_with_commas } = require("../../generic")
const { truguts } = require("./trugut")

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
    "Get a 📀" + truguts.beat_opponent + " bonus for beating another player's best time",
    "Get a 📀" + truguts.personal_best + " bonus for beating your own best time",
    "Get a 📀" + truguts.first + " bonus for being the first to complete a challenge",
    "You could win up to 📀" + number_with_commas(truguts.bonus.basic) + " bonus for completing a :dart: Challenge Bounty",
    "Earn a 📀" + truguts.non_standard + " bonus for completing non-standard challenges",
    "After rolling a challenge, you can bribe Botto for a specific track or racer",
    ":dart: Challenge Bounties give you one hour to find a trugut bonus on a random challenge",
    "Check out your random challenge :bust_in_silhouette: Profile to check your career stats and achievements",
    "Earn a special role for getting achievements in the SWE1R Discord",
    "Hints help you narrow down what challenges you need to complete for :trophy: Achievements",
    "Check out top-5 times for Random Challenges in :trophy: Leaderboards",
    "Click :grey_question: About to learn more about Random Challenges",
    "You can return to the Random Challenge menu from anywhere by clicking <:menu:862620287735955487>",
]