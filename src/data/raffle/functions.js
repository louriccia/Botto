const { db } = require("../../firebase")
const moment = require('moment');


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


    //get challenge points
    let challenge_map = {}
    Object.values(db.ch.times).filter(time => moment(time.date).month() == 4 && moment(time.date).year() == 2024).forEach(time => {
        let user = time.user
        let day = moment(time.date).date()
        if (!challenge_map[user]) {
            challenge_map[user] = []
        }
        if (!challenge_map[user].includes(day) && challenge_map[user].length <= 25) {
            challenge_map[user].push(day)
            addTicket(user)
        }
    })




    //get scavenger
    Object.keys(db.ch.scavenger).forEach(player => {
        for (let i = 0; i < 25; i++) {
            if (db.ch.scavenger[player]?.[i]?.solved) {
                addTicket(player)
            }
        }
    })

    let trivia_keeper = {}

    //get trivia
    Object.values(db.ch.trivia).forEach(question => {
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
    //gale

    //get drops
    Object.values(db.ch.drops).filter(drop => drop.drop == 'ticket').forEach(drop => {
        addTicket(drop.member)
    })

    delete tally['256236315144749059']

    return tally
}
