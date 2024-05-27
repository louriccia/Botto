const { colorEmbed, firstEmbed, firstComponents, firstbanComponents, colorComponents, firstbanEmbed, getOpponent, raceEmbed, raceComponents } = require('../functions.js')
const { tracks } = require('../../../data/sw_racer/track.js')
const { trackgroups } = require('../data.js')
const { ChanceCube, WhyNobodyBuy } = require('../../../data/discord/emoji.js')
const { database, db } = require('../../../firebase.js')
const { getTrackName } = require('../../../generic.js')

function atPlayers({ match_data, exclude = [], comms = false } = {}) {
    let players = Object.values(match_data.players)
    if (comms) {
        players = [...players, ...Object.values(match_data.commentators)]
    }
    if (exclude?.length) {
        players = players.filter(player => !exclude.includes(player))
    }
    return players.map(player => `<@${player}>`).join(" ")
}

exports.first = async function ({ interaction, args, member_id } = {}) {
    let match_data = db.ty.live[interaction.channelId]
    const match_rules = db.ty.rulesets.saved?.[match_data.ruleset]
    const match_ref = database.ref(`tourney/live/${interaction.channelId}`)


    if (!Object.values(match_data.players).includes(member_id)) {
        interaction.reply({ content: `You're not a player! ${WhyNobodyBuy}`, ephemeral: true })
        return
    }

    await match_ref.child("status").set("first")
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
        }
        )
        await match_ref.child("races").child("0").update(race_object)
    }

    switch (args[2]) {
        case 'start':
            if (!match_data.firstmethod) {
                interaction.update({
                    content: "" + atPlayers({ match_data, exclude: Object.keys(match_data.firstvote) }),
                    embeds: [firstEmbed({ interaction })],
                    components: firstComponents({ interaction })
                })

                //process of elimination
            } else if (match_data.firstmethod.includes("poe")) {
                interaction.update({
                    content: `${atPlayers({ match_data })}\n*I just happen to have a chance cube here...*`,
                    embeds: [colorEmbed({ interaction })],
                    components: colorComponents()
                })

                //random
            } else if (match_data.firstmethod == 'random') {
                await interaction.update({
                    content: `The first track will be... ${ChanceCube}`,
                    embeds: [],
                    components: []
                })

                setTimeout(async function () {
                    let randomtrack = Math.floor(Math.random() * 25)
                    setRace(randomtrack)
                    interaction.followUp(`**${getTrackName(randomtrack)}**`)
                }, 2000)

                setTimeout(async function () {
                    interaction.followUp({
                        content: `${atPlayers({ match_data })} Countown begins as soon as both players ready`,
                        embeds: [raceEmbed({ race: 0, interaction })],
                        components: raceComponents({ race: 0, interaction })
                    })
                }, 3000)

                //already
            } else {
                interaction.update({
                    content: 'Please select a track',
                    components: firstbanComponents({ interaction })
                })
            }

            break
        case 'vote':
            //collect vote
            await match_ref.child("firstvote").child(member_id).set(interaction.values[0])
            match_data = db.ty.live[interaction.channelId]

            let votes = Object.values(match_data.firstvote)
            if (votes.length == 2) {
                match_ref.child("firstmethod").set(votes[0] == votes[1] ? votes[0] : match_rules.general.firsttrack.primary)
            }
            await match_ref.child("status").set("first")

            interaction.update(
                {
                    content: "" + atPlayers({ match_data, exclude: Object.keys(match_data.firstvote) }),
                    embeds: [firstEmbed({ interaction })],
                    components: firstComponents({ interaction })
                }
            )
            break
        case 'color':
            content = atPlayers({ match_data }) + "\n*I just happen to have a chancecube here...*"

            if (["red", "blue"].includes(args[3])) {
                Object.values(match_data.players).forEach(async player => {
                    await match_ref.child("firstcolors").child(player).set(player == member_id ? args[3] : args[3] == "red" ? "blue" : "red")
                })

                match_data = db.ty.live[interaction.channelId]

                await interaction.update({ content: `Rolling a chance cube... ${ChanceCube}`, embeds: [colorEmbed({ interaction })], components: [] })

                setTimeout(async function () {
                    let players = Object.keys(match_data.firstcolors)
                    let firstplayer = Math.floor(Math.random() * 2) == 1 ? players[1] : players[0]
                    await match_ref.child("firstplayer").set(firstplayer)
                    match_data = db.ty.live[interaction.channelId]
                    interaction.followUp(`:${match_data.firstcolors[firstplayer]}_square:`)
                }, 1000)

                setTimeout(async function () {
                    interaction.followUp({ content: "<@" + (match_data.firstmethod == "poe_t" ? getOpponent({ interaction, player: match_data.firstplayer }) : match_data.firstplayer) + "> goes first!", embeds: [firstbanEmbed({ interaction })], components: firstbanComponents({ interaction }) })
                }, 2000)

                return
            }

            interaction.update({ content, embeds: [colorEmbed({ interaction })], components: colorComponents() })
            break
        case 'ban':
            function whoseTurn() {
                let first = match_data.firstplayer
                let circuitoptions = [undefined, null].includes(match_data.firstbans) ? Object.values(match_rules.general.firsttrack.options) : Object.values(match_rules.general.firsttrack.options).filter(option => !Object.values(match_data.firstbans).map(ban => ban.ban).includes(option))
                let planetoptions = [undefined, null].includes(match_data.firstbans) ? ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"] : ["and", "tat", "oov", "ord", "bar", "mon", "aqu", "mal"].filter(option => !Object.values(match_data.firstbans).map(ban => ban.ban).includes(option))
                let trackoptions = []
                circuitoptions.forEach(circuit => {
                    tracks.forEach((track, index) => {
                        if (track.circuit == trackgroups[circuit].code) {
                            trackoptions.push(index)
                        }
                    })
                })
                trackoptions = [undefined, null].includes(match_data.firstbans) ? trackoptions : trackoptions.filter(option => !Object.values(match_data.firstbans).map(ban => Number(ban.ban)).includes(option) && planetoptions.map(option => trackgroups[option].code).includes(Number(tracks[option].planet)))
                let current_turn = first
                let opponent = getOpponent({ interaction, player: first })
                if (match_data.firstmethod == "poe_c") {
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
                } else if (match_data.firstmethod == "poe_p") {
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
                } else if (match_data.firstmethod == "poe_t") {
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
                match_ref.child("firstbans").push({ player: member_id, ban: interaction.values[0] })
                match_data = db.ty.live[interaction.channelId]
                if (turn.options.length == 2) {
                    turn.options = turn.options.filter(t => Number(t) !== Number(interaction.values[0]))
                    await setRace(turn.options[0])
                    match_data = db.ty.live[interaction.channelId]
                    await interaction.update({ content: "", embeds: [firstbanEmbed({ interaction })], components: [] })
                    interaction.followUp({
                        content: atPlayers({ match_data, comms: true }),
                        embeds: [raceEmbed({ race: 0, interaction })],
                        components: raceComponents({ race: 0, interaction })
                    })

                } else {
                    let turn = whoseTurn()

                    interaction.update({ content: `<@${turn.current_turn}> please make a selection`, embeds: [firstbanEmbed({ interaction })], components: firstbanComponents({ interaction }) })
                }
            }
            break
        case 'pick':
            let firsttrack = interaction.values[0]
            await setRace(firsttrack)

            match_data = db.ty.live[interaction.channelId]

            interaction.update({
                content: atPlayers({ match_data, comms: true }),
                embeds: [raceEmbed({ race: 0, interaction })],
                components: raceComponents({ race: 0, interaction })
            })
            break
    }
}