// The story and its twelve jobs (v4). Rook, a fixer who works out of the
// Marina, keeps finding work for a driver who can stay ahead of the Aurora
// PD. The first nine jobs are the v3 night; v4 adds three more that show off
// the new Port Aurora: a motorbike courier run to the Boardwalk, a taxi
// shift that goes wrong, and a vigilante introduction for the precinct's
// least favourite citizen. Each job has a title, a story beat, an objective,
// a target and a cash reward — and every finish pays Respect as well as cash.
// Timed jobs share one mission clock between their stages.

import { CARGO_CRASH_DAMAGE, RESPECT_MISSION, SAFEHOUSE } from './config.js';
import { makeRivalCar } from './traffic.js';
import { awardRespect } from './progression.js';

export const MISSION_DEFS = [
  {
    id: 'first-run',
    title: 'Job 1 — The First Run',
    story: 'Rook needs a driver he can trust. Get to the Marina checkpoint before the harbour patrol changes shift.',
    objective: 'Reach the Marina checkpoint',
    targetName: 'the Marina checkpoint',
    reward: 250,
    target: { x: 3000, y: 200 },
    radius: 90,
  },
  {
    id: 'the-package',
    title: 'Job 2 — The Package',
    story: 'A crate came off a freighter at the docks and it is not on any manifest. Pick it up, then drop it at the hideout on Sol Plaza — no questions, no stops.',
    objective: 'Pick up the package at the docks, then deliver it to the hideout',
    targetName: 'the hideout on Sol Plaza',
    reward: 400,
    pickup: { x: 200, y: 2000 },
    target: { x: SAFEHOUSE.x, y: SAFEHOUSE.y },
    radius: 90,
  },
  {
    id: 'the-fare',
    title: 'Job 3 — The Fare',
    story: 'A courier with a plane to catch and cash in hand is waiting at Harbor & 5th. One clock covers the whole job: pick her up and get her to Palm Offices before it runs out.',
    objective: 'Pick up the passenger at Harbor & 5th, then reach Palm Offices — one clock for both legs',
    targetName: 'Palm Offices',
    reward: 550,
    pickup: { x: 2600, y: 600 },
    target: { x: 600, y: 1800 },
    radius: 90,
    timeLimit: 50,
  },
  {
    id: 'checkpoint-run',
    title: 'Job 4 — Checkpoint Run',
    story: 'Rook is timing you against the other drivers in his stable. Five checkpoints around the centre, each one buys a few more seconds. Beat the clock and the job is yours.',
    objective: 'Hit every checkpoint before the clock runs out — each one buys time',
    targetName: 'the next checkpoint',
    reward: 750,
    checkpoints: [
      { x: 1000, y: 1400 },
      { x: 1800, y: 1400 },
      { x: 2200, y: 1000 },
      { x: 1800, y: 600 },
      { x: 1000, y: 600 },
    ],
    radius: 80,
    timeLimit: 35,
    checkpointBonus: 6,
  },
  {
    id: 'street-race',
    title: 'Job 5 — Harbor Sprint',
    story: 'Rook has two drivers and one contract, so he is settling it the old way. The other driver — quick, loud, magenta coupe — is waiting at the first gate. Six gates across the centre: cross the first one to start her clock, and reach the last one before she does.',
    objective: 'Outrun the magenta coupe — six gates, first to the last gate wins',
    targetName: 'the next gate',
    reward: 900,
    race: true,
    checkpoints: [
      { x: 1000, y: 600 },
      { x: 1800, y: 600 },
      { x: 2600, y: 600 },
      { x: 2600, y: 1400 },
      { x: 1800, y: 1400 },
      { x: 1000, y: 1400 },
    ],
    radius: 80,
  },
  {
    id: 'heat-escape',
    title: 'Job 6 — Lose the Heat',
    story: 'The sprint made the evening news, apparently. The whole Aurora PD is on you now — three stars and climbing. Shake them off and get back to zero before Rook will call again.',
    objective: 'Lose the 3-star wanted level — get back to zero stars',
    targetName: 'somewhere quiet',
    reward: 800,
    startWanted: 3,
    target: null,
    radius: 0,
  },
  {
    id: 'fragile-cargo',
    title: 'Job 7 — Glass Run',
    story: 'A collector at Crescent Lofts is paying for a crate of vintage glassware off the same freighter — unbroken. Pick it up at the docks and carry it across town like it is made of, well, glass. Every hard knock cracks more of it, and if it all goes, so does the job.',
    objective: 'Pick up the glassware at the docks, then deliver it to Crescent Lofts — intact',
    targetName: 'the Crescent Lofts depot',
    reward: 950,
    fragile: true,
    pickup: { x: 200, y: 2000 },
    target: { x: 2600, y: 1800 },
    radius: 90,
  },
  {
    id: 'the-getaway',
    title: 'Job 8 — The Getaway',
    story: 'A score went loud across town and the response is four stars deep, roadblocks and all. Rook does not care how you do it: reach the Sol Plaza safehouse and lie low.',
    objective: 'Reach the Sol Plaza safehouse',
    targetName: 'the Sol Plaza safehouse',
    reward: 900,
    startWanted: 4,
    target: { x: SAFEHOUSE.x, y: SAFEHOUSE.y },
    radius: 100,
  },
  {
    id: 'kingpin-run',
    title: 'Job 9 — Kingpin Run',
    story: 'The last job of the old night, and the whole force knows your face: five stars from the first block, and the helicopter with them. Take the kingpin\'s package off the docks and deliver it to his people at the Marina.',
    objective: 'Pick up the package at the docks, then deliver it to the Marina — at five stars',
    targetName: 'the Marina',
    reward: 1200,
    startWanted: 5,
    pickup: { x: 200, y: 2000 },
    target: { x: 3000, y: 200 },
    radius: 90,
  },
  {
    id: 'boardwalk-courier',
    title: 'Job 10 — Boardwalk Courier',
    story: 'New night, new wheels. A promoter at the Aurora Wheel needs contracts from the docks before the Boardwalk show starts — and the job is built for a motorbike: narrow, quick, and gone. Grab the packet at the docks and thread it to the Boardwalk.',
    objective: 'Pick up the packet at the docks, then deliver it to the Aurora Wheel on the Boardwalk',
    targetName: 'the Aurora Wheel',
    reward: 700,
    pickup: { x: 200, y: 2000 },
    target: { x: 2850, y: 2050 },
    radius: 95,
    timeLimit: 75,
  },
  {
    id: 'night-fare',
    title: 'Job 11 — Night Fare',
    story: 'You take one honest taxi shift and this happens: your fare at the Boardwalk is a witness, the two stars behind you are not a tip, and her safe address is across town. One clock, live heat — drive like a cabbie with something to lose.',
    objective: 'Pick up the fare at the Boardwalk, then reach Harbor View — one clock, with the heat on',
    targetName: 'Harbor View',
    reward: 850,
    startWanted: 2,
    pickup: { x: 2400, y: 2050 },
    target: { x: 600, y: 600 },
    radius: 90,
    timeLimit: 70,
  },
  {
    id: 'first-watch',
    title: 'Job 12 — First Watch',
    story: 'A shopkeeper on the Boardwalk keeps getting rolled by the same crew, and tonight you are the neighbourhood watch. Two stars of attention are already on you — reach the Boardwalk safehouse corner and hold the block until the heat cools and the street is yours.',
    objective: 'Reach the Boardwalk corner, then lose the 2-star heat',
    targetName: 'the Boardwalk corner',
    reward: 800,
    startWanted: 2,
    target: { x: 2600, y: 2000 },
    radius: 110,
  },
];

export const MISSION_COUNT = MISSION_DEFS.length;
export const MISSION_TOTAL_REWARD = MISSION_DEFS.reduce((sum, def) => sum + def.reward, 0);

function initialStage(def) {
  if (def.pickup) return 'pickup';
  if (def.race) return 'race';
  if (def.checkpoints) return 'checkpoints';
  if (def.id === 'heat-escape') return 'escape';
  return 'go';
}

function clearRival(world) {
  if (world.rival && world.rival.car) {
    const index = world.cars.indexOf(world.rival.car);
    if (index !== -1) world.cars.splice(index, 1);
  }
  world.rival = null;
}

function beginJob(world, index, applyHeat) {
  clearRival(world);
  const def = MISSION_DEFS[index];
  world.missionIndex = index;
  world.mission = {
    def,
    stage: initialStage(def),
    hasPackage: false,
    done: false,
    timeLeft: def.timeLimit ?? null,
    checkpointIndex: 0,
    cargo: def.fragile ? 100 : null,
    startedAt: world.time,
  };
  if (def.race) {
    const gate = def.checkpoints[0];
    const car = makeRivalCar(world.rng, gate.x - 90, gate.y, 0);
    world.cars.push(car);
    world.rival = { car, gate: 0, started: false };
  }
  if (applyHeat) {
    if (def.id === 'heat-escape') {
      world.wanted = 3;
      world.timeSinceCrime = 0;
      world.wantedTimer = 0;
    } else if (def.startWanted) {
      world.wanted = Math.max(world.wanted, def.startWanted);
      world.timeSinceCrime = 0;
    }
  }
  return world.mission;
}

export function startMission(world, index) {
  return beginJob(world, index, true);
}

export function missionTarget(world) {
  const mission = world.mission;
  if (!mission || mission.done || !mission.def) return null;
  if (mission.stage === 'pickup') return mission.def.pickup;
  if (mission.stage === 'checkpoints' || mission.stage === 'race') {
    return mission.def.checkpoints[mission.checkpointIndex];
  }
  if (mission.stage === 'go' || mission.stage === 'deliver') return mission.def.target;
  return null;
}

export function missionObjectiveText(world) {
  const mission = world.mission;
  if (!mission || !mission.def) return 'Free roam — explore Port Aurora';
  if (mission.done) return 'All jobs done — free roam, Port Aurora is yours';
  const def = mission.def;
  if (mission.stage === 'pickup') {
    if (def.id === 'the-fare') return 'Pick up the passenger at Harbor & 5th — the clock is already running';
    if (def.id === 'night-fare') return 'Pick up the fare at the Boardwalk — the clock and the heat are both running';
    if (def.fragile) return 'Pick up the glassware at the docks (west end) — gently does it';
    return 'Pick up the package at the docks (west end)';
  }
  if (mission.stage === 'deliver') {
    if (def.fragile) return `Deliver the glassware to ${def.targetName} — cargo ${Math.max(0, Math.round(mission.cargo))}% whole`;
    return `Deliver it to ${def.targetName}`;
  }
  if (mission.stage === 'checkpoints') {
    return `Checkpoint ${mission.checkpointIndex + 1} of ${def.checkpoints.length} — each one buys +${def.checkpointBonus}s`;
  }
  if (mission.stage === 'race') {
    const rivalGate = world.rival ? world.rival.gate : 0;
    return `Gate ${mission.checkpointIndex + 1} of ${def.checkpoints.length} — rival at gate ${rivalGate + 1}`;
  }
  if (def.id === 'heat-escape') return `Lose the heat — wanted level ${world.wanted} / 0`;
  return def.objective;
}

export function missionEventText(world, event) {
  if (event === 'package-picked') {
    const def = world.mission && world.mission.def;
    if (def && def.id === 'the-fare') return `Passenger aboard. Get her to ${def.targetName} before the clock runs out.`;
    if (def && def.id === 'night-fare') return `Fare aboard and the heat is live. Get her to ${def.targetName}.`;
    if (def && def.fragile) return `Glassware aboard — every hard knock cracks it. Deliver it whole to ${def.targetName}.`;
    if (def) return `Package secured. Deliver it to ${def.targetName}.`;
    return 'Package secured.';
  }
  if (event === 'mission-failed' && world.jobFailed) {
    if (world.jobFailed.reason === 'cargo') return `${world.jobFailed.title} failed — the cargo is smashed. The job restarts.`;
    if (world.jobFailed.reason === 'outrun') return `${world.jobFailed.title} failed — the rival took the last gate. The job restarts.`;
    return `${world.jobFailed.title} failed — out of time. The job restarts.`;
  }
  if (event === 'checkpoint') {
    const def = world.mission && world.mission.def;
    if (def && def.race) return 'Gate! Keep pushing — she is right behind you.';
    return 'Checkpoint! More time on the clock.';
  }
  return '';
}

function failJob(world, reason) {
  const def = world.mission.def;
  world.jobFailed = { title: def.title, reason };
  beginJob(world, world.missionIndex, false);
  return 'mission-failed';
}

function completeMission(world) {
  const mission = world.mission;
  const def = mission.def;
  mission.done = true;
  clearRival(world);
  world.player.money += def.reward;
  world.player.earned += def.reward;
  world.missionsDone += 1;
  const levelUp = awardRespect(world, RESPECT_MISSION);
  if (levelUp) world.levelUp = { ...levelUp, until: world.time + 5 };
  world.jobToast = {
    title: def.title,
    reward: def.reward,
    cash: world.player.money,
    jobs: world.missionsDone,
    totalTime: world.time,
    until: world.time + 4.5,
  };
  const next = world.missionIndex + 1;
  if (next < MISSION_DEFS.length) {
    startMission(world, next);
  } else {
    world.mission = {
      def: null, stage: 'done', hasPackage: false, done: true,
      timeLeft: null, checkpointIndex: 0, cargo: null, startedAt: world.time,
    };
  }
  return 'mission-complete';
}

export function damageCargoOnCrash(world) {
  const mission = world.mission;
  if (!mission || mission.done || !mission.def || !mission.def.fragile) return null;
  if (mission.stage !== 'deliver' || mission.cargo === null) return null;
  mission.cargo -= CARGO_CRASH_DAMAGE;
  if (mission.cargo <= 0) {
    mission.cargo = 0;
    return failJob(world, 'cargo');
  }
  return null;
}

export function updateMission(world, dt) {
  const mission = world.mission;
  if (!mission || mission.done || !mission.def) return null;
  if (mission.timeLeft !== null) {
    mission.timeLeft -= dt;
    if (mission.timeLeft <= 0) return failJob(world, 'time');
  }
  const player = world.player;
  const def = mission.def;
  const near = (point, radius) => Math.hypot(player.x - point.x, player.y - point.y) < radius;
  if (mission.stage === 'pickup') {
    if (near(def.pickup, def.radius)) {
      mission.stage = 'deliver';
      mission.hasPackage = true;
      return 'package-picked';
    }
    return null;
  }
  if (mission.stage === 'checkpoints') {
    const point = def.checkpoints[mission.checkpointIndex];
    if (near(point, def.radius)) {
      mission.checkpointIndex += 1;
      if (def.checkpointBonus && mission.timeLeft !== null) mission.timeLeft += def.checkpointBonus;
      if (mission.checkpointIndex >= def.checkpoints.length) return completeMission(world);
      return 'checkpoint';
    }
    return null;
  }
  if (mission.stage === 'race') {
    const rival = world.rival;
    if (rival && rival.started && !rival.finished) {
      const gate = def.checkpoints[rival.gate];
      if (gate && Math.hypot(rival.car.x - gate.x, rival.car.y - gate.y) < def.radius) {
        rival.gate += 1;
        if (rival.gate >= def.checkpoints.length) {
          rival.finished = true;
          return failJob(world, 'outrun');
        }
      }
    }
    const point = def.checkpoints[mission.checkpointIndex];
    if (point && near(point, def.radius)) {
      mission.checkpointIndex += 1;
      if (mission.checkpointIndex === 1 && rival) rival.started = true;
      if (mission.checkpointIndex >= def.checkpoints.length) return completeMission(world);
      return 'checkpoint';
    }
    return null;
  }
  if (mission.stage === 'escape') {
    if (world.wanted === 0) return completeMission(world);
    return null;
  }
  if (def.target && near(def.target, def.radius)) return completeMission(world);
  return null;
}
