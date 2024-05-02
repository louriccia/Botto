

exports.updateMessage = function (client, interaction, content, embeds, components) {
    let split = interaction.data.custom_id.split("_")
    let args = split.slice(1)
    let type = 7
    if (args.includes("new") || args.includes('initial')) {
        type = 4
    }
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: type,
            data: {
                content: content,
                embeds: embeds,
                components: components
            }
        }
    })
}

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

exports.createPoll = function (client, channel, poll){
    if (channel) {
        const messageFetch = client.channels.cache.get(channel).send({poll})
    }
}

exports.editMessage = function (client, channel, message, new_message) {
    client.channels.cache.get(channel).messages.fetch(message).then(msg => msg.edit(new_message))
}

exports.ephemeralMessage = function (client, interaction, content, embeds, components) {
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 4,
            data: {
                flags: 64,
                content: content,
                embeds: embeds,
                components: components

            }
        }
    })
}

exports.modalMessage = function (client, interaction, id, title, components) {
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 9,
            data: {
                custom_id: id,
                title: title,
                components: components
            }
        }
    })
}