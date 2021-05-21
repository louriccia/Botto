const { filter } = require('../tourneydata.js');
const tourney = require('./tourney.js');

module.exports = {
    name: 'challenge',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");
        var ref = database.ref('challenge/times');
        ref.on("value", function (snapshot) {
            challengedata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var profileref = database.ref('challenge/profiles');
        profileref.on("value", function (snapshot) {
            profiledata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var feedbackref = database.ref('challenge/feedback');
        feedbackref.on("value", function (snapshot) {
            feedbackdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });


        var achievements = {
            galaxy_famous: { name: "Galaxy Famous", description: "Complete a challenge on every track", role: "819514261289828362", limit: 25, count: 0, collection: {}, array: [], missing: [] },
            pod_champ: { name: "Pod Champ", description: "Complete a challenge with every pod", role: "819514029218463774", limit: 23, count: 0, collection: {}, array: [], missing: [] },
            light_skipper: { name: "Lightspeed Skipper", description: "Complete a Skip challenge on every track with a skip", role: "819514330985922621", limit: 12, count: 0, collection: {}, array: [], missing: [] },
            slow_steady: { name: "Slow 'n Steady", description: "Complete a No Upgrades challenge with every pod", role: "819514431472926721", limit: 23, count: 0, collection: {}, array: [], missing: [] },
            mirror_dimension: { name: "Mirror Dimension", description: "Complete a Mirrored challenge on every track", role: "843573636119134219", limit: 25, count: 0, collection: {}, array: [], missing: [] },
            crowd_favorite: { name: "Crowd Favorite", description: "Complete a challenge as the track favorite on every track", role: "819514487852761138", limit: 25, count: 0, collection: {}, array: [], missing: [] },
            true_jedi: { name: "True Jedi", description: "Complete a challenge with every pod on every track", role: "819514600827519008", limit: 575, count: 0, collection: {}, array: [], missing: [] },
            big_time_swindler: { name: "Big-Time Swindler", description: "Earn or spend 1,000,000 total truguts", role: "844307520997949481", limit: 1000000, count: 0, collection: {}, array: [], missing: [] }
        }

        var truguts = {
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
            bonus_deluxe: 10000
        }

        function getGoalTimes(track, racer, skips, nu, laps) {
            var upg = 5
            if (nu) {
                upg = 0
            }
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
                    tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.04, 1.10, 1.10, 0.3 + .3 * tracks[track].difficulty),
                    tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.07, 1.15, 1.15, 0.5 + .50 * tracks[track].difficulty),
                    tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.12, 1.30, 1.30, 0.5 + 1 * tracks[track].difficulty),
                    tools.getGoalTime(track, racer, upg, upg, upg, laps, 1.18, 1.45, 1.45, 0.5 + 1.5 * tracks[track].difficulty)
                ]
            }
        }

        function trugutsEarned(player) {
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

        //const myEmbed = new Discord.MessageEmbed()
        if (args[0].name == "generate" || args[0].name == "challenge") {

            let member = interaction.member.user.id
            if (profiledata[member] == undefined) {
                var data = {
                    mirror_mode: 5,
                    name: interaction.member.user.username,
                    no_upgrades: 15,
                    non_3_lap: 5,
                    skips: 25,
                    winnings: 1,
                    truguts_earned: 0,
                    truguts_spent: 0
                }
                profileref.child(member).set(data)
            }

            var vc = false
            var challengestart = Date.now()
            //send embed
            if (profiledata[member].current !== undefined) {
                if (profiledata[member].current.completed == false && profiledata[member].current.start > challengestart - 900000) {
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent < truguts.reroll) {
                        var noMoney = new Discord.MessageEmbed()
                        noMoney
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nCurrent balance: `" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`\nReroll cost: `" + tools.numberWithCommas(truguts.reroll) + "`")
                        client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: 4,
                                data: {
                                    //content: "\u200B"
                                    embeds: [noMoney]
                                }
                            }
                        })
                        return
                    }
                }
            }

            if (interaction.name !== "fake") {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 5,
                        data: {
                            //content: "\u200B"
                            //embeds: [challengeEmbed]
                        }
                    }
                })

            } else {
                console.log("reviving challenge...")
            }

            var random_racer = Math.floor(Math.random() * 23)
            var random_track = Math.floor(Math.random() * 25)
            var random_quote = Math.floor(Math.random() * movieQuotes.length)
            var laps = 3, lap = [1, 2, 4, 5]
            var laptext = "", mirrortext = "", nutext = "", skipstext = "", flag = "", record = ""
            var mirror = false, nu = false, skips = false, hunt = false
            //calculate odds
            const Guild = client.guilds.cache.get(interaction.guild_id)
            const Member = Guild.members.cache.get(member)
            var racer_bribe = false, track_bribe = false
            var bribes = 0
            if (args !== undefined) {
                if (args[0].options !== undefined) {
                    for (var i = 0; i < args[0].options.length; i++) {
                        if (args[0].options[i].name == "bribe_track") {
                            bribes += truguts.bribe_track
                            random_track = Number(args[0].options[i].value)
                            track_bribe = true

                        }
                        if (args[0].options[i].name == "bribe_racer") {
                            bribes += truguts.bribe_racer
                            random_racer = Number(args[0].options[i].value)
                            racer_bribe = true
                        }
                    }
                }
            }
            if (profiledata[member].hunt !== undefined) {
                if (random_racer == profiledata[member].hunt.racer && random_track == profiledata[member].hunt.track && !profiledata[member].hunt.completed && Date.now() - 3600000 <= profiledata[member].hunt.date) {
                    hunt = true
                }
            }
            if (profiledata[member].truguts_earned - profiledata[member].truguts_spent < bribes && !hunt) {
                var noMoney = new Discord.MessageEmbed()
                noMoney
                    .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                    .setDescription("*'No money, no challenge, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nCurrent balance: `" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`\nBribe cost: `" + tools.numberWithCommas(bribes) + "`")
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            //content: "\u200B"
                            embeds: [noMoney]
                        }
                    }
                })
                return
            }
            if (track_bribe && !hunt) {
                var purchase = {
                    date: Date.now(),
                    purchased_item: "track bribe",
                    selection: Number(args[0].options[i].value)
                }
                profileref.child(member).child("purchases").push(purchase)
                profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + truguts.bribe_track })
            }
            if (racer_bribe && !hunt) {
                var purchase = {
                    date: Date.now(),
                    purchased_item: "racer bribe",
                    selection: Number(args[0].options[i].value)
                }
                profileref.child(member).child("purchases").push(purchase)
                profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + truguts.bribe_racer })
            }

            var memarray = []
            if (Member.voice.channel) {
                var mems = client.channels.cache.get(Member.voice.channelID).members;
                for (let [snowflake, guildMember] of mems) {
                    if (guildMember.displayName !== "Botto") {
                        memarray.push(guildMember.displayName)
                    }
                }
            }
            if (Member.voice.channel && memarray.length > 1) {
                vc = true
            } else {
                if (profiledata !== null) {
                    if (profiledata[member] !== undefined) {
                        odds_skips = profiledata[member].skips / 100
                        odds_noupgrades = profiledata[member].no_upgrades / 100
                        odds_non3lap = profiledata[member].non_3_lap / 100
                        odds_mirrormode = profiledata[member].mirror_mode / 100
                    } else {
                        var data = {
                            mirror_mode: 5,
                            name: interaction.member.user.username,
                            no_upgrades: 15,
                            non_3_lap: 5,
                            skips: 25,
                            winnings: 1
                        }
                        profileref.child(member).set(data)
                        odds_skips = 0.25
                        odds_noupgrades = 0.15
                        odds_non3lap = 0.05
                        odds_mirrormode = 0.05
                    }
                } else {
                    odds_skips = 0.25
                    odds_noupgrades = 0.15
                    odds_non3lap = 0.05
                    odds_mirrormode = 0.05
                }
                if (Math.random() < odds_noupgrades) {
                    nu = true
                }
                if (Math.random() < odds_mirrormode) {
                    mirrortext = ", **MIRRORED!**"
                    mirror = true
                }
                if (Math.random() < odds_non3lap) {
                    laps = lap[Math.floor(Math.random() * 4)]
                }
                if (tracks[random_track].hasOwnProperty("parskiptimes")) {
                    if (Math.random() < odds_skips) {
                        skips = true
                    }
                }
            }
            if (interaction.name == "fake") {
                if (interaction.recovery == true) {
                    random_racer = profiledata[member].current.racer
                    random_track = profiledata[member].current.track
                    nu = profiledata[member].current.nu
                    mirror = profiledata[member].current.mirror
                    laps = profiledata[member].current.laps
                    skips = profiledata[member].current.skips
                    hunt = profiledata[member].current.hunt
                }
            }
            if (nu) {
                nutext = " with **NO UPGRADES**"
            }
            if (skips) {
                skipstext = " with **SKIPS**"
            }
            if (laps !== 3) {
                if (laps == 1) {
                    laptext = " for **" + laps + " lap**"
                } else {
                    laptext = " for **" + laps + " lap(s)**"
                }

            }
            var bribed_racer = "", bribed_track = "", hunt_text = ""
            if (racer_bribe) {
                bribed_racer = "*"
            }
            if (track_bribe) {
                bribed_track = "*"
            }
            if (hunt) {
                hunt_text = ":mag_right: Challenge Hunt: "
            }
            var current = {
                start: challengestart,
                completed: false,
                channel: interaction.channel_id,
                racer: random_racer,
                track: random_track,
                laps: laps,
                nu: nu,
                skips: skips,
                mirror: mirror,
                truguts: 0,
                hunt: hunt
            }
            if (!vc) {
                profileref.child(member).child("current").set(current)
            }
            var rated = false

            var reroll_description = ""
            function rerollChallenge(best) {

                reroll_description = ""
                var played = false
                var record_holder = null
                if (best !== undefined) {
                    for (var i = 0; i < best.length; i++) {
                        if (best[i].user == member) {
                            played = true
                        }
                        if (record_holder !== null) {
                            if (best[i].time < record_holder.time) {
                                record_holder = best[i]
                            }
                        } else {
                            record_holder = best[i]
                        }
                    }
                }
                var reroll = truguts.reroll
                var selection = "full price"
                if (played) {
                    reroll = truguts.reroll_discount
                    selection = "discount"
                }
                if (record_holder !== null) {
                    if (record_holder.user == member) {
                        reroll = 0
                    }
                }
                var purchase = {
                    date: Date.now(),
                    purchased_item: "reroll",
                    selection: selection
                }
                if (best == undefined) {
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent > reroll) {
                        return true
                    } else {
                        return false
                    }
                }
                if (reroll > 0) {
                    profileref.child(member).child("purchases").push(purchase)
                    profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + reroll })
                }
                if (reroll == truguts.reroll_discount) {
                    reroll_description = "`-📀" + truguts.reroll_discount + "` (discounted)\nCurrent balance: `📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`"
                } else if (reroll == 0) {
                    reroll_description = "(no charge for record holders)"
                } else {
                    reroll_description = "`-📀" + truguts.reroll + "`\nCurrent balance: `📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`"
                }
                return reroll_description


            }
            //build embed
            var undone = false
            var hunt_bonus = 0
            var eAuthor = [], eTitle = "", title = "", highlight = "", eGoalTimes = [], best = [], achievement_message_array = []
            function createEmbed() {
                best = []
                //get best runs/achievement progress
                var keys = Object.keys(challengedata)
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    var keys = Object.keys(challengedata)
                    if (challengedata[k].user == member) {
                        achievements.galaxy_famous.collection[String(challengedata[k].track)] = 1
                        achievements.pod_champ.collection[String(challengedata[k].racer)] = 1
                        if (challengedata[k].skips) {
                            achievements.light_skipper.collection[String(challengedata[k].track)] = 1
                        }
                        if (challengedata[k].nu) {
                            achievements.slow_steady.collection[String(challengedata[k].racer)] = 1
                        }
                        if (challengedata[k].mirror) {
                            achievements.mirror_dimension.collection[String(challengedata[k].track)] = 1
                        }
                        if (challengedata[k].racer == tracks[String(challengedata[k].track)].favorite) {
                            achievements.crowd_favorite.collection[String(challengedata[k].track)] = 1
                        }
                        achievements.true_jedi.collection[String(challengedata[k].track + " " + challengedata[k].racer)] = 1
                    }
                    if (challengedata[k].track == random_track && challengedata[k].racer == random_racer && challengedata[k].laps == laps && challengedata[k].mirror == mirror && challengedata[k].nu == nu && challengedata[k].skips == skips) {
                        best.push(challengedata[k])
                    }
                }
                //build description
                var desc = ""
                if (Math.random() < 0.50 && best.length > 0) {
                    best.sort(function (a, b) {
                        return a.time - b.time;
                    })
                    desc = desc + "*The current record-holder for this challenge is... " + best[0].name + "!*"
                } else if (Math.random() < 0.50) {
                    var str = playerPicks[Math.floor(Math.random() * playerPicks.length)]
                    if (!Member.voice.channel) {
                        desc = desc + str.replace("replaceme", interaction.member.user.username)
                    } else {
                        var mems = client.channels.cache.get(Member.voice.channelID).members;
                        var memarray = [];
                        var memlist = ""
                        for (let [snowflake, guildMember] of mems) {
                            if (guildMember.displayName !== "Botto") {
                                memarray.push(guildMember.displayName)
                            }
                        }
                        desc = desc + str.replace("replaceme", memarray[Math.floor(Math.random() * memarray.length)])
                    }
                } else {
                    if (vc) {
                        desc = desc + mpQuotes[Math.floor(Math.random() * mpQuotes.length)]
                    } else {
                        desc = desc + movieQuotes[random_quote]
                    }
                }

                if (hunt) {
                    desc += "\nYou found the Challenge Hunt! Complete the challenge to earn a `📀" + tools.numberWithCommas(profiledata[member].hunt.bonus) + "` bonus"
                } else {
                    if (racer_bribe) {
                        desc += "\nBribed racer `-📀" + tools.numberWithCommas(truguts.bribe_racer) + "`"
                    }
                    if (track_bribe) {
                        desc += "\nBribed track `-📀" + tools.numberWithCommas(truguts.bribe_track) + "`"
                    }
                }

                //calculate goal time

                var goals = getGoalTimes(random_track, random_racer, skips, nu, laps)

                flag = racers[random_racer].flag
                var eColor = ""
                eTitle = "Race as **" + bribed_racer + flag + " " + racers[random_racer].name + bribed_racer + "** (" + (random_racer + 1) + ")" + nutext + " on **" + bribed_track + tracks[random_track].name + bribed_track + "** (" + (random_track + 1) + ")" + laptext + skipstext + mirrortext
                if (vc) {
                    eAuthor = ["Multiplayer Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/160/twitter/259/chequered-flag_1f3c1.png"]
                } else {
                    eAuthor = [interaction.member.user.username + "'s Challenge", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL()]
                }
                var goal_symbols = [":gem:", ":first_place:", ":second_place:", ":third_place:", "<:bumpythumb:703107780860575875>"]
                var goal_earnings = [
                    circuits[tracks[random_track].circuit].winnings[profiledata[member].winnings][0],
                    circuits[tracks[random_track].circuit].winnings[profiledata[member].winnings][1],
                    circuits[tracks[random_track].circuit].winnings[profiledata[member].winnings][2],
                    circuits[tracks[random_track].circuit].winnings[profiledata[member].winnings][3],
                    0
                ]
                var goal_earnings_text = []
                for (var i = 0; i < goal_earnings.length; i++) {
                    if (!vc) {
                        if (goal_earnings[i] == 0) {
                            goal_earnings_text[i] = ""
                        } else {
                            goal_earnings_text[i] = "  `+📀" + tools.numberWithCommas(goal_earnings[i]) + "`"
                        }
                    } else {
                        goal_earnings_text[i] = ""
                    }

                }
                eGoalTimes = goal_symbols[0] + " " + tools.timefix(goals[0]) + goal_earnings_text[0] + "\n" +
                    goal_symbols[1] + " " + tools.timefix(goals[1]) + goal_earnings_text[1] + "\n" +
                    goal_symbols[2] + " " + tools.timefix(goals[2]) + goal_earnings_text[2] + "\n" +
                    goal_symbols[3] + " " + tools.timefix(goals[3]) + goal_earnings_text[3] + "\n" +
                    goal_symbols[4] + " " + tools.timefix(goals[4]) + goal_earnings_text[4]
                //tally likes and dislikes
                var rating = ""
                var like = 0, dislike = 0, keys = Object.keys(feedbackdata)
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (feedbackdata[k].track == random_track && feedbackdata[k].racer == random_racer && feedbackdata[k].laps == laps && feedbackdata[k].mirror == mirror && feedbackdata[k].nu == nu && feedbackdata[k].skips == skips) {
                        if (feedbackdata[k].feedback == "👍") {
                            like = like + 1
                        } else if (feedbackdata[k].feedback == "👎") {
                            dislike = dislike + 1
                        }
                    }
                }
                if (like > 0) {
                    rating = "`👍" + like + "` "
                }
                if (dislike > 0) {
                    rating = rating + "`👎" + dislike + "` "
                }
                var keys = Object.keys(challengedata), best = []
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (challengedata[k].track == random_track && challengedata[k].racer == random_racer && challengedata[k].laps == laps && challengedata[k].mirror == mirror && challengedata[k].nu == nu && challengedata[k].skips == skips) {
                        best.push(challengedata[k])
                    }
                }
                var besttimes = "Be the first to submit a time for this challenge! \n `+📀" + tools.numberWithCommas(truguts.first) + "`"
                var pos = ["<:P1:671601240228233216> ", "<:P2:671601321257992204> ", "<:P3:671601364794605570> ", "4th ", "5th ", "6th ", "7th ", "8th ", "9th ", "10th "]
                var submitted_time = null
                if (best.length > 0) {
                    besttimes = ""
                    best.sort(function (a, b) {
                        return a.time - b.time;
                    })
                    var date = ""
                    if (highlight !== null) {
                        date = highlight
                    }
                    var already = []
                    for (var i = 0; i < best.length; i++) {
                        if ((!vc && !already.includes(best[i].name) || best[i].name == interaction.member.user.username) || (vc && !already.includes(best[i].name))) {
                            if (best[i].date == date) {
                                besttimes = besttimes + pos[0] + "**" + tools.timefix(best[i].time) + " - " + best[i].name + " <a:newrecord:672640831882133524>**\n"
                                submitted_time = best[i]
                            } else if (date == "" && best[i].name == interaction.member.user.username && !vc) {
                                besttimes = besttimes + pos[0] + "**" + tools.timefix(best[i].time) + " - " + best[i].name + "**\n"
                            } else {
                                besttimes = besttimes + pos[0] + "" + tools.timefix(best[i].time) + " - " + best[i].name + "\n"
                            }
                            pos.splice(0, 1)
                            already.push(best[i].name)
                        }
                        if (pos.length == 0) {
                            i = best.length
                        }
                    }
                }
                if (title == ":white_check_mark: Completed: ") {
                    eColor = "77B255"
                } else if (title == ":warning: 5 Minute Warning: " || title == "<a:countdown:672640791369482251> 1 Minute Warning: ") {
                    eColor = "FAA61A"
                } else if (title == ":negative_squared_cross_mark: Closed: " || title == ":arrows_counterclockwise: Rerolled: ") {
                    eColor = "2F3136"
                } else {
                    eColor = planets[tracks[random_track].planet].color
                }
                //prepare achievement progress

                var galaxyFamous = achievements.galaxy_famous.name, podChamp = achievements.pod_champ.name, lightSkipper = achievements.light_skipper.name, slowSteady = achievements.slow_steady.name, crowdFavorite = achievements.crowd_favorite.name, trueJedi = achievements.true_jedi.name, mirrorDimension = achievements.mirror_dimension.name
                if (interaction.guild_id == "441839750555369474") {
                    galaxyFamous = "<@&" + achievements.galaxy_famous.role + ">"
                    podChamp = "<@&" + achievements.pod_champ.role + ">"
                    lightSkipper = "<@&" + achievements.light_skipper.role + ">"
                    slowSteady = "<@&" + achievements.slow_steady.role + ">"
                    mirrorDimension = "<@&" + achievements.mirror_dimension.role + ">"
                    crowdFavorite = "<@&" + achievements.crowd_favorite.role + ">"
                    trueJedi = "<@&" + achievements.true_jedi.role + ">"
                }
                if (!vc) {
                    if (title !== ":white_check_mark: Completed: ") {
                        achievement_message_array = []
                        if (Object.keys(achievements.galaxy_famous.collection).length < achievements.galaxy_famous.limit && achievements.galaxy_famous.collection[random_track] == undefined) {
                            achievement_message_array.push({
                                name: galaxyFamous,
                                count: Object.keys(achievements.galaxy_famous.collection).length,
                                limit: achievements.galaxy_famous.limit
                            })
                        }
                        if (Object.keys(achievements.pod_champ.collection).length < achievements.pod_champ.limit && achievements.pod_champ.collection[random_racer] == undefined) {
                            achievement_message_array.push({
                                name: podChamp,
                                count: Object.keys(achievements.pod_champ.collection).length,
                                limit: achievements.pod_champ.limit
                            })
                        }
                        if (Object.keys(achievements.light_skipper.collection).length < achievements.light_skipper.limit && skips && achievements.light_skipper.collection[random_track] == undefined) {
                            achievement_message_array.push({
                                name: lightSkipper,
                                count: Object.keys(achievements.light_skipper.collection).length,
                                limit: achievements.light_skipper.limit
                            })
                        }
                        if (Object.keys(achievements.slow_steady.collection).length < achievements.slow_steady.limit && nu && achievements.slow_steady.collection[random_racer] == undefined) {
                            achievement_message_array.push({
                                name: slowSteady,
                                count: Object.keys(achievements.slow_steady.collection).length,
                                limit: achievements.slow_steady.limit
                            })
                        }
                        if (Object.keys(achievements.mirror_dimension.collection).length < achievements.mirror_dimension.limit && mirror && achievements.mirror_dimension.collection[random_track] == undefined) {
                            achievement_message_array.push({
                                name: mirrorDimension,
                                count: Object.keys(achievements.mirror_dimension.collection).length,
                                limit: achievements.mirror_dimension.limit
                            })
                        }
                        if (Object.keys(achievements.crowd_favorite.collection).length < achievements.crowd_favorite.limit && random_racer == tracks[random_track].favorite && achievements.crowd_favorite.collection[random_track] == undefined) {
                            achievement_message_array.push({
                                name: crowdFavorite,
                                count: Object.keys(achievements.crowd_favorite.collection).length,
                                limit: achievements.crowd_favorite.limit
                            })
                        }
                        if (Object.keys(achievements.true_jedi.collection).length < achievements.true_jedi.limit && achievements.true_jedi.collection[random_track + " " + random_racer] == undefined) {
                            achievement_message_array.push({
                                name: trueJedi,
                                count: Object.keys(achievements.true_jedi.collection).length,
                                limit: achievements.true_jedi.limit
                            })
                        }
                    }
                    console.log(achievement_message_array)
                    if (profiledata[member].achievements == undefined) {
                        var ach = {
                            galaxy_famous: false,
                            pod_champ: false,
                            light_skipper: false,
                            slow_steady: false,
                            mirror_dimension: false,
                            crowd_favorite: false,
                            true_jedi: false,
                            big_spender: false
                        }
                        profileref.child(member).child("achievements").set(ach)
                    }
                    var achvs = Object.keys(achievements)
                    for (var i = 0; i < achvs.length; i++) {
                        var a = achvs[i]
                        if (Object.keys(achievements[a].collection).length >= achievements[a].limit && profiledata[member].achievements[a] == false) {
                            profileref.child(member).child("achievements").child(a).set(true)
                            const congratsEmbed = new Discord.MessageEmbed()
                                .setAuthor(interaction.member.user.username + " got an achievement!", eAuthor[1])
                                .setDescription(achievements[a].description) //+ " `" + String(Object.keys(achievements[a].collection).length) + "/" + String(achievements[a].limit)) + "`"
                                .setColor("FFB900")
                                .setTitle("**:trophy: " + achievements[a].name + "**")
                            if (interaction.guild_id == "441839750555369474") {
                                Member.roles.add(achievements[a].role).catch(error => console.log(error))
                                congratsEmbed.setDescription("**<@&" + achievements[a].role + ">** - " + achievements[a].description)
                            }
                            client.channels.cache.get(interaction.channel_id).send(congratsEmbed)
                        }
                    }
                }
                var earnings = ""
                var earnings_total = 0
                //construct winnings text
                if (title == ":white_check_mark: Completed: ") {
                    var winnings_text = null
                    for (var i = 4; i > -1; i--) {
                        if (submitted_time.time < goals[i]) {
                            winnings_text = i
                        }
                    }
                    if (hunt) {
                        earnings += "Hunt Bonus `+📀" + tools.numberWithCommas(profiledata[member].hunt.bonus) + "`\n"
                        earnings_total += profiledata[member].hunt.bonus
                        hunt_bonus = profiledata[member].hunt.bonus
                        profileref.child(member).update({ hunt: { completed: true } })
                    }
                    if (goal_earnings[winnings_text] > 0) {
                        earnings += goal_symbols[winnings_text] + " `+📀" + tools.numberWithCommas(goal_earnings[winnings_text]) + "`\n"
                        earnings_total += goal_earnings[winnings_text]
                    }
                    if (vc) {
                        winnings_text += "MP `+📀" + tools.numberWithCommas(truguts.mp) + "`\n"
                        earnings_total += truguts.mp
                    }
                    var winnings_non_standard = 0
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
                    if (winnings_non_standard > 0) {
                        earnings += "Non-Standard `+📀" + tools.numberWithCommas(truguts.non_standard) + " × " + winnings_non_standard + "`\n"
                        earnings_total += truguts.non_standard * winnings_non_standard
                    }
                    var first = true, pb = false, beat = []
                    for (var i = 0; i < best.length; i++) {
                        if (best[i].date < submitted_time.date) {
                            first = false
                            if (best[i].user == member && best[i].date !== date) {
                                pb = true
                                if (submitted_time.time > best[i].time) {
                                    pb = false
                                }
                            }
                        }
                        if (best[i].user !== member && submitted_time.time < best[i].time && !beat.includes(best[i].user)) {
                            beat.push(best[i].user)
                        }
                    }
                    if (beat.length > 0) {
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
                    if (rated) {
                        earnings += "Rated `+📀" + tools.numberWithCommas(truguts.rated) + "`\n"
                        earnings_total += truguts.rated
                    }
                    var earned = profiledata[member].truguts_earned
                    if (!rated || undone) {
                        profileref.child(member).update({ truguts_earned: earned + earnings_total })
                    } else {
                        profileref.child(member).update({ truguts_earned: earned + truguts.rated })
                    }

                    earnings += "\n**Total: **`+📀" + tools.numberWithCommas(earnings_total) + "`"
                    profileref.child(member).child("current").update({ truguts: earnings_total })
                    earnings += "\n**New balance: **`📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`"
                }
                const newEmbed = new Discord.MessageEmbed()
                    .setTitle(title + hunt_text + eTitle)
                    .setColor(eColor)
                if (![":arrows_counterclockwise: Rerolled: ", ":negative_squared_cross_mark: Closed: "].includes(title)) {
                    var achievement_message = ""

                    newEmbed
                        .setAuthor(eAuthor[0], eAuthor[1])
                    if (title == ":white_check_mark: Completed: ") {
                        for (var i = 0; i < achievement_message_array.length; i++) {
                            achievement_message += ":white_check_mark: **" + achievement_message_array[i].name + "** `" + (Number(achievement_message_array[i].count) + 1) + "/" + achievement_message_array[i].limit + "` "
                            if (i !== achievement_message_array.length - 1) {
                                achievement_message += "○ "
                            }
                        }
                        newEmbed
                            .setDescription(rating + desc + "\n" + achievement_message)
                            .addField("Winnings", earnings, true)
                            .addField("Best Times", besttimes, true)
                    } else {
                        for (var i = 0; i < achievement_message_array.length; i++) {
                            achievement_message += "**" + achievement_message_array[i].name + "** `" + achievement_message_array[i].count + "/" + achievement_message_array[i].limit + "` "
                            if (i !== achievement_message_array.length - 1) {
                                achievement_message += "○ "
                            }
                        }
                        newEmbed
                            .setDescription(rating + desc + "\n" + achievement_message)
                            .addField("Goal Times", eGoalTimes, true)
                            .addField("Best Times", besttimes, true)
                    }

                } else {
                    newEmbed.setTitle(title + "~~" + eTitle + "~~")
                    if (title == ":arrows_counterclockwise: Rerolled: ") {
                        newEmbed.setDescription(rerollChallenge(best))
                    }
                }
                return newEmbed
            }
            //process reroll

            async function sendResponse() {
                var response = null
                if (interaction.name == "fake") {
                    response = client.channels.cache.get(interaction.channel_id).send(createEmbed())
                } else {
                    response = await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({ data: { embeds: [createEmbed()] } })
                }
                return response
            }
            sendResponse().then(sentMessage => {
                //collect feedback
                if (interaction.name !== "fake") {
                    sentMessage = new Discord.Message(client, sentMessage, client.channels.cache.get(sentMessage.channel_id))
                }
                profileref.child(member).child("current").update({ message: sentMessage.id })
                sentMessage.react('🔄').then(async function (message) {//.react('👍').then(() => sentMessage.react('👎'))
                    var feedback = ""
                    if (!vc) {
                        sentMessage.react('🔄')
                    }
                    const filter = (reaction, user) => {
                        return (['👍', '👎', '↩️', '🔄', '▶️'].includes(reaction.emoji.name) && user.id !== "545798436105224203" && ((user.id == member && !vc) || vc));
                    };
                    const collector = sentMessage.createReactionCollector(filter, { time: 1800000 }) //reactions
                    collector.on('collect', (reaction, reactionCollector) => {
                        const user = reaction.users.cache.last()
                        var fakeinteraction = {
                            name: "fake",
                            recovery: false,
                            member: {
                                user: {
                                    id: interaction.member.user.id,
                                    username: interaction.member.user.username
                                }
                            },
                            guild_id: interaction.guild_id,
                            channel_id: interaction.channel_id
                        }
                        if (['👍', '👎'].includes(reaction.emoji.name)) { //feedback
                            if (rated == false) {
                                rated = true
                                if (reaction.emoji.name === '👍') {
                                    feedback = '👍'
                                } else {
                                    feedback = '👎'
                                }
                                var feedbackdata = {
                                    user: user.id,
                                    name: user.username,
                                    feedback: feedback,
                                    date: sentMessage.createdTimestamp,
                                    racer: random_racer,
                                    track: random_track,
                                    laps: laps,
                                    nu: nu,
                                    skips: skips,
                                    mirror: mirror
                                }
                                feedbackref.push(feedbackdata);
                                try {
                                    sentMessage.edit(createEmbed())
                                    sentMessage.reactions.resolve("👍").users.remove("545798436105224203")
                                    sentMessage.reactions.resolve("👎").users.remove("545798436105224203")
                                    sentMessage.reactions.resolve("👍").users.remove(member)
                                    sentMessage.reactions.resolve("👎").users.remove(member)
                                } catch { }
                            }
                        } else if (reaction.emoji.name === '🔄' && !collected) { //reroll
                            if (rerollChallenge()) {
                                collected = true
                                collecting = false
                                title = ":arrows_counterclockwise: Rerolled: "
                                eTitle = "~~" + eTitle + "~~"
                                profileref.child(member).child("current").update({ completed: true })
                                try {

                                    sentMessage.reactions.removeAll().catch()
                                    sentMessage.edit("", createEmbed()).then(sentMessage.delete({ timeout: 10000, reason: 'bot cleanup' }))
                                } catch { }
                                args[0].options = undefined
                                client.commands.get("challenge").execute(client, fakeinteraction, args);
                            } else {
                                var noMoney = new Discord.MessageEmbed()
                                noMoney
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                    .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nCurrent balance: `📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`\nReroll cost: `📀" + tools.numberWithCommas(truguts.reroll) + "`")
                                sentMessage.channel.send(noMoney)
                            }

                        } else if (reaction.emoji.name === '↩️') { //undo
                            for (let i = 0; i < collection.length; i++) {
                                if (collection[i].user == user.id) {
                                    profileref.child(member).update({ truguts_earned: profiledata[member].truguts_earned - profiledata[member].current.truguts })
                                    ref.child(collection[i].record).remove()
                                    best.splice(collection[i].index, 1)
                                    title = ""
                                    highlight = ""
                                    try {
                                        profileref.child(member).child("current").update({ completed: false })
                                        sentMessage.edit(createEmbed())
                                        sentMessage.reactions.removeAll().catch()

                                    } catch { }
                                    collected = false
                                    collecting = true
                                    undone = true
                                }
                            }

                        } else if (reaction.emoji.name === '▶️' && collected) { //next challenge
                            client.commands.get("challenge").execute(client, fakeinteraction, args);
                            try {

                                sentMessage.reactions.resolve("↩️").users.remove("545798436105224203")
                                sentMessage.reactions.resolve("▶️").users.remove("545798436105224203")
                                sentMessage.reactions.resolve("↩️").users.remove(member)
                                sentMessage.reactions.resolve("▶️").users.remove(member)
                            } catch { }

                        }
                    })
                })
                var warning = ""
                if (!vc) {
                    warning = "<@" + member + ">"
                }
                setTimeout(async function () { //5 minute warning
                    if (collecting) {
                        title = ":warning: 5 Minute Warning: "
                        try {
                            await sentMessage.edit(warning, createEmbed())
                        } catch { }
                    }
                }, 600000)
                setTimeout(async function () { //1 minute warning
                    if (collecting) {
                        title = "<a:countdown:672640791369482251> 1 Minute Warning: "
                        try {
                            await sentMessage.edit(warning, createEmbed())
                        } catch { }
                    }
                }, 840000)
                setTimeout(async function () { //challenge closed
                    if (collecting) {
                        title = ":negative_squared_cross_mark: Closed: "
                        profileref.child(member).child("current").update({ completed: true })
                        try {
                            await sentMessage.edit("", createEmbed())
                            await sentMessage.reactions.removeAll().catch()
                        } catch (error) {
                            // log all errors
                            console.error(error)
                        }
                    }
                }, 900000)
                setTimeout(async function () { //clean up reactions
                    try {
                        await sentMessage.reactions.removeAll().catch()
                    } catch (error) {
                        // log all errors
                        console.error(error)
                    }
                }, 1200000)
                //collect times
                const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m, { time: 900000 }); //messages
                var collected = false, collecting = true, collection = []
                var listener = function checkReroll(oldMessage, newMessage) {
                    if (newMessage.embeds.length > 0 && newMessage.author.id == "545798436105224203" && newMessage.id !== sentMessage.id) {
                        if (![undefined, null, ""].includes(newMessage.embeds[0].title)) {
                            if (newMessage.embeds[0].title.startsWith("Race")) {
                                if (vc) {
                                    if (collected && collecting) { //previous mp challenge closed after rolling a new challenge
                                        title = ":white_check_mark: Completed: "
                                        try {
                                            sentMessage.edit(createEmbed())
                                        } catch { }
                                        collecting = false
                                    } else if (!collected) { //rerolling mp challenge
                                        try {
                                            sentMessage.delete()
                                        } catch { }
                                        collected = true
                                        collecting = false
                                    }
                                } else if (!collected && newMessage.embeds[0].author.name.replace("'s Challenge", "") == interaction.member.user.username) { //rerolling sp challenge
                                    if (rerollChallenge()) {
                                        collected = true
                                        collecting = false
                                        title = ":arrows_counterclockwise: Rerolled: "
                                        eTitle = "~~" + eTitle + "~~"
                                        profileref.child(member).child("current").update({ completed: true })
                                        try {
                                            sentMessage.reactions.removeAll().catch()
                                            sentMessage.edit("", createEmbed()).then(sentMessage.delete({ timeout: 10000, reason: 'bot cleanup' }))
                                            client.removeListener('mesageUpdate', listener)
                                        } catch { }
                                    }/* else {
                                        var noMoney = new Discord.MessageEmbed()
                                        noMoney
                                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                            .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nCurrent balance: `" + (profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`\nReroll cost: `" + truguts.reroll + "`")
                                        sentMessage.channel.send(noMoney)
                                    }*/
                                }
                            }
                        }
                    }
                }
                client.on('messageUpdate', listener)

                collector.on('collect', message => {
                    //a new challenge appears
                    if (!isNaN(message.content.replace(":", "")) && tools.timetoSeconds(message.content) !== null) {
                        var challengeend = Date.now()
                        var time = ""
                        if (vc) {
                            time = tools.timetoSeconds(message.content)
                        } else if (collected == false && member == message.author.id) {
                            time = tools.timetoSeconds(message.content)
                        }
                        tools.timetoSeconds(message.content)
                        if (time !== "" && collecting) {

                            if ((challengeend - challengestart) < time * 1000 && interaction.name !== "fake") {
                                message.reply("*I warn you. No funny business.*")
                                collected = true
                                if (!vc) {
                                    collecting = false
                                }
                                title = ":negative_squared_cross_mark: Closed: "
                                profileref.child(member).child("current").update({ completed: true })
                                try {
                                    sentMessage.edit("", createEmbed())
                                    sentMessage.reactions.removeAll().catch()
                                } catch (error) {
                                    console.error(error)
                                }
                            } else {
                                //log time
                                try {
                                    sentMessage.reactions.removeAll().catch()
                                    sentMessage.react('▶️').then(sentMessage.react('↩️')).then(sentMessage.react('👍')).then(sentMessage.react('👎'))
                                } catch {

                                }
                                var submissiondata = {
                                    user: message.author.id,
                                    name: message.author.username,
                                    time: time,
                                    date: message.createdTimestamp,
                                    racer: random_racer,
                                    track: random_track,
                                    laps: laps,
                                    nu: nu,
                                    skips: skips,
                                    mirror: mirror,
                                    mp: vc,
                                    settings: {
                                        winnings: profiledata[member].winnings,
                                        no_upgrades: profiledata[member].no_upgrades,
                                        non_3_lap: profiledata[member].non_3_lap,
                                        skips: profiledata[member].skips,
                                        mirror_mode: profiledata[member].mirror_mode
                                    },
                                    hunt: hunt_bonus
                                }
                                best.push(submissiondata)
                                var newPostRef = ref.push(submissiondata);
                                var collectiondata = {
                                    record: newPostRef.key,
                                    user: message.author.id,
                                    index: best.length - 1
                                }
                                collection.push(collectiondata)
                                collected = true
                                if (!vc) {
                                    collecting = false
                                }
                                if (vc) {
                                    highlight = submissiondata.date
                                    try {
                                        sentMessage.edit(createEmbed())
                                    } catch { }
                                } else {
                                    title = ":white_check_mark: Completed: "
                                    highlight = submissiondata.date
                                    profileref.child(member).child("current").update({ completed: true })
                                    sentMessage.edit("", createEmbed())
                                    /*try {
                                        sentMessage.edit("", createEmbed())
                                    } catch { }*/
                                }
                                if (message.guild) {
                                    try {
                                        message.delete()
                                    } catch { }
                                }
                            }
                        }
                    }
                })
            })
        } else if (args[0].name == "hint") {
            const hintEmbed = new Discord.MessageEmbed()
            let member = interaction.member.user.id
            var hints = [
                { name: "Basic Hint", price: truguts.hint_basic, bonus: truguts.bonus_basic },
                { name: "Standard Hint", price: truguts.hint_standard, bonus: truguts.bonus_standard },
                { name: "Deluxe Hint", price: truguts.hint_deluxe, bonus: truguts.bonus_deluxe }
            ]
            //process input
            var hint_tier = 0
            var selection = ""
            for (var i = 0; i < args[0].options.length; i++) {
                if (args[0].options[i].name == "hint") {
                    hint_tier = Number(args[0].options[i].value)
                } else if (args[0].options[i].name == "selection") {
                    selection = args[0].options[i].value
                }
            }
            //check truguts
            if (profiledata[member].truguts_earned - profiledata[member].truguts_spent < hints[hint_tier].price) {
                hintEmbed
                    .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                    .setDescription("*'No money, no hint!'*\nYou do not have enough truguts to buy the selected hint.\n\nCurrent balance: `" + (profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`\nHint cost: `" + hints[hint_tier].price + "`")
            } else {
                //get array of possible hints based on selection
                var keys = Object.keys(challengedata)
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (challengedata[k].user == member) {
                        if (!achievements.galaxy_famous.array.includes(challengedata[k].track)) {
                            achievements.galaxy_famous.array.push(challengedata[k].track)
                        }
                        if (!achievements.pod_champ.array.includes(challengedata[k].racer)) {
                            achievements.pod_champ.array.push(challengedata[k].racer)
                        }
                        if (challengedata[k].skips && !achievements.light_skipper.array.includes(challengedata[k].track)) {
                            achievements.light_skipper.array.push(challengedata[k].track)
                        }
                        if (challengedata[k].nu && !achievements.slow_steady.array.includes(challengedata[k].racer)) {
                            achievements.slow_steady.array.push(challengedata[k].racer)
                        }
                        if (challengedata[k].mirror && !achievements.mirror_dimension.array.includes(challengedata[k].track)) {
                            achievements.mirror_dimension.array.push(challengedata[k].track)
                        }
                        if (challengedata[k].racer == tracks[challengedata[k].track].favorite && !achievements.crowd_favorite.array.includes(challengedata[k].track)) {
                            achievements.crowd_favorite.array.push(challengedata[k].track)
                        }
                        if (!achievements.true_jedi.array.includes(challengedata[k].track + "," + challengedata[k].racer)) {
                            achievements.true_jedi.array.push(challengedata[k].track + "," + challengedata[k].racer)
                        }
                    }
                }
                //figure out missing
                for (var j = 0; j < 25; j++) {
                    if (!achievements.galaxy_famous.array.includes(j)) {
                        achievements.galaxy_famous.missing.push(j)
                    }
                    if (!achievements.pod_champ.array.includes(j) && j < 23) {
                        achievements.pod_champ.missing.push(j)
                    }
                    if (!achievements.light_skipper.array.includes(j) && tracks[j].hasOwnProperty("parskiptimes")) {
                        achievements.light_skipper.missing.push(j)
                    }
                    if (!achievements.slow_steady.array.includes(j) && j < 23) {
                        achievements.slow_steady.missing.push(j)
                    }
                    if (!achievements.mirror_dimension.array.includes(j)) {
                        achievements.mirror_dimension.missing.push(j)
                    }
                    if (!achievements.crowd_favorite.array.includes(j)) {
                        achievements.crowd_favorite.missing.push(j)
                    }
                    for (var l = 0; l < 23; l++) {
                        if (!achievements.true_jedi.array.includes(j + "," + l)) {
                            achievements.true_jedi.missing.push(j + "," + l)
                        }
                    }
                }
                //get random missing challenge
                var racer = null, track = null, achievement_name = ""
                if (selection == "challenge_hunt") {
                    achievement_name = "Challenge Hunt"
                    track = Math.floor(Math.random() * 25)
                    racer = Math.floor(Math.random() * 23)
                    profileref.child(member).update({
                        hunt: {
                            track: track,
                            racer: racer,
                            date: Date.now(),
                            bonus: hints[hint_tier].bonus,
                            completed: false
                        }
                    })
                } else {
                    achievement_name = achievements[selection].name
                    if (["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite"].includes(selection)) {
                        track = achievements[selection].missing[Math.floor(Math.random() * achievements[selection].missing.length)]
                        if (selection == "crowd_favorite") {
                            racer = tracks[track].favorite
                        }
                    }
                    if (["pod_champ", "slow_steady"].includes(selection)) {
                        racer = achievements[selection].missing[Math.floor(Math.random() * achievements[selection].missing.length)]
                    }
                    if (selection == "true_jedi") {
                        var random = achievements.true_jedi.missing[Math.floor(Math.random() * achievements.true_jedi.missing.length)]
                        random = random.split(",")
                        track = random[0]
                        racer = random[1]
                    }
                }
                console.log("racer: " + racer)
                console.log("track: " + track)
                if ((["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", "true_jedi"].includes(selection) && track == null) || (["pod_champ", "slow_steady", "true_jedi"].includes(selection) && racer == null)) {
                    //player already has achievement
                    hintEmbed.setDescription("You already have this achievement and do not require a hint. You have not been charged. \n\nAlready have all the achievements? Try the Challenge Hunt!")
                } else {
                    //prepare hint
                    var track_hint_text = "", racer_hint_text = ""
                    if (track !== null) {
                        var track_hint = track_hints[track]
                        for (var i = 0; i < hint_tier + 1; i++) {
                            var random_hint = Math.floor(Math.random() * track_hint.length)
                            track_hint_text += "○ *" + track_hint[random_hint] + "*\n"
                            track_hint.splice(random_hint, 1)
                        }
                        hintEmbed.addField("Track Hint", track_hint_text)
                    }
                    if (racer !== null) {
                        var racer_hint = racer_hints[racer]
                        for (var i = 0; i < hint_tier + 1; i++) {
                            var random_hint = Math.floor(Math.random() * racer_hint.length)
                            racer_hint_text += "○ *" + racer_hint[random_hint] + "*\n"
                            racer_hint.splice(random_hint, 1)
                        }
                        hintEmbed.addField("Racer Hint", racer_hint_text)
                    }
                    // process purchase
                    profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + hints[hint_tier].price })
                    var purchase = {
                        date: Date.now(),
                        purchased_item: hints[hint_tier].name,
                        selection: selection
                    }
                    profileref.child(member).child("purchases").push(purchase)
                    if (selection == "challenge_hunt") {
                        hintEmbed.setDescription("`-📀" + tools.numberWithCommas(hints[hint_tier].price) + "`\nBotto has randomly hid a large trugut bonus on a random challenge. You have one hour to find and complete the challenge and claim your bonus! If you use a bribe to successfully find the challenge, you will not be charged.\n" +
                            "Potential bonus: `📀" + tools.numberWithCommas(hints[hint_tier].bonus) + "`")

                    } else {
                        hintEmbed.setDescription("`-📀" + tools.numberWithCommas(hints[hint_tier].price) + "`")
                    }
                }
                hintEmbed
                    .setAuthor(interaction.member.user.username + "'s Hint", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                    .setTitle(":bulb: " + hints[hint_tier].name + ": " + achievement_name)
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "",
                        embeds: [hintEmbed],
                    }
                }
            })

        } else if (args[0].name == "settings") {
            //get input
            let member = interaction.member.user.id
            var winnings = undefined, odds_skips = undefined, odds_noupgrades = undefined, odds_non3lap = undefined, odds_mirrormode = undefined, odds_reset = undefined;
            if (args[0].hasOwnProperty("options")) {
                for (let i = 0; i < args[0].options.length; i++) {
                    if (args[0].options[i].name == "winnings") {
                        winnings = args[0].options[i].value
                    } else if (args[0].options[i].name == "skips_odds") {
                        odds_skips = args[0].options[i].value
                    } else if (args[0].options[i].name == "no_upgrades_odds") {
                        odds_noupgrades = args[0].options[i].value
                    } else if (args[0].options[i].name == "non_3_lap_odds") {
                        odds_non3lap = args[0].options[i].value
                    } else if (args[0].options[i].name == "mirrored_odds") {
                        odds_mirrormode = args[0].options[i].value
                    } else if (args[0].options[i].name == "reset") {
                        odds_reset = args[0].options[i].value
                    }
                }
            }
            var odds_text = ""
            var desc = "You have not customized your odds. The default odds are listed below. "
            var settings_default = {
                winnings: 1,
                skips: 25,
                no_upgrades: 15,
                non_3_lap: 5,
                mirrored: 5
            }
            var winnings_map = [
                { name: "Fair", text: ":gem: 36%\n:first_place: 32%\n:second_place: 27%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%" },
                { name: "Skilled", text: ":gem: 55%\n:first_place: 27%\n:second_place: 14%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%" },
                { name: "Winner Takes All", text: ":gem: 100%\n:first_place: 0%\n:second_place: 0%\n:third_place: 0%\n<:bumpythumb:703107780860575875> 0%" }
            ]
            if (odds_reset) { //resetting to default
                if (profiledata[member] !== undefined) {
                    desc = "You have successfully reset your settings to default. "
                    profileref.child(member).update({
                        winnings: settings_default.winnings,
                        skips: settings_default.skips,
                        no_upgrades: settings_default.no_upgrades,
                        non_3_lap: settings_default.non_3_lap,
                        mirror_mode: settings_default.mirrored
                    })
                }
            } else if (winnings == undefined && odds_skips == undefined && odds_noupgrades == undefined && odds_non3lap == undefined && odds_mirrormode == undefined) { //no odds submitted
                if (profiledata[member] !== undefined) {
                    desc = "Your current settings are shown below. " + "\n\n**Challenge Condition Odds**\nCustomize your odds by using the `/challenge settings` command and inputting numbers for Skips, No Upgrades, Non 3-lap, and Mirror Mode odds.\n" +
                        "**Challenge Winnings**\nYou can earn a certain amount of truguts based on the goal time you beat for each challenge. Customize your winnings pattern in the `/challenge settings` command and choose how to split your potential winnings."
                    winnings = profiledata[member].winnings
                    odds_skips = profiledata[member].skips
                    odds_noupgrades = profiledata[member].no_upgrades
                    odds_non3lap = profiledata[member].non_3_lap
                    odds_mirrormode = profiledata[member].mirror_mode
                } else {
                    desc = "You have not customized your settings. The default settings are shown below. " + "\n\n**Challenge Condition Odds**\nCustomize your odds by using the `/challenge settings` command and inputting numbers for Skips, No Upgrades, Non 3-lap, and Mirror Mode odds.\n" +
                        "**Challenge Winnings**\nYou can earn a certain amount of truguts based on the goal time you beat for each challenge. Customize your winnings pattern in the `/challenge settings` command and choose how to split your potential winnings."
                    winnings = settings_default.winnings
                    odds_skips = settings_default.skips
                    odds_noupgrades = settings_default.no_upgrades
                    odds_non3lap = settings_default.non_3_lap
                    odds_mirrormode = settings_default.mirrored
                }
            } else { //at least one setting was updated
                desc = "You have successfully updated your settings. Your new settings are shown below. "
                if (profiledata[member] == undefined) {
                    var data = {
                        mirror_mode: 5,
                        name: interaction.member.user.username,
                        no_upgrades: 15,
                        non_3_lap: 5,
                        skips: 25,
                        winnings: 1
                    }
                    profileref.child(member).set(data)
                }
                if (winnings == undefined) {
                    if (profiledata[member].winnings !== undefined) {
                        winnings = profiledata[member].winnings
                    } else {
                        winnings = settings_default.winnings
                    }
                }
                if (odds_skips == undefined) {
                    if (profiledata[member].skips !== undefined) {
                        odds_skips = profiledata[member].skips
                    } else {
                        odds_skips = settings_default.skips
                    }
                }
                if (odds_noupgrades == undefined) {
                    if (profiledata[member].no_upgrades !== undefined) {
                        odds_noupgrades = profiledata[member].no_upgrades
                    } else {
                        odds_noupgrades = settings_default.no_upgrades
                    }
                }
                if (odds_non3lap == undefined) {
                    if (profiledata[member].non_3_lap !== undefined) {
                        odds_non3lap = profiledata[member].non_3_lap
                    } else {
                        odds_non3lap = settings_default.non_3_lap
                    }
                }
                if (odds_mirrormode == undefined) {
                    if (profiledata[member].mirror_mode !== undefined) {
                        odds_mirrormode = profiledata[member].mirror_mode
                    } else {
                        odds_mirrormode = settings_default.mirrored
                    }
                }
                if (profiledata[member] !== undefined) {
                    profileref.child(member).update({
                        winnings: Number(winnings),
                        skips: odds_skips,
                        no_upgrades: odds_noupgrades,
                        non_3_lap: odds_non3lap,
                        mirror_mode: odds_mirrormode
                    })
                }
            }
            const oddsEmbed = new Discord.MessageEmbed()
                .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/game-die_1f3b2.png")
                .setAuthor(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                .setTitle("Your `/challenge` Settings")
                .setDescription(desc)
                .addField("Your Odds", "Skips - " + odds_skips + "%\nNo Upgrades - " + odds_noupgrades + "%\nNon 3-Lap - " + odds_non3lap + "%\nMirror Mode - " + odds_mirrormode + "%", true)
                .addField("Your Winnings: " + winnings_map[winnings].name, winnings_map[winnings].text, true)
                .setColor("EA596E")
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "",
                        embeds: [oddsEmbed],
                        flags: 64
                    }
                }
            })
        } else if (args[0].name == "profile") {
            var member = interaction.member.user.id
            const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
            const Member = Guild.members.cache.get(member); // Getting the member.
            if (args[0].options[0].hasOwnProperty("options")) {
                if (args[0].options[0].options[0].name == "user") {
                    member = args[0].options[0].options[0].value
                }
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 5,
                    data: {

                    }
                }
            })
            const profileEmbed = new Discord.MessageEmbed()
            profileEmbed
                .setAuthor(client.guilds.resolve(interaction.guild_id).members.resolve(member).user.username + "'s Profile", client.guilds.resolve(interaction.guild_id).members.resolve(member).user.avatarURL())
            if (args[0].options[0].name == "stats") {
                //console.log(trugutsEarned(member))
                var keys = Object.keys(challengedata)
                var stats = {
                    total: 0,
                    standard: 0,
                    skips: 0,
                    no_upgrades: 0,
                    non_3_lap: 0,
                    mirrored: 0
                }
                var times = {
                    total: 0,
                    elite: 0,
                    pro: 0,
                    rookie: 0,
                    amateur: 0,
                    youngling: 0
                }
                var bonuses = {
                    first: 0,
                    opponents_beat: 0,
                    pbs: 0,
                    non_standard: 0,
                    total_earnings: 0
                }
                var purchases = {
                    rerolls: 0,
                    track_bribes: 0,
                    racer_bribes: 0,
                    hints: 0,
                    total_spending: 0
                }
                bonuses.total_earnings = profiledata[member].truguts_earned
                purchases.total_spending = profiledata[member].truguts_spent
                if (profiledata[member].purchases !== undefined) {
                    var purchases = Object.keys(profiledata[member].purchases)
                    for (var p = 0; p < purchases.length; p++) {
                        var purchase = purchases[p]
                        if (["Basic Hint", "Standard Hint", "Deluxe Hint"].includes(profiledata[member].purchases[purchase].purchased_item)) {
                            purchases.hints++
                        }
                        if (profiledata[member].purchases[purchase].purchased_item == "track bribe") {
                            purchases.track_bribes++
                        }
                        if (profiledata[member].purchases[purchase].purchased_item == "racer bribe") {
                            purchases.racer_bribes++
                        }
                        if (profiledata[member].purchases[purchase].purchased_item == "reroll") {
                            purchases.rerolls++
                        }
                    }
                }

                var mostPod = {}, mostTrack = {}, mostPlanet = {}, mostCircuit = {}, likePod = {}, likeTrack = {}, dislikePod = {}, dislikeTrack = {}
                mostPod.most_count = 0
                mostPod.most_name = null
                mostTrack.most_count = 0
                mostTrack.most_name = null
                mostPlanet.most_count = 0
                mostPlanet.most_name = null
                mostCircuit.most_count = 0
                mostCircuit.most_name = null
                likePod.most_count = 0
                likePod.most_name = null
                likeTrack.most_count = 0
                likeTrack.most_name = null
                dislikePod.most_count = 0
                dislikePod.most_name = null
                dislikeTrack.most_count = 0
                dislikeTrack.most_name = null
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
                var hasraced = false
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (challengedata[k].user == member) {
                        stats.total++
                        //time stats
                        times.total += Number(challengedata[k].time)
                        var goals = getGoalTimes(challengedata[k].track, challengedata[k].racer, challengedata[k].skips, challengedata[k].nu, challengedata[k].laps)
                        var goal_array = ["elite", "pro", "rookie", "amateur", "youngling"]
                        var goal_time = null
                        for (var j = goals.length - 1; j > -1; j--) {
                            if (challengedata[k].time < goals[j]) {
                                goal_time = j
                            }
                        }
                        if (goal_time !== null) {
                            times[goal_array[goal_time]]++
                        }
                        //stats
                        if (!challengedata[k].mirror && !challengedata[k].nu && !challengedata[k].skips && challengedata[k].laps == 3) {
                            stats.standard++
                        } else {
                            if (challengedata[k].skips) {
                                stats.skips++
                                bonuses.non_standard++
                            }
                            if (challengedata[k].nu) {
                                stats.no_upgrades++
                                bonuses.non_standard++
                            }
                            if (challengedata[k].laps !== 3) {
                                stats.non_3_lap++
                                bonuses.non_standard++
                            }
                            if (challengedata[k].mirror) {
                                stats.mirrored++
                                bonuses.non_standard++
                            }
                        }
                        hasraced = true
                        getMost(mostPod, challengedata[k].racer)
                        getMost(mostTrack, challengedata[k].track)
                        getMost(mostPlanet, tracks[challengedata[k].track].planet)
                        getMost(mostCircuit, tracks[challengedata[k].track].circuit)
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
                        bonuses.opponents_beat += beat.length
                        if (first) {
                            bonuses.first++
                        }
                        if (pb) {
                            bonuses.pbs++
                        }
                    }
                }
                var keys = Object.keys(feedbackdata)
                var hasliked = false
                var hasdisliked = false
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (feedbackdata[k].user == member) {
                        if (feedbackdata[k].feedback == "👍") {
                            hasliked = true
                            getMost(likePod, feedbackdata[k].racer)
                            getMost(likeTrack, feedbackdata[k].track)
                        } else if (feedbackdata[k].feedback == "👎") {
                            hasdisliked = true
                            getMost(dislikePod, feedbackdata[k].racer)
                            getMost(dislikeTrack, feedbackdata[k].track)
                        }

                    }
                }
                profileEmbed
                    .setTitle("Random Challenge Statistics")
                    .setDescription("Current trugut balance: `📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`")
                //add goal times achieved for the stat section
                if (hasraced) {
                    profileEmbed
                        .addField(":bar_chart: Challenge Stats", "Total: `" + stats.total + "`\nStandard: `" + stats.standard + "`\nSkips: `" + stats.skips + "`\nNo Upgrades: `" + stats.no_upgrades + "`\nNon 3-Lap: `" + stats.non_3_lap + "`\nMirrored: `" + stats.mirrored + "`", true)
                        .addField(":chart_with_upwards_trend: Gameplay Trends", "**Most Played Pod:** \n" + racers[mostPod.most_name].flag + " " + racers[mostPod.most_name].name + " `" + mostPod.most_count + "`" +
                            "\n**Most Played Track:**\n" + tracks[mostTrack.most_name].name + " `" + mostTrack.most_count + "`" +
                            "\n**Most Played Planet:**\n" + planets[mostPlanet.most_name].name + " `" + mostPlanet.most_count + "`" +
                            "\n**Most Played Circuit:**\n" + circuits[mostCircuit.most_name].name + " `" + mostCircuit.most_count + "`", true)
                } else {
                    profileEmbed
                        .addField(":bar_chart: Challenge Stats", "No challenge data", true)
                        .addField(":chart_with_upwards_trend: Gameplay Trends", "No gameplay data", true)
                }
                var feedbacktrend = ""
                if (hasliked) {
                    feedbacktrend += "**Most Liked Pod:** \n" + racers[likePod.most_name].flag + " " + racers[likePod.most_name].name + " `👍" + likePod.most_count + "`" +
                        "\n**Most Liked Track:**\n" + tracks[likeTrack.most_name].name + " `👍" + likeTrack.most_count + "`\n"
                }
                if (hasdisliked) {
                    feedbacktrend += "**Most Disliked Pod:**\n" + racers[dislikePod.most_name].flag + " " + racers[dislikePod.most_name].name + " `👎" + dislikePod.most_count + "`" +
                        "\n**Most Disliked Track:**\n" + tracks[dislikeTrack.most_name].name + " `👎" + dislikeTrack.most_count + "`"
                }
                if (feedbacktrend == "") {
                    feedbacktrend = "No feedback data"
                }
                profileEmbed
                    .addField(":pencil: Feedback Trends", feedbacktrend, true)
                    .addField(":stopwatch: Time Stats", "Total time: `" + tools.timefix(times.total) + "`\n" +
                        "Elite: `" + times.elite + "`\n" +
                        "Pro: `" + times.pro + "`\n" +
                        "Rookie: `" + times.rookie + "`\n" +
                        "Amateur: `" + times.amateur + "`\n" +
                        "Youngling: `" + times.youngling + "`", true)
                    .addField(":moneybag: Bonus Stats", "Firsts: `" + bonuses.first + "`\n" +
                        "Opponents Beat: `" + bonuses.opponents_beat + "`\n" +
                        "Personal Bests: `" + bonuses.pbs + "`\n" +
                        "Non-Standard: `" + bonuses.non_standard + "`\n" +
                        "Total Earnings: `📀" + tools.numberWithCommas(bonuses.total_earnings) + "`", true)
                    .addField(":shopping_cart: Purchase Stats", "Rerolls: `" + purchases.rerolls + "`\n" +
                        "Track Bribes: `" + purchases.track_bribes + "`\n" +
                        "Racer Bribes: `" + purchases.racer_bribes + "`\n" +
                        "Hints: `" + purchases.hints + "`\n" +
                        "Total Spending: `📀" + tools.numberWithCommas(purchases.total_spending) + "`", true)
            } else if (args[0].options[0].name == "achievements") {
                //console.log(trugutsEarned(member))
                var keys = Object.keys(challengedata)
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (challengedata[k].user == member) {
                        achievements.galaxy_famous.collection[String(challengedata[k].track)] = 1
                        achievements.pod_champ.collection[String(challengedata[k].racer)] = 1
                        if (challengedata[k].skips) {
                            achievements.light_skipper.collection[String(challengedata[k].track)] = 1
                        }
                        if (challengedata[k].nu) {
                            achievements.slow_steady.collection[String(challengedata[k].racer)] = 1
                        }
                        if (challengedata[k].mirror) {
                            achievements.mirror_dimension.collection[String(challengedata[k].track)] = 1
                        }
                        if (challengedata[k].racer == tracks[String(challengedata[k].track)].favorite) {
                            achievements.crowd_favorite.collection[String(challengedata[k].track)] = 1
                        }
                        achievements.true_jedi.collection[String(challengedata[k].track + " " + challengedata[k].racer)] = 1
                    }
                }
                if (member == interaction.member.user.id) {
                    //award achievement if gotten
                    if (profiledata[member].achievements == undefined) {
                        var ach = {
                            galaxy_famous: false,
                            pod_champ: false,
                            light_skipper: false,
                            slow_steady: false,
                            mirror_dimension: false,
                            crowd_favorite: false,
                            true_jedi: false,
                            big_time_swindler: false
                        }
                        profileref.child(member).child("achievements").set(ach)
                    }
                    var achvs = Object.keys(achievements)
                    for (var i = 0; i < achvs.length; i++) {
                        var a = achvs[i]
                        achievements[a].count = Object.keys(achievements[a].collection).length
                        if (achievements[a].name == "Big-Time Swindler") {
                            achievements[a].count = profiledata[member].truguts_spent + profiledata[member].truguts_earned
                        }
                        if (achievements[a].count >= achievements[a].limit && profiledata[member].achievements[a] == false) {
                            profileref.child(member).child("achievements").child(a).set(true)
                            const congratsEmbed = new Discord.MessageEmbed()
                                .setAuthor(interaction.member.user.username + " got an achievement!", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                                .setDescription(achievements[a].description) //+ " `" + String(Object.keys(achievements[a].collection).length) + "/" + String(achievements[a].limit)) + "`"
                                .setColor("FFB900")
                                .setTitle("**:trophy: " + achievements[a].name + "**")
                            if (interaction.guild_id == "441839750555369474") {
                                congratsEmbed.setDescription("**<@&" + achievements[a].role + ">** - " + achievements[a].description)
                                Member.roles.add(achievements[a].role).catch(error => console.log(error))
                            }
                            client.channels.cache.get(interaction.channel_id).send(congratsEmbed)
                        }
                    }
                }
                var achvs = Object.keys(achievements)
                var achievement_count = 0
                for (var i = 0; i < achvs.length; i++) {
                    var a = achvs[i]
                    achievements[a].count = Object.keys(achievements[a].collection).length
                    if (achievements[a].name == "Big-Time Swindler") {
                        achievements[a].count = profiledata[member].truguts_spent + profiledata[member].truguts_earned
                    }
                    var achievement_title = ""
                    var achievement_text = ""
                    if (achievements[a].count >= achievements[a].limit) {
                        achievement_title += ":white_check_mark: "
                        achievement_count++
                    } else {
                        achievement_title += ":trophy: "
                    }
                    achievement_title += achievements[a].name + "  `" + tools.numberWithCommas(achievements[a].count) + "/" + tools.numberWithCommas(achievements[a].limit) + "`"
                    achievement_text = achievements[a].description
                    profileEmbed.addField(achievement_title, achievement_text, false)
                }
                profileEmbed.setTitle("Random Challenge Achievements (" + achievement_count + "/8)")
            }

            async function sendResponse() {
                return await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({ data: { embeds: [profileEmbed] } })
            }
            sendResponse()
        } else if (args[0].name == "about") {
            const challengeHelpEmbed = new Discord.MessageEmbed()
                .setTitle("Random Challenges")
                .setDescription("When you type `/challenge generate` or `/random challenge`, Botto will challenge you to race a random pod on a random track with random conditions. The default conditions are max upgrades, 3-lap, full track. You have 15 minutes to submit a time for the challenge which you may do by entering it in the same text channel as the challenge.")
                .addField("Challenge Settings", "Use the `/challenge settings` command to customize your challenge settings and modify the chances that Botto will roll a No Upgrades, Skips, Non 3-lap, or Mirrored challenge. You can select a challenge winnings pattern which determines how many truguts your submitted time will earn.", false)
                .addField("Earning Truguts", "Truguts are awarded depending on how fast your submitted time is compared to the given goal times and how your winnings are set up. Bonuses are available for beating other players' best times, beating your own time, rating challenges, and completing non-standard challenges (odds must be below 25%).", false)
                .addField("Spending Truguts", "You can spend truguts on 'rerolling' challenges that you wish to skip. Truguts can also be used to bribe Botto for a specific track or racer as part of the `/challenge generate` command. You can use the `/challenge hint` command to figure out what to bribe for your achievement progress.", false)
                .addField("Challenge Hunt", "Challenge Hunt is a way to earn big truguts fast and can be accessed via the `/challenge hint` command. Based on your hint selection, Botto hides a large trugut bonus on a random challenge. You have one hour to find this challenge and complete it to claim your bonus.", false)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [challengeHelpEmbed],
                        flags: 64
                    }
                }
            })
        } else if (args[0].name == "leaderboard") {
            const tools = require('./../tools.js');
            const Discord = require('discord.js');
            const challengeReport = new Discord.MessageEmbed()
            var trak = null
            var showall = false
            var desc = []
            //filters out other tracks
            for (let i = 0; i < args[0].options.length; i++) {

                if (args[0].options[i].name == "track") {
                    trak = Number(args[0].options[i].value)
                    challengeReport
                        .setTitle(tracks[trak].name + " | Challenge Times")
                        .setColor(planets[tracks[trak].planet].color)
                    var challenge = Object.values(challengedata)
                    var challengefiltered = challenge.filter(element => element.track == trak)
                } else if (args[0].options[i].name == "skips") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "skips") {
                        challengefiltered = challengefiltered.filter(element => element.skips == true)
                        desc.push("Skips")
                    } else if (input == "ft") {
                        challengefiltered = challengefiltered.filter(element => element.skips == false)
                        desc.push("Full Track")
                    }
                } else if (args[0].options[i].name == "upgrades") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "mu") {
                        challengefiltered = challengefiltered.filter(element => element.nu == false)
                        desc.push("Upgrades")
                    } else if (input == "nu") {
                        challengefiltered = challengefiltered.filter(element => element.nu == true)
                        desc.push("No Upgrades")
                    }
                } else if (args[0].options[i].name == "pod") {
                    var input = args[0].options[i].value.toLowerCase()
                    var podfilter = args[0].options[i].value.split(/[\s,]+/)
                    var filterin = true
                    for (var p = 0; p < podfilter.length; p++) {
                        if (podfilter[p] == "no") {
                            filterin = false
                        } else {
                            var numb = null
                            for (let q = 0; q < racers.length; q++) {
                                racers[q].nickname.forEach(nick => {
                                    if (nick.toLowerCase() == podfilter[p].toLowerCase()) {
                                        numb = q
                                        q = racers.length
                                    }
                                })
                            }
                            if (numb !== null) {
                                if (filterin) {
                                    challengefiltered = challengefiltered.filter(element => element.racer == numb)
                                    desc.push(racers[numb].name + " Only")
                                } else {
                                    challengefiltered = challengefiltered.filter(element => element.racer !== numb)
                                    desc.push("No " + racers[numb].name)
                                }
                            }
                        }
                    }
                } else if (args[0].options[i].name == "laps") {
                    var input = args[0].options[i].value
                    challengefiltered = challengefiltered.filter(element => element.laps == input)
                    if (input == 1) {
                        desc.push("1 Lap")
                    } else {
                        desc.push(input + " Laps")
                    }

                } else if (args[0].options[i].name == "mirrored") {
                    var input = args[0].options[i].value
                    if (input == "mirrored") {
                        challengefiltered = challengefiltered.filter(element => element.mirror == true)
                        desc.push("Mirrored")
                    } else if (input == "unmirrored") {
                        challengefiltered = challengefiltered.filter(element => element.mirror == false)
                        desc.push("Unmirrored")
                    }

                } else if (args[0].options[i].name == "player") {
                    var player = args[0].options[i].value
                    challengefiltered = challengefiltered.filter(element => element.user == player)
                    showall = true
                    const Guild = client.guilds.cache.get(interaction.guild_id);
                    const Member = Guild.members.cache.get(player)
                    challengeReport.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guild_id).members.resolve(player).user.avatarURL())
                }
            }
            challengefiltered.sort(function (a, b) {
                return a.time - b.time;
            })
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            if (trak !== null) {
                var j = 0
                var players = []
                var runs = Object.keys(challengefiltered)
                var pod_collection = {}
                for (var i = 0; i < runs.length; i++) {
                    var run = runs[i]
                    pod_collection[challengefiltered[run].racer] = 1
                }
                if (challengefiltered.length > 0) {
                    for (i = 0; i < 5;) {
                        var skip = false
                        for (k = 0; k < players.length; k++) {
                            if (challengefiltered[j].player + challengefiltered[j].skips + challengefiltered[j].racer + challengefiltered[j].nu + challengefiltered[j].laps == players[k] && !showall) {
                                skip = true
                            }
                        }
                        if (skip == false) {
                            var character = ""
                            var skps = "FT | "
                            var upgr = " | MU"
                            var mirr = ""
                            var laps = "3 Laps "
                            if (challengefiltered[j].skips == true) {
                                skps = "Skips | "
                            }
                            if (challengefiltered[j].nu == true) {
                                upgr = " | NU"
                            }
                            if (challengefiltered[j].mirror == true) {
                                mirr = "| Mirrored "
                            }
                            character = racers[challengefiltered[j].racer].flag + " " + racers[challengefiltered[j].racer].name
                            if (challengefiltered[j].laps !== 3) {
                                laps = challengefiltered[j].laps + " Laps "
                            }
                            challengeReport
                                .addField(pos[i] + " " + challengefiltered[j].name, skps + laps + mirr, true)
                                .addField(tools.timefix(Number(challengefiltered[j].time).toFixed(3)), " " + character + upgr, true)
                                .addField('\u200B', '\u200B', true)
                            players.push(challengefiltered[j].player + challengefiltered[j].skips + challengefiltered[j].racer + challengefiltered[j].nu + challengefiltered[j].laps)
                            i++
                        }
                        j++
                        if (j == challengefiltered.length) {
                            i = 5
                        }
                    }
                    challengeReport.setDescription(desc.join(', ') + " `[" + challengefiltered.length + " Total Runs]` `[" + Object.keys(pod_collection).length + "/23 Racers]`")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                //content: "",
                                embeds: [challengeReport]
                            }
                        }
                    })
                } else {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                content: "`Error: No challenge runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)],
                                //embeds: [racerEmbed]
                            }
                        }
                    })
                }
            } else {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: Track not found`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)],
                            //embeds: [racerEmbed]
                        }
                    }
                })
            }
        }
    }
}