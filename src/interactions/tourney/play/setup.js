const { setupEmbed, setupComponents } = require('../functions.js')

exports.setup = async function ({ interaction, args, db, member_id, livematch, livematchref, user_key } = {}) {

    await livematchref.child("status").set("setup")

    if (args[2] == "tournament") {
        await livematchref.update({ tourney: interaction.values[0], bracket: "", ruleset: "" })
    } else if (args[2] == "bracket") {
        await livematchref.update(
            {
                bracket: interaction.values[0],
                ruleset: db.ty.tournaments[livematch.tourney]?.stages[interaction.values[0]]?.ruleset ?? ""
            }
        )
    } else if (args[2] == "ruleset") {
        await livematchref.update({ ruleset: interaction.values[0] })
    } else if (args[2] == "player") {
        if (!livematch.players || (livematch.players && !Object.values(livematch.players).includes(member_id))) {
            await livematchref.child("players").child(user_key).set(member_id)
        }
    } else if (args[2] == "comm") {
        if (!livematch.commentators || (livematch.commentators && !Object.values(livematch.commentators).includes(member_id))) {
            await livematchref.child("commentators").push(member_id)
        }
    } else if (args[2] == "leave") {
        if (livematch.commentators) {
            let comms = Object.keys(livematch.commentators)
            comms.forEach(async key => {
                if (livematch.commentators[key] == member_id) {
                    await livematchref.child("commentators").child(key).remove()
                }
            })
        }
        if (livematch.players) {
            let players = Object.keys(livematch.players)
            players.forEach(async key => {
                if (livematch.players[key] == member_id) {
                    await livematchref.child("players").child(key).remove()
                }
            })
        }

    } else if (args[2] == 'cancel') {
        await livematchref.remove()
        interaction.update({ content: "Match was cancelled", embeds: [], components: [] })
        return
    }

    livematch = db.ty.live[interaction.channelId]

    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [setupEmbed({ livematch, db })], components: setupComponents({ livematch, db }) })
    } else {
        interaction.update({ embeds: [setupEmbed({ livematch, db })], components: setupComponents({ livematch, db }) })
    }
}