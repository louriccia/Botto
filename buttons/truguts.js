const { EmbedBuilder, ComponentBuilder, ButtonBuilder, ModalBuilder, ActionRowBuilder, ActionRow, ButtonStyle, TextInputBuilder, TextInputStyle } = require('discord.js');
const { numberWithCommas } = require('../tools.js');
const { initializeUser, initializePlayer, manageTruguts } = require('../buttons/challenge/functions');
const { betEmbed, betComponents } = require('./trugut_functions.js')
module.exports = {
    name: 'truguts',
    async execute(client, interaction, args, database) {
        const member = interaction.member.id
        const name = interaction.member.displayName
        const avatar = await interaction.member.displayAvatarURL()
        let betref = database.ref('tourney/bets');
        let betdata = {}
        betref.on("value", function (snapshot) {
            betdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        let userref = database.ref('users');
        let userdata = {}
        userref.on("value", function (snapshot) {
            userdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });

        //find player in userbase
        let player = null
        Object.keys(userdata).forEach(key => {
            if (userdata[key].discordID && userdata[key].discordID == member) {
                player = key
                return
            }
        })
        if (!player) {
            player = initializeUser(userref, member, name)
        }
        let profile = userdata[player]?.random
        if (!profile) {
            profile = initializePlayer(userref.child(player).child('random'), name)
        }
        if (args[0] == "bet") {

            if (args[1] == 'new') {
                let bet = {
                    author: {
                        name,
                        avatar,
                        id: player,
                        discordId: member
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
                    max: interaction.options.getInteger('max_bet') ?? 100000
                }
                const betMessage = await interaction.reply({ embeds: [betEmbed(bet)], components: betComponents(bet), fetchReply: true })
                betref.child(betMessage.id).set(bet)
            } else if (args[1] == 'a' || args[1] == 'b') {
                let key = 'outcome_' + args[1]
                let bet = betdata[interaction.message.id]
                if ((bet.author.discordId == member || member == '256236315144749059') && bet.status == 'closed') {
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
                                    manageTruguts({ profile: userdata[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
                                    b.take = take
                                } else {
                                    manageTruguts({ profile: userdata[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
                                }
                            })
                        }
                    })
                    await betref.child(interaction.message.id).update(bet)
                    interaction.update({ embeds: [betEmbed(bet)], components: [] })
                    return
                }
                if (interaction.isModalSubmit()) {
                    let amount = interaction.fields.getTextInputValue('amount')
                    let current_bets = []
                    if (bet.outcome_a.bets) {
                        bet.outcome_a.bets.forEach(b => current_bets.push(b.discordId))
                    }
                    if (bet.outcome_b.bets) {
                        bet.outcome_b.bets.forEach(b => current_bets.push(b.discordId))
                    }
                    // if (bet.author.discordId == member) {
                    //     interaction.reply({ content: "You are the manager of this bet and cannot place a bet.", ephemeral: true })
                    //     return
                    // }
                    if (isNaN(Number(amount))) {
                        interaction.reply({ content: "The bet amount must be an integer.", ephemeral: true })
                        return
                    }
                    amount = Math.round(amount)
                    if (amount > profile.truguts_earned - profile.truguts_spent) {
                        interaction.reply({ content: "You do not have enough truguts to make this bet. (Current Truguts: `📀" + numberWithCommas(profile.truguts_earned - profile.truguts_spent) + "`)", ephemeral: true })
                        return
                    }
                    if (amount < bet.min || amount > bet.max) {
                        interaction.reply({ content: "The bet amount is outside the accepted range. (" + bet.min + " - " + bet.max + ")", ephemeral: true })
                        return
                    }

                    let already = bet.outcome_a?.bets?.map(b => b?.discordID).concat(bet.outcome_b?.bets?.map(b => b?.discordID)).flat()
                    let existing = bet[key].bets ? bet[key].bets.find(b => b?.discordID == member) : null
                    if (already.includes(member)) {
                        if (existing && amount - existing.amount < 0) {
                            interaction.reply({ content: "You can only increase an existing bet.", ephemeral: true })
                            return
                        } else {
                            interaction.reply({ content: "You cannot bet on both outcomes!", ephemeral: true })
                            return
                        }
                    }


                    let thisbet = {
                        amount,
                        name: interaction.member.displayName,
                        id: player,
                        discordId: interaction.member.id
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
                        .setLabel("Bet Amount (Available Truguts: 📀" + numberWithCommas(profile.truguts_earned - profile.truguts_spent) + ")")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                    const ActionRow1 = new ActionRowBuilder().addComponents(Amount)
                    submitModal.addComponents(ActionRow1)
                    await interaction.showModal(submitModal)
                }

            } else if (args[1] == 'close') {
                let bet = betdata[interaction.message.id]
                if (member !== bet.author.discordId && member !== '256236315144749059') {
                    interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                    return
                }
                bet.status = 'closed'
                betref.child(interaction.message.id).update(bet)
                interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
            } else if (args[1] == 'open') {
                let bet = betdata[interaction.message.id]
                if (member !== bet.author.discordId && member !== '256236315144749059') {
                    interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                    return
                }
                bet.status = 'open'
                betref.child(interaction.message.id).update(bet)
                interaction.update({ embeds: [betEmbed(bet)], components: betComponents(bet) })
            } else if (args[1] == 'delete') {
                let bet = betdata[interaction.message.id]
                if (member !== bet.author.discordId && member !== '256236315144749059') {
                    interaction.reply({ content: "You are not the author of this bet!", ephemeral: true })
                    return
                }
                betref.child(interaction.message.id).remove()
                interaction.update({ content: 'Bet was canceled by author.', embeds: [], components: [] })
            }
        }

    }

}
