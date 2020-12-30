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
        if (time.includes(":")){
            var split = time.split(':')
            if (split.length = 2) {
                var out = Number(split[0]*60)+Number(split[1])
                if (Number(split[1]) >= 60) {
                    return null
                } else {
                    return out
                }
            } else {
                return null
            }
            
        } else {
            return time
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
    }
}