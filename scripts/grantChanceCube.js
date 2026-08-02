// Grants (or revokes) the Chance Cube unlock for a single user by Discord ID.
//
// Completing the "Red vs Blue" collection normally sets this via
// collectionRewardUpdater, which writes collection rewards into `random.effects`.
// This script sets the same flag directly so the mode can be playtested before anyone
// owns the collection.
//
// Usage:
//   node scripts/grantChanceCube.js <discordId>            # dry run — shows current state
//   node scripts/grantChanceCube.js <discordId> --apply    # set effects.chance_cube = true
//   node scripts/grantChanceCube.js <discordId> --revoke --apply
//
// Requires the same Firebase env vars the bot uses (FIREBASE_PROJECT_ID,
// FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL), e.g. from a local .env file.

require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: 'https://botto-efbfd.firebaseio.com'
});

const args = process.argv.slice(2);
const discordId = args.find(a => /^\d{5,}$/.test(a));
const apply = args.includes('--apply');
const revoke = args.includes('--revoke');

if (!discordId) {
    console.error('Usage: node scripts/grantChanceCube.js <discordId> [--revoke] [--apply]');
    process.exit(1);
}

(async () => {
    const db = admin.database();
    const snapshot = await db.ref('users').get();
    const users = snapshot.val() || {};

    const key = Object.keys(users).find(k => String(users[k]?.discordID) === discordId);
    if (!key) {
        console.error(`No user found with discordID ${discordId}. They need to use the bot at least once first.`);
        process.exit(1);
    }

    const user = users[key];
    const effects = user.random?.effects || {};
    const current = effects.chance_cube === true;
    const target = !revoke;

    console.log(`user key      ${key}`);
    console.log(`discordID     ${user.discordID}`);
    console.log(`name          ${user.random?.name ?? '(none)'}`);
    console.log(`chance_cube   ${current}  ->  ${target}`);
    console.log(`other effects ${Object.keys(effects).filter(k => k !== 'chance_cube').join(', ') || '(none)'}`);
    console.log(`cube state    ${user.random?.cube ? JSON.stringify(user.random.cube) : '(none yet)'}`);

    if (current === target) {
        console.log('\nAlready in the requested state — nothing to do.');
        process.exit(0);
    }
    if (!apply) {
        console.log('\nDry run. Re-run with --apply to write this change.');
        process.exit(0);
    }

    // Targeted child update so nothing else under effects is touched.
    await db.ref(`users/${key}/random/effects`).update({ chance_cube: target });

    const after = (await db.ref(`users/${key}/random/effects/chance_cube`).get()).val();
    console.log(`\nWrote users/${key}/random/effects/chance_cube = ${after}`);
    process.exit(after === target ? 0 : 1);
})().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
