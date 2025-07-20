const { updateChallenge, sponsorComponents, sponsorEmbed, validateTime, sponsorAchievement, achievementEmbed } = require('./functions.js');
const { postMessage } = require('../../discord.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { achievement_data } = require('../../data/challenge/achievement.js');
const { swe1r_guild } = require('../../data/discord/guild.js');

exports.sponsor = async function ({ interaction, args, db, member_id, botto_name, database, user_key, user_profile, member_avatar, profile_ref } = {}) {

    const sponsor_ref = database.ref('challenge/sponsorships')
    const challenges_ref = database.ref('challenge/challenges')

    if (args[2] == 'details') { //set title / time
        sponsorchallenge = db.ch.sponsors[interaction.message.id]
        if (interaction.isModalSubmit()) {
            let title = interaction.fields.getTextInputValue('customTitle')
            let time = interaction.fields.getTextInputValue('customTime')
            time = validateTime(time)

            sponsor_ref.child(interaction.message.id).update({ title, time })

            user_profile = db.user[user_key].random
            sponsorchallenge = db.ch.sponsors[interaction.message.id]
            interaction.update({ embeds: [sponsorEmbed(sponsorchallenge, user_profile, db)], components: sponsorComponents(user_profile, 1) })
        } else {
            const sponsorModal = new ModalBuilder()
                .setCustomId('challenge_random_sponsor_details')
                .setTitle('Sponsor Customization')
            const customTitle = new TextInputBuilder()
                .setCustomId('customTitle')
                .setLabel('Custom Title')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(70)
                .setValue(sponsorchallenge.title ?? "")
                .setRequired(false)
            const customTime = new TextInputBuilder()
                .setCustomId('customTime')
                .setLabel('Custom Time')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(9)
                .setPlaceholder("--:--.---")
                .setValue(sponsorchallenge.time ?? "")
                .setRequired(false)
            const ActionRow1 = new ActionRowBuilder().addComponents(customTitle)
            const ActionRow2 = new ActionRowBuilder().addComponents(customTime)
            sponsorModal.addComponents(ActionRow1, ActionRow2)
            await interaction.showModal(sponsorModal)
        }

    } else if (args[2] == 'publish') { //post challenge
        let sponsorchallenge = db.ch.sponsors[interaction.message.id]
        if (sponsorchallenge.published) {
            const cantSponsor = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> You what?")
                .setDescription("This sponsorship was already published at " + sponsorchallenge.url)
            interaction.reply({ embeds: [cantSponsor], ephemeral: true })
            return
        }
        sponsorchallenge.sponsor = {
            avatar: member_avatar,
            member_id,
            name: botto_name,
            user: user_key
        }
        const pub_response = await updateChallenge({ client: interaction.client, user_profile, current_challenge: sponsorchallenge, profile_ref, member_id, name: botto_name, avatar: member_avatar, interaction, db })
        let publishmessage_reply = await interaction.reply(pub_response)
        const publishmessage = publishmessage_reply.resource.message
        if (interaction.guildId == swe1r_guild) {
            publishmessage.pin()
        }

        sponsorchallenge.message = publishmessage.id
        sponsorchallenge.url = publishmessage.url
        sponsor_ref.child(interaction.message.id).update({ published: true, url: publishmessage.url })
        challenges_ref.child(publishmessage.id).set(sponsorchallenge)

        if (sponsorAchievement(db, member_id) >= achievement_data.bankroller_clan.limit) { //award achievement
            if (interaction.guildId == swe1r_guild) {
                if (!interaction.member.roles.cache.some(r => r.id === achievement_data.bankroller_clan.role)) { //award role
                    interaction.member.roles.add(achievement_data.bankroller_clan.role).catch(error => console.log(error))
                }
            }
            if (!user_profile?.achievements?.bankroller_clan) {
                postMessage(interaction.client, current_challenge.channel, { embeds: [achievementEmbed(p.name, p.avatar, achievement_data.bankroller_clan, interaction.guild)] })
                profile_ref.child('achievements').child("bankroller_clan").set(true)
            }
        }
    } else {
        interaction.reply({ embeds: [sponsorEmbed(null, user_profile, db)], components: sponsorComponents(user_profile, cselection, 0), ephemeral: true })
    }
}