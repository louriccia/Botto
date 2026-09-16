// Repairs challenge records whose sponsors were stored under the key "undefined".
//
// Publishing a sponsorship used to overwrite the cached sponsor with a `member_id`
// field where every reader looks for `member`. Until the Firebase mirror caught up,
// any challenge rolled in that window was written with its sponsor keyed under the
// literal string "undefined" -- which then reached firebase as a child path (crashing
// the reroll) and rendered as `<@undefined>` on the challenge card.
//
// The code no longer produces these (see getSponsors / sponsor.js / reroll.js), but
// records written before the fix keep the bad key, because update() adds and replaces
// children without ever removing one. This script re-keys them.
//
// Three stale shapes, all under challenge/challenges/{messageId}:
//   sponsors.undefined          -> sponsors.{memberId}         (the reroll crash)
//   sponsor_earnings.undefined  -> sponsor_earnings.{memberId} (the <@undefined> mention)
//   sponsor.member_id           -> sponsor.member              (published open challenges)
//
// The member id is recovered from the entry's `user` (a key into /users) via that
// account's discordID -- the same fallback reroll.js uses at runtime.
//
// Usage:
//   node scripts/cleanStaleSponsors.js            # dry run — reports every record it would touch
//   node scripts/cleanStaleSponsors.js --apply    # write the repairs
//   node scripts/cleanStaleSponsors.js --apply --quiet   # summary only
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
const apply = args.includes('--apply');
const quiet = args.includes('--quiet');

const BAD_KEY = 'undefined';

// A sponsor entry knows its account key (`user`); that account knows the member id.
function memberIdOf(sponsor, users) {
    return sponsor?.member ?? sponsor?.member_id ?? users[sponsor?.user]?.discordID ?? null;
}

// Returns { updates, notes } for one challenge, or null when it's already clean. Paths in
// `updates` are relative to challenge/challenges/{id} so everything lands in one update().
// `updates` can come back empty with notes: that's a record this script won't guess at.
function planFor(challenge, users) {
    const updates = {};
    const notes = [];

    const stale_sponsor = challenge.sponsors?.[BAD_KEY];
    if (stale_sponsor) {
        const member = memberIdOf(stale_sponsor, users);
        updates[`sponsors/${BAD_KEY}`] = null;
        if (!member) {
            //nothing identifies this sponsor any more -- the account it pointed at is gone.
            //Dropping it is the only option left, and it costs nothing: getSponsors rebuilds
            //this map from challenge/sponsorships on the next render anyway.
            notes.push(`sponsors.undefined -> dropped (no member id; user=${stale_sponsor.user ?? 'none'})`);
        } else if (challenge.sponsors[member]) {
            //A later render already rebuilt this sponsor under the right key, so the stale
            //child is a duplicate. Keep the live entry untouched rather than merging counts
            //into it -- getSponsors resets `earnings` to 0 on every render, so the stale
            //number is not an independent total that would be lost.
            notes.push(`sponsors.undefined -> dropped (duplicate of sponsors.${member})`);
        } else {
            updates[`sponsors/${member}`] = { ...stale_sponsor, member };
            notes.push(`sponsors.undefined -> sponsors.${member}`);
        }
    }

    const stale_earnings = challenge.sponsor_earnings?.[BAD_KEY];
    if (stale_earnings !== undefined && stale_earnings !== null) {
        //These are real payouts that the card prints as `<@undefined>`, and unlike the
        //sponsors map they accumulate and are never reset -- so a value already sitting
        //under the correct key is a separate total and the two have to be added.
        //
        //Whose payout it is comes from the sponsors map: the stale entry when it's still
        //there, otherwise the sponsor list itself -- but only when that leaves exactly one
        //candidate. Crediting the wrong sponsor is worse than leaving a record for a human,
        //so a challenge with several sponsors and no stale entry to point at is reported
        //rather than guessed at.
        const stale_entry = challenge.sponsors?.[BAD_KEY];
        const candidates = stale_entry
            ? [memberIdOf(stale_entry, users)].filter(Boolean)
            : [...new Set(Object.values(challenge.sponsors ?? {}).map(s => memberIdOf(s, users)).filter(Boolean))];

        if (candidates.length > 1) {
            notes.push(`sponsor_earnings.undefined (📀${stale_earnings}) -> NEEDS REVIEW: could belong to any of ${candidates.join(', ')}`);
        } else if (!candidates.length) {
            updates[`sponsor_earnings/${BAD_KEY}`] = null;
            notes.push(`sponsor_earnings.undefined (📀${stale_earnings}) -> dropped (no member id)`);
        } else {
            const member = candidates[0];
            const existing = Number(challenge.sponsor_earnings[member]) || 0;
            updates[`sponsor_earnings/${BAD_KEY}`] = null;
            updates[`sponsor_earnings/${member}`] = existing + (Number(stale_earnings) || 0);
            notes.push(`sponsor_earnings.undefined (📀${stale_earnings}) -> sponsor_earnings.${member} (was 📀${existing})`);
        }
    }

    //The published-sponsorship shape: `member_id` where every reader wants `member`.
    if (challenge.sponsor && challenge.sponsor.member_id !== undefined && challenge.sponsor.member === undefined) {
        updates['sponsor/member'] = challenge.sponsor.member_id;
        updates['sponsor/member_id'] = null;
        notes.push(`sponsor.member_id -> sponsor.member (${challenge.sponsor.member_id})`);
    }

    return notes.length ? { updates, notes } : null;
}

async function main() {
    const db = admin.database();
    const [challenge_snap, user_snap] = await Promise.all([
        db.ref('challenge/challenges').once('value'),
        db.ref('users').once('value')
    ]);
    const challenges = challenge_snap.val() || {};
    const users = user_snap.val() || {};

    console.log(`scanned ${Object.keys(challenges).length.toLocaleString()} challenges against ${Object.keys(users).length.toLocaleString()} users\n`);

    const found = [];
    Object.keys(challenges).forEach(id => {
        const plan = planFor(challenges[id], users);
        if (plan) {
            found.push({ id, ...plan });
        }
    });
    //A record can be worth reporting without being safely repairable.
    const plans = found.filter(({ updates }) => Object.keys(updates).length);
    const review = found.filter(({ notes }) => notes.some(note => note.includes('NEEDS REVIEW')));

    if (!found.length) {
        console.log('No stale sponsor records found — nothing to do.');
        return 0;
    }

    if (!quiet) {
        found.forEach(({ id, notes }) => {
            const challenge = challenges[id];
            console.log(`challenge/challenges/${id}  (${challenge.type ?? 'unknown'}${challenge.url ? `, ${challenge.url}` : ''})`);
            notes.forEach(note => console.log(`    ${note}`));
        });
        console.log('');
    }

    //Counts what will actually be written, so the tally can't be read as a promise to
    //repair something this script has deliberately left for a human.
    const tally = plans.reduce((counts, { notes }) => {
        notes.filter(note => !note.includes('NEEDS REVIEW')).forEach(note => {
            const kind = note.split(' ')[0];
            counts[kind] = (counts[kind] || 0) + 1;
        });
        return counts;
    }, {});
    console.log(`${plans.length} challenge record(s) to repair:`);
    Object.keys(tally).sort().forEach(kind => console.log(`    ${tally[kind]}  ${kind}`));
    if (review.length) {
        console.log(`\n${review.length} record(s) need a human — see NEEDS REVIEW above: ${review.map(r => r.id).join(', ')}`);
    }

    if (!apply) {
        console.log('\nDry run. Re-run with --apply to write these changes.');
        return 0;
    }

    if (!plans.length) {
        console.log('\nNothing to repair.');
        return 0;
    }

    //One multi-path update per record: every other child under the challenge is left alone.
    let written = 0;
    for (const { id, updates } of plans) {
        await db.ref(`challenge/challenges/${id}`).update(updates);
        written++;
    }
    console.log(`\nRepaired ${written} challenge record(s).`);

    //Read back rather than trusting the writes -- a leftover bad key is the whole bug.
    const after = (await db.ref('challenge/challenges').once('value')).val() || {};
    const remaining = Object.keys(after).filter(id => Object.keys(planFor(after[id], users)?.updates ?? {}).length);
    if (remaining.length) {
        console.error(`\n${remaining.length} record(s) still stale: ${remaining.slice(0, 10).join(', ')}`);
        return 1;
    }
    console.log('Verified: no stale sponsor records remain.');
    return 0;
}

main().then(code => process.exit(code)).catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
