// Walks Watto's rack as a graph and proves it is one you can actually get to the end of.
//
// `TREE` in the tuning turned a flat list of picks into five gated trees, and a prerequisite graph has
// exactly two failure modes that a rack does not: a node nothing can reach, and a state that offers
// nothing while the player still holds a point. Neither shows up in play until somebody has spent
// fifteen prestiges getting there, so both are checked here instead.
//
// What it asserts:
//
//   1. Every cube on the rack is in the tree, and everything in the tree is real. A cube that exists
//      in `SPECIALS`, isn't `OFF_RACK` and isn't in `TREE` is a cube nobody can ever buy.
//   2. No prerequisite names a node that doesn't exist, and no node is its own ancestor.
//   3. From an empty profile, every pick is reachable and the offer is **never empty** while anything
//      is left — walked greedily, depth-first per tree, and at random, because a dead end can hide
//      behind one order and not another.
//
// The random walks are the ones that matter. Greedy and depth-first both happen to satisfy
// prerequisites in the order they were written down; a player will not.
//
//   node scripts/cubeTree.js [walks]
//
// Read-only. It touches no database and stakes nothing.

const pstate = require('../src/game/cube/state.js');
const engine = require('../src/game/cube/engine.js');
const {
    SPECIALS, TREE, TREES, cube: config,
} = require('../src/game/cube/tuning.js');

const WALKS = Number(process.argv[2]) || 2000;

// The press is one reward value bought `weldTiers.length` times, so the number of *picks* on the rack
// is not the number of *nodes* in the table.
const PICKS = Object.entries(TREE)
    .reduce((n, [, node]) => n + (node.ladder ? config.weldTiers.length : 1), 0);

const fresh = () => {
    const s = pstate.cubeState({});
    s.points = PICKS + 1;
    return s;
};

const fail = (msg) => {
    console.error(`FAIL  ${msg}`);
    process.exitCode = 1;
};

// ---------------------------------------------------------------------------
// 1. The tree covers the rack, and only the rack
// ---------------------------------------------------------------------------

let problems = 0;
for (const sp of SPECIALS) {
    if (pstate.OFF_RACK.has(sp.id)) {
        if (TREE[`cube:${sp.id}`]) {
            fail(`${sp.id} is OFF_RACK but has a tree node — it would become a prestige pick.`);
            problems += 1;
        }
        continue;
    }
    if (!TREE[`cube:${sp.id}`]) {
        fail(`${sp.id} is on the rack but has no tree node — nobody can ever buy it.`);
        problems += 1;
    }
}

const known = new Set(Object.keys(TREE));
const trees = new Set(TREES.map(t => t.id));
for (const [value, node] of Object.entries(TREE)) {
    if (!trees.has(node.tree)) {
        fail(`${value} sits in unknown tree "${node.tree}".`);
        problems += 1;
    }
    for (const need of [...(node.requires || []), ...(node.requiresAny || [])]) {
        if (!known.has(need)) {
            fail(`${value} requires "${need}", which is not a node.`);
            problems += 1;
        }
    }
    // Trees are meant to be islands: a cross-tree edge would put a node in one tab behind a node in
    // another, which is the whole thing the five-tab layout exists to avoid.
    for (const need of [...(node.requires || []), ...(node.requiresAny || [])]) {
        if (TREE[need] && TREE[need].tree !== node.tree) {
            fail(`${value} (${node.tree}) requires ${need} (${TREE[need].tree}) — trees must not cross.`);
            problems += 1;
        }
    }
}

// Depth of a node by walking its prerequisites, which also catches a cycle.
//
// `pressTier` counts as an edge even though it isn't one. The press is four picks sharing a reward
// value, so the rung that satisfies `pressTier: 3` sits at depth 3 — a node hanging off it is at 4,
// exactly as if the rungs had been four separate entries.
const depthOf = function (value, seen = new Set()) {
    if (seen.has(value)) {
        fail(`${value} is its own ancestor.`);
        return 0;
    }
    const node = TREE[value];
    if (!node) return 0;
    const needs = [...(node.requires || []), ...(node.requiresAny || [])];
    const next = new Set([...seen, value]);
    const under = Math.max(
        node.pressTier || 0,
        ...needs.map(v => depthOf(v, next)),
        0,
    );
    return under + 1;
};

// The declared tier is what the client lays out from, so it has to agree with the graph or the
// drawing and the gating disagree about what sits above what.
for (const [value, node] of Object.entries(TREE)) {
    if (node.ladder) continue;
    const walked = depthOf(value);
    if (node.tier !== walked) {
        fail(`${value} declares tier ${node.tier} but its prerequisites put it at ${walked}.`);
        problems += 1;
    }
}

// ---------------------------------------------------------------------------
// 2. Walks
// ---------------------------------------------------------------------------

// One full walk of the rack. `pick` chooses from what is on offer; the walk asserts the offer is
// never empty and that it ends having bought everything.
const walk = function (pick, label) {
    const s = fresh();
    const taken = [];
    for (let i = 0; i < PICKS; i += 1) {
        const offers = pstate.rewardChoices(s);
        if (!offers.length) {
            fail(`${label}: nothing on offer after ${taken.length}/${PICKS} picks — dead end.`);
            return null;
        }
        const choice = pick(offers, s);
        pstate.spendPoint(s, {}, choice.value);
        taken.push(choice.value);
    }
    const left = pstate.rewardChoices(s);
    if (left.length) {
        fail(`${label}: ${left.length} still on offer after ${PICKS} picks — the count is wrong.`);
        return null;
    }
    return { s, taken };
};

const first = walk(offers => offers[0], 'in-order');
const last = walk(offers => offers[offers.length - 1], 'reversed');

let widest = 0;
let worstEmpty = Infinity;
for (let i = 0; i < WALKS; i += 1) {
    const out = walk((offers) => {
        widest = Math.max(widest, offers.length);
        worstEmpty = Math.min(worstEmpty, offers.length);
        return offers[Math.floor(Math.random() * offers.length)];
    }, `random #${i + 1}`);
    if (!out) break;
}

// ---------------------------------------------------------------------------
// 3. When the press opens
// ---------------------------------------------------------------------------

// The Forger is gated on owning a cube you cannot field, so it should be unreachable until the ninth
// cube and reachable immediately after. Measured rather than asserted from the constant, because the
// gate is derived from `bagSize()` and the point is that it follows it.
let openedAt = null;
{
    const s = fresh();
    for (let i = 0; i < PICKS && openedAt === null; i += 1) {
        const offers = pstate.rewardChoices(s);
        const cube = offers.find(c => c.kind === 'cube');
        if (!cube) break;
        pstate.spendPoint(s, {}, cube.value);
        if (pstate.rewardChoices(s).some(c => c.tree === 'forger')) openedAt = s.cubes.length;
    }
}

// ---------------------------------------------------------------------------

console.log(`rack        ${Object.keys(TREE).length} nodes, ${PICKS} picks, ${TREES.length} trees`);
console.log(`bag         ${engine.bagSize()} seats`);
console.log(`forger      opens at ${openedAt} cubes owned`);
console.log(`offer size  ${worstEmpty}–${widest} across ${WALKS} random walks`);
console.log('');

for (const tree of TREES) {
    const nodes = Object.entries(TREE).filter(([, n]) => n.tree === tree.id);
    const picks = nodes.reduce((n, [, x]) => n + (x.ladder ? config.weldTiers.length : 1), 0);
    const tiers = [1, 2, 3, 4].map((t) => {
        const at = nodes.filter(([, n]) => (n.ladder ? true : n.tier === t));
        return at.length;
    });
    console.log(`${tree.name.padEnd(14)} ${picks} picks   tiers ${tiers.join('/')}`);
}

if (first && last) {
    console.log('');
    console.log(`in-order    ${first.taken.length} picks, ended clean`);
    console.log(`reversed    ${last.taken.length} picks, ended clean`);
}
if (!problems && process.exitCode !== 1) console.log('\nOK');
