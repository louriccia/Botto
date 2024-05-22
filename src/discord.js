exports.followupMessage = function (client, interaction, content, embeds, components) {
    client.api.webhooks(client.user.id, interaction.token).post({
        data: {
            content: content,
            embeds: embeds,
            components: components
        }
    })
}

exports.postMessage = async function (client, channel, message) {
    if (channel) {
        const messageFetch = await client.channels.cache.get(channel).send(message ? message : 'empty message')
        return messageFetch
    }
}

exports.editMessage = function (client, channel, message, new_message) {
    client.channels.cache.get(channel).messages.fetch(message).then(msg => msg.edit(new_message))
}
