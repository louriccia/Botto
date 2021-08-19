module.exports = {
    name: 'tourney',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var tools = require('./../tools.js');
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");
        var tourney_rulesets = database.ref('tourney/rulesets');
        var tourney_rulesets_data = {}
        tourney_rulesets.on("value", function (snapshot) {
            tourney_rulesets_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        if (args[0] == "ranks") {
            if (args[1].startsWith("page")) {
                var ranks = tools.getRanks()
                const tourneyRanks = new Discord.MessageEmbed()
                tourneyRanks.setTitle("Elo Ratings")
                var offset = Number(args[1].replace("page", ""))
                var rnk_keys = Object.keys(ranks)
                var rnk_vals = Object.values(ranks)
                var pages = 0
                if (rnk_vals.length % 5 == 0) {
                    pages = Math.floor(rnk_vals.length / 5)
                } else {
                    pages = Math.floor(rnk_vals.length / 5) + 1
                }
                for (var i = 0; i < rnk_keys.length; i++) {
                    rnk_vals[i].player = rnk_keys[i]
                }
                rnk_vals.sort(function (a, b) {
                    return b.rank - a.rank;
                })
                for (var i = 5 * offset; i < 5 * (1 + offset); i++) {
                    if (i == rnk_vals.length) {
                        i = 5 * (1 + offset)
                    } else {

                        var arrow = "<:green_arrow:852392123093614642>"
                        if (rnk_vals[i].change < 0) {
                            arrow = ":small_red_triangle_down:"
                            rnk_vals[i].change = Math.abs(rnk_vals[i].change)
                        }
                        tourneyRanks
                            .addField(tools.ordinalSuffix(i) + " " + tourney_participants_data[rnk_vals[i].player].name, "`" + rnk_vals[i].matches + " matches`", true)
                            .addField(Math.round(rnk_vals[i].rank), arrow + " " + Math.round(rnk_vals[i].change), true)
                            .addField('\u200B', '\u200B', true)
                    }
                }
                var previous = false, next = false
                if (offset <= 0) {
                    previous = true
                }
                if (offset + 1 == pages) {
                    next = true
                }
                var type = 7
                if (args.includes("initial")) {
                    type = 4
                }
                tourneyRanks
                    .setFooter("Page " + (offset + 1) + " / " + pages)
                    .setColor("#E75A70")
                    .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/crossed-swords_2694-fe0f.png")
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            //content: "",
                            embeds: [tourneyRanks],
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            label: "",
                                            emoji: {
                                                id: "852392123151679548",
                                                name: "left"
                                            },
                                            style: 2,
                                            custom_id: "tourney_ranks_page" + (offset - 1),
                                            disabled: previous
                                        },
                                        {
                                            type: 2,
                                            label: "",
                                            emoji: {
                                                id: "852392123109998602",
                                                name: "right"
                                            },
                                            style: 2,
                                            custom_id: "tourney_ranks_page" + (offset + 1),
                                            disabled: next
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                })
            }
        } else if (args[0] == "matches") {
            if (args[1] == "browse") {
                if (args[2].startsWith("page")) {
                    var tourney_matches = database.ref('tourney/matches')
                    tourney_matches.on("value", function (snapshot) {
                        tourney_matches_data = snapshot.val();
                    }, function (errorObject) {
                        console.log("The read failed: " + errorObject);
                    });
                    var tourney_participants = database.ref('tourney/participants')
                    tourney_participants.on("value", function (snapshot) {
                        tourney_participants_data = snapshot.val();
                    }, function (errorObject) {
                        console.log("The read failed: " + errorObject);
                    });
                    var tourney_tournaments = database.ref('tourney/tournaments')
                    tourney_tournaments.on("value", function (snapshot) {
                        tourney_tournaments_data = snapshot.val();
                    }, function (errorObject) {
                        console.log("The read failed: " + errorObject);
                    });
                    var offset = Number(args[2].replace("page", ""))
                    var type = 7
                    var pages = 0
                    var mtch = Object.keys(tourney_matches_data)
                    var matches = []
                    for (var i = 0; i < mtch.length; i++) {
                        var m = mtch[i]
                        tourney_matches_data[m].id = m
                        matches.push(tourney_matches_data[m])
                    }
                    matches.sort(function (a, b) {
                        return Date.parse(b.datetime) - Date.parse(a.datetime);
                    })
                    if (matches.length % 5 == 0) {
                        pages = Math.floor(matches.length / 5)
                    } else {
                        pages = Math.floor(matches.length / 5) + 1
                    }
                    const tourneyMatches = new Discord.MessageEmbed()
                        .setTitle("Recent Matches")
                        .setFooter("Page " + (offset + 1) + " / " + pages)
                        .setColor("#E75A70")
                        .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/crossed-swords_2694-fe0f.png")
                    for (var i = 5 * offset; i < 5 * (1 + offset); i++) {
                        if (i == matches.length) {
                            i = 5 * (1 + offset)
                        } else {
                            var date = new Date(matches[i].datetime).toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET"
                            if (matches[i].url !== "") {
                                date = "[" + date + "](" + matches[i].url + ")"
                            }
                            var players = Object.values(matches[i].players)
                            var commentators = Object.values(matches[i].commentators)
                            var score = []
                            var comms = []
                            var player_text = []
                            for (k = 0; k < players.length; k++) {
                                player_text.push(tourney_participants_data[String(players[k].player)].name)
                                if (![undefined, ""].includes(players[k].score)) {
                                    score.push(players[k].score)
                                }
                            }
                            if (commentators.length > 0) {
                                for (k = 0; k < commentators.length; k++) {
                                    if (commentators[k] !== "") {
                                        comms.push(tourney_participants_data[String(commentators[k])].name)
                                    }
                                }
                            }

                            if (score.length > 0) {
                                score = "score: ||`" + score.join(" to ") + "`||"
                            }
                            var bracketround = ""
                            if (matches[i].bracket !== "") {
                                bracketround += " - " + matches[i].bracket
                                if (![undefined, ""].includes(matches[i].round)) {
                                    bracketround += ": " + matches[i].round
                                }
                            }
                            tourneyMatches
                                .addField(tourney_tournaments_data[matches[i].tourney].nickname + bracketround, date + "\nid: `" + matches[i].id + "`", true)
                                .addField(player_text.join(" vs. "), score + "\n" + ":microphone2: " + comms.join(", "), true)
                                .addField('\u200B', '\u200B', true)
                        }
                    }
                    if (args.includes("initial")) {
                        type = 4
                    }
                    var previous = false, next = false
                    if (offset <= 0) {
                        previous = true
                    }
                    if (offset + 1 == pages) {
                        next = true
                    }
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: type,
                            data: {
                                //content: "",
                                embeds: [tourneyMatches],
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                label: "",
                                                emoji: {
                                                    id: "852392123151679548",
                                                    name: "left"
                                                },
                                                style: 2,
                                                custom_id: "tourney_matches_browse_page" + (offset - 1),
                                                disabled: previous
                                            },
                                            {
                                                type: 2,
                                                label: "",
                                                emoji: {
                                                    id: "852392123109998602",
                                                    name: "right"
                                                },
                                                style: 2,
                                                custom_id: "tourney_matches_browse_page" + (offset + 1),
                                                disabled: next
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    })
                }
            }
        } else if (args[0] == "schedule") {
            var type = 4
            if (args[1] == "refresh") {
                type = 7
            }
            const rp = require('request-promise');
            const $ = require('cheerio');
            const url = 'http://speedgaming.org/swe1racer/';
            const fs = require('fs');
            rp(url)
                .then(function (html) {
                    var table = $('tbody', html)
                    var schedule = []
                    $('tr', table).each((i, elem) => {
                        var text = $('td', elem).text().replace(/\t/g, "").split(/\n/)
                        for (var i = 0; i < text.length; i++) {
                            if (text[i] == "") {
                                text.splice(i, 1)
                                i = i - 1
                            }
                        }
                        schedule.push(text)
                    })
                    const tourneyReport = new Discord.MessageEmbed()
                    tourneyReport
                        .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/crossed-swords_2694-fe0f.png")
                        .setTitle("Match Schedule")
                        .setURL("http://speedgaming.org/swe1racer/")
                        .setDescription("Upcoming matches on speedgaming.org/swe1racer\n(Current as of <t:" + Math.round(Date.now() / 1000) + ":R>)")
                        .setFooter("Times are displayed in your local time")
                    schedule.splice(0, 1)
                    if (schedule.length > 0) {
                        for (i = 0; i < schedule.length; i++) {
                            var channel = ""
                            var comm = ""
                            if (schedule[i].length > 4) {
                                if (!schedule[i][4].includes("?")) {
                                    channel = "[" + schedule[i][4] + "](https://www.twitch.tv/" + schedule[i][4] + ")"
                                }
                                if (schedule[i][5] !== undefined) {
                                    comm = schedule[i][5]
                                }
                            }
                            var datetime = new Date(schedule[i][0].replace(", ", " " + new Date().getFullYear() + " ") + schedule[i][1].replace(" ", " ") + " EDT").getTime() / 1000
                            tourneyReport
                                .addField("<t:" + datetime + ":F>", schedule[i][2] + "\n" + channel, true)
                                .addField(":crossed_swords: " + schedule[i][3].replace(/,/g, " vs."), ":microphone2: " + comm, true)
                                .addField('\u200B', '\u200B', true)
                        }
                    } else {
                        tourneyReport.setDescription("No matches are currently scheduled")
                    }
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: type,
                            data: {
                                //content: content,
                                //flags: 64
                                embeds: [tourneyReport],
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                label: "",
                                                emoji: {
                                                    id: "854097998357987418",
                                                    name: "refresh"
                                                },
                                                style: 2,
                                                custom_id: "tourney_schedule_refresh",
                                            },
                                            {
                                                type: 2,
                                                label: "Schedule Match",
                                                style: 5,
                                                url: "http://speedgaming.org/swe1racer/submit/"
                                            },
                                            {
                                                type: 2,
                                                label: "Sign Up for Commentary",
                                                style: 5,
                                                url: "http://speedgaming.org/swe1racer/crew/"
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    })
                })
        } else if (args[0] == "rulesets") {
            var type = 7
            if (args.includes("initial")) {
                type = 4
            }
            var flags = 0
            var components = []
            const rulesetEmbed = new Discord.MessageEmbed()
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/crossed-swords_2694-fe0f.png")

            function showRuleset(ruleset){
                if (ruleset.type == "1v1") {
                    var conditions = {
                        mu: "Max Upgrades",
                        nu: "No Upgrades",
                        ft: "Full Track",
                        sk: "Skips",
                        pb: "Pod Ban",
                        pc: "Pod Choice",
                        um: "Unmirrored",
                        mi: "Mirrored",
                        l1: "1 Lap",
                        l2: "2 Laps",
                        l3: "3 Laps",
                        l4: "4 Laps",
                        l5: "5 Laps"
                    }

                    var methods = {
                        poe: "Process of Elimination",
                        chance_cube: "Chance Cube",
                        random: "Random",
                        player_pick: "Player's Pick",
                        disabled: "Disabled",
                        winners_pick: "Winner's Pick",
                        losers_pick: "Loser's Pick",
                        salty_runback: "Salty Runback",
                        saltier_runback: "Saltier Runback",
                        saltiest_runback: "Saltiest Runback",
                        any: "Any Condition",
                        random_mirrored: "Random Mirrored",
                        limited_choice: "Limited Choice",
                        random_limited_choice: "Random Limited Choice",
                        pod_pool: "Pod Pool",
                        winners_either: "Winner's Either/Or",
                        losers_either: "Loser's Either/Or",
                        win: "Earned via Win",
                        loss: "Earned via Loss",
                        either_or: "Either/Or",
                        no_limit: "No Match Limit"
                    }

                    var permabans = [
                        {
                            name: "Pod",
                            command: "permapodban",
                            method: "ppodmethod",
                            limit: "ppodlimit"
                        },
                        {
                            name: "Track",
                            command: "permatrackban",
                            method: "ptrackmethod",
                            limit: "ptracklimit"
                        },
                        {
                            name: "Condition",
                            command: "permaconban",
                            method: "pconmethod",
                            limit: "pconlimit"
                        }
                    ]

                    var tempbans = [
                        {
                            name: "Pod",
                            command: "temppodban",
                            method: "tpodmethod",
                            limit: "tpodlimit",
                            mlimit: "tpodmlimit"
                        },
                        {
                            name: "Track",
                            command: "temptrackban",
                            method: "ttrackmethod",
                            limit: "ttracklimit",
                            mlimit: "ttrackmlimit"
                        },
                        {
                            name: "Condition",
                            command: "tempconban",
                            method: "tconmethod",
                            limit: "tconlimit",
                            mlimit: "tconmlimit"
                        }
                    ]

                    function trackSelection(collection) {
                        var amc = 0, spc = 0, gal = 0, inv = 0
                        var result = ""
                        var first_nicks = []
                        var missing = []
                        for (i = 0; i < 25; i++) {
                            if (collection.includes(String(i))) {
                                if (collection[i] >= 0 && collection[i] < 7) {
                                    amc++
                                }
                                if (collection[i] >= 7 && collection[i] < 14) {
                                    spc++
                                }
                                if (collection[i] >= 14 && collection[i] < 21) {
                                    gal++
                                }
                                if (collection[i] >= 21 && collection[i] < 25) {
                                    inv++
                                }
                                first_nicks.push("`" + tracks[i].nickname[0] + "`")
                            } else {
                                missing.push("`No " + tracks[i].nickname[0] + "`")
                            }

                        }

                        if (collection.length == 25) {
                            result = "`Any Track`"
                        } else if ((collection.length == 7 && [amc, spc, gal].includes(7)) || collection.length == 4 && inv == 4) {
                            if (amc == 7) {
                                result = "`Amateur Circuit`"
                            } else if (spc == 7) {
                                result = "`Semi-Pro Circuit`"
                            } else if (gal == 7) {
                                result = "`Galactic Circuit`"
                            } else if (inv == 4) {
                                result = "`Invitational Circuit`"
                            }
                        } else {
                            if (missing.length < first_nicks.length) {
                                result = missing.join(" ")
                            } else {
                                result = first_nicks.join(" ")
                            }
                        }
                        return result
                    }

                    rulesetEmbed
                        .setDescription("Ruleset Type: 1v1")
                    var fields = []
                    //wins
                    var field = {}
                    field.name = ":trophy: Wins"
                    field.value = "`First to " + ruleset.wins + "`\n`Best of " + (ruleset.wins * 2 - 1) + "`"
                    field.inline = true
                    fields.push(field)
                    //default
                    field = {}
                    field.name = ":eight_spoked_asterisk: Default Conditions"
                    var cond = Object.values(ruleset.default)
                    var cons = []
                    cond.forEach(con => {
                        cons.push("`" + conditions[con] + "`")
                    })
                    field.value = cons.join(" ")
                    field.inline = true
                    fields.push(field)
                    //gents
                    field = {}
                    field.name = ":tophat: Gentleman's Agreement"
                    field.value = "`" + ruleset.gents + "`"
                    field.inline = true
                    fields.push(field)
                    //first track
                    field = {}
                    field.name = ":checkered_flag: First Track"
                    field.value = "`" + methods[ruleset.firstmethod] + "`\n"
                    field.value += "Options: " + trackSelection(Object.values(ruleset.firsttrack))
                    field.inline = true
                    fields.push(field)
                    //permabans
                    for (b = 0; b < permabans.length; b++) {
                        if (ruleset[permabans[b].method] !== "disabled") {
                            field = {}
                            field.name = ":no_entry_sign: " + permabans[b].name + " Permaban"
                            field.value = "`" + methods[ruleset[permabans[b].method]] + "`\n"
                            if (ruleset[permabans[b].method] == "random") {
                                field.value += "`" + ruleset[permabans[b].limit] + " Per Match`"
                            } else {
                                field.value += "`" + ruleset[permabans[b].limit] + " Per Player Per Match`"
                            }
                            field.inline = true
                            fields.push(field)
                        }
                    }
                    //tempbans
                    for (b = 0; b < tempbans.length; b++) {
                        if (ruleset[tempbans[b].method] !== "disabled") {
                            field = {}
                            field.name = ":x: " + tempbans[b].name + " Tempban"
                            field.value = "`" + methods[ruleset[tempbans[b].method]] + "`\n"
                            field.value += "`" + ruleset[tempbans[b].limit] + " Max Per Race`\n"
                            if (ruleset[tempbans[b].method] !== "random") {
                                if (ruleset[tempbans[b].mlimit] == "no_limit") {
                                    field.value += "`No Match Limit`"
                                } else if (ruleset[tempbans[b].mlimit] == "wins") {
                                    field.value += "`One Per Win`"
                                } else if (ruleset[tempbans[b].mlimit] == "losses") {
                                    field.value += "`One Per Loss`"
                                } else {
                                    field.value += "`" + ruleset[tempbans[b].mlimit] + " Per Player Per Match`"
                                }
                            }
                            field.inline = true
                            fields.push(field)
                        }
                    }
                    //track selection
                    field = {}
                    field.name = ":triangular_flag_on_post: Track Selection"
                    field.value = "`" + methods[ruleset.trackmethod] + "`\n"
                    field.value += trackSelection(Object.values(ruleset.tracktracks))
                    field.inline = true
                    fields.push(field)
                    //Repeat Tracks
                    if (ruleset.dupecondition !== "disabled") {
                        field = {}
                        field.name = ":repeat: Repeat Tracks"
                        field.value = "`" + methods[ruleset.dupecondition] + "`\n"
                        field.value += "`" + ruleset.dupelimit + " Per Player Per Match`"
                        field.inline = true
                        fields.push(field)
                    }
                    //Conditions
                    if (ruleset.conmethod !== "disabled") {
                        field = {}
                        field.name = ":asterisk: Conditions"
                        field.value = "`" + methods[ruleset.conmethod] + "`\n"
                        field.value += "`" + ruleset.conmax + " Max Per Race`\n"
                        if (ruleset.conlimit == "wins") {
                            field.value += "`One Per Win`"
                        } else if (ruleset.conlimit == "losses") {
                            field.value += "`One Per Loss`"
                        } else {
                            field.value += "`" + ruleset.conlimit + " Per Player Per Match`\n"
                        }
                        var cond = Object.values(ruleset.conoptions)
                        var cons = []
                        cond.forEach(con => {
                            cons.push("`" + conditions[con] + "`")
                        })
                        field.value += "Options: " + cons.join(" ")
                        field.inline = true
                        fields.push(field)
                    }
                    //Pod Selection
                    field = {}
                    field.name = "<:Pod1:525755322355417127> Pod Selection"
                    field.value = "`" + methods[ruleset.podmethod] + "`\n"
                    if (ruleset.podmethod == "random_limited_choice") {
                        field.value += "`" + ruleset.rndlimited + " Choices Per Race`\n"
                    } else if (ruleset.podmethod == "pod_pool") {
                        field.value += "`" + ruleset.poollimit + " Uses Per Pod`\n"
                    }
                    var podpods = Object.values(ruleset.podpods)
                    if (podpods.length == 23) {
                        field.value += "`Any Pod`"
                    } else {
                        var pods = []
                        var missing_pods = []
                        for (i = 0; i < 23; i++) {
                            if (podpods.includes(String(i))) {
                                pods.push(racers[i].flag)
                            } else {
                                missing_pods.push("No " + racers[i].flag)
                            }
                        }
                        if (missing_pods.length < pods.length) {
                            field.value += "Options: " + missing_pods.join(", ")
                        } else {
                            field.value += "Options: " + pods.join("")
                        }
                    }
                    field.inline = true
                    fields.push(field)
                    //construct fields
                    return fields
                }
            }
            
            if (args[1] == "browse") {
                rulesetEmbed.setTitle("Rulesets")
                var buttons = [
                    {
                        type: 2,
                        label: "New",
                        style: 3,
                        custom_id: "tourney_rulesets_type",
                    }
                ]
                if (![undefined, null].includes(tourney_rulesets_data.saved)) {
                    var saved = Object.keys(tourney_rulesets_data.saved)
                    var rulesets = []
                    for (i = 0; i < saved.length; i++) {
                        var s = saved[i]
                        var r = {
                            label: tourney_rulesets_data.saved[s].name,
                            value: s,
                            description: tourney_rulesets_data.saved[s].type + " Ruleset by " + client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.username,
                        }
                        if(interaction.data.hasOwnProperty("values")){
                            if(r.value == interaction.data.values[0]){
                                r.default = true
                            }
                        }
                        
                        rulesets.push(r)
                    }
                    if(interaction.data.hasOwnProperty("values")){
                        var ruleset = tourney_rulesets_data.saved[interaction.data.values[0]]
                        rulesetEmbed.setTitle("Rulesets: "+ ruleset.name)
                        .setDescription("Type: " + ruleset.type)
                        .addFields(showRuleset(ruleset))
                        .setFooter(client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.avatarURL(), client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.avatarURL())
                        buttons.push(
                            {
                                type: 2,
                                label: "Edit",
                                style: 2,
                                custom_id: "tourney_rulesets_edit_" + interaction.data.values[0],
                            },
                            {
                                type: 2,
                                label: "Clone",
                                style: 2,
                                custom_id: "tourney_rulesets_clone_" + interaction.data.values[0],
                            },
                            {
                                type: 2,
                                label: "Delete",
                                style: 4,
                                custom_id: "tourney_rulesets_delete_" + interaction.data.values[0],
                            }
                        )
                    }

                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_browse",
                                options: rulesets,
                                placeholder: "Select Ruleset",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }
                
                components.push({
                    type: 1,
                    components: buttons
                })
            } else if (args[1] == "type") {
                flags = 64
                type = 4
                if (![null, undefined].includes(tourney_rulesets_data)) {
                    if (![null, undefined].includes(tourney_rulesets_data.new)) {
                        if (args[2] == "new") {
                            tourney_rulesets.child("new").child(interaction.member.user.id).remove()
                        }
                        if (tourney_rulesets_data.new.hasOwnProperty(interaction.member.user.id)) {
                            rulesetEmbed
                                .setTitle(":exclamation: Unsaved Ruleset")
                                .setDescription("You have an unsaved ruleset. Would you like to continue editing that one or start a new one?")

                            components.push(
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            label: "Continue",
                                            style: 3,
                                            custom_id: "tourney_rulesets_general",
                                        },
                                        {
                                            type: 2,
                                            label: "Start New",
                                            style: 4,
                                            custom_id: "tourney_rulesets_type_new",
                                        }
                                    ]
                                }
                            )

                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: type,
                                    data: {
                                        flags: flags,
                                        embeds: [rulesetEmbed],
                                        components: components
                                    }
                                }
                            })
                            return
                        }
                    }
                }


                //select type
                rulesetEmbed
                    .setTitle("Create a New Ruleset")
                    .setDescription("Select the type of ruleset you'd like to create.")

                var options = [
                    {
                        label: "Qualifier",
                        value: "qual",
                        description: "Players have a set time limit to get their best time with multiple attempts"
                    },
                    {
                        label: "1v1",
                        value: "1v1",
                        description: "Players face off until one reaches the win limit"
                    },
                    {
                        label: "1vAll",
                        value: "1vall",
                        description: "Players race against all other competitors in a set number of races"
                    }/*,
                    {
                        label: "Team",
                        value: "team",
                        description: "Teams compete for a better score/time than opposing teams"
                    }*/
                ]
                var create = false
                if (interaction.data.hasOwnProperty("values")) {
                    for (i = 0; i < options.length; i++) {
                        if (interaction.data.values.includes(options[i].value)) {
                            options[i].default = true
                        }
                    }
                    type = 7
                    create = true
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_type",
                                options: options,
                                placeholder: "Select Ruleset Type",
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
                                label: "Create",
                                style: 3,
                                custom_id: "tourney_rulesets_new",
                                disabled: !create
                            },
                            {
                                type: 2,
                                label: "Cancel",
                                style: 4,
                                custom_id: "tourney_rulesets_browse",
                            }
                        ]
                    }

                )
            } else if (args[1] == "new") {
                var ruleset_type = "1v1"
                for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //track
                    var option = interaction.message.components[0].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            ruleset_type = option.value
                        }
                    }
                }
                flags = 64
                rulesetEmbed
                    .setTitle("New Ruleset")
                    .setDescription("create a ruleset")

                var ruleset = {}
                if (ruleset_type == "qual") {
                    ruleset = {
                        type: "qual",
                        podchoice: "player_choice",
                        races: []
                    }
                } else if (ruleset_type == "1v1") {
                    ruleset = {
                        type: "1v1",
                        name: interaction.member.user.username + "'s Unnamed 1v1 Ruleset",
                        author: interaction.member.user.id,
                        wins: 5,
                        default: ["mu", "ft", "um", "l3"],
                        gents: "disallowed",
                        firstmethod: "poe",
                        firsttrack: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"],
                        ptrackmethod: "disabled",
                        ptracklimit: 1,
                        ppodmethod: "disabled",
                        ppodlimit: 1,
                        pconmethod: "disabled",
                        pconlimit: 1,
                        ttrackmethod: "disabled",
                        ttracklimit: 1,
                        ttrackmlimit: "no_limit",
                        tpodmethod: "disabled",
                        tpodlimit: 1,
                        tpodmlimit: "no_limit",
                        tconmethod: "disabled",
                        tconlimit: 1,
                        tconmlimit: "no_limit",
                        trackmethod: "losers_pick",
                        tracktracks: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"],
                        dupecondition: "disabled",
                        dupelimit: 1,
                        conmethod: "disabled",
                        conlimit: 1,
                        conmax: 1,
                        conoptions: ["sk"],
                        podmethod: "player_pick",
                        podpods: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"],
                        rndlimited: 2,
                        poollimit: 1
                    }
                } if (ruleset_type == "1vall") {
                    ruleset = {
                        type: "qual",
                        podchoice: "player_choice",
                        races: []
                    }
                } //if (ruleset_type == "team") {}
                if (ruleset !== {}) {
                    tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                }

                if (args[1] == "navigate") {
                    args[1] = interaction.data.values[0]
                } else if (![undefined, "initial", "rename", "save"].includes(args[2])) {
                    var data = interaction.data.values
                    if (!["default", "firsttrack", "podpods", "tracktracks", "conoptions"].includes(args[2])) {
                        data = interaction.data.values[0]
                    }
                    tourney_rulesets.child("new").child(interaction.member.user.id).child(args[2]).set(data)
                }
                args[1] = "general"
                var options = [
                    {
                        label: "General Settings",
                        value: "general",
                        emoji: { name: "🔷" },
                        description: "set win limit, default conditions, and gentleman's agreement",
                    },
                    {
                        label: "First Track",
                        value: "firsttrack",
                        emoji: { name: "🏁" },
                        description: "configure how the first track is determined",
                    },
                    {
                        label: "Pod Permaban",
                        value: "permapodban",
                        emoji: { name: "🚫" },
                        description: "set permanent pod ban options",
                    },
                    {
                        label: "Track Permaban",
                        value: "permatrackban",
                        emoji: { name: "🚫" },
                        description: "set permanent track ban options",
                    },
                    {
                        label: "Condition Permaban",
                        value: "permaconban",
                        emoji: { name: "🚫" },
                        description: "set permanent condition ban options",
                    },
                    {
                        label: "Pod Tempban",
                        value: "temppodban",
                        emoji: { name: "❌" },
                        description: "set temporary pod ban options",
                    },
                    {
                        label: "Track Tempban",
                        value: "temptrackban",
                        emoji: { name: "❌" },
                        description: "set temporary track ban options",
                    },
                    {
                        label: "Condition Tempban",
                        value: "tempconban",
                        emoji: { name: "❌" },
                        description: "set temporary condition ban options",
                    },
                    {
                        label: "Track Selection",
                        value: "trackselect",
                        emoji: { name: "🚩" },
                        description: "configure how tracks are selected",
                    },
                    {
                        label: "Repeat Tracks",
                        value: "trackdup",
                        emoji: { name: "🔁" },
                        description: "set repeat track options",
                    },
                    {
                        label: "Conditions",
                        value: "trackcon",
                        emoji: { name: "*️⃣" },
                        description: "configure track condition options",
                    },
                    {
                        label: "Pod Selection",
                        value: "podselect",
                        emoji: { name: "Pod1", id: "525755322355417127" },
                        description: "configure how pods are selected",
                    },
                    {
                        label: "Name and Save",
                        value: "finalize",
                        emoji: { name: "✅" },
                        description: "finalize ruleset and submit changes",
                    }
                ]
                for (i = 0; i < options.length; i++) {
                    if (args[1] == options[i].value) {
                        options[i].default = true
                    }
                }
                if (!["browse", "type"].includes(args[1])) {
                    rulesetEmbed
                        .setTitle(tourney_rulesets_data.new[interaction.member.user.id].name)
                        .setFooter(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())

                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_navigate",
                                options: options,
                                placeholder: "Settings",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }

                if (![null, undefined].includes(tourney_rulesets_data)) {
                    if (![null, undefined].includes(tourney_rulesets_data.new)) {
                        rulesetEmbed.addFields(showRuleset(tourney_rulesets_data.new[interaction.member.user.id]))
                    }
                }

                if (args[1] == "general") {
                    var win_options = []
                    for (i = 2; i < 14; i++) {
                        win_options.push(
                            {
                                label: "First to " + i + " Wins",
                                value: i,
                                description: "Best of " + (i * 2 - 1)
                            }
                        )
                    }
                    for (i = 0; i < win_options.length; i++) {
                        if (win_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].wins) {
                            win_options[i].default = true
                        }
                    }
                    var con_options = [
                        {
                            label: "Full Track",
                            value: "ft"
                        },
                        {
                            label: "Skips",
                            value: "sk"
                        },
                        {
                            label: "Max Upgrades",
                            value: "mu"
                        },
                        {
                            label: "No Upgrades",
                            value: "nu"
                        },
                        {
                            label: "Unmirrored",
                            value: "um"
                        },
                        {
                            label: "Mirrored",
                            value: "mi"
                        },
                        {
                            label: "1 Lap",
                            value: "l1"
                        },
                        {
                            label: "2 Laps",
                            value: "l2"
                        },
                        {
                            label: "3 Laps",
                            value: "l3"
                        },
                        {
                            label: "4 Laps",
                            value: "l4"
                        },
                        {
                            label: "5 Laps",
                            value: "l5"
                        }
                    ]
                    for (i = 0; i < con_options.length; i++) {
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id].default).includes(con_options[i].value)) {
                            con_options[i].default = true
                        }
                    }
                    var gent_options = [
                        {
                            label: "Gentleman's Agreement: Allowed",
                            value: "allowed"
                        },
                        {
                            label: "Gentleman's Agreement: Disallowed",
                            value: "disallowed"
                        }
                    ]
                    for (i = 0; i < gent_options.length; i++) {
                        if (gent_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].gents) {
                            gent_options[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_general_wins",
                                    options: win_options,
                                    placeholder: "Set Win Limit",
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
                                    custom_id: "tourney_rulesets_general_default",
                                    options: con_options,
                                    placeholder: "Set Default Conditions",
                                    min_values: 4,
                                    max_values: 4
                                }
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_general_gents",
                                    options: gent_options,
                                    placeholder: "Gentleman's Agreement",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                } else if (args[1] == "firsttrack") {
                    var first_options = [
                        {
                            label: "Process of Elimination",
                            value: "poe",
                            description: "players alternate bans until one track is left"
                        },
                        {
                            label: "Chance Cube",
                            value: "chance_cube",
                            description: "winner of chance cube gets to pick the first track"
                        },
                        {
                            label: "Random",
                            value: "random",
                            description: "first track is randomly selected"
                        }
                    ]
                    for (i = 0; i < first_options.length; i++) {
                        if (first_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].firstmethod) {
                            first_options[i].default = true
                        }
                    }
                    var first_track = []
                    for (var i = 0; i < 25; i++) {
                        var track_option = {
                            label: tracks[i].name,
                            value: i,
                            description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
                            emoji: {
                                name: planets[tracks[i].planet].emoji.split(":")[1],
                                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                            }
                        }
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id].firsttrack).includes(String(track_option.value))) {
                            track_option.default = true
                        }
                        first_track.push(track_option)
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_firsttrack_firstmethod",
                                    options: first_options,
                                    placeholder: "Selection Method",
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
                                    custom_id: "tourney_rulesets_firsttrack_firsttrack",
                                    options: first_track,
                                    placeholder: "Filter First Track Options",
                                    min_values: 1,
                                    max_values: 25
                                }
                            ]
                        }
                    )
                } else if (["permatrackban", "permapodban", "permaconban"].includes(args[1])) {
                    var bans = [
                        {
                            name: "Track",
                            command: "permatrackban",
                            method: "ptrackmethod",
                            limit: "ptracklimit"
                        },
                        {
                            name: "Pod",
                            command: "permapodban",
                            method: "ppodmethod",
                            limit: "ppodlimit"
                        },
                        {
                            name: "Condition",
                            command: "permaconban",
                            method: "pconmethod",
                            limit: "pconlimit"
                        }
                    ]
                    var ban = null
                    for (b = 0; b < bans.length; b++) {
                        if (bans[b].command == args[1]) {
                            ban = b
                        }
                    }
                    var limits = []
                    for (i = 1; i < 6; i++) {
                        var limit = {
                            label: i + " Per Player Per Match",
                            value: i
                        }
                        if (tourney_rulesets_data.new[interaction.member.user.id][bans[ban].method] == "random") {
                            limit.label = i + " Per Match"
                        }
                        if (limit.value == tourney_rulesets_data.new[interaction.member.user.id][bans[ban].limit]) {
                            limit.default = true
                        }
                        limits.push(limit)
                    }
                    var methods = [
                        {
                            label: "Disabled",
                            value: "disabled",
                            description: "No permanent " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Player Pick",
                            value: "player_pick",
                            description: "Each player gets to pick a permanent " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Earned via Win",
                            value: "win",
                            description: "Players get access to this ban if they win the first track"
                        },
                        {
                            label: "Earned via Loss",
                            value: "loss",
                            description: "Players get access to this ban if they lose the first track"
                        },
                        {
                            label: "Either/Or",
                            value: "either_or",
                            description: "Players must choose between this permaban or another permaban with the same setting"
                        },
                        {
                            label: "Random",
                            value: "random",
                            description: bans[ban].name + "s are permanently banned randomly"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id][bans[ban].method]) {
                            methods[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_" + bans[ban].command + "_" + bans[ban].method,
                                    options: methods,
                                    placeholder: "Permanent " + bans[ban].name + " Ban Method",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        },
                    )
                    if (tourney_rulesets_data.new[interaction.member.user.id][bans[ban].method] !== "disabled") {
                        components.push({
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_" + bans[ban].command + "_" + bans[ban].limit,
                                    options: limits,
                                    placeholder: "Permanent " + bans[ban].name + " Bans Per Match",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        })
                    }


                } else if (["temptrackban", "temppodban", "tempconban"].includes(args[1])) {
                    var bans = [
                        {
                            name: "Track",
                            command: "temptrackban",
                            method: "ttrackmethod",
                            limit: "ttracklimit",
                            mlimit: "ttrackmlimit"
                        },
                        {
                            name: "Pod",
                            command: "temppodban",
                            method: "tpodmethod",
                            limit: "tpodlimit",
                            mlimit: "tpodmlimit"
                        },
                        {
                            name: "Condition",
                            command: "tempconban",
                            method: "tconmethod",
                            limit: "tconlimit",
                            mlimit: "tconmlimit"
                        }
                    ]
                    var ban = null
                    for (b = 0; b < bans.length; b++) {
                        if (bans[b].command == args[1]) {
                            ban = b
                        }
                    }
                    var limits = []
                    for (i = 1; i < 6; i++) {
                        var limit = {
                            label: i + " Max Per Race",
                            value: i
                        }
                        if (limit.value == tourney_rulesets_data.new[interaction.member.user.id][bans[ban].limit]) {
                            limit.default = true
                        }
                        limits.push(limit)
                    }
                    var methods = [
                        {
                            label: "Disabled",
                            value: "disabled",
                            description: "No temporary " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Player Pick",
                            value: "player_pick",
                            description: "Each player gets to make a " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Winner's Pick",
                            value: "winners_pick",
                            description: "Winner of last race gets to select temporary " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Loser's Pick",
                            value: "losers_pick",
                            description: "Loser of last race gets to select temporary " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Winner's Either/Or",
                            value: "winners_either",
                            description: "Winner of last race must choose between this ban or another ban"
                        },
                        {
                            label: "Loser's Either/Or",
                            value: "losers_either",
                            description: "Loser of last race must choose between this ban or another ban"
                        },
                        {
                            label: "Chance Cube",
                            value: "chance_cube",
                            description: "Winner of Chance Cube gets to select temporary " + bans[ban].name.toLowerCase() + " ban"
                        },
                        {
                            label: "Random",
                            value: "random",
                            description: bans[ban].name + "s are temporarily banned randomly"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id][bans[ban].method]) {
                            methods[i].default = true
                        }
                    }
                    var match_limits = [
                        {
                            label: "No Match Limit",
                            value: "no_limit",
                            description: "Players always have the max number of bans to use for each race"
                        },
                        {
                            label: "1 Per Win",
                            value: "wins",
                            description: "Players earn one use of this tempban for each race win"
                        },
                        {
                            label: "1 Per Loss",
                            value: "losses",
                            description: "Players earn one use of this tempban for each race loss"
                        }
                    ]
                    for (i = 1; i < 6; i++) {
                        var limit = {
                            label: i + " Per Player Per Match",
                            value: i
                        }
                        match_limits.push(limit)
                    }
                    for (i = 0; i < match_limits.length; i++) {
                        if (match_limits[i].value == tourney_rulesets_data.new[interaction.member.user.id][bans[ban].mlimit]) {
                            match_limits[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_" + bans[ban].command + "_" + bans[ban].method,
                                    options: methods,
                                    placeholder: "Temporary " + bans[ban].name + " Ban Method",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                    if (tourney_rulesets_data.new[interaction.member.user.id][bans[ban].method] !== "disabled") {
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "tourney_rulesets_" + bans[ban].command + "_" + bans[ban].limit,
                                        options: limits,
                                        placeholder: "Max Temporary " + bans[ban].name + " Bans Per Race",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]
                            }
                        )
                        if (tourney_rulesets_data.new[interaction.member.user.id][bans[ban].method] !== "random") {
                            components.push(
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 3,
                                            custom_id: "tourney_rulesets_" + bans[ban].command + "_" + bans[ban].mlimit,
                                            options: match_limits,
                                            placeholder: "Temporary " + bans[ban].name + " Bans Per Player Per Match",
                                            min_values: 1,
                                            max_values: 1
                                        }
                                    ]
                                }
                            )
                        }
                    }
                } else if (args[1] == "trackselect") {
                    var methods = [
                        {
                            label: "Loser's Pick",
                            value: "losers_pick",
                            description: "Loser gets to pick the track for the next race"
                        },
                        {
                            label: "Winner's Pick",
                            value: "winners_pick",
                            description: "Winner gets to pick the track for the next race"
                        },
                        {
                            label: "Chance Cube",
                            value: "random_pick",
                            description: "Winner of Chance Cube gets to pick the track for the next race"
                        },
                        {
                            label: "Random",
                            value: "random",
                            description: "track for the next race is randomly selected"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id].trackmethod) {
                            methods[i].default = true
                        }
                    }
                    var track_options = []
                    for (var i = 0; i < 25; i++) {
                        var track_option = {
                            label: tracks[i].name,
                            value: i,
                            description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
                            emoji: {
                                name: planets[tracks[i].planet].emoji.split(":")[1],
                                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                            }
                        }
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id].tracktracks).includes(String(track_option.value))) {
                            track_option.default = true
                        }
                        track_options.push(track_option)
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_trackselect_trackmethod",
                                    options: methods,
                                    placeholder: "Track Selection Method",
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
                                    custom_id: "tourney_rulesets_trackselect_tracktracks",
                                    options: track_options,
                                    placeholder: "Track Selection Options",
                                    min_values: 1,
                                    max_values: 25
                                }
                            ]
                        }
                    )
                } else if (args[1] == "trackdup") {
                    var limits = []
                    for (i = 1; i < 6; i++) {
                        var limit = {
                            label: i + " Per Player Per Match",
                            value: i
                        }
                        if (limit.value == tourney_rulesets_data.new[interaction.member.user.id].dupelimit) {
                            limit.default = true
                        }
                        limits.push(limit)
                    }
                    var methods = [
                        {
                            label: "Disabled",
                            value: "disabled",
                            description: "repeat track picks are not allowed"
                        },
                        {
                            label: "Salty Runback",
                            value: "salty_runback",
                            description: "players can runback a track only if they haven’t won"
                        },
                        {
                            label: "Saltier Runback",
                            value: "saltier_runback",
                            description: "players can runback a Salty Runback"
                        },
                        {
                            label: "Saltiest Runback",
                            value: "saltiest_runback",
                            description: "players can runback a Saltier runback"
                        },
                        {
                            label: "Any Condition",
                            value: "any",
                            description: "repeat track picks are allowed under any condition"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id].dupecondition) {
                            methods[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_trackdup_dupecondition",
                                    options: methods,
                                    placeholder: "Repeat Track Condition",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                    if (tourney_rulesets_data.new[interaction.member.user.id].dupecondition !== "disabled") {
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "tourney_rulesets_trackdup_dupelimit",
                                        options: limits,
                                        placeholder: "Repeat Track Pick Limit",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]
                            }
                        )
                    }
                } else if (args[1] == "trackcon") {
                    var limits = []
                    limits.push(
                        {
                            label: "1 Per Win",
                            value: "wins",
                            description: "Players earn forces for each race win"
                        },
                        {
                            label: "1 Per Loss",
                            value: "lossess",
                            description: "Players earn forces for each race loss"
                        }
                    )
                    for (i = 1; i < 13; i++) {
                        limits.push({
                            label: i + " Per Player Per Match",
                            value: i
                        })
                    }
                    for (i = 0; i < limits.length; i++) {
                        if (tourney_rulesets_data.new[interaction.member.user.id].conlimit == limits[i].value) {
                            limits[i].default = true
                        }
                    }
                    var conmax = []
                    for (i = 1; i < 6; i++) {
                        conmax.push({
                            label: i + " Max Per Race",
                            value: i
                        })
                    }
                    for (i = 0; i < conmax.length; i++) {
                        if (tourney_rulesets_data.new[interaction.member.user.id].conmax == conmax[i].value) {
                            conmax[i].default = true
                        }
                    }
                    var methods = [
                        {
                            label: "Disabled",
                            value: "disabled",
                            description: "No special conditions are allowed"
                        },
                        {
                            label: "Winner's Pick",
                            value: "winners_pick",
                            description: "Winner gets to pick conditions for the next track"
                        },
                        {
                            label: "Loser's Pick",
                            value: "losers_pick",
                            description: "Loser gets to pick conditions for the next track"
                        },
                        {
                            label: "Chance Cube",
                            value: "chance_cube",
                            description: "Winner of Chance Cube gets to pick conditions for the next track"
                        },
                        {
                            label: "Random",
                            value: "random",
                            description: "conditions for the next track are randomly selected"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (tourney_rulesets_data.new[interaction.member.user.id].conmethod == methods[i].value) {
                            methods[i].default = true
                        }
                    }
                    var conoptions = [
                        {
                            label: "Full Track",
                            value: "ft"
                        },
                        {
                            label: "Skips",
                            value: "sk"
                        },
                        {
                            label: "Max Upgrades",
                            value: "mu"
                        },
                        {
                            label: "No Upgrades",
                            value: "nu"
                        },
                        {
                            label: "Pod Ban",
                            value: "pb"
                        },
                        {
                            label: "Pod Choice",
                            value: "pc"
                        },
                        {
                            label: "Unmirrored",
                            value: "um"
                        },
                        {
                            label: "Mirrored",
                            value: "mi"
                        },
                        {
                            label: "1 Lap",
                            value: "l1"
                        },
                        {
                            label: "2 Lap",
                            value: "l2"
                        },
                        {
                            label: "3 Lap",
                            value: "l3"
                        },
                        {
                            label: "4 Lap",
                            value: "l4"
                        },
                        {
                            label: "5 Lap",
                            value: "l5"
                        }
                    ]
                    for (i = 0; i < conoptions.length; i++) {
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id].conoptions).includes(conoptions[i].value)) {
                            conoptions[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_trackcon_conmethod",
                                    options: methods,
                                    placeholder: "Condition Method",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                    if (tourney_rulesets_data.new[interaction.member.user.id].conmethod !== "disabled") {

                        components.push({
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_trackcon_conmax",
                                    options: conmax,
                                    placeholder: "Max Conditions (Forces) Per Race",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        })
                        if (tourney_rulesets_data.new[interaction.member.user.id].conmethod !== "random") {
                            components.push(
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 3,
                                            custom_id: "tourney_rulesets_trackcon_conlimit",
                                            options: limits,
                                            placeholder: "Conditions (Forces) Per Match",
                                            min_values: 1,
                                            max_values: 1
                                        }
                                    ]
                                }
                            )
                        }
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "tourney_rulesets_trackcon_conoptions",
                                        options: conoptions,
                                        placeholder: "Condition Options",
                                        min_values: 1,
                                        max_values: 13
                                    }
                                ]
                            })
                    }
                } else if (args[1] == "podselect") {
                    var methods = [
                        {
                            label: "Player's Pick",
                            value: "player_pick",
                            description: "Players get to pick their own pods for the next race"
                        },
                        {
                            label: "Loser's Pick",
                            value: "losers_pick",
                            description: "Loser gets to pick the pod for both players for the next race"
                        },
                        {
                            label: "Winner's Pick",
                            value: "winners_pick",
                            description: "Winner gets to pick the pod for both players for the next race"
                        },
                        {
                            label: "Chance Cube",
                            value: "chance_cube",
                            description: "Winner of Chance Cube gets to pick the pod for both players for the next race"
                        },
                        {
                            label: "Random Mirrored",
                            value: "random_mirrored",
                            description: "players are assigned the same random pod for the next race"
                        },
                        {
                            label: "Limited Choice",
                            value: "limited_choice",
                            description: "players choose their pod from a limited predetermined selection of pods"
                        },
                        {
                            label: "Random Limited Choice",
                            value: "random_limited_choice",
                            description: "players choose their pod from a limited random selection of pods"
                        },
                        {
                            label: "Pod Pool",
                            value: "pod_pool",
                            description: "players can only use each pod a limited number of times"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id].podmethod) {
                            methods[i].default = true
                        }
                    }
                    var pod_options = []
                    for (var i = 0; i < 23; i++) {
                        var racer_option = {
                            label: racers[i].name,
                            value: i,
                            description: racers[i].pod.substring(0, 50),
                            emoji: {
                                name: racers[i].flag.split(":")[1],
                                id: racers[i].flag.split(":")[2].replace(">", "")
                            }
                        }
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id].podpods).includes(String(racer_option.value))) {
                            racer_option.default = true
                        }
                        pod_options.push(racer_option)
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_podselect_podmethod",
                                    options: methods,
                                    placeholder: "Pod Selection Method",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                    if (tourney_rulesets_data.new[interaction.member.user.id].podmethod == "random_limited_choice") {
                        var limits = []
                        for (i = 2; i < 11; i++) {
                            var limit = {
                                label: i + " Choices",
                                value: i
                            }
                            if (limit.value == tourney_rulesets_data.new[interaction.member.user.id].rndlimited) {
                                limit.default = true
                            }
                            limits.push(limit)
                        }
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "tourney_rulesets_podselect_rndlimited",
                                        options: limits,
                                        placeholder: "Random Limited Choice Count",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]

                            }
                        )
                    }
                    if (tourney_rulesets_data.new[interaction.member.user.id].podmethod == "pod_pool") {
                        var limits = []
                        for (i = 1; i < 6; i++) {
                            var limit = {
                                label: i + " Use(s) Per Pod",
                                value: i
                            }
                            if (limit.value == tourney_rulesets_data.new[interaction.member.user.id].poollimit) {
                                limit.default = true
                            }
                            limits.push(limit)
                        }
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "tourney_rulesets_podselect_poollimit",
                                        options: limits,
                                        placeholder: "Pod Pool Use Limit",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]

                            }
                        )
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_podselect_podpods",
                                    options: pod_options,
                                    placeholder: "Pod Options",
                                    min_values: 1,
                                    max_values: 23
                                }
                            ]

                        }
                    )
                    //add random limited choice limit
                    //add pod pool limit
                } else if (args[1] == "finalize") {
                    var rename = true
                    if (args[2] == "rename") {
                        type = 7
                        rename = false
                        client.api.webhooks(client.user.id, interaction.token).post({
                            data: {
                                content: "Send the new name for your ruleset in this channel",
                                flags: 64
                            }
                        })

                        async function sendResponse() {
                            response = await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({
                                data: {
                                    embeds: [rulesetEmbed],
                                    components: components
                                }
                            })
                            return response
                        }
                        //const filter = m => m.author.id == interaction.member.user.id
                        const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m.author.id == interaction.member.user.id, { max: 1, time: 300000 }); //messages
                        collector.on('collect', message => {
                            tourney_rulesets.child("new").child(interaction.member.user.id).child("name").set(message.content)
                            rulesetEmbed.setTitle(message.content)
                            components[1].components[0].disabled = false
                            message.delete().then(sendResponse())
                        })
                        //client.api.interactions(interaction.id, interaction.token).callback.post({ data: { type: 6, data: {} } })
                        //return
                    } else if (args[2] == "save") {
                        type = 7
                        rulesetEmbed
                            .setTitle("Ruleset Saved")
                            .setDescription("Successfully saved **" + tourney_rulesets_data.new[interaction.member.user.id].name + "** to rulesets.")
                        rulesetEmbed.fields = []
                        rulesetEmbed.setFooter("")
                        components = []
                        var ruleset = tourney_rulesets_data.new[interaction.member.user.id]
                        tourney_rulesets.child("saved").push(ruleset)
                        tourney_rulesets.child("new").child(interaction.member.user.id).remove()
                    }
                    if (args[2] !== "save") {
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Rename",
                                        style: 1,
                                        custom_id: "tourney_rulesets_finalize_rename",
                                        disabled: !rename
                                    },
                                    {
                                        type: 2,
                                        label: "Save",
                                        style: 3,
                                        custom_id: "tourney_rulesets_finalize_save",
                                    }
                                ]
                            }
                        )
                    }


                } else if (args[1] == "qual") {
                    //pod select
                    //add race
                    //track
                    //conditions
                    //time limit
                    //penalty time
                } else if (args[1] == "1vall") {
                    //pod select
                    //add race
                    //track
                    //conditions
                }
            }




            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: type,
                    data: {
                        flags: flags,
                        embeds: [rulesetEmbed],
                        components: components
                    }
                }
            })
        }
    }
}
