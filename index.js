const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();
var lookup = require("./data.js");
var tourneylookup = require("./tourneydata.js");
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

var firebase = require("firebase/app");
require('firebase/auth');
require('firebase/database');
var firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

firebase.initializeApp(firebaseConfig);


var database = firebase.database();
var ref = database.ref('times'); //use forward slashes to navigate the data tree
var oddsref = database.ref('odds');
var feedbackref = database.ref('feedback');
var logref = database.ref('log');
var errorlogref = database.ref('log/error');
var weeklychallenges = database.ref('weekly/challenges');
var weeklyqueue = database.ref('weekly/queue');
var weeklyapproved = database.ref('weekly/submissions');


ref.on("value", function(snapshot) {
    challengedata = snapshot.val();
  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });

oddsref.on("value", function(snapshot) {
    oddsdata = snapshot.val();
    }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
    });

feedbackref.on("value", function(snapshot) {
    feedbackdata = snapshot.val();
    }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
    });
//var challengedata = fs.readFileSync('./challenge.json');
//var challenge = JSON.parse(challengedata);

//var database = require('redis').createClient(process.env.REDIS_URL);

const fetch = require('node-fetch');

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
        var seconds = (time - hours*3600 - minutes * 60).toFixed(3)
        return hours.toString() + ":" + minutes.toString() + ":" + myformat.format(seconds)
    } else if (time >= 60) {
        var minutes = Math.floor(time/60)
        var seconds = (time - minutes * 60).toFixed(3)
        return minutes.toString() + ":" + myformat.format(seconds)
    } else {
        return Number(time).toFixed(3)
    }
}

function timetoSeconds(time) {
    if (time.includes(":")){
        var split = time.split(':')
        if (split.length = 2) {
            var out = Number(split[0]*60)+Number(split[1])
            if (Number(split[1]) >= 60) {
                return null
            } else {
                return out
            }
        } else {
            return null
        }
        
    } else {
        return time
    }
    
}

function findTime(str) {
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
}



client.ws.on('INTERACTION_CREATE', async interaction => {
    const command = interaction.data.name.toLowerCase();
    const args = interaction.data.options;
    console.log(interaction.member)
    console.log(interaction.data)
    if (!client.commands.has(command)) return;

    try {
        client.commands.get(command).execute(client, interaction, args);
    } catch (error) {
        console.error(error);
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: "something went wrong"
                }
            }
        })
    }

    if(command == "echo") {
        const description = args.find(arg => arg.name.toLowerCase() == "content").value;
        const embed = new discord.MessageEmbed()
            .setTitle("Echo!")
            .setDescription(description)
            .setAuthor(interaction.member.user.username)

        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: await createAPIMessage(interaction, embed)
            }
        })
    }
})

async function createAPIMessage(interaction, content) {
    const apiMessage = await discord.APIMessage.create(client.channels.resolve(interaction.channel_id),content)
        .resolveData()
        .resolveFiles()

    return { ...apiMessage.data, files: apiMessage.files};
}

async function getCommands() {
    const commands = await client.api.applications("545798436105224203").guilds('441839750555369474').commands.get()
    //await client.api.applications("545798436105224203").guilds('441839750555369474').commands('793304837302386709').delete()
    //await client.api.applications("545798436105224203").guilds('441839750555369474').commands('793311885809156146').delete()
    console.log(commands)
}

getCommands()

//client.api.applications("545798436105224203").commands('793304837302386709').delete()
//client.api.applications("545798436105224203").commands('793311885809156146').delete()

client.once('ready', () => {
    console.log('Ready!')
    //set bot activity
    client.user.setActivity("?help"); 
    //client.users.cache.get("256236315144749059").send("Ready!")
    client.channels.cache.get("444208252541075476").send("Ready!");


})

client.on("error", (e) => {
    console.error(e)
    var data = {
        date: Date(),
        error: e
    }
    errorlogref.push(data)
});
//client.on("warn", (e) => console.warn(e));
//client.on("debug", (e) => console.info(e));

client.on('guildMemberAdd', (guildMember) => { //join log
    if (guildMember.guild.id == "441839750555369474") {
        var random = Math.floor(Math.random()*welcomeMessages.length)
        var join = welcomeMessages[random]
        console.log(join)
        client.channels.cache.get("441839751235108875").send(join.replace("replaceme", "<@" + guildMember.user + ">"));
        const guild = client.guilds.cache.get("441839750555369474");
        const role = guild.roles.cache.get("442316203835392001");
        let member = guildMember
        member.roles.add(role).catch(console.error);
    }
 })

client.on("messageDelete", (messageDelete) => {
    if (messageDelete.author.bot == false && messageDelete.channel.type == "text" && !messageDelete.content.startsWith("!")) {
        //console.log(`${messageDelete.author.tag} deleted the following message from ${messageDelete.channel}: "${messageDelete.content}"`)
        var channelname = ""
        for (var i=0; i<discordchannels.length; i++) {
            if (discordchannels[i].id == messageDelete.channel.id) {
                channelname = discordchannels[i].name
            }
        }
        var data = {
            user: messageDelete.author.id,
            name: messageDelete.author.username,
            date: messageDelete.createdTimestamp,
            action: "deleted message",
            message: messageDelete.content,
            channel: messageDelete.channel.id,
            channel_name: channelname
        }
        //console.log(data)
        logref.push(data);
        //client.users.cache.get("256236315144749059").send(`${messageDelete.author.tag} deleted a message from ${messageDelete.channel}\n> ${messageDelete.content}`);
    }
   });

client.on('messageUpdate', (oldMessage, newMessage) => {
    emb = newMessage.embeds
    for (i=0; i<emb.length; i++) {
        if (emb[i].url == "" && newMessage.author.bot == false) {
            client.users.cache.get("256236315144749059").send(`potential spambot: ${messageDelete.author.username} detected in ${messageDelete.channel.id}`)
        }
    }
    if (emb.length == 0) {
        if (oldMessage.author.bot == false && oldMessage.channel.type == "text" && oldMessage !== newMessage) {
            //console.log(`${newMessage.author.tag} edited a message in ${oldMessage.channel} from "${oldMessage.content}" to "${newMessage.content}"`)
            var channelname = ""
            for (var i=0; i<discordchannels.length; i++) {
                if (discordchannels[i].id == newMessage.channel.id) {
                    channelname = discordchannels[i].name
                }
            }
            var data = {
                user: oldMessage.author.id,
                name: oldMessage.author.username,
                date: oldMessage.createdTimestamp,
                action: "edited message",
                message: oldMessage.content,
                edit: newMessage.content,
                channel: oldMessage.channel.id,
                channel_name: channelname
            }
            //console.log(data)
            logref.push(data);
        }
    }
    if(newMessage.channel.id == 545800310283829270) { //775134898633048084 weekly challenge 
        var time = ""
        var embtitle = ""
        var emb = newMessage.embeds
        var url = ""
        if (emb.length > 0) {
            if (emb[0].type == "image") {
                url = emb[0].url
            } else if (emb[0].type == "video") {
                url = emb[0].video.url
                embtitle = emb[0].title
                time = findTime(embtitle)
            }
            var msg = newMessage.content
            if (time == "" ) {
                time = findTime(msg)
            }
            var data = {
                user: newMessage.author.id,
                name: newMessage.author.username,
                platform: "",
                proof: url,
                id: newMessage.id,
                timestamp: newMessage.createdTimestamp,
                time: time,
                challengeid: "",
            }
            weeklyqueue.push(data);
        }
    }
    
});

// when a user joins/leaves a voice channel
client.on('voiceStateUpdate', (oldState, newState) => {

    let newUserChannel = newState.channel
    let oldUserChannel = oldState.channel
    var chan = client.channels.cache.get('441840193754890250');
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
    if(oldState == undefined && newState.channelID == "441840193754890250" && newState.member.id !== "545798436105224203") {
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
       client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + newState.member + ">"))
    } 
    //if member is already in any voice channel
    if(oldUserChannel !== undefined){ 
        //member leaves multiplayer or troubleshooting channel
        const voicecon = client.guilds.cache.get("441839750555369474")
        if(voicecon.voice !== null){
            if((oldState.channelID == "441840193754890250" || oldState.channelID == "441840753111597086") && newState == undefined){ 
                random = Math.floor(Math.random()*goodbyeMessages.length)
                random2 = Math.floor(Math.random()*voiceFarewell.length)
                var str = goodbyeMessages[random]
                client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + oldState.member + ">"))
            }
        }
        //member is moving from one channel to another
        if(newState !== undefined) {
            //member moves from multiplayer to troubleshooting
            if(oldState.channelID == "441840193754890250" && newState.channelID == "441840753111597086" && newState.member.id !== "288258590010245123" && newState.member.id !=="545798436105224203") {
                random = Math.floor(Math.random()*troubleShooting.length)
                random2 = Math.floor(Math.random()*voiceTrouble.length)
                var str = troubleShooting[random]
                client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + oldState.member +">"))
            }
            //member moves back from troubleshooting to multiplayer
            if(oldState.channelID == "441840753111597086" && newState.channelID == "441840193754890250" && newState.member.id !== "288258590010245123" && newState.member.id !== "545798436105224203") { 
                random = Math.floor(Math.random()*fixed.length)
                random2 = Math.floor(Math.random()*voiceFixed.length)
                var str = fixed[random]
                client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + oldState.member +">"))
            }
        }
    }
})


client.on('message', message => {
if(message.author.bot) return; //trumps any command from executing from a bot message
var args = message.content.slice(prefix.length).trim().split(/ +/g);
var command = args.shift().toLowerCase();
var messageText = message.content
var messageLow = messageText.toLowerCase()
var random2 = Math.floor(Math.random()*2) //1 in # chances of using playerPicks instead of movieQuotes
var random3 = Math.floor(Math.random()*movieQuotes.length)
var random5 = Math.floor(Math.random()*playerPicks.length)


//get list of members in voicechannel
if(chan !== undefined && message.channel.type !== "dm"){
    var chan = client.channels.cache.get(message.member.voice.channelID);
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





if (messageLow.startsWith(`${prefix}guilds`)) {
console.log(client.guilds.cache)
//console.log(client.guilds.cache.get("697833083201650689"))
}

if (messageLow.startsWith(`${prefix}ping`)) {
    //console.log(client.guilds.cache)
    client.channels.cache.get("444208252541075476").send("I'm alive! I've been up for `" + timefix(client.uptime/1000) + "` since `" + client.readyAt + "`");
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
        } else if ((args[c] == "mu" || args[c] == "upgrades") && upgr == "") {
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
        } else if(args[c] == "ns" || args[c] == "ft" || args[c] == "full") {
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
    } else if (upgr == "&var-789k45lw=gq7nen1p" || upgr == "&var-789k49lw=xqkrk919") {
        desc = "Upgrades, "
    } else {
        desc = "Any Upgrades, "
    }
    if (skps == "&var-2lgz978p=81p7we17" ||  skps == "&var-onv6p08m=5lmxzy1v") {
        desc = desc + "Full Track, "
    } else if (skps == "&var-onv6p08m=21gjrx1z" ||  skps == "&var-2lgz978p=p125ev1x"){
        desc = desc + "Skips, "
    } else {
        desc = desc + "Skips/Full Track, "
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
          const srcReport = new Discord.MessageEmbed()
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

if(messageLow.startsWith(`${prefix}tourn`)){
    var upgr = null
    var skps = null
    var dths = null
    var year = null
    var podfilterout = []
    var podfilterin = []
    for (let c = 1; c < args.length; c++) {
        if (args[c] == "no") {
            if (args[c+1] == "upgrades") {
                upgr = false
            }
            if (args[c+1] == "skips" || args[c+1] == "skip") {
                skps = false
            }
            if (args[c+1] == "death" || args[c+1] == "deaths") {
                dths = false
            }
            for (let i =0; i<23; i++) {
                var nname = racers[i].nickname
                for (let y of nname) {
                    y = "" + y
                    y.replace(/\s/g, '')
                    if (args[c+1].toLowerCase() == y) {
                        podfilterout.push(i)
                    }
                }
            }   
        } else if(args[c] == "nu") {
            upgr = false
        } else if ((args[c] == "mu" || args[c] == "upgrades") && upgr == null) {
            upgr = true
        } else if ((args[c] == "skips" || args[c] == "skip") && skps == null  && args[c-1] !== "no") {
            skps = true
        } else if(args[c] == "ns" || args[c] == "ft" || args[c] == "full") {
            skps = false
        } else if(args[c] == "deathless") {
            dths = false
        } else if((args[c] == "death" || args[c] == "deaths") && dths == null) {
            dths = true
        } else if(args[c].startsWith("20") && args[c].length == 4) {
            year = args[c]
        } else {
            for (let i =0; i<23; i++) {
                var nname = racers[i].nickname
                for (let y of nname) {
                    y = "" + y
                    y.replace(/\s/g, '')
                    if (args[c].toLowerCase() == y && args[c-1] !== "no") {
                        podfilterin.push(i)
                    }
                }
            }   
        }
    }
    console.log(podfilterin)
    console.log(podfilterout)
    //args = args.join().replace(/,/g, '').replace(/par/g, '').replace(/times/g, '').replace(/time/g, '').toString()
    for (let i =0; i<25; i++) {
        var nname = tracks[i].nickname
        for (let y of nname) {
            y = "" + y
            y.replace(/\s/g, '')
            if (args[0].toLowerCase() == y) {
                var numb = i
            }
        }
    }   

    var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
    if (numb !== null) {
        const tourneyReport = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(tracks[numb].name + " | Tournament Times")
        .setURL("https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing")
        //.setDescription("MU, PC")
        var tourneyfiltered = tourney.filter(element => element.track == tracks[numb].name) //filters out other tracks
        if (skps == true) {
            tourneyfiltered = tourneyfiltered.filter(element => element.force == "Skips")
        }
        if (skps == false) {
            tourneyfiltered = tourneyfiltered.filter(element => element.force !== "Skips")
        }
        if (upgr == true) {
            tourneyfiltered = tourneyfiltered.filter(element => element.force !== "NU")
        }
        if (upgr == false) {
            tourneyfiltered = tourneyfiltered.filter(element => element.force == "NU")
        }
        if (dths == true) {
            tourneyfiltered = tourneyfiltered.filter(element => element.totaldeaths > 0)
        }
        if (dths == false) {
           tourneyfiltered = tourneyfiltered.filter(element => element.totaldeaths == 0)
        }
        if (year !== null) {
            tourneyfiltered = tourneyfiltered.filter(element => element.year == year)
        }
        if (podfilterin.length > 0) {
            for (i=0; i<podfilterin.length; i++) {
                tourneyfiltered = tourneyfiltered.filter(element => element.pod == racers[podfilterin[i]].name)
            }
        }
        if (podfilterout.length > 0) {
            for (i=0; i<podfilterout.length; i++) {
                tourneyfiltered = tourneyfiltered.filter(element => element.pod !== racers[podfilterout[i]].name)
            }
        }
        var j = 0
        var players = []
        console.log(tourneyfiltered.length)
        if (tourneyfiltered.length > 0) {
            for (i=0; i<5;){
                var skip = false
                for (k = 0; k < players.length; k++) {
                    if (tourneyfiltered[j].player + tourneyfiltered[j].force == players[k]) {
                        skip = true
                    }
                }
                if (skip == false && tourneyfiltered[j].hasOwnProperty("totaltime")) {
                    var character = ""
                    var deaths = ""
                    var characterban = ""
                    var link = ""
                    var forc = "MU "
                    if (tourneyfiltered[j].hasOwnProperty("force")) {
                        if (tourneyfiltered[j].force == "Skips") {
                            forc = "Skips "
                        } else if (tourneyfiltered[j].force == "NU") {
                            forc = "NU "
                        }
                    }
                    if (tourneyfiltered[j].hasOwnProperty("url")) {
                        link = tourneyfiltered[j].url
                    }
                    if (tourneyfiltered[j].hasOwnProperty("podtempban")) {
                        characterban = "\n~~" + tourneyfiltered[j].podtempban + "~~"
                    }
                    if (tourneyfiltered[j].totaldeaths > 0) {
                        deaths = ""
                        if (tourneyfiltered[j].totaldeaths > 5) {
                            deaths = ":skull:×"+tourneyfiltered[j].totaldeaths
                        } else {
                            for (d = 0; d< tourneyfiltered[j].totaldeaths; d++){
                                deaths = deaths + ":skull:"
                            }
                        }
                    }
                    for (let n = 0; n<23; n++){
                        if (tourneyfiltered[j].pod == racers[n].name) {
                            if (racers[n].hasOwnProperty("flag")) {
                                character = racers[n].flag
                            } else {
                                character = racers[n].name
                            }
                        }
                    } 
                    tourneyReport.addField(
                        pos[i] + " " + tourneyfiltered[j].player, tourneyfiltered[j].year + ", " + tourneyfiltered[j].bracket +": "+tourneyfiltered[j].round + "\nRace " + tourneyfiltered[j].race + ", vs " + tourneyfiltered[j].opponent, true
                    )
                    tourneyReport.addField(
                        timefix(Number(tourneyfiltered[j].totaltime).toFixed(3))," " + character + "[ " + forc + "](" + link + ")" + deaths + characterban, true
                    )
                    tourneyReport.addField(
                        '\u200B', '\u200B', true
                    )
                    //message.channel.send(tourneyfiltered[j].player + " - " + timefix(tourneyfiltered[j].totaltime))
                    players.push(tourneyfiltered[j].player + tourneyfiltered[j].force)
                    i++
                }
                j++
                if (j == tourneyfiltered.length) {
                    i = 5
                }
            }
            message.channel.send(tourneyReport)
        } else {
            message.channel.send("Sorry, I didn't find anything")
        }
    }
}
/////   !track   /////
if(messageLow.startsWith(`${prefix}track`)){
    var partime = false
    if (args.includes("time") || args.includes("times") || args.includes("par")) {
        partime = true
    }
    args = args.join().replace(/,/g, '').replace(/par/g, '').replace(/times/g, '').replace(/time/g, '').toString()

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
    } else if(partime == false) {
        const trackEmbed = new Discord.MessageEmbed()
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
                                const tracktimesEmbed = new Discord.MessageEmbed()
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
        
    } else if(partime == true) {
        const tracktimesEmbed2 = new Discord.MessageEmbed()
        .setColor(planets[tracks[numb].planet].color)
        .setTitle(tracks[numb].name + " | Par Times")
        .setURL("https://docs.google.com/spreadsheets/d/1TwDtG6eOyiQZEZ3iTbZaEmthe5zdf9YEGJ-1tfFfQKg/edit?usp=sharing")
        .addField("FT 3-Lap", ":gem: " + tracks[numb].partimes[0] + "\n:first_place: " + tracks[numb].partimes[1] + "\n:second_place: " + tracks[numb].partimes[2] + "\n:third_place: " + tracks[numb].partimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].partimes[4], true)
        .addField("FT 1-Lap", ":gem: " + tracks[numb].parlaptimes[0] + "\n:first_place: " + tracks[numb].parlaptimes[1] + "\n:second_place: " + tracks[numb].parlaptimes[2] + "\n:third_place: " + tracks[numb].parlaptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parlaptimes[4], true)
        if (tracks[numb].hasOwnProperty("parskiptimes")) {
            tracktimesEmbed2.addField("Skips 3-Lap", ":gem: " + tracks[numb].parskiptimes[0] + "\n:first_place: " + tracks[numb].parskiptimes[1] + "\n:second_place: " + tracks[numb].parskiptimes[2] + "\n:third_place: " + tracks[numb].parskiptimes[3] + "\n<:bumpythumb:703107780860575875> " + tracks[numb].parskiptimes[4], true)
        }
        message.channel.send(tracktimesEmbed2);
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
            
            if(racers[i].mu_tier == 0){
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
            
            if(racers[i].mu_tier == 1){
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
            
            if(racers[i].mu_tier == 2){
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
            
            if(racers[i].mu_tier == 3){
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
        message.channel.send("*Perhaps the archives are incomplete.*")
        //playSfx(message, voiceError[Math.floor(Math.random()*voiceError.length)])
    }
    else{
        var racerFooter = racers[numb].footer
        var Tier = ["Top", "High", "Mid", "Low"]
        const racerEmbed = new Discord.MessageEmbed()
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .addField("Tier", Tier[racers[numb].mu_tier], true)
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
                        if(racers[i].mu_tier == 0){
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
                    if(racers[i].mu_tier == 1){
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
                        if(racers[i].mu_tier == 2){
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
                        if(racers[i].mu_tier == 3){
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

/////   !weekly    //////
if(message.content.startsWith(`${prefix}weekly`)) {
    if (args.length > 0) {
        if (args[0].startsWith("q")) {
            //generate approval queue
        } else if (args[0].startsWith("challenge")) {
            //set challenge
        } else {
            //submission
        }
    } else {
        //post leaderboard
    }
}

if(message.channel.id == 545800310283829270) { //775134898633048084 weekly challenge 
    var time = ""
    var embtitle = ""
    var emb = message.embeds
    var url = ""
    if (emb.length > 0) {
        if (emb[0].type == "image") {
            url = emb[0].url
        } else if (emb[0].type == "video") {
            url = emb[0].video.url
            embtitle = emb[0].title
            time = findTime(embtitle)
        }
        var msg = message.content
        if (time == "" ) {
            time = findTime(msg)
        }
        var data = {
            user: message.author.id,
            name: message.author.username,
            platform: "",
            proof: url,
            id: message.id,
            timestamp: message.createdTimestamp,
            time: time,
            challengeid: "",
        }
        weeklyqueue.push(data);
    }
}

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
*/

/////   !challenge    //////
    if(message.content.startsWith(`${prefix}stats`)) {
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

    if(message.content == "?challenge") {
        const challengeHelpEmbed = new Discord.MessageEmbed()
        .setTitle("!challenge")
        .setDescription("When you type `!challenge`, Botto will challenge you to race a random pod on a random track with random conditions. The default conditions are max upgrades, 3-lap, full track. You have 15 minutes to submit a time for the challenge. Botto will only accept one time from the person who triggered the challenge. \n\nYou can customize your odds by typing `!odds`")
        .addField("Default Odds", "Skips - 25%\nNo upgrades - 15%\nNon 3-lap - 5%\nMirror mode - 5%", true)
        .addField("Rating a Challenge",":thumbsup: = I like this challenge, I would play it again\n:thumbsdown: = I don't like this challenge, this combination is not fun\n:x: = This challenge is impossible, no one should be expected to do this challenge", true)
        message.channel.send(challengeHelpEmbed);
    }

    if(message.content.startsWith(`${prefix}odds`)) {
        var record = ""
        var desc = "You have not customized your odds. The default odds are listed below. "
        if (oddsdata !==null) {
            var keys = Object.keys(oddsdata)
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(oddsdata[k].name == message.author.id){
                    record = k
                    i = keys.length
                }
            }
        }
        if (record !== "") {
            desc = "Your custom odds are listed below. "
            odds_skips = oddsdata[k].skips
            odds_noupgrades = oddsdata[k].no_upgrades
            odds_non3lap = oddsdata[k].non_3_lap
            odds_mirrormode = oddsdata[k].mirror_mode
        } else {
            odds_skips = 25
            odds_noupgrades = 15
            odds_non3lap = 5
            odds_mirrormode = 5
        }
        const oddsEmbed = new Discord.MessageEmbed()
        .setTitle("Customize Your `!challenge` Odds")
        .setDescription(desc + "Change your odds by replying to this message with 4 numbers separated by commas in order of Skips, No Upgrades, Non 3-lap, and Mirror Mode. These numbers will be divided by 100 to determine the chances Botto will give their conditions in a `!challenge`. \n Example: 15, 20, 10, 0")
        .addField("Your Odds", "Skips - " + odds_skips +"%\nNo Upgrades - " + odds_noupgrades +"%\nNon 3-Lap - " + odds_non3lap +"%\nMirror Mode - " + odds_mirrormode +"%", true)
        .addField("Default Odds", "Skips - 25%\nNo Upgrades - 15%\nNon 3-Lap - 5%\nMirror Mode - 5%", true)
        .setFooter("Reset your odds to default by typing 'default'")
        message.channel.send(oddsEmbed);
        var collected = false
        const oddscollector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 500000 });
        oddscollector.on('collect', message => {
            if (!isNaN(Number(message.content.replace(/,/g, '').replace(/\s/g, "").replace(/%/g, ""))) && collected == false) {
                if (oddsdata !==null) {
                    var keys = Object.keys(oddsdata)
                    for (var i=0; i<keys.length; i++) {
                        var k = keys[i];
                        if(oddsdata[k].name == message.author.id){
                            oddsref.child(k).remove()
                        }
                    }
                }
                var odds = message.content.replace(/\s/g, "").replace(/%/g, "").split(",")
                if (odds.length == 4) {
                    var data = {
                        name: message.author.id,
                        skips: odds[0],
                        no_upgrades: odds[1],
                        non_3_lap: odds[2],
                        mirror_mode: odds[3]
                    }
                    oddsref.push(data);
                    message.reply("*Your new odds have been saved!*")
                    collected = true
                } else {
                    message.reply("*Only four numbers!*")
                }
            } else if (message.content == "default") {
                if (oddsdata !==null) {
                    var keys = Object.keys(oddsdata)
                    for (var i=0; i<keys.length; i++) {
                        var k = keys[i];
                        if(oddsdata[k].name == message.author.id){
                            oddsref.child(k).remove()
                        }
                    }
                }
                message.reply("*Your odds have been reset to the default*")
                collected = true
            }
        })
    }

    if(message.content.startsWith(`${prefix}challenge`)) {
        var hints = ["Type `?challenge` to learn more about how it works", "You have 15 minutes to submit a time", "Your feedback is appreciated", "You can use `!odds` to customize how the challenge is randomized", "Can you beat the par times?", "React with a thumbs up to like the challenge", "React with a thumbs down to dislike the challenge", "React with a red x if the challenge is impossible", "Submit your time below!", "Your time starts... now!", "Is that you, Hyuudoro?", "Only the person who called the challenge can submit a time", "If you call another challenge, it will cancel your current challenge"]
        let member = message.author.id
        var commandmessage = message
        var challengestart = Date.now()
        //var randoms1 = [Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]
        //var randoms2 = [Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]
        //var randoms3 = [Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]
        //var randoms4 = [Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]
        //var randoms5 = [Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]
        //var randoms6 = [Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]
        var random1 = Math.floor(Math.random()*23)
        var random2 = Math.floor(Math.random()*25)
        var random3 = Math.floor(Math.random()*movieQuotes.length)
        var random4 = Math.floor(Math.random()*hints.length)
        var laps = 3
        var lap = [1,2,4,5]
        var laptext = ""
        var mirror = false
        var mirrortext = ""
        var nu = false
        var nutext = ""
        var skips = false
        var skipstext = ""
        var partime = tracks[random2].partimes[4]
        var flag = ""
        if (racers[random1].hasOwnProperty("flag")) {
            flag = racers[random1].flag
        }
        var record = ""
        if (oddsdata !==null) {
            var keys = Object.keys(oddsdata)
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(oddsdata[k].name == message.author.id){
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
            partime = ""
        }
        if (Math.random()<odds_mirrormode){
            mirrortext = ", **MIRRORED!** "
            mirror = true
        }
        if (Math.random()<odds_non3lap){
            laps = lap[Math.floor(Math.random()*4)]
            laptext = " for **" + laps + " lap(s)**"
            partime = ""
        }
        if (tracks[random2].hasOwnProperty("parskiptimes")) {
            if (Math.random()<odds_skips) {
                skipstext = ", with **SKIPS**"
                skips = true
                if (nutext == "") {
                    partime = tracks[random2].parskiptimes[4]
                }
            }
        }
        if (partime !== "" && laps == 3) {
            partime = "\nPar time: " + partime
        }
        var keys = Object.keys(challengedata)
        var best = []
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
        var msg = ""
        const challengeEmbed = new Discord.MessageEmbed()
            .setTitle("Race as **" + flag + " " + racers[random1].name + "** (" + (random1 + 1) + ")"+ nutext + " on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + laptext + skipstext + mirrortext)
            //.setFooter(hints[random4])
            .setColor(planets[tracks[random2].planet].color)
            var like = 0
            var dislike = 0
            var impossible = 0
            var keys = Object.keys(feedbackdata)
            for (var i=0; i<keys.length; i++) {
                var k = keys[i];
                if(feedbackdata[k].track == random2 && feedbackdata[k].racer == random1 && feedbackdata[k].laps == laps && feedbackdata[k].mirror == mirror && feedbackdata[k].nu == nu && feedbackdata[k].skips == skips){
                    if (feedbackdata[k].track == "👍") {
                        like = like +1
                    } else if (feedbackdata[k].track == "👎") {
                        dislike = dislike +1
                    } else if (feedbackdata[k].track == "❌") {
                        impossible = impossible + 1
                    } 
                }
            }
            var desc = ""
            var speed = 1
            var speedmod = tracks[random2].avgspeedmod
            var length = tracks[random2].length
            length = length * laps
            if (nu) {
                speed = racers[random1].avgspeed_nu
            } else {
                speed = racers[random1].avgspeed_mu
            }
            var goal = length/(speed*speedmod)
            if (like > 0) {
                desc = desc + "  👍 " + like
            }
            if (dislike > 0) {
                desc = desc + "  👎 " + dislike
            }
            if (impossible > 0) {
                desc = desc + "  ❌ " + impossible
            }
            if(Math.random()<0.50 && best.length> 0) {
                desc = desc +"*The current record-holder for this challenge is... " + best[0].name + "!*"
            } else if (Math.random() < 0.50) {
                var str = playerPicks[Math.floor(Math.random()*playerPicks.length)]
                desc = desc + str.replace("replaceme", message.author.username)
            } else {
                desc = desc + movieQuotes[random3]
            }
            challengeEmbed.setDescription(desc)
            if(!skips) {
                challengeEmbed.addField("Goal Times", ":gem: " + timefix(goal*multipliers[0].ft_multiplier) + "\n:first_place: " + timefix(goal*multipliers[1].ft_multiplier) + "\n:second_place: " + timefix(goal*multipliers[2].ft_multiplier) + "\n:third_place: " + timefix(goal*multipliers[3].ft_multiplier) + "\n<:bumpythumb:703107780860575875> " + timefix(goal*multipliers[4].ft_multiplier), true)
            } else {
                challengeEmbed.addField("Goal Times", ":gem: " + timefix(timetoSeconds(tracks[random2].parskiptimes[0])*multipliers[0].skips_multiplier) + "\n:first_place: " + timefix(timetoSeconds(tracks[random2].parskiptimes[1])*multipliers[1].skips_multiplier) + "\n:second_place: " + timefix(timetoSeconds(tracks[random2].parskiptimes[2])*multipliers[2].skips_multiplier) + "\n:third_place: " + timefix(timetoSeconds(tracks[random2].parskiptimes[3])*multipliers[3].skips_multiplier) + "\n<:bumpythumb:703107780860575875> " + timefix(timetoSeconds(tracks[random2].parskiptimes[4])*multipliers[4].skips_multiplier), true)
            }
            if(besttimes !== "") {
                challengeEmbed.addField("Best Times", besttimes, true)
            }
        message.channel.send(challengeEmbed).then(sentMessage => {
            //sentMessage.edit(msg)
            sentMessage.react('👍').then(()=> {
                sentMessage.react('👎').then(()=> {
                    sentMessage.react('❌');
                })
            })
            var feedback = ""
            sentMessage.awaitReactions((reaction, user) => user.id === message.author.id && (reaction.emoji.name == '👍' || reaction.emoji.name == '👎' || reaction.emoji.name == '❌'),
                { max: 1, time: 900000 }).then(collected => {
                    if (collected.first().emoji.name == '👍') {
                        feedback = '👍'
                    } else if (collected.first().emoji.name == '👎') {
                        feedback = '👎'
                    } else if (collected.first().emoji.name == '❌') {
                        feedback = '❌'
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
            //playSfx(message, racers[numb].announce)
        const collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 900000 });
        var collected = false
        collector.on('collect', message => {
            if (message.content == "!challenge" && collected == false && member == message.author.id) {
                collected = true
                if (message.guild) {
                    commandmessage.delete()
                }
                sentMessage.delete()
            } else if (collected == false && member == message.author.id && !isNaN(message.content.replace(":", "")) && timetoSeconds(message.content) !== null) {
                var challengeend = Date.now()
                var time = timetoSeconds(message.content)
                if ((challengeend - challengestart) < time*1000) {
                    message.reply("*I warn you. No funny business.*")
                    collected = true
                } else {
                    
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
                    var parbeat = 5
                    var rank = [":gem: Elite", ":first_place: Pro", ":second_place: Rookie", ":third_place: Amateur", "<:bumpythumb:703107780860575875> Youngling"]
                    for (var i=0; i<5; i++) {
                        if (nu == false){
                            if (skips) {
                                if (time < timetoSeconds(tracks[random2].parskiptimes[i])*multipliers[i].skips_multiplier) {
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
                        
                    }
                    var congrats = ""
                    if (best.length > 0) {
                        if (parbeat < 5 && time < best[0].time) {
                            congrats = "<a:newrecord:672640831882133524> You beat the best challenge time and the " + rank[parbeat] + " time for this track! <a:newrecord:672640831882133524>"
                        } else if (time < best[0].time) {
                            congrats = "<a:newrecord:672640831882133524> You beat the best challenge time for this track! <a:newrecord:672640831882133524>"
                        }
                    } else if (parbeat < 5) {
                        congrats = "You beat the " + rank[parbeat] + " time for this track!"
                    }
                    sentMessage.edit(":white_check_mark: Challenge completed! The submitted time was: **" + timefix(time) + "**\n" + congrats)
                    if (message.guild) {
                        message.delete()
                    }
                }
                
            }
            
        })
            
        })
        
        
    }

/////    !abb //////

if(message.content.startsWith(`${prefix}abb`)) {
    const AbbEmbed = new Discord.MessageEmbed()
    .setTitle("SWE1R Abbreviations")
    .setURL("https://www.speedrun.com/swe1r/thread/nf4bo")
    .addField(":large_blue_diamond: General",
    "Swe1r/SWR --- Star Wars Ep. I Racer\n" +
    "RTA --- Real Time Attack (Full game/circuit runs)\n" +
    "IL --- Individual Level Time Attack\n" +
    "NU --- No Upgrades\n" +
    "MU --- Max Upgrades\n" +
    "FT --- Full Track\n" +
    "ASU --- Arbitrary Speed Units\n" +
    "RNG --- Random Number Generation aka Luck\n" +
    "SRC --- Speedrun.com\n" +
    "CS --- Cyberscore.me.uk\n" +
    "TFPS --- Traction/FPS setup\n" +
    "MFG --- Maximum Fall Glitch")
    .addField(":flags: Categories",
    "AMC --- Amateur Circuit\n" +
    "SPC --- Semi-Pro Circuit\n" +
    "GC --- Galactic Circuit\n" +
    "AT --- All Tracks\n" +
    "NG+ --- New Game+\n" +
    "Any% --- Complete the game without restrictions\n" +
    "100% --- Win all 25 Races")
    .addField(":triangular_flag_on_post: Tracks",
    "Boonta Training Course --- TBTC/BTC\n" +
    "Mon Gazza Speedway --- MGS\n" +
    "Beedo's Wild Ride --- BWR\n" +
    "Aquilaris Classic --- AQC\n" +
    "Malastare 100 --- M100\n" +
    "Vengeance --- VEN\n" +
    "Spice Mine Run --- SMR\n\n" +
    "Sunken City --- SC\n" +
    "Howler Gorge --- HG\n" +
    "Dug Derby --- DD\n" +
    "Scrapper's Run --- SR\n" +
    "Zugga Challenge --- ZC\n" +
    "Baroo Coast --- BC\n" +
    "Bumpy's Breakers --- BB\n\n" +
    "Executioner --- EXE\n" +
    "Sebulba's Legacy --- SL\n" +
    "Grabvine Gateway --- GVG\n" +
    "Andobi Mountain Run --- AMR\n" +
    "Dethro's Revenge --- DR\n" +
    "Fire Mountain Rally --- FMR\n" +
    "The Boonta (Eve) Classic --- TBC/BEC\n\n" +
    "Ando Prime Centrum --- APC\n" +
    "Abyss --- ABY\n" +
    "The Gauntlet --- GAU\n" +
    "Inferno --- INF")
    message.channel.send(AbbEmbed)
}

/////    ?help    //////


    if(message.content.toLowerCase().startsWith(`?help`) || message.content.startsWith(`${prefix}command`)) {
        const helpEmbed = new Discord.MessageEmbed()
            //.setColor('#00DE45')
            //.setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            .setTitle("Botto Command List")
            .addField(":large_blue_diamond: General", "`?help` - list of commands\n" +
            "`!cleanup` - deletes command and bot messages within the past 30 messages\n" +
            "`!github` - reveals Botto github link\n" +
            "`!img` - reveals links to racer/track graphics on imgur\n" +
            "`!guide` - posts link to multiplayer setup guide\n" +
            "`!drive` - posts link to Google Drive\n" +
            "`!abb` - posts list of commonly used abbreviations", false)
            .addField(":busts_in_silhouette: Roles", "`!multiplayer` - adds or removes multiplayer role\n" +
            "`!speedrunning` - adds or removes speedrunning role", false)
            .addField(":trophy: Speedrun.com Leaderboards", "`!src <track>` - shows top 5 3-lap times for given track\n" +
            "`!src <category>` - shows top 5 times for given category (any,100,amc,spc,ng+)\n" +
            "`!src <track/category> <mu/nu> <skips/ft> <pc/n64/dc/switch/ps4> <flap>` - filters leaderboard", false)
            .addField(":checkered_flag: Tournament Leaderboards", "`!tourney <track>` - shows top 5 tournament times for given track\n" +
            "`!tourney <track> <skips/ft> <mu/nu> <deaths/deathless> <pod/no pod> <year>` - filters leaderboard", false)
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
            "`!track <name/acronym> times` - look up par times for given track\n"+
            "`!tier (nu)` - posts MU/NU pod tier list\n" +
            "`!stat` - reveals racer stat guide\n", false)
            //.addField(":microphone2: Voice", "`!join` - adds Botto to the voice channel\n" +
            //"`!leave` - kicks Botto from the voice channel", false)
        message.channel.send(helpEmbed)
    }

    if(message.content.startsWith(`${prefix}stat`)) {
        const helpEmbed = new Discord.MessageEmbed()
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
    message.channel.messages.fetch({limit:30}).then(messages => {
        const botMessages = messages.filter(msg => msg.author.bot || msg.content.startsWith("!") || msg.content == "?help");
        message.channel.bulkDelete(botMessages);
        messagesDeleted = botMessages.array().length; // number of messages deleted

        // Logging the number of messages deleted on both the channel and console.
        message.channel.send("*I gotta lots of junk!* \n`" + messagesDeleted + " messages deleted`")
            .then(msg => {
                msg.delete({ timeout: 5000, reason: 'bot cleanup'})
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
    const helpEmbed = new Discord.MessageEmbed()
        .setImage("https://i.imgur.com/4a1LSYg.gif")
        .setTitle("Beedo Skip")
        .setFooter("Its acE", "https://vignette.wikia.nocookie.net/starwars/images/f/f6/EE_Endocott_Headshot.png/revision/latest?cb=20131009010605")
    message.channel.send(helpEmbed)
}


if(message.content.startsWith(`${prefix}tier`)){  
    const helpEmbed = new Discord.MessageEmbed()
    if (args[0] == "nu") {
        helpEmbed.setTitle("NU Racer Tier List")
        helpEmbed.addField(":gem: Top", "Boles Roor\nBen Quadinaros\nSebulba")
        helpEmbed.addField(":first_place: High", "Aldar Beedo\n'Bullseye' Navior\nMars Guo\nRatts Tyerell\nMawhonic")
        helpEmbed.addField(":second_place: Mid", "Toy Dampner\nClegg Holdfast\nEbe Endocott\nFud Sang\nAnakin Skywalker\nSlide Paramita\nArk 'Bumpy' Roose")
        helpEmbed.addField(":third_place: Low", "Neva Kee\nDud Bolt\nElan Mak\nBozzie Baranta\nOdy Mandrell\nGasgano\nTeemto Pagalies\nWan Sandage")
    } else {
        helpEmbed.setTitle("MU Racer Tier List")
        helpEmbed.addField(":gem: Top", "Ben Quadinaros\nBoles Roor\nMars Guo\nAldar Beedo\nElan Mak\nMawhonic\n'Bullseye' Navior")
        helpEmbed.addField(":first_place: High", "Clegg Holdfast\nNeva Kee\nRatts Tyerell\nToy Dampner\nArk 'Bumpy' Roose\nBozzie Baranta\nFud Sang")
        helpEmbed.addField(":second_place: Mid", "Dud Bolt\nOdy Mandrell\nGasgano\nWan Sandage\nAnakin Skywalker")
        helpEmbed.addField(":third_place: Low", "Slide Paramita\nSebulba\nEbe Endocott\nTeemto Pagalies")
    }
    message.channel.send(helpEmbed)
}



if (!message.guild) return; //anything that shouldn't be called in a dm goes after this

if(message.content.startsWith(`${prefix}speedrunning`)){
    let role = message.guild.roles.cache.get("535973118578130954");
    let member = message.member;
    if(message.member.roles.cache.find(r => r.name === "Speedrunning")){
        member.roles.remove(role).catch(console.error)
        message.channel.send("<@" + member.user + "> no longer has the speedrunning role")
    } else {
        member.roles.add(role).catch(console.error);
        message.channel.send("<@" + member.user + "> now has the speedrunning role")
    } 
}

if(message.content.startsWith(`${prefix}multiplayer`)){
    let role = message.guild.roles.cache.get("474920988790751232");
    let member = message.member;
    if(message.member.roles.cache.find(r => r.name === "Multiplayer")){
        member.roles.remove(role).catch(console.error)
        message.channel.send("<@" + member.user + "> no longer has the multiplayer role")
    } else {
        member.roles.add(role).catch(console.error);
        message.channel.send("<@" + member.user + "> now has the multiplayer role")
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
        if(!message.guild.voice.connection)

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
    if (message.guild.voice.connection) {
      message.guild.voice.connection.disconnect()
    } else {
      message.reply("What you want? I'm not in a voice channel.");
    }
} 

function playSfx(message, filePath)
{
    if (message.channel.type !== "dm") {
    const voicecon = client.guilds.cache.get("441839750555369474")
    if (message.member.voiceChannel && (voicecon.voice.connection !== null)) {
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



client.login(process.env.token);