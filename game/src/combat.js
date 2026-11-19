// On-foot combat (v4): a five-slot weapon locker — fists, pistol, SMG,
// shotgun and rifle — switched with the number keys or the mouse wheel and
// bought at Aurora Arms. Each weapon has its own damage, cooldown, range,
// spread and pellet count. Hits raise a hit marker on the HUD; firing is a
// crime and the sound of it sends the street running.

import { WEAPONS } from './config.js';
import { hitsBuilding } from './city.js';
import { addWanted } from './police.js';

/** The definition of the player's currently held weapon. */
export function currentWeapon(world) {
  return WEAPONS[world.player.weapon] || WEAPONS.pistol;
}

/** Switch to an owned weapon by id. Returns true when the switch happened. */
export function switchWeapon(world, id) {
  if (!WEAPONS[id] || !world.player.weapons.includes(id)) return false;
  world.player.weapon = id;
  world.fireCooldown = Math.max(world.fireCooldown, 0.12);
  return true;
}

/** Fire the held weapon from (x, y) along `angle`. Returns true when it fired. */
export function fireBullet(world, x, y, angle) {
  if (world.fireCooldown > 0) return false;
  const def = currentWeapon(world);
  world.fireCooldown = def.cooldown;
  world.shotsFired += 1;
  if (def.speed === 0) {
    // Melee: a short arc in front of the player.
    for (const ped of world.peds) {
      if (Math.hypot(ped.x - x, ped.y - y) < def.range + 14) {
        ped.state = 'panic';
        ped.panicTimer = 2;
        world.hitmarkAt = world.time;
      }
    }
    for (const car of world.police) {
      if (Math.hypot(car.x - x, car.y - y) < def.range + 22) {
        car.hp -= def.damage;
        world.hitmarkAt = world.time;
        spawnSparks(world, car.x, car.y, '#ff7a3d');
        if (car.hp <= 0) destroyPoliceCar(world, car);
      }
    }
    return true;
  }
  for (let p = 0; p < def.pellets; p += 1) {
    const a = angle + (world.rng.next() - 0.5) * 2 * def.spread + (def.pellets > 1 ? (p - (def.pellets - 1) / 2) * 0.055 : 0);
    world.bullets.push({
      x, y,
      vx: Math.cos(a) * def.speed,
      vy: Math.sin(a) * def.speed,
      travelled: 0, range: def.range, speed: def.speed, damage: def.damage,
    });
  }
  if (world.shotsFired % 4 === 1) addWanted(world, 1);
  spawnMuzzle(world, x, y, angle);
  world.muzzleAt = world.time;
  return true;
}

function spawnMuzzle(world, x, y, angle) {
  for (let i = 0; i < 5; i += 1) {
    world.particles.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle + (world.rng.next() - 0.5) * 1.2) * world.rng.range(120, 260),
      vy: Math.sin(angle + (world.rng.next() - 0.5) * 1.2) * world.rng.range(120, 260),
      life: 0.18, maxLife: 0.18, color: '#ffd23f', size: 3,
    });
  }
}

export function updateBullets(world, dt) {
  const bullets = world.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += (b.speed || 900) * dt;
    let dead = b.travelled > (b.range || 620);
    if (!dead && hitsBuilding(world.city, b.x, b.y, 2)) {
      spawnSparks(world, b.x, b.y, '#e8d44f');
      dead = true;
    }
    if (!dead) {
      for (const car of world.police) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.hp -= b.damage || 34;
          world.hitmarkAt = world.time;
          spawnSparks(world, b.x, b.y, '#ff7a3d');
          if (car.hp <= 0) destroyPoliceCar(world, car);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of world.cars) {
        if (car.kind === 'police') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          world.hitmarkAt = world.time;
          spawnSparks(world, b.x, b.y, '#ffd23f');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of world.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.state = 'panic';
          ped.panicTimer = 2;
          ped.watchTimer = 0;
          spawnSparks(world, b.x, b.y, '#ff5a5a');
          addWanted(world, 1);
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

function spawnSparks(world, x, y, color) {
  for (let i = 0; i < 6; i += 1) {
    world.particles.push({
      x, y,
      vx: world.rng.range(-160, 160),
      vy: world.rng.range(-160, 160),
      life: 0.25, maxLife: 0.25, color, size: 2.5,
    });
  }
}

export function destroyPoliceCar(world, car) {
  for (let i = 0; i < 14; i += 1) {
    world.particles.push({
      x: car.x + world.rng.range(-20, 20),
      y: car.y + world.rng.range(-20, 20),
      vx: world.rng.range(-90, 90),
      vy: world.rng.range(-120, -20),
      life: world.rng.range(0.5, 1.1), maxLife: 1.1, color: '#555', size: world.rng.range(4, 9),
    });
  }
  const index = world.police.indexOf(car);
  if (index !== -1) world.police.splice(index, 1);
  const carIndex = world.cars.indexOf(car);
  if (carIndex !== -1) world.cars.splice(carIndex, 1);
  const blockIndex = world.roadblock.cars.indexOf(car);
  if (blockIndex !== -1) world.roadblock.cars.splice(blockIndex, 1);
  addWanted(world, 1);
  world.shake = Math.min(14, (world.shake || 0) + 7);
}
