// Mints a cube API token for a real player, so the Activity's endpoints can be exercised without
// going through Discord's OAuth.
//
// The Embedded App SDK's `authorize()` only works inside a Discord client, which makes the API
// awkward to poke at while building the front end. This hands you the same token that flow would,
// for a player who already owns the chance cube.
//
// Read-only — it reads the mirror and signs a JWT. Nothing is written.
//
//   node scripts/cubeDevToken.js                 # first player who owns the cube
//   node scripts/cubeDevToken.js <discordId>     # a specific one
//
// Then:
//   curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3030/cube/state

require('dotenv').config();

// Everything this script loads is free to log — `src/firebase.js` announces "user db ready" on
// stdout when its listeners warm up — and any of it would end up inside `$(...)`, in the middle of
// the token, producing an Authorization header with a newline in it and a bare 400 from Node's
// HTTP parser. So stdout is reserved for the token and nothing else: chatter goes to stderr.
console.log = (...args) => console.error(...args);

const jwt = require('jsonwebtoken');
const { db } = require('../src/firebase.js');

const WANTED = process.argv[2] || null;
const SECRET = process.env.CUBE_JWT_SECRET;

if (!SECRET) {
    console.error('CUBE_JWT_SECRET is not set — the API would reject anything signed here.');
    process.exit(1);
}

// The mirror fills in from realtime listeners, so there is nothing to read the moment this starts.
// Polls rather than guessing at a delay.
const start = Date.now();
const tick = function () {
    const users = db.user || {};
    const keys = Object.keys(users);

    if (keys.length) {
        const key = WANTED
            ? keys.find(k => String(users[k]?.discordID) === String(WANTED))
            : keys.find(k => users[k]?.random?.effects?.chance_cube);

        if (key) {
            const p = users[key].random || {};
            if (!p.effects?.chance_cube) {
                console.error(`That player does not own the chance cube. `
                    + `Grant it with scripts/grantChanceCube.js first.`);
                process.exit(1);
            }
            const token = jwt.sign(
                { discordId: String(users[key].discordID), userKey: key },
                SECRET,
                { expiresIn: '12h' },
            );
            const balance = (Number(p.truguts_earned) || 0) - (Number(p.truguts_spent) || 0);
            console.error(`player   ${p.name} (${users[key].discordID})`);
            console.error(`balance  ${balance}`);
            console.error(`prestige ${p.cube?.prestige || 0}  ·  unlocked L${(p.cube?.unlocked || 0) + 1}`);
            console.error('');
            // The token alone on stdout, so `TOKEN=$(node scripts/cubeDevToken.js)` works.
            process.stdout.write(`${token}\n`);
            process.exit(0);
        }
        if (WANTED) {
            console.error(`No player with discord id ${WANTED}.`);
            process.exit(1);
        }
        console.error(`None of the ${keys.length} players own the chance cube. `
            + 'Grant it with scripts/grantChanceCube.js first.');
        process.exit(1);
    }

    if (Date.now() - start > 30000) {
        console.error('The user mirror never populated — is the database reachable?');
        process.exit(1);
    }
    setTimeout(tick, 500);
};
tick();
