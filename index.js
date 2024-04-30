const fs = require('fs');
const Discord = require('discord.js');
const axios = require('axios');
const { Client, Events, GatewayIntentBits, Partials, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js')
const { Configuration, OpenAIApi } = require("openai")
const { tracks } = require('./data')
//const { token, firebaseCon, OPENAI_API_KEY, twitch, YOUTUBE_KEY, PAPERTRAIL_KEY, SCAVENGER } = require('./config.json');
const { welcomeMessages } = require('./data.js')
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const TwitchApi = require("node-twitch").default;

const SCAVENGER_CLUES = testing ? SCAVENGER : process.env.SCAVENGER

var { errorMessage } = require("./data.js");
var tools = require('./tools.js');
const { betEmbed, betComponents } = require('./buttons/trugut_functions.js')
const { dailyChallenge, monthlyChallenge, dailyBounty, isActive, completeRepairs, anniversaryMonth } = require("./buttons/challenge/functions")
client.commands = new Discord.Collection();
client.buttons = new Discord.Collection();
client.selects = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const buttonFiles = fs.readdirSync('./buttons').filter(file => file.endsWith('.js'));

const testing = false

const Twitch = new TwitchApi({
    client_id: testing ? twitch.id : process.env.TWITCH_ID,
    client_secret: testing ? twitch.token : process.env.TWITCH_SECRET
});

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

let streamers = {}

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

const database = admin.database();
const logref = database.ref('log');
const errorlogref = database.ref('log/error');

let db = {
    ch: {
        times: null,
        challenges: null,
        feedback: null,
        bounties: null,
        sponsors: null,
        lotto: null,
        flavor: null,
        clues: null,
        auto: null,
        trades: null,
        scavenger: null,
        banners: null
    },
    ty: {
        bets: null,
        matches: null,
        rulesets: null,
        tournaments: null,
        scheduled: null,
        live: null
    },
    user: null
}

function fetchData(ref, callback) {
    ref.on("value", function (snapshot) {
        callback(snapshot.val());

    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
}

fetchData(database.ref('users'), function (data) {
    if (!db.user) {
        console.log('user db ready')
    }
    db.user = data;
});

fetchData(database.ref('challenge/times'), function (data) {
    db.ch.times = data;
});

fetchData(database.ref('challenge/challenges'), function (data) {
    db.ch.challenges = data;
});

fetchData(database.ref('challenge/feedback'), function (data) {
    db.ch.feedback = data;
});

fetchData(database.ref('challenge/bounties'), function (data) {
    db.ch.bounties = data;
});

fetchData(database.ref('challenge/lotto'), function (data) {
    db.ch.lotto = data;
});

fetchData(database.ref('challenge/flavor'), function (data) {
    db.ch.flavor = data;
});

fetchData(database.ref('challenge/clues'), function (data) {
    db.ch.clues = data;
});

fetchData(database.ref('challenge/auto'), function (data) {
    db.ch.auto = data;
});

fetchData(database.ref('challenge/trades'), function (data) {
    db.ch.trades = data;
});

fetchData(database.ref('challenge/banners'), function (data) {
    db.ch.banners = data;
});

fetchData(database.ref('challenge/sponsorships'), function (data) {
    db.ch.sponsors = data;
});

fetchData(database.ref('tourney/matches'), function (data) {
    db.ty.matches = data;
});

fetchData(database.ref('tourney/scheduled'), function (data) {
    db.ty.scheduled = data;
});

fetchData(database.ref('tourney/tournaments'), function (data) {
    db.ty.tournaments = data;
});

fetchData(database.ref('tourney/rulesets'), function (data) {
    db.ty.rulesets = data;
});

fetchData(database.ref('tourney/live'), function (data) {
    db.ty.live = data;
});

// fetchData(database.ref('speedruns'), function (data) {
//     speedruns_data = data;
// });

fetchData(database.ref('tourney/bets'), function (data) {
    db.ty.bets = data;
});

fetchData(database.ref('challenge/scavenger'), function (data) {
    db.ch.scavenger = data;
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
                client.commands.get(command).execute(interaction, database, db);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)] })
            }
        } else {
            let split = interaction.customId.split("_")
            const name = split[0]
            const args = split.slice(1)

            try {
                client.buttons.get(name).execute(client, interaction, args, database, db);
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
    const notif_channel = client.channels.cache.get(testing ? "1135800422066556940" : "444208252541075476")
    try {
        // Make a request to the Papertrail API to fetch logs
        const response = await axios.get(
            'https://papertrailapp.com/api/v1/events/search.json',
            {
                headers: {
                    'X-Papertrail-Token': testing ? PAPERTRAIL_KEY : process.env.PAPERTRAIL_KEY,
                },
                params: {
                    //q: 'error', // Customize the search query
                    limit: 10,    // Limit to the last log entry
                },
            }
        );

        // Extract the log message from the response
        let events = response.data.events.map(event => `${event.display_received_at} ${event.message}`)
        events = events.filter(e => !e.includes('[WARNING]') && !e.includes('Ready!'))

        // Send the log message to the Discord channel
        notif_channel.send(`Deployed <t:${Math.round(Date.now() / 1000)}:R>\n\`\`\`${events.join("\n")}\`\`\``);
    } catch (error) {
        console.error('Error fetching logs:', error);
        notif_channel.send('Error fetching logs from Papertrail.');
    }

    const apiKey = testing ? YOUTUBE_KEY : process.env.YOUTUBE_KEY;

    const searchQuery = testing ? 'overwatch 2' : `star wars episode i racer, star wars racer, podracer, podracing, botto, ${tracks.map(t => t.name).join(", ")}`
    const stream_channel = client.channels.cache.get(testing ? '1135800422066556940' : '515311630100463656');
    async function searchYouTubeStreams() {
        try {
            const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    key: apiKey,
                    part: 'snippet',
                    type: 'video',
                    eventType: 'live',
                    q: searchQuery,
                },
            });
            const liveStreams = response.data.items;

            if (liveStreams.length > 0) {
                liveStreams.forEach(async stream => {
                    if ((!streamers[stream.snippet.channelTitle] || (streamers[stream.snippet.channelTitle] && Date.now() > streamers[stream.snippet.channelTitle] + 1000 * 60 * 60 * 4))) {
                        const streamEmbed = new Discord.EmbedBuilder()
                            .setAuthor({ name: `${stream.snippet.channelTitle} is podracing on YouTube!`, iconURL: 'https://www.iconpacks.net/icons/2/free-youtube-logo-icon-2431-thumb.png' })
                            .setURL(`https://www.youtube.com/watch?v=${stream.id.videoId}`)
                            .setTitle(stream.snippet.title)
                            .setColor("#FF0000")
                            .setImage(stream.snippet.thumbnails.medium.url)
                        stream_channel.send({ embeds: [streamEmbed] });
                        streamers[stream.snippet.channelTitle] = Date.now()
                    }
                })
            }
        } catch (error) {
            //console.error('Error fetching YouTube streams', error);
        }
    }

    async function getStream() {
        const response = await Twitch.getStreams({ game_id: testing ? "515025" : "12415" });
        const streams = response.data;
        if (streams.length > 0) {
            // Create an array of stream links
            let stream_condensed = streams.filter(stream => !streamers[stream.user_name] || (streamers[stream.user_name] && Date.now() > streamers[stream.user_name] + 1000 * 60 * 60 * 4)).slice(0, 10)
            stream_condensed.forEach(stream => {
                streamers[stream.user_name] = Date.now()
            })
            stream_condensed.forEach(async (stream) => {
                const s = await Twitch.getUsers(stream.user_login);
                const profile = s?.data?.[0]?.profile_image_url
                const streamEmbed = new Discord.EmbedBuilder()
                    .setAuthor({ name: `${stream.user_name} is streaming Star Wars Episode I: Racer on Twitch!`, iconURL: 'https://assets.stickpng.com/images/580b57fcd9996e24bc43c540.png' })
                    .setURL(`https://www.twitch.tv/${stream.user_login}`)
                    .setDescription(`Started streaming <t:${Math.round(Date.parse(stream.started_at) / 1000)}:R>`)
                    .setColor("#6440A5")
                    .setThumbnail(profile)
                    .setImage(stream.getThumbnailUrl())
                if (stream.tags) {
                    streamEmbed.setFooter({ text: stream.tags.join(" • ") })
                }
                if (stream.title) {
                    streamEmbed.setTitle(stream.title ?? "(No Title)")
                }
                stream_channel.send({ embeds: [streamEmbed] });
            })
        }
    }

    database.ref('users').once("value", function (snapshot) {
        if (!testing) {
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
        }
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

    const updater = async () => {
        Object.keys(db.user).filter(key => db.user[key]?.random?.items).forEach(key => completeRepairs({ profile: db.user[key].random, profileref: database.ref(`users/${key}/random`), client, member: db.user[key].discordID }))

        if (!testing) {
            //searchYouTubeStreams();
            dailyBounty({ client, db, bountyref: database.ref('challenge/bounties') })
            getStream();
            dailyChallenge({ client, db, challengesref: database.ref('challenge/challenges') })
            monthlyChallenge({ client, db, challengesref: database.ref('challenge/challenges'), database })


            Object.values(db.ch.challenges).filter(challenge => ['cotd', 'cotm', 'open'].includes(challenge.type) && !isActive(challenge) && Date.now() - 48 * 60 * 60 * 1000 < challenge.created && challenge.channel == '551786988861128714' && challenge.message).forEach(challenge => {
                try {
                    client.channels.cache.get('551786988861128714').messages.fetch(challenge.message).then(msg => { if (msg.pinned) { msg.unpin().catch(console.error) } })
                } catch (err) {
                    console.log(err)
                }
            })

            Object.values(db.ch.bounties).forEach(bounty => {
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
                let ptc = Object.keys(db.user)
                return ptc.find(key => db.user[key].sgName === name.trim()) ?? ""
            }

            rp(url)
                .then(function (html) {
                    let table = cheerio('tbody', html)
                    let guildevents = Guild.scheduledEvents.cache
                    let events = guildevents.toJSON()
                    let values = []
                    Object.keys(db.ty.scheduled).forEach(key => {
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
                                        match.commentators[c] = db.user[c].discordID ?? ''
                                    })
                                } else if (values[j].includes("date")) {
                                    match.datetime = Date.parse(content.replace(", ", " " + new Date().getFullYear() + " ").replace(" ", " ") + " EDT")
                                } else if (values[j].includes("players")) {
                                    let split = content.split(/[^A-Za-z0-9_ ]+/g).map(f => f.split(" vs ")).flat()
                                    split.map(play => getParticipantbyName(play)).filter(p => ![null, undefined, ''].includes(p)).forEach(p => {
                                        match.players[p] = db.user[p].discordID ?? ''
                                    })
                                } else {
                                    match[values[j]] = content
                                }
                            }
                        })
                        if (i !== 0) {
                            let dup = false
                            if (db.ty.scheduled) {
                                Object.keys(db.ty.scheduled).forEach(key => {
                                    if (db.ty.scheduled[key].datetime == match.datetime) {
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
                        return (match.commentators && Object.keys(match.commentators).length > 0 ? "🎙️ " + Object.keys(match.commentators).map(id => db.user[id].name).join(", ") : "Sign up for commentary: https://speedgaming.org/swe1racer/crew/") +
                            (match.tourney ? `\n${db.ty.tournaments[match.tourney]?.name ?? ""}` : "") +
                            (!match.url ? "\n(Channel to be determined)" : "")
                    }
                    function matchTitle(match) {
                        let round = db.ty.tournaments[match.tourney]?.stages[match.bracket] ?? null
                        return (round ? `${round.bracket} ${round.round}: ` : '') + (match.players ? Object.keys(match.players).map(id => db.user[id].name).join(" vs ") : 'Unknown Players')
                    }
                    Object.keys(db.ty.scheduled).map(key => {
                        let match = db.ty.scheduled[key]

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

                    Object.keys(db.ty.scheduled).forEach(async key => {
                        let match = db.ty.scheduled[key]

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
                                    title: `${db.user[players[0]].name} Wins`,
                                    id: match.players[players[0]]
                                },
                                outcome_b: {
                                    title: `${db.user[players[1]].name} Wins`,
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
                        if (match.datetime < Date.now() && match.bet && db.ty.bets[match.bet]?.status == 'open') {
                            database.ref('tourney/bets').child(match.bet).child('status').set('closed')
                            editMessage(client, '536455290091077652', match.bet, { embeds: [betEmbed(db.ty.bets[match.bet])], components: betComponents(db.ty.bets[match.bet]) })
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
                                return Object.values(db.user).find(u => u.discordID == id)?.name ?? ''
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
    if (guildMember.guild.id == "441839750555369474" && !testing) {
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

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // When a reaction is received, check if the structure is partial
    if (user.bot) {
        return
    }
    if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            // Return as `reaction.message.author` may be undefined/null
            return;
        }
    }
    let profile = Object.values(db.user).find(u => u.discordID == user.id)
    if (profile?.random?.effects?.botto_buddy) {
        reaction.message.react(reaction.emoji)
    }
});

client.on(Events.MessageDelete, async messageDelete => {
    if (!messageDelete.guild) return;

    if (messageDelete.author?.bot == false && messageDelete.channel.type == "text" && messageDelete.guild.id == "441839750555369474" && messageDelete.channelId !== "444208252541075476") {
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
    if (oldMessage?.author?.bot == false && oldMessage?.channel?.type == "text" && oldMessage !== newMessage && oldMessage?.guild?.id == "441839750555369474") {
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
    if (message.author.bot || testing) return; //trumps any command from executing from a bot message

    const base = "You are a discord bot in the Star Wars Episode I: Racer discord. Your name is Botto. You roleplay as Watto from Star Wars Episode I: The Phantom Menace."
    let id = message.author.id
    let profile = Object.values(db.user).find(u => u.discordID == id)
    let friend = profile?.random?.effects?.friend_greed ? 'You are talking to your favorite customer. You will do your best to satisfy their podracing needs. Your currency of choice is truguts, credits are no good.' : "You are incredibly greedy, addicted to gambling, and you love to swindle and cheat. Be as uncooperative as possible. Your favorite currency is truguts."

    if (message.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
            await message.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            // Return as `reaction.message.author` may be undefined/null
            return;
        }
    }
    if (message.guildId == '441839750555369474' && !testing) {

        let drop_odds = 0.03

        if (anniversaryMonth()){
            drop_odds = 0.02
        }

        if (Math.random() < drop_odds) {
            let drop = Math.floor(Math.random() * 20) * 100 + 500

            if (anniversaryMonth()){
                drop *= 100
            }

            postMessage(client, message.channelId, { components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(`📀${tools.numberWithCommas(drop)}`).setCustomId(`challenge_random_drop_${drop}`).setStyle(ButtonStyle.Secondary))] })
        }
    }

    let autoreact = Object.values(db.ch.auto).filter(a => a.type == 'react').find(a => message.content.toLowerCase().includes(a.phrase.toLowerCase()))
    let autoreply = Object.values(db.ch.auto).filter(a => a.type == 'reply').find(a => message.content.toLowerCase().includes(a.phrase.toLowerCase()))

    if (message.mentions.users.has('545798436105224203')) {
        const previous = await fetchMessageContent(message);
        try {
            const response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: base + friend + " Add only one response to the conversation." },
                    { role: "user", content: `${previous}\n\n${message.content.replaceAll('<@545798436105224203>', 'Botto')}` }
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
    } else if (autoreact || autoreply) {
        if (autoreact) {
            message.react(autoreact.emoji)
        }
        if (autoreply) {
            message.reply({
                content: autoreply.reply,
                allowedMentions: {
                    repliedUser: false
                }
            });
        }
    }


    if (message.content.toLowerCase() == `!kill` && message.channelID == "444208252541075476") {
        message.channel.send("Come back when you got some money!")
        client.destroy()
    }
})


client.login(discord_token);