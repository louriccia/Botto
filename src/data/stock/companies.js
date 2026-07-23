// The 21 companies traded on the Wald Street Exchange. Each starts at price 100.
// These are the SWE1R podracer manufacturers/engines.
//
// `baseVolatility` (per-tick price swing) and `trend` are the rebalanced values
// from the stock_market.html prototype. Names follow the bot's racer data
// (src/data/sw_racer/racer.js); the prototype's "Kelzaar-Volvec" / "Vokof-Strood"
// spellings are typos and are intentionally NOT adopted here.
exports.COMPANIES = [
    { symbol: "BALT", name: "Balta-Trabaat", price: 100, baseVolatility: 0.018, trend: "bullish" },
    { symbol: "BING", name: "Bin Gassi", price: 100, baseVolatility: 0.030, trend: "neutral" },
    { symbol: "BRE", name: "Bokaan Race Engineering", price: 100, baseVolatility: 0.025, trend: "bullish" },
    { symbol: "COPO", name: "Collor Pondrat", price: 100, baseVolatility: 0.020, trend: "neutral" },
    { symbol: "ELCO", name: "Elsinore-Cordova", price: 100, baseVolatility: 0.015, trend: "bullish" },
    { symbol: "EXL", name: "Exelbrok", price: 100, baseVolatility: 0.035, trend: "bearish" },
    { symbol: "FG", name: "Farwan & Glott", price: 100, baseVolatility: 0.028, trend: "neutral" },
    { symbol: "GPE", name: "Galactic Power Engineering", price: 100, baseVolatility: 0.022, trend: "strong_bullish" },
    { symbol: "IRTQ", name: "Irateq", price: 100, baseVolatility: 0.028, trend: "neutral" },
    { symbol: "IPG", name: "Irdani Performance Group", price: 100, baseVolatility: 0.030, trend: "strong_bullish" },
    { symbol: "JAK", name: "JAK Racing", price: 100, baseVolatility: 0.040, trend: "bearish" },
    { symbol: "KEVO", name: "Keizar-Volvec", price: 100, baseVolatility: 0.026, trend: "neutral" },
    { symbol: "KURT", name: "Kurtob", price: 100, baseVolatility: 0.055, trend: "bearish" },
    { symbol: "OPED", name: "Ord Pedrovia", price: 100, baseVolatility: 0.045, trend: "strong_bearish" },
    { symbol: "PZER", name: "Pizer-Errol", price: 100, baseVolatility: 0.017, trend: "bullish" },
    { symbol: "RULZ", name: "Radon-Ulzer", price: 100, baseVolatility: 0.032, trend: "neutral" },
    { symbol: "RAMA", name: "RamAir", price: 100, baseVolatility: 0.024, trend: "bullish" },
    { symbol: "SHLB", name: "Shelba", price: 100, baseVolatility: 0.038, trend: "strong_bearish" },
    { symbol: "TRCA", name: "Turca", price: 100, baseVolatility: 0.050, trend: "bearish" },
    { symbol: "VKF", name: "Vokoff-Strood", price: 100, baseVolatility: 0.021, trend: "neutral" },
    { symbol: "VLP", name: "Vulptereen", price: 100, baseVolatility: 0.060, trend: "strong_bearish" }
]
