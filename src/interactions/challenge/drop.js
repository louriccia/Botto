const { WhyNobodyBuy } = require('../../data/discord/emoji.js');
const { number_with_commas } = require('../../generic.js');
const { manageTruguts } = require('./functions.js');

exports.drop = async function ({ interaction, user_profile, profile_ref, args, db, database, member_id } = {}) {

    //already claimed
    let already_claimed = db.ch.drops ? Object.values(db.ch.drops).find(drop => drop.message == interaction.message.id) : false
    if (already_claimed) {
        interaction.reply(
            {
                content: `${WhyNobodyBuy} Too slow! This drop was claimed by <@${already_claimed.member}>`,
                ephemeral: true
            }
        )
        return
    }

    if (args[2] == 'ticket') {
        interaction.update({ components: [], content: `*${discord_name} snagged a :tickets: raffle ticket!*` })
        database.ref(`challenge/drops`).push({
            member: member_id,
            message: interaction.message.id,
            date: Date.now(),
            drop: 'ticket'
        })
        return
    }

    const DROP = Number(args[2])
    await database.ref(`challenge/drops`).push({
        member: member_id,
        message: interaction.message.id,
        date: Date.now(),
        drop: DROP
    })
    let p = manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: DROP })

    interaction.reply(
        {
            components: [],
            content: `You snagged a \`📀${number_with_commas(DROP)}\` drop\nCurrent truguts: \`📀${number_with_commas(p.truguts_earned - p.truguts_spent)}\``,
            ephemeral: true
        })

    interaction.client.channels.fetch(interaction.channelId).then(channel => {
        channel.messages.fetch(interaction.message.id).then((ffetch => {
            ffetch.delete()
        })).catch((err) => {
            console.log(err)
        })
    })


}