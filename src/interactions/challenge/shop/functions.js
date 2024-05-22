const { EmbedBuilder } = require("discord.js")
const { big_number } = require("../../../generic")

exports.alreadyPurchased = function (interaction) {
    const already = new EmbedBuilder()
        .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again")
        .setDescription("You have already purchased this item. It cannot be purchased more than once.")
    interaction.reply({ embeds: [already], ephemeral: true })
    return
}

exports.optionLabel = function (o) {
    let price = o.price
    if (o.pricemap) {
        price = `📀${big_number(Math.min(...Object.values(o.price)))} - 📀${big_number(Math.max(...Object.values(o.price)))}`
    } else {
        price = `📀${big_number(o.price)}`
    }
    return `${o.label} (${price})`
}