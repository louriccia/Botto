exports.elo = function (matches) {
    matches.sort(function (a, b) {
        return a.datetime - b.datetime;
    })
    let ranks = {}
    matches.forEach(match => {
        if (![undefined, "", "Qualifying"].includes(match.bracket)) {
            let players = {}
            Object.values(match.races).forEach(race => {
                let winner = { player: null, time: null }
                Object.values(race.runs).forEach(run => {
                    if (players[run.player] == undefined) {
                        players[run.player] = { player: run.player, score: 0 }
                    }
                    if (run.time !== "DNF" && (winner.time == null || run.time < winner.time)) {
                        winner.time = run.time
                        winner.player = run.player
                    }
                })
                players[winner.player].score++
            })
            players = Object.values(players)
            if (players.length == 2) {
                for (let j = 0; j < players.length; j++) {
                    //initialize player
                    if (ranks[players[j].player] == undefined) {
                        ranks[players[j].player] = { rank: 1000, matches: 0, change: 0 }
                    }
                }
                let r1 = ranks[players[0].player].rank
                let r2 = ranks[players[1].player].rank
                let p1 = 1 / (1 + 10 ** ((r2 - r1) / 400))
                let p2 = 1 - p1
                function getK(m) {
                    let k = 25
                    if (m < 26) {
                        k = 32
                    }
                    if (m < 11) {
                        k = 40
                    }
                    if (m < 6) {
                        k = 50
                    }
                    return k
                }
                let k1 = getK(ranks[players[0].player].matches)
                let k2 = getK(ranks[players[1].player].matches)
                let s1 = null, s2 = null
                if (!["", null, undefined].includes(players[0].score) && !["", null, undefined].includes(players[1].score)) {
                    if (players[0].score > players[1].score) {
                        s1 = 1
                        s2 = 0
                    } else if (players[1].score > players[0].score) {
                        s1 = 0
                        s2 = 1
                    }
                    ranks[players[0].player].rank += k1 * (s1 - p1)
                    ranks[players[1].player].rank += k2 * (s2 - p2)
                    ranks[players[0].player].change = k1 * (s1 - p1)
                    ranks[players[1].player].change = k2 * (s2 - p2)
                    ranks[players[0].player].matches++
                    ranks[players[1].player].matches++
                }
            }
        }
    })
    return ranks
}