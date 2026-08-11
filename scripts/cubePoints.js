// Measures what face points do to the ladder — and settles which of the two ways to pay them is safe.
//
// Every position on a resolved line is worth points. The only question that ever mattered is whether
// they ride the ladder or sit beside it:
//
//     MULTIPLIED   standing = stake × P × M        P = 1 + points × pointValue
//     ADDED        standing = stake × (M + b)      b =     points × pointValue     ← shipped
//
// **Added is the one that works, and it needs no correction of any kind.** A bonus that doesn't compound
// shrinks against a doubling multiple all by itself, so the push ratio returns to 1.000 on its own. A
// full L1→L5 climb measures **0.998–1.000** across every rack: at or below fair, house-side, exactly
// where the payout design wants it.
//
// Multiplied is the trap, and it is worth keeping the number on record because the idea is tempting. The
// bonus compounds with a line that grows `cubesPerLevel` every level, so each push comes out ~4% above
// even money and a full climb reaches **1.08–1.15**. On a collapsed road that is a money printer. Fixing
// it needs a per-position average, a baseline, and a special case for Level 1 — three pieces of
// machinery that exist only to undo one multiplication.
//
// So: points are added, totals are fine, `levelStep: 2` is untouched, and there is no Level 1 problem.
//
// It reports per level because the point total grows with the line, and per rack because a rack that
// grows the line further moves it further.
//
//   node scripts/cubePoints.js [climbs] [rack]
//
//   node scripts/cubePoints.js 50000            empty rack, greed+wild, and a full one
//   node scripts/cubePoints.js 50000 greed,wild just that rack
//
// Read-only. It touches no database and stakes nothing.

const engine = require('../src/game/cube/engine.js');
const { SPECIALS, LEVELS, POINTS, cube: config } = require('../src/game/cube/tuning.js');

const CLIMBS = Number(process.argv[2]) || 50000;
const ALL = SPECIALS.map(s => s.id);
const only = process.argv[3] ? process.argv[3].split(',').filter(Boolean) : null;

// One climb, carrying the bag the way a real run does — `drawCubes` spends it and so does a Pit Droid,
// so both returns have to be threaded or a drawn cube comes out of the bag twice.
const climb = function (rack, call) {
    let bag = engine.fillBag(rack);
    let set = [];
    const out = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
        const drawn = engine.drawCubes(set, bag, lv);
        set = drawn.set;
        bag = drawn.bag;
        const res = engine.resolveLine(engine.throwSet(set), call, bag);
        bag = res.bag;
        set = res.set;
        // A bust pays nothing at all, so its points are not part of the distribution a *push* is priced
        // against — the push is a bet on the next rung paying, and a rung that ends the run doesn't.
        if (res.ended) break;
        // `res.positions` counts standing positions only — `faceIds` includes corpses, which score
        // nothing and are excluded from the average, so the two deliberately disagree.
        out.push({ lv, points: res.points, positions: res.positions });
        if (res.majority === null) continue;
    }
    return out;
};

const measure = function (rack, label) {
    // Per level, so the gap can be read where it actually bites — P varies far more at 1 cube than at 9.
    // `sumB` / `sumInvB` are the ADDED model: `b` is the bonus in stake-units and the standing it sits
    // in is `M + b`, so the inverse has to be taken against that whole figure rather than against `b`.
    const byLevel = LEVELS.map(() => ({
        n: 0, sumP: 0, sumInv: 0, sumPts: 0, sumB: 0, sumInvB: 0, min: Infinity, max: 0,
    }));
    const all = { n: 0, sumP: 0, sumInv: 0 };

    for (let i = 0; i < CLIMBS; i++) {
        for (const rung of climb(rack, i % 2 ? 'red' : 'blue')) {
            const P = 1 + engine.pointBonus(rung.points);
            const b = byLevel[rung.lv];
            b.n++; b.sumP += P; b.sumInv += 1 / P; b.sumPts += rung.points;
            // The added model uses the line's **total** points, not the per-position average — the
            // average exists only to stop a multiplied bonus drifting, and an added one doesn't drift.
            const bonus = rung.points * config.pointValue;
            b.sumB += bonus;
            b.sumInvB += 1 / ((2 ** (rung.lv + 1)) + bonus);
            b.min = Math.min(b.min, P); b.max = Math.max(b.max, P);
            all.n++; all.sumP += P; all.sumInv += 1 / P;
        }
    }

    console.log(`\n${label}`);
    console.log('  level    n        pts    E[P]     E[1/P]   range');
    byLevel.forEach((b, lv) => {
        if (!b.n) return;
        console.log(`  L${lv + 1}    ${String(b.n).padStart(7)}   ${(b.sumPts / b.n).toFixed(1).padStart(5)}`
            + `   ${(b.sumP / b.n).toFixed(4)}   ${(b.sumInv / b.n).toFixed(4)}`
            + `   ${b.min.toFixed(3)}–${b.max.toFixed(3)}`);
    });

    // **The number that matters is the transition, not the pool.** A push trades a *known* standing at
    // rung k for a coin flip on rung k+1, so its price is the ratio of the two — and the answer depends
    // entirely on which of the two ways the bonus is paid:
    //
    //   MULTIPLIED   standing = stake × P × M      the bonus rides the ladder
    //   ADDED        standing = stake × (M + b)    the bonus sits beside it, b = pts × pointValue
    //
    // Multiplied, the bonus compounds with line growth and the push comes out above even money.
    // Added, a fixed bonus shrinks against a doubling M, so the ratio collapses back to 1.0 on its own.
    // Both are measured here because the difference is the entire design decision.
    console.log('  push     from → to    ×multiplied   +added   (1.0000 is fair)');
    let worstMul = 0;
    let worstAdd = 0;
    let climbMul = 1;
    let climbAdd = 1;
    for (let lv = 0; lv + 1 < byLevel.length; lv++) {
        const from = byLevel[lv];
        const to = byLevel[lv + 1];
        if (!from.n || !to.n) continue;
        const mul = (to.sumP / to.n) * (from.sumInv / from.n);
        // Ladder multiple at each rung on a fully collapsed road, which is the worst case: no Agains
        // standing between the levels to absorb anything.
        const M = 2 ** (lv + 1);
        const add = 0.5 * (2 * M + (to.sumB / to.n)) * (from.sumInvB / from.n);
        worstMul = Math.max(worstMul, mul);
        worstAdd = Math.max(worstAdd, add);
        climbMul *= mul;
        climbAdd *= add;
        console.log(`           L${lv + 1} → L${lv + 2}       ${mul.toFixed(4)}     ${add.toFixed(4)}`
            + `${mul > 1.005 ? '   ← multiplied is above even money' : ''}`);
    }
    // **The bottom line is the compounded climb, not the worst rung.** A single transition above 1.000
    // is only exploitable if you can sit on it; the thing that decides whether the mode leaks is what a
    // whole L1→L5 push chain multiplies out to, since the rungs above pay back what the first one gave.
    console.log(`  worst rung   multiplied ${worstMul.toFixed(4)}  ·  added ${worstAdd.toFixed(4)}`);
    console.log(`  full climb   multiplied ${climbMul.toFixed(4)}  ·  added ${climbAdd.toFixed(4)}`);
    return { mul: worstMul, add: worstAdd, climbMul, climbAdd };
};

console.log(`${CLIMBS.toLocaleString()} climbs · 1 point = ${(config.pointValue * 100).toFixed(2)}% of stake`);
console.log(`face points: ${Object.entries(POINTS).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

const gaps = only
    ? [measure(only.filter(id => ALL.includes(id)), `Rack: ${only.join(' + ')}`)]
    : [
        measure([], 'Empty rack (plain cubes only)'),
        measure(['greed', 'wild'], 'Two cubes (greed + wild)'),
        measure(['mirror', 'symbiont', 'binder', 'pitdroid'], 'Four restructurers (the longest lines)'),
        measure(ALL, 'Full rack'),
    ];

const worstMul = Math.max(...gaps.map(g => g.mul));
const worstAdd = Math.max(...gaps.map(g => g.add));
console.log(`\nWorst push, across every rack and rung:`);
console.log(`  MULTIPLIED (stake × P × M)   ${worstMul.toFixed(4)}  — ${((worstMul - 1) * 100).toFixed(2)}% above fair`);
console.log(`  ADDED      (stake × (M + b)) ${worstAdd.toFixed(4)}  — ${((worstAdd - 1) * 100).toFixed(2)}% above fair`);
const climbAddWorst = Math.max(...gaps.map(g => g.climbAdd));
console.log("  full L1->L5 climb, added model: " + gaps.map(g => g.climbAdd.toFixed(4)).join(' · '));
console.log(climbAddWorst < 1.005
    ? '\nAdded needs no correction at all: a fixed bonus shrinks against a doubling ladder, so the push\n'
      + 'ratio collapses to 1.0 on its own. Totals are fine; no average, no baseline, no Level 1 problem.'
    : '\nAdded still drifts — check `pointValue`.');
