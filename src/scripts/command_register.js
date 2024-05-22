exports.commands = [
    {
        name: 'convert',
        description: 'convert seconds to --:--.--- format and vice versa; supports basic arithmetic (+-*/)',
        options: [
            {
                name: "time",
                description: "the time/equation you wish to convert or evaluate",
                type: 3,
                required: true
            }
        ]
    }, {
        name: 'help',
        description: 'helpful information about botto commands and other stuff',
        options: [
            {
                name: "commands",
                description: "get a list of Botto's commands and descriptions for how to use them",
                type: 1
            },
            {
                name: "abbreviations",
                description: "get a list of commonly used abbreviations for Star Wars Episode I: Racer",
                type: 1
            }
        ]
    }, {
        name: 'links',
        description: 'quickly get the most commonly shared links on the SWE1R Discord',
        options: [
            {
                name: "botto",
                description: "Botto related links",
                type: 2,
                options: [
                    {
                        name: "github",
                        description: "posts a link to Botto's github page",
                        type: 1
                    },
                    {
                        name: "graphics",
                        description: "posts imgur links to the graphics that Botto uses",
                        type: 1
                    },
                    {
                        name: "invite",
                        description: "posts a link to invite Botto to your Discord",
                        type: 1
                    }
                ]
            },
            {
                name: "drive",
                description: "posts a link to the community Google Drive",
                type: 1
            },
            {
                name: "speedrunning",
                description: "posts a collection of links to various leaderboards across the web",
                type: 1
            },
            {
                name: "mp_guide",
                description: "posts a link to the online multiplayer guide",
                type: 1
            },
            {
                name: "stats",
                description: "posts a link to the pod and track statistics sheet",
                type: 1
            },
            {
                name: "src_resources",
                description: "posts a link to the SWE1R speedrun.com resources page",
                type: 1
            },
            {
                name: "rtss",
                description: "posts a link to download rivatuner for limiting the game's framerate",
                type: 1
            },
            {
                name: "dgvoodoo",
                description: "posts a link to download dgvoodoo for running the game in windowed mode",
                type: 1
            }
        ]
    }, {
        name: 'lookup',
        description: 'get information for racers, tracks, and more',
        options: [
            {
                name: "racer",
                description: "get information for a specific racer",
                type: 1,
                options: [
                    {
                        name: "name",
                        description: "racer's name",
                        type: 3,
                        required: true,
                        choices: [
                            {
                                name: "Anakin Skywalker",
                                value: "0"
                            },
                            {
                                name: "Teemto Pagalies",
                                value: "1"
                            },
                            {
                                name: "Sebulba",
                                value: "2"
                            },
                            {
                                name: "Ratts Tyerell",
                                value: "3"
                            },
                            {
                                name: "Aldar Beedo",
                                value: "4"
                            },
                            {
                                name: "Mawhonic",
                                value: "5"
                            },
                            {
                                name: "Ark 'Bumpy' Roose",
                                value: "6"
                            },
                            {
                                name: "Wan Sandage",
                                value: "7"
                            },
                            {
                                name: "Mars Guo",
                                value: "8"
                            },
                            {
                                name: "Ebe Endocott",
                                value: "9"
                            },
                            {
                                name: "Dud Bolt",
                                value: "10"
                            },
                            {
                                name: "Gasgano",
                                value: "11"
                            },
                            {
                                name: "Clegg Holdfast",
                                value: "12"
                            },
                            {
                                name: "Elan Mak",
                                value: "13"
                            },
                            {
                                name: "Neva Kee",
                                value: "14"
                            },
                            {
                                name: "Bozzie Baranta",
                                value: "15"
                            },
                            {
                                name: "Boles Roor",
                                value: "16"
                            },
                            {
                                name: "Ody Mandrell",
                                value: "17"
                            },
                            {
                                name: "Fud Sang",
                                value: "18"
                            },
                            {
                                name: "Ben Quadinaros",
                                value: "19"
                            },
                            {
                                name: "Slide Paramita",
                                value: "20"
                            },
                            {
                                name: "Toy Dampner",
                                value: "21"
                            },
                            {
                                name: "'Bullseye' Navior",
                                value: "22"
                            }
                        ]
                    }
                ]
            },
            {
                name: "track",
                description: "get information for a specific track",
                type: 1,
                options: [
                    {
                        name: "name",
                        description: "track name",
                        type: 3,
                        required: true,
                        choices: [
                            {
                                name: "The Boonta Training Course",
                                value: "0"
                            },
                            {
                                name: "Mon Gazza Speedway",
                                value: "1"
                            },
                            {
                                name: "Beedo's Wild Ride",
                                value: "2"
                            },
                            {
                                name: "Aquilaris Classic",
                                value: "3"
                            },
                            {
                                name: "Malastare 100",
                                value: "4"
                            },
                            {
                                name: "Vengeance",
                                value: "5"
                            },
                            {
                                name: "Spice Mine Run",
                                value: "6"
                            },
                            {
                                name: "Sunken City",
                                value: "7"
                            },
                            {
                                name: "Howler Gorge",
                                value: "8"
                            },
                            {
                                name: "Dug Derby",
                                value: "9"
                            },
                            {
                                name: "Scrapper's Run",
                                value: "10"
                            },
                            {
                                name: "Zugga Challenge",
                                value: "11"
                            },
                            {
                                name: "Baroo Coast",
                                value: "12"
                            },
                            {
                                name: "Bumpy's Breakers",
                                value: "13"
                            },
                            {
                                name: "Executioner",
                                value: "14"
                            },
                            {
                                name: "Sebulba's Legacy",
                                value: "15"
                            },
                            {
                                name: "Grabvine Gateway",
                                value: "16"
                            },
                            {
                                name: "Andobi Mountain Run",
                                value: "17"
                            },
                            {
                                name: "Dethro's Revenge",
                                value: "18"
                            },
                            {
                                name: "Fire Mountain Rally",
                                value: "19"
                            },
                            {
                                name: "The Boonta Classic",
                                value: "20"
                            },
                            {
                                name: "Ando Prime Centrum",
                                value: "21"
                            },
                            {
                                name: "Abyss",
                                value: "22"
                            },
                            {
                                name: "The Gauntlet",
                                value: "23"
                            },
                            {
                                name: "Inferno",
                                value: "24"
                            }
                        ]
                    },
                ]
            },
            {
                name: "times",
                description: "get par times or projected goal times for each track and racer",
                type: 2,
                options: [
                    {
                        name: "par_times",
                        description: "look up the speedrunning par times for a specific track",
                        type: 1,
                        options: [
                            {
                                name: "track",
                                description: "track name or abbreviation",
                                type: 3,
                                required: true,
                                choices: [
                                    {
                                        name: "The Boonta Training Course",
                                        value: "0"
                                    },
                                    {
                                        name: "Mon Gazza Speedway",
                                        value: "1"
                                    },
                                    {
                                        name: "Beedo's Wild Ride",
                                        value: "2"
                                    },
                                    {
                                        name: "Aquilaris Classic",
                                        value: "3"
                                    },
                                    {
                                        name: "Malastare 100",
                                        value: "4"
                                    },
                                    {
                                        name: "Vengeance",
                                        value: "5"
                                    },
                                    {
                                        name: "Spice Mine Run",
                                        value: "6"
                                    },
                                    {
                                        name: "Sunken City",
                                        value: "7"
                                    },
                                    {
                                        name: "Howler Gorge",
                                        value: "8"
                                    },
                                    {
                                        name: "Dug Derby",
                                        value: "9"
                                    },
                                    {
                                        name: "Scrapper's Run",
                                        value: "10"
                                    },
                                    {
                                        name: "Zugga Challenge",
                                        value: "11"
                                    },
                                    {
                                        name: "Baroo Coast",
                                        value: "12"
                                    },
                                    {
                                        name: "Bumpy's Breakers",
                                        value: "13"
                                    },
                                    {
                                        name: "Executioner",
                                        value: "14"
                                    },
                                    {
                                        name: "Sebulba's Legacy",
                                        value: "15"
                                    },
                                    {
                                        name: "Grabvine Gateway",
                                        value: "16"
                                    },
                                    {
                                        name: "Andobi Mountain Run",
                                        value: "17"
                                    },
                                    {
                                        name: "Dethro's Revenge",
                                        value: "18"
                                    },
                                    {
                                        name: "Fire Mountain Rally",
                                        value: "19"
                                    },
                                    {
                                        name: "The Boonta Classic",
                                        value: "20"
                                    },
                                    {
                                        name: "Ando Prime Centrum",
                                        value: "21"
                                    },
                                    {
                                        name: "Abyss",
                                        value: "22"
                                    },
                                    {
                                        name: "The Gauntlet",
                                        value: "23"
                                    },
                                    {
                                        name: "Inferno",
                                        value: "24"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: "goal_times",
                        description: "get projected goal times for each pod, track, and upgrade",
                        type: 1,
                        options: [
                            {
                                name: "track",
                                description: "track name",
                                type: 3,
                                required: true,
                                choices: [
                                    {
                                        name: "The Boonta Training Course",
                                        value: "0"
                                    },
                                    {
                                        name: "Mon Gazza Speedway",
                                        value: "1"
                                    },
                                    {
                                        name: "Beedo's Wild Ride",
                                        value: "2"
                                    },
                                    {
                                        name: "Aquilaris Classic",
                                        value: "3"
                                    },
                                    {
                                        name: "Malastare 100",
                                        value: "4"
                                    },
                                    {
                                        name: "Vengeance",
                                        value: "5"
                                    },
                                    {
                                        name: "Spice Mine Run",
                                        value: "6"
                                    },
                                    {
                                        name: "Sunken City",
                                        value: "7"
                                    },
                                    {
                                        name: "Howler Gorge",
                                        value: "8"
                                    },
                                    {
                                        name: "Dug Derby",
                                        value: "9"
                                    },
                                    {
                                        name: "Scrapper's Run",
                                        value: "10"
                                    },
                                    {
                                        name: "Zugga Challenge",
                                        value: "11"
                                    },
                                    {
                                        name: "Baroo Coast",
                                        value: "12"
                                    },
                                    {
                                        name: "Bumpy's Breakers",
                                        value: "13"
                                    },
                                    {
                                        name: "Executioner",
                                        value: "14"
                                    },
                                    {
                                        name: "Sebulba's Legacy",
                                        value: "15"
                                    },
                                    {
                                        name: "Grabvine Gateway",
                                        value: "16"
                                    },
                                    {
                                        name: "Andobi Mountain Run",
                                        value: "17"
                                    },
                                    {
                                        name: "Dethro's Revenge",
                                        value: "18"
                                    },
                                    {
                                        name: "Fire Mountain Rally",
                                        value: "19"
                                    },
                                    {
                                        name: "The Boonta Classic",
                                        value: "20"
                                    },
                                    {
                                        name: "Ando Prime Centrum",
                                        value: "21"
                                    },
                                    {
                                        name: "Abyss",
                                        value: "22"
                                    },
                                    {
                                        name: "The Gauntlet",
                                        value: "23"
                                    },
                                    {
                                        name: "Inferno",
                                        value: "24"
                                    }
                                ]
                            },
                            {
                                name: "racer",
                                description: "racer initials or first name",
                                type: 3,
                                required: true,
                                choices: [
                                    {
                                        name: "Anakin Skywalker",
                                        value: "0"
                                    },
                                    {
                                        name: "Teemto Pagalies",
                                        value: "1"
                                    },
                                    {
                                        name: "Sebulba",
                                        value: "2"
                                    },
                                    {
                                        name: "Ratts Tyerell",
                                        value: "3"
                                    },
                                    {
                                        name: "Aldar Beedo",
                                        value: "4"
                                    },
                                    {
                                        name: "Mawhonic",
                                        value: "5"
                                    },
                                    {
                                        name: "Ark 'Bumpy' Roose",
                                        value: "6"
                                    },
                                    {
                                        name: "Wan Sandage",
                                        value: "7"
                                    },
                                    {
                                        name: "Mars Guo",
                                        value: "8"
                                    },
                                    {
                                        name: "Ebe Endocott",
                                        value: "9"
                                    },
                                    {
                                        name: "Dud Bolt",
                                        value: "10"
                                    },
                                    {
                                        name: "Gasgano",
                                        value: "11"
                                    },
                                    {
                                        name: "Clegg Holdfast",
                                        value: "12"
                                    },
                                    {
                                        name: "Elan Mak",
                                        value: "13"
                                    },
                                    {
                                        name: "Neva Kee",
                                        value: "14"
                                    },
                                    {
                                        name: "Bozzie Baranta",
                                        value: "15"
                                    },
                                    {
                                        name: "Boles Roor",
                                        value: "16"
                                    },
                                    {
                                        name: "Ody Mandrell",
                                        value: "17"
                                    },
                                    {
                                        name: "Fud Sang",
                                        value: "18"
                                    },
                                    {
                                        name: "Ben Quadinaros",
                                        value: "19"
                                    },
                                    {
                                        name: "Slide Paramita",
                                        value: "20"
                                    },
                                    {
                                        name: "Toy Dampner",
                                        value: "21"
                                    },
                                    {
                                        name: "'Bullseye' Navior",
                                        value: "22"
                                    }
                                ]
                            },
                            {
                                name: "accel",
                                description: "upgrade level for acceleration",
                                type: 3,
                                required: true,
                                choices: [
                                    {
                                        name: "0: Dual 20 PCX",
                                        value: "0"
                                    },
                                    {
                                        name: "1: 44 PCX",
                                        value: "1"
                                    },
                                    {
                                        name: "2: Dual 32 PCX",
                                        value: "2"
                                    },
                                    {
                                        name: "3: Quad 32 PCX",
                                        value: "3"
                                    },
                                    {
                                        name: "4: Quad 44",
                                        value: "4"
                                    },
                                    {
                                        name: "5: Mag 6",
                                        value: "5"
                                    }
                                ]
                            },
                            {
                                name: "top_speed",
                                description: "upgrade level for top speed",
                                type: 3,
                                required: true,
                                choices: [
                                    {
                                        name: "0: Plug 2",
                                        value: "0"
                                    },
                                    {
                                        name: "1: Plug 3",
                                        value: "1"
                                    },
                                    {
                                        name: "2: Plug 5",
                                        value: "2"
                                    },
                                    {
                                        name: "3: Plug 8",
                                        value: "3"
                                    },
                                    {
                                        name: "4: Block 5",
                                        value: "4"
                                    },
                                    {
                                        name: "5: Block 6",
                                        value: "5"
                                    }
                                ]
                            },
                            {
                                name: "cooling",
                                description: "upgrade level for cooling",
                                type: 3,
                                required: true,
                                choices: [
                                    {
                                        name: "0: Coolant",
                                        value: "0"
                                    },
                                    {
                                        name: "1: Stack-3",
                                        value: "1"
                                    },
                                    {
                                        name: "2: Stack-6",
                                        value: "2"
                                    },
                                    {
                                        name: "3: Rod",
                                        value: "3"
                                    },
                                    {
                                        name: "4: Dual",
                                        value: "4"
                                    },
                                    {
                                        name: "5: Turbo",
                                        value: "5"
                                    }
                                ]
                            }

                        ]
                    },
                ]
            },
            {
                name: "tier",
                description: "get a list of all the podracers grouped into four tiers",
                type: 1,
                options: [
                    {
                        name: "upgrades",
                        description: "the upgrade level that determines each pod's tier (defaults to mu)",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "max upgrades",
                                value: "mu"
                            },
                            {
                                name: "no upgrades",
                                value: "nu"
                            }
                        ]
                    }
                ]
            },
            {
                name: "prices",
                description: "look up prices for each upgrade and get a total cost; avoid getting swindled by Watto",
                type: 1,
                options: [
                    {
                        name: "traction",
                        description: "upgrade level for traction",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: R-20",
                                value: "0"
                            },
                            {
                                name: "1: R-60",
                                value: "1"
                            },
                            {
                                name: "2: R-80",
                                value: "2"
                            },
                            {
                                name: "3: R-100",
                                value: "3"
                            },
                            {
                                name: "4: R-300",
                                value: "4"
                            },
                            {
                                name: "5: R-600",
                                value: "5"
                            }
                        ]
                    },
                    {
                        name: "turning",
                        description: "upgrade level for turning",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: Linkage",
                                value: "0"
                            },
                            {
                                name: "1: Shift Plate",
                                value: "1"
                            },
                            {
                                name: "2: Vectro-Jet",
                                value: "2"
                            },
                            {
                                name: "3: Coupling",
                                value: "3"
                            },
                            {
                                name: "4: Nozzle",
                                value: "4"
                            },
                            {
                                name: "5: Stabilizer",
                                value: "5"
                            }
                        ]
                    },
                    {
                        name: "accel",
                        description: "upgrade level for acceleration",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: Dual 20 PCX",
                                value: "0"
                            },
                            {
                                name: "1: 44 PCX",
                                value: "1"
                            },
                            {
                                name: "2: Dual 32 PCX",
                                value: "2"
                            },
                            {
                                name: "3: Quad 32 PCX",
                                value: "3"
                            },
                            {
                                name: "4: Quad 44",
                                value: "4"
                            },
                            {
                                name: "5: Mag 6",
                                value: "5"
                            }
                        ]
                    },
                    {
                        name: "top_speed",
                        description: "upgrade level for top speed",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: Plug 2",
                                value: "0"
                            },
                            {
                                name: "1: Plug 3",
                                value: "1"
                            },
                            {
                                name: "2: Plug 5",
                                value: "2"
                            },
                            {
                                name: "3: Plug 8",
                                value: "3"
                            },
                            {
                                name: "4: Block 5",
                                value: "4"
                            },
                            {
                                name: "5: Block 6",
                                value: "5"
                            }
                        ]
                    },
                    {
                        name: "air_brake",
                        description: "upgrade level for air brake",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: Mark II",
                                value: "0"
                            },
                            {
                                name: "1: Mark III",
                                value: "1"
                            },
                            {
                                name: "2: Mark IV",
                                value: "2"
                            },
                            {
                                name: "3: Mark V",
                                value: "3"
                            },
                            {
                                name: "4: Tri-Jet",
                                value: "4"
                            },
                            {
                                name: "5: Quadrijet",
                                value: "5"
                            }
                        ]
                    },
                    {
                        name: "cooling",
                        description: "upgrade level for cooling",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: Coolant",
                                value: "0"
                            },
                            {
                                name: "1: Stack-3",
                                value: "1"
                            },
                            {
                                name: "2: Stack-6",
                                value: "2"
                            },
                            {
                                name: "3: Rod",
                                value: "3"
                            },
                            {
                                name: "4: Dual",
                                value: "4"
                            },
                            {
                                name: "5: Turbo",
                                value: "5"
                            }
                        ]
                    },
                    {
                        name: "repair",
                        description: "upgrade level for repair",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "0: Single",
                                value: "0"
                            },
                            {
                                name: "1: Dual2",
                                value: "1"
                            },
                            {
                                name: "2: Quad",
                                value: "2"
                            },
                            {
                                name: "3: Cluster",
                                value: "3"
                            },
                            {
                                name: "4: Rotary",
                                value: "4"
                            },
                            {
                                name: "5: Cluster 2",
                                value: "5"
                            }
                        ]
                    }
                ]
            },
            {
                name: "cheats",
                description: "get a full list of cheats for the game",
                type: 1,
                options: [
                    {
                        name: "system",
                        description: "which version of the game to get cheats for",
                        type: 3,
                        required: true,
                        choices: [
                            {
                                name: "PC",
                                value: "PC"
                            },
                            {
                                name: "Console",
                                value: "console"
                            }
                        ]
                    }
                ]
            }
        ]
    }, {
        name: 'random',
        description: 'get a random racer, track, etc.',
        options: [
            {
                name: "racer",
                description: "get a random racer",
                type: 1,
                options: [
                    {
                        name: "tier",
                        description: "get a random racer from a specific tier",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "Top",
                                value: "0"
                            },
                            {
                                name: "High",
                                value: "1"
                            },
                            {
                                name: "Mid",
                                value: "2"
                            },
                            {
                                name: "Low",
                                value: "3"
                            }
                        ]
                    },
                    {
                        name: "canon",
                        description: "get canonical or non-canonical racers",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "canon",
                                value: "canon"
                            },
                            {
                                name: "non-canon",
                                value: "non-canon"
                            }
                        ]
                    },
                    {
                        name: "vc",
                        description: "whether to roll for everyone in your voice channel",
                        type: 5,
                        required: false
                    }
                ]
            },
            {
                name: "track",
                description: "get a random track",
                type: 1,
                options: [
                    {
                        name: "circuit",
                        description: "roll a random track from a specific circuit",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "Amateur Circuit",
                                value: "Amateur"
                            },
                            {
                                name: "Semi-Pro Circuit",
                                value: "Semi-Pro"
                            },
                            {
                                name: "Galactic Circuit",
                                value: "Galactic"
                            },
                            {
                                name: "Invitational Circuit",
                                value: "Invitational"
                            },
                        ]
                    },
                    {
                        name: "planet",
                        description: "roll a random track from a specific planet",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "Ando Prime",
                                value: "Ando Prime"
                            },
                            {
                                name: "Aquilaris",
                                value: "Aquilaris"
                            },
                            {
                                name: "Baroonda",
                                value: "Baroonda"
                            },
                            {
                                name: "Malastare",
                                value: "Malastare"
                            },
                            {
                                name: "Mon Gazza",
                                value: "Mon Gazza"
                            },
                            {
                                name: "Oovo IV",
                                value: "Oovo IV"
                            },
                            {
                                name: "Ord Ibanna",
                                value: "Ord Ibanna"
                            },
                            {
                                name: "Tatooine",
                                value: "Tatooine"
                            }
                        ]
                    },
                    {
                        name: "length",
                        description: "roll a random track from a specific length",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "short",
                                value: "short"
                            },
                            {
                                name: "medium",
                                value: "medium"
                            },
                            {
                                name: "long",
                                value: "long"
                            }
                        ]
                    },
                    {
                        name: "difficulty",
                        description: "roll a random track from a specific difficulty",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "Beginner",
                                value: "Beginner"
                            },
                            {
                                name: "Easy",
                                value: "Easy"
                            },
                            {
                                name: "Average",
                                value: "Average"
                            },
                            {
                                name: "Hard",
                                value: "Hard"
                            },
                            {
                                name: "Brutal",
                                value: "Brutal"
                            }
                        ]
                    },
                ]
            },
            {
                name: "challenge",
                description: "get a random pod/track challenge",
                type: 1,
            },
            {
                name: 'teams',
                description: 'divides everyone in your voice channel into # number of teams',
                type: 1,
                options: [
                    {
                        name: "teams",
                        description: "the number of teams you wish to create",
                        type: 4,
                        required: true
                    }
                ]
            },
            {
                name: "number",
                description: "get a random number",
                type: 1,
                options: [
                    {
                        name: "max",
                        description: "get a random number between 1 and this number",
                        type: 4,
                        required: true,
                    }
                ]
            }
        ]
    }, {
        name: 'src',
        description: 'get top-5 leaderboards from speedrun.com',
        options: [
            {
                name: "il",
                description: "get individual level top-5 leaderboards from speedrun.com",
                type: 1, //sub command
                options: [
                    {
                        name: "track",
                        description: "the name of the track",
                        type: 3, //string
                        required: true,
                        choices: [
                            {
                                name: "The Boonta Training Course",
                                value: "0"
                            },
                            {
                                name: "Mon Gazza Speedway",
                                value: "1"
                            },
                            {
                                name: "Beedo's Wild Ride",
                                value: "2"
                            },
                            {
                                name: "Aquilaris Classic",
                                value: "3"
                            },
                            {
                                name: "Malastare 100",
                                value: "4"
                            },
                            {
                                name: "Vengeance",
                                value: "5"
                            },
                            {
                                name: "Spice Mine Run",
                                value: "6"
                            },
                            {
                                name: "Sunken City",
                                value: "7"
                            },
                            {
                                name: "Howler Gorge",
                                value: "8"
                            },
                            {
                                name: "Dug Derby",
                                value: "9"
                            },
                            {
                                name: "Scrapper's Run",
                                value: "10"
                            },
                            {
                                name: "Zugga Challenge",
                                value: "11"
                            },
                            {
                                name: "Baroo Coast",
                                value: "12"
                            },
                            {
                                name: "Bumpy's Breakers",
                                value: "13"
                            },
                            {
                                name: "Executioner",
                                value: "14"
                            },
                            {
                                name: "Sebulba's Legacy",
                                value: "15"
                            },
                            {
                                name: "Grabvine Gateway",
                                value: "16"
                            },
                            {
                                name: "Andobi Mountain Run",
                                value: "17"
                            },
                            {
                                name: "Dethro's Revenge",
                                value: "18"
                            },
                            {
                                name: "Fire Mountain Rally",
                                value: "19"
                            },
                            {
                                name: "The Boonta Classic",
                                value: "20"
                            },
                            {
                                name: "Ando Prime Centrum",
                                value: "21"
                            },
                            {
                                name: "Abyss",
                                value: "22"
                            },
                            {
                                name: "The Gauntlet",
                                value: "23"
                            },
                            {
                                name: "Inferno",
                                value: "24"
                            }
                        ]
                    },
                    {
                        name: "skips",
                        description: "filter by skip runs or full track runs",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "skips",
                                value: "skips"
                            },
                            {
                                name: "full track",
                                value: "ft"
                            }
                        ]
                    },
                    {
                        name: "upgrades",
                        description: "filter by upgrade runs and no upgrade (nu) runs",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "upgrades",
                                value: "mu"
                            },
                            {
                                name: "no upgrades",
                                value: "nu"
                            }
                        ]
                    },
                    {
                        name: "platform",
                        description: "filter runs by platform",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "PC",
                                value: "pc"
                            },
                            {
                                name: "Nintendo 64",
                                value: "n64"
                            },
                            {
                                name: "Dreamcast",
                                value: "dc"
                            },
                            {
                                name: "Nintendo Switch",
                                value: "switch"
                            },
                            {
                                name: "PlayStation 4",
                                value: "ps4"
                            },
                            {
                                name: "XboxOne",
                                value: "xbox"
                            }
                        ]
                    },
                    {
                        name: "laps",
                        description: "show 3-lap or 1-lap runs (defaults to 3-lap)",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "3-lap",
                                value: "3"
                            },
                            {
                                name: "1-lap (flap)",
                                value: "1"
                            }
                        ]
                    }
                ]
            },
            {
                name: "rta",
                description: "get real time attack top-5 leaderboards from speedrun.com",
                type: 1, //sub command
                options: [
                    {
                        name: "category",
                        description: "the name or abbreviation of the category",
                        type: 3,//string
                        required: true,
                        choices: [
                            {
                                name: "Any%",
                                value: "any%"
                            },
                            {
                                name: "Semi-Pro Circuit",
                                value: "spc"
                            },
                            {
                                name: "Amateur Circuit",
                                value: "amc"
                            },
                            {
                                name: "100%",
                                value: "100%"
                            },
                            {
                                name: "All Tracks New Game+",
                                value: "ng+"
                            }
                        ]
                    },
                    {
                        name: "skips",
                        description: "filter by skip runs or full track runs",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "skips",
                                value: "skips"
                            },
                            {
                                name: "full track",
                                value: "ft"
                            }
                        ]
                    },
                    {
                        name: "upgrades",
                        description: "filter by upgrade runs (mu) and no upgrade runs (nu)",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "upgrades",
                                value: "mu"
                            },
                            {
                                name: "no upgrades",
                                value: "nu"
                            }
                        ]
                    },
                    {
                        name: "platform",
                        description: "filter runs by platform",
                        type: 3,
                        required: false,
                        choices: [
                            {
                                name: "any",
                                value: "any"
                            },
                            {
                                name: "PC",
                                value: "pc"
                            },
                            {
                                name: "Nintendo 64",
                                value: "n64"
                            },
                            {
                                name: "Dreamcast",
                                value: "dc"
                            },
                            {
                                name: "Nintendo Switch",
                                value: "switch"
                            },
                            {
                                name: "PlayStation 4",
                                value: "ps4"
                            }
                        ]
                    }
                ]
            },


        ]
    }, {
        name: "tourney",
        description: "get tourney stuff",
        type: 1,
        options: [
            {
                name: 'leaderboards',
                description: 'get top-5 leaderboards for tournament runs',
                type: 1,
                options: []
            },
            {
                name: "stats",
                description: "get tournament stats for each player, pod, and track",
                type: 1,
                options: [
                ]
            },
            {
                name: "schedule",
                description: "get a look at upcoming matches on speedgaming.org",
                type: 1,
                options: [
                ]
            },
            {
                name: 'rulesets',
                description: 'get and create tournament rulesets',
                type: 1,
                options: []
            },
            {
                name: "matches",
                description: "view or add matches",
                type: 1,
                options: []
            },
            {
                name: "play",
                description: "create or resume a tournament match",
                type: 1,
                options: []
            }
        ]

    }
]
