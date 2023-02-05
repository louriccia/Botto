const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const tools = require('./../tools.js');
const { racers, tracks, planets, circuits } = require('./../data.js');

module.exports = {
    name: 'simulate',
    execute(client, interaction, args) {
        const myEmbed = new EmbedBuilder()
        //set defaults
        let track = null
        let upgrades = 5
        let fps = 60
        let laps = 3
        //get input
        if (interaction.isChatInputCommand()) {
            track = interaction.options.getString('track')
            upgrades = interaction.options.getInteger('upgrades') ?? 5
            fps = interaction.options.getInteger('fps') ?? 60
            laps = interaction.options.getInteger('laps') ?? 3
        } else {
            interaction.message.components[0].components[0].options.forEach(option => { //track
                if (option.default) {
                    track = Number(option.value)
                }
            })
            interaction.message.components[1].components[0].options.forEach(option => { //laps
                if (option.default) {
                    laps = Number(option.value)
                }
            })
            interaction.message.components[2].components[0].options.forEach(option => { //upgrades
                if (option.default) {
                    upgrades = Number(option.value)
                }
            })
            interaction.message.components[3].components[0].options.forEach(option => { //fps
                if (option.default) {
                    fps = Number(option.value)
                }
            })
            switch (args[0]) {
                case 'laps':
                    laps = Number(interaction.values[0])
                    break
                case 'fps':
                    fps = Number(interaction.values[0])
                    break
                case 'track':
                    track = Number(interaction.values[0])
                    break
                case 'upgrades':
                    upgrades = Number(interaction.values[0])
                    break
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
            .setAuthor({ name: "Simulate" })
            .setDescription("Simulation using " + upgradeName[upgrades] + " at " + fps + "fps for " + laps + " laps") //upgrades & fps //"Max Upgrades, 60fps"
            .addFields(
                { name: "Racer", value: postColumn1, inline: true },
                { name: "Speed", value: postColumn2, inline: true },
                { name: "Est. Time", value: postColumn3, inline: true },
                { name: "Note:", value: "*This simulation assumes the track is a straight line, and ignores hills and fast/slow terrain. The estimated times might also be off by as much as 0.1s from pod to pod due to boost timing error.*", inline: false },
            )
        //construct components
        const row1 = new ActionRowBuilder()
        const row2 = new ActionRowBuilder()
        const row3 = new ActionRowBuilder()
        const row4 = new ActionRowBuilder()
        const track_selector = new StringSelectMenuBuilder()
            .setCustomId('simulate_track')
            .setPlaceholder('Select Track')
            .setMinValues(1)
            .setMaxValues(1)
        for (let i = 0; i < 25; i++) {
            track_selector.addOptions({
                label: tracks[i].name,
                value: String(i),
                description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
                emoji: {
                    name: planets[tracks[i].planet].emoji.split(":")[1],
                    id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
                },
                default: track == i
            })
        }
        const laps_selector = new StringSelectMenuBuilder()
            .setCustomId('simulate_laps')
            .setPlaceholder('Select Laps')
            .setMinValues(1)
            .setMaxValues(1)

        const upg_selector = new StringSelectMenuBuilder()
            .setCustomId('simulate_upgrades')
            .setPlaceholder('Select Upgrades')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                {
                    label: "No Upgrades",
                    value: "0",
                    default: upgrades == 0
                },
                {
                    label: "Max Upgrades",
                    value: "5",
                    default: upgrades == 5
                }
            )
        const fps_selector = new StringSelectMenuBuilder()
            .setCustomId('simulate_fps')
            .setPlaceholder('Select FPS')
            .setMinValues(1)
            .setMaxValues(1)

        row1.addComponents(track_selector)
        row2.addComponents(laps_selector)
        row3.addComponents(upg_selector)
        row4.addComponents(fps_selector)

        for (i = 24; i < 61; i += 4) {
            fps_selector.addOptions({
                label: i + " FPS",
                value: String(i),
                default: fps == i
            })
        }
        laps_selector.addOptions(
            {
                label: "1 Lap",
                value: "1",
                default: laps == 1
            },
            {
                label: "2 Laps",
                value: "2",
                default: laps == 2
            },
            {
                label: "3 Laps",
                value: "3",
                default: laps == 3
            },
            {
                label: "4 Laps",
                value: "4",
                default: laps == 4
            },
            {
                label: "5 Laps",
                value: "5",
                default: laps == 5
            }
        )

        //interaction response
        if (interaction.isChatInputCommand()) {
            interaction.reply({
                embeds: [myEmbed],
                components: [row1, row2, row3, row4]
            })
        } else {
            interaction.update({
                embeds: [myEmbed],
                components: [row1, row2, row3, row4]
            })
        }
    }

}
