module.exports = {
    name: 'simulate',
    execute(client, interaction, args) {
        
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        const myEmbed = new Discord.MessageEmbed()

        //set defaults
        var track = null
        var upgrades = 5
        var fps = 60
        var type = 7
        var laps = 3

        //get input
        if (args.includes("initial")) {
            track = Number(args[0])
            upgrades = Number(args[1])
            fps = Number(args[2])
            laps = Number(args[3])
            type = 4
        } else {
            for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //track
                var option = interaction.message.components[0].components[0].options[i]
                if (option.hasOwnProperty("default")) {
                    if (option.default) {
                        track = i
                    }
                }
            }
            for (var i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //laps
                var option = interaction.message.components[1].components[0].options[i]
                if (option.hasOwnProperty("default")) {
                    if (option.default) {
                        laps = Number(option.value)
                    }
                }
            }
            for (var i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //upgrades
                var option = interaction.message.components[2].components[0].options[i]
                if (option.hasOwnProperty("default")) {
                    if (option.default) {
                        upgrades = Number(option.value)
                    }
                }
            }
            for (var i = 0; i < interaction.message.components[3].components[0].options.length; i++) { //fps
                var option = interaction.message.components[3].components[0].options[i]
                if (option.hasOwnProperty("default")) {
                    if (option.default) {
                        fps = Number(option.value)
                    }
                }
            }
            if (args[0] == "track") {
                track = Number(interaction.data.values[0])
            } else if (args[0] == "upgrades") {
                upgrades = Number(interaction.data.values[0])
            } else if (args[0] == "fps") {
                fps = Number(interaction.data.values[0])
            } else if (args[0] == "laps") {
                laps = Number(interaction.data.values[0])
            }
        }

        //construct embed
        var upgradeName = { 0: "No Upgrades", 5: "Max Upgrades" }
        var postColumn1 = ""
        var postColumn2 = ""
        var postColumn3 = ""
        var output = tools.simulateSpeed(track, fps, upgrades, laps) //format:: [[pod index, average speed, finish time], [next pod], ... [final pod], fps, track]
        for (let i = 0; i < 23; i++) {
            postColumn1 += racers[output[i][0]].flag + " " + racers[output[i][0]].name + "\n"
            postColumn2 += Math.round(output[i][1] * 10) / 10 + "\n"
            postColumn3 += tools.timefix(output[i][2]) + "\n"
        }
        myEmbed
            .setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name) //track
            .setColor(planets[tracks[track].planet].color)
            .setAuthor("Simulate")
            .setDescription("Simulation using " + upgradeName[upgrades] + " at " + fps + "fps for " + laps + " laps") //upgrades & fps //"Max Upgrades, 60fps"
            .addField("Racer", postColumn1, true)
            .addField("Speed", postColumn2, true)
            .addField("Est. Time", postColumn3, true)
            .addField("Note:", "*This simulation assumes the track is a straight line, and ignores hills and fast/slow terrain. The estimated times might also be off by as much as 0.1s from pod to pod due to boost timing error.*", false)

        //construct components
        var components = []
        var track_selections = []
        var upg_selections = []
        var fps_selections = []
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
            if (track == i) {
                track_option.default = true
            }
            track_selections.push(track_option)
        }
        for(i = 0; i < 2; i ++){
            var upg_selection = {}
            if(i == 0){
                upg_selection = {
                    label: "No Upgrades",
                    value: 0
                }
                if(upgrades == 0){
                    upg_selection.default = true
                }
            } else {
                upg_selection = {
                    label: "Max Upgrades",
                    value: 5
                }
                if(upgrades == 5){
                    upg_selection.default = true
                }
            }
            upg_selections.push(upg_selection)
        }

        for (i = 24; i < 61; i += 4) {
            var fps_selection = {
                label: i + " FPS",
                value: i
            }
            if(fps == i){
                fps_selection.default = true
            }
            fps_selections.push(
                fps_selection
            )
        }
        var lap_selections = [
            {
                label: "1 Lap",
                value: 1
            },
            {
                label: "2 Laps",
                value: 2
            },
            {
                label: "3 Laps",
                value: 3
            },
            {
                label: "4 Laps",
                value: 4
            },
            {
                label: "5 Laps",
                value: 5
            }
        ]
        lap_selections.forEach(selection => {
            if(selection.value == laps){
                selection.default = true
            }
        })

        components.push(
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "simulate_track",
                        options: track_selections,
                        placeholder: "Select Track",
                        min_values: 1,
                        max_values: 1
                    },
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "simulate_laps",
                        options: lap_selections,
                        placeholder: "Select Laps",
                        min_values: 1,
                        max_values: 1
                    },
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "simulate_upgrades",
                        options: upg_selections,
                        placeholder: "Select Upgrades",
                        min_values: 1,
                        max_values: 1
                    },
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: "simulate_fps",
                        options: fps_selections,
                        placeholder: "Select FPS",
                        min_values: 1,
                        max_values: 1
                    }
                ]
            }
        )

        //interaction response
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: type,
                data: {
                    //content: "",
                    embeds: [myEmbed],
                    components: components
                }
            }
        })
    }

}
