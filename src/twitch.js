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

// node-twitch answers a 401 by trying a refresh token, which an app access token never has.
// When our token gets invalidated (expired, revoked, or the client secret was regenerated),
// drop it so the next call fetches a fresh app access token, and retry once.
async function twitchCall(fn) {
    try {
        return await fn()
    } catch (err) {
        if (err?.message !== "Refresh token is not set.") throw err
        Twitch.access_token = undefined
        return await fn()
    }
}

exports.scan_streams = async function (client) {
    try {
        await scan(client)
    } catch (err) {
        console.error("Twitch stream scan failed:", err)
    }
}

async function scan(client) {
    const response = await twitchCall(() => Twitch.getStreams({ game_id: testing ? "515025" : "12415" }));
    const streams = response.data;
    if (streams.length > 0) {
        // Create an array of stream links
        let stream_condensed = streams.filter(stream => !streamers[stream.user_name] || (streamers[stream.user_name] && Date.now() > streamers[stream.user_name] + 1000 * 60 * 60 * 8)).slice(0, 10)
        stream_condensed.forEach(stream => {
            streamers[stream.user_name] = Date.now()
        })

        //gahhh

        stream_condensed.forEach(async (stream) => {

            let big = false
            if (known[stream.user_name]) {
                big = true
            }

            const s = await twitchCall(() => Twitch.getUsers(stream.user_login)).catch(err => {
                console.error("Twitch user lookup failed:", err)
                return null
            });
            const profile = s?.data?.[0]?.profile_image_url
            const title = truncateString(stream.title || "(No Title)", big ? 256 : 65)
            const streamEmbed = new EmbedBuilder()
                .setAuthor({ name: `${stream.user_name} is podracing on Twitch!`, iconURL: profile })
                .setURL(`https://www.twitch.tv/${stream.user_login}`)
                .setColor(big ? "#FFFFFF" : "#6440A5")
                .setImage(big ? stream.getThumbnailUrl() : stream.thumbnail_url.replace("{width}", 300).replace("{height}", 160))
                .setTitle(title)
            if (stream.tags && big) {
                streamEmbed.setFooter({ text: stream.tags.join(" • ") })
            }
            postMessage(client, testing ? test_channel : streams_channel, { embeds: [streamEmbed] })
        })
    }
}