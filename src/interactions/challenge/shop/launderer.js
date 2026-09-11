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
        .setTitle("🧼 Somebody owes you a favour")
        .setDescription(`There is a clerk somewhere who keeps your name out of the wrong ledgers, and from now on the pit bosses hear about ${Math.round((1 - heat_tuning.MODIFIERS.launderer) * 100)}% less of what you get up to.\n\nAll heat from bribing is reduced by \`${Math.round((1 - heat_tuning.MODIFIERS.launderer) * 100)}%\`. It shaves rather than halves — truguts can make heat easier to carry, they can never buy it away.`)
    interaction.reply({ embeds: [bought], ephemeral: true })
    return true
}
