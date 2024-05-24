const { WhyNobodyBuy } = require('../../../data/discord/emoji.js')
const { database, db } = require('../../../firebase.js')
const { getOpponent, getWinner, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../functions.js')

exports.permaban = async function ({ interaction, args, member_id } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    
    if (!Object.values(match_data.players).includes(member_id)) {
        interaction.reply({ content: `You're not a player! ${WhyNobodyBuy}`, ephemeral: true })
        return
    }

    await match_ref.child("status").set("permaban")

    let permaban_num = Number(args[2])
    let permaban = match_rules.match.permabans[permaban_num]

    if (!((permaban.choice == "firstwinner" && member_id == getWinner({ race: 0, interaction })) || (permaban.choice == "firstloser" && member_id == getOpponent({ interaction, player: getWinner({ race: 0, interaction }) })))) {
        interaction.reply({ content: `It's not your turn to ban! ${WhyNobodyBuy}`, ephemeral: true })
        return
    }


    interaction.values.forEach(async selection => {
        await match_ref.child("races").child(1).child("events").push(
            {
                event: "permaban",
                type: permaban.type,
                player: member_id,
                selection: selection,
                cost: permaban.cost
            },
        )
    })

    if (permaban_num + 1 == Object.values(match_rules.match.permabans).length) {
        let events = Object.values(match_rules.race)
        await match_ref.child("status").set("events")

        interaction.update({ 
            content: "<@" + (events[0].choice == "lastwinner" ? getWinner({ race: 0, interaction }) : getOpponent({ interaction, player: getWinner({ race: 0, interaction }) })) + "> please make a selection", 
            embeds: [raceEventEmbed({ race: 1, interaction })], components: raceEventComponents({ race: 1, interaction }) })
    } else {
        interaction.update({ 
            content: "<@" + (match_rules.match.permabans[permaban_num + 1].choice == 'firstwinner' ? getWinner({ race: 0, interaction }) : getOpponent({ interaction, player: getWinner({ race: 0, interaction }) })) + ">", 
            embeds: [permabanEmbed({ interaction })], components: permabanComponents({ permaban: permaban_num + 1, interaction }) })
    }
}