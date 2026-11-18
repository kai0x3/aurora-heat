// The wanted level and the Port Aurora police who answer it. Crimes raise the
// stars; staying quiet and out of sight lets them fall, and lying low inside the
// Sol Plaza safehouse ring cools them far faster. Cruisers spawn on the roads
// near the player, chase, and ram — and at four stars and up they stop chasing
// fair: pairs of cruisers park across the road ahead as a roadblock the player
// has to ram through, shoot apart or dodge.

import {
  CAR_LENGTH, CAR_WIDTH, POLICE_CAR_HP, POLICE_SPEED, ROADBLOCK_COOLDOWN,
  ROADBLOCK_COOLDOWN_HOT, SAFEHOUSE, SAFEHOUSE_COOL_RATE, WANTED_DECAY_SECONDS,
  WANTED_MAX, WANTED_QUIET_SECONDS, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { hitsBuilding, nearestRoadPoint, randomRoadPoint } from './city.js';

export const POLICE_COLORS = ['#1c2f5e', '#22366e'];

/** How many street cruisers are on the road for each wanted level. */
export function policeCountForWanted(stars) {
  return [0, 1, 2, 3, 4, 5][Math.max(0, Math.min(WANTED_MAX, stars))];
}

/** Cruiser pace: every star makes the force a little quicker to close in. */
export function policePaceForWanted(stars) {
  return POLICE_SPEED * (1 + 0.05 * Math.max(0, Math.min(WANTED_MAX, stars)));
}

/** True while the player stands inside the Sol Plaza safehouse ring. */
export function playerAtSafehouse(world) {
  return Math.hypot(world.player.x - SAFEHOUSE.x, world.player.y - SAFEHOUSE.y) <= SAFEHOUSE.radius;
}

/** Raise the wanted level by `n`, capped at the maximum, and reset the quiet timer. */
export function addWanted(world, n) {
  world.wanted = Math.min(WANTED_MAX, world.wanted + n);
  world.timeSinceCrime = 0;
  world.wantedTimer = 0;
}

/**
 * Let the wanted level decay once the player has been quiet and unseen for a
 * while. The decay is timer-based — one star per WANTED_DECAY_SECONDS of
 * accumulated quiet time — and the safehouse ring accumulates that time
 * SAFEHOUSE_COOL_RATE times faster. A cruiser within 420 px pauses it all.
 */
export function updateWanted(world, dt) {
  world.timeSinceCrime += dt;
  const policeNear = world.police.some((car) => Math.hypot(car.x - world.player.x, car.y - world.player.y) < 420);
  if (world.wanted > 0 && world.timeSinceCrime > WANTED_QUIET_SECONDS && !policeNear) {
    const rate = playerAtSafehouse(world) ? SAFEHOUSE_COOL_RATE : 1;
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
    length: CAR_LENGTH, width: CAR_WIDTH,
    driver: 'ai', sirenPhase: rng.range(0, 1), stuckTimer: 0,
  };
}

/** Keep the number of street cruisers matched to the wanted level. Roadblock cars are extra and stay put. */
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

/** Park two cruisers across the road about 540 px ahead of the player's heading. */
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
  // A block that would sit inside a building is no block at all: try again soon.
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

/**
 * Roadblocks live while the heat is at four stars or more and the player is
 * driving. Outrun one — or lose the heat — and it is cleared; after a cooldown
 * (shorter at five stars) the next one forms ahead again.
 */
export function updateRoadblocks(world, dt) {
  const block = world.roadblock;
  // Drop cars the bullets or a ram already took off the street. Losing the last
  // car of a block starts the same re-form cooldown as outrunning one.
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

/**
 * Chase the player: steer toward them, faster than traffic, and ram. The cruiser
 * slides along buildings instead of driving through them, and backs out and turns
 * away when it wedges itself against a wall. A roadblock car does none of this:
 * it holds its ground across the road, and only moves when something shoves it.
 */
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
