const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js')
const { onAction } = require('./sseClient.js')
const { axiosClient } = require('./axios.js')
const { tournamentsRulesetsCache } = require('./services/tourneyCache.js')
const { system_color } = require('./colors.js')
const { eventDescriptor } = require('./interactions/tourney/functions.js')

const SYSTEM_ACCENT = parseInt(String(system_color).replace('#', ''), 16)

// Wrap SSE-triggered notifications in a Components V2 container with the system accent
// color so they render with the same border treatment as the rest of the tourney message
// flow but stay visually distinct from player- and admin-driven messages.
function sendSystemMessage(channel, content) {
    const view = [new ContainerBuilder()
        .setAccentColor(SYSTEM_ACCENT)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))]
    return channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
}

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
                // Direct unauthenticated GET — the previous getMatch helper used
                // submitAction { name: 'getMatch' } which requires x-user-id auth, and
                // since SSE refreshes don't have a clicker context the call was failing
                // with "User ID is required" and silently leaving the cache stale.
                const res = await axiosClient.get(`/matches/${matchId}`, { timeout: 10000 })
                const fresh = res?.data?.data
                if (!fresh || !fresh.id) return
                const stillBound = findChannelForMatch(client, matchId)
                if (!stillBound) return
                client.channelToMatch.set(stillBound, fresh)
                if (reactWebsite) {
                    console.log(`[sse] cache refreshed for match ${matchId} from source=${event.payload?.source ?? '?'}`)
                }
            } catch (err) {
                console.error('[sse] match refresh failed', matchId, err?.message || err)
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
            await sendSystemMessage(channel, `${who} submitted via game mod: **${timeStr}**`)
        } catch (err) {
            console.error('[sse] mod run notification failed', err)
        }
    }
}

// System events resolve during pre-race event-queue draining (e.g. a poll vote whose
// winning option was "system picks the track"). They never become activeEvents, so the
// trail block's findResolvedEvents misses them — relying on SSE here is the only way to
// announce them. Posts directly to the channel as a small `-#` line, like other trail
// events. May fire multiple times per user action; each gets its own message.
function makeResolveSystemEventHandler(client) {
    return async (event) => {
        const matchId = event.id
        if (!matchId) return
        const channelId = findChannelForMatch(client, matchId)
        if (!channelId) return
        try {
            const channel = await client.channels.fetch(channelId)
            if (!channel?.isTextBased?.()) return
            const eventData = event.payload || {}
            if (!eventData.event || !eventData.selection?.length) return
            const line = eventDescriptor({ event: eventData, present: false, mention: false })
            if (!line) return
            await sendSystemMessage(channel, `-# ${line}`)
        } catch (err) {
            console.error('[sse] resolveSystemEvent notification failed', err?.message || err)
        }
    }
}

// Fires once when a race transitions into warmup with deferred events to reveal (e.g. a
// random pick that was hidden during the pool-pick phase). Renders all reveals as a single
// "Warmup reveal" message so they read as one announcement, not a flood.
function makeRevealDeferredEventsHandler(client) {
    return async (event) => {
        const matchId = event.id
        if (!matchId) return
        const channelId = findChannelForMatch(client, matchId)
        if (!channelId) return
        try {
            const channel = await client.channels.fetch(channelId)
            if (!channel?.isTextBased?.()) return
            const events = event.payload?.events ?? []
            if (!events.length) return
            const lines = events
                .filter(e => e.selection?.length)
                .map(e => `-# ${eventDescriptor({ event: e, present: false, mention: false })}`)
            if (!lines.length) return
            await sendSystemMessage(channel, lines.join('\n'))
        } catch (err) {
            console.error('[sse] revealDeferredEvents notification failed', err?.message || err)
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

    // System-driven event resolutions and warmup reveals — announced regardless of who
    // initiated the parent submitAction since they don't show up in the bot's normal
    // trail (their events skip activeEvents and resolve straight into race.events).
    onAction('match.resolveSystemEvent', makeResolveSystemEventHandler(client))
    onAction('match.revealDeferredEvents', makeRevealDeferredEventsHandler(client))

    if (process.env.SSE_REACT_MOD === 'true') {
        onAction('match.submitRun', makeModRunHandler(client))
    }
}

module.exports = { registerSseHandlers }
