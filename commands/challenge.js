const { filter } = require('../tourneydata.js');
const tourney = require('./tourney.js');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('randomly generated challenges')
        .addSubcommand(subcommand =>
            subcommand
                .setName('random')
                .setDescription('get a random pod/track challenge, submit your time, earn truguts')
        ),
    execute(interaction) {
        if (interaction.options.getSubcommand() == "random") {
            interaction.client.buttons.get("challenge").execute(interaction.client, interaction, ["random", "menu", "new"])
        } 
    }
}