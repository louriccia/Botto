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

async function getLeaderboard({ track, conditions, userSnapshot, limit } = {}) {
    try {
        const res = await requestWithUser({
            method: 'get',
            url: '/matches/leaderboard',
            userSnapshot,
            query: {
                track,
                conditions: conditions ? JSON.stringify(conditions) : undefined,
                limit,
            },
        })
        return { runs: res.data || [], error: null }
    } catch (err) {
        return { runs: [], error: err.message }
    }
}

module.exports = { getMatch, getLeaderboard }
