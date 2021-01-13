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
var logref = database.ref('log');
var errorlogref = database.ref('log/error');
var weeklychallenges = database.ref('weekly/challenges');
var weeklyapproved = database.ref('weekly/submissions');

var ref = database.ref('challenge/times');
ref.on("value", function(snapshot) {
    challengedata = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});
var oddsref = database.ref('challenge/profiles');
oddsref.on("value", function(snapshot) {
    oddsdata = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});
var feedbackref = database.ref('challenge/feedback');
feedbackref.on("value", function(snapshot) {
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
                    content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)]
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

getCommands()




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

    if (message ==`${prefix}guilds`) {
    console.log(client.guilds.cache)
    //console.log(client.guilds.cache.get("697833083201650689"))
    }

    if (message ==`${prefix}test`) {
        client.channels.fetch('444208252541075476')
        .then(channel => {
          channel.messages.fetch({around: "798107558140706846", limit: 1})
          .then(messages => {m, 
            console.log(messages.first().type)
          });
        })
        .catch(console.error);
    }

    if (message ==`${prefix}ping`) {
        //console.log(client.guilds.cache)
        client.channels.cache.get("444208252541075476").send("I'm alive! I've been up for `" + tools.timefix(client.uptime/1000) + "` since `" + client.readyAt + "`");
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
                    requiredl: false
                },
                {
                    name: "bribe_racer",
                    description: "request a specific racer from Botto for 8400 Truguts",
                    type: 3,
                    requiredl: false
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
            type: 1
        },
        {
            name: "about",
            description: "learn more about how the random challenges work and how to submit a time",
            type: 1
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
                    description: "racer's first name or initials",
                    type: 3,
                    required: true
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
                    description: "track name or abbreviation",
                    type: 3,
                    required: true
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
                            required: true
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
                            description: "track name or abbreviation",
                            type: 3,
                            required: true
                        },
                        {
                            name: "racer",
                            description: "racer initials or first name",
                            type: 3,
                            required: true
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
                            name: "0 any",
                            value: "any"
                        },
                        {
                            name: "1 Top",
                            value: "0"
                        },
                        {
                            name: "2 High",
                            value: "1"
                        },
                        {
                            name: "3 Mid",
                            value: "2"
                        },
                        {
                            name: "4 Low",
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
                            name: "0 any",
                            value: "any"
                        },
                        {
                            name: "1 Amateur Circuit",
                            value: "Amateur"
                        },
                        {
                            name: "2 Semi-Pro Circuit",
                            value: "Semi-Pro"
                        },
                        {
                            name: "3 Galactic Circuit",
                            value: "Galactic"
                        },
                        {
                            name: "4 Invitational Circuit",
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
                            name: "0 any",
                            value: "any"
                        },
                        {
                            name: "1 Ando Prime",
                            value: "Ando Prime"
                        },
                        {
                            name: "2 Aquilaris",
                            value: "Aquilaris"
                        },
                        {
                            name: "3 Baroonda",
                            value: "Baroonda"
                        },
                        {
                            name: "4 Malastare",
                            value: "Malastare"
                        },
                        {
                            name: "5 Mon Gazza",
                            value: "Mon Gazza"
                        },
                        {
                            name: "6 Oovo IV",
                            value: "Oovo IV"
                        },
                        {
                            name: "7 Ord Ibanna",
                            value: "Ord Ibanna"
                        },
                        {
                            name: "8 Tatooine",
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
                            name: "0 any",
                            value: "any"
                        },
                        {
                            name: "1 short",
                            value: "short"
                        },
                        {
                            name: "2 medium",
                            value: "medium"
                        },
                        {
                            name: "3 long",
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
                            name: "0 any",
                            value: "any"
                        },
                        {
                            name: "1 Beginner",
                            value: "Beginner"
                        },
                        {
                            name: "2 Easy",
                            value: "Easy"
                        },
                        {
                            name: "3 Average",
                            value: "Average"
                        },
                        {
                            name: "4 Hard",
                            value: "Hard"
                        },
                        {
                            name: "5 Brutal",
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

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: { //this stays as a guild command
    name: 'role',
    description: "get or remove the speedrunning or multiplayer role",
    options: [
        {
            name: "speedrunning",
            description: "get or drop the speedrunning role",
            type: 2,
            options: [
                {
                    name: "get",
                    description: "get this role",
                    type: 1
                },
                {
                    name: "remove",
                    description: "remove this role",
                    type: 1
                }
            ]
            
        },
        {
            name: "multiplayer",
            description: "get or drop the multiplayer role",
            type: 2,
            options: [
                {
                    name: "get",
                    description: "get this role",
                    type: 1
                },
                {
                    name: "remove",
                    description: "remove this role",
                    type: 1
                }
            ]
        }
    ]
}})

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
                    description: "the name or abbreviation of the track",
                    type: 3, //string
                    required: true
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
            required: true
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

client.api.applications("545798436105224203").commands.post({data: {
    name: 'weekly',
    description: 'view leaderboards and create submissions for the weekly challenge',
    options: [
        {
            name: "leaderboard",
            description: "get leaderboard for current weekly challenge",
            type: 1
        },
        {
            name: "challenge",
            description: "view the current weekly challenge or post a new one",
            type: 2,
            options: [
                {
                    name: "view",
                    description: "show the current weekly challenge",
                    type: 1
                },
                {
                    name: "post",
                    description: "post a new weekly challenge",
                    type: 1,
                    options: [
                        {
                            name: "author",
                            description: "the user who created the challenge",
                            type: 6,
                            required: true
                        },
                        {
                            name: "title",
                            description: "the name of the challenge",
                            type: 3,
                            required: true
                        },
                        {
                            name: "blurb",
                            description: "a creative description to contextualize the challenge in the lore",
                            type: 3,
                            required: true
                        },
                        {
                            name: "pod",
                            description: "the pod that must be used in the challenge",
                            type: 3,
                            required: true
                        },
                        {
                            name: "upgrades",
                            description: "the upgrades that must be used in this challenge",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "full upgrades",
                                    value: "mu"
                                },
                                {
                                    name: "no upgrades",
                                    value: "nu"
                                },
                                {
                                    name: "any",
                                    value: "any"
                                },
                                {
                                    name: "custom",
                                    value: "custom"
                                }
                            ]
                        },
                        {
                            name: "track",
                            description: "the challenge track",
                            type: 3,
                            required: true
                        },
                        {
                            name: "laps",
                            description: "the number of laps for the challenge",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "1",
                                    value: "1"
                                },
                                {
                                    name: "2",
                                    value: "2"
                                },
                                {
                                    name: "3",
                                    value: "3"
                                },
                                {
                                    name: "4",
                                    value: "4"
                                },
                                {
                                    name: "5",
                                    value: "5"
                                },
                                {
                                    name: "flap",
                                    value: "flap"
                                }
                            ]
                        },
                        {
                            name: "skips",
                            description: "the allowed route for this challenge",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "skips",
                                    value: "skips"
                                },
                                {
                                    name: "full track",
                                    value: "ft"
                                },
                                {
                                    name: "custom",
                                    value: "custom"
                                }
                            ]
                        },
                        {
                            name: "conditions",
                            description: "any additional challenge conditions such as mirror mode, ai, specific routes and custom upgrades",
                            type: 3,
                            required: true,
                        },
                        {
                            name: "duedate",
                            description: "the last day of the challenge (ends at midnight ET), please use MM/DD/YYYY",
                            type: 3,
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: "submission",
            description: "create a submission for the weekly challenge",
            type: 1,
            options: [
                {
                    name: "time",
                    description: "the time achieved for this submission",
                    type: 3,
                    required: true
                },
                {
                    name: "platform",
                    description: "the platform used to complete the challenge",
                    type: 3,
                    required: true,
                    choices: [
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
                },
                {
                    name: "proof",
                    description: "the link to the video or image proof",
                    type: 3,
                    required: true
                },
                {
                    name: "user",
                    description: "the user who performed the run (if not yourself)",
                    type: 6,
                    required: false
                }
            ]
        }
    ]
}})























client.login(process.env.token);