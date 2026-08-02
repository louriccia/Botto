// Audits challenge/times for leftover test submissions and reports what deleting
// each one would affect. READ ONLY -- this script never writes or removes anything.
//
// Usage:
//   node scripts/findTestTimes.js
//   node scripts/findTestTimes.js --under 15          (absolute floor, seconds)
//   node scripts/findTestTimes.js --outlier 0.5        (fraction of next-best on same config)
//   node scripts/findTestTimes.js --exact 2.222,22.222,1
//   node scripts/findTestTimes.js --user 256236315144749059
//   node scripts/findTestTimes.js --guild 1135800421290627112
//   node scripts/findTestTimes.js --paths          (just the delete paths, one per line)
//
// Requires the same Firebase env vars the bot uses (FIREBASE_PROJECT_ID,
// FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL), e.g. from a local .env file.

require('dotenv').config();
const admin = require('firebase-admin');
const { tracks } = require('../src/data/sw_racer/track.js');
const { racers } = require('../src/data/sw_racer/racer.js');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: 'https://botto-efbfd.firebaseio.com'
});

const SWE1R_GUILD = '441839750555369474';
const TEST_GUILD = '1135800421290627112';

// ---------------------------------------------------------------- args

function flag(name, fallback = null) {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? fallback : (process.argv[i + 1] ?? true);
}

// The two values play.js already sweeps, plus whatever else you pass in.
const EXACT = String(flag('exact', '2.222,22.222')).split(',').map(v => Number(v.trim())).filter(Number.isFinite);
// Absolute floor. Deliberately low: 1-lap-with-skips configs are genuinely fast
// (Abyss runs land in the 7s), so a floor of 10 buries the real test data under
// dozens of legitimate times. Prefer --outlier below for the general case.
const UNDER = Number(flag('under', 5));
// The heuristic that actually generalizes: flag a time drastically faster than the
// next-best time on its own configuration. A real record beats the field by a few
// percent; a placeholder beats it by an order of magnitude. Two identical test times
// on one config mask each other here, so the exact/floor checks still matter.
const OUTLIER = Number(flag('outlier', 0.5));
const ONLY_USER = flag('user');
const ONLY_GUILD = flag('guild');
const PATHS_ONLY = process.argv.includes('--paths');

// ---------------------------------------------------------------- helpers

// Mirrors exports.matchingChallenge in src/interactions/challenge/functions.js --
// including that the array branch deliberately ignores `backwards`. Kept as a local
// copy so this script doesn't pull in functions.js (which initializes Firebase).
function matchingChallenge(a, b) {
    if (!a?.conditions || !b?.conditions) return false;
    if (Array.isArray(a.track) && Array.isArray(b.track)) {
        if (a.track.length !== b.track.length) return false;
        const s1 = a.track.slice().sort((x, y) => x - y);
        const s2 = b.track.slice().sort((x, y) => x - y);
        for (let i = 0; i < s1.length; i++) if (s1[i] !== s2[i]) return false;
        return a.racer == b.racer &&
            a.conditions.laps == b.conditions.laps &&
            a.conditions.mirror == b.conditions.mirror &&
            a.conditions.nu == b.conditions.nu &&
            a.conditions.skips == b.conditions.skips;
    }
    if (!Array.isArray(a.track) && !Array.isArray(b.track)) {
        return a.track == b.track &&
            a.racer == b.racer &&
            a.conditions.laps == b.conditions.laps &&
            a.conditions.mirror == b.conditions.mirror &&
            a.conditions.nu == b.conditions.nu &&
            a.conditions.skips == b.conditions.skips &&
            a.conditions.backwards == b.conditions.backwards;
    }
    return false;
}

function describeConfig(t) {
    const trackName = Array.isArray(t.track)
        ? `${t.track.length} tracks`
        : (tracks[t.track]?.name ?? `track ${t.track}`);
    const racerName = racers[t.racer]?.name ?? `racer ${t.racer}`;
    const c = t.conditions ?? {};
    const mods = [
        c.nu ? 'no upgrades' : null,
        c.mirror ? 'mirror' : null,
        c.backwards ? 'backwards' : null,
        c.skips ? 'skips' : null,
        `${c.laps ?? 3} lap${(c.laps ?? 3) == 1 ? '' : 's'}`
    ].filter(Boolean);
    return `${trackName} · ${racerName} · ${mods.join(', ')}`;
}

function when(ms) {
    const n = Number(ms);
    return Number.isFinite(n) && n > 0 ? new Date(n).toISOString().replace('T', ' ').slice(0, 16) : '(no date)';
}

// Bucket key with the same semantics as matchingChallenge, so grouping every time by
// configuration stays O(n) instead of O(n^2). String() preserves the distinction that
// matchingChallenge's == comparison makes between `false` and a missing field; null and
// undefined are folded together because == treats them as equal. The array-track branch
// omits `backwards`, matching functions.js.
function configKey(o) {
    const c = o.conditions ?? {};
    const v = x => (x == null ? 'undefined' : String(x));
    const track = Array.isArray(o.track) ? `[${o.track.slice().sort((a, b) => a - b).join(',')}]` : v(o.track);
    const base = `${track}|${v(o.racer)}|${v(c.laps)}|${v(c.mirror)}|${v(c.nu)}|${v(c.skips)}`;
    return Array.isArray(o.track) ? base : `${base}|${v(c.backwards)}`;
}

function reason(t, key, byConfig) {
    const n = Number(t.time);
    const reasons = [];
    if (EXACT.some(e => e === n)) reasons.push(`exact match ${n}`);
    if (Number.isFinite(n) && n < UNDER) reasons.push(`under ${UNDER}s`);
    if (!Number.isFinite(n)) reasons.push(`time is not a number (${JSON.stringify(t.time)})`);
    if (Number.isFinite(n) && n > 0) {
        const others = (byConfig.get(configKey(t)) ?? [])
            .filter(o => o.key !== key)
            .map(o => Number(o.time))
            .filter(x => Number.isFinite(x) && x > 0);
        if (others.length) {
            const next = Math.min(...others);
            if (n < OUTLIER * next) {
                reasons.push(`${Math.round((1 - n / next) * 100)}% faster than the next time on this config (${next})`);
            }
        }
    }
    return reasons;
}

// ---------------------------------------------------------------- main

async function main() {
    const [timesSnap, challengesSnap, usersSnap] = await Promise.all([
        admin.database().ref('challenge/times').once('value'),
        admin.database().ref('challenge/challenges').once('value'),
        admin.database().ref('users').once('value')
    ]);

    const times = timesSnap.val() || {};
    const challenges = challengesSnap.val() || {};
    const users = Object.values(usersSnap.val() || {});
    const timeKeys = Object.keys(times);

    const nameOf = id => users.find(u => String(u.discordID) === String(id))?.name ?? '(unknown user)';

    // Every challenge submission pointer, so we can spot times that are still
    // referenced. submit.js does challengetimeref.child(<pointer>).update({...}) on an
    // edit, which would resurrect a partial record if the time row is gone, and
    // modal.js dereferences it unguarded.
    const pointers = {}; // time key -> [ path, ... ]
    Object.entries(challenges).forEach(([msg, ch]) => {
        Object.entries(ch?.submissions ?? {}).forEach(([member, sub]) => {
            if (!sub?.id) return;
            (pointers[sub.id] ??= []).push(`challenge/challenges/${msg}/submissions/${member}`);
        });
    });

    // Group every time by configuration once, for the outlier comparison.
    const byConfig = new Map();
    timeKeys.forEach(key => {
        const k = configKey(times[key]);
        if (!byConfig.has(k)) byConfig.set(k, []);
        byConfig.get(k).push({ key, ...times[key] });
    });

    let flagged = timeKeys
        .map(key => ({ key, t: times[key], why: reason(times[key], key, byConfig) }))
        .filter(r => r.why.length);

    if (ONLY_USER) flagged = flagged.filter(r => String(r.t.user) === String(ONLY_USER));
    if (ONLY_GUILD) {
        flagged = flagged.filter(r => String(challenges[r.t.challenge]?.guild ?? '') === String(ONLY_GUILD));
    }

    if (PATHS_ONLY) {
        flagged.forEach(r => {
            console.log(`challenge/times/${r.key}`);
            (pointers[r.key] ?? []).forEach(p => console.log(p));
        });
        return;
    }

    console.log(`challenge/times records:      ${timeKeys.length.toLocaleString()}`);
    console.log(`challenge/challenges records: ${Object.keys(challenges).length.toLocaleString()}`);
    console.log(`criteria: exact [${EXACT.join(', ')}] or under ${UNDER}s or non-numeric`
        + ` or >${Math.round((1 - OUTLIER) * 100)}% faster than the next time on its config`
        + (ONLY_USER ? ` · user ${ONLY_USER}` : '')
        + (ONLY_GUILD ? ` · guild ${ONLY_GUILD}` : ''));

    if (!flagged.length) {
        console.log('\nNothing flagged. No test times to clean up.');
        return;
    }

    console.log(`\n${'='.repeat(72)}\n${flagged.length} flagged time${flagged.length === 1 ? '' : 's'}\n${'='.repeat(72)}`);

    let liveImpact = 0;
    let danglingRisk = 0;

    flagged.forEach((r, i) => {
        const t = r.t;

        // Everything on this configuration, sorted the way getBest sorts it.
        const sameConfig = timeKeys
            .map(k => ({ key: k, ...times[k] }))
            .filter(o => matchingChallenge(o, t))
            .sort((a, b) => Number(a.time) - Number(b.time));
        // getBest's a.time - b.time comparator yields NaN for a non-numeric time, so the
        // resulting order is implementation-defined -- don't claim a rank for those.
        const rankable = Number.isFinite(Number(t.time));
        const rank = rankable ? sameConfig.findIndex(o => o.key === r.key) + 1 : 0;

        // Challenges that would render this time on their leaderboard. getBest does not
        // filter by guild, so a time created in the test guild still shows up on live
        // challenges sharing the configuration.
        const renderedBy = Object.entries(challenges).filter(([, ch]) => matchingChallenge(ch, t));
        const liveRenders = renderedBy.filter(([, ch]) => String(ch.guild) === SWE1R_GUILD);

        // already_played in submit.js is true if the user has ANY time on the config, so
        // removing this one only restores their item drop when it is their only one.
        const othersByUser = sameConfig.filter(o => o.key !== r.key && String(o.user) === String(t.user));

        const refs = pointers[r.key] ?? [];
        if (liveRenders.length) liveImpact++;
        if (refs.length) danglingRisk++;

        console.log(`\n[${i + 1}] challenge/times/${r.key}`);
        console.log(`    flagged   ${r.why.join('; ')}`);
        console.log(`    time      ${t.time}   (stored as ${typeof t.time})`);
        console.log(`    user      ${t.name ?? nameOf(t.user)} (${t.user})`);
        console.log(`    config    ${describeConfig(t)}`);
        console.log(`    date      ${when(t.date)}`);
        if (t.notes) console.log(`    notes     ${JSON.stringify(t.notes)}`);
        if (t.proof) console.log(`    proof     ${t.proof}`);
        const onChallenge = t.challenge ? `${t.challenge} (guild ${challenges[t.challenge]?.guild ?? 'unknown/deleted'})` : '(none recorded)';
        console.log(`    submitted on challenge ${onChallenge}`);

        console.log(`    rank      ${rankable ? `#${rank}` : 'unsortable (non-numeric time)'} of ${sameConfig.length} on this config`
            + (rank === 1 ? '   <-- holds the record' : ''));
        if (rank === 1 && renderedBy.length) {
            console.log(`              record holder drives Pole Position, free rerolls, and the`);
            console.log(`              "current record-holder is..." flavour line`);
        }

        console.log(`    renders   ${renderedBy.length} challenge(s) share this config`
            + (liveRenders.length ? `, ${liveRenders.length} in the live guild  <-- VISIBLE TO PLAYERS` : ' (none in the live guild)'));

        if (!othersByUser.length) {
            console.log(`    drops     this is ${t.name ?? 'the user'}'s only time on this config`);
            console.log(`              -> it currently suppresses their item drop here (already_played)`);
        } else {
            console.log(`    drops     user has ${othersByUser.length} other time(s) here; item drop stays suppressed either way`);
        }

        if (refs.length) {
            console.log(`    WARNING   ${refs.length} challenge submission pointer(s) still reference this time:`);
            refs.forEach(p => console.log(`                ${p}`));
            console.log(`              delete these too. submit.js does .child(pointer).update({...}) when a`);
            console.log(`              player edits, which would recreate a partial time row, and modal.js`);
            console.log(`              dereferences db.ch.times[pointer].time without a guard.`);
        }
    });

    console.log(`\n${'='.repeat(72)}`);
    console.log(`summary`);
    console.log(`  flagged times:                        ${flagged.length}`);
    console.log(`  affecting live-guild challenges:      ${liveImpact}`);
    console.log(`  with dangling submission pointers:    ${danglingRisk}`);
    console.log(`\nNothing was deleted -- this script only reads.`);
    console.log(`Re-run with --paths to get every path that needs removing, one per line.`);
}

main()
    .catch(err => {
        console.error('Failed:', err);
        process.exitCode = 1;
    })
    .finally(() => admin.app().delete());
