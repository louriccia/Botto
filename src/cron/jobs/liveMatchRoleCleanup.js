const scheduler = require('../scheduler');
const api = require('../apiClient');
const { swe1r_guild } = require('../../data/discord/guild');

const LIVEMATCH_ROLE_ID = '970995237952569404';
// "Active" = setup through post-race. Status 0 (scheduled) is *before* role
// assignment; 6+ is "match is done, take the role back".
const ACTIVE_STATUSES = [1, 2, 3, 4, 5];

let running = false;

scheduler.register({
    name: 'liveMatchRoleCleanup',
    schedule: '*/10 * * * *',
    async run(client) {
        if (running) return;
        running = true;
        try {
            const matches = await api.listMatches({ status_in: ACTIVE_STATUSES.join(',') });

            const activeDiscordIds = new Set();
            for (const match of matches) {
                for (const p of [...(match.players || []), ...(match.commentators || [])]) {
                    if (p?.discordId) activeDiscordIds.add(p.discordId);
                }
            }

            const guild = await client.guilds.fetch(swe1r_guild).catch(err => {
                console.warn(`[cron:liveMatchRoleCleanup] could not fetch guild ${swe1r_guild}: ${err?.message ?? err}`);
                return null;
            });
            if (!guild) return;

            // Ensure we know who actually has the role right now. Without a
            // fresh members fetch the cache may not include role-holders the
            // bot hasn't touched this session.
            try { await guild.members.fetch(); }
            catch (err) {
                console.warn(`[cron:liveMatchRoleCleanup] members.fetch failed: ${err?.message ?? err}`);
                return;
            }

            const role = guild.roles.cache.get(LIVEMATCH_ROLE_ID);
            if (!role) {
                console.warn(`[cron:liveMatchRoleCleanup] role ${LIVEMATCH_ROLE_ID} not found in guild`);
                return;
            }

            let removed = 0;
            for (const [memberId, member] of role.members) {
                if (activeDiscordIds.has(memberId)) continue;
                try {
                    await member.roles.remove(LIVEMATCH_ROLE_ID, 'No active match');
                    removed++;
                } catch (err) {
                    console.warn(`[cron:liveMatchRoleCleanup] could not remove role from ${memberId}: ${err?.message ?? err}`);
                }
            }
            if (removed) {
                console.log(`[cron:liveMatchRoleCleanup] removed livematch role from ${removed} member(s); ${activeDiscordIds.size} active participant(s)`);
            }
        } finally {
            running = false;
        }
    },
});
