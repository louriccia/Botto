const { about } = require('../../data/challenge/about.js')
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js')

exports.about = async function ({ interaction } = {}) {
    let about_selection = interaction.values?.[0] ?? 'rchallenge'
    const challengeHelpEmbed = new EmbedBuilder()
        .setAuthor({ name: "Random Challenge", value: "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png" })
        .setTitle(":grey_question: About")
        .setColor("#ED4245")
        .setDescription(`**${about[about_selection].emoji} ${about[about_selection].name}**\n${about[about_selection].desc}`)

    const row1 = new ActionRowBuilder()
    const about_selector = new StringSelectMenuBuilder()
        .setCustomId('challenge_random_about')
        .setPlaceholder("Select A Circuit")
        .setMinValues(1)
        .setMaxValues(1)
    Object.keys(about).forEach(key => {
        about_selector.addOptions(
            {
                label: about[key].name,
                value: key,
                emoji: about[key].emoji,
                default: about_selection == key
            }
        )
    })
    row1.addComponents(about_selector)
    if (interaction.isStringSelectMenu()) {
        interaction.update({ embeds: [challengeHelpEmbed], components: [row1], ephemeral: true })
    } else {
        interaction.reply({ embeds: [challengeHelpEmbed], components: [row1], ephemeral: true })
    }
}