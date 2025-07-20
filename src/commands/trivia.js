const { SlashCommandBuilder, EmbedBuilder, Poll, ActionRowBuilder, ButtonBuilder, ButtonStyle, Embed } = require('discord.js');
const { questions } = require('../data/trivia.js')
const { racers } = require('../data/sw_racer/racer.js')
const { tracks } = require('../data/sw_racer/track.js')
const { planets } = require('../data/sw_racer/planet.js');
const { editMessage } = require('../discord.js');
const { blurple_color } = require('../colors.js');
const { manageTruguts } = require('../interactions/challenge/functions.js');
const { big_number } = require('../generic.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('answer podracing-themed trivia questions'),
    async execute({ interaction, database, db } = {}) {

        //map questions to include their indices
        let question_map = questions

        //filter out recently used ones
        if (db.ch.trivia) {
            let last_25 = Object.values(db.ch.trivia).sort((a, b) => b.date - a.date).map(q => q.id).slice(0, 75)
            question_map = question_map.filter(q => (!last_25.includes(q.id)))
        }

        //get random question
        let random_question_index = Math.floor(Math.random() * question_map.length)
        let random_question = question_map[random_question_index]

        //mix up answers
        let answers = random_question.answers
        let correct_answer = random_question.answers[0]
        answers = answers.sort((a, b) => a.localeCompare(b))
        answers = answers.sort((a, b) => a - b)

        let poll = {
            question: { text: random_question.question },
            answers: answers.map(
                answer => {
                    let a = { text: answer.substring(0, 55) }

                    if (random_question.hide_emoji) {
                        return (a)
                    }

                    let flag = racers.find(racer => racer.name == answer)
                    if (flag) {
                        return (
                            { ...a, emoji: { id: flag.flag.split(":")[2].replace(">", "") } }
                        )
                    }
                    flag = tracks.find(track => track.name == answer)
                    if (flag) {
                        return (
                            { ...a, emoji: { id: planets[flag.planet].emoji.split(":")[2].replace(">", "") } }
                        )
                    }
                    flag = planets.find(planet => planet.name == answer)
                    if (flag) {
                        a.emoji = { id: flag.emoji.split(":")[2].replace(">", "") }
                    }
                    return (a)
                }

            ),
            allowMultiselect: false,
            layoutType: 1,
        }

        const bet_limit = 45000
        const time_limit = 60000

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Bet")
                .setCustomId(`trivia_bet`)
                .setStyle(ButtonStyle.Primary)
        )

        const triviaBetEmbed = new EmbedBuilder()
            .setTitle("Place Your Bets!")
            .setDescription(`expires <t:${Math.floor((Date.now() + bet_limit) / 1000)}:R>`)
            .setColor(blurple_color)

        const betResponse = await interaction.reply({ embeds: [triviaBetEmbed], components: [row1], withResponse: true })
        const betMessage = betResponse.resource.message

        let question_data = {
            bets_open: true,
            bet_message: betMessage.id,
            id: random_question.id,
            date: Date.now()
        }

        const question_push = await database.ref('challenge/trivia').push(question_data)
        const question_ref = database.ref(`challenge/trivia/${question_push.key}`)





        setTimeout(async function () {
            question_ref.update({ bets_open: false })
            editMessage(interaction.client, betMessage.channelId, betMessage.id, { content: "Bets closed!", components: [] })

            const poll_reply = await interaction.followUp({ content: `${random_question.category}\nexpires <t:${Math.floor((Date.now() + time_limit) / 1000)}:R>`, poll, withResponse: true })
            const poll_message = poll_message.resource.message
            const poll_object = poll_message.poll
            setTimeout(async function () {

                poll_object.end().then(async () => {
                    let responded = false
                    const channel = await interaction.client.channels.fetch(poll_message.channelId);
                    const fetchedMessage = await channel.messages.fetch(poll_message.id);

                    //update use date


                    let responses = {}

                    await fetchedMessage.poll.answers.forEach(async answer => {
                        responded = true
                        const voters = await answer.fetchVoters()
                        voters.forEach(async voter => {
                            let response_data = {
                                member: voter.id,
                                date: Date.now(),
                                correct: answer.text == correct_answer
                            }
                            await database.ref(`challenge/trivia/${question_push.key}/responses/${voter.id}`).set(
                                response_data
                            )
                            responses[voter.id] = response_data
                        })
                    })



                    setTimeout(async function () {
                        //handle bets
                        let bet_results = []
                        let bet_data = db.ch.trivia[question_push.key].bets
                        if (bet_data) {
                            Object.values(bet_data).forEach(bet => {
                                let better_vote = responses[bet.better]
                                let profile_key = Object.keys(db.user).find(key => db.user[key].discordID == bet.better)
                                let profile = db.user[profile_key]?.random

                                if (profile) {
                                    manageTruguts({ user_profile: profile, profile_ref: database.ref(`users/${profile_key}/random`), transaction: better_vote?.correct ? "d" : "w", amount: bet.amount })
                                    bet_results.push(`<@${bet.better}> \`${better_vote?.correct ? "+" : "-"}📀${big_number(bet.amount)}\``)
                                }

                            })
                        }

                        //show bet results
                        if (bet_results.length) {
                            const betResults = new EmbedBuilder()
                                .setColor(blurple_color)
                                .setTitle("Bet Results")
                                .setDescription(bet_results.join("\n"))
                            interaction.followUp({ embeds: [betResults] })
                        }
                        if (responded) {
                            await poll_message.edit({
                                content:
                                    `The correct answer was:\n*${correct_answer}*`
                            })
                        }
                    }, 500)
                })
            }, time_limit)
        }, bet_limit)

    }
}
