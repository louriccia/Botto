const { achievementEmbed } = require('./challenge/functions.js');
const { postMessage } = require('../discord.js');

const { EmbedBuilder } = require('discord.js');

const { WhyNobodyBuy } = require('../data/discord/emoji.js');
const { achievement_data } = require('../data/challenge/achievement.js');
const { swe1r_guild } = require('../data/discord/guild.js')

module.exports = {
    name: 'challenge',
    async execute({ client, interaction, args, database, db, member_id, member_avatar, user_key } = {}) {
        const Guild = interaction.guild
        const Member = await Guild.members.fetch(member_id)

        const user_profile = db.user[user_key].random
        const botto_name = user_profile.name
        const profile_ref = database.ref(`users/${user_key}/random`)
        let current_challenge = null
        let current_challenge_ref = null

        //find relevant challenge
        if (!interaction.isChatInputCommand() && args[1] !== 'play') {
            current_challenge_ref = database.ref(`challenge/challenges/${interaction.message.id}`)
            current_challenge = db.ch.challenges[interaction.message.id]
        }

        if (!current_challenge && ["submit", "modal", "like", "dislike", "reroll", "bribe", "predict", "undo"].includes(args[1])) {
            const holdUp = new EmbedBuilder()
                .setTitle(`${WhyNobodyBuy} If a challenge is not in our records, then it doesn't exist.`)
                .setDescription(" There was an error when retrieving this challenge. It may be a duplicate or a failed post.")
            interaction.reply({ embeds: [holdUp], ephemeral: true })
            return
        }

        if (user_profile.truguts_spent + user_profile.truguts_earned >= achievement_data.big_time_swindler.limit && current_challenge) { //award big-time swindler achievement
            if (current_challenge.guild == swe1r_guild) {
                if (!Member.roles.cache.some(r => r.id === achievement_data.big_time_swindler.role)) { //award role
                    Member.roles.add(achievement_data.big_time_swindler.role).catch(error => console.log(error))
                }
            }
            if (!user_profile.achievements?.big_time_swindler) {
                postMessage(client, current_challenge.channel, { embeds: [achievementEmbed(botto_name, member_avatar, achievement_data.big_time_swindler, current_challenge.guild)] })
                profile_ref.child('achievements').child("big_time_swindler").set(true)
                user_profile = db.user[player]?.random
            }
        }

        if (args[0] == "random") {
            let command = args[1]
            if (['like', 'dislike'].includes(command)) {
                command = 'feedback'
            }
            const challenge_command = require(`./challenge/${command}.js`)
            challenge_command[command]({ current_challenge, current_challenge_ref, interaction, args, db, database, member_id, member_avatar, user_key, user_profile, profile_ref, botto_name })
        }
    }
}