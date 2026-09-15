const { emojimap } = require('../../../data/discord/emoji.js')

const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { swe1r_guild } = require('../../../data/discord/guild.js');



exports.roleicon = async function ({ interaction, database, member_id, user_key, user_profile } = {}) {

    const SWE1R_Guild = await interaction.client.guilds.cache.get(swe1r_guild)

    if (interaction.isModalSubmit()) {
        let emoji = interaction.fields.getTextInputValue('emoji')
        let emojikey = Object.keys(emojimap).find(key => key.toLowerCase() == emoji.toLowerCase())

        //emoji not found
        if (!emojikey) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Perhaps the archives are incomplete.")
                .setDescription("The emoji you entered could not be found in the database. Please double check its name and spelling. Only SWE1R emojis are eligible. Racer flag icons are free roles in <id:customize>")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return false
        }

        //already owned
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
        //fetch rather than read the cache: a member this shard never saw speak isn't
        //in it, and the adds below have nothing to hang off when that happens
        const m = await SWE1R_Guild.members.fetch(member_id)
        //the icon just bought becomes the equipped one, so the rest come off first
        if (user_profile?.roles?.emoji && interaction.guild.id == swe1r_guild) {
            for (const role of Object.values(user_profile.roles.emoji)) {
                await m.roles.remove(role.id).catch(error => console.log(error))
            }
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
        return true
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
        return false
    }
    //

    // if (role) {
    //     console.log(role)
    // } else {
    //     SWE1R_Guild.roles.create({ name: 'role', position: 21 })
    // }
    //check if a role already exists
}