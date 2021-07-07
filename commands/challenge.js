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
                truguts_spent: 0
            }
            profileref.child(member).set(data)
        }

        //const myEmbed = new Discord.MessageEmbed()
        if (args[0].name == "random") {
            client.buttons.get("challenge").execute(client, interaction, ["random", "menu"])
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