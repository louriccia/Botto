// Read-only dump of live Chance Cube state: any runs in progress, and each player's unlock
// progress. Useful for confirming the mode is persisting correctly during a playtest.
//
// Usage:
//   node scripts/inspectChanceCube.js

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

(async () => {
    const db = admin.database();
    const live = (await db.ref('challenge/cube/live').get()).val() || {};

    console.log('=== runs in progress ===');
    const ladders = live.ladders || {};
    if (!Object.keys(ladders).length) console.log('(none)');
    for (const [id, l] of Object.entries(ladders)) {
        console.log(`${id}  stake ${l.stake} · L${(Number(l.level ?? l.rung) || 0) + 1} · called ${l.call} · standing ${l.standing}`
            + ` · ×${l.mult ?? 1} · roll ${(l.roll || []).join(',')}`);
        for (const n of Object.values(l.notes || {})) console.log(`  ${n.replace(/<a?:(\w+):\d+>/g, ':$1:')}`);
    }

    console.log('\n=== players with cube state ===');
    const users = (await db.ref('users').get()).val() || {};
    let found = 0;
    for (const [key, u] of Object.entries(users)) {
        const c = u.random?.cube;
        if (!c) continue;
        found++;
        const bal = (Number(u.random?.truguts_earned) || 0) - (Number(u.random?.truguts_spent) || 0);
        const n = v => Number(v) || 0;
        console.log(`${u.random?.name ?? key} (${u.discordID})  prestige ${c.prestige ?? 0} · Level 1-${(c.unlocked ?? 0) + 1} unlocked · ${c.clears ?? 0} clears · stake ${c.stake ?? '(unset)'} · turn ${c.turn ?? 0} · balance ${bal}`);
        const owned = Object.keys(c.cubes || {});
        console.log(`  rack ${Object.values(c.equipped || {}).join(',') || '(empty)'}`
            + `${c.slots ? ` [stale slots:${n(c.slots)}, ignored]` : ''}`
            + ` · owns ${owned.length ? owned.join(',') : '(none)'}`
            + ` · rerolls ${n(c.rerolls)}${c.buyReroll ? ' (buying unlocked)' : ''}`);
        console.log(`  won ${n(c.totalWon)} · lost ${n(c.totalLost)} · spent ${n(c.totalSpent)}`
            + ` · net ${n(c.totalWon) - n(c.totalLost) - n(c.totalSpent)}`);
        console.log(`  streak ${n(c.streak)} (best ${n(c.bestStreak)})`);
        console.log(`  best L${n(c.bestLevel) + 1} · best standing ${n(c.bestStanding)}`
            + ` · biggest roll ${n(c.bestCubes)} cubes · biggest multiple ${n(c.bestMultiple)}x`
            + ` · called B${n(c.calls?.blue)}/R${n(c.calls?.red)}`
            + ` · won B${n(c.wins?.blue)}/R${n(c.wins?.red)}`
            + ` · rolled B${n(c.rolled?.blue)}/R${n(c.rolled?.red)}`);
        const PERKS = ['premonition','nudge','shuffle','scrap','reroll','bribe','sidebet','salvage','split','keeper'];
        console.log(`  perks ${PERKS.filter(k => c[k]).join(',') || '(none)'} · pressTier ${n(c.pressTier)} · points ${n(c.points)}`
            + ` · ties won ${n(c.ties?.won)}/${n(c.ties?.total)} (bribed ${n(c.ties?.bribed)}, boonta ${n(c.ties?.boonta)})`);
    }
    if (!found) console.log('(nobody has played yet)');

    process.exit(0);
})().catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
