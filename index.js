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
var weeklychallenges = database.ref('weekly/challenges');
var weeklyapproved = database.ref('weekly/submissions');

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
                    content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)]
                }
            }
        })
    }

})

async function getCommands() {
    const guildcommands = await client.api.applications("545798436105224203").guilds('441839750555369474').commands.get()
    const commands = await client.api.applications("545798436105224203").commands.get()
    console.log(guildcommands)
    console.log(commands)
}

//getCommands()


client.once('ready', () => {
    console.log('Ready!')
    //set bot activity
    client.user.setActivity("/help");
    //client.users.cache.get("256236315144749059").send("Ready!")
    client.channels.cache.get("444208252541075476").send("Ready!");
    try {
        //client.commands.get("scrape").execute();
    } catch {
        console.error(error);
    }
    profileref.get().then(function (snapshot) {
        console.log("checking for incomplete challenges...")
        var profiledata = snapshot.val()
        var keys = Object.keys(profiledata)
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i]
            if (profiledata[k].current !== undefined) {
                if (profiledata[k].current.completed == false) {
                    var recovery_channel = client.channels.cache.get(profiledata[k].current.channel)
                    profileref.child(k).child("current").child("completed").set(true)
                    if (profiledata[k].current.message !== undefined) {
                        recovery_channel.messages.fetch(profiledata[k].current.message) //delete old challenge message
                            .then(msg => { msg.delete() }).catch(err => console.log(err));
                    }
                    if (profiledata[k].current.start + 1200000 > Date.now()) {
                        try {
                            var fakeinteraction = {
                                name: "fake",
                                recovery: true,
                                member: {
                                    user: {
                                        id: k,
                                        username: profiledata[k].name
                                    }
                                },
                                guild_id: recovery_channel.guild.id,
                                channel_id: profiledata[k].current.channel
                            }
                            console.log(fakeinteraction)
                            client.commands.get("challenge").execute(client, fakeinteraction, [{ name: "generate" }]);
                        } catch {

                        }
                    }
                }
            }
        }
    });

    //set up role claim message
    const channelId = '442116200147714049'

    const getEmoji = (emojiName) =>
        client.emojis.cache.find((emoji) => emoji.name === emojiName)

    const addReactions = (message, reactions) => {
        message.react(reactions[0])
        reactions.shift()
        if (reactions.length > 0) {
            setTimeout(() => addReactions(message, reactions), 750)
        }
    }

    const emojis = {
        "🏁": 'Multiplayer',
        "⚔️": 'Tournament',
        "🏆": 'Speedrunning',
        "💿": '💿 PC Player',
        "🇳": '🕹️ N64 Player',
        "🇩": '🕹️ Dreamcast Player',
        "🇸": '🎮 Switch Player',
        "🇵": '🎮 PlayStation Player',
        "🇽": '🎮 Xbox Player'
    }

    const reactions = []

    let emojiText = ''
    for (const key in emojis) {
        const emoji = key//getEmoji(key)
        reactions.push(emoji)

        const role = emojis[key]
        reactions.push(emoji)
        emojiText += `${emoji} - ${role}\n`
    }
    var messageID = ""
    client.channels.fetch(channelId).then(c => {
        c.messages.fetch({ limit: 1 }).then(messages => {
            let lastMessage = messages.first();
            if (lastMessage.author.bot) {
                lastMessage.edit(':busts_in_silhouette: **Self-Roles** \nAdd/remove reactions or use the `/role` command to manage your roles.\n\n' + emojiText)
                    .then(m => {
                        addReactions(m, reactions)
                        messageID = lastMessage.id
                    })
            } else {
                c.send(':busts_in_silhouette: **Self-Roles** \nAdd/remove reactions or use the `/role` command to manage your roles.\n\n' + emojiText)
                    .then(m => {
                        addReactions(m, reactions)
                        messageID = m.id
                    })
            }
        })
    })

    const handleReaction = (reaction, user, add) => {
        if (user.id === '545798436105224203') {
            return
        }

        const emoji = reaction._emoji.name

        const { guild } = reaction.message
        const roleName = emojis[emoji]
        if (!roleName) {
            return
        }

        const role = guild.roles.cache.find(role => role.name === roleName)
        const member = guild.members.cache.find(member => member.id === user.id)

        if (add) {
            member.roles.add(role)
        } else {
            member.roles.remove(role)
        }
    }

    client.on('messageReactionAdd', (reaction, user) => {
        if (reaction.message.id === messageID) { //message id goes here
            handleReaction(reaction, user, true)
        }
    })

    client.on('messageReactionRemove', (reaction, user) => {
        if (reaction.message.id === messageID) { //message id goes here
            handleReaction(reaction, user, false)
        }
    })


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

client.on("messageDelete", (messageDelete) => {
    if (messageDelete.author.bot == false && messageDelete.channel.type == "text" && !messageDelete.content.startsWith("!")) {
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
    }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
    emb = newMessage.embeds
    for (i = 0; i < emb.length; i++) {
        if (emb[i].url == "" && newMessage.author.bot == false) {
            client.users.cache.get("256236315144749059").send(`potential spambot: ${messageDelete.author.username} detected in ${messageDelete.channel.id}`)
        }
    }
    if (emb.length == 0) {
        if (oldMessage.author.bot == false && oldMessage.channel.type == "text" && oldMessage !== newMessage) {
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
})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'botto',
    description: 'introduces botto and provides an invite link'
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'challenge',
    description: 'randomly generated challenges',
    options: [
        {
            name: "generate",
            description: "get a random pod/track challenge; 15-minute time limit; submit your time below",
            type: 1,
            options: [
                {
                    name: "bribe_track",
                    description: "request a specific track from Botto for 8400 Truguts",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "The Boonta Training Course",
                            value: "0"
                        },
                        {
                            name: "Mon Gazza Speedway",
                            value: "1"
                        },
                        {
                            name: "Beedo's Wild Ride",
                            value: "2"
                        },
                        {
                            name: "Aquilaris Classic",
                            value: "3"
                        },
                        {
                            name: "Malastare 100",
                            value: "4"
                        },
                        {
                            name: "Vengeance",
                            value: "5"
                        },
                        {
                            name: "Spice Mine Rune",
                            value: "6"
                        },
                        {
                            name: "Sunken City",
                            value: "7"
                        },
                        {
                            name: "Howler Gorge",
                            value: "8"
                        },
                        {
                            name: "Dug Derby",
                            value: "9"
                        },
                        {
                            name: "Scrapper's Run",
                            value: "10"
                        },
                        {
                            name: "Zugga Challenge",
                            value: "11"
                        },
                        {
                            name: "Baroo Coast",
                            value: "12"
                        },
                        {
                            name: "Bumpy's Breakers",
                            value: "13"
                        },
                        {
                            name: "Executioner",
                            value: "14"
                        },
                        {
                            name: "Sebulba's Legacy",
                            value: "15"
                        },
                        {
                            name: "Grabvine Gateway",
                            value: "16"
                        },
                        {
                            name: "Andobi Mountain Run",
                            value: "17"
                        },
                        {
                            name: "Dethro's Revenge",
                            value: "18"
                        },
                        {
                            name: "Fire Mountain Rally",
                            value: "19"
                        },
                        {
                            name: "The Boonta Classic",
                            value: "20"
                        },
                        {
                            name: "Ando Prime Centrum",
                            value: "21"
                        },
                        {
                            name: "Abyss",
                            value: "22"
                        },
                        {
                            name: "The Gauntlet",
                            value: "23"
                        },
                        {
                            name: "Inferno",
                            value: "24"
                        }
                    ]
                },
                {
                    name: "bribe_racer",
                    description: "request a specific racer from Botto for 8400 Truguts",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "Anakin Skywalker",
                            value: "0"
                        },
                        {
                            name: "Teemto Pagalies",
                            value: "1"
                        },
                        {
                            name: "Sebulba",
                            value: "2"
                        },
                        {
                            name: "Ratts Tyerell",
                            value: "3"
                        },
                        {
                            name: "Aldar Beedo",
                            value: "4"
                        },
                        {
                            name: "Mawhonic",
                            value: "5"
                        },
                        {
                            name: "Ark 'Bumpy' Roose",
                            value: "6"
                        },
                        {
                            name: "Wan Sandage",
                            value: "7"
                        },
                        {
                            name: "Mars Guo",
                            value: "8"
                        },
                        {
                            name: "Ebe Endocott",
                            value: "9"
                        },
                        {
                            name: "Dud Bolt",
                            value: "10"
                        },
                        {
                            name: "Gasgano",
                            value: "11"
                        },
                        {
                            name: "Clegg Holdfast",
                            value: "12"
                        },
                        {
                            name: "Elan Mak",
                            value: "13"
                        },
                        {
                            name: "Neva Kee",
                            value: "14"
                        },
                        {
                            name: "Bozzie Baranta",
                            value: "15"
                        },
                        {
                            name: "Boles Roor",
                            value: "16"
                        },
                        {
                            name: "Ody Mandrell",
                            value: "17"
                        },
                        {
                            name: "Fud Sang",
                            value: "18"
                        },
                        {
                            name: "Ben Quadinaros",
                            value: "19"
                        },
                        {
                            name: "Slide Paramita",
                            value: "20"
                        },
                        {
                            name: "Toy Dampner",
                            value: "21"
                        },
                        {
                            name: "'Bullseye' Navior",
                            value: "22"
                        }
                    ]
                }
            ]
        },
        {
            name: "settings",
            description: "customize your challenge settings including your winnings and odds of rolling nu, skips, etc.",
            type: 1,
            options: [
                {
                    name: "winnings",
                    description: "the pattern of truguts earned based on your achieved goal time",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "1 Fair",
                            value: "0"
                        },
                        {
                            name: "2 Skilled",
                            value: "1"
                        },
                        {
                            name: "3 Winner Takes All",
                            value: "2"
                        },
                    ]
                },
                {
                    name: "skips_odds",
                    description: "x/100 chance of getting a skip challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "no_upgrades_odds",
                    description: "x/100 chance of getting a no upgrades challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "non_3_lap_odds",
                    description: "x/100 chance of getting a non 3-lap challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "mirrored_odds",
                    description: "x/100 chance of getting a mirrored challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "reset",
                    description: "if true, resets your challenge settings to default",
                    type: 5,
                    required: false
                }
            ]
        },
        {
            name: "profile",
            description: "view your career stats, total truguts, and achievement progress for random challenges",
            type: 1,
            options: [
                    {
                    name: "user",
                    description: "the user whose profile you would like to view, if not your own",
                    type: 6,
                    required: false
                    }
            ]

        },
        {
            name: "about",
            description: "learn more about how the random challenges work and how to submit a time",
            type: 1
        },
        {
            name: "leaderboard",
            description: "get top-5 leaderboards for submitted challenge times",
            type: 1,
            options: [
                {
                    name: "track",
                    description: "name of the track",
                    type: 3,
                    required: true,
                    choices: [
                        {
                            name: "The Boonta Training Course",
                            value: "0"
                        },
                        {
                            name: "Mon Gazza Speedway",
                            value: "1"
                        },
                        {
                            name: "Beedo's Wild Ride",
                            value: "2"
                        },
                        {
                            name: "Aquilaris Classic",
                            value: "3"
                        },
                        {
                            name: "Malastare 100",
                            value: "4"
                        },
                        {
                            name: "Vengeance",
                            value: "5"
                        },
                        {
                            name: "Spice Mine Rune",
                            value: "6"
                        },
                        {
                            name: "Sunken City",
                            value: "7"
                        },
                        {
                            name: "Howler Gorge",
                            value: "8"
                        },
                        {
                            name: "Dug Derby",
                            value: "9"
                        },
                        {
                            name: "Scrapper's Run",
                            value: "10"
                        },
                        {
                            name: "Zugga Challenge",
                            value: "11"
                        },
                        {
                            name: "Baroo Coast",
                            value: "12"
                        },
                        {
                            name: "Bumpy's Breakers",
                            value: "13"
                        },
                        {
                            name: "Executioner",
                            value: "14"
                        },
                        {
                            name: "Sebulba's Legacy",
                            value: "15"
                        },
                        {
                            name: "Grabvine Gateway",
                            value: "16"
                        },
                        {
                            name: "Andobi Mountain Run",
                            value: "17"
                        },
                        {
                            name: "Dethro's Revenge",
                            value: "18"
                        },
                        {
                            name: "Fire Mountain Rally",
                            value: "19"
                        },
                        {
                            name: "The Boonta Classic",
                            value: "20"
                        },
                        {
                            name: "Ando Prime Centrum",
                            value: "21"
                        },
                        {
                            name: "Abyss",
                            value: "22"
                        },
                        {
                            name: "The Gauntlet",
                            value: "23"
                        },
                        {
                            name: "Inferno",
                            value: "24"
                        }
                    ]
                },
                {
                    name: "skips",
                    description: "filter by skip runs or full track runs",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "skips",
                            value: "skips"
                        },
                        {
                            name: "full track",
                            value: "ft"
                        }
                    ]
                },
                {
                    name: "upgrades",
                    description: "filter by upgrade runs (mu) or no upgrade runs (nu)",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "upgrades",
                            value: "mu" 
                        },
                        {
                            name: "no upgrades",
                            value: "nu"
                        }
                    ]
                },
                {
                    name: "pod",
                    description: "filter runs by a specific pod or filter out pods with 'no' in front; use racer's first name/initials",
                    type: 3,
                    required: false,
                },
                {
                    name: "player",
                    description: "filter runs by player",
                    type: 6,
                    required: false,
                },
                {
                    name: "mirrored",
                    description: "filter by mirrored runs",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "unmirrored",
                            value: "unmirrored" 
                        },
                        {
                            name: "mirrored",
                            value: "mirrored"
                        }
                    ]
                },
                {
                    name: "laps",
                    description: "filter by number of laps",
                    type: 4,
                    required: false,
                    choices: [
                        {
                            name: 1,
                            value: 1
                        },
                        {
                            name: 2,
                            value: 2 
                        },
                        {
                            name: 3,
                            value: 3
                        },
                        {
                            name: 4,
                            value: 4
                        },
                        {
                            name: 5,
                            value: 5
                        }
                    ]
                }
            ]
        }
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'chancecube',
    description: "Blue—it's the boy. Red—his mother"
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: { //this stays as a guild command
    name: 'cleanup',
    description: 'deletes bot spam within the past # messages (defaults to 30)',
    options: [
        {
            name: "messages",
            description: "the number of messages to scan through for bot spam",
            type: 4,
            required: false
        }
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'convert',
    description: 'convert seconds to --:--.--- format and vice versa; supports basic arithmetic (+-*/)',
    options: [
        {
            name: "time",
            description: "the time/equation you wish to convert or evaluate",
            type: 3,
            required: true
        }
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'help',
    description: 'helpful information about botto commands and other stuff',
    options: [
        {
            name: "commands",
            description: "get a list of Botto's commands and descriptions for how to use them",
            type: 1
        },
        {
            name: "abbreviations",
            description: "get a list of commonly used abbreviations for Star Wars Episode I: Racer",
            type: 1
        }
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'links',
    description: 'quickly get the most commonly shared links on the SWE1R Discord',
    options: [
        {
            name: "botto",
            description: "Botto related links",
            type: 2,
            options: [
                {
                    name: "github",
                    description: "posts a link to Botto's github page",
                    type: 1
                },
                {
                    name: "graphics",
                    description: "posts imgur links to the graphics that Botto uses",
                    type: 1
                },
                {
                    name: "invite",
                    description: "posts a link to invite Botto to your Discord",
                    type: 1
                }
            ]
        },
        {
            name: "drive",
            description: "posts a link to the community Google Drive",
            type: 1
        },
        {
            name: "mp_guide",
            description: "posts a link to the online multiplayer guide",
            type: 1
        },
        {
            name: "stats",
            description: "posts a link to the pod and track statistics sheet",
            type: 1
        },
        {
            name: "src_resources",
            description: "posts a link to the SWE1R speedrun.com resources page",
            type: 1
        },
        {
            name: "rtss",
            description: "posts a link to download rivatuner for limiting the game's framerate",
            type: 1
        },
        {
            name: "dgvoodoo",
            description: "posts a link to download dgvoodoo for running the game in windowed mode",
            type: 1
        }
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'lookup',
    description: 'get information for racers, tracks, and more',
    options: [
        {
            name: "racer",
            description: "get information for a specific racer",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "racer's name",
                    type: 3,
                    required: true,
                    choices: [
                        {
                            name: "Anakin Skywalker",
                            value: "0"
                        },
                        {
                            name: "Teemto Pagalies",
                            value: "1"
                        },
                        {
                            name: "Sebulba",
                            value: "2"
                        },
                        {
                            name: "Ratts Tyerell",
                            value: "3"
                        },
                        {
                            name: "Aldar Beedo",
                            value: "4"
                        },
                        {
                            name: "Mawhonic",
                            value: "5"
                        },
                        {
                            name: "Ark 'Bumpy' Roose",
                            value: "6"
                        },
                        {
                            name: "Wan Sandage",
                            value: "7"
                        },
                        {
                            name: "Mars Guo",
                            value: "8"
                        },
                        {
                            name: "Ebe Endocott",
                            value: "9"
                        },
                        {
                            name: "Dud Bolt",
                            value: "10"
                        },
                        {
                            name: "Gasgano",
                            value: "11"
                        },
                        {
                            name: "Clegg Holdfast",
                            value: "12"
                        },
                        {
                            name: "Elan Mak",
                            value: "13"
                        },
                        {
                            name: "Neva Kee",
                            value: "14"
                        },
                        {
                            name: "Bozzie Baranta",
                            value: "15"
                        },
                        {
                            name: "Boles Roor",
                            value: "16"
                        },
                        {
                            name: "Ody Mandrell",
                            value: "17"
                        },
                        {
                            name: "Fud Sang",
                            value: "18"
                        },
                        {
                            name: "Ben Quadinaros",
                            value: "19"
                        },
                        {
                            name: "Slide Paramita",
                            value: "20"
                        },
                        {
                            name: "Toy Dampner",
                            value: "21"
                        },
                        {
                            name: "'Bullseye' Navior",
                            value: "22"
                        }
                    ]
                }
            ]
        },
        {
            name: "track",
            description: "get information for a specific track",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "track name",
                    type: 3,
                    required: true,
                    choices: [
                        {
                            name: "The Boonta Training Course",
                            value: "0"
                        },
                        {
                            name: "Mon Gazza Speedway",
                            value: "1"
                        },
                        {
                            name: "Beedo's Wild Ride",
                            value: "2"
                        },
                        {
                            name: "Aquilaris Classic",
                            value: "3"
                        },
                        {
                            name: "Malastare 100",
                            value: "4"
                        },
                        {
                            name: "Vengeance",
                            value: "5"
                        },
                        {
                            name: "Spice Mine Rune",
                            value: "6"
                        },
                        {
                            name: "Sunken City",
                            value: "7"
                        },
                        {
                            name: "Howler Gorge",
                            value: "8"
                        },
                        {
                            name: "Dug Derby",
                            value: "9"
                        },
                        {
                            name: "Scrapper's Run",
                            value: "10"
                        },
                        {
                            name: "Zugga Challenge",
                            value: "11"
                        },
                        {
                            name: "Baroo Coast",
                            value: "12"
                        },
                        {
                            name: "Bumpy's Breakers",
                            value: "13"
                        },
                        {
                            name: "Executioner",
                            value: "14"
                        },
                        {
                            name: "Sebulba's Legacy",
                            value: "15"
                        },
                        {
                            name: "Grabvine Gateway",
                            value: "16"
                        },
                        {
                            name: "Andobi Mountain Run",
                            value: "17"
                        },
                        {
                            name: "Dethro's Revenge",
                            value: "18"
                        },
                        {
                            name: "Fire Mountain Rally",
                            value: "19"
                        },
                        {
                            name: "The Boonta Classic",
                            value: "20"
                        },
                        {
                            name: "Ando Prime Centrum",
                            value: "21"
                        },
                        {
                            name: "Abyss",
                            value: "22"
                        },
                        {
                            name: "The Gauntlet",
                            value: "23"
                        },
                        {
                            name: "Inferno",
                            value: "24"
                        }
                    ]
                },
            ]
        },
        {
            name: "times",
            description: "get par times or projected goal times for each track and racer",
            type: 2,
            options: [
                {
                    name: "par_times",
                    description: "look up the speedrunning par times for a specific track",
                    type: 1,
                    options: [
                        {
                            name: "track",
                            description: "track name or abbreviation",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "The Boonta Training Course",
                                    value: "0"
                                },
                                {
                                    name: "Mon Gazza Speedway",
                                    value: "1"
                                },
                                {
                                    name: "Beedo's Wild Ride",
                                    value: "2"
                                },
                                {
                                    name: "Aquilaris Classic",
                                    value: "3"
                                },
                                {
                                    name: "Malastare 100",
                                    value: "4"
                                },
                                {
                                    name: "Vengeance",
                                    value: "5"
                                },
                                {
                                    name: "Spice Mine Rune",
                                    value: "6"
                                },
                                {
                                    name: "Sunken City",
                                    value: "7"
                                },
                                {
                                    name: "Howler Gorge",
                                    value: "8"
                                },
                                {
                                    name: "Dug Derby",
                                    value: "9"
                                },
                                {
                                    name: "Scrapper's Run",
                                    value: "10"
                                },
                                {
                                    name: "Zugga Challenge",
                                    value: "11"
                                },
                                {
                                    name: "Baroo Coast",
                                    value: "12"
                                },
                                {
                                    name: "Bumpy's Breakers",
                                    value: "13"
                                },
                                {
                                    name: "Executioner",
                                    value: "14"
                                },
                                {
                                    name: "Sebulba's Legacy",
                                    value: "15"
                                },
                                {
                                    name: "Grabvine Gateway",
                                    value: "16"
                                },
                                {
                                    name: "Andobi Mountain Run",
                                    value: "17"
                                },
                                {
                                    name: "Dethro's Revenge",
                                    value: "18"
                                },
                                {
                                    name: "Fire Mountain Rally",
                                    value: "19"
                                },
                                {
                                    name: "The Boonta Classic",
                                    value: "20"
                                },
                                {
                                    name: "Ando Prime Centrum",
                                    value: "21"
                                },
                                {
                                    name: "Abyss",
                                    value: "22"
                                },
                                {
                                    name: "The Gauntlet",
                                    value: "23"
                                },
                                {
                                    name: "Inferno",
                                    value: "24"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "goal_times",
                    description: "get projected goal times for each pod, track, and upgrade",
                    type: 1,
                    options: [
                        {
                            name: "track",
                            description: "track name",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "The Boonta Training Course",
                                    value: "0"
                                },
                                {
                                    name: "Mon Gazza Speedway",
                                    value: "1"
                                },
                                {
                                    name: "Beedo's Wild Ride",
                                    value: "2"
                                },
                                {
                                    name: "Aquilaris Classic",
                                    value: "3"
                                },
                                {
                                    name: "Malastare 100",
                                    value: "4"
                                },
                                {
                                    name: "Vengeance",
                                    value: "5"
                                },
                                {
                                    name: "Spice Mine Rune",
                                    value: "6"
                                },
                                {
                                    name: "Sunken City",
                                    value: "7"
                                },
                                {
                                    name: "Howler Gorge",
                                    value: "8"
                                },
                                {
                                    name: "Dug Derby",
                                    value: "9"
                                },
                                {
                                    name: "Scrapper's Run",
                                    value: "10"
                                },
                                {
                                    name: "Zugga Challenge",
                                    value: "11"
                                },
                                {
                                    name: "Baroo Coast",
                                    value: "12"
                                },
                                {
                                    name: "Bumpy's Breakers",
                                    value: "13"
                                },
                                {
                                    name: "Executioner",
                                    value: "14"
                                },
                                {
                                    name: "Sebulba's Legacy",
                                    value: "15"
                                },
                                {
                                    name: "Grabvine Gateway",
                                    value: "16"
                                },
                                {
                                    name: "Andobi Mountain Run",
                                    value: "17"
                                },
                                {
                                    name: "Dethro's Revenge",
                                    value: "18"
                                },
                                {
                                    name: "Fire Mountain Rally",
                                    value: "19"
                                },
                                {
                                    name: "The Boonta Classic",
                                    value: "20"
                                },
                                {
                                    name: "Ando Prime Centrum",
                                    value: "21"
                                },
                                {
                                    name: "Abyss",
                                    value: "22"
                                },
                                {
                                    name: "The Gauntlet",
                                    value: "23"
                                },
                                {
                                    name: "Inferno",
                                    value: "24"
                                }
                            ]
                        },
                        {
                            name: "racer",
                            description: "racer initials or first name",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "Anakin Skywalker",
                                    value: "0"
                                },
                                {
                                    name: "Teemto Pagalies",
                                    value: "1"
                                },
                                {
                                    name: "Sebulba",
                                    value: "2"
                                },
                                {
                                    name: "Ratts Tyerell",
                                    value: "3"
                                },
                                {
                                    name: "Aldar Beedo",
                                    value: "4"
                                },
                                {
                                    name: "Mawhonic",
                                    value: "5"
                                },
                                {
                                    name: "Ark 'Bumpy' Roose",
                                    value: "6"
                                },
                                {
                                    name: "Wan Sandage",
                                    value: "7"
                                },
                                {
                                    name: "Mars Guo",
                                    value: "8"
                                },
                                {
                                    name: "Ebe Endocott",
                                    value: "9"
                                },
                                {
                                    name: "Dud Bolt",
                                    value: "10"
                                },
                                {
                                    name: "Gasgano",
                                    value: "11"
                                },
                                {
                                    name: "Clegg Holdfast",
                                    value: "12"
                                },
                                {
                                    name: "Elan Mak",
                                    value: "13"
                                },
                                {
                                    name: "Neva Kee",
                                    value: "14"
                                },
                                {
                                    name: "Bozzie Baranta",
                                    value: "15"
                                },
                                {
                                    name: "Boles Roor",
                                    value: "16"
                                },
                                {
                                    name: "Ody Mandrell",
                                    value: "17"
                                },
                                {
                                    name: "Fud Sang",
                                    value: "18"
                                },
                                {
                                    name: "Ben Quadinaros",
                                    value: "19"
                                },
                                {
                                    name: "Slide Paramita",
                                    value: "20"
                                },
                                {
                                    name: "Toy Dampner",
                                    value: "21"
                                },
                                {
                                    name: "'Bullseye' Navior",
                                    value: "22"
                                }
                            ]
                        },
                        {
                            name: "accel",
                            description: "upgrade level for acceleration",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "0: Dual 20 PCX",
                                    value: "0"
                                },
                                {
                                    name: "1: 44 PCX",
                                    value: "1"
                                },
                                {
                                    name: "2: Dual 32 PCX",
                                    value: "2"
                                },
                                {
                                    name: "3: Quad 32 PCX",
                                    value: "3"
                                },
                                {
                                    name: "4: Quad 44",
                                    value: "4"
                                },
                                {
                                    name: "5: Mag 6",
                                    value: "5"
                                }
                            ]
                        },
                        {
                            name: "top_speed",
                            description: "upgrade level for top speed",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "0: Plug 2",
                                    value: "0"
                                },
                                {
                                    name: "1: Plug 3",
                                    value: "1"
                                },
                                {
                                    name: "2: Plug 5",
                                    value: "2"
                                },
                                {
                                    name: "3: Plug 8",
                                    value: "3"
                                },
                                {
                                    name: "4: Block 5",
                                    value: "4"
                                },
                                {
                                    name: "5: Block 6",
                                    value: "5"
                                }
                            ]
                        },
                        {
                            name: "cooling",
                            description: "upgrade level for cooling",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "0: Coolant",
                                    value: "0"
                                },
                                {
                                    name: "1: Stack-3",
                                    value: "1"
                                },
                                {
                                    name: "2: Stack-6",
                                    value: "2"
                                },
                                {
                                    name: "3: Rod",
                                    value: "3"
                                },
                                {
                                    name: "4: Dual",
                                    value: "4"
                                },
                                {
                                    name: "5: Turbo",
                                    value: "5"
                                }
                            ]
                        }
                        
                    ]
                },
            ]
        },
        {
            name: "tier",
            description: "get a list of all the podracers grouped into four tiers",
            type: 1,
            options: [
                {
                    name: "upgrades",
                    description: "the upgrade level that determines each pod's tier (defaults to mu)",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "max upgrades",
                            value: "mu"
                        },
                        {
                            name: "no upgrades",
                            value: "nu"
                        }
                    ]
                }
            ]
        },
        {
            name: "prices",
            description: "look up prices for each upgrade and get a total cost; avoid getting swindled by Watto",
            type: 1,
            options: [
                {
                    name: "traction",
                    description: "upgrade level for traction",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: R-20",
                            value: "0"
                        },
                        {
                            name: "1: R-60",
                            value: "1"
                        },
                        {
                            name: "2: R-80",
                            value: "2"
                        },
                        {
                            name: "3: R-100",
                            value: "3"
                        },
                        {
                            name: "4: R-300",
                            value: "4"
                        },
                        {
                            name: "5: R-600",
                            value: "5"
                        }
                    ]
                },
                {
                    name: "turning",
                    description: "upgrade level for turning",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: Linkage",
                            value: "0"
                        },
                        {
                            name: "1: Shift Plate",
                            value: "1"
                        },
                        {
                            name: "2: Vectro-Jet",
                            value: "2"
                        },
                        {
                            name: "3: Coupling",
                            value: "3"
                        },
                        {
                            name: "4: Nozzle",
                            value: "4"
                        },
                        {
                            name: "5: Stabilizer",
                            value: "5"
                        }
                    ]
                },
                {
                    name: "accel",
                    description: "upgrade level for acceleration",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: Dual 20 PCX",
                            value: "0"
                        },
                        {
                            name: "1: 44 PCX",
                            value: "1"
                        },
                        {
                            name: "2: Dual 32 PCX",
                            value: "2"
                        },
                        {
                            name: "3: Quad 32 PCX",
                            value: "3"
                        },
                        {
                            name: "4: Quad 44",
                            value: "4"
                        },
                        {
                            name: "5: Mag 6",
                            value: "5"
                        }
                    ]
                },
                {
                    name: "top_speed",
                    description: "upgrade level for top speed",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: Plug 2",
                            value: "0"
                        },
                        {
                            name: "1: Plug 3",
                            value: "1"
                        },
                        {
                            name: "2: Plug 5",
                            value: "2"
                        },
                        {
                            name: "3: Plug 8",
                            value: "3"
                        },
                        {
                            name: "4: Block 5",
                            value: "4"
                        },
                        {
                            name: "5: Block 6",
                            value: "5"
                        }
                    ]
                },
                {
                    name: "air_brake",
                    description: "upgrade level for air brake",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: Mark II",
                            value: "0"
                        },
                        {
                            name: "1: Mark III",
                            value: "1"
                        },
                        {
                            name: "2: Mark IV",
                            value: "2"
                        },
                        {
                            name: "3: Mark V",
                            value: "3"
                        },
                        {
                            name: "4: Tri-Jet",
                            value: "4"
                        },
                        {
                            name: "5: Quadrijet",
                            value: "5"
                        }
                    ]
                },
                {
                    name: "cooling",
                    description: "upgrade level for cooling",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: Coolant",
                            value: "0"
                        },
                        {
                            name: "1: Stack-3",
                            value: "1"
                        },
                        {
                            name: "2: Stack-6",
                            value: "2"
                        },
                        {
                            name: "3: Rod",
                            value: "3"
                        },
                        {
                            name: "4: Dual",
                            value: "4"
                        },
                        {
                            name: "5: Turbo",
                            value: "5"
                        }
                    ]
                },
                {
                    name: "repair",
                    description: "upgrade level for repair",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "0: Single",
                            value: "0"
                        },
                        {
                            name: "1: Dual2",
                            value: "1"
                        },
                        {
                            name: "2: Quad",
                            value: "2"
                        },
                        {
                            name: "3: Cluster",
                            value: "3"
                        },
                        {
                            name: "4: Rotary",
                            value: "4"
                        },
                        {
                            name: "5: Cluster 2",
                            value: "5"
                        }
                    ]
                }
            ]
        },
        {
            name: "cheats",
            description: "get a full list of cheats for the game",
            type: 1,
            options: [
                {
                    name: "system",
                    description: "which version of the game to get cheats for",
                    type: 3,
                    required: true,
                    choices: [
                        {
                            name: "PC",
                            value: "PC"
                        },
                        {
                            name: "Console",
                            value: "console"
                        }
                    ]
                }
            ]
        }
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'random',
    description: 'get a random racer, track, etc.',
    options: [
        {
            name: "racer",
            description: "get a random racer",
            type: 1,
            options: [
                {
                    name: "tier",
                    description: "get a random racer from a specific tier",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "Top",
                            value: "0"
                        },
                        {
                            name: "High",
                            value: "1"
                        },
                        {
                            name: "Mid",
                            value: "2"
                        },
                        {
                            name: "Low",
                            value: "3"
                        }
                    ]
                },
                {
                    name: "canon",
                    description: "get canonical or non-canonical racers",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "canon",
                            value: "canon"
                        },
                        {
                            name: "non-canon",
                            value: "non-canon"
                        }
                    ]
                },
                {
                    name: "vc",
                    description: "whether to roll for everyone in your voice channel",
                    type: 5,
                    required: false
                }
            ]
        },
        {
            name: "track",
            description: "get a random track",
            type: 1,
            options: [
                {
                    name: "circuit",
                    description: "roll a random track from a specific circuit",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "Amateur Circuit",
                            value: "Amateur"
                        },
                        {
                            name: "Semi-Pro Circuit",
                            value: "Semi-Pro"
                        },
                        {
                            name: "Galactic Circuit",
                            value: "Galactic"
                        },
                        {
                            name: "Invitational Circuit",
                            value: "Invitational"
                        },
                    ]
                },
                {
                    name: "planet",
                    description: "roll a random track from a specific planet",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "Ando Prime",
                            value: "Ando Prime"
                        },
                        {
                            name: "Aquilaris",
                            value: "Aquilaris"
                        },
                        {
                            name: "Baroonda",
                            value: "Baroonda"
                        },
                        {
                            name: "Malastare",
                            value: "Malastare"
                        },
                        {
                            name: "Mon Gazza",
                            value: "Mon Gazza"
                        },
                        {
                            name: "Oovo IV",
                            value: "Oovo IV"
                        },
                        {
                            name: "Ord Ibanna",
                            value: "Ord Ibanna"
                        },
                        {
                            name: "Tatooine",
                            value: "Tatooine"
                        }
                    ]
                },
                {
                    name: "length",
                    description: "roll a random track from a specific length",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "short",
                            value: "short"
                        },
                        {
                            name: "medium",
                            value: "medium"
                        },
                        {
                            name: "long",
                            value: "long"
                        }
                    ]
                },
                {
                    name: "difficulty",
                    description: "roll a random track from a specific difficulty",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "Beginner",
                            value: "Beginner"
                        },
                        {
                            name: "Easy",
                            value: "Easy"
                        },
                        {
                            name: "Average",
                            value: "Average"
                        },
                        {
                            name: "Hard",
                            value: "Hard"
                        },
                        {
                            name: "Brutal",
                            value: "Brutal"
                        }
                    ]
                },
            ]
        },
        {
            name: "challenge",
            description: "get a random pod/track challenge",
            type: 1,
        },
        {
            name: 'teams',
            description: 'divides everyone in your voice channel into # number of teams',
            type: 1,
            options: [
                {
                    name: "teams",
                    description: "the number of teams you wish to create",
                    type: 4,
                    required: true
                }
            ]
        },
        {
            name: "number",
            description: "get a random number",
            type: 1,
            options: [
                {
                    name: "max",
                    description: "get a random number between 1 and this number",
                    type: 4,
                    required: true,
                }
            ]
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({
    data: {
        name: 'role',
        description: "add or remove roles",
        options: [
            {
                name: "add",
                description: "add a role",
                type: 1,
                options: [
                    {
                        name: "role",
                        description: "select a role to add",
                        type: 3,
                        required: true,
                        choices: [
                            {
                                name: "Multiplayer",
                                value: "474920988790751232"
                            },
                            {
                                name: "Tournament",
                                value: "841059665474617353"
                            },
                            {
                                name: "Speedrunning",
                                value: "535973118578130954"
                            },
                            {
                                name: "PC Player",
                                value: "841404897018380388"
                            },
                            {
                                name: "Switch Player",
                                value: "841405226282909716"
                            },
                            {
                                name: "PlayStation Player",
                                value: "841405077470445669"
                            },
                            {
                                name: "Xbox Player",
                                value: "841404991784091690"
                            },
                            {
                                name: "Dreamcast Player",
                                value: "841405394441338890"
                            },
                            {
                                name: "N64 Player",
                                value: "602246101323612181"
                            }
                        ]
                    }
                ]
            },
            {
                name: "remove",
                description: "remove a role",
                type: 1,
                options: [
                    {
                        name: "role",
                        description: "select a role to remove",
                        type: 3,
                        required: true,
                        choices: [
                            {
                                name: "Multiplayer",
                                value: "474920988790751232"
                            },
                            {
                                name: "Tournament",
                                value: "841059665474617353"
                            },
                            {
                                name: "Speedrunning",
                                value: "535973118578130954"
                            },
                            {
                                name: "PC Player",
                                value: "841404897018380388"
                            },
                            {
                                name: "Switch Player",
                                value: "841405226282909716"
                            },
                            {
                                name: "PlayStation Player",
                                value: "841405077470445669"
                            },
                            {
                                name: "Xbox Player",
                                value: "841404991784091690"
                            },
                            {
                                name: "Dreamcast Player",
                                value: "841405394441338890"
                            },
                            {
                                name: "N64 Player",
                                value: "602246101323612181"
                            }
                        ]
                    }
                ]
            }
        ]
    }
})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'src',
    description: 'get top-5 leaderboards from speedrun.com',
    options: [
        {
            name: "IL",
            description: "get individual level top-5 leaderboards from speedrun.com",
            type: 1, //sub command
            options: [
                {
                    name: "track",
                    description: "the name of the track",
                    type: 3, //string
                    required: true,
                    choices: [
                        {
                            name: "The Boonta Training Course",
                            value: "0"
                        },
                        {
                            name: "Mon Gazza Speedway",
                            value: "1"
                        },
                        {
                            name: "Beedo's Wild Ride",
                            value: "2"
                        },
                        {
                            name: "Aquilaris Classic",
                            value: "3"
                        },
                        {
                            name: "Malastare 100",
                            value: "4"
                        },
                        {
                            name: "Vengeance",
                            value: "5"
                        },
                        {
                            name: "Spice Mine Rune",
                            value: "6"
                        },
                        {
                            name: "Sunken City",
                            value: "7"
                        },
                        {
                            name: "Howler Gorge",
                            value: "8"
                        },
                        {
                            name: "Dug Derby",
                            value: "9"
                        },
                        {
                            name: "Scrapper's Run",
                            value: "10"
                        },
                        {
                            name: "Zugga Challenge",
                            value: "11"
                        },
                        {
                            name: "Baroo Coast",
                            value: "12"
                        },
                        {
                            name: "Bumpy's Breakers",
                            value: "13"
                        },
                        {
                            name: "Executioner",
                            value: "14"
                        },
                        {
                            name: "Sebulba's Legacy",
                            value: "15"
                        },
                        {
                            name: "Grabvine Gateway",
                            value: "16"
                        },
                        {
                            name: "Andobi Mountain Run",
                            value: "17"
                        },
                        {
                            name: "Dethro's Revenge",
                            value: "18"
                        },
                        {
                            name: "Fire Mountain Rally",
                            value: "19"
                        },
                        {
                            name: "The Boonta Classic",
                            value: "20"
                        },
                        {
                            name: "Ando Prime Centrum",
                            value: "21"
                        },
                        {
                            name: "Abyss",
                            value: "22"
                        },
                        {
                            name: "The Gauntlet",
                            value: "23"
                        },
                        {
                            name: "Inferno",
                            value: "24"
                        }
                    ]
                },
                {
                    name: "skips",
                    description: "filter by skip runs or full track runs",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "skips",
                            value: "skips"
                        },
                        {
                            name: "full track",
                            value: "ft"
                        }
                    ]
                },
                {
                    name: "upgrades",
                    description: "filter by upgrade runs and no upgrade (nu) runs",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "upgrades",
                            value: "mu" 
                        },
                        {
                            name: "no upgrades",
                            value: "nu"
                        }
                    ]
                },
                {
                    name: "platform",
                    description: "filter runs by platform",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "PC",
                            value: "pc" 
                        },
                        {  
                            name: "Nintendo 64",
                            value: "n64"
                        },
                        {
                            name: "Dreamcast",
                            value: "dc"
                        },
                        {
                            name: "Nintendo Switch",
                            value: "switch"
                        },
                        {
                            name: "PlayStation 4",
                            value: "ps4"
                        },
                        {
                            name: "XboxOne",
                            value: "xbox"
                        }
                    ]
                },
                {
                    name: "laps",
                    description: "show 3-lap or 1-lap runs (defaults to 3-lap)",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "3-lap",
                            value: "3"
                        },
                        {
                            name: "1-lap (flap)",
                            value: "1"
                        }
                    ]
                }
            ]
        },
        {
            name: "RTA",
            description: "get real time attack top-5 leaderboards from speedrun.com",
            type: 1, //sub command
            options: [
                {
                    name: "category",
                    description: "the name or abbreviation of the category",
                    type: 3,//string
                    required: true,
                    choices: [
                        {
                            name: "Any%",
                            value: "any%"
                        },
                        {
                            name: "Semi-Pro Circuit",
                            value: "spc"
                        },
                        {
                            name: "Amateur Circuit",
                            value: "amc"
                        },
                        {
                            name: "100%",
                            value: "100%"
                        },
                        {
                            name: "All Tracks New Game+",
                            value: "ng+"
                        }
                    ]
                },
                {
                    name: "skips",
                    description: "filter by skip runs or full track runs",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "skips",
                            value: "skips"
                        },
                        {
                            name: "full track",
                            value: "ft"
                        }
                    ]
                },
                {
                    name: "upgrades",
                    description: "filter by upgrade runs (mu) and no upgrade runs (nu)",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "upgrades",
                            value: "mu" 
                        },
                        {
                            name: "no upgrades",
                            value: "nu"
                        }
                    ]
                },
                {
                    name: "platform",
                    description: "filter runs by platform",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "any",
                            value: "any"
                        },
                        {
                            name: "PC",
                            value: "pc" 
                        },
                        {  
                            name: "Nintendo 64",
                            value: "n64"
                        },
                        {
                            name: "Dreamcast",
                            value: "dc"
                        },
                        {
                            name: "Nintendo Switch",
                            value: "switch"
                        },
                        {
                            name: "PlayStation 4",
                            value: "ps4"
                        }
                    ]
                }
            ]
        },
        
        
    ]
}})

client.api.applications("545798436105224203").commands.post({data: {
    name: 'tourney',
    description: 'get top-5 leaderboards for tournament runs of each track',
    options: [
        {
            name: "track",
            description: "name or abbreviation of the track",
            type: 3,
            required: true,
            choices: [
                {
                    name: "The Boonta Training Course",
                    value: "0"
                },
                {
                    name: "Mon Gazza Speedway",
                    value: "1"
                },
                {
                    name: "Beedo's Wild Ride",
                    value: "2"
                },
                {
                    name: "Aquilaris Classic",
                    value: "3"
                },
                {
                    name: "Malastare 100",
                    value: "4"
                },
                {
                    name: "Vengeance",
                    value: "5"
                },
                {
                    name: "Spice Mine Rune",
                    value: "6"
                },
                {
                    name: "Sunken City",
                    value: "7"
                },
                {
                    name: "Howler Gorge",
                    value: "8"
                },
                {
                    name: "Dug Derby",
                    value: "9"
                },
                {
                    name: "Scrapper's Run",
                    value: "10"
                },
                {
                    name: "Zugga Challenge",
                    value: "11"
                },
                {
                    name: "Baroo Coast",
                    value: "12"
                },
                {
                    name: "Bumpy's Breakers",
                    value: "13"
                },
                {
                    name: "Executioner",
                    value: "14"
                },
                {
                    name: "Sebulba's Legacy",
                    value: "15"
                },
                {
                    name: "Grabvine Gateway",
                    value: "16"
                },
                {
                    name: "Andobi Mountain Run",
                    value: "17"
                },
                {
                    name: "Dethro's Revenge",
                    value: "18"
                },
                {
                    name: "Fire Mountain Rally",
                    value: "19"
                },
                {
                    name: "The Boonta Classic",
                    value: "20"
                },
                {
                    name: "Ando Prime Centrum",
                    value: "21"
                },
                {
                    name: "Abyss",
                    value: "22"
                },
                {
                    name: "The Gauntlet",
                    value: "23"
                },
                {
                    name: "Inferno",
                    value: "24"
                }
            ]
        },
        {
            name: "skips",
            description: "filter by skip runs or full track runs",
            type: 3,
            required: false,
            choices: [
                {
                    name: "any",
                    value: "any"
                },
                {
                    name: "skips",
                    value: "skips"
                },
                {
                    name: "full track",
                    value: "ft"
                }
            ]
        },
        {
            name: "upgrades",
            description: "filter by upgrade runs (mu) or no upgrade runs (nu)",
            type: 3,
            required: false,
            choices: [
                {
                    name: "any",
                    value: "any"
                },
                {
                    name: "upgrades",
                    value: "mu" 
                },
                {
                    name: "no upgrades",
                    value: "nu"
                }
            ]
        },
        {
            name: "pod",
            description: "filter runs by a specific pod or filter out pods with 'no' in front; use racer's first name/initials",
            type: 3,
            required: false,
        },
        {
            name: "player",
            description: "filter runs by player",
            type: 6,
            required: false,
        },
        {
            name: "deaths",
            description: "filter runs by deaths or deathless",
            type: 3,
            required: false,
            choices: [
                {
                    name: "any",
                    value: "any"
                },
                {
                    name: "deaths",
                    value: "deaths"
                },
                {
                    name: "deathless",
                    value: "deathless"
                }
            ]
        },
        {
            name: "year",
            description: "filter runs by the year the tournament was held",
            type: 4,
            required: false,
            choices: [
                {
                    name: 2019,
                    value: 2019
                },
                {
                    name: 2020,
                    value: 2020
                }
            ]
        }
    ]
}})

client.login(process.env.token);