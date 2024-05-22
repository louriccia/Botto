const { alreadyPurchased } = require('./functions')
const { EmbedBuilder } = require('discord.js')

exports.rerolls = async function ({ interaction, user_profile, profile_ref } = {}) {
    if (user_profile.effects?.free_rerolls) {
        alreadyPurchased(interaction)
        return
    }
    profile_ref.child('effects').update({ free_rerolls: true })
    const noTruguts = new EmbedBuilder()
        .setTitle("🔄FREE REROLLS FOR LIFE!")
        .setDescription("You have the power to deny whatever challenge of your choosing at no charge. In a world of RNG you have unlocked the ultimate weapon: choice.")
    interaction.reply({ embeds: [noTruguts], ephemeral: true })
}