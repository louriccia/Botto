const { truguts, hints, settings_default, about, achievement_data, swe1r_guild } = require('./challenge/data.js');
const { getGoalTimes, initializeChallenge, initializePlayer, updateChallenge, bribeComponents, menuEmbed, menuComponents, playButton, notYoursEmbed, settingsEmbed, initializeUser, isActive, checkActive, expiredEmbed, challengeWinnings, getBest, goalTimeList, predictionScore, settingsComponents, achievementProgress, huntComponents, racerHint, trackHint, sponsorComponents, sponsorEmbed, validateTime, initializeBounty, bountyEmbed, manageTruguts, currentTruguts, predictionAchievement, sponsorAchievement, bountyAchievement, achievementEmbed, shopEmbed, shopComponents, profileComponents, profileEmbed, shopOptions } = require('./challenge/functions.js');
const { postMessage, editMessage } = require('../discord_message.js');
const { tracks, circuits, banners } = require('../data.js')
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'challenge',
    async execute(client, interaction, args, database, db) {
        let member = interaction.user.id
        const Guild = interaction.guild
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

        let player = null
        let playerdata = null
        await database.ref(`users`).orderByChild('discordID').equalTo(member).limitToFirst(1).once("value", async function (snapshot) {
            if (snapshot.exists()) {
                player = Object.keys(snapshot.val())[0]
                playerdata = snapshot.val()[player];
            } else {
                console.log('no user found')
            }
        }, function (errorObject) {
            console.log(errorObject)
            return null
        });
        if (!player) {
            player = initializeUser(userref, member, name)
        }
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

                    //check if challenge already in progress FIXME change to reposting challenge
                    let activechallenge = checkActive(db, member, current_challenge)
                    if (activechallenge) {
                        interaction.reply({ embeds: [activechallenge], ephemeral: true })
                        return
                    }
                    let type = interaction.member.voice?.channel?.id == '441840193754890250' ? 'multiplayer' : 'private'
                    current_challenge = initializeChallenge({ profile, member, type, name, avatar, user: player, db, interaction })
                    const reply = await updateChallenge({ client, db, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction })
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
                        if (current_challenge.type == 'private' && isActive(current_challenge) && !current_challenge.track_bribe && !current_challenge.racer_bribe) {
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

                    break
                case 'reroll':
                    if (!isActive(current_challenge)) { //expired challeneg
                        interaction.reply({ embeds: [expiredEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
                        return
                    }
                    if (!(current_challenge.player?.member == interaction.user.id && current_challenge.type == 'private' && isActive(current_challenge))) { //not the right player or not active
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
                    if (!isActive(current_challenge)) { //no longer active
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
                    profile = manageTruguts({ profile, profileref, transaction: 'd', amount: truguts.rated })

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
                        interaction.reply({ embeds: [menuEmbed()], components: menuComponents() })
                    } else {
                        interaction.update({ embeds: [menuEmbed()], components: menuComponents() })
                    }
                    break
                case 'shop':
                    const selection = [0, 1, 2, 3, 4].map(i => (i == interaction.customId.split("_")[3] ? interaction.values?.[0] : undefined) ?? interaction.message?.components[i]?.components[0]?.data?.options?.find(o => o.default == true)?.value ?? (interaction.message?.components[i]?.components[0]?.data?.options ? '' : null))
                    const shoptions = shopOptions({ profile, selection, player: member, db })
                    if (args[2] !== 'purchase') {
                        interaction.update({ embeds: [shopEmbed({ shoptions, selection, profile })], components: shopComponents({ profile, selection, shoptions, purchased: false }) })
                        return
                    }

                    if (selection[1] == 'hint') {
                        //get achievement progress
                        let achievements = achievementProgress({ db, player: member })
                        let achievement = selection[2]
                        let hint = selection[3]
                        const hintBuy = new EmbedBuilder()
                            .setColor("#ED4245")
                        if (profile.truguts_earned - profile.truguts_spent < hints[hint].price) {
                            hintBuy
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no hint!'*\nYou do not have enough truguts to buy the selected hint.\n\nHint cost: `" + hints[hint].price + "`")
                                .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })
                            interaction.reply({ embeds: [hintBuy], ephemeral: true })
                            return
                        }
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
                                if (!Object.keys(achievements.true_jedi.collection).includes(j + "," + l)) {
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
                                hintBuy.addFields({ name: "Track Hint", value: trackHint(track, Number(hint)).map(h => "○ *" + h + "*").join("\n") })
                            }
                            if (racer) {
                                hintBuy.addFields({ name: "Racer Hint", value: racerHint(racer, Number(hint)).map(h => "○ *" + h + "*").join("\n") })
                            }
                            // process purchase

                            hintBuy.setDescription("`-📀" + tools.numberWithCommas(hints[hint].price) + "`")
                            //profileref.update({ truguts_spent: profile.truguts_spent + hints[hint].price })
                            profile = manageTruguts({
                                profile, profileref, transaction: 'w', amount: hints[hint].price, purchase: {
                                    date: Date.now(),
                                    purchased_item: hints[hint].name,
                                    selection: achievement
                                }
                            })
                        }
                        hintBuy
                            .setAuthor({ name: name + "'s Random Challenge Hint", iconURL: avatar })
                            .setTitle(":bulb: " + hints[hint].name + ": " + achievements[achievement].name)
                            .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })

                        interaction.reply({ embeds: [hintBuy] })
                    } else if (selection[1] == 'bounty') {
                        let hselection = Number(selection[2])
                        if (profile.truguts_earned - profile.truguts_spent < hints[hselection].price) {
                            const hintBuy = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no bounty!'*\nYou do not have enough truguts to buy the selected bounty.\n\nBounty cost: `" + hints[hselection].price + "`")
                            interaction.reply({ embeds: [hintBuy], ephemeral: true })
                            return
                        }

                        //process purchase
                        profile = manageTruguts({
                            profile, profileref, transaction: 'w', amount: hints[hselection].price, purchase: {
                                date: Date.now(),
                                purchased_item: hints[hselection].name,
                                selection: "challenge_hunt"
                            }
                        })
                        let bounty = initializeBounty('private', hselection, { name, member, user: player, avatar })
                        const message = await interaction.reply({
                            embeds: [bountyEmbed(bounty, profile)], components: [
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
                    } else if (selection[1] == 'sponsorchallenge') {
                        let circuit = selection[2]

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
                                .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })
                            interaction.reply({ embeds: [cantSponsor], ephemeral: true })
                            return
                        }
                        if (profile.truguts_earned - profile.truguts_spent < circuits[0].sponsor) {
                            const cantSponsor = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no sponsor!'*\nYou do not have enough truguts to sponsor a challenge.")
                                .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })
                            interaction.reply({ embeds: [cantSponsor], ephemeral: true })
                            return
                        }

                        //process purchase
                        profile = manageTruguts({
                            profile, profileref, transaction: 'w', amount: circuits[circuit].sponsor, purchase: {
                                date: Date.now(),
                                purchased_item: 'sponsor',
                                selection: circuit
                            }
                        })
                        //initialize challenge
                        let sponsorchallenge = initializeChallenge({ profile, member, type: "private", name, avatar, user: player, circuit: circuit, db, interaction })
                        sponsorchallenge.type = 'open'
                        sponsorchallenge.sponsor = sponsorchallenge.player
                        delete sponsorchallenge.player


                        //reveal challenge
                        const sponsor = await interaction.reply({ embeds: [sponsorEmbed(sponsorchallenge, profile, 1)], components: sponsorComponents(profile, circuit, 1), ephemeral: true, fetchReply: true })

                        sponsorref.child(sponsor.id).set(sponsorchallenge)

                    } else if (selection[1] == 'shuffle_banner') {
                        let banner = banners[Math.floor(Math.random() * banners.length)]
                        if (Guild.id == '441839750555369474') {
                            await Guild.edit({ banner: banner })
                            manageTruguts({
                                profile, profileref, transaction: 'w', amount: 12000, purchase: {
                                    date: Date.now(),
                                    purchased_item: 'Banner Shuffle',
                                }
                            })
                        }
                        const shuffleBuy = new EmbedBuilder()
                            .setAuthor({ name: `${name} shuffled the server banner!`, iconURL: avatar })
                            .setImage(banner)
                        interaction.reply({ embeds: [shuffleBuy] })
                    }

                    editMessage(client, interaction.channel.id, interaction.message.id, { embeds: [shopEmbed({ shoptions, selection, profile })], components: shopComponents({ profile, selection, shoptions, purchased: true }) })

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
                            interaction.update({ embeds: [sponsorEmbed(sponsorchallenge, profile, 1)], components: sponsorComponents(profile, 1) })
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
                        sponsorchallenge.message = publishmessage.id
                        sponsorchallenge.url = publishmessage.url
                        sponsorref.child(interaction.message.id).update({ published: true, url: publishmessage.url })
                        challengesref.child(publishmessage.id).set(sponsorchallenge)

                        if (sponsorAchievement(db, member) >= achievement_data.bankroller_clan.limit) { //award achievement
                            if (current_challenge.guild == swe1r_guild) {
                                if (!Member.roles.cache.some(r => r.id === achievement_data.bankroller_clan.role)) { //award role
                                    Member.roles.add(achievement_data.bankroller_clan.role).catch(error => console.log(error))
                                }
                            }
                            if (!profile.achievements.bankroller_clan) {
                                postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.bankroller_clan, current_challenge.guild)] })
                                profileref.child('achievements').child("bankroller_clan").set(true)
                            }
                        }
                    } else {
                        interaction.reply({ embeds: [sponsorEmbed(null, profile, 0)], components: sponsorComponents(profile, cselection, 0), ephemeral: true })
                    }
                    break
                case 'settings':
                    if (args[2] == "winnings") {
                        profileref.child("settings").update({ winnings: Number(interaction.values[0]) })
                        profile = db.user[player].random
                        interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
                    } else if (args[2] == "predictions") {
                        profileref.child("settings").update({ predictions: !profile.settings.predictions })
                        profile = db.user[player].random
                        interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
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
                            profile = db.user[player].random
                            interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
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
                        profile = db.user[player].random
                        interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
                    } else {
                        profile = db.user[player].random
                        interaction.reply({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile), ephemeral: true })
                    }
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
                    interaction.editReply({ embeds: [profileEmbed({ db, player: member, page: args[2], name, avatar })], components: profileComponents({ member, page: args[2] }) })
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
                        challengeLeaderboard.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guild_id).members.resolve(user).user.avatarURL())
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
                    if (!isActive(current_challenge) && !current_challenge.submissions?.[member]) { //expired challeneg
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
                    if (!isActive(current_challenge) && !current_challenge.submissions?.[member]) { //challenge no longer active
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
                    if (isNaN(Number(subtime.replace(":", ""))) || tools.timetoSeconds(subtime) == null) { //time doesn't make sense
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
                    if ((challengeend - current_challenge.created) < time * 1000 && !current_challenge.rescue) { //submitted time is impossible
                        current_challengeref.update({ completed: true, funny_business: true })
                        profileref.update({ funny_business: (profile.funny_business ?? 0) + 1 })
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> I warn you. No funny business.")
                            .setDescription("You submitted a time that was impossible to achieve in the given timeframe.")
                        await interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }

                    await interaction.deferUpdate()

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
                    let winnings = challengeWinnings({ current_challenge, submitted_time: submissiondata, profile, best: getBest(db, current_challenge), goals: goalTimeList(current_challenge, profile), member })
                    //profileref.update({ truguts_earned: profile.truguts_earned + winnings.earnings })
                    profile = manageTruguts({ profile, profileref, transaction: 'd', amount: winnings.earnings })
                    current_challengeref.child("earnings").child(member).set({ truguts_earned: winnings.earnings, player: member })
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

                    //award sponsorship cut
                    if (current_challenge.sponsors) {
                        Object.values(current_challenge.sponsors).forEach(sponsor => {
                            let sponsor_earnings = Math.round(total_revenue * truguts.sponsor_cut * sponsor.multiplier)
                            let thissponsorref = userref.child(sponsor.user).child("random")
                            let thissponsor = db.user[sponsor.user].random
                            manageTruguts({ profile: thissponsor, profileref: thissponsorref, transaction: 'd', amount: sponsor_earnings })
                            if (!current_challenge.sponsors[sponsor.member]?.earnings) {
                                current_challenge.sponsors[sponsor.member].earnings = 0
                            }
                            current_challenge.sponsors[sponsor.member].earnings += sponsor_earnings
                            current_challengeref.update(current_challenge)
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

                    //update objects
                    current_challenge = db.ch.challenges[interaction.message.id]
                    profile = db.user[player].random //update profile

                    //update challenge
                    const submit_reply = await updateChallenge({ client, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, db })
                    interaction.editReply(submit_reply)

                    break
            }
        }
    }
}