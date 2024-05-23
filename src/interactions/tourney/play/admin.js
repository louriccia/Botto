const { firstEmbed, firstComponents, getOpponent, raceEmbed, raceComponents, getWinner, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../functions.js')
const { livematch_setup } = require('./livematch.js')

exports.admin = async function ({ interaction, db, member_id, database } = {}) {

    const livematch = livematch_setup({database, db, interaction})

    let status = interaction.values[0]
    if (!((livematch.data.commentators && Object.values(livematch.data.commentators).includes(member_id)) || (interaction.guild.id == '441839750555369474' && (Member.roles.cache.some(r => r.id == '862810190072381471')) && !Object.values(livematch.data.players).includes(member_id)))) {
        interaction.reply({ content: "Only trackers/tourney staff have permission to use this. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })

    }

    //delete last bot message
    let race = livematch.data.current_race
    interaction.client.channels.cache.get(interaction.channel.id).messages.fetch({ limit: 20 }).then(messages => {
        let lastMessage = messages.filter(m => m.author.bot && m.id !== interaction.message.id).first();
        if (lastMessage) {
            lastMessage.delete().catch(err => console.log(err));
        }
    })

    switch (status) {
        case 'first':
            livematch.ref.update({
                races: "",
                firstbans: "",
                firstvote: "",
                eventstart: 0,
                eventend: 0,
                runs: "",
                firstcolors: ""
            })

            interaction.reply({
                content: Object.values(livematch.data.players).map(player => "<@" + player + ">").join(", "),
                embeds: [firstEmbed(livematch.data)],
                components: firstComponents({ livematch })
            })

            livematch.ref.child("status").set("first")
            break
        case 'permaban':
            livematch.ref.child('races').child('1').update({
                events: "",
                eventstart: 0,
                eventend: 0,
                live: false
            })

            Object.values(livematch.data.players).map(async player => {
                livematch.ref.child('races').child(livematch.data.current_race).child('ready').child(player).set(false)
                livematch.ref.child('races').child(livematch.data.current_race).child('reveal').child(player).set(false)
                livematch.ref.child('races').child(livematch.data.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })

            interaction.reply({
                content: "<@" + (livematch.rules.match.permabans[0].choice == "firstloser" ? getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }) : getWinner({ race: 0, livematch })) + "> please select a permanent ban",
                embed: [permabanEmbed({ livematch })],
                components: permabanComponents({ permaban: 0, livematch })
            })

            break
        case 'prevrace':
            let current_race = livematch.data.current_race
            livematch.ref.child('races').child(livematch.data.current_race).remove()
            livematch.ref.child('current_race').set(current_race - 1)
            livematch.ref.child('races').child(current_race - 1).child('live').set(true)

            interaction.reply(
                {
                    content: Object.values(livematch.data.players).filter(player => !livematch.data.races[current_race - 1]?.ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.data.commentators).map(comm => "<@" + comm + ">").join(" "),
                    embeds: [raceEmbed({ race: current_race - 1, livematch,  db })],
                    components: raceComponents({ race: current_race - 1,  livematch })
                })
            break
        case 'events':
            let events = Object.values(livematch.rules.race)
            livematch.ref.child('races').child(livematch.data.current_race).update({
                events: "",
                eventstart: 0,
                eventend: 0,
                live: false
            })

            Object.values(livematch.data.players).map(player => {
                livematch.ref.child('races').child(livematch.data.current_race).child('ready').child(player).set(false)
                livematch.ref.child('races').child(livematch.data.current_race).child('reveal').child(player).set(false)
                livematch.ref.child('races').child(livematch.data.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })
            if (livematch.data.current_race == 1 && Object.values(livematch.rules.match.permabans).length > 0) {
                interaction.reply({
                    content: "<@" + (livematch.rules.match.permabans[0].choice == "firstloser" ? getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }) : getWinner({ race: 0, livematch })) + "> please select a permanent ban",
                    embeds: [permabanEmbed({ livematch })],
                    components: permabanComponents({ permaban: 0, livematch, livematch })
                })
            } else {
                interaction.reply({
                    content: "<@" + (events[0].choice == "lastwinner" ? getWinner(race - 1) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) })) + "> please make a selection",
                    embeds: [raceEventEmbed({ race, livematch })],
                    components: raceEventComponents({ race, livematch, interaction, livematch })
                })
            }
            break
        case 'prerace':
            livematch.ref.child('races').child(livematch.data.current_race).update({ live: false })
            Object.values(livematch.data.players).map(player => {
                livematch.ref.child('races').child(livematch.data.current_race).child('ready').child(player).set(false)
                livematch.ref.child('races').child(livematch.data.current_race).child('reveal').child(player).set(false)
                livematch.ref.child('races').child(livematch.data.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })
            interaction.reply({
                content: Object.values(livematch.data.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.data.commentators).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed({ race, livematch, livematch, db })],
                components: raceComponents({ race, livematch, livematch })
            })
            break
        case 'delete':
            livematch.ref.remove()
            interaction.reply({
                content: "Match was cancelled"
            })
            break
    }
}