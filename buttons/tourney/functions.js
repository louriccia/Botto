const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { methods, trackgroups, firsts, condition_names } = require('./data.js')
const { racers, tracks, planets, circuits, difficulties } = require('../../data.js')
const { avgSpeed, upgradeCooling, upgradeTopSpeed, timefix, capitalize } = require('../../tools.js')
const { postMessage } = require('../../discord_message.js');

exports.initializeMatch = function (livematchref) {
    let match = {
        status: "setup",
        tourney: "",
        bracket: "",
        ruleset: "",
        datetime: "",
        players: [],
        commentators: [],
        stream: "",
        firstvote: "",
        current_race: 0
    }
    livematchref.set(match)
    return match
}

exports.countDown = function (interaction) {
    //postMessage(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>", [], [])
    for (let i = 0; i <= 5; i++) {
        setTimeout(async function () {
            postMessage(interaction.client, interaction.channel.id, {
                content: String((i == 5 ? "GO!" : (5 - i)))
            })
        }, 3000 + i * 1000)
    }
}

exports.setupEmbed = function ({ livematch, tourney_rulesets_data, tourney_tournaments_data } = {}) {
    const matchMaker = new EmbedBuilder()
        .setTitle("Match Setup")
        .setDescription("🏆 Tournament: " + (livematch.tourney == "" ? "" : livematch.tourney == "practice" ? "`Practice Mode`" : "`" + tourney_tournaments_data[livematch.tourney]?.name + "`") + "\n" +
            (livematch.tourney == "practice" ? "" : "⭕ Bracket/Round: " + (livematch.bracket == "" || livematch.tourney == "practice" ? "" : "`" + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].bracket + " " + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].round + "`") + "\n") +
            "📜 Ruleset: " + (livematch.ruleset == "" ? "" : "`" + tourney_rulesets_data?.saved[livematch.ruleset]?.general?.name + "`") + "\n" +
            "👥 Players: " + ([null, undefined, ""].includes(livematch.players) ? "" : Object.values(livematch.players).map(id => "<@" + id + "> ")) + "\n" +
            "🎙️ Commentators/Trackers: " + ([null, undefined, ""].includes(livematch.commentators) ? "" : Object.values(livematch.commentators).map(id => "<@" + id + "> ")) + "\n" +
            "📺 Stream: " + livematch.stream
        )
        .setColor("#3BA55D")
        .setAuthor({ name: "Tournaments", iconURL: "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png" })

    return matchMaker
}

exports.firstEmbed = function (livematch) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "First Track" })
        .setTitle("How would you like to determine the first track?")
        .setDescription("*If players do not agree on a method, the default option will be used.*\n" + ([undefined, null].includes(livematch.firstvote) ? "" : Object.keys(livematch.firstvote).map(key => "<@" + key + "> voted for **" + methods[livematch.firstvote[key]] + "**").join("\n")))
    return embed
}

exports.colorEmbed = function (livematch) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "First Track: " + methods[livematch.firstmethod] })
        .setTitle("Pick a color")
    let desc = "" + ([undefined, null].includes(livematch.firstcolors) ? "" : Object.keys(livematch.firstcolors).map(key => ":" + livematch.firstcolors[key] + "_square: - <@" + key + ">").join("\n"))
    if (desc) {
        embed.setDescription(desc)
    }
    return embed
}

exports.firstbanEmbed = function ({ livematch }) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "First Track: " + methods[livematch.firstmethod] })
    let desc = "" + ([undefined, null].includes(livematch.firstbans) ? "" :
        Object.keys(livematch.firstbans).map(key =>
            "<@" + livematch.firstbans[key].player + "> banned **" +
            ([undefined, null].includes(trackgroups[livematch.firstbans[key].ban]) ? planets[tracks[Number(livematch.firstbans[key].ban)].planet].emoji + " " + tracks[Number(livematch.firstbans[key].ban)].name : trackgroups[livematch.firstbans[key].ban].name) + "**"
        ).join("\n"))
    if (desc) {
        embed.setDescription(desc)
    }
    return embed
}

exports.getLeaderboard = function ({ track, conditions, matchdata, rulesetdata, podbans } = {}) {
    let leaderboard = []
    Object.values(matchdata).forEach(match => {
        let ruleset = rulesetdata.saved[match.ruleset]
        if (match.races && ruleset.general.type !== 'Qualifier') {
            Object.values(match.races).forEach(race => {
                let thistrack = exports.getTrack(race)
                let thisconditions = exports.getConditions(ruleset, race)
                if (track == thistrack) {
                    if (race.runs) {
                        Object.values(race.runs).forEach(run => {
                            if (run.retroskip) {
                                thisconditions.trak = 'fs'
                            }
                            if (run.time !== 'DNF' && exports.matchConditions(conditions, thisconditions)) {
                                leaderboard.push({ ...run, podban: podbans.includes(String(run.pod)) })
                            }
                        })
                    }
                }
            })
        }
    })
    leaderboard = leaderboard.sort((a, b) => a.time - b.time)
    leaderboard[0].trecord = true
    let unique = []
    if (podbans.includes(String(leaderboard[0].pod))) {
        unique.push(leaderboard[0])
    }
    leaderboard = leaderboard.filter(r => !r.podban)
    leaderboard[0].record = true
    leaderboard.forEach(r => {
        if (!unique.map(u => u.player).includes(r.player)) {
            unique.push(r)
        }
    })
    return unique
}

exports.raceEmbed = function ({ race, livematch, liverules, userdata, matchdata, rulesetdata } = {}) {
    let repeat = false
    let events = Object.values(livematch.races[race].events)
    let conditions = exports.getConditions(liverules, livematch.races[race], race)
    let track = exports.getTrack(livematch.races[race])
    let podbans = livematch.races[race].events ? Object.values(livematch.races[race].events).filter(e => e.event == 'tempban' && e.type == 'racer').map(e => e.selection).flat().map(s => String(s)) : []
    let forces = events.filter(event => event.event == 'override' && event.type == 'condition').map(event => capitalize(condition_names[event.selection]))
    let players = Object.values(livematch.players)
    if (events.map(e => e.repeat).includes(true)) {
        forces.push('Runback')
    }
    if (livematch.races[race].gents?.agreed) {
        forces.push("🎩 Gentleman's Agreement")
    }
    let conmap = Object.values(conditions).filter(c => !['um', 'fp', 'tt'].includes(c)).map(con => "`" + condition_names[con] + "`").join(" ")
    const embed = new EmbedBuilder()
        .setTitle((repeat ? "🔁" : planets[tracks[track].planet].emoji) + " " + tracks[track].name + (forces.length > 0 ? " (" + forces.join(", ") + ")" : ""))
        .setThumbnail(tracks[track].preview)
        .setDescription(conmap + ([null, undefined, ""].includes(livematch.races[race].gents) ? "" : "\n🎩 " + livematch.races[race].gents.terms))

    function resultFormat(run, winner, leaderboard) {
        if (!run || !run.time) {
            return ''
        }
        return [(run.pod == "" ? '❔' : racers[run.pod].flag),
        (String(run.time).toLowerCase() == 'dnf' ? 'DNF' : (winner ? "__" : "") + timefix(run.time) + (winner ? "__" : "")),
        (leaderboard ? ` - ${exports.getUsername({ member: run.player, userdata, short: true })}` : ''),
        ([null, undefined, 0].includes(run.deaths) ? '' : "`" + `💀×${run.deaths == "" ? "?" : Number(run.deaths)}` + "`"),
        (run.notes == "" || leaderboard ? "" : "\n📝 " + run.notes), (run.trecord ? '`Tourney Record`' : run.record ? '`Best Available Pod`' : '')].filter(f => f !== "").join(" ")
    }
    let leaderboard = exports.getLeaderboard({ track, conditions, matchdata, rulesetdata, podbans }).filter(r => r.record || r.trecord || players.includes(r.player))
    embed.addFields({ name: 'Best Times', value: leaderboard.map(r => resultFormat(r, false, true)).join("\n"), inline: false })

    if (Object.values(livematch.races[race].ready).filter(r => r == false).length > 0 || livematch.races[race].countdown) {
        embed
            .setAuthor({ name: "Race " + (race + 1) + " - Setup" })
            .setColor("#FAA81A")
            .setDescription(conmap + ([null, undefined, ""].includes(livematch.races[race].gents) ? "" : "\n🎩 " + livematch.races[race].gents.terms) + (livematch.races[race].live ? "" : "\n" + (livematch.races[race].countdown ? "\nCountdown starts <t:" + livematch.races[race].countdown + ":R>" : "Countdown starts when both players have readied.")))

        Object.values(livematch.players).map(player => embed.addFields({
            name: exports.getUsername({ member: player, userdata }),
            value: ([undefined, null, ""].includes(livematch.races[race].runs[player].pod) ?
                ":red_circle: Racer not selected" :
                ":green_circle: Racer selected " + (livematch.races[race].reveal[player] ?
                    "\n**" + racers[livematch.races[race].runs[player].pod].flag + " " + racers[Number(livematch.races[race].runs[player].pod)].name + "**" : "(hidden)")) + "\n" +
                (livematch.races[race].countdown ? "" : (livematch.races[race].ready[player] ? ":green_circle: Ready" : ":red_circle: Not Ready")),
            inline: true
        }
        ))

        //embed.addFields({ name: "🎙️ Commentators/Trackers", value: (livematch.races[race].ready.commentators ? ":green_circle: Ready" : ":red_circle: Not Ready") })
        if (forces.includes("No Upgrades")) {
            embed.addFields({ name: "🕹️ Players", value: ":orange_circle: Don't forget to show your parts to verify upgrades", inline: false })
        }
        if (forces.includes("Fastest Lap")) {
            embed.addFields({ name: "🕹️ Players", value: ":orange_circle: Don't forget to delete your `tgdf.dat` file or set your laps to 4", inline: false })
        }
    } else if (livematch.races[race].live) {
        embed
            .setAuthor({ name: "Race " + (race + 1) + " - In Progress" })
            .setColor("#DD2E44")
        Object.values(livematch.players).map(player => embed.addFields({
            name: exports.getUsername({ member: player, userdata }),
            value: livematch.races[race].runs[player].time == "" ? ":red_circle: Awaiting submission" : ":green_circle: Results Submitted\n||" + resultFormat(livematch.races[race].runs[player], false) + "||",
            inline: true
        }))
        if (Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
            embed.addFields({ name: "🎙️ Commentators/Trackers", value: ":red_circle: Awaiting Verification", inline: false })
        }

    } else {
        embed
            .setAuthor({ name: "Race " + (race + 1) + " - Results" })
            .setColor("#2D7D46")
        if (![null, undefined, ""].includes(livematch.races[race].runs) && Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
            let winner = exports.getWinner({ race, livematch })
            Object.values(livematch.players).map(player => embed.addFields({
                name: exports.getUsername({ member: player, userdata }) + (player == winner ? " 👑" : ""),
                value: resultFormat(livematch.races[race].runs[player], winner == player),
                inline: true
            }
            ))
            embed.setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name + (forces.length > 0 ? " (" + forces.join(", ") + ")" : "") + " \n" + (exports.getUsername({ member: winner, userdata, short: true })) + " Wins!")
        }
    }


    return embed
}

exports.matchSummaryEmbed = function ({ liverules, livematch, userdata } = {}) {
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
            if (exports.getWinner({ race: index, livematch })) {
                summary[exports.getWinner({ race: index, livematch })].wins++
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
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Match Summary' })
        .setColor("#FFFFFF")
        .setDescription('First to ' + liverules.general.winlimit + ' wins.')
        .setTitle(
            leader.player == "tie" ?
                "Tied Match " + leader.wins + " to " + leader.wins :
                exports.getUsername({ member: leader.player, userdata, short: true }) + " " + (leader.wins == liverules.general.winlimit ? "wins" : "leads") + " " + leader.wins + " to " + summary[exports.getOpponent({ livematch, player: leader.player })].wins + (leader.wins == liverules.general.winlimit - 1 ? " (Match Point)" : ""))
    Object.values(livematch.players).forEach(player => embed.addFields({
        name: exports.getUsername({ member: player, userdata }),
        value: [
            "👑" + summary[player].wins, '💠' + summary[player].forcepoints,
            (liverules.match.repeattrack ? '🔁' + summary[player].runbacks : "")
        ].filter(a => a !== '').map(a => '`' + a + '`').join(" ") + '\n`⏱️' + timefix(summary[player].time) + (summary[player].timetrue ? "" : "+") + '`' +
            ' `💀' + summary[player].deaths + (summary[player].deathtrue ? "" : "+") + '`',
        inline: true
    }))
    embed.addFields({ name: "🎙️ Commentators/Trackers", value: ":orange_circle: Don't forget to update the score!", inline: false })
    return embed
}

exports.raceEventEmbed = function ({ race, livematch, liverules } = {}) {
    //livematch = tourney_live_data[interaction.channel_id]
    let races = Object.values(livematch.races)
    let events = races[race].events
    let eventstart = livematch.races[race].eventstart
    let ruleevents = Object.values(liverules.race)
    let player = (ruleevents[eventstart].choice == "lastwinner" ? exports.getWinner({ race: race - 1, livematch }) : exports.getOpponent({ livematch, player: exports.getWinner({ race: race - 1, livematch }) }))
    let actions = {
        permaban: "🚫 perma-banned",
        tempban: "❌ temp-banned",
        selection: "👆 selected",
        override: "✳️ overrode"
    }
    const embed = new EmbedBuilder()
        .setAuthor({ name: "Race " + (race + 1) + " - Ban Phase" })
        .setColor("#FAA81A")
    let desc = "" + ([undefined, null, ""].includes(events) ? "" :
        Object.values(events).map(e =>
            "<@" + e.player + "> " + actions[e.event] + " a " + e.type + ": **" + (e.type == "track" ?
                (e.repeat ? "🔁" : planets[tracks[e.selection].planet].emoji) + " " + tracks[e.selection].name :
                e.type == "racer" ?
                    Array.isArray(e.selection) ?
                        e.selection.map(racer => racers[racer].flag + " " + racers[racer].name).join(", ") :
                        racers[e.selection].flag + " " + racers[e.selection].name :
                    condition_names[e.selection]) + "**" + ([null, undefined, "", 0].includes(e.cost) ? "" : " for " + e.cost + "💠 forcepoint" + (e.cost == 1 ? "" : "s"))
        ).join("\n"))
    if (desc) {
        embed.setDescription(desc)
    }


    let summary = {}
    Object.values(livematch.players).forEach(player => {
        summary[player] = {
            wins: 0
        }
    })
    Object.values(livematch.races).forEach((race, index) => {
        if (index + 1 < Object.values(livematch.races).length) {
            summary[exports.getWinner({ race: index, livematch })].wins++
        }
    })
    if (exports.getForcePoints({ player, liverules, livematch }) > 0 && summary[exports.getOpponent({ livematch, player })].wins == liverules.general.winlimit - 1) {
        embed.setFooter({ text: "Last chance to use " + exports.getForcePoints({ player, liverules, livematch }) + " 💠 forcepoint" + (exports.getForcePoints({ player, liverules, livematch }) !== 1 ? "s" : "") + " and " + exports.getRunbacks({ player, livematch, liverules }) + " 🔁 runback" + (exports.getRunbacks({ player, livematch, liverules }) !== 1 ? "s" : "") })
    } else {
        embed.setFooter({ text: "You have " + exports.getForcePoints({ player, liverules, livematch }) + " 💠 forcepoint" + (exports.getForcePoints({ player, liverules, livematch }) !== 1 ? "s" : "") + " and " + exports.getRunbacks({ player, livematch, liverules }) + " 🔁 runback" + (exports.getRunbacks({ player, livematch, liverules }) !== 1 ? "s" : "") + " remaining" })
    }

    return embed
}

exports.adminEmbed = function ({ livematch, tourney_tournaments_data, userdata } = {}) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Match Manager' })
        .setTitle((livematch.tourney == "practice" ? "`Practice Mode`" : tourney_tournaments_data[livematch?.tourney]?.nickname) + ": " + tourney_tournaments_data[livematch.tourney]?.stages[livematch.bracket]?.bracket + " " + tourney_tournaments_data[livematch.tourney]?.stages[livematch.bracket]?.round + " - " + (livematch.players ? Object.values(livematch.players).map(p => exports.getUsername({ member: p, userdata })).join(" vs ") : ""))
        .setDescription("This menu is for resetting the match to a previous point in the event of an error. Please make a selection.\nCurrent Race: `" + livematch.current_race + "`\nCurrent Stage: `" + livematch.status + "`")
    return embed
}

exports.adminComponents = function ({ livematch, liverules } = {}) {
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

exports.raceEventComponents = function ({ race, livematch, interaction, liverules } = {}) {
    let components = []
    let eventstart = livematch.races[race].eventstart
    let eventend = livematch.races[race].eventend
    let events = Object.values(liverules.race)
    let fptotal = 0
    let player = (events[eventstart].choice == "lastwinner" ? exports.getWinner({ race: race - 1, livematch }) : exports.getOpponent({ livematch, player: exports.getWinner({ race: race - 1, livematch }) }))
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
            let this_args = component.components[0].data.custom_id.split("_")
            if (this_args.length > 3) {
                if (Number(this_args[3].replace("event", "")) == i) {
                    default_stuff = component.components[0].options.filter(option => option.default).map(option => String(option.value).replace("repeat", ""))
                }
            }
        })
        let this_args = interaction.customId.split("_")
        if (this_args.length > 3) {
            if (interaction.values && Number(this_args[3].replace("event", "")) == i) {
                default_stuff = interaction.values.map(value => String(value).replace("repeat", ""))
            }
        }
        if (![null, undefined, ""].includes(event.count) && default_stuff.length % event.count !== 0) {
            oddselect = true
        }
        if ([null, undefined, ""].includes(event.cost) || exports.getForcePoints({ player, liverules, livematch }) >= event.cost) {
            if (![null, undefined, ""].includes(event.cost)) {
                fptotal += (default_stuff.length / event.count) * event.cost
            }
            if (event.type == "racer") {
                let permabanned_racers = Object.values(livematch.races[1].events).filter(event => event.event == "permaban" && event.type == "racer").map(event => Number(event.selection))
                let tempbanned_racers = Object.values(livematch.races[race].events).filter(event => event.event == "tempban" && event.type == "racer").map(event => Number(event.selection))
                for (let i = 0; i < 25; i++) {
                    if (i < 23 || (event.event == 'selection' && ((!tempbanned_racers.includes(8) && !permabanned_racers.includes(i) && i == 23) || (!tempbanned_racers.includes(22) && !permabanned_racers.includes(i) && i == 24)))) { //handle secret pods
                        let option = exports.getRacerOption(i)

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
                    let aspeed = avgSpeed(
                        upgradeTopSpeed(racers[a_racer].max_speed, upg),
                        racers[a_racer].boost_thrust,
                        racers[a_racer].heat_rate,
                        upgradeCooling(racers[a_racer].cool_rate, upg))
                    let bspeed = avgSpeed(
                        upgradeTopSpeed(racers[b_racer].max_speed, upg),
                        racers[b_racer].boost_thrust,
                        racers[b_racer].heat_rate,
                        upgradeCooling(racers[b_racer].cool_rate, upg))
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
                                already_played[event.selection].loser = exports.getOpponent({ livematch, player: exports.getWinner({ race: index, livematch }) })
                            } else {
                                already_played[event.selection] = { played: 1, loser: exports.getOpponent({ livematch, player: exports.getWinner({ race: index, livematch }) }) }
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
                    let option = exports.getTrackOption(i)
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
                    } else if (event.event !== 'selection' && already_played[i] && saltmap[liverules.match.repeattrack.condition] <= already_played[i].played && already_played[i].loser == exports.getOpponent({ livematch, player }) && exports.getRunbacks({ player: exports.getOpponent({ livematch, player }), livematch, liverules }) > 0) { //not selecting the track but opponent could still runback
                        option.description = "Already played but your opponent could run it back"
                        options.push(option)
                    } else if (event.event == 'selection' && already_played[i] && saltmap[liverules.match.repeattrack.condition] <= already_played[i].played && already_played[i].loser == player && exports.getRunbacks({ player, livematch, liverules }) > 0) { //selecting the track and it can be runback
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
                    sk: { name: 'Skips', desc: "Players can use skips (excluding AI and bounce skips)" },
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
                        placeholder: capitalize([event.event.replace("selection", "select"), event.type].join(" ")) + ([null, undefined, ""].includes(event.cost) ? "" : " (" + (event.cost == 0 ? "free" : event.cost + "💠/" + (event.count == 1 ? event.type : event.count + " " + event.type + "s")) + ")") + (oddselect ? " (select in sets of " + event.count : ""),
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
                        label: notrack ? "No Track Selected" : (exports.getForcePoints({ player, liverules, livematch }) - fptotal < 0) ? "Not enough forcepoints" : oddselect ? "Too many or too few selections" : "Submit" + (fptotal == 0 ? "" : " (" + fptotal + "💠)") + (repeat ? " (🔁)" : ""),
                        style: 1,
                        custom_id: "tourney_play_race" + race + "_event_submit",
                        disabled: (exports.getForcePoints({ player, liverules, livematch }) - fptotal < 0) || notrack || oddselect
                    },
                ]
            }
        )
    }
    return components
}

exports.permabanEmbed = function ({ livematch } = {}) {
    let races = Object.values(livematch.races)
    let events = races[1].events
    const embed = new EmbedBuilder()
        .setAuthor({ name: "Permanent Bans" })
    let desc = "" + ([undefined, null, ""].includes(events) ? "" :
        Object.values(events).filter(event => event.event == "permaban").map(ban =>
            "<@" + ban.player + "> 🚫 perma-banned a " + (ban.type == "track" ? "track: **" + planets[tracks[ban.selection].planet].emoji + " " + tracks[ban.selection].name : "racer: " + racers[ban.selection].flag + " " + racers[ban.selection].name) + "**"
        ).join("\n"))
    if (desc) {
        embed.setDescription(desc)
    }

    return embed
}

exports.setupComponents = function ({ livematch, tourney_rulesets_data, tourney_tournaments_data } = {}) {

    const tourneyRow = new ActionRowBuilder()
    const bracketRow = new ActionRowBuilder()
    const rulesetRow = new ActionRowBuilder()
    const tourney_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setup_tournament')
        .setPlaceholder("Select Tournament")
        .setMinValues(1)
        .setMaxValues(1)
    const ruleset_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setup_ruleset')
        .setPlaceholder("Select Ruleset")
        .setMinValues(1)
        .setMaxValues(1)
    const bracket_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setup_bracket')
        .setPlaceholder("Select Bracket")
        .setMinValues(1)
        .setMaxValues(1)
    tourneyRow.addComponents(tourney_selector)
    bracketRow.addComponents(bracket_selector)
    rulesetRow.addComponents(ruleset_selector)
    tourney_selector.addOptions({
        label: "Practice Mode",
        value: "practice",
        emoji: { name: "🚩" },
        default: livematch.tourney == 'practice'
    })
    Object.keys(tourney_tournaments_data).sort((a, b) => tourney_tournaments_data[b].startdate - tourney_tournaments_data[a].startdate).forEach(key => {
        tourney_selector.addOptions(
            {
                label: tourney_tournaments_data[key]?.name,
                value: key,
                emoji: { name: "🏆" },
                default: key == livematch.tourney
            }
        )
    })
    let components = []
    components.push(tourneyRow)
    if (livematch.tourney) {
        if (livematch.tourney == "practice") {
            function getName(ruleset) {
                return ruleset.general?.name ?? ruleset.name
            }
            let rulesets = Object.keys(tourney_rulesets_data.saved).sort((a, b) => getName(tourney_rulesets_data.saved[a]).localeCompare(getName(tourney_rulesets_data.saved[b])))
            rulesets.forEach(key => {
                let ruleset = tourney_rulesets_data.saved[key]
                ruleset_selector.addOptions(
                    {
                        label: ruleset.general?.name ?? ruleset.name,
                        value: String(key),
                        description: " " + (ruleset.general?.description ?? ruleset.description).slice(0, 99),
                        default: key == livematch.ruleset
                    }
                )
            })
            components.push(rulesetRow)
        } else {
            let stages = Object.keys(tourney_tournaments_data[livematch.tourney].stages)
            stages.forEach(key => {
                let bracket = tourney_tournaments_data[livematch.tourney].stages[key]
                bracket_selector.addOptions(
                    {
                        label: bracket.bracket + " " + (bracket.round ?? "") + " - " + tourney_rulesets_data.saved[bracket.ruleset].general.name,
                        value: key,
                        default: key == livematch.bracket
                    }
                )
            })
            components.push(bracketRow)
        }
    }
    let playable = false, joinable_player = false, joinable_commentator = false
    if (livematch.ruleset !== "" && livematch.players && livematch.commentators && Object.values(livematch.players).length == 2) {
        playable = true
    }
    if (!livematch.players || Object.values(livematch.players).length < 2) {
        joinable_player = true
    }
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setup_player")
                .setLabel("Join as Player")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🕹️')
                .setDisabled(!joinable_player)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setup_comm")
                .setLabel("Join as Commentator/Tracker")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎙️')
        )
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_start")
                .setLabel("Start Match")
                .setStyle(ButtonStyle.Success)
                .setDisabled(!playable)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setup_leave")
                .setLabel("Leave Match")
                .setStyle(ButtonStyle.Danger)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setup_cancel")
                .setLabel("Cancel Match")
                .setStyle(ButtonStyle.Danger)
        )
    components.push(row1, row2)
    return components
}

exports.raceComponents = function ({ race, liverules, livematch }) {
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
                avg: avgSpeed(
                    upgradeTopSpeed(racers[option].max_speed, upg),
                    racers[option].boost_thrust,
                    racers[option].heat_rate,
                    upgradeCooling(racers[option].cool_rate, upg))
            }
        )
    }
    ).sort(function (a, b) { return (b.avg - a.avg) })
    podoptions = podoptions.map(option => option.value)
    const RacerRow = new ActionRowBuilder()
    const racer_select = new StringSelectMenuBuilder()
        .setCustomId("tourney_play_race" + race + "_racer")
        .setOptions(podoptions.map(pod => {
            return exports.getRacerOption(pod)
        }))
        .setPlaceholder("Select Racer")
        .setMaxValues(1)
        .setMinValues(1)
    RacerRow.addComponents(racer_select)

    const ButtonRow = new ActionRowBuilder()
    if (livematch.races[race].gents?.agreed == "?") {
        ButtonRow.addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_race" + race + "_gents_true")
                .setLabel("Accept")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("tourney_play_race" + race + "_gents_false")
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger)
        )
        return [ButtonRow]
    }
    if (!livematch.races[race].live) {
        if (livematch.races[race].countdown) {
            ButtonRow
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_reveal")
                        .setLabel("Reveal Racer Choice")
                        .setStyle(ButtonStyle.Secondary)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_abort")
                        .setLabel("Abort Countdown")
                        .setStyle(ButtonStyle.Danger)
                )
        } else {
            ButtonRow
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_ready")
                        .setLabel(Object.values(livematch.races[race].ready).filter(v => v === false).length == 1 ? "Start Countdown" : "Ready")
                        .setStyle(ButtonStyle.Success)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_unready")
                        .setLabel("Not Ready")
                        .setStyle(ButtonStyle.Danger)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_reveal")
                        .setLabel("Reveal Racer Choice")
                        .setStyle(ButtonStyle.Secondary)
                )
        }
        if (liverules.general.gents) {
            ButtonRow.addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_race" + race + "_gents")
                    .setEmoji("🎩")
                    .setStyle(ButtonStyle.Secondary)
            )
        }
        return [RacerRow, ButtonRow]
    } else {
        ButtonRow
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_race" + race + "_submit")
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Submit Results")
            )
        if (Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time !== "").length == 0) {
            ButtonRow
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_restart")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Restart")
                )
        } else if (Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
            ButtonRow
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_verify")
                        .setLabel("Verify")
                        .setStyle(ButtonStyle.Secondary)
                )
        }
        return [ButtonRow]
    }


}

exports.firstComponents = function ({ liverules, livematch } = {}) {
    const FirstVote = new ActionRowBuilder()
    const FirstPlay = new ActionRowBuilder()
    const first_vote_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_first_vote')
        .setPlaceholder("Select Options")
        .setMinValues(1)
        .setMaxValues(1)
        .setOptions(exports.getFirstOptions({ liverules }))
    FirstVote.addComponents(first_vote_selector)
    FirstPlay.addComponents(
        new ButtonBuilder()
            .setCustomId("tourney_play_first_start")
            .setLabel(([undefined, null].includes(livematch.firstmethod) ? methods[liverules.general.firsttrack.primary] + " (Default)" : methods[livematch.firstmethod]))
            .setStyle(ButtonStyle.Primary)
            .setDisabled([undefined, null].includes(livematch.firstvote) || Object.keys(livematch.firstvote).length < 2)
    )
    return [FirstVote, FirstPlay]
}

exports.colorComponents = function () {
    const ColorRow = new ActionRowBuilder()
    ColorRow.addComponents(
        new ButtonBuilder()
            .setCustomId("tourney_play_first_color_red")
            .setLabel("Red")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🟥"),
        new ButtonBuilder()
            .setCustomId("tourney_play_first_color_blue")
            .setLabel("Blue")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🟦")

    )
    return [ColorRow]
}

exports.firstbanComponents = function ({ livematch, liverules } = {}) {
    const FirstBan = new ActionRowBuilder()
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
        selectoptions = circuitoptions.map(option => { return ({ label: trackgroups[option].name, value: String(option), description: trackgroups[option].count + " tracks" }) })
    } else if (livematch.firstmethod == "poe_p" && planetoptions.length > 1) {
        selectoptions = planetoptions.map(option => { return ({ label: trackgroups[option].name, value: String(option), description: trackgroups[option].count + " tracks" }) })
    } else {
        selectoptions = trackoptions.map(option => exports.getTrackOption(option))
    }
    const first_ban_selector = new StringSelectMenuBuilder()
        .setCustomId("tourney_play_first_" + (livematch.firstmethod.includes("poe") ? "ban" : "pick"))
        .setPlaceholder("Select Option")
        .setMinValues(1)
        .setMaxValues(1)
        .setOptions(selectoptions)
    FirstBan.addComponents(first_ban_selector)
    return [FirstBan]
}

exports.permabanComponents = function ({ permaban, livematch, liverules } = {}) {
    let pban = liverules.match.permabans[permaban]
    //livematch = tourney_live_data[interaction.channel_id]
    let selectoptions = []
    if (pban.type == "track") {
        let permatrackbans = Object.values(livematch.races[1].events).filter(event => event.event == "permaban").filter(event => event.type == "track").map(event => Number(event.selection))
        for (let i = 0; i < 25; i++) {
            if (!permatrackbans.includes(i)) {
                selectoptions.push(
                    exports.getTrackOption(i)
                )
            }
        }
    } else if (pban.type == "racer") {
        let permaracerbans = Object.values(livematch.races[1].events).filter(event => event.event == "permaban").filter(event => event.type == "track").map(event => event.selection)
        for (let i = 0; i < 25; i++) {
            if (!permaracerbans.includes(i)) {
                selectoptions.push(
                    exports.getRacerOption(i)

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

exports.rulesetOverview = function (ruleset) {
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

exports.getUsername = function ({ member, userdata, short } = {}) {
    let name = "N/A"
    Object.values(userdata).forEach(user => {
        if (user.discordID == member) {
            name = (user.country ? ":flag_" + user.country.toLowerCase() + ": " : "") + user.name + (user.pronouns ? " (" + exports.joinPronouns(user.pronouns) + ")" : "")
            if (short) {
                name = user.name
            }
            return
        }
    })
    return name
}

exports.getTrackOption = function (i) {
    return (
        {
            label: tracks[i].name,
            value: String(i),
            description: [circuits[tracks[i].circuit].abbreviation + " - Race " + tracks[i].cirnum, planets[tracks[i].planet].name, difficulties[tracks[i].difficulty].name, tracks[i].lengthclass].join(" | "),
            emoji: {
                name: planets[tracks[i].planet].emoji.split(":")[1],
                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
            }
        }
    )
}

exports.getRacerOption = function (i) {
    let muspeed = avgSpeed(upgradeTopSpeed(racers[i].max_speed, 5), racers[i].boost_thrust, racers[i].heat_rate, upgradeCooling(racers[i].cool_rate, 5)).toFixed(0)
    let nuspeed = avgSpeed(upgradeTopSpeed(racers[i].max_speed, 0), racers[i].boost_thrust, racers[i].heat_rate, upgradeCooling(racers[i].cool_rate, 0)).toFixed(0)
    return (
        {
            label: racers[i].name,
            value: String(i),
            description: 'Avg Speed ' + muspeed + ' (NU ' + nuspeed + "); Max Turn " + racers[i].max_turn_rate + "°/s",
            emoji: {
                name: racers[i].flag.split(":")[1],
                id: racers[i].flag.split(":")[2].replace(">", "")
            }
        }
    )
}

exports.getFirstOptions = function ({ liverules }) {

    let firstoptions = [
        {
            label: "Already Decided",
            description: "Both players have already agreed to the starting track",
            value: "already"
        },
        {
            label: firsts[liverules?.general?.firsttrack?.primary]?.label + " (Default)",
            value: liverules?.general?.firsttrack?.primary,
            description: firsts[liverules?.general?.firsttrack?.primary]?.description
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

exports.getOpponent = function ({ livematch, player } = {}) {
    let opponent = Object.values(livematch.players).filter(p => p != player)
    return opponent[0]
}

exports.getWinner = function ({ race, livematch } = {}) {
    let winner = null
    if (!livematch) {
        return null
    }
    let players = livematch.players ? Object.values(livematch.players) : []
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

exports.getForcePoints = function ({ player, liverules, livematch } = {}) {
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

exports.getRunbacks = function ({ player, livematch, liverules }) {
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

exports.matchMakerEmbed = function ({ livematch, tourney_tournaments_data, tourney_rulesets_data, userdata }) {
    const matchmaker = new EmbedBuilder()
        .setAuthor({ name: livematch.tourney == "practice" ? "`Practice Mode`" : tourney_tournaments_data[livematch.tourney].name, iconURL: "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png" })
        .setTitle((livematch.tourney == "practice" ? "" : tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].bracket + " " + tourney_tournaments_data[livematch.tourney].stages[livematch.bracket].round) + " - " + Object.values(livematch.players).map(player => exports.getUsername({ member: player, userdata })).join(" vs "))
        .setDescription("📜 " + tourney_rulesets_data.saved[livematch.ruleset].general.name + "\n" +
            "🎙️ " + ([null, undefined, ""].includes(livematch.commentators) ? "" : Object.values(livematch.commentators).map(id => "<@" + id + "> ")) + "\n" +
            "📺 " + livematch.stream
        )
        .setColor("#3BA55D")
    Object.keys(livematch.players).forEach(p => {
        matchmaker.addFields({
            name: (userdata[p].country ? ":flag_" + userdata[p].country + ": " : "") + userdata[p].name + (userdata[p].pronouns ? " (" + exports.joinPronouns(userdata[p].pronouns) + ")" : ""),
            value: (userdata[p].platform ? "`" + userdata[p].platform + "`" : "No platform set") + " - " + (userdata[p].input ? "`" + userdata[p].input + "`" : 'No input set') + "\n" + ("*" + userdata[p].bio + "*" ?? "")
        })
    })

    return matchmaker
}

exports.joinPronouns = function (pronouns) {
    if (Array.isArray(pronouns)) {
        if (pronouns.length > 1) {
            return pronouns.map(p => p.split("/")[0]).join("/")
        } else {
            return pronouns[0]
        }
    } else {
        return pronouns
    }
}

exports.profileComponents = function () {
    const ButtonRow = new ActionRowBuilder()
    ButtonRow.addComponents(
        new ButtonBuilder()
            .setCustomId("tourney_play_profile")
            .setLabel("Update Profile")
            .setStyle(ButtonStyle.Secondary)
    )
    return [ButtonRow]
}

exports.reminderEmbed = function () {
    const reminder = new EmbedBuilder()
        .setTitle("Responsibilities")
        .addFields({ name: "🕹️ Player Responsibilities", value: "○ Verify all pods/tracks/upgrades are unlocked\n○ Check that stream is running smoothly\n○ Disable game music\n○ Limit stream quality to 720p\n○ Wait until the results screen to report your times\n○ Be attentive to this chat", inline: false })
        .addFields({ name: "🎙️ Commentator Responsibilities", value: "○ Use SG interface to conduct a sound check!\n○ Enable all voice related settings in Discord including Krisp noise supression, advanced voice activity, etc.\n○  Open stream on Twitch to respond to chat\n○ Verify race results/update score\n○ Sync streams (avoid decreasing delay mid-race)", inline: false })
    return reminder
}

exports.rulesetOverviewEmbed = function ({ tourney_rulesets_data, livematch } = {}) {
    const ruleset = new EmbedBuilder()
        .setAuthor({ name: "Ruleset Overview" })
        .setTitle("📜 " + tourney_rulesets_data.saved[livematch.ruleset].general.name)
        .setDescription(tourney_rulesets_data.saved[livematch.ruleset].general.description)
        .addFields(exports.rulesetOverview(tourney_rulesets_data.saved[livematch.ruleset]))
    return ruleset
}

exports.getConditions = function (ruleset, race, racenum) {
    let conditions = {}
    if (ruleset !== 'practice' && ruleset?.general?.type == '1v1') {
        conditions = { ...ruleset.general.default }
        if (race.events) {
            Object.values(race.events).filter(e => e.event == 'override' && e.type == 'condition').forEach(event => {
                if (event.selection == 'nu') {
                    conditions.upgr = 'nu'
                }
                if (event.selection == 'fl') {
                    conditions.time = 'fl'
                }
                if (event.selection == 'sk') {
                    conditions.trak = 'fs'
                }
            })
        }
    } else {
        conditions = { ...ruleset?.playlist?.[racenum]?.conditions }
    }
    return conditions
}

exports.matchConditions = function (conditions1, conditions2) {
    if (!conditions1 | !conditions2) {
        return false
    }
    let match = true
    Object.values(conditions1).forEach(con => {
        if (!Object.values(conditions2).includes(con)) {
            match = false
        }
    })
    return match
}

exports.getTrack = function (race) {
    if (race?.track) {
        return race.track
    } else if (race?.events) {
        return Object.values(race.events).find(event => event.event == 'selection' && event.type == 'track')?.selection ?? ""
    } else {
        return null
    }
}