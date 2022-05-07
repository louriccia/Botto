module.exports = {
    numberWithCommas: function (x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },
    capitalize: function(string){
        return string.split(" ").map(word => word[0].toUpperCase() + word.slice(1)).join(" ")
    },
    timefix: function (time) {
        if(time == "DNF"){
            return "DNF"
        } else {
            time = Number(time)
        }
        var myformat = new Intl.NumberFormat('en-US', {
            minimumIntegerDigits: 2,
            minimumFractionDigits: 3
        });
        if (time >= 3600) {
            var hours = Math.floor(time / 3600)
            var minutes = Math.floor((time - hours * 3600) / 60)
            if (minutes < 10) {
                minutes = "0" + minutes
            }
            var seconds = (time - hours * 3600 - minutes * 60).toFixed(3)
            return hours.toString() + ":" + minutes.toString() + ":" + myformat.format(seconds)
        } else if (time >= 60) {
            var minutes = Math.floor(time / 60)
            var seconds = (time - minutes * 60).toFixed(3)
            return minutes.toString() + ":" + myformat.format(seconds)
        } else {
            return Number(time).toFixed(3)
        }
    },
    timetoSeconds: function (time) {
        var myformat = new Intl.NumberFormat('en-US', {
            minimumIntegerDigits: 2,
            minimumFractionDigits: 3
        });
        if (time !== undefined) {
            if (String(time).includes(":")) {
                var split = time.split(':')
                if (split.length = 2) {
                    var out = Number(split[0] * 60) + Number(split[1])
                    if (Number(split[1]) >= 60) {
                        return null
                    } else {
                        return Number(out).toFixed(3)
                    }
                } else if (split.length = 3) {
                    var out = Number(split[0] * 60 * 60) + Number(split[1] * 60) + Number(split[2])
                    return Number(out).toFixed(3)
                } else {
                    return null
                }

            } else {
                return Number(time).toFixed(3)
            }
        } else {
            return null
        }


    },
    findTime: function (str) {
        var time = ""
        var time_begin = -1
        var time_length = 0
        for (let i = 0; i < str.length; i++) {
            if (Number.isInteger(parseInt(str.charAt(i)))) {
                for (let j = 1; j < 9; j++) {
                    if (Number.isInteger(parseInt(str.charAt(i + j))) || str.charAt(i + j) == ":" || str.charAt(i + j) == ".") {
                        time_length++
                    } else {
                        j = 9
                    }
                }
                if (time_length > 4) {
                    time_begin = i
                    i = str.length
                }
            } else {
                time_length = 0
            }
        }
        if (time_length > 0) {
            time = str.substring(time_begin, time_begin + time_length + 1)
            if (time.length > 6 && !time.includes(":")) {
                time = ""
            }
            if (time.length > 4 && !time.includes(".")) {
                time = ""
            }
        }
        return time
    },
    upgradeTraction: function (base, upg) {
        return Math.min(1, base + upg * 0.05)
    },
    upgradeTurning: function (base, upg) {
        if (upg < 5) {
            return base + upg * 116
        } else {
            return base + (upg - 1) * 116 + 114
        }
    },
    upgradeAcceleration: function (base, upg) {
        return base - 0.14 * base * upg
    },
    upgradeTopSpeed: function (base, upg) {
        return Math.min(base + 40 * upg, 650)
    },
    upgradeAirBrake: function (base, upg) {
        var brake = base
        if (upg > 0) {
            brake = brake - base * 0.08
        }
        if (upg > 1) {
            brake = brake - base * 0.09 * upg
        }
        return brake
    },
    upgradeCooling: function (base, upg) {
        return (base + upg * 1.6)
    },
    upgradeRepair: function (base, upg) {
        if (upg < 5) {
            return (Math.min(1, base + upg * 0.1))
        } else {
            return (Math.min(1, base + (upg - 1) * 0.1 + 0.05))
        }
    },
    avgSpeed: function (topspeed, boost, heatrate, coolrate) {
        var boostdistance = (boost / 50) * (50 * (100 / heatrate) - 11 * Math.log(Math.abs(50 * (100 / heatrate) + 11))) - (boost / 50) * (50 * (0) - 11 * Math.log(Math.abs(50 * (0) + 11)))
        var avgboost = boostdistance / (100 / heatrate)
        var e19 = 1 - (3333 / (100 * 45 * ((3333 / (100 * 45)) + 5)))
        var cooldistance = boost * Math.log(Math.abs(11 * e19 ** (45 * (100 / heatrate)) * heatrate + 7500 * e19 ** (45 * (100 / heatrate + 100 / coolrate)))) / (Math.log(e19) * 45) - boost * Math.log(Math.abs(11 * e19 ** (45 * (100 / heatrate)) * heatrate + 7500 * e19 ** (45 * (100 / heatrate)))) / (Math.log(e19) * 45)
        var avgcool = cooldistance / (100 / coolrate)
        var avgspeed = ((100 / heatrate) * (topspeed + avgboost) + (100 / coolrate) * (topspeed + avgcool)) / (100 / heatrate + 100 / coolrate)
        return avgspeed
    },
    getRacerEmbed: function (numb) {
        const Discord = require('discord.js');
        var Tier = ["Top", "High", "Mid", "Low"]
        var boost = racers[numb].boost_thrust
        var heatrate = racers[numb].heat_rate
        var coolrate = this.upgradeCooling(racers[numb].cool_rate, 5)
        var topspeed = this.upgradeTopSpeed(racers[numb].max_speed, 5)
        var avgspeedmu = this.avgSpeed(topspeed, boost, heatrate, coolrate)
        var avgspeednu = this.avgSpeed(racers[numb].max_speed, boost, heatrate, racers[numb].cool_rate)
        const racerEmbed = new Discord.MessageEmbed()
            .setURL("https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit#gid=0")
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].flag + " " + racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .addField("Pod", racers[numb].pod, false)
            .addField("Species: " + racers[numb].species, "Homeworld: " + racers[numb].homeworld, true)
            .addField("Favorite", planets[tracks[racers[numb].favorite].planet].emoji + " " + tracks[racers[numb].favorite].name, true)
            .addField("Voice Actor", racers[numb].voice, true)
            .addField("Tier", "NU: " + Tier[racers[numb].nu_tier] + "\nMU: " + Tier[racers[numb].mu_tier], true)
            .addField("Average Speed", "NU: " + Math.round(avgspeednu) + "\nMU: " + Math.round(avgspeedmu), true)
            .addField("Max Turn", racers[numb].max_turn_rate + "°/s", true)
            .setImage(racers[numb].stats)
        return racerEmbed
    },
    getTrackEmbed: function (numb, client, channel, interaction) {
        const Discord = require('discord.js');
        const fetch = require('node-fetch');
        const attachment = new Discord
            .MessageAttachment('./img/tracks/' + (numb + 1) + '.png', (numb + 1) + '.png');
        const trackEmbed = new Discord.MessageEmbed()
            //.setThumbnail(planets[tracks[numb].planet].img)
            //.setFooter(footer)
            .setColor(planets[tracks[numb].planet].color)
            .attachFiles(attachment)
            .setURL("https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit#gid=1682683709")
            .setImage(tracks[numb].img)
            //.setImage('attachment://' + (numb+1) + '.png')
            .setTitle(planets[tracks[numb].planet].emoji + " " + tracks[numb].name)
            .setThumbnail(tracks[numb].preview)
            .setDescription("(" + tracks[numb].nickname.join(", ") + ")")
            .addField(circuits[tracks[numb].circuit].name + " Circuit", "Race " + tracks[numb].cirnum, true)
            .addField("Planet", planets[tracks[numb].planet].emoji + " " + planets[tracks[numb].planet].name, true)
            .addField("Host", planets[tracks[numb].planet].host, true)
            .addField("Track Favorite", racers[tracks[numb].favorite].flag + " " + racers[tracks[numb].favorite].name, true)
            .addField("Difficulty", difficulties[tracks[numb].difficulty].name, true)
            .addField("Length", tracks[numb].lengthclass, true)
        return trackEmbed
    },
    ordinalSuffix: function (i) {
        if (i < 3) {
            var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>"]
            return pos[i]
        } else {
            i = i + 1
            var j = i % 10,
                k = i % 100;
            if (j == 1 && k != 11) {
                return i + "st";
            }
            if (j == 2 && k != 12) {
                return i + "nd";
            }
            if (j == 3 && k != 13) {
                return i + "rd";
            }
            return i + "th";
        }
    },
    getRanks: function () {
        var admin = require('firebase-admin');
        var database = admin.database();
        var firebase = require("firebase/app");
        var tourney_matches = database.ref('tourney/matches')
        tourney_matches.on("value", function (snapshot) {
            tourney_matches_data = snapshot.val();
        }, function (errorObject) {
            console.log("The read failed: " + errorObject);
        });
        var matches = Object.values(tourney_matches_data)
        matches.sort(function (a, b) {
            return a.datetime - b.datetime;
        })
        var ranks = {}
        matches.forEach(match => {
            if (![undefined, "", "Qualifying"].includes(match.bracket)) {
                var players = {}
                match.races.forEach(race => {
                    var winner = {player: null, time: null}
                    race.runs.forEach(run => {
                        if(players[run.player] == undefined){
                            players[run.player] = {player: run.player, score: 0}
                        }
                        if(run.time !== "DNF" && (winner.time == null || run.time < winner.time)){
                            winner.time = run.time
                            winner.player = run.player
                        }
                    })
                    players[winner.player].score ++
                })
                players = Object.values(players)
                if (players.length == 2) {
                    for (var j = 0; j < players.length; j++) {
                        //initialize player
                        if (ranks[players[j].player] == undefined) {
                            ranks[players[j].player] = { rank: 1000, matches: 0, change: 0 }
                        }
                    }
                    var r1 = ranks[players[0].player].rank
                    var r2 = ranks[players[1].player].rank
                    var p1 = 1 / (1 + 10 ** ((r2 - r1) / 400))
                    var p2 = 1 - p1
                    function getK(matches) {
                        var k = 25
                        if (matches < 26) {
                            k = 32
                        }
                        if (matches < 11) {
                            k = 40
                        }
                        if (matches < 6) {
                            k = 50
                        }
                        return k
                    }
                    var k1 = getK(ranks[players[0].player].matches)
                    var k2 = getK(ranks[players[1].player].matches)
                    var s1 = null, s2 = null
                    if (!["", null, undefined].includes(players[0].score) && !["", null, undefined].includes(players[1].score)) {
                        if (players[0].score > players[1].score) {
                            s1 = 1
                            s2 = 0
                        } else if (players[1].score > players[0].score) {
                            s1 = 0
                            s2 = 1
                        }
                        ranks[players[0].player].rank += k1 * (s1 - p1)
                        ranks[players[1].player].rank += k2 * (s2 - p2)
                        ranks[players[0].player].change = k1 * (s1 - p1)
                        ranks[players[1].player].change = k2 * (s2 - p2)
                        ranks[players[0].player].matches++
                        ranks[players[1].player].matches++
                    }
                }
            }
        })
        /*
        var rnks = Object.keys(ranks)
        for (i = 0; i < rnks.length; i++) {
            if (ranks[rnks[i]].matches < 4) {
                delete ranks[rnks[i]]
            }
        }*/
        return ranks
    },
    getGoalTime: function (track, racer, acceleration, top_speed, cooling, laps, length_mod, uh_mod, us_mod, deaths) {
        //0. get required values
        var accel = this.upgradeAcceleration(racers[racer].acceleration, acceleration)
        var topspeed = this.upgradeTopSpeed(racers[racer].max_speed, top_speed)
        var thrust = 1.32
        var heatrate = racers[racer].heat_rate
        var coolrate = this.upgradeCooling(racers[racer].cool_rate, cooling)
        var boost = racers[racer].boost_thrust
        //1. calculate avg speed given upgrades
        var boostdistance = (boost / 50) * (50 * (100 / heatrate) - 11 * Math.log(Math.abs(50 * (100 / heatrate) + 11))) - (boost / 50) * (50 * (0) - 11 * Math.log(Math.abs(50 * (0) + 11)))
        var avgboost = boostdistance / (100 / heatrate)
        var e19 = 1 - (3333 / (100 * 45 * ((3333 / (100 * 45)) + 5)))
        var cooldistance = boost * Math.log(Math.abs(11 * e19 ** (45 * (100 / heatrate)) * heatrate + 7500 * e19 ** (45 * (100 / heatrate + 100 / coolrate)))) / (Math.log(e19) * 45) - boost * Math.log(Math.abs(11 * e19 ** (45 * (100 / heatrate)) * heatrate + 7500 * e19 ** (45 * (100 / heatrate)))) / (Math.log(e19) * 45)
        var avgcool = cooldistance / (100 / coolrate)
        var avgspeed = ((100 / heatrate) * (topspeed + avgboost) + (100 / coolrate) * (topspeed + avgcool)) / (100 / heatrate + 100 / coolrate)
        //console.log("Average Speed: " + avgspeed)
        //2. calculate starting boost time and distance (MULTILAP) || calculate full boost time and distance (FLAP)
        function integrate(f, start, end, step, topspeed, accel, boost, offset1, offset2) {
            let total = 0
            step = step || 0.01
            for (let x = start; x < end; x += step) {
                total += f(x + step / 2, topspeed, accel, boost, offset1, offset2) * step
            }
            return total
        }
        var b2 = (290 * accel) / ((topspeed - 290) * 1.5 * thrust)
        var c2 = 0.75 * topspeed
        var d2 = (c2 * accel) / ((topspeed - c2) * 1.5 * thrust)
        var e2 = (d2 + 1) * 1.5 * thrust * topspeed / (accel + (d2 + 1) * 1.5 * thrust)
        var f2 = (e2 * accel) / ((topspeed - e2) * 4 * thrust)
        var a = (290 * accel) / ((topspeed - 290) * 4 * thrust)
        var b = b2 - a
        var c = -(d2 + 1) + b
        var d = c + f2
        var e = -c + (100 / heatrate)
        var totaltime = e
        function startboost(x, topspeed, accel, boost, offset1, offset2) {
            let y = x * 4 * 1.32 * topspeed / (accel + x * 4 * 1.32)
            return y
        }
        function boostcharge(x, topspeed, accel, boost, offset1, offset2) {
            let y = (x + offset1) * 1.5 * 1.32 * topspeed / (accel + (x + offset1) * 1.5 * 1.32)
            return y
        }
        function firstboost(x, topspeed, accel, boost, offset1, offset2) {
            let y = ((x + offset1) * 1.5 * boost) / ((x + offset1) * 1.5 + 0.33) + ((x + offset2) * 4 * 1.32 * topspeed) / (accel + (x + offset2) * 4 * 1.32)
            return y
        }
        var step = 0.0001
        var totaldistance = integrate(startboost, 0, a, step, topspeed, accel, boost, null, null)
        totaldistance = totaldistance + integrate(boostcharge, a, -c, step, topspeed, accel, boost, b, null)
        totaldistance = totaldistance + integrate(firstboost, -c, e, step, topspeed, accel, boost, c, d)
        //console.log("Total distance: " + totaldistance + "\nTotal time: " + totaltime)

        //3. calculate fast terrain section
        //bite off fast terrain length in chunks starting with cooling and calculate complete heat cycle                  
        var fastspeed = 200
        var cooltime = 100 / coolrate
        var boosttime = 100 / heatrate
        function getFast(fastarray) {
            var totalfastlength = 0
            var totalfasttime = 0
            for (var i = 0; i < fastarray.length; i++) {
                var fastlength = fastarray[i]
                while (fastlength > 0) {
                    if (fastlength / (topspeed + avgcool + fastspeed) > cooltime) { //if pod is on fast terrain longer than cool time
                        totalfastlength += ((topspeed + avgcool + fastspeed) * cooltime)
                        totalfasttime += (cooltime)
                        fastlength -= (topspeed + avgcool + fastspeed) * cooltime
                    } else if (fastlength / (topspeed + avgcool + fastspeed) <= cooltime) { //if pod is on fast terrain shorter than cool time
                        totalfastlength += (fastlength)
                        totalfasttime += (fastlength / (topspeed + avgcool + fastspeed))
                        //remaining cooling
                        totalfastlength += ((topspeed + avgcool) * (cooltime - fastlength / (topspeed + avgcool + fastspeed)))
                        totalfasttime += (cooltime - fastlength / (topspeed + avgcool + fastspeed))
                        //next boost
                        totalfastlength += ((topspeed + avgboost) * boosttime)
                        totalfasttime += (boosttime)
                        fastlength = 0
                    }
                    if (fastlength > 0) {
                        if (fastlength / (topspeed + avgboost + fastspeed) > boosttime) { //if pod is on fast terrain longer than boost time
                            totalfastlength += ((topspeed + avgboost + fastspeed) * boosttime)
                            totalfasttime += (boosttime)
                            fastlength -= (topspeed + avgboost + fastspeed) * boosttime
                        } else if (fastlength / (topspeed + avgboost + fastspeed) <= boosttime) { //if pod is on fast terrain shorter than boost time
                            totalfastlength += (fastlength)
                            totalfasttime += (fastlength / (topspeed + avgboost + fastspeed))
                            //remaining boosting
                            totalfastlength += ((topspeed + avgboost) * (boosttime - fastlength / (topspeed + avgboost + fastspeed)))
                            totalfasttime += (boosttime - fastlength / (topspeed + avgboost + fastspeed))
                            fastlength = 0
                        }
                    }
                }
            }
            return [totalfastlength, totalfasttime]
        }

        //4. calculate slow terrain section
        //bite off slow terrain length in chunks starting with boosting and calculate full heat cycle
        //a pod can only afford one full boost + a small leftover boost that is worth 1 second of cooling

        var slowmod = 0.75
        function getSlow(slowarray) {
            var totalslowlength = 0
            var totalslowtime = 0
            for (var i = 0; i < slowarray.length; i++) {
                var slowlength = slowarray[i]
                //boosting
                if (slowlength > 0) {
                    if (slowlength / ((topspeed + avgboost) * slowmod) > boosttime) { //if there is more slow terrain than the pod can boost through
                        totalslowlength += ((topspeed + avgboost) * slowmod) * boosttime
                        totalslowtime += boosttime
                        slowlength -= (topspeed + avgboost) * slowmod * boosttime
                        //short cool
                        if (slowlength / ((topspeed + avgcool) * slowmod) > 1) { //if the remaining slow terrain would allow for another short boost
                            totalslowlength += (topspeed + avgcool) * slowmod * 1
                            totalslowtime += 1
                            slowlength -= (topspeed + avgcool) * slowmod * 1
                            //short boost
                            if (slowlength / ((topspeed + avgboost) * slowmod) > coolrate / heatrate) { //if the pod will still be on slow terrain after the short boost
                                totalslowlength += (topspeed + avgboost) * slowmod * (coolrate / heatrate)
                                totalslowtime += coolrate / heatrate
                                slowlength -= (topspeed + avgboost) * slowmod * (coolrate / heatrate)
                                //cooling
                                if (slowlength / ((topspeed + avgboost) * slowmod) > cooltime) { //if the remaining slow terrain is longer than the pod's cool time
                                    //underheating
                                    totalslowlength += slowlength
                                    totalslowtime += slowlength / ((topspeed + avgcool) * slowmod)
                                    slowlength = 0
                                } else {
                                    totalslowlength += slowlength
                                    totalslowtime += slowlength / ((topspeed + avgcool) * slowmod)
                                    //remaining cooling on regular terrain
                                    totalslowlength += (topspeed + avgcool) * (cooltime - slowlength / ((topspeed + avgcool) * slowmod))
                                    totalslowtime += cooltime - slowlength / ((topspeed + avgcool) * slowmod)
                                    slowlength = 0
                                }
                            } else {
                                totalslowlength += slowlength
                                totalslowtime += slowlength / ((topspeed + avgboost) * slowmod)
                                //next cool
                                totalslowlength += (topspeed + avgcool) * cooltime
                                totalslowtime += cooltime
                                slowlength = 0
                            }
                        } else {
                            //remaining slow terrain
                            totalslowlength += slowlength
                            totalslowtime += slowlength / ((topspeed + avgcool) * slowmod)
                            //remaining cooling on normal terrain
                            totalslowlength += (topspeed + avgcool) * (cooltime - slowlength / ((topspeed + avgcool) * slowmod))
                            totalslowtime += cooltime - slowlength / ((topspeed + avgcool) * slowmod)
                            slowlength = 0
                        }
                    } else { //if there is less slow terrain than a pod's full boost
                        //remaining boost on slow terrain
                        totalslowlength += slowlength;
                        totalslowtime += slowlength / ((topspeed + avgboost) * slowmod)
                        //remaining boosting on non slow terrain
                        totalslowlength += ((topspeed + avgboost) * (boosttime - slowlength / ((topspeed + avgboost) * slowmod)))
                        totalslowtime += (boosttime - slowlength / ((topspeed + avgboost) * slowmod))
                        //next cool
                        totalslowlength += (topspeed + avgcool) * cooltime
                        totalslowtime += cooltime
                        slowlength = 0
                    }
                }
            }
            return [totalslowlength, totalslowtime]
        }

        //The faster the base speed, the more likely to lose it to turns (this may be less of a factor since cooling is worse with NU)
        //Mu vs nu on intense switchback sections
        //The better the turning the better chance of maintaining base speed
        //This is where bullseye beats ben on gvg/fmr
        //The faster the cooling the more chance of underheating
        //Bullseye Underheating as well


        //5. account for pod stats
        var scaler = 89//scale to ben
        if (track == 16 || track == 19) {
            scaler = 120//scale to bullseye
        }
        uh_mod = uh_mod * (1 + (scaler - racers[racer].max_turn_rate) / 20)
        us_mod = us_mod * (1 + (scaler - racers[racer].max_turn_rate) / 20)
        //6. calculate the final time
        var first_lap_fast = getFast(tracks[track].first_lap.fast)
        var first_lap_slow = getSlow(tracks[track].first_lap.slow)
        //console.log("first lap fast: " + first_lap_fast +"\nfirst lap slow: " + first_lap_slow)
        var firstlaptime = totaltime + first_lap_fast[1] + first_lap_slow[1] + tracks[track].first_lap.underheat * uh_mod + tracks[track].first_lap.underspeed * us_mod + (tracks[track].first_lap.length * length_mod - (first_lap_fast[0] + first_lap_slow[0] + totaldistance + tracks[track].first_lap.underheat * uh_mod * topspeed + tracks[track].first_lap.underspeed * us_mod * topspeed * .75)) / avgspeed
        //console.log("First Lap Time: " + firstlaptime)
        var lap_fast = getFast(tracks[track].lap.fast)
        var lap_slow = getSlow(tracks[track].lap.slow)
        var laptime = lap_fast[1] + lap_slow[1] + tracks[track].lap.underheat * uh_mod + tracks[track].lap.underspeed * us_mod + (tracks[track].lap.length * length_mod - (lap_fast[0] + lap_slow[0] + tracks[track].lap.underheat * uh_mod * topspeed + tracks[track].lap.underspeed * us_mod * topspeed * .75)) / avgspeed
        //console.log("Lap Time: " + laptime)
        var finaltime = firstlaptime + laptime * (laps - 1)
        //console.log("Final Time: " + finaltime)
        finaltime += deaths * (3 + accel)
        return finaltime
    },
    simulateSpeed: function (chosenTrack, fps, upgradeLevel, laps) {
        var data = require('./data.js')

        var returnValue = [] //format:: [[pod index, average speed, finish time], [next pod], ... [final pod], fps, track]

        //var chosenTrack = track
        var trackLength = null
        if(laps == 1) {
            trackLength = tracks[chosenTrack].first_lap.length
        } else {
            trackLength = tracks[chosenTrack].first_lap.length + (laps - 1 ) * tracks[chosenTrack].lap.length
        }
        const firstPod = 0
        const lastPod = 22 //inclusive
        //var upgradeLevel = upgrades

        //constants
        //var fps = 24
        var frameTime = 1 / fps
        var maxAllowedHeat = 100.0

        //pod stats
        var podStats = { //default values here are never used
            statSpeed: 650.0,
            statThrust: 200.0,
            statAccel: 1.0,
            statHeatRate: 10,
            statCoolRate: 10
        }


        const stateZeroFrame = createState(
            0, //frame
            frameTime, //raceTime
            0.0, //distanceTravelled
            0.0, //speedValue
            0.0, //boostCharge
            100.0, //heat
            0.0, //boostValue
            false, //isBoosting
            true, //isBoostStart
            false, //isBoostStartEnded
            'd', //nosePosition
            false //isTrackFinished
        )
        var stateInitialPass// = createClonedState(stateZeroFrame)
        var stateInitialPassPrev// = createClonedState(stateZeroFrame)
        var stateLastBoostStart// = createClonedState(stateZeroFrame)
        var stateLastBoostEnd// = createClonedState(stateZeroFrame)
        var stateTrackEndFrame// = createClonedState(stateZeroFrame)
        var stateNextPass// = createClonedState(stateZeroFrame)
        var stateNextPassPrev// = createClonedState(stateZeroFrame)


        var lastAverageSpeedIncreaseFrame

        for (var i = firstPod; i <= lastPod; i++) {
            resetStatesAndValues()
            getPodStats(i)
            initialPass(stateInitialPass, stateInitialPassPrev)
            recursivePass(stateNextPass, stateNextPassPrev, 1000000, 0)
            returnValue.push([i, stateNextPass.averageSpeedAtTrackEnd, stateNextPass.finishTime])
        }

        returnValue.sort(function (a, b) {
            return a[2] - b[2]
        })

        returnValue.push(fps)
        returnValue.push(chosenTrack)

        for (var i = firstPod; i <= lastPod; i++) {
            //console.log(returnValue[i][0] + ": " + Math.round(returnValue[i][1]*10)/10 + ", Time: " + Math.round(returnValue[i][2]*1000)/1000)
        }

        return returnValue

        //all functions
        //core loop functions
        function initialPass(state, statePrev) {
            runTrack(state, statePrev, -1)
            //printState(state)
        }

        function recursivePass(state, statePrev, prevGuessError, i) {
            var newBoostStartFrame
            if (lastAverageSpeedIncreaseFrame >= stateTrackEndFrame.frame) { //speed increased
                newBoostStartFrame = Math.round(stateLastBoostStart.frame - (lastAverageSpeedIncreaseFrame - stateTrackEndFrame.frame) / 2)
            } else {
                newBoostStartFrame = Math.round(stateLastBoostEnd.frame - 1 - (lastAverageSpeedIncreaseFrame - stateTrackEndFrame.frame) / 2)
            }

            overwriteState(stateZeroFrame, state)
            overwriteState(stateZeroFrame, statePrev)
            runTrack(state, statePrev, newBoostStartFrame)

            var guessError = lastAverageSpeedIncreaseFrame - stateTrackEndFrame.frame
            if (i >= 10) { //abort after 10 iterations
                return
            }
            else if (Math.abs(guessError) <= 0) { //desired accuracy reached
                return
            }
            else if ((prevGuessError > 0 && guessError > prevGuessError) || (prevGuessError < 0 && guessError < prevGuessError)) { //less accurate
                return
            }
            else { //more accurate
                recursivePass(state, statePrev, guessError, i + 1)
            }

        }

        function runTrack(state, statePrev, injectedBoostFrame) {
            var i = 0
            var maxFrames = 200000
            var loopAgain = true
            var fire = false
            while (loopAgain) {
                overwriteState(state, statePrev)
                incrementFrame(state, injectedBoostFrame)
                /*console.log("frame: " + state.frame + " (" + Math.round(state.raceTime*1000)/1000 + "s)")
                console.log("combinedSpeed: " + Math.round(state.combinedSpeed*10)/10 + " = " + Math.round(state.baseSpeed*10)/10 + " + " + Math.round(state.boostSpeed*10)/10)
                //console.log("speedValue: " + state.speedValue + ", boostValue: " + state.boostValue)
                //console.log("isBoostStart: " + state.isBoostStart + ", isBoostStartEnded: " + state.isBoostStartEnded)
                console.log("distance travelled: " + Math.round(state.distanceTravelled*10)/10 + ", track finished?: " + state.isTrackFinished)*/

                //determine whether to loop again
                i++
                loopAgain = (loopAgain && i < maxFrames) ? true : false
                if (state.isTrackFinished) { //continue running after track finish until average speed drops
                    loopAgain = (loopAgain && state.averageSpeed > state.prevAverageSpeed) ? true : false
                }
            }
        }


        //data (object) functions
        function resetStatesAndValues() {
            lastAverageSpeedIncreaseFrame = 0
            stateInitialPass = createClonedState(stateZeroFrame)
            stateInitialPassPrev = createClonedState(stateZeroFrame)
            stateLastBoostStart = createClonedState(stateZeroFrame)
            stateLastBoostEnd = createClonedState(stateZeroFrame)
            stateTrackEndFrame = createClonedState(stateZeroFrame)
            stateNextPass = createClonedState(stateZeroFrame)
            stateNextPassPrev = createClonedState(stateZeroFrame)
        }

        function createState(frame, raceTime, distanceTravelled, speedValue, boostCharge, heat, boostValue, isBoosting, isBoostStart, isBoostStartEnded, nosePosition, isTrackFinished) {
            return {
                frame: frame,

                raceTime: raceTime,
                speedValue: speedValue,
                baseSpeed: calculateBaseSpeed(speedValue),
                boostCharge: boostCharge,

                //boost stuff
                heat: heat,
                boostValue: boostValue,
                boostSpeed: calculateBoostSpeed(boostValue),
                isBoosting: isBoosting,
                isBoostStart: isBoostStart,
                isBoostStartEnded: isBoostStartEnded, //becomes true to prevent boost start if speed later drops below 290

                speedTimeMultiplier: (isBoosting || isBoostStart) ? 4.0 : 1.5, //4.0 when boosting or boost start, 1.5 otherwise

                nosePosition: nosePosition, //'d': down, 'u': up, 'n': neutral
                noseMultiplier: calculateNoseMultiplier(nosePosition),
                isTrackFinished: isTrackFinished,
                finishTime: 1000000.0,

                combinedSpeed: this.baseSpeed + this.boostSpeed,
                distanceTravelled: distanceTravelled,
                averageSpeed: distanceTravelled / raceTime,
                averageSpeedAtTrackEnd: 0.0,
                prevAverageSpeed: this.averageSpeed
            }
        }

        function createClonedState(state) {
            return {
                frame: state.frame,

                raceTime: state.raceTime,
                speedValue: state.speedValue,
                baseSpeed: state.baseSpeed,
                boostCharge: state.boostCharge,

                heat: state.heat,
                boostValue: state.boostValue,
                boostSpeed: state.boostSpeed,
                isBoosting: state.isBoosting,
                isBoostStart: state.isBoostStart,
                isBoostStartEnded: state.isBoostStartEnded, //becomes true to prevent boost start if speed later drops below 290

                speedTimeMultiplier: state.speedTimeMultiplier, //4.0 when boosting or boost start, 1.5 otherwise

                nosePosition: state.nosePosition, //'d': down, 'u': up, 'n': neutral
                noseMultiplier: state.noseMultiplier,
                isTrackFinished: state.isTrackFinished,
                finishTime: state.finishTime,

                combinedSpeed: state.combinedSpeed,
                distanceTravelled: state.distanceTravelled,
                averageSpeed: state.averageSpeed,
                averageSpeedAtTrackEnd: state.averageSpeedAtTrackEnd,
                prevAverageSpeed: state.prevAverageSpeed
            }
        }

        function overwriteState(sourceState, destinationState) {
            destinationState.frame = sourceState.frame,

                destinationState.raceTime = sourceState.raceTime,
                destinationState.speedValue = sourceState.speedValue,
                destinationState.baseSpeed = sourceState.baseSpeed,
                destinationState.boostCharge = sourceState.boostCharge,

                destinationState.heat = sourceState.heat,
                destinationState.boostValue = sourceState.boostValue,
                destinationState.boostSpeed = sourceState.boostSpeed,
                destinationState.isBoosting = sourceState.isBoosting,
                destinationState.isBoostStart = sourceState.isBoostStart,
                destinationState.isBoostStartEnded = sourceState.isBoostStartEnded,

                destinationState.speedTimeMultiplier = sourceState.speedTimeMultiplier,

                destinationState.nosePosition = sourceState.nosePosition,
                destinationState.noseMultiplier = sourceState.noseMultiplier,
                destinationState.isTrackFinished = sourceState.isTrackFinished,
                destinationState.finishTime = sourceState.finishTime,

                destinationState.combinedSpeed = sourceState.combinedSpeed,
                destinationState.distanceTravelled = sourceState.distanceTravelled,
                destinationState.averageSpeed = sourceState.averageSpeed,
                destinationState.averageSpeedAtTrackEnd = sourceState.averageSpeedAtTrackEnd,
                destinationState.prevAverageSpeed = sourceState.prevAverageSpeed
        }

        function printState(state) {
            console.log(String("frame: " + state.frame))

            console.log(String("raceTime: " + state.raceTime))
            console.log(String("speedValue: " + state.speedValue))
            console.log(String("baseSpeed: " + state.baseSpeed))
            console.log(String("boostCharge: " + state.boostCharge))

            console.log(String("heat: " + state.heat))
            console.log(String("boostValue: " + state.boostValue))
            console.log(String("boostSpeed: " + state.boostSpeed))
            console.log(String("isBoosting: " + state.isBoosting))
            console.log(String("isBoostStart: " + state.isBoostStart))
            console.log(String("isBoostStartEnded: " + state.isBoostStartEnded))

            console.log(String("speedTimeMultiplier: " + state.speedTimeMultiplier))

            console.log(String("nosePosition: " + state.nosePosition))
            console.log(String("noseMultiplier: " + state.noseMultiplier))
            console.log(String("isTrackFinished: " + state.isTrackFinished))
            console.log(String("finishTime: " + state.finishTime))

            console.log(String("combinedSpeed: " + state.combinedSpeed))
            console.log(String("distanceTravelled: " + state.distanceTravelled))
            console.log(String("averageSpeed: " + state.averageSpeed))
            console.log(String("averageSpeedAtTrackEnd: " + state.averageSpeedAtTrackEnd))
            console.log(String("prevAverageSpeed: " + state.prevAverageSpeed))
        }

        //speed functions
        function incrementFrame(state, injectedBoostFrame) {
            state.frame++
            state.raceTime = (state.frame + 1) * frameTime

            //booststart
            {
                if (!state.isBoostStartEnded && state.isBoostStart && state.combinedSpeed > 290) { //boost start ends at 290 ASU
                    state.isBoostStartEnded = true
                    state.isBoostStart = false
                }
            }

            //check if should boost
            {
                //boost charge
                if (state.combinedSpeed >= podStats.statSpeed * 0.75) { //cannot boost below 75% max base speed
                    state.boostCharge = Math.min(Math.max(state.boostCharge + frameTime, 0), 1) //1 second to charge boost
                }
                //toggle boost
                var prevIsBoosting = state.isBoosting
                if (state.heat + (podStats.statCoolRate * frameTime) >= maxAllowedHeat && state.boostCharge == 1) { //boost if boost is ready
                    state.isBoosting = true
                } else if (state.isBoosting && state.heat - (podStats.statHeatRate * frameTime) > 0) { //boost until heat == 0
                    state.isBoosting = true
                } else if (state.frame == injectedBoostFrame) { //manually boost on frame
                    state.isBoosting = true
                } else {
                    state.isBoosting = false
                }

                if (!prevIsBoosting && state.isBoosting) { //boost just started
                    //lastBoostStartFrame = state.frame
                    overwriteState(state, stateLastBoostStart)
                }
                else if (prevIsBoosting && !state.isBoosting) { //boost just ended
                    //lastBoostEndFrame = state.frame -1
                    overwriteState(state, stateLastBoostEnd)
                }
            }

            //base speed
            {
                state.speedTimeMultiplier = (state.isBoosting || state.isBoostStart) ? 4.0 : 1.5 //1.5 normally, 4.0 during boost start or boost
                state.speedValue += state.noseMultiplier * frameTime * state.speedTimeMultiplier
                state.baseSpeed = calculateBaseSpeed(state.speedValue) //where base speed is calculated
            }
            
            //handle the effects of boost
            {
                if (state.isBoosting) {
                    state.boostValue += 1.5 * frameTime //boosting
                    state.heat -= podStats.statHeatRate * frameTime
                }
                else {
                    if (state.boostValue >= 0.001) { //decelerating
                        state.boostValue *= (1 - (33.33 * frameTime / (33.33 * frameTime + 5)))
                    }
                    else state.boostValue = 0 //no boost
                    state.heat += podStats.statCoolRate * frameTime
                }
                state.heat = Math.min(Math.max(state.heat, 0), 100)
                state.boostSpeed = calculateBoostSpeed(state.boostValue)
            }

            state.combinedSpeed = state.baseSpeed + state.boostSpeed //actual pod speed

            //track stuff
            {
                state.distanceTravelled += state.combinedSpeed * frameTime
                state.prevAverageSpeed = state.averageSpeed
                state.averageSpeed = state.distanceTravelled / state.raceTime
                lastAverageSpeedIncreaseFrame = (state.averageSpeed > state.prevAverageSpeed) ? state.frame : lastAverageSpeedIncreaseFrame

                var prevIsTrackFinished = state.isTrackFinished
                state.isTrackFinished = state.distanceTravelled >= trackLength ? true : false
                if (!prevIsTrackFinished && state.isTrackFinished) { //track just ended
                    //lastTrackEndFrame = state.frame
                    state.finishTime = calculateFinishTime(state)
                    state.averageSpeedAtTrackEnd = state.averageSpeed
                    overwriteState(state, stateTrackEndFrame)
                }
            }
        }
        
        function calculateBaseSpeed(speedValue) { //calculates base speed (before boost speed)
            return speedValue * podStats.statSpeed / (podStats.statAccel + speedValue)
        }

        function calculateBoostSpeed(boostValue) { //calculates bonus boost speed (before being combined with base speed)
            return boostValue * podStats.statThrust / (boostValue + 0.33)
        }

        function calculateFinishTime(state) {
            return state.raceTime + (trackLength - state.distanceTravelled) / state.combinedSpeed
        }

        function calculateNoseMultiplier(nosePosition) {
            switch (nosePosition) {
                case 'd': //nose down
                    return 1.32
                case 'u': //nose up
                    return 0.68
                default: //generally this is 'n'
                    return 1.0
            }
        }

        //pod stats
        function getPodStats(index) {
            podStats.statSpeed = module.exports.upgradeTopSpeed(racers[index].max_speed, upgradeLevel)
            podStats.statThrust = racers[index].boost_thrust
            podStats.statAccel = module.exports.upgradeAcceleration(racers[index].acceleration, upgradeLevel)
            podStats.statCoolRate = module.exports.upgradeCooling(racers[index].cool_rate, upgradeLevel)
            podStats.statHeatRate = racers[index].heat_rate
        }
    }


}

//module.exports.simulateSpeed(0, 60, 5)
//console.log(String(module.exports.simulateSpeed()))