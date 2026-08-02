// Register the bot's slash commands with Discord.
//
// The bot serves the SWE1R guild (and everywhere else it's installed) from the
// GLOBAL command set. Guild-scoped registration exists only for the test guild,
// where it propagates instantly instead of taking up to an hour.
//
// The target is always explicit -- running this with no arguments prints the
// current state and does nothing. An earlier version defaulted to writing to the
// test guild, which meant a "deploy" could look like it succeeded while leaving
// the commands real users see completely untouched.
//
//   node deploy-commands.js --list                 show what's registered vs. what's here
//   node deploy-commands.js --global               deploy globally (this is the real one)
//   node deploy-commands.js --guild <id>           deploy to one guild, for testing
//   node deploy-commands.js --clear-guild <id>     remove a guild's own registrations
//
// Requires clientId and token in .env. Safe to re-run: every mode is a PUT, which
// replaces the whole command set rather than appending to it.

require('dotenv').config({ path: __dirname + '/../../.env' })

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Commands that exist in the repo but are deliberately kept out of the GLOBAL set.
// Deploy these to the test guild with --guild if you need them.
//
// That second sentence used to be untrue: the filter ran for every mode, so an excluded command
// could not be deployed anywhere, and --guild silently dropped exactly the commands you were
// testing. It is honoured for --global only now, which is what the line has always claimed.
const EXCLUDE = [
	'scrape',
	'lookup',   // test-guild only; never been public. Drop from this list to release it.
	// Botto's Chance Cube. Held back while the Discord Activity is being built: /chubacubes has
	// only ever run in the test guild, and /launch is Discord's own entry point, which the bot only
	// needs to take over if it should gate the collection before the iframe opens.
	'chubacubes',
	'launch',
];

// __dirname-relative: the old './../commands/' only resolved when you happened to
// run this from src/scripts/, and silently found nothing otherwise.
const COMMAND_DIR = path.join(__dirname, '../commands');

function loadCommands({ applyExcludes }) {
	const commands = [];
	const skipped = [];
	const broken = [];
	for (const file of fs.readdirSync(COMMAND_DIR).filter(f => f.endsWith('.js'))) {
		const command = require(path.join(COMMAND_DIR, file));
		if (!command.data) continue;
		if (applyExcludes && EXCLUDE.includes(command.data.name)) { skipped.push(command.data.name); continue; }
		// A definition that won't serialise is one command's problem, not the deploy's. This used
		// to throw and take the whole run with it — which nobody noticed, because the one broken
		// command was also on the exclude list and never reached this line.
		try {
			commands.push(command.data.toJSON());
		} catch (err) {
			broken.push({ file, name: command.data.name, why: err.message });
		}
	}
	return { commands, skipped, broken };
}

const clientID = process.env.clientId;
const token = process.env.token;

if (!clientID || !token) {
	console.error('Missing clientId or token in .env - nothing to do.');
	process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);
const names = list => list.map(c => '/' + c.name).sort().join(' ') || '(none)';

async function show(label, route) {
	try {
		const current = await rest.get(route);
		console.log(`  ${label}: ${current.length}\n    ${names(current)}`);
		return current;
	} catch (err) {
		console.log(`  ${label}: unreadable (${err.status || ''} ${err.message})`);
		return null;
	}
}

(async () => {
	const [mode, arg] = process.argv.slice(2);
	// A guild deploy is for testing, which is exactly what the held-back commands are for.
	const { commands, skipped, broken } = loadCommands({ applyExcludes: mode !== '--guild' });

	console.log(`Found ${commands.length} command(s) in ${COMMAND_DIR}`);
	console.log(`  ${names(commands)}`);
	if (skipped.length) console.log(`  excluded from global: ${skipped.join(' ')}`);
	if (mode === '--guild' && EXCLUDE.length) {
		console.log(`  including ${EXCLUDE.join(' ')} — guild deploys carry the held-back commands`);
	}
	for (const b of broken) {
		console.log(`  BROKEN, not deployed: ${b.file} (${b.name || 'unnamed'}) — ${b.why}`);
	}
	console.log('');

	try {
		if (mode === '--global') {
			const before = await rest.get(Routes.applicationCommands(clientID));
			const added = commands.filter(c => !before.some(b => b.name === c.name)).map(c => c.name);
			const removed = before.filter(b => !commands.some(c => c.name === b.name)).map(b => b.name);

			const data = await rest.put(Routes.applicationCommands(clientID), { body: commands });
			console.log(`Deployed ${data.length} command(s) globally.`);
			if (added.length) console.log(`  added:   ${added.map(n => '/' + n).join(' ')}`);
			if (removed.length) console.log(`  removed: ${removed.map(n => '/' + n).join(' ')}`);
			if (!added.length && !removed.length) console.log('  no change to the command list (definitions may still have updated)');
			console.log('\nGlobal commands can take up to an hour to appear everywhere.');
			return;
		}

		if (mode === '--guild') {
			if (!arg) return console.error('--guild needs a guild id.');
			const data = await rest.put(Routes.applicationGuildCommands(clientID, arg), { body: commands });
			console.log(`Deployed ${data.length} command(s) to guild ${arg} (instant).`);
			console.log('Note: a guild copy sits alongside the global set - expect duplicates for any shared name.');
			return;
		}

		if (mode === '--clear-guild') {
			if (!arg) return console.error('--clear-guild needs a guild id.');
			await rest.put(Routes.applicationGuildCommands(clientID, arg), { body: [] });
			console.log(`Cleared all guild-scoped commands for ${arg}. That guild now uses the global set.`);
			return;
		}

		// --list, and the no-argument default.
		console.log('Currently registered:');
		await show('global', Routes.applicationCommands(clientID));
		for (const [label, id] of [['test guild', '1135800421290627112'], ['secret guild', '1199872145354915920']]) {
			await show(`${label} (${id})`, Routes.applicationGuildCommands(clientID, id));
		}
		if (mode !== '--list') {
			console.log('\nNothing deployed. Pass --global to deploy for real, or --list to just look.');
		}
	} catch (error) {
		console.error('Deploy failed:', error.status || '', error.message);
		process.exitCode = 1;
	} finally {
		// Loading the command modules pulls in firebase.js, whose realtime
		// listeners hold the event loop open forever. Without this the script
		// never returns to the shell -- and when its output is piped rather than
		// on a terminal, node's buffered stdout never flushes, so it looks like
		// the deploy produced nothing at all.
		await new Promise(r => process.stdout.write('', r));
		process.exit(process.exitCode || 0);
	}
})();
