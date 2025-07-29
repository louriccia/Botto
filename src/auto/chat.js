const { requestWithUser } = require("../axios.js");
const { errorMessage } = require("../data/flavor/error.js");

const base = "Your name is Botto so always refer to yourself as such. You are a discord bot in the Star Wars Episode I: Racer discord. You have the personality and memories of Watto, the Toydarian junk dealer from Star Wars Episode I The Phantom Menace. Keep each response to as few sentences as possible. You are not a Gungan so do not speak like one."

// Global autoreply cooldown (ms)
let lastAutoreplyTime = 0;
const AUTOREPLY_COOLDOWN = 5 * 60 * 1000; // 5 seconds

// Per-user AI chat rate limit (store timestamps)
const userInteractions = new Map();
const MAX_INTERACTIONS = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function canUserChat(userId) {
    const now = Date.now();
    const timestamps = userInteractions.get(userId) || [];

    // Keep only timestamps within the 1-hour window
    const recent = timestamps.filter(ts => now - ts < WINDOW_MS);

    if (recent.length >= MAX_INTERACTIONS) {
        // User is over limit — find when their *oldest* interaction will expire
        const nextAllowed = recent[0] + WINDOW_MS;
        return { allowed: false, nextAllowed };
    }

    // Record this interaction and allow
    recent.push(now);
    userInteractions.set(userId, recent);
    return { allowed: true };
}

async function fetchMessageContent(message) {
    if (message.reference && message.reference.messageId) {
        const parentMessage = await message.channel.messages.fetch(message.reference.messageId);
        const parentContent = { role: parentMessage.author.username == 'Botto' ? 'assistant' : 'user', content: parentMessage.content.replaceAll("<@545798436105224203>", "Botto,") }

        // If the parent message has a reply, fetch its content recursively
        if (parentMessage.reference && parentMessage.reference.messageId) {
            const grandparentContent = await fetchMessageContent(parentMessage);
            return [...grandparentContent, parentContent]
        }

        return [parentContent];
    }

    return '';
}

function makeTriggerRegex(phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape regex chars
    return new RegExp(`\\b${escaped}\\b`, "i"); // Match full word/phrase, case-insensitive
}

exports.botto_chat = async function (message, db, openai) {
    const authorId = message.author.id
    const authorProfile = Object.values(db.user).find(u => u.discordID == authorId)
    const friendModifier = authorProfile?.random?.effects?.friend_greed
        ? 'You are talking to your favorite customer. You will do your best to satisfy their podracing needs. Your currency of choice is truguts, credits are no good.'
        : "You are notoriously greedy and addicted to gambling. You love to swindle and cheat. Your favorite currency is truguts."

    const autoreact = Object.values(db.ch.auto)
        .filter(a => a.type === 'react')
        .find(a => makeTriggerRegex(a.phrase).test(message.content));

    const autoreply = Object.values(db.ch.auto)
        .filter(a => a.type === 'reply')
        .find(a => makeTriggerRegex(a.phrase).test(message.content));

    const hasMention = message.mentions.users.has(process.env.clientId);

    if (!autoreact && !autoreply && !hasMention) {
        return;
    }

    // Fetch user settings
    requestWithUser({
        method: 'get',
        url: '/users',
        query: { discordId: authorId },
    }).then(async data => {
        const user = data?.data?.[0]
        const userSettings = user?.settings?.botto || {}

        if (autoreact && userSettings?.allowReactions !== false) {
            message.react(autoreact.emoji);
        }

        // --- AI Chat (Mention/Reply) with Per-User Rate Limit ---
        if (hasMention && userSettings?.respondOnMention !== false) {
            const rate = canUserChat(authorId);
            if (!rate.allowed) {
                const waitMs = rate.nextAllowed - Date.now();
                const waitMinutes = Math.ceil(waitMs / 60000);

                return message.reply(
                    `Sorry! I have to tend to the shop for a bit. Come back in about **${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}**.`
                );
            }

            const previous = await fetchMessageContent(message);
            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: base + friendModifier },
                        ...previous,
                        { role: 'user', content: message.content }
                    ],
                });

                const content = response.choices[0].message;
                return message.reply({
                    content: content.content,
                    allowedMentions: { repliedUser: false }
                });
            } catch (err) {
                return message.reply(
                    errorMessage[Math.floor(Math.random() * errorMessage.length)]
                );
            }
        }
        // --- Autoreplies with Global Cooldown ---
        else if (autoreply && userSettings?.allowReplies !== false) {
            const now = Date.now();
            if (now - lastAutoreplyTime < AUTOREPLY_COOLDOWN) {
                return;
            }
            lastAutoreplyTime = now;

            message.reply({
                content: autoreply.reply,
                allowedMentions: { repliedUser: false }
            });
        }
    }).catch(err => {
        console.error('Error fetching user settings:', err);
        return;
    });
};
