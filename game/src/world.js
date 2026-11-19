// The world: everything that exists in Port Aurora and one fixed step that
// moves it all. v4 threads the new systems through this step — Respect and
// levels, the weapon locker, side activities, shops, nitro, body and car
// armour, near-miss bonuses, screen shake and hit markers — while keeping
// the v3 rule that matters: traffic steers only AI-driven cars, and every
// gameplay random comes from the seeded RNG.

import {
  CAR_MAX_HP, CASH_PICKUP_VALUE, DAMAGE_HANDLING_HP, DAMAGE_SMOKE_HP,
  NEAR_MISS_BONUS, NEAR_MISS_RESPECT, NITRO_BOOST, NITRO_SECONDS,
  PLAYER_ARMOUR_MAX, PLAYER_HEALTH_MAX, PLAYER_RADIUS, PLAYER_WALK_SPEED,
  REPAIR_TICK_COST, REPAIR_TICK_HP, REPAIR_TICK_SECONDS, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { generateCity, hitsBuilding, isInWater, resolveBuildingCollision } from './city.js';
import { createRng } from './random.js';
import {
  nearestCarTo, spawnParkedCars, spawnPedestrians, spawnTraffic, updatePedestrian,
  updateRivalCar, updateTrafficCar,
} from './traffic.js';
import {
  addWanted, playerAtAnySafehouse, updateHelicopter, updatePoliceCar,
  updatePoliceSpawns, updateRoadblocks, updateWanted,
} from './police.js';
import { destroyPoliceCar, fireBullet, updateBullets } from './combat.js';
import { damageCargoOnCrash, startMission, updateMission } from './missions.js';
import { rampageScore, updateActivity } from './activities.js';
import { awardRespect } from './progression.js';

export const EVENT_MISSION = 1;
export const EVENT_PICKUP = 2;
export const EVENT_PACKAGE = 4;
export const EVENT_OVER = 8;
export const EVENT_SHOT = 16;
export const EVENT_FAIL = 32;
export const EVENT_CHECKPOINT = 64;
export const EVENT_CRASH = 128;
export const EVENT_HONK = 256;
export const EVENT_ACTIVITY = 512;
export const EVENT_PURCHASE = 1024;
export const EVENT_LEVELUP = 2048;
export const EVENT_NITRO = 4096;

const PLAYER_SPAWN = { x: 600, y: 600 };
const SKID_MAX = 520;
const SKID_LIFE = 3.5;

export function createWorld(seed) {
  const rng = createRng(seed);
  const city = generateCity(rng);
  const player = {
    x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: 0,
    health: PLAYER_HEALTH_MAX, armour: 0, money: 0, earned: 0,
    respect: 0, weapons: ['fists', 'pistol'], weapon: 'pistol',
    onFoot: true, car: null, speed: 0,
  };
  const world = {
    rng, city, player,
    cars: [], police: [], peds: [], bullets: [], particles: [], pickups: [], skids: [],
    wanted: 0, wantedTimer: 0, timeSinceCrime: 99,
    missionIndex: 0, mission: null, missionsDone: 0,
    activity: null, activityToast: null, levelUp: null, bestRace: null,
    roadblock: { cars: [], cooldown: 0 },
    heli: { x: 0, y: 0, spotX: 0, spotY: 0, active: false, orbit: 0, rotor: 0 },
    rival: null,
    jobToast: null, jobFailed: null, playerSliding: false, smokeTimer: 0,
    lastCrash: { x: 0, y: 0, time: -99 }, damageFlashAt: -99, repairTimer: 0,
    hitmarkAt: -99, muzzleAt: -99, shake: 0, nearMissAt: -99,
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
  player.armour = 0;
  player.money = 0;
  player.earned = 0;
  player.respect = 0;
  player.weapons = ['fists', 'pistol'];
  player.weapon = 'pistol';
  player.onFoot = true;
  player.car = null;
  player.speed = 0;
  world.cars = [...spawnTraffic(rng, city), ...spawnParkedCars(rng, city)];
  world.police = [];
  world.peds = spawnPedestrians(rng, city);
  world.bullets = [];
  world.particles = [];
  world.skids = [];
  world.pickups = makePickups(rng, city);
  world.wanted = 0;
  world.wantedTimer = 0;
  world.timeSinceCrime = 99;
  world.missionIndex = 0;
  world.missionsDone = 0;
  world.activity = null;
  world.activityToast = null;
  world.levelUp = null;
  world.bestRace = null;
  world.roadblock = { cars: [], cooldown: 0 };
  world.heli = { x: 0, y: 0, spotX: 0, spotY: 0, active: false, orbit: 0, rotor: 0 };
  world.rival = null;
  world.jobToast = null;
  world.jobFailed = null;
  world.playerSliding = false;
  world.smokeTimer = 0;
  world.lastCrash = { x: 0, y: 0, time: -99 };
  world.damageFlashAt = -99;
  world.repairTimer = 0;
  world.hitmarkAt = -99;
  world.muzzleAt = -99;
  world.shake = 0;
  world.nearMissAt = -99;
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

function makePickups(rng, city) {
  const pickups = [];
  for (let i = 0; i < 10; i += 1) {
    let x = rng.range(150, WORLD_WIDTH - 150);
    let y = rng.range(150, WORLD_HEIGHT - 300);
    let tries = 0;
    while (hitsBuilding(city, x, y, 16) && tries < 10) {
      x = rng.range(150, WORLD_WIDTH - 150);
      y = rng.range(150, WORLD_HEIGHT - 300);
      tries += 1;
    }
    const kind = i >= 8 ? 'armour' : 'cash';
    pickups.push({
      x, y, kind,
      value: kind === 'cash' ? CASH_PICKUP_VALUE : 40,
      taken: false, bob: rng.range(0, 6),
    });
  }
  return pickups;
}

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

function carDamage(world, car, amount) {
  const armourCut = car.armoured ? 0.5 : 1;
  const durability = (car.stats && car.stats.durability) || 1;
  car.hp = Math.max(0, car.hp - (amount * armourCut) / durability);
}

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
  const wear = car.hp < DAMAGE_HANDLING_HP
    ? 0.62 + 0.38 * (Math.max(0, car.hp) / DAMAGE_HANDLING_HP)
    : 1;
  // Nitro: fitted cars burn a charge for a burst of top speed + acceleration.
  let nitroBoost = 1;
  if (car.nitro && input && typeof input.nitro === 'function' && input.nitro() && Math.abs(car.speed) > 60) {
    if (car.nitroLeft <= 0) {
      car.nitroLeft = NITRO_SECONDS;
      events |= EVENT_NITRO;
    }
  }
  if (car.nitroLeft > 0) {
    car.nitroLeft -= dt;
    nitroBoost = NITRO_BOOST;
    world.particles.push({
      x: car.x - Math.cos(car.angle) * (car.length / 2),
      y: car.y - Math.sin(car.angle) * (car.length / 2),
      vx: -Math.cos(car.angle) * 120 + world.rng.range(-24, 24),
      vy: -Math.sin(car.angle) * 120 + world.rng.range(-24, 24),
      life: 0.22, maxLife: 0.22, color: '#37c8e0', size: 4,
    });
  }
  const forward = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -1 : 0;
  const steerInput = input.moveX();
  if (forward > 0) car.speed = Math.min(stats.topSpeed * wear * nitroBoost, car.speed + stats.accel * wear * nitroBoost * dt);
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
    if (Math.abs(car.speed) > 200) {
      events |= EVENT_CRASH;
      carDamage(world, car, (Math.abs(car.speed) - 180) / 20);
      world.damageFlashAt = world.time;
      world.lastCrash = { x: car.x, y: car.y, time: world.time };
      world.shake = Math.min(12, world.shake + 5);
      rampageScore(world, 60);
    }
    car.speed *= -0.25;
    spawnCrashSparks(world, car.x, car.y);
  }
  car.x = Math.max(30, Math.min(WORLD_WIDTH - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_HEIGHT - 140, car.y));
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;

  const sliding = Math.abs(car.speed) > 240 && steerInput !== 0;
  world.playerSliding = sliding;
  if (sliding) {
    laySkidMarks(world, car);
    rampageScore(world, 1);
  }

  for (const blockCar of [...world.roadblock.cars]) {
    const dist = Math.hypot(blockCar.x - car.x, blockCar.y - car.y);
    if (dist < 48 && Math.abs(car.speed) > 40) {
      const push = Math.atan2(blockCar.y - car.y, blockCar.x - car.x);
      const power = Math.abs(car.speed);
      blockCar.vx = Math.cos(push) * power * 0.85;
      blockCar.vy = Math.sin(push) * power * 0.85;
      blockCar.spin = world.rng.range(-3, 3);
      blockCar.hp -= power * 0.1;
      carDamage(world, car, power * 0.045);
      car.speed *= 0.5;
      world.damageFlashAt = world.time;
      world.lastCrash = { x: car.x, y: car.y, time: world.time };
      world.shake = Math.min(14, world.shake + 6);
      spawnCrashSparks(world, (car.x + blockCar.x) / 2, (car.y + blockCar.y) / 2);
      events |= EVENT_CRASH;
      if (blockCar.hp <= 0) destroyPoliceCar(world, blockCar);
    }
  }

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

  // Near-miss bonus: threading past traffic at speed, cleanly, pays.
  if (Math.abs(car.speed) > 330 && world.time - world.nearMissAt > 1.2) {
    for (const other of world.cars) {
      if (other === car || other.kind === 'police') continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d > 52 && d < 78) {
        world.nearMissAt = world.time;
        player.money += NEAR_MISS_BONUS;
        player.earned += NEAR_MISS_BONUS;
        const up = awardRespect(world, NEAR_MISS_RESPECT);
        if (up) {
          world.levelUp = { ...up, until: world.time + 5 };
          events |= EVENT_LEVELUP;
        }
        rampageScore(world, 45);
        world.particles.push({
          x: car.x, y: car.y - 26, vx: 0, vy: -46,
          life: 0.7, maxLife: 0.7, color: '#ffd23f', size: 5,
        });
        break;
      }
    }
  }

  if (car.hp < CAR_MAX_HP && player.money >= REPAIR_TICK_COST && playerAtAnySafehouse(world)) {
    world.repairTimer += dt;
    while (world.repairTimer >= REPAIR_TICK_SECONDS && car.hp < CAR_MAX_HP && player.money >= REPAIR_TICK_COST) {
      world.repairTimer -= REPAIR_TICK_SECONDS;
      car.hp = Math.min(CAR_MAX_HP, car.hp + REPAIR_TICK_HP);
      player.money -= REPAIR_TICK_COST;
    }
  } else {
    world.repairTimer = 0;
  }
  return events;
}

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

function updateEngineSmoke(world, dt) {
  const player = world.player;
  if (player.onFoot || !player.car || player.car.hp >= DAMAGE_SMOKE_HP) return;
  world.smokeTimer -= dt;
  if (world.smokeTimer > 0) return;
  const car = player.car;
  world.smokeTimer = car.hp < DAMAGE_HANDLING_HP ? 0.05 : 0.12;
  world.particles.push({
    x: car.x + Math.cos(car.angle) * (car.length / 2),
    y: car.y + Math.sin(car.angle) * (car.length / 2),
    vx: world.rng.range(-16, 16), vy: world.rng.range(-44, -18),
    life: 0.9, maxLife: 0.9,
    color: car.hp < DAMAGE_HANDLING_HP ? '#3d3d3d' : '#6f6f6f',
    size: 5 + (DAMAGE_SMOKE_HP - car.hp) * 0.07,
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
      if (pickup.kind === 'armour') {
        player.armour = Math.min(PLAYER_ARMOUR_MAX, player.armour + pickup.value);
      } else {
        player.money += pickup.value;
        player.earned += pickup.value;
      }
      return EVENT_PICKUP;
    }
  }
  return 0;
}

function updatePoliceDamage(world, dt) {
  const player = world.player;
  if (player.health <= 0) return;
  const healthBefore = player.health;
  let incoming = 0;
  for (const car of world.police) {
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (player.onFoot && dist < 46) {
      incoming += 26 * dt;
    } else if (!player.onFoot && player.car && dist < 58) {
      incoming += 6 * dt;
      player.car.hp = Math.max(0, player.car.hp - 5 * dt);
      player.car.speed *= Math.max(0, 1 - 0.8 * dt);
    }
  }
  if (incoming > 0) {
    // Body armour soaks damage first.
    const soaked = Math.min(player.armour, incoming);
    player.armour -= soaked;
    player.health -= (incoming - soaked);
  }
  if (player.health < healthBefore) world.damageFlashAt = world.time;
  if (player.health <= 0) {
    player.health = 0;
    world.over = true;
    world.overReason = 'busted';
  }
}

export function stepWorld(world, dt, input, harmless) {
  let events = 0;
  world.time += dt;
  if (world.fireCooldown > 0) world.fireCooldown -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);

  for (const car of world.cars) {
    if (car.kind === 'police') updatePoliceCar(car, world, dt);
    else if (car.driver === 'ai') updateTrafficCar(car, dt, world.rng, world.player);
    if (car.honkReady) {
      car.honkReady = false;
      events |= EVENT_HONK;
    }
  }
  const rival = world.rival;
  if (rival && rival.started && !rival.finished && world.mission && world.mission.stage === 'race') {
    const gate = world.mission.def.checkpoints[rival.gate];
    if (gate) updateRivalCar(rival.car, gate.x, gate.y, dt, world.city);
  }
  const player = world.player;
  const reckless = !player.onFoot && Math.abs(player.speed) > 240;
  const danger = world.bullets.length > 0
    ? { x: world.bullets[0].x, y: world.bullets[0].y }
    : (world.wanted > 0 || reckless ? { x: player.x, y: player.y } : null);
  const spectacle = world.time - world.lastCrash.time < 4
    ? world.lastCrash
    : (world.wanted >= 2 ? { x: player.x, y: player.y } : null);
  for (const ped of world.peds) updatePedestrian(ped, dt, world.rng, danger, spectacle);
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
    if (events & EVENT_CRASH) {
      if (damageCargoOnCrash(world) === 'mission-failed') events |= EVENT_FAIL;
    }
    updateWanted(world, dt);
    updatePoliceSpawns(world, dt);
    updateRoadblocks(world, dt);
    updateHelicopter(world, dt);
    updatePoliceDamage(world, dt);
    updateEngineSmoke(world, dt);
    events |= updatePickups(world);
    const missionEvent = updateMission(world, dt);
    if (missionEvent === 'mission-complete') events |= EVENT_MISSION;
    else if (missionEvent === 'package-picked') events |= EVENT_PACKAGE;
    else if (missionEvent === 'mission-failed') events |= EVENT_FAIL;
    else if (missionEvent === 'checkpoint') events |= EVENT_CHECKPOINT;
    const actEvent = updateActivity(world, dt);
    if (actEvent === 'activity-complete' || actEvent === 'activity-complete-levelup') {
      events |= EVENT_ACTIVITY;
      if (actEvent === 'activity-complete-levelup' || world.levelUp) events |= EVENT_LEVELUP;
    } else if (actEvent === 'activity-failed') {
      events |= EVENT_FAIL;
    } else if (actEvent === 'activity-pickup' || actEvent === 'activity-gate') {
      events |= EVENT_CHECKPOINT;
    }
    if (world.levelUp && world.time < world.levelUp.until) events |= EVENT_LEVELUP;
    if (world.over) events |= EVENT_OVER;
  }
  updateCamera(world, dt);
  return events;
}

export function shootAt(world, mouseWorldX, mouseWorldY) {
  if (!world.player.onFoot || world.over) return null;
  const angle = Math.atan2(mouseWorldY - world.player.y, mouseWorldX - world.player.x);
  world.player.angle = angle;
  const fired = fireBullet(world, world.player.x + Math.cos(angle) * 20, world.player.y + Math.sin(angle) * 20, angle);
  return fired ? EVENT_SHOT : null;
}
