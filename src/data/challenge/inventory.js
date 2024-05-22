exports.inventorySections = [
    {
        label: 'Collections',
        value: 'collections',
        description: 'Complete collections and claim rewards',
        emoji: {
            name: '🗃'
        },
        info: "Select a collection to view its progress and claim a reward. When a reward is claimed, items in that collection become locked and can no longer be scrapped, traded, or count toward collections. However, droids and parts can still be used in repairs and crafting.",
        abilities: []
    },
    {
        label: 'Special Items',
        value: 'usables',
        description: 'Use Trugut Boosts, Sabotage Kits, and Collectible Coffers',
        emoji: {
            name: '💥'
        },
        info: "Use your special items. Special items can be obtained from progression rewards (Level 10, 26+) and occasionaly from challenges.",
        abilities: ['doubled_powers', 'favor_ancients']
    },
    {
        label: 'Trade Federation',
        value: 'trade',
        description: "Browse other players' items and invite them to trade",
        emoji: {
            name: '↔'
        },
        info: "Trade items and truguts with other players!",
        abilities: []
    },
    {
        label: 'Trash Compactor',
        value: 'duplicates',
        description: 'Scrap and reroll items',
        emoji: {
            name: '♻'
        },
        info: "Turn your items into scrap and truguts!",
        abilities: ['efficient_scrapper', 'sarlacc_snack']
    },
    {
        label: 'Pit Crew',
        value: 'droids',
        description: 'Manage your droids and repair parts',
        emoji: {
            name: '🔧'
        },
        info: "Task your droids to damaged parts to repair them back to full health. ",
        abilities: ['pitdroid_team']
    },
    {
        label: 'Roles',
        value: 'roles',
        description: 'Equip and unequip your special roles',
        emoji: {
            name: '🏷'
        },
        info: "Manage your special roles!\n**<:anakin:671598858983178251> Racer Fan Role**: Join a racer fandom and rep their flag as your role icon. This is a free role that can be selected in <id:customize>.\n\n**<:tatooine:862053955860168734> Citizen Role**: Unlock by completing its respective collection. Declare your planetary citizenship and get free bribes and rerolls on this planet's tracks while its role is equiped.\n\n**✨Emoji Icon Role**: Can be purchased at Botto's shop. Displays a SWE1R Discord emoji as your role icon.\n\n**🎨Trillion Trugut Tri-Coat**: The most expensive role in the galaxy. Can be purchased at Botto's shop. Its color can be changed at any time.",
        abilities: ['fan_service']
    }
]