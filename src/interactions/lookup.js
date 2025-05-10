const axios = require('axios');
const { getRacerEmbed, getTrackEmbed, partEmbed, getTracks } = require('../generic.js');
const { racerSelector, trackSelector } = require('./challenge/functions.js');

axios.defaults.baseURL = 'http://localhost:3000/api/v1';
axios.defaults.headers.common['Authorization'] = 'Bearer YOUR_ACCESS_TOKEN';
axios.defaults.headers.post['Content-Type'] = 'application/json';

module.exports = {
    name: 'lookup',
    async execute({ client, interaction, args, database, db, member_id, member_avatar, user_key } = {}) {
        if (interaction.isStringSelectMenu()) {
            args[1] = interaction.values[0]
        }
        if (args[0] == "racer") {
            try {

                const response = await axios.get('/racers/' + (args[1] ?? "0"));
                const racerEmbed = getRacerEmbed(response.data);
                const components = racerSelector({ customid: 'lookup_racer', placeholder: "Select a racer", min: 1, max: 1, selected: [args[1]] });
                if (interaction.isStringSelectMenu()) {
                    interaction.update({ embeds: [racerEmbed], components })
                    return
                }
                interaction.reply({ embeds: [racerEmbed], components })
            } catch (error) {
                console.log(error)
                interaction.reply({ content: error, ephemeral: true })
            }
        } else if (args[0] == "track") {
            try {
                const tracks = await getTracks()
                console.log(args[1], tracks.find(track => track.id == args[1]))
                const trackEmbed = getTrackEmbed(tracks.find(track => track.id == args[1]) ?? tracks[0]);
                const components = trackSelector({ tracks, customid: 'lookup_track', placeholder: "Select a track", min: 1, max: 1, selected: [args[1]] });
                if (interaction.isStringSelectMenu()) {
                    interaction.update({ embeds: [trackEmbed], components })
                    return
                }
                interaction.reply({ embeds: [trackEmbed], components })
            } catch (error) {
                console.log(error)
                interaction.reply({ content: error, ephemeral: true })
            }
        } else if (args[0] == "part") {
            try {
                const response = await axios.get('/parts');
                const parts = response.data
                const part = parts.filter(part => part.id == args[1]);
                const trackEmbed = partEmbed(part);
                if (interaction.isStringSelectMenu()) {
                    interaction.update({ embeds: [trackEmbed] })
                    return
                }
                interaction.reply({ embeds: [trackEmbed] })
            } catch (error) {
                console.log(error)
                interaction.reply({ content: error, ephemeral: true })
            }
        }
    }
}
