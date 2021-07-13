const { get } = require('request');

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
            galaxy_famous: { name: "Galaxy Famous", description: "Race on every track", role: "819514261289828362", limit: 25, count: 0, collection: {}, array: [], missing: [] },
            pod_champ: { name: "Pod Champ", description: "Race as every pod", role: "819514029218463774", limit: 23, count: 0, collection: {}, array: [], missing: [] },
            light_skipper: { name: "Lightspeed Skipper", description: "Race every track with a Skip", role: "819514330985922621", limit: 12, count: 0, collection: {}, array: [], missing: [] },
            slow_steady: { name: "Slow 'n Steady", description: "Race as every pod with No Upgrades", role: "819514431472926721", limit: 23, count: 0, collection: {}, array: [], missing: [] },
            mirror_dimension: { name: "Mirror Dimension", description: "Race Mirrored on every track", role: "843573636119134219", limit: 25, count: 0, collection: {}, array: [], missing: [] },
            crowd_favorite: { name: "Crowd Favorite", description: "Race as every track favorite on his track", role: "819514487852761138", limit: 25, count: 0, collection: {}, array: [], missing: [] },
            true_jedi: { name: "True Jedi", description: "Race as every pod on every track", role: "819514600827519008", limit: 575, count: 0, collection: {}, array: [], missing: [] },
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

        var hints = [
            { name: "Basic Hint", price: truguts.hint_basic, bonus: truguts.bonus_basic, description: "Single-part hint" , hunt: "Force-Intuitive"},
            { name: "Standard Hint", price: truguts.hint_standard, bonus: truguts.bonus_standard, description: "Two-part hint", hunt: "Force-Attuned"},
            { name: "Deluxe Hint", price: truguts.hint_deluxe, bonus: truguts.bonus_deluxe, description: "Three-part hint", hunt: "Force-Sensitive" }
        ]

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

        if (args[0] == "random") {
            //initialize player if they don't exist
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
                profileref.child(member).set(data)
            } else {
                if (profiledata[member].achievements == undefined) {
                    profileref.child(member).child("achievements").set(
                        {
                            galaxy_famous: false,
                            pod_champ: false,
                            light_skipper: false,
                            slow_steady: false,
                            mirror_dimension: false,
                            crowd_favorite: false,
                            true_jedi: false,
                            big_spender: false
                        })
                }
                profileref.child(member).child("name").set(interaction.member.user.username) //update name in case of namechange
            }
            const Guild = client.guilds.cache.get(interaction.guild_id)
            const Member = Guild.members.cache.get(member)

            function updateChallenge() {
                var best = [], played = false, record_holder = false, components = []
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
                    if (challengedata[k].track == profiledata[member].current.track && challengedata[k].racer == profiledata[member].current.racer && challengedata[k].laps == profiledata[member].current.laps && challengedata[k].mirror == profiledata[member].current.mirror && challengedata[k].nu == profiledata[member].current.nu && challengedata[k].skips == profiledata[member].current.skips) {
                        best.push(challengedata[k])
                        if (challengedata[k].user == member) {
                            played = true
                        }
                    }
                }
                best.sort(function (a, b) {
                    return a.time - b.time;
                })
                if (best.length > 0) {
                    if (best[0].user == member) {
                        record_holder = true
                    }
                }

                //build title
                var laptext = "", mirrortext = "", nutext = "", skipstext = "", flag = "", record = "", desc = ""
                var title = profiledata[member].current.title
                if (profiledata[member].current.nu) {
                    nutext = " with **NO UPGRADES**"
                }
                if (profiledata[member].current.skips) {
                    skipstext = " with **SKIPS**"
                }
                if (profiledata[member].current.laps !== 3) {
                    var laps = profiledata[member].current.laps
                    if (laps == 1) {
                        laptext = " for **" + laps + " Lap**"
                    } else {
                        laptext = " for **" + laps + " Laps**"
                    }

                }
                if (profiledata[member].current.mirror) {
                    mirrortext = ", **MIRRORED!**"
                }
                var bribed_racer = "", bribed_track = "", hunt_text = ""
                if (profiledata[member].current.racer_bribe) {
                    bribed_racer = "*"
                }
                if (profiledata[member].current.track_bribe) {
                    bribed_track = "*"
                }
                if (profiledata[member].current.hunt) {
                    hunt_text = ":dart: Challenge Hunt: "
                }
                var racer_flag = racers[profiledata[member].current.racer].flag
                var track_flag = planets[tracks[profiledata[member].current.track].planet].emoji
                if (profiledata[member].current.racer_bribe) {
                    racer_flag = ":moneybag:"
                }
                if (profiledata[member].current.track_bribe) {
                    track_flag = ":moneybag:"
                }
                var eTitle = "Race as **" + bribed_racer + racer_flag + " " + racers[profiledata[member].current.racer].name + bribed_racer + "**" + nutext + " on **" + bribed_track + track_flag + " " + tracks[profiledata[member].current.track].name + bribed_track + "**" + laptext + skipstext + mirrortext
                var eAuthor = [interaction.member.user.username + "'s Random Challenge", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL()]

                //build description
                if (Math.random() < 0.20 && best.length > 0) {
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
                    desc = desc + movieQuotes[Math.floor(Math.random() * movieQuotes.length)]
                }
                if (profiledata[member].current.hunt) {
                    desc += "\nYou found the Challenge Hunt! Complete the challenge to earn a `📀" + tools.numberWithCommas(profiledata[member].hunt.bonus) + "` bonus"
                } else {
                    if (profiledata[member].current.racer_bribe) {
                        desc += "\nBribed racer `-📀" + tools.numberWithCommas(truguts.bribe_racer) + "`"
                    }
                    if (profiledata[member].current.track_bribe) {
                        desc += "\nBribed track `-📀" + tools.numberWithCommas(truguts.bribe_track) + "`"
                    }
                }

                //calculate reroll
                var reroll = {
                    price: truguts.reroll,
                    selection: "full price"
                }
                if (played) {
                    reroll.price = truguts.reroll_discount
                    reroll.selection = "discount"
                }
                if (record_holder) {
                    reroll.price = 0
                    reroll.selection = "free"
                }
                var current_truguts = profiledata[member].truguts_earned - profiledata[member].truguts_spent
                if (title !== ":arrows_counterclockwise: Rerolled: ") {
                    profileref.child(member).child("current").child("reroll_cost").set(reroll.price)
                }
                if (current_truguts >= reroll.price) {
                    var price = reroll.price
                    if (price == 0) {
                        price = "free"
                    } else {
                        price = "📀" + tools.numberWithCommas(price)
                    }
                    if (!profiledata[member].current.completed) {
                        components.push({
                            type: 2,
                            style: 2,
                            custom_id: "challenge_random_reroll",
                            label: "Reroll (" + price + ")",
                            emoji: {
                                name: "🎲"
                            }
                        })
                    }

                }

                //draw components
                if (current_truguts >= truguts.bribe_track || current_truguts >= truguts.bribe_racer) {
                    if (!profiledata[member].current.completed) {
                        components.push({
                            type: 2,
                            style: 2,
                            custom_id: "challenge_random_bribe",
                            label: "Bribe",
                            emoji: {
                                name: "💰"
                            }
                        })
                    }
                }
                if (profiledata[member].current.completed) {
                    components.push({
                        type: 2,
                        style: 4,
                        custom_id: "challenge_random_play",
                        emoji: {
                            name: "🎲"
                        }
                    },
                        {
                            type: 2,
                            style: 2,
                            custom_id: "challenge_random_undo",
                            emoji: {
                                name: "↩️"
                            }
                        })
                    if (!profiledata[member].current.rated) {
                        components.push({
                            type: 2,
                            style: 2,
                            custom_id: "challenge_random_like",
                            emoji: {
                                name: "👍"
                            }
                        },
                            {
                                type: 2,
                                style: 2,
                                custom_id: "challenge_random_dislike",
                                emoji: {
                                    name: "👎"
                                }
                            })

                    }
                    components.push({
                        type: 2,
                        style: 2,
                        custom_id: "challenge_random_menu",
                        emoji: {
                            name: "menu",
                            id: "862620287735955487"
                        }
                    })
                }
                //calculate goal time
                var goals = getGoalTimes(profiledata[member].current.track, profiledata[member].current.racer, profiledata[member].current.skips, profiledata[member].current.nu, profiledata[member].current.laps)
                var goal_symbols = [":gem:", ":first_place:", ":second_place:", ":third_place:", "<:bumpythumb:703107780860575875>"]
                var goal_earnings = [
                    circuits[tracks[profiledata[member].current.track].circuit].winnings[profiledata[member].winnings][0],
                    circuits[tracks[profiledata[member].current.track].circuit].winnings[profiledata[member].winnings][1],
                    circuits[tracks[profiledata[member].current.track].circuit].winnings[profiledata[member].winnings][2],
                    circuits[tracks[profiledata[member].current.track].circuit].winnings[profiledata[member].winnings][3],
                    0
                ]
                var goal_earnings_text = []
                for (var i = 0; i < goal_earnings.length; i++) {
                    if (goal_earnings[i] == 0) {
                        goal_earnings_text[i] = ""
                    } else {
                        goal_earnings_text[i] = "  `+📀" + tools.numberWithCommas(goal_earnings[i]) + "`"
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
                    if (feedbackdata[k].track == profiledata[member].current.track && feedbackdata[k].racer == profiledata[member].current.racer && feedbackdata[k].laps == profiledata[member].current.laps && feedbackdata[k].mirror == profiledata[member].current.mirror && feedbackdata[k].nu == profiledata[member].current.nu && feedbackdata[k].skips == profiledata[member].current.skips) {
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

                //build best times
                var besttimes = "Be the first to submit a time for this challenge! \n `+📀" + tools.numberWithCommas(truguts.first) + "`"
                var pos = ["<:P1:671601240228233216> ", "<:P2:671601321257992204> ", "<:P3:671601364794605570> ", "4th ", "5th ", "6th ", "7th ", "8th ", "9th ", "10th "]
                var submitted_time = null
                if (best.length > 0) {
                    besttimes = ""
                    best.sort(function (a, b) {
                        return a.time - b.time;
                    })

                    var already = []
                    for (var i = 0; i < best.length; i++) {
                        if (!already.includes(best[i].name) || best[i].name == interaction.member.user.username) {
                            if (best[i].date == profiledata[member].current.start) {
                                besttimes = besttimes + pos[0] + "**" + tools.timefix(best[i].time) + " - " + best[i].name + " <a:newrecord:672640831882133524>**\n"
                                submitted_time = best[i]
                            } else if (best[i].name == interaction.member.user.username) {
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

                //color conditions
                var eColor = planets[tracks[profiledata[member].current.track].planet].color
                if (title == ":white_check_mark: Completed: ") {
                    eColor = "77B255"
                } else if (title == ":warning: 5 Minute Warning: " || title == "<a:countdown:672640791369482251> 1 Minute Warning: ") {
                    eColor = "FAA61A"
                } else if (title == ":negative_squared_cross_mark: Closed: " || title == ":arrows_counterclockwise: Rerolled: ") {
                    eColor = "2F3136"
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
                var achievement_message_array = []
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

                if (title !== ":white_check_mark: Completed: ") {
                    if (Object.keys(achievements.galaxy_famous.collection).length < achievements.galaxy_famous.limit && achievements.galaxy_famous.collection[profiledata[member].current.track] == undefined) {
                        achievement_message_array.push({
                            name: galaxyFamous,
                            count: Object.keys(achievements.galaxy_famous.collection).length,
                            limit: achievements.galaxy_famous.limit
                        })
                    }
                    if (Object.keys(achievements.pod_champ.collection).length < achievements.pod_champ.limit && achievements.pod_champ.collection[profiledata[member].current.racer] == undefined) {
                        achievement_message_array.push({
                            name: podChamp,
                            count: Object.keys(achievements.pod_champ.collection).length,
                            limit: achievements.pod_champ.limit
                        })
                    }
                    if (Object.keys(achievements.light_skipper.collection).length < achievements.light_skipper.limit && profiledata[member].current.skips && achievements.light_skipper.collection[profiledata[member].current.track] == undefined) {
                        achievement_message_array.push({
                            name: lightSkipper,
                            count: Object.keys(achievements.light_skipper.collection).length,
                            limit: achievements.light_skipper.limit
                        })
                    }
                    if (Object.keys(achievements.slow_steady.collection).length < achievements.slow_steady.limit && profiledata[member].current.nu && achievements.slow_steady.collection[profiledata[member].current.racer] == undefined) {
                        achievement_message_array.push({
                            name: slowSteady,
                            count: Object.keys(achievements.slow_steady.collection).length,
                            limit: achievements.slow_steady.limit
                        })
                    }
                    if (Object.keys(achievements.mirror_dimension.collection).length < achievements.mirror_dimension.limit && profiledata[member].current.mirror && achievements.mirror_dimension.collection[profiledata[member].current.track] == undefined) {
                        achievement_message_array.push({
                            name: mirrorDimension,
                            count: Object.keys(achievements.mirror_dimension.collection).length,
                            limit: achievements.mirror_dimension.limit
                        })
                    }
                    if (Object.keys(achievements.crowd_favorite.collection).length < achievements.crowd_favorite.limit && profiledata[member].current.racer == tracks[profiledata[member].current.track].favorite && achievements.crowd_favorite.collection[profiledata[member].current.track] == undefined) {
                        achievement_message_array.push({
                            name: crowdFavorite,
                            count: Object.keys(achievements.crowd_favorite.collection).length,
                            limit: achievements.crowd_favorite.limit
                        })
                    }
                    if (Object.keys(achievements.true_jedi.collection).length < achievements.true_jedi.limit && achievements.true_jedi.collection[profiledata[member].current.track + " " + profiledata[member].current.racer] == undefined) {
                        achievement_message_array.push({
                            name: trueJedi,
                            count: Object.keys(achievements.true_jedi.collection).length,
                            limit: achievements.true_jedi.limit
                        })
                    }
                }
                var achvs = Object.keys(achievements)
                for (var i = 0; i < achvs.length; i++) {
                    var a = achvs[i]
                    if (Object.keys(achievements[a].collection).length >= achievements[a].limit) { //if player has met condition for achievement
                        if (interaction.guild_id == "441839750555369474") {
                            if (!Member.roles.cache.some(r => r.id === achievements[a].role)) { //award role
                                Member.roles.add(achievements[a].role).catch(error => console.log(error))
                            }
                        }
                        if (profiledata[member].achievements[a] == false) { //send congrats
                            profileref.child(member).child("achievements").child(a).set(true)
                            const congratsEmbed = new Discord.MessageEmbed()
                                .setAuthor(interaction.member.user.username + " got an achievement!", eAuthor[1])
                                .setDescription(achievements[a].description) //+ " `" + String(Object.keys(achievements[a].collection).length) + "/" + String(achievements[a].limit)) + "`"
                                .setColor("FFB900")
                                .setTitle("**:trophy: " + achievements[a].name + "**")
                            if (interaction.guild_id == "441839750555369474") {
                                congratsEmbed.setDescription("**<@&" + achievements[a].role + ">** - " + achievements[a].description)
                            }
                            client.channels.cache.get(interaction.channel_id).send(congratsEmbed)
                        }
                    }
                }


                //calculate winnings
                var earnings = "", earnings_total = 0, hunt_bonus = 0
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
                        profileref.child(member).update({ hunt: { completed: true, hunt_bonus: hunt_bonus } })
                    }
                    if (goal_earnings[winnings_text] > 0) {
                        earnings += goal_symbols[winnings_text] + " `+📀" + tools.numberWithCommas(goal_earnings[winnings_text]) + "`\n"
                        earnings_total += goal_earnings[winnings_text]
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
                    if (profiledata[member].current.rated) {
                        earnings += "Rated `+📀" + tools.numberWithCommas(truguts.rated) + "`\n"
                        earnings_total += truguts.rated
                    }
                    if (profiledata[member].current.truguts_earned == 0) {
                        profileref.child(member).update({ truguts_earned: profiledata[member].truguts_earned + earnings_total })
                        profileref.child(member).child("current").update({ truguts_earned: earnings_total })
                    }
                    earnings += "\n**Total: **`+📀" + tools.numberWithCommas(earnings_total) + "`"
                    //earnings += "\n**New balance: **`📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent) + "`"
                }

                //construct embed
                const newEmbed = new Discord.MessageEmbed()
                    .setTitle(title + hunt_text + eTitle)
                    .setColor(eColor)
                    .setFooter("Truguts: 📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent))
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
                    newEmbed.setTitle(title + hunt_text + "~~" + eTitle + "~~")
                    if (title == ":arrows_counterclockwise: Rerolled: ") {
                        var reroll_cost = profiledata[member].current.reroll_cost
                        var reroll_description = ""
                        if (reroll_cost == truguts.reroll_discount) {
                            reroll_description = "`-📀" + tools.numberWithCommas(truguts.reroll_discount) + "` (discounted)"
                        } else if (reroll_cost == 0) {
                            reroll_description = "(no charge for record holders)"
                        } else {
                            reroll_description = "`-📀" + tools.numberWithCommas(truguts.reroll) + "`"
                        }
                        newEmbed.setDescription(reroll_description)
                    }
                }
                var data = {
                    message: newEmbed,
                    components: components
                }
                return data
            }

            if (args[1] == "play") {
                var challengestart = Date.now()

                //check if challenge already in progress
                if (profiledata[member].current.completed == false && profiledata[member].current.start > challengestart - 900000) {
                    var challengeinProgress = new Discord.MessageEmbed()
                    challengeinProgress
                        .setTitle("<:WhyNobodyBuy:589481340957753363> Challenge in Progress")
                        .setDescription("You already have a challenge in progress in the <#" + profiledata[member].current.channel + "> channel.\nIf you have enough truguts, you can reroll the challenge by clicking the :game_die: **Reroll** button on your challenge, otherwise you will need to wait until the challenge expires to roll a new one.")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                embeds: [challengeinProgress],
                                flags: 64
                            }
                        }
                    })
                    return
                }

                if (interaction.name !== "revive") {
                    client.api.interactions(interaction.id, interaction.token).callback.post({ data: { type: 5, data: {} } })
                }

                //get values
                var random_racer = Math.floor(Math.random() * 23)
                var random_track = Math.floor(Math.random() * 25)
                var laps = 3, alt_laps = [1, 2, 4, 5]
                var mirror = false, nu = false, skips = false, hunt = false

                //hunt condiiton
                if (profiledata[member].hunt !== undefined) {
                    if (random_racer == profiledata[member].hunt.racer && random_track == profiledata[member].hunt.track && !profiledata[member].hunt.completed && Date.now() - 3600000 <= profiledata[member].hunt.date) {
                        hunt = true
                    }
                }

                //set odds
                var odds = {
                    skips: 25,
                    no_upgrades: 15,
                    non_3_lap: 5,
                    mirrored: 5
                }
                if (profiledata[member] !== undefined) {
                    odds.skips = profiledata[member].skips / 100
                    odds.no_upgrades = profiledata[member].no_upgrades / 100
                    odds.non_3_lap = profiledata[member].non_3_lap / 100
                    odds.mirrored = profiledata[member].mirror_mode / 100
                }
                if (tracks[random_track].hasOwnProperty("parskiptimes")) {
                    if (Math.random() < odds.skips) {
                        skips = true
                    }
                }
                if (Math.random() < odds.no_upgrades) {
                    nu = true
                }
                if (Math.random() < odds.non_3_lap) {
                    laps = alt_laps[Math.floor(Math.random() * 4)]
                }
                if (Math.random() < odds.mirrored) {
                    mirror = true
                }

                //revived challenge
                if (interaction.name == "revive") {
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

                //set current challenge
                var current = {
                    start: challengestart,
                    completed: false,
                    channel: interaction.channel_id,
                    token: interaction.token,
                    racer: random_racer,
                    track: random_track,
                    laps: laps,
                    nu: nu,
                    skips: skips,
                    mirror: mirror,
                    truguts: 0,
                    hunt: hunt,
                    hunt_bonus: 0,
                    truguts_earned: 0,
                    track_bribe: false,
                    racer_bribe: false,
                    rated: false,
                    revived: false,
                    undone: false,
                    rerolled: false,
                    title: ""
                }
                profileref.child(member).child("current").set(current)

                var token = interaction.token
                if (interaction.name == "revive") {
                    token = profiledata[member].current.token
                }
                async function sendResponse() {
                    var response = null
                    var data = updateChallenge()
                    response = await client.api.webhooks(client.user.id, token).messages('@original').patch({
                        data: {
                            embeds: [data.message],
                            components: [
                                {
                                    type: 1,
                                    components: data.components
                                }
                            ]
                        }
                    })
                    var webhook = await client.api.webhooks(client.user.id, token).messages('@original').get()
                    profileref.child(member).child("current").update({ message: webhook.id })
                    return response
                }
                sendResponse().then(() => {

                    var warning = ""
                    warning = "<@" + member + ">"
                    setTimeout(async function () { //5 minute warning
                        if (!profiledata[member].current.completed && interaction.token == profiledata[member].current.token) {
                            profileref.child(member).child("current").child("title").set(":warning: 5 Minute Warning: ")
                            try {
                                var data = updateChallenge()
                                await client.api.webhooks(client.user.id, token).messages('@original').patch({
                                    data: {
                                        content: warning,
                                        embeds: [data.message],
                                        components: [
                                            {
                                                type: 1,
                                                components: data.components
                                            }
                                        ]
                                    }
                                })
                            } catch { }
                        }
                    }, 600000)
                    setTimeout(async function () { //1 minute warning
                        if (!profiledata[member].current.completed && interaction.token == profiledata[member].current.token) {
                            profileref.child(member).child("current").child("title").set("<a:countdown:672640791369482251> 1 Minute Warning: ")
                            try {
                                var data = updateChallenge()
                                await client.api.webhooks(client.user.id, token).messages('@original').patch({
                                    data: {
                                        content: warning,
                                        embeds: [data.message],
                                        components: [
                                            {
                                                type: 1,
                                                components: data.components
                                            }
                                        ]
                                    }
                                })
                            } catch { }
                        }
                    }, 840000)
                    setTimeout(async function () { //close challenge and remove components
                        if (!profiledata[member].current.completed && interaction.token == profiledata[member].current.token) {
                            profileref.child(member).child("current").update({ completed: true, title: ":negative_squared_cross_mark: Closed: " })
                            var data = updateChallenge()
                            try {
                                await client.api.webhooks(client.user.id, token).messages('@original').patch({
                                    data: {
                                        content: "",
                                        embeds: [data.message],
                                        components: [
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 2,
                                                        style: 4,
                                                        custom_id: "challenge_random_play",
                                                        label: "New Challenge",
                                                        emoji: {
                                                            name: "🎲"
                                                        }
                                                    },
                                                    {
                                                        type: 2,
                                                        style: 2,
                                                        custom_id: "challenge_random_menu",
                                                        emoji: {
                                                            name: "menu",
                                                            id: "862620287735955487"
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                })
                            } catch (error) { console.log(error) }
                        }
                    }, 895000)
                    //collect times
                    const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m, { time: 900000 }); //messages
                    collector.on('collect', message => {
                        if (profiledata[member].current.start == challengestart && profiledata[member].current.completed == false) {
                            if (!isNaN(message.content.replace(":", "")) && tools.timetoSeconds(message.content) !== null) {
                                var challengeend = Date.now()
                                if (member == message.author.id) {
                                    var time = tools.timetoSeconds(message.content)
                                    if ((challengeend - challengestart) < time * 1000 && interaction.name !== "revive") {
                                        message.reply("*I warn you. No funny business.*")
                                        profileref.child(member).child("current").update({ completed: true, title: ":negative_squared_cross_mark: Closed: ", funny_business: true })
                                        try {
                                            client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({ data: { embeds: [updateChallenge()], components: [] } })
                                        } catch (error) {
                                            console.error(error)
                                        }
                                    } else {
                                        //log time
                                        var submissiondata = {
                                            user: message.author.id,
                                            name: message.author.username,
                                            time: time,
                                            date: challengestart,
                                            racer: profiledata[member].current.racer,
                                            track: profiledata[member].current.track,
                                            laps: profiledata[member].current.laps,
                                            nu: profiledata[member].current.nu,
                                            skips: profiledata[member].current.skips,
                                            mirror: profiledata[member].current.mirror,
                                            settings: {
                                                winnings: profiledata[member].winnings,
                                                no_upgrades: profiledata[member].no_upgrades,
                                                non_3_lap: profiledata[member].non_3_lap,
                                                skips: profiledata[member].skips,
                                                mirror_mode: profiledata[member].mirror_mode
                                            },
                                            hunt: profiledata[member].current.hunt_bonus
                                        }
                                        var newPostRef = ref.push(submissiondata);
                                        profileref.child(member).child("current").update({ submission: newPostRef.key, title: ":white_check_mark: Completed: ", completed: true })
                                        var data = updateChallenge()
                                        try {
                                            var data = updateChallenge()
                                            client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({
                                                data: {
                                                    embeds: [data.message],
                                                    components: [
                                                        {
                                                            type: 1,
                                                            components: data.components
                                                        }
                                                    ]
                                                }
                                            })
                                        } catch { }
                                        if (message.guild) {
                                            try {
                                                message.delete() //delete time message
                                            } catch { }
                                        }
                                    }
                                }
                            }
                        }

                    })
                })
            } else if (args[1] == "reroll") {
                if (interaction.message.id == profiledata[member].current.message) {
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent >= profiledata[member].current.reroll_cost) {
                        //process purchase
                        if (profiledata[member].current.reroll_cost > 0) {
                            var selection = ""
                            if (profiledata[member].current.reroll_cost == truguts.reroll) {
                                selection = "full price"
                            } else {
                                selection = "discount"
                            }
                            var purchase = {
                                date: Date.now(),
                                purchased_item: "reroll",
                                selection: selection
                            }
                            profileref.child(member).child("purchases").push(purchase)
                            profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + profiledata[member].current.reroll_cost })
                        }
                        profileref.child(member).child("current").update({ completed: true, rerolled: true, title: ":arrows_counterclockwise: Rerolled: " })
                        try {
                            var data = updateChallenge()
                            async function followUp() {
                                const fu = await client.api.webhooks(client.user.id, profiledata[member].current.token).post({
                                    data: {
                                        embeds: [data.message],
                                        flags: 64,
                                        components: []
                                    }
                                })
                                return fu
                            }
                            client.api.webhooks(client.user.id, profiledata[member].current.token).messages('@original').delete().then(followUp().then((thing) => { client.buttons.get("challenge").execute(client, interaction, ["random", "play"]) }))
                        } catch (error) { console.log(error) }
                    } else {
                        var noMoney = new Discord.MessageEmbed()
                        noMoney
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nReroll cost: `📀" + tools.numberWithCommas(truguts.reroll) + "`")
                        client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: 4,
                                data: {
                                    //content: "",
                                    embeds: [noMoney],
                                    flags: 64
                                }
                            }
                        })
                    }
                } else {
                    var noMoney = new Discord.MessageEmbed()
                    noMoney
                        .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Challenge!")
                        .setDescription("This is someone else's challenge or the option to reroll has expired. Roll a challenge with the button below.")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                //content: "",
                                embeds: [noMoney],
                                flags: 64,
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                style: 4,
                                                custom_id: "challenge_random_play",
                                                emoji: {
                                                    name: "🎲"
                                                }
                                            },
                                        ]
                                    }

                                ]
                            }
                        }
                    })
                }
            } else if (args[1] == "bribe") {
                if (interaction.message.id == profiledata[member].current.message) {
                    if (interaction.data.hasOwnProperty("values")) {
                        var purchase = {
                            date: Date.now(),
                        }
                        var bribe_cost = 0
                        var selection = Number(interaction.data.values[0])
                        if (args[2] == "track") {
                            bribe_cost = truguts.bribe_track
                            purchase.purchased_item = "track bribe"
                        } else if (args[2] == "racer") {
                            bribe_cost = truguts.bribe_racer
                            purchase.purchased_item = "racer bribe"
                        }
                        purchase.selection = selection
                        if (profiledata[member].truguts_earned - profiledata[member].truguts_spent < bribe_cost) {
                            //player doesn't have enough money
                            var noMoney = new Discord.MessageEmbed()
                            noMoney
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nBribe cost: `" + tools.numberWithCommas(bribe_cost) + "`")
                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: 4,
                                    data: {
                                        embeds: [noMoney],
                                        flags: 64
                                    }
                                }
                            })
                            return
                        } else {
                            //process purchase
                            var bribed = false
                            if (args[2] == "track" && selection !== profiledata[member].current.track) {
                                profileref.child(member).child("current").update({ track_bribe: true, track: selection })
                                bribed = true
                            } else if (args[2] == "racer" && selection !== profiledata[member].current.racer) {
                                profileref.child(member).child("current").update({ racer_bribe: true, racer: selection })
                                bribed = true
                            }
                            if (bribed) {
                                profileref.child(member).child("purchases").push(purchase)
                                profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + bribe_cost })
                            }
                        }
                    }
                    //populate options
                    var track_selections = []
                    var racer_selections = []
                    for (var i = 0; i < 25; i++) {
                        var racer_option = {
                            label: racers[i].name,
                            value: i,
                            description: racers[i].pod.substring(0, 50),
                            emoji: {
                                name: racers[i].flag.split(":")[1],
                                id: racers[i].flag.split(":")[2].replace(">", "")
                            }
                        }
                        var track_option = {
                            label: tracks[i].name.replace("The Boonta Training Course", "Boonta Training Course"),
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
                    var components = []
                    if (profiledata[member].current.track_bribe == false) {
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
                    if (profiledata[member].current.racer_bribe == false) {
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
                    var data = updateChallenge()
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 7,
                            data: {
                                embeds: [data.message],
                                components: components
                            }
                        }
                    })
                } else {
                    var noMoney = new Discord.MessageEmbed()
                    noMoney
                        .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Challenge!")
                        .setDescription("This is someone else's challenge or the option to bribe has expired. Roll a challenge with the button below.")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                //content: "",
                                embeds: [noMoney],
                                flags: 64,
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                style: 4,
                                                custom_id: "challenge_random_play",
                                                emoji: {
                                                    name: "🎲"
                                                }
                                            },
                                        ]
                                    }

                                ]
                            }
                        }
                    })
                }
            } else if (args[1] == "undo") {
                if (interaction.message.id == profiledata[member].current.message && profiledata[member].current.completed) {
                    profileref.child(member).update({ truguts_earned: profiledata[member].truguts_earned - profiledata[member].current.truguts_earned })
                    profileref.child(member).child("current").update({ truguts_earned: 0, title: "", completed: false, undone: true })
                    ref.child(profiledata[member].current.submission).remove()
                    try {
                        var data = updateChallenge()
                        client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: 7,
                                data: {
                                    embeds: [data.message],
                                    components: [
                                        {
                                            type: 1,
                                            components: data.components
                                        }
                                    ]
                                }
                            }
                        })
                    } catch { }
                } else {
                    var noMoney = new Discord.MessageEmbed()
                    noMoney
                        .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Challenge!")
                        .setDescription("This is someone else's challenge or the option to undo has expired. Roll a challenge with the button below.")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                //content: "",
                                embeds: [noMoney],
                                flags: 64,
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                style: 4,
                                                custom_id: "challenge_random_play",
                                                emoji: {
                                                    name: "🎲"
                                                }
                                            },
                                        ]
                                    }

                                ]
                            }
                        }
                    })
                }
            } else if (["like", "dislike"].includes(args[1])) {
                if (interaction.message.id == profiledata[member].current.message && profiledata[member].current.rated == false) {
                    profileref.child(member).child("current").update({ rated: true })
                    profileref.child(member).update({ truguts_earned: profiledata[member].truguts_earned + truguts.rated })
                    var feedback = '👍'
                    if (args[1] == "dislike") {
                        feedback = "👎"
                    }
                    var feedbackdata = {
                        user: member,
                        feedback: feedback,
                        date: profiledata[member].current.start,
                        racer: profiledata[member].current.racer,
                        track: profiledata[member].current.track,
                        laps: profiledata[member].current.laps,
                        nu: profiledata[member].current.nu,
                        skips: profiledata[member].current.skips,
                        mirror: profiledata[member].current.mirror
                    }
                    feedbackref.push(feedbackdata);
                    try {
                        var data = updateChallenge()
                        client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: 7,
                                data: {
                                    embeds: [data.message],
                                    components: [
                                        {
                                            type: 1,
                                            components: data.components
                                        }
                                    ]
                                }
                            }
                        })
                    } catch { }
                } else {
                    var noMoney = new Discord.MessageEmbed()
                    noMoney
                        .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Challenge!")
                        .setDescription("This is someone else's challenge or the option to rate has expired. Roll a challenge with the button below.")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                //content: "",
                                embeds: [noMoney],
                                flags: 64,
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                style: 4,
                                                custom_id: "challenge_random_play",
                                                emoji: {
                                                    name: "🎲"
                                                }
                                            },
                                        ]
                                    }

                                ]
                            }
                        }
                    })
                }
            } else if (args[1] == "menu") {
                var type = 7
                if (args.includes("initial")) {
                    type = 4
                }
                const myEmbed = new Discord.MessageEmbed()
                    .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                    .setTitle("<:menu:862620287735955487> Menu")
                    .setColor("#ED4245")
                    .setDescription("This is the Random Challenge menu. From here, you can access all options related to random challenges. Press the **Play** button to get rollin'.")
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            //content: "",
                            embeds: [myEmbed],
                            components: [
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
                                            custom_id: "challenge_random_settings",
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
                                            custom_id: "challenge_random_profile",
                                            style: 2,
                                            label: "Profile",
                                            emoji: {
                                                name: "👤"
                                            }
                                        },
                                        {
                                            type: 2,
                                            custom_id: "challenge_random_leaderboards",
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
                    }
                })
            } else if (args[1] == "hint") {
                //get achievement progress
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


                var achievement = null, selection = null

                if (!args.includes("initial")) {
                    if (args[args.length - 1].startsWith("uid")) {
                        if (args[args.length - 1].replace("uid", "") !== member) {
                            const hintMessage = new Discord.MessageEmbed()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Hints!")
                                .setDescription("This is someone else's hint menu. Get your own by clicking the button below.")
                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: 4,
                                    data: {
                                        content: "",
                                        embeds: [hintMessage],
                                        flags: 64,
                                        components: [
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 2,
                                                        custom_id: "challenge_random_hint_initial",
                                                        style: 4,
                                                        label: "Hints",
                                                        emoji: {
                                                            name: "💡"
                                                        }
                                                    },
                                                    {
                                                        type: 2,
                                                        style: 2,
                                                        custom_id: "challenge_random_menu_initial",
                                                        emoji: {
                                                            name: "menu",
                                                            id: "862620287735955487"
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            })
                            return
                        }
                    }
                    for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) {
                        var option = interaction.message.components[0].components[0].options[i]
                        if (option.hasOwnProperty("default")) {
                            if (option.default) {
                                achievement = option.value
                            }
                        }
                    }
                    for (var i = 0; i < interaction.message.components[1].components[0].options.length; i++) {
                        var option = interaction.message.components[1].components[0].options[i]
                        if (option.hasOwnProperty("default")) {
                            if (option.default) {
                                selection = i
                            }
                        }
                    }
                }
                if (args[2] == "achievement") {
                    achievement = interaction.data.values[0]
                } else if (args[2] == "selection") {
                    selection = Number(interaction.data.values[0])
                }
                //draw components
                var components = [], achievement_options = [], selection_options = [], disabled = false
                var ach = Object.keys(achievements)
                for (i = 0; i < ach.length; i++) {
                    if (profiledata[member].achievements[ach[i]] == false && ach[i] !== "big_time_swindler") {
                        var option = {
                            label: achievements[ach[i]].name,
                            value: ach[i],
                            description: achievements[ach[i]].description + ": " + achievements[ach[i]].array.length + "/" + achievements[ach[i]].limit,
                            emoji: {
                                name: "🏆"
                            }
                        }
                        if (achievement == ach[i]) {
                            option.default = true
                        }
                        achievement_options.push(option)
                    }
                }
                for (i = 0; i < hints.length; i++) {
                    var option = {
                        label: hints[i].name,
                        value: i,
                        description: "📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description,
                        emoji: {
                            name: "💡"
                        }
                    }
                    if (selection == i) {
                        option.default = true
                    }
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent >= hints[i].price) {
                        selection_options.push(option)
                    }
                }
                if ([achievement, selection].includes(null)) {
                    disabled = true
                }
                const hintEmbed = new Discord.MessageEmbed()
                    .setTitle(":bulb: Hints")
                    .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                    .setColor("#ED4245")
                if (achievement_options.length > 0) {
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "challenge_random_hint_achievement_uid" + member,
                                options: achievement_options,
                                placeholder: "Select Achievement",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "challenge_random_hint_selection_uid" + member,
                                    options: selection_options,
                                    placeholder: "Select Hint Type",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    custom_id: "challenge_random_hint_purchase_uid" + member,
                                    label: "Buy Hint",
                                    style: 4,
                                    disabled: disabled
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
                        })
                    hintEmbed
                        .setDescription("Hints help you narrow down what challenges you need to complete for :trophy: **Achievements**. The more you pay, the better the hint.")
                        .setFooter(interaction.member.user.username + " | Truguts: 📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent), client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                } else {
                    hintEmbed.setDescription("Wow! You've already earned all the achievements! This means you have no use for hints, but you may be interested in earning a large Trugut bonus from a :dart: **Challenge Hunt**.")
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 2,
                                custom_id: "challenge_random_hunt_initial",
                                label: "Challenge Hunt",
                                style: 4,
                                emoji: {
                                    name: "🎯"
                                }
                            },
                            {
                                type: 2,
                                style: 2,
                                custom_id: "challenge_random_menu_initial",
                                emoji: {
                                    name: "menu",
                                    id: "862620287735955487"
                                }
                            }
                        ]
                    })
                }
                if (args[2] == "purchase") {
                    const hintBuy = new Discord.MessageEmbed()
                        .setColor("#ED4245")
                    var flags = 0
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent < hints[selection].price) {
                        hintBuy
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no hint!'*\nYou do not have enough truguts to buy the selected hint.\n\nHint cost: `" + hints[selection].price + "`")
                        flags = 64
                    } else {
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
                        achievement_name = achievements[achievement].name
                        if (["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite"].includes(achievement)) {
                            track = achievements[achievement].missing[Math.floor(Math.random() * achievements[achievement].missing.length)]
                            if (achievement == "crowd_favorite") {
                                racer = tracks[track].favorite
                            }
                        }
                        if (["pod_champ", "slow_steady"].includes(achievement)) {
                            racer = achievements[achievement].missing[Math.floor(Math.random() * achievements[achievement].missing.length)]
                        }
                        if (achievement == "true_jedi") {
                            var random = achievements.true_jedi.missing[Math.floor(Math.random() * achievements.true_jedi.missing.length)]
                            random = random.split(",")
                            track = random[0]
                            racer = random[1]
                        }
                        if ((["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", "true_jedi"].includes(achievement) && track == null) || (["pod_champ", "slow_steady", "true_jedi"].includes(selection) && racer == null)) {
                            //player already has achievement
                            hintBuy.setDescription("You already have this achievement and do not require a hint. You have not been charged. \n\nAlready have all the achievements? Try the Challenge Hunt!")
                        } else {
                            //prepare hint
                            var track_hint_text = "", racer_hint_text = ""
                            if (track !== null) {
                                var track_hint = track_hints[track]
                                for (var i = 0; i < selection + 1; i++) {
                                    var random_hint = Math.floor(Math.random() * track_hint.length)
                                    track_hint_text += "○ *" + track_hint[random_hint] + "*\n"
                                    track_hint.splice(random_hint, 1)
                                }
                                hintBuy.addField("Track Hint", track_hint_text)
                            }
                            if (racer !== null) {
                                var racer_hint = racer_hints[racer]
                                for (var i = 0; i < selection + 1; i++) {
                                    var random_hint = Math.floor(Math.random() * racer_hint.length)
                                    racer_hint_text += "○ *" + racer_hint[random_hint] + "*\n"
                                    racer_hint.splice(random_hint, 1)
                                }
                                hintBuy.addField("Racer Hint", racer_hint_text)
                            }
                            // process purchase
                            profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + hints[selection].price })
                            var purchase = {
                                date: Date.now(),
                                purchased_item: hints[selection].name,
                                selection: achievement
                            }
                            profileref.child(member).child("purchases").push(purchase)
                            hintBuy.setDescription("`-📀" + tools.numberWithCommas(hints[selection].price) + "`")

                        }
                        hintBuy
                            .setAuthor(interaction.member.user.username + "'s Hint", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                            .setTitle(":bulb: " + hints[selection].name + ": " + achievement_name)
                    }
                    hintBuy.setFooter("Truguts: 📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent))
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                content: "",
                                embeds: [hintBuy],
                                flags: flags
                            }
                        }
                    })
                    return
                }

                var type = 7
                if (args.includes("initial")) {
                    //type = 4
                }
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            content: "",
                            embeds: [hintEmbed],
                            components: components,
                            //flags: 64
                        },

                    }
                })


            } else if (args[1] == "hunt") {
                const huntEmbed = new Discord.MessageEmbed()
                    .setTitle(":dart: Challenge Hunt")
                    .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                    .setDescription("Challenge Hunt is a way to earn big truguts fast. Based on your hint selection, Botto hides a large trugut bonus on a random challenge. You have one hour to find and complete this challenge to claim your bonus.")
                    .setFooter(interaction.member.user.username + " | Truguts: 📀" + tools.numberWithCommas(profiledata[member].truguts_earned - profiledata[member].truguts_spent), client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                    .setColor("#ED4245")
                var selection = null
                if (!args.includes("initial")) {
                    if (args[args.length - 1].startsWith("uid")) {
                        if (args[args.length - 1].replace("uid", "") !== member) {
                            const huntMessage = new Discord.MessageEmbed()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Hunt!")
                                .setDescription("This is someone else's hunt menu. Get your own by clicking the button below.")
                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: 4,
                                    data: {
                                        content: "",
                                        embeds: [huntMessage],
                                        flags: 64,
                                        components: [
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 2,
                                                        custom_id: "challenge_random_hunt_initial",
                                                        style: 4,
                                                        label: "Challenge Hunt",
                                                        emoji: {
                                                            name: "🎯"
                                                        }
                                                    },
                                                    {
                                                        type: 2,
                                                        style: 2,
                                                        custom_id: "challenge_random_menu_initial",
                                                        emoji: {
                                                            name: "menu",
                                                            id: "862620287735955487"
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            })
                            return
                        }
                    }
                    for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) {
                        var option = interaction.message.components[0].components[0].options[i]
                        if (option.hasOwnProperty("default")) {
                            if (option.default) {
                                selection = i
                            }
                        }
                    }
                }
                if (args[2] == "selection") {
                    selection = Number(interaction.data.values[0])
                }
                if(profiledata[member].hunt !==undefined){
                    if(profiledata[member].hunt.date > Date.now() - 1000*60*60 && profiledata[member].hunt.completed == false){
                        huntEmbed.addField(":exclamation: Hunt Already in Progress", "You already have an active hunt with " + tools.timefix((profiledata[member].hunt.date + 1000*60*60-Date.now())/1000) + " remaining. Starting a new one will overwrite the hunt in progress.")
                    }
                }
                //draw components
                var components = [], selection_options = []
                for (i = 0; i < hints.length; i++) {
                    var option = {
                        label: hints[i].hunt,
                        value: i,
                        description: "Price: 📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description + " | Bonus: 📀" + tools.numberWithCommas(hints[i].bonus),
                        emoji: {
                            name: "🎯"
                        }
                    }
                    if (selection == i) {
                        option.default = true
                    }
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent >= hints[i].price) {
                        selection_options.push(option)
                    }
                }
                var disabled = false
                if (selection == null) {
                    disabled = true
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "challenge_random_hunt_selection_uid" + member,
                                options: selection_options,
                                placeholder: "Select Hunt Type",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                custom_id: "challenge_random_hunt_start_uid" + member,
                                label: "Start Hunt",
                                style: 4,
                                disabled: disabled
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
                    })
                if (args[2] == "start") {
                    var flags = 0
                    if (profiledata[member].truguts_earned - profiledata[member].truguts_spent < hints[selection].price) {
                        hintBuy
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no hunt!'*\nYou do not have enough truguts to buy the selected hunt.\n\nHunt cost: `" + hints[selection].price + "`")
                        flags = 64
                    } else {
                        //process purchase
                        profileref.child(member).update({ truguts_spent: profiledata[member].truguts_spent + hints[selection].price })
                        var purchase = {
                            date: Date.now(),
                            purchased_item: hints[selection].name,
                            selection: "challenge_hunt"
                        }
                        profileref.child(member).child("purchases").push(purchase)

                        var track = Math.floor(Math.random() * 25)
                        var racer = Math.floor(Math.random() * 23)
                        profileref.child(member).update({
                            hunt: {
                                track: track,
                                racer: racer,
                                date: Date.now(),
                                bonus: hints[selection].bonus,
                                completed: false
                            }
                        })
                        const huntBuy = new Discord.MessageEmbed()
                            .setTitle(":dart: " + hints[selection].hunt)
                            .setColor("#ED4245")
                            .setAuthor(interaction.member.user.username + "'s Challenge Hunt", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                        var track_hint = track_hints[track]
                        var track_hint_text = "", racer_hint_text = ""
                        for (var i = 0; i < selection + 1; i++) {
                            var random_hint = Math.floor(Math.random() * track_hint.length)
                            track_hint_text += "○ *" + track_hint[random_hint] + "*\n"
                            track_hint.splice(random_hint, 1)
                        }
                        huntBuy.addField("Track Hint", track_hint_text)

                        var racer_hint = racer_hints[racer]
                        for (var i = 0; i < selection + 1; i++) {
                            var random_hint = Math.floor(Math.random() * racer_hint.length)
                            racer_hint_text += "○ *" + racer_hint[random_hint] + "*\n"
                            racer_hint.splice(random_hint, 1)
                        }
                        huntBuy.addField("Racer Hint", racer_hint_text)
                        huntBuy.setDescription("`-📀" + tools.numberWithCommas(hints[selection].price) + "`\nBotto has randomly hid a large trugut bonus on a random challenge. You have one hour to find and complete the challenge and claim your bonus! If you use a bribe to successfully find the challenge, you will not be charged.\n" +
                            "Potential bonus: `📀" + tools.numberWithCommas(hints[selection].bonus) + "`")
                        client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: 4,
                                data: {
                                    content: "",
                                    embeds: [huntBuy]
                                }
                            }
                        })
                        return
                    }
                }
                var type = 7
                if (args.includes("initial")) {
                    //type = 4
                }
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            content: "",
                            embeds: [huntEmbed],
                            components: components,
                            //flags: 64
                        },

                    }
                })
            } else if (args[1] == "settings") {
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
            } else if (args[1] == "profile") {
                async function sendCallback() {
                    const wait = client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 5,
                            data: {
                                content: "Coming right up..."
                                //embeds: [racerEmbed]
                            }
                        }
                    })
                    return wait
                }
                async function sendResponse(embed) {
                    const response = await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({ data: { embeds: [embed] } })
                    return response
                }
                sendCallback().then(() => {
                    var member = interaction.member.user.id
                    const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
                    const Member = Guild.members.cache.get(member); // Getting the member.
                    if (args[0].options[0].hasOwnProperty("options")) {
                        if (args[0].options[0].options[0].name == "user") {
                            member = args[0].options[0].options[0].value
                        }
                    }

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
                            var prchs = Object.keys(profiledata[member].purchases)
                            for (var p = 0; p < prchs.length; p++) {
                                var purchase = prchs[p]
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
                                            if (challengedata[n].user == member) {
                                                pb = true
                                                if (challengedata[n].time < challengedata[k].time) {
                                                    pb = false
                                                }
                                            }
                                        }
                                        if (challengedata[n].user !== member && challengedata[n].time > challengedata[k].time && challengedata[n].date < challengedata[k].date && !beat.includes(challengedata[n].user)) {
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
                    return profileEmbed
                }).then((embed) => sendResponse(embed))



            } else if (args[1] == "about") {
                const challengeHelpEmbed = new Discord.MessageEmbed()
                    .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                    .setTitle(":grey_question: About")
                    .setColor("#ED4245")
                    .setDescription("When you roll a random challenge, Botto will challenge you to race a random pod on a random track with random conditions. The default conditions are max upgrades, 3-lap, full track. You have 15 minutes to submit a time for the challenge which you may do by entering it in the same text channel as the challenge.")
                    .addField(":gear: Settings", "You can customize your challenge settings and modify the chances that Botto will roll a No Upgrades, Skips, Non 3-lap, or Mirrored challenge. You can also select a winnings pattern which determines the share of truguts your submitted time will earn.", false)
                    .addField(":dvd: Earning Truguts", "Truguts are awarded depending on how fast your submitted time is compared to the given goal times and how your winnings are set up. Bonuses are available for beating other players' best times, beating your own time, rating challenges, and completing non-standard challenges (odds must be equal to or below 25%).", false)
                    .addField(":dvd: Spending Truguts", "You can spend truguts on 'rerolling' challenges that you wish to skip. Truguts can also be used on :moneybag: **Bribes** for a specific track or racer. You can use :bulb: **Hints** to figure out what to bribe for your achievement progress.", false)
                    .addField(":dart: Challenge Hunt", "Challenge Hunt is a way to earn big truguts fast and can be accessed via the **Random Challenge** menu. Based on your hint selection, Botto hides a large trugut bonus on a random challenge. You have one hour to find this challenge and complete it to claim your bonus.", false)
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            embeds: [challengeHelpEmbed],
                            flags: 64
                        }
                    }
                })
            } else if (args[1] == "leaderboards") {
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
        } else if (args[0] == "community") {
            if (args[1] == "submit") {

            } else if (args[1] == "browse") {

            } else if (args[1] == "create") {

            } else if (args[1] == "profile") {

            } else if (args[1] == "leaderboards") {

            }
        }

    }
}