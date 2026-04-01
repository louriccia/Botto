# Botto - Discord Bot

Discord.js v14 bot for the Star Wars Episode I: Racer (SWE1R) speedrunning community.

## Sister Repos

This bot is part of a three-repo ecosystem:

| Repo | Location | Role |
|------|----------|------|
| **Botto** (this repo) | `../Botto` | Discord bot - slash commands, interactions, auto-features |
| **botto-api** | `../bottos-junkyard` | Express.js backend - REST API, business logic, database access |
| **junkyard** | `../junkyard` | Vite website frontend - wiki, leaderboards, tournament UI |

### How They Connect

```
Discord Server (SWE1R Guild)
        |
        v
   Botto (this repo)  ----HTTP (axios)---->  botto-api (bottos-junkyard)
                                                   ^
   junkyard (website)  ----HTTP (fetch)------------|
```

- **Botto -> botto-api**: Authenticated via `x-bot-token` header + `x-user-id`. See `src/axios.js` for the `requestWithUser()` helper. Base URL from env: `BOTTO_API_BASE_URL`.
- **junkyard -> botto-api**: Authenticated via JWT Bearer token (Discord OAuth flow). Base URL from env: `VITE_API_BASE_URL`.
- **Botto and junkyard do not communicate directly** - they share state through botto-api and the Firebase Realtime Database.

### Shared Database

Firebase Realtime Database (`botto-efbfd`) is accessed by both this bot (via firebase-admin SDK, see `src/firebase.js`) and botto-api. Key paths: `users/`, `challenge/`, `tourney/`.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: discord.js v14.21
- **Database**: Firebase Realtime Database (firebase-admin)
- **HTTP Client**: axios (to botto-api)
- **AI**: OpenAI API (Watto chat personality)
- **External APIs**: Twitch, YouTube, speedrun.com, SpeedGaming
- **Deployment**: Heroku (`Procfile: node --max-old-space-size=4096 src/bot.js`)

## Project Structure

```
src/
  bot.js              # Entry point, event handlers, minute-by-minute tasks
  axios.js            # requestWithUser() - authenticated API calls to botto-api
  firebase.js         # Firebase init, real-time listeners, in-memory db cache
  user.js             # User lookup and initialization
  generic.js          # Utility functions (time conversion, formatting)
  discord.js          # Discord helper functions
  commands/           # 23+ slash commands (challenge, tourney, lookup, etc.)
  interactions/       # Button/modal/select handlers
    challenge/        # Challenge system (play, shop, inventory, leaderboard, etc.)
    tourney/          # Tournament match lifecycle
    simulate/         # Race simulator
  auto/               # Background tasks (drops, chat, stream scanning, user sync)
  data/               # Static game data and constants
    sw_racer/         # Racers, tracks, circuits, planets, parts
    challenge/        # Items, achievements, levels, rarities
    discord/          # Emoji, role, channel, guild IDs
    flavor/           # Flavor text (errors, tips, quotes)
    tourney_archive/  # Historical tournament data
  services/           # Cache and racer service
  resources/img/      # Racer and track images
```

## Key API Endpoints Used

Calls to botto-api via `requestWithUser()`:

- `GET /users` - Fetch user by discordId
- `GET /racers`, `/tracks`, `/circuits`, `/planets` - Game data (cached)
- `POST /matches` - Create tournament match
- `POST /matches/{id}/submitAction` - Submit match actions (runs, bans, etc.)
- `GET /matches` - List matches

## Key Concepts

- **Truguts**: In-game currency earned from challenges, spent in shop
- **Challenge System**: 15-minute random racing challenges with items, achievements, and leaderboards
- **Tournament System**: Match lifecycle with states 0-6 (scheduled -> post-match), bans, betting
- **Guild switching**: Testing mode when `process.env.USERNAME == 'louri'`, routes to test guild
- **Primary guild**: `441839750555369474` (SWE1R Discord)
