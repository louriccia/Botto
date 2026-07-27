// Router + handlers for the Wald Street Exchange stock market.
//
// Routing (see bot.js): a component/modal custom_id is split on "_"; the first
// segment ("stock") selects this handler, the rest become `args`. Symbols and
// share counts contain no "_", so they parse cleanly out of trailing segments.
//   stock_market                        -> market view
//   stock_detail_<RANGE>    (select)    -> detail view (symbol = value), keeping <RANGE>
//   stock_detail_<SYM>      (button)    -> detail view
//   stock_history_<SYM>     (select)    -> detail view, new graph range (= value)
//   stock_portfolio                     -> portfolio view
//   stock_buy_<SYM> / stock_sell_<SYM>  -> show shares modal
//   stock_confirm(buy|sell)_<SYM> (modal submit) -> ephemeral fee confirmation
//   stock_do(buy|sell)_<SYM>_<N> (button)        -> execute the trade
//   stock_cancel                        -> dismiss the confirmation
//   stock_help                          -> ephemeral rules explainer

const { EmbedBuilder } = require('discord.js');
const { number_with_commas } = require('../generic.js');
const { WhyNobodyBuy } = require('../data/discord/emoji.js');
const { manageTruguts } = require('./challenge/functions.js');
const {
    marketEmbed, marketComponents, stockDetailEmbed, detailComponents,
    portfolioEmbed, portfolioComponents, confirmEmbed, confirmComponents, resultEmbed, helpEmbed,
    buildTradeModal, maxAffordableShares, priceChart, companyLogo, getCompany, getPortfolio, balanceOf, isWhale, isMarketLive, quoteTrade, tgx, DEFAULT_RANGE, normalizeRange,
} = require('./stock/functions.js');

function errorEmbed(title, desc) {
    return new EmbedBuilder()
        .setTitle(`${WhyNobodyBuy} ${title}`)
        .setDescription(desc)
        .setColor('#ED4245');
}

// Shown when a trade is attempted before the firebase listener has hydrated the
// market. Views still render off the seed fallback; trades must not.
const marketColdEmbed = () => errorEmbed(
    'The trading floor is still opening',
    "Prices haven't loaded yet, so orders can't be priced. Try again in a moment.",
);

module.exports = {
    name: 'stock',
    async execute({ interaction, args, database, db, member_id, user_key, user_profile } = {}) {
        const action = args[0];
        const profile_ref = database.ref(`users/${user_key}/random`);

        // ---- select menus ----
        if (interaction.isStringSelectMenu()) {
            // args[1] is the range the dropdown was rendered with, so switching
            // companies keeps the graph range you were already looking at.
            if (action === 'detail') return showDetail(interaction.values[0], args[1]);
            if (action === 'history') return showDetail(args[1], interaction.values[0]);
            return;
        }

        // ---- modal submissions (shares entered) ----
        if (interaction.isModalSubmit()) {
            const shares = interaction.fields.getTextInputValue('shares');
            if (action === 'confirmbuy') return showConfirm('buy', args[1], shares);
            if (action === 'confirmsell') return showConfirm('sell', args[1], shares);
            return;
        }

        switch (action) {
            case 'market': return showMarket();
            case 'portfolio': return showPortfolio();
            case 'help': return interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
            case 'detail': return showDetail(args[1], DEFAULT_RANGE);
            case 'buy': return showTradeModal('buy', args[1]);
            case 'sell': return showTradeModal('sell', args[1]);
            // Power-user fast path: /stock company:X buy:N / sell:N -> straight to
            // the (ephemeral) fee confirmation, skipping the detail view + modal.
            case 'cmdbuy': return showConfirm('buy', args[1], args[2]);
            case 'cmdsell': return showConfirm('sell', args[1], args[2]);
            case 'dobuy': return executeTrade('buy', args[1], args[2]);
            case 'dosell': return executeTrade('sell', args[1], args[2]);
            case 'cancel':
                return interaction.update({
                    embeds: [new EmbedBuilder().setTitle('Order cancelled.').setColor('#4F545C')],
                    components: [],
                });
            default:
                return;
        }

        // ---- view helpers (hoisted; close over the interaction context) ----

        function replyOrUpdate(payload) {
            return interaction.isChatInputCommand() ? interaction.reply(payload) : interaction.update(payload);
        }

        function showMarket(selected) {
            return replyOrUpdate({
                embeds: [marketEmbed({ db, user_profile })],
                components: marketComponents(db, user_profile, { selected }),
                files: [],
            });
        }

        function showPortfolio() {
            return replyOrUpdate({
                embeds: [portfolioEmbed({ db, user_profile })],
                components: portfolioComponents(db, user_profile),
                files: [],
            });
        }

        async function showDetail(symbolRaw, rangeRaw) {
            const symbol = String(symbolRaw || '').toUpperCase();
            const range = normalizeRange(rangeRaw);
            const company = getCompany(db, symbol);
            if (!company) {
                return interaction.reply({ embeds: [errorEmbed('Unknown company', "That company isn't listed on the exchange.")], ephemeral: true });
            }
            // Chart is an HTTP call — defer first.
            if (interaction.isChatInputCommand()) await interaction.deferReply();
            else await interaction.deferUpdate();

            const chart = await priceChart({ company, range });
            const logo = companyLogo(symbol);
            const embed = stockDetailEmbed({ db, user_profile, symbol });
            if (chart) embed.setImage('attachment://chart.png');
            const files = [];
            if (chart) files.push(chart);
            if (logo) files.push(logo);
            await interaction.editReply({
                embeds: [embed],
                components: detailComponents({ db, user_profile, symbol, range }),
                files,
            });
        }

        async function showTradeModal(kind, symbolRaw) {
            if (!isMarketLive(db)) {
                return interaction.reply({ embeds: [marketColdEmbed()], ephemeral: true });
            }
            const symbol = String(symbolRaw || '').toUpperCase();
            const company = getCompany(db, symbol);
            if (!company) {
                return interaction.reply({ embeds: [errorEmbed('Unknown company', "That company isn't listed on the exchange.")], ephemeral: true });
            }
            const price = Number(company.price);
            // Nothing to trade — say so up front instead of opening a modal the
            // user can only cancel out of.
            if (kind === 'sell') {
                const owned = Number(getPortfolio(user_profile)[symbol]?.shares) || 0;
                if (owned <= 0) {
                    return interaction.reply({ embeds: [errorEmbed('No shares to sell', `You don't own any ${symbol}.`)], ephemeral: true });
                }
            } else if (maxAffordableShares(db, user_profile, price, symbol) < 1) {
                return interaction.reply({
                    embeds: [errorEmbed('Not enough truguts', `One share of ${symbol} costs about ${tgx(quoteTrade({ db, user_profile, kind: 'buy', price, shares: 1, symbol }).total)} truguts, but you only have ${tgx(balanceOf(user_profile))}.`)],
                    ephemeral: true,
                });
            }
            await interaction.showModal(buildTradeModal({ db, user_profile, kind, company }));
        }

        function showConfirm(kind, symbolRaw, sharesRaw) {
            if (!isMarketLive(db)) {
                return interaction.reply({ embeds: [marketColdEmbed()], ephemeral: true });
            }
            const symbol = String(symbolRaw || '').toUpperCase();
            const company = getCompany(db, symbol);
            if (!company) {
                return interaction.reply({ embeds: [errorEmbed('Unknown company', "That company isn't listed on the exchange.")], ephemeral: true });
            }
            const shares = Math.floor(Number(sharesRaw));
            if (!Number.isFinite(shares) || shares <= 0) {
                return interaction.reply({ embeds: [errorEmbed('Invalid amount', 'Enter a positive whole number of shares.')], ephemeral: true });
            }
            const quote = quoteTrade({ db, user_profile, kind, price: Number(company.price), shares, symbol });
            const balance = balanceOf(user_profile);
            const whale = isWhale(db, user_profile);

            if (kind === 'buy') {
                if (balance < quote.total) {
                    return interaction.reply({ embeds: [errorEmbed('Not enough truguts', `You need ${tgx(quote.total)} but only have ${tgx(balance)}.`)], ephemeral: true });
                }
            } else {
                const owned = Number(getPortfolio(user_profile)[symbol]?.shares) || 0;
                if (owned < shares) {
                    return interaction.reply({ embeds: [errorEmbed('Not enough shares', `You only own ${number_with_commas(owned)} ${symbol}.`)], ephemeral: true });
                }
            }
            return interaction.reply({
                embeds: [confirmEmbed({ kind, symbol, name: company.name, shares, quote, balance, whale })],
                components: confirmComponents({ kind, symbol, shares }),
                ephemeral: true,
            });
        }

        function executeTrade(kind, symbolRaw, sharesArg) {
            // A confirmation can outlive a restart — re-check that the market is
            // hydrated before pricing the order off what may be the seed fallback.
            if (!isMarketLive(db)) {
                return interaction.update({ embeds: [marketColdEmbed()], components: [] });
            }
            const symbol = String(symbolRaw || '').toUpperCase();
            const company = getCompany(db, symbol);
            const shares = Math.floor(Number(sharesArg));
            if (!company || !Number.isFinite(shares) || shares <= 0) {
                return interaction.update({ embeds: [errorEmbed('Order failed', 'This order is no longer valid.')], components: [] });
            }
            const price = Number(company.price);
            // Re-quote at execution time — price, market hours, and whale status
            // may all have moved since the confirmation was shown.
            const quote = quoteTrade({ db, user_profile, kind, price, shares, symbol });

            if (kind === 'buy') {
                if (balanceOf(user_profile) < quote.total) {
                    return interaction.update({ embeds: [errorEmbed('Not enough truguts', `The price moved — you need ${tgx(quote.total)} but have ${tgx(balanceOf(user_profile))}.`)], components: [] });
                }
                manageTruguts({
                    user_profile, profile_ref, transaction: 'w', amount: quote.total,
                    purchase: { date: Date.now(), purchased_item: 'stock_buy', symbol, shares, price, fillPrice: quote.fillPrice, fee: quote.fee, cost: quote.total },
                });
                const holding = getPortfolio(user_profile)[symbol] || { shares: 0, averageCost: 0 };
                const prevShares = Number(holding.shares) || 0;
                const newShares = prevShares + shares;
                let newAvg = ((Number(holding.averageCost) || 0) * prevShares + quote.total) / newShares;
                newAvg = Number.isFinite(newAvg) ? Math.round(newAvg * 100) / 100 : price;
                user_profile.portfolio = user_profile.portfolio || {};
                user_profile.portfolio[symbol] = { shares: newShares, averageCost: newAvg };
                profile_ref.child('portfolio').child(symbol).set({ shares: newShares, averageCost: newAvg });
                addVolume(symbol, 'buy', quote.gross);
                database.ref('stock/transactions').push({ user_key, discordId: member_id, symbol, action: 'buy', shares, price, fillPrice: quote.fillPrice, gross: quote.base, fee: quote.fee, total: quote.total, date: Date.now() });
                return interaction.update({ embeds: [resultEmbed({ kind, symbol, shares, quote })], components: [] });
            }

            const holding = getPortfolio(user_profile)[symbol];
            const owned = Number(holding?.shares) || 0;
            if (owned < shares) {
                return interaction.update({ embeds: [errorEmbed('Not enough shares', `You only own ${number_with_commas(owned)} ${symbol}.`)], components: [] });
            }
            manageTruguts({ user_profile, profile_ref, transaction: 'd', amount: quote.total });
            const newShares = owned - shares;
            user_profile.portfolio = user_profile.portfolio || {};
            if (newShares <= 0) {
                delete user_profile.portfolio[symbol];
                profile_ref.child('portfolio').child(symbol).remove();
            } else {
                const avg = Number(holding.averageCost) || 0;
                user_profile.portfolio[symbol] = { shares: newShares, averageCost: avg };
                profile_ref.child('portfolio').child(symbol).set({ shares: newShares, averageCost: avg });
            }
            addVolume(symbol, 'sell', quote.gross);
            database.ref('stock/transactions').push({ user_key, discordId: member_id, symbol, action: 'sell', shares, price, fillPrice: quote.fillPrice, gross: quote.base, fee: quote.fee, total: quote.total, date: Date.now() });
            return interaction.update({ embeds: [resultEmbed({ kind, symbol, shares, quote })], components: [] });
        }

        // Accumulate live buy/sell pressure for the next price tick. Read-modify-
        // write on the in-memory cache (matches the truguts precedent; not atomic).
        function addVolume(symbol, side, amount) {
            const field = side === 'buy' ? 'buyVolume' : 'sellVolume';
            const cache = db?.stock?.companies?.[symbol];
            const next = (Number(cache?.[field]) || 0) + (Number(amount) || 0);
            if (!Number.isFinite(next)) return;
            if (cache) cache[field] = next;
            database.ref(`stock/companies/${symbol}/${field}`).set(next);
        }
    },
};
