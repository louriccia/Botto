module.exports = {
    name: 'challenge',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        var tools = require('./../tools.js');
        //const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="generate") {
            let member = interaction.member.user.id
            var vc = ""
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
                vc = "MP Challenge: "
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
                    besttimes = besttimes + pos[i] + "" + timefix(best[i].time) + " - " + best[i].name + "\n"
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
                desc = desc + str.replace("replaceme", message.author.username)
            } else {
                desc = desc + movieQuotes[random3]
            }
        //build embed
            const challengeEmbed = new Discord.MessageEmbed()
                .setTitle(vc+"Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext)
                .setColor(planets[tracks[random2].planet].color)
                .setDescription(desc)
            if(!skips) {
                challengeEmbed.addField("Goal Times", ":gem: " + tools.timefix(goal*multipliers[0].ft_multiplier) + "\n:first_place: " + tools.timefix(goal*multipliers[1].ft_multiplier) + "\n:second_place: " + tools.timefix(goal*multipliers[2].ft_multiplier) + "\n:third_place: " + tools.timefix(goal*multipliers[3].ft_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(goal*multipliers[4].ft_multiplier), true)
            } else {
                challengeEmbed.addField("Goal Times", ":gem: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[0])*multipliers[0].skips_multiplier) + "\n:first_place: " + tools.timefix(timetoSeconds(tracks[random2].parskiptimes[1])*multipliers[1].skips_multiplier) + "\n:second_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[2])*multipliers[2].skips_multiplier) + "\n:third_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[3])*multipliers[3].skips_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[4])*multipliers[4].skips_multiplier), true)
            }
            if(besttimes !== "") {
                challengeEmbed.addField("Best Times", besttimes, true)
            }
        //send embed
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        content: "challenge",
                        embeds: [challengeEmbed]
                    }
                }
            })
            client.guilds.channels.cache.get(interaction.channel_id).send(challengeEmbed).then(sentMessage => {
                sentMessage.react('👍').then(()=> {
                    sentMessage.react('👎');
                })
                var feedback = ""
                sentMessage.awaitReactions((reaction, user) => (reaction.emoji.name == '👍' || reaction.emoji.name == '👎'),
                    { max: 1, time: 900000 }).then(collected => {
                        if (collected.first().emoji.name == '👍') {
                            feedback = '👍'
                        } else if (collected.first().emoji.name == '👎') {
                            feedback = '👎'
                        }
                        var data = {
                            user: message.author.id,
                            name: message.author.username,
                            feedback: feedback,
                            date: message.createdTimestamp,
                            racer: random1,
                            track: random2,
                            laps: laps,
                            nu: nu,
                            skips: skips,
                            mirror: mirror
                        }
                        feedbackref.push(data);
                    }).catch(() => {
                })
                const collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 900000 });
                var collected = false
                collector.on('collect', message => {
                //need a way to cancel a challenge if another one is called
                    if (message.content == "!challenge" && collected == false && member == message.author.id) {
                        collected = true
                        sentMessage.delete()
                    } else if (collected == false && member == message.author.id && !isNaN(message.content.replace(":", "")) && tools.timetoSeconds(message.content) !== null) {
                        var challengeend = Date.now()
                        var time = tools.timetoSeconds(message.content)
                        if ((challengeend - challengestart) < time*1000) {
                            message.reply("*I warn you. No funny business.*")
                            collected = true
                        } else {
                        //log time
                            var data = {
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
                            ref.push(data);
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
                            sentMessage.edit(":white_check_mark: Challenge completed! The submitted time was: **" + tools.timefix(time) + "**\n" + congrats)
                        //maybe find a way to undo a submission
                        //delete message
                            if (message.guild) {
                                message.delete()
                            }
                        }
                        
                    }   
                })
            })}
        } else if(args[0].name=="odds") {

        } else if(args[0].name=="stats") {
            
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