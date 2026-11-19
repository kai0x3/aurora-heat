// Keyboard and mouse input. Held keys give a steering direction; one-shot
// presses are queued as bit flags and taken once by the loop. v4 adds weapon
// switching (number keys 1–5 and the mouse wheel), the F interact key (shops
// and activity markers) and Shift nitro while driving.

import { KEYS, WEAPON_ORDER } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_INTERACT = 16;

const UP = new Set(KEYS.up);
const DOWN = new Set(KEYS.down);
const LEFT = new Set(KEYS.left);
const RIGHT = new Set(KEYS.right);
const PAUSE = new Set(KEYS.pause);
const CONFIRM = new Set(KEYS.confirm);
const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 };

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let shootQueued = false;
  let weaponDelta = 0;
  let weaponPick = -1;

  function isMovement(code) {
    return UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code);
  }

  window.addEventListener('keydown', (event) => {
    if (isMovement(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (event.code === KEYS.enterCar) {
      if (!event.repeat) actions |= ACTION_ENTER_CAR;
    } else if (event.code === KEYS.interact) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (event.code === KEYS.mute) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === KEYS.nitro) {
      held.add(event.code);
    } else if (event.code in DIGITS) {
      if (!event.repeat) weaponPick = DIGITS[event.code];
    } else if (event.code === KEYS.shoot) {
      shootQueued = true;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (event.code === KEYS.shoot) shootQueued = false;
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
    shootQueued = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('wheel', (event) => {
    weaponDelta += event.deltaY > 0 ? 1 : -1;
    event.preventDefault();
  }, { passive: false });

  function anyHeld(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    moveX() {
      return (anyHeld(KEYS.right) ? 1 : 0) - (anyHeld(KEYS.left) ? 1 : 0);
    },
    moveY() {
      return (anyHeld(KEYS.down) ? 1 : 0) - (anyHeld(KEYS.up) ? 1 : 0);
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    firing() {
      return mouseDown || shootQueued;
    },
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** True while Shift is held: nitro, for a car that has it fitted. */
    nitro() {
      return held.has(KEYS.nitro);
    },
    /** Weapon switch since last call: an index into WEAPON_ORDER or -1. */
    takeWeaponPick() {
      const pick = weaponPick;
      weaponPick = -1;
      return pick;
    },
    /** Wheel steps since last call (+1 next weapon, -1 previous). */
    takeWeaponDelta() {
      const delta = weaponDelta;
      weaponDelta = 0;
      return delta;
    },
    weaponOrder: WEAPON_ORDER,
  };
}
