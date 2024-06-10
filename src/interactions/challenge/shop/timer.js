const { alreadyPurchased } = require('./functions');
const { EmbedBuilder } = require('discord.js');

exports.timer = async function ({ interaction, database, user_key, user_profile } = {}) {
    if (user_profile.effects?.extended_timer) {
        alreadyPurchased(interaction)
        return false
    }
    await database.ref(`users/${user_key}/random/effects`).update({ extended_timer: true })
    const quoteEmbed = new EmbedBuilder()
        .setTitle("⏳Extended Timer")
        .setDescription(`You now have 30 minutes to complete personal random challenges!`)
    interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
    return true
}