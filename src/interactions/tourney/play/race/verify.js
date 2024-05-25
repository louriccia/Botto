const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUsername, getOpponent, raceEmbed, getWinner, matchSummaryEmbed, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../../functions.js')
const { manageTruguts } = require('../../../challenge/functions.js');
const { time_to_seconds, time_fix } = require('../../../../generic.js');
const { editMessage } = require('../../../../discord.js');
const { betEmbed, betComponents } = require('../../../trugut_functions.js')
const { database, db } = require('../../../../firebase.js');
const { WhyNobodyBuy } = require('../../../../data/discord/emoji.js');

exports.verify = async function ({ interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    let race = Number(args[1].replace("race", ""))
    let events = Object.values(match_rules.race)

    //not a commentator/tracker/tourney admin
    if (!Object.values(match_data.commentators).includes(member_id) && !(interaction.guild.id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(match_data.players).includes(member_id))) {
        interaction.reply({ content: `Only commentators/trackers can verify match times. ${WhyNobodyBuy}`, ephemeral: true })
        return
    }

    if (interaction.isModalSubmit()) {

        //already verified
        if (match_data.races[race].live === false) {
            interaction.reply({ content: `This race is already verified. ${WhyNobodyBuy}`, ephemeral: true })
            return
        }

        //update data with provided values
        Object.keys(match_data.races[race].runs).map(key => {
            match_ref.child("races").child(race).child("runs").child(key).update(
                {
                    time: (interaction.fields.getTextInputValue('time' + key).toLowerCase() == 'dnf' ? 'DNF' : time_to_seconds(interaction.fields.getTextInputValue('time' + key))),
                    deaths: (interaction.fields.getTextInputValue('deaths' + key) == "" ? "" : Number(interaction.fields.getTextInputValue('deaths' + key)))
                }
            )
        })

        //mark race as no longer live
        match_ref.child("races").child(race).child("live").set(false)

        match_data = db.ty.live[interaction.channelId]
        await interaction.update({
            content: "",
            embeds: [raceEmbed({ race, interaction })],
            components: []
        })
        interaction.followUp({ embeds: [matchSummaryEmbed({ interaction })] })

        //check win condition
        let scoreboard = {}
        let winner = null
        Object.keys(match_data.races).forEach(race => {
            winner = getWinner({ race, interaction })
            if (winner) {
                if ([null, undefined, ""].includes(scoreboard[winner])) {
                    scoreboard[winner] = 1
                } else {
                    scoreboard[winner]++
                }
            }
        })
        let wincondition = Object.values(scoreboard).includes(match_rules.general.winlimit)

        if (wincondition) {
            //win condition
            const postRef = await database.ref('tourney/matches').push(match_data)
            const winEmbed = new EmbedBuilder()
                .setAuthor({ name: "Match Concluded" })
                .setTitle(getUsername({ member: winner, db, short: true }) + " Wins!")
                .setDescription("GGs, racers! The match has been saved.\nCheck out the full match summary [here](https://botto-efbfd.web.app/tournaments/matches/" + postRef.key + ")\n<@&970995237952569404> role will be automatically removed in 15 minutes")
                .addFields({ name: ":microphone2: Commentators/Trackers", value: ":orange_circle: Don't forget to click 'Episode Finished' after the interviews" })
            interaction.followUp({ embeds: [winEmbed] })

            //handle bet TODO: use function
            // if (match_data?.bet) {
            //     let bet = betdata[match_data.bet]
            //     bet.status = 'complete'
            //     let outcomes = ['a', 'b']
            //     outcomes.forEach(a => {
            //         bet[`outcome_${a}`].winner = (bet[`outcome_${a}`].id == player)
            //     })
            //     //handle truguts
            //     let totals = {
            //         a: bet.outcome_a.bets ? bet.outcome_a.bets.map(b => b.amount).reduce((a, b) => a + b) : 0,
            //         b: bet.outcome_b.bets ? bet.outcome_b.bets.map(b => b.amount).reduce((a, b) => a + b) : 0
            //     }
            //     outcomes.forEach(x => {
            //         let outcome = bet['outcome_' + x]
            //         let opposite = x == 'a' ? 'b' : 'a'
            //         if (outcome.bets) {
            //             outcome.bets.forEach(b => {
            //                 if (outcome.winner) {
            //                     let take = Math.round((b.amount / totals[x]) * totals[opposite])
            //                     manageTruguts({ profile: db.user[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
            //                     b.take = take
            //                 } else {
            //                     manageTruguts({ profile: db.user[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
            //                 }
            //             })
            //         }
            //     })

            //     database.ref('tourney/bets').child(match.bet).update(bet)
            //     editMessage(client, '536455290091077652', match.bet, { embeds: [betEmbed(bet)], components: betComponents(bet) })
            // }

            //remove roles
            let everybody = Object.values(match_data.players).concat(Object.values(match_data.commentators))
            if (interaction.guild.id == '441839750555369474') {
                setTimeout(async function () {
                    everybody.forEach(async function (p) {
                        const thisMember = await interaction.guild.members.fetch(p)
                        if (thisMember && thisMember.roles.cache.some(r => r.id == '970995237952569404')) {
                            thisMember.roles.remove('970995237952569404').catch(console.error)
                        }
                    })
                }, 15 * 60 * 1000)
            }

            //delete live match ref
            match_ref.remove()
            return
        }

        let nextrace = match_data.current_race + 1
        match_ref.child("current_race").set(nextrace)
        let race_object = {
            ready: {},
            reveal: {},
            runs: {},
            live: false,
            events: "",
            eventstart: 0,
            eventend: 0
        }
        Object.values(match_data.players).map(player => {
            race_object.ready[player] = false
            race_object.reveal[player] = false
            race_object.runs[player] = {
                deaths: "",
                notes: "",
                platform: "pc",
                player: "",
                pod: "",
                time: ""
            }
        })
        await match_ref.child('races').child(nextrace).update(race_object)
        await match_ref.child("status").set("events")
        match_data = db.ty.live[interaction.channelId]

        //start permabans
        if (race == 0 && Object.values(match_rules.match.permabans).length > 0) {
            setTimeout(async function () {
                interaction.followUp({
                    content: "<@" + (match_rules.match.permabans[0].choice == "firstloser" ? getOpponent({ interaction, player: getWinner({ race: 0, interaction }) }) : getWinner({ race: 0, interaction })) + "> please select a permanent ban",
                    embeds: [permabanEmbed({ interaction })],
                    components: permabanComponents({ permaban: 0, interaction })
                })
            }, 3 * 1000)

        } else { //restart event loop for next race
            setTimeout(async function () {
                interaction.followUp({
                    content: "<@" + (events[0].choice == "lastwinner" ? getWinner({ race, interaction }) : getOpponent({ interaction, player: getWinner({ race, interaction }) })) + "> please make a selection",
                    embeds: [raceEventEmbed({ race: nextrace, interaction })],
                    components: raceEventComponents({ race: nextrace, interaction })
                })
            }, 3 * 1000)
        }

        return
    }


    const verifyModal = new ModalBuilder()
        .setCustomId("tourney_play_race" + race + "_verify")
        .setTitle("Verify Race " + (race + 1) + " Results")
    Object.keys(match_data.races[race].runs).map(key => {
        let time = new TextInputBuilder()
            .setCustomId("time" + key)
            .setLabel(("⏱️ " + getUsername({ member: key, db, short: true }) + "'s Time").substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("--:--.---")
            .setMinLength(1)
            .setMaxLength(10)
            .setRequired(true)
            .setValue(String((match_data.races[race].runs[key].time.toLowerCase() == "dnf" ? "DNF" : time_fix(match_data.races[race].runs[key].time))))
        let deaths = new TextInputBuilder()
            .setCustomId("deaths" + key)
            .setLabel(("💀 " + getUsername({ member: key, db, short: true }) + "'s Deaths").substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setMinLength(0)
            .setMaxLength(10)
            .setRequired(false)
        if (![null, undefined, ''].includes(match_data.races[race].runs[key].deaths)) {
            deaths.setValue(String(match_data.races[race].runs[key].deaths))
        }

        let TimeRow = new ActionRowBuilder().addComponents(time)
        let DeathRow = new ActionRowBuilder().addComponents(deaths)
        verifyModal.addComponents(TimeRow, DeathRow)
    })
    await interaction.showModal(verifyModal)

}