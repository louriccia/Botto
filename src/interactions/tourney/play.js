const { initializeMatch, adminEmbed, adminComponents } = require('./functions.js')

exports.play = async function ({ interaction, args, database, db, member_id, member_avatar, user_key, user_profile } = {}) {

    if (!interaction) {
        console.log("uhhh")
        return
    }

    const match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)

    //if no match, assert setup
    if (!match_data) {
        args[1] = "setup"
        initializeMatch(match_ref)
    } else if (interaction.isChatInputCommand()) {
        args[1] = 'admin'
        interaction.reply({ embeds: [adminEmbed({ interaction })], components: adminComponents({ interaction }), ephemeral: true })
        return
    }

    let command = args[1]

    if (command.includes("permaban")) {
        command = 'permaban'
    } else if (command.includes("race")) {
        command = 'race'
    }

    //process command
    const tourney_command = require(`./play/${command}.js`)
    tourney_command[command]({ interaction, args, db, database, member_id, member_avatar, user_key, user_profile })
}