module.exports = {
    name: 'scrape',
    execute(client, interaction, args) {
        const fetch = require('node-fetch');
        const rp = require('request-promise');
        const $ = require('cheerio');
        const charts = [];
        const all = [];

        var firebase = require("firebase/app");
        require('firebase/auth');
        require('firebase/database');
        var database = firebase.database();
        var cs_ref = database.ref('records/cs');
        cs_ref.on("value", function(snapshot) {
            cs_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        var src_ref = database.ref('records/src');
        src_ref.on("value", function(snapshot) {
            src_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject.code);
        });
        cs_ref.remove()
        src_ref.remove()

        //src scraper
        let url = 'https://www.speedrun.com/api/v1/runs?game=m1mmex12&embed=players&max=200'
        let settings = { method: "Get" }
        async function getsrcData(url) {
            //try {
            const response = await fetch(url);
            const data = await response.json();
            var src = data.data
            var runs = []
            for (let i = 0; i < src.length; i++) {
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
                if (src[i].values.hasOwnProperty("j846d94l")){
                    racer = src[i].values.j846d94l
                    for(let i = 0; i<racers.length; i++){
                        if(racer == racers[i].id){
                            racer = i
                        }
                    }
                }
                var track = src[i].level
                if(![null, ""].includes(track)){
                    for(let i = 0; i<tracks.length; i++){
                        if(track == tracks[i].id){
                            track = i
                        }
                    }
                }
                var sys = {"8gej2n93": "PC", "w89rwelk": "N64","v06d394z": "DC", "7m6ylw9p": "Switch","nzelkr6q":"PS4", "o7e2mx6w":"Xbox"}
                var system = src[i].system.platform
                if(system !== null && system !== undefined){system = sys[system]}
                var cats = {"xk9634k0": "Any%", "mkeoyg6d": "Semi-Pro Circuit", "7dg8ywp2": "Amateur Circuit", "n2yqxo7k": "100%", "w20zml5d": "All Tracks NG+", "824owmd5": "3Lap", "9d8wr6dn": "1Lap"}
                var cat = src[i].category
                if(cat !== null && cat !== undefined){cat = cats[cat]}
                if(cat == undefined){ cat = null}
                var time = src[i].times.primary_t
                var status = src[i].status.status
                var run = {
                    name: name,
                    user: user,
                    cat: cat,
                    track: track,
                    racer: racer,
                    date: src[i].submitted,
                    platform: system,
                    time: time,
                    proof: video,
                    record: src[i].weblink
                }
                if(status !== "rejected"){
                    src_ref.push(run)
                }
                runs.push(run)
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
                if (!get.length > 0) {
                    index = 20
                }
                //bulk.push(get)
            }
            console.log('got src times')
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
                    var table = $('.scoreboard', html)
                    var text0 = $('.groupname', html).text().split("–")
                    var cat = ""
                    var track = text0[text0.length - 1].trim()
                    for(let i = 0; i<tracks.length; i++){
                        if(track.toLowerCase() == tracks[i].name.toLowerCase()){
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
                        var text = $('.name', elem).text().split(/\n/)
                        var text2 = text[4].split("on")
                        var text3 = $('.data', elem).text().trim().split(/\n/)
                        var links = $('a', elem)
                        var records = links[links.length - 1].attribs.href
                        var proof = links[links.length - 2].attribs.href
                        if (proof.startsWith("/proofs")) {
                            proof = "https://www.cyberscore.me.uk" + proof
                        } else if (proof.startsWith("/user")) {
                            proof = ""
                        }
                        var racer = text2[0].replace("Using ", "").trim().replace("Barranta", "Baranta").replace("Endacott", "Endocott").replace("Jin", "Jinn").replace("Rats Tyrell", "Ratts Tyerell").replace("‘Bullseye’", "'Bullseye'").replace("Bumpy", "'Bumpy'").replace("Parimiter", "Paramita")
                        for(let i = 0; i<racers.length; i++){
                            if(racer.toLowerCase() == racers[i].name.toLowerCase()){
                                racer = i
                            }
                        }
                        var time = tools.timetoSeconds(text3[0])
                        var data = {
                            name: text[1].match(/“([\w ]+)”/g).toString().replace("“", "").replace("”", ""),
                            user: 'https://www.cyberscore.me.uk' + $('.name > a', elem).attr('href'), //.attribs.href,
                            cat: cat,
                            track: track,
                            racer: racer,
                            date: text[3].replace(" –", "").trim(),
                            system: text2[1].trim().replace("Dreamcast", "DC").replace("Nintendo 64", "N64").replace("PlayStation 4", "PS4").replace("Xbox One", "Xbox").replace("PlayStation 5", "PS4").replace("Xbox Series X|S", "Xbox"),
                            time: time,
                            proof: proof, //.attribs.href
                            records: records
                        }
                        runs.push(data)

                    })
                    Promise.all(runs)
                        .then(result => {
                            var arr = []
                            for (i = 0; i < result.length; i++) {
                                arr.push(getTimes('https://www.cyberscore.me.uk' + result[i].records))
                            }
                            //getTimes('https://www.cyberscore.me.uk' + data.records)
                            Promise.all(arr).then(async function (times) {
                                var all_runs = []
                                for (var i = 0; i < times.length; i++) {
                                    for (var j = 0; j < times[i].length; j++) {
                                        var data = { ...runs[i] }
                                        data.time = times[i][j].time
                                        data.date = times[i][j].date
                                        cs_ref.push(data)
                                        runs[i].proof = ""
                                    }
                                }
                                return all_runs

                            })
                                .catch(function (err) {
                                    console.log('error getting times')
                                });
                        })
                })
                .catch(function (err) {
                    console.log('error getting run data')
                });
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
                            console.log('end')
                        }
                        forLoop()
                    });
            })
    }

}
