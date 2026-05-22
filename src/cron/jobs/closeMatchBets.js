const scheduler = require('../scheduler');
const api = require('../apiClient');

// Status values that count as "match is over for betting purposes":
// 6 POST_MATCH, 7 FORFEITED, 99 CANCELLED.
const FINISHED_STATUSES = [6, 7, 99];

let running = false;

scheduler.register({
    name: 'closeMatchBets',
    schedule: '*/5 * * * *',
    async run(_client) {
        if (running) return;
        running = true;
        try {
            // Firestore `in` operator caps at 10, but we only have 3 values.
            const matches = await api.listMatches({ status_in: FINISHED_STATUSES.join(',') });
            for (const match of matches) {
                if (!match?.betId) continue;

                let bet;
                try {
                    bet = await api.getBet(match.betId);
                } catch (err) {
                    console.warn(`[cron:closeMatchBets] getBet ${match.betId} for match ${match.id} failed: ${err?.message ?? err}`);
                    continue;
                }
                if (!bet || bet.status !== 'open') continue;

                try {
                    await api.patchBet(match.betId, { status: 'closed' });
                    console.log(`[cron:closeMatchBets] closed bet ${match.betId} for match ${match.id}`);
                } catch (err) {
                    console.error(`[cron:closeMatchBets] patchBet ${match.betId} failed`, err?.message ?? err);
                }
            }
        } finally {
            running = false;
        }
    },
});
