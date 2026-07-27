// The 21 companies traded on the Wald Street Exchange. Each starts at price 100.
// These are the SWE1R podracer manufacturers/engines.
//
// `baseVolatility` and `trend` are the rebalanced values from the
// stock_market.html prototype. Names follow the bot's racer data
// (src/data/sw_racer/racer.js); the prototype's "Kelzaar-Volvec" / "Vokof-Strood"
// spellings are typos and are intentionally NOT adopted here.
//
// `color` is the stock's graph line color (dark-mode charts): the dominant brand
// color extracted from each logo in resources/img/companies/. TRCA's logo is
// monochrome (black on white), so it uses a neutral silver to stay chart-visible.
exports.COMPANIES = [
    { symbol: "BALT", name: "Balta-Trabaat", price: 100, baseVolatility: 0.060, trend: "bullish", color: "#A80202" },
    { symbol: "BING", name: "Bin Gassi Racing", price: 100, baseVolatility: 0.022, trend: "neutral", color: "#D1BBA3" },
    { symbol: "BRE", name: "Bokaan Race Engineering", price: 100, baseVolatility: 0.030, trend: "bullish", color: "#3BBFE5" },
    { symbol: "COPO", name: "Collor Pondrat", price: 100, baseVolatility: 0.055, trend: "neutral", color: "#B30626" },
    { symbol: "ELCO", name: "Elsinore-Cordova", price: 100, baseVolatility: 0.025, trend: "bullish", color: "#FAC012" },
    { symbol: "EXL", name: "Exelbrok", price: 100, baseVolatility: 0.018, trend: "bearish", color: "#E11B22" },
    { symbol: "FG", name: "Farwan & Glott", price: 100, baseVolatility: 0.050, trend: "neutral", color: "#5A8CC5" },
    { symbol: "GPE", name: "Galactic Power Engineering", price: 100, baseVolatility: 0.024, trend: "strong_bullish", color: "#4A9C3A" },
    { symbol: "IRTQ", name: "Irateq", price: 100, baseVolatility: 0.040, trend: "neutral", color: "#842931" },
    { symbol: "IPG", name: "Irdani Performance Group", price: 100, baseVolatility: 0.035, trend: "strong_bullish", color: "#E67B00" },
    { symbol: "JAK", name: "JAK Racing", price: 100, baseVolatility: 0.028, trend: "bearish", color: "#318CCE" },
    { symbol: "KEVO", name: "Keizaar-Volvec", price: 100, baseVolatility: 0.017, trend: "neutral", color: "#DE1019" },
    { symbol: "KURT", name: "Kurtob", price: 100, baseVolatility: 0.028, trend: "bearish", color: "#EF4231" },
    { symbol: "OPED", name: "Ord Pedrovia", price: 100, baseVolatility: 0.021, trend: "strong_bearish", color: "#88CB66" },
    { symbol: "PZER", name: "Pizer-Errol", price: 100, baseVolatility: 0.020, trend: "bullish", color: "#FFBD08" },
    { symbol: "RULZ", name: "Radon-Ulzer", price: 100, baseVolatility: 0.032, trend: "neutral", color: "#FFB515" },
    { symbol: "RAMA", name: "Manta RamAir", price: 100, baseVolatility: 0.045, trend: "bullish", color: "#EF6BFF" },
    { symbol: "SHLB", name: "Shelba", price: 100, baseVolatility: 0.015, trend: "strong_bearish", color: "#0E59B0" },
    { symbol: "TRCA", name: "Turca", price: 100, baseVolatility: 0.026, trend: "bearish", color: "#C7CDD1" },
    { symbol: "VKF", name: "Vokoff-Strood", price: 100, baseVolatility: 0.030, trend: "neutral", color: "#FF2929" },
    { symbol: "VLP", name: "Vulptereen", price: 100, baseVolatility: 0.038, trend: "strong_bearish", color: "#F71029" }
]
