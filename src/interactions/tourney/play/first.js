const { colorEmbed, firstEmbed, firstComponents, firstbanComponents, colorComponents, firstbanEmbed, getOpponent, raceEmbed, raceComponents } = require('../functions.js')
const { tracks } = require('../../../data/sw_racer/track.js')
const { planets } = require('../../../data/sw_racer/planet.js')
const { trackgroups } = require('../data.js')
const { ChanceCube } = require('../../../data/discord/emoji.js')


exports.first = async function ({ interaction, args, db, member_id } = {}) {
    const match_data = db.ty.live[interaction.channelId]

    const livematch = livematch_setup({ db, database, interaction })

    if (!Object.values(livematch.players).includes(member_id)) {
        interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        return
    }

    await livematch.ref.child("status").set("first")
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
        Object.values(livematch.data.players).map(player => {
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
        await livematch.ref.child("races").child("0").update(race_object)
    }

    switch (args[2]) {
        case 'start':
            if (!livematch.data.firstmethod) {
                let content = "" + ([undefined, null].includes(livematch.data.firstvote) ? Object.values(livematch.data.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.data.players).map(player => Object.keys(livematch.data.firstvote).includes(player) ? "" : "<@" + player + ">").join(" "))
                interaction.update({ content: content, embeds: [firstEmbed(livematch)], components: firstComponents({ livematch }) })
            } else if (livematch.data.firstmethod.includes("poe")) {
                interaction.update({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*", embeds: [colorEmbed(livematch)], components: colorComponents() })
            } else if (livematch.data.firstmethod == 'random') {
                await interaction.update({ content: `The first track will be... ${ChanceCube}`, embeds: [], components: [] })
                setTimeout(async function () {
                    let randomtrack = Math.floor(Math.random() * 25)
                    setRace(randomtrack)
                    interaction.followUp("**" + planets[tracks[randomtrack].planet].emoji + " " + tracks[randomtrack].name + "**")
                }, 2000)
                setTimeout(async function () {
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "❗ Countown starts as soon as both players ready", embeds: [raceEmbed({ race: 0, livematch, db })], components: raceComponents({ race: 0, livematch }) })
                }, 3000)
            } else {
                interaction.update({ content: 'Please select a track', components: firstbanComponents({ livematch }) })
            }
            break
        case 'vote':
            await livematch.ref.child("firstvote").child(member_id).set(interaction.values[0])

            let votes = Object.values(livematch.data.firstvote)
            if (votes.length == 2) {
                livematch.ref.child("firstmethod").set(votes[0] == votes[1] ? votes[0] : livematch.rules.general.firsttrack.primary)
            }
            await livematch.ref.child("status").set("first")

            interaction.update(
                {
                    content: "" + ([undefined, null].includes(livematch.data.firstvote) ? Object.values(livematch.data.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.data.players).map(player => Object.keys(livematch.data.firstvote).includes(player) ? "" : "<@" + player + ">").join(" ")),
                    embeds: [firstEmbed(livematch)],
                    components: firstComponents({ livematch })
                }
            )
            break
        case 'color':
            content = Object.values(livematch.data.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*"
            if (["red", "blue"].includes(args[3])) {
                Object.values(livematch.data.players).forEach(async player => {
                    await livematch.ref.child("firstcolors").child(player).set(player == member_id ? args[3] : args[3] == "red" ? "blue" : "red")
                })

                await interaction.update({ content: `Rolling a chance cube... ${ChanceCube}`, embeds: [colorEmbed(livematch)], components: [] })
                setTimeout(async function () {
                    let players = Object.keys(livematch.data.firstcolors)
                    let firstplayer = Math.floor(Math.random() * 2) == 1 ? players[1] : players[0]
                    await livematch.ref.child("firstplayer").set(firstplayer)

                    interaction.followUp(":" + livematch.data.firstcolors[firstplayer] + "_square:")
                }, 1000)
                setTimeout(async function () {
                    interaction.followUp({ content: "<@" + (livematch.data.firstmethod == "poe_t" ? getOpponent({ livematch }) : livematch.data.firstplayer) + "> goes first!", embeds: [firstbanEmbed({ livematch })], components: firstbanComponents({ livematch }) })
                }, 2000)
                return
            }

            interaction.update({ content, embeds: [colorEmbed()], components: colorComponents() })
            break
        case 'ban':
            function whoseTurn() {
                let first = livematch.data.firstplayer
                let circuitoptions = [undefined, null].includes(livematch.data.firstbans) ? Object.values(livematch.rules.general.firsttrack.options) : Object.values(livematch.data.rules.general.firsttrack.options).filter(option => !Object.values(livematch.data.firstbans).map(ban => ban.ban).includes(option))
                let planetoptions = [undefined, null].includes(livematch.data.firstbans) ? ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"] : ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"].filter(option => !Object.values(livematch.data.firstbans).map(ban => ban.ban).includes(option))
                let trackoptions = []
                circuitoptions.forEach(circuit => {
                    tracks.forEach((track, index) => {
                        if (track.circuit == trackgroups[circuit].code) {
                            trackoptions.push(index)
                        }
                    })
                })
                trackoptions = [undefined, null].includes(livematch.data.firstbans) ? trackoptions : trackoptions.filter(option => !Object.values(livematch.data.firstbans).map(ban => Number(ban.ban)).includes(option) && planetoptions.map(option => trackgroups[option].code).includes(Number(tracks[option].planet)))
                let current_turn = first
                let opponent = getOpponent({ livematch, player: first })
                if (livematch.data.firstmethod == "poe_c") {
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
                } else if (livematch.data.firstmethod == "poe_p") {
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
                } else if (livematch.data.firstmethod == "poe_t") {
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
                livematch.ref.child("firstbans").push({ player: member_id, ban: interaction.values[0] })
                if (turn.options.length == 2) {
                    turn.options = turn.options.filter(t => Number(t) !== Number(interaction.values[0]))
                    await setRace(turn.options[0])

                    await interaction.update({ content: "", embeds: [firstbanEmbed({ livematch })], components: [] })
                    interaction.followUp({ content: Object.values(livematch.data.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.data.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed({ race: 0, livematch, db })], components: raceComponents({ race: 0, livematch }) })
                } else {
                    let turn = whoseTurn()

                    interaction.update({ content: "<@" + turn.current_turn + "> please make a selection", embeds: [firstbanEmbed({ livematch })], components: firstbanComponents({ livematch }) })
                }
            }
            break
        case 'pick':
            let firsttrack = interaction.values[0]
            await setRace(firsttrack)



            interaction.update({
                content: Object.values(livematch.data.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.data.commentators).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed({ race: 0, livematch, db })],
                components: raceComponents({ race: 0, livematch })
            })
            break
    }
}