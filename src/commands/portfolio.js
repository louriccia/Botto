const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('portfolio')
        .setDescription('View your Wald Street Exchange holdings, cost basis, and P/L'),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        // Return the handler's promise so bot.js's await + try/catch sees rejections.
        return interaction.client.buttons.get('stock').execute({
            client: interaction.client, interaction, args: ['portfolio'],
            database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot,
        });
    },
};
