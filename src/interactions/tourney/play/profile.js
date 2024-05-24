const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { matchMakerEmbed, profileComponents } = require('../functions.js')
const { database, db } = require('../../../firebase.js')

exports.profile = async function ({ interaction, user_key } = {}) {

    const userref = database.ref('users')

    if (interaction.isModalSubmit()) {
        //parse inputs
        let bio = interaction.fields.getTextInputValue('bio')
        let flag = interaction.fields.getTextInputValue('flag').toLowerCase()
        let pronouns = interaction.fields.getTextInputValue('pronouns').toLowerCase().split("/")
        let platform = interaction.fields.getTextInputValue('platform')
        let input = interaction.fields.getTextInputValue('input')

        let pronouns_set = []
        pronouns.forEach(p => {
            let pronoun = p.toLowerCase().replaceAll(",", "").trim()
            if (pronoun.includes('they') || pronoun.includes('them') || pronoun.includes('their')) {
                if (!pronouns_set.includes('They/Them')) {
                    pronouns_set.push('They/Them')
                }
            } else if (pronoun.includes('she') || pronoun.includes('her') || pronoun.includes('hers')) {
                if (!pronouns_set.includes('She/Her')) {
                    pronouns_set.push('She/Her')
                }
            } else if (pronoun.includes('he') || pronoun.includes('him') || pronoun.includes('his')) {
                if (!pronouns_set.includes('He/Him')) {
                    pronouns_set.push('He/Him')
                }

            }
        })

        userref.child(user_key).update(
            {
                bio,
                country: flag,
                pronouns: pronouns_set,
                platform,
                input
            })
        interaction.update({ embeds: [matchMakerEmbed({ interaction })], components: profileComponents() })
    } else {
        const submitModal = new ModalBuilder()
            .setCustomId("tourney_play_profile")
            .setTitle("Update Profile Info")
        //.setValue()
        const Flag = new TextInputBuilder()
            .setCustomId("flag")
            .setLabel("Country Code")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('two letter code')
            .setMaxLength(2)
            .setRequired(false)
        if (db.user[user_key].country) {
            Flag.setValue(db.user[user_key].country)
        }
        const Pronouns = new TextInputBuilder()
            .setCustomId("pronouns")
            .setLabel("Pronouns")
            .setPlaceholder('he/she/they')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(false)
        if (db.user[user_key].pronouns) {
            Pronouns.setValue(Object.values(db.user[user_key].pronouns).join(", "))
        }
        const Platform = new TextInputBuilder()
            .setCustomId("platform")
            .setLabel("Platform")
            .setPlaceholder('pc/switch/ps4/xbox')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50)
            .setValue(db.user[user_key].platform ?? "")
        const Input = new TextInputBuilder()
            .setCustomId("input")
            .setLabel("Input Method")
            .setPlaceholder('keyboard/xbox controller')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50)
            .setValue(db.user[user_key].input ?? "")
        const Bio = new TextInputBuilder()
            .setCustomId("bio")
            .setLabel("Bio")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Just who is this mysterious podracer?')
            .setRequired(false)
            .setMaxLength(500)
            .setValue(db.user[user_key].bio ?? "")
        const ActionRow1 = new ActionRowBuilder().addComponents(Bio)
        const ActionRow2 = new ActionRowBuilder().addComponents(Flag)
        const ActionRow3 = new ActionRowBuilder().addComponents(Pronouns)
        const ActionRow4 = new ActionRowBuilder().addComponents(Platform)
        const ActionRow5 = new ActionRowBuilder().addComponents(Input)
        submitModal.addComponents(ActionRow1, ActionRow2, ActionRow3, ActionRow4, ActionRow5)
        await interaction.showModal(submitModal)
    }
}