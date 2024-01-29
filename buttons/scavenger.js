const { swe1r_guild } = require('./challenge/data.js');
const { postMessage, editMessage } = require('../discord_message.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');

const clues = [
    {
        title: 'test1',
        text: 'test1',
        image: '',
        answer: 'test1'
    },
    {
        title: 'test2',
        text: 'test2',
        image: '',
        answer: 'test2'
    },
    {
        title: 'test3',
        text: 'test3',
        image: '',
        answer: 'test3'
    },
    {
        title: 'test4',
        text: 'test4',
        image: '',
        answer: 'test4'
    },
    {
        title: 'test5',
        text: 'test5',
        image: '',
        answer: 'test5'
    }
]

function cluembed(clue) {
    const ClueEmbed = new EmbedBuilder()
        .setTitle(clues[clue].title)
        .setDescription(clues[clue].text)
        .setColor('#5865F2')

    if (clues[clue].image) {
        ClueEmbed.setImage(clues[clue].image)
    }

    const ClueButton = new ButtonBuilder()
        .setCustomId(`scavenger_${clue}`)
        .setStyle(ButtonStyle.Primary)
        .setLabel(`Answer`)

    const ActionRow = new ActionRowBuilder()
        .addComponents(ClueButton)
    return { embeds: [ClueEmbed], components: [ActionRow], ephemeral: true }
}

module.exports = {
    name: 'scavenger',
    async execute(client, interaction, args, database, db) {
        let member = interaction.user.id
        const Guild = interaction.guild
        const SWE1R_Guild = await client.guilds.cache.get("441839750555369474")
        const Member = await Guild.members.fetch(member)
        const name = interaction.member.displayName
        const avatar = await interaction.member.displayAvatarURL()
        var tools = require('../tools.js');

        if (!database) {
            interaction.reply({ content: 'Impossible, the archives must be... down?', ephemeral: true })
            return
        }

        let progress = db.ch.scavenger?.[member]

        //initialize progress
        if (!progress) {
            let answers = {}
            for (let i = 0; i < 25; i++) {
                answers[i] = {
                    guesses: '',
                    solved: false
                }
            }
            database.ref(`challenge/scavenger/${member}`).set(
                answers
            )

            progress = db.ch.scavenger?.[member]
        }

        //calculate clue index
        let clue = null
        for (let i = 0; i < 25; i++) {
            if (!progress[i]?.solved) {
                clue = i
                break
            }
        }

        //scavenger hunt completed
        if (db.ch.scavenger[member]?.solved) {
            interaction.reply({ content: `**Congradtulations! You win!**`, ephemeral: true })
            return
        }

        //slash command
        if (interaction.isChatInputCommand()) {
            interaction.reply(cluembed(clue))
            return
        }

        //clicking an old button
        if (Number(interaction.customId.split('_')?.[1]) != clue) {
            interaction.reply(cluembed(clue))
            return
        }

        //clicking new button
        if (!interaction.isModalSubmit()) {
            //construct modal
            const scavengerModal = new ModalBuilder()
                .setCustomId(`scavenger_${clue}`)
                .setTitle(`Clue ${clue + 1}`)
            const guess = new TextInputBuilder()
                .setCustomId('answer')
                .setLabel('Answer')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            const ActionRow1 = new ActionRowBuilder().addComponents(guess)
            scavengerModal.addComponents(ActionRow1)
            await interaction.showModal(scavengerModal)
            return
        }

        //check if user can submit a guess
        let to = db.ch.scavenger[member]?.[clue]?.timeout
        let guesses = db.ch.scavenger[member]?.[clue]?.guesses
        guesses = guesses ? Object.values(guesses) : guesses
        if (to && to > Date.now()) {
            console.log(guesses)
            interaction.reply({ content: `:lock: **You are currently locked out of making a guess**.\nYou can submit your next guess <t:${Math.round(to / 1000)}:R>\n\nYour guesses so far:\n${guesses.map(guess => `* ${guess}`).join("\n")}`, ephemeral: true })
            return
        }

        //finally, evaluate answer
        let answer = interaction.fields.getTextInputValue('answer')
        answer = answer.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')

        if (answer === clues[clue].answer) {
            database.ref(`challenge/scavenger/${member}/${clue}/solved`).set(true)
            clue++
            if (clue >= clues.length) {
                database.ref(`challenge/scavenger/${member}/solved`).set(true)
                interaction.reply({ content: `**Congradtulations! You win!**`, ephemeral: true })
                return
            }
            interaction.reply(cluembed(clue))
        } else if (guesses.includes(answer)) {
            interaction.reply({ content: ` **You already made that guess!**\nPlease try again.\n\nYour guesses so far:\n${guesses.map(guess => `* ${guess}`).join("\n")}`, ephemeral: true })
        } else {
            //calculate timeout 
            let timeout = 6 * 60 * 1000
            let timeout_multiplier = 5
            let guesses_made = db.ch.scavenger[member]?.[clue]?.guesses
            guesses_made = guesses_made ? Object.values(guesses_made).length : guesses_made
            if (guesses_made) {
                for (let i = 0; i < guesses_made; i++) {
                    if (timeout_multiplier < 1) {
                        break
                    }
                    timeout *= timeout_multiplier
                    timeout_multiplier--
                }
            }
            timeout = Date.now() + timeout
            database.ref(`challenge/scavenger/${member}/${clue}/timeout`).set(timeout)
            database.ref(`challenge/scavenger/${member}/${clue}/guesses`).push(answer)
            interaction.reply({ content: `**Sorry, that's incorrect!**\nYou can submit your next guess <t:${Math.round(timeout / 1000)}:R>`, ephemeral: true })
        }
        return
    }
}