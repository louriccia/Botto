// The Activity's entry point.
//
// A **PRIMARY_ENTRY_POINT** command (type 4) — the thing Discord shows in the App Launcher and
// the one command that can open an Activity. There is exactly one per application.
//
// `SlashCommandBuilder` cannot express type 4, so the payload is written out. `deploy-commands.js`
// only needs `data.name` and `data.toJSON()`, both of which are here.
//
// ---------------------------------------------------------------------------
// Why APP_HANDLER rather than letting Discord do it
// ---------------------------------------------------------------------------
//
// `DISCORD_LAUNCH_ACTIVITY` (handler 2) is one less moving part: Discord opens the Activity and
// posts a message, and the bot is never involved. But the chance cube is **unlocked by a
// collection**, and a player who hasn't built one would get a loading screen followed by a refusal
// from the API — a worse version of the answer the embed has always given straight away.
//
// `APP_HANDLER` (handler 1) means this interaction reaches the bot first, so the gate stays where
// every other entry to the mode already puts it, and the copy stays the same one.
//
// ---------------------------------------------------------------------------
// This does not replace /chubacubes yet
// ---------------------------------------------------------------------------
//
// The embed still works and is still the only version proven in front of players. Two entries
// coexist until the Activity has been used in anger; retiring the embed is its own change, and it
// is the point at which this command takes the `chubacubes` name.

const { ApplicationCommandType } = require('discord.js');

// EntryPointCommandHandlerType.AppHandler. Not exported by discord.js at this version, so it is
// written out with the name it has in the API docs rather than as a bare 1.
const APP_HANDLER = 1;

const NAME = 'playcubes';

module.exports = {
    data: {
        name: NAME,
        toJSON: () => ({
            name: NAME,
            description: "Open Botto's Chance Cube",
            type: ApplicationCommandType.PrimaryEntryPoint,
            handler: APP_HANDLER,
            // Installable to guilds and to users, and usable in guilds, DMs and group DMs — an
            // Activity in a text channel is the whole reason this is worth having.
            integration_types: [0, 1],
            contexts: [0, 1, 2],
        }),
    },

    // Reached because of APP_HANDLER above. `launchActivity()` is the one response that opens the
    // iframe; anything else here would leave the player looking at a message instead of a game.
    async execute({ interaction, user_profile } = {}) {
        // eslint-disable-next-line global-require
        const { isUnlocked, lockedEmbed } = require('../interactions/cube.js');
        if (!isUnlocked(user_profile)) {
            return interaction.reply({ embeds: [lockedEmbed()], ephemeral: true });
        }
        return interaction.launchActivity();
    },
};
