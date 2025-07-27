const { adminEmbed, adminComponents, matchSelector, matchSummaryEmbed, preRaceComponents, preRaceEmbed, warmupEmbed, inRaceEmbed, inRaceComponents, postRaceEmbed, warmupComponents, postRaceComponents, setupMatchEmbed, setupMatchComponents, scheduledMatchComponents, scheduledMatchEmbed, submitRunModal, countDown, verifyModal, preRaceContent, postMatchEmbed, conditionIdsToObject, rewindComponents } = require('./functions.js')
const { requestWithUser, axiosClient: axios } = require('../../axios.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js')
const { time_to_seconds } = require('../../generic.js')
const { WhyNobodyBuy, emojimap } = require('../../data/discord/emoji.js')

const STATE_SCHEDULED = 0
const STATE_MATCH_SETUP = 1;
const STATE_PRE_RACE = 2;
const STATE_WARMUP = 3;
const STATE_IN_RACE = 4;
const STATE_POST_RACE = 5;
const STATE_POST_MATCH = 6;
const STATE_CANCELLED = 99;

async function getMatch(matchId, userSnapshot) {
    try {
        const res = await requestWithUser({
            method: 'post',
            url: `/matches/${matchId}/submitAction`,
            userSnapshot,
            data: {
                actions: [
                    {
                        name: 'getMatch',
                    }
                ],
            },
        })
        return { match: res.data, meta: res.meta }
    } catch (err) {
        console.log(err)
        return { match: null, meta: null, error: err.message }
    }
}

async function errorOut(interaction, error) {
    await interaction.editReply({ content: interaction.message?.content })
    await interaction.followUp({ content: error, ephemeral: true })
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
            await interaction.deferReply({ ephemeral: true })
        } else {
            await interaction.deferReply()
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
        const res = await axios.get('/matches')
        const matches = res.data?.data
        let components = []
        let selected = interaction.values ?? []
        const matchRow = matchSelector({ matches: matches.filter(match => ![STATE_CANCELLED, STATE_POST_MATCH].includes(match.status)), selected })
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_bindMatch_submit")
                    .setLabel("Select")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(selected.length == 0)
            )
        components.push(matchRow, buttonRow)

        interaction.editReply({ content: 'Please select a match.', embeds: [], components })
        return
    }

    // admin menu
    if (interaction.isChatInputCommand()) {
        const d = await defferInteraction(interaction, deferred, command, false, client, userSnapshot.id); //, true
        if (d) {
            return
        }
        ({ match, meta } = await getMatch(match.id, userSnapshot))
        if (!match) {
            interaction.editReply({ content: `${WhyNobodyBuy} Couldn't get match`, ephemeral: true })
            return
        }
        interaction.editReply({ embeds: [adminEmbed({ match })], components: adminComponents({ match }) }) //, ephemeral: true
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
                    interaction.editReply({ content: `${WhyNobodyBuy}${err.message}`, ephemeral: true })
                    return
                }
            } else {
                ({ match, meta } = await getMatch(match.id, userSnapshot))
                if (!match) {
                    interaction.editReply({ content: `${WhyNobodyBuy} Couldn't get match`, ephemeral: true })
                    return
                }
                interaction.editReply({ components: rewindComponents({ match }) })
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
                    interaction.editReply({ embeds: [holdUp], ephemeral: true })
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

    client.channelToMatch.set(interaction.channel.id, match)
    let embed = adminEmbed({ match })
    let components = []

    switch (match.status) {
        case STATE_SCHEDULED:
            embed = scheduledMatchEmbed({ match })
            components = scheduledMatchComponents({ match })
            break
        case STATE_MATCH_SETUP:
            const tournamentsRequest = await axios.get('/tournaments')
            const tournaments = tournamentsRequest.data?.data
            const rulesetsRequest = await axios.get('/rulesets')
            const rulesets = rulesetsRequest.data?.data
            embed = setupMatchEmbed({ match })
            components = setupMatchComponents({ match, tournaments, rulesets })
            break
        case STATE_PRE_RACE:
            meta.message = preRaceContent({ match })
            embed = preRaceEmbed({ match, summary: meta.matchSummary, options: meta.activeEventsOptions })
            components = preRaceComponents({ match, activeEventCost: meta.activeEventCost, options: meta.activeEventsOptions })
            break
        case STATE_WARMUP:
            embed = warmupEmbed({ match })
            components = warmupComponents({ match })

            if (command == 'nextEvents') {
                await interaction.editReply({ content: "", embeds: [preRaceEmbed({ match, summary: meta.matchSummary, options: meta.activeEventsOptions })], components: [] })
                interaction.followUp({ content: meta.message, embeds: [embed], components })
                return
            }
            break
        case STATE_IN_RACE:
            embed = inRaceEmbed({ match })
            components = inRaceComponents({ match })

            if (command == 'markReady') {
                interaction.editReply({ content: `Good luck racers! Countdown incoming ${emojimap.countdown}`, embeds: [], components: [] })
                countDown(interaction)

                setTimeout(() => {
                    interaction.followUp({ embeds: [embed], components })
                }, 10000)
                return
            }
            break
        case STATE_POST_RACE:
            meta.message = `Awaiting verification ${match.commentators.map(c => `<@${c.discordId}>`).join(", ")}`
            embed = postRaceEmbed({ match })
            components = postRaceComponents({ match })
            break
        case STATE_POST_MATCH:
            meta.message = `GGs!`
            embed = postMatchEmbed({ match })
            components = []
            break
        case STATE_CANCELLED:
            interaction.editReply({ content: meta.message ?? "", embeds: [], components: [] })
            return
    }

    if (meta.raceUpdated || meta.countdownSet) {
        await interaction.editReply({ content: "", components: [] })

        // send match summary when match advances to next race
        if (meta.raceUpdated && match.currentRace > 0) {
            await interaction.followUp({ embeds: [matchSummaryEmbed({ summary: meta.matchSummary })] })
        }

        const followUpMessage = await interaction.followUp({ content: meta.message ?? "", embeds: [embed], components, withResponse: true })

        // set up countdown
        if (meta.countdownSet) {
            const raceStart = match.races[match.currentRace]?.raceStart
            if (raceStart) {
                setTimeout(() => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    interaction.followUp({ content: `Good luck racers! Countdown incoming ${emojimap.countdown}` })
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
                            interaction.followUp({ embeds: [inRaceEmbed({ match })], components: inRaceComponents({ match }) })
                            await followUpMessage.edit({ components: [] })
                        }

                    } catch (err) {
                        interaction.followUp({ content: `${WhyNobodyBuy}${err.message}`, ephemeral: true })
                        return
                    }

                }, raceStart - Date.now() + 3000)
            }
            return
        }
        return
    }

    if (interaction.isChatInputCommand() || messageIsEphemeral) {
        interaction.editReply({ content: meta.message ?? "", embeds: [embed], components })
    } else {
        interaction.editReply({ content: meta.message ?? "", embeds: [embed], components })
    }
}