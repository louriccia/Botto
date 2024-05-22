

exports.flavormap = {
    quote: {
        label: 'Quote',
        emoji: '<:quotes:1211508813824524380>',
        placeholder: '(if desired, type $player to insert the name of the player)'
    },
    tip: {
        label: 'Game Tip',
        emoji: '💡',
        placeholder: 'write a gameplay tip to help players race better'
    },
    fact: {
        label: 'Fun Fact',
        emoji: '💬',
        placeholder: 'write a fun fact about the game or movie'
    },
}

exports.settings_default = {
    winnings: 1,
    skips: 25,
    no_upgrades: 15,
    non_3_lap: 5,
    mirror_mode: 5,
    backwards: 5,
    predictions: true,
    flavor: true
}

exports.winnings_map = [
    { name: "Fair", text: "<:diamond:1136554333723435068> 36%\n<:platinum:1136554336705597510> 32%\n<:gold:1136554335426318406> 27%\n<:silver:1136554338895011850> 5%\n<:bronze:1136554332586786879> 0%" },
    { name: "Skilled", text: "<:diamond:1136554333723435068> 55%\n<:platinum:1136554336705597510> 27%\n<:gold:1136554335426318406> 14%\n<:silver:1136554338895011850> 5%\n<:bronze:1136554332586786879> 0%" },
    { name: "Winner Takes All", text: "<:diamond:1136554333723435068> 100%\n<:platinum:1136554336705597510> 0%\n<:gold:1136554335426318406> 0%\n<:silver:1136554338895011850> 0%\n<:bronze:1136554332586786879> 0%" }
]

