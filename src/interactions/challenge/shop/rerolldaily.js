const { updateChallenge, dailyChallenge, dailyRerollCost, manageTruguts } = require('../functions.js');
const { editMessage } = require('../../../discord.js');
const { number_with_commas } = require('../../../generic.js');

const { EmbedBuilder } = require('discord.js');

exports.rerolldaily = async function ({ interaction, current_challenge, db, database, botto_name, user_profile, profile_ref } = {}) {
    //the daily can only be rerolled within two hours of being posted
    let last = current_challenge ?? Object.values(db.ch.challenges).filter(c => c.type == 'cotd' && !c.rerolled).sort((a, b) => a.created - b.created).pop()
    if (!last || last.type !== 'cotd' || last.rerolled || last.completed || last.created < Date.now() - 1000 * 60 * 60 * 2) {
        const tooLate = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> It's too late...")
            .setDescription("You can only reroll the random challenge of the day within 2 hours of its announcement.")
        interaction.reply({ embeds: [tooLate], ephemeral: true })
        return false
    }

    //cost starts at 1M and doubles with every reroll of the day
    const cost = dailyRerollCost(db)
    if (user_profile.truguts_earned - user_profile.truguts_spent < cost) {
        const noMoney = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
            .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll the Random Challenge of the Day.\n\nReroll cost: `📀" + number_with_commas(cost) + "`")
        interaction.reply({ embeds: [noMoney], ephemeral: true })
        return false
    }

    //do the reroll FIRST and charge only once it lands — a throw here must not
    //cost the user 1M+ truguts for a reroll that never happened
    await interaction.deferReply()
    try {
        last.rerolled = true
        //updateChallenge persists rerolled:true via current_challengeref.update()
        const pub_response = await updateChallenge({ client: interaction.client, current_challenge: last, current_challengeref: database.ref(`challenge/challenges/${last.message}`), interaction, db })
        editMessage(interaction.client, last.channel, last.message, pub_response)
    } catch (err) {
        last.rerolled = false
        console.error('[rerolldaily] reroll failed before charging:', err)
        const failed = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> The reroll sputtered out")
            .setDescription("Something went wrong and you were **not** charged. Try again.")
        interaction.editReply({ embeds: [failed] })
        return false
    }

    //charge the user — the reroll is now persisted
    manageTruguts({
        user_profile, profile_ref, transaction: 'w', amount: cost, purchase: {
            date: Date.now(),
            purchased_item: "rerolldaily",
            selection: "",
            cost: cost
        }
    })

    const announce = new EmbedBuilder()
        .setTitle(`🔄 ${botto_name} rerolled the Random Challenge of the Day!`)
        .setDescription("`-📀" + number_with_commas(cost) + "`")
    interaction.editReply({ embeds: [announce] })
    //post the replacement daily; if this throws, the minuteUpdater's own
    //dailyChallenge call re-posts it within a minute (the old cotd is already
    //persisted as rerolled, so it no longer counts as today's challenge)
    Promise.resolve(dailyChallenge({ client: interaction.client, db, challengesref: database.ref('challenge/challenges') })).catch(err => console.error('[rerolldaily] dailyChallenge failed (minuteUpdater will retry):', err))
    return true
}
