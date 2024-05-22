const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: '',
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="") {
        } else if(args[0].name=="") {
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
