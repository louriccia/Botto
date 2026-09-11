const { heatValue, applyHeat, spiceRunCooldown, manageTruguts } = require('../functions.js');
const heat_tuning = require('../../../data/challenge/heat.js');
const { number_with_commas } = require('../../../generic.js');

const { EmbedBuilder } = require('discord.js');

//Spice Run: the one place heat converts back into truguts. Priced at 0 in the shop, so the
//router charges nothing and this pays out instead. Every gate is re-checked here rather
//than trusted from shopOptions -- a stale shop message can still deliver the press.
exports.spice = function ({ interaction, user_profile, profile_ref } = {}) {
    const refuse = (title, description) => {
        interaction.reply({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description)], ephemeral: true })
        return false
    }

    if (!user_profile.effects?.smuggling_routes) {
        return refuse("<:WhyNobodyBuy:589481340957753363> You don't know the routes",
            "Complete the **Sorts of Transports** Collection to unlock *Smuggling Routes*.")
    }
    const until = spiceRunCooldown(user_profile)
    if (until) {
        return refuse("<:WhyNobodyBuy:589481340957753363> Not so fast",
            `Your buyer is back <t:${Math.round(until / 1000)}:R>. One run per day.`)
    }
    const heat = heatValue(user_profile)
    if (heat < heat_tuning.SPICE_RUN.heat) {
        return refuse("<:WhyNobodyBuy:589481340957753363> Nothing to sell",
            `A spice run needs \`🔥${heat_tuning.SPICE_RUN.heat}\` heat. You have \`🔥${heat}\`.`)
    }

    applyHeat({ user_profile, profile_ref, amount: -heat_tuning.SPICE_RUN.heat })
    manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: heat_tuning.SPICE_RUN.truguts })
    profile_ref.child('effects').update({ spice_run: Date.now() })

    const done = new EmbedBuilder()
        .setTitle("🚛 Spice Run")
        .setDescription(`\`-🔥${heat_tuning.SPICE_RUN.heat}\` heat\n\`+📀${number_with_commas(heat_tuning.SPICE_RUN.truguts)}\`\n\nYour heat is now \`🔥${Math.max(0, heat - heat_tuning.SPICE_RUN.heat)}\`. Come back tomorrow.`)
    interaction.reply({ embeds: [done], ephemeral: true })
    //the shop charges `price` on a true return, and Spice Run is priced at 0
    return true
}
