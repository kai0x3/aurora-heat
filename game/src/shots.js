// The screenshot scenes behind ?shot=start|race|drive|heli. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a small autopilot, so every frame is what a short game really looks like — and
// the same seed always gives the same frame.

import { STEP } from './config.js';
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
 * start: the title screen over a living city in golden morning light. race:
 * the Harbor Sprint a moment after the first gate — the magenta rival coupe
 * alongside, the standings on the HUD, the next gate off-screen east. drive:
 * behind the wheel of a sports coupe in traffic, sliding through the centre.
 * heli: deep night, five stars, the kingpin run — the helicopter overhead with
 * its spotlight pinned to the car and a roadblock forming ahead.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'race') {
    world.time = 30;
    startMission(world, 4);
    placePlayer(world, 830, 600);
    parkCarBesidePlayer(world, 'sports');
    world.toggleCar();
    if (world.player.car) world.player.car.speed = 120; // already rolling
    driveEast(world, 1.5);
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
  if (name === 'heli') {
    // Deep night: two-thirds through the day cycle, the city dark and lit.
    world.time = 205;
    startMission(world, 8);
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
