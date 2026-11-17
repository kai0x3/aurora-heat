// Aurora Heat — every tuning number in one place, so balancing the game means
// editing this file and nowhere else.

export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const ROAD_WIDTH = 96;
export const BLOCK = 400;

// The road grid: vertical roads at these x positions, horizontal at these y positions.
// The blocks between them hold buildings, parks and plazas.
export const ROAD_XS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_YS = [200, 600, 1000, 1400, 1800, 2200];

// Waterfront: everything south of WATER_Y is the bay; the strip just north of it is sand.
export const WATER_Y = 2280;
export const BEACH_Y = 2200;

export const STEP = 1 / 60;
export const SAVE_KEY = 'aurora-heat-save-v1';

// Player on foot.
export const PLAYER_RADIUS = 13;
export const PLAYER_WALK_SPEED = 250;
export const PLAYER_HEALTH_MAX = 100;

// Cars.
export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;
export const CAR_ACCEL = 460;
export const CAR_BRAKE = 700;
export const CAR_MAX_SPEED = 560;
export const CAR_REVERSE_MAX = 200;
export const CAR_STEER = 2.6;
export const TRAFFIC_SPEED = 150;
export const POLICE_SPEED = 520;

// Combat.
export const BULLET_SPEED = 900;
export const BULLET_RANGE = 620;
export const BULLET_DAMAGE = 34;
export const FIRE_COOLDOWN = 0.16;
export const POLICE_CAR_HP = 100;
export const PLAYER_SHOT_DAMAGE = 8;

// Wanted level.
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 7;
export const WANTED_QUIET_SECONDS = 6;

// Mission rewards (money earned is also the score).
export const MISSION_REWARDS = [250, 400, 600];
export const CASH_PICKUP_VALUE = 50;

// Palette: a sun-soaked modern coastal city at golden hour.
export const COLORS = {
  grass: '#7fae5a',
  parkGrass: '#6da34e',
  sidewalk: '#b9b3a4',
  road: '#3d3a38',
  roadLine: '#e8d44f',
  buildingRoof: ['#c96f4a', '#4a7a96', '#8a6fb0', '#b0a06f', '#5f8f6a', '#96604a'],
  buildingEdge: '#2e2a28',
  water: '#2f7fa8',
  sand: '#e0c98f',
  player: '#ffd23f',
  police: '#2b5cff',
};

// Key bindings (KeyboardEvent.code values).
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enterCar: 'KeyE',
  shoot: 'Space',
  pause: ['KeyP', 'Escape'],
  mute: 'KeyM',
  confirm: ['Enter', 'Space'],
};
