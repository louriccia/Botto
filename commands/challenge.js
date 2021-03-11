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

        var achievements = {
            galaxy_famous: {name: "Galaxy Famous",         description: "Complete a challenge on every track",                         role: "819514261289828362", limit: 25, collection: {}},
            pod_champ: {name: "Pod Champ",             description: "Complete a challenge with every pod",                         role: "819514029218463774", limit: 23, collection: {}},
            light_skipper: {name: "Lightspeed Skipper",    description: "Complete a Skip challenge on every track with a skip",        role: "819514330985922621", limit: 15, collection: {}},
            slow_steady: {name: "Slow 'n Steady",        description: "Complete a No Upgrades challenge with every pod",             role: "819514431472926721", limit: 23, collection: {}},
            crowd_favorite: {name: "Crowd Favorite",        description: "Complete a challenge as the track favorite on every track",   role: "819514487852761138", limit: 25, collection: {}},
            true_jedi: {name: "True Jedi",             description: "Complete a challenge with every pod on every track",          role: "819514600827519008", limit: 575, collection: {}}
        }

        //const myEmbed = new Discord.MessageEmbed()
        if(args[0].name =="generate" || args[0].name =="challenge") {
            
            let member = interaction.member.user.id
            var vc = false
            var challengestart = Date.now()

            if (profiledata[member] !== undefined){
                if(profiledata[member].current !== undefined){
                    if (profiledata[member].current.completed == false && profiledata[member].current.start + 900000 > challengestart){
                        /* reroll event
                        client.channels.cache.get(interaction.channel_id).send("Previous challenge still active. Click 🔄 to reroll.")
                        if(interaction.name !== "fake"){
                            client.api.interactions(interaction.id, interaction.token).callback.post({
                                data: {
                                    type: 2,
                                    data: {
                                        //content: "",
                                        //embeds: [challengeEmbed]
                                    }
                                }
                            })
                        }
                        return
                        */
                    }
                }
            }
            

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
                        var data = {
                            mirror_mode: 5,
                            name: interaction.member.user.username,
                            no_upgrades: 15,
                            non_3_lap: 5,
                            skips: 25,
                            winnings: 1
                        }
                        profileref.child(member).set(data)
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
                    nu = true
                }
                if (Math.random()<odds_mirrormode){
                    mirrortext = ", **MIRRORED!** "
                }
                if (Math.random()<odds_non3lap){
                    laps = lap[Math.floor(Math.random()*4)]
                }
                if (tracks[random2].hasOwnProperty("parskiptimes")) {
                    if (Math.random()<odds_skips) {
                        skips = true
                    }
                }
            } else {
                vc = true
            }
            if(interaction.name =="fake"){
                if(interaction.recovery == true){
                    random1 = profiledata[member].current.racer
                    random2 = profiledata[member].current.track
                    nu = profiledata[member].current.nu
                    mirror = profiledata[member].current.mirror
                    laps = profiledata[member].current.laps
                    skips = profiledata[member].current.skips
                }
            }
            if(nu){
                nutext = " with **NO UPGRADES**"
            }
            if(skips){
                skipstext = ", with **SKIPS**"
            }
            if(laps !== 3){
                laptext = " for **" + laps + " lap(s)**"
            }
            if(mirror){
                mirror = true
            }
            var current = {
                start: challengestart,
                completed: false,
                channel: interaction.channel_id,
                racer: random1,
                track: random2,
                laps: laps,
                nu: nu,
                skips: skips,
                mirror: mirror
            }
            if(!vc){
                profileref.child(member).child("current").set(current)
            }
        //get best runs/achievement progress
            var keys = Object.keys(challengedata), best = []
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                var keys = Object.keys(challengedata)
                if(challengedata[k].user == member){
                    if(achievements.galaxy_famous.collection[challengedata[k].track] == null){
                        achievements.galaxy_famous.collection[challengedata[k].track] = 1
                    }
                    if(achievements.pod_champ.collection[challengedata[k].racer] == null){
                        achievements.pod_champ.collection[challengedata[k].racer] = 1
                    }
                    if(challengedata[k].skips){
                        if(achievements.light_skipper.collection[challengedata[k].track] == null){
                            achievements.light_skipper.collection[challengedata[k].track] = 1
                        }
                    }
                    if(challengedata[k].nu){
                        if(achievements.slow_steady.collection[challengedata[k].track] == null){
                            achievements.slow_steady.collection[challengedata[k].track] = 1
                        }
                    }
                    if(challengedata[k].racer == tracks[challengedata[k].track].favorite){
                        if(achievements.crowd_favorite.collection[challengedata[k].track] == null){
                            achievements.crowd_favorite.collection[challengedata[k].track] = 1
                        }
                    }
                    achievements.true_jedi.collection[challengedata[k].track + " " + challengedata[k].racer] = 1
                }
                if(challengedata[k].track == random2 && challengedata[k].racer == random1 && challengedata[k].laps == laps && challengedata[k].mirror == mirror && challengedata[k].nu == nu && challengedata[k].skips == skips){
                    best.push(challengedata[k])
                }

            }
        //build description
            var desc = ""
            if(Math.random()<0.50 && best.length> 0) {
                best.sort(function(a,b) {
                    return a.time-b.time;
                })
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
            var eAuthor = [], eTitle = "", title = "", highlight = "", eGoalTimes = []
            function createEmbed() {
            //calculate goal time
                var speed = 1, speedmod = tracks[random2].avgspeedmod, length = tracks[random2].lap.length
                length = length * laps
                if (nu) {
                    speed = tools.avgSpeed(racers[random1].max_speed, racers[random1].boost_thrust, racers[random1].heat_rate, racers[random1].cool_rate)
                } else {
                    speed = tools.avgSpeed(tools.upgradeTopSpeed(racers[random1].max_speed, 5), racers[random1].boost_thrust, racers[random1].heat_rate, tools.upgradeCooling(racers[random1].cool_rate, 5))
                }
                var goal = length/(speed*speedmod)
                if (racers[random1].hasOwnProperty("flag")) {
                    flag = racers[random1].flag
                }
                var eColor = ""
                eTitle = "Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext
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
                var pos = ["<:P1:671601240228233216> ", "<:P2:671601321257992204> ", "<:P3:671601364794605570> ", "4th ", "5th ", "6th ", "7th ", "8th ", "9th ", "10th "]
                if(best.length > 0) {
                    besttimes =""
                    best.sort(function(a,b) {
                        return a.time-b.time;
                    })
                    var date = ""
                    if (highlight !== null) {
                        date = highlight
                    }
                    var already = []
                    for (var i=0; i<best.length; i++){
                        if((!vc && !already.includes(best[i].name) || best[i].name == interaction.member.user.username) || (vc && !already.includes(best[i].name))){
                            if(best[i].date == date) {
                                besttimes = besttimes + pos[i] + "" + tools.timefix(best[i].time) + " - " + best[i].name + " <a:newrecord:672640831882133524>\n"
                            } else {
                                besttimes = besttimes + pos[i] + "" + tools.timefix(best[i].time) + " - " + best[i].name + "\n"
                            }
                            already.push(best[i].name)
                        }
                        if (i-already.length == 9) {
                            i = best.length
                        }
                    }
                }
                if(title == ":white_check_mark: Completed: ") {
                    eColor = "77B255"
                } else if (title == ":warning: 5 Minute Warning: " || title == "<a:countdown:672640791369482251> 1 Minute Warning: "){
                    eColor = "FAA61A"
                } else if (title == ":negative_squared_cross_mark: Closed: " || title == ":arrows_counterclockwise: Rerolled: "){
                    eColor = "2F3136"
                } else {
                    eColor = planets[tracks[random2].planet].color
                }
                //prepare achievement progress
                var achievement_message = []
                var galaxyFamous = achievements.galaxy_famous.name, podChamp = achievements.pod_champ.name, lightSkipper = achievements.light_skipper.name, slowSteady = achievements.slow_steady.name, crowdFavorite = achievements.crowd_favorite.name, trueJedi = achievements.true_jedi.name
                if(interaction.guild_id == "441839750555369474"){
                    galaxyFamous = "<@&" + achievements.galaxy_famous.role + ">"
                    podChamp = "<@&" + achievements.pod_champ.role + ">"
                    lightSkipper = "<@&" + achievements.light_skipper.role + ">"
                    slowSteady = "<@&" + achievements.slow_steady.role + ">"
                    crowdFavorite = "<@&" + achievements.crowd_favorite.role + ">"
                    trueJedi = "<@&" + achievements.true_jedi.role + ">"
                }
                if(!vc){
                    if(Object.keys(achievements.galaxy_famous.collection).length < achievements.galaxy_famous.limit && achievements.galaxy_famous.collection[random2] == undefined){
                        achievement_message.push("**" + galaxyFamous + "** `" + Object.keys(achievements.galaxy_famous.collection).length + "/25`")
                    }
                    if(Object.keys(achievements.pod_champ.collection).length < achievements.pod_champ.limit && achievements.pod_champ.collection[random1] == undefined){
                        achievement_message.push("**" + podChamp + "** `" + Object.keys(achievements.pod_champ.collection).length + "/23`")
                    }
                    if(Object.keys(achievements.light_skipper.collection).length < achievements.light_skipper.limit && skips && achievements.light_skipper.collection[random2] == undefined){
                        achievement_message.push("**" + lightSkipper + "** `" + Object.keys(achievements.light_skipper.collection).length + "/15`")
                    }
                    if(Object.keys(achievements.slow_steady.collection).length < achievements.slow_steady.limit && nu && achievements.slow_steady.collection[random2] == undefined){
                        achievement_message.push("**" + slowSteady + "** `" + Object.keys(achievements.slow_steady.collection).length + "/23`")
                    }
                    if(Object.keys(achievements.crowd_favorite.collection).length < achievements.crowd_favorite.limit && random1 == tracks[random2].favorite && achievements.crowd_favorite.collection[random2] == undefined){
                        achievement_message.push("**" + crowdFavorite + "** `" + Object.keys(achievements.crowd_favorite.collection).length + "/25`")
                    }
                    if(Object.keys(achievements.true_jedi.collection).length < achievements.true_jedi.limit && achievements.true_jedi.collection[random2 + " " + random1] == undefined){
                        achievement_message.push("**" + trueJedi + "** `" + Object.keys(achievements.true_jedi.collection).length + "/575`")
                    }
                    if(profiledata[member].achievements == undefined){
                        var ach = {
                            galaxy_famous: false,
                            pod_champ: false,
                            light_skipper: false,
                            slow_steady: false,
                            crowd_favorite: false,
                            true_jedi: false,
                            big_spender: false
                        }
                        profileref.child(member).child("achievements").set(ach)
                    }
                    var achvs = Object.keys(achievements)
                    for (var i = 0; i < achvs.length; i ++){
                        var a = achvs[i]
                        if(Object.keys(achievements[a].collection).length == achievements[a].limit && profiledata[member].achievements[a] == false){
                            profileref.child(member).child("achievements").child(a).set(true)
                            var congratsEmbed = new Discord.MessageEmbed()
                                .setAuthor(interaction.member.user.username + " got an achievement!", eAuthor[1])
                                .setDescription(achievements[a].description)
                                .setColor("FFB900")
                                .setTitle("**:trophy: " + achievements[a].name + "**")
                            if(interaction.guild_id == "441839750555369474"){
                                congratsEmbed.setTitle("**<@&" + achievements[a].role + ">**")
                                Member.roles.add(achievements[a].role).catch(error=>console.log(error))
                            }
                            client.channels.cache.get(interaction.channel_id).send(congratsEmbed)
                        }
                    }
                }
                const newEmbed = new Discord.MessageEmbed()
                    .setTitle(title + eTitle )
                    .setColor(eColor)
                    if(![":arrows_counterclockwise: Rerolled: ", ":negative_squared_cross_mark: Closed: "].includes(title)){
                        newEmbed  
                            .setAuthor(eAuthor[0], eAuthor[1])
                            .setDescription(rating+desc+ "\n" + achievement_message.join(", "))
                            .addField("Goal Times", eGoalTimes, true)
                            .addField("Best Times", besttimes, true)
                    } else {
                        newEmbed.setTitle(title + "~~" + eTitle + "~~")
                    }
                    
                    if(!vc){
                        //newEmbed.setFooter("Click to reroll the challenge for 1200 Truguts", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/game-die_1f3b2.png")
                    }
                return newEmbed
            }
        //send embed
            if(interaction.name !== "fake"){
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 2,
                        data: {
                            //content: "",
                            //embeds: [challengeEmbed]
                        }
                    }
                })
            }
            client.channels.cache.get(interaction.channel_id).send(createEmbed()).then(sentMessage => {
            //collect feedback
                profileref.child(member).child("current").update({message: sentMessage.id})
                sentMessage.react('👍').then(()=> sentMessage.react('👎')).then(async function (message) {
                    var feedback = ""
                    if(!vc){
                        sentMessage.react('🔄')
                    }
                    const filter = (reaction, user) => {
                        return (['👍', '👎', '↩️', '🔄', '▶️'].includes(reaction.emoji.name) && user.id !== "545798436105224203" && ((user.id == member && !vc) || vc));
                    };   
                    const collector = sentMessage.createReactionCollector(filter, {time: 1800000}) //reactions
                        collector.on('collect', (reaction, reactionCollector) => {
                            const user = reaction.users.cache.last()
                            var fakeinteraction = {
                                name: "fake",
                                recovery: false,
                                member: {
                                    user: {
                                        id: interaction.member.user.id,
                                        username: interaction.member.user.username
                                    }
                                },
                                guild_id: interaction.guild_id,
                                channel_id: interaction.channel_id
                            }
                            if(['👍', '👎'].includes(reaction.emoji.name)) { //feedback
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
                                try {
                                    sentMessage.edit(createEmbed())
                                } catch {}
                            } else if (reaction.emoji.name === '🔄' && !collected) { //reroll
                                
                                collected = true
                                collecting = false
                                title = ":arrows_counterclockwise: Rerolled: "
                                eTitle = "~~"+eTitle+"~~"
                                profileref.child(member).child("current").update({completed: true})
                                try {
                                    sentMessage.edit("", createEmbed())
                                    sentMessage.reactions.removeAll().catch()
                                } catch {}
                                client.commands.get("challenge").execute(client, fakeinteraction, args);
                            } else if (reaction.emoji.name === '↩️') { //undo
                                for(let i = 0; i<collection.length; i++) {
                                    if(collection[i].user == user.id){
                                        ref.child(collection[i].record).remove()
                                        best.splice(collection[i].index, 1)
                                        title = ""
                                        highlight = ""
                                        try {
                                            profileref.child(member).child("current").update({completed: false})
                                            sentMessage.edit(createEmbed())
                                            sentMessage.reactions.resolve("↩️").users.remove("545798436105224203")
                                            sentMessage.reactions.resolve("▶️").users.remove("545798436105224203")
                                            sentMessage.reactions.resolve("↩️").users.remove(member)
                                            sentMessage.reactions.resolve("▶️").users.remove(member)
                                        } catch {}
                                        collected = false
                                        collecting = true
                                    }
                                }
                                
                            } else if (reaction.emoji.name === '▶️' && collected) { //next challenge
                                try{
                                    sentMessage.reactions.resolve("↩️").users.remove("545798436105224203")
                                    sentMessage.reactions.resolve("▶️").users.remove("545798436105224203")
                                    sentMessage.reactions.resolve("↩️").users.remove(member)
                                    sentMessage.reactions.resolve("▶️").users.remove(member)
                                } catch {}
                                client.commands.get("challenge").execute(client, fakeinteraction, args);
                            }
                        })
                })
                var warning = ""
                if(!vc){
                    warning = "<@" + member + ">"
                }
                setTimeout(async function() { //5 minute warning
                    if(collecting){
                        title = ":warning: 5 Minute Warning: "
                        try { 
                            await sentMessage.edit(warning, createEmbed()) 
                        } catch {}
                    }
                }, 600000)
                setTimeout(async function() { //1 minute warning
                    if(collecting){
                        title = "<a:countdown:672640791369482251> 1 Minute Warning: "
                        try { 
                            await sentMessage.edit(warning, createEmbed()) 
                        } catch {}
                    }
                }, 840000)
                setTimeout(async function() { //challenge closed
                    if(collecting){
                        title = ":negative_squared_cross_mark: Closed: "
                        profileref.child(member).child("current").update({completed: true})
                        try { 
                            await sentMessage.edit("", createEmbed()) 
                            await sentMessage.reactions.removeAll().catch()
                        } catch (error) {
                            // log all errors
                            console.error(error)
                        }
                    }
                }, 900000)
                setTimeout(async function() { //clean up reactions
                    try { 
                        await sentMessage.reactions.removeAll().catch()
                    } catch (error) {
                        // log all errors
                        console.error(error)
                    }
                }, 1200000)
            //collect times
                const collector = new Discord.MessageCollector(client.channels.cache.get(interaction.channel_id), m => m,{ time: 900000 }); //messages
                var collected = false, collecting = true, collection = []
                collector.on('collect', message => {
                //a new challenge appears
                    if(message.embeds.length > 0 && message.author.id == "545798436105224203") {
                        if (![undefined, null, ""].includes(message.embeds[0].title)) {
                            if (message.embeds[0].title.startsWith("Race")) {
                                if (vc) {
                                    if(collected && collecting){ //previous mp challenge closed after rolling a new challenge
                                        title = ":white_check_mark: Completed: "
                                        try {
                                            sentMessage.edit(createEmbed()) 
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
                                    title = ":arrows_counterclockwise: Rerolled: "
                                    profileref.child(member).child("current").update({completed: true})
                                    try {
                                        sentMessage.edit("", createEmbed())
                                        sentMessage.reactions.removeAll().catch()
                                        /*
                                        sentMessage.reactions.resolve("↩️").users.remove("545798436105224203")
                                        sentMessage.reactions.resolve("▶️").users.remove("545798436105224203")
                                        sentMessage.reactions.resolve("↩️").users.remove(member)
                                        sentMessage.reactions.resolve("▶️").users.remove(member)
                                        */
                                    } catch {}
                                }
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
                                if(!vc){
                                    collecting = false
                                }
                            } else {
                            //log time
                                try{
                                    sentMessage.reactions.resolve("🔄").users.remove("545798436105224203")
                                    sentMessage.reactions.resolve("🔄").users.remove(member)
                                    sentMessage.react('↩️').then(sentMessage.react('▶️'))
                                } catch {
                                    
                                }
                                
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
                                if(!vc){
                                    collecting = false
                                }
                                console.log(collection)
                            //edit original message
                                if(vc){
                                    highlight = submissiondata.date
                                    try {
                                        sentMessage.edit(createEmbed())
                                    } catch {}
                                } else {
                                    title = ":white_check_mark: Completed: "
                                    highlight = submissiondata.date
                                    profileref.child(member).child("current").update({completed: true})
                                    try {
                                        sentMessage.edit(createEmbed())
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
                if (profiledata[member] == undefined){
                    var data = {
                        mirror_mode: 5,
                        name: interaction.member.user.username,
                        no_upgrades: 15,
                        non_3_lap: 5,
                        skips: 25,
                        winnings: 1
                    }
                    profileref.child(member).set(data)
                }
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
            var member = interaction.member.user.id
            if (args[0].hasOwnProperty("options")) {
                if(args[0].options[0].name == "user"){
                    member = args[0].options[0].value
                }
            }
            var keys = Object.keys(challengedata)
            var stats = {
                total: 0,
                standard: 0,
                skips: 0,
                no_upgrades: 0,
                non_3_lap: 0,
                mirrored: 0
            }
            var mostPod = {}, mostTrack = {}, mostPlanet = {}, mostCircuit = {}, likePod = {}, likeTrack = {}, dislikePod = {}, dislikeTrack = {}
            mostPod.most_count = 0
            mostPod.most_name = null
            mostTrack.most_count = 0
            mostTrack.most_name = null
            mostPlanet.most_count = 0
            mostPlanet.most_name = null
            mostCircuit.most_count = 0
            mostCircuit.most_name = null
            likePod.most_count = 0
            likePod.most_name = null
            likeTrack.most_count = 0
            likeTrack.most_name = null
            dislikePod.most_count = 0
            dislikePod.most_name = null
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
            var hasraced = false
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(challengedata[k].user == member){
                    if(achievements.galaxy_famous.collection[challengedata[k].track] == null){
                        achievements.galaxy_famous.collection[challengedata[k].track] = 1
                    }
                    if(achievements.pod_champ.collection[challengedata[k].racer] == null){
                        achievements.pod_champ.collection[challengedata[k].racer] = 1
                    }
                    if(challengedata[k].skips){
                        if(achievements.light_skipper.collection[challengedata[k].track] == null){
                            achievements.light_skipper.collection[challengedata[k].track] = 1
                        }
                    }
                    if(challengedata[k].nu){
                        if(achievements.slow_steady.collection[challengedata[k].track] == null){
                            achievements.slow_steady.collection[challengedata[k].track] = 1
                        }
                    }
                    if(challengedata[k].racer == tracks[challengedata[k].track].favorite){
                        if(achievements.crowd_favorite.collection[challengedata[k].track] == null){
                            achievements.crowd_favorite.collection[challengedata[k].track] = 1
                        }
                    }
                    achievements.true_jedi.collection[challengedata[k].track + " " + challengedata[k].racer] = 1
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
                    hasraced = true
                    getMost(mostPod, challengedata[k].racer)
                    getMost(mostTrack, challengedata[k].track)
                    getMost(mostPlanet, tracks[challengedata[k].track].planet)
                    getMost(mostCircuit, tracks[challengedata[k].track].circuit)
                }
            }
            var keys = Object.keys(feedbackdata)
            var hasliked = false
            var hasdisliked = false
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(feedbackdata[k].user == member){
                    if(feedbackdata[k].feedback == "👍"){
                        hasliked = true
                        getMost(likePod, feedbackdata[k].racer)
                        getMost(likeTrack, feedbackdata[k].track)
                    } else if(feedbackdata[k].feedback == "👎"){
                        hasdisliked = true
                        getMost(dislikePod, feedbackdata[k].racer)
                        getMost(dislikeTrack, feedbackdata[k].track)
                    }
                    
                }
            }

            const profileEmbed = new Discord.MessageEmbed()
                .setAuthor(client.guilds.resolve(interaction.guild_id).members.resolve(member).user.username, client.guilds.resolve(interaction.guild_id).members.resolve(member).user.avatarURL())
                .setTitle("Random Challenge Career Profile")
                //add goal times achieved for the stat section
                if(hasraced){
                    profileEmbed
                        .addField(":bar_chart: Challenge Stats", "Total: `" + stats.total + "`\nStandard: `"+stats.standard + "`\nSkips: `" + stats.skips + "`\nNo Upgrades: `" + stats.no_upgrades + "`\nNon 3-Lap: `" + stats.non_3_lap + "`\nMirrored: `" + stats.mirrored + "`", true)
                        .addField(":chart_with_upwards_trend: Gameplay Trends", "**Most Played Pod:** \n" + racers[mostPod.most_name].flag + " " + racers[mostPod.most_name].name + " `" + mostPod.most_count + "`" +
                        "\n**Most Played Track:**\n" + tracks[mostTrack.most_name].name + " `" + mostTrack.most_count + "`" +
                        "\n**Most Played Planet:**\n" + planets[mostPlanet.most_name].name + " `" + mostPlanet.most_count + "`" +
                        "\n**Most Played Circuit:**\n" + circuits[mostCircuit.most_name].name + " `" + mostCircuit.most_count + "`", true)
                } else {
                    profileEmbed
                        .addField(":bar_chart: Challenge Stats", "No challenge data", true)
                        .addField(":chart_with_upwards_trend: Gameplay Trends", "No gameplay data", true)
                }
                var feedbacktrend = ""
                if(hasliked){
                    feedbacktrend += "**Most Liked Pod:** \n" + racers[likePod.most_name].flag+ " " + racers[likePod.most_name].name + " `👍" + likePod.most_count + "`" +
                    "\n**Most Liked Track:**\n" + tracks[likeTrack.most_name].name + " `👍" + likeTrack.most_count + "`\n"
                }
                if(hasdisliked){
                    feedbacktrend += "**Most Disliked Pod:**\n" + racers[dislikePod.most_name].flag + " " + racers[dislikePod.most_name].name + " `👎" + dislikePod.most_count + "`" +
                    "\n**Most Disliked Track:**\n" + tracks[dislikeTrack.most_name].name + " `👎" + dislikeTrack.most_count + "`"
                }
                if(feedbacktrend == ""){
                    feedbacktrend = "No feedback data"
                }
                profileEmbed
                .addField(":pencil: Feedback Trends", feedbacktrend, true)
                var achieved = ["", "", "", "", "", "", ""]
                if(Object.keys(achievements.galaxy_famous.collection).length == 25){
                    achieved[0] = ":white_check_mark: "
                }
                if(Object.keys(achievements.pod_champ.collection).length == 23){
                    achieved[1] = ":white_check_mark: "
                }
                if(Object.keys(achievements.light_skipper.collection).length == 15){
                    achieved[2] = ":white_check_mark: "
                }
                if(Object.keys(achievements.slow_steady.collection).length == 23){
                    achieved[3] = ":white_check_mark: "
                }
                if(Object.keys(achievements.crowd_favorite.collection).length == 25){
                    achieved[4] = ":white_check_mark: "
                }
                if(Object.keys(achievements.true_jedi.collection).length == 575){
                    achieved[5] = ":white_check_mark: "
                }

                profileEmbed.addField(":trophy: Achievements", achieved[0] + "**Galaxy Famous** - Complete a challenge on every track: `" + Object.keys(achievements.galaxy_famous.collection).length + "/25`" + 
                "\n" + achieved[1] + "**Pod Champ** - Complete a challenge with every pod: `" + Object.keys(achievements.pod_champ.collection).length + "/23`" +
                "\n" + achieved[2] + "**Lightspeed Skipper** - Complete a Skip challenge on every track with a skip: `" + Object.keys(achievements.light_skipper.collection).length + "/15`" +
                "\n" + achieved[3] + "**Slow 'n Steady** - Complete a No Upgrades challenge with every pod: `" + Object.keys(achievements.slow_steady.collection).length + "/23`" +
                "\n" + achieved[4] + "**Crowd Favorite** - Complete a challenge as the track favorite on every track: `" + Object.keys(achievements.crowd_favorite.collection).length + "/25`" +
                "\n" + achieved[5] + "**True Jedi** - Complete a challenge with every pod on every track: `" + Object.keys(achievements.true_jedi.collection).length + "/575`" +
                "\n" + "**Big-Time Swindler** - Earn or spend 1,000,000 total truguts: `" + "x" + "/1,000,000`", true)
                .setFooter("/challenge")
            client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 3,
                    data: {
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
                        embeds: [challengeHelpEmbed]
                    }
                }
            })
        } else if (args[0].name =="leaderboard") {
            const tools = require('./../tools.js');
            const Discord = require('discord.js');
            const challengeReport = new Discord.MessageEmbed()
                .setFooter("/challenge")
            var trak = null
            var showall = false
            var desc = []
            //filters out other tracks
            for (let i = 0; i<args[0].options.length; i++) {
                
                if (args[0].options[i].name == "track") {
                    var input = args[0].options[i].value.toLowerCase()
                    for(let i = 0; i<tracks.length; i++){
                        if(input == tracks[i].name.toLowerCase() || input == tracks[i].name.toLowerCase().replace(/ /g, '')){
                            trak = i
                            i = tracks.length
                        }
                        if(i<tracks.length){
                            tracks[i].nickname.forEach(nick => {
                                if(nick.toLowerCase() == input){
                                    trak = i
                                    i = tracks.length
                                }
                            })    
                        }
                    }
                    challengeReport
                        .setTitle(tracks[trak].name + " | Challenge Times")
                        .setColor(planets[tracks[trak].planet].color)
                    var challenge = Object.values(challengedata)
                    var challengefiltered = challenge.filter(element => element.track == trak)
                } else if (args[0].options[i].name == "skips") {
                    var input = args[0].options[i].value.toLowerCase()
                    if(input == "skips"){
                        challengefiltered = challengefiltered.filter(element => element.skips == true)
                        desc.push("Skips")
                    } else if (input == "ft"){
                        challengefiltered = challengefiltered.filter(element => element.skips == false)
                        desc.push("Full Track")
                    }
                } else if (args[0].options[i].name == "upgrades") {
                    var input = args[0].options[i].value.toLowerCase()
                    if(input == "mu"){
                        challengefiltered = challengefiltered.filter(element => element.nu == false)
                        desc.push("Upgrades")
                    } else if (input == "nu"){
                        challengefiltered = challengefiltered.filter(element => element.nu == true)
                        desc.push("No Upgrades")
                    }
                } else if (args[0].options[i].name == "pod") {
                    var input = args[0].options[i].value.toLowerCase()
                    var podfilter = args[0].options[i].value.split(/[\s,]+/)
                    var filterin = true
                    for (var p = 0; p < podfilter.length; p++){
                        if(podfilter[p] == "no"){
                            filterin = false
                        } else {
                            var numb = null
                            for(let q = 0; q<racers.length; q++){
                                racers[q].nickname.forEach(nick => {
                                    if(nick.toLowerCase() == podfilter[p].toLowerCase()){
                                        numb = q
                                        q = racers.length
                                    }
                                })     
                            }
                            if (numb !== null){
                                if(filterin){
                                    challengefiltered = challengefiltered.filter(element => element.racer == numb)
                                    desc.push(racers[numb].name + " Only")
                                } else {
                                    challengefiltered = challengefiltered.filter(element => element.racer !== numb)
                                    desc.push("No " + racers[numb].name)
                                }
                            }
                        }
                    }
                } else if (args[0].options[i].name == "laps") {
                    var input = args[0].options[i].value
                    challengefiltered = challengefiltered.filter(element => element.laps == input)
                    if(input == 1){
                        desc.push("1 Lap")
                    } else {
                        desc.push( input + " Laps")
                    }
                    
                } else if (args[0].options[i].name == "mirrored") {
                    var input = args[0].options[i].value
                    if(input == "mirrored"){
                        challengefiltered = challengefiltered.filter(element => element.mirror == true)
                        desc.push("Mirrored")
                    } else if(input == "unmirrored"){
                        challengefiltered = challengefiltered.filter(element => element.mirror == false)
                        desc.push("Unmirrored")
                    }
                    
                } else if (args[0].options[i].name == "player") {
                    var player = args[0].options[i].value
                    challengefiltered = challengefiltered.filter(element => element.user == player)
                    showall = true
                    const Guild = client.guilds.cache.get(interaction.guild_id);
                    const Member = Guild.members.cache.get(player)
                    challengeReport.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guild_id).members.resolve(player).user.avatarURL())
                }
            }      
            challengefiltered.sort(function(a,b) {
                return a.time-b.time;
            })
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            if (trak !== null) {
                var j = 0
                var players = []
                
                if (challengefiltered.length > 0) {
                    for (i=0; i<5;){
                        var skip = false
                        for (k = 0; k < players.length; k++) {
                            if (challengefiltered[j].player + challengefiltered[j].skips + challengefiltered[j].racer + challengefiltered[j].nu + challengefiltered[j].laps == players[k] && !showall) {
                                skip = true
                            }
                        }
                        if (skip == false) {
                            var character = ""
                            var skps = "FT | "
                            var upgr = " | MU"
                            var mirr = ""
                            var laps = "3 Laps "
                            if (challengefiltered[j].skips == true) {
                                skps = "Skips | "
                            }
                            if (challengefiltered[j].nu == true) {
                                upgr = " | NU"
                            }
                            if (challengefiltered[j].mirror == true) {
                                mirr = "| Mirrored "
                            }
                            character = racers[challengefiltered[j].racer].flag + " " + racers[challengefiltered[j].racer].name
                            if (challengefiltered[j].laps !== 3){
                                laps = challengefiltered[j].laps + " Laps "
                            }
                            challengeReport
                                .addField(pos[i] + " " + challengefiltered[j].name, skps + laps + mirr, true)
                                .addField(tools.timefix(Number(challengefiltered[j].time).toFixed(3))," " + character + upgr, true)
                                .addField('\u200B', '\u200B', true)
                            players.push(challengefiltered[j].player + challengefiltered[j].skips + challengefiltered[j].racer + challengefiltered[j].nu + challengefiltered[j].laps)
                            i++
                        }
                        j++
                        if (j == challengefiltered.length) {
                            i = 5
                        }
                    }
                    challengeReport.setDescription(desc.join(', ') + " [" + challengefiltered.length + " Total Runs]")
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 3,
                            data: {
                                //content: "",
                                embeds: [challengeReport]
                            }
                        }
                    })
                } else {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                content: "`Error: No challenge runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                                //embeds: [racerEmbed]
                            }
                        }
                    })
                }
            } else {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: Track not found`\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)],
                            //embeds: [racerEmbed]
                        }
                    }
                })
            }
        }
    }   
}