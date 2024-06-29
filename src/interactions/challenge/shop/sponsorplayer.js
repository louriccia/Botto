const { manageTruguts } = require('../functions.js');
const { number_with_commas } = require('../../../generic.js');


const { EmbedBuilder } = require('discord.js');

exports.sponsorplayer = async function ({ interaction, db, database, user_key, botto_name, selection } = {}) {
    let take = Number(selection[2][0])
    let sponsorplayer = selection[3][0]

    // self sponsor
    if (sponsorplayer == user_key) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> You what?!")
            .setDescription("You can't sponsor yourself!")
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return false
    }

    // already sponsored
    let sponsored = db.user[sponsorplayer]?.random
    if (sponsored?.sponsors && Object.values(sponsored.sponsors).filter(s => s.player == user_key && s.take == take).length) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again.")
            .setDescription(`You have already sponsored <@${db.user[sponsorplayer]?.discordID}>!`)
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return false
    }

    database.ref(`users/${sponsorplayer}/random/sponsors`).push({
        date: Date.now(),
        player: user_key,
        take: take
    })

    const quoteEmbed = new EmbedBuilder()
        .setTitle(":loudspeaker: Player Sponsorship")
        .setDescription(`${botto_name} is now sponsoring <@${db.user[sponsorplayer]?.discordID}>!\nSponsorship amount: \`📀${number_with_commas(Number(take) * 10000)}\``)
    interaction.reply({ embeds: [quoteEmbed] })
    return true
}