// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and game over. Progress (money, best haul, jobs done) is saved to localStorage.
//
// ?seed=N fixes the city's layout. ?shot=start|race|drive|heli (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { SAVE_KEY, STEP } from './config.js';
import {
  EVENT_CHECKPOINT, EVENT_CRASH, EVENT_FAIL, EVENT_HONK, EVENT_MISSION,
  EVENT_OVER, EVENT_PACKAGE, EVENT_PICKUP, EVENT_SHOT, createWorld, shootAt,
} from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { missionEventText } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, best: 0, jobs: 0 };
    const parsed = JSON.parse(raw);
    return {
      money: Number(parsed.money) || 0,
      best: Number(parsed.best) || 0,
      jobs: Number(parsed.jobs) || 0,
    };
  } catch {
    return { money: 0, best: 0, jobs: 0 };
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

  // The saved haul carries over as starting cash on a new night.
  world.player.money = save.money;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.click();
    world.reset();
    world.player.money = save.money;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Reach the green marker to start your first job.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    save.best = Math.max(save.best, world.player.earned);
    save.money = world.player.money;
    save.jobs = Math.max(save.jobs, world.missionsDone);
    writeSave(save);
    announce(`Busted. You kept $${world.player.money}. Best haul $${save.best}.`);
  }

  function saveProgress() {
    save.best = Math.max(save.best, world.player.earned);
    save.money = world.player.money;
    save.jobs = Math.max(save.jobs, world.missionsDone);
    writeSave(save);
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
        announce('You took the car. The heat is on.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input, true);
      return;
    }
    // Firing: mouse aim, click or Space, on foot only.
    if (screen === SCREEN_PLAY && world.player.onFoot && input.firing()) {
      const mouse = input.mouse();
      const target = renderer.screenToWorld(world, mouse.x, mouse.y);
      const event = shootAt(world, target.x, target.y);
      if (event === EVENT_SHOT) audio.shot();
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

  // Leaving the tab pauses a running game rather than letting the heat build unseen.
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
