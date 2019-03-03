const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const client = new Discord.Client();

let trackIntros = ['**The Boonta Training Course** on Tatooine | Amateur Circuit: Race #1 | Track Favorite: *Sebulba*', 
'**Mon Gazza Speedway** on Mon Gazza | Amateur Circuit: Race #2 | Track Favorite: *Teemto Pagalies*', 
"**Beedo's Wild Ride** on Ando Prime | Amateur Circuit: Race #3 | Track Favorite: *Aldar Beedo*", 
'**Aquilaris Classic** on Aquilaris | Amateur Circuit: Race #4 | Track Favorite: *Clegg Holdfast*', 
'**Malastare 100** on Malastare | Amateur Circuit: Race #5 | Track Favorite: *Dud Bolt*', 
'**Vengeance** on Oovo IV | Amateur Circuit: Race #6 | Track Favorite: *Fud Sang*', 
'**Spice Mine Run** on Mon Gazza | Amateur Circuit: Race #7 | Track Favorite: *Mars Guo*', 
"**Sunken City** on Aquilaris | Semi-Pro Circuit: Race #1 | Track Favorite: *'Bullseye' Navior*", 
'**Howler Gorge** on Ando Prime | Semi-Pro Circuit: Race #2 | Track Favorite: *Ratts Tyerell*', 
'**Dug Derby** on Malastare | Semi-Pro Circuit: Race #3 | Track Favorite: *Elan Mak*', 
"**Scrapper's Run** on Ord Ibanna | Semi-Pro Circuit: Race #4 | Track Favorite: *Wan Sandage*", 
'**Zugga Challenge** on Mon Gazza | Semi-Pro Circuit: Race #5 | Track Favorite: *Boles Roor*', 
'**Baroo Coast** on Baroonda | Semi-Pro Circuit: Race #6 | Track Favorite: *Neva Kee*', 
"**Bumpy's Breakers** on Aquilaris | Semi-Pro Circuit: Race #7 | Track Favorite: *Ark 'Bumpy' Roose*", 
'**Executioner** on Oovo IV | Galactic Circuit: Race #1 | Track Favorite: *Toy Dampner*', 
"**Sebulba's Legacy** on Malastare | Galactic Circuit: Race #2 | Track Favorite: *Sebulba*", 
"**Grabvine Gateway** on Baroonda | Galactic Circuit: Race #3 | Track Favorite: *Anakin Skywalker*", 
"**Andobi Mountain Run** on Ando Prime | Galactic Circuit: Race #4 | Track Favorite: *Mawhonic*", 
"**Dethro's Revenge** on Ord Ibanna | Galactic Circuit: Race #5 | Track Favorite: *Ody Mandrell*", 
"**Fire Mountain Rally** on Baroonda | Galactic Circuit: Race #6 | Track Favorite: *Ebe Endocott*", 
"**The Boonta Classic** on Tatooine | Galactic Circuit: Race #7 | Track Favorite: *Sebulba*", 
"**Ando Prime Centrum** on Ando Prime | Invitational Circuit: Race #1 | Track Favorite: *Slide Paramita*", 
"**Abyss** on Ord Ibanna | Invitational Circuit: Race #2 | Track Favorite: *Bozzie Baranta*", 
"**The Gauntlet** on Oovo IV | Invitational Circuit: Race #3 | Track Favorite: *Gasgano*", 
"**Inferno** on Baroonda | Invitational Circuit: Race #4 | Track Favorite: *Ben Quadinaros*"];

let trackPlanets = [
'Tatooine', 
'Mon Gazza', 
"Ando Prime", 
'Aquilaris', 
'Malastare', 
'Oovo IV',
'Mon Gazza',
"Aquilaris",
'Ando Prime',
'Malastare',
"Ord Ibanna",
'Mon Gazza',
'Baroonda',
"Aquilaris",
'Oovo IV',
"Malastare",
"Baroonda",
"Ando Prime",
"Ord Ibanna",
"Baroonda",
"Tatooine",
"Ando Prime",
"Ord Ibanna",
"Oovo IV",
"Baroonda"]

let trackColors = [
    '#4292B0', 
    '#F09813', 
    "#EC6423", 
    '#279843', 
    '#9D1F3C', 
    '#2BB79B',
    '#F09813',
    "#279843",
    '#EC6423',
    '#9D1F3C',
    "#E62121",
    '#F09813',
    '#683062',
    "#279843",
    '#2BB79B',
    "#9D1F3C",
    "#683062",
    "#EC6423",
    "#E62121",
    "#683062",
    "#4292B0",
    "#EC6423",
    "#E62121",
    "#2BB79B",
    "#683062"]

let trackPlanetimages = [
'https://i.imgur.com/41R8mPw.png', 
'https://i.imgur.com/eWyKXAT.png', 
"https://i.imgur.com/LZoc602.png", 
'https://i.imgur.com/C1pfkCp.png', 
'https://i.imgur.com/8wLzKY7.png', 
'https://i.imgur.com/5AUxSEL.png',
'https://i.imgur.com/eWyKXAT.png',
"https://i.imgur.com/C1pfkCp.png",
'https://i.imgur.com/LZoc602.png',
'https://i.imgur.com/8wLzKY7.png',
"https://i.imgur.com/pQ3y2rF.png",
'https://i.imgur.com/eWyKXAT.png',
'https://i.imgur.com/2AWNv2w.png',
"https://i.imgur.com/C1pfkCp.png",
'https://i.imgur.com/5AUxSEL.png',
"https://i.imgur.com/8wLzKY7.png",
"https://i.imgur.com/2AWNv2w.png",
"https://i.imgur.com/LZoc602.png",
"https://i.imgur.com/pQ3y2rF.png",
"https://i.imgur.com/2AWNv2w.png",
"https://i.imgur.com/41R8mPw.png",
"https://i.imgur.com/LZoc602.png",
"https://i.imgur.com/pQ3y2rF.png",
"https://i.imgur.com/5AUxSEL.png",
"https://i.imgur.com/2AWNv2w.png"]

let trackImages = [
"https://i.imgur.com/JSvGyqf.png", 
"https://i.imgur.com/Wvdj4Uk.png", 
"https://i.imgur.com/H4HQBtp.png", 
"https://i.imgur.com/U7OMEOP.png", 
"https://i.imgur.com/BPgmU5E.png", 
"https://i.imgur.com/tisatsV.png", 
"https://i.imgur.com/wmezIjI.png", 
"https://i.imgur.com/spzEzyT.png", 
"https://i.imgur.com/DxlcpDi.png", 
"https://i.imgur.com/VHntFPI.png", 
"https://i.imgur.com/03ht0jA.png", 
"https://i.imgur.com/eATaRCU.png", 
"https://i.imgur.com/1qgPaBn.png", 
"https://i.imgur.com/8IYnJPd.png", 
"https://i.imgur.com/56zVLzo.png", 
"https://i.imgur.com/SKOkkXt.png", 
"https://i.imgur.com/qn5ciVd.png", 
"https://i.imgur.com/DfAC7NU.png", 
"https://i.imgur.com/Y7IJRjS.png", 
"https://i.imgur.com/1r6hvzx.png", 
"https://i.imgur.com/jxChDkv.png", 
"https://i.imgur.com/W4hntzi.png", 
"https://i.imgur.com/wjciQH4.png",
"https://i.imgur.com/8yPEhxj.png",
"https://i.imgur.com/gnzanST.png"
]

let trackCircuits = [
"Amateur Circuit: Race #1",
"Amateur Circuit: Race #2",
"Amateur Circuit: Race #3",
"Amateur Circuit: Race #4",
"Amateur Circuit: Race #5",
"Amateur Circuit: Race #6",
"Amateur Circuit: Race #7",
"Semi-Pro Circuit: Race #1",
"Semi-Pro Circuit: Race #2",
"Semi-Pro Circuit: Race #3",
"Semi-Pro Circuit: Race #4",
"Semi-Pro Circuit: Race #5",
"Semi-Pro Circuit: Race #6",
"Semi-Pro Circuit: Race #7",
"Galactic Circuit: Race #1",
"Galactic Circuit: Race #2",
"Galactic Circuit: Race #3",
"Galactic Circuit: Race #4",
"Galactic Circuit: Race #5",
"Galactic Circuit: Race #6",
"Galactic Circuit: Race #7",
"Invitational Circuit: Race #1",
"Invitational Circuit: Race #2",
"Invitational Circuit: Race #3",
"Invitational Circuit: Race #4"]

let trackFavorites = [
"Sebulba",
"Teemto Pagalies", 
"Aldar Beedo", 
"Clegg Holdfast", 
"Dud Bolt",
"Fud Sang", 
"Mars Guo", 
"'Bullseye' Navior", 
"Ratts Tyerell", 
"Elan Mak",
"Wan Sandage",
"Boles Roor",
"Neva Kee",
"Ark 'Bumpy' Roose",
"Toy Dampner", 
"Sebulba", 
"Anakin Skywalker",
"Mawhonic",
"Ody Mandrell",
"Ebe Endocott",
"Sebulba",
"Slide Paramita",
"Bozzie Baranta", 
"Gasgano",
"Ben Quadinaros"];

let trackNames = ["The Boonta Training Course", 
"Mon Gazza Speedway", 
"Beedo's Wild Ride", 
"Aquilaris Classic", 
"Malastare 100", 
"Vengeance", 
"Spice Mine Run", 
"Sunken City", 
"Howler Gorge", 
"Dug Derby", 
"Scrapper's Run", 
"Zugga Challenge", 
"Baroo Coast", 
"Bumpy's Breakers", 
"Executioner", 
"Sebulba's Legacy", 
"Grabvine Gateway", 
"Andobi Mountain Run", 
"Dethro's Revenge", 
"Fire Mountain Rally", 
"The Boonta Classic", 
"Ando Prime Centrum", 
"Abyss",
"The Gauntlet",
"Inferno"
]

let racerIntros = ["It's the little human boy; born on Tatooine, uh... **Anakin Skywalker**. Well, let's hope he can just finish the race.",
"My money's on **Teemto Pagalies** for this race. Just look at the size of those engines!",
"There he is: the reigning champion of the Boonta Classic and the crowd favorite, **Sebulba**! \n *I'm betting heavily on Sebulba. He always wins!*",
"Well I've got my money on that little scrapper **Ratts Tyerell**. He may be small in stature, but he's got a couple of the biggest racing engines I've ever seen.",
"The track favorite is **Aldar Beedo**, a.k.a. *'The Hitman'*. Boy, he sure looks tough in that big Manta RamAir MARK IV podracer of his!",
"And in the front row, nearside pole position, **Mawhonic!**",
"I think **Ark 'Bumpy' Roose** is the one to watch today. He really wants to win!",
"I see that the dashing **Wan Sandage** has joined the group for today's race. He's been podracing since he was two!",
"Would you check out the size of those engines **Mars Guo** is reigning? *UNBELIEVABLE!*",
"**Ebe E. Endocott** has come out of nowhere to challenge the best podracers today. This confident Triffian boasts three semi-pro titles on Malastare!",
"The Vulptereen racer **Dud Bolt** is on the track today. Whoah, he is gonna be tough to beat.",
"Wow! Look at that! It's the galaxy famous **Gasgano** in his custom Ord Pedrovia.",
"The famous writer of Podracer Quarterly himself, **Clegg Holdfast** is gonna give the real thing a try today. Hmm hmm, hope he can finish the race!",
"**Elan Mak**. Just who is this mysterious podracer? He sure impressed us with his qualifying laps, whoever he is.",
"**Neva Kee** is piloting his new super experimental podracer. This may be the future of podracer racing folks so take a good look: *NO CABLES!*",
"I see three-time winner **Bozzie Baranta** is back for another try.",
"It's two-time winner **Boles Roor**. This Sneevel's got money to burn and he's put it all into his podracer!",
"Ahh he's reckless but a real crowd-pleaser. The Tatooine native **Ody Mandrell** is on the starting grid.",
"**Fud Sang** is down there! Well I thought he was serving four life sentences here at Oovo IV.",
"I'm betting on that tall drink of water from the Tund system, **Ben Quadinaros**. He's got four-- COUNT 'EM... *FOUR* ENGINES!",
"It's **Slide Paramita** in his modified Pizer-Errol Stinger. Very sharp!",
"**Toy Dampner** has joined the pack in his black and white Turca Special. Hooo! He looks fast!",
"I see **Bullseye Navior** is just taking his place on the grid. That's a quick podracer he's got there!"
]

let racerNames = ["Anakin Skywalker", //:PodChamp:", 
"Teemto Pagalies", 
"Sebulba", //:Sebulba:, 
"Ratts Tyerell", 
"Aldar Beedo", 
"Mawhonic", 
"Ark 'Bumpy' Roose", 
"Wan Sandage", // :WanSandwich:", 
"Mars Guo", 
"Ebe Endocott", 
"Dud Bolt", 
"Gasgano", 
"Clegg Holdfast", 
"Elan Mak", 
"Neva Kee", // :Stitch:", 
"Bozzie Baranta", // :SmugBozzie:", 
"Boles Roor", // :BolesRoor:", 
"Ody Mandrell", 
"Fud Sang", // :FudgeSang:", 
"Ben Quadinaros", // :SmugBen:", 
"Slide Paramita", 
"Toy Dampner", 
"'Bullseye' Navior"]

let racerThumbs = [
    "https://i.imgur.com/r0f3AZx.png", //Anakin
    "https://i.imgur.com/cY9al2j.png", //Teemto
    "https://i.imgur.com/ksFXGVY.png", //Sebulba
    "https://i.imgur.com/dy8vzxE.png", //Ratts
    "https://i.imgur.com/yxeO83I.png", //Aldar
    "https://i.imgur.com/Rwup3PG.png",
    "https://i.imgur.com/HZKlGuP.png",
    "https://i.imgur.com/wVHmnzF.png",
    "https://i.imgur.com/kFgb90f.png",
    "https://i.imgur.com/X5FkGex.png",
    "https://i.imgur.com/adPK5Fx.png",
    "https://i.imgur.com/a1E8rfj.png",
    "https://i.imgur.com/w2ohmFF.png",
    "https://i.imgur.com/e0LLWdc.png",
    "https://i.imgur.com/YGGniZX.png",
    "https://i.imgur.com/J4UtUDY.png",
    "https://i.imgur.com/Aag6azo.png",
    "https://i.imgur.com/W3AEoqB.png",
    "https://i.imgur.com/IqoaMTF.png",
    "https://i.imgur.com/NPSbSkO.png",
    "https://i.imgur.com/6D9qoF5.png",
    "https://i.imgur.com/y5zcBNj.png",
    "https://i.imgur.com/KyOXqW5.png"
]

let racerStats = [
"https://i.imgur.com/odMyOQz.png", 
"https://i.imgur.com/iolB417.png", 
"https://i.imgur.com/b25R330.png", 
"https://i.imgur.com/i2vvprW.png", 
"https://i.imgur.com/7nEMwPA.png", 
"https://i.imgur.com/DLQ8Dsw.png", 
"https://i.imgur.com/8QwfLc1.png", 
"https://i.imgur.com/c3gzoTP.png", 
"https://i.imgur.com/QcgDed3.png", 
"https://i.imgur.com/Zh1HYoy.png", 
"https://i.imgur.com/2gqsyJ6.png", 
"https://i.imgur.com/KD6vTnA.png", 
"https://i.imgur.com/5u249cm.png", 
"https://i.imgur.com/KFpId6j.png", 
"https://i.imgur.com/yWCoXq7.png", 
"https://i.imgur.com/Grj4Ywe.png", 
"https://i.imgur.com/hRtG6To.png", 
"https://i.imgur.com/WfPLhsZ.png", 
"https://i.imgur.com/sCuuyzA.png", 
"https://i.imgur.com/6cUQLKa.png", 
"https://i.imgur.com/Rs0UHlz.png", 
"https://i.imgur.com/4TrcD0L.png", 
"https://i.imgur.com/QMaX1S3.png"
]

let racerFooter = [
    "Species/Homeworld: Human from Tatooine	| Pod: Radon-Ulzer 620C racing engines	| Track Favorite: Grabvine Gateway", 
    "Species/Homeworld: Veknoid from Moonus Mandel	| Pod: IPG-X1131 LongTail	| Track Favorite: Mon Gazza Speedway", 
    "Species/Homeworld: Dug from Malastare	| Pod: Split-X Configured Collor Pondrat Plug-F Mammoths	| Track Favorite: The Boonta Training Course, Sebulba's Legacy, The Boonta Classic",  
    "Species/Homeworld: Aleena from Aleen	| Pod: Titan 1250 Scatalpen	| Track Favorite: Howler Gorge",
    "Species/Homeworld: Glymphid from Ploo II	| Pod: Manta RamAir Turbojet	| Track Favorite: Beedo's Wild Ride",
    "Species/Homeworld: Gran from Hok	| Pod: Galactic Power Engineering GPE-3130	| Track Favorite: Andobi Mountain Run", 
    "Species/Homeworld: Nuknog from Sump	| Pod: Plug-8G 927 Cluster Array	| Track Favorite: Bumpy's Breakers", 
    "Species/Homeworld: Devlikk from Ord Radama	| Pod: Elsinore-Cordova-powered	| Track Favorite: Scrapper's Run", 
    "Species/Homeworld: Phuii from Phu	| Pod: Collor Pondrat Plug-2 Behemoth	| Track Favorite: Spice Mine Run", 
    "Species/Homeworld: Triffian from Triffis	| Pod: JAK racing J930 Dash-8	| Track Favorite: Fire Mountain Rally", 
    "Species/Homeworld: Vulptereen from Vulpter	| Pod: Vulptereen RS 557	| Track Favorite: Malastare 100", 
    "Species/Homeworld: Xexto from Troiken	| Pod: Custom Ord Pedrovia	| Track Favorite: The Gauntlet",
    "Species/Homeworld: Nosaurian from New Plympto	| Pod: Keizaar-Volvec KV9T9-B Wasp	| Track Favorite: Aquilaris Classic", 
    "Species/Homeworld: Fluggrian from Ploo IV	| Pod: Kurtob KRT 410C	| Track Favorite: Dug Derby", 
    "Species/Homeworld: Xamster from Xagobah	| Pod: Farwan & Glott FG 8T8-Twin Block2 Special	| Track Favorite: Baroo Coast", 
    "Pod: Shelba 730S Razor	| Track Favorite: Abyss",
    "Species/Homeworld: Sneevel from Sneeve	| Pod: Quadrijet 4-Barrel 904E	| Track Favorite: Zugga Challenge", 
    "Species/Homeworld: Er'Kit from Tatooine	| Pod: Exelbrok XL 5115	| Track Favorite: Dethro's Revenge", 
    "Pod: Bokaan Race Engineering BRE Block6 Tri-Ram	| Track Favorite: Vengeance", 
    "Species/Homeworld: Toong from Tund	| Pod: Balta-Trabaat BT310	| Track Favorite: Inferno",
    "Species: Ciasi	| Pod: Pizer-Errol Stinger 627 S	| Track Favorite: Ando Prime Centrum", 
    "Pod: Turca 910 Special	| Track Favorite: Executioner", 
    "Pod: Iratez RQ 550C Dart-driven	| Track Favorite: Sunken City", 
    
]

let movieQuotes = [
    "*Remember: Your focus determines your reality.*",
    "*Remember, concentrate on the moment. Feel, don't think. Trust your instincts.*",
    "*May the force be with you.*",
    "*You must have Jedi reflexes if you race pods.*",
    "*The ability to speak does not make you intelligent.*",
    "*Why do I get the feeling that we've picked up another pathetic life form?*",
    "*Now, be brave, and don't look back. Don't look back.*",
    "*Wipe them out. All of them.*",
    "*We will watch your career with great interest.*",
    "*Now this is pod racing!*",
    "*Keep your concentration here and now, where it belongs.*",
    "*A big turnout here, from all corners of the Outer Rim territories.*",
    "*I see the contestants are making their way out onto the starting grid.*",
    "*I see the flags are moving onto the track.*",
    "*Greed can be a very powerful ally.*",
    "*I have a bad feeling about this...*",
    "*Yippee!*",
    "*I want to see your spaceship the moment the race is over.*",
    "*The negotiations will be short.*",
    "*You won't walk away from this one, you slave scum!*",
    "*You're Bantha fodder!*",
    "*Better stop your friend's betting or I'll end up owning him, too.*",
    "*A surprise, I'm sure, but a welcome one.*",
    "*I foresee you will become a much wiser man than I.*",
    "*Eat my exhausts!*",
    "*Looks like you need a pit stop, buddy!*",
    "*Ootmians!*",
    "*Eat my dust, slimeball!*",
    "*Eat fumes, wormo!*",
    "*How's the afterblast, pal?*",
    "*Watch out, exhaust-for-brains!*",
    "*My ronto moves faster than you!*",
    "*I can run faster than your podracer!*",
    "*Nice crop duster!*",
    "*Chesko, peedunky.*",
    "*Boska!*",
    "*Yavoo!*",
    "*You'll get real used to the glow of my afterburners, friend.*",
    "*I hope watto gave you a good deal for that junkpile!*",
    "*Is that your podracer, or are you selling scrap metal?*",
    "*What's the matter? Your pit droids take the day off?*",
    "*I've seen better parts at a junk market!*",
    "*My engines are faster than yours!*",
    "*Looks like Watto cheated you on that part*",
    "*You need to go back to racing school.*",
    "*Did Watto charge you for those parts?*",
    "*First time racing, rookie poodoo?*",
    "*I've seen better in Watto's junkyard.*",
    "*You're gonna fry.*",
    "*You're just a little gravel-maggot.*",
    "*Watto sell you that podracer?*",
    "*I've seen better parts in a waste dump.*",
    "*You're headed for a burnout, pallie.*",
    "*You smell like Bantha poodoo.*",
    "*Look for my podracer when I lap you!*",
    "*Nice cropduster!*",
    "*Follow too closely and you'll get cooked.*",
    "*You race like an old moisture farmer*",
    "*It's a new lap record!*",
    "*Mind tricks don't work on me. Only money!*",
    "*You're gonna lose unless you upgrade your podracer I think*",
    "*You race pretty good, no doubts there, huh? Hahaha*",
    "*You cannot beat Sebulba, he always wins! Hahaha*",
    "*Maybe next time you win, huh? Hahaha*",
    "*What? You think you're gonna beat Sebulba with that podracer of yours? Whahh!*",
    "*Have you seen my `!chancecube`?*",
    "*Better stop betting or I'll own you!*",
    "*Outlanders. They come here, how do they find me? They come here, they mess up my store-- Hey!*",
    "*They come here. They look around. They no buy. Why nobody buy? Eyyyyyyyy*",
    "*I just got skylockered*",
    "*My game just crashed...*",
    "*Is it lagging for anyone else?*",
    "*Everyone has their fps capped, right?*",
    "*How am I not in last?*",
    "*Really? This track again?*",
    "*No skips allowed!*",
    "*You guys know about the shortcut on this one, right?*",
    "*Tilting is op*",
    "*Really? You're playing as THAT podracer?*",
    "*Lag. Laaaaaaag. LAAAAAAAAAAAAAG.*",
    "*Really? THAT crashed me!?*",
    "*I don't see the lobby...*",
    "*Is anyone streaming this?*",
    "*How am I in first?*",
    "*Did you just get lapped?*",
    "*My controller isn't working.*",
    "*My sound isn't working.*",
    "*Cue <@288258590010245123> robot voice*",
    "*I'm playing on a crappy laptop.*",
    "*Who's hosting right now?*",
    "*Who has good internet?*",
    "*<@288258590010245123>: Alright, I want to try something real quick...*",
    "*Was that you who just crashed?*",
    "*So many Bullseyes...*",
    "*Total: 00:00.000*",
    "*Control Q! Control Q!*",
    "*This is a cursed lobby.*"
]

let a = "replaceme";

let playerPicks = [
    `*May the force be with you, ${a}*`,
    `*And you, young ${a}. We will watch your career with great interest.*`,
    `*The chosen one ${a} may be.*`,
    `*I'm betting heavily on ${a}.*`,
    `*You have been well trained, ${a}. They will be no match for you.*`,
    `*That's a nice pod you have there, ${a}. I hope you didn't kill anyone I know for it.*`,
    `*The force is unusually strong with you, ${a}. That much is clear.*`,
    `*${a}'s midi-chlorian count is off the chart. Over 20,000!*`,
    `*I warn you, ${a}. No funny business.*`,
    `*You won't walk away from this one, ${a}, you slave scum.*`,
    `*The current record holder for this track is... ${a}!*`
]

let welcomeMessages = [
    //first
    `*Welcome, ${a}. I see the contestants are making their way out onto the starting grid.*`,
    `*It's ${a}! A surprise, I'm sure, but a welcome one.*`,
    //2
    `*This is getting out of hand, ${a}. Now there are two of them!*`,
    `*Hello there, ${a}*`,
    `*Hello boyos! It's ${a}!*`,
    //3-4
    `*${a}! I see the flags are moving onto the track.*`,
    `*Hey it looks like they're clearing the grid, ${a}*`,
    `*Start your engines! ${a} is here!*`,
    `*A harty hello to ${a}!*`,
    `*And back again it's the mighty ${a}!*`,
    `*And hoping for a big win today, ${a}, with his record-setting pit droid team.*`,
    `*And in the front row, nearside pole position, ${a}!*`,
    //5-7
    `*${a}. They come here, how do they find me? They come here, they mess up my store-- Hey!*`,
    `*Oh ${a}, dissen gonna be messy. Me no watch'n!*`,
    `*${a}? Why do I get the feeling that we've picked up another pathetic life form?*`,
    `*And a late entry, young ${a}, a local boy.*`,
    `*And there goes ${a}! He will be hard-pressed to catch up with the leaders.*`,
    `*Look. Here he comes. It's ${a}!*`,
    //>8
    `*A big turnout here, from all corners of the Outer Rim territories. It's ${a}!*`
]

let goodbyeMessages = [
    `*I sense a disturbance in the force. Clouded ${a}'s future is.*`,
    `*${a}? What's happening? A communications disruption can mean only one thing: invasion.*`,
    `*The fastest podracer in the galaxy... ${a}!*`,
    `*Maybe next time you win, huh ${a}?*`,
    `*Get lost ${a}! Come back when you got some money!*`,
    `*You were the chosen one, ${a}!*`,
    `*You're going down a path I can't follow, ${a}!*`,
    `*${a} was banished because he was clumsy.*`

]

let troubleShooting = [
    `*Wait. Little ${a} has stalled.*`,
    `*${a}'s been forced onto the service ramp!*`,
    `*Looks like ${a} needs a pitstop.*`,
    `*${a}'s in trouble! Sebulba takes the lead!*`,
    `*Well it looks like ${a} is having engine trouble also.*`,
    `*Ooh, there goes ${a}'s power coupling*!`,
    `*${a}'s spinning out of control!*`,
    `*Count ${a} outta dis one.*`,
    `*Oh ${a}, I don't care what universe you're from. That's gotta hurt!*`
]

let fixed = [
    `*Amazing! A quick control thrust and ${a} is back on course!*`
]

client.once('ready', () => {
    console.log('Ready!')
})

client.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.voiceChannel
    let oldUserChannel = oldMember.voiceChannel
    var chan = client.channels.get('441840193754890250');
    if(chan !== undefined){
        var mems = chan.members;
        var arr = [];
        for (let [snowflake, guildMember] of mems){
            arr.push(guildMember)
        }
    }
  
    if(oldUserChannel === undefined && newUserChannel.id == 441840193754890250) {
  
       // User Joins a voice channel
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
       client.channels.get("444208252541075476").send(str.replace("replaceme", newMember))
  
    } 
    if(oldUserChannel !== undefined){ //user is already in any voice channel

        if((oldUserChannel.id == 441840193754890250 || oldUserChannel.id == 441840753111597086) && newUserChannel === undefined){ //member leaves multiplayer channel
        // User leaves a voice channel
        random = Math.floor(Math.random()*goodbyeMessages.length)
        var str = goodbyeMessages[random]
        client.channels.get("444208252541075476").send(str.replace("replaceme", oldMember))
        }
        if(newUserChannel !== undefined) { //user is moving from one channel to another
            
            if(oldUserChannel.id == 441840193754890250 && newUserChannel.id == 441840753111597086 && newMember.id !== "288258590010245123") { //user moves from multiplayer to troubleshooting
            random = Math.floor(Math.random()*troubleShooting.length)
            var str = troubleShooting[random]
            client.channels.get("444208252541075476").send(str.replace("replaceme", oldMember))
        }
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id == "288258590010245123") { //Renegawd moves from troubleshooting to multiplayer
            client.channels.get("444208252541075476").send("*Wouldn't have lasted long if <@288258590010245123> wasn't so good at fixing things.*")
        }
        if(oldUserChannel.id == 441840753111597086 && newUserChannel.id == 441840193754890250 && newMember.id !== "288258590010245123") { //user moves from troubleshooting to multiplayer
            random = Math.floor(Math.random()*fixed.length)
            var str = fixed[random]
            client.channels.get("444208252541075476").send(str.replace("replaceme", oldMember))
        }
        }
    }
  })


client.on('message', message => {

var messageText = message.content
var messageLow = messageText.toLowerCase()
var random2 = Math.floor(Math.random()*2)
var random3 = Math.floor(Math.random()*movieQuotes.length)
var random5 = Math.floor(Math.random()*playerPicks.length)
var chan = client.channels.get('441840193754890250');
if(chan !== undefined){
    var mems = chan.members;
    var arr = [];
    for (let [snowflake, guildMember] of mems){
        arr.push(guildMember)
    }
    var pickedPlayer = arr[Math.floor(Math.random()*arr.length)]
}


/////   TRACK   /////


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
        .setThumbnail(trackPlanetimages[numb])
        .setColor(trackColors[numb])
        .setImage(trackImages[numb])
        .setTitle(trackNames[numb])
        var str = playerPicks[random5]
        if(pickedPlayer !== undefined && random2 == 1) {
            trackEmbed.setDescription(trackPlanets[numb] + "\n" + trackCircuits[numb] + "\n"  + "Track Favorite: " + trackFavorites[numb] + "\n \n" + str.replace("replaceme", pickedPlayer))
        } else {
            trackEmbed.setDescription(trackPlanets[numb] + "\n" + trackCircuits[numb] + "\n"  + "Track Favorite: " + trackFavorites[numb] + "\n \n" + movieQuotes[random3])
        }
            
        message.channel.send(trackEmbed)
    }

    
/////    RACER     //////       

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
            .setThumbnail(racerThumbs[numb])
            .setColor('#00DE45')
            .setTitle(racerNames[numb])
            .setDescription("(" + (numb + 1) + ") " + racerIntros[numb])
            .setImage(racerStats[numb])
            .setFooter(racerFooter[numb])
        message.channel.send(racerEmbed);
    }


/////   CHALLENGE    //////


    if(message.content.startsWith(`${prefix}challenge`)) {
        var random1 = Math.floor(Math.random()*23)
        var random2 = Math.floor(Math.random()*25)
        var random3 = Math.floor(Math.random()*96)
        message.channel.send("Race as **" + racerNames[random1] + "** (" + (random1 + 1) + ") on **" + trackNames[random2] + "** (" + (random2 + 1) + ")" + "\n" + movieQuotes[random3] + " ")
    }

    if(message.content.startsWith(`${prefix}cleanup`)) {
        message.channel
    }


/////    HELP    //////


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
   
})

client.login(token);