module.exports = {
    name: '',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="botto") {
            if(args[1].name =="github") {
            } else if(args[1].name=="graphics") {
            } else if(args[1].name=="invite") {
            }
        } else if(args[0].name=="drive") {
        } else if(args[0].name=="mp_guide") {
        } else if(args[0].name=="stats") {
        } else if(args[0].name=="src_resources") {
        } else if(args[0].name=="rtss") {
        } else if(args[0].name=="dgvoodoo") {
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
