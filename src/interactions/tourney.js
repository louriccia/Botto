const { play } = require('./tourney/play.js')
module.exports = {
    name: 'tourney',
    async execute({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot } = {}) {
        if (args[0] == "play") {
            // Must be awaited: without it a throw inside play() becomes an
            // unhandledRejection instead of reaching the caller's try/catch,
            // and the player sees a dead button (the interaction was already
            // deferred, so no error ever renders).
            await play({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile, userSnapshot })
        }
    }
}
