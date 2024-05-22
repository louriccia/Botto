//papertrail
const axios = require('axios');
const { testing } = require('../config')
const { droid_testing, test_channel } = require('./data/discord/channel')

exports.log_preview = async function (client) {
    const notif_channel = client.channels.cache.get(testing ? test_channel : droid_testing)

    try {
        // Make a request to the Papertrail API to fetch logs
        const response = await axios.get(
            'https://papertrailapp.com/api/v1/events/search.json',
            {
                headers: {
                    'X-Papertrail-Token': process.env.PAPERTRAIL_KEY,
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
}
