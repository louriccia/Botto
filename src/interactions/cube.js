// Router + handlers for Botto's Chance Cube.
//
// Routing (see bot.js): a component/modal custom_id is split on "_"; the first segment
// ("cube") selects this handler, the rest become `args`.
//   cube_open                              -> the cube (from /chubacubes)
//   cube_call_(blue|red)_<turn>_<owner>    -> stake+call, or push+call, then roll
//   cube_bank_<turn>_<owner>               -> bank the standing
//   cube_stake_<turn>_<owner>              -> open the stake modal
//   cube_setstake            (modal)       -> store the stake
//   cube_prestige_<turn>_<owner>           -> the prestige offer
//   cube_reward_<turn>_<owner>     (select)-> take one off the rack, which commits the prestige
//   cube_loadout_<turn>_<owner>            -> the rack
//   cube_setloadout_<turn>_<owner> (select)-> equip special cubes
//   cube_buyreroll_<turn>_<owner>          -> buy one reroll into stock
//   cube_tiebreak_<turn>_<owner>           -> let Watto's cube settle a tie
//   cube_bribe_<turn>_<owner>              -> buy the tie off him instead
//   cube_play_<owner> / cube_help_<owner>
//
// Two guards, because the board is a public message anyone can click:
//
// <owner> is the discord id of the player the board belongs to, always the last segment.
// A press from anyone else is turned away, so a bystander can't spend their own truguts
// driving somebody else's screen.
//
// <turn> is a counter checked on arrival. Without it a double-click on "Call" would stake
// twice while only one run existed, costing the player real truguts. A press that fails the
// check is dropped, and the board it came from is refreshed in place — the stale screen gets
// fixed rather than the player getting an error they can't do anything with.

const { EmbedBuilder } = require('discord.js');
const { manageTruguts } = require('./challenge/functions.js');
const { LEVELS, SWEEP_SHARE } = require('../data/challenge/cube.js');
const { WattoLOL, Whatto, restart, RIPratts, wipeout } = require('../data/discord/emoji.js').emojimap;
const {
    ensurePot, potOf, cubeState, writeCube, ladderOf, deadOf, tieOf, topOf, awardClear, MAX_LEVEL,
    bankPayout, addToPot, potCut, payFromPot, decidedAt, revealSteps,
    recordRoll, recordFaces, recordWon, recordLost, recordSpent, unrecordLost, canPrestige, applyPrestige, goalOf,
    rewardChoices, prestigeEmbed, prestigeComponents,
    setLoadout, addReroll, addBribe, loadoutEmbed, loadoutComponents,
    fillBag, drawCubes, throwSet, encodeSet, decodeSet, resolveLine, rolledFaces, specialById,
    levelMultiple, ladderStep,
    rollTiebreak, applyMults, multSteps, bribeCostFor, tieCostOf, withBreaker, tieOddsLine,
    tieFrame, tieComponents,
    chip, faces, facesMarked, choiceLine, liveFrame, deadFrame, storedFaces, watto, contextLine,
    wonLine, lostLine, nextUnlockLine, openedLine,
    playEmbed, playComponents, stakeModal, helpEmbed, errorEmbed, tg, config,
} = require('./cube/functions.js');

// Buying a tie. Matches the gesture on the button and in the rack, so the line in the payout is
// recognisably the thing that was pressed.
const BRIBE = '🤝';

const LIVE = 'challenge/cube/live';
const balanceOf = p => (Number(p?.truguts_earned) || 0) - (Number(p?.truguts_spent) || 0);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The single source of truth for the unlock gate. collectionRewardUpdater writes
// collection rewards into `effects` (not a `rewards` object, which doesn't exist), so
// that's where completing Red vs Blue lands.
const isUnlocked = user_profile => !!user_profile?.effects?.chance_cube;

const lockedEmbed = () => errorEmbed(
    "You haven't built a cube yet",
    'Botto\'s Chance Cube is unlocked by completing the **Red vs Blue** collection — three **Red Side** and three **Blue Side** items, assembled into one six-sided cube. Check `/collections`.',
);

module.exports = {
    name: 'cube',
    async execute({ interaction, args, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        const action = args[0];
        const profile_ref = database.ref(`users/${user_key}/random`);

        // The board is a public message, so anyone in the channel can click it. Every
        // component carries its owner's id as the last segment of the custom_id, and a press
        // from anybody else is turned away — otherwise a bystander clicking Blue would stake
        // their own truguts against somebody else's screen. Checked before the unlock gate so
        // a passer-by gets told whose cube it is rather than pitched the collection.
        //
        // Slash commands and modal submits are exempt: the first has no owner segment yet, and
        // a modal can only ever reach the user it was shown to.
        const owned = interaction.isChatInputCommand() || interaction.isModalSubmit()
            || args[args.length - 1] === member_id;
        // "Play again" is the one press worth honouring from a bystander: they're asking for a
        // game, not trying to drive someone else's. They get their own board as a new message
        // rather than a rejection — `render` posts instead of editing when this is set, so the
        // owner's screen is left exactly as it was.
        const adopt = !owned && action === 'play';
        if (!owned && !adopt) {
            return interaction.reply({
                embeds: [errorEmbed('Not your cube', 'This board belongs to someone else. Roll your own with `/chubacubes`.')],
                ephemeral: true,
            });
        }

        if (!isUnlocked(user_profile)) {
            return interaction.reply({ embeds: [lockedEmbed()], ephemeral: true });
        }

        await ensurePot(database, db);
        const s = cubeState(user_profile);

        if (interaction.isModalSubmit() && action === 'setstake') return setStake();
        if (interaction.isStringSelectMenu()) {
            if (action === 'reward') return doPrestige(args[1]);
            if (action === 'setloadout') return doLoadout(args[1]);
        }

        switch (action) {
            // `open` keeps a standing reroll offer — you can walk back to it with `/chubacubes`.
            // `play` is the "no thanks" on that screen, so it clears it.
            case 'open': return render(view());
            case 'play': return declineReroll();
            case 'help': return interaction.reply({ embeds: [helpEmbed({ pot: potOf(db), s })], ephemeral: true });
            case 'stake': return openStakeModal();
            case 'call': return doCall(args[1], args[2]);
            case 'bank': return doBank(args[1]);
            case 'prestige': return offerPrestige(args[1]);
            case 'loadout': return offerLoadout(args[1]);
            case 'buyreroll': return buyReroll(args[1]);
            case 'reroll': return spendReroll(args[1]);
            // The two answers to a tie. Same handler — the only difference is whether truguts
            // change hands instead of a cube being rolled.
            case 'tiebreak': return finishTie(args[1], false);
            case 'bribe': return finishTie(args[1], true);
            default: return;
        }

        // ---- rendering -----------------------------------------------------

        // One embed, one message: every beat of the game is an edit of the same payload.
        //
        // Frames drawn while cubes are still face-down must pass `snapshot` — settlement
        // has already run by then, so reading live state would spoil the result in the
        // footer balance and the clears bar a full second before the reveal.
        function payload(frame, components, snapshot) {
            const state = snapshot || { balance: balanceOf(user_profile), pot: potOf(db), s };
            return { embeds: [playEmbed({ ...state, frame })], components };
        }

        function buttons(ladder, ended, dead) {
            return playComponents({ turn: s.turn, ladder, stake: s.stake, s, ended, owner: member_id, dead });
        }

        // The idle screen, the run in progress, a roll parked on a tie, or a game over screen
        // whose reroll offer is still standing.
        //
        // The tie comes first because it is the only one of these that *owes* something: nothing
        // else can happen on this board until it's answered, so walking back in with
        // `/chubacubes` has to land on it.
        function view() {
            const pending = tieOf(db, member_id);
            if (pending) {
                return payload(tieFrame(pending, s), tieComponents(s.turn, tieCostOf(pending, s), member_id));
            }
            const ladder = ladderOf(db, member_id);
            if (ladder) return payload(liveFrame(ladder, s), buttons(ladder));
            const dead = deadOf(db, member_id);
            if (dead && s.rerolls > 0) {
                return payload(deadFrame(dead, s), buttons(null, true, dead));
            }
            return payload(null, buttons(null));
        }

        // The board is public: the whole channel watches the cubes land. Errors stay
        // ephemeral — a stale button or a short balance is nobody else's business.
        //
        // A slash command has no message to edit, and an adopted "Play again" must not touch the
        // one it was pressed on; both post a new board instead.
        function render(p) {
            return interaction.isChatInputCommand() || adopt
                ? interaction.reply(p)
                : interaction.update(p);
        }

        // ---- pacing --------------------------------------------------------

        // Every beat of a roll is an edit of the same message, so the gaps between those edits
        // *are* the animation — and they were coming out uneven in both directions, some beats
        // well under a second and some several seconds long.
        //
        // The short ones were designed in. The gaps were 750ms and 900ms, and a 750ms beat is a
        // quarter under the second a reveal reads as. `config.minFrameGap` is a floor under all
        // of them now, and the delays themselves have been written out at or above it.
        //
        // The long ones are the round-trip. What the player waits is the gap *plus* whatever the
        // edit cost, and that runs from under a tenth of a second to several when the dyno is
        // busy or Discord holds the request — a full roll is up to a dozen edits of one message
        // against a bucket of five in five seconds, so being held is a real event rather than a
        // theoretical one.
        //
        // Subtracting the measured round-trip off the next gap is the obvious answer and it is
        // the wrong one. The bot never learns when an edit *landed*, only when the response came
        // back, and a held request stalls before it is even sent — so compensation guesses wrong
        // in precisely the cases worth compensating for, and buys a better average at the price
        // of frames arriving on top of each other. Modelled four ways (deadline from send time,
        // half-round-trip, baseline-round-trip, and clamped subtraction), every one traded about
        // 130ms of mean error for twenty to fifty times as many early frames. Late and even
        // beats early and uneven, so the gap is still slept *after* the edit, and the honest
        // fixes are the floor above, the tolerance below, and a warning that says when a roll
        // was held so the difference is visible from the logs rather than guessed at.
        //
        // `var`, not `let`: the switch that routes this interaction sits above every definition
        // in this file, so it runs and returns into a handler before execution ever reaches this
        // line. A `let` would still be in its temporal dead zone by the time a roll asked for
        // it. `mark` sets it before anything reads it, and `beat` covers the read regardless.
        var frameDue = 0;
        // Opens the gap after a frame drawn by something other than `frame` — the first one of a
        // roll, which `render` sends because it is also what acknowledges the interaction.
        function mark(gap) { frameDue = Date.now() + Math.max(gap, config.minFrameGap); }
        // Waits out the gap the last frame opened. Split out from `frame` because the payout
        // frame has to be paced like every other beat but must not be swallowed like one.
        async function beat() {
            const wait = (frameDue || 0) - Date.now();
            if (wait > 0) await sleep(wait);
        }
        // One animation frame: hold for the beat the previous frame opened, draw, open the next.
        async function frame(p, gap) {
            await beat();
            const at = Date.now();
            try {
                await interaction.editReply(p);
            } catch (err) {
                // A dropped frame mid-reveal is a missing beat; a throw here is a stranded
                // board. By the time these run the roll is settled either into a live ladder or
                // into the pot, and the payout frame at the end redraws all of it from state —
                // so a beat nobody sees costs nothing, while bailing out would leave the player
                // looking at face-down cubes with every button still off.
                console.error(`[cube] dropped a reveal frame: ${err.message}`);
            }
            // The one part of a stalled roll that isn't visible from the outside. An edit this
            // slow was held rather than merely slow, and knowing which is the difference between
            // raising `minFrameGap` and chasing a network problem nothing here can fix.
            const took = Date.now() - at;
            if (took > config.slowFrameWarn) {
                console.warn(`[cube] edit took ${took}ms — the reveal stalled by that much`);
            }
            mark(gap);
        }

        // ---- guards --------------------------------------------------------

        // Rejects a button rendered against an earlier state — the guard against
        // double-clicks racing each other through a stake.
        function stale(turnArg) {
            return String(s.turn) !== String(turnArg);
        }

        // A press against a state that has already moved on. The press itself is dropped — that
        // is the whole point of the turn guard — but the player gets the board brought up to
        // date rather than told off: a stale screen is the bot's problem, not theirs, and an
        // error they can't act on is worse than the fresh buttons they wanted.
        //
        // Declared as a function, not a const arrow: the switch above dispatches before any
        // const in this scope is initialised, so an arrow here throws a TDZ ReferenceError on
        // the very first stale press.
        function refreshStale() {
            return render(view());
        }

        function bumpTurn() {
            s.turn += 1;
            writeCube(profile_ref, user_profile, { turn: s.turn });
        }

        // Anything that would start, change or cash a wager is refused while a run is on the table
        // — and a roll parked on a tie is a run on the table that also owes an answer. `ladderOf`
        // deliberately doesn't see one, so every one of those checks has to ask for it by name.
        function busy() {
            return ladderOf(db, member_id) || tieOf(db, member_id);
        }

        // ---- stake ---------------------------------------------------------

        function openStakeModal() {
            if (stale(args[1])) return refreshStale();
            return interaction.showModal(stakeModal(s.stake, s.maxStake));
        }

        function setStake() {
            const raw = interaction.fields.getTextInputValue('stake').replace(/[^\d]/g, '');
            const stake = Math.floor(Number(raw));
            if (!Number.isFinite(stake) || stake < config.minStake) {
                return interaction.reply({
                    embeds: [errorEmbed('Stake too small', `The minimum stake is ${tg(config.minStake)}.`)],
                    ephemeral: true,
                });
            }
            if (stake > s.maxStake) {
                return interaction.reply({
                    embeds: [errorEmbed('Stake too big',
                        `The most you can stake right now is ${tg(s.maxStake)}. Reach **Prestige ${s.prestige + 1}** to raise it to ${tg(s.maxStake * config.maxStakeStep)}.`)],
                    ephemeral: true,
                });
            }
            writeCube(profile_ref, user_profile, { stake });
            s.stake = stake;
            // The modal was opened from a button, so update() edits the cube in place
            // instead of stacking another ephemeral on top of it.
            return interaction.update(view());
        }

        // ---- prestige ------------------------------------------------------

        function offerPrestige(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || !canPrestige(s)) return refreshStale();
            return render({ embeds: [prestigeEmbed(s)], components: prestigeComponents(s.turn, s, member_id) });
        }

        // Taking something off the rack is the commit. Re-checked here rather than trusted from
        // the offer screen, so a stale select menu can't reset a ladder twice — and the reward
        // itself is re-validated, so a menu rendered before a cube was owned can't grant it again.
        function doPrestige(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || !canPrestige(s)) return refreshStale();

            const value = interaction.values[0];
            if (!rewardChoices(s).some(r => r.value === value)) return refreshStale();

            const patch = {};
            applyPrestige(s, patch, value);
            s.turn += 1;
            patch.turn = s.turn;
            writeCube(profile_ref, user_profile, patch);
            return render(view());
        }

        // ---- the rack ------------------------------------------------------

        // Which special cubes are on the table. Locked for the duration of a run for the same
        // reason the stake is — the loadout is what the roll was made against.
        function offerLoadout(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || !s.cubes.length) return refreshStale();
            return render({ embeds: [loadoutEmbed(s)], components: loadoutComponents(s.turn, s, member_id) });
        }

        function doLoadout(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy()) return refreshStale();
            const patch = {};
            setLoadout(s, patch, interaction.values);
            s.turn += 1;
            patch.turn = s.turn;
            writeCube(profile_ref, user_profile, patch);
            return render(view());
        }

        // Rerolls are bought into stock and spent later, on a game over screen, so the price is
        // fixed to the stake ceiling rather than to whatever is on the table — otherwise you'd
        // buy them at 100 and cash them in at the cap. Every one already in stock makes the next
        // dearer, so stockpiling has its own brake.
        function buyReroll(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || !s.buyReroll) return refreshStale();

            const balance = balanceOf(user_profile);
            if (s.rerollCost > balance) {
                return interaction.reply({
                    embeds: [errorEmbed('Not enough truguts', `A reroll costs ${tg(s.rerollCost)} but you only have ${tg(balance)}.`)],
                    ephemeral: true,
                });
            }
            manageTruguts({ user_profile, profile_ref, transaction: 'w', amount: s.rerollCost });
            const patch = {};
            addReroll(s, patch, 1);
            recordSpent(s, patch, s.rerollCost);
            s.turn += 1;
            patch.turn = s.turn;
            writeCube(profile_ref, user_profile, patch);
            return render(view());
        }

        // ---- the loop ------------------------------------------------------

        // Stake + call (idle), or push + call (live). Both end in a roll.
        function doCall(sideArg, turnArg) {
            if (stale(turnArg)) return refreshStale();
            // A parked tie owes exactly one answer, and calling a side isn't it. Refusing here
            // rather than falling through matters: the idle branch below clears the ladder node,
            // which would take an unsettled roll — and the stake on it — with it.
            if (tieOf(db, member_id)) return refreshStale();
            const call = sideArg === 'red' ? 'red' : 'blue';
            const ladder = ladderOf(db, member_id);

            if (ladder) {
                // Push. The stake was already taken when the run started.
                if (!ladder.standing || ladder.level >= topOf(s)) return refreshStale();
                bumpTurn();
                // A push spends nothing new — the ladder already holds the stake — so there is
                // nothing to hand back if this roll never reaches the screen. The multiplier
                // rides along: a Greed or Multiplier cube caught early pays on every level above it.
                return roll({
                    stake: ladder.stake, standing: ladder.standing, level: ladder.level + 1, call,
                    mult: Number(ladder.mult) || 0,
                    // Cubes a wipeout broke earlier in this climb stay off the table.
                    spent: Object.values(ladder.spent || {}),
                    // The table as this run left it and the bag it still has to draw from. A run
                    // stored before either existed carries neither, and simply starts fresh.
                    set: decodeSet(ladder.set), bag: decodeSet(ladder.bag),
                }, false);
            }

            // Calling with a reroll offer still on screen is the same answer as Play again.
            clearLadder();
            const stake = s.stake;
            const balance = balanceOf(user_profile);
            if (stake > balance) {
                return interaction.reply({
                    embeds: [errorEmbed('Not enough truguts', `That stake is ${tg(stake)} but you only have ${tg(balance)}.`)],
                    ephemeral: true,
                });
            }
            manageTruguts({ user_profile, profile_ref, transaction: 'w', amount: stake });
            bumpTurn();
            // A new run starts with an empty table and a freshly shuffled bag. Level 1 puts the
            // first cube on the table without touching it.
            return roll({
                stake, standing: 0, level: 0, call, mult: 0, spent: [], set: [],
                bag: fillBag(s.equipped),
            }, true);
        }

        // ---- rerolls -------------------------------------------------------

        // Buys back the roll that just killed the run: the same level, the same call, the same
        // stake. The bust was already settled, so this reverses the two numbers it moved — the
        // pot and the lifetime loss — and rolls that level again.
        //
        // The tallies from the void roll are deliberately *not* reversed. It was rolled, it was
        // called, and it broke the streak; a reroll is a second call rather than a rewrite.
        function spendReroll(turnArg) {
            if (stale(turnArg)) return refreshStale();
            const dead = deadOf(db, member_id);
            if (!dead || s.rerolls < 1) return refreshStale();

            clearLadder();
            const patch = {};
            addReroll(s, patch, -1);
            writeCube(profile_ref, user_profile, patch);
            bumpTurn();
            return roll({
                stake: dead.stake, standing: dead.standing, level: dead.level, call: dead.call,
                mult: Number(dead.mult) || 0, spent: Object.values(dead.spent || {}),
                // The same cubes that just lost, picked back up. `regrow: false` is what makes this
                // a reroll rather than a re-draw: nothing comes out of the bag, no cube is added,
                // removed or swapped — they are simply thrown again, new sides, faces and order.
                set: decodeSet(dead.set), bag: decodeSet(dead.bag), regrow: false,
            }, false, dead.stake);
        }

        // "Play again" on a game over screen. The offer only exists on that screen, so leaving it
        // is how you decline — the bust is already settled, so there is nothing to tidy but the
        // record of what could have been replayed.
        function declineReroll() {
            if (deadOf(db, member_id)) clearLadder();
            return render(view());
        }

        // Every frame of a roll wears the same header, the same called-side line and the same
        // clears meter; the cubes, Watto's line and the numbers under them are what move. Built
        // from the run, so the half of a roll that draws the cubes and the half that pays it out
        // can't drift apart.
        //
        // `mult` is passed in rather than read, because a Multiplier Cube only pays if its own side
        // is the side that wins: frames drawn while that is still open show the payout *without*
        // it, and only a frame that has an answer shows the payout with it.
        function frameFactory(run, mult, cubes, cubeRecord = false, multRecord = false) {
            // Read before settling: a third clear moves the ceiling, and this roll's clears
            // meter belongs to the level that was the ceiling when the cubes left the cup.
            const atCeiling = run.level === topOf(s);
            // Reaching a level is known the moment you push into it, so the deepest-level
            // badge is safe to wear from the first frame — unlike anything the roll decides.
            const deepest = run.level > s.bestLevel;
            // The tick or the cross only belongs on a frame that has an answer, so the reveal
            // isn't spoiled by the line above the cubes.
            return (facesStr, flavor, lines, outcome, bar, result) => ({
                levelIdx: run.level,
                bar: atCeiling ? bar : null,
                record: deepest,
                // How many cubes are actually on the table, so the header can say `5 of 7` once
                // the set has been damaged. It differs between the throw and the payout, which is
                // why it is fixed per factory alongside the multiplier.
                cubes,
                cubeRecord,
                // The multiple this frame is playing for, so the header shows what the roll pays
                // rather than what the level nominally does. Its record badges on the paying frame
                // only, like the cube count — the frames before it are still building the number.
                multiple: mult,
                multRecord,
                context: contextLine(run.call, run.stake, mult, result),
                faces: facesStr,
                flavor,
                lines,
                outcome,
            });
        }

        // Rolls the level, then plays it back: every cube face-down, then the cubes landing
        // a few at a time, then Watto's verdict with the buttons back. The settlement runs
        // during the first beat, so the pot and the balance are already correct by the
        // first reveal and Discord's 3s response window is never spent waiting on firebase.
        async function roll(run, staked, reverse = 0) {
            const level = LEVELS[run.level];

            // Every draw for this roll happens here, before the first await, so the outcome that
            // gets settled is fixed before anything is rendered.
            const spent = run.spent || [];
            // This level's cubes come off the top of the run's bag and join the set, then the whole
            // thing is thrown.
            //
            // A **reroll** arrives with `regrow: false` and the table exactly as it was thrown. It
            // buys back the roll, not the draw: the same cubes are picked up and thrown again, so
            // they land on new sides, roll new faces and come down in a new order, but nothing is
            // drawn and the bag is untouched. Drawing here would have quietly rerolled the
            // *loadout* as well, handing back different cubes off the bag.
            const drawn = run.regrow === false
                ? { set: run.set || [], bag: run.bag || [] }
                : drawCubes(run.set || [], run.bag || [], run.level);
            const set = drawn.set;
            const bag = drawn.bag;
            const line = throwSet(set);
            const rolled = rolledFaces(line);
            const res = resolveLine(line, run.call);

            // An even line has no majority in it, and only a destructive special face can leave
            // one. Watto breaks it with a cube of his own — unless the player owns the right to
            // buy the tie off him instead, which is the one thing in a roll he has to ask about.
            //
            // Ratts trumps a tie: the run is over whatever the cubes said, so there is nothing
            // left to break and nothing worth buying.
            const tie = !res.ended && !res.majority;
            // The multiple this roll is played for: whatever the run carried, stepped one rung up
            // the ladder, plus what this roll's greed added. Computed once here and handed down —
            // `settleRoll` must not recompute it, because a resumed tie arrives with it already
            // stepped and would step it twice.
            const base = levelMultiple(run.level, run.mult, res.mult);
            // What the tie is worth if it goes the player's way. The multipliers still waiting on
            // a winner count here, because either answer to a tie produces one.
            const worth = tie ? bankPayout(run.stake, applyMults(base, res.mults, run.call)) : 0;
            const cost = tie && s.bribe ? bribeCostFor(worth, s.bribes) : 0;
            // He only asks while the answer is worth weighing. Once his price is past what the tie
            // pays there is nothing to think about, so he stops asking and just rolls — which is
            // also what keeps every button on the tie screen one you might actually press.
            const asking = tie && s.bribe && cost < worth;
            // His cube, drawn here with every other draw so the outcome is fixed before anything
            // renders. A tie he is *asking* about draws its own when the answer arrives — there is
            // nothing to fix until then.
            const breaker = tie && !asking ? rollTiebreak(run.call, s.nudge) : null;

            // Everything the frames below draw around the cubes, as it stood before the
            // roll was settled.
            const snapshot = { balance: balanceOf(user_profile), pot: potOf(db), s: { ...s } };
            // What the roll is worth with **none of its paying faces counted** — the ladder and
            // whatever the run already carried, and nothing this throw added. Every frame up to the
            // end of the effects is drawn at this multiple, and phase two builds it up to `base` and
            // then to what the roll actually pays.
            //
            // The frames used to open at `base`, greed included, which meant the number was already
            // finished before there was anything on screen to explain it — and it left phase two
            // nowhere to start but *below* the multiple the previous frame had shown.
            const opening = levelMultiple(run.level, run.mult, 0);
            // Two factories, because the table changes size mid-roll: the throw shows every cube in
            // the set, the frames after the effects show only what survived them.
            const drawing = frameFactory(run, opening, line.length);
            const settledDrawing = frameFactory(run, opening, res.faces.length);
            // One frame per effect, built **here** rather than inside the reveal, because the reveal
            // runs after settlement and `frameFactory` reads the ceiling and the deepest level off
            // `s` — both of which settlement moves.
            const effectFrames = (res.steps || []).slice(0, config.maxEffectFrames).map(step => {
                const draw = frameFactory(run, opening, step.faces.length);
                return () => draw(
                    // Pointed at the cube that just acted, so the frame says *which* one did it
                    // rather than leaving the player to diff two rows.
                    facesMarked(step.faces, step.at), null,
                    [step.note].filter(Boolean), null, snapshot.s, null,
                );
            });

            // **Phase two of the reveal**: the paying faces counted out one at a time, with the
            // multiple climbing in the header as each lands. Built here for the same reason the
            // effect frames are — the factory reads state that settlement is about to move.
            //
            // The rule is *count each face the moment it can be counted*. Greed is unconditional, so
            // it goes now. A Multiplier only pays if its own named side is the side that won, so it
            // needs an answer: on an ordinary roll the line has already given one, on a tie it waits
            // for Watto's cube, and on a tie he is **asking** about there is no answer to have yet —
            // those multipliers are parked with the roll and walked by `finishTie` instead.
            //
            // Ratts skips the whole thing. The run ended the moment he stood up, and a multiple
            // building toward a payout that was never coming is a fake-out, not a reveal.
            const walkable = res.ended ? []
                : asking ? (res.pays || []).filter(p => p.kind === 'greed')
                    : (res.pays || []);
            const payFrames = multSteps(opening, walkable, asking ? null : (res.majority || breaker))
                .slice(-config.maxPayFrames)
                .map((step) => {
                    const draw = frameFactory(run, step.multiple, res.faces.length);
                    const row = facesMarked(res.faces, step.at);
                    // His cube stays face-up for the rest of the reveal once it has landed — these
                    // frames come after it, and the multipliers on them are being counted precisely
                    // because of what it said.
                    return () => draw(
                        breaker ? withBreaker(row, breaker) : row,
                        null, [step.note], null, snapshot.s, null,
                    );
                });
            // Mid-roll: the line as it was rolled, so a special cube shows the face it landed
            // on rather than the side hiding underneath it. The payout frame swaps in the line
            // the effects actually left behind.
            const rolling = (shown, bar) => drawing(faces(rolled, shown), null, [], null, bar, null);

            // Buttons come off for the whole roll so nothing can be pressed mid-reveal, and
            // come back with the payout.
            //
            // This is the one point in a roll where a failure could cost the player truguts for
            // nothing: the stake is already spent, but settlement hasn't run, so there'd be no
            // ladder to resume and no bust on record — the stake would just be gone. Discord
            // being unreachable is a real event, so if the roll never reaches the screen it is
            // discarded and the stake handed straight back. Every later frame is safe: by then
            // the roll is settled either into a live ladder or into the pot, and the player
            // picks it up again with `/chubacubes`.
            try {
                await render(payload(rolling(0, snapshot.s), [], snapshot));
                // Opens the roll's first gap. `render` is a frame like any other — it is just
                // sent by the acknowledgement rather than by `frame` — so the beat before the
                // cubes start landing is timed from here, and settlement runs inside it.
                mark(config.rollDelay);
            } catch (err) {
                if (staked) manageTruguts({ user_profile, profile_ref, transaction: 'r', amount: run.stake });
                throw err;
            }

            // The cubes coming out, a few at a time — and then, on a tie, one more beat while
            // Watto's own cube joins them face-down.
            async function revealLine() {
                // A special cube can rewrite the line after it lands, so there is no point at
                // which the rest of the roll stops mattering — the early stop only applies to a
                // plain one.
                const settledAt = res.specials.length ? rolled.length : decidedAt(res.cubes);
                for (const shown of revealSteps(rolled.length, settledAt)) {
                    // Hold longer on the last group — that one is the answer.
                    await frame(
                        payload(rolling(shown, snapshot.s), [], snapshot),
                        shown >= rolled.length ? config.rollDelay : config.revealDelay,
                    );
                }
                // The effects, one at a time, left to right — the order `resolveLine` fires them in.
                // Each frame is the line as that cube left it, with what it did written underneath,
                // so a burn, a reflection or a bind is something you watch happen rather than a
                // difference between two frames you have to spot.
                for (const frameOf of effectFrames) {
                    await frame(payload(frameOf(), [], snapshot), config.effectDelay);
                }

                // Drawn against the *resolved* line, because that's the line that failed to
                // decide. Nothing on the frame gives the answer away: the payout is still the
                // pre-decision one and the state around it is still the snapshot, exactly like
                // every other frame with a cube face-down on it.
                if (breaker) {
                    await frame(payload(settledDrawing(
                        withBreaker(faces(res.faces, res.faces.length), null),
                        `${Whatto} ${watto('tiebreak')}`, [tieOddsLine(s)], null, snapshot.s, null,
                    ), [], snapshot), config.rollDelay);
                }

                // Phase two: the multiple building, one paying face at a time. Last, because a
                // Multiplier can't be counted until the roll has a winner and his cube is the last
                // thing that can produce one.
                for (const frameOf of payFrames) {
                    await frame(payload(frameOf(), [], snapshot), config.effectDelay);
                }
            }

            // A tie he is asking about settles **nothing**, because the answer isn't in. The whole
            // roll is parked on the ladder node during this beat — exactly where settlement would
            // have gone, which is what makes a crash mid-animation survivable: `/chubacubes` picks
            // the tie back up and finishes it. And because nothing was written, every frame drawn
            // off that node an hour later reads the same state it reads now.
            if (asking) {
                const pending = {
                    stake: run.stake, standing: run.standing, level: run.level, call: run.call,
                    // Both multiples: `mult` is what this roll is playing for, already stepped up
                    // the ladder, and `carry` is what the run brought into the level. Answering the
                    // tie needs the first; a reroll of a tie that busts needs the second, because a
                    // reroll replays the level and would otherwise step the ladder a second time.
                    mult: base, carry: run.mult || 0, mults: res.mults, spent, roll: res.cubes, faces: res.faces,
                    // Only the Multiplier faces. The greed this roll threw is already folded into
                    // `mult` above, so replaying it when the tie is answered would count it twice —
                    // the same reason `res.mult` is rebuilt as a zero down in `finishTie`.
                    pays: (res.pays || []).filter(p => p.kind === 'mult'),
                    shortcut: res.shortcut, rerolls: res.rerolls, broken: res.broken,
                    // Both halves of the table: what survived this throw, to carry on with, and the
                    // cubes as they were thrown, in case the tie resolves into a bust that a reroll
                    // then buys back — a reroll picks those same cubes up again.
                    set: encodeSet(res.set), thrown: encodeSet(set), bag: encodeSet(bag),
                    reverse, flavor: `${Whatto} ${watto('tiebreak')}`, tie: true,
                };
                saveLadder(pending);
                // No sleep of its own: the opening beat was opened when the face-down cubes went
                // out, and `revealLine`'s first frame waits out whatever is left of it. Parking
                // the tie is a firebase write, so the old fixed sleep here was stacked on top of
                // a cost that had already been paid.
                await revealLine();
                // Paced like a frame but sent like a screen — the buttons are on it, so a failure
                // here is a board nobody can answer and has to surface rather than be logged.
                await beat();
                return interaction.editReply(payload(
                    tieFrame(pending, s), tieComponents(s.turn, cost, member_id),
                ));
            }

            return settleRoll({ run, res, level, breaker, reverse, snapshot, reveal: revealLine, thrown: set, bag, base });
        }

        // Settlement and the payout frame: the profile write, Watto's verdict, the buttons coming
        // back, and the one line the channel might hear about it.
        //
        // Shared by a roll that decided itself and a tie answered minutes later, because from here
        // down those are the same thing. What differs is all above it — how the cubes got on
        // screen, and whether a bribe changed hands. `reveal` is the cubes landing, which a resumed
        // tie has already done; `extra` is anything to say before the numbers.
        async function settleRoll({ run, res, level, breaker, bribed = 0, reverse = 0, snapshot, reveal, extra = [], thrown = [], bag = [], base }) {
            // Whoever ended up with the roll: the line's own majority, Watto's cube on top of it,
            // or a call bought outright.
            const majority = res.majority || breaker || (bribed ? run.call : null);
            const cubes = res.cubes;
            // Ratts ends a run outright, so the majority stops mattering the moment he lands.
            const won = !res.ended && !!majority && majority === run.call;
            const pure = won && res.pure;
            const spent = run.spent || [];
            // Wipeouts take a cube off the table for the rest of the climb.
            const stillSpent = res.broken.length ? [...new Set([...spent, ...res.broken])] : spent;
            // Greed and Multiplier cubes ride the standing for the rest of the run. The
            // multipliers only cash in here, because only here is there a winning side to check
            // them against — which is why a tie can't spend them until it has been broken.
            // `base` arrives already stepped up the ladder and carrying this roll's greed; all that
            // is left is one more for every surviving Multiplier whose named side actually won.
            const mult = applyMults(base, res.mults, majority);

            // Built **before** anything settles, and that ordering is load-bearing: the factory
            // reads the deepest level and the ceiling off `s`, and settlement moves both. Read
            // after, a roll that set a new deepest level would never wear the badge for it and the
            // clears meter would vanish from the very frame that filled it. The cube-count and
            // multiple records are read here for exactly the same reason — `recordRoll` below is
            // about to move both.
            const paying = frameFactory(
                run, mult, res.faces.length,
                res.faces.length > s.bestCubes, mult > s.bestMultiple,
            );

            // One profile write for the whole roll: lifetime tallies plus whatever the
            // settlement adds to it.
            const patch = {};
            const standing = won ? bankPayout(run.stake, mult) : 0;
            // The tie-breaker is Watto's cube, not one of the level's, so it stays out of the
            // player's own face tallies — `cubes` is the line and nothing but the line.
            const records = recordRoll(s, patch, {
                call: run.call, won, cubes, level: run.level, standing,
                // Positions left standing after the effects, which is what the cube-count record
                // is a record of — not the cubes that counted toward the majority.
                line: res.faces.length,
                // What the roll ended up worth per trugut staked, counted win or lose — the same
                // number the header just badged.
                multiple: mult,
            });
            // Every special face this roll threw, for the per-cube record on the rack screen. Kept
            // out of `recordRoll` because it counts faces rather than cubes, and because a resumed
            // tie must not tally the same throw twice — the reconstructed `res` carries no log.
            recordFaces(s, patch, res.faceLog);
            // A Reroll Cube banks its reroll whatever the roll did, so it's never a punishment
            // for having won.
            if (res.rerolls) addReroll(s, patch, res.rerolls);
            // Undoing the bust a reroll was spent on. Only the pot and the ledger need reversing:
            // the stake left the player's balance when the run started, not on this roll.
            //
            // Each is undone in the currency it was done in — the pot only ever received
            // `potCut(stake)`, so that is all that comes back out, while the ledger recorded the
            // whole stake and gives back the whole stake. `reverse` is the same stake `settleLoss`
            // deposited against, so the two `potCut` calls floor to the identical integer and the
            // jar lands exactly where it started.
            if (reverse) {
                addToPot(database, db, -potCut(reverse));
                unrecordLost(s, patch, reverse);
            }
            // A bought tie is a trugut the mode took, like a bought reroll, so it goes on the
            // lifetime spend — and it makes the next one dearer. Not on the *loss* ledger: a bribe
            // is a price, and half the time it is the price of a win.
            if (bribed) {
                recordSpent(s, patch, bribed);
                addBribe(s, patch);
            }

            // No `sleep` raced against this any more, because the pacer is already holding the
            // beat: it started when the face-down cubes went out, and the first frame of
            // `reveal` waits out whatever is left of it. Same effect as the `Promise.all` this
            // replaces — settlement still overlaps the opening beat rather than following it —
            // but the beat is owned in one place now instead of being half here and half in the
            // frame that opened it.
            const settled = won
                ? await settleWin({ run, level, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag })
                : await settleLoss({ run, level, res, patch });
            writeCube(profile_ref, user_profile, patch);

            if (reveal) await reveal();

            // Filling a meter shows *that* meter completed, not the next one's empty counter.
            // The new one belongs to a level the player hasn't rolled yet, so it isn't theirs
            // to look at until they get there.
            const after = settled.filled
                ? { ...snapshot.s, clears: goalOf(snapshot.s) }
                : s;

            // A shatter is the one special-cube effect that gets said out loud, because it's the
            // only one that changes what the *next* roll can do — the cube is off the table for
            // the rest of the climb, and a player who wasn't told would just find a loadout
            // quietly short. Everything else the specials did is left to be read off the cubes.
            const shattered = res.broken.map(specialById).filter(Boolean);
            const lines = [
                ...extra,
                ...(shattered.length
                    ? [`${wipeout} **${shattered.map(sp => sp.name).join('**, **')}** shattered`
                        + `${settled.ladder
                            ? ` — the table is ${shattered.length > 1 ? `**${shattered.length}** cubes` : 'a cube'} shorter for the rest of the climb`
                            : ''}.`]
                    : []),
                ...settled.lines,
            ];

            // The payout frame draws the *resolved* line, so the cubes the count was taken over
            // are the cubes on screen — a special that rearranged the line leaves what it left.
            // Watto's tie-breaker stays beside it face-up, because it decided the roll and belongs
            // in the picture of how the roll ended. A tie he was paid off for shows no cube at
            // all: he never rolled one.
            const resolved = faces(res.faces, res.faces.length);
            const finalFrame = paying(
                breaker ? withBreaker(resolved, breaker) : resolved,
                settled.flavor, lines, settled.outcome, after, won ? 'win' : 'bust',
            );
            // A bust with a reroll in the bank keeps the run on file so the offer on this screen
            // has something to replay. The bust itself is already fully settled, so letting the
            // offer lapse leaks nothing.
            if (settled.outcome === 'bust' && s.rerolls > 0) {
                // Stored with the cubes **as they were thrown**, because a reroll picks up that same
                // table and throws it again rather than drawing a new one.
                saveDead({ ...run, set: encodeSet(thrown), bag: encodeSet(bag), spent, dead: true, faces: res.faces, roll: cubes, flavor: settled.flavor, lines });
            }

            // Paced like a frame but sent like a screen. It holds for the beat the last reveal
            // frame opened, so the verdict doesn't tread on the cubes — but it carries the
            // buttons, so unlike a reveal frame a failure here is a board the player can't
            // answer, and it has to surface rather than be logged and walked past.
            await beat();
            await interaction.editReply(payload(
                finalFrame,
                buttons(settled.ladder, !settled.ladder, settled.outcome === 'bust'),
            ));

            return announce(settled.publicNote);
        }

        // ---- ties ----------------------------------------------------------

        // The answer to a parked tie. Nothing about that roll was settled, so this is where all of
        // it happens — exactly as it would have at the time, because the stored run *is* the roll
        // and the only new information is which way it went.
        //
        // `buying` picks the answer: his cube, or his price. The price is worked out here rather
        // than taken from the button, so a screen left open across a prestige can't buy a tie at
        // yesterday's rate.
        async function finishTie(turnArg, buying) {
            if (stale(turnArg)) return refreshStale();
            const pending = tieOf(db, member_id);
            if (!pending) return refreshStale();
            const level = LEVELS[pending.level];
            if (!level) {
                // A level the data no longer has: nothing can be drawn for it, and a tie nobody
                // can answer would block this player's board forever. Let it go instead.
                clearLadder();
                return refreshStale();
            }

            let bribed = 0;
            if (buying) {
                if (!s.bribe) return refreshStale();
                bribed = tieCostOf(pending, s);
                const balance = balanceOf(user_profile);
                if (bribed > balance) {
                    return interaction.reply({
                        embeds: [errorEmbed('Not enough truguts',
                            `Watto wants ${tg(bribed)} for that tie and you only have ${tg(balance)}. Rolling his cube is free.`)],
                        ephemeral: true,
                    });
                }
                manageTruguts({ user_profile, profile_ref, transaction: 'w', amount: bribed });
            }

            // Off the node and the turn bumped before anything settles, so a tie can only ever be
            // answered once — the same job the turn counter does for a double-clicked call.
            clearLadder();
            bumpTurn();

            // What this roll is playing for. Stepped up the ladder and carrying the roll's greed
            // when the tie was parked, so it is taken as-is rather than recomputed.
            const base = Number(pending.mult) || LEVELS[pending.level].payout;
            const run = {
                stake: Number(pending.stake) || 0,
                standing: Number(pending.standing) || 0,
                level: pending.level,
                call: pending.call,
                // The multiple the run *entered* this level with, which is what a reroll of this
                // level steps from. A tie parked before this field existed simply starts the
                // level's multiple back at the ladder.
                mult: Number(pending.carry) || 0,
                spent: Object.values(pending.spent || {}),
                // The cubes as they were thrown, which is what a reroll would pick back up if
                // answering the tie ends the run, and the bag left to draw from if it doesn't.
                set: decodeSet(pending.thrown), bag: decodeSet(pending.bag),
            };
            // The line exactly as the roll left it: even, with no majority in it. Everything the
            // special cubes did is already folded into the stored run, so the only modifiers here
            // are the ones that were still waiting on a winner.
            const res = {
                cubes: Object.values(pending.roll || {}),
                faces: Object.values(pending.faces || {}),
                majority: null,
                pure: false,
                swept: false,
                // Zero, not one: this is what the roll *adds*, and the greed it added is already
                // baked into `pending.mult`. A one here would hand out a free ×1 on every tie.
                mult: 0,
                mults: Object.values(pending.mults || {}),
                // The Multiplier faces still owed an answer, so phase two of the reveal can count
                // them out once his cube has given them one. Greed was stripped when the tie was
                // parked, which is what makes the zero above safe.
                pays: Object.values(pending.pays || {}),
                shortcut: !!pending.shortcut,
                rerolls: Number(pending.rerolls) || 0,
                broken: Object.values(pending.broken || {}),
                ended: null,
                notes: [],
                specials: [],
                // What survived the throw that tied. If answering the tie keeps the run alive, this
                // is the table the next level builds on.
                set: decodeSet(pending.set),
            };
            const breaker = buying ? null : rollTiebreak(run.call, s.nudge);
            const snapshot = { balance: balanceOf(user_profile), pot: potOf(db), s: { ...s } };
            const resolved = faces(res.faces, res.faces.length);

            // The answer is in, so the buttons come off — and this press is also what acknowledges
            // the interaction, which every frame after it edits. Bribing pockets the cube on the
            // spot; rolling leaves it face-down for one more beat.
            await render(payload(frameFactory(run, base, res.faces.length)(
                buying ? resolved : withBreaker(resolved, null),
                buying ? `${Whatto} ${watto('bribe')}` : pending.flavor || null,
                buying ? [] : [tieOddsLine(s)], null, snapshot.s, null,
            ), [], snapshot));
            // Opens the beat before whatever comes next — the multiple counting itself out, or,
            // when this roll threw no multipliers, the payout frame straight after. Either way
            // it is timed from this screen going out rather than from the end of settlement.
            mark(config.rollDelay);

            // The half of phase two the tie was holding up. Greed was counted before the roll
            // parked, so `base` is where the walk picks up and only the Multiplier faces are left —
            // and now there is a winner to check their named sides against, which is the entire
            // reason they waited. Built before `settleRoll` because the factory reads state that
            // settlement moves, and handed over as `reveal` because from here down that is exactly
            // what it is: the last thing on this roll still to land.
            const payFrames = multSteps(base, res.pays, breaker || (bribed ? run.call : null))
                .slice(-config.maxPayFrames)
                .map((step) => {
                    const draw = frameFactory(run, step.multiple, res.faces.length);
                    const row = facesMarked(res.faces, step.at);
                    return () => draw(
                        breaker ? withBreaker(row, breaker) : row,
                        null, [step.note], null, snapshot.s, null,
                    );
                });

            return settleRoll({
                run, res, level, breaker, bribed, reverse: Number(pending.reverse) || 0,
                snapshot, thrown: run.set, bag: run.bag, base,
                reveal: payFrames.length
                    ? async () => {
                        for (const frameOf of payFrames) {
                            await frame(payload(frameOf(), [], snapshot), config.effectDelay);
                        }
                    }
                    : null,
                // The bribe gets a line of its own. It's a second transaction on top of whatever
                // the roll paid, and the rule everywhere else in this mode is that every trugut
                // that moves gets named.
                extra: bribed ? [`${BRIBE} **Bought the tie** for **${tg(bribed)}** truguts.`] : [],
            });
        }

        // A share of every trugut lost goes into the Pure Cube pot; the rest leaves the economy.
        // The stake is already gone from the player's balance either way, so this only decides
        // how much of it comes back to the table — see `potShare`.
        //
        // The **ledger takes the full stake**, not the share. `recordLost` is the player's own
        // record of what this mode has cost them, so it tracks their balance rather than the
        // jar's; only the pot sees a fraction.
        function settleLoss({ run, level, res, patch }) {
            addToPot(database, db, potCut(run.stake));
            recordLost(s, patch, run.stake);
            clearLadder();
            // Four ways to lose, and Watto has a line for each — but only the line. What the
            // cubes did to get there is on the table for the player to read.
            //
            // A line with no majority in it only reaches here once his tie-breaker has already
            // gone his way, which it usually does: a bought tie is always a win, and Ratts is
            // checked first because he ends the run whatever the cubes said.
            const flavor = res.ended ? watto('ripratts')
                : !res.majority ? watto('tie')
                    : res.swept ? `${WattoLOL} ${watto('cackle')}`
                        : watto('bust');
            return {
                flavor,
                lines: [lostLine(run.stake, run.standing)],
                ladder: null, publicNote: null, outcome: 'bust',
            };
        }

        async function settleWin({ run, level, majority, pure, cubes, standing, mult, patch, records, res, stillSpent, breaker, bribed, bag = [] }) {
            // A Shortcut Cube is a clear toward *the next locked level*, so once the ladder is
            // fully open it has nothing to pay. Without this, a shortcut on a Level 1 roll would
            // hand over the prestige gate — which is meant to cost a run at the top of the
            // ladder, not a one-cube wager.
            const shortcut = res.shortcut && s.unlocked < MAX_LEVEL;
            const lines = [];
            let publicNote = null;
            let prize = 0;

            if (pure) {
                prize = await payFromPot(database, db, SWEEP_SHARE[level.cubes] || 0);
                if (prize > 0) {
                    manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: prize });
                    recordWon(s, patch, prize);
                    // Every pure cube that pays gets a line in the channel — taking a bite out of
                    // a pot everyone has been feeding is the one result that's genuinely other
                    // people's business. Only the ones that pay nothing stay on the board.
                    publicNote = level.cubes >= 9
                        ? `🏆 **${member_name}** rolled a **PURE CUBE** — all nine on ${chip(majority)} — and took the **whole pot**: **${tg(prize)}**.`
                        : `✨ **${member_name}** rolled a **pure ${level.cubes}** on ${chip(majority)} and took **${tg(prize)}** off the Pure Cube pot.`;
                }
            }

            const topped = run.level >= topOf(s);

            // Award the clear *before* deciding whether the run ends, because a clear that opens
            // the next level changes that answer. The ceiling only banks itself because there's
            // nothing unlocked to push into — and if this very roll unlocked something, that
            // stopped being true. Deciding first and unlocking second is what used to hand the
            // player a key and shut the door in the same breath.
            let clear = null;
            let extra = null;
            if (topped) {
                clear = awardClear(s, patch);
                // A Shortcut Cube is a second clear on top of the one surviving the ceiling
                // already earned, so it can be the one that opens the level.
                extra = shortcut ? awardClear(s, patch) : null;
            } else if (shortcut) {
                // A Shortcut Cube pays its clear wherever it lands, which is the only way
                // progress is ever made below your ceiling. The run carries on regardless.
                awardClear(s, patch);
            }
            const opened = extra?.unlocked ?? clear?.unlocked ?? null;
            // The wall moved. Stay live and let them carry the standing into the new level.
            const reopened = topped && opened != null && run.level < topOf(s);
            const ends = topped && !reopened;

            // A tie is the one win with a bigger story than the level it happened on, so it takes
            // the line: losing a tie has to sound like the house winning, which means winning one
            // has to sound like the house losing. Neither can collide with a jackpot or a pure
            // roll — a tied line has no majority in it, so it can never be swept.
            const flavor = watto(
                prize > 0 ? 'jackpot'
                    : pure ? 'pure'
                        : breaker ? 'tiewin'
                            : bribed ? 'bribe'
                                : !ends ? 'win'
                                    : run.level >= MAX_LEVEL ? 'final' : 'ceiling',
            );
            if (pure) lines.push(`✨ **PURE CUBE** — all ${cubes.length} landed ${chip(majority)}.`);
            if (prize > 0) lines.push(level.cubes >= 9
                ? `🏆 **THE POT IS YOURS — ${tg(prize)}.**`
                : `💎 A pure ${level.cubes} takes **${tg(prize)}** off the pot.`);

            if (ends) {
                // Nothing unlocked to push into, so your ceiling banks itself.
                payStanding(standing);
                recordWon(s, patch, standing - run.stake);
                // Everything gained on this roll: the profit on the stake, plus any pot.
                lines.push(wonLine(standing - run.stake + prize, opened, records.standing));
                // The forward-looking line is worth showing whenever the meter moved, and at
                // the top of the ladder it's how the prestige offer gets announced.
                if (clear || extra) lines.push(nextUnlockLine(s));
                return {
                    flavor, lines, ladder: null, outcome: 'bank',
                    filled: !!(clear || extra) && (opened != null || clear?.prestige || extra?.prestige),
                    publicNote: publicNote || bankNote(standing, run.level),
                };
            }

            // Still standing — either below the ceiling, or because the clear just moved it.
            if (reopened) lines.push(openedLine(opened));

            const live = {
                stake: run.stake, level: run.level, call: run.call, standing, roll: cubes,
                mult, faces: res.faces, spent: stillSpent,
                // The table the next level builds on, and what is left in the bag to build it with.
                // Everything this roll destroyed, broke or wrote over is already baked into the set.
                set: encodeSet(res.set), bag: encodeSet(bag),
            };
            saveLadder(live);
            lines.push(choiceLine(run.stake, run.level, records.standing, mult));
            return { flavor, lines, ladder: live, publicNote, filled: reopened };
        }

        async function doBank(turnArg) {
            if (stale(turnArg)) return refreshStale();
            const ladder = ladderOf(db, member_id);
            if (!ladder || !ladder.standing) return refreshStale();
            bumpTurn();
            payStanding(ladder.standing);

            // Cashing out short of your ceiling is not a clear — the gate is surviving your
            // top level, which banks itself, so nothing is awarded here. The profit still
            // goes on the lifetime ledger.
            const patch = {};
            recordWon(s, patch, ladder.standing - ladder.stake);
            writeCube(profile_ref, user_profile, patch);

            await render(payload({
                levelIdx: ladder.level,
                bar: ladder.level === topOf(s) ? s : null,
                multiple: Number(ladder.mult) || LEVELS[ladder.level].payout,
                context: contextLine(ladder.call, ladder.stake, Number(ladder.mult) || 0, 'win'),
                faces: storedFaces(ladder),
                outcome: 'bank',
                flavor: watto('bank'),
                lines: [wonLine(ladder.standing - ladder.stake)],
            }, buttons(null, true)));

            return announce(bankNote(ladder.standing, ladder.level));
        }

        function payStanding(standing) {
            manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: standing });
            clearLadder();
        }

        // The channel only hears about the top of the ladder. Clearing it is a five-call run at
        // 1-in-32, which is worth everyone's attention; anything shallower happens often enough
        // that announcing it would just be noise next to the public board it already happened on.
        function bankNote(standing, levelIdx) {
            return levelIdx >= MAX_LEVEL
                ? `${LEVELS[levelIdx].emoji} **${member_name}** cleared **${LEVELS[levelIdx].name}** for **${tg(standing)}**.`
                : null;
        }

        // ---- the live run --------------------------------------------------

        // Cached first and persisted without blocking: the frames below read the cache,
        // and the turn guard lives on the profile (written synchronously), so a fast
        // second click still can't slip past while this settles.
        function saveLadder(value) {
            if (!db.ch.cube) db.ch.cube = {};
            if (!db.ch.cube.ladders) db.ch.cube.ladders = {};
            db.ch.cube.ladders[member_id] = value;
            database.ref(`${LIVE}/ladders/${member_id}`).set({ ...value, updated: Date.now() }).catch(() => { });
        }

        // A busted run kept on file purely so the reroll button on the game over screen has
        // something to replay. Stored in the same node as a live run and marked `dead`, so
        // `ladderOf` refuses it everywhere a standing would be assumed.
        function saveDead(value) {
            saveLadder(value);
        }

        function clearLadder() {
            if (db.ch.cube?.ladders) delete db.ch.cube.ladders[member_id];
            database.ref(`${LIVE}/ladders/${member_id}`).remove().catch(() => { });
        }

        // The loud moments get a public line in-channel; everything else stays ephemeral.
        async function announce(publicNote) {
            if (!publicNote) return;
            try {
                await interaction.channel?.send({
                    embeds: [new EmbedBuilder()
                        .setDescription(publicNote)
                        .setColor('#F0B232')
                        .setAuthor({ name: member_name, iconURL: member_avatar || undefined })],
                });
            } catch (_) { /* channel may not allow it; the run already settled */ }
        }
    },
};

module.exports.isUnlocked = isUnlocked;
