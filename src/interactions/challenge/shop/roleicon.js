const { emojimap } = require('../../../data/discord/emoji.js')

const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { swe1r_guild } = require('../../../data/discord/guild.js');



exports.roleicon = async function ({ interaction, database, member_id, user_key, user_profile } = {}) {

    const SWE1R_Guild = await interaction.client.guilds.cache.get(swe1r_guild)

    if (interaction.isModalSubmit()) {
        let emoji = interaction.fields.getTextInputValue('emoji')
        let emojikey = Object.keys(emojimap).find(key => key.toLowerCase() == emoji.toLowerCase())
        if (!emojikey) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Perhaps the archives are incomplete.")
                .setDescription("The emoji you entered could not be found in the database. Please double check its name and spelling. Only SWE1R emojis are eligible. Racer flag icons are free roles in <id:customize>")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }

        let role = await SWE1R_Guild.roles.cache.find(r => r.name == emojikey)
        if (user_profile.roles?.emoji && Object.values(user_profile.roles.emoji).map(r => r.id).includes(role?.id)) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again")
                .setDescription("You already own this emoji icon. You can equip or unequip in roles in **🎒 Inventory**")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }
        let pos = await SWE1R_Guild.roles.cache.get('1094292597478010880')
        let e = emojimap[emojikey].split(":")[2].replace(">", "")
        const m = await SWE1R_Guild.members.cache.find(m => m.id == member_id)
        if (user_profile?.roles?.emoji && interaction.guild.id == swe1r_guild) {
            Object.values(user_profile.roles.emoji).forEach(role => {
                Member.roles.remove(role.id)
            })
        }
        if (role) {
            m.roles.add(role)
            database.ref(`users/${user_key}/random/roles/emoji`).push({ id: role.id, emoji_id: e })
        } else {
            SWE1R_Guild.roles.create({ name: emojikey, icon: e, position: pos.position + 1 }).then(r => {
                m.roles.add(r)
                database.ref(`users/${user_key}/random/roles/emoji`).push({ id: r.id, emoji_id: e })
            })
        }

        const quoteEmbed = new EmbedBuilder()
            .setTitle("✨Emoji Role Icon")
            .setDescription(`You just bought an emoji role icon ${emojimap[emojikey]}! You can equip it from your inventory.`)
        interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle('Emoji Role Icon')
        const clue = new TextInputBuilder()
            .setCustomId('emoji')
            .setLabel('Emoji Name')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setPlaceholder("enter the name of a non-animated server emoji")
            .setRequired(true)
        const ActionRow1 = new ActionRowBuilder().addComponents(clue)
        sponsorModal.addComponents(ActionRow1)
        await interaction.showModal(sponsorModal)
        return
    }
    //

    // if (role) {
    //     console.log(role)
    // } else {
    //     SWE1R_Guild.roles.create({ name: 'role', position: 21 })
    // }
    //check if a role already exists
}