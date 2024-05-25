const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRaffleTally } = require('../data/raffle/functions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raffle')
        .setDescription('raffle ticket leaderboard'),
    execute({ interaction } = {}) {
        const myEmbed = new EmbedBuilder

        let tally = getRaffleTally()

        let total = Object.values(tally).reduce((a, b) => a + b)

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("raffle")
                .setLabel("Raffle")
                .setStyle(ButtonStyle.Primary)
        )

        myEmbed
            .setTitle("<a:chance_cube:1235055236138270760> Raffle Leaderboard")
            .setColor("Blurple")
            .setDescription(Object.keys(tally).sort((a, b) => tally[b] - tally[a]).map(user => (`<@${user}> **${tally[user]}** (${((tally[user] / total) * 100).toFixed(0)}%)`)).join("\n"))
            .setFooter({ text: `${total} tickets awarded` })
        interaction.reply({ embeds: [myEmbed], components: [row1] })
    }

}
