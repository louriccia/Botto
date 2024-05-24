const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUsername, getOpponent, raceEmbed, raceComponents, countDown, getWinner, matchSummaryEmbed, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../../functions.js')
const { manageTruguts } = require('../../../challenge/functions.js');
const { time_to_seconds, time_fix } = require('../../../../generic.js');
const { editMessage } = require('../../../../discord.js');
const { betEmbed, betComponents } = require('../../../trugut_functions.js')
const { database, db } = require('../../../../firebase.js')



exports.abort = async function ({ client, interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    let race = Number(args[1].replace("race", ""))

    //not a player or commentator
    if (!Object.values(match_data.players).includes(member_id) && !Object.values(match_data.commentators).includes(member_id)) {
        interaction.reply({ content: "You are not a player or commentator!", ephemeral: true })
        return
    }

    //update values
    Object.values(match_data.players).forEach(player => {
        match_ref.child('races').child(race).child('ready').child(player).set(false)
    })
    await match_ref.child('races').child(race).child('countdown').remove()

    //update message
    match_data = db.ty.live[interaction.channelId]
    await interaction.update({
        content: Object.values(match_data.players).filter(player => !match_data.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(match_data.commentators).map(comm => "<@" + comm + ">").join(" "),
        embeds: [raceEmbed({ race, interaction })],
        components: raceComponents({ race, interaction })
    })
    interaction.followUp({ content: `<@${member_id}> aborted the countdown. Once both players click READY, the countdown will begin.` })
}