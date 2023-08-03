const fs = require('fs');
const Discord = require('discord.js');
const { Client, Events, GatewayIntentBits } = require('discord.js')
const { Configuration, OpenAIApi } = require("openai")

//const { token, firebaseCon, OPENAI_API_KEY } = require('./config.json');
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

var { errorMessage } = require("./data.js");
var tourneylookup = require("./tourneydata.js");
var tools = require('./tools.js');
const { betEmbed, betComponents } = require('./buttons/trugut_functions.js')
var moment = require('moment');
const { dailyChallenge, monthlyChallenge, dailyBounty } = require("./buttons/challenge/functions")
const { banners } = require('./data.js')
client.commands = new Discord.Collection();
client.buttons = new Discord.Collection();
client.selects = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const buttonFiles = fs.readdirSync('./buttons').filter(file => file.endsWith('.js'));
const testing = false
const openai = new OpenAIApi(new Configuration({
    apiKey: testing ? OPENAI_API_KEY : process.env.OPENAI_API_KEY,
}));
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
const { postMessage, editMessage } = require('./discord_message.js');

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

    if ((testing && interaction.guildId == '1135800421290627112') || (!testing && interaction.guildId !== '1135800421290627112')) {
        console.log(interaction.isChatInputCommand() ? 'slash' :
            interaction.isButton() ? 'button' :
                interaction.isMessageComponent() ? 'message_component' :
                    interaction.isModalSubmit() ? 'modal_submit' :
                        'other', interaction.isChatInputCommand() ? interaction?.commandName?.toLowerCase() : interaction.customId, interaction.member.displayName)

        if (interaction.isChatInputCommand()) {
            const command = interaction.commandName.toLowerCase();

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
    if (!testing) {
        client.channels.cache.get("444208252541075476").messages.fetch({ limit: 1 }).then(messages => {
            let lastMessage = messages.first();

            if (lastMessage.author.bot) {
                lastMessage.delete().catch(err => console.log(err));
            }
        })
            .catch(console.error);
    }
    client.channels.cache.get(testing ? "1135800422066556940" : "444208252541075476").send("Deployed <t:" + Math.round(Date.now() / 1000) + ":R>");

    database.ref('users').once("value", function (snapshot) {
        let users = snapshot.val()
        client.guilds.fetch("441839750555369474").then(guild => {
            try {
                guild.members.fetch({ force: true }).then(members => {
                    Object.keys(users).forEach(async function (key) {
                        let user = users[key];
                        if (user.discordID && guild.members.cache.some(m => m == user.discordID)) {
                            guild.members.fetch({ user: user.discordID, force: true }).then(member => {
                                // Storing role IDs in the 'roles' array
                                const roles = member.roles.cache.map(role => role.id);

                                database.ref('users').child(key).child('avatar').set(member.displayAvatarURL())
                                database.ref('users').child(key).child('discord').update({
                                    displayName: member.displayName,
                                    joinedTimestamp: member.joinedTimestamp,
                                    nickname: member.nickname,
                                    tag: member.user.tag,
                                    roles: roles, // Adding the roles array to the user's data
                                });
                            });
                        }
                    });
                });
            } catch (e) {
                console.log(e);
            }
        });
    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });

    if (false && !testing) {
        try {
            client.commands.get("scrape").execute(client, database);
        } catch (error) {
            console.log(error);
        }
    }


    const Guild = await client.guilds.cache.get("441839750555369474")

    await Guild.edit({ banner: banners[Math.floor(Math.random() * banners.length)] })

    const updater = async () => {


        dailyChallenge({ client, sponsordata, challengetimedata, challengesref: database.ref('challenge/challenges'), challengesdata })
        monthlyChallenge({ client, sponsordata, challengetimedata, challengesref: database.ref('challenge/challenges'), challengesdata })
        dailyBounty({ client, bountydata, bountyref: database.ref('challenge/bounties') })

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
            let ptc = Object.keys(users)
            return ptc.find(key => users[key].sgName === name.trim()) ?? ""
        }

        rp(url)
            .then(function (html) {
                let table = cheerio('tbody', html)
                let guildevents = Guild.scheduledEvents.cache
                let events = guildevents.toJSON()
                let values = []
                Object.keys(tourney_scheduled_data).forEach(key => {
                    database.ref('tourney/scheduled').child(key).update({ current: false })
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
                                let split = content.split(/[^A-Za-z0-9_ ]+/g)
                                split.map(comm => getParticipantbyName(comm)).filter(c => ![null, undefined, ''].includes(c)).forEach(c => {
                                    match.commentators[c] = users[c].discordID ?? ''
                                })
                            } else if (values[j].includes("date")) {
                                match.datetime = Date.parse(content.replace(", ", " " + new Date().getFullYear() + " ").replace(" ", " ") + " EDT")
                            } else if (values[j].includes("players")) {
                                let split = content.split(/[^A-Za-z0-9_ ]+/g).map(f => f.split(" vs ")).flat()
                                split.map(play => getParticipantbyName(play)).filter(p => ![null, undefined, ''].includes(p)).forEach(p => {
                                    match.players[p] = users[p].discordID ?? ''
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
                                    database.ref('tourney/scheduled').child(key).update(match)
                                    dup = true
                                }
                            })
                        }
                        if (!dup) {
                            match.notification = false
                            match.current = true
                            database.ref('tourney/scheduled').push(match)
                        }
                    }
                })
                function matchDesc(match) {
                    return (match.commentators && Object.keys(match.commentators).length > 0 ? "🎙️ " + Object.keys(match.commentators).map(id => users[id].name).join(", ") : "Sign up for commentary: https://speedgaming.org/swe1racer/crew/") +
                        (match.tourney ? `\n${tourney_tournaments_data[match.tourney]?.name ?? ""}` : "") +
                        (!match.url ? "\n(Channel to be determined)" : "")
                }
                function matchTitle(match) {
                    let round = tourney_tournaments_data[match.tourney]?.stages[match.bracket] ?? null
                    return (round ? `${round.bracket} ${round.round}: ` : '') + (match.players ? Object.keys(match.players).map(id => users[id].name).join(" vs ") : 'Unknown Players')
                }
                Object.keys(tourney_scheduled_data).map(key => {
                    let match = tourney_scheduled_data[key]

                    let eventdup = false
                    events.forEach(event => {

                        if (event.scheduledStartTimestamp == match.datetime) {
                            eventdup = true
                            database.ref('tourney/scheduled').child(key).update({ event: event.id })
                            if (event.status == 1) {
                                try {
                                    Guild.scheduledEvents.fetch(event.id).then(event => event.edit({
                                        name: matchTitle(match),
                                        description: matchDesc(match),
                                        entityType: 3,
                                        entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) }
                                    }))
                                } catch {
                                    console.log("failed to edit scheduled event")
                                }
                            }
                        }
                    })
                    if (!eventdup && match.current && match.datetime > Date.now()) {
                        Guild.scheduledEvents.create({
                            name: matchTitle(match),
                            scheduledStartTime: match.datetime,
                            scheduledEndTime: match.datetime + 1000 * 60 * 60,
                            entityType: 3,
                            description: matchDesc(match),
                            entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) },
                            privacyLevel: 2
                        })
                    }
                })

                Object.keys(tourney_scheduled_data).forEach(async key => {
                    let match = tourney_scheduled_data[key]

                    //truguts
                    if (match.current && !match.bet && match.datetime <= Date.now() + 1000 * 60 * 60 * 48 && Date.now() <= match.datetime + 1000 * 60 * 10 && Object.values(match.players).length == 2) {
                        //post bet
                        let players = Object.keys(match.players)
                        let bet = {
                            author: {
                                name: 'Botto',
                                avatar: 'https://cdn.discordapp.com/avatars/545798436105224203/5e4668356877db6367e4f51017124aaa.webp',
                                id: '',
                                discordId: '545798436105224203'
                            },
                            title: matchTitle(match),
                            status: "open",
                            type: 'tourney',
                            close: match.datetime,
                            outcome_a: {
                                title: `${users[players[0]].name} Wins`,
                                id: match.players[players[0]]
                            },
                            outcome_b: {
                                title: `${users[players[1]].name} Wins`,
                                id: match.players[players[1]]
                            },
                            min: 10,
                            max: 100000
                        }
                        const betMessage = await postMessage(client, '536455290091077652', { embeds: [betEmbed(bet)], components: betComponents(bet), fetchReply: true })
                        database.ref('tourney/bets').child(betMessage.id).set(bet)
                        database.ref('tourney/scheduled').child(key).child("bet").set(betMessage.id)
                    }

                    //close bets
                    if (match.datetime < Date.now() && match.bet && betdata[match.bet]?.status == 'open') {
                        database.ref('tourney/bets').child(match.bet).child('status').set('closed')
                        editMessage(client, '536455290091077652', match.bet, { embeds: [betEmbed(betdata[match.bet])], components: betComponents(betdata[match.bet]) })
                    }

                    // match setup 
                    if (match.current && match.notification == false && match.datetime <= Date.now() + 1000 * 60 * 30 && Date.now() <= match.datetime + 1000 * 60 * 10) {
                        database.ref('tourney/scheduled').child(key).child("notification").set(true)
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
                        database.ref('tourney/live').child("970994773517299712").set({ ...match, current_race: 0, bracket: "", status: 'setup', firstvote: "", tourney: "", ruleset: "", stream: match.url })
                        function getUserNameByDiscordID(id) {
                            return Object.values(users).find(u => u.discordID == id)?.name ?? ''
                        }
                        postMessage(
                            client,
                            "515311630100463656",
                            `<@&841059665474617353>\n**${Object.values(match.players).map(p => getUserNameByDiscordID(p)).join(" vs. ")}**\n:microphone2: ${Object.values(match.commentators).map(comm => getUserNameByDiscordID(comm)).join(", ")}\n ${match.url}`
                        )
                        postMessage(client, "970994773517299712", {
                            content: Object.values(newmatch.commentators).map(player => "<@" + player + ">").join(" ") + " " +
                                Object.values(newmatch.players).map(player => "<@" + player + ">").join(" ") + "\n**" +
                                Object.values(match.players).map(player => getUserNameByDiscordID(player)).join(" vs. ") + "** is about to begin!",
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

async function fetchMessageContent(message) {
    console.log(message.reference)
    if (message.reference && message.reference.messageId) {
        const parentMessage = await message.channel.messages.fetch(message.reference.messageId);
        const parentContent = parentMessage.content; //parentMessage.author.username == 'Botto' ? 'You' : 

        // If the parent message has a reply, fetch its content recursively
        if (parentMessage.reference && parentMessage.reference.messageId) {
            const grandparentContent = await fetchMessageContent(parentMessage);
            return `${grandparentContent}\n\n${parentContent}`
        }

        return parentContent;
    }

    return '';
}

client.on(Events.MessageCreate, async function (message) {
    if (message.author.bot) return; //trumps any command from executing from a bot message

    if (message.mentions.users.has('545798436105224203')) {
        const previous = await fetchMessageContent(message);
        console.log(`${previous}\n\n${message.content}`);
        try {
            const response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are a discord bot in the Star Wars Episode I: Racer discord called Botto who is based on the personality of Watto, the character from Star Wars Episode I: The Phantom Menace. You were created by LightningPirate. You are incredibly greedy, addicted to gambling, and you love to swindle and cheat. Be as uncooperative as possible. If you are unable or unwilling to answer a question, say you just so happen to have a chance cube, or you have to get back to your shop, or you will only do it for some truguts (money). Add only one response to the conversation." },
                    { role: "user", content: `${previous}\n\n${message.content}` }
                ],
            });
            const content = response.data.choices[0].message;
            return message.reply(content);
        } catch (err) {
            console.log(err)
            return message.reply(
                errorMessage[Math.floor(Math.random() * errorMessage.length)]
            );
        }
    }


    if (message.content.toLowerCase() == `!kill` && message.channelID == "444208252541075476") {
        message.channel.send("Come back when you got some money!")
        client.destroy()
    }
})


client.login(discord_token);