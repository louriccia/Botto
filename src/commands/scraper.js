const { SlashCommandBuilder } = require('discord.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('scrape'),
    async execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const fetch = require('node-fetch');
        let speedruns = database.ref('speedruns');
        let users = database.ref('users');

        Promise.all([
            speedruns.once("value"),
            users.once("value")
        ]).then(async ([speedrunSnapshot, usersSnapshot]) => {
            let speedruns_data = speedrunSnapshot.val() || {};
            let users_data = usersSnapshot.val() || {};

            client.guilds.fetch("441839750555369474").then(guild => {
                try {
                    guild.members.fetch({ force: true }).then(members => {
                        Object.keys(users_data).forEach(async function (key) {
                            let user = users_data[key]
                            if (user.discordID && guild.members.cache.some(m => m == user.discordID)) {
                                guild.members.fetch({ user: user.discordID, force: true }).then(member => {
                                    users.child(key).child('avatar').set(member.displayAvatarURL())
                                    users.child(key).child('discord').update({
                                        displayName: member.displayName,
                                        joinedTimestamp: member.joinedTimestamp,
                                        nickname: member.nickname,
                                        tag: member.user.tag
                                    })
                                })
                            }
                        })
                    })
                } catch (e) {
                    console.log(e)
                }
            })

            let runmap = {}

            console.log(Object.values(speedruns_data).length)
            Object.keys(speedruns_data).forEach(key => {
                let run = speedruns_data[key]
                if (run.src?.id) {
                    runmap[run.src.id] = key
                } else if (run?.records?.src) {
                    runmap[run.records.src.replace("https://www.speedrun.com/swe1r/run/", "")] = key
                }
            })

            let usermap = {}
            console.log(Object.values(users_data).length)
            Object.keys(users_data).forEach(key => {
                let user = users_data[key]
                if (user?.src?.id) {
                    usermap[user.src.id] = key
                } else if (user?.src?.user) {
                    usermap[user.src.user.replace("https://www.speedrun.com/user/", "")] = key
                } else if (user?.src?.name) {
                    usermap[user.src.name] = key
                }
            })


            //src scraper
            const platforms = { "8gej2n93": "PC", "w89rwelk": "N64", "v06d394z": "DC", "7m6ylw9p": "Switch", "nzelkr6q": "PlayStation", "o7e2mx6w": "Xbox" }
            const game = {
                variables: 'https://www.speedrun.com/api/v1/games/m1mmex12/variables',
                categories: 'https://www.speedrun.com/api/v1/games/m1mmex12/categories',
                runs: 'https://www.speedrun.com/api/v1/runs?game=m1mmex12&embed=players&max=200',
                levels: 'https://www.speedrun.com/api/v1/games/m1mmex12/levels'
            }
            const extension = {
                variables: 'https://www.speedrun.com/api/v1/games/m1mnnrxd/variables',
                categories: 'https://www.speedrun.com/api/v1/games/m1mnnrxd/categories',
                runs: 'https://www.speedrun.com/api/v1/runs?game=m1mnnrxd&embed=players&max=200',
                levels: 'https://www.speedrun.com/api/v1/games/m1mnnrxd/levels'
            }

            const fetchStuff = async (url) => {
                const response = await fetch(url);
                const data = await response.json();
                return data.data;
            }

            function convertArrayToObject(arr) {
                return arr.reduce((acc, obj) => {
                    acc[obj.id] = obj;
                    return acc;
                }, {});
            }

            async function getsrcData(game, offset) {
                const levels = convertArrayToObject(await fetchStuff(game.levels))
                const variables = convertArrayToObject(await fetchStuff(game.variables))
                const categories = convertArrayToObject(await fetchStuff(game.categories))
                let src = await fetchStuff(`${game.runs}&offset=${offset}`)
                for (let run of src) {
                    let runner = run.players.data[0]
                    let name = runner?.names?.international ?? runner?.name ?? null

                    //runner already exists
                    if ((runner?.id && usermap[runner?.id]) || (name && usermap[name])) {
                        if (usermap[runner.id]) {
                            users.child(usermap[runner.id]).child('src').update(runner)
                        } else if (usermap[name]) {
                            users.child(usermap[name]).child('src').update(runner)
                        }
                        //new runner
                    } else if (runner) {
                        const newpush = users.push({ src: runner })
                        if (runner.id) {
                            usermap[runner.id] = newpush.key
                        } else {
                            usermap[name] = newpush.key
                        }
                    }

                    run.category = categories[run.category]?.name ?? ""
                    run.level = levels[run.level]?.name ?? ""

                    let newvariables = {}
                    if (run.values) {
                        for (let key of Object.keys(run.values)) {
                            if (variables[key]) {
                                let newvar = variables[key]
                                let newkey = newvar.name
                                let newval = newvar.values.values[run.values[key]].label
                                newvariables[newkey] = newval
                            }
                        }
                    }
                    run.values = newvariables
                    if (platforms[run?.system?.platform]) {
                        run.system.platform = platforms[run.system.platform]
                    }
                    if (runmap[run.id]) { //if it already exists, update it
                        speedruns.child(runmap[run.id]).child('src').update(run)
                    } else { //otherwise, make a new record
                        const newrun = speedruns.push({ src: run })
                        runmap[run.id] = newrun.key
                    }
                }
            }

            async function forLoop() {
                const promises = []
                for (let index = 0; index < 30; index++) {
                    const offset = 200 * index
                    console.log('offset ' + offset)
                    const push1 = await getsrcData(game, offset)
                    promises.push(push1)
                    const push2 = getsrcData(extension, offset)
                    promises.push(push2)
                }
                await Promise.all(promises)
                console.log('done updating records from src')
            }

            forLoop()
        })

        /*
        //cyberscore scraper
        const url1 = 'https://www.cyberscore.me.uk/game/191';
        function getTimes(url) {
            return rp(url)
                .then(function (html) {
                    let table = $('.zebra', html)
                    let times = []
                    $('tr', table).each((i, elem) => {
                        let text = $('td', elem).text().split(/\n/)
                        let date = ""
                        if (text[0].startsWith("First submission") || text[0].startsWith("Updated")) {
                            date = text[0].replace("First submission", "").replace("Updated", "").trim()
                            let data = {
                                time: text[1].slice(0, -2).replace(/\t/g, ""),
                                date: date.replace(" ", "T") + "Z"
                            }
                            times.push(data)
                        }
                    })
                    return times
                })
        }

        function getRunData(url) {
            return rp("https://www.cyberscore.me.uk" + url)
                .then(function (html) {
                    let runs = []
                    let table = $('.charts-show-scoreboard', html)
                    let text0 = $('.gamename', html).text().split("→")[2].replace(/\n/, "").trim().split("–")
                    let cat = ""
                    let track = text0[text0.length - 1].trim().replace("’", "'")
                    for (let i = 0; i < tracks.length; i++) {
                        if (String(track).toLowerCase() == tracks[i].name.toLowerCase()) {
                            track = i
                        }
                    }
                    if (text0[0].startsWith("3-Lap")) {
                        cat = "3Lap"
                    } else if (text0[0].startsWith("Best")) {
                        cat = "1Lap"
                    }
                    console.log('getting ' + cat + " times for " + track)
                    $('tr', table).each((i, elem) => {
                        if ($('.details', elem).text() !== '') {
                            let name = $('.user-identification', elem).text().replace(/\n/, "").trim()//.split(/\n/)
                            let details = $('.details', elem).text().replace(/\n/, "").split('–')
                            let racer = details[1].split("on")[0].replace("Using ", "").trim()
                            let platform = details[1].split("on")[1].trim()
                            let date = details[0].trim()
                            let time = $('.data', elem).text().trim().split(/\n/)[0]
                            let links = $('a', elem)
                            let user = "https://www.cyberscore.me.uk" + links[1].attribs.href
                            let record = 'https://www.cyberscore.me.uk' + links[links.length - 1].attribs.href
                            let proof = links[links.length - 2].attribs.href
                            if (proof.startsWith("/proofs")) {
                                proof = "https://www.cyberscore.me.uk" + proof
                            } else if (proof.startsWith("/user")) {
                                proof = ""
                            }
                            racer = racer.replace("Barranta", "Baranta").replace("Endacott", "Endocott").replace("Jin", "Jinn").replace("Rats Tyrell", "Ratts Tyerell").replace("‘Bullseye’", "'Bullseye'").replace("Bumpy", "'Bumpy'").replace("Parimiter", "Paramita")
                            for (let i = 0; i < racers.length; i++) {
                                if (String(racer).toLowerCase() == racers[i].name.toLowerCase()) {
                                    racer = i
                                }
                            }
                            let time = tools.timetoSeconds(time)
                            let data = {
                                name: name,
                                user: user, //.attribs.href,
                                cat: cat,
                                track: track,
                                racer: racer,
                                date: date,
                                platform: platform,
                                time: time,
                                proof: proof, //.attribs.href
                                record: record
                            }
                            runs.push(data)
                        }
                    })
                    Promise.all(runs)
                        .then(result => {
                            let arr = []
                            for (i = 0; i < result.length; i++) {
                                arr.push(getTimes(result[i].record))
                            }
                            //getTimes('https://www.cyberscore.me.uk' + data.records)
                            Promise.all(arr).then(async function (times) {
                                let all_runs = []
                                for (let i = 0; i < times.length; i++) {
                                    for (let j = 0; j < times[i].length; j++) {
                                        let data = { ...runs[i] }
                                        data.time = tools.timetoSeconds(times[i][j].time)
                                        data.date = times[i][j].date
                                        //filter combined by track and category
                                        let filtered_data = Object.values(speedruns_data).filter(e => e.cat == data.cat && e.track == data.track)
                                        //check for association
                                        if (associations_data !== null && associations_data !== undefined) {
                                            let keys = Object.keys(associations_data)
                                            let associated = false
                                            for (let k = 0; k < keys.length; k++) {
                                                //if association found, then filter by player
                                                let key = keys[k]
                                                if (data.name == associations_data[key].cs) {
                                                    filtered_data = filtered_data.filter(e => e.name == data.name || e.name == associations_data[key].src)
                                                    associated = true
                                                }
                                            }
                                        }
                                        //loop through combined
                                        let exists = false
                                        for (let k = 0; k < filtered_data.length; k++) {
                                            //account for different versions of yt urls
                                            //if no association, create association
                                            if (filtered_data[k].proof == data.proof && data.proof !== "" && !associated) {
                                                let association = {
                                                    src: filtered_data[k].name,
                                                    cs: data.name
                                                }
                                                associations_ref.push(association)
                                            }
                                            if (filtered_data[k].time == data.time) {
                                                exists = true
                                                //if cs date is earlier, update combined data
                                            }
                                        }
                                        //if no match found, push record
                                        if (!exists) {
                                            speedruns.push(data)
                                        }
                                        //remove proof/racer data for following runs
                                        runs[i].proof = ""
                                        runs[i].racer = ""
                                    }
                                }
                                return all_runs

                            })
                            /*.catch(function (err) {
                                console.log('error getting times')
                            });
                        })
                })
            //.catch(function (err) {
            //    console.log('error getting run data')
            //});
        }

        const getit = url => {
            return new Promise(resolve => getRunData(url).then(data => {
                resolve()
            }))
        }

        rp(url1)
            .then(function (html) {
                for (let i = 0; i < 50; i++) {
                    charts.push($('.chartname > a', html)[i].attribs.href)
                }
                Promise.all(charts)
                    .then(async function (chart) {
                        const forLoop = async _ => {
                            console.log('start')
                            for (let c = 0; c < charts.length; c++) {
                                const get = charts[c]
                                const get1 = await getit(charts[c])
                                all.push(get1)
                            }

                            //console.log('got ' + Object.keys(cs_data).length + ' records from cyberscore')

                        }
                        forLoop()
                    });
            })
            */
    }

}
