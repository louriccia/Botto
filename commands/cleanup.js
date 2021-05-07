module.exports = {
    name: 'cleanup',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var limit = 30
        if(args !== undefined){
            limit = args[0].value
        }
        client.channels.cache.get(interaction.channel_id).messages.fetch({limit:limit}).then(messages => {
            //console.log(messages.first().content)
            //console.log(messages.first().author)
            //console.log(messages.first().type)
            //console.log(messages.first().flags)
            //console.log(messages.first().system)
            const botMessages = messages.filter(msg => msg.author.bot || msg.content.startsWith("!") || msg.content == "?help");
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
