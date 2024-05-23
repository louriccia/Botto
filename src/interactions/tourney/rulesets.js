const { time_fix } = require("../../generic")

let type = 7
            if (args.includes("initial")) {
                type = 4
            }
            let flags = 0
            let components = []
            const rulesetEmbed = new EmbedBuilder()
                .setAuthor("Tournaments", "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/trophy_1f3c6.png")

            let emojis = {
                "1v1": "🆚",
                "1vAll": "👑",
                "Qualifier": "⏳",
                "RTA": "⏱️"
            }

            function showRuleset(ruleset) {
                let conditions = {
                    mu: "Upgrades Allowed",
                    nu: "No Upgrades",
                    ft: "Full Track",
                    sk: "Skips",
                    pb: "Pod Ban",
                    pc: "Pod Choice",
                    um: "Unmirrored",
                    mi: "Mirrored",
                    l1: "1 Lap",
                    l2: "2 Laps",
                    l3: "3 Laps",
                    l4: "4 Laps",
                    l5: "5 Laps",
                    fl: "Fast Lap",
                    tt: "Total Time",
                    ng: "New Game",
                    ngp: "New Game +"
                }

                let methods = {
                    poe: "Process of Elimination",
                    chance_cube: "Chance Cube",
                    random: "Random",
                    player_pick: "Player's Pick",
                    disabled: "Disabled",
                    winners_pick: "Winner's Pick",
                    losers_pick: "Loser's Pick",
                    salty_runback: "Salty Runback",
                    saltier_runback: "Saltier Runback",
                    saltiest_runback: "Saltiest Runback",
                    any: "Any Condition",
                    random_mirrored: "Random Mirrored",
                    limited_choice: "Limited Choice",
                    random_limited_choice: "Random Limited Choice",
                    pod_pool: "Pod Pool",
                    winners_either: "Winner's Either/Or",
                    losers_either: "Loser's Either/Or",
                    win: "Earned via Win",
                    loss: "Earned via Loss",
                    either_or: "Either/Or",
                    no_limit: "No Match Limit",
                    lower: "Lower Rated",
                    higher: "Higher Rated",
                    default_repeat: "Default Repeat",
                    soft_repeat: "Soft Repeat",
                    hard_repeat: "Hard Repeat",
                    favorite: "Track Favorite",
                    random_tier: "Random by Tier"
                }

                let permabans = [
                    {
                        name: "Pod",
                        command: "permapodban",
                        method: "ppodmethod",
                        limit: "ppodlimit"
                    },
                    {
                        name: "Track",
                        command: "permatrackban",
                        method: "ptrackmethod",
                        limit: "ptracklimit"
                    },
                    {
                        name: "Condition",
                        command: "permaconban",
                        method: "pconmethod",
                        limit: "pconlimit"
                    }
                ]

                let tempbans = [
                    {
                        name: "Pod",
                        command: "temppodban",
                        method: "tpodmethod",
                        limit: "tpodlimit",
                        mlimit: "tpodmlimit"
                    },
                    {
                        name: "Track",
                        command: "temptrackban",
                        method: "ttrackmethod",
                        limit: "ttracklimit",
                        mlimit: "ttrackmlimit"
                    },
                    {
                        name: "Condition",
                        command: "tempconban",
                        method: "tconmethod",
                        limit: "tconlimit",
                        mlimit: "tconmlimit"
                    }
                ]
                function podSelection(collection) {
                    let result = ""
                    if (collection.length == 23) {
                        result = "`Any Pod`"
                    } else {
                        let pods = []
                        let missing_pods = []
                        for (let p = 0; p < 23; p++) {
                            if (collection.includes(String(p))) {
                                pods.push(racers[p].flag)
                            } else {
                                missing_pods.push("No " + racers[p].flag)
                            }
                        }
                        if (missing_pods.length < pods.length) {
                            result = missing_pods.join(", ")
                        } else {
                            result = pods.join(" ")
                        }
                    }
                    return result
                }

                if (ruleset.type == "1v1") {

                    function trackSelection(collection) {
                        let amc = 0, spc = 0, gal = 0, inv = 0
                        let result = ""
                        let first_nicks = []
                        let missing = []
                        for (i = 0; i < 25; i++) {
                            if (collection.includes(String(i))) {
                                if (collection[i] >= 0 && collection[i] < 7) {
                                    amc++
                                }
                                if (collection[i] >= 7 && collection[i] < 14) {
                                    spc++
                                }
                                if (collection[i] >= 14 && collection[i] < 21) {
                                    gal++
                                }
                                if (collection[i] >= 21 && collection[i] < 25) {
                                    inv++
                                }
                                first_nicks.push("`" + tracks[i].nickname[0] + "`")
                            } else {
                                missing.push("~~`" + tracks[i].nickname[0] + "`~~")
                            }

                        }

                        if (collection.length == 25) {
                            result = "`Any Track`"
                        } else if ((collection.length == 7 && [amc, spc, gal].includes(7)) || collection.length == 4 && inv == 4) {
                            if (amc == 7) {
                                result = "`Amateur Circuit`"
                            } else if (spc == 7) {
                                result = "`Semi-Pro Circuit`"
                            } else if (gal == 7) {
                                result = "`Galactic Circuit`"
                            } else if (inv == 4) {
                                result = "`Invitational Circuit`"
                            }
                        } else {
                            if (missing.length < first_nicks.length) {
                                result = missing.join(" ")
                            } else {
                                result = first_nicks.join(" ")
                            }
                        }
                        return result
                    }

                    rulesetEmbed
                        .setDescription("Ruleset Type: 🆚 1v1" + "\n" + ruleset.description)
                    let fields = []
                    //wins
                    let field = {}
                    field.name = ":trophy: Win Condition"
                    let winstuff = Object.values(ruleset.wins)
                    let winstring = []
                    for (i = 0; i < winstuff.length; i++) {
                        if (winstuff[i].includes("_max")) {
                            winstring.push("`" + winstuff[i].replace("_max", " Wins Max") + "`")
                        } else if (winstuff[i].includes("_min")) {
                            winstring.push("`" + winstuff[i].replace("_min", " Wins Minimum") + "`")
                        } else if (winstuff[i].includes("_row")) {
                            winstring.push("`" + winstuff[i].replace("_row", " Wins in a Row") + "`")
                        } else if (winstuff[i].includes("_by")) {
                            winstring.push("`Win by " + winstuff[i].replace("_by", "") + "`")
                        }
                    }
                    field.value = winstring.join("\n")
                    field.inline = true
                    fields.push(field)
                    //default
                    field = {}
                    field.name = ":eight_spoked_asterisk: Default Conditions"
                    let cond = Object.values(ruleset.default)
                    let cons = []
                    cond.forEach(con => {
                        cons.push("`" + conditions[con] + "`")
                    })
                    field.value = cons.join(" ")
                    field.inline = true
                    fields.push(field)
                    //gents
                    field = {}
                    yesno = { disallowed: "Disallowed", allowed: "Allowed" }
                    field.name = ":tophat: Gentleman's Agreement"
                    field.value = "`" + yesno[ruleset.gents] + "`"
                    field.inline = true
                    fields.push(field)
                    //first track
                    field = {}
                    field.name = ":checkered_flag: First Track"
                    field.value = "`" + methods[ruleset.firstmethod] + "`\n"
                    field.value += trackSelection(Object.values(ruleset.firsttrack))
                    field.inline = true
                    fields.push(field)
                    //permabans
                    for (b = 0; b < permabans.length; b++) {
                        if (ruleset[permabans[b].method] !== "disabled") {
                            field = {}
                            field.name = ":no_entry_sign: " + permabans[b].name + " Permaban"
                            field.value = "`" + methods[ruleset[permabans[b].method]] + "`\n"
                            if (ruleset[permabans[b].method] == "random") {
                                field.value += "`" + ruleset[permabans[b].limit] + " Per Match`"
                            } else {
                                field.value += "`" + ruleset[permabans[b].limit] + " Per Player Per Match`"
                            }
                            field.inline = true
                            fields.push(field)
                        }
                    }
                    //tempbans
                    for (b = 0; b < tempbans.length; b++) {
                        if (ruleset[tempbans[b].method] !== "disabled") {
                            field = {}
                            field.name = ":x: " + tempbans[b].name + " Tempban"
                            field.value = "`" + methods[ruleset[tempbans[b].method]] + "`\n"
                            field.value += "`" + ruleset[tempbans[b].limit] + " Max Per Race`\n"
                            if (ruleset[tempbans[b].method] !== "random") {
                                ml = Object.values(ruleset[tempbans[b].mlimit])
                                let ms = []
                                for (i = 0; i < ml.length; i++) {
                                    if (ml[i] == "no_limit") {
                                        ms.push("`No Match Limit`")
                                    } else if (ml[i] == "wins") {
                                        ms.push("`One Per Win`")
                                    } else if (ml[i] == "losses") {
                                        ms.push("`One Per Loss`")
                                    } else {
                                        ms.push("`" + ml[i] + " Per Player Per Match`")
                                    }
                                }
                                field.value += ms.join(" + ")
                            }
                            field.inline = true
                            fields.push(field)
                        }
                    }
                    //track selection
                    field = {}
                    field.name = ":triangular_flag_on_post: Track Selection"
                    field.value = "`" + methods[ruleset.trackmethod] + "`\n"
                    field.value += trackSelection(Object.values(ruleset.tracktracks))
                    field.inline = true
                    fields.push(field)
                    //Repeat Tracks
                    if (ruleset.dupecondition !== "disabled") {
                        field = {}
                        field.name = ":repeat: Repeat Tracks"
                        field.value = "`" + methods[ruleset.dupecondition] + "`\n"
                        field.value += "`" + methods[ruleset.dupestyle] + "`\n"
                        field.value += "`" + ruleset.dupelimit + " Per Player Per Match`"
                        field.inline = true
                        fields.push(field)
                    }
                    //Conditions
                    if (ruleset.conmethod !== "disabled") {
                        field = {}
                        field.name = ":asterisk: Conditions"
                        field.value = "`" + methods[ruleset.conmethod] + "`\n"
                        field.value += "`" + ruleset.conmax + " Max Per Race`\n"
                        if (ruleset.conlimit == "wins") {
                            field.value += "`One Per Win`"
                        } else if (ruleset.conlimit == "losses") {
                            field.value += "`One Per Loss`"
                        } else {
                            field.value += "`" + ruleset.conlimit + " Per Player Per Match`\n"
                        }
                        let cond = Object.values(ruleset.conoptions)
                        let cons = []
                        cond.forEach(con => {
                            cons.push("`" + conditions[con] + "`")
                        })
                        field.value += cons.join(" ")
                        field.inline = true
                        fields.push(field)
                    }
                    //Pod Selection
                    field = {}
                    field.name = "<:Pod1:525755322355417127> Pod Selection"
                    field.value = "`" + methods[ruleset.podmethod] + "`\n"
                    if (ruleset.podmethod == "random_limited_choice") {
                        field.value += "`" + ruleset.rndlimited + " Choices Per Race`\n"
                    } else if (ruleset.podmethod == "pod_pool") {
                        field.value += "`" + ruleset.poollimit + " Uses Per Pod`\n"
                    }
                    let podpods = Object.values(ruleset.podpods)
                    if (podpods.length == 23) {
                        field.value += "`Any Pod`"
                    } else {
                        let pods = []
                        let missing_pods = []
                        for (i = 0; i < 23; i++) {
                            if (podpods.includes(String(i))) {
                                pods.push(racers[i].flag)
                            } else {
                                missing_pods.push("No " + racers[i].flag)
                            }
                        }
                        if (missing_pods.length < pods.length) {
                            field.value += missing_pods.join(", ")
                        } else {
                            field.value += pods.join("")
                        }
                    }
                    field.inline = true
                    fields.push(field)
                    //construct fields
                    return fields
                } else if (["1vAll", "Qualifier", "RTA"].includes(ruleset.type)) {
                    conditions = {
                        mu: "Upgrades Allowed",
                        nu: "No Upgrades",
                        ft: "Full Track",
                        sk: "Skips",
                        mi: "Mirrored",
                        l1: "1 Lap",
                        l2: "2 Laps",
                        l3: "3 Laps",
                        l4: "4 Laps",
                        l5: "5 Laps",
                        fl: "Fast Lap",
                        ng: "New Game",
                        fp: "Free Play",
                        nj: "No Junkyard",
                        ch: "Cheats Allowed"
                    }
                    rulesetEmbed
                        .setDescription("Ruleset Type: " + emojis[ruleset.type] + " " + ruleset.type + "\n" + ruleset.description)
                    let fields = []
                    //default conditions
                    let field = {}
                    field.name = ":eight_spoked_asterisk: Conditions"
                    let cond = Object.values(ruleset.conditions)
                    let cons = []
                    cond.forEach(con => {
                        cons.push("`" + conditions[con] + "`")
                    })
                    field.value = cons.join(" ")
                    field.inline = true
                    fields.push(field)
                    //pod selection
                    field = {}
                    field.name = "<:Pod1:525755322355417127> Pod Selection"
                    field.value = "`" + methods[ruleset.podmethod] + "`\n"
                    if (ruleset.podmethod == "pod_pool") {
                        field.value += "`" + ruleset.poollimit + " Uses Per Pod`"
                    }
                    if (["player_pick", "limited_choice"].includes(ruleset.podmethod)) {
                        field.value += podSelection(Object.values(ruleset.podpods)) + "\n"
                    }
                    field.inline = true
                    fields.push(field)
                    field = { name: '\u200B', value: '\u200B', inline: true }
                    fields.push(field)
                    //races
                    for (i = 0; i < Number(ruleset.racenum); i++) {
                        field = {}
                        field.name = ":triangular_flag_on_post: Race " + (i + 1)
                        field.value = planets[tracks[Number(ruleset.races[i].track)].planet].emoji + " **" + tracks[Number(ruleset.races[i].track)].name + "**\n"

                        if (ruleset.type == "Qualifier") {
                            field.value += "`" + time_fix(ruleset.races[i].time).replace(".000", "") + " Time Limit`\n"
                            field.value += "`" + time_fix(ruleset.races[i].penalty).replace(".000", "") + " Penalty Time`"
                        }
                        field.inline = true
                        fields.push(field)
                    }
                    //construct fields
                    return fields
                }
            }
            let modal = false
            //break if check here in case "refresh" changed to "browse"
            if (args[1] == "browse") { //browse ruleset list
                rulesetEmbed.setTitle(":scroll: Rulesets")
                    .setDescription("This is the tournament ruleset manager. Browse existing rulesets using the dropdown below or make your own by pressing the New button.\n\n:grey_question: To learn more about making rulesets, watch [this video](https://youtu.be/fExzuOvn6iY)")
                let buttons = [
                    {
                        type: 2,
                        label: "",
                        emoji: {
                            id: "854097998357987418",
                            name: "refresh"
                        },
                        style: 2,
                        custom_id: "tourney_rulesets_refresh",
                    }
                ]
                let offset = 0
                if (args[2] !== undefined && args[2] !== "initial") {
                    offset = Number(args[2])
                }
                if (interaction.data.hasOwnProperty("values") && interaction.values[0].includes("offset")) {
                    offset = Number(interaction.values[0].replace("offset", ""))
                }
                if (![undefined, null].includes(tourney_rulesets_data.saved)) {
                    let saved = Object.keys(tourney_rulesets_data.saved)
                    let rulesets = []
                    saved = saved.sort(function (a, b) {
                        if (tourney_rulesets_data.saved[a].name < tourney_rulesets_data.saved[b].name) { return -1; }
                        if (tourney_rulesets_data.saved[a].name > tourney_rulesets_data.saved[b].name) { return 1; }
                        return 0;
                    })
                    for (i = 0 + offset * 23; i < (offset + 1) * 23; i++) {
                        if (i == 0 + offset * 23 && offset > 0) {
                            rulesets.push(
                                {
                                    label: "Previous...",
                                    value: "offset" + (offset - 1),
                                }
                            )
                        }
                        let s = saved[i]
                        let r = {
                            label: tourney_rulesets_data.saved[s].name,
                            emoji: {
                                name: emojis[tourney_rulesets_data.saved[s].type]
                            },
                            value: s,
                            description: tourney_rulesets_data.saved[s].type + " Ruleset by " + client.guilds.resolve(interaction.guild_id).members.resolve(tourney_rulesets_data.saved[s].author).user.username,
                        }
                        if (interaction.data.hasOwnProperty("values") && !interaction.values[0].includes("offset")) {
                            if (r.value == interaction.values[0]) {
                                r.default = true
                            }
                        }
                        rulesets.push(r)
                        if (i == saved.length - 1) {
                            i = (offset + 1) * 23
                        }
                        if (i == (offset + 1) * 23 - 1) {
                            rulesets.push(
                                {
                                    label: "See more...",
                                    value: "offset" + (offset + 1),
                                }
                            )
                        }
                    }
                    if (interaction.data.hasOwnProperty("values") && !interaction.values[0].includes("offset")) {
                        let ruleset = tourney_rulesets_data.saved[interaction.values[0]]
                        rulesetEmbed.setTitle(":scroll: Rulesets: " + ruleset.name)
                            .setDescription("Type: " + emojis[ruleset.type] + " " + ruleset.type + "\n" + ruleset.description)
                            .addFields(showRuleset(ruleset))
                            .setFooter(client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.username, client.guilds.resolve(interaction.guild_id).members.resolve(ruleset.author).user.avatarURL())
                    }

                    components.push({
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "tourney_rulesets_browse_" + offset,
                                options: rulesets,
                                placeholder: "Select Ruleset",
                                min_values: 1,
                                max_values: 1
                            }
                        ]
                    })
                }

                components.push({
                    type: 1,
                    components: buttons
                })
            }

            rulesetEmbed
                .setTitle(tourney_rulesets_data.new[member].name)
                .setFooter(interaction.member.user.username, client.guilds.resolve(interaction.guild_id).members.resolve(member).user.avatarURL())
            if (![null, undefined].includes(tourney_rulesets_data)) {
                if (![null, undefined].includes(tourney_rulesets_data.new) && args[3] !== "save") {
                    rulesetEmbed.addFields(showRuleset(tourney_rulesets_data.new[member]))
                }
            }

            if (!modal) {
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: {
                            flags: flags,
                            embeds: [rulesetEmbed],
                            components: components
                        }
                    }
                })
            }