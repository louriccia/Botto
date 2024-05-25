const { updateChallenge, playButton, isActive, expiredEmbed, challengeWinnings, getBest, goalTimeList, predictionScore, manageTruguts, currentTruguts, predictionAchievement, bountyAchievement, achievementEmbed, randomChallengeItem, challengeProgression, playerLevel, convertLevel, progressionReward } = require('./functions.js');
const { postMessage, editMessage } = require('../../discord.js');
const { items } = require('../../data/challenge/item.js')
const { raritysymbols } = require('../../data/challenge/rarity.js')

const { EmbedBuilder } = require('discord.js');
const { time_to_seconds, getRacerName } = require('../../generic.js');
const { achievement_data } = require('../../data/challenge/achievement.js');
const { swe1r_guild } = require('../../data/discord/guild.js');

exports.submit = async function ({ current_challenge, current_challenge_ref, interaction, db, database, member_id, member_avatar, user_key, user_profile, profile_ref, botto_name } = {}) {
    let subtime = interaction.fields.getTextInputValue('challengeTime')
    let subnotes = interaction.fields.getTextInputValue('challengeNotes').replace(/[^a-zA-Z0-9 ]/g, '')
    let subproof = interaction.fields.getTextInputValue('challengeProof') ?? ""
    let subplatform = interaction.fields.getTextInputValue('challengePlatform') ?? ""
    let subrta = current_challenge.type == 'cotm' ? interaction.fields.getTextInputValue('challengeRTA') : ""


    const challengetimeref = database.ref('challenge/times')
    const userref = database.ref('users')

    //challenge no longer active
    if (!isActive(current_challenge, user_profile) && !current_challenge.submissions?.[member_id]) {
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
    if (isNaN(Number(subtime.replace(":", ""))) || time_to_seconds(subtime) == null) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
            .setDescription("Your time was submitted in an incorrect format.")
        await interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }
    let challengeend = Date.now()
    let time = time_to_seconds(subtime)
    let rta = time_to_seconds(subrta)
    let platform = subplatform.toLowerCase()

    //submitted time is impossible
    if ((challengeend - current_challenge.created) < time * 1000 && !current_challenge.rescue && !current_challenge.guild == '1135800421290627112') {
        current_challenge_ref.update({ completed: true, funny_business: true })
        profile_ref.update({ funny_business: (user_profile.funny_business ?? 0) + 1 })
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> I warn you. No funny business.")
            .setDescription("You submitted a time that was impossible to achieve in the given timeframe.")
        await interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }

    if (current_challenge.type == 'private' || current_challenge.submissions?.[member_id]) {
        await interaction.deferUpdate()
    } else {
        await interaction.deferReply({ ephemeral: true })
    }


    if (current_challenge.submissions?.[member_id]) {
        challengetimeref.child(current_challenge.submissions[member_id].id).update(
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
        user_profile = db.user[user_key].random //update user_profile

        //update challenge
        const edit_reply = await updateChallenge({ client: interaction.client, user_profile, current_challenge, current_challengeref: current_challenge_ref, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })
        await interaction.editReply(edit_reply)
        return
    }

    //log time
    let submissiondata = {
        user: member_id,
        name: botto_name,
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
            winnings: user_profile.settings.winnings,
            no_upgrades: user_profile.settings.no_upgrades,
            non_3_lap: user_profile.settings.non_3_lap,
            skips: user_profile.settings.skips,
            mirror_mode: user_profile.settings.mirror_mode,
            backwards: user_profile.settings.backwards ?? 5,
            predictions: user_profile.settings.predictions ?? true
        },
        challenge: interaction.message.id
    }
    if (current_challenge.hunt) {
        submissiondata.hunt = user_profile.hunt.bonus
    }
    var newPostRef = challengetimeref.push(submissiondata);
    await current_challenge_ref.child("submissions").child(member_id).set({ id: newPostRef.key, player: member_id, time })
    if (['abandoned', 'private'].includes(current_challenge.type)) {
        await current_challenge_ref.update({ completed: true })
    }

    let total_revenue = 0

    //award winnings for this submission
    let goals = goalTimeList(current_challenge, user_profile)
    let winnings = challengeWinnings({ current_challenge, submitted_time: submissiondata, user_profile, best: getBest(db, current_challenge), goals, member_id, db })

    //award saboteur cut
    if (winnings.sabotage) {
        let sabotage = user_profile.effects.sabotage[winnings.sabotage]
        let dp = db.user[sabotage.player]?.random?.effects?.doubled_powers
        manageTruguts({ user_profile: db.user[sabotage.player].random, profile_ref: database.ref(`users/${sabotage.player}/random`), transaction: 'd', amount: dp ? winnings.earnings : winnings.earnings * .5 })
        winnings.earnings *= (dp ? 0 : 0.5)
        profile_ref.child('effects').child('sabotage').child(winnings.sabotage).update({ used: true, challenge: interaction.message.id })
    }

    user_profile = manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: winnings.earnings })

    //award item
    let earned_item = randomChallengeItem({ user_profile, profile_ref, current_challenge, db, member_id })
    if (!user_profile.items) {
        profile_ref.child('items').set('test')
    }
    let eitem = { id: earned_item.id, challenge: interaction.message.id, date: Date.now() }
    if (earned_item.upgrade) {
        eitem = { ...eitem, health: earned_item.health, upgrade: earned_item.upgrade }
    }
    profile_ref.child('items').push(eitem)

    let ern = { truguts_earned: winnings.earnings, player: member_id, item: eitem.id }
    if (winnings.sabotage) {
        ern.sabotage = winnings.sabotage
    }
    current_challenge_ref.child("earnings").child(member_id).set(ern)
    total_revenue += winnings.earnings

    //award prediction winnings for this submission
    if (current_challenge.predictions) {
        Object.values(current_challenge.predictions).forEach(p => {
            let take = predictionScore(p.time, time)
            total_revenue += take
            let predictorref = userref.child(p.user).child("random")
            let predictorprofile = db.user[p.user].random
            manageTruguts({ user_profile: predictorprofile, profile_ref: predictorref, transaction: 'd', amount: take })

            //award achievements
            if (predictionAchievement(db, p.member) >= achievement_data.force_sight.limit) {
                if (current_challenge.guild == swe1r_guild) {
                    let pmember = interaction.guild.members.cache.get(p.member)
                    if (pmember.roles.cache.some(r => r.id === achievement_data.force_sight.role)) { //award role
                        pmember.roles.add(achievement_data.force_sight.role).catch(error => console.log(error))
                    }
                }
                if (!db.user[p.user].random.achievements.force_sight) {
                    postMessage(interaction.client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.force_sight, current_challenge.guild)] })
                    userref.child(p.user).child('random').child('achievements').child("force_sight").set(true)
                }

            }
        })
    }

    //award sponsor cuts
    let earning_update = current_challenge.sponsor_earnings ?? {}
    if (user_profile.sponsors) {
        //player sponsors
        Object.values(user_profile.sponsors).forEach(async sponsor => {
            let sponsor_profile = db.user[sponsor.player].random
            let id = db.user[sponsor.player].discordID
            let sponsor_earnings = Math.round(total_revenue * ((Number(sponsor.take) / 100) * (sponsor_profile.effects?.sorry_mess ? 2 : 1)))
            manageTruguts({ user_profile: sponsor_profile, profile_ref: userref.child(sponsor.player).child('random'), transaction: 'd', amount: sponsor_earnings })

            if (!earning_update[id]) {
                earning_update[id] = 0
            }
            earning_update[id] += sponsor_earnings
        })
    }
    if (current_challenge.sponsors) {
        //challenge sponsors
        Object.keys(current_challenge.sponsors).forEach(async sponsor_id => {
            let sponsor = current_challenge.sponsors[sponsor_id]

            let thissponsor = db.user[sponsor.user]?.random
            let sponsor_earnings = Math.round(total_revenue * ((thissponsor?.effects?.sorry_mess ? 2 : 1)) * sponsor.take)
            let thissponsorref = userref.child(sponsor.user).child("random")
            manageTruguts({ user_profile: thissponsor, profile_ref: thissponsorref, transaction: 'd', amount: sponsor_earnings })

            if (!earning_update[sponsor_id]) {
                earning_update[sponsor_id] = 0
            }
            earning_update[sponsor_id] += sponsor_earnings
        })
    }
    await current_challenge_ref.child('sponsor_earnings').update(earning_update)

    //close bounties
    if (current_challenge.bounties) {
        Object.values(current_challenge.bounties).forEach(bounty => {
            bountyref.child(bounty.key).update({ completed: true, player: { avatar: member_avatar, member_id, name: botto_name, user: user_key } })
        })
        if (bountyAchievement(db, member_id) >= achievement_data.bounty_hunter.limit) {
            if (current_challenge.guild == swe1r_guild) {
                if (Member.roles.cache.some(r => r.id === achievement_data.bounty_hunter.role)) { //award role
                    Member.roles.add(achievement_data.bounty_hunter.role).catch(error => console.log(error))
                }
            }
            if (!user_profile.achievements.bounty_hunter) {
                postMessage(interaction.client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.bounty_hunter, current_challenge.guild)] })
                profile_ref.child('achievements').child("bounty_hunter").set(true)
            }

        }
    }

    //handle streak
    if (!user_profile.streak_start) { //no streak started
        profile_ref.update({ streak_start: submissiondata.date, streak_end: submissiondata.date })
    } else {
        if (submissiondata.date - (1000 * 60 * 60 * 36) < user_profile.streak_end) { //streak continues
            profile_ref.update({ streak_end: submissiondata.date })
        } else { //streak broken
            profile_ref.child("streaks").push(user_profile.streak_end - user_profile.streak_start)
            profile_ref.update({ streak_start: submissiondata.date, streak_end: submissiondata.date })
        }
    }

    //level progression
    if (user_profile.progression) {
        let progression = JSON.parse(JSON.stringify(user_profile.progression))
        let player_level = playerLevel(user_profile.progression).level
        let progress = challengeProgression({ current_challenge, submitted_time: time, goals, user_profile })
        let level = convertLevel(user_profile.progression[progress.racer]).level
        progression[progress.racer] += progress.points
        let new_player_level = playerLevel(progression)
        let new_level = convertLevel(progression[progress.racer]).level
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

            manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: truguts })
            if (items.length) {
                items.forEach(item => {
                    profile_ref.child('items').push({
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
            postMessage(interaction.client, interaction.channelId, { embeds: [new EmbedBuilder().setAuthor({ name: `${botto_name} leveled up!`, iconURL: member_avatar }).setDescription(new_player_level.string).setFooter({ text: `Level ${new_player_level.level}` })] })
        }
        await profile_ref.child('progression').set(progression)
    }


    //update objects
    current_challenge = db.ch.challenges[interaction.message.id]
    user_profile = db.user[user_key].random //update user_profile

    //collectionRewardUpdater({ user_profile, client, interaction, profile_ref, name, avatar })

    //update challenge
    const submit_reply = await updateChallenge({ client: interaction.client, user_profile, current_challenge, current_challengeref: current_challenge_ref, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })

    if (current_challenge.type == 'private') {
        interaction.editReply(submit_reply)
    } else {
        editMessage(interaction.client, current_challenge.channel, current_challenge.message, submit_reply)
        let progress = challengeProgression({ current_challenge, submitted_time: time, goals, user_profile })
        const receiptEmbed = new EmbedBuilder()
            .addFields({ name: 'Winnings', value: winnings.receipt, inline: true })
            .setFooter({ text: `Truguts: 📀${currentTruguts(user_profile)}` })
            .addFields({ name: getRacerName(progress.racer), value: progress.summary, inline: true })

        if (![undefined, ""].includes(current_challenge.earnings?.[member_id]?.item)) {
            let item = items.find(i => i.id == current_challenge.earnings[member_id].item)
            let dup = user_profile.items ? Object.values(user_profile.items).filter(i => i.id == item.id).length > 1 ? true : false : false
            receiptEmbed.addFields({ name: `${raritysymbols[item.rarity]} ${item.name}` + (item.health ? `[${Math.round(item.health * 100 / 255)} %]` : '') + (dup ? " (duplicate)" : ""), value: `*${item.description}*`, inline: true })
        }

        interaction.editReply({ embeds: [receiptEmbed], ephemeral: true })
    }

}