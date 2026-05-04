// Thin wrapper around axiosClient for cron/system-mode calls.
//
// IMPORTANT: the backend interprets `x-bot-token` header + no `x-user-id` +
// no `meta.user` as trusted system mode (admin role, no user impersonation).
// The default axiosClient in ../axios.js already has x-bot-token without
// x-user-id, so we just call it directly. Avoid going through
// requestWithUser() here, since that would inject meta.user and kick us out
// of system mode.

const { axiosClient } = require('../axios');

async function syncSpeedgaming() {
    const { data } = await axiosClient.post('sync-speedgaming');
    return data;
}

/**
 * @param {Object} opts
 * @param {number} opts.from Unix-ms lower bound (inclusive) for scheduledStart
 * @param {number} opts.to   Unix-ms upper bound (inclusive)
 * @param {number} [opts.status] optional match.status filter (e.g. 0 = SCHEDULED)
 */
async function getMatchesInWindow({ from, to, status } = {}) {
    const params = {};
    if (from !== undefined) params.scheduledStart_gte = from;
    if (to !== undefined) params.scheduledStart_lte = to;
    if (status !== undefined) params.status = status;
    const { data } = await axiosClient.get('matches', { params });
    // GET /matches returns { data: [...] } for list endpoints
    return data?.data ?? data ?? [];
}

async function getMatch(matchId) {
    const { data } = await axiosClient.get(`matches/${matchId}`);
    return data?.data ?? data;
}

/**
 * Mark a reminder key as sent on a match. Idempotent.
 * Routes through /internal/matches/:id/reminders/:key so the backend can use
 * Firestore dot-notation to update one nested field without overwriting the
 * whole remindersSent map (the generic PATCH path would strip it as an
 * unknown Joi key).
 */
async function markReminderSent(matchId, key) {
    const { data } = await axiosClient.post(`internal/matches/${matchId}/reminders/${key}`);
    return data;
}

async function patchMatch(matchId, fields) {
    const { data } = await axiosClient.patch(`matches/${matchId}`, {
        data: fields,
    });
    return data;
}

async function createBet(bet) {
    const { data } = await axiosClient.post('bets', { data: bet });
    return data?.data ?? data;
}

async function getBet(betId) {
    const { data } = await axiosClient.get(`bets/${betId}`);
    return data?.data ?? data;
}

async function settleBet(betId, winningOutcome) {
    const { data } = await axiosClient.patch(`bets/${betId}`, {
        data: { status: 'complete', winningOutcome },
    });
    return data;
}

module.exports = {
    syncSpeedgaming,
    getMatchesInWindow,
    getMatch,
    markReminderSent,
    patchMatch,
    createBet,
    getBet,
    settleBet,
};
