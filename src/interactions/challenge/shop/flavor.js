const { flavormap } = require('../data.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.flavor = async function ({ interaction, database, user_key, botto_name, selection } = {}) {
    let type = selection[2][0]
    if (interaction.isModalSubmit()) {
        let text = interaction.fields.getTextInputValue('text')
        database.ref(`challenge/flavor`).push({
            user: user_key,
            text,
            type
        })
        const quoteEmbed = new EmbedBuilder()
            .setTitle(`${flavormap[type].emoji} ${capitalize(type)} Submitted`)
            .setDescription(`You have successfully submited a ${type}:\n\n${text.replaceAll('$player', botto_name)}\n\nThis ${type} will randomly appear in random challenge messages.`)
        interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
        return true
    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle(`Submit a ${capitalize(type)}`)
        const quote = new TextInputBuilder()
            .setCustomId('text')
            .setLabel(capitalize(type))
            .setStyle(TextInputStyle.Short)
            .setMaxLength(140)
            .setPlaceholder(flavormap[type].placeholder)
            .setRequired(true)
        const ActionRow1 = new ActionRowBuilder().addComponents(quote)
        sponsorModal.addComponents(ActionRow1)
        await interaction.showModal(sponsorModal)
        return false
    }
}