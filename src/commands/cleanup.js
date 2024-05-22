const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'cleanup',
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var limit = 30
        if(args !== undefined){
            limit = args[0].value
        }
        client.channels.cache.get(interaction.channel_id).messages.fetch({limit:limit}).then(messages => {
            const botMessages = messages.filter((msg => msg.author.bot || msg.content.startsWith("!") || msg.content == "?help") && msg.createdAt > Date.now() - 1000*60*60*24*14);
            client.channels.cache.get(interaction.channel_id).bulkDelete(botMessages);
            messagesDeleted = botMessages.array().length; // number of messages deleted
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "*I gotta lots of junk!* \n`" + messagesDeleted + " messages deleted`"
                        //embeds: [myEmbed]
                    }
                }
            })
        }).catch(err => {
            console.log(err)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "`Error: Could not delete messages`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)],
                        //embeds: [racerEmbed]
                    }
                }
            })
        });
        
    }
    
}
