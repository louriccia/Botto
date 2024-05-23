const { initializeMatch, adminEmbed, adminComponents } = require('./functions.js')
const { livematch_setup } = require('./play/livematch.js')

exports.play = async function ({ interaction, args, database, db, member_id, member_avatar, user_key, user_profile } = {}) {

    const livematch = livematch_setup({ database, db, interaction })

    //if no match, assert setup
    if (!livematch) {
        args[1] = "setup"
        initializeMatch(livematchref)
    } else if (interaction.isChatInputCommand()) {
        args[1] = 'admin'
        type = 4
        interaction.reply({ embeds: [adminEmbed({ livematch, db })], components: adminComponents({ livematch }), ephemeral: true })
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
    tourney_command[command]({ interaction, args, db, database, member_id, member_avatar, user_key, user_profile, livematch })

    //turn off listener
    livematch.ref.off()
}