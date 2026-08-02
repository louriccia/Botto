const { banners, bannerFiles } = require('../../../data/discord/banner.js')
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { swe1r_guild } = require('../../../data/discord/guild.js');

exports.shuffle_banner = async function ({ interaction, member_avatar, botto_name } = {}) {
    let index = Math.floor(Math.random() * banners.length)
    let banner = banners[index]

    const SWE1R_Guild = await interaction.client.guilds.cache.get(swe1r_guild)

    if (interaction.guild_id == '441839750555369474') {
        await SWE1R_Guild.edit({ banner: banner })
    }
    // Banners live on disk now, so the embed has to attach the file rather
    // than point at a URL.
    const file = new AttachmentBuilder(banner, { name: bannerFiles[index] })
    const shuffleBuy = new EmbedBuilder()
        .setAuthor({ name: `${botto_name} shuffled the server banner!`, iconURL: member_avatar })
        .setImage(`attachment://${bannerFiles[index]}`)
    interaction.reply({ embeds: [shuffleBuy], files: [file] })
    return true
}