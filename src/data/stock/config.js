// Tuning constants for the Wald Street Exchange market simulation.
// Values ported from the stock_market.html prototype `config`.
exports.config = {
    // Broker fee (a truguts sink) — the market swings between OPEN and CLOSED.
    brokerFeeOpen: 0.02,                   // 2% while the market is open (weekday 6am–5pm ET)
    brokerFeeClosed: 0.05,                 // 5% overnight and on weekends
    // How hard live buy/sell pressure pushes the price. Counts double while closed.
    sentimentImpactOpen: 1,
    sentimentImpactClosed: 2,
    playerPressureCap: 0.03,               // max +/- price impact per tick from live trades
    appearanceVolatilityMultiplier: 4,     // volatility boost for the exposed company
    trendDriftChance: 0.075,               // chance a non-exposed company drifts a trend step at the daily open
    appearanceBoostTicks: 3,               // how many ticks the exposure boost lasts (6am/12pm/6pm)
    minPrice: 1,                           // price floor
    pressureReference: 6000,               // volume needed for max player pressure
    // Pull toward each stock's anchor (log space) so prices can't compound to infinity.
    // A stock settles around anchor * e^(trend/meanReversionStrength).
    meanReversionStrength: 0.0025,
    // --- anti-whale friction (a wealth-scaled rake, tuned to keep trading playable) ---
    slippageLiquidity: 1000000,            // book depth in truguts; a single order's impact = notional / this
    maxImpact: 4,                          // cap on one order's impact (avg buy fill up to +200%)
    whaleThreshold: 100000000,             // net worth at/above which you count as a "whale"
    whaleFeeMultiplier: 2                   // whales pay this multiple of the base open/closed broker fee
}

// The four daily ticks. Each real day advances 4 ticks at these Eastern-time hours:
//   12am  the featured challenge pod is announced (its maker gets exposure)
//   6am   that maker's volatility spikes; market opens
//   12pm  a news headline drops
//   6pm   the news moves the affected stock's trend; market closes
// The market trades 6am–5pm on weekdays only (see isMarketOpen).
exports.TICKS = [
    { hour: 0, label: "12am", open: false, role: "daily" },
    { hour: 6, label: "6am", open: true, role: "tick" },
    { hour: 12, label: "12pm", open: true, role: "news" },
    { hour: 18, label: "6pm", open: false, role: "tick" }
]

// Ordered weakest -> strongest, used to nudge a company's trend a step at a time.
exports.TREND_ORDER = ["strong_bearish", "bearish", "neutral", "bullish", "strong_bullish"]

// Per-tick average price bias for each trend bucket.
exports.TREND_BIAS = {
    strong_bearish: -0.018, bearish: -0.009, neutral: 0, bullish: 0.009, strong_bullish: 0.018
}

// Human-readable label for each trend bucket (shown in embeds).
exports.TREND_LABEL = {
    strong_bearish: "Strong Bearish 📉", bearish: "Bearish", neutral: "Neutral",
    bullish: "Bullish", strong_bullish: "Strong Bullish 📈"
}

// Real-calendar market hours. Both take a moment (already in the target tz).
// Weekdays are Mon–Fri; the market floor/close is 6am–5pm.
exports.isWeekday = (m) => m.isoWeekday() <= 5
exports.isMarketOpen = (m) => exports.isWeekday(m) && m.hour() >= 6 && m.hour() < 17

// Max price points kept per company (~30 trading days at 4 ticks/day).
exports.HISTORY_CAP = 120

// Max ticks to replay in a single cron pass after downtime (2 trading days).
exports.MAX_CATCHUP = 8

// Number of trailing history points shown for each graph range option (4 ticks/day).
exports.RANGE_POINTS = { "1D": 4, "1W": 28, "1M": 120, "ALL": exports.HISTORY_CAP }
exports.DEFAULT_RANGE = "1M"
