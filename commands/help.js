module.exports = {
    name: 'help',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const helpEmbed = new Discord.MessageEmbed()
        if(args[0].name =="abbreviations") {
            helpEmbed
            .setTitle("SWE1R Abbreviations")
            .setAuthor("/help")
            .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/white-question-mark_2754.png")
            .setColor("CDD7DE")
            .setURL("https://www.speedrun.com/swe1r/thread/nf4bo")
            .addField(":large_blue_diamond: General",
            "Swe1r/SWR --- Star Wars Ep. I Racer\n" +
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
            "MFG --- Maximum Fall Glitch")
            .addField(":flags: Categories",
            "AMC --- Amateur Circuit\n" +
            "SPC --- Semi-Pro Circuit\n" +
            "GC --- Galactic Circuit\n" +
            "AT --- All Tracks\n" +
            "NG+ --- New Game+\n" +
            "Any% --- Complete the game without restrictions\n" +
            "100% --- Win all 25 Races")
            .addField(":triangular_flag_on_post: Tracks",
            "Boonta Training Course --- TBTC/BTC\n" +
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
            "Inferno --- INF")
        } else if(args[0].name=="commands") {
            helpEmbed
            .setTitle("Botto Command List")
            .setAuthor("/help")
            .setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/white-question-mark_2754.png")
            .setColor("CDD7DE")
            .setDescription("Botto uses slash commands. Type a forward slash '/' to view a list of available commands and helpful descriptions for what they each do.")
            .addField("/botto", "introduces botto and provides an invite link", false)
            .addField("/challenge", "get randomly generated, 15-minute challenges", false)
            .addField("/chancecube", "coinflip; 'Blue--it's the boy. Red--his mother'", false)
            .addField("/cleanup*", "cleans up bot spam", false)
            .addField("/convert", "converts seconds to --:--.--- and vice versa", false)
            .addField("/help", "get helpful information about commands and abbreviations", false)
            .addField("/links", "get the most common links shared in the SWE1R Discord", false)
            .addField("/lookup", "get information for each track, racer, etc.", false)
            .addField("/random", "roll random tracks, racers, and teams", false)
            .addField("/role*", "add or remove the speedrunning and multiplayer roles", false)
            .addField("/simulate", "simulate speed (in development)", false)
            .addField("/src", "get top-5 leaderboards from speedrun.com", false)
            .addField("/tourney", "get top-5 leaderboards from past tournaments", false)
            .addField("/weekly", "submit times and view leaderboards for weekly challenges", false)
            .setFooter("*Only available on the SWE1R Discord")
        }
        
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "Here's some help!",
                    embeds: [helpEmbed],
                    flags: 64
                }
            }
        })
    }
    
}
