const { truguts } = require('../../data/challenge/trugut.js');
const { updateChallenge, manageTruguts } = require('./functions.js');

const { EmbedBuilder } = require('discord.js');

exports.feedback = async function ({ current_challenge, current_challenge_ref, interaction, db, member_id, member_avatar, user_key, user_profile, profile_ref, botto_name, args, database } = {}) {

    const feedbackref = database.ref('challenge/feedback')

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
    await current_challenge_ref.child('ratings').child(interaction.user.id).set({ user: user_key })
    await current_challenge_ref.child('earnings').child(interaction.user.id).update({ truguts_earned: (current_challenge.earnings[interaction.user.id]?.truguts_earned ?? 0) + truguts.rated })

    //profile_ref.update({ truguts_earned: user_profile.truguts_earned + truguts.rated })
    user_profile = manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: truguts.rated * (user_profile.effects?.vote_confidence ? 2 : 1) })

    feedbackref.push({
        user: member_id,
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
    const feedback_reply = await updateChallenge({ client: interaction.client, user_profile, current_challenge, current_challengeref: current_challenge_ref, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })

    interaction.update(feedback_reply)
}