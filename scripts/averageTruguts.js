// Computes the average trugut balance across users.
//
// A user's balance = random.truguts_earned - random.truguts_spent
// (same formula used by /truguts leaderboard in src/commands/truguts.js).
//
// Usage:
//   node scripts/averageTruguts.js
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

// Non-player accounts excluded from the trugut leaderboard (bot/system).
const EXCLUDED_DISCORD_IDS = ['545799665862311971', '256236315144749059'];

function balanceOf(user) {
    const earned = Number(user.random?.truguts_earned) || 0;
    const spent = Number(user.random?.truguts_spent) || 0;
    return earned - spent;
}

function summarize(label, balances) {
    if (!balances.length) {
        console.log(`${label}: no users`);
        return;
    }
    const total = balances.reduce((a, b) => a + b, 0);
    const avg = total / balances.length;
    const sorted = [...balances].sort((a, b) => a - b);
    const median = sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    console.log(`\n${label}`);
    console.log(`  users:   ${balances.length.toLocaleString()}`);
    console.log(`  total:   📀${Math.round(total).toLocaleString()}`);
    console.log(`  average: 📀${Math.round(avg).toLocaleString()}`);
    console.log(`  median:  📀${Math.round(median).toLocaleString()}`);
    console.log(`  min/max: 📀${Math.round(sorted[0]).toLocaleString()} / 📀${Math.round(sorted[sorted.length - 1]).toLocaleString()}`);
}

// How many top holders to strip off as "whales". Override on the CLI:
//   node scripts/averageTruguts.js 5
const WHALES_TO_EXCLUDE = Number(process.argv[2]) || 5;

async function main() {
    const snapshot = await admin.database().ref('users').once('value');
    const users = Object.values(snapshot.val() || {});

    // Real players: has a trugut profile and a non-null discordID that isn't a bot/system account.
    const players = users.filter(u =>
        u.random?.truguts_earned !== undefined &&
        u.discordID != null &&
        !EXCLUDED_DISCORD_IDS.includes(String(u.discordID))
    );

    const allBalances = players.map(balanceOf);
    const positiveBalances = allBalances.filter(b => b > 0);

    console.log(`Total user records in DB: ${users.length.toLocaleString()}`);
    summarize('All players (has trugut profile)', allBalances);
    summarize('Players with a positive balance', positiveBalances);

    // Show the biggest holders so the whale cutoff is visible.
    const ranked = [...players].sort((a, b) => balanceOf(b) - balanceOf(a));
    console.log(`\nTop ${WHALES_TO_EXCLUDE} holders (the "whales")`);
    ranked.slice(0, WHALES_TO_EXCLUDE).forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.name || u.discordID}: 📀${Math.round(balanceOf(u)).toLocaleString()}`);
    });

    // Average with the top-N whales removed.
    const trimmed = ranked.slice(WHALES_TO_EXCLUDE).map(balanceOf);
    summarize(`Players excluding top ${WHALES_TO_EXCLUDE} whales`, trimmed);
    summarize(`Players excluding top ${WHALES_TO_EXCLUDE} whales, positive balance only`, trimmed.filter(b => b > 0));
}

main()
    .catch(err => {
        console.error('Failed:', err);
        process.exitCode = 1;
    })
    .finally(() => admin.app().delete());
