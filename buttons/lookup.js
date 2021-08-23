module.exports = {
    name: 'lookup',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var myEmbed = new Discord.MessageEmbed()
        var tools = require('../tools.js');
        var numb = null
        if (args[0] == "racer") {
            var type = 7
            if (args.includes("initial")) {
                type = 4
                numb = Number(args[1])
            } else {
                numb = Number(interaction.data.values[0])
            }
            myEmbed = tools.getRacerEmbed(numb)
            var options = []
            for (var i = 0; i < racers.length; i++) {
                var option = {
                    label: racers[i].name,
                    value: i,
                    description: racers[i].pod.substring(0, 50),
                    emoji: {
                        name: racers[i].flag.split(":")[1],
                        id: racers[i].flag.split(":")[2].replace(">", "")
                    }
                }
                if (i == numb) {
                    option.default = true
                }
                options.push(option)
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: type,
                    data: {
                        //content: "",
                        embeds: [myEmbed],
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "lookup_racer",
                                        options: options,
                                        placeholder: "Select Racer",
                                        min_values: 1,
                                        max_values: 1
                                    }
                                ]

                            }

                        ]
                    }
                }
            })
        } else if (args[0] == "track") {
            var track_selections = []
            
            var type = 7
            if (args.includes("initial")) {
                type = 4
                numb = Number(args[1])
            } else {
                numb = Number(interaction.data.values[0])
            }
            myEmbed = tools.getTrackEmbed(numb)

            for (var i = 0; i < 25; i++) {
                var track_option = {
                    label: tracks[i].name.replace("The Boonta Training Course", "Boonta Training Course"),
                    value: i,
                    description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
                    emoji: {
                        name: planets[tracks[i].planet].emoji.split(":")[1],
                        id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                    }
                }
                if(i == numb) {
                    track_option.default = true
                }
                track_selections.push(track_option)
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: type,
                    data: {
                        //content: "",
                        embeds: [myEmbed],
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: "lookup_track",
                                        options: track_selections,
                                        placeholder: "Select Track",
                                        min_values: 1,
                                        max_values: 1
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
