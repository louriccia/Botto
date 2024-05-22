

const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');

exports.bottocolor = async function ({ interaction,  member_id} = {}) {
    
    const SWE1R_Guild = await interaction.client.guilds.cache.get(swe1r_guild)
    if (interaction.isModalSubmit()) {
        let color = interaction.fields.getTextInputValue('color')

        function isValidHexCode(hexCode) {
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(hexCode);
        }

        if (!isValidHexCode(color)) {
            const noTruguts = new EmbedBuilder()
                .setTitle("<:WhyNobodyBuy:589481340957753363> I'm afraid that color doesn't exist")
                .setDescription("Please enter a valid hex code `#FFFFFF`")
            interaction.reply({ embeds: [noTruguts], ephemeral: true })
            return
        }

        let role = await SWE1R_Guild.roles.cache.get('1144077932021686272')
        role.edit({ color: color })

        const avatarColorURL = 'https://cdn.discordapp.com/attachments/1135800422066556940/1160326500957028422/botto_color.png';
        const avatarWhiteURL = 'https://cdn.discordapp.com/attachments/1135800422066556940/1160326538324103228/botto_white.png'
        const avatarColor = await Jimp.read(avatarColorURL);
        const avatarWhite = await Jimp.read(avatarWhiteURL)

        avatarColor.color([{ apply: 'mix', params: [color, 100] }]);

        avatarColor.composite(avatarWhite, 0, 0, {
            mode: Jimp.BLEND_DESTINATION_OVER
        });

        const modifiedAvatarPath = 'modified_avatar.png';
        await avatarColor.writeAsync(modifiedAvatarPath);

        // Set the bot's avatar to the modified image
        const newAvatarBuffer = fs.readFileSync(modifiedAvatarPath);
        await interaction.client.user.setAvatar(newAvatarBuffer);
        const file = new AttachmentBuilder(modifiedAvatarPath);

        const quoteEmbed = new EmbedBuilder()
            .setTitle("✨New Botto Color")
            .setDescription(`<@${member_id}> just changed <@545798436105224203>'s color!`)
            .setColor(color)
            .setImage(`attachment://${modifiedAvatarPath}`);
        interaction.reply({ embeds: [quoteEmbed], files: [file] })

    } else {
        const sponsorModal = new ModalBuilder()
            .setCustomId('challenge_random_shop_purchase')
            .setTitle('New Botto Color')
        const color = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color (Hex Code)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(7)
            .setMinLength(7)
            .setPlaceholder("#FFFFFF")
            .setRequired(true)
        const ActionRow1 = new ActionRowBuilder().addComponents(color)
        sponsorModal.addComponents(ActionRow1)
        await interaction.showModal(sponsorModal)
        return
    }
}