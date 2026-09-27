// Refunds the retired player sponsorships (docs/sponsorship.md §9.11).
//
// Each record under users/{sponsored}/random/sponsors was a purchase by another player (`player`,
// an account key) of a `take` of 5, 10 or 20 for 📀take × 10,000. Player sponsorships stopped
// paying out in July 2026; this returns the purchase price to the buyer and archives the record.
// Payouts the buyer received before then aren't deducted -- they were minted, so there's no one
// to return them to.
//
// Each refund is written in steps so a crash can never pay twice:
//   1. archive the record at challenge/archive/player_sponsorships/{sponsored}/{record}, marked pending
//   2. refund the buyer: truguts_spent is reduced in a transaction, as manageTruguts' 'r' does
//   3. mark the archive entry refunded, then remove the original record
// A record whose archive entry is already refunded is skipped. One left pending (a crash between
// 1 and 3) is reported and never retried automatically -- check that buyer's balance by hand.
//
// Usage:
//   node scripts/refundPlayerSponsorships.js           # dry run -- lists every refund, writes nothing
//   node scripts/refundPlayerSponsorships.js --apply   # pay the refunds and archive the records
//
// Requires the same Firebase env vars the bot uses, e.g. from a local .env file. Best run while the
// bot is quiet: the bot writes balances from its cached profile, and a refund landing in the same
// moment as one of that player's payouts could be overwritten until the cache catches up.

require('dotenv').config({ path: `${__dirname}/../.env` });
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: 'https://botto-efbfd.firebaseio.com'
});
const database = admin.database();
const apply = process.argv.slice(2).includes('--apply');
const ARCHIVE = 'challenge/archive/player_sponsorships';

(async () => {
    const [users, archive] = await Promise.all([database.ref('users'), database.ref(ARCHIVE)].map(r => r.once('value').then(s => s.val() ?? {})));
    const name = key => users[key]?.name ?? key;

    const refunds = [];
    const problems = [];
    Object.entries(users).forEach(([sponsored, u]) => {
        Object.entries(u?.random?.sponsors ?? {}).forEach(([record, s]) => {
            const buyer = s?.player;
            const amount = (Number(s?.take) || 0) * 10000;
            const archived = archive[sponsored]?.[record];
            if (archived?.status == 'refunded') return;
            if (archived?.status == 'pending') { problems.push(`pending from an earlier run: ${sponsored}/${record} (buyer ${name(buyer)}, 📀${amount.toLocaleString()}) — check by hand`); return; }
            if (!buyer || !users[buyer]?.random) { problems.push(`no buyer account: ${sponsored}/${record} (player ${buyer})`); return; }
            if (!amount) { problems.push(`no take: ${sponsored}/${record}`); return; }
            refunds.push({ sponsored, record, buyer, amount, s });
        });
    });

    const byBuyer = {};
    refunds.forEach(r => { byBuyer[r.buyer] = (byBuyer[r.buyer] ?? 0) + r.amount; });
    console.log(`${apply ? 'APPLYING' : 'DRY RUN'}: ${refunds.length} refunds, 📀${refunds.reduce((a, r) => a + r.amount, 0).toLocaleString()} to ${Object.keys(byBuyer).length} buyers`);
    Object.entries(byBuyer).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        const n = refunds.filter(r => r.buyer == k).length;
        console.log(`  ${name(k)}: 📀${v.toLocaleString()} (${n} sponsorship${n > 1 ? 's' : ''}: ${refunds.filter(r => r.buyer == k).map(r => `${name(r.sponsored)} ${r.s.take}%`).join(', ')})`);
    });
    problems.forEach(p => console.log(`  ! ${p}`));

    if (!apply) {
        console.log('\nNothing written. Run with --apply to pay these refunds.');
        process.exit(0);
    }

    for (const r of refunds) {
        const entry = database.ref(`${ARCHIVE}/${r.sponsored}/${r.record}`);
        await entry.set({ ...r.s, sponsored: r.sponsored, refund: r.amount, status: 'pending', started: Date.now() });
        await database.ref(`users/${r.buyer}/random/truguts_spent`).transaction(v => (Number(v) || 0) - r.amount);
        await entry.update({ status: 'refunded', refunded: Date.now() });
        await database.ref(`users/${r.sponsored}/random/sponsors/${r.record}`).remove();
        console.log(`  refunded ${name(r.buyer)} 📀${r.amount.toLocaleString()} for ${name(r.sponsored)}`);
    }
    console.log('Done.');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
