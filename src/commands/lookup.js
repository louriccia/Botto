const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

axios.defaults.baseURL = 'http://localhost:3000/api/v1';
axios.defaults.headers.common['Authorization'] = 'Bearer YOUR_ACCESS_TOKEN';
axios.defaults.headers.post['Content-Type'] = 'application/json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('look up racers, tracks, or other resources')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('lookup resource')
                .setAutocomplete(true)
                .setRequired(true)
        ),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        if ([null, undefined, ""].includes(focusedValue.trim())) return await interaction.respond([])

        const response = await axios.get(`/search?q=${focusedValue}`, {
            headers: { "X-Bot-Token": process.env.BOT_API_KEY }
        });

        console.log(response.data)
        await interaction.respond(response.data.map((choice, i) => ({ name: choice.name, value: `${choice.type}/${choice.id}`, focused: i == 0 })).slice(0, 25));
    },
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const query = interaction.options.getString("resource")
        if (query.startsWith("racer/") || query.startsWith("track/") || query.startsWith("part/")) {
            const input = query.split("/")
            interaction.client.buttons.get("lookup").execute({ client: interaction.client, interaction, args: [input[0], input[1], "initial"] });
        } else if (query == "tier") {
            const tierEmbed = new EmbedBuilder()
            var mu = true
            if (args[0].hasOwnProperty("options")) {
                if (args[0]?.options[0]?.value == "nu") {
                    mu = false
                }
            }
            if (mu) {
                tierEmbed
                    .setTitle("MU Racer Tier List")
                    .addField(":gem: Top", "Ben Quadinaros\nBoles Roor\nMars Guo\nAldar Beedo\nElan Mak\nMawhonic\n'Bullseye' Navior")
                    .addField(":first_place: High", "Clegg Holdfast\nNeva Kee\nRatts Tyerell\nToy Dampner\nArk 'Bumpy' Roose\nBozzie Baranta\nFud Sang")
                    .addField(":second_place: Mid", "Dud Bolt\nOdy Mandrell\nGasgano\nWan Sandage\nAnakin Skywalker")
                    .addField(":third_place: Low", "Slide Paramita\nSebulba\nEbe Endocott\nTeemto Pagalies")
            } else {
                tierEmbed
                    .setTitle("NU Racer Tier List")
                    .addField(":gem: Top", "Boles Roor\nBen Quadinaros\nSebulba")
                    .addField(":first_place: High", "Aldar Beedo\n'Bullseye' Navior\nMars Guo\nRatts Tyerell\nMawhonic")
                    .addField(":second_place: Mid", "Toy Dampner\nClegg Holdfast\nEbe Endocott\nFud Sang\nAnakin Skywalker\nSlide Paramita\nArk 'Bumpy' Roose")
                    .addField(":third_place: Low", "Neva Kee\nDud Bolt\nElan Mak\nBozzie Baranta\nOdy Mandrell\nGasgano\nTeemto Pagalies\nWan Sandage")
            }
            interaction.reply({ embeds: [tierEmbed] })
        } else if (query == "cheats") {
            const cheatEmbed = new EmbedBuilder()
            if (args[0].options[0].value == "PC") {
                cheatEmbed
                    .setTitle("PC Cheats")
                    .addField("1000 Truguts", "Press Left Shift + F4 + 4 at Watto's Shop; repeatable up to 5 times", false)
                    .addField("Cy Yunga", "Press Left Control + C + Y on the racer select screen", false)
                    .addField("Jinn Reeso", "Press Right Control + N + K on the racer select screen", false)
                    .addField("Hangar Taunts", "Press Spacebar (slide) to select 'START RACE'", false)
                    .addField("Unlock All Pods & Tracks", "Press Scroll Lock + Home Key on the racer select screen", false)
                    .addField("Fast Mode", "Press '*' on the Numpad + T in race", false)
                    .addField("Toggle Mirror Mode", "Press Left/Right Control + Left Alt + Right Alt on record screen", false)
                    .addField("Debug Menu", "[Cheat Engine Trainer by Tehelee for accessing the in-game cheats menu](https://www.reddit.com/r/gog/comments/90lrg1/star_wars_episode_1_racer_return_of_the_debug/)", false)
            } else {
                cheatEmbed
                    .setTitle("Console Cheats")
                    .setDescription("To enter cheats, go to the new profile page and hold RT/R2/ZR and enter the codes below using L1/Bumper/L. Once entered, select end and a confirmation should appear.")
                    .addField("Unlock All Cheat Codes", "RRTANGENTABACUS", false)
                    .addField("Unlock Mirror Mode", "RRTHEBEAST", false)
                    .addField("Invincibility", "RRJABBA", false)
                    .addField("Dual Control Mode", "RRDUAL", false)
                    .addField("Unlock Cy Yunga", "RRCYYUN", false)
                    .addField("Unlock Jinn Reeso", "RRJINNRE", false)
                    .addField("6 Pit Droids", "RRPITDROID and press UP, DOWN, LEFT, RIGHT, RIGHT, UP at Watto's shop", false)
                    .addField("Auto Pilot", "Press R + Z to enable/disable auto pilot", false)
                    .addField("Hangar Taunts", "Hold down Z when selecting the start game option in Tournament mode", false)
                    .addField("See Creators", "During the opening cinematic, hold down all the C buttons and press start", false)
                    .addField("Cheats Menu", "RRDEBUG\nInput UP, LEFT, DOWN, RIGHT, UP, LEFT, DOWN, RIGHT on the pause menu", false)
            }
            interaction.reply({ embeds: [cheatEmbed] })
        } else {
            interaction.reply({ content: "I'm sorry, I don't know what that is.", ephemeral: true })
        }
    }

}
