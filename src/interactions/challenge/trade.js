const { manageTruguts, currentTruguts, tradeEmbed, tradeComponents, availableItemsforTrade } = require('./functions.js');

const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.trade = async function ({ interaction, database, db, args, botto_name, user_key } = {}) {

    let trow = interaction.customId.split("_")[3]
    trow = Number(trow)
    let tselection = [0, 1, 2, 3, 4].map(i => {
        let val = interaction.message?.components[i]?.components[0]?.data?.options?.filter(o => o.default).map(o => o.value) ??
            (interaction.message?.components[i]?.components[0]?.data?.options ? '' : null)
        if (i == trow) {
            val = interaction.values
        }
        return (val)
    })


    let trade_id = interaction.message.id
    let trade = db.ch.trades[trade_id]
    let traders = Object.keys(trade.traders)
    let selected_item = interaction.values?.[0]

    if (!traders.includes(user_key)) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Get lost!")
            .setDescription("You are not a part of this trade.")
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }

    if (selected_item && !selected_item.includes('page_') && selected_item !== 'no') {
        let trade_player = traders[args[2]]
        let trade_items = trade.traders[trade_player].items ? Object.values(trade.traders[trade_player].items) : []
        if (trade_items.includes(selected_item)) {
            trade_items.splice(trade_items.indexOf(selected_item), 1)
        } else {
            trade_items.push(selected_item)
        }
        await database.ref(`challenge/trades/${trade_id}/traders/${trade_player}/items`).set(trade_items)
        traders.forEach(async trader => {
            await database.ref(`challenge/trades/${trade_id}/traders/${trader}`).update({ agreed: false })
        })
    } else if (args[2] == 'agree') {

        await database.ref(`challenge/trades/${trade_id}/traders/${user_key}`).update({ agreed: !trade.traders[user_key].agreed })
        trade.traders[user_key].agreed = !trade.traders[user_key].agreed
        if (!Object.values(trade.traders).map(t => t.agreed).includes(false)) {
            //re-validate on the live profiles before executing -- items may have been
            //scrapped, used, locked, or traded away and balances spent since selection
            let problems = []
            traders.forEach(trader => {
                let profile = db.user[trader].random
                let trader_name = db.user[trader].name
                let amount = Number(trade.traders[trader].truguts) || 0
                if (amount > 0 && (profile.truguts_earned - profile.truguts_spent) < amount) {
                    problems.push(`${trader_name} no longer has the offered truguts`)
                }
                if (trade.traders[trader].items) {
                    let tradable_keys = availableItemsforTrade({ user_profile: profile }).map(i => i.key)
                    Object.values(trade.traders[trader].items).forEach(key => {
                        if (!tradable_keys.includes(key)) {
                            problems.push(`${trader_name} can no longer trade one of the selected items`)
                        }
                    })
                }
            })
            if (problems.length) {
                //void the agreement so both parties re-confirm the adjusted offer
                traders.forEach(trader => {
                    trade.traders[trader].agreed = false
                })
                for (const trader of traders) {
                    await database.ref(`challenge/trades/${trade_id}/traders/${trader}`).update({ agreed: false })
                }
                interaction.update({ content: `⚠️ ${[...new Set(problems)].join('; ')}. Agreements were reset -- adjust the offer and agree again.`, embeds: [tradeEmbed({ trade, db })], components: [...tradeComponents({ trade, db, selection: tselection })] })
                return
            }
            //complete trade
            for (const trader of traders) {
                let opposite_trader = traders.filter(t => t !== trader)[0]
                if (trade.traders[trader].truguts) {
                    let trugut_trade = trade.traders[trader].truguts
                    manageTruguts({ user_profile: db.user[trader].random, profile_ref: database.ref(`users/${trader}/random`), transaction: 'w', amount: trugut_trade })
                    manageTruguts({ user_profile: db.user[opposite_trader].random, profile_ref: database.ref(`users/${opposite_trader}/random`), transaction: 'd', amount: trugut_trade })
                }
                if (trade.traders[trader].items) {
                    for (const key of Object.values(trade.traders[trader].items)) {
                        let item = db.user[trader].random.items[key]
                        if (!item) {
                            continue
                        }
                        if (!item.trades) {
                            item.trades = []
                        }
                        item.trades.push(trade_id)
                        await database.ref(`users/${opposite_trader}/random/items`).child(key).set(item)
                        await database.ref(`users/${trader}/random/items/${key}`).remove()
                    }
                }
            }
            await database.ref(`challenge/trades/${trade_id}`).update({ completed: true })
            trade.completed = true
            interaction.update({ embeds: [tradeEmbed({ trade, db })], components: [], content: "" })
            return
        }
    } else if (args[2] == 'truguts') {
        if (interaction.isModalSubmit()) {
            traders.forEach(async trader => {
                let amount = Number(interaction.fields.getTextInputValue(trader).replaceAll(",", ""))
                if (isNaN(amount)) {
                    amount = 0
                }
                let current_truguts = db.user[trader].random.truguts_earned - db.user[trader].random.truguts_spent
                if (current_truguts < 0) {
                    amount = 0
                } else if (current_truguts - amount < 0) {
                    amount = current_truguts
                }
                await database.ref(`challenge/trades/${trade_id}/traders/${trader}`).update({ truguts: Math.round(amount) })
            })
        } else {
            const trugutModal = new ModalBuilder()
                .setCustomId('challenge_random_trade_truguts')
                .setTitle('Trade Truguts')
            traders.forEach(trader => {
                const truguts = new TextInputBuilder()
                    .setCustomId(trader)
                    .setLabel(`Truguts from ${db.user[trader].random.name}`)
                    .setPlaceholder(`📀${currentTruguts(db.user[trader].random)}`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)

                if (trade.traders[trader].truguts) {
                    truguts.setValue(String(trade.traders[trader].truguts))
                }
                const ActionRow1 = new ActionRowBuilder().addComponents(truguts)
                trugutModal.addComponents(ActionRow1)
            })

            await interaction.showModal(trugutModal)
            return
        }
    } else if (args[2] == 'cancel') {
        database.ref(`challenge/trades/${trade_id}`).remove()
        interaction.update({ embeds: [], components: [], content: `*No money, no parts, no deal!*\nTrade offer was canceled by ${botto_name}` })
        return
    } else if (args[2] == 'reset') {
        traders.forEach(trader => {
            database.ref(`challenge/trades/${trade_id}/traders/${trader}`).update({ agreed: false, truguts: 0, items: '' })
        })
    }


    trade = db.ch.trades[trade_id]
    interaction.update({ embeds: [tradeEmbed({ trade, db })], components: [...tradeComponents({ trade, db, selection: tselection })] })
}