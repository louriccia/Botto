exports.methods = {
    poe_c: "Process of Elimination by Circuit",
    poe_p: "Process of Elimination by Planet",
    poe_t: "Process of Elimination by Track",
    random: "Random",
    already: "Already Decided",
    gents: "Gentleman's Agreement"
}
exports.firsts = {
    poe_c: { label: "Process of Elimination by Circuit", description: "Alternate circuit bans then track bans until one option remains" },
    poe_p: { label: "Process of Elimination by Planet", description: "Alternate planet bans then track bans until one option remains" },
    poe_t: { label: "Process of Elimination by Track", description: "Alternate track bans until one option remains" },
    random: { label: "Random", description: "First track is randomly decided by Botto" }
}

exports.trackgroups = {
    amc: { name: "Amateur Circuit", type: "circuit", code: 0, count: 7 },
    spc: { name: "Semi-Pro Circuit", type: "circuit", code: 1, count: 7 },
    gal: { name: "Galactic Circuit", type: "circuit", code: 2, count: 7 },
    inv: { name: "Invitational Circuit", type: "circuit", code: 3, count: 4 },
    and: { name: "Ando Prime", type: "planet", code: 0, count: 4 },
    tat: { name: "Tatooine", type: "planet", code: 7, count: 2 },
    oov: { name: "Oovo IV", type: "planet", code: 5, count: 3 },
    ord: { name: "Ord Ibanna", type: "planet", code: 6, count: 3 },
    bar: { name: "Baroonda", type: "planet", code: 2, count: 4 },
    mon: { name: "Mon Gazza", type: "planet", code: 4, count: 3 },
    aqu: { name: "Aquilaris", type: "planet", code: 1, count: 3 },
    mal: { name: "Malastare", type: "planet", code: 3, count: 3 }
}

exports.condition_names = {
    ft: "Full Track",
    sk: "Skips",
    mu: "Upgrades Allowed",
    nu: "No Upgrades",
    mi: "Mirrored",
    um: "Unmirrored",
    l1: "1 Lap",
    l2: "2 Laps",
    l3: "3 Laps",
    l4: "4 Laps",
    l5: "5 Laps",
    tt: "Total Time",
    fl: "Fastest Lap"
}