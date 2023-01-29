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
        if (args[0].name == "random") {
            client.buttons.get("challenge").execute(client, interaction, ["random", "menu", "new"])
        } 
    }
}