module.exports = {
    
    timefix: function(time) {
        var myformat = new Intl.NumberFormat('en-US', { 
            minimumIntegerDigits: 2, 
            minimumFractionDigits: 3 
        });
        if (time >= 3600) {
            var hours = Math.floor(time/3600)
            var minutes = Math.floor((time-hours*3600)/60)
            if (minutes < 10) {
                minutes = "0" + minutes
            }
            var seconds = (time - hours*3600 - minutes * 60).toFixed(3)
            return hours.toString() + ":" + minutes.toString() + ":" + myformat.format(seconds)
        } else if (time >= 60) {
            var minutes = Math.floor(time/60)
            var seconds = (time - minutes * 60).toFixed(3)
            return minutes.toString() + ":" + myformat.format(seconds)
        } else {
            return Number(time).toFixed(3)
        }
    },
    timetoSeconds: function(time) {
        var myformat = new Intl.NumberFormat('en-US', { 
            minimumIntegerDigits: 2, 
            minimumFractionDigits: 3 
        });
        if (time.includes(":")){
            var split = time.split(':')
            if (split.length = 2) {
                var out = Number(split[0]*60)+Number(split[1])
                if (Number(split[1]) >= 60) {
                    return null
                } else {
                    return Number(myformat.format(out)).toFixed(3)
                }
            } else {
                return null
            }
            
        } else {
            return Number(myformat.format(time)).toFixed(3)
        }
        
    },
    findTime: function(str) {
        var time = ""
        var time_begin = -1
        var time_length = 0
        for (let i =0; i<str.length; i++) {
            if(Number.isInteger(parseInt(str.charAt(i)))) {
                for (let j = 1; j<9; j++) {
                    if (Number.isInteger(parseInt(str.charAt(i+j))) || str.charAt(i+j) == ":" || str.charAt(i+j) == ".") {
                        time_length++
                    } else {
                        j = 9
                    }
                }
                if (time_length > 4) {
                    time_begin = i
                    i = str.length
                }
            } else {
                time_length = 0
            }
        }
        if (time_length > 0) {
            time = str.substring(time_begin, time_begin+time_length+1)
            if (time.length > 6 && !time.includes(":")) {
                time = ""
            }
            if (time.length > 4 && !time.includes(".")) {
                time = ""
            }
        }
        return time
    }, 
    upgradeTraction: function(base, upg) {
        return Math.min(1, base + upg*0.05)
    }, 
    upgradeTurning: function(base, upg) {
        if(upg < 5){
            return base + upg*116
        } else {
            return base + (upg-1)*116+114
        }
    }, 
    upgradeAcceleration: function(base, upg) {
        return base - 0.14*base*upg
    }, 
    upgradeTopSpeed: function(base, upg) {
        return Math.min(base + 40*upg, 650)
    }, 
    upgradeAirBrake: function(base, upg) {
        var brake = base
        if(upg > 0){
            brake = brake - base*0.08
        }
        if(upg > 1){
            brake = brake - base*0.09*upg
        }
        return brake
    }, 
    upgradeCooling: function(base, upg) {
        return(base+upg*1.6)
    }, 
    upgradeRepair: function(base, upg) {
        if(upg < 5){
            return(Math.min(1, base+upg*0.1))
        } else {
            return(Math.min(1, base+(upg-1)*0.1 + 0.05))
        }
    }, 
    avgSpeed: function(topspeed, boost, heatrate, coolrate) {
        var boostdistance = (boost/50)*(50*(100/heatrate)-11*Math.log(Math.abs(50*(100/heatrate)+11)))-(boost/50)*(50*(0)-11*Math.log(Math.abs(50*(0)+11))) 
        var avgboost = boostdistance/(100/heatrate)
        var e19 = 1-(3333/(100*45*((3333/(100*45))+5))) 
        var cooldistance = boost*Math.log(Math.abs(11*e19**(45*(100/heatrate))*heatrate+7500*e19**(45*(100/heatrate+100/coolrate))))/(Math.log(e19)*45)-boost*Math.log(Math.abs(11*e19**(45*(100/heatrate))*heatrate+7500*e19**(45*(100/heatrate))))/(Math.log(e19)*45)
        var avgcool = cooldistance/(100/coolrate)
        var avgspeed = ((100/heatrate)*(topspeed+avgboost)+(100/coolrate)*(topspeed+avgcool))/(100/heatrate+100/coolrate)
        return avgspeed
    },
    getRacerEmbed: function(numb) {
        const Discord = require('discord.js');
        var Tier = ["Top", "High", "Mid", "Low"]
        var boost = racers[numb].boost_thrust
        var heatrate = racers[numb].heat_rate
        var coolrate = this.upgradeCooling(racers[numb].cool_rate, 5)
        var topspeed = this.upgradeTopSpeed(racers[numb].max_speed, 5)
        var avgspeedmu = this.avgSpeed(topspeed,boost,heatrate,coolrate)
        var avgspeednu = this.avgSpeed(racers[numb].max_speed,boost,heatrate,racers[numb].cool_rate)
        const racerEmbed = new Discord.MessageEmbed()
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].flag + " " + racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .addField("Pod", racers[numb].Pod, false)
            .addField("Species: " + racers[numb].species, "Homeworld: " + racers[numb].homeworld, true)
            .addField("Favorite", tracks[racers[numb].favorite].name, true)
            .addField("Voice Actor", racers[numb].voice, true)
            .addField("Tier", Tier[racers[numb].nu_tier] + " | " + Tier[racers[numb].mu_tier], true)
            .addField("Average Speed", Math.round(avgspeednu) + " | " + Math.round(avgspeedmu), true)
            .addField("Max Turn", racers[numb].max_turn_rate + "°/s", true)
            .setImage(racers[numb].stats)
        return racerEmbed
    },
    getTrackEmbed: function(numb, client, channel, footer) {
        const Discord = require('discord.js');
        const fetch = require('node-fetch');
        const attachment = new Discord
            .MessageAttachment('./img/tracks/' + (numb+1) + '.png', (numb+1)+'.png');
        const trackEmbed = new Discord.MessageEmbed()
            .setThumbnail(planets[tracks[numb].planet].img)
            .setFooter(footer)
            .setColor(planets[tracks[numb].planet].color)
            .attachFiles(attachment)
            //.setImage(tracks[numb].img)
            .setImage('attachment://' + (numb+1) + '.png')
            .setTitle(tracks[numb].name)
            .setDescription("(" + tracks[numb].nickname.join(", ") + ")")
            .addField(circuits[tracks[numb].circuit].name + " Circuit" ,  "Race " + tracks[numb].cirnum, false)
            .addField("Planet: " +planets[tracks[numb].planet].name,  "Host: " + planets[tracks[numb].planet].host, true)
            .addField("Track Favorite", racers[tracks[numb].favorite].flag + " " + racers[tracks[numb].favorite].name, true)
            .addField("Difficulty: " + difficulties[tracks[numb].difficulty].name,  "Length: " + tracks[numb].lengthclass, true)
        let muurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&var-789k49lw=xqkrk919&var-2lgz978p=81p7we17" //mu
        let nuurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&var-789k49lw=z194gjl4&var-2lgz978p=81p7we17" //nu
        let skurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&&var-2lgz978p=p125ev1x" //sku
        let settings = {method: "Get"}
        var wr3lap = ""
        const newLocal = this;
        async function getwrData() {
            try {
            const response1 = await fetch(muurl);
            const data1 = await response1.json();
            var mu = data1.data
            const response2 = await fetch(nuurl);
            const data2 = await response2.json();
            var nu = data2.data
            const response3 = await fetch(skurl);
            const data3 = await response3.json();
            var sk = data3.data
            var character = ""
            var name = ""
            if (sk.hasOwnProperty("runs") && sk.runs.length > 0) {
                if (sk.runs[0].hasOwnProperty("run")) {
                    for (let j = 0; j<23; j++){
                        if (sk.runs[0].run.values.j846d94l == racers[j].id) {
                            if (racers[j].hasOwnProperty("flag")) {
                                character = racers[j].flag
                            } else {
                                character = racers[j].name
                            }
                        }
                    } 
                    if (sk.players.data[0].hasOwnProperty("names")) {
                        name = sk.players.data[0].names.international
                    } else {
                        name = sk.players.data[0].name
                    }
                    var vid = sk.runs[0].run.videos.links[0].uri
                    wr3lap += "[" + newLocal.timefix(sk.runs[0].run.times.primary_t) + "](" + vid + ") **| Skips**\n" + character + " " + name  +"\n"
                }
            }
            for (let j = 0; j<23; j++){
                if (mu.runs[0].run.values.j846d94l == racers[j].id) {
                    if (racers[j].hasOwnProperty("flag")) {
                        character = racers[j].flag
                    } else {
                        character = racers[j].name
                    }
                }
            } 
            if (mu.players.data[0].hasOwnProperty("names")) {
                name = mu.players.data[0].names.international
            } else {
                name = mu.players.data[0].name
            }
            var vid = mu.runs[0].run.videos.links[0].uri
            wr3lap += "[" + newLocal.timefix(mu.runs[0].run.times.primary_t) + "](" + vid + ") **| MU**\n" + character + " " + name +"\n"
            for (let j = 0; j<23; j++){
                if (nu.runs[0].run.values.j846d94l == racers[j].id) {
                    if (racers[j].hasOwnProperty("flag")) {
                        character = racers[j].flag
                    } else {
                        character = racers[j].name
                    }
                }
            } 
            if (nu.players.data[0].hasOwnProperty("names")) {
                name = nu.players.data[0].names.international
            } else {
                name = nu.players.data[0].name
            }
            var vid = nu.runs[0].run.videos.links[0].uri

            wr3lap += "[" + newLocal.timefix(nu.runs[0].run.times.primary_t) + "](" +  vid+ ") **| NU**\n" + character + " " + name +"\n"
            trackEmbed.addField("3-Lap World Records",wr3lap,true)
            var tourney_mu = ""
            var tourney_nu = ""
            var tourney_sk = ""
            if (tourney.length > 0) {
                var tourneyfiltered = tourney.filter(element => element.track == tracks[numb].name)
                for(j=0; j<tourneyfiltered.length; j++){
                    if (tourneyfiltered[j].hasOwnProperty("totaltime")) {
                        var link = ""
                        if (tourneyfiltered[j].hasOwnProperty("url")) {
                            link = tourneyfiltered[j].url
                        }
                        var character = ""
                        for (let n = 0; n<23; n++){
                            if (tourneyfiltered[j].pod == racers[n].name) {
                                if (racers[n].flag !== "") {
                                    character = racers[n].flag
                                } else {
                                    character = racers[n].name
                                }
                            }
                        } 
                        if (!tourneyfiltered[j].hasOwnProperty("force") && tourney_mu == "") {
                            tourney_mu = "[" + newLocal.timefix(tourneyfiltered[j].totaltime) + "](" + link + ") **|MU**\n" + character + " " + tourneyfiltered[j].player
                        } else {
                            if (tourneyfiltered[j].force == "Skips" && tourney_sk == "") {
                                tourney_sk = "[" + newLocal.timefix(tourneyfiltered[j].totaltime) + "](" + link + ") **|Skips**\n" + character + " " + tourneyfiltered[j].player
                            } else if (tourneyfiltered[j].force == "NU" && tourney_nu == "") {
                                tourney_nu = "[" + newLocal.timefix(tourneyfiltered[j].totaltime) + "](" + link + ") **|NU**\n" + character + " " + tourneyfiltered[j].player
                            }
                        }                       
                    }
                    if(![tourney_mu, tourney_nu, tourney_sk].includes("")) {
                        j = tourneyfiltered.length
                    }
                }
            }
            trackEmbed.addField("Tourney Records", tourney_sk + "\n" + tourney_mu + "\n" + tourney_nu, true)
            client.channels.cache.get(channel).send(trackEmbed).then(sentMessage => {
                sentMessage.react('⏱️').then(() => {
                    const filter = (reaction, user) => {
                        return ['⏱️'].includes(reaction.emoji.name) && user.id !== "545798436105224203";
                    };
                    sentMessage.awaitReactions(filter, { max: 1})
                        .then(collected => {
                            const reaction = collected.first();
                            if (reaction.emoji.name === '⏱️' && reaction.users.id !== "545798436105224203") {
                                const tracktimesEmbed = new Discord.MessageEmbed()
                                    .setColor(planets[tracks[numb].planet].color)
                                    .setTitle(tracks[numb].name + " | Par Times")
                                    .setURL("https://docs.google.com/spreadsheets/d/1TwDtG6eOyiQZEZ3iTbZaEmthe5zdf9YEGJ-1tfFfQKg/edit?usp=sharing")
                                    .addField("FT 3-Lap", ":gem: " + tracks[numb].partimes[0] + "\n:first_place: " + tracks[numb].partimes[1] + "\n:second_place: " + tracks[numb].partimes[2] + "\n:third_place: " + tracks[numb].partimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].partimes[4], true)
                                    .addField("FT 1-Lap", ":gem: " + tracks[numb].parlaptimes[0] + "\n:first_place: " + tracks[numb].parlaptimes[1] + "\n:second_place: " + tracks[numb].parlaptimes[2] + "\n:third_place: " + tracks[numb].parlaptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parlaptimes[4], true)
                                if (tracks[numb].hasOwnProperty("parskiptimes")) {
                                    tracktimesEmbed.addField("Skips 3-Lap", ":gem: " + tracks[numb].parskiptimes[0] + "\n:first_place: " + tracks[numb].parskiptimes[1] + "\n:second_place: " + tracks[numb].parskiptimes[2] + "\n:third_place: " + tracks[numb].parskiptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parskiptimes[4], true)
                                }
                                sentMessage.channel.send(tracktimesEmbed);
                            } 
                        })
                    })
                }) 
        } catch (error) {
            console.log(error)
        }
        }
        getwrData()
    }
}