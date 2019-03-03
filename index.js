const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();
var lookup = require("./data.js");

client.once('ready', () => {
    console.log('Ready!')
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
            arr.push(guildMember)
        }
    }

    //if member joins Multiplayer Lobby 1
    if(oldUserChannel === undefined && newUserChannel.id == 441840193754890250) {
        //random welcome message based on how many members are in voice channel
       if (arr.length == 1) {
            var random = Math.floor(Math.random()*2)
       } else if(arr.length == 2) {
            var random = Math.floor(Math.random()*3)+2
       } else if(2 < arr.length < 5 ) {
            var random = Math.floor(Math.random()*7)+5
       } else if(4 < arr.length < 8 ) {
            var random = Math.floor(Math.random()*6)+12
        } else if(7 < arr.length) {
            var random = Math.floor(Math.random()*4)+15}
       var str = welcomeMessages[random]
       client.channels.get("551786988861128714").send(str.replace("replaceme", newMember))
  
    } 
    //if member is already in any voice channel
    if(oldUserChannel !== undefined){ 
        //member leaves multiplayer or troubleshooting channel
        if((oldUserChannel.id == 441840193754890250 || oldUserChannel.id == 441840753111597086) && newUserChannel === undefined){ 
            random = Math.floor(Math.random()*goodbyeMessages.length)
            var str = goodbyeMessages[random]
            client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
        }
        //member is moving from one channel to another
        if(newUserChannel !== undefined) {
            //member moves from multiplayer to troubleshooting
            if(oldUserChannel.id == 441840193754890250 && newUserChannel.id == 441840753111597086 && newMember.id !== "288258590010245123") {
                random = Math.floor(Math.random()*troubleShooting.length)
                var str = troubleShooting[random]
                client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
        }
        //Renegawd moves from troubleshooting to multiplayer
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id == "288258590010245123") { 
            client.channels.get("551786988861128714").send("*Wouldn't have lasted long if <@288258590010245123> wasn't so good at fixing things.*")
        }
        //member moves back from troubleshooting to multiplayer
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id !== "288258590010245123") { 
            random = Math.floor(Math.random()*fixed.length)
            var str = fixed[random]
            client.channels.get("551786988861128714").send(str.replace("replaceme", oldMember))
        }
        }
    }
  })


client.on('message', message => {

var messageText = message.content
var messageLow = messageText.toLowerCase()
var random2 = Math.floor(Math.random()*2) //1 in # chances of using playerPicks instead of movieQuotes
var random3 = Math.floor(Math.random()*movieQuotes.length)
var random5 = Math.floor(Math.random()*playerPicks.length)
var chan = client.channels.get('441840193754890250');

//get list of members in voicechannel
if(chan !== undefined){
    var mems = chan.members;
    var arr = [];
    for (let [snowflake, guildMember] of mems){
        arr.push(guildMember)
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
        if(pickedPlayer !== undefined && random2 == 0) {
            trackEmbed.setDescription(planets[tracks[numb].planet].name + "\n" + circuits[tracks[numb].circuit].name + " Circuit: Race #" + tracks[numb].cirnum + "\n"  + "Track Favorite: " + tracks[numb].favorite + "\n \n" + str.replace("replaceme", pickedPlayer))
        } else {
            trackEmbed.setDescription(planets[tracks[numb].planet].name + "\n" + circuits[tracks[numb].circuit].name + " Circuit: Race #" + tracks[numb].cirnum + "\n"  + "Track Favorite: " + tracks[numb].favorite + "\n \n" + movieQuotes[random3])
        }
            
        message.channel.send(trackEmbed)
    }

    
/////    !racer     //////       

if(messageLow.startsWith(`${prefix}racer`)) {
    if(
    message.content == (`${prefix}racer`)) {
        var numb = Math.floor(Math.random()*23)}
    if(
    message.content == (`${prefix}racer canon`)) {
        let canon = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19]
        var numb = canon[Math.floor(Math.random()*18)]}
    if(
    message.content == (`${prefix}racer noncanon`)) {
        let canon = [15, 18, 20, 21, 22]
        var numb = canon[Math.floor(Math.random()*18)]}
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
    messageLow.startsWith(`${prefix}racer quadinaros`)) {
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

        const racerEmbed = new Discord.RichEmbed()
            .setThumbnail(racers[numb].img)
            .setColor('#00DE45')
            .setTitle(racers[numb].name)
            .setDescription("(" + (numb + 1) + ") " + racers[numb].intro)
            .setImage(racers[numb].stats)
            .setFooter(racers[numb].footer)
        message.channel.send(racerEmbed);
    }


/////   !challenge    //////


    if(message.content.startsWith(`${prefix}challenge`)) {
        var random1 = Math.floor(Math.random()*23)
        var random2 = Math.floor(Math.random()*25)
        var random3 = Math.floor(Math.random()*96)
        message.channel.send("Race as **" + racers[random1].name + "** (" + (random1 + 1) + ") on **" + tracks[random2].name + "** (" + (random2 + 1) + ")" + "\n" + movieQuotes[random3] + " ")
    }


/////    ?help    //////


    if(message.content.startsWith(`?help`)) {
        const helpEmbed = new Discord.RichEmbed()
            .setColor('#00DE45')
            .setImage("https://i.imgur.com/ZAQAjfB.png")
            //.setThumbnail("https://i.imgur.com/jzPQv54.png")
            //.setTitle("Help")
            .addField("!track", ":game_die: random track", true)
            .addField("!track <track name/acronym>", ":mag_right: lookup track", true)
            .addField("!racer", ":game_die: random racer", true)
            .addField("!racer <racer name/initials>", ":mag_right: lookup racer", true)
            .addField("!challenge", ":game_die: random racer + track", true)
        message.channel.send(helpEmbed)
    }


//////      MISC     ////////


if(messageLow.startsWith(`${prefix}chancecube`)){
    var numb = Math.floor(Math.random()*2)
    if(numb == 0){
        message.channel.send(":red_circle:")
    }
    else{
        message.channel.send(":large_blue_circle:")
    }
}
   
if(message.content.startsWith(`${prefix}cleanup`)) {
    message.channel
}

})

client.login(token);