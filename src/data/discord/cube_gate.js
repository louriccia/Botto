// The unlock gate for Botto's Chance Cube, and the one thing the bot still draws for it.
//
// The game's frontend is the Activity (`../junkyard`, `src/activity/`), which reads the rules out
// of `game/cube/` through `api/cube.js`. The embed board that used to draw the game inside Discord
// is gone, and with it `interactions/cube.js` — where these two functions used to live, wedged
// against a thousand lines of rendering that both slash commands had to load to reach them.
//
// **The gate stays on the bot rather than in the client** for the reason `cube_launch.js` gives:
// the cube is unlocked by a collection, and a player who hasn't built one should be told so before
// an iframe opens, not after it has loaded and asked the API.

const { EmbedBuilder } = require('discord.js');
const { WhyNobodyBuy } = require('./emoji.js');

// The single source of truth for the unlock gate. collectionRewardUpdater writes collection
// rewards into `effects` (not a `rewards` object, which doesn't exist), so that's where
// completing Red vs Blue lands.
exports.isUnlocked = user_profile => !!user_profile?.effects?.chance_cube;

exports.lockedEmbed = () => new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle(`${WhyNobodyBuy} You haven't built a cube yet`)
    .setDescription('Botto\'s Chance Cube is unlocked by completing the **Red vs Blue** collection '
        + '— three **Red Side** and three **Blue Side** items, assembled into one six-sided cube. '
        + 'Check `/collections`.');
