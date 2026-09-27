// Dry run of the stage 3 sponsorship migration (docs/sponsorship.md §14). Reports what the
// migration would write -- syndicates, stakes, lead sponsors, titles -- and anything it can't place.
// It never writes; stage 3 turns this plan into the real migration.
//
// Each sponsorship record becomes an investment of its circuit's sponsor price in its setup. A setup
// several people sponsored becomes a proportional split; one sponsored several times by one person
// becomes a larger stake. Sponsors are identified by member id, never by the name stored on the
// record, which is often stale.
//
// Usage:
//   node scripts/sponsorMigrationDryRun.js               # summary
//   node scripts/sponsorMigrationDryRun.js --out=plan.json   # also write the full plan to a local file
//
// Requires the same Firebase env vars the bot uses, e.g. from a local .env file.

require('dotenv').config({ path: `${__dirname}/../.env` });
const fs = require('fs');
const admin = require('firebase-admin');
const { tracks } = require('../src/data/sw_racer/track.js');
const { circuits } = require('../src/data/sw_racer/circuit.js');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: 'https://botto-efbfd.firebaseio.com'
});
const database = admin.database();

const outArg = process.argv.slice(2).find(a => a.startsWith('--out='))?.split('=')[1];

// the same key as deedId() in src/interactions/challenge/functions.js
const deedId = c => (Array.isArray(c?.track) || !c?.conditions) ? null
    : [c.track, c.racer, c.conditions.laps, c.conditions.nu ? 1 : 0, c.conditions.mirror ? 1 : 0, c.conditions.skips ? 1 : 0, c.conditions.backwards ? 1 : 0].join('_');

(async () => {
    const [sponsorships, users] = await Promise.all(['challenge/sponsorships', 'users'].map(p => database.ref(p).once('value').then(s => s.val() ?? {})));
    const accountByMember = {};
    Object.entries(users).forEach(([key, u]) => { if (u?.discordID) accountByMember[u.discordID] = { key, name: u.name } });

    const deeds = {};
    const syndicates = {};
    const unplaced = [];
    Object.entries(sponsorships).forEach(([record, s]) => {
        const id = deedId(s);
        if (!id) { unplaced.push({ record, reason: 'multi-track: keeps its title, pays nothing' }); return; }
        // a member id stored as a number loses precision; the record's account key is the fallback
        let member = String(s.sponsor?.member ?? s.sponsor?.member_id ?? '');
        if (!accountByMember[member] && users[s.sponsor?.user]?.discordID) member = users[s.sponsor.user].discordID;
        const account = accountByMember[member];
        if (!account) { unplaced.push({ record, reason: `no account for member ${member}` }); return; }
        const amount = circuits[tracks[s.track]?.circuit]?.sponsor ?? 0;
        const d = deeds[id] = deeds[id] ?? { stakes: {}, titles: [], first: Infinity };
        d.stakes[member] = (d.stakes[member] ?? 0) + amount;
        if (s.title) d.titles.push({ member, title: s.title, created: s.created ?? 0 });
        d.first = Math.min(d.first, s.created ?? Infinity);
        const syn = syndicates[member] = syndicates[member] ?? { account: account.key, name: account.name, setups: 0, invested: 0, lead_on: 0 };
        syn.invested += amount;
    });

    const plan = Object.entries(deeds).map(([id, d]) => {
        const total = Object.values(d.stakes).reduce((a, b) => a + b, 0);
        // the lead sponsor is whoever has put in the most; ties go to whoever sponsored first
        const lead = Object.entries(d.stakes).sort((a, b) => b[1] - a[1])[0][0];
        const title = d.titles.filter(t => t.member == lead).sort((a, b) => b.created - a.created)[0]?.title ?? null;
        Object.keys(d.stakes).forEach(m => { syndicates[m].setups++; });
        syndicates[lead].lead_on++;
        return {
            deed: id, total, lead, title,
            shares: Object.fromEntries(Object.entries(d.stakes).map(([m, v]) => [accountByMember[m].name, (v / total * 100).toFixed(1) + '%']))
        };
    });

    const summary = {
        setups: plan.length,
        setups_with_several_sponsors: plan.filter(p => Object.keys(p.shares).length > 1).length,
        syndicates_to_found: Object.values(syndicates).map(s => `${s.name} — ${s.setups} setups, lead on ${s.lead_on}, 📀${s.invested.toLocaleString()} invested`),
        total_invested: Object.values(syndicates).reduce((a, s) => a + s.invested, 0),
        shared_setups: plan.filter(p => Object.keys(p.shares).length > 1).map(p => `${p.deed}: ${Object.entries(p.shares).map(([n, s]) => `${n} ${s}`).join(', ')}`),
        titles_carried_over: plan.filter(p => p.title).length,
        typed_sponsor_times_dropped: Object.values(sponsorships).filter(s => s.time).length,
        not_migrated: unplaced
    };
    console.log(JSON.stringify(summary, null, 2));
    if (outArg) {
        fs.writeFileSync(outArg, JSON.stringify({ summary, plan, syndicates }, null, 2));
        console.log(`\nfull plan written to ${outArg}`);
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
