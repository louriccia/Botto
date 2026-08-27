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
//   cube_doprestige_<turn>_<owner>         -> hand the ladder back, banking a build token
//   cube_loadout_<turn>_<owner>            -> the rack
//   cube_setloadout_<turn>_<owner> (select)-> equip special cubes
//   cube_spend_<turn>_<owner>      (select)-> spend one build token off the rack
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
const { LEVELS } = require('../data/challenge/cube.js');
const { WattoLOL, Whatto, wipeout } = require('../data/discord/emoji.js').emojimap;
// What is left of this import is the *screen*. Everything that decides anything moved to
// `game/cube/actions.js`, and the shrinking of this list is the shape of that change.
const {
    cubeState, ladderOf, deadOf, tieOf, topOf, MAX_LEVEL,
    decidedAt, revealSteps, canPrestige, goalOf,
    prestigeEmbed, prestigeComponents, loadoutEmbed, loadoutComponents,
    encodeSet, specialById, applyMults, multSteps,
    tieCostOf, withBreaker, tieOddsLine, tieFrame, tieComponents,
    chip, faces, facesMarked, choiceLine, liveFrame, deadFrame, storedFaces, watto, contextLine,
    wonLine, lostLine, nextUnlockLine, openedLine,
    playEmbed, playComponents, stakeModal, helpEmbed, errorEmbed, tg, config,
} = require('./cube/functions.js');

// The rules and everything that moves truguts. This handler draws; it no longer decides.
const actions = require('../game/cube/actions.js');
const { faceGlyph } = require('../data/discord/cube_emoji.js');
const { renderNote } = require('../data/discord/cube_notes.js');

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

        const s = cubeState(user_profile);

        // What `game/cube/actions.js` needs to act. `s` is shared rather than rebuilt, because the
        // frames drawn around a settlement read the same object the actions mutate — that is how a
        // meter fills on the frame that earned it.
        //
        // `moveTruguts` is the one dependency the actions refuse to import: `manageTruguts` lives
        // in the challenge module and would drag discord.js into the rules.
        const ctx = () => ({
            db, database, s, profile: user_profile, profileRef: profile_ref, discordId: member_id,
            moveTruguts: ({ transaction, amount }) =>
                manageTruguts({ user_profile, profile_ref, transaction, amount }),
        });

        if (interaction.isModalSubmit() && action === 'setstake') return setStake();
        if (interaction.isStringSelectMenu()) {
            if (action === 'spend') return doSpend(args[1]);
            if (action === 'setloadout') return doLoadout(args[1]);
        }

        switch (action) {
            // `open` keeps a standing reroll offer — you can walk back to it with `/chubacubes`.
            // `play` is the "no thanks" on that screen, so it clears it.
            case 'open': return render(view());
            case 'play': return declineReroll();
            case 'help': return interaction.reply({ embeds: [helpEmbed({ s })], ephemeral: true });
            case 'stake': return openStakeModal();
            case 'call': return doCall(args[1], args[2]);
            case 'bank': return doBank(args[1]);
            case 'prestige': return offerPrestige(args[1]);
            case 'doprestige': return doPrestige(args[1]);
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
            const state = snapshot || { balance: balanceOf(user_profile), s };
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
                // or into the ledger, and the payout frame at the end redraws all of it from state —
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
            const set = actions.setStake(ctx(), { stake });
            if (!set.ok) return refreshStale();
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

        // Handing the ladder back. Re-checked here rather than trusted from the offer screen, so a
        // stale button can't reset a ladder twice. Nothing is chosen: the point it banks is spent on
        // the rack, whenever.
        function doPrestige(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || !canPrestige(s)) return refreshStale();

            const done = actions.prestige(ctx());
            if (!done.ok) return refreshStale();
            bumpTurn();
            return render(view());
        }

        // ---- the rack ------------------------------------------------------

        // Which special cubes are on the table. Locked for the duration of a run for the same
        // reason the stake is — the loadout is what the roll was made against.
        // An unspent point can open this on an empty rack, which is the one way in to spending it.
        function offerLoadout(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || (!s.cubes.length && s.points < 1)) return refreshStale();
            return render({ embeds: [loadoutEmbed(s)], components: loadoutComponents(s.turn, s, member_id) });
        }

        function doLoadout(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy()) return refreshStale();
            const done = actions.setLoadout(ctx(), { ids: interaction.values });
            if (!done.ok) return refreshStale();
            bumpTurn();
            return render(view());
        }

        // Spending one banked point. Stays on the rack rather than bouncing back to the board: the
        // screen the pick just changed is the screen worth looking at, and a second point is spent
        // against what the first one bought.
        function doSpend(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || s.points < 1) return refreshStale();
            const done = actions.spendPoint(ctx(), { reward: interaction.values[0] });
            if (!done.ok) return refreshStale();
            bumpTurn();
            return render({ embeds: [loadoutEmbed(s)], components: loadoutComponents(s.turn, s, member_id) });
        }

        // Rerolls are bought into stock and spent later, on a game over screen, so the price is
        // fixed to the stake ceiling rather than to whatever is on the table — otherwise you'd
        // buy them at 100 and cash them in at the cap. Every one already in stock makes the next
        // dearer, so stockpiling has its own brake.
        function buyReroll(turnArg) {
            if (stale(turnArg)) return refreshStale();
            if (busy() || !s.buyReroll) return refreshStale();

            const bought = actions.buyReroll(ctx());
            if (!bought.ok) {
                if (bought.code === 'insufficient') {
                    return interaction.reply({
                        embeds: [errorEmbed('Not enough truguts',
                            `A reroll costs ${tg(bought.cost)} but you only have ${tg(bought.balance)}.`)],
                        ephemeral: true,
                    });
                }
                return refreshStale();
            }
            bumpTurn();
            return render(view());
        }

        // ---- the loop ------------------------------------------------------

        // Stake + call (idle), or push + call (live). Both end in a roll.
        function doCall(sideArg, turnArg) {
            if (stale(turnArg)) return refreshStale();
            // A parked tie owes exactly one answer, and calling a side isn't it. Refusing here
            // rather than falling through matters: starting a run clears the ladder node, which
            // would take an unsettled roll — and the stake on it — with it.
            if (tieOf(db, member_id)) return refreshStale();
            const call = sideArg === 'red' ? 'red' : 'blue';
            const pushing = !!ladderOf(db, member_id);

            // Both branches end in a roll; which one is `actions`' decision, along with the stake
            // debit and every check on it.
            const opened = pushing
                ? actions.pushRun(ctx(), { call })
                : actions.startRun(ctx(), { call });

            if (!opened.ok) {
                // Out of money is the one refusal worth an explanation. Everything else means the
                // screen is stale, and a refreshed board says more than an error would.
                if (opened.code === 'insufficient') {
                    return interaction.reply({
                        embeds: [errorEmbed('Not enough truguts',
                            `That stake is ${tg(opened.stake)} but you only have ${tg(opened.balance)}.`)],
                        ephemeral: true,
                    });
                }
                return refreshStale();
            }

            bumpTurn();
            return roll(opened.run, opened.staked > 0);
        }

        // ---- rerolls -------------------------------------------------------

        // Buys back the roll that just killed the run: the same level, the same call, the same
        // stake. The bust was already settled, so this reverses the one number it moved — the
        // lifetime loss — and rolls that level again.
        //
        // The tallies from the void roll are deliberately *not* reversed. It was rolled, it was
        // called, and it broke the streak; a reroll is a second call rather than a rewrite.
        function spendReroll(turnArg) {
            if (stale(turnArg)) return refreshStale();
            const again = actions.spendReroll(ctx());
            if (!again.ok) return refreshStale();
            bumpTurn();
            return roll(again.run, false, again.reverse);
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
        function frameFactory(run, mult, cubes, cubeRecord = false, multRecord = false, held = 0) {
            // Reaching a level is known the moment you push into it, so the deepest-level
            // badge is safe to wear from the first frame — unlike anything the roll decides.
            const deepest = run.level > s.bestLevel;
            // The tick or the cross only belongs on a frame that has an answer, so the reveal
            // isn't spoiled by the line above the cubes.
            return (facesStr, flavor, lines, outcome, bar, result) => ({
                levelIdx: run.level,
                // Which time round this is, for the header. An Again wears the level's own name.
                again: run.again || 0,
                // The road, as the frame should draw it. Always passed now — the map is relevant on
                // every rung, where the old meter only belonged on the one that could clear.
                bar,
                record: deepest,
                // How many cubes are actually on the table, so the header can say `5 of 7` once
                // the set has been damaged. It differs between the throw and the payout, which is
                // why it is fixed per factory alongside the multiplier.
                cubes,
                cubeRecord,
                // Cubes a captor is holding at this point in the roll. They aren't on the row — a
                // held cube isn't drawn — so the header is the only place they exist on screen.
                held,
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
        // during the first beat, so the balance and the clears are already correct by the
        // first reveal and Discord's 3s response window is never spent waiting on firebase.
        async function roll(run, staked, reverse = 0) {
            // Every draw for this roll happens in one call, before the first await, so the outcome
            // that gets settled is fixed before anything is rendered — and it is the same call the
            // Activity makes.
            const thrown = actions.throwLevel(ctx(), run);
            const {
                res, level, set, bag, tie, asking, breaker, base, opening, worth, cost,
            } = thrown;
            const spent = run.spent || [];
            const rolled = thrown.rolled.map(faceGlyph);

            // Everything the frames below draw around the cubes, as it stood before the
            // roll was settled.
            const snapshot = { balance: balanceOf(user_profile), s: { ...s } };
            // What the roll is worth with **none of its paying faces counted** — the ladder and
            // whatever the run already carried, and nothing this throw added. Every frame up to the
            // end of the effects is drawn at this multiple, and phase two builds it up to `base` and
            // then to what the roll actually pays.
            //
            // The frames used to open at `base`, greed included, which meant the number was already
            // finished before there was anything on screen to explain it — and it left phase two
            // nowhere to start but *below* the multiple the previous frame had shown.
            // Two factories, because the table changes size mid-roll: the throw shows every cube in
            // the set, the frames after the effects show only what survived them.
            // What was already in a hold when the cubes left the cup: the throw is drawn before any
            // of this roll's effects, so it shows the hold as the last rung left it.
            const heldBefore = (thrown.rolledState.holds || []).reduce((n, h) => n + h, 0);
            const drawing = frameFactory(run, opening, rolled.length, false, false, heldBefore);
            const settledDrawing = frameFactory(
                run, opening, res.faceIds.length, false, false, res.held,
            );
            // One frame per effect, built **here** rather than inside the reveal, because the reveal
            // runs after settlement and `frameFactory` reads the ceiling and the deepest level off
            // `s` — both of which settlement moves.
            //
            // The engine emits **every** step it took — nine, on a full rack. The cap is this
            // client's, because each frame is a message edit.
            //
            // `quiet` steps are turns that changed nothing: a Binder with nothing on its right to burn, a
            // Pit Droid reaching into an empty bag. The Activity draws them, because a frame costs it
            // nothing and the alternative is an effect cube that looks skipped. Here a frame is a message
            // edit and there are three, so the budget goes to things that actually happened.
            const effectFrames = (res.steps || []).filter(s => !s.quiet)
                .slice(0, config.maxEffectFrames).map((step) => {
                const row = step.faceIds.map(faceGlyph);
                // The hold as that step left it, so a cube being carried off shows the row shorten
                // and the hold fill in the same frame.
                const stepHeld = (step.holds || []).reduce((n, h) => n + h, 0);
                const draw = frameFactory(run, opening, row.length, false, false, stepHeld);
                return () => draw(
                    // Pointed at the cube that just acted, so the frame says *which* one did it
                    // rather than leaving the player to diff two rows.
                    facesMarked(row, step.at), null,
                    [renderNote(step.note)].filter(Boolean), null, snapshot.s, null,
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
            const resolvedRow = res.faceIds.map(faceGlyph);
            const payFrames = multSteps(opening, walkable, asking ? null : (res.majority || breaker))
                .slice(-config.maxPayFrames)
                .map((step) => {
                    const draw = frameFactory(
                        run, step.multiple, resolvedRow.length, false, false, res.held,
                    );
                    const row = facesMarked(resolvedRow, step.at);
                    // His cube stays face-up for the rest of the reveal once it has landed — these
                    // frames come after it, and the multipliers on them are being counted precisely
                    // because of what it said.
                    return () => draw(
                        breaker ? withBreaker(row, breaker) : row,
                        null, [renderNote(step.note)], null, snapshot.s, null,
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
            // the roll is settled either into a live ladder or into the ledger, and the player
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
                        withBreaker(faces(resolvedRow, resolvedRow.length), null),
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
                // Parked where settlement would have written, so a crash between the question and
                // the answer leaves a tie that can still be picked up and finished. The shape is
                // `actions.parkTie`'s, because `answerTie` has to be able to rebuild the roll from
                // it — for this client and for the Activity alike.
                actions.parkTie(ctx(), thrown, { reverse });
                const pending = { ...tieOf(db, member_id), flavor: `${Whatto} ${watto('tiebreak')}` };
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

            return settleRoll({ thrown, reverse, snapshot, reveal: revealLine });
        }

        // Settlement and the payout frame: the profile write, Watto's verdict, the buttons coming
        // back, and the one line the channel might hear about it.
        //
        // Shared by a roll that decided itself and a tie answered minutes later, because from here
        // down those are the same thing. What differs is all above it — how the cubes got on
        // screen, and whether a bribe changed hands. `reveal` is the cubes landing, which a resumed
        // tie has already done; `extra` is anything to say before the numbers.
        async function settleRoll({ thrown, bribed = 0, reverse = 0, snapshot, reveal, extra = [] }) {
            const { run, res, base, breaker } = thrown;
            // Whoever ended up with the roll: the line's own majority, Watto's cube on top of it,
            // or a call bought outright. Worked out here as well as inside settlement, because the
            // frames below need the final multiple before anything is allowed to move.
            const majority = res.majority || breaker || (bribed ? run.call : null);
            // Greed and Multiplier cubes ride the standing for the rest of the run. `base` arrives
            // already stepped up the ladder and carrying this roll's greed; all that is left is one
            // more for every surviving Multiplier whose named side actually won.
            const mult = applyMults(base, res.mults, majority);

            // Built **before** anything settles, and that ordering is load-bearing: the factory
            // reads the deepest level and the ceiling off `s`, and settlement moves both. Read
            // after, a roll that set a new deepest level would never wear the badge for it and the
            // clears meter would vanish from the very frame that filled it. The cube-count and
            // multiple records are read here for exactly the same reason.
            const paying = frameFactory(
                run, mult, res.faceIds.length,
                res.faceIds.length > s.bestCubes, mult > s.bestMultiple, res.held,
            );

            // Everything that moves — the ledger, the clears, the ladder, the truguts —
            // happens in one call, in `game/cube/actions.js`, which the Activity calls too. This
            // handler draws the result and nothing else.
            //
            // No `sleep` races it: the pacer is already holding the beat that opened when the
            // face-down cubes went out, and the first frame of `reveal` waits out whatever is left.
            // Settlement still overlaps the opening beat rather than following it.
            const settled = await actions.settleThrow(ctx(), { thrown, bribed, reverse });

            if (reveal) await reveal();

            // Filling a meter shows *that* meter completed, not the next one's empty counter.
            // The new one belongs to a level the player hasn't rolled yet, so it isn't theirs
            // to look at until they get there.
            const after = settled.filled
                ? { ...snapshot.s, clears: goalOf(snapshot.s) }
                : s;

            // Everything the settlement decided, said out loud. The outcome is structured data —
            // `reason: 'ratts'`, `opened: 3` — and this is where it becomes Watto.
            const { flavor, lines: said } = outcomeProse(settled, { bribed, breaker });

            // A shatter is the one special-cube effect that gets said out loud, because it's the
            // only one that changes what the *next* roll can do — the cube is off the table for
            // the rest of the climb, and a player who wasn't told would just find a loadout
            // quietly short. Everything else the specials did is left to be read off the cubes.
            const shattered = settled.shattered.map(specialById).filter(Boolean);
            const lines = [
                ...extra,
                ...(shattered.length
                    ? [`${wipeout} **${shattered.map(sp => sp.name).join('**, **')}** shattered`
                        + `${settled.ladder
                            ? ` — the table is ${shattered.length > 1 ? `**${shattered.length}** cubes` : 'a cube'} shorter for the rest of the climb`
                            : ''}.`]
                    : []),
                ...said,
            ];

            // The payout frame draws the *resolved* line, so the cubes the count was taken over
            // are the cubes on screen — a special that rearranged the line leaves what it left.
            // Watto's tie-breaker stays beside it face-up, because it decided the roll and belongs
            // in the picture of how the roll ended. A tie he was paid off for shows no cube at
            // all: he never rolled one.
            const glyphs = res.faceIds.map(faceGlyph);
            const resolved = faces(glyphs, glyphs.length);
            const finalFrame = paying(
                breaker ? withBreaker(resolved, breaker) : resolved,
                flavor, lines, settled.outcome === 'bust' ? 'bust' : settled.outcome,
                after, settled.won ? 'win' : 'bust',
            );
            // A bust with a reroll in the bank keeps the run on file so the offer on this screen
            // has something to replay. The bust itself is already fully settled, so letting the
            // offer lapse leaks nothing.
            if (settled.outcome === 'bust' && s.rerolls > 0) {
                // Stored with the cubes **as they were thrown**, because a reroll picks up that same
                // table and throws it again rather than drawing a new one.
                saveDead({
                    ...run, set: encodeSet(thrown.set), bag: encodeSet(thrown.bag),
                    spent: run.spent || [], dead: true,
                    faces: res.faceIds, roll: settled.cubes, flavor, lines,
                });
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

            return announce(channelNote(settled));
        }

        // ---- saying what happened -------------------------------------------

        // Turns a settled throw into Watto's verdict and the lines under it. Everything it reads is
        // structured — a reason, a profit, a level index — so the same settlement can be narrated
        // completely differently by the Activity without either client owning the rules.
        function outcomeProse(settled, { bribed, breaker }) {
            if (settled.outcome === 'bust') {
                // Four ways to lose, and Watto has a line for each — but only the line. What the
                // cubes did to get there is on the table for the player to read.
                const flavor = settled.reason === 'cackle'
                    ? `${WattoLOL} ${watto('cackle')}`
                    : watto(settled.reason === 'ratts' ? 'ripratts' : settled.reason);
                return { flavor, lines: [lostLine(settled.lostStake, settled.lostStanding)] };
            }

            const lines = [];
            // A tie is the one win with a bigger story than the rung it happened on: losing one has
            // to sound like the house winning, so winning one has to sound like the house losing.
            // A pure can't collide with either — a tied line has no majority in it, so it can never
            // be swept.
            //
            // Under the road, a win is one of five things and Watto has a different mood for each:
            // he grudges a level, he *hates* an Again coming off your road, he pays out at the top,
            // and he is delighted when somebody keeps rolling past it for nothing.
            const flavor = watto(
                settled.pure ? 'pure'
                    : breaker ? 'tiewin'
                        : bribed ? 'bribe'
                            : settled.prestigeOffered ? 'final'
                                : settled.opened != null ? 'opened'
                                    : settled.clear ? 'again'
                                        : settled.atTop ? 'overtime'
                                            : 'win',
            );
            // A pure is called out and pays nothing extra, which is the whole joke — it used to take
            // a share of the pot and Watto's `pure` lines were written for the tier that didn't.
            if (settled.pure) {
                lines.push(`✨ **PURE CUBE** — all ${settled.cubes.length} landed ${chip(settled.majority)}.`);
            }

            // A gap just filled. Either two more cubes hit the table — and the run pushes straight
            // into the level it opened — or, at the top, the prestige was earned. Both are said
            // here because both change what the *next* rung is, which is the decision on screen.
            if (settled.opened != null) lines.push(openedLine(settled.opened));
            if (settled.prestigeOffered || settled.opened != null) lines.push(nextUnlockLine(s));
            lines.push(choiceLine(settled.ladder.stake, settled.records.standing,
                settled.mult, settled.next));
            return { flavor, lines };
        }

        // The channel only hears about one thing now: clearing the top of the ladder. The board is
        // public and the whole channel is already watching every roll, so an announcement has to
        // earn its ping — this used to have a second trigger, a Pure Cube taking a bite out of a
        // jar everyone had been feeding, and the jar is gone. A pure is still called out on the
        // board itself, where the people watching it already are.
        function channelNote(settled) {
            // Surviving Level 5 is what the top of the road is now — it earns the prestige and the
            // run is still standing, so this fires on the roll that did it rather than on a bank
            // that no longer happens.
            if (settled.prestigeOffered) {
                return `${LEVELS[MAX_LEVEL].emoji} **${member_name}** survived **${LEVELS[MAX_LEVEL].name}** for **${tg(settled.standing)}** — **Prestige ${s.prestige + 1}** is theirs.`;
            }
            return null;
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

            // His cube or his price. The price is worked out from the stored standing rather than
            // taken from the button, so a screen left open across a prestige can't buy a tie at
            // yesterday's rate.
            const answered = actions.answerTie(ctx(), { buying });
            if (!answered.ok) {
                if (answered.code === 'insufficient') {
                    return interaction.reply({
                        embeds: [errorEmbed('Not enough truguts',
                            `Watto wants ${tg(answered.cost)} for that tie and you only have ${tg(answered.balance)}. Rolling his cube is free.`)],
                        ephemeral: true,
                    });
                }
                return refreshStale();
            }
            const bribed = answered.bribed;

            // Off the node and the turn bumped before anything settles, so a tie can only ever be
            // answered once — the same job the turn counter does for a double-clicked call.
            clearLadder();
            bumpTurn();

            // The roll the tie was parked on, rebuilt from the stored node. **Nothing is thrown
            // again** — the cubes already landed, and the only new information is which way the tie
            // went. `answerTie` did the reconstruction, because the Activity needs exactly the same
            // one and a second copy of it is a second way to hand the player a different roll.
            const { thrown, reverse } = { thrown: answered.thrown, reverse: answered.reverse };
            const { run, res, base, breaker } = thrown;
            const snapshot = { balance: balanceOf(user_profile), s: { ...s } };
            const row = res.faceIds.map(faceGlyph);
            const resolved = faces(row, row.length);

            // The answer is in, so the buttons come off — and this press is also what acknowledges
            // the interaction, which every frame after it edits. Bribing pockets the cube on the
            // spot; rolling leaves it face-down for one more beat.
            await render(payload(frameFactory(run, base, row.length, false, false, res.held)(
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
                    const draw = frameFactory(
                        run, step.multiple, row.length, false, false, res.held,
                    );
                    const marked = facesMarked(row, step.at);
                    return () => draw(
                        breaker ? withBreaker(marked, breaker) : marked,
                        null, [renderNote(step.note)], null, snapshot.s, null,
                    );
                });

            return settleRoll({
                thrown, bribed, reverse, snapshot,
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


        async function doBank(turnArg) {
            if (stale(turnArg)) return refreshStale();
            // Read before banking, because banking clears it and the screen still has to draw the
            // run that was cashed out.
            const ladder = ladderOf(db, member_id);
            const banked = actions.bank(ctx());
            if (!banked.ok) return refreshStale();
            bumpTurn();

            await render(payload({
                levelIdx: ladder.level,
                again: Number(ladder.again) || 0,
                bar: s,
                multiple: Number(ladder.mult) || LEVELS[ladder.level].payout,
                context: contextLine(ladder.call, ladder.stake, Number(ladder.mult) || 0, 'win'),
                faces: storedFaces(ladder),
                outcome: 'bank',
                flavor: watto('bank'),
                lines: [wonLine(banked.profit)],
            }, buttons(null, true)));

            return announce(bankNote(banked.standing, banked.level));
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
// Shared with the Activity's entry-point command, so a player who hasn't built a cube gets the
// same answer whichever way they come at it.
module.exports.lockedEmbed = lockedEmbed;
