const { difficulties } = require('./data/difficulty.js');
const { WhyNobodyBuy } = require('./data/discord/emoji.js');
const { errorMessage } = require('./data/flavor/error.js');
const { upgradeCooling, upgradeTopSpeed, avgSpeed } = require('./data/sw_racer/part.js')
const { EmbedBuilder } = require('discord.js');

const cache = require('./cache');

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

exports.getTrackById = function (trackId) {
    return cache.tracks.find(track => track.id === trackId);
}

exports.getRacerById = function (racerId) {
    return cache.racers.find(racer => racer.id === racerId);
}

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

    if (!str) {
        return ""
    }

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
    if (!string) {
        return ""
    }
    return string.split(" ").filter(word => word).map(word => word[0].toUpperCase() + word.slice(1)).join(" ")
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

exports.getRacerName = function (racerId) {
    if (Array.isArray(racerId)) {
        return racerId.map(i => exports.getRacerName(i)).join(", ")
    }

    if ([null, undefined, ""].includes(racerId)) {
        return '--'
    }

    const racer = exports.getRacerById(racerId)

    if (!racer) {
        return '--'
    }

    return `${racer.flag} ${racer.name}`
}
exports.getRacerEmbed = function (racer) {
    var Tier = ["Top", "High", "Mid", "Low"]
    var boost = racer.boost_thrust
    var heatrate = racer.heat_rate
    var coolrate = upgradeCooling(racer.cool_rate, 5)
    var topspeed = upgradeTopSpeed(racer.max_speed, 5)
    var avgspeedmu = avgSpeed(topspeed, boost, heatrate, coolrate)
    var avgspeednu = avgSpeed(racer.max_speed, boost, heatrate, racer.cool_rate)
    const racerEmbed = new EmbedBuilder()
        .setURL("https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit#gid=0")
        .setThumbnail(racer.img)
        .setColor('#00DE45')
        .setTitle(exports.getRacerName(racer))
        .setDescription(racer.intro)
        .addFields(
            { name: "Pod", value: racer.pod, inline: false },
            { name: "Species: " + racer.species, value: "Homeworld: " + racer.homeworld, inline: true },
            { name: "Favorite", value: exports.getTrackName(racer.favorite), inline: true },
            { name: "Voice Actor", value: racer.voice, inline: true },
            { name: "Tier", value: "NU: " + Tier[racer.nu_tier] + "\nMU: " + Tier[racer.mu_tier], inline: true },
            { name: "Average Speed", value: "NU: " + Math.round(avgspeednu) + "\nMU: " + Math.round(avgspeedmu), inline: true },
            { name: "Max Turn", value: racer.max_turn_rate + "°/s", inline: true }
        )
        .setImage(racer.stats)
    return racerEmbed
}
exports.getTrackName = function (trackId) {
    if (Array.isArray(trackId)) {
        return trackId.map(i => exports.getTrackName(i)).join(", ")
    }

    if ([null, undefined, ""].includes(trackId)) {
        return '--'
    }

    const track = exports.getTrackById(trackId)

    if (!track) {
        return '--'
    }

    return `${track.planet.emoji} ${track.name}`
}
exports.getCircuitName = function (circuit) {

    if ([null, undefined, ""].includes(circuit)) {
        return '--'
    }

    return `${circuit.name}`
}
exports.getPlanetName = function (planet) {
    if ([null, undefined, ""].includes(planet)) {
        return '--'
    }

    return `${planet.emoji} ${planet.name}`
}
exports.getTrackEmbed = function (track) {
    const trackEmbed = new EmbedBuilder()
        .setColor(track.planet.color)
        .setURL("https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit#gid=1682683709")
        .setImage(track.img)
        .setTitle(track.planet.emoji + " " + track.name)
        .setThumbnail(track.preview)
        .setDescription("(" + track.nickname.join(", ") + ")")
        .addFields(
            { name: track.circuit.name + " Circuit", value: "Race " + track.cirnum, inline: true },
            { name: "Planet", value: exports.getPlanetName(track.planet), inline: true },
            { name: "Host", value: track.planet.host, inline: true },
            { name: "Track Favorite", value: exports.getRacerName(track.favorite), inline: true },
            { name: "Difficulty", value: difficulties[track.difficulty].name, inline: true },
            { name: "Length", value: track.lengthclass, inline: true }
        )
    return trackEmbed
}
exports.partEmbed = function (part) {
    const partEmbed = new EmbedBuilder()
        .setColor('#00DE45')
        .setTitle(part.name)
        .addFields(
            { name: "Level", value: String(part.level), inline: true },
            { name: "Price", value: exports.number_with_commas(part.price), inline: true },
            { name: "Stat", value: String(part.stat), inline: true },
        )
    return partEmbed
}

exports.getRandomElement = function (arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error("Input must be a non-empty array.");
    }
    return arr[Math.floor(Math.random() * arr.length)];
}

exports.randomErrorMessage = function () {
    return `${WhyNobodyBuy} ${exports.getRandomElement(errorMessage)}`
}

exports.arraysHaveSameElements = function (arr1, arr2) {
    if (arr1.length !== arr2.length) return false;

    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();

    for (let i = 0; i < sorted1.length; i++) {
        if (sorted1[i] !== sorted2[i]) return false;
    }

    return true;
}