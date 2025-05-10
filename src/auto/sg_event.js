const rp = require('request-promise');
const cheerio = require('cheerio');
const url = 'http://speedgaming.org/swe1racer/';
const { betEmbed, betComponents } = require('../interactions/trugut_functions.js');
const { get_user_key_by_sg_name } = require('../user.js');
const { swe1r_guild } = require('../data/discord/guild.js');
const { postMessage, editMessage } = require('../discord.js');


function matchDesc(match, db) {
    return (match.commentators && Object.keys(match.commentators).length > 0 ? "🎙️ " + Object.keys(match.commentators).map(id => db.user[id].name).join(", ") : "Sign up for commentary: https://speedgaming.org/swe1racer/crew/") +
        (match.tourney ? `\n${db.ty.tournaments[match.tourney]?.name ?? ""}` : "") +
        (!match.url ? "\n(Channel to be determined)" : "")
}

function matchTitle(match, db) {
    let round = db.ty.tournaments[match.tourney]?.stages[match.bracket] ?? null
    return (round ? `${round.bracket} ${round.round}: ` : '') + (match.players ? Object.keys(match.players).map(id => db.user[id].name).join(" vs ") : 'Unknown Players')
}

function isDaylightSavingActive() {
    const now = new Date();
    const januaryOffset = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
    const julyOffset = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();

    // DST is active if the current offset is different from the non-DST offset
    return now.getTimezoneOffset() !== Math.max(januaryOffset, julyOffset);
}


exports.scrape_sg_events = async function (client, db, database) {

    const Guild = await client.guilds.cache.get(swe1r_guild)

    const $ = await cheerio.fromURL(url)

    rp(url)
        .then(function (html) {
            let table = $('tbody', html)
            let guildevents = Guild.scheduledEvents.cache
            let events = guildevents.toJSON()
            let values = []
            Object.keys(db.ty.scheduled).forEach(key => {
                database.ref(`tourney/scheduled/${key}`).update({ current: false })
            })
            $('tr', table).each((i, elem) => { //for each row
                let match = { commentators: {}, players: {} }
                $('td', elem).each((j, cell) => { //for each cell, populate match
                    let content = $(cell).text().trim().replace(/\t/g, "").replace(/\n/g, "")
                    if (i == 0) {
                        values.push(content.replace(/ /g, "").toLowerCase().replace("(edt)", ""))
                    } else {
                        if (values[j].includes("channel")) {
                            if (content !== "?") {
                                match.url = "https://www.twitch.tv/" + content
                            } else {
                                match.url = ""
                            }
                        } else if (values[j].includes("comm")) {
                            let split = content.split(/[^A-Za-z0-9_ ]+/g)
                            split.map(comm => get_user_key_by_sg_name(comm, db)).filter(c => ![null, undefined, ''].includes(c)).forEach(c => {
                                match.commentators[c] = db.user[c].discordID ?? ''
                            })
                        } else if (values[j].includes("date")) {
                            match.datetime = Date.parse(content.replace(", ", " " + new Date().getFullYear() + " ").replace(" ", " ") + (isDaylightSavingActive() ? " EDT" : " EST"))
                        } else if (values[j].includes("players")) {
                            let split = content.split(/[^A-Za-z0-9_ ]+/g).map(f => f.split(" vs ")).flat()
                            split.map(play => get_user_key_by_sg_name(play, db)).filter(p => ![null, undefined, ''].includes(p)).forEach(p => {
                                match.players[p] = db.user[p].discordID ?? ''
                            })
                        } else {
                            match[values[j]] = content
                        }
                    }
                })
                if (i !== 0) {
                    let dup = false
                    if (db.ty.scheduled) {
                        Object.keys(db.ty.scheduled).forEach(key => {
                            if (db.ty.scheduled[key].datetime == match.datetime) {
                                match.current = true
                                database.ref('tourney/scheduled').child(key).update(match)
                                dup = true
                            }
                        })
                    }
                    if (!dup) {
                        match.notification = false
                        match.current = true
                        console.log(match)
                        database.ref('tourney/scheduled').push(match)
                    }
                }
            })

            Object.keys(db.ty.scheduled).map(key => {
                let match = db.ty.scheduled[key]

                let eventdup = false
                events.forEach(event => {

                    if (event.scheduledStartTimestamp == match.datetime) {
                        eventdup = true
                        database.ref('tourney/scheduled').child(key).update({ event: event.id })
                        if (event.status == 1) {
                            try {
                                Guild.scheduledEvents.fetch(event.id).then(event => event.edit({
                                    name: matchTitle(match, db),
                                    description: matchDesc(match, db),
                                    entityType: 3,
                                    entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) }
                                }))
                            } catch {
                                console.log("failed to edit scheduled event")
                            }
                        }
                    }
                })
                if (!eventdup && match.current && match.datetime > Date.now()) {
                    Guild.scheduledEvents.create({
                        name: matchTitle(match, db),
                        scheduledStartTime: match.datetime,
                        scheduledEndTime: match.datetime + 1000 * 60 * 60,
                        entityType: 3,
                        description: matchDesc(match, db),
                        entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) },
                        privacyLevel: 2
                    })
                }
            })

            Object.keys(db.ty.scheduled).forEach(async key => {
                let match = db.ty.scheduled[key]

                //truguts
                if (match.current && !match.bet && match.datetime <= Date.now() + 1000 * 60 * 60 * 48 && Date.now() <= match.datetime + 1000 * 60 * 10 && match.players && Object.values(match.players).length == 2) {
                    //post bet
                    let players = Object.keys(match.players)
                    let bet = {
                        author: {
                            name: 'Botto',
                            avatar: 'https://cdn.discordapp.com/avatars/545798436105224203/5e4668356877db6367e4f51017124aaa.webp',
                            id: '',
                            discordId: '545798436105224203'
                        },
                        title: matchTitle(match, db),
                        status: "open",
                        type: 'tourney',
                        close: match.datetime,
                        outcomes: [
                            {
                                title: `${db.user[players[0]].name} Wins`,
                                type: 'this_or_that',
                                id: match.players[players[0]]
                            }, {
                                title: `${db.user[players[1]].name} Wins`,
                                type: 'this_or_that',
                                id: match.players[players[1]]
                            },
                            {
                                title: `How many races?`,
                                type: 'number'
                            }],
                        min: 10,
                        max: 0
                    }
                    const betMessage = await postMessage(client, '536455290091077652', { embeds: [betEmbed(bet)], components: betComponents(bet), fetchReply: true })
                    betMessage.pin()
                    database.ref('tourney/bets').child(betMessage.id).set(bet)
                    database.ref('tourney/scheduled').child(key).child("bet").set(betMessage.id)
                }

                //close bets
                if (match.datetime < Date.now() && match.bet && db.ty.bets[match.bet]?.status == 'open') {
                    database.ref(`tourney/bets/${match.bet}/status`).set('closed')
                    editMessage(client, '536455290091077652', match.bet, { embeds: [betEmbed(db.ty.bets[match.bet])], components: betComponents(db.ty.bets[match.bet]) })
                }

                // match setup 

            })
        })

}
