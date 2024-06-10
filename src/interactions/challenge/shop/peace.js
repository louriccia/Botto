const { alreadyPurchased } = require('./functions');
const { EmbedBuilder } = require('discord.js');

exports.peace = async function ({ interaction, user_profile, profile_ref } = {}) {
    if (user_profile.effects?.peace_treaty) {
        alreadyPurchased(interaction)
        return false
    }
    profile_ref.child('effects').update({ peace_treaty: true })
    const noTruguts = new EmbedBuilder()
        .setTitle("🕊Peace Treaty")
        .setDescription("You can no longer sabotage nor be sabotaged.")
    interaction.reply({ embeds: [noTruguts], ephemeral: true })
    return true
}