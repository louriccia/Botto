module.exports = {
    name: 'convert',
    execute(client, interaction, args) {
        var tools = require('./../tools.js');
        output = ""
        var time = args[0].value
        if(time.includes(":")) {
            output = tools.timetoSeconds(time)
        } else{
            output = tools.timefix(time)
        }
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
            .setAuthor("/convert")
            .setTitle("Time Converter")
            .setDescription("Input: **" + time + "**\nOutput: **" + output + "**")
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
