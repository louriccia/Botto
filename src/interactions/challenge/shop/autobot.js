const { emojimap, emoji_id } = require('../../../data/discord/emoji.js')
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

exports.autobot = async function ({ interaction, database, user_key } = {}) {
    let title = shoption.value == 'protocol' ? "💭Protocol Droid" : '💬Made to Suffer'
        if (interaction.isModalSubmit()) {
            let phrase = interaction.fields.getTextInputValue('phrase')
            let emoji = '', reply = '', selected_emoji = ''
            if (shoption.value == 'protocol') {
                emoji = interaction.fields.getTextInputValue('emoji') ?? ""
                selected_emoji = Object.keys(emojimap).find(e => e.toLowerCase() == emoji.toLowerCase())
            } else {
                reply = interaction.fields.getTextInputValue('reply') ?? ""
            }
            if (!selected_emoji && shoption.value == 'protocol') {
                const noTruguts = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that emoji doesn't exist.")
                    .setDescription("Please double check its name and spelling. Only SWE1R Server emotes are eligible.")
                interaction.reply({ embeds: [noTruguts], ephemeral: true })
                return
            }

            database.ref(`challenge/auto`).push({
                player: user_key,
                type: shoption.value == 'protocol' ? 'react' : 'reply',
                phrase: phrase,
                reply: reply,
                emoji: selected_emoji ? emoji_id(emojimap[selected_emoji]) : "" 
            })
            const quoteEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(`Botto will now automatically ${shoption.value == 'protocol' ? 'react' : 'reply'} to messages containing "${phrase}" with ${shoption.value == 'protocol' ? emojimap[selected_emoji] : `: *${reply}*`}`)
            interaction.reply({ embeds: [quoteEmbed], ephemeral: true })
        } else {
            const sponsorModal = new ModalBuilder()
                .setCustomId('challenge_random_shop_purchase')
                .setTitle('Protocol Droid')
            const clue = new TextInputBuilder()
                .setCustomId('phrase')
                .setLabel('Phrase')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter a word/phrase')
                .setMinLength(5)
                .setMaxLength(140)
                .setRequired(true)
            const emoji = new TextInputBuilder()
                .setCustomId(shoption.value == 'protocol' ? 'emoji' : 'reply')
                .setLabel(shoption.value == 'protocol' ? 'Emoji' : 'Reply')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`Enter ${shoption.value == 'protocol' ? 'an emoji' : 'a response'} that Botto will use to ${shoption.value == 'protocol' ? 'react' : 'reply'}`)
                .setMaxLength(140)
                .setRequired(true)
            const ActionRow1 = new ActionRowBuilder().addComponents(clue)
            const ActionRow2 = new ActionRowBuilder().addComponents(emoji)
            sponsorModal.addComponents(ActionRow1, ActionRow2)
            await interaction.showModal(sponsorModal)
            return
        }
}