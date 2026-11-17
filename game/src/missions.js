// The story and its three jobs. Each mission has a title, a story beat, an
// objective the HUD shows, a target on the map, and a cash reward. Missions run in
// order; finishing all three leaves the player free-roaming Port Aurora with the
// money they earned.

import { MISSION_REWARDS } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'first-job',
    title: 'Job 1 — The First Run',
    story: 'Rook needs a driver he can trust. Get to the Marina checkpoint before the harbour patrol changes shift.',
    objective: 'Reach the Marina checkpoint',
    reward: MISSION_REWARDS[0],
    target: { x: 3000, y: 200 },
    radius: 90,
  },
  {
    id: 'the-package',
    title: 'Job 2 — The Package',
    story: 'A crate came off a freighter at the docks and it is not on any manifest. Pick it up, then drop it at the hideout on Sol Plaza — no questions, no stops.',
    objective: 'Pick up the package at the docks, then deliver it to the hideout',
    reward: MISSION_REWARDS[1],
    pickup: { x: 200, y: 2000 },
    target: { x: 1400, y: 1000 },
    radius: 90,
  },
  {
    id: 'heat-escape',
    title: 'Job 3 — Lose the Heat',
    story: 'The pickup was watched. The whole Aurora PD is on you now — three stars and climbing. Shake them off and get back to zero before Rook will call again.',
    objective: 'Lose the 3-star wanted level — get back to zero stars',
    reward: MISSION_REWARDS[2],
    target: null,
    radius: 0,
  },
];

export function startMission(world, index) {
  const def = MISSION_DEFS[index];
  world.missionIndex = index;
  world.mission = {
    def,
    stage: def.pickup ? 'pickup' : 'go',
    hasPackage: false,
    done: false,
  };
  if (index === 2) {
    // The escape starts hot: three stars, cruisers already rolling.
    world.wanted = 3;
    world.timeSinceCrime = 0;
  }
  return world.mission;
}

/** The map point the HUD marker and minimap should point at right now, or null. */
export function missionTarget(world) {
  const mission = world.mission;
  if (!mission || mission.done) return null;
  if (mission.stage === 'pickup') return mission.def.pickup;
  if (mission.stage === 'go' || mission.stage === 'deliver') return mission.def.target;
  return null;
}

/** The objective line the HUD shows for the current mission. */
export function missionObjectiveText(world) {
  const mission = world.mission;
  if (!mission) return 'Free roam — explore Port Aurora';
  if (mission.done) return 'All jobs done — free roam, Port Aurora is yours';
  if (mission.stage === 'pickup') return 'Pick up the package at the docks (west end)';
  if (mission.stage === 'deliver') return 'Deliver the package to the hideout on Sol Plaza';
  if (mission.def.id === 'heat-escape') return `Lose the heat — wanted level ${world.wanted} / 0`;
  return mission.def.objective;
}

/**
 * Advance the current mission. Returns an event string ('mission-complete',
 * 'package-picked') or null. Completing a mission pays out and starts the next one.
 */
export function updateMission(world) {
  const mission = world.mission;
  if (!mission || mission.done) return null;
  const player = world.player;
  if (mission.stage === 'pickup') {
    const p = mission.def.pickup;
    if (Math.hypot(player.x - p.x, player.y - p.y) < mission.def.radius) {
      mission.stage = 'deliver';
      mission.hasPackage = true;
      return 'package-picked';
    }
    return null;
  }
  if (mission.def.id === 'heat-escape') {
    if (world.wanted === 0) {
      return completeMission(world);
    }
    return null;
  }
  const target = mission.def.target;
  if (target && Math.hypot(player.x - target.x, player.y - target.y) < mission.def.radius) {
    return completeMission(world);
  }
  return null;
}

function completeMission(world) {
  const mission = world.mission;
  mission.done = true;
  world.player.money += mission.def.reward;
  world.player.earned += mission.def.reward;
  world.missionsDone += 1;
  const next = world.missionIndex + 1;
  if (next < MISSION_DEFS.length) {
    startMission(world, next);
  } else {
    world.mission = { def: null, stage: 'done', hasPackage: false, done: true };
  }
  return 'mission-complete';
}
