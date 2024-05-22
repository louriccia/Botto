const fs = require('fs');
const lookup = require("./data.js");
let runs = JSON.parse(fs.readFileSync("2021.json", "utf8"));
let matches = JSON.parse(fs.readFileSync("2021_matches.json", "utf8"));
var tools = require('./tools.js');
var rns = Object.keys(runs)
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
    match.tourney = 3
    matches[m].match = matches[m].match.replace(":", "")
    if (matches[m].match.startsWith("Gp")) {
        match.bracket = "Group " + matches[m].match.substring(2, 3)
        match.round = matches[m].match.substring(3, 4)
    } else {
        if (matches[m].match.startsWith("W") || matches[m].match.startsWith("G")) {
            match.bracket = "Winners"
        } else if (matches[m].match.startsWith("L")) {
            match.bracket = "Losers"
        }
        if(matches[m].match.includes("R1")){
            match.round = "Round 1"
        } else if(matches[m].match.includes("R2")){
            match.round = "Round 2"
        } else if(matches[m].match.includes("R3")){
            match.round = "Round 3"
        } else if(matches[m].match.includes("Q")){
            match.round = "Quarters"
        } else if(matches[m].match.includes("S")){
            match.round = "Semis"
        } else if(matches[m].match.includes("GF")){
            match.round = "Grand Finals"
        } else if(matches[m].match.includes("F")){
            match.round = "Finals"
        }
    }
    if(match.bracket.startsWith("Group") || match.round == "Round 1" || (match.round == "Quarters" && match.bracket == "Winners")){
        match.ruleset = "-Mi3VZL8YSYCV2J_e-RI"
    } else {
        match.ruleset = "-Mi3W-aPTn1ybjH7xYC5"
    }
    var comms = matches[m].commentary.split(", ")
    var com = []
    for(c = 0; c < comms.length; c++){
        com.push(findPlayer(comms[c]))
    }
    match.commentators = com
    match.vod = matches[m].url
    match.datetime = Date.parse(matches[m].datetime.replace(",", ", 2021") + " EDT")
    match.players = [
        {
            player: findPlayer(matches[m].p1),
            permabans: [findTrack(matches[m].p1_pban_1), findTrack(matches[m].p1_pban_2)]
        },
        {
            player: findPlayer(matches[m].p2),
            permabans: [findTrack(matches[m].p2_pban_1), findTrack(matches[m].p2_pban_2)]
        }
    ]
    match.races = []
    matches_new[matches[m].match] = match
}
var match_runs = [], previous_winner = null, previous_loser = null, match_race = {}
for (j = 0; j < rns.length; j++) {
    var r = rns[j]
    if (runs[r].time !== "DNF") {
        runs[r].time = tools.timetoSeconds(runs[r].time)
    }
    runs[r].match = runs[r].match.replace(":", "")
    runs[r].pod_ban = findPod(runs[r].pod_ban)
    runs[r].pod = findPod(runs[r].pod)
    runs[r].track_ban = findTrack(runs[r].track_ban)
    runs[r].track = findTrack(runs[r].track)
    runs[r].force_1 = findForce(runs[r].force_1)
    runs[r].force_2 = findForce(runs[r].force_2)
    runs[r].force_3 = findForce(runs[r].force_3)
    runs[r].player = findPlayer(runs[r].player)
    
    if (j % 2 == 1) {
        var run = {}
        runs[r].match = match
        runs[r].race = race
        runs[r].pod_ban = pod_ban
        runs[r].track_ban = track_ban
        runs[r].force_1 = force_1
        runs[r].force_2 = force_2
        runs[r].force_3 = force_3
        runs[r].track = track

        run.player = runs[r].player
        run.time = runs[r].time
        run.deaths = runs[r].deaths
        run.pod = runs[r].pod
        run.notes = runs[r].notes
        match_runs.push(run)
        console.log(match_runs)
        match_race = {}
        match_race.tempbans = []
        match_race.conditions = []
        match_race.track_selection = {}
        match_race.runs = []

        if(Number(race) > 1){
            if(![undefined, null, ""].includes(pod_ban)){
                match_race.tempbans.push(
                    {
                        type: "pod",
                        selection: Number(pod_ban),
                        player: Number(previous_loser)
                    }
                )
            }
            if(![undefined, null, ""].includes(track_ban)){
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
            for(f = 0; f < forces.length; f++){
                if(![undefined, null, ""].includes(forces[f])){
                    if(forces[f] == "skips"){
                        match_race.conditions.push(
                            {
                                type: "skips",
                                player: Number(previous_loser)
                            }
                        )
                    } else if(forces[f] == "no_upgrades"){
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
        matches_new[match].races.push(match_race)

        if(match_runs[0].time == "DNF"){
            previous_loser = match_runs[0].player
            previous_winner = match_runs[1].player
        } else if(match_runs[1].time == "DNF"){
            previous_loser = match_runs[1].player
            previous_winner = match_runs[0].player
        } else if(Number(match_runs[0].time) < Number(match_runs[1].time)){
            previous_loser = match_runs[1].player
            previous_winner = match_runs[0].player
        } else if(Number(match_runs[1].time) < Number(match_runs[0].time)){
            previous_loser = match_runs[0].player
            previous_winner = match_runs[1].player
        }


    } else {
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
    }
    
}
/*
fs.writeFile("2021_matches_updated.json", JSON.stringify(Object.values(matches_new)), (err) => {
    if (err) console.error(err)
});*/
fs.writeFile("2021_updated.json", JSON.stringify(runs), (err) => {
    if (err) console.error(err)
});