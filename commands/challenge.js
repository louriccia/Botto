const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('randomly generated challenges')
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('get a random pod/track challenge, submit your time, earn truguts')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('menu')
                .setDescription('access all options related to random challenges')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('shop')
                .setDescription('Take a look around! I\'ve got a-lots of junk!')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('inventory')
                .setDescription('Manage your item rewards')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('profile')
                .setDescription('Check out your challenge career stats')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('map')
                .setDescription('Visualize a map of every possible challenge')
        ),
    execute(interaction, database, db) {
        interaction.client.buttons.get("challenge").execute(interaction.client, interaction, ["random", interaction.options.getSubcommand()], database, db)
    }
}