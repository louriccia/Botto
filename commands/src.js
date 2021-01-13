module.exports = {
    name: 'src',
    execute(client, interaction, args) {
        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
        var numb = null
        for (let i = 0; i<args[0].options.length; i++) {
            if (args[0].options[i].name == "track") {
                var input = args[0].options[i].value.toLowerCase()
                for(let i = 0; i<tracks.length; i++){
                    if(input == tracks[i].name.toLowerCase() || input == tracks[i].name.toLowerCase().replace(/ /g, '')){
                        numb = i
                        i = tracks.length
                    }
                    if(i<tracks.length){
                        tracks[i].nickname.forEach(nick => {
                            if(nick.toLowerCase() == input){
                                numb = i
                                i = tracks.length
                            }
                        })    
                    }
                }
            } else if (args[0].options[i].name == "skips") {
                
            } else if (args[0].options[i].name == "upgrades") {
                
            } else if (args[0].options[i].name == "pod") {
                
            } else if (args[0].options[i].name == "deaths") {
                
            } else if (args[0].options[i].name == "year") {
                
            }
        }      
        var catg = "" 
        var titl = ""
        
        if (numb == null) {
            if (args[0] == "any" || args[0] == "any%"){
                catg = "category/xk9634k0"
                titl = "Any%"
            } else if (args[0] == "100" || args[0] == "100%") {
                catg = "category/n2yqxo7k"
                titl = "100%"
            } else if (args[0] == "amc" || args[0] == "amateur") {
                catg = "category/7dg8ywp2"
                titl = "Amateur Circuit"
            } else if (args[0] == "spc" || args[0] == "semi-pro") {
                catg = "category/mkeoyg6d"
                titl = "Semi-Pro Circuit"
            } else if (args[0] == "ng+" || args[0] == "newgame") {
                catg = "category/w20zml5d"
                titl = "All Tracks NG+"
            } 
        } else {
            catg = "level/"  + tracks[numb].id + "/824owmd5" //default to 3 lap
            titl = tracks[numb].name + " | 3-Lap"
        }
        var upgr = ""
        var skps = ""
        var plat = ""
        var platname = ""
        var desc = ""
        var sys = [{"name" : "PC", "id": "zqoe6ply"}, {"name":"N64", "id":"013kndq5"},{"name" : "DC", "id" : "rqv25716"}, {"name":"Switch", "id":"jqz7nnkl"},{"name":"PS4", "id":"klrw33w1"}]
        for (let c = 1; c < args.length; c++) {
            if (args[c] == "no") {
                if (args[c+1] == "upgrades") {
                    if (numb == null) { 
                        upgr = "&var-789k45lw=9qjzj014" //full game categories
                    } else {
                        upgr = "&var-789k49lw=z194gjl4"
                    }
                }
                if (args[c+1] == "skips" || args[c+1] == "skip") {
                    if (numb == null) { 
                        skps = "&var-onv6p08m=5lmxzy1v" //full game categories
                    } else {
                        skps = "&var-2lgz978p=81p7we17"
                    }
                }
            } else if(args[c] == "nu") {
                if (numb == null) { 
                    upgr = "&var-789k45lw=9qjzj014" //full game categories
                } else {
                    upgr = "&var-789k49lw=z194gjl4"
                }
            } else if ((args[c] == "mu" || args[c] == "upgrades") && upgr == "") {
                if (numb == null) { 
                    upgr = "&var-789k45lw=gq7nen1p" //full game categories
                } else {
                    upgr = "&var-789k49lw=xqkrk919"
                }
            } else if ((args[c] == "skips" || args[c] == "skip") && skps == "") {
                if (numb == null) { 
                    skps = "&var-onv6p08m=21gjrx1z" //full game categories
                } else {
                    skps = "&var-2lgz978p=p125ev1x"
                }
            } else if(args[c] == "ns" || args[c] == "ft" || args[c] == "full") {
                if (numb == null) { 
                    skps = "&var-onv6p08m=5lmxzy1v" //full game categories
                } else {
                    skps = "&var-2lgz978p=81p7we17"
                }
            } else if (args[c] == "1lap" || args[c] == "flap" || args[c] == "1-lap") {
                catg = "level/"  + tracks[numb].id + "/9d8wr6dn"
                titl = tracks[numb].name + " | 1-Lap"
            } else {
                for (u = 0; u < sys.length; u++) {
                    if (args[c].toLowerCase() == sys[u].name.toLowerCase()) {
                        plat = "&var-wl39wwl1=" + sys[u].id
                        platname = sys[u].name
                    }
                }
            }
        }
        if (upgr == "&var-789k49lw=z194gjl4" || upgr == "&var-789k45lw=9qjzj014") {
            desc = "No Upgrades, "
        } else if (upgr == "&var-789k45lw=gq7nen1p" || upgr == "&var-789k49lw=xqkrk919") {
            desc = "Upgrades, "
        } else {
            desc = "Any Upgrades, "
        }
        if (skps == "&var-2lgz978p=81p7we17" ||  skps == "&var-onv6p08m=5lmxzy1v") {
            desc = desc + "Full Track, "
        } else if (skps == "&var-onv6p08m=21gjrx1z" ||  skps == "&var-2lgz978p=p125ev1x"){
            desc = desc + "Skips, "
        } else {
            desc = desc + "Skips/Full Track, "
        }
        if (platname == "") {
            desc = desc + "All Platforms"
        } else {
            desc = desc + platname
        }
        let url = 'https://www.speedrun.com/api/v1/leaderboards/m1mmex12/' + catg + "?top=5&embed=players" + upgr + skps + plat
        console.log(url)
        let settings = {method: "Get"}
        async function getsrcData() {
            try {
                const response = await fetch(url);
                const data = await response.json();
                console.log (data)
                var src = data.data
                const srcReport = new Discord.MessageEmbed()
                .setColor('#0099ff')
                //.setThumbnail("https://www.speedrun.com/themes/Default/1st.png")
                .setTitle(titl)
                .setURL(src.weblink)
                .setDescription(desc)
                var pos = ["<:P1:671601240228233216>", "<:P2:671601321257992204>", "<:P3:671601364794605570>", "4th", "5th"]
                var numberofruns = data.data.runs.length
                if (numberofruns > 5) {
                    numberofruns = 5
                }
                for (let k =0; k<numberofruns; k++) {
                    var name = ""
                    if (numb == null) {
                        var upgrades = "MU"
                    } else {
                        var upgrades = " / MU"
                    }
                    var skips = ""
                    var system = ""
                    var character = ""
                    var country = ""
                    var time = data.data.runs[k].run.times.primary_t
                    var vid = data.data.runs[k].run.videos.links[0].uri
                    time = tools.timefix(time)
                    if (src.players.data[k].hasOwnProperty("names")) {
                        name = src.players.data[k].names.international
                    } else {
                        name = src.players.data[k].name
                    }
                    if (src.runs[k].run.values["789k49lw"] == "z194gjl4" || src.runs[k].run.values["789k45lw"] == "9qjzj014") {
                        if (numb == null) {
                            upgrades = "NU"
                        }else {
                            upgrades = " / NU"
                        }
                        
                    }
                    if (src.runs[k].run.values["2lgz978p"] == "p125ev1x" || src.runs[k].run.values["onv6p08m"] == "21gjrx1z") {
                        skips = " / Skips"
                    }
                    for (let j = 0; j<23; j++){
                        if (src.runs[k].run.values.j846d94l == racers[j].id) {
                            if (racers[j].hasOwnProperty("flag")) {
                                character = racers[j].flag
                            } else {
                                character = racers[j].name
                            }
                        }
                    } 
                    for (let j = 0; j<5; j++) {
                        if (src.runs[k].run.values.wl39wwl1 == sys[j].id) {
                            system = "   " + sys[j].name
                        }
                    }
                    if (data.data.players.data[k].hasOwnProperty("location")) {
                        if (data.data.players.data[k].location !== null) {
                            country = ":flag_" + data.data.players.data[k].location.country.code.substring(0, 2) + ":"
                        }
                    }
                    srcReport
                        .addField(pos[k] + " " + name,  country + system, true)
                        .addField(time," " + character + "[" + upgrades + skips + "](" + vid + ")", true)
                        .addField('\u200B', '\u200B', true)
                }
                message.channel.send(srcReport)
            } catch (error) {
                console.log(error);
                message.channel.send("Sorry, speedrun.com is under too much pressure.")
            }
            };
            
        getsrcData()
        
        
    

        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    //embeds: [myEmbed]
                }
            }
        })
    }
    
}


