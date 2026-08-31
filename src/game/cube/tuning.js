exports.SIDES = { blue: 'Blue', red: 'Red' };
const SIDE_IDS = { blue: 'side:blue', red: 'side:red' };
const faceKey = f => (f.side ? `${f.kind}:${f.side}` : f.dir ? `${f.kind}:${f.dir}` : f.kind);
exports.faceKey = faceKey;
exports.SIDE_IDS = SIDE_IDS;

const LEVEL_STEP = 1.94;

const LEVEL_COUNT = 5;
exports.LEVELS = Array.from({ length: LEVEL_COUNT }, (_, i) => ({ payout: LEVEL_STEP ** (i + 1) }));

const rep = (n, face) => Array.from({ length: n }, () => face);

const END = { kind: 'end' };
const BROKEN = { kind: 'broken' };

exports.SPECIALS = [
    {
        id: 'wild', name: 'Wild Cube',
        blurb: 'Three faces land on the side you called. Three blow a hole in the line.',
        faces: [...rep(3, { kind: 'wild' }), ...rep(3, END)],
    },
    {
        id: 'greed', name: 'Greed Cube',
        blurb: 'Five faces pay +50% on the level. One ends the run.',
        faces: [...rep(5, { kind: 'greed' }), END],
    },
    {
        id: 'shmi', name: 'Shmi Cube',
        blurb: 'Red four times in six, blue once — red was his mother. One face ends the run.',
        faces: [
            ...rep(4, { kind: 'side', side: 'red' }),
            { kind: 'side', side: 'blue' },
            END,
        ],
    },
    {
        id: 'anakin', name: 'Anakin Cube',
        blurb: 'Blue four times in six, red once — blue was the boy. One face ends the run.',
        faces: [
            ...rep(4, { kind: 'side', side: 'blue' }),
            { kind: 'side', side: 'red' },
            END,
        ],
    },
    {
        id: 'mirror', name: 'Mirror Cube',
        blurb: 'Half reflect everything behind it onto the cubes ahead, special cubes included; half invert the line.',
        faces: [
            ...rep(3, { kind: 'mirror' }),
            ...rep(3, { kind: 'invert' }),
        ],
    },
    {
        id: 'symbiont', name: 'Symbiont Cube',
        blurb: 'Slips a red and a blue in either side of it, or matching twins — or takes cubes off the table.',
        faces: [
            { kind: 'cull' },
            { kind: 'raze', wings: { left: 'razed:left', right: 'razed:right' } },
            ...rep(2, { kind: 'pair' }),
            ...rep(2, { kind: 'twins' }),
        ],
    },
    {
        id: 'shortcut', name: 'Shortcut Cube',
        blurb: 'Five faces pay a free clear if you win. One ends the run.',
        faces: [...rep(5, { kind: 'shortcut' }), END],
    },
    {
        id: 'reroll', name: 'Reroll Cube',
        blurb: 'Three faces bank a reroll. Two shatter the cube, one ends the run.',
        faces: [...rep(3, { kind: 'reroll' }), END, ...rep(2, BROKEN)],
    },
    {
        id: 'binder', name: 'Binder Cube',
        blurb: 'Burns the cube on its right, or makes it a copy of the cube on its left.',
        faces: [
            ...rep(3, { kind: 'burn' }),
            ...rep(3, { kind: 'clone' }),
        ],
    },
    {
        id: 'multiplier', name: 'Midi-chlorian Cube',
        blurb: 'Four faces double the payout if their own side wins. Two break the cube.',
        faces: [
            ...rep(2, { kind: 'mult', side: 'red' }),
            ...rep(2, { kind: 'mult', side: 'blue' }),
            ...rep(2, BROKEN),
        ],
    },
    {
        id: 'gungan', name: 'Gungan Shield Cube',
        blurb: 'Every face stops the blast from a mine on its own side of the line, and is destroyed '
            + 'doing it. It also holds a neighbour that wipes out together.',
        faces: rep(6, { kind: 'shield' }),
    },
    {
        id: 'pitdroid', name: 'Pit Droid Cube',
        blurb: 'Five faces pull another cube out of the bag. One scraps every special on the table.',
        faces: [...rep(5, { kind: 'draw' }), { kind: 'purge' }],
    },
    {
        id: 'boost', name: 'Boost Cube',
        blurb: 'Four faces pay for every cube on the table. Two shatter the cube.',
        faces: [...rep(4, { kind: 'boost' }), ...rep(2, BROKEN)],
    },
    {
        id: 'sebulba', name: 'Sebulba Cube',
        blurb: 'Two faces point an engine either way and burn that cube over to your call. '
            + 'Two shatter the cube.',
        faces: [
            ...rep(2, { kind: 'engine', dir: 'left', mirrored: 'engine:right' }),
            ...rep(2, { kind: 'engine', dir: 'right', mirrored: 'engine:left' }),
            ...rep(2, BROKEN),
        ],
    },
    {
        id: 'turbine', name: 'Turbine Cube',
        blurb: 'Five faces pay more every time, and burn themselves off the cube. One shatters it.',
        faces: [...rep(5, { kind: 'heat' }), BROKEN],
    },
    {
        id: 'scavenger', name: 'Scavenger Cube',
        blurb: 'Three faces salvage a cube — out of its own hold first, the wreckage second. '
            + 'Two haul one off the line into it. One shatters the cube.',
        faces: [
            ...rep(3, { kind: 'scavenge' }),
            ...rep(2, { kind: 'haul' }),
            BROKEN,
        ],
    },
    {
        id: 'guide', name: 'Guide Cube',
        blurb: 'Five faces pay for every cube in the unbroken run of your call touching it. '
            + 'One ends the run.',
        faces: [...rep(5, { kind: 'guide' }), END],
    },
    {
        id: 'octahedron',
        name: 'Planet Octahedron',
        blurb: 'Eight faces, one per planet. None of them is a side and all of them reach off the line.',
        noWeld: true,
        faces: [
            { kind: 'freeze' },
            { kind: 'vault' },
            { kind: 'scorch' },
            { kind: 'blessing' },
            { kind: 'seam' },
            { kind: 'jail' },
            { kind: 'plunge' },
            { kind: 'crowd' },
        ],
    },
];

exports.SIDE_BETS = [
    {
        id: 'broken', band: 'likely', price: 2, say: 'A cube shatters',
        needs: ['broken'], hit: r => r.notes.some(n => n.kind === 'broken'),
    },
    {
        id: 'invert', band: 'likely', price: 3, say: 'The line flips',
        needs: ['invert'], hit: r => r.notes.some(n => n.kind === 'invert'),
    },
    {
        id: 'tie', band: 'likely', price: 7.1, say: 'Nobody wins the line',
        needs: null, spoils: ['wild', 'raze', 'cull'],
        hit: r => !r.ended && !!r.faceIds.length && !r.majority,
    },
    {
        id: 'burn', band: 'likely', price: 6.0, say: 'A cube gets burned',
        needs: ['burn'], hit: r => r.notes.some(n => n.kind === 'burn'),
    },
    {
        id: 'mirror', band: 'middle', price: 4, say: 'A reflection lands',
        needs: ['mirror'], hit: r => r.notes.some(n => n.kind === 'mirror' && n.copied > 0),
    },
    {
        id: 'clone', band: 'middle', price: 7.7, say: 'A cube gets copied',
        needs: ['clone'], hit: r => r.notes.some(n => n.kind === 'clone'),
    },
    {
        id: 'grow', band: 'middle', price: 9.5, say: 'Padmé slips in matching twins',
        needs: ['twins'],
        hit: r => r.notes.some(n => n.kind === 'twins'),
    },
    {
        id: 'raze', band: 'long', price: 19.9, say: 'Ben razes a neighbour',
        needs: ['raze'], hit: r => r.notes.some(n => n.kind === 'raze'),
    },
    {
        id: 'purge', band: 'long', price: 15, say: 'Order 66',
        needs: ['purge'], hit: r => r.notes.some(n => n.kind === 'purge'),
    },
    {
        id: 'saved', band: 'long', price: 11, say: 'A cube holds together',
        needs: ['shield'], spoils: ['shield', 'broken'],
        hit: r => r.notes.some(n => n.kind === 'broken.saved'),
    },
    {
        id: 'engine', band: 'long', price: 23, say: 'Sebulba turns a cube',
        needs: ['engine'], hit: r => r.notes.some(n => n.kind === 'engine'),
    },
];

exports.TREES = [
    { id: 'swindler', name: 'The Swindler', blurb: 'Make your colour land.' },
    { id: 'gambler', name: 'The Gambler', blurb: 'Make it pay.' },
    { id: 'dealer', name: 'The Dealer', blurb: 'Decide what is standing on the line.' },
    { id: 'junker', name: 'The Junker', blurb: 'Lose less of it.' },
    { id: 'forger', name: 'The Forger', blurb: 'Two cubes, one seat.', opens: 'overflow' },
];

exports.TREE = {
    'cube:shmi': { tree: 'swindler', tier: 1 },
    'cube:anakin': { tree: 'swindler', tier: 1 },
    'cube:wild': { tree: 'swindler', tier: 2, requiresAny: ['cube:shmi', 'cube:anakin'] },
    'cube:sebulba': { tree: 'swindler', tier: 3, requires: ['cube:wild'] },
    'cube:guide': { tree: 'swindler', tier: 3, requires: ['cube:wild'] },
    premonition: { tree: 'swindler', tier: 4, requires: ['cube:sebulba'] },

    'cube:greed': { tree: 'gambler', tier: 1 },
    'cube:multiplier': { tree: 'gambler', tier: 2, requires: ['cube:greed'] },
    bribe: { tree: 'gambler', tier: 3, requires: ['cube:multiplier'] },
    'cube:turbine': { tree: 'gambler', tier: 3, requires: ['cube:multiplier'] },
    'cube:boost': { tree: 'gambler', tier: 4, requires: ['cube:turbine'] },
    sidebet: { tree: 'gambler', tier: 4, requires: ['cube:turbine'] },

    'cube:binder': { tree: 'dealer', tier: 1 },
    'cube:mirror': { tree: 'dealer', tier: 2, requires: ['cube:binder'] },
    nudge: { tree: 'dealer', tier: 2, requires: ['cube:binder'] },
    'cube:symbiont': { tree: 'dealer', tier: 3, requires: ['cube:mirror'] },
    shuffle: { tree: 'dealer', tier: 3, requires: ['cube:mirror'] },
    'cube:pitdroid': { tree: 'dealer', tier: 4, requires: ['cube:symbiont'] },

    'cube:shortcut': { tree: 'junker', tier: 1 },
    'cube:reroll': { tree: 'junker', tier: 2, requires: ['cube:shortcut'] },
    reroll: { tree: 'junker', tier: 3, requires: ['cube:reroll'] },
    'cube:gungan': { tree: 'junker', tier: 3, requires: ['cube:reroll'] },
    'cube:scavenger': { tree: 'junker', tier: 4, requires: ['cube:gungan'] },
    scrap: { tree: 'junker', tier: 4, requires: ['cube:gungan'] },

    press: { tree: 'forger', ladder: 'weldTiers' },
    keeper: { tree: 'forger', tier: 2, pressTier: 1 },
    split: { tree: 'forger', tier: 4, pressTier: 3 },
};

exports.PLAIN_FACES = [
    ...rep(3, { kind: 'side', side: 'blue' }),
    ...rep(3, { kind: 'side', side: 'red' }),
];

for (const f of [...exports.SPECIALS.flatMap(sp => sp.faces || []), ...exports.PLAIN_FACES]) {
    f.id = faceKey(f);
}

exports.cube = {
    minStake: 100,
    defaultStake: 1000,
    maxStake: 1000,
    maxStakeStep: 2,
    blastReach: 2,
    clearsToUnlock: 1,
    clearsPrestigeStep: 2,
    maxClears: 5,
    clearsToPrestige: 1,
    startingCubes: 1,
    cubesPerLevel: 2,
    maxCubes: Infinity,
    overflowAt: 100,
    tieLean: 0.6,
    nudgeLean: 0.50,
    bribeEdge: 0.03,
    bribeStep: 1.5,
    levelStep: LEVEL_STEP,
    againBonus: 1,

    armShare: 0.21,
    armShares: { scrap: 0.21, swap: 0.05 },
    armFloor: 0.1,
    lookShare: 0.17,
    betAnte: 1,
    overtimeBonus: 5,
    greedBonus: 0.5,
    multBonus: 1,
    boostBonus: 0.10,
    heatBonus: 0.25,
    guideBonus: 0.5,
    seamBonus: 0.5,
    jailSize: 4,
    minFaces: 1,
    pureBonus: 0.25,
    weldTiers: [
        {
            name: 'The Press',
            blurb: 'Weld two cubes into one seat, carrying three faces from each.',
        },
        {
            name: 'Uneven Cuts',
            blurb: 'The press sometimes takes four faces from one cube and two from the other — '
                + 'and you name which cube gives more.',
        },
        {
            name: 'The Third Cube',
            blurb: 'The press takes three cubes at once, two faces from each.',
        },
        {
            name: 'Deep Cuts',
            blurb: 'Rarely the press takes five faces from one cube and one from the other.',
        },
    ],
    weldSplits: {
        2: [
            { take: [3, 3], weight: 100, tier: 1 },
            { take: [4, 2], weight: 10, tier: 2 },
            { take: [5, 1], weight: 1, tier: 4 },
        ],
        3: [
            { take: [2, 2, 2], weight: 100, tier: 3 },
            { take: [3, 2, 1], weight: 10, tier: 3 },
            { take: [4, 1, 1], weight: 1, tier: 4 },
        ],
    },
    weldPurity: 0.01,
    weldMemory: 2,
    weldRerollCost: 2500,
    rerollCost: 2500,
    rerollPriceStep: 1.5,
};

const SKIN_SHAPES = [
    { id: 'sq', name: 'Square' },
    { id: 'ci', name: 'Circle' },
    { id: 'ht', name: 'Heart' },
];
exports.SKIN_SHAPES = SKIN_SHAPES;

const SKIN_COLORS = [
    { id: 'red', name: 'Red' },
    { id: 'orange', name: 'Orange' },
    { id: 'yellow', name: 'Yellow' },
    { id: 'green', name: 'Green' },
    { id: 'blue', name: 'Blue' },
    { id: 'purple', name: 'Purple' },
    { id: 'pink', name: 'Pink' },
    { id: 'brown', name: 'Brown' },
    { id: 'black', name: 'Black' },
    { id: 'white', name: 'White' },
];
exports.SKIN_COLORS = SKIN_COLORS;

const RACER_FLAGS = 23;
const racerName = function (n) {
    const { racers } = require('../../data/sw_racer/racer.js');
    const found = racers.find(r => Number(r.racernum) === n);
    return found ? found.name : `Racer ${n}`;
};

const SKIN_VARIANTS = [
    ...SKIN_SHAPES.flatMap(s => SKIN_COLORS.map(c => `${s.id}:${c.id}`)),
    ...Array.from({ length: RACER_FLAGS }, (_, i) => `flag:${i}`),
];
exports.SKIN_VARIANTS = SKIN_VARIANTS;

const SKIN_FREE = ['sq:blue', 'sq:red', 'ci:blue', 'ci:red'];
exports.SKIN_FREE = SKIN_FREE;

const SKIN_PAIR_PRICE = 5000;
const SKIN_FLAG_PRICE = 3000;

const SKIN_SHELF = [
    { shape: 'sq', pair: 'purple+orange', gate: { prestige: 1 } },
    { shape: 'sq', pair: 'green+pink', gate: { prestige: 2 } },
    { shape: 'sq', pair: 'white+black', gate: { prestige: 3 } },
    { shape: 'sq', pair: 'yellow+brown', gate: { prestige: 4 } },
    { shape: 'ci', pair: 'purple+orange', gate: { cubes: 4 } },
    { shape: 'ci', pair: 'green+pink', gate: { cubes: 6 } },
    { shape: 'ci', pair: 'white+black', gate: { cubes: 8 } },
    { shape: 'ci', pair: 'yellow+brown', gate: { cubes: 10 } },
    { shape: 'ht', pair: 'blue+red', gate: { prestige: 2 } },
    { shape: 'ht', pair: 'purple+orange', gate: { prestige: 3 } },
    { shape: 'ht', pair: 'green+pink', gate: { cubes: 12 } },
    { shape: 'ht', pair: 'white+black', gate: { prestige: 5 } },
    { shape: 'ht', pair: 'yellow+brown', gate: { faces: 'all' } },
];

const SKIN_FLAG_GATE = { prestige: 3 };

const skinShape = id => SKIN_SHAPES.find(s => s.id === id);
const skinColor = id => SKIN_COLORS.find(c => c.id === id);

exports.SKIN_SETS = [
    ...SKIN_SHELF.map(({ shape, pair, gate }) => {
        const [a, b] = pair.split('+');
        return {
            id: `set:${shape}:${pair}`,
            name: `${skinColor(a).name} & ${skinColor(b).name} ${skinShape(shape).name}s`,
            ids: [`${shape}:${a}`, `${shape}:${b}`],
            group: shape,
            price: SKIN_PAIR_PRICE,
            gate,
        };
    }),
    ...Array.from({ length: RACER_FLAGS }, (_, i) => ({
        id: `set:flag:${i}`,
        name: racerName(i + 1),
        ids: [`flag:${i}`],
        group: 'flag',
        price: SKIN_FLAG_PRICE,
        gate: SKIN_FLAG_GATE,
    })),
];
