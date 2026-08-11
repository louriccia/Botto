const { SlashCommandBuilder } = require('discord.js');

// Opens the Activity. **This command no longer draws anything.**
//
// It used to build the embed board — a whole game rendered in message edits, in
// `src/interactions/cube.js`. The frontend is the Activity now (`../junkyard`, `src/activity/`),
// which draws from the same `game/cube/` rules through `src/api/cube.js`, so the bot's job here is
// the gate and the iframe and nothing else. Two clients drawing the same game is two places for the
// rules to drift, and the embed was always the one paying for it: it renders in message edits,
// which is a rate-limit budget rather than a frame budget.
//
// **The unlock gate stays here rather than in the client**, which is the same reasoning
// `cube_launch.js` gives for its `APP_HANDLER`: the chance cube is unlocked by a collection, and a
// player who hasn't built one should be told so before an iframe opens, not after it has loaded and
// asked the API. `launchActivity()` is the one response that opens the Activity; anything else
// leaves the player looking at a message instead of a game.
//
// Separate from /chancecube on purpose: that command stays a plain coin flip (plus a
// guild-specific easter egg).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('chubacubes')
        .setDescription("how far will you push your luck?"),
    async execute({ interaction, user_profile } = {}) {
        // Required lazily, exactly as `cube_launch.js` does it: that module pulls in the whole
        // interaction layer as a side effect of loading, and this command needs two functions off it.
        // eslint-disable-next-line global-require
        const { isUnlocked, lockedEmbed } = require('../interactions/cube.js');
        if (!isUnlocked(user_profile)) {
            return interaction.reply({ embeds: [lockedEmbed()], ephemeral: true });
        }
        return interaction.launchActivity();
    },
};
