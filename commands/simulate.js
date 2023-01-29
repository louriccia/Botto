const { tracks } = require('../data.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simulate')
        .setDescription('returns a simulated time for all racers given track and conditions')
        .addStringOption(option =>
            option.setName('track')
                .setDescription('name or abbreviation of the track')
                .setRequired(true)
                .addChoices(
                    tracks.map((track, index) => { return { name: track.name, value: String(index) } })
                ))
        .addIntegerOption(option =>
            option.setName('laps')
                .setDescription('number of laps to simulate'))
        .addIntegerOption(option =>
            option.setName('fps')
                .setDescription('framerate for the simulation (between 24 and 60fps)'))
        .addStringOption(option => 
            option.setName('upgrades')
            .setDescription('pod upgrades')
            .addChoices(
                {name: 'Max Upgrades', value: "5"},
                {name: "No Upgrades", value: "0"}
            )),
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        const myEmbed = new Discord.MessageEmbed()

        var track = null
        var upgrades = 5
        var fps = 60
        var laps = 3
        for (let i = 0; i < args.length; i++) {
            if (args[i].name == "track") {
                track = Number(args[i].value)
            } else if (args[i].name == "upgrades") {
                upgrades = Number(args[i].value)
            } else if (args[i].name == "fps") {
                fps = args[i].value
            } else if (args[i].name == "laps") {
                laps = args[i].value
            }
        }

        client.buttons.get("simulate").execute(client, interaction, [track, upgrades, fps, laps, "initial"]);
        /*
        var upgradeName = {0: "No Upgrades", 5: "Max Upgrades"}

        var postColumn1 = ""
        var postColumn2 = ""
        var postColumn3 = ""
        var output = tools.simulateSpeed(track, fps, upgrades) //format:: [[pod index, average speed, finish time], [next pod], ... [final pod], fps, track]
        for (let i = 0; i < 23; i++) {
            postColumn1 += racers[output[i][0]].flag + " " + racers[output[i][0]].name + "\n"
            postColumn2 += Math.round(output[i][1]*10)/10 + "\n"
            postColumn3 += tools.timefix(output[i][2]) + "\n"
        }

        myEmbed
            .setTitle(tracks[track].name) //track
            .setDescription("Simulation using " + upgradeName[upgrades] + " at " + fps + "fps") //upgrades & fps //"Max Upgrades, 60fps"
            .addField("Racer", postColumn1, true)
            .addField("Speed", postColumn2, true)
            .addField("Est. Time", postColumn3, true)
            .addField("Note:", "*This simulation assumes the track is a straight line, and ignores hills and fast/slow terrain. The estimated times might also be off by as much as 0.1s from pod to pod due to boost timing error.*", false)

        

        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: output,
                    embeds: [myEmbed]
                }
            }
        })
        */
    }

}
