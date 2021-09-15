const fs = require('fs');
const lookup = require("./data.js");
let runs = JSON.parse(fs.readFileSync("botto-efbfd-races-export.json", "utf8"));
let matches = JSON.parse(fs.readFileSync("botto-efbfd-matches-export.json", "utf8"));
let matches_more = JSON.parse(fs.readFileSync("2021_matches_updated.json", "utf8"));
var tools = require('./tools.js');

var match = "", race = "", pod_ban = "", track_ban = "", force_1 = "", force_2 = "", force_3 = "", track = ""
function findPod(pod) {
    for (i = 0; i < racers.length; i++) {
        if (racers[i].name == pod.replace("Bullseye", "'Bullseye'").replace("\"Bumpy\"", "'Bumpy'")) {
            return i
        }
    }
    console.log("couldn't find " + pod)
}
function findTrack(track) {
    for (i = 0; i < tracks.length; i++) {
        if (tracks[i].name == track.replace("Boonta Training Course", "The Boonta Training Course")) {
            return i
        }
    }
    console.log("couldn't find " + track)
}
function findForce(force) {
    if (force == "Skips") {
        return "skips"
    } else if (force == "No Upgrades") {
        return "no_upgrades"
    } else {
        for (i = 0; i < racers.length; i++) {
            var name = racers[i].name.split(" ")
            if (name[0] == force.replace("Bullseye", "'Bullseye'").replace("\"Bumpy\"", "'Bumpy'").replace("Ban ", "").replace("Maw", "Mawhonic").replace("Beedo", "Aldar")) {
                return i
            }
        }
        console.log("couldn't find force " + force)
    }
}
var participants = [{
    "id": "468827547228962816",
    "name": "acE"
}, {
    "id": "351463486330765314",
    "name": "Beleos"
}, {
    "id": "390214276876468225",
    "name": "daveyracer1"
}, {
    "id": "253942349816659968",
    "name": "Deku Scrublord"
}, {
    "id": "410925667060809738",
    "name": "DigitalUnity"
}, {
    "id": "424544208880402443",
    "name": "Domirae"
}, {
    "id": "346531791655403520",
    "name": "Dwy Guy"
}, {
    "id": "72983240343814144",
    "name": "Galeforce"
}, {
    "id": "536004444341403658",
    "name": "Gamedraco"
}, {
    "id": "287386720239091712",
    "name": "Heraald"
}, {
    "id": "559991363333128213",
    "name": "kingbeandip"
}, {
    "id": "568834914338734080",
    "name": "Le6lindre"
}, {
    "id": "256236315144749059",
    "name": "LightningPirate"
}, {
    "id": "297785322203250688",
    "name": "Mageius"
}, {
    "id": "244958045170434048",
    "name": "metallica5167"
}, {
    "id": "477087276917194752",
    "name": "Mikeyburger"
}, {
    "id": "88334025202081792",
    "name": "Goblin Lifestyle"
}, {
    "id": "115279484567027721",
    "name": "NachoBrado"
}, {
    "id": "188279964745990144",
    "name": "nektarn"
}, {
    "id": "172237358681292801",
    "name": "Nok"
}, {
    "id": "84078931476512768",
    "name": "Paige"
}, {
    "id": "288258590010245123",
    "name": "Renegawd"
}, {
    "id": "230042853567496192",
    "name": "Roni"
}, {
    "id": "242742884506402816",
    "name": "Sire"
}, {
    "id": "422333336669913109",
    "name": "thats no good"
}, {
    "id": "212314806890266624",
    "name": "Zelascelar"
}, {
    "id": "95227997581225984",
    "name": "andypanther"
}, {
    "id": "266425110402039808",
    "name": "jogilbee"
}, {
    "id": "501192429425131532",
    "name": "dekercastle24"
}, {
    "id": "557126249101787137",
    "name": "BananaBoatKid"
}]
function findPlayer(player) {
    var players = Object.values(participants)
    for (i = 0; i < players.length; i++) {
        if (players[i].name == player.replace("Ace", "acE").replace("Le6indre", "Le6lindre").replace("Nektarn", "nektarn")) {
            return i
        }
    }
    console.log("couldn't find " + player)
}
var matches_new = {}
var mtch = Object.keys(matches)
for (j = 0; j < mtch.length; j++) {
    var m = mtch[j]
    var match = {}

    match.tourney = matches[m].tourney
    if (matches[m].bracket == "Qual") {
        match.bracket = "Qualifying"
    } else if (matches[m].bracket == "DE-W") {
        match.bracket = "Winners"
    } else if (matches[m].bracket == "DE-L") {
        match.bracket = "Losers"
    } else if (matches[m].bracket == "RR-1") {
        match.bracket = "Round Robin 1"
        matches[m].round = ""
    } else if (matches[m].bracket == "RR-2") {
        match.bracket = "Round Robin 2"
        matches[m].round = ""
    } else {
        match.bracket = matches[m].bracket
    }
    if (![undefined, null, ""].includes(matches[m].round)) {
        if (String(matches[m].round).includes("GF")) {
            match.round = "Grand Finals"
        } else if (String(matches[m].round).includes("F")) {
            match.round = "Finals"
        } else if (String(matches[m].round).includes("S")) {
            match.round = "Semis"
        } else if (String(matches[m].round).includes("Q")) {
            match.round = "Quarters"
        } else if (String(matches[m].round).includes("1")) {
            match.round = "Round 1"
        } else if (String(matches[m].round).includes("2")) {
            match.round = "Round 2"
        } else if (String(matches[m].round).includes("3")) {
            match.round = "Round 3"
        } else if (String(matches[m].round).includes("4")) {
            match.round = "Round 4"
        } else if (String(matches[m].round).includes("5")) {
            match.round = "Round 5"
        } else {
            match.round = matches[m].round
        }
    }

    if (match.tourney == 0) {
        if (match.bracket == "Winners" && (match.round == "Finals" || match.round == "Grand Finals")) {
            match.ruleset = "-MhzxG-pBoc3rtFxomqg"
        } else {
            match.ruleset = "-MhovNjMjQiPxUPRp9nT"
        }
    } else if (match.tourney == 1) {
        if (match.bracket == "Qualifying") {
            match.ruleset = "-Mi11xpJHdEBo4AL62_l"
        } else if (match.round == "Finals" || match.round == "Semis" || match.round == "Grand Finals") {
            match.ruleset = "-Mi3UuQfRUajQUPZ_p-M"
        } else {
            match.ruleset = "-Mi3UJq_1tQW6vgYPgBK"
        }
    } else if (match.tourney == 2) {
        match.ruleset = "-Mi0lCDS80tmGzafNMWo"
    } else if (match.tourney == 3) {
        match.ruleset = "-Mi3Hs3s9cY_TBDV7-ok"
    }
    match.commentators = matches[m].commentators
    match.vod = matches[m].url
    match.datetime = Date.parse(matches[m].datetime + " EDT")
    match.players = matches[m].players
    match.temp = []
    match.races = []
    matches_new[m] = match
}
var match_runs = [], previous_winner = null, previous_loser = null
for (r = 0; r < runs.length; r++) {
    matches_new[runs[r].datetime].temp.push(runs[r])
    /*
        var match_race = {}
        var run = {}
        match_race.tempbans = []
        match_race.conditions = []
        match_race.track_selection = {}
        match_race.runs = []
        
    
        run.player = runs[r].player
        if (![undefined, null, ""].includes(runs[r].totaltime)) {
            run.time = "DNF"
        } else {
            run.time = runs[r].totaltime
        }
        run.deaths = runs[r].totaldeaths
        run.pod = runs[r].pod
        run.notes = runs[r].notes
        match_runs.push(run)
        console.log(match_runs)
        match_race = {}
        match_race.tempbans = []
        match_race.conditions = []
        match_race.track_selection = {}
        match_race.runs = []
    
        
        if (Number(race) > 1) {
            if (![undefined, null, ""].includes(pod_ban)) {
                match_race.tempbans.push(
                    {
                        type: "pod",
                        selection: Number(pod_ban),
                        player: Number(previous_loser)
                    }
                )
            }
            if (![undefined, null, ""].includes(track_ban)) {
                match_race.tempbans.push(
                    {
                        type: "track",
                        selection: Number(track_ban),
                        player: Number(previous_winner)
                    }
                )
            }
            match_race.track_selection.track = track
            match_race.track_selection.player = previous_loser
            var forces = [force_1, force_2, force_3]
            for (f = 0; f < forces.length; f++) {
                if (![undefined, null, ""].includes(forces[f])) {
                    if (forces[f] == "skips") {
                        match_race.conditions.push(
                            {
                                type: "skips",
                                player: Number(previous_loser)
                            }
                        )
                    } else if (forces[f] == "no_upgrades") {
                        match_race.conditions.push(
                            {
                                type: "no_upgrades",
                                player: Number(previous_loser)
                            }
                        )
                    } else {
                        match_race.conditions.push(
                            {
                                type: "pod_ban",
                                selection: forces[f],
                                player: Number(previous_loser)
                            }
                        )
                    }
                }
            }
        } else {
            match_race.track_selection.track = track
        }
    
        match_race.runs = match_runs
        matches_new[match].temp.push(match_race)
    
        
        if (match_runs[0].time == "DNF") {
            previous_loser = match_runs[0].player
            previous_winner = match_runs[1].player
        } else if (match_runs[1].time == "DNF") {
            previous_loser = match_runs[1].player
            previous_winner = match_runs[0].player
        } else if (Number(match_runs[0].time) < Number(match_runs[1].time)) {
            previous_loser = match_runs[1].player
            previous_winner = match_runs[0].player
        } else if (Number(match_runs[1].time) < Number(match_runs[0].time)) {
            previous_loser = match_runs[0].player
            previous_winner = match_runs[1].player
        }
    
        match_runs = []
    
        match = runs[r].match
        race = runs[r].race
        pod_ban = runs[r].pod_ban
        track_ban = runs[r].track_ban
        force_1 = runs[r].force_1
        force_2 = runs[r].force_2
        force_3 = runs[r].force_3
        track = runs[r].track
        var run = {}
        run.player = runs[r].player
        run.time = runs[r].time
        run.deaths = runs[r].deaths
        run.pod = runs[r].pod
        run.notes = runs[r].notes
        match_runs.push(run)
    */
}

matches_new = Object.values(matches_new)
matches_new = matches_new.sort(function (a, b) {
    return a.datetime - b.datetime;
})
for (m = 0; m < matches_new.length; m++) {
    matches_new[m].permabans = []
    if (matches_new[m].hasOwnProperty("players")) {
        matches_new[m].players.forEach(player => {
            if (player.hasOwnProperty("permabans")) {
                player.permabans.forEach(permaban => {
                    matches_new[m].permabans.push({
                        type: "track",
                        selection: permaban,
                        player: player.player
                    })
                })
            }
        })
        delete matches_new[m].players
    }
    var match_race = {}, match_runs = [], previous_winner = null, previous_loser = null, match_race = {}
    for (r = 0; r < matches_new[m].temp.length; r++) {
        if (r % 2 == 0) {
            match_runs = []
            race = matches_new[m].temp[r].race
            pod_ban = matches_new[m].temp[r].podtempban
            track_ban = matches_new[m].temp[r].tracktempban
            force = matches_new[m].temp[r].force
            track = matches_new[m].temp[r].track
            var run = {}
            run.player = matches_new[m].temp[r].player
            if ([undefined, null, ""].includes(matches_new[m].temp[r].totaltime)) {
                run.time = "DNF"
            } else {
                run.time = matches_new[m].temp[r].totaltime
            }
            run.deaths = matches_new[m].temp[r].totaldeaths
            run.pod = matches_new[m].temp[r].pod
            run.notes = matches_new[m].temp[r].notes
            if(matches_new[m].temp[r].hasOwnProperty("lap1deaths")){
                run.laps = [
                    {
                        time: matches_new[m].temp[r].lap1time,
                        deaths: Number(matches_new[m].temp[r].lap1deaths)
                    },
                    {
                        time: matches_new[m].temp[r].lap2time,
                        deaths: Number(matches_new[m].temp[r].lap2deaths)
                    },
                    {
                        time: matches_new[m].temp[r].lap3time,
                        deaths: Number(matches_new[m].temp[r].lap3deatsh)
                    }
                ]
            }
            match_runs.push(run)
        } else {
            var run = {}
            run.player = matches_new[m].temp[r].player
            if ([undefined, null, ""].includes(matches_new[m].temp[r].totaltime)) {
                run.time = "DNF"
            } else {
                run.time = matches_new[m].temp[r].totaltime
            }
            run.deaths = matches_new[m].temp[r].totaldeaths
            run.pod = matches_new[m].temp[r].pod
            run.notes = matches_new[m].temp[r].notes
            if(matches_new[m].temp[r].hasOwnProperty("lap1deaths")){
                run.laps = [
                    {
                        time: matches_new[m].temp[r].lap1time,
                        deaths: Number(matches_new[m].temp[r].lap1deaths)
                    },
                    {
                        time: matches_new[m].temp[r].lap2time,
                        deaths: Number(matches_new[m].temp[r].lap2deaths)
                    },
                    {
                        time: matches_new[m].temp[r].lap3time,
                        deaths: Number(matches_new[m].temp[r].lap3deatsh)
                    }
                ]
            }
            match_runs.push(run)
            
            match_race = {}
            match_race.tempbans = []
            match_race.conditions = []
            match_race.track_selection = {}
            match_race.runs = []

            if (Number(race) > 1) {
                if (![undefined, null, ""].includes(pod_ban)) {
                    match_race.tempbans.push(
                        {
                            type: "pod",
                            selection: Number(pod_ban),
                            player: Number(previous_loser)
                        }
                    )
                }
                if (![undefined, null, ""].includes(track_ban)) {
                    match_race.tempbans.push(
                        {
                            type: "track",
                            selection: Number(track_ban),
                            player: Number(previous_winner)
                        }
                    )
                }
                match_race.track_selection.track = track
                match_race.track_selection.player = previous_loser
                var forces = [force_1, force_2, force_3]
                for (f = 0; f < forces.length; f++) {
                    if (![undefined, null, ""].includes(forces[f])) {
                        if (forces[f] == "Skips") {
                            match_race.conditions.push(
                                {
                                    type: "skips",
                                    player: Number(previous_loser)
                                }
                            )
                        } else if (forces[f] == "NU") {
                            match_race.conditions.push(
                                {
                                    type: "no_upgrades",
                                    player: Number(previous_loser)
                                }
                            )
                        } 
                    }
                }
            } else {
                match_race.track_selection.track = track
            }

            match_race.runs = match_runs
            matches_new[m].races.push(match_race)

            if (match_runs[0].time == undefined) {
                previous_loser = match_runs[0].player
                previous_winner = match_runs[1].player
            } else if (match_runs[1].time == undefined) {
                previous_loser = match_runs[1].player
                previous_winner = match_runs[0].player
            } else if (Number(match_runs[0].time) < Number(match_runs[1].time)) {
                previous_loser = match_runs[1].player
                previous_winner = match_runs[0].player
            } else if (Number(match_runs[1].time) < Number(match_runs[0].time)) {
                previous_loser = match_runs[0].player
                previous_winner = match_runs[1].player
            }

        }

    }
    delete matches_new[m].temp
}

for(m = 0; m < matches_more.length; m++){
    matches_more[m].permabans = []
    if (matches_more[m].hasOwnProperty("players")) {
        matches_more[m].players.forEach(player => {
            if (player.hasOwnProperty("permabans")) {
                player.permabans.forEach(permaban => {
                    matches_more[m].permabans.push({
                        type: "track",
                        selection: permaban,
                        player: player.player
                    })
                })
            }
        })
        delete matches_more[m].players
    }
    matches_new.push(matches_more[m])
}

fs.writeFile("2021_matches_old_updated.json", JSON.stringify(matches_new), (err) => {
    if (err) console.error(err)
});
fs.writeFile("2021_old_updated.json", JSON.stringify(runs), (err) => {
    if (err) console.error(err)
});