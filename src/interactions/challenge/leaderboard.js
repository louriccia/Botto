const { racers } = require('../../data/sw_racer/racer.js')
const { tracks } = require('../../data/sw_racer/track.js')
const { circuits } = require('../../data/sw_racer/circuit.js')
const { planets } = require('../../data/sw_racer/planet.js')

const { console_emojis } = require('../../data/discord/emoji.js')
const { time_fix, randomErrorMessage } = require('../../generic.js')

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

const die_icon = "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/282/game-die_1f3b2.png"
const playable_racers = 23
const positions = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]

// Every option in the Conditions select. Keys sharing a `group` are alternatives:
// picking none of a group means "either" rather than "nothing matches". The
// groups listed in `filter_groups` below describe the run itself; the rest
// (My Runs Only, Has Proof) just narrow the list and are handled on their own.
const condition_options = {
    mu: { label: "Upgrades", group: "nu", match: false },
    nu: { label: "No Upgrades", group: "nu", match: true },
    ft: { label: "Full Track", group: "skips", match: false },
    skips: { label: "Skips", group: "skips", match: true },
    unmirr: { label: "Unmirrored", group: "mirror", match: false },
    mirr: { label: "Mirrored", group: "mirror", match: true },
    fwd: { label: "Forward", group: "backwards", match: false },
    bwd: { label: "Backwards", group: "backwards", match: true },
    lap1: { label: "1-Lap", group: "laps", match: 1 },
    lap2: { label: "2-Laps", group: "laps", match: 2 },
    lap3: { label: "3-Laps", group: "laps", match: 3 },
    lap4: { label: "4-Laps", group: "laps", match: 4 },
    lap5: { label: "5-Laps", group: "laps", match: 5 },
    proof: { label: "Has Proof", group: "proof" },
    user: { label: "My Runs Only", group: "user" }
}

const default_conditions = ["mu", "nu", "ft", "skips", "unmirr", "mirr", "fwd", "bwd", "lap3"]

// The filters live in the message's own select menus rather than in the database -
// whatever is marked default on the message is the current state.
function currentSelection(interaction, suffix) {
    for (const row of interaction.message?.components ?? []) {
        for (const component of row.components ?? []) {
            if (component.customId == `challenge_random_leaderboard_${suffix}`) {
                return (component.options ?? []).filter(option => option.default).map(option => option.value)
            }
        }
    }
    return null
}

exports.leaderboard = async function ({ interaction, args, db, member_id } = {}) {
    const changed = args[2]

    //track - opens on a random one, the way a random challenge would roll it
    let track = Math.floor(Math.random() * tracks.length)
    const selected_track = Number((changed == "track" ? interaction.values : currentSelection(interaction, "track"))?.[0])
    if (tracks[selected_track]) {
        track = selected_track
    }

    //conditions - copied, since the refill below writes back into it
    const conditions = [...((changed == "conditions" ? interaction.values : currentSelection(interaction, "conditions")) ?? default_conditions)]

    //pods
    const pods = (changed == "pods" ? interaction.values : currentSelection(interaction, "pods")) ?? []

    //build the filters, and fill any group the user emptied back in so the menu
    //keeps matching what the leaderboard is actually showing
    const groups = { nu: [], skips: [], mirror: [], backwards: [], laps: [] }
    Object.keys(condition_options).forEach(key => {
        const option = condition_options[key]
        if (groups[option.group] && conditions.includes(key)) {
            groups[option.group].push(option.match)
        }
    })
    Object.keys(groups).forEach(group => {
        if (groups[group].length) {
            return
        }
        Object.keys(condition_options).filter(key => condition_options[key].group == group).forEach(key => {
            groups[group].push(condition_options[key].match)
            conditions.push(key)
        })
    })
    const mine = conditions.includes("user")
    const proven = conditions.includes("proof")

    //filter runs
    const runs = Object.values(db.ch.times ?? {}).filter(run => {
        if (Array.isArray(run.track)) { //multi-track monthly challenges have no place on a track board
            return false
        }
        const c = run.conditions ?? run //a handful of the oldest runs store conditions flat
        return Number(run.track) === track
            && groups.nu.includes(Boolean(c.nu))
            && groups.skips.includes(Boolean(c.skips))
            && groups.mirror.includes(Boolean(c.mirror))
            && groups.backwards.includes(Boolean(c.backwards))
            && groups.laps.includes(Number(c.laps))
            && (!pods.length || pods.includes(String(run.racer)))
            && (!mine || run.user == member_id)
            && (!proven || Boolean(run.proof))
    }).sort((a, b) => a.time - b.time)

    //one entry per player per exact challenge, unless the player asked for all of their own runs
    const shown = []
    const seen = new Set()
    runs.forEach(run => {
        if (shown.length >= positions.length) {
            return
        }
        const c = run.conditions ?? run
        const key = [run.user, run.racer, c.laps, Boolean(c.skips), Boolean(c.nu), Boolean(c.mirror), Boolean(c.backwards)].join("|")
        if (!mine && seen.has(key)) {
            return
        }
        seen.add(key)
        shown.push(run)
    })

    //names change over time - prefer the player's current one over the one stored on the run
    const names = {}
    Object.values(db.user).forEach(user => {
        if (user.discordID) {
            names[user.discordID] = user.random?.name ?? user.name
        }
    })

    //laid out like the challenge card's leaderboard: time, pod, name, console,
    //then this run's conditions as their own code blocks
    const lines = shown.map((run, i) => {
        const c = run.conditions ?? run
        const time = `**\`${time_fix(run.time)}\`**`
        const tags = [
            `${c.laps} Lap${Number(c.laps) == 1 ? '' : 's'}`,
            c.skips ? 'Skips' : 'FT',
            c.nu ? 'NU' : 'MU',
            c.mirror ? 'Mirrored' : null,
            c.backwards ? 'Backwards' : null
        ].filter(e => e).map(tag => `\`${tag}\``).join(" ")
        return [
            positions[i],
            run.proof ? `[${time}](<${run.proof}>)` : time,
            racers[run.racer]?.flag.trim(), //one of the flags carries a stray trailing space
            names[run.user] ?? run.name ?? 'no name',
            console_emojis[run.platform],
            tags
        ].filter(e => e).join(" ")
    })

    //construct embed
    const planet = planets[tracks[track].planet]
    const challengeLeaderboard = new EmbedBuilder()
        .setAuthor({ name: "Random Challenge", iconURL: die_icon })
        .setTitle(`${planet.emoji} ${tracks[track].name}`)
        .setColor(planet.color)
        .setDescription([
            `${circuits[tracks[track].circuit].name} Circuit | Race ${tracks[track].cirnum} | ${planet.name}`,
            lines.length ? lines.join("\n") : `**No Runs**\n\`No runs were found matching that criteria\`\n${randomErrorMessage()}`
        ].join("\n\n"))
        .setFooter({ text: `${runs.length} Total Run${runs.length == 1 ? '' : 's'}` })

    if (mine) {
        challengeLeaderboard.setAuthor({
            name: `${interaction.member?.displayName ?? interaction.user.username}'s Best`,
            iconURL: interaction.member?.displayAvatarURL() ?? interaction.user.displayAvatarURL()
        })
    }

    //construct components
    const track_selector = new StringSelectMenuBuilder()
        .setCustomId("challenge_random_leaderboard_track")
        .setPlaceholder("Select Track")
        .setMinValues(1)
        .setMaxValues(1)
    tracks.forEach((t, i) => {
        track_selector.addOptions({
            label: t.name.replace("The Boonta Training Course", "Boonta Training Course"),
            value: String(i),
            description: `${circuits[t.circuit].name} Circuit | Race ${t.cirnum} | ${planets[t.planet].name}`.substring(0, 50),
            emoji: {
                name: planets[t.planet].emoji.split(":")[1],
                id: planets[t.planet].emoji.split(":")[2].replace(">", "")
            },
            default: track == i
        })
    })

    const condition_selector = new StringSelectMenuBuilder()
        .setCustomId("challenge_random_leaderboard_conditions")
        .setPlaceholder("Select Conditions")
        .setMinValues(0)
        .setMaxValues(Object.keys(condition_options).length)
    Object.keys(condition_options).forEach(key => {
        condition_selector.addOptions({
            label: condition_options[key].label,
            value: key,
            default: conditions.includes(key)
        })
    })

    const pod_selector = new StringSelectMenuBuilder()
        .setCustomId("challenge_random_leaderboard_pods")
        .setPlaceholder("Select Pods")
        .setMinValues(0)
        .setMaxValues(playable_racers)
    racers.slice(0, playable_racers).forEach((racer, i) => {
        const flag = racer.flag.trim().split(":")
        pod_selector.addOptions({
            label: racer.name,
            value: String(i),
            description: racer.pod.substring(0, 50),
            emoji: {
                name: flag[1],
                id: flag[2].replace(">", "")
            },
            default: pods.includes(String(i))
        })
    })

    const components = [
        new ActionRowBuilder().addComponents(track_selector),
        new ActionRowBuilder().addComponents(condition_selector),
        new ActionRowBuilder().addComponents(pod_selector),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("challenge_random_menu")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("862620287735955487")
        )
    ]

    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [challengeLeaderboard], components })
    } else { //navigate in place, the way the shop and inventory do
        interaction.update({ embeds: [challengeLeaderboard], components })
    }
}
