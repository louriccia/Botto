require('dotenv').config({ path: __dirname + '/../.env' })

const { testing } = require('../config.js')

const { dailyChallenge, monthlyChallenge, dailyBounty, completeRepairs } = require("./interactions/challenge/functions.js")
const { swe1r_guild, test_guild } = require('./data/discord/guild.js')
const { scrape_sg_events } = require('./auto/sg_event.js')
const { scan_streams } = require('./twitch.js')
const { drops } = require('./auto/drops.js')
const { update_users } = require('./auto/update_users.js')
const { botto_chat } = require('./auto/chat.js')
const { join_message } = require('./auto/join.js')
const { get_user_key_by_discord_id, initializePlayer, initializeUser } = require('./user.js')

const fs = require('fs');
const { Client, Events, GatewayIntentBits, Partials, Collection } = require('discord.js')
const { welcomeMessages } = require('./data/flavor/welcome.js')
const { errorMessage } = require('./data/flavor/error.js')
const { log_preview } = require('./papertrail.js')
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



//add commands to client
const commandFiles = fs.readdirSync(__dirname + '/commands/').filter(file => file.endsWith('.js'));
client.commands = new Collection();
for (const file of commandFiles) {
    const command = require(__dirname + `/commands/${file}`);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
    }
}

//add buttons to client
const buttonFiles = fs.readdirSync(__dirname + '/interactions').filter(file => file.endsWith('.js'));
client.buttons = new Collection();
for (const file of buttonFiles) {
    const button = require(__dirname + `/interactions/${file}`);
    client.buttons.set(button.name, button);
}

//firebase
const { db, database } = require('./firebase.js')

//interactions
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) return;
    if ((testing && interaction.guildId == test_guild) || (!testing && interaction.guildId !== test_guild)) {
        //log command
        console.log(interaction.isChatInputCommand() ? 'slash' :
            interaction.isButton() ? 'button' :
                interaction.isMessageComponent() ? 'message_component' :
                    interaction.isModalSubmit() ? 'modal_submit' :
                        'other', interaction.isChatInputCommand() ? interaction?.commandName?.toLowerCase() : interaction.customId, interaction.member?.displayName)

        //prepare profile
        const member_id = interaction.member.id
        const member_name = interaction.member.displayName
        const member_avatar = await interaction.member.displayAvatarURL()

        //database might be down
        if (!database) {
            interaction.reply({ content: 'Impossible, the archives must be... down?', ephemeral: true })
            return
        }

        //find player in userbase
        let user_key = get_user_key_by_discord_id(db, member_id)
        if (!user_key) {
            user_key = initializeUser(database.ref('users'), member_id, member_name)
        }
        let user_profile = db.user[user_key]?.random
        if (!user_profile) {
            user_profile = initializePlayer(database.ref(`users/${user_key}/random`), member_name)
        }

        //command handler
        if (interaction.isChatInputCommand()) {
            const command = interaction.commandName.toLowerCase();

            if (!client.commands.has(command)) {
                console.log('command does not exist')
                return;
            }
            try {
                client.commands.get(command).execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)] })
            }
        } else {
            let split = interaction.customId.split("_")
            const name = split[0]
            const args = split.slice(1)

            try {
                client.buttons.get(name).execute({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile });
            } catch (error) {
                console.error(error);
            }
        }
    }
})

//autocomplete
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    }
});

client.once(Events.ClientReady, async () => {
    console.log('Ready!')

    //delete last bot message in bot log channel
    if (!testing) {
        client.channels.cache.get("444208252541075476").messages.fetch({ limit: 1 }).then(messages => {
            let lastMessage = messages.first();

            if (lastMessage.author.bot) {
                lastMessage.delete().catch(err => console.log(err));
            }
        }).catch(console.error);
    }

    log_preview(client)
    update_users(client)

    const updater = async () => {
        Object.keys(db.user).filter(key => db.user[key]?.random?.items).forEach(key => completeRepairs({ user_profile: db.user[key].random, profile_ref: database.ref(`users/${key}/random`), client, member: db.user[key].discordID }))

        scan_streams(client);

        if (!testing) {
            //searchYouTubeStreams();
            dailyBounty({ client, db, bountyref: database.ref('challenge/bounties') })
            dailyChallenge({ client, db, challengesref: database.ref('challenge/challenges') })
            monthlyChallenge({ client, db, challengesref: database.ref('challenge/challenges'), database })
            scrape_sg_events(client, db, database)
        }

    }
    setInterval(updater, 1000 * 60)
})

client.on(Events.GuildMemberAdd, (guildMember) => { //join log
    join_message(client, guildMember)
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

    if (messageDelete.author?.bot || messageDelete.channel.type !== "text") {
        return
    }

    if (messageDelete.guild.id == swe1r_guild && messageDelete.channelId !== "444208252541075476") {
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
        database.ref('log').push(data);
    }
});



client.on(Events.MessageCreate, async function (message) {
    if (message.author.bot || testing) return; //trumps any command from executing from a bot message

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

    //drops
    drops(client, message)
    botto_chat(message, db)

    if (message.content.toLowerCase() == `!kill` && message.channelID == "444208252541075476") {
        message.channel.send("Come back when you got some money!")
        client.destroy()
    }
})


client.login(process.env.token);