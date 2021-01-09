module.exports = {
    name: 'links',
    execute(client, interaction, args) {
        var link = ""
        var title = ""
        var desc = ""
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
            .setAuthor("/links")
            .setColor("00A4C4")
            //.setThumbnail("https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/twitter/259/link_1f517.png")
        if(args[0].name =="botto") {
            if(args[0].options[0].name =="github") {
                title = "Botto Github"
                link = "https://github.com/louriccia/Botto"
                desc = "Botto’s github repository. View this bot's code and follow its development."
            } else if(args[0].options[0].name=="graphics") {
                title = "Botto Graphics"
                desc = "Botto's image resources are available at the following links:\n[Racer stat graphics](https://imgur.com/a/uqTaaIl)\n[Track graphics](https://imgur.com/a/im0C1Tx)\n[Planet thumbnails](https://imgur.com/a/G5yhapp)"
            } else if(args[0].options[0].name=="invite") {
                title = "Botto Invite"
                desc = "Use this link to add Botto to your own server"
                link = "https://discord.com/api/oauth2/authorize?client_id=545798436105224203&permissions=0&scope=bot%20applications.commands"
            }
        } else if(args[0].name=="drive") {
            title = "Community Google Drive"
            desc = "Official guides, track maps, stat sheets, and more!"
            link = "https://drive.google.com/drive/folders/1ScgPE1i1EpSYXT16a1ocxQiouMCcE9z1?usp=sharing"
        } else if(args[0].name=="mp_guide") {
            title = "Online Multiplayer Setup Guide"
            desc = "Everything you need to know to start podracing online. Click the above link to see the extended guide."
            link = "https://docs.google.com/document/d/1lxVkuT80ug0BX2LMJp5CXcMVPZneLK4unOetLU3WlQQ/edit?usp=sharing"
            myEmbed.addField("1. Patch SWEP1RCR.EXE", "[Download swe1r-patcher.zip from JayFoxRox's github](https://github.com/JayFoxRox/swe1r-patcher/releases) and copy dinput.dll and the textures folder into your game directory", false)
            myEmbed.addField("2. Set Up a VLAN Connection", "[Download Radmin VPN](https://www.radmin-vpn.com/) and join the Star Wars Episode I: Racer gaming network.", false)
            myEmbed.addField("3. Change Ethernet Adapter","Run `ipxconfig.exe` in your game files and change your Primary interface to Famatech RadminVPN", false)
            myEmbed.addField("4. Create or Join a Session","Launch the game, select multiplayer, and create or join a session.",false)
        } else if(args[0].name=="stats") {
            title = "Pod Vehicle Statistics and Track Data"
            desc = "The hidden vehicle stats for each racer and their values for each upgrade as well as track data"
            link = "https://docs.google.com/spreadsheets/d/1CPF8lfU_iDpLNIJsOWeU8Xg23BzQrxzi3-DEELAgxUA/edit?usp=sharing"
        } else if(args[0].name=="src_resources") {
            title = "Speedrun.com Resources for Star Wars Racer"
            desc = "Download the autosplitter and game saves for 100% completion and every traction upgrade"
            link = "https://www.speedrun.com/swe1r/resources"
        } else if(args[0].name=="rtss") {
            title = "RTSS Rivatuner Statistics Server Download"
            desc = "Download and install Rivatuner to limit the game's framerate and get better sliding"
            link = "https://www.guru3d.com/files-details/rtss-rivatuner-statistics-server-download.html"
        } else if(args[0].name=="dgvoodoo") {
            title = "dgVoodoo Download"
            desc = "Download and set up dgVoodoo to run the game in windowed mode"
            link = "http://dege.freeweb.hu/dgVoodoo2/dgVoodoo2/"
        }

        myEmbed
            .setURL(link)
            .setTitle(title)
            .setDescription(desc)

        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 3,
                data: {
                    //content: "",
                    embeds: [myEmbed]
                }
            }
        })
    }
    
}
