const { tracks } = require("../data/sw_racer/track");
const { SlashCommandBuilder } = require('discord.js');
const track_options = tracks.map((track, index) => {return { name: track.name, value: String(index) }})
module.exports = {
    data: new SlashCommandBuilder()
        .setName('simulate')
        .setDescription('returns a simulated time for all racers given track and conditions')
        .addStringOption(option => (
            option.setName('track')
                .setDescription('name or abbreviation of the track')
                .setRequired(true)
                .addChoices(...track_options)
        ))
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
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        interaction.client.buttons.get("simulate").execute(interaction.client, interaction, []);
    }

}
