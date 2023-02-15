const { truguts, hints, settings_default, about, achievement_data, swe1r_guild } = require('./challenge/data.js');
const { getGoalTimes, initializeChallenge, initializePlayer, updateChallenge, bribeComponents, menuEmbed, menuComponents, playButton, notYoursEmbed, hintEmbed, settingsEmbed, initializeUser, isActive, checkActive, expiredEmbed, challengeWinnings, getBest, goalTimeList, predictionScore, settingsComponents, achievementProgress, hintComponents, huntEmbed, huntComponents, racerHint, trackHint, sponsorComponents, sponsorEmbed, validateTime, initializeBounty, bountyEmbed, manageTruguts, currentTruguts, predictionAchievement, sponsorAchievement, bountyAchievement, achievementEmbed } = require('./challenge/functions.js');
const { postMessage, editMessage } = require('../discord_message.js');
const { tracks, circuits } = require('../data.js')
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'challenge',
    async execute(client, interaction, args) {
        let member = interaction.user.id
        const Discord = require('discord.js');
        const Guild = interaction.guild
        const Member = interaction.member
        const name = interaction.member.displayName
        const avatar = await interaction.member.displayAvatarURL()
        var tools = require('./../tools.js');
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");

        var challengetimeref = database.ref('challenge/times');
        challengetimeref.on("value", function (snapshot) {
            challengetimedata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var feedbackref = database.ref('challenge/feedback');
        feedbackref.on("value", function (snapshot) {
            feedbackdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var challengesref = database.ref('challenge/challenges');
        challengesref.on("value", function (snapshot) {
            challengesdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var userref = database.ref('users');
        userref.on("value", function (snapshot) {
            userdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });

        var sponsorref = database.ref('challenge/sponsorships');
        sponsorref.on("value", function (snapshot) {
            sponsordata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });

        var bountyref = database.ref('challenge/bounties');
        bountyref.on("value", function (snapshot) {
            bountydata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });

        //find player in userbase
        let player = null
        Object.keys(userdata).forEach(key => {
            if (userdata[key].discordID && userdata[key].discordID == member) {
                player = key
                return
            }
        })
        if (!player) {
            player = initializeUser(userref, member)
        }
        //initialize player if they don't exist
        let profile = userdata[player]?.random
        if (!profile) {
            profile = initializePlayer(userref.child(player).child('random'), name)
        }

        let profileref = userref.child(player).child('random')
        let current_challenge = null
        let current_challengeref = null
        if (!interaction.isChatInputCommand() && args[1] !== 'play') {
            current_challengeref = challengesref.child(interaction.message.id)
            current_challenge = challengesdata[interaction.message.id]
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
                if (Member.roles.cache.some(r => r.id === achievement_data.big_time_swindler.role)) { //award role
                    Member.roles.add(achievement_data.big_time_swindler.role).catch(error => console.log(error))
                }
            }
            if (!profile.achievements.big_time_swindler) {
                postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(name, avatar, achievement_data.big_time_swindler, current_challenge.guild)] })
                profileref.child('achievements').child("big_time_swindler").set(true)
            }
        }

        if (args[0] == "random") {
            switch (args[1]) {
                case 'play':

                    //check if challenge already in progress FIXME change to reposting challenge
                    let activechallenge = checkActive(challengesdata, member, current_challenge)
                    if (activechallenge) {
                        interaction.reply({ embeds: [activechallenge], ephemeral: true })
                        return
                    }
                    let type = interaction.member.voice?.channel?.id == '441840193754890250' ? 'multiplayer' : 'private'
                    current_challenge = initializeChallenge({ profile, member, type, name, avatar, user: player, sponsordata })
                    let message = await interaction.reply(updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))
                    current_challenge.message = message.id
                    current_challenge.channel = interaction.message.channelId
                    current_challenge.guild = interaction.guildId
                    current_challenge.url = message.url
                    challengesref.child(message.id).set(current_challenge)
                    current_challenge = challengesdata[message.id]
                    current_challengeref = challengesref.child(message.id)

                    setTimeout(async function () { //mark challenge abandoned
                        current_challenge = challengesdata[message.id]
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
                                current_challenge = challengesdata[message.id]
                            }
                            interaction.editReply(updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))

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
                            let thissponsor = userdata[sponsor.user].random
                            manageTruguts({ profile: thissponsor, profileref: thissponsorref, transaction: 'd', amount: sponsor_earnings })
                            current_challengeref.child('sponsors').child(sponsor.member).child('earnings').set((current_challenge.sponsors?.[sponsor.member]?.earnings ?? 0) + sponsor_earnings)
                        })
                    }

                    //clean up old challenge
                    challengesref.child(interaction.message.id).update({ completed: true, rerolled: true })
                    current_challenge = challengesdata[interaction.message.id]
                    editMessage(client, interaction.channel.id, interaction.message.id, updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))

                    //prepare new challenge
                    let rerolltype = 'private'
                    current_challenge = initializeChallenge({ profile, member, type: rerolltype, name, avatar, user: player, sponsordata })
                    let rerollmessage = await interaction.reply(updateChallenge({ client, challengetimedata, profile, current_challenge, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))
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

                    current_challenge = challengesdata[current_challenge.message]
                    //populate options
                    let adata = updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata })
                    if (!bribed) {
                        adata.components = [adata.components, bribeComponents(current_challenge)].flat()
                    }
                    interaction.update(adata)

                    break
                case 'predict':
                    if (interaction.isModalSubmit()) {
                        if (!isActive(current_challenge)) { //no longer active
                            const holdUp = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Bet you didn't predict that!")
                                .setDescription("Predictions are no longer available for this challenge.")
                            interaction.reply({ embeds: [holdUp], ephemeral: true })
                            return
                        }
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
                        var newPostRef = current_challengeref.child("predictions").child(member).set(predictiondata);
                        current_challenge = challengesdata[interaction.message.id]
                        let playeruser = current_challenge.player.user
                        interaction.update(updateChallenge({ client, challengetimedata, profile: userdata?.[playeruser]?.random, current_challenge, current_challengeref, profileref: userref.child(playeruser).child('random'), member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))
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
                // case 'undo':
                //     let newactive = checkActive(challengesdata, member, current_challenge)
                //     if (newactive) { //already has active challenge
                //         interaction.reply({ embeds: [newactive], ephemeral: true })
                //         return
                //     }
                //     if (current_challenge?.submissions?.[interaction.user.id]) {
                //         profileref.update({ truguts_earned: profile.truguts_earned - current_challenge.earnings[interaction.user.id].truguts_earned })
                //         current_challengeref.update({ completed: false })
                //         challengetimeref.child(current_challenge.submissions[interaction.user.id].id).remove() //remove submissions
                //         current_challengeref.child('earnings').child(interaction.user.id).remove()
                //         current_challengeref.child('submissions').child(interaction.user.id).remove()

                //         current_challenge = challengesdata[interaction.message.id]
                //         interaction.update(updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))
                //     } else {
                //         const noMoney = new EmbedBuilder()
                //             .setTitle("<:WhyNobodyBuy:589481340957753363> You must unsubmit what you have submitted.")
                //             .setDescription("You cannot undo a submission if you have not submitted a time.")
                //         interaction.reply({
                //             embeds: [noMoney],
                //             ephemeral: true
                //         })
                //     }
                //     break
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
                    current_challengeref.child('ratings').child(interaction.user.id).set({ user: player })
                    current_challengeref.child('earnings').child(interaction.user.id).update({ truguts_earned: current_challenge.earnings[interaction.user.id].truguts_earned + truguts.rated })

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
                    current_challenge = challengesdata[interaction.message.id]
                    interaction.update(updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))

                    break
                case 'menu':
                    interaction.reply({ embeds: [menuEmbed()], components: menuComponents() })
                    break
                case 'hint':
                    //get achievement progress
                    let achievements = achievementProgress({ challengetimedata, player: member })
                    const hEmbed = hintEmbed({ profile, name, avatar })
                    let achievement = null
                    let selection = null

                    let achievement_keys = Object.keys(achievements).filter(a => !profile?.achievements?.[a] && !['big_time_swindler', 'bounty_hunter', 'bankroller_clan', 'force_sight', 'lap_god'].includes(a))

                    if (!achievement_keys.length) {
                        hEmbed.setDescription("Wow! You've already earned all the achievements! This means you have no use for hints, but you can still earn a large Trugut bonus from a :dart: **Challenge Bounty**.")

                        interaction.reply({
                            embeds: [hEmbed], components: [{
                                type: 1, components: [new ButtonBuilder()
                                    .setCustomId("challenge_random_hunt")
                                    .setLabel("Challenge Bounty")
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji("🎯")]
                            }], ephemeral: true
                        })
                        return
                    }

                    if (args[2] == "achievement") {
                        achievement = interaction.values[0]
                        interaction.update({ embeds: [hEmbed], components: hintComponents(achievements, profile, achievement_keys, achievement, selection), ephemeral: true })
                    } else if (args[2] == "selection") {
                        let split = interaction.values[0].split(":")
                        achievement = split[0]
                        selection = Number(split[1])
                        interaction.update({ embeds: [hEmbed], components: hintComponents(achievements, profile, achievement_keys, achievement, selection), ephemeral: true })
                    } else if (args[2] == "purchase") {
                        let split = args[3].split(":")
                        achievement = split[0].replace("-", "_")
                        selection = Number(split[1])
                        const hintBuy = new EmbedBuilder()
                            .setColor("#ED4245")
                        if (profile.truguts_earned - profile.truguts_spent < hints[selection].price) {
                            hintBuy
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no hint!'*\nYou do not have enough truguts to buy the selected hint.\n\nHint cost: `" + hints[selection].price + "`")
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
                                hintBuy.addFields({ name: "Track Hint", value: trackHint(track, selection).map(h => "○ *" + h + "*").join("\n") })
                            }
                            if (racer) {
                                hintBuy.addFields({ name: "Racer Hint", value: racerHint(racer, selection).map(h => "○ *" + h + "*").join("\n") })
                            }
                            // process purchase

                            hintBuy.setDescription("`-📀" + tools.numberWithCommas(hints[selection].price) + "`")
                            //profileref.update({ truguts_spent: profile.truguts_spent + hints[selection].price })
                            profile = manageTruguts({
                                profile, profileref, transaction: 'w', amount: hints[selection].price, purchase: {
                                    date: Date.now(),
                                    purchased_item: hints[selection].name,
                                    selection: achievement
                                }
                            })
                        }
                        hintBuy
                            .setAuthor({ name: name + "'s Random Challenge Hint", iconURL: avatar })
                            .setTitle(":bulb: " + hints[selection].name + ": " + achievements[achievement].name)
                            .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })

                        interaction.reply({ embeds: [hintBuy] })
                    } else {
                        interaction.reply({ embeds: [hEmbed], components: hintComponents(achievements, profile, achievement_keys, achievement, selection), ephemeral: true })
                    }

                    break
                case 'hunt':
                    let hselection = null
                    if (args[2] == "selection") {
                        hselection = Number(interaction.values[0])
                        interaction.update({ embeds: [huntEmbed(profile)], components: huntComponents(profile, hselection) })
                    } else if (args[2] == "start") {
                        hselection = Number(args[3])
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
                        let message = await interaction.reply({
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
                    } else {
                        interaction.reply({ embeds: [huntEmbed(profile)], components: huntComponents(profile, hselection), ephemeral: true })
                    }
                    break
                case 'sponsor':
                    let cselection = null
                    if (profile.truguts_earned - profile.truguts_spent < circuits[0].sponsor) {
                        const cantSponsor = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                            .setDescription("*'No money, no sponsor!'*\nYou do not have enough truguts to sponsor a challenge.")
                            .setFooter({ text: "Truguts: 📀" + currentTruguts(profile) })
                        interaction.reply({ embeds: [cantSponsor], ephemeral: true })
                        return
                    }
                    let recent = null
                    Object.keys(sponsordata).forEach(key => {
                        if (sponsordata[key].sponsor?.member == interaction.user.id && (!recent || sponsordata[key].created > recent.date)) {
                            recent = { date: sponsordata[key].created, key }
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
                    if (args[2] == 'circuit') {
                        cselection = Number(interaction.values[0])
                        interaction.update({ embeds: [sponsorEmbed(null, profile, 0)], components: sponsorComponents(profile, cselection, 0) })
                    } else if (args[2] == 'submit') { //sponsorship is paid
                        //process purchase
                        cselection = Number(args[3])
                        //profileref.update({ truguts_spent: profile.truguts_spent + circuits[cselection].sponsor })

                        profile = manageTruguts({
                            profile, profileref, transaction: 'w', amount: circuits[cselection].sponsor, purchase: {
                                date: Date.now(),
                                purchased_item: 'sponsor',
                                selection: cselection
                            }
                        })
                        //initialize challenge
                        let sponsorchallenge = initializeChallenge({ profile, member, type: "private", name, avatar, user: player, circuit: cselection, sponsordata })
                        sponsorchallenge.type = 'open'
                        delete sponsorchallenge.player
                        sponsorref.child(interaction.message.id).set(sponsorchallenge)

                        //reveal challenge
                        interaction.update({ embeds: [sponsorEmbed(sponsorchallenge, profile, 1)], components: sponsorComponents(profile, cselection, 1) })
                    } else if (args[2] == 'details') { //set title / time
                        sponsorchallenge = sponsordata[interaction.message.id]
                        if (interaction.isModalSubmit()) {
                            let title = interaction.fields.getTextInputValue('customTitle')
                            let time = interaction.fields.getTextInputValue('customTime')
                            time = validateTime(time)

                            sponsorref.child(interaction.message.id).update({ title, time })

                            profile = userdata[player].random
                            sponsorchallenge = sponsordata[interaction.message.id]
                            interaction.update({ embeds: [sponsorEmbed(sponsorchallenge, profile, 1)], components: sponsorComponents(profile, cselection, 1) })
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
                        let sponsorchallenge = sponsordata[interaction.message.id]
                        if (sponsorchallenge.published) {
                            const cantSponsor = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?")
                                .setDescription("This sponsorship was already published at " + sponsorchallenge.url)
                            interaction.reply({ embeds: [cantSponsor], ephemeral: true })
                            return
                        }
                        let publishmessage = await interaction.reply(updateChallenge({ client, challengetimedata, profile, current_challenge: sponsorchallenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))
                        sponsorchallenge.message = publishmessage.id
                        sponsorchallenge.url = publishmessage.url
                        sponsorref.child(interaction.message.id).update({ published: true, url: publishmessage.url })
                        challengesref.child(publishmessage.id).set(sponsorchallenge)

                        if (sponsorAchievement(bountydata, member) >= achievement_data.bankroller_clan.limit) { //award achievement
                            if (current_challenge.guild == swe1r_guild) {
                                if (Member.roles.cache.some(r => r.id === achievement_data.bankroller_clan.role)) { //award role
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
                        profile = userdata[player].random
                        interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
                    } else if (args[2] == "predictions") {
                        profileref.child("settings").update({ predictions: !profile.settings.predictions })
                        profile = userdata[player].random
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
                            profile = userdata[player].random
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
                        profile = userdata[player].random
                        interaction.update({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile) })
                    } else {
                        profile = userdata[player].random
                        interaction.reply({ embeds: [settingsEmbed({ profile, name, avatar })], components: settingsComponents(profile), ephemeral: true })
                    }
                    break
                case 'profile':
                    const notAvailable = new EmbedBuilder()
                        .setTitle("<:WhyNobodyBuy:589481340957753363> I have great faith in the boy")
                        .setDescription("Profiles are currently unavailable. Please harass LightningPirate to get this feature updated.")
                    interaction.reply({ embeds: [notAvailable], ephemeral: true })
                    return

                    if (args[args.length - 1].startsWith("uid")) {
                        if (args[args.length - 1].replace("uid", "") !== member) {
                            const holdUp = new EmbedBuilder()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Profile!")
                                .setDescription("This is someone else's profile. Get your own by clicking the button below.")
                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: 4,
                                    data: {
                                        content: "",
                                        embeds: [holdUp],
                                        flags: 64,
                                        components: [
                                            {
                                                type: 1,
                                                components: [
                                                    {
                                                        type: 2,
                                                        custom_id: "challenge_random_profile_stats_new",
                                                        style: 4,
                                                        label: "Settings",
                                                        emoji: {
                                                            name: "📊"
                                                        }
                                                    },
                                                    {
                                                        type: 2,
                                                        style: 2,
                                                        custom_id: "challenge_random_menu_new",
                                                        emoji: {
                                                            name: "menu",
                                                            id: "862620287735955487"
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            })
                            return
                        }
                    }
                    async function sendCallback() {
                        var type = 6
                        if (args.includes("new")) {
                            type = 5
                        }
                        const wait = client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: type,
                                data: {
                                    content: "Coming right up..."
                                    //embeds: [racerEmbed]
                                }
                            }
                        })
                        return wait
                    }
                    async function sendResponse(embed) {
                        var stats_disabled = false, stats_style = 2, achievements_disabled = false, achievements_style = 2
                        if (args[2] == "stats") {
                            stats_disabled = true
                            stats_style = 4
                        }
                        if (args[2] == "achievements") {
                            achievements_disabled = true
                            achievements_style = 4
                        }
                        const response = await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({
                            data: {
                                embeds: [embed],
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                style: stats_style,
                                                custom_id: "challenge_random_profile_stats_uid" + member,
                                                label: "Stats",
                                                //emoji: { name: "📊"},
                                                disabled: stats_disabled
                                            },
                                            {
                                                type: 2,
                                                style: achievements_style,
                                                custom_id: "challenge_random_profile_achievements_uid" + member,
                                                label: "Achievements",
                                                //emoji: {    name: "🏆"},
                                                disabled: achievements_disabled
                                            },
                                            {
                                                type: 2,
                                                style: 2,
                                                custom_id: "challenge_random_menu_uid" + member,
                                                emoji: {
                                                    name: "menu",
                                                    id: "862620287735955487"
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        })
                        return response
                    }
                    sendCallback().then(() => {
                        const profileEmbed = new EmbedBuilder()
                        profileEmbed
                            .setAuthor(client.guilds.resolve(interaction.guild_id).members.resolve(member).user.username + "'s Random Challenge Profile", client.guilds.resolve(interaction.guild_id).members.resolve(member).user.avatarURL())
                        if (args[2] == "stats") {

                            var keys = Object.keys(challengesdata)
                            var stats = {
                                total: 0,
                                standard: 0,
                                skips: 0,
                                no_upgrades: 0,
                                non_3_lap: 0,
                                mirrored: 0
                            }
                            var times = {
                                total: 0,
                                elite: 0,
                                pro: 0,
                                rookie: 0,
                                amateur: 0,
                                youngling: 0
                            }
                            var bonuses = {
                                first: 0,
                                opponents_beat: 0,
                                pbs: 0,
                                non_standard: 0,
                                total_earnings: 0
                            }
                            var purchases = {
                                rerolls: 0,
                                track_bribes: 0,
                                racer_bribes: 0,
                                hints: 0,
                                total_spending: 0
                            }
                            bonuses.total_earnings = profile.truguts_earned
                            purchases.total_spending = profile.truguts_spent
                            if (profile.purchases !== undefined) {
                                var prchs = Object.keys(profile.purchases)
                                for (var p = 0; p < prchs.length; p++) {
                                    var purchase = prchs[p]
                                    if (["Basic Hint", "Standard Hint", "Deluxe Hint"].includes(profile.purchases[purchase].purchased_item)) {
                                        purchases.hints++
                                    }
                                    if (profile.purchases[purchase].purchased_item == "track bribe") {
                                        purchases.track_bribes++
                                    }
                                    if (profile.purchases[purchase].purchased_item == "racer bribe") {
                                        purchases.racer_bribes++
                                    }
                                    if (profile.purchases[purchase].purchased_item == "reroll") {
                                        purchases.rerolls++
                                    }
                                }
                            }

                            var mostPod = {}, mostTrack = {}, mostPlanet = {}, mostCircuit = {}, likePod = {}, likeTrack = {}, dislikePod = {}, dislikeTrack = {}
                            mostPod.most_count = 0
                            mostPod.most_name = null
                            mostTrack.most_count = 0
                            mostTrack.most_name = null
                            mostPlanet.most_count = 0
                            mostPlanet.most_name = null
                            mostCircuit.most_count = 0
                            mostCircuit.most_name = null
                            likePod.most_count = 0
                            likePod.most_name = null
                            likeTrack.most_count = 0
                            likeTrack.most_name = null
                            dislikePod.most_count = 0
                            dislikePod.most_name = null
                            dislikeTrack.most_count = 0
                            dislikeTrack.most_name = null
                            function getMost(obj, prop) {
                                if (obj[prop] == null) {
                                    obj[prop] = 1
                                } else {
                                    obj[prop]++
                                }
                                if (obj[prop] > obj.most_count) {
                                    obj.most_name = prop;
                                    obj.most_count = obj[prop];
                                }
                            }
                            var hasraced = false
                            for (var i = 0; i < keys.length; i++) {
                                var k = keys[i];
                                if (challengesdata[k].user == member) {
                                    stats.total++
                                    //time stats
                                    times.total += Number(challengesdata[k].time)
                                    var goals = getGoalTimes(challengesdata[k].track, challengesdata[k].racer, challengesdata[k].skips, challengesdata[k].nu, challengesdata[k].laps)
                                    var goal_array = ["elite", "pro", "rookie", "amateur", "youngling"]
                                    var goal_time = null
                                    for (var j = goals.length - 1; j > -1; j--) {
                                        if (challengesdata[k].time < goals[j]) {
                                            goal_time = j
                                        }
                                    }
                                    if (goal_time !== null) {
                                        times[goal_array[goal_time]]++
                                    }
                                    //stats
                                    if (!challengesdata[k].mirror && !challengesdata[k].nu && !challengesdata[k].skips && challengesdata[k].laps == 3) {
                                        stats.standard++
                                    } else {
                                        if (challengesdata[k].skips) {
                                            stats.skips++
                                            bonuses.non_standard++
                                        }
                                        if (challengesdata[k].nu) {
                                            stats.no_upgrades++
                                            bonuses.non_standard++
                                        }
                                        if (challengesdata[k].laps !== 3) {
                                            stats.non_3_lap++
                                            bonuses.non_standard++
                                        }
                                        if (challengesdata[k].mirror) {
                                            stats.mirrored++
                                            bonuses.non_standard++
                                        }
                                    }
                                    hasraced = true
                                    getMost(mostPod, challengesdata[k].racer)
                                    getMost(mostTrack, challengesdata[k].track)
                                    getMost(mostPlanet, tracks[challengesdata[k].track].planet)
                                    getMost(mostCircuit, tracks[challengesdata[k].track].circuit)
                                    var first = true
                                    var pb = false
                                    var beat = []
                                    for (var p = 0; p < keys.length; p++) {
                                        var n = keys[p]
                                        if (challengesdata[n].track == challengesdata[k].track && challengesdata[n].racer == challengesdata[k].racer && challengesdata[n].skips == challengesdata[k].skips && challengesdata[n].nu == challengesdata[k].nu && challengesdata[n].laps == challengesdata[k].laps && challengesdata[n].mirror == challengesdata[k].mirror) {
                                            if (challengesdata[n].date < challengesdata[k].date) {
                                                first = false
                                                if (challengesdata[n].user == member) {
                                                    pb = true
                                                    if (challengesdata[n].time < challengesdata[k].time) {
                                                        pb = false
                                                    }
                                                }
                                            }
                                            if (challengesdata[n].user !== member && challengesdata[n].time > challengesdata[k].time && challengesdata[n].date < challengesdata[k].date && !beat.includes(challengesdata[n].user)) {
                                                beat.push(challengesdata[n].user)
                                            }
                                        }
                                    }
                                    bonuses.opponents_beat += beat.length
                                    if (first) {
                                        bonuses.first++
                                    }
                                    if (pb) {
                                        bonuses.pbs++
                                    }
                                }
                            }
                            var keys = Object.keys(feedbackdata)
                            var hasliked = false
                            var hasdisliked = false
                            for (var i = 0; i < keys.length; i++) {
                                var k = keys[i];
                                if (feedbackdata[k].user == member) {
                                    if (feedbackdata[k].feedback == "👍") {
                                        hasliked = true
                                        getMost(likePod, feedbackdata[k].racer)
                                        getMost(likeTrack, feedbackdata[k].track)
                                    } else if (feedbackdata[k].feedback == "👎") {
                                        hasdisliked = true
                                        getMost(dislikePod, feedbackdata[k].racer)
                                        getMost(dislikeTrack, feedbackdata[k].track)
                                    }

                                }
                            }
                            profileEmbed
                                .setTitle("Statistics")
                                .setDescription("Current trugut balance: `📀" + currentTruguts(profile) + "`")
                            //add goal times achieved for the stat section
                            if (hasraced) {
                                profileEmbed
                                    .addField(":bar_chart: Challenge Stats", "Total: `" + stats.total + "`\nStandard: `" + stats.standard + "`\nSkips: `" + stats.skips + "`\nNo Upgrades: `" + stats.no_upgrades + "`\nNon 3-Lap: `" + stats.non_3_lap + "`\nMirrored: `" + stats.mirrored + "`", true)
                                    .addField(":chart_with_upwards_trend: Gameplay Trends", "**Most Played Pod:** \n" + racers[mostPod.most_name].flag + " " + racers[mostPod.most_name].name + " `" + mostPod.most_count + "`" +
                                        "\n**Most Played Track:**\n" + tracks[mostTrack.most_name].name + " `" + mostTrack.most_count + "`" +
                                        "\n**Most Played Planet:**\n" + planets[mostPlanet.most_name].name + " `" + mostPlanet.most_count + "`" +
                                        "\n**Most Played Circuit:**\n" + circuits[mostCircuit.most_name].name + " `" + mostCircuit.most_count + "`", true)
                            } else {
                                profileEmbed
                                    .addField(":bar_chart: Challenge Stats", "No challenge data", true)
                                    .addField(":chart_with_upwards_trend: Gameplay Trends", "No gameplay data", true)
                            }
                            var feedbacktrend = ""
                            if (hasliked) {
                                feedbacktrend += "**Most Liked Pod:** \n" + racers[likePod.most_name].flag + " " + racers[likePod.most_name].name + " `👍" + likePod.most_count + "`" +
                                    "\n**Most Liked Track:**\n" + tracks[likeTrack.most_name].name + " `👍" + likeTrack.most_count + "`\n"
                            }
                            if (hasdisliked) {
                                feedbacktrend += "**Most Disliked Pod:**\n" + racers[dislikePod.most_name].flag + " " + racers[dislikePod.most_name].name + " `👎" + dislikePod.most_count + "`" +
                                    "\n**Most Disliked Track:**\n" + tracks[dislikeTrack.most_name].name + " `👎" + dislikeTrack.most_count + "`"
                            }
                            if (feedbacktrend == "") {
                                feedbacktrend = "No feedback data"
                            }
                            profileEmbed
                                .addField(":pencil: Feedback Trends", feedbacktrend, true)
                                .addField(":stopwatch: Time Stats", "Total time: `" + tools.timefix(times.total) + "`\n" +
                                    "Elite: `" + times.elite + "`\n" +
                                    "Pro: `" + times.pro + "`\n" +
                                    "Rookie: `" + times.rookie + "`\n" +
                                    "Amateur: `" + times.amateur + "`\n" +
                                    "Youngling: `" + times.youngling + "`", true)
                                .addField(":moneybag: Bonus Stats", "Firsts: `" + bonuses.first + "`\n" +
                                    "Opponents Beat: `" + bonuses.opponents_beat + "`\n" +
                                    "Personal Bests: `" + bonuses.pbs + "`\n" +
                                    "Non-Standard: `" + bonuses.non_standard + "`\n" +
                                    "Total Earnings: `📀" + tools.numberWithCommas(bonuses.total_earnings) + "`", true)
                                .addField(":shopping_cart: Purchase Stats", "Rerolls: `" + purchases.rerolls + "`\n" +
                                    "Track Bribes: `" + purchases.track_bribes + "`\n" +
                                    "Racer Bribes: `" + purchases.racer_bribes + "`\n" +
                                    "Hints: `" + purchases.hints + "`\n" +
                                    "Total Spending: `📀" + tools.numberWithCommas(purchases.total_spending) + "`", true)
                        } else if (args[2] == "achievements") {
                            var keys = Object.keys(challengesdata)
                            for (var i = 0; i < keys.length; i++) {
                                var k = keys[i];
                                if (challengesdata[k].user == member) {
                                    achievements.galaxy_famous.collection[String(challengesdata[k].track)] = 1
                                    achievements.pod_champ.collection[String(challengesdata[k].racer)] = 1
                                    if (challengesdata[k].skips) {
                                        achievements.light_skipper.collection[String(challengesdata[k].track)] = 1
                                    }
                                    if (challengesdata[k].nu) {
                                        achievements.slow_steady.collection[String(challengesdata[k].racer)] = 1
                                    }
                                    if (challengesdata[k].mirror) {
                                        achievements.mirror_dimension.collection[String(challengesdata[k].track)] = 1
                                    }
                                    if (challengesdata[k].racer == tracks[String(challengesdata[k].track)].favorite) {
                                        achievements.crowd_favorite.collection[String(challengesdata[k].track)] = 1
                                    }
                                    achievements.true_jedi.collection[String(challengesdata[k].track + " " + challengesdata[k].racer)] = 1
                                }
                            }
                            if (member == interaction.member.user.id) {
                                //award achievement if gotten
                                if (profile.achievements == undefined) {
                                    var ach = {
                                        galaxy_famous: false,
                                        pod_champ: false,
                                        light_skipper: false,
                                        slow_steady: false,
                                        mirror_dimension: false,
                                        crowd_favorite: false,
                                        true_jedi: false,
                                        big_time_swindler: false
                                    }
                                    profileref.child("achievements").set(ach)
                                }
                                var achvs = Object.keys(achievements)
                                for (var i = 0; i < achvs.length; i++) {
                                    var a = achvs[i]
                                    achievements[a].count = Object.keys(achievements[a].collection).length
                                    if (achievements[a].name == "Big-Time Swindler") {
                                        achievements[a].count = profile.truguts_spent + profile.truguts_earned
                                    }
                                    if (achievements[a].count >= achievements[a].limit && profile.achievements[a] == false) {
                                        profileref.child("achievements").child(a).set(true)
                                        const congratsEmbed = new EmbedBuilder()
                                            .setAuthor(interaction.member.user.username + " got an achievement!", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                                            .setDescription(achievements[a].description) //+ " `" + String(Object.keys(achievements[a].collection).length) + "/" + String(achievements[a].limit)) + "`"
                                            .setColor("FFB900")
                                            .setTitle(":trophy: " + achievements[a].name)
                                        if (interaction.guild_id == "441839750555369474") {
                                            congratsEmbed.setDescription("**<@&" + achievements[a].role + ">** - " + achievements[a].description)
                                            Member.roles.add(achievements[a].role).catch(error => console.log(error))
                                        }
                                        client.channels.cache.get(interaction.channel_id).send(congratsEmbed)
                                    }
                                }
                            }
                            var achvs = Object.keys(achievements)
                            var achievement_count = 0
                            for (var i = 0; i < achvs.length; i++) {
                                var a = achvs[i]
                                achievements[a].count = Object.keys(achievements[a].collection).length
                                if (achievements[a].name == "Big-Time Swindler") {
                                    achievements[a].count = profile.truguts_spent + profile.truguts_earned
                                }
                                var achievement_title = ""
                                var achievement_text = ""
                                if (achievements[a].count >= achievements[a].limit) {
                                    achievement_title += ":white_check_mark: "
                                    achievement_count++
                                } else {
                                    achievement_title += ":trophy: "
                                }
                                achievement_title += achievements[a].name + "  `" + tools.numberWithCommas(achievements[a].count) + "/" + tools.numberWithCommas(achievements[a].limit) + "`"
                                achievement_text = achievements[a].description
                                profileEmbed.addField(achievement_title, achievement_text, false)
                            }
                            profileEmbed.setTitle("Achievements (" + achievement_count + "/8)")
                        }
                        return profileEmbed
                    }).then((embed) => sendResponse(embed))
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
                    var challenge = Object.values(challengesdata)
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
                    let active = checkActive(challengesdata, member, current_challenge)
                    if (active) { //already has active challenge
                        interaction.reply({ embeds: [active], ephemeral: true })
                        return
                    }
                    if (!isActive(current_challenge)) { //expired challeneg
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
                    if (current_challenge.submissions?.[member]) { //already submitted
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> You seem familiar...")
                            .setDescription("You already submitted a time for this challenge. Why not try a new one?")
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
                    const submissionModal = new ModalBuilder()
                        .setCustomId('challenge_random_submit')
                        .setTitle('Submit Results')
                    const submissionTime = new TextInputBuilder()
                        .setCustomId('challengeTime')
                        .setLabel('Total Time')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(9)
                        .setMinLength(6)
                        .setPlaceholder("--:--.---")
                        .setRequired(true)
                    const submissionNotes = new TextInputBuilder()
                        .setCustomId('challengeNotes')
                        .setLabel('Notes')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(25)
                        .setMinLength(0)
                        .setPlaceholder("")
                        .setRequired(false)
                    const ActionRow1 = new ActionRowBuilder().addComponents(submissionTime)
                    const ActionRow2 = new ActionRowBuilder().addComponents(submissionNotes)
                    submissionModal.addComponents(ActionRow1, ActionRow2)
                    await interaction.showModal(submissionModal)
                    break
                case 'submit':
                    let subtime = interaction.fields.getTextInputValue('challengeTime')
                    let subnotes = interaction.fields.getTextInputValue('challengeNotes')

                    if (!isActive(current_challenge)) { //challenge no longer active
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
                        interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }
                    let challengeend = Date.now()
                    let time = tools.timetoSeconds(subtime)
                    if ((challengeend - current_challenge.created) < time * 1000) { //submitted time is impossible
                        current_challengeref.update({ completed: true, funny_business: true })
                        profileref.update({ funny_business: (profile.funny_business ?? 0) + 1 })
                        const holdUp = new EmbedBuilder()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> I warn you. No funny business.")
                            .setDescription("You submitted a time that was impossible to achieve in the given timeframe.")
                        interaction.reply({ embeds: [holdUp], ephemeral: true })
                        return
                    }
                    //log time
                    let submissiondata = {
                        user: member,
                        name: name,
                        time: time,
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


                    //handle streak
                    if (!profile.streak_start) { //no streak started
                        profileref.update({ streak_start: submissiondata.date, streak_end: submissiondata.date })
                    } else {
                        if (submissiondata.date - (1000 * 60 * 60 * 25) < profile.streak_end) { //streak continues
                            profileref.update({ streak_end: submissiondata.date })
                        } else { //streak broken
                            profileref.child("streaks").push(profile.streak_end - profile.streak_start)
                            profileref.update({ streak_start: submissiondata.date, streak_end: submissiondata.date })
                        }
                    }


                    let total_revenue = 0

                    //award winnings for this submission
                    let winnings = challengeWinnings({ current_challenge, submitted_time: submissiondata, profile, best: getBest(challengetimedata, current_challenge), goals: goalTimeList(current_challenge, profile), member })
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
                            let predictorprofile = userdata[p.user].random
                            manageTruguts({ profile: predictorprofile, profileref: predictorref, transaction: 'd', amount: take })

                            //award achievements
                            if (predictionAchievement(challengesdata, p.member) >= achievement_data.force_sight.limit) {
                                if (current_challenge.guild == swe1r_guild) {
                                    let pmember = Guild.members.cache.get(p.member)
                                    if (pmember.roles.cache.some(r => r.id === achievement_data.force_sight.role)) { //award role
                                        pmember.roles.add(achievement_data.force_sight.role).catch(error => console.log(error))
                                    }
                                }
                                if (!userdata[p.user].random.achievements.force_sight) {
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
                            let thissponsor = userdata[sponsor.user].random
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
                        if (bountyAchievement(bountydata, member) >= achievement_data.bounty_hunter.limit) {
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

                    //update objects
                    current_challenge = challengesdata[interaction.message.id]
                    profile = userdata[player].random //update profile

                    //update challenge
                    interaction.update(updateChallenge({ client, challengetimedata, profile, current_challenge, current_challengeref, profileref, member, name, avatar, interaction, sponsordata, bountydata, challengesdata }))

                    break
            }
        }
    }
}