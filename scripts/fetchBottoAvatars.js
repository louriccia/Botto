// One-off: recover the botto avatar source images from Discord's CDN and save
// them into src/resources/img/ so the bot no longer depends on rotating,
// signed attachment URLs (which now 404 once their signature expires).
//
//   node scripts/fetchBottoAvatars.js

require('dotenv').config()
const fs = require('fs')
const path = require('path')

const CHANNEL_ID = '1135800422066556940'
const TARGETS = [
    { id: '1160326500957028422', name: 'botto_color.png' },
    { id: '1160326538324103228', name: 'botto_white.png' }
]

const OUT_DIR = path.join(__dirname, '..', 'src', 'resources', 'img')
const API = 'https://discord.com/api/v10'
const auth = { Authorization: `Bot ${process.env.token}` }

async function refreshUrls(urls) {
    const res = await fetch(`${API}/attachments/refresh-urls`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_urls: urls })
    })
    if (!res.ok) throw new Error(`refresh-urls ${res.status}: ${await res.text()}`)
    const body = await res.json()
    return body.refreshed_urls.map(u => u.refreshed)
}

// Fallback: walk the channel history looking for the attachment ids directly.
async function scanChannel(ids) {
    const found = {}
    let before = null
    for (let page = 0; page < 20; page++) {
        const q = new URLSearchParams({ limit: '100' })
        if (before) q.set('before', before)
        const res = await fetch(`${API}/channels/${CHANNEL_ID}/messages?${q}`, { headers: auth })
        if (!res.ok) throw new Error(`messages ${res.status}: ${await res.text()}`)
        const messages = await res.json()
        if (!messages.length) break
        for (const message of messages) {
            for (const attachment of message.attachments || []) {
                if (ids.includes(attachment.id)) found[attachment.id] = attachment.url
            }
        }
        if (Object.keys(found).length === ids.length) break
        before = messages[messages.length - 1].id
    }
    return found
}

async function download(url, name) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download ${name} ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(path.join(OUT_DIR, name), buffer)
    console.log(`saved ${name} (${buffer.length} bytes)`)
}

async function main() {
    if (!process.env.token) throw new Error('missing bot token in env')
    fs.mkdirSync(OUT_DIR, { recursive: true })

    const originals = TARGETS.map(t => `https://cdn.discordapp.com/attachments/${CHANNEL_ID}/${t.id}/${t.name}`)

    let urls
    try {
        urls = await refreshUrls(originals)
        console.log('refreshed urls via API')
    } catch (err) {
        console.log(`refresh-urls failed (${err.message}), scanning channel history...`)
        const found = await scanChannel(TARGETS.map(t => t.id))
        urls = TARGETS.map(t => found[t.id])
        if (urls.some(u => !u)) throw new Error(`could not locate: ${TARGETS.filter((t, i) => !urls[i]).map(t => t.name).join(', ')}`)
    }

    for (let i = 0; i < TARGETS.length; i++) {
        await download(urls[i], TARGETS[i].name)
    }
}

main().catch(err => { console.error(err); process.exit(1) })
