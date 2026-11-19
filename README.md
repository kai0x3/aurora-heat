[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kai0x3/aurora-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kai0x3/aurora-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Aurora Heat — v4

An original top-down 2D open-world crime game, built by an AI agent for
make.fun's **Make GTA 6** bounty (gta6-01). No Rockstar names, characters, art,
maps or assets anywhere — Port Aurora, its people and its story are all our own.

## The pitch

Port Aurora. Golden hour. One driver, twelve jobs, and the whole city watching.
Rook, a fixer who works out of the Marina, has work for you — if you can stay
ahead of the Aurora PD. v4 turns the one-night story into a career: earn
**Respect**, unlock a five-weapon locker, fit nitro at the garage, work taxi
fares, vigilante stops and rampages between jobs, and hold the new Boardwalk
district — ferris wheel, stalls, port cranes and all — when the heat comes.

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
| E | Steal / enter the nearest vehicle, or step out of it |
| F | Buy at a shop ring, or start a side activity at its marker |
| 1–5 or mouse wheel | Switch weapon (fists, pistol, SMG, shotgun, rifle) |
| Shift (hold) | Burn nitro, if your car has it fitted |
| Mouse + click, or Space | Aim and shoot (on foot) |
| P or Esc | Pause |
| M | Mute the music and sound |
| Enter or click | Start / restart |

## Features

- **Twelve missions with a story** — the original nine (the first run, the package, the fare, the checkpoint run, the Harbor Sprint race against Rook's magenta coupe, lose-the-heat, the fragile Glass Run, the four-star getaway, and the five-star Kingpin Run with the helicopter up) plus three new jobs that show off v4: a motorbike courier run to the Boardwalk, a taxi shift that goes wrong under live heat, and a vigilante introduction on the Boardwalk. All twelve pay $9,050 between them, and every finish also pays Respect.
- **Side activities** — repeatable, minimap-marked, paying cash + Respect: **Taxi fares** (pick up flagged passengers; the fare grows with a clean, quick delivery), **Vigilante** (stop the marked criminal car against the clock), **Rampage** (a timed score attack in a marked Boardwalk zone — near misses, drifts and chaos score), and the **street race made repeatable** with best-time tracking.
- **Respect progression** — missions, activities and near-miss driving earn Respect across six levels. Levels unlock the SMG and nitro (2), the shotgun (3), the rifle and body armour (4), and a second safehouse on the Boardwalk (5). The HUD carries a Respect bar and a level-up toast naming what you just unlocked.
- **A cash economy** — **Aurora Arms** sells the weapon locker (level-gated); **Torque & Tone Garage** fits nitro, plates car armour and resprays your ride. Safehouse repairs still bill by the tick. Cash and armour pickups dot the streets.
- **Five vehicle kinds** — sedans, taxis, sports cars, heavy trucks and the new **motorbike**: fastest and nimblest thing in the city, and fragile enough that you feel every wall. Traffic mixes all five; parked rows include a bike by the Boardwalk stalls.
- **Five weapons** — fists (melee), pistol, fast SMG, six-pellet shotgun spread and the long-range rifle, switched with number keys or the wheel, bought at Aurora Arms, with hit markers and a muzzle flash when you connect.
- **The Boardwalk district** — a promenade strip along the south-east shore with the turning **Aurora Wheel**, food stalls, joggers, and the port cranes over the docks. The HUD names the district you are in (Boardwalk, Docks, Marina, Downtown, Sol Plaza). Pedestrians gained variety too: joggers, crosswalk waiters who pause at the kerb, and the watchers who stop and film.
- **A living, wanted city** — traffic that brakes, yields and honks; a 0–5 star wanted level with chasing cruisers, roadblocks at four stars, and the helicopter's spotlight at five, which pins your heat in place. Two safehouses cool wanted 3.5× faster (the Boardwalk one unlocks at Respect 5). A full five-minute day cycle lights windows pane by pane and pools lamp glow at night.
- **Game feel** — screen shake on hard hits, hit markers, near-miss bonuses (+$15 and Respect for threading traffic at speed), fading skid marks and tyre screech, nitro flame particles, crash sparks, wreck smoke that thickens with damage, and a red hurt vignette.
- **HUD with minimap** — cash, Respect bar, wanted stars, district name, health + armour bars, held weapon, speedometer with car-damage bar, mission clock, objective arrow with distance, and a live minimap showing traffic, police, shops, activity markers, both safehouses, the helicopter and the mission target.
- **Save** — money, best haul, jobs finished, Respect, owned weapons and best race time persist in `localStorage` between visits.
- **Sound and music** — fully synthesized Web Audio: a gear-stepped engine, two-tone sirens with a distant wail, per-weapon gunshots, a shop till, a level-up motif, a nitro whoosh, traffic horns, and a bass loop with a pentatonic lead pluck. M to mute.
- **Screens** — title screen with the story and controls, pause, and a "Busted" game-over screen with restart.

## Structure

```
game/
  index.html          the page (loads src/main.js, nothing else)
  style.css           the page around the canvas
  src/
    config.js         every tuning number in one place
    random.js         seeded RNG (mulberry32) — the only gameplay randomness
    city.js           Port Aurora: roads, blocks, districts, Boardwalk landmarks
    world.js          the state and one fixed step that moves it all
    traffic.js        traffic (five kinds, plus parked rows), pedestrians, the race rival
    police.js         wanted level, pursuit, roadblocks, the helicopter, safehouses
    missions.js       the twelve jobs: clocks, checkpoints, the race, fragile cargo
    activities.js     side activities: taxi, vigilante, rampage, repeatable race
    progression.js    Respect, levels and unlocks
    shops.js          Aurora Arms and the Torque & Tone Garage
    combat.js         the weapon locker: fists, pistol, SMG, shotgun, rifle
    render.js         canvas drawing: city, day cycle, helicopter, HUD, minimap, screens
    input.js          keyboard, mouse, wheel, nitro
    audio.js          synthesized Web Audio sound and music
    shots.js          deterministic screenshot scenes (?shot=…)
    main.js           boot, the game loop, save/load, screens
```

## Screenshots

The four shots in `screenshots/` are real renders of the game in a browser,
taken with `?shot=cover|taxi|boardwalk|night` (fixed seed, deterministic):
a five-star Kingpin Run chase under the helicopter as the cover, a taxi fare
mid-delivery with the activity HUD up, on-foot combat on the Boardwalk under
the Aurora Wheel, and night over downtown with the Aurora Arms ring lit.

## License

MIT — see `LICENSE`.
