const { tips, winnings_map, achievements, racers, tracks, planets, playerPicks } = require('../../data.js')
const tools = require('../../tools.js')
const { truguts, swe1r_guild } = require('./data.js')

exports.getGoalTimes = function (track, racer, skips, nu, laps, backwards) {
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
            tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.02, 1.05, 1.05, 0.25 + .25 * tracks[track].difficulty),
            tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.05, 1.10, 1.10, 0.3 + .4 * tracks[track].difficulty),
            tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.10, 1.15, 1.15, 0.5 + .75 * tracks[track].difficulty),
            tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.18, 1.30, 1.30, 0.5 + 1.5 * tracks[track].difficulty),
            tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.25, 1.45, 1.45, 0.5 + 2 * tracks[track].difficulty)
        ]
    }
}

exports.trugutsEarned = function (player) {
    var keys = Object.keys(challengedata)
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
        if (challengedata[k].user == player) {
            var goals = getGoalTimes(challengedata[k].track, challengedata[k].racer, challengedata[k].skips, challengedata[k].nu, challengedata[k].laps)
            var winnings = 1
            if (challengedata[k].settings !== undefined) {
                winnings = challengedata[k].settings.winnings
            }
            var goal_earnings = [
                circuits[tracks[challengedata[k].track].circuit].winnings[winnings][0],
                circuits[tracks[challengedata[k].track].circuit].winnings[winnings][1],
                circuits[tracks[challengedata[k].track].circuit].winnings[winnings][2],
                circuits[tracks[challengedata[k].track].circuit].winnings[winnings][3],
                0
            ]
            var winnings = 0
            for (var j = goals.length - 1; j > -1; j--) {
                if (challengedata[k].time < goals[j]) {
                    winnings = goal_earnings[j]
                }
            }
            report.earnings += winnings
            if (challengedata[k].settings == undefined) {
                if (challengedata[k].skips) {
                    report.non_standard++
                }
                if (challengedata[k].mirror) {
                    report.non_standard++
                }
                if (challengedata[k].laps !== 3) {
                    report.non_standard++
                }
                if (challengedata[k].nu) {
                    report.non_standard++
                }
            } else {
                if (challengedata[k].skips && challengedata[k].settings.skips <= 25) {
                    report.non_standard++
                }
                if (challengedata[k].mirror && challengedata[k].settings.mirror_mode <= 25) {
                    report.non_standard++
                }
                if (challengedata[k].laps !== 3 && challengedata[k].settings.non_3_lap <= 25) {
                    report.non_standard++
                }
                if (challengedata[k].nu && challengedata[k].settings.no_upgrades <= 25) {
                    report.non_standard++
                }
            }

            if (challengedata[k].mp == true) {
                report.mp++
            }
            var first = true
            var pb = false
            var beat = []
            for (var p = 0; p < keys.length; p++) {
                var n = keys[p]
                if (challengedata[n].track == challengedata[k].track && challengedata[n].racer == challengedata[k].racer && challengedata[n].skips == challengedata[k].skips && challengedata[n].nu == challengedata[k].nu && challengedata[n].laps == challengedata[k].laps && challengedata[n].mirror == challengedata[k].mirror) {
                    if (challengedata[n].date < challengedata[k].date) {
                        first = false
                        if (challengedata[n].user == player) {
                            pb = true
                            if (challengedata[n].time < challengedata[k].time) {
                                pb = false
                            }
                        }
                    }
                    if (challengedata[n].user !== player && challengedata[n].time > challengedata[k].time && challengedata[n].date < challengedata[k].date && !beat.includes(challengedata[n].user)) {
                        beat.push(challengedata[n].user)
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

exports.initializePlayer = function (ref) {
    let data = {
        settings: {
            mirror_mode: 5,
            backwards: 0,
            no_upgrades: 15,
            non_3_lap: 5,
            skips: 25,
            winnings: 1,
        },
        name: interaction.member.user.username,
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

exports.initializeChallenge = function ({ profile, player, challengeref, profileref, interaction, type } = {}) {
    //get values
    let random_racer = Math.floor(Math.random() * 23)
    let random_track = Math.floor(Math.random() * 25)
    let alt_laps = [1, 2, 4, 5]

    //set default odds
    let odds = {
        skips: type == 'mp' ? 0 : type == 'private' ? profile.skips : 25 / 100,
        no_upgrades: type == 'mp' ? 0 : type == 'private' ? profile.no_upgrades : 15 / 100,
        non_3_lap: type == 'mp' ? 0 : type == 'private' ? profile.non_3_lap : 5 / 100,
        mirrored: type == 'mp' ? 0 : type == 'private' ? profile.mirror_mode : 5 / 100,
        backwards: type == 'mp' ? 0 : type == 'private' ? profile.backwards : 0 / 100,
    }

    let skips = tracks[random_track].parskiptimes ? Math.random() < odds.skips : false
    let nu = Math.random() < odds.no_upgrades
    let laps = Math.random() < odds.non_3_lap ? alt_laps[Math.floor(Math.random() * 4)] : 3
    let mirror = Math.random() < odds.mirrored
    let backwards = Math.random() < odds.backwards

    //initialize challenge
    let challenge = {
        type: type,
        created: challengestart,
        channel: interaction.channel_id,
        players: type == "private" ? [player] : [],
        completed: false,
        rerolled: false,
        rated: false,
        track_bribe: false,
        racer_bribe: false,
        hunt: false,
        racer: random_racer,
        track: random_track,
        conditions: {
            laps: laps,
            nu: nu,
            skips: skips,
            mirror: mirror,
            backwards: backwards,
        },
        truguts: 0,
        hunt_bonus: 0,
        truguts_earned: 0
    }
    return challenge
}

exports.generateChallengeTitle = function (current_challenge) {
    let nutext = current_challenge.conditions.nu ? " with **NO UPGRADES**" : ""
    let skipstext = current_challenge.conditions.skips ? " with **SKIPS**" : ""
    let laptext = current_challenge.conditions.laps !== 3 ? " for **" + current_challenge.conditions.laps + (current_challenge.conditions.laps !== 1 ? "s" : "") : ""
    let mirrortext = current_challenge.conditions.mirror && current_challenge.conditions.backwards ? ", **MIRRORED and BACKWARDS!**" : (current_challenge.conditions.mirror ? ", **MIRRORED!**" : "")
    let backwardstext = current_challenge.conditions.backwards && !current_challenge.conditions.mirror ? ", **BACKWARDS!**" : ""
    let bribed_racer = current_challenge.racer_bribe ? "*" : ""
    let bribed_track = current_challenge.track_bribe ? "*" : ""
    let prefix = current_challenge.hunt ? ":dart: Challenge Hunt: " : ""
    let racer_flag = current_challenge.racer_bribe ? ":moneybag:" : racers[current_challenge.racer].flag
    let track_flag = current_challenge.track_bribe ? ":moneybag:" : planets[tracks[current_challenge.track].planet].emoji
    let status = current_challenge.completed ? ":white_check_mark: Completed: " : current_challenge.rerolled ? ":arrows_counterclockwise: Rerolled: " : Date.now() - 15 * 60 * 1000 > current_challenge.created ? ":negative_squared_cross_mark: Closed: " : ''
    let title = status + prefix + (current_challenge.rerolled ? "~~" : "") + "Race as **" + bribed_racer + racer_flag + " " + racers[current_challenge.racer].name + bribed_racer + "**" + nutext + " on **" + bribed_track + track_flag + " " + tracks[current_challenge.track].name + bribed_track + "**" + laptext + skipstext + mirrortext + backwardstext + (current_challenge.rerolled ? "~~" : "")
    return title
}

exports.generateChallengeDescription = function (current_challenge, best, profile, name) {
    let desc = ''
    if (Math.random() < 0.20 && best.length > 0) {
        desc = desc + "*The current record-holder for this challenge is... " + best[0].name + "!*"
    } else if (Math.random() < 0.50) {
        desc = desc + playerPicks[Math.floor(Math.random() * playerPicks.length)].replace("replaceme", name)
    } else {
        desc = desc + movieQuotes[Math.floor(Math.random() * movieQuotes.length)]
    }
    let crossout = ''
    if (current_challenge.hunt && !current_challenge.completed) {
        desc += "\nYou found the Challenge Hunt! Complete the challenge to earn a `📀" + tools.numberWithCommas(profile.hunt.bonus) + "` bonus"
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
        if (matchingChallenge(feedbackdata[key], current_challenge)) {
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
    let goals = exports.getGoalTimes(current_challenge.track, current_challenge.racer, current_challenge.skips, current_challenge.nu, current_challenge.laps, current_challenge.backwards)
    let goal_symbols = [":gem:", ":first_place:", ":second_place:", ":third_place:", "<:bumpythumb:703107780860575875>"]
    let goal_earnings = []
    for (let i = 0; i < 5; i++) {
        if (i == 4) {
            goal_earnings.push(0)
        } else {
            goal_earnings.push(circuits[tracks[current_challenge.track].circuit].winnings[profile.winnings][i])
        }
    }
    let goalTimes = ''
    for (let i = 0; i < 5; i++) {
        goalTimes += goal_symbols[i] + " " + tools.timefix(goals[i]) + goal_earnings ? "  `+📀" + tools.numberWithCommas(goal_earnings[i]) + "`" : '' + "\n"
    }
    return goalTimes
}

exports.generateLeaderboard = function (best, member) {
    let besttimes = "Be the first to submit a time for this challenge! \n `+📀" + tools.numberWithCommas(truguts.first) + "`"
    let pos = ["<:P1:671601240228233216> ", "<:P2:671601321257992204> ", "<:P3:671601364794605570> ", "4th ", "5th ", "6th ", "7th ", "8th ", "9th ", "10th "]
    if (best.length > 0) {
        besttimes = ""
        let already = []
        for (let i = 0; i < best.length; i++) {
            if (!already.includes(best[i].user) || best[i].user == member) {
                if (best[i].date == current_challenge.start) { //just submitted
                    besttimes += pos[0] + "**" + tools.timefix(best[i].time) + " - " + best[i].name + " <a:newrecord:672640831882133524>**\n"
                } else if (best[i].user == member) { //player
                    besttimes += pos[0] + "**" + tools.timefix(best[i].time) + " - " + best[i].name + "**\n"
                } else { //everybody else
                    besttimes += pos[0] + "" + tools.timefix(best[i].time) + " - " + best[i].name + "\n"
                }
                pos.splice(0, 1)
                already.push(best[i].user)
            }
            if (pos.length == 0) {
                i = best.length
            }
        }
    }
    return besttimes
}

exports.achievementProgress = function (achievements) {
    let achievement_message_array = []
    if (title !== ":white_check_mark: Completed: ") {
        if (Object.keys(achievements.galaxy_famous.collection).length < achievements.galaxy_famous.limit && !achievements.galaxy_famous.collection[current_challenge.track]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.galaxy_famous.role + ">" : achievements.galaxy_famous.name,
                count: Object.keys(achievements.galaxy_famous.collection).length,
                limit: achievements.galaxy_famous.limit
            })
        }
        if (Object.keys(achievements.pod_champ.collection).length < achievements.pod_champ.limit && !achievements.pod_champ.collection[current_challenge.racer]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.pod_champ.role + ">" : achievements.pod_champ.name,
                count: Object.keys(achievements.pod_champ.collection).length,
                limit: achievements.pod_champ.limit
            })
        }
        if (Object.keys(achievements.light_skipper.collection).length < achievements.light_skipper.limit && current_challenge.skips && !chievements.light_skipper.collection[current_challenge.track]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.light_skipper.role + ">" : achievements.light_skipper.name,
                count: Object.keys(achievements.light_skipper.collection).length,
                limit: achievements.light_skipper.limit
            })
        }
        if (Object.keys(achievements.slow_steady.collection).length < achievements.slow_steady.limit && current_challenge.nu && !achievements.slow_steady.collection[current_challenge.racer]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.slow_steady.role + ">" : achievements.slow_steady.name,
                count: Object.keys(achievements.slow_steady.collection).length,
                limit: achievements.slow_steady.limit
            })
        }
        if (Object.keys(achievements.mirror_dimension.collection).length < achievements.mirror_dimension.limit && current_challenge.mirror && !achievements.mirror_dimension.collection[current_challenge.track]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.mirror_dimension.role + ">" : achievements.mirror_dimension.name,
                count: Object.keys(achievements.mirror_dimension.collection).length,
                limit: achievements.mirror_dimension.limit
            })
        }
        if (Object.keys(achievements.backwards_compatible.collection).length < achievements.backwards_compatible.limit && current_challenge.backwards && !achievements.backwards_compatible.collection[current_challenge.track]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.backwards_compatible.role + ">" : achievements.backwards_compatible.name,
                count: Object.keys(achievements.backwards_compatible.collection).length,
                limit: achievements.backwards_compatible.limit
            })
        }
        if (Object.keys(achievements.crowd_favorite.collection).length < achievements.crowd_favorite.limit && current_challenge.racer == tracks[current_challenge.track].favorite && !achievements.crowd_favorite.collection[current_challenge.track]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.crowd_favorite.role + ">" : achievements.crowd_favorite.name,
                count: Object.keys(achievements.crowd_favorite.collection).length,
                limit: achievements.crowd_favorite.limit
            })
        }
        if (Object.keys(achievements.true_jedi.collection).length < achievements.true_jedi.limit && !achievements.true_jedi.collection[current_challenge.track + " " + current_challenge.racer]) {
            achievement_message_array.push({
                name: interaction.guild_id == swe1r_guild ? "<@&" + achievements.true_jedi.role + ">" : backwardsCompatible = achievements.true_jedi.name,
                count: Object.keys(achievements.true_jedi.collection).length,
                limit: achievements.true_jedi.limit
            })
        }
    }
    let achievement_progress = ''
    achievement_message_array.forEach(ach => {
        achievement_progress += "**" + achievement_message_array[i].name + "** `" + achievement_message_array[i].count + "/" + achievement_message_array[i].limit + "` " + (i !== achievement_message_array.length - 1 ? "○ " : "")
    })
    return achievement_progress
}

exports.challengeColor = function (current_challenge) {
    //color conditions
    let color = planets[tracks[current_challenge.track].planet].color
    if (current_challenge.completed) {
        color = "77B255"
    }
    // else if (title == ":warning: 5 Minute Warning: " || title == "<a:countdown:672640791369482251> 1 Minute Warning: ") {
    //     color = "FAA61A"
    // } else if (title == ":negative_squared_cross_mark: Closed: " || title == ":arrows_counterclockwise: Rerolled: ") {
    //     color = "2F3136"
    // }
    return color
}

exports.awardAchievements = function ({ client, interaction, achievements, Member, profile, profileref } = {}) {
    Object.keys(achievements).forEach(key => {
        if (Object.keys(achievements[key].collection).length >= achievements[key].limit) { //if player has met condition for achievement
            if (interaction.guild_id == swe1r_guild) {
                if (!Member.roles.cache.some(r => r.id === achievements[key].role)) { //award role
                    Member.roles.add(achievements[key].role).catch(error => console.log(error))
                }
            }
            if (profile.achievements[key] == false) { //send congrats
                profileref.child("achievements").child(key).set(true)
                const congratsEmbed = new Discord.MessageEmbed()
                    .setAuthor(interaction.member.nick + " got an achievement!", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).displayAvatarURL())
                    .setDescription(achievements[key].description)
                    .setColor("FFB900")
                    .setTitle("**:trophy: " + achievements[key].name + "**")
                if (interaction.guild_id == swe1r_guild) {
                    congratsEmbed.setDescription("**<@&" + achievements[key].role + ">** - " + achievements[key].description)
                }
                interaction.followUp({ embeds: [congratsEmbed] })
            }
        }
    })
}

exports.challengeWinnings = function ({ current_challenge, submitted_time, best, current_challengeref, profileref } = {}) {
    let earnings = "", earnings_total = 0, winnings_text = null
    for (let i = 4; i > -1; i--) {
        if (submitted_time.time < goals[i]) {
            winnings_text = i
        }
    }
    if (current_challenge.hunt) {
        earnings += "Hunt Bonus `+📀" + tools.numberWithCommas(profile.hunt.bonus) + "`\n"
        earnings_total += profile.hunt.bonus
    }
    if (goal_earnings[winnings_text] > 0) {
        earnings += goal_symbols[winnings_text] + " `+📀" + tools.numberWithCommas(goal_earnings[winnings_text]) + "`\n"
        earnings_total += goal_earnings[winnings_text]
    }
    let winnings_non_standard = 0
    if (submitted_time.skips && submitted_time.settings.skips <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.mirror && submitted_time.settings.mirror_mode <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.laps !== 3 && submitted_time.settings.non_3_lap <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.nu && submitted_time.settings.no_upgrades <= 25) {
        winnings_non_standard++
    }
    if (submitted_time.backwards && submitted_time.settings.backwards <= 25) {
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
        if (best[i].user !== member && submitted_time.time < best[i].time && !beat.includes(best[i].user)) {
            beat.push(best[i].user)
        }
    }
    if (current_challenge.track.lengthclass == 'Long' && !current_challenge.conditions.skips) {
        earnings += "Long `+📀" + tools.numberWithCommas(truguts.long) + "`\n"
        earnings_total += truguts.long
    }
    if (current_challenge.track.lengthclass == 'Extra Long' && !current_challenge.conditions.skips) {
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
    if (current_challenge.rated) {
        earnings += "Rated `+📀" + tools.numberWithCommas(truguts.rated) + "`\n"
        earnings_total += truguts.rated
    }
    if (current_challenge.truguts_earned == 0) {
        profileref.update({ truguts_earned: profile.truguts_earned + earnings_total })
        current_challengeref.update({ truguts_earned: earnings_total })
    }
    earnings += "\n**Total: **`+📀" + tools.numberWithCommas(earnings_total) + "`"
    return { earnings: earnings_total, receipt: earnings }
}

exports.updateChallenge = function ({ challengedata, profile, current_challenge, current_challengeref, profileref } = {}) {
    let best = [], played = false, record_holder = false
    Object.keys(challengedata).forEach(key => {
        if (challengedata[key].user == member) { //get achievement progress
            achievements.galaxy_famous.collection[String(challengedata[key].track)] = 1
            achievements.pod_champ.collection[String(challengedata[key].racer)] = 1
            if (challengedata[key].conditions.skips) {
                achievements.light_skipper.collection[String(challengedata[key].track)] = 1
            }
            if (challengedata[key].conditions.nu) {
                achievements.slow_steady.collection[String(challengedata[key].racer)] = 1
            }
            if (challengedata[key].conditions.mirror) {
                achievements.mirror_dimension.collection[String(challengedata[key].track)] = 1
            }
            if (challengedata[key].conditions.backwards) {
                achievements.backwards_compatible.collection[String(challengedata[key].track)] = 1
            }
            if (challengedata[key].racer == tracks[String(challengedata[key].track)].favorite) {
                achievements.crowd_favorite.collection[String(challengedata[key].track)] = 1
            }
            achievements.true_jedi.collection[String(challengedata[key].track + " " + challengedata[key].racer)] = 1
        }
        if (exports.matchingChallenge(challengedata[key], current_challenge)) { //get leaderboard
            best.push(challengedata[key])
            if (challengedata[key].user == member) {
                played = true
            }
        }
    })
    best.sort(function (a, b) {
        return a.time - b.time;
    })
    if (best.length > 0 && best[0].user == member) {
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
        current_challengeref.update({ reroll_cost: record_holder ? "free" : played ? "discount" : "full price" })
    }

    let data = {
        message: exports.challengeEmbed({ current_challenge, profile, feedbackdata, best, name, submitted_time, member }),
        components: exports.challengeComponents()
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

exports.challengeEmbed = function ({ current_challenge, profile, feedbackdata, best, name, submitted_time, member } = {}) {
    const challengeEmbed = new Discord.MessageEmbed()
        .setTitle(exports.generateChallengeTitle(current_challenge))
        .setColor(exports.challengeColor(current_challenge))
        .setFooter("Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent))
        .setAuthor(interaction.member.nick + "'s Random Challenge", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).displayAvatarURL())
        .setDescription(exports.getFeedbackTally(feedbackdata, current_challenge) + exports.generateChallengeDescription(current_challenge, best, profile, name) + "\n" + exports.achievementProgress(achievements))
    if (!current_challenge.rerolled && Date.now() - 15 * 60 * 1000 < current_challenge.created) {
        if (current_challenge.completed) {
            challengeEmbed.addField("Winnings", exports.challengeWinnings({ current_challenge, submitted_time, best }), true)
        } else {
            challengeEmbed.addField("Goal Times", exports.goalTimeList(current_challenge, profile), true)
        }
        challengeEmbed.addField("Best Times", exports.generateLeaderboard(best, member), true)
    } else {
        if (current_challenge.rerolled) { //FIX ME: make reroll function
            let reroll = exports.rerollReceipt(current_challenge)
            challengeEmbed.setDescription(reroll.receipt)
        }
    }
    return challengeEmbed
}

exports.challengeComponents = function (current_challenge, profile) {
    //components
    let components = []
    let reroll = exports.rerollReceipt(current_challenge)
    let current_truguts = profile.truguts_earned - profile.truguts_spent
    if (!current_challenge.completed) {
        components.push({ type: 2, style: 2, custom_id: "challenge_random_modal", label: "Submit Time", emoji: { name: "⏱️" } })
        if (current_challenge.type == "private") {
            if (current_truguts >= reroll.cost) {
                components.push({ type: 2, style: 2, custom_id: "challenge_random_reroll", label: "Reroll (" + reroll.cost == 0 ? 'free' : "📀" + tools.numberWithCommas(reroll.cost) + ")", emoji: { name: "🎲" } })
            }
            if (current_truguts >= truguts.bribe_track || current_truguts >= truguts.bribe_racer) {
                components.push({ type: 2, style: 2, custom_id: "challenge_random_bribe", label: "Bribe", emoji: { name: "💰" } })
            }
        }
    } else {
        components.push({ type: 2, style: 4, custom_id: "challenge_random_play", emoji: { name: "🎲" } }, { type: 2, style: 2, custom_id: "challenge_random_undo", emoji: { name: "↩️" } })
        if (!current_challenge.rated) {
            components.push({ type: 2, style: 2, custom_id: "challenge_random_like", emoji: { name: "👍" } }, { type: 2, style: 2, custom_id: "challenge_random_dislike", emoji: { name: "👎" } })
        }
        components.push({
            type: 2, style: 2, custom_id: "challenge_random_menu", emoji: { name: "menu", id: "862620287735955487" }
        })
    }
    return components
}

exports.bribeComponents = function (profile) {
    let track_selections = []
    let racer_selections = []
    for (var i = 0; i < 25; i++) {
        let racer_option = {
            label: racers[i].name,
            value: i,
            description: racers[i].pod.substring(0, 50),
            emoji: {
                name: racers[i].flag.split(":")[1],
                id: racers[i].flag.split(":")[2].replace(">", "")
            }
        }
        let track_option = {
            label: tracks[i].name,
            value: i,
            description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
            emoji: {
                name: planets[tracks[i].planet].emoji.split(":")[1],
                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
            }
        }
        if (i < 23) {
            racer_selections.push(racer_option)
        }
        track_selections.push(track_option)
    }
    let components = []
    if (profile.current.track_bribe == false) {
        components.push(
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "challenge_random_bribe_track",
                        options: track_selections,
                        placeholder: "Bribe Track (📀" + tools.numberWithCommas(truguts.bribe_track) + ")",
                        min_values: 1,
                        max_values: 1
                    },
                ]
            }
        )
    }
    if (profile.current.racer_bribe == false) {
        components.push(
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "challenge_random_bribe_racer",
                        options: racer_selections,
                        placeholder: "Bribe Racer (📀" + tools.numberWithCommas(truguts.bribe_racer) + ")",
                        min_values: 1,
                        max_values: 1
                    }
                ]
            }
        )
    }
    return components
}

exports.menuEmbed = function () {
    const myEmbed = new Discord.MessageEmbed()
        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
        .setTitle("<:menu:862620287735955487> Menu")
        .setColor("#ED4245")
        .setDescription("This is the Random Challenge menu. From here, you can access all options related to random challenges. Press the **Play** button to get rollin'.\n\n*" + tips[Math.floor(Math.random() * tips.length)] + "*")
        .setFooter("/challenge random")
    return myEmbed
}

exports.menuComponents = function () {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    custom_id: "challenge_random_play",
                    style: 4,
                    label: "Play",
                    emoji: {
                        name: "🎲"
                    }
                },

                {
                    type: 2,
                    custom_id: "challenge_random_hint_initial",
                    style: 2,
                    label: "Hints",
                    emoji: {
                        name: "💡"
                    }
                },
                {
                    type: 2,
                    custom_id: "challenge_random_hunt_initial",
                    style: 2,
                    label: "Challenge Hunt",
                    emoji: {
                        name: "🎯"
                    }
                },
                {
                    type: 2,
                    custom_id: "challenge_random_settings_initial",
                    style: 2,
                    label: "Settings",
                    emoji: {
                        name: "⚙️"
                    }
                }
            ]
        },
        {
            type: 1,
            components: [
                {
                    type: 2,
                    custom_id: "challenge_random_profile_stats",
                    style: 2,
                    label: "Profile",
                    emoji: {
                        name: "👤"
                    }
                },
                {
                    type: 2,
                    custom_id: "challenge_random_leaderboards_initial",
                    style: 2,
                    label: "Leaderboards",
                    emoji: {
                        name: "🏆"
                    }
                },
                {
                    type: 2,
                    custom_id: "challenge_random_about",
                    style: 2,
                    emoji: {
                        name: "❔"
                    }
                }
            ]

        }

    ]
}

exports.playButton = function () {
    return {
        type: 2,
        style: 4,
        custom_id: "challenge_random_play",
        label: "New Challenge",
        emoji: {
            name: "🎲"
        }
    }
}

exports.notYoursEmbed = function () {
    let noMoney = new Discord.MessageEmbed()
        .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Challenge!")
        .setDescription("This is someone else's challenge or the option to bribe has expired. Roll a challenge with the button below.")
    return noMoney
}

exports.hintEmbed = function (player) {
    const hintEmbed = new Discord.MessageEmbed()
        .setTitle(":bulb: Hints")
        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
        .setColor("#ED4245")
        .setDescription("Hints help you narrow down what challenges you need to complete for :trophy: **Achievements**. The more you pay, the better the hint.")
        .setFooter(player.user.username + " | Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent), client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
    return hintEmbed
}

exports.settingsEmbed = function (interaction, profile) {
    const settingsEmbed = new Discord.MessageEmbed()
        .setTitle(":gear: Settings")
        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
        .setDescription("Customize the odds for your random challenge conditions and select a winnings pattern.")
        .setFooter(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
        .setColor("#ED4245")
    let winnings = profile.winnings
    let odds = {
        skips: profile.skips,
        no_upgrades: profile.no_upgrades,
        non_3_lap: profile.non_3_lap,
        mirror_mode: profile.mirror_mode,
        backwards: profile.backwards ?? 5
    }
    settingsEmbed
        .addField("Your Odds", "Skips - " + odds.skips + "%\nNo Upgrades - " + odds.no_upgrades + "%\nNon 3-Lap - " + odds.non_3_lap + "%\nMirror Mode - " + odds.mirror_mode + "%\nBackwards - " + odds.backwards, true)
        .addField("Your Winnings: " + winnings_map[winnings].name, winnings_map[winnings].text, true)
    return settingsEmbed
}

exports.settingsComponents = function () {
    let components = []
    let winnings_options = []
    for (i = 0; i < winnings_map.length; i++) {
        let option = {
            label: winnings_map[i].name,
            value: i,
            description: i == settings_default.winnings ? 'Default' : '',
            default: profile.winnings == i
        }
        winnings_options.push(option)
    }
    components.push({
        type: 1,
        components: [
            {
                type: 2,
                style: odds_style,
                custom_id: "challenge_random_settings_odds_uid" + member,
                label: "Set Odds",
                disabled: odds_disabled
            },
            {
                type: 2,
                style: 2,
                label: "Reset to Default",
                custom_id: "challenge_random_settings_default_uid" + member,
            },
            {
                type: 2,
                style: 2,
                custom_id: "challenge_random_menu_uid" + member,
                emoji: {
                    name: "menu",
                    id: "862620287735955487"
                }
            }
        ]
    }, {
        type: 1,
        components: [
            {
                type: 3,
                custom_id: "challenge_random_settings_winnings_uid" + member,
                options: winnings_options,
                placeholder: "Set Winnings",
                min_values: 1,
                max_values: 1
            }
        ]
    })
    return components
}