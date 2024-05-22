module.exports = {
    name: 'random',
    execute(client, interaction, args) {
        

        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var tools = require('./../tools.js');
        if (args[0] == "racer") {
            var random_racer = Math.floor(Math.random() * 25)
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
                                        style: 4,
                                        custom_id: "random_racer"
                                    }
                                ]
                            }
                        ]
                    }
                }
            })
        } else if (args[0] == "track") {
            var random_track = Math.floor(Math.random() * 25)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 7,
                    data: {
                        //content: "",
                        embeds: [tools.getTrackEmbed(random_track)],
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
                                        style: 4,
                                        custom_id: "random_track"
                                    }
                                ]
                            }
                        ]
                    }
                }
            })
        }
    }
}
