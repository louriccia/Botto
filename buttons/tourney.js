module.exports = {
    name: 'tourney',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        let tools = require('./../tools.js');
        let admin = require('firebase-admin');
        let database = admin.database();
        let firebase = require("firebase/app");
        let tourney_rulesets = database.ref('tourney/rulesets');
        let tourney_rulesets_data = {}, tourney_races_data = {}, tourney_matches_data = {}, tourney_participants_data = {}, tourney_tournaments_data = {}, tourney_live_data = {}
        tourney_rulesets.on("value", function (snapshot) {
            tourney_rulesets_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        let tourney_matches = database.ref('tourney/matches')
        tourney_matches.on("value", function (snapshot) {
            tourney_matches_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        let tourney_participants = database.ref('tourney/participants')
        tourney_participants.on("value", function (snapshot) {
            tourney_participants_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        let tourney_tournaments = database.ref('tourney/tournaments')
        tourney_tournaments.on("value", function (snapshot) {
            tourney_tournaments_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        let tourney_races = database.ref('tourney/races');
        tourney_races.on("value", function (snapshot) {
            tourney_races_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        const Guild = client.guilds.cache.get(interaction.guild_id)

        function rulesetOverview(ruleset) {
            let conditions = {
                mu: "Upgrades Allowed",
                nu: "No Upgrades",
                ft: "Full Track",
                sk: "Skips",
                tt: "Total Time",
                fl: "Fastest Lap",
                um: "Unmirrored",
                mi: "Mirrored",
                l1: "1 Lap",
                l2: "2 Laps",
                l3: "3 Laps",
                l4: "4 Laps",
                l5: "5 Laps",
            }
            let methods = {
                poe_c: "Process of Elimination by Circuit",
                poe_p: "Process of Elimination by Planet",
                poe_t: "Process of Elimination by Track",
                random: "Random"
            }
            let choices = {
                firstloser: "🇱 Loser of first race",
                firstwinner: "👑 Winner of first race",
                both: "👥 Both players",
                lastloser: "🇱 Loser of last race",
                lastwinner: "👑 Winner of last race",
                player: "👥 Each player"
            }
            let events = {
                tempban: "❌ Temporarily Bans",
                selection: "👆 Selects",
                override: "✳️ Overrides"
            }
            let fields = []
            if (ruleset.general && ruleset.general.type == "1v1") {
                let genfield = { name: "General", value: "", inline: false }
                genfield.value = "👑 First to **" + ruleset.general.winlimit + " Wins**" + "\n" +
                    "**⚙️ Default Conditions**: " + Object.values(ruleset.general.default).map(con => "`" + conditions[con] + "`").join(", ") + "\n" +
                    "**🎩 Gentleman's Agreement** is " + (ruleset.general.gents == true ? "" : "*not* ") + "permitted" + "\n" +
                    "**⭐ Elo Rating** is " + (ruleset.general.ranked == true ? "" : "*not* ") + "affected" + "\n" +
                    "**1️⃣ First Track** can be " + (Object.values(ruleset.general.firsttrack.options).length == 4 ? "any track" : "a track from " + Object.values(ruleset.general.firsttrack.options).map(circuit => "`" + circuit.toUpperCase() + "` ")) + "\n" +
                    "**1️⃣ First Track** will be selected by " + methods[ruleset.general.firsttrack.primary] + "\n" +
                    ([undefined, null].includes(ruleset.general.firsttrack.secondary) ? "" : "◉ Alternatively, players may agree to select the **1️⃣ First Track** by " + Object.values(ruleset.general.firsttrack.secondary).map(method => "`" + methods[method] + "` "))

                let matchfield = { name: "Every Match", value: "", inline: false }
                matchfield.value = (ruleset.match.forcepoints.start > 0 && "👥 Both players start with `" + ruleset.match.forcepoints.start + "` **💠 Force Points** (`" + ruleset.match.forcepoints.max + " max`)" + "\n") +
                    (ruleset.match.permabans && Object.values(ruleset.match.permabans).map(ban => choices[ban.choice] + " **🚫 Permanently Bans** " + ban.limit + " " + ban.type + " (`" + (ban.cost == 0 ? "free" : ban.cost + "💠") + "`)\n").join("")) +
                    (ruleset.match.repeattrack && ("👥 Both players can use `" + ruleset.match.repeattrack.limit + "` " + ruleset.match.repeattrack.condition + " **🔁 Runback** " + (ruleset.match.repeattrack.style == "soft" ? "(`resets to default conditions, " : "(`must be same conditions, ") + (ruleset.match.repeattrack.cost == 0 ? "free" : ruleset.match.repeattrack.cost + "💠") + "`)"))

                let racefield = { name: "Every Race", value: "", inline: false }
                racefield.value = Object.values(ruleset.race).map(
                    race => choices[race.choice] + " **" + events[race.event] + "** " +
                        ([undefined, null].includes(race.limit) || race.limit == 1 ? "a " :
                            (race.limit == 0 ? "any number of " : "up to `" + race.limit + "` ")) +
                        race.type +
                        (race.limit == 0 ? "s" : "") +
                        ([undefined, null].includes(race.cost) ? "" : " (`" + (race.cost == 0 ? "free" : race.cost + "💠/" + (race.count == 1 ? "" : race.count + " ") + race.type) + "`)") +
                        ([null, undefined, ""].includes(race.options) ? "" : " from the following options: " + Object.values(race.options).map(option => "`" + conditions[option] + "`").join(", ")) + "\n"
                ).join("")
                fields.push(genfield, matchfield, racefield)
            }
            return fields
        }
        function getUsername(user) {
            let name = ""
            Object.values(tourney_participants_data).forEach(participant => {
                if (participant.id == user) {
                    name = participant.name
                    return
                }
            })
            return name
        }
        if (args[0] == "matches") {
            const tourneyMatches = new Discord.MessageEmbed()
                .setTitle("Tournament Matches")
                .setColor("#3BA55D")
                .setDescription("Use the selects below to explore tournament matches.")
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")

            let sort = "date_ascend", tourney = "0", match = null, type = 7, offset = 0
            let ruleset_emojis = {
                "1v1": "🆚",
                "1vAll": "👑",
                "Qualifier": "⏳",
                "RTA": "⏱️"
            }
            if (args.includes("initial")) {
                type = 4
            } else {
                for (let i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //tourney
                    let option = interaction.message.components[0].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            tourney = option.value
                        }
                    }
                }
                for (let i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //sort
                    let option = interaction.message.components[1].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            sort = option.value
                        }
                    }
                }
                for (let i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //match
                    let option = interaction.message.components[2].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            match = option.value
                        }
                    }
                }
            }

            function convertDate(unix) {
                let date = new Date(unix);
                let year = date.getUTCFullYear();
                let month = date.getUTCMonth() + 1;
                let day = date.getUTCDate();
                let dateString = year + "-" + month + "-" + day;
                return dateString
            }

            //get selection
            let tourney_desc = ""
            if (args[1].startsWith("offset")) {
                offset = Number(args[1].replace("offset", ""))
                if (interaction.data.hasOwnProperty("values")) {
                    if (interaction.data.values[0].includes("offset")) {
                        offset = Number(interaction.data.values[0].replace("offset", ""))
                    } else {
                        match = interaction.data.values[0]
                    }
                }
            } else if (args[1] == "sort") {
                sort = interaction.data.values[0]
            } else if (args[1] == "tourney") {
                tourney = interaction.data.values[0]
                tourneyMatches
                    .setTitle(tourney_tournaments_data[tourney].name)
                if (tourney_tournaments_data[tourney].hasOwnProperty("challonge")) {
                    let links = []
                    tourney_tournaments_data[tourney].challonge.forEach((link, num) => {
                        links.push("[Challonge link " + (num + 1) + "](" + link + ")")
                    })
                    tourney_desc += ":trophy: " + links.join(", ") + "\n"
                }
                if (tourney_tournaments_data[tourney].hasOwnProperty("matcherino")) {
                    tourney_desc += "💸 [Matcherino](" + tourney_tournaments_data[tourney].matcherino + ")\n"
                }
                if (tourney_tournaments_data[tourney].hasOwnProperty("playlist")) {
                    tourney_desc += "📺 [Playlist](" + tourney_tournaments_data[tourney].playlist + ")\n"
                }
                if (tourney_tournaments_data[tourney].hasOwnProperty("stats")) {
                    tourney_desc += "📊 [Stats](" + tourney_tournaments_data[tourney].stats + ")\n"
                }
            }

            //get tourneys
            let tourney_options = []
            let tourney_keys = Object.keys(tourney_tournaments_data)
            tourney_keys.forEach(key => {
                let t = tourney_tournaments_data[key]
                let t_stuff = {
                    oldest: null,
                    newest: null,
                    players: [],
                    matches: 0,
                    races: 0,
                    deaths: 0
                }
                let tmatches = Object.values(tourney_matches_data)
                tmatches.forEach(match => {
                    if (Number(match.tourney) == Number(key)) {
                        t_stuff.matches++
                        if (t_stuff.oldest == null || match.datetime < t_stuff.oldest) {
                            t_stuff.oldest = match.datetime
                        }
                        if (t_stuff.newest == null || match.datetime > t_stuff.newest) {
                            t_stuff.newest = match.datetime
                        }
                        match.races.forEach(race => {
                            t_stuff.races++
                            Object.values(race.runs).forEach(run => {
                                if (!t_stuff.players.includes(run.player)) {
                                    t_stuff.players.push(run.player)
                                }
                                if (![undefined, null, ""].includes(run.deaths)) {
                                    t_stuff.deaths += Number(run.deaths)
                                }
                            })
                        })
                    }
                })

                let tourney_option = {
                    label: t.name,
                    value: key,
                    description: "📆 " + convertDate(t_stuff.oldest) + " - " + convertDate(t_stuff.newest) + " 👥 " + t_stuff.players.length + " ⚔️ " + t_stuff.matches + " 🏁 " + t_stuff.races + " 💀 " + t_stuff.deaths,
                    emoji: { name: "🏆" }
                }
                if (Number(tourney) == Number(key)) {
                    tourney_option.default = true
                }
                if (Number(key) == Number(tourney) && args[1] == "tourney") {
                    tourney_desc += "📆 Date Range: `" + convertDate(t_stuff.oldest) + " - " + convertDate(t_stuff.newest) + "`\n👥 Players: `" + t_stuff.players.length + "`\n⚔️ Matches: `" + t_stuff.matches + "`\n🏁 Races: `" + t_stuff.races + "`\n💀 Deaths: `" + t_stuff.deaths + "`"
                    tourneyMatches.setDescription(tourney_desc)
                }
                tourney_options.push(tourney_option)
            })

            //get matches
            let mtch = Object.keys(tourney_matches_data)
            mtch = mtch.filter(m => Number(tourney_matches_data[m].tourney) == Number(tourney))
            let match_options = []
            mtch.forEach(key => {
                let m = tourney_matches_data[key]
                let m_option = {
                    date: m.datetime,
                    races: m.races.length,
                    deaths: 0,
                    timediff: [],
                    closest: null
                }
                Object.values(m.races).forEach(race => {
                    let timediff = []
                    Object.values(race.runs).forEach(run => {
                        if (run.time !== "DNF") {
                            timediff.push(run.time)
                        }
                        if (![undefined, null, ""].includes(run.deaths)) {
                            m_option.deaths += run.deaths
                        }
                    })
                    if (timediff.length == 2 && !["Qualifier", "1vAll", "RTA"].includes(tourney_rulesets_data.saved[m.ruleset].type)) {
                        let diff = Math.abs(timediff[0] - timediff[1])
                        m_option.timediff.push(diff)
                        if (m_option.closest == null || diff < m_option.closest) {
                            m_option.closest = diff
                        }
                    }
                })
                if (m_option.timediff.length > 0) {
                    m_option.timediff = m_option.timediff.reduce((a, b) => { return a + b }) / m_option.timediff.length
                } else {
                    m_option.timediff = null
                    m_option.closest = null
                }
                match_options[key] = m_option
            })

            //sort options
            let sort_selections = [
                { label: "Sort by Date (Ascending)", value: "date_ascend", description: "sort by date, oldest to newest", emoji: { name: "📆" } },
                { label: "Sort by Date (Descending)", value: "date_descend", description: "sort by date, newest to oldest", emoji: { name: "📆" } },
                { label: "Sort by Races", value: "races", description: "sort by number of races descending", emoji: { name: "🏁" } },
                { label: "Sort by Total Deaths", value: "deaths", description: "sort by total match deaths descending", emoji: { name: "💀" } },
                { label: "Sort by Avg. Time Difference", value: "time", description: "sort by average time difference ascending", emoji: { name: "⏱️" } },
                { label: "Sort by Closest Race", value: "closest", description: "sort by closest race difference ascending", emoji: { name: "🤏" } }
            ]
            sort_selections.forEach(option => {
                if (option.value == sort) {
                    option.default = true
                }
            })

            //sort matches
            if (sort == "date_ascend") {
                mtch = mtch.sort(function (a, b) {
                    return match_options[a].date - match_options[b].date
                })
            } else if (sort == "date_descend") {
                mtch = mtch.sort(function (a, b) {
                    return match_options[b].date - match_options[a].date
                })
            } else if (sort == "races") {
                mtch = mtch.sort(function (a, b) {
                    return match_options[b].races - match_options[a].races
                })
            } else if (sort == "deaths") {
                mtch = mtch.sort(function (a, b) {
                    return match_options[b].deaths - match_options[a].deaths
                })
            } else if (sort == "time") {
                mtch = mtch.sort(function (a, b) {
                    if (match_options[a].timediff == null) {
                        return 1
                    } else if (match_options[b].timediff == null) {
                        return -1
                    } else {
                        return match_options[a].timediff - match_options[b].timediff
                    }
                })
            } else if (sort == "closest") {
                mtch = mtch.sort(function (a, b) {
                    if (match_options[a].closest == null) {
                        return 1
                    } else if (match_options[b].closest == null) {
                        return -1
                    } else {
                        return match_options[a].closest - match_options[b].closest
                    }
                })
            }

            //assmble match options
            let matches = []
            for (i = 0 + offset * 23; i < (offset + 1) * 23; i++) {
                let s = mtch[i]
                let matchoption = tourney_matches_data[s]
                if (i == 0 + offset * 23 && offset > 0) {
                    matches.push(
                        {
                            label: "Previous matches...",
                            value: "offset" + (offset - 1),
                        }
                    )
                }
                let title = []
                if (matchoption.bracket) {
                    title.push(matchoption.bracket)
                }
                if (matchoption.round) {
                    title.push(matchoption.round)
                }
                let players = Object.values(matchoption.races[0].runs).map(run => getUsername(run.player)).join(" vs ")
                let date = new Date(matchoption.datetime)
                date = date.toLocaleString().split(", ")
                if (title.length == 0) {
                    title = players
                } else {
                    title = title.join(" ") + " - " + players
                }
                let r = {
                    label: title.substring(0, 50),
                    value: s,
                    description: "📆 " + convertDate(match_options[s].date) +
                        " 🏁 " + match_options[s].races +
                        " 💀 " + match_options[s].deaths,
                    emoji: {
                        name: ruleset_emojis[tourney_rulesets_data.saved[matchoption.ruleset].type]
                    }
                }
                if ((["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[matchoption.ruleset].general.type))) {
                    r.description += " ⏱️ ±" + (match_options[s].timediff == null ? "--" : match_options[s].timediff.toFixed(3)) + " 🤏 " + (match_options[s].closest == null ? "--" : match_options[s].closest.toFixed(3))
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
                            label: "More matches...",
                            value: "offset" + (offset + 1),
                        }
                    )
                }
            }
            //get best times 
            if (match !== null) {
                let best_times = {}
                for (i = 0; i < 25; i++) {
                    best_times[i] = { best: {}, pb: {} }
                }
                let mat = Object.values(tourney_matches_data)
                mat = mat.sort(function (a, b) {
                    return a.datetime - b.datetime;
                })
                mat.forEach(m => {
                    let current_match = tourney_matches_data[match]
                    if (m.datetime < current_match.datetime && m.bracket !== "Qualifying") {
                        Object.values(m.races).forEach(race => {
                            let conditions = tourney_rulesets_data.saved[current_match.ruleset].general.default
                            let thistrack = null
                            Object.values(race.events).forEach(event => {
                                if (event.event == 'override') {
                                    if (event.selection == 'nu') {
                                        conditions.upgr = 'nu'
                                    }
                                    if (event.selection == 'fl') {
                                        conditions.time = 'fl'
                                    }
                                    if (event.selection == 'sk') {
                                        conditions.trak = 'sk'
                                    }
                                }
                                if (event.event == 'selection' && event.type == 'track') {
                                    thistrack = event.selection
                                }
                            })
                            Object.values(race.runs).forEach(run => {
                                if (!best_times[thistrack].pb.hasOwnProperty(run.player)) {
                                    best_times[thistrack].pb[run.player] = {}
                                }

                                let constring = Object.values(conditions).join("")
                                if (best_times[thistrack].pb[run.player][constring]) {
                                    if (Number(run.time) - Number(best_times[thistrack].pb[run.player][constring]) < 0) {
                                        best_times[thistrack].pb[run.player][constring] = run.time
                                    }
                                } else {
                                    best_times[thistrack].pb[run.player][constring] = run.time
                                }
                                if (best_times[thistrack]?.best[constring]) {
                                    if (Number(run.time) - Number(best_times[thistrack].best[constring]) < 0) {
                                        best_times[thistrack].best[constring] = run.time
                                    }
                                } else {
                                    best_times[thistrack].best[constring] = run.time
                                }
                            })
                        })
                    }
                })

                //assemble embed
                let thematch = tourney_matches_data[match]
                let title = [(thematch.bracket ?? ""), (thematch.round ?? ""), Object.values(thematch.races[0].runs).map(run => getUsername(run.player)).join(" vs ")].join(" ").substring(0, 50)
                let description = ""
                if (tourney_tournaments_data[thematch.tourney]?.challonge) {
                    description += "[:trophy: " + tourney_tournaments_data[thematch.tourney].name + "](" + tourney_tournaments_data[thematch.tourney].challonge[0] + ")\n"
                } else {
                    description += ":trophy: " + tourney_tournaments_data[thematch.tourney].name + "\n"
                }
                description += ":calendar_spiral: <t:" + Math.round(thematch.datetime / 1000) +
                    ":F>\n:scroll: " + tourney_rulesets_data.saved[thematch.ruleset].general.name + ([null, undefined, ""].includes(thematch.commentators) ? "" : "\n:microphone2: " + Object.values(thematch.commentators).map(com => getUsername(com)).join(", "))

                tourneyMatches
                    .setTitle(title)
                    .setDescription(description)
                    .setColor("#3BA55D")
                    .setURL(thematch.vod)
                    .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")

                //assemble fields
                let eventmap = {
                    selection: "👆",
                    override: "✳️",
                    permaban: "🚫",
                    tempban: "❌"
                }
                let conmap = {
                    sk: "Skips",
                    nu: "No Upgrades",
                    fl: "Fast Lap"
                }

                Object.values(thematch.races).forEach((race, index) => {
                    let thetrack = null
                    let gents = false
                    let field = ""
                    let repeat = false
                    let conditions = tourney_rulesets_data.saved[thematch.ruleset].general.default
                    if (race.events) {
                        Object.values(race.events).forEach(event => {
                            field += [eventmap[event.event],
                            (event.type == 'track' ?
                                tracks[event.selection].nickname[0].toUpperCase() :
                                event.type == 'racer' ?
                                    racers[event.selection].flag :
                                    event.type == "condition" ?
                                        conmap[event.selection] : ""),
                            [null, undefined, "", 0].includes(event.cost) ? "" : "(💠" + event.cost + ")",
                            [null, undefined, "", false].includes(event.repeat) ? "" : "(🔁)",
                            ![null, undefined, ""].includes(event.player) ? "(*" + getUsername(event.player).replace(" ", "").substring(0, 4) + "*)" : ""
                            ].join(" ") + "\n"
                            if (event.event == 'selection' && event.type == 'track') {
                                thetrack = event.selection
                                repeat = event.repeat ?? false
                            }
                            if (event.event == 'override') {
                                if (event.selection == 'nu') {
                                    conditions.upgr = 'nu'
                                }
                                if (event.selection == 'fl') {
                                    conditions.time = 'fl'
                                }
                                if (event.selection == 'sk') {
                                    conditions.trak = 'sk'
                                }
                            }
                        })
                    } else {
                        field += planets[tracks[race.track].planet].emoji + " " + tracks[race.track].nickname[0].toUpperCase() + "\n" + Object.values(race.conditions).join(", ") + "\n"
                    }

                    let winner = {}
                    Object.values(race.runs).forEach(run => {
                        if ((winner.time == undefined || Number(run.time) < Number(winner.time)) && run.time !== "DNF") {
                            winner.time = Number(run.time)
                            winner.player = run.player
                        }
                    })
                    Object.values(race.runs).forEach(run => {
                        field += "**" + getUsername(run.player) + "** " + (run.player == winner.player ? ":crown:" : "") + "\n" +
                            (run.pod ? racers[run.pod].flag : "") + " " + (String(run.time).toLowerCase() == 'dnf' ? "DNF" : "`" + tools.timefix(run.time) + "`") + " " + (run.deaths > 0 ? ":skull:" + (run.deaths > 1 ? "×" + run.deaths : "") : "")
                        if (thematch.bracket !== "Qualifying") {
                            if (Number(run.time) - Number(best_times[thetrack].best[Object.values(conditions).join("")]) < 0 && run.player == winner.player) {
                                field += "<a:newrecord:672640831882133524>"
                            } else if (best_times[thetrack].pb.hasOwnProperty(run.player)) {
                                if (best_times[thetrack].pb[run.player].hasOwnProperty(Object.values(conditions).join(""))) {
                                    if (Number(run.time) - Number(best_times[thetrack].pb[run.player][Object.values(conditions).join("")]) < 0) {
                                        field += ":medal:"
                                    }
                                }
                            }
                        }
                        field += "\n"
                        if (run.notes.toLowerCase().includes("gentle")) {
                            gents = true
                        }
                        let notes = run.notes.toLowerCase().replace("salty runback", "").replace("gentleman's agreement", "").replace("gentlemen's agreement", "")
                        if (![undefined, null, ""].includes(notes)) {
                            field += "*" + notes + "*\n"
                        }
                    })
                    tourneyMatches
                        .addField("Race " + (index + 1), field, true)
                })
                if (tourney_rulesets_data.saved[thematch.ruleset].general.type == "RTA") {
                    let totals = ""
                    let igt = {}
                    Object.values(thematch.races).forEach(race => {
                        Object.values(race.runs).forEach(run => {
                            if (igt[run.player] == undefined) {
                                igt[run.player] = { time: 0, deaths: 0 }
                            }
                            if (run.time !== "DNF") {
                                igt[run.player].time += run.time
                            }
                            igt[run.player].deaths += run.deaths
                        })
                    })

                    let winner = { player: null, time: null }
                    Object.keys(igt).forEach(player => {
                        if (winner.time == null || igt[player].time < winner.time) {
                            winner = { player: player, time: igt[player].time }
                        }
                    })

                    Object.keys(igt).forEach(player => {
                        totals += "**" + getUsername(player) + "** "
                        if (player == winner.player) {
                            totals += ":crown:"
                        }
                        totals += "\n"
                        totals += "`" + tools.timefix(igt[player].time) + " [IGT]`\n"
                        if (![null, undefined, ""].includes(thematch.rta)) {
                            Object.values(thematch.rta).forEach(rta => {
                                if (rta.player == player) {
                                    totals += "`" + tools.timefix(rta.total) + " [RTA]`\n"
                                }
                            })
                        }
                    })
                    tourneyMatches
                        .addField("Total", totals, true)
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
                                        custom_id: "tourney_matches_tourney",
                                        options: tourney_options,
                                        placeholder: "Select Tournament",
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
                                        custom_id: "tourney_matches_sort",
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

        } else if (args[0] == "schedule") {
            let type = 4
            if (args[1] == "refresh") {
                type = 7
            }
            const tourneyReport = new Discord.MessageEmbed()
            tourneyReport
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                .setTitle("Match Schedule")
                .setURL("http://speedgaming.org/swe1racer/")
                .setDescription("Upcoming matches on speedgaming.org/swe1racer\n(Current as of <t:" + Math.round(Date.now() / 1000) + ":R>)")
                .setFooter("Times are displayed in your local time")
            if (Object.values(tourney_scheduled_data).length > 0) {
                Object.values(tourney_scheduled_data).filter(match => match.datetime >= Date.now() && match.current).sort(function (a, b) { return a.datetime - b.datetime - 0 }).map(match => {
                    tourneyReport
                        .addField("<t:" + match.datetime / 1000 + ":F>", "\n" + (match.url == "" ? "" : "📺 [Stream Link](" + match.url + ")") + "\n📅 [Event Link](https://discord.gg/dWRsGTutSC?event=" + match.event + ")", true)
                        .addField(":crossed_swords: " + match.players.map(
                            player => tourney_participants_data[player].name
                        ).join(" vs "),
                            ":microphone2: " + (match.commentary.filter(player => player !== "").length > 0 ? (match.commentary.filter(player => player !== "").map(player => tourney_participants_data[player].name).join(", ")) : "Sign up for commentary!"), true
                        )
                        .addField('\u200B', '\u200B', true)
                })
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

        } else if (args[0] == "leaderboards") {
            const tourneyReport = new Discord.MessageEmbed()
            let type = 7
            if (args.includes("initial")) {
                type = 4
            }
            let track = Math.floor(Math.random() * 25)
            let pods = []
            let conditions = []
            let showall = false
            if (!args.includes("initial")) {
                for (let i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //track
                    let option = interaction.message.components[0].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            track = option.value
                        }
                    }
                }
                for (let i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //conditions
                    let option = interaction.message.components[1].components[0].options[i]
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            conditions.push(option.value)
                        }
                    }
                }
                for (let i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //pods
                    let option = interaction.message.components[2].components[0].options[i]
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
                conditions = ["mu", "nu", "ft", "sk", "de", "dl", "un"]
            }
            //prepare filters
            if (interaction.member) {
                user = interaction.member.user.id
            } else {
                user = interaction.user.id
            }
            //account for missing conditions
            if (!conditions.includes("de") && !conditions.includes("dl")) {
                conditions.push("de", "dl")
            }
            if (!conditions.includes("nu") && !conditions.includes("mu")) {
                conditions.push("nu", "mu")
            }
            if (!conditions.includes("sk") && !conditions.includes("ft")) {
                conditions.push("sk", "ft")
            }
            if (!conditions.includes('un')) {
                showall = true
            }
            //get runs and apply filters
            let runs = []
            let matches = Object.values(tourney_matches_data)
            let counts = { mu: 0, nu: 0, ft: 0, sk: 0, de: 0, dl: 0, ng: 0, fl: 0, qual: 0, user: 0, tracks: {} }
            let pod_counts = {}
            matches.forEach(match => {
                Object.values(match.races).forEach((race, num) => {
                    //figure out track and conditions
                    let thisconditions = { ...tourney_rulesets_data.saved[match.ruleset].general.default }
                    let thistrack = null
                    if (race.events) {
                        Object.values(race.events).forEach(event => {
                            if (event.event == 'selection' && event.type == 'track') {
                                if (counts.tracks[event.selection] == undefined) {
                                    counts.tracks[event.selection] = { total: 0, sk: 0, nu: 0, fl: 0, ft: 0, mu: 0, tt: 0, ng: 0 }
                                }
                                thistrack = event.selection
                            }
                            if (event.event == 'override' && event.type == 'condition') {
                                if (event.selection == 'nu') {
                                    thisconditions.upgr = 'nu'
                                }
                                if (event.selection == 'sk') {
                                    thisconditions.trak = 'sk'
                                }
                                if (event.selection == 'fl') {
                                    thisconditions.time = 'fl'
                                }
                            }
                        })
                        thisconditions = Object.values(thisconditions)
                    } else {
                        thisconditions = Object.values(race.conditions)
                        thistrack = race.track

                    }

                    //update counts
                    Object.values(race.runs).forEach(run => {
                        counts.tracks[thistrack].total++
                        thisconditions.forEach(con => {
                            if (counts.tracks[thistrack][con] == undefined) {
                                counts.tracks[thistrack][con] = 1
                            } else {
                                counts.tracks[thistrack][con]++
                            }
                        })
                    })
                    //get runs if this is the selected track
                    if (thistrack == track) {
                        let opponents = []
                        Object.values(race.runs).forEach(run => {
                            opponents.push(run.player)
                        })
                        Object.values(race.runs).forEach(run => {
                            run.num = num + 1
                            run.vod = match.vod
                            run.tourney = match.tourney
                            run.bracket = match.bracket
                            run.round = match.round
                            if (race.events) {
                                run.podbans = Object.values(race.events).filter(event => event.event == 'tempban' && event.type == 'racer').map(event => event.selection)
                            } else {
                                run.podbans = []
                            }
                            run.opponents = opponents.filter(op => op !== run.player)
                            thisconditions.forEach(con => {
                                if (counts[con] == undefined) {
                                    counts[con] = 1
                                } else {
                                    counts[con]++
                                }
                            })
                            run.conditions = [...thisconditions]
                            if (run.deaths == 0) {
                                counts.dl++
                                run.conditions.push('dl')
                            }
                            if (run.deaths > 0) {
                                counts.de++
                                run.conditions.push('de')
                            }
                            if (match.bracket == "Qualifying") {
                                counts.qual++
                                counts.tracks[thistrack].qual++
                                run.conditions.push('qual')
                            }
                            if (run.player == String(user)) {
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
            //filter runs
            runs = runs.filter(run => {
                let filter = true
                run.conditions.forEach(con => {
                    if (!conditions.includes(con) && !["un", "um", "tt", "l3"].includes(con)) {
                        filter = false
                    }
                    if (pods.length > 0 && !pods.includes(String(run.pod))) {
                        filter = false
                    }
                    if (user !== null && conditions.includes("user") && run.player !== user) {
                        filter = false
                    }
                })
                if (!conditions.includes('qual') && run.conditions.includes('qual')) {
                    filter = false
                }
                return filter
            })
            //sort runs
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
            if (user !== null && conditions.includes("user")) {
                if (interaction.member) {
                    const Member = Guild.members.cache.get(user)
                    tourneyReport.setAuthor(Member.user.username + "'s Tournament Best", client.guilds.resolve(interaction.guild_id).members.resolve(user).user.avatarURL())
                } else {
                    tourneyReport.setAuthor(interaction.user.username + "'s Tournament Best")
                }
                showall = true
            }
            if (!showall) {
                tourneyReport.setFooter(runs.length + "/" + counts.tracks[track].total + " Runs (Unique Runs Only)")
            }
            let pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            let already = []
            let conditionmap = {
                mu: "Upgrades Allowed",
                nu: "No Upgrades",
                ft: "Full Track",
                sk: "Skips",
                um: "Unmirrored",
                mi: "Mirrored",
                l1: "1 Lap",
                l2: "2 Laps",
                l3: "3 Laps",
                l4: "4 Laps",
                l5: "5 Laps",
                fl: "Fast Lap",
                tt: "Total Time",
                ng: "New Game",
                ngp: "New Game +"
            }
            if (runs.length > 0) {
                for (i = 0; i < runs.length; i++) {
                    let constring = runs[i].player + runs[i].pod + runs[i].platform + runs[i].conditions.filter(r => !["de", "dl"].includes(r)).join("")
                    if (runs[i].hasOwnProperty("time") && !already.includes(constring)) {
                        let bracket = ""
                        if (![undefined, "", null].includes(runs[i].bracket)) {
                            bracket = " " + runs[i].bracket
                            if (![undefined, "", null].includes(runs[i].round)) {
                                bracket += " " + runs[i].round
                            }
                        }
                        tourneyReport
                            .addField(pos[0] + " " + getUsername(runs[i].player),
                                tourney_tournaments_data[runs[i].tourney].nickname + bracket +
                                "\n[Race " + runs[i].num +
                                (runs[i].opponents.length > 0 ?
                                    (runs[i].opponents.length > 3 ?
                                        " vs " + runs[i].opponents.length + " players" :
                                        " vs " + runs[i].opponents.map(op => getUsername(op)).join(", ")) : "") + "](" + runs[i].vod + ")", true)
                            .addField(runs[i].time == "DNF" ? "DNF" : tools.timefix(Number(runs[i].time).toFixed(3)),
                                " " + racers[runs[i].pod].flag + " " + runs[i].platform.toUpperCase() + (runs[i].deaths > 0 ? runs[i].deaths > 1 ? " :skull:×" + runs[i].deaths : " :skull:" : "") + "\n" +
                                [runs[i].conditions.filter(con => !['um', 'l3', 'tt', 'mu', 'ft', 'qual', 'de', 'dl'].includes(con)).map(con => "`" + conditionmap[con] + "`").join(" "), (runs[i].podbans.length > 0 ? ":x:" + runs[i].podbans.map(ban => racers[ban].flag).join(" ") : "")].filter(t => t !== "").join(" "), true)
                            .addField('\u200B', '\u200B', true)
                        if (showall == false) { already.push(constring) }
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
            let components = []
            let cond = { mu: "Max Upgrades", nu: "No Upgrades", ft: "Full Track", sk: "Skips", de: "Deaths", dl: "Deathless", qual: "Qualifying", ng: "New Game", fl: "Fast Lap", un: "Unique Runs Only", user: "My Runs Only" }
            let track_selections = []
            let racer_selections = []
            let cond_selections = []
            let condkeys = Object.keys(cond)
            for (let i = 0; i < 25; i++) {
                let racer_option = {
                    label: racers[i].name,
                    value: i,
                    description: pod_counts[i] !== undefined ? pod_counts[i] + " Runs" : "",
                    emoji: {
                        name: racers[i].flag.split(":")[1],
                        id: racers[i].flag.split(":")[2].replace(">", "")
                    },
                    default: pods.includes(String(i))
                }
                racer_selections.push(racer_option)
                let track_option = {
                    label: tracks[i].name,
                    value: i,
                    description: counts.tracks[i].total + " Runs: " + ['nu', 'sk', 'fl'].filter(f => ![null, undefined, "", 0].includes(counts.tracks[i][f])).map(f => cond[f] + " " + counts.tracks[i][f]).join(", "),
                    emoji: {
                        name: planets[tracks[i].planet].emoji.split(":")[1],
                        id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                    },
                    default: track == i
                }
                track_selections.push(track_option)
                if (i < condkeys.length) {
                    let cond_option = {
                        label: cond[condkeys[i]] + (condkeys[i] !== 'un' ? " (" + counts[condkeys[i]] + ")" : ""),
                        value: condkeys[i],
                        default: conditions.includes(condkeys[i])
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
            components = []
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
            let type = 7
            if (args.includes("initial")) {
                type = 4
            }
            let flags = 0
            let components = []
            const rulesetEmbed = new Discord.MessageEmbed()
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")

            let emojis = {
                "1v1": "🆚",
                "1vAll": "👑",
                "Qualifier": "⏳",
                "RTA": "⏱️"
            }

            function showRuleset(ruleset) {
                let conditions = {
                    mu: "Upgrades Allowed",
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
                    l5: "5 Laps",
                    fl: "Fast Lap",
                    tt: "Total Time",
                    ng: "New Game",
                    ngp: "New Game +"
                }

                let methods = {
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

                let permabans = [
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

                let tempbans = [
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
                    let result = ""
                    if (collection.length == 23) {
                        result = "`Any Pod`"
                    } else {
                        let pods = []
                        let missing_pods = []
                        for (let p = 0; p < 23; p++) {
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
                        let amc = 0, spc = 0, gal = 0, inv = 0
                        let result = ""
                        let first_nicks = []
                        let missing = []
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
                        .setDescription("Ruleset Type: 🆚 1v1" + "\n" + ruleset.description)
                    let fields = []
                    //wins
                    let field = {}
                    field.name = ":trophy: Win Condition"
                    let winstuff = Object.values(ruleset.wins)
                    let winstring = []
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
                    let cond = Object.values(ruleset.default)
                    let cons = []
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
                                let ms = []
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
                        let cond = Object.values(ruleset.conoptions)
                        let cons = []
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
                    let podpods = Object.values(ruleset.podpods)
                    if (podpods.length == 23) {
                        field.value += "`Any Pod`"
                    } else {
                        let pods = []
                        let missing_pods = []
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
                } else if (["1vAll", "Qualifier", "RTA"].includes(ruleset.type)) {
                    conditions = {
                        mu: "Upgrades Allowed",
                        nu: "No Upgrades",
                        ft: "Full Track",
                        sk: "Skips",
                        mi: "Mirrored",
                        l1: "1 Lap",
                        l2: "2 Laps",
                        l3: "3 Laps",
                        l4: "4 Laps",
                        l5: "5 Laps",
                        fl: "Fast Lap",
                        ng: "New Game",
                        fp: "Free Play",
                        nj: "No Junkyard",
                        ch: "Cheats Allowed"
                    }
                    rulesetEmbed
                        .setDescription("Ruleset Type: " + emojis[ruleset.type] + " " + ruleset.type + "\n" + ruleset.description)
                    let fields = []
                    //default conditions
                    let field = {}
                    field.name = ":eight_spoked_asterisk: Conditions"
                    let cond = Object.values(ruleset.conditions)
                    let cons = []
                    cond.forEach(con => {
                        cons.push("`" + conditions[con] + "`")
                    })
                    field.value = cons.join(" ")
                    field.inline = true
                    fields.push(field)
                    //pod selection
                    field = {}
                    field.name = "<:Pod1:525755322355417127> Pod Selection"
                    field.value = "`" + methods[ruleset.podmethod] + "`\n"
                    if (ruleset.podmethod == "pod_pool") {
                        field.value += "`" + ruleset.poollimit + " Uses Per Pod`"
                    }
                    if (["player_pick", "limited_choice"].includes(ruleset.podmethod)) {
                        field.value += podSelection(Object.values(ruleset.podpods)) + "\n"
                    }
                    field.inline = true
                    fields.push(field)
                    field = { name: '\u200B', value: '\u200B', inline: true }
                    fields.push(field)
                    //races
                    for (i = 0; i < Number(ruleset.racenum); i++) {
                        field = {}
                        field.name = ":triangular_flag_on_post: Race " + (i + 1)
                        field.value = planets[tracks[Number(ruleset.races[i].track)].planet].emoji + " **" + tracks[Number(ruleset.races[i].track)].name + "**\n"

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
            let modal = false
            //break if check here in case "refresh" changed to "browse"
            if (args[1] == "browse") { //browse ruleset list
                rulesetEmbed.setTitle(":scroll: Rulesets")
                    .setDescription("This is the tournament ruleset manager. Browse existing rulesets using the dropdown below or make your own by pressing the New button.\n\n:grey_question: To learn more about making rulesets, watch [this video](https://youtu.be/fExzuOvn6iY)")
                let buttons = [
                    {
                        type: 2,
                        label: "",
                        emoji: {
                            id: "854097998357987418",
                            name: "refresh"
                        },
                        style: 2,
                        custom_id: "tourney_rulesets_refresh",
                    }
                ]
                let offset = 0
                if (args[2] !== undefined && args[2] !== "initial") {
                    offset = Number(args[2])
                }
                if (interaction.data.hasOwnProperty("values") && interaction.data.values[0].includes("offset")) {
                    offset = Number(interaction.data.values[0].replace("offset", ""))
                }
                if (![undefined, null].includes(tourney_rulesets_data.saved)) {
                    let saved = Object.keys(tourney_rulesets_data.saved)
                    let rulesets = []
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
                        let s = saved[i]
                        let r = {
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
                        let ruleset = tourney_rulesets_data.saved[interaction.data.values[0]]
                        rulesetEmbed.setTitle(":scroll: Rulesets: " + ruleset.name)
                            .setDescription("Type: " + emojis[ruleset.type] + " " + ruleset.type + "\n" + ruleset.description)
                            .addFields(showRuleset(ruleset))
                            .setFooter(client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.username, client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.avatarURL())
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
            }

            rulesetEmbed
                .setTitle(tourney_rulesets_data.new[interaction.member.user.id].name)
                .setFooter(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
            if (![null, undefined].includes(tourney_rulesets_data)) {
                if (![null, undefined].includes(tourney_rulesets_data.new) && args[3] !== "save") {
                    rulesetEmbed.addFields(showRuleset(tourney_rulesets_data.new[interaction.member.user.id]))
                }
            }

            if (!modal) {
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

        } else if (args[0] == "stats") {
            let player = "global", type = 6, track = null, player_runs = []
            let sort = "plays"
            if (args.includes("initial")) {
                type = 5
            } else {
                interaction.message.components[0].components[0].options.forEach(option => { //player
                    if (option.hasOwnProperty("default")) {
                        if (option.default) {
                            player = option.value
                        }
                    }
                })
                if (interaction.message.embeds[0].title !== "Global Stats") {
                    let tpd = Object.keys(tourney_participants_data)
                    let name = interaction.message.embeds[0].title.replace("'s Stats", "")
                    for (i = 0; i < tpd.length; i++) {
                        if (tourney_participants_data[tpd[i]].name == name) {
                            player = tpd[i]
                        }
                    }
                }
                if (interaction.message.components.length > 1) {
                    interaction.message.components[1].components[0].options.forEach(option => {//sort
                        if (option.default) {
                            sort = option.value
                        }
                    })
                    interaction.message.components[2].components[0].options.forEach(option => {
                        if (option.default) {
                            track = Number(option.value)
                        }
                    })
                }
            }
            let offset = 0
            if (args[1] == "player") {
                if (interaction.data.hasOwnProperty("values")) {
                    if (interaction.data.values[0].includes("offset")) {
                        offset = Number(interaction.data.values[0].replace("offset", ""))
                    } else {
                        player = interaction.data.values[0]
                    }
                }
            } else if (args[1] == "sort") {
                sort = interaction.data?.values[0] ?? "plays"
            } else if (args[1] == "tracks") {
                track = Number(interaction.data?.values[0]) ?? null
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
                const wait = client.api.interactions(interaction.id, interaction.token).callback.post({ data: { type: type, data: {} } })
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
                //initialize stat structure
                let accomp = { win: { count: 0, streaks: [] }, deathless: { count: 0, streaks: [] }, comebacks: [] }
                let accomplishments = []
                let stats = {
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
                    track: {},
                    racer: {},
                    players: {},
                    commentators: {}
                }
                let best_times = {}
                for (i = 0; i < 25; i++) {
                    best_times[i] = {}
                }
                Object.values(tourney_participants_data).forEach(participant => {
                    if(participant.id){
                        stats.players[participant.id] = {
                            race_time: 0,
                            deaths: [],
                            matches: { total: 0, won: 0, lost: 0, qual: 0, winners: 0, losers: 0 },
                            races: { total: 0, won: 0, lost: 0, runbacks: 0, dnf: 0 },
                            track: {},
                            racer: {},
                            opponents: {},
                            overrides: { nu: 0, sk: 0, fl: 0 },
                            co_comm: {},
                        }
                    }
                })
                for (i = 0; i < 25; i++) {
                    stats.track[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], runbacks: 0, nu: 0, skips: 0 }
                    stats.racer[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], nu: 0, skips: 0 }
                    Object.values(tourney_participants_data).forEach(participant => {
                        if (participant.id) {
                            stats.players[participant.id].track[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], runbacks: 0, nu: 0, skips: 0 }
                            stats.players[participant.id].racer[i] = { plays: 0, picks: [], bans: [], wins: [], deaths: [], nu: 0, skips: 0 }
                        }
                    })
                }

                //get stats
                let matches = Object.values(tourney_matches_data).sort(function (a, b) {
                    return a.datetime - b.datetime
                })
                matches.forEach(match => {
                    let already_played = []
                    let runback = {}
                    let players = Object.values(match.races[0].runs).map(run => run.player)
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
                        players.forEach(player => {
                            if (stats.commentators[commentator].comfor[player] == undefined) {
                                stats.commentators[commentator].comfor[player] = 1
                            } else {
                                stats.commentators[commentator].comfor[player]++
                            }

                        })
                    })
                    if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                        players.forEach(player => {
                            players.filter(op => op !== player).forEach(opponent => {
                                if (stats.players[player].opponents[opponent] == undefined) {
                                    stats.players[player].opponents[opponent] = { matches: 0, races: 0, wins: [], times: [] }
                                }
                                stats.players[player].opponents[opponent].matches++
                            })
                        })
                    }

                    if (match.bracket == "Qualifying") {
                        stats.matches.qual++
                    } else if (match.bracket == "Losers") {
                        stats.matches.losers++
                    } else if (match.bracket == "Winners") {
                        stats.matches.winners++
                    }
                    stats.matches.total++
                    let already_banned = []
                    let score = {}, comeback = {}
                    let temppod = [], temptrack = []

                    players.forEach(p => {
                        stats.players[p].matches.total++
                        if (match.bracket == "Qualifying") {
                            stats.players[p].matches.qual++
                        } else if (match.bracket == "Winners") {
                            stats.players[p].matches.winners++
                        } else if (match.bracket == "Losers") {
                            stats.players[p].matches.losers++
                        }
                        score[p] = 0
                    })

                    match.races.forEach((race, num) => {
                        let conditions = tourney_rulesets_data.saved[match.ruleset].general.default
                        let thistrack = null
                        if (race.events) {
                            Object.values(race.events).forEach(event => {
                                if (event.event == 'tempban') {
                                    if (event.type == 'racer') {
                                        if (!event.selection.isArray()) {
                                            event.selection = [event.selection]
                                        }
                                        event.selection.forEach(selection => {
                                            stats.racer[selection].bans.push(1)
                                            stats.players[event.player].pods[selection].bans.push(1)
                                            temppod.push(Number(selection))
                                            for (let i = 0; i < 25; i++) {
                                                if (!temppod.includes(i)) {
                                                    stats.racer[i].bans.push(0)
                                                    stats.players[event.player].pods[i].bans.push(0)
                                                }
                                            }
                                        })
                                    } else if (event.type == 'track') {
                                        stats.track[event.selection].bans.push(1)
                                        stats.players[event.player].tracks[event.selection].bans.push(1)
                                        temptrack.push(Number(event.selection))
                                        let opponent = null
                                        race.runs.forEach(run => {
                                            if (run.player !== event.player) {
                                                opponent = run.player
                                            }
                                        })
                                        for (let i = 0; i < 25; i++) {
                                            if (!temptrack.includes(i) && !already_banned.includes(i) && (!already_played.includes(i) || (already_played.includes(i) && runback[opponent] == undefined))) {
                                                stats.track[i].bans.push(0)
                                                stats.players[event.player].tracks[i].bans.push(0)
                                            }
                                        }
                                    }
                                } else if (event.event == 'override' && event.type == 'condition') {
                                    stats.overrides.total++
                                    stats.players[event.player].overrides[event.selection]++
                                    stats.overrides[event.selection]++
                                    if (event.selection == 'nu') {
                                        conditions.upgr = 'nu'
                                    }
                                    if (event.selection == 'sk') {
                                        conditions.trak = 'sk'
                                    }
                                    if (event.selection == 'fl') {
                                        conditions.time = 'fl'
                                    }
                                } else if (event.event == 'selection' && event.type == 'track') {
                                    thistrack = event.selection
                                    already_played.push(thistrack)
                                    if (event.player !== undefined) {
                                        if (event.repeat) {
                                            runback[event.player] = true
                                            stats.track[event.selection].runbacks++
                                            stats.players[event.player].tracks[event.selection].runbacks++
                                            stats.races.runbacks++
                                            stats.players[event.player].races.runbacks++
                                        }
                                        stats.track[event.selection].picks.push(1)
                                        stats.players[event.player].tracks[event.selection].picks.push(1)
                                        already_played.push(Number(event.selection))
                                        for (let i = 0; i < 25; i++) {
                                            if (!temptrack.includes(i) && !already_banned.includes(i) && (!already_played.includes(i) || (already_played.includes(i) && (runback[race.track_selection.player] !== undefined)))) {
                                                stats.track[i].picks.push(0)
                                                stats.players[race.track_selection.player].tracks[i].picks.push(0)
                                            }
                                        }
                                    }
                                } else if (event.event == 'permaban') {
                                    if (event.type == "track") {
                                        stats.track[event.selection].bans.push(1)
                                        stats.players[event.player].tracks[event.selection].bans.push(1)
                                        already_banned.push(Number(event.selection))
                                        for (let i = 0; i < 25; i++) {
                                            if (!already_banned.includes(i) && !already_played.includes(i)) {
                                                stats.track[i].bans.push(0)
                                                stats.players[event.player].tracks[i].bans.push(0)
                                            }
                                        }
                                    }
                                }
                            })
                        } else {

                        }


                        let winner = { player: null, time: null, pod: null }

                        race.runs.forEach(run => {
                            if (run.time !== "DNF") {
                                stats.race_time += Number(run.time)
                                stats.players[run.player].race_time += Number(run.time)
                                if (winner.time == null || Number(run.time) - Number(winner.time) < 0) {
                                    winner = { player: run.player, time: run.time, pod: run.pod }
                                }
                            } else {
                                stats.races.dnf++
                                stats.players[run.player].races.dnf++
                            }
                            stats.players[run.player].races.total++
                            stats.races.total++
                            overrides.forEach(o => {
                                stats.players[run.player].tracks[thistrack][o]++
                                stats.players[run.player].pods[run.pod][o]++
                                stats.racer[run.pod][o]++
                                stats.track[thistrack][o]++
                            })
                            if ([null, undefined, ""].includes(run.deaths)) {
                                run.deaths = 0
                            }
                            stats.deaths.push(run.deaths)
                            stats.track[thistrack].deaths.push(run.deaths)
                            stats.players[run.player].tracks[thistrack].deaths.push(run.deaths)
                            stats.players[run.player].deaths.push(run.deaths)
                            //accomplishments for selected player
                            if (run.player == player && match.bracket !== "Qualifying") {
                                if (run.deaths == 0) {
                                    accomp.deathless.count++
                                } else {
                                    accomp.deathless.streaks.push(accomp.deathless.count)
                                    accomp.deathless.count = 0
                                }
                            }
                            stats.track[thistrack].plays++
                            stats.players[run.player].tracks[thistrack].plays++
                            if (run.pod !== undefined) {
                                stats.racer[run.pod].plays++
                                stats.racer[run.pod].picks.push(1)
                                stats.racer[run.pod].deaths.push(run.deaths)
                                stats.players[run.player].pods[run.pod].plays++
                                stats.players[run.player].pods[run.pod].picks.push(1)
                                stats.players[run.player].pods[run.pod].deaths.push(run.deaths)
                                for (let i = 0; i < 25; i++) {
                                    if (!temppod.includes(i) && i !== run.pod) {
                                        stats.racer[i].picks.push(0)
                                        stats.players[run.player].pods[i].picks.push(0)
                                    }
                                }
                            }
                            if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                                players.filter(p => p !== run.player).forEach(opponent => {
                                    stats.players[run.player].opponents[opponent.player].races++
                                    if (opponent.time !== "DNF" && run.time !== "DNF") {
                                        stats.players[run.player].opponents[opponent.player].times.push(opponent.time - run.time)
                                        if (run.time - opponent.time < 0 || run.time == "DNF") {
                                            stats.players[run.player].opponents[opponent.player].wins.push(1)
                                        } else if (opponent.time - run.time < 0 || opponent.time == "DNF") {
                                            stats.players[run.player].opponents[opponent.player].wins.push(0)
                                        }
                                    }
                                })
                            }
                            if (match.bracket !== "Qualifying") {
                                if (best_times[thistrack][conditions.join("")]) {
                                    if (Number(run.time) - Number(best_times[thistrack][conditions.join("")].time) < 0) {
                                        best_times[thistrack][conditions.join("")] = { time: run.time, player: run.player }
                                    }
                                } else {
                                    best_times[thistrack][conditions.join("")] = { time: run.time, player: run.player }
                                }
                            }
                        })
                        race.runs.forEach(run => {
                            let player_run = {}
                            if ((run.player == player || player == "global") && thistrack == track) {
                                player_run = {
                                    match: tourney_tournaments_data[match.tourney].nickname + " " + match.bracket + " " + (match.round ? match.round : ""),
                                    time: run.time,
                                    pod: run.pod,
                                    race: num + 1,
                                    conditions: conditions,
                                    temppod: temppod,
                                    deaths: run.deaths,
                                    pick: Object.values(race.events).filter(e => e.event == 'selection' && e.type == 'track')[0].player == run.player,
                                    winner: player_run.player == winner.player,
                                    opponents: (["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) ? [] : players.filter(p => p !== run.player),
                                    player: run.player
                                }
                            }
                            if (player_run.hasOwnProperty("time")) {
                                player_runs.push(player_run)
                            }
                        })
                        if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type) && winner.player !== null) {
                            stats.players[winner.player].races.won++
                            stats.players[winner.player].tracks[thistrack].wins.push(1)
                            stats.players[winner.player].pods[winner.pod].wins.push(1)
                            stats.racer[winner.pod].wins.push(1)
                            if (winner.player == player) {
                                accomp.win.count++
                            }
                            if (winner.player == Object.values(race.events).filter(e => e.event == 'selection' && e.type == 'track')[0].player) {
                                stats.track[thistrack].wins.push(1)
                            } else {
                                stats.track[thistrack].wins.push(0)
                            }
                            race.runs.forEach(loser => {
                                if (loser.player !== winner.player) {
                                    stats.players[loser.player].races.lost++
                                    stats.players[loser.player].tracks[thistrack].wins.push(0)
                                    stats.players[loser.player].pods[loser.pod].wins.push(0)
                                    stats.racer[loser.pod].wins.push(0)
                                    if (loser.player == player) {
                                        accomp.win.streaks.push(accomp.win.count)
                                        accomp.win.count = 0
                                    }
                                }
                            })
                            score[winner.player]++
                            let scores = Object.keys(score)
                            scores.forEach(p => {
                                if (p == player) {
                                    if (comeback[p] == undefined) {
                                        comeback[p] = { low: null, high: null, lowrace: 0, op_low: null, op_high: null, match: tourney_tournaments_data[match.tourney].nickname + " " + match.bracket }
                                        if (match.round !== undefined) {
                                            comeback[p].match += " " + match.round
                                        }
                                    }
                                    scores.forEach(o => {
                                        if (o !== p) {
                                            let dif = score[p] - score[o]
                                            comeback[p].op = o
                                            if (dif < 0 && (comeback[p].low == null || (dif <= comeback[p].low && num > comeback[p].lowrace))) {
                                                comeback[p].low = dif
                                                comeback[p].lowrace = num
                                                comeback[p].op_low = score[o]
                                                comeback[p].p_low = score[p]
                                            } else if (dif > 0 && (comeback[p].high == null || (dif >= comeback[p].high && num > comeback[p].lowrace))) {
                                                comeback[p].high = dif
                                                comeback[p].op_high = score[o]
                                                comeback[p].p_high = score[p]
                                            }
                                        }
                                    })
                                }
                            })
                        }

                    })
                    if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                        let match_winner = { player: null, score: null }
                        let scores = Object.keys(score)
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
                        if (comeback[player] !== undefined && ![comeback[player].high, comeback[player].low].includes(null) && comeback[player].high - comeback[player].low > 2 && comeback[player].op_high >= comeback[player].op_low) {
                            accomp.comebacks.push(comeback[player])
                        }
                    }
                })
                accomp.comebacks.sort((a, b) => {
                    if (a.low == b.low) {
                        return b.p_low - a.p_low
                    } else {
                        return a.low - b.low
                    }
                })
                //assemble embed
                let ranks = tools.getRanks()
                if (stats.matches.total > 0) {
                    if (player == "global") {
                        tourneyReport
                            .setDescription("⏱️ Total Race Time: `" + tools.timefix(stats.race_time) + "`\n💀 Average Deaths/Race: `" + (stats.deaths.reduce((a, b) => { return a + b }) / stats.races.total).toFixed(2) + "`")
                            .addField(":crossed_swords: Matches", "total: `" + stats.matches.total + "`\n" +
                                "qualifying: `" + stats.matches.qual + "`\n" +
                                "winners: `" + stats.matches.winners + "`\n" +
                                "losers: `" + stats.matches.losers + "`", true)
                            .addField(":checkered_flag: Races", "total: `" + stats.races.total + "`\n" +
                                "runbacks: `" + stats.races.runbacks + "`\n" +
                                "dnf: `" + stats.races.dnf + "`", true)
                            .addField(":asterisk: Overrides", "total: `" + Object.values(stats.overrides).reduce((p, c) => p + c) + "`\n" + Object.keys(stats.overrides).map(o => o + ": `" + stats.overrides[0] + "`\n"), true)
                    } else {
                        let description = ""
                        if (ranks[player] !== undefined) {
                            (ranks[player].matches >= 4) ? "⭐ Elo Rating: `" + (ranks[player].rank).toFixed(1) + " (" + ((ranks[player].change >= 0) ?
                                "🔺" + (ranks[player].change).toFixed(1) + ")`\n" :
                                description += "🔻" + Math.abs((ranks[player].change)).toFixed(1) + ")`\n") :
                                ranks[player].matches > 0 ? "⭐ Elo Rating: Unranked\n" : ""
                        }
                        if (stats.players[player].matches.total > 0) {
                            description += "⏱️ Total Race Time: `" + tools.timefix(stats.players[player].race_time) + "`\n💀 Average Deaths/Race: `" + (stats.players[player].deaths.reduce((a, b) => { return a + b }) / stats.players[player].races.total).toFixed(2) + "`"
                        }
                        if (stats.commentators[player] !== undefined) {
                            description += "\n🎙️ Matches Commentated: `" + stats.commentators[player].count + "`"
                            if (stats.commentators[player].count > 30) {
                                accomplishments.push("🎙️ Over 30 **Matches Commentated**")
                            }
                        }
                        let ttd = Object.values(tourney_tournaments_data)
                        ttd.forEach(tourney => {
                            if (tourney.standings) {
                                let standings = Object.values(tourney.standings)
                                for (i = 0; i < standings.length && i < 5; i++) {
                                    if (standings[i] == player) {
                                        if (i == 0) {
                                            accomplishments.push(":trophy: **Winner <:P1:671601240228233216>** of " + tourney.nickname + " Tourney")
                                        } else {
                                            accomplishments.push(":trophy: **Finished " + tools.ordinalSuffix(i) + "** in " + tourney.nickname + " Tourney")
                                        }
                                    }
                                }
                            }
                            if (tourney.hasOwnProperty("rookie")) {
                                if (tourney.rookie == Number(player)) {
                                    accomplishments.push(":beginner: " + tourney.name + "'s **Rookie of the Season**")
                                }
                            }
                            if (tourney.hasOwnProperty("predictions")) {
                                let predictions = Object.values(tourney.predictions)
                                if (predictions.includes(Number(player))) {
                                    accomplishments.push(":crystal_ball: **Best Prediction** for " + tourney.name)
                                }
                            }
                        })
                        accomp.win.streaks.push(accomp.win.count)
                        accomp.deathless.streaks.push(accomp.deathless.count)
                        let win_streak = 0, deathless_streak = 0
                        for (i = 0; i < accomp.win.streaks.length; i++) {
                            let streak = accomp.win.streaks[i]
                            if (streak > win_streak) {
                                win_streak = streak
                            }
                        }
                        for (i = 0; i < accomp.deathless.streaks.length; i++) {
                            let streak = accomp.deathless.streaks[i]
                            if (streak > deathless_streak) {
                                deathless_streak = streak
                            }
                        }
                        //tourney record
                        let player_records = {}
                        Object.values(best_times).forEach(track => {
                            Object.values(track).forEach(record => {
                                if (Number(record.player) == Number(player)) {
                                    if (player_records[record] == undefined) {
                                        player_records[record] = []
                                    }
                                    player_records[record].push(track)
                                }
                            })
                        })
                        let player_conditions = Object.keys(player_records)
                        let record_conditions = {
                            sk: "Skips", fl: "Fast Lap", nu: "No Upgrades", ft: "Full Track", tt: "Total Time", mu: "Max Upgrades"
                        }
                        player_conditions.forEach(condition => {
                            if (player_records[condition].length > 5) {
                                accomplishments.push(":stopwatch: " + record_conditions[condition] + "** Record-Holder** on " + player_records[condition].length + " Tracks!")
                            } else {
                                let player_tracks = []
                                player_records[condition].forEach(t => {
                                    player_tracks.push(planets[tracks[Number(t)].planet].emoji + " " + tracks[Number(t)].nickname[0].toUpperCase())
                                })
                                accomplishments.push(":stopwatch: " + record_conditions[condition] + "** Record-Holder** on " + player_tracks.join(", "))
                            }
                        })

                        //win/deathless streak
                        if (win_streak >= 5) {
                            let winstring = ":crown: " + win_streak + "-Race **Win Streak**"
                            if (accomp.win.count > 0) {
                                winstring += " (Current streak: " + accomp.win.count + ")"
                            }
                            accomplishments.push(winstring)
                        }
                        if (deathless_streak >= 5) {
                            let deathstring = ":skull: " + deathless_streak + "-Race **Deathless Streak**"
                            if (accomp.win.count > 0) {
                                deathstring += " (Current streak: " + accomp.deathless.count + ")"
                            }
                            accomplishments.push(deathstring)
                        }
                        for (i = 0; i < accomp.comebacks.length; i++) {
                            let comeback = accomp.comebacks[i]
                            accomplishments.push("↩️ " + comeback.p_low + "-" + comeback.op_low + " to " + comeback.p_high + "-" + comeback.op_high + " **Comeback** vs " + tourney_participants_data[comeback.op].name + " (" + comeback.match + ")")
                            if (i == 2 && accomp.comebacks.length > 3) {
                                accomplishments.push("+" + (accomp.comebacks.length - i) + " More ↩️ **Comebacks**")
                                i = accomp.comebacks.length
                            }
                        }
                        //track/pod deathless, lossless
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
                            let stringy = []
                            array.forEach(item => {
                                stringy.push(planets[tracks[item].planet].emoji + " " + tracks[item].nickname[0].toUpperCase())
                            })
                            return stringy.join(", ")
                        }
                        function getPodNicknames(array) {
                            let stringy = []
                            array.forEach(item => {
                                stringy.push(racers[item].flag)
                            })
                            return stringy.join(", ")
                        }
                        if (accomp.win.tracks.length > 0) {
                            accomplishments.push(":crown: **Never Lost** on " + (accomp.win.tracks.length == 1 ? planets[tracks[accomp.win.tracks[0]].planet].emoji + " " + tracks[accomp.win.tracks[0]].name : getTrackNicknames(accomp.win.tracks)))
                        }
                        if (accomp.win.pods.length > 0) {
                            accomplishments.push(":crown: **Never Lost** as " + (accomp.win.pods.length == 1 ? racers[accomp.win.pods[0]].flag + " " + racers[accomp.win.pods[0]].name : getPodNicknames(accomp.win.pods)))
                        }
                        if (accomp.deathless.tracks.length > 0) {
                            accomplishments.push(":skull: **Never Died** on " + (accomp.deathless.tracks.length == 1 ? planets[tracks[accomp.deathless.tracks[0]].planet].emoji + " " + tracks[accomp.deathless.tracks[0]].name : getTrackNicknames(accomp.deathless.tracks)))
                        }
                        if (accomp.deathless.pods.length > 0) {
                            accomplishments.push(":skull: **Never Died** as " + (accomp.deathless.pods.length == 1 ? racers[accomp.deathless.pods[0]].flag + " " + racers[accomp.deathless.pods[0]].name : getPodNicknames(accomp.deathless.pods)))
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
                        }
                        if (accomplishments.length > 0) {
                            let accompstring = ""
                            for (i = 0; i < accomplishments.length; i++) {
                                let accomp = accomplishments[i]
                                if (accompstring.length + accomp.length > 1024) {
                                    accompstring += "+" + (accomplishments.length - i) + " More **🏅 Accomplishment(s)**"
                                    i = accomplishments.length
                                } else {
                                    accompstring += accomp + "\n"
                                }
                            }
                            if (accompstring.length >= 1024) {
                                accompstring = accompstring.substring(0, 1020) + "..."
                            }
                            tourneyReport.addField(":medal: Accomplishments", accompstring, false)
                        }
                    }

                }
                let track_selections = []
                let racer_selections = []
                let player_selections = []

                //sort player select
                let players = Object.keys(tourney_participants_data)
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
                    let p = players[i]
                    let option_default = false
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
                    let description = ""
                    if (player == "global" || p == player) {
                        if (ranks[p] !== undefined && ranks[p].matches >= 4) {
                            description += "⭐ " + ranks[p].rank.toFixed(1) + " "
                        } else if (stats.players[p].matches.total > 0) {
                            description += "⭐ Unranked "
                        }
                        if (stats.players[p].matches.total > 0) {
                            let deaths = stats.players[p].deaths.reduce((a, b) => { return a + b })
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
                                let r1 = ranks[player].rank
                                let r2 = ranks[p].rank
                                let p1 = 1 / (1 + 10 ** ((r2 - r1) / 400))
                                //let p2 = 1 - p1
                                function getK(matches) {
                                    let k = 25
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
                                let k1 = getK(ranks[player].matches)
                                //let k2 = getK(ranks[p].matches)
                                let potential_win = k1 * (1 - p1)
                                let potential_loss = k1 * (0 - p1)
                                description += "⭐ " + Math.round(p1 * 100) + "% +" + potential_win.toFixed(1) + "/" + potential_loss.toFixed(1) + " "
                            }
                        }
                        if (stats.players[player].opponents[p]) {
                            if (stats.players[player].opponents[p].matches > 0) {
                                description += "⚔️ " + stats.players[player].opponents[p].matches + " 🏁 " + stats.players[player].opponents[p].races + " 👑 " + Math.round(stats.players[player].opponents[p].wins.reduce((a, b) => { return a + b }) * 100 / stats.players[player].opponents[p].wins.length) + "% ⏱️ "
                                let diff = stats.players[player].opponents[p].times.reduce((a, b) => { return a + b }) / stats.players[player].opponents[p].times.length
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
                    let prefix = ""
                    let pos = ["1st", "2nd", "3rd"]
                    let emojis = [{ name: "P1", id: "671601240228233216" }, { name: "P2", id: "671601321257992204" }, { name: "P3", id: "671601364794605570" }, { name: "4️⃣" }, { name: "5️⃣" }, { name: "6️⃣" }, { name: "7️⃣" }, { name: "8️⃣" }, { name: "9️⃣" }, { name: "🔟" }]
                    let emoji = {}
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
                let sort_selections = [
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
                for (let i = 0; i < 25; i++) {
                    description = ""
                    if (player == "global") {
                        description = [
                            ("▶️ " + stats.racer[i].plays) + (" (" + Math.round((stats.racer[i].plays / stats.races.total) * 100) + "%)"),
                            (stats.racer[i].picks.length > 0 ? description += "👆 " + Math.round((stats.racer[i].picks.reduce((a, b) => { return a + b }) / stats.racer[i].picks.length) * 100) + "%" : "👆 --%"),
                            (stats.racer[i].bans.length > 0 ? "❌ " + Math.round((stats.racer[i].bans.reduce((a, b) => { return a + b }) / stats.racer[i].bans.length) * 100) + "%" : "❌ --%"),
                            (stats.racer[i].wins.length > 0 ? "👑 " + Math.round((stats.racer[i].wins.reduce((a, b) => { return a + b }) / stats.racer[i].wins.length) * 100) + "%" : "👑 --%"),
                            (stats.racer[i].deaths.length > 0 ? "💀 " + (stats.racer[i].deaths.reduce((a, b) => { return a + b }) / stats.racer[i].deaths.length).toFixed(2) : "💀 --"),
                            (stats.racer[i].nu > 0 ? "🐢 " + stats.racer[i].nu : ""),
                            (stats.racer[i].skips > 0 ? "⏩ " + stats.racer[i].skips : "")
                        ].join(" ")
                    } else {
                        description = [
                            ("▶️ " + stats.players[player].pods[i].plays + " (" + Math.round((stats.players[player].pods[i].plays / stats.players[player].races.total) * 100) + "%)"),
                            (stats.players[player].pods[i].picks.length > 0 ? "👆 " + Math.round((stats.players[player].pods[i].picks.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].picks.length) * 100) + "%" : "👆 --%"),
                            (stats.players[player].pods[i].bans.length > 0 ? "❌ " + Math.round((stats.players[player].pods[i].bans.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].bans.length) * 100) + "%" : "❌ --%"),
                            (stats.players[player].pods[i].wins.length > 0 ? "👑 " + Math.round((stats.players[player].pods[i].wins.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].wins.length) * 100) + "%" : "👑 --%"),
                            (stats.players[player].pods[i].deaths.length > 0 ? "💀 " + (stats.players[player].pods[i].deaths.reduce((a, b) => { return a + b }) / stats.players[player].pods[i].deaths.length).toFixed(2) : "💀 --"),
                            (stats.players[player].pods[i].nu > 0 ? "🐢  " + stats.players[player].pods[i].nu : ""),
                            (stats.players[player].pods[i].skips > 0 ? "⏩  " + stats.players[player].pods[i].skips : "")
                        ].join(" ")
                    }
                    let racer_option = {
                        label: racers[i].name,
                        value: i,
                        description: description,
                        emoji: {
                            name: racers[i].flag.split(":")[1],
                            id: racers[i].flag.split(":")[2].replace(">", "")
                        }
                    }
                    let description = ""
                    if (player == "global") {
                        description = [
                            ("▶️ " + stats.track[i].plays + " (" + Math.round((stats.track[i].plays / stats.races.total) * 100) + "%)"),
                            (stats.track[i].picks.length > 0 ? "👆 " + Math.round((stats.track[i].picks.reduce((a, b) => { return a + b }) / stats.track[i].picks.length) * 100) + "%" : "👆 --%"),
                            (stats.track[i].bans.length > 0 ? "❌ " + Math.round((stats.track[i].bans.reduce((a, b) => { return a + b }) / stats.track[i].bans.length) * 100) + "%" : "❌ --%"),
                            (stats.track[i].wins.length > 0 ? "👑 " + Math.round((stats.track[i].wins.reduce((a, b) => { return a + b }) / stats.track[i].wins.length) * 100) + "%" : "👑 --%"),
                            (stats.track[i].deaths.length > 0 ? "💀 " + (stats.track[i].deaths.reduce((a, b) => { return a + b }) / stats.track[i].deaths.length).toFixed(2) : "💀 --"),
                            (stats.track[i].nu > 0 ? "🐢  " + stats.track[i].nu : ""),
                            (stats.track[i].skips > 0 ? "⏩  " + stats.track[i].skips : ""),
                            (stats.track[i].runbacks > 0 ? "🔁  " + stats.track[i].runbacks : "")
                        ].join(" ")
                    } else {
                        description = [
                            ("▶️ " + stats.players[player].tracks[i].plays + " (" + Math.round((stats.players[player].tracks[i].plays / stats.players[player].races.total) * 100) + "%)"),
                            (stats.players[player].tracks[i].picks.length > 0 ? "👆 " + Math.round((stats.players[player].tracks[i].picks.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].picks.length) * 100) + "%" : "👆 --%"),
                            (stats.players[player].tracks[i].bans.length > 0 ? "❌ " + Math.round((stats.players[player].tracks[i].bans.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].bans.length) * 100) + "%" : "❌ --%"),
                            (stats.players[player].tracks[i].wins.length > 0 ? "👑 " + Math.round((stats.players[player].tracks[i].wins.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].wins.length) * 100) + "%" : "👑 --%"),
                            (stats.players[player].tracks[i].deaths.length > 0 ? "💀 " + (stats.players[player].tracks[i].deaths.reduce((a, b) => { return a + b }) / stats.players[player].tracks[i].deaths.length).toFixed(2) : "💀 --"),
                            (stats.players[player].tracks[i].nu > 0 ? "🐢  " + stats.players[player].tracks[i].nu : ""),
                            (stats.players[player].tracks[i].skips > 0 ? " ⏩  " + stats.players[player].tracks[i].skips : ""),
                            (stats.players[player].tracks[i].runbacks > 0 ? " 🔁  " + stats.players[player].tracks[i].runbacks : "")
                        ]
                    }
                    let track_option = {
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
                    return stats.racer[b.value].plays - stats.racer[a.value].plays
                })
                track_selections = track_selections.sort(function (a, b) {
                    return stats.track[b.value].plays - stats.track[a.value].plays
                })
                if (player == "global") {
                    if (sort == "plays") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.racer[b.value].plays - stats.racer[a.value].plays
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.track[b.value].plays - stats.track[a.value].plays
                        })
                    } else if (sort == "picks") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.racer[a.value].picks, stats.racer[b.value].picks)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.track[a.value].picks, stats.track[b.value].picks)
                        })
                    } else if (sort == "bans") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.racer[a.value].bans, stats.racer[b.value].bans)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.track[a.value].bans, stats.track[b.value].bans)
                        })
                    } else if (sort == "wins") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.racer[a.value].wins, stats.racer[b.value].wins)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.track[a.value].wins, stats.track[b.value].wins)
                        })
                    } else if (sort == "deaths") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return getSort(stats.racer[a.value].deaths, stats.racer[b.value].deaths)
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return getSort(stats.track[a.value].deaths, stats.track[b.value].deaths)
                        })
                    } else if (sort == "nu") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.racer[b.value].nu - stats.racer[a.value].nu
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.track[b.value].nu - stats.track[a.value].nu
                        })
                    } else if (sort == "skips") {
                        racer_selections = racer_selections.sort(function (a, b) {
                            return stats.racer[b.value].skips - stats.racer[a.value].skips
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            return stats.track[b.value].skips - stats.track[a.value].skips
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
                            let a_stuff = racers[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            let b_stuff = racers[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            let a_stuff = tracks[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            let b_stuff = tracks[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
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
                            let a_stuff = racers[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            let b_stuff = racers[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                        track_selections = track_selections.sort(function (a, b) {
                            let a_stuff = tracks[Number(a.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            let b_stuff = tracks[Number(b.value)].name.replace("'", "").replace("The ", "").toLowerCase()
                            if (a_stuff < b_stuff) { return -1; }
                            if (a_stuff > b_stuff) { return 1; }
                            return 0;
                        })
                    }
                }
                let components = []
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
                    }
                )
                if (player == "global" || stats.players[player].matches.total > 0) {
                    components.push({
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
                }

                if (track == null && (stats.matches.total > 0 || stats.players[player].matches.total) > 0) {
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
                    let run_list = []
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
                        let run_option = {
                            label: tools.timefix(player_runs[i].time) + " ",
                            value: i,
                            description: player_runs[i].match + " Race " + player_runs[i].race
                        }
                        if (player == "global") {
                            run_option.description = tourney_participants_data[player_runs[i].player].name + " | " + player_runs[i].match + " Race " + player_runs[i].race
                        }
                        if (player_runs[i].pick) {
                            run_option.label += "👆"
                        }
                        let condemojis = { skips: "⏩", nu: "🐢" }
                        player_runs[i].conditions.forEach(condition => {
                            run_option.label += condemojis[condition]
                        })

                        if (player_runs[i].winner) {
                            run_option.label += "👑"
                        }
                        if (player_runs[i].deaths == 1) {
                            run_option.label += "💀"
                        } else if (player_runs[i].deaths > 1) {
                            run_option.label += "💀×" + player_runs[i].deaths + " "
                        }
                        if (player_runs[i].temppod.length > 0) {
                            run_option.label += " ❌"
                            let tempstring = []
                            player_runs[i].temppod.forEach(ban => {
                                tempstring.push(racers[ban].nickname[1])
                            })
                            run_option.label += tempstring.join(", ")
                        }
                        if (player_runs[i].opponents.length > 0) {
                            run_option.description += " vs "
                            let opponents = []
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
        } else if (args[0] == "play") {
            let type = 7
            let livematch = {}
            let liverules

            let livematchref = database.ref('tourney/live/' + interaction.channel_id)
            livematchref.on('value', (snapshot) => {
                livematch = snapshot.val()
            }, (error) => {
                console.log('the read failed: ' + error.name)
            })

            if (livematch) {
                liverules = tourney_rulesets_data.saved[livematch.ruleset]
            }

            let methods = {
                poe_c: "Process of Elimination by Circuit",
                poe_p: "Process of Elimination by Planet",
                poe_t: "Process of Elimination by Track",
                random: "Random",
                already: "Already Decided",
                gents: "Gentleman's Agreement"
            }

            let firsts = {
                poe_c: { label: "Process of Elimination by Circuit", description: "Alternate circuit bans then track bans until one option remains" },
                poe_p: { label: "Process of Elimination by Planet", description: "Alternate planet bans then track bans until one option remains" },
                poe_t: { label: "Process of Elimination by Track", description: "Alternate track bans until one option remains" },
                random: { label: "Random", description: "First track is randomly decided by Botto" }
            }

            let trackgroups = {
                amc: { name: "Amateur Circuit", type: "circuit", code: 0, count: 7 },
                spc: { name: "Semi-Pro Circuit", type: "circuit", code: 1, count: 7 },
                gal: { name: "Galactic Circuit", type: "circuit", code: 2, count: 7 },
                inv: { name: "Invitational Circuit", type: "circuit", code: 3, count: 4 },
                and: { name: "Ando Prime", type: "planet", code: 0, count: 4 },
                tat: { name: "Tatooine", type: "planet", code: 7, count: 2 },
                oov: { name: "Oovo IV", type: "planet", code: 5, count: 3 },
                ord: { name: "Ord Ibanna", type: "planet", code: 6, count: 3 },
                bar: { name: "Baroonda", type: "planet", code: 2, count: 4 },
                mon: { name: "Mon Gazza", type: "planet", code: 4, count: 3 },
                aqu: { name: "Aquilaris", type: "planet", code: 1, count: 3 },
                mal: { name: "Malastare", type: "planet", code: 3, count: 3 }
            }

            let condition_names = {
                ft: "Full Track",
                sk: "Skips",
                mu: "Upgrades Allowed",
                nu: "No Upgrades",
                mi: "Mirrored",
                um: "Unmirrored",
                l1: "1 Lap",
                l2: "2 Laps",
                l3: "3 Laps",
                l4: "4 Laps",
                l5: "5 Laps",
                tt: "Total Time",
                fl: "Fastest Lap"
            }

            function getTrackOption(i) {
                return (
                    {
                        label: tracks[i].name,
                        value: i,
                        description: [circuits[tracks[i].circuit].abbreviation + " - Race " + tracks[i].cirnum, planets[tracks[i].planet].name, difficulties[tracks[i].difficulty].name, tracks[i].lengthclass].join(" | "),
                        emoji: {
                            name: planets[tracks[i].planet].emoji.split(":")[1],
                            id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                        }
                    }
                )
            }

            function getRacerOption(i) {
                let muspeed = tools.avgSpeed(tools.upgradeTopSpeed(racers[i].max_speed, 5), racers[i].boost_thrust, racers[i].heat_rate, tools.upgradeCooling(racers[i].cool_rate, 5)).toFixed(0)
                let nuspeed = tools.avgSpeed(tools.upgradeTopSpeed(racers[i].max_speed, 0), racers[i].boost_thrust, racers[i].heat_rate, tools.upgradeCooling(racers[i].cool_rate, 0)).toFixed(0)
                return (
                    {
                        label: racers[i].name,
                        value: i,
                        description: 'Avg Speed ' + muspeed + ' (NU ' + nuspeed + "); Max Turn " + racers[i].max_turn_rate + "°/s",
                        emoji: {
                            name: racers[i].flag.split(":")[1],
                            id: racers[i].flag.split(":")[2].replace(">", "")
                        }
                    }
                )
            }

            function getFirstOptions(liverules) {

                let firstoptions = [
                    {
                        label: "Already Decided",
                        description: "Both players have already agreed to the starting track",
                        value: "already"
                    },
                    {
                        label: firsts[liverules.general.firsttrack.primary].label + " (Default)",
                        value: liverules.general.firsttrack.primary,
                        description: firsts[liverules.general.firsttrack.primary].description
                    }
                ]
                if (![undefined, null, ""].includes(liverules.general.firsttrack.secondary)) {
                    Object.values(liverules.general.firsttrack.secondary).forEach(first => firstoptions.push(
                        {
                            label: firsts[first].label,
                            description: firsts[first].description,
                            value: first
                        }
                    ))
                }
                return (firstoptions)
            }

            function getOpponent(player) {
                let opponent = Object.values(livematch.players).filter(p => p != player)
                return opponent[0]
            }

            function getWinner(race) {
                let players = Object.values(livematch.players)
                let winner = null
                if (livematch.races[race].runs[players[0]].time.toLowerCase() == "dnf") {
                    winner = players[1]
                } else if (livematch.races[race].runs[players[1]].time.toLowerCase() == "dnf") {
                    winner = players[0]
                } else if (Number(livematch.races[race].runs[players[0]].time) < Number(livematch.races[race].runs[players[1]].time)) {
                    winner = players[0]
                } else if (Number(livematch.races[race].runs[players[1]].time) < Number(livematch.races[race].runs[players[0]].time)) {
                    winner = players[1]
                }
                return winner
            }

            function getForcePoints(player) {
                //livematch = tourney_live_data[interaction.channel_id]
                let forcepoints = Number(liverules.match.forcepoints.start)
                let races = Object.values(livematch.races)
                races.forEach(race => {
                    if (![null, undefined, ""].includes(race.events)) {
                        let events = Object.values(race.events)
                        events.forEach(event => {
                            if (event.player == player && ![null, undefined, ""].includes(event.cost)) {
                                forcepoints -= Number(event.cost)
                            }
                        })
                    }
                })
                return forcepoints
            }

            function getRunbacks(player) {
                //livematch = tourney_live_data[interaction.channel_id]
                let runbacks = liverules.match.repeattrack.limit
                Object.values(livematch.races).forEach((race) => {
                    if (![null, undefined, ""].includes(race.events)) {
                        Object.values(race.events).forEach(event => {
                            if (event.player == player && event.event == 'selection' && event.type == 'track' && event.repeat == true) {
                                runbacks--
                            }
                        })
                    }
                })
                return runbacks
            }

            function updateMessage(content, type, embeds, components) {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            content: content,
                            embeds: embeds,
                            components: components

                        }
                    }
                })
            }

            function followupMessage(content, embeds, components) {
                client.api.webhooks(client.user.id, interaction.token).post({
                    data: {
                        content: content,
                        embeds: embeds,
                        components: components
                    }
                })
            }

            function postMessage(content, embeds, components) {
                client.api.channels(interaction.channel_id).messages.post({
                    data: {
                        content: content,
                        embeds: embeds,
                        components: components
                    }
                })
            }

            function ephemeralMessage(content, embeds, components) {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            flags: 64,
                            content: content,
                            embeds: embeds,
                            components: components

                        }
                    }
                })
            }

            function countDown() {
                //postMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>", [], [])
                for (let i = 0; i <= 5; i++) {
                    setTimeout(async function () {
                        client.api.channels(interaction.channel_id).messages.post({
                            data: {
                                content: (i == 5 ? "*GO!*" : (5 - i)),
                                tts: i == 5
                            }
                        })
                    }, 3000 + i * 1000)
                }
            }

            function setupEmbed() {
                //livematch = tourney_live_data[interaction.channel_id]
                matchMaker = new Discord.MessageEmbed()
                    .setTitle("Match Setup")
                    .setDescription("🏆 Tournament: " + (livematch.tourney == "" ? "" : livematch.tourney == "practice" ? "`Practice Mode`" : "`" + tourney_tournaments_data[livematch.tourney].name + "`") + "\n" +
                        (livematch.tourney == "practice" ? "" : "⭕ Bracket/Round: " + (livematch.bracket == "" || livematch.tourney == "practice" ? "" : "`" + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].bracket + " " + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].round + "`") + "\n") +
                        "📜 Ruleset: " + (livematch.ruleset == "" ? "" : "`" + tourney_rulesets_data.saved[livematch.ruleset].general.name + "`") + "\n" +
                        "👥 Players: " + ([null, undefined, ""].includes(livematch.players) ? "" : Object.values(livematch.players).map(id => "<@" + id + "> ")) + "\n" +
                        "🎙️ Commentators/Trackers: " + ([null, undefined, ""].includes(livematch.commentators) ? "" : Object.values(livematch.commentators).map(id => "<@" + id + "> ")) + "\n" +
                        "📺 Stream: " + livematch.stream
                    )
                    .setColor("#3BA55D")
                    .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")

                return matchMaker
            }

            function firstEmbed() {
                //livematch = tourney_live_data[interaction.channel_id]
                const embed = new Discord.MessageEmbed()
                    .setAuthor("First Track")
                    .setTitle("How would you like to determine the first track?")
                    .setDescription("*If players do not agree on a method, the default option will be used.*\n" + ([undefined, null].includes(livematch.firstvote) ? "" : Object.keys(livematch.firstvote).map(key => "<@" + key + "> voted for **" + methods[livematch.firstvote[key]] + "**").join("\n")))
                return embed
            }

            function colorEmbed() {
                //livematch = tourney_live_data[interaction.channel_id]
                const embed = new Discord.MessageEmbed()
                    .setAuthor("First Track: " + methods[livematch.firstmethod])
                    .setTitle("Pick a color")
                    .setDescription("" + ([undefined, null].includes(livematch.firstcolors) ? "" : Object.keys(livematch.firstcolors).map(key => ":" + livematch.firstcolors[key] + "_square: - <@" + key + ">").join("\n")))
                return embed
            }

            function firstbanEmbed() {
                //livematch = tourney_live_data[interaction.channel_id]
                const embed = new Discord.MessageEmbed()
                    .setAuthor("First Track: " + methods[livematch.firstmethod])
                    .setDescription("" + ([undefined, null].includes(livematch.firstbans) ? "" :
                        Object.keys(livematch.firstbans).map(key =>
                            "<@" + livematch.firstbans[key].player + "> banned **" +
                            ([undefined, null].includes(trackgroups[livematch.firstbans[key].ban]) ? planets[tracks[Number(livematch.firstbans[key].ban)].planet].emoji + " " + tracks[Number(livematch.firstbans[key].ban)].name : trackgroups[livematch.firstbans[key].ban].name) + "**"
                        ).join("\n")))
                return embed
            }

            function raceEmbed(race) {
                //livematch = tourney_live_data[interaction.channel_id]
                let track = ""
                let repeat = false
                let events = Object.values(livematch.races[race].events)
                let conditions = Object.values(liverules.general.default)
                events.forEach(event => {
                    if (event.event == "selection" && event.type == "track") {
                        track = Number(event.selection)
                        if (event.repeat) {
                            repeat = true
                        }
                    }
                    if (event.event == "override" && event.type == "condition") {
                        if (event.selection == "sk") {
                            conditions[conditions.indexOf('ft')] = "sk"
                        } else if (event.selection == "nu") {
                            conditions[conditions.indexOf('mu')] = "nu"
                        } else if (event.selection == "fl") {
                            conditions[conditions.indexOf('tt')] = "fl"
                        }
                    }
                })
                let forces = events.filter(event => event.event == 'override' && event.type == 'condition').map(event => tools.capitalize(condition_names[event.selection]))
                if (repeat) {
                    forces.push('Runback')
                }
                if (livematch.races[race].gents?.agreed) {
                    forces.push("🎩 Gentleman's Agreement")
                }
                let conmap = conditions.map(con => "`" + condition_names[con] + "`").join(" ")
                const embed = new Discord.MessageEmbed()
                    .setTitle((repeat ? "🔁" : planets[tracks[track].planet].emoji) + " " + tracks[track].name + (forces.length > 0 ? " (" + forces.join(", ") + ")" : ""))
                    .setThumbnail(tracks[track].preview)
                    .setDescription(conmap + ([null, undefined, ""].includes(livematch.races[race].gents) ? "" : "\n🎩 " + livematch.races[race].gents.terms))
                if (Object.values(livematch.races[race].ready).filter(r => r == false).length == 0) {
                    if (livematch.races[race].live) {
                        embed
                            .setAuthor("Race " + (race + 1) + " - In Progress")
                            .setColor("#DD2E44")
                        Object.values(livematch.players).map(player => embed.addField(
                            getUsername(player),
                            (livematch.races[race].runs[player].time == "" ? ":red_circle: Awaiting submission" :
                                Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length > 0 ? ":green_circle: Results Submitted" :
                                    racers[livematch.races[race].runs[player].pod].flag + " " + racers[Number(livematch.races[race].runs[player].pod)].name + "\n" +
                                    "⏱️ " + (String(livematch.races[race].runs[player]?.time).toLowerCase() == 'dnf' ? 'DNF' : (livematch.races[race].runs[player].time === "" ? "--:--.---" : tools.timefix(livematch.races[race].runs[player].time))) + "\n" +
                                    "💀 " + (livematch.races[race].runs[player].deaths === "" ? "--" : Number(livematch.races[race].runs[player].deaths)) + "\n" +
                                    (livematch.races[race].runs[player].notes == "" ? "" : "📝 " + livematch.races[race].runs[player].notes))
                            ,
                            true))
                        if (Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
                            embed.addField("🎙️ Commentators/Trackers", ":red_circle: Awaiting Verification", false)
                        }

                    } else {
                        embed
                            .setAuthor("Race " + (race + 1) + " - Results")
                            .setColor("#2D7D46")
                        if (![null, undefined, ""].includes(livematch.races[race].runs) && Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
                            let winner = getWinner(race)
                            Object.values(livematch.players).map(player => embed.addField(
                                (player == winner ? "👑 " : "") + getUsername(player),
                                racers[livematch.races[race].runs[player].pod].flag + " " + racers[Number(livematch.races[race].runs[player].pod)].name + "\n" +
                                "⏱️ " + (livematch.races[race].runs[player].time.toLowerCase() == 'dnf' ? 'DNF' : (player == winner ? "__" : "") + tools.timefix(livematch.races[race].runs[player].time) + (player == winner ? "__" : "")) + "\n" +
                                "💀 " + (livematch.races[race].runs[player].deaths == "" ? "--" : Number(livematch.races[race].runs[player].deaths)) + "\n" +
                                (livematch.races[race].runs[player].notes == "" ? "" : "📝 " + livematch.races[race].runs[player].notes),
                                true))
                            embed.setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name + (forces.length > 0 ? " (" + forces.join(", ") + ")" : "") + " \n" + (getUsername(winner)) + " Wins!")
                        }
                    }
                } else {
                    embed
                        .setAuthor("Race " + (race + 1) + " - Setup")
                        .setColor("#FAA81A")
                        .setDescription(conmap + ([null, undefined, ""].includes(livematch.races[race].gents) ? "" : "\n🎩 " + livematch.races[race].gents.terms) + (livematch.races[race].live ? "" : "\nCountdown will automatically start when players and commentators have readied."))
                    Object.values(livematch.players).map(player => embed.addField(
                        getUsername(player),
                        ([undefined, null, ""].includes(livematch.races[race].runs[player].pod) ?
                            ":red_circle: Racer not selected" :
                            ":green_circle: Racer selected " + (livematch.races[race].reveal[player] ?
                                "\n**" + racers[livematch.races[race].runs[player].pod].flag + " " + racers[Number(livematch.races[race].runs[player].pod)].name + "**" : "(hidden)")) + "\n" + (livematch.races[race].ready[player] ?
                                    ":green_circle: Ready" :
                                    ":red_circle: Not Ready"),
                        true))

                    embed.addField("🎙️ Commentators/Trackers", (livematch.races[race].ready.commentators ? ":green_circle: Ready" : ":red_circle: Not Ready"))
                    if (forces.includes("No Upgrades")) {
                        embed.addField("🕹️ Players", ":orange_circle: Don't forget to show your parts to verify upgrades", false)
                    }
                    if (forces.includes("Fastest Lap")) {
                        embed.addField("🕹️ Players", ":orange_circle: Don't forget to delete your `tgdf.dat` file or set your laps to 4", false)
                    }
                }

                return embed
            }

            function matchSummaryEmbed() {
                //livematch = tourney_live_data[interaction.channel_id]
                let summary = {}
                Object.values(livematch.players).forEach(player => {
                    summary[player] = {
                        wins: 0,
                        forcepoints: liverules.match.forcepoints.start,
                        runbacks: liverules.match.repeattrack.limit,
                        deaths: 0,
                        deathtrue: true,
                        time: 0,
                        timetrue: true
                    }
                })
                Object.values(livematch.races).forEach((race, index) => {
                    if (!race.live) {
                        if(getWinner(index)){
                            summary[getWinner(index)].wins++
                        }
                        if (![null, undefined, ""].includes(race.events)) {
                            Object.values(race.events).forEach(event => {
                                if (![null, undefined, ""].includes(event.player)) {
                                    if (![null, undefined, ""].includes(event.cost)) {
                                        summary[event.player].forcepoints -= Number(event.cost)
                                    }
                                    if (event.event == 'selection' && event.type == 'track' && event.repeat == true) {
                                        summary[event.player].runbacks--
                                    }
                                }
                            })
                            Object.values(race.runs).forEach(run => {
                                if (![null, undefined, ""].includes(run.deaths)) {
                                    summary[run.player].deaths += Number(run.deaths)
                                } else {
                                    summary[run.player].deathtrue = false
                                }
                                if (![null, undefined, "", 'DNF'].includes(run.time)) {
                                    summary[run.player].time += Number(run.time)
                                } else {
                                    summary[run.player].timetrue = false
                                }

                            })
                        }
                    }
                }
                )
                let leader = { player: "", wins: 0 }
                Object.keys(summary).forEach(player => {
                    let stats = summary[player]
                    if (stats.wins > leader.wins) {
                        leader.player = player
                        leader.wins = stats.wins
                    } else if (stats.wins == leader.wins) {
                        leader.player = "tie"
                    }
                })
                const embed = new Discord.MessageEmbed()
                    .setAuthor('Match Summary')
                    .setColor("#FFFFFF")
                    .setTitle(
                        leader.player == "tie" ?
                            "Tied Match " + leader.wins + " to " + leader.wins :
                            getUsername(leader.player) + " leads " + leader.wins + " to " + summary[getOpponent(leader.player)].wins + (leader.wins == liverules.general.winlimit - 1 ? " (Match Point)" : ""))
                Object.values(livematch.players).forEach(player => embed.addField(
                    (leader.player == player ? "👑 " : "") + getUsername(player) + " - " + summary[player].wins,
                    '💠 ' + summary[player].forcepoints +
                    (liverules.match.repeattrack ? '\n🔁 ' + summary[player].runbacks : "") +
                    '\n⏱️ ' + tools.timefix(summary[player].time) + (summary[player].timetrue ? "" : "+") + " (total)" +
                    '\n💀 ' + summary[player].deaths + (summary[player].deathtrue ? "" : "+") + " (total)",
                    true
                ))
                embed.addField("🎙️ Commentators/Trackers", ":orange_circle: Don't forget to update the score!", false)
                return embed
            }

            function raceEventEmbed(race) {
                //livematch = tourney_live_data[interaction.channel_id]
                let races = Object.values(livematch.races)
                let events = races[race].events
                let eventstart = livematch.races[race].eventstart
                let ruleevents = Object.values(liverules.race)
                let player = (ruleevents[eventstart].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1)))
                let actions = {
                    permaban: "🚫 perma-banned",
                    tempban: "❌ temp-banned",
                    selection: "👆 selected",
                    override: "✳️ overrode"
                }
                const embed = new Discord.MessageEmbed()
                    .setAuthor("Race " + (race + 1) + " - Ban Phase")
                    .setColor("#FAA81A")
                    .setDescription("" + ([undefined, null, ""].includes(events) ? "" :
                        Object.values(events).map(e =>
                            "<@" + e.player + "> " + actions[e.event] + " a " + e.type + ": **" + (e.type == "track" ?
                                (e.repeat ? "🔁" : planets[tracks[e.selection].planet].emoji) + " " + tracks[e.selection].name :
                                e.type == "racer" ?
                                    Array.isArray(e.selection) ?
                                        e.selection.map(racer => racers[racer].flag + " " + racers[racer].name).join(", ") :
                                        racers[e.selection].flag + " " + racers[e.selection].name :
                                    condition_names[e.selection]) + "**" + ([null, undefined, "", 0].includes(e.cost) ? "" : " for " + e.cost + "💠 forcepoint" + (e.cost == 1 ? "" : "s"))
                        ).join("\n")))

                let summary = {}
                Object.values(livematch.players).forEach(player => {
                    summary[player] = {
                        wins: 0
                    }
                })
                Object.values(livematch.races).forEach((race, index) => {
                    if (index + 1 < Object.values(livematch.races).length) {
                        summary[getWinner(index)].wins++
                    }
                })
                if (getForcePoints(player) > 0 && summary[getOpponent(player)].wins == liverules.general.winlimit - 1) {
                    embed.setFooter("Last chance to use " + getForcePoints(player) + " 💠 forcepoint" + (getForcePoints(player) !== 1 ? "s" : "") + " and " + getRunbacks(player) + " 🔁 runback" + (getRunbacks(player) !== 1 ? "s" : ""))
                } else {
                    embed.setFooter("You have " + getForcePoints(player) + " 💠 forcepoint" + (getForcePoints(player) !== 1 ? "s" : "") + " and " + getRunbacks(player) + " 🔁 runback" + (getRunbacks(player) !== 1 ? "s" : "") + " remaining")
                }

                return embed
            }

            function raceEventComponents(race) {
                //livematch = tourney_live_data[interaction.channel_id]
                let components = []
                let eventstart = livematch.races[race].eventstart
                let eventend = livematch.races[race].eventend
                let events = Object.values(liverules.race)
                let fptotal = 0
                let player = (events[eventstart].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1)))
                let notrack = false
                let oddselect = false
                let repeat = false
                let upg = 5
                for (let i = eventstart; i <= eventend; i++) {
                    let event = events[i]
                    let options = []
                    let default_stuff = []
                    //get defaults
                    interaction.message.components.forEach(component => {
                        let this_args = component.components[0].custom_id.split("_")
                        if (Number(this_args[3].replace("event", "")) == i) {
                            default_stuff = component.components[0].options.filter(option => option.default).map(option => String(option.value).replace("repeat", ""))
                        }
                    })
                    let this_args = interaction.data.custom_id.split("_")
                    if (interaction.data.hasOwnProperty("values") && Number(this_args[3].replace("event", "")) == i) {
                        default_stuff = interaction.data.values.map(value => String(value).replace("repeat", ""))
                    }
                    if (![null, undefined, ""].includes(event.count) && default_stuff.length % event.count !== 0) {
                        oddselect = true
                    }
                    if ([null, undefined, ""].includes(event.cost) || getForcePoints(player) >= event.cost) {
                        if (![null, undefined, ""].includes(event.cost)) {
                            fptotal += (default_stuff.length / event.count) * event.cost
                        }
                        if (event.type == "racer") {
                            let permabanned_racers = Object.values(livematch.races[1].events).filter(event => event.event == "permaban" && event.type == "racer").map(event => Number(event.selection))
                            let tempbanned_racers = Object.values(livematch.races[race].events).filter(event => event.event == "tempban" && event.type == "racer").map(event => Number(event.selection))
                            for (let i = 0; i < 25; i++) {
                                if (i < 23 || (event.event == 'selection' && ((!tempbanned_racers.includes(8) && !permabanned_racers.includes(i) && i == 23) || (!tempbanned_racers.includes(22) && !permabanned_racers.includes(i) && i == 24)))) { //handle secret pods
                                    let option = getRacerOption(i)

                                    if (default_stuff.includes(String(i))) {
                                        option.default = true
                                    }
                                    if (permabanned_racers.includes(i)) {
                                        option.emoji = {
                                            name: "🚫"
                                        }
                                        option.label += " (Perma-banned)"
                                        option.value += "ban"
                                        option.description = "Cannot be selected for the remainder of the match"
                                    } else if (tempbanned_racers.includes(i)) {//hasn't been tempbanned
                                        option.emoji = {
                                            name: "❌"
                                        }
                                        option.label += " (Temp-banned)"
                                        option.value += "ban"
                                        option.description = "Cannot be selected for the current race"
                                    }
                                    options.push(option)
                                }
                            }
                            options = options.sort(function (a, b) {
                                let a_racer = Number(String(a.value).replace("ban", ""))
                                let b_racer = Number(String(b.value).replace("ban", ""))
                                let aspeed = tools.avgSpeed(
                                    tools.upgradeTopSpeed(racers[a_racer].max_speed, upg),
                                    racers[a_racer].boost_thrust,
                                    racers[a_racer].heat_rate,
                                    tools.upgradeCooling(racers[a_racer].cool_rate, upg))
                                let bspeed = tools.avgSpeed(
                                    tools.upgradeTopSpeed(racers[b_racer].max_speed, upg),
                                    racers[b_racer].boost_thrust,
                                    racers[b_racer].heat_rate,
                                    tools.upgradeCooling(racers[b_racer].cool_rate, upg))
                                return bspeed - aspeed
                            })
                        } else if (event.type == "track") {
                            let permabanned_tracks = Object.values(livematch.races[1].events).filter(event => event.event == "permaban" && event.type == "track").map(event => Number(event.selection))
                            let tempbanned_tracks = Object.values(livematch.races[race].events).filter(event => event.event == "tempban" && event.type == "track").map(event => Number(event.selection))
                            let already_played = {}
                            Object.values(livematch.races).forEach((race, index) => {
                                Object.values(race.events).forEach(event => {
                                    if (event.event == 'selection' && event.type == 'track') {
                                        if (already_played[event.selection]) {
                                            already_played[event.selection].played++
                                            already_played[event.selection].loser = getOpponent(getWinner(index))
                                        } else {
                                            already_played[event.selection] = { played: 1, loser: getOpponent(getWinner(index)) }
                                        }
                                    }
                                })
                            })
                            let saltmap = {
                                salty: 1,
                                slatier: 2,
                                saltiest: 3
                            }
                            if (event.event == "selection" && default_stuff.length == 0) {
                                notrack = true
                            }
                            for (let i = 0; i < 25; i++) {
                                let option = getTrackOption(i)
                                if (default_stuff.includes(String(i))) {
                                    option.default = true
                                }
                                if (permabanned_tracks.includes(i)) {
                                    option.emoji = {
                                        name: "🚫"
                                    }
                                    option.label += " (Perma-banned)"
                                    option.value += "ban"
                                    option.description = "Cannot be selected for the remainder of the match"
                                    options.push(option)
                                } else if (tempbanned_tracks.includes(i)) {//hasn't been tempbanned
                                    option.emoji = {
                                        name: "❌"
                                    }
                                    option.label += " (Temp-banned)"
                                    option.value += "ban"
                                    option.description = "Cannot be selected for the current race"
                                    options.push(option)
                                } else if (event.event !== 'selection' && already_played[i] && saltmap[liverules.match.repeattrack.condition] <= already_played[i].played && already_played[i].loser == getOpponent(player) && getRunbacks(getOpponent(player)) > 0) { //not selecting the track but opponent could still runback
                                    option.description = "Already played but your opponent could run it back"
                                    options.push(option)
                                } else if (event.event == 'selection' && already_played[i] && saltmap[liverules.match.repeattrack.condition] <= already_played[i].played && already_played[i].loser == player && getRunbacks(player) > 0) { //selecting the track and it can be runback
                                    option.emoji = {
                                        name: "🔁"
                                    }
                                    option.value += "repeat"
                                    option.label += " (Runback)"
                                    if (option.default) {
                                        repeat = true
                                    }
                                    options.push(option)
                                } else if (already_played[i]) {
                                    option.description = "Already played and cannot be run back"
                                    option.value += "ban"
                                    option.emoji = {
                                        name: "⭕"
                                    }

                                    options.push(option)
                                } else {
                                    options.push(option)
                                }
                            }
                        } else if (event.type == "condition") {
                            let conditions = {
                                nu: { name: 'No Upgrades', desc: "Players must race with stock parts" },
                                sk: { name: 'Skips', desc: "Players can use skips (including AI and MFG skips)" },
                                fl: { name: 'Fastest Lap', desc: "winner is determined by fastest lap time of 3 laps" }
                            }
                            options = Object.values(event.options).map(e => {
                                if (e == 'nu' && default_stuff.includes(e)) {
                                    upg = 0
                                }
                                return (
                                    {
                                        label: condition_names[e],
                                        description: conditions[e].desc,
                                        value: e,
                                        default: default_stuff.includes(e)
                                    }
                                )
                            })
                        }
                        let component = {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "tourney_play_race" + race + "_event" + i,
                                    options: options,
                                    placeholder: tools.capitalize([event.event.replace("selection", "select"), event.type].join(" ")) + ([null, undefined, ""].includes(event.cost) ? "" : " (" + (event.cost == 0 ? "free" : event.cost + "💠/" + (event.count == 1 ? event.type : event.count + " " + event.type + "s")) + ")") + (oddselect ? " (select in sets of " + event.count : ""),
                                    min_values: [undefined, null, ""].includes(event.count) ? 1 : 0,
                                    max_values: [undefined, null, ""].includes(event.count) ? 1 : [undefined, null, ""].includes(event.limit) ? options.length : event.limit == 0 ? options.length : event.count * event.limit
                                }
                            ]
                        }
                        components.push(component)
                    }
                }
                if (components.length > 1) {
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    label: notrack ? "No Track Selected" : (getForcePoints(player) - fptotal < 0) ? "Not enough forcepoints" : oddselect ? "Too many or too few selections" : "Submit" + (fptotal == 0 ? "" : " (" + fptotal + "💠)") + (repeat ? " (🔁)" : ""),
                                    style: 1,
                                    custom_id: "tourney_play_race" + race + "_event_submit",
                                    disabled: (getForcePoints(player) - fptotal < 0) || notrack || oddselect
                                },
                            ]
                        }
                    )
                }
                return components
            }

            function permabanEmbed(permaban) {
                //livematch = tourney_live_data[interaction.channel_id]
                let races = Object.values(livematch.races)
                let events = races[1].events
                const embed = new Discord.MessageEmbed()
                    .setAuthor("Permanent Bans")
                    .setDescription("" + ([undefined, null, ""].includes(events) ? "" :
                        Object.values(events).filter(event => event.event == "permaban").map(ban =>
                            "<@" + ban.player + "> 🚫 perma-banned a " + (ban.type == "track" ? "track: **" + planets[tracks[ban.selection].planet].emoji + " " + tracks[ban.selection].name : "racer: " + racers[ban.selection].flag + " " + racers[ban.selection].name) + "**"
                        ).join("\n")))
                return embed
            }

            function setupComponents() {
                livematch == tourney_live_data[interaction.channel_id]
                let components = []
                let tourney_options = [], bracket_options = [], ruleset_options = []
                let ttd = Object.keys(tourney_tournaments_data)
                tourney_options.push({
                    label: "Practice Mode",
                    value: "practice",
                    emoji: { name: "🚩" }
                })
                ttd.forEach(key => {
                    let tourney = tourney_tournaments_data[key]
                    tourney_options.push(
                        {
                            label: tourney.name,
                            value: key,
                            emoji: { name: "🏆" }
                        }
                    )
                })
                if (livematch.tourney) {
                    if (livematch.tourney == "practice") {
                        let rulesets = Object.keys(tourney_rulesets_data.saved)
                        rulesets.forEach(key => {
                            let ruleset = tourney_rulesets_data.saved[key]
                            ruleset_options.push(
                                {
                                    label: ruleset.general?.name ?? ruleset.name,
                                    value: key,
                                    description: ruleset.general?.description ?? ruleset.description
                                }
                            )
                        })
                    } else {
                        let stages = Object.keys(tourney_tournaments_data[livematch.tourney].stages)
                        stages.forEach(key => {
                            let bracket = tourney_tournaments_data[livematch.tourney].stages[key]
                            bracket_options.push(
                                {
                                    label: bracket.bracket + " " + (bracket.round ?? ""),
                                    value: key,
                                }
                            )
                        })
                    }
                }
                tourney_options.forEach(option => {
                    if (option.value == livematch.tourney) {
                        option.default = true
                    }
                })
                bracket_options.forEach(option => {
                    if (option.value == livematch.bracket) {
                        option.default = true
                    }
                })
                ruleset_options.forEach(option => {
                    if (option.value == livematch.ruleset) {
                        option.default = true
                    }
                })
                components.push({
                    type: 1,
                    components: [
                        {
                            type: 3,
                            custom_id: "tourney_play_setup_tournament",
                            options: tourney_options,
                            placeholder: "Select Tournament",
                            min_values: 1,
                            max_values: 1
                        }
                    ]
                })
                if (bracket_options.length > 0) {
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_play_setup_bracket",
                                options: bracket_options,
                                placeholder: "Select Bracket",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }
                if (ruleset_options.length > 0) {
                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_play_setup_ruleset",
                                options: ruleset_options,
                                placeholder: "Select Ruleset",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }
                let playable = false, joinable_player = false, joinable_commentator = false
                if (livematch.ruleset !== "" && livematch.players && livematch.commentators && Object.values(livematch.players).length == 2) {
                    playable = true
                }
                if (!livematch.players || Object.values(livematch.players).length < 2) {
                    joinable_player = true
                }
                if (!livematch.commentators || Object.values(livematch.commentators).length < 2) {
                    joinable_commentator = true
                }
                components.push({
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "Join as Player",
                            emoji: {
                                name: "🕹️"
                            },
                            style: 1,
                            custom_id: "tourney_play_setup_player",
                            disabled: !joinable_player
                        },
                        {
                            type: 2,
                            label: "Join as Commentator/Tracker",
                            emoji: {
                                name: "🎙️"
                            },
                            style: 1,
                            custom_id: "tourney_play_setup_comm",
                            //disabled: !joinable_commentator
                        }
                    ]
                }, {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "Start Match",
                            style: 3,
                            custom_id: "tourney_play_start",
                            disabled: !playable
                        },
                        {
                            type: 2,
                            label: "Leave Match",
                            style: 4,
                            custom_id: "tourney_play_setup_leave",
                        },
                        {
                            type: 2,
                            label: "Cancel Match",
                            style: 4,
                            custom_id: "tourney_play_setup_cancel"
                        },
                    ]
                })
                return components
            }

            function raceComponents(race) {
                //livematch = tourney_live_data[interaction.channel_id]
                let events = Object.values(livematch.races[race].events)
                let podbans = []
                let podoptions = []
                let upg = 5
                events.forEach(event => {
                    if (Object.values(liverules.general.default).includes('nu') || (event.event == 'override' && event.type == 'condition' && event.selection == 'nu')) {
                        upg = 0
                    }
                    if (event.event == "tempban" && event.type == "racer") {
                        if (Array.isArray(event.selection)) {
                            event.selection.forEach(selection => {
                                podbans.push(selection)
                            })
                        } else {
                            podbans.push(event.selection)
                        }
                        podbans.push(event.selection)
                    }
                })
                for (let i = 0; i < 23; i++) {
                    if (!podbans.includes(String(i))) {
                        podoptions.push(i)
                    }
                }
                if (podoptions.includes(8)) {
                    podoptions.push(23)
                }
                if (podoptions.includes(22)) {
                    podoptions.push(24)
                }
                podoptions = podoptions.map(option => {
                    return (
                        {
                            value: option,
                            avg: tools.avgSpeed(
                                tools.upgradeTopSpeed(racers[option].max_speed, upg),
                                racers[option].boost_thrust,
                                racers[option].heat_rate,
                                tools.upgradeCooling(racers[option].cool_rate, upg))
                        }
                    )
                }
                ).sort(function (a, b) { return (b.avg - a.avg) })
                podoptions = podoptions.map(option => option.value)
                let components = [
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_play_race" + race + "_racer",
                                options: podoptions.map(pod => {
                                    return getRacerOption(pod)
                                }),
                                placeholder: "Select Racer",
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
                                label: "Ready",
                                style: 3,
                                custom_id: "tourney_play_race" + race + "_ready"
                            },
                            {
                                type: 2,
                                label: "Not Ready",
                                style: 4,
                                custom_id: "tourney_play_race" + race + "_unready"
                            },
                            {
                                type: 2,
                                label: "Reveal Racer Choice",
                                style: 2,
                                custom_id: "tourney_play_race" + race + "_reveal"
                            }
                        ]
                    },
                ]
                if (liverules.general.gents) {
                    components[1].components.push(
                        {
                            type: 2,
                            label: "",
                            emoji: {
                                name: "🎩"
                            },
                            style: 1,
                            custom_id: "tourney_play_race" + race + "_gents"
                        }
                    )
                }
                if (livematch.races[race].live) {
                    components = [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    label: "Submit Results",
                                    style: 3,
                                    custom_id: "tourney_play_race" + race + "_submit"
                                },
                            ]
                        }
                    ]
                    if (Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time !== "").length == 0) {
                        components[0].components.push(
                            {
                                type: 2,
                                label: "Restart",
                                style: 2,
                                custom_id: "tourney_play_race" + race + "_restart"
                            }
                        )
                    } else if (Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
                        components[0].components.push(
                            {
                                type: 2,
                                label: "Verify",
                                style: 1,
                                custom_id: "tourney_play_race" + race + "_verify"
                            }
                        )
                    }
                }
                if (livematch.races[race].gents?.agreed == "?") {
                    components = [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    label: "Accept",
                                    style: 3,
                                    custom_id: "tourney_play_race" + race + "_gents_true"
                                },
                                {
                                    type: 2,
                                    label: "Deny",
                                    style: 4,
                                    custom_id: "tourney_play_race" + race + "_gents_false"
                                }
                            ]
                        }
                    ]
                }
                return components
            }

            function firstComponents() {
                //livematch = tourney_live_data[interaction.channel_id]
                let components = [
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_play_first_vote",
                                options: getFirstOptions(liverules),
                                placeholder: "Select Option",
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
                                label: ([undefined, null].includes(livematch.firstmethod) ? methods[liverules.general.firsttrack.primary] + " (Default)" : methods[livematch.firstmethod]),
                                style: 3,
                                custom_id: "tourney_play_first_start",
                                disabled: [undefined, null].includes(livematch.firstvote) || Object.keys(livematch.firstvote).length < 2
                            }
                        ]
                    }
                ]
                return components
            }

            function colorComponents() {
                //livematch = tourney_live_data[interaction.channel_id]
                return [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                label: "Red",
                                style: 2,
                                custom_id: "tourney_play_first_color_red",
                                emoji: {
                                    name: "🟥"
                                }
                            },
                            {
                                type: 2,
                                label: "Blue",
                                style: 2,
                                custom_id: "tourney_play_first_color_blue",
                                emoji: {
                                    name: "🟦"
                                }
                            }
                        ]
                    }
                ]
            }

            function firstbanComponents() {
                //livematch = tourney_live_data[interaction.channel_id]
                let circuitoptions = [undefined, null].includes(livematch.firstbans) ? Object.values(liverules.general.firsttrack.options) : Object.values(liverules.general.firsttrack.options).filter(option => !Object.values(livematch.firstbans).map(ban => ban.ban).includes(option))
                let planetoptions = [undefined, null].includes(livematch.firstbans) ? ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"] : ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"].filter(option => !Object.values(livematch.firstbans).map(ban => ban.ban).includes(option))
                let trackoptions = []
                circuitoptions.forEach(circuit => {
                    tracks.forEach((track, index) => {
                        if (track.circuit == trackgroups[circuit].code) {
                            trackoptions.push(index)
                        }
                    })
                })
                trackoptions = [undefined, null].includes(livematch.firstbans) ? trackoptions : trackoptions.filter(option => !Object.values(livematch.firstbans).map(ban => Number(ban.ban)).includes(option) && planetoptions.map(option => trackgroups[option].code).includes(Number(tracks[option].planet)))
                let selectoptions = []
                if (livematch.firstmethod == "poe_c" && circuitoptions.length > 1) {
                    selectoptions = circuitoptions.map(option => { return ({ label: trackgroups[option].name, value: option, description: trackgroups[option].count + " tracks" }) })
                } else if (livematch.firstmethod == "poe_p" && planetoptions.length > 1) {
                    selectoptions = planetoptions.map(option => { return ({ label: trackgroups[option].name, value: option, description: trackgroups[option].count + " tracks" }) })
                } else {
                    selectoptions = trackoptions.map(option => getTrackOption(option))
                }
                return [
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_play_first_" + (livematch.firstmethod.includes("poe") ? "ban" : "pick"),
                                options: selectoptions,
                                placeholder: "Select Option",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    }
                ]
            }

            function permabanComponents(permaban) {
                let pban = liverules.match.permabans[permaban]
                //livematch = tourney_live_data[interaction.channel_id]
                let selectoptions = []
                if (pban.type == "track") {
                    let permatrackbans = Object.values(livematch.races[1].events).filter(event => event.event == "permaban").filter(event => event.type == "track").map(event => Number(event.selection))
                    for (let i = 0; i < 25; i++) {
                        if (!permatrackbans.includes(i)) {
                            selectoptions.push(
                                getTrackOption(i)
                            )
                        }
                    }
                } else if (pban.type == "racer") {
                    let permaracerbans = Object.values(livematch.races[1].events).filter(event => event.event == "permaban").filter(event => event.type == "track").map(event => event.selection)
                    for (let i = 0; i < 25; i++) {
                        if (!permaracerbans.includes(i)) {
                            selectoptions.push(
                                getRacerOption(i)

                            )
                        }
                    }
                }

                return [
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_play_permaban_" + permaban,
                                options: selectoptions,
                                placeholder: "Select Permaban",
                                min_values: pban.count,
                                max_values: pban.limit * pban.count
                            }
                        ]
                    }
                ]
            }


            if ([null, undefined, ""].includes(livematch)) {
                args[1] = "setup"
                type = 4
                let match = {
                    status: "setup",
                    tourney: "",
                    bracket: "",
                    ruleset: "",
                    datetime: "",
                    players: [],
                    commentators: [],
                    stream: "",
                    firstvote: ""
                }
                livematchref.set(match)
            }
            //livematch = tourney_live_data[interaction.channel_id]
            if (args.length == 1) {
                args[1] = livematch.status
                type = 4
            }
            if (args[1] == "setup") {
                livematchref.child("status").set("setup")
                if (args[2] == "tournament") {
                    livematchref.update({ tourney: interaction.data.values[0], bracket: "", ruleset: "" })
                } else if (args[2] == "bracket") {
                    livematchref.update(
                        {
                            bracket: interaction.data.values[0],
                            ruleset: tourney_tournaments_data[livematch.tourney].stages[interaction.data.values[0]].ruleset
                        }
                    )
                } else if (args[2] == "ruleset") {
                    livematchref.update({ ruleset: interaction.data.values[0] })
                } else if (args[2] == "player") {
                    if (!livematch.players || (livematch.players && !Object.values(livematch.players).includes(interaction.member.user.id))) {
                        if (!Object.values(tourney_participants_data).map(p => p.id).filter(id => ![null, undefined, ""].includes(id)).includes(interaction.member.user.id)) {
                            tourney_participants.push({
                                id: interaction.member.user.id,
                                name: interaction.member.user.username
                            })
                        }
                        livematchref.child("players").push(interaction.member.user.id)
                    }
                } else if (args[2] == "comm") {
                    if (!livematch.commentators || (livematch.commentators && !Object.values(livematch.commentators).includes(interaction.member.user.id))) {
                        if (!Object.values(tourney_participants_data).map(p => p.id).filter(id => ![null, undefined, ""].includes(id)).includes(interaction.member.user.id)) {
                            tourney_participants.push({
                                id: interaction.member.user.id,
                                name: interaction.member.user.username
                            })
                        }
                        livematchref.child("commentators").push(interaction.member.user.id)
                    }
                } else if (args[2] == "leave") {
                    if (livematch.commentators) {
                        let comms = Object.keys(livematch.commentators)
                        comms.forEach(key => {
                            if (livematch.commentators[key] == interaction.member.user.id) {
                                livematchref.child("commentators").child(key).remove()
                            }
                        })
                    }
                    if (livematch.players) {
                        let players = Object.keys(livematch.players)
                        players.forEach(key => {
                            if (livematch.players[key] == interaction.member.user.id) {
                                livematchref.child("players").child(key).remove()
                            }
                        })
                    }

                } else if (args[2] == 'cancel') {
                    livematchref.remove()
                    updateMessage("Match was cancelled", type, [], [])
                    return
                }
                updateMessage("", type, [setupEmbed()], setupComponents())
            } else if (args[1] == "start") {
                const matchmaker = new Discord.MessageEmbed()
                    .setAuthor(livematch.tourney == "practice" ? "`Practice Mode`" : tourney_tournaments_data[livematch.tourney].name, "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                    .setTitle((livematch.tourney == "practice" ? "" : tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].bracket + " " + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].round) + " - " + Object.values(livematch.players).map(player => getUsername(player)).join(" vs "))
                    .setDescription("📜 " + tourney_rulesets_data.saved[livematch.ruleset].general.name + "\n" +
                        "🎙️ " + ([null, undefined, ""].includes(livematch.commentators) ? "" : Object.values(livematch.commentators).map(id => "<@" + id + "> ")) + "\n" +
                        "📺 " + livematch.stream
                    )
                    .setColor("#3BA55D")
                const reminder = new Discord.MessageEmbed()
                    .setTitle("Reminders")
                    .addField("🕹️ Player Reminders", "○ Verify all pods/tracks/upgrades are unlocked\n○ Check that stream is running smoothly\n○ Disable game music\n○ Limit stream quality to 720p\n○ Wait until the results screen to report your times", false)
                    .addField("🎙️ Commentator Reminders", "○ Enable all voice related settings in Discord such as noise supression/reduction, advanced voice activity, etc.\n○  Open stream on Twitch to respond to chat", false)
                const ruleset = new Discord.MessageEmbed()
                    .setAuthor("Ruleset Overview")
                    .setTitle("📜 " + tourney_rulesets_data.saved[livematch.ruleset].general.name)
                    .setDescription(tourney_rulesets_data.saved[livematch.ruleset].general.description)
                    .addFields(rulesetOverview(tourney_rulesets_data.saved[livematch.ruleset]))
                livematchref.child("current_race").set(0)
                if (![null, undefined, ""].includes(livematch.datetime)) {
                    livematchref.child('datetime').set(Date.now())
                }
                updateMessage("", type, [matchmaker, ruleset, reminder], [])
                followupMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(", "), [firstEmbed()], firstComponents())
            } else if (args[1] == "first") {
                livematchref.child("status").set("first")
                //livematch = tourney_live_data[interaction.channel_id]
                function setRace(track) {
                    let event = {
                        event: "selection",
                        type: "track",
                        player: "",
                        selection: track,
                        repeat: false,
                        cost: 0
                    }
                    livematchref.child("races").child("0").child("events").push(event)
                    let race_object = {
                        events: [event],
                        ready: { commentators: false },
                        reveal: {},
                        runs: {},
                        live: false
                    }
                    Object.values(livematch.players).map(player => {
                        race_object.ready[player] = false
                        race_object.reveal[player] = false
                        race_object.runs[player] = {
                            deaths: "",
                            notes: "",
                            platform: "pc",
                            player: "",
                            pod: "",
                            time: ""
                        }
                    }
                    )
                    livematchref.child("races").child("0").update(race_object)
                }
                if (args[2] == 'start') {
                    if ([undefined, null].includes(livematch.firstmethod)) {
                        let content = "" + ([undefined, null].includes(livematch.firstvote) ? Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.players).map(player => Object.keys(livematch.firstvote).includes(player) ? "" : "<@" + player + ">").join(" "))
                        updateMessage(content, type, [firstEmbed()], firstComponents())
                    } else if (livematch.firstmethod.includes("poe")) {
                        //livematch = tourney_live_data[interaction.channel_id]
                        updateMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*", type, [colorEmbed()], colorComponents())
                    } else if (livematch.firstmethod == 'random') {
                        updateMessage("The first track will be... <a:OovoDoor:964369275559223306>", type, [], [])
                        setTimeout(async function () {
                            let randomtrack = Math.floor(Math.random() * 25)
                            setRace(randomtrack)
                            postMessage("**" + planets[tracks[randomtrack].planet].emoji + " " + tracks[randomtrack].name + "**", [], [])
                        }, 2000)
                        setTimeout(async function () {
                            //livematch = tourney_live_data[interaction.channel_id]
                            postMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), [raceEmbed(0)], raceComponents(0))
                        }, 3000)
                    } else {
                        updateMessage('Please select a track', type, [], firstbanComponents())
                    }
                } else if (args[2] == "vote") {
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        livematchref.child("firstvote").child(interaction.member.user.id).set(interaction.data.values[0])
                        let votes = Object.values(livematch.firstvote)
                        if (votes.length = 2) {
                            if (votes[0] == votes[1]) {
                                livematchref.child("firstmethod").set(votes[0])
                            } else {
                                livematchref.child("firstmethod").set(liverules.general.firsttrack.primary)
                            }
                        }
                        livematchref.child("status").set("first")
                        //livematch = tourney_live_data[interaction.channel_id]
                        let content = "" + ([undefined, null].includes(livematch.firstvote) ? Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.players).map(player => Object.keys(livematch.firstvote).includes(player) ? "" : "<@" + player + ">").join(" "))
                        updateMessage(content, type, [firstEmbed()], firstComponents())
                    } else {
                        ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }

                } else if (args[2] == "color") {
                    //livematch = tourney_live_data[interaction.channel_id]
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        content = Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*"
                        if (["red", "blue"].includes(args[3])) {
                            livematchref.child("firstcolors").child(interaction.member.user.id).set(args[3])
                            function setColor(color) {
                                let players = Object.values(livematch.players)
                                players.forEach(player => {
                                    if (player !== interaction.member.user.id) {
                                        livematchref.child("firstcolors").child(player).set(color)
                                    }
                                })
                            }
                            if (args[3] == "red") {
                                setColor("blue")
                            } else {
                                setColor("red")
                            }
                            updateMessage("", type, [colorEmbed()], [])
                            postMessage("Rolling a chance cube... <a:OovoDoor:964369275559223306>", [], [])
                            setTimeout(async function () {
                                let players = Object.keys(livematch.firstcolors)
                                let firstplayer = Math.floor(Math.random() * 2) == 1 ? players[1] : players[0]
                                livematchref.child("firstplayer").set(firstplayer)
                                postMessage(":" + livematch.firstcolors[firstplayer] + "_square:", [], [])
                            }, 1000)
                            setTimeout(async function () {
                                //livematch = tourney_live_data[interaction.channel_id]
                                postMessage("<@" + (livematch.firstmethod == "poe_t" ? getOpponent(livematch.firstplayer) : livematch.firstplayer) + "> goes first!", [firstbanEmbed()], firstbanComponents())
                            }, 2000)
                            return
                        }
                        updateMessage(content, type, [colorEmbed()], colorComponents())
                    } else {
                        ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }
                } else if (args[2] == "ban") {
                    //livematch = tourney_live_data[interaction.channel_id]
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        function whoseTurn() {
                            //livematch = tourney_live_data[interaction.channel_id]
                            let first = livematch.firstplayer
                            let circuitoptions = [undefined, null].includes(livematch.firstbans) ? Object.values(liverules.general.firsttrack.options) : Object.values(liverules.general.firsttrack.options).filter(option => !Object.values(livematch.firstbans).map(ban => ban.ban).includes(option))
                            let planetoptions = [undefined, null].includes(livematch.firstbans) ? ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"] : ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"].filter(option => !Object.values(livematch.firstbans).map(ban => ban.ban).includes(option))
                            let trackoptions = []
                            circuitoptions.forEach(circuit => {
                                tracks.forEach((track, index) => {
                                    if (track.circuit == trackgroups[circuit].code) {
                                        trackoptions.push(index)
                                    }
                                })
                            })
                            trackoptions = [undefined, null].includes(livematch.firstbans) ? trackoptions : trackoptions.filter(option => !Object.values(livematch.firstbans).map(ban => Number(ban.ban)).includes(option) && planetoptions.map(option => trackgroups[option].code).includes(Number(tracks[option].planet)))
                            let current_turn = first
                            let opponent = getOpponent(first)
                            if (livematch.firstmethod == "poe_c") {
                                if (circuitoptions.length > 1) {
                                    if (circuitoptions.length % 2 == 0) {
                                        current_turn = first
                                    } else {
                                        current_turn = opponent
                                    }
                                } else {
                                    if (trackoptions.length % 2 == 0) {
                                        current_turn = opponent
                                    } else {
                                        current_turn = first
                                    }
                                }
                            } else if (livematch.firstmethod == "poe_p") {
                                if (planetoptions.length > 1) {
                                    if (planetoptions.length % 2 == 0) {
                                        current_turn = first
                                    } else {
                                        current_turn = opponent
                                    }
                                } else {
                                    if (trackoptions.length % 2 == 0) {
                                        current_turn = opponent
                                    } else {
                                        current_turn = first
                                    }
                                }
                            } else if (livematch.firstmethod == "poe_t") {
                                if (trackoptions.length % 2 == 0) {
                                    current_turn = first
                                } else {
                                    current_turn = opponent
                                }
                            }
                            return { current_turn: current_turn, options: trackoptions }
                        }
                        if (interaction.data.hasOwnProperty("values")) {
                            //livematch = tourney_live_data[interaction.channel_id]
                            let turn = whoseTurn()
                            if (interaction.member.user.id == turn.current_turn) {
                                livematchref.child("firstbans").push({ player: interaction.member.user.id, ban: interaction.data.values[0] })
                                //livematch = tourney_live_data[interaction.channel_id]
                                if (turn.options.length == 2) {
                                    turn.options = turn.options.filter(t => Number(t) !== Number(interaction.data.values[0]))
                                    setRace(turn.options[0])
                                    updateMessage("", type, [firstbanEmbed()], [])
                                    postMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), [raceEmbed(0)], raceComponents(0))
                                } else {
                                    let turn = whoseTurn()
                                    updateMessage("<@" + turn.current_turn + "> please make a selection", type, [firstbanEmbed()], firstbanComponents())
                                }
                            } else {
                                ephemeralMessage("It's not your turn to ban! <:WhyNobodyBuy:589481340957753363>", [], [])
                            }
                        } else {
                            ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                        }
                    }
                } else if (args[2] == 'pick') {
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        let firsttrack = interaction.data.values[0]
                        setRace(firsttrack)
                        updateMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), type, [raceEmbed(0)], raceComponents(0))
                    } else {
                        ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }
                }
            } else if (args[1].includes("permaban")) {
                if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                    let permaban_num = Number(args[2])
                    let permaban = liverules.match.permabans[permaban_num]
                    if ((permaban.choice == "firstwinner" && interaction.member.user.id == getWinner(0)) || (permaban.choice == "firstloser" && interaction.member.user.id == getOpponent(getWinner(0)))) {
                        interaction.data.values.forEach(selection => {
                            livematchref.child("races").child(1).child("events").push(
                                {
                                    event: "permaban",
                                    type: permaban.type,
                                    player: interaction.member.user.id,
                                    selection: selection,
                                    cost: permaban.cost
                                },
                            )
                        })
                        if (permaban_num + 1 == Object.values(liverules.match.permabans).length) {
                            let events = Object.values(liverules.race)
                            updateMessage("<@" + (events[0].choice == "lastwinner" ? getWinner(0) : getOpponent(getWinner(0))) + "> please make a selection", type, [raceEventEmbed(1)], raceEventComponents(1))
                        } else {
                            updateMessage("<@" + (liverules.match.permabans[permaban_num + 1].choice == 'firstwinner' ? getWinner(0) : getOpponent(getWinner(0))) + ">", type, [permabanEmbed(permaban_num + 1)], permabanComponents(permaban_num + 1))
                        }
                    } else {
                        ephemeralMessage("It's not your turn to ban! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }
                } else {
                    ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                }
            } else if (args[1].includes("race")) {
                //livematch = tourney_live_data[interaction.channel_id]
                let race = Number(args[1].replace("race", ""))
                let event = Number(args[2].replace("event", ""))
                let events = Object.values(liverules.race)
                let e = events[event]
                let eventstart = livematch.races[race].eventstart
                let eventend = livematch.races[race].eventend
                let responded = false
                if (args[2].includes("event")) {
                    if (interaction.member.user.id == (e.choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1)))) {
                        if (interaction.message.components.length > 1) {
                            if (args[3] == "submit") {
                                let newevents = []
                                interaction.message.components.forEach(component => {
                                    if (component.components[0].type == 3) {
                                        let thisargs = component.components[0].custom_id.split("_")
                                        let thisevent = Number(thisargs[3].replace("event", ""))
                                        let e = liverules.race[thisevent]
                                        let options = component.components[0].options.filter(option => option.default)
                                        if ([null, undefined, ""].includes(e.count)) {
                                            e.count = 1
                                        }
                                        let loops = options.length //this value needs to be stored in a letiable otherwise you'll be a dumbass and have the loop be cut short as the array shrinks
                                        for (let i = 0; i < loops / e.count; i++) {
                                            let option = options.slice(0, e.count)
                                            options = options.slice(e.count)
                                            if (option.length == 1) {
                                                option = option[0].value
                                            } else {
                                                option = option.map(o => o.value)
                                            }
                                            let new_event = {
                                                event: e.event,
                                                type: e.type,
                                                player: interaction.member.user.id,
                                                selection: option,
                                            }
                                            if (![null, undefined, ""].includes(e.cost)) {
                                                new_event.cost = e.cost
                                            }
                                            if (option.includes("repeat")) {
                                                new_event.selection = option.replace("repeat", "")
                                                new_event.repeat = true
                                            }
                                            if (option.includes("ban")) {
                                                ephemeralMessage("This track cannot be selected. <:WhyNobodyBuy:589481340957753363>", [], [])
                                                newevents = []
                                                responded = true
                                                return
                                            }
                                            newevents.push(new_event)
                                        }
                                    }
                                })
                                newevents.forEach(event => {
                                    livematchref.child("races").child(race).child('events').push(event)
                                })

                            } else {
                                updateMessage("<@" + (events[event].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1))) + "> please make a selection", type, [raceEventEmbed(race)], raceEventComponents(race))
                                return
                            }
                        } else {
                            interaction.data.values.forEach(selection => {
                                let new_event = {
                                    event: e.event,
                                    type: e.type,
                                    player: interaction.member.user.id,
                                    selection: selection,
                                }
                                if (![null, undefined, ""].includes(e.cost)) {
                                    new_event.cost = e.cost
                                }
                                if (selection.includes("repeat")) {
                                    new_event.selection = selection.replace("repeat", "")
                                    new_event.repeat = true
                                }
                                if (selection.includes("ban")) {
                                    ephemeralMessage("This track cannot be selected. <:WhyNobodyBuy:589481340957753363>", [], [])
                                    responded = true
                                    return
                                }
                                livematchref.child("races").child(race).child("events").push(new_event)
                            })
                        }

                        //save result
                        if (!responded) {
                            let streak = 0
                            let choice = events[event + 1].choice
                            for (i = event + 2; i < events.length; i++) {
                                if (events[i].choice == choice && streak < 4) {
                                    streak++
                                }
                            }
                            if (eventend + 1 == events.length) {
                                updateMessage("", type, [raceEventEmbed(race)], [])
                                postMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), [raceEmbed(race)], raceComponents(race))
                            } else {
                                livematchref.child("races").child(race).update({ eventstart: eventend + 1, eventend: eventend + 1 + streak })
                                updateMessage("<@" + (events[event + 1].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1))) + "> please make a selection", type, [raceEventEmbed(race)], raceEventComponents(race))
                            }
                        }

                    } else {
                        ephemeralMessage("It's not your turn! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }


                } else if (["ready", "unready"].includes(args[2])) {
                    const Member = Guild.members.cache.get(interaction.member.user.id);
                    if (Object.values(livematch.players).includes(interaction.member.user.id) && ![undefined, null, ""].includes(livematch.races[race].runs) && ![undefined, null, ""].includes(livematch.races[race].runs[interaction.member.user.id]) && ![undefined, null, ""].includes(livematch.races[race].runs[interaction.member.user.id].pod)) {
                        livematchref.child("races").child(race).child("ready").child(interaction.member.user.id).set((args[2] == "ready" ? true : false))
                        //livematch = tourney_live_data[interaction.channel_id]
                        if (!Object.values(livematch.commentators).includes(interaction.member.user.id)) {
                            updateMessage(Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "), type, [raceEmbed(race)], raceComponents(race))
                        }
                    } else if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        ephemeralMessage("You have not selected a racer yet! <:WhyNobodyBuy:589481340957753363>", [], [])
                        return
                    }
                    if (Object.values(livematch.commentators).includes(interaction.member.user.id) || (interaction.guild_id == '441839750555369474' && (Member.roles.cache.some(r => r.id == '862810190072381471')) && !Object.values(livematch.players).includes(interaction.member.user.id))) {
                        //livematch = tourney_live_data[interaction.channel_id]
                        if (Object.values(livematch.races[race].ready).filter(r => r == false).length == 1 && !livematch.races[race].ready.commentators) {
                            livematchref.child("races").child(race).child("ready").child("commentators").set((args[2] == "ready" ? true : false))
                            updateMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>", type, [], [])
                            setTimeout(async function () {
                                client.channels.cache.get(interaction.channel_id).messages.fetch(interaction.message.id).then(message => message.delete())
                            }, 10000)
                            countDown()
                            //initiate race
                            livematchref.child("races").child(race).child("live").set(true)
                            setTimeout(async function () {
                                postMessage("", [raceEmbed(race)], raceComponents(race))
                            }, 10000)
                        } else {
                            ephemeralMessage("Players are not ready yet! <:WhyNobodyBuy:589481340957753363>", [], [])
                        }
                    }

                } else if (args[2] == 'gents') {
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        if (interaction.type == 5) {
                            let terms = interaction.data.components[0].components[0].value.trim()
                            livematchref.child('races').child(race).child('gents').set({ terms: terms, player: interaction.member.user.id, agreed: "?" })
                            updateMessage("<@" + getOpponent(interaction.member.user.id) + "> do you accept the terms of the proposed 🎩 **Gentlemen's Agreement**?\n*" + terms + "*", type, [raceEmbed(race)], raceComponents(race))
                        } else {
                            if (args.length == 3) {
                                client.api.interactions(interaction.id, interaction.token).callback.post({
                                    data: {
                                        type: 9,
                                        data: {
                                            custom_id: "tourney_play_race" + race + "_gents",
                                            title: "Make a Gentleman's Agreement",
                                            components: [
                                                {
                                                    type: 1,
                                                    components: [
                                                        {
                                                            type: 4,
                                                            custom_id: "gents",
                                                            label: "Agreement Terms",
                                                            style: 1,
                                                            min_length: 0,
                                                            max_length: 100,
                                                            required: false
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                })
                            } else {
                                if (interaction.member.user.id == getOpponent(livematch.races[race].gents?.player)) {
                                    if (args[3] == 'true') {
                                        livematchref.child('races').child(race).child('gents').update({ agreed: true })
                                    } else {
                                        livematchref.child('races').child(race).child('gents').remove()
                                    }
                                    updateMessage(Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "), type, [raceEmbed(race)], raceComponents(race))
                                } else {
                                    ephemeralMessage("Not you! <:WhyNobodyBuy:589481340957753363>", [], [])
                                }

                            }
                        }
                    } else {
                        ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }
                } else if (args[2] == "racer") {
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        livematchref.child("races").child(race).child("runs").child(interaction.member.user.id).child("pod").set(interaction.data.values[0])
                    }
                    updateMessage(Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "), type, [raceEmbed(race)], raceComponents(race))
                } else if (args[2] == "reveal") {
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        livematchref.child("races").child(race).child("reveal").child(interaction.member.user.id).set(true)
                    }
                    updateMessage(Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "), type, [raceEmbed(race)], raceComponents(race))
                } else if (args[2] == "submit") {
                    if (Object.values(livematch.players).includes(interaction.member.user.id)) {
                        if (interaction.type == 5) {
                            if (livematch.races[race].live) {
                                livematchref.child("races").child(race).child("runs").child(interaction.member.user.id).update(
                                    {
                                        time: (interaction.data.components[0].components[0].value.toLowerCase() == 'dnf' ? 'DNF' : tools.timetoSeconds(interaction.data.components[0].components[0].value.trim()) == null ? "DNF" : tools.timetoSeconds(interaction.data.components[0].components[0].value.trim())),
                                        deaths: interaction.data.components[1].components[0].value.trim(),
                                        notes: interaction.data.components[2].components[0].value.trim(),
                                        player: interaction.member.user.id
                                    }
                                )
                                updateMessage("", type, [raceEmbed(race)], raceComponents(race))
                            } else {
                                ephemeralMessage("Race is no longer live. <:WhyNobodyBuy:589481340957753363>", [], [])
                            }
                        } else {
                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: 9,
                                    data: {
                                        custom_id: "tourney_play_race" + race + "_submit",
                                        title: "Submit Race " + (race + 1) + " Results",
                                        components: [
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 4,
                                                        custom_id: "time",
                                                        label: "⏱️ Time (write 'dnf' if forfeited)",
                                                        style: 1,
                                                        min_length: 1,
                                                        max_length: 10,
                                                        required: true,
                                                        placeholder: "--:--.---",
                                                        value: (String(livematch.races[race].runs[interaction.member.user.id]?.time).toLowerCase() == 'dnf' ? 'DNF' : (livematch.races[race].runs[interaction.member.user.id].time == "" ? "" : tools.timefix(livematch.races[race].runs[interaction.member.user.id].time)))
                                                    }
                                                ]
                                            },
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 4,
                                                        custom_id: "deaths",
                                                        label: "💀 Deaths (leave blank if unsure)",
                                                        style: 1,
                                                        min_length: 0,
                                                        max_length: 2,
                                                        required: false,
                                                        value: livematch.races[race].runs[interaction.member.user.id].deaths
                                                    }
                                                ]
                                            },
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 4,
                                                        custom_id: "notes",
                                                        label: "📝 Notes",
                                                        style: 1,
                                                        min_length: 0,
                                                        max_length: 100,
                                                        required: false,
                                                        value: livematch.races[race].runs[interaction.member.user.id].notes
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            })
                        }
                    } else {
                        ephemeralMessage("You're not a player! <:WhyNobodyBuy:589481340957753363>", [], [])
                    }
                } else if (args[2] == "verify") {
                    async function verify() {
                        const Member = await Guild.members.fetch(interaction.member.user.id)
                        if (interaction.type == 5) {
                            if (Object.values(livematch.commentators).includes(interaction.member.user.id) || (interaction.guild_id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(livematch.players).includes(interaction.member.user.id))) {
                                interaction.data.components.map(field => {
                                    if (field.components[0].custom_id.includes("time")) {
                                        livematchref.child("races").child(race).child("runs").child(field.components[0].custom_id.replace("time", "")).update({ time: (field.components[0].value.toLowerCase() == 'dnf' ? 'DNF' : tools.timetoSeconds(field.components[0].value)) })
                                    } else if (field.components[0].custom_id.includes("deaths")) {
                                        livematchref.child("races").child(race).child("runs").child(field.components[0].custom_id.replace("deaths", "")).update({ deaths: (field.components[0].value == "" ? "" : Number(field.components[0].value)) })
                                    }
                                })
                            }
                            livematchref.child("races").child(race).child("live").set(false).then(() => {
                                updateMessage("", type, [raceEmbed(race)], [])
                                postMessage("", [matchSummaryEmbed()], [])
                            })

                            //check win condition
                            let scoreboard = {}
                            Object.keys(livematch.races).forEach(race => {
                                let winner = getWinner(race)
                                if (winner) {
                                    if ([null, undefined, ""].includes(scoreboard[winner])) {
                                        scoreboard[winner] = 1
                                    } else {
                                        scoreboard[winner]++
                                    }
                                }
                            })
                            let wincondition = false
                            Object.keys(scoreboard).forEach(player => {
                                if (scoreboard[player] == liverules.general.winlimit) {
                                    //win condition
                                    const winEmbed = new Discord.MessageEmbed()
                                        .setAuthor("Match Concluded")
                                        .setTitle(getUsername(player) + " Wins!")
                                        .setDescription("GGs, racers! The match has been saved.\nLive role will be automatically removed in 15 minutes")
                                        .addField(":microphone2: Commentators/Trackers", ":orange_circle: Don't forget to click 'Episode Finished' after the interviews")
                                    postMessage('', [winEmbed], [])
                                    wincondition = true
                                    let everybody = Object.values(livematch.players).concat(Object.values(livematch.commentators))
                                    tourney_matches.push(livematch).then(() => {
                                        livematchref.remove()
                                    })

                                    if (interaction.guild_id == '441839750555369474') {
                                        setTimeout(async function () {
                                            everybody.forEach(async function (p) {
                                                const thisMember = await Guild.members.fetch(p)
                                                if (thisMember.roles.cache.some(r => r.id == '970995237952569404')) {
                                                    thisMember.roles.remove('970995237952569404').catch(console.error)
                                                }
                                            })
                                        }, 15 * 60 * 1000)
                                    }
                                    return
                                }
                            })
                            if (!wincondition) {
                                let nextrace = livematch.current_race + 1
                                livematchref.child("current_race").set(nextrace)
                                let race_object = {
                                    ready: { commentators: false },
                                    reveal: {},
                                    runs: {},
                                    live: false,
                                    events: "",
                                    eventstart: 0,
                                    eventend: 0
                                }
                                Object.values(livematch.players).map(player => {
                                    race_object.ready[player] = false
                                    race_object.reveal[player] = false
                                    race_object.runs[player] = {
                                        deaths: "",
                                        notes: "",
                                        platform: "pc",
                                        player: "",
                                        pod: "",
                                        time: ""
                                    }
                                }
                                )
                                livematchref.child('races').child(nextrace).update(race_object)
                                //start permabans
                                if (race == 0 && Object.values(liverules.match.permabans).length > 0) {
                                    postMessage("<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent(getWinner(0)) : getWinner(0)) + "> please select a permanent ban", [permabanEmbed(0)], permabanComponents(0))
                                } else { //restart event loop for next race
                                    postMessage("<@" + (events[0].choice == "lastwinner" ? getWinner(race) : getOpponent(getWinner(race))) + "> please make a selection", [raceEventEmbed(nextrace)], raceEventComponents(nextrace))
                                }
                            }

                        } else {
                            if (Object.values(livematch.commentators).includes(interaction.member.user.id) || (interaction.guild_id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(livematch.players).includes(interaction.member.user.id))) {
                                let modal = {
                                    data: {
                                        type: 9,
                                        data: {
                                            custom_id: "tourney_play_race" + race + "_verify",
                                            title: "Verify Race " + (race + 1) + " Results",
                                            components: []
                                        }
                                    }
                                }
                                Object.keys(livematch.races[race].runs).map(key => {
                                    modal.data.data.components.push(
                                        {
                                            type: 1,
                                            components: [
                                                {
                                                    type: 4,
                                                    custom_id: "time" + key,
                                                    label: ("⏱️ " + getUsername(key) + "'s Time").substring(0, 45),
                                                    style: 1,
                                                    min_length: 1,
                                                    max_length: 10,
                                                    required: true,
                                                    placeholder: "--:--.---",
                                                    value: (livematch.races[race].runs[key].time.toLowerCase() == "dnf" ? "DNF" : tools.timefix(livematch.races[race].runs[key].time))
                                                }
                                            ]
                                        }
                                    )
                                    modal.data.data.components.push(
                                        {
                                            type: 1,
                                            components: [
                                                {
                                                    type: 4,
                                                    custom_id: "deaths" + key,
                                                    label: ("💀 " + getUsername(key) + "'s Deaths").substring(0, 45),
                                                    style: 1,
                                                    min_length: 0,
                                                    max_length: 2,
                                                    required: false,
                                                    value: livematch.races[race].runs[key].deaths
                                                }
                                            ]
                                        }
                                    )
                                })
                                client.api.interactions(interaction.id, interaction.token).callback.post(modal)
                            } else {
                                ephemeralMessage("Only commentators/trackers can verify match times. <:WhyNobodyBuy:589481340957753363>", [], [])
                            }
                        }
                    }
                    verify()
                } else if (args[2] == "restart") {
                    if (Object.values(livematch.commentators).includes(interaction.member.user.id)) {
                        livematchref.child("races").child(race).child("live").set(false)
                        Object.keys(livematch.races[race].ready).map(key => {
                            livematchref.child("races").child(race).child("ready").child(key).set(false)
                        })
                        //livematch = tourney_live_data[interaction.channel_id]
                        updateMessage(Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "), type, [raceEmbed(race)], raceComponents(race))
                    } else {
                        ephemeralMessage("Only commentators/trackers can restart a race. <:WhyNobodyBuy:589481340957753363>", [], [])
                    }

                }
            }

            //a tourney cancel command can be used by an admin to cancel a match
            /*
            Update profile
            country flag
            set platform
            set pronouns
            appropriate nicknames/pronunciation
            reveal pod selection to opponent
            */
        }
    }
}
