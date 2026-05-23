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
    schedule: '*/5 * * * *',
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

            // Force-fetch the role so role.members is populated even on a
            // fresh process. guild.roles.cache.get can return undefined if
            // the role hasn't been touched since startup.
            let role;
            try {
                role = await guild.roles.fetch(LIVEMATCH_ROLE_ID);
            } catch (err) {
                console.warn(`[cron:liveMatchRoleCleanup] roles.fetch(${LIVEMATCH_ROLE_ID}) failed: ${err?.message ?? err}`);
                return;
            }
            if (!role) {
                console.warn(`[cron:liveMatchRoleCleanup] role ${LIVEMATCH_ROLE_ID} not found in guild`);
                return;
            }

            // role.members is built from the local member cache. Without a
            // full member fetch we miss anyone the bot hasn't interacted with
            // this session — exactly the people the cron is supposed to be
            // cleaning up after.
            try { await guild.members.fetch(); }
            catch (err) {
                console.warn(`[cron:liveMatchRoleCleanup] members.fetch failed: ${err?.message ?? err}`);
                return;
            }

            const holders = role.members;
            console.log(`[cron:liveMatchRoleCleanup] ${holders.size} holders, ${activeDiscordIds.size} active participants`);

            let removed = 0, kept = 0;
            for (const [memberId, member] of holders) {
                if (activeDiscordIds.has(memberId)) { kept++; continue; }
                try {
                    await member.roles.remove(LIVEMATCH_ROLE_ID, 'No active match');
                    removed++;
                } catch (err) {
                    console.warn(`[cron:liveMatchRoleCleanup] could not remove role from ${memberId}: ${err?.message ?? err}`);
                }
            }
            if (removed || kept) {
                console.log(`[cron:liveMatchRoleCleanup] removed=${removed}, kept=${kept}`);
            }
        } finally {
            running = false;
        }
    },
});
