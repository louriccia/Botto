const { getTrackName, getRacerName } = require('../../../generic.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.clue = async function ({ interaction, database, user_key, selection } = {}) {
    if (interaction.isModalSubmit()) {
        let clue = interaction.fields.getTextInputValue('clue')
        database.ref(`challenge/clues`).push({
            player: user_key,
            type: selection[2][0],
            selection: Number(selection[3]),
            clue
        })
        const quoteEmbed = new EmbedBuilder()
            .setTitle("💡 Clue Submitted")
            .setDescription(`You have successfully submited a clue:\n\n${clue}\n\nThis clue will randomly appear in Hints and Bounties for ${selection[2] == 'track' ? getTrackName(selection[3]) : getRacerName(selection[3])}.`)
        interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
        return true
    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle('Submit a Clue')
        const clue = new TextInputBuilder()
            .setCustomId('clue')
            .setLabel('Clue')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(140)
            .setRequired(true)
        const ActionRow1 = new ActionRowBuilder().addComponents(clue)
        sponsorModal.addComponents(ActionRow1)
        await interaction.showModal(sponsorModal)
        return false
    }
}