const scheduler = require('../scheduler');
const api = require('../apiClient');

scheduler.register({
    name: 'syncSpeedgaming',
    // Every 5 minutes. speedgaming.org's public schedule endpoint is fine with
    // this cadence; the backend sync upserts by speedgamingId so duplicates
    // across runs are harmless.
    schedule: '*/5 * * * *',
    async run(_client) {
        const result = await api.syncSpeedgaming();
        const summary = result?.data ?? result;
        console.log('[cron:syncSpeedgaming] result:', JSON.stringify(summary)?.slice(0, 500));
    },
});
