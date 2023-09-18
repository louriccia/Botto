const { truguts, hints, settings_default, about, achievement_data, swe1r_guild } = require('./challenge/data.js');
const { getGoalTimes, initializeChallenge, initializePlayer, updateChallenge, bribeComponents, dailyChallenge, menuEmbed, menuComponents, playButton, notYoursEmbed, settingsEmbed, initializeUser, isActive, checkActive, expiredEmbed, challengeWinnings, getBest, goalTimeList, predictionScore, settingsComponents, achievementProgress, huntComponents, racerHint, trackHint, sponsorComponents, sponsorEmbed, validateTime, initializeBounty, bountyEmbed, manageTruguts, currentTruguts, predictionAchievement, sponsorAchievement, bountyAchievement, achievementEmbed, shopEmbed, shopComponents, profileComponents, profileEmbed, shopOptions, randomChallengeItem, inventoryComponents, inventoryEmbed, getStats, goalTimeRank, challengeProgression, playerLevel, convertLevel, progressionReward, collectionReward, Collections, collectionRewardEmbed, getUsables, openCoffer, itemString, collectionRewardUpdater, tradeEmbed, tradeComponents, availableItemsforScrap } = require('./challenge/functions.js');
const { postMessage, editMessage } = require('../discord_message.js');
const { tracks, circuits, banners, emojimap, planets } = require('../data.js')
const { items, raritysymbols, collections } = require('./challenge/items.js')
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const moment = require('moment');
require('moment-timezone')

module.exports = {
    name: 'challenge',
    async execute(client, interaction, args, database, db) {
        let member = interaction.user.id
        const Guild = interaction.guild
        const SWE1R_Guild = await client.guilds.cache.get("441839750555369474")
        const Member = interaction.member
        const name = interaction.member.displayName
        const avatar = await interaction.member.displayAvatarURL()
        var tools = require('./../tools.js');

        if (!database) {
            interaction.reply({ content: 'Impossible, the archives must be... down?', ephemeral: true })
            return
        }

        const challengetimeref = database.ref('challenge/times');
        const feedbackref = database.ref('challenge/feedback');
        const challengesref = database.ref('challenge/challenges');
        const userref = database.ref('users');
        const sponsorref = database.ref('challenge/sponsorships');
        const bountyref = database.ref('challenge/bounties');

        let player = Object.keys(db.user).find(key => db.user[key].discordID == member) ?? null
        if (!player) {
            player = await initializeUser(userref, member, name)
        }
        let playerdata = db.user[player]
        //initialize player if they don't exist
        let profile = playerdata.random
        if (!profile) {
            profile = initializePlayer(userref.child(player).child('random'), name)
        }

        let profileref = userref.child(player).child('random')
        let current_challenge = null
        let current_challengeref = null
        if (!interaction.isChatInputCommand() && args[1] !== 'play') {
            current_challengeref = challengesref.child(interaction.message.id)
            current_challenge = db.ch.challenges[interaction.message.id]
        }

        if (!current_challenge && ["submit", "modal", "like", "dislike", "reroll", "bribe", "predict", "undo"].includes(args[1])) {
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> If a challenge is not in our records, then it doesn't exist.")
                .setDescription(" There was an error when retrieving this challenge. It may be a duplicate or a failed post.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }

        if (profile.truguts_spent + profile.truguts_earned >= achievement_data.big_time_swindler.limit && current_challenge) { //award big-time swindler achievement
            if (current_challenge.guild == swe1r_guild) {
                if (!Member.roles.cache.some(r => r.id === achievement_data.big_time_swindler.role)) { //award role
                    Member.roles.add(achievement_data.big_time_swindler.role).catch(error => console.log(error))
                }
            }
            if (!profile.achievements.big_time_swindler) {
                postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(name, avatar, achievement_data.big_time_swindler, current_challenge.guild)] })
                profileref.child('achievements').child("big_time_swindler").set(true)
                profile = db.user[player]?.random
            }
        }

        if (args[0] == "random") {
            switch (args[1]) {
                case 'play':
                    if (interaction.guildId == '1135800421290627112') {
                        database.ref(`challenge/times`).orderByChild('time').equalTo("22.222").once("value", async function (snapshot) {
                            if (snapshot.exists()) {
                                let snap = snapshot.val()
                                Object.keys(snap).forEach(key => {
                                    if (['256236315144749059', '545799665862311971'].includes(snap[key].user)) {
                                        database.ref(`challenge/times/${key}`).remove()
                                    }
                                })
                            } else {
                                console.log('no user found')
                            }
                        }, function (errorObject) {
                            console.log(errorObject)
                            return null
                        });
                        database.ref(`challenge/challenges`).orderByChild('guild').equalTo('1135800421290627112').once("value", async function (snapshot) {
                            if (snapshot.exists()) {
                                let snap = snapshot.val()
                                console.log(Object.keys(snap))
                                Object.keys(snap).forEach(key => {
                                    database.ref(`challenge/challenges/${key}`).remove()
                                })
                            } else {
                                console.log('no user found')
                            }
                        }, function (errorObject) {
                            console.log(errorObject)
                            return null
                        });
                    }
                    //check if challenge already in progress FIXME change to reposting challenge
                    let activechallenge = checkActive(db, member, current_challenge)
                    if (activechallenge) {
                        interaction.reply({ embeds: [activechallenge], ephemeral: true })
                        return
                    }
                    let type = interaction.member.voice?.channel?.id == '441840193754890250' ? 'multiplayer' : 'private'
                    current_challenge = initializeChallenge({ profile, member, type, name, avatar, user: player, db, interaction })
                    const reply = await updateChallenge({ client, db, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction })
                    try {
                        let message = await interaction.reply(reply)
                        current_challenge.message = message.id
                        current_challenge.channel = interaction.message.channelId
                        current_challenge.guild = interaction.guildId
                        current_challenge.url = message.url
                        challengesref.child(message.id).set(current_challenge)
                        current_challenge = db.ch.challenges[message.id]
                        current_challengeref = challengesref.child(message.id)
                        setTimeout(async function () { //mark challenge abandoned
                            current_challenge = db.ch.challenges[message.id]
                            if (current_challenge && current_challenge?.type == 'private' && isActive(current_challenge, profile) && !current_challenge?.track_bribe && !current_challenge?.racer_bribe) {
                                const row = new ActionRowBuilder()
                                row.addComponents(
                                    new ButtonBuilder()
                                        .setCustomId("challenge_random_modal")
                                        .setLabel("Submit")
                                        .setStyle(ButtonStyle.Primary)
                                        .setEmoji("⏱️")
                                )
                                if (!current_challenge.completed && !current_challenge.rerolled) {
                                    current_challengeref.update({ type: 'abandoned', players: [], predictions: [] })
                                    current_challenge = db.ch.challenges[message.id]
                                }
                                const aba_response = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                                interaction.editReply(aba_response)
                            }
                        }, 1000 * 60 * 15 - 50000)
                    } catch (err) {
                        console.log('there was an error when posting the challenge', err)
                    }



                    break
                case 'reroll':
                    if (!isActive(current_challenge, profile)) { //expired challeneg
                        interaction.reply({ embeds: [expiredEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
                        return
                    }
                    if (!(current_challenge.player?.member == interaction.user.id && current_challenge.type == 'private' && isActive(current_challenge, profile))) { //not the right player or not active
                        interaction.reply({ embeds: [notYoursEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
                        return
                    }
                    let cost = 0
                    if (current_challenge.reroll_cost == "full price") {
                        cost = truguts.reroll
                    } else if (current_challenge.reroll_cost == "discount") {
                        cost = truguts.reroll_discount
                    }
                    if (profile.truguts_earned - profile.truguts_spent < cost) { //player doesn't have enough truguts to reroll
                        let noMoney = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nReroll cost: `📀" + tools.numberWithCommas(truguts.reroll) + "`")
                        interaction.reply({ embeds: [noMoney], ephemeral: true })
                        return
                    }
                    //process purchase
                    if (cost) {

                        //profileref.update({ truguts_spent: profile.truguts_spent + cost })
                        profile = manageTruguts({
                            profile, profileref, transaction: 'w', amount: cost, purchase: {
                                date: Date.now(),
                                purchased_item: "reroll",
                                selection: cost == truguts.reroll ? "full price" : "discount"
                            }
                        })
                    }

                    //award sponsorship cut
                    if (current_challenge.sponsors) {
                        Object.values(current_challenge.sponsors).forEach(sponsor => {
                            let sponsor_earnings = cost
                            let thissponsorref = userref.child(sponsor.user).child("random")
                            let thissponsor = db.user[sponsor.user].random
                            manageTruguts({ profile: thissponsor, profileref: thissponsorref, transaction: 'd', amount: sponsor_earnings })
                            current_challengeref.child('sponsors').child(sponsor.member).child('earnings').set((current_challenge.sponsors?.[sponsor.member]?.earnings ?? 0) + sponsor_earnings)
                        })
                    }

                    //clean up old challenge
                    challengesref.child(interaction.message.id).update({ completed: true, rerolled: true })
                    current_challenge = db.ch.challenges[interaction.message.id]
                    const edit_message = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                    editMessage(client, interaction.channel.id, interaction.message.id, edit_message)

                    //prepare new challenge
                    let rerolltype = 'private'
                    current_challenge = initializeChallenge({ profile, member, type: rerolltype, name, avatar, user: player, db, interaction })
                    const reroll_reply = await updateChallenge({ client, profile, current_challenge, profileref, member, name, avatar, interaction, db })
                    let rerollmessage = await interaction.reply(reroll_reply)
                    current_challenge.message = rerollmessage.id
                    current_challenge.channel = interaction.message.channelId
                    current_challenge.guild = interaction.guildId
                    current_challenge.url = rerollmessage.url
                    challengesref.child(rerollmessage.id).set(current_challenge)
                    break
                case 'bribe':
                    if (!isActive(current_challenge)) { //expired challeneg
                        interaction.reply({ embeds: [expiredEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
                        return
                    }
                    if (interaction.user.id !== current_challenge.player.member) { //not your challenge
                        interaction.reply({ embeds: [notYoursEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
                        return
                    }
                    let bribed = false
                    if (interaction.isStringSelectMenu()) {
                        let selection = Number(interaction.values[0])
                        let purchase = {
                            date: Date.now(),
                            selection: selection
                        }
                        let bribe_cost = 0
                        if (args[2] == "track") {
                            bribe_cost = truguts.bribe_track
                            purchase.purchased_item = "track bribe"
                        } else if (args[2] == "racer") {
                            bribe_cost = truguts.bribe_racer
                            purchase.purchased_item = "racer bribe"
                        }

                        if (profile.truguts_earned - profile.truguts_spent < bribe_cost) { //can't afford bribe
                            let noMoney = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nBribe cost: `" + tools.numberWithCommas(bribe_cost) + "`")
                            interaction.reply({ embeds: [noMoney], ephemeral: true })
                            return
                        }

                        //process purchase

                        if (args[2] == "track" && selection !== current_challenge.track) {
                            current_challengeref.update({ track_bribe: true, track: selection, predictions: {}, created: Date.now() })
                            bribed = true
                            if (!tracks[selection].parskiptimes) {
                                current_challengeref.update({ skips: false })
                            }
                        } else if (args[2] == "racer" && selection !== current_challenge.racer) {
                            current_challengeref.update({ racer_bribe: true, racer: selection, predictions: {}, created: Date.now() })
                            bribed = true
                        }
                        if (bribed) {
                            manageTruguts({ profile, profileref, transaction: 'w', amount: bribe_cost, purchase })
                        }
                    }

                    current_challenge = db.ch.challenges[current_challenge.message]
                    //populate options
                    let adata = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                    if (!bribed) {
                        adata.components = [adata.components, bribeComponents(current_challenge)].flat()
                    }
                    interaction.update(adata)

                    break
                case 'predict':
                    if (!isActive(current_challenge, profile)) { //no longer active
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Bet you didn't predict that!")
                            .setDescription("Predictions are no longer available for this challenge.")
                        interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }
                    if (interaction.isModalSubmit()) {
                        let predictiontime = interaction.fields.getTextInputValue('predictionTime')
                        if (isNaN(Number(predictiontime.replace(":", ""))) || tools.timetoSeconds(predictiontime) == null) { //incorrect time format
                            const holdUp = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
                                .setDescription("Your time was submitted in an incorrect format.")
                            interaction.reply({ embeds: [holdUp], ephemeral: true })
                            return
                        }
                        let time = tools.timetoSeconds(predictiontime)
                        //log time 
                        let predictiondata = {
                            member: member,
                            name: name,
                            time: time,
                            user: player
                        }
                        await current_challengeref.child("predictions").child(member).set(predictiondata);
                        let playeruser = current_challenge.player.user
                        current_challenge = db.ch.challenges[interaction.message.id]
                        const pd_response = await updateChallenge({ client, profile: db.user?.[playeruser]?.random, current_challenge, current_challengeref, profileref: userref.child(playeruser).child('random'), member, name, avatar, interaction, db })
                        interaction.update(pd_response)
                    } else {
                        if (current_challenge.player && current_challenge.player.member == member) { //trying to predict own challenge
                            const holdUp = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> The dark side of the force clouds your ability to see the future.")
                                .setDescription("You cannot make a prediction on your own challenge.")
                            interaction.reply({ embeds: [holdUp], ephemeral: true })
                            return
                        }
                        if (current_challenge.predictions && current_challenge.predictions[member]) { //already made a prediction
                            const holdUp = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Prediction Failed")
                                .setDescription("You cannot make more than one prediction on a challenge.")
                            interaction.reply({ embeds: [holdUp], ephemeral: true })
                            return
                        }
                        const predictionModal = new ModalBuilder()
                            .setCustomId('challenge_random_predict')
                            .setTitle('Submit Prediction')
                        const submissionTime = new TextInputBuilder()
                            .setCustomId('predictionTime')
                            .setLabel('Prediction')
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(9)
                            .setMinLength(6)
                            .setPlaceholder("--:--.---")
                            .setRequired(true)
                        const ActionRow1 = new ActionRowBuilder().addComponents(submissionTime)
                        predictionModal.addComponents(ActionRow1)
                        await interaction.showModal(predictionModal)
                    }
                    break
                case 'like':
                case 'dislike':
                    if (!Object.keys(current_challenge.submissions).includes(interaction.user.id)) {
                        const noMoney = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> How can you do this??")
                            .setDescription("You cannot rate a challenge you haven't done.")
                        interaction.reply({
                            embeds: [noMoney],
                            ephemeral: true
                        })
                        return
                    }
                    if (current_challenge.ratings && Object.keys(current_challenge.ratings).includes(interaction.user.id)) {
                        const noMoney = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Back again, huh?")
                            .setDescription("You already rated this challenge.")
                        interaction.reply({
                            embeds: [noMoney],
                            ephemeral: true
                        })
                        return
                    }
                    await current_challengeref.child('ratings').child(interaction.user.id).set({ user: player })
                    await current_challengeref.child('earnings').child(interaction.user.id).update({ truguts_earned: current_challenge.earnings[interaction.user.id].truguts_earned + truguts.rated })

                    //profileref.update({ truguts_earned: profile.truguts_earned + truguts.rated })
                    profile = manageTruguts({ profile, profileref, transaction: 'd', amount: truguts.rated * (profile.effects?.vote_confidence ? 2 : 1) })

                    feedbackref.push({
                        user: member,
                        feedback: args[1] == "dislike" ? "👎" : '👍',
                        date: current_challenge.created,
                        racer: current_challenge.racer,
                        track: current_challenge.track,
                        conditions: {
                            laps: current_challenge.conditions.laps,
                            nu: current_challenge.conditions.nu,
                            skips: current_challenge.conditions.skips,
                            mirror: current_challenge.conditions.mirror,
                            backwards: current_challenge.conditions.backwards
                        }
                    });
                    current_challenge = db.ch.challenges[interaction.message.id]
                    const feedback_reply = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                    interaction.update(feedback_reply)

                    break
                case 'menu':
                    if (interaction.isChatInputCommand()) {
                        interaction.reply({ embeds: [menuEmbed({ db })], components: menuComponents() })
                    } else {
                        interaction.update({ embeds: [menuEmbed({ db })], components: menuComponents() })
                    }
                    break
                case 'inventory':
                    let row = interaction.customId.split("_")[3]
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
                        if (!profile.items) {
                            NoItems()
                            return
                        }
                        let key = Object.keys(profile.items).find(key => profile.items[key].id == actionmap[args[2]] && !profile.items[key].used)
                        if (!key) {
                            NoItems()
                            return
                        }

                        if (args[2] == 'coffer') {
                            let new_items = openCoffer({ profile, db, member })
                            await profileref.child('items').child(key).update({ used: Date.now() })
                            new_items.forEach(async item => {
                                let condensed = { coffer: key, date: Date.now(), id: item.id }
                                if (item.upgrade) {
                                    condensed = { ...condensed, upgrade: item.upgrade, health: item.health }
                                }
                                await profileref.child('items').push(condensed)
                            })
                            const congratsEmbed = new EmbedBuilder()
                                .setAuthor({ name: name + " opened a 🎁Collectible Coffer", iconURL: avatar })
                                .addFields(...new_items.map(item => ({ name: itemString({ item, profile }), value: `\`📀${tools.numberWithCommas(item.value)}\` | ${item.description}` })))
                            postMessage(client, interaction.channelId, { embeds: [congratsEmbed] })
                            profile = db.user[player].random
                            collectionRewardUpdater({ profile, client, interaction, profileref, name, avatar })
                        } else if (args[2] == 'sabotage') {
                            let selected_player = iselection[3]?.[0]
                            if (selected_player == player) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> You what?!")
                                    .setDescription("You can't sabotage yourself!")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }
                            if (profile.effects?.peace_treaty) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> My lord, is that legal?")
                                    .setDescription("You have entered a peace treaty and cannot sabotage other players.")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }
                            if (db.user[selected_player].random?.effects?.sabotage && Object.values(db.user[selected_player].random.effects.sabotage).find(u => u.player == player && !u.used)) {
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
                                    player: player,
                                    millisecond: mil,
                                    used: false
                                })
                                profileref.child('items').child(key).update({ used: Date.now() })
                                const sabotageEmbed = new EmbedBuilder()
                                    .setTitle("💥 Sabotaged!")
                                    .setDescription(`You have successfully set up a sabotage on <@${db.user[selected_player].discordID}>. When they submit a time ending in \`${mil}\`, you'll get ${profile.effects?.doubled_powers ? 'all' : 'half'} their winnings!`)
                                interaction.reply({ embeds: [sabotageEmbed], ephemeral: true })
                                profile = db.user[player].random
                                editMessage(client, interaction.channelId, interaction.message.id, { embeds: [inventoryEmbed({ profile, selection: iselection, name, avatar })], components: inventoryComponents({ profile, selection: iselection, db, interaction }) })
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
                            if (profile.effects?.trugut_boost > Date.now() - 1000 * 60 * 60 * 24) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Patience, Viceroy. Patience.")
                                    .setDescription(`You already have an active ⚡Trugut Boost. It expires <t:${Math.round((profile.effects.trugut_boost + 1000 * 60 * 60 * 24) / 1000)}:R>\nNow do some challenges!`)
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }
                            profileref.child('items').child(key).update({ used: Date.now() })
                            profileref.child('effects').update({ trugut_boost: Date.now() })
                            const congratsEmbed = new EmbedBuilder()
                                .setAuthor({ name: name + " activated a ⚡Trugut Boost", iconURL: avatar })
                                .setDescription(`They're earning ${profile.effects.doubled_powers ? '2×' : '1.5×'} Truguts for the next 24 hours!`)
                            postMessage(client, interaction.channelId, { embeds: [congratsEmbed] })
                            profile = db.user[player].random
                        }
                    }
                    if (args[2] == 'scrap') {
                        let scrappable = availableItemsforScrap({ profile })

                        let key = iselection[2][0]
                        let scrap_item = items.find(i => i.id == profile.items[key].id)
                        if (scrap_item && scrappable.map(s => s.key).includes(key)) {
                            const scrap = await profileref.child('items').push(
                                {
                                    id: 70,
                                    date: Date.now()
                                }
                            )
                            await profileref.child('items').child(key).update({ scrapped: scrap.key })
                            manageTruguts({ profile, profileref, transaction: 'd', amount: Math.round(scrap_item.value * (profile.effects?.efficient_scrapper ? 1 : 0.5) * (profile.items[key].health ? (profile.items[key].health / 255) : 1)) })
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
                        if (!profile.effects?.sarlacc_snack) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Take a seat")
                                .setDescription("You do not have this ability yet.")
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        if (Date.now() - 1000 * 60 * 60 * 24 < profile.effects?.sarlacc_fed) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Patience, Viceroy. Patience.")
                                .setDescription(`The Sarlacc has already been fed today! Wait for it to be hungry again <t:${Math.round((profile.effects.sarlacc_fed + 1000 * 60 * 60 * 24) / 1000)}:R>`)
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        let feeditem = profile.items[scrap_key]
                        profileref.child('effects').update({ sarlacc_fed: Date.now() })
                        const sarlaccEmbed = new EmbedBuilder()
                            .setAuthor({ name: name + " fed the Sarlacc a " + itemString({ item: { ...items.find(i => i.id == feeditem.id), ...feeditem }, profile }), iconURL: avatar })
                            .setImage('https://lumiere-a.akamaihd.net/v1/images/image_026c3344.gif')
                        postMessage(client, interaction.channelId, { embeds: [sarlaccEmbed] })
                        let new_item = randomChallengeItem({ profile, current_challenge: null, db, member, sarlacc: true })
                        let push_item = {
                            id: new_item.id,
                            date: Date.now()
                        }
                        if (new_item.upgrade) {
                            push_item.upgrade = new_item.upgrade
                            push_item.health = new_item.health
                        }
                        const sarlacc = profileref.child('items').push(
                            push_item
                        )
                        profileref.child('items').child(scrap_key).update({ fed: sarlacc.key })
                        const itemEmbed = new EmbedBuilder()
                            .setDescription('It burped up an item!')
                            .addFields({ name: itemString({ item: new_item, profile }), value: new_item.description })
                        setTimeout(async function () {
                            postMessage(client, interaction.channelId, { embeds: [itemEmbed] })
                        }, 2000)
                    } else if (args[2] == 'trade') {
                        let selected_player = iselection[2]?.[0]
                        let selected_player_id = db.user[selected_player].discordID
                        if (member == selected_player_id) {
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
                        let traders = [player, selected_player].sort((a, b) => a.localeCompare(b))
                        traders.forEach(key => {
                            trade.traders[key] = {
                                agreed: false,
                                items: '',
                                truguts: ''
                            }
                        })
                        let trademessage = await interaction.reply({ content: `<@${selected_player_id}> ${name} invites you to trade`, embeds: [tradeEmbed({ trade, db })], components: [...tradeComponents({ trade, db })], fetchReply: true })
                        database.ref('challenge/trades').child(trademessage.id).set(trade)
                        return
                    } else if (args[2] == 'claim') {
                        let selected_col = iselection[2][0]
                        let collections = Collections()
                        let selected_collection = collections[selected_col]
                        let profile_items = Object.keys(profile.items).map(key => ({ ...profile.items[key], key }))
                        selected_collection.items.forEach(async i => {
                            let match = profile_items.find(j => j.id == i)
                            await profileref.child('items').child(match.key).update({ locked: true })
                        })
                        await profileref.child('effects').child(selected_collection.key).set(true)
                        postMessage(client, interaction.channelId, { embeds: [collectionRewardEmbed({ key: selected_collection.key, name, avatar })] })
                        if (planets.map(p => p.name.toLowerCase().replaceAll(" ", "_")).includes(selected_collection.key)) {
                            manageTruguts({ profile, profileref, transaction: 'd', amount: 100000 })
                        }
                    } else if (args[2] == 'name') {
                        let selected_droid = iselection[2]?.[0]
                        let droid = profile.items[selected_droid]
                        if (interaction.isModalSubmit()) {
                            let name = interaction.fields.getTextInputValue('name')

                            await profileref.child('items').child(selected_droid).update({ nick: name })
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
                        await profileref.child('items').child(selected_droid).update({ repairing: true })
                        let task = { part: selected_part, complete: false }
                        if ((profile.items[selected_droid].tasks && Object.values(profile.items[selected_droid].tasks).filter(t => !t.complete).length == 0) || !profile.items[selected_droid].tasks) {
                            task.date = Date.now()
                        }
                        await profileref.child('items').child(selected_droid).child('tasks').push(task)
                        await profileref.child('items').child(selected_part).update({ repairing: true })

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

                            let role = await SWE1R_Guild.roles.cache.get(profile.roles.custom)
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
                    }
                    profile = db.user[player].random
                    interaction.update({ embeds: [inventoryEmbed({ profile, selection: iselection, name, avatar })], components: inventoryComponents({ profile, selection: iselection, db, interaction }) })
                    break
                case 'shop':
                    const selection = [0, 1, 2, 3, 4].map(i => (i == interaction.customId.split("_")[3] ? interaction.values : undefined) ?? interaction.message?.components[i]?.components[0]?.data?.options?.filter(o => o.default).map(o => o.value) ?? (interaction.message?.components[i]?.components[0]?.data?.options ? '' : null))
                    function optionLabel(o) {
                        let price = o.price
                        if (o.pricemap) {
                            price = `📀${tools.numberWithCommas(Math.min(...Object.values(o.price)))} - 📀${tools.numberWithCommas(Math.max(...Object.values(o.price)))}`
                        } else {
                            price = `📀${tools.numberWithCommas(o.price)}`
                        }
                        return `${o.label} (${price})`
                    }
                    const shoptions = shopOptions({ profile, selection, player: member, db, selection }).map(o => ({ ...o, label: optionLabel(o) })).sort((a, b) => (Array.isArray(a.price) ? a.price[0] : a.price) - (Array.isArray(b.price) ? b.price[0] : b.price))
                    const shoption = shoptions.find(o => o.value == selection[1]?.[0])
                    const price = shoption?.pricemap ? shoption.price[selection[2]?.[0]] : shoption?.price
                    if (args[2] !== 'purchase') {
                        interaction.update({ embeds: [shopEmbed({ shoptions, selection, profile })], components: shopComponents({ profile, selection, shoptions, purchased: false }) })
                        return
                    }

                    //can't afford
                    if (((!profile.effects?.life_debt && profile.truguts_earned - profile.truguts_spent < price) || (profile.effects?.life_debt && profile.truguts_earned - profile.truguts_spent - price < -1000000)) || profile.truguts_earned - profile.truguts_spent < 0) {
                        const noTruguts = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no parts, no deal!'*\nYou do not have enough truguts to buy the selected option.\nCost: `📀" + tools.numberWithCommas(price) + "`")
                            .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                        return
                    }

                    function alreadyPurchased(interaction) {
                        const already = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again")
                            .setDescription("You have already purchased this item. It cannot be purchased more than once.")
                        interaction.reply({ embeds: [already], ephemeral: true })
                        return
                    }

                    if (shoption.value == 'hint') {
                        //get achievement progress
                        let achievements = achievementProgress({ db, player: member })
                        let achievement = selection[3][0]
                        const hintmap = {
                            'basic': 0,
                            'standard': 1,
                            'deluxe': 2,
                        }
                        let hint = Number(hintmap[selection[2][0]]) + (profile.effects?.movie_buff ? 1 : 0)
                        const hintBuy = new EmbedBuilder()
                            .setColor("#ED4245")
                        //figure out missing
                        for (let j = 0; j < 25; j++) {
                            if (j < 23) {
                                if (!Object.keys(achievements.pod_champ.collection).map(c => Number(c)).includes(j) && j < 23) {
                                    achievements.pod_champ.missing.push(j)
                                }
                                if (!Object.keys(achievements.slow_steady.collection).map(c => Number(c)).includes(j) && j < 23) {
                                    achievements.slow_steady.missing.push(j)
                                }
                            }
                            if (!Object.keys(achievements.galaxy_famous.collection).map(c => Number(c)).includes(j)) {
                                achievements.galaxy_famous.missing.push(j)
                            }
                            if (!Object.keys(achievements.light_skipper.collection).map(c => Number(c)).includes(j) && tracks[j].hasOwnProperty("parskiptimes")) {
                                achievements.light_skipper.missing.push(j)
                            }
                            if (!Object.keys(achievements.mirror_dimension.collection).map(c => Number(c)).includes(j)) {
                                achievements.mirror_dimension.missing.push(j)
                            }
                            if (!Object.keys(achievements.crowd_favorite.collection).map(c => Number(c)).includes(j)) {
                                achievements.crowd_favorite.missing.push(j)
                            }
                            if (!Object.keys(achievements.backwards_compatible.collection).map(c => Number(c)).includes(j)) {
                                achievements.backwards_compatible.missing.push(j)
                            }
                            for (let l = 0; l < 23; l++) {
                                if (!Object.keys(achievements.true_jedi.collection).includes(j + " " + l)) {
                                    achievements.true_jedi.missing.push(j + "," + l)
                                }
                            }
                        }
                        //get random missing challenge
                        let racer = null, track = null
                        if (["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", 'backwards_compatible'].includes(achievement)) {
                            track = achievements[achievement].missing[Math.floor(Math.random() * achievements[achievement].missing.length)]
                            if (achievement == "crowd_favorite") {
                                racer = tracks[track].favorite
                            }
                        }
                        if (["pod_champ", "slow_steady"].includes(achievement)) {
                            racer = achievements[achievement].missing[Math.floor(Math.random() * achievements[achievement].missing.length)]
                        }
                        if (achievement == "true_jedi") {
                            let random = achievements.true_jedi.missing[Math.floor(Math.random() * achievements.true_jedi.missing.length)]
                            random = random.split(",")
                            track = random[0]
                            racer = random[1]
                        }
                        if ((["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", "true_jedi", 'backwards_compatible'].includes(achievement) && track == null) || (["pod_champ", "slow_steady", "true_jedi"].includes(achievement) && racer == null)) {
                            //player already has achievement
                            hintBuy.setDescription("You already have this achievement and do not require a hint. You have not been charged. \n\nAlready have all the achievements? Try a Challenge Bounty!")
                        } else {
                            //prepare hint
                            if (track) {
                                hintBuy.addFields({ name: "Track Hint", value: trackHint({ track, count: Number(hint), db }).map(h => "○ *" + h + "*").join("\n") })
                            }
                            if (racer) {
                                hintBuy.addFields({ name: "Racer Hint", value: racerHint({ racer, count: Number(hint), db }).map(h => "○ *" + h + "*").join("\n") })
                            }
                            // process purchase

                            hintBuy.setDescription("`-📀" + tools.numberWithCommas(hints[hint].price) + "`")
                            //profileref.update({ truguts_spent: profile.truguts_spent + hints[hint].price })
                        }
                        hintBuy
                            .setAuthor({ name: name + "'s Random Challenge Hint", iconURL: avatar })
                            .setTitle(":bulb: " + hints[hint].name + ": " + achievements[achievement].name)

                        interaction.reply({ embeds: [hintBuy] })
                    } else if (shoption.value == 'bounty') {
                        let hselection = selection[2][0]
                        const hintmap = {
                            'basic': 0,
                            'standard': 1,
                            'deluxe': 2,
                        }
                        let bounty = initializeBounty('private', hintmap[hselection], { name, member, user: player, avatar }, profile)
                        const message = await interaction.reply({
                            embeds: [bountyEmbed({ bounty, profile, db })], components: [
                                {
                                    type: 1,
                                    components: [playButton()]
                                }
                            ], fetchReply: true
                        })
                        bounty.url = message.url
                        bounty.message = message.id
                        bounty.channel = message.channelId
                        bountyref.push(bounty)
                    } else if (shoption.value == 'sponsorchallenge') {
                        let circuit = selection[2][0]

                        let recent = null
                        Object.keys(db.ch.sponsors).forEach(key => {
                            if (db.ch.sponsors[key].sponsor?.member == interaction.user.id && (!recent || db.ch.sponsors[key].created > recent.date)) {
                                recent = { date: db.ch.sponsors[key].created, key }
                            }
                        })
                        if (recent && Date.now() - 1000 * 60 * 60 * 23 < recent.date && interaction.message.id !== recent.key) {
                            const cantSponsor = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Patience Viceroy, patience.")
                                .setDescription("Sorry, you can only sponsor one challenge per day. You can sponsor your next challenge <t:" + Math.round((recent.date + 1000 * 60 * 60 * 23) / 1000) + ":R>")
                            interaction.reply({ embeds: [cantSponsor], ephemeral: true })
                            return
                        }

                        //initialize challenge
                        let sponsorchallenge = initializeChallenge({ profile, member, type: "private", name, avatar, user: player, circuit: circuit, db, interaction })
                        sponsorchallenge.type = 'open'
                        sponsorchallenge.sponsor = sponsorchallenge.player
                        delete sponsorchallenge.player

                        //reveal challenge
                        const sponsor = await interaction.reply({ embeds: [sponsorEmbed(sponsorchallenge, profile, db)], components: sponsorComponents(profile, circuit, 1), ephemeral: true, fetchReply: true })

                        sponsorref.child(sponsor.id).set(sponsorchallenge)

                    } else if (shoption.value == 'shuffle_banner') {
                        let banner = banners[Math.floor(Math.random() * banners.length)]

                        if (Guild.id == '441839750555369474') {
                            await Guild.edit({ banner: banner })
                        }
                        const shuffleBuy = new EmbedBuilder()
                            .setAuthor({ name: `${name} shuffled the server banner!`, iconURL: avatar })
                            .setImage(banner)
                        interaction.reply({ embeds: [shuffleBuy] })
                    } else if (shoption.value == 'lotto') {
                        //check if user already has ticket
                        let existing = (Object.values(db.ch.lotto).find(t => t.user == interaction.user.id && moment(t.date).tz('America/New_York').month() == moment().tz('America/New_York').month()) ?? null)
                        if (existing) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> A Botto Lotto ticket you have. Impossible, to take on a second.")
                                .setDescription(`You've already purchased a Botto Lotto ticket this month. Your lucky tracks are:\n${existing.tracks.map(t => tools.getTrackName(t)).join("\n")}`)
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        const ticket = {
                            user: interaction.user.id,
                            date: Date.now(),
                            tracks: selection[2]
                        }
                        database.ref('challenge/lotto').push(ticket)
                        const shuffleBuy = new EmbedBuilder()
                            .setAuthor({ name: `${name} purchased a 🎫 Botto Lotto Ticket!`, iconURL: avatar })
                            .setDescription(`For the next monthly challenge, they're predicting the following tracks:\n${ticket.tracks.map(t => tools.getTrackName(t)).join("\n")}`)
                        interaction.reply({ embeds: [shuffleBuy] })
                    } else if (shoption.value == 'rival') {
                        if (selection[2] == player) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?!")
                                .setDescription("You can't be your own rival!")
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        if (profile.rival && Object.values(profile.rival).pop().player == db.user[selection[2]]?.discordID) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again.")
                                .setDescription(`Your current rival is already <@${db.user[selection[2]]?.discordID}>`)
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }

                        profileref.child('rival').push({
                            player: db.user[selection[2]].discordID,
                            date: Date.now()
                        })
                        const rivalEmbed = new EmbedBuilder()
                            .setTitle("🆚 New Rivalry!")
                            .setColor('#F4900C')
                            .setDescription(`${name}'s new rival is... <@${db.user[selection[2]].discordID}>! ${name} will earn extra truguts for beating their best times.`)
                        interaction.reply({ embeds: [rivalEmbed] })
                    } else if (shoption.value == 'quote') {
                        if (interaction.isModalSubmit()) {
                            let quote = interaction.fields.getTextInputValue('quote')
                            database.ref(`challenge/quotes`).push({
                                player,
                                quote
                            })
                            const quoteEmbed = new EmbedBuilder()
                                .setTitle("✒️ Quote Submitted")
                                .setDescription(`You have successfully submited a quote:\n\n${quote.replaceAll('$player', name)}\n\nThis quote will randomly appear in random challenge messages.`)
                            interaction.reply({ embeds: [quoteEmbed], ephemeral: true })

                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('Submit a Quote')
                            const quote = new TextInputBuilder()
                                .setCustomId('quote')
                                .setLabel('Quote')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(140)
                                .setPlaceholder('(if desired, type $player to insert the name of the player)')
                                .setRequired(true)
                            const ActionRow1 = new ActionRowBuilder().addComponents(quote)
                            sponsorModal.addComponents(ActionRow1)
                            await interaction.showModal(sponsorModal)
                            return
                        }
                    } else if (shoption.value == 'clue') {
                        if (interaction.isModalSubmit()) {
                            let clue = interaction.fields.getTextInputValue('clue')
                            database.ref(`challenge/clues`).push({
                                player,
                                type: selection[2][0],
                                selection: Number(selection[3]),
                                clue
                            })
                            const quoteEmbed = new EmbedBuilder()
                                .setTitle("💡 Clue Submitted")
                                .setDescription(`You have successfully submited a clue:\n\n${clue}\n\nThis clue will randomly appear in Hints and Bounties for ${selection[2] == 'track' ? tools.getTrackName(selection[3]) : tools.getRacerName(selection[3])}.`)
                            interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('Submit a Clue')
                            const clue = new TextInputBuilder()
                                .setCustomId('clue')
                                .setLabel('Clue')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(140)
                                .setRequired(true)
                            const ActionRow1 = new ActionRowBuilder().addComponents(clue)
                            sponsorModal.addComponents(ActionRow1)
                            await interaction.showModal(sponsorModal)
                            return
                        }
                    } else if (shoption.value == 'sponsorplayer') {
                        let take = Number(selection[2][0])
                        let sponsorplayer = selection[3][0]
                        if (sponsorplayer == player) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?!")
                                .setDescription("You can't sponsor yourself!")
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        let sponsored = db.user[sponsorplayer]?.random
                        if (sponsored?.sponsors && Object.values(sponsored.sponsors).filter(s => s.player == player && s.take == take).length) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again.")
                                .setDescription(`You have already sponsored <@${db.user[sponsorplayer]?.discordID}>!`)
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }

                        database.ref(`users/${sponsorplayer}/random/sponsors`).push({
                            date: Date.now(),
                            player: player,
                            take: take
                        })
                        manageTruguts({ profile: sponsored, profileref: database.ref(`users/${sponsorplayer}/random`), transaction: 'd', amount: price })

                        const quoteEmbed = new EmbedBuilder()
                            .setTitle(":loudspeaker: Player Sponsorship")
                            .setDescription(`${name} is now sponsoring <@${db.user[selection[2]].discordID}>!\nSponsorhip amount: \`📀${tools.numberWithCommas(shoption.price)}\``)
                        interaction.reply({ embeds: [quoteEmbed] })
                    } else if (shoption.value == 'rerolldaily') {
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
                            .setTitle(`🔄 ${name} rerolled the Random Challenge of the Day!`)
                        interaction.reply({ embeds: [noTruguts] })
                        last.rerolled = true
                        const pub_response = await updateChallenge({ client, current_challenge: last, current_challengeref: database.ref(`challenge/challenges/${last.message}`), interaction, db })
                        editMessage(client, last.channel, last.message, pub_response)
                        dailyChallenge({ client, db, challengesref: database.ref('challenge/challenges') })

                    } else if (shoption.value == 'buddy') {
                        if (profile.effects?.botto_buddy) {
                            alreadyPurchased(interaction)
                            return
                        }
                        profileref.child('effects').update({ botto_buddy: true })
                        const noTruguts = new EmbedBuilder()
                            .setTitle("Botto is now your emoji buddy!")
                            .setDescription("Botto will copy your reactions to messages. Try it out!")
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    } else if (shoption.value == 'roleicon') {
                        if (interaction.isModalSubmit()) {
                            let emoji = interaction.fields.getTextInputValue('emoji')
                            let emojikey = Object.keys(emojimap).find(key => key.toLowerCase() == emoji.toLowerCase())
                            if (!emojikey) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Perhaps the archives are incomplete.")
                                    .setDescription("The emoji you entered could not be found in the database. Please double check its name and spelling. Only SWE1R emojis are eligible. Racer flag icons are free roles in <id:customize>")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }

                            let role = await SWE1R_Guild.roles.cache.find(r => r.name == emojikey)
                            if (profile.roles?.emoji && Object.values(profile.roles.emoji).map(r => r.id).includes(role.id)) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Don't do that again")
                                    .setDescription("You already own this emoji icon. You can equip or unequip in roles in **🎒 Inventory**")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }
                            let pos = await SWE1R_Guild.roles.cache.get('1094292597478010880')
                            let e = emojimap[emojikey].split(":")[2].replace(">", "")
                            const m = await SWE1R_Guild.members.cache.find(m => m.id == member)
                            if (role) {
                                m.roles.add(role)
                                database.ref(`users/${player}/random/roles/emoji`).push({ id: role.id, emoji_id: e })
                            } else {
                                SWE1R_Guild.roles.create({ name: emojikey, icon: e, position: pos.position + 1 }).then(r => {
                                    m.roles.add(r)
                                    database.ref(`users/${player}/random/roles/emoji`).push({ id: r.id, emoji_id: e })
                                })
                            }



                            const quoteEmbed = new EmbedBuilder()
                                .setTitle("✨Emoji Role Icon")
                                .setDescription(`You just bought an emoji role icon ${emojimap[emojikey]}! You should see the selected emoji next to your name in the SWE1R Discord.`)
                            interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('Emoji Role Icon')
                            const clue = new TextInputBuilder()
                                .setCustomId('emoji')
                                .setLabel('Emoji Name')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(100)
                                .setPlaceholder("enter the name of a non-animated server emoji")
                                .setRequired(true)
                            const ActionRow1 = new ActionRowBuilder().addComponents(clue)
                            sponsorModal.addComponents(ActionRow1)
                            await interaction.showModal(sponsorModal)
                            return
                        }
                        //

                        // if (role) {
                        //     console.log(role)
                        // } else {
                        //     SWE1R_Guild.roles.create({ name: 'role', position: 21 })
                        // }
                        //check if a role already exists

                    } else if (shoption.value == 'bottocolor') {
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

                            let role = await SWE1R_Guild.roles.cache.get('1144077932021686272')
                            role.edit({ color: color })

                            const quoteEmbed = new EmbedBuilder()
                                .setTitle("✨New Botto Color")
                                .setDescription(`<@${member}> just changed <@545798436105224203>'s color!`)
                                .setColor(color)
                            interaction.reply({ embeds: [quoteEmbed] })

                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('New Botto Color')
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
                    } else if (shoption.value == 'timer') {
                        if (profile.effects?.extended_timer) {
                            alreadyPurchased(interaction)
                            return
                        }
                        await database.ref(`users/${player}/random/effects`).update({ extended_timer: true })
                        const quoteEmbed = new EmbedBuilder()
                            .setTitle("⏳Extended Timer")
                            .setDescription(`You now have 30 minutes to complete personal random challenges!`)
                        interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
                    } else if (shoption.value == 'friend') {
                        if (profile.effects?.friend_greed) {
                            alreadyPurchased(interaction)
                            return
                        }
                        await database.ref(`users/${player}/random/effects`).update({ friend_greed: true })
                        const quoteEmbed = new EmbedBuilder()
                            .setTitle("💖Friend in Greed")
                            .setDescription(`Botto will now treat you as his favorite customer when interacting with him in chat.`)
                        interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
                    } else if (['protocol', 'suffer'].includes(shoption.value)) {
                        let title = shoption.value == 'protocol' ? "💭Protocol Droid" : '💬Made to Suffer'
                        if (interaction.isModalSubmit()) {
                            let phrase = interaction.fields.getTextInputValue('phrase')
                            let emoji = '', reply = '', selected_emoji = ''
                            if (shoption.value == 'protocol') {
                                emoji = interaction.fields.getTextInputValue('emoji') ?? ""
                                selected_emoji = Object.keys(emojimap).find(e => e.toLowerCase() == emoji.toLowerCase())
                            } else {
                                reply = interaction.fields.getTextInputValue('reply') ?? ""
                            }
                            if (!selected_emoji && shoption.value == 'protocol') {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that emoji doesn't exist.")
                                    .setDescription("Please double check its name and spelling. Only SWE1R Server emotes are eligible.")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }

                            database.ref(`challenge/auto`).push({
                                player,
                                type: shoption.value == 'protocol' ? 'react' : 'reply',
                                phrase: phrase,
                                reply: reply,
                                emoji: selected_emoji ? tools.extractEmojiID(emojimap[selected_emoji]) : ""
                            })
                            const quoteEmbed = new EmbedBuilder()
                                .setTitle(title)
                                .setDescription(`Botto will now automatically ${shoption.value == 'protocol' ? 'react' : 'reply'} to messages containing "${phrase}" with ${shoption.value == 'protocol' ? emojimap[selected_emoji] : `: *${reply}*`}`)
                            interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('Protocol Droid')
                            const clue = new TextInputBuilder()
                                .setCustomId('phrase')
                                .setLabel('Phrase')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Enter a word/phrase')
                                .setMinLength(5)
                                .setMaxLength(140)
                                .setRequired(true)
                            const emoji = new TextInputBuilder()
                                .setCustomId(shoption.value == 'protocol' ? 'emoji' : 'reply')
                                .setLabel(shoption.value == 'protocol' ? 'Emoji' : 'Reply')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder(`Enter ${shoption.value == 'protocol' ? 'an emoji' : 'a response'} that Botto will use to ${shoption.value == 'protocol' ? 'react' : 'reply'}`)
                                .setMaxLength(140)
                                .setRequired(true)
                            const ActionRow1 = new ActionRowBuilder().addComponents(clue)
                            const ActionRow2 = new ActionRowBuilder().addComponents(emoji)
                            sponsorModal.addComponents(ActionRow1, ActionRow2)
                            await interaction.showModal(sponsorModal)
                            return
                        }
                    } else if (shoption.value == 'multiply') {
                        let multiplier = Number(selection[2][0])
                        if (!profile.progression) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Your midi-chlorian count is off the charts!")
                                .setDescription(`Please open your profile to calculate your progression.`)
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        if (profile.effects?.trugut_cloner && Object.values(profile.effects.trugut_cloner).map(m => m.multiplier).includes(multiplier)) {
                            alreadyPurchased(interaction)
                            return
                        }
                        let playerlevel = playerLevel(profile.progression).level
                        const levelmap = {
                            2: 5,
                            4: 10,
                            6: 15,
                            8: 20,
                            10: 25
                        }
                        let requiredlevel = levelmap[multiplier]
                        if (playerlevel < requiredlevel) {
                            const noTruguts = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Stay in that cockpit!")
                                .setDescription(`You need to level up to purchase this item.\nCurrent level: ${playerlevel}\nRequired level: ${requiredlevel}`)
                            interaction.reply({ embeds: [noTruguts], ephemeral: true })
                            return
                        }
                        database.ref(`users/${player}/random/effects/trugut_cloner`).push({
                            date: Date.now(),
                            multiplier: multiplier
                        })

                        const quoteEmbed = new EmbedBuilder()
                            .setTitle("✖️Trugut Cloner")
                            .setDescription(`You just purchased a ${multiplier}× Trugut Multiplier!`)
                        interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
                    } else if (shoption.value == 'homing') {
                        let level = selection[2][0]
                        if (profile.effects?.nav_computer?.[level]) {
                            alreadyPurchased(interaction)
                            return
                        }
                        profileref.child('effects').child('nav_computer').child(level).set(true)
                        const noTruguts = new EmbedBuilder()
                            .setTitle("You upgraded your 🧭Nav Computer")
                            .setDescription("New options are available to enable/disable in your settings.")
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    } else if (shoption.value == 'rerolls') {
                        if (profile.effects?.free_rerolls) {
                            alreadyPurchased(interaction)
                            return
                        }
                        profileref.child('effects').update({ free_rerolls: true })
                        const noTruguts = new EmbedBuilder()
                            .setTitle("🔄FREE REROLLS FOR LIFE!")
                            .setDescription("You have the power to deny whatever challenge of your choosing at no charge. In a world of RNG you have unlocked the ultimate weapon: choice.")
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    } else if (shoption.value == 'paint') {
                        if (profile.roles?.custom) {
                            alreadyPurchased(interaction)
                            return
                        }

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

                            let pos = await SWE1R_Guild.roles.cache.get('541297572401250316')
                            const m = await SWE1R_Guild.members.cache.find(m => m.id == member)
                            SWE1R_Guild.roles.create({ name: 'Trillion Trugut Tri-Coat', color: color, position: pos.position + 1 }).then(r => {
                                m.roles.add(r)
                                database.ref(`users/${player}/random/roles/custom`).set(r.id)
                            })

                            const quoteEmbed = new EmbedBuilder()
                                .setTitle("🎨Trillion Trugut Tri-Coat")
                                .setDescription(`<@${member}> just bought a custom role color for \`📀1,000,000,000,000\` Truguts!`)
                                .setColor(color)
                            interaction.reply({ embeds: [quoteEmbed] })
                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('🎨Trillion Trugut Tri-Coat')
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
                    } else if (shoption.value == 'trendy_transmission') {
                        if (interaction.isModalSubmit()) {
                            let title = interaction.fields.getTextInputValue('title')
                            let url = interaction.fields.getTextInputValue('url')
                            let desc = interaction.fields.getTextInputValue('desc')
                            let image = interaction.fields.getTextInputValue('image')
                            let color = interaction.fields.getTextInputValue('color')

                            function isValidHexCode(hexCode) {
                                const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                                return hexRegex.test(hexCode);
                            }

                            if (color && !isValidHexCode(color)) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that color doesn't exist")
                                    .setDescription("Please enter a valid hex code `#FFFFFF`")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }

                            const customEmbed = new EmbedBuilder()
                            if (title) {
                                customEmbed.setTitle(title)
                            }
                            if (url) {
                                customEmbed.setURL(url)
                            }
                            if (desc) {
                                customEmbed.setDescription(desc)
                            }
                            if (image) {
                                customEmbed.setImage(image)
                            }
                            if (color) {
                                customEmbed.setColor(color)
                            }
                            if (![title, desc].filter(f => f).length) {
                                const noTruguts = new EmbedBuilder()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> It's a trick. Send no reply.")
                                    .setDescription("You cannot send a blank embed.")
                                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                                return
                            }
                            interaction.update({ embeds: [customEmbed], content: '', components: [] })

                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_shop_purchase')
                                .setTitle('Embed Builder')
                            const title = new TextInputBuilder()
                                .setCustomId('title')
                                .setLabel('Title')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(256)
                                .setRequired(false)
                            const url = new TextInputBuilder()
                                .setCustomId('url')
                                .setLabel('URL')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(256)
                                .setRequired(false)
                                .setPlaceholder('This sets a hyperlink for the title')
                            const desc = new TextInputBuilder()
                                .setCustomId('desc')
                                .setLabel('Description')
                                .setStyle(TextInputStyle.Paragraph)
                                .setMaxLength(4000)
                                .setRequired(false)
                            const image = new TextInputBuilder()
                                .setCustomId('image')
                                .setLabel('Image URL')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(256)
                                .setRequired(false)
                            const color = new TextInputBuilder()
                                .setCustomId('color')
                                .setLabel('Color')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("#FFFFFF")
                                .setMaxLength(7)
                                .setMinLength(7)
                                .setRequired(false)
                            const ActionRow1 = new ActionRowBuilder().addComponents(title)
                            const ActionRow2 = new ActionRowBuilder().addComponents(url)
                            const ActionRow3 = new ActionRowBuilder().addComponents(desc)
                            const ActionRow4 = new ActionRowBuilder().addComponents(image)
                            const ActionRow5 = new ActionRowBuilder().addComponents(color)
                            sponsorModal.addComponents(ActionRow1, ActionRow2, ActionRow3, ActionRow4, ActionRow5)
                            await interaction.showModal(sponsorModal)
                            return
                        }
                    } else if (shoption.value == 'debt') {
                        if (profile.effects?.life_debt) {
                            alreadyPurchased(interaction)
                            return
                        }
                        profileref.child('effects').update({ life_debt: true })
                        const noTruguts = new EmbedBuilder()
                            .setTitle("💸Life Debt")
                            .setDescription("You now have the power to buy things before you can afford them.")
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    } else if (shoption.value == 'bribes') {
                        if (profile.effects?.free_bribes) {
                            alreadyPurchased(interaction)
                            return
                        }
                        profileref.child('effects').update({ free_bribes: true })
                        const noTruguts = new EmbedBuilder()
                            .setTitle("FREE BRIBES FOR LIFE!")
                            .setDescription("You have the power to bribe whatever challenge of your choosing at no charge. In a world of RNG you have unlocked the ultimate weapon: choice.")
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    } else if (shoption.value == 'peace') {
                        if (profile.effects?.peace_treaty) {
                            alreadyPurchased(interaction)
                            return
                        }
                        profileref.child('effects').update({ peace_treaty: true })
                        const noTruguts = new EmbedBuilder()
                            .setTitle("🕊Peace Treaty")
                            .setDescription("You can no longer sabotage nor be sabotaged.")
                        interaction.reply({ embeds: [noTruguts], ephemeral: true })
                    }

                    //process purchase
                    manageTruguts({
                        profile, profileref, transaction: 'w', amount: price, purchase: {
                            date: Date.now(),
                            purchased_item: shoption.value,
                            selection: shoption.pricemap ? selection[2]?.[0] ?? "" : "",
                            cost: price
                        }
                    })

                    editMessage(client, interaction.channel.id, interaction.message.id, { embeds: [shopEmbed({ shoptions, selection, profile })], components: shopComponents({ profile, selection, shoptions }) })
                    break
                case 'sponsor':
                    if (args[2] == 'details') { //set title / time
                        sponsorchallenge = db.ch.sponsors[interaction.message.id]
                        if (interaction.isModalSubmit()) {
                            let title = interaction.fields.getTextInputValue('customTitle')
                            let time = interaction.fields.getTextInputValue('customTime')
                            time = validateTime(time)

                            sponsorref.child(interaction.message.id).update({ title, time })

                            profile = db.user[player].random
                            sponsorchallenge = db.ch.sponsors[interaction.message.id]
                            interaction.update({ embeds: [sponsorEmbed(sponsorchallenge, profile, db)], components: sponsorComponents(profile, 1) })
                        } else {
                            const sponsorModal = new ModalBuilder()
                                .setCustomId('challenge_random_sponsor_details')
                                .setTitle('Sponsor Customization')
                            const customTitle = new TextInputBuilder()
                                .setCustomId('customTitle')
                                .setLabel('Custom Title')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(70)
                                .setValue(sponsorchallenge.title ?? "")
                                .setRequired(false)
                            const customTime = new TextInputBuilder()
                                .setCustomId('customTime')
                                .setLabel('Custom Time')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(9)
                                .setPlaceholder("--:--.---")
                                .setValue(sponsorchallenge.time ?? "")
                                .setRequired(false)
                            const ActionRow1 = new ActionRowBuilder().addComponents(customTitle)
                            const ActionRow2 = new ActionRowBuilder().addComponents(customTime)
                            sponsorModal.addComponents(ActionRow1, ActionRow2)
                            await interaction.showModal(sponsorModal)
                        }

                    } else if (args[2] == 'publish') { //post challenge
                        let sponsorchallenge = db.ch.sponsors[interaction.message.id]
                        if (sponsorchallenge.published) {
                            const cantSponsor = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?")
                                .setDescription("This sponsorship was already published at " + sponsorchallenge.url)
                            interaction.reply({ embeds: [cantSponsor], ephemeral: true })
                            return
                        }
                        const pub_response = await updateChallenge({ client, profile, current_challenge: sponsorchallenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                        let publishmessage = await interaction.reply(pub_response)
                        if (interaction.guildId == swe1r_guild) {
                            publishmessage.pin()
                        }

                        sponsorchallenge.message = publishmessage.id
                        sponsorchallenge.url = publishmessage.url
                        sponsorref.child(interaction.message.id).update({ published: true, url: publishmessage.url })
                        challengesref.child(publishmessage.id).set(sponsorchallenge)

                        if (sponsorAchievement(db, member) >= achievement_data.bankroller_clan.limit) { //award achievement
                            if (interaction.guildId == swe1r_guild) {
                                if (!Member.roles.cache.some(r => r.id === achievement_data.bankroller_clan.role)) { //award role
                                    Member.roles.add(achievement_data.bankroller_clan.role).catch(error => console.log(error))
                                }
                            }
                            if (!profile.achievements.bankroller_clan) {
                                postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.bankroller_clan, interaction.guild)] })
                                profileref.child('achievements').child("bankroller_clan").set(true)
                            }
                        }
                    } else {
                        interaction.reply({ embeds: [sponsorEmbed(null, profile, db)], components: sponsorComponents(profile, cselection, 0), ephemeral: true })
                    }
                    break
                case 'settings':
                    if (args[2] == 'initial') {
                        profile = db.user[player].random
                        interaction.reply({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile), ephemeral: true })
                        return
                    }
                    if (args[2] == "winnings") {
                        profileref.child("settings").update({ winnings: Number(interaction.values[0]) })
                    } else if (args[2] == "predictions") {
                        profileref.child("settings").update({ predictions: !profile.settings.predictions })
                    } else if (args[2] == 'nav') {
                        profileref.child('settings').update({ nav: interaction.values })
                    } else if (args[2] == "odds") {
                        if (interaction.isModalSubmit()) {
                            let odds = {
                                skips: interaction.fields.getTextInputValue('skipsOdds'),
                                no_upgrades: interaction.fields.getTextInputValue('nuOdds'),
                                non_3_lap: interaction.fields.getTextInputValue('n3lOdds'),
                                mirror_mode: interaction.fields.getTextInputValue('mirrorOdds'),
                                backwards: interaction.fields.getTextInputValue('backwardsOdds'),
                            }
                            Object.keys(odds).forEach(key => {
                                if (isNaN(Number(odds[key]))) {
                                    odds[key] = settings_default[key]
                                } else {
                                    odds[key] = Math.round(Number(odds[key]))
                                }
                            })
                            profileref.child('settings').update(odds)
                        } else {
                            const oddsModal = new ModalBuilder()
                                .setCustomId('challenge_random_settings_odds')
                                .setTitle('Customize Odds')
                            const skipsOdds = new TextInputBuilder()
                                .setCustomId('skipsOdds')
                                .setLabel('Skips')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(2)
                                .setMinLength(1)
                                .setValue(String(profile.settings.skips))
                                .setRequired(true)
                            const nuOdds = new TextInputBuilder()
                                .setCustomId('nuOdds')
                                .setLabel('No Upgrades')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(2)
                                .setMinLength(1)
                                .setValue(String(profile.settings.no_upgrades))
                                .setRequired(true)
                            const n3lOdds = new TextInputBuilder()
                                .setCustomId('n3lOdds')
                                .setLabel('Non 3-Lap')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(2)
                                .setMinLength(1)
                                .setValue(String(profile.settings.non_3_lap))
                                .setRequired(true)
                            const mirrorOdds = new TextInputBuilder()
                                .setCustomId('mirrorOdds')
                                .setLabel('Mirror Mode')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(2)
                                .setMinLength(1)
                                .setValue(String(profile.settings.mirror_mode))
                                .setRequired(true)
                            const backwardsOdds = new TextInputBuilder()
                                .setCustomId('backwardsOdds')
                                .setLabel('Backwards')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(2)
                                .setMinLength(1)
                                .setValue(String(profile.settings.backwards))
                                .setRequired(true)
                            const ActionRow1 = new ActionRowBuilder().addComponents(skipsOdds)
                            const ActionRow2 = new ActionRowBuilder().addComponents(nuOdds)
                            const ActionRow3 = new ActionRowBuilder().addComponents(n3lOdds)
                            const ActionRow4 = new ActionRowBuilder().addComponents(mirrorOdds)
                            const ActionRow5 = new ActionRowBuilder().addComponents(backwardsOdds)
                            oddsModal.addComponents(ActionRow1, ActionRow2, ActionRow3, ActionRow4, ActionRow5)

                            await interaction.showModal(oddsModal)
                            return
                        }
                    } else if (args[2] == "default") {
                        profileref.child("settings").update({
                            winnings: settings_default.winnings,
                            skips: settings_default.skips,
                            no_upgrades: settings_default.no_upgrades,
                            non_3_lap: settings_default.non_3_lap,
                            mirror_mode: settings_default.mirror_mode,
                            backwards: settings_default.backwards,
                            predictions: settings_default.predictions
                        })
                    }
                    profile = db.user[player].random
                    interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
                    break
                case 'profile':
                    // if (args[args.length - 1].startsWith("uid") && args[args.length - 1].replace("uid", "") !== member) {
                    //     const holdUp = new EmbedBuilder()
                    //         .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Profile!")
                    //         .setDescription("This is someone else's profile. Get your own by clicking the button below.")
                    //     const row1 = new ActionRowBuilder()
                    //         .addComponents(
                    //             new ButtonBuilder()
                    //                 .setCustomId("challenge_random_profile_stats")
                    //                 .setLabel("Profile")
                    //                 .setStyle(ButtonStyle.Secondary)
                    //                 .setEmoji('👤')
                    //         )
                    //     interaction.reply({ embeds: [holdUp], ephemeral: true, components: [row1]})
                    //     return
                    // }
                    await interaction.deferUpdate()
                    const ach_report = achievementProgress({ db, player: member })
                    const stats = getStats({ db, member, profile })
                    if (!profile.progression) {
                        let progression = Object.values(stats.racers).map(r => r.level)
                        progression.forEach((level, racer) => {
                            for (let i = 1; i < convertLevel(level).level + 1; i++) {
                                let reward = progressionReward({ racer, level: i })
                                manageTruguts({ profile, profileref, transaction: 'd', amount: reward.truguts })
                                if (reward.item) {
                                    profileref.child('items').push({
                                        id: reward.item,
                                        date: Date.now(),
                                        progression: {
                                            racer: racer,
                                            level: i
                                        }
                                    })
                                }

                            }
                        })
                        await profileref.child('progression').set(progression)
                        let new_player_level = playerLevel(progression)
                        postMessage(client, interaction.channelId, { embeds: [new EmbedBuilder().setAuthor({ name: `${name} leveled up!`, iconURL: avatar }).setDescription(new_player_level.string).setFooter({ text: `Level ${new_player_level.level}` })] })
                    }
                    interaction.editReply({ embeds: [profileEmbed({ db, player: member, name, avatar, ach_report, profile, stats })], components: profileComponents({ member, ach_report, stats, profile }) })
                    break
                case 'about':
                    let aselection = interaction.values?.[0] ?? 'rchallenge'
                    const challengeHelpEmbed = new EmbedBuilder()
                        .setAuthor({ name: "Random Challenge", value: "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png" })
                        .setTitle(":grey_question: About")
                        .setColor("#ED4245")
                        .setDescription(`**${about[aselection].emoji} ${about[aselection].name}**\n` + about[aselection].desc)

                    const row1 = new ActionRowBuilder()
                    const about_selector = new StringSelectMenuBuilder()
                        .setCustomId('challenge_random_about')
                        .setPlaceholder("Select A Circuit")
                        .setMinValues(1)
                        .setMaxValues(1)
                    Object.keys(about).forEach(key => {
                        about_selector.addOptions(
                            {
                                label: about[key].name,
                                value: key,
                                emoji: about[key].emoji,
                                default: aselection == key
                            }
                        )
                    })
                    row1.addComponents(about_selector)
                    if (interaction.isStringSelectMenu()) {
                        interaction.update({ embeds: [challengeHelpEmbed], components: [row1], ephemeral: true })
                    } else {
                        interaction.reply({ embeds: [challengeHelpEmbed], components: [row1], ephemeral: true })
                    }
                    break
                case 'leaderboards':
                    const unAvailable = new EmbedBuilder()
                        .setTitle("<:WhyNobodyBuy:589481340957753363> I have great faith in the boy")
                        .setDescription("Leaderboards are currently unavailable. Please harass LightningPirate to get this feature updated.")
                    interaction.reply({ embeds: [unAvailable], ephemeral: true })
                    return
                    const challengeLeaderboard = new EmbedBuilder()
                    var track = Math.floor(Math.random() * 25)
                    var conditions = []
                    var pods = []
                    var showall = false
                    //filters out other tracks
                    if (!args.includes("initial")) {
                        for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //track
                            var option = interaction.message.components[0].components[0].options[i]
                            if (option.hasOwnProperty("default")) {
                                if (option.default) {
                                    track = i
                                }
                            }
                        }
                        for (var i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //conditions
                            var option = interaction.message.components[1].components[0].options[i]
                            if (option.hasOwnProperty("default")) {
                                if (option.default) {
                                    conditions.push(option.value)
                                }
                            }
                        }
                        for (var i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //pods
                            var option = interaction.message.components[2].components[0].options[i]
                            if (option.hasOwnProperty("default")) {
                                if (option.default) {
                                    pods.push(String(i))
                                }
                            }
                        }
                        if (args[2] == "track") {
                            track = Number(interaction.data.values[0])
                        } else if (args[2] == "conditions") {
                            if (interaction.data.hasOwnProperty("values")) {
                                conditions = interaction.data.values
                            }
                        } else if (args[2] == "pods") {
                            if (interaction.data.hasOwnProperty("values")) {
                                pods = interaction.data.values
                            } else {
                                pods = []
                            }
                        }
                    }
                    if (conditions.length == 0) {
                        conditions = ["mu", "nu", "ft", "skips", "unmirr", "mirr", "lap3"]
                    }
                    //prepare filters
                    var nu = [], skips = [], mirrored = [], laps = [], user = null
                    if (conditions.includes("mu")) {
                        nu.push(false)
                    }
                    if (conditions.includes("nu")) {
                        nu.push(true)
                    }
                    if (conditions.includes("ft")) {
                        skips.push(false)
                    }
                    if (conditions.includes("skips")) {
                        skips.push(true)
                    }
                    if (conditions.includes("unmirr")) {
                        mirrored.push(false)
                    }
                    if (conditions.includes("mirr")) {
                        mirrored.push(true)
                    }
                    if (conditions.includes("lap1")) {
                        laps.push(1)
                    }
                    if (conditions.includes("lap2")) {
                        laps.push(2)
                    }
                    if (conditions.includes("lap3")) {
                        laps.push(3)
                    }
                    if (conditions.includes("lap4")) {
                        laps.push(4)
                    }
                    if (conditions.includes("lap5")) {
                        laps.push(5)
                    }
                    if (conditions.includes("user")) {
                        user = member
                    }
                    //account for missing values
                    if (nu.length == 0) { nu.push(true, false), conditions.push("mu", "nu") }
                    if (skips.length == 0) { skips.push(true, false), conditions.push("ft", "skips") }
                    if (mirrored.length == 0) { mirrored.push(true, false), conditions.push("unmirr", "mirr") }
                    if (laps.length == 0) { laps.push(1, 2, 3, 4, 5), conditions.push("lap1", "lap2", "lap3", "lap4", "lap5") }
                    //filter
                    var challenge = Object.values(db.ch.challenges)
                    var challengefiltered = challenge.filter(element => element.track == track)
                    challengefiltered = challengefiltered.filter(element => skips.includes(element.skips))
                    challengefiltered = challengefiltered.filter(element => nu.includes(element.nu))
                    challengefiltered = challengefiltered.filter(element => laps.includes(element.laps))
                    challengefiltered = challengefiltered.filter(element => mirrored.includes(element.mirror))
                    if (pods.length > 0) {
                        challengefiltered = challengefiltered.filter(element => pods.includes(String(element.racer)))
                    }
                    if (user !== null) {
                        challengefiltered = challengefiltered.filter(element => element.user == user)
                    }
                    challengefiltered.sort(function (a, b) {
                        return a.time - b.time;
                    })
                    //construct embed
                    challengeLeaderboard
                        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                        .setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name)
                        .setColor(planets[tracks[track].planet].color)
                        .setDescription(circuits[tracks[track].circuit].name + " Circuit | Race " + tracks[track].cirnum + " | " + planets[tracks[track].planet].name)
                        .setFooter({ text: challengefiltered.length + " Total Runs" })
                    if (user !== null) {
                        challengeLeaderboard.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guildId).members.resolve(user).user.avatarURL())
                        showall = true
                    }
                    var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
                    var already = []
                    if (challengefiltered.length > 0) {
                        for (var j = 0; j < challengefiltered.length; j++) {
                            if (!already.includes((challengefiltered[j].player + " " + challengefiltered[j].skips + " " + challengefiltered[j].racer + " " + challengefiltered[j].nu + " " + challengefiltered[j].laps + " " + challengefiltered[j].mirror)) || showall) {
                                var stuff = []
                                stuff.push(challengefiltered[j].laps + " Laps")
                                var upgr = " | MU"
                                if (challengefiltered[j].skips == true) {
                                    stuff.push("Skips")
                                } else {
                                    stuff.push("FT")
                                }
                                if (challengefiltered[j].nu == true) {
                                    upgr = " | NU"
                                }
                                if (challengefiltered[j].mirror == true) {
                                    stuff.push("Mirrored")
                                }
                                var character = racers[challengefiltered[j].racer].flag //+ " " + racers[challengefiltered[j].racer].name
                                challengeLeaderboard
                                    .addField(pos[0] + " " + challengefiltered[j].name, stuff.join(" | "), true)
                                    .addField(tools.timefix(Number(challengefiltered[j].time).toFixed(3)), " " + character + upgr, true)
                                    .addField('\u200B', '\u200B', true)
                                already.push(challengefiltered[j].player + " " + challengefiltered[j].skips + " " + challengefiltered[j].racer + " " + challengefiltered[j].nu + " " + challengefiltered[j].laps + " " + challengefiltered[j].mirror)
                                if (pos.length > 1) {
                                    pos.splice(0, 1)
                                } else {
                                    j = challengefiltered.length
                                }
                            }
                        }
                    } else {
                        challengeLeaderboard
                            .addField("<:WhyNobodyBuy:589481340957753363> No Runs", "`No runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)])
                    }
                    //construct components

                    var cond = { mu: "Upgrades", nu: "No Upgrades", ft: "Full Track", skips: "Skips", unmirr: "Unmirrored", mirr: "Mirrored", lap1: "1-Lap", lap2: "2-Laps", lap3: "3-Laps", lap4: "4-Laps", lap5: "5-Laps", user: "My Runs Only" }
                    var track_selections = []
                    var racer_selections = []
                    var cond_selections = []
                    for (var i = 0; i < 25; i++) {
                        var racer_option = {
                            label: racers[i].name,
                            value: i,
                            description: racers[i].pod.substring(0, 50),
                            emoji: {
                                name: racers[i].flag.split(":")[1],
                                id: racers[i].flag.split(":")[2].replace(">", "")
                            }
                        }
                        if (pods.includes(String(i))) {
                            racer_option.default = true
                        }
                        var track_option = {
                            label: tracks[i].name.replace("The Boonta Training Course", "Boonta Training Course"),
                            value: i,
                            description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
                            emoji: {
                                name: planets[tracks[i].planet].emoji.split(":")[1],
                                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                            }
                        }
                        if (track == i) {
                            track_option.default = true
                        }
                        if (i < 23) {
                            racer_selections.push(racer_option)
                        }
                        track_selections.push(track_option)
                        var condkeys = Object.keys(cond)
                        if (i < condkeys.length) {
                            var cond_option = {
                                label: cond[condkeys[i]],
                                value: condkeys[i],
                            }
                            if (conditions.includes(condkeys[i])) {
                                cond_option.default = true
                            }
                            cond_selections.push(cond_option)
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "challenge_random_leaderboards_track",
                                    options: track_selections,
                                    placeholder: "Select Track",
                                    min_values: 1,
                                    max_values: 1
                                },
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "challenge_random_leaderboards_conditions",
                                    options: cond_selections,
                                    placeholder: "Select Conditions",
                                    min_values: 0,
                                    max_values: cond_selections.length
                                },
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "challenge_random_leaderboards_pods",
                                    options: racer_selections,
                                    placeholder: "Select Pods",
                                    min_values: 0,
                                    max_values: racer_selections.length
                                }
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    custom_id: "challenge_random_menu",
                                    emoji: {
                                        name: "menu",
                                        id: "862620287735955487"
                                    }
                                }
                            ]
                        }
                    )
                    interaction.editReply({ embeds: [challengeLeaderboard], components: components })
                    break
                case 'modal':
                    if (current_challenge.type == 'private' && member !== current_challenge.player?.member) { //not your challenge
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Get Lost!")
                            .setDescription("This is a private challenge. Only the player who started this challenge can complete it.")
                        interaction.reply({
                            embeds: [holdUp], components: [
                                {
                                    type: 1,
                                    components: [playButton()]
                                }
                            ], ephemeral: true
                        })
                        return
                    }
                    let active = checkActive(db, member, current_challenge)
                    if (active) { //already has active challenge
                        interaction.reply({ embeds: [active], ephemeral: true })
                        return
                    }
                    if (!isActive(current_challenge, profile) && !current_challenge.submissions?.[member]) { //expired challeneg
                        //current_challengeref.update({ completed: true })
                        interaction.reply({
                            embeds: [expiredEmbed()], components: [
                                {
                                    type: 1,
                                    components: [playButton()]
                                }

                            ], ephemeral: true
                        })
                        return
                    }

                    lastconsole = Object.values(db.ch.times).filter(c => c.user == member && c.platform).sort((a, b) => b.date - a.date)
                    if (lastconsole.length) {
                        lastconsole = lastconsole[0].platform
                    } else {
                        lastconsole = ""
                    }
                    // if (current_challenge.submissions?.[member]) { //already submitted
                    //     const holdUp = new EmbedBuilder()
                    //         .setTitle("<:WhyNobodyBuy:589481340957753363> You seem familiar...")
                    //         .setDescription("You already submitted a time for this challenge. Why not try a new one?")
                    //     interaction.reply({
                    //         embeds: [holdUp], components: [
                    //             {
                    //                 type: 1,
                    //                 components: [playButton()]
                    //             }

                    //         ], ephemeral: true
                    //     })
                    //     return
                    // }
                    const submissionModal = new ModalBuilder()
                        .setCustomId('challenge_random_submit')
                        .setTitle('Submit Results')
                    const submissionTime = new TextInputBuilder()
                        .setCustomId('challengeTime')
                        .setLabel('Total Time' + (current_challenge.type == 'cotm' ? ' (IGT)' : ''))
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(11)
                        .setMinLength(6)
                        .setPlaceholder("--:--.---")
                        .setRequired(true)

                    const submissionRTA = new TextInputBuilder()
                        .setCustomId('challengeRTA')
                        .setLabel('RTA (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(11)
                        .setMinLength(0)
                        .setPlaceholder("--:--.---")
                        .setRequired(false)

                    const submissionNotes = new TextInputBuilder()
                        .setCustomId('challengeNotes')
                        .setLabel('Notes')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(25)
                        .setMinLength(0)
                        .setPlaceholder("")
                        .setRequired(false)

                    const submissionPlatform = new TextInputBuilder()
                        .setCustomId('challengePlatform')
                        .setLabel('Platform')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(25)
                        .setMinLength(0)
                        .setPlaceholder("pc, n64, dc, switch, xbox, ps4")
                        .setRequired(false)
                        .setValue(lastconsole)
                    const submissionProof = new TextInputBuilder()
                        .setCustomId('challengeProof')
                        .setLabel('Proof')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("image or video url (can be added later)")
                        .setRequired(false)
                    if (current_challenge.submissions?.[member]) {
                        const this_submission = db.ch.times[current_challenge.submissions[member].id]
                        submissionTime.setValue(tools.timefix(this_submission.time))
                        submissionNotes.setValue(this_submission.notes)
                        submissionProof.setValue(this_submission.proof)
                        submissionRTA.setValue(this_submission.rta)
                        submissionPlatform.setValue(this_submission.platform)
                    }
                    const ActionRow1 = new ActionRowBuilder().addComponents(submissionTime)
                    const ActionRow2 = new ActionRowBuilder().addComponents(submissionNotes)
                    const ActionRow3 = new ActionRowBuilder().addComponents(submissionProof)
                    const ActionRow4 = new ActionRowBuilder().addComponents(submissionPlatform)
                    const ActionRow1a = new ActionRowBuilder().addComponents(submissionRTA)
                    submissionModal.addComponents(ActionRow1)
                    if (current_challenge.type == 'cotm') {
                        submissionModal.addComponents(ActionRow1a)
                    }
                    submissionModal.addComponents(ActionRow2, ActionRow3, ActionRow4)
                    await interaction.showModal(submissionModal)
                    break
                case 'submit':
                    let subtime = interaction.fields.getTextInputValue('challengeTime')
                    let subnotes = interaction.fields.getTextInputValue('challengeNotes').replace(/[^a-zA-Z0-9 ]/g, '')
                    let subproof = interaction.fields.getTextInputValue('challengeProof') ?? ""
                    let subplatform = interaction.fields.getTextInputValue('challengePlatform') ?? ""
                    let subrta = current_challenge.type == 'cotm' ? interaction.fields.getTextInputValue('challengeRTA') : ""

                    //challenge no longer active
                    if (!isActive(current_challenge, profile) && !current_challenge.submissions?.[member]) {
                        interaction.reply({
                            embeds: [expiredEmbed()], components: [
                                {
                                    type: 1,
                                    components: [playButton()]
                                }
                            ], ephemeral: true
                        })
                        return
                    }

                    //time doesn't make sense
                    if (isNaN(Number(subtime.replace(":", ""))) || tools.timetoSeconds(subtime) == null) {
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
                            .setDescription("Your time was submitted in an incorrect format.")
                        await interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }
                    let challengeend = Date.now()
                    let time = tools.timetoSeconds(subtime)
                    let rta = tools.timetoSeconds(subrta)
                    let platform = subplatform.toLowerCase()

                    //submitted time is impossible
                    if ((challengeend - current_challenge.created) < time * 1000 && !current_challenge.rescue && !current_challenge.guild == '1135800421290627112') {
                        current_challengeref.update({ completed: true, funny_business: true })
                        profileref.update({ funny_business: (profile.funny_business ?? 0) + 1 })
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> I warn you. No funny business.")
                            .setDescription("You submitted a time that was impossible to achieve in the given timeframe.")
                        await interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }

                    if (current_challenge.type == 'private' || current_challenge.submissions?.[member]) {
                        await interaction.deferUpdate()
                    } else {
                        await interaction.deferReply({ ephemeral: true })
                    }


                    if (current_challenge.submissions?.[member]) {
                        challengetimeref.child(current_challenge.submissions[member].id).update(
                            {
                                time: time,
                                notes: subnotes,
                                proof: subproof,
                                platform: platform,
                                rta: subrta
                            }
                        )

                        //update objects
                        current_challenge = db.ch.challenges[interaction.message.id]
                        profile = db.user[player].random //update profile

                        //update challenge
                        const edit_reply = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                        await interaction.editReply(edit_reply)
                        return
                    }

                    //log time
                    let submissiondata = {
                        user: member,
                        name: name,
                        time: time,
                        rta: rta,
                        platform: platform,
                        proof: subproof,
                        date: current_challenge.created,
                        racer: current_challenge.racer,
                        track: current_challenge.track,
                        notes: subnotes,
                        conditions: {
                            laps: current_challenge.conditions.laps,
                            nu: current_challenge.conditions.nu,
                            skips: current_challenge.conditions.skips,
                            mirror: current_challenge.conditions.mirror,
                            backwards: current_challenge.conditions.backwards,
                        },
                        settings: {
                            winnings: profile.settings.winnings,
                            no_upgrades: profile.settings.no_upgrades,
                            non_3_lap: profile.settings.non_3_lap,
                            skips: profile.settings.skips,
                            mirror_mode: profile.settings.mirror_mode,
                            backwards: profile.settings.backwards ?? 5,
                            predictions: profile.settings.predictions ?? true
                        },
                        challenge: interaction.message.id
                    }
                    if (current_challenge.hunt) {
                        submissiondata.hunt = profile.hunt.bonus
                    }
                    var newPostRef = challengetimeref.push(submissiondata);
                    await current_challengeref.child("submissions").child(member).set({ id: newPostRef.key, player: member, time })
                    if (['abandoned', 'private'].includes(current_challenge.type)) {
                        await current_challengeref.update({ completed: true })
                    }

                    let total_revenue = 0

                    //award winnings for this submission
                    let goals = goalTimeList(current_challenge, profile)
                    let winnings = challengeWinnings({ current_challenge, submitted_time: submissiondata, profile, best: getBest(db, current_challenge), goals, member, db })

                    //award saboteur cut
                    if (winnings.sabotage) {
                        let sabotage = profile.effects.sabotage[winnings.sabotage]
                        let dp = db.user[sabotage.player]?.random?.effects?.doubled_powers
                        manageTruguts({ profile: db.user[sabotage.player].random, profileref: database.ref(`users/${sabotage.player}/random`), transaction: 'd', amount: dp ? winnings.earnings : winnings.earnings * .5 })
                        winnings.earnings *= (dp ? 0 : 0.5)
                        profileref.child('effects').child('sabotage').child(winnings.sabotage).update({ used: true, challenge: interaction.message.id })
                    }

                    profile = manageTruguts({ profile, profileref, transaction: 'd', amount: winnings.earnings })

                    //award item
                    let earned_item = randomChallengeItem({ profile, profileref, current_challenge, db, member })
                    if (!profile.items) {
                        profileref.child('items').set('test')
                    }
                    let eitem = { id: earned_item.id, challenge: interaction.message.id, date: Date.now() }
                    if (earned_item.upgrade) {
                        eitem = { ...eitem, health: earned_item.health, upgrade: earned_item.upgrade }
                    }
                    profileref.child('items').push(eitem)

                    let ern = { truguts_earned: winnings.earnings, player: member, item: eitem.id }
                    if (winnings.sabotage) {
                        ern.sabotage = winnings.sabotage
                    }
                    current_challengeref.child("earnings").child(member).set(ern)
                    total_revenue += winnings.earnings

                    //award prediction winnings for this submission
                    if (current_challenge.predictions) {
                        Object.values(current_challenge.predictions).forEach(p => {
                            let take = predictionScore(p.time, time)
                            total_revenue += take
                            let predictorref = userref.child(p.user).child("random")
                            let predictorprofile = db.user[p.user].random
                            manageTruguts({ profile: predictorprofile, profileref: predictorref, transaction: 'd', amount: take })

                            //award achievements
                            if (predictionAchievement(db, p.member) >= achievement_data.force_sight.limit) {
                                if (current_challenge.guild == swe1r_guild) {
                                    let pmember = Guild.members.cache.get(p.member)
                                    if (pmember.roles.cache.some(r => r.id === achievement_data.force_sight.role)) { //award role
                                        pmember.roles.add(achievement_data.force_sight.role).catch(error => console.log(error))
                                    }
                                }
                                if (!db.user[p.user].random.achievements.force_sight) {
                                    postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.force_sight, current_challenge.guild)] })
                                    userref.child(p.user).child('random').child('achievements').child("force_sight").set(true)
                                }

                            }
                        })
                    }

                    //award sponsor cuts
                    if (current_challenge.sponsors) {
                        Object.keys(current_challenge.sponsors).forEach(async sponsorkey => {
                            let sponsor = current_challenge.sponsors[sponsorkey]

                            let thissponsor = db.user[sponsor.user]?.random
                            let sponsor_earnings = Math.round(total_revenue * (truguts.sponsor_cut * (thissponsor?.effects?.sorry_mess ? 2 : 1)) * sponsor.multiplier)
                            let thissponsorref = userref.child(sponsor.user).child("random")

                            manageTruguts({ profile: thissponsor, profileref: thissponsorref, transaction: 'd', amount: sponsor_earnings })
                            if (!current_challenge.sponsors[sponsor.member]?.earnings) {
                                await current_challengeref.child('sponsors').child(sponsorkey).child('earnings').set(0)
                            }
                            await current_challengeref.child('sponsors').child(sponsorkey).child('earnings').set((current_challenge.sponsors?.[sponsor.member]?.earnings ?? 0) + sponsor_earnings)
                        })
                    }
                    if (profile.sponsors) {
                        Object.values(profile.sponsors).forEach(async sponsor => {
                            let sponsor_profile = db.user[sponsor.player].random
                            let id = db.user[sponsor.player].discordID
                            let sponsor_earnings = Math.round(total_revenue * (Number(sponsor.take) * (sponsor_profile.effects?.sorry_mess ? 2 : 1) / 100))
                            manageTruguts({ profile: sponsor_profile, profileref: userref.child(sponsor.player).child('random'), transaction: 'd', amount: sponsor_earnings })
                            if (!current_challenge.sponsors?.[id]?.earnings) {
                                await current_challengeref.child('sponsors').child(id).update({ earnings: 0, name: `<@${db.user[sponsor.player].discordID}>` })
                            }
                            await current_challengeref.child('sponsors').child(id).child('earnings').set((current_challenge?.sponsors?.[id]?.earnings ?? 0) + sponsor_earnings)
                        })
                    }

                    //close bounties
                    if (current_challenge.bounties) {
                        Object.values(current_challenge.bounties).forEach(bounty => {
                            bountyref.child(bounty.key).update({ completed: true, player: { avatar, member, name, user: player } })
                        })
                        if (bountyAchievement(db, member) >= achievement_data.bounty_hunter.limit) {
                            if (current_challenge.guild == swe1r_guild) {
                                if (Member.roles.cache.some(r => r.id === achievement_data.bounty_hunter.role)) { //award role
                                    Member.roles.add(achievement_data.bounty_hunter.role).catch(error => console.log(error))
                                }
                            }
                            if (!profile.achievements.bounty_hunter) {
                                postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.bounty_hunter, current_challenge.guild)] })
                                profileref.child('achievements').child("bounty_hunter").set(true)
                            }

                        }
                    }

                    //handle streak
                    if (!profile.streak_start) { //no streak started
                        profileref.update({ streak_start: submissiondata.date, streak_end: submissiondata.date })
                    } else {
                        if (submissiondata.date - (1000 * 60 * 60 * 36) < profile.streak_end) { //streak continues
                            profileref.update({ streak_end: submissiondata.date })
                        } else { //streak broken
                            profileref.child("streaks").push(profile.streak_end - profile.streak_start)
                            profileref.update({ streak_start: submissiondata.date, streak_end: submissiondata.date })
                        }
                    }

                    //level progression
                    if (profile.progression) {
                        let progression = JSON.parse(JSON.stringify(profile.progression))
                        let player_level = playerLevel(profile.progression).level
                        let progress = challengeProgression({ current_challenge, submitted_time: time, goals, profile })
                        let level = convertLevel(profile.progression[progress.racer]).level
                        progression[progress.racer] += progress.points
                        let new_player_level = playerLevel(progression)
                        let new_level = convertLevel(progression[progress.racer]).level
                        console.log(new_level, level, new_player_level.level, player_level)
                        if (new_level !== level) {
                            let truguts = 0
                            let items = []
                            for (let i = level + 1; i < new_level + 1; i++) {
                                let reward = progressionReward({ racer: current_challenge.racer, level: new_level })
                                truguts += reward.truguts
                                if (reward.item) {
                                    items.push(reward.item)
                                }
                            }

                            manageTruguts({ profile, profileref, transaction: 'd', amount: truguts })
                            if (items.length) {
                                items.forEach(item => {
                                    profileref.child('items').push({
                                        id: item,
                                        date: Date.now(),
                                        progression: {
                                            racer: current_challenge.racer,
                                            level: new_level
                                        }
                                    })
                                })

                            }
                        }
                        if (new_player_level.level !== player_level) {
                            postMessage(client, interaction.channelId, { embeds: [new EmbedBuilder().setAuthor({ name: `${name} leveled up!`, iconURL: avatar }).setDescription(new_player_level.string).setFooter({ text: `Level ${new_player_level.level}` })] })
                        }
                        await profileref.child('progression').set(progression)
                    }


                    //update objects
                    current_challenge = db.ch.challenges[interaction.message.id]
                    profile = db.user[player].random //update profile

                    //collectionRewardUpdater({ profile, client, interaction, profileref, name, avatar })

                    //update challenge
                    const submit_reply = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })

                    if (current_challenge.type == 'private') {
                        interaction.editReply(submit_reply)
                    } else {
                        editMessage(client, current_challenge.channel, current_challenge.message, submit_reply)
                        let progress = challengeProgression({ current_challenge, submitted_time: time, goals, profile })
                        const receiptEmbed = new EmbedBuilder()
                            .addFields({ name: 'Winnings', value: winnings.receipt, inline: true })
                            .setFooter({ text: `Truguts: 📀${currentTruguts(profile)}` })
                            .addFields({ name: tools.getRacerName(progress.racer), value: progress.summary, inline: true })

                        if (![undefined, ""].includes(current_challenge.earnings?.[member]?.item)) {
                            let item = items.find(i => i.id == current_challenge.earnings[member].item)
                            let dup = profile.items ? Object.values(profile.items).filter(i => i.id == item.id).length > 1 ? true : false : false
                            receiptEmbed.addFields({ name: `${raritysymbols[item.rarity]} ${item.name}` + (item.health ? `[${Math.round(item.health * 100 / 255)} %]` : '') + (dup ? " (duplicate)" : ""), value: ` * ${item.description} * `, inline: true })
                        }

                        interaction.editReply({ embeds: [receiptEmbed], ephemeral: true })
                    }

                    break
                case 'drop':
                    let drop = Number(args[2])
                    database.ref(`challenge / drops`).push({
                        member,
                        message: interaction.message.id,
                        date: Date.now(),
                        drop
                    })
                    let p = manageTruguts({ profile, profileref, transaction: 'd', amount: drop })
                    interaction.reply({ components: [], content: `You snagged a \`📀${tools.numberWithCommas(drop)}\` drop\nCurrent truguts: \`📀${tools.numberWithCommas(p.truguts_earned - p.truguts_spent)}\``, ephemeral: true })
                    try {
                        interaction.message.delete()
                    } catch (err) {
                        console.log(err)
                    }
                    break
                case 'trade':

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

                    if (selected_item && !selected_item.includes('page_')) {
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

                        await database.ref(`challenge/trades/${trade_id}/traders/${player}`).update({ agreed: !trade.traders[player].agreed })
                        trade.traders[player].agreed = !trade.traders[player].agreed
                        if (!Object.values(trade.traders).map(t => t.agreed).includes(false)) {
                            //complete trade
                            traders.forEach(async trader => {
                                let opposite_trader = traders.filter(t => t !== trader)[0]
                                if (trade.traders[trader].truguts) {
                                    let trugut_trade = trade.traders[trader].truguts
                                    manageTruguts({ profile: db.user[trader].random, profileref: database.ref(`users/${trader}/random`), transaction: 'w', amount: trugut_trade })
                                    manageTruguts({ profile: db.user[opposite_trader].random, profileref: database.ref(`users/${opposite_trader}/random`), transaction: 'd', amount: trugut_trade })
                                }
                                if (trade.traders[trader].items) {
                                    Object.values(trade.traders[trader].items).forEach(async key => {
                                        let item = db.user[trader].random.items[key]
                                        if (!item.trades) {
                                            item.trades = []
                                        }
                                        item.trades.push(trade_id)
                                        await database.ref(`users/${opposite_trader}/random/items`).child(key).set(item)
                                        await database.ref(`users/${trader}/random/items/${key}`).remove()
                                    })
                                }
                            })
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
                        interaction.update({ embeds: [], components: [], content: `Trade offer was canceled by ${name}` })
                        return
                    } else if (args[2] == 'reset') {
                        traders.forEach(trader => {
                            database.ref(`challenge/trades/${trade_id}/traders/${trader}`).update({ agreed: false, truguts: 0, items: '' })
                        })
                    }

                    if (!traders.includes(player)) {
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Get lost!")
                            .setDescription("You are not a part of this trade.")
                        interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }
                    trade = db.ch.trades[trade_id]
                    interaction.update({ embeds: [tradeEmbed({ trade, db })], components: [...tradeComponents({ trade, db, selection: tselection })] })
                    break
            }
        }
    }
}