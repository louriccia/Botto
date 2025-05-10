const { play } = require('./tourney/play.js')
module.exports = {
    name: 'tourney',
    async execute({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        if (args[0] == "play") {
            play({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot })
        }
    }
}
