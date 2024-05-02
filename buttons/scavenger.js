const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');

let clues = process.env.SCAVENGER ? JSON.parse(process.env.SCAVENGER) : []

if (!clues.length) {
    clues_export = require('../clues.js')
    clues = clues_export.clues
}

const endEmbed = new EmbedBuilder()
    .setTitle('The End')
    .setDescription(clues[25]?.text)
    .setFooter({ text: 'Congratulations! You beat the scavenger hunt!' })
    .setColor("#FFFFFF")

function clueComponents(clue, progress) {
    let first_unsolved = progress.filter(p => p.solved).length + 1
    const DropRow = new ActionRowBuilder()
        .addComponents(new StringSelectMenuBuilder()
            .setCustomId(`scavenger_${clue}_dropdown`)
            .setPlaceholder('Clue Menu')
            .addOptions(
                ...clues.slice(0, first_unsolved).map(
                    (clue, i) => {
                        let solved = progress[i]?.solved
                        return {
                            label: `Clue ${i + 1}${solved ? ' (solved)' : ''}`,
                            value: String(i),
                            emoji: {
                                name: solved ? '✅' : '❓'
                            }
                        }
                    })
            )
        )
    let solved = progress[clue]?.solved
    const ClueButton = new ButtonBuilder()
        .setCustomId(`scavenger_${clue}_guess`)
        .setStyle(ButtonStyle.Primary)
        .setLabel(`Answer`)

    const HelpButton = new ButtonBuilder()
        .setCustomId(`scavenger_${clue}_help`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`❔`)

    if (solved) {
        ClueButton
            .setLabel('Solved')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
    }

    const ButtonRow = new ActionRowBuilder()
        .addComponents(ClueButton, HelpButton)
    return [DropRow, ButtonRow]
}

function clueEmbed(clue, progress, desc, footer) {
    if (clue == 'help') {
        const IntroEmbed = new EmbedBuilder()
            .setTitle('Welcome to the Scavenger Hunt')
            .setDescription(
                `This scavenger hunt is a series of 25 puzzles and challenges. To solve each puzzle, you need to provide a password that unlocks the next clue. You are encouraged to work together in <#1235050393021579296>, but please use spoiler text when confirming or denying answers.
                
        Some important things to know:
* Every time you use this command, you can resume your progress and access all solved clues.
* All answers are in English
* You don’t need to worry about casing, special characters, or whitespace in your answers. Submitting \`This is my answer!!!\` is the same as \`thisismyanswer\`
* For each incorrect answer, you are timed out from making another guess for an increasing amount of time. There is no penalty for resubmitting an incorrect guess.
 * 1st incorrect guess - 1 minute
 * 2nd incorrect guess - 5 minutes
 * 3rd incorrect guess - 20 minutes
 * 4th incorrect guess - 1 hour
 * 5th or more incorrect guess - 2 hours

        Use the drop down 👇 to change clues`)
            .setColor('#5865F2')


        return IntroEmbed
    }

    let solved = progress[clue]?.solved
    const ClueEmbed = new EmbedBuilder()
        .setTitle(`${solved ? '✅ ' : ''}${clues[clue].title}${solved ? ' (solved)' : ''}`)
        .setDescription(
            desc + '\n\n' +
            clues[clue].text +
            (progress[clue]?.guesses || solved ? '\n\nYour guesses:' : '') +
            (
                progress[clue]?.guesses ?
                    '\n' + Object.values(progress[clue].guesses).map(guess => `* ${guess} ❌`).join("\n")
                    : ''
            ) +
            (solved ? `\n* ${clues[clue].answer} ✅` : '')
        )
        .setColor(solved ? '#77B255' : '#5865F2')

    if (clues[clue].image) {
        ClueEmbed.setImage(clues[clue].image)
    }

    if (footer) {
        ClueEmbed.setFooter({ text: footer })
    }

    return ClueEmbed
}

function clueMessage(clue, progress, desc, footer) {
    return { embeds: [clueEmbed(clue, progress, desc, footer)], components: clueComponents(clue, progress), ephemeral: true }
}



module.exports = {
    name: 'scavenger',
    async execute(client, interaction, args, database, db) {
        let member = interaction.user.id

        let desc = ''
        let footer = ''


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

        function scavengerProgress(clue) {
            //get other players' progress
            let made_it = 0
            let solved_it = 0
            let total_guesses = 0
            let other_players = Object.keys(db.ch.scavenger).filter(u => u !== member)
            other_players.forEach(p => {
                let prog = db.ch.scavenger[p]
                if (clue == 0 || prog[clue - 1].solved) {
                    made_it++
                }
                if (prog[clue].solved) {
                    solved_it++
                    total_guesses += (prog[clue].guesses ? Object.keys(prog[clue].guesses).length + 1 : 1)
                }
            })
            footer = made_it ? `${made_it}/${other_players.length} other scavengers made it this far` : "You're the first scavenger to make it this far"
            if (solved_it) {
                footer += `\n${solved_it}/${made_it} solved this clue`
                if (total_guesses) {
                    footer += `\nAverage guesses: ${(total_guesses / solved_it).toFixed(1)}`
                }
            } else if (made_it) {
                footer += '\nNo one has solved this clue yet'
            }
            console.log(clue, made_it, solved_it, total_guesses)
            return footer
        }



        //help
        if (args.length > 1 && args[1] == 'help') {
            interaction.reply(clueMessage('help', progress, desc, scavengerProgress(clue)))
            return
        }

        //scavenger hunt completed
        if (db.ch.scavenger[member]?.solved) {
            interaction.reply({ embeds: [endEmbed], ephemeral: true })
            return
        }

        //slash command
        if (interaction.isChatInputCommand()) {
            interaction.reply(clueMessage(clue, progress, desc, scavengerProgress(clue)))
            return
        }

        //changing clue
        if (interaction.isStringSelectMenu()) {
            clue = interaction.values[0]
            await interaction.update(clueMessage(clue, progress, desc, scavengerProgress(clue)))
            return
        }

        //clicking an old button
        if (Number(interaction.customId.split('_')?.[1]) != clue) {
            interaction.reply(clueMessage(clue, progress, desc, scavengerProgress(clue)))
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

        //evaluate answer
        let answer = interaction.fields.getTextInputValue('answer')
        answer = answer.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')

        if (to && to > Date.now()) {
            desc = `:lock: **You are currently locked out of making a guess**.\nYou can submit your next guess <t:${Math.round(to / 1000)}:R>`
        } else if (answer === clues[clue].answer) {
            await database.ref(`challenge/scavenger/${member}/${clue}/solved`).set(true)
            clue++
            if (clue >= clues.length - 1) {
                await database.ref(`challenge/scavenger/${member}/solved`).set(true)
                interaction.reply({ embeds: [endEmbed], ephemeral: true })
                return
            }
            progress = db.ch.scavenger?.[member]
        } else if (guesses.includes(answer)) {
            desc = ` **You already made that guess!**\nPlease try again.`
        } else {
            //calculate timeout 
            let timeout = 60 * 1000
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
            await database.ref(`challenge/scavenger/${member}/${clue}/timeout`).set(timeout)
            await database.ref(`challenge/scavenger/${member}/${clue}/guesses`).push(answer)
            desc = `**Sorry, that's incorrect!**\nYou can submit your next guess <t:${Math.round(timeout / 1000)}:R>`
        }



        interaction.update(clueMessage(clue, progress, desc, scavengerProgress(clue)))
    }
}