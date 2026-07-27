exports.OUTLETS = [
    "GNN", "Coruscant Times", "Podracer Quarterly", "Wald Street Journal",
    "New Plympto Today", "The Ploo 2 Observer", "Tatooine Suns", "Quadsmopolitan",
    "Pilots", "Correllian Mainstreet", "Rogue", "Racer's Digest", "Morvis", "The Daily Jawa",
    "The Outer Rim Gazette", "The Malastare Times", "The Mos Espa Tribune", "The Oovo IV Observer",
    "The Desolation Alley Dispatch", "The Ando Prime Post", "The Vinta Harvest Herald", "The Boonta Bulletin",
    "The Galactic Standard", "The Podracing Times", "The Pit Crew Press", "The Podracer's Post", "Cabled", "Moisture Farmer's Almanac", "Spice"
]


exports.SHAREHOLDERS = [
    "Jabba Desilijic Tiure", "Gardulla the Hutt", "Wald",
    "Watto", "Sebulba", "a silent partner", "Jar Jar Binks", "Nugtosh",
    "Ten Abu-Donba", "Oovo IV Detainee #42", "Ann Gella", "Bib Fortuna",
    "Qui Gon Jinn", "Nave Vengaris", "Captain Panaka", "Glup Shitto",
    "Dethro Glok", "Maja Fey'ja", "Fode and Beed", "Dax Gazaway", "Warden Fenn Booda", "Salacious B. Crumb", "Viceroy Gunray", "Senator Bail Organa"
]


exports.NEWS = [
    // ===================== POSITIVE (impact +1 to +3) =====================
    // --- impact +1: vague indications ---
    { impact: 1, stock: null, text: `Race Manufacturers' Summit to take place soon.` },
    { impact: 1, stock: null, text: `Podracer manufacturer touts "incredible news" ahead of next investor meeting.` },
    { impact: 1, stock: null, text: `Government officials from Malastare will be holding a town hall in the coming weeks.` },
    { impact: 1, stock: null, text: `Spice Miner's Guild saw record profits this week.` },
    { impact: 1, stock: null, text: `Ocanis Gas in talks to resume mining operations at Ord Ibanna.` },
    { impact: 1, stock: null, text: `Maja Fey'ja wins Baroonda Queenship.` },
    { impact: 1, stock: null, text: `Warden Fenn Booda seeks bid to have prisoners work 45 hours a week.` },
    { impact: 1, stock: null, text: `Tatooine holiday falls on weekend: What travelers should know.` },
    { impact: 1, stock: null, text: `Bendu Monks to release new ancient knowledge of the force for first time in 100 years.` },
    { impact: 1, stock: null, text: `Senator Nave Vengaris offers aid to citizens affected by sinking of western quarter.` },
    { impact: 1, stock: null, text: `Tax break expected for recreational vehicle manufacturers.` },


    // --- impact +2: specificity increases ---
    { impact: 2, stock: null, text: `{pilot} tells all in exciting interview.` },
    { impact: 2, stock: "RAMA", text: `Ando Prime Racetrack renamed in honor of Aldar Beedo.` },
    { impact: 2, stock: "KURT", text: `Kurtob poster boy Elan Mak favored to win the Dug Derby.` },
    { impact: 2, stock: "IPG", text: `Teemto Pagalies survives another death defying stunt.` },
    { impact: 2, stock: "JAK", text: `Law Student Ebe E. Endocott passes galactic bar examination.` },
    { impact: 2, stock: "EXL", text: `Race Pilot Ody Mandrell back in action after pit crew mishap.` },
    { impact: 2, stock: "SHLB", text: `Shelba renews contract with "The Manic Mechanic," Bozzie Baranta.` },
    { impact: 2, stock: "GPE", text: `Hok's greatest pilot, Mawhonic, sets blazing time on Andobi Mountain Run.` },
    { impact: 2, stock: "COPO", text: `Malastare raceway to be renamed "Sebulba's Legacy" as Gran-Dug relations improve.` },
    { impact: 2, stock: "COPO", text: `Mars Guo out of Mos Espa General hospital after rumors of death.` },
    { impact: 2, stock: "OPED", text: `Gasgano puts on show for Oovo IV detainees as part of prisoner enrichment program.` },
    { impact: 2, stock: "VKF", text: `Ratts Tyerell qualifies for annual Boonta race.` },
    { impact: 2, stock: "BALT", text: `Ben Quadinaros rents BT-310 Quadra. "The best pilots race the boonta, and the best pilots race Balta-Trabaat."` },
    { impact: 2, stock: "VKF", text: `"They Call Me Bumpy" Ark Roose tells all in new autobiography.` },
    { impact: 2, stock: "FG", text: `Farwan and Glott to reveal new experimental race craft.` },
    { impact: 2, stock: "RULZ", text: `Tatooine Native to race Boonta Classic. "I'm the only human who can do it," says Anakin Skywalker, age 9.` },
    { impact: 2, stock: "KEVO", text: `The Inside Scoop: Clegg Holdfast pulls back the curtain on the Galaxy's fastest sport.` },
    { impact: 2, stock: "ELCO", text: `Elsinore-Cordova pens deal with podracing prodigy Wan Sandage, who started the sport at just two years old.` },
    { impact: 2, stock: "BING", text: `Glimmick star Boles Roor to sing Tatooine Anthem at Mos Espa Arena for this year's Boonta Classic.` },
    { impact: 2, stock: "BRE", text: `Infamous convict Fud Sang has been given early parole on good behavior. "Serving my time has taught me just how long four lifetimes is."` },
    { impact: 2, stock: "TRCA", text: `Desolation alley inmates treated to visit from criminal rehabilitation advocate Toy Dampner.` },
    { impact: 2, stock: "VLP", text: `Vulptereen to rename RS 557 after homeworld species in stunning display of Planetary Patriotism.` },
    { impact: 2, stock: "IRTQ", text: `"Bullseye" swerves circles around competitors in Sunken City race on Aquilaris.` },
    { impact: 2, stock: "PZER", text: `Slide Paramita pleases crowds at Ando Prime Centrum in new Pizer Errol Stinger 627S.` },
    { impact: 2, stock: null, text: `{company} to give bonus to employees who attend Boonta race.` },
    { impact: 2, stock: null, text: `{company} will reveal major upcoming innovations at Galactic engineering conference.` },
    { impact: 2, stock: null, text: `{company} acquires smaller manufacturer to reduce shipping costs to mid and outer rim territories.` },
    { impact: 2, stock: null, text: `{company} strikes deal with Mustafar refinery to reduce manufacturing cost.` },
    { impact: 2, stock: null, text: `{pilot} to appear at annual race engineering conference on Coruscant.` },
    { impact: 2, stock: null, text: `{shareholder} approves {company} CEO raise.` },
    { impact: 2, stock: null, text: `{shareholder} approves new marketing directive at {company}.` },
    { impact: 2, stock: null, text: `{company} follows bold leadership changes proposed by {shareholder}.` },
    { impact: 2, stock: null, text: `{company} board of investors holding investor Gala on Denon. {shareholder} will be delivering the opening address.` },
    { impact: 2, stock: null, text: `{company} extends goodwill to consumers amid Senate hearings on Right to Repair legislation.` },
    { impact: 2, stock: null, text: `{shareholder} of the {company} board of investors recognizes {pilot}'s incredible performance this racing season with sponsorship deal adjustments.` },


    // --- impact +3: peaks ---
    { impact: 3, stock: null, text: `{company} on track for banner sales quarter as stock price reaches new heights.` },
    { impact: 3, stock: null, text: `{pilot} wins big during Vinta Harvest Classic, credits {company} for the victory.` },
    { impact: 3, stock: "KURT", text: `Elan Mak races Kurtob to top of Galactic Industrial Average. Pilots can't get enough.` },
    { impact: 3, stock: "TRCA", text: `Galactic Citizen award given to Toy Dampner by galactic correctional facilities board. "We at Turca stand with our boy, Toy," says {shareholder}.` },
    { impact: 3, stock: "RULZ", text: `Radon Ulzer poster boy Anakin Skywalker liberated and taken to Coruscant for Jedi training. "We can't take all the credit, but we couldn't let the Force do all the work," says {shareholder}.` },
    { impact: 3, stock: "OPED", text: `Ord Pedrovia darling Gasgano proves "There's no ride like a Pedrovia" as green demon speeds across the finish line.` },
    { impact: 3, stock: "BING", text: `Bin Gassi poster boy Boles Roor dedicates new album to Bin Gassi. "We're touched, and the cut of the royalties isn't bad either!" says {shareholder}.` },
    { impact: 3, stock: "BALT", text: `Balta-Trabaat's Ben Quadinaros continues to drive sales as rivalry with big-time dug Sebulba becomes "one of the sport's best."` },
    { impact: 3, stock: "KEVO", text: `Keizaar Volvec takes out full page ad as latest issue of Podracer Quarterly flies off shelves.` },
    { impact: 3, stock: "BRE", text: `Fud Sang exonerated as new evidence found by Bokaan Race Engineering legal team proves innocence. "We at Bokaan Race Engineering always knew Fud was innocent, and now the whole galaxy knows it, too," says {shareholder}.` },
    { impact: 3, stock: "COPO", text: `Mars Guo engaged to Ann Gella after Collor Pondrat mediates grievances between two star pilots. "True love ought to win more often," says {shareholder}.` },
    { impact: 3, stock: "COPO", text: `Sebulba and Collor Pondrat announce a collaborative effort, the Plug G Gargantua, to be piloted by Sebulba "as soon as it has throttles."` },
    { impact: 3, stock: "FG", text: `Farwan and Glott's new Block 2 Special promises to be "the next evolution in podracing," with test pilot Neva Kee flying it this year at Mos Espa.` },
    { impact: 3, stock: "IRTQ", text: `Irateq's "Bullseye" Navior took home gold in the Semipro Podracing Circuit this year. "I'm eyeing the boonta, and Irateq can take me there!"` },
    { impact: 3, stock: "IPG", text: `Teemto Pagalies sets blazing time on Mon Gazza Speedway. "The folks at Irdani Performance Group helped me dial this one in. I couldn't have done it without them."` },
    { impact: 3, stock: "VKF", text: `Ark "Bumpy" Roose uses race winnings to lobby for continued reparations for the Nuknogs on Sump. "We at Vokoff Strood will continue to lobby in the Senate to give these people justice," says {shareholder}.` },
    { impact: 3, stock: "VKF", text: `Ratts Tyerell announces arrival of 3rd child. "We at Vokoff Strood couldn't be happier for our star pilot," says {shareholder}.` },
    { impact: 3, stock: "JAK", text: `Ebe E. Endocott Esq. starts law firm on Triffis, specializing in injury law. "Mr. Endocott has survived a lot of scrapes thanks to our fine engineering here at JAK Racing," says {shareholder}.` },
    { impact: 3, stock: "EXL", text: `Exelbrok poster boy Ody Mandrell armed with newer, faster pit crew, scheduled to qualify for the Vinta Harvest Classic. "The boys at Exelbrok knew it was the droid, not the pod. They rebuilt her from the ground up!"` },
    { impact: 3, stock: "RAMA", text: `Manta RamAir poster boy Aldar Beedo continues to wow crowds with blazing speed and aggressive driving. "He's a stone cold killer out there, and we couldn't be more proud to sponsor him!" says {shareholder}.` },
    { impact: 3, stock: "PZER", text: `Pizer Errol named Turbine Trends Manufacturer of the Year as star pilot Slide Paramita earns a spot on the invitational circuit starting grid.` },
    { impact: 3, stock: "ELCO", text: `Elsinore-Cordova funds cure for off-world topographical disorientation in Devlikks. "Wan Sandage was very passionate about this issue. How could we refuse our star pilot?" says {shareholder}.` },
    { impact: 3, stock: "GPE", text: `Galactic Power Engineering provides funding to top negotiators in peace talks between Dugs and Gran on Malastare. "This conflict has gone on long enough," says {shareholder}.` },
    { impact: 3, stock: "SHLB", text: `Shelba superstar "The Manic Mechanic" Bozzie Baranta to appear on the Fode and Beed talk show about right-to-repair activism. "Shelba supports a pilot's right to repair," says {shareholder}.` },
    { impact: 3, stock: "VLP", text: `Vulptereen's Dud Bolt pleases crowds in the Malastare 100, earning a spot in the upcoming Vinta Harvest Classic. "He's been a great spokesman for the Vulptereen brand," says {shareholder}.` },
    { impact: 3, stock: null, text: `Podracer manufacturers see exponential rise in profits after sweeping manufacturing tax break passes on the Senate floor.` },
    { impact: 3, stock: null, text: `As galaxy gripped by podrace fever after human wins Boonta Classic, podracer manufacturers see record-breaking profits.` },
    { impact: 3, stock: null, text: `Galactic Senate passes bill allowing outer rim territories to maintain podracing as heritage sport. Market for parts and repairs booms.` },
    { impact: 3, stock: null, text: `Crisis on Naboo comes to a close just in time for the Vinta Harvest Classic. Core worlders and Outer Rim natives look toward the event to celebrate peacetime.` },


    // ===================== NEGATIVE (impact -1 to -3) =====================
    // --- impact -1: moderate warning ---
    { impact: -1, stock: null, text: `Galactic Senate hearing held to investigate podracing safety regulations.` },
    { impact: -1, stock: null, text: `Devastating crash casts uncertainty over podracing.` },
    { impact: -1, stock: null, text: `Delegates from Malastare under fire for employment of creepy skeletal creature as race marshal.` },
    { impact: -1, stock: null, text: `Groff Zugga under scrutiny for export of poorly refined spice.` },
    { impact: -1, stock: null, text: `Dethro Glok under fire as Ord Ibanna faces numerous OSHA violations.` },
    { impact: -1, stock: null, text: `Baroonda Council voting to impeach Maja Fey'ja.` },
    { impact: -1, stock: null, text: `Warden Fenn Booda accused of encouraging reckless behavior on promise of early parole.` },
    { impact: -1, stock: null, text: `Horrific accident during Boonta race places Tatooine tradition under scrutiny.` },
    { impact: -1, stock: null, text: `Ten Abu-Donba accused of not having boundless and ancient wisdom. Magic 8 ball found during GBI raid.` },
    { impact: -1, stock: null, text: `Aquilaris senate calls for vote of no confidence in Nave Vengaris.` },
    { impact: -1, stock: null, text: `Sanctions discussed for manufacturers producing dangerous race craft.` },


    // --- impact -2: specificity increasing ---
    { impact: -2, stock: null, text: `{pilot} accused of illegal modifications to podracer. Officials outraged.` },
    { impact: -2, stock: "RAMA", text: `Aldar Beedo linked to death of Borzu Nale.` },
    { impact: -2, stock: "KURT", text: `Elan Mak found to bear striking resemblance to criminal mastermind Kam Nale.` },
    { impact: -2, stock: "IPG", text: `Teemto Pagalies arraigned on public drunkenness charges.` },
    { impact: -2, stock: "JAK", text: `Ebe E. Endocott Esq. disbarred.` },
    { impact: -2, stock: "EXL", text: `Ody Mandrell's pit crew record beaten.` },
    { impact: -2, stock: "SHLB", text: `Bozzie Baranta caught taking pod to a professional mechanic.` },
    { impact: -2, stock: "GPE", text: `Mawhonic accused of spouting anti-dug rhetoric.` },
    { impact: -2, stock: "COPO", text: `Sebulba arraigned on numerous charges of attempted murder.` },
    { impact: -2, stock: "OPED", text: `Gasgano spotted doing 45 in the left lane.` },
    { impact: -2, stock: "VKF", text: `Ratts Tyerell stopped at Tatooine Security Administration checkpoint for possession of illegal weaponry.` },
    { impact: -2, stock: "BALT", text: `Ben Quadinaros booked on jaywalking charges.` },
    { impact: -2, stock: "VKF", text: `Ark Roose reportedly "not even that bumpy."` },
    { impact: -2, stock: "FG", text: `Neva Kee under investigation for tax fraud.` },
    { impact: -2, stock: "PZER", text: `Slide Paramita found heading pyramid scheme.` },
    { impact: -2, stock: "IRTQ", text: `"Bullseye" Navior misses mark. Proposed name change to "30-point-wedge."` },
    { impact: -2, stock: "RULZ", text: `Anakin Skywalker pulled over for joyride in N1 Starfighter.` },
    { impact: -2, stock: "KEVO", text: `Clegg Holdfast accused of yellow journalism. Podracer Quarterly subscriptions plummet.` },
    { impact: -2, stock: "ELCO", text: `Wan Sandage involved in head-on collision with sand crawler.` },
    { impact: -2, stock: "BING", text: `Boles Roor concert cancelled due to inclement weather.` },
    { impact: -2, stock: "TRCA", text: `Toy Dampner found to have ties to numerous Desolation Alley inmates at Oovo IV.` },
    { impact: -2, stock: "VLP", text: `Dud Bolt involved in road rage incident.` },
    { impact: -2, stock: null, text: `{company} is under scrutiny for safety violations.` },
    { impact: -2, stock: null, text: `{company} faces class action lawsuit over product quality.` },
    { impact: -2, stock: null, text: `{company} in legal battle for ownership of patents.` },
    { impact: -2, stock: null, text: `{company} allegedly filing for chapter 11 bankruptcy.` },
    { impact: -2, stock: null, text: `{pilot} involved in insider trading scandal.` },
    { impact: -2, stock: null, text: `{shareholder} accused by {company} of selling trade secrets.` },
    { impact: -2, stock: null, text: `{shareholder} threatened with removal from {company} board of investors.` },
    { impact: -2, stock: null, text: `{company} board of investors unable to agree on paint color for the meeting room. {shareholder} forced to make the deciding vote.` },
    { impact: -2, stock: null, text: `{company} accused of anti-consumer practices.` },
    { impact: -2, stock: null, text: `{shareholder} of the {company} board of investors to appear before the Galactic Senate on charges of reckless endangerment of {pilot}'s life.` },
    { impact: -2, stock: null, text: `{shareholder} and {shareholder} arguing over the future of {company}.` },


    // --- impact -3: crisis hits ---
    { impact: -3, stock: "TRCA", text: `Toy Dampner breaks down under questioning. Turca to discontinue the 910 Special.` },
    { impact: -3, stock: "RULZ", text: `Anakin Skywalker to become Jedi. Radon Ulzer loses poster boy.` },
    { impact: -3, stock: "OPED", text: `Gasgano has public crash-out over quality of Ord Pedrovia racing vehicle. Public perception of brand at an all-time low.` },
    { impact: -3, stock: "BING", text: `Boles Roor loses 5 million Peggats in drunken bet with Ben Quadinaros. Bin Gassi to foot the bill.` },
    { impact: -3, stock: "BALT", text: `Balta-Trabaat issues recall on BT-310 Quadra model for tamper-resistance issues with the power coupling.` },
    { impact: -3, stock: "KEVO", text: `Clegg Holdfast Podracer Quarterly article forced to issue several retractions. Keizaar Volvec executives did not respond when asked for comment.` },
    { impact: -3, stock: "BRE", text: `Bokaan Race Engineering poster boy Fud Sang's list of crimes released to public with several redactions.` },
    { impact: -3, stock: "COPO", text: `Collor Pondrat issues recall of Plug 2 Behemoth after catastrophic crash caused by unknown debris entering intake.` },
    { impact: -3, stock: "COPO", text: `Collor Pondrat issues recall of Plug F Mammoth after star pilot loses Boonta during tangling incident. "We knew there was a risk..." says {shareholder}.` },
    { impact: -3, stock: "FG", text: `Holonet in shock as leaked footage shows Neva Kee in custody of bounty hunter Aurra Sing. Farwan and Glott expected to negotiate release.` },
    { impact: -3, stock: "IRTQ", text: `Irateq discontinues sale of RQ 550C Dart amid increased reports of unusually fragile components.` },
    { impact: -3, stock: "IPG", text: `Irdani Performance Group recalls X1131 LongTail after engine cowl fails to stop shot from Tusken weaponry.` },
    { impact: -3, stock: "VKF", text: `Vokoff Strood recalls Plug 8G 927 engines amid safety concerns over Cluster Array design.` },
    { impact: -3, stock: "VKF", text: `Vokoff Strood issues recall for Titan 2150 amid rising reports of jammed accelerators.` },
    { impact: -3, stock: "JAK", text: `Ebe E. Endocott Esq. of Triffian Legal closes firm amid numerous allegations of illegal practice of law.` },
    { impact: -3, stock: "EXL", text: `Exelbrok recalls XL 5115 model for dangerous idle intake suction. "That pit droid proved what I said from the start," says {shareholder}.` },
    { impact: -3, stock: "PZER", text: `Pizer Errol forced to pay back victims of pyramid scheme operated by poster boy Slide Paramita.` },
    { impact: -3, stock: "SHLB", text: `Shelba to supply Bozzie Baranta with equipment for upkeep of 730 Razor, and pulls marketing materials of "The Manic Mechanic."` },
    { impact: -3, stock: "VLP", text: `Vulptereen found to be supplying Trade Federation with battle droids amidst Naboo invasion rumors. Shareholders did not respond when asked for comment.` },
    { impact: -3, stock: null, text: `Major sanctions levied against all worlds supporting and participating in the sport of podracing.` },
    { impact: -3, stock: null, text: `Numerous engineering groups found to be part of a replacement-parts price-gouging conspiracy. "{company} pods should only be repaired using {company} parts!" says {shareholder}.` },
    { impact: -3, stock: null, text: `"Clone Wars" conflict forces rationing of materials as companies like {company} diversify from racing craft into starfighters and tanks.` },
    { impact: -3, stock: null, text: `Galactic podracing season concludes with a young human, Anakin Skywalker, winning on a homemade racer. As a wave of hand-built racers spreads across the galaxy, investors in racer manufacturers brace for major dips.` },


    // ===================== NEUTRAL (impact 0 - flavor only, no trend move) =====================
    { impact: 0, stock: null, text: `Jawas seen preparing for big business day near Mos Espa canyon dune turn.` },
    { impact: 0, stock: null, text: `Prison riot near race arena on Oovo IV breaks out ahead of galactic circuit opening day. Expect delays.` },
    { impact: 0, stock: null, text: `Access to platform 12 on Ord Ibanna restricted for bridge repairs. Seek alternate routes.` },
    { impact: 0, stock: null, text: `Bridge from platform 10 to platform 7 collapsed due to stress. Construction materials lost in lower atmosphere of Ord Ibanna.` },
    { impact: 0, stock: null, text: `Heavy traffic in Ando Prime Centrum. Seek alternate routes.` },
    { impact: 0, stock: null, text: `Mining operations near Andobi Mountain causing tremors for locals on Ando Prime. Bendu Monks chanting louder to compensate.` },
    { impact: 0, stock: null, text: `Unexpected lava flow near fire mountain outside Majaneetza. Seek alternate routes.` },
    { impact: 0, stock: null, text: `Earthquake in area locals call "chiizlann" peaks at 8.2, causing infrastructure damage in Majaneetza. Numerous road closures.` },
    { impact: 0, stock: null, text: `Mos Espa Arena closed for renovations ahead of Boonta race.` },
    { impact: 0, stock: null, text: `Record turnout from "all corners of the outer rim territories" wreaks havoc on Mos Espa freeway exit. Expect delays.` },
    { impact: 0, stock: null, text: `Mon Gazza expanding mining efforts near final turn on famed Zugga Challenge racecourse. Drivers advised to be wary of slow-moving construction vehicles.` },
    { impact: 0, stock: null, text: `Minecart in shaft 5 has broken down on Mon Gazza, impacting efficiency.` },
    { impact: 0, stock: null, text: `Derailment outside Aquilaris tram station expected to impact travel time. Seek alternate routes.` },
    { impact: 0, stock: null, text: `Flood waters sink the sunken city even deeper on Aquilaris. Seek alternate routes.` },
    { impact: 0, stock: null, text: `Boulder mysteriously blocks major road on Malastare. Nugtosh did not respond to request for comment.` },
    { impact: 0, stock: null, text: `Methane lake near Sketto Leap catches fire. Fire brigade on scene. Seek alternate routes.` },
    { impact: 0, stock: null, text: `Riot near Desolation Alley has been quelled. Traffic is resuming normal flow.` },
    { impact: 0, stock: null, text: `Meteor storm in unshielded region of Oovo IV prison subsides. Visitation and delivery business permitted.` },
    { impact: 0, stock: null, text: `Construction on bridge A-38 to platform 6 on Ord Ibanna has wrapped. Detours no longer required.` },
    { impact: 0, stock: null, text: `Dethro Glok cuts ribbon at new Ord Ibanna access bridge connecting platforms 23 and 104.` },
    { impact: 0, stock: null, text: `Water treatment plant on Ando Prime no longer frozen solid. Conditions expected to improve.` },
    { impact: 0, stock: null, text: `Statue in Bendu Monk encampment repaired after freak podracing accident.` },
    { impact: 0, stock: null, text: `Maja Fey'ja present for ribbon cutting ceremony for new highway offramp in Majaneetza, giving access to Baroonda Coast from the capital city.` },
    { impact: 0, stock: null, text: `Bridge repairs complete outside of Majaneetza as the Semipro circuit begins.` },
    { impact: 0, stock: null, text: `Gate placed at service ramp entrance to Beggar's Canyon. Expected to prevent several accidents.` },
    { impact: 0, stock: null, text: `Krayt Dragons not seen in Laguna Cave in many years. Potentially driven out by Boonta Classic course.` },
    { impact: 0, stock: null, text: `New equipment purchased for Mon Gazza spice mining operations expected to increase yield by 2.35% annually.` },
    { impact: 0, stock: null, text: `Groff Zugga buys new hover chair ahead of Amateur Circuit opening day.` },
    { impact: 0, stock: null, text: `Aquilaris transport authority reports recently acquired repulsor trams running 5 minutes faster than more primitive designs.` },
    { impact: 0, stock: null, text: `Senator Nave Vengaris redraws zoning map. Designates Sunken City as available for development.` },
    { impact: 0, stock: null, text: `Mysterious race marshal Nugtosh to stop throwing boulders into public roads. Race tracks were not discussed.` },
    { impact: 0, stock: null, text: `New upgrades to power production reduce cost of running street lamps across Malastare.` },
    { impact: 0, stock: null, text: `Noted junk dealer on Tatooine receives T-14 Hyperdrive shipment ahead of Boonta. "Good to have some of these in stock, I think, ehh?"` },
    { impact: 0, stock: null, text: `Junk shop in Mos Espa expected to fold after owner files for bankruptcy. "Watto's shop is only undergoing a corporate restructuring. We'll be back in full force by the Vinta Harvest Classic, eh?"` },
    { impact: 0, stock: null, text: `Local Toydarian publishes new book: "No Money, No Parts, No Deal."` },
    { impact: 0, stock: null, text: `Former junk dealer tells all in exclusive interview.` },


    { impact: -1, stock: null, text: `Investigation: the horrific practices of Outer Rim slavery.` },
    { impact: -1, stock: null, text: `Recession indicator: blue milk prices higher than ever.` },
    { impact: 1, stock: null, text: `Formerly hidden Gungan City to sponsor planet core tours.` },
    { impact: -1, stock: null, text: `Senate body moves for a vote of no confidence in Chancellor Valorum.` },
    { impact: -2, stock: null, text: `Nute Gunray's new 50% tariffs on Naboo risk igniting a fresh trade war.` },
    { impact: 0, stock: null, text: `Tropical storm churns off Baroo coast, prompting storm alerts.` },
    { impact: 0, stock: null, text: `Live Results: Coruscant midterm primary elections.` },
    { impact: -2, stock: "BRE", text: `Fud Sang charged with 5th life sentence as new details about charges emerge.` },
    { impact: 2, stock: null, text: `Sheev Palpatine becomes Supreme Chancellor.` },
    { impact: 0, stock: null, text: `Yearly Galactic Tournament experiences scheduling delays.` },
    { impact: -2, stock: null, text: `{racer}'s repeated history of false starts brings racing legacy into question.` },
    { impact: 1, stock: null, text: `New lap record set on {track} by {pilot}.` },


    // ===================== PHANTOM MENACE HOLONET FEED =====================
    // The public-information layer: financial press, tabloids, and world noise.


    { impact: -2, stock: null, text: `Trade Federation blockade delays critical shipments across Mid Rim supply routes.` },
    { impact: -1, stock: null, text: `Senate committee weighs new tariffs on imported repulsor components.` },
    { impact: 1, stock: null, text: `Republic defense bill expected to increase demand for heavy engine components.` },
    { impact: 1, stock: null, text: `Naboo crisis sends demand for independent navigation systems soaring.` },
    { impact: 0, stock: null, text: `Senate debate over the Naboo blockade enters its third day with no resolution.` },
    { impact: 0, stock: null, text: `Queen Amidala arrives on Coruscant seeking immediate Senate intervention.` },
    { impact: 0, stock: null, text: `Federation officials deny reports of military occupation on Naboo.` },
    { impact: 0, stock: null, text: `Naboo forces reclaim Theed following the collapse of Trade Federation occupation.` },
    { impact: 0, stock: null, text: `Jedi Council silent on reports of mysterious tattooed warrior spotted during conflict at Theed.` },
    { impact: 0, stock: null, text: `Jedi Knight Qui-Gon Jinn murdered during the battle for Naboo. Vigil and funeral services will be held this week.` },


    // --- Podracing / sports ---
    { impact: 2, stock: null, text: `{pilot} tops the racer time charts after blistering lap times leave crowds in awe.` },
    { impact: -2, stock: null, text: `{pilot} forced to retire early after unexpected engine trouble.` },
    { impact: 2, stock: null, text: `{pilot} surges through field in a stunning comeback performance.` },
    { impact: -2, stock: null, text: `{pilot}'s pod suffers heavy damage in a qualifying incident.` },
    { impact: 2, stock: null, text: `{company}-powered racer sets a new course record.` },
    { impact: 0, stock: null, text: `Officials approve a revised course layout following pre-race inspection.` },
    { impact: -2, stock: null, text: `"Is this the real start?" Race officials still confused whether race results should be recorded as official.` },


    // --- Analyst / market desk (pundits can be confident and still wrong) ---
    { impact: 2, stock: null, text: `Analysts upgrade {company} after a strong showing for its racing division.` },
    { impact: -2, stock: null, text: `Investors question {company}'s aggressive push into high-risk racing markets.` },
    { impact: 2, stock: null, text: `{company} seen as undervalued after a quiet quarter, analysts say.` },
    { impact: -2, stock: null, text: `Is {company} overpriced? Analysts warn expectations may be impossible to meet.` },
    { impact: 2, stock: null, text: `{company} lands major contract following strong qualifying results.` },
    { impact: 2, stock: null, text: `{company} reports record orders for injectors, coolant rods.` },
    { impact: -2, stock: null, text: `Supplier dispute threatens {company} production ahead of major race weekend.` },
    { impact: 0, stock: null, text: `Podracing manufacturers mixed as investors await the Boonta Eve results.` },


    // --- Rumor mill ---
    { impact: 2, stock: null, text: `RUMOR: {company} preparing revolutionary new engine for coming circuit.` },
    { impact: -2, stock: null, text: `Sources claim {company} loses major supplier.` },
    { impact: 2, stock: null, text: `Insiders: {company} in talks with top-tier racer over lucrative new partnership.` },
    { impact: -2, stock: null, text: `Anonymous mechanic claims {company} prototype has "serious" heat problems.` },
    { impact: 0, stock: null, text: `{company} spotted entering private meeting with unidentified investors.` },


    // --- Clickbait / tabloid ---
    { impact: -2, stock: null, text: `Mechanics HATE this {company} engine for one BIG reason.` },
    { impact: 2, stock: null, text: `The little manufacturer embarrassing podracing's biggest names? It's {company}.` },
    { impact: -2, stock: null, text: `Is {company}'s racing empire about to COLLAPSE? Insiders speak out.` },
    { impact: -2, stock: null, text: `Leaked holovid appears to show {company} prototype EXPLODING during a secret test.` },
    { impact: 0, stock: null, text: `Seven things the Hutts DON'T want you to know about podracing.` },
    { impact: 0, stock: null, text: `Masters HATE him, find out how this 9 YEAR OLD BOY has MORE MIDICHLORIANS than even the STRONGEST JEDI!` },


    // --- Listicles ---
    { impact: 2, stock: null, text: `5 reasons {company} could be podracing's next engineering powerhouse.` },
    { impact: -2, stock: null, text: `6 engines mechanics say they'd never trust their lives to, and {company} made the list.` },
    { impact: 0, stock: null, text: `Every Boonta Eve contender ranked from safest bet to total laser brain.` },
    { impact: 0, stock: null, text: `12 podracers ranked by how terrifying they'd be to actually drive.` },


    // --- Puff pieces (positive sentiment, no real information) ---
    { impact: 2, stock: null, text: `Inside {company}: the racing outfit with a family atmosphere.` },
    { impact: 2, stock: null, text: `From foundry to finish line: how {company} builds a racing engine.` },
    { impact: 0, stock: null, text: `A day in the life of a professional podracing pit droid.` },
    { impact: 1, stock: "RULZ", text: `Servant of Two Masters: from junkyard slave to Padawan learner.` },


    // --- Society / culture ---
    { impact: 0, stock: null, text: `Meet Jar Jar Binks, the Gungan suddenly traveling with the Queen.` },
    { impact: 0, stock: null, text: `Meet R2-D2, the astromech droid credited with saving the Queen's starship.` },
    { impact: 0, stock: null, text: `Inside Queen Amidala's legendary royal wardrobe.` },


    // --- Mundane world-noise (galaxy-changing events, but the feed barely notices) ---
    { impact: 0, stock: null, text: `Coruscant speeder traffic expected to reach record levels ahead of Senate recess.` },
    { impact: 0, stock: null, text: `Study finds Kowakian monkey-lizards may be smarter than previously believed.` },
    { impact: 0, stock: null, text: `Are protocol droids becoming too talkative? Owners weigh in.` },
    { impact: 0, stock: null, text: `New luxury cruiser promises "the quietest hyperspace journey yet."` },
    { impact: 0, stock: null, text: `Opinion: podracing was better before the corporate sponsors ruined it.` },


    // ===================== TRADE PRESS FILLER =====================
    // The boring end of the feed: quarterly filings, shop talk, and "considering"
    // pieces from the engineering desk. Mostly impact 0, a company gets named and
    // the market shrugs. Engine/model names follow racer.js pod names.


    { impact: 0, stock: null, text: `{company} Q{quarter} earnings report released.` },
    { impact: 1, stock: null, text: `{company} testing new airbrake design.` },
    { impact: 1, stock: null, text: `{company} finishes new anodizing facility at assembly plant on {planet}.` },
    { impact: 2, stock: null, text: `{company} uncovers deposit of deep substrate foliated kalkite on {planet}.` },
    // {dip} reads the stock's last completed tick, so this one only runs on a company that actually fell.
    { impact: -1, stock: null, text: `{company} shares dip {dip} due to public lack of interest.` },


    { impact: 0, stock: "BALT", text: `Balta-Trabaat considering untangling cables on BT-310.` },
    { impact: 0, stock: "RAMA", text: `Manta RamAir considering adjusting angle of Mark IV engines.` },
    { impact: 0, stock: "KEVO", text: `Keizaar-Volvec considering central shroud to protect currently exposed components.` },
    { impact: 0, stock: "OPED", text: `Ord Pedrovia considering more linear aerospike design.` },
    { impact: 0, stock: "EXL", text: `Exelbrok considering L, M, and S variations of XL 5115 engine.` },
    { impact: 0, stock: "RULZ", text: `Radon-Ulzer considering higher capacity ventral fuel reserves.` },
    { impact: 0, stock: "COPO", text: `Collor Pondrat explains plug naming convention shift from numbers to letters.` },
    { impact: 0, stock: "COPO", text: `Collor Pondrat divulges storied history with engine size regulations.` },
    { impact: 0, stock: "FG", text: `Farwan & Glott considering pod with one engine next.` },
    { impact: 0, stock: "VKF", text: `Vokoff-Strood explains gaping hole in Cluster Array design.` },
    { impact: 0, stock: "VKF", text: `Vokoff-Strood considering adding more points to star-shaped Titan 2150 exhaust.` },
    { impact: 0, stock: "PZER", text: `Pizer-Errol considering narrower profile options for Stinger 627 S model.` },
    { impact: 0, stock: "TRCA", text: `Turca publishes history of 910 line leading up to the Special.` },
    { impact: 0, stock: "IRTQ", text: `Irateq explains fascination with accuracy related games of skill.` },
    { impact: 0, stock: "JAK", text: `JAK Racing explains J930 Dash-8 not a typo.` },
    { impact: 0, stock: "IPG", text: `Irdani Performance Group considering short tail variation of X1131 podracer.` },
    { impact: 0, stock: "BRE", text: `Bokaan Race Engineering considering quad-ram design.` },
    { impact: 0, stock: "GPE", text: `Galactic Power Engineering explains outrigger design choice on 3130 model.` },
    { impact: 0, stock: "VLP", text: `Vulptereen considering incremental adjustment on 327 that would fill or add air gap near rear thruster.` },
    { impact: 0, stock: "BING", text: `Bin Gassi believes fins are back in style. Will re-add them to Quadrijet 4-Barrel 904E cockpit.` },
    { impact: 0, stock: "ELCO", text: `Elsinore-Cordova working on street legal podracer to prove sport isn't dangerous.` },
    { impact: 0, stock: "KURT", text: `Kurtob experimental model continues trend of asymmetrical design.` },
    { impact: -1, stock: "SHLB", text: `Shelba rebrand postponed as focus testing yields mixed results.` }
]