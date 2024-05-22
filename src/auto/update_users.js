const { database } = require("../firebase.js")
const { testing } = require("../../config.js")
const { swe1r_guild } = require("../data/discord/guild.js")

exports.update_users = function (client) {
    database.ref('users').once("value", function (snapshot) {
        if (!testing) {
            let users = snapshot.val()
            client.guilds.fetch(swe1r_guild).then(guild => {
                try {
                    guild.members.fetch({ force: true }).then(members => {
                        Object.keys(users).forEach(async function (key) {
                            let user = users[key];
                            if (user.discordID && guild.members.cache.some(m => m == user.discordID)) {
                                guild.members.fetch({ user: user.discordID, force: true }).then(member => {
                                    // Storing role IDs in the 'roles' array
                                    const roles = member.roles.cache.map(role => role.id);

                                    database.ref('users').child(key).child('avatar').set(member.displayAvatarURL())
                                    database.ref('users').child(key).child('discord').update({
                                        displayName: member.displayName,
                                        joinedTimestamp: member.joinedTimestamp,
                                        nickname: member.nickname,
                                        tag: member.user.tag,
                                        roles: roles, // Adding the roles array to the user's data
                                    });
                                });
                            }
                        });
                    });
                } catch (e) {
                    console.log(e);
                }
            });
        }
    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
}
