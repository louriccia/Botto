const { updateChallenge, bribeComponents, playButton, notYoursEmbed, isActive, expiredEmbed, manageTruguts } = require('./functions.js');
const { tracks } = require('../../data/sw_racer/track.js')
const { EmbedBuilder } = require('discord.js');
const { truguts } = require('../../data/challenge/trugut.js');
const { number_with_commas } = require('../../generic.js');
exports.bribe = async function ({ current_challenge, current_challenge_ref, interaction, user_profile, args, profile_ref, member_avatar, db, member_id, botto_name } = {}) {

    //expired challenge
    if (!isActive(current_challenge)) {
        interaction.reply({ embeds: [expiredEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
        return
    }

    //not your challenge
    if (interaction.user.id !== current_challenge.player.member) {
        interaction.reply({ embeds: [notYoursEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
        return
    }

    let bribed = false
    if (interaction.isStringSelectMenu()) {
        let selection = Number(interaction.values[0])
        let purchase = {
            date: Date.now(),
            selection: selection
        }
        let bribe_cost = 0
        if (args[2] == "track") {
            bribe_cost = truguts.bribe_track
            purchase.purchased_item = "track bribe"
        } else if (args[2] == "racer") {
            bribe_cost = truguts.bribe_racer
            purchase.purchased_item = "racer bribe"
        }

        if (user_profile.truguts_earned - user_profile.truguts_spent < bribe_cost) { //can't afford bribe
            let noMoney = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                .setDescription("*'No money, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nBribe cost: `" + number_with_commas(bribe_cost) + "`")
            interaction.reply({ embeds: [noMoney], ephemeral: true })
            return
        }

        //process purchase

        if (args[2] == "track" && selection !== current_challenge.track) {
            current_challenge_ref.update({ track_bribe: true, track: selection, predictions: {}, created: Date.now() })
            bribed = true
            if (!tracks[selection].parskiptimes) {
                current_challenge_ref.update({ skips: false })
            }
        } else if (args[2] == "racer" && selection !== current_challenge.racer) {
            current_challenge_ref.update({ racer_bribe: true, racer: selection, predictions: {}, created: Date.now() })
            bribed = true
        }
        if (bribed) {
            manageTruguts({ user_profile, profile_ref, transaction: 'w', amount: bribe_cost, purchase })
        }
    }

    current_challenge = db.ch.challenges[current_challenge.message]
    //populate options
    let challenge_update = await updateChallenge({ client: interaction.client, user_profile, current_challenge, current_challenge_ref, profile_ref, member_id, name: botto_name, member_avatar, interaction, db })
    if (!bribed) {
        challenge_update.components = [challenge_update.components, bribeComponents(current_challenge)].flat()
    }
    interaction.update(challenge_update)
}