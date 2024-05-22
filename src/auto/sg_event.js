const rp = require('request-promise');
const cheerio = require('cheerio').default;
const url = 'http://speedgaming.org/swe1racer/';
const { betEmbed, betComponents } = require('../interactions/trugut_functions.js');
const { get_user_key_by_sg_name, get_user_name_by_discord_id } = require('../user.js');
const { swe1r_guild } = require('../data/discord/guild.js');
const { streams_channel, tournaments_channel, tournament_live_channel } = require('../data/discord/channel.js');

function matchDesc(match) {
    return (match.commentators && Object.keys(match.commentators).length > 0 ? "🎙️ " + Object.keys(match.commentators).map(id => db.user[id].name).join(", ") : "Sign up for commentary: https://speedgaming.org/swe1racer/crew/") +
        (match.tourney ? `\n${db.ty.tournaments[match.tourney]?.name ?? ""}` : "") +
        (!match.url ? "\n(Channel to be determined)" : "")
}

function matchTitle(match) {
    let round = db.ty.tournaments[match.tourney]?.stages[match.bracket] ?? null
    return (round ? `${round.bracket} ${round.round}: ` : '') + (match.players ? Object.keys(match.players).map(id => db.user[id].name).join(" vs ") : 'Unknown Players')
}

exports.scrape_sg_events = async function (client, db, database) {

    const Guild = await client.guilds.cache.get(swe1r_guild)

    rp(url)
        .then(function (html) {
            let table = cheerio('tbody', html)
            let guildevents = Guild.scheduledEvents.cache
            let events = guildevents.toJSON()
            let values = []
            Object.keys(db.ty.scheduled).forEach(key => {
                database.ref('tourney/scheduled').child(key).update({ current: false })
            })
            cheerio('tr', table).each((i, elem) => { //for each row
                let match = { commentators: {}, players: {} }
                cheerio('td', elem).each((j, cell) => { //for each cell, populate match
                    let content = cheerio(cell).text().trim().replace(/\t/g, "").replace(/\n/g, "")
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
                            match.datetime = Date.parse(content.replace(", ", " " + new Date().getFullYear() + " ").replace(" ", " ") + " EDT")
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
                                    name: matchTitle(match),
                                    description: matchDesc(match),
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
                        name: matchTitle(match),
                        scheduledStartTime: match.datetime,
                        scheduledEndTime: match.datetime + 1000 * 60 * 60,
                        entityType: 3,
                        description: matchDesc(match),
                        entityMetadata: { location: (match.url == "" ? "https://twitch.tv/SpeedGaming" : match.url) },
                        privacyLevel: 2
                    })
                }
            })

            Object.keys(db.ty.scheduled).forEach(async key => {
                let match = db.ty.scheduled[key]

                //truguts
                if (match.current && !match.bet && match.datetime <= Date.now() + 1000 * 60 * 60 * 48 && Date.now() <= match.datetime + 1000 * 60 * 10 && Object.values(match.players).length == 2) {
                    //post bet
                    let players = Object.keys(match.players)
                    let bet = {
                        author: {
                            name: 'Botto',
                            avatar: 'https://cdn.discordapp.com/avatars/545798436105224203/5e4668356877db6367e4f51017124aaa.webp',
                            id: '',
                            discordId: '545798436105224203'
                        },
                        title: matchTitle(match),
                        status: "open",
                        type: 'tourney',
                        close: match.datetime,
                        outcome_a: {
                            title: `${db.user[players[0]].name} Wins`,
                            id: match.players[players[0]]
                        },
                        outcome_b: {
                            title: `${db.user[players[1]].name} Wins`,
                            id: match.players[players[1]]
                        },
                        min: 10,
                        max: 0
                    }
                    const betMessage = await postMessage(client, '536455290091077652', { embeds: [betEmbed(bet)], components: betComponents(bet), fetchReply: true })
                    database.ref('tourney/bets').child(betMessage.id).set(bet)
                    database.ref('tourney/scheduled').child(key).child("bet").set(betMessage.id)
                }

                //close bets
                if (match.datetime < Date.now() && match.bet && db.ty.bets[match.bet]?.status == 'open') {
                    database.ref(`tourney/bets/${match.bet}/status`).set('closed')
                    editMessage(client, '536455290091077652', match.bet, { embeds: [betEmbed(db.ty.bets[match.bet])], components: betComponents(db.ty.bets[match.bet]) })
                }

                // match setup 
                if (match.current && match.notification == false && match.datetime <= Date.now() + 1000 * 60 * 30 && Date.now() <= match.datetime + 1000 * 60 * 10) {
                    database.ref(`tourney/scheduled/${key}/notification`).set(true)
                    //add roles
                    let everybody = Object.values(match.players).concat(Object.values(match.commentators))
                    everybody.forEach(async function (player) {
                        const thismember = await Guild.members.fetch(player)
                        thismember.roles.add('970995237952569404').catch(error => console.log(error))
                    })
                    //setup match
                    let newmatch = {
                        status: "setup",
                        tourney: "",
                        bracket: "",
                        ruleset: "",
                        datetime: match.datetime,
                        players: match.players,
                        commentators: match.commentators,
                        stream: match.url,
                        firstvote: ""
                    }
                    database.ref(`tourney/live/${tournament_live_channel}`).set({ ...match, current_race: 0, bracket: "", status: 'setup', firstvote: "", tourney: "", ruleset: "", stream: match.url })

                    postMessage(
                        client,
                        streams_channel,
                        `<@&841059665474617353>\n**${Object.values(match.players).map(p => get_user_name_by_discord_id(p)).join(" vs. ")
                        }**\n:microphone2: ${Object.values(match.commentators).map(comm => get_user_name_by_discord_id(comm)).join(", ")
                        }\n ${match.url}`
                    )

                    postMessage(
                        client,
                        tournaments_channel,
                        `<@&841059665474617353>\n**${Object.values(match.players).map(p => get_user_name_by_discord_id(p)).join(" vs. ")
                        }**\n:microphone2: ${Object.values(match.commentators).map(comm => get_user_name_by_discord_id(comm)).join(", ")
                        }\n ${match.url}`
                    )

                    postMessage(client, tournament_live_channel, {
                        content: Object.values(newmatch.commentators).map(player => "<@" + player + ">").join(" ") + " " +
                            Object.values(newmatch.players).map(player => "<@" + player + ">").join(" ") + "\n**" +
                            Object.values(match.players).map(player => get_user_name_by_discord_id(player)).join(" vs. ") + "** is about to begin!",
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: "Set Up Match",
                                        style: 1,
                                        custom_id: "tourney_play_setup",
                                    }
                                ]
                            }
                        ]
                    })
                }
            })
        })

}
