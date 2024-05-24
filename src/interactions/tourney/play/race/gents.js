const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getOpponent, raceEmbed, raceComponents } = require('../../functions.js')
const { database, db } = require('../../../../firebase.js');
const { WhyNobodyBuy } = require('../../../../data/discord/emoji.js');

exports.gents = async function ({ interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    let race = Number(args[1].replace("race", ""))

    if (!Object.values(match_data.players).includes(member_id)) {
        interaction.reply({ content: `You're not a player! ${WhyNobodyBuy}`, ephemeral: true })
        return
    }

    if (interaction.isModalSubmit()) {
        let terms = interaction.fields.getTextInputValue('gents').trim()
        match_ref.child('races').child(race).child('gents').set({ terms: terms, player: member_id, agreed: "?" })
        match_data = db.ty.live[interaction.channelId]
        interaction.update({
            content: "<@" + getOpponent({ interaction, player: member_id }) + "> do you accept the terms of the proposed 🎩 **Gentlemen's Agreement**?\n*" + terms + "*",
            embeds: [raceEmbed({ race, interaction })],
            components: raceComponents({ race, interaction })
        })
        return
    }

    if (args.length == 3) {
        const gentlemensModal = new ModalBuilder()
            .setCustomId("tourney_play_race" + race + "_gents")
            .setTitle("Make a Gentleman's Agreement")
        const Terms = new TextInputBuilder()
            .setCustomId("gents")
            .setLabel("Agreement Terms")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(false)
        const ActionRow1 = new ActionRowBuilder().addComponents(Terms)
        gentlemensModal.addComponents(ActionRow1)
        await interaction.showModal(gentlemensModal)
        return
    }

    if (member_id == getOpponent({ interaction, player: match_data.races[race].gents?.player })) {
        if (args[3] == 'true') {
            match_ref.child('races').child(race).child('gents').update({ agreed: true })
        } else {
            match_ref.child('races').child(race).child('gents').remove()
        }
        match_data = db.ty.live[interaction.channelId]
        interaction.update({
            content: Object.values(match_data.players).filter(player => !match_data.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(match_data.commentators).map(comm => "<@" + comm + ">").join(" "),
            embeds: [raceEmbed({ race, interaction })],
            components: raceComponents({ race, interaction })
        })
    } else {
        interaction.reply({ content: `Not you! ${WhyNobodyBuy}`, ephemeral: true })
    }


}