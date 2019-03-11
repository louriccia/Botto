const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();
var lookup = require("./data.js");

client.once('ready', () => {
    console.log('Ready!')
    //set bot activity
    client.user.setActivity("Star Wars: Episode I - Racer")
})

// when a user joins/leaves a voice channel
client.on('voiceStateUpdate', (oldMember, newMember) => {

    let newUserChannel = newMember.voiceChannel
    let oldUserChannel = oldMember.voiceChannel
    var chan = client.channels.get('441840193754890250');
    
    //get list of members in voice channel
    
    if(chan !== undefined){
        var mems = chan.members;
        var arr = [];
        for (let [snowflake, guildMember] of mems){
            if(guildMember.displayName !== "Botto"){
                arr.push(guildMember)
            }
            
        }
        
    }

    //if member joins Multiplayer Lobby 1
    if(oldUserChannel === undefined && newUserChannel.id == 441840193754890250 && newMember.id !== "545798436105224203") {
        //random welcome message based on how many members are in voice channel
       if (arr.length == 1) {
            var random = Math.floor(Math.random()*2)
       } else if(arr.length == 2) {
            var random = Math.floor(Math.random()*3)+2
       } else if(2 < arr.length < 5 ) {
            var random = Math.floor(Math.random()*9)+5
       } else if(4 < arr.length < 8 ) {
            var random = Math.floor(Math.random()*6)+14
        } else if(7 < arr.length) {
            var random = Math.floor(Math.random()*4)+17}
       var str = welcomeMessages[random]
       client.channels.get("551786988861128714").send(str.replace("replaceme", newMember))
       random = Math.floor(Math.random()*voiceWelcome.length)
       // playSfx2(newUserChannel.id,voiceWelcome[random])

    
       const voicecon = client.guilds.get("441839750555369474")
       if ((voicecon.voiceConnection !== null)) {
            const channel = client.channels.get("441840193754890250");
            channel.join()
                .then(connection => { // Connection is an instance of VoiceConnection
                const dispatcher = connection.playFile(voiceWelcome[random]);
                dispatcher.setVolume(0.5);
                dispatcher.on('end', () => {
                    connection.disconnect
                });
                //dispatcher.on('error', e => {
                    // Catch any errors that may arise
                //  console.log(e);
                //});
                
                })
                .catch(console.log);
            }
        
    } 
    //if member is already in any voice channel
    if(oldUserChannel !== undefined){ 
        //member leaves multiplayer or troubleshooting channel
        const voicecon = client.guilds.get("441839750555369474")
        if(voicecon.voiceConnection !== null){
        if((oldUserChannel.id == 441840193754890250 || oldUserChannel.id == 441840753111597086) && newUserChannel === undefined){ 
            random = Math.floor(Math.random()*goodbyeMessages.length)
            random2 = Math.floor(Math.random()*voiceFarewell.length)
            var str = goodbyeMessages[random]
            client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
            //playSfx2(oldUserChannel.id,voiceFarewell[random2])


            const voicecon = client.guilds.get("441839750555369474")
            if ((voicecon.voiceConnection !== null)) {
            const channel = client.channels.get("441840193754890250");
            channel.join()
                .then(connection => { // Connection is an instance of VoiceConnection
                const dispatcher = connection.playFile(voiceFarewell[random2]);
                dispatcher.setVolume(0.5);
                dispatcher.on('end', () => {
                    connection.disconnect
                });
                //dispatcher.on('error', e => {
                    // Catch any errors that may arise
                //  console.log(e);
                //});
                
                })
                .catch(console.log);
            }
        }
    }
        //member is moving from one channel to another
        if(newUserChannel !== undefined) {
            //member moves from multiplayer to troubleshooting
            if(oldUserChannel.id == 441840193754890250 && newUserChannel.id == 441840753111597086 && newMember.id !== "288258590010245123" && newMember.id !==545798436105224203) {
                random = Math.floor(Math.random()*troubleShooting.length)
                random2 = Math.floor(Math.random()*voiceTrouble.length)
                var str = troubleShooting[random]
                client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
                //playSfx2(oldUserChannel.id,voiceTrouble[random2])

                const voicecon = client.guilds.get("441839750555369474")

            if ((voicecon.voiceConnection !== null)) {
                const channel = client.channels.get("441840193754890250");
                channel.join()
                    .then(connection => { // Connection is an instance of VoiceConnection
                    const dispatcher = connection.playFile(voiceTrouble[random2]);
                    dispatcher.setVolume(0.5);
                    dispatcher.on('end', () => {
                        connection.disconnect
                    });
                    //dispatcher.on('error', e => {
                        // Catch any errors that may arise
                    //  console.log(e);
                    //});
                    
                    })
                    .catch(console.log);
                }

        }
        //Renegawd moves from troubleshooting to multiplayer
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id == "288258590010245123") { 
            client.channels.get("551786988861128714").send("*Wouldn't have lasted long if <@288258590010245123> wasn't so good at fixing things.*")
        }
        //member moves back from troubleshooting to multiplayer
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id !== "288258590010245123" && newMember.id !== 545798436105224203) { 
            random = Math.floor(Math.random()*fixed.length)
            random2 = Math.floor(Math.random()*voiceFixed.length)
            var str = fixed[random]
            client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
            //playSfx2(newUserChannel.id,voiceFixed[random2])

            const voicecon = client.guilds.get("441839750555369474")
            if ((voicecon.voiceConnection !== null)) 
                {
                const channel = client.channels.get("441840193754890250");
                channel.join()
                    .then(connection => { // Connection is an instance of VoiceConnection
                    const dispatcher = connection.playFile(voiceFixed[random2]);
                    dispatcher.setVolume(0.5);
                    dispatcher.on('end', () => {
                    connection.disconnect
                    });
                //dispatcher.on('error', e => {
                    // Catch any errors that may arise
                //  console.log(e);
                //});
                
                })
                .catch(console.log);
            }
        }
        }
    }
})


client.on('message', message => {
if(message.author.bot) return;
const args = message.content.slice(prefix.length).trim().split(/ +/g);
const command = args.shift().toLowerCase();
var messageText = message.content
var messageLow = messageText.toLowerCase()
var random2 = Math.floor(Math.random()*2) //1 in # chances of using playerPicks instead of movieQuotes
var random3 = Math.floor(Math.random()*movieQuotes.length)
var random5 = Math.floor(Math.random()*playerPicks.length)

var chan = client.channels.get('441840193754890250');

//get list of members in voicechannel
if(chan !== undefined && message.channel.type !== "dm"){
    var mems = chan.members;
    var arr = [];
    for (let [snowflake, guildMember] of mems){
        if(guildMember.displayName !== "Botto"){
        arr.push(guildMember)
        }
        
    }
    //get random member from voicechannel
    var pickedPlayer = arr[Math.floor(Math.random()*arr.length)]
}


/////   !track   /////


if(messageLow.startsWith(`${prefix}track`)){
    if(
    messageLow == (`${prefix}track`)) {
        var numb = Math.floor(Math.random()*25)}
    if(
    messageLow == (`${prefix}track amc`) ||
    messageLow == (`${prefix}track amateur`)) {
        var numb = Math.floor(Math.random()*7)}
    if(
    messageLow == (`${prefix}track spc`) ||
    messageLow.startsWith(`${prefix}track semi`)) {
        var numb = Math.floor(Math.random()*7) + 7}
    if(
    messageLow.startsWith(`${prefix}track gal`)) {
        var numb = Math.floor(Math.random()*7) + 14}
    if(
    messageLow.startsWith(`${prefix}track inv`)) {
        var numb = Math.floor(Math.random()*4) + 21}
    if(
    messageLow == (`${prefix}track andoprime`) ||
    messageLow == (`${prefix}track ando prime`)) {
        let planet = [2, 8, 17, 21]
        var numb = planet[Math.floor(Math.random()*4)]}
    if(
    messageLow == (`${prefix}track aquilaris`)) {
        let planet = [3, 7, 13]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(
    messageLow == (`${prefix}track baroonda`)) {
        let planet = [12, 16, 19, 24]
        var numb = planet[Math.floor(Math.random()*4)]}
    if(
    messageLow == (`${prefix}track malastare`)) {
        let planet = [4, 9, 15]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(
    messageLow == (`${prefix}track mon gazza`) ||
    messageLow == (`${prefix}track mongazza`)) {
        let planet = [1, 6, 11]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(
    messageLow == (`${prefix}track oovoiv`) ||
    messageLow == (`${prefix}track oovo iv`)) {
        let planet = [5, 14, 23]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(
    messageLow == (`${prefix}track ord ibanna`) ||
    messageLow == (`${prefix}track ordibanna`)) {
        let planet = [10, 18, 22]
        var numb = planet[Math.floor(Math.random()*3)]}
    if(
    messageLow == (`${prefix}track tatooine`)) {
        let planet = [0, 20]
        var numb = planet[Math.floor(Math.random()*2)]}
    if(
        messageLow == (`${prefix}track a`) ||
        messageLow.startsWith(`${prefix}track ab`)) {
        var numb = 22}
    if(
        messageLow == (`${prefix}track apc`) ||
        messageLow == (`${prefix}track ando prime centrum`) ||
        messageLow == (`${prefix}track andoprimecentrum`)) {
        var numb = 21}
    if(
        messageLow == (`${prefix}track amr`) ||
        messageLow.startsWith(`${prefix}track andob`)) {
        var numb = 17}
    if(
        messageLow == (`${prefix}track ac`) ||
        messageLow == (`${prefix}track aquilarisclassic`) ||
        messageLow == (`${prefix}track aquilaris classic`)) {
        var numb = 3}
    if(
        messageLow == (`${prefix}track bc`) ||
        messageLow == (`${prefix}track baroocoast`) ||
        messageLow == (`${prefix}track baroo coast`)) {
        var numb = 12}
    if(
        messageLow == (`${prefix}track bwr`) ||
        messageLow.startsWith(`${prefix}track be`)) {
        var numb = 2}
    if(
        messageLow == (`${prefix}track bb`) ||
        messageLow.startsWith(`${prefix}track bu`)) {
        var numb = 13}
    if(
        messageLow == (`${prefix}track dr`) ||
        messageLow.startsWith(`${prefix}track de`)) {
        var numb = 18}
    if(
        messageLow == (`${prefix}track dd`) ||
        messageLow.startsWith(`${prefix}track du`)) {
        var numb = 9}
    if(
        messageLow == (`${prefix}track e`) ||
        messageLow.startsWith(`${prefix}track e`)) {
        var numb = 14}
    if(
        messageLow == (`${prefix}track fmr`) ||
        messageLow.startsWith(`${prefix}track f`)) {
        var numb = 19}
    if(
        messageLow == (`${prefix}track gg`) ||
        messageLow.startsWith(`${prefix}track gr`)) {
        var numb = 16}
    if(
        messageLow == (`${prefix}track hg`) ||
        messageLow.startsWith(`${prefix}track h`)) {
        var numb = 8}
    if(
        messageLow == (`${prefix}track i`) ||
        messageLow.startsWith(`${prefix}track inf`)) {
        var numb = 24}
    if(
        messageLow.startsWith(`${prefix}track m1`) ||
        messageLow == (`${prefix}track malastare 100`) ||
        messageLow == (`${prefix}track malastare100`)) {
        var numb = 4}
    if(
        messageLow == (`${prefix}track mgs`) ||
        messageLow == (`${prefix}track mongazzaspeedway`) ||
        messageLow == (`${prefix}track mon gazza speedway`)) {
        var numb = 1}
    if(
        messageLow == (`${prefix}track sr`) ||
        messageLow.startsWith(`${prefix}track scr`)) {
        var numb = 10}
    if(
        messageLow == (`${prefix}track sl`) ||
        messageLow.startsWith(`${prefix}track seb`)) {
        var numb = 15}
    if(
        messageLow == (`${prefix}track smr`) ||
        messageLow.startsWith(`${prefix}track spi`)) {
        var numb = 6}
    if(
        messageLow == (`${prefix}track sc`) ||
        messageLow.startsWith(`${prefix}track su`)) {
        var numb = 7}
    if(
        messageLow == (`${prefix}track tbc`) ||
        messageLow.startsWith(`${prefix}track theboontac`) ||
        messageLow.startsWith(`${prefix}track the boonta c`)) {
        var numb = 20}
    if(
        messageLow == (`${prefix}track tbtc`) ||
        messageLow.startsWith(`${prefix}track theboontat`) ||
        messageLow.startsWith(`${prefix}track the boonta t`)) {
        var numb = 0}
    if(
        messageLow == (`${prefix}track tg`) ||
        messageLow.startsWith(`${prefix}track the g`) ||
        messageLow.startsWith(`${prefix}track theg`)) {
        var numb = 23}
    if(
        messageLow == (`${prefix}track v`) ||
        messageLow.startsWith(`${prefix}track v`)) {
        var numb = 5}
    if(
        messageLow == (`${prefix}track zc`) ||
        messageLow.startsWith(`${prefix}track z`)) {
        var numb = 11}

        
        const trackEmbed = new Discord.RichEmbed()
        .setThumbnail(planets[tracks[numb].planet].img)
        .setColor(planets[tracks[numb].planet].color)
        .setImage(tracks[numb].img)
        .setTitle(tracks[numb].name)
    
        var str = playerPicks[random5]
        var description = planets[tracks[numb].planet].name + "\n" + circuits[tracks[numb].circuit].name + " Circuit: Race #" + tracks[numb].cirnum + "\n"  + "Track Favorite: " + tracks[numb].favorite
        //if(tracks[numb].skip !== "") {
        //    description = description + "\n" + "Click :track_next: to view skip"
        //}
        //if(tracks[numb].shortcut !== "") {
        //    description = description + "\n" + "Click :fast_forward: to view shortcut"
        //}
        if((pickedPlayer !== undefined) && (random2 == 0)) {
            description =  description + "\n \n" +  str.replace("replaceme", pickedPlayer).replace("replaceme", pickedPlayer)
        } else {
            description = description + "\n \n" + movieQuotes[random3]
        }
        description = description + 
        trackEmbed.setDescription(description)
        message.channel.send(trackEmbed).then(sentMessage => {
            if(tracks[numb].skip !== "") {
                sentMessage.react('⏭').then(() => {

                    const filter = (reaction, user) => {
                        return ['⏭'].includes(reaction.emoji.name) && user.id !== "545798436105224203";
                    };
                    sentMessage.awaitReactions(filter, { max: 1})
                        .then(collected => {
                            const reaction = collected.first();
        
                            if (reaction.emoji.name === '⏭' && reaction.users.id !== "545798436105224203") {
                                //console.log(new map(reaction.users))
                                sentMessage.channel.send(tracks[numb].skip);
                            } 
                        })
                })
            }
        
            if(tracks[numb].shortcut !== "") {
                sentMessage.react('⏩').then(() => {

                    const filter = (reaction, user) => {
                        return ['⏩'].includes(reaction.emoji.name) && user.id !== "545798436105224203";
                    };
                    sentMessage.awaitReactions(filter, { max: 1})
                        .then(collected => {
                            const reaction = collected.first();
        
                            if (reaction.emoji.name === '⏩' && reaction.users.id !== "545798436105224203") {
                                //console.log(new map(reaction.users))
                                sentMessage.channel.send(tracks[numb].shortcut);
                            } 
                        })
                })
            }
        })




        random = Math.floor(Math.random()*voiceGeneral.length)
        playSfx(message, voiceGeneral[random]);
    }

    
/////    !racer     //////       

if(messageLow.startsWith(`${prefix}racer`) && !messageLow.startsWith(`${prefix}racers`)) {
    if(message.content == (`${prefix}racer`)) {
        var numb = Math.floor(Math.random()*23)}
    if(
    message.content == (`${prefix}racer canon`)) {
        let canon = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19]
        var numb = canon[Math.floor(Math.random()*18)]}
    if(
    message.content == (`${prefix}racer noncanon`)) {
        let canon = [15, 18, 20, 21, 22]
        var numb = canon[Math.floor(Math.random()*5)]}
    if(
        messageLow.startsWith(`${prefix}racer top`) || messageLow == (`${prefix}racer s`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 4){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    if(
        messageLow.startsWith(`${prefix}racer high`) || messageLow == (`${prefix}racer a`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 3){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    if(
        messageLow.startsWith(`${prefix}racer mid`) || messageLow == (`${prefix}racer b`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 2){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    if(
        messageLow.startsWith(`${prefix}racer low`) || messageLow == (`${prefix}racer f`)) {
        var list = []
        for (let i = 0; i < racers.length; i++) {
            
            if(racers[i].tier == 1){
                console.log(racers[i].name)
                list.push(racers[i].racernum - 1)
            }
        }

        var numb = list[Math.floor(Math.random()*list.length)]

    }
    
    if(
    messageLow.startsWith(`${prefix}racer as`) || 
    messageLow.startsWith(`${prefix}racer anakin`) || 
    messageLow.startsWith(`${prefix}racer skywalker`)) {
        var numb = 0}
    if(
    messageLow.startsWith(`${prefix}racer tp`) || 
    messageLow.startsWith(`${prefix}racer teemto`) || 
    messageLow.startsWith(`${prefix}racer pagalies`)) {
        var numb = 1}
    if(
    messageLow.startsWith(`${prefix}racer seb`) || 
    messageLow.startsWith(`${prefix}racer sb`) || 
    messageLow.startsWith(`${prefix}racer sebulba`)) {
        var numb = 2}
    if(
    messageLow.startsWith(`${prefix}racer rt`) || 
    messageLow.startsWith(`${prefix}racer ratts`) || 
    messageLow.startsWith(`${prefix}racer tyerell`)){
        var numb = 3}
    if(
    messageLow.startsWith(`${prefix}racer ab`) || 
    messageLow.startsWith(`${prefix}racer aldar`) || 
    messageLow.startsWith(`${prefix}racer beedo`)) {
        var numb = 4}
    if(
    messageLow.startsWith(`${prefix}racer mh`) || 
    messageLow.startsWith(`${prefix}racer mawhonic`) || 
    messageLow.startsWith(`${prefix}racer maw`)) {
        var numb = 5}
    if(
    messageLow.startsWith(`${prefix}racer ar`) || 
    messageLow.startsWith(`${prefix}racer ark`) || 
    messageLow.startsWith(`${prefix}racer bumpy`) || 
    messageLow.startsWith(`${prefix}racer roose`)) {
        var numb = 6}
    if(
    messageLow.startsWith(`${prefix}racer ws`) || 
    messageLow.startsWith(`${prefix}racer wan`) || 
    messageLow.startsWith(`${prefix}racer sandage`) ||
    messageLow.startsWith(`${prefix}racer sandwich`)) {
        var numb = 7}
    if(
    messageLow.startsWith(`${prefix}racer mg`) || 
    messageLow.startsWith(`${prefix}racer mars`) || 
    messageLow.startsWith(`${prefix}racer guo`)) {
        var numb = 8}
    if(
    messageLow.startsWith(`${prefix}racer ee`) || 
    messageLow.startsWith(`${prefix}racer ebe`) || 
    messageLow.startsWith(`${prefix}racer endocott`)) {
        var numb = 9}
    if(
    messageLow.startsWith(`${prefix}racer db`) || 
    messageLow.startsWith(`${prefix}racer dud`) || 
    messageLow.startsWith(`${prefix}racer bolt`)) {
        var numb = 10}
    if(
    messageLow.startsWith(`${prefix}racer g`) || 
    messageLow.startsWith(`${prefix}racer gg`) ||  
    messageLow.startsWith(`${prefix}racer gas`)) {
        var numb = 11}
    if(
    messageLow.startsWith(`${prefix}racer ch`) || 
    messageLow.startsWith(`${prefix}racer clegg`) || 
    messageLow.startsWith(`${prefix}racer holdfast`)) {
        var numb = 12}
    if(
    messageLow.startsWith(`${prefix}racer em`) || 
    messageLow.startsWith(`${prefix}racer elan`) || 
    messageLow.startsWith(`${prefix}racer mak`)) {
        var numb = 13}
    if(
    messageLow.startsWith(`${prefix}racer nk`) || 
    messageLow.startsWith(`${prefix}racer neva`) || 
    messageLow.startsWith(`${prefix}racer kee`)) {
        var numb = 14}
    if(
    messageLow.startsWith(`${prefix}racer bb`) || 
    messageLow.startsWith(`${prefix}racer bozzie`) || 
    messageLow.startsWith(`${prefix}racer baranta`)) {
        var numb = 15}
    if(
    messageLow.startsWith(`${prefix}racer br`) || 
    messageLow.startsWith(`${prefix}racer boles`) || 
    messageLow.startsWith(`${prefix}racer roor`)) {
        var numb = 16}
    if(
    messageLow.startsWith(`${prefix}racer om`) || 
    messageLow.startsWith(`${prefix}racer ody`) || 
    messageLow.startsWith(`${prefix}racer mandrell`)) {
        var numb = 17}
    if(
    messageLow.startsWith(`${prefix}racer fs`) || 
    messageLow.startsWith(`${prefix}racer fud`) || 
    messageLow.startsWith(`${prefix}racer sang`)) {
        var numb = 18}
    if(
    messageLow.startsWith(`${prefix}racer bq`) || 
    messageLow.startsWith(`${prefix}racer ben`) || 
    messageLow.startsWith(`${prefix}racer quadinaros`) || 
    messageLow.startsWith(`${prefix}racer god`)) {
        var numb = 19}
    if(
    messageLow.startsWith(`${prefix}racer sp`) || 
    messageLow.startsWith(`${prefix}racer slide`) || 
    messageLow.startsWith(`${prefix}racer paramita`)) {
        var numb = 20}
    if(
    messageLow.startsWith(`${prefix}racer td`) || 
    messageLow.startsWith(`${prefix}racer toy`) || 
    messageLow.startsWith(`${prefix}racer dampner`)) {
        var numb = 21}
    if(
    messageLow.startsWith(`${prefix}racer bn`) || 
    messageLow.startsWith(`${prefix}racer bullseye`) || 
    messageLow.startsWith(`${prefix}racer navior`)) {
        var numb = 22}
    
    if(numb == undefined && messageLow.startsWith(`${prefix}racers`) == false){
        message.channel.send("**Perhaps the archives are incomplete.**")
        playSfx(message, voiceError[Math.floor(Math.random()*voiceError.length)])
    }
    else{
        var racerFooter = racers[numb].footer
        if(racers[numb].tier == 1){
            racerFooter = racerFooter + " | Low Tier"
        }
        if(racers[numb].tier == 2){
            racerFooter = racerFooter + " | Mid Tier"
        }
        if(racers[numb].tier == 3){
            racerFooter = racerFooter + " | High Tier"
        }
        if(racers[numb].tier == 4){
            racerFooter = racerFooter + " | Top Tier"
        }
        const racerEmbed = new Discord.RichEmbed()
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .setImage(racers[numb].stats)
            .setFooter(racerFooter)
        message.channel.send(racerEmbed);
        playSfx(message, racers[numb].announce)
    }
}

if(messageLow.startsWith(`${prefix}racers`) && message.channel.type !== "dm"){
    if(arr.length > 0){
        if(messageLow == (`${prefix}racers`)){
            var assignRacers = ""
            var arrayLength = arr.length;
            for (var i = 0; i < arrayLength; i++) {
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[Math.floor(Math.random()*23)].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(messageLow == (`${prefix}racers canon`)){
            
            var assignRacers = ""
            var arrayLength = arr.length;
            for (var i = 0; i < arrayLength; i++) {
                let canon = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19]
            var numb = canon[Math.floor(Math.random()*18)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(messageLow == (`${prefix}racers noncanon`)){
            
            var assignRacers = ""
            var arrayLength = arr.length;
            for (var i = 0; i < arrayLength; i++) {
                let noncanon = [15, 18, 20, 21, 22]
            var numb = noncanon[Math.floor(Math.random()*5)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers top`) || messageLow == (`${prefix}racers s`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
                //gather racers from given tier
                for (let i = 0; i < racers.length; i++) {
                    if(racers[i].tier == 4){
                        list.push(racers[i].racernum - 1)
                    }
                }
                //pick random racer
                var numb = list[Math.floor(Math.random()*list.length)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers high`) || messageLow == (`${prefix}racers a`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
                //gather racers from given tier
                for (let i = 0; i < racers.length; i++) {
                    if(racers[i].tier == 3){
                        list.push(racers[i].racernum - 1)
                    }
                }
                //pick random racer
                var numb = list[Math.floor(Math.random()*list.length)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers mid`) || messageLow == (`${prefix}racers b`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
                //gather racers from given tier
                for (let i = 0; i < racers.length; i++) {
                    if(racers[i].tier == 2){
                        list.push(racers[i].racernum - 1)
                    }
                }
                //pick random racer
                var numb = list[Math.floor(Math.random()*list.length)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
        if(
            messageLow.startsWith(`${prefix}racers low`) || messageLow == (`${prefix}racers f`)) {
            var list = []
            var assignRacers = ""
            var arrayLength = arr.length;
            //for each member in voicechannel
            for (var i = 0; i < arrayLength; i++) {
                //gather racers from given tier
                for (let i = 0; i < racers.length; i++) {
                    if(racers[i].tier == 1){
                        list.push(racers[i].racernum - 1)
                    }
                }
                //pick random racer
                var numb = list[Math.floor(Math.random()*list.length)]
                assignRacers = assignRacers + "**" + arr[i].displayName + "**" + " - " + "*" + racers[numb].name + "*\n"
            }
            message.channel.send(assignRacers)
        }
    } else {
        message.channel.send("What you want? No one's in the voice channel.")
    }
    

}

/////   !challenge    //////


    if(message.content.startsWith(`${prefix}challenge`)) {
        var random1 = Math.floor(Math.random()*23)
        var random2 = Math.floor(Math.random()*25)
        var random3 = Math.floor(Math.random()*movieQuotes.length)
        message.channel.send("Race as **" + racers[random1].name + "** (" + (random1 + 1) + ") on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + "\n" + movieQuotes[random3] + " ")
    }


/////    ?help    //////


    if(message.content.startsWith(`?help`) || message.content.startsWith(`${prefix}command`)) {
        const helpEmbed = new Discord.RichEmbed()
            //.setColor('#00DE45')
            //.setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            .setTitle("Botto Command List")
            .addField(":large_blue_diamond: General", "**?help** - list of commands and racer stat guide\n" +
            "**!cleanup** - deletes command and bot messages within the past 10 messages\n" +
            "**!github** - reveals Botto github link\n" +
            "**!img** - reveals links to racer/track graphics on imgur")
            .addField(":busts_in_silhouette: Roles", "**!multiplayer** - adds or removes multiplayer role\n" +
            "**!speedrunning** - adds or removes speedrunning role")
            .addField(":game_die: Randomizers", "**!racer**(s) - random racer (adding “s” rolls for all players in voice channel)\n" +
            "!racer(s) **canon** - random canon racer\n" +
            "!racer(s) **noncanon** - random noncanon racer\n" +
            "!racer(s) **<tier>** - random racer from given tier (low/f, mid/b, high/a, top/s)\n" +
            "**!track** - random track\n" +
            "!track **<circuit>** - random track from given circuit\n" +
            "!track **<planet>** - random track from given planet\n" +
            "**!challenge** - random racer + random track\n" +
            "**!teams <n>** - randomly splits members in voice channel into *n* number of teams\n" +
            "**!chancecube** - “let fate decide”")
            .addField(":mag_right: Lookup", "**!racer <name/initials>** - lookup specific racer\n" +
            "**!track <name/acronym>** - lookup specific track\n"+
            "**!tier** - reveals tier list Botto uses to randomize\n" +
            "**!stat** - reveals racer stat guide\n")
            .addField(":telephone_receiver: Voice", "**!join** - adds Botto to the voice channel\n" +
            "**!leave** - kicks Botto from the voice channel")
        message.channel.send(helpEmbed)
    }

    if(message.content.startsWith(`${prefix}stat`)) {
        const helpEmbed = new Discord.RichEmbed()
            .setColor('#00DE45')
            .setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            .setTitle("Racer Stat Guide")
            
        message.channel.send(helpEmbed)
    }


//////      MISC     ////////


if(messageLow.startsWith(`${prefix}chancecube`)){
    var numb = Math.floor(Math.random()*3)
    if(numb == 0){
        message.channel.send(":large_blue_circle:")
    }
    else{
        message.channel.send(":red_circle:")
    }
}
   
if(message.content.startsWith(`${prefix}cleanup`) && message.channel.type !== "dm") {
    message.channel.fetchMessages({limit:10}).then(messages => {
        const botMessages = messages.filter(msg => msg.author.bot || msg.content.startsWith("!"));
        message.channel.bulkDelete(botMessages);
        messagesDeleted = botMessages.array().length; // number of messages deleted

        // Logging the number of messages deleted on both the channel and console.
        message.channel.send("*I gotta lots of junk!* \n`" + messagesDeleted + " messages deleted`");
        console.log('Deletion of messages successful. Total messages deleted: ' + messagesDeleted)
    }).catch(err => {
        console.log('Error while doing Bulk Delete');
        console.log(err);
    });
}

if(message.content.startsWith(`${prefix}github`) || message.content.startsWith(`${prefix}code`)){
    message.channel.send("https://github.com/louriccia/Botto")
}


if(message.content.startsWith(`${prefix}img`) || message.content.startsWith(`${prefix}image`)){
    message.channel.send("Racers: https://imgur.com/a/uqTaaIl")
    message.channel.send("Tracks: https://imgur.com/a/im0C1Tx")
    message.channel.send("Planets: https://imgur.com/a/G5yhapp")
}

if(messageLow.includes("botto")){
    message.channel.send("*What you want? Message `?help` for a list of commands.*")
}




if(message.content.startsWith(`${prefix}test`)){
    const helpEmbed = new Discord.RichEmbed()
        .setImage("https://i.imgur.com/4a1LSYg.gif")
        .setTitle("Beedo Skip")
        .setFooter("Its acE", "https://vignette.wikia.nocookie.net/starwars/images/f/f6/EE_Endocott_Headshot.png/revision/latest?cb=20131009010605")
    message.channel.send(helpEmbed)
}


if(message.content.startsWith(`${prefix}tier`)){  
    const helpEmbed = new Discord.RichEmbed()
            //.setColor('#00DE45')
            //.setImage("")
            //.setThumbnail("")
            .setTitle("Tier List")
            .addField(":gem: Top", "Ben Quadinaros\n'Bullseye' Navior\nMars Guo\nMawhonic\nAldar Beedo\nBoles Roor")
            .addField(":first_place: High", "Elan Mak\nNeva Kee\nRatts Tyerell\nClegg Holdfast\nToy Dampner")
            .addField(":second_place: Mid", "Slide Paramita\nEbe Endocott\nGasgano\nDud Bolt\nOdy Mandrell\nBozzie Baranta\nWan Sandage")
            .addField(":third_place: Low", "Anakin Skywalker\nArk 'Bumpy' Roose\nFud Sang\nTeemto Pagalies\nSebulba")
    message.channel.send(helpEmbed)
}



if (!message.guild) return; //anything that shouldn't be called in a dm goes after this

if(message.content.startsWith(`${prefix}speedrunning`)){
    let role = message.guild.roles.get("535973118578130954");
    let member = message.member;
    if(message.member.roles.has(role.id)){
        member.removeRole(role).catch(console.error)
        message.channel.send(member + " no longer has the speedrunning role")
    } else {
        member.addRole(role).catch(console.error);
        message.channel.send(member + " now has the speedrunning role")
    } 
}

if(message.content.startsWith(`${prefix}multiplayer`)){
    let role = message.guild.roles.get("474920988790751232");
    let member = message.member;
    if(message.member.roles.has(role.id)){
        member.removeRole(role).catch(console.error)
        message.channel.send(member + " no longer has the multiplayer role")
    } else {
        member.addRole(role).catch(console.error);
        message.channel.send(member + " now has the multiplayer role")
    } 
}

if(message.content.startsWith(`${prefix}teams`)){
    
    var assignTeams = ""
    if (isNaN(args)){
        message.channel.send("Specify the number of teams after the command. Ex: `!teams 2`")
    } 
    if(args == undefined || args == ""){
        message.channel.send("Specify the number of teams after the command. Ex: `!teams 2`")
    }
    else {
        var teams = ""
        var teamnum = args
        var playernum = arr.length
        var remainder = playernum%teamnum
        for(let i = 0; i<teamnum; i++){
            teams = teams + "**Team " + (i+1) + "**\n"
            for(let j = 0; j<(Math.floor(playernum/teamnum)); j++){
                var random = Math.floor(Math.random()*arr.length)
                teams = teams + arr[random].displayName + "\n"
                arr.splice(random,1)
                if(remainder > 0){
                var random = Math.floor(Math.random()*arr.length)
                teams = teams + arr[random].displayName + "\n"
                arr.splice(random,1)
                remainder = remainder - 1
                }

            }
            teams = teams + "\n"

        }
        message.channel.send(teams)
    }
}


if (message.content === ('!join')) {
    // Only try to join the sender's voice channel if they are in one themselves
    if (message.member.voiceChannel) {
        if(!message.guild.voiceConnection)

        {   var numb = Math.floor(Math.random()*voiceJoin.length)
            message.member.voiceChannel.join()
            .then(connection => { // Connection is an instance of VoiceConnection
                const dispatcher = connection.playArbitraryInput(voiceJoin[numb]);
                dispatcher.setVolume(1);
                dispatcher.on('end', () => {
                  connection.disconnect
                });
              })
        }
    } else {
      message.reply('You need to join a voice channel first!');
    }
} 
if (message.content === ('!leave')) {
    // Only try to join the sender's voice channel if they are in one themselves
    if (message.guild.voiceConnection) {
      message.guild.voiceConnection.disconnect()
    } else {
      message.reply("What you want? I'm not in a voice channel.");
    }
} 

function playSfx(message, filePath)
{
    if (message.channel.type !== "dm") {
    const voicecon = client.guilds.get("441839750555369474")
    if (message.member.voiceChannel && (voicecon.voiceConnection !== null)) {
        message.member.voiceChannel.join()
          .then(connection => { // Connection is an instance of VoiceConnection
            const dispatcher = connection.playFile(filePath);
            dispatcher.setVolume(0.5);
            dispatcher.on('end', () => {
              connection.disconnect
            });
            //dispatcher.on('error', e => {
              // Catch any errors that may arise
            //  console.log(e);
            //});
           
          })
          .catch(console.log);
      }
    }
}
})

client.on('guildMemberAdd', (guildMember) => {
    const guild = client.guilds.get("441839750555369474");
    const role = guild.roles.get("442316203835392001");
    let member = guildMember
    member.addRole(role).catch(console.error);
    client.channels.get("441839751235108875").send("Welcome to the Star Wars Episode I: Racer discord, " + guildMember + "! Take a look around! I've got everything you need'.");

 })

client.login(token);