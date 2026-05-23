const { adminView, matchSelector, matchSummaryView, matchIntroductionView, preRaceView, warmupView, inRaceView, postRaceView, setupMatchView, scheduledMatchView, submitRunModal, pickRacerModal, countDown, verifyModal, verifyRunModal, postMatchView, rewindView, collapsedView, resolvedStepSummary, annotateLeaderboard } = require('./functions.js')
const { requestWithUser, axiosClient: axios } = require('../../axios.js')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, EmbedBuilder, MessageFlags } = require('discord.js')
const { time_to_seconds } = require('../../generic.js')
const { WhyNobodyBuy, emojimap } = require('../../data/discord/emoji.js')
const { getMatch } = require('./matchApi.js')
const { tournamentsRulesetsCache, leaderboardCache } = require('../../services/tourneyCache.js')

// Pull the annotated leaderboard for the match's current race. Returns []
// gracefully on any failure so a leaderboard outage never blocks rendering.
async function getAnnotatedLeaderboard(match, userSnapshot) {
    const race = match?.races?.[match?.currentRace]
    if (!race?.track) return []
    try {
        // Send the merged conditions object — defaults under race-level overrides — so the
        // server can run its own conditionsMatch() against each candidate race. Same merge
        // strategy used elsewhere (see getRaceDescription in functions.js).
        const mergedConditions = { ...(match.ruleset?.defaultConditions || {}), ...(race.conditions || {}) }
        const runs = await leaderboardCache.getLeaderboard({
            track: race.track,
            conditions: mergedConditions,
            userSnapshot,
        })
        return annotateLeaderboard({
            runs,
            racerBans: race.racerBans,
            currentPlayers: Object.values(match.players || {}),
            podOverride: race.racer,
            currentTournamentId: match.tournament,
        })
    } catch (e) {
        return []
    }
}

const STATE_SCHEDULED = 0
const STATE_MATCH_SETUP = 1;
const STATE_PRE_RACE = 2;
const STATE_WARMUP = 3;
const STATE_IN_RACE = 4;
const STATE_POST_RACE = 5;
const STATE_POST_MATCH = 6;
const STATE_CANCELLED = 99;

async function errorOut(interaction, error) {
    await interaction.followUp({ content: error, ephemeral: true })
}

function placeholderView(text) {
    return [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))]
}

// Identifies the "step" a match is currently on. When this changes, the previous
// message becomes a stale event in the trail and we post a fresh one for the new step.
function stepKey(match) {
    if (!match) return null
    const race = match.races?.[match.currentRace]
    const ids = (race?.activeEvents ?? []).map(e => e.id).slice().sort().join(',')
    return `${match.status}:${match.currentRace}:${ids}`
}

// Race a getMatch call against a tight timeout so a modal-show path can pre-fill from
// authoritative API state without breaking Discord's 3-second modal-show deadline. Returns
// the freshest match available (refreshed when API responds in time, otherwise the cached
// fallback). Also writes the refreshed match into the channel cache as a side effect.
async function refreshMatchForModal(client, channelId, fallback, userSnapshot, timeoutMs = 2700) {
    if (!fallback?.id) return fallback
    try {
        // Direct unauthenticated GET — fast, no writeBack cycle. The API's getOne respects
        // the cache, but writes invalidate, so this returns whatever the most recent writer
        // (bot or web) just persisted.
        const result = await Promise.race([
            axios.get(`/matches/${fallback.id}`, { timeout: timeoutMs }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('modal-refresh timeout')), timeoutMs))
        ])
        const fresh = result?.data?.data
        if (fresh && fresh.id) {
            client.channelToMatch.set(channelId, fresh)
            return fresh
        }
    } catch (e) {
        console.warn('[tourney] modal-show refresh failed, using cached match:', e?.message)
    }
    return fallback
}

// Render the previous match state as a read-only V2 view (buttons stripped) for the
// trail's leave-behind. Only the in-race-side states have a meaningful read-only render;
// other transitions fall back to a one-line summary at the call site.
//
// For POST_RACE, we use newMatch's race data (at the prev race index) so the final
// verifications applied during this interaction — including the one that triggered the
// race advance — show up in the leftover. prevMatch was snapshotted BEFORE the API call
// so it doesn't have the latest run.verified flags.
function prevStateReadOnlyView(prevMatch, newMatch, client) {
    if (!prevMatch) return null
    switch (prevMatch.status) {
        case STATE_WARMUP:
            return warmupView({ match: prevMatch, client, readOnly: true })
        case STATE_IN_RACE:
            return inRaceView({ match: prevMatch, client, readOnly: true })
        case STATE_POST_RACE: {
            const sourceMatch = newMatch ?? prevMatch
            const renderMatch = sourceMatch.races?.[prevMatch.currentRace]
                ? { ...sourceMatch, currentRace: prevMatch.currentRace }
                : prevMatch
            return postRaceView({ match: renderMatch, client, readOnly: true })
        }
        default:
            return null
    }
}

// True when `userId` (a discord id) is allowed to submit a run on behalf of `targetPlayer`.
// Racers can only submit their own; commentators and trackers can submit for anyone.
function canSubmitForPlayer({ match, userId, targetPlayer }) {
    if (!targetPlayer) return true
    if (targetPlayer.discordId == userId) return true
    const isCommentator = (match?.commentators ?? []).some(c => c?.discordId == userId)
    const isTracker = (match?.trackers ?? []).some(t => t?.discordId == userId)
    return isCommentator || isTracker
}

// API error messages that indicate the message the user clicked references an old
// match state (events have advanced since this Discord message was rendered, or the
// bot's cache fell behind the API). Detected so we can recover by re-fetching state
// and rendering the current step.
// Note: "Unexpected player" is intentionally NOT here — the API throws it when the
// wrong user tries to act (validateEvent/nextEvents in matchService), which is a
// genuine permission error that should surface to the user, not a silent refresh.
function isStaleStateError(err) {
    const msg = err?.message || ''
    return /Event not found in active events|There are no active events|invalid action for current match status/i.test(msg)
}

// Find events that were active in prevMatch but have since resolved into race.events.
function findResolvedEvents(prevMatch, newMatch) {
    if (!prevMatch || !newMatch) return []
    const prevRace = prevMatch.races?.[prevMatch.currentRace]
    const prevActiveIds = new Set((prevRace?.activeEvents ?? []).map(e => e.id))
    if (!prevActiveIds.size) return []
    const allNewEvents = (newMatch.races ?? []).flatMap(r => r.events ?? [])
    return allNewEvents.filter(e => prevActiveIds.has(e.id))
}

// Best-effort summary for state transitions that don't resolve any events
// (start-match, race advance, countdown finish, results submission, etc.).
// Returns a markdown line for the collapsed prior message, or '' to fall through.
function transitionFallbackSummary(prevMatch, newMatch) {
    if (!prevMatch || !newMatch) return ''
    const prev = prevMatch.status
    const next = newMatch.status
    if (prev === STATE_MATCH_SETUP && next !== STATE_MATCH_SETUP) {
        return '-# 🏁 Match started.'
    }
    if (next === STATE_POST_MATCH) {
        return '-# 🏆 Match concluded.'
    }
    if (prev === STATE_POST_RACE && newMatch.currentRace > prevMatch.currentRace) {
        return `-# 🏁 Race ${prevMatch.currentRace + 1} closed.`
    }
    if (prev === STATE_WARMUP && next === STATE_IN_RACE) {
        return `-# 🚦 Race ${newMatch.currentRace + 1} begins.`
    }
    if (prev === STATE_IN_RACE && next === STATE_POST_RACE) {
        return `-# 📝 Results submitted.`
    }
    if (next === STATE_CANCELLED) {
        return '-# Match cancelled.'
    }
    return ''
}

// Retry an async fn a few times with a small delay between attempts. Used for cosmetic
// follow-up edits (e.g. collapsing the previous step) where a transient Discord connect
// timeout shouldn't leave us with stale clickable buttons. The fn must be idempotent.
async function withRetry(fn, { attempts = 3, delayMs = 2000 } = {}) {
    let lastErr
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn()
        } catch (err) {
            lastErr = err
            if (i < attempts - 1) {
                await new Promise(r => setTimeout(r, delayMs))
            }
        }
    }
    throw lastErr
}

// Discord's IsComponentsV2 flag is sticky per message — set at creation and immutable.
// A component interaction on a pre-V2 message cannot be edited into V2; we have to send a fresh V2 message and clear the old one.
// Same problem applies to chat-input commands: deferReply's IsComponentsV2 flag is not reliably
// honored on the deferred placeholder, so editReply'ing it with a Container fails with
// "components[0] type must be one of (1,)" — clean up the placeholder and send a fresh V2 message instead.
async function renderV2(interaction, view) {
    const original = interaction.message
    const isLegacyOriginal = original && !original.flags?.has(MessageFlags.IsComponentsV2)
    if (isLegacyOriginal || !original) {
        try {
            if (isLegacyOriginal) {
                await interaction.editReply({ content: '-# *Reposting in new layout below…*', embeds: [], components: [] })
            } else {
                await interaction.deleteReply()
            }
        } catch (e) {
            console.warn('[tourney] failed to clear placeholder during V2 send', e)
        }
        return interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
    }
    return interaction.editReply({ components: view })
}

async function defferInteraction(interaction, deferred, command, ephemeral = false, client, userId, userSnapshot) {
    if (deferred) {
        return 0
    }

    deferred = true
    match = client.channelToMatch.get(interaction.channel.id)
    // handle modals up front using cached match since discord does not allow us to defer modals
    // we need to defer interaction responses because a cold api takes too long
    if (!interaction.isModalSubmit() && ['submitRun', 'submitDnf', 'verifyResults', 'verifyRun', 'pickRacer'].includes(command) && match) {
        // Pull fresh state from the API so the modal pre-fills against current run data.
        // The cache can lag when other users update runs concurrently — e.g., player updates
        // their submission while a commentator opens the verify modal — and modals can't be
        // refreshed once shown. Tight timeout keeps us inside Discord's 3-second modal-show
        // deadline; on timeout we fall back to the cached match.
        match = await refreshMatchForModal(client, interaction.channel.id, match, userSnapshot)
        switch (command) {
            case 'submitRun':
            case 'submitDnf': {
                const race = match?.races?.[match.currentRace]
                // If a player.id is encoded in the customId (per-row Submit buttons), target
                // that player; otherwise fall back to the clicker's own player record so the
                // global DNF button still works.
                const targetPlayerId = interaction.customId.split(':')[0].split('_').slice(3).join('_') || null
                const matchPlayer = targetPlayerId
                    ? match.players?.find(p => p.id == targetPlayerId)
                    : match.players?.find(p => p.discordId == userId)
                if (!canSubmitForPlayer({ match, userId, targetPlayer: matchPlayer })) {
                    await interaction.reply({
                        content: 'Only the racer themselves or a commentator/tracker can submit this run.',
                        ephemeral: true
                    })
                    return 1
                }
                const existingRun = matchPlayer
                    ? race?.runs?.find(r => r.player.id == matchPlayer.id)
                    : null
                // race.racer is a forced override — preselect it in the run modal so the
                 // player doesn't have to retype it, but still let them edit at submit time.
                 const warmupRacer = matchPlayer ? (race?.racer || race?.players?.[matchPlayer.id]?.selectedRacer) : null
                const runModal = submitRunModal({
                    currentRace: match?.currentRace,
                    run: existingRun,
                    selectedRacer: warmupRacer,
                    dnf: command === 'submitDnf',
                    targetPlayerId: matchPlayer?.id ?? null,
                    targetUsername: matchPlayer?.username ?? null
                })
                await interaction.showModal(runModal)
                return 1
            }
            case 'verifyResults':
                const verifyM = verifyModal({ match })
                if (!verifyM) {
                    // verifyModal returns null when race.runs is empty — Discord would
                    // otherwise reject the modal with ExpectedConstraintError (≥1 row).
                    await interaction.reply({
                        content: 'No runs have been submitted for this race yet — nothing to verify.',
                        ephemeral: true
                    })
                    return 1
                }
                await interaction.showModal(verifyM)
                return 1
            case 'verifyRun': {
                const playerId = interaction.customId.split(':')[0].split('_').slice(3).join('_')
                const verifyRunM = verifyRunModal({ match, playerId })
                await interaction.showModal(verifyRunM)
                return 1
            }
            case 'pickRacer': {
                const targetPlayerId = interaction.customId.split(':')[0].split('_').slice(3).join('_') || null
                const matchPlayer = targetPlayerId
                    ? match.players?.find(p => p.id == targetPlayerId)
                    : match.players?.find(p => p.discordId == userId)
                if (!canSubmitForPlayer({ match, userId, targetPlayer: matchPlayer })) {
                    await interaction.reply({
                        content: 'Only the racer themselves or a commentator/tracker can pick this racer.',
                        ephemeral: true
                    })
                    return 1
                }
                const race = match.races[match.currentRace]
                const playerStatus = race?.players?.[matchPlayer.id]
                const pickModal = pickRacerModal({
                    currentRace: match.currentRace,
                    currentRacer: playerStatus?.selectedRacer ?? null,
                    isShown: !!playerStatus?.racerShown,
                    targetPlayerId: matchPlayer.id,
                    targetUsername: matchPlayer.username,
                    racerBans: race?.racerBans ?? []
                })
                await interaction.showModal(pickModal)
                return 1
            }
        }
    } else if (interaction.isChatInputCommand()) {
        if (ephemeral) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
        } else {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 })
        }
    } else {
        await interaction.deferUpdate()
    }

    return 0
}

function isCountdownActive(client, interaction, raceStart) {
    if (!raceStart) {
        return false
    }

    const match = client.channelToMatch.get(interaction.channel.id)
    if (!match) {
        return false
    }

    const currentRace = match.races[match.currentRace]
    return raceStart === currentRace?.raceStart
}

exports.play = async function ({ client, interaction, args, userSnapshot } = {}) {
    const messageIsEphemeral = interaction.message?.flags.has(MessageFlags.Ephemeral)
    const selection = interaction.values ?? []
    // Strip any ":<nonce>" suffix some modal customIds carry to defeat Discord's
    // per-customId input cache (see verifyModal / verifyRunModal in functions.js).
    const command = args[1]?.split(':')[0]
    let deferred = false

    // Bot just restarted and the match cache hasn't populated yet. Tell the user to hold
    // off rather than letting the lazy /matches lookup race against the cold-start API
    // (which can take longer than the axios timeout and leave the live match orphaned in
    // the matchSelector flow). Skipped for chat commands so /tourney play still works
    // — that path posts the selector by design. Also skipped for the matchSelector's own
    // interactions (Select button and dropdown change): the user is explicitly creating
    // or picking a match, so there's no live match to orphan.
    const isSelectorFlow = command === 'bindMatch' || (!command && interaction.isStringSelectMenu?.())
    if (!client.matchCacheHydrated && !interaction.isChatInputCommand() && !interaction.isModalSubmit() && !isSelectorFlow) {
        try {
            await interaction.reply({
                content: '-# *⏳ Bot just restarted — give it a few seconds to catch up, then try again.*',
                ephemeral: true
            })
        } catch (_) { /* interaction may already be acknowledged elsewhere */ }
        return
    }

    let match = client.channelToMatch.get(interaction.channel.id)
    // snapshot state BEFORE any API calls so we can diff to detect step changes
    const prevMatch = match ? JSON.parse(JSON.stringify(match)) : null
    let meta = {
        message: ""
    }

    // bind match
    if (args[1] == 'bindMatch') {
        if (args[2] == 'submit') {
            //validate match selection. The match selector lives inside a V2 Container, so the
            //old `components[0].components[0]` lookup doesn't work — walk the tree to find the
            //StringSelectMenu and read its default option.
            const findSelectMenuOptions = (nodes) => {
                for (const node of nodes ?? []) {
                    if (node?.type === 3 /* ComponentType.StringSelect */ && Array.isArray(node?.options)) {
                        return node.options
                    }
                    const inner = findSelectMenuOptions(node?.components)
                    if (inner) return inner
                }
                return null
            }
            const options = findSelectMenuOptions(interaction.message.components)
            const selection = options?.find(o => o?.default == true)?.value
            if (!selection) {
                await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true })
                return
            }

            // Cold-start API calls below can exceed Discord's 3-second interaction ack
            // window. Defer before any HTTP request so we don't lose the interaction.
            await interaction.deferUpdate()
            deferred = true

            //create new match
            if (selection == 'new') {
                try {
                    const newRes = await requestWithUser({
                        method: 'post',
                        url: `/matches`,
                        userSnapshot,
                        data: {
                            channelId: interaction.channel.id,
                            status: STATE_MATCH_SETUP
                        },
                    })

                    match = newRes.data
                    meta = newRes.meta ?? meta
                    client.channelToMatch.set(interaction.channel.id, match)
                } catch (err) {
                    await interaction.followUp({ content: `${WhyNobodyBuy}${err.message}`, ephemeral: true })
                    return
                }

                //set match
            } else {
                let matchId = selection;

                ({ match, meta, error } = await getMatch(matchId, userSnapshot))
                client.channelToMatch.set(interaction.channel.id, match)
                if (!match) {
                    await interaction.followUp({ content: `${WhyNobodyBuy} Couldn't get match\n${error}`, ephemeral: true })
                    return
                }
            }
        } else {
            match = null
            client.channelToMatch.set(interaction.channel.id, null)
        }

    }

    // select match when unbound
    if (!match) {
        const d = await defferInteraction(interaction, deferred, command, false, client, userSnapshot.id, userSnapshot)
        if (d) {
            return
        }
        deferred = true

        // Fetch the 24 most-recent non-completed matches (the dropdown's max anyway), sorted
        // by displayDate desc server-side. Previously this pulled every match in the DB —
        // hundreds of completed ones included — which routinely tripped the 20s timeout and
        // ballooned the response payload. Filtering to status_in 0..5 (scheduled through
        // post-race) and letting Firestore sort by the denormalized displayDate field
        // (scheduledStart ?? createdAt) keeps the response small and uses the existing
        // status + displayDate composite index. Cached briefly so rapid clicks
        // (dropdown change → Select button) don't each re-fetch the same list.
        let matches = []
        let matchesFetchFailed = false
        const cached = client.matchesListCache
        if (cached && cached.expiresAt > Date.now()) {
            matches = cached.matches
        } else {
            try {
                const res = await axios.get('/matches', {
                    params: {
                        status_in: '0,1,2,3,4,5',
                        _limit: 24,
                        _sort: 'displayDate',
                        _order: 'desc',
                    },
                    timeout: 10_000,
                })
                matches = res.data?.data ?? []
                client.matchesListCache = { matches, expiresAt: Date.now() + 10_000 }
            } catch (err) {
                console.error('[tourney] /matches lookup failed:', err.message)
                matchesFetchFailed = true
            }
        }

        // Lazy-hydrate cache for component interactions on stale messages (e.g. after bot restart).
        // Skipped for the matchSelector dropdown itself (customId 'tourney_play', no subcommand)
        // since picking an option there shouldn't restore an in-progress match — the user is
        // explicitly choosing a different match (or "New Match"). Without this guard, picking
        // "New Match" in the dropdown would re-bind the channel's existing in-progress match
        // and render its view instead of letting the user confirm with the Select button.
        const isMatchSelectorChange = !command && interaction.isStringSelectMenu?.()
        if (!interaction.isChatInputCommand() && args[1] != 'bindMatch' && !isMatchSelectorChange) {
            const candidate = matches.find(m => m.channelId === interaction.channel.id && ![STATE_CANCELLED, STATE_POST_MATCH].includes(m.status))
            if (candidate) {
                match = candidate
                client.channelToMatch.set(interaction.channel.id, match)
            }
        }

        if (!match) {
            let selected = interaction.values ?? []
            const matchRow = matchSelector({ matches: matches.filter(match => ![STATE_CANCELLED, STATE_POST_MATCH].includes(match.status)), selected })
            const headerText = matchesFetchFailed
                ? 'Please select a match.\n-# *⚠️ Could not reach the match service — only "New Match" is available right now. Try again in a moment.*'
                : 'Please select a match.'
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
                .addActionRowComponents(matchRow)
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("tourney_play_bindMatch_submit")
                            .setLabel("Select")
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(selected.length == 0)
                    )
                )

            await renderV2(interaction, [container])
            return
        }
    }

    // admin menu
    if (interaction.isChatInputCommand()) {
        ({ match, meta } = await getMatch(match.id, userSnapshot))
        if (!match) {
            await interaction.reply({ content: `${WhyNobodyBuy} Couldn't get match`, ephemeral: true })
            return
        }
        await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: adminView({ match }) })
        return
    }

    const d = await defferInteraction(interaction, deferred, command, false, client, userSnapshot.id, userSnapshot)
    if (d) {
        return
    }


    switch (command) {
        case 'repost':
            // Manual recovery from the admin view: refetch fresh match state and post a new
            // step message in the channel. Doesn't collapse the admin message — special-cased
            // below so the operator can keep using the manager.
            try {
                const refreshed = await getMatch(match.id, userSnapshot)
                if (!refreshed.match) {
                    await errorOut(interaction, `${WhyNobodyBuy} Could not refresh match state.`)
                    return
                }
                match = refreshed.match
                meta = refreshed.meta ?? meta
            } catch (err) {
                await errorOut(interaction, `${WhyNobodyBuy} Could not refresh match state: ${err.message}`)
                return
            }
            break
        case 'rewindMatch':
            if (interaction.isStringSelectMenu()) {
                try {
                    const setupRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${match.id}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'rewindMatch',
                                    rewindTo: selection[0]
                                }
                            ],
                        },
                    })

                    match = setupRes.data
                    meta = setupRes.meta ?? meta
                } catch (err) {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            } else {
                ({ match, meta } = await getMatch(match.id, userSnapshot))
                if (!match) {
                    await errorOut(interaction, `${WhyNobodyBuy} Couldn't get match`)
                    return
                }
                await renderV2(interaction, rewindView({ match }))
                return
            }
            break
        case 'nextEvents':
        case 'abortCountdown':
        case 'selectRacer':
        case 'revealRacer':
        case 'markReady':
        case 'markUnready':
        case 'restartRace':
        case 'setTournament':
        case 'setPhase':
        case 'setDivision':
        case 'setRound':
        case 'setRuleset':
            if (selection[0]?.startsWith('page_')) {
                break
            }
        case 'setup':
        case 'setupStart':
        case 'setupJoin':
        case 'setupLeave':
        case 'setupCommentate':
        case 'setupCancel':
            try {
                const setupRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${match.id}/submitAction`,
                    userSnapshot,
                    data: {
                        actions: [
                            {
                                name: command,
                                payload: selection[0]
                            }
                        ],
                    },
                })

                match = setupRes.data
                meta = setupRes.meta
            } catch (err) {
                if (isStaleStateError(err)) {
                    console.log(`[tourney] stale ${command}; refreshing match state`)
                    const refreshed = await getMatch(match.id, userSnapshot)
                    if (refreshed.match) {
                        match = refreshed.match
                        meta = refreshed.meta ?? meta
                        await interaction.followUp({ content: '-# *That message was outdated — see the current step below.*', ephemeral: true }).catch(() => { })
                    } else {
                        await errorOut(interaction, `${WhyNobodyBuy} Could not refresh match state.`)
                        return
                    }
                } else {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            }

            // Announce abortCountdown so the channel knows who interrupted the countdown.
            // Fire-and-forget — the warmup view itself just edits in place (no step change).
            if (command === 'abortCountdown') {
                interaction.channel.send({
                    content: `-# 🛑 ${userSnapshot.username} aborted the countdown.`
                }).catch(err => {
                    console.warn('[tourney] failed to post abortCountdown notice', err?.message || err)
                })
            }

            break
        case 'submitEvent':
            const eventId = args[2]
            const isActivation = selection.length === 1 && selection[0] === '__activate__'
            // Cleared select on an already-activated deferChoice row → undo the activation.
            const activeEvent = match?.races?.[match.currentRace]?.activeEvents?.find(e => e.id === eventId)
            const isDeactivation = !selection.length && !!activeEvent?.deferChoice && !!activeEvent?.activated

            let actions = [
                {
                    name: 'submitEvent',
                    event: isActivation
                        ? { id: eventId, activated: true, selection: [] }
                        : isDeactivation
                            ? { id: eventId, activated: false, selection: [] }
                            : {
                                id: eventId,
                                selection: selection.map(id => ({ id })),
                            },
                }
            ]

            // FIXME: this is a hack to auto-advance the match when a color is selected
            if (['red', 'blue'].includes(selection[0])) {
                actions.push({
                    name: 'nextEvents'
                })
            }

            try {
                const eventRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${match.id}/submitAction`,
                    userSnapshot,
                    data: { actions },
                })

                match = eventRes.data
                meta = eventRes.meta

            } catch (err) {
                if (isStaleStateError(err)) {
                    // The clicked message references events that no longer exist (state advanced
                    // out from under us, e.g. bot crashed mid-transition). Refresh and let the
                    // trail-block render the current step.
                    console.log('[tourney] stale submitEvent; refreshing match state')
                    const refreshed = await getMatch(match.id, userSnapshot)
                    if (refreshed.match) {
                        match = refreshed.match
                        meta = refreshed.meta ?? meta
                        await interaction.followUp({ content: '-# *That message was outdated — see the current step below.*', ephemeral: true }).catch(() => { })
                    } else {
                        await errorOut(interaction, `${WhyNobodyBuy} Could not refresh match state.`)
                        return
                    }
                } else {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            }

            break
        case 'submitRun':
        case 'submitDnf':

            if (interaction.isModalSubmit()) {
                const isDnfSubmission = command === 'submitDnf'
                const submittedTime = isDnfSubmission ? '' : interaction.fields.getTextInputValue('time').trim()
                const deathsSelection = interaction.fields.getStringSelectValues?.('deaths') ?? []
                const deathsRaw = deathsSelection[0]
                const submittedDeaths = !deathsRaw || deathsRaw === 'unsure' ? '' : Number(deathsRaw)
                const dnf = isDnfSubmission || submittedTime.toLowerCase() == 'dnf'

                //validate submission (only for non-DNF — DNF skips time validation entirely)
                if (!dnf && time_to_seconds(submittedTime) == null) {
                    const holdUp = new EmbedBuilder()
                        .setTitle(`${WhyNobodyBuy} Time Does Not Compute`)
                        .setDescription("Your time was submitted in an incorrect format.")
                    await interaction.reply({ embeds: [holdUp], ephemeral: true })
                    return
                }

                //submit time
                const racerSelection = interaction.fields.getStringSelectValues?.('racer') ?? []
                const run = {
                    time: dnf ? 0 : Number(time_to_seconds(submittedTime)),
                    notes: interaction.fields.getTextInputValue('notes').trim(),
                    dnf,
                    racer: racerSelection[0] ?? ''
                }
                // Only include deaths when the user gave a concrete answer; the API's runSchema
                // is `Joi.number()` and rejects empty strings. Omitting it leaves the field
                // unset, which the bot already renders as "💀×?".
                if (submittedDeaths !== '') {
                    run.deaths = submittedDeaths
                }

                // The modal customId encodes the target player.id when submitting on behalf of
                // a racer (per-row Submit). When set, attach run.player so the API attributes
                // the run correctly even though the submitter isn't the racer.
                const targetPlayerId = interaction.customId.split(':')[0].split('_').slice(3).join('_') || null
                const target = targetPlayerId ? match.players?.find(p => p.id == targetPlayerId) : null
                if (!canSubmitForPlayer({ match, userId: userSnapshot.id, targetPlayer: target })) {
                    await interaction.reply({
                        content: 'Only the racer themselves or a commentator/tracker can submit this run.',
                        ephemeral: true
                    })
                    return
                }
                if (target) {
                    run.player = target
                }

                try {
                    const eventRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${match.id}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'submitRun',
                                    run
                                }
                            ]
                        },
                    })

                    match = eventRes.data
                    meta = eventRes.meta

                } catch (err) {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            }
            break
        case 'verifyResults':
            const res = await axios.get(`/matches/${match.id}`)
            match = res.data?.data

            if (interaction.isModalSubmit()) {
                // Parse the race index embedded in the modal customId
                // (`verifyResults:${raceIdx}:${nonce}`). If the match has since advanced
                // to a different race, the modal's pre-filled run metadata (racer,
                // notes, submittedAt) belongs to a DIFFERENT race than the API now
                // points at — submitting would overwrite the new race's slot with
                // stale per-run metadata. Refuse instead, so the user can re-open
                // the verify modal against the current race.
                //
                // Modals built before this fix don't have a race index; for those we
                // fall back to match.currentRace (the previous behavior).
                const args1Parts = (args[1] || '').split(':')
                const hasRaceIdx = args1Parts.length >= 3 && /^\d+$/.test(args1Parts[1])
                const modalRaceIdx = hasRaceIdx ? Number(args1Parts[1]) : null

                if (modalRaceIdx != null && modalRaceIdx !== match.currentRace) {
                    await errorOut(interaction,
                        `${WhyNobodyBuy} This verify form was for Race ${modalRaceIdx + 1}, but the match has moved on to Race ${match.currentRace + 1}. Open the verify modal again from the current race.`
                    )
                    return
                }

                const raceIdx = modalRaceIdx ?? match.currentRace
                const race = match.races?.[raceIdx]
                if (!race) {
                    await errorOut(interaction, `${WhyNobodyBuy} Could not find race ${raceIdx + 1} to verify.`)
                    return
                }
                const runs = race.runs

                // Iterate runs from the fresh match. A run might be present here that wasn't in
                // the modal (player submitted after modal-show); getTextInputValue would throw on
                // a missing customId, so guard with try/catch and skip — the API will preserve
                // the existing value for unsent runs. Skipping unsubmitted players also avoids
                // dereferencing undefined `run` for a player who hasn't submitted yet.
                let skippedRuns = 0
                runs.forEach(run => {
                    let submittedTime, submittedDeaths
                    try {
                        submittedTime = interaction.fields.getTextInputValue(`${run.player.id}_time`).trim()
                        submittedDeaths = interaction.fields.getTextInputValue(`${run.player.id}_deaths`).trim()
                    } catch (e) {
                        skippedRuns++
                        return
                    }
                    const dnf = submittedTime.toLowerCase() == 'dnf'
                    run.time = dnf ? 0 : time_to_seconds(submittedTime)
                    run.dnf = dnf
                    // Only overwrite deaths when the verifier gave a concrete answer; leaving the
                    // field blank should preserve the existing value (including "unknown") instead
                    // of clobbering it to 0 (Number("") is 0, which is misleading).
                    if (submittedDeaths !== '' && !isNaN(Number(submittedDeaths))) {
                        run.deaths = Number(submittedDeaths)
                    }
                })
                if (skippedRuns > 0) {
                    await interaction.followUp({
                        content: `-# *⚠️ ${skippedRuns} run${skippedRuns === 1 ? ' was' : 's were'} added after you opened this form and couldn't be verified here. Click Verify again to include ${skippedRuns === 1 ? 'it' : 'them'}.*`,
                        ephemeral: true
                    }).catch(() => { })
                }

                try {
                    const eventRes = await requestWithUser({
                        method: 'post',
                        url: `/matches/${match.id}/submitAction`,
                        userSnapshot,
                        data: {
                            actions: [
                                {
                                    name: 'verifyResults',
                                    // Pass the race index so the API can reject the action if its
                                    // currentRace has shifted since the modal was opened — defense
                                    // in depth alongside the bot-side check above.
                                    raceIndex: raceIdx,
                                    runs
                                }
                            ]
                        },
                    })

                    match = eventRes.data
                    meta = eventRes.meta

                } catch (err) {
                    await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                    return
                }
            }
            break
        case 'verifyRun': {
            if (!interaction.isModalSubmit()) {
                // Button click is handled in defferInteraction (showModal). Nothing to do here.
                break
            }

            const playerId = interaction.customId.split(':')[0].split('_').slice(3).join('_')

            const submittedTime = interaction.fields.getTextInputValue('time').trim()
            const submittedDeaths = interaction.fields.getTextInputValue('deaths').trim()
            const racerSelection = interaction.fields.getStringSelectValues?.('racer') ?? []
            const dnf = submittedTime.toLowerCase() == 'dnf'

            // Send only the fields we want to change. The API's verifyRun action spreads
            // action.run over the existing persisted run, so other fields are preserved
            // automatically — no need to round-trip the full record before submitting,
            // which was the main contributor to the slow race-transition delay.
            //
            // player is sent as the full match player snapshot (not just {id}) because the
            // API's spread overwrites the existing run's player object — sending just {id}
            // would strip username and fail userSnapshot validation on writeBack.
            const targetPlayer = match.players?.find(p => p.id == playerId)
            if (!targetPlayer) {
                await errorOut(interaction, `${WhyNobodyBuy} Player not found in this match.`)
                return
            }
            const updatedRun = {
                player: targetPlayer,
                time: dnf ? 0 : time_to_seconds(submittedTime),
                dnf,
            }
            if (racerSelection[0]) updatedRun.racer = racerSelection[0]
            // Only overwrite deaths when the verifier gave a concrete answer; leaving the
            // field blank should preserve the existing value (including "unknown") instead
            // of clobbering it to 0 (Number("") is 0, which is misleading).
            if (submittedDeaths !== '' && !isNaN(Number(submittedDeaths))) {
                updatedRun.deaths = Number(submittedDeaths)
            }

            if (!dnf && updatedRun.time == null) {
                await errorOut(interaction, `${WhyNobodyBuy} Time format not recognized.`)
                return
            }

            try {
                const eventRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${match.id}/submitAction`,
                    userSnapshot,
                    data: {
                        actions: [
                            {
                                name: 'verifyRun',
                                run: updatedRun,
                            }
                        ]
                    },
                })

                match = eventRes.data
                meta = eventRes.meta

            } catch (err) {
                await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                return
            }
            break
        }
        case 'pickRacer': {
            if (!interaction.isModalSubmit()) {
                // Button click is handled in defferInteraction (showModal). Nothing to do here.
                break
            }

            const targetPlayerId = interaction.customId.split(':')[0].split('_').slice(3).join('_') || null
            const matchPlayer = targetPlayerId
                ? match.players?.find(p => p.id == targetPlayerId)
                : match.players?.find(p => p.discordId == userSnapshot.id)
            if (!canSubmitForPlayer({ match, userId: userSnapshot.id, targetPlayer: matchPlayer })) {
                await interaction.reply({
                    content: 'Only the racer themselves or a commentator/tracker can pick this racer.',
                    ephemeral: true
                })
                return
            }

            const racerSelection = interaction.fields.getStringSelectValues?.('racer') ?? []
            const racerId = racerSelection[0]
            if (!racerId) {
                await interaction.reply({ content: 'Pick a racer first.', ephemeral: true })
                return
            }
            const reveal = interaction.fields.getCheckbox?.('reveal') ?? false

            // Pass targetPlayerId on each action so the API can attribute the pick to the
            // intended racer when a commentator/tracker is acting on their behalf.
            const actions = [{ name: 'selectRacer', payload: racerId, targetPlayerId: matchPlayer.id }]
            if (reveal) actions.push({ name: 'revealRacer', targetPlayerId: matchPlayer.id })

            try {
                const eventRes = await requestWithUser({
                    method: 'post',
                    url: `/matches/${match.id}/submitAction`,
                    userSnapshot,
                    data: { actions },
                })
                match = eventRes.data
                meta = eventRes.meta
            } catch (err) {
                await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
                return
            }
            break
        }
    }

    if (!match) {
        try {
            const res = await axios.get(`/matches/${match.id}`)
            match = res.data?.data
        } catch (err) {
            await errorOut(interaction, `${WhyNobodyBuy}${err.message}`)
            return
        }
    }

    if (match && meta?.lastEventSeq != null) {
        match.__lastSeenSeq = meta.lastEventSeq
    }
    client.channelToMatch.set(interaction.channel.id, match)
    let view = adminView({ match })

    // Drop the bot-side leaderboard cache whenever runs change so the next
    // view fetches fresh data — covers the new-record badge in postRaceView
    // and "this tournament" entries that should appear right after a verify.
    // The API now only invalidates its own cache on run-affecting actions, so
    // mirroring that here keeps the two layers consistent.
    const runAffecting = ['submitRun', 'submitDnf', 'verifyRun', 'verifyResults', 'restartRace', 'rewindMatch']
    const transitionedToPostMatch = meta?.previousState !== STATE_POST_MATCH && match.status === STATE_POST_MATCH
    if (transitionedToPostMatch || runAffecting.includes(command)) {
        leaderboardCache.invalidateLeaderboard()
    }

    // Race-bearing states get a Best Times section. Fetch once up front so all
    // four views can share the same annotated list and stay synchronous.
    // Capped with a tight timeout so a cold-leaderboard fetch can't stall the entire
    // interaction (esp. at race transitions, when the new track is a cache miss). The
    // underlying request keeps running and warms the cache for the next render.
    const raceBearing = [STATE_PRE_RACE, STATE_WARMUP, STATE_IN_RACE, STATE_POST_RACE].includes(match.status)
    const leaderboard = raceBearing
        ? await Promise.race([
            getAnnotatedLeaderboard(match, userSnapshot),
            new Promise(resolve => setTimeout(() => resolve([]), 1500))
        ])
        : []

    switch (match.status) {
        case STATE_SCHEDULED:
            view = scheduledMatchView({ match })
            break
        case STATE_MATCH_SETUP:
            const [tournaments, rulesets] = await Promise.all([
                tournamentsRulesetsCache.getTournaments(),
                tournamentsRulesetsCache.getRulesets(),
            ])
            const rulesetSelected = command === 'setRuleset' && selection[0]?.startsWith('page_')
                ? selection[0]
                : undefined
            view = setupMatchView({ match, tournaments, rulesets, rulesetSelected })
            break
        case STATE_PRE_RACE:
            view = preRaceView({ match, summary: meta.matchSummary, options: meta.activeEventsOptions, activeEventCost: meta.activeEventCost, leaderboard })
            break
        case STATE_WARMUP:
            view = warmupView({ match, client, leaderboard })

            if (command == 'nextEvents') {
                const resolved = findResolvedEvents(prevMatch, match)
                const summaryText = resolvedStepSummary({ resolvedEvents: resolved }) || '-# Pre-race events resolved.'
                try {
                    await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
                } catch (err) {
                    console.error('[tourney] failed to post warmup message', err)
                    interaction.channel.send({ content: `${WhyNobodyBuy} Hit a hiccup posting warmup. Try refreshing.` }).catch(() => { })
                    return
                }
                withRetry(() => renderV2(interaction, collapsedView({ text: summaryText }))).catch(err => {
                    console.warn('[tourney] failed to collapse pre-race message after retries', err)
                })
                return
            }
            break
        case STATE_IN_RACE:
            view = inRaceView({ match, client, leaderboard })

            if (command == 'markReady') {
                await renderV2(interaction, placeholderView(`Good luck racers! Countdown incoming ${emojimap.countdown}`))
                countDown(interaction)

                setTimeout(() => {
                    interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view }).catch(err => {
                        console.warn('[tourney] failed to post in-race message', err)
                    })
                }, 10000)
                return
            }
            break
        case STATE_POST_RACE:
            view = postRaceView({ match, client, leaderboard })
            break
        case STATE_POST_MATCH:
            view = postMatchView({ match })
            break
        case STATE_CANCELLED:
            await renderV2(interaction, placeholderView(meta.message || 'Match cancelled.'))
            return
    }

    // Trail-of-messages behavior:
    // When the step (status + currentRace + activeEvent IDs) changes, collapse the previous
    // message to a one-line outcome summary and post the new step as a fresh message so the
    // active player gets a native ping. Race transitions and countdown setups already needed
    // a fresh message; we extend the same logic to in-race-phase event handoffs.
    // Manual repost from the admin view: post a fresh state message in the channel and
    // leave the admin manager intact so the operator can keep using its other buttons.
    if (command === 'repost') {
        try {
            await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
        } catch (err) {
            await errorOut(interaction, `${WhyNobodyBuy} Failed to repost: ${err.message}`)
            return
        }
        // Refresh the admin view in place so its "Current Stage" reflects the latest state.
        renderV2(interaction, adminView({ match })).catch(err => {
            console.warn('[tourney] failed to refresh admin view after repost', err)
        })
        await interaction.followUp({ content: '-# *Reposted current step.*', ephemeral: true }).catch(() => { })
        return
    }

    const stepChanged = stepKey(prevMatch) !== stepKey(match)
    if (meta.raceUpdated || meta.countdownSet || stepChanged) {
        // Decide what the previous message should become as the trail's leave-behind.
        // Priority:
        //   1. Rewind action → one-liner naming the admin and rewind point
        //   2. Resolved events (event phase) → ✅ pool-pick / ban / vote summary
        //   3. Race-phase prior state (warmup/in-race/post-race) → prev view, buttons stripped
        //   4. Generic fallback summary line
        //   5. Bare placeholder
        let leaveBehindView = null
        if (command === 'rewindMatch' && interaction.isStringSelectMenu && interaction.isStringSelectMenu() && selection[0]) {
            const rewindLabels = {
                events: 'the start of current race events',
                race: 'current race warmup',
                lastRace: 'the end of the previous race',
                match: 'the start of the match'
            }
            const dest = rewindLabels[selection[0]] || selection[0]
            leaveBehindView = collapsedView({ text: `-# 🔁 ${userSnapshot.username} rewound the match to ${dest}` })
        } else {
            const resolved = findResolvedEvents(prevMatch, match)
            const resolvedText = resolvedStepSummary({ resolvedEvents: resolved })
            if (resolvedText) {
                leaveBehindView = collapsedView({ text: resolvedText })
            } else {
                const prevReadOnly = prevStateReadOnlyView(prevMatch, match, client)
                if (prevReadOnly) {
                    leaveBehindView = prevReadOnly
                } else {
                    const fallback = transitionFallbackSummary(prevMatch, match)
                    leaveBehindView = collapsedView({ text: fallback || '-#' })
                }
            }
        }

        // Send the new step message FIRST. If this fails (e.g. discord connect timeout), leave the
        // previous message intact so the player can retry — better than collapsing the old one and
        // having no follow-up at all.
        let followUpMessage
        try {
            // Post a matchup card on every race transition. For the kickoff
            // transition (MATCH_SETUP → PRE_RACE), use the richer Match Introduction
            // view instead of the regular summary — at race 0 the summary just reads
            // "Tied 0 to 0", whereas the intro surfaces each player's platform/input/bio.
            if (meta.raceUpdated) {
                const isKickoff = prevMatch?.status === STATE_MATCH_SETUP
                const kickoffView = isKickoff
                    ? matchIntroductionView({ match, summary: meta.matchSummary, client })
                    : matchSummaryView({ summary: meta.matchSummary, client })
                if (kickoffView) {
                    await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: kickoffView })
                }
            }
            followUpMessage = await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: view })
        } catch (err) {
            console.error('[tourney] failed to post next step message', err)
            interaction.channel.send({ content: `${WhyNobodyBuy} Hit a hiccup posting the next step. Try the action again.` }).catch(() => { })
            return
        }

        // Update the previous message with the chosen leave-behind. Cosmetic — failures are logged.
        withRetry(() => renderV2(interaction, leaveBehindView)).catch(err => {
            console.warn('[tourney] failed to update previous step message after retries', err)
        })

        // set up countdown
        if (meta.countdownSet) {
            const raceStart = match.races[match.currentRace]?.raceStart
            if (raceStart) {
                setTimeout(() => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    interaction.channel.send({ content: `Good luck racers! Countdown incoming ${emojimap.countdown}` }).catch(err => {
                        console.warn('[tourney] failed to post countdown nudge', err)
                    })
                }, raceStart - Date.now() - 10000)

                setTimeout(() => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    countDown(interaction)
                }, raceStart - Date.now() - 8000)

                setTimeout(async () => {
                    if (!isCountdownActive(client, interaction, raceStart)) {
                        return
                    }
                    try {
                        const eventRes = await requestWithUser({
                            method: 'post',
                            url: `/matches/${match.id}/submitAction`,
                            userSnapshot,
                            data: {
                                actions: [
                                    {
                                        name: 'raceStart',
                                    }
                                ]
                            },
                        })

                        match = eventRes.data
                        meta = eventRes.meta

                        const race = match.races[match.currentRace]
                        if (race.raceStart) {
                            const lb = await getAnnotatedLeaderboard(match, userSnapshot)
                            await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: inRaceView({ match, client, leaderboard: lb }) })
                            await followUpMessage.edit({ components: placeholderView('-# Race started.') })
                        }

                    } catch (err) {
                        console.error('[tourney] raceStart action failed', err)
                        interaction.channel.send({ content: `${WhyNobodyBuy}${err.message}` }).catch(() => { })
                        return
                    }

                }, raceStart - Date.now() + 3000)
            }
            return
        }
        return
    }

    await renderV2(interaction, view)
}