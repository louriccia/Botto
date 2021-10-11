const { count } = require('console');
const { ordinalSuffix } = require('./../tools.js');

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
        var tourney_rulesets_data = {}, tourney_races_data = {}, tourney_matches_data = {}, tourney_participants_data = {}, tourney_tournaments_data = {}
        tourney_rulesets.on("value", function (snapshot) {
            tourney_rulesets_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
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
        var tourney_races = database.ref('tourney/races');
        tourney_races.on("value", function (snapshot) {
            tourney_races_data = snapshot.val();
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
                    .setColor("#3BA55D")
                    .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
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
            const tourneyMatches = new Discord.MessageEmbed()
                .setTitle("Tournament Matches")
                .setColor("#3BA55D")
                .setDescription("Use the select below to browse recent tournament matches.")
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
            if (args[1].startsWith("offset")) {

                var offset = Number(args[1].replace("offset", ""))
                if (interaction.data.hasOwnProperty("values")) {
                    if (interaction.data.values[0].includes("offset")) {
                        offset = Number(interaction.data.values[0].replace("offset", ""))
                    }
                }
                var type = 7
                var mtch = Object.keys(tourney_matches_data)
                mtch = mtch.sort(function (a, b) {
                    return tourney_matches_data[b].datetime - tourney_matches_data[a].datetime;
                })
                var matches = []
                for (i = 0 + offset * 23; i < (offset + 1) * 23; i++) {
                    if (i == 0 + offset * 23 && offset > 0) {
                        matches.push(
                            {
                                label: "Newer matches...",
                                value: "offset" + (offset - 1),
                            }
                        )
                    }
                    var s = mtch[i]
                    var title = []
                    if (![undefined, null, ""].includes(tourney_matches_data[s].bracket)) {
                        title.push(tourney_matches_data[s].bracket)
                    }
                    if (![undefined, null, ""].includes(tourney_matches_data[s].round)) {
                        title.push(tourney_matches_data[s].round)
                    }
                    var players = []
                    for (p = 0; p < tourney_matches_data[s].races[0].runs.length; p++) {
                        if (!players.includes(tourney_matches_data[s].races[0].runs[p].player)) {
                            players.push(tourney_participants_data[tourney_matches_data[s].races[0].runs[p].player].name)
                        }
                    }
                    var date = new Date(tourney_matches_data[s].datetime)
                    date = date.toLocaleString().split(", ")
                    if (title.length == 0) {
                        title = players.join(" vs ")
                    } else {
                        title = title.join(" ") + " - " + players.join(" vs ")
                    }
                    var r = {
                        label: title,
                        value: s,
                        description: tourney_tournaments_data[tourney_matches_data[s].tourney].name + " (" + date[0] + ")"
                    }
                    if (interaction.data.hasOwnProperty("values") && !interaction.data.values[0].includes("offset")) {
                        if (r.value == interaction.data.values[0]) {
                            r.default = true
                        }
                    }
                    matches.push(r)
                    if (i == mtch.length - 1) {
                        i = (offset + 1) * 23
                    }
                    if (i == (offset + 1) * 23 - 1) {
                        matches.push(
                            {
                                label: "Older matches...",
                                value: "offset" + (offset + 1),
                            }
                        )
                    }
                }
                if (args.includes("initial")) {
                    type = 4
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: type,
                            data: {
                                embeds: [tourneyMatches],
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 3,
                                                custom_id: "tourney_matches_offset" + offset,
                                                options: matches,
                                                placeholder: "Select Match",
                                                min_values: 1,
                                                max_values: 1
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    })
                    return
                }
                if (interaction.data.hasOwnProperty("values") && !interaction.data.values[0].includes("offset")) {
                    var match = interaction.data.values[0]
                    var title = [], comms = []
                    var description = ""
                    if (![undefined, null, ""].includes(tourney_matches_data[match].bracket)) {
                        title.push(tourney_matches_data[match].bracket)
                    }
                    if (![undefined, null, ""].includes(tourney_matches_data[match].round)) {
                        title.push(tourney_matches_data[match].round)
                    }
                    var players = []
                    for (p = 0; p < tourney_matches_data[match].races[0].runs.length; p++) {
                        if (!players.includes(tourney_matches_data[match].races[0].runs[p].player)) {
                            players.push(tourney_participants_data[tourney_matches_data[match].races[0].runs[p].player].name)
                        }
                    }
                    if (title.length == 0) {
                        title = players.join(" vs ")
                    } else {
                        title = title.join(" ") + " - " + players.join(" vs ")
                    }
                    tourney_matches_data[match].commentators.forEach(com => {
                        comms.push(tourney_participants_data[com].name)
                    })
                    if (tourney_tournaments_data[tourney_matches_data[match].tourney].hasOwnProperty("challonge")) {
                        description += "[:trophy: " + tourney_tournaments_data[tourney_matches_data[match].tourney].name + "](" + tourney_tournaments_data[tourney_matches_data[match].tourney].challonge[0] + ")\n"
                    } else {
                        description += ":trophy: " + tourney_tournaments_data[tourney_matches_data[match].tourney].name + "\n"
                    }

                    description += ":calendar_spiral: <t:" + Math.round(tourney_matches_data[match].datetime / 1000) + ":F>\n"
                    description += ":scroll: " + tourney_rulesets_data.saved[tourney_matches_data[match].ruleset].name + "\n"
                    description += ":microphone2: " + comms.join(", ")

                    tourneyMatches
                        .setTitle(title)
                        .setDescription(description)
                        .setColor("#3BA55D")
                        .setURL(tourney_matches_data[match].vod)
                        .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                    for (r = 0; r < tourney_matches_data[match].races.length; r++) {
                        var field = ""
                        if (tourney_matches_data[match].races[r].hasOwnProperty("tempbans")) {
                            tourney_matches_data[match].races[r].tempbans.forEach(ban => {
                                if (ban.type == "pod") {
                                    field += ":x: " + racers[ban.selection].flag + " (*" + tourney_participants_data[ban.player].name + "*)\n"
                                } else if (ban.type == "track") {
                                    field += ":x: " + tracks[ban.selection].nickname[0].toUpperCase() + " (*" + tourney_participants_data[ban.player].name + "*)\n"
                                }

                            })
                        }

                        var track = tourney_matches_data[match].races[r].track_selection.track
                        field += planets[tracks[track].planet].emoji + " " + tracks[track].nickname[0].toUpperCase() + " "
                        if (tourney_matches_data[match].races[r].track_selection.hasOwnProperty("player")) {
                            field += "(*" + tourney_participants_data[tourney_matches_data[match].races[r].track_selection.player].name + "*)"
                        }
                        field += "\n"
                        if (tourney_matches_data[match].races[r].hasOwnProperty("conditions")) {
                            tourney_matches_data[match].races[r].conditions.forEach(condition => {
                                if (condition.type == "skips") {
                                    field += ":asterisk: Skips (*" + tourney_participants_data[condition.player].name + "*)\n"
                                } else if (condition.type == "no_upgrades") {
                                    field += ":asterisk: NU (*" + tourney_participants_data[condition.player].name + "*)\n"
                                } else if (condition.type == "pod_ban") {
                                    field += ":x: " + racers[condition.selection].flag + " (*" + tourney_participants_data[condition.player].name + "*)\n"
                                }
                            })
                        }
                        var winner = {}
                        for (p = 0; p < tourney_matches_data[match].races[r].runs.length; p++) {
                            if ((winner.time == undefined || Number(tourney_matches_data[match].races[r].runs[p].time) < Number(winner.time)) && tourney_matches_data[match].races[r].runs[p].time !== "DNF") {
                                winner.time = Number(tourney_matches_data[match].races[r].runs[p].time)
                                winner.player = tourney_matches_data[match].races[r].runs[p].player
                            }
                        }
                        tourney_matches_data[match].races[r].runs.forEach(run => {
                            field += "**" + tourney_participants_data[run.player].name + "** "
                            if (run.player == winner.player) {
                                field += ":crown:"
                            }
                            field += "\n"
                            if (run.hasOwnProperty("pod")) {
                                field += racers[run.pod].flag + " "
                            }
                            if (run.time == "DNF") {
                                field += "`DNF`"
                            } else {
                                field += "`" + tools.timefix(run.time) + "`"
                            }
                            if (run.deaths == 1) {
                                field += " :skull:"
                            } else if (run.deaths > 1) {
                                field += ":skull:×" + run.deaths
                            }
                            field += "\n"
                        })
                        tourneyMatches
                            .addField("Race " + (r + 1), field, true)

                        if (r == 0 && tourney_matches_data[match].hasOwnProperty("permabans")) {
                            var permabans = ""
                            tourney_matches_data[match].permabans.forEach(permaban => {
                                if (permaban.type == "pod") {
                                    permabans += ":no_entry_sign: " + racers[permaban.selection].flag + " (*" + tourney_participants_data[permaban.player].name + "*)\n"
                                } else if (permaban.type == "track") {
                                    permabans += ":no_entry_sign: " + tracks[permaban.selection].nickname[0].toUpperCase() + " (*" + tourney_participants_data[permaban.player].name + "*)\n"
                                }
                            })
                            tourneyMatches
                                .addField("Permabans", permabans, true)
                        }
                    }
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: type,
                            data: {
                                embeds: [tourneyMatches],
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 3,
                                                custom_id: "tourney_matches_offset" + offset,
                                                options: matches,
                                                placeholder: "Select Match",
                                                min_values: 1,
                                                max_values: 1
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    })
                } else {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: type,
                            data: {
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 3,
                                                custom_id: "tourney_matches_offset" + offset,
                                                options: matches,
                                                placeholder: "Select Match",
                                                min_values: 1,
                                                max_values: 1
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
                        .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
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
        } else if (args[0] == "leaderboards") {
            const tourneyReport = new Discord.MessageEmbed()
            var type = 7
            if (args.includes("initial")) {
                type = 4
            }
            var track = Math.floor(Math.random() * 25)
            var pods = []
            var conditions = []
            var showall = false
            if (!args.includes("initial")) {
                for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //track
                    var option = interaction.message.components[0].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            track = option.value
                        }
                    }
                }
                for (var i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //conditions
                    var option = interaction.message.components[1].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            conditions.push(option.value)
                        }
                    }
                }
                for (var i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //pods
                    var option = interaction.message.components[2].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            pods.push(String(option.value))
                        }
                    }
                }
                if (args[1] == "track") {
                    track = Number(interaction.data.values[0])
                } else if (args[1] == "conditions") {
                    if (interaction.data.hasOwnProperty("values")) {
                        conditions = interaction.data.values
                    }
                } else if (args[1] == "pods") {
                    if (interaction.data.hasOwnProperty("values")) {
                        pods = interaction.data.values
                    } else {
                        pods = []
                    }
                }
            }
            if (conditions.length == 0) {
                conditions = ["mu", "nu", "ft", "skips", "deaths", "deathless", "pb"]
            }
            //prepare filters
            var nu = [], skips = [], user = null, qual = false, deaths = []
            if (conditions.includes("mu")) {
                nu.push(false)
            }
            if (conditions.includes("nu")) {
                nu.push(true)
            }
            if (conditions.includes("ft")) {
                skips.push(false)
            }
            if (conditions.includes("skips")) {
                skips.push(true)
            }
            if (conditions.includes("qual")) {
                qual = true
            }
            if (!conditions.includes("pb")) {
                showall = true
            }
            if (conditions.includes("deaths")) {
                deaths.push(true)
            }
            if (conditions.includes("deathless")) {
                deaths.push(false)
            }
            if (interaction.member) {
                user = interaction.member.user.id
            } else {
                user = interaction.user.id
            }
            //account for missing values
            if (deaths.length == 0) { deaths.push(true, false), conditions.push("deaths", "deathless") }
            if (nu.length == 0) { nu.push(true, false), conditions.push("mu", "nu") }
            if (skips.length == 0) { skips.push(true, false), conditions.push("ft", "skips") }
            //get runs and apply filters
            var runs = []
            var matches = Object.values(tourney_matches_data)
            var counts = { mu: 0, nu: 0, ft: 0, skips: 0, nuskips: 0, deaths: 0, deathless: 0, qual: 0, user: 0, tracks: {} }
            var pod_counts = {}
            matches.forEach(match => {
                match.races.forEach((race, num) => {
                    if (counts.tracks[race.track_selection.track] == undefined) {
                        counts.tracks[race.track_selection.track] = { total: 0, skips: 0, nu: 0, nuskips: 0 }
                    }
                    race.runs.forEach(run => {
                        counts.tracks[race.track_selection.track].total++
                        if (race.conditions !== undefined) {
                            var conditions = []
                            race.conditions.forEach(condition => {
                                if (condition.type == "skips") {
                                    conditions.push("skips")
                                } else if (condition.type == "no_upgrades") {
                                    conditions.push("nu")
                                }
                            })
                            if (conditions.includes("skips") && conditions.includes("nu")) {
                                counts.tracks[race.track_selection.track].nuskips++
                            } else if (conditions.includes("skips")) {
                                counts.tracks[race.track_selection.track].skips++
                            } else if (conditions.includes("nu")) {
                                counts.tracks[race.track_selection.track].nu++
                            }
                        }
                    })
                    if (race.track_selection.track == track) {
                        var opponents = []
                        race.runs.forEach(run => {
                            opponents.push(run.player)
                        })
                        race.runs.forEach(run => {
                            run.num = num + 1
                            run.vod = match.vod
                            run.tourney = match.tourney
                            run.bracket = match.bracket
                            run.round = match.round
                            run.podbans = []
                            if (race.tempbans !== undefined) {
                                race.tempbans.forEach(ban => {
                                    if (ban.type == "pod") {
                                        run.podbans.push(ban.selection)
                                    }
                                })
                            }
                            run.opponents = []
                            opponents.forEach(opponent => {
                                if (opponent !== run.player) {
                                    run.opponents.push(opponent)
                                }
                            })
                            run.skips = false
                            run.nu = false
                            if (race.conditions !== undefined) {
                                race.conditions.forEach(condition => {
                                    if (condition.type == "skips") {
                                        run.skips = true
                                    } else if (condition.type == "no_upgrades") {
                                        run.nu = true
                                    } else if (condition.type == "pod_ban") {
                                        run.podbans.push(condition.selection)
                                    }
                                    if (run.skips == true) {
                                        counts.skips++
                                    }
                                    if (run.nu == true) {
                                        counts.nu++
                                    }
                                })
                            }
                            if (run.skips == false) {
                                counts.ft++
                            }
                            if (run.nu == false) {
                                counts.mu++
                            }
                            if (run.deaths == 0) {
                                counts.deathless++
                            }
                            if (run.deaths > 0) {
                                counts.deaths++
                            }
                            if (match.bracket == "Qualifying") {
                                counts.qual++
                            }
                            if (String(tourney_participants_data[run.player].id) == String(user)) {
                                counts.user++
                            }
                            if (pod_counts[run.pod] == undefined) {
                                pod_counts[run.pod] = 1
                            } else {
                                pod_counts[run.pod]++
                            }
                            runs.push(run)
                        })
                    }
                })
            })

            runs = runs.filter(e => nu.includes(e.nu))
            runs = runs.filter(e => skips.includes(e.skips))
            if (!deaths.includes(true)) {
                runs = runs.filter(e => e.deaths == 0)
            } else if (!deaths.includes(false)) {
                runs = runs.filter(e => e.deaths > 0)
            }
            if (pods.length > 0) {
                runs = runs.filter(e => pods.includes(String(e.pod)))
            }
            if (user !== null && conditions.includes("user")) {
                runs = runs.filter(e => tourney_participants_data[e.player].id == user)
            }
            if (qual === false) {
                runs = runs.filter(e => e.bracket !== "Qualifying")
            }
            runs.sort(function (a, b) {
                if (a.time == "DNF" && b.time == "DNF") {
                    return 0
                } else if (a.time == "DNF") {
                    return 1
                } else if (b.time == "DNF") {
                    return -1
                } else {
                    return Number(a.time) - Number(b.time);
                }
            })
            //create embed
            tourneyReport
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                .setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name)
                .setColor(planets[tracks[track].planet].color)
                .setDescription(circuits[tracks[track].circuit].name + " Circuit | Race " + tracks[track].cirnum + " | " + planets[tracks[track].planet].name)
                .setFooter(runs.length + "/" + counts.tracks[track].total + " Runs")
                .setThumbnail(tracks[track].preview)
            if (user !== null) {
                if (interaction.member) {
                    const Guild = client.guilds.cache.get(interaction.guild_id);
                    const Member = Guild.members.cache.get(user)
                    tourneyReport.setAuthor(Member.user.username + "'s Tournament Best", client.guilds.resolve(interaction.guild_id).members.resolve(user).user.avatarURL())
                } else {
                    tourneyReport.setAuthor(interaction.user.username + "'s Tournament Best")
                }
                showall = true
            }
            if (!showall) {
                tourneyReport.setFooter(runs.length + "/" + counts.tracks[track].total + " Runs (PBs Only)")
            }
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            var already = []
            if (runs.length > 0) {
                for (i = 0; i < runs.length; i++) {
                    if (runs[i].hasOwnProperty("time") && !already.includes(runs[i].player + runs[i].nu + runs[i].skips)) {
                        var character = ""
                        var deaths = ""
                        var characterban = ""
                        var link = ""
                        var upgrade = "MU"
                        var cond = []
                        var opponent = ""
                        var bracket = ""
                        if (runs[i].nu == true) {
                            upgrade = "NU"
                        }
                        if (runs[i].skips == true) {
                            cond.push("Skips")
                        } else {
                            cond.push("FT")
                        }
                        link = runs[i].vod
                        if (runs[i].podbans.length > 0) {
                            characterban += " | :x: "
                        }
                        runs[i].podbans.forEach(ban => {
                            characterban += racers[ban].flag + " "
                        })
                        var opponents = []
                        runs[i].opponents.forEach(opponent => {
                            opponents.push(tourney_participants_data[opponent].name)
                        })
                        opponent = " vs " + opponents.join(", ")
                        if (runs[i].deaths > 1) {
                            deaths = " | :skull:×" + runs[i].deaths
                        } else if (runs[i].deaths == 1) {
                            deaths = " | :skull:"
                        }
                        if (![undefined, "", null].includes(runs[i].bracket)) {
                            bracket = " " + runs[i].bracket
                            if (![undefined, "", null].includes(runs[i].round)) {
                                bracket += " " + runs[i].round
                            }
                        }
                        character = racers[runs[i].pod].flag
                        var time = "DNF"
                        if (runs[i].time !== "DNF") {
                            time = tools.timefix(Number(runs[i].time).toFixed(3))
                        }
                        tourneyReport
                            .addField(pos[0] + " " + tourney_participants_data[runs[i].player].name, tourney_tournaments_data[runs[i].tourney].nickname + bracket + "\n[Race " + runs[i].num + opponent + "](" + link + ")", true)
                            .addField(time, " " + character + " | " + upgrade + deaths + "\n" + cond.join(" | ") + characterban, true)
                            .addField('\u200B', '\u200B', true)
                        if (showall == false) { already.push(runs[i].player + runs[i].nu + runs[i].skips) }
                        pos.splice(0, 1)
                        if (pos.length == 0) {
                            i = runs.length
                        }
                    }
                }

            } else {
                tourneyReport
                    .addField("<:WhyNobodyBuy:589481340957753363> No Runs", "`No runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)])
            }

            //construct components
            var components = []
            var cond = { mu: "Max Upgrades", nu: "No Upgrades", ft: "Full Track", skips: "Skips", deaths: "Deaths", deathless: "Deathless", qual: "Include Qualifying Runs", pb: "Personal Bests Only", user: "My Runs Only" }
            var track_selections = []
            var racer_selections = []
            var cond_selections = []
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
                if (pod_counts[i] !== undefined) {
                    //racer_option.label += " (" + pod_counts[i] + ")"
                    racer_option.description = pod_counts[i] + " Runs"
                } else {
                    racer_option.description = ""
                }
                if (pods.includes(String(i))) {
                    racer_option.default = true
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
                if (counts.tracks[i] !== undefined) {
                    //track_option.label += " (" + counts.tracks[i] + ")"
                    track_option.description = counts.tracks[i].total + " Runs"
                }
                if (counts.tracks[i].nu > 0 || counts.tracks[i].skips > 0 || counts.tracks[i].nuskips > 0) {
                    var stuff = []
                    if (counts.tracks[i].nu > 0) {
                        stuff.push(counts.tracks[i].nu + " NU")
                    }
                    if (counts.tracks[i].skips > 0) {
                        stuff.push(counts.tracks[i].skips + " Skips")
                    }
                    if (counts.tracks[i].nuskips > 0) {
                        stuff.push(counts.tracks[i].nuskips + " NU+Skips")
                    }
                    track_option.description += " (" + stuff.join(", ") + ")"
                }
                if (track == i) {
                    track_option.default = true
                }
                racer_selections.push(racer_option)
                track_selections.push(track_option)
                var condkeys = Object.keys(cond)
                if (i < condkeys.length) {
                    var cond_option = {
                        label: cond[condkeys[i]],
                        value: condkeys[i],
                    }
                    if (condkeys[i] !== "pb") {
                        cond_option.label += " (" + counts[condkeys[i]] + ")"
                    }
                    if (conditions.includes(condkeys[i])) {
                        cond_option.default = true
                    }
                    cond_selections.push(cond_option)
                }
            }
            racer_selections.sort(function (a, b) {
                if (a.description !== "" && b.description !== "") {
                    return Number(b.description.replace(" Runs", "")) - Number(a.description.replace(" Runs", ""))
                } else if (a.description == "") {
                    return 1
                } else if (b.description == "") {
                    return -1
                } else {
                    return 0
                }
            })
            var components = []
            components.push(
                {
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: "tourney_leaderboards_track",
                            options: track_selections,
                            placeholder: "Select Track",
                            min_values: 1,
                            max_values: 1
                        },
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: "tourney_leaderboards_conditions",
                            options: cond_selections,
                            placeholder: "Select Conditions",
                            min_values: 0,
                            max_values: cond_selections.length
                        },
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: "tourney_leaderboards_pods",
                            options: racer_selections,
                            placeholder: "Select Pods",
                            min_values: 0,
                            max_values: racer_selections.length
                        }
                    ]
                }
            )

            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: type,
                    data: {
                        //content: "",
                        embeds: [tourneyReport],
                        components: components
                    }
                }
            })
        } else if (args[0] == "rulesets") {
            var type = 7
            if (args.includes("initial")) {
                type = 4
            }
            var flags = 0
            var components = []
            const rulesetEmbed = new Discord.MessageEmbed()
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")

            var emojis = {
                "1v1": "🆚",
                "1vAll": "🏆",
                "Qualifier": "⏳",
                "Real-Time Attack": "⏱️"
            }

            function showRuleset(ruleset) {
                var conditions = {
                    mu: "Max Upgrades",
                    nu: "No Upgrades",
                    ft: "Full Track",
                    sk: "Skips",
                    pb: "Pod Ban",
                    pc: "Pod Choice",
                    //um: "Unmirrored",
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
                    no_limit: "No Match Limit",
                    lower: "Lower Rated",
                    higher: "Higher Rated",
                    default_repeat: "Default Repeat",
                    soft_repeat: "Soft Repeat",
                    hard_repeat: "Hard Repeat",
                    favorite: "Track Favorite",
                    random_tier: "Random by Tier"
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
                function podSelection(collection) {
                    var result = ""
                    if (collection.length == 23) {
                        result = "`Any Pod`"
                    } else {
                        var pods = []
                        var missing_pods = []
                        for (var p = 0; p < 23; p++) {
                            if (collection.includes(String(p))) {
                                pods.push(racers[p].flag)
                            } else {
                                missing_pods.push("No " + racers[p].flag)
                            }
                        }
                        if (missing_pods.length < pods.length) {
                            result = missing_pods.join(", ")
                        } else {
                            result = pods.join(" ")
                        }
                    }
                    return result
                }
                if (ruleset.type == "1v1") {

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
                                missing.push("~~`" + tracks[i].nickname[0] + "`~~")
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
                        .setDescription("Ruleset Type: 🆚 1v1")
                    var fields = []
                    //wins
                    var field = {}
                    field.name = ":trophy: Win Condition"
                    var winstuff = Object.values(ruleset.wins)
                    var winstring = []
                    for (i = 0; i < winstuff.length; i++) {
                        if (winstuff[i].includes("_max")) {
                            winstring.push("`" + winstuff[i].replace("_max", " Wins Max") + "`")
                        } else if (winstuff[i].includes("_min")) {
                            winstring.push("`" + winstuff[i].replace("_min", " Wins Minimum") + "`")
                        } else if (winstuff[i].includes("_row")) {
                            winstring.push("`" + winstuff[i].replace("_row", " Wins in a Row") + "`")
                        } else if (winstuff[i].includes("_by")) {
                            winstring.push("`Win by " + winstuff[i].replace("_by", "") + "`")
                        }
                    }
                    field.value = winstring.join("\n")
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
                    yesno = { disallowed: "Disallowed", allowed: "Allowed" }
                    field.name = ":tophat: Gentleman's Agreement"
                    field.value = "`" + yesno[ruleset.gents] + "`"
                    field.inline = true
                    fields.push(field)
                    //first track
                    field = {}
                    field.name = ":checkered_flag: First Track"
                    field.value = "`" + methods[ruleset.firstmethod] + "`\n"
                    field.value += trackSelection(Object.values(ruleset.firsttrack))
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
                                ml = Object.values(ruleset[tempbans[b].mlimit])
                                var ms = []
                                for (i = 0; i < ml.length; i++) {
                                    if (ml[i] == "no_limit") {
                                        ms.push("`No Match Limit`")
                                    } else if (ml[i] == "wins") {
                                        ms.push("`One Per Win`")
                                    } else if (ml[i] == "losses") {
                                        ms.push("`One Per Loss`")
                                    } else {
                                        ms.push("`" + ml[i] + " Per Player Per Match`")
                                    }
                                }
                                field.value += ms.join(" + ")
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
                        field.value += "`" + methods[ruleset.dupestyle] + "`\n"
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
                        field.value += cons.join(" ")
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
                            field.value += missing_pods.join(", ")
                        } else {
                            field.value += pods.join("")
                        }
                    }
                    field.inline = true
                    fields.push(field)
                    //construct fields
                    return fields
                } else if (ruleset.type == "1vAll" || ruleset.type == "Qualifier") {
                    conditions = {
                        mu: "MU",
                        nu: "NU",
                        ft: "FT",
                        sk: "Skips",
                        //um: "Unmirrored",
                        mi: "Mirrored",
                        l1: "1 Lap",
                        l2: "2 Laps",
                        l3: "3 Laps",
                        l4: "4 Laps",
                        l5: "5 Laps"
                    }
                    rulesetEmbed
                        .setDescription("Ruleset Type: 🏆 1vAll")
                    if (ruleset.type == "Qualifier") {
                        rulesetEmbed
                            .setDescription("Ruleset Type: ⏱️ Qualifier")
                    }
                    var fields = []
                    //races
                    var field = {}
                    field.name = ":checkered_flag: Races"
                    field.value = "`" + ruleset.racenum + "`"
                    field.inline = true
                    fields.push(field)
                    //pod selection
                    field = {}
                    field.name = "<:Pod1:525755322355417127> Pod Selection"
                    field.value = "`" + methods[ruleset.podmethod] + "`\n"
                    if (ruleset.podmethod == "pod_pool") {
                        field.value += "`" + ruleset.poollimit + " Uses Per Pod`"
                    }
                    field.inline = true
                    fields.push(field)
                    field = { name: '\u200B', value: '\u200B', inline: true }
                    fields.push(field)
                    //races
                    console.log("racenum: " + ruleset.racenum)
                    for (i = 0; i < Number(ruleset.racenum); i++) {
                        field = {}
                        field.name = ":triangular_flag_on_post: Race " + (i + 1)
                        field.value = planets[tracks[Number(ruleset.races[i].track)].planet].emoji + " **" + tracks[Number(ruleset.races[i].track)].name + "**\n"
                        var cons = []
                        for (j = 0; j < ruleset.races[i].conditions.length; j++) {
                            cons.push("`" + conditions[ruleset.races[i].conditions[j]] + "`")
                        }
                        field.value += cons.join(" ") + "\n"
                        if (["player_pick", "limited_choice"].includes(ruleset.podmethod)) {
                            field.value += podSelection(Object.values(ruleset.races[i].pods)) + "\n"
                        }
                        if (ruleset.type == "Qualifier") {
                            field.value += "`" + tools.timefix(ruleset.races[i].time).replace(".000", "") + " Time Limit`\n"
                            field.value += "`" + tools.timefix(ruleset.races[i].penalty).replace(".000", "") + " Penalty Time`"
                        }
                        field.inline = true
                        fields.push(field)
                    }
                    //construct fields
                    return fields
                }
            }

            if (args[1] == "edit") {
                var key = args.slice(2).join("_")
                var ruleset = tourney_rulesets_data.saved[key]
                if (ruleset.author !== interaction.member.user.id) {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                flags: 64,
                                content: "Only the ruleset author can edit or delete their ruleset."
                            }
                        }
                    })
                    return
                } else {
                    ruleset.edit = key
                    tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                    args[1] = "new"
                    args[2] = "general"
                    if (ruleset.type !== "1v1") {
                        args[2] = ruleset.type
                    }
                }
                type = 4
                flags = 64
            } else if (args[1] == "clone") {
                var key = args.slice(2).join("_")
                var ruleset = tourney_rulesets_data.saved[key]
                ruleset.author = interaction.member.user.id
                ruleset.name += " (2)"
                tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                args[1] = "new"
                args[2] = "general"
                if (ruleset.type !== "1v1") {
                    args[2] = ruleset.type
                }
                type = 4
                flags = 64
            } else if (args[1] == "delete") {
                var key = args.slice(2).join("_")
                var ruleset = tourney_rulesets_data.saved[key]
                if (ruleset.author !== interaction.member.user.id) {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                flags: 64,
                                content: "Only the ruleset author can edit or delete their ruleset."
                            }
                        }
                    })
                    return
                } else {
                    var key = args.slice(2).join("_")
                    tourney_rulesets.child("saved").child(key).remove()
                    args[1] = "browse"
                    args[2] = 0
                }
            }
            if (args[1] == "refresh") {
                args[1] = "browse"
            }
            if (args[1] == "browse") {
                rulesetEmbed.setTitle(":scroll: Rulesets")
                    .setDescription("This is the tournament ruleset manager. Browse existing rulesets using the dropdown below or make your own by pressing the New button.")
                var buttons = [
                    {
                        type: 2,
                        label: "",
                        emoji: {
                            id: "854097998357987418",
                            name: "refresh"
                        },
                        style: 2,
                        custom_id: "tourney_rulesets_refresh",
                    },
                    {
                        type: 2,
                        label: "New",
                        style: 3,
                        custom_id: "tourney_rulesets_type",
                    }
                ]
                var offset = 0
                if (args[2] !== undefined && args[2] !== "initial") {
                    offset = Number(args[2])
                }
                if (interaction.data.hasOwnProperty("values") && interaction.data.values[0].includes("offset")) {
                    offset = Number(interaction.data.values[0].replace("offset", ""))
                }
                if (![undefined, null].includes(tourney_rulesets_data.saved)) {
                    var saved = Object.keys(tourney_rulesets_data.saved)
                    var rulesets = []
                    saved = saved.sort(function (a, b) {
                        if (tourney_rulesets_data.saved[a].name < tourney_rulesets_data.saved[b].name) { return -1; }
                        if (tourney_rulesets_data.saved[a].name > tourney_rulesets_data.saved[b].name) { return 1; }
                        return 0;
                    })
                    for (i = 0 + offset * 23; i < (offset + 1) * 23; i++) {
                        if (i == 0 + offset * 23 && offset > 0) {
                            rulesets.push(
                                {
                                    label: "Previous...",
                                    value: "offset" + (offset - 1),
                                }
                            )
                        }
                        var s = saved[i]
                        var r = {
                            label: tourney_rulesets_data.saved[s].name,
                            emoji: {
                                name: emojis[tourney_rulesets_data.saved[s].type]
                            },
                            value: s,
                            description: tourney_rulesets_data.saved[s].type + " Ruleset by " + client.guilds.resolve(interaction.guild_id).members.resolve(tourney_rulesets_data.saved[s].author).user.username,
                        }
                        if (interaction.data.hasOwnProperty("values") && !interaction.data.values[0].includes("offset")) {
                            if (r.value == interaction.data.values[0]) {
                                r.default = true
                            }
                        }
                        rulesets.push(r)
                        if (i == saved.length - 1) {
                            i = (offset + 1) * 23
                        }
                        if (i == (offset + 1) * 23 - 1) {
                            rulesets.push(
                                {
                                    label: "See more...",
                                    value: "offset" + (offset + 1),
                                }
                            )
                        }
                    }
                    if (interaction.data.hasOwnProperty("values") && !interaction.data.values[0].includes("offset")) {
                        var ruleset = tourney_rulesets_data.saved[interaction.data.values[0]]
                        rulesetEmbed.setTitle(":scroll: Rulesets: " + ruleset.name)
                            .setDescription("Type: " + emojis[ruleset.type] + " " + ruleset.type)
                            .addFields(showRuleset(ruleset))
                            .setFooter(client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.username, client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.avatarURL())
                        buttons.push(
                            {
                                type: 2,
                                label: "Clone",
                                style: 2,
                                custom_id: "tourney_rulesets_clone_" + interaction.data.values[0],
                            }
                        )
                        if (interaction.member.user.id == ruleset.author) {
                            buttons.push(
                                {
                                    type: 2,
                                    label: "Edit",
                                    style: 2,
                                    custom_id: "tourney_rulesets_edit_" + interaction.data.values[0],
                                },
                                {
                                    type: 2,
                                    label: "Delete",
                                    style: 4,
                                    custom_id: "tourney_rulesets_delete_" + interaction.data.values[0],
                                }
                            )
                        }
                    }

                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_browse_" + offset,
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
                            type = 7
                        } else if (tourney_rulesets_data.new.hasOwnProperty(interaction.member.user.id)) {
                            rulesetEmbed
                                .setTitle(":exclamation: Unsaved Ruleset: " + tourney_rulesets_data.new[interaction.member.user.id].name)
                                .setDescription("You have an unsaved " + tourney_rulesets_data.new[interaction.member.user.id].type + " ruleset. Would you like to continue editing that one or start a new one?")

                            var next = "general"
                            if (tourney_rulesets_data.new[interaction.member.user.id].type == "1vAll") {
                                next = "1vAll"
                            } else if (tourney_rulesets_data.new[interaction.member.user.id].type == "Qualifier") {
                                next = "Qualifier"
                            }

                            components.push(
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            label: "Continue",
                                            style: 3,
                                            custom_id: "tourney_rulesets_new_" + next,
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
                        label: "1v1",
                        value: "1v1",
                        emoji: { name: emojis["1v1"] },
                        description: "Players face off until one satisfies the win conditions"
                    },
                    {
                        label: "1vAll",
                        value: "1vAll",
                        emoji: { name: emojis["1vAll"] },
                        description: "Players race against all other competitors in a set of races"
                    },
                    {
                        label: "Qualifier",
                        value: "Qualifier",
                        emoji: { name: emojis["Qualifier"] },
                        description: "Players race to get their best time within the time limit"
                    },
                    {
                        label: "Real-Time Attack",
                        value: "Real-Time Attack",
                        emoji: { name: emojis["Real-Time Attack"] },
                        description: "Players race a full circuit of tracks against the clock"
                    }
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
                                custom_id: "tourney_rulesets_new_create",
                                disabled: !create
                            }
                        ]
                    }

                )
            } else if (args[1] == "new") {
                if (args[2] == "create") {
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
                    if (ruleset_type == "Qualifier") {
                        ruleset = {
                            type: "Qualifier",
                            name: interaction.member.user.username + "'s Unnamed Qualifier Ruleset",
                            author: interaction.member.user.id,
                            podmethod: "player_pick",
                            poollimit: 1,
                            racenum: 7,
                            races: []
                        }
                        for (i = 0; i < 14; i++) {
                            ruleset.races.push(
                                {
                                    track: String(i),
                                    conditions: ["mu", "ft", "l3"],
                                    time: 600,
                                    penalty: 300,
                                    pods: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"]
                                }
                            )
                        }
                        args[2] = "Qualifier"
                    } else if (ruleset_type == "1v1") {
                        ruleset = {
                            type: "1v1",
                            name: interaction.member.user.username + "'s Unnamed 1v1 Ruleset",
                            author: interaction.member.user.id,
                            wins: ["5_max"],
                            default: ["mu", "ft", "l3"],
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
                            ttrackmlimit: ["no_limit"],
                            tpodmethod: "disabled",
                            tpodlimit: 1,
                            tpodmlimit: ["no_limit"],
                            tconmethod: "disabled",
                            tconlimit: 1,
                            tconmlimit: ["no_limit"],
                            trackmethod: "losers_pick",
                            tracktracks: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"],
                            dupecondition: "disabled",
                            dupestyle: "default_repeat",
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
                        args[2] = "general"
                    } else if (ruleset_type == "1vAll") {
                        ruleset = {
                            type: "1vAll",
                            name: interaction.member.user.username + "'s Unnamed 1vAll Ruleset",
                            author: interaction.member.user.id,
                            podmethod: "player_pick",
                            poollimit: 1,
                            racenum: 7,
                            races: []
                        }
                        for (i = 0; i < 14; i++) {
                            ruleset.races.push(
                                {
                                    track: String(i),
                                    conditions: ["mu", "ft", "l3"],
                                    pods: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"]
                                }
                            )
                        }
                        args[2] = "1vAll"
                    } else if (ruleset_type == "Real-Time Attack") {
                        ruleset = {
                            type: "Real-Time Attack",
                            name: interaction.member.user.username + "'s Unnamed Real-Time Attack Ruleset",
                            author: interaction.member.user.id,
                            podmethod: "player_pick",
                            circuits: ["0"],
                            poollimit: 1,
                            racenum: 7,
                        }
                        args[2] = "Qualifier"
                    }
                    if (ruleset !== {}) {
                        tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                    }

                }
                if (interaction.data.hasOwnProperty("values")) {
                    if (args[2] == "navigate") {
                        args[2] = interaction.data.values[0]
                    } else if (![undefined, "initial", "rename", "save", "races"].includes(args[3])) {
                        var data = interaction.data.values
                        if (args[2].includes("race") && args[2] !== "racenum") {

                            var race = Number(args[2].replace("race", "")) - 1
                            var races = tourney_rulesets_data.new[interaction.member.user.id].races
                            if (args[3] == "track") {
                                data = interaction.data.values[0]
                                races[race].track = data
                            } else if (args[3] == "conditions") {
                                races[race].conditions = data
                            } else if (args[3] == "pods") {
                                races[race].pods = data
                            }
                            tourney_rulesets.child("new").child(interaction.member.user.id).update({ races: races })
                        } else {
                            if (!["default", "firsttrack", "podpods", "tracktracks", "conoptions", "ttrackmlimit", "tpodmlimit", "tconmlimit", "wins"].includes(args[3])) {
                                data = interaction.data.values[0]
                            }
                            tourney_rulesets.child("new").child(interaction.member.user.id).child(args[3]).set(data)
                        }
                    }
                }
                var ruleset = tourney_rulesets_data.new[interaction.member.user.id]

                if (ruleset.type == "1v1") {
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
                        if (args[2] == options[i].value) {
                            options[i].default = true
                        }
                    }
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_new_navigate",
                                options: options,
                                placeholder: "Settings",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                } else if (ruleset.type == "1vAll" || ruleset.type == "Qualifier") {
                    var options = [
                        {
                            label: "General Settings",
                            value: ruleset.type,
                            emoji: { name: "🔷" },
                            description: "set number of races and pod selection options",
                        }
                    ]
                    var races = Object.values(tourney_rulesets_data.new[interaction.member.user.id].races)
                    for (i = 0; i < Number(tourney_rulesets_data.new[interaction.member.user.id].racenum); i++) {
                        options.push(
                            {
                                label: "Race " + (i + 1),
                                value: "race" + (i + 1),
                                emoji: { name: "🏁" },
                                description: tracks[races[i].track].name,
                            }
                        )
                    }
                    options.push(
                        {
                            label: "Name and Save",
                            value: "finalize",
                            emoji: { name: "✅" },
                            description: "finalize ruleset and submit changes",
                        }
                    )
                    for (i = 0; i < options.length; i++) {
                        if (args[2] == options[i].value) {
                            options[i].default = true
                        }
                    }
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_new_navigate",
                                options: options,
                                placeholder: "Settings",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                } else if (ruleset.type == "Real-Time Attack") {

                } else if (ruleset.type == "Bingo") {

                }


                rulesetEmbed
                    .setTitle(tourney_rulesets_data.new[interaction.member.user.id].name)
                    .setFooter(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())



                if (args[2] == "general") {
                    var win_options = []
                    for (i = 2; i < 10; i++) {
                        win_options.push(
                            {
                                label: i + " Wins Max",
                                value: i + "_max",
                                description: "if no other condition is met, fist to " + i + " wins the match"
                            }
                        )
                    }
                    for (i = 2; i < 10; i++) {
                        win_options.push(
                            {
                                label: i + " Wins Minimum",
                                value: i + "_min",
                                description: "in addition to other conditions, at least " + i + " is required to win"
                            })
                    }
                    for (i = 2; i < 6; i++) {
                        win_options.push(
                            {
                                label: i + " Wins in a Row",
                                value: i + "_row",
                                description: "winner must get " + i + " sequential wins"
                            })
                    }
                    for (i = 2; i < 6; i++) {
                        win_options.push(
                            {
                                label: "Win by " + i,
                                value: i + "_by",
                                description: "winner must exceed opponent's score by " + i
                            }
                        )
                    }
                    for (i = 0; i < win_options.length; i++) {
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id].wins).includes(win_options[i].value)) {
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
                        /*{
                            label: "Unmirrored",
                            value: "um"
                        },*/
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
                                    custom_id: "tourney_rulesets_new_general_wins",
                                    options: win_options,
                                    placeholder: "Set Win Conditions",
                                    min_values: 1,
                                    max_values: 3
                                }
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_new_general_default",
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
                                    custom_id: "tourney_rulesets_new_general_gents",
                                    options: gent_options,
                                    placeholder: "Gentleman's Agreement",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                } else if (args[2] == "firsttrack") {
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
                            label: "Lower Rated",
                            value: "lower",
                            description: "the lower rated player gets to pick the first track"
                        },
                        {
                            label: "Higher Rated",
                            value: "higher",
                            description: "the higher rated player gets to pick the first track"
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
                                    custom_id: "tourney_rulesets_new_firsttrack_firstmethod",
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
                                    custom_id: "tourney_rulesets_new_firsttrack_firsttrack",
                                    options: first_track,
                                    placeholder: "Filter First Track Options",
                                    min_values: 1,
                                    max_values: 25
                                }
                            ]
                        }
                    )
                } else if (["permatrackban", "permapodban", "permaconban"].includes(args[2])) {
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
                        if (bans[b].command == args[2]) {
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
                                    custom_id: "tourney_rulesets_new_" + bans[ban].command + "_" + bans[ban].method,
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
                                    custom_id: "tourney_rulesets_new_" + bans[ban].command + "_" + bans[ban].limit,
                                    options: limits,
                                    placeholder: "Permanent " + bans[ban].name + " Bans Per Match",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        })
                    }


                } else if (["temptrackban", "temppodban", "tempconban"].includes(args[2])) {
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
                        if (bans[b].command == args[2]) {
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
                            label: "Unlimited",
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
                            value: String(i)
                        }
                        match_limits.push(limit)
                    }
                    for (i = 0; i < match_limits.length; i++) {
                        if (Object.values(tourney_rulesets_data.new[interaction.member.user.id][bans[ban].mlimit]).includes(match_limits[i].value)) {
                            match_limits[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_new_" + bans[ban].command + "_" + bans[ban].method,
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
                                        custom_id: "tourney_rulesets_new_" + bans[ban].command + "_" + bans[ban].limit,
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
                                            custom_id: "tourney_rulesets_new_" + bans[ban].command + "_" + bans[ban].mlimit,
                                            options: match_limits,
                                            placeholder: "Temporary " + bans[ban].name + " Bans Per Player Per Match",
                                            min_values: 1,
                                            max_values: 2
                                        }
                                    ]
                                }
                            )
                        }
                    }
                } else if (args[2] == "trackselect") {
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
                                    custom_id: "tourney_rulesets_new_trackselect_trackmethod",
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
                                    custom_id: "tourney_rulesets_new_trackselect_tracktracks",
                                    options: track_options,
                                    placeholder: "Track Selection Options",
                                    min_values: 1,
                                    max_values: 25
                                }
                            ]
                        }
                    )
                } else if (args[2] == "trackdup") {
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
                            description: "players can repeat a track only if they haven’t won on it"
                        },
                        {
                            label: "Saltier Runback",
                            value: "saltier_runback",
                            description: "players can runback a Salty Runback"
                        },
                        {
                            label: "Saltiest Runback",
                            value: "saltiest_runback",
                            description: "players can runback a Saltier Runback"
                        },
                        {
                            label: "Allowed",
                            value: "any",
                            description: "repeat track picks are always allowed"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id].dupecondition) {
                            methods[i].default = true
                        }
                    }
                    var styles = [
                        {
                            label: "Default Repeat",
                            value: "default_repeat",
                            description: "repeat tracks must use the default conditions"
                        },
                        {
                            label: "Hard Repeat",
                            value: "hard_repeat",
                            description: "repeat tracks must use the same conditions as originally used"
                        },
                        {
                            label: "Soft Repeat",
                            value: "soft_repeat",
                            description: "repeat tracks may have different conditions than originally used"
                        }
                    ]
                    for (i = 0; i < styles.length; i++) {
                        if (styles[i].value == tourney_rulesets_data.new[interaction.member.user.id].dupestyle) {
                            styles[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_new_trackdup_dupecondition",
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
                                        custom_id: "tourney_rulesets_new_trackdup_dupestyle",
                                        options: styles,
                                        placeholder: "Repeat Track Style",
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
                                        custom_id: "tourney_rulesets_new_trackdup_dupelimit",
                                        options: limits,
                                        placeholder: "Repeat Track Pick Limit",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]
                            }
                        )
                    }
                } else if (args[2] == "trackcon") {
                    var limits = []
                    limits.push(
                        {
                            label: "1 Per Win",
                            value: "wins",
                            description: "Players earn forces for each race win"
                        },
                        {
                            label: "1 Per Loss",
                            value: "losses",
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
                                    custom_id: "tourney_rulesets_new_trackcon_conmethod",
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
                                    custom_id: "tourney_rulesets_new_trackcon_conmax",
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
                                            custom_id: "tourney_rulesets_new_trackcon_conlimit",
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
                                        custom_id: "tourney_rulesets_new_trackcon_conoptions",
                                        options: conoptions,
                                        placeholder: "Condition Options",
                                        min_values: 1,
                                        max_values: conoptions.length
                                    }
                                ]
                            })
                    }
                } else if (args[2] == "podselect") {
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
                            label: "Random by Tier",
                            value: "random_tier",
                            description: "players are individually assigned random pods from the same tier for the next race"
                        },
                        {
                            label: "Random",
                            value: "random",
                            description: "players are individually assigned completely random pods for the next race"
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
                        },
                        {
                            label: "Track Favorite",
                            value: "favorite",
                            description: "players must use the favorite of the selected track for the next race"
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
                                    custom_id: "tourney_rulesets_new_podselect_podmethod",
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
                                        custom_id: "tourney_rulesets_new_podselect_rndlimited",
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
                                        custom_id: "tourney_rulesets_new_podselect_poollimit",
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
                                    custom_id: "tourney_rulesets_new_podselect_podpods",
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
                } else if (args[2] == "finalize") {
                    var rename = true
                    if (args[3] == "rename") {
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
                            var newname = message.content.substring(0, 50)
                            tourney_rulesets.child("new").child(interaction.member.user.id).child("name").set(newname)
                            rulesetEmbed.setTitle(newname)
                            components[1].components[0].disabled = false
                            message.delete().then(sendResponse())
                        })
                        //client.api.interactions(interaction.id, interaction.token).callback.post({ data: { type: 6, data: {} } })
                        //return
                    } else if (args[3] == "save") {
                        type = 7
                        rulesetEmbed
                            .setTitle(":white_check_mark: Ruleset Saved")
                            .setDescription("Successfully saved **" + tourney_rulesets_data.new[interaction.member.user.id].name + "** to rulesets.")
                        rulesetEmbed.fields = []
                        rulesetEmbed.setFooter("")
                        components = []

                        var ruleset = tourney_rulesets_data.new[interaction.member.user.id]
                        if (ruleset.hasOwnProperty("edit")) {
                            var key = ruleset.edit
                            delete ruleset.edit
                            tourney_rulesets.child("saved").child(key).set(ruleset)
                            tourney_rulesets.child("new").child(interaction.member.user.id).remove()
                        } else {
                            tourney_rulesets.child("saved").push(ruleset)
                            tourney_rulesets.child("new").child(interaction.member.user.id).remove()
                        }
                    }
                    if (args[3] !== "save") {
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Rename",
                                        style: 1,
                                        custom_id: "tourney_rulesets_new_finalize_rename",
                                        disabled: !rename
                                    },
                                    {
                                        type: 2,
                                        label: "Save",
                                        style: 3,
                                        custom_id: "tourney_rulesets_new_finalize_save",
                                    }
                                ]
                            }
                        )
                    }



                } else if (args[2] == "1vAll" || args[2] == "Qualifier") {
                    var race_options = []
                    for (i = 3; i < 15; i++) {
                        race_options.push(
                            {
                                label: i + " Races",
                                value: i
                            }
                        )
                    }
                    for (i = 0; i < race_options.length; i++) {
                        if (tourney_rulesets_data.new[interaction.member.user.id].racenum == race_options[i].value) {
                            race_options[i].default = true
                        }
                    }
                    var methods = [
                        {
                            label: "Player's Pick",
                            value: "player_pick",
                            description: "Players get to pick their own pods for each race"
                        },
                        {
                            label: "Limited Choice",
                            value: "limited_choice",
                            description: "players choose their pod from a limited predetermined selection of pods"
                        },
                        {
                            label: "Pod Pool",
                            value: "pod_pool",
                            description: "players can only use each pod a limited number of times"
                        },
                        {
                            label: "Track Favorite",
                            value: "favorite",
                            description: "players must use the favorite of the selected track for each race"
                        }
                    ]
                    for (i = 0; i < methods.length; i++) {
                        if (methods[i].value == tourney_rulesets_data.new[interaction.member.user.id].podmethod) {
                            methods[i].default = true
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_new_" + ruleset.type + "_racenum",
                                    options: race_options,
                                    placeholder: "Number of Races",
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
                                    custom_id: "tourney_rulesets_new_" + ruleset.type + "_podmethod",
                                    options: methods,
                                    placeholder: "Pod Selection Method",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
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
                                        custom_id: "tourney_rulesets_new_podselect_poollimit",
                                        options: limits,
                                        placeholder: "Pod Pool Use Limit",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]

                            }
                        )
                    }
                } else if (args[2].includes("race")) {
                    var race_num = Number(args[2].replace("race", "")) - 1
                    var races = Object.values(tourney_rulesets_data.new[interaction.member.user.id].races)

                    if (args[3] == "time") {
                        type = 7
                        client.api.webhooks(client.user.id, interaction.token).post({
                            data: {
                                content: "Send the time limit in this channel. Ex: `15:00.000`",
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
                        const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m.author.id == interaction.member.user.id, { max: 1, time: 300000 }); //messages
                        collector.on('collect', message => {
                            var race = Number(args[2].replace("race", "")) - 1
                            var races = tourney_rulesets_data.new[interaction.member.user.id].races
                            races[race].time = tools.timetoSeconds(message.content)
                            tourney_rulesets.child("new").child(interaction.member.user.id).update({ races: races })
                            //components[1].components[0].disabled = false
                            message.delete().then(sendResponse())
                        })
                    } else if (args[3] == "penalty") {
                        type = 7
                        client.api.webhooks(client.user.id, interaction.token).post({
                            data: {
                                content: "Send the penalty time in this channel. Ex: `15:00.000`",
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
                        const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m.author.id == interaction.member.user.id, { max: 1, time: 300000 }); //messages
                        collector.on('collect', message => {
                            var race = Number(args[2].replace("race", "")) - 1
                            var races = tourney_rulesets_data.new[interaction.member.user.id].races
                            races[race].penalty = tools.timetoSeconds(message.content)
                            tourney_rulesets.child("new").child(interaction.member.user.id).update({ races: races })
                            //components[1].components[0].disabled = false
                            message.delete().then(sendResponse())
                        })
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
                        if (races[race_num].track == track_option.value) {
                            track_option.default = true
                        }
                        track_options.push(track_option)
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
                        /*{
                            label: "Unmirrored",
                            value: "um"
                        },*/
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
                        if (races[race_num].conditions.includes(conoptions[i].value)) {
                            conoptions[i].default = true
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
                        if (races[race_num].pods.includes(String(racer_option.value))) {
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
                                    custom_id: "tourney_rulesets_new_" + args[2] + "_track",
                                    options: track_options,
                                    placeholder: "Select Track",
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
                                    custom_id: "tourney_rulesets_new_" + args[2] + "_conditions",
                                    options: conoptions,
                                    placeholder: "Track Conditions",
                                    min_values: 3,
                                    max_values: 4
                                }
                            ]
                        }
                    )
                    if (["player_pick", "limited_choice"].includes(tourney_rulesets_data.new[interaction.member.user.id].podmethod)) {
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "tourney_rulesets_new_" + args[2] + "_pods",
                                        options: pod_options,
                                        placeholder: "Pod Selection Method",
                                        min_values: 1,
                                        max_values: 23
                                    }
                                ]
                            }
                        )
                    }
                    if (tourney_rulesets_data.new[interaction.member.user.id].type == "Qualifier") {
                        components.push(
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Set Time Limit",
                                        style: 1,
                                        custom_id: "tourney_rulesets_new_" + args[2] + "_time"
                                    },
                                    {
                                        type: 2,
                                        label: "Set Penalty Time",
                                        style: 1,
                                        custom_id: "tourney_rulesets_new_" + args[2] + "_penalty"
                                    }
                                ]
                            }
                        )
                    }
                    //time limit
                    //penalty time
                } else if (args[2] == "rta") {
                    var circuit_options = [
                        {
                            label: "Amateur Circuit",
                            value: "amc",
                            description: "players play through the entirety of the Amateur Circuit"
                        },
                        {
                            label: "Semi-Pro Circuit",
                            value: "spc",
                            description: "players play through the entirety of the Semi-Pro Circuit"
                        },
                        {
                            label: "Galactic Circuit",
                            value: "gal",
                            description: "players play through the entirety of the Galactic Circuit"
                        },
                        {
                            label: "Invitational Circuit",
                            value: "inv",
                            description: "players play through the entirety of the Invitational Circuit"
                        },
                        {
                            label: "Random Track Circuit (4 Tracks)",
                            value: "r4",
                            description: "players play through a circuit of 4 random tracks"
                        },
                        {
                            label: "Random Track Circuit (5 Tracks)",
                            value: "r5",
                            description: "players play through a circuit of 5 random tracks"
                        },
                        {
                            label: "Random Track Circuit (6 Tracks)",
                            value: "r6",
                            description: "players play through a circuit of 6 random tracks"
                        },
                        {
                            label: "Random Track Circuit (7 Tracks)",
                            value: "r7",
                            description: "players play through a circuit of 7 random tracks"
                        }
                    ]
                    for (i = 0; i < circuit_options.length; i++) {
                        if (circuit_options[i].value == tourney_rulesets_data.new[interaction.member.user.id].circuit) {
                            circuit_options[i].default = true
                        }
                    }

                    var con_options = [
                        {
                            label: "New Game +",
                            value: "ng"
                        },
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
                            label: "Mirrored",
                            value: "mi"
                        },
                        {
                            label: "No Junkyard",
                            value: "nj"
                        },
                        {
                            label: "Cheats Allowed",
                            value: "ca"
                        }
                    ]


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
                                    custom_id: "tourney_rulesets_new_general_wins",
                                    options: win_options,
                                    placeholder: "Set Win Conditions",
                                    min_values: 1,
                                    max_values: 3
                                }
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_rulesets_new_general_default",
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
                                    custom_id: "tourney_rulesets_new_general_gents",
                                    options: gent_options,
                                    placeholder: "Gentleman's Agreement",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        }
                    )
                }

                if (![null, undefined].includes(tourney_rulesets_data)) {
                    if (![null, undefined].includes(tourney_rulesets_data.new)) {
                        rulesetEmbed.addFields(showRuleset(tourney_rulesets_data.new[interaction.member.user.id]))
                    }
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
        } else if (args[0] == "stats") {
            var player = "global", type = 6, track = null, player_runs = []
            var sort = "plays"
            if (args.includes("initial")) {
                type = 5
            } else {
                for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //player
                    var option = interaction.message.components[0].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            player = option.value
                        }
                    }
                }
                if (interaction.message.embeds[0].title !== "Global Stats") {
                    var tpd = Object.keys(tourney_participants_data)
                    var name = interaction.message.embeds[0].title.replace("'s Stats", "")
                    for (i = 0; i < tpd.length; i++) {
                        if (tourney_participants_data[tpd[i]].name == name) {
                            player = tpd[i]
                        }
                    }
                }
                for (var i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //sort
                    var option = interaction.message.components[1].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            sort = option.value
                        }
                    }
                }
                for (var i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //tracks
                    var option = interaction.message.components[2].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            track = Number(option.value)
                        }
                    }
                }
            }
            var offset = 0
            if (args[1] == "player") {
                if (interaction.data.hasOwnProperty("values")) {
                    if (interaction.data.values[0].includes("offset")) {
                        offset = Number(interaction.data.values[0].replace("offset", ""))
                    } else {
                        player = interaction.data.values[0]
                    }
                }
            } else if (args[1] == "sort") {
                if (interaction.data.hasOwnProperty("values")) {
                    sort = interaction.data.values[0]
                }
            } else if (args[1] == "tracks") {
                if (interaction.data.hasOwnProperty("values")) {
                    track = Number(interaction.data.values[0])
                }
            }
            const tourneyReport = new Discord.MessageEmbed()
            tourneyReport
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                .setColor("#3BA55D")
            if (player == "global") {
                tourneyReport.setTitle("Global Stats")
            } else {
                tourneyReport.setTitle(tourney_participants_data[player].name + "'s Stats")
            }

            async function sendCallback() {
                const wait = client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            content: "Coming right up..."
                            //embeds: [racerEmbed]
                        }
                    }
                })
                return wait
            }
            async function sendResponse(data) {
                const response = await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch(
                    {
                        data: {
                            components: data[1],
                            embeds: [data[0]]
                        }
                    }
                )
                return response
            }
            sendCallback().then(() => {
                var accomp = { win: { count: 0, streaks: [] }, deathless: { count: 0, streaks: [] } }
                var accomplishments = []
                var stats = {
                    race_time: 0,
                    deaths: [],
                    matches: {
                        total: 0,
                        won: 0,
                        lost: 0,
                        qual: 0,
                        winners: 0,
                        losers: 0
                    },
                    races: {
                        total: 0,
                        won: 0,
                        lost: 0,
                        runbacks: 0,
                        dnf: 0,
                    },
                    forces: {
                        no_upgrades: 0,
                        skips: 0,
                        pod_ban: 0
                    },
                    tracks: {},
                    pods: {},
                    players: {},
                    commentators: {}
                }
                var tpd = Object.keys(tourney_participants_data)
                tpd.forEach(participant => {
                    stats.players[participant] = {
                        race_time: 0,
                        deaths: [],
                        matches: { total: 0, won: 0, lost: 0, qual: 0, winners: 0, losers: 0 },
                        races: { total: 0, won: 0, lost: 0, runbacks: 0, dnf: 0, },
                        tracks: {},
                        pods: {},
                        opponents: {},
                        forces: { no_upgrades: 0, skips: 0, pod_ban: 0 },
                        co_comm: {},
                    }
                })
                for (i = 0; i < 25; i++) {
                    stats.tracks[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], runbacks: 0, nu: 0, skips: 0 }
                    stats.pods[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], nu: 0, skips: 0 }
                    tpd.forEach(participant => {
                        stats.players[participant].tracks[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], runbacks: 0, nu: 0, skips: 0 }
                        stats.players[participant].pods[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], nu: 0, skips: 0 }
                    })
                }

                //get stats
                var tmd = Object.values(tourney_matches_data)
                tmd = tmd.sort(function (a, b) {
                    return a.datetime - b.datetime
                })
                tmd.forEach(match => {
                    var already_played = []
                    var runback = {}
                    match.commentators.forEach(commentator => {
                        if (stats.commentators[commentator] == undefined) {
                            stats.commentators[commentator] = { count: 1, cocomm: {}, comfor: {} }
                        } else {
                            stats.commentators[commentator].count++
                        }
                        match.commentators.forEach(cocomm => {
                            if (cocomm !== commentator) {
                                if (stats.commentators[commentator].cocomm[cocomm] == undefined) {
                                    stats.commentators[commentator].cocomm[cocomm] = 1
                                } else {
                                    stats.commentators[commentator].cocomm[cocomm]++
                                }
                            }
                        })
                        match.races.forEach((race, num) => {
                            if (num == 0) {
                                race.runs.forEach(run => {
                                    if (stats.commentators[commentator].comfor[run.player] == undefined) {
                                        stats.commentators[commentator].comfor[run.player] = 1
                                    } else {
                                        stats.commentators[commentator].comfor[run.player]++
                                    }

                                })
                            }
                        })
                    })
                    match.races.forEach((race, num) => {
                        if (num == 0) {
                            race.runs.forEach(run => {
                                if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                                    race.runs.forEach(opponent => {
                                        if (opponent.player !== run.player) {
                                            if (stats.players[run.player].opponents[opponent.player] == undefined) {
                                                stats.players[run.player].opponents[opponent.player] = { matches: 0, races: 0, wins: [], times: [] }
                                            }
                                            stats.players[run.player].opponents[opponent.player].matches++
                                        }
                                    })
                                }
                            })
                        }
                    })
                    if (match.bracket == "Qualifying") {
                        stats.matches.qual++
                    } else if (match.bracket == "Losers") {
                        stats.matches.winners++
                    } else if (match.bracket == "Winners") {
                        stats.matches.losers++
                    }
                    stats.matches.total++
                    var already_banned = []
                    var score = {}
                    match.races.forEach((race, num) => {
                        var temptrack = []
                        var temppod = []
                        var conditions = []
                        if (race.tempbans !== undefined) {
                            race.tempbans.forEach(ban => {
                                if (ban.type == "pod") {
                                    stats.pods[ban.selection].bans.push(1)
                                    stats.players[ban.player].pods[ban.selection].bans.push(1)
                                    temppod.push(Number(ban.selection))
                                    for (var i = 0; i < 25; i++) {
                                        if (!temppod.includes(i)) {
                                            stats.pods[i].bans.push(0)
                                            stats.players[ban.player].pods[i].bans.push(0)
                                        }
                                    }
                                } else if (ban.type == "track") {
                                    stats.tracks[ban.selection].bans.push(1)
                                    stats.players[ban.player].tracks[ban.selection].bans.push(1)
                                    temptrack.push(Number(ban.selection))
                                    var opponent = null
                                    race.runs.forEach(run => {
                                        if (run.player !== ban.player) {
                                            opponent = run.player
                                        }
                                    })
                                    for (var i = 0; i < 25; i++) {
                                        if (!temptrack.includes(i) && !already_banned.includes(i) && (!already_played.includes(i) || (already_played.includes(i) && runback[opponent] == undefined))) {
                                            stats.tracks[i].bans.push(0)
                                            stats.players[ban.player].tracks[i].bans.push(0)
                                        }
                                    }
                                }
                            })
                        }
                        if (race.conditions !== undefined) {
                            race.conditions.forEach(condition => {
                                stats.forces.total++
                                stats.players[condition.player].forces[condition.type]++
                                if (condition.type == "skips") {
                                    stats.forces.skips++
                                    conditions.push("skips")
                                } else if (condition.type == "no_upgrades") {
                                    stats.forces.no_upgrades++
                                    conditions.push("nu")
                                } else if (condition.type == "pod_ban") {
                                    stats.forces.pod_ban++
                                    temppod.push(condition.selection)
                                }
                            })
                        }

                        if (num == 0) {
                            already_played.push(Number(race.track_selection.track))
                            race.runs.forEach(run => {
                                stats.players[run.player].matches.total++
                                if (match.bracket == "Qualifying") {
                                    stats.players[run.player].matches.qual++
                                } else if (match.bracket == "Winners") {
                                    stats.players[run.player].matches.winners++
                                } else if (match.bracket == "Losers") {
                                    stats.players[run.player].matches.losers++
                                }
                                score[run.player] = 0
                            })
                            if (match.permabans !== undefined) {
                                match.permabans.forEach(ban => {
                                    if (ban.type == "track") {
                                        stats.tracks[ban.selection].bans.push(1)
                                        stats.players[ban.player].tracks[ban.selection].bans.push(1)
                                        already_banned.push(Number(ban.selection))
                                        for (var i = 0; i < 25; i++) {
                                            if (!already_banned.includes(i) && !already_played.includes(i)) {
                                                stats.tracks[i].bans.push(0)
                                                stats.players[ban.player].tracks[i].bans.push(0)
                                            }
                                        }
                                    }
                                })
                            }

                        }
                        if (race.track_selection.player !== undefined) {
                            if (already_played.includes(race.track_selection.track)) {
                                runback[race.track_selection.player] = true
                                stats.tracks[race.track_selection.track].runbacks++
                                stats.players[race.track_selection.player].tracks[race.track_selection.track].runbacks++
                                stats.races.runbacks++
                                stats.players[race.track_selection.player].races.runbacks++
                            }
                            stats.tracks[race.track_selection.track].picks.push(1)
                            stats.players[race.track_selection.player].tracks[race.track_selection.track].picks.push(1)
                            already_played.push(Number(race.track_selection.track))
                            for (var i = 0; i < 25; i++) {
                                if (!temptrack.includes(i) && !already_banned.includes(i) && (!already_played.includes(i) || (already_played.includes(i) && (runback[race.track_selection.player] !== undefined)))) {
                                    stats.tracks[i].picks.push(0)
                                    stats.players[race.track_selection.player].tracks[i].picks.push(0)
                                }
                            }
                        }
                        var winner = { player: null, time: null, pod: null }
                        var player_run = {}
                        race.runs.forEach(run => {
                            if (run.time !== "DNF") {
                                stats.race_time += Number(run.time)
                                stats.players[run.player].race_time += Number(run.time)
                                if (winner.time == null || run.time < winner.time) {
                                    winner = { player: run.player, time: run.time, pod: run.pod }
                                }
                            } else {
                                stats.races.dnf++
                                stats.players[run.player].races.dnf++
                            }
                            stats.players[run.player].races.total++
                            stats.races.total++
                            if (conditions.includes("skips")) {
                                stats.players[run.player].tracks[race.track_selection.track].skips++
                                stats.players[run.player].pods[run.pod].skips++
                                stats.pods[run.pod].skips++
                                stats.tracks[race.track_selection.track].skips++
                            }
                            if (conditions.includes("nu")) {
                                stats.players[run.player].tracks[race.track_selection.track].nu++
                                stats.players[run.player].pods[run.pod].nu++
                                stats.pods[run.pod].nu++
                                stats.tracks[race.track_selection.track].nu++
                            }
                            if (run.deaths == undefined) {
                                run.deaths = 0
                            }

                            stats.deaths.push(run.deaths)
                            stats.tracks[race.track_selection.track].deaths.push(run.deaths)
                            stats.players[run.player].tracks[race.track_selection.track].deaths.push(run.deaths)
                            stats.players[run.player].deaths.push(run.deaths)
                            if (run.player == player && match.bracket !== "Qualifying") {
                                if (run.deaths == 0) {
                                    accomp.deathless.count++
                                } else {
                                    accomp.deathless.streaks.push(accomp.deathless.count)
                                    accomp.deathless.count = 0
                                }
                            }

                            stats.tracks[race.track_selection.track].plays++
                            stats.players[run.player].tracks[race.track_selection.track].plays++

                            if (run.pod !== undefined) {
                                stats.pods[run.pod].plays++
                                stats.pods[run.pod].picks.push(1)
                                stats.pods[run.pod].deaths.push(run.deaths)
                                stats.players[run.player].pods[run.pod].plays++
                                stats.players[run.player].pods[run.pod].picks.push(1)
                                stats.players[run.player].pods[run.pod].deaths.push(run.deaths)
                                for (var i = 0; i < 25; i++) {
                                    if (!temppod.includes(i) && i !== run.pod) {
                                        stats.pods[i].picks.push(0)
                                        stats.players[run.player].pods[i].picks.push(0)
                                    }
                                }
                            }
                            if (run.player == player && race.track_selection.track == track) {
                                player_run = {
                                    match: tourney_tournaments_data[match.tourney].nickname + " " + match.bracket + " ",
                                    time: run.time,
                                    pod: run.pod,
                                    race: num + 1,
                                    conditions: conditions,
                                    temppod: temppod,
                                    deaths: run.deaths,
                                    pick: false,
                                    winner: false,
                                    opponents: []
                                }
                                if (match.round !== undefined) {
                                    player_run.match += match.round
                                }
                                if (race.track_selection.hasOwnProperty("player")) {
                                    if (race.track_selection.player == player) {
                                        player_run.pick = true
                                    }
                                }
                            }
                            if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                                race.runs.forEach(opponent => {
                                    if (opponent.player !== run.player) {
                                        if (player_run.hasOwnProperty("opponents") && opponent.player !== player) {
                                            player_run.opponents.push(opponent.player)
                                        }
                                        stats.players[run.player].opponents[opponent.player].races++
                                        if (opponent.time !== "DNF" && run.time !== "DNF") {
                                            stats.players[run.player].opponents[opponent.player].times.push(opponent.time - run.time)
                                            if (run.time - opponent.time < 0 || run.time == "DNF") {
                                                stats.players[run.player].opponents[opponent.player].wins.push(1)
                                            } else if (opponent.time - run.time < 0 || opponent.time == "DNF") {
                                                stats.players[run.player].opponents[opponent.player].wins.push(0)
                                            }
                                        }
                                    }
                                })
                            }
                        })

                        if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type) && winner.player !== null) {
                            if (player_run.hasOwnProperty("time")) {
                                if (player == winner.player) {
                                    player_run.winner = true
                                }

                            }
                            stats.players[winner.player].races.won++
                            stats.players[winner.player].tracks[race.track_selection.track].wins.push(1)
                            stats.players[winner.player].pods[winner.pod].wins.push(1)
                            stats.pods[winner.pod].wins.push(1)
                            if (winner.player == player) {
                                accomp.win.count++
                            }
                            if (winner.player == race.track_selection.player) {
                                stats.tracks[race.track_selection.track].wins.push(1)
                            } else {
                                stats.tracks[race.track_selection.track].wins.push(0)
                            }
                            race.runs.forEach(loser => {
                                if (loser.player !== winner.player) {
                                    stats.players[loser.player].races.lost++
                                    stats.players[loser.player].tracks[race.track_selection.track].wins.push(0)
                                    stats.players[loser.player].pods[loser.pod].wins.push(0)
                                    stats.pods[loser.pod].wins.push(0)
                                    if (loser.player == player) {
                                        accomp.win.streaks.push(accomp.win.count)
                                        accomp.win.count = 0
                                    }
                                }
                            })
                            score[winner.player]++
                        }
                        if (player_run.hasOwnProperty("time")) {
                            player_runs.push(player_run)
                        }
                    })
                    if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                        var match_winner = { player: null, score: null }
                        var scores = Object.keys(score)
                        for (i = 0; i < scores.length; i++) {
                            if (match_winner.score == null || score[scores[i]] > match_winner.score) {
                                match_winner = { player: scores[i], score: score[scores[i]] }
                            }
                        }
                        stats.players[match_winner.player].matches.won++
                        for (i = 0; i < scores.length; i++) {
                            if (scores[i] !== match_winner.player) {
                                stats.players[scores[i]].matches.lost++
                            }
                        }
                    }
                })

                //assemble embed
                var ranks = tools.getRanks()
                if (stats.matches.total > 0) {
                    if (player == "global") {
                        tourneyReport
                            .setDescription("⏱️ Total race time: `" + tools.timefix(stats.race_time) + "`\n💀 Average deaths/race: `" + (stats.deaths.reduce((a, b) => { return a + b }) / stats.races.total).toFixed(2) + "`")
                            .addField(":crossed_swords: Matches", "total: `" + stats.matches.total + "`\n" +
                                "qualifying: `" + stats.matches.qual + "`\n" +
                                "winners: `" + stats.matches.winners + "`\n" +
                                "losers: `" + stats.matches.losers + "`", true)
                            .addField(":checkered_flag: Races", "total: `" + stats.races.total + "`\n" +
                                "runbacks: `" + stats.races.runbacks + "`\n" +
                                "dnf: `" + stats.races.dnf + "`", true)
                            .addField(":asterisk: Forces", "total: `" + (Number(stats.forces.skips) + Number(stats.forces.no_upgrades) + Number(stats.forces.pod_ban)) + "`\n" +
                                "skips: `" + stats.forces.skips + "`\n" +
                                "nu: `" + stats.forces.no_upgrades + "`\n" +
                                "pod ban: `" + stats.forces.pod_ban + "`\n", true)
                    } else {
                        var description = ""
                        if (ranks[player] !== undefined) {
                            if (ranks[player].matches >= 4) {
                                description += "⭐ Elo Rating: `" + (ranks[player].rank).toFixed(1) + " ("
                                if (ranks[player].change >= 0) {
                                    description += "🔺" + (ranks[player].change).toFixed(1) + ")`\n"
                                } else {
                                    description += "🔻" + Math.abs((ranks[player].change)).toFixed(1) + ")`\n"
                                }

                            } else if (ranks[player].matches > 0) {
                                description += "⭐ Elo Rating: Unranked\n"
                            }
                        }
                        if (stats.players[player].matches.total > 0) {
                            description += "⏱️ Total race time: `" + tools.timefix(stats.players[player].race_time) + "`\n💀 Average deaths/race: `" + (stats.players[player].deaths.reduce((a, b) => { return a + b }) / stats.players[player].races.total).toFixed(2) + "`"
                        }
                        if (stats.commentators[player] !== undefined) {
                            description += "\n🎙️ Matches commentated: `" + stats.commentators[player].count + "`"
                            if (stats.commentators[player].count > 30) {
                                accomplishments.push("🎙️ Over 30 **Matches Commentated**")
                            }
                        }
                        var ttd = Object.values(tourney_tournaments_data)
                        ttd.forEach(tourney => {
                            if (tourney.standings) {
                                var standings = Object.values(tourney.standings)
                                for (i = 0; i < standings.length && i < 5; i++) {
                                    if (standings[i] == player) {
                                        if (i == 0) {
                                            accomplishments.push(":trophy: **Winner <:P1:671601240228233216>** of " + tourney.name)
                                        } else {
                                            accomplishments.push(":trophy: **Finished " + tools.ordinalSuffix(i) + "** in " + tourney.name)
                                        }
                                    }
                                }
                            }
                            if (tourney.hasOwnProperty("predictions")) {
                                var predictions = Object.values(tourney.predictions)
                                if (predictions.includes(Number(player))) {
                                    accomplishments.push(":crystal_ball: **Best prediction** for " + tourney.name)
                                }
                            }
                        })
                        accomp.win.streaks.push(accomp.win.count)
                        accomp.deathless.streaks.push(accomp.deathless.count)
                        var win_streak = 0, deathless_streak = 0
                        for (i = 0; i < accomp.win.streaks.length; i++) {
                            var streak = accomp.win.streaks[i]
                            if (streak > win_streak) {
                                win_streak = streak
                            }
                        }
                        for (i = 0; i < accomp.deathless.streaks.length; i++) {
                            var streak = accomp.deathless.streaks[i]
                            if (streak > deathless_streak) {
                                deathless_streak = streak
                            }
                        }
                        if (win_streak >= 5) {
                            accomplishments.push(":crown: " + win_streak + " Race **Win Streak**")
                        }
                        if (deathless_streak >= 5) {
                            accomplishments.push(":skull: " + deathless_streak + " Race **Deathless Streak**")
                        }
                        accomp.win.tracks = []
                        accomp.win.pods = []
                        accomp.deathless.tracks = []
                        accomp.deathless.pods = []
                        for (i = 0; i < 25; i++) {
                            if (stats.players[player].pods[i].deaths.length > 0) {
                                if (stats.players[player].pods[i].deaths.reduce((a, b) => { return a + b }) == 0 && stats.players[player].pods[i].deaths.length >= 5) {
                                    accomp.deathless.pods.push(i)
                                }
                            }
                            if (stats.players[player].pods[i].wins.length > 0) {
                                if (!stats.players[player].pods[i].wins.includes(0) && stats.players[player].pods[i].wins.length >= 5) {
                                    accomp.win.pods.push(i)
                                }
                            }
                            if (stats.players[player].tracks[i].deaths.length > 0) {
                                if (stats.players[player].tracks[i].deaths.reduce((a, b) => { return a + b }) == 0 && stats.players[player].tracks[i].deaths.length >= 5) {
                                    accomp.deathless.tracks.push(i)
                                }
                            }
                            if (stats.players[player].tracks[i].wins.length > 0) {
                                if (!stats.players[player].tracks[i].wins.includes(0) && stats.players[player].tracks[i].wins.length >= 5) {
                                    accomp.win.tracks.push(i)
                                }
                            }
                        }
                        function getTrackNicknames(array) {
                            var stringy = []
                            array.forEach(item => {
                                stringy.push(planets[tracks[item].planet].emoji + " " + tracks[item].nickname[0].toUpperCase())
                            })
                            return stringy.join(", ")
                        }
                        function getPodNicknames(array) {
                            var stringy = []
                            array.forEach(item => {
                                stringy.push(racers[item].flag)
                            })
                            return stringy.join(", ")
                        }
                        if (accomp.win.tracks.length > 1) {
                            accomplishments.push(":crown: **Never Lost** on " + getTrackNicknames(accomp.win.tracks))
                        } else if (accomp.win.tracks.length == 1) {
                            accomplishments.push(":crown: **Never Lost** on " + planets[tracks[accomp.win.tracks[0]].planet].emoji + " " + tracks[accomp.win.tracks[0]].name)
                        }
                        if (accomp.win.pods.length > 1) {
                            accomplishments.push(":crown: **Never Lost** as " + getPodNicknames(accomp.win.pods))
                        } else if (accomp.win.pods.length == 1) {
                            accomplishments.push(":crown: **Never Lost** as " + racers[accomp.win.pods[0]].flag + " " + racers[accomp.win.pods[0]].name)
                        }
                        if (accomp.deathless.tracks.length > 1) {
                            accomplishments.push(":skull: **Never Died** on " + getTrackNicknames(accomp.deathless.tracks))
                        } else if (accomp.deathless.tracks.length == 1) {
                            accomplishments.push(":skull: **Never Died** on " + planets[tracks[accomp.deathless.tracks[0]].planet].emoji + " " + tracks[accomp.deathless.tracks[0]].name)
                        }
                        if (accomp.deathless.pods.length > 1) {
                            accomplishments.push(":skull: **Never Died** as " + getPodNicknames(accomp.deathless.pods))
                        } else if (accomp.deathless.pods.length == 1) {
                            accomplishments.push(":skull: **Never Died** as " + racers[accomp.deathless.pods[0]].flag + " " + racers[accomp.deathless.pods[0]].name)
                        }

                        tourneyReport
                            .setDescription(description)
                        if (stats.players[player].matches.total > 0) {
                            tourneyReport
                                .addField(":crossed_swords: Matches", "total: `" + stats.players[player].matches.total + "`\n" +
                                    "won: `" + stats.players[player].matches.won + "`\n" +
                                    "lost: `" + stats.players[player].matches.lost + "`\n" +
                                    "qualifying: `" + stats.players[player].matches.qual + "`\n" +
                                    "winners: `" + stats.players[player].matches.winners + "`\n" +
                                    "losers: `" + stats.players[player].matches.losers + "`", true)
                                .addField(":checkered_flag: Races", "total: `" + stats.players[player].races.total + "`\n" +
                                    "won: `" + stats.players[player].races.won + "`\n" +
                                    "lost: `" + stats.players[player].races.lost + "`\n" +
                                    "runbacks: `" + stats.players[player].races.runbacks + "`\n" +
                                    "dnf: `" + stats.players[player].races.dnf + "`", true)
                                .addField(":asterisk: Forces", "total: `" + (Number(stats.players[player].forces.skips) + Number(stats.players[player].forces.no_upgrades) + Number(stats.players[player].forces.pod_ban)) + "`\n" +
                                    "skips: `" + stats.players[player].forces.skips + "`\n" +
                                    "nu: `" + stats.players[player].forces.no_upgrades + "`\n" +
                                    "pod ban: `" + stats.players[player].forces.pod_ban + "`", true)
                            if (accomplishments.length > 0) {
                                tourneyReport.addField(":medal: Accomplishments", accomplishments.join("\n"), false)
                            }

                        }
                    }

                }
                var components = []
                var track_selections = []
                var racer_selections = []
                var player_selections = []

                //sort player select
                var players = Object.keys(tourney_participants_data)
                players = players.sort(function (a, b) {
                    if (ranks[a] !== undefined && ranks[a].matches >= 4 && ranks[b] !== undefined && ranks[b].matches >= 4) {
                        return Number(ranks[b].rank) - Number(ranks[a].rank)
                    } else if (ranks[a] !== undefined && ranks[a].matches >= 4) {
                        return -1
                    } else if (ranks[b] !== undefined && ranks[b].matches >= 4) {
                        return 1
                    } else if ((ranks[a] !== undefined || stats.players[a].matches.total > 0) && (ranks[b] !== undefined || stats.players[b].matches.total > 0)) {
                        return Number(stats.players[b].matches.total) - Number(stats.players[a].matches.total)
                    } else if ((ranks[a] !== undefined || stats.players[a].matches.total > 0)) {
                        return -1
                    } else if ((ranks[b] !== undefined || stats.players[b].matches.total > 0)) {
                        return 1
                    } else if ((ranks[a] == undefined && stats.commentators[a] !== undefined) && (ranks[b] == undefined && stats.commentators[b] !== undefined)) {
                        return Number(stats.commentators[b].count) - Number(stats.commentators[a].count)
                    } else {
                        return 0
                    }
                })

                for (i = 0 + offset * 23; i < (offset + 1) * 23; i++) {
                    var p = players[i]
                    var option_default = false
                    if (i == 0 + offset * 23 && offset > 0) {
                        player_selections.push(
                            {
                                label: "Previous players...",
                                value: "offset" + (offset - 1),
                            }
                        )
                    }
                    if (i == 0) {
                        if (player == "global") {
                            option_default = true
                        }
                        player_selections.push(
                            {
                                label: "Global Stats",
                                value: "global",
                                description: "get stats for all players",
                                default: option_default,
                                emoji: {
                                    name: "🌐"
                                }
                            }
                        )
                        option_default = false
                    }
                    var description = ""
                    if (player == "global" || p == player) {
                        if (ranks[p] !== undefined && ranks[p].matches >= 4) {
                            description += "⭐ " + ranks[p].rank.toFixed(1) + " "
                        } else if (stats.players[p].matches.total > 0) {
                            description += "⭐ Unranked "
                        }
                        if (stats.players[p].matches.total > 0) {
                            var deaths = stats.players[p].deaths.reduce((a, b) => { return a + b })
                            deaths = (deaths / stats.players[p].races.total).toFixed(2)
                            description += "⚔️ " + stats.players[p].matches.total + " 🏁 " + stats.players[p].races.total
                            if (!isNaN((stats.players[p].races.won + stats.players[p].races.lost))) {
                                description += " 👑 " + Math.round((stats.players[p].races.won / (stats.players[p].races.won + stats.players[p].races.lost)) * 100)
                            } else {
                                description += " 👑 --"
                            }
                            description += "% 💀 " + deaths + " "
                        }
                        if (stats.commentators[p] !== undefined) {
                            description += "🎙️ " + stats.commentators[p].count
                        }
                    } else {
                        if (ranks[player]) {
                            if (ranks[p] && ranks[p].matches >= 4) {
                                var r1 = ranks[player].rank
                                var r2 = ranks[p].rank
                                var p1 = 1 / (1 + 10 ** ((r2 - r1) / 400))
                                //var p2 = 1 - p1
                                function getK(matches) {
                                    var k = 25
                                    if (matches < 26) {
                                        k = 32
                                    }
                                    if (matches < 11) {
                                        k = 40
                                    }
                                    if (matches < 6) {
                                        k = 50
                                    }
                                    return k
                                }
                                var k1 = getK(ranks[player].matches)
                                //var k2 = getK(ranks[p].matches)
                                var potential_win = k1 * (1 - p1)
                                var potential_loss = k1 * (0 - p1)
                                description += "⭐ " + Math.round(p1 * 100) + "% +" + potential_win.toFixed(1) + "/" + potential_loss.toFixed(1) + " "
                            }
                        }
                        if (stats.players[player].opponents[p]) {
                            if (stats.players[player].opponents[p].matches > 0) {
                                description += "⚔️ " + stats.players[player].opponents[p].matches + " 🏁 " + stats.players[player].opponents[p].races + " 👑 " + Math.round(stats.players[player].opponents[p].wins.reduce((a, b) => { return a + b }) * 100 / stats.players[player].opponents[p].wins.length) + "% ⏱️ "
                                var diff = stats.players[player].opponents[p].times.reduce((a, b) => { return a + b }) / stats.players[player].opponents[p].times.length
                                if (diff >= 0) {
                                    //diff = tools.timefix(diff)
                                    description += "+" + Number(diff).toFixed(1) + " "
                                } else {
                                    //diff = tools.timefix(diff)
                                    description += Number(diff).toFixed(1) + " "
                                }
                            }
                        }
                        if (stats.commentators[player] !== undefined) {
                            if (stats.commentators[player].cocomm[p] || stats.commentators[player].comfor[p]) {
                                description += "🎙️ "
                                if (stats.commentators[player].cocomm[p]) {
                                    description += stats.commentators[player].cocomm[p]
                                } else {
                                    description += "0"
                                }
                                description += "/"
                                if (stats.commentators[player].comfor[p]) {
                                    description += stats.commentators[player].comfor[p]
                                } else {
                                    description += "0"
                                }
                            }
                        }
                    }
                    if (p == player) {
                        option_default = true
                    }
                    var prefix = ""
                    var pos = ["1st", "2nd", "3rd"]
                    var emojis = [{ name: "P1", id: "671601240228233216" }, { name: "P2", id: "671601321257992204" }, { name: "P3", id: "671601364794605570" }, { name: "4️⃣" }, { name: "5️⃣" }, { name: "6️⃣" }, { name: "7️⃣" }, { name: "8️⃣" }, { name: "9️⃣" }, { name: "🔟" }]
                    var emoji = {}
                    if (i < 10) {
                        if (i < 3) {
                            prefix = pos[i] + " - "
                        } else {
                            prefix = tools.ordinalSuffix(i) + " - "
                        }
                        emoji = emojis[i]
                    } else if (ranks[p] !== undefined && ranks[p].matches >= 4) {
                        prefix = tools.ordinalSuffix(i) + " - "
                    }
                    player_selections.push(
                        {
                            label: prefix + tourney_participants_data[p].name,
                            value: p,
                            description: description,
                            default: option_default,
                            emoji: emoji
                        }
                    )

                    if (i == players.length - 1) {
                        i = (offset + 1) * 23
                    }
                    if (i == (offset + 1) * 23 - 1) {
                        player_selections.push(
                            {
                                label: "More players...",
                                value: "offset" + (offset + 1),
                            }
                        )
                    }
                }
                var sort_selections = [
                    {
                        label: "Sort by Plays",
                        value: "plays",
                        description: "sort by total number of plays descending",
                        emoji: { name: "▶️" }
                    },
                    {
                        label: "Sort by Pick Rate",
                        value: "picks",
                        description: "sort by pick rate descending",
                        emoji: { name: "👆" }
                    },
                    {
                        label: "Sort by Ban Rate",
                        value: "bans",
                        description: "sort by ban rate descending",
                        emoji: { name: "❌" }
                    },
                    {
                        label: "Sort by Win Rate",
                        value: "wins",
                        description: "sort by race win rate descending",
                        emoji: { name: "👑" }
                    },
                    {
                        label: "Sort by Avg. Deaths",
                        value: "deaths",
                        description: "sort by average deaths per race descending",
                        emoji: { name: "💀" }
                    },
                    {
                        label: "Sort by No Upgrades",
                        value: "nu",
                        description: "sort by plays featuring the No Upgrades condition",
                        emoji: { name: "🐢" }
                    },
                    {
                        label: "Sort by Skips",
                        value: "skips",
                        description: "sort by plays featuring the Skips condition",
                        emoji: { name: "⏩" }
                    },
                    {
                        label: "Sort by Game Order",
                        value: "game",
                        description: "sort by appearance in game selection menu",
                        emoji: { name: "🔢" }
                    },
                    {
                        label: "Sort Alphabetically",
                        value: "alpha",
                        description: "sort alphabetically by name",
                        emoji: { name: "🔤" }
                    }
                ]
                sort_selections.forEach(option => {
                    if (option.value == sort) {
                        option.default = true
                    }
                })
                for (var i = 0; i < 25; i++) {
                    var description = ""
                    if (player == "global") {
                        description += "▶️ " + stats.pods[i].plays +
                            " (" + Math.round((stats.pods[i].plays / stats.races.total) * 100) + "%)"
                        if (stats.pods[i].picks.length > 0) {
                            description += " 👆 " + Math.round((stats.pods[i].picks.reduce((a, b) => { return a + b }) / stats.pods[i].picks.length) * 100) + "%"
                        } else {
                            description += " 👆 --%"
                        }
                        if (stats.pods[i].bans.length > 0) {
                            description += " ❌ " + Math.round((stats.pods[i].bans.reduce((a, b) => { return a + b }) / stats.pods[i].bans.length) * 100) + "%"
                        } else {
                            description += " ❌ --%"
                        }
                        if (stats.pods[i].wins.length > 0) {
                            description += " 👑 " + Math.round((stats.pods[i].wins.reduce((a, b) => { return a + b }) / stats.pods[i].wins.length) * 100) + "%"
                        } else {
                            description += " 👑 --%"
                        }
                        if (stats.pods[i].deaths.length > 0) {
                            description += " 💀 " + (stats.pods[i].deaths.reduce((a, b) => { return a + b }) / stats.pods[i].deaths.length).toFixed(2)
                        } else {
                            description += " 💀 --"
                        }
                        if (stats.pods[i].nu > 0) {
                            description += " 🐢  " + stats.pods[i].nu
                        }
                        if (stats.pods[i].skips > 0) {
                            description += " ⏩  " + stats.pods[i].skips
                        }
                    } else {
                        description += "▶️ " + stats.players[player].pods[i].plays +
                            " (" + Math.round((stats.players[player].pods[i].plays / stats.players[player].races.total) * 100) + "%)"
                        if (stats.players[player].pods[i].picks.length > 0) {
                            description += " 👆 " + Math.round((stats.players[player].pods[i].picks.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].picks.length) * 100) + "%"
                        } else {
                            description += " 👆 --%"
                        }
                        if (stats.players[player].pods[i].bans.length > 0) {
                            description += " ❌ " + Math.round((stats.players[player].pods[i].bans.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].bans.length) * 100) + "%"
                        } else {
                            description += " ❌ --%"
                        }
                        if (stats.players[player].pods[i].wins.length > 0) {
                            description += " 👑 " + Math.round((stats.players[player].pods[i].wins.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].wins.length) * 100) + "%"
                        } else {
                            description += " 👑 --%"
                        }
                        if (stats.players[player].pods[i].deaths.length > 0) {
                            description += " 💀 " + (stats.players[player].pods[i].deaths.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].deaths.length).toFixed(2)
                        } else {
                            description += " 💀 --"
                        }
                        if (stats.players[player].pods[i].nu > 0) {
                            description += " 🐢  " + stats.players[player].pods[i].nu
                        }
                        if (stats.players[player].pods[i].skips > 0) {
                            description += " ⏩  " + stats.players[player].pods[i].skips
                        }
                    }
                    var racer_option = {
                        label: racers[i].name,
                        value: i,
                        description: description,
                        emoji: {
                            name: racers[i].flag.split(":")[1],
                            id: racers[i].flag.split(":")[2].replace(">", "")
                        }
                    }
                    var description = ""
                    if (player == "global") {
                        description += "▶️ " + stats.tracks[i].plays +
                            " (" + Math.round((stats.tracks[i].plays / stats.races.total) * 100) + "%)"
                        if (stats.tracks[i].picks.length > 0) {
                            description += " 👆 " + Math.round((stats.tracks[i].picks.reduce((a, b) => { return a + b }) / stats.tracks[i].picks.length) * 100) + "%"
                        } else {
                            description += " 👆 --%"
                        }
                        if (stats.tracks[i].bans.length > 0) {
                            description += " ❌ " + Math.round((stats.tracks[i].bans.reduce((a, b) => { return a + b }) / stats.tracks[i].bans.length) * 100) + "%"
                        } else {
                            description += " ❌ --%"
                        }
                        if (stats.tracks[i].wins.length > 0) {
                            description += " 👑 " + Math.round((stats.tracks[i].wins.reduce((a, b) => { return a + b }) / stats.tracks[i].wins.length) * 100) + "%"
                        } else {
                            description += " 👑 --%"
                        }
                        if (stats.tracks[i].deaths.length > 0) {
                            description += " 💀 " + (stats.tracks[i].deaths.reduce((a, b) => { return a + b }) / stats.tracks[i].deaths.length).toFixed(2)
                        } else {
                            description += " 💀 --"
                        }

                        if (stats.tracks[i].nu > 0) {
                            description += " 🐢  " + stats.tracks[i].nu
                        }
                        if (stats.tracks[i].skips > 0) {
                            description += " ⏩  " + stats.tracks[i].skips
                        }
                        if (stats.tracks[i].runbacks > 0) {
                            description += " 🔁  " + stats.tracks[i].runbacks
                        }
                    } else {
                        description += "▶️ " + stats.players[player].tracks[i].plays +
                            " (" + Math.round((stats.players[player].tracks[i].plays / stats.players[player].races.total) * 100) + "%)"
                        if (stats.players[player].tracks[i].picks.length > 0) {
                            description += " 👆 " + Math.round((stats.players[player].tracks[i].picks.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].picks.length) * 100) + "%"
                        } else {
                            description += " 👆 --%"
                        }
                        if (stats.players[player].tracks[i].bans.length > 0) {
                            description += " ❌ " + Math.round((stats.players[player].tracks[i].bans.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].bans.length) * 100) + "%"
                        } else {
                            description += " ❌ --%"
                        }
                        if (stats.players[player].tracks[i].wins.length > 0) {
                            description += " 👑 " + Math.round((stats.players[player].tracks[i].wins.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].wins.length) * 100) + "%"
                        } else {
                            description += " 👑 --%"
                        }
                        if (stats.players[player].tracks[i].deaths.length > 0) {
                            description += " 💀 " + (stats.players[player].tracks[i].deaths.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].deaths.length).toFixed(2)
                        } else {
                            description += " 💀 --"
                        }

                        if (stats.players[player].tracks[i].nu > 0) {
                            description += " 🐢  " + stats.players[player].tracks[i].nu
                        }
                        if (stats.players[player].tracks[i].skips > 0) {
                            description += " ⏩  " + stats.players[player].tracks[i].skips
                        }
                        if (stats.players[player].tracks[i].runbacks > 0) {
                            description += " 🔁  " + stats.players[player].tracks[i].runbacks
                        }
                    }
                    var track_option = {
                        label: tracks[i].name,
                        value: i,
                        description: description,
                        emoji: {
                            name: planets[tracks[i].planet].emoji.split(":")[1],
                            id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                        }
                    }
                    if (Number(track) == i && track !== null) {
                        track_option.default = true
                    }
                    racer_selections.push(racer_option)
                    track_selections.push(track_option)
                }
                function getSort(array_a, array_b) {
                    if (array_a.length == 0 && array_b.length == 0) {
                        return 0
                    } else if (array_a.length == 0) {
                        return 1
                    } else if (array_b.length == 0) {
                        return -1
                    } else {
                        return array_b.reduce((a, b) => { return a + b }) / array_b.length - array_a.reduce((a, b) => { return a + b }) / array_a.length
                    }
                }
                racer_selections = racer_selections.sort(function (a, b) {
                    return stats.pods[b.value].plays - stats.pods[a.value].plays
                })
                track_selections = track_selections.sort(function (a, b) {
                    return stats.tracks[b.value].plays - stats.tracks[a.value].plays
                })
                if (player == "global") {
                    if (sort == "plays") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.pods[b.value].plays - stats.pods[a.value].plays
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.tracks[b.value].plays - stats.tracks[a.value].plays
                        })
                    } else if (sort == "picks") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.pods[a.value].picks, stats.pods[b.value].picks)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.tracks[a.value].picks, stats.tracks[b.value].picks)
                        })
                    } else if (sort == "bans") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.pods[a.value].bans, stats.pods[b.value].bans)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.tracks[a.value].bans, stats.tracks[b.value].bans)
                        })
                    } else if (sort == "wins") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.pods[a.value].wins, stats.pods[b.value].wins)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.tracks[a.value].wins, stats.tracks[b.value].wins)
                        })
                    } else if (sort == "deaths") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.pods[a.value].deaths, stats.pods[b.value].deaths)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.tracks[a.value].deaths, stats.tracks[b.value].deaths)
                        })
                    } else if (sort == "nu") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.pods[b.value].nu - stats.pods[a.value].nu
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.tracks[b.value].nu - stats.tracks[a.value].nu
                        })
                    } else if (sort == "skips") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.pods[b.value].skips - stats.pods[a.value].skips
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.tracks[b.value].skips - stats.tracks[a.value].skips
                        })
                    } else if (sort == "game") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return Number(a.value) - Number(b.value)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return Number(a.value) - Number(b.value)
                        })
                    } else if (sort == "alpha") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            var a_stuff = racers[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            var b_stuff = racers[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            var a_stuff = tracks[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            var b_stuff = tracks[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                    }
                } else {
                    if (sort == "plays") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.players[player].pods[b.value].plays - stats.players[player].pods[a.value].plays
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.players[player].tracks[b.value].plays - stats.players[player].tracks[a.value].plays
                        })
                    } else if (sort == "picks") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.players[player].pods[a.value].picks, stats.players[player].pods[b.value].picks)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.players[player].tracks[a.value].picks, stats.players[player].tracks[b.value].picks)
                        })
                    } else if (sort == "bans") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.players[player].pods[a.value].bans, stats.players[player].pods[b.value].bans)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.players[player].tracks[a.value].bans, stats.players[player].tracks[b.value].bans)
                        })
                    } else if (sort == "wins") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.players[player].pods[a.value].wins, stats.players[player].pods[b.value].wins)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.players[player].tracks[a.value].wins, stats.players[player].tracks[b.value].wins)
                        })
                    } else if (sort == "deaths") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.players[player].pods[a.value].deaths, stats.players[player].pods[b.value].deaths)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.players[player].tracks[a.value].deaths, stats.players[player].tracks[b.value].deaths)
                        })
                    } else if (sort == "nu") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.players[player].pods[b.value].nu - stats.players[player].pods[a.value].nu
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.players[player].tracks[b.value].nu - stats.players[player].tracks[a.value].nu
                        })
                    } else if (sort == "skips") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.players[player].pods[b.value].skips - stats.players[player].pods[a.value].skips
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.players[player].tracks[b.value].skips - stats.players[player].tracks[a.value].skips
                        })
                    } else if (sort == "game") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return Number(a.value) - Number(b.value)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return Number(a.value) - Number(b.value)
                        })
                    } else if (sort == "alpha") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            var a_stuff = racers[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            var b_stuff = racers[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            var a_stuff = tracks[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            var b_stuff = tracks[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                    }
                }
                var components = []
                components.push(
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_stats_player",
                                options: player_selections,
                                placeholder: "Select Player",
                                min_values: 1,
                                max_values: 1
                            },
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_stats_sort",
                                options: sort_selections,
                                placeholder: "Sort Options",
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
                                custom_id: "tourney_stats_tracks",
                                options: track_selections,
                                placeholder: "View Track Stats",
                                min_values: 0,
                                max_values: 1
                            },
                        ]
                    }
                )
                if (track == null) {
                    console.log(racer_selections)
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_stats_pods",
                                options: racer_selections,
                                placeholder: "View Pod Stats",
                                min_values: 0,
                                max_values: 1
                            }
                        ]
                    })
                } else {
                    console.log(player_runs)
                    var run_list = []
                    player_runs = player_runs.sort(function (a, b) {
                        if (a.time == "DNF" && b.time == "DNF") {
                            return 0
                        } else if (a.time == "DNF") {
                            return 1
                        } else if (b.time == "DNF") {
                            return -1
                        } else {
                            return Number(a.time) - Number(b.time);
                        }
                    })
                    for (i = 0; i < player_runs.length && i < 25; i++) {
                        var run_option = {
                            label: tools.timefix(player_runs[i].time) + " ",
                            value: i,
                            description: "⚔️ " + player_runs[i].match + " 🏁 Race " + player_runs[i].race
                        }
                        if (player_runs[i].deaths == 1) {
                            run_option.label += "💀"
                        } else if (player_runs[i].deaths > 1) {
                            run_option.label += "💀×" + player_runs[i].deaths + " "
                        }
                        var condemojis = { skips: "⏩", nu: "🐢" }
                        player_runs[i].conditions.forEach(condition => {
                            run_option.label += condemojis[condition]
                        })
                        if (player_runs[i].pick) {
                            run_option.label += "👆"
                        }
                        if (player_runs[i].winner) {
                            run_option.label += "👑"
                        }
                        if (player_runs[i].temppod.length > 0) {
                            run_option.label += " ❌"
                            player_runs[i].temppod.forEach(ban => {
                                run_option.label += racers[ban].nickname[1]
                            })
                        }
                        if (player_runs[i].opponents.length > 0) {
                            run_option.description += " vs "
                            var opponents = []
                            player_runs[i].opponents.forEach(opponent => {
                                if (Number(opponent) !== Number(player)) {
                                    opponents.push(tourney_participants_data[opponent].name)
                                }

                            })
                            run_option.description += opponents.join(", ")
                        }
                        if (player_runs[i].pod !== undefined) {
                            run_option.emoji = {
                                name: racers[player_runs[i].pod].flag.split(":")[1],
                                id: racers[player_runs[i].pod].flag.split(":")[2].replace(">", "")
                            }
                        }
                        run_list.push(run_option)
                    }
                    if (run_list.length > 0) {
                        components.push({
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_stats_runs",
                                    options: run_list,
                                    placeholder: "View Runs",
                                    min_values: 0,
                                    max_values: 1
                                }
                            ]
                        })
                    }
                }
                return [tourneyReport, components]
            }).then((embed) => sendResponse(embed))
        }
    }
}
