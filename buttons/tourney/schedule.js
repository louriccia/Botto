let type = 4
            if (args[1] == "refresh") {
                type = 7
            }
            const tourneyReport = new EmbedBuilder()
            tourneyReport
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")
                .setTitle("Match Schedule")
                .setURL("http://speedgaming.org/swe1racer/")
                .setDescription("Upcoming matches on speedgaming.org/swe1racer\n(Current as of <t:" + Math.round(Date.now() / 1000) + ":R>)")
                .setFooter("Times are displayed in your local time")
            if (Object.values(tourney_scheduled_data).length > 0) {
                Object.values(tourney_scheduled_data).filter(match => match.datetime >= Date.now() && match.current).sort(function (a, b) { return a.datetime - b.datetime - 0 }).map(match => {
                    tourneyReport
                        .addField("<t:" + match.datetime / 1000 + ":F>", "\n" + (match.url == "" ? "" : "📺 [Stream Link](" + match.url + ")") + "\n📅 [Event Link](https://discord.gg/dWRsGTutSC?event=" + match.event + ")", true)
                        .addField(":crossed_swords: " + match.players.map(
                            player => tourney_participants_data[player].name
                        ).join(" vs "),
                            ":microphone2: " + (match.commentary && match.commentary.length > 0 && match.commentary.filter(player => player !== "").length > 0 ? (match.commentary.filter(player => player !== "").map(player => tourney_participants_data[player].name).join(", ")) : "Sign up for commentary!"), true
                        )
                        .addField('\u200B', '\u200B', true)
                })
            } else {
                tourneyReport.setDescription("No matches are currently scheduled")
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: type,
                    data: {
                        //content: content,
                        //flags: 64
                        embeds: [tourneyReport],
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "",
                                        emoji: {
                                            id: "854097998357987418",
                                            name: "refresh"
                                        },
                                        style: 2,
                                        custom_id: "tourney_schedule_refresh",
                                    },
                                    {
                                        type: 2,
                                        label: "Schedule Match",
                                        style: 5,
                                        url: "http://speedgaming.org/swe1racer/submit/"
                                    },
                                    {
                                        type: 2,
                                        label: "Sign Up for Commentary",
                                        style: 5,
                                        url: "http://speedgaming.org/swe1racer/crew/"
                                    }
                                ]
                            }
                        ]
                    }
                }
            })