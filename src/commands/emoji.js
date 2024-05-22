const { SlashCommandBuilder } = require('discord.js');
const { emoji_id } = require('../data/discord/emoji');

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
    restart: "<a:restart:855623455751143434>",
    chancecube: "<a:chance_cube:1235055236138270760>",
    dyegone: "<a:DyeGon:1235055298281209886>"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('post animated emotes by proxy')
        .addStringOption(option =>
            option.setName('emoji_name')
                .setDescription('name of the animated emoji you wish to use')
                .setAutocomplete(true)
                .setRequired(true)
        ),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const filtered = Object.keys(emojimap).filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice, value: choice })),
        );
    },
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        let emoji_name = interaction.options.getString("emoji_name")
        interaction.reply({ content: emojimap[emoji_name] })
    }

}
