module.exports = {
    name: 'tourney',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var tools = require('./../tools.js');
        if (args[0] == "ranks") {
            if (args[1].startsWith("page")) {
                var ranks = tools.getRanks()
                const tourneyRanks = new Discord.MessageEmbed()
                tourneyRanks.setTitle("Tournament Rankings")
                var offset = Number(args[1].replace("page", ""))
                var rnk_keys = Object.keys(ranks)
                var rnk_vals = Object.values(ranks)
                var pages = 0
                if (rnk_vals.length % 5 == 0) {
                    pages = Math.floor(rnk_vals.length / 5)
                } else {
                    pages = Math.floor(rnk_vals.length / 5) + 1
                }
                for (var i = 0; i < rnk_keys.length; i++) {
                    rnk_vals[i].player = rnk_keys[i]
                }
                rnk_vals.sort(function (a, b) {
                    return b.rank - a.rank;
                })
                function ordinal_suffix_of(i) {
                    if (i < 3) {
                        var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>"]
                        return pos[i]
                    } else {
                        i = i+1
                        var j = i % 10,
                            k = i % 100;
                        if (j == 1 && k != 11) {
                            return i + "st";
                        }
                        if (j == 2 && k != 12) {
                            return i + "nd";
                        }
                        if (j == 3 && k != 13) {
                            return i + "rd";
                        }
                        return i + "th";
                    }
                }
                for (var i = 5 * offset; i < 5 * (1 + offset); i++) {
                    if (i == rnk_vals.length) {
                        i = 5 * (1 + offset)
                    } else {
                        var arrow = ":small_red_triangle:"
                        if (rnk_vals[i].change < 0) {
                            arrow = ":small_red_triangle_down:"
                        }
                        tourneyRanks
                            .addField(ordinal_suffix_of(i) + " - " + tourney_participants_data[rnk_vals[i].player].name, "`" + rnk_vals[i].matches + " matches`", true)
                            .addField(Math.round(rnk_vals[i].rank), arrow + " " + Math.round(rnk_vals[i].change), true)
                            .addField('\u200B', '\u200B', true)
                    }
                }
                var previous = false, next = false
                if (offset < 0) {
                    previous = true
                }
                if (offset + 1 == pages) {
                    next = true
                }
                tourneyRanks
                    .setFooter("Page " + (offset + 1) + " / " + pages)
                    .setColor("#E75A70")
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 7,
                        data: {
                            //content: "",
                            embeds: [tourneyRanks],
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            label: "",
                                            emoji: {
                                                id: null,
                                                name: "◀️"
                                            },
                                            style: 2,
                                            custom_id: "tourney_ranks_page" + (offset - 1),
                                            disabled: previous
                                        },
                                        {
                                            type: 2,
                                            label: "",
                                            emoji: {
                                                id: null,
                                                name: "▶️"
                                            },
                                            style: 2,
                                            custom_id: "tourney_ranks_page" + (offset + 1),
                                            disabled: next
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                })
            }
        } else if (args[0] == "") {
        }

    }

}
