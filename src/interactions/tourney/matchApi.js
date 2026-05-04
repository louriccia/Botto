const { requestWithUser } = require('../../axios.js')

async function getMatch(matchId, userSnapshot) {
    try {
        const res = await requestWithUser({
            method: 'post',
            url: `/matches/${matchId}/submitAction`,
            userSnapshot,
            data: {
                actions: [{ name: 'getMatch' }],
            },
        })
        return { match: res.data, meta: res.meta }
    } catch (err) {
        console.log(err)
        return { match: null, meta: null, error: err.message }
    }
}

module.exports = { getMatch }
