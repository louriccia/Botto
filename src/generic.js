const { racers } = require('./data/sw_racer/racer.js')
const { tracks } = require('./data/sw_racer/track.js')
const { planets } = require('./data/sw_racer/planet.js')
const { circuits } = require('./data/sw_racer/circuit.js')

const big_number_abbreviations = [
    {
        "abbr": "K",
        "name": "Thousand",
        "val": 10 ** 3
    },
    {
        "abbr": "M",
        "name": "Million",
        "val": 10 ** 6
    },
    {
        "abbr": "B",
        "name": "Billion",
        "val": 10 ** 9
    },
    {
        "abbr": "T",
        "name": "Trillion",
        "val": 10 ** 12
    },
    {
        "abbr": "Qa",
        "name": "Quadrillion",
        "val": 10 ** 15
    },
    {
        "abbr": "Qi",
        "name": "Quintillion",
        "val": 10 ** 18
    },
    {
        "abbr": "Sx",
        "name": "Sextillion",
        "val": 10 ** 21
    },
    {
        "abbr": "Sp",
        "name": "Septillion",
        "val": 10 ** 24
    },
    {
        "abbr": "Oc",
        "name": "Octillion",
        "val": 10 ** 27
    },
    {
        "abbr": "No",
        "name": "Nonillion",
        "val": 10 ** 30
    },
    {
        "abbr": "Dc",
        "name": "Decillion",
        "val": 10 ** 33
    },
    {
        "abbr": "Ud",
        "name": "Undecillion",
        "val": 10 ** 36
    },
    {
        "abbr": "Dd",
        "name": "Duodecillion",
        "val": 10 ** 39
    },
    {
        "abbr": "Td",
        "name": "Tredecillion",
        "val": 10 ** 42
    },
    {
        "abbr": "Qad",
        "name": "Quattuordecillion",
        "val": 10 ** 45
    },
    {
        "abbr": "Qid",
        "name": "Quindecillion",
        "val": 10 ** 48
    },
    {
        "abbr": "Sxd",
        "name": "Sexdecillion",
        "val": 10 ** 51
    },
    {
        "abbr": "Spd",
        "name": "Septendecillion",
        "val": 10 ** 54
    },
    {
        "abbr": "Ocd",
        "name": "Octodecillion",
        "val": 10 ** 57
    },
    {
        "abbr": "Nod",
        "name": "novemdecillion",
        "val": 10 ** 60
    },
    {
        "abbr": "Vg",
        "name": "vigintillion",
        "val": 10 ** 63
    },
    {
        "abbr": "Uvg",
        "name": "unvigintillion",
        "val": 10 ** 66
    }
]

exports.big_number = function (x) {

    let big_number = ""
    for (let i = 0; i < big_number_abbreviations.length; i++) {
        if (x >= big_number_abbreviations[i].val) {
            if (x % big_number_abbreviations[i].val == 0) {
                big_number = `${(x / big_number_abbreviations[i].val)}${big_number_abbreviations[i].abbr}`
            } else {
                big_number = `${(x / big_number_abbreviations[i].val).toFixed(1)}${big_number_abbreviations[i].abbr}`
            }
        }
    }

    if (!big_number) {
        big_number = exports.number_with_commas(x)
    }

    return big_number
}

exports.truncateString = function (str, maxLength) {
    if (str.length <= maxLength) {
        return str;
    }

    const ellipsis = '...';
    const truncatedLength = maxLength - ellipsis.length;

    if (truncatedLength <= 0) {
        return ellipsis;  // if maxLength is less than or equal to the length of ellipsis
    }

    return str.slice(0, truncatedLength) + ellipsis;
}

exports.number_with_commas = function (x) {
    return x?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

exports.capitalize = function (string) {
    return string.split(" ").map(word => word[0].toUpperCase() + word.slice(1)).join(" ")
}
exports.time_fix = function (time) {
    if (time == "DNF") {
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
}
exports.time_to_seconds = function (time) {
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


}
exports.find_time = function (str) {
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
}

exports.ordinalSuffix = function (i) {
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
}

exports.getRacerName = function (index) {
    if (Array.isArray(index)) {
        return index.map(i => exports.getRacerName(i)).join(", ")
    }
    return [null, undefined, ""].includes(index) ? '--' : `${racers[index]?.flag} ${racers[index]?.name}`
}
exports.getRacerEmbed = function (numb) {
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
}
exports.getTrackName = function (index) {
    if (Array.isArray(index)) {
        return index.map(i => exports.getTrackName(i)).join(", ")
    }
    return [null, undefined, ""].includes(index) ? '--' : `${planets[tracks[index]?.planet]?.emoji} ${tracks[index]?.name}`
}
exports.getCircuitName = function (index) {
    return [null, undefined, ""].includes(index) ? '--' : `${circuits[index]?.name}`
}
exports.getPlanetName = function (index) {
    return [null, undefined, ""].includes(index) ? '--' : `${planets[index]?.emoji} ${planets[index]?.name}`
}
exports.getTrackEmbed = function (numb, client, channel, interaction) {
    const Discord = require('discord.js');
    const fetch = require('node-fetch');
    const trackEmbed = new Discord.MessageEmbed()
        //.setThumbnail(planets[tracks[numb].planet].img)
        //.setFooter(footer)
        .setColor(planets[tracks[numb].planet].color)
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
}


