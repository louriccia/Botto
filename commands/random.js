module.exports = {
    name: 'random',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const fetch = require('node-fetch');
        var tools = require('./../tools.js');
        const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
        const Channel = client.channels.cache.get(interaction.channel_id);
        if(Channel == !undefined){
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
                    } else if(canon == racers[i].canon) {
                        pool.push(i)
                    }
                } else if(tier == racers[i].mu_tier) {
                    if(canon ==="" || canon === "any") { //any
                        pool.push(i)
                    } else if(canon == racers[i].canon) {
                        pool.push(i)
                    } 
                } 
            }
            var poolsave = [...pool]
            if(pool.length == 0){
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: No racers meet that criteria`\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                        }
                    }
                })
            }
            if (vc) {
                if (!Member.voice.channel) {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                content: "`Error: To roll a random racer for everyone in the voice channel, you need to be in a voice channel.`\n" +errorMessage[Math.floor(Math.random()*errorMessage.length)],
                            }
                        }
                    })
                } else {
                    var podlist = "";
                    var desc = "Rolled random "
                    for(let i=0; i<memarray.length; i++) {
                        if(pool.length == 0){
                            pool = [...poolsave]
                        }
                        var randompod = Math.floor(Math.random()*pool.length)
                        podlist = podlist + racers[pool[randompod]].flag + " " + racers[pool[randompod]].name + "\n"
                        pool.splice(randompod, 1)
                    }
                    if (canon) {
                        desc = desc + "canonical "
                    } else if(canon===false) {
                        desc = desc + "non-canonical "
                    }
                    if(tier !== "" && tier !== "any") {
                        desc = desc + Tiernames[tier].toLowerCase() + " tier pods"
                    } else {
                        desc = desc + " pods"
                    }
                    const racerEmbed = new Discord.MessageEmbed()
                        .setTitle("Random Racers")
                        .setDescription(desc)
                        .addField("Players", memlist, true)
                        .addField("Pods", podlist, true)
                        .addField('\u200B', '\u200B', true)
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                //content: "",
                                embeds: [racerEmbed]
                            }
                        }
                    })
                }
            } else {
                var randomracer = pool[Math.floor(Math.random()*pool.length)]
                var racerEmbed = tools.getRacerEmbed(randomracer) 
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            //content: "",
                            embeds: [racerEmbed],
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            label: "Randomize",
                                            emoji: {
                                                id: null,
                                                name: "🎲"
                                            },
                                            style: 4,
                                            custom_id: "random_racer"
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                })
            }
        } else if(args[0].name=="track") {
            var circuit = ""
            var planet = ""
            var length = ""
            var difficulty = ""
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
                    } else if (args[0].options[i].name == "length") {
                        length = args[0].options[i].value
                    } else if (args[0].options[i].name == "difficulty") {
                        for(let j=0; j<difficulties.length; j++) {
                            if(args[0].options[i].value == difficulties[j].name) {
                                difficulty = j
                            }
                        }
                    } 
                }
            }
            console.log(circuit, planet)
            var pool = []
            for(var i=0; i<tracks.length; i++) {
                pool.push(i)
            }
            if(circuit !== "" && circuit !== "any")  {
                for(var i=0; i<pool.length; i++) {
                    if(tracks[pool[i]].circuit !== circuit){
                        if(pool.indexOf(pool[i])>-1){
                            pool.splice(pool.indexOf(pool[i]), 1)
                            i=i-1 //note to self: don't be an idiot and forget stuff like this
                        }
                    }
                }
            }
            if(planet !== "" && planet !== "any")  {
                for(var i=0; i<pool.length; i++) {
                    if(tracks[pool[i]].planet !== planet){
                        if(pool.indexOf(pool[i])>-1){
                            pool.splice(pool.indexOf(pool[i]), 1)
                            i=i-1
                        }
                    }
                }
            }
            if(length !== "" && length !== "any")  {
                for(var i=0; i<pool.length; i++) {
                    if(tracks[pool[i]].lengthclass.replace("Extra ", "").toLowerCase() !== length){
                        if(pool.indexOf(pool[i])>-1){
                            pool.splice(pool.indexOf(pool[i]), 1)
                            i=i-1
                        }
                    }
                }
            }
            if(difficulty !== "" && difficulty !== "any")  {
                for(var i=0; i<pool.length; i++) {
                    if(tracks[pool[i]].difficulty !== difficulty){
                        if(pool.indexOf(pool[i])>-1){
                            pool.splice(pool.indexOf(pool[i]), 1)
                            i=i-1
                        }
                    }
                }
            }
            if(pool.length == 0){
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: No tracks meet that criteria`\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                        }
                    }
                })
            }
            var numb = pool[Math.floor(Math.random()*pool.length)]
            var trackEmbed = tools.getTrackEmbed(numb, client, interaction.channel_id, interaction)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        //content: "",
                        embeds: [trackEmbed],
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Randomize",
                                        emoji: {
                                            id: null,
                                            name: "🎲"
                                        },
                                        style: 4,
                                        custom_id: "random_track"
                                    }
                                ]
                            }
                        ]
                    }
                }
            })
            
        } else if(args[0].name=="challenge") {
            client.buttons.get("challenge").execute(client, interaction, ["random", "menu", "new"])
        } else if(args[0].name=="teams") {
            var teamnum = args[0].options[0].value
            const teamEmbed = new Discord.MessageEmbed()
                .setTitle("Random Teams")
                .setDescription("Everyone in the voice channel has been split into **" + teamnum + "** teams")
                
            var playernum = memarray.length
            if (teamnum > playernum){
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: That's too many teams!`\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                            //embeds: [teamEmbed]
                        }
                    }
                })
            } else {
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
                        type: 4,
                        data: {
                            //content: "",
                            embeds: [teamEmbed]
                        }
                    }
                })
            }
        } else if(args[0].name=="number") {
            if (messageLow.startsWith(`${prefix}random`)) {
            
                var randomnum = (Math.floor(Math.random()*args[0].options[0].value) + 1)
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
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
