const { firstEmbed, firstComponents, getOpponent, raceEmbed, raceComponents, getWinner, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('./functions.js')
const { database, db } = require('../../firebase.js')


exports.admin = async function ({ interaction, member_id, database } = {}) {

    const match_data = db.ty.live[interaction.channelId]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]


    let status = interaction.values[0]

    const admin_perms = member_id == "256236315144749059" ||
        (match_data.commentators && !Object.values(match_data.commentators).includes(member_id)) ||
        (interaction.guild.id == '441839750555369474' && !(interaction.member.roles.cache.some(r => r.id == '862810190072381471')))

    if (!admin_perms) {
        interaction.reply({ content: "Only trackers/tourney staff have permission to use this. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        return
    }


    //delete last bot message
    let race = match_data.current_race
    interaction.client.channels.cache.get(interaction.channel.id).messages.fetch({ limit: 20 }).then(messages => {
        let lastMessage = messages.filter(m => m.author.bot && m.id !== interaction.message.id).first();
        if (lastMessage) {
            lastMessage.delete().catch(err => console.log(err));
        }
    })

    switch (status) {
        case 'first':
            match_ref.update({
                races: "",
                firstbans: "",
                firstvote: "",
                eventstart: 0,
                eventend: 0,
                runs: "",
                firstcolors: ""
            })

            interaction.reply({
                content: Object.values(match_data.players).map(player => "<@" + player + ">").join(", "),
                embeds: [firstEmbed({ interaction })],
                components: firstComponents({ interaction })
            })

            match_ref.child("status").set("first")
            break
        case 'permaban':
            match_ref.child('races').child('1').update({
                events: "",
                eventstart: 0,
                eventend: 0,
                live: false
            })

            Object.values(match_data.players).map(async player => {
                match_ref.child('races').child(match_data.current_race).child('ready').child(player).set(false)
                match_ref.child('races').child(match_data.current_race).child('reveal').child(player).set(false)
                match_ref.child('races').child(match_data.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })

            interaction.reply({
                content: "<@" + (match_rules.match.permabans[0].choice == "firstloser" ? getOpponent({ interaction, player: getWinner({ race: 0, interaction }) }) : getWinner({ race: 0, interaction })) + "> please select a permanent ban",
                embed: [permabanEmbed({ interaction })],
                components: permabanComponents({ permaban: 0, interaction })
            })

            break
        case 'prevrace':
            let current_race = match_data.current_race
            match_ref.child('races').child(match_data.current_race).remove()
            match_ref.child('current_race').set(current_race - 1)
            match_ref.child('races').child(current_race - 1).child('live').set(true)

            interaction.reply(
                {
                    content: Object.values(match_data.players).filter(player => !match_data.races[current_race - 1]?.ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(match_data.commentators).map(comm => "<@" + comm + ">").join(" "),
                    embeds: [raceEmbed({ race: current_race - 1, interaction })],
                    components: raceComponents({ race: current_race - 1, interaction })
                })
            break
        case 'events':
            let events = Object.values(match_rules.race)
            match_ref.child('races').child(match_data.current_race).update({
                events: "",
                eventstart: 0,
                eventend: 0,
                live: false
            })

            Object.values(match_data.players).map(player => {
                match_ref.child('races').child(match_data.current_race).child('ready').child(player).set(false)
                match_ref.child('races').child(match_data.current_race).child('reveal').child(player).set(false)
                match_ref.child('races').child(match_data.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })
            if (match_data.current_race == 1 && Object.values(match_rules.match.permabans).length > 0) {
                interaction.reply({
                    content: "<@" + (match_rules.match.permabans[0].choice == "firstloser" ? getOpponent({ interaction, player: getWinner({ race: 0, interaction }) }) : getWinner({ race: 0, interaction })) + "> please select a permanent ban",
                    embeds: [permabanEmbed({ interaction })],
                    components: permabanComponents({ permaban: 0, interaction })
                })
            } else {
                interaction.reply({
                    content: "<@" + (events[0].choice == "lastwinner" ? getWinner({ race: race - 1, interaction }) : getOpponent({ interaction, player: getWinner({ race: race - 1, interaction }) })) + "> please make a selection",
                    embeds: [raceEventEmbed({ race, interaction })],
                    components: raceEventComponents({ race, interaction })
                })
            }
            break
        case 'prerace':
            match_ref.child('races').child(match_data.current_race).update({ live: false })
            Object.values(match_data.players).map(player => {
                match_ref.child('races').child(match_data.current_race).child('ready').child(player).set(false)
                match_ref.child('races').child(match_data.current_race).child('reveal').child(player).set(false)
                match_ref.child('races').child(match_data.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })
            interaction.reply({
                content: Object.values(match_data.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(match_data.commentators).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed({ race, interaction })],
                components: raceComponents({ race, interaction })
            })
            break
        case 'delete':
            match_ref.remove()
            interaction.reply({
                content: "Match was cancelled"
            })
            break
    }
}