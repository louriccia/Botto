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
const { LEVELS } = require('../src/game/cube/tuning.js');

const CLIMBS = Number(process.argv[2]) || 40000;

// Each proposition is a predicate over one resolved rung. Named for what a player would be told, and
// written against the notes rather than against the line — the engine already decided what happened.
const has = (notes, kind) => notes.some(n => n.kind === kind);
const PROPS = [
    { id: 'clone', say: 'A cube gets copied', hit: r => has(r.notes, 'clone') },
    { id: 'burn', say: 'A cube gets burned', hit: r => has(r.notes, 'burn') },
    { id: 'raze', say: 'Ben razes a neighbour', hit: r => has(r.notes, 'raze') },
    { id: 'grow', say: 'The line gets longer', hit: r => ['pair', 'twins', 'draw'].some(k => has(r.notes, k)) },
    { id: 'saved', say: 'A cube holds together', hit: r => has(r.notes, 'broken.saved') },
    { id: 'engine', say: 'Sebulba turns a cube', hit: r => has(r.notes, 'engine') },
    { id: 'invert', say: 'The line flips', hit: r => has(r.notes, 'invert') },
    { id: 'tie', say: 'Nobody wins the line', hit: r => !r.ended && !!r.faceIds.length && !r.majority },
    { id: 'broken', say: 'A cube shatters', hit: r => has(r.notes, 'broken') },
    { id: 'mirror', say: 'A reflection lands', hit: r => r.notes.some(n => n.kind === 'mirror' && n.copied > 0) },
    { id: 'purge', say: 'Order 66', hit: r => has(r.notes, 'purge') },
    { id: 'scavenge', say: 'Something comes back', hit: r => has(r.notes, 'scavenge') },
    { id: 'pure', say: 'Every cube your way', hit: r => !!r.pure },
];

const RACKS = {
    'empty rack': [],
    'a spread': ['wild', 'greed', 'binder', 'mirror', 'gungan', 'multiplier', 'shortcut', 'boost'],
    'built for it': ['binder', 'mirror', 'symbiont', 'pitdroid', 'sebulba', 'gungan', 'scavenger', 'reroll'],
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
        for (const p of PROPS) if (p.hit(res)) row.hit[p.id] += 1;
        // A rung that ends the run pays nothing, so nothing above it is part of what a bet on the
        // *next* rung is priced against.
        if (res.ended) break;
    }
};

const pct = n => (n * 100).toFixed(1).padStart(5);
// What a fair bonus would be, in stake-units, for a bet that hits this often. `1/p` is the fair
// multiple on a stake of one; the bonus is what is *added*, so it is one less than that.
const fair = p => (p <= 0 ? null : 1 / p - 1);

for (const [label, rack] of Object.entries(RACKS)) {
    const tally = LEVELS.map(() => ({ n: 0, hit: Object.fromEntries(PROPS.map(p => [p.id, 0])) }));
    for (let i = 0; i < CLIMBS; i += 1) climb(rack, i % 2 ? 'red' : 'blue', tally);

    console.log(`\n${label}`);
    console.log(`  ${'proposition'.padEnd(24)}${LEVELS.map((l, i) => `L${i + 1}`.padStart(7)).join('')}    fair@L3`);
    for (const p of PROPS) {
        const rates = tally.map(t => (t.n ? t.hit[p.id] / t.n : 0));
        const at3 = rates[2];
        const f = fair(at3);
        console.log(`  ${p.say.padEnd(24)}${rates.map(pct).join('  ')}   ${f == null ? '   —' : `+${f.toFixed(1)}`}`);
    }
}

console.log(`\n${CLIMBS} climbs per rack. Rates are per rung reached, so a level nobody survives to is thin.`);
