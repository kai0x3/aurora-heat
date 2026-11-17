// The wanted level and the Port Aurora police who answer it. Crimes raise the
// stars; staying quiet and out of sight lets them fall. Police cruisers spawn on
// the roads near the player, chase, and ram — on foot they close in and beat the
// player down; in a car they try to spin the player out.

import {
  CAR_LENGTH, POLICE_CAR_HP, POLICE_SPEED, WANTED_DECAY_SECONDS, WANTED_MAX,
  WANTED_QUIET_SECONDS, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { hitsBuilding, randomRoadPoint } from './city.js';

export const POLICE_COLORS = ['#1c2f5e', '#22366e'];

/** How many cruisers are on the street for each wanted level. */
export function policeCountForWanted(stars) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(WANTED_MAX, stars))];
}

/** Raise the wanted level by `n`, capped at the maximum, and reset the quiet timer. */
export function addWanted(world, n) {
  world.wanted = Math.min(WANTED_MAX, world.wanted + n);
  world.timeSinceCrime = 0;
  world.wantedTimer = 0;
}

/** Let the wanted level decay once the player has been quiet and unseen for a while. */
export function updateWanted(world, dt) {
  world.timeSinceCrime += dt;
  const policeNear = world.police.some((car) => Math.hypot(car.x - world.player.x, car.y - world.player.y) < 420);
  if (world.wanted > 0 && world.timeSinceCrime > WANTED_QUIET_SECONDS && !policeNear) {
    world.wantedTimer += dt;
    if (world.wantedTimer >= WANTED_DECAY_SECONDS) {
      world.wanted -= 1;
      world.wantedTimer = 0;
    }
  } else {
    world.wantedTimer = 0;
  }
}

function makePoliceCar(rng, player) {
  const point = randomRoadPoint(rng);
  // Spawn on a road within a few blocks of the player, never on top of them.
  let x = point.x;
  let y = point.y;
  let tries = 0;
  while (Math.hypot(x - player.x, y - player.y) < 380 && tries < 10) {
    const p2 = randomRoadPoint(rng);
    x = p2.x;
    y = p2.y;
    tries += 1;
  }
  return {
    kind: 'police', x, y, angle: Math.atan2(player.y - y, player.x - x),
    speed: 0, color: rng.pick(POLICE_COLORS), hp: POLICE_CAR_HP,
    driver: 'ai', sirenPhase: rng.range(0, 1), stuckTimer: 0,
  };
}

/** Keep the number of cruisers on the street matched to the wanted level. */
export function updatePoliceSpawns(world, dt) {
  const wanted = policeCountForWanted(world.wanted);
  while (world.police.length < wanted) {
    const car = makePoliceCar(world.rng, world.player);
    world.police.push(car);
    world.cars.push(car);
  }
  while (world.police.length > wanted) {
    const car = world.police.pop();
    const index = world.cars.indexOf(car);
    if (index !== -1) world.cars.splice(index, 1);
  }
}

/**
 * Chase the player: steer toward them, faster than traffic, and ram. The cruiser
 * slides along buildings instead of driving through them, and backs out and turns
 * away when it wedges itself against a wall.
 */
export function updatePoliceCar(car, world, dt) {
  const player = world.player;
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const dist = Math.hypot(dx, dy);
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  car.angle += steer * 2.4 * dt;
  const speed = dist > 700 ? POLICE_SPEED : POLICE_SPEED * 0.85;
  car.speed = speed;
  const prevX = car.x;
  const prevY = car.y;
  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  const r = CAR_LENGTH / 2;
  if (!hitsBuilding(world.city, nx, car.y, r)) car.x = nx;
  if (!hitsBuilding(world.city, car.x, ny, r)) car.y = ny;
  car.x = Math.max(30, Math.min(WORLD_WIDTH - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_HEIGHT - 150, car.y));
  car.sirenPhase += dt;
  // Wedged against a wall: back out and turn away, then resume the chase.
  const moved = Math.hypot(car.x - prevX, car.y - prevY);
  if (speed > 100 && moved < speed * dt * 0.25) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  if (car.stuckTimer > 1.0) {
    car.angle += 2.4 * dt;
    const bx = car.x - Math.cos(car.angle) * 150 * dt;
    const by = car.y - Math.sin(car.angle) * 150 * dt;
    if (!hitsBuilding(world.city, bx, car.y, r)) car.x = bx;
    if (!hitsBuilding(world.city, car.x, by, r)) car.y = by;
    if (car.stuckTimer > 1.8) car.stuckTimer = 0;
  }
}

/** The flashing light phase for a cruiser's light bar (0 = red, 1 = blue). */
export function sirenColor(car) {
  return Math.floor(car.sirenPhase * 4) % 2 === 0 ? '#ff2b2b' : '#2b5cff';
}
