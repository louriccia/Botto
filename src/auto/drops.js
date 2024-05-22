const DROP_ODDS = 0.035
const { ActionRowBuilder, ButtonBuilder } = require('discord.js')
const { anniversaryMonth } = require('../interactions/challenge/functions')
const { postMessage } = require('../discord')
const { testing } = require('../../config')
const { number_with_commas } = require('../generic')

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

exports.drops = function (client, message) {
    if (message.guildId == '441839750555369474' && !testing) {
        let random_number = Math.random()

        if (random_number < DROP_ODDS && whitelist.includes(message.channelId)) {
            let drop = Math.floor(Math.random() * 20) * 100 + 500

            if (anniversaryMonth()) {
                drop *= 100
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
        }

        if (Math.random() < 0.01 && whitelist.includes(message.channelId)) {
            postMessage(client, message.channelId, {
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setEmoji('🎟️')
                            .setCustomId(`challenge_random_drop_ticket`)
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            })
        }
    }
}
