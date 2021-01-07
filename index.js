const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();
var lookup = require("./data.js");
var tourneylookup = require("./tourneydata.js");
var tools = require('./tools.js');
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

var logref = database.ref('log');
var errorlogref = database.ref('log/error');
var weeklychallenges = database.ref('weekly/challenges');
var weeklyqueue = database.ref('weekly/queue');
var weeklyapproved = database.ref('weekly/submissions');

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

ref.on("value", function(snapshot) {
    challengedata = snapshot.val();
  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });

const fetch = require('node-fetch');

client.ws.on('INTERACTION_CREATE', async interaction => {
    const command = interaction.data.name.toLowerCase();
    const args = interaction.data.options;
    //command handler
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
})

async function getCommands() {
    const commands = await client.api.applications("545798436105224203").guilds('441839750555369474').commands.get()
    //await client.api.applications("545798436105224203").guilds('441839750555369474').commands('').delete()
    console.log(commands)
}

//getCommands()

client.once('ready', () => {
    console.log('Ready!')
    //set bot activity
    client.user.setActivity("/help"); 
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
        logref.push(data);
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
            logref.push(data);
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

    if (messageLow.startsWith(`${prefix}guilds`)) {
    console.log(client.guilds.cache)
    //console.log(client.guilds.cache.get("697833083201650689"))
    }

    if (messageLow.startsWith(`${prefix}ping`)) {
        //console.log(client.guilds.cache)
        client.channels.cache.get("444208252541075476").send("I'm alive! I've been up for `" + tools.timefix(client.uptime/1000) + "` since `" + client.readyAt + "`");
    }
})

client.login(process.env.token);