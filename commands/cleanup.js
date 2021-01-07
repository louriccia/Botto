module.exports = {
    name: 'cleanup',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        client.channels.cache.get(interaction.channel_id).messages.fetch({limit:30}).then(messages => {
            const botMessages = messages.filter(msg => msg.author.bot || msg.content.startsWith("!") || msg.content == "?help");
            client.channels.cache.get(interaction.channel_id).bulkDelete(botMessages);
            messagesDeleted = botMessages.array().length; // number of messages deleted
    
            // Logging the number of messages deleted on both the channel and console.
            client.channels.cache.get(interaction.channel_id).send("*I gotta lots of junk!* \n`" + messagesDeleted + " messages deleted`")
                .then(msg => {
                    msg.delete({ timeout: 5000, reason: 'bot cleanup'})
                })
                .catch()
            console.log('Deletion of messages successful. Total messages deleted: ' + messagesDeleted)
        }).catch(err => {
            console.log('Error while doing Bulk Delete');
            console.log(err);
        });
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 2,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
