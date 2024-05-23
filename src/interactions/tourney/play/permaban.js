const { WhyNobodyBuy } = require('../../../data/discord/emoji.js')
const { getOpponent, getWinner, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../functions.js')


exports.permaban = async function ({ interaction, args, member_id, livematch, liverules, livematchref } = {}) {
    if (!Object.values(livematch.players).includes(member_id)) {
        interaction.reply({ content: `You're not a player! ${WhyNobodyBuy}`, ephemeral: true })
    }

    await livematchref.child("status").set("permaban")

    let permaban_num = Number(args[2])
    let permaban = liverules.match.permabans[permaban_num]

    if (!((permaban.choice == "firstwinner" && member_id == getWinner({ race: 0, livematch })) || (permaban.choice == "firstloser" && member_id == getOpponent({ livematch, player: getWinner({ race: 0, livematch }) })))) {
        interaction.reply({ content: `It's not your turn to ban! ${WhyNobodyBuy}`, ephemeral: true })
    }


    interaction.values.forEach(async selection => {
        await livematchref.child("races").child(1).child("events").push(
            {
                event: "permaban",
                type: permaban.type,
                player: member_id,
                selection: selection,
                cost: permaban.cost
            },
        )
    })

    if (permaban_num + 1 == Object.values(liverules.match.permabans).length) {
        let events = Object.values(liverules.race)
        await livematchref.child("status").set("events")

        interaction.update({ 
            content: "<@" + (events[0].choice == "lastwinner" ? getWinner({ race: 0, livematch }) : getOpponent({ livematch, player: getWinner({ race: 0, livematch }) })) + "> please make a selection", 
            embeds: [raceEventEmbed({ race: 1, livematch, liverules })], components: raceEventComponents({ race: 1, livematch, interaction, liverules }) })
    } else {
        interaction.update({ 
            content: "<@" + (liverules.match.permabans[permaban_num + 1].choice == 'firstwinner' ? getWinner({ race: 0, livematch }) : getOpponent({ livematch, player: getWinner({ race: 0, livematch }) })) + ">", 
            embeds: [permabanEmbed({ livematch })], components: permabanComponents({ permaban: permaban_num + 1, livematch, liverules }) })
    }
}