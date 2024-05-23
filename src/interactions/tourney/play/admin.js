const { firstEmbed, firstComponents, getOpponent, raceEmbed, raceComponents, getWinner, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents } = require('../functions.js')

exports.admin = async function ({ interaction, db, member_id, livematch, liverules, livematchref } = {}) {
    let status = interaction.values[0]
    if (!((livematch.commentators && Object.values(livematch.commentators).includes(member_id)) || (interaction.guild.id == '441839750555369474' && (Member.roles.cache.some(r => r.id == '862810190072381471')) && !Object.values(livematch.players).includes(member_id)))) {
        interaction.reply({ content: "Only trackers/tourney staff have permission to use this. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })

    }

    //delete last bot message
    let race = livematch.current_race
    interaction.client.channels.cache.get(interaction.channel.id).messages.fetch({ limit: 20 }).then(messages => {
        let lastMessage = messages.filter(m => m.author.bot && m.id !== interaction.message.id).first();
        if (lastMessage) {
            lastMessage.delete().catch(err => console.log(err));
        }
    })

    switch (status) {
        case 'first':
            livematchref.update({
                races: "",
                firstbans: "",
                firstvote: "",
                eventstart: 0,
                eventend: 0,
                runs: "",
                firstcolors: ""
            })

            interaction.reply({
                content: Object.values(livematch.players).map(player => "<@" + player + ">").join(", "),
                embeds: [firstEmbed(livematch)],
                components: firstComponents({ liverules, livematch })
            })

            livematchref.child("status").set("first")
            break
        case 'permaban':
            livematchref.child('races').child('1').update({
                events: "",
                eventstart: 0,
                eventend: 0,
                live: false
            })

            Object.values(livematch.players).map(async player => {
                livematchref.child('races').child(livematch.current_race).child('ready').child(player).set(false)
                livematchref.child('races').child(livematch.current_race).child('reveal').child(player).set(false)
                livematchref.child('races').child(livematch.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })

            interaction.reply({
                content: "<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }) : getWinner({ race: 0, livematch })) + "> please select a permanent ban",
                embed: [permabanEmbed({ livematch })],
                components: permabanComponents({ permaban: 0, livematch, liverules })
            })

            break
        case 'prevrace':
            let current_race = livematch.current_race
            livematchref.child('races').child(livematch.current_race).remove()
            livematchref.child('current_race').set(current_race - 1)
            livematchref.child('races').child(current_race - 1).child('live').set(true)

            interaction.reply(
                {
                    content: Object.values(livematch.players).filter(player => !livematch.races[current_race - 1]?.ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                    embeds: [raceEmbed({ race: current_race - 1, livematch, liverules, db })],
                    components: raceComponents({ race: current_race - 1, liverules, livematch })
                })
            break
        case 'events':
            let events = Object.values(liverules.race)
            livematchref.child('races').child(livematch.current_race).update({
                events: "",
                eventstart: 0,
                eventend: 0,
                live: false
            })

            Object.values(livematch.players).map(player => {
                livematchref.child('races').child(livematch.current_race).child('ready').child(player).set(false)
                livematchref.child('races').child(livematch.current_race).child('reveal').child(player).set(false)
                livematchref.child('races').child(livematch.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })
            if (livematch.current_race == 1 && Object.values(liverules.match.permabans).length > 0) {
                interaction.reply({
                    content: "<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }) : getWinner({ race: 0, livematch })) + "> please select a permanent ban",
                    embeds: [permabanEmbed({ livematch })],
                    components: permabanComponents({ permaban: 0, livematch, liverules })
                })
            } else {
                interaction.reply({
                    content: "<@" + (events[0].choice == "lastwinner" ? getWinner(race - 1) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) })) + "> please make a selection",
                    embeds: [raceEventEmbed({ race, livematch, liverules })],
                    components: raceEventComponents({ race, livematch, interaction, liverules })
                })
            }
            break
        case 'prerace':
            livematchref.child('races').child(livematch.current_race).update({ live: false })
            Object.values(livematch.players).map(player => {
                livematchref.child('races').child(livematch.current_race).child('ready').child(player).set(false)
                livematchref.child('races').child(livematch.current_race).child('reveal').child(player).set(false)
                livematchref.child('races').child(livematch.current_race).child('runs').child(player).set({
                    deaths: "",
                    notes: "",
                    platform: "pc",
                    player: "",
                    pod: "",
                    time: ""
                })
            })
            interaction.reply({
                content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed({ race, livematch, liverules, db })],
                components: raceComponents({ race, liverules, livematch })
            })
            break
        case 'delete':
            livematchref.remove()
            interaction.reply({
                content: "Match was cancelled"
            })
            break
    }
}