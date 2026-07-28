const { updateChallenge, bribeComponents, bribeDelta, playButton, notYoursEmbed, isActive, expiredEmbed, manageTruguts } = require('./functions.js');
const { tracks } = require('../../data/sw_racer/track.js')
const { planets } = require('../../data/sw_racer/planet.js')
const { EmbedBuilder } = require('discord.js');
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

    //Citizenship: free bribes on the citizen planet's tracks while its role is equipped
    const challenge_planet = planets[tracks[current_challenge.track]?.planet]
    const citizen = !!(challenge_planet
        && user_profile.effects?.[challenge_planet.name.toLowerCase().replaceAll(" ", "_")]
        && interaction.member.roles.cache.some(r => r.id === challenge_planet.role))

    //read the staged selection out of the message's select defaults, overlaying
    //the values of the select that fired this interaction. condition stays null
    //until its select has been rendered (bribeComponents then mirrors the
    //challenge's current conditions as the starting set)
    const selection = { track: [], racer: [], condition: null }
    interaction.message.components.forEach(row => {
        const comp = row.components[0]
        if (!comp?.data?.options) {
            return
        }
        const key = comp.data.custom_id?.split("_")[3]
        if (!['track', 'racer', 'condition'].includes(key)) {
            return
        }
        selection[key] = comp.data.options.filter(o => o.default).map(o => o.value)
    })
    if (interaction.isStringSelectMenu() && ['track', 'racer', 'condition'].includes(args[2])) {
        selection[args[2]] = interaction.values
    }

    //cancel: restore the normal challenge view without applying anything
    if (args[2] == 'cancel') {
        const challenge_update = await updateChallenge({ client: interaction.client, user_profile, current_challenge, profile_ref, member: member_id, name: botto_name, avatar: member_avatar, interaction, db })
        interaction.update(challenge_update)
        return
    }

    //submit: apply every staged change at once
    if (args[2] == 'submit') {
        const delta = bribeDelta({ current_challenge, user_profile, selection, citizen })
        if (delta.error || !delta.changes.length) {
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?")
                .setDescription(delta.error ?? "Nothing selected to bribe.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }
        if (user_profile.truguts_earned - user_profile.truguts_spent < delta.cost) { //can't afford bribe
            let noMoney = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                .setDescription("*'No money, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nBribe cost: `" + number_with_commas(delta.cost) + "`")
            interaction.reply({ embeds: [noMoney], ephemeral: true })
            return
        }

        //process purchase
        manageTruguts({
            user_profile, profile_ref, transaction: 'w', amount: delta.cost, purchase: {
                date: Date.now(),
                purchased_item: 'bribe',
                selection: delta.changes.join(", ") + (citizen ? ' (citizen)' : '')
            }
        })
        const bribe_update = { ...delta.update, predictions: {}, created: Date.now() }
        await current_challenge_ref.update(bribe_update)

        //merge locally rather than re-reading db.ch.challenges -- the cache
        //listener may not have echoed the write yet, and rendering the stale
        //object would show the pre-bribe title and description
        current_challenge = { ...current_challenge, ...bribe_update }
        const challenge_update = await updateChallenge({ client: interaction.client, user_profile, current_challenge, profile_ref, member: member_id, name: botto_name, avatar: member_avatar, interaction, db })
        interaction.update(challenge_update)
        return
    }

    //initial press or a select change: (re)render the staged bribe UI in place
    //of the challenge components -- nothing is applied until submit
    const components = bribeComponents({ current_challenge, user_profile, selection, citizen })
    if (!components.length) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> No bribery in the pits!")
            .setDescription("You've already used every available bribe on this challenge.")
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }
    interaction.update({ components })
}
