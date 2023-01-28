function countDown() {
    //postMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>", [], [])
    for (let i = 0; i <= 5; i++) {
        setTimeout(async function () {
            client.api.channels(interaction.channel_id).messages.post({
                data: {
                    content: (i == 5 ? "GO!" : (5 - i)),
                    //tts: i == 5
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
            if (getWinner(index)) {
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

function adminEmbed() {
    const embed = new Discord.MessageEmbed()
        .setAuthor('Match Manager')
        .setTitle((livematch.tourney == "practice" ? "`Practice Mode`" : tourney_tournaments_data[livematch.tourney].nickname) + ": " + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].bracket + " " + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].round + " - " + Object.values(livematch.players).map(p => getUsername(p)).join(" vs "))
        .setDescription("This menu is for resetting the match to a previous point in the event of an error. Please make a selection.\nCurrent Race: `" + livematch.current_race + "`\nCurrent Stage: `" + livematch.status + "`")
    return embed
}

function adminComponents() {
    let options = []
    if (livematch.current_race == 0) {
        options.push(
            {
                label: "Reset to First Options",
                value: "first",
                description: "Completely reset the match to determining the first track"
            }
        )
    }
    if (livematch.current_race == 1 && Object.values(liverules.match.permabans).length > 0) {
        options.push(
            {
                label: "Reset to Permabans",
                value: "permaban",
                description: "Reset to determining permanent bans"
            }
        )
    }
    if (livematch.current_race !== 0) {
        options.push(
            {
                label: "Reset to Previous Race Submission",
                value: "prevrace",
                description: "Reset to submission of previous race results"
            },
            {
                label: "Reset to Ban Phase",
                value: "events",
                description: "Reset current race to the start of the ban phase"
            }
        )
    }
    if (['prerace', 'midrace'].includes(livematch.status)) {
        options.push(
            {
                label: "Reset to Race Setup",
                value: "prerace",
                description: "Reset current race to racer selection and setup phase"
            }
        )
    }
    options.push(
        {
            label: "Delete Match",
            value: "delete",
            description: "Completely abandon match and delete any stored data"
        }
    )
    return [
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: "tourney_play_admin",
                    options: options,
                    placeholder: "Select Option",
                    min_values: 1,
                    max_values: 1
                }
            ]
        }
    ]
}

function raceEventComponents(race) {
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
            if (this_args.length > 3) {
                if (Number(this_args[3].replace("event", "")) == i) {
                    default_stuff = component.components[0].options.filter(option => option.default).map(option => String(option.value).replace("repeat", ""))
                }
            }
        })
        let this_args = interaction.data.custom_id.split("_")
        if (this_args.length > 3) {
            if (interaction.data.hasOwnProperty("values") && Number(this_args[3].replace("event", "")) == i) {
                default_stuff = interaction.data.values.map(value => String(value).replace("repeat", ""))
            }
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
                        description: (ruleset.general?.description ?? ruleset.description).slice(0, 100)
                    }
                )
            })
        } else {
            let stages = Object.keys(tourney_tournaments_data[livematch.tourney].stages)
            stages.forEach(key => {
                let bracket = tourney_tournaments_data[livematch.tourney].stages[key]
                bracket_options.push(
                    {
                        label: bracket.bracket + " " + (bracket.round ?? "") + " - " + tourney_rulesets_data.saved[bracket.ruleset].general.name,
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
                custom_id: "tourney_play_setup_comm"
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