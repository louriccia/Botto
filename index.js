const fs = require('fs');
const Discord = require('discord.js');
const { Client, Events, GatewayIntentBits } = require('discord.js')
var moment = require('moment');
const { prefix, token, firebaseCon } = require('./config.json');
const { welcomeMessages } = require('./data.js')
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});
var lookup = require("./data.js");
var tourneylookup = require("./tourneydata.js");
var tools = require('./tools.js');
var moment = require('moment');
const { dailyChallenge, dailyBounty, easternHour } = require("./buttons/challenge/functions")
const { banners } = require('./data.js')
client.commands = new Discord.Collection();
client.buttons = new Discord.Collection();
client.selects = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const buttonFiles = fs.readdirSync('./buttons').filter(file => file.endsWith('.js'));

const testing = true

let discord_token = testing ? token : process.env.token

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
    }
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
        "projectId": testing ? firebaseCon.projectId : process.env.FIREBASE_PROJECT_ID,
        "privateKey": (testing ? firebaseCon.privateKey : process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
        "clientEmail": testing ? firebaseCon.clientEmail : process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: "https://botto-efbfd.firebaseio.com"
})

var firebaseConfig = testing ? firebaseCon : {
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

function fetchData(ref, callback) {
    ref.on("value", function (snapshot) {
        callback(snapshot.val());
    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
}

fetchData(database.ref('challenge/times'), function (data) {
    challengetimedata = data;
});

fetchData(database.ref('challenge/profiles'), function (data) {
    profiledata = data;
});

fetchData(database.ref('challenge/challenges'), function (data) {
    challengesdata = data;
});

fetchData(database.ref('challenge/feedback'), function (data) {
    feedbackdata = data;
});

fetchData(database.ref('challenge/bounties'), function (data) {
    bountydata = data;
});

fetchData(database.ref('challenge/sponsorships'), function (data) {
    sponsordata = data;
});

fetchData(database.ref('tourney/races'), function (data) {
    tourney_races_data = data;
});

fetchData(database.ref('tourney/matches'), function (data) {
    tourney_matches_data = data;
});

fetchData(database.ref('tourney/scheduled'), function (data) {
    tourney_scheduled_data = data;
});

fetchData(database.ref('tourney/tournaments'), function (data) {
    tourney_tournaments_data = data;
});

fetchData(database.ref('tourney/rulesets'), function (data) {
    tourney_rulesets_data = data;
});

fetchData(database.ref('tourney/live'), function (data) {
    tourney_live_data = data;
});

fetchData(database.ref('speedruns'), function (data) {
    speedruns_data = data;
});

fetchData(database.ref('tourney/bets'), function (data) {
    betdata = data;
});

fetchData(database.ref('users'), function (data) {
    users = data;
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = interaction.commandName.toLowerCase();
        console.log(command)
        //command handler
        if (!client.commands.has(command)) {
            console.log('command does not exist')
            return;
        }
        try {
            client.commands.get(command).execute(interaction, database);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)] })
        }
    } else {
        let split = interaction.customId.split("_")
        const name = split[0]
        const args = split.slice(1)

        try {
            client.buttons.get(name).execute(client, interaction, args, database);
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

client.once(Events.ClientReady, async () => {
    console.log('Ready!')

    //set bot activity
    client.user.setActivity("/help");
    client.channels.cache.get("444208252541075476").messages.fetch({ limit: 1 }).then(messages => {
        let lastMessage = messages.first();

        if (lastMessage.author.bot) {
            lastMessage.delete().catch(err => console.log(err));
        }
    })
        .catch(console.error);
    client.channels.cache.get("444208252541075476").send("Deployed <t:" + Math.round(Date.now() / 1000) + ":R>");
    try {
        client.commands.get("scrape").execute(client, database);
    } catch {
        console.error("scrape failed");
    }

    const Guild = await client.guilds.cache.get("441839750555369474")

    await Guild.edit({ banner: banners[Math.floor(Math.random() * banners.length)] })

    const updater = async () => {


        dailyChallenge({ client, sponsordata, challengetimedata, challengesref, challengesdata })
        dailyBounty({ client, bountydata, bountyref })

        Object.values(challengesdata).forEach(challenge => {
            if (challenge.type == 'cotd' && Date.now() - 24 * 60 * 60 * 1000 > challenge.created && challenge.channel == '551786988861128714' && challenge.message) {
                client.channels.cache.get('551786988861128714').messages.fetch(challenge.message).then(msg => { if (msg.pinned) { msg.unpin().catch(console.error) } })
            }
        })

        Object.values(bountydata).forEach(bounty => {
            if (bounty.type == 'botd' && Date.now() - 24 * 60 * 60 * 1000 > bounty.created && bounty.channel == '551786988861128714' && bounty.message) {
                client.channels.cache.get('551786988861128714').messages.fetch(bounty.message).then(msg => { if (msg.pinned) { msg.unpin().catch(console.error) } })
            }
        })

        const rp = require('request-promise');
        const cheerio = require('cheerio').default;
        const url = 'http://speedgaming.org/swe1racer/';
        const fs = require('fs');
        const livechannel = "515311630100463656"
        function getParticipantbyName(name) {
            let ptc = Object.keys(users_data)
            for (k = 0; k < ptc.length; k++) {
                let p = ptc[k]
                if ((users_data[p].name ?? '').toLowerCase() == name.trim().toLowerCase()) {
                    return p
                }
            }
            return null
        }

        rp(url)
            .then(function (html) {
                let table = cheerio('tbody', html)
                let events = Guild.scheduledEvents.cache.toJSON()
                let values = []
                Object.keys(tourney_scheduled_data).forEach(key => {
                    tourney_scheduled.child(key).update({ current: false })
                })
                cheerio('tr', table).each((i, elem) => { //for each row
                    let match = { commentators: {}, players: {} }
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
                                console.log(content)
                                console.log(content.split(/[^A-Za-z_ ]/g))
                                content.split(/[^A-Za-z_ ]+/g).map(comm => getParticipantbyName(comm)).filter(c => ![null, undefined, ''].includes(c)).forEach(c => {
                                    match.commentators[c] = users_data[c].discordID ?? ''
                                })
                            } else if (values[j].includes("date")) {
                                match.datetime = Date.parse(content.replace(", ", " " + new Date().getFullYear() + " ").replace(" ", " ") + " EDT")
                            } else if (values[j].includes("players")) {
                                console.log(content)
                                console.log(content.split(/[^A-Za-z_ ]/g))
                                content.split(/[^A-Za-z_ ]/g).map(play => getParticipantbyName(play)).filter(p => ![null, undefined, ''].includes(p)).forEach(p => {
                                    match.players[p] = users_data[p].discordID ?? ''
                                })
                            } else {
                                match[values[j]] = content
                            }
                        }
                    })
                    if (i !== 0) {
                        let dup = false
                        if (tourney_scheduled_data) {
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
                                        name: match.players ? Object.keys(match.players).map(id => users_data[id].name).join(" vs ") : 'Unknown Players',
                                        description: "Commentary: " + (match.commentators && Object.keys(match.commentators).length > 0 ? Object.keys(match.commentators).map(id => users_data[id].name).join(", ") : ""),
                                        entityType: 3,
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
                            name: match.players ? Object.keys(match.players).map(id => users_data[id].name).join(" vs ") : 'Unknown Players',
                            scheduledStartTime: match.datetime,
                            scheduledEndTime: match.datetime + 1000 * 60 * 60,
                            entityType: 3,
                            description: "Commentary: " + (match.commentators && Object.keys(match.commentators).length > 0 ? Object.keys(match.commentators).map(id => users_data[id].name).join(", ") : ""),
                            entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) },
                            privacyLevel: 2
                        })
                    }
                })

                Object.keys(tourney_scheduled_data).forEach(key => {
                    let match = tourney_scheduled_data[key]

                    //truguts
                    if (match.current && !match.truguts && match.datetime <= Date.now() + 1000 * 60 * 60 * 24 && Date.now() <= match.datetime + 1000 * 60 * 10) {
                        //post trugut
                    }

                    //match setup 
                    if (match.current && match.notification == false && match.datetime <= Date.now() + 1000 * 60 * 10 && Date.now() <= match.datetime + 1000 * 60 * 10) {
                        tourney_scheduled.child(key).child("notification").set(true)
                        //add roles
                        let everybody = Object.values(match.players).concat(Object.values(match.commentators))
                        everybody.forEach(async function (player) {
                            const thismember = await Guild.members.fetch(player)
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
                            players: match.players,
                            commentators: match.commentators,
                            stream: match.url,
                            firstvote: ""
                        }
                        tourney_live.child("970994773517299712").set(newmatch)
                        client.api.channels("515311630100463656").messages.post({
                            data: {
                                content: "<@&841059665474617353>\n**" + Object.keys(match.players).map(p => users_data[p].name).join(" vs. ") + "**\n:microphone2: " + Object.values(match.commentators).map(comm => users_data[comm].name).join(", ") + "\n" + match.url
                            }
                        })
                        client.api.channels("970994773517299712").messages.post({
                            data: {
                                content: Object.values(newmatch.commentators).map(player => "<@" + player + ">").join(" ") + " " +
                                    Object.values(newmatch.players).map(player => "<@" + player + ">").join(" ") + "\n**" +
                                    Object.values(match.players).map(player => users_data[player].name).join(" vs. ") + "** is about to begin!",
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
    }
    setInterval(updater, 1000 * 60)
})

client.on("error", (e) => {
    console.error(e)
    var data = {
        date: Date(),
        error: e
    }
    errorlogref.push(data)
});

client.on(Events.GuildMemberAdd, (guildMember) => { //join log
    if (guildMember.guild.id == "441839750555369474") {
        console.log('new join')
        let join = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
        client.channels.cache.get("441839751235108875").send(join.replaceAll("replaceme", "<@" + guildMember.user + ">"));
        const guild = client.guilds.cache.get("441839750555369474");
        const role = guild.roles.cache.get("442316203835392001");
        let member = guildMember
        member.roles.add(role).catch(console.error);
    }
})
client.on(Events.GuildBanAdd, (guildMember) => { //ban log
    if (guildMember.guild.id == "441839750555369474") {
        client.channels.cache.get("892664227553243157").send(`*${guildMember.username} was banished because they were clumsy.*`);
    }
})

client.on(Events.MessageDelete, async messageDelete => {
    if (!messageDelete.guild) return;

    if (messageDelete.author.bot == false && messageDelete.channel.type == "text" && messageDelete.guild.id == "441839750555369474" && messageDelete.channelId !== "444208252541075476") {
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

client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
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


client.login(discord_token);