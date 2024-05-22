const { } = require('./tourney/data.js');
const { } = require('./tourney/functions.js');
const { play } = require('./tourney/play.js')
module.exports = {
    name: 'tourney',
    async execute({ client, interaction, args, database, db } = {}) {
        if (args[0] == "matches") {

        } else if (args[0] == "schedule") {

        } else if (args[0] == "leaderboards") {

        } else if (args[0] == "rulesets") {

        } else if (args[0] == "stats") {

        } else if (args[0] == "play") {
            play(args, interaction, database, db)
        }
    }
}
