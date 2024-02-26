const { swe1r_guild } = require('./challenge/data.js');
const { postMessage, editMessage } = require('../discord_message.js');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');

const clues = [
    {
        title: 'Clue 1',
        text: 'test1',
        image: '',
        answer: 'test1'
    },
    {
        title: 'Clue 2',
        text: 'test2',
        image: '',
        answer: 'test2'
    },
    {
        title: 'Clue 3',
        text: 'test3',
        image: '',
        answer: 'test3'
    },
    {
        title: 'Clue 4',
        text: 'test4',
        image: '',
        answer: 'test4'
    },
    {
        title: 'Clue 5',
        text: 'test5',
        image: '',
        answer: 'test5'
    }
]

function cluecomponents(clue) {
    const DropRow = new ActionRowBuilder()
        .addComponents(new StringSelectMenuBuilder()
            .setCustomId(`scavenger_${clue}_dropdown`)
            .setPlaceholder('Clue Menu')
            .addOptions(
                {
                    label: 'Instructions',
                    value: 'intro'
                },
                ...clues.map((clue, i) => { return { label: `Clue ${i + 1}`, value: String(i) } })
            )
        )
    if (clue == 'intro') {
        return [DropRow]
    }
    const ClueButton = new ButtonBuilder()
        .setCustomId(`scavenger_${clue}_guess`)
        .setStyle(ButtonStyle.Primary)
        .setLabel(`Answer`)
    const ButtonRow = new ActionRowBuilder()
        .addComponents(ClueButton)
    return [DropRow, ButtonRow]
}

function cluembed(clue) {

    if (clue == 'intro'){
        const IntroEmbed = new EmbedBuilder()
        .setTitle('Welcome to the Scavenger Hunt')
        .setDescription(`This scavenger hunt is a series of 25 puzzles and challenges. To solve each puzzle, you will need to provide a password that unlocks the next clue. You are encouraged to work together in #25th anniversary, but please use spoiler text when confirming or denying answers.\n 
        \n
        Some important things to know before you start:\n
        * Every time you use this command, you can resume your progress and access all solved clues.\n
        * All answers are in English and all numeric answers should be written as digits “0123456789”\n
        * You don’t need to worry about casing, special characters, or whitespace in your answers.\n
         * Submitting “This is my answer!!!” is the same as “thisismyanswer”\n
         * There is no penalty for submitting a repeat guess\n
        * For each incorrect answer, you are timed out from making another guess for an increasing amount of time.\n
         * 1st incorrect guess - 6 minutes\n
         * 2nd incorrect guess - 30 minutes\n
         * 3rd incorrect guess - 2 hours\n
         * 4th incorrect guess - 6 hours\n
         * 5th or more incorrect guess - 12 hours\n
        \n
        Use the drop down 👇 to access your first clue!`)
        .setColor('#5865F2')
        return IntroEmbed
    }

    const ClueEmbed = new EmbedBuilder()
        .setTitle(clues[clue].title)
        .setDescription(clues[clue].text)
        .setColor('#5865F2')

    if (clues[clue].image) {
        ClueEmbed.setImage(clues[clue].image)
    }

    return ClueEmbed
}

function cluemessage(clue) {
    return { embeds: [cluembed(clue)], components: cluecomponents(clue), ephemeral: true }
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
            interaction.reply({ content: `**Congratulations! You win!**`, ephemeral: true })
            return
        }

        //slash command
        if (interaction.isChatInputCommand()) {
            interaction.reply(cluemessage(clue))
            return
        }

        //clicking an old button
        if (Number(interaction.customId.split('_')?.[1]) != clue) {
            interaction.reply(cluemessage(clue))
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
            interaction.reply(cluemessage(clue))
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