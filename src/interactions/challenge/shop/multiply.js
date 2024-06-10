const { playerLevel } = require('../functions.js');
const { EmbedBuilder, } = require('discord.js');
const { alreadyPurchased } = require('./functions');

const levelmap = {
    2: 5,
    4: 10,
    6: 15,
    8: 20,
    10: 25
}

exports.multiply = async function ({ interaction, database, user_key, user_profile, selection } = {}) {
    const multiplier = Number(selection[2][0])
    if (!user_profile.progression) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Your midi-chlorian count is off the charts!")
            .setDescription(`Please open your profile to calculate your progression.`)
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return false
    }
    if (user_profile.effects?.trugut_cloner && Object.values(user_profile.effects.trugut_cloner).map(m => m.multiplier).includes(multiplier)) {
        alreadyPurchased(interaction)
        return false
    }
    const playerlevel = playerLevel(user_profile.progression).level

    const requiredlevel = levelmap[multiplier]
    if (playerlevel < requiredlevel) {
        const noTruguts = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Stay in that cockpit!")
            .setDescription(`You need to level up to purchase this item.\nCurrent level: ${playerlevel}\nRequired level: ${requiredlevel}`)
        interaction.reply({ embeds: [noTruguts], ephemeral: true })
        return false
    }
    database.ref(`users/${user_key}/random/effects/trugut_cloner`).push({
        date: Date.now(),
        multiplier: multiplier
    })

    const quoteEmbed = new EmbedBuilder()
        .setTitle("✖️Trugut Cloner")
        .setDescription(`You just purchased a ${multiplier}× Trugut Multiplier!`)
    interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
    return true
}