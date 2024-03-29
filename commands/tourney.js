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
    execute(interaction, database, db) {
        if (interaction.options.getSubcommand() == "play") {
            interaction.client.buttons.get("tourney").execute(interaction.client, interaction, ["play", "menu", "new"], database, db)
        }
    }
}


