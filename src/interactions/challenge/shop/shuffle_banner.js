const { banners } = require('../../../data/discord/banner.js')
const { EmbedBuilder } = require('discord.js');

exports.shuffle_banner = async function ({ interaction, member_avatar, botto_name } = {}) {
    let banner = banners[Math.floor(Math.random() * banners.length)]

    const SWE1R_Guild = await interaction.client.guilds.cache.get(swe1r_guild)

    if (interaction.guild_id == '441839750555369474') {
        await SWE1R_Guild.edit({ banner: banner })
    }
    const shuffleBuy = new EmbedBuilder()
        .setAuthor({ name: `${botto_name} shuffled the server banner!`, iconURL: member_avatar })
        .setImage(banner)
    interaction.reply({ embeds: [shuffleBuy] })
}