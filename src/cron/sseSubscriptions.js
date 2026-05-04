// SSE handlers owned by the cron subsystem. Registered from bot.js when both
// ENABLE_CRON and ENABLE_SSE are true. Lives here (not in src/sseHandlers.js)
// so cron's reactive triggers stay co-located with its scheduled jobs.

const { onAction } = require('../sseClient');
const { tournament_live_channel } = require('../data/discord/channel');
const api = require('./apiClient');

const STATE_POST_MATCH = 6;

// Track which matches we've already posted results for (process lifetime only).
// Combined with the `status === POST_MATCH` gate, this prevents duplicate
// posts when a reconnect replays events or the same event somehow fires twice.
const postedResults = new Set();

function matchLabel(match) {
    if (!match?.players?.length) return 'Match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function matchLink(matchId) {
    return `https://bottosjunkyard.com/matches/${matchId}`;
}

function scoreLine(match) {
    if (!match?.players?.length || !match?.races?.length) return null;
    const wins = match.players.map(() => 0);
    for (const race of match.races) {
        if (!race?.winner?.id) continue;
        const idx = match.players.findIndex(p => p.id === race.winner.id);
        if (idx >= 0) wins[idx]++;
    }
    return wins.join(' — ');
}

function resolveWinner(match) {
    if (match?.winner?.username) return match.winner.username;
    return null;
}

function makeResultsHandler(client) {
    return async (event) => {
        const matchId = event.id;
        if (!matchId) return;
        // Gate: only post when the match actually transitions to POST_MATCH.
        if (event?.payload?.status !== STATE_POST_MATCH) return;
        if (postedResults.has(matchId)) return;

        let match;
        try {
            match = await api.getMatch(matchId);
        } catch (err) {
            console.error('[cron/sse] getMatch failed for results post', matchId, err?.message ?? err);
            return;
        }
        if (!match) return;

        const channel = client.channels.cache.get(tournament_live_channel);
        if (!channel) {
            console.warn('[cron/sse] tournament_live_channel not in cache, skipping results post for', matchId);
            return;
        }

        const lines = [`**${matchLabel(match)}** — match complete`];
        const score = scoreLine(match);
        if (score) lines.push(`Score: ${score}`);
        const winner = resolveWinner(match);
        if (winner) lines.push(`Winner: **${winner}**`);
        lines.push(matchLink(matchId));

        try {
            await channel.send(lines.join('\n'));
            postedResults.add(matchId);
        } catch (err) {
            console.error('[cron/sse] results post failed', matchId, err?.message ?? err);
        }
    };
}

function start(client) {
    onAction('match.verifyResults', makeResultsHandler(client));
    console.log('[cron/sse] subscribed to match.verifyResults for results posts');
}

module.exports = { start };
