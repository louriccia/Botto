const { EmbedBuilder } = require('discord.js');
const { alreadyPurchased } = require('./functions');

exports.homing = async function ({ interaction, user_profile, profile_ref, selection } = {}) {
    let level = selection[2][0]
    if (user_profile.effects?.nav_computer?.[level]) {
        alreadyPurchased(interaction)
        return false
    }
    profile_ref.child('effects').child('nav_computer').child(level).set(true)
    const noTruguts = new EmbedBuilder()
        .setTitle("You upgraded your 🧭Nav Computer")
        .setDescription("New options are available to enable/disable in your settings.")
    interaction.reply({ embeds: [noTruguts], ephemeral: true })
    return true
}