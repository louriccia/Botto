module.exports = {
    name: 'role',
    execute(client, interaction, args) {
        

        var tools = require('./../tools.js');
        const Discord = require('discord.js');
        const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
        const Member = Guild.members.cache.get(interaction.member.user.id); // Getting the member.
        var content = ""
        var roles = {"474920988790751232":"Multiplayer", "841059665474617353":"Tournament Updates", "535973118578130954":"Speedrunning", "841404897018380388": "PC Player", "841405226282909716":"Switch Player", "841405077470445669":"PlayStation Player", "841404991784091690":"Xbox Player", "841405394441338890":"Dreamcast Player", "602246101323612181":"N64 Player"}
        let member = Member;
        let role = Guild.roles.cache.get(args[0]);
        if(Member.roles.cache.some(r => r.id === role.id)){
            member.roles.remove(role).catch(console.error)
            content = "You no longer have the <@&" + args[0] + "> role"
        } else {
            member.roles.add(role).catch(console.error);
            content = "You now have the <@&" + args[0] + "> role"
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
