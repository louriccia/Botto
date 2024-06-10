const { EmbedBuilder } = require('discord.js');
const { alreadyPurchased } = require('./functions');

exports.debt = async function ({ interaction, user_profile, profile_ref } = {}) {
    if (user_profile.effects?.life_debt) {
        alreadyPurchased(interaction)
        return false
    }
    profile_ref.child('effects').update({ life_debt: true })
    const noTruguts = new EmbedBuilder()
        .setTitle("💸Life Debt")
        .setDescription("You now have the power to buy things before you can afford them.")
    interaction.reply({ embeds: [noTruguts], ephemeral: true })
    return true
}