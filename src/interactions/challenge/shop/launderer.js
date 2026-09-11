const { alreadyPurchased } = require('./functions');
const heat_tuning = require('../../../data/challenge/heat.js');

const { EmbedBuilder } = require('discord.js');

exports.launderer = function ({ interaction, user_profile, profile_ref } = {}) {
    if (user_profile.effects?.launderer) {
        alreadyPurchased(interaction)
        return false
    }
    profile_ref.child('effects').update({ launderer: true })
    const bought = new EmbedBuilder()
        .setTitle("🧼 Launderer")
        .setDescription(`All heat from bribing is now reduced by \`${Math.round((1 - heat_tuning.MODIFIERS.launderer) * 100)}%\`.`)
    interaction.reply({ embeds: [bought], ephemeral: true })
    return true
}
