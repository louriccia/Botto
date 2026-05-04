// Scaffold for daily/weekly/monthly challenge posts. Content source and
// channel routing are TBD — leave disabled in jobs/index.js until the
// challenge content pipeline is defined.

const scheduler = require('../scheduler');

scheduler.register({
    name: 'dailyChallenge',
    schedule: '0 0 * * *', // 00:00 UTC daily
    async run(_client) {
        // TODO: fetch today's challenge from the backend and post to the
        // community-challenge channel. Skipping until content source defined.
        console.log('[cron:dailyChallenge] stub — not yet implemented');
    },
});

scheduler.register({
    name: 'weeklyChallenge',
    schedule: '0 0 * * 1', // Mondays 00:00 UTC
    async run(_client) {
        console.log('[cron:weeklyChallenge] stub — not yet implemented');
    },
});

scheduler.register({
    name: 'monthlyChallenge',
    schedule: '0 0 1 * *', // 1st of month 00:00 UTC
    async run(_client) {
        console.log('[cron:monthlyChallenge] stub — not yet implemented');
    },
});
