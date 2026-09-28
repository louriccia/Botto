// Syndicates: a player's sponsoring body (docs/sponsorship.md §7). This is stage 2 -- the name,
// the ledger and the views. Rent still works as stage 0 set it up; nothing here moves truguts.
//
// Routing (see bot.js): a custom_id is split on "_"; "syndicate" selects this handler.
//   syndicate_view_<memberId>   (slash)          -> a syndicate, public
//   syndicate_found             (slash / button) -> the name, emoji and motto modal
//   syndicate_save              (modal submit)   -> validate and save
//   syndicate_setup             (select)         -> one sponsored setup's page (value = deed id)
//   syndicate_help              (slash / button) -> how sponsoring works
//   syndicate_reset_<memberId>  (slash)          -> moderators: back to the default name

const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const { WhyNobodyBuy } = require('../data/discord/emoji.js');
const { truguts } = require('../data/challenge/trugut.js');
const { number_with_commas, time_fix } = require('../generic.js');
const { get_user_key_by_discord_id } = require('../user.js');
const {
    setupName, syndicateOf, syndicateNameTaken, defaultSyndicateName, leadSponsor, getSponsors,
} = require('./challenge/functions.js');

const COLOR = '#FAA61A';
const RENAME_COOLDOWN = 7 * 864e5;
const DAY30 = 30 * 864e5;
const tg = v => `📀${number_with_commas(Math.round(Number(v) || 0))}`;

// custom emoji markup, or one unicode emoji (with any modifiers and joiners)
const EMOJI = /^(<a?:\w{2,32}:\d{17,20}>|\p{Extended_Pictographic}(️|⃣|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic}️?)*)$/u;

const errorEmbed = (title, desc) => new EmbedBuilder().setTitle(`${WhyNobodyBuy} ${title}`).setDescription(desc).setColor('#ED4245');

const HELP = [
    '**1.** Sponsor a challenge from the 🛒 shop: pick a circuit, and you get a random setup to sponsor.',
    `**2.** Whenever someone else races that exact setup, its sponsors split **${Math.round(truguts.sponsor_rent * 100)}% of what they win** — taken from their winnings, never added on top.`,
    '**3.** Your fastest time on it is the **sponsor time**. Racers who beat it get a bonus, once each.',
    '**4.** No rent is charged on the Challenge of the Day, from players below level 5, or on your own runs.',
    '**5.** Your sponsorships are held through your **syndicate**. Name it with `/syndicate found`.',
].join('\n');

function helpEmbed() {
    return new EmbedBuilder()
        .setTitle('📢 How sponsoring works')
        .setDescription(HELP + '\n\n-# Coming next: investing any amount, the Ace for the fastest sponsor, Garages, and signing racers to contracts.')
        .setColor(COLOR);
}

// every sponsored setup a member holds, with their share, whether they lead it, and what it's paid them
function holdingsOf(db, member_id) {
    const now = Date.now();
    const ledger = Object.values(db.ch.ledger ?? {});
    return Object.entries(db.ch.deeds ?? {})
        .filter(([, d]) => Number(d?.stakes?.[member_id]) > 0)
        .map(([id, d]) => {
            const total = Object.values(d.stakes).reduce((a, v) => a + (Number(v) || 0), 0);
            const entries = ledger.filter(e => e?.deed == id && Number(e?.shares?.[member_id]) > 0);
            return {
                id, deed: d,
                stake: Number(d.stakes[member_id]),
                share: Number(d.stakes[member_id]) / total,
                lead: leadSponsor(db, d) == String(member_id),
                earned: entries.reduce((a, e) => a + Number(e.shares[member_id]), 0),
                earned30: entries.filter(e => e.date > now - DAY30).reduce((a, e) => a + Number(e.shares[member_id]), 0),
            };
        })
        .sort((a, b) => b.earned - a.earned || b.stake - a.stake);
}

function syndicateView(db, member_id, viewer_id) {
    const user = Object.values(db.user ?? {}).find(u => u?.discordID == member_id);
    const syndicate = user?.random?.syndicate;
    const own = member_id == viewer_id;

    if (!syndicate?.name) {
        const embed = new EmbedBuilder()
            .setTitle(own ? "📢 You haven't founded a syndicate yet" : `📢 ${user?.name ?? 'That player'} hasn't founded a syndicate`)
            .setDescription(HELP)
            .setColor(COLOR);
        const row = new ActionRowBuilder().addComponents(
            ...(own ? [new ButtonBuilder().setCustomId('syndicate_found').setLabel('Found a syndicate').setStyle(ButtonStyle.Primary).setEmoji('📢')] : []),
            new ButtonBuilder().setCustomId('syndicate_help').setLabel('How it works').setStyle(ButtonStyle.Secondary),
        );
        return { embeds: [embed], components: [row] };
    }

    const holdings = holdingsOf(db, member_id);
    const invested = holdings.reduce((a, h) => a + h.stake, 0);
    const earned = holdings.reduce((a, h) => a + h.earned, 0);
    const earned30 = holdings.reduce((a, h) => a + h.earned30, 0);
    const lead = holdings.filter(h => h.lead).length;

    const embed = new EmbedBuilder()
        .setTitle(`${syndicate.emoji || '📢'} ${syndicate.name}`)
        .setDescription([
            syndicate.motto ? `*${syndicate.motto}*` : null,
            `-# Run by <@${member_id}>${syndicate.founded ? ` · founded <t:${Math.round(syndicate.founded / 1000)}:D>` : ''}`,
        ].filter(Boolean).join('\n'))
        .setColor(COLOR)
        .addFields(
            { name: 'Sponsorships', value: holdings.length ? `**${holdings.length}** setups · lead sponsor on **${lead}** · ${tg(invested)} put in` : 'None yet. Sponsor a challenge from the 🛒 shop.', inline: false },
            { name: 'Rent earned', value: `${tg(earned)} in all · ${tg(earned30)} in the last 30 days\n-# Counted from 27 Sep 2026, when sponsors started being paid in rent`, inline: false },
        );
    if (holdings.length) {
        const lines = holdings.slice(0, 8).map(h => `• ${setupName(h.deed)} — ${Math.round(h.share * 100)}%${h.lead ? ' · **lead**' : ''}${h.earned ? ` · ${tg(h.earned)}` : ''}`);
        if (holdings.length > 8) lines.push(`-# …and ${holdings.length - 8} more`);
        embed.addFields({ name: 'Top sponsorships', value: lines.join('\n').slice(0, 1024), inline: false });
    }

    const components = [];
    if (holdings.length) {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('syndicate_setup')
                .setPlaceholder('Open a sponsorship')
                .addOptions(holdings.slice(0, 25).map(h => ({
                    label: setupName(h.deed).slice(0, 100),
                    description: `${Math.round(h.share * 100)}%${h.lead ? ' · lead sponsor' : ''} · ${tg(h.earned)} earned`.slice(0, 100),
                    value: h.id,
                })))
        ));
    }
    components.push(new ActionRowBuilder().addComponents(
        ...(own ? [new ButtonBuilder().setCustomId('syndicate_found').setLabel('Edit name, emoji & motto').setStyle(ButtonStyle.Secondary).setEmoji('🏷️')] : []),
        new ButtonBuilder().setCustomId('syndicate_help').setLabel('How it works').setStyle(ButtonStyle.Secondary),
    ));
    return { embeds: [embed], components };
}

function setupView(db, id) {
    const deed = db.ch.deeds?.[id];
    if (!deed) {
        return { embeds: [errorEmbed('Not found', "That sponsorship doesn't exist any more.")] };
    }
    const stakes = Object.entries(deed.stakes ?? {}).filter(([, v]) => Number(v) > 0);
    const total = stakes.reduce((a, [, v]) => a + Number(v), 0);
    const lead = leadSponsor(db, deed);
    const setup = getSponsors({ track: deed.track, racer: deed.racer, conditions: deed.conditions }, db);
    const now = Date.now();
    const entries = Object.values(db.ch.ledger ?? {}).filter(e => e?.deed == id);
    const runs30 = Object.values(db.ch.times ?? {}).filter(t => t.date > now - DAY30 && t.track == deed.track && t.racer == deed.racer && t.conditions && ['laps', 'nu', 'mirror', 'skips', 'backwards'].every(k => (t.conditions[k] ?? false) == (deed.conditions?.[k] ?? false)));

    const sponsorLines = stakes
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([m, v]) => { const s = syndicateOf(db, m); return `${s.emoji} **${s.name}** — ${Math.round(Number(v) / total * 100)}% (${tg(v)})${m == lead ? ' · lead' : ''}`; });

    const embed = new EmbedBuilder()
        .setTitle(setupName(deed))
        .setColor(COLOR)
        .addFields(
            { name: 'Sponsors', value: sponsorLines.join('\n').slice(0, 1024) || 'None', inline: false },
            { name: 'Rent', value: `${Math.round(truguts.sponsor_rent * 100)}% of what other racers win here · none on the daily or below level 5`, inline: false },
            { name: 'Sponsor time', value: setup.sponsor?.time ? `\`${time_fix(setup.sponsor.time)}\` by ${setup.sponsor.name}` : 'None yet: a sponsor has to race it', inline: true },
            { name: 'Last 30 days', value: `${runs30.length} run${runs30.length == 1 ? '' : 's'} · ${tg(entries.filter(e => e.date > now - DAY30).reduce((a, e) => a + Number(e.amount), 0))} rent`, inline: true },
        );
    return { embeds: [embed] };
}

function foundModal(syndicate) {
    return new ModalBuilder()
        .setCustomId('syndicate_save')
        .setTitle(syndicate?.name ? 'Your syndicate' : 'Found a syndicate')
        .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Name').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(32).setRequired(true).setValue(syndicate?.name ?? '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji').setStyle(TextInputStyle.Short).setMaxLength(64).setRequired(false).setPlaceholder('📢').setValue(syndicate?.emoji ?? '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motto').setLabel('Motto').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false).setValue(syndicate?.motto ?? '')),
        );
}

module.exports = {
    name: 'syndicate',
    async execute({ interaction, args, database, db, member_id, member_name, user_key, user_profile } = {}) {
        const action = args[0];

        if (action == 'help') {
            return interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
        }

        if (action == 'view') {
            return interaction.reply(syndicateView(db, args[1] || member_id, member_id));
        }

        if (action == 'setup' && interaction.isStringSelectMenu()) {
            return interaction.reply({ ...setupView(db, interaction.values[0]), ephemeral: true });
        }

        if (action == 'found') {
            return interaction.showModal(foundModal(user_profile?.syndicate));
        }

        if (action == 'save' && interaction.isModalSubmit()) {
            const current = user_profile?.syndicate ?? null;
            const name = interaction.fields.getTextInputValue('name').replace(/\s+/g, ' ').trim();
            const emoji = interaction.fields.getTextInputValue('emoji').trim() || '📢';
            const motto = interaction.fields.getTextInputValue('motto').replace(/\s+/g, ' ').trim();
            const renaming = !current?.name || current.name != name;

            if (name.length < 2 || /[@<>]|https?:\/\//i.test(name) || /[<>]|https?:\/\//i.test(motto)) {
                return interaction.reply({ embeds: [errorEmbed("That won't do", 'Names and mottos can’t contain links, mentions or `@ < >`.')], ephemeral: true });
            }
            if (!EMOJI.test(emoji)) {
                return interaction.reply({ embeds: [errorEmbed("That's not an emoji", 'Use a single emoji, or a custom one from this server.')], ephemeral: true });
            }
            if (renaming && syndicateNameTaken(db, name, user_key)) {
                return interaction.reply({ embeds: [errorEmbed('Name taken', `There's already a syndicate called **${name}**.`)], ephemeral: true });
            }
            if (renaming && current?.renamed && Date.now() - current.renamed < RENAME_COOLDOWN) {
                return interaction.reply({ embeds: [errorEmbed('Not yet', `A syndicate can be renamed once a week. You can rename yours <t:${Math.round((current.renamed + RENAME_COOLDOWN) / 1000)}:R>. Its emoji and motto can change any time.`)], ephemeral: true });
            }

            const saved = {
                ...(current ?? {}),
                name, emoji, motto,
                founded: current?.founded ?? Date.now(),
                ...(renaming && current?.name ? { renamed: Date.now() } : {}),
            };
            await database.ref(`users/${user_key}/random/syndicate`).set(saved);
            if (db.user?.[user_key]?.random) db.user[user_key].random.syndicate = saved; // the listener catches up; the reply shouldn't wait for it
            return interaction.reply({ content: current?.name ? 'Saved.' : `**${saved.emoji} ${saved.name}** is open for business.`, ...syndicateView(db, member_id, member_id), ephemeral: true });
        }

        if (action == 'reset') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ embeds: [errorEmbed('Moderators only', 'Resetting a syndicate is for moderators.')], ephemeral: true });
            }
            const key = get_user_key_by_discord_id(db, args[1]);
            const syndicate = db.user?.[key]?.random?.syndicate;
            if (!syndicate?.name) {
                return interaction.reply({ embeds: [errorEmbed('Nothing to reset', "That player hasn't founded a syndicate.")], ephemeral: true });
            }
            const name = defaultSyndicateName(db.user[key].name, db, key);
            await database.ref(`users/${key}/random/syndicate`).update({ name, motto: '', renamed: null, reset_by: member_id, reset_at: Date.now() });
            return interaction.reply({ content: `Reset <@${args[1]}>'s syndicate to **${name}** and cleared its motto.`, ephemeral: true });
        }
    },
};
