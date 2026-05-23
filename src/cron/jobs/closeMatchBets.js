const scheduler = require('../scheduler');
const api = require('../apiClient');
const { database } = require('../../firebase');
const { betEmbed, betComponents } = require('../../interactions/trugut_functions');
const { editMessage } = require('../../discord');
const { tournaments_channel } = require('../../data/discord/channel');

// 6 POST_MATCH, 7 FORFEITED, 99 CANCELLED.
const FINISHED_STATUSES = [6, 7, 99];

let running = false;

async function readBet(betId) {
    const snap = await database.ref(`tourney/bets/${betId}`).once('value');
    return snap.val();
}

scheduler.register({
    name: 'closeMatchBets',
    schedule: '*/5 * * * *',
    async run(client) {
        if (running) return;
        running = true;
        try {
            const matches = await api.listMatches({ status_in: FINISHED_STATUSES.join(',') });
            for (const match of matches) {
                if (!match?.betId) continue;

                let bet;
                try {
                    bet = await readBet(match.betId);
                } catch (err) {
                    console.warn(`[cron:closeMatchBets] read bet ${match.betId} for match ${match.id} failed: ${err?.message ?? err}`);
                    continue;
                }
                if (!bet) continue; // no RTDB bet under that key (manually deleted, etc.)
                if (bet.status !== 'open') continue;

                try {
                    await database.ref(`tourney/bets/${match.betId}/status`).set('closed');
                } catch (err) {
                    console.error(`[cron:closeMatchBets] status write failed for ${match.betId}`, err?.message ?? err);
                    continue;
                }

                // Refresh the Discord embed so users see the closed state and
                // the bet/admin buttons re-render to match.
                const closed = { ...bet, status: 'closed' };
                try {
                    editMessage(client, tournaments_channel, match.betId, {
                        embeds: [betEmbed(closed)],
                        components: betComponents(closed),
                    });
                } catch (err) {
                    console.warn(`[cron:closeMatchBets] editMessage failed for ${match.betId}: ${err?.message ?? err}`);
                }

                console.log(`[cron:closeMatchBets] closed bet ${match.betId} for match ${match.id}`);
            }
        } finally {
            running = false;
        }
    },
});
