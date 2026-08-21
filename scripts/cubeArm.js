// The mid-run economy, asserted end to end: what a pick costs, when it may be bought, what buying
// one does to the standing, and that nothing survives the rung it was bought for.
//
// It exists because the thing being tested is a *sequence* rather than a number. `scripts/cubeLean.js`
// prices the dials; this checks that the rules around them hold — that an arm cannot be bought against
// a line already on the table, that a spent one comes off, that an unspent one expires, and that the
// price on the board is the price the server charges. Every one of those is a way the fix could be
// live in `tuning.js` and absent in play.
//
//   node scripts/cubeArm.js
//
// Read-only. It builds a world in this process, touches no database and stakes nothing real.

const actions = require('../src/game/cube/actions.js');
const engine = require('../src/game/cube/engine.js');
const pstate = require('../src/game/cube/state.js');
const persist = require('../src/game/cube/persist.js');
const { LEVELS, SIDE_BETS, cube: config } = require('../src/game/cube/tuning.js');

const ME = 'arm-test';
let failures = 0;
let checks = 0;

const ok = function (what, cond, detail) {
    checks++;
    if (cond) return true;
    failures++;
    console.log(`  FAIL  ${what}${detail == null ? '' : `  — ${detail}`}`);
    return false;
};
const eq = (what, got, want) => ok(what, got === want, `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
const near = (what, got, want) => ok(what, Math.abs(got - want) < 1e-9,
    `got ${got}, wanted ${want}`);

// A world that exists only in this process. Same shape `scripts/cubeFixtures.js` builds; kept
// separate because this one wants a specific rack and a specific set of perks rather than everything.
const makeWorld = function ({ perks = {}, rack = ['greed'], unlocked = 4 } = {}) {
    const profile = {
        name: 'Arm test',
        truguts_earned: 1e12,
        truguts_spent: 0,
        effects: { chance_cube: true },
        cube: {
            prestige: 8, unlocked, clears: 0, stake: 1000,
            cubes: Object.fromEntries(rack.map(id => [id, true])),
            equipped: rack, nudge: true, ...perks,
        },
    };
    const db = { user: { K: { random: profile, discordID: ME } }, ch: { cube: { ladders: {} } } };
    const ref = p => ({
        child: c => ref(`${p}/${c}`),
        update: (v) => { Object.assign(profile.cube, v); return Promise.resolve(); },
        set: (v) => {
            const m = p.match(/ladders\/(.+)$/);
            if (m) db.ch.cube.ladders[m[1]] = v;
            return Promise.resolve();
        },
        remove: () => {
            const m = p.match(/ladders\/(.+)$/);
            if (m) delete db.ch.cube.ladders[m[1]];
            return Promise.resolve();
        },
    });
    const database = { ref };
    const moveTruguts = ({ transaction, amount }) => {
        const n = Math.floor(Number(amount) || 0);
        if (transaction === 'w') profile.truguts_spent += n;
        if (transaction === 'd') profile.truguts_earned += n;
        if (transaction === 'r') profile.truguts_spent -= n;
    };
    const ctxOf = () => ({
        db, database, profile, profileRef: database.ref('users/K/random'),
        discordId: ME, s: pstate.cubeState(profile), moveTruguts,
    });
    // Puts a run on the board at a chosen multiple without playing up to it, so a price can be
    // asserted at every rung of the ladder rather than only at the ones a lucky climb reaches.
    const stand = function (mult, extra = {}) {
        db.ch.cube.ladders[ME] = {
            stake: 1000,
            mult,
            standing: engine.bankPayout(1000, mult),
            level: 0,
            again: 0,
            rungs: 1,
            // A bag with something in it, or the rung ahead draws nothing and every question about
            // it comes back `too_few` — which is a true answer to the wrong question.
            set: {},
            bag: engine.encodeBag(engine.fillBag(rack)),
            ...extra,
        };
        return db.ch.cube.ladders[ME];
    };
    return { db, profile, ctxOf, stand, ladder: () => db.ch.cube.ladders[ME] };
};

const ALL_PERKS = { scrap: true, shuffle: true, split: true, premonition: true, sidebet: true };

console.log('\nTHE PRICE — a share of what is standing, rounded to whole mults');
console.log('  standing   armShare x it   charged   effective');
{
    // The ladder as the design doc prints it, which is the one place the rounding is visible.
    const rungs = [1, ...LEVELS.map(l => l.payout)];
    for (const m of rungs) {
        const raw = config.armShare * m;
        const price = engine.armPriceOf(m);
        console.log(`  ${m.toFixed(2).padStart(8)}   ${raw.toFixed(2).padStart(13)}   ${String(price).padStart(7)}`
            + `   ${`${(100 * price / m).toFixed(0)}%`.padStart(9)}`);
    }
    // The table the notes in `tuning.js` and `engine.js` both quote. If this moves, those move.
    const want = [1, 1, 2, 3, 6, 11];
    eq('the shipped price ladder is 1 / 1 / 2 / 3 / 6 / 11',
        JSON.stringify(rungs.map(engine.armPriceOf)), JSON.stringify(want));
    ok('no price ever rounds away to free', rungs.every(m => engine.armPriceOf(m) >= config.armFloor));
    ok('every price is a whole number', rungs.every(m => Number.isInteger(engine.armPriceOf(m))));
    ok('a hot run pays more than a nominal one at the same rung',
        engine.armPriceOf(LEVELS[2].payout * 2) > engine.armPriceOf(LEVELS[2].payout),
        'a flat table would charge the same, which is the bug this shape avoids');
}

console.log('\nSPENDING — the multiple is the currency and the standing is derived from it');
{
    const spent = engine.spendMultiple(1000, 7.301384, 3);
    near('the multiple comes down by exactly the price', spent.mult, 4.301384);
    eq('the standing is re-derived, not adjusted', spent.standing, engine.bankPayout(1000, 4.301384));
    ok('a price that would leave nothing is refused', engine.spendMultiple(1000, 3, 3) === null);
    ok('a price larger than the standing is refused', engine.spendMultiple(1000, 1.94, 3) === null);
}

console.log('\nARMING — who may buy, when, and what it does to the board');
{
    const w = makeWorld({ perks: ALL_PERKS });
    w.stand(7.301384);
    const before = w.ladder().standing;
    const price = engine.armPriceOf(7.301384);

    const armed = actions.arm(w.ctxOf(), { pick: 'scrap' });
    ok('a pick can be armed between rungs', armed.ok, armed.message);
    eq('it charges the advertised price', armed.paid, price);
    eq('the standing on the board comes down with it', w.ladder().standing,
        engine.bankPayout(1000, 7.301384 - price));
    ok('the standing really moved', w.ladder().standing < before);
    eq('the pick is recorded as armed', !!w.ladder().armed.scrap, true);
    eq('the next price is quoted off the new multiple', armed.price,
        engine.armPriceOf(7.301384 - price));

    const twice = actions.arm(w.ctxOf(), { pick: 'scrap' });
    eq('the same pick cannot be armed twice on one rung', twice.code, 'already_armed');

    const second = actions.arm(w.ctxOf(), { pick: 'swap' });
    ok('a different pick can be armed on the same rung', second.ok, second.message);
    ok('both are now armed', w.ladder().armed.scrap && w.ladder().armed.swap);
    const third = actions.arm(w.ctxOf(), { pick: 'split' });
    ok('and so can the third — there is no cap but the purse', third.ok, third.message);

    eq('an unknown pick is refused', actions.arm(w.ctxOf(), { pick: 'bribe' }).code, 'bad_pick');
}

console.log('\n  ...and who may not');
{
    const w = makeWorld({ perks: { shuffle: true } });
    w.stand(7.301384);
    eq('a pick off the rack cannot be armed', actions.arm(w.ctxOf(), { pick: 'scrap' }).code, 'not_owned');
    ok('one on the rack can', actions.arm(w.ctxOf(), { pick: 'swap' }).ok);
}
{
    const w = makeWorld({ perks: ALL_PERKS });
    // A standing worth less than one whole mult cannot carry a price with anything left over.
    w.stand(1);
    eq('a standing that cannot cover the price is refused', actions.arm(w.ctxOf(), { pick: 'scrap' }).code, 'too_poor');
    eq('and nothing was taken for the refusal', w.ladder().mult, 1);
}
{
    const w = makeWorld({ perks: ALL_PERKS });
    w.stand(7.301384, {
        // A rung already called and already on the table: the exact case the price exists to stop.
        shown: { called: 'red', level: 0, set: {}, faces: {}, bag: [] },
    });
    eq('a pick cannot be armed against a line already called',
        actions.arm(w.ctxOf(), { pick: 'scrap' }).code, 'roll_live');
    eq('and the standing is untouched by the refusal', w.ladder().mult, 7.301384);
}
{
    const w = makeWorld({ perks: ALL_PERKS });
    // A premonition's park is *not* called, and arming after a look is deliberately allowed — see the
    // note on `arm`. This is the assertion that the allowance is real rather than accidental.
    w.stand(7.301384, { shown: { called: null, level: 0, set: {}, faces: {}, bag: [], seen: 0 } });
    ok('a pick can still be armed after a look', actions.arm(w.ctxOf(), { pick: 'scrap' }).ok);
}

console.log('\nTHE LOOK — priced flat, once a rung, and refunded when it sells nothing');
{
    const w = makeWorld({ perks: ALL_PERKS, rack: ['greed', 'wild', 'mirror'] });
    w.stand(7.301384);
    const out = actions.premonition(w.ctxOf());
    ok('a look can be taken between rungs', out.ok, out.message);
    if (out.ok) {
        near('it costs the flat price', w.ladder().mult, 7.301384 - config.lookCost);
        eq('the standing follows the multiple', w.ladder().standing,
            engine.bankPayout(1000, 7.301384 - config.lookCost));
        eq('a second look on the same rung is refused', actions.premonition(w.ctxOf()).code, 'already_shown');
    }
}
{
    const w = makeWorld({ perks: ALL_PERKS });
    // The price has to leave something behind, so a standing *equal* to it cannot pay it either.
    w.stand(1);
    eq('a standing that the price would empty cannot look', actions.premonition(w.ctxOf()).code, 'too_poor');
    eq('and pays nothing for being told so', w.ladder().mult, 1);
}

console.log('\nTHE ANTE — charged on naming, returned on taking the name back');
{
    const w = makeWorld({ perks: ALL_PERKS, rack: ['greed', 'mirror'] });
    w.stand(7.301384, { level: 1, book: ['tie'] });
    const ante = engine.betPriceOf();

    const placed = actions.placeBet(w.ctxOf(), { id: 'tie' });
    ok('a card can be named', placed.ok, placed.message);
    eq('the ante is charged', placed.paid, ante);
    near('out of the multiple', w.ladder().mult, 7.301384 - ante);

    const again = actions.placeBet(w.ctxOf(), { id: 'tie' });
    eq('naming the same card again charges nothing', again.paid, 0);
    near('and moves nothing', w.ladder().mult, 7.301384 - ante);

    const cleared = actions.placeBet(w.ctxOf(), { id: null });
    eq('taking the name back returns the ante', cleared.paid, -ante);
    near('leaving the standing where it started', w.ladder().mult, 7.301384);
    eq('and the bet is gone', w.ladder().bet, null);

    eq('a card that is not chalked up is refused',
        actions.placeBet(w.ctxOf(), { id: 'engine' }).code, 'bad_bet');
    near('a refusal costs nothing', w.ladder().mult, 7.301384);
}

console.log('\n  ...and the ante comes back inside the payout');
{
    // **The half that was missing and cost the player a whole `p` a card.** `price` is net odds — the
    // profit on a one-mult stake — so a hit has to return the stake with it or the bet is charged twice.
    const hit = { notes: [{ kind: 'broken' }], ended: false, faceIds: ['x'], majority: 'red' };
    const miss = { notes: [], ended: false, faceIds: ['x'], majority: 'red' };
    const card = SIDE_BETS.find(b => b.id === 'broken');
    eq('a card that lands pays its price plus the ante',
        engine.betPaid('broken', hit), card.price + config.betAnte);
    eq('a card that misses pays nothing', engine.betPaid('broken', miss), 0);
    eq('an unnamed card pays nothing', engine.betPaid(null, hit), 0);

    // At the fair price the round trip is a wash, which is the property the price list was written
    // against — `cubeSideBet.js` derives `price` as `1/p - 1`, so `p x (price + ante) - ante` is zero.
    for (const b of SIDE_BETS) {
        const p = 1 / (b.price + 1);
        const ev = p * (b.price + config.betAnte) - config.betAnte;
        ok(`${b.id} at its own fair rate is a wash, not a second edge`, Math.abs(ev) < 1e-9,
            `EV ${ev.toFixed(4)} — paying bare price would be ${(p * b.price - config.betAnte).toFixed(4)}`);
    }
}

console.log('\nEXPIRY — an arm belongs to one rung');
{
    const w = makeWorld({ perks: ALL_PERKS, rack: ['greed'] });
    w.stand(1.94);
    actions.arm(w.ctxOf(), { pick: 'scrap' });
    ok('armed for this rung', !!w.ladder().armed.scrap);

    // Push into the next rung the way the game does, then settle it, and read what the settlement left.
    const pushed = actions.pushRun(w.ctxOf(), { call: 'red' });
    ok('the run pushes', pushed.ok, pushed.message);
    if (pushed.ok) {
        ok('the arm rides into the rung it was bought for', !!pushed.run.armed.scrap);
    }
}
{
    // The settlement is the thing that has to forget. Played for real until a rung is survived, then
    // the ladder it wrote is read directly — there is no way to assert this from outside a win.
    const w = makeWorld({ perks: ALL_PERKS, rack: ['greed'] });
    let survived = false;
    for (let attempt = 0; attempt < 200 && !survived; attempt++) {
        const started = actions.startRun(w.ctxOf(), { call: 'red' });
        if (!started.ok) continue;
        const ctx = w.ctxOf();
        const thrown = actions.throwLevel(ctx, started.run);
        if (thrown.asking) { persist.clearLadder(ctx.database, ctx.db, ME); continue; }
        // `settleThrow` is async and writes the ladder through the in-memory mirror first, so the
        // node is readable on the next line without awaiting the (fake) database behind it.
        const settling = actions.settleThrow(ctx, { thrown });
        if (settling && typeof settling.then === 'function') settling.catch(() => {});
        const live = w.ladder();
        if (!live || !live.standing) { continue; }
        survived = true;
        eq('a settled rung leaves nothing armed', JSON.stringify(live.armed || {}), '{}');
        eq('and no look taken', !!live.saw, false);
        eq('and no bet standing', live.bet || null, null);
        // Arming for the *next* rung is a fresh purchase at the new price.
        const price = engine.armPriceOf(live.mult);
        const armed = actions.arm(w.ctxOf(), { pick: 'scrap' });
        ok('the next rung must be armed again', armed.ok, armed.message);
        eq('at the price of the rung it is bought on', armed.paid, price);
    }
    ok('a rung was survived, so expiry was actually exercised', survived);
}

console.log(`\n${failures ? 'FAILED' : 'PASSED'} — ${checks - failures}/${checks} checks\n`);
process.exit(failures ? 1 : 0);
