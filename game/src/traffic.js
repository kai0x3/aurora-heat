// Traffic and pedestrians: the vehicles that cruise Port Aurora's roads and
// the people walking its sidewalks. v4 widens the traffic pool — sedans,
// taxis, sports cars, heavy trucks and motorbikes — and gives pedestrians
// more life: joggers on the Boardwalk, people waiting at crosswalks who
// cross when the road is clear, and the watchers who film trouble.

import {
  CAR_MAX_HP, RACE_RIVAL_SPEED, ROAD_WIDTH, TRAFFIC_SPEED, VEHICLE_TYPES,
  WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { hitsBuilding, isOnRoad, nearestRoadPoint, randomRoadPoint } from './city.js';

export const TRAFFIC_COLORS = ['#d94f3d', '#3d7ad9', '#e8e3d8', '#3d3a38', '#7ab648', '#c9a13d', '#8a5fd9', '#d97ab0'];
export const PED_COLORS = ['#e8e3d8', '#7ab648', '#d97ab0', '#3d7ad9', '#e8b23d', '#9a6b4f', '#37c8e0', '#ff8c42'];

const TYPE_COLORS = {
  sedan: TRAFFIC_COLORS,
  taxi: ['#e8b23d'],
  sports: ['#ff5340', '#ffd23f', '#37c8e0', '#e8e3d8'],
  truck: ['#8a8f98', '#5f7a8a', '#a34a3d', '#e8e3d8'],
  bike: ['#ff5340', '#17181c', '#37c8e0', '#7ab648'],
};

const TYPE_MIX = [
  { type: 'sedan', share: 0.44 },
  { type: 'taxi', share: 0.15 },
  { type: 'sports', share: 0.13 },
  { type: 'truck', share: 0.16 },
  { type: 'bike', share: 0.12 },
];

const PARKED_TYPES = ['sedan', 'taxi', 'sports', 'bike', 'truck', 'sports', 'bike'];

const TRAFFIC_COUNT = 16;
const PED_COUNT = 30;
const PARKED_COUNT = 7;

export const RIVAL_COLOR = '#e0347c';

function pickTrafficType(rng) {
  let roll = rng.next();
  for (const entry of TYPE_MIX) {
    if (roll < entry.share) return entry.type;
    roll -= entry.share;
  }
  return 'sedan';
}

function buildCar(rng, type, x, y, angle, driver) {
  const stats = VEHICLE_TYPES[type];
  return {
    kind: 'traffic', x, y, angle,
    speed: driver === 'ai' ? TRAFFIC_SPEED * rng.range(0.8, 1.15) * (type === 'bike' ? 1.25 : 1) : 0,
    type, stats, length: stats.length, width: stats.width,
    color: rng.pick(TYPE_COLORS[type]),
    hp: CAR_MAX_HP, driver, turnCooldown: rng.range(0, 2),
    honkTimer: 0, honkReady: false, nitro: false, nitroLeft: 0, armoured: false, criminal: false,
  };
}

function makeTrafficCar(rng, city) {
  const point = randomRoadPoint(rng);
  const angle = point.axis === 'v'
    ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
    : (rng.chance(0.5) ? 0 : Math.PI);
  const lane = ROAD_WIDTH / 4;
  const x = point.axis === 'v' ? point.x + (angle === Math.PI / 2 ? lane : -lane) : point.x;
  const y = point.axis === 'v' ? point.y : point.y + (angle === 0 ? lane : -lane);
  return buildCar(rng, pickTrafficType(rng), x, y, angle, 'ai');
}

export function spawnParkedCars(rng, city) {
  const spots = [];
  for (const area of [...city.plazas, ...city.parks]) {
    for (let i = 0; i < 3; i += 1) {
      spots.push({ x: area.x + 44 + i * 68, y: area.y + area.height - 36, angle: 0 });
    }
  }
  for (let i = 0; i < 3; i += 1) {
    spots.push({ x: 2600 + i * 74, y: 126, angle: 0 });
  }
  // A bike rack by the Boardwalk stalls.
  spots.push({ x: 2320, y: 2148, angle: 0 });
  const cars = [];
  for (const spot of spots) {
    if (cars.length >= PARKED_COUNT) break;
    if (hitsBuilding(city, spot.x, spot.y, 32)) continue;
    cars.push(buildCar(rng, PARKED_TYPES[cars.length], spot.x, spot.y, spot.angle, 'none'));
  }
  return cars;
}

function makePedestrian(rng, city) {
  let x = rng.range(120, WORLD_WIDTH - 120);
  let y = rng.range(120, WORLD_HEIGHT - 260);
  let tries = 0;
  while (hitsBuilding(city, x, y, 12) && tries < 12) {
    x = rng.range(120, WORLD_WIDTH - 120);
    y = rng.range(120, WORLD_HEIGHT - 260);
    tries += 1;
  }
  const role = y > 1950 ? rng.pick(['walker', 'jogger', 'jogger', 'walker'])
    : rng.pick(['walker', 'walker', 'walker', 'jogger', 'waiter']);
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: role === 'jogger' ? rng.range(105, 135) : rng.range(38, 70),
    color: rng.pick(PED_COLORS),
    state: 'walk', role, wanderTimer: rng.range(1, 4), panicTimer: 0,
    watcher: rng.chance(0.45), watchTimer: 0, watchX: 0, watchY: 0, waitTimer: 0,
  };
}

export function spawnTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(makeTrafficCar(rng, city));
  return cars;
}

export function spawnPedestrians(rng, city) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) peds.push(makePedestrian(rng, city));
  return peds;
}

export function updateTrafficCar(car, dt, rng, player) {
  if (car.driver !== 'ai') return;
  car.turnCooldown -= dt;
  if (car.honkTimer > 0) car.honkTimer -= dt;
  const aheadX = car.x + Math.cos(car.angle) * 40;
  const aheadY = car.y + Math.sin(car.angle) * 40;
  const atIntersection = isOnRoad(car.x, car.y) && isOnRoad(aheadX, aheadY)
    && Math.abs(car.x - nearestRoadPoint(car.x, car.y).x) < 6
    && Math.abs(car.y - nearestRoadPoint(car.x, car.y).y) < 6;
  if (atIntersection && car.turnCooldown <= 0 && rng.chance(0.45)) {
    const turn = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    car.angle += turn;
    car.turnCooldown = rng.range(2, 5);
  }
  let targetSpeed = car.speed;
  if (player) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (dist < 120 && ahead > 0) targetSpeed = Math.min(targetSpeed, 40);
    if (dist < 72 && ahead > 0) {
      targetSpeed = 0;
      if (car.speed > 50 && car.honkTimer <= 0) {
        car.honkReady = true;
        car.honkTimer = 4;
      }
    }
  }
  const speed = Math.max(0, targetSpeed);
  car.x += Math.cos(car.angle) * speed * dt;
  car.y += Math.sin(car.angle) * speed * dt;
  if (car.x < 40 || car.x > WORLD_WIDTH - 40 || car.y < 40 || car.y > WORLD_HEIGHT - 160) {
    car.angle += Math.PI;
    car.x = Math.max(40, Math.min(WORLD_WIDTH - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD_HEIGHT - 160, car.y));
  }
}

export function updatePedestrian(ped, dt, rng, danger, spectacle) {
  ped.wanderTimer -= dt;
  if (danger && Math.hypot(ped.x - danger.x, ped.y - danger.y) < 260) {
    ped.state = 'panic';
    ped.panicTimer = 1.2;
    ped.watchTimer = 0;
  }
  if (ped.panicTimer > 0) {
    ped.panicTimer -= dt;
    ped.state = 'panic';
    if (danger) ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.x += Math.cos(ped.angle) * 150 * dt;
    ped.y += Math.sin(ped.angle) * 150 * dt;
  } else if (ped.watchTimer > 0) {
    ped.watchTimer -= dt;
    ped.state = 'watch';
    ped.angle = Math.atan2(ped.watchY - ped.y, ped.watchX - ped.x);
    if (ped.watchTimer <= 0) ped.state = 'walk';
  } else if (ped.waitTimer > 0) {
    // Waiting at a crosswalk: stand still until the road ahead is clear.
    ped.waitTimer -= dt;
    ped.state = 'wait';
  } else {
    ped.state = 'walk';
    if (spectacle && ped.watcher
      && Math.hypot(ped.x - spectacle.x, ped.y - spectacle.y) < 380
      && rng.chance(0.03)) {
      ped.state = 'watch';
      ped.watchTimer = rng.range(1.5, 3.2);
      ped.watchX = spectacle.x;
      ped.watchY = spectacle.y;
      ped.angle = Math.atan2(spectacle.y - ped.y, spectacle.x - ped.x);
    }
    if (ped.state === 'walk') {
      if (ped.wanderTimer <= 0) {
        ped.angle = rng.range(0, Math.PI * 2);
        ped.wanderTimer = rng.range(1.5, 4);
        // Walkers heading onto a road sometimes pause at the kerb first.
        const aheadX = ped.x + Math.cos(ped.angle) * 30;
        const aheadY = ped.y + Math.sin(ped.angle) * 30;
        if (ped.role === 'waiter' && isOnRoad(aheadX, aheadY) && !isOnRoad(ped.x, ped.y)) {
          ped.waitTimer = rng.range(0.6, 1.6);
        }
      }
      const pace = ped.role === 'jogger' ? ped.speed : ped.speed;
      ped.x += Math.cos(ped.angle) * pace * dt;
      ped.y += Math.sin(ped.angle) * pace * dt;
    }
  }
  ped.x = Math.max(30, Math.min(WORLD_WIDTH - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD_HEIGHT - 200, ped.y));
}

export function makeRivalCar(rng, x, y, angle) {
  const car = buildCar(rng, 'sports', x, y, angle, 'rival');
  car.color = RIVAL_COLOR;
  car.rival = true;
  car.speed = 0;
  car.stuckTimer = 0;
  return car;
}

export function updateRivalCar(car, tx, ty, dt, city) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  car.angle += steer * 2.5 * dt;
  const pace = RACE_RIVAL_SPEED * (1 - Math.min(0.55, Math.abs(diff) * 0.45));
  car.speed = pace;
  const r = car.length / 2;
  const prevX = car.x;
  const prevY = car.y;
  const nx = car.x + Math.cos(car.angle) * pace * dt;
  const ny = car.y + Math.sin(car.angle) * pace * dt;
  if (!hitsBuilding(city, nx, car.y, r)) car.x = nx;
  if (!hitsBuilding(city, car.x, ny, r)) car.y = ny;
  car.x = Math.max(30, Math.min(WORLD_WIDTH - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD_HEIGHT - 150, car.y));
  const moved = Math.hypot(car.x - prevX, car.y - prevY);
  if (pace > 100 && moved < pace * dt * 0.25) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  if (car.stuckTimer > 1.0) {
    car.angle += 2.5 * dt;
    const bx = car.x - Math.cos(car.angle) * 150 * dt;
    const by = car.y - Math.sin(car.angle) * 150 * dt;
    if (!hitsBuilding(city, bx, car.y, r)) car.x = bx;
    if (!hitsBuilding(city, car.x, by, r)) car.y = by;
    if (car.stuckTimer > 1.8) car.stuckTimer = 0;
  }
  return dist;
}

export function nearestCarTo(cars, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    if (car.driver === 'player' || car.driver === 'rival') continue;
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}
