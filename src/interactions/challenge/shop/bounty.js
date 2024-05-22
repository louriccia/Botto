const { playButton, initializeBounty, bountyEmbed } = require('../functions.js');

exports.bounty = async function ({ interaction, db, database, member_id, member_avatar, user_key, user_profile, botto_name, selection } = {}) {
    let hselection = selection[2][0]
    const hintmap = {
        'basic': 0,
        'standard': 1,
        'deluxe': 2,
    }
    let bounty = initializeBounty('private', hintmap[hselection], { name: botto_name, member_id, user: user_key, avatar: member_avatar }, user_profile)
    const message = await interaction.reply({
        embeds: [bountyEmbed({ bounty, user_profile, db })], components: [
            {
                type: 1,
                components: [playButton()]
            }
        ], fetchReply: true
    })
    bounty.url = message.url
    bounty.message = message.id
    bounty.channel = message.channelId
    database.ref('challenge/bounties').push(bounty)
}