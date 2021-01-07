module.exports = {
    name: 'role',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="speedrunning") {
            let role = message.guild.roles.cache.get("535973118578130954");
            let member = message.member;
            if(message.member.roles.cache.find(r => r.name === "Speedrunning")){
                member.roles.remove(role).catch(console.error)
                message.channel.send("<@" + member.user + "> no longer has the speedrunning role")
            } else {
                member.roles.add(role).catch(console.error);
                message.channel.send("<@" + member.user + "> now has the speedrunning role")
            }
        } else if(args[0].name=="multiplayer") {
            let role = message.guild.roles.cache.get("474920988790751232");
            let member = message.member;
            if(message.member.roles.cache.find(r => r.name === "Multiplayer")){
                member.roles.remove(role).catch(console.error)
                message.channel.send("<@" + member.user + "> no longer has the multiplayer role")
            } else {
                member.roles.add(role).catch(console.error);
                message.channel.send("<@" + member.user + "> now has the multiplayer role")
            } 
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 3,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
