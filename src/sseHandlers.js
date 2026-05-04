const { onAction } = require('./sseClient.js')
const { getMatch } = require('./interactions/tourney/matchApi.js')
const { tournamentsRulesetsCache } = require('./services/tourneyCache.js')

const REFRESH_DEBOUNCE_MS = 500

function findChannelForMatch(client, matchId) {
    for (const [channelId, m] of client.channelToMatch) {
        if (m?.id === matchId) return channelId
    }
    return null
}

function passesLoopbackGuard(event, cachedMatch) {
    if (event?.payload?.source === 'discord') return false
    const lastSeen = cachedMatch?.__lastSeenSeq
    if (typeof lastSeen === 'number' && typeof event.seq === 'number' && event.seq <= lastSeen) {
        return false
    }
    return true
}

function makeMatchHandler(client, { reactWebsite } = {}) {
    const pending = new Map() // matchId -> timer

    return async (event) => {
        const matchId = event.id
        if (!matchId) return
        const channelId = findChannelForMatch(client, matchId)
        if (!channelId) return
        const cached = client.channelToMatch.get(channelId)
        if (!passesLoopbackGuard(event, cached)) return

        if (pending.has(matchId)) return
        const timer = setTimeout(async () => {
            pending.delete(matchId)
            try {
                const { match: fresh, meta } = await getMatch(matchId, { id: null })
                if (!fresh) return
                if (meta?.lastEventSeq != null) fresh.__lastSeenSeq = meta.lastEventSeq
                const stillBound = findChannelForMatch(client, matchId)
                if (!stillBound) return
                client.channelToMatch.set(stillBound, fresh)
                if (reactWebsite) {
                    // Full embed re-render is deferred to PR 3 (play.js refactor).
                    // For now, cache is refreshed so the next Discord interaction renders fresh state.
                    console.log(`[sse] cache refreshed for match ${matchId} from source=${event.payload?.source ?? '?'}`)
                }
            } catch (err) {
                console.error('[sse] match refresh failed', matchId, err)
            }
        }, REFRESH_DEBOUNCE_MS)
        pending.set(matchId, timer)
    }
}

function makeModRunHandler(client) {
    return async (event) => {
        if (event?.payload?.source !== 'mod') return
        if (event.action !== 'match.submitRun') return
        const matchId = event.id
        const channelId = findChannelForMatch(client, matchId)
        if (!channelId) return
        try {
            const channel = await client.channels.fetch(channelId)
            if (!channel?.isTextBased?.()) return
            const run = event.payload?.actionPayload?.run
            const userId = event.payload?.userId
            const who = userId ? `<@${userId}>` : 'A racer'
            const timeStr = run?.dnf ? 'DNF' : (run?.time != null ? run.time : '?')
            await channel.send(`${who} submitted via game mod: **${timeStr}**`)
        } catch (err) {
            console.error('[sse] mod run notification failed', err)
        }
    }
}

function registerSseHandlers(client) {
    // Cache invalidation — cheap, always on when SSE is on.
    onAction('tournament.*', () => tournamentsRulesetsCache.invalidateTournaments())
    onAction('ruleset.*', () => tournamentsRulesetsCache.invalidateRulesets())
    // cacheBus also emits bare entity lifecycle events (e.g., 'tournaments.updated')
    // — cover those too.
    onAction('tournaments.*', () => tournamentsRulesetsCache.invalidateTournaments())
    onAction('rulesets.*', () => tournamentsRulesetsCache.invalidateRulesets())

    const reactWebsite = process.env.SSE_REACT_WEBSITE === 'true'
    onAction('match.*', makeMatchHandler(client, { reactWebsite }))

    if (process.env.SSE_REACT_MOD === 'true') {
        onAction('match.submitRun', makeModRunHandler(client))
    }
}

module.exports = { registerSseHandlers }
