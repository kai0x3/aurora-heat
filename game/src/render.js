// Drawing only: the world's state and the current screen in, pixels out.
// v4 paints the Boardwalk landmarks (the Aurora Wheel turning slowly, stalls,
// port cranes), shop and activity markers, bikes, the Respect bar, the held
// weapon, armour, hit markers, a muzzle flash and a screen shake that kicks
// on hard hits — on top of the v3 day cycle, helicopter spotlight, minimap
// and HUD. The canvas fills the window at up to twice the device pixel ratio
// and only what the camera can see is painted. Two v4 performance rules keep
// it at 60 fps in software rendering too: HUD text uses a hard 1px offset
// shadow (a blurred shadow is the single most expensive canvas text effect),
// and the big ground rings are culled when they are off-camera.

import {
  BEACH_Y, CAR_LENGTH, CAR_MAX_HP, CAR_WIDTH, COLORS, DAY_CYCLE_SECONDS,
  GARAGE, HELI_SPOT_RADIUS, PLAYER_ARMOUR_MAX, PLAYER_HEALTH_MAX, PLAYER_RADIUS,
  REPAIR_TICK_COST, ROAD_WIDTH, SAFEHOUSE, SAFEHOUSE2, WATER_Y, WEAPON_SHOP,
  WEAPONS, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { districtAt } from './city.js';
import { MISSION_COUNT, missionObjectiveText, missionTarget } from './missions.js';
import { ACTIVITY_SPOTS, activityTarget, activityText } from './activities.js';
import { levelForRespect, levelProgress } from './progression.js';
import { playerAtAnySafehouse, playerAtSafehouse2, sirenColor } from './police.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = { width: 210, height: 150, margin: 16 };
const STAR = '★';

function hash2(a, b) {
  let h = (Math.floor(a) * 374761393 + Math.floor(b) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function dayInfo(world) {
  const t = (world.time % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
  let dark = 0;
  if (t >= 0.40 && t < 0.58) dark = (t - 0.40) / 0.18;
  else if (t >= 0.58 && t < 0.85) dark = 1;
  else if (t >= 0.85 && t < 0.98) dark = 1 - (t - 0.85) / 0.13;
  const duskGlow = Math.max(0, 1 - Math.abs(t - 0.47) / 0.11);
  const dawnGlow = Math.max(0, 1 - Math.abs(t - 0.94) / 0.07);
  return { dark, warm: Math.min(1, duskGlow + dawnGlow) };
}

function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { width: 0, height: 0, ratio: 1 };
  let vignette = null;
  let hurtVignette = null;
  let glowSprite = null;

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    view.ratio = ratio;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    const cx = view.width / 2;
    const cy = view.height / 2;
    vignette = context.createRadialGradient(
      cx, cy, Math.min(view.width, view.height) * 0.55,
      cx, cy, Math.max(view.width, view.height) * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.30)');
    hurtVignette = context.createRadialGradient(
      cx, cy, Math.min(view.width, view.height) * 0.42,
      cx, cy, Math.max(view.width, view.height) * 0.72,
    );
    hurtVignette.addColorStop(0, 'rgba(198,24,24,0)');
    hurtVignette.addColorStop(1, 'rgba(198,24,24,0.62)');
  }

  function lampGlow() {
    if (glowSprite) return glowSprite;
    const sprite = document.createElement('canvas');
    sprite.width = 128;
    sprite.height = 128;
    const g = sprite.getContext('2d');
    const gradient = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,196,96,0.55)');
    gradient.addColorStop(1, 'rgba(255,196,96,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
    glowSprite = sprite;
    return sprite;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.shadowColor = 'rgba(0,0,0,0.45)';
    context.shadowBlur = 0;
    context.shadowOffsetY = 1;
    context.fillText(value, x, y);
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  }

  function panel(x, y, w, h, fill) {
    context.beginPath();
    context.roundRect(x, y, w, h, 10);
    context.fillStyle = fill || 'rgba(10,14,20,0.72)';
    context.fill();
  }

  function drawLandmarks(city, bounds, time) {
    for (const mark of city.landmarks || []) {
      if (mark.x < bounds.left - 120 || mark.x > bounds.right + 120 || mark.y < bounds.top - 120 || mark.y > bounds.bottom + 120) continue;
      if (mark.kind === 'wheel') {
        // The Aurora Wheel: a turning ring of cabins over the Boardwalk.
        context.save();
        context.translate(mark.x, mark.y);
        context.strokeStyle = '#e8e3d8';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(-34, 66);
        context.lineTo(0, 0);
        context.lineTo(34, 66);
        context.stroke();
        const rot = time * 0.12;
        context.strokeStyle = '#ffd23f';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, 0, mark.r, 0, Math.PI * 2);
        context.stroke();
        for (let i = 0; i < 8; i += 1) {
          const a = rot + (i * Math.PI) / 4;
          const cx = Math.cos(a) * mark.r;
          const cy = Math.sin(a) * mark.r;
          context.strokeStyle = 'rgba(232,227,216,0.7)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(0, 0);
          context.lineTo(cx, cy);
          context.stroke();
          context.fillStyle = ['#ff5340', '#37c8e0', '#7ab648', '#e0347c'][i % 4];
          context.beginPath();
          context.arc(cx, cy + 5, 6, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
        text('AURORA WHEEL', mark.x, mark.y + mark.r + 26, 13, 'rgba(255,255,255,0.9)', 'center', 'top');
      } else if (mark.kind === 'stall') {
        context.fillStyle = '#a34a3d';
        context.fillRect(mark.x - 26, mark.y - 12, 52, 24);
        context.fillStyle = '#e8e3d8';
        for (let i = 0; i < 4; i += 1) context.fillRect(mark.x - 26 + i * 13, mark.y - 18, 7, 8);
      } else if (mark.kind === 'crane') {
        context.strokeStyle = '#5f7a8a';
        context.lineWidth = 7;
        context.beginPath();
        context.moveTo(mark.x, mark.y + 60);
        context.lineTo(mark.x, mark.y - 60);
        context.lineTo(mark.x + 88, mark.y - 60);
        context.stroke();
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(mark.x + 66, mark.y - 60);
        context.lineTo(mark.x + 66, mark.y - 18);
        context.stroke();
        context.fillStyle = '#c9a13d';
        context.fillRect(mark.x + 52, mark.y - 18, 28, 20);
      }
    }
  }

  function drawCity(city, bounds, dark, time) {
    context.fillStyle = COLORS.grass;
    context.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    for (let gx = Math.floor(bounds.left / 200) * 200; gx < bounds.right; gx += 200) {
      for (let gy = Math.floor(bounds.top / 200) * 200; gy < bounds.bottom; gy += 200) {
        context.fillStyle = ((gx / 200 + gy / 200) % 2 === 0) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
        context.fillRect(gx, gy, 200, 200);
      }
    }
    // The Boardwalk promenade: pale boards running the length of the shore.
    context.fillStyle = '#c8a878';
    context.fillRect(bounds.left, 2060, bounds.right - bounds.left, 130);
    context.fillStyle = 'rgba(0,0,0,0.10)';
    for (let x = Math.floor(bounds.left / 46) * 46; x < bounds.right; x += 46) {
      context.fillRect(x, 2060, 3, 130);
    }
    context.fillStyle = COLORS.sand;
    context.fillRect(bounds.left, BEACH_Y, bounds.right - bounds.left, WATER_Y - BEACH_Y);
    context.fillStyle = COLORS.water;
    context.fillRect(bounds.left, WATER_Y, bounds.right - bounds.left, bounds.bottom - WATER_Y);
    context.fillStyle = 'rgba(255,255,255,0.20)';
    const driftA = (time * 14) % 260;
    const driftB = 130 - ((time * 9) % 260);
    for (let x = Math.floor(bounds.left / 260) * 260 - 260 + driftA; x < bounds.right; x += 260) {
      context.fillRect(x, WATER_Y + 38, 84, 3);
    }
    for (let x = Math.floor(bounds.left / 260) * 260 - 260 + driftB; x < bounds.right; x += 260) {
      context.fillRect(x, WATER_Y + 80, 64, 3);
    }
    for (let x = 60; x < WORLD_WIDTH; x += 165) {
      const px = x + hash2(x, 7) * 50;
      if (px < bounds.left - 40 || px > bounds.right + 40) continue;
      const py = BEACH_Y + 26 + hash2(x, 13) * 24;
      context.strokeStyle = '#7a5a38';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(px, py + 16);
      context.quadraticCurveTo(px + 4, py + 2, px + 9, py - 10);
      context.stroke();
      context.strokeStyle = '#3f7a34';
      context.lineWidth = 3;
      for (const a of [-0.5, 0.4, 1.3, 2.4, 3.5]) {
        context.beginPath();
        context.moveTo(px + 9, py - 10);
        context.quadraticCurveTo(
          px + 9 + Math.cos(a) * 16, py - 16 + Math.sin(a) * 8,
          px + 9 + Math.cos(a) * 27, py - 6 + Math.sin(a) * 15,
        );
        context.stroke();
      }
    }
    for (const park of city.parks) {
      if (park.x + park.width < bounds.left || park.x > bounds.right || park.y + park.height < bounds.top || park.y > bounds.bottom) continue;
      context.fillStyle = COLORS.parkGrass;
      context.fillRect(park.x, park.y, park.width, park.height);
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(park.x, park.y + park.height / 2 - 8, park.width, 16);
      for (const tree of park.trees) {
        context.fillStyle = '#3f7a34';
        context.beginPath();
        context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#5da24a';
        context.beginPath();
        context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const plaza of city.plazas) {
      if (plaza.x + plaza.width < bounds.left || plaza.x > bounds.right || plaza.y + plaza.height < bounds.top || plaza.y > bounds.bottom) continue;
      context.fillStyle = '#cfc8b8';
      context.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
      context.fillStyle = COLORS.water;
      context.beginPath();
      context.arc(plaza.x + plaza.width / 2, plaza.y + plaza.height / 2, 22, 0, Math.PI * 2);
      context.fill();
    }
    for (const rx of city.roadXs) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(rx - ROAD_WIDTH / 2 - 10, bounds.top, ROAD_WIDTH + 20, bounds.bottom - bounds.top);
      context.fillStyle = COLORS.road;
      context.fillRect(rx - ROAD_WIDTH / 2, bounds.top, ROAD_WIDTH, bounds.bottom - bounds.top);
    }
    for (const ry of city.roadYs) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(bounds.left, ry - ROAD_WIDTH / 2 - 10, bounds.right - bounds.left, ROAD_WIDTH + 20);
      context.fillStyle = COLORS.road;
      context.fillRect(bounds.left, ry - ROAD_WIDTH / 2, bounds.right - bounds.left, ROAD_WIDTH);
    }
    context.fillStyle = COLORS.roadLine;
    for (const rx of city.roadXs) {
      for (let y = Math.max(0, Math.floor(bounds.top / 64) * 64); y < Math.min(WORLD_HEIGHT, bounds.bottom); y += 64) {
        context.fillRect(rx - 3, y, 6, 32);
      }
    }
    for (const ry of city.roadYs) {
      for (let x = Math.max(0, Math.floor(bounds.left / 64) * 64); x < Math.min(WORLD_WIDTH, bounds.right); x += 64) {
        context.fillRect(x, ry - 3, 32, 6);
      }
    }
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of city.roadXs) {
      for (const ry of city.roadYs) {
        if (rx < bounds.left - 80 || rx > bounds.right + 80 || ry < bounds.top - 80 || ry > bounds.bottom + 80) continue;
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(rx + i * 12 - 4, ry - ROAD_WIDTH / 2 + 6, 8, 16);
          context.fillRect(rx + i * 12 - 4, ry + ROAD_WIDTH / 2 - 22, 8, 16);
        }
      }
    }
    for (const b of city.buildings) {
      if (b.x + b.width < bounds.left || b.x > bounds.right || b.y + b.height < bounds.top || b.y > bounds.bottom) continue;
      context.fillStyle = COLORS.buildingEdge;
      context.fillRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.width, b.height);
      context.fillStyle = 'rgba(255,255,255,0.13)';
      context.fillRect(b.x, b.y, b.width, 6);
      context.fillStyle = 'rgba(0,0,0,0.14)';
      context.fillRect(b.x, b.y + b.height - 8, b.width, 8);
      context.fillStyle = 'rgba(0,0,0,0.08)';
      context.fillRect(b.x, b.y, 5, b.height);
      context.strokeStyle = 'rgba(0,0,0,0.20)';
      context.lineWidth = 3;
      context.strokeRect(b.x + 5, b.y + 5, b.width - 10, b.height - 10);
      const acCount = 1 + Math.floor(hash2(b.x, b.y) * 3);
      for (let i = 0; i < acCount; i += 1) {
        const ax = b.x + 14 + hash2(b.x + i * 7.3, b.y) * Math.max(4, b.width - 48);
        const ay = b.y + 14 + hash2(b.x, b.y + i * 9.1) * Math.max(4, b.height - 44);
        context.fillStyle = 'rgba(0,0,0,0.22)';
        context.fillRect(ax, ay, 18, 13);
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(ax, ay, 18, 4);
      }
      const cols = Math.max(2, Math.floor(b.width / 34));
      const rows = Math.max(2, Math.floor(b.height / 34));
      context.fillStyle = 'rgba(215,232,240,0.30)';
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 10 + c * 34, b.y + 10 + r * 34, 16, 12);
        }
      }
      if (dark > 0.05) {
        context.fillStyle = 'rgba(255,196,92,0.95)';
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if (hash2(b.x + c * 31.7, b.y + r * 47.3) < dark * 1.15) {
              context.fillRect(b.x + 10 + c * 34, b.y + 10 + r * 34, 16, 12);
            }
          }
        }
      }
    }
    drawLandmarks(city, bounds, time);
    context.font = `bold 22px ${FONT}`;
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('AURORA BAY', 90, WATER_Y - 24);
    context.fillText('MARINA DISTRICT', 2350, 190);
    context.fillText('THE BOARDWALK', 1980, 2044);
  }

  function ringVisible(x, y, radius, bounds) {
    return bounds && x + radius >= bounds.left && x - radius <= bounds.right
      && y + radius >= bounds.top && y - radius <= bounds.bottom;
  }

  function drawRing(x, y, radius, color, label, time) {
    const pulse = 1 + Math.sin(time * 2.4) * 0.02;
    context.fillStyle = color.replace('A)', '0.05)');
    context.beginPath();
    context.arc(x, y, radius * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = color.replace('A)', '0.75)');
    context.lineWidth = 3;
    context.setLineDash([16, 10]);
    context.beginPath();
    context.arc(x, y, radius * pulse, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    text(label, x, y - radius - 12, 13, color.replace('A)', '0.9)'), 'center', 'bottom');
  }

  function drawSafehouseRing(world, bounds) {
    if (ringVisible(SAFEHOUSE.x, SAFEHOUSE.y, SAFEHOUSE.radius, bounds)) {
      drawRing(SAFEHOUSE.x, SAFEHOUSE.y, SAFEHOUSE.radius, 'rgba(55,224,139,A)', 'SOL PLAZA SAFEHOUSE', world.time);
    }
    const unlocked = levelForRespect(world.player.respect) >= 5;
    if (ringVisible(SAFEHOUSE2.x, SAFEHOUSE2.y, SAFEHOUSE2.radius, bounds)) {
      drawRing(
        SAFEHOUSE2.x, SAFEHOUSE2.y, SAFEHOUSE2.radius,
        unlocked ? 'rgba(55,224,139,A)' : 'rgba(139,147,163,A)',
        unlocked ? 'BOARDWALK SAFEHOUSE' : 'BOARDWALK SAFEHOUSE — RESPECT 5',
        world.time,
      );
    }
  }

  function drawShopRings(world, bounds) {
    if (ringVisible(WEAPON_SHOP.x, WEAPON_SHOP.y, WEAPON_SHOP.radius, bounds)) {
      drawRing(WEAPON_SHOP.x, WEAPON_SHOP.y, WEAPON_SHOP.radius, 'rgba(255,140,66,A)', 'AURORA ARMS — F TO BUY', world.time);
    }
    if (ringVisible(GARAGE.x, GARAGE.y, GARAGE.radius, bounds)) {
      drawRing(GARAGE.x, GARAGE.y, GARAGE.radius, 'rgba(55,200,224,A)', 'TORQUE & TONE GARAGE — F TO BUY', world.time);
    }
  }

  function drawHeliSpot(world, dark) {
    const heli = world.heli;
    if (!heli || !heli.active) return;
    const strength = 0.30 + dark * 0.70;
    const dx = heli.spotX - heli.x;
    const dy = heli.spotY - heli.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * HELI_SPOT_RADIUS * 0.82;
    const py = (dx / len) * HELI_SPOT_RADIUS * 0.82;
    context.fillStyle = `rgba(255,244,200,${(0.10 * strength).toFixed(3)})`;
    context.beginPath();
    context.moveTo(heli.x, heli.y);
    context.lineTo(heli.spotX + px, heli.spotY + py);
    context.lineTo(heli.spotX - px, heli.spotY - py);
    context.closePath();
    context.fill();
    const pool = context.createRadialGradient(heli.spotX, heli.spotY, 8, heli.spotX, heli.spotY, HELI_SPOT_RADIUS);
    pool.addColorStop(0, `rgba(255,246,205,${(0.38 * strength).toFixed(3)})`);
    pool.addColorStop(1, 'rgba(255,246,205,0)');
    context.fillStyle = pool;
    context.beginPath();
    context.arc(heli.spotX, heli.spotY, HELI_SPOT_RADIUS, 0, Math.PI * 2);
    context.fill();
  }

  function drawHelicopter(world) {
    const heli = world.heli;
    if (!heli || !heli.active) return;
    context.fillStyle = 'rgba(0,0,0,0.20)';
    context.beginPath();
    context.ellipse(heli.x + 30, heli.y + 40, 30, 13, 0.4, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(heli.x, heli.y);
    context.fillStyle = '#14161c';
    context.fillRect(-58, -3.5, 36, 7);
    context.fillRect(-60, -10, 6, 16);
    context.beginPath();
    context.roundRect(-26, -11, 54, 22, 10);
    context.fill();
    context.fillStyle = '#33506b';
    context.beginPath();
    context.roundRect(8, -8, 16, 16, 6);
    context.fill();
    context.strokeStyle = '#0c0d10';
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(-16, 15);
    context.lineTo(20, 15);
    context.moveTo(-12, 11);
    context.lineTo(-12, 15);
    context.moveTo(14, 11);
    context.lineTo(14, 15);
    context.stroke();
    const reach = 40 * (0.35 + 0.65 * Math.abs(Math.cos(heli.rotor)));
    context.strokeStyle = 'rgba(12,13,16,0.85)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-reach, -13);
    context.lineTo(reach, -13);
    context.stroke();
    if (Math.floor(world.time * 2) % 2 === 0) {
      context.fillStyle = '#ff2b2b';
      context.beginPath();
      context.arc(-52, -8, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawCar(car) {
    const len = car.length || CAR_LENGTH;
    const wid = car.width || CAR_WIDTH;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.beginPath();
    context.ellipse(3, 5, len / 2 + 2, wid / 2 + 2, 0, 0, Math.PI * 2);
    context.fill();
    if (car.type === 'bike') {
      // The bike: a slim frame, two wheels in line, a rider blob.
      context.fillStyle = '#17181c';
      context.fillRect(-len / 2, -2.5, 10, 5);
      context.fillRect(len / 2 - 10, -2.5, 10, 5);
      context.fillStyle = car.color;
      context.beginPath();
      context.roundRect(-len / 2 + 7, -wid / 2, len - 16, wid, 5);
      context.fill();
      context.fillStyle = '#2e2a28';
      context.beginPath();
      context.arc(1, 0, 6.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffe9a3';
      context.fillRect(len / 2 - 3, -2, 3, 4);
    } else {
      context.fillStyle = car.color;
      context.beginPath();
      context.roundRect(-len / 2, -wid / 2, len, wid, 7);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.13)';
      context.beginPath();
      context.roundRect(-len / 2 + 3, -wid / 2 + 2, len - 6, wid * 0.38, 5);
      context.fill();
      context.fillStyle = '#17181c';
      for (const wx of [len / 2 - 15, -len / 2 + 4]) {
        context.fillRect(wx, -wid / 2 - 1.5, 11, 4.5);
        context.fillRect(wx, wid / 2 - 3, 11, 4.5);
      }
      if (car.type === 'truck') {
        context.fillStyle = 'rgba(255,255,255,0.20)';
        context.beginPath();
        context.roundRect(-len / 2 + 2, -wid / 2 + 2, len * 0.6, wid - 4, 3);
        context.fill();
      }
      context.fillStyle = '#1d2b3a';
      context.fillRect(len * 0.08, -wid / 2 + 4, 10, wid - 8);
      context.fillRect(-len * 0.32, -wid / 2 + 4, 8, wid - 8);
      if (car.type === 'taxi') {
        context.fillStyle = '#fff7cc';
        context.fillRect(-4, -3, 8, 6);
        context.fillStyle = '#17181c';
        context.font = `bold 7px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('TAXI', 0, -wid / 2 + 10);
      }
      if (car.armoured) {
        context.strokeStyle = 'rgba(200,210,225,0.8)';
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(-len / 2 + 2, -wid / 2 + 2, len - 4, wid - 4, 5);
        context.stroke();
      }
      if (car.rival) {
        context.fillStyle = '#f5f2ea';
        context.fillRect(-7, -wid / 2 + 3, 14, wid - 6);
        context.fillStyle = '#17181c';
        for (let i = 0; i < 3; i += 1) {
          context.fillRect(-7, -wid / 2 + 3 + i * ((wid - 6) / 3), 7, (wid - 6) / 6);
          context.fillRect(0, -wid / 2 + 3 + (i + 0.5) * ((wid - 6) / 3), 7, (wid - 6) / 6);
        }
      }
      context.fillStyle = '#ffe9a3';
      context.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 6);
      context.fillRect(len / 2 - 3, wid / 2 - 8, 3, 6);
    }
    if (car.kind === 'police') {
      context.fillStyle = sirenColor(car);
      context.beginPath();
      context.arc(-2, -wid / 2 + 3, 4, 0, Math.PI * 2);
      context.arc(-2, wid / 2 - 3, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('PD', 0, 3);
    }
    if (car.criminal) {
      // The vigilante target wears a pulsing red ring.
      context.strokeStyle = '#ff2b2b';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, len / 2 + 10, 0, Math.PI * 2);
      context.stroke();
    }
    if (car.driver === 'player') {
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8, 9);
      context.stroke();
    }
    context.restore();
  }

  function drawPedestrian(ped, time) {
    const bob = ped.state === 'panic' ? Math.sin(time * 18) * 2
      : ped.role === 'jogger' ? Math.sin(time * 13) * 2.4
        : Math.sin(time * 8) * 1;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 9, 8, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y + bob, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2e2a28';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 + bob, 4, 0, Math.PI * 2);
    context.fill();
    if (ped.state === 'watch') {
      context.fillStyle = '#eef1f5';
      context.fillRect(ped.x + Math.cos(ped.angle) * 9 - 2, ped.y + Math.sin(ped.angle) * 9 - 3 + bob, 4, 6);
    }
    if (ped.role === 'jogger') {
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ped.x, ped.y + bob, 9.5, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawPlayer(player, time) {
    const blink = player.health < 30 && Math.floor(time * 6) % 2 === 0;
    if (blink) return;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(player.x, player.y + 10, 10, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = COLORS.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2e2a28';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = '#2e2a28';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(player.x + Math.cos(player.angle) * PLAYER_RADIUS, player.y + Math.sin(player.angle) * PLAYER_RADIUS);
    context.lineTo(player.x + Math.cos(player.angle) * (PLAYER_RADIUS + 10), player.y + Math.sin(player.angle) * (PLAYER_RADIUS + 10));
    context.stroke();
  }

  function drawMissionMarker(world) {
    const target = missionTarget(world);
    if (target) drawMarkerAt(target.x, target.y, '#37e08b', world.time);
    const act = activityTarget(world);
    if (act) drawMarkerAt(act.x, act.y, '#ff8c42', world.time);
  }

  function drawMarkerAt(x, y, color, time) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, 8, 0, Math.PI * 2);
    context.fill();
    const gradient = context.createLinearGradient(x, y - 130, x, y);
    gradient.addColorStop(0, 'rgba(55,224,139,0)');
    gradient.addColorStop(1, 'rgba(55,224,139,0.45)');
    context.fillStyle = gradient;
    context.fillRect(x - 6, y - 130, 12, 130);
  }

  function drawWorld(world, screen) {
    const camX = Math.max(view.width / 2, Math.min(WORLD_WIDTH - view.width / 2, world.camera.x));
    const camY = Math.max(view.height / 2, Math.min(WORLD_HEIGHT - view.height / 2, world.camera.y));
    // Screen shake: a decaying offset, deterministic from world time.
    const shake = world.shake || 0;
    const shX = shake > 0 ? Math.sin(world.time * 91) * shake : 0;
    const shY = shake > 0 ? Math.cos(world.time * 113) * shake : 0;
    const ox = view.width / 2 - camX + shX;
    const oy = view.height / 2 - camY + shY;
    const bounds = {
      left: camX - view.width / 2 - 90,
      right: camX + view.width / 2 + 90,
      top: camY - view.height / 2 - 90,
      bottom: camY + view.height / 2 + 90,
    };
    const inView = (x, y, m) => x > bounds.left - m && x < bounds.right + m && y > bounds.top - m && y < bounds.bottom + m;
    const day = dayInfo(world);
    context.save();
    context.translate(ox, oy);
    drawCity(world.city, bounds, day.dark, world.time);
    drawSafehouseRing(world, bounds);
    drawShopRings(world, bounds);
    for (const mark of world.skids) {
      context.save();
      context.translate(mark.x, mark.y);
      context.rotate(mark.angle);
      context.globalAlpha = 0.45 * Math.max(0, mark.life / mark.maxLife);
      context.fillStyle = '#232019';
      context.fillRect(-4, -2.2, 8, 4.4);
      context.restore();
    }
    context.globalAlpha = 1;
    drawHeliSpot(world, day.dark);
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      const bobY = Math.sin(pickup.bob) * 3;
      context.fillStyle = pickup.kind === 'armour' ? '#37c8e0' : '#37e08b';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bobY, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(pickup.kind === 'armour' ? '+' : '$', pickup.x, pickup.y + bobY);
    }
    drawMissionMarker(world);
    for (const ped of world.peds) {
      if (inView(ped.x, ped.y, 30)) drawPedestrian(ped, world.time);
    }
    for (const car of world.cars) {
      if (inView(car.x, car.y, 80)) drawCar(car);
    }
    if (world.player.onFoot) drawPlayer(world.player, world.time);
    // Muzzle flash light at the player just after a shot.
    if (world.player.onFoot && world.time - world.muzzleAt < 0.07) {
      const fx = world.player.x + Math.cos(world.player.angle) * 26;
      const fy = world.player.y + Math.sin(world.player.angle) * 26;
      const flash = context.createRadialGradient(fx, fy, 2, fx, fy, 44);
      flash.addColorStop(0, 'rgba(255,220,120,0.85)');
      flash.addColorStop(1, 'rgba(255,220,120,0)');
      context.fillStyle = flash;
      context.beginPath();
      context.arc(fx, fy, 44, 0, Math.PI * 2);
      context.fill();
    }
    for (const b of world.bullets) {
      context.fillStyle = '#ffd23f';
      context.beginPath();
      context.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of world.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    drawHelicopter(world);
    context.restore();
    if (day.warm > 0.02) {
      context.fillStyle = `rgba(255,120,30,${(day.warm * 0.10).toFixed(3)})`;
      context.fillRect(0, 0, view.width, view.height);
    }
    if (day.dark > 0.02) {
      context.fillStyle = `rgba(8,12,38,${(day.dark * 0.42).toFixed(3)})`;
      context.fillRect(0, 0, view.width, view.height);
      context.save();
      context.translate(ox, oy);
      const sprite = lampGlow();
      context.globalAlpha = day.dark * 0.85;
      for (const rx of world.city.roadXs) {
        for (const ry of world.city.roadYs) {
          if (!inView(rx, ry, 90)) continue;
          context.drawImage(sprite, rx - 85, ry - 85, 170, 170);
        }
      }
      context.globalAlpha = 1;
      context.fillStyle = 'rgba(255,238,170,0.10)';
      for (const car of world.cars) {
        if (!inView(car.x, car.y, 140)) continue;
        const len = car.length || CAR_LENGTH;
        context.save();
        context.translate(car.x, car.y);
        context.rotate(car.angle);
        context.beginPath();
        context.moveTo(len / 2, -7);
        context.lineTo(len / 2 + 95, -27);
        context.lineTo(len / 2 + 95, 27);
        context.lineTo(len / 2, 7);
        context.closePath();
        context.fill();
        context.restore();
      }
      context.restore();
    }
    if (vignette) {
      context.fillStyle = vignette;
      context.fillRect(0, 0, view.width, view.height);
    }
    const sinceHit = world.time - (world.damageFlashAt ?? -99);
    if (hurtVignette && sinceHit >= 0 && sinceHit < 0.45) {
      context.globalAlpha = (1 - sinceHit / 0.45) * 0.85;
      context.fillStyle = hurtVignette;
      context.fillRect(0, 0, view.width, view.height);
      context.globalAlpha = 1;
    }
    // Hit marker: a small X beside the player right after a hit lands.
    if (world.time - world.hitmarkAt < 0.18 && screen === SCREEN_PLAY) {
      const hx = view.width / 2 + 26;
      const hy = view.height / 2 - 26;
      context.strokeStyle = '#fff';
      context.lineWidth = 3;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        context.beginPath();
        context.moveTo(hx + dx * 4, hy + dy * 4);
        context.lineTo(hx + dx * 11, hy + dy * 11);
        context.stroke();
      }
    }
    return { ox, oy };
  }

  function drawMinimap(world) {
    const x = view.width - MINIMAP.width - MINIMAP.margin;
    const y = MINIMAP.margin;
    const sx = MINIMAP.width / WORLD_WIDTH;
    const sy = MINIMAP.height / WORLD_HEIGHT;
    context.save();
    context.fillStyle = 'rgba(10,14,20,0.85)';
    context.beginPath();
    context.roundRect(x - 4, y - 4, MINIMAP.width + 8, MINIMAP.height + 8, 8);
    context.fill();
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(x - 4, y - 4, MINIMAP.width + 8, MINIMAP.height + 8, 8);
    context.stroke();
    context.beginPath();
    context.rect(x, y, MINIMAP.width, MINIMAP.height);
    context.clip();
    context.fillStyle = '#274b2e';
    context.fillRect(x, y, MINIMAP.width, MINIMAP.height);
    context.fillStyle = '#2f7fa8';
    context.fillRect(x, y + WATER_Y * sy, MINIMAP.width, MINIMAP.height - WATER_Y * sy);
    context.fillStyle = '#3d3a38';
    for (const rx of world.city.roadXs) context.fillRect(x + rx * sx - 2, y, 4, MINIMAP.height);
    for (const ry of world.city.roadYs) context.fillRect(x, y + ry * sy - 2, MINIMAP.width, 4);
    context.strokeStyle = '#37e08b';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x + SAFEHOUSE.x * sx, y + SAFEHOUSE.y * sy, 4, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(x + SAFEHOUSE2.x * sx, y + SAFEHOUSE2.y * sy, 4, 0, Math.PI * 2);
    context.stroke();
    // Shops: orange arms, cyan garage.
    context.fillStyle = '#ff8c42';
    context.fillRect(x + WEAPON_SHOP.x * sx - 3, y + WEAPON_SHOP.y * sy - 3, 6, 6);
    context.fillStyle = '#37c8e0';
    context.fillRect(x + GARAGE.x * sx - 3, y + GARAGE.y * sy - 3, 6, 6);
    // Idle activity spots in orange outline.
    context.strokeStyle = '#ff8c42';
    for (const kind of Object.keys(ACTIVITY_SPOTS)) {
      const spot = ACTIVITY_SPOTS[kind];
      context.strokeRect(x + spot.x * sx - 3, y + spot.y * sy - 3, 6, 6);
    }
    const target = missionTarget(world);
    if (target) {
      context.fillStyle = '#37e08b';
      context.beginPath();
      context.arc(x + target.x * sx, y + target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    const act = activityTarget(world);
    if (act) {
      context.fillStyle = '#ff8c42';
      context.beginPath();
      context.arc(x + act.x * sx, y + act.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of world.cars) {
      context.fillStyle = car.kind === 'police' ? '#ff2b2b' : (car.criminal ? '#ff2b2b' : '#e8d44f');
      context.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
    }
    if (world.rival && world.rival.car) {
      context.fillStyle = '#e0347c';
      context.fillRect(x + world.rival.car.x * sx - 2.5, y + world.rival.car.y * sy - 2.5, 5, 5);
    }
    if (world.heli && world.heli.active) {
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(x + world.heli.x * sx, y + world.heli.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(x + world.player.x * sx, y + world.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x + world.player.x * sx, y + world.player.y * sy, 7, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    const camX = Math.max(view.width / 2, Math.min(WORLD_WIDTH - view.width / 2, world.camera.x));
    const camY = Math.max(view.height / 2, Math.min(WORLD_HEIGHT - view.height / 2, world.camera.y));
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 1;
    context.strokeRect(
      x + (camX - view.width / 2) * sx,
      y + (camY - view.height / 2) * sy,
      view.width * sx,
      view.height * sy,
    );
  }

  function drawObjectiveArrow(world) {
    const target = missionTarget(world) || activityTarget(world);
    if (!target) return;
    const camX = Math.max(view.width / 2, Math.min(WORLD_WIDTH - view.width / 2, world.camera.x));
    const camY = Math.max(view.height / 2, Math.min(WORLD_HEIGHT - view.height / 2, world.camera.y));
    const sx = target.x - camX + view.width / 2;
    const sy = target.y - camY + view.height / 2;
    const margin = 64;
    if (sx > margin && sx < view.width - margin && sy > margin && sy < view.height - margin) return;
    const cx = view.width / 2;
    const cy = view.height / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const scaleX = dx !== 0 ? (view.width / 2 - margin) / Math.abs(dx) : Infinity;
    const scaleY = dy !== 0 ? (view.height / 2 - margin) / Math.abs(dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);
    const ax = cx + dx * scale;
    const ay = cy + dy * scale;
    const angle = Math.atan2(dy, dx);
    const pulse = 1 + Math.sin(world.time * 5) * 0.12;
    context.save();
    context.translate(ax, ay);
    context.rotate(angle);
    context.scale(pulse, pulse);
    context.fillStyle = missionTarget(world) ? '#37e08b' : '#ff8c42';
    context.beginPath();
    context.moveTo(17, 0);
    context.lineTo(-11, -10);
    context.lineTo(-5, 0);
    context.lineTo(-11, 10);
    context.closePath();
    context.fill();
    context.restore();
    const dist = Math.hypot(target.x - world.player.x, target.y - world.player.y);
    text(`${Math.round(dist / 8)}m`, ax, ay + 26, 13, '#37e08b', 'center', 'top');
  }

  function drawHud(world, save) {
    const pad = 16;
    panel(pad - 6, pad - 6, 300, 88);
    text(`$${world.player.money}`, pad, pad + 26, 30, '#37e08b', 'left', 'top');
    text(`earned $${world.player.earned}   •   jobs ${world.missionsDone}/${MISSION_COUNT}`, pad, pad + 52, 14, '#eef1f5', 'left', 'top');
    // Respect bar under the cash.
    const level = levelForRespect(world.player.respect);
    text(`RESPECT ${level}`, pad, pad + 74, 12, '#ffd23f', 'left', 'top');
    context.fillStyle = '#3a3f47';
    context.beginPath();
    context.roundRect(pad + 86, pad + 72, 150, 9, 4);
    context.fill();
    const rw = 150 * levelProgress(world.player.respect);
    if (rw > 0) {
      context.fillStyle = '#ffd23f';
      context.beginPath();
      context.roundRect(pad + 86, pad + 72, rw, 9, 4);
      context.fill();
    }
    const starsY = MINIMAP.margin + MINIMAP.height + 22;
    text('WANTED', view.width - MINIMAP.margin - 8, starsY, 13, '#eef1f5', 'right', 'top');
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < world.wanted ? STAR : '☆';
    text(stars, view.width - MINIMAP.margin - 8, starsY + 22, 26, world.wanted > 0 ? '#ffd23f' : '#8b93a3', 'right', 'top');
    // District name under the stars: where in Port Aurora you are.
    text(districtAt(world.player.x, world.player.y), view.width - MINIMAP.margin - 8, starsY + 56, 14, '#37c8e0', 'right', 'top');
    const barW = 220;
    const barY = view.height - 44;
    panel(pad - 6, barY - 26, barW + 12, 56);
    text('HEALTH', pad, barY - 4, 13, '#eef1f5', 'left', 'top');
    if (world.player.armour > 0) {
      text(`ARMOUR ${Math.round(world.player.armour)}`, pad + barW, barY - 4, 13, '#37c8e0', 'right', 'top');
    }
    context.fillStyle = '#3a3f47';
    context.beginPath();
    context.roundRect(pad, barY + 14, barW, 12, 6);
    context.fill();
    const healthW = Math.max(0, (barW * world.player.health) / PLAYER_HEALTH_MAX);
    if (healthW > 0) {
      context.fillStyle = world.player.health > 35 ? '#37e08b' : '#ff5a5a';
      context.beginPath();
      context.roundRect(pad, barY + 14, healthW, 12, 6);
      context.fill();
    }
    if (world.player.armour > 0) {
      const armourW = Math.max(0, (barW * world.player.armour) / PLAYER_ARMOUR_MAX);
      context.fillStyle = '#37c8e0';
      context.beginPath();
      context.roundRect(pad, barY + 14, armourW, 5, 2);
      context.fill();
    }
    // Held weapon, bottom left.
    if (world.player.onFoot) {
      const wname = (WEAPONS[world.player.weapon] || WEAPONS.pistol).name;
      text(`WEAPON — ${wname}  (1–5 / wheel)`, pad, view.height - 76, 14, '#eef1f5', 'left', 'top');
    }
    const objective = missionObjectiveText(world);
    context.font = `bold 16px ${FONT}`;
    const ow = context.measureText(objective).width + 36;
    panel((view.width - ow) / 2, pad - 6, ow, 34);
    context.fillStyle = '#37e08b';
    context.fillRect((view.width - ow) / 2, pad - 6, 5, 34);
    text(objective, view.width / 2, pad + 22, 16, '#eef1f5', 'center', 'top');
    // The live activity line, just under the objective.
    const actLine = activityText(world);
    if (actLine) {
      context.font = `bold 14px ${FONT}`;
      const aw = context.measureText(actLine).width + 30;
      panel((view.width - aw) / 2, pad + 34, aw, 28);
      text(actLine, view.width / 2, pad + 40, 14, '#ff8c42', 'center', 'top');
    }
    const mission = world.mission;
    const clockSource = (mission && !mission.done && mission.timeLeft !== null)
      ? mission.timeLeft
      : (world.activity && world.activity.timeLeft !== null ? world.activity.timeLeft : null);
    if (clockSource !== null) {
      const clock = formatClock(clockSource);
      const urgent = clockSource < 10;
      const colour = urgent
        ? (Math.floor(world.time * 3) % 2 === 0 ? '#ff5a5a' : '#ffd23f')
        : '#eef1f5';
      context.font = `bold 30px ${FONT}`;
      const cw = context.measureText(clock).width + 34;
      panel((view.width - cw) / 2, pad + 68, cw, 44);
      text(clock, view.width / 2, pad + 76, 30, colour, 'center', 'top');
    }
    if (mission && !mission.done && mission.stage === 'race' && mission.def) {
      const total = mission.def.checkpoints.length;
      const rivalGate = world.rival ? world.rival.gate : 0;
      const lead = mission.checkpointIndex - rivalGate;
      const line = `GATES — YOU ${mission.checkpointIndex}/${total}   •   RIVAL ${rivalGate}/${total}`;
      context.font = `bold 16px ${FONT}`;
      const rw2 = context.measureText(line).width + 34;
      panel((view.width - rw2) / 2, pad + 68, rw2, 32);
      text(line, view.width / 2, pad + 75, 16, lead > 0 ? '#37e08b' : (lead < 0 ? '#ff5a5a' : '#eef1f5'), 'center', 'top');
    }
    if (mission && !mission.done && mission.def && mission.def.fragile
      && mission.stage === 'deliver' && mission.cargo !== null) {
      const cw2 = 300;
      const cx2 = (view.width - cw2) / 2;
      panel(cx2, pad + 68, cw2, 40);
      text('CARGO', cx2 + 12, pad + 80, 13, '#eef1f5', 'left', 'top');
      text(`${Math.max(0, Math.round(mission.cargo))}%`, cx2 + cw2 - 12, pad + 80, 13, '#eef1f5', 'right', 'top');
      context.fillStyle = '#3a3f47';
      context.beginPath();
      context.roundRect(cx2 + 12, pad + 94, cw2 - 24, 8, 4);
      context.fill();
      const cargoW = Math.max(0, (cw2 - 24) * (mission.cargo / 100));
      if (cargoW > 0) {
        context.fillStyle = mission.cargo > 40 ? '#e8b23d' : '#ff5a5a';
        context.beginPath();
        context.roundRect(cx2 + 12, pad + 94, cargoW, 8, 4);
        context.fill();
      }
    }
    const toast = world.jobToast;
    if (toast && world.time < toast.until) {
      const tw = 470;
      const tx = (view.width - tw) / 2;
      const ty = pad + 124;
      panel(tx, ty, tw, 62, 'rgba(10,20,14,0.82)');
      context.strokeStyle = '#37e08b';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(tx, ty, tw, 62, 10);
      context.stroke();
      text(`JOB COMPLETE — ${toast.title}`, view.width / 2, ty + 8, 17, '#37e08b', 'center', 'top');
      text(
        `+$${toast.reward}   •   cash $${toast.cash}   •   jobs ${toast.jobs}/${MISSION_COUNT}   •   night ${formatClock(toast.totalTime)}`,
        view.width / 2, ty + 34, 14, '#eef1f5', 'center', 'top',
      );
    }
    const at = world.activityToast;
    if (at && world.time < at.until) {
      const tw = 440;
      const tx = (view.width - tw) / 2;
      const ty = view.height - 150;
      panel(tx, ty, tw, 46, 'rgba(24,16,8,0.85)');
      text(at.reward > 0 ? `${at.note}  (+$${at.reward})` : at.note, view.width / 2, ty + 14, 15, '#ff8c42', 'center', 'top');
    }
    if (world.levelUp && world.time < world.levelUp.until) {
      const tw = 460;
      const tx = (view.width - tw) / 2;
      const ty = pad + 196;
      panel(tx, ty, tw, 52, 'rgba(24,20,6,0.88)');
      text(`RESPECT LEVEL ${world.levelUp.level}!`, view.width / 2, ty + 6, 17, '#ffd23f', 'center', 'top');
      if (world.levelUp.unlock) text(world.levelUp.unlock, view.width / 2, ty + 28, 13, '#eef1f5', 'center', 'top');
    }
    if (!world.player.onFoot && world.player.car) {
      const sw = 138;
      const sx = view.width - pad - sw;
      const sy = view.height - 144;
      panel(sx, sy, sw, 86);
      const mph = Math.round(Math.abs(world.player.speed || 0) * 0.16);
      text(String(mph), sx + sw - 42, sy + 12, 32, '#eef1f5', 'right', 'top');
      text('mph', sx + sw - 10, sy + 26, 13, '#8b93a3', 'right', 'top');
      if (world.player.car.nitro) text('NITRO — SHIFT', sx + 10, sy + 40, 10, '#37c8e0', 'left', 'top');
      const hp = Math.max(0, world.player.car.hp);
      text('CAR', sx + 10, sy + 54, 11, '#8b93a3', 'left', 'top');
      text(`${Math.round(hp)}`, sx + sw - 10, sy + 54, 11, '#eef1f5', 'right', 'top');
      context.fillStyle = '#3a3f47';
      context.beginPath();
      context.roundRect(sx + 10, sy + 70, sw - 20, 8, 4);
      context.fill();
      const carW = (sw - 20) * (hp / CAR_MAX_HP);
      if (carW > 0) {
        context.fillStyle = hp > 50 ? '#37e08b' : (hp > 25 ? '#e8b23d' : '#ff5a5a');
        context.beginPath();
        context.roundRect(sx + 10, sy + 70, carW, 8, 4);
        context.fill();
      }
    }
    text('WASD drive / walk • E enter car • F shops & activities • 1–5 weapons • Shift nitro • P pause • M mute', view.width - pad, view.height - 18, 13, 'rgba(238,241,245,0.75)', 'right', 'top');
    if (playerAtAnySafehouse(world)) {
      let hint;
      if (!world.player.onFoot && world.player.car && world.player.car.hp < CAR_MAX_HP) {
        hint = world.player.money >= REPAIR_TICK_COST
          ? 'The safehouse crew is patching your ride — hold still…'
          : 'The crew could patch your ride — if you had the cash';
      } else {
        hint = world.wanted > 0
          ? 'Laying low at the safehouse — the heat cools fast here'
          : 'Safehouse — heat cools 3.5× faster inside the ring';
      }
      text(hint, view.width / 2, view.height - 96, 16, '#37e08b', 'center', 'top');
    }
    if (world.player.onFoot) {
      const near = world.cars.some((c) => c.kind !== 'police' && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 64);
      if (near) text('Press E to get in the car', view.width / 2, view.height - 64, 18, '#ffd23f', 'center', 'top');
    } else {
      text('Press E to get out', view.width / 2, view.height - 64, 18, '#ffd23f', 'center', 'top');
    }
    if (save && save.best > 0) text(`best $${save.best}`, pad, view.height - 18, 13, 'rgba(238,241,245,0.75)', 'left', 'top');
    drawObjectiveArrow(world);
  }

  function drawPanel(title, lines, prompt, accent) {
    context.font = `bold 17px ${FONT}`;
    let longest = 0;
    for (const line of lines) longest = Math.max(longest, context.measureText(line).width);
    context.font = `bold 44px ${FONT}`;
    longest = Math.max(longest, context.measureText(title).width);
    const width = Math.min(view.width - 40, Math.max(640, longest + 90));
    const height = 150 + lines.length * 30 + 70;
    const x = (view.width - width) / 2;
    const y = (view.height - height) / 2;
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.fillStyle = 'rgba(8,10,16,0.88)';
    context.fill();
    context.strokeStyle = accent || '#ffd23f';
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, view.width / 2, y + 66, 44, accent || '#ffd23f', 'center', 'top');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.width / 2, y + 118 + i * 30, 17, '#eef1f5', 'center', 'top');
    }
    text(prompt, view.width / 2, y + height - 34, 18, '#37e08b', 'center', 'top');
  }

  function drawTitle(world, save) {
    drawPanel(
      'AURORA HEAT',
      [
        'Port Aurora. Golden hour. One driver, twelve jobs, and the whole city watching.',
        'Rook has work for you — if you can stay ahead of the Aurora PD.',
        '',
        'WASD — walk / drive      E — steal & enter a car      F — shops & activities',
        'Mouse + click — aim & shoot      1–5 / wheel — weapons      Shift — nitro',
        'Earn Respect, unlock the locker, work the Boardwalk. Reach the markers, take the money, lose the heat.',
        save && save.best > 0 ? `Best haul so far: $${save.best}` : 'Your first night in Port Aurora starts now.',
      ],
      'Press Enter or click to start',
      '#ffd23f',
    );
  }

  function drawPaused() {
    drawPanel('PAUSED', ['The city waits. Your heat does not cool while paused —', 'well, actually it does. Take your time.'], 'Press P to keep driving', '#eef1f5');
  }

  function drawOver(world, save) {
    drawPanel(
      'BUSTED',
      [
        'The Aurora PD finally caught up with you.',
        `Money kept: $${world.player.money}   •   Jobs finished: ${world.missionsDone}/${MISSION_COUNT}   •   Respect level ${levelForRespect(world.player.respect)}`,
        save && save.best > 0 ? `Best haul: $${save.best}` : '',
      ],
      'Press Enter or click to run it back',
      '#ff5a5a',
    );
  }

  function draw(world, screen, save) {
    context.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, view.width, view.height);
    drawWorld(world, screen);
    if (screen === SCREEN_TITLE) {
      drawTitle(world, save);
      return;
    }
    drawMinimap(world);
    drawHud(world, save);
    if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(world, save);
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    screenToWorld(world, px, py) {
      const camX = Math.max(view.width / 2, Math.min(WORLD_WIDTH - view.width / 2, world.camera.x));
      const camY = Math.max(view.height / 2, Math.min(WORLD_HEIGHT - view.height / 2, world.camera.y));
      return { x: px + camX - view.width / 2, y: py + camY - view.height / 2 };
    },
    viewSize() {
      return { width: view.width, height: view.height };
    },
  };
}
