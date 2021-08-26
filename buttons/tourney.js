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
                            track = i
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
                            pods.push(String(i))
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
                conditions = ["mu", "nu", "muft", "skips", "deaths", "deathless"]
            }
            //prepare filters
            var forces = [], user = null, qual = false, deaths = []
            if (conditions.includes("muft")) {
                forces.push("")
            }
            if (conditions.includes("nu")) {
                forces.push("NU")
            }
            if (conditions.includes("skips")) {
                forces.push("Skips")
            }
            if (conditions.includes("qual")) {
                qual = true
            }
            if (conditions.includes("deaths")) {
                deaths.push(true)
            }
            if (conditions.includes("deathless")) {
                deaths.push(false)
            }
            if (conditions.includes("user")) {
                user = interaction.member.user.id
            }
            //account for missing values
            if (deaths.length == 0) { deaths.push(true, false), conditions.push("deaths", "deathless") }
            if (forces.length == 0) { forces.push("", "NU", "Skips"), conditions.push("muft", "nu", "skips") }
            //get runs and apply filters
            var runs = []

            var rns = Object.keys(tourney_races_data)
            for (var i = 0; i < rns.length; i++) {
                var r = tourney_races_data[rns[i]]
                if (r.track == track && r.hasOwnProperty("totaltime")) {
                    runs.push(r)
                }
            }
            runs = runs.filter(e => forces.includes(e.force))
            if (!deaths.includes(true)) {
                runs = runs.filter(e => e.totaldeaths == 0)
            } else if (!deaths.includes(false)) {
                runs = runs.filter(e => e.totaldeaths > 0)
            }
            if (pods.length > 0) {
                runs = runs.filter(e => pods.includes(String(e.pod)))
            }
            if (user !== null) {
                runs = runs.filter(e => tourney_participants_data[e.player].id == user)
            }
            if (qual === false) {
                runs = runs.filter(e => tourney_matches_data[e.datetime].bracket !== "Qual")
            }
            runs.sort(function (a, b) {
                return Number(a.totaltime) - Number(b.totaltime);
            })

            //create embed
            tourneyReport
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/crossed-swords_2694-fe0f.png")
                .setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name)
                .setColor(planets[tracks[track].planet].color)
                .setDescription(circuits[tracks[track].circuit].name + " Circuit | Race " + tracks[track].cirnum + " | " + planets[tracks[track].planet].name)
                .setFooter(runs.length + " Total Runs")
            if (user !== null) {
                const Guild = client.guilds.cache.get(interaction.guild_id);
                const Member = Guild.members.cache.get(user)
                tourneyReport.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guild_id).members.resolve(user).user.avatarURL())
                showall = true
            }
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            var already = []
            if (runs.length > 0) {
                for (i = 0; i < runs.length; i++) {
                    if (runs[i].hasOwnProperty("totaltime") && !already.includes(runs[i].player + runs[i].force)) {
                        var character = ""
                        var deaths = ""
                        var characterban = ""
                        var link = ""
                        var forc = "MU "
                        var opponent = ""
                        var bracket = ""
                        if (runs[i].hasOwnProperty("force")) {
                            if (runs[i].force == "Skips") {
                                forc = "Skips "
                            } else if (runs[i].force == "NU") {
                                forc = "NU "
                            }
                        }
                        link = tourney_matches_data[runs[i].datetime].url
                        if (runs[i].hasOwnProperty("podtempban")) {
                            if (!["", "none"].includes(runs[i].podtempban)) {
                                characterban = "\n~~" + racers[runs[i].podtempban].name + "~~"
                            }
                        }
                        if (runs[i].hasOwnProperty("opponent")) {
                            opponent = " vs " + tourney_participants_data[runs[i].opponent].name
                        }
                        if (runs[i].totaldeaths > 0) {
                            if (runs[i].totaldeaths > 1) {
                                deaths = ":skull:×" + runs[i].totaldeaths
                            } else {
                                deaths = ":skull:"
                            }
                        }
                        if (![undefined, "", null].includes(tourney_matches_data[runs[i].datetime].bracket)) {
                            bracket = " | " + tourney_matches_data[runs[i].datetime].bracket
                            if (![undefined, "", null].includes(tourney_matches_data[runs[i].datetime].round)) {
                                bracket += ": " + tourney_matches_data[runs[i].datetime].round
                            }
                        }
                        character = racers[runs[i].pod].flag
                        tourneyReport
                            .addField(pos[0] + " " + tourney_participants_data[runs[i].player].name, tourney_tournaments_data[tourney_matches_data[runs[i].datetime].tourney].nickname + bracket + "\n[Race " + runs[i].race + opponent + "](" + link + ")", true)
                            .addField(tools.timefix(Number(runs[i].totaltime).toFixed(3)), " " + character + " " + forc + " " + deaths + characterban, true)
                            .addField('\u200B', '\u200B', true)
                        if (showall == false) { already.push(runs[i].player + runs[i].force) }
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
            var cond = { muft: "Upgrades/Full Track", nu: "No Upgrades", skips: "Skips", deaths: "Deaths", deathless: "Deathless", qual: "Include Qualifying Runs", user: "My Runs Only" }
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
                if (pods.includes(String(i))) {
                    racer_option.default = true
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
                if (track == i) {
                    track_option.default = true
                }
                if (i < 23) {
                    racer_selections.push(racer_option)
                }
                track_selections.push(track_option)
                var condkeys = Object.keys(cond)
                if (i < condkeys.length) {
                    var cond_option = {
                        label: cond[condkeys[i]],
                        value: condkeys[i],
                    }
                    if (conditions.includes(condkeys[i])) {
                        cond_option.default = true
                    }
                    cond_selections.push(cond_option)
                }
            }
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
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/crossed-swords_2694-fe0f.png")

            function showRuleset(ruleset) {
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
                function podSelection(collection){
                    var result = null
                    if (collection.length == 23) {
                        result = "`Any Pod`"
                    } else {
                        var pods = []
                        var missing_pods = []
                        for (i = 0; i < 23; i++) {
                            if (collection.includes(String(i))) {
                                pods.push(racers[i].flag)
                            } else {
                                missing_pods.push("No " + racers[i].flag)
                            }
                        }
                        if (missing_pods.length < pods.length) {
                            result = missing_pods.join(", ")
                        } else {
                            result = pods.join("")
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
                    field.value = winstring.join(" ")
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
                } else if (ruleset.type == "1vall"){
                    rulesetEmbed
                        .setDescription("Ruleset Type: 1vAll")
                    var fields = []
                    var ruleset = tourney_rulesets_data.new[interaction.member.user.id]
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
                    field = {name: '\u200B', value: '\u200B', inline: true}
                    fields.push(field)
                    //races
                    for(i = 0; i < ruleset.racenum; i++){
                        field = {}
                        field.name = ":triangular_flag_on_post: Race " + (i+1)
                        field.value = "Track: `" + tracks[Number(ruleset.races[i].track)].name + "`\n"
                        var cons = []
                        for(j = 0; j < ruleset.races[i].conditions.length; j++){
                            cons.push("`" + conditions[ruleset.races[i].conditions[j]] + "`")
                        }
                        field.value += "Conditions: " + cons.join(" ") + "\n"
                        if(["player_pick", "limited_choice"].includes(tourney_rulesets_data.new[interaction.member.user.id].podmethod)){
                            field.value += "Pods: " + podSelection(ruleset.races[i].pods)
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
                            flags: 64,
                            data: {
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
                }
                type = 4
                flags = 64
            } else if (args[1] == "clone") {
                var key = args.slice(2).join("_")
                var ruleset = tourney_rulesets_data.saved[key]
                tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                args[1] = "new"
                args[2] = "general"
                type = 4
                flags = 64
            } else if (args[1] == "delete") {
                var key = args.slice(2).join("_")
                var ruleset = tourney_rulesets_data.saved[key]
                if (ruleset.author !== interaction.member.user.id) {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            flags: 64,
                            data: {
                                content: "Only the ruleset author can edit or delete their ruleset."
                            }
                        }
                    })
                    return
                } else {
                    var key = args.slice(2).join("_")
                    tourney_rulesets.child("saved").child(key).remove()
                    args[1] = "browse"
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
                if (![undefined, null].includes(tourney_rulesets_data.saved)) {
                    var saved = Object.keys(tourney_rulesets_data.saved)
                    var rulesets = []
                    saved = saved.sort(function (a, b) {
                        return tourney_rulesets_data.saved[b].name - tourney_rulesets_data.saved[a].name;
                    })
                    for (i = 0; i < saved.length; i++) {
                        var s = saved[i]
                        var r = {
                            label: tourney_rulesets_data.saved[s].name,
                            value: s,
                            description: tourney_rulesets_data.saved[s].type + " Ruleset by " + client.guilds.resolve(interaction.guild_id).members.resolve(tourney_rulesets_data.saved[s].author).user.username,
                        }
                        if (interaction.data.hasOwnProperty("values")) {
                            if (r.value == interaction.data.values[0]) {
                                r.default = true
                            }
                        }

                        rulesets.push(r)
                    }
                    if (interaction.data.hasOwnProperty("values")) {
                        var ruleset = tourney_rulesets_data.saved[interaction.data.values[0]]
                        rulesetEmbed.setTitle(":scroll: Rulesets: " + ruleset.name)
                            .setDescription("Type: " + ruleset.type)
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
                        } else if (tourney_rulesets_data.new.hasOwnProperty(interaction.member.user.id)) {
                            rulesetEmbed
                                .setTitle(":exclamation: Unsaved Ruleset: " + tourney_rulesets_data.new[interaction.member.user.id].name)
                                .setDescription("You have an unsaved " + tourney_rulesets_data.new[interaction.member.user.id].type + " ruleset. Would you like to continue editing that one or start a new one?")

                            var next = "general"
                            if(tourney_rulesets_data.new[interaction.member.user.id].type == "1vall"){
                                next = "1vall"
                            } else if(tourney_rulesets_data.new[interaction.member.user.id].type == "qual"){
                                next = "qual"
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
                        label: "Qualifier",
                        value: "qual",
                        description: "Players have a set time limit to get their best time with multiple attempts"
                    },
                    {
                        label: "1v1",
                        value: "1v1",
                        description: "Players face off until one satisfies the win conditions"
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
                    if (ruleset_type == "qual") {
                        ruleset = {
                            type: "qual",
                            podmethod: "player_pick",
                            races: []
                        }
                        args[2] = "qual"
                    } else if (ruleset_type == "1v1") {
                        ruleset = {
                            type: "1v1",
                            name: interaction.member.user.username + "'s Unnamed 1v1 Ruleset",
                            author: interaction.member.user.id,
                            wins: ["5_max"],
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
                    } if (ruleset_type == "1vall") {
                        ruleset = {
                            type: "1vall",
                            name: interaction.member.user.username + "'s Unnamed 1v1 Ruleset",
                            author: interaction.member.user.id,
                            podmethod: "player_pick",
                            poollimit: 1,
                            racenum: 7,
                            races: []
                        }
                        for(i = 0; i < 14; i++){
                            ruleset.races.push(
                                {
                                    track: String(i),
                                    conditions: ["mu", "ft", "um", "l3"],
                                    pods: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"]
                                }
                            )
                        }
                        args[2] = "1vall"
                    } //if (ruleset_type == "team") {}
                    if (ruleset !== {}) {
                        tourney_rulesets.child("new").child(interaction.member.user.id).set(ruleset)
                    }
                    
                }

                if (args[2] == "navigate") {
                    args[2] = interaction.data.values[0]
                } else if (![undefined, "initial", "rename", "save", "races"].includes(args[3])) {
                    var data = interaction.data.values
                    if(args[2].includes("race")){
                        
                        var race = Number(args[2].replace("race", "")) -1 
                        var races = tourney_rulesets_data.new[interaction.member.user.id].races
                        if(args[3] == "track"){
                            data = interaction.data.values[0]
                            races[race].track = data
                        } else if(args[3] == "conditions"){
                            races[race].conditions = data
                        } else if(args[3] == "pods"){
                            races[race].pods = data
                        }
                        tourney_rulesets.child("new").child(interaction.member.user.id).child(races).update(races)
                    } else {
                        if (!["default", "firsttrack", "podpods", "tracktracks", "conoptions", "ttrackmlimit", "tpodmlimit", "tconmlimit", "wins"].includes(args[3])) {
                            data = interaction.data.values[0]
                        }
                        tourney_rulesets.child("new").child(interaction.member.user.id).child(args[3]).set(data)
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
                } else if (ruleset.type == "1vall") {
                    var options = [
                        {
                            label: "General Settings",
                            value: "1vall",
                            emoji: { name: "🔷" },
                            description: "set number of races and pod selection options",
                        }
                    ]
                    var races = Object.values(tourney_rulesets_data.new[interaction.member.user.id].races)
                    for (i = 0; i < Number(tourney_rulesets_data.new[interaction.member.user.id].racenum); i++) {
                        options.push(
                            {
                                label: "Race " + (i+1),
                                value: "race" + (i + 1),
                                emoji: { name: "🏁" },
                                description: tracks[races[i].track],
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
                }


                rulesetEmbed
                    .setTitle(tourney_rulesets_data.new[interaction.member.user.id].name)
                    .setFooter(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())

                if (![null, undefined].includes(tourney_rulesets_data)) {
                    if (![null, undefined].includes(tourney_rulesets_data.new)) {
                        rulesetEmbed.addFields(showRuleset(tourney_rulesets_data.new[interaction.member.user.id]))
                    }
                }

                if (args[2] == "general") {
                    var win_options = []
                    for (i = 2; i < 8; i++) {
                        win_options.push(
                            {
                                label: i + " Wins Max",
                                value: i + "_max",
                                description: "if no other condition is met, fist to " + i + " wins the match"
                            }
                        )
                    }
                    for (i = 2; i < 8; i++) {
                        win_options.push(
                            {
                                label: i + " Wins Minimum",
                                value: i + "_min",
                                description: "in addition to other conditions, at least " + i + " is required to win"
                            })
                    }
                    for (i = 2; i < 8; i++) {
                        win_options.push(
                            {
                                label: i + " Wins in a Row",
                                value: i + "_row",
                                description: "winner must get " + i + " sequential wins"
                            })
                    }
                    for (i = 2; i < 8; i++) {
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
                            description: "players can repeat a track only if they haven’t won"
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
                            description: "repeat tracks must use the default track conditions"
                        },
                        {
                            label: "Hard Repeat",
                            value: "hard_repeat",
                            description: "repeat tracks must use the same track conditions as originally used"
                        },
                        {
                            label: "Soft Repeat",
                            value: "soft_repeat",
                            description: "repeat tracks may have different track conditions than originally used"
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
                                        max_values: 13
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
                            tourney_rulesets.child("new").child(interaction.member.user.id).child("name").set(message.content)
                            rulesetEmbed.setTitle(message.content)
                            components[1].components[0].disabled = false
                            message.delete().then(sendResponse())
                        })
                        //client.api.interactions(interaction.id, interaction.token).callback.post({ data: { type: 6, data: {} } })
                        //return
                    } else if (args[3] == "save") {
                        type = 7
                        rulesetEmbed
                            .setTitle("Ruleset Saved")
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


                } else if (args[2] == "qual") {
                    //pod select
                    //add race

                    //time limit
                    //penalty time
                } else if (args[2] == "1vall") {
                    var race_options = []
                    for (i = 3; i < 14; i++) {
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
                                    custom_id: "tourney_rulesets_new_1vall_races",
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
                                    custom_id: "tourney_rulesets_new_1vall_podmethod",
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
                                    min_values: 4,
                                    max_values: 4
                                }
                            ]
                        }
                    )
                    if(["player_pick", "limited_choice"].includes(tourney_rulesets_data.new[interaction.member.user.id].podmethod)){
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
                   
                    //time limit
                    //penalty time
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
