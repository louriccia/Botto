module.exports = {
    name: 'tourney',
    execute(client, interaction, args) {
        const tools = require('./../tools.js');
        const Discord = require('discord.js');
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");
        var tourney_races = database.ref('tourney/races');
        var tourney_races_data = {}, tourney_matches_data = {}, tourney_participants_data = {}, tourney_tournaments_data = {}
        tourney_races.on("value", function (snapshot) {
            tourney_races_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var tourney_matches = database.ref('tourney/matches')
        tourney_matches.on("value", function (snapshot) {
            tourney_matches_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var tourney_participants = database.ref('tourney/participants')
        tourney_participants.on("value", function (snapshot) {
            tourney_participants_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var tourney_tournaments = database.ref('tourney/tournaments')
        tourney_tournaments.on("value", function (snapshot) {
            tourney_tournaments_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        const tourneyReport = new Discord.MessageEmbed()
            .setURL("https://docs.google.com/spreadsheets/d/1ZyzBNOVxJ5PMyKsqHmzF4kV_6pKAJyRdk3xjkZP_6mU/edit?usp=sharing")
        if (args[0].name == "leaderboards") {
            var trak = null
            var podfilterout = []
            var podfilterin = []
            var showall = false
            var desc = []
            var skips = null, nu = null, deaths = null, player = null, tourney = null, quali = false
            //filters out other tracks
            for (let i = 0; i < args[0].options.length; i++) {
                if (args[0].options[i].name == "track") {
                    trak = Number(args[0].options[i].value)
                    tourneyReport
                        .setTitle(tracks[trak].name + " | Tournament Times")
                        .setColor(planets[tracks[trak].planet].color)
                } else if (args[0].options[i].name == "skips") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "skips") {
                        skips = true
                        desc.push("Skips")
                    } else if (input == "ft") {
                        skips = false
                        desc.push("Full Track")
                    }
                } else if (args[0].options[i].name == "upgrades") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "mu") {
                        nu = false
                        desc.push("Upgrades")
                    } else if (input == "nu") {
                        nu = true
                        desc.push("No Upgrades")
                    }
                } else if (args[0].options[i].name == "pod") {
                    var input = args[0].options[i].value.toLowerCase()
                    var podfilter = args[0].options[i].value.split(/[\s,]+/)
                    var filterin = true
                    for (var p = 0; p < podfilter.length; p++) {
                        if (podfilter[p] == "no") {
                            filterin = false
                        } else {
                            var numb = null
                            for (let q = 0; q < racers.length; q++) {
                                racers[q].nickname.forEach(nick => {
                                    if (nick.toLowerCase() == podfilter[p].toLowerCase()) {
                                        numb = q
                                        q = racers.length
                                    }
                                })
                            }
                            if (numb !== null) {
                                if (filterin) {
                                    podfilterin.push(numb)
                                    desc.push(racers[numb].name + " Only")
                                } else {
                                    podfilterout.push(numb)
                                    desc.push("No " + racers[numb].name)
                                }
                            }
                        }
                    }
                } else if (args[0].options[i].name == "deaths") {
                    var input = args[0].options[i].value.toLowerCase()
                    if (input == "deaths") {
                        deaths = true
                        desc.push("Deaths")
                    } else if (input == "deathless") {
                        deaths = false
                        desc.push("Deathless")
                    }
                } else if (args[0].options[i].name == "tourney") {
                    tourney = args[0].options[i].value
                    desc.push(tourney_tournaments_data[args[0].options[i].value].name)
                } else if (args[0].options[i].name == "quali") {
                    quali = args[0].options[i].value
                } else if (args[0].options[i].name == "player") {
                    player = args[0].options[i].value
                    showall = true
                    const Guild = client.guilds.cache.get(interaction.guild_id);
                    const Member = Guild.members.cache.get(player)
                    tourneyReport.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guild_id).members.resolve(player).user.avatarURL())
                }
            }
            var runs = []
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
            var rns = Object.keys(tourney_races_data)
            for (var i = 0; i < rns.length; i++) {
                var r = tourney_races_data[rns[i]]
                if (r.track == trak && r.hasOwnProperty("totaltime")) {
                    runs.push(r)
                }
            }
            if (skips) {
                runs = runs.filter(e => e.force == "Skips")
            } else if (!skips && skips !== null) {
                runs = runs.filter(e => e.force !== "Skips")
            }
            if (nu) {
                runs = runs.filter(e => e.force == "NU")
            } else if (!nu && nu !== null) {
                runs = runs.filter(e => e.force !== "NU")
            }
            if (podfilterin.length > 0) {
                runs = runs.filter(e => podfilterin.includes(e.pod))
            }
            if (podfilterout.length > 0) {
                runs = runs.filter(e => !podfilterout.includes(e.pod))
            }
            if (deaths) {
                runs = runs.filter(e => e.totaldeaths > 0)
            } else if (!deaths && deaths !== null) {
                runs = runs.filter(e => e.totaldeaths == 0)
            }
            if (tourney !== null) {
                runs = runs.filter(e => tourney_matches_data[e.datetime].tourney == tourney)
            }
            if (player !== null) {
                runs = runs.filter(e => tourney_participants_data[e.player].id == player)
            }
            if (quali === false) {
                runs = runs.filter(e => tourney_matches_data[e.datetime].bracket !== "Qual")
            }
            var already = []
            runs.sort(function (a, b) {
                return Number(a.totaltime) - Number(b.totaltime);
            })
            if (runs.length > 0) {
                runs = runs.sort(function (a, b) {
                    return Number(a.totaltime) - Number(b.totaltime);
                })
                for (i = 0; i < runs.length; i++) {
                    if (runs[i].hasOwnProperty("totaltime") && !already.includes(runs[i].player + runs[i].force)) {
                        var character = ""
                        var deaths = ""
                        var characterban = ""
                        var link = ""
                        var forc = "MU "
                        var opponent = ""
                        var bracket = ""
                        if (runs[i].hasOwnProperty("force")) {
                            if (runs[i].force == "Skips") {
                                forc = "Skips "
                            } else if (runs[i].force == "NU") {
                                forc = "NU "
                            }
                        }
                        link = tourney_matches_data[runs[i].datetime].url
                        if (runs[i].hasOwnProperty("podtempban")) {
                            if (runs[i].podtempban !== "") {
                                characterban = "\n~~" + racers[runs[i].podtempban].name + "~~"
                            }
                        }
                        if (runs[i].hasOwnProperty("opponent")) {
                            opponent = " vs " + tourney_participants_data[runs[i].opponent].name
                        }
                        if (runs[i].totaldeaths > 0) {
                            if (runs[i].totaldeaths > 1) {
                                deaths = ":skull:×" + runs[i].totaldeaths
                            } else {
                                deaths = ":skull:"
                            }
                        }
                        if (![undefined, "", null].includes(tourney_matches_data[runs[i].datetime].bracket)) {
                            bracket = " | " + tourney_matches_data[runs[i].datetime].bracket
                            if (![undefined, "", null].includes(tourney_matches_data[runs[i].datetime].round)) {
                                bracket += ": " + tourney_matches_data[runs[i].datetime].round
                            }
                        }
                        character = racers[runs[i].pod].flag
                        tourneyReport
                            .addField(pos[0] + " " + tourney_participants_data[runs[i].player].name, tourney_tournaments_data[tourney_matches_data[runs[i].datetime].tourney].nickname + bracket + "\n[Race " + runs[i].race + opponent + "](" + link + ")", true)
                            .addField(tools.timefix(Number(runs[i].totaltime).toFixed(3)), " " + character + " " + forc + " " + deaths + characterban, true)
                            .addField('\u200B', '\u200B', true)
                            .setDescription(desc.join(', ') + " `[" + runs.length + " Total Runs]`")
                        already.push(runs[i].player + runs[i].force)
                        pos.splice(0, 1)
                        if (pos.length == 0) {
                            i = runs.length
                        }
                    }
                }
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            //content: "",
                            embeds: [tourneyReport]
                        }
                    }
                })
            } else {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: No tournament runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)],
                            //embeds: [racerEmbed]
                        }
                    }
                })
            }

        } else if (args[0].name == "profile") {
            var member = interaction.member.user.id
            const Guild = client.guilds.cache.get(interaction.guild_id); // Getting the guild.
            const Member = Guild.members.cache.get(member); // Getting the member.
            if (args[0].hasOwnProperty("options")) {
                if (args[0].options[0].name == "participant") {
                    member = args[0].options[0].value
                }
            }
            tourneyReport
                .setAuthor(client.guilds.resolve(interaction.guild_id).members.resolve(member).user.username + "'s Profile", client.guilds.resolve(interaction.guild_id).members.resolve(member).user.avatarURL())
                .setTitle("Tournament Statistics")

            async function sendCallback() {
                const wait = client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 5,
                        data: {
                            content: "Coming right up..."
                            //embeds: [racerEmbed]
                        }
                    }
                })
                return wait
            }
            async function sendResponse(embed) {
                const response = await client.api.webhooks(client.user.id, interaction.token).messages('@original').patch({ data: { embeds: [embed] } })
                return response
            }
            sendCallback().then(() => {
                var player = null
                var tpd = Object.keys(tourney_participants_data)
                function getMost(object) {
                    var obj = Object.keys(object)
                    var most_count = 0
                    var most_name = null
                    for (i = 0; i < obj.length; i++) {
                        var o = obj[i]
                        if (object[o] > most_count && o !== undefined) {
                            most_name = o
                            most_count = object[o]
                        }
                    }
                    return most_name
                }
                function getMultipleMost(object, num){
                    var obj = Object.keys(object)
                    var array = []
                    if(obj.length > 0){
                        object.sort(function (a, b) {
                            return b - a;
                        })
                        for (i = 0; i < num; i++){
                            var o = obj[i]
                            array.push(o)
                            if(i == obj.length){i = num}
                        }
                    }
                    return array
                }
                function arraytoTracks(array){
                    var string = ""
                    for (i = 0; i < array.length; i++){
                        string += "`" + tracks[i].nickname[0] + "` "
                    }
                }
                function arraytoRacers(array){
                    var string = ""
                    for (i = 0; i < array.length; i++){
                        string += racers[i].flag + " "
                    }
                }
                function arraytoPlayers(array){
                    var string = ""
                    for (i = 0; i < array.length; i++){
                        string += "`"+tourney_participants_data[i].name + "` "
                    }
                }
                for (var i = 0; i < tpd.length; i++) {
                    var p = tpd[i]
                    if (tourney_participants_data[p].id == member) {
                        player = p
                    }
                }
                if (player !== null) {
                    var stats = {
                        race_time: 0,//
                        matches_commentated: 0, //
                        tourney_records: 0, //
                        matches: {
                            total: 0, //
                            won: 0, //
                            lost: 0 //
                        },
                        races: {
                            total: 0,//
                            won: 0,//
                            lost: 0//
                        },
                        deaths: 0,//
                        records: {
                            standard: 0,
                            skips: 0,
                            nu: 0
                        },
                        pod_bans: {},
                        forces: {
                            nu: 0,
                            skips: 0
                        },
                        co_comm: {},
                        comm_player: {},
                        track: {
                            picks: {},
                            tempbans: {},
                            permabans: {},
                            wins: {},
                            losses: {}
                        },
                        opponent: {
                            rivalries: {},
                            wins: {},
                            losses: {}
                        }
                    }
                    var tmd = Object.keys(tourney_matches_data)
                    for (var i = 0; i < tmd.length; i++) {
                        var m = tmd[i]
                        //get commentators
                        var com = Object.values(tourney_matches_data[m].commentators)
                        if (com.includes(Number(player))) {
                            stats.matches_commentated++
                            com.forEach(c => {
                                if (c !== Number(player)) {
                                    if (stats.co_comm[c] == undefined) {
                                        stats.co_comm[c] = 1
                                    } else {
                                        stats.co_comm[c]++
                                    }
                                }
                            })
                            var pla = Object.keys(tourney_matches_data[m].players)
                            for (j = 0; j < pla.length; j++) {
                                var p = tourney_matches_data[m].players[pla[j]]
                                if (stats.comm_player[p.player] == undefined) {
                                    stats.comm_player[p.player] = 1
                                } else {
                                    stats.comm_player[p.player]++
                                }
                            }
                        }
                        //get match data
                        var ply = Object.keys(tourney_matches_data[m].players)
                        var opponent_score = null
                        var opponent_player = null
                        var player_score = null
                        var played = false
                        for (var j = 0; j < ply.length; j++) {
                            var p = ply[j]
                            if (tourney_matches_data[m].players[p].player == player) {
                                stats.matches.total++
                                played = true
                                if (tourney_matches_data[m].players[p].hasOwnProperty("score")) {
                                    player_score = tourney_matches_data[m].players[p].score
                                }
                                if (tourney_matches_data[m].players[p].hasOwnProperty("permabans")){
                                    var permabans = Object.values(tourney_matches_data[m].players[p].permabans)
                                    permabans.forEach(b => {
                                        if(stats.track.tempbans[b] == undefined){
                                            stats.track.tempbans[b] = 1
                                        } else {
                                            stats.track.tempbans[b] ++
                                        }
                                    })
                                }
                            } else {
                                if (tourney_matches_data[m].players[p].hasOwnProperty("score")) {
                                    opponent_score = tourney_matches_data[m].players[p].score
                                    opponent_player = tourney_matches_data[m].players[p].player
                                }
                            }
                            if (![player_score, opponent_score].includes(null) && played) {
                                if(stats.opponent.wins[opponent_player] == undefined ){
                                    stats.opponent.wins[opponent_player] = player_score
                                } else {
                                    stats.opponent.wins[opponent_player] += player_score
                                }
                                if(stats.opponent.losses[opponent_player] == undefined ){
                                    stats.opponent.losses[opponent_player] = opponent_score
                                } else {
                                    stats.opponent.losses[opponent_player] += opponent_score
                                }
                                if (player_score > opponent_score) {
                                    stats.matches.won++
                                } else {
                                    stats.matches.lost++
                                }
                            }
                        }
                    }
                    var race_summary = {}
                    var standard_records = {}
                    var skip_records = {}
                    var nu_records = {}
                    var tourney_races_data_sorted = tourney_races_data.sort(function (a, b) {
                        return a.race - b.race;
                    })
                    var trd = Object.keys(tourney_races_data_sorted)
                    for (var i = 0; i < trd.length; i++) {
                        var r = tourney_races_data_sorted[trd[i]]
                        //get race summary
                        if (race_summary[r.datetime] == undefined) {
                            race_summary[r.datetime] = {}
                        }
                        if (race_summary[r.datetime][r.race] == undefined) {
                            race_summary[r.datetime][r.race] = {}
                        }
                        if (r.result == "Winner") {
                            race_summary[r.datetime][r.race].winner = { player: r.player }
                            if(stats.track.wins[r.track] == undefined){
                                stats.track.wins[r.track] = 1
                            } else {
                                stats.track.wins[r.track] ++
                            }
                        } else if (r.result == "Loser") {
                            race_summary[r.datetime][r.race].loser = { player: r.player }
                            if(stats.track.wins[r.track] == undefined){
                                stats.track.losses[r.track] = 1
                            } else {
                                stats.track.losses[r.track] ++
                            }
                        }
                        if (r.race > 1) {
                            if (race_summary[r.datetime][r.race - 1].hasOwnProperty("loser") || race_summary[r.datetime][r.race - 1].hasOwnProperty("winner")) {
                                if (r.hasOwnProperty("podtempban")) {
                                    race_summary[r.datetime][r.race - 1].loser.podban = r.podtempban
                                }
                                if (r.hasOwnProperty("tracktempban")) {
                                    race_summary[r.datetime][r.race - 1].winner.trackban = r.tracktempban
                                }
                                race_summary[r.datetime][r.race - 1].loser.trackpick = r.track
                                if (r.hasOwnProperty("force")) {
                                    race_summary[r.datetime][r.race - 1].loser.force = r.force
                                }
                            }
                        }
                        //get records
                        if (tourney_matches_data[r.datetime].bracket !== "Qual") {
                            if (r.force !== "") {
                                if (r.force == "Skips") {
                                    if (skip_records[r.track] == undefined && r.totaltime !== "") {
                                        skip_records[r.track] = { time: r.totaltime, player: r.player }
                                    } else if (r.totaltime !== "" && r.totaltime < skip_records[r.track].time) {
                                        skip_records[r.track] = { time: r.totaltime, player: r.player }
                                    }
                                } else if (r.force == "NU") {
                                    if (nu_records[r.track] == undefined && r.totaltime !== "") {
                                        nu_records[r.track] = { time: r.totaltime, player: r.player }
                                    } else if (r.totaltime !== "" && r.totaltime < nu_records[r.track].time) {
                                        nu_records[r.track] = { time: r.totaltime, player: r.player }
                                    }
                                }
                            } else {
                                if (standard_records[r.track] == undefined && r.totaltime !== "") {
                                    standard_records[r.track] = { time: r.totaltime, player: r.player }
                                } else if (r.totaltime !== "" && r.totaltime < standard_records[r.track].time) {
                                    standard_records[r.track] = { time: r.totaltime, player: r.player }
                                }
                            }
                        }
                        //get player stats
                        if (r.player == player) {
                            stats.races.total++
                            if (r.hasOwnProperty("totaltime")) {
                                stats.race_time += r.totaltime
                            }
                            if (r.hasOwnProperty("totaldeaths")) {
                                stats.deaths += r.totaldeaths
                            }
                            if (r.hasOwnProperty("result")) {
                                if (r.result == "Winner") {
                                    stats.races.won++
                                } else if (r.result == "Loser") {
                                    stats.races.lost++
                                }
                            }
                        }
                    }
                    //calculate player's records
                    var rec = Object.keys(standard_records)
                    for (i = 0; i < rec.length; i++) {
                        var r = standard_records[rec[i]]
                        if (r.player == player) {
                            stats.records.standard++
                        }
                    }
                    var rec = Object.keys(skip_records)
                    for (i = 0; i < rec.length; i++) {
                        var r = skip_records[rec[i]]
                        if (r.player == player) {
                            stats.records.skips++
                        }
                    }
                    var rec = Object.keys(nu_records)
                    for (i = 0; i < rec.length; i++) {
                        var r = nu_records[rec[i]]
                        if (r.player == player) {
                            stats.records.nu++
                        }
                    }
                    //get stats from race summaries
                    var rsm = Object.keys(race_summary)
                    for (i = 0; i < rsm.length; i++) {
                        var m = race_summary[rsm[i]]
                        var races = Object.values(m)
                        races.forEach(e => {
                            if (e.hasOwnProperty("winner")) {
                                if (e.winner.player == player) {
                                    if (e.winner.hasOwnProperty("tracktempban")) {
                                        if (stats.track.tempbans[e.winner.trackban] == undefined) {
                                            stats.track.tempbans[e.winner.trackban] = 1
                                        } else {
                                            stats.track.tempbans[e.winner.trackban]++
                                        }
                                    }
                                } else if (e.loser.player == player) {
                                    if (e.loser.hasOwnProperty("podtempban")) {
                                        if (stats.pod_bans[e.loser.podtempban] == undefined) {
                                            stats.pod_bans[e.loser.podtempban] = 1
                                        } else {
                                            stats.pod_bans[e.loser.podtempban]++
                                        }
                                    }
                                    if (e.loser.hasOwnProperty("force")) {
                                        if (e.loser.force == "Skips") {
                                            stats.forces.skips++
                                        } else if (e.loser.force == "NU") {
                                            stats.forces.nu++
                                        }
                                    }
                                    if (stats.track.picks[e.loser.trackpick] == undefined) {
                                        stats.track.picks[e.loser.trackpick] = 1
                                    } else {
                                        stats.track.picks[e.loser.trackpick]++
                                    }
                                }
                            }
                        }
                        )
                    }
                    console.log(stats)
                    console.log(getMost(stats.co_comm))
                    tourneyReport
                        .setDescription("Total race time: `" + tools.timefix(stats.race_time) + "`")
                        .addField(":crossed_swords: Matches", "total: `" + stats.matches.total + "`\n" +
                            "wins: `" + stats.matches.won + "`\n" +
                            "losses: `" + stats.matches.lost + "`", true)
                        .addField(":checkered_flag: Races", "total: `" + stats.races.total + "`\n" +
                            "wins: `" + stats.races.won + "`\n" +
                            "losses: `" + stats.races.lost + "`", true)
                        .addField(":skull: Deaths", "total: `" + stats.deaths + "`\n" +
                            "avg: `" + (stats.deaths / stats.races.total).toFixed(1) + "/race`", true)

                        .addField(":trophy: Records", "standard: `" + stats.records.standard + "`\n" +
                            "skips: `" + stats.records.skips + "`\n" +
                            "nu: `" + stats.records.nu + "`", true)
                        .addField(":asterisk: Forces", "total: `" + (stats.forces.nu + stats.forces.skips) + "`\n" +
                            "skips: `" + stats.forces.skips + "`\n" +
                            "nu: `" + stats.forces.nu + "`", true)
                        .addField(":microphone2: Commentary", "total: `" + stats.matches_commentated + "`\n" +
                            "fav. co-comm: `" + tourney_participants_data[getMost(stats.co_comm)].name + "`\n" +
                            "fav. player: `" + tourney_participants_data[getMost(stats.comm_player)].name + "`", true)

                        .addField(":triangular_flag_on_post: Tracks", "most picked:\n" + arraytoTracks(getMultipleMost(stats.track.picks, 3)) + "\n" +
                            "most wins:\n" + arraytoTracks(getMultipleMost(stats.track.wins, 3)) +"\n" +
                            "most losses:\n" + arraytoTracks(getMultipleMost(stats.track.losses, 3)) , true)
                        .addField(":no_entry_sign: Bans", "most temp-banned:\n" + arraytoTracks(getMultipleMost(stats.track.tempbans, 3)) + "\n" +
                            arraytoRacers(getMultipleMost(stats.pod_bans, 3)) + "\n" +
                            "most perma-banned:\n" + arraytoTracks(getMultipleMost(stats.track.permabans, 3)), true)
                        .addField(":vs: Opponents", "closest rivals:\n" + "\n" +
                            "most wins vs:\n" + arraytoPlayers(getMultipleMost(stats.opponent.wins, 2))+ "\n" +
                            "most losses vs:\n" + arraytoPlayers(getMultipleMost(stats.opponent.losses, 2)), true)
                    
                    return tourneyReport
                } else {
                    //user has not participated in a tournament
                }
            }).then((embed) => sendResponse(embed))
        }
    }
}


