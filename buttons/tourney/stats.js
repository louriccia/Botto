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
                            player = tourney_participants_data[tpd[i]].id
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
                if (interaction.data?.values) {
                    if (interaction.values[0].includes("offset")) {
                        offset = Number(interaction.values[0].replace("offset", ""))
                    } else {
                        player = interaction.values[0]
                    }
                }
            } else if (args[1] == "sort") {
                sort = interaction.data?.values[0] ?? "plays"
            } else if (args[1] == "tracks") {
                track = Number(interaction.data?.values[0]) ?? null
            }
            const tourneyReport = new EmbedBuilder()
            tourneyReport
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                .setColor("#3BA55D")
            if (player == "global") {
                tourneyReport.setTitle("Global Stats")
            } else {
                tourneyReport.setTitle(getUsername(player) + "'s Stats")
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
                //step 1: initialize stat structure
                let accomp = { win: { count: 0, streaks: [] }, deathless: { count: 0, streaks: [] }, comebacks: [] }
                let accomplishments = []
                //initialize stats
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
                    overrides: {
                        total: 0
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
                //initialize players
                Object.values(tourney_participants_data).forEach(participant => {
                    if (participant.id) {
                        stats.players[participant.id] = {
                            race_time: 0,
                            deaths: [],
                            matches: { total: 0, won: 0, lost: 0, qual: 0, winners: 0, losers: 0 },
                            races: { total: 0, won: 0, lost: 0, runbacks: 0, dnf: 0 },
                            track: {},
                            racer: {},
                            opponents: {},
                            overrides: { nu: 0, sk: 0, fl: 0, podban: 0 },
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

                //step 2: iterate through all matches and get stats
                Object.values(tourney_matches_data).sort(function (a, b) { return a.datetime - b.datetime }).forEach(match => {
                    let already_played = []
                    let runback = {}
                    let players = Object.values(match.races[0].runs).map(run => run.player)
                    //commentator stats
                    if (match.commentators) {
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
                    }

                    if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                        players.forEach(player => {
                            players.filter(op => op !== player).forEach(opponent => {
                                if (stats.players[player]) {
                                    if (stats.players[player].opponents[opponent] == undefined) {
                                        stats.players[player].opponents[opponent] = { matches: 0, races: 0, wins: [], times: [] }
                                    }
                                    stats.players[player].opponents[opponent].matches++
                                } else {
                                    console.log(player)
                                }

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

                    //for each race
                    match.races.forEach((race, num) => {
                        let conditions = { ...tourney_rulesets_data.saved[match.ruleset].general.default }
                        let thistrack = null
                        //for each event
                        if (race.events) {
                            Object.values(race.events).forEach(event => {
                                if (event.event == 'tempban') {
                                    if (event.type == 'racer') {
                                        if (event.cost > 0) {
                                            stats.overrides.total++
                                            stats.players[event.player].overrides['podban']++
                                            if (stats.overrides['podban'] == undefined) {
                                                stats.overrides['podban'] = 1
                                            }
                                            stats.overrides['podban']++
                                        }
                                        if (!Array.isArray(event.selection)) {
                                            event.selection = [event.selection]
                                        }
                                        event.selection.forEach(selection => {
                                            stats.racer[selection].bans.push(1)
                                            stats.players[event.player].racer[selection].bans.push(1)
                                            temppod.push(Number(selection))
                                            for (let i = 0; i < 25; i++) {
                                                if (!temppod.includes(i)) {
                                                    stats.racer[i].bans.push(0)
                                                    stats.players[event.player].racer[i].bans.push(0)
                                                }
                                            }
                                        })
                                    } else if (event.type == 'track') {
                                        stats.track[event.selection].bans.push(1)
                                        stats.players[event.player].track[event.selection].bans.push(1)
                                        temptrack.push(Number(event.selection))
                                        let opponent = null
                                        Object.values(race.runs).forEach(run => {
                                            if (run.player !== event.player) {
                                                opponent = run.player
                                            }
                                        })
                                        for (let i = 0; i < 25; i++) {
                                            if (!temptrack.includes(i) && !already_banned.includes(i) && (!already_played.includes(i) || (already_played.includes(i) && runback[opponent] == undefined))) {
                                                stats.track[i].bans.push(0)
                                                stats.players[event.player].track[i].bans.push(0)
                                            }
                                        }
                                    }
                                } else if (event.event == 'override' && event.type == 'condition') {
                                    stats.overrides.total++
                                    stats.players[event.player].overrides[event.selection]++
                                    if (stats.overrides[event.selection] == undefined) {
                                        stats.overrides[event.selection] = 1
                                    }
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
                                    if (![null, undefined, ""].includes(event.player)) {
                                        if (event.repeat) {
                                            runback[event.player] = true
                                            stats.track[event.selection].runbacks++
                                            stats.players[event.player].track[event.selection].runbacks++
                                            stats.races.runbacks++
                                            stats.players[event.player].races.runbacks++
                                        }
                                        stats.track[event.selection].picks.push(1)
                                        stats.players[event.player].track[event.selection].picks.push(1)
                                        already_played.push(Number(event.selection))
                                        for (let i = 0; i < 25; i++) {
                                            if (!temptrack.includes(i) && !already_banned.includes(i) && (!already_played.includes(i) || (already_played.includes(i) && (runback[event.player] !== undefined)))) {
                                                stats.track[i].picks.push(0)
                                                stats.players[event.player].track[i].picks.push(0)
                                            }
                                        }
                                    }
                                } else if (event.event == 'permaban') {
                                    if (event.type == "track") {
                                        stats.track[event.selection].bans.push(1)
                                        stats.players[event.player].track[event.selection].bans.push(1)
                                        already_banned.push(Number(event.selection))
                                        for (let i = 0; i < 25; i++) {
                                            if (!already_banned.includes(i) && !already_played.includes(i)) {
                                                stats.track[i].bans.push(0)
                                                stats.players[event.player].track[i].bans.push(0)
                                            }
                                        }
                                    }
                                }
                            })
                        } else {
                            thistrack = race.track
                        }

                        let winner = { player: null, time: null, pod: null }
                        //for each run
                        Object.values(race.runs).forEach(run => {
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
                            Object.values(conditions).forEach(o => {
                                if (stats.players[run.player].track[thistrack] == undefined) {
                                    console.log(stats.players[run.player].track)

                                    console.log(thistrack)
                                }
                                if (stats.players[run.player].track[thistrack][o] == undefined) {
                                    stats.players[run.player].track[thistrack][o] = 1
                                }
                                stats.players[run.player].track[thistrack][o]++
                                stats.track[thistrack][o]++
                                if (![null, undefined, ""].includes(run.pod)) {
                                    if (stats.players[run.player].racer[run.pod][o] == undefined) {
                                        stats.players[run.player].racer[run.pod][o] = 1
                                    }
                                    stats.players[run.player].racer[run.pod][o]++
                                    stats.racer[run.pod][o]++
                                }
                            })
                            if ([null, undefined, ""].includes(run.deaths)) {
                                run.deaths = 0
                            }
                            stats.deaths.push(run.deaths)
                            stats.track[thistrack].deaths.push(run.deaths)
                            stats.players[run.player].track[thistrack].deaths.push(run.deaths)
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
                            stats.players[run.player].track[thistrack].plays++
                            if (![null, undefined, ""].includes(run.pod)) {
                                stats.racer[run.pod].plays++
                                stats.racer[run.pod].picks.push(1)
                                stats.racer[run.pod].deaths.push(run.deaths)
                                stats.players[run.player].racer[run.pod].plays++
                                stats.players[run.player].racer[run.pod].picks.push(1)
                                stats.players[run.player].racer[run.pod].deaths.push(run.deaths)
                                for (let i = 0; i < 25; i++) {
                                    if (!temppod.includes(i) && i !== run.pod) {
                                        stats.racer[i].picks.push(0)
                                        stats.players[run.player].racer[i].picks.push(0)
                                    }
                                }
                            }
                            if (!["Qualifier", "1vAll"].includes(tourney_rulesets_data.saved[match.ruleset].type)) {
                                Object.values(race.runs).filter(p => p.player !== run.player).forEach(opponent => {
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
                                if (best_times[thistrack][Object.values(conditions).join("")]) {
                                    if (Number(run.time) - Number(best_times[thistrack][Object.values(conditions).join("")].time) < 0) {
                                        best_times[thistrack][Object.values(conditions).join("")] = { time: run.time, player: run.player }
                                    }
                                } else {
                                    best_times[thistrack][Object.values(conditions).join("")] = { time: run.time, player: run.player }
                                }
                            }
                        })
                        Object.values(race.runs).forEach(run => {
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
                            stats.players[winner.player].track[thistrack].wins.push(1)
                            stats.players[winner.player].racer[winner.pod].wins.push(1)
                            stats.racer[winner.pod].wins.push(1)
                            if (winner.player == player) {
                                accomp.win.count++
                            }

                            if (race.events && winner.player == Object.values(race.events).filter(e => e.event == 'selection' && e.type == 'track')[0].player) {
                                stats.track[thistrack].wins.push(1)
                            } else {
                                stats.track[thistrack].wins.push(0)
                            }
                            Object.values(race.runs).forEach(loser => {
                                if (loser.player !== winner.player) {
                                    stats.players[loser.player].races.lost++
                                    stats.players[loser.player].track[thistrack].wins.push(0)
                                    if (![null, undefined, ""].includes(loser.pod)) {
                                        stats.players[loser.player].racer[loser.pod].wins.push(0)
                                        stats.racer[loser.pod].wins.push(0)
                                    }
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
                //step 3: assemble embed
                let ranks = tools.getRanks(Object.values(tourney_matches_data))
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
                            .addField(":diamond_shape_with_a_dot_inside: Forcepoints", Object.keys(stats.overrides).map(o => o + ": `" + stats.overrides[o] + "`").join("\n"), true)
                    } else {
                        let description = ""
                        if (ranks[player]) {
                            if (ranks[player].matches >= 4) {
                                description += "⭐ Elo Rating: `" + (ranks[player].rank).toFixed(1) + " (" + (ranks[player].change >= 0 ? "🔺" : "🔻") + Math.abs((ranks[player].change)).toFixed(1) + ")`\n"
                            } else if (ranks[player].matches > 0) {
                                description += "⭐ Elo Rating: Unranked\n"
                            }
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
                        //tourney records
                        let player_records = {}
                        Object.keys(best_times).forEach(trackkey => {
                            let track = best_times[trackkey]
                            Object.keys(track).forEach(recordkey => {
                                let record = best_times[trackkey][recordkey]
                                if (Number(record.player) == Number(player)) {
                                    if (player_records[recordkey] == undefined) {
                                        player_records[recordkey] = []
                                    }
                                    player_records[recordkey].push(trackkey)
                                }
                            })
                        })
                        let player_conditions = Object.keys(player_records)
                        let record_conditions = {
                            sk: "SKIPS", fl: "FLAP", nu: "NU", ft: "FT", mu: "MU", ng: "NG"
                        }
                        function parseConditions(constring) {
                            let conarray = []
                            for (let i = 0; i < constring.length; i += 2) {
                                if (record_conditions[constring.substring(i, i + 2)]) {
                                    conarray.push(record_conditions[constring.substring(i, i + 2)])
                                }
                            }
                            return conarray
                        }
                        player_conditions.forEach(condition => {
                            if (player_records[condition].length > 5) {
                                accomplishments.push(":stopwatch: " + parseConditions(condition).join("/") + "** Record-Holder** on " + player_records[condition].length + " Tracks!")
                            } else {
                                let player_tracks = []
                                player_records[condition].forEach(t => {
                                    player_tracks.push(planets[tracks[Number(t)].planet].emoji + " " + tracks[Number(t)].nickname[0].toUpperCase())
                                })
                                accomplishments.push(":stopwatch: " + parseConditions(condition).join("/") + "** Record-Holder** on " + player_tracks.join(", "))
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
                            accomplishments.push("↩️ " + comeback.p_low + "-" + comeback.op_low + " to " + comeback.p_high + "-" + comeback.op_high + " **Comeback** vs " + getUsername(comeback.op) + " (" + comeback.match + ")")
                            if (i == 2 && accomp.comebacks.length > 3) {
                                accomplishments.push("+" + (accomp.comebacks.length - i) + " More ↩️ **Comebacks**")
                                i = accomp.comebacks.length
                            }
                        }
                        //track/pod deathless, lossless
                        accomp.win.track = []
                        accomp.win.racer = []
                        accomp.deathless.track = []
                        accomp.deathless.racer = []
                        for (i = 0; i < 25; i++) {
                            if (stats.players[player].racer[i].deaths.length > 0) {
                                if (stats.players[player].racer[i].deaths.reduce((a, b) => { return a + b }) == 0 && stats.players[player].racer[i].deaths.length >= 5) {
                                    accomp.deathless.racer.push(i)
                                }
                            }
                            if (stats.players[player].racer[i].wins.length > 0) {
                                if (!stats.players[player].racer[i].wins.includes(0) && stats.players[player].racer[i].wins.length >= 5) {
                                    accomp.win.racer.push(i)
                                }
                            }
                            if (stats.players[player].track[i].deaths.length > 0) {
                                if (stats.players[player].track[i].deaths.reduce((a, b) => { return a + b }) == 0 && stats.players[player].track[i].deaths.length >= 5) {
                                    accomp.deathless.track.push(i)
                                }
                            }
                            if (stats.players[player].track[i].wins.length > 0) {
                                if (!stats.players[player].track[i].wins.includes(0) && stats.players[player].track[i].wins.length >= 5) {
                                    accomp.win.track.push(i)
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
                        if (accomp.win.track.length > 0) {
                            accomplishments.push(":crown: **Never Lost** on " + (accomp.win.track.length == 1 ? planets[tracks[accomp.win.track[0]].planet].emoji + " " + tracks[accomp.win.track[0]].name : getTrackNicknames(accomp.win.track)))
                        }
                        if (accomp.win.racer.length > 0) {
                            accomplishments.push(":crown: **Never Lost** as " + (accomp.win.racer.length == 1 ? racers[accomp.win.racer[0]].flag + " " + racers[accomp.win.racer[0]].name : getPodNicknames(accomp.win.racer)))
                        }
                        if (accomp.deathless.track.length > 0) {
                            accomplishments.push(":skull: **Never Died** on " + (accomp.deathless.track.length == 1 ? planets[tracks[accomp.deathless.track[0]].planet].emoji + " " + tracks[accomp.deathless.track[0]].name : getTrackNicknames(accomp.deathless.track)))
                        }
                        if (accomp.deathless.racer.length > 0) {
                            accomplishments.push(":skull: **Never Died** as " + (accomp.deathless.racer.length == 1 ? racers[accomp.deathless.racer[0]].flag + " " + racers[accomp.deathless.racer[0]].name : getPodNicknames(accomp.deathless.racer)))
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
                                .addField(":diamond_shape_with_a_dot_inside: Forcepoints", "total: `" + (Number(stats.players[player].overrides.sk) + Number(stats.players[player].overrides.nu) + Number(stats.players[player].overrides.fl) + Number(stats.players[player].overrides.podban)) + "`\n" +
                                    "skips: `" + stats.players[player].overrides.sk + "`\n" +
                                    "nu: `" + stats.players[player].overrides.nu + "`\n" +
                                    "flap: `" + stats.players[player].overrides.fl + "`\n" +
                                    "podban: `" + stats.players[player].overrides.podban + "`", true)
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
                let players = Object.values(tourney_participants_data).filter(p => p.id !== undefined)
                players = players.sort(function (a, b) {
                    if (ranks[a.id] !== undefined && ranks[a.id].matches >= 4 && ranks[b.id] !== undefined && ranks[b.id].matches >= 4) {
                        return Number(ranks[b.id].rank) - Number(ranks[a.id].rank)
                    } else if (ranks[a.id] !== undefined && ranks[a.id].matches >= 4) {
                        return -1
                    } else if (ranks[b.id] !== undefined && ranks[b.id].matches >= 4) {
                        return 1
                    } else if ((ranks[a.id] !== undefined || stats.players[a.id].matches.total > 0) && (ranks[b.id] !== undefined || stats.players[b.id].matches.total > 0)) {
                        return Number(stats.players[b.id].matches.total) - Number(stats.players[a.id].matches.total)
                    } else if ((ranks[a.id] !== undefined || stats.players[a.id].matches.total > 0)) {
                        return -1
                    } else if ((ranks[b.id] !== undefined || stats.players[b.id].matches.total > 0)) {
                        return 1
                    } else if ((ranks[a.id] == undefined && stats.commentators[a.id] !== undefined) && (ranks[b.id] == undefined && stats.commentators[b.id] !== undefined)) {
                        return Number(stats.commentators[b.id].count) - Number(stats.commentators[a.id].count)
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
                    if (player == "global" || p.id == player) {
                        if (ranks[p.id] !== undefined && ranks[p.id].matches >= 4) {
                            description += "⭐ " + ranks[p.id].rank.toFixed(1) + " "
                        } else if (stats.players[p.id].matches.total > 0) {
                            description += "⭐ Unranked "
                        }
                        if (stats.players[p.id].matches.total > 0) {
                            let deaths = stats.players[p.id].deaths.reduce((a, b) => { return a + b })
                            deaths = (deaths / stats.players[p.id].races.total).toFixed(2)
                            description += "⚔️ " + stats.players[p.id].matches.total + " 🏁 " + stats.players[p.id].races.total
                            if (!isNaN((stats.players[p.id].races.won + stats.players[p.id].races.lost))) {
                                description += " 👑 " + Math.round((stats.players[p.id].races.won / (stats.players[p.id].races.won + stats.players[p.id].races.lost)) * 100)
                            } else {
                                description += " 👑 --"
                            }
                            description += "% 💀 " + deaths + " "
                        }
                        if (stats.commentators[p.id] !== undefined) {
                            description += "🎙️ " + stats.commentators[p.id].count
                        }
                    } else {
                        if (ranks[player]) {
                            if (ranks[p.id] && ranks[p.id].matches >= 4) {
                                let r1 = ranks[player].rank
                                let r2 = ranks[p.id].rank
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
                        if (stats.players[player].opponents[p.id]) {
                            if (stats.players[player].opponents[p.id].matches > 0) {
                                description += "⚔️ " + stats.players[player].opponents[p.id].matches + " 🏁 " + stats.players[player].opponents[p.id].races + " 👑 " + Math.round(stats.players[player].opponents[p.id].wins.reduce((a, b) => { return a + b }) * 100 / stats.players[player].opponents[p.id].wins.length) + "% ⏱️ "
                                let diff = stats.players[player].opponents[p.id].times.reduce((a, b) => { return a + b }) / stats.players[player].opponents[p.id].times.length
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
                            if (stats.commentators[player].cocomm[p.id] || stats.commentators[player].comfor[p.id]) {
                                description += "🎙️ "
                                if (stats.commentators[player].cocomm[p.id]) {
                                    description += stats.commentators[player].cocomm[p.id]
                                } else {
                                    description += "0"
                                }
                                description += "/"
                                if (stats.commentators[player].comfor[p.id]) {
                                    description += stats.commentators[player].comfor[p.id]
                                } else {
                                    description += "0"
                                }
                            }
                        }
                    }
                    if (p.id == player) {
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
                    } else if (ranks[p.id] !== undefined && ranks[p.id].matches >= 4) {
                        prefix = tools.ordinalSuffix(i) + " - "
                    }
                    player_selections.push(
                        {
                            label: prefix + p.name,
                            value: p.id,
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
                    let description = ""
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
                            ("▶️ " + stats.players[player].racer[i].plays + " (" + Math.round((stats.players[player].racer[i].plays / stats.players[player].races.total) * 100) + "%)"),
                            (stats.players[player].racer[i].picks.length > 0 ? "👆 " + Math.round((stats.players[player].racer[i].picks.reduce((a, b) => { return a + b }) / stats.players[player].racer[i].picks.length) * 100) + "%" : "👆 --%"),
                            (stats.players[player].racer[i].bans.length > 0 ? "❌ " + Math.round((stats.players[player].racer[i].bans.reduce((a, b) => { return a + b }) / stats.players[player].racer[i].bans.length) * 100) + "%" : "❌ --%"),
                            (stats.players[player].racer[i].wins.length > 0 ? "👑 " + Math.round((stats.players[player].racer[i].wins.reduce((a, b) => { return a + b }) / stats.players[player].racer[i].wins.length) * 100) + "%" : "👑 --%"),
                            (stats.players[player].racer[i].deaths.length > 0 ? "💀 " + (stats.players[player].racer[i].deaths.reduce((a, b) => { return a + b }) / stats.players[player].racer[i].deaths.length).toFixed(2) : "💀 --"),
                            (stats.players[player].racer[i].nu > 0 ? "🐢 " + stats.players[player].racer[i].nu : ""),
                            (stats.players[player].racer[i].skips > 0 ? "⏩ " + stats.players[player].racer[i].skips : "")
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
                    description = ""
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
                            ("▶️ " + stats.players[player].track[i].plays + " (" + Math.round((stats.players[player].track[i].plays / stats.players[player].races.total) * 100) + "%)"),
                            (stats.players[player].track[i].picks.length > 0 ? "👆 " + Math.round((stats.players[player].track[i].picks.reduce((a, b) => { return a + b }) / stats.players[player].track[i].picks.length) * 100) + "%" : "👆 --%"),
                            (stats.players[player].track[i].bans.length > 0 ? "❌ " + Math.round((stats.players[player].track[i].bans.reduce((a, b) => { return a + b }) / stats.players[player].track[i].bans.length) * 100) + "%" : "❌ --%"),
                            (stats.players[player].track[i].wins.length > 0 ? "👑 " + Math.round((stats.players[player].track[i].wins.reduce((a, b) => { return a + b }) / stats.players[player].track[i].wins.length) * 100) + "%" : "👑 --%"),
                            (stats.players[player].track[i].deaths.length > 0 ? "💀 " + (stats.players[player].track[i].deaths.reduce((a, b) => { return a + b }) / stats.players[player].track[i].deaths.length).toFixed(2) : "💀 --"),
                            (stats.players[player].track[i].nu > 0 ? "🐢  " + stats.players[player].track[i].nu : ""),
                            (stats.players[player].track[i].skips > 0 ? " ⏩  " + stats.players[player].track[i].skips : ""),
                            (stats.players[player].track[i].runbacks > 0 ? " 🔁  " + stats.players[player].track[i].runbacks : "")
                        ].join(" ")
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
                        racer_selections = racer_selections.sort(function (a, b) { return stats.racer[b.value].plays - stats.racer[a.value].plays })
                        track_selections = track_selections.sort(function (a, b) { return stats.track[b.value].plays - stats.track[a.value].plays })
                    } else if (sort == "picks") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.racer[a.value].picks, stats.racer[b.value].picks) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.track[a.value].picks, stats.track[b.value].picks) })
                    } else if (sort == "bans") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.racer[a.value].bans, stats.racer[b.value].bans) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.track[a.value].bans, stats.track[b.value].bans) })
                    } else if (sort == "wins") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.racer[a.value].wins, stats.racer[b.value].wins) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.track[a.value].wins, stats.track[b.value].wins) })
                    } else if (sort == "deaths") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.racer[a.value].deaths, stats.racer[b.value].deaths) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.track[a.value].deaths, stats.track[b.value].deaths) })
                    } else if (sort == "nu") {
                        racer_selections = racer_selections.sort(function (a, b) { return stats.racer[b.value].nu - stats.racer[a.value].nu })
                        track_selections = track_selections.sort(function (a, b) { return stats.track[b.value].nu - stats.track[a.value].nu })
                    } else if (sort == "skips") {
                        racer_selections = racer_selections.sort(function (a, b) { return stats.racer[b.value].skips - stats.racer[a.value].skips })
                        track_selections = track_selections.sort(function (a, b) { return stats.track[b.value].skips - stats.track[a.value].skips })
                    } else if (sort == "game") {
                        racer_selections = racer_selections.sort(function (a, b) { return Number(a.value) - Number(b.value) })
                        track_selections = track_selections.sort(function (a, b) { return Number(a.value) - Number(b.value) })
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
                        racer_selections = racer_selections.sort(function (a, b) { return stats.players[player].racer[b.value].plays - stats.players[player].racer[a.value].plays })
                        track_selections = track_selections.sort(function (a, b) { return stats.players[player].track[b.value].plays - stats.players[player].track[a.value].plays })
                    } else if (sort == "picks") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.players[player].racer[a.value].picks, stats.players[player].racer[b.value].picks) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.players[player].track[a.value].picks, stats.players[player].track[b.value].picks) })
                    } else if (sort == "bans") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.players[player].racer[a.value].bans, stats.players[player].racer[b.value].bans) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.players[player].track[a.value].bans, stats.players[player].track[b.value].bans) })
                    } else if (sort == "wins") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.players[player].racer[a.value].wins, stats.players[player].racer[b.value].wins) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.players[player].track[a.value].wins, stats.players[player].track[b.value].wins) })
                    } else if (sort == "deaths") {
                        racer_selections = racer_selections.sort(function (a, b) { return getSort(stats.players[player].racer[a.value].deaths, stats.players[player].racer[b.value].deaths) })
                        track_selections = track_selections.sort(function (a, b) { return getSort(stats.players[player].track[a.value].deaths, stats.players[player].track[b.value].deaths) })
                    } else if (sort == "nu") {
                        racer_selections = racer_selections.sort(function (a, b) { return stats.players[player].racer[b.value].nu - stats.players[player].racer[a.value].nu })
                        track_selections = track_selections.sort(function (a, b) { return stats.players[player].track[b.value].nu - stats.players[player].track[a.value].nu })
                    } else if (sort == "skips") {
                        racer_selections = racer_selections.sort(function (a, b) { return stats.players[player].racer[b.value].skips - stats.players[player].racer[a.value].skips })
                        track_selections = track_selections.sort(function (a, b) { return stats.players[player].track[b.value].skips - stats.players[player].track[a.value].skips })
                    } else if (sort == "game") {
                        racer_selections = racer_selections.sort(function (a, b) { return Number(a.value) - Number(b.value) })
                        track_selections = track_selections.sort(function (a, b) { return Number(a.value) - Number(b.value) })
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