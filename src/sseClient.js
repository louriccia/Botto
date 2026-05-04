const EventSource = require('eventsource')

const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000

let source = null
let backoffMs = INITIAL_BACKOFF_MS
let lastEventId = null
let reconnectTimer = null
let closed = false

// Action-keyed handlers. Keys can be exact ('match.raceStart') or wildcard
// prefix ('match.*') matching any action starting with 'match.'.
const actionHandlers = new Map()
// Topic-keyed handlers. Scope to a resource (e.g., 'match:abc').
const topicHandlers = new Map()

function safeCall(handler, event) {
    try {
        handler(event)
    } catch (err) {
        console.error('[sseClient] handler threw', err, event)
    }
}

function dispatch(event) {
    const exact = actionHandlers.get(event.action)
    if (exact) for (const h of exact) safeCall(h, event)

    if (typeof event.action === 'string' && event.action.includes('.')) {
        const prefix = event.action.slice(0, event.action.indexOf('.') + 1) + '*'
        const wildcard = actionHandlers.get(prefix)
        if (wildcard) for (const h of wildcard) safeCall(h, event)
    }

    if (event.topic) {
        const topicSet = topicHandlers.get(event.topic)
        if (topicSet) for (const h of topicSet) safeCall(h, event)
    }
}

function connect() {
    const base = process.env.BOTTO_API_BASE_URL
    const token = process.env.BOT_API_KEY
    if (!base || !token) {
        console.warn('[sseClient] BOTTO_API_BASE_URL or BOT_API_KEY missing, not connecting')
        return
    }

    const url = `${base.replace(/\/$/, '')}/events`
    const headers = { 'x-bot-token': token }
    if (lastEventId) headers['Last-Event-ID'] = lastEventId

    source = new EventSource(url, { headers })

    source.addEventListener('open', () => {
        backoffMs = INITIAL_BACKOFF_MS
        console.log('[sseClient] connected')
    })

    source.addEventListener('entity', (msg) => {
        try {
            const event = JSON.parse(msg.data)
            if (event && typeof event.seq !== 'undefined') {
                lastEventId = String(event.seq)
            }
            dispatch(event)
        } catch (err) {
            console.warn('[sseClient] bad event payload', err, msg.data)
        }
    })

    source.addEventListener('error', () => {
        if (closed) return
        if (source && source.readyState === EventSource.CLOSED) {
            console.log(`[sseClient] closed, retrying in ${backoffMs}ms`)
            scheduleReconnect()
        }
    })
}

function scheduleReconnect() {
    if (reconnectTimer || closed) return
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (source) {
            try { source.close() } catch (_) {}
            source = null
        }
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
        connect()
    }, backoffMs)
}

function initSseClient() {
    if (source) return
    closed = false
    connect()
}

function closeSseClient() {
    closed = true
    if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
    if (source) {
        try { source.close() } catch (_) {}
        source = null
    }
}

function onAction(action, handler) {
    let set = actionHandlers.get(action)
    if (!set) {
        set = new Set()
        actionHandlers.set(action, set)
    }
    set.add(handler)
    return () => {
        set.delete(handler)
        if (set.size === 0) actionHandlers.delete(action)
    }
}

function onTopic(topic, handler) {
    let set = topicHandlers.get(topic)
    if (!set) {
        set = new Set()
        topicHandlers.set(topic, set)
    }
    set.add(handler)
    return () => {
        set.delete(handler)
        if (set.size === 0) topicHandlers.delete(topic)
    }
}

module.exports = { initSseClient, closeSseClient, onAction, onTopic }
