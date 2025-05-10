const axios = require('axios');

const axiosClient = axios.create({
    baseURL: process.env.BOTTO_API_BASE_URL, // Set your API base URL
    timeout: 5000, // Optional: Set a request timeout
    headers: {
        'Content-Type': 'application/json',
        "x-bot-token": process.env.BOT_API_KEY
    },
});

/**
 * Makes an authenticated API request on behalf of a Discord user.
 * 
 * @param {Object} options - The request options.
 * @param {string} options.method - The HTTP method (e.g., 'post', 'get').
 * @param {string} options.url - The API endpoint (e.g., '/match/abc123/submit').
 * @param {Object} options.user - The Discord user (msg.author or interaction.user).
 * @param {Object} [options.data] - The core payload.
 * @param {Object} [options.meta] - Metadata such as user snapshot.
 * @param {Object} [options.query] - Optional query params (for GETs).
 * @returns {Promise<any>} - The API response data.
 */
async function requestWithUser({ method, url, userSnapshot, data = {}, meta = {}, query }) {
    const headers = {
        'x-user-id': userSnapshot.discordId,
        'x-bot-token': process.env.BOT_API_KEY
    };

    const body = {
        data,
        meta: {
            user: userSnapshot,
            ...meta
        }
    };

    const config = {
        method,
        url,
        headers
    };

    if (method.toLowerCase() === 'get') {
        config.params = query || {};
    } else {
        config.data = body;
    }

    try {
        const res = await axiosClient(config);
        return res.data;
    } catch (err) {
        // Normalize the error so callers can safely inspect it
        const apiError = {
            status: err.response?.status || 500,
            message: err.response?.data?.error || err.message || 'Unknown error',
            raw: err.response?.data || err
        };

        // Optional: log here if this is unexpected or critical
        console.error(`[API ERROR] ${method.toUpperCase()} ${url}:`, apiError);

        // Let the caller handle it
        throw apiError;
    }
}

module.exports = { requestWithUser, axiosClient };