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
        var oddsref = database.ref('odds');
        oddsref.on("value", function(snapshot) {
            oddsdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var feedbackref = database.ref('feedback');
        feedbackref.on("value", function(snapshot) {
            feedbackdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        //const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="generate" || args[0].name =="challenge") {
            
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
            if(Math.random()<0.50 && best.length> 0) {
                desc = desc +"*The current record-holder for this challenge is... " + best[0].name + "!*"
            } else if (Math.random() < 0.50) {
                var str = playerPicks[Math.floor(Math.random()*playerPicks.length)]
                desc = desc + str.replace("replaceme", interaction.member.user.username)
            } else {
                if (vc) {
                    desc = desc + mpQuotes[Math.floor(Math.random()*mpQuotes.length)]
                } else {
                    desc = desc + movieQuotes[random3]
                }
            }
        //build embed
            var eTitle = "", eColor = "", eAuthor = [], eGoalTimes = []
            const challengeEmbed = new Discord.MessageEmbed()
                eTitle = "Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext
                eColor = planets[tracks[random2].planet].color
            if(vc) {
                eAuthor = ["Multiplayer Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/160/twitter/259/chequered-flag_1f3c1.png"]
            } else {
                eAuthor = [interaction.member.user.username + "'s Challenge", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL()]
            }
            if(!skips) {
                eGoalTimes = ":gem: " + tools.timefix(goal*multipliers[0].ft_multiplier) + "\n:first_place: " + tools.timefix(goal*multipliers[1].ft_multiplier) + "\n:second_place: " + tools.timefix(goal*multipliers[2].ft_multiplier) + "\n:third_place: " + tools.timefix(goal*multipliers[3].ft_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(goal*multipliers[4].ft_multiplier)
            } else {
                eGoalTimes = ":gem: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[0])*multipliers[0].skips_multiplier) + "\n:first_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[1])*multipliers[1].skips_multiplier) + "\n:second_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[2])*multipliers[2].skips_multiplier) + "\n:third_place: " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[3])*multipliers[3].skips_multiplier) + "\n<:bumpythumb:703107780860575875> " + tools.timefix(tools.timetoSeconds(tracks[random2].parskiptimes[4])*multipliers[4].skips_multiplier)
            }
            function createEmbed(title, highlight) {
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
                if (like > 0) {
                    desc = "`👍" + like + "` " + desc 
                }
                if (dislike > 0) {
                    desc = "`👎" + dislike + "` " + desc 
                }
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
                    var date = ""
                    if (highlight !== null) {
                        date = highlight
                    }
                    for (var i=0; i<best.length; i++){
                        if(best[i].date == date) {
                            besttimes = besttimes + pos[i] + "" + tools.timefix(best[i].time) + " - " + best[i].name + " <a:newrecord:672640831882133524>\n"
                        } else {
                            besttimes = besttimes + pos[i] + "" + tools.timefix(best[i].time) + " - " + best[i].name + "\n"
                        }
                        if (i == 4) {
                            i = best.length
                        }
                    }
                }
                const newEmbed = new Discord.MessageEmbed()
                    .setTitle(title + eTitle)
                    .setColor(eColor)
                    .setAuthor(eAuthor[0], eAuthor[1])
                    .setDescription(desc)
                    .addField("Goal Times", eGoalTimes, true)
                    .addField("Best Times", besttimes, true)
                return newEmbed
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
            client.channels.cache.get(interaction.channel_id).send(createEmbed("",null)).then(sentMessage => {
            //collect feedback
                sentMessage.react('👍').then(()=> sentMessage.react('👎')).then(() =>{
                    var feedback = ""
                    const filter = (reaction, user) => {
                        return (['👍', '👎'].includes(reaction.emoji.name) && user.id !== "545798436105224203");
                    };   
                    sentMessage.awaitReactions(filter, {max: 1, time: 900000})
                        .then(collected => {
                            const reaction = collected.first();
                            console.log("I got a reaction!")
                            console.log(reaction.users)
                            if (reaction.emoji.name === '👍') {
                                feedback = '👍'
                            } else {
                                feedback = '👎'
                            }
                            var feedbackdata = {
                                user: reaction.users.id,
                                name: reaction.users.username,
                                feedback: feedback,
                                date: sentMessage.createdTimestamp,
                                racer: random1,
                                track: random2,
                                laps: laps,
                                nu: nu,
                                skips: skips,
                                mirror: mirror
                            }
                            feedbackref.push(feedbackdata);
                        })
                        .catch(console.error)
                })
                setTimeout(async function() { //5 minute warning
                    if(!collected){
                        try { 
                            await sentMessage.edit(createEmbed(":warning: 5 Minute Warning: ", null)) 
                        } catch {}
                    }
                }, 600000)
                setTimeout(async function() { //1 minute warning
                    if(!collected){
                        try { 
                            await sentMessage.edit(createEmbed(":warning: 1 Minute Warning: ", null)) 
                        } catch {}
                    }
                }, 840000)
                setTimeout(async function() { //challenge closed
                    if(!collected){
                        try { 
                            await sentMessage.edit(createEmbed(":negative_squared_cross_mark: Closed: ", null)) 
                        } catch (error) {
                            // log all errors
                            console.error(error)
                        }
                    }
                }, 900000)
            //collect times
                const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m,{ time: 900000 });
                var collected = false, collecting = true
                collector.on('collect', message => {
                //a new challenge appears
                    if(message.embeds.length > 0 && message.author.id == "545798436105224203") {
                        if (message.embeds[0].title.startsWith("Race")) {
                            if (vc) {
                                if(collected){ //previous challenge closed after rolling a new challenge
                                    try {
                                        sentMessage.edit(createEmbed(":white_check_mark: Completed: ", null)) 
                                    } catch {}
                                    collecting = false
                                } else { //rerolling mp challenge
                                    try {
                                        sentMessage.delete()
                                    } catch {}
                                    collected = true
                                    collecting = false
                                }
                            } else if (collected == false && message.embeds[0].author.name.replace("'s Challenge", "") == interaction.member.user.username) { //rerolling sp challenge
                                collected = true
                                collecting = false
                                try {
                                    sentMessage.delete()
                                } catch {}
                            }
                        }
                //submitting the time
                    } else if (!isNaN(message.content.replace(":", "")) && tools.timetoSeconds(message.content) !== null) {
                        var challengeend = Date.now()
                        var time = ""
                        if (vc){
                            time = tools.timetoSeconds(message.content)
                        } else if (collected == false && member == message.author.id) {
                            time = tools.timetoSeconds(message.content)
                        }
                        tools.timetoSeconds(message.content)
                        if(time !== "" && collecting){
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
                            //edit original message
                                if(vc){
                                    try {
                                        sentMessage.edit(createEmbed("", submissiondata.date))
                                    } catch {}
                                } else {
                                    try {
                                    sentMessage.edit(createEmbed(":white_check_mark: Completed: ", submissiondata.date))
                                    } catch {}
                                }
                                
                            //maybe find a way to undo a submission
                            //delete message
                                if (message.guild) {
                                    try {
                                        message.delete()
                                    } catch {}
                                }
                            }
                        }
                    }   
                })
            })
        } else if(args[0].name=="odds") {
        //get input
            console.log(args)
            var odds_skips = undefined, odds_noupgrades = undefined, odds_non3lap = undefined, odds_mirrormode = undefined, odds_reset = undefined;
            if (args[0].hasOwnProperty("options")) {
                for (let i = 0; i<args[0].options.length; i++) {
                    if (args[0].options[i].name == "skips") {
                        odds_skips = args[0].options[i].value
                    } else if (args[0].options[i].name == "no_upgrades") {
                        odds_noupgrades = args[0].options[i].value
                    } else if (args[0].options[i].name == "non_3_lap") {
                        odds_non3lap = args[0].options[i].value
                    } else if (args[0].options[i].name == "mirrored") {
                        odds_mirrormode = args[0].options[i].value
                    } else if (args[0].options[i].name == "reset") {
                        odds_reset = args[0].options[i].value
                    }
                }
            }
            var record = ""
            var desc = "You have not customized your odds. The default odds are listed below. Customize your odds by using the `/challenge odds` command and inputting numbers for Skips, No Upgrades, Non 3-lap, and Mirror Mode. These numbers will be divided by 100 to determine the chances Botto will give their conditions in a `/challenge`."
            var odds_default = {
                skips: 25,
                no_upgrades: 15,
                non_3_lap: 5,
                mirrored: 5
            }
        //find odds record
            if (oddsdata !==null) {
                var keys = Object.keys(oddsdata)
                for (var i=0; i<keys.length; i++) {
                    var k = keys[i];
                    if(oddsdata[k].name == interaction.member.user.id){
                        record = k
                        i = keys.length
                    }
                }
            }
            if (odds_reset) { //resetting to default
                if(record !== "") {
                    desc = "You have successfully reset your odds to the default. "
                    oddsref.child(record).remove()
                    odds_skips = odds_default.skips
                    odds_noupgrades = odds_default.no_upgrades
                    odds_non3lap = odds_default.non_3_lap
                    odds_mirrormode = odds_default.mirrored
                }
            } else if (odds_skips == undefined && odds_noupgrades == undefined && odds_non3lap == undefined && odds_mirrormode == undefined) { //no odds submitted
                if(record !== "") {
                    desc = "Your custom odds are listed below. Customize your odds by using the `/challenge odds` command and inputting numbers for Skips, No Upgrades, Non 3-lap, and Mirror Mode. These numbers will be divided by 100 to determine the chances Botto will give their conditions in a `/challenge`."
                    odds_skips = oddsdata[k].skips
                    odds_noupgrades = oddsdata[k].no_upgrades
                    odds_non3lap = oddsdata[k].non_3_lap
                    odds_mirrormode = oddsdata[k].mirror_mode
                } else {
                    desc = "You have not customized your odds. The default odds are listed below. Customize your odds by using the `/challenge odds` command and inputting numbers for Skips, No Upgrades, Non 3-lap, and Mirror Mode. These numbers will be divided by 100 to determine the chances Botto will give their conditions in a `/challenge`."
                    odds_skips = odds_default.skips
                    odds_noupgrades = odds_default.no_upgrades
                    odds_non3lap = odds_default.non_3_lap
                    odds_mirrormode = odds_default.mirrored
                }
            } else { //at least one new odd submitted
                desc = "You have successfully updated your custom odds. Your custom odds are listed below. "
                if (odds_skips == undefined) {
                    if (record !== "") {
                        odds_skips = oddsdata[k].skips
                    } else {
                        odds_skips = odds_default.skips
                    }
                }
                if (odds_noupgrades == undefined) {
                    if (record !== "") {
                        odds_noupgrades = oddsdata[k].no_upgrades
                    } else {
                        odds_noupgrades = odds_default.no_upgrades
                    }
                }
                if (odds_non3lap == undefined) {
                    if (record !== "") {
                        odds_non3lap = oddsdata[k].non_3_lap
                    } else {
                        odds_non3lap = odds_default.non_3_lap
                    }
                }
                if (odds_mirrormode == undefined) {
                    if (record !== "") {
                        odds_mirrormode = oddsdata[k].mirror_mode
                    } else {
                        odds_mirrormode = odds_default.mirrored
                    }
                }
                var data = {
                    name: interaction.member.user.id,
                    skips: odds_skips,
                    no_upgrades: odds_noupgrades,
                    non_3_lap: odds_non3lap,
                    mirror_mode: odds_mirrormode
                }
                if (record !== "") {
                    oddsref.child(record).remove() //delete old odds
                }
                oddsref.push(data);
            }
            const oddsEmbed = new Discord.MessageEmbed()
                .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/game-die_1f3b2.png")
                .setAuthor(interaction.member.user.username + "'s Odds", client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                .setTitle("Customize Your `/challenge` Odds")
                .setDescription(desc)
                .addField("Your Odds", "Skips - " + odds_skips +"%\nNo Upgrades - " + odds_noupgrades +"%\nNon 3-Lap - " + odds_non3lap +"%\nMirror Mode - " + odds_mirrormode +"%", true)
                .addField("Default Odds", "Skips - "+odds_default.skips+"%\nNo Upgrades - "+odds_default.no_upgrades+"%\nNon 3-Lap - "+odds_default.non_3_lap+"%\nMirror Mode - "+ odds_default.mirrored +"%", true)
                .setColor("EA596E")
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
                        content: "",
                        embeds: [oddsEmbed]
                    }
                }
            })
        } else if(args[0].name=="stats") {
        /*
        Stats:
        X - Total Challenges
        X - Standard
        X - Skips
        X - NU
        X - Non 3-Lap
        X - Mirror Mode

        Trends:
        Most played pod:
        Most played track:
        Most played planet:
        Most played circuit:

        Achievements:
        Complete a challenge on every track: X/25
        Complete a challenge with every pod: X/23
        Complete a skip challenge for every track with a skip: X/12
        Complete a NU challenge with every pod: X/23
        Complete a challenge as every pod on every track: X/575

        var keys = Object.keys(challengedata)
        var best = []
        for (var i=0; i<keys.length; i++) {
            var k = keys[i];
            if(challengedata[k].track == random2 && challengedata[k].racer == random1 && challengedata[k].laps == laps && challengedata[k].mirror == mirror && challengedata[k].nu == nu && challengedata[k].skips == skips){
                best.push(challengedata[k])
            }
        }
        if(array.length == 0)
        return null;
        var modeMap = {};
        var maxEl = array[0], maxCount = 1;
        for(var i = 0; i < array.length; i++)
        {
            var el = array[i];
            if(modeMap[el] == null)
                modeMap[el] = 1;
            else
                modeMap[el]++;  
            if(modeMap[el] > maxCount)
            {
                maxEl = el;
                maxCount = modeMap[el];
            }
        }
        return maxEl;
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
        */
        } else if(args[0].name=="about") {
            const challengeHelpEmbed = new Discord.MessageEmbed()
                .setTitle("Random Challenges")
                .setDescription("When you type `/challenge generate` or `/random challenge`, Botto will challenge you to race a random pod on a random track with random conditions. The default conditions are max upgrades, 3-lap, full track. You have 15 minutes to submit a time for the challenge. You can submit your time by entering it in the same channel that you called the challenge. \n\n Don't like a challenge? You can reroll a challenge by entering the command again and Botto will automatically clean up the uncompleted challenge for you.\n\nYou can customize your odds by typing `/challenge odds`")
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