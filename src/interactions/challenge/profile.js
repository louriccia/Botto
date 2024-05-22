const { achievementProgress, manageTruguts, profileComponents, profileEmbed, getStats, playerLevel, convertLevel, progressionReward } = require('./functions.js');
const { postMessage } = require('../../discord.js');

const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.profile = async function ({ interaction, args, db, member_id, user_profile, botto_name, member_avatar, profile_ref } = {}) {
    if (args[2] == 'bio') {
        function isValidHexCode(hexCode) {
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(hexCode);
        }
        if (interaction.isModalSubmit()) {

            let name = interaction.fields.getTextInputValue("name")
            let bio = interaction.fields.getTextInputValue("bio")
            let color = interaction.fields.getTextInputValue("color")
            if (!isValidHexCode(color)) {
                color = ""
            }
            user_profile.name = name
            user_profile.bio = bio
            user_profile.color = color
            await profile_ref.update(user_profile)
        } else {
            const profileModal = new ModalBuilder()
                .setCustomId('challenge_random_profile_bio')
                .setTitle('Customize Profile')
            const name = new TextInputBuilder()
                .setCustomId('name')
                .setLabel(`Name`)
                .setMinLength(2)
                .setMaxLength(16)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            const bio = new TextInputBuilder()
                .setCustomId('bio')
                .setLabel(`Bio`)
                .setMinLength(0)
                .setMaxLength(140)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
            const color = new TextInputBuilder()
                .setCustomId('color')
                .setLabel(`Color`)
                .setPlaceholder("#FFFFFF")
                .setMinLength(7)
                .setMaxLength(7)
                .setStyle(TextInputStyle.Short)
                .setRequired(false)

            if (user_profile.name) {
                name.setValue(user_profile.name)
            }
            if (user_profile.bio) {
                bio.setValue(user_profile.bio)
            }
            if (user_profile.color) {
                color.setValue(user_profile.color)
            }
            const ActionRow1 = new ActionRowBuilder().addComponents(name)
            const ActionRow2 = new ActionRowBuilder().addComponents(bio)
            const ActionRow3 = new ActionRowBuilder().addComponents(color)
            profileModal.addComponents(ActionRow1, ActionRow2, ActionRow3)

            await interaction.showModal(profileModal)
            return
        }
    }

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply()
    } else {
        await interaction.deferUpdate()
    }

    const ach_report = achievementProgress({ db, player: member_id })
    const stats = getStats({ db, member_id, user_profile })
    if (!user_profile.progression) {
        let progression = Object.values(stats.racers).map(r => r.level)
        progression.forEach((level, racer) => {
            for (let i = 1; i < convertLevel(level).level + 1; i++) {
                let reward = progressionReward({ racer, level: i })
                manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: reward.truguts })
                if (reward.item) {
                    profile_ref.child('items').push({
                        id: reward.item,
                        date: Date.now(),
                        progression: {
                            racer: racer,
                            level: i
                        }
                    })
                }

            }
        })
        await profile_ref.child('progression').set(progression)
        let new_player_level = playerLevel(progression)
        postMessage(client, interaction.channelId, { embeds: [new EmbedBuilder().setAuthor({ name: `${botto_name} leveled up!`, iconURL: member_avatar }).setDescription(new_player_level.string).setFooter({ text: `Level ${new_player_level.level}` })] })
    }
    interaction.editReply({ embeds: [profileEmbed({ db, player: member_id, name: botto_name, avatar: member_avatar, ach_report, user_profile, stats })], components: profileComponents({ member_id, ach_report, stats, user_profile }) })

}