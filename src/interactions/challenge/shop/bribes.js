const { alreadyPurchased } = require('./functions');

const { EmbedBuilder } = require('discord.js');

exports.bribes = async function ({ interaction, user_profile, profile_ref } = {}) {
    if (user_profile.effects?.free_bribes) {
        alreadyPurchased(interaction)
        return
    }
    profile_ref.child('effects').update({ free_bribes: true })
    const noTruguts = new EmbedBuilder()
        .setTitle("FREE BRIBES FOR LIFE!")
        .setDescription("You have the power to bribe whatever challenge of your choosing at no charge. In a world of RNG you have unlocked the ultimate weapon: choice.")
    interaction.reply({ embeds: [noTruguts], ephemeral: true })
}