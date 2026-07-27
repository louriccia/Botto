const { SlashCommandBuilder } = require('discord.js');
const { COMPANIES } = require('../data/stock/companies.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('View a company on the Wald Street Exchange, or buy/sell shares directly')
        .addStringOption(option =>
            option.setName('company')
                .setDescription('company symbol or name')
                .setAutocomplete(true)
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('buy')
                .setDescription('shares to buy (skips straight to confirmation)')
                .setMinValue(1))
        .addIntegerOption(option =>
            option.setName('sell')
                .setDescription('shares to sell (skips straight to confirmation)')
                .setMinValue(1)),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toUpperCase();
        const choices = COMPANIES
            .filter(c => c.symbol.includes(focused) || c.name.toUpperCase().includes(focused))
            .slice(0, 25)
            .map(c => ({ name: `${c.symbol} — ${c.name}`, value: c.symbol }));
        await interaction.respond(choices);
    },
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        const symbol = interaction.options.getString('company');
        const buy = interaction.options.getInteger('buy');
        const sell = interaction.options.getInteger('sell');

        if (buy != null && sell != null) {
            return interaction.reply({ content: 'Pick either `buy` or `sell`, not both.', ephemeral: true });
        }
        const args = buy != null ? ['cmdbuy', symbol, String(buy)]
            : sell != null ? ['cmdsell', symbol, String(sell)]
            : ['detail', symbol];

        // Return the handler's promise so bot.js's await + try/catch sees rejections.
        return interaction.client.buttons.get('stock').execute({
            client: interaction.client, interaction, args,
            database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot,
        });
    },
};
