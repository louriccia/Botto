const { manageTruguts, currentTruguts, shopEmbed, shopComponents, shopOptions } = require('./functions.js');
const { editMessage } = require('../../discord.js');
const { number_with_commas } = require('../../generic.js');
const { EmbedBuilder } = require('discord.js');
const { optionLabel } = require('./shop/functions.js');

exports.shop = async function ({ interaction, args, db, database, member_id, member_avatar, user_key, user_profile, profile_ref, botto_name } = {}) {
    const playerdata = db.user[user_key]

    const selection = [0, 1, 2, 3, 4].map(i => (i == interaction.customId?.split("_")[3] ? interaction.values : undefined) ?? interaction.message?.components[i]?.components[0]?.data?.options?.filter(o => o.default).map(o => o.value) ?? (interaction.message?.components[i]?.components[0]?.data?.options ? '' : null))

    const shoptions = shopOptions({ user_profile, selection, player: member_id, db, selection }).map(o => ({ ...o, label: optionLabel(o) })).sort((a, b) => (Array.isArray(a.price) ? a.price[0] : a.price) - (Array.isArray(b.price) ? b.price[0] : b.price))
    const shoption = shoptions.find(o => o.value == selection[1]?.[0])
    const price = shoption?.pricemap ? shoption.price[selection[2]?.[0]] : shoption?.price

    //just update the shop if not buying
    if (args[2] !== 'purchase') {
        if (interaction.isChatInputCommand()) {
            interaction.reply({ embeds: [shopEmbed({ shoptions, selection, user_profile })], components: shopComponents({ user_profile, selection, shoptions, purchased: false }) })
        } else {
            interaction.update({ embeds: [shopEmbed({ shoptions, selection, user_profile })], components: shopComponents({ user_profile, selection, shoptions, purchased: false }) })
        }
        return
    }

    //check if nitro booster
    let afterblasterperk = playerdata.discord?.roles &&
        Object.values(playerdata.discord.roles).includes("586060902453739530") &&
        ['shuffle_banner', 'roleicon'].includes(shoption.value)

    //can't afford
    if (((!user_profile.effects?.life_debt && user_profile.truguts_earned - user_profile.truguts_spent < price) || (user_profile.effects?.life_debt && user_profile.truguts_earned - user_profile.truguts_spent - price < -1000000)) || user_profile.truguts_earned - user_profile.truguts_spent < 0) {
        if (!afterblasterperk) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                .setDescription("*'No money, no parts, no deal!'*\nYou do not have enough truguts to buy the selected option.\nCost: `📀" + number_with_commas(price) + "`")
                .setFooter({ text: "Truguts: 📀" + currentTruguts(user_profile) })
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }
    }

    //process purchase
    let shop_purchase = shoption.value
    if (['protocol', 'suffer'].includes(shoption.value)) {
        shop_purchase = 'autobot'
    }
    const shop_purchase_function = require(`./shop/${shop_purchase}`)
    const successful_purchase = shop_purchase_function[shop_purchase]({ interaction, args, db, database, member_id, member_avatar, user_key, user_profile, profile_ref, botto_name, selection, shoption })

    //charge user
    if (!afterblasterperk && successful_purchase) {
        manageTruguts({
            user_profile, profile_ref, transaction: 'w', amount: price, purchase: {
                date: Date.now(),
                purchased_item: shoption.value,
                selection: shoption.pricemap ? selection[2]?.[0] ?? "" : "",
                cost: price
            }
        })
    }

    editMessage(interaction.client, interaction.channel.id, interaction.message.id, { embeds: [shopEmbed({ shoptions, selection, user_profile })], components: shopComponents({ user_profile, selection, shoptions }) })
}