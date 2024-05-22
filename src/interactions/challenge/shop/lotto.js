const { getTrackName } = require('../../../generic.js');


const { EmbedBuilder } = require('discord.js');
const moment = require('moment');

exports.lotto = async function ({ interaction, db, database, member_avatar, botto_name, selection } = {}) {
    //check if user already has ticket
    let existing = (Object.values(db.ch.lotto).find(t => t.user == interaction.user.id && moment(t.date).tz('America/New_York').month() == moment().tz('America/New_York').month()) ?? null)
    if (existing) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> A Botto Lotto ticket you have. Impossible, to take on a second.")
            .setDescription(`You've already purchased a Botto Lotto ticket this month. Your lucky tracks are:\n${existing.tracks.map(t => getTrackName(t)).join("\n")}`)
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return
    }
    const ticket = {
        user: interaction.user.id,
        date: Date.now(),
        tracks: selection[2]
    }
    database.ref('challenge/lotto').push(ticket)
    const shuffleBuy = new EmbedBuilder()
        .setAuthor({ name: `${botto_name} purchased a 🎫 Botto Lotto Ticket!`, iconURL: member_avatar })
        .setDescription(`For the next monthly challenge, they're predicting the following tracks:\n${ticket.tracks.map(t => getTrackName(t)).join("\n")}`)
    interaction.reply({ embeds: [shuffleBuy] })
}