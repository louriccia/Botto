const { racers } = require("../../data/sw_racer/racer")
const { tracks } = require("../../data/sw_racer/track")
const { upgradeAcceleration, upgradeTopSpeed, upgradeCooling } = require("../../data/sw_racer/part")

exports.getGoalTime = function ({ track, racer, acceleration, top_speed, cooling, laps, length_mod, uh_mod, us_mod, deaths } = {}) {
    //0. get required values
    var accel = upgradeAcceleration(racers[racer].acceleration, acceleration)
    var topspeed = upgradeTopSpeed(racers[racer].max_speed, top_speed)
    var thrust = 1.32
    var heatrate = racers[racer].heat_rate
    var coolrate = upgradeCooling(racers[racer].cool_rate, cooling)
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
}