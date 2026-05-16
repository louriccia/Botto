const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, ActionRow, ModalBuilder, TextInputBuilder, TextInputStyle, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, LabelBuilder, CheckboxBuilder, MessageFlags } = require('discord.js');
const { racers } = require('../../data/sw_racer/racer.js');

const colorToInt = (hex) => typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16)

const { difficulties } = require('../../data/difficulty.js')

const { capitalize, time_fix, getTrackName, getRacerName, truncateString, getTrackById, getRacerById, getCircuitById, getPlanetById, getPlanetName, getCircuitName } = require('../../generic.js')
const { postMessage } = require('../../discord.js');
const { db } = require('../../firebase.js');
const { avgSpeed, upgradeCooling, upgradeTopSpeed } = require('../../data/sw_racer/part.js');
const { blurple_color, ping_color, trail_color } = require('../../colors.js');
const { racerSelector, paginator } = require('../challenge/functions.js');
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
        name: "Already picked — cannot be picked again",
        emoji: "⭕"
    },
    2: {
        // Status 2 = picking this would violate one of the active event's
        // repeatConditions (e.g. differentPlayer / differentConditions). The
        // server enforces this on submit, so picking it WILL be rejected — the
        // copy needs to make that clear, not suggest "you can repeat with a
        // tweak".
        name: "Already picked — picking again will be rejected",
        emoji: "⚠️"
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
        setTimeout(function () {
            Promise.resolve(postMessage(interaction.client, interaction.channel.id, {
                content: String((i == 5 ? "GO!" : (5 - i)))
            })).catch(err => {
                console.warn('[tourney] countdown tick failed', err)
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

exports.setupMatchText = function ({ match } = {}) {
    const matchRules = match.ruleset
    const tourney_name = match.tournament?.name || "Practice Mode"
    const stream = match.stream

    const formatParticipant = (p) =>
        `${exports.playerFlagEmoji(p)}${p.username}${exports.playerPronouns(p)}`

    return [
        `## Match Setup`,
        `🏆 ${tourney_name}`,
        exports.matchDescription({ match }),
        `📜 ${(matchRules?.name ?? 'No ruleset selected')}`,
        `👥 ${match.players?.map(formatParticipant).join(", ") || ''}`,
        `🎙️ ${match.commentators?.map(formatParticipant).join(", ") || ''}`,
        stream ? `📺 Stream: ${match.stream}` : ''
    ].filter(line => line !== '').join("\n")
}

exports.getPoolDescription = function (pool) {
    if (!pool) {
        return ""
    }
    const track = getTrackById(pool.track)

    const poolOption = exports.getPoolOption(pool, false)
    const planetEmoji = track?.planet?.emoji ?? (pool.trackDeferred ? '🎲' : '')
    return `${planetEmoji} ${poolOption.label}${poolOption.description ? ` (${poolOption.description})` : ''}`.trim()
}

exports.getEventCost = function (event) {
    if (!event || !event.cost) return 0
    // Activated deferred events bill at full cost until resolved at the defer point.
    if (event.activated && !event.selection?.length) return event.cost
    if (!event.selection?.length) return 0
    return event.cost * (event.selection.length / (event.qty ?? 1))
}

exports.getForcePoints = function (match, discordId) {
    let fp = Number(match.ruleset?.forcePoints?.start ?? 0)
    const max = Number(match.ruleset?.forcePoints?.max ?? Infinity)
    const earnPerRace = Number(match.ruleset?.forcePoints?.earnPerRace ?? 0)
    const earnPerWin = Number(match.ruleset?.forcePoints?.earnPerWin ?? 0)
    const earnPerLoss = Number(match.ruleset?.forcePoints?.earnPerLoss ?? 0)

    match.races?.forEach(race => {
        race.events?.forEach(event => {
            if (event.user?.discordId == discordId) {
                fp -= exports.getEventCost(event)
            }
        })

        if (race.winner) {
            fp += earnPerRace
            if (race.winner.discordId == discordId) {
                fp += earnPerWin
            } else {
                fp += earnPerLoss
            }
            fp = Math.min(fp, max)
        }
    })
    return fp
}

// Single source of truth for the descriptive copy used by getEventPlayer and
// eventDescriptor. Choice copy is adverb-style — meant to read with a verb
// immediately after ("Botto randomly chooses an event").
const BOTTO_DISCORD_ID = '545798436105224203'

const EVENT_DESCRIPTORS = {
    actions: {
        permaBan: { present: '🚫 perma-bans', past: '🚫 perma-banned' },
        tempBan: { present: '❌ temp-bans', past: '❌ temp-banned' },
        selection: { present: '👆 selects', past: '👆 selected' },
        override: { present: '✳️ overrides', past: '✳️ overrode' },
        poll: { present: '🗳️ votes for', past: '🗳️ voted for' },
        choice: { present: '🗳️ chooses', past: '🗳️ chose' },
        poolPick: { present: '🗳️ picks', past: '🗳️ picked' },
        clearPoolPick: { present: '🗳️ clears', past: '🗳️ cleared' },
        chanceCube: { present: '🎲 rolls', past: '🎲 rolled' },
    },
    types: {
        allyPool: " pick from their teammate's pool",
        enemyPool: " pick from their opponent's pool",
        winnerPool: " pick from the winner's pool",
        loserPool: " pick from the loser's pool",
        dynamicEvent: 'n event',
        event: 'n event',
        color: ' chance cube',
    },
    choices: {
        raceLoser: 'Loser of last race',
        raceWinner: 'Winner of last race',
        cubeWinner: 'Chance cube winner',
        cubeLoser: 'Chance cube loser',
        randomPlayer: 'Random player',
        seedWinner: 'Higher ranked player',
        seedLoser: 'Lower ranked player',
        system: 'Botto',
        systemRandom: 'Botto randomly',
        systemNext: 'Botto sequentially',
        selectedPlayer: 'Selected player',
        unselectedPlayer: 'Unselected player',
        // 'player' depends on `present` and is handled inline in getEventPlayer.
    },
    deferUntil: { warmup: 'Warmup' },
}

exports.getEventPlayer = function (event, present = false, mention = false) {
    let choice = event.choice
    let inverted = false

    if (choice.startsWith('!')) {
        inverted = true
        choice = choice.substring(1)
    }

    const isSystem = choice.startsWith('system') || event.event == 'chanceCube'
    if (isSystem) {
        // For adverb-style system choices ('systemRandom' → "Botto randomly",
        // 'systemNext' → "Botto sequentially") the adverb is the whole reason
        // the line reads naturally. Keep the ping for plain-Botto cases (e.g.
        // chanceCube), but suppress it for adverbed ones so the resulting text
        // doesn't lose the "randomly"/"sequentially" qualifier.
        const adverbed = EVENT_DESCRIPTORS.choices[choice]
        if (adverbed && adverbed !== 'Botto') return adverbed
        if (mention) return `<@${BOTTO_DISCORD_ID}>`
        return adverbed || 'Botto'
    }

    if (event.user) {
        if (mention && event.user.discordId) {
            return `<@${event.user.discordId}>`
        }
        return event.user.username || (event.user.discordId ? `<@${event.user.discordId}>` : 'Unknown Player')
    }

    const playerLabel = choice === 'player'
        ? (present ? 'Any player' : 'Players')
        : (EVENT_DESCRIPTORS.choices[choice] || choice || 'Unknown Player')
    return (inverted ? 'Opponent of ' : '') + playerLabel
}

exports.eventDescriptor = function ({ event, present = false, mention = false } = {}) {
    const selectionDescriptions = {
        'track': getTrackName(event.selection?.map(track => track.id)),
        'racer': getRacerName(event.selection?.map(racer => racer.id)),
        'planet': getPlanetName(event.selection?.map(planet => planet.id)),
        'circuit': getCircuitName(event.selection?.map(circuit => circuit.id)),
        'condition': event.selection?.map(selection => conditionsMap[selection.id]?.name).join(", "),
        'color': event.selection?.[0]?.id == 'red' ? "🟥 Red" : "🟦 Blue",
        'player': event.selection?.map(player => `${player.username}`).join(", "),
        'allyPool': event.selection?.map(selection => exports.getPoolDescription(selection)).join(", "),
        'enemyPool': event.selection?.map(selection => exports.getPoolDescription(selection)).join(", "),
        'winnerPool': event.selection?.map(selection => exports.getPoolDescription(selection)).join(", "),
        'loserPool': event.selection?.map(selection => exports.getPoolDescription(selection)).join(", "),
        'event': event.selection?.map(selection => selection.name || selection.id).join(", "),
    }

    // Activated deferred event: player has committed but no concrete value
    // exists yet — show "a {type}" form rather than empty.
    const isUnresolvedDefer = event.activated && !event.selection?.length
    const showAsPresent = present || isUnresolvedDefer

    const eventPlayer = exports.getEventPlayer(event, showAsPresent, mention)
    const actionDescriptor = EVENT_DESCRIPTORS.actions[event.event]
    const eventAction = actionDescriptor
        ? (showAsPresent ? actionDescriptor.present : actionDescriptor.past)
        : event.event
    const eventSelection = selectionDescriptions[event.type] || event.selection
    const eventCost = exports.getEventCost(event)
    const eventCostDescription = event.cost ? ` (${eventCost}💠)` : ""
    const eventType = EVENT_DESCRIPTORS.types[event.type] ?? ` ${event.type}`

    const eventDescription = `${eventPlayer} ${eventAction} ${showAsPresent ? `a${eventType}` : `** ${eventSelection}**`}${eventCostDescription}${exports.deferSuffix(event)}`

    if (['chanceCube', 'poll'].includes(event.event) && !present) {
        const pollDesc = exports.pollDescription({ event })
        return pollDesc ? `${pollDesc}\n${eventDescription}` : eventDescription
    }

    return eventDescription
}

// Suffix appended to event descriptions when the event is deferred. The defer
// strategy isn't repeated here because eventPlayer already conveys it via the
// adverb-style choice copy ("Botto randomly chooses an event — deferred to Warmup").
exports.deferSuffix = function (event) {
    if (!event?.deferUntil) return ''
    const until = EVENT_DESCRIPTORS.deferUntil[event.deferUntil] || event.deferUntil
    return ` (activated at ${until})`
}

exports.pollDescription = function ({ event } = {}) {

    if (!event.votes || !event.votes.length) {
        return ""
    }

    const pollDescription = event.votes.map(vote => (
        `-# *${vote.player.username || `<@${vote.player.discordId}>`} voted for ${vote.selection?.map(selection =>
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

    // Deferred fields (set by API when an unresolved deferUntil event covers the
    // slot, e.g. from a deferred pool pick) — render as "🎲 Random …" until the
    // defer point fires and the API fills in the concrete value.
    const trackTitle = race.trackDeferred ? '🎲 Random Track' : getTrackName(race.track)
    const conditionsTitle = race.conditionsDeferred
        ? ' 🎲 Random Conditions'
        : exports.getConditionsDescription(race.conditions).string
    let podOverrideTitle = ''
    if (race.racer) {
        podOverrideTitle = ` as ${getRacerName(race.racer)}`
    } else if (race.racerDeferred) {
        podOverrideTitle = ` as 🎲 Random Racer`
    }

    raceDescription.title = trackTitle + conditionsTitle + podOverrideTitle

    const conditionsDescription = race.conditionsDeferred
        ? '`🎲 Random Conditions`'
        : exports.getConditionsDescription({ ...defaultConditions, ...race.conditions }).list.map(item => `\`${item}\``).join(" ")

    raceDescription.description = `-# ${conditionsDescription}\n` + (race.racerBans?.length ? `❌${getRacerName(race.racerBans)}` : "")

    return raceDescription
}

exports.preRaceHeaderText = function ({ match } = {}) {
    return `### Race ${match.currentRace + 1} - Event Phase`
}

// Generate a one-line outcome summary for a set of events that just resolved.
// Used to collapse the previous step's message when a step advances.
// Filters out events with no visible outcome (matches the eventLog filter elsewhere).
// Grouped events (pool picks) get a pool-header prefix and bullet indent so the
// scrollback reads like "<player> added to their pool: * X * Y".
exports.resolvedStepSummary = function ({ resolvedEvents } = {}) {
    // Activated-but-unresolved deferred events have no selection yet (e.g. a Random Pod
    // committed during the event phase but rolled at warmup) — include them so the pool
    // log shows the deferred line ("Botto randomly chooses a racer (activated at Warmup)").
    const visible = (resolvedEvents ?? []).filter(event =>
        ['chanceCube', 'poll'].includes(event.event)
        || event.selection?.length
        || (event.activated && event.deferUntil)
    )
    if (!visible.length) {
        return ''
    }
    const lines = []
    let currentGroupId = null
    visible.forEach(event => {
        if (event.groupId !== currentGroupId) {
            currentGroupId = event.groupId
            if (event.groupId) {
                const owner = event.owner?.username || (event.owner?.discordId ? `<@${event.owner.discordId}>` : 'Player')
                lines.push(`-# ${owner} added to their pool:`)
            }
        }
        const indent = event.groupId ? '* ' : ''
        // Deferred events haven't actually resolved yet — render in present tense,
        // and treat deferChoice as the actor since whoever was configured to choose
        // punted to it. Falls back to event.choice if deferChoice is missing.
        const isDeferred = !!event.deferUntil
        const descriptorEvent = isDeferred
            ? { ...event, choice: event.deferChoice || event.choice }
            : event
        lines.push(indent + exports.eventDescriptor({ event: descriptorEvent, present: isDeferred, mention: true }))
    })
    return lines.join('\n')
}

// Minimal V2 container with a single TextDisplay; used to "collapse" a stale step message.
exports.collapsedView = function ({ text } = {}) {
    return [new ContainerBuilder()
        .setAccentColor(colorToInt(trail_color))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text || '-#'))]
}

// For poll/chanceCube active events: show every player's vote status — voted ones with their pick
// (username, no ping), pending ones pinged so they get a glow on the message.
exports.activeVoteStatus = function ({ event, match } = {}) {
    if (!['chanceCube', 'poll'].includes(event?.event)) return ''
    const players = match?.players ?? []
    if (!players.length) return ''
    const votedById = new Map((event.votes ?? []).map(v => [v.player.id, v]))
    const lines = players.map(player => {
        const vote = votedById.get(player.id)
        if (vote) {
            const choice = (vote.selection ?? []).map(s =>
                event.options?.find(o => o.id == s.id)?.name || s.id
            ).join(", ") || '—'
            return `-# ✅ ${player.username} voted for ${choice}`
        }
        return `-# ⏳ Waiting on <@${player.discordId}>`
    })
    return lines.join('\n')
}

exports.preRaceRightNowText = function ({ match } = {}) {
    const race = match.races[match.currentRace]
    if (!race.activeEvents.length) return ""

    const event = race.activeEvents[0]
    const isVote = ['chanceCube', 'poll'].includes(event.event)

    let desc = `-# Right now: ${exports.eventDescriptor({
        event,
        present: true,
        mention: !isVote
    })}${race.activeEvents.length > 1 ? ` and ${race.activeEvents.length - 1} more events` : ""}`

    if (isVote) {
        // For votes, every player needs to act. Show per-player status with pings on pending voters.
        const status = exports.activeVoteStatus({ event, match })
        if (status) desc += `\n${status}`
    }

    return desc
}

exports.preRaceForcePointsText = function ({ match, summary } = {}) {
    const race = match.races[match.currentRace]
    const currentPlayer = race.activeEvents[0]?.user?.id
    if (!currentPlayer) {
        return ""
    }
    const currentPoints = summary?.players?.find(player => player.id == currentPlayer)?.forcePoints ?? 0
    return `-# You have 💠${currentPoints} Force Points`
}

exports.preRaceUpNextText = function ({ match, options } = {}) {
    const race = match.races[match.currentRace]
    let desc = "-# Up next: "
    if (race.eventQueue?.length) {
        desc += exports.eventDescriptor({ event: race.eventQueue[0], present: true, options })
        if (race.eventQueue.length > 1) {
            desc += ` and ${race.eventQueue.length - 1}${[...race.activeEvents, ...race.eventQueue].some(event => ['dynamicEvent', 'event'].includes(event.type)) ? '+' : ''} more events`
        }
    } else {
        desc += "Warmup begins"
    }
    return desc
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

// Take a server-sorted run list (ascending by time) and apply legacy display
// rules: tag the overall record (`trecord`), the best non-banned pod when
// distinct (`record`), and the best run from the current tournament when distinct
// from the overall record (`tournamentRecord`). Dedupes per-player.
exports.annotateLeaderboard = function ({ runs = [], racerBans = [], currentPlayers = [], podOverride, currentTournamentId } = {}) {
    if (!runs.length) return []

    const banned = new Set((racerBans || []).map(String))
    const annotated = runs.map(r => ({ ...r, podban: banned.has(String(r.racer)) }))

    annotated[0].trecord = true

    // "This tournament" record: best run from the same tournament. Only marked
    // when it isn't already the overall record (otherwise the badge is redundant).
    if (currentTournamentId) {
        const tournamentBest = annotated.find(r => r.tournamentId === currentTournamentId)
        if (tournamentBest && !tournamentBest.trecord) {
            tournamentBest.tournamentRecord = true
        }
    }

    const result = []
    if (annotated[0].podban) result.push(annotated[0])

    // "Best available pod" must be a real pod — runs with a missing/empty racer
    // can still hold tourney records and per-player bests but don't get the
    // best-available-pod tag.
    const recordEligible = annotated.filter(r => !r.podban && r.racer && (!podOverride || String(podOverride) === String(r.racer)))
    if (recordEligible.length) recordEligible[0].record = true

    // Per-player dedupe still considers undefined-pod runs.
    const playerEligible = annotated.filter(r => !r.podban && (!podOverride || String(podOverride) === String(r.racer)))
    const playerIds = new Set(result.map(r => r.player?.id))
    for (const r of playerEligible) {
        if (!r.player?.id || playerIds.has(r.player.id)) continue
        playerIds.add(r.player.id)
        result.push(r)
    }

    // Filter to legacy display set: trecord + record + tournamentRecord (if distinct) + entries belonging to current match players.
    const currentPlayerIds = new Set((currentPlayers || []).map(p => p?.id).filter(Boolean))
    return result.filter(r => r.trecord || r.record || r.tournamentRecord || currentPlayerIds.has(r.player?.id))
}

// One line per leaderboard entry; mirrors legacy resultFormat shape.
exports.formatLeaderboardLine = function (run) {
    if (!run || !run.time) return ''
    const racer = run.racer ? getRacerById(run.racer) : null
    const racerFlag = racer?.flag || '❔'
    const playerName = truncateString(run.player?.username || '?', 24)
    const deaths = [null, undefined, 0].includes(run.deaths) ? '' : `\`💀×${run.deaths}\``
    const tag = run.trecord
        ? '`Tourney Record`'
        : run.tournamentRecord
            ? '`This Tournament Record`'
            : run.record
                ? '`Best Available Pod`'
                : ''
    return [racerFlag, `\`${time_fix(run.time)}\``, playerName, deaths, tag].filter(Boolean).join(' ')
}

exports.leaderboardSection = function (annotated) {
    if (!annotated || !annotated.length) return null
    const lines = annotated.map(exports.formatLeaderboardLine).filter(Boolean)
    if (!lines.length) return null
    return `**Best Times**\n${lines.join('\n')}`
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

    // A pool's track/racer/conditions can be unresolved-deferred, in which case
    // the API leaves the field empty and sets the matching *Deferred flag.
    // Render those slots as "🎲 Random …" so players know what's pending.
    if (!track && !option.trackDeferred) {
        return { label: "no track", value: "null" }
    }

    const trackLabel = option.trackDeferred ? '🎲 Random Track' : track.name
    const conditionsLabel = option.conditionsDeferred
        ? ' 🎲 Random Conditions'
        : this.getConditionsDescription(option.conditions).string

    const poolOption = {
        label: `${trackLabel}${conditionsLabel}`,
        value: option.id,
        default: selected
    }

    if (track) {
        poolOption.emoji = {
            name: track.planet.emoji.split(":")[1],
            id: track.planet.emoji.split(":")[2].replace(">", "")
        }
    } else {
        poolOption.emoji = { name: '🎲' }
    }

    if (option.racer) {
        poolOption.label += ` as ${racer.name}`
    } else if (option.racerDeferred) {
        poolOption.label += ` as 🎲 Random Racer`
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

exports.optionGetters = {
    color: (option, selected) => exports.getColorOption(option, selected),
    racer: (option, selected) => exports.getRacerOption(option, selected),
    track: (option, selected) => exports.getTrackOption(option, selected),
    circuit: (option, selected) => exports.getCircuitOption(option, selected),
    planet: (option, selected) => exports.getPlanetOption(option, selected),
    condition: (option, selected) => exports.getConditionOption(option, selected),
    player: (option, selected) => exports.getPlayerOption(option, selected),
    event: (option, selected) => exports.getEventOption(option, selected),
    allyPool: (option, selected) => exports.getPoolOption(option, selected),
    enemyPool: (option, selected) => exports.getPoolOption(option, selected),
    winnerPool: (option, selected) => exports.getPoolOption(option, selected),
    loserPool: (option, selected) => exports.getPoolOption(option, selected),
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

    // Discord requires maxValues >= 1. Two ruleset cases need clamping:
    //   - event.max === 0 means "unlimited" per the schema, but `??` lets 0 through
    //   - eventOptions can be empty (e.g. an enemyPool whose pool is empty after
    //     defer state shuffles), making Math.min(25, 0) = 0
    const optionCount = eventOptions?.length || 0
    const rawMax = !event.qty ? 1 : (event.max || Math.min(25, optionCount))
    const maxValues = Math.max(1, rawMax)
    const minValues = Math.min(maxValues, event.optional ? 0 : (event.qty ?? 1))
    const event_selector = new StringSelectMenuBuilder()
        .setCustomId(`tourney_play_submitEvent_${event.id}`)
        .setPlaceholder(placeholder)
        .setMinValues(minValues)
        .setMaxValues(maxValues)

    eventRow.addComponents(event_selector)

    // deferChoice events have no real options — render a single activation row.
    // Picking it sends `activated: true` to the API; the actual value is filled
    // in at the defer point. The local Discord value `__activate__` is
    // translated to the activation submission shape in play.js and never
    // round-trips to the API as an id.
    if (event.deferChoice) {
        // Activation is inherently optional regardless of how the ruleset flags
        // the event — deselecting the row sends `activated: false` to undo it.
        // Clamp max_values to the single option we actually render: the outer
        // computation derives max from the API's full racer-option list (25 once
        // the event is activated, so resolveDeferredEvents has something to roll),
        // and Discord rejects max_values > options.length.
        event_selector.setMinValues(0)
        event_selector.setMaxValues(1)
        const label = event.name || 'Defer activation'
        const description = exports.eventDescriptor({
            event: { ...event, choice: event.deferChoice, cost: 0 },
            present: true,
        })
        event_selector.addOptions({
            label: label.substring(0, 100),
            description: description.substring(0, 100),
            value: '__activate__',
            default: !!event.activated,
        })
        return eventRow
    }

    eventOptions.forEach(option => {
        const selected = event.selection?.some(selection => selection.id == option.id)
        const getOption = exports.optionGetters[event.type]
        event_selector.addOptions(
            getOption
                ? getOption(option, selected)
                : { label: option.id, value: option.id, default: selected }
        )
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

    //sort racers by avg speed (skip if any option isn't a known racer id)
    if (event.type == 'racer' && event_selector.options.every(o => getRacerById(o.data.value))) {
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

exports.scheduledMatchView = function ({ match } = {}) {
    const container = new ContainerBuilder()
        .setAccentColor(colorToInt(ping_color))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Match Setup\nSetup match`))
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_setup")
                    .setLabel("Set Up Match")
                    .setStyle(ButtonStyle.Primary)
            )
        )
    return [container]
}

exports.preRaceView = function ({ match, summary, options, activeEventCost, leaderboard } = {}) {
    const race = match.races[match.currentRace]
    const events = race.activeEvents

    const container = new ContainerBuilder().setAccentColor(colorToInt(ping_color))

    //header — no past events log; the scroll trail above is the log
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(exports.preRaceHeaderText({ match }))
    )

    const preRaceLbText = exports.leaderboardSection(leaderboard)
    if (preRaceLbText) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(preRaceLbText))
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    }

    //"who's up right now"
    const rightNowText = exports.preRaceRightNowText({ match })
    if (rightNowText) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(rightNowText))
    }

    //one action row per active event
    events.forEach(event => {
        container.addActionRowComponents(exports.eventSelector({ event, options }))
    })

    //force points balance, sits next to the submit-cost so the player can weigh the spend
    const forcePointsText = exports.preRaceForcePointsText({ match, summary })
    if (forcePointsText) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(forcePointsText))
    }

    //submit button row (suppressed for chance cube only)
    if (!(events.length == 1 && events[0].event == 'chanceCube')) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_nextEvents")
                    .setLabel(`Submit Event${events.length > 1 ? "s" : ""}${activeEventCost ? ` (${activeEventCost}💠)` : ''}`)
                    .setStyle(ButtonStyle.Primary)
            )
        )
    }

    //up next preview — placed after submit so it reads as "what happens when you press submit"
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(exports.preRaceUpNextText({ match, options }))
    )

    return [container]
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
    const startMs = (t) => {
        const d = t?.startDate
        if (!d) return 0
        if (typeof d === 'number') return d
        if (typeof d._seconds === 'number') return d._seconds * 1000
        if (typeof d.seconds === 'number') return d.seconds * 1000
        const parsed = new Date(d).getTime()
        return isNaN(parsed) ? 0 : parsed
    }
    tournaments.sort((a, b) => startMs(b) - startMs(a)).forEach(tournament => {
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

    const tsMs = (m) => {
        const d = m?.updatedAt ?? m?.createdAt
        if (!d) return 0
        if (typeof d === 'number') return d
        if (typeof d._seconds === 'number') return d._seconds * 1000
        if (typeof d.seconds === 'number') return d.seconds * 1000
        const parsed = new Date(d).getTime()
        return isNaN(parsed) ? 0 : parsed
    }
    matches.sort((a, b) => tsMs(b) - tsMs(a)).slice(0, 24).forEach(match => {
        const matchPlayers = match.players?.length ? match.players.map(player => `${player.username}`).join(", ") : "No Players"
        const matchDescription = exports.matchDescription({ match })
        const matchTourney = match.tournament?.name || "Practice Mode"

        match_selector.addOptions(
            {
                label: `${matchPlayers} - Race ${match.currentRace + 1} - ${STATE_NAMES[match.status]}`,
                description: truncateString(`${matchTourney + (matchDescription ? ` - ${matchDescription}` : "")}`, 100),
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

    const rulesetTypeEmoji = {
        '1v1': '🆚',
        'Qualifier': '🏁',
        'FFA': '👥',
    }

    const options = rulesets
        .filter(ruleset => ruleset.status == 'active')
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map(ruleset => {
            const emoji = rulesetTypeEmoji[ruleset.type] ?? '📋'
            return {
                label: ruleset.name,
                value: ruleset.id,
                description: " " + (ruleset.description).slice(0, 99),
                emoji: { name: emoji },
                default: selected.includes(ruleset.id)
            }
        })

    ruleset_selector.addOptions(...paginator({ value: selected?.[0], array: options }))
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

exports.setupMatchView = function ({ match, tournaments, rulesets, rulesetSelected } = {}) {
    const container = new ContainerBuilder()
        .setAccentColor(colorToInt('#3BA55D'))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(exports.setupMatchText({ match })))

    container.addActionRowComponents(
        exports.tourneySelector({ tournaments, selected: match.tournament?.id ? [match.tournament.id] : ['practice'] })
    )

    if (!match.tournament?.id) {
        container.addActionRowComponents(
            exports.rulesetSelector({ rulesets, selected: [rulesetSelected ?? match.ruleset?.id] })
        )
    } else if (match.tournament?.phases) {
        container.addActionRowComponents(
            exports.tourneyPhaseSelector({ phases: match.tournament.phases, selected: [match.phaseId] })
        )

        if (match.phaseId) {
            const phase = match.tournament.phases.find(phase => phase.id == match.phaseId)
            container.addActionRowComponents(
                exports.tourneyDivisionSelector({ divisions: phase.divisions, selected: [match.divisionId] })
            )

            if (match.divisionId) {
                const division = phase.divisions.find(division => division.id == match.divisionId)
                container.addActionRowComponents(
                    exports.tourneyRoundSelector({ rounds: division.rounds, selected: [match.roundId] })
                )
            }
        }
    }

    let playable = false, joinable_player = false

    if (match.ruleset !== "" && match.players && match.commentators && match.players.length == 2) {
        playable = true
    }

    if (!match.players || match.players.length < 2) {
        joinable_player = true
    }

    container.addActionRowComponents(
        new ActionRowBuilder()
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
    )

    return [container]
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

// Look up the locally-cached user record for a player, by discord id.
function lookupUserRecord(player) {
    const discordId = player?.discordId
    if (!discordId || !db?.user) return null
    return Object.values(db.user).find(u => u.discordID == discordId) || null
}

// Look up a player's country flag emoji (`:flag_xx: `) from the bot's user db. Returns
// an empty string if the user has no country set or isn't in the local cache.
exports.playerFlagEmoji = function (player) {
    const user = lookupUserRecord(player)
    if (user?.country) {
        return `:flag_${String(user.country).toLowerCase()}: `
    }
    return ''
}

// Format a player's pronouns as ` (he/him)` for inline display, or empty string if unset.
exports.playerPronouns = function (player) {
    const user = lookupUserRecord(player)
    if (!user?.pronouns) return ''
    return ` (${exports.joinPronouns(user.pronouns)})`
}

// Resolve a player's current avatar URL. Stored player.avatar URLs go stale when the user
// changes their avatar (Discord hashes change), causing "image not found" thumbnails. Prefer
// a live URL from the bot's user cache; fall back to Discord's default avatar by ID; only
// use the stored URL as a last resort.
exports.resolvePlayerAvatar = function ({ player, client } = {}) {
    if (!player) return null
    const discordId = player.discordId
    if (client && discordId) {
        const cached = client.users?.cache?.get(discordId)
        if (cached?.displayAvatarURL) {
            try {
                return cached.displayAvatarURL({ extension: 'png', size: 128 })
            } catch (_) { /* fall through */ }
        }
    }
    if (discordId) {
        // New-system default avatar bucket: (userId >> 22) % 6
        try {
            const bucket = (BigInt(discordId) >> 22n) % 6n
            return `https://cdn.discordapp.com/embed/avatars/${bucket}.png`
        } catch (_) { /* fall through */ }
    }
    return player.avatar || null
}

// Append a player row to a V2 container — a Section with a TextDisplay and the player's
// discord avatar as the thumbnail accessory. Falls back to a plain TextDisplay if no avatar
// URL can be resolved.
exports.addPlayerRow = function (container, { player, text, client } = {}) {
    const avatarUrl = exports.resolvePlayerAvatar({ player, client })
    if (avatarUrl) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: avatarUrl } }))
        )
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    }
    return container
}

exports.playerWarmupStatus = function (playerStatus, hideReady = false, forcedRacer = null) {
    const greenCircle = ":green_circle:"
    const redCircle = ":red_circle:"

    if (!playerStatus && !forcedRacer) {
        return `${redCircle} Not Ready`
    }

    let racerStatus
    if (forcedRacer) {
        // race.racer is a forced override (e.g. a Random Pod that resolved at warmup) —
        // the player has no choice during warmup; show the locked-in racer.
        racerStatus = `${greenCircle} ${getRacerName(forcedRacer)}`
    } else if (playerStatus.selectedRacer) {
        racerStatus = playerStatus.racerShown ? getRacerName(playerStatus.selectedRacer) : `${greenCircle} Racer Selected (hidden)`
    } else {
        racerStatus = `${redCircle} Racer Not Selected`
    }
    const readyStatus = playerStatus.isReady ? `${greenCircle} Ready` : `${redCircle} Not Ready`

    if (hideReady) {
        return `${racerStatus}`
    }

    return `${racerStatus}\n${readyStatus}`
}

exports.warmupView = function ({ match, client, readOnly = false, leaderboard } = {}) {
    const race = match.races[match.currentRace]
    const track = getTrackById(race.track)
    const countdownStatus = race.raceStart
        ? `Race begins <t:${Math.round(race.raceStart / 1000)}:R>`
        : "Countdown starts when both players have readied."
    const raceDescription = exports.getRaceDescription(race, match.ruleset.defaultConditions)

    const container = new ContainerBuilder().setAccentColor(colorToInt(ping_color))

    const headerText = `-# Race ${match.currentRace + 1} - Warmup\n## ${raceDescription.title}\n${raceDescription.description}`

    if (track?.preview) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
                .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: track.preview } }))
        )
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
    }

    const divider = () => container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))

    const warmupHeaderLbText = exports.leaderboardSection(leaderboard)
    if (warmupHeaderLbText) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(warmupHeaderLbText))
    }

    divider()

    // Forced racer (race.racer) overrides player choice — set by an override or by a
    // resolved deferred Random Pod. Suppresses the pick button and shows the locked racer.
    const forcedRacer = race.racer || null
    Object.values(match.players).forEach(player => {
        const playerStatus = race.players[player.id]
        const text = `### ${exports.playerFlagEmoji(player)}${player.username}\n${exports.playerWarmupStatus(playerStatus, race.raceStart > 0, forcedRacer)}`

        if (readOnly || forcedRacer) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        } else {
            const hasRacer = !!playerStatus?.selectedRacer
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setCustomId(`tourney_play_pickRacer_${player.id}`)
                            .setLabel(hasRacer ? "Edit Racer" : "Pick Racer")
                            .setStyle(hasRacer ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    )
            )
        }
        divider()
    })

    if (readOnly) {
        return [container]
    }

    const buttonRow = new ActionRowBuilder()
    if (race.gents?.agreed == "?") {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_race" + race + "_gents_true")
                .setLabel("Accept")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("tourney_play_race" + race + "_gents_false")
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger)
        )
        container.addActionRowComponents(buttonRow)
        return [container]
    }
    if (race.raceStart) {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId("tourney_play_abortCountdown")
                .setLabel("Abort Countdown")
                .setStyle(ButtonStyle.Danger)
        )
    } else {
        buttonRow
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_markReady")
                    .setLabel("Ready")
                    .setStyle(ButtonStyle.Success)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_markUnready")
                    .setLabel("Not Ready")
                    .setStyle(ButtonStyle.Danger)
            )
    }

    container.addActionRowComponents(buttonRow)

    // Countdown status sits below the controls so it reads as the consequence of the readys above.
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${countdownStatus}`))

    return [container]
}

exports.racePlayerStatus = function (player, runs, hidden = true, recordBadge = false) {
    const run = runs.find(run => run.player?.id == player?.id)
    if (!run) {
        return ":red_circle: Awaiting submission"
    }

    const runRacer = getRacerById(run.racer)
    const runTime = `**${run.racer ? runRacer.flag : ':stopwatch:'} ${run.dnf ? "DNF" : run.time ? `\`${time_fix(run.time)}\`` : ""}**`
    const runDeaths = `${run.deaths === undefined ? '💀 \`?\`' : `💀 \`${run.deaths}\``}`
    const runNotes = run.notes ? `-# *└ ${run.notes}*` : ""

    const timeDeaths = [runTime, runDeaths].filter(i => i).join("    ")
    const badge = recordBadge ? ' <a:newrecord:672640831882133524>' : ''
    const headline = hidden ? `|| ${timeDeaths} ||${badge}` : `${timeDeaths}${badge}`
    return runNotes ? `${headline}\n${runNotes}` : headline
}

exports.inRaceView = function ({ match, client, readOnly = false, leaderboard } = {}) {
    const race = match.races[match.currentRace]
    const raceDescription = exports.getRaceDescription(race, match.ruleset.defaultConditions)
    const track = getTrackById(race.track)

    const container = new ContainerBuilder().setAccentColor(colorToInt('#DD2E44'))

    const headerText = `-# Race ${match.currentRace + 1} - In Progress\n## ${raceDescription.title}\n${raceDescription.description}`

    if (track?.preview) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
                .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: track.preview } }))
        )
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
    }

    const divider = () => container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))

    const inRaceLbText = exports.leaderboardSection(leaderboard)
    if (inRaceLbText) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(inRaceLbText))
    }

    divider()

    Object.values(match.players).forEach(player => {
        const text = `### ${exports.playerFlagEmoji(player)}${player.username}\n${exports.racePlayerStatus(player, race.runs)}`
        if (readOnly) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        } else {
            const hasRun = race.runs.some(r => r.player?.id == player.id)
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                    .setButtonAccessory(
                        new ButtonBuilder()
                            // Player id is encoded in the customId so the buttons are unique per row
                            // and trackers/commentators can submit on behalf of any racer.
                            .setCustomId(`tourney_play_submitRun_${player.id}`)
                            .setLabel(hasRun ? "Edit" : "Submit")
                            .setStyle(hasRun ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    )
            )
        }
        divider()
    })

    if (readOnly) {
        return [container]
    }

    container.addActionRowComponents(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tourney_play_submitRun`)
                    .setStyle(ButtonStyle.Primary)
                    .setLabel("Submit Results")
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tourney_play_submitDnf`)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("DNF")
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_restartRace")
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("Restart")
            )
    )

    return [container]
}

exports.postRaceView = function ({ match, client, readOnly = false, leaderboard } = {}) {
    const race = match.races[match.currentRace]
    const track = getTrackById(race.track)
    const raceDescription = exports.getRaceDescription(race, match.ruleset.defaultConditions)

    const container = new ContainerBuilder().setAccentColor(colorToInt('#2D7D46'))

    const headerText = `-# Race ${match.currentRace + 1} - Post Race\n## ${raceDescription.title}\n${raceDescription.description}`

    if (track?.preview) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
                .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: track.preview } }))
        )
    } else {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
    }

    const divider = () => container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))

    const postRaceLbText = exports.leaderboardSection(leaderboard)
    if (postRaceLbText) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(postRaceLbText))
    }

    divider()

    // Determine which players just set a record this race. `trecord` = overall
    // best for the (track, conditions) bucket; `tournamentRecord` = best within
    // the current tournament. We surface both so a player who beats their own
    // tournament's standing gets recognition even if they didn't crack the
    // overall record.
    const trecordEntry = (leaderboard || []).find(r => r.trecord)
    const tournamentRecordEntry = (leaderboard || []).find(r => r.tournamentRecord)
    const fromThisRace = (entry) => !!(entry
        && entry.matchId === match.id
        && entry.raceIndex === match.currentRace)
    const playerSetRecord = (player) => fromThisRace(trecordEntry) && trecordEntry.player?.id === player?.id
    const playerSetTournamentRecord = (player) => fromThisRace(tournamentRecordEntry) && tournamentRecordEntry.player?.id === player?.id

    Object.values(match.players).forEach(player => {
        const run = race.runs.find(r => r.player.id == player.id)
        const verifiedTag = run?.verified
            ? `\n-# :white_check_mark: Verified${run.verifiedBy?.discordId ? ` by <@${run.verifiedBy.discordId}>` : ''}`
            : ''
        // Explicit record callouts under the verification line — the inline emoji
        // badge alone is easy to miss.
        const recordCallout = playerSetRecord(player)
            ? `\n-# 🏆 New tourney record!`
            : playerSetTournamentRecord(player)
                ? `\n-# 🏅 New record for this tournament!`
                : ''
        const isWinner = player.id == race.winner?.id
        const leadingEmoji = isWinner ? "👑 " : exports.playerFlagEmoji(player)
        const text = `### ${leadingEmoji}${player.username}\n${exports.racePlayerStatus(player, race.runs, false, playerSetRecord(player))}${verifiedTag}${recordCallout}`

        if (!readOnly && match.status == STATE_POST_RACE && run) {
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setCustomId(`tourney_play_verifyRun_${player.id}`)
                            .setLabel(run.verified ? "Re-verify" : "Verify")
                            .setStyle(run.verified ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    )
            )
        } else {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        }
        divider()
    })

    if (readOnly) {
        return [container]
    }

    container.addActionRowComponents(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tourney_play_submitRun`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("Submit Results")
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tourney_play_submitDnf`)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel("DNF")
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_verifyResults")
                    .setLabel("Verify All")
                    .setStyle(ButtonStyle.Primary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_restartRace")
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel("Restart")
            )
    )

    if (match.status == STATE_POST_RACE) {
        const commPings = match.commentators?.map(c => `<@${c.discordId}>`).join(", ") || ''
        const verifiedCount = race.runs.filter(r => r.verified).length
        const totalRuns = race.runs.length
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# :red_circle: Awaiting Verification (${verifiedCount}/${totalRuns})${commPings ? ` ${commPings}` : ''}`)
        )
    }

    return [container]
}

exports.postMatchView = function ({ match } = {}) {
    const container = new ContainerBuilder()
        .setAccentColor(colorToInt('#2D7D46'))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `### Match Concluded\n## ${match.winner.username} Wins!\nGGs, racers! The match has been saved.\n\n**:microphone2: Commentators/Trackers**\n:orange_circle: Don't forget to click 'Episode Finished' after the interviews`
        ))
    return [container]
}

// Kickoff view posted on the MATCH_SETUP → PRE_RACE transition in place of the
// race-0 matchSummaryView ("Tied 0 to 0"). Same Container/accent shape as the
// summary view, but surfaces each player's profile (platform, input, bio) so the
// matchup feels introduced rather than scored.
exports.matchIntroductionView = function ({ match, summary, client } = {}) {
    if (!match) return null

    const container = new ContainerBuilder().setAccentColor(colorToInt('#FFFFFF'))

    const tourneyName = match.tournament?.name || 'Practice Mode'
    const desc = exports.matchDescription({ match })
    const rulesetName = match.ruleset?.name || 'No ruleset'
    const winLimit = summary?.winLimit ?? match.ruleset?.winLimit

    const headerLines = [`-# Match Introduction`, `## 🏆 ${tourneyName}`]
    if (desc && desc !== 'Practice Mode' && desc !== tourneyName) {
        headerLines.push(desc)
    }
    headerLines.push(`📜 ${rulesetName}`)
    if (winLimit) headerLines.push(`👑 First to ${winLimit} wins.`)
    if (match.stream) headerLines.push(`📺 ${match.stream}`)

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join('\n')))

    const divider = () => container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    divider()

    ;(match.players ?? []).forEach(player => {
        const user = lookupUserRecord(player)
        const flag = exports.playerFlagEmoji(player)
        const pronouns = exports.playerPronouns(player)
        const platform = user?.platform ? `\`${user.platform}\`` : '*no platform set*'
        const input = user?.input ? `\`${user.input}\`` : '*no input set*'
        const bio = user?.bio ? `\n*${truncateString(user.bio, 200)}*` : ''

        const text = [
            `### ${flag}${player.username}${pronouns}`,
            `🎮 ${platform} · ⌨️ ${input}${bio}`
        ].join('\n')

        exports.addPlayerRow(container, { player, client, text })
        divider()
    })

    return [container]
}

exports.matchSummaryView = function ({ summary, client } = {}) {
    if (!summary) {
        return null
    }

    const titleLine = summary.tied
        ? `Tied Match ${summary.players[0].wins} to ${summary.players[0].wins}`
        : `${summary.players[0].username} ${(summary.status == STATE_POST_MATCH ? "wins" : "leads")} ${summary.players[0].wins} to ${summary.players[1].wins}` +
        (summary.matchPoint ? " (Match Point)" : "")

    const container = new ContainerBuilder().setAccentColor(colorToInt('#FFFFFF'))

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# Match Summary\n## ${titleLine}\nFirst to ${summary.winLimit} wins.`
    ))

    const divider = () => container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    divider()

    summary.players.forEach((player, i) => {
        const isLeader = !summary.tied && i === 0 && summary.status == STATE_POST_MATCH
        const leadingEmoji = isLeader ? "👑 " : exports.playerFlagEmoji(player)
        const pronouns = exports.playerPronouns(player)
        const text = [
            `### ${leadingEmoji}${player.username}`,
            `-# ${pronouns}`,
            `👑 \`${player.wins}\` 💠\`${player.forcePoints}\` 💀 \`${player.deaths + (player.trueDeaths ? "" : "+")}\``,
            `⏱️ \`${time_fix(player.time) + (player.trueTime ? "" : "+")}\``,
        ].join("\n")
        exports.addPlayerRow(container, { player, client, text })
        divider()
    })

    const commMsg = summary.status !== STATE_POST_MATCH
        ? ":orange_circle: Don't forget to update the score!"
        : ":orange_circle: Don't forget to close the match!"
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${commMsg}`))

    return [container]
}



exports.adminView = function ({ match } = {}) {
    const container = new ContainerBuilder()
        .setAccentColor(colorToInt(blurple_color))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `### Match Manager\n${exports.matchTitle({ match })}\nThis menu allows admins and commentators to manage the match while it is in progress. Please make a selection.\nCurrent Race: \`${match?.currentRace}\`\nCurrent Stage: \`${match?.status}\`\n-# id: ${match.id}`
        ))
        .addActionRowComponents(
            new ActionRowBuilder()
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
                        .setCustomId("tourney_play_repost")
                        .setLabel("Repost Current Step")
                        .setEmoji("🔄")
                        .setStyle(ButtonStyle.Primary)
                )
        )
        .addActionRowComponents(
            new ActionRowBuilder()
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
        )
    return [container]
}

exports.rewindView = function ({ match } = {}) {
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

    const container = new ContainerBuilder()
        .setAccentColor(colorToInt(blurple_color))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Rewind Match`))
        .addActionRowComponents(new ActionRowBuilder().addComponents(rewindSelector))

    return [container]
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

exports.verifyRunModal = function ({ match, playerId }) {
    const race = match.races[match.currentRace]
    const run = race.runs.find(r => r.player.id == playerId)

    // Discord clients cache user input by modal customId — if a user types into a modal and
    // closes it without submitting, the cached input is restored next time the same customId
    // opens, OVERRIDING any bot-provided setValue. Append a unique nonce so each modal-open
    // is a fresh customId from Discord's perspective. The handler strips ":<nonce>" before
    // parsing the playerId.
    const nonce = Date.now().toString(36)
    const modal = new ModalBuilder()
        .setCustomId(`tourney_play_verifyRun_${playerId}:${nonce}`)
        .setTitle((`Verify ${run.player.username}'s Run`).substring(0, 45))

    const Time = new TextInputBuilder()
        .setCustomId('time')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('--:--.---')
        .setMinLength(1)
        .setMaxLength(10)
        .setRequired(true)
        .setValue(String(run.dnf ? 'DNF' : time_fix(run.time)))

    const Deaths = new TextInputBuilder()
        .setCustomId('deaths')
        .setStyle(TextInputStyle.Short)
        .setMinLength(0)
        .setMaxLength(10)
        .setRequired(false)

    if (![null, undefined, ''].includes(run.deaths)) {
        Deaths.setValue(String(run.deaths))
    }

    const defaultRacerId = run?.racer != null && run.racer !== '' ? String(run.racer) : null
    const RacerSelect = new StringSelectMenuBuilder()
        .setCustomId('racer')
        .setPlaceholder('Select racer')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
    const racersWithSpeed = racers.slice(0, 23).map(racer => ({
        ...racer,
        avgSpeed: avgSpeed(upgradeTopSpeed(racer.max_speed, 5), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 5))
    }))
    racersWithSpeed.sort((a, b) => b.avgSpeed - a.avgSpeed).forEach(racer => {
        const value = String(racer.racernum - 1)
        RacerSelect.addOptions({
            label: racer.name,
            value,
            description: racer.pod.substring(0, 50),
            emoji: {
                name: racer.flag.split(':')[1],
                id: racer.flag.split(':')[2].replace('>', '')
            },
            default: defaultRacerId === value
        })
    })

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('⏱️ Time')
            .setTextInputComponent(Time),
        new LabelBuilder()
            .setLabel('💀 Deaths')
            .setTextInputComponent(Deaths),
        new LabelBuilder()
            .setLabel('🏎️ Racer')
            .setStringSelectMenuComponent(RacerSelect),
    )

    return modal
}

exports.pickRacerModal = function ({ currentRace, currentRacer = null, isShown = false, targetPlayerId, targetUsername, racerBans = [] }) {
    const nonce = Date.now().toString(36)
    const modal = new ModalBuilder()
        .setCustomId(`tourney_play_pickRacer_${targetPlayerId}:${nonce}`)
        .setTitle(`Race ${currentRace + 1} Racer${targetUsername ? ` (${targetUsername})` : ''}`)

    const defaultRacerId = currentRacer != null && currentRacer !== '' ? String(currentRacer) : null
    const RacerSelect = new StringSelectMenuBuilder()
        .setCustomId('racer')
        .setPlaceholder('Select your racer')
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
    const racersWithSpeed = racers.slice(0, 23).map(racer => ({
        ...racer,
        avgSpeed: avgSpeed(upgradeTopSpeed(racer.max_speed, 5), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 5))
    }))
    racersWithSpeed.sort((a, b) => b.avgSpeed - a.avgSpeed).forEach(racer => {
        const value = String(racer.racernum - 1)
        const banned = racerBans.includes(value)
        RacerSelect.addOptions({
            label: racer.name,
            value,
            description: banned ? banStatusMap[1].name : racer.pod.substring(0, 50),
            emoji: banned
                ? { name: banStatusMap[1].emoji }
                : {
                    name: racer.flag.split(':')[1],
                    id: racer.flag.split(':')[2].replace('>', '')
                },
            default: defaultRacerId === value
        })
    })

    const Reveal = new CheckboxBuilder()
        .setCustomId('reveal')
        .setDefault(Boolean(isShown))

    modal.addLabelComponents(
        new LabelBuilder()
            .setLabel('🏎️ Racer')
            .setStringSelectMenuComponent(RacerSelect),
        new LabelBuilder()
            .setLabel('👁️ Reveal')
            .setDescription("Show this pick to your opponent (can't be undone)")
            .setCheckboxComponent(Reveal)
    )

    return modal
}

exports.submitRunModal = function ({ currentRace, run = null, selectedRacer = null, dnf = false, targetPlayerId = null, targetUsername = null }) {
    // Encode the target player id in the modal's customId so the submit handler can attribute
    // the run to the correct player when a tracker/commentator submits on behalf of a racer.
    const baseId = dnf ? "tourney_play_submitDnf" : "tourney_play_submitRun"
    // Append a nonce so Discord doesn't reuse cached user input from a previous open
    // of "the same" modal (Discord client behavior — it remembers values per customId
    // when the user closes a modal without submitting and overrides bot setValue calls).
    const nonce = Date.now().toString(36)
    const customId = (targetPlayerId ? `${baseId}_${targetPlayerId}` : baseId) + `:${nonce}`
    const titleSuffix = targetUsername ? ` (${targetUsername})` : ''
    const submitModal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(dnf ? `Forfeit Race ${currentRace + 1}${titleSuffix}` : `Race ${currentRace + 1} Results${titleSuffix}`)

    const Time = new TextInputBuilder()
        .setCustomId("time")
        .setStyle(TextInputStyle.Short)
        .setMinLength(0)
        .setMaxLength(10)
        .setRequired(true)
        .setPlaceholder("--:--.---")

    const defaultDeaths = run?.deaths != null && run.deaths !== '' ? String(Math.min(10, Number(run.deaths))) : null
    const Deaths = new StringSelectMenuBuilder()
        .setCustomId("deaths")
        .setPlaceholder("How many times did you die?")
        .setMinValues(0)
        .setMaxValues(1)
        .setRequired(false)
    const deathOptions = [
        { label: "I'm not sure", value: 'unsure' },
        { label: '0 (deathless)', value: '0' },
        ...Array.from({ length: 9 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) })),
        { label: '10+', value: '10' }
    ]
    deathOptions.forEach(opt => Deaths.addOptions({
        ...opt,
        default: defaultDeaths === opt.value
    }))

    const Notes = new TextInputBuilder()
        .setCustomId("notes")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(false)

    // Build racer select sorted by avg max-upgrade speed; default to existing run's
    // racer if editing, otherwise the one chosen during warmup.
    const defaultRacerId = run?.racer != null && run.racer !== ''
        ? String(run.racer)
        : (selectedRacer != null && selectedRacer !== '' ? String(selectedRacer) : null)
    const RacerSelect = new StringSelectMenuBuilder()
        .setCustomId("racer")
        .setPlaceholder("Select your racer")
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true)
    const racersWithSpeed = racers.slice(0, 23).map(racer => ({
        ...racer,
        avgSpeed: avgSpeed(upgradeTopSpeed(racer.max_speed, 5), racer.boost_thrust, racer.heat_rate, upgradeCooling(racer.cool_rate, 5))
    }))
    racersWithSpeed.sort((a, b) => b.avgSpeed - a.avgSpeed).forEach(racer => {
        const value = String(racer.racernum - 1)
        RacerSelect.addOptions({
            label: racer.name,
            value,
            description: racer.pod.substring(0, 50),
            emoji: {
                name: racer.flag.split(":")[1],
                id: racer.flag.split(":")[2].replace(">", "")
            },
            default: defaultRacerId === value
        })
    })

    if (run) {
        if (run.dnf) {
            Time.setValue('DNF')
        } else if (run.time != null && run.time !== '' && run.time !== 0) {
            Time.setValue(String(time_fix(run.time)))
        }
        // Deaths default is set via the option `default` flag above; nothing to do here.
        if (run.notes) {
            Notes.setValue(String(run.notes))
        }
    }

    const labels = []
    if (!dnf) {
        labels.push(
            new LabelBuilder()
                .setLabel("⏱️ Time")
                .setTextInputComponent(Time)
        )
    }
    labels.push(
        new LabelBuilder()
            .setLabel("💀 Deaths")
            .setStringSelectMenuComponent(Deaths),
        new LabelBuilder()
            .setLabel("🏎️ Racer")
            .setStringSelectMenuComponent(RacerSelect),
        new LabelBuilder()
            .setLabel("📝 Notes")
            .setTextInputComponent(Notes)
    )
    submitModal.addLabelComponents(...labels)

    return submitModal
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