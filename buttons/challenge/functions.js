const { racers, tracks, planets, playerPicks, movieQuotes, circuits, multipliers, racer_hints, track_hints, mpQuotes, emojimap, console_emojis } = require('../../data.js')
const tools = require('../../tools.js')
const { truguts, swe1r_guild, tips, goal_symbols, settings_default, achievement_data, winnings_map, hints, shoplines } = require('./data.js')
const { postMessage } = require('../../discord_message.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const moment = require('moment');
require('moment-timezone')
const youtubeThumbnail = require('youtube-thumbnail');

const getThumbnail = async (url) => {
    try {
        const thumbnailInfo = await youtubeThumbnail(url);
        return thumbnailInfo.medium.url
    } catch (error) {
        return null
    }
};

exports.getGoalTimes = function ({ track, racer, skips, nu, laps, backwards, best } = {}) {
    let upg = nu ? 0 : 5
    let times = [
        tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.02, uh_mod: 1.05, us_mod: 1.05, deaths: 0.25 + .25 * tracks[track].difficulty }),
        tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.05, uh_mod: 1.10, us_mod: 1.10, deaths: 0.3 + .4 * tracks[track].difficulty }),
        tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.10, uh_mod: 1.15, us_mod: 1.15, deaths: 0.5 + .75 * tracks[track].difficulty }),
        tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.18, uh_mod: 1.30, us_mod: 1.30, deaths: 0.5 + 1.5 * tracks[track].difficulty }),
        tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.25, uh_mod: 1.45, us_mod: 1.45, deaths: 0.5 + 2 * tracks[track].difficulty })
    ]
    if (best?.length) {
        let record = best[0].time
        const weight = skips ? 0.8 : backwards ? 0.7 : 0.5
        const adjust = (record * weight + times[0] * (1 - weight)) / times[0]
        times = times.map(t => t * adjust * (backwards ? 1.1 : 1))
    }

    return times
}

exports.trugutsEarned = function (player) {
    var keys = Object.keys(db.ch.times)
    var report = {
        earnings: 0,
        mp: 0,
        non_standard: 0,
        beat: 0,
        pb: 0,
        first: 0,
        rated: 0,
        total: 0
    }
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (db.ch.times[k].user == player) {
            var goals = getGoalTimes(db.ch.times[k].track, db.ch.times[k].racer, db.ch.times[k].skips, db.ch.times[k].nu, db.ch.times[k].laps)
            var winnings = 1
            if (db.ch.times[k].settings !== undefined) {
                winnings = db.ch.times[k].settings.winnings
            }
            var goal_earnings = [
                circuits[tracks[db.ch.times[k].track].circuit].winnings[winnings][0],
                circuits[tracks[db.ch.times[k].track].circuit].winnings[winnings][1],
                circuits[tracks[db.ch.times[k].track].circuit].winnings[winnings][2],
                circuits[tracks[db.ch.times[k].track].circuit].winnings[winnings][3],
                0
            ]
            var winnings = 0
            for (var j = goals.length - 1; j > -1; j--) {
                if (db.ch.times[k].time < goals[j]) {
                    winnings = goal_earnings[j]
                }
            }
            report.earnings += winnings
            if (db.ch.times[k].settings == undefined) {
                if (db.ch.times[k].skips) {
                    report.non_standard++
                }
                if (db.ch.times[k].mirror) {
                    report.non_standard++
                }
                if (db.ch.times[k].laps !== 3) {
                    report.non_standard++
                }
                if (db.ch.times[k].nu) {
                    report.non_standard++
                }
            } else {
                if (db.ch.times[k].skips && db.ch.times[k].settings.skips <= 25) {
                    report.non_standard++
                }
                if (db.ch.times[k].mirror && db.ch.times[k].settings.mirror_mode <= 25) {
                    report.non_standard++
                }
                if (db.ch.times[k].laps !== 3 && db.ch.times[k].settings.non_3_lap <= 25) {
                    report.non_standard++
                }
                if (db.ch.times[k].nu && db.ch.times[k].settings.no_upgrades <= 25) {
                    report.non_standard++
                }
            }

            if (db.ch.times[k].mp == true) {
                report.mp++
            }
            var first = true
            var pb = false
            var beat = []
            for (var p = 0; p < keys.length; p++) {
                var n = keys[p]
                if (db.ch.times[n].track == db.ch.times[k].track && db.ch.times[n].racer == db.ch.times[k].racer && db.ch.times[n].skips == db.ch.times[k].skips && db.ch.times[n].nu == db.ch.times[k].nu && db.ch.times[n].laps == db.ch.times[k].laps && db.ch.times[n].mirror == db.ch.times[k].mirror) {
                    if (db.ch.times[n].date < db.ch.times[k].date) {
                        first = false
                        if (db.ch.times[n].user == player) {
                            pb = true
                            if (db.ch.times[n].time < db.ch.times[k].time) {
                                pb = false
                            }
                        }
                    }
                    if (db.ch.times[n].user !== player && db.ch.times[n].time > db.ch.times[k].time && db.ch.times[n].date < db.ch.times[k].date && !beat.includes(db.ch.times[n].user)) {
                        beat.push(db.ch.times[n].user)
                    }
                }
            }
            report.beat += beat.length
            if (first) {
                report.first++
            }
            if (pb) {
                report.pb++
            }
        }
    }
    var feedback = {}
    var keys = Object.keys(db.ch.feedback)
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        if (db.ch.feedback[k].user == player) {
            feedback[db.ch.feedback[k].track + " " + db.ch.feedback[k].racer + " " + db.ch.feedback[k].skips + " " + db.ch.feedback[k].nu + " " + db.ch.feedback[k].laps + " " + db.ch.feedback[k].mirror] = 0
        }
    }
    var fb = Object.keys(feedback)
    report.rated += fb.length
    report.total = report.earnings + report.mp * truguts.mp + report.non_standard * truguts.non_standard + report.beat * truguts.beat_opponent + report.pb * truguts.personal_best + report.first * truguts.first + report.rated * truguts.rated
    return report
}

exports.initializePlayer = function (ref, name) {
    let data = {
        settings: {
            mirror_mode: settings_default.mirror_mode,
            backwards: settings_default.backwards,
            no_upgrades: settings_default.no_upgrades,
            non_3_lap: settings_default.non_3_lap,
            skips: settings_default.skips,
            winnings: settings_default.winnings,
        },
        name: name,
        truguts_earned: 0,
        truguts_spent: 0,
        achievements: {
            galaxy_famous: false,
            pod_champ: false,
            light_skipper: false,
            slow_steady: false,
            mirror_dimension: false,
            crowd_favorite: false,
            true_jedi: false,
            big_spender: false
        }
    }
    ref.set(data)
    return data
}

exports.initializeUser = function (ref, id, name) {
    let data = {
        discordID: id,
        name: name
    }
    const push = ref.push(data)
    return push.key
}

exports.initializeChallenge = function ({ profile, member, type, name, avatar, user, circuit, db, interaction } = {}) {

    //get values
    let random_racer = Math.floor(Math.random() * 23)
    let trackpool = []
    for (let i = 0; i < 25; i++) {
        if ([undefined, null].includes(circuit)) {
            trackpool.push(i)
        } else if (tracks[i].circuit == circuit) {
            trackpool.push(i)
        }
    }
    let random_track = trackpool[Math.floor(Math.random() * trackpool.length)]
    let alt_laps = [1, 2, 4, 5]

    //set default odds
    let odds = {
        skips: (type == 'cotm' ? 35 : type == 'cotd' ? 35 : type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.skips : settings_default.skips) / 100,
        no_upgrades: (type == 'cotm' ? 15 : type == 'cotd' ? 15 : type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.no_upgrades : settings_default.no_upgrades) / 100,
        non_3_lap: (type == 'cotm' ? 20 : type == 'cotd' ? 20 : type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.non_3_lap : settings_default.non_3_lap) / 100,
        mirrored: (type == 'cotm' ? 20 : type == 'cotd' ? 20 : type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.mirror_mode : settings_default.mirror_mode) / 100,
        backwards: (type == 'cotm' ? 0 : type == 'cotd' ? 15 : type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.backwards : settings_default.backwards) / 100,
    }

    let skips = tracks[random_track].skips ? Math.random() < odds.skips : false
    let nu = Math.random() < odds.no_upgrades
    let laps = Math.random() < odds.non_3_lap ? alt_laps[Math.floor(Math.random() * 4)] : 3
    let mirror = Math.random() < odds.mirrored
    let backwards = Math.random() < odds.backwards

    if (type == 'cotm') {
        let random_tracks = []

        function RandomCircuitLength() {
            const numbers = [4, 5, 6, 7, 8, 9, 10];
            const weights = [1, 2, 3, 8, 3, 2, 1]; // Adjust the weights to control the probabilities

            // Calculate the total weight
            const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

            // Generate a random number between 0 and the total weight
            const randomValue = Math.random() * totalWeight;

            // Find the corresponding number based on the random value and weights
            let sum = 0;
            for (let i = 0; i < numbers.length; i++) {
                sum += weights[i];
                if (randomValue < sum) {
                    return numbers[i];
                }
            }
        }

        let num_tracks = RandomCircuitLength()
        let track_pool = []
        for (let i = 0; i < 25; i++) {
            track_pool.push(i)
        }
        if (skips) {
            track_pool = track_pool.filter(t => tracks[t].skips)
        }
        for (let i = 0; i < num_tracks; i++) {
            let rt = Math.floor(Math.random() * track_pool.length)
            random_tracks.push(track_pool[rt])
            track_pool.splice(rt, 1)
        }
        random_track = random_tracks
    }

    //initialize challenge
    let challenge = {
        type: type,
        created: Date.now(),

        // completed: false,
        // rerolled: false,
        // rated: false,
        // track_bribe: false,
        // racer_bribe: false,
        // hunt: false,
        racer: random_racer,
        track: random_track,
        conditions: {
            laps: laps,
            nu: nu,
            skips: skips,
            mirror: mirror,
            backwards: backwards,
        },
        hunt_bonus: 0,
    }
    if (type == 'private') {
        challenge.player = { member: member, name: name, avatar: avatar, user: user }
        challenge.channel = interaction.message.channelId
        challenge.guild = interaction.guildId
    } else if (type == 'cotd') {
        challenge.day = exports.easternTime().dayOfYear()
    } else if (type == 'cotm') {
        challenge.month = exports.easternTime().month()
    }

    challenge = exports.getSponsor(challenge, db)

    return challenge
}

exports.getSponsor = function (challenge, db) {
    Object.keys(db.ch.sponsors).forEach(key => {
        if (!challenge.submissions) {
            challenge.sponsors = {}
            challenge.sponsor_title = ''
            challenge.sponsor_time = ''
            if (exports.matchingChallenge(db.ch.sponsors[key], challenge)) {
                if (!challenge.sponsors[db.ch.sponsors[key].sponsor?.member]) {
                    challenge.sponsors[db.ch.sponsors[key].sponsor.member] = db.ch.sponsors[key].sponsor
                    challenge.sponsors[db.ch.sponsors[key].sponsor.member].multiplier = 1
                } else {
                    challenge.sponsors[db.ch.sponsors[key].sponsor.member].multiplier++
                }
                challenge.sponsor_title = db.ch.sponsors[key].title
                challenge.sponsor_time = db.ch.sponsors[key].time
            }
        }
    })
    return challenge
}

exports.getBounty = function (challenge, db) {
    if (!challenge.submissions) {
        Object.keys(db.ch.bounties).forEach(key => {
            challenge.bounties = []
            let bounty = db.ch.bounties[key]
            if (challenge.type == 'private' && challenge.track == bounty.track && challenge.racer == bounty.racer && (bounty.type == 'botd' || (bounty.player?.member == challenge.player?.member))) {
                if ((bounty.type == 'botd' && Date.now() - 1000 * 60 * 60 * 24 < bounty.created) || (bounty.type == 'private' && Date.now() - 1000 * 60 * 60 < bounty.created)) {
                    if (!bounty.completed) {
                        challenge.bounties.push({ daily: bounty.type == 'botd', bonus: bounty.bonus ?? "", url: challenge.url ?? "", key })
                    }
                }
            } else {
                challenge.bounties = []
            }
        })
    }
    return challenge
}

exports.expiredEmbed = function () {
    const holdUp = new EmbedBuilder()
        .setTitle("<:WhyNobodyBuy:589481340957753363> Expired Challenge")
        .setDescription("Sorry, this challenge is no longer available.")
    return holdUp
}

exports.isActive = function (current_challenge) {
    if (current_challenge.rescue) {
        return true
    }
    let intime = Date.now() - 15 * 60 * 1000 < current_challenge.created
    let intime_day = Date.now() - 24 * 60 * 60 * 1000 < current_challenge.created
    let intime_month = exports.easternTime().month() == moment(current_challenge.created).tz('America/New_York').month()
    return ((current_challenge.type == 'abandoned' && !current_challenge.submissions) ||
        (['open', 'cotd'].includes(current_challenge.type) && intime_day) ||
        (current_challenge.type == 'cotm') && intime_month ||
        (current_challenge.type == 'multiplayer' && intime) ||
        (current_challenge.type == 'private' && intime)) &&
        (!current_challenge.completed && !current_challenge.rerolled)
}

exports.generateChallengeTitle = function (current_challenge) {
    let nutext = current_challenge.conditions.nu ? " with **NO UPGRADES**" : ""
    let skipstext = current_challenge.conditions.skips ? " with **SKIPS**" : ""
    let laptext = current_challenge.conditions.laps !== 3 ? " for **" + current_challenge.conditions.laps + " Lap" + (current_challenge.conditions.laps > 1 ? "s" : "") + "**" : ""
    let mirrortext = current_challenge.conditions.mirror && current_challenge.conditions.backwards ? ", **MIRRORED and BACKWARDS!**" : (current_challenge.conditions.mirror ? ", **MIRRORED!**" : "")
    let backwardstext = current_challenge.conditions.backwards && !current_challenge.conditions.mirror ? ", **BACKWARDS!**" : ""
    let bribed_racer = current_challenge.racer_bribe ? "*" : ""
    let bribed_track = current_challenge.track_bribe ? "*" : ""
    let prefix = current_challenge.bounties && current_challenge.bounties.length ? ":dart: Challenge Bounty\n" : ""
    let racer_flag = current_challenge.racer_bribe ? ":moneybag:" : racers[current_challenge.racer]?.flag
    let track_flag = current_challenge.track_bribe ? ":moneybag:" : planets[tracks[current_challenge.track]?.planet]?.emoji
    let status = current_challenge.rerolled ? ":arrows_counterclockwise: Rerolled: " : current_challenge.completed ? ":white_check_mark: Completed: " : ''
    let sponsortitle = current_challenge.sponsor_title ? `*"${current_challenge.sponsor_title}"*\n` : ""
    let title = sponsortitle + status + prefix + (current_challenge.rerolled ? "~~" : "") + "Race as **" + bribed_racer + racer_flag + " " + racers[current_challenge.racer].name + bribed_racer + "**" + nutext + " on **" + bribed_track + track_flag + " " + tracks[current_challenge.track]?.name + bribed_track + "**" + laptext + skipstext + mirrortext + backwardstext + (current_challenge.rerolled ? "~~" : "")
    if (current_challenge.type == 'cotm') {
        title = Object.values(emojimap)[Math.floor(Math.random() * Object.values(emojimap).length)] + " Multi-track Challenge: Race as **" + racer_flag + " " + racers[current_challenge.racer].name + "**" + nutext + laptext + skipstext + mirrortext + backwardstext
    }
    return title.slice(0, 255)
}

exports.generateChallengeDescription = function ({ current_challenge, db }) {
    let desc = ''

    let duration = ['abandoned', 'multiplayer', 'private'].includes(current_challenge.type) ? 1000 * 60 * 15 : current_challenge.type == 'cotm' ? 1000 * 60 * 60 * 24 * exports.easternTime().daysInMonth() : 1000 * 60 * 60 * 24
    let expiration = ''
    if (current_challenge.type !== 'abandoned') {
        expiration = "Expires <t:" + Math.round((current_challenge.created + duration) / 1000) + ":R>"
    }

    desc = [exports.getFeedbackTally(db, current_challenge), (!current_challenge.completed && !current_challenge.rerolled ? expiration : ''), (current_challenge.sponsors ? exports.getSponsors(current_challenge) : ''), (current_challenge.predictions && !current_challenge.completed ? exports.getPredictors(current_challenge) : "")].filter(d => ![null, undefined, ''].includes(d)).join(" | ")

    let formercotd = Object.values(db.ch.challenges).find(c => c.created < current_challenge.created && c.type == 'cotd' && exports.matchingChallenge(c, current_challenge)) ?? null
    if (formercotd) {
        desc += `\n Former :game_die: *Random Challenge of the Day*`
    }

    if (current_challenge.conditions.backwards) {
        desc += '\n [Backwards tracks mod](https://www.speedrun.com/resourceasset/1aada)'
    }

    if (current_challenge.type == 'cotm') {
        desc += `\nComplete the following tracks in any order, back-to-back as in an RTA setting. Submit your total in-game time (IGT).\n\n${current_challenge.track.map(track => planets[tracks[track].planet].emoji + " **" + tracks[track].name + "**").join("\n")}`
    }

    let crossout = ''
    if (current_challenge.bounties && current_challenge.bounties.length) {
        if (!current_challenge.completed) {
            let total_bonus = 0
            let daily = false
            Object.values(current_challenge.bounties).forEach(b => {
                total_bonus += b.bonus
                if (b.daily) {
                    daily = true
                }
            })
            desc += "\nYou found " + (daily ? 'the Daily' : "a") + " Challenge Bounty! Complete the challenge to earn a " + '`📀' + tools.numberWithCommas(total_bonus) + "` reward"
        }

        if (current_challenge.refunded) {
            crossout = '~~'
        }
    }
    if (current_challenge.racer_bribe) {
        desc += crossout + "\n💰 (Racer) `-📀" + tools.numberWithCommas(truguts.bribe_racer) + "`" + crossout
    }
    if (current_challenge.track_bribe) {
        desc += crossout + "\n💰 (Track) `-📀" + tools.numberWithCommas(truguts.bribe_track) + "`" + crossout
    }
    return desc
}

exports.getPredictors = function (current_challenge) {
    return current_challenge.predictions ? "🔮 " + Object.values(current_challenge.predictions).map(p => p.name).join(", ") : ""
}

exports.getSponsors = function (current_challenge) {
    return current_challenge.sponsors && Object.values(current_challenge.sponsors).length ? "📢 " + Object.values(current_challenge.sponsors).map(p => p.name + (p.earnings ? " `+📀" + tools.numberWithCommas(p.earnings) + "`" : "")).join(", ") : ""
}

exports.predictionScore = function (predicted_time, actual_time) {

    let diff = Number(predicted_time) - Number(actual_time)
    let score = 0
    if (diff >= 0) {
        score = Math.round(truguts.prediction_max * (1 - (0.1 * 33.33) / (0.1 * 33.33 + 5)) ** diff)
    }
    return score
}

exports.matchingChallenge = function (challenge1, challenge2) {
    if (Array.isArray(challenge1.track) && Array.isArray(challenge2.track)) {
        if (challenge1.track.length !== challenge2.track.length) {
            return false;
        }

        // Sort both arrays in ascending order
        const sortedArr1 = challenge1.track.slice().sort((a, b) => a - b);
        const sortedArr2 = challenge2.track.slice().sort((a, b) => a - b);

        // Compare the sorted arrays element by element
        for (let i = 0; i < sortedArr1.length; i++) {
            if (sortedArr1[i] !== sortedArr2[i]) {
                return false;
            }
        }

        return challenge1.racer == challenge2.racer &&
            challenge1.conditions.laps == challenge2.conditions.laps &&
            challenge1.conditions.mirror == challenge2.conditions.mirror &&
            challenge1.conditions.nu == challenge2.conditions.nu &&
            challenge1.conditions.skips == challenge2.conditions.skips
        // && challenge1.conditions.backwards == challenge2.conditions.backwards
    } else if (!Array.isArray(challenge1.track) && !Array.isArray(challenge2.track)) {
        return challenge1.track == challenge2.track &&
            challenge1.racer == challenge2.racer &&
            challenge1.conditions.laps == challenge2.conditions.laps &&
            challenge1.conditions.mirror == challenge2.conditions.mirror &&
            challenge1.conditions.nu == challenge2.conditions.nu &&
            challenge1.conditions.skips == challenge2.conditions.skips &&
            challenge1.conditions.backwards == challenge2.conditions.backwards
    } else {
        return false
    }

}

exports.getFeedbackTally = function (db, current_challenge) {
    //tally likes and dislikes
    let like = 0, dislike = 0
    Object.keys(db.ch.feedback).forEach(key => {
        if (exports.matchingChallenge(db.ch.feedback[key], current_challenge)) {
            if (db.ch.feedback[key].feedback == "👍") {
                like++
            } else if (db.ch.feedback[key].feedback == "👎") {
                dislike++
            }
        }
    })
    return (like ? "`👍" + like + "` " : "") + (dislike ? "`👎" + dislike + "` " : "")
}

exports.goalTimeList = function (current_challenge, profile, best) {
    //calculate goal time
    let goals = [0, 0, 0, 0, 0]
    if (current_challenge.type == 'cotm') {
        current_challenge.track.forEach(t => {
            let tgoals = exports.getGoalTimes(
                {
                    track: t,
                    racer: current_challenge.racer,
                    skips: current_challenge.conditions.skips,
                    nu: current_challenge.conditions.nu,
                    laps: current_challenge.conditions.laps,
                    backwards: current_challenge.conditions.backwards,
                    best: best?.filter(b => b.date !== current_challenge.created)
                })
            for (let i = 0; i < 5; i++) {
                goals[i] += tgoals[i]
            }
        })
    } else {
        goals = exports.getGoalTimes(
            {
                track: current_challenge.track,
                racer: current_challenge.racer,
                skips: current_challenge.conditions.skips,
                nu: current_challenge.conditions.nu,
                laps: current_challenge.conditions.laps,
                backwards: current_challenge.conditions.backwards,
                best: best?.filter(b => b.date !== current_challenge.created)
            })
    }

    let goal_earnings = []
    for (let i = 0; i < 4; i++) {
        let earning = current_challenge.type == 'cotm' ? current_challenge.track.map(t => circuits[tracks[t].circuit].winnings[1][i]).reduce((a, b) => a + b) :
            Math.round(circuits[tracks[current_challenge.track].circuit].winnings[current_challenge.type == 'private' ? profile.settings.winnings : 1][i] * (current_challenge.type == 'abandoned' ? truguts.abandoned : 1))
        goal_earnings.push(earning)
    }
    goal_earnings.push(0)
    let goalTimes = ''
    for (let i = 0; i < 5; i++) {
        goalTimes += goal_symbols[i] + " " + tools.timefix(goals[i]) + (goal_earnings[i] ? "  `+📀" + tools.numberWithCommas(goal_earnings[i]) + "`" : '') + "\n"
    }
    return { list: goalTimes, times: goals, earnings: goal_earnings }
}

exports.predictionAchievement = function (db, member) {
    let count = 0
    Object.values(db.ch.challenges).forEach(challenge => {
        if (challenge.type == 'private' && challenge.submissions && challenge.predictions?.[member]) {

            let submitted_time = Number(Object.values(challenge.submissions)[0].time)
            let predicted_time = Number(challenge.predictions?.[member]?.time)
            let diff = predicted_time - submitted_time

            if (diff <= 1 && diff >= 0) {
                count++
            }
        }
    })
    return count
}

exports.sponsorAchievement = function (db, member) {
    let count = 0
    Object.values(db.ch.sponsors).forEach(s => {
        if (s?.sponsor?.member == member) {
            count++
        }
    })
    return count
}

exports.bountyAchievement = function (db, member) {
    let count = 0
    Object.values(db.ch.bounties).forEach(bounty => {
        if (bounty.player?.member == member && bounty.completed) {
            count++
        }
    })
    return count
}

exports.generateLeaderboard = function (best, member, current_challenge) {
    let besttimes = ":snowflake: `+📀" + tools.numberWithCommas(truguts.first) + "`"
    let pos = ["<:P1:671601240228233216> ", "<:P2:671601321257992204> ", "<:P3:671601364794605570> ", "4th ", "5th ", "6th ", "7th ", "8th ", "9th ", "10th "]

    if (best.length > 0) {
        if (current_challenge.completed && current_challenge.predictions) {
            Object.values(current_challenge.predictions).forEach(p => {
                best.push({
                    time: p.time,
                    name: p.name,
                    prediction: true
                })
            })
        }
        if (current_challenge.sponsor_time) {
            best.push({
                time: current_challenge.sponsor_time,
                name: current_challenge.sponsor.name,
                sponsor: true
            })
        }
        if (current_challenge.completed && current_challenge.type == 'private') {
            let times = exports.getGoalTimes({
                track: current_challenge.track,
                racer: current_challenge.racer,
                skips: current_challenge.conditions.skips,
                nu: current_challenge.conditions.nu,
                laps: current_challenge.conditions.laps,
                backwards: current_challenge.conditions.backwards,
                best: best.filter(b => b.date !== current_challenge.created)
            })
            times.forEach((time, i) => {
                best.push({
                    time: time,
                    name: goal_symbols[i],
                    goal: true
                })
            })
        }
        best.sort(function (a, b) {
            return a.time - b.time;
        })
        besttimes = ""
        let already = []
        let submission = current_challenge.submissions && current_challenge.type == 'private' ? current_challenge.submissions[current_challenge.player.member].time : null
        for (let i = 0; i < best.length; i++) {
            if (best[i].prediction || !already.includes(best[i].user) || (best[i].user == member && current_challenge.type == 'private') || best[i].date == current_challenge.created) {
                let bold = ((best[i].user == member && current_challenge.type == 'private') || best[i].date == current_challenge.created) ? "**" : ""
                besttimes += (best[i].goal ? `*${best[i].name} ` : best[i].prediction ? "🔮 *" : best[i].sponsor ? "📢 " : pos[0]) + bold + (best[i].proof ? "[" : "") + tools.timefix(best[i].time) + (best[i].proof ? "](" + best[i].proof + ")" : "") +
                    (best[i].goal ? '*' : " - " + best[i].name) + bold +
                    (console_emojis[best[i].platform] ? ` ${console_emojis[best[i].platform]}` : '') +
                    (best[i].notes ? " `" + best[i].notes + "`" : "") +
                    (best[i].prediction ? " `+📀" + exports.predictionScore(best[i].time, submission) + "`*" : "") +
                    (!['private', 'abandoned'].includes(current_challenge.type) && current_challenge?.earnings?.[best[i].user] ? " `+📀" + tools.numberWithCommas(current_challenge.earnings?.[best[i].user]?.truguts_earned) + "`" : "") +
                    (best[i].date == current_challenge.created ? " <a:newrecord:672640831882133524>" : "") + "\n"
                if (!best[i].prediction && !best[i].sponsor && !best[i].goal) {
                    pos.splice(0, 1)
                    already.push(best[i].user)
                }

            }
            if (pos.length == 0) {
                i = best.length
            }
        }
    }
    return besttimes
}

exports.achievementProgress = function ({ db, player } = {}) {
    let achievements = { ...achievement_data }

    Object.keys(achievements).forEach(key => {
        achievements[key].count = 0
        achievements[key].collection = {}
        achievements[key].array = []
        achievements[key].missing = []
    })

    function updateProgress(challenge) {
        achievements.galaxy_famous.collection[String(challenge.track)] = 1
        achievements.pod_champ.collection[String(challenge.racer)] = 1
        if (challenge.conditions.skips) {
            achievements.light_skipper.collection[String(challenge.track)] = 1
        }
        if (challenge.conditions.nu) {
            achievements.slow_steady.collection[String(challenge.racer)] = 1
        }
        if (challenge.conditions.mirror) {
            achievements.mirror_dimension.collection[String(challenge.track)] = 1
        }
        if (challenge.conditions.backwards) {
            achievements.backwards_compatible.collection[String(challenge.track)] = 1
        }
        if (challenge.conditions.laps !== 3) {
            achievements.lap_god.count += Number(challenge.conditions.laps)
        }
        if (challenge.racer == tracks[String(challenge.track)].favorite) {
            achievements.crowd_favorite.collection[String(challenge.track)] = 1
        }
        achievements.true_jedi.collection[String(challenge.track + " " + challenge.racer)] = 1
    }

    Object.values(db.ch.times).forEach(challenge => {
        if (challenge.user == player) { //get achievement progress
            if (Array.isArray(challenge.track)) {
                challenge.track.forEach(t => {
                    updateProgress({ ...challenge, track: t })
                })
            } else {
                updateProgress(challenge)
            }
        }
    })

    Object.keys(achievements).forEach(key => {
        if (!achievements[key].count) {
            achievements[key].count = Object.values(achievements[key].collection).length
        }
    })

    achievements.bounty_hunter.count = exports.bountyAchievement(db, player)
    achievements.bankroller_clan.count = exports.sponsorAchievement(db, player)
    achievements.force_sight.count = exports.predictionAchievement(db, player)
    let profile = Object.values(db.user).find(u => u.discordID == player)
    achievements.big_time_swindler.count = profile.random.truguts_earned + profile.random.truguts_spent

    return achievements
}

exports.challengeAchievementProgress = function ({ client, current_challenge, profile, profileref, achievements, name, avatar, member } = {}) {
    let achievement_message_array = []
    if (Object.keys(achievements.galaxy_famous.collection).length < achievements.galaxy_famous.limit && !achievements.galaxy_famous.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.galaxy_famous.role + ">" : achievements.galaxy_famous.name,
            count: Object.keys(achievements.galaxy_famous.collection).length,
            limit: achievements.galaxy_famous.limit
        })
    }
    if (Object.keys(achievements.pod_champ.collection).length < achievements.pod_champ.limit && !achievements.pod_champ.collection[current_challenge.racer]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.pod_champ.role + ">" : achievements.pod_champ.name,
            count: Object.keys(achievements.pod_champ.collection).length,
            limit: achievements.pod_champ.limit
        })
    }
    if (Object.keys(achievements.light_skipper.collection).length < achievements.light_skipper.limit && current_challenge.conditions.skips && !achievements.light_skipper.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.light_skipper.role + ">" : achievements.light_skipper.name,
            count: Object.keys(achievements.light_skipper.collection).length,
            limit: achievements.light_skipper.limit
        })
    }
    if (Object.keys(achievements.slow_steady.collection).length < achievements.slow_steady.limit && current_challenge.conditions.nu && !achievements.slow_steady.collection[current_challenge.racer]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.slow_steady.role + ">" : achievements.slow_steady.name,
            count: Object.keys(achievements.slow_steady.collection).length,
            limit: achievements.slow_steady.limit
        })
    }
    if (Object.keys(achievements.mirror_dimension.collection).length < achievements.mirror_dimension.limit && current_challenge.conditions.mirror && !achievements.mirror_dimension.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.mirror_dimension.role + ">" : achievements.mirror_dimension.name,
            count: Object.keys(achievements.mirror_dimension.collection).length,
            limit: achievements.mirror_dimension.limit
        })
    }
    if (achievements.lap_god.count < achievements.lap_god.limit && current_challenge.conditions.laps !== 3) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.lap_god.role + ">" : achievements.lap_god.name,
            count: achievements.lap_god.count,
            limit: achievements.lap_god.limit
        })
    }
    if (Object.keys(achievements.backwards_compatible.collection).length < achievements.backwards_compatible.limit && current_challenge.conditions.backwards && !achievements.backwards_compatible.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.backwards_compatible.role + ">" : achievements.backwards_compatible.name,
            count: Object.keys(achievements.backwards_compatible.collection).length,
            limit: achievements.backwards_compatible.limit
        })
    }
    if (Object.keys(achievements.crowd_favorite.collection).length < achievements.crowd_favorite.limit && current_challenge.racer == tracks[current_challenge.track].favorite && !achievements.crowd_favorite.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.crowd_favorite.role + ">" : achievements.crowd_favorite.name,
            count: Object.keys(achievements.crowd_favorite.collection).length,
            limit: achievements.crowd_favorite.limit
        })
    }
    if (Object.keys(achievements.true_jedi.collection).length < achievements.true_jedi.limit && !achievements.true_jedi.collection[current_challenge.track + " " + current_challenge.racer]) {
        achievement_message_array.push({
            name: current_challenge.guild == swe1r_guild ? "<@&" + achievements.true_jedi.role + ">" : achievements.true_jedi.name,
            count: Object.keys(achievements.true_jedi.collection).length,
            limit: achievements.true_jedi.limit
        })
    }
    let achievement_progress = ''
    achievement_message_array.forEach((ach, index) => {
        achievement_progress += "**" + (current_challenge.guild == swe1r_guild ? "" : "🏆 ") + ach.name + "** `" + ach.count + "/" + ach.limit + "` " + (index !== achievement_message_array.length - 1 ? "○ " : "")
    })
    exports.awardAchievements({ current_challenge, client, achievements, profile, profileref, name, avatar, member })
    return achievement_progress
}

exports.challengeColor = function (current_challenge) {
    //color conditions
    let color = current_challenge.type == 'cotm' ? '#00FF00' : planets[tracks[current_challenge.track].planet].color

    if (current_challenge.rerolled) {
        color = "3B88C3"
    } else if (current_challenge.completed) {
        color = "77B255"
    } else if (current_challenge.type == 'abandoned') {
        color = "4d4d4d"
    }
    return color
}

exports.awardAchievements = function ({ client, achievements, current_challenge, profile, profileref, name, avatar, member } = {}) {
    Object.keys(achievements).forEach(key => {
        if (Object.keys(achievements[key].collection).length >= achievements[key].limit || achievements[key].count >= achievements[key].limit) { //if player has met condition for achievement
            if (current_challenge.guild == swe1r_guild) {
                let cmember = client.guilds.cache.get(current_challenge.guild).members.cache.get(member)
                if (!cmember.roles.cache.some(r => r.id === achievements[key].role)) { //award role
                    cmember.roles.add(achievements[key].role).catch(error => console.log(error))
                }
            }
            if (!profile.achievements[key]) { //send congrats
                profileref.child("achievements").child(key).set(true)
                postMessage(client, current_challenge.channel, { embeds: [exports.achievementEmbed(name, avatar, achievements[key], current_challenge.guild)] })
            }
        }
    })
}

exports.achievementEmbed = function (name, avatar, achievement, guild) {
    const congratsEmbed = new EmbedBuilder()
        .setAuthor({ name: name + " got an achievement!", iconURL: avatar })
        .setDescription(achievement.description)
        .setColor("FFB900")
        .setTitle("**:trophy: " + achievement.name + "**")
    if (guild == swe1r_guild) {
        congratsEmbed.setDescription("**<@&" + achievement.role + ">** - " + achievement.description)
    }
    return congratsEmbed
}

exports.challengeWinnings = function ({ current_challenge, submitted_time, profile, best, goals, member } = {}) {
    if (!Object.keys(submitted_time).length) {
        return { earnings: 0, receipt: "Sorry, could not calculate earnings." }
    }
    let earnings = "", earnings_total = 0, winnings_text = null
    for (let i = 4; i > -1; i--) {
        if (submitted_time.time < goals.times[i]) {
            winnings_text = i
        }
    }
    if (goals.earnings[winnings_text] > 0) {
        earnings += "`+📀" + tools.numberWithCommas(goals.earnings[winnings_text]) + "` " + goal_symbols[winnings_text] + "\n"
        earnings_total += goals.earnings[winnings_text]
    }

    if (current_challenge.bounties) {
        let bounty_total = 0
        Object.values(current_challenge.bounties).forEach(bounty => {
            bounty_total += bounty.bonus
        })
        earnings += "`+📀" + tools.numberWithCommas(bounty_total) + "` :dart:\n"
        earnings_total += bounty_total
    }
    if (current_challenge.sponsor_time && Number(submitted_time.time) - Number(current_challenge.sponsor_time) < 0) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.beat_sponsor) + "` 📢\n"
        earnings_total += truguts.beat_sponsor
    }
    if (profile.streak_start) {
        let streak = Math.floor((profile.streak_end - profile.streak_start) / (1000 * 60 * 60 * 24))
        if (streak > 0) {
            earnings += "`+📀" + tools.numberWithCommas(truguts.streak * streak) + "` " + streak + "-Day Streak\n"
            earnings_total += truguts.streak * streak
        }
    }
    let first = true, pb = false, beat = []
    for (let i = 0; i < best.length; i++) {
        if (best[i].date < submitted_time.date) {
            first = false
            if (best[i].user == member && best[i].date !== submitted_time.date && submitted_time.time < best[i].time) {
                pb = true
            }
        }
        if (best[i].user !== member && Number(submitted_time.time) - Number(best[i].time) < 0 && !beat.includes(String(best[i].user))) {
            beat.push(String(best[i].user))
        }
    }
    if (first) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.first) + "` :snowflake:\n"
        earnings_total += truguts.first
    }

    let winnings_non_standard = 0
    if (submitted_time.conditions.skips && submitted_time.settings.skips <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.conditions.mirror && submitted_time.settings.mirror_mode <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.conditions.laps !== 3 && submitted_time.settings.non_3_lap <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.conditions.nu && submitted_time.settings.no_upgrades <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.conditions.backwards && submitted_time.settings.backwards <= 25) {
        winnings_non_standard++
    }
    if (winnings_non_standard) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.non_standard) + " × " + winnings_non_standard + "` Non-Standard\n"
        earnings_total += truguts.non_standard * winnings_non_standard
    }

    if (current_challenge.type !== 'cotm' && tracks[current_challenge.track].lengthclass == 'Long' && !current_challenge.conditions.skips) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.long) + "` Long\n"
        earnings_total += truguts.long
    }
    if (current_challenge.type !== 'cotm' && tracks[current_challenge.track].lengthclass == 'Extra Long' && !current_challenge.conditions.skips) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.extra_long) + "` Extra Long\n"
        earnings_total += truguts.extra_long
    }
    if (beat.length) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.beat_opponent) + " × " + beat.length + "` Bop\n"
        earnings_total += truguts.beat_opponent * beat.length
    }
    if (pb) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.personal_best) + "` PB\n"
        earnings_total += truguts.personal_best
    }

    if (current_challenge?.ratings?.[member]) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.rated) + "` Rated\n"
        earnings_total += truguts.rated
    }
    earnings += "▬▬▬▬▬▬▬\n**`+📀" + tools.numberWithCommas(earnings_total) + "` Total**"
    let winnings = { earnings: earnings_total, receipt: earnings }
    return winnings
}

exports.getBest = function (db, current_challenge) {
    let best = []
    Object.keys(db.ch.times).forEach(key => {
        if (exports.matchingChallenge(db.ch.times[key], current_challenge)) { //get leaderboard
            best.push(db.ch.times[key])
        }
    })
    return best.sort(function (a, b) {
        return a.time - b.time;
    })
}

exports.updateChallenge = async function ({ client, db, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction } = {}) {
    record_holder = false
    let player = member
    let player_name = name
    let player_profile = profile
    let player_avatar = avatar
    if (current_challenge.type == 'private') {
        player = current_challenge.player.member
        player_name = current_challenge.player.name
        let player_user = current_challenge.player.user
        player_profile = db.user[player_user]?.random ?? null
        player_avatar = current_challenge.player.avatar
    }

    let best = exports.getBest(db, current_challenge)
    let played = best.map(b => b.user).includes(player)
    if (best.length > 0 && best[0].user == player) {
        record_holder = true
    }

    //refund bribe
    if (!current_challenge.refunded && current_challenge.bounties) {
        if (current_challenge.racer_bribe) {
            //profileref.update({ truguts_spent: profile.truguts_spent - truguts.bribe_racer })
            exports.manageTruguts({ profile, profileref, transaction: 'r', amount: truguts.bribe_racer })
        }
        if (current_challenge.track_bribe) {
            //profileref.update({ truguts_spent: profile.truguts_spent - truguts.bribe_track })
            exports.manageTruguts({ profile, profileref, transaction: 'r', amount: truguts.bribe_track })
        }
        current_challenge.refunded = true
    }

    //get sponsor/bounties

    current_challenge = exports.getSponsor(current_challenge, db)
    if (current_challenge.type == 'private') {
        current_challenge = exports.getBounty(current_challenge, db)
        current_challenge.reroll_cost = current_challenge.sponsors?.[player] || record_holder ? "free" : played ? "discount" : "full price"
    }

    if (current_challengeref) {
        current_challengeref.update(current_challenge)
    }

    let flavor_text = ''
    if (Math.random() < 0.20 && best.length > 0) {
        flavor_text = "The current record-holder for this challenge is... " + best[0].name + "!"
    } else if (Math.random() < 0.50 && current_challenge.player) {
        flavor_text = playerPicks[Math.floor(Math.random() * playerPicks.length)].replace("replaceme", current_challenge.player.name)
    } else {
        flavor_text = current_challenge.type == 'multiplayer' ? mpQuotes[Math.floor(Math.random() * mpQuotes.length)] : movieQuotes[Math.floor(Math.random() * movieQuotes.length)]
    }

    const cembed = await exports.challengeEmbed({ client, current_challenge, profile: player_profile, profileref, best, name: player_name, member: player, avatar: player_avatar, interaction, db })

    let data = {
        content: current_challenge.rerolled ? '' : "*" + flavor_text + "*",
        embeds: [cembed],
        components: current_challenge.rerolled ? [] : [exports.challengeComponents(current_challenge, profile)],
        fetchReply: true
    }
    return data
}

exports.rerollReceipt = function (current_challenge) {
    let reroll_cost = current_challenge.reroll_cost
    return {
        receipt: reroll_cost == 'discount' ? "-📀" + tools.numberWithCommas(truguts.reroll_discount) + " (discounted)" : (reroll_cost == 'free' ? "(no charge for record holders)" : "-📀" + tools.numberWithCommas(truguts.reroll)),
        cost: reroll_cost == 'discount' ? truguts.reroll_discount : (reroll_cost == 'free' ? 0 : truguts.reroll)
    }
}

exports.checkActive = function (db, member, current_challenge) {
    let occupied = null
    let result = null
    Object.keys(db.ch.challenges).forEach(key => {
        let challenge = db.ch.challenges[key]
        if (challenge.player?.member == member && challenge.type == 'private' && exports.isActive(challenge) && ((current_challenge && current_challenge.message !== challenge.message) || !current_challenge)) {
            challenge.message = key
            occupied = challenge
        }
    })
    if (occupied && Object.keys(occupied).length) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> A challenge, you have. Impossible, to take on a second.")
            .setDescription(`You have an incomplete active challenge in <#${occupied.channel}>.\n[Click this link](${occupied.url}) to return to your challenge or wait for it to expire <t:${Math.round(occupied.created / 1000) + 15 * 60}:R>`)
        result = holdUp
    }
    return result
}

exports.challengeEmbed = async function ({ current_challenge, profile, profileref, best, name, member, avatar, db, client } = {}) {
    let submitted_time = db.ch.times[current_challenge?.submissions?.[member]?.id] ?? {}
    let achs = current_challenge.type == 'private' ? exports.achievementProgress({ db, player: member }) : null
    let desc = exports.generateChallengeDescription({ current_challenge, db }) + (current_challenge.type == 'private' ? "\n" + exports.challengeAchievementProgress({ client, current_challenge, profile, profileref, achievements: achs, name, avatar, member }) : '')
    let title = exports.generateChallengeTitle(current_challenge)
    const challengeEmbed = new EmbedBuilder()

        .setColor(exports.challengeColor(current_challenge))
    if (title && !current_challenge.rerolled) {
        challengeEmbed.setTitle(title)
    }
    if (desc) {
        challengeEmbed.setDescription(current_challenge.rerolled ? title : desc)
    }

    const authormap = {
        multiplayer: {
            name: 'Multiplayer Challenge',
            iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/chequered-flag_1f3c1.png'
        },
        abandoned: {
            name: 'Abandoned Challenge',
            iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/dashing-away_1f4a8.png'
        },
        private: {
            name: `${name}'s Random Challenge`,
            iconURL: avatar
        },
        open: {
            name: 'Open Challenge',
            iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png'
        },
        cotd: {
            name: `Random Challenge of the Day #${Object.values(db.ch.challenges).filter(challenge => challenge.type == 'cotd' && challenge.created < current_challenge.created).length}`,
            iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png'
        },
        cotm: {
            name: `Random Challenge of the Month #${Object.values(db.ch.challenges).filter(challenge => challenge.type == 'cotm' && challenge.created < current_challenge.created).length}`,
            iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png'
        }
    }

    challengeEmbed.setAuthor(authormap[current_challenge.type])

    if (current_challenge.type == 'private') {
        challengeEmbed.setFooter({ text: "Truguts: 📀" + exports.currentTruguts(profile) })
    } else if (['cotd', 'cotm'].includes(current_challenge.type)) {
        challengeEmbed.setTimestamp(current_challenge.created)
    }

    let goals = exports.goalTimeList(current_challenge, profile, best)
    if (current_challenge.rerolled) {
        let reroll = exports.rerollReceipt(current_challenge)
        challengeEmbed.setFooter({ text: reroll.receipt + "\nTruguts: 📀" + exports.currentTruguts(profile) })
    } else if (current_challenge.completed && ['private', 'abandoned'].includes(current_challenge.type)) {
        let winnings = exports.challengeWinnings({ current_challenge, profile, profileref, submitted_time, best, goals, member })
        challengeEmbed
            .addFields({ name: "Winnings", value: winnings.receipt, inline: true })
    } else {
        challengeEmbed.addFields({ name: "Goal Times", value: goals.list, inline: true })
    }

    const image_url = best.find(b => b.proof?.includes('youtu'))?.proof ?? null
    let image = null
    if (image_url && !current_challenge.completed && !current_challenge.rerolled) {
        image = await getThumbnail(image_url)
    }
    if (image) {
        challengeEmbed.setImage(image)
    }
    if (!current_challenge.rerolled) {
        challengeEmbed.addFields({ name: "Best Times", value: exports.generateLeaderboard(best, member, current_challenge), inline: true })
    }
    return challengeEmbed
}

exports.challengeComponents = function (current_challenge, profile) {
    //components
    const row = new ActionRowBuilder()
    let reroll = exports.rerollReceipt(current_challenge)

    if ((!current_challenge.submissions || !['abandoned', 'private'].includes(current_challenge.type)) && exports.isActive(current_challenge)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_modal")
                .setLabel("Submit")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⏱️")
        )
    }
    if (current_challenge.type == "private" && !current_challenge.completed) {
        let current_truguts = profile.truguts_earned - profile.truguts_spent
        if (current_truguts >= reroll.cost) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("challenge_random_reroll")
                    .setLabel(reroll.cost == 0 ? '(Free)' : "📀" + tools.numberWithCommas(reroll.cost))
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("854097998357987418")
            )
        }
        if ((!current_challenge.track_bribe || !current_challenge.racer_bribe) && (current_truguts >= truguts.bribe_track || current_truguts >= truguts.bribe_racer)) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("challenge_random_bribe")
                    .setLabel("Bribe")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("💰")
            )
        }
        if (profile.settings.predictions) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("challenge_random_predict")
                    .setLabel("Predict")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("🔮")
            )
        }
    }
    if (current_challenge.completed) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_play")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🎲"),
            new ButtonBuilder()
                .setCustomId("challenge_random_modal")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("✏️")

        )
    }
    if (current_challenge.submissions) {
        // row.addComponents(
        //     new ButtonBuilder()
        //         .setCustomId("challenge_random_undo")
        //         .setStyle(ButtonStyle.Secondary)
        //         .setEmoji("↩️")
        // )
        if (!current_challenge.ratings || current_challenge.type !== 'private') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("challenge_random_like")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("👍"),
                new ButtonBuilder()
                    .setCustomId("challenge_random_dislike")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("👎")
            )
        }
    }
    if (current_challenge.completed) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_menu")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("862620287735955487")
        )
    }


    return row
}

exports.trackSelector = function ({ customid, placeholder, min, max } = {}) {
    const trackSelectRow = new ActionRowBuilder()
    const track_selector = new StringSelectMenuBuilder()
        .setCustomId(customid)
        .setPlaceholder(placeholder)
        .setMinValues(min)
        .setMaxValues(max)
    for (let i = 0; i < 25; i++) {
        track_selector.addOptions({
            label: tracks[i].name,
            value: String(i),
            description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
            emoji: {
                name: planets[tracks[i].planet].emoji.split(":")[1],
                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
            }
        })
    }
    trackSelectRow.addComponents(track_selector)
    return [trackSelectRow]
}

exports.racerSelector = function ({ customid, placeholder, min, max } = {}) {
    const racerSelectRow = new ActionRowBuilder()
    const racer_selector = new StringSelectMenuBuilder()
        .setCustomId(customid)
        .setPlaceholder(placeholder)
        .setMinValues(min)
        .setMaxValues(max)

    for (var i = 0; i < 23; i++) {
        racer_selector.addOptions({
            label: racers[i].name,
            value: String(i),
            description: racers[i].pod.substring(0, 50),
            emoji: {
                name: racers[i].flag.split(":")[1],
                id: racers[i].flag.split(":")[2].replace(">", "")
            }
        })
    }
    racerSelectRow.addComponents(racer_selector)
    return [racerSelectRow]
}

exports.bribeComponents = function (current_challenge) {
    let components = []
    if (!current_challenge.track_bribe) {
        components.push(...exports.trackSelector({ customid: 'challenge_random_bribe_track', placeholder: "Bribe Track (📀" + tools.numberWithCommas(truguts.bribe_track) + ")", min: 1, max: 1 }))
    }
    if (!current_challenge.racer_bribe) {
        components.push(...exports.racerSelector({ customid: 'challenge_random_bribe_racer', placeholder: "Bribe Racer (📀" + tools.numberWithCommas(truguts.bribe_racer) + ")", min: 1, max: 1 }))
    }
    return components
}

exports.menuEmbed = function () {
    const myEmbed = new EmbedBuilder()
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setTitle("<:menu:862620287735955487> Menu")
        .setColor("#ED4245")
        .setDescription("This is the Random Challenge menu. From here, you can access all options related to random challenges. Press the **Play** button to get rollin'.\n\n*" + tips[Math.floor(Math.random() * tips.length)] + "*")
        .setFooter({ text: "/challenge random" })
    return myEmbed
}

exports.menuComponents = function () {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_play")
                .setLabel("Play")
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🎲')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_shop")
                .setLabel("Shop")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛒')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_inventory")
                .setLabel("Inventory")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎒')
                .setDisabled(true)
        )

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_settings_initial")
                .setLabel("Settings")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile_stats")
                .setLabel("Profile")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_menu")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❔')
        )
    return [row1, row2]
}

exports.shopOptions = function ({ profile, player, db } = {}) {
    return [
        {
            label: `Hint (📀${tools.numberWithCommas(Math.min(truguts.hint.basic, truguts.hint.standard, truguts.hint.deluxe))} - 📀${tools.numberWithCommas(Math.max(truguts.hint.basic, truguts.hint.standard, truguts.hint.deluxe))})`,
            value: 'hint',
            description: "Get a hint for incomplete achievements",
            info: "Hints help you narrow down what challenges you need to complete for :trophy: **Achievements**. The more you pay, the better the hint.",
            emoji: {
                name: "💡"
            },
            options: exports.hintComponents({ db, profile, player })
        },
        {
            label: `Bounty (📀${tools.numberWithCommas(Math.min(truguts.hint.basic, truguts.hint.standard, truguts.hint.deluxe))} - 📀${tools.numberWithCommas(Math.max(truguts.hint.basic, truguts.hint.standard, truguts.hint.deluxe))})`,
            value: 'bounty',
            description: "Take on a challenge bounty, find it, and claim your prize!",
            info: "Challenge Bounty is a way to earn big truguts fast. Based on your hint selection, Botto hides a large trugut bonus on a random challenge.",
            emoji: {
                name: "🎯"
            },
            options: exports.huntComponents(profile)
        },
        {
            label: `Botto Lotto Ticket (📀200)`,
            value: 'lotto',
            description: "Guess the lucky tracks for the monthly challenge and win big",
            info: "Every month, a random multi-track challenge is generated with 4 - 10 tracks. Enter a Botto Lotto ticket with 7 track guesses.\n• For each track you get correct, earn `📀20,000`.\n• If all tracks on your ticket are in the monthly or vice versa, earn a grand prize of `📀1,000,000!`\n• Only one ticket per user per month.",
            emoji: {
                name: "🎫"
            },
            options: exports.trackSelector({ customid: 'challenge_random_shop_2', placeholder: 'Select Tracks', min: 7, max: 7 })
        },
        {
            label: `Sponsor Challenge (📀2,200 - 📀5,500)`,
            value: 'sponsorchallenge',
            description: "Sponsor a random challenge and earn truguts!",
            info: "Invest in a random challenge and make truguts on all its earnings. Select a circuit to sponsor and generate your random challenge based on your current odds. Next, you'll get a chance to set a title and sponsor time.",
            emoji: {
                name: "📣"
            },
            options: exports.sponsorShopComponents(profile)
        },
        {
            label: `Shuffle Banner (📀${tools.numberWithCommas(truguts.shuffle)})`,
            value: 'shuffle_banner',
            description: "Set a new random banner for the server",
            info: "Tired of the current banner? Give us a new one!",
            emoji: {
                name: "🚩"
            }
        }
    ]
}



exports.shopComponents = function ({ profile, selection, shoptions, purchased }) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_play")
                .setLabel("Play")
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🎲')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_shop")
                .setLabel("Shop")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛒')
                .setDisabled(true)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_inventory")
                .setLabel("Inventory")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎒')
                .setDisabled(true)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_menu")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("862620287735955487")
        )
    const row2 = new ActionRowBuilder()

    const shop_select = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_1')
        .setPlaceholder(exports.currentTruguts(profile) < 100 ? 'Get lost! Come back when you got some money!' : shoplines[Math.floor(Math.random() * shoplines.length)])
        .setMinValues(1)
        .setMaxValues(1)
    shoptions.forEach(option => {
        shop_select.addOptions(option)
    })
    row2.addComponents(shop_select)

    const comp = [row1, row2]

    let options = shoptions.find(s => s.value == [selection[1]?.[0]])?.options
    if (options) {
        comp.push(...options)
    }
    let selectable = []

    comp.forEach((row, i) => {
        row.components.filter(c => c.options).forEach(c => {
            c.options?.forEach(o => {
                if (o.data.value == selection[i] || selection[i]?.includes(o.data.value)) {
                    o.setDefault(true)
                }
            })
            let selectmap = c.options.map(o => o.data.default)
            selectable.push(selectmap.includes(true) && selectmap.filter(f => f)?.length >= c.data.min_values)
        })
    })

    const purchase = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("challenge_random_shop_purchase")
            .setLabel(purchased ? 'Purchased' : "Purchase")
            .setStyle(ButtonStyle.Success)
            .setDisabled(selectable.includes(false) || purchased)
    )

    comp.push(purchase)
    return comp
}

exports.profileEmbed = function ({ db, player, page, name, avatar } = {}) {
    const profileEmbed = new EmbedBuilder()
    profileEmbed
        .setAuthor({ name: name + "'s Random Challenge Profile", iconURL: avatar })

    const profile = Object.values(db.user).find(u => u.discordID == player)

    if (page == 'achievements') {
        const ach_report = exports.achievementProgress({ db, player })
        Object.values(ach_report).forEach(ach => {
            const achievement_title = (ach.count >= ach.limit ? ":white_check_mark: " : ":trophy: ") + ach.name + "  `" + tools.numberWithCommas(ach.count) + "/" + tools.numberWithCommas(ach.limit) + "`"
            const achievement_text = ach.description
            profileEmbed.addFields({ name: achievement_title, value: achievement_text, inline: false })
        })
        profileEmbed.setTitle(`Achievements (${Object.values(ach_report).filter(a => a.count >= a.limit).length}/${Object.keys(ach_report).length})`)
    } else if (page == 'stats') {
        profileEmbed
            .setTitle("Statistics")
            .setDescription("Current trugut balance: `📀" + exports.currentTruguts(profile.random) + "`")

        const stats = exports.getStats({ db, member: player, profile })
        profileEmbed
            .addFields({
                name: ":bar_chart: Challenge Stats",
                value: "Total: `" + stats.totals.total +
                    "`\nStandard: `" + stats.totals.standard +
                    "`\nSkips: `" + stats.totals.skips +
                    "`\nNo Upgrades: `" + stats.totals.no_upgrades +
                    "`\nNon 3-Lap: `" + stats.totals.non_3_lap +
                    "`\nMirrored: `" + stats.totals.mirrored +
                    "`\nBackwards: `" + stats.totals.backwards + "`",
                inline: true
            })
            .addFields({
                name: ":chart_with_upwards_trend: Gameplay Trends", value: "**Most Played Pod:** \n" + tools.getRacerName(stats.plays.mostPod.most_name) + " `" + stats.plays.mostPod.most_count + "`" +
                    "\n**Most Played Track:**\n" + tools.getTrackName(stats.plays.mostTrack.most_name) + " `" + stats.plays.mostTrack.most_count + "`" +
                    "\n**Most Played Planet:**\n" + tools.getPlanetName(stats.plays.mostPlanet.most_name) + " `" + stats.plays.mostPlanet.most_count + "`" +
                    "\n**Most Played Circuit:**\n" + tools.getCircuitName(stats.plays.mostCircuit.most_name) + " `" + stats.plays.mostCircuit.most_count + "`", inline: true
            })

        var feedbacktrend = ""
        feedbacktrend += "**Most Liked Pod:** \n" + tools.getRacerName(stats.feedback.likePod.most_name) + " `👍" + stats.feedback.likePod.most_count + "`" +
            "\n**Most Liked Track:**\n" + tools.getTrackName(stats.feedback.likeTrack.most_name) + " `👍" + stats.feedback.likeTrack.most_count + "`\n"
        feedbacktrend += "**Most Disliked Pod:**\n" + tools.getRacerName(stats.feedback.dislikePod.most_name) + " `👎" + stats.feedback.dislikePod.most_count + "`" +
            "\n**Most Disliked Track:**\n" + tools.getTrackName(stats.feedback.dislikeTrack.most_name) + " `👎" + stats.feedback.dislikeTrack.most_count + "`"
        profileEmbed
            .addFields({ name: ":pencil: Feedback Trends", value: feedbacktrend, inline: true })
            .addFields({
                name: ":stopwatch: Time Stats", value: "Total time: `" + tools.timefix(stats.times.total) + "`\n" +
                    "<:diamond:1136554333723435068> `" + stats.times.elite + "`\n" +
                    "<:platinum:1136554336705597510> `" + stats.times.pro + "`\n" +
                    "<:gold:1136554335426318406> `" + stats.times.rookie + "`\n" +
                    "<:silver:1136554338895011850> `" + stats.times.amateur + "`\n" +
                    "<:bronze:1136554332586786879> `" + stats.times.youngling + "`", inline: true
            })
            .addFields({
                name: ":moneybag: Bonus Stats", value: ":snowflake: `" + stats.bonuses.first + "`\n" +
                    "Bop `" + stats.bonuses.opponents_beat + "`\n" +
                    "PB `" + stats.bonuses.pbs + "`\n" +
                    "Non-Standard: `" + stats.bonuses.non_standard + "`\n" +
                    "Total `📀" + tools.numberWithCommas(profile.random.truguts_earned) + "`", inline: true
            })
            .addFields({
                name: ":shopping_cart: Purchase Stats", value: "Rerolls: `" + stats.purchases.rerolls + "`\n" +
                    "Track Bribes: `" + stats.purchases.track_bribes + "`\n" +
                    "Racer Bribes: `" + stats.purchases.racer_bribes + "`\n" +
                    "Hints: `" + stats.purchases.hints + "`\n" +
                    "Total Spending: `📀" + tools.numberWithCommas(profile.random.truguts_spent) + "`", inline: true
            })
    }

    return profileEmbed
}

exports.profileComponents = function ({ member, page }) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile_stats_uid" + member)
                .setLabel("Stats")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
                .setDisabled(page == 'stats')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile_achievements_uid" + member)
                .setLabel("Achievements")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏆')
                .setDisabled(page == 'achievements')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_menu_uid" + member)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("862620287735955487")
        )

    return [row1]
}

exports.getStats = function ({ db, member, profile } = {}) {
    let stats = {
        totals: {
            total: 0,
            standard: 0,
            skips: 0,
            no_upgrades: 0,
            non_3_lap: 0,
            mirrored: 0,
            backwards: 0
        },
        times: {
            total: 0,
            elite: 0,
            pro: 0,
            rookie: 0,
            amateur: 0,
            youngling: 0
        },
        bonuses: {
            first: 0,
            opponents_beat: 0,
            pbs: 0,
            non_standard: 0,
            total_earnings: 0
        },
        purchases: {
            rerolls: 0,
            track_bribes: 0,
            racer_bribes: 0,
            hints: 0,
            total_spending: 0
        },
        plays: {
            mostPod: {},
            mostTrack: {},
            mostPlanet: {},
            mostCircuit: {}
        },
        feedback: {
            likePod: {},
            likeTrack: {},
            dislikePod: {},
            dislikeTrack: {}
        }
    }
    stats.bonuses.total_earnings = profile.truguts_earned
    stats.purchases.total_spending = profile.truguts_spent
    if (profile.random.purchases) {
        Object.values(profile.random.purchases).forEach(purchase => {
            if (["Basic Hint", "Standard Hint", "Deluxe Hint"].includes(purchase.purchased_item)) {
                stats.purchases.hints++
            }
            if (purchase.purchased_item == "track bribe") {
                stats.purchases.track_bribes++
            }
            if (purchase.purchased_item == "racer bribe") {
                stats.purchases.racer_bribes++
            }
            if (purchase.purchased_item == "reroll") {
                stats.purchases.rerolls++
            }
        })
    }

    stats.plays.mostPod.most_count = 0
    stats.plays.mostPod.most_name = null
    stats.plays.mostTrack.most_count = 0
    stats.plays.mostTrack.most_name = null
    stats.plays.mostPlanet.most_count = 0
    stats.plays.mostPlanet.most_name = null
    stats.plays.mostCircuit.most_count = 0
    stats.plays.mostCircuit.most_name = null
    stats.feedback.likePod.most_count = 0
    stats.feedback.likePod.most_name = null
    stats.feedback.likeTrack.most_count = 0
    stats.feedback.likeTrack.most_name = null
    stats.feedback.dislikePod.most_count = 0
    stats.feedback.dislikePod.most_name = null
    stats.feedback.dislikeTrack.most_count = 0
    stats.feedback.dislikeTrack.most_name = null
    function getMost(obj, prop) {
        if (obj[prop] == null) {
            obj[prop] = 1
        } else {
            obj[prop]++
        }
        if (obj[prop] > obj.most_count) {
            obj.most_name = prop;
            obj.most_count = obj[prop];
        }
    }
    Object.values(db.ch.times).filter(challenge => !Array.isArray(challenge.track)).forEach(challenge => {
        if (challenge.user == member) {
            stats.totals.total++
            //time stats
            stats.times.total += Number(challenge.time)
            var goals = exports.getGoalTimes({ racer: challenge.racer, track: challenge.track, skips: challenge.conditions.skips, nu: challenge.conditions.nu, laps: challenge.conditions.laps, backwards: challenge.conditions.backwards, best: Object.values(db.ch.times).filter(c => exports.matchingChallenge(c, challenge) && c.date < challenge.date) })
            var goal_array = ["elite", "pro", "rookie", "amateur", "youngling"]
            var goal_time = null
            for (var j = goals.length - 1; j > -1; j--) {
                if (challenge.time < goals[j]) {
                    goal_time = j
                }
            }
            if (goal_time !== null) {
                stats.times[goal_array[goal_time]]++
            }
            //stats
            if (!challenge.mirror && !challenge.nu && !challenge.skips && challenge.laps == 3) {
                stats.totals.standard++
            } else {
                if (challenge.conditions.skips) {
                    stats.totals.skips++
                    stats.bonuses.non_standard++
                }
                if (challenge.conditions.nu) {
                    stats.totals.no_upgrades++
                    stats.bonuses.non_standard++
                }
                if (challenge.conditions.laps !== 3) {
                    challenge
                    stats.totals.non_3_lap++
                    stats.bonuses.non_standard++
                }
                if (challenge.conditions.mirror) {
                    stats.totals.mirrored++
                    stats.bonuses.non_standard++
                }
                if (challenge.conditions.backwards) {
                    stats.totals.backwards++
                    stats.bonuses.non_standard++
                }
            }
            hasraced = true
            getMost(stats.plays.mostPod, challenge.racer)
            getMost(stats.plays.mostTrack, challenge.track)
            getMost(stats.plays.mostPlanet, tracks[challenge.track].planet)
            getMost(stats.plays.mostCircuit, tracks[challenge.track].circuit)
            var first = true
            var pb = false
            var beat = []
            Object.values(db.ch.times).filter(c => exports.matchingChallenge(c, challenge)).forEach(c => {
                if (c < challenge.date) {
                    first = false
                    if (c.user == member) {
                        pb = true
                        if (c.time < challenge.time) {
                            pb = false
                        }
                    }
                }
                if (c.user !== member && c.time > challenge.time && c.date < challenge.date && !beat.includes(c.user)) {
                    beat.push(c.user)
                }
            })
            stats.bonuses.opponents_beat += beat.length
            if (first) {
                stats.bonuses.first++
            }
            if (pb) {
                stats.bonuses.pbs++
            }
        }
    })
    Object.values(db.ch.feedback).filter(f => f.user == member).forEach(f => {
        getMost(f.feedback == "👍" ? stats.feedback.likePod : stats.feedback.dislikePod, f.racer)
        getMost(f.feedback == "👍" ? stats.feedback.likeTrack : stats.feedback.dislikeTrack, f.track)
    })

    return stats
}

exports.shopEmbed = function ({ shoptions, selection, profile }) {
    const selected = shoptions.find(o => o.value == selection[1]?.[0])

    const myEmbed = new EmbedBuilder()
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setTitle(":shopping_cart: Shop")
        .setColor("#ED4245")
        .setDescription("Welcome to Botto's Shop!" + (selected ? `\n\n**${selected.label}**\n${selected.info}` : ''))
        .setFooter({ text: `Truguts: 📀${exports.currentTruguts(profile)}` })
    return myEmbed
}

exports.playButton = function () {
    return new ButtonBuilder()
        .setCustomId("challenge_random_play")
        .setLabel("New Challenge")
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🎲')
}

exports.notYoursEmbed = function () {
    const noMoney = new EmbedBuilder()
        .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Challenge!")
        .setDescription("This is not your challenge. The option you selected is only available to the player who rolled this challenge. You may roll your own with the button below.")
    return noMoney
}

exports.hintComponents = function ({ profile, player, db } = {}) {

    const achievement_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder("Select Achievement")
        .setMinValues(1)
        .setMaxValues(1)

    const ach = exports.achievementProgress({ db, player })

    Object.keys(ach).filter(key => !profile.achievements[key] && !['big_time_swindler', 'bounty_hunter', 'bankroller_clan', 'force_sight', 'lap_god'].includes(key)).forEach(key => {
        achievement_selector.addOptions({
            label: ach[key].name,
            value: key,
            description: ach[key].description + ": " + ach[key].count + "/" + ach[key].limit,
            emoji: {
                name: "🏆"
            }
        })
    })
    const hint_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_3')
        .setPlaceholder("Select Hint")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < hints.length; i++) {
        if (profile.truguts_earned - profile.truguts_spent >= hints[i].price) {
            hint_selector.addOptions(
                {
                    label: hints[i].name,
                    value: String(i),
                    description: "📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description,
                    emoji: {
                        name: "💡"
                    }
                }
            )
        }
    }

    const row1 = new ActionRowBuilder().addComponents(achievement_selector)
    const row2 = new ActionRowBuilder().addComponents(hint_selector)
    return achievement_selector.options.length ? [row1, row2] : []
}

exports.huntComponents = function (profile) {
    const hint_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder("Select Bounty Type")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < hints.length; i++) {
        if (profile.truguts_earned - profile.truguts_spent >= hints[i].price) {
            hint_selector.addOptions(
                {
                    label: hints[i].hunt,
                    value: String(i),
                    description: "Price: 📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description + " | Bonus: 📀" + tools.numberWithCommas(hints[i].bonus),
                    emoji: {
                        name: "🎯"
                    }
                }
            )
        }
    }
    const row1 = new ActionRowBuilder().addComponents(hint_selector)
    return [row1]
}

exports.settingsEmbed = function ({ profile, name, avatar } = {}) {
    const settingsEmbed = new EmbedBuilder()
        .setTitle(":gear: Settings")
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setDescription("Customize the odds for your random challenge conditions to adjust the frequency of different conditions. Set your winnings pattern and enable/disable Predictions. Non-standard bonuses are only awarded if condition odds are less than or equal to 25%.")
        .setFooter({ text: name, iconURL: avatar })
        .setColor("#ED4245")
    let winnings = Number(profile.settings.winnings)
    let predictions = profile.settings.predictions
    let odds = {
        skips: profile.settings.skips + "%" + (profile.settings.skips > 0 && profile.settings.skips <= 25 ? " `+📀" + truguts.non_standard + "`" : ""),
        no_upgrades: profile.settings.no_upgrades + "%" + (profile.settings.no_upgrades > 0 && profile.settings.no_upgrades <= 25 ? " `+📀" + truguts.non_standard + "`" : ""),
        non_3_lap: profile.settings.non_3_lap + "%" + (profile.settings.non_3_lap > 0 && profile.settings.non_3_lap <= 25 ? " `+📀" + truguts.non_standard + "`" : ""),
        mirror_mode: profile.settings.mirror_mode + "%" + (profile.settings.mirror_mode > 0 && profile.settings.mirror_mode <= 25 ? " `+📀" + truguts.non_standard + "`" : ""),
        backwards: profile.settings.backwards + "%" + (profile.settings.backwards > 0 && profile.settings.backwards <= 25 ? " `+📀" + truguts.non_standard + "`" : "")
    }
    settingsEmbed
        .addFields({ name: "Your Odds", value: "Skips - " + odds.skips + "\nNo Upgrades - " + odds.no_upgrades + "\nNon 3-Lap - " + odds.non_3_lap + "\nMirror Mode - " + odds.mirror_mode + "\nBackwards - " + odds.backwards, inline: true })
        .addFields({ name: "Your Winnings: " + winnings_map[winnings].name, value: winnings_map[winnings].text, inline: true })
        .addFields({ name: "Predictions: " + (predictions ? "Enabled" : "Disabled"), value: (predictions ? "While you are in a private challenge, other players will have the option to predict your final time and earn truguts." : "Other players will not be able to make predictions on your final time when you are in a private challenge."), inline: false })
    return settingsEmbed
}

exports.settingsComponents = function (profile) {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_settings_odds")
                .setLabel("Customize Odds")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚖️'),
            new ButtonBuilder()
                .setCustomId("challenge_random_settings_predictions")
                .setLabel("Predictions: " + (profile.settings.predictions ? "On" : "Off"))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔮'),
            new ButtonBuilder()
                .setCustomId("challenge_random_settings_default")
                .setLabel("Reset to Default")
                .setStyle(ButtonStyle.Secondary)
        )
    const row2 = new ActionRowBuilder()
    const winnings_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_settings_winnings')
        .setPlaceholder("Set Winnings")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < winnings_map.length; i++) {
        winnings_selector.addOptions({
            label: "Winnings: " + winnings_map[i].name,
            value: String(i),
            description: i == settings_default.winnings ? 'Default' : ' ',
            default: profile.settings.winnings == i
        })
    }
    row2.addComponents(winnings_selector)
    return [row1, row2]
}

exports.racerHint = function (racer, count) {
    const hint_shuffle = racer_hints[racer].sort(() => 0.5 - Math.random())
    return hint_shuffle.slice(0, count + 1)
}

exports.trackHint = function (track, count) {
    const hint_shuffle = track_hints[track].sort(() => 0.5 - Math.random())
    return hint_shuffle.slice(0, count + 1)
}

exports.sponsorEmbed = function (sponsorchallenge, profile) {
    const sponsorEmbed = new EmbedBuilder()
        .setTitle(":loudspeaker: Sponsor")
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setDescription("Step 1: Set a custom title and time\nStep 2: Publish your challenge and get players to complete it\nStep 3: Profit")
        .setFooter({ text: "Truguts: 📀" + exports.currentTruguts(profile) })
        .setColor("#ED4245")
    let title = sponsorchallenge?.title ?? "No title set"
    let time = exports.validateTime(sponsorchallenge?.time) ?? "No time set"
    sponsorEmbed.addFields(
        { name: ":game_die: Challenge: ", value: exports.generateChallengeTitle(sponsorchallenge) },
        { name: ":label: Custom Title: " + title, value: "This will go above the challenge title." },
        { name: ":stopwatch: Custom Time: " + tools.timefix(time), value: "Players who beat this sponsor time will get a special bonus. Please make it achievable." }
    )
    return sponsorEmbed
}

exports.sponsorShopComponents = function (profile) {
    const row = new ActionRowBuilder()
    const circuit_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder("Select A Circuit")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < circuits.length; i++) {
        if (profile.truguts_earned - profile.truguts_spent >= circuits[i].sponsor) {
            circuit_selector.addOptions(
                {
                    label: circuits[i].name + " Circuit",
                    value: String(i),
                    description: "Cost: 📀" + tools.numberWithCommas(circuits[i].sponsor) + " | " + circuits[i].races + " Tracks",
                    emoji: {
                        name: "📢"
                    },
                }
            )
        }
    }
    row.addComponents(circuit_selector)
    return [row]
}

exports.sponsorComponents = function (profile) {
    const row1 = new ActionRowBuilder()
    row1.addComponents(
        new ButtonBuilder()
            .setCustomId("challenge_random_sponsor_details")
            .setLabel("Set Title & Time")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏷️'),
        new ButtonBuilder()
            .setCustomId("challenge_random_sponsor_publish")
            .setLabel("Publish Challenge")
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📢'))
    return [row1]
}

exports.validateTime = function (time) {
    if (!time || isNaN(Number(time.replace(":", ""))) || tools.timetoSeconds(time) == null) {
        return ''
    } else {
        return tools.timetoSeconds(time)
    }
}

exports.easternTime = function () {
    return moment().tz('America/New_York')
}

exports.monthlyChallenge = async function ({ client, challengesref, db } = {}) {
    let recent = null
    let lastfive = []
    if (db.ch.challenges) {
        Object.values(db.ch.challenges).filter(c => c.type == 'cotm').sort((a, b) => b.created - a.created).slice(0, 5).forEach(challenge => {
            lastfive.push(challenge)
            if (!recent || recent.created - challenge.created < 0) {
                recent = { ...challenge }
            }
        })
    }
    if (exports.easternTime().month() !== recent?.month || recent === null) { //exports.easternHour() == 0 && 
        let current_challenge = exports.initializeChallenge({ type: "cotm", db })
        if (recent?.conditions.laps !== 3 && current_challenge.conditions.laps !== 3 && Math.random() < .9) {
            current_challenge.conditions.laps = 3
        }
        ['nu', 'skips', 'mirror', 'backwards'].forEach(con => {
            if (recent?.conditions[con] && current_challenge.conditions[con] && Math.random() < .9) {
                current_challenge.conditions[con] = false
            }
        })
        let cotmmessage = await postMessage(client, '551786988861128714', await exports.updateChallenge({ client, current_challenge, db })) //551786988861128714
        current_challenge.message = cotmmessage.id
        current_challenge.guild = cotmmessage.guildId
        current_challenge.channel = cotmmessage.channelId
        current_challenge.url = cotmmessage.url
        challengesref.child(cotmmessage.id).set(current_challenge)
        cotmmessage.pin()
    }
}

exports.dailyChallenge = async function ({ client, challengesref, db } = {}) {
    let recent = null
    let lastfive = []

    if (db.ch.challenges) {
        Object.values(db.ch.challenges).filter(c => c.type == 'cotd').sort((a, b) => b.created - a.created).slice(0, 5).forEach(challenge => {
            lastfive.push(challenge)
            if (!recent || recent.created - challenge.created < 0) {
                recent = { ...challenge }
            }
        })
    }
    if (exports.easternTime().dayOfYear() !== recent.day) {
        let current_challenge = exports.initializeChallenge({ type: "cotd", db })
        if (lastfive.map(c => c.racer).includes(current_challenge.racer)) {
            if (Math.random() < 0.9) {
                let leftoverracers = []
                for (let i = 0; i < 23; i++) {
                    if (!lastfive.map(c => c.racer).includes(i)) {
                        leftoverracers.push(i)
                    }
                }
                current_challenge.racer = leftoverracers[Math.floor(Math.random() * leftoverracers.length)]
            }
        }
        if (lastfive.map(c => c.track).includes(current_challenge.track)) {
            if (Math.random() < 0.9) {
                let leftovertracks = []
                for (let i = 0; i < 25; i++) {
                    if (!lastfive.map(c => c.track).includes(i)) {
                        leftovertracks.push(i)
                    }
                }
                current_challenge.track = leftovertracks[Math.floor(Math.random() * leftovertracks.length)]
            }
        }
        if (recent.conditions.laps !== 3 && current_challenge.conditions.laps !== 3 && Math.random() < .9) {
            current_challenge.conditions.laps = 3
        }
        ['nu', 'skips', 'mirror', 'backwards'].forEach(con => {
            if (recent.conditions[con] && current_challenge.conditions[con] && Math.random() < .9) {
                current_challenge.conditions[con] = false
            }
        })
        let cotdmessage = await postMessage(client, '551786988861128714', await exports.updateChallenge({ client, current_challenge, db })) //551786988861128714
        current_challenge.message = cotdmessage.id
        current_challenge.guild = cotdmessage.guildId
        current_challenge.channel = cotdmessage.channelId
        current_challenge.url = cotdmessage.url
        challengesref.child(cotdmessage.id).set(current_challenge)
        cotdmessage.pin()
    }
}

exports.dailyBounty = async function ({ client, db, bountyref } = {}) {
    let recent = null
    if (db.ch.bounties) {
        Object.values(db.ch.bounties).filter(b => b.type == 'botd').forEach(bounty => {
            if (!recent || recent.created - bounty.created < 0) {
                recent = { ...bounty }
            }
        })
    }

    //console.log("bounty", exports.easternHour(), moment().utc().dayOfYear(), recent.message, recent.day, exports.easternHour() == 12, moment().utc().dayOfYear() !== recent.day)
    if ((exports.easternTime() == 12 && exports.easternTime().dayOfYear() !== recent.day)) { //
        let bounty = exports.initializeBounty('botd')
        let message = await postMessage(client, '551786988861128714', { embeds: [exports.bountyEmbed(bounty)] }) //551786988861128714
        bounty.url = message.url
        bounty.message = message.id
        bounty.channel = message.channelId
        bountyref.push(bounty)
        message.pin()
    }

}

exports.bountyEmbed = function (bounty, profile) {
    const bEmbed = new EmbedBuilder()
        .setTitle(":dart: " + (bounty.type == 'botd' ? "Bounty of the Day" : hints[bounty.r_hints].hunt))
        .setColor("#ED4245")
        .addFields(
            { name: "Track Leads", value: exports.trackHint(bounty.track, bounty.t_hints).map(h => "○ *" + h + "*").join("\n") },
            { name: "Racer Leads", value: exports.racerHint(bounty.racer, bounty.r_hints).map(h => "○ *" + h + "*").join("\n") }
        )

    if (bounty.type == 'private') {
        bEmbed
            .setFooter({ text: "Truguts: 📀" + exports.currentTruguts(profile) })
            .setDescription("`-📀" + tools.numberWithCommas(hints[bounty.r_hints].price) + "`\nBounty expires: <t:" + Math.round((Date.now() + 1000 * 60 * 60) / 1000) + ":R>\n" +
                "Reward: `📀" + tools.numberWithCommas(hints[bounty.r_hints].bonus) + "`")
            .setAuthor({ name: bounty.player.name + "'s Random Challenge Bounty", iconURL: bounty.player.avatar })
    } else {
        bEmbed
            .setTimestamp(bounty.created)
            //.setAuthor({ name: "Random Challenge Bounty", iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/direct-hit_1f3af.png' })
            .setDescription("Bounty expires: <t:" + Math.round((bounty.created + 1000 * 60 * 60 * 24) / 1000) + ":R>\n" +
                "Reward: `📀" + tools.numberWithCommas(bounty.bonus) + "`")
    }

    return bEmbed
}

exports.initializeBounty = function (type, h, player) {
    let bounty = {
        track: Math.floor(Math.random() * 25),
        racer: Math.floor(Math.random() * 23),
        created: Date.now(),
        completed: false,
        r_hints: h,
        t_hints: h,
        type: type
    }
    if (type == 'botd') {
        bounty.day = exports.easternTime().dayOfYear()
        bounty.r_hints = Math.floor(Math.random() * 3)
        bounty.t_hints = Math.floor(Math.random() * 3)
        bounty.bonus = Math.floor(Math.random() * 35) * 1000
    } else if (type == 'private') {
        bounty.player = player
        bounty.r_hints = h
        bounty.t_hints = h
        bounty.bonus = hints[h].bonus
    }
    return bounty
}

exports.manageTruguts = function ({ profile, profileref, transaction, amount, purchase } = {}) {
    if (transaction == 'w') {
        profile.truguts_spent += amount
    } else if (transaction == 'd') {
        profile.truguts_earned += amount
    } else if (transaction == 'r') {
        profile.truguts_spent -= amount
    }
    profileref.update(profile)
    if (transaction == 'w' && purchase) {
        profileref.child("purchases").push(purchase)
    }
    return profile
}

exports.currentTruguts = function (profile) {
    return tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent)
}

exports.randomChallengeItem = function ({ profile, profileref, current_challenge, db }) {
    const challenges_completed = Object.values(db.ch.times).filter(time => time.user == profile.discordID).length
    let item_pool = []
    let special_items = ['coffer', 'speed boost', 'sabotage']
    items.forEach(item => {
        if ((item.challenges !== null && item.challenges > challenges_completed) || current_challenge.conditions[item.condition] || item.track.includes(current_challenge.track) || item.racer.includes(current_challenge.racer)) {
            item_pool.push(item)
        }
    })

    //item rarity roll
    const rarity = Math.random()
    let rarity_pool = []
    if (rarity < 0.60) {
        rarity_pool = item_pool.filter(i => i.rarity == 'common')
    } else if (rarity < 0.85) {
        rarity_pool = item_pool.filter(i => i.rarity == 'uncommon')
    } else if (rarity < 0.95) {
        rarity_pool = item_pool.filter(i => i.rarity == 'rare')
    } else {
        rarity_pool = item_pool.filter(i => i.rarity == 'legendary')
    }

    //if no items are available of rolled rarity, default to common
    if (rarity_pool.length == 0) {
        rarity_pool = item_pool.filter(i => i.rarity == 'common')
    }

    //get random item
    let random_item = rarity_pool[Math.floor(Math.random() * rarity_pool.length)]

    //if it's a dup, there's a chance it will be replaced with a new item
    let owned_ids = rofile.items.map(item => item.id)
    if (owned_ids.includes(random_item.id) && Math.random() < 0.15) {
        let new_pool = rarity_pool.filter(item => !owned_ids.includes(item.id))
        if (new_pool.length) {
            random_item = new_pool[Math.floor(Math.random() * new_pool.length)]
        } else {
            //if there are no new items, give player a special item
            random_item = special_items[Math.floor(Math.random() * special_items.length)]
        }
    }

    return random_item
}

exports.openCoffer = function () {
    let opened_items = []

    for (let j = 0; j < 4; j++) {
        const rarity = Math.random()
        let rarity_pool = []
        if (rarity < 0.60) {
            rarity_pool = items.filter(i => i.rarity == 'common')
        } else if (rarity < 0.85) {
            rarity_pool = items.filter(i => i.rarity == 'uncommon')
        } else if (rarity < 0.95) {
            rarity_pool = items.filter(i => i.rarity == 'rare')
        } else {
            rarity_pool = items.filter(i => i.rarity == 'legendary')
        }

        let random_item = rarity_pool[Math.floor(Math.random() * rarity_pool.length)]

        let owned_ids = rofile.items.map(item => item.id)
        if (owned_ids.includes(random_item.id) && Math.random() < 0.15) {
            let new_pool = rarity_pool.filter(item => !owned_ids.includes(item.id))
            if (new_pool.length) {
                random_item = new_pool[Math.floor(Math.random() * new_pool.length)]
            }
        }
        opened_items.push(random_item)
    }

    return opened_items
}
