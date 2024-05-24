const { getOpponent, raceEmbed, raceComponents, countDown, getWinner, raceEventEmbed, raceEventComponents } = require('../../functions.js')
const { database, db } = require('../../../../firebase.js')
const { WhyNobodyBuy } = require('../../../../data/discord/emoji.js')

exports.event = async function ({ client, interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]

    const race = match_data.current_race
    const event_start = match_data.races[race].eventstart
    const event_end = match_data.races[race].eventend

    const events = Object.values(match_rules.race)
    const event = event_start
    let e = events[event_start]
    let responded = false

    const last_winner = getWinner({ race: race - 1, interaction })
    const last_loser = getOpponent({ interaction, player: last_winner })

    if (member_id !== (e.choice == "lastwinner" ? last_winner : last_loser)) {
        interaction.reply({ content: `It's not your turn! ${WhyNobodyBuy}`, ephemeral: true })
        return
    }

    await match_ref.child("status").set("events")

    //collect values from components

    if (args[3] !== "submit") {
        match_data = db.ty.live[interaction.channelId]
        interaction.update({
            content: `<@${(events[event].choice == "lastwinner" ? last_winner : last_loser)}> please make a selection` + (event_end + 1 == events.length ? "\n*Once this selection is submitted, the warmup timer begins (2.5 minutes, 3.5 minutes for skips)*" : ""),
            embeds: [raceEventEmbed({ race, interaction })],
            components: raceEventComponents({ race, interaction })
        })
        return
    }

    //get new events from components
    let newevents = []
    interaction.message.components.filter(component => component.components[0].data.type == 3).forEach((component, i) => {
        let e = events[event_start + i]
        let options = component.components[0].data.options.filter(option => option.default)

        if (!e.count) {
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
                interaction.reply({ content: `This track cannot be selected. ${WhyNobodyBuy}`, ephemeral: true })
                newevents = []
                responded = true
                return
            }
            newevents.push(new_event)
        }
    })

    //update data
    newevents.forEach(async event => {
        await match_ref.child("races").child(race).child('events').push(event)
    })

    if (responded) {
        return
    }



    //continue event loop
    if (event_end + 1 < events.length) {

        //calculate new event start and end
        let streak = 0
        let choice = events[event_end + 1].choice
        for (i = event + 2; i < events.length; i++) {
            if (events[i].choice == choice && streak < 4) {
                streak++
            }
        }

        await match_ref.child("races").child(race).update({ eventstart: event_end + 1, eventend: event_end + 1 + streak })
        match_data = db.ty.live[interaction.channelId]
        interaction.update({
            content: `<@${(events[event_end + 1].choice == "lastwinner" ? last_winner : last_loser)}> please make a selection`,
            embeds: [raceEventEmbed({ race, interaction })],
            components: raceEventComponents({ race, interaction })
        })
        return
    }

    //set countdown
    let countdown = 2.5 * 60 * 1000 + (Object.values(match_data.races[race].events).map(e => e.selection).includes('sk') ? 1000 * 60 : 0)
    await match_ref.child('races').child(race).child('countdown').set(Math.round((Date.now() + countdown) / 1000))
    match_data = db.ty.live[interaction.channelId]

    await interaction.update({ content: "", embeds: [raceEventEmbed({ race, interaction })], components: [] })

    //initiate countdown
    const rE = await interaction.followUp({
        content: `${Object.values(match_data.players).map(player => `<@${player}>`).join(" ")} Countdown begins <t:${match_data.races[race].countdown}:R>`,
        embeds: [raceEmbed({ race, interaction })],
        components: raceComponents({ race, interaction }),
        fetchReply: true
    })
    await match_ref.child("status").set("prerace")

    //set current race if not set
    if (!match_data.current_race) {
        await match_ref.child('current_race').set(0)
    }

    //override ready for autocoundown
    Object.values(match_data.players).forEach(async player => {
        await match_ref.child('races').child(race).child('ready').child(player).set(true)
    })

    match_data = db.ty.live[interaction.channelId]

    //autocountdown
    setTimeout(async function () {
        if (match_data.races[race].countdown) {
            interaction.followUp({ content: `Countdown starts <t:${match_data.races[race].countdown}:R>!` })
        }
    }, countdown - 30 * 1000)
    setTimeout(async function () {
        if (match_data.races[race].countdown) {
            interaction.client.channels.cache.get(interaction.channel.id).messages.fetch(rE.id).then(message => message.delete())
            let cD = await interaction.followUp({
                content: Object.values(match_data.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>",
                embeds: [],
                components: [],
                fetchReply: true
            })
            setTimeout(async function () {

                interaction.client.channels.cache.get(interaction.channel.id).messages.fetch(cD.id).then(message => message.delete())
            }, 10000)
            await match_ref.child("status").set("midrace")
            countDown(interaction)
            //initiate race
            await match_ref.child("races").child(race).child("live").set(true)
            await match_ref.child("races").child(race).child("countdown").remove()
            match_data.races[race].live = true
            setTimeout(async function () {
                interaction.followUp({ embeds: [raceEmbed({ race, interaction })], components: raceComponents({ race, interaction }) })
            }, 10000)
        }
    }, countdown)

}