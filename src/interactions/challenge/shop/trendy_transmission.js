const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.trendy_transmission = async function ({ interaction } = {}) {
    if (interaction.isModalSubmit()) {
        let title = interaction.fields.getTextInputValue('title')
        let url = interaction.fields.getTextInputValue('url')
        let desc = interaction.fields.getTextInputValue('desc')
        let image = interaction.fields.getTextInputValue('image')
        let color = interaction.fields.getTextInputValue('color')

        function isValidHexCode(hexCode) {
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(hexCode);
        }

        //invalid color
        if (color && !isValidHexCode(color)) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that color doesn't exist")
                .setDescription("Please enter a valid hex code `#FFFFFF`")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return false
        }

        const customEmbed = new EmbedBuilder()
        if (title) {
            customEmbed.setTitle(title)
        }
        if (url) {
            customEmbed.setURL(url)
        }
        if (desc) {
            customEmbed.setDescription(desc)
        }
        if (image) {
            customEmbed.setImage(image)
        }
        if (color) {
            customEmbed.setColor(color)
        }

        //improper format
        if (![title, desc].filter(f => f).length) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> It's a trick. Send no reply.")
                .setDescription("You cannot send a blank embed.")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return false
        }
        interaction.update({ embeds: [customEmbed], content: '', components: [] })
        return true
    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle('Embed Builder')
        const title = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(false)
        const url = new TextInputBuilder()
            .setCustomId('url')
            .setLabel('URL')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(false)
            .setPlaceholder('This sets a hyperlink for the title')
        const desc = new TextInputBuilder()
            .setCustomId('desc')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(4000)
            .setRequired(false)
        const image = new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(false)
        const color = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("#FFFFFF")
            .setMaxLength(7)
            .setMinLength(7)
            .setRequired(false)
        const ActionRow1 = new ActionRowBuilder().addComponents(title)
        const ActionRow2 = new ActionRowBuilder().addComponents(url)
        const ActionRow3 = new ActionRowBuilder().addComponents(desc)
        const ActionRow4 = new ActionRowBuilder().addComponents(image)
        const ActionRow5 = new ActionRowBuilder().addComponents(color)
        sponsorModal.addComponents(ActionRow1, ActionRow2, ActionRow3, ActionRow4, ActionRow5)
        await interaction.showModal(sponsorModal)
        return false
    }
}