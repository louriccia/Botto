const { racers, tracks, planets, playerPicks, movieQuotes, circuits, multipliers, racer_hints, track_hints, mpQuotes, emojimap, console_emojis, banners } = require('../../data.js')
const tools = require('../../tools.js')
const { truguts, swe1r_guild, tips, goal_symbols, settings_default, achievement_data, winnings_map, hints, shoplines, level_symbols, inventorySections } = require('./data.js')
const { items, collections, levels, raritysymbols } = require('./items.js')
const { postMessage } = require('../../discord_message.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const moment = require('moment');
require('moment-timezone')
const youtubeThumbnail = require('youtube-thumbnail');
const e = require('express')

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

exports.initializeUser = async function (ref, id, name) {
    let data = {
        discordID: id,
        name: name
    }
    const push = await ref.push(data)
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
        challenge.channel = interaction.channelId
        challenge.guild = interaction.guildId
    } else if (type == 'cotd') {
        challenge.day = exports.easternTime().dayOfYear()
    } else if (type == 'cotm') {
        challenge.month = exports.easternTime().month()
    }

    challenge = exports.getSponsors(challenge, db)

    return challenge
}

exports.getSponsors = function (challenge, db) {
    // if (challenge.submissions) {
    //     return challenge
    // }
    challenge.sponsors = {}
    if (!challenge.sponsor) {
        challenge.sponsor = {}
    }
    Object.values(db.ch.sponsors).filter(sponsor => exports.matchingChallenge(sponsor, challenge)).forEach(sponsor => {
        if (!challenge.sponsors[sponsor.sponsor?.member]) {
            challenge.sponsors[sponsor.sponsor.member] = { ...sponsor.sponsor, take: truguts.sponsor_cut, earnings: 0 }
        } else {
            challenge.sponsors[sponsor.sponsor.member].take += truguts.sponsor_cut
        }
        if (sponsor.time) {
            challenge.sponsor = JSON.parse(JSON.stringify(sponsor.sponsor))
            challenge.sponsor.time = sponsor.time
        }
        if (sponsor.title) {
            challenge.sponsor.title = sponsor.title
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

exports.isActive = function (current_challenge, profile) {
    if (current_challenge.rescue) {
        return true
    }
    let intime = Date.now() - (current_challenge.type == 'private' && profile?.effects?.extended_timer ? 30 : 15) * 60 * 1000 < current_challenge.created
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
    let sponsortitle = current_challenge.sponsor?.title ? `*"${current_challenge.sponsor?.title}"*\n` : ""
    let title = sponsortitle + status + prefix + (current_challenge.rerolled ? "~~" : "") + "Race as **" + bribed_racer + racer_flag + " " + racers[current_challenge.racer].name + bribed_racer + "**" + nutext + " on **" + bribed_track + track_flag + " " + tracks[current_challenge.track]?.name + bribed_track + "**" + laptext + skipstext + mirrortext + backwardstext + (current_challenge.rerolled ? "~~" : "")
    if (current_challenge.type == 'cotm') {
        title = Object.values(emojimap)[Math.floor(Math.random() * Object.values(emojimap).length)] + " Multi-track Challenge: Race as **" + racer_flag + " " + racers[current_challenge.racer].name + "**" + nutext + laptext + skipstext + mirrortext + backwardstext
    }
    return title.slice(0, 255)
}

exports.generateChallengeDescription = function ({ current_challenge, db, profile }) {
    let desc = ''
    let extended = profile?.effects?.extended_timer ? 30 : 15
    let duration = current_challenge.type == 'private' ? 1000 * 60 * extended : ['abandoned', 'multiplayer', 'private'].includes(current_challenge.type) ? 1000 * 60 * 15 : current_challenge.type == 'cotm' ? 1000 * 60 * 60 * 24 * exports.easternTime().daysInMonth() : 1000 * 60 * 60 * 24
    let expiration = ''
    if (current_challenge.type !== 'abandoned') {
        expiration = "Expires <t:" + Math.round((current_challenge.created + duration) / 1000) + ":R>"
    }

    desc = [exports.getFeedbackTally(db, current_challenge), (!current_challenge.completed && !current_challenge.rerolled ? expiration : ''), (current_challenge.sponsors ? exports.getSponsorsString(current_challenge) : ''), (current_challenge.predictions && !current_challenge.completed ? exports.getPredictors(current_challenge) : "")].filter(d => ![null, undefined, ''].includes(d)).join(" | ")

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

exports.getSponsorsString = function (current_challenge) {
    return current_challenge.sponsor_earnings && Object.values(current_challenge.sponsor_earnings).length ? "📢 " + Object.keys(current_challenge.sponsor_earnings).map(key => `<@${key}> \`+📀${tools.numberWithCommas(current_challenge.sponsor_earnings[key])}\``).join(", ") : ""
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
            Math.round(circuits[tracks[current_challenge.track].circuit].winnings[current_challenge.type == 'private' ? profile?.settings?.winnings : 1][i] * (current_challenge.type == 'abandoned' ? (profile.effects?.always_move ? 1 : truguts.abandoned) : 1))
        goal_earnings.push(earning)
    }
    goal_earnings.push(0)
    let goalTimes = ''
    let level = current_challenge.type == 'private' ? profile.progression ? exports.convertLevel(profile.progression[current_challenge.racer]) : null : null
    let levelup = null
    if (level) {
        levelup = level.nextlevel - level.sublevel
    }
    for (let i = 0; i < 5; i++) {
        goalTimes += goal_symbols[i] + " " + tools.timefix(goals[i]) + (goal_earnings[i] ? "  `+📀" + tools.numberWithCommas(goal_earnings[i]) + "`" : '') + (level ? (5 - i) >= levelup ? '<a:guidearrow:891128437354401842>' : '' : '') + "\n"
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
        if (current_challenge.sponsor?.time) {
            best.push({
                time: current_challenge.sponsor.time,
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
                    (best[i].goal ? '*' : bold ? ` <@${best[i].user}>` : ` ${best[i].name}`) + bold +
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

exports.goalTimeRank = function ({ submitted_time, goals }) {
    return goals.times.filter(g => Number(submitted_time.time) - Number(g) > 0).length
}

exports.challengeWinnings = function ({ current_challenge, submitted_time, profile, best, goals, member, db } = {}) {
    if (!Object.keys(submitted_time).length) {
        return { earnings: 0, receipt: "Sorry, could not calculate earnings." }
    }
    let earnings = "", earnings_subtotal = 0, earnings_total = 0
    let medal = exports.goalTimeRank({ submitted_time, goals })

    if (goals.earnings[medal] > 0) {
        earnings += "`+📀" + tools.numberWithCommas(goals.earnings[medal]) + "` " + goal_symbols[medal] + "\n"
        earnings_subtotal += goals.earnings[medal]
    }

    if (current_challenge.bounties) {
        let bounty_total = 0
        Object.values(current_challenge.bounties).forEach(bounty => {
            bounty_total += bounty.bonus
        })
        earnings += "`+📀" + tools.numberWithCommas(bounty_total) + "` :dart:\n"
        earnings_subtotal += bounty_total
    }
    if (current_challenge.sponsor?.time && Number(submitted_time.time) - Number(current_challenge.sponsor?.time) < 0) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.beat_sponsor) + "` 📢\n"
        earnings_subtotal += truguts.beat_sponsor
    }

    //calculate streak
    let challengehistory = Object.values(db.ch.times).filter(c => c.user == member && c.date < current_challenge.created).sort((a, b) => b.date - a.date)
    let streak = {
        day: {
            streak: 0,
            last: current_challenge.created
        },
        challenge: {
            streak: 0,
            last: current_challenge.created
        }
    }
    let day_streaking = true
    let challenge_streaking = true
    for (let i = 0; i < challengehistory.length; i++) {
        let date = challengehistory[i].date
        if (date > streak.day.last - 1000 * 60 * 60 * 36) {
            streak.day.last = date
            streak.day.streak++
        } else {
            day_streaking = false
        }
        if (date > streak.challenge.last - 1000 * 60 * 30) {
            streak.challenge.last = date
            streak.challenge.streak++
        } else {
            challenge_streaking = false
        }
        if (!day_streaking && !challenge_streaking) {
            i = challengehistory.length
        }
    }
    let day_streak = Math.floor((current_challenge.created - streak.day.last) / (1000 * 60 * 60 * 24))
    let challenge_streak = streak.challenge.streak + 1

    if (day_streak) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.day_streak * day_streak) + "` " + day_streak + "-Day Streak\n"
        earnings_subtotal += truguts.day_streak * day_streak
    }
    if (challenge_streak > 1) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.challenge_streak * challenge_streak) + "` " + (challenge_streak) + "-Challenge Streak\n"
        earnings_subtotal += truguts.challenge_streak * challenge_streak
    }

    let first = true, pb = false, beat = []
    for (let i = 0; i < best.length; i++) {
        if (best[i].date < submitted_time.date) {
            first = false
            if (best[i].user == member && best[i].date !== submitted_time.date && submitted_time.time < best[i].time) {
                pb = true
            }
        }
        if (best[i].user !== member && Number(submitted_time.time) - Number(best[i].time) < 0 && !beat.map(b => String(b.user)).includes(String(best[i].user))) {
            beat.push(best[i])
        }
    }
    if (first) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.first) + "` :snowflake:\n"
        earnings_subtotal += truguts.first
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
        earnings_subtotal += truguts.non_standard * winnings_non_standard
    }

    if (current_challenge.type !== 'cotm' && tracks[current_challenge.track].lengthclass == 'Long' && !current_challenge.conditions.skips) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.long) + "` Long\n"
        earnings_subtotal += truguts.long
    }
    if (current_challenge.type !== 'cotm' && tracks[current_challenge.track].lengthclass == 'Extra Long' && !current_challenge.conditions.skips) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.extra_long) + "` Extra Long\n"
        earnings_subtotal += truguts.extra_long
    }
    if (beat.length) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.beat_opponent) + " × " + beat.length + "` Bop\n"
        earnings_subtotal += truguts.beat_opponent * beat.length
    }

    //rival, bitter_rivalry
    let rival = profile.rival ? Object.values(profile.rival).pop() : null
    if (rival && beat.map(b => String(b.user)).includes(rival.player)) {
        if (profile.effects?.bitter_rivalry) {
            let rival_winnings = ({ current_challenge, submitted_time: beat.find(b => b.user == rival.player)?.time, profile: Object.values(db.user).find(u => u.discordID == rival.player)?.random, best, goals, member: rival.player, db })
            earnings += "`+📀" + tools.numberWithCommas(rival_winnings.earnings) + "` *Bitter Rivalry*\n"
            earnings_subtotal += rival_winnings.earnings
        } else {
            earnings += "`+📀" + tools.numberWithCommas(truguts.rival) + "` Beat Rival\n"
            earnings_subtotal += truguts.rival
        }
    }

    if (pb) {
        earnings += "`+📀" + tools.numberWithCommas(truguts.personal_best) + "` PB\n"
        earnings_subtotal += truguts.personal_best
    }

    //multipliers
    let multipliers = ""
    earnings_total = earnings_subtotal

    if (current_challenge.created - 1000 * 60 * 60 * 24 < profile.effects?.trugut_boost) {
        multipliers += `${profile.effects?.doubled_powers ? '`×2`' : '`×1.5`'} *⚡Trugut Boost* (expires <t:${Math.round((profile.effects?.trugut_boost + 1000 * 60 * 60 * 24) / 1000)}:R>)\n`
        earnings_total *= (profile.effects?.doubled_powers ? 2 : 1.5)
    }

    if (current_challenge.racer == tracks[current_challenge.track]?.favorite && profile.effects?.fame_fortune) {
        multipliers += "`×2` *Fame and Fortune*\n"
        earnings_total *= 2
    }
    if (Object.values(db.user).find(u => u.discordID == member)?.discord?.roles?.includes(racers[current_challenge.racer].fan) && profile.effects?.fan_service) {
        multipliers += "`×2` *Fan Service*\n"
        earnings_total *= 2
    }

    if (profile.effects?.trugut_cloner) {
        let cloner = 1
        Object.values(profile.effects?.trugut_cloner).forEach(m => {
            earnings_total *= Number(m.multiplier)
            cloner *= Number(m.multiplier)
        })
        multipliers += `\`×${cloner}\` *Trugut Cloner*\n`
    }

    earnings_total = Math.round(earnings_total)

    //sabotage, only one can be triggered
    let sabotagekey = profile.effects?.sabotage ? (Object.keys(profile.effects.sabotage).find(k => profile.effects.sabotage[k].millisecond == String(submitted_time.time)[String(submitted_time.time).length - 1] && (!profile.effects.sabotage[k].used || profile.effects.sabotage[k].challenge == current_challenge.message)) ?? null) : null
    let sabotage = '', dp = null, s = null
    if (sabotagekey) {
        s = profile.effects.sabotage[sabotagekey]
        dp = db.user[s.player].random?.effects?.doubled_powers
        sabotage += `\`-📀${tools.numberWithCommas(earnings_total * (dp ? 1 : 0.5))}\` 💥Sabotaged!\n`
        sabotage += `<@${db.user[s.player].discordID}> \`+📀${tools.numberWithCommas(earnings_total * (dp ? 1 : 0.5))}\`\n`
    }
    const line = "▬▬▬▬▬▬▬▬▬▬▬"
    if (multipliers || sabotage) {
        earnings += `${line}\n**\`📀${tools.numberWithCommas(earnings_subtotal)}\` Sub-Total**\n${multipliers}${sabotage}${line}\n**\`📀${tools.numberWithCommas(earnings_total * (s ? (dp ? 0 : 0.5) : 1))}\` Total**`
    } else {
        earnings += `${line}\n**\`📀${tools.numberWithCommas(earnings_total)}\` Total**`
    }

    if (current_challenge?.ratings?.[member]) {
        earnings += "\n`+📀" + tools.numberWithCommas(truguts.rated * (profile.effects?.vote_confidence ? 2 : 1)) + "` Rated"
    }

    let winnings = { earnings: earnings_total, receipt: earnings }
    if (sabotage) {
        winnings.sabotage = sabotagekey
    }
    return winnings
}

exports.getBest = function (db, current_challenge) {
    let best = []
    Object.keys(db.ch.times).forEach(key => {
        if (db.ch.times[key].time == 22.222 && db.ch.times[key].user == '256236315144749059') {
            console.log(key)
        }
        if (exports.matchingChallenge(db.ch.times[key], current_challenge)) { //get leaderboard
            best.push(db.ch.times[key])
        }
    })
    return best.sort(function (a, b) {
        return a.time - b.time;
    })
}

exports.updateChallenge = async function ({ client, db, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction } = {}) {
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
    let record_holder = best.length > 0 && best[0].user == player

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
    current_challenge = exports.getSponsors(current_challenge, db)

    if (current_challenge.type == 'private') {
        current_challenge = exports.getBounty(current_challenge, db)
        current_challenge.reroll_cost = (player_profile.effects?.free_rerolls || current_challenge.sponsors?.[player] || record_holder) ? "free" : played ? "discount" : "full price"
    }

    if (current_challengeref) {
        current_challengeref.update(current_challenge)
    }

    let flavor_text = ''
    if (Math.random() < 0.20 && current_challenge?.player?.name) {
        let quotes = Object.values(db.ch.quotes)
        let quote = quotes[Math.floor(Math.random() * quotes.length)]
        flavor_text = `${quote.quote.replaceAll('$player', current_challenge.player.name)}\n(submitted by ${db.user[quote.player].name})`
    } else if (Math.random() < 0.20 && best.length > 0) {
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

exports.rerollReceipt = function (current_challenge, profile) {
    let reroll_cost = current_challenge.reroll_cost
    let free = profile?.effects?.free_rerolls
    return {
        receipt: free ? 'FREE REROLLS FOR LIFE' : reroll_cost == 'discount' ? "-📀" + tools.numberWithCommas(truguts.reroll_discount) + " (discounted)" : (reroll_cost == 'free' ? "(no charge for record holders)" : "-📀" + tools.numberWithCommas(truguts.reroll)),
        cost: free ? 0 : reroll_cost == 'discount' ? truguts.reroll_discount : (reroll_cost == 'free' ? 0 : truguts.reroll)
    }
}

exports.checkActive = function (db, member, current_challenge) {
    let occupied = null
    let result = null
    Object.keys(db.ch.challenges).forEach(key => {
        let challenge = db.ch.challenges[key]
        let profile = Object.values(db.user).find(u => u.discordID == member)?.random
        if (challenge.player?.member == member && challenge.type == 'private' && exports.isActive(challenge, profile) && ((current_challenge && current_challenge.message !== challenge.message) || !current_challenge)) {
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
    let desc = exports.generateChallengeDescription({ current_challenge, db, profile }) + (current_challenge.type == 'private' ? "\n" + exports.challengeAchievementProgress({ client, current_challenge, profile, profileref, achievements: achs, name, avatar, member }) : '')
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

    if (current_challenge.rerolled && current_challenge.type !== 'cotd') {
        let reroll = exports.rerollReceipt(current_challenge, profile)
        challengeEmbed.setFooter({ text: reroll.receipt + "\nTruguts: 📀" + exports.currentTruguts(profile) })
        return challengeEmbed
    }

    if (current_challenge.completed && ['private', 'abandoned'].includes(current_challenge.type)) {
        let winnings = exports.challengeWinnings({ current_challenge, profile, profileref, submitted_time, best, goals, member, db })
        challengeEmbed
            .addFields({ name: "Winnings", value: winnings.receipt.slice(0, 1024), inline: true })
    } else {
        challengeEmbed.addFields({ name: "Goal Times", value: goals.list.slice(0, 1024), inline: true })
    }

    const image_url = best.find(b => b.proof?.includes('youtu'))?.proof ?? null
    let image = null
    if (image_url && !current_challenge.completed && !current_challenge.rerolled) {
        image = await getThumbnail(image_url)
    }
    if (image) {
        challengeEmbed.setImage(image)
    }
    challengeEmbed.addFields({ name: "Best Times", value: exports.generateLeaderboard(best, member, current_challenge).slice(0, 1024), inline: true })
    if (current_challenge.completed && ['private', 'abandoned'].includes(current_challenge.type)) {
        let progression = exports.challengeProgression({ current_challenge, submitted_time, goals, profile })
        //item


        challengeEmbed
            .addFields({ name: tools.getRacerName(progression.racer), value: progression.summary, inline: true })

        if (![undefined, ""].includes(current_challenge.earnings?.[member]?.item)) {
            let item = items.find(i => i.id == current_challenge.earnings[member].item)
            challengeEmbed.addFields({ name: exports.itemString({ item, profile }), value: `*${item.description}*`, inline: true })
        }

    }
    return challengeEmbed
}

exports.challengeProgression = function ({ current_challenge, submitted_time, goals, profile }) {
    if (!profile.progression) {
        return {
            racer: current_challenge.racer,
            summary: 'Check your profile to enable racer progression'
        }
    }
    let rank = exports.goalTimeRank({ submitted_time, goals })
    let medal = goal_symbols[rank] ?? ""
    let points = Math.max(5 - rank, 0)
    let previous_level = exports.convertLevel(profile.progression[current_challenge.racer] - points)
    let level = exports.convertLevel(profile.progression[current_challenge.racer])
    let levelup = previous_level.level !== level.level
    let rewards = []
    for (let i = previous_level.level + 1; i < level.level + 1; i++) {
        rewards.push(exports.progressionReward({ racer: current_challenge.racer, level: level.level }))
    }
    let nextreward = exports.progressionReward({ racer: current_challenge.racer, level: level.level + 1 })
    return {
        racer: current_challenge.racer,
        medal,
        points,
        summary: `${points ? `\`+${points}\` ${medal}\n\n` : ''}` +
            `${levelup ? '<a:guidearrow:891128437354401842> **LEVEL UP** <a:guidearrow:891128437354401842>\n' : ''}` +
            `${levelup ? `${rewards.map(r => r.string).join('\n')}\n\n` : ''}` +
            `${level.string}\n${level_symbols[Math.min(6, Math.floor(level.level / 4))]} *${levels[Math.min(level.level, 24)]}*\n` +
            `\nNext reward:\n${nextreward.string}`
    }
}

exports.progressionReward = function ({ racer, level }) {
    const levelmap = {
        5: 'flag',
        10: 'usable',
        15: 'blueprint_cockpit',
        20: 'blueprint_engine',
        25: 'special'
    }
    let truguts = 0
    for (let i = 1; i < level + 1; i++) {
        truguts += i * 80
    }
    let reward = {
        truguts,
        item: level > 25 ? racers[racer].items.usable : levelmap[level] ? racers[racer].items[levelmap[level]] : null,
    }

    let item = items.find(i => i.id == reward.item)
    reward.string = `\`+📀${tools.numberWithCommas(reward.truguts)}\`${item ? `\n${raritysymbols[item.rarity]} ${item.name}` : ''}`
    return reward
}

exports.challengeComponents = function (current_challenge, profile) {
    //components
    const row = new ActionRowBuilder()
    let reroll = exports.rerollReceipt(current_challenge, profile)

    if ((!current_challenge.submissions || !['abandoned', 'private'].includes(current_challenge.type)) && exports.isActive(current_challenge, profile)) {
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

exports.trackSelector = function ({ customid, placeholder, min, max, descriptions } = {}) {
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
            description: descriptions ? descriptions[i].substring(0, 50) : (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
            emoji: {
                name: planets[tracks[i].planet].emoji.split(":")[1],
                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
            }
        })
    }
    trackSelectRow.addComponents(track_selector)
    return [trackSelectRow]
}

exports.racerSelector = function ({ customid, placeholder, min, max, descriptions } = {}) {
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
            description: descriptions ? descriptions[i].substring(0, 50) : racers[i].pod.substring(0, 50),
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

exports.menuEmbed = function ({ db } = {}) {
    const typemap = {
        cotd: ':game_die: Daily: ',
        cotm: ':game_die: Monthly: ',
        open: '',
        abandoned: ''
    }

    const abandoned_challenges = `${Object.values(db.ch.challenges).filter(c => exports.isActive(c) && c.type == 'abandoned' && c.channel == '551786988861128714' && c.url).slice(-10).map(c => `${typemap[c.type]}[${exports.generateChallengeTitle(c)}](${c.url})`).join("\n")}`
    const open_challenges = `${Object.values(db.ch.challenges).filter(c => exports.isActive(c) && ['open', 'cotd', 'cotm'].includes(c.type) && c.channel == '551786988861128714' && c.url).map(c => `${typemap[c.type]}[${exports.generateChallengeTitle(c)}](${c.url})`).join("\n")}`
    const myEmbed = new EmbedBuilder()
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setTitle("<:menu:862620287735955487> Menu")
        .setColor("#ED4245")
        .setDescription(`This is the Random Challenge menu. From here, you can access all options related to random challenges. Press the **Play** button to get rollin'.\n\n${abandoned_challenges.length ? `**Abandoned Challenges**\n${abandoned_challenges}\n\n` : ""}**Open Challenges**\n${open_challenges}\n\n*${tips[Math.floor(Math.random() * tips.length)]}*`)
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
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile")
                .setLabel("Profile")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_about")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❔')
        )
    // .addComponents(
    //     new ButtonBuilder()
    //         .setCustomId("challenge_random_settings_initial")
    //         .setLabel("Settings")
    //         .setStyle(ButtonStyle.Secondary)
    //         .setEmoji('⚙️')
    // )


    return [row1]
}

exports.shopOptions = function ({ profile, player, db, selection } = {}) {
    return [
        {
            label: `Hint`,
            value: 'hint',
            pricemap: true,
            price: truguts.hint,
            description: "Get a hint for incomplete achievements",
            info: "Hints help you narrow down what challenges you need to complete for :trophy: **Achievements**. The more you pay, the better the hint.",
            fields: [{ name: 'Additional Effect', value: "Complete the **Star Wars Episode I: Racer: The Movie** collection to get an additional clue: *Movie Buff - Get an additional clue on all your Hints and Bounties*" }],
            emoji: {
                name: "💡"
            },
            options: exports.hintComponents({ db, profile, player })
        },
        {
            label: `Bounty`,
            value: 'bounty',
            pricemap: true,
            price: truguts.hint,
            description: "Take on a challenge bounty, find it, and claim your prize!",
            info: "Challenge Bounty is a way to earn big truguts fast. Based on your hint selection, Botto hides a large trugut bonus on a random challenge.",
            fields: [{ name: 'Additional Effect', value: "Complete the **Star Wars Episode I: Racer: The Movie** collection to get an additional clue: *Movie Buff - Get an additional clue on all your Hints and Bounties*" }],
            emoji: {
                name: "🎯"
            },
            options: exports.huntComponents(profile)
        },
        {
            label: `Botto Lotto Ticket`,
            value: 'lotto',
            price: truguts.lotto,
            description: "Guess the tracks for the monthly challenge and win big",
            info: "Every month, a random multi-track challenge is generated with 4 - 10 tracks. Enter a Botto Lotto ticket with 7 track guesses.\n• For each track you get correct, earn `📀20,000`.\n• If all tracks on your ticket are in the monthly or vice versa, earn a grand prize of `📀1,000,000!`\n• Only one ticket per user per month.",
            emoji: {
                name: "🎫"
            },
            options: exports.trackSelector({ customid: 'challenge_random_shop_2', placeholder: 'Select Tracks', min: 7, max: 7 })
        },
        {
            label: `Sponsor Challenge`,
            value: 'sponsorchallenge',
            pricemap: true,
            price: { "0": circuits[0].sponsor, "1": circuits[1].sponsor, "2": circuits[2].sponsor, "3": circuits[3].sponsor },
            description: "Sponsor a random challenge and earn truguts!",
            info: "Invest in a random challenge and make truguts on all its earnings. Select a circuit to sponsor and generate your random challenge based on your current odds. Next, you'll get a chance to set a title and sponsor time.",
            fields: [{ name: 'Additional Effect', value: "Complete the **Space Bar** collection to maximize your sponsor take: *Sorry About the Mess - Sponsor take is doubled*" }],
            emoji: {
                name: "📣"
            },
            options: exports.sponsorShopComponents(profile)
        },
        {
            label: `Shuffle Banner`,
            value: 'shuffle_banner',
            price: truguts.shuffle,
            description: "Set a new random banner for the server",
            info: "Tired of the current banner? Give us a new one!\nFree to <@&586060902453739530> (server boosters)",
            emoji: {
                name: "🚩"
            }
        },
        {
            label: `Trendy Transmission`,
            value: 'trendy_transmission',
            price: 5000,
            description: "Send a fancy embed message like Botto",
            info: "Send your own embed message using Botto. This fancy message format is sure to catch a reader's eye.",
            emoji: {
                name: "✉"
            }
        },
        {
            label: `Declare Rival`,
            value: 'rival',
            price: 7000,
            description: "Declare your rival and earn a bonus when you bop them",
            info: "Select a player. When you beat their time on a challenge, you'll earn a special bonus. You can only have one rival at a time.",
            fields: [{ name: 'Additional Effect', value: "Complete the **Grudge Matches** collection to maximize your rival bonus: *Bitter Rivalry - earn what your rival earned as a bonus*" }],
            emoji: {
                name: "🆚"
            },
            options: exports.userPicker({ selection, row: 2, customid: 'challenge_random_shop_2', placeholder: 'Declare your Rival', db })
        },
        // {
        //     label: `Sabotage (📀${tools.numberWithCommas(truguts.sabotage)})`,
        //     value: 'sabotage',
        //     description: "Sabotage a player's trugut earnings",
        //     info: "Select a player, then pick a number 0-9. When the player you selected submits a time that ends in the given number, they lose half their winnings... to you!\n\nFor example, if you entered the number `3` and the selected player submits a time of 1:42.89__3__, the sabotage is triggered.",
        //     fields: [{ name: 'Additional Effect', value: "Complete the **All-Terrain Podracing** collection to maximize your sabotage: *Doubled Powers - sabotaged players lose all winnings to saboteur*" }],
        //     emoji: {
        //         name: "💥"
        //     },
        //     options: exports.userPicker({ selection, customid: 'challenge_random_shop_2', placeholder: 'Select a Player to Sabotage', db })
        // },
        {
            label: `Quotation Mark`,
            value: 'quote',
            price: 20000,
            description: "Submit a quote",
            info: "Submit your own quote to be randomly used at the top of a challenge.",
            emoji: {
                name: "✒️"
            }
        },
        {
            label: `Have a Clue`,
            value: 'clue',
            price: 30000,
            description: "Submit a clue",
            info: "Submit your own clue to be used in Hints and Bounties.",
            emoji: {
                name: "💡"
            },
            options: exports.clueComponents({ selection })
        },
        {
            label: `Sponsor Player`,
            value: 'sponsorplayer',
            price: truguts.sponsor,
            pricemap: true,
            description: 'Sponsor a player and earn truguts!',
            info: "Contribute truguts to a player of your choice and earn a percentage of their earnings every time they complete a challenge.\n`📀50,000` - 5%\n`📀100,000` - 10%\n`📀200,000` - 20%",
            fields: [{ name: 'Additional Effect', value: "Complete the **Space Bar** collection to maximize your sponsor take: *Sorry About the Mess - Sponsor take is doubled*" }],
            emoji: {
                name: "📣"
            },
            options: exports.sponsorPlayerComponents({ selection, db })
        },
        {
            label: `Daily Challenge Reroll`,
            value: 'rerolldaily',
            price: 80000,
            description: 'Reroll the Random Challenge of the Day',
            info: "Sometimes the Random Challenge of the Day is so bad or so impossible it warants a reroll. This can only be done once within one hour of the daily being posted.",
            emoji: {
                name: "🔄"
            }
        },
        {
            label: `Life Debt`,
            value: 'debt',
            price: 99999,
            description: "Go into debt",
            info: "This is a terrible financial decision. As long as you don't already have negative truguts, Botto will allow you to make purchases beyond what you can afford granted your balance doesn't drop below `-📀1,000,000`",
            emoji: {
                name: "💸"
            }
        },
        {
            label: `Botto Buddy`,
            value: 'buddy',
            price: 150000,
            description: "Botto mimics your reactions to messages",
            info: "Every time you react to a message in the Star Wars Episode I: Racer discord, Botto will react with the same emote. One-time purchase.",
            emoji: {
                name: "👥"
            }
        },
        {
            label: `Emoji Role Icon`,
            value: 'roleicon',
            price: 200000,
            description: "Pick a server emoji to use as your role icon",
            info: "Enter the name of a non-animated server emoji to add as an icon next to your name. Multiple icons can be purchased and equiped/unequiped in your **🎒 Inventory**. Racer flag icons are free roles in <id:customize>\nFree to <@&586060902453739530> (server boosters)",
            emoji: {
                name: "✨"
            }
        },
        {
            label: `Change Botto's Color`,
            value: 'bottocolor',
            price: 300000,
            description: "Set a new role color for the Techno-Toydarian",
            info: "Enter a hex code and change Botto's role color.",
            emoji: {
                name: "🌈"
            }
        },
        {
            label: `Extended Timer`,
            value: 'timer',
            price: 500000,
            description: "Extend the time limit for private challenges",
            info: "Extend the time limit for private challenges from 15 minutes to 30 minutes. One-time purchase.",
            emoji: {
                name: "⏳"
            }
        },
        {
            label: `A Friend in Greed`,
            value: 'friend',
            price: 600000,
            description: "Botto will be more cooperative to you in chat",
            info: "Botto will no longer resort to chance cubes and guilting you into giving him truguts when being asked questions in chat. He'll treat you as his favorite customer.",
            emoji: {
                name: "💖"
            }
        },
        {
            label: `Protocol Droid`,
            value: 'protocol',
            price: 800000,
            description: "Botto reacts to messages containing a given phrase",
            info: "Enter a word/phrase and an emoji. Messages containing your input will get a reaction from Botto featuring the selected emoji.",
            emoji: {
                name: "💭"
            }
        },
        {
            label: `Made to Suffer`,
            value: 'suffer',
            price: 1000000,
            description: "Botto replies to messages containing a given phrase",
            info: "Enter a word/phrase and a reply. Messages containing the phrase will automatically get an automatic reply from Botto.",
            emoji: {
                name: "💬"
            }
        },
        {
            label: `Trugut Cloner`,
            value: 'multiply',
            pricemap: true,
            price: { "2": 1000000, "4": 2000000, "6": 8000000, "8": 48000000, "10": 384000000 },
            description: "Multiply your trugut winnings",
            info: "Multiply your trugut winnings! Only applies to truguts earned from submitting times. Multipliers stack.",
            emoji: {
                name: "✖️"
            },
            options: exports.multiplierComponents({ selection })
        },
        {
            label: `Nav Computer`,
            value: 'homing',
            pricemap: true,
            price: { "1": 2000000, "2": 8000000, "3": 48000000 },
            description: "Navigate your way through a galaxy of random challenges",
            info: "Mid Rim Territories: Botto will only roll challenges that apply to unearned achievements.\n" +
                "Outer Rim Territories: Botto will only roll challenges that the user has not played.\n" +
                "Unknown Regions: Botto will only roll challenges that have no submissions.\n\nAll effects can be enabled or disabled in settings.",
            emoji: {
                name: "🧭"
            },
            options: exports.navComponents({ context: 'shop' })
        },
        {
            label: `No Longer a Slave`,
            value: 'rerolls',
            price: 384000000,
            description: "Never pay for rerolls again",
            info: "Rerolls are forever free. One-time purchase.",
            emoji: {
                name: "🔄"
            }
        },
        {
            label: `Credits WILL Do Fine`,
            value: 'bribes',
            price: 384000000,
            description: "Never pay for bribes again",
            info: "You can go to whatever challenge of your choosing at no charge. One-time purchase.",
            emoji: {
                name: "💰"
            }
        },
        {
            label: `Peace Treaty`,
            value: 'peace',
            price: 384000000,
            description: "Protect yourself against trugut sabotage",
            info: "Tired of getting sabotaged by your fellow racers? Sign this peace treaty and you can never sabotage or be sabotaged again. One-time purchase.",
            emoji: {
                name: "🕊"
            }
        },

        {
            label: `Trillion Trugut Tri-Coat`,
            value: 'paint',
            price: 1000000000000,
            description: "Your own custom role color",
            info: "After years of slavery to Botto and the random challenges, you can finally afford a decent paint job. Color can be changed at any time. One-time purchase.",
            emoji: {
                name: "🎨"
            }
        },
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
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile")
                .setLabel("Profile")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_about")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❔')
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
            let max = c.data.max_values
            c.options?.forEach(o => {
                if (max && (o.data.value == selection[i] || selection[i]?.includes(o.data.value))) {
                    o.setDefault(true)
                    max--
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

exports.inventoryEmbed = function ({ profile, selection, name, avatar }) {
    let section = selection[1]?.[0]
    let s_selection = selection[2]?.[0]
    let collections = exports.Collections()
    section = inventorySections.find(s => s.value == section)
    let in_repairs = exports.getProfileItems({ profile }).filter(i => exports.isDroid({ item: i }) && i.repairing)
    const myEmbed = new EmbedBuilder()
        .setAuthor({ name: `${name}'s Inventory`, iconURL: avatar })
        .setTitle(":school_satchel: Inventory")
        .setDescription("You've got a-lots of junk!")
        .setColor("#ED4245")

    if (section) {
        myEmbed
            .setTitle(`${section.emoji.name} ${section.label}`)
            .setDescription(section.info)
        if (section.value == 'droids' && in_repairs.length) {
            let additional = ''
            let repair_map = in_repairs.map(droid => {
                return ({
                    name: droid.nick ? droid.nick : items.find(i => i.id == droid.id).name,
                    tasks: droid.tasks ? Object.values(droid.tasks).filter(t => !t.complete).map(t => {
                        let profile_item = profile.items[t.part]
                        let part = items.find(i => i.id == profile_item.id)
                        let part_obj = { ...part, ...profile_item }
                        if (t.date) {
                            let complete_date = t.date + exports.repairDuration({ repair_speed: exports.repairAbility({ droid, profile }).speed, health: profile_item.health })
                            part_obj.end_date = complete_date
                        }
                        return (
                            part_obj
                        )
                    }) : []
                })
            }).sort((a, b) => a.tasks?.[0]?.end_date - b.tasks?.[0]?.end_date)
            if (repair_map.length > 5) {
                additional = `\n\n+${repair_map.slice(5).map(r => r.tasks).length} additional tasks`
                repair_map = repair_map.slice(0, 5)
            }
            repair_map = repair_map.map(droid => `**${droid.name}**\n${droid.tasks.map(t => `<a:sparks:672640526444527647> ${t.name}${t.end_date ? ` <t:${Math.round(t.end_date / 1000)}:R>` : ''}`).join("\n")}`).join("\n")
            myEmbed.addFields({
                name: 'Current Tasks',
                value: repair_map + additional
            })
        }
        if (section.value == 'duplicates') {
            myEmbed.setFooter({ text: `Scrap: ${Object.values(profile.items).filter(i => exports.usableItem({ item: i }) && !i.locked && i.id == 70).length}\nTruguts: 📀${tools.numberWithCommas(exports.currentTruguts(profile))}\n♦ indicates an item is needed for a collection` })
        }
        if (section.value == 'droids') {
            let droid_key = s_selection
            let droid_item = profile.items[droid_key]
            let droid = { ...items.find(i => i.id == droid_item?.id), ...droid_item }
            if (droid) {
                myEmbed.setThumbnail(droid.display_image)
            }

        }
        if (section.abilities.length) {
            myEmbed.addFields({
                name: 'Additional Effects', value: section.abilities.map(a => {
                    let col = collections.find(c => c.key == a)
                    return (`${profile.effects?.[col.key] ? ':white_check_mark:' : '❌'} ${col.reward}`)
                }).join('\n')
            })
        }
    }


    return myEmbed
}

exports.inventoryComponents = function ({ profile, selection, db, interaction }) {

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
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile")
                .setLabel("Profile")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_about")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❔')
        )
    const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_1')
            .setPlaceholder("Inventory")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(...inventorySections)
    )
    let comp = [row1, row2]
    if (selection[1]?.[0] == 'collections') {
        comp.push(...exports.collectionComponents({ profile }))
        if (![null, undefined, ''].includes(selection[2])) {
            comp.push(...exports.itemComponents({ profile, selection }))
        }
        let collections = exports.Collections()
        let selected_collection = collections[Number(selection[2])]
        let rewards = exports.collectionReward({ profile })
        let claimable = !rewards[selected_collection?.key]
        let already_claimed = profile.effects?.[selected_collection?.key]
        claimable = claimable || (already_claimed ? true : false)
        if (!profile.effects?.[selected_collection?.key]) {
            comp.push(new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId('challenge_random_inventory_claim')
                .setLabel(already_claimed ? 'Already Claimed' : 'Claim Reward')
                .setStyle(ButtonStyle.Success)
                .setDisabled(claimable)))
        }
    } else if (selection[1]?.[0] == 'usables') {
        const usables = new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_2')
            .setPlaceholder("Select a usable item")
            .setMinValues(1)
            .setMaxValues(1)

        let usable_items = exports.getUsables({ profile })
        if (usable_items.length) {
            usables.addOptions(...usable_items)
            comp.push(new ActionRowBuilder().addComponents(usables))
        }
        let selected_usable = selection[2]?.[0] ?? null
        if (selected_usable == 'collectible_coffer') {
            const OpenButton = new ButtonBuilder()
                .setCustomId("challenge_random_inventory_coffer")
                .setStyle(ButtonStyle.Primary)
                .setLabel('Open')
            comp.push(new ActionRowBuilder().addComponents(OpenButton))
        } else if (selected_usable == 'sabotage_kit') {
            const OpenButton = new ButtonBuilder()
                .setCustomId("challenge_random_inventory_sabotage")
                .setStyle(ButtonStyle.Danger)
                .setLabel('Sabotage')
                .setDisabled([null, undefined, ""].includes(selection[3]?.[0]))
            comp.push(...exports.userPicker({ selection, row: 3, customid: 'challenge_random_inventory_3', placeholder: 'Select a Player to Sabotage', db }), new ActionRowBuilder().addComponents(OpenButton))
        } else if (selected_usable == 'trugut_boost') {
            const OpenButton = new ButtonBuilder()
                .setCustomId("challenge_random_inventory_boost")
                .setStyle(ButtonStyle.Primary)
                .setLabel('Use')
            comp.push(new ActionRowBuilder().addComponents(OpenButton))
        }
    } else if (selection[1]?.[0] == 'duplicates') {
        let scrappable_items = exports.availableItemsforScrap({ profile })
        let collectible_items = exports.collectibleItems({ profile })
        let selected_item = selection[2]?.[0]
        scrappable_items = scrappable_items.map(item => {
            return ({
                label: `${item.name} ${item.health ? `(${Math.round(item.health * 100 / 255)}%)` : ''}${collectible_items.map(c => c.key).includes(item.key) ? ' ♦' : ''}`,
                value: item.key,
                description: (`📀${tools.numberWithCommas(exports.itemValue({ item }))} | ${item.description}`).slice(0, 100),
                emoji: { name: raritysymbols[item.rarity] },
                id: item.id
            })
        }).sort((a, b) => a.id - b.id)

        let dup_options = exports.paginator({ value: selected_item, array: scrappable_items })
        const dups = new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_2')
            .setPlaceholder("Select an item")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(...dup_options)

        comp.push(new ActionRowBuilder().addComponents(dups))
        function getScrapValue(item) {
            return Math.round(items.find(i => i.id == item?.id)?.value * (profile.effects?.efficient_scrapper ? 1 : 0.5) * (item?.health ? (item?.health / 255) : 1))
        }
        let scrap_value = getScrapValue(profile.items[selected_item])
        const ScrapButton = new ButtonBuilder()
            .setCustomId("challenge_random_inventory_scrap")
            .setStyle(ButtonStyle.Danger)
            .setLabel(`Scrap ${scrap_value ? `(+📀${tools.numberWithCommas(scrap_value)})` : ''}`)
            .setDisabled([null, undefined, ""].includes(selected_item))
        const SarlaccButton = new ButtonBuilder()
            .setCustomId('challenge_random_inventory_sarlacc')
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Feed to Sarlacc')
            .setDisabled([null, undefined, ""].includes(selected_item) || !profile.effects?.sarlacc_snack)

        const buttonRow = new ActionRowBuilder()
        buttonRow.addComponents(ScrapButton, SarlaccButton)
        comp.push(buttonRow)
    } else if (selection[1]?.[0] == 'trade') {

        let selected_user = selection[2]?.[0]
        let main_user_items = exports.availableItemsforTrade({ profile })
        let main_user_needed = exports.getNeededItems({ profile })
        let users = Object.keys(db.user).filter(u => db.user[u].random && Object.values(db.ch.times).filter(t => t.user == db.user[u].discordID).length > 0).sort((a, b) => db.user[a].name.localeCompare(db.user[b].name))
        let descriptions = {}
        let selected_user_tradable = [{
            label: 'No Items',
            description: 'This user has no items you need for a collection. However, you can still trade with them.',
            value: 'no'
        }]
        users = users.filter(u => db.user[u].random?.items).forEach(u => {
            let user_items = exports.availableItemsforTrade({ profile: db.user[u].random })
            let user_needed = exports.getNeededItems({ profile: db.user[u].random })
            let user_tradable = []
            let main_user_tradable = []
            main_user_needed.forEach(id => {
                let needed = user_items.find(i => i.id == id && !user_tradable.map(t => t.key).includes(i.key))
                if (needed) {
                    user_tradable.push(needed)
                }
            })
            user_needed.forEach(id => {
                let needed = main_user_items.find(i => i.id == id && !main_user_tradable.map(t => t.key).includes(i.key))
                if (needed) {
                    main_user_tradable.push(needed)
                }
            })
            if (u == selected_user && user_tradable.length) {
                selected_user_tradable = user_tradable
            }
            descriptions[u] = `[${user_items.length} items] has ${user_tradable.length} item${user_tradable.length !== 1 ? 's' : ''} you need - needs ${main_user_tradable.length} item${main_user_tradable.length !== 1 ? 's' : ''} you have`
        })

        comp.push(...exports.userPicker({ selection, row: 2, customid: 'challenge_random_inventory_2', placeholder: 'Select a Player to Trade', db, descriptions }))
        if (![null, undefined, ''].includes(selected_user)) {
            comp.push(
                new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
                    .setCustomId('challenge_random_inventory_3')
                    .setPlaceholder("Browse tradable items")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(...exports.paginator({
                        value: selection[3]?.[0], array: selected_user_tradable.map(i => {
                            if (i.value == 'no') {
                                return i
                            }
                            return (
                                {
                                    label: i.name,
                                    description: i.description,
                                    value: String(i.key),
                                    emoji: { name: raritysymbols[i.rarity] }
                                }
                            )
                        })
                    }))),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("challenge_random_inventory_trade")
                        .setStyle(ButtonStyle.Primary)
                        .setLabel(`Invite to Trade`)
                        .setDisabled([null, undefined, ""].includes(selected_user)))
            )
        }
    } else if (selection[1]?.[0] == 'droids') {
        let selected_droid = selection[2]?.[0]
        let selected_part = selection[3]?.[0]
        let repairable_items = exports.availableItemsforRepairs({ profile })
        let droids = repairable_items.filter(i => i.repair_speed)
        let parts = repairable_items.filter(i => i.upgrade && i.health < 255)
        droids = droids.map(droid => (
            { ...droid, ...exports.repairAbility({ droid, profile }), level: exports.droidLevel({ droid }) }
        ))


        const droid_select = new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_2')
            .setPlaceholder("Select a droid")
            .setMinValues(1)
            .setMaxValues(1)
        if (droids.length) {
            droid_select.addOptions(...exports.paginator({
                value: selected_droid, array: droids.sort((a, b) => a.repair_speed - b.repair_speed).map(d => ({
                    label: `${d.nick ? d.nick : d.name}`,
                    value: d.key,
                    description: `Level ${d.level + 1} ${d.type} - ${(100 / d.speed).toFixed(1)}%/hr - ${d.tasks ? Object.values(d.tasks).filter(t => !t.complete).length : 0}/${d.parts} parts`,
                    emoji: {
                        name: raritysymbols[d.rarity]
                    }
                }))
            }))
        } else {
            droid_select.addOptions({
                value: 'no',
                label: 'No droids available',
                emoji: {
                    id: '589481340957753363'
                }
            })
        }

        comp.push(new ActionRowBuilder().addComponents(droid_select))
        const part_select = new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_3')
            .setPlaceholder("Select a part")
            .setMinValues(1)
            .setMaxValues(1)
        if (parts.length) {
            part_select.addOptions(...exports.paginator({
                value: selected_part, array: parts.sort((a, b) => a.health - b.health).map(p => ({
                    label: `${p.name} [${Math.round(100 * p.health / 255)}%]`,
                    value: p.key,
                    description: p.description,
                    emoji: {
                        name: raritysymbols[p.rarity]
                    }
                }))
            }))
        } else {
            part_select.addOptions({
                label: 'No parts available',
                value: 'no',
                emoji: {
                    id: '589481340957753363'
                }
            })
        }

        comp.push(new ActionRowBuilder().addComponents(part_select))
        const TaskButton = new ButtonBuilder()
            .setCustomId("challenge_random_inventory_task")
            .setStyle(ButtonStyle.Primary)
            .setLabel(`Task Repairs`)
            .setDisabled([null, undefined, "", 'no'].includes(selected_droid) || [null, undefined, "", 'no'].includes(selected_part))
        const NameButton = new ButtonBuilder()
            .setCustomId('challenge_random_inventory_name')
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Name Droid')
            .setDisabled([null, undefined, ""].includes(selected_droid))
        comp.push(new ActionRowBuilder().addComponents(TaskButton, NameButton))
    } else if (selection[1]?.[0] == 'roles') {

        const citizen_select = new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_2')
            .setPlaceholder("Citizen roles")
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(planets.map(p => {
                let id = p.name.toLowerCase().replaceAll(" ", "_")
                return ({
                    label: `${p.citizen}`,
                    value: p.role,
                    description: profile.effects?.[id] ? `Free bribes and rerolls on ${p.name} tracks` : `Unlocked by completing the ${p.name} Collection`,
                    emoji: {
                        id: p.emoji.split(":")[2].replace(">", "")
                    },
                    default: interaction.member.roles.cache.some(r => r.id === p.role)
                })
            }))
        comp.push(new ActionRowBuilder().addComponents(citizen_select))
        let emoji_roles = profile.roles?.emoji ? Object.values(profile.roles.emoji).map(role => {
            let emoji = Object.values(emojimap).find(e => e.includes(role.emoji_id))
            let emoji_name = emoji.split(":")[1]
            return ({
                label: emoji_name,
                value: role.id,
                emoji: {
                    id: role.emoji_id
                }
            })
        }) : []
        if (emoji_roles.length) {
            emoji_roles.push(
                {
                    label: 'No icon',
                    value: 'no',
                    description: "Clear your role icon",
                }
            )
        } else {
            emoji_roles.push(
                {
                    label: 'No emoji roles',
                    value: 'no',
                    description: "You haven't bought an emoji icon role",
                    emoji: {
                        id: '589481340957753363'
                    }
                }
            )
        }


        const emoji_role_select = new StringSelectMenuBuilder()
            .setCustomId('challenge_random_inventory_icon')
            .setPlaceholder("Emoji icon roles")
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(emoji_roles)
        comp.push(new ActionRowBuilder().addComponents(emoji_role_select))
        const ColorButton = new ButtonBuilder()
            .setCustomId('challenge_random_inventory_tricoat')
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Role Color')
        if (profile?.roles?.custom) {
            comp.push(new ActionRowBuilder().addComponents(ColorButton))
        }

    }

    let selectable = []
    comp.forEach((row, i) => {
        row.components.filter(c => c.options).forEach(c => {
            c.options?.forEach(o => {
                if (o.data.value.split(":")[0] == selection[i]?.[0]) {
                    o.setDefault(true)
                }
            })
            let selectmap = c.options.map(o => o.data.default)
            selectable.push(selectmap.includes(true) && selectmap.filter(f => f)?.length >= c.data.min_values)
        })
    })

    return comp
}



exports.Collections = function () {
    const coll = [...collections].sort((a, b) => a.items.length - b.items.length)
    planets.forEach((planet, p) => {
        coll.push({
            name: planet.name,
            value: String(coll.length),
            emoji: planet.emoji.split(":")[2].replace(">", ""),
            reward: 'Citizenship Role; 📀100,000',
            planet: true,
            key: planet.name.toLowerCase().replaceAll(" ", "_"),
            items: items.filter(i => i.track.map(track => tracks[track].planet == p).includes(true) && i.track.length < 25).slice(0, 25).map(i => i.id)
        })
    })

    return coll
}

exports.itemComponents = function ({ profile, selection }) {
    let selected_collection = selection[2]?.[0]
    if ([null, undefined, ""].includes(selected_collection) || isNaN(Number(selected_collection))) {
        return []
    }
    let coll = exports.Collections()
    const raritymap = {
        common: { score: 0, emoji: '🟢' },
        uncommon: { score: 1, emoji: '🔵' },
        rare: { score: 2, emoji: '🟪' },
        legendary: { score: 3, emoji: '🟡' }
    }
    let options = items.filter(i => coll[selected_collection]?.items.includes(i.id))
        .sort((a, b) => raritymap[a.rarity].score - raritymap[b.rarity].score)
        .map(i => (
            {
                label: profile.items ? Object.values(profile.items).map(i => i.id).includes(i.id) ? i.name : '???' : '???',
                value: String(i.id),
                emoji: raritymap[i.rarity].emoji,
                description: `📀${tools.numberWithCommas(i.value)} (${i.rarity}) `
            }))
    const item_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_inventory_3')
        .setPlaceholder("View Items")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(...exports.paginator({ value: selection[3]?.[0], array: options }))
    const row = new ActionRowBuilder().addComponents(item_selector)
    return [row]
}

exports.collectionComponents = function ({ profile }) {

    let coll = exports.Collections()
    let rewards = exports.collectionReward({ profile })

    const collection_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_inventory_2')
        .setPlaceholder("View Collections")
        .setMinValues(1)
        .setMaxValues(1)

    let collectible_items = exports.availableItemsforCollection({ profile })

    coll.forEach((collection, i) => {
        const owned = collection.key == 'chance_cube' ? Math.min(3, collectible_items.filter(i => i.id == 95).length) + Math.min(3, collectible_items.filter(i => i.id == 96).length) : [...new Set(Object.values(collectible_items).map(i => i.id))].filter(i => collection.items.includes(i)).length
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(`${rewards[collection.key] && !profile.effects?.[collection.key] ? '[CLAIM REWARD] ' : ''}${collection.name}`)
            .setValue(String(i))
            .setEmoji(profile.effects?.[collection.key] ? '✅' : collection.emoji)
        if (!profile.effects?.[collection.key]) {
            option.setDescription(`Items: ${owned}/${collection.key == 'chance_cube' ? 6 : collection.items.length} | Reward: ${collection.reward.split(" - ")[0]}`)
        }
        collection_selector.addOptions(option)
    })

    const row = new ActionRowBuilder().addComponents(collection_selector)
    return [row]
}

exports.usableItem = function ({ item } = {}) {
    return ![item.used ? true : false, item.fed ? true : false, item.scrapped ? true : false].includes(true)
}

exports.profileEmbed = function ({ name, avatar, ach_report, profile, stats, db, player } = {}) {
    let bet_wins = []
    Object.values(db.ty.bets).forEach(b => {
        ['outcome_a', 'outcome_b'].forEach(o => {
            if (b[o].bets && Object.values(b[o].bets).map(i => i.discordId).includes(player)) {
                bet_wins.push(b[o].winner)
            }
        })
    })

    const profileEmbed = new EmbedBuilder()
        .setAuthor({ name: name, iconURL: avatar })
        .setFooter({ text: '/challenge random: profile' })
        .setColor('#DA373C')
        .setDescription(`${exports.playerLevel(Object.values(stats.racers).map(r => r.level)).string}\n\`📀${exports.currentTruguts(profile)}\``)
        .addFields({
            name: 'Overview',
            value: `Challenges: \`${stats.totals.total}\`
Playtime: \`${tools.timefix(stats.times.total)}\`
Longest Streak: \`${Math.max(...stats.totals.streaks)} Days\`
Achievements: \`${Object.values(ach_report).filter(a => a.count >= a.limit).length}/${Object.values(ach_report).length}\`
Items: \`${profile.items ? [...new Set(Object.values(profile.items).map(i => i.id))].length : 0}/218\`` +
                `${bet_wins.length ? `\nBets: \`${bet_wins.filter(b => b).length}/${bet_wins.length}\`` : ''}`,
            inline: true
        }, {
            name: "Conditions",
            value: "Standard: `" + stats.totals.standard +
                "`\nSkips: `" + stats.totals.skips +
                "`\nNo Upgrades: `" + stats.totals.no_upgrades +
                "`\nNon 3-Lap: `" + stats.totals.non_3_lap +
                "`\nMirrored: `" + stats.totals.mirrored +
                "`\nBackwards: `" + stats.totals.backwards + "`",
            inline: true
        }, {
            name: "Times",
            value: "<:diamond:1136554333723435068> `" + stats.times.elite + "`\n" +
                "<:platinum:1136554336705597510> `" + stats.times.pro + "`\n" +
                "<:gold:1136554335426318406> `" + stats.times.rookie + "`\n" +
                "<:silver:1136554338895011850> `" + stats.times.amateur + "`\n" +
                "<:bronze:1136554332586786879> `" + stats.times.youngling + "`",
            inline: true
        }, {
            name: "Bonuses",
            value: `:snowflake: \`${stats.bonuses.first}\`
Bop \`${stats.bonuses.opponents_beat}\`
PB \`${stats.bonuses.pbs}\`
Non-Standard: \`${stats.bonuses.non_standard}\``,
            inline: true
        }, {
            name: "Purchases",
            value: "Rerolls: `" + stats.purchases.rerolls + "`\n" +
                "Track Bribes: `" + stats.purchases.track_bribes + "`\n" +
                "Racer Bribes: `" + stats.purchases.racer_bribes + "`\n" +
                "Hints: `" + stats.purchases.hints + "`\n",
            inline: true
        })

    return profileEmbed
}

exports.profileComponents = function ({ stats, ach_report, profile }) {

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

        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_profile")
                .setLabel("Profile")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👤')
                .setDisabled(true)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_about")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❔')
        )


    const achievement_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_profile_ach')
        .setPlaceholder("View Achievement Progress")
        .setMinValues(1)
        .setMaxValues(1)

    Object.keys(ach_report).forEach(key => {
        achievement_selector.addOptions({
            label: ach_report[key].name,
            value: key,
            description: (ach_report[key].description + ": " + tools.numberWithCommas(ach_report[key].count) + "/" + tools.numberWithCommas(ach_report[key].limit)).substring(0, 50),
            emoji: {
                name: ach_report[key].count >= ach_report[key].limit ? "✅" : "🏆"
            }
        })
    })

    const row2 = new ActionRowBuilder().addComponents(achievement_selector)
    const row3 = exports.racerSelector({ customid: 'challenge_random_profile_racer', placeholder: 'View Racer Progression', min: 1, max: 1, descriptions: Object.values(stats.racers).map((r, i) => (`▶${r.plays} 👍${r.likes} 👎${r.dislikes} | ${exports.convertLevel(r.level).string}: ${levels[exports.convertLevel(r.level).level]}`).replaceAll("`", "")) })
    const row4 = exports.trackSelector({ customid: 'challenge_random_profile_track', placeholder: 'View Track Stats', min: 1, max: 1, descriptions: Object.values(stats.tracks).map(r => `▶${r.plays} 👍${r.likes} 👎${r.dislikes}`) })
    const row5 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_settings_initial")
                .setLabel("Settings")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
        )
    return [row1, row2, row3, row4, row5].flat()
}

exports.playerLevel = function (progression) {
    function average(array) {
        return array.reduce((x, y) => x + y) / array.length
    }
    let level = Math.floor(average(Object.values(progression).map(r => {
        let level = exports.convertLevel(r)
        return level?.level
    })))
    return {
        level: level + 1,
        string: `${level_symbols[Math.min(Math.floor(level / 4), 6)]} *${levels[Math.min(level, 24)]}*`
    }
}

exports.convertLevel = function (int) {
    let acc = 0
    let level = { level: 0, nextlevel: 0, sublevel: 0 }
    if (int > 324) {
        let l = 25 + Math.floor((int - 325) / 25)
        level = { level: l, nextlevel: l + 1, sublevel: (int - 325) % 25 }
        level.string = `Level ${level.level + 1} \`${level.sublevel}/25\``
        return level
    }
    for (let i = 0; i < 25; i++) {
        if (int >= acc) {
            level = { level: i, nextlevel: (i + 1), sublevel: int - acc }
        }
        acc += (i + 1)
    }
    level.string = `Level ${level.level + 1} \`${level.sublevel}/${level.nextlevel}\``
    return level
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
            backwards: 0,
            streaks: []
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
        racers: {},
        tracks: {}
    }
    for (let i = 0; i < 25; i++) {
        if (i < 23) {
            stats.racers[i] = { plays: 0, likes: 0, dislikes: 0, level: 0 }
        }
        stats.tracks[i] = { plays: 0, likes: 0, dislikes: 0 }
    }
    stats.bonuses.total_earnings = profile.truguts_earned
    stats.purchases.total_spending = profile.truguts_spent
    if (profile.purchases) {
        Object.values(profile.purchases).forEach(purchase => {
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
    let streak = {
        start: null,
        end: null
    }
    Object.values(db.ch.times).filter(challenge => !Array.isArray(challenge.track)).forEach(challenge => {
        if (challenge.user == member) {
            if (streak.start === null) {
                streak.start = challenge.date
            }
            if (streak.end === null) {
                streak.end = challenge.date
            } else if (challenge.date - (1000 * 60 * 60 * 36) < streak.end) { //streak continues
                streak.end = challenge.date
            } else { //streak broken
                stats.totals.streaks.push(Math.floor((streak.end - streak.start) / 1000 / 60 / 60 / 24))
                streak.start = challenge.date
                streak.end = challenge.date
            }
            stats.totals.total++
            stats.racers[String(challenge.racer)].plays++
            if (!Array.isArray(challenge.track)) {
                stats.tracks[String(challenge.track)].plays++
            }

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
                stats.racers[String(challenge.racer)].level += (5 - goal_time)
            }
            //stats
            if (!challenge.conditions.mirror && !challenge.conditions.nu && !challenge.conditions.skips && challenge.conditions.laps == 3 && !challenge.conditions.backwards) {
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
    stats.totals.streaks.push(Math.floor((streak.end - streak.start) / 1000 / 60 / 60 / 24))
    Object.values(db.ch.feedback).filter(f => f.user == member).forEach(f => {
        if (f.feedback == '👍') {
            stats.racers[String(f.racer)].likes++
            if (!Array.isArray(f.track)) {
                stats.tracks[String(f.track)].likes++
            }

        } else {
            stats.racers[String(f.racer)].dislikes++
            if (!Array.isArray(f.track)) {
                stats.tracks[String(f.track)].dislikes++
            }

        }
    })

    return stats
}

exports.shopEmbed = function ({ shoptions, selection, profile }) {
    const selected = shoptions.find(o => o.value == selection[1]?.[0])

    const myEmbed = new EmbedBuilder()
        .setAuthor({ name: "Random Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setTitle(":shopping_cart: " + (selected ? selected.label : 'Shop'))
        .setColor("#ED4245")
        .setDescription((selected ? selected.info : "Welcome to Botto's Shop!"))
        .setFooter({ text: `Truguts: 📀${exports.currentTruguts(profile)}` })

    if (selected?.fields) {
        myEmbed.addFields(...selected.fields)
    }
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
        .setCustomId('challenge_random_shop_3')
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
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder("Select Hint")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < hints.length; i++) {
        hint_selector.addOptions(
            {
                label: hints[i].name,
                value: hints[i].value,
                description: "📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description,
                emoji: {
                    name: "💡"
                }
            }
        )
    }

    const row1 = new ActionRowBuilder().addComponents(achievement_selector)
    const row2 = new ActionRowBuilder().addComponents(hint_selector)
    return achievement_selector.options.length ? [row2, row1] : []
}

exports.huntComponents = function (profile) {
    const hint_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder("Select Bounty Type")
        .setMinValues(1)
        .setMaxValues(1)
    for (i = 0; i < hints.length; i++) {
        hint_selector.addOptions(
            {
                label: hints[i].hunt,
                value: hints[i].value,
                description: "Price: 📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description + " | Bonus: 📀" + tools.numberWithCommas(hints[i].bonus),
                emoji: {
                    name: "🎯"
                }
            }
        )
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
    let comp = [row1, row2]
    if (profile.effects?.nav_computer) {
        comp = [row1, row2, ...exports.navComponents({ context: 'settings', profile })]
    }
    return comp
}

exports.racerHint = function ({ racer, count, db } = {}) {
    let hints = racer_hints[racer]
    let userhints = Object.values(db.ch.clues).filter(h => h.type == 'racer' && h.selection == racer).map(h => h.clue)
    const hint_shuffle = [...hints, ...userhints].sort(() => 0.5 - Math.random())
    return hint_shuffle.slice(0, count + 1)
}

exports.trackHint = function ({ track, count, db } = {}) {
    let hints = track_hints[track]
    let userhints = Object.values(db.ch.clues).filter(h => h.type == 'track' && h.selection == track).map(h => h.clue)
    const hint_shuffle = [...hints, ...userhints].sort(() => 0.5 - Math.random())
    return hint_shuffle.slice(0, count + 1)
}

exports.sponsorPlayerComponents = function ({ selection, db }) {
    let take_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder('Select Sponsorship Level')
        .setMinValues(1)
        .setMaxValues(1)
    take_selector.addOptions({
        label: '📀50,000 Sponsorship',
        value: '5',
        description: '5% Kickback'
    }, {
        label: '📀100,000 Sponsorship',
        value: '10',
        description: '10% Kickback'
    }, {
        label: '📀200,000 Sponsorship',
        value: '20',
        description: '20% Kickback'
    })

    const row = new ActionRowBuilder().addComponents(take_selector)
    return [row, ...exports.userPicker({ selection, row: 3, customid: 'challenge_random_shop_3', placeholder: 'Select a Player to Sponsor', db })]

}

exports.clueComponents = function ({ selection }) {
    const type_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder("Select Clue Type")
        .setMinValues(1)
        .setMaxValues(1)

    type_selector.addOptions({
        label: 'Racer',
        value: 'racer',
        description: 'submit a racer clue'
    },
        {
            label: 'Track',
            value: 'track',
            description: 'submit a track clue'
        })

    const row1 = new ActionRowBuilder().addComponents(type_selector)
    let comp = [row1]
    if (selection[2]?.[0] == 'track') {
        comp.push(...exports.trackSelector({ customid: 'challenge_random_shop_3', placeholder: 'Select a Track', min: 1, max: 1 }))
    } else if (selection[2]?.[0] == 'racer') {
        comp.push(...exports.racerSelector({ customid: 'challenge_random_shop_3', placeholder: 'Select a Racer', min: 1, max: 1 }))
    }
    return comp
}

exports.multiplierComponents = function ({ selection }) {
    const multi_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_shop_2')
        .setPlaceholder('Select a Multiplier')
        .setMinValues(1)
        .setMaxValues(1)
    let titles = ['Di', 'Tetra', 'Hexa', 'Octa', 'Deca']
    let prices = [1000000, 2000000, 8000000, 48000000, 384000000]
    for (let i = 0; i < 5; i++) {
        multi_selector.addOptions({
            label: `${titles[i]}-Cloner (📀${tools.numberWithCommas(prices[i])})`,
            value: String((i + 1) * 2),
            description: `${(i + 1) * 2}× Multiplier | Must be level ${(i + 1) * 5} or greater`
        })
    }

    const row1 = new ActionRowBuilder().addComponents(multi_selector)
    return [row1]
}

exports.navComponents = function ({ context, profile } = {}) {
    const multi_selector = new StringSelectMenuBuilder()
        .setCustomId(context == 'shop' ? 'challenge_random_shop_2' : 'challenge_random_settings_nav')
        .setPlaceholder('Nav Computer')
        .setMinValues(context == 'settings' ? 0 : 1)
        .setMaxValues(1)

    let options = [{
        label: `Mid Rim Territories${context == 'shop' ? '(📀2,000,000)' : ''}`,
        value: "1",
        description: `Botto will only roll challenges that apply to unearned achievements.`
    },
    {
        label: `Outer Rim Territories${context == 'shop' ? '(📀8,000,000)' : ''}`,
        value: "2",
        description: `Botto will only roll challenges that the user has not played.`
    },
    {
        label: `Unknown Regions${context == 'shop' ? '(📀48,000,000)' : ''}`,
        value: "3",
        description: `Botto will only roll challenges that have no submissions.`
    }]

    if (context == 'settings') {
        options = options.filter(o => profile.effects?.nav_computer?.[o.value]).map(o => ({
            ...o, default: profile?.settings?.nav && Object.values(profile?.settings?.nav).includes(o.value)
        }))
    }
    multi_selector.addOptions(options)
    const row1 = new ActionRowBuilder().addComponents(multi_selector)
    return [row1]
}

exports.sponsorEmbed = function (sponsorchallenge, profile, db) {
    let title = sponsorchallenge?.title ?? ""
    const sponsorEmbed = new EmbedBuilder()
        .setTitle((title ? `*"${title}"*\n` : '') + exports.generateChallengeTitle(sponsorchallenge))
        .setAuthor({ name: "Sponsored Challenge", iconURL: "https://em-content.zobj.net/thumbs/120/twitter/322/game-die_1f3b2.png" })
        .setDescription("Step 1: Set a custom title and time\nStep 2: Publish your challenge and get players to complete it\nStep 3: Profit")
        .setFooter({ text: "Truguts: 📀" + exports.currentTruguts(profile) })
        .setColor("#ED4245")

    let time = exports.validateTime(sponsorchallenge?.time) ?? null
    let best = Object.values(db.ch.times).filter(t => exports.matchingChallenge(t, sponsorchallenge))
    if (time) {
        best.push({
            time: time,
            sponsor: true,
            user: sponsorchallenge.sponsor.member,
            name: sponsorchallenge.sponsor.name
        })
    }
    sponsorEmbed.addFields(
        { name: "Goal Times", value: exports.goalTimeList(sponsorchallenge, null, best).list, inline: true },
        { name: 'Best Times', value: exports.generateLeaderboard(best, null, sponsorchallenge) ?? 'No times', inline: true }
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

exports.monthlyChallenge = async function ({ client, challengesref, db, database } = {}) {
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
    if (!recent.lotto) {
        function trackMatch(a, b) {
            return a.map(i => b.includes(Number(i))).filter(i => i).length
        }

        let tickets = Object.values(db.ch.lotto).filter(t => moment(t.date).tz('America/New_York').month() == (recent.month - 1) && trackMatch(t.tracks, recent.track) > 0).sort((a, b) => trackMatch(a.tracks, recent.track) - trackMatch(b.tracks, recent.track))
        function winner(count, tracks) {
            return count >= Math.min(7, tracks.length)
        }
        let winners = tickets.map(t => ({ user: t.user, count: trackMatch(t.tracks, recent.track) }))
        winners.forEach(w => w.winner = winner(w.count, recent.track))

        //award truguts
        winners.forEach(w => {
            let userkey = Object.keys(db.user).find(u => db.user[u].discordID == w.user)
            w.winnings = w.winner ? 1000000 : w.count * 20000
            exports.manageTruguts({ profile: db.user[userkey].random, profileref: database.ref(`users/${userkey}/random`), transaction: 'd', amount: w.winnings })
        })

        const winnersEmbed = new EmbedBuilder()
            .setTitle("🎰 This Month's Botto Lotto Winners")
            .setDescription(
                winners.map(w =>
                    `<@${w.user}> - ${w.winner ? 'WINNER <a:sparks:672640526444527647> `+📀1,000,000`' : `\`+📀${tools.numberWithCommas(w.winnings)}\``}`).join("\n"))
        postMessage(client, '551786988861128714', { embeds: [winnersEmbed] })
        challengesref.child(recent.message).update({ lotto: true })
    }
}

exports.dailyChallenge = async function ({ client, challengesref, db } = {}) {
    let recent = null
    let lastfive = []

    if (db.ch.challenges) {
        Object.values(db.ch.challenges).filter(c => c.type == 'cotd' && !c.rerolled).sort((a, b) => b.created - a.created).slice(0, 5).forEach(challenge => {
            lastfive.push(challenge)
            if (!recent || recent.created - challenge.created < 0) {
                recent = { ...challenge }
            }
        })
    }
    if (exports.easternTime().dayOfYear() !== recent.day) {
        const SWE1R_Guild = await client.guilds.cache.get("441839750555369474")
        await SWE1R_Guild.edit({ banner: banners[Math.floor(Math.random() * banners.length)] })
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
        let message = await postMessage(client, '551786988861128714', { embeds: [exports.bountyEmbed({ bounty, profile, db })] }) //551786988861128714
        bounty.url = message.url
        bounty.message = message.id
        bounty.channel = message.channelId
        bountyref.push(bounty)
        message.pin()
    }

}

exports.bountyEmbed = function ({ bounty, profile, db } = {}) {
    const bEmbed = new EmbedBuilder()
        .setTitle(":dart: " + (bounty.type == 'botd' ? "Bounty of the Day" : hints[bounty.r_hints].hunt))
        .setColor("#ED4245")
        .addFields(
            { name: "Track Leads", value: exports.trackHint({ track: bounty.track, count: bounty.t_hints, db }).map(h => "○ *" + h + "*").join("\n") },
            { name: "Racer Leads", value: exports.racerHint({ racer: bounty.racer, count: bounty.r_hints, db }).map(h => "○ *" + h + "*").join("\n") }
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

exports.initializeBounty = function (type, h, player, profile) {
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
        bounty.r_hints = h + (profile.effects?.movie_buff ? 1 : 0)
        bounty.t_hints = h + (profile.effects?.movie_buff ? 1 : 0)
        bounty.bonus = hints[h].bonus
    }
    return bounty
}

exports.manageTruguts = function ({ profile, profileref, transaction, amount, purchase } = {}) {
    console.log(`${profile.name} ${transaction} ${amount}`)
    if (transaction == 'w') {
        profile.truguts_spent += amount
    } else if (transaction == 'd') {
        profile.truguts_earned += amount
    } else if (transaction == 'r') {
        profile.truguts_spent -= amount
    }
    profileref.update({
        truguts_spent: profile.truguts_spent,
        truguts_earned: profile.truguts_earned
    })
    if (transaction == 'w' && purchase) {
        profileref.child("purchases").push(purchase)
    }
    return profile
}

exports.currentTruguts = function (profile) {
    return tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent)
}

exports.randomChallengeItem = function ({ profile, current_challenge, db, member, coffer, sarlacc } = {}) {
    const challenges_completed = Object.values(db.ch.times).filter(time => time.user == member).length
    let item_pool = []
    let special_items = [{ id: 'collectible_coffer' }, { id: 'trugut_boost' }, { id: 'sabotage_kit' }]
    items.forEach(item => {
        if (coffer || sarlacc || (item.challenges !== null && challenges_completed > item.challenges) || current_challenge.conditions[item.condition] || item.track.includes(current_challenge.track) || item.racer.includes(current_challenge.racer)) {
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
    let owned_ids = profile.items ? Object.values(profile.items).map(item => item.id) : []
    if (owned_ids.includes(random_item.id) && Math.random() < (sarlacc || profile.effects?.favor_ancients ? 0.85 : 0.15)) {
        let new_pool = rarity_pool.filter(item => !owned_ids.includes(item.id))
        if (new_pool.length) {
            random_item = new_pool[Math.floor(Math.random() * new_pool.length)]
        } else {
            //if there are no new items, give player a special item
            random_item = special_items[Math.floor(Math.random() * special_items.length)]
        }
    }

    if (random_item.health) {
        random_item.health = Math.floor(Math.random() * 256)
    }

    return random_item
}

exports.openCoffer = function ({ profile, db, member } = {}) {
    let coffer_items = []

    for (let j = 0; j < 4; j++) {
        coffer_items.push(exports.randomChallengeItem({ profile, current_challenge: null, db, member, coffer: true }))
    }

    return coffer_items
}

exports.userPicker = function ({ selection, row, customid, placeholder, db, descriptions } = {}) {
    //let selected_user = selection[2].sel
    const userselector = new StringSelectMenuBuilder()
        .setCustomId(customid)
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(1)
    let users = Object.keys(db.user).filter(u => db.user[u].random && Object.values(db.ch.times).filter(t => t.user == db.user[u].discordID).length > 0).sort((a, b) => db.user[a].name.localeCompare(db.user[b].name))


    users = users.filter(u => descriptions ? descriptions[u] : true).map(u => {
        return (
            {
                label: db.user[u].name,
                value: String(u),
                description: descriptions ? descriptions[u] : `${Object.values(db.ch.times).filter(t => t.user == db.user[u].discordID).length} submissions | 📀${tools.numberWithCommas(db.user[u].random.truguts_earned)} earned`,
                emoji: db.user[u].random.progression ?
                    {
                        id: level_symbols[Math.min(Math.floor(exports.playerLevel(db.user[u].random.progression).level / 4), 6)].split(":")[2].replace(">", "")
                    } :
                    {
                        name: '◼'
                    }
            }
        )
    })

    userselector.addOptions(
        ...exports.paginator({
            value: selection[row]?.[0], array: users
        })
    )

    const row1 = new ActionRowBuilder().addComponents(userselector)
    return [row1]
}

exports.collectionReward = function ({ profile }) {
    let rewards = {}
    let collections = exports.Collections()
    if (!profile.items) {
        return rewards
    }
    collections.forEach(collection => {
        let collection_items = Object.values(profile.items).filter(i => ![i.scrapped, i.fed, i.used, i.locked].includes(true)).map(i => i.id).filter(item => collection.items.includes(item))
        if (collection.key == 'chance_cube') {
            if (collection_items.filter(i => i == 95).length >= 3 && collection_items.filter(i => i == 96).length >= 3) {
                rewards.chance_cube = true
            }
        } else if ([...new Set(collection_items)].length >= collection.items.length) {
            rewards[collection.key] = true
        }
    })
    return rewards
}

exports.collectionRewardEmbed = function ({ key, name, avatar }) {
    let collection = exports.Collections().find(c => c.key == key)
    const congratsEmbed = new EmbedBuilder()
        .setAuthor({ name: name + " completed a collection!", iconURL: avatar })
        .setDescription(`Reward: ${collection.reward}`)
        .setColor("FFB900")
        .setTitle(`${collection.emoji} ${collection.name}`)
    return congratsEmbed
}

exports.itemString = function ({ item, profile }) {
    let dup = (profile?.items ? Object.values(profile.items).filter(i => i.id == item.id).length > 1 ? true : false : false) && !['collectible_coffer', 'trugut_boost', 'sabotage_kit'].includes(item.id)
    return `${raritysymbols[item.rarity]} ${item.name}` + (item.health ? ` [${Math.round(item.health * 100 / 255)}%]` : '') + (dup ? " (duplicate)" : "")
}

exports.collectionRewardUpdater = function ({ profile, client, interaction, profileref, name, avatar } = {}) {
    //collection rewards
    let collection_rewards = exports.collectionReward({ profile })
    let planet_keys = planets.map(p => p.name.toLowerCase().replaceAll(" ", "_"))
    Object.keys(collection_rewards).forEach(key => {
        if (!profile[key]) {
            postMessage(client, interaction.channelId, { embeds: [exports.collectionRewardEmbed({ key, name, avatar })] })
            if (planet_keys.includes(key)) {
                exports.manageTruguts({ profile, profileref, transaction: 'd', amount: 100000 })
            }
        }
    })
    profileref.child('effects').update(collection_rewards)
}

exports.paginator = function ({ value, array } = {}) {
    if (array.length < 25) {
        return array
    } else {
        let index = array.map(a => a.value).indexOf(value) ?? 0
        let page_length = 21
        let page = Math.max(0, value?.includes('page_') ? Number(value.replace('page_', '')) : Math.floor(index / page_length))
        let max_pages = Math.floor(array.length / page_length)

        return [
            page > 1 ? {
                label: `Page 1`,
                value: `page_${0}`,
                emoji: {
                    name: '⏮'
                }
            } : null,
            page > 0 ? {
                label: `Page ${page}`,
                value: `page_${page - 1}`,
                emoji: {
                    name: '◀'
                }
            } : null,
            ...array.slice(page_length * page, page_length * (page + 1)),
            page < max_pages ? {
                label: `Page ${page + 2}`,
                value: `page_${page + 1}`,
                emoji: {
                    name: '▶'
                }
            } : null,
            page < max_pages - 1 ? {
                label: `Page ${max_pages + 1}`,
                value: `page_${max_pages}`,
                emoji: {
                    name: '⏭'
                }
            } : null,
        ].filter(o => o !== null)

    }
}

exports.tradeEmbed = function ({ trade, db } = {}) {
    let traders = Object.keys(trade.traders)
    const tradeEmbed = new EmbedBuilder()
        .setTitle(trade.completed ? ':handshake: Successful Trade :handshake:' : ':warning: Trade Offer :warning:')
        .setColor("#ED4245")

    if (!trade.completed) {
        tradeEmbed
            .setFooter({ text: '♦ indicates item is needed for a collection by its current owner' })
            .setImage("https://media.discordapp.net/attachments/1135800422066556940/1152866985391161384/trade_image.png")
    }
    traders.forEach(key => {
        let other = traders.filter(k => k !== key)
        let other_name = db.user[other].name
        let trade_items = (trade.traders[key].items ? Object.values(trade.traders[key].items).map(i => {
            let item = db.user[trade.completed ? other : key].random.items[i]
            let enriched_item = { ...items.find(j => j.id == item?.id), ...item }
            return (
                {
                    string: exports.itemString({ item: enriched_item }),
                    value: exports.itemValue({ item: enriched_item })
                }
            )
        }) : null)
        tradeEmbed.addFields({
            name: `${other_name} receive${trade.completed ? 'd' : 's'}:`,
            value: (trade.traders[key].truguts ? `\`📀${tools.numberWithCommas(trade.traders[key].truguts)}\`\n` : '') +
                (trade_items ? `${trade_items.map(i => i.string).join("\n")}\n\nTotal value: \`📀${tools.numberWithCommas(trade_items.reduce((a, b) => a + Number(b.value), 0) + trade.traders[key].truguts)}\`` : '') +
                (!trade.traders[key].truguts && !trade.traders[key].items ? 'nothing' : ''), inline: true
        })
    })
    return tradeEmbed
}

exports.tradeComponents = function ({ trade, db, selection } = {}) {
    let comp = []
    let traders = Object.keys(trade.traders)
    let tradables = {}
    let collections = exports.Collections()
    traders.forEach(key => {
        let player_items = db.user[key].random.items
        tradables[key] = {
            name: db.user[key].name,
            selected: trade.traders[key].items ? Object.values(trade.traders[key].items) : [],
            items: Object.keys(player_items).map(k => ({ ...items.find(i => i.id == player_items[k].id), ...items[k], key: k })).filter(i => exports.usableItem({ item: i }) && !i.locked),
        }
    })

    traders.forEach(key => {
        let other_player = traders.filter(k => k !== key)[0]
        let other_items = tradables[other_player].items
        tradables[key].tradable = tradables[key].items.filter(i => !other_items.map(j => j.id).includes(i.id) || (['trugut_boost', 'sabotage_kit', 'collectible_coffer'].includes(i.id)))
        let collectible = []
        collections.filter(c => !db.user[key].random.effects?.[c.key]).forEach(c => {
            c.items.forEach(i => {
                let collect = tradables[key].tradable.find(j => j.id == i && !collectible.includes(j.key))
                if (collect) {
                    collectible.push(collect.key)
                }
            })
        })
        tradables[key].tradable = tradables[key].tradable.map(i => ({ ...i, collectible: collectible.includes(i.key) }))
    })
    const raritymap = {
        'common': 0,
        'uncommon': 1,
        'rare': 2,
        'legendary': 3
    }
    traders.forEach((key, index) => {
        comp.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`challenge_random_trade_${index}`)
            .setPlaceholder(`Select items from ${tradables[key].name}`)
            .setMinValues(0)
            .addOptions(...exports.paginator({
                value: selection?.[index]?.[0], array: tradables[key].tradable.sort((a, b) => a.rarity == b.rarity ? a.name == b.name ? a.date - b.date : a.name.localeCompare(b.name) : raritymap[b.rarity] - raritymap[a.rarity]).map(t => (
                    {
                        label: `${tradables[key].selected.includes(t.key) ? '[TRADING] ' : ''}${t.name} ${t.health ? `(${Math.round(t.health * 100 / 255)}%)` : ``}${t.collectible ? ' ♦' : ''}`,
                        value: t.key,
                        description: (`📀${tools.numberWithCommas(exports.itemValue({ item: t }))} | ${tradables[key].selected.includes(t.key) ? 'Select to remove' : t.description}`).slice(0, 100),
                        emoji: { name: tradables[key].selected.includes(t.key) ? '↔' : raritysymbols[t.rarity] },
                    }
                ))
            }))))
    })

    const TrugutButton = new ButtonBuilder()
        .setCustomId("challenge_random_trade_truguts")
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`Truguts`)
    const AgreeButton = new ButtonBuilder()
        .setCustomId("challenge_random_trade_agree")
        .setStyle(ButtonStyle.Success)
        .setLabel(`Agree to Trade [${Object.values(trade.traders).map(t => t.agreed).filter(t => t).length}/2]`)
        .setDisabled(!Object.values(trade.traders).map(t => t.truguts > 0).includes(true) && !Object.values(trade.traders).map(t => t.items ? true : false).includes(true))
    const ResetButton = new ButtonBuilder()
        .setCustomId("challenge_random_trade_reset")
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`Reset`)

    const CancelButton = new ButtonBuilder()
        .setCustomId("challenge_random_trade_cancel")
        .setStyle(ButtonStyle.Danger)
        .setLabel(`Cancel`)

    comp.push(new ActionRowBuilder().addComponents(AgreeButton, TrugutButton, ResetButton, CancelButton))
    return comp
}

exports.itemValue = function ({ item } = {}) {
    return Math.round(item.value * (item.health ? (item.health / 255) : 1))
}

exports.getProfileItems = function ({ profile } = {}) {
    return profile.items ? Object.keys(profile.items).map(key => {
        let item = items.find(i => i.id == profile.items[key].id)
        return ({ ...item, ...profile.items[key], key })
    }
    ).filter(i => exports.usableItem({ item: i })) : []
}

exports.availableItemsforCollection = function ({ profile } = {}) {
    return exports.getProfileItems({ profile }).filter(i => !i.locked)
}

exports.collectibleItems = function ({ profile } = {}) {
    let profile_items = exports.availableItemsforCollection({ profile })
    let collections = exports.Collections()
    let collectible_items = []
    collections.filter(c => !profile.effects?.[c.key]).forEach(c => {
        c.items.forEach(i => {
            let collectible = profile_items.find(p => p.id == i && !collectible_items.map(c => c.key).includes(p.key))
            if (collectible) {
                collectible_items.push(collectible)
            }
        })
    })
    return collectible_items
}

exports.availableItemsforTrade = function ({ profile } = {}) {
    return exports.getProfileItems({ profile }).filter(i => ![i.locked ? true : false, i.repairing ? true : false].includes(true))
}

exports.availableItemsforScrap = function ({ profile } = {}) {
    return exports.getProfileItems({ profile }).filter(i => ![i.locked ? true : false, i.repairing ? true : false].includes(true) && !['trugut_boost', 'sabotage_kit', 'collectible_coffer', 70].includes(i.id))
}

exports.availableItemsforRepairs = function ({ profile } = {}) {
    return exports.getProfileItems({ profile }).filter(i => !(i.upgrade && i.repairing) && !(exports.isDroid({ item: i }) && (i.tasks ? Object.values(i.tasks).filter(t => !t.complete).length : 0) >= exports.repairAbility({ droid: i, profile }).parts))
}

exports.getUsables = function ({ profile } = {}) {
    let usables = exports.getProfileItems({ profile })
    const specials = [
        {
            value: 'collectible_coffer',
            emoji: {
                name: '🎁'
            }
        },
        {
            value: 'sabotage_kit',
            emoji: {
                name: '💥'
            }
        },
        {
            value: 'trugut_boost',
            emoji: {
                name: '⚡'
            }
        }
    ]
    return [...specials].map(i => ({ ...i, label: `${items.find(j => j.id == i.value).name} (${usables.filter(j => j.id == i.value).length})`, description: items.find(j => j.id == i.value).description }))
}

exports.isDroid = function ({ item } = {}) {
    return [102, 103, 104, 105, 106, 107, 141, 184].includes(item.id)
}

exports.getNeededItems = function ({ profile } = {}) {
    let collections = exports.Collections()
    let profile_items = exports.availableItemsforTrade({ profile })
    let needed = []
    collections.filter(c => !profile.effects?.[c.key]).forEach(c => {
        c.items.forEach(i => {
            if (!profile_items.map(j => j.id).includes(i)) {
                needed.push(i)
            }
        })
    })
    return needed
}

exports.droidLevel = function ({ droid } = {}) {
    let raw_level = droid.level ?? 0
    let level = Math.floor(raw_level / 255)
    return level
}

exports.repairAbility = function ({ droid, profile } = {}) {
    let repair_speed = droid.repair_speed * (profile.effects?.pitdroid_team ? 0.5 : 1)
    let droid_level = exports.droidLevel({ droid })
    for (let i = 0; i < droid_level; i++) {
        repair_speed *= 0.9
    }
    return {
        speed: repair_speed,
        parts: Math.floor(droid_level / 5) + 1
    }
}

exports.repairDuration = function ({ repair_speed, health } = {}) {
    return 1000 * 60 * 60 * repair_speed * (255 - health) / 255
}

exports.completeRepairs = function ({ profile, profileref, client, member } = {}) {
    if (!profile.items) {
        return
    }
    let repairing_droids = Object.keys(profile.items).filter(i => exports.isDroid({ item: profile.items[i] }) && profile.items[i].repairing)
    repairing_droids.forEach(key => {
        let droid = profile.items[key]
        let droid_info = items.find(i => i.id == droid.id)
        let repair_ability = exports.repairAbility({ droid: { ...droid_info, ...droid }, profile })
        if (droid.tasks) {
            let task_key = Object.keys(droid.tasks).find(t => !droid.tasks[t].complete && droid.tasks[t].date)
            if (task_key) {
                let task = droid.tasks[task_key]
                let repaired_health = 255 - profile.items[task.part].health
                let task_finished = task.date + exports.repairDuration({ repair_speed: repair_ability.speed, health: profile.items[task.part].health })
                if (Date.now() > task_finished) {
                    //update task
                    task.complete = true
                    profileref.child('items').child(key).child('tasks').child(task_key).update({ complete: true, date: false })

                    //update part health
                    profileref.child('items').child(task.part).update({ health: 255, repairing: false })

                    //level up pitdroid
                    profileref.child('items').child(key).update({ level: (profile.items[key].level ?? 0) + repaired_health })

                    //start next task
                    let next_task = Object.keys(droid.tasks).find(t => !droid.tasks[t].complete && !droid.tasks[t].date)
                    if (next_task) {
                        profileref.child('items').child(key).child('tasks').child(next_task).update({ date: Date.now() })
                    } else {
                        profileref.child('items').child(key).update({ repairing: false })
                    }

                    postMessage(client, '551786988861128714', { content: `<@${member}> your ${droid.nick ? droid.nick : items.find(i => i.id == droid.id).name} finished repairing a ${items.find(i => i.id == profile.items[task.part].id).name}!` })
                }
            }

        }
    })
}
