module.exports = {
    name: 'simulate',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        const myEmbed = new Discord.MessageEmbed()
        var output = String(Math.round(tools.simulateSpeed()*10)/10)
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: output,
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
