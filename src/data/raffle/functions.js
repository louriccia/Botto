const { db } = require("../../firebase")
const moment = require('moment');
require('moment-timezone')
exports.getRaffleTally = function () {

    let tally = {}

    function addTicket(user) {
        if (!tally[user]) {
            tally[user] = 0
        }
        tally[user]++
    }

    if (!db.ch) {
        return
    }

    const raffleCutOff = 1717214400000 //9pm et May 31

    //get challenge points
    let challenge_map = {}
    Object.values(db.ch.times).filter(time => moment(time.date).tz('America/New_York').month() == 4 && moment(time.date).tz('America/New_York').year() == 2024).forEach(time => {
        let user = time.user
        let day = moment(time.date).tz('America/New_York').date()
        if (!challenge_map[user]) {
            challenge_map[user] = []
        }
        if (!challenge_map[user].includes(day) && challenge_map[user].length < 25) {
            challenge_map[user].push(day)
            addTicket(user)
        }
    })

    //get scavenger
    let scavenger_keeper = {}
    Object.keys(db.ch.scavenger).forEach(player => {
        let solves = db.ch.scavenger[player]
        for (let i = 0; i < 25; i++) {
            if (solves?.[i]?.solved && (!solves[i]?.date || solves[i]?.date < raffleCutOff)) {
                if (!scavenger_keeper[player]) {
                    scavenger_keeper[player] = 0
                }
                scavenger_keeper[player]++

                addTicket(player)
            }
        }
    })

    //get trivia
    let trivia_keeper = {}
    Object.values(db.ch.trivia).filter(round => round.date < raffleCutOff).forEach(question => {
        if (question.responses) {
            Object.values(question.responses).forEach(response => {
                if (response.correct) {
                    if (!trivia_keeper[response.member]) {
                        trivia_keeper[response.member] = 0
                    }
                    trivia_keeper[response.member]++
                    if (trivia_keeper[response.member] <= 25) {
                        addTicket(response.member)
                    }
                }
            })
        }
    })

    //award bonus
    //radiant challenge
    tally["596517467740962845"] += 10
    //du trivia
    tally["410925667060809738"] += 10

    //get drops
    let drop_keeper = {}
    Object.values(db.ch.drops).filter(drop => drop.drop == 'ticket' && drop.date < raffleCutOff).forEach(drop => {
        if (!drop_keeper[drop.member]) {
            drop_keeper[drop.member] = 0
        }
        drop_keeper[drop.member]++
        addTicket(drop.member)
    })

    //remove lp
    delete tally['256236315144749059']

    return tally
}
