const { tracks } = require('../../data/sw_racer/track.js')
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');
const { number_with_commas } = require('../../generic.js');
exports.map = async function ({ interaction, db, member_id, user_profile }) {
    await interaction.deferReply()
    const width = 10 * 23
    const height = 8 * 25

    //set up blank canvas
    const image = new Jimp(width, height);
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            image.setPixelColor(Jimp.cssColorToHex('#000000'), i, j)
        }
    }

    //get rival
    let rival_id = null
    if (user_profile.rival) {
        rival_id = Object.values(user_profile.rival).sort((a, b) => b.date - a.date)[0].player
    }

    //calculate unique challenge total
    const unique_challenges = (tracks.filter(t => t.skips).length * 8 * 23 * 10) + (tracks.filter(t => !t.skips).length * 8 * 23 * 5)

    //color in played challenges
    let challenge_times = {}
    function challengekey(challenge) {
        return `${challenge.track}_${challenge.racer}_${challenge.conditions.laps}_${challenge.conditions.skips}_${challenge.conditions.nu}_${challenge.conditions.mirror}_${challenge.conditions.backwards}`
    }
    const times = Object.values(db.ch.times).filter(t => !Array.isArray(t.track))
    let record_holder = {}

    times.sort((a, b) => b.time - a.time).forEach(time => {
        let x = (10 * time.racer) + ((time.conditions.laps - 1) * 2) + (time.conditions.skips ? 1 : 0)
        let y = (8 * time.track) + (time.conditions.nu ? 4 : 0) + (time.conditions.mirror ? 2 : 0) + (time.conditions.backwards ? 1 : 0)
        const color = Jimp.cssColorToHex('#444444');
        image.setPixelColor(color, x, y);
        record_holder[challengekey(time)] = time.user
        if (!challenge_times[challengekey(time)] || time.time - challenge_times[challengekey(time)] < 0) {
            challenge_times[challengekey(time)] = Number(time.time)
        }
    })


    //color in player and rival
    let player_challenges = {}
    let rival_challenges = {}
    let rival_beat = {}
    times.filter(time => [member_id, rival_id].includes(time.user) && time.user !== null).sort((a, b) => b.time - a.time).forEach(time => {
        let x = (10 * time.racer) + ((time.conditions.laps - 1) * 2) + (time.conditions.skips ? 1 : 0)
        let y = (8 * time.track) + (time.conditions.nu ? 4 : 0) + (time.conditions.mirror ? 2 : 0) + (time.conditions.backwards ? 1 : 0)

        let recordholder = record_holder[challengekey(time)] == member_id
        let color = Jimp.cssColorToHex(recordholder ? '#00FF00' : '#FFFFFF');
        if (time.user == rival_id) {
            color = Jimp.cssColorToHex('#FF0000');
        }
        if (time.user == member_id) {
            player_challenges[challengekey(time)] = time.time
        } else if (time.user == rival_id) {
            rival_challenges[challengekey(time)] = time.time
            if (player_challenges[challengekey(time)]) {
                rival_beat[challengekey(time)] = true
            }
        }

        challenge_times[challengekey(time)] = Number(time.time)

        if (time.user == member_id || (time.user == rival_id && player_challenges[challengekey(time)])) {
            image.setPixelColor(color, x, y)
        }
    })

    //calculate shared challenges
    const shared_challenges = Object.keys(player_challenges).filter(key => rival_challenges[key]).length

    // grey out tracks with no skips
    tracks.forEach((track, index) => {
        if (!track.skips) {
            for (let i = 0; i < 23; i++) {
                for (let lap = 0; lap < 5; lap++) {
                    for (let j = 0; j < 8; j++) {
                        let x = (10 * i) + (lap * 2) + 1
                        let y = (8 * index) + j
                        const color = Jimp.cssColorToHex('#111111');
                        image.setPixelColor(color, x, y);
                    }
                }
            }
        }
    })


    // Double the size of the image
    const doubledImage = image.clone().resize(width * 6, height * 6, Jimp.RESIZE_NEAREST_NEIGHBOR);

    // Save the generated doubled-size image as a file

    const imageFileName = 'map.png';
    await doubledImage.writeAsync(imageFileName);

    // Set the bot's avatar to the modified image
    const file = new AttachmentBuilder(imageFileName);

    let desc = `There are **${number_with_commas(unique_challenges)
        }** unique challenges.\nOnly **${number_with_commas(Object.keys(challenge_times).length)
        }** have been completed.\n<@${member_id
        }> has completed **${number_with_commas(Object.keys(player_challenges).length)
        }** unique challenges and holds the record on **${number_with_commas(Object.values(record_holder).filter(value => value == member_id).length)
        }** challenges.`

    if (rival_id) {
        desc += `\n<@${rival_id}>, their rival, has completed **${number_with_commas(Object.keys(rival_challenges).length)
            }** unique challenges and has a faster time on **${number_with_commas(Object.keys(rival_beat).length)
            }/${number_with_commas(shared_challenges)}** challenges.`
    }

    const quoteEmbed = new EmbedBuilder()
        .setTitle("Random Challenge Map")
        .setDescription(desc)
        .setColor("#ED4245")
        .setFooter({ text: '⬛ unplayed, ⬜ played, 🟩 record-holder, 🟥 rival bops' })
        .setImage(`attachment://${imageFileName}`);
    interaction.editReply({ embeds: [quoteEmbed], files: [file] })

    //interaction.editReply({ content: 'Generated Image', files: [imageFileName] })
}