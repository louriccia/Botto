const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bet')
        .setDescription("create a new bet")
        .addStringOption(option =>
            option.setName('bet_title')
                .setDescription('The name of the bet')
                .setRequired(true)
                .setMaxLength(50))
        .addStringOption(option =>
            option.setName('outcome_a')
                .setDescription('The first outcome')
                .setRequired(true)
                .setMaxLength(50))

        .addStringOption(option =>
            option.setName('outcome_b')
                .setDescription('The second outcome')
                .setRequired(true)
                .setMaxLength(50))
        .addIntegerOption(option =>
            option.setName('min_bet')
                .setDescription('The minimum bet allowed'))
        .addIntegerOption(option =>
            option.setName('max_bet')
                .setDescription('The maximum bet allowed'))
    ,
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        interaction.client.buttons.get("truguts").execute({ client: interaction.client, interaction, args: ["bet", "new"], database, db, member_id, member_name, member_avatar, user_key, user_profile })

    }
}