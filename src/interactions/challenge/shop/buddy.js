const { alreadyPurchased } = require('./functions');

const { EmbedBuilder } = require('discord.js');

exports.buddy = async function ({ interaction, user_profile, profile_ref } = {}) {
    if (user_profile.effects?.botto_buddy) {
        alreadyPurchased(interaction)
        return false
    }
    profile_ref.child('effects').update({ botto_buddy: true })
    const noTruguts = new EmbedBuilder()
        .setTitle("Botto is now your emoji buddy!")
        .setDescription("Botto will copy your reactions to messages. Try it out!")
    interaction.reply({ embeds: [noTruguts], ephemeral: true })
    return true
}