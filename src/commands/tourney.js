const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tourney')
        .setDescription('get tourney stuff')
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription("create or resume a tournament match")
        ),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        if (interaction.options.getSubcommand() == "play") {
            interaction.client.buttons.get("tourney").execute({ client: interaction.client, interaction, args: ["play"], database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot })
        }
    }
}


