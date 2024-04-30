const { SlashCommandBuilder } = require('discord.js');

let rolls = {}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chancecube')
        .setDescription("Blue—it's the boy. Red—his mother"),
    execute(interaction) {
        if (interaction.guildId == '1199872145354915920') {

            //HEY! Get out of here! You're not supposed to be in here!

            let bstring = '001000110110110001101001011011100110101101110011'
            if ([undefined, null, ""].includes(rolls[interaction.user.id])) {
                rolls[interaction.user.id] = 0
            } else {
                rolls[interaction.user.id]++
            }

            if (rolls[interaction.user.id] > 47) {
                rolls[interaction.user.id] = -1
                interaction.reply("Maybe next time you win, huh? Hahahaha")
            } else {
                let square = bstring[rolls[interaction.user.id]] == '1' ? ':one:' : ':zero:'
                interaction.reply(square)
            }
            return
        }
        interaction.reply(Math.floor(Math.random() * 2) == 0 ? ":blue_square:" : ":red_square:")
    }
}
