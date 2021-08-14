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
            if (args[1] == "browse") {
                rulesetEmbed.setTitle("Rulesets")
                components.push({
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "New",
                            style: 3,
                            custom_id: "tourney_rulesets_type",
                        },
                        {
                            type: 2,
                            label: "Edit",
                            style: 2,
                            custom_id: "tourney_rulesets_edit",
                        },
                        {
                            type: 2,
                            label: "Clone",
                            style: 2,
                            custom_id: "tourney_rulesets_clone",
                        },
                        {
                            type: 2,
                            label: "Delete",
                            style: 4,
                            custom_id: "tourney_rulesets_delete",
                        }
                    ]
                })
            } else if (args[1] == "type") {
                flags = 64
                type = 4
                //select type
                rulesetEmbed
                    .setTitle("New Ruleset")
                    .setDescription("create a ruleset")
                flags = 64
                
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
                if(interaction.data.hasOwnProperty("values")){
                    for(i = 0; i < options.length; i++){
                        if(interaction.data.values.includes(options[i].value)){
                            options[i].default = true
                        }
                    }
                    type = 7
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
                        wins: 5,
                        default: ["mu", "ft", "um", "3l"],
                        gents: "disallowed",
                        firstmethod: "poe",
                        firsttrack: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
                        ptrackmethod: "disabled",
                        ptracklimit: 0,
                        ppodmethod: "disabled",
                        ppodlimit: 0,
                        ttrackmethod: "disabled",
                        ttracklimit: 0,
                        tpodmethod: "disasbled",
                        tpodlimit: 0,
                        trackmethod: "losers_pick",
                        tracktracks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
                        dupecondition: "disabled",
                        dupelimit: 0,
                        conmethod: "disabled",
                        conlimit: 0,
                        conoptions: [],
                        podmethod: "players_pick",
                        podpods: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
                    }
                } if (ruleset_type == "1vall") {
                    ruleset = {
                        type: "qual",
                        podchoice: "player_choice",
                        races: []
                    }
                } //if (ruleset_type == "team") {}
                if(ruleset !== {}){
                    tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                }
                args[1] = "general"
            }

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
            if(args[1] == "navigate"){
                args[1] = interaction.data.values[0]
            } else if(![undefined, "initial"].includes(args[2])){
                var data = interaction.data.values
                if(interaction.data.values.length == 1){
                    data = interaction.data.values[0]
                }
                tourney_rulesets.child("new").child(interaction.member.user.id).child(args[2]).set(data)
            }
            var options = [
                {
                    label: "General Settings",
                    value: "general",
                    emoji: {name: "🔷"},
                    description: "set win limit, default conditions, and gentleman's agreement",
                },
                {
                    label: "First Track",
                    value: "firsttrack",
                    emoji: {name: "🏁"},
                    description: "configure how the first track is determined",
                },
                {
                    label: "Track Permaban",
                    value: "permatrackban",
                    emoji: {name: "🚫"},
                    description: "set permanent track ban options",
                },
                {
                    label: "Pod Permaban",
                    value: "permapodban",
                    emoji: {name: "🚫"},
                    description: "set permanent pod ban options",
                },
                {
                    label: "Track Tempban",
                    value: "temptrackban",
                    emoji: {name: "❌"},
                    description: "set temporary track ban options",
                },
                {
                    label: "Pod Tempban",
                    value: "temppodban",
                    emoji: {name: "❌"},
                    description: "set temporary pod ban options",
                },
                {
                    label: "Track Selection",
                    value: "trackselect",
                    emoji: {name: "🚩"},
                    description: "configure how tracks are selected",
                },
                {
                    label: "Duplicate Tracks",
                    value: "trackdup",
                    emoji: {name: "🔁"},
                    description: "set duplicate track options",
                },
                {
                    label: "Track Conditions",
                    value: "trackcon",
                    emoji: {name: "*️⃣"},
                    description: "configure track condition options",
                },
                {
                    label: "Pod Selection",
                    value: "podselect",
                    emoji: {name: "Pod1", id: "525755322355417127"},
                    description: "configure how pods are selected",
                }
            ]
            for(i = 0; i < options.length; i++){
                if(args[1] == options[i].value){
                    options[i].default = true
                }
            }
            if (!["browse", "type"].includes(args[1])) {
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
                for(i = 0; i < win_options.length; i++){
                    if(win_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].wins){
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
                        value: "1l"
                    },
                    {
                        label: "2 Lap",
                        value: "2l"
                    },
                    {
                        label: "3 Lap",
                        value: "3l"
                    },
                    {
                        label: "4 Lap",
                        value: "4l"
                    },
                    {
                        label: "5 Lap",
                        value: "5l"
                    }
                ]
                for(i = 0; i < con_options.length; i++){
                    if(Object.values(tourney_rulesets_data.new[interaction.member.user.id].default).includes(con_options[i].value)){
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
                for(i = 0; i < gent_options.length; i++){
                    if(gent_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].gents){
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
                var planetsncircuits = []
                for (i = 0; i < planets.length; i++) {
                    planetsncircuits.push({
                        label: planets[i].name,
                        value: i,
                        emoji: {
                            name: planets[i].emoji.split(":")[1],
                            id: planets[i].emoji.split(":")[2].replace(">", "")
                        },
                        description: planets[i].host
                    })
                }
                for (i = 0; i < circuits.length; i++) {
                    planetsncircuits.push({
                        label: circuits[i].name + " Circuit",
                        value: i,
                        description: circuits[i].races + " Races"
                    })
                }
                var first_options = [
                    /*{
                        label: "Predetermined",
                        value: "predetermined",
                        description: "first track is already determined"
                    },*/
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
                for(i = 0; i < first_options.length; i++){
                    if(first_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].firstmethod){
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
                    if(Object.values(tourney_rulesets_data.new[interaction.member.user.id].firsttrack).includes(track_option.value)){
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
                                options: track_selections,
                                placeholder: "Filter First Track Options",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "permatrackban") {
                var limits = []
                for (i = 0; i < 6; i++) {
                    limits.push({
                        label: i,
                        value: i
                    })
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_permatrackban_ptrackmethod",
                                options: [
                                    {
                                        label: "Disabled",
                                        value: "disabled",
                                        description: "No permanent track ban"
                                    },
                                    {
                                        label: "Player Pick",
                                        value: "player_pick",
                                        description: "Each player gets to pick their permanent track ban"
                                    },
                                    {
                                        label: "Random",
                                        value: "random",
                                        description: "Tracks are permanently banned randomly"
                                    }
                                ],
                                placeholder: "Permanent Track Ban Method",
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
                                custom_id: "tourney_rulesets_permatrackban_ptracklimit",
                                options: limits,
                                placeholder: "Permanent Track Bans Per Match",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "permapodban") {
                var limits = []
                for (i = 0; i < 6; i++) {
                    limits.push({
                        label: i,
                        value: i
                    })
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_permapodban_ppodmethod",
                                options: [
                                    {
                                        label: "Disabled",
                                        value: "disabled",
                                        description: "No permanent pod ban"
                                    },
                                    {
                                        label: "Player Pick",
                                        value: "player_pick",
                                        description: "Each player gets to pick their permanent pod ban"
                                    },
                                    {
                                        label: "Random",
                                        value: "random",
                                        description: "Pods are permanently banned randomly"
                                    }
                                ],
                                placeholder: "Permanent Pod Ban Method",
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
                                custom_id: "tourney_rulesets_permapodban_ppodlimit",
                                options: limits,
                                placeholder: "Permanent Pod Bans Per Match",
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "temptrackban") {
                var limits = []
                for (i = 0; i < 6; i++) {
                    limits.push({
                        label: i,
                        value: i
                    })
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_temptrackban_ttrackmethod",
                                options: [
                                    {
                                        label: "Disabled",
                                        value: "disabled",
                                        description: "No temporary track ban"
                                    },
                                    {
                                        label: "Winner's Pick",
                                        value: "winners_pick",
                                        description: "Winner gets to select temporary track ban"
                                    },
                                    {
                                        label: "Loser's Pick",
                                        value: "losers_pick",
                                        description: "Loser gets to select temporary track ban"
                                    },
                                    {
                                        label: "Chance Cube",
                                        value: "chance_cube",
                                        description: "Winner of Chance Cube gets to select temporary track ban"
                                    },
                                    {
                                        label: "Random",
                                        value: "random",
                                        description: "Tracks are temporarily banned randomly"
                                    }
                                ],
                                placeholder: "Temporary Track Ban Method",
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
                                custom_id: "tourney_rulesets_temptrackban_ttracklimit",
                                options: limits,
                                placeholder: "Temporary Track Bans Per Race",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "temppodban") {
                var limits = []
                for (i = 0; i < 6; i++) {
                    limits.push({
                        label: i,
                        value: i
                    })
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_temppodban_tpodmethod",
                                options: [
                                    {
                                        label: "Disabled",
                                        value: "disabled",
                                        description: "No temporary pod ban"
                                    },
                                    {
                                        label: "Winner's Pick",
                                        value: "winners_pick",
                                        description: "Winner gets to pick temporary pod ban"
                                    },
                                    {
                                        label: "Loser's Pick",
                                        value: "losers_pick",
                                        description: "Loser gets to pick temporary pod ban"
                                    },
                                    {
                                        label: "Chance Cube",
                                        value: "chance_cube",
                                        description: "Winner of Chance Cube gets to pick temporary pod ban"
                                    },
                                    {
                                        label: "Random",
                                        value: "random",
                                        description: "Pods are temporarily banned randomly"
                                    }
                                ],
                                placeholder: "Temporary Pod Ban Method",
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
                                custom_id: "tourney_rulesets_temppodban_tpodlimit",
                                options: limits,
                                placeholder: "Temporary Pod Bans Per Race",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "trackselect") {
                var planetsncircuits = []
                for (i = 0; i < planets.length; i++) {
                    planetsncircuits.push({
                        label: planets[i].name,
                        value: i,
                        emoji: {
                            name: planets[i].emoji.split(":")[1],
                            id: planets[i].emoji.split(":")[2].replace(">", "")
                        },
                        description: planets[i].host
                    })
                }
                for (i = 0; i < circuits.length; i++) {
                    planetsncircuits.push({
                        label: circuits[i].name + " Circuit",
                        value: i,
                        description: circuits[i].races + " Races"
                    })
                }

                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_trackselect_trackmethod",
                                options: [
                                    /*{
                                        label: "Predetermined",
                                        value: "predetermined",
                                        description: "track selection is already determined"
                                    },*/
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
                                ],
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
                                custom_id: "tourney_rulesets_trackselect_tracktracks",
                                options: track_selections,
                                placeholder: "Set Track Selection Options",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "trackdup") {
                var limits = []
                for (i = 0; i < 6; i++) {
                    limits.push({
                        label: i,
                        value: i
                    })
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_trackdup_dupecondition",
                                options: [
                                    {
                                        label: "Disabled",
                                        value: "disabled",
                                        description: "duplicate track picks are not allowed"
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
                                        description: "duplicate track picks are allowed under any condition"
                                    }
                                ],
                                placeholder: "Duplicate Track Condition",
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
                                custom_id: "tourney_rulesets_trackdup_dupelimit",
                                options: limits,
                                placeholder: "Duplicate Track Pick Limit",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[1] == "trackcon") {
                var limits = []
                limits.push(
                    {
                        label: "Wins",
                        value: "wins",
                        description: "Players earn forces for each race win"
                    },
                    {
                        label: "Losses",
                        value: "lossess",
                        description: "Players earn forces for each race loss"
                    }
                )
                for (i = 0; i < 13; i++) {
                    limits.push({
                        label: i,
                        value: i
                    })
                }
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_trackcon_conmethod",
                                options: [
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
                                ],
                                placeholder: "Condition Method",
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
                                custom_id: "tourney_rulesets_trackcon_conlimit",
                                options: limits,
                                placeholder: "Conditions (Forces) Per Match",
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
                                custom_id: "tourney_rulesets_trackcon_conoptions",
                                options: [
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
                                        value: "1l"
                                    },
                                    {
                                        label: "2 Lap",
                                        value: "2l"
                                    },
                                    {
                                        label: "3 Lap",
                                        value: "3l"
                                    },
                                    {
                                        label: "4 Lap",
                                        value: "4l"
                                    },
                                    {
                                        label: "5 Lap",
                                        value: "5l"
                                    }
                                ],
                                placeholder: "Condition Options",
                                min_values: 1,
                                max_values: 13
                            }
                        ]
                    }
                )
            } else if (args[1] == "podselect") {
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_podselect_podmethod",
                                options: [
                                    /*{
                                        label: "Predetermined",
                                        value: "predetermined",
                                        description: "Pod selection is already determined"
                                    },*/
                                    {
                                        label: "Players's Pick",
                                        value: "players_pick",
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
                                ],
                                placeholder: "Pod Selection Method",
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
                                custom_id: "tourney_rulesets_podselect_podpods",
                                options: racer_selections,
                                placeholder: "Pods",
                                min_values: 1,
                                max_values: 23
                            }
                        ]

                    }
                )
                //add random limited choice limit
                //add pod pool limit
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

            //create embed
            rulesetEmbed


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
