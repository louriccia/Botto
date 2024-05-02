const { SlashCommandBuilder, EmbedBuilder, Poll } = require('discord.js');
const { postMessage } = require('../discord_message');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('answer podracing-themed trivia questions'),
    async execute(interaction) {


        let poll = {
            question: { text: 'This is a test?' },
            answers: [
                { answer_id: 1, poll_media: { text: 'yes this is a test' } },
                { answer_id: 2, poll_media: { text: 'no this is a test' } }
            ],
            duration: 1,
            allowMultiselect: false,
            layoutType: 1,
        }

        interaction.client.api.webhooks(interaction.client.user.id, interaction.token).post({
            data: {
                body: { poll: { allow_multiselect: false, answers: [{ answer_id: 1, poll_media: { text: "hi" } }], expiry: new Date().toString(), layout_type: 1, question: { text: "can i send this with a bot" } } }
            }

        })

        const channel = await interaction.client.channels.fetch(interaction.channelId);
        const fetchedMessage = await channel.messages.fetch('1235425719518236773');
        console.log(fetchedMessage);

        //postMessage(interaction.client, interaction.channelId, {poll: poll})

    }

}
