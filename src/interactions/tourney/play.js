const { adminView, matchSelector, matchSummaryView, preRaceView, warmupView, inRaceView, postRaceView, setupMatchView, scheduledMatchView, submitRunModal, countDown, verifyModal, postMatchView, rewindView } = require('./functions.js')
const { requestWithUser, axiosClient: axios } = require('../../axios.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, EmbedBuilder, MessageFlags } = require('discord.js')
const { time_to_seconds } = require('../../generic.js')
const { WhyNobodyBuy, emojimap } = require('../../data/discord/emoji.js')
const { getMatch } = require('./matchApi.js')
const { tournamentsRulesetsCache } = require('../../services/tourneyCache.js')

const STATE_SCHEDULED = 0
const STATE_MATCH_SETUP = 1;
const STATE_PRE_RACE = 2;
const STATE_WARMUP = 3;
const STATE_IN_RACE = 4;
const STATE_POST_RACE = 5;
const STATE_POST_MATCH = 6;
const STATE_CANCELLED = 99;

async function errorOut(interaction, error) {
    await interaction.followUp({ content: error, ephemeral: true })
}

function placeholderView(text) {
    return [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))]
}

// Discord's IsComponentsV2 flag is sticky per message — set at creation and immutable.
// A component interaction on a pre-V2 message cannot be edited into V2; we have to send a fresh V2 message and clear the old one.
async function renderV2(interaction, view) {
    const original = interaction.message
    const isLegacyOriginal = original && !original.flags?.has(MessageFlags.IsComponentsV2)
    if (isLegacyOriginal) {
        try {
            await interaction.editReply({ content: '-# *Reposting in new layout below…*', embeds: [], components: [] })
        } catch (e) {
            console.warn('[tourney] failed to clear legacy message during V2 migration', e)
        }
        return interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
    }
    return interaction.editReply({ components: view })
}

async function defferInteraction(interaction, deferred, command, ephemeral = false, client, userId) {
    if (deferred) {
        return 0
    }

    deferred = true
    match = client.channelToMatch.get(interaction.channel.id)
    // handle modals up front using cached match since discord does not allow us to defer modals
    // we need to defer interaction responses because a cold api takes too long
    if (!interaction.isModalSubmit() && ['submitRun', 'verifyResults'].includes(command) && match) {
        switch (command) {
            case 'submitRun':
                const race = match?.races?.[match.currentRace]
                const existingRun = race?.runs?.find(r => r.player.discordId == userId)
                console.log(race.runs, userId, existingRun)
                const runModal = submitRunModal({ currentRace: match?.currentRace, run: existingRun })
                interaction.showModal(runModal)
                return 1
            case 'verifyResults':
                const verifyM = verifyModal({ match })
                interaction.showModal(verifyM)
                return 1
        }
    } else if (interaction.isChatInputCommand()) {
        if (ephemeral) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
        } else {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 })
        }
    } else {
        await interaction.deferUpdate()
    }

    return 0
}

function isCountdownActive(client, interaction, raceStart) {
    if (!raceStart) {
        return false
    }

    const match = client.channelToMatch.get(interaction.channel.id)
    if (!match) {
        return false
    }

    const currentRace = match.races[match.currentRace]
    return raceStart === currentRace?.raceStart
}

exports.play = async function ({ client, interaction, args, userSnapshot } = {}) {
    const messageIsEphemeral = interaction.message?.flags.has(MessageFlags.Ephemeral)
    const selection = interaction.values ?? []
    const command = args[1]
    let deferred = false

    let match = client.channelToMatch.get(interaction.channel.id)
    let meta = {
        message: ""
    }

    // bind match
    if (args[1] == 'bindMatch') {
        if (args[2] == 'submit') {
            //validate match selection
            const selection = interaction.message.components[0].components[0].data.options.find(o => o.default == true)?.value
            if (!selection) {
                interaction.reply({ content: '❌ Something went wrong.', ephemeral: true })
                return
            }

            //create new match
            if (selection == 'new') {
                try {
                    const newRes = await requestWithUser({
                        method: 'post',
                        url: `/matches`,
                        userSnapshot,
                        data: {
                            channelId: interaction.channel.id,
                            status: STATE_MATCH_SETUP
                        },
                    })

                    match = newRes.data
                    meta = newRes.meta ?? meta
                    client.channelToMatch.set(interaction.channel.id, match)
                } catch (err) {
                    interaction.reply({ content: `${WhyNobodyBuy}${err.message}`, ephemeral: true })
                    return
                }

                //set match
            } else {
                let matchId = selection;

                ({ match, meta, error } = await getMatch(matchId, userSnapshot))
                client.channelToMatch.set(interaction.channel.id, match)
                if (!match) {
                    interaction.reply({ content: `${WhyNobodyBuy} Couldn't get match\n${error}`, ephemeral: true })
                    return
                }
            }
        } else {
            match = null
            client.channelToMatch.set(interaction.channel.id, null)
        }

    }

    // select match when unbound
    if (!match) {
        const d = await defferInteraction(interaction, deferred, command, false, client, userSnapshot.id)
        if (d) {
            return
        }
        deferred = true
        const res = await axios.get('/matches')
        const matches = res.data?.data ?? []

        // lazy-hydrate cache for component interactions on stale messages (e.g. after bot restart)
        if (!interaction.isChatInputCommand() && args[1] != 'bindMatch') {
            const candidate = matches.find(m => m.channelId === interaction.channel.id && ![STATE_CANCELLED, STATE_POST_MATCH].includes(m.status))
            if (candidate) {
                match = candidate
                client.channelToMatch.set(interaction.channel.id, match)
            }
        }

        if (!match) {
            let selected = interaction.values ?? []
            const matchRow = matchSelector({ matches: matches.filter(match => ![STATE_CANCELLED, STATE_POST_MATCH].includes(match.status)), selected })
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('Please select a match.'))
                .addActionRowComponents(matchRow)
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("tourney_play_bindMatch_submit")
                            .setLabel("Select")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(selected.length == 0)
                    )
                )

            await renderV2(interaction, [container])
            return
        }
    }

    // admin menu
    if (interaction.isChatInputCommand()) {
        ({ match, meta } = await getMatch(match.id, userSnapshot))
        if (!match) {
            interaction.reply({ content: `${WhyNobodyBuy} Couldn't get match`, ephemeral: true })
            return
        }
        interaction.reply({ flags: MessageFlags.IsComponentsV2, components: adminView({ match }) })
        return
    }

    const d = await defferInteraction(interaction, deferred, command, false, client, userSnapshot.id)
    if (d) {
        return
    }


    switch (command) {
        case 'rewindMatch':
            if (interaction.isStringSelectMenu()) {
                try {
                    const setupRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${match.id}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'rewindMatch',
                                    rewindTo: selection[0]
                                }
                            ],
                        },
                    })

                    match = setupRes.data
                    meta = setupRes.meta ?? meta
                } catch (err) {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            } else {
                ({ match, meta } = await getMatch(match.id, userSnapshot))
                if (!match) {
                    await errorOut(interaction, `${WhyNobodyBuy} Couldn't get match`)
                    return
                }
                await renderV2(interaction, rewindView({ match }))
                return
            }
            break
        case 'nextEvents':
        case 'abortCountdown':
        case 'selectRacer':
        case 'revealRacer':
        case 'markReady':
        case 'markUnready':
        case 'restartRace':
        case 'setTournament':
        case 'setPhase':
        case 'setDivision':
        case 'setRound':
        case 'setRuleset':
            if (selection[0]?.startsWith('page_')) {
                break
            }
        case 'setup':
        case 'setupStart':
        case 'setupJoin':
        case 'setupLeave':
        case 'setupCommentate':
        case 'setupCancel':
            try {
                const setupRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${match.id}/submitAction`,
                    userSnapshot,
                    data: {
                        actions: [
                            {
                                name: command,
                                payload: selection[0]
                            }
                        ],
                    },
                })

                match = setupRes.data
                meta = setupRes.meta
            } catch (err) {
                await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                return
            }

            break
        case 'submitEvent':
            const eventId = args[2]

            let actions = [
                {
                    name: 'submitEvent',
                    event: {
                        id: eventId,
                        selection: selection.map(id => {
                            return {
                                id: id,
                            }
                        })
                    }
                }
            ]

            // FIXME: this is a hack to auto-advance the match when a color is selected
            if (['red', 'blue'].includes(selection[0])) {
                actions.push({
                    name: 'nextEvents'
                })
            }

            try {
                const eventRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${match.id}/submitAction`,
                    userSnapshot,
                    data: { actions },
                })

                match = eventRes.data
                meta = eventRes.meta

            } catch (err) {
                await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                return
            }

            break
        case 'submitRun':

            if (interaction.isModalSubmit()) {
                const submittedTime = interaction.fields.getTextInputValue('time').trim()
                const submittedDeaths = isNaN(Number(interaction.fields.getTextInputValue('deaths').trim())) ? '' : Number(interaction.fields.getTextInputValue('deaths'))
                const dnf = submittedTime.toLowerCase() == 'dnf'

                //validate submission
                if (submittedTime.toLowerCase() !== 'dnf' && (isNaN(Number(submittedTime.replace(":", ""))) || time_to_seconds(submittedTime) == null)) { //time doesn't make sense
                    const holdUp = new EmbedBuilder()
                        .setTitle(`${WhyNobodyBuy} Time Does Not Compute`)
                        .setDescription("Your time was submitted in an incorrect format.")
                    interaction.reply({ embeds: [holdUp], ephemeral: true })
                    return
                }

                //submit time
                const run = {
                    time: dnf ? 0 : time_to_seconds(submittedTime),
                    deaths: submittedDeaths,
                    notes: interaction.fields.getTextInputValue('notes').trim(),
                    dnf: interaction.fields.getTextInputValue('time').toLowerCase() == 'dnf'
                }

                try {
                    const eventRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${match.id}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'submitRun',
                                    run
                                }
                            ]
                        },
                    })

                    match = eventRes.data
                    meta = eventRes.meta

                } catch (err) {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            }
            break
        case 'verifyResults':
            const res = await axios.get(`/matches/${match.id}`)
            match = res.data?.data

            if (interaction.isModalSubmit()) {
                const race = match.races[match.currentRace]
                const runs = race.runs

                match.players.forEach(player => {
                    const run = runs.find(r => r.player.id == player.id)
                    const submittedTime = interaction.fields.getTextInputValue(`${player.id}_time`).trim()
                    const submittedDeaths = interaction.fields.getTextInputValue(`${player.id}_deaths`).trim()
                    const dnf = submittedTime.toLowerCase() == 'dnf'

                    run.time = dnf ? 0 : time_to_seconds(submittedTime)
                    run.deaths = isNaN(Number(submittedDeaths)) ? '' : Number(submittedDeaths)
                    run.dnf = dnf
                })

                try {
                    const eventRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${match.id}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'verifyResults',
                                    runs
                                }
                            ]
                        },
                    })

                    match = eventRes.data
                    meta = eventRes.meta

                } catch (err) {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            }
            break
    }

    if (!match) {
        try {
            const res = await axios.get(`/matches/${match.id}`)
            match = res.data?.data
        } catch (err) {
            await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
            return
        }
    }

    if (match && meta?.lastEventSeq != null) {
        match.__lastSeenSeq = meta.lastEventSeq
    }
    client.channelToMatch.set(interaction.channel.id, match)
    let view = adminView({ match })

    switch (match.status) {
        case STATE_SCHEDULED:
            view = scheduledMatchView({ match })
            break
        case STATE_MATCH_SETUP:
            const [tournaments, rulesets] = await Promise.all([
                tournamentsRulesetsCache.getTournaments(),
                tournamentsRulesetsCache.getRulesets(),
            ])
            const rulesetSelected = command === 'setRuleset' && selection[0]?.startsWith('page_')
                ? selection[0]
                : undefined
            view = setupMatchView({ match, tournaments, rulesets, rulesetSelected })
            break
        case STATE_PRE_RACE:
            view = preRaceView({ match, summary: meta.matchSummary, options: meta.activeEventsOptions, activeEventCost: meta.activeEventCost })
            break
        case STATE_WARMUP:
            view = warmupView({ match })

            if (command == 'nextEvents') {
                await renderV2(interaction, preRaceView({ match, summary: meta.matchSummary, options: meta.activeEventsOptions }))
                interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
                return
            }
            break
        case STATE_IN_RACE:
            view = inRaceView({ match })

            if (command == 'markReady') {
                await renderV2(interaction, placeholderView(`Good luck racers! Countdown incoming ${emojimap.countdown}`))
                countDown(interaction)

                setTimeout(() => {
                    interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
                }, 10000)
                return
            }
            break
        case STATE_POST_RACE:
            view = postRaceView({ match })
            break
        case STATE_POST_MATCH:
            view = postMatchView({ match })
            break
        case STATE_CANCELLED:
            await renderV2(interaction, placeholderView(meta.message || 'Match cancelled.'))
            return
    }

    if (meta.raceUpdated || meta.countdownSet) {
        await renderV2(interaction, placeholderView('-# …'))

        // send match summary when match advances to next race
        if (meta.raceUpdated && match.currentRace > 0) {
            await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: matchSummaryView({ summary: meta.matchSummary }) })
        }

        const followUpMessage = await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })

        // set up countdown
        if (meta.countdownSet) {
            const raceStart = match.races[match.currentRace]?.raceStart
            if (raceStart) {
                setTimeout(() => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    interaction.channel.send({ content: `Good luck racers! Countdown incoming ${emojimap.countdown}` })
                }, raceStart - Date.now() - 10000)

                setTimeout(() => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    countDown(interaction)
                }, raceStart - Date.now() - 8000)

                setTimeout(async () => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    try {
                        const eventRes = await requestWithUser({
                            method: 'post',
                            url: `/matches/${match.id}/submitAction`,
                            userSnapshot,
                            data: {
                                actions: [
                                    {
                                        name: 'raceStart',
                                    }
                                ]
                            },
                        })

                        match = eventRes.data
                        meta = eventRes.meta

                        const race = match.races[match.currentRace]
                        if (race.raceStart) {
                            interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: inRaceView({ match }) })
                            await followUpMessage.edit({ components: placeholderView('-# Race started.') })
                        }

                    } catch (err) {
                        console.error('[tourney] raceStart action failed', err)
                        interaction.channel.send({ content: `${WhyNobodyBuy}${err.message}` })
                        return
                    }

                }, raceStart - Date.now() + 3000)
            }
            return
        }
        return
    }

    await renderV2(interaction, view)
}