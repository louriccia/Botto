// The 21 companies traded on the Wald Street Exchange. Each starts at price 100.
// These are the SWE1R podracer manufacturers/engines (ported from the
// stock_market.html prototype).
//
// `baseVolatility` (per-tick price swing) is derived from each pod's FLAVOR —
// the strategy-guide pod descriptions and pilot bios — on a spectrum from
// "stable blue-chip" to "boom-or-bust". Low = balanced / durable / cool-running
// / dependable; high = unstable / overheats / fragile / one-dimensional speed
// demon. Range is kept at 0.015–0.060 (same band as the prototype). See the
// inline note on each line for the specific flavor that set its value.
// COPO and VKF each cover two pods, so their value blends both descriptions.
exports.COMPANIES = [
    { symbol: "BALT", name: "Balta-Trabaat", price: 100, baseVolatility: 0.055, trend: "bullish" },        // Ben Quadinaros — "very fast but inherently unstable... prone to stalling"
    { symbol: "BING", name: "Bin Gassi", price: 100, baseVolatility: 0.060, trend: "neutral" },            // Boles Roor — "running hot isn't a good idea... cooling and repair limited... top speed that high"
    { symbol: "BRE", name: "Bokaan Race Engineering", price: 100, baseVolatility: 0.034, trend: "bullish" }, // Fud Sang — "won't win on top speed until upgraded... touch-and-go"
    { symbol: "COPO", name: "Collor Pondrat", price: 100, baseVolatility: 0.051, trend: "neutral" },        // Sebulba/Mars Guo — "tremendous top speed... slow accel makes him vulnerable"; a "considerable threat"
    { symbol: "ELCO", name: "Elsinore-Cordova", price: 100, baseVolatility: 0.028, trend: "bullish" },      // Wan Sandage — "incredible traction... practically immune to varying terrain"
    { symbol: "EXL", name: "Exelbrok", price: 100, baseVolatility: 0.044, trend: "bearish" },               // Ody Mandrell — "reckless... spends a lot of time slamming opponents; stay out of his way"
    { symbol: "FG", name: "Farwan & Glott", price: 100, baseVolatility: 0.033, trend: "neutral" },          // Neva Kee — "most unusual" experimental Y-frame; great accel/traction "but worse turning than expected"
    { symbol: "GPE", name: "Galactic Power Engineering", price: 100, baseVolatility: 0.031, trend: "strong_bullish" }, // Mawhonic — "passable repair, cooling, traction... neither Podracer nor pilot is formidable"
    { symbol: "IRTQ", name: "Irateq", price: 100, baseVolatility: 0.019, trend: "neutral" },                // 'Bullseye' Navior — "amazing traction and very impressive cooling and repair"
    { symbol: "IPG", name: "Irdani Performance Group", price: 100, baseVolatility: 0.026, trend: "strong_bullish" }, // Teemto Pagalies — "excellent traction, acceleration and repair... easy to upgrade"
    { symbol: "JAK", name: "JAK Racing", price: 100, baseVolatility: 0.021, trend: "bearish" },             // Ebe Endocott — "looks cool and runs cool... high in traction and repair... at or above average"
    { symbol: "KEVO", name: "Keizar-Volvec", price: 100, baseVolatility: 0.036, trend: "neutral" },        // Clegg Holdfast — "superb handling as long as you don't want to slow down"
    { symbol: "KURT", name: "Kurtob", price: 100, baseVolatility: 0.038, trend: "bearish" },                // Elan Mak — "didn't have much money... low acceleration and low top speed—not a good combination"
    { symbol: "OPED", name: "Ord Pedrovia", price: 100, baseVolatility: 0.030, trend: "strong_bearish" },   // Gasgano — "may not look pretty, but it stays on the track no matter what... good repair rating"
    { symbol: "PZER", name: "Pizer-Errol", price: 100, baseVolatility: 0.015, trend: "bullish" },           // Slide Paramita — "widely separated engines make Paramita's Podracer very stable"
    { symbol: "RULZ", name: "Radon-Ulzer", price: 100, baseVolatility: 0.024, trend: "neutral" },           // Anakin Skywalker — "fairly well-balanced... good repair and cooling should keep it in the running"
    { symbol: "RAMA", name: "RamAir", price: 100, baseVolatility: 0.042, trend: "bullish" },                // Aldar Beedo — "sounds tougher than it is; no single outstanding quality"; AI "rams neighbors"
    { symbol: "SHLB", name: "Shelba", price: 100, baseVolatility: 0.017, trend: "strong_bearish" },         // Bozzie Baranta — "the most evenly distributed attributes of any Podracer"
    { symbol: "TRCA", name: "Turca", price: 100, baseVolatility: 0.023, trend: "bearish" },                 // Toy Dampner — "well-balanced... strong acceleration and repair... modest to good ratings"
    { symbol: "VKF", name: "Vokoff-Strood", price: 100, baseVolatility: 0.040, trend: "neutral" },          // Ratts/Ark Roose — "don't lose speed for any reason"; "one outstanding feature... won't hold it (poor top end)"
    { symbol: "VLP", name: "Vulptereen", price: 100, baseVolatility: 0.047, trend: "strong_bearish" }       // Dud Bolt — "great traction but little else... a great challenge, particularly in hot climates"
]
