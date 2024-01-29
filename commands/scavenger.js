const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scavenger')
        .setDescription('join the jawa scavenger hunt')
        ,
    execute(interaction, database, db) {
        interaction.client.buttons.get("scavenger").execute(interaction.client, interaction, [], database, db)
    }
}