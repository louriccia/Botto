const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ActionRow, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { methods, trackgroups, firsts, condition_names, choices, events } = require('./data.js')

const { planets } = require('../../data/sw_racer/planet.js')
const { circuits } = require('../../data/sw_racer/circuit.js')
const { difficulties } = require('../../data/difficulty.js')

const { capitalize, time_fix, getTrackName, getRacerName, truncateString, getTrackById, getRacerById } = require('../../generic.js')
const { postMessage } = require('../../discord.js');
const { avgSpeed, upgradeCooling, upgradeTopSpeed } = require('../../data/sw_racer/part.js');
const { blurple_color, ping_color } = require('../../colors.js');
const axios = require('../../axios.js');
const { racerSelector } = require('../challenge/functions.js');
const { verifyBeforeUpdateEmail } = require('firebase/auth');


const STATE_SCHEDULED = 0
const STATE_MATCH_SETUP = 1;
const STATE_PRE_RACE = 2;
const STATE_WARMUP = 3;
const STATE_IN_RACE = 4;
const STATE_POST_RACE = 5;
const STATE_POST_MATCH = 6;
const STATE_CANCELLED = 99;

const STATE_NAMES = {
    [STATE_SCHEDULED]: 'Scheduled',
    [STATE_MATCH_SETUP]: 'Match Setup',
    [STATE_PRE_RACE]: 'Pre-Race',
    [STATE_WARMUP]: 'Warmup',
    [STATE_IN_RACE]: 'In-Race',
    [STATE_POST_RACE]: 'Post-Race',
    [STATE_POST_MATCH]: 'Post-Match',
    [STATE_CANCELLED]: 'Cancelled'
}

exports.initializeMatch = async function ({ interaction, memberId } = {}) {
    const res = await axios.post('/matches', {
        channelId: interaction.channel.id,
        userId: memberId,
    }, {
        headers: {
            'x-user-id': memberId,
        }
    })
    if (res.status !== 200) {
        interaction.reply({ content: res.data.error, ephemeral: true })
        return
    }
    match = res.data.match
    return match
}

exports.getMatchStatus = function ({ match } = {}) {
    return STATE_NAMES[match.status]
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

exports.matchTitle = function ({ match } = {}) {
    if (!match) {
        return 'No Match'
    }
    let tourney = ['practice', ''].includes(match.tourney) ? 'Practice Mode' : match.tourney?.name
    let players = match.players?.length ? match.players.map(player => `<@${player.discordId}>`).join(", ") : "No players"
    return `${tourney} - ${players}`
}

exports.matchDescription = function ({ match } = {}) {
    if (!match) {
        return 'No Match'
    }

    if (match.tourney == "practice") {
        return `Practice Mode`
    }

    let description = ""

    if (match.phaseId) {
        const phase = match.tournament.phases.find(phase => phase.id == match.phaseId)
        description += `${phase.name}`

        if (match.divisionId) {
            const division = phase.divisions.find(division => division.id == match.divisionId)
            description += ` - ${division.name}`

            if (match.roundId) {
                const round = division.rounds.find(round => round.id == match.roundId)
                description += ` - ${round.name}`
            }
        }
    }

    return description
}

exports.setupMatchEmbed = function ({ match } = {}) {
    const matchTourney = match.tournament
    const matchRules = match.ruleset

    let tourney_name = match.tournament?.name || "Practice Mode"
    let stream = match.stream

    let round_desc = ""
    if (match.tourney !== "practice" && match.tourney && match.bracket) {
        round_desc = `${matchTourney?.stages[match.bracket].bracket} ${matchTourney?.stages[match.bracket].round}`
    }

    const matchMaker = new EmbedBuilder()
        .setTitle("Match Setup")
        .setDescription(
            [
                `🏆 ${tourney_name}`,
                exports.matchDescription({ match }),
                `📜 ${(matchRules?.name ?? 'No ruleset selected')}`,
                `👥 ${match.players?.map(player => `<@${player.discordId}>`).join(", ")}`,
                `🎙️ ${match.commentators?.map(commentator => `<@${commentator.discordId}>`).join(", ")}`,
                stream ? `📺 Stream: ${match.stream}` : ''
            ].join("\n")
        )
        .setColor("#3BA55D")

    return matchMaker
}

exports.eventDescriptor = function ({ event, present = false } = {}) {
    const actionDescriptions = {
        permaBan: present ? "🚫 perma-bans" : "🚫 perma-banned",
        tempBan: present ? "❌ temp-bans" : "❌ temp-banned",
        selection: present ? "👆 selects" : "👆 selected",
        override: present ? "✳️ overrides" : "✳️ overrode",
        poll: present ? "📊 polls" : "📊 polled",
        choice: present ? "🗳️ chooses" : "🗳️ chose",
        poolPick: present ? "🗳️ picks" : "🗳️ picked",
        clearPoolPick: present ? "🗳️ clears" : "🗳️ cleared",
        chanceCube: present ? "🎲 rolls" : "🎲 rolled",
    }

    const choiceDescriptions = {
        'raceLoser': "Loser of Last Race",
        'raceWinner': 'Winner of Last Race',
        'cubeWinner': "Chance Cube Winner",
        'cubeLoser': "Chance Cube Loser",
        'randomPlayer': "Random Player",
        'player': "Any Player",
        'seedWinner': "Higher Ranked Player",
        'seedLoser': "Lower Ranked Player",
        'system': "Botto",
        'systemRandom': "Botto randomly",
        'systemNext': "Botto"
    }

    const selectionDescriptions = {
        'track': getTrackName(event.selection),
        'racer': getRacerName(event.selection),
        'condition': condition_names[event.selection]
    }


    const eventPlayer = event.event == 'chanceCube' ? '<@545798436105224203>' : event.player?.id ? `<@${event.player.id}>` : choiceDescriptions[event.choice]
    const eventAction = actionDescriptions[event.event] || event.event
    const eventSelection = selectionDescriptions[event.type] || event.selection
    const eventCost = event.cost ? " for " + event.cost + "💠 forcepoint" + (event.cost == 1 ? "" : "s") : ""

    const eventDescription = `${eventPlayer} ${eventAction} a ${event.type}${present ? '' : `: ** ${eventSelection}**`}${eventCost}`

    if (['chanceCube', 'poll'].includes(event.event)) {
        const pollDesc = exports.pollDescription({ event })
        return pollDesc ? `${pollDesc}\n${eventDescription}` : eventDescription
    }

    return eventDescription
}

exports.pollDescription = function ({ event } = {}) {
    const pollDescription = event.votes?.map(vote => (`*<@${vote.player.discordId}> voted for ${vote.selection.join(", ")}*`)).join("\n")
    return pollDescription
}

exports.preRaceContent = function ({ match } = {}) {
    const race = match.races[match.currentRace]
    if (race.activeEvents.length) {
        return race.activeEvents[0].choice == 'player' ?
            match.players.map(player => `<@${player.discordId}>`).join(", ") :
            `<@${race.activeEvents[0].user.discordId}>`
    }

    return ""
}

exports.preRaceEmbed = function ({ match } = {}) {
    const race = match.races[match.currentRace]

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Race " + (match.currentRace + 1) + " - Event Phase" })
        .setColor(ping_color)

    //event log
    let desc = race.events.map(event => (exports.eventDescriptor({ event }))).join("\n")

    race.activeEvents.forEach(event => {
        if (['chanceCube', 'poll'].includes(event.event) && event.votes?.length) {
            desc += "\n" + exports.pollDescription({ event })
        }
    })

    if (race.eventQueue?.length) {
        desc += "\n\n-# Next Up:\n-# "
        desc += exports.eventDescriptor({ event: race.eventQueue[0], present: true })
    }

    if (desc) {
        embed.setDescription(desc)
    }

    return embed
}

exports.getConditionOption = function (condition, selected) {
    let conditions = {
        nu: { name: 'No Upgrades', desc: "Players must race with stock parts" },
        sk: { name: 'Skips', desc: "Players can use skips (excluding AI and bounce skips)" },
        fl: { name: 'Fastest Lap', desc: "winner is determined by fastest lap time of 3 laps" }
    }

    return (
        {
            label: conditions[condition].name,
            description: conditions[condition].desc,
            value: condition,
            default: selected
        }
    )

}

exports.getColorOption = function (option, selected) {

    const colorMap = {
        red: { name: 'Red', emoji: '🟥' },
        blue: { name: 'Blue', emoji: '🟦' },
    }

    return (
        {
            label: colorMap[option].name,
            value: option,
            emoji: { name: colorMap[option].emoji },
            default: selected
        }
    )
}

exports.eventSelector = function ({ event } = {}) {
    const eventRow = new ActionRowBuilder()

    let eventQty = (event.count == 1 ? event.type : `${event.count} ${event.type}s`)
    console.log(event)
    let placeholder = event.name || capitalize(
        [
            event.event,
            event.type,
            (event.cost ? `(${event.cost}💠/${eventQty})` : "")
        ].join(" "))

    const event_selector = new StringSelectMenuBuilder()
        .setCustomId(`tourney_play_submitEvent_${event.id}`)
        .setPlaceholder(placeholder)
        .setMinValues(event.count || !event.optional ? 1 : 0)
        .setMaxValues([undefined, null, ""].includes(event.count) ? 1 : [undefined, null, ""].includes(event.limit) ? options.length : event.limit == 0 ? options.length : event.count * event.limit)

    eventRow.addComponents(event_selector)

    event.options.forEach(option => {

        switch (event.type) { //TODO: Refactor this event.selected crap
            case "color":
                event_selector.addOptions(exports.getColorOption(option, event.selection?.includes(option)))
                break
            case "racer":
                event_selector.addOptions(exports.getRacerOption(option, event.selection?.includes(option)))
                break
            case "track":
                event_selector.addOptions(exports.getTrackOption(option, event.selection?.includes(option)))
                break
            case "condition":
                event_selector.addOptions(exports.getConditionOption(option, event.selection?.includes(option)))
                break
            case "racerpick":
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
                        if (default_stuff.filter(d => podbans.includes(d)).length) {
                            bad_racer_override = true
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
                break
        }
    })

    return eventRow
}

exports.scheduledMatchEmbed = function ({ match } = {}) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: `Match Setup` })
        .setColor(ping_color)
        .setDescription("Setup match")

    return embed
}

exports.scheduledMatchComponents = function ({ match } = {}) {
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setup")
                .setLabel("Set Up Match")
                .setStyle(ButtonStyle.Primary)
        )
    return [buttonRow]
}

exports.preRaceComponents = function ({ match } = {}) {
    let components = []
    const race = match.races[match.currentRace]
    const events = race.activeEvents

    //get event components
    events.forEach(event => {
        const eventRow = exports.eventSelector({ event })
        components.push(eventRow)
    })

    //button row
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_nextEvents")
                .setLabel("Submit Event") //label: notrack ? "No Track Selected" : (exports.getForcePoints({ player: chosing_player, interaction }) - fptotal < 0) ? "Not enough forcepoints" : oddselect ? "Too many or too few selections" : "Submit" + (fptotal == 0 ? "" : " (" + fptotal + "💠)") + (repeat ? " (🔁)" : ""),
                .setStyle(ButtonStyle.Primary)
            //.setDisabled(events.filter(event => event.selection?.length || event.optional).length == 0)
        )
    components.push(buttonRow)
    //disabled: (exports.getForcePoints({ player: chosing_player, interaction }) - fptotal < 0) || notrack || oddselect || (racer_force && racer_ban) || bad_racer_override

    return components
}

exports.tourneySelector = function ({ tournaments, selected } = {}) {
    const tourneyRow = new ActionRowBuilder()
    const tourney_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setTournament')
        .setPlaceholder("Select Tournament")
        .setMinValues(1)
        .setMaxValues(1)
    tourneyRow.addComponents(tourney_selector)
    tourney_selector.addOptions({
        label: "Practice Mode",
        value: "practice",
        emoji: { name: "🚩" },
        default: selected.includes('practice')
    })
    tournaments.sort((a, b) => b.startDate - a.startDate).forEach(tournament => {
        tourney_selector.addOptions(
            {
                label: tournament.name,
                value: tournament.id,
                emoji: { name: "🏆" },
                default: selected.includes(tournament.id)
            }
        )
    })

    return tourneyRow
}

exports.matchSelector = function ({ matches, selected } = {}) {
    const matchRow = new ActionRowBuilder()
    const match_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play')
        .setPlaceholder("Select Match")
        .setMinValues(1)
        .setMaxValues(1)

    matchRow.addComponents(match_selector)

    match_selector.addOptions({
        label: "New Match",
        value: "new",
        default: selected.includes('new')
    })

    matches.sort((a, b) => b.startDate - a.startDate).slice(0, 24).forEach(match => {
        const matchPlayers = match.players?.length ? match.players.map(player => `${player.username}`).join(", ") : "No Players"
        const matchDescription = exports.matchDescription({ match })
        const matchTourney = match.tournament?.name || "Practice Mode"

        match_selector.addOptions(
            {
                label: `${matchPlayers} - Race ${match.currentRace + 1} - ${STATE_NAMES[match.status]}`,
                description: `${matchTourney + (matchDescription ? ` - ${matchDescription}` : "")}`,
                value: match.id,
                default: selected.includes(match.id)
            }
        )
    })

    return matchRow
}

exports.rulesetSelector = function ({ rulesets, selected } = {}) {
    const rulesetRow = new ActionRowBuilder()
    const ruleset_selector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setRuleset')
        .setPlaceholder("Select Ruleset")
        .setMinValues(1)
        .setMaxValues(1)

    rulesets
        .filter(ruleset => ruleset.status == 'active')
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(ruleset => {
            ruleset_selector.addOptions(
                {
                    label: ruleset.name,
                    value: ruleset.id,
                    description: " " + (ruleset.description).slice(0, 99),
                    default: selected.includes(ruleset.id)
                }
            )
        })

    rulesetRow.addComponents(ruleset_selector)

    return rulesetRow
}

exports.tourneyPhaseSelector = function ({ phases, selected } = {}) {
    const phaseRow = new ActionRowBuilder()

    const phaseSelector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setPhase')
        .setPlaceholder("Select Phase")
        .setMinValues(1)
        .setMaxValues(1)

    phaseRow.addComponents(phaseSelector)

    phases.forEach(phase => {
        phaseSelector.addOptions(
            {
                label: phase.name,
                value: phase.id,
                default: selected.includes(phase.id)
            }
        )
    })

    return phaseRow
}

exports.tourneyDivisionSelector = function ({ divisions, selected } = {}) {
    const divisionRow = new ActionRowBuilder()

    const divisionSelector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setDivision')
        .setPlaceholder("Select Division")
        .setMinValues(1)
        .setMaxValues(1)

    divisionRow.addComponents(divisionSelector)

    divisions.forEach(division => {
        divisionSelector.addOptions(
            {
                label: division.name,
                value: division.id,
                default: selected.includes(division.id)
            }
        )
    })

    return divisionRow
}

exports.tourneyRoundSelector = function ({ rounds, selected } = {}) {
    const roundRow = new ActionRowBuilder()

    const roundSelector = new StringSelectMenuBuilder()
        .setCustomId('tourney_play_setRound')
        .setPlaceholder("Select Round")
        .setMinValues(1)
        .setMaxValues(1)

    roundRow.addComponents(roundSelector)

    rounds.forEach(round => {
        roundSelector.addOptions(
            {
                label: round.name,
                value: round.id,
                default: selected.includes(round.id)
            }
        )
    })

    return roundRow
}

exports.setupMatchComponents = function ({ match, tournaments, rulesets } = {}) {

    let components = []

    const tourneyRow = exports.tourneySelector({ tournaments, selected: match.tournament?.id ? [match.tournament.id] : [] })
    components.push(tourneyRow)

    console.log(match)

    if (match.tournament == "practice") {
        const rulesetRow = exports.rulesetSelector({ rulesets, selected: [match.ruleset?.id] })
        components.push(rulesetRow)
    } else if (match.tournament?.phases) {
        const phaseRow = exports.tourneyPhaseSelector({ phases: match.tournament.phases, selected: [match.phaseId] })
        components.push(phaseRow)

        if (match.phaseId) {
            const phase = match.tournament.phases.find(phase => phase.id == match.phaseId)
            const divisionRow = exports.tourneyDivisionSelector({ divisions: phase.divisions, selected: [match.divisionId] })
            components.push(divisionRow)

            if (match.divisionId) {
                const division = phase.divisions.find(division => division.id == match.divisionId)
                const roundRow = exports.tourneyRoundSelector({ rounds: division.rounds, selected: [match.roundId] })
                components.push(roundRow)
            }
        }
    }

    let playable = false, joinable_player = false, joinable_commentator = false

    if (match.ruleset !== "" && match.players && match.commentators && match.players.length == 2) {
        playable = true
    }

    if (!match.players || match.players.length < 2) {
        joinable_player = true
    }

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setupJoin")
                .setLabel("Join as Player")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🕹️')
                .setDisabled(!joinable_player)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setupCommentate")
                .setLabel("Join as Commentator/Tracker")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎙️')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setupStart")
                .setLabel("Start Match")
                .setStyle(ButtonStyle.Success)
                .setDisabled(!playable)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setupLeave")
                .setLabel("Leave Match")
                .setStyle(ButtonStyle.Danger)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setupCancel")
                .setLabel("Cancel Match")
                .setStyle(ButtonStyle.Danger)
        )

    components.push(buttonRow)

    return components
}

exports.getLeaderboard = function ({ track, conditions, podbans, pod_override } = {}) {
    let leaderboard = []
    Object.values(db.ty.matches).forEach(match => {
        let ruleset = db.ty.rulesets.saved[match.ruleset]
        if (match.races && ruleset.general.type !== 'Qualifier' && match.tourney !== "practice") {

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
    leaderboard = leaderboard.filter(r => !r.podban && (!pod_override || pod_override == r.pod))
    if (leaderboard.length) {
        leaderboard[0].record = true
    }

    leaderboard.forEach(r => {
        if (!unique.map(u => u.player).includes(r.player)) {
            unique.push(r)
        }
    })
    return unique
}

exports.resultFormat = function (run, winner, leaderboard) {
    if (!run || !run.time) {
        return ''
    }
    return [(run.pod == "" ? '❔' : racers[run.pod].flag),
    (String(run.time).toLowerCase() == 'dnf' ? 'DNF' : (winner ? "__" : "") + time_fix(run.time) + (winner ? "__" : "")),
    (leaderboard ? ` - ${exports.getUsername({ member: run.player, db, short: true })}` : ''),
    ([null, undefined, 0].includes(run.deaths) ? '' : "`" + `💀×${run.deaths == "" ? "?" : Number(run.deaths)}` + "`"),
    (run.notes == "" || leaderboard ? "" : "\n📝 " + run.notes), (run.trecord ? '`Tourney Record`' : (run.record ? '`Best Available Pod`' : ''))].filter(f => f !== "").join(" ")
}

exports.playerWarmupStatus = function (playerStatus) {
    const greenCircle = ":green_circle:"
    const redCircle = ":red_circle:"

    if (!playerStatus) {
        return `${redCircle} Not Ready`
    }

    const racerStatus = playerStatus.selectedRacer ? (playerStatus.racerShown ? getRacerName(racers[Number(playerStatus.selectedRacer)]) : `${greenCircle} Racer Selected (hidden)`) : `${redCircle} Racer Not Selected`
    const readyStatus = playerStatus.isReady ? `${greenCircle} Ready` : `${redCircle} Not Ready`

    return `${racerStatus}\n${readyStatus}`
}

exports.warmupEmbed = function ({ match } = {}) {

    const race = match.races[match.currentRace]
    const countdownStatus = race.raceStart ? `Race begins <t:${race.raceSTart}:R>` : "Countdown starts when both players have readied."

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Race ${(match.currentRace + 1)} - Warmup` })
        .setColor(ping_color)
        .setDescription(countdownStatus)

    Object.values(match.players).map(player => embed.addFields({
        name: player.username,
        value: exports.playerWarmupStatus(race.players[player.id]),
        inline: true
    }))

    // if (forces.includes("No Upgrades")) {
    //     embed.addFields({ name: "🕹️ Players", value: ":orange_circle: Don't forget to show your parts to verify upgrades", inline: false })
    // }
    // if (forces.includes("Fastest Lap")) {
    //     embed.addFields({ name: "🕹️ Players", value: ":orange_circle: Don't forget to delete your `tgdf.dat` file or set your laps to 4", inline: false })
    // }

    return embed
}

exports.inRaceEmbed = function ({ match } = {}) {
    const matchRules = match.ruleset
    const race = match.races[match.currentRace]
    const events = race.events
    const conditions = 'conditions' // exports.getConditions(matchRules, race, race)
    //let pod_override = events.find(event => event.event == 'override' && event.type == 'racerpick')?.selection
    //let podbans = race.events ? Object.values(race.events).filter(e => e.event == 'tempban' && e.type == 'racer').map(e => e.selection).flat().map(s => String(s)) : []
    //let forces = events.filter(event => event.event == 'override' && event.type == 'condition').map(event => capitalize(condition_names[event.selection]))

    // if (events.map(e => e.repeat).includes(true)) {
    //     forces.push('Runback')
    // }

    // if (race.gents?.agreed) {
    //     forces.push("🎩 Gentleman's Agreement")
    // }

    // let conmap = Object.values(conditions).filter(c => !['um', 'fp', 'tt'].includes(c)).map(con => "`" + condition_names[con] + "`").join(" ")
    // let banmap = podbans.map(ban => getRacerName(ban)).join(", ")

    //set up embed
    console.log('race', race)
    const trackId = race.track
    const track = getTrackById(trackId)
    const embed = new EmbedBuilder()
        .setTitle(getTrackName(trackId))  //+ (pod_override ? ` as ${getRacerName(pod_override)}` : "") + (forces.length ? ` (${forces.join(", ")})` : "")
        .setThumbnail(track?.preview)
        //.setDescription(conmap + (banmap && !pod_override ? `\n❌${banmap}\n` : '') + ([null, undefined, ""].includes(race.gents) ? "" : "\n🎩 " + race.gents.terms))
        .setDescription("description")


    // get leaderboard

    // if (leaderboard.length) {
    //     embed.addFields({ name: 'Best Times', value: leaderboard.map(r => resultFormat(r, false, true)).join("\n"), inline: false })
    // }

    embed
        .setAuthor({ name: "Race " + (match.currentRace + 1) + " - In Progress" })
        .setColor("#DD2E44")
    Object.values(match.players).map(player => embed.addFields({
        name: player.username,
        value: "race status", //race.runs[player].time == "" ? ":red_circle: Awaiting submission" : ":green_circle: Results Submitted\n||" + resultFormat(race.runs[player], false) + "||"
        inline: true
    }))
    // if (Object.values(race.runs).map(run => run.time).filter(time => time == "").length == 0) {
    //     embed.addFields({ name: "🎙️ Commentators/Trackers", value: ":red_circle: Awaiting Verification", inline: false })
    // }

    return embed
}

exports.postRaceEmbed = function ({ match } = {}) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: "Race " + (match.currentRace + 1) + " - Post Race" })
        .setColor("#2D7D46")
    let winner = ""// exports.getWinner({ race, interaction })
    Object.values(match.players).map(player => embed.addFields({
        name: `${player.username}`(player.id == winner ? " 👑" : ""),
        value: 'value', // resultFormat(race.runs[player], winner == player),
        inline: true
    }
    ))
    embed.setTitle('track') //getTrackName(track) + (forces.length ? ` (${forces.join(", ")})` : "") + ` \n${(exports.getUsername({ member: winner, db, short: true }))} Wins!`)

    return embed
}

exports.postRaceComponents = function ({ match } = {}) {
    const ButtonRow = ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`tourney_play_submitRun`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Submit Results")
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_verifyResults")
                .setLabel("Verify")
                .setStyle(ButtonStyle.Secondary)
        )

    return [ButtonRow]
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



exports.adminEmbed = function ({ match } = {}) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Match Manager' })
        .setColor(blurple_color)
        .setTitle(exports.matchTitle({ match }))
        .setDescription("This menu is for resetting the match to a previous point in the event of an error. Please make a selection.\nCurrent Race: `" + match?.currentRace + "`\nCurrent Stage: `" + match?.status + "`")
    return embed
}

exports.adminComponents = function ({ match } = {}) {
    let options = []
    if (match.current_race == 0) {
        options.push(
            {
                label: "Reset to First Options",
                value: "first",
                description: "Completely reset the match to determining the first track"
            }
        )
    }
    if (match.current_race !== 0) {
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
    if (['prerace', 'midrace'].includes(match.status)) {
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


exports.warmupComponents = function ({ match }) {
    const racerRow = racerSelector(
        {
            customid: 'tourney_play_selectRacer',
            placeholder: "Select your racer",
            min: 1,
            max: 1
        })
    const race = match.races[match.currentRace]

    //gents prompt
    const ButtonRow = new ActionRowBuilder()
    if (race.gents?.agreed == "?") {
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
    if (race.countdown) {
        ButtonRow
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_revealRacer")
                    .setLabel("Reveal Racer Choice")
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_abortCountdown")
                    .setLabel("Abort Countdown")
                    .setStyle(ButtonStyle.Danger)
            )
    } else {
        ButtonRow
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_markReady")
                    .setLabel("Ready") //Object.values(match.races[race].ready).filter(v => v === false).length == 1 ? "Start Countdown" :
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_markUnready")
                    .setLabel("Not Ready")
                    .setStyle(ButtonStyle.Danger)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_revealRacer")
                    .setLabel("Reveal Racer Choice")
                    .setStyle(ButtonStyle.Secondary)
            )
    }
    if (match.ruleset.gentlemensAgreement) {
        ButtonRow.addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_race" + race + "_gents")
                .setEmoji("🎩")
                .setStyle(ButtonStyle.Secondary)
        )
    }
    // if (race.racer_override) {
    //     return [buttonRow]
    // }

    return [...racerRow, ButtonRow]
}

exports.verifyModal = function ({ match }) {
    const race = match.races[match.currentRace]

    const verifyModal = new ModalBuilder()
        .setCustomId("tourney_play_verify")
        .setTitle(`Verify Race ${match.currentRace + 1} Results`)
    race.runs.forEach(run => {
        const timeInput = new TextInputBuilder()
            .setCustomId(`${run.player.id}_time`)
            .setLabel((`⏱️ ${run.player.username}'s Time`).substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("--:--.---")
            .setMinLength(1)
            .setMaxLength(10)
            .setRequired(true)
            .setValue(String(run.dnf ? "DNF" : time_fix(run.time)))
        const deathsInput = new TextInputBuilder()
            .setCustomId(`${run.player.id}_deaths`)
            .setLabel((`💀 ${run.player.username}'s Deaths`).substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setMinLength(0)
            .setMaxLength(10)
            .setRequired(false)

        if (![null, undefined, ''].includes(run.deaths)) {
            deathsInput.setValue(String(run.deaths))
        }

        const TimeRow = new ActionRowBuilder().addComponents(timeInput)
        const DeathRow = new ActionRowBuilder().addComponents(deathsInput)
        verifyModal.addComponents(TimeRow, DeathRow)
    })

    return verifyModal
}

exports.submitRunModal = function ({ currentRace, run = null }) {

    const submitModal = new ModalBuilder()
        .setCustomId("tourney_play_submitRun")
        .setTitle(`Submit Race ${currentRace} Results`)
    const Time = new TextInputBuilder()
        .setCustomId("time")
        .setLabel("⏱️ Time (write 'dnf' if forfeited)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(0)
        .setMaxLength(10)
        .setRequired(true)
    const Deaths = new TextInputBuilder()
        .setCustomId("deaths")
        .setLabel("💀 Deaths (leave blank if unsure)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(0)
        .setMaxLength(2)
        .setRequired(false)

    const Notes = new TextInputBuilder()
        .setCustomId("notes")
        .setLabel("📝 Notes")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false)

    if (run) {

        Time.setValue((String(run.time).toLowerCase() == 'dnf' ? 'DNF' : (run.time == "" ? "" : String(time_fix(run.time)))))
        Deaths.setValue(String(run.deaths))
        Notes.setValue(String(run.notes))
    }

    const ActionRow1 = new ActionRowBuilder().addComponents(Time)
    const ActionRow2 = new ActionRowBuilder().addComponents(Deaths)
    const ActionRow3 = new ActionRowBuilder().addComponents(Notes)
    submitModal.addComponents(ActionRow1, ActionRow2, ActionRow3)
    return submitModal
}

exports.inRaceComponents = function ({ match }) {
    const ButtonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`tourney_play_submitRun`)
                .setStyle(ButtonStyle.Primary)
                .setLabel("Submit Results")
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_restartRace")
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Restart")
        )
    return [ButtonRow]
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
            ([undefined, null].includes(match_rules.general.firsttrack.secondary) ? "" : " * Alternatively, players may agree to select the **1️⃣ First Track** by " + Object.values(match_rules.general.firsttrack.secondary).map(method => "`" + methods[method] + "` "))

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

exports.getTrackOption = function (i, selected) {
    const track = getTrackById(i)
    console.log('tarck', track)
    return (
        {
            label: track.name,
            value: String(i),
            description: [track.circuit.abbreviation + " - Race " + track.cirnum, track.planet.name, difficulties[track.difficulty].name, track.lengthclass].join(" | "),
            emoji: {
                name: track.planet.emoji.split(":")[1],
                id: track.planet.emoji.split(":")[2].replace(">", "")
            },
            default: selected
        }
    )
}

exports.getRacerOption = function (i, selected) {
    const racer = getRacerById(i)
    let muspeed = avgSpeed(upgradeTopSpeed(racer.max_speed, 5), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 5)).toFixed(0)
    let nuspeed = avgSpeed(upgradeTopSpeed(racer.max_speed, 0), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 0)).toFixed(0)
    return (
        {
            label: racer.name,
            value: String(i),
            description: 'Avg Speed ' + muspeed + ' (NU ' + nuspeed + "); Max Turn " + racer.max_turn_rate + "°/s",
            emoji: {
                name: racer.flag.split(":")[1],
                id: racer.flag.split(":")[2].replace(">", "")
            },
            default: selected
        }
    )
}

exports.getOpponent = function ({ interaction, player } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_tourney = db.ty.tournaments[match_data.tourney]
    let opponent = Object.values(match_data.players).filter(p => p != player)
    return opponent[0]
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
            value: (db.user[p].platform ? "`" + db.user[p].platform + "`" : "No platform set") + " - " + (db.user[p].input ? "`" + db.user[p].input + "`" : 'No input set') + "\n" + ("*" + truncateString(db.user[p].bio, 200) + "*" ?? "")
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