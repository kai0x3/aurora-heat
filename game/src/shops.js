// The cash economy (v4): two original Port Aurora businesses.
// Aurora Arms sells the weapon locker, gated by Respect level. Torque & Tone
// Garage fits nitro, repaints your ride and plates it with car armour.
// Standing in a shop ring and pressing F buys the next thing you can afford
// and do not own — simple, legible, and a real sink for mission money.

import {
  ARMOUR_PRICE, CAR_ARMOUR_PRICE, GARAGE, NITRO_PRICE, PAINT_PRICE,
  PLAYER_ARMOUR_MAX, WEAPON_ORDER, WEAPON_SHOP, WEAPONS,
} from './config.js';
import { levelForRespect } from './progression.js';

export const SHOPS = [
  { ...WEAPON_SHOP, kind: 'weapons' },
  { ...GARAGE, kind: 'garage' },
];

/** The shop whose ring the player stands in, or null. */
export function shopAt(world) {
  for (const shop of SHOPS) {
    if (Math.hypot(world.player.x - shop.x, world.player.y - shop.y) <= shop.radius) return shop;
  }
  return null;
}

const PAINTS = ['#ff5340', '#37c8e0', '#ffd23f', '#7ab648', '#e0347c', '#e8e3d8', '#3d3a38'];

/**
 * Buy at the shop the player is standing in. Returns a short receipt string
 * for the HUD/announcer, or a reason nothing was bought. Mutates the player
 * (and their car, at the garage) only on a successful purchase.
 */
export function buyAtShop(world) {
  const shop = shopAt(world);
  if (!shop) return null;
  const player = world.player;
  if (shop.kind === 'weapons') {
    const level = levelForRespect(player.respect);
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id];
      if (player.weapons.includes(id)) continue;
      if (level < def.unlock) return `${def.name} needs Respect level ${def.unlock}`;
      if (player.money < def.price) return `Not enough cash for the ${def.name} ($${def.price})`;
      player.money -= def.price;
      player.weapons.push(id);
      player.weapon = id;
      return `Bought the ${def.name} for $${def.price}`;
    }
    if (player.armour < PLAYER_ARMOUR_MAX) {
      if (level < 4) return 'Body armour needs Respect level 4';
      if (player.money < ARMOUR_PRICE) return `Not enough cash for body armour ($${ARMOUR_PRICE})`;
      player.money -= ARMOUR_PRICE;
      player.armour = PLAYER_ARMOUR_MAX;
      return `Body armour fitted — $${ARMOUR_PRICE}`;
    }
    return 'Aurora Arms: you own the whole locker';
  }
  // The garage works on the car you arrived in.
  const car = player.car;
  if (!car) return 'Torque & Tone: bring a car in first';
  if (!car.nitro && levelForRespect(player.respect) >= 2) {
    if (player.money < NITRO_PRICE) return `Not enough cash for nitro ($${NITRO_PRICE})`;
    player.money -= NITRO_PRICE;
    car.nitro = true;
    car.nitroLeft = 0;
    return `Nitro fitted — $${NITRO_PRICE}. Hold Shift to burn it`;
  }
  if (!car.armoured) {
    if (player.money < CAR_ARMOUR_PRICE) return `Not enough cash for car armour ($${CAR_ARMOUR_PRICE})`;
    player.money -= CAR_ARMOUR_PRICE;
    car.armoured = true;
    return `Car armour plated — $${CAR_ARMOUR_PRICE}`;
  }
  if (player.money < PAINT_PRICE) return `Not enough cash for a respray ($${PAINT_PRICE})`;
  player.money -= PAINT_PRICE;
  const next = PAINTS[(PAINTS.indexOf(car.color) + 1 + PAINTS.length) % PAINTS.length];
  car.color = next === car.color ? PAINTS[0] : next;
  return `Fresh paint — $${PAINT_PRICE}`;
}
