const { SlashCommandBuilder } = require('discord.js');
const { COMPANIES } = require('../data/stock/companies.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('View a company on the Wald Street Exchange and buy/sell shares')
        .addStringOption(option =>
            option.setName('company')
                .setDescription('company symbol or name')
                .setAutocomplete(true)
                .setRequired(true)),
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
        interaction.client.buttons.get('stock').execute({
            client: interaction.client, interaction, args: ['detail', symbol],
            database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot,
        });
    },
};
