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
        if(time !== undefined){
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
        } else {
            return null
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
            .setURL("https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit#gid=0")
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
            .setURL("https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit#gid=1682683709")
            //.setImage(tracks[numb].img)
            .setImage('attachment://' + (numb+1) + '.png')
            .setTitle(tracks[numb].name)
            .setDescription("(" + tracks[numb].nickname.join(", ") + ")")
            .addField(circuits[tracks[numb].circuit].name + " Circuit" ,  "Race " + tracks[numb].cirnum, true)
            .addField("Planet",  planets[tracks[numb].planet].name, true)
            .addField("Host", planets[tracks[numb].planet].host, true)
            .addField("Track Favorite", racers[tracks[numb].favorite].flag + " " + racers[tracks[numb].favorite].name, true)
            .addField("Difficulty",difficulties[tracks[numb].difficulty].name, true)
            .addField("Length",tracks[numb].lengthclass, true)
        const newLocal = this;
        var mu = {}, nu = {}, sk = {}, mu1 = {}, nu1 = {}, sk1 = {}
        client.channels.cache.get(channel).send(trackEmbed).then(sentMessage => {
            let muurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&var-rn1z02dl=klrvnpoq&var-789x6p58=013d38rl" //mu
            let nuurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&var-rn1z02dl=21d9rzpq&var-789x6p58=013d38rl" //nu
            let skurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&&var-789x6p58=rqvg3prq" //sku
            let muurl1 = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/9d8wr6dn?top=1&embed=players&var-rn1z02dl=klrvnpoq&var-789x6p58=013d38rl" //mu
            let nuurl1 = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/9d8wr6dn?top=1&embed=players&var-rn1z02dl=21d9rzpq&var-789x6p58=013d38rl" //nu
            let skurl1 = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/9d8wr6dn?top=1&embed=players&&var-789x6p58=rqvg3prq" //sku
            let settings = {method: "Get"}
            async function getwrData() {
                try {
                const response1 = await fetch(muurl);
                const data1 = await response1.json();
                mu = data1.data
                const response2 = await fetch(nuurl);
                const data2 = await response2.json();
                nu = data2.data
                const response3 = await fetch(skurl);
                const data3 = await response3.json();
                sk = data3.data
                const response4 = await fetch(muurl1);
                const data4 = await response4.json();
                mu1 = data4.data
                const response5 = await fetch(nuurl1);
                const data5 = await response5.json();
                nu1 = data5.data
                const response6 = await fetch(skurl1);
                const data6 = await response6.json();
                sk1 = data6.data
                } catch (error) {
                    console.log(error)
                }
            }
            getwrData()
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
                                .setTitle(tracks[numb].name + " Times")
                                .setURL("https://docs.google.com/spreadsheets/d/1TwDtG6eOyiQZEZ3iTbZaEmthe5zdf9YEGJ-1tfFfQKg/edit?usp=sharing")
                                .addField("MU 3-Lap", ":gem: " + tracks[numb].partimes[0] + "\n:first_place: " + tracks[numb].partimes[1] + "\n:second_place: " + tracks[numb].partimes[2] + "\n:third_place: " + tracks[numb].partimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].partimes[4], true)
                                .addField("MU 1-Lap", ":gem: " + tracks[numb].parlaptimes[0] + "\n:first_place: " + tracks[numb].parlaptimes[1] + "\n:second_place: " + tracks[numb].parlaptimes[2] + "\n:third_place: " + tracks[numb].parlaptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parlaptimes[4], true)
                            if (tracks[numb].hasOwnProperty("parskiptimes")) {
                                tracktimesEmbed.addField("Skips 3-Lap", ":gem: " + tracks[numb].parskiptimes[0] + "\n:first_place: " + tracks[numb].parskiptimes[1] + "\n:second_place: " + tracks[numb].parskiptimes[2] + "\n:third_place: " + tracks[numb].parskiptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parskiptimes[4], true)
                            } else {
                                tracktimesEmbed.addField('\u200B', '\u200B', true)
                            }                            
                            function getRecord(record){
                                if(record !== undefined){
                                    if(record.hasOwnProperty("runs")){
                                        if(record.runs.length> 0){
                                            if(record.runs[0].hasOwnProperty("run")){
                                                var character = "", name = ""
                                                for (let j = 0; j<23; j++){
                                                    if (record.runs[0].run.values.j846d94l == racers[j].id) {
                                                        if (racers[j].hasOwnProperty("flag")) {
                                                            character = racers[j].flag
                                                        } else {
                                                            character = racers[j].name
                                                        }
                                                    }
                                                } 
                                                if (record.players.data[0].hasOwnProperty("names")) {
                                                    name = record.players.data[0].names.international
                                                } else {
                                                    name = record.players.data[0].name
                                                }
                                                var vid = record.runs[0].run.videos.links[0].uri
                                                return character + "  [" + newLocal.timefix(record.runs[0].run.times.primary_t) + "](" + vid + ")\n" + name
                                            } else {
                                                return ""
                                            }
                                        } else {
                                            return ""
                                        }
                                    } else {
                                        return ""
                                    }
                                } else {
                                    return ""
                                }
                            }
                            var wrsk = getRecord(sk)
                            var wrsk1 = getRecord(sk1)
                            var wrmu = getRecord(mu)
                            var wrmu1 = getRecord(mu1)
                            var wrnu = getRecord(nu)
                            var wrnu1 = getRecord(nu1)            
                            var tourney_mu = "", tourney_nu = "", tourney_sk = ""
                            var mudeaths = [], nudeaths = [], skdeaths = []
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
                                        if (!tourneyfiltered[j].hasOwnProperty("force")) {
                                            mudeaths.push(tourneyfiltered[j].totaldeaths)
                                            if(tourney_mu == ""){
                                                tourney_mu = character + "  [" + newLocal.timefix(tourneyfiltered[j].totaltime) + "](" + link + ")\n" + tourneyfiltered[j].player
                                            }
                                        } else {
                                            if (tourneyfiltered[j].force == "Skips") {
                                                skdeaths.push(tourneyfiltered[j].totaldeaths)
                                                if(tourney_sk == ""){
                                                    tourney_sk = character + "  [" + newLocal.timefix(tourneyfiltered[j].totaltime) + "](" + link + ")\n" + tourneyfiltered[j].player
                                                }
                                            } else if (tourneyfiltered[j].force == "NU") {
                                                nudeaths.push(tourneyfiltered[j].totaldeaths)
                                                if(tourney_nu == ""){
                                                    tourney_nu = character + "  [" + newLocal.timefix(tourneyfiltered[j].totaltime) + "](" + link + ")\n"+ tourneyfiltered[j].player
                                                }
                                            }
                                        }                       
                                    }
                                }
                            }
                            function getAvg(array){
                                array_total = 0
                                for(var i = 0; i < array.length; i++) {
                                    array_total += array[i];
                                } 
                                if(array_total > 0){
                                    return "**Avg. Deaths**\n" + (array_total/array.length).toFixed(2)
                                } else {
                                    return ""
                                }
                            }
                            var avg_mudeaths = getAvg(mudeaths)
                            var avg_nudeaths = getAvg(nudeaths)
                            var avg_skdeaths = getAvg(skdeaths)
                            if(tourney_mu !== ""){
                                tourney_mu = "[**Tourney Record**](https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing)\n" + tourney_mu
                            }
                            if(tourney_nu !== ""){
                                tourney_nu = "[**Tourney Record**](https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing)\n" + tourney_nu
                            }
                            tracktimesEmbed.addField("Max Upgrades", "[**3-Lap WR**](" + mu.weblink + ")\n" + wrmu + "\n[**1-Lap WR**](" + mu1.weblink +   ")\n" + wrmu1+ "\n" + tourney_mu + "\n" + avg_mudeaths,true)
                            tracktimesEmbed.addField("No Upgrades", "[**3-Lap WR**](" + nu.weblink + ")\n" + wrnu + "\n[**1-Lap WR**](" + nu1.weblink + ")\n" + wrnu1+ "\n" + tourney_nu + "\n" + avg_nudeaths,true)
                            if(wrsk !== "" || wrsk1 !== "" || tourney_sk !== "") {
                                if(wrsk !== ""){
                                    wrsk = "[**3-Lap WR**](" + sk.weblink +  ")\n" + wrsk
                                }
                                if(wrsk1 !== ""){
                                    wrsk1 = "[**1-Lap WR**](" + sk1.weblink +  ")\n" + wrsk1
                                }
                                if(tourney_sk !== ""){
                                    tourney_sk = "[**Tourney Record**](https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing)\n" + tourney_sk
                                }
                                tracktimesEmbed.addField("Skips", wrsk + "\n" + wrsk1 + "\n" + tourney_sk + "\n" + avg_skdeaths,true)
                            }
                            sentMessage.channel.send(tracktimesEmbed);
                        } 
                    })
                })
            }) 
        }
}