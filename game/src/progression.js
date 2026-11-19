// Respect progression (v4): the street keeps score. Missions, side
// activities and near-miss driving earn Respect; Respect raises your level;
// levels unlock shop stock, nitro, body armour and the Boardwalk safehouse.
// This module owns only the numbers — the world applies the rewards.

import { LEVEL_UNLOCKS, RESPECT_LEVELS } from './config.js';

/** The level a Respect total has earned (1-based). */
export function levelForRespect(respect) {
  let level = 1;
  for (let i = 0; i < RESPECT_LEVELS.length; i += 1) {
    if (respect >= RESPECT_LEVELS[i]) level = i + 1;
  }
  return Math.min(level, RESPECT_LEVELS.length);
}

/** Respect still needed for the next level, or 0 at the cap. */
export function respectToNext(respect) {
  const level = levelForRespect(respect);
  if (level >= RESPECT_LEVELS.length) return 0;
  return RESPECT_LEVELS[level] - respect;
}

/** Progress through the current level as a 0–1 fraction, for the HUD bar. */
export function levelProgress(respect) {
  const level = levelForRespect(respect);
  if (level >= RESPECT_LEVELS.length) return 1;
  const floor = RESPECT_LEVELS[level - 1];
  const ceil = RESPECT_LEVELS[level];
  return Math.max(0, Math.min(1, (respect - floor) / (ceil - floor)));
}

/**
 * Add Respect to the player. Returns a level-up note when a level was gained
 * ({ level, unlock }) or null. The world turns the note into a toast + sound.
 */
export function awardRespect(world, amount) {
  const player = world.player;
  const before = levelForRespect(player.respect);
  player.respect += amount;
  const after = levelForRespect(player.respect);
  if (after > before) {
    return { level: after, unlock: LEVEL_UNLOCKS[after] || '' };
  }
  return null;
}

/** True when the player's level opens the thing gated at `level`. */
export function hasUnlock(world, level) {
  return levelForRespect(world.player.respect) >= level;
}
