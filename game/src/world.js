// The world: everything that exists in Port Aurora and one fixed step that moves
// it all. This module owns the state and the rules that tie the other modules
// together — the player on foot and behind the wheel, car theft, pickups, damage,
// the camera — but it draws nothing and hears nothing.
//
// One rule matters more than it looks: the traffic update steers only cars whose
// driver is the traffic AI. The player's car and parked cars are never touched by
// it — the wheel belongs to whoever is actually driving.

import {
  CASH_PICKUP_VALUE, PLAYER_HEALTH_MAX, PLAYER_RADIUS, PLAYER_WALK_SPEED,
  WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { generateCity, hitsBuilding, isInWater, resolveBuildingCollision } from './city.js';
import { createRng } from './random.js';
import { nearestCarTo, spawnParkedCars, spawnPedestrians, spawnTraffic, updatePedestrian, updateTrafficCar } from './traffic.js';
import { addWanted, updatePoliceCar, updatePoliceSpawns, updateRoadblocks, updateWanted } from './police.js';
import { destroyPoliceCar, fireBullet, updateBullets } from './combat.js';
import { startMission, updateMission } from './missions.js';

export const EVENT_MISSION = 1;
export const EVENT_PICKUP = 2;
export const EVENT_PACKAGE = 4;
export const EVENT_OVER = 8;
export const EVENT_SHOT = 16;
export const EVENT_FAIL = 32;
export const EVENT_CHECKPOINT = 64;
export const EVENT_CRASH = 128;

const PLAYER_SPAWN = { x: 600, y: 600 };
const SKID_MAX = 520;
const SKID_LIFE = 3.5;

export function createWorld(seed) {
  const rng = createRng(seed);
  const city = generateCity(rng);
  const player = {
    x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: 0,
    health: PLAYER_HEALTH_MAX, money: 0, earned: 0,
    onFoot: true, car: null, speed: 0,
  };
  const world = {
    rng, city, player,
    cars: [], police: [], peds: [], bullets: [], particles: [], pickups: [], skids: [],
    wanted: 0, wantedTimer: 0, timeSinceCrime: 99,
    missionIndex: 0, mission: null, missionsDone: 0,
    roadblock: { cars: [], cooldown: 0 },
    jobToast: null, jobFailed: null, playerSliding: false, smokeTimer: 0,
    camera: { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y },
    time: 0, fireCooldown: 0, shotsFired: 0, carsStolen: 0,
    over: false, overReason: '',
  };
  world.reset = () => reset(world);
  world.step = (dt, input, harmless) => stepWorld(world, dt, input, harmless);
  world.toggleCar = () => toggleCar(world);
  reset(world);
  return world;
}

function reset(world) {
  const { rng, city, player } = world;
  player.x = PLAYER_SPAWN.x;
  player.y = PLAYER_SPAWN.y;
  player.angle = 0;
  player.health = PLAYER_HEALTH_MAX;
  player.money = 0;
  player.earned = 0;
  player.onFoot = true;
  player.car = null;
  player.speed = 0;
  world.cars = [...spawnTraffic(rng, city), ...spawnParkedCars(rng, city)];
  world.police = [];
  world.peds = spawnPedestrians(rng, city);
  world.bullets = [];
  world.particles = [];
  world.skids = [];
  world.pickups = makeCashPickups(rng, city);
  world.wanted = 0;
  world.wantedTimer = 0;
  world.timeSinceCrime = 99;
  world.missionIndex = 0;
  world.missionsDone = 0;
  world.roadblock = { cars: [], cooldown: 0 };
  world.jobToast = null;
  world.jobFailed = null;
  world.playerSliding = false;
  world.smokeTimer = 0;
  world.camera.x = player.x;
  world.camera.y = player.y;
  world.time = 0;
  world.fireCooldown = 0;
  world.shotsFired = 0;
  world.carsStolen = 0;
  world.over = false;
  world.overReason = '';
  startMission(world, 0);
}

function makeCashPickups(rng, city) {
  const pickups = [];
  for (let i = 0; i < 8; i += 1) {
    let x = rng.range(150, WORLD_WIDTH - 150);
    let y = rng.range(150, WORLD_HEIGHT - 300);
    let tries = 0;
    while (hitsBuilding(city, x, y, 16) && tries < 10) {
      x = rng.range(150, WORLD_WIDTH - 150);
      y = rng.range(150, WORLD_HEIGHT - 300);
      tries += 1;
    }
    pickups.push({ x, y, kind: 'cash', value: CASH_PICKUP_VALUE, taken: false, bob: rng.range(0, 6) });
  }
  return pickups;
}

/** Steal the nearest car, or step out of the one being driven. Returns what happened. */
export function toggleCar(world) {
  const player = world.player;
  if (!player.onFoot && player.car) {
    const car = player.car;
    car.driver = 'none';
    car.speed = 0;
    player.car = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    return 'exit';
  }
  const car = nearestCarTo(world.cars, player.x, player.y, 64);
  if (!car) return null;
  if (car.kind === 'police') return null;
  const wasParked = car.driver === 'none';
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  player.speed = 0;
  world.carsStolen += 1;
  if (car.kind === 'traffic' && !wasParked) {
    // Carjacking a driven car is a crime, and the owner shouts about it.
    // Taking a parked car unnoticed draws no heat.
    addWanted(world, 1);
    const ped = world.peds.find((p) => Math.hypot(p.x - player.x, p.y - player.y) < 200);
    if (ped) {
      ped.state = 'panic';
      ped.panicTimer = 2;
    }
  }
  return 'steal';
}

function updatePlayerOnFoot(world, dt, input) {
  const player = world.player;
  world.playerSliding = false;
  const mx = input.moveX();
  const my = input.moveY();
  const len = Math.hypot(mx, my);
  if (len > 0) {
    const nx = player.x + (mx / len) * PLAYER_WALK_SPEED * dt;
    const ny = player.y + (my / len) * PLAYER_WALK_SPEED * dt;
    if (!hitsBuilding(world.city, nx, player.y, PLAYER_RADIUS) && !isInWater(nx, player.y)) player.x = nx;
    if (!hitsBuilding(world.city, player.x, ny, PLAYER_RADIUS) && !isInWater(player.x, ny)) player.y = ny;
    player.angle = Math.atan2(my, mx);
  }
  resolveBuildingCollision(world.city, player, PLAYER_RADIUS);
  player.x = Math.max(20, Math.min(WORLD_WIDTH - 20, player.x));
  player.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, player.y));
  if (isInWater(player.x, player.y)) player.y = Math.min(player.y, WORLD_HEIGHT - 140);
}

/**
 * Drive the player's car with that car kind's own numbers — its top speed, its
 * acceleration, its steering. A hard turn at speed lays a pair of skid marks and
 * sets the tyres screaming; a roadblock in the way gets shoved, hard.
 */
function updatePlayerDriving(world, dt, input) {
  const player = world.player;
  const car = player.car;
  if (!car) {
    player.onFoot = true;
    world.playerSliding = false;
    return 0;
  }
  let events = 0;
  const stats = car.stats;
  const forward = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -1 : 0;
  const steerInput = input.moveX();
  if (forward > 0) car.speed = Math.min(stats.topSpeed, car.speed + stats.accel * dt);
  else if (forward < 0) {
    car.speed = car.speed > 0
      ? Math.max(0, car.speed - stats.brake * dt)
      : Math.max(-stats.reverseMax, car.speed - stats.accel * 0.6 * dt);
  } else {
    car.speed *= Math.max(0, 1 - 1.6 * dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  const direction = car.speed >= 0 ? 1 : -1;
  car.angle += steerInput * stats.steer * dt * direction * Math.min(1, Math.abs(car.speed) / 160 + 0.25);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const blocked = hitsBuilding(world.city, nx, ny, car.length / 2);
  if (!blocked) {
    car.x = nx;
    car.y = ny;
  } else {
    if (Math.abs(car.speed) > 200) events |= EVENT_CRASH;
    car.speed *= -0.25;
    spawnCrashSparks(world, car.x, car.y);
  }
  car.x = Math.max(30, Math.min(WORLD_WIDTH - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_HEIGHT - 140, car.y));
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;

  // Sliding: fast and steering hard. The rear tyres leave their mark on the road.
  const sliding = Math.abs(car.speed) > 240 && steerInput !== 0;
  world.playerSliding = sliding;
  if (sliding) laySkidMarks(world, car);

  // A roadblock is two cruisers across the road: hit one and it goes spinning.
  for (const blockCar of [...world.roadblock.cars]) {
    const dist = Math.hypot(blockCar.x - car.x, blockCar.y - car.y);
    if (dist < 48 && Math.abs(car.speed) > 40) {
      const push = Math.atan2(blockCar.y - car.y, blockCar.x - car.x);
      const power = Math.abs(car.speed);
      blockCar.vx = Math.cos(push) * power * 0.85;
      blockCar.vy = Math.sin(push) * power * 0.85;
      blockCar.spin = world.rng.range(-3, 3);
      blockCar.hp -= power * 0.1;
      car.speed *= 0.5;
      spawnCrashSparks(world, (car.x + blockCar.x) / 2, (car.y + blockCar.y) / 2);
      events |= EVENT_CRASH;
      if (blockCar.hp <= 0) destroyPoliceCar(world, blockCar);
    }
  }

  // Running over a pedestrian is a crime; hitting one slows the car.
  for (const ped of world.peds) {
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 34 && Math.abs(car.speed) > 60) {
      ped.state = 'panic';
      ped.panicTimer = 2;
      ped.x += Math.cos(car.angle) * 60;
      ped.y += Math.sin(car.angle) * 60;
      addWanted(world, 1);
      car.speed *= 0.6;
    }
  }
  return events;
}

/** A pair of dark streaks under the rear wheels, fading over a few seconds. */
function laySkidMarks(world, car) {
  const backX = car.x - Math.cos(car.angle) * (car.length / 2 - 4);
  const backY = car.y - Math.sin(car.angle) * (car.length / 2 - 4);
  const perpX = Math.cos(car.angle + Math.PI / 2);
  const perpY = Math.sin(car.angle + Math.PI / 2);
  for (const side of [-1, 1]) {
    world.skids.push({
      x: backX + perpX * (car.width / 2 - 3) * side,
      y: backY + perpY * (car.width / 2 - 3) * side,
      angle: car.angle, life: SKID_LIFE, maxLife: SKID_LIFE,
    });
  }
  if (world.skids.length > SKID_MAX) world.skids.splice(0, world.skids.length - SKID_MAX);
}

/** A car running on a hurt player smokes from the bonnet. */
function updateEngineSmoke(world, dt) {
  const player = world.player;
  if (player.onFoot || !player.car || player.health >= 40) return;
  world.smokeTimer -= dt;
  if (world.smokeTimer > 0) return;
  world.smokeTimer = 0.07;
  const car = player.car;
  world.particles.push({
    x: car.x + Math.cos(car.angle) * (car.length / 2),
    y: car.y + Math.sin(car.angle) * (car.length / 2),
    vx: world.rng.range(-16, 16), vy: world.rng.range(-44, -18),
    life: 0.9, maxLife: 0.9, color: '#666', size: 6,
  });
}

function spawnCrashSparks(world, x, y) {
  for (let i = 0; i < 4; i += 1) {
    world.particles.push({
      x, y,
      vx: world.rng.range(-140, 140), vy: world.rng.range(-140, 140),
      life: 0.2, maxLife: 0.2, color: '#e8d44f', size: 3,
    });
  }
}

function updateCamera(world, dt) {
  const cam = world.camera;
  const player = world.player;
  const k = Math.min(1, dt * 5);
  cam.x += (player.x - cam.x) * k;
  cam.y += (player.y - cam.y) * k;
}

function updatePickups(world) {
  const player = world.player;
  for (const pickup of world.pickups) {
    if (pickup.taken) continue;
    pickup.bob += 0.06;
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < 30) {
      pickup.taken = true;
      player.money += pickup.value;
      player.earned += pickup.value;
      return EVENT_PICKUP;
    }
  }
  return 0;
}

function updatePoliceDamage(world, dt) {
  const player = world.player;
  if (player.health <= 0) return;
  for (const car of world.police) {
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (player.onFoot && dist < 46) {
      player.health -= 26 * dt;
    } else if (!player.onFoot && player.car && dist < 58) {
      player.health -= 6 * dt;
      player.car.speed *= Math.max(0, 1 - 0.8 * dt);
    }
  }
  if (player.health <= 0) {
    player.health = 0;
    world.over = true;
    world.overReason = 'busted';
  }
}

/**
 * One fixed step. `input` is the input state; `harmless` runs the backdrop of the
 * title screen (traffic moves, nothing can hurt or score). Returns event flags.
 */
export function stepWorld(world, dt, input, harmless) {
  let events = 0;
  world.time += dt;
  if (world.fireCooldown > 0) world.fireCooldown -= dt;

  for (const car of world.cars) {
    if (car.kind === 'police') updatePoliceCar(car, world, dt);
    else if (car.driver === 'ai') updateTrafficCar(car, dt, world.rng, world.player);
  }
  const danger = world.bullets.length > 0
    ? { x: world.bullets[0].x, y: world.bullets[0].y }
    : (world.wanted > 0 ? { x: world.player.x, y: world.player.y } : null);
  for (const ped of world.peds) updatePedestrian(ped, dt, world.rng, danger);
  updateBullets(world, dt);
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.skids.length - 1; i >= 0; i -= 1) {
    world.skids[i].life -= dt;
    if (world.skids[i].life <= 0) world.skids.splice(i, 1);
  }

  if (!harmless) {
    if (world.player.onFoot) updatePlayerOnFoot(world, dt, input);
    else events |= updatePlayerDriving(world, dt, input);
    updateWanted(world, dt);
    updatePoliceSpawns(world, dt);
    updateRoadblocks(world, dt);
    updatePoliceDamage(world, dt);
    updateEngineSmoke(world, dt);
    events |= updatePickups(world);
    const missionEvent = updateMission(world, dt);
    if (missionEvent === 'mission-complete') events |= EVENT_MISSION;
    else if (missionEvent === 'package-picked') events |= EVENT_PACKAGE;
    else if (missionEvent === 'mission-failed') events |= EVENT_FAIL;
    else if (missionEvent === 'checkpoint') events |= EVENT_CHECKPOINT;
    if (world.over) events |= EVENT_OVER;
  }
  updateCamera(world, dt);
  return events;
}

/** Aim from the player toward the mouse's world position and fire. */
export function shootAt(world, mouseWorldX, mouseWorldY) {
  if (!world.player.onFoot || world.over) return null;
  const angle = Math.atan2(mouseWorldY - world.player.y, mouseWorldX - world.player.x);
  world.player.angle = angle;
  const bullet = fireBullet(world, world.player.x + Math.cos(angle) * 20, world.player.y + Math.sin(angle) * 20, angle);
  return bullet ? EVENT_SHOT : null;
}
