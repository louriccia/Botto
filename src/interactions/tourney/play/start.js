const { database, db } = require('../../../firebase.js')
const { matchMakerEmbed, rulesetOverviewEmbed, firstEmbed, firstComponents, profileComponents } = require('../functions.js')

exports.start = async function ({ interaction } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    if (match_data.datetime) {
        match_ref.child('datetime').set(Date.now())
    }

    await interaction.update({
        embeds: [rulesetOverviewEmbed({ interaction })],
        components: []
    })

    await interaction.followUp({
        embeds: [matchMakerEmbed({ interaction })],
        components: profileComponents()
    })

    interaction.followUp({
        content: Object.values(match_data.players).map(player => "<@" + player + ">").join(", "),
        embeds: [firstEmbed({ interaction })],
        components: firstComponents({ interaction })
    })

    match_ref.child("status").set("first")
}