const e = require('express');
const { get } = require('request');

import { achievements, truguts, hints, tips, settings_default, winnings_map } from './challenge/data.js';
import { getGoalTimes, initializeChallenge, initializePlayer, updateChallenge, bribeComponents, menuEmbed, menuComponents, playButton, notYoursEmbed, hintEmbed, settingsEmbed, initializeUser } from './challenge/functions.js';
import { modalMessage } from '../discord_message.js';

module.exports = {
    name: 'challenge',
    async execute(client, interaction, args) {
        let member = interaction.member.user.id
        const Discord = require('discord.js');
        const Guild = client.guilds.cache.get(interaction.guild_id)
        const Member = Guild.members.cache.get(member)
        const name = interaction.member.nick
        var tools = require('./../tools.js');
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");

        var timeref = database.ref('challenge/times');
        timeref.on("value", function (snapshot) {
            timedata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var feedbackref = database.ref('challenge/feedback');
        feedbackref.on("value", function (snapshot) {
            feedbackdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var challengeref = database.ref('challenge/challenges');
        challengeref.on("value", function (snapshot) {
            challengedata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var userref = database.ref('users');
        userref.on("value", function (snapshot) {
            userdata = snapshot.val();
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
            profile = initializePlayer(userdata.child(player))
        }

        let profileref = userref.child(player).child('random')
        let current_challenge = challengedata[profile.current] ?? null
        let current_challengeref = challengeref.child(profile.current)

        if (args[0] == "random") {
            switch (args[1]) {
                case 'play':
                    let challengestart = Date.now()
                    //check if challenge already in progress FIXME change to reposting challenge
                    if (current_challenge && current_challenge.completed == false && current_challenge.start > challengestart - 900000) {
                        let challengeinProgress = new Discord.MessageEmbed()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Challenge in Progress")
                            .setDescription("You already have a challenge in progress in the <#" + current_challenge.channel + "> channel.\nIf you have enough truguts, you can reroll the challenge by clicking the :game_die: **Reroll** button on your challenge, otherwise you will need to wait until the challenge expires to roll a new one.")
                        interaction.reply({ embed: challengeinProgress, ephemeral: true })
                        return
                    }

                    current_challenge = initializeChallenge({ profile, member, challengeref, profileref, interaction })
                    let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                    let message = await interaction.reply({ embeds: [data.message], components: [data.components], fetchReply: true })
                    challengeref.child(message.id).set(challenge)

                    if (current_challenge.type == 'private') {
                        setTimeout(async function () { //mark challenge abandoned
                            let main_components = [
                                playButton(),
                                { type: 2, style: 2, custom_id: "challenge_random_menu", emoji: { name: "menu", id: "862620287735955487" } }
                            ]
                            if (!current_challenge.completed) {
                                profileref.child("current").update({ completed: true })
                                let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                                interaction.editReply({ embeds: [data.message], components: [main_components] })
                            } else {
                                interaction.editReply({ components: [main_components] })
                            }
                        }, 895000)
                    }
                    break
                case 'reroll':
                    if (interaction.message.id == current_challenge.message) {
                        if (profile.truguts_earned - profile.truguts_spent >= current_challenge.reroll_cost) {
                            //process purchase
                            if (current_challenge.reroll_cost > 0) {
                                profileref.child("purchases").push({
                                    date: Date.now(),
                                    purchased_item: "reroll",
                                    selection: current_challenge.reroll_cost == truguts.reroll ? "full price" : "discount"
                                })
                                profileref.update({ truguts_spent: profile.truguts_spent + current_challenge.reroll_cost })
                            }
                            profileref.child("current").update({ completed: true, rerolled: true, title: ":arrows_counterclockwise: Rerolled: " })
                            let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                            interaction.editReply({ embeds: [data.message] })
                            client.buttons.get("challenge").execute(client, interaction, ["random", "play"])
                        } else {
                            let noMoney = new Discord.MessageEmbed()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nReroll cost: `📀" + tools.numberWithCommas(truguts.reroll) + "`")
                            interaction.reply({ embeds: [noMoney], ephemeral: true })
                        }
                    } else {
                        interaction.reply({
                            embeds: [notYoursEmbed()],
                            components: [{ type: 1, components: [playButton()] }],
                            ephemeral: true
                        })
                    }
                    break
                case 'bribe':
                    if (interaction.message.id == current_challenge.message) {
                        if (interaction.data.values) {
                            let purchase = {
                                date: Date.now(),
                                selection: Number(interaction.data.values[0])
                            }
                            let bribe_cost = 0
                            if (args[2] == "track") {
                                bribe_cost = truguts.bribe_track
                                purchase.purchased_item = "track bribe"
                            } else if (args[2] == "racer") {
                                bribe_cost = truguts.bribe_racer
                                purchase.purchased_item = "racer bribe"
                            }
                            if (profile.truguts_earned - profile.truguts_spent < bribe_cost) {
                                //player doesn't have enough money
                                let noMoney = new Discord.MessageEmbed()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                    .setDescription("*'No money, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nBribe cost: `" + tools.numberWithCommas(bribe_cost) + "`")
                                interaction.reply({ embeds: [noMoney], ephemeral: true })
                                return
                            } else {
                                //process purchase
                                let bribed = false
                                if (args[2] == "track" && selection !== current_challenge.track) {
                                    profileref.child("current").update({ track_bribe: true, track: selection })
                                    bribed = true
                                    if (!tracks[selection].parskiptimes) {
                                        profileref.child("current").update({ skips: false })
                                    }
                                } else if (args[2] == "racer" && selection !== current_challenge.racer) {
                                    profileref.child("current").update({ racer_bribe: true, racer: selection })
                                    bribed = true
                                }
                                if (bribed) {
                                    profileref.child("purchases").push(purchase)
                                    profileref.update({ truguts_spent: profile.truguts_spent + bribe_cost })
                                }
                            }
                        }
                        //populate options
                        let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                        interaction.editReply({ embeds: [data.message], components: [bribeComponents(profile)] })
                    } else {
                        interaction.reply({ embeds: [notYoursEmbed()], components: [{ type: 1, components: [playButton()] }] })
                    }
                    break
                case 'undo':
                    if (interaction.message.id == current_challenge.message && current_challenge.completed) {
                        profileref.update({ truguts_earned: profile.truguts_earned - current_challenge.truguts_earned })
                        profileref.child("current").update({ truguts_earned: 0, title: "", completed: false, undone: true })
                        timeref.child(current_challenge.submission).remove()

                        let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                        interaction.editReply({ embeds: [data.message], components: [data.components] })
                    } else {
                        interaction.reply({
                            embeds: [notYoursEmbed()],
                            components: [{
                                type: 1,
                                components: [playButton()]
                            }],
                            ephemeral: true
                        })
                    }
                    break
                case 'like':
                case 'dislike':
                    if (interaction.message.id == current_challenge.message && current_challenge.rated == false) {
                        profileref.child("current").update({ rated: true })
                        profileref.update({ truguts_earned: profile.truguts_earned + truguts.rated })
                        feedbackref.push({
                            user: member,
                            feedback: args[1] == "dislike" ? "👎" : '👍',
                            date: current_challenge.start,
                            racer: current_challenge.racer,
                            track: current_challenge.track,
                            conditions: {
                                laps: current_challenge.conditions.laps,
                                nu: profile.current.conditions.nu,
                                skips: profile.current.conditions.skips,
                                mirror: profile.current.conditions.mirror,
                                backwards: profile.current.conditions.backwards
                            }
                        });
                        let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                        interaction.editReply({ embeds: [data.message], components: [data.componenets] })
                    } else {
                        interaction.reply(
                            {
                                embeds: [notYoursEmbed()],
                                components: [{
                                    type: 1,
                                    components: [playButton()]
                                }],
                                ephemeral: true
                            })
                    }
                    break
                case 'menu':
                    interaction.reply({ embeds: [menuEmbed()], components: [menuComponents()] })
                    break
                case 'hint':
                    //get achievement progress
                    let keys = Object.keys(challengedata)
                    for (let i = 0; i < keys.length; i++) {
                        let k = keys[i];
                        if (challengedata[k].user == member) {
                            if (!achievements.galaxy_famous.array.includes(challengedata[k].track)) {
                                achievements.galaxy_famous.array.push(challengedata[k].track)
                            }
                            if (!achievements.pod_champ.array.includes(challengedata[k].racer)) {
                                achievements.pod_champ.array.push(challengedata[k].racer)
                            }
                            if (challengedata[k].skips && !achievements.light_skipper.array.includes(challengedata[k].track)) {
                                achievements.light_skipper.array.push(challengedata[k].track)
                            }
                            if (challengedata[k].nu && !achievements.slow_steady.array.includes(challengedata[k].racer)) {
                                achievements.slow_steady.array.push(challengedata[k].racer)
                            }
                            if (challengedata[k].mirror && !achievements.mirror_dimension.array.includes(challengedata[k].track)) {
                                achievements.mirror_dimension.array.push(challengedata[k].track)
                            }
                            if (challengedata[k].backwards && !achievements.backwards_compatible.array.includes(challengedata[k].track)) {
                                achievements.backwards_compatible.array.push(challengedata[k].track)
                            }
                            if (challengedata[k].racer == tracks[challengedata[k].track].favorite && !achievements.crowd_favorite.array.includes(challengedata[k].track)) {
                                achievements.crowd_favorite.array.push(challengedata[k].track)
                            }
                            if (!achievements.true_jedi.array.includes(challengedata[k].track + "," + challengedata[k].racer)) {
                                achievements.true_jedi.array.push(challengedata[k].track + "," + challengedata[k].racer)
                            }
                        }
                    }

                    let achievement = null, selection = null

                    if (!args.includes("initial")) {
                        if (args[args.length - 1].startsWith("uid")) {
                            if (args[args.length - 1].replace("uid", "") !== member) {
                                const hintMessage = new Discord.MessageEmbed()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Hints!")
                                    .setDescription("This is someone else's hint menu. Get your own by clicking the button below.")
                                interaction.reply({
                                    embeds: [hintMessage], components: [
                                        {
                                            type: 1,
                                            components: [
                                                {
                                                    type: 2,
                                                    custom_id: "challenge_random_hint_initial_new",
                                                    style: 4,
                                                    label: "Hints",
                                                    emoji: {
                                                        name: "💡"
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
                                    ],
                                    ephemeral: true
                                })
                                return
                            }
                        }
                        for (let i = 0; i < interaction.message.components[0].components[0].options.length; i++) {
                            if (interaction.message.components[0].components[0].options[i].default) {
                                achievement = option.value
                            }
                        }
                        for (let i = 0; i < interaction.message.components[1].components[0].options.length; i++) {
                            if (interaction.message.components[1].components[0].options[i].default) {
                                selection = i
                            }
                        }
                    }
                    if (args[2] == "achievement") {
                        achievement = interaction.data.values[0]
                    } else if (args[2] == "selection") {
                        selection = Number(interaction.data.values[0])
                    }
                    const hintEmbed = hintEmbed()
                    //get options for components
                    let components = [], achievement_options = [], selection_options = [], disabled = false
                    let ach = Object.keys(achievements)
                    for (i = 0; i < ach.length; i++) {
                        if (profile.achievements[ach[i]] == false && ach[i] !== "big_time_swindler") {
                            let option = {
                                label: achievements[ach[i]].name,
                                value: ach[i],
                                description: achievements[ach[i]].description + ": " + achievements[ach[i]].array.length + "/" + achievements[ach[i]].limit,
                                emoji: {
                                    name: "🏆"
                                }
                            }
                            option.default = achievement == ach[i]
                            achievement_options.push(option)
                        }
                    }
                    for (i = 0; i < hints.length; i++) {
                        let option = {
                            label: hints[i].name,
                            value: i,
                            description: "📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description,
                            emoji: {
                                name: "💡"
                            }
                        }
                        option.default = selection == i
                        if (profile.truguts_earned - profile.truguts_spent >= hints[i].price) {
                            selection_options.push(option)
                        }
                    }
                    //if a hint can be purchased
                    if (achievement_options.length > 0) {
                        components.push({
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "challenge_random_hint_achievement_uid" + member,
                                    options: achievement_options,
                                    placeholder: "Select Achievement",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        },
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "challenge_random_hint_selection_uid" + member,
                                        options: selection_options,
                                        placeholder: "Select Hint Type",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]
                            },
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        custom_id: "challenge_random_hint_purchase_uid" + member,
                                        label: "Buy Hint",
                                        style: 4,
                                        disabled: [achievement, selection].includes(null)
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
                            })
                        hintEmbed
                            .setDescription("Hints help you narrow down what challenges you need to complete for :trophy: **Achievements**. The more you pay, the better the hint.")
                            .setFooter(interaction.member.user.username + " | Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent), client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                    } else {
                        hintEmbed.setDescription("Wow! You've already earned all the achievements! This means you have no use for hints, but you can still earn a large Trugut bonus from a :dart: **Challenge Hunt**.")
                        components.push({
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    custom_id: "challenge_random_hunt_initial",
                                    label: "Challenge Hunt",
                                    style: 4,
                                    emoji: {
                                        name: "🎯"
                                    }
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    custom_id: "challenge_random_menu_initial",
                                    emoji: {
                                        name: "menu",
                                        id: "862620287735955487"
                                    }
                                }
                            ]
                        })
                    }
                    if (args[2] == "purchase") {
                        const hintBuy = new Discord.MessageEmbed()
                            .setColor("#ED4245")
                        if (profile.truguts_earned - profile.truguts_spent < hints[selection].price) {
                            hintBuy
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no hint!'*\nYou do not have enough truguts to buy the selected hint.\n\nHint cost: `" + hints[selection].price + "`")
                                .setFooter("Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent))
                            interaction.reply({ embeds: [hintBuy], ephemeral: true })
                        } else {
                            //figure out missing
                            for (let j = 0; j < 25; j++) {
                                if (!achievements.galaxy_famous.array.includes(j)) {
                                    achievements.galaxy_famous.missing.push(j)
                                }
                                if (!achievements.pod_champ.array.includes(j) && j < 23) {
                                    achievements.pod_champ.missing.push(j)
                                }
                                if (!achievements.light_skipper.array.includes(j) && tracks[j].hasOwnProperty("parskiptimes")) {
                                    achievements.light_skipper.missing.push(j)
                                }
                                if (!achievements.slow_steady.array.includes(j) && j < 23) {
                                    achievements.slow_steady.missing.push(j)
                                }
                                if (!achievements.mirror_dimension.array.includes(j)) {
                                    achievements.mirror_dimension.missing.push(j)
                                }
                                if (!achievements.crowd_favorite.array.includes(j)) {
                                    achievements.crowd_favorite.missing.push(j)
                                }
                                if (!achievements.backwards_compatible.array.includes(j)) {
                                    achievements.backwards_compatible.missing.push(j)
                                }
                                for (let l = 0; l < 23; l++) {
                                    if (!achievements.true_jedi.array.includes(j + "," + l)) {
                                        achievements.true_jedi.missing.push(j + "," + l)
                                    }
                                }
                            }
                            //get random missing challenge
                            let racer = null, track = null, achievement_name = ""
                            achievement_name = achievements[achievement].name
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
                            if ((["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", "true_jedi", 'backwards_compatible'].includes(achievement) && track == null) || (["pod_champ", "slow_steady", "true_jedi"].includes(selection) && racer == null)) {
                                //player already has achievement
                                hintBuy.setDescription("You already have this achievement and do not require a hint. You have not been charged. \n\nAlready have all the achievements? Try the Challenge Hunt!")
                            } else {
                                //prepare hint
                                let track_hint_text = "", racer_hint_text = ""
                                if (track !== null) {
                                    let track_hint = track_hints[track]
                                    for (let i = 0; i < selection + 1; i++) {
                                        let random_hint = Math.floor(Math.random() * track_hint.length)
                                        track_hint_text += "○ *" + track_hint[random_hint] + "*\n"
                                        track_hint.splice(random_hint, 1)
                                    }
                                    hintBuy.addField("Track Hint", track_hint_text)
                                }
                                if (racer !== null) {
                                    let racer_hint = racer_hints[racer]
                                    for (let i = 0; i < selection + 1; i++) {
                                        let random_hint = Math.floor(Math.random() * racer_hint.length)
                                        racer_hint_text += "○ *" + racer_hint[random_hint] + "*\n"
                                        racer_hint.splice(random_hint, 1)
                                    }
                                    hintBuy.addField("Racer Hint", racer_hint_text)
                                }
                                // process purchase
                                profileref.update({ truguts_spent: profile.truguts_spent + hints[selection].price })
                                profileref.child("purchases").push({
                                    date: Date.now(),
                                    purchased_item: hints[selection].name,
                                    selection: achievement
                                })
                                hintBuy.setDescription("`-📀" + tools.numberWithCommas(hints[selection].price) + "`")
                            }
                            hintBuy
                                .setAuthor(interaction.member.user.username + "'s Random Challenge Hint", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                                .setTitle(":bulb: " + hints[selection].name + ": " + achievement_name)
                                .setFooter("Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent))
                            interaction.editReply({ embeds: [hintBuy] })
                        }
                    }

                    break
                case 'hunt':
                    const huntEmbed = new Discord.MessageEmbed()
                        .setTitle(":dart: Challenge Hunt")
                        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                        .setDescription("Challenge Hunt is a way to earn big truguts fast. Based on your hint selection, Botto hides a large trugut bonus on a random challenge. You have one hour to find and complete this challenge to claim your bonus.")
                        .setFooter(interaction.member.user.username + " | Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent), client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                        .setColor("#ED4245")
                    if (!args.includes("initial")) {
                        if (args[args.length - 1].startsWith("uid")) {
                            if (args[args.length - 1].replace("uid", "") !== member) {
                                const huntMessage = new Discord.MessageEmbed()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Hunt!")
                                    .setDescription("This is someone else's hunt menu. Get your own by clicking the button below.")
                                interaction.reply({
                                    embeds: [huntMessage], components: [{
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                custom_id: "challenge_random_hunt_initial_new",
                                                style: 4,
                                                label: "Challenge Hunt",
                                                emoji: {
                                                    name: "🎯"
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
                                    }], ephemeral: true
                                })
                                return
                            }
                        }
                        for (let i = 0; i < interaction.message.components[0].components[0].options.length; i++) {
                            let option = interaction.message.components[0].components[0].options[i]
                            if (option.default) {
                                selection = i
                            }
                        }
                    }
                    if (args[2] == "selection") {
                        selection = Number(interaction.data.values[0])
                    }
                    if (profile.hunt !== undefined) {
                        if (profile.hunt.date > Date.now() - 1000 * 60 * 60 && profile.hunt.completed == false) {
                            huntEmbed.addField(":exclamation: Hunt Already in Progress", "Your current hunt expires <t:" + Math.round((profile.hunt.date + 1000 * 60 * 60) / 1000) + ":R>. Starting a new one will overwrite the hunt in progress.")
                        }
                    }
                    //draw components
                    for (i = 0; i < hints.length; i++) {
                        let option = {
                            label: hints[i].hunt,
                            value: i,
                            description: "Price: 📀" + tools.numberWithCommas(hints[i].price) + " | " + hints[i].description + " | Bonus: 📀" + tools.numberWithCommas(hints[i].bonus),
                            emoji: {
                                name: "🎯"
                            }
                        }
                        if (selection == i) {
                            option.default = true
                        }
                        if (profile.truguts_earned - profile.truguts_spent >= hints[i].price) {
                            selection_options.push(option)
                        }
                    }
                    components.push(
                        {
                            type: 1,
                            components: [
                                {
                                    type: 3,
                                    custom_id: "challenge_random_hunt_selection_uid" + member,
                                    options: selection_options,
                                    placeholder: "Select Hunt Type",
                                    min_values: 1,
                                    max_values: 1
                                }
                            ]
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    custom_id: "challenge_random_hunt_start_uid" + member,
                                    label: "Start Hunt",
                                    style: 4,
                                    disabled: selection == null
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
                        })
                    if (args[2] == "start") {
                        if (profile.truguts_earned - profile.truguts_spent < hints[selection].price) {
                            hintBuy
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                                .setDescription("*'No money, no hunt!'*\nYou do not have enough truguts to buy the selected hunt.\n\nHunt cost: `" + hints[selection].price + "`")
                            interaction.reply({ embeds: [hintBuy], ephemeral: true })
                        } else {
                            //process purchase
                            profileref.update({ truguts_spent: profile.truguts_spent + hints[selection].price })
                            profileref.child("purchases").push({
                                date: Date.now(),
                                purchased_item: hints[selection].name,
                                selection: "challenge_hunt"
                            })

                            let track = Math.floor(Math.random() * 25)
                            let racer = Math.floor(Math.random() * 23)
                            profileref.update({
                                hunt: {
                                    track: track,
                                    racer: racer,
                                    date: Date.now(),
                                    bonus: hints[selection].bonus,
                                    completed: false
                                }
                            })
                            const huntBuy = new Discord.MessageEmbed()
                                .setTitle(":dart: " + hints[selection].hunt)
                                .setColor("#ED4245")
                                .setAuthor(interaction.member.user.username + "'s Random Challenge Hunt", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                            let track_hint = track_hints[track]
                            let track_hint_text = "", racer_hint_text = ""
                            for (let i = 0; i < selection + 1; i++) {
                                let random_hint = Math.floor(Math.random() * track_hint.length)
                                track_hint_text += "○ *" + track_hint[random_hint] + "*\n"
                                track_hint.splice(random_hint, 1)
                            }
                            huntBuy.addField("Track Hint", track_hint_text)

                            let racer_hint = racer_hints[racer]
                            for (let i = 0; i < selection + 1; i++) {
                                let random_hint = Math.floor(Math.random() * racer_hint.length)
                                racer_hint_text += "○ *" + racer_hint[random_hint] + "*\n"
                                racer_hint.splice(random_hint, 1)
                            }
                            huntBuy
                                .addField("Racer Hint", racer_hint_text)
                                .setDescription("`-📀" + tools.numberWithCommas(hints[selection].price) + "`\nBotto has hid a large trugut bonus on a random challenge. You have one hour to find and complete the challenge and claim your bonus! \nHunt expires: <t:" + Math.round((Date.now() + 1000 * 60 * 60) / 1000) + ":t>\n\nIf you use a bribe to successfully find the challenge, you will not be charged.\n" +
                                    "Potential bonus: `📀" + tools.numberWithCommas(hints[selection].bonus) + "`")
                                .setFooter("Truguts: 📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent))
                            interaction.reply({ embeds: [huntBuy] })
                            return
                        }
                    }
                    break
                case 'settings':
                    if (!args.includes("initial")) {
                        if (args[args.length - 1].startsWith("uid")) {
                            if (args[args.length - 1].replace("uid", "") !== member) {
                                const holdUp = new Discord.MessageEmbed()
                                    .setTitle("<:WhyNobodyBuy:589481340957753363> Get Your Own Settings!")
                                    .setDescription("This is someone else's settings menu. Get your own by clicking the button below.")
                                interaction.reply({
                                    embeds: [holdUp], componenets: [{
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                custom_id: "challenge_random_settings_initial_new",
                                                style: 4,
                                                label: "Settings",
                                                emoji: {
                                                    name: "⚙️"
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
                                    }], ephemeral: true
                                })
                                return
                            }
                        }
                    }
                    if (args[2] == "winnings") {
                        if (interaction.data.values) {
                            profileref.update({ winnings: Number(interaction.data.values[0]) })
                        }
                        interaction.editReply({ embeds: [settingsEmbed()], componenets: [settingsComponents()] })
                    } else if (args[2] == "odds") {
                        if (args[3] == 'submit') {
                            profileref.update({
                                skips: Number(interaction.data.components[0].components[0].value),
                                no_upgrades: Number(interaction.data.components[1].components[0].value),
                                non_3_lap: Number(interaction.data.components[2].components[0].value),
                                mirror_mode: Number(interaction.data.components[3].components[0].value),
                                backwards: Number(interaction.data.components[4].components[0].value),
                            })
                            interaction.editReply({ embeds: [settingsEmbed()], componenets: [settingsComponents()] })
                        } else {
                            let modal_options = [{ id: 'skips', label: 'Skips' }, { id: 'no_upgrades', label: 'No Upgrades' }, { id: 'non_3_lap', title: 'Non 3-Lap' }, { id: 'mirror_mode', title: 'Mirrored' }, { id: 'backwards', title: 'Backwards' }].map(option => {
                                return {
                                    type: 1,
                                    components: [{
                                        type: 4,
                                        custom_id: option.id,
                                        label: option.label,
                                        style: 1,
                                        min_length: 1,
                                        max_length: 3,
                                        required: true,
                                        value: profile[option.id]
                                    }]
                                }
                            })
                            modalMessage(client, interaction, 'challenge_random_settings_odds_submit', 'Set Your Random Challenge Odds (0-100)', modal_options)
                        }
                    } else if (args[2] == "default") {
                        profileref.update({
                            winnings: settings_default.winnings,
                            skips: settings_default.skips,
                            no_upgrades: settings_default.no_upgrades,
                            non_3_lap: settings_default.non_3_lap,
                            mirror_mode: settings_default.mirrored,
                            backwards: settings_default.backwards
                        })
                        interaction.editReply({ embeds: [settingsEmbed()], componenets: [settingsComponents()] })
                    }
                    break

                case 'profile':
                    if (args[args.length - 1].startsWith("uid")) {
                        if (args[args.length - 1].replace("uid", "") !== member) {
                            const holdUp = new Discord.MessageEmbed()
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
                        const profileEmbed = new Discord.MessageEmbed()
                        profileEmbed
                            .setAuthor(client.guilds.resolve(interaction.guild_id).members.resolve(member).user.username + "'s Random Challenge Profile", client.guilds.resolve(interaction.guild_id).members.resolve(member).user.avatarURL())
                        if (args[2] == "stats") {

                            //console.log(trugutsEarned(member))
                            var keys = Object.keys(challengedata)
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
                                if (challengedata[k].user == member) {
                                    stats.total++
                                    //time stats
                                    times.total += Number(challengedata[k].time)
                                    var goals = getGoalTimes(challengedata[k].track, challengedata[k].racer, challengedata[k].skips, challengedata[k].nu, challengedata[k].laps)
                                    var goal_array = ["elite", "pro", "rookie", "amateur", "youngling"]
                                    var goal_time = null
                                    for (var j = goals.length - 1; j > -1; j--) {
                                        if (challengedata[k].time < goals[j]) {
                                            goal_time = j
                                        }
                                    }
                                    if (goal_time !== null) {
                                        times[goal_array[goal_time]]++
                                    }
                                    //stats
                                    if (!challengedata[k].mirror && !challengedata[k].nu && !challengedata[k].skips && challengedata[k].laps == 3) {
                                        stats.standard++
                                    } else {
                                        if (challengedata[k].skips) {
                                            stats.skips++
                                            bonuses.non_standard++
                                        }
                                        if (challengedata[k].nu) {
                                            stats.no_upgrades++
                                            bonuses.non_standard++
                                        }
                                        if (challengedata[k].laps !== 3) {
                                            stats.non_3_lap++
                                            bonuses.non_standard++
                                        }
                                        if (challengedata[k].mirror) {
                                            stats.mirrored++
                                            bonuses.non_standard++
                                        }
                                    }
                                    hasraced = true
                                    getMost(mostPod, challengedata[k].racer)
                                    getMost(mostTrack, challengedata[k].track)
                                    getMost(mostPlanet, tracks[challengedata[k].track].planet)
                                    getMost(mostCircuit, tracks[challengedata[k].track].circuit)
                                    var first = true
                                    var pb = false
                                    var beat = []
                                    for (var p = 0; p < keys.length; p++) {
                                        var n = keys[p]
                                        if (challengedata[n].track == challengedata[k].track && challengedata[n].racer == challengedata[k].racer && challengedata[n].skips == challengedata[k].skips && challengedata[n].nu == challengedata[k].nu && challengedata[n].laps == challengedata[k].laps && challengedata[n].mirror == challengedata[k].mirror) {
                                            if (challengedata[n].date < challengedata[k].date) {
                                                first = false
                                                if (challengedata[n].user == member) {
                                                    pb = true
                                                    if (challengedata[n].time < challengedata[k].time) {
                                                        pb = false
                                                    }
                                                }
                                            }
                                            if (challengedata[n].user !== member && challengedata[n].time > challengedata[k].time && challengedata[n].date < challengedata[k].date && !beat.includes(challengedata[n].user)) {
                                                beat.push(challengedata[n].user)
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
                                .setDescription("Current trugut balance: `📀" + tools.numberWithCommas(profile.truguts_earned - profile.truguts_spent) + "`")
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
                            //console.log(trugutsEarned(member))
                            var keys = Object.keys(challengedata)
                            for (var i = 0; i < keys.length; i++) {
                                var k = keys[i];
                                if (challengedata[k].user == member) {
                                    achievements.galaxy_famous.collection[String(challengedata[k].track)] = 1
                                    achievements.pod_champ.collection[String(challengedata[k].racer)] = 1
                                    if (challengedata[k].skips) {
                                        achievements.light_skipper.collection[String(challengedata[k].track)] = 1
                                    }
                                    if (challengedata[k].nu) {
                                        achievements.slow_steady.collection[String(challengedata[k].racer)] = 1
                                    }
                                    if (challengedata[k].mirror) {
                                        achievements.mirror_dimension.collection[String(challengedata[k].track)] = 1
                                    }
                                    if (challengedata[k].racer == tracks[String(challengedata[k].track)].favorite) {
                                        achievements.crowd_favorite.collection[String(challengedata[k].track)] = 1
                                    }
                                    achievements.true_jedi.collection[String(challengedata[k].track + " " + challengedata[k].racer)] = 1
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
                                        const congratsEmbed = new Discord.MessageEmbed()
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
                    const challengeHelpEmbed = new Discord.MessageEmbed()
                        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
                        .setTitle(":grey_question: About")
                        .setColor("#ED4245")
                        .setDescription("When you roll a random challenge, Botto will challenge you to race a random pod on a random track with random conditions. The default conditions are max upgrades, 3-lap, full track. You have 15 minutes to submit a time for the challenge which you may do by entering it in the same text channel as the challenge.")
                        .addField(":gear: Settings", "You can customize your challenge settings and modify the chances that Botto will roll a No Upgrades, Skips, Non 3-lap, or Mirrored challenge. You can also select a winnings pattern which determines the share of truguts your submitted time will earn.", false)
                        .addField(":dvd: Earning Truguts", "Truguts are awarded depending on how fast your submitted time is compared to the given goal times and how your winnings are set up. Bonuses are available for beating other players' best times, beating your own time, rating challenges, and completing non-standard challenges (odds must be equal to or below 25%).", false)
                        .addField(":dvd: Spending Truguts", "You can spend truguts on 'rerolling' challenges that you wish to skip. Truguts can also be used on :moneybag: **Bribes** for a specific track or racer. You can use :bulb: **Hints** to figure out what to bribe for your achievement progress.", false)
                        .addField(":dart: Challenge Hunt", "Challenge Hunt is a way to earn big truguts fast and can be accessed via the **Random Challenge** menu. Based on your hint selection, Botto hides a large trugut bonus on a random challenge. You have one hour to find this challenge and complete it to claim your bonus.", false)
                    interaction.reply({ embeds: [challengeHelpEmbed], ephemeral: true })
                    break

                case 'leaderboards':
                    const challengeLeaderboard = new Discord.MessageEmbed()
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
                    console.log(pods)
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
                    var challenge = Object.values(challengedata)
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
                        .setFooter(challengefiltered.length + " Total Runs")
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
                    if (profile.current == undefined || interaction.message.id == profile.current.message) {
                        if (profile.current.completed == false) {
                            const submissionModal = new ModalBuilder()
                                .setCustomId('challenge_random_submit')
                                .setTitle('Submit Results')
                            const submissionInput = new TextInputBuilder()
                                .setCustomId('challenge_random_submit_0')
                                .setLabel('Total Time')
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(9)
                                .setMinLength(6)
                                .setPlaceholder("--:--.---")
                                .setRequired(true)
                            const ActionRow = new ActionRowBuilder().addComponents(submissionInput)
                            submissionModal.addComponents(ActionRow)
                            await interaction.showModal(submissionModal)
                        } else {
                            profileref.child("current").update({ completed: true })
                            const holdUp = new Discord.MessageEmbed()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> Expired Challenge")
                                .setDescription("This challenge is no longer available.")
                            interaction.reply({
                                embeds: [holdUp], components: [
                                    {
                                        type: 1,
                                        components: [playButton()]
                                    }

                                ], ephemeral: true
                            })
                        }
                    } else {
                        const holdUp = new Discord.MessageEmbed()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Can't Submit")
                            .setDescription("This is not your active challenge.")
                        interaction.reply({ embeds: [holdUp], ephemeral: true })
                    }
                    break

                case 'submit':
                    console.log(interaction.data.components[0].components[0])
                    let subtime = interaction.data.components[0].components[0].value
                    challengestart = profile.current.start
                    if (!isNaN(Number(subtime.replace(":", ""))) && tools.timetoSeconds(subtime) !== null) {
                        let challengeend = Date.now()
                        let time = tools.timetoSeconds(subtime)
                        if ((challengeend - challengestart) < time * 1000) {
                            profileref.child("current").update({ completed: true, title: ":negative_squared_cross_mark: Closed: ", funny_business: true })
                            let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                            client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({ data: { embeds: [data.message], components: [] } })
                            const holdUp = new Discord.MessageEmbed()
                                .setTitle("<:WhyNobodyBuy:589481340957753363> I warn you. No funny business.")
                                .setDescription("You submitted a time that was impossible to achieve in the given timeframe.")
                            interaction.reply({ embeds: [holdUp], ephemeral: true })
                        } else {
                            //log time
                            let submissiondata = {
                                user: interaction.member.user.id,
                                time: time,
                                date: profile.current.start,
                                racer: profile.current.racer,
                                track: profile.current.track,
                                conditions: {
                                    laps: profile.current.laps,
                                    nu: profile.current.nu,
                                    skips: profile.current.skips,
                                    mirror: profile.current.mirror,
                                    backwards: profile.current.backwards,
                                },
                                settings: {
                                    winnings: profile.winnings,
                                    no_upgrades: profile.no_upgrades,
                                    non_3_lap: profile.non_3_lap,
                                    skips: profile.skips,
                                    mirror_mode: profile.mirror_mode,
                                    backwards: profile.backwards ?? 5
                                },
                            }
                            if (current_challenge.hunt) {
                                submissiondata.hunt = profile.hunt.bonus
                            }
                            var newPostRef = timeref.push(submissiondata);
                            profileref.child("current").update({ submission: newPostRef.key, completed: true })
                            let data = updateChallenge({ challengedata, profile, current_challenge, current_challengeref, profileref })
                            interaction.editReply({ embeds: [data.message], componenets: [data.componenets] })
                        }
                    } else {
                        const holdUp = new Discord.MessageEmbed()
                            .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
                            .setDescription("Your time was submitted in an incorrect format.")
                        interactionm.reply({ embeds: [holdUp], ephemeral: true })
                    }
                    break
            }
        } else if (args[0] == "community") {
            if (args[1] == "submit") {

            } else if (args[1] == "browse") {

            } else if (args[1] == "create") {

            } else if (args[1] == "profile") {

            } else if (args[1] == "leaderboards") {

            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "<:WhyNobodyBuy:589481340957753363> This feature isn't available yet ",
                        flags: 64
                    }
                }
            })
        }

    }
}