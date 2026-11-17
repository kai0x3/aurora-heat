// Traffic and pedestrians: the cars that cruise Port Aurora's roads and the people
// walking its sidewalks. Traffic cars follow the road grid and turn at intersections;
// pedestrians wander the blocks and run from gunfire and speeding cars.

import { ROAD_WIDTH, TRAFFIC_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { hitsBuilding, isOnRoad, nearestRoadPoint, randomRoadPoint } from './city.js';

export const TRAFFIC_COLORS = ['#d94f3d', '#3d7ad9', '#e8e3d8', '#3d3a38', '#7ab648', '#c9a13d', '#8a5fd9', '#d97ab0'];
export const PED_COLORS = ['#e8e3d8', '#7ab648', '#d97ab0', '#3d7ad9', '#e8b23d', '#9a6b4f'];

const TRAFFIC_COUNT = 14;
const PED_COUNT = 24;

/** One traffic car: position, heading (0 = east, PI/2 = south), speed and colour. */
function makeTrafficCar(rng, city) {
  const point = randomRoadPoint(rng);
  const angle = point.axis === 'v'
    ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
    : (rng.chance(0.5) ? 0 : Math.PI);
  // Offset to the right-hand lane of the road.
  const lane = ROAD_WIDTH / 4;
  const x = point.axis === 'v' ? point.x + (angle === Math.PI / 2 ? lane : -lane) : point.x;
  const y = point.axis === 'v' ? point.y : point.y + (angle === 0 ? lane : -lane);
  return {
    kind: 'traffic', x, y, angle,
    speed: TRAFFIC_SPEED * rng.range(0.8, 1.15),
    color: rng.pick(TRAFFIC_COLORS),
    hp: 100, driver: 'ai', turnCooldown: rng.range(0, 2),
  };
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
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 70),
    color: rng.pick(PED_COLORS),
    state: 'walk', wanderTimer: rng.range(1, 4), panicTimer: 0,
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

/**
 * Steer one traffic car along its road. At an intersection it may turn; near the
 * player it slows down; it never leaves the asphalt.
 */
export function updateTrafficCar(car, dt, rng, player) {
  car.turnCooldown -= dt;
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
  // Slow down for the player ahead so traffic does not pile through them.
  let targetSpeed = car.speed;
  if (player) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (dist < 120 && ahead > 0) targetSpeed = Math.min(targetSpeed, 40);
  }
  const speed = Math.max(0, targetSpeed);
  car.x += Math.cos(car.angle) * speed * dt;
  car.y += Math.sin(car.angle) * speed * dt;
  // Wrap around the city edge instead of driving into the bay or off the map.
  if (car.x < 40 || car.x > WORLD_WIDTH - 40 || car.y < 40 || car.y > WORLD_HEIGHT - 160) {
    car.angle += Math.PI;
    car.x = Math.max(40, Math.min(WORLD_WIDTH - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD_HEIGHT - 160, car.y));
  }
}

/** Walk the pedestrians; a panicked one runs away from the danger point. */
export function updatePedestrian(ped, dt, rng, danger) {
  ped.wanderTimer -= dt;
  if (danger && Math.hypot(ped.x - danger.x, ped.y - danger.y) < 260) {
    ped.state = 'panic';
    ped.panicTimer = 1.2;
  }
  if (ped.panicTimer > 0) {
    ped.panicTimer -= dt;
    const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.angle = away;
    ped.x += Math.cos(away) * 150 * dt;
    ped.y += Math.sin(away) * 150 * dt;
  } else {
    ped.state = 'walk';
    if (ped.wanderTimer <= 0) {
      ped.angle = rng.range(0, Math.PI * 2);
      ped.wanderTimer = rng.range(1.5, 4);
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.x = Math.max(30, Math.min(WORLD_WIDTH - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD_HEIGHT - 200, ped.y));
}

/** The closest car to (x, y) within `maxDist`, or null. */export function nearestCarTo(cars, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    if (car.driver === 'player') continue;
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}
