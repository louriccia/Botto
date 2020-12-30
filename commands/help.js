module.exports = {
    name: 'help',
    execute(interaction, args) {
        if(args[0]=="abbreviations") {
            const helpEmbed = new Discord.MessageEmbed()
            .setTitle("SWE1R Abbreviations")
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
        } else if(args[0]=="commands") {
            const helpEmbed = new Discord.MessageEmbed()
            //.setColor('#00DE45')
            //.setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            .setTitle("Botto Command List")
            .addField(":large_blue_diamond: General", "`?help` - list of commands\n" +
            "`!cleanup` - deletes command and bot messages within the past 30 messages\n" +
            "`!github` - reveals Botto github link\n" +
            "`!img` - reveals links to racer/track graphics on imgur\n" +
            "`!guide` - posts link to multiplayer setup guide\n" +
            "`!drive` - posts link to Google Drive\n" +
            "`!abb` - posts list of commonly used abbreviations", false)
            .addField(":busts_in_silhouette: Roles", "`!multiplayer` - adds or removes multiplayer role\n" +
            "`!speedrunning` - adds or removes speedrunning role", false)
            .addField(":trophy: Speedrun.com Leaderboards", "`!src <track>` - shows top 5 3-lap times for given track\n" +
            "`!src <category>` - shows top 5 times for given category (any,100,amc,spc,ng+)\n" +
            "`!src <track/category> <mu/nu> <skips/ft> <pc/n64/dc/switch/ps4> <flap>` - filters leaderboard", false)
            .addField(":checkered_flag: Tournament Leaderboards", "`!tourney <track>` - shows top 5 tournament times for given track\n" +
            "`!tourney <track> <skips/ft> <mu/nu> <deaths/deathless> <pod/no pod> <year>` - filters leaderboard", false)
            .addField(":game_die: Randomizers", "`!racer(s)` - random racer (adding “s” rolls for all players in voice channel)\n" +
            "`!racer(s) canon` - random canon racer\n" +
            "`!racer(s) noncanon` - random noncanon racer\n" +
            "`!racer(s) <tier>` - random racer from given tier (low/f, mid/b, high/a, top/s)\n" +
            "`!track` - random track\n" +
            "`!track <circuit>` - random track from given circuit\n" +
            "`!track <planet>` - random track from given planet\n" +
            "`!challenge` - random racer + random track\n" +
            "`!teams <n>` - randomly splits members in voice channel into *n* number of teams\n" +
            "`!chancecube` - “let fate decide”\n" +
            "`!random <n>` - generates random number between 1 and *n*", false)
            .addField(":mag_right: Lookup", "`!racer <name/initials>` - look up specific racer\n" +
            "`!track <name/acronym>` - look up specific track\n"+
            "`!track <name/acronym> times` - look up par times for given track\n"+
            "`!tier (nu)` - posts MU/NU pod tier list\n" +
            "`!stat` - reveals racer stat guide\n", false)
        }
        
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    content: "Here's some help!",
                    embeds: [helpEmbed]
                }
            }
        })
    }
    
}
