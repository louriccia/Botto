const { menuEmbed, menuComponents } = require("./functions")

exports.menu = async function ({ interaction, db } = {}) {
    if (interaction.isChatInputCommand()) {
        interaction.reply({ embeds: [menuEmbed({ db })], components: menuComponents() })
    } else {
        interaction.update({ embeds: [menuEmbed({ db })], components: menuComponents() })
    }
}
