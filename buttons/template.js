module.exports = {
    name: '',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var tools = require('./tools.js');
        if(args[0] == "") {
        } else if(args[0]=="") {
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 7,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
