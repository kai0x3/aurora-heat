// Port Aurora itself: the road grid, the blocks between the roads, the
// buildings, parks, the waterfront — and, new in v4, the Boardwalk district
// along the south-east shore: a promenade strip with a ferris wheel landmark,
// food stalls, and the port cranes standing over the docks at the west end.
// This module only builds and answers questions about the map.

import {
  BEACH_Y, COLORS, ROAD_WIDTH, ROAD_XS, ROAD_YS, WATER_Y, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';

function roadHalf() {
  return ROAD_WIDTH / 2;
}

// District rectangles, checked in order; the HUD names where you are.
export const DISTRICTS = [
  { name: 'The Boardwalk', x0: 1800, y0: 1950, x1: 3200, y1: 2400 },
  { name: 'The Docks', x0: 0, y0: 1600, x1: 700, y1: 2400 },
  { name: 'Marina District', x0: 2200, y0: 0, x1: 3200, y1: 500 },
  { name: 'Downtown', x0: 800, y0: 500, x1: 2400, y1: 1600 },
  { name: 'Sol Plaza', x0: 1100, y0: 700, x1: 1700, y1: 1300 },
];

/** The district name for a point, or 'Port Aurora' in the open suburbs. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Port Aurora';
}

export function generateCity(rng) {
  const buildings = [];
  const parks = [];
  const plazas = [];
  const half = roadHalf();

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

  // Boardwalk landmarks (v4): the wheel, a row of stalls, and the port cranes.
  const landmarks = [
    { kind: 'wheel', x: 2850, y: 2120, r: 62, name: 'Aurora Wheel' },
    { kind: 'stall', x: 2050, y: 2130, name: 'Boardwalk Stalls' },
    { kind: 'stall', x: 2250, y: 2130, name: 'Boardwalk Stalls' },
    { kind: 'stall', x: 2450, y: 2130, name: 'Boardwalk Stalls' },
    { kind: 'crane', x: 260, y: 1900, name: 'Port Cranes' },
    { kind: 'crane', x: 430, y: 1900, name: 'Port Cranes' },
  ];
  return { buildings, parks, plazas, landmarks, roadXs: ROAD_XS, roadYs: ROAD_YS };
}

function makeBuilding(rng, x, y, width, height) {
  return {
    x, y, width, height,
    roof: rng.pick(COLORS.buildingRoof),
    windows: rng.int(2, 4),
    name: rng.pick(['Aurora Tower', 'Harbor View', 'Sol Plaza', 'Marina Court', 'Palm Offices', 'Crescent Lofts', 'Boardwalk Suites']),
  };
}

export function isOnRoad(x, y) {
  const half = roadHalf();
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= half) return true;
  return false;
}

export function isInWater(x, y) {
  return y >= WATER_Y;
}

export function nearestRoadPoint(x, y) {
  let bestX = ROAD_XS[0];
  let bestY = ROAD_YS[0];
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  return { x: bestX, y: bestY };
}

export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(ROAD_XS) + rng.range(-28, 28), y: rng.range(60, WORLD_HEIGHT - 140), axis: 'v' };
  }
  return { x: rng.range(60, WORLD_WIDTH - 60), y: rng.pick(ROAD_YS) + rng.range(-28, 28), axis: 'h' };
}

export function hitsObstacle(city, x, y, r) {
  if (isInWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.width && y + r > b.y && y - r < b.y + b.height) return true;
  }
  return false;
}

export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.width && y + r > b.y && y - r < b.y + b.height) return true;
  }
  return false;
}

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
