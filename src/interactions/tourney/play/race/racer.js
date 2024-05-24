const { raceEmbed, raceComponents } = require('../../functions.js')
const { database, db } = require('../../../../firebase.js')

exports.racer = async function ({ client, interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    let race = Number(args[1].replace("race", ""))

    //set pod
    if (Object.values(match_data.players).includes(member_id)) {
        match_ref.child("races").child(race).child("runs").child(member_id).child("pod").set(interaction.values[0])
    }
    
    match_data = db.ty.live[interaction.channelId]
    interaction.update({
        content: Object.values(match_data.players).filter(player => !match_data.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
        embeds: [raceEmbed({ race, interaction })],
        components: raceComponents({ race, interaction })
    })
}