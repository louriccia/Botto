require('dotenv').config({ path: __dirname + '/../.env' })

const { testing } = require('../config.js')

const { dailyChallenge, monthlyChallenge, completeRepairs } = require("./interactions/challenge/functions.js")
const { swe1r_guild, test_guild } = require('./data/discord/guild.js')
const { scan_streams } = require('./twitch.js')
const { drops } = require('./auto/drops.js')
const { update_users } = require('./auto/update_users.js')
const { botto_chat } = require('./auto/chat.js')
const { join_message } = require('./auto/join.js')
const { get_user_key_by_discord_id, initializePlayer, initializeUser } = require('./user.js')
const { loadStaticData } = require('./loadStaticData');

//openai
const OpenAI = require("openai")
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // This is also the default, can be omitted
});

const fs = require('fs');
const { Client, Events, GatewayIntentBits, Partials, Collection } = require('discord.js')
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

client.channelToMatch = new Map()

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
const { WhyNobodyBuy } = require('./data/discord/emoji.js')
const { requestWithUser } = require('./axios.js')

//banned
const banned = []

function switchGuard(guildId) {
    if (testing) {
        return guildId == test_guild
    }
    return guildId !== test_guild
}

//interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!switchGuard(interaction.guildId)) return;

    if (interaction.isAutocomplete()) return;
    //log command
    console.log(interaction.isChatInputCommand() ? 'slash' :
        interaction.isButton() ? 'button' :
            interaction.isMessageComponent() ? 'message_component' :
                interaction.isModalSubmit() ? 'modal_submit' :
                    'other', interaction.isChatInputCommand() ? interaction?.commandName?.toLowerCase() : interaction.customId, interaction.member?.displayName ?? interaction.user.displayName)

    const member_id = interaction.member?.id ?? interaction.user.id

    if (banned.includes(member_id)) {
        interaction.reply({ content: `${WhyNobodyBuy} Get lost!`, ephemeral: true })
        return
    }

    //prepare profile

    const member_name = interaction.member?.displayName
    const member_avatar = await interaction.member?.displayAvatarURL() ?? await interaction.user.displayAvatarURL()

    //database might be down
    if (!database) {
        interaction.reply({ content: 'Impossible, the archives must be... down?', ephemeral: true })
        return
    }

    //find player in userbase
    let user_key = get_user_key_by_discord_id(db, member_id)
    if (!user_key) {
        user_key = await initializeUser(database.ref('users'), member_id, member_name)
    }
    let user_profile = db.user[user_key]?.random
    if (!user_profile) {
        user_profile = initializePlayer(database.ref(`users/${user_key}/random`), member_name)
    }

    const userSnapshot = {
        username: interaction.member?.displayName ?? interaction.user.username,
        avatar: member_avatar,
        id: member_id
    }

    //command handler
    if (interaction.isChatInputCommand()) {
        const command = interaction.commandName.toLowerCase();

        if (!client.commands.has(command)) {
            console.log('command does not exist')
            return;
        }
        try {
            client.commands.get(command).execute({ client, interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "`Error: Command failed to execute `\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)] })
        }
    } else {
        let split = interaction.customId.split("_")
        const name = split[0]
        const args = split.slice(1)

        try {
            client.buttons.get(name).execute({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot });
        } catch (error) {
            console.error(error);
        }
    }
})

//autocomplete
client.on(Events.InteractionCreate, async interaction => {
    if (!switchGuard(interaction.guildId)) return;

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

    const minuteUpdater = async () => {
        Object.keys(db.user).filter(key => db.user[key]?.random?.items).forEach(key => completeRepairs({ user_profile: db.user[key].random, profile_ref: database.ref(`users/${key}/random`), client, member: db.user[key].discordID }))

        if (!testing) {
            scan_streams(client);
            dailyChallenge({ client, db, challengesref: database.ref('challenge/challenges') })
            monthlyChallenge({ client, db, challengesref: database.ref('challenge/challenges'), database })
        }
    }

    await loadStaticData();
    setInterval(minuteUpdater, 1000 * 60)
})

client.on(Events.GuildMemberAdd, (guildMember) => { //join log
    if (testing) return;
    join_message(client, guildMember)
})

client.on(Events.MessageReactionAdd, async (reaction, user) => {

    // When a reaction is received, check if the structure is partial
    if (user.bot || banned.includes(user.id)) {
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

    if (!switchGuard(reaction.message.guild.id)) return;

    const authorProfile = Object.values(db.user).find(u => u.discordID == user.id)
    if (!authorProfile?.random?.effects?.botto_buddy) {
        return
    }

    try {
        requestWithUser({
            method: 'get',
            url: '/users',
            query: { discordId: reaction.message.author.id },
        }).then(async data => {
            const user = data?.data?.[0]
            if (user?.settings?.botto?.allowReactions === false) {
                return
            }
            await reaction.message.react(reaction.emoji);
        }).catch(err => {
            console.error('Error fetching user settings:', err)
            return
        })
    } catch (error) {
        console.error('Failed to react to message:', error);
        return;
    }
});

client.on(Events.MessageDelete, async messageDelete => {
    if (!switchGuard(messageDelete.guild.id)) return;

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
    if (!switchGuard(message.guild.id)) return;

    if (message.author.bot || banned.includes(message.author.id)) return; //trumps any command from executing from a bot message

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

    // custom kill command
    if (message.content.toLowerCase() == `!kill` && message.channelId == "444208252541075476") {
        message.channel.send("Come back when you got some money!")
        client.destroy()
        return
    }

    //drops
    drops(client, message)
    botto_chat(message, db, openai)
})


client.login(process.env.token);