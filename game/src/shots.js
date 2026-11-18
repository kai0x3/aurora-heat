// The screenshot scenes behind ?shot=start|foot|drive|chase. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a small autopilot, so every frame is what a short game really looks like — and
// the same seed always gives the same frame.

import { SAFEHOUSE, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A minimal input object the autopilot drives instead of a keyboard. */
function scriptedInput(moveX, moveY) {
  return { moveX: () => moveX, moveY: () => moveY };
}

/** Put the player (and the camera) somewhere specific, for staging a scene. */
function placePlayer(world, x, y) {
  world.player.x = x;
  world.player.y = y;
  world.camera.x = x;
  world.camera.y = y;
}

/** Park a traffic car of the wanted kind right beside the player, ready to steal. */
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

/**
 * Drive east along the horizontal road the car is on: proportional steering
 * holds the centre line and a level heading, and once up to speed, a short hard
 * steer every so often throws the tail out so the tyres slide and leave marks.
 */
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

function driveEast(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, eastDriver(world, 600), false);
    if (events & EVENT_OVER) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title screen over a living city in golden morning light. foot: on
 * foot inside the safehouse ring, two stars up, lying low. drive: behind the
 * wheel of a sports coupe in traffic, sliding through the centre. chase: dusk,
 * four stars, a roadblock across the road ahead and the getaway job on the HUD.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'foot') {
    world.time = 60;
    placePlayer(world, SAFEHOUSE.x - 70, SAFEHOUSE.y + 46);
    world.wanted = 2;
    world.timeSinceCrime = 0;
    // Two of the parked steals in view, waiting on the road south of the ring.
    const parked = world.cars.filter((c) => c.driver === 'none');
    if (parked[0]) {
      parked[0].x = 1368;
      parked[0].y = 1180;
      parked[0].angle = Math.PI / 2;
    }
    if (parked[1]) {
      parked[1].x = 1432;
      parked[1].y = 1252;
      parked[1].angle = Math.PI / 2;
    }
    for (let i = 0; i < Math.floor(2 / STEP); i += 1) {
      world.step(STEP, scriptedInput(0, 0), false);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    world.time = 45;
    placePlayer(world, 300, 600);
    parkCarBesidePlayer(world, 'sports');
    world.toggleCar();
    if (world.player.car) world.player.car.speed = 150; // already rolling
    driveEast(world, 3.4);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Dusk: halfway through the day cycle, the light low and the windows lit.
    world.time = 150;
    startMission(world, 5);
    placePlayer(world, 500, 600);
    parkCarBesidePlayer(world, 'sedan');
    world.toggleCar();
    driveEast(world, 2.6);
    return { screen: SCREEN_PLAY };
  }
  // start (and anything unknown): let the city breathe behind the title.
  world.time = 24;
  for (let i = 0; i < Math.floor(4 / STEP); i += 1) {
    world.step(STEP, scriptedInput(0, 0), true);
  }
  return { screen: SCREEN_TITLE };
}
