// Snapshots one player's Chance Cube profile and trugut balance to a JSON file, so a reset or a
// purse adjustment can be undone. `resetChanceCube.js` removes both nodes it touches and there is
// no undo in Firebase — this is the undo.
//
// Writes `scripts/cube-backup-<discordId>-<timestamp>.json`, matching the backup convention already
// in this directory.
//
// Usage:
//   node scripts/cubeBackupProfile.js <discordId>              # write the snapshot
//   node scripts/cubeBackupProfile.js <discordId> --restore <file>
//
// Requires the same Firebase env vars the bot uses.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    databaseURL: 'https://botto-efbfd.firebaseio.com',
});

const args = process.argv.slice(2);
const discordId = args.find(a => /^\d{5,}$/.test(a));
const restoreAt = args.indexOf('--restore');
const restoreFile = restoreAt >= 0 ? args[restoreAt + 1] : null;

if (!discordId) {
    console.error('Usage: node scripts/cubeBackupProfile.js <discordId> [--restore <file>]');
    process.exit(1);
}

(async () => {
    const db = admin.database();
    const users = (await db.ref('users').get()).val() || {};
    const key = Object.keys(users).find(k => String(users[k]?.discordID) === discordId);
    if (!key) {
        console.error(`No user found with discordID ${discordId}.`);
        process.exit(1);
    }

    if (restoreFile) {
        const saved = JSON.parse(fs.readFileSync(restoreFile, 'utf8'));
        if (String(saved.discordId) !== String(discordId)) {
            console.error(`That backup is for ${saved.discordId}, not ${discordId}. Refusing.`);
            process.exit(1);
        }
        await db.ref(`users/${saved.userKey}/random/cube`).set(saved.cube ?? null);
        await db.ref(`users/${saved.userKey}/random/truguts_earned`).set(saved.trugutsEarned);
        await db.ref(`users/${saved.userKey}/random/truguts_spent`).set(saved.trugutsSpent);
        if (saved.ladder) await db.ref(`challenge/cube/live/ladders/${discordId}`).set(saved.ladder);
        console.log(`Restored ${saved.name} from ${path.basename(restoreFile)}.`);
        console.log(`  balance back to ${(saved.trugutsEarned - saved.trugutsSpent).toLocaleString()}`);
        process.exit(0);
    }

    const profile = users[key].random || {};
    const snapshot = {
        takenAt: new Date().toISOString(),
        discordId,
        userKey: key,
        name: users[key].name || null,
        cube: profile.cube ?? null,
        trugutsEarned: Number(profile.truguts_earned) || 0,
        trugutsSpent: Number(profile.truguts_spent) || 0,
        ladder: (await db.ref(`challenge/cube/live/ladders/${discordId}`).get()).val() ?? null,
    };

    const out = path.join(__dirname, `cube-backup-${discordId}-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
    console.log(`Wrote ${path.basename(out)}`);
    console.log(`  ${snapshot.name} · prestige ${snapshot.cube?.prestige ?? 0}`);
    console.log(`  balance ${(snapshot.trugutsEarned - snapshot.trugutsSpent).toLocaleString()}`);
    console.log(`  run in progress: ${snapshot.ladder ? 'yes' : 'no'}`);
    console.log(`\nUndo with:\n  node scripts/cubeBackupProfile.js ${discordId} --restore "${out}"`);
    process.exit(0);
})();
