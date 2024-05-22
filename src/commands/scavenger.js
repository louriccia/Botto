const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scavenger')
        .setDescription('can you solve all 25 clues?')
        ,
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        interaction.client.buttons.get("scavenger").execute(interaction.client, interaction, [], database, db)
    }
}