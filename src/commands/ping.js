const { SlashCommandBuilder } = require('discord.js');

const rolemap = {
    multiplayer: "474920988790751232",
    speedrunning: "535973118578130954",
    tournament_updates: "841059665474617353"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('ping a notification role by proxy')
        .addStringOption(option =>
            option.setName('role')
                .setDescription('the role you wish to ping')
                .setRequired(true)
                .addChoices(
                    { name: 'Multiplayer', value: 'multiplayer' },
                    { name: 'Speedrunning', value: 'speedrunning' },
                    { name: 'Tournament Updates', value: 'tournament_updates' }
                )
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('an optional message to include with the ping')
        ),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        let role = interaction.options.getString("role")
        let message = interaction.options.getString("message")
        let role_id = rolemap[role]
        interaction.reply({
            content: `<@&${role_id}>` + (message ? ` ${message}` : ""),
            allowedMentions: { roles: [role_id] }
        })
    }

}
