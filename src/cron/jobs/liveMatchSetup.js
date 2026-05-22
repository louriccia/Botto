const { ChannelType, MessageFlags } = require('discord.js');
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
const THREAD_AUTO_ARCHIVE_MIN = 1440; // 24h

function matchLabel(match) {
    if (!match?.players?.length) return 'Match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function threadName(match) {
    // Discord thread names cap at 100 chars.
    const tourney = match?.tournament?.name ? `[${match.tournament.name}] ` : '';
    return `${tourney}${matchLabel(match)}`.slice(0, 100);
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

            const parent = client.channels.cache.get(tournament_live_channel);
            if (!parent) {
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
                // Defensive: a channelId already set means someone (probably
                // /tourney play) bound the match to a Discord channel before
                // we got here. Don't spawn a duplicate thread.
                if (match.channelId) continue;

                // Create the thread first so we have a channelId to write
                // back. A failure here aborts the rest of the work for this
                // match — next pass will retry.
                let thread;
                try {
                    thread = await parent.threads.create({
                        name: threadName(match),
                        autoArchiveDuration: THREAD_AUTO_ARCHIVE_MIN,
                        type: ChannelType.PublicThread,
                        reason: `Match setup for ${match.id}`,
                    });
                } catch (err) {
                    console.error(`[cron:liveMatchSetup] thread.create failed for match ${match.id}`, err?.message ?? err);
                    continue;
                }

                // Patch channelId + status together. If this fails the thread
                // is orphaned, but the next cron pass sees status=0 and
                // channelId still empty (PATCH didn't land), so it'll create
                // a fresh thread and try again. Old orphan stays parked.
                try {
                    await api.patchMatch(match.id, { channelId: thread.id, status: STATUS_SETUP });
                } catch (err) {
                    console.error(`[cron:liveMatchSetup] patchMatch failed for ${match.id}`, err?.message ?? err);
                    continue;
                }

                // Re-fetch so we render with the enriched tournament/ruleset
                // objects (the PATCH response goes through the same enrichment,
                // but a fresh GET is also cached and matches what the API will
                // serve everyone else).
                let fresh;
                try {
                    fresh = await api.getMatch(match.id);
                } catch (err) {
                    console.warn(`[cron:liveMatchSetup] re-fetch failed for ${match.id}, falling back to local match`, err?.message ?? err);
                    fresh = { ...match, channelId: thread.id, status: STATUS_SETUP };
                }

                // Bind the thread → match in the in-process cache so the
                // setup view's buttons (Join/Commentate/Start/Leave/Cancel)
                // resolve via channelToMatch.get(channel.id) without waiting
                // for the next bot restart's matchCacheHydrate.
                client.channelToMatch.set(thread.id, fresh);

                // Add the livematch role to every player + commentator.
                const participants = [
                    ...(fresh.players || []),
                    ...(fresh.commentators || []),
                ].filter(p => p?.discordId);
                for (const p of participants) {
                    await ensureRole(guild, p.discordId);
                }

                // Render the same interactive setup view that /tourney play
                // produces. Buttons route through the existing tourney_play_*
                // handlers, which only need the channelToMatch binding above.
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
                    await thread.send({
                        content: `<@&${LIVEMATCH_ROLE_ID}> match starts ${startTag(startMs)}`,
                        allowedMentions: { roles: [LIVEMATCH_ROLE_ID] },
                    });
                    await thread.send({ flags: MessageFlags.IsComponentsV2, components: [view] });
                } catch (err) {
                    console.error(`[cron:liveMatchSetup] setup post failed for ${match.id}`, err?.message ?? err);
                }

                console.log(`[cron:liveMatchSetup] match ${match.id} → thread ${thread.id}, ${participants.length} participants role'd`);
            }
        } finally {
            running = false;
        }
    },
});
