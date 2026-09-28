// Moves challenge sponsorships onto syndicates (docs/sponsorship.md, stage 2).
//
// Each sponsorship record becomes a stake of its circuit's sponsor price in its setup, at
// challenge/deeds/{deedId}. A setup several people sponsored becomes a proportional split; one
// sponsored several times by one person becomes a larger stake. Sponsors are identified by member
// id, never by the name stored on the record, which is often stale. Every sponsor without a
// syndicate gets one, named "{player}'s Syndicate" until they rename it. Sponsor payouts made
// between the stage 0 deploy and the ledger going live are backfilled onto the ledger.
//
// It's safe to run again: stakes are recomputed from the sponsorship records every time (the bot
// adds a stake whenever a sponsorship is bought, so the two agree), existing syndicates are never
// renamed, and a challenge already on the ledger is never backfilled twice.
//
// Usage:
//   node scripts/sponsorMigrate.js                 # dry run: report what it would write
//   node scripts/sponsorMigrate.js --out=plan.json # dry run, plus the full plan in a local file
//   node scripts/sponsorMigrate.js --apply         # write it
//   node scripts/sponsorMigrate.js --apply --notify  # also DM each new syndicate's owner (needs the bot token)
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

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const notify = args.includes('--notify');
const outArg = args.find(a => a.startsWith('--out='))?.split('=')[1];

// stage 0 (PR #45) went live here: every sponsor payout since is rent, and belongs on the ledger
const STAGE0 = Date.parse('2026-09-27T21:49:19Z');

// the same key as deedId() in src/interactions/challenge/functions.js
const deedId = c => (Array.isArray(c?.track) || !c?.conditions) ? null
    : [c.track, c.racer, c.conditions.laps, c.conditions.nu ? 1 : 0, c.conditions.mirror ? 1 : 0, c.conditions.skips ? 1 : 0, c.conditions.backwards ? 1 : 0].join('_');

(async () => {
    const [sponsorships, users, challenges, ledger] = await Promise.all(
        ['challenge/sponsorships', 'users', 'challenge/challenges', 'challenge/ledger'].map(p => database.ref(p).once('value').then(s => s.val() ?? {}))
    );
    // Some Discord ids have several user records. The bot always uses the first (see
    // get_user_key_by_discord_id), so the syndicate has to go on that one too.
    const accountByMember = {};
    Object.entries(users).forEach(([key, u]) => { if (u?.discordID && !accountByMember[u.discordID]) accountByMember[u.discordID] = { key, name: u.name } });

    // ---- stakes
    const deeds = {};
    const members = new Set();
    const unplaced = [];
    Object.entries(sponsorships).forEach(([record, s]) => {
        const id = deedId(s);
        if (!id) { unplaced.push({ record, reason: 'multi-track: keeps its title, pays nothing' }); return; }
        // a member id stored as a number loses precision; the record's account key is the fallback
        let member = String(s.sponsor?.member ?? s.sponsor?.member_id ?? '');
        if (!accountByMember[member] && users[s.sponsor?.user]?.discordID) member = users[s.sponsor.user].discordID;
        if (!accountByMember[member]) { unplaced.push({ record, reason: `no account for member ${member}` }); return; }
        const d = deeds[id] = deeds[id] ?? { track: s.track, racer: s.racer, conditions: { ...s.conditions }, created: s.created ?? Date.now(), stakes: {} };
        d.stakes[member] = (d.stakes[member] ?? 0) + (circuits[tracks[s.track]?.circuit]?.sponsor ?? 0);
        d.created = Math.min(d.created, s.created ?? Infinity);
        members.add(member);
    });

    // ---- syndicates for sponsors who don't have one
    const taken = new Set(Object.values(users).map(u => u?.random?.syndicate?.name?.trim().toLowerCase()).filter(Boolean));
    const founding = [];
    members.forEach(member => {
        const { key, name } = accountByMember[member];
        if (users[key]?.random?.syndicate?.name) return;
        const player = name ?? 'Someone';
        const base = `${player}'s Syndicate`.length <= 32 ? `${player}'s Syndicate` : player.slice(0, 32);
        let candidate = base, n = 2;
        while (taken.has(candidate.toLowerCase())) candidate = `${base.slice(0, 29)} ${n++}`;
        taken.add(candidate.toLowerCase());
        founding.push({ member, key, syndicate: { name: candidate, emoji: '📢', motto: '', founded: Date.now() } });
    });

    // ---- ledger backfill: stage 0 payouts made before the ledger existed
    const onLedger = new Set(Object.values(ledger).map(e => e?.challenge).filter(Boolean));
    const backfill = [];
    Object.entries(challenges).forEach(([id, c]) => {
        if (!(c.created >= STAGE0) || onLedger.has(id)) return;
        const shares = Object.fromEntries(Object.entries(c.sponsor_earnings ?? {}).filter(([, v]) => Number(v) > 0).map(([m, v]) => [m, Number(v)]));
        if (!Object.keys(shares).length) return;
        backfill.push({ key: `backfill_${id}`, entry: { deed: deedId(c), challenge: id, date: c.created, kind: 'rent', racer: null, amount: Object.values(shares).reduce((a, b) => a + b, 0), shares, backfilled: true } });
    });

    const shared = Object.entries(deeds).filter(([, d]) => Object.keys(d.stakes).length > 1);
    console.log(`${apply ? 'APPLYING' : 'DRY RUN'}:`);
    console.log(JSON.stringify({
        setups: Object.keys(deeds).length,
        shared_setups: shared.length,
        sponsors: members.size,
        syndicates_to_found: founding.map(f => `${f.syndicate.name} (${accountByMember[f.member].name})`),
        sponsors_who_already_have_one: members.size - founding.length,
        total_staked: Object.values(deeds).reduce((a, d) => a + Object.values(d.stakes).reduce((x, y) => x + y, 0), 0),
        ledger_backfill: backfill.map(b => `${b.entry.challenge}: 📀${b.entry.amount.toLocaleString()}`),
        not_migrated: unplaced,
    }, null, 2));
    if (outArg) fs.writeFileSync(outArg, JSON.stringify({ deeds, founding, backfill, unplaced }, null, 2));

    if (!apply) {
        console.log('\nNothing written. Run with --apply to write it.');
        process.exit(0);
    }

    await database.ref('challenge/deeds').set(deeds);
    for (const f of founding) await database.ref(`users/${f.key}/random/syndicate`).set(f.syndicate);
    for (const b of backfill) await database.ref(`challenge/ledger/${b.key}`).set(b.entry);
    console.log(`\nWrote ${Object.keys(deeds).length} setups, founded ${founding.length} syndicates, backfilled ${backfill.length} ledger entries.`);

    if (notify) {
        if (!process.env.token) { console.log('--notify needs the bot token (token) in the environment; no DMs sent.'); process.exit(0); }
        const { REST, Routes } = require('discord.js');
        const rest = new REST({ version: '10' }).setToken(process.env.token);
        for (const f of founding) {
            try {
                const channel = await rest.post(Routes.userChannels(), { body: { recipient_id: f.member } });
                await rest.post(Routes.channelMessages(channel.id), { body: { content:
                    `📢 Your challenge sponsorships are now held by your syndicate, **${f.syndicate.name}**.\n` +
                    `Rename it and give it an emoji and a motto with \`/syndicate found\`, and see what your sponsorships earn with \`/syndicate view\`.` } });
                console.log(`  DM sent to ${accountByMember[f.member].name}`);
            } catch (e) {
                console.log(`  couldn't DM ${accountByMember[f.member].name}: ${e.message}`);
            }
        }
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
