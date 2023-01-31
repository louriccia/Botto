const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chancecube')
        .setDescription("Blue—it's the boy. Red—his mother"),
    execute(interaction) {
        interaction.reply(Math.floor(Math.random()*2) == 0 ? ":blue_square:" : ":red_square:")
    }
}
