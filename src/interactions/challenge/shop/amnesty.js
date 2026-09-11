const { banishment } = require('../functions.js');
const { capitalize } = require('../../../generic.js');

const { EmbedBuilder } = require('discord.js');

//Amnesty: the paid way out of a banishment. The other way is to race the planet clean,
//handled in submit.js -- neither is strictly better, which is what keeps the harshest
//penalty in the system fair. The fine is charged by the shop router on a true return.
exports.amnesty = function ({ interaction, user_profile, profile_ref, botto_name } = {}) {
    const banished = banishment(user_profile)
    if (!banished) {
        const nothing = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Nobody's banished you")
            .setDescription("You are welcome everywhere, as far as anyone here knows.")
        interaction.reply({ embeds: [nothing], ephemeral: true })
        return false
    }
    //the record stores the display name; older ones fall back to the key
    const planet_name = banished.name ?? capitalize(banished.planet.replaceAll('_', ' '))
    profile_ref.child('banishment').remove()
    delete user_profile.banishment

    const paid = new EmbedBuilder()
        .setTitle(`🏡 ${planet_name} will have you back`)
        .setDescription(`${botto_name} settled up. The **${banished.title ?? 'citizen'}** role is theirs to wear again — equip it from your inventory.\n\nMoney talks, and it talked its way out of this one. Racing the planet clean would have cost nothing but time.`)
    interaction.reply({ embeds: [paid], ephemeral: true })
    return true
}
