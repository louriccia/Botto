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
            for(var i = 0; i < racers.length; i ++){
                var option = {
                    label: racers[i].name,
                    value: i,
                    description: racers[i].pod,
                    emoji: {
                        name: racers[i].flag.split(":")[1],
                        id: racers[i].flag.split(":")[2].replace(">", "")
                    }
                }
                if(i == numb){
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
        }

        
    }

}
