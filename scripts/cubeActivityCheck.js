// Reports what the Discord Activity still needs, and which half of it is yours.
//
// Some of the setup is code and some is a form in the developer portal, and the portal half is
// invisible from the repo — so it is easy to have everything committed and nothing working, with
// no way to tell which. This asks Discord what it actually thinks is true.
//
//   node scripts/cubeActivityCheck.js
//
// Read-only. It changes nothing.

require('dotenv').config({ path: `${__dirname}/../.env` });

const { REST, Routes } = require('discord.js');

const CLIENT_ID = process.env.clientId;
const TOKEN = process.env.token;

// Application flags. EMBEDDED is the one that says "Activities are enabled", and it is set by
// ticking the box in the portal — there is no API for it.
const EMBEDDED = 1 << 17;

const PORT = Number(process.env.PORT) || 3030;

const rows = [];
const ok = (what, detail) => rows.push({ state: 'ok', what, detail });
const missing = (what, detail, fix) => rows.push({ state: 'missing', what, detail, fix });
const warn = (what, detail, fix) => rows.push({ state: 'warn', what, detail, fix });

(async () => {
    if (!CLIENT_ID || !TOKEN) {
        console.error('clientId and token must be in .env — nothing can be checked without them.');
        process.exit(1);
    }
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    // --- the environment ----------------------------------------------------
    for (const [name, why] of [
        ['CUBE_JWT_SECRET', 'nobody can hold a session'],
        ['DISCORD_CLIENT_SECRET', 'the code exchange cannot run, so nobody can sign in'],
    ]) {
        if (process.env[name]) ok(`env ${name}`, 'set');
        else missing(`env ${name}`, why, `add ${name} to .env, and to the Heroku config`);
    }

    // --- the application ----------------------------------------------------
    let app = null;
    try {
        app = await rest.get('/applications/@me');
        ok('application', `${app.name} (${app.id})`);
    } catch (err) {
        missing('application', `could not read it: ${err.status || ''} ${err.message}`,
            'check the bot token');
    }

    if (app) {
        if (app.flags & EMBEDDED) {
            ok('Activities enabled', 'the EMBEDDED flag is set');
        } else {
            missing('Activities enabled', 'the EMBEDDED flag is not set',
                'Developer Portal → your app → Activities → Settings → enable. '
                + 'Everything below depends on this.');
        }
    }

    // --- the entry point ----------------------------------------------------
    try {
        const cmds = await rest.get(Routes.applicationCommands(CLIENT_ID));
        const entry = cmds.find(c => c.type === 4);
        if (!entry) {
            missing('entry-point command', 'no type-4 command is registered',
                'enable Activities first, then: node src/scripts/deploy-commands.js --global');
        } else if (entry.handler === 1) {
            ok('entry-point command', `/${entry.name} · APP_HANDLER (the bot gates on the collection)`);
        } else {
            warn('entry-point command', `/${entry.name} · handler ${entry.handler}`,
                'handler 2 lets Discord launch without asking the bot, so a player who has not '
                + 'built a cube gets a loading screen instead of an explanation');
        }
    } catch (err) {
        warn('entry-point command', `could not read commands: ${err.message}`, '');
    }

    // --- the API ------------------------------------------------------------
    try {
        const res = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(3000) });
        const body = await res.json();
        if (body.ok) ok('cube API', `answering on ${PORT}, bot ${body.bot ? 'ready' : 'not ready'}`);
        else warn('cube API', `answered oddly on ${PORT}`, '');
    } catch (err) {
        warn('cube API', `nothing answering on ${PORT}`,
            'only matters locally — in production Heroku routes to the web dyno');
    }

    // --- the portal half nothing can see ------------------------------------
    // URL mappings have no read API, so this can only say what they should be.
    rows.push({
        state: 'manual',
        what: 'URL mappings',
        detail: 'not readable through the API — check them by eye',
        fix: 'Developer Portal → Activities → URL Mappings. The portal keeps these apart, so\n'
            + '      there is no ordering question between them:\n'
            + '        Root Mapping        /      ->  bottosjunkyard.com/activity\n'
            + '        Proxy Path Mapping  /cube  ->  botto-swe1r.herokuapp.com\n'
            + '      Targets carry no protocol. The root target must be a directory that serves an\n'
            + '      index — /activity, never /activity.html. Ordering only matters if two proxy\n'
            + '      path prefixes overlap.',
    });

    // The other half of the portal, and a different page of it. This one gates playing on the
    // **site** rather than inside Discord: the browser OAuth flow sends `redirect_uri` to Discord,
    // which refuses any value not registered here verbatim — trailing slash and all.
    rows.push({
        state: 'manual',
        what: 'OAuth redirects',
        detail: 'not readable through the API — check them by eye',
        fix: 'Developer Portal → OAuth2 → Redirects. Needed only for playing on the site;\n'
            + '      launching from Discord uses the Embedded SDK and never touches these:\n'
            + '        https://botto-swe1r.herokuapp.com/cube/auth/callback\n'
            + '        http://localhost:3030/cube/auth/callback   (local development)\n'
            + '      Each must match CUBE_OAUTH_REDIRECT in the matching environment exactly.',
    });

    // --- report -------------------------------------------------------------
    const mark = { ok: ' ok ', missing: 'TODO', warn: 'warn', manual: 'you' };
    console.log('');
    for (const r of rows) {
        console.log(`  [${mark[r.state]}] ${r.what}${r.detail ? ` — ${r.detail}` : ''}`);
        if (r.fix && r.state !== 'ok') console.log(`         ${r.fix}`);
    }
    const blocked = rows.filter(r => r.state === 'missing');
    console.log('');
    console.log(blocked.length
        ? `${blocked.length} thing(s) still blocking: ${blocked.map(r => r.what).join(', ')}`
        : 'Nothing blocking on this side — check the URL mappings by eye and launch it.');
    process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
