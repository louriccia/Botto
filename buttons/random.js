module.exports = {
    name: 'random',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var tools = require('./tools.js');
        if (args[0] == "racer") {
            var random_racer = Math.floor(Math.random() * 23)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 7,
                    data: {
                        //content: "",
                        embeds: [tools.getRacerEmbed(random_racer)],
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Randomize",
                                        emoji: {
                                            id: null,
                                            name: "🎲"
                                        },
                                        style: 1,
                                        custom_id: "random_racer"
                                    }
                                ]
                            }
                        ]
                    }
                }
            })
        } else if (args[0] == "") {
        }
    }
}
