const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();
var lookup = require("./data.js");
var tourneylookup = require("./tourneydata.js");
var tools = require('./tools.js');
client.commands = new Discord.Collection();
client.buttons = new Discord.Collection();
client.selects = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const buttonFiles = fs.readdirSync('./buttons').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}
for (const file of buttonFiles) {
    const button = require(`./buttons/${file}`);
    client.buttons.set(button.name, button);
}

var firebase = require("firebase/app");
require('firebase/auth');
require('firebase/database');
var admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        "projectId": process.env.FIREBASE_PROJECT_ID,
        "privateKey": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        "clientEmail": process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: "https://botto-efbfd.firebaseio.com"
})

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

//var database = firebase.database();
var database = admin.database();
var logref = database.ref('log');
var errorlogref = database.ref('log/error');

var ref = database.ref('challenge/times');
ref.on("value", function (snapshot) {
    challengedata = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
var profileref = database.ref('challenge/profiles');
profileref.on("value", function (snapshot) {
    profiledata = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});
var feedbackref = database.ref('challenge/feedback');
feedbackref.on("value", function (snapshot) {
    feedbackdata = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});
var tourney_races = database.ref('tourney/races');
tourney_races.on("value", function (snapshot) {
    tourney_races_data = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
var tourney_matches = database.ref('tourney/matches')
tourney_matches.on("value", function (snapshot) {
    tourney_matches_data = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
var tourney_scheduled = database.ref('tourney/scheduled')
tourney_scheduled.on("value", function (snapshot) {
    tourney_scheduled_data = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
var tourney_participants = database.ref('tourney/participants')
tourney_participants.on("value", function (snapshot) {
    tourney_participants_data = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
var tourney_tournaments = database.ref('tourney/tournaments')
tourney_tournaments.on("value", function (snapshot) {
    tourney_tournaments_data = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
var tourney_rulesets = database.ref('tourney/rulesets')
tourney_rulesets.on("value", function (snapshot) {
    tourney_rulesets_data = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject);
});
client.ws.on('INTERACTION_CREATE', async interaction => {
    if (interaction.data.hasOwnProperty("name")) {
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
                        content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)]
                    }
                }
            })
        }
    } else if (interaction.data.hasOwnProperty("custom_id")) {
        var split = interaction.data.custom_id.split("_")
        const name = split[0]
        const args = split.slice(1)

        try {
            client.buttons.get(name).execute(client, interaction, args);
        } catch (error) {
            console.error(error);
        }

    }
})

async function getCommands() {
    const guildcommands = await client.api.applications("545798436105224203").guilds('441839750555369474').commands.get()
    const commands = await client.api.applications("545798436105224203").commands.get()
    console.log(guildcommands)
    console.log(commands)
}

//getCommands()
//client.api.applications("545798436105224203").guilds('441839750555369474').commands("").delete()

client.once('ready', () => {
    console.log('Ready!')
    //set bot activity
    client.user.setActivity("/help");
    //client.users.cache.get("256236315144749059").send("Ready!")
    client.channels.cache.get("444208252541075476").messages.fetch({ limit: 1 }).then(messages => {
        let lastMessage = messages.first();

        if (lastMessage.author.bot) {
            lastMessage.delete().catch(err => console.log(err));
        }
    })
        .catch(console.error);
    client.channels.cache.get("444208252541075476").send("Deployed <t:" + Math.round(Date.now() / 1000) + ":R>");
    try {
        //client.commands.get("scrape").execute();
    } catch {
        console.error(error);
    }
    const updater = async () => {
        const rp = require('request-promise');
        const $ = require('cheerio');
        const url = 'http://speedgaming.org/swe1racer/';
        const fs = require('fs');
        rp(url)
            .then(function (html) {
                var table = $('tbody', html)
                var schedule = []
                $('tr', table).each((i, elem) => {
                    var text = $('td', elem).text().replace(/\t/g, "").split(/\n/)
                    for (var i = 0; i < text.length; i++) {
                        if (text[i] == "") {
                            text.splice(i, 1)
                            i = i - 1
                        }
                    }
                    schedule.push(text)
                })
                schedule.splice(0, 1)
                var datetimes = []
                if (schedule.length > 0) {
                    for (i = 0; i < schedule.length; i++) {
                        var data = {}
                        data.commentators = []
                        data.players = []
                        var comm = ""
                        function getParticipantbyName(name) {
                            var ptc = Object.keys(tourney_participants_data)
                            for (k = 0; k < ptc.length; k++) {
                                var p = ptc[k]
                                if (tourney_participants_data[p].name == name.trim()) {
                                    return p
                                }
                            }
                            return name
                        }
                        if (schedule[i].length > 4) {
                            if (!schedule[i][4].includes("?")) {
                                data.url = "https://www.twitch.tv/" + schedule[i][4]
                            }
                            if (schedule[i][5] !== undefined) {
                                comm = schedule[i][5].split(",")
                                if (comm.length > 0) {
                                    for (j = 0; j < comm.length; j++) {
                                        data.commentators.push(getParticipantbyName(comm[j]))
                                    }
                                }
                            }
                        }
                        var datetime = new Date(schedule[i][0].replace(", ", " " + new Date().getFullYear() + " ") + schedule[i][1].replace(" ", " ") + " EDT").toUTCString()//this stupid 'no-break' space was messing up Date.parse and I was losing my mind
                        data.datetime = datetime
                        datetimes.push(data.datetime)
                        data.bracket = schedule[i][2]
                        var players = schedule[i][3].split(",")
                        if (players.length > 0) {
                            for (j = 0; j < players.length; j++) {
                                data.players.push({
                                    player: getParticipantbyName(players[j]),
                                    permabans: [],
                                    score: null
                                })
                            }
                        }
                        var dup = false
                        if (![undefined, null].includes(tourney_scheduled_data)) {
                            var tsd = Object.keys(tourney_scheduled_data)

                            for (j = 0; j < tsd.length; j++) {
                                var s = tsd[j]
                                if (tourney_scheduled_data[s].datetime == datetime) {
                                    tourney_scheduled.child(s).update(data)
                                    dup = true
                                    j = tsd.length
                                }
                            }
                        }
                        if (!dup) {
                            data.stream_notification = false
                            tourney_scheduled.push(data)
                        }
                    }
                    /*if (![undefined, null].includes(tourney_scheduled_data)) {
                        var tsd = Object.keys(tourney_scheduled_data)
                        for (var i = 0; i < tsd.length; i++) {
                            var s = tsd[i]
                            if (!datetimes.includes(tourney_scheduled_data[s].datetime)) {
                                tourney_scheduled.child(s).remove()
                            }
                        }
                    }*/
                } else {
                    //delete all scheduled
                }
                var tsd = Object.keys(tourney_scheduled_data)
                for (i = 0; i < tsd.length; i++) {
                    var s = tsd[i]
                    if (tourney_scheduled_data[s].stream_notification == false && Date.parse(tourney_scheduled_data[s].datetime) <= Date.now() + 1000 * 60 * 5 && Date.now() <= Date.parse(tourney_scheduled_data[s].datetime + 1000 * 60 * 10)) {
                        var players = []
                        var commentators = []
                        Object.values(tourney_scheduled_data[s].commentators).forEach(c => {
                            commentators.push(tourney_participants_data[c].name)
                        })
                        Object.values(tourney_scheduled_data[s].players).forEach(p => {
                            players.push(tourney_participants_data[p.player].name)
                        })
                        if (commentators.length == 0) {
                            commentators.push("WhyNobodyCommentate")
                        }
                        client.channels.cache.get("515311630100463656").send("<@&841059665474617353>\n**" + tourney_scheduled_data[s].bracket + ": " + players.join(" vs. ") + "**\n:microphone2: " + commentators.join(", ") + "\n" + tourney_scheduled_data[s].url);
                        tourney_scheduled.child(s).child("stream_notification").set(true)
                    }
                }
            })
        setTimeout(updater, 1000 * 60)
    }
    updater()
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
        var random = Math.floor(Math.random() * welcomeMessages.length)
        var join = welcomeMessages[random]
        client.channels.cache.get("441839751235108875").send(join.replace("replaceme", "<@" + guildMember.user + ">"));
        const guild = client.guilds.cache.get("441839750555369474");
        const role = guild.roles.cache.get("442316203835392001");
        let member = guildMember
        member.roles.add(role).catch(console.error);
    }
})
/*
client.on('guildMemberRemove', (guildMember) => { //join log
    if (guildMember.guild.id == "441839750555369474") {
        const memberLeft = new Discord.MessageEmbed()
        memberLeft
            .setTitle("Member Left")
            .setDescription(guildMember.user.username + " has left the server")
        client.channels.cache.get("892664227553243157").send(memberLeft);
    }
})
*/
client.on("messageDelete", async messageDelete => {
    console.log("message deleted")
    if (!messageDelete.guild) return;

    if (messageDelete.author.bot == false && messageDelete.channel.type == "text" && messageDelete.guild.id == "441839750555369474") {

        var channelname = ""
        for (var i = 0; i < discordchannels.length; i++) {
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

        //taken from https://discordjs.guide/popular-topics/audit-logs.html#who-deleted-a-message
        var deleter = "unknown"
        const fetchedLogs = await messageDelete.guild.fetchAuditLogs({
            limit: 1,
            type: 'MESSAGE_DELETE',
        });
        const deletionLog = fetchedLogs.entries.first();
        if (deletionLog) {
            const { executor, target } = deletionLog;
            if (target.id === messageDelete.author.id) {
                deleter = executor.tag
            } 
            const deletedMessage = new Discord.MessageEmbed()
            deletedMessage
                .setTitle("Deleted Message")
                .addField("Author", "<@" + data.user + ">")
                .addField("Deleted By", deleter)
                .addField("Channel", "<#" + data.channel + ">")
                .addField("Content", data.message)
            client.channels.cache.get("892664227553243157").send(deletedMessage);
        }

    }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
    if (oldMessage.author.bot == false && oldMessage.channel.type == "text" && oldMessage !== newMessage && oldMessage.guild.id == "441839750555369474") {
        var channelname = ""
        for (var i = 0; i < discordchannels.length; i++) {
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
});

// when a user joins/leaves a voice channel
client.on('voiceStateUpdate', (oldState, newState) => {

    let newUserChannel = newState.channel
    let oldUserChannel = oldState.channel
    var chan = client.channels.cache.get('441840193754890250');
    //get list of members in voice channel
    if (chan !== undefined) {
        var mems = chan.members;
        var arr = [];
        for (let [snowflake, guildMember] of mems) {
            if (guildMember.displayName !== "Botto") {
                arr.push(guildMember)
            }

        }

    }

    //if member joins Multiplayer Lobby 1
    if (oldState == undefined && newState.channelID == "441840193754890250" && newState.member.id !== "545798436105224203") {
        //random welcome message based on how many members are in voice channel
        if (arr.length == 1) {
            var random = Math.floor(Math.random() * 2)
        } else if (arr.length == 2) {
            var random = Math.floor(Math.random() * 3) + 2
        } else if (2 < arr.length < 5) {
            var random = Math.floor(Math.random() * 9) + 5
        } else if (4 < arr.length < 8) {
            var random = Math.floor(Math.random() * 6) + 14
        } else if (7 < arr.length) {
            var random = Math.floor(Math.random() * 4) + 17
        }
        var str = welcomeMessages[random]
        client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + newState.member + ">"))
    }
    //if member is already in any voice channel
    if (oldUserChannel !== undefined) {
        //member leaves multiplayer or troubleshooting channel
        const voicecon = client.guilds.cache.get("441839750555369474")
        if (voicecon.voice !== null) {
            if ((oldState.channelID == "441840193754890250" || oldState.channelID == "441840753111597086") && newState == undefined) {
                random = Math.floor(Math.random() * goodbyeMessages.length)
                random2 = Math.floor(Math.random() * voiceFarewell.length)
                var str = goodbyeMessages[random]
                client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + oldState.member + ">"))
            }
        }
        //member is moving from one channel to another
        if (newState !== undefined) {
            //member moves from multiplayer to troubleshooting
            if (oldState.channelID == "441840193754890250" && newState.channelID == "441840753111597086" && newState.member.id !== "288258590010245123" && newState.member.id !== "545798436105224203") {
                random = Math.floor(Math.random() * troubleShooting.length)
                random2 = Math.floor(Math.random() * voiceTrouble.length)
                var str = troubleShooting[random]
                client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + oldState.member + ">"))
            }
            //member moves back from troubleshooting to multiplayer
            if (oldState.channelID == "441840753111597086" && newState.channelID == "441840193754890250" && newState.member.id !== "288258590010245123" && newState.member.id !== "545798436105224203") {
                random = Math.floor(Math.random() * fixed.length)
                random2 = Math.floor(Math.random() * voiceFixed.length)
                var str = fixed[random]
                client.channels.cache.get("551786988861128714").send(str.replace("replaceme", "<@" + oldState.member + ">"))
            }
        }
    }
})

client.on('message', message => {
    if (message.author.bot) return; //trumps any command from executing from a bot message

    if (message.content == `${prefix}guilds`) {
        console.log(client.guilds.cache)
        //console.log(client.guilds.cache.get("697833083201650689"))
    }

    if (message.content.toLowerCase() == `${prefix}botto`) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
            .setTitle("Botto")
            .setFooter("/botto")
            .setDescription("Botto is a protocol droid developed by LightningPirate#5872 for the [Star Wars Episode I: Racer Discord](https://discord.gg/BEJACxXQWz). His purpose is to enhance your Star Wars Episode I: Racer gameplay. This bot can also be found on **" + String(Number(client.guilds.cache.size) - 1) + "** other servers.")
            .addField("Features", "Botto uses Discord's integrated slash commands feature for bots. Type forward slash ('/') to see a full list of commands including several `/lookup` and `/random` commands for SWE1R content. He is also capable of getting leaderboard data from [speedrun.com](https://www.speedrun.com/swe1r) with the `/src` command and tournament leaderboards using the `/tourney` command. Another popular feature is the `/challenge` command which calls randomly generated challenges and saves submitted times.", false)
            .addField("Invite", "To invite Botto to your server with slash commands, [click here](https://discord.com/api/oauth2/authorize?client_id=545798436105224203&permissions=0&scope=bot%20applications.commands).", false)
            .addField("Github", "To view Botto's github page, [click here](https://github.com/louriccia/Botto).", false)
            .addField("Feedback", "[Request a feature](https://github.com/louriccia/Botto/discussions/3) or [give your feedback](https://github.com/louriccia/Botto/discussions/4) on using the bot by commenting on the linked discussion posts.", false)
            .setColor("#7289DA")
            .setThumbnail(client.user.avatarURL())
        message.channel.send(myEmbed)
    }

    if (message.content.toLowerCase() == `${prefix}kill` && message.channelID == "444208252541075476") {
        message.channel.send("Come back when you got some money!")
        client.destroy()
    }
})


client.login(process.env.token);