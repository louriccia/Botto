module.exports = {
    name: 'src',
    execute(client, interaction, args) {
        const fetch = require('node-fetch');
        const tools = require('./../tools.js');
        const Discord = require('discord.js');
        var numb = null
        var catg = "" 
        var titl = ""
        var upgr = ""
        var skps = ""
        var plat = ""
        var platname = ""
        var desc = ""
        var sys = [{"name" : "PC", "id": "8gej2n93"}, {"name":"N64", "id":"w89rwelk"},{"name" : "DC", "id" : "v06d394z"}, {"name":"Switch", "id":"7m6ylw9p"},{"name":"PS4", "id":"nzelkr6q"}, {"name":"Xbox","id":"o7e2mx6w"}]
        for (let i = 0; i<args[0].options.length; i++) {
            if(args[0].name == "il") {
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
                    catg = "level/"  + tracks[numb].id + "/824owmd5" //default to 3 lap
                    titl = tracks[numb].name + " | 3-Lap"
                } else if (args[0].options[i].name == "skips") {
                    if(args[0].options[i].value == "skips"){
                        skps = "&var-789x6p58=rqvg3prq"
                    } else if(args[0].options[i].value == "ft"){
                        skps = "&var-789x6p58=013d38rl"
                    }
                } else if (args[0].options[i].name == "upgrades") {
                    if(args[0].options[i].value == "mu"){
                        upgr = "&var-rn1z02dl=klrvnpoq"
                    } else if(args[0].options[i].value == "nu"){
                        upgr = "&var-rn1z02dl=21d9rzpq"
                    }
                } else if (args[0].options[i].name == "platform") {
                    for (u = 0; u < sys.length; u++) {
                        if (args[0].options[i].value.toLowerCase() == sys[u].name.toLowerCase()) {
                            plat = "&platform=" + sys[u].id
                            platname = sys[u].name
                        }
                    }
                } else if (args[0].options[i].name == "laps") {
                    if(args[0].options[i].value == "1"){
                        catg = "level/"  + tracks[numb].id + "/9d8wr6dn"
                        titl = tracks[numb].name + " | 1-Lap"
                    }
                } 
            } else if (args[0].name == "rta"){
                if (args[0].options[i].name == "category") {
                    if(args[0].options[i].value == "any%"){
                        catg = "category/xk9634k0"
                        titl = "Any%"
                    } else if(args[0].options[i].value == "spc"){
                        catg = "category/mkeoyg6d"
                        titl = "Semi-Pro Circuit"
                    } else if(args[0].options[i].value == "amc"){
                        catg = "category/7dg8ywp2"
                        titl = "Amateur Circuit"
                    } else if(args[0].options[i].value == "100%"){
                        catg = "category/n2yqxo7k"
                        titl = "100%"
                    } else if(args[0].options[i].value == "ng+"){
                        catg = "category/w20zml5d"
                        titl = "All Tracks NG+"
                    }
                } else if (args[0].options[i].name == "skips") {
                    if(args[0].options[i].value == "skips"){
                        skps = "&var-onv6p08m=21gjrx1z" //full game categories
                    } else if(args[0].options[i].value == "ft"){
                        skps = "&var-onv6p08m=5lmxzy1v" //full game categories
                    }
                } else if (args[0].options[i].name == "upgrades") {
                    if(args[0].options[i].value == "mu"){
                        upgr = "&var-789k45lw=gq7nen1p" //full game categories
                    } else if(args[0].options[i].value == "nu"){
                        upgr = "&var-789k45lw=9qjzj014" //full game categories
                    }
                } else if (args[0].options[i].name == "platform") {
                    for (u = 0; u < sys.length; u++) {
                        if (args[0].options[i].value.toLowerCase() == sys[u].name.toLowerCase()) {
                            plat = "&platform=" + sys[u].id
                            platname = sys[u].name
                        }
                    }
                }
            }
        }      
        
        if (upgr == "&var-rn1z02dl=21d9rzpq" || upgr == "&var-789k45lw=9qjzj014") {
            desc = "No Upgrades, "
        } else if (upgr == "&var-789k45lw=gq7nen1p" || upgr == "&var-rn1z02dl=klrvnpoq") {
            desc = "Upgrades, "
        } else {
            desc = "Any Upgrades, "
        }
        if (skps == "&var-789x6p58=013d38rl" ||  skps == "&var-onv6p08m=5lmxzy1v") {
            desc = desc + "Full Track, "
        } else if (skps == "&var-onv6p08m=21gjrx1z" ||  skps == "&var-789x6p58=rqvg3prq"){
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
                    .setAuthor("speedrun.com", "https://www.speedrun.com/themes/Default/1st.png", "https://www.speedrun.com/swe1r")
                    .setTitle(titl)
                    .setURL(src.weblink)
                    .setDescription(desc)
                    .setFooter("/src")
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
                    if (src.runs[k].run.values["rn1z02dl"] == "21d9rzpq" || src.runs[k].run.values["789k45lw"] == "9qjzj014") {
                        if (numb == null) {
                            upgrades = "NU"
                        }else {
                            upgrades = " / NU"
                        }
                        
                    }
                    if (src.runs[k].run.values["789x6p58"] == "rqvg3prq" || src.runs[k].run.values["onv6p08m"] == "21gjrx1z") {
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
                    for (let j = 0; j<sys.length; j++) {
                        if (src.runs[k].run.system.platform == sys[j].id) {
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
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            //content: "",
                            embeds: [srcReport]
                        }
                    }
                })
            } catch (error) {
                console.log(error);
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "`Error: Unable to get data from speedrun.com `\n" + errorMessage[Math.floor(Math.random()*errorMessage.length)]
                        }
                    }
                })
            }
            };
            
        getsrcData()
        
        
    }
    
}


