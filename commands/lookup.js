module.exports = {
    name: 'lookup',
    execute(client, interaction, args) {
        function getRacer(input){
            var numb = null
            for(let i = 0; i<racers.length; i++){
                if(input == racers[i].name.toLowerCase() || input == racers[i].name.toLowerCase().replace(/ /g, '')){
                    numb = i
                    i = racers.length
                }
                racers[i].nickname.forEach(nick => {
                    if(nick.toLowerCase() == input){
                        numb = i
                        i = racers.length
                    }
                })     
            }
            return numb
        }
        function getTrack(input){
            var numb = null
            for(let i = 0; i<tracks.length; i++){
                if(input == tracks[i].name.toLowerCase() || input == tracks[i].name.toLowerCase().replace(/ /g, '')){
                    numb = i
                    i = tracks.length
                }
                if(i<tracks.length){
                    tracks[i].nickname.forEach(nick => {
                        if(nick.toLowerCase() == input){
                            numb = i
                            i = tracks.length
                        }
                    })    
                }
            }
            return numb
        }
        const fetch = require('node-fetch');
        var tools = require('./../tools.js');
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="racer") {
            var input = args[0].options[0].value.toLowerCase()
            var numb = getRacer(input)
            if(numb !== null){
                var Tier = ["Top", "High", "Mid", "Low"]
                const racerEmbed = new Discord.MessageEmbed()
                    .setFooter("/lookup")
                    .setThumbnail(racers[numb].img)
                    .setColor('#00DE45')
                    .setTitle(racers[numb].flag + " " + racers[numb].name)
                    .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
                    .addField("Tier", Tier[racers[numb].mu_tier], true)
                if (racers[numb].hasOwnProperty("species")){
                    racerEmbed.addField("Species/Homeworld", racers[numb].species, true)
                }
                racerEmbed
                    .addField("Pod", racers[numb].Pod, true)
                    .setImage(racers[numb].stats)
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 3,
                        data: {
                            //content: "",
                            embeds: [racerEmbed]
                        }
                    }
                })
            } else {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: Racer not found `\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                            //embeds: [racerEmbed]
                        }
                    }
                })
            }
        } else if(args[0].name=="track") {
            var input = args[0].options[0].value.toLowerCase()
            var numb = getTrack(input)
            if(numb == null){ 
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: Track not found `\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                            //embeds: [racerEmbed]
                        }
                    }
                })
            } else {
                const trackEmbed = new Discord.MessageEmbed()
                    .setThumbnail(planets[tracks[numb].planet].img)
                    .setFooter("/lookup")
                    .setColor(planets[tracks[numb].planet].color)
                    .setImage(tracks[numb].img)
                    .setTitle(tracks[numb].name)
                    .addField("Planet", planets[tracks[numb].planet].name, true)
                    .addField("Circuit", circuits[tracks[numb].circuit].name + " - Race " + tracks[numb].cirnum, true)
                    .addField("Favorite", racers[tracks[numb].favorite].flag + " " + racers[tracks[numb].favorite].name, true)
                    .addField("Length", tracks[numb].lengthclass, true)
                    .addField("Difficulty", difficulties[tracks[numb].difficulty].name, true)
                    .addField("Abbreviation", tracks[numb].nickname.join(", "), true)
                let muurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&var-789k49lw=xqkrk919&var-2lgz978p=81p7we17" //mu
                let nuurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&var-789k49lw=z194gjl4&var-2lgz978p=81p7we17" //nu
                let skurl = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/level/' + tracks[numb].id + "/824owmd5?top=1&embed=players&&var-2lgz978p=p125ev1x" //sku
                let settings = {method: "Get"}
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
                            trackEmbed.addField("Skips WR", character + " " + name + "\n[" + tools.timefix(sk.runs[0].run.times.primary_t) + "](" + vid + ")",true)
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
                    trackEmbed.addField("MU WR", character + " " + name + "\n[" + tools.timefix(mu.runs[0].run.times.primary_t) + "](" + vid + ")", true)
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
                    trackEmbed.addField("NU WR", character + " " + name + "\n[" + tools.timefix(nu.runs[0].run.times.primary_t) + "](" +  vid+ ")",true)

                    client.channels.cache.get(interaction.channel_id).send(trackEmbed).then(sentMessage => {
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
        } else if(args[0].name=="times") {
            if(args[0].options[0].name == "par_times"){
                var input = args[0].options[0].options[0].value.toLowerCase()
                var numb = getTrack(input)
                if(numb == null){ 
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                content: "`Error: Track not found `\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                                //embeds: [racerEmbed]
                            }
                        }
                    })
                } else {
                    const tracktimesEmbed2 = new Discord.MessageEmbed()
                        .setColor(planets[tracks[numb].planet].color)
                        .setTitle(tracks[numb].name + " | Par Times")
                        .setFooter("/lookup")
                        .setURL("https://docs.google.com/spreadsheets/d/1TwDtG6eOyiQZEZ3iTbZaEmthe5zdf9YEGJ-1tfFfQKg/edit?usp=sharing")
                        .addField("FT 3-Lap", ":gem: " + tracks[numb].partimes[0] + "\n:first_place: " + tracks[numb].partimes[1] + "\n:second_place: " + tracks[numb].partimes[2] + "\n:third_place: " + tracks[numb].partimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].partimes[4], true)
                        .addField("FT 1-Lap", ":gem: " + tracks[numb].parlaptimes[0] + "\n:first_place: " + tracks[numb].parlaptimes[1] + "\n:second_place: " + tracks[numb].parlaptimes[2] + "\n:third_place: " + tracks[numb].parlaptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parlaptimes[4], true)
                    if (tracks[numb].hasOwnProperty("parskiptimes")) {
                        tracktimesEmbed2.addField("Skips 3-Lap", ":gem: " + tracks[numb].parskiptimes[0] + "\n:first_place: " + tracks[numb].parskiptimes[1] + "\n:second_place: " + tracks[numb].parskiptimes[2] + "\n:third_place: " + tracks[numb].parskiptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parskiptimes[4], true)
                    }
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 3,
                            data: {
                                //content: "",
                                embeds: [tracktimesEmbed2]
                            }
                        }
                    })
                }
                
            } else if(args[0].options[0].name == "goal_times"){

                    //0. get required values
                        var accel = 0.9
                        var topspeed = 650
                        var thrust = 1.32
                        var heatrate = 8
                        var coolrate = 10
                        var boost = 400
                        var framerate = 40.5
                        var tracklength = 65108.957
                        var laps = 3
                    //1. calculate avg speed given upgrades
                        boostdistance =(boost/50)*(50*(100/heatrate)-11*Math.log(Math.abs(50*(100/heatrate)+11)))-(boost/50)*(50*(0)-11*Math.log(Math.abs(50*(0)+11))) 
                        avgboost =boostdistance/(100/heatrate)
                        e19 =1-(3333/(100*framerate*((3333/(100*framerate))+5))) 
                        cooldistance =boost*Math.log(Math.abs(11*e19**(framerate*(100/heatrate))*heatrate+7500*e19**(framerate*(100/heatrate+100/coolrate))))/(Math.log(e19)*framerate)-boost*Math.log(Math.abs(11*e19**(framerate*(100/heatrate))*heatrate+7500*e19**(framerate*(100/heatrate))))/(Math.log(e19)*framerate)
                        avgcool =cooldistance/(100/coolrate)
                        avgspeed =((100/heatrate)*(topspeed+avgboost)+(100/coolrate)*(topspeed+avgcool))/(100/heatrate+100/coolrate)
                        console.log("Average Speed: " + avgspeed)
                    //2. calculate starting boost time and distance (MULTILAP) || calculate full boost time and distance (FLAP)
                        function integrate (f, start, end, step, topspeed, accel, boost, offset1, offset2) {
                            let total = 0
                            step = step || 0.01
                            for (let x = start; x < end; x += step) {
                                total += f(x + step / 2, topspeed, accel, boost, offset1, offset2) * step
                            }
                            return total
                        }
                        var b2 = (290*accel)/((topspeed-290)*1.5*thrust)
                        var c2 = 0.75*topspeed
                        var d2 = (c2*accel)/((topspeed-c2)*1.5*thrust)
                        var e2 = (d2+1)*1.5*thrust*topspeed/(accel+(d2+1)*1.5*thrust)
                        var f2 = (e2*accel)/((topspeed-e2)*4*thrust)
                        var a = (290*accel)/((topspeed-290)*4*thrust)
                        var b = b2-a
                        var c = -(d2+1)+b
                        var d = c+f2
                        var e = -c+(100/heatrate)
                        var totaltime = e
                        function startboost(x, topspeed, accel, boost, offset1, offset2){
                            let y = x*4*1.32*topspeed/(accel+x*4*1.32)
                            return y
                        }
                        function boostcharge(x, topspeed, accel, boost, offset1, offset2){
                            let y = (x+offset1)*1.5*1.32*topspeed/(accel+(x+offset1)*1.5*1.32)
                            return y
                        }
                        function firstboost(x, topspeed, accel, boost, offset1, offset2){
                            let y = ((x+offset1)*1.5*boost)/((x+offset1)*1.5+0.33)+((x+offset2)*4*1.32*topspeed)/(accel+(x+offset2)*4*1.32)
                            return y
                        }
                        var step = 0.0001
                        var totaldistance = integrate(startboost, 0, a, step, topspeed, accel, boost, null, null)
                        totaldistance = totaldistance + integrate(boostcharge, a, -c, step, topspeed, accel, boost, b, null)
                        totaldistance = totaldistance + integrate(firstboost, -c, e, step, topspeed, accel, boost, c, d)
                        console.log("Total distance: " + totaldistance + "\nTotal time: " + totaltime)

                    //3. calculate fast terrain section
                        //bite off fast terrain length in chunks starting with cooling and calculate complete heat cycle
                        var fastlength = 4565.069
                        var totalfastlength = 0
                        var totalfasttime = 0
                        var fastspeed = 200
                        var cooltime = 100/coolrate
                        var boosttime = 100/heatrate
                        while(fastlength>0){
                            if(fastlength/(topspeed+avgcool+fastspeed) > cooltime){ //if pod is on fast terrain longer than cool time
                                totalfastlength += ((topspeed+avgcool+fastspeed)*cooltime)
                                totalfasttime+=(cooltime)
                                fastlength -= (topspeed+avgcool+fastspeed)*cooltime
                                console.log("pod on fast terrain longer than cool time, fast length: " + fastlength)
                            } else if(fastlength/(topspeed+avgcool+fastspeed) <= cooltime){ //if pod is on fast terrain shorter than cool time
                                totalfastlength+=(fastlength)
                                totalfasttime+=(fastlength/(topspeed+avgcool+fastspeed))
                                //remaining cooling
                                totalfastlength+=((topspeed+avgcool)*(cooltime - fastlength/(topspeed+avgcool+fastspeed)))
                                totalfasttime+=(cooltime - fastlength/(topspeed+avgcool+fastspeed)) 
                                //next boost
                                totalfastlength+=((topspeed+avgboost)*boosttime)
                                totalfasttime+=(boosttime)
                                fastlength = 0
                                console.log("pod on fast terrain shorter than cool time, fast length: " + fastlength)
                            }
                            if(fastlength>0){
                                if(fastlength/(topspeed+avgboost+fastspeed) > boosttime){ //if pod is on fast terrain longer than boost time
                                    totalfastlength+=((topspeed+avgboost+fastspeed)*boosttime)
                                    totalfasttime+=(boosttime)
                                    fastlength -= (topspeed+avgboost+fastspeed)*boosttime
                                    console.log("pod on fast terrain longer than boost time, fast length: " + fastlength)
                                } else if(fastlength/(topspeed+avgboost+fastspeed) <= boosttime){ //if pod is on fast terrain shorter than boost time
                                    totalfastlength+=(fastlength)
                                    totalfasttime+=(fastlength/(topspeed+avgboost+fastspeed))
                                    //remaining boosting
                                    totalfastlength+=((topspeed+avgboost)*(boosttime - fastlength/(topspeed+avgboost+fastspeed)))
                                    totalfasttime +=(boosttime - fastlength/(topspeed+avgboost+fastspeed)) 
                                    fastlength = 0
                                    console.log("pod on fast terrain shorter than boost time, fast length: " + fastlength)
                                }
                            }
                        }
                        console.log("Total fast length: " + totalfastlength + "\nTotal fast time: " + totalfasttime)
 
                    //4. calculate slow terrain section
                        //bite off slow terrain length in chunks starting with boosting and calculate full heat cycle
                        //a pod can only afford one full boost + a small leftover boost that is worth 1 second of cooling
                        var slowlength = 0
                        var totalslowlength = 0
                        var totalslowtime = 0
                        var slowmod = 0.75
                    //boosting
                        if(slowlength/((topspeed+avgboost)*slowmod) > boosttime){ //if there is more slow terrain than the pod can boost through
                            totalslowlength+=((topspeed+avgboost)*slowmod)*boosttime
                            totalslowtime += boosttime
                            slowlength -= (topspeed+avgboost)*slowmod*boosttime
                        //short cool
                            if(slowlength/((topspeed+avgcool)*slowmod) > 1){ //if the remaining slow terrain would allow for another short boost
                                totalslowlength+=(topspeed+avgcool)*slowmod*1
                                totalslowtime += 1
                                slowlength -= (topspeed+avgcool)*slowmod*1
                            //short boost
                                if(slowlength/((topspeed+avgboost)*slowmod) > coolrate/heatrate){ //if the pod will still be on slow terrain after the short boost
                                    totalslowlength+=(topspeed+avgboost)*slowmod*(coolrate/heatrate)
                                    totalslowtime += coolrate/heatrate
                                    slowlength-=(topspeed+avgboost)*slowmod*(coolrate/heatrate)
                                //cooling
                                    if(slowlength/((topspeed+avgboost)*slowmod) > cooltime){ //if the remaining slow terrain is longer than the pod's cool time
                                    //underheating
                                        totalslowlength += slowlength
                                        totalslowtime += slowlength/((topspeed+avgcool)*slowmod)
                                        slowlength = 0
                                    } else {
                                        totalslowlength += slowlength
                                        totalslowtime += slowlength/((topspeed+avgcool)*slowmod)
                                    //remaining cooling on regular terrain
                                        totalslowlength += (topspeed+avgcool)*(cooltime - slowlength/((topspeed+avgcool)*slowmod))
                                        totalslowtime += cooltime - slowlength/((topspeed+avgcool)*slowmod)
                                        slowlength = 0
                                    }
                                } else {
                                    totalslowlength += slowlength
                                    totalslowtime += slowlength/((topspeed+avgboost)*slowmod)
                                //next cool
                                    totalslowlength += (topspeed+avgcool)*cooltime
                                    totalslowtime +=cooltime
                                    slowlength = 0
                                }
                            } else {
                            //remaining slow terrain
                                totalslowlength += slowlength
                                totalslowtime += slowlength/((topspeed+avgcool)*slowmod)
                            //remaining cooling on normal terrain
                                totalslowlength += (topspeed+avgcool)*(cooltime - slowlength/((topspeed+avgcool)*slowmod))
                                totalslowtime += cooltime - slowlength/((topspeed+avgcool)*slowmod)
                                slowlength = 0
                            }
                        } else { //if there is less slow terrain than a pod's full boost
                        //remaining boost on slow terrain
                            totalslowlength += slowlength;
                            totalslowtime += slowlength/((topspeed+avgboost)*slowmod)
                        //remaining boosting on non slow terrain
                            totalslowlength+=((topspeed+avgboost)*(boosttime - slowlength/((topspeed+avgboost)*slowmod)))
                            totalslowtime+=(boosttime - slowlength/((topspeed+avgboost)*slowmod)) 
                        //next cool
                            totalslowlength += (topspeed+avgcool)*cooltime
                            totalslowtime +=cooltime
                            slowlength = 0
                        }
                    //5. calculate the final time
                        var finaltime = totaltime+(tracklength-(totalfastlength + totalslowlength + totaldistance))/avgspeed+(totalfasttime+totalslowtime)*(laps-1)+((tracklength - (totalfastlength+totalslowlength))/avgspeed)*(laps-1)
                        console.log("Final Time: " + finaltime)
            }
        } else if(args[0].name=="tier") {
            const tierEmbed = new Discord.MessageEmbed()
            var mu = true
            if (args[0].hasOwnProperty("options")){
                if (args[0].options[0].value == "nu") {
                    mu = false
                }
            }
            if(mu) {
                tierEmbed
                    .setTitle("MU Racer Tier List")
                    .setFooter("/lookup")
                    .addField(":gem: Top", "Ben Quadinaros\nBoles Roor\nMars Guo\nAldar Beedo\nElan Mak\nMawhonic\n'Bullseye' Navior")
                    .addField(":first_place: High", "Clegg Holdfast\nNeva Kee\nRatts Tyerell\nToy Dampner\nArk 'Bumpy' Roose\nBozzie Baranta\nFud Sang")
                    .addField(":second_place: Mid", "Dud Bolt\nOdy Mandrell\nGasgano\nWan Sandage\nAnakin Skywalker")
                    .addField(":third_place: Low", "Slide Paramita\nSebulba\nEbe Endocott\nTeemto Pagalies")
            } else {
                tierEmbed
                    .setTitle("NU Racer Tier List")
                    .setFooter("/lookup")
                    .addField(":gem: Top", "Boles Roor\nBen Quadinaros\nSebulba")
                    .addField(":first_place: High", "Aldar Beedo\n'Bullseye' Navior\nMars Guo\nRatts Tyerell\nMawhonic")
                    .addField(":second_place: Mid", "Toy Dampner\nClegg Holdfast\nEbe Endocott\nFud Sang\nAnakin Skywalker\nSlide Paramita\nArk 'Bumpy' Roose")
                    .addField(":third_place: Low", "Neva Kee\nDud Bolt\nElan Mak\nBozzie Baranta\nOdy Mandrell\nGasgano\nTeemto Pagalies\nWan Sandage")
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
                        //content: """,
                        embeds: [tierEmbed]
                    }
                }
            })
        } else if(args[0].name=="prices") {
            var total = 0
            const priceEmbed = new Discord.MessageEmbed()
                .setTitle("Part Price Lookup")
                .setFooter("/lookup")
            if(args[0].hasOwnProperty("options")){
                for(let i=0; i<args[0].options.length; i++){
                    var level = Number(args[0].options[i].value)
                    if(args[0].options[i].name == "traction"){
                        priceEmbed.addField("Traction Upgrade " + (level + 1) + ": " + parts[0].names[level].antiskid, parts[0].prices[level].antiskid + " Truguts", false)
                        total = total + parts[0].prices[level].antiskid
                    } else if(args[0].options[i].name == "turning"){
                        priceEmbed.addField("Turning Upgrade " + (level + 1) + ": " + parts[0].names[level].turn_response, parts[0].prices[level].turn_response + " Truguts", false)
                        total = total + parts[0].prices[level].turn_response
                    } else if(args[0].options[i].name == "accel."){
                        priceEmbed.addField("Acceleration Upgrade " + (level + 1) + ": " + parts[0].names[level].acceleration, parts[0].prices[level].acceleration + " Truguts", false)
                        total = total + parts[0].prices[level].acceleration
                    } else if(args[0].options[i].name == "top_speed"){
                        priceEmbed.addField("Top Speed Upgrade " + (level + 1) + ": " + parts[0].names[level].max_speed, parts[0].prices[level].max_speed + " Truguts", false)
                        total = total + parts[0].prices[level].max_speed
                    } else if(args[0].options[i].name == "air_brake"){
                        priceEmbed.addField("Air Brake Upgrade " + (level + 1) + ": " + parts[0].names[level].air_brake_interval, parts[0].prices[level].air_brake_interval + " Truguts", false)
                        total = total + parts[0].prices[level].air_brake_interval
                    } else if(args[0].options[i].name == "cooling"){
                        priceEmbed.addField("Cooling Upgrade " + (level + 1) + ": " + parts[0].names[level].cool_rate, parts[0].prices[level].cool_rate + " Truguts", false)
                        total = total + parts[0].prices[level].cool_rate
                    } else if(args[0].options[i].name == "repair"){
                        priceEmbed.addField("Repair Upgrade " + (level + 1) + ": " + parts[0].names[level].repair_rate, parts[0].prices[level].repair_rate + " Truguts", false)
                        total = total + parts[0].prices[level].repair_rate
                    }
                }
                if(args[0].options.length>0){
                    priceEmbed.addField("Total Cost", total + " Truguts", false)
                }
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 3,
                        data: {
                            //content: """,
                            embeds: [priceEmbed]
                        }
                    }
                })
            }
        } else if(args[0].name=="cheats") {
            const cheatEmbed = new Discord.MessageEmbed()
            if(args[0].options[0].value == "PC"){
                cheatEmbed
                    .setTitle("PC Cheats")
                    .setFooter("/lookup")
                    .addField("1000 Truguts", "Press Left Shift + F4 + 4 at Watto's Shop; repeatable up to 5 times", false)
                    .addField("Cy Yunga","Press Left Control + C + Y on the racer select screen", false)
                    .addField("Jinn Reeso","Press Right Control + N + K on the racer select screen", false) 
                    .addField("Hangar Taunts","Press Spacebar (slide) to select 'START RACE'", false)
                    .addField("Unlock All Pods & Tracks","Press Scroll Lock + Home Key on the racer select screen", false)
                    .addField("Fast Mode","Press '*' on the Numpad + T in race", false)
                    .addField("Toggle Mirror Mode","Press Left/Right Control + Left Alt + Right Alt on record screen", false)
                    .addField("Debug Menu","[Cheat Engine Trainer by Tehelee for accessing the in-game cheats menu](https://www.reddit.com/r/gog/comments/90lrg1/star_wars_episode_1_racer_return_of_the_debug/)", false)
            } else {
                cheatEmbed  
                    .setTitle("Console Cheats")
                    .setFooter("/lookup")
                    .setDescription("To enter cheats, go to the new profile page and hold RT/R2/ZR and enter the codes below using L1/Bumper/L. Once entered, select end and a confirmation should appear.")
                    .addField("Unlock All Cheat Codes","RRTANGENTABACUS",false)
                    .addField("Unlock Mirror Mode","RRTHEBEAST",false)
                    .addField("Invincibility","RRJABBA",false)
                    .addField("Dual Control Mode","RRDUAL",false)
                    .addField("Unlock Cy Yunga","RRCYYUN",false)
                    .addField("Unlock Jinn Reeso","RRJINNRE",false)
                    .addField("6 Pit Droids","RRPITDROID and press UP, DOWN, LEFT, RIGHT, RIGHT, UP at Watto's shop",false)
                    .addField("Auto Pilot","Press R + Z to enable/disable auto pilot",false)
                    .addField("Hangar Taunts","Hold down Z when selecting the start game option in Tournament mode",false)
                    .addField("See Creators","During the opening cinematic, hold down all the C buttons and press start",false)
                    .addField("Cheats Menu","RRDEBUG\nInput UP, LEFT, DOWN, RIGHT, UP, LEFT, DOWN, RIGHT on the pause menu",false)
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
                        //content: "",
                        embeds: [cheatEmbed]
                    }
                }
            })
        }    
    }
    
}
