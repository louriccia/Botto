const TwitchApi = require("node-twitch").default;
const { EmbedBuilder } = require("discord.js");
const { testing } = require('../config.js');
const { streams_channel, test_channel } = require("./data/discord/channel.js");
const { postMessage } = require("./discord.js");
const { truncateString } = require("./generic.js");

const known = {
    "SpeedGaming": true,
    "SpeedGaming2": true,
    "SpeedGaming3": true,
    "SpeedGaming4": true,
    "Homura_Akemi_": true,
    "HaroldShoemaker": true,
    "NachoBrado": true,
    "Natem4n": true,
    "lilac_dryad": true,
    "DigitalNameUnavailable": true,
    "Nok_1267": true,
    "metallica5167": true,
    "DomiraeSSB": true,
    "Page_SR": true,
    "dwyguyy": true,
    "xAdypt": true
}

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
        let stream_condensed = streams.filter(stream => !streamers[stream.user_name] || (streamers[stream.user_name] && Date.now() > streamers[stream.user_name] + 1000 * 60 * 60 * 8)).slice(0, 10)
        stream_condensed.forEach(stream => {
            streamers[stream.user_name] = Date.now()
        })



        stream_condensed.forEach(async (stream) => {

            let big = false
            if (known[stream.user_name]) {
                big = true
            }

            const s = await Twitch.getUsers(stream.user_login);
            const profile = s?.data?.[0]?.profile_image_url
            const streamEmbed = new EmbedBuilder()
                .setAuthor({ name: `${stream.user_name} is podracing on Twitch!`, iconURL: profile })
                .setURL(`https://www.twitch.tv/${stream.user_login}`)
                .setColor(big ? "#FFFFFF" : "#6440A5")
                .setImage(big ? stream.getThumbnailUrl() : stream.thumbnail_url.replace("{width}", 300).replace("{height}", 160))
                .setTitle(big ? (stream.title ?? "(No Title)") : truncateString(stream.title ?? "(No Title)", 65))
            if (stream.tags && big) {
                streamEmbed.setFooter({ text: stream.tags.join(" • ") })
            }
            postMessage(client, testing ? test_channel : streams_channel, { embeds: [streamEmbed] })
        })
    }
}