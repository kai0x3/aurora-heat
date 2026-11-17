[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kai0x3/aurora-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kai0x3/aurora-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Aurora Heat

An original top-down 2D open-world crime game, built by an AI agent for
make.fun's **Make GTA 6** bounty (gta6-01). No Rockstar names, characters, art,
maps or assets anywhere — Port Aurora, its people and its story are all our own.

## The pitch

Port Aurora. Golden hour. One driver, three jobs, and the whole city watching.
Rook, a fixer who works out of the Marina, has work for you — if you can stay
ahead of the Aurora PD. Steal a car off the street, run the package across
town, and shake a three-star wanted level before the whole force closes in.

## How to play

Serve the `game/` folder with any static server and open `index.html` in a
desktop browser:

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

No build step, no network: every script, style and sound is a file under
`game/` (the audio is synthesized live with Web Audio).

## Controls

| Input | Does |
| --- | --- |
| W / A / S / D or arrows | Walk, or drive (accelerate, steer, brake/reverse) |
| E | Steal / enter the nearest car, or step out of it |
| Mouse + click, or Space | Aim and shoot (on foot) |
| P or Esc | Pause |
| M | Mute the music and sound |
| Enter or click | Start / restart |

## Features

- **A city to explore** — Port Aurora is a 3200×2400 open world on a road grid: downtown towers, parks, plazas, and a waterfront bay along the south edge, all generated from a seed.
- **Traffic and pedestrians** — cars cruise the roads and turn at intersections; people walk the sidewalks and run when gunfire starts.
- **Cars to steal and drive** — walk up to any car, press E, and drive it. Carjacking a driven car draws the police; a parked one is quieter.
- **Wanted level and police** — crimes raise your stars (0–5). Aurora PD cruisers spawn on the roads, chase you down with sirens, and ram. Stay quiet and out of sight and the heat cools off.
- **Three missions with a story** — (1) reach the Marina checkpoint, (2) pick up a package at the docks and deliver it to the hideout, (3) lose a three-star wanted level. Each pays cash; the HUD tracks the current objective and a green beacon marks it on the map.
- **Combat** — mouse-aimed shooting on foot. Bullets damage police cruisers and scatter pedestrians.
- **HUD with minimap** — a live minimap shows the city, your position, traffic, police and the mission marker; plus wanted stars, health, money and the current objective.
- **Save** — money, best haul and jobs finished persist in `localStorage` between visits.
- **Sound and music** — fully synthesized Web Audio: engine hum, two-tone sirens, gunshots, pickup jingles and a bass loop. M to mute.
- **Screens** — title screen with the story and controls, pause, and a "Busted" game-over screen with restart.

## Structure

```
game/
  index.html          the page (loads src/main.js, nothing else)
  style.css           the page around the canvas
  src/
    config.js         every tuning number in one place
    random.js         seeded RNG (mulberry32)
    city.js           Port Aurora: roads, blocks, buildings, parks, bay
    world.js          the state and one fixed step that moves it all
    traffic.js        traffic cars and pedestrians
    police.js         wanted level and police pursuit
    missions.js       the three jobs and their progression
    combat.js         shooting, bullets, cruiser damage
    render.js         canvas drawing: city, cars, HUD, minimap, screens
    input.js          keyboard and mouse
    audio.js          synthesized Web Audio sound and music
    shots.js          deterministic screenshot scenes (?shot=…)
    main.js           boot, the game loop, save/load, screens
```

## Screenshots

The four shots in `screenshots/` are real renders of the game in a browser,
taken with `?shot=start|foot|drive|chase` (fixed seed, deterministic): the
title screen, on foot in the city, driving in traffic, and a police chase with
the wanted level and mission objective on the HUD.

## License

MIT — see `LICENSE`.
