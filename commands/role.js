const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'role',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
        const Member = Guild.members.cache.get(interaction.member.user.id); // Getting the member.
        var content = ""
        var roles = {"474920988790751232":"Multiplayer", "841059665474617353":"Tournament", "535973118578130954":"Speedrunning", "841404897018380388": "PC Player", "841405226282909716":"Switch Player", "841405077470445669":"PlayStation Player", "841404991784091690":"Xbox Player", "841405394441338890":"Dreamcast Player", "602246101323612181":"N64 Player"}
        let member = Member;
        let role = Guild.roles.cache.get(args[0].options[0].value);
        if(args[0].name =="add") {
            member.roles.add(role).catch(console.error);
            content = "You now have the <@&" + args[0].options[0].value + "> role"
        } else if(args[0].name=="remove") {
            member.roles.remove(role).catch(console.error)
            content = "You no longer have the <@&" + args[0].options[0].value + "> role"
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: content,
                    flags: 64
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}
