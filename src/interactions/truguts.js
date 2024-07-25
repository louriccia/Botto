const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { number_with_commas, big_number, truncateString } = require('../generic.js');
const { manageTruguts } = require('../interactions/challenge/functions');
const { betEmbed, betComponents } = require('./trugut_functions.js');
const { postMessage } = require('../discord.js');




module.exports = {
    name: 'truguts',
    async execute({ interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {

        let betdata = db.ty.bets
        let betref = database.ref('tourney/bets')
        const userref = database.ref('users')
        const bet_admin = '256236315144749059'

        if (args[0] == "bet") {



            let bet = null
            if (args[1] == 'new') {

                let bet = {
                    author: {
                        name: member_name,
                        avatar: member_avatar,
                        id: user_key,
                        discordId: member_id
                    },
                    title: interaction.options.getString('bet_title'),
                    status: "open",
                    outcomes: [
                        {
                            title: interaction.options.getString('outcome_a'),
                            type: 'this_or_that'
                        },
                        {
                            title: interaction.options.getString('outcome_b'),
                            type: 'this_or_that'
                        },
                        {
                            title: interaction.options.getString('outcome_c'),
                            type: 'this_or_that'
                        },
                        {
                            title: interaction.options.getString('outcome_d'),
                            type: 'this_or_that'
                        }
                    ].filter(o => o.title),
                    min: interaction.options.getInteger('min_bet') ?? 10,
                    max: interaction.options.getInteger('max_bet') ?? 0
                }

                //post message and save id
                const betMessage = await interaction.reply({ embeds: [betEmbed(bet)], components: betComponents(bet), fetchReply: true })
                betref.child(betMessage.id).set(bet)
                return
            } else {
                bet = betdata[interaction.message.id]
            }

            //guard admin actions
            if (['close', 'open', 'delete'].includes(args[1]) && ![bet.author.discordId, bet_admin].includes(member_id)) {
                interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                return
            }

            if (args[1] == 'close') {
                bet.status = 'closed'
                betref.child(interaction.message.id).update(bet)
                interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
            } else if (args[1] == 'open') {
                bet.status = 'open'
                betref.child(interaction.message.id).update(bet)
                interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
            } else if (args[1] == 'delete') {
                betref.child(interaction.message.id).remove()
                interaction.update({ content: 'Bet was canceled by author.', embeds: [], components: [] })
            } else if (!isNaN(Number(args[1]))) {
                let outcome_index = Number(args[1])
                let outcome = bet.outcomes[outcome_index]

                //post results
                if ([bet.author?.discordId, bet_admin].includes(member_id) && bet.status == 'closed') {
                    if (outcome.type == 'number') {
                        if (!interaction.isModalSubmit()) {
                            const submitModal = new ModalBuilder()
                                .setCustomId("truguts_bet_" + args[1])
                                .setTitle("Set Outcome: " + outcome.title)

                            const Result = new TextInputBuilder()
                                .setCustomId("result")
                                .setLabel("Result")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                            const ActionRow1 = new ActionRowBuilder().addComponents(Result)
                            submitModal.addComponents(ActionRow1)

                            await interaction.showModal(submitModal)
                            return
                        }

                        let result = interaction.fields.getTextInputValue('result').replaceAll(",", "")

                        if (isNaN(Number(result))) {
                            interaction.reply({ content: "The result must be an integer.", ephemeral: true })
                            return
                        }

                        if (!outcome.paid) {
                            //pay out
                            const total_wrong = outcome.bets.filter(b => b.guess !== result).map(b => b.amount).reduce((a, b) => a + b, 0) ?? 0
                            const total_right = outcome.bets.filter(b => b.guess == result).map(b => b.amount).reduce((a, b) => a + b, 0) ?? 0

                            console.log(total_wrong, total_right)
                            bet.outcomes[outcome_index].bets.forEach(b => {
                                if (b.guess == result) {
                                    let take = Math.round((b.amount / total_right) * total_wrong)
                                    manageTruguts({ user_profile: db.user[b.id].random, profile_ref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
                                    b.take = take
                                } else {
                                    manageTruguts({ user_profile: db.user[b.id].random, profile_ref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
                                }
                            })
                            bet.outcomes[outcome_index].paid = true
                            bet.outcomes[outcome_index].winner = result
                        }


                    } else if (outcome.type == 'this_or_that') {



                        if (!outcome.paid) {
                            const total_wrong = bet.outcomes.filter((o, i) => i !== outcome_index && o.type == 'this_or_that').map(o => o.bets).flat().map(b => b?.amount).reduce((a, b) => a + b, 0) ?? 0
                            const total_right = bet.outcomes.filter((o, i) => i == outcome_index && o.type == 'this_or_that').map(o => o.bets).flat().map(b => b?.amount).reduce((a, b) => a + b, 0) ?? 0

                            bet.outcomes.forEach((o, i) => {
                                if (o.type == "this_or_that") {
                                    o.winner = i == outcome_index
                                    if (o.bets) {
                                        o.bets.forEach(b => {
                                            if (o.winner) {
                                                let take = Math.round((b.amount / total_right) * total_wrong)
                                                console.log(take)
                                                manageTruguts({ user_profile: db.user[b.id].random, profile_ref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
                                                b.take = take
                                            } else {
                                                manageTruguts({ user_profile: db.user[b.id].random, profile_ref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
                                            }
                                        })
                                    }

                                    o.paid = true
                                }

                            })
                        }
                    }

                    //determine final close out
                    if (!bet.outcomes.map(o => o.paid).filter(a => a !== true).length) {
                        if (interaction.message?.pinned) {
                            try {
                                interaction.message.unpin()
                            } catch (err) {
                                console.log(err)
                            }
                        }

                        bet.status = 'complete'
                        if (bet.type == 'tourney') {
                            postMessage(interaction.client, interaction.channel.id, { content: `${bet.title} has been paid out!\nhttps://discord.com/channels/441839750555369474/${interaction.channel.id}/${interaction.message.id}` })
                        }
                    }

                    //update bet and message
                    await betref.child(interaction.message.id).update(bet)
                    interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })

                    return
                }


                if (interaction.isModalSubmit()) {
                    let amount = interaction.fields.getTextInputValue('amount').replaceAll(",", "")
                    let note = interaction.fields.getTextInputValue('note')
                    if (isNaN(Number(amount))) {
                        interaction.reply({ content: "The bet amount must be an integer.", ephemeral: true })
                        return
                    }

                    amount = Math.round(amount)
                    if (amount > user_profile.truguts_earned - user_profile.truguts_spent) {
                        interaction.reply({ content: "You do not have enough truguts to make this bet. (Current Truguts: `📀" + big_number(user_profile.truguts_earned - user_profile.truguts_spent) + "`)", ephemeral: true })
                        return
                    }
                    if ((amount < bet.min && bet.min) || (amount > bet.max && bet.max) || amount <= 0) {
                        interaction.reply({ content: "The bet amount is outside the accepted range. (" + bet.min + " - " + bet.max + ")", ephemeral: true })
                        return
                    }


                    let guess = outcome.type == 'number' ? interaction.fields.getTextInputValue('guess') : null
                    if (outcome.type == 'number' && isNaN(Number(guess))) {
                        interaction.reply({ content: "You guess must be a positive integer.", ephemeral: true })
                        return
                    }

                    const all_bets = bet.outcomes.map((outcome, o) => outcome.bets?.map(b => ({ ...b, outcome: o }))).flat().filter(b => b?.discordId == member_id)

                    if (all_bets.length) {

                        const existing_bet = all_bets.find(bet => bet.outcome == outcome_index)
                        const other_bet = all_bets.find(b => b.outcome !== outcome_index && bet.outcomes[b.outcome].type == 'this_or_that')

                        if (existing_bet && amount - existing_bet.amount < 0) {
                            interaction.reply({ content: "You can only increase an existing bet.", ephemeral: true })
                            return
                        }

                        if (other_bet && outcome.type !== 'number') {
                            interaction.reply({ content: "You cannot bet on multiple outcomes!", ephemeral: true })
                            return
                        }
                    }



                    let thisbet = {
                        amount,
                        name: member_name,
                        id: user_key,
                        discordId: member_id,
                        note
                    }
                    if (outcome.type == 'number') {
                        thisbet.guess = guess
                    }


                    if (!bet.outcomes[outcome_index].bets) {
                        bet.outcomes[outcome_index].bets = []
                    }

                    const existing_bet_index = bet.outcomes[outcome_index].bets.findIndex(bet => bet.discordId == member_id)

                    if (existing_bet_index >= 0) {
                        bet.outcomes[outcome_index].bets[existing_bet_index].amount = amount
                    } else {
                        bet.outcomes[outcome_index].bets.push(thisbet)
                    }
                    betref.child(interaction.message.id).update(bet)
                    interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
                } else {
                    if (['closed', 'complete'].includes(bet.status)) {
                        interaction.reply({ content: "This bet has closed.", ephemeral: true })
                        return
                    }

                    let outcome_index = Number(args[1])
                    let outcome = bet.outcomes[outcome_index]

                    const existing_bet = bet.outcomes.map((outcome, o) => outcome.bets?.map(bet => ({ ...bet, outcome: o }))).flat().find(bet => bet?.discordId == member_id && bet.outcome == outcome_index)

                    const submitModal = new ModalBuilder()
                        .setCustomId("truguts_bet_" + args[1])
                        .setTitle(outcome.title)
                    const Amount = new TextInputBuilder()
                        .setCustomId("amount")
                        .setLabel("Wager (Available Truguts: 📀" + big_number(user_profile.truguts_earned - user_profile.truguts_spent) + ")")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)

                    if (existing_bet?.amount) {
                        Amount.setValue(String(existing_bet.amount))
                    }

                    const ActionRow1 = new ActionRowBuilder().addComponents(Amount)
                    submitModal.addComponents(ActionRow1)
                    if (outcome.type == 'number') {
                        const Guess = new TextInputBuilder()
                            .setCustomId("guess")
                            .setLabel("Guess")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                        if (existing_bet?.guess) {
                            Guess.setValue(String(existing_bet.guess))
                        }
                        const ActionRow2 = new ActionRowBuilder().addComponents(Guess)
                        submitModal.addComponents(ActionRow2)
                    }

                    const Note = new TextInputBuilder()
                        .setCustomId("note")
                        .setLabel("Note")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(25)

                    if (existing_bet?.note) {
                        Note.setValue(String(existing_bet.note))
                    }
                    const ActionRow3 = new ActionRowBuilder().addComponents(Note)
                    submitModal.addComponents(ActionRow3)

                    await interaction.showModal(submitModal)
                }
            }
        }

    }

}
