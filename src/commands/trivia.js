const { SlashCommandBuilder, EmbedBuilder, Poll } = require('discord.js');
const { questions } = require('../data/trivia.js')
const { racers } = require('../data/sw_racer/racer.js')
const { tracks } = require('../data/sw_racer/track.js')
const { planets } = require('../data/sw_racer/planet.js')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('answer podracing-themed trivia questions'),
    async execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {

        //map questions to include their indices
        let question_map = questions.map((question, index) => ({ ...question, id: index }))

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

        const time_limit = 90000

        const poll_message = await interaction.reply({ content: `${random_question.category}\nexpires <t:${Math.floor((Date.now() + time_limit) / 1000)}:R>`, poll, fetchReply: true })

        const poll_object = poll_message.poll

        setTimeout(async function () {

            poll_object.end().then(async () => {
                let responded = false
                const channel = await interaction.client.channels.fetch(poll_message.channelId);
                const fetchedMessage = await channel.messages.fetch(poll_message.id);

                //update use date
                database.ref('challenge/trivia').child(random_question_index).update({ last_used: Date.now() })

                fetchedMessage.poll.answers.forEach(async answer => {
                    if (answer.text == correct_answer) {
                        const voters = await answer.fetchVoters()
                        voters.forEach(voter => {
                            responded = true
                            if (!db.ch.trivia?.[random_question_index]?.correct?.[voter.id]) {
                                database.ref('challenge/trivia').child(random_question_index).child('correct').child(voter.id).set(Date.now())
                            }
                        })
                    }
                })
                setTimeout(async function () {
                    if (responded) {
                        await poll_message.edit({ content: `The correct answer was:\n*${correct_answer}*` })
                    }
                }, 500)
            })
        }, time_limit)

    }
}
