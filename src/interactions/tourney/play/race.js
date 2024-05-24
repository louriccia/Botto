const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUsername, getOpponent, raceEmbed, raceComponents, countDown, getWinner, matchSummaryEmbed, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../functions.js')
const { manageTruguts } = require('../../challenge/functions.js');
const { time_to_seconds, time_fix } = require('../../../generic.js');
const { editMessage } = require('../../../discord.js');
const { betEmbed, betComponents } = require('../../trugut_functions.js')

exports.race = async function ({ client, interaction, args, database, db, member_id, livematch, liverules, livematchref } = {}) {
    const match_data = db.ty.live[interaction.channelId]

    const userref = database.ref('users')

    let race = Number(args[1].replace("race", ""))
    let event = Number(args[2].replace("event", ""))
    let events = Object.values(liverules.race)
    let e = events[event]
    let eventstart = livematch.races[race].eventstart
    let eventend = livematch.races[race].eventend
    let responded = false
    if (args[2].includes("event")) {
        if (member_id == (e.choice == "lastwinner" ? getWinner({ race: race - 1, livematch }) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) }))) {
            await livematchref.child("status").set("events")
            if (interaction.message.components.length > 1) {
                if (args[3] == "submit") {
                    let newevents = []
                    interaction.message.components.forEach(component => {
                        if (component.components[0].data.type == 3) {
                            let thisargs = component.components[0].data.custom_id.split("_")
                            let thisevent = Number(thisargs[3].replace("event", ""))
                            let e = liverules.race[thisevent]
                            let options = component.components[0].data.options.filter(option => option.default)
                            if ([null, undefined, ""].includes(e.count)) {
                                e.count = 1
                            }
                            let loops = options.length //this value needs to be stored in a variable otherwise you'll be a dumbass and have the loop be cut short as the array shrinks
                            for (let i = 0; i < loops / e.count; i++) {
                                let option = options.slice(0, e.count)
                                options = options.slice(e.count)
                                if (option.length == 1) {
                                    option = option[0].value
                                } else {
                                    option = option.map(o => o.value)
                                }
                                let new_event = {
                                    event: e.event,
                                    type: e.type,
                                    player: member_id,
                                    selection: option,
                                }
                                if (![null, undefined, ""].includes(e.cost)) {
                                    new_event.cost = e.cost
                                }
                                if (option.includes("repeat")) {
                                    new_event.selection = option.replace("repeat", "")
                                    new_event.repeat = true
                                }
                                if (option.includes("ban")) {
                                    interaction.reply({ content: "This track cannot be selected. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                                    newevents = []
                                    responded = true
                                    return
                                }
                                newevents.push(new_event)
                            }
                        }
                    })
                    newevents.forEach(async event => {
                        await livematchref.child("races").child(race).child('events').push(event)
                    })

                } else {
                    livematch = db.ty.live[interaction.channelId]
                    interaction.update({
                        content: "<@" + (events[event].choice == "lastwinner" ? getWinner({ race: race - 1, livematch }) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) })) + "> please make a selection" + (eventend + 1 == events.length ? "\n*Once this selection is submitted, the warmup timer begins (2.5 minutes, 3.5 minutes for skips)*" : ""),
                        embeds: [raceEventEmbed({ race, livematch, liverules })],
                        components: raceEventComponents({ race, livematch, interaction, liverules })
                    })
                    return
                }
            } else {
                interaction.values.forEach(async selection => {
                    let new_event = {
                        event: e.event,
                        type: e.type,
                        player: member_id,
                        selection: selection,
                    }
                    if (![null, undefined, ""].includes(e.cost)) {
                        new_event.cost = e.cost
                    }
                    if (selection.includes("repeat")) {
                        new_event.selection = selection.replace("repeat", "")
                        new_event.repeat = true
                    }
                    if (selection.includes("ban")) {
                        interaction.reply({ content: "This track cannot be selected. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                        responded = true
                        return
                    }
                    await livematchref.child("races").child(race).child("events").push(new_event)
                })
            }

            //save result
            if (!responded) {
                let streak = 0
                let choice = events[event + 1].choice
                for (i = event + 2; i < events.length; i++) {
                    if (events[i].choice == choice && streak < 4) {
                        streak++
                    }
                }
                if (eventend + 1 == events.length) {
                    let countdown = 2.5 * 60 * 1000 + (Object.values(livematch.races[race].events).map(e => e.selection).includes('sk') ? 1000 * 60 : 0)
                    await livematchref.child('races').child(race).child('countdown').set(Math.round((Date.now() + countdown) / 1000))
                    livematch = db.ty.live[interaction.channelId]
                    await interaction.update({ content: "", embeds: [raceEventEmbed({ race, livematch, liverules })], components: [] })
                    const rE = await interaction.followUp({
                        content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " Countdown begins <t:" + livematch.races[race].countdown + ":R>",
                        embeds: [raceEmbed({ race, livematch, liverules, db })],
                        components: raceComponents({ race, liverules, livematch }),
                        fetchReply: true
                    })
                    await livematchref.child("status").set("prerace")
                    if (!livematch.current_race) {
                        await livematchref.child('current_race').set(0)
                    }
                    Object.values(livematch.players).forEach(async player => {
                        await livematchref.child('races').child(race).child('ready').child(player).set(true)
                    })

                    livematch = db.ty.live[interaction.channelId]


                    //autocountdown
                    setTimeout(async function () {
                        if (livematch.races[race].countdown) {
                            interaction.followUp({ content: "Countdown starts <t:" + livematch.races[race].countdown + ":R>!" })
                        }
                    }, countdown - 30 * 1000)
                    setTimeout(async function () {
                        if (livematch.races[race].countdown) {
                            interaction.client.channels.cache.get(interaction.channel.id).messages.fetch(rE.id).then(message => message.delete())
                            let cD = await interaction.followUp({
                                content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>",
                                embeds: [],
                                components: [],
                                fetchReply: true
                            })
                            setTimeout(async function () {

                                interaction.client.channels.cache.get(interaction.channel.id).messages.fetch(cD.id).then(message => message.delete())
                            }, 10000)
                            await livematchref.child("status").set("midrace")
                            countDown(interaction)
                            //initiate race
                            await livematchref.child("races").child(race).child("live").set(true)
                            await livematchref.child("races").child(race).child("countdown").remove()
                            livematch.races[race].live = true
                            setTimeout(async function () {
                                interaction.followUp({ embeds: [raceEmbed({ race, livematch, liverules, db })], components: raceComponents({ race, liverules, livematch }) })
                            }, 10000)
                        }
                    }, countdown)
                } else {
                    await livematchref.child("races").child(race).update({ eventstart: eventend + 1, eventend: eventend + 1 + streak })
                    livematch = db.ty.live[interaction.channelId]
                    interaction.update({
                        content: "<@" + (events[event + 1].choice == "lastwinner" ? getWinner({ race: race - 1, livematch }) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) })) + "> please make a selection",
                        embeds: [raceEventEmbed({ race, livematch, liverules })],
                        components: raceEventComponents({ race, livematch, interaction, liverules })
                    })
                }
            }

        } else {
            interaction.reply({ content: "It's not your turn! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        }

    } else if (args[2] == 'abort') {
        if (!Object.values(livematch.players).includes(member_id) && !Object.values(livematch.commentators).includes(member_id)) {
            interaction.reply({ content: "You are not a player or commentator!", ephemeral: true })
            return
        }
        Object.values(livematch.players).forEach(player => {
            livematchref.child('races').child(race).child('ready').child(player).set(false)
        })
        await livematchref.child('races').child(race).child('countdown').remove()
        livematch = db.ty.live[interaction.channelId]
        await interaction.update({
            content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
            embeds: [raceEmbed({ race, livematch, liverules, db })],
            components: raceComponents({ race, liverules, livematch })
        })
        interaction.followUp({ content: '<@' + member_id + '> aborted the countdown. Once both players click READY, the countdown will begin.' })
    } else if (["ready", "unready"].includes(args[2])) {
        if (Object.values(livematch.players).includes(member_id) && ![undefined, null, ""].includes(livematch.races[race].runs) && ![undefined, null, ""].includes(livematch.races[race].runs[member_id]) && ![undefined, null, ""].includes(livematch.races[race].runs[member_id].pod)) {
            livematchref.child("races").child(race).child("ready").child(member_id).set((args[2] == "ready" ? true : false))
            if (Object.values(livematch.races[race].ready).filter(r => r == false).length == 0) {
                livematch = db.ty.live[interaction.channelId]
                await interaction.update({
                    content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>",
                    embeds: [],
                    components: []
                })
                setTimeout(async function () {
                    interaction.client.channels.cache.get(interaction.channel.id).messages.fetch(interaction.message.id).then(message => message.delete())
                }, 10000)
                livematchref.child("status").set("midrace")
                countDown(interaction)
                //initiate race
                livematchref.child("races").child(race).child("live").set(true)
                setTimeout(async function () {
                    interaction.followUp({ embeds: [raceEmbed({ race, livematch, liverules, db })], components: raceComponents({ race, liverules, livematch }) })
                }, 10000)
            } else {
                livematch = db.ty.live[interaction.channelId]
                await interaction.update({
                    content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                    embeds: [raceEmbed({ race, livematch, liverules, db })],
                    components: raceComponents({ race, liverules, livematch })
                })
            }
        } else if (Object.values(livematch.players).includes(member_id)) {
            interaction.reply({ content: "You have not selected a racer yet! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            return
        } else {
            interaction.reply({ content: "You are not a player!", ephemeral: true })
            return
        }

    } else if (args[2] == 'gents') {
        if (!Object.values(livematch.players).includes(member_id)) {
            interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            return
        }

        if (interaction.isModalSubmit()) {
            let terms = interaction.fields.getTextInputValue('gents').trim()
            livematchref.child('races').child(race).child('gents').set({ terms: terms, player: member_id, agreed: "?" })
            livematch = db.ty.live[interaction.channelId]
            interaction.update({
                content: "<@" + getOpponent({ livematch, player: member_id }) + "> do you accept the terms of the proposed 🎩 **Gentlemen's Agreement**?\n*" + terms + "*",
                embeds: [raceEmbed({ race, livematch, liverules, db })],
                components: raceComponents({ race, liverules, livematch })
            })
        } else {
            if (args.length == 3) {
                const gentlemensModal = new ModalBuilder()
                    .setCustomId("tourney_play_race" + race + "_gents")
                    .setTitle("Make a Gentleman's Agreement")
                const Terms = new TextInputBuilder()
                    .setCustomId("gents")
                    .setLabel("Agreement Terms")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
                const ActionRow1 = new ActionRowBuilder().addComponents(Terms)
                gentlemensModal.addComponents(ActionRow1)
                await interaction.showModal(gentlemensModal)
            } else {
                if (member_id == getOpponent({ livematch, player: livematch.races[race].gents?.player })) {
                    if (args[3] == 'true') {
                        livematchref.child('races').child(race).child('gents').update({ agreed: true })
                    } else {
                        livematchref.child('races').child(race).child('gents').remove()
                    }
                    livematch = db.ty.live[interaction.channelId]
                    interaction.update({
                        content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                        embeds: [raceEmbed({ race, livematch, liverules, db })],
                        components: raceComponents({ race, liverules, livematch })
                    })
                } else {
                    interaction.reply({ content: "Not you! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                }
            }
        }
    } else if (args[2] == "racer") {
        if (Object.values(livematch.players).includes(member_id)) {
            livematchref.child("races").child(race).child("runs").child(member_id).child("pod").set(interaction.values[0])
        }
        livematch = db.ty.live[interaction.channelId]
        interaction.update({
            content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
            embeds: [raceEmbed({ race, livematch, liverules, db })],
            components: raceComponents({ race, liverules, livematch })
        })
    } else if (args[2] == "reveal") {
        if (Object.values(livematch.players).includes(member_id)) {
            livematchref.child("races").child(race).child("reveal").child(member_id).set(true)
        }
        livematch = db.ty.live[interaction.channelId]
        interaction.update({
            content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
            embeds: [raceEmbed({ race, livematch, liverules, db })],
            components: raceComponents({ race, liverules, livematch })
        })
    } else if (args[2] == "submit") {
        if (!Object.values(livematch.players).includes(member_id)) {
            interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            return
        }
        if (interaction.isModalSubmit()) {
            if (!livematch.races[race].live) {
                interaction.reply({ content: "Race is no longer live. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            }
            let submittime = interaction.fields.getTextInputValue('time')
            if (submittime.toLowerCase() !== 'dnf' && (isNaN(Number(submittime.replace(":", ""))) || time_to_seconds(submittime) == null)) { //time doesn't make sense
                const holdUp = new EmbedBuilder()
                    .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
                    .setDescription("Your time was submitted in an incorrect format.")
                interaction.reply({ embeds: [holdUp], ephemeral: true })
                return
            }
            livematchref.child("races").child(race).child("runs").child(member_id).update(
                {
                    time: (interaction.fields.getTextInputValue('time').toLowerCase() == 'dnf' ? 'DNF' : time_to_seconds(interaction.fields.getTextInputValue('time')) == null ? "DNF" : time_to_seconds(interaction.fields.getTextInputValue('time').trim())),
                    deaths: isNaN(Number(interaction.fields.getTextInputValue('deaths'))) ? '' : Number(interaction.fields.getTextInputValue('deaths')),
                    notes: interaction.fields.getTextInputValue('notes').trim(),
                    player: member_id
                }
            )
            livematch = db.ty.live[interaction.channelId]
            interaction.update({
                content: Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0 ? Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" ") : "",
                embeds: [raceEmbed({ race, livematch, liverules, db })],
                components: raceComponents({ race, liverules, livematch })
            })
        } else {
            const submitModal = new ModalBuilder()
                .setCustomId("tourney_play_race" + race + "_submit")
                .setTitle("Submit Race " + (race + 1) + " Results")
            const Time = new TextInputBuilder()
                .setCustomId("time")
                .setLabel("⏱️ Time (write 'dnf' if forfeited)")
                .setStyle(TextInputStyle.Short)
                .setMinLength(0)
                .setMaxLength(10)
                .setRequired(true)
                .setValue((String(livematch.races[race].runs[member_id]?.time).toLowerCase() == 'dnf' ? 'DNF' : (livematch.races[race].runs[member_id].time == "" ? "" : String(time_fix(livematch.races[race].runs[member_id].time)))))
            const Deaths = new TextInputBuilder()
                .setCustomId("deaths")
                .setLabel("💀 Deaths (leave blank if unsure)")
                .setStyle(TextInputStyle.Short)
                .setMinLength(0)
                .setMaxLength(2)
                .setRequired(false)
                .setValue(String(livematch.races[race].runs[member_id].deaths))
            const Notes = new TextInputBuilder()
                .setCustomId("notes")
                .setLabel("📝 Notes")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(false)
                .setValue(String(livematch.races[race].runs[member_id].notes))
            const ActionRow1 = new ActionRowBuilder().addComponents(Time)
            const ActionRow2 = new ActionRowBuilder().addComponents(Deaths)
            const ActionRow3 = new ActionRowBuilder().addComponents(Notes)
            submitModal.addComponents(ActionRow1, ActionRow2, ActionRow3)
            await interaction.showModal(submitModal)
        }
    } else if (args[2] == "verify") {
        if (interaction.isModalSubmit()) {
            if (livematch.races[race].live === false) {

                interaction.reply({ content: "This race has already been verified. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            }
            Object.keys(livematch.races[race].runs).map(key => {
                livematchref.child("races").child(race).child("runs").child(key).update(
                    {
                        time: (interaction.fields.getTextInputValue('time' + key).toLowerCase() == 'dnf' ? 'DNF' : time_to_seconds(interaction.fields.getTextInputValue('time' + key))),
                        deaths: (interaction.fields.getTextInputValue('deaths' + key) == "" ? "" : Number(interaction.fields.getTextInputValue('deaths' + key)))
                    }
                )
            })

            livematchref.child("races").child(race).child("live").set(false)
            livematch = db.ty.live[interaction.channelId]
            await interaction.update({
                content: "",
                embeds: [raceEmbed({ race, livematch, liverules, db })],
                components: []
            })
            interaction.followUp({ embeds: [matchSummaryEmbed({ liverules, livematch, db })] })

            //check win condition
            let scoreboard = {}
            Object.keys(livematch.races).forEach(race => {
                let winner = getWinner({ race, livematch })
                if (winner) {
                    if ([null, undefined, ""].includes(scoreboard[winner])) {
                        scoreboard[winner] = 1
                    } else {
                        scoreboard[winner]++
                    }
                }
            })
            let wincondition = Object.values(scoreboard).includes(liverules.general.winlimit)

            if (wincondition) {
                //win condition
                const postRef = await database.ref('tourney/matches').push(livematch)
                const winEmbed = new EmbedBuilder()
                    .setAuthor({ name: "Match Concluded" })
                    .setTitle(getUsername({ member: player, db, short: true }) + " Wins!")
                    .setDescription("GGs, racers! The match has been saved.\nCheck out the full match summary [here](https://botto-efbfd.web.app/tournaments/matches/" + postRef.key + ")\n<@&970995237952569404> role will be automatically removed in 15 minutes")
                    .addFields({ name: ":microphone2: Commentators/Trackers", value: ":orange_circle: Don't forget to click 'Episode Finished' after the interviews" })
                interaction.followUp({ embeds: [winEmbed] })

                //handle bet
                if (livematch?.bet) {
                    let bet = betdata[livematch.bet]
                    bet.status = 'complete'
                    let outcomes = ['a', 'b']
                    outcomes.forEach(a => {
                        bet[`outcome_${a}`].winner = (bet[`outcome_${a}`].id == player)
                    })
                    //handle truguts
                    let totals = {
                        a: bet.outcome_a.bets ? bet.outcome_a.bets.map(b => b.amount).reduce((a, b) => a + b) : 0,
                        b: bet.outcome_b.bets ? bet.outcome_b.bets.map(b => b.amount).reduce((a, b) => a + b) : 0
                    }
                    outcomes.forEach(x => {
                        let outcome = bet['outcome_' + x]
                        let opposite = x == 'a' ? 'b' : 'a'
                        if (outcome.bets) {
                            outcome.bets.forEach(b => {
                                if (outcome.winner) {
                                    let take = Math.round((b.amount / totals[x]) * totals[opposite])
                                    manageTruguts({ profile: db.user[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
                                    b.take = take
                                } else {
                                    manageTruguts({ profile: db.user[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
                                }
                            })
                        }
                    })

                    database.ref('tourney/bets').child(match.bet).update(bet)
                    editMessage(client, '536455290091077652', match.bet, { embeds: [betEmbed(bet)], components: betComponents(bet) })
                }

                //remove roles
                let everybody = Object.values(livematch.players).concat(Object.values(livematch.commentators))
                if (interaction.guild.id == '441839750555369474') {
                    setTimeout(async function () {
                        everybody.forEach(async function (p) {
                            const thisMember = await Guild.members.fetch(p)
                            if (thisMember && thisMember.roles.cache.some(r => r.id == '970995237952569404')) {
                                thisMember.roles.remove('970995237952569404').catch(console.error)
                            }
                        })
                    }, 15 * 60 * 1000)
                }
                livematchref.remove()
                return
            } else {
                let nextrace = livematch.current_race + 1
                livematchref.child("current_race").set(nextrace)
                let race_object = {
                    ready: {},
                    reveal: {},
                    runs: {},
                    live: false,
                    events: "",
                    eventstart: 0,
                    eventend: 0
                }
                Object.values(livematch.players).map(player => {
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
                await livematchref.child('races').child(nextrace).update(race_object)
                await livematchref.child("status").set("events")
                livematch = db.ty.live[interaction.channelId]

                //start permabans
                if (race == 0 && Object.values(liverules.match.permabans).length > 0) {
                    setTimeout(async function () {
                        interaction.followUp({
                            content: "<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }) : getWinner({ race: 0, livematch })) + "> please select a permanent ban",
                            embeds: [permabanEmbed({ livematch })],
                            components: permabanComponents({ permaban: 0, livematch, liverules })
                        })
                    }, 3 * 1000)

                } else { //restart event loop for next race
                    setTimeout(async function () {
                        interaction.followUp({
                            content: "<@" + (events[0].choice == "lastwinner" ? getWinner({ race, livematch }) : getOpponent({ livematch, player: getWinner({ race, livematch }) })) + "> please make a selection",
                            embeds: [raceEventEmbed({ race: nextrace, livematch, liverules })],
                            components: raceEventComponents({ race: nextrace, livematch, interaction, liverules })
                        })
                    }, 3 * 1000)
                }
            }


        } else {
            if (Object.values(livematch.commentators).includes(member_id) || (interaction.guild.id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(livematch.players).includes(member_id))) {
                const verifyModal = new ModalBuilder()
                    .setCustomId("tourney_play_race" + race + "_verify")
                    .setTitle("Verify Race " + (race + 1) + " Results")
                Object.keys(livematch.races[race].runs).map(key => {
                    let time = new TextInputBuilder()
                        .setCustomId("time" + key)
                        .setLabel(("⏱️ " + getUsername({ member: key, db, short: true }) + "'s Time").substring(0, 45))
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("--:--.---")
                        .setMinLength(1)
                        .setMaxLength(10)
                        .setRequired(true)
                        .setValue(String((livematch.races[race].runs[key].time.toLowerCase() == "dnf" ? "DNF" : time_fix(livematch.races[race].runs[key].time))))
                    let deaths = new TextInputBuilder()
                        .setCustomId("deaths" + key)
                        .setLabel(("💀 " + getUsername({ member: key, db, short: true }) + "'s Deaths").substring(0, 45))
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(0)
                        .setMaxLength(10)
                        .setRequired(false)
                    if (![null, undefined, ''].includes(livematch.races[race].runs[key].deaths)) {
                        deaths.setValue(String(livematch.races[race].runs[key].deaths))
                    }

                    let TimeRow = new ActionRowBuilder().addComponents(time)
                    let DeathRow = new ActionRowBuilder().addComponents(deaths)
                    verifyModal.addComponents(TimeRow, DeathRow)
                })
                await interaction.showModal(verifyModal)
            } else {
                interaction.reply({ content: "Only commentators/trackers can verify match times. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            }
        }
    } else if (args[2] == "restart") {
        if (!Object.values(livematch.commentators).includes(member_id)) {
            interaction.reply({ content: "Only commentators/trackers can restart a race. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            return
        }
        livematchref.child("races").child(race).child("live").set(false)
        Object.keys(livematch.races[race].ready).map(key => {
            livematchref.child("races").child(race).child("ready").child(key).set(false)
        })
        livematch = db.ty.live[interaction.channelId]
        interaction.update({
            content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
            embeds: [raceEmbed({ race, livematch, liverules, db, db })],
            components: raceComponents({ race, liverules, livematch })
        })
    }
}