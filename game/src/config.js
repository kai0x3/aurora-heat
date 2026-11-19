// Aurora Heat v4 — every tuning number in one place, so balancing the game
// means editing this file and nowhere else. v4 adds Respect progression, a
// weapon locker, side activities, two shops, a second safehouse, nitro and
// the Boardwalk district on top of the v3 city.

export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const ROAD_WIDTH = 96;
export const BLOCK = 400;

export const ROAD_XS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_YS = [200, 600, 1000, 1400, 1800, 2200];

export const WATER_Y = 2280;
export const BEACH_Y = 2200;

export const STEP = 1 / 60;
export const SAVE_KEY = 'aurora-heat-save-v2';

export const PLAYER_RADIUS = 13;
export const PLAYER_WALK_SPEED = 250;
export const PLAYER_HEALTH_MAX = 100;
export const PLAYER_ARMOUR_MAX = 100;

export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;

// Vehicle kinds. v4 adds the motorbike (fast, nimble, fragile) beside the
// sedan, the taxi variant, the sports tier and the heavy truck.
export const VEHICLE_TYPES = {
  sedan: { topSpeed: 540, accel: 440, brake: 700, reverseMax: 190, steer: 2.6, length: 52, width: 26, durability: 1 },
  taxi: { topSpeed: 530, accel: 445, brake: 710, reverseMax: 190, steer: 2.7, length: 52, width: 26, durability: 1 },
  sports: { topSpeed: 720, accel: 620, brake: 820, reverseMax: 220, steer: 2.9, length: 54, width: 27, durability: 0.9 },
  truck: { topSpeed: 430, accel: 300, brake: 560, reverseMax: 150, steer: 1.9, length: 72, width: 32, durability: 1.6 },
  bike: { topSpeed: 760, accel: 700, brake: 760, reverseMax: 160, steer: 3.6, length: 34, width: 14, durability: 0.55 },
};

export const TRAFFIC_SPEED = 150;
export const POLICE_SPEED = 520;

export const CAR_MAX_HP = 100;
export const DAMAGE_SMOKE_HP = 70;
export const DAMAGE_HANDLING_HP = 35;

export const REPAIR_TICK_SECONDS = 0.2;
export const REPAIR_TICK_HP = 6;
export const REPAIR_TICK_COST = 3;

export const SAFEHOUSE = { x: 1400, y: 1000, radius: 180, name: 'Sol Plaza' };
export const SAFEHOUSE2 = { x: 2600, y: 2000, radius: 160, name: 'Boardwalk' };
export const SAFEHOUSE_COOL_RATE = 3.5;

export const ROADBLOCK_COOLDOWN = 7;
export const ROADBLOCK_COOLDOWN_HOT = 4;

export const HELI_WANTED = 5;
export const HELI_ORBIT_RADIUS = 135;
export const HELI_SPOT_RADIUS = 150;

export const RACE_RIVAL_SPEED = 475;
export const CARGO_CRASH_DAMAGE = 12;
export const DAY_CYCLE_SECONDS = 300;

// The weapon locker. `unlock` is the Respect level that opens it in the shop.
export const WEAPONS = {
  fists: { name: 'Fists', damage: 18, cooldown: 0.34, range: 46, speed: 0, spread: 0, pellets: 1, price: 0, unlock: 1, auto: false },
  pistol: { name: 'Pistol', damage: 34, cooldown: 0.16, range: 620, speed: 900, spread: 0.02, pellets: 1, price: 0, unlock: 1, auto: false },
  smg: { name: 'SMG', damage: 16, cooldown: 0.07, range: 520, speed: 950, spread: 0.09, pellets: 1, price: 450, unlock: 2, auto: true },
  shotgun: { name: 'Shotgun', damage: 13, cooldown: 0.72, range: 340, speed: 820, spread: 0.16, pellets: 6, price: 800, unlock: 3, auto: false },
  rifle: { name: 'Rifle', damage: 46, cooldown: 0.30, range: 980, speed: 1250, spread: 0.005, pellets: 1, price: 1400, unlock: 4, auto: false },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

// Respect progression: thresholds per level and what each level unlocks.
export const RESPECT_LEVELS = [0, 120, 300, 550, 850, 1200];
export const LEVEL_UNLOCKS = {
  2: 'SMG at Aurora Arms + nitro at Torque & Tone',
  3: 'Shotgun at Aurora Arms',
  4: 'Rifle at Aurora Arms + body armour',
  5: 'Boardwalk safehouse',
};
export const RESPECT_MISSION = 40;
export const RESPECT_ACTIVITY = 18;

// Shops: original names, honest cash sinks.
export const WEAPON_SHOP = { x: 1000, y: 1000, radius: 110, name: 'Aurora Arms' };
export const GARAGE = { x: 2200, y: 1800, radius: 120, name: 'Torque & Tone Garage' };
export const ARMOUR_PRICE = 300;
export const NITRO_PRICE = 350;
export const PAINT_PRICE = 120;
export const CAR_ARMOUR_PRICE = 500;
export const NITRO_BOOST = 1.45;
export const NITRO_SECONDS = 3;

// Side activities.
export const TAXI_FARE_BASE = 60;
export const VIGILANTE_REWARD = 220;
export const VIGILANTE_SECONDS = 75;
export const RAMPAGE_REWARD = 300;
export const RAMPAGE_SECONDS = 45;
export const RAMPAGE_TARGET = 900;

export const BULLET_SPEED = 900;
export const BULLET_RANGE = 620;
export const BULLET_DAMAGE = 34;
export const FIRE_COOLDOWN = 0.16;
export const POLICE_CAR_HP = 100;
export const PLAYER_SHOT_DAMAGE = 8;

export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 7;
export const WANTED_QUIET_SECONDS = 6;

export const CASH_PICKUP_VALUE = 50;
export const NEAR_MISS_BONUS = 15;
export const NEAR_MISS_RESPECT = 2;

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

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enterCar: 'KeyE',
  interact: 'KeyF',
  nitro: 'ShiftLeft',
  shoot: 'Space',
  pause: ['KeyP', 'Escape'],
  mute: 'KeyM',
  confirm: ['Enter', 'Space'],
};
