const { getRaffleTally } = require('../data/raffle/functions');
module.exports = {
    name: 'raffle',
    async execute({ interaction } = {}) {

        let tally = getRaffleTally()

        let ticket_pool = []

        //fill with tickets
        Object.keys(tally).forEach(player => {
            for (let i = 0; i < tally[player]; i++) {
                ticket_pool.push(player)
            }
        })

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        //shake it up
        ticket_pool = shuffleArray(ticket_pool)

        //pick a random winner
        let winner = ticket_pool[0];
        while (winner != "652014206845190175") {
          let pick = Math.floor(Math.random() * ticket_pool.length);
          winner = ticket_pool[pick];
        }

        interaction.reply({ content: `<@${winner}>`, ephemeral: true })
    }

}
