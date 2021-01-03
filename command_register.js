client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'botto',
    description: 'introduces botto and provides an invite link'
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'challenge',
    description: 'randomly generated challenges',
    options: [
        {
            name: "generate",
            description: "get a random pod/track challenge; 15-minute time limit; submit your time below",
            type: 1
        },
        {
            name: "odds",
            description: "view and customize your personal challenge odds of rolling no upgrades, skips, etc.",
            type: 1,
            options: [
                {
                    name: "skips",
                    description: "x/100 chance of getting a skip challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "no_upgrades",
                    description: "x/100 chance of getting a no upgrades challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "non_3_lap",
                    description: "x/100 chance of getting a non 3-lap challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "mirrored",
                    description: "x/100 chance of getting a mirrored challenge",
                    type: 4,
                    required: false
                },
                {
                    name: "reset",
                    description: "if true, resets your challenge odds to default",
                    type: 5,
                    required: false
                }
            ]
        },
        {
            name: "stats",
            description: "view your career stats and achievement progress for random challenges",
            type: 1
        },
        {
            name: "about",
            description: "learn more about how the random challenges work and how to submit a time",
            type: 1
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'chancecube',
    description: "Blue—it's the boy. Red—his mother"
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: { //this stays as a guild command
    name: 'cleanup',
    description: 'deletes bot spam within the past # messages (defaults to 30)',
    options: [
        {
            name: "messages",
            description: "the number of messages to scan through for bot spam",
            type: 4,
            required: false
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'convert',
    description: 'convert seconds to --:--.--- format and vice versa',
    options: [
        {
            name: "time",
            description: "the seconds or mm:ss.000 you wish to convert",
            type: 3,
            required: true
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'help',
    description: 'helpful info about commands and other stuff',
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
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'links',
    description: 'get your links here',
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
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'lookup',
    description: 'get information for a specific racer, track, etc.',
    options: [
        {
            name: "racer",
            description: "get information for a specific racer",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "racer's first name or initials",
                    type: 3,
                    required: true
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
                    description: "track name or abbreviation",
                    type: 3,
                    required: true
                },
            ]
        },
        {
            name: "times",
            description: "get the par times for a specific track",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "track name or abbreviation",
                    type: 3,
                    required: true
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
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'random',
    description: 'get a random racer, track, etc.',
    options: [
        {
            name: "racer",
            description: "get a random racer",
            type: 1,
            options: [
                {
                    name: "name",
                    description: "racer's first name or initials",
                    type: 3,
                    required: true
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
                            name: "Amateur Circuit",
                            value: "amc"
                        },
                        {
                            name: "Semi-Pro Circuit",
                            value: "spc"
                        },
                        {
                            name: "Galactic Circuit",
                            value: "gal"
                        },
                        {
                            name: "Invitational Circuit",
                            value: "inv"
                        }
                    ]
                },
                {
                    name: "planet",
                    description: "roll a random track from a specific planet",
                    type: 3,
                    required: false,
                    choices: [
                        {
                            name: "Ando Prime",
                            value: "andoprime"
                        },
                        {
                            name: "Aquilaris",
                            value: "aquilaris"
                        },
                        {
                            name: "Baroonda",
                            value: "baroonda"
                        },
                        {
                            name: "Malastare",
                            value: "malastare"
                        },
                        {
                            name: "Mon Gozza",
                            value: "mongozza"
                        },
                        {
                            name: "Oovo IV",
                            value: "oovoiv"
                        },
                        {
                            name: "Ord Ibanna",
                            value: "ordibanna"
                        },
                        {
                            name: "Tatooine",
                            value: "tatooine"
                        }
                    ]
                }
            ]
        },
        {
            name: "challenge",
            description: "get a random pod/track challenge",
            type: 1,
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
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: { //this stays as a guild command
    name: 'role',
    description: "get or remove the speedrunning or multiplayer role",
    options: [
        {
            name: "speedrunning",
            description: "get or drop the speedrunning role",
            type: 2,
            options: [
                {
                    name: "get",
                    description: "get this role",
                    type: 1
                },
                {
                    name: "remove",
                    description: "remove this role",
                    type: 1
                }
            ]
            
        },
        {
            name: "multiplayer",
            description: "get or drop the multiplayer role",
            type: 2,
            options: [
                {
                    name: "get",
                    description: "get this role",
                    type: 1
                },
                {
                    name: "remove",
                    description: "remove this role",
                    type: 1
                }
            ]
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'src',
    description: 'get top-5 leaderboards from speedrun.com',
    options: [
        {
            name: "IL",
            description: "get individual level top-5 leaderboards from speedrun.com",
            type: 1, //sub command
            options: [
                {
                    name: "track",
                    description: "the name or abbreviation of the track",
                    type: 3, //string
                    required: true
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
            name: "RTA",
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
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'teams',
    description: 'divides everyone in your voice channel into # number of teams',
    options: [
        {
            name: "number",
            description: "the number of teams you wish to create",
            type: 4,
            required: true
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'tourney',
    description: 'get top-5 leaderboards for tournament runs of each track',
    options: [
        {
            name: "track",
            description: "name or abbreviation of the track",
            type: 3,
            required: true
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
            description: "filter by upgrade runs (mu) or no upgrade runs (nu)",
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
            name: "pod",
            description: "Filter runs by specific pods. Filter out pods with 'no' or '-'. Multiple entries accepted",
            type: 3,
            required: false,
        },
        {
            name: "deaths",
            description: "filter runs by deaths or deathless",
            type: 3,
            required: false,
            choices: [
                {
                    name: "any",
                    value: "any"
                },
                {
                    name: "deaths",
                    value: "deaths"
                },
                {
                    name: "deathless",
                    value: "deathless"
                }
            ]
        },
        {
            name: "year",
            description: "filter runs by the year the tournament was held",
            type: 4,
            required: false,
            choices: [
                {
                    name: 2019,
                    value: 2019
                },
                {
                    name: 2020,
                    value: 2020
                }
            ]
        }
    ]
}})

client.api.applications("545798436105224203").guilds('441839750555369474').commands.post({data: {
    name: 'weekly',
    description: 'view leaderboards and create submissions for the weekly challenge',
    options: [
        {
            name: "leaderboard",
            description: "get leaderboard for current weekly challenge",
            type: 1
        },
        {
            name: "challenge",
            description: "view the current weekly challenge or post a new one",
            type: 2,
            options: [
                {
                    name: "view",
                    description: "show the current weekly challenge",
                    type: 1
                },
                {
                    name: "post",
                    description: "post a new weekly challenge",
                    type: 1,
                    options: [
                        {
                            name: "author",
                            description: "the user who created the challenge",
                            type: 6,
                            required: true
                        },
                        {
                            name: "title",
                            description: "the name of the challenge",
                            type: 3,
                            required: true
                        },
                        {
                            name: "blurb",
                            description: "a creative description to contextualize the challenge in the lore",
                            type: 3,
                            required: true
                        },
                        {
                            name: "pod",
                            description: "the pod that must be used in the challenge",
                            type: 3,
                            required: true
                        },
                        {
                            name: "upgrades",
                            description: "the upgrades that must be used in this challenge",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "full upgrades",
                                    value: "mu"
                                },
                                {
                                    name: "no upgrades",
                                    value: "nu"
                                },
                                {
                                    name: "any",
                                    value: "any"
                                },
                                {
                                    name: "custom",
                                    value: "custom"
                                }
                            ]
                        },
                        {
                            name: "track",
                            description: "the challenge track",
                            type: 3,
                            required: true
                        },
                        {
                            name: "laps",
                            description: "the number of laps for the challenge",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "1",
                                    value: "1"
                                },
                                {
                                    name: "2",
                                    value: "2"
                                },
                                {
                                    name: "3",
                                    value: "3"
                                },
                                {
                                    name: "4",
                                    value: "4"
                                },
                                {
                                    name: "5",
                                    value: "5"
                                },
                                {
                                    name: "flap",
                                    value: "flap"
                                }
                            ]
                        },
                        {
                            name: "skips",
                            description: "the allowed route for this challenge",
                            type: 3,
                            required: true,
                            choices: [
                                {
                                    name: "skips",
                                    value: "skips"
                                },
                                {
                                    name: "full track",
                                    value: "ft"
                                },
                                {
                                    name: "custom",
                                    value: "custom"
                                }
                            ]
                        },
                        {
                            name: "conditions",
                            description: "any additional challenge conditions such as mirror mode, ai, specific routes and custom upgrades",
                            type: 3,
                            required: true,
                        },
                        {
                            name: "duedate",
                            description: "the last day of the challenge (ends at midnight ET), please use MM/DD/YYYY",
                            type: 3,
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: "submission",
            description: "create a submission for the weekly challenge",
            type: 1,
            options: [
                {
                    name: "time",
                    description: "the time achieved for this submission",
                    type: 3,
                    required: true
                },
                {
                    name: "platform",
                    description: "the platform used to complete the challenge",
                    type: 3,
                    required: true,
                    choices: [
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
                },
                {
                    name: "proof",
                    description: "the link to the video or image proof",
                    type: 3,
                    required: true
                },
                {
                    name: "user",
                    description: "the user who performed the run (if not yourself)",
                    type: 6,
                    required: false
                }
            ]
        }
    ]
}})





















