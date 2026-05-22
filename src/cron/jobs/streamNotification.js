const scheduler = require('../scheduler');
const api = require('../apiClient');
const { toMs } = require('../timestamps');
const { streams_channel } = require('../../data/discord/channel');

const LEAD_MS = 10 * 60 * 1000; // 10 minutes
const BACK_MS = 30 * 60 * 1000; // don't backfill notifications for matches already 30m in
const STREAM_KEY = 'stream10min';

function matchLabel(match) {
    if (!match?.players?.length) return 'Match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function matchLink(matchId) {
    return `https://bottosjunkyard.com/matches/${matchId}`;
}

function startTag(ms) {
    return `<t:${Math.floor(ms / 1000)}:R>`;
}

let running = false;

scheduler.register({
    name: 'streamNotification',
    schedule: '* * * * *', // every minute
    async run(client) {
        if (running) return;
        running = true;
        const now = Date.now();
        try {
            // Match may already have flipped to MATCH_SETUP (status=1) by the
            // 1h cron, so we check both 0 and 1 here. Doing two queries beats
            // fetching every match in the system.
            const [scheduled, setup] = await Promise.all([
                api.listMatches({ status: 0 }),
                api.listMatches({ status: 1 }),
            ]);
            const candidates = [...scheduled, ...setup];
            if (!candidates.length) return;

            const channel = client.channels.cache.get(streams_channel);
            if (!channel) {
                console.warn('[cron:streamNotification] streams_channel not in cache, skipping');
                return;
            }

            for (const match of candidates) {
                if (match?.remindersSent?.[STREAM_KEY]) continue;
                const startMs = toMs(match.scheduledStart);
                if (startMs == null) continue;
                if (startMs - now > LEAD_MS) continue;
                if (now - startMs > BACK_MS) continue;

                const streamUrl = match?.streams?.[0]?.url;
                const lines = [
                    `**${matchLabel(match)}** goes live ${startTag(startMs)}`,
                ];
                if (streamUrl) lines.push(`Watch: ${streamUrl}`);
                lines.push(matchLink(match.id));

                try {
                    await channel.send(lines.join('\n'));
                } catch (err) {
                    console.error(`[cron:streamNotification] post failed for ${match.id}`, err?.message ?? err);
                    continue;
                }

                try {
                    await api.markReminderSent(match.id, STREAM_KEY);
                } catch (err) {
                    console.error(`[cron:streamNotification] mark ${STREAM_KEY} failed for ${match.id}`, err?.message ?? err);
                }
            }
        } finally {
            running = false;
        }
    },
});
