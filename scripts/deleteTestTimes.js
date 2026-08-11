// Deletes a fixed, explicit list of leftover test times found by findTestTimes.js.
//
// Dry run by default -- pass --confirm to actually write. Every targeted row is
// backed up to a timestamped JSON file first, because Firebase Realtime Database
// deletions are not recoverable.
//
// The keys below are hardcoded on purpose: this script must never re-derive its
// targets from a heuristic, or a later data change could silently widen what it
// removes. Each target also carries the values it expects, and the script aborts
// if what's in the database doesn't match.
//
// Usage:
//   node scripts/deleteTestTimes.js                 (dry run -- shows what would go)
//   node scripts/deleteTestTimes.js --confirm       (writes)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: 'https://botto-efbfd.firebaseio.com'
});

const CONFIRM = process.argv.includes('--confirm');
const EXPECTED_USER = '256236315144749059';

// Audited 2026-07-28 via `node scripts/findTestTimes.js`.
const TARGETS = [
    { path: 'challenge/times/-Oye-gVHduSxkb3ss_wQ', time: '2.222', note: "Beedo's Wild Ride · Sebulba · 3 laps -- #1 of 6, rendered on 8 live challenges" },
    { path: 'challenge/times/-OyeR9B0XKOkyIXovHGk', time: '22.222', note: "Bumpy's Breakers · Mawhonic · skips, 3 laps -- #1 of 2, 1 live challenge" },
    { path: 'challenge/times/-Oycybh3uBN8WzV4J5k2', time: '2.222', note: "Beedo's Wild Ride · Fud Sang · nu, skips, 3 laps -- rendered 0" },
    { path: 'challenge/times/-Oydr436leNbFI_rYS_9', time: '2.222', note: "Inferno · Ben Quadinaros · nu, skips, 3 laps -- rendered 0" }
];

// Submission pointers referencing the above. These MUST go with the time rows:
// submit.js does challengetimeref.child(pointer).update({...}) when a player edits,
// which would recreate a partial time record, and modal.js dereferences
// db.ch.times[pointer].time with no guard (crashes the edit button).
const POINTERS = [
    { path: 'challenge/challenges/1531762023023509605/submissions/256236315144749059', forTime: '-OyeR9B0XKOkyIXovHGk' }
];

async function main() {
    const db = admin.database();
    const backup = { taken: new Date().toISOString(), times: {}, pointers: {} };
    const problems = [];

    console.log(CONFIRM ? 'MODE: writing\n' : 'MODE: dry run (pass --confirm to write)\n');

    // ---- verify every target before touching anything
    for (const t of TARGETS) {
        const snap = await db.ref(t.path).once('value');
        const val = snap.val();
        if (val === null) {
            problems.push(`${t.path} does not exist (already deleted?)`);
            continue;
        }
        if (String(val.time) !== t.time) {
            problems.push(`${t.path} time is ${JSON.stringify(val.time)}, expected ${t.time}`);
            continue;
        }
        if (String(val.user) !== EXPECTED_USER) {
            problems.push(`${t.path} belongs to user ${val.user}, expected ${EXPECTED_USER}`);
            continue;
        }
        backup.times[t.path] = val;
        console.log(`  ok  ${t.path}`);
        console.log(`      time ${val.time} · user ${val.name ?? val.user} · ${t.note}`);
    }

    for (const p of POINTERS) {
        const snap = await db.ref(p.path).once('value');
        const val = snap.val();
        if (val === null) {
            console.log(`  --  ${p.path} already gone, skipping`);
            continue;
        }
        if (String(val.id) !== p.forTime) {
            problems.push(`${p.path} points at ${val.id}, expected ${p.forTime}`);
            continue;
        }
        backup.pointers[p.path] = val;
        console.log(`  ok  ${p.path}`);
        console.log(`      pointer -> ${val.id}`);
    }

    if (problems.length) {
        console.log('\nABORTED -- database does not match the audit:');
        problems.forEach(p => console.log(`  ! ${p}`));
        console.log('\nRe-run scripts/findTestTimes.js and update TARGETS. Nothing was deleted.');
        process.exitCode = 1;
        return;
    }

    const paths = [...Object.keys(backup.times), ...Object.keys(backup.pointers)];
    console.log(`\n${paths.length} path(s) verified.`);

    if (!CONFIRM) {
        console.log('Dry run -- nothing written. Re-run with --confirm to delete.');
        return;
    }

    // ---- backup to disk before removing anything
    const file = path.join(__dirname, `testTimes-backup-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nBackup written: ${file}`);

    // ---- delete: pointers first, so no window exists where a pointer outlives its time
    for (const p of Object.keys(backup.pointers)) {
        await db.ref(p).remove();
        console.log(`  removed ${p}`);
    }
    for (const p of Object.keys(backup.times)) {
        await db.ref(p).remove();
        console.log(`  removed ${p}`);
    }

    // ---- verify they're gone
    let remaining = 0;
    for (const p of paths) {
        if ((await db.ref(p).once('value')).val() !== null) {
            console.log(`  ! ${p} still present`);
            remaining++;
        }
    }
    console.log(remaining ? `\n${remaining} path(s) failed to delete.` : `\nAll ${paths.length} path(s) confirmed gone.`);
    console.log(`Restore with the backup file above if needed.`);
}

main()
    .catch(err => {
        console.error('Failed:', err);
        process.exitCode = 1;
    })
    .finally(() => admin.app().delete());
