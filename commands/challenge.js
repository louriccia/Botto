const { filter } = require('../tourneydata.js');

module.exports = {
    name: 'challenge',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        var firebase = require("firebase/app");
        require('firebase/auth');
        require('firebase/database');
        var database = firebase.database();
        var ref = database.ref('times');
        ref.on("value", function(snapshot) {
            challengedata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        //const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="generate") {
            let member = interaction.member.user.id
            var vc = false
            var challengestart = Date.now()
            var random1 = Math.floor(Math.random()*23)
            var random2 = Math.floor(Math.random()*25)
            var random3 = Math.floor(Math.random()*movieQuotes.length)
            var laps = 3, lap = [1,2,4,5]
            var laptext = "", mirrortext = "", nutext = "", skipstext = "", flag = "", record = ""
            var mirror = false, nu = false, skips = false
            if (racers[random1].hasOwnProperty("flag")) {
                flag = racers[random1].flag
            }
        //calculate odds
            const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
            const Member = Guild.members.cache.get(member); // Getting the member.
            if (!Member.voice.channel) {
                if (oddsdata !==null) {
                    var keys = Object.keys(oddsdata)
                    for (var i=0; i<keys.length; i++) {
                        var k = keys[i];
                        if(oddsdata[k].name == member){
                            record = k
                            i = keys.length
                        }
                    }
                }
                if (record !== "") {
                    odds_skips = oddsdata[k].skips/100
                    odds_noupgrades = oddsdata[k].no_upgrades/100
                    odds_non3lap = oddsdata[k].non_3_lap/100
                    odds_mirrormode = oddsdata[k].mirror_mode/100
                } else {
                    odds_skips = 0.25
                    odds_noupgrades = 0.15
                    odds_non3lap = 0.05
                    odds_mirrormode = 0.05
                }
                if (Math.random()<odds_noupgrades){
                    nutext = " with **NO UPGRADES**"
                    nu = true
                }
                if (Math.random()<odds_mirrormode){
                    mirrortext = ", **MIRRORED!** "
                    mirror = true
                }
                if (Math.random()<odds_non3lap){
                    laps = lap[Math.floor(Math.random()*4)]
                    laptext = " for **" + laps + " lap(s)**"
                }
                if (tracks[random2].hasOwnProperty("parskiptimes")) {
                    if (Math.random()<odds_skips) {
                        skipstext = ", with **SKIPS**"
                        skips = true
                    }
                }
            } else {
                vc = true
            }
        //get best runs
            var keys = Object.keys(challengedata), best = []
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(challengedata[k].track == random2 && challengedata[k].racer == random1 && challengedata[k].laps == laps && challengedata[k].mirror == mirror && challengedata[k].nu == nu && challengedata[k].skips == skips){
                    best.push(challengedata[k])
                }
            }
            var besttimes = "Be the first to submit a time for this challenge!"
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            if(best.length > 0) {
                besttimes =""
                best.sort((a,b) => (a.time > b.time) ? 1 : -1)
                for (var i=0; i<best.length; i++){
                    besttimes = besttimes + pos[i] + "" + tools.timefix(best[i].time) + " - " + best[i].name + "\n"
                    if (i == 4) {
                        i = best.length
                    }
                }
            }
        //tally likes and dislikes
            var like = 0, dislike = 0, keys = Object.keys(feedbackdata)
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(feedbackdata[k].track == random2 && feedbackdata[k].racer == random1 && feedbackdata[k].laps == laps && feedbackdata[k].mirror == mirror && feedbackdata[k].nu == nu && feedbackdata[k].skips == skips){
                    if (feedbackdata[k].track == "👍") {
                        like = like +1
                    } else if (feedbackdata[k].track == "👎") {
                        dislike = dislike +1
                    }
                }
            }
        //calculate goal time
            var speed = 1, speedmod = tracks[random2].avgspeedmod, length = tracks[random2].length
            length = length * laps
            if (nu) {
                speed = racers[random1].avgspeed_nu
            } else {
                speed = racers[random1].avgspeed_mu
            }
            var goal = length/(speed*speedmod)
        //build description
            var desc = ""
            if (like > 0) {
                desc = desc + "  👍 " + like
            }
            if (dislike > 0) {
                desc = desc + "  👎 " + dislike
            }
            if(Math.random()<0.50 && best.length> 0) {
                desc = desc +"*The current record-holder for this challenge is... " + best[0].name + "!*"
            } else if (Math.random() < 0.50) {
                var str = playerPicks[Math.floor(Math.random()*playerPicks.length)]
                desc = desc + str.replace("replaceme", interaction.member.user.username)
            } else {
                desc = desc + movieQuotes[random3]
            }
        //build embed
            const challengeEmbed = new Discord.MessageEmbed()
                .setTitle("Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext)
                .setColor(planets[tracks[random2].planet].color)
                .setDescription(desc)
            if(vc) {
                challengeEmbed.setAuthor("Multiplayer Challenge")
            } else {
                challengeEmbed.setAuthor(interaction.member.user.username + "'s Challenge", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
            }
            if(!skips) {
                challengeEmbed.addField("Goal Times", ":gem: " + tools.timefix(goal*multipliers[0].ft_multiplier) + "\n:first_place: " + tools.timefix(goal*multipliers[1].ft_multiplier) + "\n:second_place: " + tools.timefix(goal*multipliers[2].ft_multiplier) + "\n:third_place: " + tools.timefix(goal*multipliers[3].ft_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(goal*multipliers[4].ft_multiplier), true)
            } else {
                challengeEmbed.addField("Goal Times", ":gem: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[0])*multipliers[0].skips_multiplier) + "\n:first_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[1])*multipliers[1].skips_multiplier) + "\n:second_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[2])*multipliers[2].skips_multiplier) + "\n:third_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[3])*multipliers[3].skips_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[4])*multipliers[4].skips_multiplier), true)
            }
            if(besttimes !== "") {
                challengeEmbed.addField("Best Times", besttimes, true)
            }
        //send embed  
                
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 2,
                    data: {
                        //content: "",
                        //embeds: [challengeEmbed]
                    }
                }
            })
            
            client.channels.cache.get(interaction.channel_id).send(challengeEmbed).then(sentMessage => {
            //collect feedback
                sentMessage.react('👍').then(()=> {
                    sentMessage.react('👎');
                })
                var feedback = ""
                sentMessage.awaitReactions((reaction, user) => (reaction.emoji.name == '👍' || reaction.emoji.name == '👎'),
                    {time: 900000 }).then(collected => {
                        if (collected.first().emoji.name == '👍') {
                            feedback = '👍'
                        } else if (collected.first().emoji.name == '👎') {
                            feedback = '👎'
                        }
                        var feedbackdata = {
                            user: user.id,
                            name: user.username,
                            feedback: feedback,
                            date: message.createdTimestamp,
                            racer: random1,
                            track: random2,
                            laps: laps,
                            nu: nu,
                            skips: skips,
                            mirror: mirror
                        }
                        feedbackref.push(feedbackdata);
                    }).catch(() => {
                })
            //collect times
                
                const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m,{ time: 900000 });
                var collected = false
                collector.on('collect', message => {
                    if (message.embeds[0].title.startsWith("Race") && message.author.id == "545798436105224203") {
                        
                        if (vc && !collected) {
                            collected = true
                            sentMessage.delete()
                        } else if (collected == false && message.embeds[0].author.name.replace("'s Challenge", "") == interaction.member.user.username) {
                            collected = true
                            sentMessage.delete()
                        }
                    } else if (!isNaN(message.content.replace(":", "")) && tools.timetoSeconds(message.content) !== null) {
                        //need to branch here based on mp challenge or singular challenge
                        var challengeend = Date.now()
                        var time = ""
                        if (vc){
                            time = tools.timetoSeconds(message.content)
                        } else if (collected == false && member == message.author.id) {
                            time = tools.timetoSeconds(message.content)
                        }
                        tools.timetoSeconds(message.content)
                        if(time !== ""){
                            if ((challengeend - challengestart) < time*1000) {
                                message.reply("*I warn you. No funny business.*")
                                collected = true
                            } else {
                            //log time
                                var submissiondata = {
                                    user: message.author.id,
                                    name: message.author.username,
                                    time: time,
                                    date: message.createdTimestamp,
                                    racer: random1,
                                    track: random2,
                                    laps: laps,
                                    nu: nu,
                                    skips: skips,
                                    mirror: mirror
                                }
                                ref.push(submissiondata);
                                best.push(submissiondata)
                                collected = true
                            //build congratulations message
                                var parbeat = 5
                                var rank = [":gem: Elite", ":first_place: Pro", ":second_place: Rookie", ":third_place: Amateur", "<:bumpythumb:703107780860575875> Youngling"]
                                for (var i=0; i<5; i++) {
                                    if (skips) {
                                        if (time < tools.timetoSeconds(tracks[random2].parskiptimes[i])*multipliers[i].skips_multiplier) {
                                            parbeat = i
                                            i = 5
                                        }
                                    } else {
                                        if (time < goal*multipliers[i].ft_multiplier) {
                                            parbeat = i
                                            i = 5
                                        }
                                    }
                                }
                                var congrats = ""
                                if (parbeat < 5 && time < best[0].time) {
                                    congrats = "<a:newrecord:672640831882133524> You beat the best challenge time and the " + rank[parbeat] + " time for this track! <a:newrecord:672640831882133524>"
                                } else if (time < best[0].time) {
                                    congrats = "<a:newrecord:672640831882133524> You beat the best challenge time for this track! <a:newrecord:672640831882133524>"
                                } else if (parbeat < 5) {
                                    congrats = "You beat the " + rank[parbeat] + " time for this track!"
                                }
                            //edit original message
                                besttimes = ""
                                best.sort((a,b) => (a.time > b.time) ? 1 : -1)
                                for (var i=0; i<best.length; i++){
                                    besttimes = besttimes + pos[i] + "" + tools.timefix(best[i].time) + " - " + best[i].name + "\n"
                                    if (i == 4) {
                                        i = best.length
                                    }
                                }
                                const editEmbed = new Discord.MessageEmbed()
                                    .setTitle(":white_check_mark: Completed: Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext)
                                    .setColor(planets[tracks[random2].planet].color)
                                    .setDescription(desc)
                                if(vc) {
                                    editEmbed.setAuthor("Multiplayer Challenge")
                                } else {
                                    editEmbed.setAuthor(interaction.member.user.username + "'s Challenge", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                                }
                                if(!skips) {
                                    editEmbed.addField("Goal Times", ":gem: " + tools.timefix(goal*multipliers[0].ft_multiplier) + "\n:first_place: " + tools.timefix(goal*multipliers[1].ft_multiplier) + "\n:second_place: " + tools.timefix(goal*multipliers[2].ft_multiplier) + "\n:third_place: " + tools.timefix(goal*multipliers[3].ft_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(goal*multipliers[4].ft_multiplier), true)
                                } else {
                                    editEmbed.addField("Goal Times", ":gem: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[0])*multipliers[0].skips_multiplier) + "\n:first_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[1])*multipliers[1].skips_multiplier) + "\n:second_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[2])*multipliers[2].skips_multiplier) + "\n:third_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[3])*multipliers[3].skips_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[4])*multipliers[4].skips_multiplier), true)
                                }
                                if(besttimes !== "") {
                                    editEmbed.addField("Best Times", besttimes, true)
                                }
                                sentMessage.edit(editEmbed)
                                //sentMessage.edit(":white_check_mark: Challenge completed! The submitted time was: **" + tools.timefix(time) + "**\n" + congrats)
                            //maybe find a way to undo a submission
                            //delete message
                                if (message.guild) {
                                    message.delete()
                                }
                            }
                        }
                    }   
                })
            })
        } else if(args[0].name=="odds") {
        /*
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
        */
        } else if(args[0].name=="stats") {
                    /*
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
        */
        } else if(args[0].name=="about") {
            const challengeHelpEmbed = new Discord.MessageEmbed()
                .setTitle("Random Challenges")
                .setDescription("When you type `/challenge generate` or `/random challenge`, Botto will challenge you to race a random pod on a random track with random conditions. The default conditions are max upgrades, 3-lap, full track. You have 15 minutes to submit a time for the challenge. Botto will only accept one time from the person who triggered the challenge. \n\nYou can customize your odds by typing `/challenge odds`")
                .addField("Default Odds", "Skips - 25%\nNo upgrades - 15%\nNon 3-lap - 5%\nMirror mode - 5%", true)
                .addField("Rating a Challenge",":thumbsup: = I like this challenge, I would play it again\n:thumbsdown: = I don't like this challenge, this combination is not fun", true)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
                        content: "",
                        embeds: [challengeHelpEmbed]
                    }
                }
            })
        }
        /*
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
        */
    }
    
}