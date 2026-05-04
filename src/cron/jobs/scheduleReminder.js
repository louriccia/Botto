const scheduler = require('../scheduler');
const api = require('../apiClient');
const { dmUser } = require('../dmHelper');

// Days-since-created thresholds and their corresponding reminder keys. Checked
// in order; we fire the FIRST one that applies. Escalating tiers let us nag
// harder as inaction drags on without spamming every day.
const TIERS = [
    { days: 21, key: 'scheduleNag21', tone: 'Still no match date — please schedule ASAP.' },
    { days: 14, key: 'scheduleNag14', tone: 'Two weeks in — please lock in a time.' },
    { days: 7,  key: 'scheduleNag7',  tone: 'Please schedule your match when you get a chance.' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function matchLabel(match) {
    if (!match?.players?.length) return 'Your match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function matchLink(matchId) {
    return `https://bottosjunkyard.com/matches/${matchId}`;
}

let running = false;

scheduler.register({
    name: 'scheduleReminder',
    schedule: '0 12 * * *', // daily at 12:00 UTC
    async run(client) {
        if (running) return;
        running = true;
        const now = Date.now();
        try {
            const all = await api.getMatchesInWindow({ status: 0 });
            for (const match of all) {
                if (match?.scheduledStart) continue; // already scheduled
                if (!match?.createdAt) continue;
                const ageDays = (now - match.createdAt) / DAY_MS;

                const tier = TIERS.find(t => ageDays >= t.days && !match?.remindersSent?.[t.key]);
                if (!tier) continue;

                const message = {
                    content: `${tier.tone}\n${matchLabel(match)}\n${matchLink(match.id)}`,
                };

                for (const p of (match.players || [])) {
                    if (!p?.discordId) continue;
                    await dmUser(client, p.discordId, message, { context: `match ${match.id} ${tier.key}` });
                }

                try {
                    await api.markReminderSent(match.id, tier.key);
                } catch (err) {
                    console.error(`[cron:scheduleReminder] mark ${tier.key} failed for ${match.id}`, err?.message ?? err);
                }
            }
        } finally {
            running = false;
        }
    },
});
