const { database, db } = require('../../../firebase.js')
const { setupEmbed, setupComponents } = require('../functions.js')

exports.setup = async function ({ interaction, args, member_id, user_key } = {}) {
    const match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]


    await match_ref.child("status").set("setup")

    if (args[2] == "tournament") {
        await match_ref.update({ tourney: interaction.values[0], bracket: "", ruleset: "" })
    } else if (args[2] == "bracket") {
        await match_ref.update(
            {
                bracket: interaction.values[0],
                ruleset: db.ty.tournaments[match_data.tourney]?.stages[interaction.values[0]]?.ruleset ?? ""
            }
        )
    } else if (args[2] == "ruleset") {
        await match_ref.update({ ruleset: interaction.values[0] })
    } else if (args[2] == "player") {
        if (!match_data.players || (match_data.players && !Object.values(match_data.players).includes(member_id))) {
            await match_ref.child("players").child(user_key).set(member_id)
        }
    } else if (args[2] == "comm") {
        if (!match_data.commentators || (match_data.commentators && !Object.values(match_data.commentators).includes(member_id))) {
            await match_ref.child("commentators").push(member_id)
        }
    } else if (args[2] == "leave") {
        if (match_data.commentators) {
            let comms = Object.keys(match_data.commentators)
            comms.forEach(async key => {
                if (match_data.commentators[key] == member_id) {
                    await match_ref.child("commentators").child(key).remove()
                }
            })
        }
        if (match_data.players) {
            let players = Object.keys(match_data.players)
            players.forEach(async key => {
                if (match_data.players[key] == member_id) {
                    await match_ref.child("players").child(key).remove()
                }
            })
        }

    } else if (args[2] == 'cancel') {
        await match_ref.remove()
        interaction.update({ content: "Match was cancelled", embeds: [], components: [] })
        return
    }

    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [setupEmbed({ interaction })], components: setupComponents({ interaction }) })
    } else {
        interaction.update({ embeds: [setupEmbed({ interaction })], components: setupComponents({ interaction }) })
    }
}