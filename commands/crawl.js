const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crawl')
        .setDescription('A long time ago in a galaxy far far away...'),
    execute(interaction) {
        const myEmbed = new EmbedBuilder()
            .setTitle("EPISODE I RACER")
            .setDescription("For generations, the GALACTIC PODRACING CIRCUIT has thrilled citizens of the Outer Rim Territories with its fast and dangerous contests of repulsor and turbine-driven land vehicles.\n\n" +
            "Amid the ruffian and racing elite, one champion stands above the rest. His name is Sebulba, a cunning and ruthless pilot who wins by any means necessary.\n\n" +
            "To challenge him, all the best Podrace pilots gather on the desert planet Tatooine for the legendary BOONTA CLASSIC determined to claim the title of fastest Podracer in the Galaxy…")
        interaction.reply({
            embeds: [myEmbed]
        })
    }

}
