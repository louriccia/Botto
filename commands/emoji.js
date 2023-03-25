const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('post animated emotes by proxy')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ballquadinaros')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('benhi')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('benrage')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('bullseyesteer')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('fodesinbeed')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('hammerhead')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('jarjarblinks')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('niktoboo')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('odyohno')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('padmewhat')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('pitdroid')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('ripratts')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('slideflip')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('thumbsupbinks')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('triffianbow')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('walddance')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('wattolol')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('whatto')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('xamsterdance')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('countdown')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('guidearrow')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('newrecord')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('speedo')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('wipeout')
                .setDescription('post animated emotes by proxy')
        ).addSubcommand(subcommand =>
            subcommand
                .setName('restart')
                .setDescription('post animated emotes by proxy')
        )
    ,
    execute(interaction, database) {
        const emojimap = {
            ballquadinaros: "<a:BallQuadinaros:964303313904484362>",
            benhi: "<a:BenHi:672640761501843466>",
            benrage: "<a:BenRage:672640776718647367>",
            bullseyesteer: "<a:BullseyeSTEER:853758198049800212>",
            fodesinbeed: "<a:Fodesinbeed:672640805055496192>",
            hammerhead: "<a:HammerHead:965839199452430358>",
            jarjarblinks: "<a:JarJarBlinks:966191699586056222>",
            niktoboo: "<a:NiktoBoo:964362648214986802>",
            odyohno: "<a:OdyOhNo:712555049816948767>",
            padmewhat: "<a:PadmeWhat:964049906895581194>",
            pitdroid: "<a:PitDroid:965844766971560016>",
            ripratts: "<a:RIPratts:674357178949304379>",
            slideflip: "<a:SlideFlip:965874632253112330>",
            thumbsupbinks: "<a:ThumbsUpBinks:964280524141101086>",
            triffianbow: "<a:TriffianBow:966052969432907866>",
            walddance: "<a:WaldDance:964282241968660511>",
            wattolol: "<a:WattoLOL:672640878736703509>",
            whatto: "<a:Whatto:672640891139260467>",
            xamsterdance: "<a:XamsterDance:965870334089764864>",
            countdown: "<a:countdown:672640791369482251>",
            guidearrow: "<a:guidearrow:891128437354401842>",
            newrecord: "<a:newrecord:672640831882133524>",
            speedo: "<a:speedo:672640865130381312>",
            wipeout: "<a:wipeout:672640904473083904>",
            restart: "<a:restart:855623455751143434>"
        }
        interaction.reply({ content: emojimap[interaction.options.getSubcommand()] })
    }

}
