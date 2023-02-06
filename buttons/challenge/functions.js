const { racers, tracks, planets, playerPicks, movieQuotes, circuits, multipliers, racer_hints, track_hints } = require('../../data.js')
const tools = require('../../tools.js')
const { truguts, swe1r_guild, tips, goal_symbols, settings_default, achievement_data, winnings_map, hints } = require('./data.js')
const { postMessage } = require('../../discord_message.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

exports.getGoalTimes = function ({ track, racer, skips, nu, laps, backwards } = {}) {
    let upg = nu ? 0 : 5
    if (skips) {
        return [
            tools.timetoSeconds(tracks[track].parskiptimes[0]) * multipliers[0].skips_multiplier,
            tools.timetoSeconds(tracks[track].parskiptimes[1]) * multipliers[1].skips_multiplier,
            tools.timetoSeconds(tracks[track].parskiptimes[2]) * multipliers[2].skips_multiplier,
            tools.timetoSeconds(tracks[track].parskiptimes[3]) * multipliers[3].skips_multiplier,
            tools.timetoSeconds(tracks[track].parskiptimes[4]) * multipliers[4].skips_multiplier
        ]
    } else {
        return [
            tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.02, uh_mod: 1.05, us_mod: 1.05, deaths: 0.25 + .25 * tracks[track].difficulty }),
            tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.05, uh_mod: 1.10, us_mod: 1.10, deaths: 0.3 + .4 * tracks[track].difficulty }),
            tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.10, uh_mod: 1.15, us_mod: 1.15, deaths: 0.5 + .75 * tracks[track].difficulty }),
            tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.18, uh_mod: 1.30, us_mod: 1.30, deaths: 0.5 + 1.5 * tracks[track].difficulty }),
            tools.getGoalTime({ track, racer, acceleration: upg, top_speed: upg, cooling: upg, laps, length_mod: 1.25, uh_mod: 1.45, us_mod: 1.45, deaths: 0.5 + 2 * tracks[track].difficulty })
        ]
    }
}

exports.trugutsEarned = function (player) {
    var keys = Object.keys(challengetimedata)
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
        if (challengetimedata[k].user == player) {
            var goals = getGoalTimes(challengetimedata[k].track, challengetimedata[k].racer, challengetimedata[k].skips, challengetimedata[k].nu, challengetimedata[k].laps)
            var winnings = 1
            if (challengetimedata[k].settings !== undefined) {
                winnings = challengetimedata[k].settings.winnings
            }
            var goal_earnings = [
                circuits[tracks[challengetimedata[k].track].circuit].winnings[winnings][0],
                circuits[tracks[challengetimedata[k].track].circuit].winnings[winnings][1],
                circuits[tracks[challengetimedata[k].track].circuit].winnings[winnings][2],
                circuits[tracks[challengetimedata[k].track].circuit].winnings[winnings][3],
                0
            ]
            var winnings = 0
            for (var j = goals.length - 1; j > -1; j--) {
                if (challengetimedata[k].time < goals[j]) {
                    winnings = goal_earnings[j]
                }
            }
            report.earnings += winnings
            if (challengetimedata[k].settings == undefined) {
                if (challengetimedata[k].skips) {
                    report.non_standard++
                }
                if (challengetimedata[k].mirror) {
                    report.non_standard++
                }
                if (challengetimedata[k].laps !== 3) {
                    report.non_standard++
                }
                if (challengetimedata[k].nu) {
                    report.non_standard++
                }
            } else {
                if (challengetimedata[k].skips && challengetimedata[k].settings.skips <= 25) {
                    report.non_standard++
                }
                if (challengetimedata[k].mirror && challengetimedata[k].settings.mirror_mode <= 25) {
                    report.non_standard++
                }
                if (challengetimedata[k].laps !== 3 && challengetimedata[k].settings.non_3_lap <= 25) {
                    report.non_standard++
                }
                if (challengetimedata[k].nu && challengetimedata[k].settings.no_upgrades <= 25) {
                    report.non_standard++
                }
            }

            if (challengetimedata[k].mp == true) {
                report.mp++
            }
            var first = true
            var pb = false
            var beat = []
            for (var p = 0; p < keys.length; p++) {
                var n = keys[p]
                if (challengetimedata[n].track == challengetimedata[k].track && challengetimedata[n].racer == challengetimedata[k].racer && challengetimedata[n].skips == challengetimedata[k].skips && challengetimedata[n].nu == challengetimedata[k].nu && challengetimedata[n].laps == challengetimedata[k].laps && challengetimedata[n].mirror == challengetimedata[k].mirror) {
                    if (challengetimedata[n].date < challengetimedata[k].date) {
                        first = false
                        if (challengetimedata[n].user == player) {
                            pb = true
                            if (challengetimedata[n].time < challengetimedata[k].time) {
                                pb = false
                            }
                        }
                    }
                    if (challengetimedata[n].user !== player && challengetimedata[n].time > challengetimedata[k].time && challengetimedata[n].date < challengetimedata[k].date && !beat.includes(challengetimedata[n].user)) {
                        beat.push(challengetimedata[n].user)
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
    var keys = Object.keys(feedbackdata)
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i]
        if (feedbackdata[k].user == player) {
            feedback[feedbackdata[k].track + " " + feedbackdata[k].racer + " " + feedbackdata[k].skips + " " + feedbackdata[k].nu + " " + feedbackdata[k].laps + " " + feedbackdata[k].mirror] = 0
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
            mirror_mode: 5,
            backwards: 0,
            no_upgrades: 15,
            non_3_lap: 5,
            skips: 25,
            winnings: 1,
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

exports.initializeUser = function (ref, id) {
    let data = {
        discordID: id
    }
    const push = ref.push(data)
    return push.key
}

exports.initializeChallenge = function ({ profile, member, interaction, type, name, avatar, user, circuit } = {}) {
    //get values
    let random_racer = Math.floor(Math.random() * 23)
    let trackpool = []
    for (let i = 0; i < 25; i++) {
        if ([undefined, null].includes(circuit)) {
            trackpool.push(i)
        } else if (tracks[i].circuit == cicuit) {
            trackpool.push(i)
        }
    }
    let random_track = trackpool[Math.floor(Math.random() * trackpool.length)]
    let alt_laps = [1, 2, 4, 5]

    //set default odds
    let odds = {
        skips: (type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.skips : settings_default.skips) / 100,
        no_upgrades: (type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.no_upgrades : settings_default.no_upgrades) / 100,
        non_3_lap: (type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.non_3_lap : settings_default.non_3_lap) / 100,
        mirrored: (type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.mirror_mode : settings_default.mirror_mode) / 100,
        backwards: (type == 'multiplayer' ? 0 : type == 'private' ? profile.settings.backwards : settings_default.backwards) / 100,
    }

    let skips = tracks[random_track].parskiptimes ? Math.random() < odds.skips : false
    let nu = Math.random() < odds.no_upgrades
    let laps = Math.random() < odds.non_3_lap ? alt_laps[Math.floor(Math.random() * 4)] : 3
    let mirror = Math.random() < odds.mirrored
    let backwards = Math.random() < odds.backwards

    //initialize challenge
    let challenge = {
        type: type,
        created: Date.now(),
        channel: interaction.message.channelId,
        guild: interaction.guildId,
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
        hunt_bonus: 0
    }
    if (type == 'private') {
        challenge.player = { member: member, name: name, avatar: avatar, user: user }
    }
    return challenge
}

exports.expiredEmbed = function () {
    const holdUp = new EmbedBuilder()
        .setTitle("<:WhyNobodyBuy:589481340957753363> Expired Challenge")
        .setDescription("Sorry, this challenge is no longer available for submissions.")
    return holdUp
}

exports.isActive = function (current_challenge) {
    let intime = Date.now() - 15 * 60 * 1000 < current_challenge.created
    let intime_day = Date.now() - 24 * 60 * 60 * 1000 < current_challenge.created
    return ((current_challenge.type == 'abandoned' && !current_challenge.submissions) ||
        (['open', 'cotd'].includes(current_challenge.type) && intime_day) ||
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
    let prefix = current_challenge.hunt ? ":dart: Challenge Bounty: " : ""
    let racer_flag = current_challenge.racer_bribe ? ":moneybag:" : racers[current_challenge.racer].flag
    let track_flag = current_challenge.track_bribe ? ":moneybag:" : planets[tracks[current_challenge.track].planet].emoji
    let status = current_challenge.rerolled ? ":arrows_counterclockwise: Rerolled: " : current_challenge.completed ? ":white_check_mark: Completed: " : ''
    let title = status + prefix + (current_challenge.rerolled ? "~~" : "") + "Race as **" + bribed_racer + racer_flag + " " + racers[current_challenge.racer].name + bribed_racer + "**" + nutext + " on **" + bribed_track + track_flag + " " + tracks[current_challenge.track].name + bribed_track + "**" + laptext + skipstext + mirrortext + backwardstext + (current_challenge.rerolled ? "~~" : "")
    return title
}

exports.generateChallengeDescription = function (current_challenge, best, profile, name) {
    let desc = ''
    let duration = ['abandoned', 'multiplayer', 'private'].includes(current_challenge.type) ? 1000 * 60 * 15 : 1000 * 60 * 60 * 24
    if (current_challenge.type !== 'abandoned') {
        desc += "Expires <t:" + Math.round((current_challenge.created + duration) / 1000) + ":R>\n"
    }

    if (Math.random() < 0.20 && best.length > 0) {
        desc = desc + "*The current record-holder for this challenge is... " + best[0].name + "!*"
    } else if (Math.random() < 0.50 && current_challenge.player) {
        desc = desc + playerPicks[Math.floor(Math.random() * playerPicks.length)].replace("replaceme", current_challenge.player.name)
    } else {
        desc = desc + movieQuotes[Math.floor(Math.random() * movieQuotes.length)]
    }

    if (current_challenge.backwards) {
        desc += '\n [Click here to download the patch for backwards tracks.](https://www.speedrun.com/resourceasset/1aada)'
    }

    let crossout = ''
    if (current_challenge.hunt && !current_challenge.completed) {
        desc += "\nYou found the Challenge Bounty! Complete the challenge to earn a `📀" + tools.numberWithCommas(profile.hunt.bonus) + "` bonus"
        crossout = '~~'
    }
    if (current_challenge.racer_bribe) {
        desc += crossout + "\nBribed racer `-📀" + tools.numberWithCommas(truguts.bribe_racer) + "`" + crossout
    }
    if (current_challenge.track_bribe) {
        desc += crossout + "\nBribed track `-📀" + tools.numberWithCommas(truguts.bribe_track) + "`" + crossout
    }
    return desc
}

exports.getPredictors = function (current_challenge) {
    return current_challenge.predictions ? "🔮 " + Object.values(current_challenge.predictions).map(p => p.name).join(", ") : ""
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
    return challenge1.track == challenge2.track &&
        challenge1.racer == challenge2.racer &&
        challenge1.conditions.laps == challenge2.conditions.laps &&
        challenge1.conditions.mirror == challenge2.conditions.mirror &&
        challenge1.conditions.nu == challenge2.conditions.nu &&
        challenge1.conditions.skips == challenge2.conditions.skips &&
        challenge1.conditions.backwards == challenge2.conditions.backwards
}

exports.getFeedbackTally = function (feedbackdata, current_challenge) {
    //tally likes and dislikes
    let like = 0, dislike = 0
    Object.keys(feedbackdata).forEach(key => {
        if (exports.matchingChallenge(feedbackdata[key], current_challenge)) {
            if (feedbackdata[key].feedback == "👍") {
                like++
            } else if (feedbackdata[key].feedback == "👎") {
                dislike++
            }
        }
    })
    return (like ? "`👍" + like + "` " : "") + (dislike ? "`👎" + dislike + "` " : "")
}

exports.goalTimeList = function (current_challenge, profile) {
    //calculate goal time
    let goals = exports.getGoalTimes(
        {
            track: current_challenge.track,
            racer: current_challenge.racer,
            skips: current_challenge.conditions.skips,
            nu: current_challenge.conditions.nu,
            laps: current_challenge.conditions.laps,
            backwards: current_challenge.conditions.backwards
        })
    let goal_earnings = []
    for (let i = 0; i < 4; i++) {
        let earning = Math.round(circuits[tracks[current_challenge.track].circuit].winnings[profile.settings.winnings][i] * (current_challenge.type == 'abandoned' ? 0.5 : 1))
        goal_earnings.push(earning)
    }
    goal_earnings.push(0)
    let goalTimes = ''
    for (let i = 0; i < 5; i++) {
        goalTimes += goal_symbols[i] + " " + tools.timefix(goals[i]) + (goal_earnings[i] ? "  `+📀" + tools.numberWithCommas(goal_earnings[i]) + "`" : '') + "\n"
    }
    return { list: goalTimes, times: goals, earnings: goal_earnings }
}

exports.generateLeaderboard = function (best, member, current_challenge) {
    let besttimes = "Be the first to submit a time for this challenge! \n `+📀" + tools.numberWithCommas(truguts.first) + "`"
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
        best.sort(function (a, b) {
            return a.time - b.time;
        })
        besttimes = ""
        let already = []
        let submission = current_challenge.submissions && current_challenge.type == 'private' ? current_challenge.submissions[current_challenge.player.member].time : null
        for (let i = 0; i < best.length; i++) {
            if (best[i].prediction || !already.includes(best[i].user) || (best[i].user == member && current_challenge.type == 'private')) {
                let bold = ((best[i].user == member && current_challenge.type == 'private') || best[i].date == current_challenge.created) ? "**" : ""
                besttimes += (best[i].prediction ? "🔮 *" : pos[0]) + bold + tools.timefix(best[i].time) + " - " + best[i].name + bold +
                    (best[i].notes ? " `" + best[i].notes + "`" : "") +
                    (best[i].prediction ? " `+📀" + exports.predictionScore(best[i].time, submission) + "`*" : "") +
                    (!['private', 'abandoned'].includes(current_challenge.type) && current_challenge?.earnings?.[best[i].user] ? " `+📀" + tools.numberWithCommas(current_challenge.earnings?.[best[i].user]?.truguts_earned) + "`" : "") +
                    (best[i].date == current_challenge.created ? " <a:newrecord:672640831882133524>" : "") + "\n"
                if (!best[i].prediction) {
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

exports.achievementProgress = function ({ challengetimedata, player } = {}) {
    let achievements = { ...achievement_data }

    Object.keys(achievements).forEach(key => {
        achievements[key].count = 0
        achievements[key].collection = {}
        achievements[key].array = []
        achievements[key].missing = []
    })

    Object.keys(challengetimedata).forEach(key => {
        if (challengetimedata[key].user == player) { //get achievement progress
            achievements.galaxy_famous.collection[String(challengetimedata[key].track)] = 1
            achievements.pod_champ.collection[String(challengetimedata[key].racer)] = 1
            if (challengetimedata[key].conditions.skips) {
                achievements.light_skipper.collection[String(challengetimedata[key].track)] = 1
            }
            if (challengetimedata[key].conditions.nu) {
                achievements.slow_steady.collection[String(challengetimedata[key].racer)] = 1
            }
            if (challengetimedata[key].conditions.mirror) {
                achievements.mirror_dimension.collection[String(challengetimedata[key].track)] = 1
            }
            if (challengetimedata[key].conditions.backwards) {
                achievements.backwards_compatible.collection[String(challengetimedata[key].track)] = 1
            }
            if (challengetimedata[key].conditions.laps !== 3) {
                achievements.lap_god.count += Number(challengetimedata[key].conditions.laps)
            }
            if (challengetimedata[key].racer == tracks[String(challengetimedata[key].track)].favorite) {
                achievements.crowd_favorite.collection[String(challengetimedata[key].track)] = 1
            }
            achievements.true_jedi.collection[String(challengetimedata[key].track + " " + challengetimedata[key].racer)] = 1
        }
    })

    Object.keys(achievements).forEach(key => {
        if (!achievements[key].count) {
            achievements[key].count = Object.values(achievements[key].collection).length
        }
    })

    return achievements
}

exports.challengeAchievementProgress = function ({ client, current_challenge, interaction, profile, profileref, achievements } = {}) {

    let achievement_message_array = []
    if (Object.keys(achievements.galaxy_famous.collection).length < achievements.galaxy_famous.limit && !achievements.galaxy_famous.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.galaxy_famous.role + ">" : achievements.galaxy_famous.name,
            count: Object.keys(achievements.galaxy_famous.collection).length,
            limit: achievements.galaxy_famous.limit
        })
    }
    if (Object.keys(achievements.pod_champ.collection).length < achievements.pod_champ.limit && !achievements.pod_champ.collection[current_challenge.racer]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.pod_champ.role + ">" : achievements.pod_champ.name,
            count: Object.keys(achievements.pod_champ.collection).length,
            limit: achievements.pod_champ.limit
        })
    }
    if (Object.keys(achievements.light_skipper.collection).length < achievements.light_skipper.limit && current_challenge.conditions.skips && !achievements.light_skipper.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.light_skipper.role + ">" : achievements.light_skipper.name,
            count: Object.keys(achievements.light_skipper.collection).length,
            limit: achievements.light_skipper.limit
        })
    }
    if (Object.keys(achievements.slow_steady.collection).length < achievements.slow_steady.limit && current_challenge.conditions.nu && !achievements.slow_steady.collection[current_challenge.racer]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.slow_steady.role + ">" : achievements.slow_steady.name,
            count: Object.keys(achievements.slow_steady.collection).length,
            limit: achievements.slow_steady.limit
        })
    }
    if (Object.keys(achievements.mirror_dimension.collection).length < achievements.mirror_dimension.limit && current_challenge.conditions.mirror && !achievements.mirror_dimension.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.mirror_dimension.role + ">" : achievements.mirror_dimension.name,
            count: Object.keys(achievements.mirror_dimension.collection).length,
            limit: achievements.mirror_dimension.limit
        })
    }
    if (achievements.lap_god.count < achievements.lap_god.limit && current_challenge.conditions.laps !== 3) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.lap_god.role + ">" : achievements.lap_god.name,
            count: achievements.lap_god.count,
            limit: achievements.lap_god.limit
        })
    }
    if (Object.keys(achievements.backwards_compatible.collection).length < achievements.backwards_compatible.limit && current_challenge.conditions.backwards && !achievements.backwards_compatible.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.backwards_compatible.role + ">" : achievements.backwards_compatible.name,
            count: Object.keys(achievements.backwards_compatible.collection).length,
            limit: achievements.backwards_compatible.limit
        })
    }
    if (Object.keys(achievements.crowd_favorite.collection).length < achievements.crowd_favorite.limit && current_challenge.racer == tracks[current_challenge.track].favorite && !achievements.crowd_favorite.collection[current_challenge.track]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.crowd_favorite.role + ">" : achievements.crowd_favorite.name,
            count: Object.keys(achievements.crowd_favorite.collection).length,
            limit: achievements.crowd_favorite.limit
        })
    }
    if (Object.keys(achievements.true_jedi.collection).length < achievements.true_jedi.limit && !achievements.true_jedi.collection[current_challenge.track + " " + current_challenge.racer]) {
        achievement_message_array.push({
            name: interaction.guildId == swe1r_guild ? "<@&" + achievements.true_jedi.role + ">" : achievements.true_jedi.name,
            count: Object.keys(achievements.true_jedi.collection).length,
            limit: achievements.true_jedi.limit
        })
    }
    let achievement_progress = ''
    achievement_message_array.forEach((ach, index) => {
        achievement_progress += "**" + ach.name + "** `" + ach.count + "/" + ach.limit + "` " + (index !== achievement_message_array.length - 1 ? "○ " : "")
    })
    exports.awardAchievements({ client, interaction, achievements, profile, profileref })
    return achievement_progress
}

exports.challengeColor = function (current_challenge) {
    //color conditions
    let color = planets[tracks[current_challenge.track].planet].color

    if (current_challenge.rerolled) {
        color = "3B88C3"
    } else if (current_challenge.completed) {
        color = "77B255"
    } else if (current_challenge.type == 'abandoned') {
        color = "4d4d4d"
    }
    return color
}

exports.awardAchievements = function ({ client, interaction, achievements, profile, profileref } = {}) {
    Object.keys(achievements).forEach(key => {
        if (Object.keys(achievements[key].collection).length >= achievements[key].limit || achievements[key].count >= achievements[key].limit) { //if player has met condition for achievement
            if (interaction.guildId == swe1r_guild) {
                if (client.member.roles.cache.some(r => r.id === achievements[key].role)) { //award role
                    client.member.roles.add(achievements[key].role).catch(error => console.log(error))
                }
            }
            if (!profile.achievements[key]) { //send congrats
                profileref.child("achievements").child(key).set(true)
                const congratsEmbed = new EmbedBuilder()
                    .setAuthor({ name: interaction.member.displayName + " got an achievement!", iconURL: client.guilds.resolve(interaction.guildId).members.resolve(interaction.member.user.id).displayAvatarURL() })
                    .setDescription(achievements[key].description)
                    .setColor("FFB900")
                    .setTitle("**:trophy: " + achievements[key].name + "**")
                if (interaction.guildId == swe1r_guild) {
                    congratsEmbed.setDescription("**<@&" + achievements[key].role + ">** - " + achievements[key].description)
                }
                postMessage(client, interaction.channel.id, { embeds: [congratsEmbed] })
            }
        }
    })
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
    if (current_challenge.hunt) {
        earnings += "Bounty Bonus `+📀" + tools.numberWithCommas(profile.hunt.bonus) + "`\n"
        earnings_total += profile.hunt.bonus
    }
    if (goals.earnings[winnings_text] > 0) {
        earnings += goal_symbols[winnings_text] + " `+📀" + tools.numberWithCommas(goals.earnings[winnings_text]) + "`\n"
        earnings_total += goals.earnings[winnings_text]
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
        earnings += "Non-Standard `+📀" + tools.numberWithCommas(truguts.non_standard) + " × " + winnings_non_standard + "`\n"
        earnings_total += truguts.non_standard * winnings_non_standard
    }
    let first = true, pb = false, beat = []
    for (let i = 0; i < best.length; i++) {
        if (best[i].date < submitted_time.date) {
            first = false
            if (best[i].user == member && best[i].date !== submitted_time.date && submitted_time.time < best[i].time) {
                pb = true
            }
        }
        if (best[i].user !== member && submitted_time.time - best[i].time < 0 && !beat.includes(best[i].user)) {
            beat.push(best[i].user)
        }
    }
    if (tracks[current_challenge.track].lengthclass == 'Long' && !current_challenge.conditions.skips) {
        earnings += "Long `+📀" + tools.numberWithCommas(truguts.long) + "`\n"
        earnings_total += truguts.long
    }
    if (tracks[current_challenge.track].lengthclass == 'Extra Long' && !current_challenge.conditions.skips) {
        earnings += "Extra Long `+📀" + tools.numberWithCommas(truguts.extra_long) + "`\n"
        earnings_total += truguts.extra_long
    }
    if (beat.length) {
        earnings += "Beat Opponent `+📀" + tools.numberWithCommas(truguts.beat_opponent) + " × " + beat.length + "`\n"
        earnings_total += truguts.beat_opponent * beat.length
    }
    if (pb) {
        earnings += "PB `+📀" + tools.numberWithCommas(truguts.personal_best) + "`\n"
        earnings_total += truguts.personal_best
    }

    if (first) {
        earnings += "First `+📀" + tools.numberWithCommas(truguts.first) + "`\n"
        earnings_total += truguts.first
    }
    if (current_challenge?.ratings?.[member]) {
        earnings += "Rated `+📀" + tools.numberWithCommas(truguts.rated) + "`\n"
        earnings_total += truguts.rated
    }
    if (profile.streak_start) {
        let streak = Math.floor((profile.streak_end - profile.streak_start) / (1000 * 60 * 60 * 24))
        if (streak > 0) {
            earnings += streak + "-Day Streak `+📀" + tools.numberWithCommas(truguts.streak * streak) + "`\n"
            earnings_total += truguts.streak * streak
        }
    }
    earnings += "\n**Total: **`+📀" + tools.numberWithCommas(earnings_total) + "`"
    return { earnings: earnings_total, receipt: earnings }
}

exports.getBest = function (challengetimedata, current_challenge) {
    let best = []
    Object.keys(challengetimedata).forEach(key => {
        if (exports.matchingChallenge(challengetimedata[key], current_challenge)) { //get leaderboard
            best.push(challengetimedata[key])
        }
    })
    return best.sort(function (a, b) {
        return a.time - b.time;
    })
}

exports.updateChallenge = function ({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction } = {}) {
    record_holder = false
    let player = member
    let player_name = name
    let player_profile = profile
    let player_avatar = avatar

    if (current_challenge.type == 'private') {
        player = current_challenge.player.member
        player_name = current_challenge.player.name
        let player_user = current_challenge.player.user
        player_profile = userdata[player_user].random
        player_avatar = current_challenge.player.avatar
    }

    let best = exports.getBest(challengetimedata, current_challenge)
    let played = best.map(b => b.user).includes(player)

    if (best.length > 0 && best[0].user == player) {
        record_holder = true
    }

    //check if current challenge satisfies hunt
    if (current_challenge.hunt &&
        current_challenge.racer == profile.hunt.racer &&
        current_challenge.track == profile.hunt.track &&
        !profile.hunt.completed && Date.now() - 3600000 <= profile.hunt.date) {
        current_challengeref.update({ hunt: true })

        //refund bribe
        if (!current_challenge.refunded) {
            if (current_challenge.racer_bribe) {
                profileref.update({ truguts_spent: profile.truguts_spent - truguts.bribe_racer })
            }
            if (current_challenge.track_bribe) {
                profileref.update({ truguts_spent: profile.truguts_spent - truguts.bribe_track })
            }
            current_challengeref.update({ refunded: true })
        }

        if (current_challenge.completed) {
            current_challengeref.update({ hunt_bonus: profile.hunt.bonus })
            profileref.child("hunt").update({ completed: true })
        }
    }

    if (!current_challenge.reroll_cost) { //set reroll cost
        current_challenge.reroll_cost = record_holder ? "free" : played ? "discount" : "full price"
    }

    let data = {
        message: exports.challengeEmbed({ client, current_challenge, current_challengeref, profile: player_profile, profileref, feedbackdata, best, name: player_name, member: player, avatar: player_avatar, interaction, challengetimedata }),
        components: exports.challengeComponents(current_challenge, profile)
    }
    return data
}

exports.rerollReceipt = function (current_challenge) {
    let reroll_cost = current_challenge.reroll_cost
    return {
        receipt: reroll_cost == 'discount' ? "`-📀" + tools.numberWithCommas(truguts.reroll_discount) + "` (discounted)" : (reroll_cost == 'free' ? "(no charge for record holders)" : "`-📀" + tools.numberWithCommas(truguts.reroll) + "`"),
        cost: reroll_cost == 'discount' ? truguts.reroll_discount : (reroll_cost == 'free' ? 0 : truguts.reroll)
    }
}

exports.checkActive = function (challengesdata, member, current_challenge) {
    let occupied = null
    let result = null
    Object.keys(challengesdata).forEach(key => {
        let challenge = challengesdata[key]
        if (challenge.player?.member == member && challenge.type == 'private' && exports.isActive(challenge) && ((current_challenge && current_challenge.message !== challenge.message) || !current_challenge)) {
            challenge.message = key
            occupied = challenge
        }
    })
    if (occupied && Object.keys(occupied).length) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Forgetting something?")
            .setDescription(`You have an incomplete active challenge in <#${occupied.channel}>.\n[Click this link](https://discord.com/channels/${occupied.guild}/${occupied.channel}/${occupied.message}) to return to your challenge or wait for it to expire <t:${Math.round(occupied.created / 1000) + 15 * 60}:R>`)
        result = holdUp
    }
    return result
}

exports.challengeEmbed = function ({ current_challenge, profile, current_challengeref, profileref, feedbackdata, best, name, member, avatar, interaction, challengetimedata, client } = {}) {
    let submitted_time = challengetimedata[current_challenge?.submissions?.[member]?.id] ?? {}
    let achs = exports.achievementProgress({ challengetimedata, player: member })

    const challengeEmbed = new EmbedBuilder()
        .setTitle(exports.generateChallengeTitle(current_challenge))
        .setColor(exports.challengeColor(current_challenge))
        .setDescription(exports.getFeedbackTally(feedbackdata, current_challenge) + exports.generateChallengeDescription(current_challenge, best, profile, name) + (current_challenge.type == 'private' ? "\n" + exports.challengeAchievementProgress({ client, current_challenge, interaction, profile, profileref, achievements: achs }) : '') + (current_challenge.predictions && !current_challenge.completed ? "\n" + exports.getPredictors(current_challenge) : ""))

    if (current_challenge.type == 'multiplayer') {
        challengeEmbed
            .setAuthor({ name: "Multiplayer Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/chequered-flag_1f3c1.png" })
    } else if (current_challenge.type == 'abandoned') {
        challengeEmbed
            .setAuthor({ name: "Abandoned Challenge", iconURL: 'https://em-content.zobj.net/thumbs/120/twitter/322/dashing-away_1f4a8.png' })
    } else {
        challengeEmbed
            .setFooter({ text: "Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent) })
            .setAuthor({ name: name + "'s Random Challenge", iconURL: avatar })
    }
    let goals = exports.goalTimeList(current_challenge, profile)
    if (current_challenge.rerolled) {
        let reroll = exports.rerollReceipt(current_challenge)
        challengeEmbed.setDescription(reroll.receipt)
    } else if (current_challenge.completed && ['private', 'abandoned'].includes(current_challenge.type)) {
        let winnings = exports.challengeWinnings({ current_challenge, current_challengeref, profile, profileref, submitted_time, best, goals, member })
        challengeEmbed
            .addFields({ name: "Winnings", value: winnings.receipt, inline: true })
            .setFooter({ text: "Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent) })
    } else {
        challengeEmbed.addFields({ name: "Goal Times", value: goals.list, inline: true })
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
    let current_truguts = profile.truguts_earned - profile.truguts_spent
    if (!current_challenge.submissions || !['abandoned', 'private'].includes(current_challenge.type)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_modal")
                .setLabel("Submit")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⏱️")
        )
    }
    if (current_challenge.type == "private" && !current_challenge.completed) {
        if (current_truguts >= reroll.cost) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("challenge_random_reroll")
                    .setLabel(reroll.cost == 0 ? 'free' : "📀" + tools.numberWithCommas(reroll.cost))
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
                .setEmoji("🎲")
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

exports.bribeComponents = function (current_challenge) {
    const trackBribeRow = new ActionRowBuilder()
    const racerBribeRow = new ActionRowBuilder()
    const track_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_bribe_track')
        .setPlaceholder("Bribe Track (📀" + tools.numberWithCommas(truguts.bribe_track) + ")")
        .setMinValues(1)
        .setMaxValues(1)
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
    const racer_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_bribe_racer')
        .setPlaceholder("Bribe Racer (📀" + tools.numberWithCommas(truguts.bribe_racer) + ")")
        .setMinValues(1)
        .setMaxValues(1)

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
    trackBribeRow.addComponents(track_selector)
    racerBribeRow.addComponents(racer_selector)
    return [(!current_challenge.track_bribe ? trackBribeRow : []), (!current_challenge.racer_bribe ? racerBribeRow : [])]
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
                .setCustomId("challenge_random_hint_initial")
                .setLabel("Hints")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💡')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_hunt_initial")
                .setLabel("Bounty")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎯')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_sponsor")
                .setLabel("Sponsor")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📢')
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
                .setCustomId("challenge_random_leaderboards_initial")
                .setLabel("Leaderboards")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏆')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_about")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❔')
        )
    return [row1, row2]
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
        .setDescription("This is a private challenge. The option you selected is only available to the player who rolled this challenge. You may roll your own with the button below.")
    return noMoney
}

exports.hintEmbed = function ({ profile, name, avatar } = {}) {
    const hintEmbed = new EmbedBuilder()
        .setTitle(":bulb: Hints")
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setColor("#ED4245")
        .setDescription("Hints help you narrow down what challenges you need to complete for :trophy: **Achievements**. The more you pay, the better the hint.")
        .setFooter({ text: name + " | Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent), iconURL: avatar })
    return hintEmbed
}

exports.hintComponents = function (achievements, profile, achievement_keys, achievement, selection) {
    const achievement_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_hint_achievement')
        .setPlaceholder("Select Achievement")
        .setMinValues(1)
        .setMaxValues(1)
    for (let i = 0; i < achievement_keys.length; i++) {
        achievement_selector.addOptions({
            label: achievements[achievement_keys[i]].name,
            value: achievement_keys[i],
            description: achievements[achievement_keys[i]].description + ": " + achievements[achievement_keys[i]].count + "/" + achievements[achievement_keys[i]].limit,
            emoji: {
                name: "🏆"
            },
            default: achievement == achievement_keys[i]
        })
    }
    const hint_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_hint_selection')
        .setPlaceholder("Select Hint")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < hints.length; i++) {
        if (profile.truguts_earned - profile.truguts_spent >= hints[i].price) {
            hint_selector.addOptions(
                {
                    label: hints[i].name,
                    value: achievement + ":" + i,
                    description: "📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description,
                    emoji: {
                        name: "💡"
                    },
                    default: selection == i
                }
            )
        }
    }

    const row1 = new ActionRowBuilder().addComponents(achievement_selector)
    const row2 = new ActionRowBuilder().addComponents(hint_selector)
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("challenge_random_hint_purchase_" + (achievement ? achievement.replace("_", "-") + ":" + selection : ""))
            .setLabel("Buy Hint")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⏱️")
            .setDisabled([achievement, selection].includes(null))
    )
    return [row1, row2, row3]

}

exports.huntEmbed = function (profile) {
    const huntEmbed = new EmbedBuilder()
        .setTitle(":dart: Challenge Bounty")
        .setAuthor({ name: "Random Challenge", iconURL: "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png" })
        .setDescription("Challenge Bounty is a way to earn big truguts fast. Based on your hint selection, Botto hides a large trugut bonus on a random challenge. You have one hour to find and complete this challenge to claim your bonus.")
        .setFooter({ text: "Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent) })
        .setColor("#ED4245")

    return huntEmbed
}

exports.huntComponents = function (profile, selection) {
    const hint_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_hunt_selection')
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
                    },
                    default: selection == i
                }
            )
        }
    }
    const row1 = new ActionRowBuilder().addComponents(hint_selector)
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("challenge_random_hunt_start_" + selection)
            .setLabel("Start Bounty")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(selection === null)
    )
    return [row1, row2]
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
        skips: profile.settings.skips + "%" + (profile.settings.skips > 0 && profile.settings.skips <= 25 ? " 📀" : ""),
        no_upgrades: profile.settings.no_upgrades + "%" + (profile.settings.no_upgrades > 0 && profile.settings.no_upgrades <= 25 ? " 📀" : ""),
        non_3_lap: profile.settings.non_3_lap + "%" + (profile.settings.non_3_lap > 0 && profile.settings.non_3_lap <= 25 ? " 📀" : ""),
        mirror_mode: profile.settings.mirror_mode + "%" + (profile.settings.mirror_mode > 0 && profile.settings.mirror_mode <= 25 ? " 📀" : ""),
        backwards: profile.settings.backwards + "%" + (profile.settings.backwards > 0 && profile.settings.backwards <= 25 ? " 📀" : "")
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
    let h = [...racer_hints]
    let racer_hint = h[racer]
    let hs = []
    for (let i = 0; i < count + 1; i++) {
        let random_hint = Math.floor(Math.random() * racer_hint.length)
        hs.push(racer_hint[random_hint])
        racer_hint.splice(random_hint, 1)
    }
    return hs
}

exports.trackHint = function (track, count) {
    let h = [...track_hints]
    let track_hint = h[track]
    let hs = []
    for (let i = 0; i < count + 1; i++) {
        let random_hint = Math.floor(Math.random() * track_hint.length)
        hs.push(track_hint[random_hint])
        track_hint.splice(random_hint, 1)
    }
    return hs
}

exports.sponsorEmbed = function (sponsorchallenge, profile, page) {
    const sponsorEmbed = new EmbedBuilder()
        .setTitle(":loudspeaker: Sponsor")
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setDescription("Step 1: Select a circuit to sponsor\nStep 2: Set a custom title and time\nStep 3: Publish your challenge and get players to complete it\nStep 4: Profit")
        .setFooter({ text: "Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent) })
        .setColor("#ED4245")
    let title = "**" + sponsorchallenge.title + "**" ?? "No title set"
    let time = "**" + tools.timefix(sponsorchallenge.time) + "**" ?? "No time set"
    console.log(title, time)
    if (page) {
        sponsorEmbed.addFields(
            { name: ":game_die: Challenge: ", value: exports.generateChallengeTitle(sponsorchallenge) },
            { name: ":label: Custom Title: " + title, value: "This will go above the challenge title." },
            { name: ":stopwatch: Custom Time: " + time, value: "Players who beat this sponsor time will get a special bonus. Please make it achievable." }
        )
    }
    return sponsorEmbed
}

exports.sponsorComponents = function (profile, selection, page) {
    const row1 = new ActionRowBuilder()
    const row2 = new ActionRowBuilder()
    const circuit_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_sponsor_circuit')
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
                    default: selection == i
                }
            )
        }
    }
    if (page == 0) {
        row1.addComponents(circuit_selector)
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_sponsor_submit_" + selection)
                .setLabel("Sponsor")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📢')
                .setDisabled(selection === null))
        return [row1, row2]
    } else {
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



}

exports.validateTime = function (time) {
    if (isNaN(Number(time.replace(":", ""))) || tools.timetoSeconds(time) == null) {
        return ''
    } else {
        return tools.timetoSeconds(time)
    }
}