const youtubeThumbnail = require('youtube-thumbnail');

exports.get_thumbnail = async function (url) {
    try {
        const thumbnailInfo = await youtubeThumbnail(url);
        return thumbnailInfo.medium.url
    } catch (error) {
        return null
    }
};

exports.get_stream = function () {
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
}
