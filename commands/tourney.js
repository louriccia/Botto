module.exports = {
    name: 'tourney',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="") {
        } else if(args[0].name=="") {
        }

        if(messageLow.startsWith(`${prefix}tourn`)){
            var upgr = null
            var skps = null
            var dths = null
            var year = null
            var podfilterout = []
            var podfilterin = []
            for (let c = 1; c < args.length; c++) {
                if (args[c] == "no") {
                    if (args[c+1] == "upgrades") {
                        upgr = false
                    }
                    if (args[c+1] == "skips" || args[c+1] == "skip") {
                        skps = false
                    }
                    if (args[c+1] == "death" || args[c+1] == "deaths") {
                        dths = false
                    }
                    for (let i =0; i<23; i++) {
                        var nname = racers[i].nickname
                        for (let y of nname) {
                            y = "" + y
                            y.replace(/\s/g, '')
                            if (args[c+1].toLowerCase() == y) {
                                podfilterout.push(i)
                            }
                        }
                    }   
                } else if(args[c] == "nu") {
                    upgr = false
                } else if ((args[c] == "mu" || args[c] == "upgrades") && upgr == null) {
                    upgr = true
                } else if ((args[c] == "skips" || args[c] == "skip") && skps == null  && args[c-1] !== "no") {
                    skps = true
                } else if(args[c] == "ns" || args[c] == "ft" || args[c] == "full") {
                    skps = false
                } else if(args[c] == "deathless") {
                    dths = false
                } else if((args[c] == "death" || args[c] == "deaths") && dths == null) {
                    dths = true
                } else if(args[c].startsWith("20") && args[c].length == 4) {
                    year = args[c]
                } else {
                    for (let i =0; i<23; i++) {
                        var nname = racers[i].nickname
                        for (let y of nname) {
                            y = "" + y
                            y.replace(/\s/g, '')
                            if (args[c].toLowerCase() == y && args[c-1] !== "no") {
                                podfilterin.push(i)
                            }
                        }
                    }   
                }
            }
            console.log(podfilterin)
            console.log(podfilterout)
            //args = args.join().replace(/,/g, '').replace(/par/g, '').replace(/times/g, '').replace(/time/g, '').toString()
            for (let i =0; i<25; i++) {
                var nname = tracks[i].nickname
                for (let y of nname) {
                    y = "" + y
                    y.replace(/\s/g, '')
                    if (args[0].toLowerCase() == y) {
                        var numb = i
                    }
                }
            }   
        
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            if (numb !== null) {
                const tourneyReport = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle(tracks[numb].name + " | Tournament Times")
                .setURL("https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing")
                //.setDescription("MU, PC")
                var tourneyfiltered = tourney.filter(element => element.track == tracks[numb].name) //filters out other tracks
                if (skps == true) {
                    tourneyfiltered = tourneyfiltered.filter(element => element.force == "Skips")
                }
                if (skps == false) {
                    tourneyfiltered = tourneyfiltered.filter(element => element.force !== "Skips")
                }
                if (upgr == true) {
                    tourneyfiltered = tourneyfiltered.filter(element => element.force !== "NU")
                }
                if (upgr == false) {
                    tourneyfiltered = tourneyfiltered.filter(element => element.force == "NU")
                }
                if (dths == true) {
                    tourneyfiltered = tourneyfiltered.filter(element => element.totaldeaths > 0)
                }
                if (dths == false) {
                   tourneyfiltered = tourneyfiltered.filter(element => element.totaldeaths == 0)
                }
                if (year !== null) {
                    tourneyfiltered = tourneyfiltered.filter(element => element.year == year)
                }
                if (podfilterin.length > 0) {
                    for (i=0; i<podfilterin.length; i++) {
                        tourneyfiltered = tourneyfiltered.filter(element => element.pod == racers[podfilterin[i]].name)
                    }
                }
                if (podfilterout.length > 0) {
                    for (i=0; i<podfilterout.length; i++) {
                        tourneyfiltered = tourneyfiltered.filter(element => element.pod !== racers[podfilterout[i]].name)
                    }
                }
                var j = 0
                var players = []
                console.log(tourneyfiltered.length)
                if (tourneyfiltered.length > 0) {
                    for (i=0; i<5;){
                        var skip = false
                        for (k = 0; k < players.length; k++) {
                            if (tourneyfiltered[j].player + tourneyfiltered[j].force == players[k]) {
                                skip = true
                            }
                        }
                        if (skip == false && tourneyfiltered[j].hasOwnProperty("totaltime")) {
                            var character = ""
                            var deaths = ""
                            var characterban = ""
                            var link = ""
                            var forc = "MU "
                            if (tourneyfiltered[j].hasOwnProperty("force")) {
                                if (tourneyfiltered[j].force == "Skips") {
                                    forc = "Skips "
                                } else if (tourneyfiltered[j].force == "NU") {
                                    forc = "NU "
                                }
                            }
                            if (tourneyfiltered[j].hasOwnProperty("url")) {
                                link = tourneyfiltered[j].url
                            }
                            if (tourneyfiltered[j].hasOwnProperty("podtempban")) {
                                characterban = "\n~~" + tourneyfiltered[j].podtempban + "~~"
                            }
                            if (tourneyfiltered[j].totaldeaths > 0) {
                                deaths = ""
                                if (tourneyfiltered[j].totaldeaths > 5) {
                                    deaths = ":skull:×"+tourneyfiltered[j].totaldeaths
                                } else {
                                    for (d = 0; d< tourneyfiltered[j].totaldeaths; d++){
                                        deaths = deaths + ":skull:"
                                    }
                                }
                            }
                            for (let n = 0; n<23; n++){
                                if (tourneyfiltered[j].pod == racers[n].name) {
                                    if (racers[n].hasOwnProperty("flag")) {
                                        character = racers[n].flag
                                    } else {
                                        character = racers[n].name
                                    }
                                }
                            } 
                            tourneyReport.addField(
                                pos[i] + " " + tourneyfiltered[j].player, tourneyfiltered[j].year + ", " + tourneyfiltered[j].bracket +": "+tourneyfiltered[j].round + "\nRace " + tourneyfiltered[j].race + ", vs " + tourneyfiltered[j].opponent, true
                            )
                            tourneyReport.addField(
                                tools.timefix(Number(tourneyfiltered[j].totaltime).toFixed(3))," " + character + "[ " + forc + "](" + link + ")" + deaths + characterban, true
                            )
                            tourneyReport.addField(
                                '\u200B', '\u200B', true
                            )
                            //message.channel.send(tourneyfiltered[j].player + " - " + tools.timefix(tourneyfiltered[j].totaltime))
                            players.push(tourneyfiltered[j].player + tourneyfiltered[j].force)
                            i++
                        }
                        j++
                        if (j == tourneyfiltered.length) {
                            i = 5
                        }
                    }
                    message.channel.send(tourneyReport)
                } else {
                    message.channel.send("Sorry, I didn't find anything")
                }
            }
        }

        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}


