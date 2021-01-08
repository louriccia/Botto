module.exports = {
    name: 'random',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const fetch = require('node-fetch');
        var tools = require('./../tools.js');
        const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
        const Member = Guild.members.cache.get(interaction.member.user.id); // Getting the member.
        if (Member.voice.channel) {
            var mems = client.channels.cache.get(Member.voice.channelID).members;
            var memarray = [];
            var memlist = ""
            for (let [snowflake, guildMember] of mems){
                if(guildMember.displayName !== "Botto"){
                    memarray.push(guildMember.displayName)
                    memlist = memlist + guildMember.displayName + "\n"
                }
            }
        }
        if(args[0].name =="racer") {
            var tier = ""
            var canon = ""
            var vc = false
            var Tiernames = ["Top", "High", "Mid", "Low"]
            if (args[0].hasOwnProperty("options")) {
                for (let i = 0; i<args[0].options.length; i++) {
                    if (args[0].options[i].name == "tier") { //any/top/high/mid/low
                        tier = args[0].options[i].value
                    } else if (args[0].options[i].name == "canon") {
                        if(args[0].options[i].value == "canon") {
                            canon = true
                        } else if (args[0].options[i].value == "non-canon"){
                            canon = false
                        }
                    } else if (args[0].options[i].name == "vc") {
                        vc = args[0].options[i].value
                    }
                }
            }
            console.log(canon, tier)
            var pool = []
            for (let i = 0; i<racers.length; i++) {
                if (tier === "" || tier === "any"){
                    if(canon ==="" || canon === "any") { //any
                        pool.push(i)
                        console.log(i + " pushed for being any tier any canon")
                    } else if(canon == racers[i].canon) {
                        pool.push(i)
                        console.log(i + " pushed for being any tier/ specified canon")
                    }
                } else if(tier == racers[i].mu_tier) {
                    if(canon ==="" || canon === "any") { //any
                        pool.push(i)
                        console.log(i + " pushed for being specified tier any canon")
                    } else if(canon == racers[i].canon) {
                        pool.push(i)
                        console.log(i+ " pushed for being specified tier specified canon")
                    } 
                } 
            }
            var poolsave = [...pool]
            if (vc) {
                if (!Member.voice.channel) {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 3,
                            data: {
                                content: "To roll a random racer for everyone in the voice channel, you need to be in a voice channel.",
                                //embeds: [racerEmbed]
                            }
                        }
                    })
                } else {
                    var podlist = "";
                    var desc = "Rolled "
                    for(let i=0; i<memarray; i++) {
                        if(pool.length == 0){
                            pool = [...poolsave]
                        }
                        var randompod = Math.floor(Math.random()*pool.length)
                        podlist = podlist + racers[pool[randompod]].flag + " " + racers[pool[randompod]].name + "\n"
                        pool.splice(randompod, 1)
                    }
                    if (canon) {
                        desc = desc + "canonical "
                    } else if(!canon) {
                        desc = desc + "non-canonical "
                    }
                    if(tier !== "" && tier !== "any") {
                        desc = desc + Tiernames[tier].toLowerCase() + " tier pods"
                    } else {
                        desc = desc + "random pods"
                    }
                    const racerEmbed = new Discord.MessageEmbed()
                        .setFooter("/random")
                        .setTitle("Random Racers")
                        .setDescription(desc)
                        .addField("Players", memlist, true)
                        .addField("Pods", podlist, true)
                        .addField('\u200B', '\u200B', true)
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 3,
                            data: {
                                //content: "",
                                embeds: [racerEmbed]
                            }
                        }
                    })
                }
            } else {
                var randomracer = pool[Math.floor(Math.random()*pool.length)]
                const racerEmbed = new Discord.MessageEmbed()
                    .setFooter("/random")
                    .setThumbnail(racers[randomracer].img)
                    .setColor('#00DE45')
                    .setTitle(racers[randomracer].name)
                    .setDescription("(" + (randomracer + 1) + ") " + racers[randomracer].intro)
                    .addField("Tier", Tiernames[racers[randomracer].mu_tier], true)
                    if (racers[randomracer].hasOwnProperty("species")){
                        racerEmbed.addField("Species/Homeworld", racers[randomracer].species, true)
                    }
                    racerEmbed.addField("Pod", racers[randomracer].Pod, true)
                    racerEmbed.setImage(racers[randomracer].stats)
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 3,
                        data: {
                            //content: "",
                            embeds: [racerEmbed]
                        }
                    }
                })
            }
        } else if(args[0].name=="track") {
            var circuit = ""
            var planet = ""
            if (args[0].hasOwnProperty("options")) {
                for (let i = 0; i<args[0].options.length; i++) {
                    if (args[0].options[i].name == "circuit") {
                        for(let j=0; j<circuits.length; j++) {
                            if(args[0].options[i].value == circuits[j].name) {
                                circuit = j
                            }
                        }
                    } else if (args[0].options[i].name == "planet") {
                        for(let j=0; j<planets.length; j++) {
                            if(args[0].options[i].value == planets[j].name) {
                                planet = j
                            }
                        }
                    }
                }
            }
            console.log(circuit, planet)
            var pool = []
            for(let i=0; i<tracks.length; i++) {
                pool.push(i)
            }
            if(circuit !== "")  {
                for(let i=0; i<pool.length; i++) {
                    if(tracks[pool[i]].circuit !== circuit){
                        if(pool.indexOf(i)>-1){
                            pool.splice(pool.indexOf(i), 1)
                            console.log(i + " was removed for being the wrong circuit")
                            i = i-1
                            
                        }
                    }
                }
            }
            if(planet !== "")  {
                for(let i=0; i<pool.length; i++) {
                    if(tracks[pool[i]].planet !== planet){
                        if(pool.indexOf(i)>-1){
                            pool.splice(pool.indexOf(i), 1)
                            console.log(i + " was removed for being the wrong planet")
                            i = i-1
                        }
                    }
                }
            }
            if(pool.length == 0){
                return
            }
            var numb = Math.floor(Math.random()*pool.length)
            const trackEmbed = new Discord.MessageEmbed()
                .setThumbnail(planets[tracks[numb].planet].img)
                .setColor(planets[tracks[numb].planet].color)
                .setImage(tracks[numb].img)
                .setTitle(tracks[numb].name)
                .setFooter("/random")
            trackEmbed.addField("Planet", planets[tracks[numb].planet].name, true)
            trackEmbed.addField("Circuit", circuits[tracks[numb].circuit].name + " - Race " + tracks[numb].cirnum, true)
            trackEmbed.addField("Favorite", tracks[numb].favorite, true)
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
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 2,
                    data: {
                        //content: "",
                        //embeds: [myEmbed]
                    }
                }
            })
        } else if(args[0].name=="challenge") {
            client.commands.get("challenge").execute(client, interaction, args);
        } else if(args[0].name=="teams") {
            var teamnum = args[0].options[0].value
            const teamEmbed = new Discord.MessageEmbed()
                .setAuthor("/teams")
                .setTitle("Random Teams")
                .setDescription("Everyone in the voice channel has been split into **" + teamnum + "** teams")
                
            var playernum = memarray.length
            var remainder = playernum%teamnum
            var members = ""
            for(let i = 0; i<teamnum; i++){
                members = ""
                for(let j = 0; j<(Math.floor(playernum/teamnum)); j++){
                    var random = Math.floor(Math.random()*memarray.length)
                    members = members + memarray[random] + "\n"
                    memarray.splice(random,1)
                    if(remainder > 0){
                        var random = Math.floor(Math.random()*memarray.length)
                        members = members + memarray[random] + "\n"
                        memarray.splice(random,1)
                        remainder = remainder - 1
                    }

                }
                teamEmbed.addField("Team " + (i + 1), members, true)
            }
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
                        //content: "",
                        embeds: [teamEmbed]
                    }
                }
            })
        } else if(args[0].name=="number") {
            if (messageLow.startsWith(`${prefix}random`)) {
            
                var randomnum = (Math.floor(Math.random()*args[0].options[0].value) + 1)
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 3,
                        data: {
                            content: randomnum,
                            //embeds: [myEmbed]
                        }
                    }
                })
                
            }
            
        }
    }
    
}
