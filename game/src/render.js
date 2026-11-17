// Drawing only: the world's state and the current screen in, pixels out. The
// canvas fills the window; the camera follows the player. Flat shapes, canvas
// text for the HUD and panels, and a live minimap of the whole city in the corner.

import {
  BEACH_Y, CAR_LENGTH, CAR_WIDTH, COLORS, PLAYER_HEALTH_MAX, PLAYER_RADIUS, ROAD_WIDTH,
  WATER_Y, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { missionObjectiveText, missionTarget } from './missions.js';
import { sirenColor } from './police.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = { width: 210, height: 150, margin: 16 };
const STAR = '★';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { width: 0, height: 0, ratio: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.ratio = ratio;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawCity(city) {
    // Ground: grass everywhere, then the bay and the beach along the south edge.
    context.fillStyle = COLORS.grass;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    context.fillStyle = COLORS.sand;
    context.fillRect(0, BEACH_Y, WORLD_WIDTH, WATER_Y - BEACH_Y);
    context.fillStyle = COLORS.water;
    context.fillRect(0, WATER_Y, WORLD_WIDTH, WORLD_HEIGHT - WATER_Y);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 80; x < WORLD_WIDTH; x += 260) {
      context.fillRect(x, WATER_Y + 40 + (x % 3) * 14, 90, 3);
    }
    // Parks: darker grass, trees, a path.
    for (const park of city.parks) {
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
    // Plazas: pale paving with a fountain dot.
    for (const plaza of city.plazas) {
      context.fillStyle = '#cfc8b8';
      context.fillRect(plaza.x, plaza.y, plaza.width, plaza.height);
      context.fillStyle = COLORS.water;
      context.beginPath();
      context.arc(plaza.x + plaza.width / 2, plaza.y + plaza.height / 2, 22, 0, Math.PI * 2);
      context.fill();
    }
    // Roads: asphalt bands with sidewalks and dashed centre lines.
    for (const rx of city.roadXs) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(rx - ROAD_WIDTH / 2 - 10, 0, ROAD_WIDTH + 20, WORLD_HEIGHT);
      context.fillStyle = COLORS.road;
      context.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_HEIGHT);
    }
    for (const ry of city.roadYs) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(0, ry - ROAD_WIDTH / 2 - 10, WORLD_WIDTH, ROAD_WIDTH + 20);
      context.fillStyle = COLORS.road;
      context.fillRect(0, ry - ROAD_WIDTH / 2, WORLD_WIDTH, ROAD_WIDTH);
    }
    context.fillStyle = COLORS.roadLine;
    for (const rx of city.roadXs) {
      for (let y = 0; y < WORLD_HEIGHT; y += 64) context.fillRect(rx - 3, y, 6, 32);
    }
    for (const ry of city.roadYs) {
      for (let x = 0; x < WORLD_WIDTH; x += 64) context.fillRect(x, ry - 3, 32, 6);
    }
    // Crosswalks at every intersection.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of city.roadXs) {
      for (const ry of city.roadYs) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(rx + i * 12 - 4, ry - ROAD_WIDTH / 2 + 6, 8, 16);
          context.fillRect(rx + i * 12 - 4, ry + ROAD_WIDTH / 2 - 22, 8, 16);
        }
      }
    }
    // Buildings: roof colour, dark edge, windows, and a name tag on the big ones.
    for (const b of city.buildings) {
      context.fillStyle = COLORS.buildingEdge;
      context.fillRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.width, b.height);
      context.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.max(2, Math.floor(b.width / 34));
      const rows = Math.max(2, Math.floor(b.height / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 10 + c * 34, b.y + 10 + r * 34, 16, 12);
        }
      }
    }
    // Street names along the waterfront, for the map's flavour.
    context.font = `bold 22px ${FONT}`;
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('AURORA BAY', 90, WATER_Y - 24);
    context.fillText('MARINA DISTRICT', 2350, 190);
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 7);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = '#1d2b3a';
    context.fillRect(6, -CAR_WIDTH / 2 + 4, 10, CAR_WIDTH - 8);
    context.fillRect(-16, -CAR_WIDTH / 2 + 4, 8, CAR_WIDTH - 8);
    // Headlights.
    context.fillStyle = '#ffe9a3';
    context.fillRect(CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 + 2, 3, 6);
    context.fillRect(CAR_LENGTH / 2 - 3, CAR_WIDTH / 2 - 8, 3, 6);
    if (car.kind === 'police') {
      context.fillStyle = sirenColor(car);
      context.beginPath();
      context.arc(-2, -CAR_WIDTH / 2 + 3, 4, 0, Math.PI * 2);
      context.arc(-2, CAR_WIDTH / 2 - 3, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('PD', 0, 3);
    }
    if (car.driver === 'player') {
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-CAR_LENGTH / 2 - 4, -CAR_WIDTH / 2 - 4, CAR_LENGTH + 8, CAR_WIDTH + 8, 9);
      context.stroke();
    }
    context.restore();
  }

  function drawPedestrian(ped, time) {
    const bob = ped.state === 'panic' ? Math.sin(time * 18) * 2 : Math.sin(time * 8) * 1;
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
    // Facing tick: where the player looks (and shoots).
    context.strokeStyle = '#2e2a28';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(player.x + Math.cos(player.angle) * PLAYER_RADIUS, player.y + Math.sin(player.angle) * PLAYER_RADIUS);
    context.lineTo(player.x + Math.cos(player.angle) * (PLAYER_RADIUS + 10), player.y + Math.sin(player.angle) * (PLAYER_RADIUS + 10));
    context.stroke();
  }

  function drawMissionMarker(world) {
    const target = missionTarget(world);
    if (!target) return;
    const pulse = 1 + Math.sin(world.time * 4) * 0.15;
    context.strokeStyle = '#37e08b';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#37e08b';
    context.beginPath();
    context.arc(target.x, target.y, 8, 0, Math.PI * 2);
    context.fill();
    // A beacon column so the marker reads from far away.
    const gradient = context.createLinearGradient(target.x, target.y - 130, target.x, target.y);
    gradient.addColorStop(0, 'rgba(55,224,139,0)');
    gradient.addColorStop(1, 'rgba(55,224,139,0.45)');
    context.fillStyle = gradient;
    context.fillRect(target.x - 6, target.y - 130, 12, 130);
  }

  function drawWorld(world, screen) {
    const camX = Math.max(view.width / 2, Math.min(WORLD_WIDTH - view.width / 2, world.camera.x));
    const camY = Math.max(view.height / 2, Math.min(WORLD_HEIGHT - view.height / 2, world.camera.y));
    const ox = view.width / 2 - camX;
    const oy = view.height / 2 - camY;
    context.save();
    context.translate(ox, oy);
    drawCity(world.city);
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      const bobY = Math.sin(pickup.bob) * 3;
      context.fillStyle = '#37e08b';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bobY, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('$', pickup.x, pickup.y + bobY);
    }
    drawMissionMarker(world);
    for (const ped of world.peds) drawPedestrian(ped, world.time);
    for (const car of world.cars) drawCar(car);
    if (world.player.onFoot) drawPlayer(world.player, world.time);
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
    context.restore();
    return { ox, oy };
  }

  function drawMinimap(world) {
    const x = view.width - MINIMAP.width - MINIMAP.margin;
    const y = MINIMAP.margin;
    const sx = MINIMAP.width / WORLD_WIDTH;
    const sy = MINIMAP.height / WORLD_HEIGHT;
    context.save();
    context.fillStyle = 'rgba(10,14,20,0.85)';
    context.fillRect(x - 4, y - 4, MINIMAP.width + 8, MINIMAP.height + 8);
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 1.5;
    context.strokeRect(x - 4, y - 4, MINIMAP.width + 8, MINIMAP.height + 8);
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
    const target = missionTarget(world);
    if (target) {
      context.fillStyle = '#37e08b';
      context.beginPath();
      context.arc(x + target.x * sx, y + target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of world.cars) {
      context.fillStyle = car.kind === 'police' ? '#ff2b2b' : '#e8d44f';
      context.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
    }
    // The player, big and unmissable.
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
    // Viewport rectangle on the minimap.
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

  function drawHud(world, save) {
    const pad = 16;
    // Money and score, top left.
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.fillRect(pad - 6, pad - 6, 250, 62);
    text(`$${world.player.money}`, pad, pad + 26, 30, '#37e08b', 'left', 'top');
    text(`earned $${world.player.earned}   •   jobs ${world.missionsDone}/3`, pad, pad + 52, 14, '#eef1f5', 'left', 'top');
    // Wanted stars, top right above the minimap.
    const starsY = MINIMAP.margin + MINIMAP.height + 22;
    text('WANTED', view.width - MINIMAP.margin - 8, starsY, 13, '#eef1f5', 'right', 'top');
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < world.wanted ? STAR : '☆';
    text(stars, view.width - MINIMAP.margin - 8, starsY + 22, 26, world.wanted > 0 ? '#ffd23f' : '#8b93a3', 'right', 'top');
    // Health bar, bottom left.
    const barW = 220;
    const barY = view.height - 44;
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.fillRect(pad - 6, barY - 26, barW + 12, 56);
    text('HEALTH', pad, barY - 4, 13, '#eef1f5', 'left', 'top');
    context.fillStyle = '#3a3f47';
    context.fillRect(pad, barY + 14, barW, 12);
    context.fillStyle = world.player.health > 35 ? '#37e08b' : '#ff5a5a';
    context.fillRect(pad, barY + 14, Math.max(0, (barW * world.player.health) / PLAYER_HEALTH_MAX), 12);
    // Mission objective, top centre.
    const objective = missionObjectiveText(world);
    context.font = `bold 16px ${FONT}`;
    const ow = context.measureText(objective).width + 36;
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.fillRect((view.width - ow) / 2, pad - 6, ow, 34);
    context.fillStyle = '#37e08b';
    context.fillRect((view.width - ow) / 2, pad - 6, 5, 34);
    text(objective, view.width / 2, pad + 22, 16, '#eef1f5', 'center', 'top');
    // Controls hint, bottom right.
    text('WASD drive / walk • E enter car • Click shoot • P pause • M mute', view.width - pad, view.height - 18, 13, 'rgba(238,241,245,0.75)', 'right', 'top');
    if (world.player.onFoot) {
      const near = world.cars.some((c) => c.kind !== 'police' && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 64);
      if (near) text('Press E to get in the car', view.width / 2, view.height - 64, 18, '#ffd23f', 'center', 'top');
    } else {
      text('Press E to get out', view.width / 2, view.height - 64, 18, '#ffd23f', 'center', 'top');
    }
    if (save && save.best > 0) text(`best $${save.best}`, pad, view.height - 18, 13, 'rgba(238,241,245,0.75)', 'left', 'top');
  }

  function drawPanel(title, lines, prompt, accent) {
    // Size the panel to its longest line so no text ever runs past the border.
    context.font = `bold 17px ${FONT}`;
    let longest = 0;
    for (const line of lines) longest = Math.max(longest, context.measureText(line).width);
    context.font = `bold 44px ${FONT}`;
    longest = Math.max(longest, context.measureText(title).width);
    const width = Math.min(view.width - 40, Math.max(640, longest + 90));
    const height = 150 + lines.length * 30 + 70;
    const x = (view.width - width) / 2;
    const y = (view.height - height) / 2;
    context.fillStyle = 'rgba(8,10,16,0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || '#ffd23f';
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
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
        'Port Aurora. Golden hour. One driver, three jobs, and the whole city watching.',
        'Rook has work for you — if you can stay ahead of the Aurora PD.',
        '',
        'WASD — walk / drive      E — steal & enter a car',
        'Mouse + click — aim & shoot      P — pause      M — mute',
        'Reach the markers, take the money, lose the heat.',
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
        `Money kept: $${world.player.money}   •   Jobs finished: ${world.missionsDone}/3`,
        save && save.best > 0 ? `Best haul: $${save.best}` : '',
      ],
      'Press Enter or click to run it back',
      '#ff5a5a',
    );
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
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
    /** Convert a canvas-pixel mouse position to world coordinates. */
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
