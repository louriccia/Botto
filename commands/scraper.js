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
        var combined_ref = database.ref('records/combined');
        var combined_data = {}
        combined_ref.on("value", function (snapshot) {
            combined_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var associations_ref = database.ref('records/associations');
        var associations_data = {}
        associations_ref.on("value", function (snapshot) {
            associations_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        combined_ref.remove()
        associations_ref.remove()
        //src scraper
        let url = 'https://www.speedrun.com/api/v1/runs?game=m1mmex12&embed=players&max=200'
        let settings = { method: "Get" }
        var src_count = 0
        async function getsrcData(url) {
            //try {
            const response = await fetch(url);
            const data = await response.json();
            var src = data.data
            var runs = []

            for (let i = 0; i < src.length; i++) {
                var exists = false
                if(combined_data !== undefined && combined_data !== null){
                    var rcrds = Object.values(combined_data)
                    for (let k = 0; k < rcrds.length; k++) {
                        if (rcrds[k].record == src[i].weblink) {
                            exists = true
                            k = rcrds.length
                        }
                    }
                }
                if (!exists) {
                    var name = ""
                    var video = ""
                    var user = ""
                    var racer = ""
                    if (src[i].players.data.length > 0) {
                        if (src[i].players.data[0].hasOwnProperty("names")) {
                            name = src[i].players.data[0].names.international
                            user = src[i].players.data[0].weblink
                        } else {
                            name = src[i].players.data[0].name
                        }
                    } else {
                        name = "deleted"
                    }
                    if (src[i].hasOwnProperty("videos")) {
                        if (src[i].videos !== null) {
                            if (src[i].videos.hasOwnProperty("links")) {
                                if (src[i].videos.links.length > 0) {
                                    video = src[i].videos.links[0].uri
                                }
                            }
                        }
                    }
                    if (src[i].values.hasOwnProperty("j846d94l")) {
                        racer = src[i].values.j846d94l
                        for (let i = 0; i < racers.length; i++) {
                            if (racer == racers[i].id) {
                                racer = i
                            }
                        }
                    }
                    var track = src[i].level
                    if (![null, ""].includes(track)) {
                        for (let i = 0; i < tracks.length; i++) {
                            if (track == tracks[i].id) {
                                track = i
                            }
                        }
                    }
                    var skips = ""
                    if (src[i].values.hasOwnProperty("789x6p58")) {
                        if (src[i].values["789x6p58"] == "rqvg3prq") {
                            skips = true
                        } else if (src[i].values["789x6p58"] == "013d38rl") {
                            skips = false
                        }
                    } else if (src[i].values.hasOwnProperty("onv6p08m")) {
                        if (src[i].values["onv6p08m"] == "21gjrx1z") {
                            skips = true
                        } else if (src[i].values["onv6p08m"] == "5lmxzy1v") {
                            skips = false
                        }
                    }
                    var upgrades = ""
                    if (src[i].values.hasOwnProperty("rn1z02dl")) {
                        if (src[i].values["rn1z02dl"] == "klrvnpoq") {
                            upgrades = true
                        } else if (src[i].values["rn1z02dl"] == "21d9rzpq") {
                            upgrades = false
                        }
                    } else if (src[i].values.hasOwnProperty("789k45lw")) {
                        if (src[i].values["789k45lw"] == "gq7nen1p") {
                            upgrades = true
                        } else if (src[i].values["789k45lw"] == "9qjzj014") {
                            upgrades = false
                        }
                    }
                    var sys = { "8gej2n93": "PC", "w89rwelk": "N64", "v06d394z": "DC", "7m6ylw9p": "Switch", "nzelkr6q": "PS4", "o7e2mx6w": "Xbox" }
                    var system = src[i].system.platform
                    if (system !== null && system !== undefined) { system = sys[system] }
                    var cats = { "xk9634k0": "Any%", "mkeoyg6d": "Semi-Pro Circuit", "7dg8ywp2": "Amateur Circuit", "n2yqxo7k": "100%", "w20zml5d": "All Tracks NG+", "824owmd5": "3Lap", "9d8wr6dn": "1Lap" }
                    var cat = src[i].category
                    if (cat !== null && cat !== undefined) { cat = cats[cat] }
                    if (cat == undefined) { cat = null }
                    var time = tools.timetoSeconds(src[i].times.primary_t)
                    var status = src[i].status.status
                    var run = {
                        name: name,
                        user: user,
                        cat: cat,
                        track: track,
                        racer: racer,
                        upgrades: upgrades,
                        skips: skips,
                        date: src[i].submitted,
                        platform: system,
                        time: time,
                        proof: video,
                        record: src[i].weblink
                    }
                    if (status !== "rejected") {
                        combined_ref.push(run)
                        src_count += 1
                    }
                    runs.push(run)
                } else {
                    //if it does exist, check for changes and update old record with values of new record
                }

            }
            return runs
        }

        const forLoop = async _ => {
            var bulk = []
            for (let index = 0; index < 20; index++) {
                const offset = 200 * index
                const link = url + "&offset=" + offset
                console.log(link)
                const get = await getsrcData(link)
                //if (!get.length > 0) {
                //    index = 20
                //}
                //bulk.push(get)
            }
            console.log('updated ' + src_count + ' records from src')
        }
        forLoop()

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
                    var track = text0[text0.length-1].trim().replace("’", "'")
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
                        if($('.details', elem).text() !== ''){
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
                                system: platform,
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
                                        var filtered_data = Object.values(combined_data).filter(e => e.cat == data.cat && e.track == data.track)
                                        //check for association
                                        if(associations_data !== null && associations_data !== undefined){
                                            var keys = Object.keys(associations_data)
                                            var associated = false
                                            for (var k = 0; k < keys.length; k ++){
                                                //if association found, then filter by player
                                                var key = keys[k]
                                                if(data.name == associations_data[key].cs){
                                                    filtered_data = filtered_data.filter(e => e.name == data.name || e.name == associations_data[key].src)
                                                associated = true
                                                }
                                            }
                                        }
                                        //loop through combined
                                        var exists = false
                                        for(var k = 0; k < filtered_data.length; k++){
                                            //account for different versions of yt urls
                                            //if no association, create association
                                            if(filtered_data[k].proof == data.proof && data.proof !== "" && !associated){
                                                var association = {
                                                    src: filtered_data[k].name,
                                                    cs: data.name
                                                }
                                                associations_ref.push(association)
                                            }
                                            if(filtered_data[k].time == data.time){
                                                exists = true
                                                //if cs date is earlier, update combined data
                                            }
                                        }
                                        //if no match found, push record
                                        if(!exists){
                                            combined_ref.push(data)
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
                                });*/
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
    }

}
