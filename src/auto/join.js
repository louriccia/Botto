const { swe1r_guild } = require("../data/discord/guild")
const { testing } = require("../../config")
const { welcomeMessages } = require("../data/flavor/welcome")

exports.join_message = function (client, guildMember) {
    if (guildMember.guild.id == swe1r_guild && !testing) {
        //send random welcome message
        let random_join_message = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
        random_join_message = random_join_message.replaceAll("replaceme", "@silent <@" + guildMember.user + ">")

        //assign role
        client.channels.cache.get("441839751235108875").send(random_join_message);
        const guild = client.guilds.cache.get(swe1r_guild);
        const role = guild.roles.cache.get("442316203835392001");
        guildMember.roles.add(role).catch(console.error);
    }
}
