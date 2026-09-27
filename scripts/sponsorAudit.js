// Read-only audit of challenge sponsorships: what exists, what it has paid, how often racers land
// on it, and -- for challenges since --since -- whether every sponsor payout matches the rent the
// racer was charged. It never writes.
//
// Sponsors are always worked out from the sponsorship records and a challenge's final setup, never
// from the challenge's saved `sponsors` list: that list was set at the roll, so bribed challenges
// kept the sponsors of the setup they were rolled on (see docs/sponsorship.md §1.3).
//
// Usage:
//   node scripts/sponsorAudit.js                     # everything, with the payout check since 90 days ago
//   node scripts/sponsorAudit.js --since=2026-09-28  # the payout check from a date (e.g. a deploy)
//   node scripts/sponsorAudit.js --json              # machine-readable
//
// Requires the same Firebase env vars the bot uses, e.g. from a local .env file.

require('dotenv').config({ path: `${__dirname}/../.env` });
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
const json = args.includes('--json');
const sinceArg = args.find(a => a.startsWith('--since='))?.split('=')[1];
const since = sinceArg ? Date.parse(sinceArg) : Date.now() - 90 * 864e5;
if (!Number.isFinite(since)) {
    console.error(`--since must be a date, e.g. --since=2026-09-28`);
    process.exit(1);
}

// the same key as deedId() in src/interactions/challenge/functions.js
const deedId = c => (Array.isArray(c?.track) || !c?.conditions) ? null
    : [c.track, c.racer, c.conditions.laps, c.conditions.nu ? 1 : 0, c.conditions.mirror ? 1 : 0, c.conditions.skips ? 1 : 0, c.conditions.backwards ? 1 : 0].join('_');
const memberOf = (s, users) => String(s?.sponsor?.member ?? s?.sponsor?.member_id ?? users[s?.sponsor?.user]?.discordID ?? '');
const bribed = c => !!(c.track_bribe || c.racer_bribe || c.condition_bribe);
const sum = a => a.reduce((x, y) => x + y, 0);
const top = (o, n = 10) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const fmt = v => Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v));
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : 'n/a';

(async () => {
    const [sponsorships, users, challenges] = await Promise.all(
        ['challenge/sponsorships', 'users', 'challenge/challenges'].map(p => database.ref(p).once('value').then(s => s.val() ?? {}))
    );
    const nameOf = id => Object.values(users).find(u => u?.discordID == id)?.name ?? id;
    const out = {};

    // ---- what exists
    const deeds = {};
    const bySponsor = {};
    const orphans = [];
    Object.entries(sponsorships).forEach(([key, s]) => {
        const id = deedId(s);
        if (!id) return;
        const member = memberOf(s, users);
        if (!Object.values(users).some(u => u?.discordID == member)) orphans.push(key);
        deeds[id] = deeds[id] ?? { sponsors: {}, created: Infinity };
        deeds[id].sponsors[member] = (deeds[id].sponsors[member] ?? 0) + 1;
        deeds[id].created = Math.min(deeds[id].created, s.created ?? Infinity);
        bySponsor[member] = (bySponsor[member] ?? 0) + 1;
    });
    const dv = Object.values(deeds);
    out.sponsorships = {
        records: Object.keys(sponsorships).length,
        setups: dv.length,
        setups_with_several_sponsors: dv.filter(d => Object.keys(d.sponsors).length > 1).length,
        sponsors: Object.keys(bySponsor).length,
        top_sponsors: top(bySponsor).map(([m, n]) => `${nameOf(m)}: ${n}`),
        spent_at_circuit_prices: fmt(sum(Object.values(sponsorships).map(s => circuits[tracks[s.track]?.circuit]?.sponsor ?? 0))),
        last_30_days: Object.values(sponsorships).filter(s => s.created > Date.now() - 30 * 864e5).length,
        records_whose_member_matches_no_account: orphans.length
    };

    // ---- what it has paid, by who it went to
    const paid = { raced_setup: 0, others_bribed: 0, others_unbribed: 0 };
    const earners = {};
    let landedRuns = 0, singleRuns = 0;
    Object.values(challenges).forEach(c => {
        const id = deedId(c);
        const d = id ? deeds[id] : null;
        Object.entries(c.sponsor_earnings ?? {}).forEach(([m, v]) => {
            const n = Number(v) || 0;
            if (!n) return;
            earners[m] = (earners[m] ?? 0) + n;
            if (d?.sponsors[m]) paid.raced_setup += n;
            else if (bribed(c)) paid.others_bribed += n;
            else paid.others_unbribed += n;
        });
        if (id && c.submissions) {
            singleRuns++;
            if (d && c.created > d.created) landedRuns++;
        }
    });
    out.paid_all_time = {
        to_sponsors_of_the_setup_raced: fmt(paid.raced_setup),
        // someone who doesn't sponsor the setup raced: before the July 2026 retirement that
        // includes player sponsors; after it, only the pre-bribe setup's sponsors
        to_others_on_bribed_challenges: fmt(paid.others_bribed),
        to_others_on_unbribed_challenges: fmt(paid.others_unbribed),
        top_earners: top(earners).map(([m, v]) => `${nameOf(m)}: ${fmt(v)}`)
    };
    out.landing = { single_track_challenges_raced: singleRuns, on_an_already_sponsored_setup: landedRuns, rate: pct(landedRuns, singleRuns) };

    // ---- the payout check: since stage 0, sponsors are paid exactly the rent racers were charged
    let checked = 0, rentCharged = 0, sponsorPaid = 0, mismatched = [];
    Object.entries(challenges).forEach(([key, c]) => {
        if (!(c.created >= since) || !c.submissions) return;
        checked++;
        const rent = sum(Object.values(c.earnings ?? {}).map(e => Number(e?.rent) || 0));
        const paidOut = sum(Object.values(c.sponsor_earnings ?? {}).map(v => Number(v) || 0));
        rentCharged += rent;
        sponsorPaid += paidOut;
        if (Math.abs(rent - paidOut) > 0.5) mismatched.push({ challenge: key, created: new Date(c.created).toISOString(), rent, paid: paidOut });
    });
    out.payout_check = {
        since: new Date(since).toISOString().slice(0, 10),
        challenges_raced: checked,
        rent_charged: fmt(rentCharged),
        paid_to_sponsors: fmt(sponsorPaid),
        minted: fmt(sponsorPaid - rentCharged),
        challenges_where_they_differ: mismatched.length,
        examples: mismatched.slice(0, 5)
    };

    // ---- the economy, for scale
    const payouts = Object.values(challenges).filter(c => c.created >= Date.now() - 90 * 864e5)
        .flatMap(c => Object.values(c.earnings ?? {}).map(e => Number(e?.truguts_earned) || 0)).sort((a, b) => a - b);
    const balances = Object.values(users).map(u => (Number(u?.random?.truguts_earned) || 0) - (Number(u?.random?.truguts_spent) || 0)).filter(b => b > 0).sort((a, b) => a - b);
    out.economy = {
        median_payout_last_90_days: fmt(payouts[Math.floor(payouts.length / 2)] ?? 0),
        median_balance: fmt(balances[Math.floor(balances.length / 2)] ?? 0),
        in_circulation: fmt(sum(balances)),
        largest_balance_share: pct(balances[balances.length - 1] ?? 0, sum(balances))
    };

    console.log(json ? JSON.stringify(out) : JSON.stringify(out, null, 2));
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
