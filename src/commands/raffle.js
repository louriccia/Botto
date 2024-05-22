const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raffle')
        .setDescription('raffle ticket leaderboard'),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const myEmbed = new EmbedBuilder

        let tally = {}

        function addTicket(user) {
            if (!tally[user]) {
                tally[user] = 0
            }
            tally[user]++
        }

        if (!db.ch) {
            return
        }


        //get challenge points
        let challenge_map = {}
        Object.values(db.ch.times).filter(time => moment(time.date).month() == 4 && moment(time.date).year() == 2024).forEach(time => {
            let user = time.user
            let day = moment(time.date).date()
            if (!challenge_map[user]) {
                challenge_map[user] = []
            }
            if (!challenge_map[user].includes(day)) {
                challenge_map[user].push(day)
                addTicket(user)
            }
        })


        //get scavenger
        Object.keys(db.ch.scavenger).forEach(player => {
            for (let i = 0; i < 25; i++) {
                if (db.ch.scavenger[player]?.[i]?.solved) {
                    addTicket(player)
                }
            }
        })

        //get trivia
        

        //get drops
        Object.values(db.ch.drops).filter(drop => drop.drop == 'ticket').forEach(drop => {
            addTicket(drop.member)
        })

        delete tally['256236315144749059']

        let total = Object.values(tally).reduce((a, b) => a + b)

        myEmbed
            .setTitle("<a:chance_cube:1235055236138270760> Raffle Leaderboard")
            .setColor("Blurple")
            .setDescription(Object.keys(tally).sort((a,b) => tally[b] - tally[a]).map(user => (`<@${user}> **${tally[user]}** (${((tally[user]/total)*100).toFixed(0)}%)`)).join("\n"))
            .setFooter({text: `${total} tickets awarded`})
        interaction.reply({ embeds: [myEmbed] })
    }

}
