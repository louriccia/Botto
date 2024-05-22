const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('take a look around')
    ,
    execute({ interaction, database, db, member_id, member_avatar, user_key, user_profile } = {}) {
        interaction.client.buttons.get("challenge").execute({ client: interaction.client, interaction, args: ['random', 'shop'], database, db, member_id, member_avatar, user_key })
    }
}