module.exports = {
    name: 'weekly',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="") {
        } else if(args[0].name=="") {
        }
        if(message.content.startsWith(`${prefix}weekly`)) {
            if (args.length > 0) {
                if (args[0].startsWith("q")) {
                    //generate approval queue
                } else if (args[0].startsWith("challenge")) {
                    //set challenge
                } else {
                    //submission
                }
            } else {
                //post leaderboard
            }
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
