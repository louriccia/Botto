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

            // Build the set of discord ids that should keep the role.
            //
            // Normalize to string: the API sometimes serializes discordId as a
            // Number, but role.members is keyed by a string id, so a Number would
            // silently never match. (Discord snowflakes also exceed
            // Number.MAX_SAFE_INTEGER, so a numeric id is already corrupted before
            // we see it — String()+trim at least makes the comparison type- and
            // whitespace-consistent.)
            //
            // trackers are first-class match participants elsewhere (see
            // canSubmitForPlayer in interactions/tourney/play.js), so they keep the
            // role too — otherwise a tracker on a live match is stripped every cycle.
            const activeDiscordIds = new Set();
            let participantsSeen = 0;
            for (const match of matches) {
                for (const p of [
                    ...(match.players || []),
                    ...(match.commentators || []),
                    ...(match.trackers || []),
                ]) {
                    if (!p) continue;
                    participantsSeen++;
                    const id = p.discordId == null ? '' : String(p.discordId).trim();
                    if (id) activeDiscordIds.add(id);
                }
            }

            // Fail safe: if there ARE active matches with participants but we
            // resolved zero usable discord ids, the participant data is broken —
            // e.g. a SpeedGaming sync linked the match to a duplicate user profile
            // that has no discordId. Stripping now would kick every legitimate
            // holder, so skip this cycle and let an operator repair the data. A
            // role lingering 5 more minutes is far less disruptive than pulling
            // live participants mid-match. (When there are simply no active
            // matches, participantsSeen is 0 and we fall through to clean up
            // normally, which is correct.)
            if (participantsSeen > 0 && activeDiscordIds.size === 0) {
                console.warn(`[cron:liveMatchRoleCleanup] ${matches.length} active match(es) with ${participantsSeen} participant(s) but 0 resolvable discordIds — skipping cleanup to avoid mass-stripping. Check for duplicate/unlinked user profiles.`);
                return;
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
