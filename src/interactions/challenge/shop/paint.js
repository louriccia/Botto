const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { alreadyPurchased } = require('./functions');

exports.paint = async function ({ interaction, database, member_id, user_key, user_profile } = {}) {
    const SWE1R_Guild = await interaction.client.guilds.cache.get(swe1r_guild)

    if (user_profile.roles?.custom) {
        alreadyPurchased(interaction)
        return false
    }

    if (interaction.isModalSubmit()) {
        let color = interaction.fields.getTextInputValue('color')

        function isValidHexCode(hexCode) {
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(hexCode);
        }

        if (!isValidHexCode(color)) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that color doesn't exist")
                .setDescription("Please enter a valid hex code `#FFFFFF`")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }

        let pos = await SWE1R_Guild.roles.cache.get('541297572401250316')
        const m = await SWE1R_Guild.members.cache.find(m => m.id == member_id)
        SWE1R_Guild.roles.create({ name: 'Trillion Trugut Tri-Coat', color: color, position: pos.position + 1 }).then(r => {
            m.roles.add(r)
            database.ref(`users/${user_key}/random/roles/custom`).set(r.id)
        })

        const quoteEmbed = new EmbedBuilder()
            .setTitle("🎨Trillion Trugut Tri-Coat")
            .setDescription(`<@${member_id}> just bought a custom role color for \`📀1,000,000,000,000\` Truguts!`)
            .setColor(color)
        interaction.reply({ embeds: [quoteEmbed] })
        return true
    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle('🎨Trillion Trugut Tri-Coat')
        const color = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color (Hex Code)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(7)
            .setMinLength(7)
            .setPlaceholder("#FFFFFF")
            .setRequired(true)
        const ActionRow1 = new ActionRowBuilder().addComponents(color)
        sponsorModal.addComponents(ActionRow1)
        await interaction.showModal(sponsorModal)
        return false
    }
}