const { initializeChallenge, sponsorComponents, sponsorEmbed } = require('../functions.js');
const { EmbedBuilder } = require('discord.js');

exports.sponsorchallenge = async function ({ interaction, db, database, member_id, member_avatar, user_key, user_profile, botto_name, selection } = {}) {
    let circuit = selection[2][0]

    let recent = null
    Object.keys(db.ch.sponsors).forEach(key => {
        if (db.ch.sponsors[key].sponsor?.member == interaction.user.id && (!recent || db.ch.sponsors[key].created > recent.date)) {
            recent = { date: db.ch.sponsors[key].created, key }
        }
    })

    //already sponsored today
    if (recent && Date.now() - 1000 * 60 * 60 * 23 < recent.date && interaction.message.id !== recent.key) {
        const cantSponsor = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Patience Viceroy, patience.")
            .setDescription("Sorry, you can only sponsor one challenge per day. You can sponsor your next challenge <t:" + Math.round((recent.date + 1000 * 60 * 60 * 23) / 1000) + ":R>")
        interaction.reply({ embeds: [cantSponsor], ephemeral: true })
        return false
    }

    //initialize challenge
    let sponsorchallenge = initializeChallenge({ user_profile, member_id, type: "private", name: botto_name, avatar: member_avatar, user: user_key, circuit: circuit, db, interaction })
    sponsorchallenge.type = 'open'
    sponsorchallenge.sponsor = sponsorchallenge.player
    delete sponsorchallenge.player

    //reveal challenge
    const sponsor = await interaction.reply({ embeds: [sponsorEmbed(sponsorchallenge, user_profile, db)], components: sponsorComponents(user_profile, circuit, 1), ephemeral: true, fetchReply: true })
    database.ref('challenge/sponsorships').child(sponsor.id).set(sponsorchallenge)
    return true
}