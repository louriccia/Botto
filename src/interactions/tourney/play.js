const { adminEmbed, adminComponents, matchSelector, matchSummaryEmbed, preRaceComponents, preRaceEmbed, warmupEmbed, inRaceEmbed, inRaceComponents, postRaceEmbed, warmupComponents, postRaceComponents, setupMatchEmbed, setupMatchComponents, scheduledMatchComponents, scheduledMatchEmbed, submitRunModal, countDown, verifyModal, preRaceContent } = require('./functions.js')
const { requestWithUser, axiosClient: axios } = require('../../axios.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { randomErrorMessage, time_to_seconds } = require('../../generic.js')
const { set } = require('firebase/database')
const { WhyNobodyBuy, emojimap } = require('../../data/discord/emoji.js')

const STATE_SCHEDULED = 0
const STATE_MATCH_SETUP = 1;
const STATE_PRE_RACE = 2;
const STATE_WARMUP = 3;
const STATE_IN_RACE = 4;
const STATE_POST_RACE = 5;
const STATE_POST_MATCH = 6;
const STATE_CANCELLED = 99;



exports.play = async function ({ client, interaction, args, userSnapshot } = {}) {

    let matchId = client.channelToMatch.get(interaction.channel.id)

    let match

    if (args[1] == 'bindMatch') {
        const selection = interaction.message.components[0].components[0].data.options.find(o => o.default == true)?.value

        if (!selection) {
            interaction.reply({ content: '❌ Something went wrong.', ephemeral: true })
            return
        }

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
                matchId = match.id
                client.channelToMatch.set(interaction.channel.id, match.id)
            } catch (err) {
                interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to create new match\n${err.message}`, ephemeral: true })
                return
            }
        } else {
            client.channelToMatch.set(interaction.channel.id, selection)
            matchId = selection
            const res = await axios.get(`/matches/${selection}`)
            console.log(res.data)
            match = res.data?.data
        }
    }

    if (!matchId) {
        const res = await axios.get('/matches')
        const matches = res.data?.data
        let components = []
        let selected = interaction.values ?? []
        const matchRow = matchSelector({ matches, selected })
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tourney_play_bindMatch")
                    .setLabel("Select")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(selected.length == 0)
            )
        components.push(matchRow, buttonRow)

        if (interaction.isChatInputCommand()) {
            interaction.reply({ content: '❌ No match found in this channel.', embeds: [], components })
        } else {
            interaction.update({ content: '❌ No match found in this channel.', embeds: [], components })
        }
        return
    }

    const selection = interaction.values ?? []
    const command = args[1]
    let message = ""

    switch (command) {
        case 'nextEvents':
        case 'rewindMatch':
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
                    url: `/matches/${matchId}/submitAction`,
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
                message = setupRes.meta.message
            } catch (err) {
                interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to submit action\n${err.message}`, ephemeral: true })
                return
            }

            break
        case 'submitEvent':
            const eventId = args[2]
            try {
                const eventRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${matchId}/submitAction`,
                    userSnapshot,
                    data: {
                        actions: [
                            {
                                name: 'submitEvent',
                                event: {
                                    id: eventId,
                                    selection: selection
                                }
                            }
                        ]
                    },
                })

                match = eventRes.data
                message = eventRes.meta.message

            } catch (err) {
                interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to submit event\n${err.message}`, ephemeral: true })
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
                        url: `/matches/${matchId}/submitAction`,
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
                    message = eventRes.meta.message

                } catch (err) {
                    interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to submit run\n${err.message}`, ephemeral: true })
                    return
                }
            } else {
                const res = await axios.get(`/matches/${selection}`)
                match = res.data?.data
                // get existing run for submitting user
                const runModal = submitRunModal({ currentRace: match.currentRace })
                interaction.showModal(runModal)
                return

            }
            break
        case 'verify':
            const res = await axios.get(`/matches/${selection}`)
            match = res.data?.data

            if (interaction.isModalSubmit()) {
                const race = match.races[match.currentRace]
                const runs = race.runs

                match.players.forEach(player => {
                    const run = runs.find(r => r.player.id == player.id)

                    const submittedTime = interaction.fields.getTextInputValue(`${player.id}_time'`).trim()
                    const submittedDeaths = interaction.fields.getTextInputValue(`${player.id}_deaths'`).trim()
                    const dnf = submittedTime.toLowerCase() == 'dnf'

                    run.time = dnf ? 0 : time_to_seconds(submittedTime)
                    run.deaths = isNaN(Number(submittedDeaths)) ? '' : Number(submittedDeaths)
                    run.dnf = dnf
                })

                try {
                    const eventRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${matchId}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'verify',
                                    runs
                                }
                            ]
                        },
                    })

                    match = eventRes.data
                    message = eventRes.meta.message

                } catch (err) {
                    interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to verify run\n${err.message}`, ephemeral: true })
                    return
                }
            } else {

                // get existing run for submitting user
                const verifyM = verifyModal({ match })
                interaction.showModal(verifyM)
                return
            }
            break
    }

    if (!match) {
        const res = await axios.get(`/matches/${matchId}`)
        match = res.data?.data
    }

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
            message = preRaceContent({ match })
            embed = preRaceEmbed({ match })
            components = preRaceComponents({ match })
            break
        case STATE_WARMUP:
            embed = warmupEmbed({ match })
            components = warmupComponents({ match })
            break
        case STATE_IN_RACE:
            embed = inRaceEmbed({ match })
            components = inRaceComponents({ match })

            if (command == 'markReady') {
                interaction.update({ content: `Good luck racers! Countdown incoming ${emojimap.countdown}`, embeds: [], components: [] })
                countDown(interaction)

                setTimeout(() => {
                    interaction.followUp({ embeds: [embed], components })
                }, 10000)
                return
            }

            break
        case STATE_POST_RACE:
            embed = postRaceEmbed({ match })
            components = postRaceComponents({ match })
            break
        case STATE_POST_MATCH:

            break
        case STATE_CANCELLED:
            break
    }

    if (interaction.isChatInputCommand()) {
        interaction.reply({ content: message, embeds: [embed], components })
    } else {
        interaction.update({ content: message, embeds: [embed], components })
    }

    //process command
    // const tourney_command = require(`./play/${command}.js`)
    // tourney_command[command]({ client, interaction, args, match })
}