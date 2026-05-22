// Helpers for working with Firestore Timestamp values across the wire.
//
// After bottos-junkyard a957a36, match/bet timestamp fields (scheduledStart,
// createdAt, displayDate, etc.) are stored as Firestore Timestamps. Over JSON
// they serialize as { _seconds, _nanoseconds } or { seconds, nanoseconds }
// depending on path. The cron jobs need a single point of truth for turning
// "whatever the API returned" into Unix-ms for arithmetic and window checks.

function toMs(value) {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    // Firestore Timestamp (admin SDK toJSON shape, REST shape, or live instance)
    const seconds = value._seconds ?? value.seconds;
    const nanos = value._nanoseconds ?? value.nanoseconds ?? 0;
    if (typeof seconds === 'number') {
        return seconds * 1000 + Math.floor(nanos / 1e6);
    }
    if (typeof value.toMillis === 'function') return value.toMillis();
    return null;
}

module.exports = { toMs };
