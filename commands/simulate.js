const { tracks } = require("../data.js");
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('simulate')
        .setDescription('returns a simulated time for all racers given track and conditions')
        // .addStringOption(option => {
        //     option.setName('track')
        //         .setDescription('name or abbreviation of the track')
        //         .setRequired(true)
        //     // tracks.forEach((track, index) => {
        //     //     option.addChoices({ name: track.name, value: String(index) })
        //     // })
        // })
        .addIntegerOption(option =>
            option.setName('laps')
                .setDescription('number of laps to simulate'))
        .addIntegerOption(option =>
            option.setName('fps')
                .setDescription('framerate for the simulation (between 24 and 60fps)'))
        .addStringOption(option =>
            option.setName('upgrades')
                .setDescription('pod upgrades')
                .addChoices(
                    { name: 'Max Upgrades', value: "5" },
                    { name: "No Upgrades", value: "0" }
                )),
    execute(interaction) {
        interaction.client.buttons.get("simulate").execute(interaction.client, interaction, []);
    }

}
