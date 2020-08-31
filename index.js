const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();
var lookup = require("./data.js");

const fs = require('fs');

const fetch = require('node-fetch');

client.once('ready', () => {
    console.log('Ready!')
    //set bot activity
    client.user.setActivity("Star Wars: Episode I - Racer")
})


client.on("messageDelete", (messageDelete) => {
    if (messageDelete.author.bot == false && messageDelete.channel.type == "text") {
        console.log(`${messageDelete.author.tag} deleted the following message from ${messageDelete.channel}: \n${messageDelete.content}`)
        client.users.get("256236315144749059").send(`${messageDelete.author.tag} deleted the following message from ${messageDelete.channel}: \n${messageDelete.content}`);
    }
   });

client.on('messageUpdate', (oldMessage, newMessage) => {
    if (oldMessage.author.bot == false && oldMessage.channel.type == "text") {
        console.log(`${newMessage.author.tag} edited a message in ${oldMessage.channel}\n Before:\n ${oldMessage.content} \n After:\n ${newMessage.content}`)
        client.users.get("256236315144749059").send(`${newMessage.author.tag} edited a message in ${oldMessage.channel}\n Before:\n ${oldMessage.content} \n After:\n ${newMessage.content}`);
    }
});

// when a user joins/leaves a voice channel
client.on('voiceStateUpdate', (oldMember, newMember) => {

    let newUserChannel = newMember.voiceChannel
    let oldUserChannel = oldMember.voiceChannel
    var chan = client.channels.get('441840193754890250');
    
    //get list of members in voice channel
    
    if(chan !== undefined){
        var mems = chan.members;
        var arr = [];
        for (let [snowflake, guildMember] of mems){
            if(guildMember.displayName !== "Botto"){
                arr.push(guildMember)
            }
            
        }
        
    }

    //if member joins Multiplayer Lobby 1
    if(oldUserChannel === undefined && newUserChannel.id == 441840193754890250 && newMember.id !== "545798436105224203") {
        //random welcome message based on how many members are in voice channel
       if (arr.length == 1) {
            var random = Math.floor(Math.random()*2)
       } else if(arr.length == 2) {
            var random = Math.floor(Math.random()*3)+2
       } else if(2 < arr.length < 5 ) {
            var random = Math.floor(Math.random()*9)+5
       } else if(4 < arr.length < 8 ) {
            var random = Math.floor(Math.random()*6)+14
        } else if(7 < arr.length) {
            var random = Math.floor(Math.random()*4)+17}
       var str = welcomeMessages[random]
       client.channels.get("551786988861128714").send(str.replace("replaceme", newMember))
       random = Math.floor(Math.random()*voiceWelcome.length)
       // playSfx2(newUserChannel.id,voiceWelcome[random])

    
       const voicecon = client.guilds.get("441839750555369474")
       if ((voicecon.voiceConnection !== null)) {
            const channel = client.channels.get("441840193754890250");
            channel.join()
                .then(connection => { // Connection is an instance of VoiceConnection
                const dispatcher = connection.playFile(voiceWelcome[random]);
                dispatcher.setVolume(0.2);
                dispatcher.on('end', () => {
                    connection.disconnect
                });
                //dispatcher.on('error', e => {
                    // Catch any errors that may arise
                //  console.log(e);
                //});
                
                })
                .catch(console.log);
            }
        
    } 
    //if member is already in any voice channel
    if(oldUserChannel !== undefined){ 
        //member leaves multiplayer or troubleshooting channel
        const voicecon = client.guilds.get("441839750555369474")
        if(voicecon.voiceConnection !== null){
        if((oldUserChannel.id == 441840193754890250 || oldUserChannel.id == 441840753111597086) && newUserChannel === undefined){ 
            random = Math.floor(Math.random()*goodbyeMessages.length)
            random2 = Math.floor(Math.random()*voiceFarewell.length)
            var str = goodbyeMessages[random]
            client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
            //playSfx2(oldUserChannel.id,voiceFarewell[random2])


            const voicecon = client.guilds.get("441839750555369474")
            if ((voicecon.voiceConnection !== null)) {
            const channel = client.channels.get("441840193754890250");
            channel.join()
                .then(connection => { // Connection is an instance of VoiceConnection
                const dispatcher = connection.playFile(voiceFarewell[random2]);
                dispatcher.setVolume(0.2);
                dispatcher.on('end', () => {
                    connection.disconnect
                });
                //dispatcher.on('error', e => {
                    // Catch any errors that may arise
                //  console.log(e);
                //});
                
                })
                .catch(console.log);
            }
        }
    }
        //member is moving from one channel to another
        if(newUserChannel !== undefined) {
            //member moves from multiplayer to troubleshooting
            if(oldUserChannel.id == 441840193754890250 && newUserChannel.id == 441840753111597086 && newMember.id !== "288258590010245123" && newMember.id !==545798436105224203) {
                random = Math.floor(Math.random()*troubleShooting.length)
                random2 = Math.floor(Math.random()*voiceTrouble.length)
                var str = troubleShooting[random]
                client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
                //playSfx2(oldUserChannel.id,voiceTrouble[random2])

                const voicecon = client.guilds.get("441839750555369474")

            if ((voicecon.voiceConnection !== null)) {
                const channel = client.channels.get("441840193754890250");
                channel.join()
                    .then(connection => { // Connection is an instance of VoiceConnection
                    const dispatcher = connection.playFile(voiceTrouble[random2]);
                    dispatcher.setVolume(0.2);
                    dispatcher.on('end', () => {
                        connection.disconnect
                    });
                    //dispatcher.on('error', e => {
                        // Catch any errors that may arise
                    //  console.log(e);
                    //});
                    
                    })
                    .catch(console.log);
                }

        }
        //Renegawd moves from troubleshooting to multiplayer
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id == "288258590010245123") { 
            client.channels.get("551786988861128714").send("*Wouldn't have lasted long if <@288258590010245123> wasn't so good at fixing things.*")
        }
        //member moves back from troubleshooting to multiplayer
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id !== "288258590010245123" && newMember.id !== 545798436105224203) { 
            random = Math.floor(Math.random()*fixed.length)
            random2 = Math.floor(Math.random()*voiceFixed.length)
            var str = fixed[random]
            client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
            //playSfx2(newUserChannel.id,voiceFixed[random2])

            const voicecon = client.guilds.get("441839750555369474")
            if ((voicecon.voiceConnection !== null)) 
                {
                const channel = client.channels.get("441840193754890250");
                channel.join()
                    .then(connection => { // Connection is an instance of VoiceConnection
                    const dispatcher = connection.playFile(voiceFixed[random2]);
                    dispatcher.setVolume(0.2);
                    dispatcher.on('end', () => {
                    connection.disconnect
                    });
                //dispatcher.on('error', e => {
                    // Catch any errors that may arise
                //  console.log(e);
                //});
                
                })
                .catch(console.log);
            }
        }
        }
    }
})


client.on('message', message => {
if(message.author.bot) return;
var args = message.content.slice(prefix.length).trim().split(/ +/g);
var command = args.shift().toLowerCase();
var messageText = message.content
var messageLow = messageText.toLowerCase()
var random2 = Math.floor(Math.random()*2) //1 in # chances of using playerPicks instead of movieQuotes
var random3 = Math.floor(Math.random()*movieQuotes.length)
var random5 = Math.floor(Math.random()*playerPicks.length)
var chan = client.channels.get('441840193754890250');

//get list of members in voicechannel
if(chan !== undefined && message.channel.type !== "dm"){
    var mems = chan.members;
    var arr = [];
    for (let [snowflake, guildMember] of mems){
        if(guildMember.displayName !== "Botto"){
        arr.push(guildMember)
        }
        
    }
    //get random member from voicechannel
    var pickedPlayer = arr[Math.floor(Math.random()*arr.length)]
}

var myformat = new Intl.NumberFormat('en-US', { 
    minimumIntegerDigits: 2, 
    minimumFractionDigits: 3 
});

function timefix(time) {
    if (time >= 3600) {
        var hours = Math.floor(time/3600)
        var minutes = Math.floor((time-hours*3600)/60)
        if (minutes < 10) {
            minutes = "0" + minutes
        }
        var seconds = time - hours*3600 - minutes * 60
        return hours.toString() + ":" + minutes.toString() + ":" + myformat.format(seconds)
    } else if (time >= 60) {
        var minutes = Math.floor(time/60)
        var seconds = time - minutes * 60
        return minutes.toString() + ":" + myformat.format(seconds)
    } else {
        return time
    }
}

if (messageLow.startsWith(`${prefix}src`)) {
    var catg = "" 
    var titl = ""
    for (let i =0; i<25; i++) {
        var nname = tracks[i].nickname
        for (var y of nname) {
            y = "" + y
            if (args[0].toLowerCase() == y) {
                var numb = i
            }
        }
    }   
    if (numb == null) {
        if (args[0] == "any" || args[0] == "any%"){
            catg = "category/xk9634k0"
            titl = "Any%"
        } else if (args[0] == "100" || args[0] == "100%") {
            catg = "category/n2yqxo7k"
            titl = "100%"
        } else if (args[0] == "amc" || args[0] == "amateur") {
            catg = "category/7dg8ywp2"
            titl = "Amateur Circuit"
        } else if (args[0] == "spc" || args[0] == "semi-pro") {
            catg = "category/mkeoyg6d"
            titl = "Semi-Pro Circuit"
        } else if (args[0] == "ng+" || args[0] == "newgame") {
            catg = "category/w20zml5d"
            titl = "All Tracks NG+"
        } 
    } else {
        catg = "level/"  + tracks[numb].id + "/824owmd5" //default to 3 lap
        titl = tracks[numb].name + " | 3-Lap"
    }
    var upgr = ""
    var skps = ""
    var plat = ""
    var platname = ""
    var desc = ""
    var sys = [{"name" : "PC", "id": "zqoe6ply"}, {"name":"N64", "id":"013kndq5"},{"name" : "DC", "id" : "rqv25716"}, {"name":"Switch", "id":"jqz7nnkl"},{"name":"PS4", "id":"klrw33w1"}]
    for (let c = 1; c < args.length; c++) {
        if (args[c] == "no") {
            if (args[c+1] == "upgrades") {
                if (numb == null) { 
                    upgr = "&var-789k45lw=9qjzj014" //full game categories
                } else {
                    upgr = "&var-789k49lw=z194gjl4"
                }
            }
            if (args[c+1] == "skips" || args[c+1] == "skip") {
                if (numb == null) { 
                    skps = "&var-onv6p08m=5lmxzy1v" //full game categories
                } else {
                    skps = "&var-2lgz978p=81p7we17"
                }
            }
        } else if(args[c] == "nu") {
            if (numb == null) { 
                upgr = "&var-789k45lw=9qjzj014" //full game categories
            } else {
                upgr = "&var-789k49lw=z194gjl4"
            }
        } else if (args[c] == "mu" && upgr == "") {
            if (numb == null) { 
                upgr = "&var-789k45lw=gq7nen1p" //full game categories
            } else {
                upgr = "&var-789k49lw=xqkrk919"
            }
        } else if ((args[c] == "skips" || args[c] == "skip") && skps == "") {
            if (numb == null) { 
                skps = "&var-onv6p08m=21gjrx1z" //full game categories
            } else {
                skps = "&var-2lgz978p=p125ev1x"
            }
        } else if(args[c] == "ns") {
            if (numb == null) { 
                skps = "&var-onv6p08m=5lmxzy1v" //full game categories
            } else {
                skps = "&var-2lgz978p=81p7we17"
            }
        } else if (args[c] == "1lap" || args[c] == "flap" || args[c] == "1-lap") {
            catg = "level/"  + tracks[numb].id + "/9d8wr6dn"
            titl = tracks[numb].name + " | 1-Lap"
        } else {
            for (u = 0; u < sys.length; u++) {
                if (args[c].toLowerCase() == sys[u].name.toLowerCase()) {
                    plat = "&var-wl39wwl1=" + sys[u].id
                    platname = sys[u].name
                }
            }
        }
    }
    if (upgr == "&var-789k49lw=z194gjl4" || upgr == "&var-789k45lw=9qjzj014") {
        desc = "No Upgrades, "
    } else {
        desc = "Upgrades, "
    }
    if (skps == "&var-2lgz978p=81p7we17" ||  skps == "&var-onv6p08m=5lmxzy1v") {
        desc = desc + "No Skips, "
    } else {
        desc = desc + "Skips, "
    }
    if (platname == "") {
        desc = desc + "All Platforms"
    } else {
        desc = desc + platname
    }
    let url = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/' + catg + "?top=5&embed=players" + upgr + skps + plat
    console.log(url)
    let settings = {method: "Get"}
    async function getsrcData() {
        try {
          const response = await fetch(url);
          const data = await response.json();
          console.log (data)
          var src = data.data
          const srcReport = new Discord.RichEmbed()
          .setColor('#0099ff')
          //.setThumbnail("https://www.speedrun.com/themes/Default/1st.png")
          .setTitle(titl)
          .setURL(src.weblink)
          .setDescription(desc)
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            var numberofruns = data.data.runs.length
            if (numberofruns > 5) {
                numberofruns = 5
            }
            for (let k =0; k<numberofruns; k++) {
                var name = ""
                if (numb == null) {
                    var upgrades = "MU"
                } else {
                    var upgrades = " / MU"
                }
                var skips = ""
                var system = ""
                var character = ""
                var country = ""
                var time = data.data.runs[k].run.times.primary_t
                var vid = data.data.runs[k].run.videos.links[0].uri
                time = timefix(time)
                if (src.players.data[k].hasOwnProperty("names")) {
                    name = src.players.data[k].names.international
                } else {
                    name = src.players.data[k].name
                }
                if (src.runs[k].run.values["789k49lw"] == "z194gjl4" || src.runs[k].run.values["789k45lw"] == "9qjzj014") {
                    if (numb == null) {
                        upgrades = "NU"
                    }else {
                        upgrades = " / NU"
                    }
                    
                }
                if (src.runs[k].run.values["2lgz978p"] == "p125ev1x" || src.runs[k].run.values["onv6p08m"] == "21gjrx1z") {
                    skips = " / Skips"
                }
                for (let j = 0; j<23; j++){
                    if (src.runs[k].run.values.j846d94l == racers[j].id) {
                        if (racers[j].hasOwnProperty("flag")) {
                            character = racers[j].flag
                        } else {
                            character = racers[j].name
                        }
                    }
                } 
                for (let j = 0; j<5; j++) {
                    if (src.runs[k].run.values.wl39wwl1 == sys[j].id) {
                        system = "   " + sys[j].name
                    }
                }
                if (data.data.players.data[k].hasOwnProperty("location")) {
                    if (data.data.players.data[k].location !== null) {
                        country = ":flag_" + data.data.players.data[k].location.country.code.substring(0, 2) + ":"
                    }
                }
                srcReport.addField(
                    pos[k] + " " + name,  country + system, true
                )
                srcReport.addField(
                    time," " + character + "[" + upgrades + skips + "](" + vid + ")", true
                )
                srcReport.addField(
                    '\u200B', '\u200B', true
                )
            }
            message.channel.send(srcReport)
        } catch (error) {
          console.log(error);
          message.channel.send("Sorry, speedrun.com is under too much pressure.")
        }
      };
      
    getsrcData()
    
    
}

if (messageLow.startsWith(`${prefix}random`)) {
    if (args == "" | isNaN(args)) {
        message.reply("You must include a number.")
    } else {
        
        var randomnum = (Math.floor(Math.random()*args) + 1)
    message.reply(randomnum)
    }
}

/////   !track   /////
if(messageLow.startsWith(`${prefix}track`)){
    args = args.join().replace(/,/g, '').replace(/time/g, '').toString()

    if(messageLow == (`${prefix}track`)) {
        var numb = Math.floor(Math.random()*25)}
    if(args == (`amc`) || args == (`amateur`)) {
        var numb = Math.floor(Math.random()*7)}
    if(args == (`spc`) || args==(`semi`)) {
        var numb = Math.floor(Math.random()*7) + 7}
    if(args == (`gal`)) {
        var numb = Math.floor(Math.random()*7) + 14}
    if(args == (`inv`)) {
        var numb = Math.floor(Math.random()*4) + 21}
    if(args.replace(/\s/g, '') == (`andoprime`)){
        let planet = [2, 8, 17, 21]
        var numb = planet[Math.floor(Math.random()*4)]}
    if(args == (`aquilaris`)) {
        let planet = [3, 7, 13]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(args == (`baroonda`)) {
        let planet = [12, 16, 19, 24]
        var numb = planet[Math.floor(Math.random()*4)]}
    if(args == (`malastare`)) {
        let planet = [4, 9, 15]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(args.replace(/\s/g, '') == (`mongazza`)){
        let planet = [1, 6, 11]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(args.replace(/\s/g, '') == (`oovoiv`)){
        let planet = [5, 14, 23]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(args.replace(/\s/g, '') == (`ordibanna`)) {
        let planet = [10, 18, 22]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(args == (`tatooine`)) {
        let planet = [0, 20]
        var numb = planet[Math.floor(Math.random()*2)]}
    if(numb == null){
        for (let i =0; i<25; i++) {
            if (args == tracks[i].name.toLowerCase().replace(/\s/g, '')) {
                var numb = i
            } else {
                var nname = tracks[i].nickname
                for (let y of nname) {
                    y = "" + y
                    y.replace(/\s/g, '')
                    if (args.toLowerCase() == y) {
                        var numb = i
                    }
                }
            }
        }   
    }
    if(numb == null){ 
        message.channel.send("Perhaps the archives are incomplete.")
    }
    else{
        const trackEmbed = new Discord.RichEmbed()
        .setThumbnail(planets[tracks[numb].planet].img)
        .setColor(planets[tracks[numb].planet].color)
        .setImage(tracks[numb].img)
        .setTitle(tracks[numb].name)
    
        var str = playerPicks[random5]
        var description = planets[tracks[numb].planet].name + "\n" + circuits[tracks[numb].circuit].name + " Circuit: Race #" + tracks[numb].cirnum + "\n"  + "Track Favorite: " + tracks[numb].favorite
        //if(tracks[numb].skip !== "") {
        //    description = description + "\n" + "Click :track_next: to view skip"
        //}
        //if(tracks[numb].shortcut !== "") {
        //    description = description + "\n" + "Click :fast_forward: to view shortcut"
        //}
        if((pickedPlayer !== undefined) && (random2 == 0)) {
            //description =  description + "\n \n" +  str.replace("replaceme", pickedPlayer).replace("replaceme", pickedPlayer)
        } else {
            //description = description + "\n \n" + movieQuotes[random3]
        }
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
                    trackEmbed.addField("Skips WR", character + " " + name + "\n[" + timefix(sk.runs[0].run.times.primary_t) + "](" + vid + ")",true)
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
            trackEmbed.addField("MU WR", character + " " + name + "\n[" + timefix(mu.runs[0].run.times.primary_t) + "](" + vid + ")", true)
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
            trackEmbed.addField("NU WR", character + " " + name + "\n[" + timefix(nu.runs[0].run.times.primary_t) + "](" +  vid+ ")",true)
            
            
            message.channel.send(trackEmbed).then(sentMessage => {
            
                sentMessage.react('⏱️').then(() => {
                    const filter = (reaction, user) => {
                        return ['⏱️'].includes(reaction.emoji.name) && user.id !== "545798436105224203";
                    };
                    sentMessage.awaitReactions(filter, { max: 1})
                        .then(collected => {
                            const reaction = collected.first();
                            if (reaction.emoji.name === '⏱️' && reaction.users.id !== "545798436105224203") {
                                const tracktimesEmbed = new Discord.RichEmbed()
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
        /*message.channel.send(trackEmbed).then(sentMessage => {
            if(tracks[numb].skip !== "") {
                sentMessage.react(':stopwatch:').then(() => {
                    const filter = (reaction, user) => {
                        return [':stopwatch:'].includes(reaction.emoji.name) && user.id !== "545798436105224203";
                    };
                    sentMessage.awaitReactions(filter, { max: 1})
                        .then(collected => {
                            const reaction = collected.first();
                            if (reaction.emoji.name === ':stopwatch:' && reaction.users.id !== "545798436105224203") {
                                const tracktimesEmbed = new Discord.RichEmbed()
                                .setColor(planets[tracks[numb].planet].color)
                                .setTitle("[" + tracks[numb].name + " | MU/No Skip Par Times](" + https://docs.google.com/spreadsheets/d/1TwDtG6eOyiQZEZ3iTbZaEmthe5zdf9YEGJ-1tfFfQKg/edit?usp=sharing +")")
                                .addField("3-Lap", ":trophy: " + tracks[numb].partimes[0] + "\n:first_place: " + tracks[numb].partimes[1] + "\n:second_place: " + tracks[numb].partimes[2] + "\n:third_place: " + tracks[numb].partimes[3] + "\n:bumpythumb: " + tracks[numb].partimes[4], true)
                                .addField("1-Lap", ":trophy: " + tracks[numb].parlaptimes[0] + "\n:first_place: " + tracks[numb].parlaptimes[1] + "\n:second_place: " + tracks[numb].parlaptimes[2] + "\n:third_place: " + tracks[numb].parlaptimes[3] + "\n:bumpythumb: " + tracks[numb].parlaptimes[4], true)
                                sentMessage.channel.send(tracktimesEmbed);
                            } 
                        })
                })
            }
        }) */
        
    }



        random = Math.floor(Math.random()*voiceGeneral.length)
        //playSfx(message, voiceGeneral[random]);
    }

    
/////    !racer     //////       

if(messageLow.startsWith(`${prefix}racer`) && !messageLow.startsWith(`${prefix}racers`)) {
    if(message.content == (`${prefix}racer`)) {
        var numb = Math.floor(Math.random()*23)}
    if(
    message.content == (`${prefix}racer canon`)) {
        let canon = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19]
        var numb = canon[Math.floor(Math.random()*18)]}
    if(
    message.content == (`${prefix}racer noncanon`)) {
        let canon = [15, 18, 20, 21, 22]
        var numb = canon[Math.floor(Math.random()*5)]}
    if(
        messageLow.startsWith(`${prefix}racer top`) || messageLow == (`${prefix}racer s`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 4){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    if(
        messageLow.startsWith(`${prefix}racer high`) || messageLow == (`${prefix}racer a`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 3){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    if(
        messageLow.startsWith(`${prefix}racer mid`) || messageLow == (`${prefix}racer b`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 2){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    if(
        messageLow.startsWith(`${prefix}racer low`) || messageLow == (`${prefix}racer f`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 1){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    
    if(
    messageLow.startsWith(`${prefix}racer as`) || 
    messageLow.startsWith(`${prefix}racer anakin`) || 
    messageLow.startsWith(`${prefix}racer skywalker`)) {
        var numb = 0}
    if(
    messageLow.startsWith(`${prefix}racer tp`) || 
    messageLow.startsWith(`${prefix}racer teemto`) || 
    messageLow.startsWith(`${prefix}racer pagalies`)) {
        var numb = 1}
    if(
    messageLow.startsWith(`${prefix}racer seb`) || 
    messageLow.startsWith(`${prefix}racer sb`) || 
    messageLow.startsWith(`${prefix}racer sebulba`)) {
        var numb = 2}
    if(
    messageLow.startsWith(`${prefix}racer rt`) || 
    messageLow.startsWith(`${prefix}racer ratts`) || 
    messageLow.startsWith(`${prefix}racer tyerell`)){
        var numb = 3}
    if(
    messageLow.startsWith(`${prefix}racer ab`) || 
    messageLow.startsWith(`${prefix}racer aldar`) || 
    messageLow.startsWith(`${prefix}racer beedo`)) {
        var numb = 4}
    if(
    messageLow.startsWith(`${prefix}racer mh`) || 
    messageLow.startsWith(`${prefix}racer mawhonic`) || 
    messageLow.startsWith(`${prefix}racer maw`)) {
        var numb = 5}
    if(
    messageLow.startsWith(`${prefix}racer ar`) || 
    messageLow.startsWith(`${prefix}racer ark`) || 
    messageLow.startsWith(`${prefix}racer bumpy`) || 
    messageLow.startsWith(`${prefix}racer roose`)) {
        var numb = 6}
    if(
    messageLow.startsWith(`${prefix}racer ws`) || 
    messageLow.startsWith(`${prefix}racer wan`) || 
    messageLow.startsWith(`${prefix}racer sandage`) ||
    messageLow.startsWith(`${prefix}racer sandwich`)) {
        var numb = 7}
    if(
    messageLow.startsWith(`${prefix}racer mg`) || 
    messageLow.startsWith(`${prefix}racer mars`) || 
    messageLow.startsWith(`${prefix}racer guo`)) {
        var numb = 8}
    if(
    messageLow.startsWith(`${prefix}racer ee`) || 
    messageLow.startsWith(`${prefix}racer ebe`) || 
    messageLow.startsWith(`${prefix}racer endocott`)) {
        var numb = 9}
    if(
    messageLow.startsWith(`${prefix}racer db`) || 
    messageLow.startsWith(`${prefix}racer dud`) || 
    messageLow.startsWith(`${prefix}racer bolt`)) {
        var numb = 10}
    if(
    messageLow.startsWith(`${prefix}racer g`) || 
    messageLow.startsWith(`${prefix}racer gg`) ||  
    messageLow.startsWith(`${prefix}racer gas`)) {
        var numb = 11}
    if(
    messageLow.startsWith(`${prefix}racer ch`) || 
    messageLow.startsWith(`${prefix}racer clegg`) || 
    messageLow.startsWith(`${prefix}racer holdfast`)) {
        var numb = 12}
    if(
    messageLow.startsWith(`${prefix}racer em`) || 
    messageLow.startsWith(`${prefix}racer elan`) || 
    messageLow.startsWith(`${prefix}racer mak`)) {
        var numb = 13}
    if(
    messageLow.startsWith(`${prefix}racer nk`) || 
    messageLow.startsWith(`${prefix}racer neva`) || 
    messageLow.startsWith(`${prefix}racer kee`)) {
        var numb = 14}
    if(
    messageLow.startsWith(`${prefix}racer bb`) || 
    messageLow.startsWith(`${prefix}racer bozzie`) || 
    messageLow.startsWith(`${prefix}racer baranta`)) {
        var numb = 15}
    if(
    messageLow.startsWith(`${prefix}racer br`) || 
    messageLow.startsWith(`${prefix}racer boles`) || 
    messageLow.startsWith(`${prefix}racer roor`)) {
        var numb = 16}
    if(
    messageLow.startsWith(`${prefix}racer om`) || 
    messageLow.startsWith(`${prefix}racer ody`) || 
    messageLow.startsWith(`${prefix}racer mandrell`)) {
        var numb = 17}
    if(
    messageLow.startsWith(`${prefix}racer fs`) || 
    messageLow.startsWith(`${prefix}racer fud`) || 
    messageLow.startsWith(`${prefix}racer sang`)) {
        var numb = 18}
    if(
    messageLow.startsWith(`${prefix}racer bq`) || 
    messageLow.startsWith(`${prefix}racer ben`) || 
    messageLow.startsWith(`${prefix}racer quadinaros`) || 
    messageLow.startsWith(`${prefix}racer god`)) {
        var numb = 19}
    if(
    messageLow.startsWith(`${prefix}racer sp`) || 
    messageLow.startsWith(`${prefix}racer slide`) || 
    messageLow.startsWith(`${prefix}racer paramita`)) {
        var numb = 20}
    if(
    messageLow.startsWith(`${prefix}racer td`) || 
    messageLow.startsWith(`${prefix}racer toy`) || 
    messageLow.startsWith(`${prefix}racer dampner`)) {
        var numb = 21}
    if(
    messageLow.startsWith(`${prefix}racer bn`) || 
    messageLow.startsWith(`${prefix}racer bullseye`) || 
    messageLow.startsWith(`${prefix}racer navior`)) {
        var numb = 22}
    
    if(numb == undefined && messageLow.startsWith(`${prefix}racers`) == false){
        message.channel.send("Perhaps the archives are incomplete.")
        //playSfx(message, voiceError[Math.floor(Math.random()*voiceError.length)])
    }
    else{
        var racerFooter = racers[numb].footer
        var Tier = ["Low", "Mid", "High", "Top"]
        const racerEmbed = new Discord.RichEmbed()
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .addField("Tier", Tier[racers[numb].tier -1], true)
            if (racers[numb].hasOwnProperty("species")){
                racerEmbed.addField("Species/Homeworld", racers[numb].species, true)
            }
            racerEmbed.addField("Pod", racers[numb].Pod, true)
            racerEmbed.setImage(racers[numb].stats)
        message.channel.send(racerEmbed);
        //playSfx(message, racers[numb].announce)
    }
}

if(messageLow.startsWith(`${prefix}racers`) && message.channel.type !== "dm"){
    if(arr.length > 0){
        if(messageLow == (`${prefix}racers`)){
            
            var assignRacers = ""
            var arrayLength = arr.length;
            for (var i = 0; i < arrayLength; i++) {
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[Math.floor(Math.random()*23)].name + "*\n"
            }
            message.channel.send(assignRacers)

        }
        if(messageLow == (`${prefix}racers canon`)){
            
            var assignRacers = ""
            var arrayLength = arr.length;
            
            for (var i = 0; i < arrayLength; i++) {
                let canon = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19]
            var numb = canon[Math.floor(Math.random()*18)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(messageLow == (`${prefix}racers noncanon`)){
            
            var assignRacers = ""
            var arrayLength = arr.length;
            for (var i = 0; i < arrayLength; i++) {
                let noncanon = [15, 18, 20, 21, 22]
            var numb = noncanon[Math.floor(Math.random()*5)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers top`) || messageLow == (`${prefix}racers s`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel

            for (var i = 0; i < arrayLength; i++) {
                    //gather racers from given tier
                if (list.length == 0){
                    console.log("refill")
                    for (let i = 0; i < racers.length; i++) {
                        if(racers[i].tier == 4){
                            list.push(racers[i].racernum - 1)
                        }
                    }
                }
                //pick random racer
                var num = Math.floor(Math.random()*list.length)
                var numb = list[num]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
                list.splice(num, 1)
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers high`) || messageLow == (`${prefix}racers a`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;


            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
            if(list.length == 0){
                    //gather racers from given tier
                for (let i = 0; i < racers.length; i++) {
                    if(racers[i].tier == 3){
                        list.push(racers[i].racernum - 1)
                    }
                }
            }
                //pick random racer
                var num = Math.floor(Math.random()*list.length)
                var numb = list[num]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
                list.splice(num, 1)
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers mid`) || messageLow == (`${prefix}racers b`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
                if (list.length == 0){
                    //gather racers from given tier
                    for (let i = 0; i < racers.length; i++) {
                        if(racers[i].tier == 2){
                            list.push(racers[i].racernum - 1)
                        }
                    }
                }
                //pick random racer
                var num = Math.floor(Math.random()*list.length)
                var numb = list[num]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
                list.splice(num, 1)
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers low`) || messageLow == (`${prefix}racers f`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
                if (list.length == 0){
                //gather racers from given tier
                    for (let i = 0; i < racers.length; i++) {
                        if(racers[i].tier == 1){
                            list.push(racers[i].racernum - 1)
                        }
                    }
                }
                //pick random racer
                var num = Math.floor(Math.random()*list.length)
                var numb = list[num]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
                list.splice(num,1)
            }
            message.channel.send(assignRacers)
        }
    } else {
        message.channel.send("What you want? No one's in the voice channel.")
    }
    

}

/////   !challenge    //////


    if(message.content.startsWith(`${prefix}challenge`)) {
        var random1 = Math.floor(Math.random()*23)
        var random2 = Math.floor(Math.random()*25)
        var random3 = Math.floor(Math.random()*movieQuotes.length)
        message.channel.send("Race as **" + racers[random1].name + "** (" + (random1 + 1) + ") on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + "\n" + movieQuotes[random3] + " ")
    }


/////    ?help    //////


    if(message.content.toLowerCase().startsWith(`?help`) || message.content.startsWith(`${prefix}command`)) {
        const helpEmbed = new Discord.RichEmbed()
            //.setColor('#00DE45')
            //.setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            .setTitle("Botto Command List")
            .addField(":large_blue_diamond: General", "`?help` - list of commands\n" +
            "`!cleanup` - deletes command and bot messages within the past 10 messages\n" +
            "`!github` - reveals Botto github link\n" +
            "`!img` - reveals links to racer/track graphics on imgur\n" +
            "`!guide` - posts link to multiplayer setup guide\n" +
            "`!drive` - posts link to Google Drive", false)
            .addField(":busts_in_silhouette: Roles", "`!multiplayer` - adds or removes multiplayer role\n" +
            "`!speedrunning` - adds or removes speedrunning role", false)
            .addField(":trophy: Speedrun.com", "`!src <track>` - shows top 5 3-lap times for given track\n" +
            "`!src <category>` - shows top 5 times for given category (any,100,amc,spc,ng+)\n" +
            "`!src <track/category> <upgrades/nu> <skips/no skips> <pc/n64/dc/switch/ps4> <flap>` - filters leaderboard", false)
            .addField(":game_die: Randomizers", "`!racer(s)` - random racer (adding “s” rolls for all players in voice channel)\n" +
            "`!racer(s) canon` - random canon racer\n" +
            "`!racer(s) noncanon` - random noncanon racer\n" +
            "`!racer(s) <tier>` - random racer from given tier (low/f, mid/b, high/a, top/s)\n" +
            "`!track` - random track\n" +
            "`!track <circuit>` - random track from given circuit\n" +
            "`!track <planet>` - random track from given planet\n" +
            "`!challenge` - random racer + random track\n" +
            "`!teams <n>` - randomly splits members in voice channel into *n* number of teams\n" +
            "`!chancecube` - “let fate decide”\n" +
            "`!random <n>` - generates random number between 1 and *n*", false)
            .addField(":mag_right: Lookup", "`!racer <name/initials>` - look up specific racer\n" +
            "`!track <name/acronym>` - look up specific track\n"+
            "`!tier` - reveals tier list Botto uses to randomize\n" +
            "`!stat` - reveals racer stat guide\n", false)
            .addField(":microphone2: Voice", "`!join` - adds Botto to the voice channel\n" +
            "`!leave` - kicks Botto from the voice channel", false)
        message.channel.send(helpEmbed)
    }

    if(message.content.startsWith(`${prefix}stat`)) {
        const helpEmbed = new Discord.RichEmbed()
            .setColor('#00DE45')
            .setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            .setTitle("Racer Stat Guide")
            
        message.channel.send(helpEmbed)
    }


//////      MISC     ////////


if(messageLow.startsWith(`${prefix}chancecube`)){
    var numb = Math.floor(Math.random()*2)
    if(numb == 0){
        message.channel.send(":blue_square:")
    }
    else{
        message.channel.send(":red_square:")
    }
}

if(messageLow.startsWith(`${prefix}drive`)){
    message.channel.send("https://drive.google.com/drive/folders/1ScgPE1i1EpSYXT16a1ocxQiouMCcE9z1?usp=sharing")
}
if(message.content.startsWith(`${prefix}cleanup`) && message.channel.type !== "dm") {
    message.channel.fetchMessages({limit:10}).then(messages => {
        const botMessages = messages.filter(msg => msg.author.bot || msg.content.startsWith("!") || msg.content == "?help");
        message.channel.bulkDelete(botMessages);
        messagesDeleted = botMessages.array().length; // number of messages deleted

        // Logging the number of messages deleted on both the channel and console.
        message.channel.send("*I gotta lots of junk!* \n`" + messagesDeleted + " messages deleted`")
            .then(msg => {
                msg.delete(5000)
            })
            .catch()
        console.log('Deletion of messages successful. Total messages deleted: ' + messagesDeleted)
    }).catch(err => {
        console.log('Error while doing Bulk Delete');
        console.log(err);
    });
}

if(message.content.startsWith(`${prefix}github`) || message.content.startsWith(`${prefix}code`)){
    message.channel.send("https://github.com/louriccia/Botto")
}

if(message.content.startsWith(`${prefix}guide`)){
    message.channel.send("https://docs.google.com/document/d/1lxVkuT80ug0BX2LMJp5CXcMVPZneLK4unOetLU3WlQQ/edit?usp=sharing")
}

if(message.content.startsWith(`${prefix}img`) || message.content.startsWith(`${prefix}image`)){
    message.channel.send("Racers: https://imgur.com/a/uqTaaIl")
    message.channel.send("Tracks: https://imgur.com/a/im0C1Tx")
    message.channel.send("Planets: https://imgur.com/a/G5yhapp")
}


//if(messageLow.includes("botto")){
//    message.channel.send("*What you want? Message `?help` for a list of commands.*")
//}




if(message.content.startsWith(`${prefix}test`)){
    const helpEmbed = new Discord.RichEmbed()
        .setImage("https://i.imgur.com/4a1LSYg.gif")
        .setTitle("Beedo Skip")
        .setFooter("Its acE", "https://vignette.wikia.nocookie.net/starwars/images/f/f6/EE_Endocott_Headshot.png/revision/latest?cb=20131009010605")
    message.channel.send(helpEmbed)
}


if(message.content.startsWith(`${prefix}tier`)){  
    const helpEmbed = new Discord.RichEmbed()
            //.setColor('#00DE45')
            //.setImage("")
            //.setThumbnail("")
            .setTitle("Tier List")
            .addField(":gem: Top", "Ben Quadinaros\n'Bullseye' Navior\nMars Guo\nMawhonic\nAldar Beedo\nBoles Roor\nElan Mak")
            .addField(":first_place: High", "Neva Kee\nRatts Tyerell\nClegg Holdfast\nToy Dampner")
            .addField(":second_place: Mid", "Slide Paramita\nEbe Endocott\nGasgano\nDud Bolt\nOdy Mandrell\nBozzie Baranta\nAnakin Skywalker\nArk 'Bumpy' Roose")
            .addField(":third_place: Low", "Fud Sang\nTeemto Pagalies\n Wan Sandage\nSebulba")
    message.channel.send(helpEmbed)
}



if (!message.guild) return; //anything that shouldn't be called in a dm goes after this

if(message.content.startsWith(`${prefix}speedrunning`)){
    let role = message.guild.roles.get("535973118578130954");
    let member = message.member;
    if(message.member.roles.has(role.id)){
        member.removeRole(role).catch(console.error)
        message.channel.send(member + " no longer has the speedrunning role")
    } else {
        member.addRole(role).catch(console.error);
        message.channel.send(member + " now has the speedrunning role")
    } 
}

if(message.content.startsWith(`${prefix}multiplayer`)){
    let role = message.guild.roles.get("474920988790751232");
    let member = message.member;
    if(message.member.roles.has(role.id)){
        member.removeRole(role).catch(console.error)
        message.channel.send(member + " no longer has the multiplayer role")
    } else {
        member.addRole(role).catch(console.error);
        message.channel.send(member + " now has the multiplayer role")
    } 
}

if(message.content.startsWith(`${prefix}teams`)){
    
    var assignTeams = ""
    if (isNaN(args)){
        message.channel.send("Specify the number of teams after the command. Ex: `!teams 2`")
    } 
    if(args == undefined || args == ""){
        message.channel.send("Specify the number of teams after the command. Ex: `!teams 2`")
    }
    else {
        var teams = ""
        var teamnum = args
        var playernum = arr.length
        var remainder = playernum%teamnum
        for(let i = 0; i<teamnum; i++){
            teams = teams + "**Team " + (i+1) + "**\n"
            for(let j = 0; j<(Math.floor(playernum/teamnum)); j++){
                var random = Math.floor(Math.random()*arr.length)
                teams = teams + arr[random].displayName + "\n"
                arr.splice(random,1)
                if(remainder > 0){
                var random = Math.floor(Math.random()*arr.length)
                teams = teams + arr[random].displayName + "\n"
                arr.splice(random,1)
                remainder = remainder - 1
                }

            }
            teams = teams + "\n"

        }
        message.channel.send(teams)
    }
}


if (message.content === ('!join')) {
    // Only try to join the sender's voice channel if they are in one themselves
    if (message.member.voiceChannel) {
        if(!message.guild.voiceConnection)

        {   var numb = Math.floor(Math.random()*voiceJoin.length)
            message.member.voiceChannel.join()
            .then(connection => { // Connection is an instance of VoiceConnection
                const dispatcher = connection.playArbitraryInput(voiceJoin[numb]);
                dispatcher.setVolume(0.2);
                dispatcher.on('end', () => {
                  connection.disconnect
                });
              })
        }
    } else {
      message.reply('You need to join a voice channel first!');
    }
} 

if (message.content === ('!leave')) {
    // Only try to join the sender's voice channel if they are in one themselves
    if (message.guild.voiceConnection) {
      message.guild.voiceConnection.disconnect()
    } else {
      message.reply("What you want? I'm not in a voice channel.");
    }
} 

function playSfx(message, filePath)
{
    if (message.channel.type !== "dm") {
    const voicecon = client.guilds.get("441839750555369474")
    if (message.member.voiceChannel && (voicecon.voiceConnection !== null)) {
        message.member.voiceChannel.join()
          .then(connection => { // Connection is an instance of VoiceConnection
            const dispatcher = connection.playFile(filePath);
            dispatcher.setVolume(0.2);
            dispatcher.on('end', () => {
              connection.disconnect
            });
            //dispatcher.on('error', e => {
              // Catch any errors that may arise
            //  console.log(e);
            //});
           
          })
          .catch(console.log);
      }
    }
}
})

client.on('guildMemberAdd', (guildMember) => {
    const guild = client.guilds.get("441839750555369474");
    const role = guild.roles.get("442316203835392001");
    let member = guildMember
    member.addRole(role).catch(console.error);
    //client.channels.get("441839751235108875").send("Welcome to the Star Wars Episode I: Racer discord, " + guildMember + "! Take a look around! I've got everything you need.");

 })

client.login(process.env.token);