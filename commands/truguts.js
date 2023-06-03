const Discord = require('discord.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { initializeUser, initializePlayer, manageTruguts } = require('../buttons/challenge/functions');
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
                .setName('transfer')
                .setDescription("transfer truguts to another user")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('user receiving this amount')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('amount to transfer from your balance')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100000))
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


        function getUserKey(member) {
            let player = null
            Object.keys(userdata).forEach(key => {
                if (userdata[key].discordID && userdata[key].discordID == member) {
                    player = key
                    return
                }
            })
            return player
        }

        let player = getUserKey(member)
        if (!player) {
            player = initializeUser(userref, member, name)
        }
        let profile = userdata[player]?.random
        if (!profile) {
            profile = initializePlayer(userref.child(player).child('random'), name)
        }

        if (interaction.options.getSubcommand() == "balance") {
            const Embed = new EmbedBuilder()
                .setAuthor({ name: name + "'s Trugut Balance", iconURL: avatar })
                .setTitle("📀" + numberWithCommas(profile.truguts_earned - profile.truguts_spent) + " Truguts")
                .setDescription("Total earned: `📀" + numberWithCommas(profile.truguts_earned) + "`\nTotal spent: `📀" + numberWithCommas(profile.truguts_spent) + "`")
            interaction.reply({ embeds: [Embed], ephemeral: true })
        } else if (interaction.options.getSubcommand() == "bet") {
            interaction.client.buttons.get("truguts").execute(interaction.client, interaction, ["bet", "new"], database)
        } else if (interaction.options.getSubcommand() == 'transfer') {
            let amount = interaction.options.getInteger('amount')
            let user = interaction.options.getUser('user')

            if (profile.truguts_earned - profile.truguts_spent < amount) {
                interaction.reply({ content: `Insufficient Truguts: 📀${numberWithCommas(profile.truguts_earned - profile.truguts_spent)}`, ephemeral: true })
                return
            }

            let tuser = getUserKey(user.id)
            if (!tuser) {
                tuser = initializeUser(userref, user.id, user.username)
            }
            let tprofile = userdata[tuser]?.random
            if (!tprofile) {
                tprofile = initializePlayer(userref.child(tuser).child('random'), user.username)
            }

            manageTruguts({ profile: profile, profileref: userref.child(player).child('random'), transaction: 'w', amount: amount, purchase: { date: Date.now(), purchased_item: 'transfer', amount: amount, to: tuser } })
            manageTruguts({ profile: tprofile, profileref: userref.child(tuser).child('random'), transaction: 'd', amount: amount })
            const Embed = new EmbedBuilder()
                .setAuthor({ name: name + " made a transfer", iconURL: avatar })
                .setTitle("📀" + numberWithCommas(amount) + " Truguts")
                .setDescription(`Sent to <@${user.id}>`)
            interaction.reply({ embeds: [Embed] })
        }
    }

}
