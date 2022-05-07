const fs = require('fs');
const Discord = require('discord.js');
const { Client, Intents } = require('discord.js')
const { prefix, token } = require('./config.json');
const client = new Discord.Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
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
var tourney_live = database.ref('tourney/live')
tourney_live.on("value", function (snapshot) {
    tourney_live_data = snapshot.val();
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
        const cheerio = require('cheerio');
        //var cheerio = require('cheerio').default
        const url = 'http://speedgaming.org/swe1racer/';
        const fs = require('fs');
        const livechannel = "515311630100463656"

        function getParticipantbyName(name) {
            let ptc = Object.keys(tourney_participants_data)
            for (k = 0; k < ptc.length; k++) {
                let p = ptc[k]
                if (tourney_participants_data[p].name == name.trim()) {
                    return p
                }
            }
            return name
        }

        rp(url)
            .then(function (html) {
                let table = cheerio('tbody', html)
                const Guild = client.guilds.cache.get("441839750555369474")
                let events = Guild.scheduledEvents.cache.toJSON()
                let values = []

                Object.keys(tourney_scheduled_data).forEach(key => {
                    tourney_scheduled.child(key).update({ current: false })
                })

                cheerio('tr', table).each((i, elem) => { //for each row
                    let match = {}
                    cheerio('td', elem).each((j, cell) => { //for each cell, populate match
                        let content = cheerio(cell).text().trim().replace(/\t/g, "").replace(/\n/g, "")
                        if (i == 0) {
                            values.push(content.replace(/ /g, "").toLowerCase().replace("(edt)", ""))
                        } else {
                            if (values[j].includes("channel")) {
                                if (content !== "?") {
                                    match.url = "https://www.twitch.tv/" + content
                                } else {
                                    match.url = ""
                                }
                            } else if (values[j].includes("comm")) {
                                match.commentary = content.split(",").map(comm => getParticipantbyName(comm))
                            } else if (values[j].includes("date")) {
                                match.datetime = Date.parse(content.replace(", ", " " + new Date().getFullYear() + " ").replace(" ", " ") + " EDT")
                            } else if (values[j].includes("players")) {
                                match.players = content.split("vs").map(play => getParticipantbyName(play))
                            } else {
                                match[values[j]] = content
                            }
                        }
                    })
                    if (i !== 0) {
                        let dup = false
                        if (![undefined, null].includes(tourney_scheduled_data)) {
                            Object.keys(tourney_scheduled_data).forEach(key => {
                                if (tourney_scheduled_data[key].datetime == match.datetime) {
                                    match.current = true
                                    tourney_scheduled.child(key).update(match)
                                    dup = true
                                }
                            })
                        }
                        if (!dup) {
                            match.notification = false
                            match.current = true
                            tourney_scheduled.push(match)
                        }
                    }
                })
                Object.keys(tourney_scheduled_data).map(key => {
                    let match = tourney_scheduled_data[key]
                    let eventdup = false
                    events.forEach(event => {
                        if (event.scheduledStartTimestamp == match.datetime) {
                            eventdup = true
                            tourney_scheduled.child(key).update({ event: event.id })
                            if (event.status == "SCHEDULED") {
                                try {
                                    Guild.scheduledEvents.edit(Guild.scheduledEvents.resolve(event.id), {
                                        name: match.players.map(id => tourney_participants_data[id].name).join(" vs "),
                                        description: "Commentary: " + Object.values(match.commentary).length > 0 ? Object.values(match.commentary).map(id => tourney_participants_data[id].name).join(", ") : "",
                                        entityType: 'EXTERNAL',
                                        entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) }
                                    })
                                } catch {
                                    console.log("failed to edit scheduled event")
                                }
                            }


                        }
                    })
                    if (!eventdup && match.current && match.datetime > Date.now()) {
                        Guild.scheduledEvents.create({
                            name: match.players.map(id => tourney_participants_data[id].name).join(" vs "),
                            scheduledStartTime: match.datetime,
                            scheduledEndTime: match.datetime + 1000 * 60 * 60,
                            entityType: "EXTERNAL",
                            description: "Commentary: " + Object.values(match.commentary).length > 0 ? Object.values(match.commentary).map(id => tourney_participants_data[id].name).join(", ") : "",
                            entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) },
                            privacyLevel: 'GUILD_ONLY'
                        })
                    }
                })

                Object.keys(tourney_scheduled_data).forEach(key => {
                    let match = tourney_scheduled_data[key]
                    if (match.current && match.notification == false && match.datetime <= Date.now() + 1000 * 60 * 10 && Date.now() <= match.datetime + 1000 * 60 * 10) {
                        tourney_scheduled.child(key).child("notification").set(true)
                        //add roles
                        let everybody = Object.values(match.players).concat(Object.values(match.commentary))
                        everybody.forEach(player => {
                            const thismember = await Guild.members.fetch(tourney_participants_data[player].id)
                            thismember.roles.add('970995237952569404').catch(error => console.log(error))
                        }

                        )
                        //setup match
                        let newmatch = {
                            status: "setup",
                            tourney: "",
                            bracket: "",
                            ruleset: "",
                            datetime: match.datetime,
                            players: match.players.map(player => tourney_participants_data[player].id),
                            commentators: match.commentary.map(player => tourney_participants_data[player].id),
                            stream: match.url,
                            firstvote: ""
                        }
                        tourney_live.child("970994773517299712").set(newmatch)
                        client.api.channels("515311630100463656").messages.post({
                            data: {
                                content: "<@&841059665474617353>\n**" + match.players.join(" vs. ") + "**\n:microphone2: " + match.commentary.join(", ") + "\n" + match.channel + "\nhttps://discord.gg/dWRsGTutSC?event=" + match.event
                            }
                        })
                        client.api.channels("970994773517299712").messages.post({
                            data: {
                                content: "**" + match.players.join(" vs. ") + "** is about to begin!",
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 2,
                                                label: "Set Up Match",
                                                style: 1,
                                                custom_id: "tourney_play_setup",
                                            }
                                        ]
                                    }
                                ]
                            }
                        })
                    }
                })
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