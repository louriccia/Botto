const { time_fix } = require("../../generic")

const tourneyReport = new EmbedBuilder()
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
                    track = Number(interaction.values[0])
                } else if (args[1] == "conditions") {
                    if (interaction.data.hasOwnProperty("values")) {
                        conditions = interaction.values
                    }
                } else if (args[1] == "pods") {
                    if (interaction.data.hasOwnProperty("values")) {
                        pods = interaction.values
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
                user = member
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
                if (match.races) {
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
                }

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
                            .addField(runs[i].time == "DNF" ? "DNF" : time_fix(Number(runs[i].time).toFixed(3)),
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