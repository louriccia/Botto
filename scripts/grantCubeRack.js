// Grants (or revokes) a full Chance Cube rack for one user by Discord ID: every special cube,
// a slot for each of them, and all three one-time perks — purchase rerolls, Qui-Gon's Nudge and
// Bribe Ties. For playtesting the deep end of the ladder without prestiging a dozen times.
//
// The cube list is read from the game data rather than hardcoded, so a cube added later is
// granted by this script without it needing an edit.
//
// This only ever touches the rack. Prestige, unlocked levels, clears, the lifetime record, the
// turn counter and any run in progress are all left exactly as they are — except with --unlock,
// which additionally opens every level on the ladder.
//
// Usage:
//   node scripts/grantCubeRack.js <discordId>                    # dry run — shows the diff
//   node scripts/grantCubeRack.js <discordId> --apply            # grant the full rack
//   node scripts/grantCubeRack.js <discordId> --unlock --apply   # ...and open every level
//   node scripts/grantCubeRack.js <discordId> --revoke --apply   # strip it all back down
//
// Requires the same Firebase env vars the bot uses (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY,
// FIREBASE_CLIENT_EMAIL), e.g. from a local .env file.

require('dotenv').config();
const admin = require('firebase-admin');
const { SPECIALS, LEVELS } = require('../src/data/challenge/cube.js');

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
const unlock = args.includes('--unlock');

if (!discordId) {
    console.error('Usage: node scripts/grantCubeRack.js <discordId> [--unlock] [--revoke] [--apply]');
    process.exit(1);
}

const ids = SPECIALS.map(sp => sp.id);

(async () => {
    const db = admin.database();
    const users = (await db.ref('users').get()).val() || {};

    const key = Object.keys(users).find(k => String(users[k]?.discordID) === discordId);
    if (!key) {
        console.error(`No user found with discordID ${discordId}. They need to use the bot at least once first.`);
        process.exit(1);
    }

    const user = users[key];
    const c = user.random?.cube || {};
    const owned = Object.keys(c.cubes || {});

    // Revoking drops back to the state a fresh account has, not to nothing: `startingSlots` is 1
    // and the engine clamps to it on read anyway, so writing 0 would just be a lie in the data.
    const patch = revoke
        ? {
            cubes: null, equipped: null, slots: 1,
            buyReroll: null, nudge: null, bribe: null, bribes: 0,
        }
        : {
            cubes: Object.fromEntries(ids.map(id => [id, true])),
            // A slot each, so the whole rack can be fielded at once — the point of the grant.
            slots: ids.length,
            equipped: ids,
            buyReroll: true,
            nudge: true,
            bribe: true,
            // Back to the bottom of the price ladder, so a bribe is cheap enough to be worth
            // testing rather than something he has already stopped offering.
            bribes: 0,
        };

    if (unlock && !revoke) patch.unlocked = LEVELS.length - 1;

    const show = (label, before, after) => console.log(`  ${label.padEnd(11)} ${String(before).padEnd(28)} ->  ${after}`);

    console.log(`user key      ${key}`);
    console.log(`discordID     ${user.discordID}`);
    console.log(`name          ${user.random?.name ?? '(none)'}`);
    console.log(`prestige      ${c.prestige ?? 0}   ·   levels open 1-${(Number(c.unlocked) || 0) + 1}   ·   turn ${c.turn ?? 0}`);
    console.log('\nrack');
    show('cubes', `${owned.length}/${ids.length}${owned.length ? ` (${owned.join(',')})` : ''}`,
        revoke ? 'none' : `${ids.length}/${ids.length} (all)`);
    show('slots', Number(c.slots) || 1, patch.slots);
    show('equipped', Object.values(c.equipped || {}).join(',') || '(none)',
        revoke ? '(none)' : `all ${ids.length}`);
    show('buyReroll', !!c.buyReroll, !revoke);
    show('nudge', !!c.nudge, !revoke);
    show('bribe', !!c.bribe, !revoke);
    show('bribes paid', Number(c.bribes) || 0, 0);
    if (unlock && !revoke) show('unlocked', `1-${(Number(c.unlocked) || 0) + 1}`, `1-${LEVELS.length}`);

    // Loud, because writing the rack mid-run changes what the *next* push rolls with.
    const live = (await db.ref(`challenge/cube/live/ladders/${discordId}`).get()).val();
    if (live && !live.dead) {
        console.log(`\nNOTE: a run is live — L${(Number(live.level ?? live.rung) || 0) + 1},`
            + ` ${live.tie ? 'parked on a tie' : `standing ${live.standing}`}.`
            + ' It is left alone, but the new rack applies from its next roll.');
    }

    if (!apply) {
        console.log('\nDry run. Re-run with --apply to write this.');
        process.exit(0);
    }

    // Targeted child update, so the lifetime record and the turn counter are untouched.
    await db.ref(`users/${key}/random/cube`).update(patch);

    const after = (await db.ref(`users/${key}/random/cube`).get()).val() || {};
    const got = Object.keys(after.cubes || {});
    const ok = revoke
        ? !got.length && !after.nudge && !after.bribe && !after.buyReroll
        : got.length === ids.length && after.nudge === true && after.bribe === true
        && after.buyReroll === true && Number(after.slots) === ids.length;
    console.log(`\nWrote users/${key}/random/cube`);
    console.log(`  cubes ${got.length}/${ids.length} · slots ${after.slots ?? '(unset)'}`
        + ` · equipped ${Object.values(after.equipped || {}).length}`
        + ` · buyReroll ${!!after.buyReroll} · nudge ${!!after.nudge} · bribe ${!!after.bribe}`
        + ` · bribes ${Number(after.bribes) || 0} · levels open 1-${(Number(after.unlocked) || 0) + 1}`);
    console.log(ok ? 'Verified.' : 'MISMATCH — read back does not match what was requested.');
    process.exit(ok ? 0 : 1);
})().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
