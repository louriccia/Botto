// Prices Watto's book.
//
// A side bet names an **event** rather than an outcome — a cube gets cloned, Ben razes a neighbour, a
// shield holds — and pays a bonus onto the rung's multiple if it happens. Every one of those events is
// already a note the engine emits, so the mechanic is a lookup; what it does not have is odds, and
// odds guessed against a mode this interactive is how a bonus becomes a faucet.
//
// So this measures them, per level, over real climbs.
//
// **Per level is the whole point.** A two-cube interaction cannot happen on a one-cube line and is
// routine on a nine-cube one, so a single hit rate would be an average of two different games. It is
// also what makes the timing decision real: the bonus is *added* to the multiple, so it is worth most
// early — and early is exactly where the odds are worst.
//
// **Racks matter as much as levels.** The book cannot price a player's rack, and reading that gap is
// the skill the bet is there to reward. Three are measured: an empty one, a spread, and a rack built
// to farm one column of this table.
//
//   node scripts/cubeSideBet.js [climbs]
//
// Read-only. It touches no database and stakes nothing.

const engine = require('../src/game/cube/engine.js');
const { LEVELS, cube: config } = require('../src/game/cube/tuning.js');

const CLIMBS = Number(process.argv[2]) || 40000;

// Each proposition is a predicate over one resolved rung. Named for what a player would be told, and
// written against the notes rather than against the line — the engine already decided what happened.
const has = (notes, kind) => notes.some(n => n.kind === kind);
const PROPS = [
    { id: 'clone', say: 'A cube gets copied', hit: r => has(r.notes, 'clone') },
    { id: 'burn', say: 'A cube gets burned', hit: r => has(r.notes, 'burn') },
    { id: 'raze', say: 'Ben flattens his neighbours', hit: r => has(r.notes, 'raze') },
    // Narrowed to Padme's twins in `SIDE_BETS`; kept in step so this script prices the shipped card.
    { id: 'grow', say: 'Padme slips in matching twins', hit: r => has(r.notes, 'twins') },
    // The dome replaces the wipeout save: a shield no longer holds a neighbour together, it turns
    // away what would have had to cross it.
    {
        id: 'walled',
        say: 'A dome turns something away',
        hit: r => r.notes.some(n => n.kind === 'end.shielded'
            || ['burn.walled', 'clone.walled', 'haul.walled', 'engine.walled'].includes(n.kind)),
    },
    { id: 'engine', say: 'Sebulba turns a cube', hit: r => has(r.notes, 'engine') },
    { id: 'invert', say: 'The line flips', hit: r => has(r.notes, 'invert') },
    { id: 'tie', say: 'Nobody wins the line', hit: r => !r.ended && !!r.faceIds.length && !r.majority },
    { id: 'broken', say: 'A cube shatters', hit: r => has(r.notes, 'broken') },
    { id: 'mirror', say: 'A reflection lands', hit: r => r.notes.some(n => n.kind === 'mirror' && n.copied > 0) },
    { id: 'purge', say: 'Order 66', hit: r => has(r.notes, 'purge') },
    { id: 'scavenge', say: 'Something comes back', hit: r => has(r.notes, 'scavenge') },
    { id: 'pure', say: 'Every cube your way', hit: r => !!r.pure },
    { id: 'wild', say: 'A wild lands', hit: r => has(r.notes, 'wild') },
    { id: 'draw', say: 'Pit Droid draws', hit: r => has(r.notes, 'draw') },
    { id: 'reroll', say: 'A reroll banks', hit: r => has(r.notes, 'reroll') },
    { id: 'shortcut', say: 'A free clear', hit: r => (r.shortcuts || 0) > 0 },
    { id: 'pair', say: 'Fode grows a red and a blue', hit: r => has(r.notes, 'pair') },
    { id: 'cull', say: 'The Tusken shoots one down', hit: r => r.notes.some(n => n.kind === 'cull' || n.kind === 'cull.shield') },
    { id: 'haul', say: 'The Sandcrawler swallows one', hit: r => has(r.notes, 'haul') },
    {
        id: 'planet',
        say: 'A planet turns',
        hit: r => r.notes.some(n => ['freeze', 'vault', 'scorch', 'blessing', 'seam', 'jail', 'plunge', 'crowd'].includes(n.kind)),
    },
    { id: 'jail', say: 'One gets a life sentence', hit: r => has(r.notes, 'jail') },
    { id: 'plunge', say: 'Both ends drop off the road', hit: r => has(r.notes, 'plunge') },
    { id: 'crowd', say: 'The bandwagon paints the line', hit: r => has(r.notes, 'crowd') },
    { id: 'blessing', say: 'A blessing lands', hit: r => has(r.notes, 'blessing') },
    { id: 'freeze', say: 'A cube freezes', hit: r => has(r.notes, 'freeze') },
    { id: 'scorch', say: 'A scorch burns', hit: r => has(r.notes, 'scorch') },
    { id: 'vault', say: 'The vault seals', hit: r => has(r.notes, 'vault') },
    { id: 'seam', say: 'The seam pays', hit: r => has(r.notes, 'seam') },
    { id: 'holdbreak', say: 'A hold breaks open', hit: r => has(r.notes, 'hold.break') },
    // At one pay face the card is near-certain on the racks that can produce it at all (89.7% on the
    // gambler row, a +1.2 card); at three it is a real proposition. Kept in step with the shipped card.
    {
        id: 'payday',
        say: 'Three pay faces in one throw',
        hit: r => r.notes.filter(n => ['greed', 'boost', 'heat', 'guide', 'seam', 'mult'].includes(n.kind)).length >= 3,
    },
    { id: 'carnage', say: 'Two shatter in one throw', hit: r => r.notes.filter(n => n.kind === 'broken').length >= 2 },
    // Conditioned on the *call* winning, not on a margin either way: half of all wide margins belong
    // to the other side, and a rung lost by a landslide pays nothing because the run died with it.
    {
        id: 'landslide',
        say: 'Your side by three or more',
        hit: (r, call) => {
            const blue = r.cubes.filter(s => s === 'blue').length;
            return r.majority === call && Math.abs(blue - (r.cubes.length - blue)) >= 3;
        },
    },
    { id: 'sweep', say: 'Five up, every one yours', hit: r => !!r.pure && r.cubes.length >= 5 },
];

const RACKS = {
    'empty rack': [],
    'a spread': ['wild', 'greed', 'binder', 'mirror', 'gungan', 'multiplier', 'shortcut', 'boost'],
    'built for it': ['binder', 'mirror', 'symbiont', 'pitdroid', 'sebulba', 'gungan', 'scavenger', 'reroll'],
    'planet watch': ['octahedron', 'pitdroid', 'symbiont', 'gungan', 'mirror', 'binder', 'scavenger', 'turbine'],
    // Shmi leans red four faces in six, so a pure farmer equips her and calls red every climb — the
    // worst case the `pure` card has to be priced against.
    'shmi, calling red': { rack: ['shmi'], call: 'red' },
    'droid bay': ['pitdroid', 'shortcut', 'reroll', 'wild', 'greed', 'gungan', 'scavenger', 'boost'],
    // The Gambler's own row plus everything that carries a mine, to find the ceiling on shatter bets.
    'gambler row': ['greed', 'multiplier', 'turbine', 'boost', 'reroll', 'sebulba', 'pitdroid', 'binder'],
};

// One climb, carrying the bag the way a real run does — `drawCubes` spends it and so does a Pit Droid,
// so both returns have to be threaded or a drawn cube comes out of the bag twice.
const climb = function (rack, call, tally) {
    let bag = engine.fillBag(rack);
    let set = [];
    for (let lv = 0; lv < LEVELS.length; lv += 1) {
        const drawn = engine.drawCubes(set, bag, lv);
        set = drawn.set;
        bag = drawn.bag;
        const res = engine.resolveLine(engine.throwSet(set), call, bag);
        bag = res.bag;
        set = res.set;
        const row = tally[lv];
        row.n += 1;
        for (const p of PROPS) if (p.hit(res, call)) row.hit[p.id] += 1;
        // A rung that ends the run pays nothing, so nothing above it is part of what a bet on the
        // *next* rung is priced against.
        if (res.ended) break;
    }
};

const pct = n => (n * 100).toFixed(1).padStart(5);
// What a fair bonus would be, in stake-units, for a bet that hits this often.
//
// **`1/p - 1` is wrong, and every price in `SIDE_BETS` was once derived from it** — they are cut from
// the formula below now, at the best rate this table measures. The naive reading is that
// a card stakes one unit to win `price`, so it is fair at `p = 1/(price+1)`. That ignores *when* each
// half of the bet touches the multiple, and the two halves do not touch it at the same time:
//
//   - the **ante** comes off `live.mult` when the card is named, which is *before* the rung resolves,
//     so `rungMultiple`'s `carried * levelStep` multiplies the reduced figure — the ante really costs
//     `betAnte * levelStep`.
//   - the **payout** arrives in `added`, which `rungMultiple` applies *after* the multiplication, so it
//     is worth exactly `price + betAnte` and no more.
//
// So a level rung charges `levelStep` for every unit it pays flat, and the true break-even is
//
//     p = betAnte * levelStep / (price + betAnte)
//
// which at `levelStep 1.94` is nearly **twice** the rate the old formula asked for. Verified against the
// engine rather than argued: betting one prop at a fixed rung and differencing the resulting multiple
// reproduces this expression to three decimals across four props and two levels, where `1/p - 1` is out
// by `betAnte * (levelStep - 1)` every time.
//
// (An **Again** adds instead of multiplying, so there the naive formula is right. The collapsed road is
// all levels, which is the case the prices have to survive.)
const fair = p => (p <= 0 ? null : (config.levelStep * config.betAnte) / p - config.betAnte);

for (const [label, spec] of Object.entries(RACKS)) {
    const rack = Array.isArray(spec) ? spec : spec.rack;
    const fixedCall = Array.isArray(spec) ? null : spec.call;
    const tally = LEVELS.map(() => ({ n: 0, hit: Object.fromEntries(PROPS.map(p => [p.id, 0])) }));
    for (let i = 0; i < CLIMBS; i += 1) climb(rack, fixedCall || (i % 2 ? 'red' : 'blue'), tally);

    console.log(`\n${label}`);
    console.log(`  ${'proposition'.padEnd(24)}${LEVELS.map((l, i) => `L${i + 1}`.padStart(7)).join('')}    fair@max`);
    for (const p of PROPS) {
        const rates = tally.map(t => (t.n ? t.hit[p.id] / t.n : 0));
        // The shipped price is fair at the highest rate any rack reaches at any level, rounded down to
        // the half — the ceiling is what a blind book has to survive; see `SIDE_BETS`.
        const f = fair(Math.max(...rates));
        console.log(`  ${p.say.padEnd(24)}${rates.map(pct).join('  ')}   ${f == null ? '   —' : `+${f.toFixed(1)}`}`);
    }
}

console.log(`\n${CLIMBS} climbs per rack. Rates are per rung reached, so a level nobody survives to is thin.`);
