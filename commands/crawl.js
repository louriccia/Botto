const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crawl')
        .setDescription('A long time ago in a galaxy far far away...'),
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        myEmbed.title
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: "EPISODE I RACER\n\n" +
                    "For generations, the GALACTIC PODRACING CIRCUIT has thrilled citizens of the Outer Rim Territories with its fast and dangerous contests of repulsor and turbine-driven land vehicles.\n\n" +
                    "Amid the ruffian and racing elite, one champion stands above the rest. His name is Sebulba, a cunning and ruthless pilot who wins by any means necessary.\n\n" +
                    "To challenge him, all the best Podrace pilots gather on the desert planet Tatooine for the legendary BOONTA CLASSIC determined to claim the title of fastest Podracer in the Galaxy…",
                }
            }
        })
    }
    
}
