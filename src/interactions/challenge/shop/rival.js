const { EmbedBuilder } = require('discord.js');

exports.rival = async function ({ interaction, db, user_key, user_profile, profile_ref, botto_name, selection } = {}) {

    //select self
    if (selection[2] == user_key) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> You what?!")
            .setDescription("You can't be your own rival!")
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return false
    }

    //same rival as before
    if (user_profile.rival && Object.values(user_profile.rival).pop().player == db.user[selection[2]]?.discordID) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again.")
            .setDescription(`Your current rival is already <@${db.user[selection[2]]?.discordID}>`)
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return false
    }

    profile_ref.child('rival').push({
        player: db.user[selection[2]].discordID,
        date: Date.now()
    })
    const rivalEmbed = new EmbedBuilder()
        .setTitle("🆚 New Rivalry!")
        .setColor('#F4900C')
        .setDescription(`${botto_name}'s new rival is... <@${db.user[selection[2]].discordID}>! ${botto_name} will earn extra truguts for beating their best times.`)
    interaction.reply({ embeds: [rivalEmbed] })
    return true
}