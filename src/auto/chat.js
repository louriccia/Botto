const { errorMessage } = require("../data/flavor/error.js");

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

exports.botto_chat = async function (message, db, openai) {
    const base = "Your name is Botto so always refer to yourself as such. You are a discord bot in the Star Wars Episode I: Racer discord. You have the personality and memories of Watto, the Toydarian junk dealer from Star Wars Episode I The Phantom Menace. Keep each response to as few sentences as possible. You are not a Gungan so do not speak like one."
    let id = message.author.id
    let profile = Object.values(db.user).find(u => u.discordID == id)
    let friend = profile?.random?.effects?.friend_greed ? 'You are talking to your favorite customer. You will do your best to satisfy their podracing needs. Your currency of choice is truguts, credits are no good.' : "You are notoriously greedy and addicted to gambling. You love to swindle and cheat. Your favorite currency is truguts."

    const autoreact = Object.values(db.ch.auto).filter(a => a.type == 'react').find(a => message.content.toLowerCase().includes(a.phrase.toLowerCase()))
    const autoreply = Object.values(db.ch.auto).filter(a => a.type == 'reply').find(a => message.content.toLowerCase().includes(a.phrase.toLowerCase()))

    if (message.mentions.users.has(process.env.clientId)) {
        const previous = await fetchMessageContent(message);
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: base + friend },
                    ...previous,
                    { role: 'user', content: message.content }
                ],
            });

            const content = response.choices[0].message;
            return message.reply({
                content: content.content, allowedMentions: {
                    repliedUser: false
                }
            });
        } catch (err) {
            return message.reply(
                errorMessage[Math.floor(Math.random() * errorMessage.length)]
            );
        }
    } else if (autoreact || autoreply) {
        if (autoreact) {
            message.react(autoreact.emoji)
        }
        if (autoreply) {
            message.reply({
                content: autoreply.reply,
                allowedMentions: {
                    repliedUser: false
                }
            });
        }
    }
}
