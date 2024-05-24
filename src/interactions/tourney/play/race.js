exports.race = async function ({ client, interaction, args, member_id } = {}) {
    let command = args[2]

    if (command.includes("event")) {
        command = 'event'
    } else if (["ready", "unready"].includes(command)) {
        command = 'ready'
    }

    //process command
    const play_command = require(`./race/${command}.js`)
    play_command[command]({ client, interaction, args, member_id })

}