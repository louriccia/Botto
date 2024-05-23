const { matchMakerEmbed, rulesetOverviewEmbed, reminderEmbed, firstEmbed, firstComponents, profileComponents } = require('../functions.js')

exports.start = async function ({ interaction, db, livematch, liverules, livematchref } = {}) {
    if (livematch.datetime) {
        livematchref.child('datetime').set(Date.now())
    }

    await interaction.update({
        embeds: [rulesetOverviewEmbed({ db, livematch }), reminderEmbed()],
        components: []
    })

    await interaction.followUp({
        embeds: [matchMakerEmbed({ livematch, db })],
        components: profileComponents()
    })

    interaction.followUp({
        content: Object.values(livematch.players).map(player => "<@" + player + ">").join(", "),
        embeds: [firstEmbed(livematch)],
        components: firstComponents({ liverules, livematch })
    })

    livematchref.child("status").set("first")
}