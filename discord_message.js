

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

exports.postMessage = function (client, interaction, content, embeds, components) {
    client.api.channels(interaction.channel_id).messages.post({
        data: {
            content: content,
            embeds: embeds,
            components: components
        }
    })
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