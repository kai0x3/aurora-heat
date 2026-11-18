[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kai0x3/aurora-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kai0x3/aurora-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Aurora Heat

An original top-down 2D open-world crime game, built by an AI agent for
make.fun's **Make GTA 6** bounty (gta6-01). No Rockstar names, characters, art,
maps or assets anywhere — Port Aurora, its people and its story are all our own.

## The pitch

Port Aurora. Golden hour. One driver, nine jobs, and the whole city watching.
Rook, a fixer who works out of the Marina, has work for you — if you can stay
ahead of the Aurora PD. Steal a car off the street, run the package across
town, beat a checkpoint clock, outrun the other driver in Rook's stable,
carry a crate of glassware across the city without cracking it, and shake
five stars — helicopter and all — on the kingpin's last run.

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

- **A city to explore** — Port Aurora is a 3200×2400 open world on a road grid: downtown towers with parapets and rooftop air conditioners, parks, plazas, beach palms, and a waterfront bay with drifting shimmer along the south edge, all generated from a seed.
- **A full day cycle** — over five minutes the light runs from golden morning through dusk into a blue night: windows light up pane by pane in a hashed patchwork, street lamps pool their glow at the intersections, and every car throws a headlight cone ahead of it. The renderer draws at up to twice the device pixel ratio and paints only what the camera can see, so it stays crisp and smooth.
- **A living city** — traffic cruises the roads and turns at intersections, and it has opinions: block a driver's lane and they brake, yield, and lean on the horn. Pedestrians walk the sidewalks, run from gunfire and reckless driving — and the watchers among them stop, turn, and pull out a phone when a crash or a chase rolls past.
- **Four kinds of car to steal and drive** — sedans, yellow taxis, sports coupes and lumbering trucks, each with its own top speed, acceleration and steering. A stolen truck genuinely lumbers; a sports coupe is the fastest thing in the city. Six more cars sit parked in rows at the plazas and the Marina as quiet steals.
- **Cars take damage now** — every hard crash and ram costs your ride hit points: it smokes from the bonnet as they fall, darker and thicker the worse it gets, the HUD shows a CAR bar under the speedometer, and a car under a third of its strength pulls at barely two-thirds pace. Park it inside the Sol Plaza ring and the safehouse crew patches it back up, billed by the tick.
- **Wanted level and police** — crimes raise your stars (0–5). Aurora PD cruisers spawn on the roads, chase you down with sirens, and ram — and every star makes them quicker. At four stars and up they park roadblocks across the road ahead: ram one apart, shoot it apart, or dodge it.
- **The helicopter** — at five stars the PD puts a bird up. It orbits you with its spotlight pinned to your car, drawn as a cone of light and a bright pool on the ground (at night it is a searchlight you can read by), and while the light is on you your wanted level cannot cool. Lose the fifth star and it banks away.
- **The Sol Plaza safehouse** — the hideout's ring is marked on the ground and the minimap. Lying low inside it cools your wanted level 3.5× faster than anywhere else — and it is where the crew repairs your car.
- **Nine missions with a story** — (1) reach the Marina checkpoint, (2) pick up a package at the docks and deliver it to the hideout, (3) a fare against one shared 50-second clock, (4) a checkpoint run where every gate buys time, (5) the Harbor Sprint: a street race against Rook's other driver in her magenta coupe — six gates, first to the last one wins, (6) lose a three-star wanted level, (7) the Glass Run: a crate of vintage glassware from the docks to Crescent Lofts that cracks with every hard crash and fails at nothing whole, (8) a four-star getaway to the safehouse, (9) a kingpin run at five stars with the helicopter up. Timed jobs restart when the clock runs out; the race restarts when she beats you; the glass restarts when it breaks. Every finished job pops a results toast with its payout and the night's totals. All nine pay $6,700 between them.
- **Feel** — hard steering at speed lays fading skid marks and sets the tyres screeching; crashes spark, wrecks smoke, and taking a hit flushes the edges of the screen red for a moment. A speedometer with a car-damage bar and a big mission clock (red under ten seconds) sit on the HUD, and while the glassware rides, an amber CARGO bar counts what is still whole.
- **Combat** — mouse-aimed shooting on foot. Bullets damage police cruisers — roadblock cars included — and scatter pedestrians.
- **HUD with minimap** — a live minimap shows the city, your position, traffic, police, the rival's magenta dot during the sprint, the helicopter, the safehouse and the mission marker; plus wanted stars, a rounded health bar, money and the current objective, all on rounded panels with soft shadows under a light cinema vignette. When the mission target is off-screen, a green arrow rides the edge of the screen pointing at it, with the distance underneath.
- **Save** — money, best haul and jobs finished persist in `localStorage` between visits.
- **Sound and music** — fully synthesized Web Audio: an engine that climbs gear by gear with speed, two-tone sirens with a distant wail underneath whenever the heat is on, traffic horns, tyre screech, gunshots, pickup and checkpoint chimes, matched success and failure stings, and a bass loop with a pentatonic lead pluck. M to mute.
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
    traffic.js        traffic cars (four kinds, plus parked rows), pedestrians, the race rival
    police.js         wanted level, pursuit, roadblocks, the helicopter, the safehouse cooldown
    missions.js       the nine jobs: clocks, checkpoints, the race and the fragile cargo
    combat.js         shooting, bullets, cruiser damage
    render.js         canvas drawing: city, day cycle, helicopter, HUD, minimap, screens
    input.js          keyboard and mouse
    audio.js          synthesized Web Audio sound and music
    shots.js          deterministic screenshot scenes (?shot=…)
    main.js           boot, the game loop, save/load, screens
```

## Screenshots

The four shots in `screenshots/` are real renders of the game in a browser,
taken with `?shot=start|race|drive|heli` (fixed seed, deterministic, rendered
at twice the device scale so they stay crisp): the title screen, the Harbor
Sprint a moment after the first gate with the rival's magenta coupe alongside
and the standings on the HUD, driving a sports coupe with skid marks and the
speedometer up, and a five-star night run under the helicopter's spotlight
with a roadblock forming ahead.

## License

MIT — see `LICENSE`.
