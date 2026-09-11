const { updateChallenge, bribeComponents, bribeDelta, bribePerks, bribeHeat, applyHeat, rollHeatPenalty, bribeBlacklist, challengeContainer, getBest, playButton, notYoursEmbed, isActive, expiredEmbed, manageTruguts } = require('./functions.js');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { number_with_commas, getTracks } = require('../../generic.js');
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

    //Blacklisted: a previous roll had the player walked out of the pits. This is the
    //authoritative check -- challengeComponents also hides the button, but a stale message
    //can still deliver the press
    const blacklisted = bribeBlacklist(user_profile)
    if (blacklisted) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> Your money's no good here")
            .setDescription(`Word got around. Nobody in the pits will take your bribe until <t:${Math.round(blacklisted / 1000)}:t>.`)
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }

    //Citizenship and Smuggling Routes both discount this bribe; the interaction's own
    //member list is the freshest source for a role equipped this session
    const perks = bribePerks({ current_challenge, user_profile, member: member_id, db, client: interaction.client, member_roles: interaction.member?.roles?.cache })

    //read the staged selection out of the message's select defaults, overlaying
    //the values of the select that fired this interaction. condition stays null
    //until its select has been rendered (bribeComponents then mirrors the
    //challenge's current conditions as the starting set)
    const selection = { track: [], racer: [], condition: null }
    //walk the whole component tree -- a components v2 message mixes text displays
    //and containers in at top level, so not every entry is an action row
    ;(function scrape(nodes) {
        (nodes ?? []).forEach(node => {
            const options = node?.data?.options ?? node?.options
            const key = node?.data?.custom_id?.split("_")[3] ?? node?.customId?.split("_")[3]
            if (options && ['track', 'racer', 'condition'].includes(key)) {
                selection[key] = options.filter(o => o.default ?? o.data?.default).map(o => o.value ?? o.data?.value)
            }
            scrape(node?.components)
        })
    })(interaction.message.components)
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
        const delta = bribeDelta({ current_challenge, user_profile, selection, perks })
        if (delta.error || !delta.changes.length) {
            const holdUp = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?")
                .setDescription(delta.error ?? "Nothing selected to bribe.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }
        const available = user_profile.truguts_earned - user_profile.truguts_spent
        if (available < delta.cost) { //can't afford bribe
            let noMoney = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> Insufficient Truguts")
                .setDescription("*'No money, no bribe!'*\nYou do not have enough truguts to make this bribe.\n\nBribe cost: `" + number_with_commas(delta.cost) + "`")
            interaction.reply({ embeds: [noMoney], ephemeral: true })
            return
        }

        //Roll for a penalty before charging, because two of them change the price. The
        //roll reads the heat the player walked in with, so a first bribe from a cold
        //profile is always clean, and it resolves here rather than at submit time: the
        //player has to see the outcome before deciding whether to race it
        const penalty = rollHeatPenalty({ user_profile, perks, delta, current_challenge, available })

        //process purchase
        manageTruguts({
            user_profile, profile_ref, transaction: 'w', amount: delta.cost + (penalty?.extra_cost ?? 0), purchase: {
                date: Date.now(),
                purchased_item: 'bribe',
                selection: delta.changes.join(", ")
                    + (delta.discounts.length ? ` (free: ${delta.discounts.join(', ')})` : '')
                    + (penalty ? ` [${penalty.title}]` : '')
            }
        })
        //heat accrues on the bribe itself, whatever it cost -- a free bribe is still a bribe
        user_profile = applyHeat({ user_profile, profile_ref, amount: bribeHeat({ delta, perks }) })
        //Blacklisted is the one penalty that outlives the challenge it was rolled on
        if (penalty?.until) {
            profile_ref.child('effects').update({ bribe_blacklist: penalty.until })
            user_profile.effects = { ...(user_profile.effects ?? {}), bribe_blacklist: penalty.until }
        }

        //the penalty's own changes land on top of the staged ones -- Wrong Guy overwrites
        //the pick the player made, and The Handicap adds a condition they didn't ask for
        const bribe_update = { ...delta.update, ...(penalty?.update ?? {}), predictions: {}, created: Date.now() }
        if (penalty) {
            bribe_update.heat_penalty = penalty
        }
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
    if (!current_challenge.track_bribe && !getTracks().length) {
        //the track cache never loaded (botto-api was down at boot); an empty
        //select is rejected by Discord, so bail out until the retry fills it
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> The archives are incomplete")
            .setDescription("Track data hasn't finished loading yet. Try again in a minute.")
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }
    const components = bribeComponents({ current_challenge, user_profile, selection, perks })
    if (!components.length) {
        const holdUp = new EmbedBuilder()
            .setTitle("<:WhyNobodyBuy:589481340957753363> No bribery in the pits!")
            .setDescription("You've already used every available bribe on this challenge.")
        interaction.reply({ embeds: [holdUp], ephemeral: true })
        return
    }
    if (current_challenge.v2) {
        //a components-v2 message is entirely components, so the challenge card
        //has to be rebuilt alongside the bribe selects. that rebuild fetches
        //the proof thumbnail, which can blow Discord's 3s acknowledgement
        //window -- acknowledge first, then edit
        await interaction.deferUpdate()
        const container = await challengeContainer({ client: interaction.client, current_challenge, user_profile, profile_ref, best: getBest(db, current_challenge), name: botto_name, member: member_id, avatar: member_avatar, db, perks })
        await interaction.editReply({ components: [...container, ...components], flags: MessageFlags.IsComponentsV2 })
    } else {
        interaction.update({ components })
    }
}
