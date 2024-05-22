const TwitchApi = require("node-twitch").default;
const { EmbedBuilder } = require("discord.js");
const { testing } = require('../config.js');
const { streams_channel } = require("./data/discord/channel.js");
const { postMessage } = require("./discord.js");

const Twitch = new TwitchApi({
    client_id: process.env.TWITCH_ID,
    client_secret: process.env.TWITCH_SECRET
});

let streamers = {}

exports.scan_streams = async function (client) {
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
            const streamEmbed = new EmbedBuilder()
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
            postMessage(client, streams_channel, { embeds: [streamEmbed] })
        })
    }
}