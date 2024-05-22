const { initializeChallenge, updateChallenge, checkActive } = require('./functions.js');

exports.play = async function ({ current_challenge, current_challenge_ref, interaction, db, database, member_id, botto_name, user_profile, profile_ref, user_key, member_avatar } = {}) {
    if (interaction.guildId == '1135800421290627112') {
        database.ref(`challenge/times`).orderByChild('time').equalTo("22.222").once("value", async function (snapshot) {
            if (snapshot.exists()) {
                let snap = snapshot.val()
                Object.keys(snap).forEach(key => {
                    if (['256236315144749059', '545799665862311971'].includes(snap[key].user)) {
                        database.ref(`challenge/times/${key}`).remove()
                    }
                })
            } else {
                console.log('no user found')
            }
        }, function (errorObject) {
            console.log(errorObject)
            return null
        });
        database.ref(`challenge/challenges`).orderByChild('guild').equalTo('1135800421290627112').once("value", async function (snapshot) {
            if (snapshot.exists()) {
                let snap = snapshot.val()
                console.log(Object.keys(snap))
                Object.keys(snap).forEach(key => {
                    database.ref(`challenge/challenges/${key}`).remove()
                })
            } else {
                console.log('no user found')
            }
        }, function (errorObject) {
            console.log(errorObject)
            return null
        });
    }
    //check if challenge already in progress FIXME change to reposting challenge
    let activechallenge = checkActive(db, member_id, current_challenge)
    if (activechallenge) {
        interaction.reply({ embeds: [activechallenge], ephemeral: true })
        return
    }
    let type = interaction.member.voice?.channel?.id == '441840193754890250' ? 'multiplayer' : 'private'
    current_challenge = initializeChallenge({ user_profile, member_id, type, name: botto_name, avatar: member_avatar, user: user_key, db, interaction })
    const reply = await updateChallenge({ client: interaction.client, db, user_profile, current_challenge, current_challengeref: current_challenge_ref, profile_ref, member: member_id, name: botto_name, avatar: member_avatar, interaction })
    try {
        let message = await interaction.reply(reply)
        current_challenge.message = message.id
        current_challenge.channel = interaction.channelId
        current_challenge.guild = interaction.guildId
        current_challenge.url = message.url
        database.ref(`challenge/challenges/${message.id}`).set(current_challenge)
        current_challenge = db.ch.challenges[message.id]
        current_challengeref = database.ref(`challenge/challenges/${message.id}`)

        // setTimeout(async function () { //mark challenge abandoned
        //     current_challenge = db.ch.challenges[message.id]
        //     if (current_challenge && current_challenge?.type == 'private' && isActive(current_challenge, user_profile) && !current_challenge?.track_bribe && !current_challenge?.racer_bribe) {
        //         const row = new ActionRowBuilder()
        //         row.addComponents(
        //             new ButtonBuilder()
        //                 .setCustomId("challenge_random_modal")
        //                 .setLabel("Submit")
        //                 .setStyle(ButtonStyle.Primary)
        //                 .setEmoji("⏱️")
        //         )
        //         if (!current_challenge.completed && !current_challenge.rerolled) {
        //             current_challengeref.update({ type: 'abandoned', players: [], predictions: [] })
        //             current_challenge = db.ch.challenges[message.id]
        //         }
        //         const aba_response = await updateChallenge({ client, user_profile, current_challenge, current_challengeref, profile_ref, member_id, name, avatar, interaction, db })
        //         interaction.editReply(aba_response)
        //     }
        // }, 1000 * 60 * 15 - 50000)

    } catch (err) {
        console.log('there was an error when posting the challenge', err)
    }
}