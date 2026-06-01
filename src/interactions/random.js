const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cache = require('../cache.js');
const tools = require('../generic.js');

function randomizeRow(custom_id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Randomize")
            .setEmoji("🎲")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(custom_id)
    );
}

module.exports = {
    name: 'random',
    async execute({ client, interaction, args } = {}) {
        if (args[0] == "racer") {
            const racer = tools.getRandomElement(cache.racers);
            await interaction.update({ embeds: [tools.getRacerEmbed(racer)], components: [randomizeRow("random_racer")] });
        } else if (args[0] == "track") {
            const track = tools.getRandomElement(cache.tracks);
            await interaction.update({ embeds: [tools.getTrackEmbed(track)], components: [randomizeRow("random_track")] });
        }
    }
}
