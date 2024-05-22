const { time_fix } = require('../../generic.js');
const { playButton, isActive, checkActive, expiredEmbed } = require('./functions.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.modal = async function ({current_challenge, interaction, db, member_id, user_profile} = {}) {
    if (current_challenge.type == 'private' && member_id !== current_challenge.player?.member) { //not your challenge
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
    let active = checkActive(db, member_id, current_challenge)
    if (active) { //already has active challenge
        interaction.reply({ embeds: [active], ephemeral: true })
        return
    }

    //expired challenge
    if (!isActive(current_challenge, user_profile) && !current_challenge.submissions?.[member_id]) { 
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

    lastconsole = Object.values(db.ch.times).filter(c => c.user == member_id && c.platform).sort((a, b) => b.date - a.date)
    if (lastconsole.length) {
        lastconsole = lastconsole[0].platform
    } else {
        lastconsole = ""
    }
    // if (current_challenge.submissions?.[member_id]) { //already submitted
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
    if (current_challenge.submissions?.[member_id]) {
        const this_submission = db.ch.times[current_challenge.submissions[member_id].id]
        submissionTime.setValue(time_fix(this_submission.time))
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
}