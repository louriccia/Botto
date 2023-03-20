const Discord = require('discord.js');
const myEmbed = new EmbedBuilder()

exports.play = async function (args, interaction, database) {

    const Guild = interaction.guild
    const Member = interaction.member
    const name = interaction.member.displayName
    const avatar = await interaction.member.displayAvatarURL()
    let member = interaction.user.id

    let livematch = {}
    let liverules

    let livematchref = database.ref('tourney/live/' + interaction.channel_id)
    livematchref.on('value', (snapshot) => {
        livematch = snapshot.val()
    }, (error) => {
        console.log('the read failed: ' + error.name)
    })
    let userref = database.ref('users');
    let users_data = {}
    userref.on("value", function (snapshot) {
        users_data = snapshot.val();
    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
    let tourney_rulesets = database.ref('tourney/rulesets')
    let tourney_rulesets_data = {}
    tourney_rulesets.on("value", function (snapshot) {
        tourney_rulesets_data = snapshot.val();
    }, function (errorObject) {
        console.log("The read failed: " + errorObject);
    });

    if (livematch) {
        liverules = tourney_rulesets_data.saved[livematch.ruleset]
    }

    //if no match, assert setup
    if ([null, undefined, ""].includes(livematch)) {
        args[1] = "setup"
        initializeMatch(livematchref)
        //else give admin options
    } else if (interaction.isChatInputCommand()) {
        args[1] = 'admin'
        type = 4
        interaction.update({ embeds: [adminEmbed()], components: [adminComponents()] })
        return
    }

    //find player in userbase
    let player = null
    Object.keys(userdata).forEach(key => {
        if (userdata[key].discordID && userdata[key].discordID == member) {
            player = key
            return
        }
    })
    if (!player) {
        player = initializeUser(userref, member)
    }

    if (args[1] == 'admin') {
        let status = interaction.values[0]
        if (Object.values(livematch.commentators).includes(member) || (interaction.guild_id == '441839750555369474' && (Member.roles.cache.some(r => r.id == '862810190072381471')) && !Object.values(livematch.players).includes(member))) {
            let race = livematch.current_race
            client.channels.cache.get(interaction.channel_id).messages.fetch({ limit: 20 }).then(messages => {
                let lastMessage = messages.filter(m => m.author.bot && m.id !== interaction.message.id).first();
                if (lastMessage) {
                    lastMessage.delete().catch(err => console.log(err));
                }
            })
            if (status == 'first') {
                livematchref.update({ races: "", firstbans: "", firstvote: "", eventstart: 0, eventend: 0, runs: "", firstcolors: "" })
                livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
                interaction.update({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(", "), embeds: [firstEmbed()], components: [firstComponents()] })
                livematchref.child("status").set("first")
            } else if (status == 'permaban') {
                livematchref.child('races').child('1').update({ events: "", eventstart: 0, eventend: 0, live: false })
                livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
                Object.values(livematch.players).map(player => {
                    livematchref.child('races')
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
                interaction.update("<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent(getWinner(0)) : getWinner(0)) + "> please select a permanent ban", type, [permabanEmbed(0)], permabanComponents(0))
            } else if (status == 'prevrace') {
                let current_race = livematch.current_race
                livematchref.child('races').child(livematch.current_race).remove()
                livematchref.child('current_race').set(current_race - 1)
                livematchref.child('races').child(current_race - 1).child('live').set(true)
                interaction.update(
                    {
                        content: Object.values(livematch.players).filter(player => !livematch.races[current_race - 1].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                        embeds: [raceEmbed(current_race - 1)],
                        components: [raceComponents(current_race - 1)]
                    })
            } else if (status == 'events') {
                let events = Object.values(liverules.race)
                livematchref.child('races').child(livematch.current_race).update({ events: "", eventstart: 0, eventend: 0, live: false })
                livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
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
                    interaction.update({
                        content: "<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent(getWinner(0)) : getWinner(0)) + "> please select a permanent ban",
                        embeds: [permabanEmbed(0)],
                        components: [permabanComponents(0)]
                    })
                } else {
                    interaction.update({
                        content: "<@" + (events[0].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1))) + "> please make a selection",
                        embeds: [raceEventEmbed(race)],
                        components: [raceEventComponents(race)]
                    })
                }
            } else if (status == 'prerace') {
                livematchref.child('races').child(livematch.current_race).update({ live: false })
                livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
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
                interaction.update(Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), type, [raceEmbed(race)], raceComponents(race))
            } else if (status == 'delete') {
                livematchref.remove()
                interaction.reply({ content: "Match was cancelled" })
            }
        } else {
            interaction.reply({ content: "Only trackers/tourney staff have permission to use this. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        }
    } else if (args[1] == "setup") {
        livematchref.child("status").set("setup")
        if (args[2] == "tournament") {
            livematchref.update({ tourney: interaction.values[0], bracket: "", ruleset: "" })
        } else if (args[2] == "bracket") {
            livematchref.update(
                {
                    bracket: interaction.values[0],
                    ruleset: tourney_tournaments_data[livematch.tourney].stages[interaction.values[0]].ruleset
                }
            )
        } else if (args[2] == "ruleset") {
            livematchref.update({ ruleset: interaction.values[0] })
        } else if (args[2] == "player") {
            if (!livematch.players || (livematch.players && !Object.values(livematch.players).includes(member))) {
                livematchref.child("players").push(member)
            }
        } else if (args[2] == "comm") {
            if (!livematch.commentators || (livematch.commentators && !Object.values(livematch.commentators).includes(member))) {
                livematchref.child("commentators").push(member)
            }
        } else if (args[2] == "leave") {
            if (livematch.commentators) {
                let comms = Object.keys(livematch.commentators)
                comms.forEach(key => {
                    if (livematch.commentators[key] == member) {
                        livematchref.child("commentators").child(key).remove()
                    }
                })
            }
            if (livematch.players) {
                let players = Object.keys(livematch.players)
                players.forEach(key => {
                    if (livematch.players[key] == member) {
                        livematchref.child("players").child(key).remove()
                    }
                })
            }

        } else if (args[2] == 'cancel') {
            livematchref.remove()
            interaction.update({ content: "Match was cancelled" })
            return
        }
        interaction.update({ embeds: [setupEmbed()], components: [setupComponents()] })
    } else if (args[1] == "start") {
        if (![null, undefined, ""].includes(livematch.datetime)) {
            livematchref.child('datetime').set(Date.now())
        }
        interaction.update({ embeds: [matchMakerEmbed(), rulesetOverviewEmbed(), reminderEmbed()] })
        interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(", "), embeds: [firstEmbed()], components: firstComponents() })
        livematchref.child("status").set("first")
    } else if (args[1] == "first") {
        if (!Object.values(livematch.players).includes(member)) {
            interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            return
        }
        livematchref.child("status").set("first")
        function setRace(track) {
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
                ready: { commentators: false },
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
            livematchref.child("races").child("0").update(race_object)
        }
        if (args[2] == 'start') {
            if ([undefined, null].includes(livematch.firstmethod)) {
                let content = "" + ([undefined, null].includes(livematch.firstvote) ? Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.players).map(player => Object.keys(livematch.firstvote).includes(player) ? "" : "<@" + player + ">").join(" "))
                interaction.update({ content: content, embeds: [firstEmbed()], components: firstComponents() })
            } else if (livematch.firstmethod.includes("poe")) {
                interaction.update({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*", embeds: [colorEmbed()], components: colorComponents() })
            } else if (livematch.firstmethod == 'random') {
                interaction.update("The first track will be... <a:OovoDoor:964369275559223306>")
                setTimeout(async function () {
                    let randomtrack = Math.floor(Math.random() * 25)
                    setRace(randomtrack)
                    interaction.followUp("**" + planets[tracks[randomtrack].planet].emoji + " " + tracks[randomtrack].name + "**")
                }, 2000)
                setTimeout(async function () {
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed(0)], components: raceComponents(0) })
                }, 3000)
            } else {
                interaction.update({ content: 'Please select a track', components: [firstbanComponents()] })
            }
        } else if (args[2] == "vote") {
            livematchref.child("firstvote").child(member).set(interaction.values[0])
            let votes = Object.values(livematch.firstvote)
            if (votes.length == 2) {
                livematchref.child("firstmethod").set(votes[0] == votes[1] ? votes[0] : liverules.general.firsttrack.primary)
            }
            livematchref.child("status").set("first")
            interaction.update(
                {
                    content: "" + ([undefined, null].includes(livematch.firstvote) ? Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") : Object.values(livematch.players).map(player => Object.keys(livematch.firstvote).includes(player) ? "" : "<@" + player + ">").join(" ")),
                    embeds: [firstEmbed()],
                    components: [firstComponents()]
                }
            )
        } else if (args[2] == "color") {
            content = Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*"
            if (["red", "blue"].includes(args[3])) {
                Object.values(livematch.players).forEach(player => {
                    livematchref.child("firstcolors").child(player).set(player == member ? args[3] : args[3] == "red" ? "blue" : "red")
                })
                interaction.update({ embeds: [colorEmbed()] })
                interaction.followUp("Rolling a chance cube... <a:OovoDoor:964369275559223306>")
                setTimeout(async function () {
                    let players = Object.keys(livematch.firstcolors)
                    let firstplayer = Math.floor(Math.random() * 2) == 1 ? players[1] : players[0]
                    livematchref.child("firstplayer").set(firstplayer)
                    interaction.followUp(":" + livematch.firstcolors[firstplayer] + "_square:")
                }, 1000)
                setTimeout(async function () {
                    interaction.followUp({ content: "<@" + (livematch.firstmethod == "poe_t" ? getOpponent(livematch.firstplayer) : livematch.firstplayer) + "> goes first!", embeds: [firstbanEmbed()], components: [firstbanComponents()] })
                }, 2000)
                return
            }
            interaction.update({ content, embeds: [colorEmbed()], components: [colorComponents()] })
        } else if (args[2] == "ban") {
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
                let opponent = getOpponent(first)
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
                if (member !== turn.current_turn) {
                    interaction.reply({ content: "It's not your turn to ban! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    return
                }
                livematchref.child("firstbans").push({ player: member, ban: interaction.values[0] })
                if (turn.options.length == 2) {
                    turn.options = turn.options.filter(t => Number(t) !== Number(interaction.values[0]))
                    setRace(turn.options[0])
                    interaction.update({ embeds: [firstbanEmbed()] })
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed(0)], components: raceComponents(0) })
                } else {
                    let turn = whoseTurn()
                    interaction.update({ content: "<@" + turn.current_turn + "> please make a selection", embeds: [firstbanEmbed()], components: [firstbanComponents()] })
                }
            }
        } else if (args[2] == 'pick') {
            let firsttrack = interaction.values[0]
            setRace(firsttrack)
            interaction.update({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed(0)], components: [raceComponents(0)] })
        }
    } else if (args[1].includes("permaban")) {
        if (!Object.values(livematch.players).includes(member)) {
            interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        }
        livematchref.child("status").set("permaban")
        let permaban_num = Number(args[2])
        let permaban = liverules.match.permabans[permaban_num]
        if ((permaban.choice == "firstwinner" && member == getWinner(0)) || (permaban.choice == "firstloser" && member == getOpponent(getWinner(0)))) {
            interaction.values.forEach(selection => {
                livematchref.child("races").child(1).child("events").push(
                    {
                        event: "permaban",
                        type: permaban.type,
                        player: member,
                        selection: selection,
                        cost: permaban.cost
                    },
                )
            })
            if (permaban_num + 1 == Object.values(liverules.match.permabans).length) {
                let events = Object.values(liverules.race)
                livematchref.child("status").set("events")
                interaction.update({ content: "<@" + (events[0].choice == "lastwinner" ? getWinner(0) : getOpponent(getWinner(0))) + "> please make a selection", embeds: [raceEventEmbed(1)], components: [raceEventComponents(1)] })
            } else {
                interaction.update({ content: "<@" + (liverules.match.permabans[permaban_num + 1].choice == 'firstwinner' ? getWinner(0) : getOpponent(getWinner(0))) + ">", embeds: [permabanEmbed(permaban_num + 1)], components: [permabanComponents(permaban_num + 1)] })
            }
        } else {
            interaction.reply({ content: "It's not your turn to ban! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        }
    } else if (args[1].includes("race")) {
        let race = Number(args[1].replace("race", ""))
        let event = Number(args[2].replace("event", ""))
        let events = Object.values(liverules.race)
        let e = events[event]
        let eventstart = livematch.races[race].eventstart
        let eventend = livematch.races[race].eventend
        let responded = false
        if (args[2].includes("event")) {
            if (member == (e.choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1)))) {
                livematchref.child("status").set("events")
                if (interaction.message.components.length > 1) {
                    if (args[3] == "submit") {
                        let newevents = []
                        interaction.message.components.forEach(component => {
                            if (component.components[0].type == 3) {
                                let thisargs = component.components[0].custom_id.split("_")
                                let thisevent = Number(thisargs[3].replace("event", ""))
                                let e = liverules.race[thisevent]
                                let options = component.components[0].options.filter(option => option.default)
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
                                        player: member,
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
                        newevents.forEach(event => {
                            livematchref.child("races").child(race).child('events').push(event)
                        })

                    } else {
                        interaction.update({
                            content: "<@" + (events[event].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1))) + "> please make a selection",
                            embeds: [raceEventEmbed(race)],
                            components: [raceEventComponents(race)]
                        })
                        return
                    }
                } else {
                    interaction.values.forEach(selection => {
                        let new_event = {
                            event: e.event,
                            type: e.type,
                            player: member,
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
                        livematchref.child("races").child(race).child("events").push(new_event)
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
                        interaction.update({ embeds: [raceEventEmbed(race)] })
                        interaction.followUp({
                            content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "),
                            embeds: [raceEmbed(race)],
                            components: [raceComponents(race)]
                        })
                        livematchref.child("status").set("prerace")
                    } else {
                        livematchref.child("races").child(race).update({ eventstart: eventend + 1, eventend: eventend + 1 + streak })
                        interaction.update({
                            content: "<@" + (events[event + 1].choice == "lastwinner" ? getWinner(race - 1) : getOpponent(getWinner(race - 1))) + "> please make a selection",
                            embeds: [raceEventEmbed(race)],
                            components: [raceEventComponents(race)]
                        })
                    }
                }

            } else {
                interaction.reply({ content: "It's not your turn! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            }


        } else if (["ready", "unready"].includes(args[2])) {
            if (Object.values(livematch.players).includes(member) && ![undefined, null, ""].includes(livematch.races[race].runs) && ![undefined, null, ""].includes(livematch.races[race].runs[member]) && ![undefined, null, ""].includes(livematch.races[race].runs[member].pod)) {
                livematchref.child("races").child(race).child("ready").child(member).set((args[2] == "ready" ? true : false))
                if (!Object.values(livematch.commentators).includes(member)) {
                    interaction.update({
                        content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                        embeds: [raceEmbed(race)],
                        components: [raceComponents(race)]
                    })
                }
            } else if (Object.values(livematch.players).includes(member)) {
                interaction.reply({ content: "You have not selected a racer yet! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            }
            if (Object.values(livematch.commentators).includes(member) || (interaction.guild_id == '441839750555369474' && (Member.roles.cache.some(r => r.id == '862810190072381471')) && !Object.values(livematch.players).includes(member))) {
                if (Object.values(livematch.races[race].ready).filter(r => r == false).length == 1 && !livematch.races[race].ready.commentators) {
                    livematchref.child("races").child(race).child("ready").child("commentators").set((args[2] == "ready" ? true : false))
                    interaction.update({
                        content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n<a:countdown:672640791369482251> Countdown incoming! Good luck <a:countdown:672640791369482251>"
                    })
                    setTimeout(async function () {
                        client.channels.cache.get(interaction.channel_id).messages.fetch(interaction.message.id).then(message => message.delete())
                    }, 10000)
                    livematchref.child("status").set("midrace")
                    countDown()
                    //initiate race
                    livematchref.child("races").child(race).child("live").set(true)
                    setTimeout(async function () {
                        interaction.followUp({ embeds: [raceEmbed(race)], components: [raceComponents(race)] })
                    }, 10000)
                } else {
                    interaction.reply({ content: "Players are not ready yet! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                }
            }

        } else if (args[2] == 'gents') {
            if (Object.values(livematch.players).includes(member)) {
                if (interaction.type == 5) {
                    let terms = interaction.data.components[0].components[0].value.trim()
                    livematchref.child('races').child(race).child('gents').set({ terms: terms, player: member, agreed: "?" })
                    interaction.update({
                        content: "<@" + getOpponent(member) + "> do you accept the terms of the proposed 🎩 **Gentlemen's Agreement**?\n*" + terms + "*",
                        embeds: [raceEmbed(race)],
                        components: [raceComponents(race)]
                    })
                } else {
                    if (args.length == 3) {
                        client.api.interactions(interaction.id, interaction.token).callback.post({
                            data: {
                                type: 9,
                                data: {
                                    custom_id: "tourney_play_race" + race + "_gents",
                                    title: "Make a Gentleman's Agreement",
                                    components: [
                                        {
                                            type: 1,
                                            components: [
                                                {
                                                    type: 4,
                                                    custom_id: "gents",
                                                    label: "Agreement Terms",
                                                    style: 1,
                                                    min_length: 0,
                                                    max_length: 100,
                                                    required: false
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        })
                    } else {
                        if (member == getOpponent(livematch.races[race].gents?.player)) {
                            if (args[3] == 'true') {
                                livematchref.child('races').child(race).child('gents').update({ agreed: true })
                            } else {
                                livematchref.child('races').child(race).child('gents').remove()
                            }
                            interaction.update({
                                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                                embeds: [raceEmbed(race)],
                                components: [raceComponents(race)]
                            })
                        } else {
                            interaction.reply({ content: "Not you! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                        }

                    }
                }
            } else {
                interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            }
        } else if (args[2] == "racer") {
            if (Object.values(livematch.players).includes(member)) {
                livematchref.child("races").child(race).child("runs").child(member).child("pod").set(interaction.values[0])
            }
            interaction.update({
                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                embeds: [raceEmbed(race)],
                components: [raceComponents(race)]
            })
        } else if (args[2] == "reveal") {
            if (Object.values(livematch.players).includes(member)) {
                livematchref.child("races").child(race).child("reveal").child(member).set(true)
            }
            interaction.update({
                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed(race)],
                components: [raceComponents(race)]
            })
        } else if (args[2] == "submit") {
            if (Object.values(livematch.players).includes(member)) {
                if (interaction.type == 5) {
                    if (livematch.races[race].live) {
                        livematchref.child("races").child(race).child("runs").child(member).update(
                            {
                                time: (interaction.data.components[0].components[0].value.toLowerCase() == 'dnf' ? 'DNF' : tools.timetoSeconds(interaction.data.components[0].components[0].value.trim()) == null ? "DNF" : tools.timetoSeconds(interaction.data.components[0].components[0].value.trim())),
                                deaths: interaction.data.components[1].components[0].value.trim(),
                                notes: interaction.data.components[2].components[0].value.trim(),
                                player: member
                            }
                        )
                        interaction.update({
                            content: "",
                            embeds: [raceEmbed(race)],
                            components: [raceComponents(race)]
                        })
                    } else {
                        interaction.reply({ content: "Race is no longer live. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    }
                } else {
                    client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 9,
                            data: {
                                custom_id: "tourney_play_race" + race + "_submit",
                                title: "Submit Race " + (race + 1) + " Results",
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 4,
                                                custom_id: "time",
                                                label: "⏱️ Time (write 'dnf' if forfeited)",
                                                style: 1,
                                                min_length: 1,
                                                max_length: 10,
                                                required: true,
                                                placeholder: "--:--.---",
                                                value: (String(livematch.races[race].runs[member]?.time).toLowerCase() == 'dnf' ? 'DNF' : (livematch.races[race].runs[member].time == "" ? "" : tools.timefix(livematch.races[race].runs[member].time)))
                                            }
                                        ]
                                    },
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 4,
                                                custom_id: "deaths",
                                                label: "💀 Deaths (leave blank if unsure)",
                                                style: 1,
                                                min_length: 0,
                                                max_length: 2,
                                                required: false,
                                                value: livematch.races[race].runs[member].deaths
                                            }
                                        ]
                                    },
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 4,
                                                custom_id: "notes",
                                                label: "📝 Notes",
                                                style: 1,
                                                min_length: 0,
                                                max_length: 100,
                                                required: false,
                                                value: livematch.races[race].runs[member].notes
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    })
                }
            } else {
                interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
            }
        } else if (args[2] == "verify") {

            if (interaction.type == 5) {
                async function verify() {
                    const Member = await Guild.members.fetch(member)
                    if (Object.values(livematch.commentators).includes(member) || (interaction.guild_id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(livematch.players).includes(member))) {
                        interaction.data.components.map(field => {
                            if (field.components[0].custom_id.includes("time")) {
                                livematchref.child("races").child(race).child("runs").child(field.components[0].custom_id.replace("time", "")).update({ time: (field.components[0].value.toLowerCase() == 'dnf' ? 'DNF' : tools.timetoSeconds(field.components[0].value)) })
                            } else if (field.components[0].custom_id.includes("deaths")) {
                                livematchref.child("races").child(race).child("runs").child(field.components[0].custom_id.replace("deaths", "")).update({ deaths: (field.components[0].value == "" ? "" : Number(field.components[0].value)) })
                            }
                        })
                    }
                    return
                }
                verify().then(() => {
                    livematchref.child("races").child(race).child("live").set(false)
                    interaction.update({
                        content: "",
                        embeds: [raceEmbed(race)]
                    })
                    interaction.followUp({ embeds: [matchSummaryEmbed()] })

                    //check win condition
                    let scoreboard = {}
                    Object.keys(livematch.races).forEach(race => {
                        let winner = getWinner(race)
                        if (winner) {
                            if ([null, undefined, ""].includes(scoreboard[winner])) {
                                scoreboard[winner] = 1
                            } else {
                                scoreboard[winner]++
                            }
                        }
                    })
                    let wincondition = false
                    Object.keys(scoreboard).forEach(player => {
                        if (scoreboard[player] == liverules.general.winlimit) {
                            //win condition
                            const winEmbed = new EmbedBuilder()
                                .setAuthor("Match Concluded")
                                .setTitle(getUsername(player) + " Wins!")
                                .setDescription("GGs, racers! The match has been saved.\n<@&970995237952569404> role will be automatically removed in 15 minutes")
                                .addField(":microphone2: Commentators/Trackers", ":orange_circle: Don't forget to click 'Episode Finished' after the interviews")
                            interaction.followUp({ embeds: [winEmbed] })
                            wincondition = true
                            let everybody = Object.values(livematch.players).concat(Object.values(livematch.commentators))
                            tourney_matches.push(livematch).then(() => {
                                livematchref.remove()
                            })

                            if (interaction.guild_id == '441839750555369474') {
                                setTimeout(async function () {
                                    everybody.forEach(async function (p) {
                                        const thisMember = await Guild.members.fetch(p)
                                        if (thisMember && thisMember.roles.cache.some(r => r.id == '970995237952569404')) {
                                            thisMember.roles.remove('970995237952569404').catch(console.error)
                                        }
                                    })
                                }, 15 * 60 * 1000)
                            }
                            return
                        }
                    })
                    if (!wincondition) {
                        let nextrace = livematch.current_race + 1
                        livematchref.child("current_race").set(nextrace)
                        let race_object = {
                            ready: { commentators: false },
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
                        }
                        )
                        livematchref.child('races').child(nextrace).update(race_object)
                        livematchref.child("status").set("events")
                        //start permabans
                        if (race == 0 && Object.values(liverules.match.permabans).length > 0) {
                            interaction.followUp({
                                content: "<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent(getWinner(0)) : getWinner(0)) + "> please select a permanent ban",
                                embeds: [permabanEmbed(0)],
                                components: [permabanComponents(0)]
                            })
                        } else { //restart event loop for next race
                            interaction.followUp({
                                content: "<@" + (events[0].choice == "lastwinner" ? getWinner(race) : getOpponent(getWinner(race))) + "> please make a selection",
                                embeds: [raceEventEmbed(nextrace)],
                                components: [raceEventComponents(nextrace)]
                            })
                        }
                    }
                })


            } else {
                async function verify() {
                    const Member = await Guild.members.fetch(member)
                    if (Object.values(livematch.commentators).includes(member) || (interaction.guild_id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(livematch.players).includes(member))) {
                        let modal = {
                            data: {
                                type: 9,
                                data: {
                                    custom_id: "tourney_play_race" + race + "_verify",
                                    title: "Verify Race " + (race + 1) + " Results",
                                    components: []
                                }
                            }
                        }
                        Object.keys(livematch.races[race].runs).map(key => {
                            modal.data.data.components.push(
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "time" + key,
                                            label: ("⏱️ " + getUsername(key) + "'s Time").substring(0, 45),
                                            style: 1,
                                            min_length: 1,
                                            max_length: 10,
                                            required: true,
                                            placeholder: "--:--.---",
                                            value: (livematch.races[race].runs[key].time.toLowerCase() == "dnf" ? "DNF" : tools.timefix(livematch.races[race].runs[key].time))
                                        }
                                    ]
                                }
                            )
                            modal.data.data.components.push(
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 4,
                                            custom_id: "deaths" + key,
                                            label: ("💀 " + getUsername(key) + "'s Deaths").substring(0, 45),
                                            style: 1,
                                            min_length: 0,
                                            max_length: 2,
                                            required: false,
                                            value: livematch.races[race].runs[key].deaths
                                        }
                                    ]
                                }
                            )
                        })
                        client.api.interactions(interaction.id, interaction.token).callback.post(modal)
                    } else {
                        interaction.reply({ content: "Only commentators/trackers can verify match times. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    }
                }
                verify()
            }
        } else if (args[2] == "restart") {
            if (!Object.values(livematch.commentators).includes(member)) {
                interaction.reply({ content: "Only commentators/trackers can restart a race. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            }
            livematchref.child("races").child(race).child("live").set(false)
            Object.keys(livematch.races[race].ready).map(key => {
                livematchref.child("races").child(race).child("ready").child(key).set(false)
            })
            interaction.update({
                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed(race)],
                components: [raceComponents(race)]
            })
        }
    }

    livematchref.off('value')
    userref.off('value')
    tourney_rulesets.off('value')
    //a tourney cancel command can be used by an admin to cancel a match
    /*
    Update profile
    country flag
    set platform
    set pronouns
    appropriate nicknames/pronunciation
    */
}