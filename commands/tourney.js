module.exports = {
    name: 'tourney',
    execute(client, interaction, args) {
        const tools = require('./../tools.js');
        const Discord = require('discord.js');
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");
        var tourney_races = database.ref('tourney/races');
        var tourney_races_data = {}, tourney_matches_data = {}, tourney_participants_data = {}, tourney_tournaments_data = {}
        tourney_races.on("value", function (snapshot) {
            tourney_races_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var tourney_matches = database.ref('tourney/matches')
        tourney_matches.on("value", function (snapshot) {
            tourney_matches_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var tourney_participants = database.ref('tourney/participants')
        tourney_participants.on("value", function (snapshot) {
            tourney_participants_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var tourney_tournaments = database.ref('tourney/tournaments')
        tourney_tournaments.on("value", function (snapshot) {
            tourney_tournaments_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        const tourneyReport = new Discord.MessageEmbed()
            .setURL("https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing")
        console.log(Object.keys(tourney_races_data))
        if (args[0].name == "leaderboards") {
            var trak = null
            var podfilterout = []
            var podfilterin = []
            var showall = false
            var desc = []
            var skips = null, nu = null, deaths = null, player = null, tourney = null, quali = false
            //filters out other tracks
            for (let i = 0; i < args[0].options.length; i++) {
                if (args[0].options[i].name == "track") {
                    trak = Number(args[0].options[i].value)
                    tourneyReport
                        .setTitle(tracks[trak].name + " | Tournament Times")
                        .setColor(planets[tracks[trak].planet].color)
                } else if (args[0].options[i].name == "skips") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "skips") {
                        skips = true
                        desc.push("Skips")
                    } else if (input == "ft") {
                        skips = false
                        desc.push("Full Track")
                    }
                } else if (args[0].options[i].name == "upgrades") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "mu") {
                        nu = false
                        desc.push("Upgrades")
                    } else if (input == "nu") {
                        nu = true
                        desc.push("No Upgrades")
                    }
                } else if (args[0].options[i].name == "pod") {
                    var input = args[0].options[i].value.toLowerCase()
                    var podfilter = args[0].options[i].value.split(/[\s,]+/)
                    var filterin = true
                    for (var p = 0; p < podfilter.length; p++) {
                        if (podfilter[p] == "no") {
                            filterin = false
                        } else {
                            var numb = null
                            for (let q = 0; q < racers.length; q++) {
                                racers[q].nickname.forEach(nick => {
                                    if (nick.toLowerCase() == podfilter[p].toLowerCase()) {
                                        numb = q
                                        q = racers.length
                                    }
                                })
                            }
                            if (numb !== null) {
                                if (filterin) {
                                    podfilterin.push(numb)
                                    desc.push(racers[numb].name + " Only")
                                } else {
                                    podfilterout.push(numb)
                                    desc.push("No " + racers[numb].name)
                                }
                            }
                        }
                    }
                } else if (args[0].options[i].name == "deaths") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "deaths") {
                        deaths = true
                        desc.push("Deaths")
                    } else if (input == "deathless") {
                        deaths = false
                        desc.push("Deathless")
                    }
                } else if (args[0].options[i].name == "tourney") {
                    tourney = args[0].options[i].value
                    desc.push(String(args[0].options[i].value))
                } else if (args[0].options[i].name == "quali") {
                    quali = args[0].options[i].value
                } else if (args[0].options[i].name == "player") {
                    player = args[0].options[i].value
                    showall = true
                    const Guild = client.guilds.cache.get(interaction.guild_id);
                    const Member = Guild.members.cache.get(player)
                    tourneyReport.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guild_id).members.resolve(player).user.avatarURL())
                }
            }
            var runs = []
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            var rns = Object.keys(tourney_races_data)
            for (var i = 0; i < rns.length; i++) {
                var r = rns[i]
                if (tourney_races_data[r].track == trak) {
                    runs.push(tourney_races_data[r])
                }
            }
            if (skips) {
                runs = runs.filter(e => e.force == "Skips")
            } else if (!skips && skips !==null) {
                runs = runs.filter(e => e.force !== "Skips")
            }
            if (nu) {
                runs = runs.filter(e => e.force == "NU")
            } else if (!nu && nu !==null) {
                runs = runs.filter(e => e.force !== "NU")
            }
            if (podfilterin.length > 0) {
                runs = runs.filter(e => podfilterin.includes(e.pod))
            }
            if (podfilterout.length > 0) {
                runs = runs.filter(e => !podfilterout.includes(e.pod))
            }
            if (deaths) {
                runs =  runs.filter(e => e.totaldeaths > 0)
            } else if (!deaths&& deaths !==null) {
                runs = runs.filter(e => e.totaldeaths == 0)
            }
            if (tourney !== null) {
                runs = runs.filter(e => tourney_matches_data[e.datetime].tourney == tourney)
            }
            if (player !== null) {
                runs = runs.filter(e => tourney_participants_data[e.player].id == player)
            }
            if (quali === false) {
                runs = runs.filter(e => tourney_matches_data[e.datetime].bracket !== "Qual")
            }
            var already = []

            if (runs.length > 0) {
                runs.sort(function (a, b) {
                    return a.totaltime - b.totaltime;
                })
                for (i = 0; i < runs.length; i++) {
                    if (runs[i].hasOwnProperty("totaltime") && !already.includes(runs[i].player + runs[i].force)) {
                        var character = ""
                        var deaths = ""
                        var characterban = ""
                        var link = ""
                        var forc = "MU "
                        var opponent = ""
                        var bracket = ""
                        if (runs[i].hasOwnProperty("force")) {
                            if (runs[i].force == "Skips") {
                                forc = "Skips "
                            } else if (runs[i].force == "NU") {
                                forc = "NU "
                            }
                        }
                        link = tourney_matches_data[runs[i].datetime].url
                        if (runs[i].hasOwnProperty("podtempban")) {
                            if (runs[i].podtempban !== "") {
                                characterban = "\n~~" + racers[runs[i].podtempban].name + "~~"
                            }
                        }
                        if (runs[i].hasOwnProperty("opponent")) {
                            opponent = " vs " + tourney_participants_data[runs[i].opponent].name
                        }
                        if (runs[i].totaldeaths > 0) {
                            deaths = ":skull:×" + runs[i].totaldeaths
                        }
                        if (![undefined, "", null].includes(tourney_matches_data[runs[i].datetime].bracket)) {
                            bracket = " | " + tourney_matches_data[runs[i].datetime].bracket
                            if (![undefined, "", null].includes(tourney_matches_data[runs[i].datetime].round)) {
                                bracket += ": " + tourney_matches_data[runs[i].datetime].round
                            }
                        }
                        character = racers[runs[i].pod].flag
                        console.log(runs[i].player)
                        tourneyReport
                            .addField(pos[0] + " " + tourney_participants_data[runs[i].player].name, tourney_tournaments_data[tourney_matches_data[runs[i].datetime].tourney].nickname + bracket + "\n[Race " + runs[i].race + opponent + "](" + link + ")", true)
                            .addField(tools.timefix(Number(runs[i].totaltime).toFixed(3)), " " + character + " " + forc + " " + deaths + characterban, true)
                            .addField('\u200B', '\u200B', true)
                            .setDescription(desc.join(', ') + " [" + runs.length + " Total Runs]")
                        already.push(runs[i].player + runs[i].force)
                        pos.splice(0, 1)
                        if (pos.length == 0) {
                            i = runs.length
                        }
                    }
                }
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            //content: "",
                            embeds: [tourneyReport]
                        }
                    }
                })
            } else {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: No tournament runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)],
                            //embeds: [racerEmbed]
                        }
                    }
                })
            }

        } else if (args[0].name == "profile") {

        }

    }
}


