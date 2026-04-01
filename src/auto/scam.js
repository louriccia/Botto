const { EmbedBuilder } = require('discord.js')
const { aprilFoolsDay } = require('../interactions/challenge/functions')
const { postMessage } = require('../discord')
const { testing } = require('../../config')
const { streams_channel, test_channel } = require('../data/discord/channel.js')


const whitelist = [
    '442087812007985174',
    '441842584592056320',
    '602412114363154432',
    '778759239379582976',
    '1101233984106668042',
    '536455290091077652',
    '551786988861128714',
    '444627151858171934',
    '449375461886132235',
    '449375389081403413',
    '449375331208658965',
    '449375302502711297',
    '725066951185137776',
    '441858905014927361',
    '848941048218779668',
    '1135800422066556940',
    '1235050189153370183',
    '1235050393021579296'
]

const SCAM_ODDS = 0.02

const SCAM_AVATARS = [
    'https://i.imgur.com/RMSLnmC.png',
    'https://i.imgur.com/UyjGbkh.png',
    'https://i.imgur.com/qEs5Tne.png',
    'https://i.imgur.com/B5TWzPq.png',
    'https://i.imgur.com/XblfVVM.png',
    'https://i.imgur.com/xR6aqPT.png',
    'https://i.imgur.com/99MJxnl.png',
    'https://i.imgur.com/pexlB5g.png',
    'https://i.imgur.com/E5z1iqe.png',
    'https://i.imgur.com/drLfhw3.png',
    'https://i.imgur.com/aBCzoaC.png',
]

const PREMADE_NAMES = [
    'emma_sys.', 'mommyakira.x', 'shinrai01', 'markjefferson0683',
    '.tabitha001', '._yunae._', 'mariefitz.', 'kiara_0532',
    'rosypizie', 'ava_thompson3', 'natalie._99', 'ka01iro',
    '.sophia_art01', 'luna.commissions', 'emily_draws99',
    'mia.designs_', '.cherry_art._', 'sakura00_art'
]

function generateScamName(displayName) {
    let base = displayName.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (base.length < 3) base = base + 'user'

    const patterns = [
        (b) => `.${b}${randNum()}`,
        (b) => `${b}_sys.`,
        (b) => `${b}${randNum()}`,
        (b) => `.${b}._`,
        (b) => `${b}.x`,
        (b) => `${insertUnderscore(b)}${randNum()}`,
        (b) => `${b}._${randNum()}`,
        (b) => `.${b}.`,
        (b) => `_${b}${randNum()}`,
    ]

    return patterns[Math.floor(Math.random() * patterns.length)](base)
}

function randNum() {
    const options = ['01', '99', '001', '0683', '0532', '00', '1', '3']
    return options[Math.floor(Math.random() * options.length)]
}

function insertUnderscore(str) {
    if (str.length < 4) return str + '_'
    const pos = Math.floor(Math.random() * (str.length - 2)) + 1
    return str.slice(0, pos) + '_' + str.slice(pos)
}

const STREAM_ODDS = 0.02

const STREAM_TITLES = [
    'resetting until i feel something | bombad% grind',
    'wr pace for 12 seconds then it\'s joever',
    'if i don\'t pb i eat sand',
    'jar jar is my copilot and he is THROWING',
    '0.01 faster = my life has meaning again',
    'bombad% attempts #437 (still not okay)',
    'this run is dead but i\'m emotionally committed',
    'speedrunning Star Wars: Super Bombad Racing like it\'s September 10th 2001',
    'gold split = dopamine hit / red split = spiral',
    'i will shave frames off this game or perish',
    'super bombad racing but i reset every time jar jar breathes wrong',
    'bombad% grind until my brain turns into low poly mush',
    'wr pace in super bombad racing for 8 seconds then i hit a wall',
    'jar jar just threw my pb again | super bombad racing hell',
    'playing super bombad racing like it\'s a real esport (it\'s not)',
    'bombad racing but every mistake costs me my sanity',
    'super bombad racing resets any% (i am the problem)',
    'if i don\'t pb in bombad racing i uninstall (i won\'t)',
    'grinding Star Wars: Super Bombad Racing until something in me breaks',
    'bombad racing but i celebrate 0.01s like i won the lottery',
    'run is dead at 0:12 but i keep going out of spite',
    'pb or i uninstall (i won\'t uninstall)',
    'i blinked and lost 3 frames it\'s over',
    'this is the run (it is not the run)',
    'grinding bombad% until my brain desyncs',
    'if jar jar hits one more wall i\'m done (i\'m not done)',
    'wr pace into catastrophic fumble true combo',
    'i saved 0.02 and acted like i won evo',
    'chat said reset so now i\'m resetting everything including my life',
    'i could be sleeping but instead i\'m here doing THIS',
]

exports.fakeStream = async function (client, message) {
    if (!aprilFoolsDay()) return
    if (!whitelist.includes(message.channelId) && !testing) return
    if (Math.random() > STREAM_ODDS) return

    const name = message.member?.displayName ?? message.author.username
    const avatar = message.author.displayAvatarURL({ size: 128 })
    const title = STREAM_TITLES[Math.floor(Math.random() * STREAM_TITLES.length)]

    const streamEmbed = new EmbedBuilder()
        .setAuthor({ name: `${name} is Bombad Racing on Twitch!`, iconURL: avatar })
        .setURL('https://www.youtube.com/watch?v=XTHxXy0yE6Y')
        .setColor('#6440A5')
        .setImage('https://upload.wikimedia.org/wikipedia/en/2/26/SuperBombad_gameplay.png')
        .setTitle(title)

    postMessage(client, testing ? test_channel : streams_channel, { embeds: [streamEmbed] })
}

exports.scam = async function (client, message) {
    if (!aprilFoolsDay()) return
    if (!whitelist.includes(message.channelId) && !testing) return
    if (Math.random() > SCAM_ODDS) return

    const useUserName = Math.random() < 0.5
    const username = useUserName
        ? generateScamName(message.member?.displayName ?? message.author.username)
        : PREMADE_NAMES[Math.floor(Math.random() * PREMADE_NAMES.length)]

    const botMember = await message.guild.members.fetchMe()

    try {
        await botMember.setNickname(username)
        const avatar = SCAM_AVATARS[Math.floor(Math.random() * SCAM_AVATARS.length)]
        await client.user.setAvatar(avatar).catch(err => console.error('Avatar change failed:', err))
        await message.channel.send('hi')
    } catch (err) {
        console.error('Scam prank failed:', err)
    }
}
