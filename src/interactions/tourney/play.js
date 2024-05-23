const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { initializeMatch, adminEmbed, setupEmbed, setupComponents, adminComponents, matchMakerEmbed, colorEmbed, getUsername, rulesetOverviewEmbed, reminderEmbed, firstEmbed, firstComponents, firstbanComponents, colorComponents, firstbanEmbed, getOpponent, raceEmbed, raceComponents, countDown, getWinner, matchSummaryEmbed, permabanEmbed, permabanComponents, raceEventEmbed, raceEventComponents, profileComponents } = require('./functions.js')
const { initializeUser, manageTruguts } = require('../challenge/functions.js');
const { tracks } = require('../../data/sw_racer/track.js')
const { planets } = require('../../data/sw_racer/planet.js')
const { trackgroups } = require('./data.js')
const { time_to_seconds, time_fix } = require('../../generic.js');
const { editMessage } = require('../../discord.js');
const { betEmbed, betComponents } = require('../trugut_functions.js')

exports.play = async function ({ client, interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {

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

    console.log(livematch)

    //if no match, assert setup
    if (!livematch) {
        args[1] = "setup"
        initializeMatch(livematchref)
    } else if (interaction.isChatInputCommand()) {
        args[1] = 'admin'
        type = 4
        interaction.reply({ embeds: [adminEmbed({ livematch, db })], components: adminComponents({ livematch, liverules }), ephemeral: true })
        return
    }

    let command = args[1]

    if (command.includes("permaban")) {
        command = 'permaban'
    } else if (command.includes("race")) {
        command = 'race'
    }

    const tourney_command = require(`./play/${command}.js`)
    tourney_command[command]({ interaction, args, db, database, member_id, member_avatar, user_key, user_profile, livematch, liverules, livematchref })

    livematchref.off()
}