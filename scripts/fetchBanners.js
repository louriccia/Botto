// One-off: pull every banner image in src/data/discord/banner.js down to disk
// so the bot stops hotlinking Discord CDN attachments, whose signed URLs
// rotate and 404.
//
//   node scripts/fetchBanners.js [outDir]

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const Jimp = require('jimp')
const { banners } = require('../src/data/discord/banner.js')

const OUT_DIR = process.argv[2] || path.join(__dirname, '..', 'src', 'resources', 'img', 'banners')
const API = 'https://discord.com/api/v10'
const auth = { Authorization: `Bot ${process.env.token}` }

const isDiscord = url => /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//.test(url)

// refresh-urls only accepts canonical cdn.discordapp.com links with no query.
function canonical(url) {
    const u = new URL(url)
    return `https://cdn.discordapp.com${u.pathname}`
}

async function refreshUrls(urls) {
    const out = {}
    for (let i = 0; i < urls.length; i += 50) {
        const chunk = urls.slice(i, i + 50)
        const res = await fetch(`${API}/attachments/refresh-urls`, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachment_urls: chunk })
        })
        if (!res.ok) throw new Error(`refresh-urls ${res.status}: ${await res.text()}`)
        const body = await res.json()
        body.refreshed_urls.forEach(r => { out[r.original] = r.refreshed })
        console.log(`refreshed ${Object.keys(out).length}/${urls.length}`)
    }
    return out
}

const used = new Set()
function filenameFor(url) {
    const base = decodeURIComponent(new URL(url).pathname.split('/').pop())
    let name = path.basename(base, path.extname(base))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'banner'
    let candidate = `${name}.jpg`
    let n = 2
    while (used.has(candidate)) candidate = `${name}_${n++}.jpg`
    used.add(candidate)
    return candidate
}

// Originals total ~100 MB; guild banners render around 960x540, so store them
// at display size as jpeg to keep the repo (and Heroku slug) sane.
const MAX_WIDTH = 1280
const QUALITY = 85
async function normalize(buffer) {
    const image = await Jimp.read(buffer)
    if (image.bitmap.width > MAX_WIDTH) image.resize(MAX_WIDTH, Jimp.AUTO)
    return image.quality(QUALITY).getBufferAsync(Jimp.MIME_JPEG)
}

async function main() {
    if (!process.env.token) throw new Error('missing bot token in env')
    fs.mkdirSync(OUT_DIR, { recursive: true })

    const discordUrls = [...new Set(banners.filter(isDiscord).map(canonical))]
    const refreshed = await refreshUrls(discordUrls)

    const results = []
    for (const original of banners) {
        const fetchUrl = isDiscord(original) ? refreshed[canonical(original)] : original
        const name = filenameFor(original)
        if (!fetchUrl) {
            results.push({ original, name, ok: false, why: 'no refreshed url' })
            continue
        }
        try {
            const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const raw = Buffer.from(await res.arrayBuffer())
            if (raw.length < 1024) throw new Error(`suspiciously small (${raw.length}b)`)
            const buffer = await normalize(raw)
            fs.writeFileSync(path.join(OUT_DIR, name), buffer)
            results.push({ original, name, ok: true, bytes: buffer.length })
            console.log(`ok   ${name} (${Math.round(buffer.length / 1024)} KB)`)
        } catch (err) {
            results.push({ original, name, ok: false, why: err.message })
            console.log(`FAIL ${name}: ${err.message}`)
        }
    }

    fs.writeFileSync(path.join(OUT_DIR, '_manifest.json'), JSON.stringify(results, null, 2))
    const ok = results.filter(r => r.ok)
    console.log(`\n${ok.length}/${results.length} saved, ${Math.round(ok.reduce((a, r) => a + r.bytes, 0) / 1048576 * 10) / 10} MB total`)
    results.filter(r => !r.ok).forEach(r => console.log(`  missing: ${r.name} <- ${r.original.slice(0, 90)} (${r.why})`))
}

main().catch(err => { console.error(err); process.exit(1) })
