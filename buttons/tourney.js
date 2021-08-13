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
                //new, 
                //edit, clone, delete
            } else if (args[1] == "type") {
                //select type
                rulesetEmbed
                .setTitle("New Ruleset")
                .setDescription("create a ruleset")
                flags = 64
                components.push({
                    type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_new",
                                options: [
                                    {
                                        label: "Qualifier",
                                        value: "qual",
                                        description: "Players have a set time limit to get their best time with multiple attempts"
                                    },
                                    {
                                        label: "1v1",
                                        value: "1v1",
                                        description: "Players race against an opponent until a set score/race limit"
                                    },
                                    {
                                        label: "1vAll",
                                        value: "1vall",
                                        description: "Players race against all other competitors in a set number of races"
                                    },
                                    {
                                        label: "Team",
                                        value: "team",
                                        description: "Teams compete for a better score/time than opposing teams"
                                    }
                                ],
                                placeholder: "Select Ruleset Type",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                })
            } else if (args[1] == "new") {
                rulesetEmbed
                .setTitle("New Ruleset")
                .setDescription("create a ruleset")

                if(interaction.data.values[0] == "qual"){

                } else if(interaction.data.values[0] == "1v1"){

                }if(interaction.data.values[0] == "1vall"){

                }if(interaction.data.values[0] == "team"){

                }
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

            if (["edit", "new"].includes(args[1])) {
                components.push({
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: "tourney_rulesets_navigate",
                            options: [
                                {
                                    label: "General Settings",
                                    value: "general",
                                    description: "set win limit, default conditions, and gentleman's agreement",
                                },
                                {
                                    label: "First Track",
                                    value: "firsttrack",
                                    description: "configure how the first track is determined",
                                },
                                {
                                    label: "Track Permaban",
                                    value: "permatrackban",
                                    description: "set permanent track ban options",
                                },
                                {
                                    label: "Pod Permaban",
                                    value: "permapodban",
                                    description: "set permanent pod ban options",
                                },
                                {
                                    label: "Track Tempban",
                                    value: "temptrackban",
                                    description: "set temporary track ban options",
                                },
                                {
                                    label: "Pod Tempban",
                                    value: "temppodban",
                                    description: "set temporary pod ban options",
                                },
                                {
                                    label: "Track Selection",
                                    value: "trackselect",
                                    description: "configure how tracks are selected",
                                },
                                {
                                    label: "Duplicate Tracks",
                                    value: "trackdup",
                                    description: "set duplicate track options",
                                },
                                {
                                    label: "Track Conditions",
                                    value: "trackcon",
                                    description: "configure track condition options",
                                },
                                {
                                    label: "Pod Selection",
                                    value: "podselect",
                                    description: "configure how pods are selected",
                                }
                            ],
                            placeholder: "Settings",
                            min_values: 1,
                            max_values: 1
                        }
                    ]
                })
            }
            if (args[2] == "general") {
                var win_options = []
                for (i = 1; i < 14; i++) {
                    win_options.push(
                        {
                            label: i,
                            value: i,
                            description: "Best of " + (i * 2 - 1)
                        }
                    )
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
                                custom_id: "tourney_rulesets_general_cond",
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
                                options: [
                                    {
                                        label: "Allowed",
                                        value: "true"
                                    },
                                    {
                                        label: "Disallowed",
                                        value: "false"
                                    }
                                ],
                                placeholder: "Gentleman's Agreement",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "firsttrack") {
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
                                custom_id: "tourney_rulesets_firsttrack_method",
                                options: [
                                    {
                                        label: "Predetermined",
                                        value: "predetermined",
                                        description: "first track is already determined"
                                    },
                                    {
                                        label: "Process of Elimination",
                                        value: "poe",
                                        description: "players alternate bans until one track is left"
                                    },
                                    {
                                        label: "Random Player Pick",
                                        value: "random_pick",
                                        description: "random player gets to pick the first track"
                                    },
                                    {
                                        label: "Random",
                                        value: "random",
                                        description: "first track is randomly selected"
                                    }
                                ],
                                placeholder: "Selection Method",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
                if (false) { //if not predetermined
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_firsttrack_filter",
                                options: planetsncircuits,
                                placeholder: "Filter First Track Selection",
                                min_values: 1,
                                max_values: 12
                            }
                        ]
                    })
                }
                if (false) { //if determined
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_firsttrack_track",
                                options: track_selection,
                                placeholder: "Select First Track",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }
            } else if (args[2] == "permatrackban") {
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
                                custom_id: "tourney_rulesets_permatrackban_method",
                                options: [
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
                                custom_id: "tourney_rulesets_permatrackban_limit",
                                options: limits,
                                placeholder: "Permanent Track Ban Limit",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "permapodban") {
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
                                custom_id: "tourney_rulesets_permapodban_method",
                                options: [
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
                                custom_id: "tourney_rulesets_permapodban_limit",
                                options: limits,
                                placeholder: "Permanent Pod Ban Limit",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "temptrackban") {
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
                                custom_id: "tourney_rulesets_temptrackban_method",
                                options: [
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
                                        label: "Random Player Pick",
                                        value: "random_pick",
                                        description: "Random player gets to select temporary track ban"
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
                                custom_id: "tourney_rulesets_temptrackban_limit",
                                options: limits,
                                placeholder: "Temporary Track Ban Limit",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "temppodban") {
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
                                custom_id: "tourney_rulesets_temppodban_method",
                                options: [
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
                                        label: "Random Player Pick",
                                        value: "random_pick",
                                        description: "Random player gets to pick temporary pod ban"
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
                                custom_id: "tourney_rulesets_temppodban_limit",
                                options: limits,
                                placeholder: "Temporary Pod Ban Limit",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "trackselect") {
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
                                custom_id: "tourney_rulesets_trackselect_method",
                                options: [
                                    {
                                        label: "Predetermined",
                                        value: "predetermined",
                                        description: "track selection is already determined"
                                    },
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
                                        label: "Random Player Pick",
                                        value: "random_pick",
                                        description: "random player gets to pick the track for the next race"
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
                    }
                )
                if (false) { //if not predetermined
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_trackselect_filter",
                                options: planetsncircuits,
                                placeholder: "Filter First Track Selection",
                                min_values: 1,
                                max_values: 12
                            }
                        ]
                    })
                }
                if (false) { //if determined
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_trackselect_track",
                                options: track_selection,
                                placeholder: "Select First Track",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }
            } else if (args[2] == "trackdup") {
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
                                custom_id: "tourney_rulesets_trackdup_condition",
                                options: [
                                    {
                                        label: "None",
                                        value: "none",
                                        description: "duplicate track picks are not allowed"
                                    },
                                    {
                                        label: "Salty Runback",
                                        value: "salty_runback",
                                        description: "players can replay an already played track if they haven’t won"
                                    },
                                    {
                                        label: "Saltier Runback",
                                        value: "saltier_runback",
                                        description: "players can salty runback a runback"
                                    },
                                    {
                                        label: "Saltiest Runback",
                                        value: "saltiest_runback",
                                        description: "players can salty runback a runbacked runback"
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
                                custom_id: "tourney_rulesets_trackdup_limit",
                                options: limits,
                                placeholder: "Duplicate Track Pick Limit",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "trackcon") {
                var limits = []
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
                                custom_id: "tourney_rulesets_trackcon_method",
                                options: [
                                    {
                                        label: "Winner's Pick (Force)",
                                        value: "winners_pick",
                                        description: "Winner gets to pick conditions for the next track"
                                    },
                                    {
                                        label: "Loser's Pick (Force)",
                                        value: "losers_pick",
                                        description: "Loser gets to pick conditions for the next track"
                                    },
                                    {
                                        label: "Random Player Pick (Force)",
                                        value: "random_pick",
                                        description: "Random player gets to pick conditions for the next track"
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
                                custom_id: "tourney_rulset_trackcon_limit",
                                options: limits,
                                placeholder: "Condition Limit",
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
                                custom_id: "tourney_rulesets_trackcon_options",
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
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_general_gents",
                                options: [
                                    {
                                        label: "Allowed",
                                        value: "true"
                                    },
                                    {
                                        label: "Disallowed",
                                        value: "false"
                                    }
                                ],
                                placeholder: "Gentleman's Agreement",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                )
            } else if (args[2] == "podselect") {
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_podselect_method",
                                options: [
                                    {
                                        label: "Predetermined",
                                        value: "predetermined",
                                        description: "Pod selection is already determined"
                                    },
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
                                        label: "Random Player Pick",
                                        value: "random_pick",
                                        description: "random player gets to pick the pod for both players for the next race"
                                    },
                                    {
                                        label: "Random Mirrored",
                                        value: "random_mirrored",
                                        description: "players are assigned the same random pod"
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
                                        description: "players can use each pod a limited number of times"
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
                                custom_id: "tourney_rulesets_podselect_pods",
                                options: racer_selections,
                                placeholder: "Pods",
                                min_values: 1,
                                max_values: 25
                            }
                        ]

                    }
                )
            } else if (args[2] == "qual") {
                //pod select
                //add race
                //track
                //conditions
                //time limit
                //penalty time
            } else if (args[2] == "1vall") {
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
                        embeds: rulesetEmbed,
                        components: components
                    }
                }
            })
        }
    }
}
