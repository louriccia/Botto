// Botto's Chance Cube, as played in a Discord embed.
//
// **The rules are not in this file any more.** They live in `src/game/cube/`, which knows nothing
// about Discord, so the same engine can drive the embed and the Activity. What is left here is the
// screen: embeds, buttons, the reveal, and the thin layer that turns the engine's abstract face
// ids and structured notes into emoji and prose.
//
//   src/game/cube/tuning.js    the numbers and the faces
//   src/game/cube/engine.js    throwing, resolving, the daily lean
//   src/game/cube/state.js     the player's standing and lifetime record
//   src/game/cube/persist.js   the live run and the profile write
//
// State layout (live state is listened to by firebase.js, so it mirrors into memory):
//   challenge/cube/live/ladders/<discordId>   one live run per player
//   users/<key>/random/cube                   the player's standing
//
// See docs/chance-cube.md for the design.

const moment = require('moment');
require('moment-timezone');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { number_with_commas } = require('../../generic.js');
const { ChanceCube, WhyNobodyBuy, emojimap, level_symbols } = require('../../data/discord/emoji.js');
const { newrecord, DyeGon, RIPratts, wipeout, Whatto, SlyGon } = emojimap;
const { faceGlyph, SPECIAL_EMOJI } = require('../../data/discord/cube_emoji.js');
// `chip` is deliberately not taken from here — the view half below declares its own, identical
// one, and both go away together when the embed retires.
const { renderNote, renderNotes } = require('../../data/discord/cube_notes.js');

const engine = require('../../game/cube/engine.js');
const pstate = require('../../game/cube/state.js');
const persist = require('../../game/cube/persist.js');

// How many cubes a climb can actually draw. Six places on the rack and start screens quote it, and
// every one of them was reading a name that was never brought into scope — so `loadoutEmbed` and the
// rack half of the start screen threw a ReferenceError on the first render. Pulled off the engine
// rather than recomputed, because it is a property of the ladder and not a number to keep in step.
const { bagSize } = engine;

// Buying a tie off Watto. Not a cube, so it gets a gesture rather than a face.
const BRIBE = '🤝';
// Grandmaster — the top of the rank ladder, which is exactly what a prestige is.
const PRESTIGE = level_symbols[level_symbols.length - 1];
// The dressed tuning: the same data the engine uses, with emoji re-attached for drawing.
const {
    SIDES, FACES, SPECIALS, LEVELS, WATTO, CUBE_GAP, cube: config,
} = require('../../data/challenge/cube.js');

const COLOR = '#F0B232';
const OTHER = { blue: 'red', red: 'blue' };
const tg = v => number_with_commas(Math.round(Number(v) || 0));

const MAX_LEVEL = LEVELS.length - 1;
exports.MAX_LEVEL = MAX_LEVEL;
// Named once, from the data, so copy about the top of the ladder survives a rename.
const TOP_NAME = LEVELS[MAX_LEVEL].name;

// The **dressed** special, with its icon and its faces' emoji on it — what the rack and the
// prestige menu draw from. The engine has its own, undressed, for resolving a line; the two
// return the same cube and only one of them can be rendered.
const specialById = id => (id ? SPECIALS.find(sp => sp.id === id) || null : null);
exports.specialById = specialById;

// ---------------------------------------------------------------------------
// Straight through
// ---------------------------------------------------------------------------

// Everything the engine, the state and the persistence layer export, re-exported unchanged so the
// handlers keep one import. When the embed retires these go and `src/interactions/cube.js` reads
// `game/cube/` directly.
//
// **This runs before the wrappers below, and has to.** Four of these names are re-declared down
// there in a Discord-shaped form, and a bulk copy afterwards would quietly overwrite them with the
// raw engine versions — which it did, and the parity harness could not see it, because the harness
// compares the engine against the frozen original and never goes through this file at all.
const { specialById: _engineSpecialById, ...engineRest } = engine;
for (const [k, v] of Object.entries(engineRest)) exports[k] = v;
for (const [k, v] of Object.entries(pstate)) exports[k] = v;
for (const [k, v] of Object.entries(persist)) exports[k] = v;

// Re-bound locally, because the view half calls them by name rather than off `exports`.
const {
    maxStakeFor, rerollCostFor, bribeCostFor, bribeShareFor, gapSize, goalOf, canPrestige, topOf,
    routeOf, nextRung,
} = pstate;
const { bankPayout, nextMultiple, faceKey } = engine;

// ---------------------------------------------------------------------------
// The engine, wearing Discord's clothes
// ---------------------------------------------------------------------------
//
// The engine reports faces as ids (`greed`, `mult:blue`) and notes as data. The embed was written
// against emoji strings and finished prose, and it still is — so these wrappers dress the
// engine's output on the way out and nothing downstream had to change. They deliberately shadow
// the bulk re-export above.
//
// They are the whole of what retiring the embed will delete.

// One position, as an emoji.
const faceEmoji = cube => faceGlyph(engine.faceIdOf(cube));
exports.faceEmoji = faceEmoji;

// The line as thrown, before anything resolved.
exports.rolledFaces = line => engine.rolledFaces(line).map(faceGlyph);

// A resolved line, with `faces`, `notes` and each step's `faces`/`note` in the shape the embed
// reads. Everything else — the sides, the payout, the set carried forward — passes through
// untouched, because none of it was ever presentational.
exports.resolveLine = function (line, call) {
    const res = engine.resolveLine(line, call);
    return {
        ...res,
        faces: res.faceIds.map(faceGlyph),
        notes: renderNotes(res.notes),
        steps: res.steps.map(s => ({
            faces: s.faceIds.map(faceGlyph),
            note: renderNote(s.note),
            at: s.at,
        })),
    };
};

// Phase two of the reveal, with its notes written out.
exports.multSteps = (start, pays, side) => engine.multSteps(start, pays, side)
    .map(s => ({ ...s, note: renderNote(s.note) }));

// The prestige menu, as select-menu options. The engine returns plain choices; the icons are
// Discord's business and are attached here.
const REWARD_EMOJI = { reroll: emojimap.restart, nudge: SlyGon, bribe: BRIBE };
const rewardChoices = s => pstate.rewardChoices(s).map(c => ({
    value: c.value,
    label: c.label,
    description: c.description,
    emoji: c.kind === 'cube' ? SPECIAL_EMOJI[c.id] : REWARD_EMOJI[c.kind],
}));
exports.rewardChoices = rewardChoices;

// ---------------------------------------------------------------------------
// Lines that say what happened
// ---------------------------------------------------------------------------

// The one line that says plainly what just happened to the player's truguts.
exports.wonLine = function (amount, unlockedIdx, record) {
    const level = unlockedIdx != null ? LEVELS[unlockedIdx] : null;
    return `**Congrats!** You won **${tg(amount)}** truguts`
        + (level ? ` and unlocked **Level ${unlockedIdx + 1} · ${level.name}**` : '')
        + '!' + badge(record);
};

exports.lostLine = (stake, standing) =>
    `**Sorry!** You lost **${tg(stake)}** truguts`
    + (standing ? ` and a **${tg(standing)}** standing` : '')
    + '.';

// ---------------------------------------------------------------------------
// Reveal pacing
// ---------------------------------------------------------------------------

// How many cubes each reveal frame shows. Big rolls come out a few at a time like a slot
// machine — but only up to the cube that settles it. Once the majority is certain there is
// no tension left to milk, so everything still face-down lands at once.
//
// Capped at `maxRevealFrames` steps because each one is a message edit, and nine cubes
// revealed one at a time would spend the whole rate limit on a single roll. That cap belongs to
// this client and no other — the engine emits every step it took.
exports.revealSteps = function (n, settled) {
    if (n <= 1) return [n];
    const stops = [];
    const step = Math.max(1, Math.ceil(settled / config.maxRevealFrames));
    for (let shown = step; shown < settled; shown += step) stops.push(shown);
    stops.push(settled);
    if (settled < n) stops.push(n);
    return stops;
};


// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const chip = side => `${FACES[side]} ${SIDES[side]}`;
exports.chip = chip;

// The cubes on the table: the first `shown` face-up, the rest still tumbling. Spaced out
// and alone on their own line, because embeds don't render `#` headings and there is no
// other way to draw them any larger.
//
// Takes emoji, not sides, because a rolled line shows special cubes as the face they landed
// on, and a resolved line redraws them after the effects — see `rolledFaces` and `faceEmoji`.
// With `maxCubes` uncapped a row has no length the game will stop it reaching, and an embed
// description very much does: discord.js **throws** past 4,096 rather than trimming, and a custom
// emoji costs about thirty characters however small it looks. So the row is budgeted here, at the
// one place every frame draws through — a run whose table got away from it should read as a triumph,
// not as a crash.
//
// Draw as many as fit, then say how many are missing. The budget leaves room for everything else on
// the frame: header, called side, Watto's line, the payout.
const LINE_BUDGET = 2600;
const fit = function (list, sep) {
    const gapAt = sep || (() => CUBE_GAP);
    let len = 0;
    let out = '';
    for (let i = 0; i < list.length; i++) {
        const piece = (i ? gapAt(i) : '') + list[i];
        // Leave room for the `+N` that replaces what doesn't fit.
        if (len + piece.length > LINE_BUDGET - 12) {
            return `${out}${CUBE_GAP}**+${list.length - i}**`;
        }
        out += piece;
        len += piece.length;
    }
    return out;
};

// The cubes on the table: the first `shown` face-up, the rest still tumbling. Spaced out
// and alone on their own line, because embeds don't render `#` headings and there is no
// other way to draw them any larger.
//
// Takes emoji, not sides, because a rolled line shows special cubes as the face they landed
// on, and a resolved line redraws them after the effects — see `rolledFaces` and `faceEmoji`.
const faces = (emoji, shown) => fit(emoji.map((e, i) => (i < shown ? e : ChanceCube)));
exports.faces = faces;

// The same row, with a pointer at the cube currently resolving.
//
// It goes in the **gap before** the cube rather than under it. Emoji can't be underlined, and their
// widths line up with nothing else — any marker on a second row would drift further out of true the
// longer the line got, and be worst exactly where it matters most. A glyph in the separator is
// unambiguous at any length, and small enough beside an emoji that it never reads as a cube.
// Both sides, pointing inward, so the cube is bracketed rather than merely preceded — a single
// leading arrow is ambiguous about whether it belongs to the cube before it or the one after.
//
// Deliberately `▸◂` and not `▶◀`: the filled-triangle pair has emoji presentation on most platforms
// and would render cube-sized, which would break the one-glyph-per-position reading the whole row
// depends on. These two are text-only and stay small beside an emoji.
// The arrows **take the place of the gaps** rather than sitting inside them, so nothing on the row
// moves when the pointer appears — the cubes stay exactly where they were on the frame before, and
// only the two separators either side of the acting cube change character. A marker that shunted
// the row along would be a marker you had to re-find every frame.
// **Single angle quotes, and the width is the whole point.** They replace the two gaps either side
// of the acting cube rather than squeezing in beside them, so the row does not grow, and because
// they are punctuation — roughly a space wide — swapping a gap for one barely moves anything. The
// cubes stay where they were on the previous frame and only two separators change character.
//
// `▸◂` was tried first and is too heavy: Geometric Shapes glyphs run about twice the width of a
// space, so the marked cube visibly shouldered its neighbours apart every time the pointer moved.
//
// A pointer on a **line underneath** was also tried and abandoned. Aligning under emoji needs a
// spacer exactly as wide as one, and no text character is: U+3000, the widest invisible option,
// still drifted — and drift accumulates rightward, so it was worst on the long lines where the
// pointer matters most. It could only be made exact with a transparent custom emoji uploaded to the
// guild, which is a real option if this ever needs revisiting, but it is not worth an upload when a
// glyph in the gap cannot be wrong at any length.
const MARK_L = '›';
const MARK_R = '‹';
const facesMarked = (emoji, at) => fit(
    emoji.map((e, i) => (i === at ? `${MARK_L}${e}${MARK_R}` : e)),
    // The gap before the marked cube is carried by `›`, and the gap after it by `‹`, so neither is
    // drawn again. At either end of the row there is no gap to take over and the mark simply sits
    // outside the line, which costs nothing because there is nothing beyond it to push.
    i => ((i === at || i === at + 1) ? '' : CUBE_GAP),
);
exports.facesMarked = facesMarked;

// Sides in, plain faces out — the fallback for a run persisted before cubes stored their own
// rendered faces.
const sideFaces = sides => (sides || []).map(side => FACES[side] || ChanceCube);
exports.sideFaces = sideFaces;

// Watto's tie-breaker, set apart from the line by a **visible mark**, not by spacing. It is not one
// of the level's cubes — it's his, it came out of his pocket after the line failed to decide, and
// it must never read as the roll having grown a cube.
//
// The dot carries that on its own precisely because spacing turned out to be the thing that
// couldn't: a separator that has to survive being glanced at gets a character. The gaps either side
// of it are only breathing room, so they stay in step with the gap between cubes rather than
// competing with it.
const BREAKER_GAP = `${CUBE_GAP}${CUBE_GAP}`;
const withBreaker = (line, side) => `${line}${BREAKER_GAP}·${BREAKER_GAP}${side ? FACES[side] : ChanceCube}`;
exports.withBreaker = withBreaker;

// What the tie-breaker is weighted at, said out loud. This is the only number in the game that is
// quietly against the player, so it doesn't get to stay quiet — and Qui-Gon's Nudge would be
// invisible otherwise, since all it does is turn the same weight around.
const tieOddsLine = function (s) {
    const pct = Math.round(config.tieLean * 100);
    return s.nudge
        ? `${SlyGon} **Qui-Gon's Nudge** — his cube leans **${pct}/${100 - pct}** *your* way.`
        : `${Whatto} His cube is weighted **${pct}/${100 - pct}** against you.`;
};
exports.tieOddsLine = tieOddsLine;

// ---------------------------------------------------------------------------
// The route map
// ---------------------------------------------------------------------------
//
// The whole road from the first cube to the prestige, drawn as one line: the five levels, and
// between them the **Agains** still standing in each gap. Survive an Again and it fills in for
// good, so this is a progress bar that a player watches get shorter over a whole prestige rather
// than a counter that resets at every level.
//
// **The tiles are plain unicode and the levels are custom emoji**, which is the split that makes it
// fit. The old meter drew one custom emoji per clear and capped the requirement at five to stop it
// wrapping on a phone; a text tile is a fraction of the width, so twenty of them sit on one line
// and the cap went back to being about pacing.
//
// Cleared Agains are **kept and filled in**, never dropped. The run skips them — that is the whole
// reward — but a map that deleted them would shorten mysteriously instead of visibly, and the
// visible part is the point.
const ROUTE_TILE = { done: '▰', current: '▨', ahead: '▱', failed: '✖' };

// `current` marks the Again being attempted right now and is off on an end screen, where nothing
// is live. `failed` marks the one just lost, so a bust on an Again leaves a mark on the road rather
// than quietly reverting to a blank tile — the progress itself is untouched either way, because a
// failed Again costs the run and not the ground already covered.
const routeLine = function (s, { current = false, failed = false } = {}) {
    const { rungs } = routeOf(s);
    const out = [];
    let tiles = '';
    // The first uncleared Again in route order *is* the frontier — gaps fill strictly in order — so
    // this needs no arithmetic beyond "have I marked one yet".
    let marked = false;
    for (const r of rungs) {
        if (r.kind === 'level') {
            if (tiles) out.push(tiles);
            tiles = '';
            out.push(LEVELS[r.level].emoji);
        } else if (r.cleared) {
            tiles += ROUTE_TILE.done;
        } else if (!marked) {
            marked = true;
            tiles += failed ? ROUTE_TILE.failed : current ? ROUTE_TILE.current : ROUTE_TILE.ahead;
        } else {
            tiles += ROUTE_TILE.ahead;
        }
    }
    if (tiles) out.push(tiles);
    return out.join(' ');
};
exports.routeLine = routeLine;

// The map plus what is at the end of it. Whether it shows at all is the frame's call, see
// `playEmbed` — but unlike the meter it replaced, the answer is nearly always yes: the road is
// relevant on every rung, not only on the one that pays.
const progressLine = function (s, current, failed) {
    // The padlock springs open on exactly one screen: the results frame whose Again earned the
    // prestige, which is passed a state with `clears` at the goal. Every other frame is looking at
    // something still shut.
    const ready = canPrestige(s);
    return `${routeLine(s, { current, failed })} →`
        + ` ${ready ? '🔓' : '🔒'} ${PRESTIGE} **Prestige ${s.prestige + 1}**`;
};
exports.progressLine = progressLine;

// A level opened by a gap filling on a run that is *still standing* — which is now every one of
// them, since nothing force-banks. The choice line underneath is the offer to take the standing
// straight into it, which is the whole point.
exports.openedLine = idx =>
    `🔓 ${LEVELS[idx].emoji} **Level ${idx + 1} · ${LEVELS[idx].name}** is open — two more cubes, and you're still standing.`;

// What is left of the road, for the end screen. At the top of the route the prize is the prestige
// rather than another level.
exports.nextUnlockLine = function (s) {
    if (canPrestige(s)) {
        return `${PRESTIGE} **Prestige ${s.prestige + 1} is ready** — start the road over for a **${tg(maxStakeFor(s.prestige + 1))}** max stake and a **Build Token** to spend off Watto's rack.`;
    }
    const next = LEVELS[s.unlocked + 1];
    if (next) {
        const left = Math.max(0, gapSize(s) - s.clears);
        return `**${left}** more ${left === 1 ? 'Again' : 'Agains'} and ${next.emoji} **Level ${s.unlocked + 2} · ${next.name}** opens — **${next.cubes} cubes** on the table.`;
    }
    return `${PRESTIGE} Survive **${TOP_NAME}** to earn **Prestige ${s.prestige + 1}** — ${config.maxStakeStep}× stakes and a **Build Token**.`;
};

// Points banked and not yet spent. Its own line rather than a clause on the prestige one, because
// the two stopped being the same event: a point is earned at the top of the ladder and spent on the
// rack whenever the player gets round to it.
exports.pointsLine = s => (s.points > 0
    ? `${PRESTIGE} **${s.points} Build Token${s.points === 1 ? '' : 's'}** unspent — open the rack to cash ${s.points === 1 ? 'it' : 'them'} in.`
    : null);

// Badged the same way records are badged everywhere else in the bot — appended to the value
// that broke, not announced on a line of its own.
const badge = record => (record ? ` ${newrecord}` : '');

// `cubes` is how many are actually on the table, which is only the level's nominal count while the
// run is undamaged — a cull, a raze, a burn or a bind leaves it short, and a Mirror, a Fodé or a
// Padmé leaves it long.
//
// It shows **that number and nothing else.** It used to read `5 of 7 cubes` whenever the two
// disagreed, which was written when the only thing that could move the count was damage — the
// level's own number was the thing you had lost against. Then the line started growing as often as
// it shrinks, and `7 of 5 cubes` reads as an arithmetic error rather than as a windfall. There is
// no framing that works in both directions, and the count on the table is the only one the roll is
// actually played with.
const levelHeader = function (levelIdx, frame) {
    const { record, cubes, cubeRecord, multiple, multRecord, again } = frame || {};
    const level = LEVELS[levelIdx];
    const n = Number.isFinite(cubes) ? cubes : level.cubes;
    const count = `${n} cube${n === 1 ? '' : 's'}`;
    // The cube-count record is badged on the count itself, the way every other record is badged on
    // the value that broke it. Only ever passed on a paying frame: the count is known the moment the
    // line resolves, but the *player* doesn't know it until the effects have played out, and a badge
    // during the reveal would give away that something grew the line.
    // The multiple shown is the run's, not the level's. They are the same until a paying cube lands;
    // after that the level's own number is no longer what the roll pays, and showing it would be a
    // lie sitting directly above the cubes that made it false. Boosted, it wears bold.
    //
    // Its own record badges here, on the same terms as the count beside it: paying frame only. The
    // multiple is finished the moment the line resolves, but the player watches it build across
    // phase two, and a badge sitting on it from the first frame would announce the ending.
    const base = level.payout;
    const m = Number.isFinite(multiple) && multiple > 0 ? multiple : base;
    const paid = m === base ? `${base}×` : `**${Number(m.toFixed(2))}×**`;
    // Every badge sits on the value it belongs to — the level record on the level, the count record
    // on the count, the multiple record on the multiple. The first of those used to be parked at the
    // end of the line, which read fine while it was the only thing that could be there.
    // An **Again** is the same level thrown again for nothing but the right to move on, so it wears
    // the level's own name and says which time round this is. Past Level 5 that counter is the only
    // thing that changes from rung to rung, which is exactly the point of it being there.
    return `${level.emoji} **Level ${levelIdx + 1} · ${level.name}**${badge(record)}`
        + (again ? ` · ${emojimap.restart} **Again ×${again}**` : '')
        + ` · ${count}${badge(cubeRecord)}`
        + ` · ${paid}${badge(multRecord)}`;
};
exports.levelHeader = levelHeader;

// Watto calls the roll. Cosmetic, so Math.random is fine here.
exports.watto = kind => {
    const lines = WATTO[kind] || [];
    return lines.length ? `*"${lines[Math.floor(Math.random() * lines.length)]}"*` : null;
};

// The whole bank-or-push decision as one line: the two numbers, side by side. `multiple` is the
// run's live payout multiple, so a Greed or Multiplier cube shows up in both figures rather than
// surprising the player at the bank.
//
// **There is always a push.** `next` is the rung the route offers — the rest of this gap, the level
// it opens, or an Again past the top — and the second figure is what that rung takes the multiple
// to, so the offer on screen is the number the roll will actually play for.
//
// The three rungs read differently on purpose, because they are worth wildly different things. A
// level doubles. An Again below the top adds one *and* comes off the road for good, which is the
// only reason to take a bet that poor. An Again past the top adds one and buys nothing at all, so
// it gets no pitch — the number is the whole argument, and it is not a good one.
const choiceLine = function (stake, record, multiple, next) {
    const standing = bankPayout(stake, multiple);
    const bank = `Bank **${tg(standing)}**${badge(record)}`;
    if (!next) return bank;
    // The settlement sends the figure; a stored run without one falls back to deriving it. Only
    // `rungMultiple` knows all three ways a rung can pay, and a second implementation here is how
    // the two start disagreeing about what the next roll is worth.
    const pushed = tg(bankPayout(stake, next.multiple || nextMultiple(next.kind, multiple)));
    if (next.kind === 'level') return `${bank} or push for **${pushed}**`;
    if (next.kind === 'overtime') return `${bank} or roll again for **${pushed}** — nothing left to clear up here`;
    return `${bank} or take the ${emojimap.restart} **Again** for **${pushed}** — clear it and it's off your road for good`;
};
exports.choiceLine = choiceLine;

exports.errorEmbed = (title, desc) => new EmbedBuilder()
    .setTitle(`${WhyNobodyBuy} ${title}`)
    .setDescription(desc)
    .setColor('#ED4245');

// Lifetime record and per-side rates, for the start screen only — mid-roll they would just
// be noise around the cubes. Percentages are of this player's own history, so someone who
// has never rolled gets nothing at all rather than a wall of dashes.
const statsFields = function (s) {
    const calls = s.calls.blue + s.calls.red;
    if (!calls) return [];
    const rolled = s.rolled.blue + s.rolled.red;
    const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
    const rates = side => `${FACES[side]} picked **${pct(s.calls[side], calls)}**`
        + ` · won **${pct(s.wins[side], s.calls[side])}**`
        + ` · rolled **${pct(s.rolled[side], rolled)}**`;

    return [
        {
            name: 'Your record',
            // Once you've prestiged, "deepest level" stops saying anything — you've been to the
            // top of the ladder and handed it back, so a Level 2 on the current climb would read
            // as a downgrade. The prestige takes its place as the mark of how far you've got, and
            // brings the stake ceiling it bought along with it.
            value: (s.prestige > 0
                ? `${PRESTIGE} Prestige **${s.prestige}** · max stake **${tg(s.maxStake)}**`
                : `${LEVELS[s.bestLevel].emoji} Deepest **Level ${s.bestLevel + 1} · ${LEVELS[s.bestLevel].name}**`)
                + `\n💰 Best standing **${tg(s.bestStanding)}**`
                + (s.bestCubes ? `\n${ChanceCube} Biggest roll **${s.bestCubes}** cubes` : '')
                // Only worth a line once a paying face has actually moved it. Without a rack the
                // multiple is just the deepest level's own payout restated, and the line above
                // already says how deep they got.
                + (s.bestMultiple > LEVELS[s.bestLevel].payout
                    ? `\n✖️ Biggest multiple **${Number(s.bestMultiple.toFixed(2))}×**`
                    : '')
                // A live streak belongs on the screen you see right before calling again. The
                // badge marks a streak that *is* the record — a true statement about now,
                // rather than a moment flag that would linger on the board.
                + `\n🔥 ${s.streak ? `On **${s.streak}** in a row · best ` : 'Best streak '}**${s.bestStreak}**`
                + badge(s.streak > 0 && s.streak === s.bestStreak)
                + `\n📈 Won **${tg(s.totalWon)}**  ·  📉 Lost **${tg(s.totalLost)}**`
                // Rerolls and bought ties, on the end of the ledger line rather than a line of
                // their own — and only for a player who has bought either, which is nobody until
                // a prestige hands over the right to.
                + (s.totalSpent ? `  ·  🧾 Spent **${tg(s.totalSpent)}**` : ''),
        },
        {
            name: `${SIDES.blue} vs ${SIDES.red}`,
            value: `${rates('blue')}\n${rates('red')}\n-# *${calls} calls · ${rolled} cubes rolled*`,
        },
    ];
};
exports.statsFields = statsFields;

// The rack: what's equipped, what's on the bench, and any rerolls in stock. Only on the start
// screen, and only for a player who has something to show — everything here is won at prestige,
// so most of the ladder never sees this field at all.
const loadoutFields = function (s) {
    const bench = s.cubes.filter(id => !s.equipped.includes(id));
    const line = ids => ids.map(id => specialById(id)).filter(Boolean)
        .map(sp => `${sp.emoji} ${sp.name}`).join(' · ');
    const fields = [];

    if (s.cubes.length || s.rerolls || s.buyReroll || s.points > 0) {
        fields.push({
            // **Seats used, out of seats.** The cap is `bagSize()` for every rack, so the denominator
            // is the same number on every screen and it is the number a run actually draws — a player
            // reading `8/8` knows both that the rack is full and that all eight will turn up.
            name: `Your rack · ${s.equipped.length}/${bagSize()} on the table`,
            value: [
                // Above the rack itself, because an unspent point is the one thing on this field
                // that is waiting on the player rather than just reporting to them.
                s.points > 0
                    ? `${PRESTIGE} **${s.points} Build Token${s.points === 1 ? '' : 's'}** to spend on the rack`
                    : null,
                s.equipped.length
                    ? line(s.equipped)
                    : `*No special cubes on the table — ${s.cubes.length ? 'load some up' : 'win one at prestige'}.*`,
                // Said here rather than only on the rack screen, because this is the field a player
                // reads in the second before they call — and a full rack with cubes still on the bench
                // is the moment "why isn't that one playing" gets asked.
                bench.length && s.equipped.length >= bagSize()
                    ? `-# *The bag is full — swap one out to field another.*`
                    : null,
                bench.length ? `-# *On the bench: ${line(bench)}*` : null,
                s.rerolls || s.buyReroll
                    ? `${emojimap.restart} Rerolls banked **${s.rerolls}**`
                    + (s.buyReroll ? ` · next costs ${tg(s.rerollCost)}` : '')
                    : null,
            ].filter(Boolean).join('\n'),
        });
    }

    // The tie picks get a field of their own rather than a line in the rack, because the rack is a
    // list of **things you field** and neither of these is a cube or can be equipped at all.
    // Listed at all for the same reason the bench is: they cost a prestige each and only fire on
    // a roll most climbs never see, so owning one should never be something you have to remember.
    if (s.nudge || s.bribe) {
        fields.push({
            name: 'On a tie',
            value: [
                s.nudge
                    ? `${SlyGon} **Qui-Gon's Nudge** — his tie-breaker leans **${Math.round(config.tieLean * 100)}/${Math.round((1 - config.tieLean) * 100)}** your way`
                    : null,
                s.bribe
                    ? `${BRIBE} **Bribe ties** — next one costs **${Math.round(bribeShareFor(s.nudge) * (config.bribeStep ** s.bribes) * 100)}%** of the standing`
                    : null,
            ].filter(Boolean).join('\n'),
        });
    }

    return fields;
};
exports.loadoutFields = loadoutFields;

// The markdown a row of `n` cubes is drawn at. It steps down through four sizes as the row grows —
// `#`, `##`, ordinary text, `-#` — because the cubes getting smaller costs far less than the row
// folding in half, which is what actually stops you counting it. Thresholds live in the tuning data.
const rollSize = function (n) {
    if (n >= config.subtextAt) return '-# ';
    if (n >= config.plainAt) return '';
    if (n >= config.h2At) return '## ';
    return '# ';
};
exports.rollSize = rollSize;

// Run over, one way or the other — the embed turns red or green and the buttons collapse
// to a single "Play again", so there is no ambiguity about whether anything is still live.
const OUTCOME_COLOR = { bust: '#ED4245', bank: '#57F287' };

// The one embed the game lives in. `frame` is the current beat of the run and is the same
// shape whether the cubes are still tumbling, just landed, or already paid out:
//   { levelIdx, context, faces, flavor, lines, outcome }
// `flavor` is Watto's line and gets its own block — he talks first, then the numbers.
// The balance sits in the footer so the body is nothing but the roll. It had the Pure Cube pot
// beside it until the pot came out; one reference number is still a footer's worth of work.
exports.playEmbed = function ({ balance, s, frame }) {
    const levelIdx = frame ? frame.levelIdx : 0;
    // Each frame carries the progress state it should draw, and that is load-bearing rather than
    // tidy: settlement runs during the first beat of the reveal, so a frame drawn while the cubes
    // are still face-down is holding a **pre-roll snapshot** — reading `s` live here would fill in
    // the Again a second before the cubes said whether it had been survived.
    //
    // The map shows on every frame, unlike the meter it replaced. The road is relevant on every
    // rung rather than only on the one that pays, and watching a tile fill in is the reward.
    const barState = frame ? frame.bar : s;
    // The "attempting this one" tile comes off as soon as the run has an outcome; a bust marks the
    // Again it died on instead, so the road carries the scar rather than going blank.
    const bar = barState
        ? progressLine(barState, !frame?.outcome, frame?.outcome === 'bust')
        : null;
    const body = [
        [levelHeader(levelIdx, frame), bar]
            .filter(Boolean).join('\n'),
        // The called side sits directly on top of the cubes it applies to, no gap. `# `
        // renders them at heading size — markdown headings work in an embed *description*
        // but not in a field value, which is why this looked broken while the roll still
        // lived in a field.
        //
        // Long lines step down out of the heading, because nine heading-sized emoji wrap on a
        // phone and a wrapped row of cubes is much harder to count than a smaller one.
        frame ? `${frame.context}\n${rollSize(frame.cubes ?? LEVELS[levelIdx].cubes)}${frame.faces}` : null,
        // Watto gets his own block so his line reads as dialogue rather than as the first
        // bullet of the payout.
        frame?.flavor || null,
        frame ? frame.lines.filter(Boolean).join('\n') : 'Call a side to roll.',
    ];

    const embed = new EmbedBuilder()
        .setTitle(`${ChanceCube} Chuba Cubes`)
        .setColor(OUTCOME_COLOR[frame?.outcome] || COLOR)
        // Blank lines between the header, the cubes and the result, so each beat of the
        // roll reads as its own block.
        .setDescription(body.filter(Boolean).join('\n\n'))
        // Footers are plain text — unicode emoji only, no markup, no custom emoji.
        .setFooter({ text: `📀 ${tg(balance)}` });

    // Only the start screen carries the record and the rack; every other frame is about this
    // roll.
    if (!frame) embed.addFields(...statsFields(s), ...loadoutFields(s));
    return embed;
};

// Two rows, and nothing in either that can't be pressed. The top row is the roll — call, bank,
// help — and the bottom row is everything you set up *before* one: the stake, the rack, rerolls,
// prestige. The bottom row disappears entirely mid-run and on an end screen, because all of it
// is locked for the duration of a run and none of it is about a result.
//
// It was one row until the rack arrived, and a rack button plus a reroll button would have put
// seven things in it against a limit of five.
exports.playComponents = function ({ turn, ladder, stake, s, ended, owner, dead }) {
    const live = !!ladder;
    const row = [];
    const setup = [];

    if (ended) {
        // Run over. "Play again" is always first and always the primary, so the button under the
        // reflex click is the one that costs nothing and does the expected thing. A reroll spends
        // something the player bought, and a spend should never be the button muscle memory hits
        // — it sits second and quieter, chosen deliberately or not at all.
        row.push(new ButtonBuilder()
            .setCustomId(`cube_play_${owner}`)
            .setLabel('Play again')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Primary));

        // Offered here and nowhere else, so walking away from this screen is how you decline it.
        if (dead && s.rerolls > 0) {
            row.push(new ButtonBuilder()
                .setCustomId(`cube_reroll_${turn}_${owner}`)
                .setLabel(`Reroll ×${s.rerolls}`)
                .setEmoji(emojimap.restart)
                .setStyle(ButtonStyle.Secondary));
        }
    } else {
        // Calling again while standing means pushing, and **there is always something to push
        // into** — the rest of the gap, the level it opens, or an Again past the top. These two
        // used to disappear at the ceiling, which was the moment the game stopped being a game and
        // started being a receipt.
        row.push(
            new ButtonBuilder()
                .setCustomId(`cube_call_blue_${turn}_${owner}`)
                .setLabel(SIDES.blue)
                .setEmoji(FACES.blue)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cube_call_red_${turn}_${owner}`)
                .setLabel(SIDES.red)
                .setEmoji(FACES.red)
                .setStyle(ButtonStyle.Danger),
        );
        if (live) {
            row.push(new ButtonBuilder()
                .setCustomId(`cube_bank_${turn}_${owner}`)
                .setLabel(`Bank ${tg(ladder.standing)}`)
                .setEmoji('💰')
                .setStyle(ButtonStyle.Success));
        }
    }

    row.push(new ButtonBuilder()
        .setCustomId(`cube_help_${owner}`)
        .setLabel('?')
        .setStyle(ButtonStyle.Secondary));

    // Everything below is locked for the duration of a run, and an end screen is about the
    // result rather than the next wager, so the whole row only exists on the idle board.
    if (!live && !ended) {
        setup.push(new ButtonBuilder()
            .setCustomId(`cube_stake_${turn}_${owner}`)
            .setLabel(`Stake: ${tg(stake)}`)
            .setEmoji('📀')
            .setStyle(ButtonStyle.Secondary));

        // Nothing to load until a prestige has handed over a cube — but an unspent point has to be
        // able to reach the screen that spends it, even on an empty rack.
        if (s.cubes.length || s.points > 0) {
            setup.push(new ButtonBuilder()
                .setCustomId(`cube_loadout_${turn}_${owner}`)
                // `equipped/seats`, and the seats are `bagSize()`. The denominator that matters on a
                // button is the one that says whether there is room, not how many cubes have been won
                // — the rack screen behind it lists the bench.
                .setLabel(s.points > 0
                    ? `Rack: ${s.equipped.length}/${bagSize()} · ${s.points} pt`
                    : `Rack: ${s.equipped.length}/${bagSize()}`)
                .setEmoji(ChanceCube)
                .setStyle(s.points > 0 ? ButtonStyle.Success : ButtonStyle.Secondary));
        }

        // Every reroll already in stock makes the next dearer, so the label carries the price
        // rather than making the player press to find out.
        if (s.buyReroll) {
            setup.push(new ButtonBuilder()
                .setCustomId(`cube_buyreroll_${turn}_${owner}`)
                .setLabel(`Buy reroll ×${s.rerolls} · ${tg(s.rerollCost)}`)
                .setEmoji(emojimap.restart)
                .setStyle(ButtonStyle.Secondary));
        }

        // Offered once the top level has been cleared, never mid-run and never forced.
        if (canPrestige(s)) {
            setup.push(new ButtonBuilder()
                .setCustomId(`cube_prestige_${turn}_${owner}`)
                .setLabel(`Prestige ${s.prestige + 1}`)
                .setEmoji(PRESTIGE)
                .setStyle(ButtonStyle.Success));
        }
    }

    const rows = [new ActionRowBuilder().addComponents(...row)];
    if (setup.length) rows.push(new ActionRowBuilder().addComponents(...setup));
    return rows;
};

// The called side, the stake, and whatever the paying cubes have added to the level's multiple —
// context for the roll, so it rides with the header.
//
// The multiple deliberately isn't here any more — it lives in the header, which is where a player
// already looks for what a level pays, and two numbers for one thing on one screen is one too many.
//
// `result` is 'win' | 'bust' | null — the tick or the cross that says at a glance whether the
// call was right, on the one line that names the call. Absent while the cubes are still
// face-down, because that's the whole question the reveal is asking.
const contextLine = (call, stake, bonus = 0, result = null) => `-# *Called ${chip(call)} · ${tg(stake)} staked`
    + '*'
    + (result === 'win' ? ' ✅' : result === 'bust' ? ' ❌' : '');
exports.contextLine = contextLine;

// The cubes a stored run left on the table. `faces` is written from the resolved line; `roll`
// is the plain sides, which is all a run persisted before special cubes existed has.
const storedFaces = function (ladder) {
    // Stored as face ids since the engine split; `faceGlyph` passes older nodes' emoji through
    // unchanged, so a run that was already on the table keeps drawing.
    const shown = ladder.faces
        ? Object.values(ladder.faces).map(faceGlyph)
        : sideFaces(ladder.roll || []);
    return faces(shown, shown.length);
};
exports.storedFaces = storedFaces;

// How many cubes a stored run left on the table, for the header. Read off the rendered faces rather
// than the set, because the faces are what the frame is drawing and the two are the same length.
const storedCount = function (ladder) {
    return (ladder.faces ? Object.values(ladder.faces) : (ladder.roll || [])).length;
};
exports.storedCount = storedCount;

// What a run in progress looks like when you come back to it.
exports.liveFrame = function (ladder, s) {
    // A stored run carries the multiple it was won at. Runs saved before the multiple became run
    // state fall back to the level's own, which is what they were paying anyway.
    const mult = Number(ladder.mult) || LEVELS[ladder.level].payout;
    return {
        levelIdx: ladder.level,
        again: Number(ladder.again) || 0,
        bar: s,
        cubes: storedCount(ladder),
        multiple: mult,
        // A standing run is a call that came good, so the line it's resting on wears the tick.
        context: contextLine(ladder.call, ladder.stake, mult, 'win'),
        faces: storedFaces(ladder),
        lines: [choiceLine(ladder.stake, false, mult, nextRung(s, ladder.level))],
    };
};

// The game over screen, rebuilt from a dead run — what `/chubacubes` shows if the reroll offer is
// still standing when the player comes back to it.
//
// It carries the map, and marks the Again that killed it: a bust on the road is the one place the
// scar belongs, and a run that died on a level rung simply has nothing to mark.
exports.deadFrame = function (dead, s) {
    return {
        levelIdx: dead.level,
        again: Number(dead.again) || 0,
        bar: dead.again ? s : null,
        cubes: storedCount(dead),
        multiple: Number(dead.mult) || LEVELS[dead.level].payout,
        context: contextLine(dead.call, dead.stake, Number(dead.mult) || 0, 'bust'),
        faces: storedFaces(dead),
        flavor: dead.flavor || null,
        lines: Object.values(dead.lines || {}),
        outcome: 'bust',
    };
};

// What a tie would pay if it went your way — the standing the bribe is buying. Multipliers count
// here, because buying the tie makes your call the winning side, which is exactly what they're
// waiting on.
const tieStanding = function (pending) {
    const stored = Number(pending.mult) || LEVELS[pending.level].payout;
    return bankPayout(pending.stake, applyMults(stored, pending.mults, pending.call));
};
exports.tieStanding = tieStanding;

exports.tieCostOf = (pending, s) => bribeCostFor(tieStanding(pending), s.bribes, s.nudge);

// The tie screen. The line came back even, Watto's cube is face-down on the table, and the roll is
// parked until the player answers. Rebuilt entirely from the stored run, because it has to draw the
// same thing an hour later if they closed the channel and came back with `/chubacubes`.
//
// Nothing on it is settled yet, which is what makes that safe: `bestLevel` and the clears meter
// still read exactly as they did when the cubes left the cup.
exports.tieFrame = function (pending, s) {
    const cost = bribeCostFor(tieStanding(pending), s.bribes, s.nudge);
    return {
        levelIdx: pending.level,
        again: Number(pending.again) || 0,
        bar: s,
        record: pending.level > s.bestLevel,
        cubes: storedCount(pending),
        multiple: Number(pending.mult) || LEVELS[pending.level].payout,
        // No tick and no cross: the whole question is still open, which is the point of the screen.
        context: contextLine(pending.call, pending.stake, Number(pending.mult) || 0),
        faces: withBreaker(storedFaces(pending), null),
        flavor: pending.flavor || null,
        // A roll only ever parks for someone holding the pick, so the second line is all but
        // guaranteed — but the frame is rebuilt from stored state, and a frame that assumes
        // something about the player is a frame that can lie about it.
        lines: [tieOddsLine(s), s.bribe ? `${BRIBE} Or buy the tie off him for **${tg(cost)}**.` : null]
            .filter(Boolean),
    };
};

// One row, two answers and the help button. Rolling his cube is the **primary**, because it is the
// choice that costs nothing — the same rule that keeps `Play again` under the reflex click on a
// game over screen. A bribe spends truguts, so it never gets to be the button muscle memory hits.
exports.tieComponents = function (turn, cost, owner) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cube_tiebreak_${turn}_${owner}`)
            .setLabel("Roll Watto's cube")
            .setEmoji(ChanceCube)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`cube_bribe_${turn}_${owner}`)
            .setLabel(`Bribe ${tg(cost)}`)
            .setEmoji(BRIBE)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`cube_help_${owner}`)
            .setLabel('?')
            .setStyle(ButtonStyle.Secondary),
    )];
};

// The prestige offer. Destructive and optional, so it says plainly what it costs.
//
// It no longer asks what you want for it. A prestige pays a **point**, and the point is spent on the
// rack whenever you feel like spending it — so this screen has one question on it instead of
// fourteen, and taking a prestige never means deciding two things at once.
exports.prestigeEmbed = function (s) {
    const next = s.prestige + 1;
    return new EmbedBuilder()
        // Embed titles don't render custom emoji, so the grandmaster leads the body instead.
        .setTitle(`Prestige ${next}`)
        .setColor(COLOR)
        .setDescription([
            `${PRESTIGE} *"You cleared ${TOP_NAME}. So now we play for real money, eh?"*`,
            '',
            `Watto sweeps the table. **Level 2 through ${LEVELS.length} lock again** and the road fills back in with ${emojimap.restart} **Agains** — every one you cleared this time is back${gapSize({ prestige: next }) > gapSize(s) ? `, and there will be **${gapSize({ prestige: next })}** in each gap instead of ${gapSize(s)}` : ''}.`,
            '',
            // The peak is `32 + 30g`, and it is only ever reachable while the road is at full
            // length — every Again banked takes its compounded value off it for good. A player
            // handing back a collapsed road is being handed the one window where the big number
            // exists, so it is worth saying out loud on the screen where they choose to take it.
            `That is not only a cost. A full road is worth **${32 + (30 * gapSize({ prestige: next }))}×** to somebody who walks the whole of it in one run — every Again you clear takes that peak down, and a collapsed road tops out at **${LEVELS[MAX_LEVEL].payout}×**.`,
            '',
            `In exchange, every roll from here can carry ${config.maxStakeStep} times as much: max stake **${tg(maxStakeFor(next))}**, up from ${tg(s.maxStake)}.`,
            '',
            `And you bank a **Build Token**${s.points > 0 ? ` — you would have **${s.points + 1}**` : ''}. Spend it on the rack, whenever: a **special cube** that rolls itself into your line from here on, the right to **buy rerolls**, or a way to survive a **tie**. Tokens keep, so there is nothing to decide now.`,
        ].join('\n'));
};

exports.prestigeComponents = (turn, s, owner) => [
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cube_doprestige_${turn}_${owner}`)
            .setLabel(`Prestige ${s.prestige + 1}`)
            .setEmoji(PRESTIGE)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`cube_play_${owner}`)
            .setLabel('Not yet')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Secondary),
    ),
];

// A cube's lifetime record, one entry per distinct face, in the order the faces sit on the cube —
// so the line reads the way the cube is built and a player can see at a glance which half of a
// Mirror they keep getting.
//
// The two faces that cost something are named rather than left as a bare number, because "shattered
// 3" and "ended 3 runs" are the numbers anyone actually came to this screen for. A cube that has
// never been thrown gets no line at all, rather than a row of zeroes.
const faceStats = function (sp, faces) {
    const tally = (faces || {})[sp.id] || {};
    const total = Object.values(tally).reduce((n, v) => n + (Number(v) || 0), 0);
    if (!total) return null;

    // Distinct faces, first occurrence wins, so `5 × greed` collapses to one entry.
    const distinct = new Map();
    for (const f of sp.faces) if (!distinct.has(faceKey(f))) distinct.set(faceKey(f), f);

    const parts = [...distinct].map(([key, f]) => {
        const n = Number(tally[key]) || 0;
        const emoji = typeof f.emoji === 'string' ? f.emoji : (FACES[f.side] || ChanceCube);
        const label = key === 'end' ? ` ended` : key === 'broken' ? ` shattered` : '';
        return `${emoji} **${n}**${label}`;
    });
    return `-# **${total}** thrown · ${parts.join(' · ')}`;
};

// The rack. Everything owned, with what it does, and a multi-select with **no limit on it** — the
// select itself is the save, so there is no separate confirm.
// This page has no fixed size: it grows with every cube owned, and a custom emoji costs about
// twenty-five characters of the 4,096 allowed however small it looks. A full rack drawing six faces
// per cube plus lifetime tallies runs well past the limit, and discord.js **throws** on an
// over-long description rather than trimming — so the screen has to shed weight on its own.
//
// Three tiers, dropping the least valuable thing first. The blurbs go before the preamble because
// they are the most re-read; the preamble goes before any cube does. The last tier is a hard cut,
// which should be unreachable but means this can never throw in a player's face.
const EMBED_LIMIT = 4096;

exports.loadoutEmbed = function (s) {
    // Survives every tier, unlike the preamble: it is the only thing on this screen a player can
    // act on that isn't already in front of them, and a point they can't see is a point they forget
    // they have.
    const banked = s.points > 0 ? [
        `${PRESTIGE} **${s.points} Build Token${s.points === 1 ? '' : 's'}** to spend — pick from `
        + '**Unlock** below. A cube, the right to buy rerolls, or a tie pick.',
        // Said **before** the point is spent, not after. A cube bought with the table full is owned
        // and benched, which is the right outcome — fielding it would have to throw off a cube the
        // player chose — but finding that out by noticing a missing *on the table* is not being told.
        ...(s.equipped.length >= bagSize()
            ? [`-# *Your table is full at ${bagSize()}, so a cube bought now waits on the bench until you swap one out.*`]
            : []),
        '',
    ] : [];
    const page = ({ blurbs = true, intro = true, tallies = true } = {}) => banked.concat(intro ? [
            `${ChanceCube} *"You wanna put your own cubes in my game? ...Fine. But my bag only holds ${bagSize()}, eh?"*`,
            '',
            `A run **keeps the cubes it has thrown**. Level 1 opens with one plain cube, and every level after draws **${config.cubesPerLevel} more** out of a **bag** shuffled when the run started — a bag holding every cube on this rack, padded out with plain ones. Once one of yours comes out it **stays on the table** and throws again every level.`,
            '',
            `${ChanceCube} Nothing goes back in the bag, so the longer it hands you plain cubes the likelier the next pull is one of yours — and a cube you equipped is a cube you **will** meet before the top of the ladder. With one special in a bag of ${bagSize()}, the four pulls run **25% → 33% → 50% → certain**.`,
            '',
            // The promise above holds because the rack cannot outgrow the bag, so this says the cap
            // rather than the exception to it. Which cubes go in the eight is the whole decision the
            // screen below exists for.
            `${ChanceCube} The bag has **${bagSize()}** seats, so **${bagSize()}** is what a rack fields — everything else waits on the bench. Own more than that and choosing which eight go in is the decision; the **Pit Droid** is what pulls them out of the bag sooner.`,
            '',
            `Which cuts both ways. A ${'💰'} caught at Level 2 pays on every level above it — and a ${RIPratts} face it rolls three levels later still ends the run. Anything destroyed is destroyed **for the rest of the climb**, so the table only ever gets smaller.`,
            '',
            `${RIPratts} **Ratts ends the run** on the spot, whatever the rest of the line says. ${wipeout} **breaks the cube** — no effect, and it's off the table until the run ends. Both are on the cubes that pay best.`,
            '',
            // Deliberately no mention of the tie picks here. This screen is only ever about which
            // cubes go on the table, and neither of them is a cube — putting them on the one screen
            // with an equip menu on it is exactly how a one-time prestige perk gets mistaken for
            // something you field. They live on the help screen and in their own start-screen field.
            `${Whatto} A cube that **destroys** cubes can leave the line **even**, with no majority in it — which Watto settles with a weighted cube of his own. Press **?** for how that goes.`,
            '',
        ] : [
            `${ChanceCube} *"You wanna put your own cubes in my game? ...Fine. But my bag only holds ${bagSize()}, eh?"*`,
            '',
        ]).concat([
            s.cubes.length ? '' : '*Nothing on the rack yet.*',
            s.cubes.map(id => specialById(id)).filter(Boolean).map(sp => [
                // All six faces rather than the cube's one icon: the *shape* of a cube is what you
                // are choosing between on this screen, and four reds against one blue and a wipeout
                // says more about Shmi than her name does. The counts underneath say how it has
                // actually landed; this says how it is built.
                `${sp.faces.map(f => f.emoji).join(' ')} **${sp.name}**`
                + `${s.equipped.includes(sp.id) ? ' · *on the table*' : ''}`,
                blurbs ? `-# ${sp.blurb}` : null,
                tallies ? faceStats(sp, s.faces) : null,
            ].filter(Boolean).join('\n')).join('\n'),
        ]).join('\n');

    // **A fourth tier, because the Planet Octahedron made the hard cut reachable.**
    //
    // The measurement this screen shipped against was 4,079 characters for a full rack — seventeen
    // under the limit, with three tiers and a hard cut nothing was ever expected to reach. A fifteenth
    // cube wearing **eight** faces and eight tally entries costs more than seventeen characters, and
    // the worst case landed on 4,096 exactly: the cut fired and took the last cube off the bottom of
    // the screen without saying so.
    //
    // So the tallies go before the cut does. They are the most valuable thing left on the page by
    // then — "ended 3 runs" is the number people open this screen for — but a cube silently missing is
    // strictly worse than a cube without its history, and the equip menu below still lists it either
    // way. The hard cut goes back to being unreachable, which is the only state it is any use in.
    const tiers = [
        page(),
        page({ blurbs: false }),
        page({ blurbs: false, intro: false }),
        page({ blurbs: false, intro: false, tallies: false }),
    ];
    const body = tiers.find(t => t.length <= EMBED_LIMIT) ?? tiers[tiers.length - 1].slice(0, EMBED_LIMIT);

    return new EmbedBuilder()
        .setTitle('Your rack')
        .setColor(COLOR)
        .setDescription(body);
};

exports.loadoutComponents = function (turn, s, owner) {
    const options = s.cubes.map(id => specialById(id)).filter(Boolean).map(sp => ({
        label: sp.name,
        value: sp.id,
        emoji: sp.emoji,
        description: sp.blurb.slice(0, 100),
        default: s.equipped.includes(sp.id),
    }));
    const rows = [];
    // A select with no options throws, and an empty rack is reachable now: a point can be banked
    // before anything has been bought with one.
    if (options.length) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`cube_setloadout_${turn}_${owner}`)
                // **The cap is enforced by the menu itself.** `maxValues` is the bag, so Discord greys
                // out the ninth option rather than letting a player pick it and be refused afterwards —
                // the rule is visible at the moment of choosing, which is the only place it helps.
                //
                // This is why `cubeState` clamps `equipped` on read: an option marked `default` counts
                // against `maxValues`, so a profile saved when the rack was uncapped would hand Discord
                // eleven defaults in an eight-value select and the whole component would be rejected.
                .setPlaceholder(options.length > bagSize()
                    ? `Pick up to ${bagSize()}`
                    : 'Pick your cubes')
                .setMinValues(0)
                .setMaxValues(Math.min(options.length, bagSize()))
                .addOptions(options),
        ));
    }
    // Spending a point, on the same screen as the rack it changes. One pick per press whatever the
    // balance, because each one is a separate decision and the second is made against the first.
    if (s.points > 0) {
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`cube_spend_${turn}_${owner}`)
                .setPlaceholder(`Unlock — ${s.points} point${s.points === 1 ? '' : 's'} to spend`)
                .addOptions(rewardChoices(s)),
        ));
    }
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cube_play_${owner}`)
            .setLabel('Back')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Secondary),
    ));
    return rows;
};

// The ceiling goes in the title and the way to raise it goes in the label, because those are
// the only two strings a modal always shows — a placeholder is invisible behind a prefilled
// value.
exports.stakeModal = function (stake, maxStake) {
    return new ModalBuilder()
        .setCustomId('cube_setstake')
        .setTitle(`Set your stake (max ${tg(maxStake)})`)
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('stake')
                .setLabel(`Each prestige raises the max ${config.maxStakeStep}×`)
                .setStyle(TextInputStyle.Short)
                .setValue(String(stake))
                .setRequired(true),
        ));
};

exports.helpEmbed = function ({ s }) {
    const top = topOf(s);
    return new EmbedBuilder()
        .setTitle(`${ChanceCube} Chuba Cubes`)
        .setColor(COLOR)
        .setDescription([
            `Stake truguts, call ${chip('blue')} or ${chip('red')}, and roll. Win the rung if your side is the **majority** — then **bank** what you're holding or **push** on. Bust and you lose the stake and everything standing on it. **Nothing else ever stops you**: the run ends when you say so, or when the cubes do.`,
            '',
            `🛣️ You walk a **road**, and it is longer than the five levels. Between each pair sits a gap holding ${emojimap.restart} **Agains** — the same table thrown again, for nothing but the right to move on. Survive one and it is **gone from your road for good**. Fill a gap and the next level opens *mid-run*: two more cubes hit the table and you push straight into it.`,
            '',
            `${routeLine(s)} — that's yours right now. Every run starts back at ${LEVELS[0].emoji} **Level 1**, but the road keeps getting shorter, and eventually it's nothing but the five levels.`,
            '',
            LEVELS.map((l, i) => {
                const line = `**Level ${i + 1}** ${l.name} — ${l.cubes} cube${l.cubes > 1 ? 's' : ''} · **${l.payout}×**`;
                return i > top ? `🔒 ${line}` : `${l.emoji} ${line}`;
            }).join('\n'),
            '',
            // The "every other prestige" clause is only true while the gap is still growing. At
            // `maxClears` it stops, and a help screen still promising more would be the one place
            // the mode lies about its own progression.
            `✖️ **A level doubles what you're holding; an Again adds one.** So a level push is an even-money bet and an Again is a bad one — you take it for the road, not the truguts. But the levels above multiply everything an Again added, so one banked early is worth **${2 ** (MAX_LEVEL)}×** what it looks like, and a full road pays far more at the top than a short one. There are **${gapSize(s)}** Agains per gap${gapSize(s) < config.maxClears ? `, and every other prestige adds one, up to **${config.maxClears}**` : ''}.`,
            '',
            `📀 One roll takes at most **${tg(s.maxStake)}**. Survive **${TOP_NAME}** and you may **prestige** — the road locks back to Level 1 and fills with Agains again, but the ceiling goes up **${config.maxStakeStep}×** and you take a **special cube** (or the right to buy rerolls, or a way to survive a tie) off Watto's rack. Past ${TOP_NAME} the Agains keep coming for as long as you want them; they clear nothing and they pay **+1**, so that is between you and your own judgement.`,
            '',
            `${ChanceCube} A run **keeps the cubes it throws**. Level 1 opens with one plain cube, and every level after draws **${config.cubesPerLevel} more** out of a **bag** shuffled at the start of the run — every **special cube** on your rack is in it, padded out with plain ones. Nothing goes back in, so the longer the bag hands you plain cubes the likelier the next pull is one of yours. The bag fits **${bagSize()}**, which is also all a rack can field — so every cube you put on the table is one you **will** meet before the top. Once out, it stays on the table and throws again every level. They force a side, multiply the payout, reflect the line, burn a cube. One face bites back: ${RIPratts} **ends the run** outright.`,
            '',
            `🧨 **Damage is permanent.** A cube destroyed at Level 2 is gone for the rest of the climb, so the table only ever gets smaller — and a short table is an **even** one, which is where ties come from.`,
            '',
            `${Whatto} A cube that **destroys** cubes can leave the line **even**, with no majority in it. Watto breaks that with a cube of his own — weighted **${Math.round(config.tieLean * 100)}/${Math.round((1 - config.tieLean) * 100)}** against your call${s.nudge ? `, though ${SlyGon} **Qui-Gon's Nudge** leans it back your way` : ''}.${s.bribe ? ` Or ${BRIBE} **buy the tie** off him for a share of what it pays — a share that climbs with every one you've bought and resets when you prestige.` : ''}`,
            '',
            `${emojimap.restart} A **reroll** buys back the roll that killed you, offered on the game over screen and nowhere else. Bank them off a Reroll Cube${s.buyReroll ? ` or buy them — the next one costs **${tg(s.rerollCost)}**, and each one you're holding makes the next dearer` : ''}.`,
            '',
            `✨ Every cube landing on your called side is a **Pure Cube**. It pays the rung like any other majority and not a trugut more — it is simply the prettiest way to win one, and Watto hates it.`,
        ].join('\n'));
};

exports.tg = tg;
exports.config = config;
