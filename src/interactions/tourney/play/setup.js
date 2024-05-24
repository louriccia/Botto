const { database, db } = require('../../../firebase.js')
const { setupEmbed, setupComponents } = require('../functions.js')

exports.setup = async function ({ interaction, args, member_id, user_key, livematch } = {}) {
    const livematchref = database.ref(`tourney/live/${interaction.channelId}`)
    const match_data = db.ty.live[interaction.channelId]

    await livematchref.child("status").set("setup")

    if (args[2] == "tournament") {
        await livematchref.update({ tourney: interaction.values[0], bracket: "", ruleset: "" })
    } else if (args[2] == "bracket") {
        await livematchref.update(
            {
                bracket: interaction.values[0],
                ruleset: db.ty.tournaments[match_data.tourney]?.stages[interaction.values[0]]?.ruleset ?? ""
            }
        )
    } else if (args[2] == "ruleset") {
        await livematchref.update({ ruleset: interaction.values[0] })
    } else if (args[2] == "player") {
        if (!match_data.players || (match_data.players && !Object.values(match_data.players).includes(member_id))) {
            await livematchref.child("players").child(user_key).set(member_id)
        }
    } else if (args[2] == "comm") {
        if (!match_data.commentators || (match_data.commentators && !Object.values(match_data.commentators).includes(member_id))) {
            await livematchref.child("commentators").push(member_id)
        }
    } else if (args[2] == "leave") {
        if (match_data.commentators) {
            let comms = Object.keys(match_data.commentators)
            comms.forEach(async key => {
                if (match_data.commentators[key] == member_id) {
                    await livematchref.child("commentators").child(key).remove()
                }
            })
        }
        if (match_data.players) {
            let players = Object.keys(match_data.players)
            players.forEach(async key => {
                if (match_data.players[key] == member_id) {
                    await livematchref.child("players").child(key).remove()
                }
            })
        }

    } else if (args[2] == 'cancel') {
        await livematchref.remove()
        interaction.update({ content: "Match was cancelled", embeds: [], components: [] })
        return
    }

    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [setupEmbed({ interaction })], components: setupComponents({ interaction }) })
    } else {
        interaction.update({ embeds: [setupEmbed({ interaction })], components: setupComponents({ interaction }) })
    }
}