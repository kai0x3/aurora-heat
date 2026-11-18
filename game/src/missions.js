// The story and its seven jobs. Rook, a fixer who works out of the Marina, keeps
// finding work for a driver who can stay ahead of the Aurora PD: a first run to
// prove yourself, a package to move, a fare against the clock, a checkpoint run,
// two escapes, and a kingpin run at five stars to finish the night. Each job has
// a title, a story beat, an objective the HUD shows, a target on the map, and a
// cash reward; timed jobs share one mission clock between their stages, and a
// clock that runs out restarts the job. Finishing all seven leaves the player
// free-roaming Port Aurora with the money they earned.

import { SAFEHOUSE } from './config.js';

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
    id: 'heat-escape',
    title: 'Job 5 — Lose the Heat',
    story: 'The checkpoint run was televised, apparently. The whole Aurora PD is on you now — three stars and climbing. Shake them off and get back to zero before Rook will call again.',
    objective: 'Lose the 3-star wanted level — get back to zero stars',
    targetName: 'somewhere quiet',
    reward: 800,
    startWanted: 3,
    target: null,
    radius: 0,
  },
  {
    id: 'the-getaway',
    title: 'Job 6 — The Getaway',
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
    title: 'Job 7 — Kingpin Run',
    story: 'The last job of the night, and the whole force knows your face: five stars from the first block. Take the kingpin\'s package off the docks and deliver it to his people at the Marina.',
    objective: 'Pick up the package at the docks, then deliver it to the Marina — at five stars',
    targetName: 'the Marina',
    reward: 1200,
    startWanted: 5,
    pickup: { x: 200, y: 2000 },
    target: { x: 3000, y: 200 },
    radius: 90,
  },
];

export const MISSION_COUNT = MISSION_DEFS.length;

function initialStage(def) {
  if (def.pickup) return 'pickup';
  if (def.checkpoints) return 'checkpoints';
  if (def.id === 'heat-escape') return 'escape';
  return 'go';
}

function beginJob(world, index, applyHeat) {
  const def = MISSION_DEFS[index];
  world.missionIndex = index;
  world.mission = {
    def,
    stage: initialStage(def),
    hasPackage: false,
    done: false,
    timeLeft: def.timeLimit ?? null,
    checkpointIndex: 0,
    startedAt: world.time,
  };
  if (applyHeat) {
    if (def.id === 'heat-escape') {
      // The escape starts hot: three stars, cruisers already rolling.
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

/** The map point the HUD marker and minimap should point at right now, or null. */
export function missionTarget(world) {
  const mission = world.mission;
  if (!mission || mission.done || !mission.def) return null;
  if (mission.stage === 'pickup') return mission.def.pickup;
  if (mission.stage === 'checkpoints') return mission.def.checkpoints[mission.checkpointIndex];
  if (mission.stage === 'go' || mission.stage === 'deliver') return mission.def.target;
  return null;
}

/** The objective line the HUD shows for the current mission. */
export function missionObjectiveText(world) {
  const mission = world.mission;
  if (!mission || !mission.def) return 'Free roam — explore Port Aurora';
  if (mission.done) return 'All jobs done — free roam, Port Aurora is yours';
  const def = mission.def;
  if (mission.stage === 'pickup') {
    return def.id === 'the-fare'
      ? 'Pick up the passenger at Harbor & 5th — the clock is already running'
      : 'Pick up the package at the docks (west end)';
  }
  if (mission.stage === 'deliver') return `Deliver it to ${def.targetName}`;
  if (mission.stage === 'checkpoints') {
    return `Checkpoint ${mission.checkpointIndex + 1} of ${def.checkpoints.length} — each one buys +${def.checkpointBonus}s`;
  }
  if (def.id === 'heat-escape') return `Lose the heat — wanted level ${world.wanted} / 0`;
  return def.objective;
}

/** The line the game announces when a mission event lands, worded for the job it belongs to. */
export function missionEventText(world, event) {
  if (event === 'package-picked') {
    const def = world.mission && world.mission.def;
    if (def && def.id === 'the-fare') return `Passenger aboard. Get her to ${def.targetName} before the clock runs out.`;
    if (def) return `Package secured. Deliver it to ${def.targetName}.`;
    return 'Package secured.';
  }
  if (event === 'mission-failed' && world.jobFailed) {
    return `${world.jobFailed.title} failed — out of time. The job restarts.`;
  }
  if (event === 'checkpoint') return 'Checkpoint! More time on the clock.';
  return '';
}

function restartJob(world) {
  const def = world.mission.def;
  world.jobFailed = { title: def.title };
  // The clock ran out: same job, fresh clock, heat left exactly as it lies.
  beginJob(world, world.missionIndex, false);
  return 'mission-failed';
}

function completeMission(world) {
  const mission = world.mission;
  const def = mission.def;
  mission.done = true;
  world.player.money += def.reward;
  world.player.earned += def.reward;
  world.missionsDone += 1;
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
      timeLeft: null, checkpointIndex: 0, startedAt: world.time,
    };
  }
  return 'mission-complete';
}

/**
 * Advance the current mission by one step. Returns an event string
 * ('mission-complete', 'package-picked', 'checkpoint', 'mission-failed') or null.
 * The mission clock runs through every stage of a timed job — the fare's pickup
 * leg spends the same seconds as its delivery — and a clock at zero restarts it.
 */
export function updateMission(world, dt) {
  const mission = world.mission;
  if (!mission || mission.done || !mission.def) return null;
  if (mission.timeLeft !== null) {
    mission.timeLeft -= dt;
    if (mission.timeLeft <= 0) return restartJob(world);
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
  if (mission.stage === 'escape') {
    if (world.wanted === 0) return completeMission(world);
    return null;
  }
  if (def.target && near(def.target, def.radius)) return completeMission(world);
  return null;
}
