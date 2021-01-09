module.exports = {
    name: 'role',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
        const Member = Guild.members.cache.get(interaction.member.user.id); // Getting the member.
        var content = ""
        if(args[0].name =="speedrunning") {
            let role = Guild.roles.cache.get("535973118578130954");
            let member = Member;
            if(args[0].options[0].name == "get"){
                member.roles.add(role).catch(console.error);
                content = "<@" + member.user + "> now has the speedrunning role"
            } else if(args[0].options[0].name == "remove"){
                member.roles.remove(role).catch(console.error)
                content = "<@" + member.user + "> no longer has the speedrunning role"
            }
        } else if(args[0].name=="multiplayer") {
            let role = Guild.roles.cache.get("474920988790751232");
            let member = Member;
            if(args[0].options[0].name == "get"){
                member.roles.add(role).catch(console.error);
                content = "<@" + member.user + "> now has the multiplayer role"
            } else if(args[0].options[0].name == "remove"){
                member.roles.remove(role).catch(console.error)
                content = "<@" + member.user + "> no longer has the multiplayer role"
            }
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 3,
                data: {
                    content: content,
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
