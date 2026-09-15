const { openCoffers, cofferEmbed, earnedItem, challengeContainer, challengeComponents, getBest, bribePerks, playButton, notYoursEmbed, COFFER_ID } = require('./functions.js');
const { postMessage } = require('../../discord.js');
const { EmbedBuilder, MessageFlags } = require('discord.js');

//The Open button that rides the challenge card's Item Reward. A coffer is the one reward
//that isn't finished when it drops -- it's four more rolls sitting in the inventory
//waiting to be collected -- and leaving that trip to the player is how somebody ended up
//holding three hundred of them. Opening it where it drops is the same operation the
//inventory runs, at a count of one: see openCoffers in functions.js.
exports.coffer = async function ({ current_challenge, interaction, user_profile, profile_ref, member_avatar, db, member_id, user_key, botto_name } = {}) {

    //Deliberately NOT gated on isActive. The Item Reward only renders on a completed
    //card, and isActive is false for exactly those -- gating on it would refuse every
    //press this button can ever receive. Expiry is about racing the challenge anyway; the
    //coffer is already sitting on the profile and stays openable for as long as it exists.

    //not your challenge, or a card whose challenge is no longer in the database and whose
    //owner therefore can't be established. The card is a public message, so without this
    //anyone reading it could press Open and spend a coffer off their own profile -- their
    //own item, but never the one they thought they were opening
    if (!current_challenge || interaction.user.id !== current_challenge.player?.member) {
        interaction.reply({ embeds: [notYoursEmbed()], components: [{ type: 1, components: [playButton()] }], ephemeral: true })
        return
    }

    //Rebuilding the card fetches the proof thumbnail, which can blow Discord's 3s
    //acknowledgement window -- acknowledge first, then edit
    await interaction.deferUpdate()

    const item = earnedItem({ current_challenge, member: member_id, user_profile, db })
    if (item?.id !== COFFER_ID || item?.used || !item?.key) {
        //already opened, traded away or scrapped between the render and the press. Say so
        //rather than silently opening a different coffer out of the inventory
        await interaction.followUp({
            embeds: [new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> That one's already been opened")
                .setDescription("This challenge's coffer is gone. Any others are in your inventory.")],
            ephemeral: true
        })
        return
    }

    const { opened, items: new_items } = await openCoffers({ user_profile, profile_ref, db, member_id, limit: 1, keys: [item.key] })
    if (!opened) {
        await interaction.followUp({
            embeds: [new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> That one's already been opened")
                .setDescription("This challenge's coffer is gone. Any others are in your inventory.")],
            ephemeral: true
        })
        return
    }

    postMessage(interaction.client, interaction.channelId, { embeds: [cofferEmbed({ items: new_items, opened, user_profile, name: botto_name, avatar: member_avatar })] })

    //re-render so the accessory disappears and the line reads as history
    user_profile = db.user[user_key]?.random ?? user_profile
    const perks = bribePerks({ current_challenge, user_profile, member: member_id, db, client: interaction.client, member_roles: interaction.member?.roles?.cache })
    const container = await challengeContainer({ client: interaction.client, current_challenge, user_profile, profile_ref, best: getBest(db, current_challenge), name: botto_name, member: member_id, avatar: member_avatar, db, perks })
    await interaction.editReply({ components: [...container, challengeComponents(current_challenge, user_profile, db, perks)], flags: MessageFlags.IsComponentsV2 })
}
