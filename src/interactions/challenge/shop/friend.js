const { EmbedBuilder } = require('discord.js');
const { alreadyPurchased } = require('./functions');

exports.friend = async function ({ interaction, database, user_key, user_profile } = {}) {
    if (user_profile.effects?.friend_greed) {
        alreadyPurchased(interaction)
        return false
    }
    await database.ref(`users/${user_key}/random/effects`).update({ friend_greed: true })
    const quoteEmbed = new EmbedBuilder()
        .setTitle("💖Friend in Greed")
        .setDescription(`Botto will now treat you as his favorite customer when interacting with him in chat.`)
    interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
    return true
}