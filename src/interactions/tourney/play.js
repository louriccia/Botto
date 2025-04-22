const { initializeMatch, adminEmbed, adminComponents, matchSelector, setupEmbed, raceEmbed, raceComponents, raceEventEmbed, raceEventComponents, matchSummaryEmbed, preRaceComponents, preRaceEmbed, warmupEmbed, inRaceEmbed, inRaceComponents, postRaceEmbed, warmupComponents, postRaceComponents, setupMatchEmbed, setupMatchComponents, scheduledMatchComponents, scheduledMatchEmbed } = require('./functions.js')
const { requestWithUser, axiosClient: axios } = require('../../axios.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { randomErrorMessage } = require('../../generic.js')

const STATE_SCHEDULED = 0
const STATE_MATCH_SETUP = 1;
const STATE_PRE_RACE = 2;
const STATE_WARMUP = 3;
const STATE_IN_RACE = 4;
const STATE_POST_RACE = 5;
const STATE_POST_MATCH = 6;
const STATE_CANCELLED = 99;

const updateMap = {
    'setTournament': 'tournament',
    'setPhase': 'phaseId',
    'setDivision': 'divisionId',
    'setRound': 'roundId',
    'setRuleset': 'ruleset'
}

exports.play = async function ({ client, interaction, args, userSnapshot } = {}) {

    const memberId = userSnapshot.discordId
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

    let updatedMatch = {}
    const selection = interaction.values?.[0] ?? null
    const command = args[1]

    switch (command) {
        //updates TODO: convert these to api handled commands with the side-effect of updating the ruleset id
        case 'setTournament':
        case 'setPhase':
        case 'setDivision':
        case 'setRound':
        case 'setRuleset':

            updatedMatch[updateMap[command]] = selection

            try {
                const updateRes = await requestWithUser({
                    method: 'patch',
                    url: `/matches/${matchId}`,
                    userSnapshot,
                    data: updatedMatch,
                })
                console.log('updateRes', updateRes)
                match = updateRes.data
            } catch (err) {
                interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to update match\n${err.message}`, ephemeral: true })
                return
            }
            break

        //setup actions
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
                            { name: command }
                        ],
                    },
                })

                match = setupRes.data
            } catch (err) {
                interaction.reply({ content: `**${randomErrorMessage()}**\n❌ Failed to submit action\n${err.message}`, ephemeral: true })
                return
            }

            break

    }

    let content = `${match?.status}`
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
        interaction.reply({ content, embeds: [embed], components })
    } else {
        interaction.update({ content, embeds: [embed], components })
    }

    //process command
    // const tourney_command = require(`./play/${command}.js`)
    // tourney_command[command]({ client, interaction, args, match })
}