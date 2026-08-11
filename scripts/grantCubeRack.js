// Grants (or revokes) a full Chance Cube rack for one user by Discord ID: every special cube, the
// first `bagSize()` of them equipped, and all three one-time perks — purchase rerolls, Qui-Gon's
// Nudge and Bribe Ties. For playtesting the deep end of the ladder without prestiging a dozen times.
//
// **Owning everything and fielding everything are different things.** The table holds `bagSize()`
// cubes, which is what a run draws, so the rest of the rack lands on the bench and swapping between
// them is part of what this fixture is for. Equipping the lot would only be clamped back on read.
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
const { OFF_RACK } = require('../src/game/cube/state.js');
const { bagSize } = require('../src/game/cube/engine.js');

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

// Every cube in the game, and the ones that are **not Watto's to sell**.
//
// The Planet Octahedron is the only cube owned by collecting rather than by picking off the rack, so
// it does not belong in `cube.cubes` — that key is the rack, and writing it there would hand the test
// account a profile no real player can have. It is granted through `effects.grand_circuit` instead,
// which is the same flag the Grand Circuit collection sets and the only thing `cubeState` reads it
// from. It sits at the front of the loadout for the same reason the whole script exists — it is the
// cube most worth having on the table for a playtest.
const ids = SPECIALS.map(sp => sp.id);
const rackIds = ids.filter(id => !OFF_RACK.has(id));
// What actually goes on the table: the bag's worth, in `SPECIALS` order, with the rest benched.
const fielded = ids.slice(0, bagSize());
// Collection rewards that grant a cube, mirroring `COLLECTED` in `game/cube/state.js`.
const COLLECTED_FLAGS = ['grand_circuit'];

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

    // Revoking drops back to the state a fresh account has. `slots` is cleared rather than set to 1:
    // there is no slot count any more, the engine never reads the key, and leaving a stale one behind
    // would only confuse the next person to inspect the profile.
    const patch = revoke
        ? {
            cubes: null, equipped: null, slots: null,
            buyReroll: null, nudge: null, bribe: null, bribes: 0,
        }
        : {
            cubes: Object.fromEntries(rackIds.map(id => [id, true])),
            // The whole rack owned, the bag's worth of it fielded — including the collected cubes,
            // which are owned through `effects` but still have to be on the table to be thrown. The
            // stale `slots` key is cleared: the cap is `bagSize()` for everyone and nothing reads it.
            slots: null,
            equipped: fielded,
            buyReroll: true,
            nudge: true,
            bribe: true,
            // Back to the bottom of the price ladder, so a bribe is cheap enough to be worth
            // testing rather than something he has already stopped offering.
            bribes: 0,
        };

    if (unlock && !revoke) patch.unlocked = LEVELS.length - 1;

    // The collection rewards, which live beside `cube` rather than inside it — same node the
    // Grand Circuit collection writes when its eighth face is claimed.
    const effects = user.random?.effects || {};
    const effectsPatch = Object.fromEntries(
        COLLECTED_FLAGS.map(flag => [flag, revoke ? null : true]),
    );

    const show = (label, before, after) => console.log(`  ${label.padEnd(11)} ${String(before).padEnd(28)} ->  ${after}`);

    console.log(`user key      ${key}`);
    console.log(`discordID     ${user.discordID}`);
    console.log(`name          ${user.random?.name ?? '(none)'}`);
    console.log(`prestige      ${c.prestige ?? 0}   ·   levels open 1-${(Number(c.unlocked) || 0) + 1}   ·   turn ${c.turn ?? 0}`);
    console.log('\nrack');
    // Counted against the **rack**, not against every cube in the game — the Planet Octahedron is not
    // on it, so `15/15` here would be a lie about a key that only ever holds fourteen.
    show('cubes', `${owned.length}/${rackIds.length}${owned.length ? ` (${owned.join(',')})` : ''}`,
        revoke ? 'none' : `${rackIds.length}/${rackIds.length} (all)`);
    if (c.slots !== undefined) show('slots', `${Number(c.slots) || 0} (stale, ignored)`, 'cleared');
    show('equipped', Object.values(c.equipped || {}).join(',') || '(none)',
        revoke ? '(none)' : `${fielded.length}/${bagSize()} (${fielded.join(',')})`);
    show('buyReroll', !!c.buyReroll, !revoke);
    show('nudge', !!c.nudge, !revoke);
    show('bribe', !!c.bribe, !revoke);
    show('bribes paid', Number(c.bribes) || 0, 0);
    for (const flag of COLLECTED_FLAGS) show(flag, !!effects[flag], !revoke);
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

    // Targeted child updates, so the lifetime record and the turn counter are untouched. Two nodes
    // rather than one, because a collected cube is not part of the rack: `cube` is what Watto sold and
    // `effects` is what was assembled out of collectibles.
    await db.ref(`users/${key}/random/cube`).update(patch);
    await db.ref(`users/${key}/random/effects`).update(effectsPatch);

    const after = (await db.ref(`users/${key}/random/cube`).get()).val() || {};
    const afterEffects = (await db.ref(`users/${key}/random/effects`).get()).val() || {};
    const got = Object.keys(after.cubes || {});
    const flagsOk = COLLECTED_FLAGS.every(f => !!afterEffects[f] === !revoke);
    const ok = flagsOk && (revoke
        ? !got.length && !after.nudge && !after.bribe && !after.buyReroll
        : got.length === rackIds.length && after.nudge === true && after.bribe === true
        && after.buyReroll === true && after.slots === undefined);
    console.log(`\nWrote users/${key}/random/cube and .../effects`);
    console.log(`  cubes ${got.length}/${rackIds.length}`
        + ` · equipped ${Object.values(after.equipped || {}).length}/${bagSize()}`
        + ` · buyReroll ${!!after.buyReroll} · nudge ${!!after.nudge} · bribe ${!!after.bribe}`
        + ` · bribes ${Number(after.bribes) || 0} · levels open 1-${(Number(after.unlocked) || 0) + 1}`);
    console.log(`  ${COLLECTED_FLAGS.map(f => `${f} ${!!afterEffects[f]}`).join(' · ')}`);
    console.log(ok ? 'Verified.' : 'MISMATCH — read back does not match what was requested.');
    process.exit(ok ? 0 : 1);
})().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
