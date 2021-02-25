module.exports = {
    
    timefix: function(time) {
        var myformat = new Intl.NumberFormat('en-US', { 
            minimumIntegerDigits: 2, 
            minimumFractionDigits: 3 
        });
        if (time >= 3600) {
            var hours = Math.floor(time/3600)
            var minutes = Math.floor((time-hours*3600)/60)
            if (minutes < 10) {
                minutes = "0" + minutes
            }
            var seconds = (time - hours*3600 - minutes * 60).toFixed(3)
            return hours.toString() + ":" + minutes.toString() + ":" + myformat.format(seconds)
        } else if (time >= 60) {
            var minutes = Math.floor(time/60)
            var seconds = (time - minutes * 60).toFixed(3)
            return minutes.toString() + ":" + myformat.format(seconds)
        } else {
            return Number(time).toFixed(3)
        }
    },
    timetoSeconds: function(time) {
        var myformat = new Intl.NumberFormat('en-US', { 
            minimumIntegerDigits: 2, 
            minimumFractionDigits: 3 
        });
        if (time.includes(":")){
            var split = time.split(':')
            if (split.length = 2) {
                var out = Number(split[0]*60)+Number(split[1])
                if (Number(split[1]) >= 60) {
                    return null
                } else {
                    return Number(myformat.format(out)).toFixed(3)
                }
            } else {
                return null
            }
            
        } else {
            return Number(myformat.format(time)).toFixed(3)
        }
        
    },
    findTime: function(str) {
        var time = ""
        var time_begin = -1
        var time_length = 0
        for (let i =0; i<str.length; i++) {
            if(Number.isInteger(parseInt(str.charAt(i)))) {
                for (let j = 1; j<9; j++) {
                    if (Number.isInteger(parseInt(str.charAt(i+j))) || str.charAt(i+j) == ":" || str.charAt(i+j) == ".") {
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
            time = str.substring(time_begin, time_begin+time_length+1)
            if (time.length > 6 && !time.includes(":")) {
                time = ""
            }
            if (time.length > 4 && !time.includes(".")) {
                time = ""
            }
        }
        return time
    }, 
    upgradeTraction: function(base, upg) {
        return Math.min(1, base + upg*0.05)
    }, 
    upgradeTurning: function(base, upg) {
        if(upg < 5){
            return base + upg*116
        } else {
            return base + (upg-1)*116+114
        }
    }, 
    upgradeAcceleration: function(base, upg) {
        return base - 0.14*base*upg
    }, 
    upgradeTopSpeed: function(base, upg) {
        return Math.min(base + 40*upg, 650)
    }, 
    upgradeAirBrake: function(base, upg) {
        var brake = base
        if(upg > 0){
            brake = brake - base*0.08
        }
        if(upg > 1){
            brake = brake - base*0.09*upg
        }
        return brake
    }, 
    upgradeCooling: function(base, upg) {
        return(base+upg*1.6)
    }, 
    upgradeRepair: function(base, upg) {
        if(upg < 5){
            return(Math.min(1, base+upg*0.1))
        } else {
            return(Math.min(1, base+(upg-1)*0.1 + 0.05))
        }
    }, 
    avgSpeed: function(topspeed, boost, heatrate, coolrate) {
        var boostdistance = (boost/50)*(50*(100/heatrate)-11*Math.log(Math.abs(50*(100/heatrate)+11)))-(boost/50)*(50*(0)-11*Math.log(Math.abs(50*(0)+11))) 
        var avgboost = boostdistance/(100/heatrate)
        var e19 = 1-(3333/(100*45*((3333/(100*45))+5))) 
        var cooldistance = boost*Math.log(Math.abs(11*e19**(45*(100/heatrate))*heatrate+7500*e19**(45*(100/heatrate+100/coolrate))))/(Math.log(e19)*45)-boost*Math.log(Math.abs(11*e19**(45*(100/heatrate))*heatrate+7500*e19**(45*(100/heatrate))))/(Math.log(e19)*45)
        var avgcool = cooldistance/(100/coolrate)
        var avgspeed = ((100/heatrate)*(topspeed+avgboost)+(100/coolrate)*(topspeed+avgcool))/(100/heatrate+100/coolrate)
        return avgspeed
    },
    getRacerEmbed: function(numb) {
        var Tier = ["Top", "High", "Mid", "Low"]
        var boost = racers[numb].boost_thrust
        var heatrate = racers[numb].heat_rate
        var coolrate = this.upgradeCooling(racers[numb].cool_rate, 5)
        var topspeed = this.upgradeTopSpeed(racers[numb].max_speed, 5)
        var avgspeedmu = this.avgSpeed(topspeed,boost,heatrate,coolrate)
        var avgspeednu = this.avgSpeed(racers[numb].max_speed,boost,heatrate,racers[numb].cool_rate)
        const racerEmbed = new Discord.MessageEmbed()
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].flag + " " + racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .addField("Pod", racers[numb].Pod, false)
            .addField("Species: " + racers[numb].species, "Homeworld: " + racers[numb].homeworld, true)
            .addField("Favorite", tracks[racers[numb].favorite].name, true)
            .addField("Voice Actor", racers[numb].voice, true)
            .addField("Tier", Tier[racers[numb].nu_tier] + " | " + Tier[racers[numb].mu_tier], true)
            .addField("Average Speed", Math.round(avgspeednu) + " | " + Math.round(avgspeedmu), true)
            .addField("Max Turn", racers[numb].max_turn_rate + "°/s", true)
            .setImage(racers[numb].stats)
        return racerEmbed
    }
}