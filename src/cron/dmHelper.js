const { droid_testing } = require('../data/discord/channel');

/**
 * Best-effort DM to a Discord user by id. Handles DMs-disabled gracefully.
 * Returns true on success, false on any failure.
 *
 * @param {import('discord.js').Client} client
 * @param {string} discordId Discord snowflake user id
 * @param {string | import('discord.js').MessagePayload | import('discord.js').MessageCreateOptions} payload
 * @param {object} [opts]
 * @param {string} [opts.context] short string included in failure log so admins know why we were trying to DM
 */
async function dmUser(client, discordId, payload, { context = '' } = {}) {
    if (!discordId) return false;
    try {
        const user = await client.users.fetch(discordId);
        await user.send(payload);
        return true;
    } catch (err) {
        const msg = `[cron/dm] failed to DM <@${discordId}>${context ? ` (${context})` : ''}: ${err?.code ?? ''} ${err?.message ?? err}`;
        console.warn(msg);
        // Mirror to droid-testing for visibility. Don't let logging failures
        // mask the original failure; swallow and return false.
        try {
            const log = client.channels.cache.get(droid_testing);
            if (log) await log.send(msg);
        } catch (_) { /* ignore */ }
        return false;
    }
}

module.exports = { dmUser };
