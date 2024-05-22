const { updateChallenge, dailyChallenge } = require('../functions.js');
const { editMessage } = require('../../../discord.js');

const { EmbedBuilder } = require('discord.js');

exports.rerolldaily = async function ({ interaction, db, database, botto_name } = {}) {
    //check if there was a daily less than an hour ago
    let cotd = Object.values(db.ch.challenges).filter(c => c.type == 'cotd')
    let last = cotd.pop()
    let lastlast = cotd.pop()
    if (last.created < Date.now() - 1000 * 60 * 60) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> It's too late...")
            .setDescription("You can only reroll the random challenge of the day within 1 hour of its announcement.")
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return
    }
    if (lastlast.rerolled) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Don't let them send any transmissions")
            .setDescription("The current random challenge of the day has already been rerolled.")
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return
    }

    const noTruguts = new EmbedBuilder()
        .setTitle(`🔄 ${botto_name} rerolled the Random Challenge of the Day!`)
    interaction.reply({ embeds: [noTruguts] })
    last.rerolled = true
    const pub_response = await updateChallenge({ client: interaction.client, current_challenge: last, current_challengeref: database.ref(`challenge/challenges/${last.message}`), interaction, db })
    editMessage(interaction.client, last.channel, last.message, pub_response)
    dailyChallenge({ client: interaction.client, db, challengesref: database.ref('challenge/challenges') })
}