// The wanted level and the Port Aurora police who answer it. Crimes raise
// the stars; staying quiet and out of sight lets them fall, and lying low
// inside a safehouse ring cools them far faster. v4 adds the second,
// Boardwalk safehouse (unlocked at Respect level 5). Cruisers spawn on the
// roads near the player, chase, and ram — at four stars and up pairs of
// cruisers park across the road ahead as a roadblock. At five stars the
// helicopter orbits the player with its spotlight pinned to them.

import {
  CAR_LENGTH, CAR_WIDTH, HELI_ORBIT_RADIUS, HELI_SPOT_RADIUS, HELI_WANTED,
  POLICE_CAR_HP, POLICE_SPEED, ROADBLOCK_COOLDOWN, ROADBLOCK_COOLDOWN_HOT,
  SAFEHOUSE, SAFEHOUSE2, SAFEHOUSE_COOL_RATE, WANTED_DECAY_SECONDS, WANTED_MAX,
  WANTED_QUIET_SECONDS, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { hitsBuilding, nearestRoadPoint, randomRoadPoint } from './city.js';
import { levelForRespect } from './progression.js';

export const POLICE_COLORS = ['#1c2f5e', '#22366e'];

export function policeCountForWanted(stars) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(WANTED_MAX, stars))];
}

export function policePaceForWanted(stars) {
  return POLICE_SPEED * (1 + 0.05 * Math.max(0, Math.min(WANTED_MAX, stars)));
}

export function playerAtSafehouse(world) {
  return Math.hypot(world.player.x - SAFEHOUSE.x, world.player.y - SAFEHOUSE.y) <= SAFEHOUSE.radius;
}

/** The Boardwalk safehouse counts only once Respect level 5 unlocks it. */
export function playerAtSafehouse2(world) {
  if (levelForRespect(world.player.respect) < 5) return false;
  return Math.hypot(world.player.x - SAFEHOUSE2.x, world.player.y - SAFEHOUSE2.y) <= SAFEHOUSE2.radius;
}

export function playerAtAnySafehouse(world) {
  return playerAtSafehouse(world) || playerAtSafehouse2(world);
}

export function addWanted(world, n) {
  world.wanted = Math.min(WANTED_MAX, world.wanted + n);
  world.timeSinceCrime = 0;
  world.wantedTimer = 0;
}

export function playerInSpotlight(world) {
  const heli = world.heli;
  if (!heli || !heli.active) return false;
  return Math.hypot(world.player.x - heli.spotX, world.player.y - heli.spotY) <= HELI_SPOT_RADIUS;
}

export function updateWanted(world, dt) {
  world.timeSinceCrime += dt;
  const policeNear = world.police.some((car) => Math.hypot(car.x - world.player.x, car.y - world.player.y) < 420);
  const seen = policeNear || playerInSpotlight(world);
  if (world.wanted > 0 && world.timeSinceCrime > WANTED_QUIET_SECONDS && !seen) {
    const rate = playerAtAnySafehouse(world) ? SAFEHOUSE_COOL_RATE : 1;
    world.wantedTimer += dt * rate;
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
    length: CAR_LENGTH, width: CAR_WIDTH,
    driver: 'ai', sirenPhase: rng.range(0, 1), stuckTimer: 0,
  };
}

export function updatePoliceSpawns(world, dt) {
  const wanted = policeCountForWanted(world.wanted);
  const street = world.police.filter((car) => !car.roadblock);
  while (street.length < wanted) {
    const car = makePoliceCar(world.rng, world.player);
    world.police.push(car);
    world.cars.push(car);
    street.push(car);
  }
  while (street.length > wanted) {
    const car = street.pop();
    const policeIndex = world.police.indexOf(car);
    if (policeIndex !== -1) world.police.splice(policeIndex, 1);
    const carIndex = world.cars.indexOf(car);
    if (carIndex !== -1) world.cars.splice(carIndex, 1);
  }
}

function makeRoadblockCar(rng, x, y, angle) {
  return {
    kind: 'police', roadblock: true, x, y, angle,
    speed: 0, vx: 0, vy: 0, spin: 0,
    color: rng.pick(POLICE_COLORS), hp: POLICE_CAR_HP,
    length: CAR_LENGTH, width: CAR_WIDTH,
    driver: 'ai', sirenPhase: rng.range(0, 1), stuckTimer: 0,
  };
}

function formRoadblock(world) {
  const player = world.player;
  const heading = !player.onFoot && player.car ? player.car.angle : player.angle;
  const ax = player.x + Math.cos(heading) * 540;
  const ay = player.y + Math.sin(heading) * 540;
  const near = nearestRoadPoint(ax, ay);
  const onVerticalRoad = Math.abs(ax - near.x) <= Math.abs(ay - near.y);
  let cars;
  if (onVerticalRoad) {
    const y = Math.max(90, Math.min(WORLD_HEIGHT - 210, ay));
    cars = [
      makeRoadblockCar(world.rng, near.x, y - 22, 0),
      makeRoadblockCar(world.rng, near.x, y + 22, 0),
    ];
  } else {
    const x = Math.max(90, Math.min(WORLD_WIDTH - 90, ax));
    cars = [
      makeRoadblockCar(world.rng, x - 22, near.y, Math.PI / 2),
      makeRoadblockCar(world.rng, x + 22, near.y, Math.PI / 2),
    ];
  }
  if (cars.some((car) => hitsBuilding(world.city, car.x, car.y, 30))) {
    world.roadblock.cooldown = 2;
    return;
  }
  for (const car of cars) {
    world.roadblock.cars.push(car);
    world.police.push(car);
    world.cars.push(car);
  }
}

function clearRoadblock(world) {
  for (const car of world.roadblock.cars) {
    const policeIndex = world.police.indexOf(car);
    if (policeIndex !== -1) world.police.splice(policeIndex, 1);
    const carIndex = world.cars.indexOf(car);
    if (carIndex !== -1) world.cars.splice(carIndex, 1);
  }
  world.roadblock.cars = [];
  world.roadblock.cooldown = world.wanted >= WANTED_MAX ? ROADBLOCK_COOLDOWN_HOT : ROADBLOCK_COOLDOWN;
}

export function updateRoadblocks(world, dt) {
  const block = world.roadblock;
  const hadCars = block.cars.length;
  block.cars = block.cars.filter((car) => world.cars.includes(car));
  if (hadCars > 0 && block.cars.length === 0) {
    block.cooldown = world.wanted >= WANTED_MAX ? ROADBLOCK_COOLDOWN_HOT : ROADBLOCK_COOLDOWN;
  }
  if (block.cooldown > 0) block.cooldown -= dt;
  if (block.cars.length > 0) {
    const anchor = block.cars[0];
    const dist = Math.hypot(anchor.x - world.player.x, anchor.y - world.player.y);
    if (world.wanted < 4 || dist > 950) clearRoadblock(world);
    return;
  }
  if (world.wanted >= 4 && block.cooldown <= 0 && !world.player.onFoot) {
    formRoadblock(world);
  }
}

export function updatePoliceCar(car, world, dt) {
  car.sirenPhase += dt;
  if (car.roadblock) {
    if (car.vx || car.vy) {
      const r = CAR_LENGTH / 2;
      const nx = car.x + car.vx * dt;
      const ny = car.y + car.vy * dt;
      if (!hitsBuilding(world.city, nx, car.y, r)) car.x = nx;
      if (!hitsBuilding(world.city, car.x, ny, r)) car.y = ny;
      const damp = Math.max(0, 1 - 3.2 * dt);
      car.vx *= damp;
      car.vy *= damp;
      car.angle += car.spin * dt;
      car.spin *= Math.max(0, 1 - 2.5 * dt);
      if (Math.hypot(car.vx, car.vy) < 4) {
        car.vx = 0;
        car.vy = 0;
      }
    }
    car.speed = 0;
    return;
  }
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
  const pace = policePaceForWanted(world.wanted);
  const speed = dist > 700 ? pace : pace * 0.85;
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

export function sirenColor(car) {
  return Math.floor(car.sirenPhase * 4) % 2 === 0 ? '#ff2b2b' : '#2b5cff';
}

export function updateHelicopter(world, dt) {
  const heli = world.heli;
  const player = world.player;
  heli.rotor += dt * 42;
  if (world.wanted >= HELI_WANTED) {
    if (!heli.active) {
      heli.active = true;
      heli.x = player.x + 700;
      heli.y = player.y - 700;
      heli.spotX = heli.x;
      heli.spotY = heli.y;
    }
    heli.orbit += dt * 0.55;
    const anchorX = player.x + Math.cos(heli.orbit) * HELI_ORBIT_RADIUS;
    const anchorY = player.y + Math.sin(heli.orbit) * HELI_ORBIT_RADIUS;
    const chase = Math.min(1, dt * 1.9);
    heli.x += (anchorX - heli.x) * chase;
    heli.y += (anchorY - heli.y) * chase;
    const spotChase = Math.min(1, dt * 5.5);
    heli.spotX += (player.x - heli.spotX) * spotChase;
    heli.spotY += (player.y - heli.spotY) * spotChase;
  } else if (heli.active) {
    heli.x += 620 * dt;
    heli.y -= 620 * dt;
    heli.spotX = heli.x;
    heli.spotY = heli.y;
    if (Math.hypot(heli.x - player.x, heli.y - player.y) > 1100) heli.active = false;
  }
}
