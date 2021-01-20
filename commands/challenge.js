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
        var ref = database.ref('challenge/times');
        ref.on("value", function(snapshot) {
            challengedata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var profileref = database.ref('challenge/profiles');
        profileref.on("value", function(snapshot) {
            profiledata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var feedbackref = database.ref('challenge/feedback');
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
        //calculate odds
            const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
            const Member = Guild.members.cache.get(member); // Getting the member.
            
            if (!Member.voice.channel) {
                if (profiledata !==null) {
                    if(profiledata[member] !== undefined){
                        odds_skips = profiledata[member].skips/100
                        odds_noupgrades = profiledata[member].no_upgrades/100
                        odds_non3lap = profiledata[member].non_3_lap/100
                        odds_mirrormode = profiledata[member].mirror_mode/100
                    } else {
                        profiledata[member].skips = 25
                        profiledata[member].no_upgrades = 15
                        profiledata[member].non_3_lap = 5
                        profiledata[member].mirror_mode = 5
                        profiledata[member].winnings = 1
                        odds_skips = 0.25
                        odds_noupgrades = 0.15
                        odds_non3lap = 0.05
                        odds_mirrormode = 0.05
                    }
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

        //build description
            var desc = ""
            if(Math.random()<0.50 && best.length> 0) {
                desc = desc +"*The current record-holder for this challenge is... " + best[0].name + "!*"
            } else if (Math.random() < 0.50) {
                var str = playerPicks[Math.floor(Math.random()*playerPicks.length)]
                if(!Member.voice.channel) {
                    desc = desc + str.replace("replaceme", interaction.member.user.username)
                } else {
                    var mems = client.channels.cache.get(Member.voice.channelID).members;
                    var memarray = [];
                    var memlist = ""
                    for (let [snowflake, guildMember] of mems){
                        if(guildMember.displayName !== "Botto"){
                            memarray.push(guildMember.displayName)
                        }
                    }
                    desc = desc + str.replace("replaceme", memarray[Math.floor(Math.random()*memarray.length)])
                }
            } else {
                if (vc) {
                    desc = desc + mpQuotes[Math.floor(Math.random()*mpQuotes.length)]
                } else {
                    desc = desc + movieQuotes[random3]
                }
            }
        //build embed
            function createEmbed(title, highlight) {
            //calculate goal time
                var speed = 1, speedmod = tracks[random2].avgspeedmod, length = tracks[random2].length
                length = length * laps
                if (nu) {
                    speed = racers[random1].avgspeed_nu
                } else {
                    speed = racers[random1].avgspeed_mu
                }
                var goal = length/(speed*speedmod)
                if (racers[random1].hasOwnProperty("flag")) {
                    flag = racers[random1].flag
                }
                var eTitle = "", eColor = "", eAuthor = [], eGoalTimes = []
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
                //tally likes and dislikes
                var rating = ""
                var like = 0, dislike = 0, keys = Object.keys(feedbackdata)
                for (var i=0; i<keys.length; i++) {
                    var k = keys[i];
                    if(feedbackdata[k].track == random2 && feedbackdata[k].racer == random1 && feedbackdata[k].laps == laps && feedbackdata[k].mirror == mirror && feedbackdata[k].nu == nu && feedbackdata[k].skips == skips){
                        if (feedbackdata[k].feedback == "👍") {
                            like = like +1
                        } else if (feedbackdata[k].feedback == "👎") {
                            dislike = dislike +1
                        }
                    }
                }
                if (like > 0) {
                    rating = "`👍" + like + "` " 
                }
                if (dislike > 0) {
                    rating = rating + "`👎" + dislike + "` " 
                }
                var keys = Object.keys(challengedata), best = []
                for (var i=0; i<keys.length; i++) {
                    var k = keys[i];
                    if(challengedata[k].track == random2 && challengedata[k].racer == random1 && challengedata[k].laps == laps && challengedata[k].mirror == mirror && challengedata[k].nu == nu && challengedata[k].skips == skips){
                        best.push(challengedata[k])
                    }
                }
                var besttimes = "Be the first to submit a time for this challenge!"
                var pos = ["<:P1:671601240228233216> ", "<:P2:671601321257992204> ", "<:P3:671601364794605570> ", "4th ", "5th "]
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
                    .setDescription(rating+desc)
                    .addField("Goal Times", eGoalTimes, true)
                    .addField("Best Times", besttimes, true)
                    if(!vc){
                        newEmbed.setFooter("Click to reroll the challenge for 1200 Truguts", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/game-die_1f3b2.png")
                    }
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
                sentMessage.react('👍').then(()=> sentMessage.react('👎')).then(async function (message) {
                    var feedback = ""
                    if(!vc){
                        sentMessage.react('🎲')
                    }
                    const filter = (reaction, user) => {
                        return (['👍', '👎', '↩️', '🎲'].includes(reaction.emoji.name) && user.id !== "545798436105224203");
                    };   
                    const collector = sentMessage.createReactionCollector(filter, {time: 900000})
                        collector.on('collect', (reaction, reactionCollector) => {
                            const user = reaction.users.cache.last()
                            //console.log("I got a reaction!")
                            //console.log(reaction.users.cache.last())
                            if(['👍', '👎'].includes(reaction.emoji.name)) {
                                if (reaction.emoji.name === '👍') {
                                    feedback = '👍'
                                } else {
                                    feedback = '👎'
                                }
                                var feedbackdata = {
                                    user: user.id,
                                    name: user.username,
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
                            } else if (reaction.emoji.name === '🎲' && !collected) {
                                nutext = "", mirrortext = "", laps = 3, skipstext = ""
                                nu = false, mirror = false, skips = false
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
                                desc = movieQuotes[Math.floor(Math.random()*movieQuotes.length)]
                                random1 = Math.floor(Math.random()*23)
                                random2 = Math.floor(Math.random()*25)
                                challengestart = Date.now()
                                eTitle = "Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext
                                eColor = planets[tracks[random2].planet].color
                                try {
                                    sentMessage.edit(createEmbed(":game_die: Reroll: ", null))
                                } catch {}
                            } else if (reaction.emoji.name === '↩️') {
                                for(let i = 0; i<collection.length; i++) {
                                    if(collection[i].user == user.id){
                                        ref.child(collection[i].record).remove()
                                        best.splice(collection[i].index, 1)
                                        try {
                                            sentMessage.edit(createEmbed("", ""))
                                        } catch {}
                                        collected = false
                                        collecting = true
                                    }
                                }
                                
                            }
                        })
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
                var collected = false, collecting = true, collection = []
                collector.on('collect', message => {
                //a new challenge appears
                    if(message.embeds.length > 0 && message.author.id == "545798436105224203") {
                        if (message.embeds[0].title.startsWith("Race")) {
                            if (vc) {
                                if(collected && collecting){ //previous challenge closed after rolling a new challenge
                                    try {
                                        sentMessage.edit(createEmbed(":white_check_mark: Completed: ", null)) 
                                    } catch {}
                                    collecting = false
                                } else if (!collected){ //rerolling mp challenge
                                    try {
                                        sentMessage.delete()
                                    } catch {}
                                    collected = true
                                    collecting = false
                                }
                            } else if (!collected && message.embeds[0].author.name.replace("'s Challenge", "") == interaction.member.user.username) { //rerolling sp challenge
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
                                sentMessage.react('↩️')
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
                                best.push(submissiondata)
                                var newPostRef = ref.push(submissiondata);
                                var collectiondata = {
                                    record: newPostRef.key,
                                    user: message.author.id,
                                    index: best.length-1
                                }
                                collection.push(collectiondata)
                                collected = true
                                console.log(collection)
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
        } else if(args[0].name=="settings") {
        //get input
            let member = interaction.member.user.id
            var winnings = undefined, odds_skips = undefined, odds_noupgrades = undefined, odds_non3lap = undefined, odds_mirrormode = undefined, odds_reset = undefined;
            if (args[0].hasOwnProperty("options")) {
                for (let i = 0; i<args[0].options.length; i++) {
                    if (args[0].options[i].name == "winnings") {
                        winnings = args[0].options[i].value
                    } else if (args[0].options[i].name == "skips_odds") {
                        odds_skips = args[0].options[i].value
                    } else if (args[0].options[i].name == "no_upgrades_odds") {
                        odds_noupgrades = args[0].options[i].value
                    } else if (args[0].options[i].name == "non_3_lap_odds") {
                        odds_non3lap = args[0].options[i].value
                    } else if (args[0].options[i].name == "mirrored_odds") {
                        odds_mirrormode = args[0].options[i].value
                    } else if (args[0].options[i].name == "reset") {
                        odds_reset = args[0].options[i].value
                    }
                }
            }
            var odds_text = ""
            var desc = "You have not customized your odds. The default odds are listed below. "
            var settings_default = {
                winnings: 1,
                skips: 25,
                no_upgrades: 15,
                non_3_lap: 5,
                mirrored: 5
            }
            var winnings_map = [
                {name:"Fair", text:":gem: 36%\n:first_place: 32%\n:second_place: 27%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%"}, 
                {name:"Skilled", text:":gem: 55%\n:first_place: 27%\n:second_place: 14%\n:third_place: 5%\n<:bumpythumb:703107780860575875> 0%"}, 
                {name:"Winner Takes All", text:":gem: 100%\n:first_place: 0%\n:second_place: 0%\n:third_place: 0%\n<:bumpythumb:703107780860575875> 0%"}
            ]
            if (odds_reset) { //resetting to default
                if(profiledata[member] !== undefined) {
                    desc = "You have successfully reset your settings to default. "
                    profileref.child(member).update({
                        winnings: settings_default.winnings,
                        skips: settings_default.skips,
                        no_upgrades: settings_default.no_upgrades,
                        non_3_lap: settings_default.non_3_lap,
                        mirror_mode: settings_default.mirrored
                    })
                }
            } else if (winnings == undefined && odds_skips == undefined && odds_noupgrades == undefined && odds_non3lap == undefined && odds_mirrormode == undefined) { //no odds submitted
                if(profiledata[member] !== undefined) {
                    desc = "Your current settings are shown below. "
                    winnings = profiledata[member].winnings
                    odds_skips = profiledata[member].skips
                    odds_noupgrades = profiledata[member].no_upgrades
                    odds_non3lap = profiledata[member].non_3_lap
                    odds_mirrormode = profiledata[member].mirror_mode
                } else {
                    desc = "You have not customized your settings. The default settings are shown below. "
                    winnings = settings_default.winnings
                    odds_skips = settings_default.skips
                    odds_noupgrades = settings_default.no_upgrades
                    odds_non3lap = settings_default.non_3_lap
                    odds_mirrormode = settings_default.mirrored
                }
            } else { //at least one setting was updated
                desc = "You have successfully updated your settings. Your new settings are shown below. "
                if (winnings == undefined) {
                    if (profiledata[member].winnings !== undefined) {
                        winnings = profiledata[member].winnings
                    } else {
                        winnings = settings_default.winnings
                    }
                }
                if (odds_skips == undefined) {
                    if (profiledata[member].skips !== undefined) {
                        odds_skips = profiledata[member].skips
                    } else {
                        odds_skips = settings_default.skips
                    }
                }
                if (odds_noupgrades == undefined) {
                    if (profiledata[member].no_upgrades !== undefined) {
                        odds_noupgrades = profiledata[member].no_upgrades
                    } else {
                        odds_noupgrades = settings_default.no_upgrades
                    }
                }
                if (odds_non3lap == undefined) {
                    if (profiledata[member].non_3_lap !== undefined) {
                        odds_non3lap = profiledata[member].non_3_lap
                    } else {
                        odds_non3lap = settings_default.non_3_lap
                    }
                }
                if (odds_mirrormode == undefined) {
                    if (profiledata[member].mirror_mode !== undefined) {
                        odds_mirrormode = profiledata[member].mirror_mode
                    } else {
                        odds_mirrormode = settings_default.mirrored
                    }
                }
                if (profiledata[member] !== undefined) {
                    profileref.child(member).update({
                        winnings: Number(winnings),
                        skips: odds_skips,
                        no_upgrades: odds_noupgrades,
                        non_3_lap: odds_non3lap,
                        mirror_mode: odds_mirrormode
                    })
                }
            }
            const oddsEmbed = new Discord.MessageEmbed()
                .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/game-die_1f3b2.png")
                .setAuthor(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                .setTitle("Your `/challenge` Settings")
                .setDescription(desc + "\n\n**Challenge Condition Odds**\nCustomize your odds by using the `/challenge settings` command and inputting numbers for Skips, No Upgrades, Non 3-lap, and Mirror Mode odds.\n" + 
                "**Challenge Winnings**\nYou can earn a certain amount of truguts based on the goal time you beat for each challenge. Customize your winnings pattern in the `/challenge settings` command and choose how to split your potential winnings.")
                .addField("Your Odds", "Skips - " + odds_skips +"%\nNo Upgrades - " + odds_noupgrades +"%\nNon 3-Lap - " + odds_non3lap +"%\nMirror Mode - " + odds_mirrormode +"%", true)
                .addField("Your Winnings: " + winnings_map[winnings].name, winnings_map[winnings].text, true)
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
        } else if(args[0].name=="profile") {
            let member = interaction.member.user.id
            /*
            Stats:
            X - Total Challenges
            X - Standard
            X - Skips
            X - No Upgrades
            X - Non 3-Lap
            X - Mirrored

            Gameplay Trends:
            Most played pod:
            Most played track:
            Most played planet:
            Most played circuit:

            Feedback Trends:
            Most played pod:
            Most played track:
            Most played planet:
            Most played circuit:


            Achievements:
            Galaxy Famous - Complete a challenge on every track: X/25
            Pod Champ - Complete a challenge with every pod: X/23
            Lightspeed Skipper - Complete a Skip Challenge for every track with a skip: X/15
            Slow 'n Steady: Complete a No Upgrades challenge with every pod: X/23
            Crowd Favorite - Complete a challenge as the track favorite on every track: X/25
            True Jedi: Complete a challenge with every pod on every track: X/575
            Big-Time Swindler: Earn or spend 1,000,000 total trugguts
            */
            var gFamous = {}
            var pChamp = {}
            var lSkipper = {}
            var sSteady = {}
            var cFavorite = {}
            var tJedi = {}
            var bSwindler = {}
            var keys = Object.keys(challengedata)
            var stats = {
                total: 0,
                standard: 0,
                skips: 0,
                no_upgrades: 0,
                non_3_lap: 0,
                mirrored: 0
            }
            var mostPod = {}
            mostPod.most_count = 0
            mostPod.most_name = null
            var mostTrack = {}
            mostTrack.most_count = 0
            mostTrack.most_name = null
            var mostPlanet = {}
            mostPlanet.most_count = 0
            mostPlanet.most_name = null
            var mostCircuit = {}
            mostCircuit.most_count = 0
            mostCircuit.most_name = null
            var likePod = {}
            likePod.most_count = 0
            likePod.most_name = null
            var likeTrack = {}
            likeTrack.most_count = 0
            likeTrack.most_name = null
            var dislikePod = {}
            dislikePod.most_count = 0
            dislikePod.most_name = null
            var dislikeTrack = {}
            dislikeTrack.most_count = 0
            dislikeTrack.most_name = null
            function getMost(obj, prop){
                if(obj[prop] == null){
                    obj[prop] = 1
                } else {
                    obj[prop]++
                }
                if(obj[prop] > obj.most_count){
                    obj.most_name = prop;
                    obj.most_count = obj[prop];
                }
            }
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(challengedata[k].user == member){
                    if(gFamous[challengedata[k].track] == null){
                        gFamous[challengedata[k].track] = 1
                    }
                    if(pChamp[challengedata[k].racer] == null){
                        pChamp[challengedata[k].racer] = 1
                    }
                    if(challengedata[k].skips){
                        if(lSkipper[challengedata[k].track] == null){
                            lSkipper[challengedata[k].track] = 1
                        }
                    }
                    if(challengedata[k].nu){
                        if(sSteady[challengedata[k].track] == null){
                            sSteady[challengedata[k].track] = 1
                        }
                    }
                    if(challengedata[k].racer == tracks[challengedata[k].track].favorite){
                        if(cFavorite[challengedata[k].track] == null){
                            cFavorite[challengedata[k].track] = 1
                        }
                    }
                    tJedi[challengedata[k].track + " " + challengedata[k].racer] = 1
                    stats.total ++
                    if(!challengedata[k].mirror && !challengedata[k].nu && !challengedata[k].skips && challengedata[k].laps == 3) {
                        stats.standard ++
                    } else {
                        if (challengedata[k].skips){
                            stats.skips ++
                        } 
                        if (challengedata[k].nu){
                            stats.no_upgrades ++
                        }
                        if (challengedata[k].laps !== 3){
                            stats.non_3_lap ++
                        }
                        if (challengedata[k].mirror){
                            stats.mirrored ++
                        }
                    } 
                    getMost(mostPod, challengedata[k].racer)
                    getMost(mostTrack, challengedata[k].track)
                    getMost(mostPlanet, tracks[challengedata[k].track].planet)
                    getMost(mostCircuit, tracks[challengedata[k].track].circuit)
                    
                }
            }
            var keys = Object.keys(feedbackdata)
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(feedbackdata[k].user == member){
                    if(feedbackdata[k].feedback == "👍"){
                        getMost(likePod, feedbackdata[k].racer)
                        getMost(likeTrack, feedbackdata[k].track)
                    } else if(feedbackdata[k].feedback == "👎"){
                        getMost(dislikePod, feedbackdata[k].racer)
                        getMost(dislikeTrack, feedbackdata[k].track)
                    }
                    
                }
            }

            console.log(stats)
            console.log(mostPod)
            console.log(mostTrack)
            console.log(mostPlanet)
            console.log(mostCircuit)
            console.log(likePod)
            console.log(likeTrack)
            console.log(dislikePod)
            console.log(dislikeTrack)
            console.log(gFamous)
            console.log(pChamp)
            console.log(lSkipper)
            console.log(sSteady)
            console.log(cFavorite)
            console.log(tJedi)
            const profileEmbed = new Discord.MessageEmbed()
                .setAuthor(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(interaction.member.user.id).user.avatarURL())
                .setTitle("Random Challenge Career Profile")
                .addField(":bar_chart: Challenge Stats", "Total: `" + stats.total + "`\nStandard: `"+stats.standard + "`\nSkips: `" + stats.skips + "`\nNo Upgrades: `" + stats.no_upgrades + "`\nNon 3-Lap: `" + stats.non_3_lap + "`\nMirrored: `" + stats.mirrored + "`", true)
                .addField(":chart_with_upwards_trend: Gameplay Trends", "**Most Played Pod:** \n" + racers[mostPod.most_name].flag + " " + racers[mostPod.most_name].name + " `" + mostPod.most_count + "`" +
                "\n**Most Played Track:**\n" + tracks[mostTrack.most_name].name + " `" + mostTrack.most_count + "`" +
                "\n**Most Played Planet:**\n" + planets[mostPlanet.most_name].name + " `" + mostPlanet.most_count + "`" +
                "\n**Most Played Circuit:**\n" + circuits[mostCircuit.most_name].name + " `" + mostCircuit.most_count + "`", true)
                .addField(":pencil: Feedback Trends", "**Most Liked Pod:** \n" + racers[likePod.most_name].flag+ " " + racers[likePod.most_name].name + " `👍" + likePod.most_count + "`" +
                "\n**Most Liked Track:**\n" + tracks[likeTrack.most_name].name + " `👍" + likeTrack.most_count + "`" +
                "\n**Most Disliked Pod:**\n" + racers[dislikePod.most_name].flag + " " + racers[dislikePod.most_name].name + " `👎" + dislikePod.most_count + "`" +
                "\n**Most Disliked Track:**\n" + tracks[dislikeTrack.most_name].name + " `👎" + dislikeTrack.most_count + "`", true)
                .addField(":trophy: Achievements", "**Galaxy Famous** - Complete a challenge on every track: `" + Object.keys(gFamous).length + "/25`" + 
                "\n**Pod Champ** - Complete a challenge with every pod: `" + Object.keys(pChamp).length + "/23`" +
                "\n**Lightspeed Skipper** - Complete a Skip challenge on every track with a skip: `" + Object.keys(lSkipper).length + "/15`" +
                "\n**Slow 'n Steady** - Complete a No Upgrades challenge with every pod: `" + Object.keys(sSteady).length + "/23`" +
                "\n**Crowd Favorite** - Complete a challenge as the track favorite on every track: `" + Object.keys(cFavorite).length + "/25`" +
                "\n**True Jedi** - Complete a challenge with every pod on every track: `" + Object.keys(tJedi).length + "/575`" +
                "\n**Big-Time Swindler** - Earn or spend 1,000,000 total truguts: `" + "x" + "/1,000,000`", true)
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
                        //content: "",
                        embeds: [profileEmbed]
                    }
                }
            })
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