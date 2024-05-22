const { time_to_seconds } = require('../../generic.js');
const { updateChallenge, isActive } = require('./functions.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.predict = async function ({ interaction, current_challenge, current_challenge_ref, user_profile, member_id, profile_ref,  db, botto_name, member_avatar, user_key } = {}) {
    if (!isActive(current_challenge, user_profile)) { //no longer active
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Bet you didn't predict that!")
            .setDescription("Predictions are no longer available for this challenge.")
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }
    if (interaction.isModalSubmit()) {
        let predictiontime = interaction.fields.getTextInputValue('predictionTime')
        if (isNaN(Number(predictiontime.replace(":", ""))) || time_to_seconds(predictiontime) == null) { //incorrect time format
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
                .setDescription("Your time was submitted in an incorrect format.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }
        let time = time_to_seconds(predictiontime)
        //log time 
        let predictiondata = {
            member: member_id,
            name: botto_name,
            time: time,
            user: user_key
        }
        await current_challenge_ref.child("predictions").child(member_id).set(predictiondata);
        let playeruser = current_challenge.player.user
        current_challenge = db.ch.challenges[interaction.message.id]
        const pd_response = await updateChallenge({ client: interaction.client, user_profile: db.user?.[playeruser]?.random, current_challenge, current_challengeref: current_challenge_ref, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })
        interaction.update(pd_response)
    } else {
        if (current_challenge.player && current_challenge.player.member == member_id) { //trying to predict own challenge
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> The dark side of the force clouds your ability to see the future.")
                .setDescription("You cannot make a prediction on your own challenge.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }
        if (current_challenge.predictions && current_challenge.predictions[member_id]) { //already made a prediction
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
}