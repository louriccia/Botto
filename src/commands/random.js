const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cache = require('../cache.js');
const tools = require('../generic.js');
const { circuits } = require('../data/sw_racer/circuit.js');
const { planets } = require('../data/sw_racer/planet.js');
const { difficulties } = require('../data/difficulty.js');

const tierNames = ["Top", "High", "Mid", "Low"];

function randomizeRow(custom_id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Randomize")
            .setEmoji("🎲")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(custom_id)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('random')
        .setDescription('get a random racer, track, challenge, and more')
        .addSubcommand(subcommand =>
            subcommand
                .setName('racer')
                .setDescription('get a random racer')
                .addStringOption(option =>
                    option.setName('tier')
                        .setDescription('limit to a MU tier')
                        .addChoices(
                            { name: 'Any', value: 'any' },
                            { name: 'Top', value: '0' },
                            { name: 'High', value: '1' },
                            { name: 'Mid', value: '2' },
                            { name: 'Low', value: '3' }
                        )
                )
                .addStringOption(option =>
                    option.setName('canon')
                        .setDescription('limit to canonical or non-canonical racers')
                        .addChoices(
                            { name: 'Any', value: 'any' },
                            { name: 'Canon', value: 'canon' },
                            { name: 'Non-Canon', value: 'non-canon' }
                        )
                )
                .addBooleanOption(option =>
                    option.setName('vc')
                        .setDescription('roll a unique racer for everyone in your voice channel')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('track')
                .setDescription('get a random track')
                .addStringOption(option =>
                    option.setName('circuit')
                        .setDescription('limit to a circuit')
                        .addChoices(...circuits.map(c => ({ name: c.name, value: c.name })))
                )
                .addStringOption(option =>
                    option.setName('planet')
                        .setDescription('limit to a planet')
                        .addChoices(...planets.map(p => ({ name: p.name, value: p.name })))
                )
                .addStringOption(option =>
                    option.setName('length')
                        .setDescription('limit to a track length')
                        .addChoices(
                            { name: 'Short', value: 'short' },
                            { name: 'Medium', value: 'medium' },
                            { name: 'Long', value: 'long' }
                        )
                )
                .addStringOption(option =>
                    option.setName('difficulty')
                        .setDescription('limit to a difficulty')
                        .addChoices(...difficulties.map(d => ({ name: d.name, value: d.name })))
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('challenge')
                .setDescription('get a random pod/track challenge')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('teams')
                .setDescription('split everyone in your voice channel into teams')
                .addIntegerOption(option =>
                    option.setName('teams')
                        .setDescription('number of teams')
                        .setMinValue(2)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('number')
                .setDescription('get a random number')
                .addIntegerOption(option =>
                    option.setName('max')
                        .setDescription('the highest possible number (inclusive)')
                        .setMinValue(1)
                        .setRequired(true)
                )
        ),
    async execute({ client, interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand == "racer") {
            const tier = interaction.options.getString("tier") ?? "any";
            const canon = interaction.options.getString("canon") ?? "any";
            const vc = interaction.options.getBoolean("vc") ?? false;

            const pool = cache.racers.filter(racer => {
                if (tier !== "any" && racer.mu_tier != Number(tier)) return false;
                if (canon == "canon" && !racer.canon) return false;
                if (canon == "non-canon" && racer.canon) return false;
                return true;
            });

            if (pool.length == 0) {
                await interaction.reply({ content: "`Error: No racers meet that criteria`\n" + tools.randomErrorMessage(), ephemeral: true });
                return;
            }

            if (vc) {
                const voiceChannel = interaction.member?.voice?.channel;
                if (!voiceChannel) {
                    await interaction.reply({ content: "`Error: To roll a random racer for everyone in the voice channel, you need to be in a voice channel.`\n" + tools.randomErrorMessage(), ephemeral: true });
                    return;
                }
                const members = [...voiceChannel.members.values()].filter(m => !m.user.bot);
                let available = [...pool];
                let players = "";
                let pods = "";
                for (const m of members) {
                    if (available.length == 0) available = [...pool];
                    const index = Math.floor(Math.random() * available.length);
                    const racer = available.splice(index, 1)[0];
                    players += m.displayName + "\n";
                    pods += `${racer.flag} ${racer.name}\n`;
                }
                let desc = "Rolled random ";
                if (canon == "canon") desc += "canonical ";
                else if (canon == "non-canon") desc += "non-canonical ";
                if (tier !== "any") desc += tierNames[Number(tier)].toLowerCase() + " tier ";
                desc += "pods";
                const racerEmbed = new EmbedBuilder()
                    .setTitle("Random Racers")
                    .setDescription(desc)
                    .addFields(
                        { name: "Players", value: players, inline: true },
                        { name: "Pods", value: pods, inline: true }
                    );
                await interaction.reply({ embeds: [racerEmbed] });
                return;
            }

            const racer = tools.getRandomElement(pool);
            await interaction.reply({ embeds: [tools.getRacerEmbed(racer)], components: [randomizeRow("random_racer")] });

        } else if (subcommand == "track") {
            const circuit = interaction.options.getString("circuit");
            const planet = interaction.options.getString("planet");
            const length = interaction.options.getString("length");
            const difficulty = interaction.options.getString("difficulty");

            const pool = cache.tracks.filter(track => {
                if (circuit && track.circuit?.name !== circuit) return false;
                if (planet && track.planet?.name !== planet) return false;
                if (length && track.lengthclass.replace("Extra ", "").toLowerCase() !== length) return false;
                if (difficulty && difficulties[track.difficulty]?.name !== difficulty) return false;
                return true;
            });

            if (pool.length == 0) {
                await interaction.reply({ content: "`Error: No tracks meet that criteria`\n" + tools.randomErrorMessage(), ephemeral: true });
                return;
            }

            const track = tools.getRandomElement(pool);
            await interaction.reply({ embeds: [tools.getTrackEmbed(track)], components: [randomizeRow("random_track")] });

        } else if (subcommand == "challenge") {
            await client.buttons.get("challenge").execute({ client, interaction, args: ["random", "play"], database, db, member_id, member_name, member_avatar, user_key, user_profile });

        } else if (subcommand == "teams") {
            const teamnum = interaction.options.getInteger("teams");
            const voiceChannel = interaction.member?.voice?.channel;
            if (!voiceChannel) {
                await interaction.reply({ content: "`Error: To make random teams, you need to be in a voice channel.`\n" + tools.randomErrorMessage(), ephemeral: true });
                return;
            }
            const memarray = [...voiceChannel.members.values()].filter(m => !m.user.bot).map(m => m.displayName);
            if (teamnum > memarray.length) {
                await interaction.reply({ content: "`Error: That's too many teams!`\n" + tools.randomErrorMessage(), ephemeral: true });
                return;
            }
            const teams = Array.from({ length: teamnum }, () => []);
            let i = 0;
            while (memarray.length > 0) {
                const index = Math.floor(Math.random() * memarray.length);
                teams[i % teamnum].push(memarray.splice(index, 1)[0]);
                i++;
            }
            const teamEmbed = new EmbedBuilder()
                .setTitle("Random Teams")
                .setDescription("Everyone in the voice channel has been split into **" + teamnum + "** teams");
            teams.forEach((team, idx) => {
                teamEmbed.addFields({ name: "Team " + (idx + 1), value: team.join("\n") || "--", inline: true });
            });
            await interaction.reply({ embeds: [teamEmbed] });

        } else if (subcommand == "number") {
            const max = interaction.options.getInteger("max");
            const randomnum = Math.floor(Math.random() * max) + 1;
            await interaction.reply({ content: String(randomnum) });
        }
    }
}
