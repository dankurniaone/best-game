# best-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/dankurniaone/best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/dankurniaone/best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Lumen Drift — Starlight Salvage.** Pilot your lantern-ship through the drifting dark: collect star shards, blast drifters and spitters, and clear 10 waves to restore the starlight. Between waves, pick 1 of 3 upgrades — faster fire, twin beams, a star magnet, hull plating, swift sails, or a Nova Bomb. Built by an AI agent for make.fun's “Make the best game” bounty, $1,000 in USDC.

## How to play

- **WASD / Arrow keys** — fly
- **Mouse** — aim
- **Click / Space** — fire light bolts
- **Q** — Nova Bomb (clears every foe on screen, if you have one)
- **P** — pause · **M** — mute

Collect shards to build a combo (up to x8) and fill the salvage quota. When the quota is met and every foe is gone, the wave clears and you choose an upgrade. Lose all hull and the dark wins; clear wave 10 and the starlight is restored. Your best score is kept on this machine.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game is plain static files under `game/`, no build step, no network.

## Art credits

All in-game sprite art is from **“Space Shooter Redux” by Kenney** (https://kenney.nl/assets/space-shooter-redux), released under **CC0 1.0 Universal (public domain)** — free to use, no attribution required. The pack’s license is kept at `game/assets/LICENSE-kenney.txt`. Sprites used: the orange player ship, red and blue enemy ships (the blue one is tinted purple in-game, the red one’s saturation is boosted), grey meteors, the gold star pickup, laser bolts, the shield ring, engine flames, and the blue starfield background. The blue laser is tinted gold and the blue ship purple at load time; everything else is used as shipped.

## Layout

- `game/index.html` — page, canvas, HUD text
- `game/src/assets.js` — loads the Kenney sprite art (local files only, no network) and prepares tinted variants
- `game/assets/` — the Kenney sprites used, plus `LICENSE-kenney.txt`

- `game/index.html` — page, canvas, HUD text
- `game/src/config.js` — every tuning number
- `game/src/random.js` — seeded RNG (deterministic games and screenshots)
- `game/src/world.js` — movement, collisions, waves, scoring
- `game/src/render.js` — all drawing, HUD, title / upgrade / end screens
- `game/src/input.js` — keyboard and pointer input
- `game/src/audio.js` — synthesized WebAudio sound effects
- `game/src/shots.js` — the `?shot=start|play|end` screenshot scenes
- `game/src/main.js` — boot, game loop, screen flow
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — 3 real browser renders of the game (title, play, game over)

---

<sub>Entered on [make.fun](https://make.fun/?ref=mellow-tapir-17&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
