// Keyboard and mouse input. Held keys give a steering direction; one-shot presses
// (start, pause, enter a car, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked in canvas pixels for aiming; the renderer converts
// it to world coordinates.

import { KEYS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;

const UP = new Set(KEYS.up);
const DOWN = new Set(KEYS.down);
const LEFT = new Set(KEYS.left);
const RIGHT = new Set(KEYS.right);
const PAUSE = new Set(KEYS.pause);
const CONFIRM = new Set(KEYS.confirm);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let shootQueued = false;

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
    } else if (event.code === KEYS.mute) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === KEYS.shoot) {
      shootQueued = true;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    if (event.code === KEYS.shoot) shootQueued = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything.
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

  function anyHeld(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1 left, 1 right, 0 neither or both. */
    moveX() {
      return (anyHeld(KEYS.right) ? 1 : 0) - (anyHeld(KEYS.left) ? 1 : 0);
    },
    /** -1 up, 1 down, 0 neither or both. */
    moveY() {
      return (anyHeld(KEYS.down) ? 1 : 0) - (anyHeld(KEYS.up) ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True while the mouse button or Space is held: the player is firing. */
    firing() {
      return mouseDown || shootQueued;
    },
    /** The mouse position in canvas pixels. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
  };
}
