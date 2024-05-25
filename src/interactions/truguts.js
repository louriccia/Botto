const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { number_with_commas, big_number } = require('../generic.js');
const { manageTruguts } = require('../interactions/challenge/functions');
const { betEmbed, betComponents } = require('./trugut_functions.js');
module.exports = {
    name: 'truguts',
    async execute({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {

        let betdata = db.ty.bets
        let betref = database.ref('tourney/bets')
        const userref = database.ref('users')

        if (args[0] == "bet") {
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
                    outcome_a: {
                        title: interaction.options.getString('outcome_a')
                    },
                    outcome_b: {
                        title: interaction.options.getString('outcome_b')
                    },
                    min: interaction.options.getInteger('min_bet') ?? 10,
                    max: interaction.options.getInteger('max_bet') ?? 0
                }

                const betMessage = await interaction.reply({ embeds: [betEmbed(bet)], components: betComponents(bet), fetchReply: true })
                betref.child(betMessage.id).set(bet)
            } else if (args[1] == 'a' || args[1] == 'b') {
                let key = 'outcome_' + args[1]
                let bet = betdata[interaction.message.id]
                if ((bet.author.discordId == member_id || member_id == '256236315144749059') && bet.status == 'closed') {
                    bet.status = 'complete'
                    bet['outcome_' + args[1]].winner = true
                    bet['outcome_' + (args[1] == 'a' ? 'b' : 'a')].winner = false
                    //handle truguts
                    let totals = {
                        a: bet.outcome_a.bets ? bet.outcome_a.bets.map(b => b.amount).reduce((a, b) => a + b) : 0,
                        b: bet.outcome_b.bets ? bet.outcome_b.bets.map(b => b.amount).reduce((a, b) => a + b) : 0
                    }
                    let outcomes = ['a', 'b']
                    outcomes.forEach(x => {
                        let outcome = bet['outcome_' + x]
                        let opposite = x == 'a' ? 'b' : 'a'
                        if (outcome.bets) {
                            outcome.bets.forEach(b => {
                                if (outcome.winner) {
                                    let take = Math.round((b.amount / totals[x]) * totals[opposite])
                                    manageTruguts({ user_profile: db.user[b.id].random, profile_ref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
                                    b.take = take
                                } else {
                                    manageTruguts({ user_profile: db.user[b.id].random, profile_ref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
                                }
                            })
                        }
                    })
                    await betref.child(interaction.message.id).update(bet)
                    interaction.update({ embeds: [betEmbed(bet)], components: [] })
                    return
                }
                if (interaction.isModalSubmit()) {
                    let amount = interaction.fields.getTextInputValue('amount').replaceAll(",", "")
                    let current_bets = []
                    if (bet.outcome_a.bets) {
                        bet.outcome_a.bets.forEach(b => current_bets.push(b.discordId))
                    }
                    if (bet.outcome_b.bets) {
                        bet.outcome_b.bets.forEach(b => current_bets.push(b.discordId))
                    }
                    // if (bet.author.discordId == member_id) {
                    //     interaction.reply({ content: "You are the manager of this bet and cannot place a bet.", ephemeral: true })
                    //     return
                    // }
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

                    let a_bets = bet.outcome_a.bets ? Object.values(bet.outcome_a.bets).map(b => b.discordId) : []
                    let b_bets = bet.outcome_b.bets ? Object.values(bet.outcome_b.bets).map(b => b.discordId) : []
                    let already = a_bets.concat(b_bets).flat()
                    let existing = bet[key].bets ? bet[key].bets.find(b => b?.discordId == member_id) : null
                    if (already.includes(member_id)) {
                        if (existing && amount - existing.amount < 0) {
                            interaction.reply({ content: "You can only increase an existing bet.", ephemeral: true })
                            return
                        } else if (!existing) {
                            interaction.reply({ content: "You cannot bet on both outcomes!", ephemeral: true })
                            return
                        }
                    }


                    let thisbet = {
                        amount,
                        name: member_name,
                        id: user_key,
                        discordId: member_id
                    }
                    if (!bet[key].bets) {
                        bet[key].bets = []
                    }
                    if (existing) {
                        existing.amount = amount
                    } else {
                        bet[key].bets.push(thisbet)
                    }
                    betref.child(interaction.message.id).update(bet)
                    interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
                } else {
                    if (bet.status == 'closed') {
                        interaction.reply({ content: "This bet has closed.", ephemeral: true })
                        return
                    }
                    const submitModal = new ModalBuilder()
                        .setCustomId("truguts_bet_" + args[1])
                        .setTitle(args[1] == 'a' ? bet.outcome_a.title : bet.outcome_b.title)
                    const Amount = new TextInputBuilder()
                        .setCustomId("amount")
                        .setLabel("Bet Amount (Available Truguts: 📀" + big_number(user_profile.truguts_earned - user_profile.truguts_spent) + ")")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                    const ActionRow1 = new ActionRowBuilder().addComponents(Amount)
                    submitModal.addComponents(ActionRow1)
                    await interaction.showModal(submitModal)
                }

            } else if (args[1] == 'close') {
                let bet = betdata[interaction.message.id]
                if (member_id !== bet.author.discordId && member_id !== '256236315144749059') {
                    interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                    return
                }
                bet.status = 'closed'
                betref.child(interaction.message.id).update(bet)
                interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
            } else if (args[1] == 'open') {
                let bet = betdata[interaction.message.id]
                if (member_id !== bet.author.discordId && member_id !== '256236315144749059') {
                    interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                    return
                }
                bet.status = 'open'
                betref.child(interaction.message.id).update(bet)
                interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
            } else if (args[1] == 'delete') {
                let bet = betdata[interaction.message.id]
                if (member_id !== bet.author.discordId && member_id !== '256236315144749059') {
                    interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                    return
                }
                betref.child(interaction.message.id).remove()
                interaction.update({ content: 'Bet was canceled by author.', embeds: [], components: [] })
            }
        }

    }

}
