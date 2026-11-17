// The screenshot scenes behind ?shot=start|foot|drive|chase. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// small autopilot, so every frame is what a short game really looks like — and the
// same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A minimal input object the autopilot drives instead of a keyboard. */
function scriptedInput(moveX, moveY) {
  return { moveX: () => moveX, moveY: () => moveY };
}

function autopilotTo(world, target) {
  const dx = target.x - world.player.x;
  const dy = target.y - world.player.y;
  const moveX = dx > 24 ? 1 : dx < -24 ? -1 : 0;
  const moveY = dy > 24 ? 1 : dy < -24 ? -1 : 0;
  return scriptedInput(moveX, moveY);
}

/** Walk the player toward the mission target for up to `seconds`, or until it arrives. */
function walkToMission(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = world.mission && world.mission.def && world.mission.def.target
      ? world.mission.def.target
      : { x: 1400, y: 1000 };
    const events = world.step(STEP, autopilotTo(world, target), false);
    if (events & EVENT_OVER) break;
    if (Math.hypot(world.player.x - target.x, world.player.y - target.y) < 120) break;
  }
}

/** Park a traffic car right beside the player so a shot can steal it on cue. */
function parkCarBesidePlayer(world) {
  const car = world.cars.find((c) => c.kind === 'traffic');
  car.x = world.player.x + 44;
  car.y = world.player.y;
  car.angle = 0;
  car.speed = 0;
  car.driver = 'none';
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title screen over a living city. foot: on foot mid-city, mission 1
 * active, HUD and minimap visible. drive: behind the wheel in traffic. chase:
 * a 3-star police chase with the escape mission on the HUD.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'foot') {
    walkToMission(world, 14);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    // Steal the nearest car, then drive along the road for a few seconds.
    parkCarBesidePlayer(world);
    world.toggleCar();
    const steps = Math.floor(9 / STEP);
    for (let i = 0; i < steps; i += 1) {
      world.step(STEP, scriptedInput(0, -1), false);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    startMission(world, 2);
    // Drive east along the top road while cruisers close in.
    parkCarBesidePlayer(world);
    world.toggleCar();
    const steps = Math.floor(7 / STEP);
    for (let i = 0; i < steps; i += 1) {
      world.step(STEP, scriptedInput(1, -1), false);
    }
    return { screen: SCREEN_PLAY };
  }
  // start (and anything unknown): let the city breathe behind the title.
  for (let i = 0; i < Math.floor(4 / STEP); i += 1) {
    world.step(STEP, scriptedInput(0, 0), true);
  }
  return { screen: SCREEN_TITLE };
}
