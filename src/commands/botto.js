const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botto')
        .setDescription('introduces botto and provides an invite link'),
    execute({ interaction } = {}) {
        const myEmbed = new EmbedBuilder()
            .setTitle("Botto")
            .setDescription("Botto is a protocol droid developed by LightningPirate#5872 for the [Star Wars Episode I: Racer Discord](https://discord.gg/BEJACxXQWz). His purpose is to enhance your Star Wars Episode I: Racer gameplay.") // This bot can also be found on **" + String(Number(client.guilds.cache.size) - 1) + "** other servers."
            .addFields({ name: "Features", value: "Botto uses Discord's integrated slash commands feature for bots. Type forward slash ('/') to see a full list of commands including several `/lookup` and `/random` commands for SWE1R content. He is also capable of getting leaderboard data from [speedrun.com](https://www.speedrun.com/swe1r) with the `/src` command and tournament leaderboards using the `/tourney` command. Another popular feature is the `/challenge` command which calls randomly generated challenges and saves submitted times.", inline: false })
            //.addField("Invite","To invite Botto to your server with slash commands, [click here](https://discord.com/api/oauth2/authorize?client_id=545798436105224203&permissions=0&scope=bot%20applications.commands).", false)
            //.addField("Github", "To view Botto's github page, [click here](https://github.com/louriccia/Botto).",false)
            //.addField("Feedback","[Request a feature](https://github.com/louriccia/Botto/discussions/3) or [give your feedback](https://github.com/louriccia/Botto/discussions/4) on using the bot by commenting on the linked discussion posts." ,false)
            .setColor("#7289DA")
            .setThumbnail(interaction.client.user.avatarURL())
        interaction.reply({
            embeds: [myEmbed], components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "Invite Botto",
                            emoji: {
                                name: "botto",
                                id: "850138537440313344"
                            },
                            style: 5,
                            url: "https://discord.com/api/oauth2/authorize?client_id=545798436105224203&permissions=0&scope=bot%20applications.commands"
                        },
                        {
                            type: 2,
                            label: "Join the Discord",
                            emoji: {
                                name: "SWR",
                                id: "671547869118988328"
                            },
                            style: 5,
                            url: "https://discord.gg/BEJACxXQWz"
                        },
                        {
                            type: 2,
                            label: "Github",
                            style: 5,
                            url: "https://github.com/louriccia/Botto"
                        }
                    ]
                }
            ]
        })
    }
}
