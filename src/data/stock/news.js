// Wald Street Bets — the news headlines the market posts at the 12pm tick and
// resolves against trends at 6pm. Ported verbatim from the stock_market.html
// prototype.
//
//   sentiment: "boom" (+ trend), "crisis" (- trend), "slow" (neutral flavor).
//   level:     1–3, how hard a named stock's trend is moved (L3 jumps to the extreme).
//   stock:     symbol when a pilot/company is named; null => broad-market
//              (flips 3 stocks currently trending opposite the sentiment).
//   text:      {company}/{pilot}/{shareholder} placeholders are filled at post
//              time; a filled {company} becomes that headline's stock.

exports.PILOTS = [
    "Elan Mak", "Gasgano", "Boles Roor", "Ody Mandrell", "Ratts Tyerell", "Aldar Beedo",
    "Slide Paramita", "Bozzie Baranta", "Ben Quadinaros", "Teemto Pagalies", "Dud Bolt", "Neva Kee"
]

exports.SHAREHOLDERS = ["Jabba Desilijic Tiure", "Gardulla the Hutt", "Wald", "Watto", "Sebulba", "a silent partner"]

exports.NEWS = [
    // --- BOOM ---
    { sentiment: "boom", level: 1, stock: null, text: `Race Manufacturers' Summit to take place soon.` },
    { sentiment: "boom", level: 1, stock: null, text: `Tax break expected for recreational vehicle manufacturers.` },
    { sentiment: "boom", level: 1, stock: null, text: `Podracer manufacturer tours "Incredible news" ahead of next investor meeting.` },
    { sentiment: "boom", level: 2, stock: "KURT", text: `Kurtob poster boy Elan Mak favored to win the Dug Derby.` },
    { sentiment: "boom", level: 2, stock: "RULZ", text: `Tatooine Native to race Boonta Classic. "I'm the only human who can do it," says Anakin Skywalker, age 9.` },
    { sentiment: "boom", level: 2, stock: null, text: `{company} to give bonus to employees who attend Boonta race.` },
    { sentiment: "boom", level: 2, stock: null, text: `{shareholder} approves {company} CEO raise.` },
    { sentiment: "boom", level: 3, stock: "OPED", text: `Ord Pedrovia darling Gasgano proves "There's no ride like a Pedrovia" as green demon speeds across finish line.` },
    { sentiment: "boom", level: 3, stock: "BING", text: `Bin Gassi poster boy Boles Roor dedicates new album to Bin Gassi. "The cut of the royalties isn't bad either!"` },
    { sentiment: "boom", level: 3, stock: "BALT", text: `Balta-Trabaat's Ben Quadinaros continues to drive sales as rivalry with Sebulba becomes "one of the sport's best."` },
    { sentiment: "boom", level: 3, stock: "IPG", text: `Teemto Pagalies sets blazing time on Mon Gazza Speedway. "Irdani Performance Group helped me dial this one in."` },
    { sentiment: "boom", level: 3, stock: "RAMA", text: `Manta RamAir poster boy Aldar Beedo wows crowds with blazing speed and aggressive driving.` },
    { sentiment: "boom", level: 3, stock: null, text: `As galaxy gripped by podrace fever after human wins Boonta Classic, podracer manufacturers see record breaking profits.` },
    { sentiment: "boom", level: 3, stock: null, text: `Galactic Senate passes bill allowing outer rim territories to keep podracing as heritage sport. Parts and repair market booms.` },

    // --- CRISIS ---
    { sentiment: "crisis", level: 1, stock: null, text: `Devastating crash causes uncertainty of podracing.` },
    { sentiment: "crisis", level: 1, stock: null, text: `Sanctions discussed for manufacturers producing dangerous race craft.` },
    { sentiment: "crisis", level: 1, stock: null, text: `Galactic Senate hearing held to investigate podracing safety regulations.` },
    { sentiment: "crisis", level: 2, stock: "COPO", text: `Sebulba arraigned on numerous charges of attempted murder.` },
    { sentiment: "crisis", level: 2, stock: "IRTQ", text: `"Bullseye" Navior misses mark. Proposed name change to "30-point-wedge."` },
    { sentiment: "crisis", level: 2, stock: null, text: `{company} is under scrutiny for safety violations.` },
    { sentiment: "crisis", level: 2, stock: null, text: `{company} allegedly filing for chapter 11 bankruptcy.` },
    { sentiment: "crisis", level: 3, stock: "BALT", text: `Balta-Trabaat issues recall on BT-310 Quadra over power coupling tamper resistance issues.` },
    { sentiment: "crisis", level: 3, stock: "VKF", text: `Vokoff-Strood recalls Plug 8G 927 engines amid safety concerns over Cluster Array design.` },
    { sentiment: "crisis", level: 3, stock: "EXL", text: `Exelbrok recalls XL 5115 model for dangerous idle intake suction.` },
    { sentiment: "crisis", level: 3, stock: "TRCA", text: `Toy Dampner breaks down under questioning. Turca to discontinue 910 special.` },
    { sentiment: "crisis", level: 3, stock: "RULZ", text: `Anakin Skywalker to become Jedi. Radon-Ulzer loses poster boy.` },
    { sentiment: "crisis", level: 3, stock: null, text: `Major sanctions levied against all worlds supporting podracing.` },
    { sentiment: "crisis", level: 3, stock: null, text: `A new wave of hand-built racers spreads across the galaxy — investors in racer manufacturers brace for major dips.` },

    // --- SLOW (neutral flavor, no trend effect) ---
    { sentiment: "slow", level: 1, stock: null, text: `Jawas seen preparing for big business day near Mos Espa canyon dune turn.` },
    { sentiment: "slow", level: 1, stock: null, text: `Gravity tube 7 on Oovo IV closed for maintenance. Seek alternate routes.` },
    { sentiment: "slow", level: 1, stock: null, text: `Heavy traffic in Ando Prime Centrum. Seek alternate routes.` },
    { sentiment: "slow", level: 1, stock: null, text: `Krayt Dragons not seen in Laguna Cave in many years. Potentially driven out by Boonta Classic course.` },
    { sentiment: "slow", level: 1, stock: null, text: `Noted junk dealer on Tatooine receives T-14 Hyperdrive shipment ahead of Boonta. "Good to have some in stock, eh?"` }
]
