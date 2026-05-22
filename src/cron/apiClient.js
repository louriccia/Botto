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
    const { data } = await axiosClient.post('internal/sync-speedgaming');
    return data;
}

/**
 * List matches with arbitrary filters supported by GenericService
 * (e.g. `status`, `status_in: '6,7,99'`, `tournament`).
 *
 * Range filters on timestamp fields (`scheduledStart_gte`, etc.) are NOT
 * usable here because the backend stores those as Firestore Timestamps and
 * `_coerceFilterValue` ships the bound as a Number — Firestore won't match
 * Number bounds against Timestamp fields. Cron jobs do range filtering
 * client-side via toMs() after fetching by status.
 */
async function listMatches(filters = {}) {
    const params = {};
    for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null) params[k] = v;
    }
    const { data } = await axiosClient.get('matches', { params });
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

async function patchBet(betId, fields) {
    const { data } = await axiosClient.patch(`bets/${betId}`, { data: fields });
    return data?.data ?? data;
}

module.exports = {
    syncSpeedgaming,
    listMatches,
    getMatch,
    markReminderSent,
    patchMatch,
    createBet,
    getBet,
    patchBet,
};
