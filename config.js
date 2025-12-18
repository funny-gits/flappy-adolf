// config.js

// --- Game Configuration & Constants ---
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;
export const GROUND_Y_OFFSET = 50;
export const PLAYER_START_X = 100;
export const PLAYER_START_Y_OFFSET = 100;
export const JETPACK_FORCE_MULTIPLIER = 0.85;
export const MAX_FUEL = 150;
export const FUEL_RECHARGE_RATE = 0.4;
export const FUEL_CONSUMPTION_RATE = 1.0;
export const INITIAL_GAME_SPEED = 4;
export const MAX_GAME_SPEED = 20;
export const GAME_SPEED_INCREMENT = 0.0008;

export const POWERUP_DURATION = 8000;
export const WEAPON_SYSTEM_DURATION = 12000;
export const SPREAD_SHOT_DURATION = 10000;
export const RAPID_FIRE_DURATION = 7000;
export const SCORE_MULTIPLIER_DURATION = 10000;
export const COIN_MAGNET_DURATION = 10000;
export const SPEED_BURST_DURATION = 6000;

export const OBSTACLE_START_INTERVAL = 1400;
export const OBSTACLE_MIN_INTERVAL = 600;
export const OBSTACLE_INTERVAL_DECREMENT_FACTOR = 0.99;

export const POWERUP_REGULAR_INTERVAL = 3200;
export const POWERUP_REGULAR_MIN_INTERVAL = 1800;
export const POWERUP_BOSS_INTERVAL = 6000;
export const POWERUP_BOSS_MIN_INTERVAL = 3000;
export const POWERUP_INTERVAL_DECREMENT_FACTOR = 0.975;

export const ENEMY_START_INTERVAL = 4000;
export const ENEMY_MIN_INTERVAL = 2000;
export const ENEMY_INTERVAL_DECREMENT_FACTOR = 0.985;
export const MAX_ENEMY_SPAWN_ATTEMPTS = 10;

export const BOSS_SPAWN_INTERVAL_MS = 60000;

// --- Scoreboard Constants ---
export const MAX_HIGH_SCORES = 5;
export const LOCAL_STORAGE_PLAYER_NAME_KEY = "jetpackJumperPlayerName";

// --- Player Constants ---
export const PLAYER_SHOOT_COOLDOWN_TIME = 300;

// --- Message Durations ---
export const TEMPORARY_WIN_MESSAGE_DURATION_MS = 4000;

// --- Firebase Default Config (if not provided by environment) ---
export const DEFAULT_APP_ID = "my-jetpack-jumper-local"; // A unique identifier for your app/game (can be anything)
export const DEFAULT_FIREBASE_CONFIG = { 
  apiKey: "AIzaSyDkQJHGHZapGD8sKggskwz4kkQRwmr_Kh0",
  authDomain: "jetpack-7ced6.firebaseapp.com",
  projectId: "jetpack-7ced6",
  storageBucket: "jetpack-7ced6.firebaseapp.com",
  appId: "1:34167115128:web:f31520e4bbb37f564e4c8d",
  measurementId: "G-YCEJP443C4"
};

// --- Power-up Types Enum ---
export const POWERUP_TYPE = {
  COIN: "coin",
  FUEL_CELL: "fuel_cell",
  SHIELD: "shield",
  COIN_MAGNET: "coin_magnet",
  SPEED_BURST: "speed_burst",
  WEAPON_SYSTEM: "weapon_system",
  SPREAD_SHOT: "spread_shot",
  RAPID_FIRE: "rapid_fire",
  SCORE_MULTIPLIER: "score_multiplier",
};

// --- Colors (Variables will be assigned in defineColors) ---
// These will be populated by defineColors() and exported for use elsewhere.
export let C_PLAYER, C_PLAYER_PROJECTILE, C_ENEMY_DRONE, C_ENEMY_INTERCEPTOR, C_ENEMY_TURRET, C_ENEMY_PROJECTILE;
export let C_OBSTACLE, C_GROUND_DETAIL, C_POWERUP_COIN, C_POWERUP_FUEL, C_POWERUP_SHIELD, C_POWERUP_WEAPON;
export let C_POWERUP_SPREAD, C_POWERUP_RAPID, C_POWERUP_MULTIPLIER, C_POWERUP_MAGNET, C_POWERUP_SPEED;
export let C_BOSS_TANK, C_BOSS_SHIP, C_BOSS_FINAL, C_PARTICLE_JET, C_PARTICLE_EXPLOSION, C_PARTICLE_IMPACT, C_PARTICLE_EMBER;
export let C_TEXT_MAIN, C_TEXT_ACCENT, C_TEXT_SCORE, C_HUD_BG;
export let C_SKY_OVERCAST, C_SKY_HORIZON, C_BUILDING_DARK, C_BUILDING_LIGHT, C_RUBBLE_DARK, C_RUBBLE_LIGHT, C_SMOKE_EFFECT, C_FIRE_GLOW_STRONG, C_FIRE_GLOW_WEAK;
export let C_PILLAR_DARK, C_PILLAR_LIGHT, C_SKIN_TONE, C_MUSTACHE_COLOR, C_BLOOD_RED;
export let C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK, C_BANNER_CIRCLE_WHITE;
export let C_VICTORY_TEXT, C_VICTORY_SUBTEXT;

// This function needs access to p5's color() function.
// It will be called from main.js after p5 is initialized.
export function defineColors(p5Instance) {
  C_PLAYER = p5Instance.color(75, 83, 32);
  C_PLAYER_PROJECTILE = p5Instance.color(180, 160, 50);
  C_ENEMY_DRONE = p5Instance.color(255, 99, 71); // Tomato Red
  C_ENEMY_INTERCEPTOR = p5Instance.color(255, 69, 0); // OrangeRed
  C_ENEMY_TURRET = p5Instance.color(205, 92, 92); // IndianRed
  C_ENEMY_PROJECTILE = p5Instance.color(150, 60, 40);
  C_OBSTACLE = p5Instance.color(150, 160, 170);
  C_GROUND_DETAIL = p5Instance.color(60, 50, 45);
  C_POWERUP_COIN = p5Instance.color(184, 134, 11);
  C_POWERUP_FUEL = p5Instance.color(0, 100, 100);
  C_POWERUP_SHIELD = p5Instance.color(40, 120, 50);
  C_POWERUP_WEAPON = p5Instance.color(150, 150, 40);
  C_POWERUP_SPREAD = p5Instance.color(150, 70, 0);
  C_POWERUP_RAPID = p5Instance.color(255, 140, 0);
  C_POWERUP_MULTIPLIER = p5Instance.color(200, 100, 0);
  C_POWERUP_MAGNET = p5Instance.color(100, 100, 150);
  C_POWERUP_SPEED = p5Instance.color(180, 120, 0);
  C_BOSS_TANK = p5Instance.color(75, 83, 32);
  C_BOSS_SHIP = p5Instance.color(60, 70, 75);
  C_BOSS_FINAL = p5Instance.color(100, 90, 100);
  C_PARTICLE_JET = p5Instance.color(180, 80, 0);
  C_PARTICLE_EXPLOSION = [
    p5Instance.color(150, 40, 0),
    p5Instance.color(120, 80, 0),
    p5Instance.color(100, 100, 20),
    p5Instance.color(80, 80, 80),
  ];
  C_PARTICLE_IMPACT = p5Instance.color(100, 100, 100, 180);
  C_PARTICLE_EMBER = p5Instance.color(255, 100, 0, 150);
  C_TEXT_MAIN = p5Instance.color(220);
  C_TEXT_ACCENT = p5Instance.color(180, 160, 50);
  C_TEXT_SCORE = p5Instance.color(200, 200, 100);
  C_HUD_BG = p5Instance.color(20, 20, 20, 180);
  C_SKY_OVERCAST = p5Instance.color(60, 70, 80);
  C_SKY_HORIZON = p5Instance.color(80, 90, 100);
  C_BUILDING_DARK = p5Instance.color(35, 35, 35);
  C_BUILDING_LIGHT = p5Instance.color(55, 50, 45);
  C_RUBBLE_DARK = p5Instance.color(45, 40, 35);
  C_RUBBLE_LIGHT = p5Instance.color(65, 60, 55);
  C_SMOKE_EFFECT = p5Instance.color(70, 70, 70, 50);
  C_FIRE_GLOW_STRONG = p5Instance.color(255, 100, 0, 30);
  C_FIRE_GLOW_WEAK = p5Instance.color(200, 150, 0, 20);
  C_PILLAR_DARK = p5Instance.color(50, 55, 60);
  C_PILLAR_LIGHT = p5Instance.color(70, 75, 80);
  C_SKIN_TONE = p5Instance.color(200, 160, 120);
  C_MUSTACHE_COLOR = p5Instance.color(30, 30, 30);
  C_BLOOD_RED = p5Instance.color(180, 30, 30);
  C_BANNER_BG_RED = p5Instance.color(110, 0, 0);
  C_BANNER_SYMBOL_BLACK = p5Instance.color(0);
  C_BANNER_CIRCLE_WHITE = p5Instance.color(220);
  C_VICTORY_TEXT = p5Instance.color(255, 215, 0);
  C_VICTORY_SUBTEXT = p5Instance.color(240, 240, 240);
}

// This function is to update the exported color variables after p5Instance.color() has been used.
// It's a bit of a workaround for ES6 module static nature.
export function updateExportedColors() {
    // This function doesn't need to do anything if defineColors directly assigns
    // to the exported let variables. The key is that defineColors is called with a p5 instance.
    // However, to be absolutely explicit that these are now set:
    // (This is more for conceptual clarity; the direct assignment in defineColors is what matters)
    return {
        C_PLAYER, C_PLAYER_PROJECTILE, C_ENEMY_DRONE, C_ENEMY_INTERCEPTOR, C_ENEMY_TURRET, C_ENEMY_PROJECTILE,
        C_OBSTACLE, C_GROUND_DETAIL, C_POWERUP_COIN, C_POWERUP_FUEL, C_POWERUP_SHIELD, C_POWERUP_WEAPON,
        C_POWERUP_SPREAD, C_POWERUP_RAPID, C_POWERUP_MULTIPLIER, C_POWERUP_MAGNET, C_POWERUP_SPEED,
        C_BOSS_TANK, C_BOSS_SHIP, C_BOSS_FINAL, C_PARTICLE_JET, C_PARTICLE_EXPLOSION, C_PARTICLE_IMPACT, C_PARTICLE_EMBER,
        C_TEXT_MAIN, C_TEXT_ACCENT, C_TEXT_SCORE, C_HUD_BG,
        C_SKY_OVERCAST, C_SKY_HORIZON, C_BUILDING_DARK, C_BUILDING_LIGHT, C_RUBBLE_DARK, C_RUBBLE_LIGHT, C_SMOKE_EFFECT, C_FIRE_GLOW_STRONG, C_FIRE_GLOW_WEAK,
        C_PILLAR_DARK, C_PILLAR_LIGHT, C_SKIN_TONE, C_MUSTACHE_COLOR, C_BLOOD_RED,
        C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK, C_BANNER_CIRCLE_WHITE,
        C_VICTORY_TEXT, C_VICTORY_SUBTEXT
    };
}
