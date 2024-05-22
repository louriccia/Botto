const { initializeChallenge, updateChallenge, playButton, notYoursEmbed, isActive, expiredEmbed, manageTruguts } = require('./functions.js');
const { editMessage } = require('../../discord.js');

const { EmbedBuilder } = require('discord.js');
const { truguts } = require('../../data/challenge/trugut.js');

exports.reroll = async function ({ interaction, current_challenge, current_challenge_ref, user_profile, member_id, profile_ref, database, db, botto_name, member_avatar, user_key } = {}) {

    //expired challenge
    if (!isActive(current_challenge, user_profile)) {
        interaction.reply({ embeds: [expiredEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
        return
    }

    //not the right player or not active
    if (!(current_challenge.player?.member == interaction.user.id && current_challenge.type == 'private' && isActive(current_challenge, user_profile))) {
        interaction.reply({ embeds: [notYoursEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
        return
    }

    let cost = 0
    if (current_challenge.reroll_cost == "full price") {
        cost = truguts.reroll
    } else if (current_challenge.reroll_cost == "discount") {
        cost = truguts.reroll_discount
    }
    if (user_profile.truguts_earned - user_profile.truguts_spent < cost) { //player doesn't have enough truguts to reroll
        let noMoney = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
            .setDescription("*'No money, no challenge, no reroll!'*\nYou do not have enough truguts to reroll this challenge.\n\nReroll cost: `📀" + tools.numberWithCommas(truguts.reroll) + "`")
        interaction.reply({ embeds: [noMoney], ephemeral: true })
        return
    }
    //process purchase
    if (cost) {

        //profile_ref.update({ truguts_spent: profile.truguts_spent + cost })
        user_profile = manageTruguts({
            user_profile, profile_ref, transaction: 'w', amount: cost, purchase: {
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
            const thissponsorref = userref.child(sponsor.user).child("random")
            const thissponsor = db.user[sponsor.user].random
            manageTruguts({ user_profile: thissponsor, profile_ref: thissponsorref, transaction: 'd', amount: sponsor_earnings })
            current_challenge_ref.child('sponsors').child(sponsor.member).child('earnings').set((current_challenge.sponsors?.[sponsor.member]?.earnings ?? 0) + sponsor_earnings)
        })
    }

    //clean up old challenge
    database.ref(`challenge/challenges/${interaction.message.id}`).update({ completed: true, rerolled: true })
    current_challenge = db.ch.challenges[interaction.message.id]
    const edit_message = await updateChallenge({ client: interaction.client, user_profile, current_challenge, current_challengeref: current_challenge_ref, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })
    editMessage(interaction.client, interaction.channel.id, interaction.message.id, edit_message)

    //prepare new challenge
    let rerolltype = 'private'
    current_challenge = initializeChallenge({ user_profile, member_id, type: rerolltype, name: botto_name, avatar: member_avatar, user: user_key, db, interaction })
    const reroll_reply = await updateChallenge({ client: interaction.client, user_profile, current_challenge, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })
    let rerollmessage = await interaction.reply(reroll_reply)
    current_challenge.message = rerollmessage.id
    current_challenge.channel = interaction.message.channelId
    current_challenge.guild = interaction.guildId
    current_challenge.url = rerollmessage.url
    database.ref(`challenge/challenges/${rerollmessage.id}`).set(current_challenge)
}
