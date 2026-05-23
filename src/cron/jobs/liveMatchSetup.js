const { MessageFlags } = require('discord.js');
const scheduler = require('../scheduler');
const api = require('../apiClient');
const { toMs } = require('../timestamps');
const { tournament_live_channel } = require('../../data/discord/channel');
const { swe1r_guild } = require('../../data/discord/guild');
const { setupMatchView } = require('../../interactions/tourney/functions');
const { tournamentsRulesetsCache } = require('../../services/tourneyCache');

const LIVEMATCH_ROLE_ID = '970995237952569404';
const LEAD_MS = 60 * 60 * 1000; // 1 hour
const STATUS_SCHEDULED = 0;
const STATUS_SETUP = 1;

function matchLabel(match) {
    if (!match?.players?.length) return 'Match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function startTag(scheduledStartMs) {
    return `<t:${Math.floor(scheduledStartMs / 1000)}:R>`;
}

async function ensureRole(guild, discordId) {
    if (!discordId) return false;
    try {
        const member = await guild.members.fetch(discordId);
        if (member.roles.cache.has(LIVEMATCH_ROLE_ID)) return true;
        await member.roles.add(LIVEMATCH_ROLE_ID, 'Live match participant');
        return true;
    } catch (err) {
        console.warn(`[cron:liveMatchSetup] could not add livematch role to ${discordId}: ${err?.message ?? err}`);
        return false;
    }
}

let running = false;

scheduler.register({
    name: 'liveMatchSetup',
    // Every minute. Status flip (0 -> 1) provides idempotency: once the match
    // is moved into MATCH_SETUP the listMatches({status:0}) query no longer
    // sees it.
    schedule: '* * * * *',
    async run(client) {
        if (running) return;
        running = true;
        const now = Date.now();
        try {
            const matches = await api.listMatches({ status: STATUS_SCHEDULED });
            if (!matches.length) return;

            const channel = client.channels.cache.get(tournament_live_channel);
            if (!channel) {
                console.warn(`[cron:liveMatchSetup] tournament_live_channel ${tournament_live_channel} not in cache, skipping`);
                return;
            }

            const guild = await client.guilds.fetch(swe1r_guild).catch(err => {
                console.warn(`[cron:liveMatchSetup] could not fetch guild ${swe1r_guild}: ${err?.message ?? err}`);
                return null;
            });
            if (!guild) return;

            for (const match of matches) {
                const startMs = toMs(match.scheduledStart);
                if (startMs == null) continue;
                // Fire when start is within the next hour. Small back-window
                // catches matches whose start time just crossed zero while the
                // cron was off.
                if (startMs - now > LEAD_MS) continue;
                if (startMs - now < -5 * 60 * 1000) continue;

                // Patch channelId + status together. The channelId binding is
                // what lets the setup view's buttons resolve the right match
                // via client.channelToMatch.get(channel.id).
                try {
                    await api.patchMatch(match.id, {
                        channelId: tournament_live_channel,
                        status: STATUS_SETUP,
                    });
                } catch (err) {
                    console.error(`[cron:liveMatchSetup] patchMatch failed for ${match.id}`, err?.message ?? err);
                    continue;
                }

                // Re-fetch so we render with the enriched tournament/ruleset
                // objects and the freshly-set channelId/status.
                let fresh;
                try {
                    fresh = await api.getMatch(match.id);
                } catch (err) {
                    console.warn(`[cron:liveMatchSetup] re-fetch failed for ${match.id}, falling back to local match`, err?.message ?? err);
                    fresh = { ...match, channelId: tournament_live_channel, status: STATUS_SETUP };
                }

                // Bind channel → match in the in-process cache so the setup
                // view's buttons (Join/Commentate/Start/Leave/Cancel) resolve
                // immediately without waiting for the next bot restart's
                // matchCacheHydrate. Only the most recent match wins the
                // mapping for this channel — at typical match cadence that's
                // the one users care about.
                client.channelToMatch.set(tournament_live_channel, fresh);

                // Add the livematch role to every player + commentator.
                const participants = [
                    ...(fresh.players || []),
                    ...(fresh.commentators || []),
                ].filter(p => p?.discordId);
                for (const p of participants) {
                    await ensureRole(guild, p.discordId);
                }

                // Render the same interactive setup view that /tourney play
                // produces, in the tournament-live channel directly.
                let tournaments = [], rulesets = [];
                try {
                    [tournaments, rulesets] = await Promise.all([
                        tournamentsRulesetsCache.getTournaments(),
                        tournamentsRulesetsCache.getRulesets(),
                    ]);
                } catch (err) {
                    console.warn(`[cron:liveMatchSetup] tournaments/rulesets cache fetch failed`, err?.message ?? err);
                }

                const view = setupMatchView({ match: fresh, tournaments, rulesets });

                try {
                    await channel.send({
                        content: `<@&${LIVEMATCH_ROLE_ID}> **${matchLabel(fresh)}** — match starts ${startTag(startMs)}`,
                        allowedMentions: { roles: [LIVEMATCH_ROLE_ID] },
                    });
                    await channel.send({ flags: MessageFlags.IsComponentsV2, components: [view] });
                } catch (err) {
                    console.error(`[cron:liveMatchSetup] setup post failed for ${match.id}`, err?.message ?? err);
                }

                console.log(`[cron:liveMatchSetup] match ${match.id} → SETUP, ${participants.length} participants role'd`);
            }
        } finally {
            running = false;
        }
    },
});
