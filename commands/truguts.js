const Discord = require('discord.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { initializeUser, initializePlayer } = require('../buttons/challenge/functions');
const { numberWithCommas } = require('../tools.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('truguts')
        .setDescription('republic credits are no good')
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription("view your current trugut balance")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bet')
                .setDescription("create a new bet")
                .addStringOption(option =>
                    option.setName('bet_title')
                        .setDescription('The name of the bet')
                        .setRequired(true)
                        .setMaxLength(50))
                .addStringOption(option =>
                    option.setName('outcome_a')
                        .setDescription('The first outcome')
                        .setRequired(true)
                        .setMaxLength(50))

                .addStringOption(option =>
                    option.setName('outcome_b')
                        .setDescription('The second outcome')
                        .setRequired(true)
                        .setMaxLength(50))
                .addIntegerOption(option =>
                    option.setName('min_bet')
                        .setDescription('The minimum bet allowed'))
                .addIntegerOption(option =>
                    option.setName('max_bet')
                        .setDescription('The maximum bet allowed'))
        ),
    async execute(interaction, database) {

        const member = interaction.member.id
        const name = interaction.member.displayName
        const avatar = await interaction.member.displayAvatarURL()
        let userref = database.ref('users');
        let userdata = {}
        userref.on("value", function (snapshot) {
            userdata = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        //find player in userbase
        let player = null
        Object.keys(userdata).forEach(key => {
            if (userdata[key].discordID && userdata[key].discordID == member) {
                player = key
                return
            }
        })
        //initialize player if they don't exist
        let profile = userdata[player]?.random
        if (!profile) {
            profile = initializePlayer(userref.child(player).child('random'), name)
        }
        if (!player) {
            player = initializeUser(userref, member, name)
        }
        if (interaction.options.getSubcommand() == "balance") {
            const Embed = new EmbedBuilder()
                .setAuthor({ name: name + "'s Trugut Balance", iconURL: avatar })
                .setTitle("📀" + numberWithCommas(profile.truguts_earned - profile.truguts_spent) + " Truguts")
                .setDescription("Total earned: `📀" + numberWithCommas(profile.truguts_earned) + "`\nTotal spent: `📀" + numberWithCommas(profile.truguts_spent) + "`")
            interaction.reply({ embeds: [Embed], ephemeral: true })
        } else if (interaction.options.getSubcommand() == "bet") {
            interaction.client.buttons.get("truguts").execute(interaction.client, interaction, ["bet", "new"], database)
        }
    }

}
