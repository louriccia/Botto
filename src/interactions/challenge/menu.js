const { menuEmbed, menuComponents } = require("./functions")
const { MessageFlags } = require('discord.js')

exports.menu = async function ({ interaction, db } = {}) {
    const menu = { embeds: [menuEmbed({ db })], components: menuComponents() }
    if (interaction.isChatInputCommand()) {
        interaction.reply(menu)
    } else if (interaction.message?.flags?.has(MessageFlags.IsComponentsV2)) {
        //the menu button on a completed challenge card: a components v2 message
        //can never be edited to carry an embed, so answer alongside it instead
        interaction.reply({ ...menu, ephemeral: true })
    } else {
        interaction.update(menu)
    }
}
