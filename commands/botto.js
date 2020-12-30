module.exports = {
    name: 'botto',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
            .setTitle("Botto")
            .setDescription("Botto is a protocol droid developed by LightningPirate#5872 for the [Star Wars Episode I: Racer Discord](https://discord.gg/BEJACxXQWz). This bot can also be found on **" + String(Number(client.guilds.cache.size)-1) + "** other servers. \n\nTo invite it to your server, [click here](https://discord.com/api/oauth2/authorize?client_id=545798436105224203&permissions=0&scope=bot%20applications.commands). \nTo view Botto's github page, [click here](https://github.com/louriccia/Botto).")
            .setColor("#7289DA")
            .setThumbnail(client.user.avatarURL())
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 3,
                data: {
                    //content: "",
                    embeds: [myEmbed]
                }
            }
        })
    }
    
}
