const CacheService = require('./cacheService.js')
const { axiosClient: axios } = require('../axios.js')

const cache = new CacheService()

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

module.exports = {
    tournamentsRulesetsCache: { getTournaments, getRulesets, invalidateTournaments, invalidateRulesets }
}
