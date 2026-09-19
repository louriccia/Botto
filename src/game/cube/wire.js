// A settled throw, as it goes on the wire.
//
// Split out of `src/api/cube.js` when a second caller appeared. The shape is what the Activity
// animates from, so there must be exactly one of it: a field missing here is a field the client
// cannot draw. `src/api/cube.js`, `src/game/cube/sandbox.js` and `scripts/cubeFixtures.js` all
// build it from here.

const engine = require('./engine.js');

// Everything the client needs to animate a throw and then show what it paid. The reveal caps
// the embed lives with — three effect frames, four pay frames — are **not** applied: they are a
// property of a message edit, and this client has no such limit.
const rollResponse = (thrown, settled) => ({
    // The line as thrown, one id per position, before any effect resolved.
    thrown: thrown.rolled,
    // What a face id cannot say about the position it is standing on, index for index against the
    // line beside it — see `lineState` in the engine.
    //
    // Two copies rather than one, because the two lines genuinely disagree and the difference is
    // the beat: a scorch applied on this rung is on the resolved line and not on the thrown one,
    // and a cube whose ice an effect broke against is held on the throw and thawed by the payout.
    // Every step carries its own for the same reason.
    thrownState: thrown.rolledState,
    // The line as it ended up, and the walk that got there. The nine fields below are the
    // resolved `lineState`, flat rather than nested — see `thrownState`.
    //
    // **Flat means enumerated, and enumerated means this list is a thing that goes stale.** Two
    // fields were added to `lineState` and not to this list, and neither reached the client at all:
    // a whole feature's worth of state existed on both sides of the wire and not in it. If you add
    // to `lineState`, add here — `cubeThree.js` fails if you do not.
    line: thrown.res.faceIds,
    // The cubes' names. A cube is an instance of its class, so two Greed Cubes side by side are two
    // cubes — this is what lets the client say which of them was singed, and follow one across a
    // shuffle.
    uids: thrown.res.uids,
    // Which way round each cube is. A reflection turns the cube rather than the picture, so this is
    // permanent and the client has to draw it.
    mirrored: thrown.res.mirrored,
    frozen: thrown.res.frozen,
    burned: thrown.res.burned,
    painted: thrown.res.painted,
    charred: thrown.res.charred,
    blessed: thrown.res.blessed,
    cubeIds: thrown.res.cubeIds,
    // How many cubes each position is carrying. The one thing in `lineState` that isn't visible on
    // the position at all: a captured cube is off the line, so a sandcrawler with four in it draws
    // exactly like one with none. See Capture in the tuning.
    holds: thrown.res.holds,
    steps: thrown.res.steps,
    notes: thrown.res.notes,
    pays: engine.multSteps(thrown.opening, thrown.res.pays,
        settled ? settled.majority : null),
    level: thrown.run.level,
    // Which rung this was. `kind` is 'level' or 'again'; `again` is which time round, so a
    // client can draw `Again ×3` without inferring it from anything.
    kind: thrown.kind,
    again: thrown.run.again || 0,
    call: thrown.run.call,
    stake: thrown.run.stake,
    opening: thrown.opening,
    breaker: thrown.breaker,
    // What the line *held*, as totals rather than as faces, because both can be written over in
    // the second pass and leave the line with no position to count them off.
    //
    // **Held, not banked.** Neither is awarded off a roll that ends the run — see `settleThrow` —
    // so a client counting these up has to check `settled.won` first, exactly as it does for `pays`.
    rerolls: thrown.res.rerolls,
    shortcuts: thrown.res.shortcuts,
    ended: thrown.res.ended,
    // Cubes the table is holding when the dust settles, nested holds included — the total behind
    // `holds`, and what the board draws as `N held`.
    held: thrown.res.held,
    // How many cubes the table had spawned when the engine gave up on it, 0 on every roll that
    // resolved. The bust reason already says `overflow`; this is the number, which is the only
    // part of that ending a client can't work out from the line in front of it — the line stops
    // at whatever `maxCubes` and the effects left standing, not at the count that tripped it.
    overflow: thrown.res.overflow,
    // How many cubes the bag had left when this roll finished. The client would otherwise read it
    // off the run the roll left behind, which works until there is no run left to read: a bust by a
    // player with no reroll banked clears the ladder outright — see `settleLoss`. Sent on every
    // roll, because a figure a client has to fetch two ways is one that will disagree with itself.
    bag: (thrown.bag || []).length,
    // The side bet this rung was carrying, and what it paid — neither derivable on the other side:
    // the board's `bet` is nulled the moment the rung settles, and whether a proposition *hit* is a
    // predicate in `SIDE_BETS` that only this side holds.
    //
    // `0` on a bet that missed and `null` on a rung nobody bet, which are different facts: one is a
    // proposition that lost and has to be shown losing, the other is nothing to show.
    bet: thrown.bet || null,
    betPaid: thrown.bet ? (thrown.betPaid || 0) : null,
    ...(settled ? { settled } : {}),
});

module.exports = { rollResponse };
