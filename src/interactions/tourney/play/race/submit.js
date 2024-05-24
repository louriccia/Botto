const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { raceEmbed, raceComponents } = require('../../functions.js')
const { time_to_seconds, time_fix } = require('../../../../generic.js');
const { database, db } = require('../../../../firebase.js');
const { WhyNobodyBuy } = require('../../../../data/discord/emoji.js');

exports.submit = async function ({ client, interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    let race = Number(args[1].replace("race", ""))

    if (!Object.values(match_data.players).includes(member_id)) {
        interaction.reply({ content: `You're not a player! ${WhyNobodyBuy}`, ephemeral: true })
        return
    }
    
    if (interaction.isModalSubmit()) {
        if (!match_data.races[race].live) {
            interaction.reply({ content: `Race is no longer live. ${WhyNobodyBuy}`, ephemeral: true })
            return
        }
        let submittime = interaction.fields.getTextInputValue('time')

        //validate submission
        if (submittime.toLowerCase() !== 'dnf' && (isNaN(Number(submittime.replace(":", ""))) || time_to_seconds(submittime) == null)) { //time doesn't make sense
            const holdUp = new EmbedBuilder()
                .setTitle(`${WhyNobodyBuy} Time Does Not Compute`)
                .setDescription("Your time was submitted in an incorrect format.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }

        //submit time
        match_ref.child("races").child(race).child("runs").child(member_id).update(
            {
                time: (interaction.fields.getTextInputValue('time').toLowerCase() == 'dnf' ? 'DNF' : time_to_seconds(interaction.fields.getTextInputValue('time')) == null ? "DNF" : time_to_seconds(interaction.fields.getTextInputValue('time').trim())),
                deaths: isNaN(Number(interaction.fields.getTextInputValue('deaths'))) ? '' : Number(interaction.fields.getTextInputValue('deaths')),
                notes: interaction.fields.getTextInputValue('notes').trim(),
                player: member_id
            }
        )

        match_data = db.ty.live[interaction.channelId]
        interaction.update({
            content: Object.values(match_data.races[race].runs).map(run => run.time).filter(time => time == "").length == 0 ? Object.values(match_data.commentators).map(comm => "<@" + comm + ">").join(" ") : "",
            embeds: [raceEmbed({ race, interaction })],
            components: raceComponents({ race, interaction })
        })
        return
    }

    const submitModal = new ModalBuilder()
        .setCustomId("tourney_play_race" + race + "_submit")
        .setTitle("Submit Race " + (race + 1) + " Results")
    const Time = new TextInputBuilder()
        .setCustomId("time")
        .setLabel("⏱️ Time (write 'dnf' if forfeited)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(0)
        .setMaxLength(10)
        .setRequired(true)
        .setValue((String(match_data.races[race].runs[member_id]?.time).toLowerCase() == 'dnf' ? 'DNF' : (match_data.races[race].runs[member_id].time == "" ? "" : String(time_fix(match_data.races[race].runs[member_id].time)))))
    const Deaths = new TextInputBuilder()
        .setCustomId("deaths")
        .setLabel("💀 Deaths (leave blank if unsure)")
        .setStyle(TextInputStyle.Short)
        .setMinLength(0)
        .setMaxLength(2)
        .setRequired(false)
        .setValue(String(match_data.races[race].runs[member_id].deaths))
    const Notes = new TextInputBuilder()
        .setCustomId("notes")
        .setLabel("📝 Notes")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false)
        .setValue(String(match_data.races[race].runs[member_id].notes))
    const ActionRow1 = new ActionRowBuilder().addComponents(Time)
    const ActionRow2 = new ActionRowBuilder().addComponents(Deaths)
    const ActionRow3 = new ActionRowBuilder().addComponents(Notes)
    submitModal.addComponents(ActionRow1, ActionRow2, ActionRow3)
    await interaction.showModal(submitModal)

}