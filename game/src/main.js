// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. v4 widens the
// save (money, best haul, jobs, Respect, owned weapons, best race time) and
// the input surface: F buys at shops and starts side activities at their
// markers, number keys and the wheel switch weapons, Shift burns nitro.
//
// ?seed=N fixes the city's layout. ?shot=cover|taxi|boardwalk|night (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { SAVE_KEY, STEP, WEAPON_ORDER } from './config.js';
import {
  EVENT_ACTIVITY, EVENT_CHECKPOINT, EVENT_CRASH, EVENT_FAIL, EVENT_HONK,
  EVENT_LEVELUP, EVENT_MISSION, EVENT_NITRO, EVENT_OVER, EVENT_PACKAGE,
  EVENT_PICKUP, EVENT_PURCHASE, EVENT_SHOT, createWorld, shootAt,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { missionEventText } from './missions.js';
import { ACTIVITY_SPOTS, startActivity } from './activities.js';
import { buyAtShop, shopAt } from './shops.js';
import { switchWeapon } from './combat.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, best: 0, jobs: 0, respect: 0, weapons: ['fists', 'pistol'], bestRace: null };
    const parsed = JSON.parse(raw);
    return {
      money: Number(parsed.money) || 0,
      best: Number(parsed.best) || 0,
      jobs: Number(parsed.jobs) || 0,
      respect: Number(parsed.respect) || 0,
      weapons: Array.isArray(parsed.weapons) && parsed.weapons.length ? parsed.weapons : ['fists', 'pistol'],
      bestRace: Number.isFinite(parsed.bestRace) ? parsed.bestRace : null,
    };
  } catch {
    return { money: 0, best: 0, jobs: 0, respect: 0, weapons: ['fists', 'pistol'], bestRace: null };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const save = readSave();
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();

  world.player.money = save.money;
  world.player.respect = save.respect;
  world.player.weapons = [...save.weapons];
  world.bestRace = save.bestRace;

  function announce(message) {
    status.textContent = message;
  }

  function applySaveToWorld() {
    world.player.money = save.money;
    world.player.respect = save.respect;
    world.player.weapons = [...save.weapons];
    if (!world.player.weapons.includes(world.player.weapon)) world.player.weapon = 'pistol';
    world.bestRace = save.bestRace;
  }

  function startGame() {
    audio.unlock();
    audio.click();
    world.reset();
    applySaveToWorld();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Reach the green marker to start your first job.');
  }

  function saveProgress() {
    save.best = Math.max(save.best, world.player.earned);
    save.money = world.player.money;
    save.jobs = Math.max(save.jobs, world.missionsDone);
    save.respect = Math.max(save.respect, world.player.respect);
    save.weapons = [...world.player.weapons];
    save.bestRace = world.bestRace;
    writeSave(save);
  }

  function endGame() {
    screen = SCREEN_OVER;
    saveProgress();
    announce(`Busted. You kept $${world.player.money}. Best haul $${save.best}.`);
  }

  function handleInteract() {
    // Shops first, then activity markers.
    if (shopAt(world)) {
      const receipt = buyAtShop(world);
      if (receipt) {
        audio.unlock();
        if (receipt.startsWith('Bought') || receipt.includes('fitted') || receipt.includes('plated') || receipt.includes('Fresh')) {
          audio.purchase();
          saveProgress();
        } else {
          audio.click();
        }
        announce(receipt);
        world.activityToast = { note: receipt, reward: 0, until: world.time + 3.5 };
      }
      return;
    }
    if (!world.activity) {
      for (const kind of Object.keys(ACTIVITY_SPOTS)) {
        const spot = ACTIVITY_SPOTS[kind];
        if (Math.hypot(world.player.x - spot.x, world.player.y - spot.y) < 110) {
          startActivity(world, kind);
          audio.checkpoint();
          announce(`${spot.label} started. Follow the orange marker.`);
          return;
        }
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.unlock();
      audio.setMuted(!audio.isMuted());
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_ENTER_CAR && screen === SCREEN_PLAY) {
      const result = world.toggleCar();
      if (result === 'steal') {
        audio.unlock();
        audio.click();
        announce('You took the vehicle. The heat is on.');
      }
    }
    if (actions & ACTION_INTERACT && screen === SCREEN_PLAY) handleInteract();
    // Weapon switching: number keys pick a slot, the wheel cycles owned ones.
    if (screen === SCREEN_PLAY) {
      const pick = input.takeWeaponPick();
      if (pick >= 0 && WEAPON_ORDER[pick]) switchWeapon(world, WEAPON_ORDER[pick]);
      const delta = input.takeWeaponDelta();
      if (delta !== 0) {
        const owned = WEAPON_ORDER.filter((id) => world.player.weapons.includes(id));
        const idx = owned.indexOf(world.player.weapon);
        const next = owned[(idx + Math.sign(delta) + owned.length) % owned.length];
        if (next) switchWeapon(world, next);
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input, true);
      return;
    }
    if (screen === SCREEN_PLAY && world.player.onFoot && input.firing()) {
      const mouse = input.mouse();
      const target = renderer.screenToWorld(world, mouse.x, mouse.y);
      const event = shootAt(world, target.x, target.y);
      if (event === EVENT_SHOT) audio.shot(world.player.weapon);
    }
    const events = world.step(STEP, input, false);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PACKAGE) {
      audio.pickup();
      announce(missionEventText(world, 'package-picked'));
    }
    if (events & EVENT_CHECKPOINT) {
      audio.checkpoint();
      announce(missionEventText(world, 'checkpoint'));
    }
    if (events & EVENT_FAIL) {
      audio.fail();
      announce(missionEventText(world, 'mission-failed'));
    }
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_HONK) audio.honk();
    if (events & EVENT_NITRO) audio.nitro();
    if (events & EVENT_ACTIVITY) {
      audio.missionComplete();
      saveProgress();
      const toast = world.activityToast;
      if (toast) announce(toast.note);
    }
    if (events & EVENT_LEVELUP && world.levelUp) {
      audio.levelUp();
      announce(`Respect level ${world.levelUp.level}. ${world.levelUp.unlock}`);
      world.levelUp = null;
      saveProgress();
    }
    if (events & EVENT_MISSION) {
      audio.missionComplete();
      saveProgress();
      const toast = world.jobToast;
      announce(toast
        ? `${toast.title} done. +$${toast.reward}. $${world.player.money} in your pocket.`
        : `Job done. $${world.player.money} in your pocket.`);
    }
    if (events & EVENT_OVER) endGame();
    audio.update({
      driving: !world.player.onFoot,
      speed: world.player.speed || 0,
      wanted: world.wanted,
      sliding: world.playerSliding && !world.player.onFoot,
    });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, save);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Aurora Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
