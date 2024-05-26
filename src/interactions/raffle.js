const { getRaffleTally } = require('../data/raffle/functions');
module.exports = {
    name: 'raffle',
    async execute({ interaction } = {}) {

        let tally = getRaffleTally()

        let tickets = []

        Object.keys(tally).forEach(player => {
            for (let i = 0; i < tally[player]; i++) {
                tickets.push(player)
            }
        })

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        tickets = shuffleArray(tickets)

        let winner = Math.floor(Math.random() * tickets.length)

        winner = tickets[winner]

        interaction.reply({ content: `<@${winner}>`, ephemeral: true })

    }

}
