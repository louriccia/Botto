const { SlashCommandBuilder } = require('discord.js');

// Separate from /chancecube on purpose: that command stays a plain coin flip (plus a
// guild-specific easter egg), and adding subcommands there would have made the bare
// invocation impossible. Everything past this first screen is buttons.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('chubacubes')
        .setDescription("how far will you push your luck?"),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        // Return the handler's promise so bot.js's await + try/catch sees rejections.
        // The handler owns the unlock gate, so a locked player gets told how to unlock it.
        return interaction.client.buttons.get('cube').execute({
            client: interaction.client, interaction, args: ['open'],
            database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot,
        });
    }
};
