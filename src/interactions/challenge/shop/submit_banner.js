const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.submit_banner = async function ({ interaction, database, botto_name } = {}) {
    if (interaction.isModalSubmit()) {
        let url = interaction.fields.getTextInputValue('url')
        let desc = interaction.fields.getTextInputValue('desc')
        let source = interaction.fields.getTextInputValue('source')

        if (url.includes("discordapp.")) {
            interaction.reply({ content: "Your image url cannot be a discord link.\n[Discord CDN links are temporary](<https://www.bleepingcomputer.com/news/security/discord-will-switch-to-temporary-file-links-to-block-malware-delivery/>)", ephemeral: true })
            return false
        }

        database.ref(`challenge/banners`).push({
            url,
            desc,
            source,
            approved: false
        })
        const quoteEmbed = new EmbedBuilder()
            .setTitle(`${botto_name} submitted a 🚩 Banner!`)
            .setDescription(`${desc}\nCourtesy of: ${source}`)
            .setImage(url)
        interaction.reply({ embeds: [quoteEmbed] })
        return true
    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle(`Submit a Banner`)
        const url = new TextInputBuilder()
            .setCustomId('url')
            .setLabel("Image URL")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("This cannot be a Discord URL")
            .setRequired(true)
        const desc = new TextInputBuilder()
            .setCustomId('desc')
            .setMaxLength(200)
            .setLabel("Caption")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Caption this image")
            .setRequired(true)
        const source = new TextInputBuilder()
            .setCustomId('source')
            .setMaxLength(40)
            .setLabel("Source")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("What user or site provided this image?")
            .setRequired(true)
        const ActionRow1 = new ActionRowBuilder().addComponents(url)
        const ActionRow2 = new ActionRowBuilder().addComponents(desc)
        const ActionRow3 = new ActionRowBuilder().addComponents(source)
        sponsorModal.addComponents(ActionRow1, ActionRow2, ActionRow3)
        await interaction.showModal(sponsorModal)
        return false
    }
}