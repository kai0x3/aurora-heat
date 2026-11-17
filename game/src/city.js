// Port Aurora itself: the road grid, the blocks between the roads, the buildings,
// parks and the waterfront, all laid out from a seed. This module only builds and
// answers questions about the map — it never moves anything.

import {
  BEACH_Y, COLORS, ROAD_WIDTH, ROAD_XS, ROAD_YS, WATER_Y, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';

function roadHalf() {
  return ROAD_WIDTH / 2;
}

/**
 * Build the city from `rng`. Roads are the grid in config; each block between four
 * roads becomes either buildings, a park or a plaza, and the south edge is the bay.
 * Returns { buildings, parks, plazas, roadXs, roadYs }.
 */
export function generateCity(rng) {
  const buildings = [];
  const parks = [];
  const plazas = [];
  const half = roadHalf();

  // Two park blocks, picked from the interior grid so they sit among the buildings.
  const parkCells = [
    { col: 2, row: 1 },
    { col: 5, row: 3 },
  ];

  for (let col = 0; col < ROAD_XS.length - 1; col += 1) {
    for (let row = 0; row < ROAD_YS.length - 1; row += 1) {
      const x0 = ROAD_XS[col] + half;
      const y0 = ROAD_YS[row] + half;
      const x1 = ROAD_XS[col + 1] - half;
      const y1 = ROAD_YS[row + 1] - half;
      // Blocks touching the beach stay open so the waterfront is reachable.
      if (y1 > BEACH_Y) continue;
      const isPark = parkCells.some((cell) => cell.col === col && cell.row === row);
      if (isPark) {
        parks.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0, trees: [] });
        const park = parks[parks.length - 1];
        const treeCount = rng.int(6, 10);
        for (let t = 0; t < treeCount; t += 1) {
          park.trees.push({
            x: rng.range(x0 + 24, x1 - 24),
            y: rng.range(y0 + 24, y1 - 24),
            r: rng.range(10, 18),
          });
        }
        continue;
      }
      if (rng.chance(0.14)) {
        plazas.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        continue;
      }
      // One to four buildings per block, each inset from the block edge.
      const count = rng.int(1, 4);
      if (count === 1) {
        buildings.push(makeBuilding(rng, x0 + 30, y0 + 30, x1 - x0 - 60, y1 - y0 - 60));
      } else if (count === 2) {
        const mid = (x0 + x1) / 2;
        buildings.push(makeBuilding(rng, x0 + 22, y0 + 30, mid - x0 - 44, y1 - y0 - 60));
        buildings.push(makeBuilding(rng, mid + 22, y0 + 30, x1 - mid - 44, y1 - y0 - 60));
      } else {
        const midX = (x0 + x1) / 2;
        const midY = (y0 + y1) / 2;
        buildings.push(makeBuilding(rng, x0 + 20, y0 + 20, midX - x0 - 40, midY - y0 - 40));
        buildings.push(makeBuilding(rng, midX + 20, y0 + 20, x1 - midX - 40, midY - y0 - 40));
        buildings.push(makeBuilding(rng, x0 + 20, midY + 20, midX - x0 - 40, y1 - midY - 40));
        buildings.push(makeBuilding(rng, midX + 20, midY + 20, x1 - midX - 40, y1 - midY - 40));
      }
    }
  }
  return { buildings, parks, plazas, roadXs: ROAD_XS, roadYs: ROAD_YS };
}

function makeBuilding(rng, x, y, width, height) {
  return {
    x, y, width, height,
    roof: rng.pick(COLORS.buildingRoof),
    windows: rng.int(2, 4),
    name: rng.pick(['Aurora Tower', 'Harbor View', 'Sol Plaza', 'Marina Court', 'Palm Offices', 'Crescent Lofts']),
  };
}

/** True when the point is on a road (within the asphalt). */
export function isOnRoad(x, y) {
  const half = roadHalf();
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= half) return true;
  return false;
}

/** True when the point is in the bay. */
export function isInWater(x, y) {
  return y >= WATER_Y;
}

/** The nearest road centre-line point to (x, y), snapped onto the grid. */
export function nearestRoadPoint(x, y) {
  let bestX = ROAD_XS[0];
  let bestY = ROAD_YS[0];
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  return { x: bestX, y: bestY };
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(ROAD_XS) + rng.range(-28, 28), y: rng.range(60, WORLD_HEIGHT - 140), axis: 'v' };
  }
  return { x: rng.range(60, WORLD_WIDTH - 60), y: rng.pick(ROAD_YS) + rng.range(-28, 28), axis: 'h' };
}

/** True when a circle of radius `r` at (x, y) overlaps a building or the water. */
export function hitsObstacle(city, x, y, r) {
  if (isInWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.width && y + r > b.y && y - r < b.y + b.height) return true;
  }
  return false;
}

/** True when a circle of radius `r` at (x, y) overlaps a building (cars may drive on sand). */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.width && y + r > b.y && y - r < b.y + b.height) return true;
  }
  return false;
}

/** Push a circle out of any building it overlaps; returns true when it moved. */
export function resolveBuildingCollision(city, body, r) {
  let moved = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.width));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.height));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r || d2 === 0) continue;
    const d = Math.sqrt(d2);
    body.x = cx + (dx / d) * r;
    body.y = cy + (dy / d) * r;
    moved = true;
  }
  return moved;
}
