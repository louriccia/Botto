const scheduler = require('../scheduler');
const api = require('../apiClient');
const { toMs } = require('../timestamps');
const { tournaments_channel } = require('../../data/discord/channel');
const { database } = require('../../firebase');
const { betEmbed, betComponents } = require('../../interactions/trugut_functions');
const { postMessage } = require('../../discord');

const WINDOW_MS = 48 * 60 * 60 * 1000;
const STATUS_SCHEDULED = 0;

// Hardcoded Botto author snapshot — bets in the RTDB use a free-form `author`
// object (not the Firestore userSnapshot schema). Matches the legacy
// sg_event.js shape so the existing betEmbed/betComponents and `/truguts bet`
// admin tooling render this bet identically to ones posted before migration.
const BOTTO_AUTHOR = {
    name: 'Botto',
    avatar: 'https://cdn.discordapp.com/avatars/545798436105224203/5e4668356877db6367e4f51017124aaa.webp',
    id: '',
    discordId: '545798436105224203',
};

function matchLabel(match) {
    if (!match?.players?.length) return 'Match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function tourneyPrefix(match) {
    const name = match?.tournament?.name;
    return name ? `${name}: ` : '';
}

function buildBet(match, scheduledStartMs) {
    const [a, b] = match.players;
    return {
        author: BOTTO_AUTHOR,
        title: `${tourneyPrefix(match)}${matchLabel(match)}`.slice(0, 100),
        status: 'open',
        type: 'tourney',
        // Legacy field — bet closes at match start. Stored as Unix ms.
        close: scheduledStartMs,
        outcomes: [
            { title: `${a?.username || 'Player A'} Wins`, type: 'this_or_that', id: a?.discordId || '' },
            { title: `${b?.username || 'Player B'} Wins`, type: 'this_or_that', id: b?.discordId || '' },
            { title: 'How many races?', type: 'number' },
        ],
        min: 10,
        max: 0,
    };
}

let running = false;

scheduler.register({
    name: 'tourneyBet48h',
    // Every 5 minutes. Gated by `match.betId` being unset, so once a bet is
    // created (with the Discord message id as the betId) the match is skipped
    // on later passes.
    schedule: '*/5 * * * *',
    async run(client) {
        if (running) return;
        running = true;
        const now = Date.now();
        try {
            const matches = await api.listMatches({ status: STATUS_SCHEDULED });
            for (const match of matches) {
                if (match.betId) continue;
                if (!match.players || match.players.length !== 2) continue;
                const startMs = toMs(match.scheduledStart);
                if (startMs == null) continue;
                if (startMs <= now) continue;
                if (startMs - now > WINDOW_MS) continue;

                const bet = buildBet(match, startMs);

                let betMessage;
                try {
                    betMessage = await postMessage(client, tournaments_channel, {
                        embeds: [betEmbed(bet)],
                        components: betComponents(bet),
                    });
                } catch (err) {
                    console.error(`[cron:tourneyBet48h] post failed for match ${match.id}`, err?.message ?? err);
                    continue;
                }
                if (!betMessage?.id) {
                    console.error(`[cron:tourneyBet48h] post returned no message for match ${match.id}`);
                    continue;
                }

                // Best-effort pin so the bet stays visible in #tournaments.
                betMessage.pin().catch(err => {
                    console.warn(`[cron:tourneyBet48h] pin failed for bet ${betMessage.id}: ${err?.message ?? err}`);
                });

                // Write the bet to RTDB keyed by Discord message id — the
                // /truguts handlers read/write at this exact path.
                try {
                    await database.ref('tourney/bets').child(betMessage.id).set(bet);
                } catch (err) {
                    console.error(`[cron:tourneyBet48h] RTDB write failed for ${betMessage.id}`, err?.message ?? err);
                    // Delete the orphan message so we don't leave a stale embed
                    // pointing at no bet record.
                    betMessage.delete().catch(() => { });
                    continue;
                }

                // Link the bet message id back onto the Firestore match. We
                // store the Discord message id in `betId` so the close-bets
                // cron can find the RTDB bet later.
                try {
                    await api.patchMatch(match.id, { betId: betMessage.id });
                } catch (err) {
                    console.error(`[cron:tourneyBet48h] patchMatch betId failed for ${match.id}`, err?.message ?? err);
                    // Bet exists and is reachable through #tournaments, but
                    // the match won't auto-close it. Leave both in place and
                    // let next pass try again (it'll detect betId still
                    // missing).
                    continue;
                }

                console.log(`[cron:tourneyBet48h] created bet ${betMessage.id} for match ${match.id}`);
            }
        } finally {
            running = false;
        }
    },
});
