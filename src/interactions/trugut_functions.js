const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ActionRow } = require('discord.js');
const { number_with_commas, big_number, truncateString, capitalize } = require('../generic.js');
const { blurple_color } = require('../colors.js');

exports.betEmbed = function (bet) {
    const Embed = new EmbedBuilder()
        .setTitle(bet.title + (['closed', 'complete'].includes(bet.status) ? ` (${capitalize(bet.status)})` : ''))
        .setColor(blurple_color)
        .setDescription(`\`📀${number_with_commas(bet.min)}\` - ${bet.max ? `\`📀${number_with_commas(bet.max)}\`` : 'unlimited'}`)
        .setAuthor({ name: bet.type == 'tourney' ? 'Tournament Wager' : bet.author.name + "'s Bet", iconURL: bet.type == 'tourney' ? 'https://em-content.zobj.net/thumbs/120/twitter/322/crossed-swords_2694-fe0f.png' : bet.author.avatar })
    bet.outcomes.forEach(outcome => {

        let bet_summary = " "

        if (outcome.bets) {
            Object.values(outcome.bets).sort((a, b) => b.amount - a.amount).forEach(b => {
                let winner = outcome.paid && (outcome.winner === false || (outcome.type == 'number' && b.guess != outcome.winner)) ? "~~" : ""
                bet_summary += `<@${b.discordId}>${b.guess ? ` **${b.guess}**` : ''} ${winner}\`📀${big_number(b.amount) + (b.take ? " +" + big_number(b.take) : "")}\`${winner}` + (b.note ? `\n *└ ${b.note}*` : '') + '\n'
            })



            bet_summary += `\n\nTotal: \`📀${big_number(Object.values(outcome.bets).map(b => b.amount).reduce((a, b) => a + b))}\``
        }


        Embed.addFields(
            {
                name: (outcome.winner ? ":white_check_mark: " : "") + outcome.title + (outcome.type == 'number' && outcome.winner ? `: ${outcome.winner}` : ''),
                value: bet_summary,
                inline: outcome.type == 'this_or_that'
            })
    })
    return Embed
}

exports.betComponents = function (bet) {
    let rows = []
    let components = [
        ...bet.outcomes.map((o, i) => ({ ...o, index: i })).filter(o => bet.status == 'open' || !o.paid).map(outcome => (
            new ButtonBuilder()
                .setCustomId(`truguts_bet_${outcome.index}` + (outcome.type == 'number' ? '_number' : ''))
                .setLabel(truncateString((bet.status == 'closed' ? 'Set outcome: ' : '') + outcome.title, 38))
                .setStyle(ButtonStyle.Primary)
        ))
    ]


    if (bet.status == 'open') {
        components.push(new ButtonBuilder()
            .setCustomId("truguts_bet_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Secondary))

    } else if (bet.status == 'closed') {
        components.push(
            new ButtonBuilder()
                .setCustomId("truguts_bet_open")
                .setLabel("Reopen")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("truguts_bet_delete")
                .setLabel("Delete")
                .setStyle(ButtonStyle.Danger)
        )
    }

    if (!components.length) {
        return rows
    }

    const row1 = new ActionRowBuilder()
        .addComponents(components.slice(0, 5))
    rows.push(row1)
    if (components.length > 5) {
        rows.push(new ActionRowBuilder().addComponents(components.slice(5, 10)))
    }

    return rows
}