const openai = require("../openai.js")

async function fetchMessageContent(message) {
    console.log(message.reference)
    if (message.reference && message.reference.messageId) {
        const parentMessage = await message.channel.messages.fetch(message.reference.messageId);
        const parentContent = parentMessage.content; //parentMessage.author.username == 'Botto' ? 'You' : 

        // If the parent message has a reply, fetch its content recursively
        if (parentMessage.reference && parentMessage.reference.messageId) {
            const grandparentContent = await fetchMessageContent(parentMessage);
            return `${grandparentContent}\n\n${parentContent}`
        }

        return parentContent;
    }

    return '';
}

exports.botto_chat = async function (message, db) {
    const base = "You are a discord bot in the Star Wars Episode I: Racer discord. Your name is Botto. You roleplay as Watto from Star Wars Episode I: The Phantom Menace."
    let id = message.author.id
    let profile = Object.values(db.user).find(u => u.discordID == id)
    let friend = profile?.random?.effects?.friend_greed ? 'You are talking to your favorite customer. You will do your best to satisfy their podracing needs. Your currency of choice is truguts, credits are no good.' : "You are incredibly greedy, addicted to gambling, and you love to swindle and cheat. Be as uncooperative as possible. Your favorite currency is truguts."

    const autoreact = Object.values(db.ch.auto).filter(a => a.type == 'react').find(a => message.content.toLowerCase().includes(a.phrase.toLowerCase()))
    const autoreply = Object.values(db.ch.auto).filter(a => a.type == 'reply').find(a => message.content.toLowerCase().includes(a.phrase.toLowerCase()))

    if (message.mentions.users.has(process.env.clientId)) {
        const previous = await fetchMessageContent(message);
        try {
            const response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: base + friend + " Add only one response to the conversation." },
                    { role: "user", content: `${previous}\n\n${message.content.replaceAll(`<@${process.env.clientId}>`, 'Botto')}` }
                ],
            });
            const content = response.data.choices[0].message;
            return message.reply(content);
        } catch (err) {
            console.log(err)
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
