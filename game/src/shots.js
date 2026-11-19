// The screenshot scenes behind ?shot=cover|taxi|boardwalk|night. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a small autopilot, so every frame is what a short game
// really looks like — and the same seed always gives the same frame.
// v4 scenes: cover is the densest frame (a five-star chase under the
// helicopter with the mission marker, traffic and minimap all live), taxi
// shows a side activity mid-fare, boardwalk puts on-foot combat in the new
// district, and night shows the lit city with the shops and progression HUD.

import { STEP } from './config.js';
import { EVENT_OVER, shootAt } from './world.js';
import { startMission } from './missions.js';
import { startActivity } from './activities.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function scriptedInput(moveX, moveY) {
  return { moveX: () => moveX, moveY: () => moveY, nitro: () => false };
}

function placePlayer(world, x, y) {
  world.player.x = x;
  world.player.y = y;
  world.camera.x = x;
  world.camera.y = y;
}

function parkCarBesidePlayer(world, type) {
  const car = world.cars.find((c) => c.kind === 'traffic' && c.type === type)
    || world.cars.find((c) => c.kind === 'traffic');
  car.x = world.player.x + 44;
  car.y = world.player.y;
  car.angle = 0;
  car.speed = 0;
  car.driver = 'none';
  return car;
}

function eastDriver(world, lineY) {
  const car = world.player.car;
  if (!car) return scriptedInput(0, 0);
  let steer = -((car.y - lineY) * 0.012 + car.angle * 1.7);
  steer = Math.max(-1, Math.min(1, steer));
  const t = world.time;
  if (Math.abs(car.speed) > 380 && (t % 1.7) < 0.12) {
    steer = Math.floor(t / 1.7) % 2 === 0 ? 0.9 : -0.9;
  }
  return scriptedInput(steer, -1);
}

function driveEast(world, seconds, lineY) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, eastDriver(world, lineY || 600), false);
    if (events & EVENT_OVER) break;
  }
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'cover') {
    // Evening, the kingpin run: five stars, helicopter up, roadblock ahead,
    // the mission marker east and traffic all around the chase.
    world.time = 150;
    startMission(world, 8);
    world.player.respect = 850;
    placePlayer(world, 500, 600);
    parkCarBesidePlayer(world, 'sports');
    world.toggleCar();
    driveEast(world, 2.8);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'taxi') {
    // A taxi fare in progress: passenger aboard, destination marked, the
    // orange activity line on the HUD and the fare's taxi under the player.
    world.time = 40;
    world.player.respect = 300;
    placePlayer(world, 1500, 600);
    const cab = parkCarBesidePlayer(world, 'taxi');
    world.toggleCar();
    startActivity(world, 'taxi');
    if (world.activity) {
      world.activity.stage = 'deliver';
      world.activity.drop = { x: 2900, y: 600 };
      world.activity.target = { x: 1500, y: 600 };
    }
    if (cab) cab.speed = 130;
    driveEast(world, 1.6);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'boardwalk') {
    // On-foot combat on the Boardwalk: the wheel behind, stalls and joggers
    // around, two stars of heat — and shots just fired east down the shore
    // road, bullets in flight and the muzzle flash still lit.
    world.time = 70;
    world.player.respect = 550;
    world.player.weapon = 'pistol';
    placePlayer(world, 2620, 2080);
    world.wanted = 2;
    world.timeSinceCrime = 0;
    for (let i = 0; i < Math.floor(2.2 / STEP); i += 1) {
      world.step(STEP, scriptedInput(0.3, 0), false);
    }
    world.fireCooldown = 0;
    shootAt(world, world.player.x + 320, world.player.y - 30);
    world.step(STEP, scriptedInput(0, 0), false);
    world.fireCooldown = 0;
    shootAt(world, world.player.x + 320, world.player.y - 30);
    world.step(STEP, scriptedInput(0, 0), false);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'night') {
    // Night over downtown: lit windows, lamp pools, headlight cones, the
    // weapon shop ring in view and the Respect HUD reading level 5.
    world.time = 215;
    world.player.respect = 850;
    world.player.money = 1250;
    placePlayer(world, 1000, 1000);
    parkCarBesidePlayer(world, 'bike');
    for (let i = 0; i < Math.floor(2 / STEP); i += 1) {
      world.step(STEP, scriptedInput(0, 0), true);
    }
    return { screen: SCREEN_PLAY };
  }
  // start (and anything unknown): the title over a living city.
  world.time = 24;
  for (let i = 0; i < Math.floor(4 / STEP); i += 1) {
    world.step(STEP, scriptedInput(0, 0), true);
  }
  return { screen: SCREEN_TITLE };
}
