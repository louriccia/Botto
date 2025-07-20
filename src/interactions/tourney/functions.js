const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ActionRow, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { difficulties } = require('../../data/difficulty.js')

const { capitalize, time_fix, getTrackName, getRacerName, truncateString, getTrackById, getRacerById, getCircuitById, getPlanetById, getPlanetName, getCircuitName } = require('../../generic.js')
const { postMessage } = require('../../discord.js');
const { avgSpeed, upgradeCooling, upgradeTopSpeed } = require('../../data/sw_racer/part.js');
const { blurple_color, ping_color } = require('../../colors.js');
const { racerSelector } = require('../challenge/functions.js');
const axios = require('../../axios.js');

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

const conditionsMap = {
    nu: { name: 'No Upgrades', desc: "Players must race with stock parts" },
    sk: { name: 'Skips', desc: "Players can use skips (excluding AI and bounce skips)" },
    fl: { name: 'Fastest Lap', desc: "winner is determined by fastest lap time of 3 laps" }
}

const banStatusMap = {
    0: {
        name: "Not banned",
        emoji: ""
    },
    1: {
        name: "Temporarily banned and cannot be played this race",
        emoji: "❌"
    },
    2: {
        name: "Permanently banned and cannot be played all match",
        emoji: "🚫"
    },
}

const repeatStatusMap = {
    0: {
        name: "Repeatable",
        emoji: ""
    },
    1: {
        name: "Unrepeatable",
        emoji: "⭕"
    },
    2: {
        name: "Repeatable with condition",
        emoji: "*️⃣"
    }
}

//TODO: show who picked the current race
//TODO: fix leftover countdowns

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
    let tourney = ['practice', ''].includes(match.tournament) ? 'Practice Mode' : match.tournament?.name
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
    const matchRules = match.ruleset

    let tourney_name = match.tournament?.name || "Practice Mode"
    let stream = match.stream

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

exports.getPoolDescription = function (pool) {
    if (!pool) {
        return ""
    }
    const track = getTrackById(pool.track)

    const poolOption = exports.getPoolOption(pool, false)
    return track?.planet?.emoji + " " + poolOption.label + (poolOption.description ? ` (${poolOption.description})` : "")
}

exports.getEventCost = function (event) {
    if (!event || !event.cost || !event.selection?.length) {
        return 0
    }
    return (event.cost ?? 0) * (event.selection.length / (event.qty ?? 1))

}

exports.getForcePoints = function (match, discordId) {
    let startingPoints = match.ruleset?.forcePoints?.start ?? 0
    match.races?.events?.forEach(event => {
        if (event.user?.discordId == discordId) {
            startingPoints -= exports.getEventCost(event)
        }
    })
    return startingPoints
}

exports.getEventPlayer = function (event, present = false) {
    let choice = event.choice
    let inverted = false

    if (choice.startsWith('!')) {
        inverted = true
        choice = choice.substring(1)
    }

    const choiceDescriptions = {
        'raceLoser': "Loser of last race",
        'raceWinner': 'Winner of last race',
        'cubeWinner': "Chance cube winner",
        'cubeLoser': "Chance cube loser",
        'randomPlayer': "Random player",
        'player': present ? "Any player" : "Players",
        'seedWinner': "Higher ranked player",
        'seedLoser': "Lower ranked player",
        'system': "Botto",
        'systemRandom': "Botto randomly",
        'systemNext': "Botto",
        'selectedPlayer': "Selected player",
        'unselectedPlayer': "Unselected player",
    }

    // botto events
    if (event.choice.startsWith('system') || event.event == 'chanceCube') {
        return `<@545798436105224203>` // Botto's discord ID
    }

    // user has been assigned
    if (event.user) {
        return event.user.discordId ? `<@${event.user.discordId}>` : event.user.username
    }

    return (inverted ? "Opponent of " : "") + (choiceDescriptions[choice] || choice || "Unknown Player")
}

exports.eventDescriptor = function ({ event, present = false } = {}) {
    const actionDescriptions = {
        permaBan: present ? "🚫 perma-bans" : "🚫 perma-banned",
        tempBan: present ? "❌ temp-bans" : "❌ temp-banned",
        selection: present ? "👆 selects" : "👆 selected",
        override: present ? "✳️ overrides" : "✳️ overrode",
        poll: present ? "🗳️ votes for" : "🗳️ voted for",
        choice: present ? "🗳️ chooses" : "🗳️ chose",
        poolPick: present ? "🗳️ picks" : "🗳️ picked",
        clearPoolPick: present ? "🗳️ clears" : "🗳️ cleared",
        chanceCube: present ? "🎲 rolls" : "🎲 rolled",
    }

    const typeDescriptionMap = {
        'allyPool': " pick from their teammate's pool",
        'enemyPool': " pick from their opponent's pool",
        'winnerPool': " pick from the winner's pool",
        'loserPool': " pick from the loser's pool",
        'dynamicEvent': "n event",
        'event': "n event",
        'color': ' chance cube'
    }

    const selectionDescriptions = {
        'track': getTrackName(event.selection?.map(track => track.id)),
        'racer': getRacerName(event.selection?.map(racer => racer.id)),
        'planet': getPlanetName(event.selection?.map(planet => planet.id)),
        'circuit': getCircuitName(event.selection?.map(circuit => circuit.id)),
        'condition': event.selection?.map(selection => conditionsMap[selection.id]?.name).join(", "),
        'color': event.selection?.[0]?.id == 'red' ? "🟥 Red" : "🟦 Blue",
        'player': event.selection?.map(player => `${player.username}`).join(", "),
        'enemyPool': event.selection?.map(selection => exports.getPoolDescription(selection)).join(", "),
        'event': event.selection?.map(selection => selection.name || selection.id).join(", "),
    }

    const eventPlayer = exports.getEventPlayer(event, present)
    const eventAction = actionDescriptions[event.event] || event.event
    const eventSelection = selectionDescriptions[event.type] || event.selection
    const eventCost = exports.getEventCost(event)
    //const eventCostDescription = event.cost ? " for " + eventCost + "💠 forcepoint" + (eventCost == 1 ? "" : "s") : ""
    const eventCostDescription = event.cost ? ` (${eventCost}💠)` : ""
    const eventType = typeDescriptionMap[event.type] ?? ` ${event.type}`

    //const eventDescription = `${eventPlayer} ${eventAction} a${eventType}${present ? '' : `: ** ${eventSelection}**`}${eventCostDescription}`
    const eventDescription = `${eventPlayer} ${eventAction} ${present ? `a${eventType}` : `** ${eventSelection}**`}${eventCostDescription}`

    if (['chanceCube', 'poll'].includes(event.event) && !present) {
        const pollDesc = exports.pollDescription({ event })
        return pollDesc ? `${pollDesc}\n${eventDescription}` : eventDescription
    }

    return eventDescription
}

exports.pollDescription = function ({ event } = {}) {

    if (!event.votes || !event.votes.length) {
        return ""
    }

    const pollDescription = event.votes.map(vote => (
        `-# *<@${vote.player.discordId}> voted for ${vote.selection?.map(selection =>
            event.options?.find(option => option.id == selection.id)?.name || selection.id
        ).join(", ")}*`
    )).join("\n")
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

exports.getRaceDescription = function (race, defaultConditions) {
    const raceDescription = {
        title: "",
        description: ""
    }

    const trackId = race.track
    const conditionsTitle = exports.getConditionsDescription(race.conditions).string
    const podOverrideName = race.racer ? getRacerName(race.racer) : ""
    const podOverrideTitle = podOverrideName ? ` as ${podOverrideName}` : ""

    raceDescription.title = getTrackName(trackId) + conditionsTitle + podOverrideTitle

    const conditionsDescription = exports.getConditionsDescription({ ...defaultConditions, ...race.conditions }).list.map(item => `\`${item}\``).join(" ")

    raceDescription.description = `-# ${conditionsDescription}\n` + (race.racerBans?.length ? `❌${getRacerName(race.racerBans)}` : "")

    return raceDescription
}

exports.preRaceEmbed = function ({ match, summary, options } = {}) {
    const race = match.races[match.currentRace]
    let desc = ""

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Race " + (match.currentRace + 1) + " - Event Phase" })
        .setColor(ping_color)

    //get forcepoints for current player
    const currentPlayer = race.activeEvents[0]?.user?.id
    const currentPoints = summary?.players?.find(player => player.id == currentPlayer)?.forcePoints ?? 0
    if (currentPlayer) {
        embed
            .setFooter({ text: `💠 Force Points: ${currentPoints}` })
    }

    //event log
    let groupId = ""
    let eventLog = race.events.filter(event => ['chanceCube', 'poll'].includes(event.event) || event.selection?.length)

    // truncate first x events in event log before embed content becomes too lengthy
    const MAX_EVENT_LOG_LENGTH = 12
    if (eventLog.length > MAX_EVENT_LOG_LENGTH) {
        const eventLogSlice = eventLog.length - MAX_EVENT_LOG_LENGTH
        eventLog = eventLog.slice(eventLogSlice)
        desc += `[${eventLogSlice} earlier events](https://bottosjunkyard.com/matches/${match.id})\n`
    }

    // TODO: add ruleset defined playlist as events 

    eventLog.forEach((event, i) => {
        if (event.groupId != groupId) {
            groupId = event.groupId
            desc += `\n`
            if (event.groupId) {
                desc += `-# <@${event.owner.discordId}> added to their pool: \n`
            }
        }
        const indent = event.groupId ? "* " : ""
        desc += indent + exports.eventDescriptor({ event, present: false }) + "\n"
    })

    //poll description
    race.activeEvents.forEach(event => {
        if (['chanceCube', 'poll'].includes(event.event) && event.votes?.length) {
            desc += "\n" + exports.pollDescription({ event })
        }
    })

    //active events
    if (race.activeEvents.length) {
        desc += `\n\n-# Right now:\n${exports.eventDescriptor(
            {
                event: race.activeEvents[0],
                present: true
            })}${race.activeEvents.length > 1 ? ` and ${race.activeEvents.length - 1} more events` : ""}`
    }

    //up next
    desc += "\n\n-# Up next:\n-# "
    if (race.eventQueue?.length) {
        desc += exports.eventDescriptor({ event: race.eventQueue[0], present: true, options })
        if (race.eventQueue.length > 1) {
            desc += ` and ${race.eventQueue.length - 1}${[...race.activeEvents, ...race.eventQueue].some(event => ['dynamicEvent', 'event'].includes(event.type)) ? '+' : ''} more events`
        }
    } else {
        desc += "Warmup begins"
    }

    if (desc) {
        embed.setDescription(truncateString(desc, 4096))
    }

    return embed
}

exports.getConditionOption = function (option, selected) {

    const condition = option.id



    if (!conditionsMap[condition]) {
        throw new Error(`Unrecognized condition ${condition}`)
    }

    return (
        {
            label: conditionsMap[condition].name,
            description: conditionsMap[condition].desc,
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
            label: colorMap[option.id].name,
            value: option.id,
            emoji: { name: colorMap[option.id].emoji },
            default: selected
        }
    )
}

exports.getConditionsDescription = function (conditions) {
    if (!conditions) {
        return { string: "", list: [] }
    }
    let descriptionString = ""
    let descriptionList = []
    if (conditions.laps) {
        descriptionString += ` for ${conditions.laps} Laps`
        descriptionList.push(`${conditions.laps} Laps`)
    }
    if (conditions.skips?.includes('sk')) {
        descriptionString += ` with Skips`
        descriptionList.push(`Skips`)
    }
    if (conditions.upgrades?.includes("mu")) {
        descriptionString += ` with Upgrades`
        descriptionList.push(`Upgrades Allowed`)
    }
    if (conditions.upgrades?.includes("nu")) {
        descriptionString += ` with No Upgrades`
        descriptionList.push(`No Upgrades`)
    }
    if (conditions.mirrored) {
        descriptionString += ` Mirrored`
        descriptionList.push(`Mirrored`)
    }

    return { string: descriptionString, list: descriptionList }
}

exports.getPoolOption = function (option, selected) {
    const track = getTrackById(option.track)
    const racer = getRacerById(option.racer)

    if (!track) {
        return { label: "no track", value: "null" }
    }

    const poolOption = {
        label: `${track?.name}${this.getConditionsDescription(option.conditions).string}`,
        emoji: {
            name: track?.planet.emoji.split(":")[1],
            id: track?.planet.emoji.split(":")[2].replace(">", "")
        },
        value: option.id,
        default: selected
    }

    if (option.racer) {
        poolOption.label += ` as ${racer.name}`
    }

    poolOption.label = poolOption.label?.substring(0, 100)

    if (option.racerBans?.length) {
        poolOption.description = `Bans: ${option.racerBans.map(ban => getRacerById(ban).name).join(", ")}`
    }

    return poolOption
}

exports.getEventOption = function (option, selected) {
    const eventOption = {
        label: option.name || option.id,
        description: `${option.description || ""} (${option.events.length}${option.events.some(event => event.type == 'dynamicEvent') ? "+" : ""} events)`,
        value: option.id,
        default: selected
    }

    return eventOption
}

exports.eventSelector = function ({ event, options } = {}) {
    const eventRow = new ActionRowBuilder()
    const eventOptions = options?.[event.id]
    let eventQty = (event.qty == 1 ? event.type : `${event.qty} ${event.type}s`)
    let placeholder = event.name || capitalize(
        [
            event.event,
            event.type,
            (event.cost ? `(${event.cost}💠/${eventQty})` : "")
        ].join(" "))

    const event_selector = new StringSelectMenuBuilder()
        .setCustomId(`tourney_play_submitEvent_${event.id}`)
        .setPlaceholder(placeholder)
        .setMinValues(event.optional ? 0 : event.qty ?? 1)
        .setMaxValues(!event.qty ? 1 : event.max ?? Math.min(25, eventOptions?.length))

    eventRow.addComponents(event_selector)
    eventOptions.forEach(option => {
        const selected = event.selection?.some(selection => selection.id == option.id)
        switch (event.type) { //TODO: Refactor this event.selected crap
            case "color":
                event_selector.addOptions(exports.getColorOption(option, selected))
                break
            case "racer":
                event_selector.addOptions(exports.getRacerOption(option, selected))
                break
            case "track":
                event_selector.addOptions(exports.getTrackOption(option, selected))
                break
            case "circuit":
                event_selector.addOptions(exports.getCircuitOption(option, selected))
                break
            case "planet":
                event_selector.addOptions(exports.getPlanetOption(option, selected))
                break
            case "condition":
                event_selector.addOptions(exports.getConditionOption(option, selected))
                break
            case "player":
                event_selector.addOptions(exports.getPlayerOption(option, selected))
                break
            case "event":
                event_selector.addOptions(exports.getEventOption(option, selected))
                break
            case "allyPool":
            case "enemyPool":
            case "winnerPool":
            case "loserPool":
                event_selector.addOptions(exports.getPoolOption(option, selected))
                break
            default:
                event_selector.addOptions(
                    {
                        label: option.id,
                        value: option.id,
                        default: selected
                    }
                )
                break
        }
    })

    //overwrite description with ban / repeat status
    event_selector.options.forEach(option => {
        const matchingOption = eventOptions.find(o => o.id == option.data.value)
        if (matchingOption.banStatus) {
            option.data.description = banStatusMap[matchingOption.banStatus].name
            option.data.emoji = { name: banStatusMap[matchingOption.banStatus].emoji }
        } else if (matchingOption.repeatStatus) {
            option.data.description = repeatStatusMap[matchingOption.repeatStatus].name
            option.data.emoji = { name: repeatStatusMap[matchingOption.repeatStatus].emoji }
        }
    })

    //sort racers by avg speed
    if (event.type == 'racer') {
        event_selector.options.sort((a, b) => {
            const a_racer = getRacerById(a.data.value)
            const b_racer = getRacerById(b.data.value)
            const a_muspeed = avgSpeed(upgradeTopSpeed(a_racer.max_speed, 5), a_racer.boost_thrust, a_racer.heat_rate, upgradeCooling(a_racer.cool_rate, 5)).toFixed(0)
            const b_muspeed = avgSpeed(upgradeTopSpeed(b_racer.max_speed, 5), b_racer.boost_thrust, b_racer.heat_rate, upgradeCooling(b_racer.cool_rate, 5)).toFixed(0)
            return b_muspeed - a_muspeed
        })
    }
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

exports.preRaceComponents = function ({ match, activeEventCost, options } = {}) {
    let components = []
    const race = match.races[match.currentRace]
    const events = race.activeEvents

    //get event components
    events.forEach(event => {
        const eventRow = exports.eventSelector({ event, options })
        components.push(eventRow)
    })

    //button row
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_nextEvents")
                .setLabel(`Submit Event${events.length > 1 ? "s" : ""}${activeEventCost ? ` (${activeEventCost}💠)` : ''}`)
                .setStyle(ButtonStyle.Primary)
        )
    if (!(events.length == 1 && events[0].event == 'chanceCube')) {
        components.push(buttonRow)
    }

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

    matches.sort((a, b) => b.createdAt - a.createdAt).slice(0, 24).forEach(match => {
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

exports.playerWarmupStatus = function (playerStatus, hideReady = false) {
    const greenCircle = ":green_circle:"
    const redCircle = ":red_circle:"

    if (!playerStatus) {
        return `${redCircle} Not Ready`
    }

    const racerStatus = playerStatus.selectedRacer ? (playerStatus.racerShown ? getRacerName(playerStatus.selectedRacer) : `${greenCircle} Racer Selected (hidden)`) : `${redCircle} Racer Not Selected`
    const readyStatus = playerStatus.isReady ? `${greenCircle} Ready` : `${redCircle} Not Ready`

    if (hideReady) {
        return `${racerStatus}`
    }

    return `${racerStatus}\n${readyStatus}`
}

exports.warmupEmbed = function ({ match } = {}) {

    const race = match.races[match.currentRace]
    const track = getTrackById(race.track)
    const countdownStatus = race.raceStart ? `Race begins <t:${Math.round(race.raceStart / 1000)}:R>` : "Countdown starts when both players have readied."
    const raceDescription = exports.getRaceDescription(race, match.ruleset.defaultConditions)

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Race ${(match.currentRace + 1)} - Warmup` })
        .setTitle(raceDescription.title)
        .setColor(ping_color)
        .setDescription(`${raceDescription.description}\n\n${countdownStatus}\n`)
        .setThumbnail(track?.preview)


    Object.values(match.players).map(player => embed.addFields({
        name: player.username,
        value: exports.playerWarmupStatus(race.players[player.id], race.raceStart > 0),
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

exports.racePlayerStatus = function (player, runs, hidden = true) {
    const run = runs.find(run => run.player?.id == player?.id)
    if (!run) {
        return ":red_circle: Awaiting submission"
    }

    const hiddenTime = hidden ? " || " : ""
    const runRacer = getRacerById(run.racer)
    const runTime = `${run.racer ? runRacer.flag : ':stopwatch:'} ${run.dnf ? "DNF" : run.time ? time_fix(run.time) : ""} `
    const runDeaths = `${run.deaths === undefined ? '💀×?' : `💀×${run.deaths}`} `
    const runNotes = run.notes ? `📝 * ${run.notes}* ` : ""

    return ":green_circle: Results Submitted\n" + [runTime, runDeaths, runNotes].filter(i => i).map((thing, i) => `${i > 0 ? "-# " : ""}${hiddenTime}${thing}${hiddenTime} `).join("\n")
}

exports.inRaceEmbed = function ({ match } = {}) {
    const race = match.races[match.currentRace]
    const raceDescription = exports.getRaceDescription(race, match.ruleset.defaultConditions)
    const track = getTrackById(race.track)

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Race " + (match.currentRace + 1) + " - In Progress" })
        .setTitle(raceDescription.title)
        .setThumbnail(track?.preview)
        .setDescription(raceDescription.description)

    // get leaderboard

    embed
        .setColor("#DD2E44")
    Object.values(match.players).map(player => embed.addFields({
        name: player.username,
        value: exports.racePlayerStatus(player, race.runs), //
        inline: true
    }))

    return embed
}

exports.postRaceEmbed = function ({ match } = {}) {
    const race = match.races[match.currentRace]
    const track = getTrackById(race.track)
    const raceDescription = exports.getRaceDescription(race, match.ruleset.defaultConditions)

    const embed = new EmbedBuilder()
        .setAuthor({ name: "Race " + (match.currentRace + 1) + " - Post Race" })
        .setTitle(raceDescription.title)
        .setDescription(raceDescription.description)
        .setThumbnail(track?.preview)
        .setColor("#2D7D46")

    Object.values(match.players).map(player => embed.addFields({
        name: `${player.id == race.winner?.id ? "👑 " : ""}${player.username} `,
        value: exports.racePlayerStatus(player, race.runs, false), // resultFormat(race.runs[player], winner == player),
        inline: true
    }))

    if (match.status == STATE_POST_RACE) {
        embed.addFields({ name: "🎙️ Commentators/Trackers", value: ":red_circle: Awaiting Verification", inline: false })
    }

    return embed
}

exports.postRaceComponents = function ({ match } = {}) {
    const ButtonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`tourney_play_submitRun`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Submit Results")
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_verifyResults")
                .setLabel("Verify")
                .setStyle(ButtonStyle.Primary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_restartRace")
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Restart")
        )

    return [ButtonRow]
}

exports.postMatchEmbed = function ({ match } = {}) {
    const winEmbed = new EmbedBuilder()
        .setAuthor({ name: "Match Concluded" })
        .setTitle(`${match.winner.username} Wins!`)
        .setDescription("GGs, racers! The match has been saved.")
        .addFields({ name: ":microphone2: Commentators/Trackers", value: ":orange_circle: Don't forget to click 'Episode Finished' after the interviews" })

    return winEmbed
}

exports.matchSummaryEmbed = function ({ summary } = {}) {
    if (!summary) {
        return null
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Match Summary' })
        .setColor("#FFFFFF")
        .setDescription(`First to ${summary.winLimit} wins.`)
        .setTitle(
            summary.tied ? `Tied Match ${summary.players[0].wins} to ${summary.players[0].wins} ` :
                `${summary.players[0].username} ${(summary.status == STATE_POST_MATCH ? "wins" : "leads")} ${summary.players[0].wins} to ${summary.players[1].wins} ` +
                (summary.matchPoint ? " (Match Point)" : ""))

    summary.players.forEach((player, i) => {
        embed.addFields({
            name: player.username,
            value: [
                `👑 \`${player.wins}\` 💠\`${player.forcePoints}\``,
                `⏱️ \`${time_fix(player.time) + (player.trueTime ? "" : "+")}\``,
                `💀 \`${player.deaths + (player.trueDeaths ? "" : "+")}\``
            ].join("\n"),
            inline: true
        })
    })

    if (summary.status !== STATE_POST_MATCH) {
        embed.addFields({
            name: "🎙️ Commentators/Trackers",
            value: ":orange_circle: Don't forget to update the score!",
            inline: false
        })
    } else {
        embed.addFields({
            name: "🎙️ Commentators/Trackers",
            value: ":orange_circle: Don't forget to close the match!",
            inline: false
        })
    }

    return embed
}



exports.adminEmbed = function ({ match } = {}) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Match Manager' })
        .setColor(blurple_color)
        .setDescription(exports.matchTitle({ match }) + "\nThis menu allows admins and commentators to manage the match while it is in progress. Please make a selection.\nCurrent Race: `" + match?.currentRace + "`\nCurrent Stage: `" + match?.status + "`")
        .setFooter({ text: `id: ${match.id}` })
    return embed
}

exports.rewindComponents = function ({ match } = {}) {
    const rewindSelector = new StringSelectMenuBuilder()
        .setCustomId(`tourney_play_rewindMatch`)
        .setPlaceholder("Rewind the match")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            {
                label: `Race ${match.currentRace + 1} Events`,
                value: 'events',
                description: `Rewinds the match to start of current race events`
            },
            {
                label: `Race ${match.currentRace + 1} Pre-Race`,
                value: 'race',
                description: `Rewinds the match to warmup for current race`
            },
            {
                label: `Last Race`,
                value: 'lastRace',
                description: `Rewinds the match to the end of race ${match.currentRace}`
            },
            {
                label: `Start of Match`,
                value: 'match',
                description: `Rewinds the match to the very beginning of the match`
            }
        )

    const rewindRow = new ActionRowBuilder().addComponents(rewindSelector)

    return [rewindRow]
}

exports.adminComponents = function () {
    const ButtonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_setupCommentate")
                .setLabel("Join as Commentator/Tracker")
                .setStyle(ButtonStyle.Success)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_rewindMatch")
                .setLabel("Rewind Match")
                .setStyle(ButtonStyle.Secondary)
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_bindMatch")
                .setLabel("Change Match")
                .setStyle(ButtonStyle.Secondary)
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


    return [ButtonRow]
}


exports.warmupComponents = function ({ match }) {
    const race = match.races[match.currentRace]
    const racerBans = race.racerBans

    const racerRow = racerSelector(
        {
            customid: 'tourney_play_selectRacer',
            placeholder: "Select your racer",
            min: 1,
            max: 1
        })

    racerRow[0].components[0].options.forEach(option => {
        if (racerBans.includes(option.data.value)) {
            option.data.description = banStatusMap[1].name
            option.data.emoji = { name: banStatusMap[1].emoji }
        }
    })

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
    if (race.raceStart) {
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
    // if (match.ruleset.gentlemensAgreement) {
    //     ButtonRow.addComponents(
    //         new ButtonBuilder()
    //             .setCustomId("tourney_play_race" + race + "_gents")
    //             .setEmoji("🎩")
    //             .setStyle(ButtonStyle.Secondary)
    //     )
    // }
    // if (race.racer_override) {
    //     return [buttonRow]
    // }

    return [...racerRow, ButtonRow]
}

exports.verifyModal = function ({ match }) {
    const race = match.races[match.currentRace]

    const verifyModal = new ModalBuilder()
        .setCustomId("tourney_play_verifyResults")
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
        .setTitle(`Submit Race ${currentRace + 1} Results`)
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

exports.getTrackOption = function (option, selected) {
    const track = getTrackById(option.id)
    return (
        {
            label: track.name,
            value: option.id,
            description: [track.circuit.abbreviation + " - Race " + track.cirnum, track.planet.name, difficulties[track.difficulty].name, track.lengthclass].join(" | "),
            emoji: {
                name: track.planet.emoji.split(":")[1],
                id: track.planet.emoji.split(":")[2].replace(">", "")
            },
            default: selected
        }
    )
}

exports.getPlanetOption = function (option, selected) {
    const planet = getPlanetById(option.id)
    return (
        {
            label: planet.name,
            value: option.id,
            description: `${planet.tracks.length} Tracks | Hosted by ${planet.host}`,
            emoji: {
                name: planet.emoji.split(":")[1],
                id: planet.emoji.split(":")[2].replace(">", "")
            },
            default: selected
        }
    )
}

exports.getCircuitOption = function (option, selected) {
    const circuit = getCircuitById(option.id)
    return (
        {
            label: circuit.name,
            value: option.id,
            description: `${circuit.abbreviation} | ${circuit.tracks.length} Tracks`,
            default: selected
        }
    )
}

exports.getPlayerOption = function (option, selected) {
    return (
        {
            label: option.username,
            value: option.id,
            default: selected
        }
    )
}

exports.getRacerOption = function (option, selected) {
    const racer = getRacerById(option.id)
    let muspeed = avgSpeed(upgradeTopSpeed(racer.max_speed, 5), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 5)).toFixed(0)
    let nuspeed = avgSpeed(upgradeTopSpeed(racer.max_speed, 0), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 0)).toFixed(0)
    return (
        {
            label: racer.name,
            value: String(option.id),
            description: 'Avg Speed ' + muspeed + ' (NU ' + nuspeed + "); Max Turn " + racer.max_turn_rate + "°/s",
            emoji: {
                name: racer.flag.split(":")[1],
                id: racer.flag.split(":")[2].replace(">", "")
            },
            default: selected
        }
    )
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