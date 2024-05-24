const { raceEmbed, raceComponents } = require('../../functions.js')
const { database, db } = require('../../../../firebase.js')
const { WhyNobodyBuy } = require('../../../../data/discord/emoji.js')

exports.restart = async function ({ interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    let race = Number(args[1].replace("race", ""))

    if (!Object.values(match_data.commentators).includes(member_id)) {
        interaction.reply({ content: `Only commentators/trackers can restart a race. ${WhyNobodyBuy}`, ephemeral: true })
        return
    }

    //mark race no longer live, reset ready status
    match_ref.child("races").child(race).child("live").set(false)
    Object.keys(match_data.races[race].ready).map(key => {
        match_ref.child("races").child(race).child("ready").child(key).set(false)
    })

    match_data = db.ty.live[interaction.channelId]
    interaction.update({
        content: Object.values(match_data.players).filter(player => !match_data.races[race].ready[player]).map(player => `<@${player}>`).join(" "),
        embeds: [raceEmbed({ race, interaction })],
        components: raceComponents({ race, interaction })
    })
}