const tourneyMatches = new EmbedBuilder()
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
                    if (interaction.values[0].includes("offset")) {
                        offset = Number(interaction.values[0].replace("offset", ""))
                    } else {
                        match = interaction.values[0]
                    }
                }
            } else if (args[1] == "sort") {
                sort = interaction.values[0]
            } else if (args[1] == "tourney") {
                tourney = interaction.values[0]
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
                if (interaction.data.hasOwnProperty("values") && !interaction.values[0].includes("offset")) {
                    if (r.value == interaction.values[0]) {
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