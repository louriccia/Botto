module.exports = {
    name: 'scrape',
    execute(client, interaction, args) {
        const fetch = require('node-fetch');
        const rp = require('request-promise');
        const $ = require('cheerio');
        const charts = [];
        const all = [];
        var tools = require('./../tools.js');

        var firebase = require("firebase/app");
        require('firebase/auth');
        require('firebase/database');
        var database = firebase.database();

        var speedruns = database.ref('speedruns');
        var speedruns_data = {}
        speedruns.on("value", function (snapshot) {
            speedruns_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });

        var users = database.ref('users');
        var users_data = {}
        users.on("value", function (snapshot) {
            users_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });

        //src scraper
        const platforms = { "8gej2n93": "PC", "w89rwelk": "N64", "v06d394z": "DC", "7m6ylw9p": "Switch", "nzelkr6q": "PlayStation", "o7e2mx6w": "Xbox" }
        let game = {
            variables: 'https://www.speedrun.com/api/v1/games/m1mmex12/variables',
            categories: 'https://www.speedrun.com/api/v1/games/m1mmex12/categories',
            runs: 'https://www.speedrun.com/api/v1/runs?game=m1mmex12&embed=players&max=200'
        }
        let extension = {
            variables: 'https://www.speedrun.com/api/v1/games/m1mnnrxd/variables',
            categories: 'https://www.speedrun.com/api/v1/games/m1mnnrxd/categories',
            runs: 'https://www.speedrun.com/api/v1/runs?game=m1mnnrxd&embed=players&max=200'
        }

        let already = {}

        Object.keys(speedruns_data).forEach(key => {
            let run = speedruns_data[key]
            if (run?.records?.src) {
                already[run.records.src.replace("https://www.speedrun.com/swe1r/run/", "")] = key
            }
        })

        let alreadyplayers = {}

        Object.keys(users_data).forEach(key => {
            let user = users_data[key]
            if (user.src.user) {
                alreadyplayers[user.src.user.replace("https://www.speedrun.com/user/", "")] = key
            }
        })
        console.log(already)
        console.log(alreadyplayers)
        let settings = { method: "Get" }
        var src_count = 0
        async function getStuff(url) {
            const response = await fetch(url);
            const data = await response.json();
            return data.data
        }
        async function getsrcData(game, offset) {
            //try {
            let variables = await getStuff(game.variables)
            let categories = await getStuff(game.categories)
            //let src = await getStuff(game.runs + "&offset=" + offset)
            const response = await fetch(game.runs + "&offset=" + offset);
            const data = await response.json();
            let src = data.data
            console.log(src)
            let runs = []

            for (let i = 0; i < src.length; i++) {
                let runner = src[i].players.data[0]
                let name = null
                if (runner?.names?.international) {
                    name = runner.names.international
                }
                
                if(runner?.id && alreadyplayers[runner.id]){
                    users.child(alreadyplayers[runner.id]).child('src').update(runner)
                } else if(false){
                    users.push(
                        {
                            src: runner
                        }
                    )
                }
                if (already[src[i].id]) { //if it already exists, update it
                    speedruns.child(already[src[i].id]).child('src').update(src[i])
                } else if(false){ //otherwise, make a new record
                    speedruns.push(
                        {
                            src: src[i]
                        }
                    )
                }
            }
            return runs
        }

        const forLoop = async _ => {
            for (let index = 0; index < 40; index++) {
                const offset = 100 * index

                const get1 = await getsrcData(game, offset)
                console.log('offset ' + offset )
                const get2 = await getsrcData(extension, offset)
                console.log('offset ' + offset )
            }
            console.log('finished getting records from src')
        }
        forLoop()

        /*
        //cyberscore scraper
        const url1 = 'https://www.cyberscore.me.uk/game/191';
        function getTimes(url) {
            return rp(url)
                .then(function (html) {
                    var table = $('.zebra', html)
                    var times = []
                    $('tr', table).each((i, elem) => {
                        var text = $('td', elem).text().split(/\n/)
                        var date = ""
                        if (text[0].startsWith("First submission") || text[0].startsWith("Updated")) {
                            date = text[0].replace("First submission", "").replace("Updated", "").trim()
                            var data = {
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
                    var runs = []
                    var table = $('.charts-show-scoreboard', html)
                    var text0 = $('.gamename', html).text().split("→")[2].replace(/\n/, "").trim().split("–")
                    var cat = ""
                    var track = text0[text0.length - 1].trim().replace("’", "'")
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
                            var name = $('.user-identification', elem).text().replace(/\n/, "").trim()//.split(/\n/)
                            var details = $('.details', elem).text().replace(/\n/, "").split('–')
                            var racer = details[1].split("on")[0].replace("Using ", "").trim()
                            var platform = details[1].split("on")[1].trim()
                            var date = details[0].trim()
                            var time = $('.data', elem).text().trim().split(/\n/)[0]
                            var links = $('a', elem)
                            var user = "https://www.cyberscore.me.uk" + links[1].attribs.href
                            var record = 'https://www.cyberscore.me.uk' + links[links.length - 1].attribs.href
                            var proof = links[links.length - 2].attribs.href
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
                            var time = tools.timetoSeconds(time)
                            var data = {
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
                            var arr = []
                            for (i = 0; i < result.length; i++) {
                                arr.push(getTimes(result[i].record))
                            }
                            //getTimes('https://www.cyberscore.me.uk' + data.records)
                            Promise.all(arr).then(async function (times) {
                                var all_runs = []
                                for (var i = 0; i < times.length; i++) {
                                    for (var j = 0; j < times[i].length; j++) {
                                        var data = { ...runs[i] }
                                        data.time = tools.timetoSeconds(times[i][j].time)
                                        data.date = times[i][j].date
                                        //filter combined by track and category
                                        var filtered_data = Object.values(speedruns_data).filter(e => e.cat == data.cat && e.track == data.track)
                                        //check for association
                                        if (associations_data !== null && associations_data !== undefined) {
                                            var keys = Object.keys(associations_data)
                                            var associated = false
                                            for (var k = 0; k < keys.length; k++) {
                                                //if association found, then filter by player
                                                var key = keys[k]
                                                if (data.name == associations_data[key].cs) {
                                                    filtered_data = filtered_data.filter(e => e.name == data.name || e.name == associations_data[key].src)
                                                    associated = true
                                                }
                                            }
                                        }
                                        //loop through combined
                                        var exists = false
                                        for (var k = 0; k < filtered_data.length; k++) {
                                            //account for different versions of yt urls
                                            //if no association, create association
                                            if (filtered_data[k].proof == data.proof && data.proof !== "" && !associated) {
                                                var association = {
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
