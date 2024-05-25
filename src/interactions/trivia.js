const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { number_with_commas, big_number } = require('../generic.js');
const { betEmbed } = require('./trugut_functions.js');
const { blurple_color } = require('../colors.js');
module.exports = {
    name: 'trivia',
    async execute({ interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {



        let bet_key = Object.keys(db.ch.trivia).find(key => db.ch.trivia[key].bet_message == interaction.message.id)

        if (!bet_key) {
            interaction.reply({ content: "Better stop betting or I'll own you!", ephemeral: true })
            return
        }

        let bet = db.ch.trivia[bet_key]

        if (!bet.bets_open) {
            interaction.reply({ content: "This bet has closed.", ephemeral: true })
            return
        }

        const betref = database.ref(`challenge/trivia/${bet_key}/bets`)

        let current_bet = db.ch.trivia[bet_key]?.bets?.[member_id]

        if (interaction.isModalSubmit()) {
            let amount = interaction.fields.getTextInputValue('amount').replaceAll(",", "")

            if (isNaN(Number(amount))) {
                interaction.reply({ content: "The bet amount must be an integer.", ephemeral: true })
                return
            }
            amount = Math.round(amount)
            if (amount > user_profile.truguts_earned - user_profile.truguts_spent) {
                interaction.reply({ content: "You do not have enough truguts to make this bet. (Current Truguts: `📀" + big_number(user_profile.truguts_earned - user_profile.truguts_spent) + "`)", ephemeral: true })
                return
            }
            if (amount > 1000000 || amount <= 0) {
                interaction.reply({ content: "The bet amount is outside the accepted range. (0 - 1,000,000)", ephemeral: true })
                return
            }

            if (current_bet && amount - current_bet.amount < 0) {
                interaction.reply({ content: "You can only increase an existing bet.", ephemeral: true })
                return
            }

            betref.child(member_id).set(
                {
                    better: member_id,
                    amount,
                    date: Date.now()
                }
            )

            let content = `expires <t:${Math.round((bet.date + 45000) / 1000)}:R>\n`
            let bet_data = db.ch.trivia[bet_key].bets
            if (bet_data) {
                Object.values(bet_data).forEach(b => {
                    content += `\n* <@${b.better}> \`📀${big_number(b.amount)}\``
                })
            }

            const triviaBetEmbed = new EmbedBuilder()
                .setTitle("Place Your Bets!")
                .setDescription(content)
                .setColor(blurple_color)

            interaction.update({ embeds: [triviaBetEmbed] })
        } else {

            const submitModal = new ModalBuilder()
                .setCustomId("trivia_bet")
                .setTitle("Bet on the next question")
            const Amount = new TextInputBuilder()
                .setCustomId("amount")
                .setLabel("Bet Amount (Available Truguts: 📀" + big_number(user_profile.truguts_earned - user_profile.truguts_spent) + ")")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            const ActionRow1 = new ActionRowBuilder().addComponents(Amount)
            submitModal.addComponents(ActionRow1)
            await interaction.showModal(submitModal)
        }
    }
}