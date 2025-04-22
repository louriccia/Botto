require('dotenv').config({ path: __dirname + '/../../.env' })

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');

//const {commands} = require('./command_register.js');
// Grab all the command files from the commands directory you created earlier
const commandFiles = fs.readdirSync('../commands/').filter(file => file.endsWith('.js'));
let commands = []
let other_commands = []
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	const command = require(`../commands/${file}`);
	if (command.data) {
		if (!['scrape'].includes(command.data.name)) {
			console.log(command.data)
			commands.push(command.data.toJSON());
		} else {
			if (!['scrape'].includes(command.data.name)) {
				other_commands.push(command.data.toJSON())
			}
		}
	}


}

const clientID = process.env.clientId
const SWE1R_Guild = process.env.guilldId
const Botto_Guild = '1135800421290627112'
const secret_guild = '1199872145354915920'
const token = process.env.token

// Construct and prepare an instance of the REST module

const rest = new REST({ version: '10' }).setToken(token);

// deploy commands
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		//application commands
		// const data = await rest.put(
		// 	Routes.applicationCommands('545798436105224203'),
		// 	{ body: commands },
		// );

		// delete
		await rest.put(Routes.applicationGuildCommands(clientID, Botto_Guild), { body: [] })
			.then(() => console.log('Successfully deleted all guild commands.'))
			.catch(console.error);

		await rest.put(
			Routes.applicationGuildCommands(clientID, Botto_Guild),
			{ body: commands },
		);

		//console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();