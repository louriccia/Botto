const { setupEmbed, setupComponents } = require('../functions.js')
const axios = require('../../../axios.js')

const headers = {
    'x-user-id': member_id,
}

function submitAction(matchId, userId, actions) {
    return axios.post(`/matches/${matchId}/submitAction`, {
        user,
        actions
    }, {
        'x-user-id': userId,
    });
}

exports.setup = async function ({ interaction, args, userSnapshot } = {}) {
    let res

    const actionName = args[2]
    const memberId = userSnapshot.discordId

    try {
        if (["tournament", "phase", "division", "round", "ruleset"].includes(actionName)) {
            res = await axios.update(`/matches/${matchId}`, {
                [actionName]: interaction.values[0]
            }, headers)
        } else {
            res = await submitAction(matchId, memberId, [
                { name: actionName }
            ])
        }

        if (res.status !== 200) {
            interaction.reply({ content: res.data.error, ephemeral: true })
            return
        }
    } catch (err) {
        console.error(err);
        interaction.reply(`❌ Error setting up match: ${err.response?.data?.error || err.message}`);
        return
    }

    const match = res.data.match
    const tournaments = await axios.get('/tournaments')
    const rulesets = await axios.get('/rulesets')

    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [setupEmbed({ match })], components: setupComponents({ match, tournaments, rulesets }) })
    } else {
        interaction.update({ embeds: [setupEmbed({ match })], components: setupComponents({ match, tournaments, rulesets }) })
    }
}