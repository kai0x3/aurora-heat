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

// Fallback car dimensions (police cruisers; traffic cars carry their own).
export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;

// The four kinds of car on Port Aurora's streets. Each drives differently: the
// truck lumbers, the sports coupe is the fastest thing in the city, and the
// sedan and taxi sit in between. Police cruisers borrow the sedan's shape.
export const VEHICLE_TYPES = {
  sedan: { topSpeed: 540, accel: 440, brake: 700, reverseMax: 190, steer: 2.6, length: 52, width: 26 },
  taxi: { topSpeed: 520, accel: 430, brake: 700, reverseMax: 190, steer: 2.6, length: 52, width: 26 },
  sports: { topSpeed: 720, accel: 620, brake: 820, reverseMax: 220, steer: 2.9, length: 54, width: 27 },
  truck: { topSpeed: 430, accel: 300, brake: 560, reverseMax: 150, steer: 1.9, length: 72, width: 32 },
};

export const TRAFFIC_SPEED = 150;
export const POLICE_SPEED = 520;

// The Sol Plaza safehouse: the hideout the second job delivers to. Standing
// inside its ring cools the wanted level much faster than lying low elsewhere.
export const SAFEHOUSE = { x: 1400, y: 1000, radius: 180 };
export const SAFEHOUSE_COOL_RATE = 3.5;

// Police roadblocks: at four stars and up, cruisers park across the road ahead.
// After one is scattered or outrun, the next forms this many seconds later —
// sooner at five stars, when the whole force is committed.
export const ROADBLOCK_COOLDOWN = 7;
export const ROADBLOCK_COOLDOWN_HOT = 4;

// One full turn of the day: golden morning, dusk, blue night and back again.
export const DAY_CYCLE_SECONDS = 300;

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
