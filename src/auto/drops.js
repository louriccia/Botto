const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { anniversaryMonth } = require('../interactions/challenge/functions')
const { postMessage } = require('../discord')
const { testing } = require('../../config')
const { number_with_commas } = require('../generic')
const { requestWithUser } = require('../axios')

const whitelist = [
    '442087812007985174',
    '441842584592056320',
    '602412114363154432',
    '778759239379582976',
    '1101233984106668042',
    '536455290091077652',
    '551786988861128714',
    '444627151858171934',
    '449375461886132235',
    '449375389081403413',
    '449375331208658965',
    '449375302502711297',
    '725066951185137776',
    '441858905014927361',
    '848941048218779668',
    '1135800422066556940',
    '1235050189153370183',
    '1235050393021579296'
]

const DROP_ODDS = 0.025
const ANNIVERSARY_MULTIPLIER = 100

exports.drops = function (client, message) {
    if (!whitelist.includes(message.channelId) && !testing) {
        return
    }

    const random_number = Math.random()
    if (random_number > DROP_ODDS) {
        return
    }

    // check user settings if drops are enabled
    //query /users on backend for a user with matching discordId
    requestWithUser({
        method: 'get',
        url: '/users',
        query: { discordId: message.author.id },
    }).then(data => {
        const user = data?.data?.[0]
        if (user?.settings?.botto?.allowSpecialDrops === false) {
            return
        }

        const drop = Math.floor(Math.random() * 20) * 100 + 500

        if (anniversaryMonth()) { // 100x multiplier for anniversary month
            drop *= ANNIVERSARY_MULTIPLIER
        }

        postMessage(client, message.channelId, {
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`📀${number_with_commas(drop)}`)
                        .setCustomId(`challenge_random_drop_${drop}`)
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        })

    }).catch(err => {
        console.error('Error fetching user settings:', err)
        return
    })

    // if (anniversaryMonth() && Math.random() < 0.01 && whitelist.includes(message.channelId)) {
    //     postMessage(client, message.channelId, {
    //         components: [
    //             new ActionRowBuilder().addComponents(
    //                 new ButtonBuilder()
    //                     .setEmoji('🎟️')
    //                     .setCustomId(`challenge_random_drop_ticket`)
    //                     .setStyle(ButtonStyle.Secondary)
    //             )
    //         ]
    //     })
    // }
}
