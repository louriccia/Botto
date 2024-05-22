const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('randomly generated challenges')
        .addSubcommand(subcommand =>
            subcommand
                .setName('abbreviations')
                .setDescription('get a list of commonly used abbreviations for Star Wars Episode I: Racer')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('commands')
                .setDescription("get a list of Botto's commands and descriptions for how to use them")
        ),
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const helpEmbed = new EmbedBuilder()
        console.log(interaction.options.getSubcommand())
        if (interaction.options.getSubcommand() == "abbreviations") {
            helpEmbed
                .setTitle("SWE1R Abbreviations")
                .setAuthor({ name: "/help" })
                .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/white-question-mark_2754.png")
                .setColor("CDD7DE")
                .setURL("https://www.speedrun.com/swe1r/thread/nf4bo")
                .addFields(
                    {
                        name: ":large_blue_diamond: General",
                        value: "Swe1r/SWR --- Star Wars Ep. I Racer\n" +
                            "RTA --- Real Time Attack (Full game/circuit runs)\n" +
                            "IL --- Individual Level Time Attack\n" +
                            "NU --- No Upgrades\n" +
                            "MU --- Max Upgrades\n" +
                            "FT --- Full Track\n" +
                            "ASU --- Arbitrary Speed Units\n" +
                            "RNG --- Random Number Generation aka Luck\n" +
                            "SRC --- Speedrun.com\n" +
                            "CS --- Cyberscore.me.uk\n" +
                            "TFPS --- Traction/FPS setup\n" +
                            "MFG --- Maximum Fall Glitch"
                    },
                    {
                        name: ":flags: Categories",
                        value: "AMC --- Amateur Circuit\n" +
                            "SPC --- Semi-Pro Circuit\n" +
                            "GC --- Galactic Circuit\n" +
                            "AT --- All Tracks\n" +
                            "NG+ --- New Game+\n" +
                            "Any% --- Complete the game without restrictions\n" +
                            "100% --- Win all 25 Races"
                    },
                    {
                        name: ":triangular_flag_on_post: Tracks",
                        value: "Boonta Training Course --- TBTC/BTC\n" +
                            "Mon Gazza Speedway --- MGS\n" +
                            "Beedo's Wild Ride --- BWR\n" +
                            "Aquilaris Classic --- AQC\n" +
                            "Malastare 100 --- M100\n" +
                            "Vengeance --- VEN\n" +
                            "Spice Mine Run --- SMR\n\n" +
                            "Sunken City --- SC\n" +
                            "Howler Gorge --- HG\n" +
                            "Dug Derby --- DD\n" +
                            "Scrapper's Run --- SR\n" +
                            "Zugga Challenge --- ZC\n" +
                            "Baroo Coast --- BC\n" +
                            "Bumpy's Breakers --- BB\n\n" +
                            "Executioner --- EXE\n" +
                            "Sebulba's Legacy --- SL\n" +
                            "Grabvine Gateway --- GVG\n" +
                            "Andobi Mountain Run --- AMR\n" +
                            "Dethro's Revenge --- DR\n" +
                            "Fire Mountain Rally --- FMR\n" +
                            "The Boonta (Eve) Classic --- TBC/BEC\n\n" +
                            "Ando Prime Centrum --- APC\n" +
                            "Abyss --- ABY\n" +
                            "The Gauntlet --- GAU\n" +
                            "Inferno --- INF"
                    })
        } else if (interaction.options.getSubcommand() == "commands") {
            helpEmbed
                .setTitle("Botto Command List")
                .setAuthor({ name: "/help" })
                .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/white-question-mark_2754.png")
                .setColor("CDD7DE")
                .setDescription("Botto uses slash commands. Type a forward slash '/' to view a list of available commands and helpful descriptions for what they each do.")
                .addFields(
                    { name: "/botto", value: "introduces botto and provides an invite link", inline: false },
                    { name: "/challenge", value: "get randomly generated, 15-minute challenges", inline: false },
                    { name: "/chancecube", value: "coinflip; 'Blue--it's the boy. Red--his mother'", inline: false },
                    { name: "/cleanup*", value: "cleans up bot spam", inline: false },
                    { name: "/convert", value: "converts seconds to --:--.--- and vice versa", inline: false },
                    { name: "/help", value: "get helpful information about commands and abbreviations", inline: false },
                    { name: "/links", value: "get the most common links shared in the SWE1R Discord", inline: false },
                    { name: "/lookup", value: "get information for each track, racer, etc.", inline: false },
                    { name: "/random", value: "roll random tracks, racers, and teams", inline: false },
                    { name: "/role*", value: "add or remove the speedrunning and multiplayer roles", inline: false },
                    { name: "/simulate", value: "simulate speed (in development)", inline: false },
                    { name: "/src", value: "get top-5 leaderboards from speedrun.com", inline: false },
                    { name: "/tourney", value: "get top-5 leaderboards from past tournaments", inline: false },
                    { name: "/weekly", value: "submit times and view leaderboards for weekly challenges", inline: false })
                .setFooter({ text: "*Only available on the SWE1R Discord" })
        }

        interaction.reply({ embeds: [helpEmbed], ephemeral: true })
    }

}
