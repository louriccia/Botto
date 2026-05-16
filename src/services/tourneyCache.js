const CacheService = require('./cacheService.js')
const { axiosClient: axios } = require('../axios.js')
const { getLeaderboard: apiGetLeaderboard } = require('../interactions/tourney/matchApi.js')

const cache = new CacheService()
// Leaderboard cache lives in its own short-lived store so we can blow it
// away wholesale on POST_MATCH transitions without affecting tournaments/rulesets.
const lbCache = new CacheService(60 * 1000)

const TOURNAMENTS_KEY = 'tournaments'
const RULESETS_KEY = 'rulesets'

async function getTournaments() {
    let list = cache.get(TOURNAMENTS_KEY)
    if (list) return list
    const res = await axios.get('/tournaments')
    list = res.data?.data ?? []
    cache.set(TOURNAMENTS_KEY, list)
    return list
}

async function getRulesets() {
    let list = cache.get(RULESETS_KEY)
    if (list) return list
    const res = await axios.get('/rulesets')
    list = res.data?.data ?? []
    cache.set(RULESETS_KEY, list)
    return list
}

function invalidateTournaments() {
    cache.invalidate(TOURNAMENTS_KEY)
}

function invalidateRulesets() {
    cache.invalidate(RULESETS_KEY)
}

// Bot-side cache key needs to be deterministic across calls with the same merged
// conditions. Stringify with sorted top-level keys so two equivalent objects produce
// the same key regardless of property insertion order.
function stableCacheKey(obj) {
    if (!obj) return ''
    const keys = Object.keys(obj).sort()
    return keys.map(k => `${k}=${JSON.stringify(obj[k])}`).join('&')
}

async function getLeaderboard({ track, conditions, userSnapshot } = {}) {
    if (!track) return []
    const key = `lb:${track}:${stableCacheKey(conditions)}`
    const cached = lbCache.get(key)
    if (cached) return cached
    const { runs } = await apiGetLeaderboard({ track, conditions, userSnapshot })
    lbCache.set(key, runs)
    return runs
}

// Single no-op leaderboard request to warm both the API's getAll() match cache
// and (via _buildLeaderboardIndex) every bucket. Pre-render on bot startup so
// the first user-triggered race view doesn't pay a cold walk. Cold builds can
// blow past the default 10s axios timeout, so we give it a generous window
// and silence error logging — this is purely best-effort.
async function warm() {
    try {
        await apiGetLeaderboard({ track: '__warm__', conditions: {}, timeout: 60000, quiet: true })
    } catch { /* swallow — best-effort warming */ }
}

function invalidateLeaderboard() {
    lbCache.clear()
}

module.exports = {
    tournamentsRulesetsCache: { getTournaments, getRulesets, invalidateTournaments, invalidateRulesets },
    leaderboardCache: { getLeaderboard, invalidateLeaderboard, warm }
}
