const { colorEmbed, firstEmbed, firstComponents, firstbanComponents, colorComponents, firstbanEmbed, getOpponent, raceEmbed, raceComponents } = require('../functions.js')
const { tracks } = require('../../../data/sw_racer/track.js')
const { planets } = require('../../../data/sw_racer/planet.js')
const { trackgroups } = require('../data.js')

exports.first = async function ({ interaction, args, db, member_id, livematch, liverules, livematchref } = {}) {
    if (!Object.values(livematch.players).includes(member_id)) {
        interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        return
    }

    await livematchref.child("status").set("first")
    async function setRace(track) {
        let event = {
            event: "selection",
            type: "track",
            player: "",
            selection: track,
            repeat: false,
            cost: 0
        }
        let race_object = {
            events: [event],
            ready: {},
            reveal: {},
            runs: {},
            live: false
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
        }
        )
        await livematchref.child("races").child("0").update(race_object)
    }

    switch (args[2]) {
        case 'start':
            if ([undefined, null].includes(livematch.firstmethod)) {
                let content = "" + ([undefined, null].includes(livematch.firstvote) ? Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.players).map(player => Object.keys(livematch.firstvote).includes(player) ? "" : "<@" + player + ">").join(" "))
                interaction.update({ content: content, embeds: [firstEmbed(livematch)], components: firstComponents({ liverules, livematch }) })
            } else if (livematch.firstmethod.includes("poe")) {
                interaction.update({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*", embeds: [colorEmbed(livematch)], components: colorComponents() })
            } else if (livematch.firstmethod == 'random') {
                await interaction.update({ content: "The first track will be... <a:OovoDoor:964369275559223306>", embeds: [], components: [] })
                setTimeout(async function () {
                    let randomtrack = Math.floor(Math.random() * 25)
                    setRace(randomtrack)
                    interaction.followUp("**" + planets[tracks[randomtrack].planet].emoji + " " + tracks[randomtrack].name + "**")
                }, 2000)
                setTimeout(async function () {
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "❗ Countown starts as soon as both players ready", embeds: [raceEmbed({ race: 0, livematch, liverules, db })], components: raceComponents({ race: 0, liverules, livematch }) })
                }, 3000)
            } else {
                interaction.update({ content: 'Please select a track', components: firstbanComponents({ livematch, liverules }) })
            }
            break
        case 'vote':
            await livematchref.child("firstvote").child(member_id).set(interaction.values[0])

            let votes = Object.values(livematch.firstvote)
            if (votes.length == 2) {
                livematchref.child("firstmethod").set(votes[0] == votes[1] ? votes[0] : liverules.general.firsttrack.primary)
            }
            await livematchref.child("status").set("first")

            interaction.update(
                {
                    content: "" + ([undefined, null].includes(livematch.firstvote) ? Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.players).map(player => Object.keys(livematch.firstvote).includes(player) ? "" : "<@" + player + ">").join(" ")),
                    embeds: [firstEmbed(livematch)],
                    components: firstComponents({ liverules, livematch })
                }
            )
            break
        case 'color':
            content = Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*"
            if (["red", "blue"].includes(args[3])) {
                Object.values(livematch.players).forEach(async player => {
                    await livematchref.child("firstcolors").child(player).set(player == member_id ? args[3] : args[3] == "red" ? "blue" : "red")
                })

                await interaction.update({ content: "Rolling a chance cube... <a:OovoDoor:964369275559223306>", embeds: [colorEmbed(livematch)], components: [] })
                setTimeout(async function () {
                    let players = Object.keys(livematch.firstcolors)
                    let firstplayer = Math.floor(Math.random() * 2) == 1 ? players[1] : players[0]
                    await livematchref.child("firstplayer").set(firstplayer)
                    interaction.followUp(":" + livematch.firstcolors[firstplayer] + "_square:")
                }, 1000)
                setTimeout(async function () {
                    interaction.followUp({ content: "<@" + (livematch.firstmethod == "poe_t" ? getOpponent({ livematch, player: livematch.firstplayer }) : livematch.firstplayer) + "> goes first!", embeds: [firstbanEmbed({ livematch })], components: firstbanComponents({ livematch, liverules }) })
                }, 2000)
                return
            }
            interaction.update({ content, embeds: [colorEmbed()], components: colorComponents() })
            break
        case 'ban':
            function whoseTurn() {
                let first = livematch.firstplayer
                let circuitoptions = [undefined, null].includes(livematch.firstbans) ? Object.values(liverules.general.firsttrack.options) : Object.values(liverules.general.firsttrack.options).filter(option => !Object.values(livematch.firstbans).map(ban => ban.ban).includes(option))
                let planetoptions = [undefined, null].includes(livematch.firstbans) ? ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"] : ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"].filter(option => !Object.values(livematch.firstbans).map(ban => ban.ban).includes(option))
                let trackoptions = []
                circuitoptions.forEach(circuit => {
                    tracks.forEach((track, index) => {
                        if (track.circuit == trackgroups[circuit].code) {
                            trackoptions.push(index)
                        }
                    })
                })
                trackoptions = [undefined, null].includes(livematch.firstbans) ? trackoptions : trackoptions.filter(option => !Object.values(livematch.firstbans).map(ban => Number(ban.ban)).includes(option) && planetoptions.map(option => trackgroups[option].code).includes(Number(tracks[option].planet)))
                let current_turn = first
                let opponent = getOpponent({ livematch, player: first })
                if (livematch.firstmethod == "poe_c") {
                    if (circuitoptions.length > 1) {
                        if (circuitoptions.length % 2 == 0) {
                            current_turn = first
                        } else {
                            current_turn = opponent
                        }
                    } else {
                        if (trackoptions.length % 2 == 0) {
                            current_turn = opponent
                        } else {
                            current_turn = first
                        }
                    }
                } else if (livematch.firstmethod == "poe_p") {
                    if (planetoptions.length > 1) {
                        if (planetoptions.length % 2 == 0) {
                            current_turn = first
                        } else {
                            current_turn = opponent
                        }
                    } else {
                        if (trackoptions.length % 2 == 0) {
                            current_turn = opponent
                        } else {
                            current_turn = first
                        }
                    }
                } else if (livematch.firstmethod == "poe_t") {
                    if (trackoptions.length % 2 == 0) {
                        current_turn = first
                    } else {
                        current_turn = opponent
                    }
                }
                return { current_turn: current_turn, options: trackoptions }
            }
            if (interaction.isStringSelectMenu()) {
                let turn = whoseTurn()
                if (member_id !== turn.current_turn) {
                    interaction.reply({ content: "It's not your turn to ban! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    return
                }
                livematchref.child("firstbans").push({ player: member_id, ban: interaction.values[0] })
                if (turn.options.length == 2) {
                    turn.options = turn.options.filter(t => Number(t) !== Number(interaction.values[0]))
                    await setRace(turn.options[0])

                    await interaction.update({ content: "", embeds: [firstbanEmbed({ livematch })], components: [] })
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed({ race: 0, livematch, liverules, db })], components: raceComponents({ race: 0, liverules, livematch }) })
                } else {
                    let turn = whoseTurn()
                    interaction.update({ content: "<@" + turn.current_turn + "> please make a selection", embeds: [firstbanEmbed({ livematch })], components: firstbanComponents({ livematch, liverules }) })
                }
            }
            break
        case 'pick':
            let firsttrack = interaction.values[0]
            await setRace(firsttrack)

            livematch = db.ty.live[interaction.channelId]

            interaction.update({ 
                content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), 
                embeds: [raceEmbed({ race: 0, livematch, liverules, db })], 
                components: raceComponents({ race: 0, liverules, livematch }) })
            break
    }
}