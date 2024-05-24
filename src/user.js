const { database, db } = require("./firebase")


exports.initializePlayer = function (ref, name) {
    let data = {
        settings: {
            mirror_mode: settings_default.mirror_mode,
            backwards: settings_default.backwards,
            no_upgrades: settings_default.no_upgrades,
            non_3_lap: settings_default.non_3_lap,
            skips: settings_default.skips,
            winnings: settings_default.winnings,
        },
        name: name,
        truguts_earned: 0,
        truguts_spent: 0,
        achievements: {
            galaxy_famous: false,
            pod_champ: false,
            light_skipper: false,
            slow_steady: false,
            mirror_dimension: false,
            crowd_favorite: false,
            true_jedi: false,
            big_spender: false
        }
    }
    ref.set(data)
    return data
}

exports.initializeUser = async function (ref, id, name) {
    let data = {
        discordID: id,
        name: name
    }
    const push = await ref.push(data)
    return push.key
}

exports.get_user_key_by_discord_id = function (db, member) {
    if (!db.user) {
        return null
    }

    let player = Object.keys(db.user).find(key => db.user[key].discordID == member)
    return player
}

exports.get_user_key_by_sg_name = function (name, db) {
    return Object.keys(db.user).find(key => db.user[key].sgName === name.trim()) ?? ""
}

exports.get_user_name_by_discord_id = function (id) {
    return Object.values(db.user).find(u => u.discordID == id)?.name ?? ''
}