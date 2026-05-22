const scheduler = require('../scheduler');
const api = require('../apiClient');
const { toMs } = require('../timestamps');
const { tournaments_channel } = require('../../data/discord/channel');

const WINDOW_MS = 48 * 60 * 60 * 1000;
const STATUS_SCHEDULED = 0;

function matchLabel(match) {
    if (!match?.players?.length) return 'Match';
    return match.players.map(p => p?.username || '?').join(' vs ');
}

function matchLink(matchId) {
    return `https://bottosjunkyard.com/matches/${matchId}`;
}

function buildBet(match) {
    const [a, b] = match.players;
    return {
        title: `${matchLabel(match)}`.slice(0, 50),
        status: 'open',
        // scheduledStart is when betting should close — backend coerces the
        // ms number into a Firestore Timestamp via timestampSchema.
        expires: toMs(match.scheduledStart),
        min: 10,
        outcomes: [
            {
                title: `${(a?.username || 'Player A').slice(0, 50)} wins`,
                type: 'this_or_that',
                predictions: [],
            },
            {
                title: `${(b?.username || 'Player B').slice(0, 50)} wins`,
                type: 'this_or_that',
                predictions: [],
            },
            {
                title: 'How many races?',
                type: 'number',
                predictions: [],
            },
        ],
    };
}

let running = false;

scheduler.register({
    name: 'tourneyBet48h',
    // Every 5 minutes. Wider sweep is fine — gated by `match.betId` being
    // unset, so once a bet is created the match is skipped on later passes.
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
                // 48h horizon: any future match starting within 48h gets a bet.
                if (startMs <= now) continue;
                if (startMs - now > WINDOW_MS) continue;

                let createdBet;
                try {
                    createdBet = await api.createBet(buildBet(match));
                } catch (err) {
                    console.error(`[cron:tourneyBet48h] createBet failed for match ${match.id}`, err?.message ?? err);
                    continue;
                }
                if (!createdBet?.id) {
                    console.error(`[cron:tourneyBet48h] createBet returned no id for match ${match.id}`);
                    continue;
                }

                try {
                    await api.patchMatch(match.id, { betId: createdBet.id });
                } catch (err) {
                    console.error(`[cron:tourneyBet48h] attach betId ${createdBet.id} to match ${match.id} failed`, err?.message ?? err);
                    // Leave the bet in place — next pass will see betId still
                    // missing and try again. The bet doc is harmless on its own.
                    continue;
                }

                const channel = client.channels.cache.get(tournaments_channel);
                if (channel) {
                    const lines = [
                        `**${matchLabel(match)}** — bet is open`,
                        `Match: ${matchLink(match.id)}`,
                    ];
                    try { await channel.send(lines.join('\n')); }
                    catch (err) { console.warn(`[cron:tourneyBet48h] notify failed for match ${match.id}: ${err?.message ?? err}`); }
                }

                console.log(`[cron:tourneyBet48h] created bet ${createdBet.id} for match ${match.id}`);
            }
        } finally {
            running = false;
        }
    },
});
