// Wipes one player's Chance Cube standing so the early game can be played again from nothing.
//
// Two nodes hold everything the mode remembers about a player, and this removes both:
//
//   users/<key>/random/cube                    progress, rack, prestige, lifetime record
//   challenge/cube/live/ladders/<discordId>    a run left in progress, busted, or parked on a tie
//
// Deliberately left alone:
//   random/effects.chance_cube   the unlock itself — the point is to replay, not to lock out
//   random/truguts_*             the shared challenge-system balance, not a cube stat
//
// Both nodes are removed rather than overwritten with zeroes, because `cubeState` reads a missing
// profile as a fresh one — an absent node and a zeroed one are the same player to the game, and the
// absent one can't leave a field behind that a later version of the shape doesn't recognise.
//
// Usage:
//   node scripts/resetChanceCube.js <discordId>            # dry run — shows what would go
//   node scripts/resetChanceCube.js <discordId> --apply    # wipe it
//
// Requires the same Firebase env vars the bot uses (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY,
// FIREBASE_CLIENT_EMAIL), e.g. from a local .env file.

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

if (!discordId) {
    console.error('Usage: node scripts/resetChanceCube.js <discordId> [--apply]');
    process.exit(1);
}

const n = v => Number(v) || 0;

(async () => {
    const db = admin.database();
    const users = (await db.ref('users').get()).val() || {};

    const key = Object.keys(users).find(k => String(users[k]?.discordID) === discordId);
    if (!key) {
        console.error(`No user found with discordID ${discordId}. They need to use the bot at least once first.`);
        process.exit(1);
    }

    const user = users[key];
    const profile = user.random || {};
    const c = profile.cube;
    const ladder = (await db.ref(`challenge/cube/live/ladders/${discordId}`).get()).val();

    console.log(`user key      ${key}`);
    console.log(`discordID     ${user.discordID}`);
    console.log(`name          ${profile.name ?? '(none)'}`);
    console.log(`unlock        effects.chance_cube = ${profile.effects?.chance_cube === true}  (kept)`);
    console.log(`truguts       ${n(profile.truguts_earned) - n(profile.truguts_spent)}  (kept)`);

    console.log('\n=== users/' + key + '/random/cube ===');
    if (!c) {
        console.log('(none — already a fresh player)');
    } else {
        console.log(`prestige ${n(c.prestige)} · Level 1-${n(c.unlocked) + 1} unlocked · ${n(c.clears)} clears`
            + ` · ${n(c.points)} unspent point(s)`);
        console.log(`rack ${Object.values(c.equipped || {}).join(',') || '(empty)'}`
            + `${c.slots ? ` [stale slots:${n(c.slots)}, ignored]` : ''}`
            + ` · owns ${Object.keys(c.cubes || {}).join(',') || '(none)'}`);
        console.log(`rerolls ${n(c.rerolls)}${c.buyReroll ? ' (buying unlocked)' : ''}`
            + `${c.nudge ? ' · nudge' : ''}${c.bribe ? ` · bribe (${n(c.bribes)} paid)` : ''}`);
        console.log(`stake ${c.stake ?? '(unset)'} · turn ${n(c.turn)}`
            + ` · won ${n(c.totalWon)} · lost ${n(c.totalLost)} · spent ${n(c.totalSpent)}`);
        console.log(`best L${n(c.bestLevel) + 1} · best standing ${n(c.bestStanding)}`
            + ` · streak ${n(c.streak)} (best ${n(c.bestStreak)})`);
    }

    console.log('\n=== challenge/cube/live/ladders/' + discordId + ' ===');
    if (!ladder) {
        console.log('(no run in progress)');
    } else {
        const state = ladder.dead ? 'busted, reroll on the table' : (ladder.tie ? 'parked on a tie' : 'live');
        console.log(`${state} · stake ${ladder.stake} · L${(Number(ladder.level ?? ladder.rung) || 0) + 1}`
            + ` · standing ${ladder.standing} · ×${ladder.mult ?? 1}`);
    }

    if (!c && !ladder) {
        console.log('\nNothing to reset — this player has no cube state.');
        process.exit(0);
    }
    if (!apply) {
        console.log('\nDry run. Re-run with --apply to wipe both nodes.');
        process.exit(0);
    }

    // A live run is dropped first. The other order would leave a run holding a standing whose
    // profile no longer exists, and the bot's mirror is live — it would render that gap.
    await db.ref(`challenge/cube/live/ladders/${discordId}`).remove();
    await db.ref(`users/${key}/random/cube`).remove();

    const cubeAfter = (await db.ref(`users/${key}/random/cube`).get()).val();
    const ladderAfter = (await db.ref(`challenge/cube/live/ladders/${discordId}`).get()).val();
    console.log(`\nRemoved users/${key}/random/cube        -> ${cubeAfter === null ? 'gone' : JSON.stringify(cubeAfter)}`);
    console.log(`Removed live ladder for ${discordId} -> ${ladderAfter === null ? 'gone' : JSON.stringify(ladderAfter)}`);

    const clean = cubeAfter === null && ladderAfter === null;
    console.log(clean ? '\nReset. Next /cube opens on the start screen at Level 1.' : '\nSomething survived the wipe — check the paths above.');
    process.exit(clean ? 0 : 1);
})().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
