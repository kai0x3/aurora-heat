// Side activities (v4): repeatable street work, marked on the minimap,
// paying cash + Respect. Taxi fares from flagged passengers, a timed
// Vigilante stop, a Rampage score attack in a marked zone, and the Harbor
// Sprint street race made repeatable with best-time tracking. One activity
// runs at a time; starting one replaces any other. All randomness comes from
// the world RNG, so scenes stay deterministic.

import {
  RAMPAGE_REWARD, RAMPAGE_SECONDS, RAMPAGE_TARGET, RESPECT_ACTIVITY,
  TAXI_FARE_BASE, VIGILANTE_REWARD, VIGILANTE_SECONDS,
} from './config.js';
import { randomRoadPoint } from './city.js';
import { awardRespect } from './progression.js';

export const ACTIVITY_KINDS = ['taxi', 'vigilante', 'rampage', 'race'];

// Where each activity is offered from (also its minimap marker while idle).
export const ACTIVITY_SPOTS = {
  taxi: { x: 2600, y: 600, label: 'TAXI' },
  vigilante: { x: 600, y: 1000, label: 'VIGILANTE' },
  rampage: { x: 2400, y: 2100, label: 'RAMPAGE' },
  race: { x: 1000, y: 600, label: 'RACE' },
};

export const RACE_GATES = [
  { x: 1000, y: 600 }, { x: 1800, y: 600 }, { x: 2600, y: 600 },
  { x: 2600, y: 1400 }, { x: 1800, y: 1400 }, { x: 1000, y: 1400 },
];

/** Start an activity of `kind`. Returns the live activity object. */
export function startActivity(world, kind) {
  const rng = world.rng;
  const spot = ACTIVITY_SPOTS[kind];
  const activity = {
    kind, stage: 'pickup', timeLeft: null, score: 0, startedAt: world.time,
    target: null, car: null, gate: 0, fareDamage: 0,
  };
  if (kind === 'taxi') {
    const from = randomRoadPoint(rng);
    const to = randomRoadPoint(rng);
    activity.target = { x: from.x, y: from.y };
    activity.drop = { x: to.x, y: to.y };
    activity.stage = 'pickup';
  } else if (kind === 'vigilante') {
    activity.timeLeft = VIGILANTE_SECONDS;
    activity.stage = 'chase';
    // The marked criminal car joins traffic near the player.
    const near = randomRoadPoint(rng);
    const car = world.cars.find((c) => c.kind === 'traffic' && c.driver === 'ai');
    if (car) {
      car.x = near.x; car.y = near.y;
      car.criminal = true;
      activity.car = car;
      activity.target = car;
    }
  } else if (kind === 'rampage') {
    activity.timeLeft = RAMPAGE_SECONDS;
    activity.stage = 'score';
    activity.target = { x: spot.x, y: spot.y };
    activity.zoneRadius = 260;
  } else if (kind === 'race') {
    activity.stage = 'gates';
    activity.gate = 0;
    activity.target = RACE_GATES[0];
    activity.raceStart = null;
  }
  world.activity = activity;
  return activity;
}

function finish(world, reward, note) {
  world.player.money += reward;
  world.player.earned += reward;
  const levelUp = awardRespect(world, RESPECT_ACTIVITY);
  world.activityToast = { note, reward, until: world.time + 4 };
  world.activity = null;
  return levelUp ? 'activity-complete-levelup' : 'activity-complete';
}

function fail(world, note) {
  world.activityToast = { note, reward: 0, until: world.time + 4 };
  if (world.activity && world.activity.car) world.activity.car.criminal = false;
  world.activity = null;
  return 'activity-failed';
}

/** The map point the HUD/minimap should mark for the live activity. */
export function activityTarget(world) {
  const a = world.activity;
  if (!a) return null;
  if (a.kind === 'taxi') return a.stage === 'pickup' ? a.target : a.drop;
  if (a.kind === 'vigilante' && a.car) return a.car;
  if (a.kind === 'race') return RACE_GATES[a.gate] || null;
  return a.target;
}

export function activityText(world) {
  const a = world.activity;
  if (!a) return null;
  if (a.kind === 'taxi') {
    return a.stage === 'pickup'
      ? 'TAXI — pick up the flagged passenger'
      : 'TAXI — deliver them fast and clean for a bigger fare';
  }
  if (a.kind === 'vigilante') return 'VIGILANTE — stop the marked car before the clock runs out';
  if (a.kind === 'rampage') return `RAMPAGE — score ${RAMPAGE_TARGET} in the zone (near misses, drifts, chaos): ${a.score}`;
  if (a.kind === 'race') return `STREET RACE — gate ${a.gate + 1} of ${RACE_GATES.length}${world.bestRace ? ` • best ${world.bestRace.toFixed(1)}s` : ''}`;
  return null;
}

/** Advance the live activity. Returns an event string or null. */
export function updateActivity(world, dt) {
  const a = world.activity;
  if (!a) return null;
  const player = world.player;
  if (a.timeLeft !== null) {
    a.timeLeft -= dt;
    if (a.timeLeft <= 0) {
      if (a.kind === 'rampage' && a.score >= RAMPAGE_TARGET) {
        return finish(world, RAMPAGE_REWARD, 'Rampage cleared!');
      }
      return fail(world, a.kind === 'rampage' ? 'Rampage fell short' : 'Out of time');
    }
  }
  const near = (p, r) => p && Math.hypot(player.x - p.x, player.y - p.y) < r;
  if (a.kind === 'taxi') {
    if (a.stage === 'pickup' && near(a.target, 80)) {
      a.stage = 'deliver';
      a.fareDamage = player.car ? player.car.hp : 100;
      return 'activity-pickup';
    }
    if (a.stage === 'deliver' && near(a.drop, 90)) {
      const clean = player.car ? Math.max(0, player.car.hp) : 60;
      const damagePenalty = Math.max(0, (a.fareDamage - clean)) * 1.2;
      const fare = Math.max(30, Math.round(TAXI_FARE_BASE + 140 - damagePenalty));
      return finish(world, fare, `Fare paid $${fare} — smooth driving pays`);
    }
  }
  if (a.kind === 'vigilante') {
    if (!a.car || !world.cars.includes(a.car)) return finish(world, VIGILANTE_REWARD, 'Vigilante: target stopped');
    if (Math.abs(a.car.speed || 0) < 12 && Math.hypot(player.x - a.car.x, player.y - a.car.y) < 90) {
      a.car.criminal = false;
      return finish(world, VIGILANTE_REWARD, 'Vigilante: target stopped');
    }
  }
  if (a.kind === 'race') {
    const gate = RACE_GATES[a.gate];
    if (gate && near(gate, 85)) {
      if (a.gate === 0) a.raceStart = world.time;
      a.gate += 1;
      if (a.gate >= RACE_GATES.length) {
        const time = world.time - (a.raceStart ?? world.time);
        const isBest = !world.bestRace || time < world.bestRace;
        if (isBest) world.bestRace = time;
        return finish(world, 200, `Race finished in ${time.toFixed(1)}s${isBest ? ' — new best!' : ''}`);
      }
      return 'activity-gate';
    }
  }
  return null;
}

/** Rampage scoring hook: the world calls this for scoreable chaos in the zone. */
export function rampageScore(world, points) {
  const a = world.activity;
  if (!a || a.kind !== 'rampage') return;
  if (Math.hypot(world.player.x - a.target.x, world.player.y - a.target.y) > a.zoneRadius) return;
  a.score += points;
}
