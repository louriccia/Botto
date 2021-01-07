module.exports = {
    name: 'chancecube',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var numb = Math.floor(Math.random()*2)
        var cube = ""
        if(numb == 0){
            cube = ":blue_square:"
        }
        else{
            cube = ":red_square:"
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 3,
                data: {
                    content: cube,
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
