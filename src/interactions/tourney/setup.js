
const { streams_channel, tournaments_channel, tournament_live_channel } = require('../../data/discord/channel.js');
const { postMessage } = require('../../discord.js');
const { database, db } = require('../../firebase.js');
const { reminderEmbed } = require('../../interactions/tourney/functions.js');
const { ActionRowBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const { get_user_name_by_discord_id } = require('../../user.js');
const { swe1r_guild } = require('../../data/discord/guild.js');

exports.setup = async function ({ key, client } = {}) {
    const Guild = await client.guilds.cache.get(swe1r_guild)
    let match = db.ty.scheduled[key]

    //add roles
    let everybody = Object.values(match.players || {}).concat(Object.values(match.commentators || {}))
    everybody.forEach(async function (player) {
        const thismember = await Guild.members.fetch(player)
        thismember.roles.add('970995237952569404').catch(error => console.log(error))
    })

    //setup match
    database.ref(`tourney/live/${tournament_live_channel}`).set(
        {
            ...match,
            current_race: 0,
            bracket: "",
            status: 'setup',
            firstvote: "",
            tourney: "",
            ruleset: "",
            stream: match.url
        }
    )

    //send notification
    database.ref(`tourney/scheduled/${key}/notification`).set(true)
    let notification_message = `<@&841059665474617353>\n**${Object.values(match.players).map(p => get_user_name_by_discord_id(p)).join(" vs. ")
        }**\n:microphone2: ${Object.values(match.commentators).map(comm => get_user_name_by_discord_id(comm)).join(", ")
        }\n ${match.url}`

    postMessage(
        client,
        streams_channel,
        notification_message
    )

    postMessage(
        client,
        tournaments_channel,
        notification_message
    )

    //set up prompt
    const ButtonRow = new ActionRowBuilder()
    ButtonRow.addComponents(
        new ButtonBuilder()
            .setCustomId("tourney_play_setup")
            .setLabel("Set Up Match")
            .setStyle(ButtonStyle.Primary)
    ).addComponents(
        new ButtonBuilder()
            .setCustomId("tourney_play_profile")
            .setLabel("Update Profile")
            .setStyle(ButtonStyle.Secondary)
    )

    postMessage(client, tournament_live_channel, {
        content: everybody.map(user => `<@${user}>`).join(" ") +
            `\n**${Object.values(match.players).map(player => get_user_name_by_discord_id(player)).join(" vs. ")}** is about to begin!`,
        embeds: [reminderEmbed()],
        components: [ButtonRow]
    })
}