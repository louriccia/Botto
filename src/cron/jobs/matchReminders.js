const scheduler = require('../scheduler');
const api = require('../apiClient');
const { dmUser } = require('../dmHelper');
const { streams_channel } = require('../../data/discord/channel');

// Tuning constants. Kept here so ops can adjust one file and redeploy.
const PLAYERS_LEAD_MS = 24 * 60 * 60 * 1000; // 24 h
const STREAM_LEAD_MS = 10 * 60 * 1000;       // 10 min
const TICK_WINDOW_MS = 60 * 1000;            // 1 min — must match cron period
const PLAYERS_KEY = 'players24h';
const STREAM_KEY = 'stream10min';

// Mutex — prevents overlapping runs if an API call is slow.
let running = false;

function tsTag(scheduledStart) {
    // Discord renders <t:unix:R> as relative time, auto-updating client-side.
    const unix = Math.floor(scheduledStart / 1000);
    return `<t:${unix}:R>`;
}

function matchLabel(match) {
    if (!match?.players?.length) return 'Your match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function matchLink(match) {
    // Path matches the junkyard frontend route.
    return `https://bottosjunkyard.com/matches/${match.id}`;
}

async function doPlayersReminder(client, now) {
    const from = now + PLAYERS_LEAD_MS;
    const to = from + TICK_WINDOW_MS;
    const candidates = await api.getMatchesInWindow({ from, to, status: 0 });

    for (const match of candidates) {
        if (match?.remindersSent?.[PLAYERS_KEY]) continue;

        const participants = [
            ...(match.players || []),
            ...(match.commentators || []),
            ...(match.trackers || []),
        ].filter(Boolean);

        const message = {
            content: `Your match (${matchLabel(match)}) starts ${tsTag(match.scheduledStart)}.\n${matchLink(match)}`,
        };

        for (const p of participants) {
            if (!p?.discordId) continue;
            await dmUser(client, p.discordId, message, { context: `match ${match.id} 24h` });
        }

        try {
            await api.markReminderSent(match.id, PLAYERS_KEY);
        } catch (err) {
            console.error(`[cron:matchReminders] mark ${PLAYERS_KEY} failed for ${match.id}`, err?.message ?? err);
        }
    }
}

async function doStreamReminder(client, now) {
    const from = now + STREAM_LEAD_MS;
    const to = from + TICK_WINDOW_MS;
    const candidates = await api.getMatchesInWindow({ from, to, status: 0 });
    if (candidates.length === 0) return;

    const channel = client.channels.cache.get(streams_channel);
    if (!channel) {
        console.warn('[cron:matchReminders] streams_channel not in cache, skipping stream reminders');
        return;
    }

    for (const match of candidates) {
        if (match?.remindersSent?.[STREAM_KEY]) continue;

        const streamUrl = match?.streams?.[0]?.url;
        const lines = [
            `**${matchLabel(match)}** goes live ${tsTag(match.scheduledStart)}`,
        ];
        if (streamUrl) lines.push(`Watch: ${streamUrl}`);
        lines.push(matchLink(match));

        try {
            await channel.send(lines.join('\n'));
            await api.markReminderSent(match.id, STREAM_KEY);
        } catch (err) {
            console.error(`[cron:matchReminders] stream post failed for ${match.id}`, err?.message ?? err);
        }
    }
}

scheduler.register({
    name: 'matchReminders',
    schedule: '* * * * *', // every minute
    async run(client) {
        if (running) {
            console.log('[cron:matchReminders] prior run still in flight, skipping');
            return;
        }
        running = true;
        const now = Date.now();
        try {
            await doPlayersReminder(client, now);
            await doStreamReminder(client, now);
        } finally {
            running = false;
        }
    },
});
