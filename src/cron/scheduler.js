const cron = require('node-cron');

// Each registered job: { name, schedule (cron expr), run(client) }
const jobs = [];

function register(job) {
    if (!job || !job.name || !job.schedule || typeof job.run !== 'function') {
        throw new Error(`[cron] invalid job registration: ${JSON.stringify(job)}`);
    }
    jobs.push(job);
}

function start(client) {
    if (jobs.length === 0) {
        console.log('[cron] no jobs registered, scheduler idle');
        return;
    }
    for (const job of jobs) {
        cron.schedule(job.schedule, async () => {
            const startedAt = Date.now();
            console.log(`[cron:${job.name}] start`);
            try {
                await job.run(client);
                console.log(`[cron:${job.name}] done in ${Date.now() - startedAt}ms`);
            } catch (err) {
                console.error(`[cron:${job.name}] threw`, err);
            }
        });
        console.log(`[cron] scheduled "${job.name}" (${job.schedule})`);
    }
}

module.exports = { register, start, _jobs: jobs };
