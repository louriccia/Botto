const { manageTruguts, randomChallengeItem, inventoryComponents, inventoryEmbed, Collections, collectionRewardEmbed, openCoffer, itemString, tradeEmbed, tradeComponents, availableItemsforScrap } = require('./functions.js');
const { postMessage, editMessage } = require('../../discord.js');
const { planets } = require('../../data/sw_racer/planet.js')
const { items } = require('../../data/challenge/item.js')

const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { number_with_commas } = require('../../generic.js');
const { swe1r_guild } = require('../../data/discord/guild.js');

exports.inventory = async function ({ interaction, user_profile, profile_ref, db, database, member_id, args, user_key, botto_name, member_avatar } = {}) {
    let row = interaction.customId?.split("_")[3] ?? 0
    row = Number(row)
    let iselection = [0, 1, 2, 3, 4].map(i => {
        let val = interaction.message?.components[i]?.components[0]?.data?.options?.filter(o => o.default).map(o => o.value) ??
            (interaction.message?.components[i]?.components[0]?.data?.options ? '' : null)
        if (i == row) {
            val = interaction.values
        }
        return (val)
    })

    function NoItems() {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> We have nothing of value. That's our problem.")
            .setDescription("You don't have the required item. Go do some challenges to earn items!")
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }

    const actionmap = {
        coffer: 'collectible_coffer',
        sabotage: 'sabotage_kit',
        boost: 'trugut_boost'
    }
    if (['coffer', 'sabotage', 'boost'].includes(args[2])) {
        if (!user_profile.items) {
            NoItems()
            return
        }
        let key = Object.keys(user_profile.items).find(key => user_profile.items[key].id == actionmap[args[2]] && !user_profile.items[key].used)
        if (!key) {
            NoItems()
            return
        }

        if (args[2] == 'coffer') {
            let new_items = openCoffer({ user_profile, db, member_id })
            await profile_ref.child('items').child(key).update({ used: Date.now() })
            new_items.forEach(async item => {
                let condensed = { coffer: key, date: Date.now(), id: item.id }
                if (item.upgrade) {
                    condensed = { ...condensed, upgrade: item.upgrade, health: item.health }
                }
                await profile_ref.child('items').push(condensed)
            })
            const congratsEmbed = new EmbedBuilder()
                .setAuthor({ name: botto_name + " opened a 🎁Collectible Coffer", iconURL: member_avatar })
                .addFields(...new_items.map(item => ({ name: itemString({ item, user_profile }), value: `\`📀${number_with_commas(item.value)}\` | ${item.description}` })))
            postMessage(interaction.client, interaction.channelId, { embeds: [congratsEmbed] })
            user_profile = db.user[user_key].random
            //collectionRewardUpdater({ user_profile, client, interaction, profile_ref, name, member_avatar })
        } else if (args[2] == 'sabotage') {
            let selected_player = iselection[3]?.[0]
            if (selected_player == user_key) {
                const noTruguts = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> You what?!")
                    .setDescription("You can't sabotage yourself!")
                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                return
            }
            if (user_profile.effects?.peace_treaty) {
                const noTruguts = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> My lord, is that legal?")
                    .setDescription("You have entered a peace treaty and cannot sabotage other players.")
                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                return
            }
            if (db.user[selected_player].random?.effects?.sabotage && Object.values(db.user[selected_player].random.effects.sabotage).find(u => u.player == user_key && !u.used)) {
                const noTruguts = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> You already have an active sabotage on this player.")
                    .setDescription("You can only have one active sabotage on a player. Wait for them to trigger your sabotage and you can hit them again... or sabotage someone else!")
                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                return
            }
            if (interaction.isModalSubmit()) {
                let mil = Number(interaction.fields.getTextInputValue('millisecond'))
                if (isNaN(mil)) {
                    const noTruguts = new EmbedBuilder()
                        .setTitle("<:WhyNobodyBuy:589481340957753363> That's no number")
                        .setDescription("Please submit a number 0-9")
                    interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    return
                }
                database.ref(`users/${selected_player}/random/effects/sabotage`).push({
                    player: user_key,
                    millisecond: mil,
                    used: false
                })
                profile_ref.child('items').child(key).update({ used: Date.now() })
                const sabotageEmbed = new EmbedBuilder()
                    .setTitle("💥 Sabotaged!")
                    .setDescription(`You have successfully set up a sabotage on <@${db.user[selected_player].discordID}>. When they submit a time ending in \`${mil}\`, you'll get ${user_profile.effects?.doubled_powers ? 'all' : 'half'} their winnings!`)
                interaction.reply({ embeds: [sabotageEmbed], ephemeral: true })
                user_profile = db.user[user_key].random
                editMessage(interaction.client, interaction.channelId, interaction.message.id, { embeds: [inventoryEmbed({ user_profile, selection: iselection, name: botto_name, member_avatar })], components: inventoryComponents({ user_profile, selection: iselection, db, interaction }) })
                return
            } else {
                const sponsorModal = new ModalBuilder()
                    .setCustomId('challenge_random_inventory_sabotage')
                    .setTitle('Sabotage')
                const millisecond = new TextInputBuilder()
                    .setCustomId('millisecond')
                    .setLabel('Millisecond')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(1)
                    .setRequired(true)
                const ActionRow1 = new ActionRowBuilder().addComponents(millisecond)
                sponsorModal.addComponents(ActionRow1)
                await interaction.showModal(sponsorModal)
                return
            }
        } else if (args[2] == 'boost') {
            if (user_profile.effects?.trugut_boost > Date.now() - 1000 * 60 * 60 * 24) {
                const noTruguts = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> Patience, Viceroy. Patience.")
                    .setDescription(`You already have an active ⚡Trugut Boost. It expires <t:${Math.round((user_profile.effects.trugut_boost + 1000 * 60 * 60 * 24) / 1000)}:R>\nNow do some challenges!`)
                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                return
            }
            profile_ref.child('items').child(key).update({ used: Date.now() })
            profile_ref.child('effects').update({ trugut_boost: Date.now() })
            const congratsEmbed = new EmbedBuilder()
                .setAuthor({ name: botto_name + " activated a ⚡Trugut Boost", iconURL: member_avatar })
                .setDescription(`They're earning ${user_profile.effects.doubled_powers ? '2×' : '1.5×'} Truguts for the next 24 hours!`)
            postMessage(interaction.client, interaction.channelId, { embeds: [congratsEmbed] })
            user_profile = db.user[user_key].random
        }
    }
    if (args[2] == 'scrap') {
        let scrappable = availableItemsforScrap({ user_profile })

        let key = iselection[2][0]
        let scrap_item = items.find(i => i.id == user_profile.items[key].id)
        if (scrap_item && scrappable.map(s => s.key).includes(key)) {
            const scrap = await profile_ref.child('items').push(
                {
                    id: 70,
                    date: Date.now()
                }
            )
            await profile_ref.child('items').child(key).update({ scrapped: scrap.key })
            manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: Math.round(scrap_item.value * (user_profile.effects?.efficient_scrapper ? 1 : 0.5) * (user_profile.items[key].health ? (user_profile.items[key].health / 255) : 1)) })
        }
    } else if (args[2] == 'sarlacc') {
        let scrap_key = iselection[2][0]
        if ([null, undefined, ''].includes(scrap_key)) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> It's something... elsewhere, elusive.")
                .setDescription("No item selected.")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }
        if (!user_profile.effects?.sarlacc_snack) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Take a seat")
                .setDescription("You do not have this ability yet.")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }
        if (Date.now() - 1000 * 60 * 60 * 24 < user_profile.effects?.sarlacc_fed) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Patience, Viceroy. Patience.")
                .setDescription(`The Sarlacc has already been fed today! Wait for it to be hungry again <t:${Math.round((user_profile.effects.sarlacc_fed + 1000 * 60 * 60 * 24) / 1000)}:R>`)
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }
        let feeditem = user_profile.items[scrap_key]
        profile_ref.child('effects').update({ sarlacc_fed: Date.now() })
        const sarlaccEmbed = new EmbedBuilder()
            .setAuthor({ name: botto_name + " fed the Sarlacc a " + itemString({ item: { ...items.find(i => i.id == feeditem.id), ...feeditem }, user_profile }), iconURL: member_avatar })
            .setImage('https://lumiere-a.akamaihd.net/v1/images/image_026c3344.gif')
        postMessage(interaction.client, interaction.channelId, { embeds: [sarlaccEmbed] })
        let new_item = randomChallengeItem({ user_profile, current_challenge: null, db, member_id, sarlacc: true })
        let push_item = {
            id: new_item.id,
            date: Date.now()
        }
        if (new_item.upgrade) {
            push_item.upgrade = new_item.upgrade
            push_item.health = new_item.health
        }
        const sarlacc = profile_ref.child('items').push(
            push_item
        )
        profile_ref.child('items').child(scrap_key).update({ fed: sarlacc.key })
        const itemEmbed = new EmbedBuilder()
            .setDescription('It burped up an item!')
            .addFields({ name: itemString({ item: new_item, user_profile }), value: new_item.description })
        setTimeout(async function () {
            postMessage(interaction.client, interaction.channelId, { embeds: [itemEmbed] })
        }, 2000)
    } else if (args[2] == 'trade') {
        let selected_player = iselection[2]?.[0]
        let selected_player_id = db.user[selected_player].discordID
        if (member_id == selected_player_id) {
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?")
                .setDescription("You cannot trade with yourself.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }
        let trade = {
            completed: false,
            traders: []
        }
        let traders = [user_key, selected_player].sort((a, b) => a.localeCompare(b))
        traders.forEach(key => {
            trade.traders[key] = {
                agreed: false,
                items: '',
                truguts: ''
            }
        })
        let tradereply = await interaction.reply({ content: `<@${selected_player_id}> ${botto_name} invites you to trade`, embeds: [tradeEmbed({ trade, db })], components: [...tradeComponents({ trade, db })], withResponse: true })
        const trademessage = tradereply.resource.message
        database.ref('challenge/trades').child(trademessage.id).set(trade)
        return
    } else if (args[2] == 'claim') {
        let selected_col = iselection[2][0]
        let collections = Collections()
        let selected_collection = collections[selected_col]
        let profile_items = Object.keys(user_profile.items).map(key => ({ ...user_profile.items[key], key }))
        selected_collection.items.forEach(async i => {
            let match = profile_items.find(j => j.id == i)
            await profile_ref.child('items').child(match.key).update({ locked: true })
        })
        await profile_ref.child('effects').child(selected_collection.key).set(true)
        postMessage(interaction.client, interaction.channelId, { embeds: [collectionRewardEmbed({ key: selected_collection.key, name: botto_name, member_avatar })] })
        if (planets.map(p => p.name.toLowerCase().replaceAll(" ", "_")).includes(selected_collection.key)) {
            manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: 100000 })
        }
    } else if (args[2] == 'name') {
        let selected_droid = iselection[2]?.[0]
        let droid = user_profile.items[selected_droid]
        if (interaction.isModalSubmit()) {
            let name = interaction.fields.getTextInputValue('name')

            await profile_ref.child('items').child(selected_droid).update({ nick: name })
        } else {
            const sponsorModal = new ModalBuilder()
                .setCustomId('challenge_random_inventory_name')
                .setTitle('Name')
            const name = new TextInputBuilder()
                .setCustomId('name')
                .setLabel(`Set a new name for your droid`)
                .setStyle(TextInputStyle.Short)
                .setMaxLength(20)
                .setRequired(true)
            if (droid.nick) {
                name.setValue(droid.nick)
            }
            const ActionRow1 = new ActionRowBuilder().addComponents(name)
            sponsorModal.addComponents(ActionRow1)
            await interaction.showModal(sponsorModal)
            return
        }
    } else if (args[2] == 'task') {
        let selected_droid = iselection[2]?.[0]
        let selected_part = iselection[3]?.[0]
        if ([null, undefined, ''].includes(selected_droid) || [null, undefined, ''].includes(selected_part)) {
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Mind tricks don't work on me!")
                .setDescription("No droid or part selected.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }
        await profile_ref.child('items').child(selected_droid).update({ repairing: true })
        let task = { part: selected_part, complete: false }
        if ((user_profile.items[selected_droid].tasks && Object.values(user_profile.items[selected_droid].tasks).filter(t => !t.complete).length == 0) || !user_profile.items[selected_droid].tasks) {
            task.date = Date.now()
        }
        await profile_ref.child('items').child(selected_droid).child('tasks').push(task)
        await profile_ref.child('items').child(selected_part).update({ repairing: true })

    } else if (args[2] == 'tricoat') {
        if (interaction.isModalSubmit()) {
            let color = interaction.fields.getTextInputValue('color')

            function isValidHexCode(hexCode) {
                const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                return hexRegex.test(hexCode);
            }

            if (!isValidHexCode(color)) {
                const noTruguts = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that color doesn't exist")
                    .setDescription("Please enter a valid hex code `#FFFFFF`")
                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                return
            }

            let role = await SWE1R_Guild.roles.cache.get(user_profile.roles.custom)
            role.edit({ color: color })

            const quoteEmbed = new EmbedBuilder()
                .setTitle("✨New Role Color")
                .setDescription(`You just changed your custom role color!`)
                .setColor(color)
            interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
            return
        } else {
            const sponsorModal = new ModalBuilder()
                .setCustomId('challenge_random_inventory_tricoat')
                .setTitle('New Role Color')
            const color = new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (Hex Code)')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(7)
                .setMinLength(7)
                .setPlaceholder("#FFFFFF")
                .setRequired(true)
            const ActionRow1 = new ActionRowBuilder().addComponents(color)
            sponsorModal.addComponents(ActionRow1)
            await interaction.showModal(sponsorModal)
            return
        }
    } else if (args[2] == 'icon') {
        if (user_profile?.roles?.emoji && interaction.guild.id == swe1r_guild) {
            Object.values(user_profile.roles.emoji).forEach(role => {
                if (interaction.values.includes(role.id)) {
                    Member.roles.add(role.id)
                } else {
                    Member.roles.remove(role.id)
                }
            })
        }
    }
    user_profile = db.user[user_key].random
    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [inventoryEmbed({ user_profile, selection: iselection, name: botto_name, member_avatar })], components: inventoryComponents({ user_profile, selection: iselection, db, interaction }) })

    } else {
        interaction.update({ embeds: [inventoryEmbed({ user_profile, selection: iselection, name: botto_name, member_avatar })], components: inventoryComponents({ user_profile, selection: iselection, db, interaction }) })

    }
}