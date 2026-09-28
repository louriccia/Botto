const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syndicate')
        .setDescription('Your sponsoring syndicate: its sponsorships, what they earn, and its name')
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription("View a syndicate — yours, or another player's")
            .addUserOption(option => option.setName('player').setDescription("whose syndicate (leave empty for yours)")))
        .addSubcommand(sub => sub
            .setName('found')
            .setDescription("Found your syndicate, or change its name, emoji or motto"))
        .addSubcommand(sub => sub
            .setName('help')
            .setDescription('How sponsoring works'))
        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription("Moderators: reset a syndicate's name and motto")
            .addUserOption(option => option.setName('player').setDescription('whose syndicate').setRequired(true))),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        const sub = interaction.options.getSubcommand();
        const player = interaction.options.getUser('player');
        // Return the handler's promise so bot.js's await + try/catch sees rejections.
        return interaction.client.buttons.get('syndicate').execute({
            client: interaction.client, interaction, args: [sub, player?.id ?? ''],
            database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot,
        });
    },
};
