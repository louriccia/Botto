const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('links')
        .setDescription('quickly get the most commonly shared links on the SWE1R Discord')
        .addSubcommandGroup(group =>
            group
                .setName('botto')
                .setDescription('Botto related links')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('github')
                        .setDescription("posts a link to Botto's github page")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('graphics')
                        .setDescription("posts imgur links to the graphics that Botto uses")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('invite')
                        .setDescription("posts a link to invite Botto to your Discord")
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('drive')
                .setDescription("posts a link to the community Google Drive")
        ).addSubcommand(subcommand =>
            subcommand
                .setName('speedrunning')
                .setDescription("posts a collection of links to various leaderboards across the web")
        ).addSubcommand(subcommand =>
            subcommand
                .setName('mp_guide')
                .setDescription("posts a link to the online multiplayer guide")
        ).addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription("posts a link to the pod and track statistics sheet")
        ).addSubcommand(subcommand =>
            subcommand
                .setName('src_resources')
                .setDescription("posts a link to the SWE1R speedrun.com resources page")
        ).addSubcommand(subcommand =>
            subcommand
                .setName('rtss')
                .setDescription("posts a link to download rivatuner for limiting the game's framerate")
        ).addSubcommand(subcommand =>
            subcommand
                .setName('dgvoodoo')
                .setDescription("posts a link to download dgvoodoo for running the game in windowed mode")
        )
        ,
    execute(interaction) {
        var link = ""
        var title = ""
        var desc = ""
        const Discord = require('discord.js');
        const subcommand = interaction.options.getSubcommand()
        const subcommand_group = interaction.options.getSubcommandGroup()
        const myEmbed = new EmbedBuilder()
            .setColor("00A4C4")
        //.setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/link_1f517.png")
        if (subcommand_group == "botto") {
            if (subcommand == "github") {
                title = "Botto Github"
                link = "https://github.com/louriccia/Botto"
                desc = "Botto’s github repository. View this bot's code and follow its development."
            } else if (subcommand == "graphics") {
                title = "Botto Graphics"
                desc = "Botto's image resources are available at the following links:\n[Racer stat graphics](https://imgur.com/a/uqTaaIl)\n[Track graphics](https://imgur.com/a/im0C1Tx)\n[Planet thumbnails](https://imgur.com/a/G5yhapp)"
            } else if (subcommand == "invite") {
                title = "Botto Invite"
                desc = "Use this link to add Botto to your own server"
                link = "https://discord.com/api/oauth2/authorize?client_id=545798436105224203&permissions=0&scope=bot%20applications.commands"
            }
        } else if (subcommand == "drive") {
            title = "Community Google Drive"
            desc = "Official guides, track maps, stat sheets, and more!"
            link = "https://drive.google.com/drive/folders/1ScgPE1i1EpSYXT16a1ocxQiouMCcE9z1?usp=sharing"
        } else if (subcommand == "speedrunning") {
            title = "Speedrunning Leaderboards"
            myEmbed
                .addField("speedrun.com", "[speedrun.com](https://www.speedrun.com/swe1r)\n The main site for SWE1R speedruns including RTA and IL leaderboards filterable by skips, upgrades, and more.", false)
                .addField("Cyberscore", "[cyberscore.me.uk](https://www.cyberscore.me.uk/game/191)\nSecondary site for SWE1R speedruns including 3-lap/1-lap leaderboards for every track and a long history of runs.", false)
                .addField("Star Wars Episode 1 Racer (weebly)", "[starwarsepisode1racer.weebly.com](https://starwarsepisode1racer.weebly.com/all-time-world-records.html)\nMikeyburger's community page containing an archive of the best runs up to 2014.", false)
                .addField("Speed Demos Archive", "[speeddemosarchive.com](http://speeddemosarchive.com/EpisodeIRacer.html)\nAn archive of the oldest known recorded times from Wouter M. Jansen for every track.", false)
                .addField("Video Games Records", "[video-games-records.com](https://www.video-games-records.com/star-wars-episode-1-racer-best-lap-amateur-mon-gazza-speedway-record-r13163.html/star-wars-episode-1-racer-game-g232/index)\nA small collection of older times around 2007-2010.", false)
                .addField("N64 High Scores", "[n64hs.speedrunwiki.com](http://n64hs.speedrunwiki.com/Episode1Amateur.html)\nPre-2007 leaderboard archive of some of the oldest runs for the game.", false)
                .addField("Twin Galaxies", "[twingalaxies.com](https://www.twingalaxies.com/game/star-wars-episode-one-racer/nintendo-64/)\nSome of the oldest recorded times that still exist on the internet.", false)
                .addField("High Score", "[highscore.com](http://www.highscore.com/game/?g=49619)\nA very small assortment of Dreamcast and N64 runs from the 2010s.", false)
                .addField("Archived SWE1R Speedrunning Discord", "[Discord Invite](https://discord.gg/vg77T84K96)\nAn archived discord server that used to be the main discord for SWE1R speedrunning before merging with the [Star Wars Episode I: Racer Discord](https://discord.gg/bCgX4wpYuN)", false)
            desc = ""
            link = ""
        } else if (subcommand == "mp_guide") {
            title = "Online Multiplayer Setup Guide"
            desc = "Everything you need to know to start podracing online. Click the above link to see the extended guide."
            link = "https://docs.google.com/document/d/1lxVkuT80ug0BX2LMJp5CXcMVPZneLK4unOetLU3WlQQ/edit?usp=sharing"
            myEmbed.addField("1. Patch SWEP1RCR.EXE", "[Download swe1r-patcher.zip from JayFoxRox's github](https://github.com/JayFoxRox/swe1r-patcher/releases) and copy dinput.dll and the textures folder into your game directory", false)
            myEmbed.addField("2. Set Up a VLAN Connection", "[Download Radmin VPN](https://www.radmin-vpn.com/) and join the Star Wars Episode I: Racer gaming network.", false)
            myEmbed.addField("3. Change Ethernet Adapter", "Run `ipxconfig.exe` in your game files and change your Primary interface to Famatech RadminVPN", false)
            myEmbed.addField("4. Create or Join a Session", "Launch the game, select multiplayer, and create or join a session.", false)
        } else if (subcommand == "stats") {
            title = "Pod Vehicle Statistics and Track Data"
            desc = "The hidden vehicle stats for each racer and their values for each upgrade as well as track data"
            link = "https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit?usp=sharing"
        } else if (subcommand == "src_resources") {
            title = "Speedrun.com Resources for Star Wars Racer"
            desc = "Download the autosplitter and game saves for 100% completion and every traction upgrade"
            link = "https://www.speedrun.com/swe1r/resources"
        } else if (subcommand == "rtss") {
            title = "RTSS Rivatuner Statistics Server Download"
            desc = "Download and install Rivatuner to limit the game's framerate and get better sliding and airtime"
            link = "https://www.guru3d.com/files-details/rtss-rivatuner-statistics-server-download.html"
        } else if (subcommand == "dgvoodoo") {
            title = "dgVoodoo Download"
            desc = "Download and set up dgVoodoo to run the game in windowed mode"
            link = "http://dege.freeweb.hu/dgVoodoo2/dgVoodoo2/"
            myEmbed
                .addField("1. Download DGVoodoo", "[Download dgVoodoo](http://dege.freeweb.hu/dgVoodoo2/dgVoodoo2/) and extract it into your game's folder, then move all the .dll files from the 'MS' folder into your Racer folder as well, replacing your game’s ddraw.dll file")
                .addField("2. Launch dgVoodooCpl.exe", "Make sure the path at the top points to your main game folder by clicking the “." + "\u005c" + "” button.")
                .addField("3. Enable Windowed Mode", "In the General tab, under Appearance, toggle Windowed. In the DirectX tab, under Behavior, uncheck “Application controlled fullscreen/windowed state” and “Disable Alt-Enter to toggle screen state” and under Miscellaneous, uncheck “dgVoodoo Watermark”")
                .addField("[Optional] Double Cursor Fix", "If you have a double cursor, you can fix it by [downloading and running install.bat](https://www.vogons.org/download/file.php?id=46892&sid=2b7d505561d75c808816f7255f31bdbc).")
                .addField("[Optional] Z-Fighting Issues Fix", "If you have z-fighting issues, (distant rocks/objects warbling in and out) open dgVoodoo.conf and set 'DepthBuffersBitDepth' to `= force32bit`")
        }

        myEmbed
            .setURL(link)
            .setTitle(title)
            .setDescription(desc)
        var components = []
        if (link !== "") {
            components = [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: title,
                            style: 5,
                            url: link
                        }
                    ]
                }
            ]
        }
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    embeds: [myEmbed],
                    components: components
                }
            }
        })
    }

}
