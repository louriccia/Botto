const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scavenger')
        .setDescription('can you solve all 25 clues?')
        ,
    execute(interaction, database, db) {
        interaction.client.buttons.get("scavenger").execute(interaction.client, interaction, [], database, db)
    }
}