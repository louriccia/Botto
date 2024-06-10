const { achievementProgress, racerHint, trackHint } = require('../functions.js');
const { tracks } = require('../../../data/sw_racer/track.js')
const { number_with_commas } = require('../../../generic.js');

const { EmbedBuilder } = require('discord.js');
const { hints } = require('../../../data/challenge/hint.js');

exports.hint = async function ({ interaction, db, member_id, member_avatar, user_profile, botto_name, selection } = {}) {

    //get achievement progress
    let achievements = achievementProgress({ db, player: member_id })
    let achievement = selection[3][0]
    const hintmap = {
        'basic': 0,
        'standard': 1,
        'deluxe': 2,
    }
    let hint = Number(hintmap[selection[2][0]]) + (user_profile.effects?.movie_buff ? 1 : 0)
    const hintBuy = new EmbedBuilder()
        .setColor("#ED4245")
        .setAuthor({ name: botto_name + "'s Random Challenge Hint", iconURL: member_avatar })
        .setTitle(":bulb: " + hints[hint].name + ": " + achievements[achievement].name)
    //figure out missing challenges for each achievement
    for (let j = 0; j < 25; j++) {
        if (j < 23) {
            if (!Object.keys(achievements.pod_champ.collection).map(c => Number(c)).includes(j) && j < 23) {
                achievements.pod_champ.missing.push(j)
            }
            if (!Object.keys(achievements.slow_steady.collection).map(c => Number(c)).includes(j) && j < 23) {
                achievements.slow_steady.missing.push(j)
            }
        }
        if (!Object.keys(achievements.galaxy_famous.collection).map(c => Number(c)).includes(j)) {
            achievements.galaxy_famous.missing.push(j)
        }
        if (!Object.keys(achievements.light_skipper.collection).map(c => Number(c)).includes(j) && tracks[j].hasOwnProperty("parskiptimes")) {
            achievements.light_skipper.missing.push(j)
        }
        if (!Object.keys(achievements.mirror_dimension.collection).map(c => Number(c)).includes(j)) {
            achievements.mirror_dimension.missing.push(j)
        }
        if (!Object.keys(achievements.crowd_favorite.collection).map(c => Number(c)).includes(j)) {
            achievements.crowd_favorite.missing.push(j)
        }
        if (!Object.keys(achievements.backwards_compatible.collection).map(c => Number(c)).includes(j)) {
            achievements.backwards_compatible.missing.push(j)
        }
        for (let l = 0; l < 23; l++) {
            if (!Object.keys(achievements.true_jedi.collection).includes(j + " " + l)) {
                achievements.true_jedi.missing.push(j + "," + l)
            }
        }
    }

    //get random missing challenge
    let racer = null, track = null
    if (["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", 'backwards_compatible'].includes(achievement)) {
        track = achievements[achievement].missing[Math.floor(Math.random() * achievements[achievement].missing.length)]
        if (achievement == "crowd_favorite") {
            racer = tracks[track].favorite
        }
    }
    if (["pod_champ", "slow_steady"].includes(achievement)) {
        racer = achievements[achievement].missing[Math.floor(Math.random() * achievements[achievement].missing.length)]
    }
    if (achievement == "true_jedi") {
        let random = achievements.true_jedi.missing[Math.floor(Math.random() * achievements.true_jedi.missing.length)]
        random = random.split(",")
        track = random[0]
        racer = random[1]
    }

    //player already has achievement
    if ((["galaxy_famous", "light_skipper", "mirror_dimension", "crowd_favorite", "true_jedi", 'backwards_compatible'].includes(achievement) && track == null) || (["pod_champ", "slow_steady", "true_jedi"].includes(achievement) && racer == null)) {
        hintBuy.setDescription("You already have this achievement and do not require a hint. You have not been charged. \n\nAlready have all the achievements? Try a Challenge Bounty!")
        interaction.reply({ embeds: [hintBuy] })
        return false
    }

    //prepare hint
    if (track) {
        hintBuy.addFields({ name: "Track Hint", value: trackHint({ track, count: Number(hint), db }).map(h => "○ *" + h + "*").join("\n") })
    }
    if (racer) {
        hintBuy.addFields({ name: "Racer Hint", value: racerHint({ racer, count: Number(hint), db }).map(h => "○ *" + h + "*").join("\n") })
    }
    // process purchase

    hintBuy.setDescription("`-📀" + number_with_commas(hints[hint].price) + "`")
    //profile_ref.update({ truguts_spent: user_profile.truguts_spent + hints[hint].price })

    interaction.reply({ embeds: [hintBuy] })
    return true
}