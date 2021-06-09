module.exports = {
    name: 'simulate',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        const myEmbed = new Discord.MessageEmbed()
        
        var track = null
        var upgrades = 5
        var fps = 60
        for (let i = 0; i < args.length; i++) {
            if (args[i].name == "track") {
                track = Number(args[i].value)
            } else if (args[i].name == "upgrades") {
                upgrades = Number(args[i].value)
            } else if (args[i].name == "fps") {
                fps = args[i].value
            }
        }
        
        var upgradeName = {0: "No Upgrades", 5: "Max Upgrades"}

        var postColumn1 = ""
        var postColumn2 = ""
        var postColumn3 = ""
        var output = tools.simulateSpeed(track, fps, upgrades) //format:: [[pod index, average speed, finish time], [next pod], ... [final pod], fps, track]
        for (let i = 0; i < 23; i++) {
            postColumn1 += racers[output[i][0]].name
            postColumn2 += Math.round(output[i][1]*10)/10
            postColumn3 += tools.timefix(output[i][2])
        }

        myEmbed
            .setTitle(tracks[track].name) //track
            .setDescription(upgradeName[upgrades] + ", " + fps + "fps") //upgrades & fps //"Max Upgrades, 60fps"
            .addField("Pod", postColumn1, true)
            .addField("Speed", postColumn2, true)
            .addField("Time", postColumn3, true)

        

        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: output,
                    embeds: [myEmbed]
                }
            }
        })
    }
    
}
