const Discord = require('discord.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { initializeMatch, adminEmbed, setupEmbed, setupComponents, adminComponents, matchMakerEmbed, colorEmbed, getUsername, rulesetOverviewEmbed, reminderEmbed, firstEmbed, firstComponents, firstbanComponents, colorComponents, firstbanEmbed, getOpponent, raceEmbed, raceComponents, countDown, getWinner, matchSummaryEmbed, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents, profileComponents } = require('./functions.js')
const { initializeUser, manageTruguts } = require('../challenge/functions.js');
const { planets, tracks } = require('../../data.js')
const { trackgroups } = require('./data.js')
const { timetoSeconds, timefix } = require('../../tools.js');
const { editMessage } = require('../../discord_message.js');
const {betEmbed, betComponents} = require('../trugut_functions.js')

exports.play = async function (args, interaction, database) {

    const Guild = interaction.guild
    const Member = interaction.member
    const name = interaction.member.displayName
    //const avatar = await interaction.member.displayAvatarURL()
    let member = interaction.user.id

    let livematch = {}
    let liverules

    let livematchref = database.ref('tourney/live/' + interaction.channel.id)
    livematchref.on('value', (snapshot) => {
        livematch = snapshot.val()
    }, (error) => {
        console.log('the read failed: ' + error.name)
    })
    let userref = database.ref('users');
    let userdata = {}
    userref.on("value", function (snapshot) {
        userdata = snapshot.val();
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

    let tourney_bets = database.ref('tourney/bets')
    let betsdata = {}
    tourney_bets.on("value", function (snapshot) {
        betsdata = snapshot.val();
    }, function (errorObject) {
        console.log("The read failed: " + errorObject);
    });

    if (livematch?.ruleset && tourney_rulesets_data) {
        liverules = tourney_rulesets_data?.saved?.[livematch.ruleset]
    }

    //if no match, assert setup
    if ([null, undefined, ""].includes(livematch)) {
        args[1] = "setup"
        initializeMatch(livematchref)
        //else give admin options
    } else if (interaction.isChatInputCommand()) {
        args[1] = 'admin'
        type = 4
        interaction.reply({ embeds: [adminEmbed({ livematch, tourney_tournaments_data, userdata })], components: adminComponents({ livematch, liverules }), ephemeral: true })
        return
    }

    //find player in userbase
    let player = null
    Object.keys(userdata).forEach(key => {
        if (userdata[key]?.discordID == member) {
            player = key
            return
        }
    })
    if (!player) {
        player = initializeUser(userref, member, name)
    }
    if (args[1] == 'profile') {
        if (interaction.isModalSubmit()) {
            //parse inputs
            let bio = interaction.fields.getTextInputValue('bio')
            let flag = interaction.fields.getTextInputValue('flag').toLowerCase()
            let pronouns = interaction.fields.getTextInputValue('pronouns').toLowerCase().split("/")
            let platform = interaction.fields.getTextInputValue('platform')
            let input = interaction.fields.getTextInputValue('input')

            let pronouns_set = []
            pronouns.forEach(p => {
                let pronoun = p.toLowerCase().replaceAll(",", "").trim()
                if (pronoun.includes('they') || pronoun.includes('them') || pronoun.includes('their')) {
                    if (!pronouns_set.includes('They/Them')) {
                        pronouns_set.push('They/Them')
                    }
                } else if (pronoun.includes('she') || pronoun.includes('her') || pronoun.includes('hers')) {
                    if (!pronouns_set.includes('She/Her')) {
                        pronouns_set.push('She/Her')
                    }
                } else if (pronoun.includes('he') || pronoun.includes('him') || pronoun.includes('his')) {
                    if (!pronouns_set.includes('He/Him')) {
                        pronouns_set.push('He/Him')
                    }

                }
            })

            userref.child(player).update(
                {
                    bio,
                    country: flag,
                    pronouns: pronouns_set,
                    platform,
                    input
                })
            interaction.update({ embeds: [matchMakerEmbed({ livematch, tourney_tournaments_data, tourney_rulesets_data, userdata })], components: profileComponents() })
        } else {
            const submitModal = new ModalBuilder()
                .setCustomId("tourney_play_profile")
                .setTitle("Update Profile Info")
            //.setValue()
            const Flag = new TextInputBuilder()
                .setCustomId("flag")
                .setLabel("Country Code")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('two letter code')
                .setMaxLength(2)
                .setRequired(false)
            if (userdata[player].country) {
                Flag.setValue(userdata[player].country)
            }
            const Pronouns = new TextInputBuilder()
                .setCustomId("pronouns")
                .setLabel("Pronouns")
                .setPlaceholder('he/she/they')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(50)
                .setRequired(false)
            if (userdata[player].pronouns) {
                Pronouns.setValue(Object.values(userdata[player].pronouns).join(", "))
            }
            const Platform = new TextInputBuilder()
                .setCustomId("platform")
                .setLabel("Platform")
                .setPlaceholder('pc/switch/ps4/xbox')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50)
                .setValue(userdata[player].platform ?? "")
            const Input = new TextInputBuilder()
                .setCustomId("input")
                .setLabel("Input Method")
                .setPlaceholder('keyboard/xbox controller')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50)
                .setValue(userdata[player].input ?? "")
            const Bio = new TextInputBuilder()
                .setCustomId("bio")
                .setLabel("Bio")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Just who is this mysterious podracer?')
                .setRequired(false)
                .setMaxLength(500)
                .setValue(userdata[player].bio ?? "")
            const ActionRow1 = new ActionRowBuilder().addComponents(Bio)
            const ActionRow2 = new ActionRowBuilder().addComponents(Flag)
            const ActionRow3 = new ActionRowBuilder().addComponents(Pronouns)
            const ActionRow4 = new ActionRowBuilder().addComponents(Platform)
            const ActionRow5 = new ActionRowBuilder().addComponents(Input)
            submitModal.addComponents(ActionRow1, ActionRow2, ActionRow3, ActionRow4, ActionRow5)
            await interaction.showModal(submitModal)
        }

    } else if (args[1] == 'admin') {
        let status = interaction.values[0]
        if ((livematch.commentators && Object.values(livematch.commentators).includes(member)) || (interaction.guild.id == '441839750555369474' && (Member.roles.cache.some(r => r.id == '862810190072381471')) && !Object.values(livematch.players).includes(member))) {
            let race = livematch.current_race
            interaction.client.channels.cache.get(interaction.channel.id).messages.fetch({ limit: 20 }).then(messages => {
                let lastMessage = messages.filter(m => m.author.bot && m.id !== interaction.message.id).first();
                if (lastMessage) {
                    lastMessage.delete().catch(err => console.log(err));
                }
            })
            if (status == 'first') {
                livematchref.update({ races: "", firstbans: "", firstvote: "", eventstart: 0, eventend: 0, runs: "", firstcolors: "" })
                //livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
                interaction.reply({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(", "), embeds: [firstEmbed(livematch)], components: firstComponents({ liverules, livematch }) })
                livematchref.child("status").set("first")
            } else if (status == 'permaban') {
                livematchref.child('races').child('1').update({ events: "", eventstart: 0, eventend: 0, live: false })
                //livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
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
                interaction.reply({ content: "<@" + (liverules.match.permabans[0].choice == "firstloser" ? getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }) : getWinner({ race: 0, livematch })) + "> please select a permanent ban", embed: [permabanEmbed({ livematch })], components: permabanComponents({ permaban: 0, livematch, liverules }) })
            } else if (status == 'prevrace') {
                let current_race = livematch.current_race
                livematchref.child('races').child(livematch.current_race).remove()
                livematchref.child('current_race').set(current_race - 1)
                livematchref.child('races').child(current_race - 1).child('live').set(true)
                interaction.reply(
                    {
                        content: Object.values(livematch.players).filter(player => !livematch.races[current_race - 1]?.ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                        embeds: [raceEmbed({ race: current_race - 1, livematch, liverules, userdata })],
                        components: raceComponents({ race: current_race - 1, liverules, livematch })
                    })
            } else if (status == 'events') {
                let events = Object.values(liverules.race)
                livematchref.child('races').child(livematch.current_race).update({ events: "", eventstart: 0, eventend: 0, live: false })
                //livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
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
            } else if (status == 'prerace') {
                livematchref.child('races').child(livematch.current_race).update({ live: false })
                //livematchref.child('races').child(livematch.current_race).child('ready').child('commentators').set(false)
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
                interaction.reply({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed({ race, livematch, liverules, userdata })], components: raceComponents({ race, liverules, livematch }) })
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
                livematchref.child("players").child(player).set(member)
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
            interaction.update({ content: "Match was cancelled", embeds: [], components: [] })
            return
        }
        if (interaction.isChatInputCommand()) {
            interaction.reply({ embeds: [setupEmbed({ livematch, tourney_rulesets_data, tourney_tournaments_data })], components: setupComponents({ livematch, tourney_rulesets_data, tourney_tournaments_data }) })
        } else {
            interaction.update({ embeds: [setupEmbed({ livematch, tourney_rulesets_data, tourney_tournaments_data })], components: setupComponents({ livematch, tourney_rulesets_data, tourney_tournaments_data }) })
        }

    } else if (args[1] == "start") {
        if (![null, undefined, ""].includes(livematch.datetime)) {
            livematchref.child('datetime').set(Date.now())
        }
        await interaction.update({ embeds: [rulesetOverviewEmbed({ tourney_rulesets_data, livematch }), reminderEmbed()], components: [] })
        await interaction.followUp({ embeds: [matchMakerEmbed({ livematch, tourney_tournaments_data, tourney_rulesets_data, userdata })], components: profileComponents() })
        interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(", "), embeds: [firstEmbed(livematch)], components: firstComponents({ liverules, livematch }) })
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
            livematchref.child("races").child("0").update(race_object)
        }
        if (args[2] == 'start') {
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
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "❗ Countown starts as soon as both players ready", embeds: [raceEmbed({ race: 0, livematch, liverules, userdata })], components: raceComponents({ race: 0, liverules, livematch }) })
                }, 3000)
            } else {
                interaction.update({ content: 'Please select a track', components: firstbanComponents({ livematch, liverules }) })
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
                    embeds: [firstEmbed(livematch)],
                    components: firstComponents({ liverules, livematch })
                }
            )
        } else if (args[2] == "color") {
            content = Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + "\n*I just happen to have a chancecube here...*"
            if (["red", "blue"].includes(args[3])) {
                Object.values(livematch.players).forEach(player => {
                    livematchref.child("firstcolors").child(player).set(player == member ? args[3] : args[3] == "red" ? "blue" : "red")
                })
                //await interaction.update({ embeds: [colorEmbed(livematch)], components: [] })
                await interaction.update({ content: "Rolling a chance cube... <a:OovoDoor:964369275559223306>", embeds: [colorEmbed(livematch)], components: [] })
                setTimeout(async function () {
                    let players = Object.keys(livematch.firstcolors)
                    let firstplayer = Math.floor(Math.random() * 2) == 1 ? players[1] : players[0]
                    livematchref.child("firstplayer").set(firstplayer)
                    interaction.followUp(":" + livematch.firstcolors[firstplayer] + "_square:")
                }, 1000)
                setTimeout(async function () {
                    interaction.followUp({ content: "<@" + (livematch.firstmethod == "poe_t" ? getOpponent({ livematch, player: livematch.firstplayer }) : livematch.firstplayer) + "> goes first!", embeds: [firstbanEmbed({ livematch })], components: firstbanComponents({ livematch, liverules }) })
                }, 2000)
                return
            }
            interaction.update({ content, embeds: [colorEmbed()], components: colorComponents() })
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
                if (member !== turn.current_turn) {
                    interaction.reply({ content: "It's not your turn to ban! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    return
                }
                livematchref.child("firstbans").push({ player: member, ban: interaction.values[0] })
                if (turn.options.length == 2) {
                    turn.options = turn.options.filter(t => Number(t) !== Number(interaction.values[0]))
                    setRace(turn.options[0])
                    await interaction.update({ content: "", embeds: [firstbanEmbed({ livematch })], components: [] })
                    interaction.followUp({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed({ race: 0, livematch, liverules, userdata })], components: raceComponents({ race: 0, liverules, livematch }) })
                } else {
                    let turn = whoseTurn()
                    interaction.update({ content: "<@" + turn.current_turn + "> please make a selection", embeds: [firstbanEmbed({ livematch })], components: firstbanComponents({ livematch, liverules }) })
                }
            }
        } else if (args[2] == 'pick') {
            let firsttrack = interaction.values[0]
            setRace(firsttrack)
            interaction.update({ content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(player => "<@" + player + ">").join(" "), embeds: [raceEmbed({ race: 0, livematch, liverules, userdata })], components: raceComponents({ race: 0, liverules, livematch }) })
        }
    } else if (args[1].includes("permaban")) {
        if (!Object.values(livematch.players).includes(member)) {
            interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
        }
        livematchref.child("status").set("permaban")
        let permaban_num = Number(args[2])
        let permaban = liverules.match.permabans[permaban_num]
        if ((permaban.choice == "firstwinner" && member == getWinner({ race: 0, livematch })) || (permaban.choice == "firstloser" && member == getOpponent({ livematch, player: getWinner({ race: 0, livematch }) }))) {
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
                interaction.update({ content: "<@" + (events[0].choice == "lastwinner" ? getWinner({ race: 0, livematch }) : getOpponent({ livematch, player: getWinner({ race: 0, livematch }) })) + "> please make a selection", embeds: [raceEventEmbed({ race: 1, livematch, liverules })], components: raceEventComponents({ race: 1, livematch, interaction, liverules }) })
            } else {
                interaction.update({ content: "<@" + (liverules.match.permabans[permaban_num + 1].choice == 'firstwinner' ? getWinner({ race: 0, livematch }) : getOpponent({ livematch, player: getWinner({ race: 0, livematch }) })) + ">", embeds: [permabanEmbed({ livematch })], components: permabanComponents({ permaban: permaban_num + 1, livematch, liverules }) })
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
            if (member == (e.choice == "lastwinner" ? getWinner({ race: race - 1, livematch }) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) }))) {
                livematchref.child("status").set("events")
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
                        console.log(eventend + ", " + events.length)
                        interaction.update({
                            content: "<@" + (events[event].choice == "lastwinner" ? getWinner({ race: race - 1, livematch }) : getOpponent({ livematch, player: getWinner({ race: race - 1, livematch }) })) + "> please make a selection" + (eventend + 1 == events.length ? "\n*Once this selection is submitted, the warmup timer begins (2 minutes for full track, 3 minutes for skips)*" : ""),
                            embeds: [raceEventEmbed({ race, livematch, liverules })],
                            components: raceEventComponents({ race, livematch, interaction, liverules })
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
                        let countdown = 2.5 * 60 * 1000 + (Object.values(livematch.races[race].events).map(e => e.selection).includes('sk') ? 1000 * 60 : 0)
                        livematchref.child('races').child(race).child('countdown').set(Math.round((Date.now() + countdown) / 1000))
                        await interaction.update({ content: "", embeds: [raceEventEmbed({ race, livematch, liverules })], components: [] })
                        let rE = await interaction.followUp({
                            content: Object.values(livematch.players).map(player => "<@" + player + ">").join(" ") + " Countdown begins <t:" + livematch.races[race].countdown + ":R>",
                            embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                            components: raceComponents({ race, liverules, livematch }),
                            fetchReply: true
                        })
                        livematchref.child("status").set("prerace")
                        Object.values(livematch.players).forEach(player => {
                            livematchref.child('races').child(race).child('ready').child(player).set(true)
                        })

                        //autocountdown
                        setTimeout(async function () {
                            interaction.followUp({ content: "Countdown starts <t:" + livematch.races[race].countdown + ":R>!" })
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
                                livematchref.child("status").set("midrace")
                                countDown(interaction)
                                //initiate race
                                await livematchref.child("races").child(race).child("live").set(true)
                                await livematchref.child("races").child(race).child("countdown").remove()
                                setTimeout(async function () {
                                    interaction.followUp({ embeds: [raceEmbed({ race, livematch, liverules, userdata })], components: raceComponents({ race, liverules, livematch }) })
                                }, 10000)
                            }
                        }, countdown)
                    } else {
                        livematchref.child("races").child(race).update({ eventstart: eventend + 1, eventend: eventend + 1 + streak })
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
            if (!Object.values(livematch.players).includes(member) && !Object.values(livematch.commentators).includes(member)) {
                interaction.reply({ content: "You are not a player or commentator!", ephemeral: true })
                return
            }
            Object.values(livematch.players).forEach(player => {
                livematchref.child('races').child(race).child('ready').child(player).set(false)
            })
            await livematchref.child('races').child(race).child('countdown').remove()
            await interaction.update({
                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                components: raceComponents({ race, liverules, livematch })
            })
            interaction.followUp({ content: '<@' + member + '> aborted the countdown. Once both players click READY, the countdown will begin.' })
        } else if (["ready", "unready"].includes(args[2])) {
            if (Object.values(livematch.players).includes(member) && ![undefined, null, ""].includes(livematch.races[race].runs) && ![undefined, null, ""].includes(livematch.races[race].runs[member]) && ![undefined, null, ""].includes(livematch.races[race].runs[member].pod)) {
                livematchref.child("races").child(race).child("ready").child(member).set((args[2] == "ready" ? true : false))
                if (Object.values(livematch.races[race].ready).filter(r => r == false).length == 0) {
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
                        interaction.followUp({ embeds: [raceEmbed({ race, livematch, liverules, userdata })], components: raceComponents({ race, liverules, livematch }) })
                    }, 10000)
                } else {
                    await interaction.update({
                        content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                        embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                        components: raceComponents({ race, liverules, livematch })
                    })
                }
            } else if (Object.values(livematch.players).includes(member)) {
                interaction.reply({ content: "You have not selected a racer yet! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            } else {
                interaction.reply({ content: "You are not a player!", ephemeral: true })
                return
            }

        } else if (args[2] == 'gents') {
            if (!Object.values(livematch.players).includes(member)) {
                interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            }

            if (interaction.isModalSubmit()) {
                let terms = interaction.fields.getTextInputValue('gents').trim()
                livematchref.child('races').child(race).child('gents').set({ terms: terms, player: member, agreed: "?" })
                interaction.update({
                    content: "<@" + getOpponent({ livematch, player: member }) + "> do you accept the terms of the proposed 🎩 **Gentlemen's Agreement**?\n*" + terms + "*",
                    embeds: [raceEmbed({ race, livematch, liverules, userdata })],
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
                    if (member == getOpponent({ livematch, player: livematch.races[race].gents?.player })) {
                        if (args[3] == 'true') {
                            livematchref.child('races').child(race).child('gents').update({ agreed: true })
                        } else {
                            livematchref.child('races').child(race).child('gents').remove()
                        }
                        interaction.update({
                            content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" ") + " " + Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" "),
                            embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                            components: raceComponents({ race, liverules, livematch })
                        })
                    } else {
                        interaction.reply({ content: "Not you! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    }
                }
            }
        } else if (args[2] == "racer") {
            if (Object.values(livematch.players).includes(member)) {
                livematchref.child("races").child(race).child("runs").child(member).child("pod").set(interaction.values[0])
            }
            interaction.update({
                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                components: raceComponents({ race, liverules, livematch })
            })
        } else if (args[2] == "reveal") {
            if (Object.values(livematch.players).includes(member)) {
                livematchref.child("races").child(race).child("reveal").child(member).set(true)
            }
            interaction.update({
                content: Object.values(livematch.players).filter(player => !livematch.races[race].ready[player]).map(player => "<@" + player + ">").join(" "),
                embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                components: raceComponents({ race, liverules, livematch })
            })
        } else if (args[2] == "submit") {
            if (!Object.values(livematch.players).includes(member)) {
                interaction.reply({ content: "You're not a player! <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                return
            }
            if (interaction.isModalSubmit()) {
                if (!livematch.races[race].live) {
                    interaction.reply({ content: "Race is no longer live. <:WhyNobodyBuy:589481340957753363>", ephemeral: true })
                    return
                }
                let submittime = interaction.fields.getTextInputValue('time')
                if (submittime.toLowerCase() !== 'dnf' && (isNaN(Number(submittime.replace(":", ""))) || timetoSeconds(submittime) == null)) { //time doesn't make sense
                    const holdUp = new EmbedBuilder()
                        .setTitle("<:WhyNobodyBuy:589481340957753363> Time Does Not Compute")
                        .setDescription("Your time was submitted in an incorrect format.")
                    interaction.reply({ embeds: [holdUp], ephemeral: true })
                    return
                }
                livematchref.child("races").child(race).child("runs").child(member).update(
                    {
                        time: (interaction.fields.getTextInputValue('time').toLowerCase() == 'dnf' ? 'DNF' : timetoSeconds(interaction.fields.getTextInputValue('time')) == null ? "DNF" : timetoSeconds(interaction.fields.getTextInputValue('time').trim())),
                        deaths: isNaN(Number(interaction.fields.getTextInputValue('deaths'))) ? '' : Number(interaction.fields.getTextInputValue('deaths')),
                        notes: interaction.fields.getTextInputValue('notes').trim(),
                        player: member
                    }
                )
                interaction.update({
                    content: Object.values(livematch.races[race].runs).map(run => run.time).filter(time => time == "").length == 0 ? Object.values(livematch.commentators).map(comm => "<@" + comm + ">").join(" ") : "",
                    embeds: [raceEmbed({ race, livematch, liverules, userdata })],
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
                    .setValue((String(livematch.races[race].runs[member]?.time).toLowerCase() == 'dnf' ? 'DNF' : (livematch.races[race].runs[member].time == "" ? "" : timefix(livematch.races[race].runs[member].time))))
                const Deaths = new TextInputBuilder()
                    .setCustomId("deaths")
                    .setLabel("💀 Deaths (leave blank if unsure)")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(0)
                    .setMaxLength(2)
                    .setRequired(false)
                    .setValue(livematch.races[race].runs[member].deaths)
                const Notes = new TextInputBuilder()
                    .setCustomId("notes")
                    .setLabel("📝 Notes")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
                    .setValue(livematch.races[race].runs[member].notes)
                const ActionRow1 = new ActionRowBuilder().addComponents(Time)
                const ActionRow2 = new ActionRowBuilder().addComponents(Deaths)
                const ActionRow3 = new ActionRowBuilder().addComponents(Notes)
                submitModal.addComponents(ActionRow1, ActionRow2, ActionRow3)
                await interaction.showModal(submitModal)
            }
        } else if (args[2] == "verify") {
            if (interaction.isModalSubmit()) {
                Object.keys(livematch.races[race].runs).map(key => {
                    livematchref.child("races").child(race).child("runs").child(key).update(
                        {
                            time: (interaction.fields.getTextInputValue('time' + key).toLowerCase() == 'dnf' ? 'DNF' : timetoSeconds(interaction.fields.getTextInputValue('time' + key))),
                            deaths: (interaction.fields.getTextInputValue('deaths' + key) == "" ? "" : Number(interaction.fields.getTextInputValue('deaths' + key)))
                        }
                    )
                })

                livematchref.child("races").child(race).child("live").set(false)
                await interaction.update({
                    content: "",
                    embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                    components: []
                })
                interaction.followUp({ embeds: [matchSummaryEmbed({ liverules, livematch, userdata })] })

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
                let wincondition = false
                await Object.keys(scoreboard).forEach(async player => {
                    if (scoreboard[player] == liverules.general.winlimit) {
                        //win condition
                        const postRef = await database.ref('tourney/matches').push(livematch)
                        const winEmbed = new EmbedBuilder()
                            .setAuthor({ name: "Match Concluded" })
                            .setTitle(getUsername({ member: player, userdata, short: true }) + " Wins!")
                            .setDescription("GGs, racers! The match has been saved.\nCheck out the full match summary [here](https://botto-efbfd.web.app/tournaments/matches/" + postRef.key + ")\n<@&970995237952569404> role will be automatically removed in 15 minutes")
                            .addFields({ name: ":microphone2: Commentators/Trackers", value: ":orange_circle: Don't forget to click 'Episode Finished' after the interviews" })
                        interaction.followUp({ embeds: [winEmbed] })
                        wincondition = true

                        //handle bet
                        if (livematch?.bet) {
                            let bet = betdata[livematch.bet]
                            bet.status = 'complete'
                            ['a', 'b'].forEach(a => {
                                bet[`outcome_${a}`].winner = (bet[`outcome_${a}`].id == player)
                            })
                            //handle truguts
                            let totals = {
                                a: bet.outcome_a.bets ? bet.outcome_a.bets.map(b => b.amount).reduce((a, b) => a + b) : 0,
                                b: bet.outcome_b.bets ? bet.outcome_b.bets.map(b => b.amount).reduce((a, b) => a + b) : 0
                            }
                            ['a', 'b'].forEach(x => {
                                let outcome = bet['outcome_' + x]
                                let opposite = x == 'a' ? 'b' : 'a'
                                if (outcome.bets) {
                                    outcome.bets.forEach(b => {
                                        if (outcome.winner) {
                                            let take = Math.round((b.amount / totals[x]) * totals[opposite])
                                            manageTruguts({ profile: userdata[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'd', amount: take })
                                            b.take = take
                                        } else {
                                            manageTruguts({ profile: userdata[b.id].random, profileref: userref.child(b.id).child('random'), transaction: 'w', amount: b.amount })
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
                    }
                })
                if (!wincondition) {
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
                    livematchref.child('races').child(nextrace).update(race_object)
                    livematchref.child("status").set("events")
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
                if (Object.values(livematch.commentators).includes(member) || (interaction.guild.id == '441839750555369474' && Member.roles.cache.some(r => r.id == '862810190072381471') && !Object.values(livematch.players).includes(member))) {
                    const verifyModal = new ModalBuilder()
                        .setCustomId("tourney_play_race" + race + "_verify")
                        .setTitle("Verify Race " + (race + 1) + " Results")
                    Object.keys(livematch.races[race].runs).map(key => {
                        let time = new TextInputBuilder()
                            .setCustomId("time" + key)
                            .setLabel(("⏱️ " + getUsername({ member: key, userdata, short: true }) + "'s Time").substring(0, 45))
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder("--:--.---")
                            .setMinLength(1)
                            .setMaxLength(10)
                            .setRequired(true)
                            .setValue(String((livematch.races[race].runs[key].time.toLowerCase() == "dnf" ? "DNF" : timefix(livematch.races[race].runs[key].time))))
                        let deaths = new TextInputBuilder()
                            .setCustomId("deaths" + key)
                            .setLabel(("💀 " + getUsername({ member: key, userdata, short: true }) + "'s Deaths").substring(0, 45))
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(0)
                            .setMaxLength(10)
                            .setRequired(false)
                        if (livematch.races[race].runs[key].deaths) {
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
                embeds: [raceEmbed({ race, livematch, liverules, userdata })],
                components: raceComponents({ race, liverules, livematch })
            })
        }
    }

    //livematchref.off('value')
    //userref.off('value')
    //tourney_rulesets.off('value')
    //a tourney cancel command can be used by an admin to cancel a match
    /*
    Update profile
    country flag
    set platform/input
    set input
    set pronouns
    appropriate nicknames/pronunciation
    */
}