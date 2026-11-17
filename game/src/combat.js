// On-foot shooting: mouse aim, click or Space to fire. Bullets fly straight, hit
// police cruisers and pedestrians, and spark against buildings. Firing is a crime —
// it draws the wanted level up.

import { BULLET_DAMAGE, BULLET_RANGE, BULLET_SPEED } from './config.js';
import { hitsBuilding } from './city.js';
import { addWanted } from './police.js';

/** Fire one bullet from (x, y) along `angle`. Returns the bullet, or null on cooldown. */
export function fireBullet(world, x, y, angle) {
  if (world.fireCooldown > 0) return null;
  world.fireCooldown = 0.16;
  const bullet = {
    x, y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    travelled: 0,
  };
  world.bullets.push(bullet);
  world.shotsFired += 1;
  // Every few shots, the sound of gunfire draws attention.
  if (world.shotsFired % 4 === 1) addWanted(world, 1);
  spawnMuzzle(world, x, y, angle);
  return bullet;
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

/** Move bullets, test hits against cruisers and pedestrians, and spark off walls. */
export function updateBullets(world, dt) {
  const bullets = world.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += BULLET_SPEED * dt;
    let dead = b.travelled > BULLET_RANGE;
    if (!dead && hitsBuilding(world.city, b.x, b.y, 2)) {
      spawnSparks(world, b.x, b.y, '#e8d44f');
      dead = true;
    }
    if (!dead) {
      for (const car of world.police) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.hp -= BULLET_DAMAGE;
          spawnSparks(world, b.x, b.y, '#ff7a3d');
          if (car.hp <= 0) destroyPoliceCar(world, car);
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

/** A cruiser shot to pieces: smoke, a wanted bump, and it leaves the street. */
function destroyPoliceCar(world, car) {
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
  addWanted(world, 1);
}
