const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

const { methods, trackgroups, firsts, condition_names, choices, events } = require('./data.js')

const { racers } = require('../../data/sw_racer/racer.js')
const { tracks } = require('../../data/sw_racer/track.js')
const { planets } = require('../../data/sw_racer/planet.js')
const { circuits } = require('../../data/sw_racer/circuit.js')
const { difficulties } = require('../../data/difficulty.js')


const { capitalize, time_fix, getTrackName, getRacerName } = require('../../generic.js')
const { postMessage } = require('../../discord.js');
const { avgSpeed, upgradeCooling, upgradeTopSpeed } = require('../../data/sw_racer/part.js');
const { database, db } = require('../../firebase.js');
const { blurple_color } = require('../../colors.js');


exports.initializeMatch = function (match_ref) {
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
    match_ref.set(match)
    return match
}

exports.countDown = function (interaction) {
    for (let i = 0; i <= 5; i++) {
        setTimeout(async function () {
            postMessage(interaction.client, interaction.channel.id, {
                content: String((i == 5 ? "GO!" : (5 - i)))
            })
        }, 3000 + i * 1000)
    }
}

exports.setupEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    let tourney_name = ""
    if (match_data.tourney == "practice") {
        "`Practice Mode`"
    } else if (match_data.tourney) {
        tourney_name = `\`${match_tourney.name}\``
    }

    let round_desc = ""
    if (match_data.tourney !== "practice" && match_data.tourney && match_data.bracket) {
        round_desc = `${match_tourney?.stages[match_data.bracket].bracket} ${match_tourney?.stages[match_data.bracket].round}`
    }

    const matchMaker = new EmbedBuilder()
        .setTitle("Match Setup")
        .setDescription(
            `🏆 Tournament: ${tourney_name}` +
            (round_desc ? `\n⭕ Bracket/Round: ${round_desc}` : '') +
            `\n📜 Ruleset: ${(match_data.ruleset ? "`" + match_rules?.general?.name + "`" : '')}` +
            `\n👥 Players: ${(match_data.players ? Object.values(match_data.players).map(id => `<@${id}> `) : '')}` +
            `\n🎙️ Commentators/Trackers: ${(match_data.commentators ? Object.values(match_data.commentators).map(id => `<@${id}> `) : '')}` +
            `\n📺 Stream: ${match_data.stream}`
        )
        .setColor("#3BA55D")

    return matchMaker
}

exports.setupComponents = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
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
        default: match_data.tourney == 'practice'
    })
    Object.keys(db.ty.tournaments).sort((a, b) => db.ty.tournaments[b].startdate - db.ty.tournaments[a].startdate).forEach(key => {
        tourney_selector.addOptions(
            {
                label: db.ty.tournaments[key]?.name,
                value: key,
                emoji: { name: "🏆" },
                default: key == match_data.tourney
            }
        )
    })
    let components = []
    components.push(tourneyRow)
    if (match_data.tourney) {
        if (match_data.tourney == "practice") {
            function getName(ruleset) {
                return ruleset.general?.name ?? ruleset.name
            }
            let rulesets = Object.keys(db.ty.rulesets.saved).sort((a, b) => getName(db.ty.rulesets.saved[a]).localeCompare(getName(db.ty.rulesets.saved[b])))
            rulesets.forEach(key => {
                let ruleset = db.ty.rulesets.saved[key]
                ruleset_selector.addOptions(
                    {
                        label: ruleset.general?.name ?? ruleset.name,
                        value: String(key),
                        description: " " + (ruleset.general?.description ?? ruleset.description).slice(0, 99),
                        default: key == match_data.ruleset
                    }
                )
            })
            components.push(rulesetRow)
        } else {
            let stages = Object.keys(db.ty.tournaments[match_data.tourney].stages)
            stages.forEach(key => {
                let bracket = db.ty.tournaments[match_data.tourney].stages[key]
                bracket_selector.addOptions(
                    {
                        label: bracket.bracket + " " + (bracket.round ?? "") + " - " + db.ty.rulesets.saved[bracket.ruleset].general.name,
                        value: key,
                        default: key == match_data.bracket
                    }
                )
            })
            components.push(bracketRow)
        }
    }
    let playable = false, joinable_player = false, joinable_commentator = false
    if (match_data.ruleset !== "" && match_data.players && match_data.commentators && Object.values(match_data.players).length == 2) {
        playable = true
    }
    if (!match_data.players || Object.values(match_data.players).length < 2) {
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

exports.firstEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const embed = new EmbedBuilder()
        .setAuthor({ name: "First Track" })
        .setTitle("How would you like to determine the first track?")
        .setColor(blurple_color)
        .setDescription(`*If players do not agree on a method, the default option will be used.*` +
            `\n${match_data.firstvote ? Object.keys(match_data.firstvote).map(key => `<@${key}> voted for **${methods[match_data.firstvote[key]]}**`).join("\n") : ''
            }`)
    return embed
}


exports.firstComponents = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    const FirstVote = new ActionRowBuilder()
    const FirstPlay = new ActionRowBuilder()
    const first_vote_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_first_vote')
        .setPlaceholder("Select Options")
        .setMinValues(1)
        .setMaxValues(1)
        .setOptions(exports.getFirstOptions({ interaction }))
    FirstVote.addComponents(first_vote_selector)
    FirstPlay.addComponents(
        new ButtonBuilder()
            .setCustomId("tourney_play_first_start")
            .setLabel((match_data.firstmethod ? methods[match_data.firstmethod] : methods[match_rules.general.firsttrack.primary] + " (Default)"))
            .setStyle(ButtonStyle.Primary)
            .setDisabled([undefined, null].includes(match_data.firstvote) || Object.keys(match_data.firstvote).length < 2)
    )
    return [FirstVote, FirstPlay]
}

exports.colorEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const embed = new EmbedBuilder()
        .setAuthor({ name: `First Track: ${methods[match_data.firstmethod]}` })
        .setTitle("Pick a color")
    let desc = "" + (match_data.firstcolors ? Object.keys(match_data.firstcolors).map(key => ":" + match_data.firstcolors[key] + "_square: - <@" + key + ">").join("\n") : '')
    if (desc) {
        embed.setDescription(desc)
    }
    return embed
}

exports.firstbanEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const embed = new EmbedBuilder()
        .setAuthor({ name: "First Track: " + methods[match_data.firstmethod] })
    let desc = "" + ([undefined, null].includes(match_data.firstbans) ? "" :
        Object.keys(match_data.firstbans).map(key =>
            `<@${match_data.firstbans[key].player}> banned **` +
            (trackgroups[match_data.firstbans[key].ban] ? trackgroups[match_data.firstbans[key].ban].name : getTrackName(match_data.firstbans[key].ban)) + "**"
        ).join("\n"))
    if (desc) {
        embed.setDescription(desc)
    }
    return embed
}

exports.getLeaderboard = function ({ track, conditions, podbans } = {}) {
    let leaderboard = []
    Object.values(db.ty.matches).forEach(match => {
        let ruleset = db.ty.rulesets.saved[match.ruleset]
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

exports.raceEmbed = function ({ race, interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const race_data = match_data.races[race]
    let events = Object.values(race_data.events)
    let conditions = exports.getConditions(match_rules, race_data, race)
    let track = exports.getTrack(race_data)
    let podbans = race_data.events ? Object.values(race_data.events).filter(e => e.event == 'tempban' && e.type == 'racer').map(e => e.selection).flat().map(s => String(s)) : []
    let forces = events.filter(event => event.event == 'override' && event.type == 'condition').map(event => capitalize(condition_names[event.selection]))
    let players = Object.values(match_data.players)

    if (events.map(e => e.repeat).includes(true)) {
        forces.push('Runback')
    }
    if (race_data.gents?.agreed) {
        forces.push("🎩 Gentleman's Agreement")
    }
    let conmap = Object.values(conditions).filter(c => !['um', 'fp', 'tt'].includes(c)).map(con => "`" + condition_names[con] + "`").join(" ")

    //set up embed
    const embed = new EmbedBuilder()
        .setTitle(getTrackName(track) + (forces.length ? ` (${forces.join(", ")})` : ""))
        .setThumbnail(tracks[track].preview)
        .setDescription(conmap + ([null, undefined, ""].includes(race_data.gents) ? "" : "\n🎩 " + race_data.gents.terms))

    function resultFormat(run, winner, leaderboard) {
        if (!run || !run.time) {
            return ''
        }
        return [(run.pod == "" ? '❔' : racers[run.pod].flag),
        (String(run.time).toLowerCase() == 'dnf' ? 'DNF' : (winner ? "__" : "") + time_fix(run.time) + (winner ? "__" : "")),
        (leaderboard ? ` - ${exports.getUsername({ member: run.player, db, short: true })}` : ''),
        ([null, undefined, 0].includes(run.deaths) ? '' : "`" + `💀×${run.deaths == "" ? "?" : Number(run.deaths)}` + "`"),
        (run.notes == "" || leaderboard ? "" : "\n📝 " + run.notes), (run.trecord ? '`Tourney Record`' : run.record ? '`Best Available Pod`' : '')].filter(f => f !== "").join(" ")
    }

    //leaderboard
    const leaderboard = exports.getLeaderboard({ track, conditions, podbans }).filter(r => r.record || r.trecord || players.includes(r.player))
    embed.addFields({ name: 'Best Times', value: leaderboard.map(r => resultFormat(r, false, true)).join("\n"), inline: false })

    //setup
    if (Object.values(race_data.ready).filter(r => r == false).length > 0 || race_data.countdown) {
        embed
            .setAuthor({ name: `Race ${(race + 1)} - Setup` })
            .setColor("#FAA81A")
            .setDescription(
                conmap +
                (race_data.gents ? "\n🎩 " + race_data.gents.terms : "") +
                (race_data.live ? "" : "\n" + (race_data.countdown ? "\nCountdown starts <t:" + race_data.countdown + ":R>" : "Countdown starts when both players have readied.")))

        Object.values(match_data.players).map(player => embed.addFields({
            name: exports.getUsername({ member: player, db }),
            value: ([undefined, null, ""].includes(race_data.runs[player].pod) ? ":red_circle: Racer not selected" : ":green_circle: Racer selected " +
                (race_data.reveal[player] ? "\n**" + racers[race_data.runs[player].pod].flag + " " + racers[Number(race_data.runs[player].pod)].name + "**" : "(hidden)")) + "\n" +
                (race_data.countdown ? "" : (race_data.ready[player] ? ":green_circle: Ready" : ":red_circle: Not Ready")),
            inline: true
        }
        ))

        if (forces.includes("No Upgrades")) {
            embed.addFields({ name: "🕹️ Players", value: ":orange_circle: Don't forget to show your parts to verify upgrades", inline: false })
        }
        if (forces.includes("Fastest Lap")) {
            embed.addFields({ name: "🕹️ Players", value: ":orange_circle: Don't forget to delete your `tgdf.dat` file or set your laps to 4", inline: false })
        }

        //in progress
    } else if (race_data.live) {
        embed
            .setAuthor({ name: "Race " + (race + 1) + " - In Progress" })
            .setColor("#DD2E44")
        Object.values(match_data.players).map(player => embed.addFields({
            name: exports.getUsername({ member: player, db }),
            value: race_data.runs[player].time == "" ? ":red_circle: Awaiting submission" : ":green_circle: Results Submitted\n||" + resultFormat(race_data.runs[player], false) + "||",
            inline: true
        }))
        if (Object.values(race_data.runs).map(run => run.time).filter(time => time == "").length == 0) {
            embed.addFields({ name: "🎙️ Commentators/Trackers", value: ":red_circle: Awaiting Verification", inline: false })
        }

        //completed
    } else {
        embed
            .setAuthor({ name: "Race " + (race + 1) + " - Results" })
            .setColor("#2D7D46")
        if (![null, undefined, ""].includes(race_data.runs) && Object.values(race_data.runs).map(run => run.time).filter(time => time == "").length == 0) {
            let winner = exports.getWinner({ race, interaction })
            Object.values(match_data.players).map(player => embed.addFields({
                name: exports.getUsername({ member: player, db }) + (player == winner ? " 👑" : ""),
                value: resultFormat(race_data.runs[player], winner == player),
                inline: true
            }
            ))
            embed.setTitle(getTrackName(track) + (forces.length ? ` (${forces.join(", ")})` : "") + ` \n${(exports.getUsername({ member: winner, db, short: true }))} Wins!`)
        }
    }


    return embed
}

exports.matchSummaryEmbed = function ({ interaction } = {}) {

    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    //match_data = tourney_live_data[interaction.channel_id]
    let summary = {}
    Object.values(match_data.players).forEach(player => {
        summary[player] = {
            wins: 0,
            forcepoints: match_rules.match.forcepoints.start,
            runbacks: match_rules.match.repeattrack.limit,
            deaths: 0,
            deathtrue: true,
            time: 0,
            timetrue: true
        }
    })
    Object.values(match_data.races).forEach((race, index) => {
        if (!race.live) {
            if (exports.getWinner({ race: index, interaction })) {
                summary[exports.getWinner({ race: index, interaction })].wins++
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
        .setDescription('First to ' + match_rules.general.winlimit + ' wins.')
        .setTitle(
            leader.player == "tie" ?
                "Tied Match " + leader.wins + " to " + leader.wins :
                exports.getUsername({ member: leader.player, db, short: true }) + " " + (leader.wins == match_rules.general.winlimit ? "wins" : "leads") + " " + leader.wins + " to " + summary[exports.getOpponent({ interaction, player: leader.player })].wins + (leader.wins == match_rules.general.winlimit - 1 ? " (Match Point)" : ""))
    Object.values(match_data.players).forEach(player => embed.addFields({
        name: exports.getUsername({ member: player, db }),
        value: [
            "👑" + summary[player].wins, '💠' + summary[player].forcepoints,
            (match_rules.match.repeattrack ? '🔁' + summary[player].runbacks : "")
        ].filter(a => a !== '').map(a => '`' + a + '`').join(" ") + '\n`⏱️' + time_fix(summary[player].time) + (summary[player].timetrue ? "" : "+") + '`' +
            ' `💀' + summary[player].deaths + (summary[player].deathtrue ? "" : "+") + '`',
        inline: true
    }))
    embed.addFields({ name: "🎙️ Commentators/Trackers", value: ":orange_circle: Don't forget to update the score!", inline: false })
    return embed
}

exports.raceEventEmbed = function ({ race, interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    let races = Object.values(match_data.races)
    let events = races[race].events
    let eventstart = match_data.races[race].eventstart
    let ruleevents = Object.values(match_rules.race)
    let player = (ruleevents[eventstart].choice == "lastwinner" ? exports.getWinner({ race: race - 1, interaction }) : exports.getOpponent({ interaction, player: exports.getWinner({ race: race - 1, interaction }) }))
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
            `<@${e.player}> ${actions[e.event]} a ${e.type}: **` +
            (e.type == "track" ?
                getTrackName(e.selection) + (e.repeat ? " (🔁Runback)" : "") :
                e.type == "racer" ? getRacerName(e.selection) :
                    condition_names[e.selection]) + "**" + ([null, undefined, "", 0].includes(e.cost) ? "" : " for " + e.cost + "💠 forcepoint" + (e.cost == 1 ? "" : "s"))
        ).join("\n"))
    if (desc) {
        embed.setDescription(desc)
    }


    let summary = {}
    Object.values(match_data.players).forEach(player => {
        summary[player] = {
            wins: 0
        }
    })
    Object.values(match_data.races).forEach((race, index) => {
        if (index + 1 < Object.values(match_data.races).length) {
            summary[exports.getWinner({ race: index, interaction })].wins++
        }
    })
    if (exports.getForcePoints({ player, interaction }) > 0 && summary[exports.getOpponent({ interaction, player })].wins == match_rules.general.winlimit - 1) {
        embed.setFooter({ text: "Last chance to use " + exports.getForcePoints({ player, interaction }) + " 💠 forcepoint" + (exports.getForcePoints({ player, interaction }) !== 1 ? "s" : "") + " and " + exports.getRunbacks({ player, interaction }) + " 🔁 runback" + (exports.getRunbacks({ player, interaction }) !== 1 ? "s" : "") })
    } else {
        embed.setFooter({ text: "You have " + exports.getForcePoints({ player, interaction }) + " 💠 forcepoint" + (exports.getForcePoints({ player, interaction }) !== 1 ? "s" : "") + " and " + exports.getRunbacks({ player, interaction }) + " 🔁 runback" + (exports.getRunbacks({ player, interaction }) !== 1 ? "s" : "") + " remaining" })
    }

    return embed
}

exports.adminEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Match Manager' })
        .setTitle((match_data.tourney == "practice" ? "`Practice Mode`" : db.ty.tournaments[match_data?.tourney]?.nickname) + ": " + db.ty.tournaments[match_data.tourney]?.stages[match_data.bracket]?.bracket + " " + db.ty.tournaments[match_data.tourney]?.stages[match_data.bracket]?.round + " - " + (match_data.players ? Object.values(match_data.players).map(p => exports.getUsername({ member: p, db, short: true })).join(" vs ") : ""))
        .setDescription("This menu is for resetting the match to a previous point in the event of an error. Please make a selection.\nCurrent Race: `" + match_data.current_race + "`\nCurrent Stage: `" + match_data.status + "`")
    return embed
}

exports.adminComponents = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    let options = []
    if (match_data.current_race == 0) {
        options.push(
            {
                label: "Reset to First Options",
                value: "first",
                description: "Completely reset the match to determining the first track"
            }
        )
    }
    if (match_data.current_race == 1 && Object.values(match_rules.match.permabans).length > 0) {
        options.push(
            {
                label: "Reset to Permabans",
                value: "permaban",
                description: "Reset to determining permanent bans"
            }
        )
    }
    if (match_data.current_race !== 0) {
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
    if (['prerace', 'midrace'].includes(match_data.status)) {
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

exports.raceEventComponents = function ({ race, interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    let components = []
    const event_start = match_data.races[race].eventstart
    const event_end = match_data.races[race].eventend
    let events = Object.values(match_rules.race)
    let fptotal = 0

    const last_winner = exports.getWinner({ race: race - 1, interaction })
    const last_loser = exports.getOpponent({ interaction, player: last_winner })

    const chosing_player = (events[event_start].choice == "lastwinner" ? last_winner : last_loser)
    let notrack = false
    let track = null
    let racer_ban = false
    let racer_force = false
    let oddselect = false
    let repeat = false
    let upg = 5

    //construct components
    for (let i = event_start; i <= event_end && i < events.length; i++) {
        let event = events[i]
        let options = []
        let default_stuff = []
        //get defaults
        interaction.message.components.filter(component => component.components[0].data.type == 3).forEach(component => {
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

        if (event.count && default_stuff.length % event.count !== 0) {
            oddselect = true
        }

        if ([null, undefined, ""].includes(event.cost) || exports.getForcePoints({ player: chosing_player, interaction }) >= event.cost) {
            if (![null, undefined, ""].includes(event.cost)) {
                fptotal += (default_stuff.length / event.count) * event.cost
            }
            if (event.type == "racer") {

                if (event.event == 'tempban' && event.cost && default_stuff.length) {
                    racer_ban = true
                }

                let permabanned_racers = Object.values(match_data.races[1].events).filter(event => event.event == "permaban" && event.type == "racer").map(event => Number(event.selection))
                let tempbanned_racers = Object.values(match_data.races[race].events).filter(event => event.event == "tempban" && event.type == "racer").map(event => Number(event.selection))
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
                let permabanned_tracks = Object.values(match_data.races[1].events).filter(event => event.event == "permaban" && event.type == "track").map(event => Number(event.selection))
                let tempbanned_tracks = Object.values(match_data.races[race].events).filter(event => event.event == "tempban" && event.type == "track").map(event => Number(event.selection))
                let already_played = {}
                Object.values(match_data.races).forEach((race, index) => {
                    Object.values(race.events).forEach(event => {
                        if (event.event == 'selection' && event.type == 'track') {
                            if (already_played[event.selection]) {
                                already_played[event.selection].played++
                                already_played[event.selection].loser = exports.getOpponent({ interaction, player: exports.getWinner({ race: index, interaction }) })
                            } else {
                                already_played[event.selection] = { played: 1, loser: exports.getOpponent({ interaction, player: exports.getWinner({ race: index, interaction }) }) }
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
                } else {
                    track = default_stuff[0]?.replace("ban", "")
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
                    } else if (event.event !== 'selection' && already_played[i] && saltmap[match_rules.match.repeattrack.condition] <= already_played[i].played && already_played[i].loser == exports.getOpponent({ interaction, player: chosing_player }) && exports.getRunbacks({ player: exports.getOpponent({ interaction, player: chosing_player }), interaction }) > 0) { //not selecting the track but opponent could still runback
                        option.description = "Already played but your opponent could run it back"
                        options.push(option)
                    } else if (event.event == 'selection' && already_played[i] && saltmap[match_rules.match.repeattrack.condition] <= already_played[i].played && already_played[i].loser == chosing_player && exports.getRunbacks({ player: chosing_player, interaction }) > 0) { //selecting the track and it can be runback
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
            } else if (event.type == 'racerpick') {
                if (event.cost && default_stuff.length) {
                    racer_force = true
                }
                options = []
                Object.values(event.options).forEach(option => {
                    if (option == 'favorite_2024') {

                        if (![null, undefined, ""].includes(track)) {
                            let track_favorite = tracks[track].favorite
                            let option = exports.getRacerOption(track_favorite)
                            option.label += " (Track Favorite)"
                            option.description = "Players must play this pod"
                            option.default = default_stuff.includes(String(track_favorite))
                            options.push(option)
                            if (["0", "20"].includes(track)) {
                                let alt_option = exports.getRacerOption(0)
                                alt_option.description = "Players must play this pod"
                                alt_option.label += " (Track Favorite Alt)"
                                alt_option.default = default_stuff.includes("0")
                                options.push(alt_option)
                            }
                        } else {

                            options.push({
                                label: "Track Favorite",
                                description: "Players must play this pod",
                                value: "fav",
                                default: default_stuff.includes("fav")
                            })

                        }
                    }
                })
            }
            let component = {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "tourney_play_race" + race + "_event" + i,
                        options: options,
                        placeholder: capitalize([event.event.replace("selection", "select"), event.type.replace("racerpick", "racer pick")].join(" ")) + ([null, undefined, ""].includes(event.cost) ? "" : " (" + (event.cost == 0 ? "free" : event.cost + "💠/" + (event.count == 1 ? event.type : event.count + " " + event.type + "s")) + ")") + (oddselect ? " (select in sets of " + event.count : ""),
                        min_values: [undefined, null, ""].includes(event.count) ? 1 : 0,
                        max_values: [undefined, null, ""].includes(event.count) ? 1 : [undefined, null, ""].includes(event.limit) ? options.length : event.limit == 0 ? options.length : event.count * event.limit
                    }
                ]
            }
            components.push(component)
        }
    }

    components.push(
        {
            type: 1,
            components: [
                {
                    type: 2,
                    label: notrack ? "No Track Selected" : (exports.getForcePoints({ player: chosing_player, interaction }) - fptotal < 0) ? "Not enough forcepoints" : oddselect ? "Too many or too few selections" : "Submit" + (fptotal == 0 ? "" : " (" + fptotal + "💠)") + (repeat ? " (🔁)" : ""),
                    style: 1,
                    custom_id: "tourney_play_race" + race + "_event_submit",
                    disabled: (exports.getForcePoints({ player: chosing_player, interaction }) - fptotal < 0) || notrack || oddselect || (racer_force && racer_ban)
                },
            ]
        }
    )

    return components
}

exports.permabanEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    let races = Object.values(match_data.races)
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

exports.raceComponents = function ({ race, interaction }) {

    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    let events = Object.values(match_data.races[race].events)
    let podbans = []
    let podoptions = []
    let upg = 5
    events.forEach(event => {
        if (Object.values(match_rules.general.default).includes('nu') || (event.event == 'override' && event.type == 'condition' && event.selection == 'nu')) {
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
    if (match_data.races[race].gents?.agreed == "?") {
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
    if (!match_data.races[race].live) {
        if (match_data.races[race].countdown) {
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
                        .setLabel(Object.values(match_data.races[race].ready).filter(v => v === false).length == 1 ? "Start Countdown" : "Ready")
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
        if (match_rules.general.gents) {
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
        if (Object.values(match_data.races[race].runs).map(run => run.time).filter(time => time !== "").length == 0) {
            ButtonRow
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("tourney_play_race" + race + "_restart")
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("Restart")
                )
        } else if (Object.values(match_data.races[race].runs).map(run => run.time).filter(time => time == "").length == 0) {
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

exports.firstbanComponents = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const FirstBan = new ActionRowBuilder()
    let circuitoptions = [undefined, null].includes(match_data.firstbans) ? Object.values(match_rules.general.firsttrack.options) : Object.values(match_rules.general.firsttrack.options).filter(option => !Object.values(match_data.firstbans).map(ban => ban.ban).includes(option))
    let planetoptions = [undefined, null].includes(match_data.firstbans) ? ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"] : ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"].filter(option => !Object.values(match_data.firstbans).map(ban => ban.ban).includes(option))
    let trackoptions = []
    circuitoptions.forEach(circuit => {
        tracks.forEach((track, index) => {
            if (track.circuit == trackgroups[circuit].code) {
                trackoptions.push(index)
            }
        })
    })
    trackoptions = [undefined, null].includes(match_data.firstbans) ? trackoptions : trackoptions.filter(option => !Object.values(match_data.firstbans).map(ban => Number(ban.ban)).includes(option) && planetoptions.map(option => trackgroups[option].code).includes(Number(tracks[option].planet)))
    let selectoptions = []
    if (match_data.firstmethod == "poe_c" && circuitoptions.length > 1) {
        selectoptions = circuitoptions.map(option => { return ({ label: trackgroups[option].name, value: String(option), description: trackgroups[option].count + " tracks" }) })
    } else if (match_data.firstmethod == "poe_p" && planetoptions.length > 1) {
        selectoptions = planetoptions.map(option => { return ({ label: trackgroups[option].name, value: String(option), description: trackgroups[option].count + " tracks" }) })
    } else {
        selectoptions = trackoptions.map(option => exports.getTrackOption(option))
    }
    const first_ban_selector = new StringSelectMenuBuilder()
        .setCustomId("tourney_play_first_" + (match_data.firstmethod.includes("poe") ? "ban" : "pick"))
        .setPlaceholder("Select Option")
        .setMinValues(1)
        .setMaxValues(1)
        .setOptions(selectoptions)
    FirstBan.addComponents(first_ban_selector)
    return [FirstBan]
}

exports.permabanComponents = function ({ permaban, interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    let pban = match_rules.match.permabans[permaban]
    //match_data = tourney_live_data[interaction.channel_id]
    let selectoptions = []
    if (pban.type == "track") {
        let permatrackbans = Object.values(match_data.races[1].events).filter(event => event.event == "permaban").filter(event => event.type == "track").map(event => Number(event.selection))
        for (let i = 0; i < 25; i++) {
            if (!permatrackbans.includes(i)) {
                selectoptions.push(
                    exports.getTrackOption(i)
                )
            }
        }
    } else if (pban.type == "racer") {
        let permaracerbans = Object.values(match_data.races[1].events).filter(event => event.event == "permaban").filter(event => event.type == "track").map(event => event.selection)
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

exports.rulesetOverview = function ({ interaction }) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    let fields = []
    if (match_rules.general && match_rules.general.type == "1v1") {
        let genfield = { name: "General", value: "", inline: false }
        genfield.value = "👑 First to **" + match_rules.general.winlimit + " Wins**" + "\n" +
            "* **⚙️ Default Conditions**: " + Object.values(match_rules.general.default).map(con => "`" + condition_names[con] + "`").join(", ") + "\n" +
            "* **🎩 Gentleman's Agreement** is " + (match_rules.general.gents == true ? "" : "*not* ") + "permitted" + "\n" +
            "* **⭐ Elo Rating** is " + (match_rules.general.ranked == true ? "" : "*not* ") + "affected" + "\n" +
            "* **1️⃣ First Track** can be " + (Object.values(match_rules.general.firsttrack.options).length == 4 ? "any track" : "a track from " + Object.values(match_rules.general.firsttrack.options).map(circuit => "`" + circuit.toUpperCase() + "` ")) + "\n" +
            "* **1️⃣ First Track** will be selected by " + methods[match_rules.general.firsttrack.primary] + "\n" +
            ([undefined, null].includes(match_rules.general.firsttrack.secondary) ? "" : " * ◉ Alternatively, players may agree to select the **1️⃣ First Track** by " + Object.values(match_rules.general.firsttrack.secondary).map(method => "`" + methods[method] + "` "))

        let matchfield = { name: "Every Match", value: "", inline: false }
        matchfield.value = (match_rules.match.forcepoints.start > 0 && "* 👥 Both players start with `" + match_rules.match.forcepoints.start + "` **💠 Force Points** (`" + match_rules.match.forcepoints.max + " max`)" + "\n") +
            (match_rules.match.permabans && Object.values(match_rules.match.permabans).map(ban => `* ${choices[ban.choice]} **🚫 Permanently Bans** ${ban.limit} ${ban.type} (\`${(ban.cost == 0 ? "free" : ban.cost + "💠")}\`)\n`).join("")) +
            (match_rules.match.repeattrack && (`* 👥 Both players can use \`${match_rules.match.repeattrack.limit}\` ${match_rules.match.repeattrack.condition} **🔁 Runback** ${(match_rules.match.repeattrack.style == "soft" ? "(\`resets to default conditions, " : "(\`must be same conditions, ") + (match_rules.match.repeattrack.cost == 0 ? "free" : match_rules.match.repeattrack.cost + "💠")}\`)`))

        let racefield = { name: "Every Race", value: "", inline: false }
        racefield.value = Object.values(match_rules.race).map(
            race => `* ${choices[race.choice]} **${events[race.event]}** ` +
                ([undefined, null].includes(race.limit) || race.limit == 1 ? "a " :
                    (race.limit == 0 ? "any number of " : "up to `" + race.limit + "` ")) +
                race.type +
                (race.limit == 0 ? "s" : "") +
                ([undefined, null].includes(race.cost) ? "" : " (`" + (race.cost == 0 ? "free" : race.cost + "💠/" + (race.count == 1 ? "" : race.count + " ") + race.type) + "`)") +
                ([null, undefined, ""].includes(race.options) ? "" : " from the following options: " + Object.values(race.options).map(option => "`" + condition_names[option] + "`").join(", ")) + "\n"
        ).join("")
        fields.push(genfield, matchfield, racefield)
    }
    return fields
}

exports.getUsername = function ({ member, short } = {}) {
    let name = "N/A"
    Object.values(db.user).forEach(user => {
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

exports.getFirstOptions = function ({ interaction }) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    let firstoptions = [
        {
            label: "Already Decided",
            description: "Both players have already agreed to the starting track",
            value: "already"
        },
        {
            label: firsts[match_rules?.general?.firsttrack?.primary]?.label + " (Default)",
            value: match_rules?.general?.firsttrack?.primary,
            description: firsts[match_rules?.general?.firsttrack?.primary]?.description
        }
    ]
    if (!match_rules?.general?.firsttrack?.secondary) {
        Object.values(match_rules.general.firsttrack.secondary).forEach(first => firstoptions.push(
            {
                label: firsts[first].label,
                description: firsts[first].description,
                value: first
            }
        ))
    }
    return (firstoptions)
}

exports.getOpponent = function ({ interaction, player } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    let opponent = Object.values(match_data.players).filter(p => p != player)
    return opponent[0]
}

exports.getWinner = function ({ race, interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    let winner = null
    if (!match_data) {
        return null
    }
    let players = match_data.players ? Object.values(match_data.players) : []
    if (match_data.races[race].runs[players[0]].time.toLowerCase() == "dnf") {
        winner = players[1]
    } else if (match_data.races[race].runs[players[1]].time.toLowerCase() == "dnf") {
        winner = players[0]
    } else if (Number(match_data.races[race].runs[players[0]].time) < Number(match_data.races[race].runs[players[1]].time)) {
        winner = players[0]
    } else if (Number(match_data.races[race].runs[players[1]].time) < Number(match_data.races[race].runs[players[0]].time)) {
        winner = players[1]
    }
    return winner
}

exports.getForcePoints = function ({ player, interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]


    let forcepoints = Number(match_rules.match.forcepoints.start)
    let races = Object.values(match_data.races)
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

exports.getRunbacks = function ({ player, interaction }) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    //match_data = tourney_live_data[interaction.channel_id]
    let runbacks = match_rules.match.repeattrack.limit
    Object.values(match_data.races).forEach((race) => {
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

exports.matchMakerEmbed = function ({ interaction }) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]

    const matchmaker = new EmbedBuilder()
        .setAuthor({ name: match_data.tourney == "practice" ? "`Practice Mode`" : match_tourney.name })
        .setTitle((match_data.tourney == "practice" ? "" : match_tourney.stages[match_data.bracket].bracket + " " + match_tourney.stages[match_data.bracket].round) + " - " + Object.values(match_data.players).map(player => exports.getUsername({ member: player, db })).join(" vs "))
        .setDescription("📜 " + match_rules.general.name + "\n" +
            "🎙️ " + ([null, undefined, ""].includes(match_data.commentators) ? "" : Object.values(match_data.commentators).map(id => `<@${id}> `)) + "\n" +
            "📺 " + match_data.stream
        )
        .setColor("#3BA55D")
    Object.keys(match_data.players).forEach(p => {
        matchmaker.addFields({
            name: (db.user[p].country ? ":flag_" + db.user[p].country + ": " : "") + db.user[p].name + (db.user[p].pronouns ? " (" + exports.joinPronouns(db.user[p].pronouns) + ")" : ""),
            value: (db.user[p].platform ? "`" + db.user[p].platform + "`" : "No platform set") + " - " + (db.user[p].input ? "`" + db.user[p].input + "`" : 'No input set') + "\n" + ("*" + db.user[p].bio + "*" ?? "")
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
        .addFields({ name: "🕹️ Player Responsibilities", value: "* Verify all pods/tracks/upgrades are unlocked\n* Check that stream is running smoothly\n* Disable game music\n* Limit stream quality to 720p\n* Wait until the results screen to report your times\n* Be attentive to this chat", inline: false })
        .addFields({ name: "🎙️ Commentator Responsibilities", value: "* Use SG interface to conduct a sound check!\n* Enable all voice related settings in Discord including Krisp noise supression, advanced voice activity, etc.\n*  Open stream on Twitch to respond to chat\n* Verify race results/update score\n* Sync streams (avoid decreasing delay mid-race)", inline: false })
    return reminder
}

exports.rulesetOverviewEmbed = function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    const ruleset = new EmbedBuilder()
        .setAuthor({ name: "Ruleset Overview" })
        .setTitle("📜 " + match_rules?.general?.name)
        .setDescription(match_rules?.general?.description)
        .addFields(exports.rulesetOverview({ interaction }))
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