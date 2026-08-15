// Sets one player's trugut balance to a fixed figure, for playtesting.
//
// `resetChanceCube.js` deliberately leaves `random/truguts_*` alone — it is the shared
// challenge-system balance, not a cube stat, and wiping it would take drops, the shop and the
// leaderboard with it. That is right for a reset in production and wrong for a playtest: a fresh
// cube profile on a trillion-trugut purse is capped at 📀1,000 a roll and can never feel a bust,
// so the early game cannot be measured on it.
//
// Both fields are written rather than just one, because both are read as lifetime stats elsewhere —
// `big_time_swindler` counts `earned + spent`, and the stats screen shows them separately. Bumping
// `spent` to shrink the balance would leave an account claiming a trillion earned and a trillion
// spent, which is a stranger lie than a fresh one.
//
// Take a snapshot with `cubeBackupProfile.js` first — this does not.
//
// Usage:
//   node scripts/cubeSetPurse.js <discordId> <amount>            # dry run
//   node scripts/cubeSetPurse.js <discordId> <amount> --apply

require('dotenv').config();
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
const amount = Number(args.find(a => /^\d+$/.test(a) && a !== discordId));
const apply = args.includes('--apply');

if (!discordId || !Number.isFinite(amount)) {
    console.error('Usage: node scripts/cubeSetPurse.js <discordId> <amount> [--apply]');
    process.exit(1);
}

const bal = p => (Number(p?.truguts_earned) || 0) - (Number(p?.truguts_spent) || 0);
const show = (tag, p) => console.log(`${tag}  earned ${(Number(p.truguts_earned) || 0).toLocaleString()}`
    + `  ·  spent ${(Number(p.truguts_spent) || 0).toLocaleString()}`
    + `  ·  balance ${bal(p).toLocaleString()}`);

(async () => {
    const db = admin.database();
    const users = (await db.ref('users').get()).val() || {};
    const key = Object.keys(users).find(k => String(users[k]?.discordID) === discordId);
    if (!key) {
        console.error(`No user found with discordID ${discordId}.`);
        process.exit(1);
    }

    const before = users[key].random || {};
    console.log(`${users[key].name || key}  (${discordId})`);
    show('before', before);

    if (!apply) {
        show('would', { truguts_earned: amount, truguts_spent: 0 });
        console.log('\nDry run. Re-run with --apply to write it.');
        process.exit(0);
    }

    await db.ref(`users/${key}/random`).update({ truguts_earned: amount, truguts_spent: 0 });
    const after = (await db.ref(`users/${key}/random`).get()).val() || {};
    show('after ', after);
    console.log(`\ncube profile present: ${after.cube !== undefined}`);
    console.log(`chance_cube unlock:   ${after.effects?.chance_cube === true}`);
    process.exit(0);
})();
