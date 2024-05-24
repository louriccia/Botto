const { raceEmbed, raceComponents, countDown } = require('../../functions.js')
const { database, db } = require('../../../../firebase.js')

exports.ready = async function ({ interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    let race = Number(args[1].replace("race", ""))

    //not a player
    if (!Object.values(match_data.players).includes(member_id)) {
        interaction.reply({ content: "You are not a player!", ephemeral: true })
        return
    }

    //no racer set
    if ([null, undefined, ""].includes(match_data.races[race]?.runs?.[member_id]?.pod)) {
        interaction.reply({ content: "You have not selected a racer yet! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        return
    }

    match_ref.child("races").child(race).child("ready").child(member_id).set((args[2] == "ready" ? true : false))
    match_data = db.ty.live[interaction.channelId]

    //not everyone ready
    if (Object.values(match_data.races[race].ready).filter(r => r == false).length) {
        await interaction.update({
            content: Object.values(match_data.players).filter(player => !match_data.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(match_data.commentators).map(comm => "<@" + comm + ">").join(" "),
            embeds: [raceEmbed({ race, interaction })],
            components: raceComponents({ race, interaction })
        })
        return
    }

    //start race
    await interaction.update({
        content: Object.values(match_data.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>",
        embeds: [],
        components: []
    })
    
    setTimeout(async function () {
        interaction.client.channels.cache.get(interaction.channel.id).messages.fetch(interaction.message.id).then(message => message.delete())
    }, 10000)
    match_ref.child("status").set("midrace")
    countDown(interaction)

    //initiate race
    match_ref.child("races").child(race).child("live").set(true)
    setTimeout(async function () {
        interaction.followUp({ embeds: [raceEmbed({ race, interaction })], components: raceComponents({ race, interaction }) })
    }, 10000)

}