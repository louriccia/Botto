
exports.livematch_setup = function ({ db, database, interaction } = {}) {
    let livematch = db.ty.live[interaction.channel.id]
    let liverules

    const livematchref = database.ref('tourney/live/' + interaction.channel.id)
    livematchref.on('value', (snapshot) => {
        livematch = snapshot.val()
    }, (error) => {
        console.log('the read failed: ' + error.name)
    })

    if (livematch?.ruleset && db.ty.rulesets) {
        liverules = db.ty.rulesets?.saved?.[livematch.ruleset]
    }

    return { data: livematch, ref: livematchref, rules: liverules }
}

