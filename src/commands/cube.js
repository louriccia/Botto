const { SlashCommandBuilder } = require('discord.js');
const { isUnlocked, lockedEmbed } = require('../data/discord/cube_gate.js');

// Opens the Activity. **This command no longer draws anything.**
//
// It used to build the embed board — a whole game rendered in message edits, in
// `src/interactions/cube.js`. That board is **deleted**, not merely retired: the frontend is the
// Activity (`../junkyard`, `src/activity/`), which draws from the same `game/cube/` rules through
// `src/api/cube.js`, so the bot's job here is the gate and the iframe and nothing else. Two clients
// drawing the same game is two places for the rules to drift, and the embed was always the one
// paying for it: it renders in message edits, which is a rate-limit budget rather than a frame one.
//
// The gate itself is `data/discord/cube_gate.js` — see there for why it stays on the bot.
// `launchActivity()` is the one response that opens the Activity; anything else leaves the player
// looking at a message instead of a game.
//
// Separate from /chancecube on purpose: that command stays a plain coin flip (plus a
// guild-specific easter egg).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('chubacubes')
        .setDescription("how far will you push your luck?"),
    async execute({ interaction, user_profile } = {}) {
        if (!isUnlocked(user_profile)) {
            return interaction.reply({ embeds: [lockedEmbed()], ephemeral: true });
        }
        return interaction.launchActivity();
    },
};
