const Discord = require('discord.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { manageTruguts } = require('../interactions/challenge/functions');
const { number_with_commas } = require('../generic.js');
const { get_user_key_by_discord_id, initializeUser, initializePlayer } = require('../user.js');
const { trugut_color } = require('../colors.js')

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
                .setName('leaderboard')
                .setDescription("the richest truguteers in the galaxy")
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
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('memo')
                        .setDescription('the reason for this transaction')
                )
        )
    ,
    async execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {

        switch (interaction.options.getSubcommand()) {
            case "balance":
                const BalanceEmbed = new EmbedBuilder()
                    .setAuthor({ name: `${member_name}'s Truguts`, iconURL: member_avatar })
                    .setColor(trugut_color)
                    .setDescription(`\`📀${number_with_commas(user_profile.truguts_earned - user_profile.truguts_spent)}\``)
                interaction.reply({ embeds: [BalanceEmbed], ephemeral: true })
                break

            case "transfer":
                let amount = interaction.options.getInteger('amount')
                let receiving_user = interaction.options.getUser('user')
                let memo = interaction.options.getString('memo')

                if (user_profile.truguts_earned - user_profile.truguts_spent < amount) {
                    interaction.reply({ content: `Insufficient Truguts: 📀${number_with_commas(user_profile.truguts_earned - user_profile.truguts_spent)}`, ephemeral: true })
                    return
                }

                let tuser = get_user_key_by_discord_id(db, receiving_user.id)
                if (!tuser) {
                    tuser = initializeUser(database.ref('users'), receiving_user.id, receiving_user.username)
                }
                let tprofile = db.user[tuser]?.random
                if (!tprofile) {
                    tprofile = initializePlayer(database.ref(`user/${tuser}/random`), receiving_user.username)
                }

                manageTruguts({ user_profile: user_profile, profile_ref: database.ref(`user/${user_key}/random`), transaction: 'w', amount: amount, purchase: { date: Date.now(), purchased_item: 'transfer', amount: amount, to: tuser, memo: memo ?? "" } })
                manageTruguts({ user_profile: tprofile, profile_ref: database.ref(`user/${tuser}/random`), transaction: 'd', amount: amount })
                const Embed = new EmbedBuilder()
                    .setColor(trugut_color)
                    .setDescription(`<@${member_id}> sent \`📀${number_with_commas(amount)}\` truguts to <@${receiving_user.id}>${memo ? ` *${memo}*` : ''}`)
                interaction.reply({ embeds: [Embed] })
                break

            case "leaderboard":

                let truguteers = Object.values(db.user)
                    .filter(user =>
                        !['545799665862311971', '256236315144749059', null, undefined].includes(user.discordID) &&
                        user.random?.truguts_earned &&
                        user.random.truguts_earned - user.random.truguts_spent > 0
                    )
                    .map(user => ({ id: user.discordID, truguts: (user.random.truguts_earned - user.random.truguts_spent) }))
                    .sort((a, b) => (b.truguts - a.truguts))
                    .slice(0, 10)

                const LeaderboardEmbed = new EmbedBuilder()
                    .setTitle("Truguts Leaderboard")
                    .setFooter({ text: "Top Ten Truguteers" })
                    .setDescription("Where is everybody?")
                    .setColor(trugut_color)

                if (truguteers.length) {
                    LeaderboardEmbed.setDescription(
                        truguteers.map(user => (
                            `\`📀${number_with_commas(user.truguts)}\` <@${user.id}>`
                        )).join("\n")
                    )
                }

                interaction.reply({ embeds: [LeaderboardEmbed] })
                break
        }
    }

}
