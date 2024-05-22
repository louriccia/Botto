const { tracks } = require('../data/sw_racer/track.js')
const { circuits } = require('../data/sw_racer/circuit.js')
const { planets } = require('../data/sw_racer/planet.js')

const { EmbedBuilder } = require('discord.js');

exports.leaderboard = async function ({ interaction } = {}) {
    const unAvailable = new EmbedBuilder()
        .setTitle("<:WhyNobodyBuy:589481340957753363> I have great faith in the boy")
        .setDescription("Leaderboards are currently unavailable. Please harass LightningPirate to get this feature updated.")
    interaction.reply({ embeds: [unAvailable], ephemeral: true })
    return
    const challengeLeaderboard = new EmbedBuilder()
    var track = Math.floor(Math.random() * 25)
    var conditions = []
    var pods = []
    var showall = false
    //filters out other tracks
    if (!args.includes("initial")) {
        for (var i = 0; i < interaction.message.components[0].components[0].options.length; i++) { //track
            var option = interaction.message.components[0].components[0].options[i]
            if (option.hasOwnProperty("default")) {
                if (option.default) {
                    track = i
                }
            }
        }
        for (var i = 0; i < interaction.message.components[1].components[0].options.length; i++) { //conditions
            var option = interaction.message.components[1].components[0].options[i]
            if (option.hasOwnProperty("default")) {
                if (option.default) {
                    conditions.push(option.value)
                }
            }
        }
        for (var i = 0; i < interaction.message.components[2].components[0].options.length; i++) { //pods
            var option = interaction.message.components[2].components[0].options[i]
            if (option.hasOwnProperty("default")) {
                if (option.default) {
                    pods.push(String(i))
                }
            }
        }
        if (args[2] == "track") {
            track = Number(interaction.data.values[0])
        } else if (args[2] == "conditions") {
            if (interaction.data.hasOwnProperty("values")) {
                conditions = interaction.data.values
            }
        } else if (args[2] == "pods") {
            if (interaction.data.hasOwnProperty("values")) {
                pods = interaction.data.values
            } else {
                pods = []
            }
        }
    }
    if (conditions.length == 0) {
        conditions = ["mu", "nu", "ft", "skips", "unmirr", "mirr", "lap3"]
    }
    //prepare filters
    var nu = [], skips = [], mirrored = [], laps = [], user = null
    if (conditions.includes("mu")) {
        nu.push(false)
    }
    if (conditions.includes("nu")) {
        nu.push(true)
    }
    if (conditions.includes("ft")) {
        skips.push(false)
    }
    if (conditions.includes("skips")) {
        skips.push(true)
    }
    if (conditions.includes("unmirr")) {
        mirrored.push(false)
    }
    if (conditions.includes("mirr")) {
        mirrored.push(true)
    }
    if (conditions.includes("lap1")) {
        laps.push(1)
    }
    if (conditions.includes("lap2")) {
        laps.push(2)
    }
    if (conditions.includes("lap3")) {
        laps.push(3)
    }
    if (conditions.includes("lap4")) {
        laps.push(4)
    }
    if (conditions.includes("lap5")) {
        laps.push(5)
    }
    if (conditions.includes("user")) {
        user = member_id
    }
    //account for missing values
    if (nu.length == 0) { nu.push(true, false), conditions.push("mu", "nu") }
    if (skips.length == 0) { skips.push(true, false), conditions.push("ft", "skips") }
    if (mirrored.length == 0) { mirrored.push(true, false), conditions.push("unmirr", "mirr") }
    if (laps.length == 0) { laps.push(1, 2, 3, 4, 5), conditions.push("lap1", "lap2", "lap3", "lap4", "lap5") }
    //filter
    var challenge = Object.values(db.ch.challenges)
    var challengefiltered = challenge.filter(element => element.track == track)
    challengefiltered = challengefiltered.filter(element => skips.includes(element.skips))
    challengefiltered = challengefiltered.filter(element => nu.includes(element.nu))
    challengefiltered = challengefiltered.filter(element => laps.includes(element.laps))
    challengefiltered = challengefiltered.filter(element => mirrored.includes(element.mirror))
    if (pods.length > 0) {
        challengefiltered = challengefiltered.filter(element => pods.includes(String(element.racer)))
    }
    if (user !== null) {
        challengefiltered = challengefiltered.filter(element => element.user == user)
    }
    challengefiltered.sort(function (a, b) {
        return a.time - b.time;
    })
    //construct embed
    challengeLeaderboard
        .setAuthor("Random Challenge", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png")
        .setTitle(planets[tracks[track].planet].emoji + " " + tracks[track].name)
        .setColor(planets[tracks[track].planet].color)
        .setDescription(circuits[tracks[track].circuit].name + " Circuit | Race " + tracks[track].cirnum + " | " + planets[tracks[track].planet].name)
        .setFooter({ text: challengefiltered.length + " Total Runs" })
    if (user !== null) {
        challengeLeaderboard.setAuthor(Member.user.username + "'s Best", client.guilds.resolve(interaction.guildId).members.resolve(user).user.avatarURL())
        showall = true
    }
    var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
    var already = []
    if (challengefiltered.length > 0) {
        for (var j = 0; j < challengefiltered.length; j++) {
            if (!already.includes((challengefiltered[j].player + " " + challengefiltered[j].skips + " " + challengefiltered[j].racer + " " + challengefiltered[j].nu + " " + challengefiltered[j].laps + " " + challengefiltered[j].mirror)) || showall) {
                var stuff = []
                stuff.push(challengefiltered[j].laps + " Laps")
                var upgr = " | MU"
                if (challengefiltered[j].skips == true) {
                    stuff.push("Skips")
                } else {
                    stuff.push("FT")
                }
                if (challengefiltered[j].nu == true) {
                    upgr = " | NU"
                }
                if (challengefiltered[j].mirror == true) {
                    stuff.push("Mirrored")
                }
                var character = racers[challengefiltered[j].racer].flag //+ " " + racers[challengefiltered[j].racer].name
                challengeLeaderboard
                    .addField(pos[0] + " " + challengefiltered[j].name, stuff.join(" | "), true)
                    .addField(tools.timefix(Number(challengefiltered[j].time).toFixed(3)), " " + character + upgr, true)
                    .addField('\u200B', '\u200B', true)
                already.push(challengefiltered[j].player + " " + challengefiltered[j].skips + " " + challengefiltered[j].racer + " " + challengefiltered[j].nu + " " + challengefiltered[j].laps + " " + challengefiltered[j].mirror)
                if (pos.length > 1) {
                    pos.splice(0, 1)
                } else {
                    j = challengefiltered.length
                }
            }
        }
    } else {
        challengeLeaderboard
            .addField("<:WhyNobodyBuy:589481340957753363> No Runs", "`No runs were found matching that criteria`\n" + errorMessage[Math.floor(Math.random() * errorMessage.length)])
    }
    //construct components

    var cond = { mu: "Upgrades", nu: "No Upgrades", ft: "Full Track", skips: "Skips", unmirr: "Unmirrored", mirr: "Mirrored", lap1: "1-Lap", lap2: "2-Laps", lap3: "3-Laps", lap4: "4-Laps", lap5: "5-Laps", user: "My Runs Only" }
    var track_selections = []
    var racer_selections = []
    var cond_selections = []
    for (var i = 0; i < 25; i++) {
        var racer_option = {
            label: racers[i].name,
            value: i,
            description: racers[i].pod.substring(0, 50),
            emoji: {
                name: racers[i].flag.split(":")[1],
                id: racers[i].flag.split(":")[2].replace(">", "")
            }
        }
        if (pods.includes(String(i))) {
            racer_option.default = true
        }
        var track_option = {
            label: tracks[i].name.replace("The Boonta Training Course", "Boonta Training Course"),
            value: i,
            description: (circuits[tracks[i].circuit].name + " Circuit | Race " + tracks[i].cirnum + " | " + planets[tracks[i].planet].name).substring(0, 50),
            emoji: {
                name: planets[tracks[i].planet].emoji.split(":")[1],
                id: planets[tracks[i].planet].emoji.split(":")[2].replace(">", "")
            }
        }
        if (track == i) {
            track_option.default = true
        }
        if (i < 23) {
            racer_selections.push(racer_option)
        }
        track_selections.push(track_option)
        var condkeys = Object.keys(cond)
        if (i < condkeys.length) {
            var cond_option = {
                label: cond[condkeys[i]],
                value: condkeys[i],
            }
            if (conditions.includes(condkeys[i])) {
                cond_option.default = true
            }
            cond_selections.push(cond_option)
        }
    }
    components.push(
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: "challenge_random_leaderboards_track",
                    options: track_selections,
                    placeholder: "Select Track",
                    min_values: 1,
                    max_values: 1
                },
            ]
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: "challenge_random_leaderboards_conditions",
                    options: cond_selections,
                    placeholder: "Select Conditions",
                    min_values: 0,
                    max_values: cond_selections.length
                },
            ]
        },
        {
            type: 1,
            components: [
                {
                    type: 3,
                    custom_id: "challenge_random_leaderboards_pods",
                    options: racer_selections,
                    placeholder: "Select Pods",
                    min_values: 0,
                    max_values: racer_selections.length
                }
            ]
        },
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 2,
                    custom_id: "challenge_random_menu",
                    emoji: {
                        name: "menu",
                        id: "862620287735955487"
                    }
                }
            ]
        }
    )
    interaction.editReply({ embeds: [challengeLeaderboard], components: components })
}