const { settings_default } = require('./data.js');
const { settingsEmbed, settingsComponents } = require('./functions.js');
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.settings = async function ({ interaction, db, botto_name, user_profile, member_avatar, profile_ref, user_key, args } = {}) {
    if (args[2] == 'initial') {
        user_profile = db.user[user_key].random
        interaction.reply({ embeds: [settingsEmbed({ user_profile, name: botto_name, avatar: member_avatar })], components: settingsComponents(user_profile), ephemeral: true })
        return
    }
    if (args[2] == "winnings") {
        profile_ref.child("settings").update({ winnings: Number(interaction.values[0]) })
    } else if (args[2] == "other") {
        let update = {}
        let other_options = ['predictions', 'flavor']
        other_options.forEach(value => {
            update[value] = interaction.values.includes(value)
        })
        profile_ref.child("settings").update(update)
    } else if (args[2] == 'nav') {
        profile_ref.child('settings').update({ nav: interaction.values })
    } else if (args[2] == "odds") {
        if (interaction.isModalSubmit()) {
            let odds = {
                skips: interaction.fields.getTextInputValue('skipsOdds'),
                no_upgrades: interaction.fields.getTextInputValue('nuOdds'),
                non_3_lap: interaction.fields.getTextInputValue('n3lOdds'),
                mirror_mode: interaction.fields.getTextInputValue('mirrorOdds'),
                backwards: interaction.fields.getTextInputValue('backwardsOdds'),
            }
            Object.keys(odds).forEach(key => {
                if (isNaN(Number(odds[key]))) {
                    odds[key] = settings_default[key]
                } else {
                    odds[key] = Math.round(Number(odds[key]))
                }
            })
            profile_ref.child('settings').update(odds)
        } else {
            const oddsModal = new ModalBuilder()
                .setCustomId('challenge_random_settings_odds')
                .setTitle('Customize Odds')
            const skipsOdds = new TextInputBuilder()
                .setCustomId('skipsOdds')
                .setLabel('Skips')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(2)
                .setMinLength(1)
                .setValue(String(user_profile.settings.skips))
                .setRequired(true)
            const nuOdds = new TextInputBuilder()
                .setCustomId('nuOdds')
                .setLabel('No Upgrades')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(2)
                .setMinLength(1)
                .setValue(String(user_profile.settings.no_upgrades))
                .setRequired(true)
            const n3lOdds = new TextInputBuilder()
                .setCustomId('n3lOdds')
                .setLabel('Non 3-Lap')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(2)
                .setMinLength(1)
                .setValue(String(user_profile.settings.non_3_lap))
                .setRequired(true)
            const mirrorOdds = new TextInputBuilder()
                .setCustomId('mirrorOdds')
                .setLabel('Mirror Mode')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(2)
                .setMinLength(1)
                .setValue(String(user_profile.settings.mirror_mode))
                .setRequired(true)
            const backwardsOdds = new TextInputBuilder()
                .setCustomId('backwardsOdds')
                .setLabel('Backwards')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(2)
                .setMinLength(1)
                .setValue(String(user_profile.settings.backwards))
                .setRequired(true)
            const ActionRow1 = new ActionRowBuilder().addComponents(skipsOdds)
            const ActionRow2 = new ActionRowBuilder().addComponents(nuOdds)
            const ActionRow3 = new ActionRowBuilder().addComponents(n3lOdds)
            const ActionRow4 = new ActionRowBuilder().addComponents(mirrorOdds)
            const ActionRow5 = new ActionRowBuilder().addComponents(backwardsOdds)
            oddsModal.addComponents(ActionRow1, ActionRow2, ActionRow3, ActionRow4, ActionRow5)

            await interaction.showModal(oddsModal)
            return
        }
    } else if (args[2] == "default") {
        profile_ref.child("settings").update({
            winnings: settings_default.winnings,
            skips: settings_default.skips,
            no_upgrades: settings_default.no_upgrades,
            non_3_lap: settings_default.non_3_lap,
            mirror_mode: settings_default.mirror_mode,
            backwards: settings_default.backwards,
            predictions: settings_default.predictions,
            flavor: settings_default.flavor
        })
    }
    user_profile = db.user[user_key].random
    interaction.update({ embeds: [settingsEmbed({ user_profile, name: botto_name, avatar: member_avatar })], components: settingsComponents(user_profile) })
}