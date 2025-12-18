// FILE: config.js
// Central configuration for Jetpack Jumper / flappy-adolf.
//
// NOTE: This repo previously contained truncated/ellipsized code (e.g. `C_BUILDI...`),
// which breaks JavaScript parsing. This file is a clean, complete replacement.

// --- Game Configuration & Constants ---
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;
export const GROUND_Y_OFFSET = 50;

export const PLAYER_START_X = 100;
export const PLAYER_START_Y_OFFSET = 100;

// Player physics
export const PLAYER_W = 30;
export const PLAYER_H = 40;
export const PLAYER_GRAVITY = 0.55;
export const PLAYER_LIFT = -10.0;
export const JETPACK_FORCE_MULTIPLIER = 0.85;

export const MAX_FUEL = 150;
export const FUEL_RECHARGE_RATE = 0.4; // per frame@60 baseline (scaled by deltaTime)
export const FUEL_CONSUMPTION_RATE = 1.0; // per frame@60 baseline (scaled by deltaTime)

// Scrolling speed
export const INITIAL_GAME_SPEED = 4;
export const MAX_GAME_SPEED = 20;
export const GAME_SPEED_INCREMENT = 0.0008;

// Power-up durations (ms)
export const POWERUP_DURATION = 8000;
export const WEAPON_SYSTEM_DURATION = 12000;
export const SPREAD_SHOT_DURATION = 10000;
export const RAPID_FIRE_DURATION = 7000;
export const SCORE_MULTIPLIER_DURATION = 10000;
export const COIN_MAGNET_DURATION = 10000;
export const SPEED_BURST_DURATION = 6000;

// Spawn pacing (ms)
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

// Boss pacing
export const BOSS_SPAWN_INTERVAL_MS = 60000; // time between boss waves

// Scores / storage
export const MAX_HIGH_SCORES = 25;
export const LOCAL_STORAGE_PLAYER_NAME_KEY = "jetpack_player_name_v1";
export const LOCAL_STORAGE_HIGHSCORES_KEY = "jetpack_highscores_v1";

// Shooting
export const PLAYER_SHOOT_COOLDOWN_TIME = 240; // ms
export const TEMPORARY_WIN_MESSAGE_DURATION_MS = 4000;

// --- Types ---
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

// Enemies (string identifiers used in spawn tables)
export const ENEMY_TYPE = {
  DRONE: "DRONE",
  INTERCEPTOR: "INTERCEPTOR",
  TURRET: "TURRET",
};

// Bosses
export const BOSS_TYPE = {
  TANK: "TANK",
  SHIP: "SHIP",
  FINAL: "FINAL",
};

// --- Spawn tables (single source of truth) ---
// If something exists in code but never appears in-game, it should be added here (enabled + weight).
// Disabled entries can remain as "dead ends" safely until you flip them on.

export const ENEMY_SPAWN_TABLE = [
  { type: ENEMY_TYPE.DRONE, weight: 55, enabled: true },
  { type: ENEMY_TYPE.INTERCEPTOR, weight: 30, enabled: true },
  { type: ENEMY_TYPE.TURRET, weight: 15, enabled: true },
];

export const POWERUP_SPAWN_TABLE = [
  { type: POWERUP_TYPE.COIN, weight: 20, enabled: true },
  { type: POWERUP_TYPE.FUEL_CELL, weight: 15, enabled: true },
  { type: POWERUP_TYPE.SHIELD, weight: 15, enabled: true },
  { type: POWERUP_TYPE.WEAPON_SYSTEM, weight: 10, enabled: true },
  { type: POWERUP_TYPE.SPREAD_SHOT, weight: 10, enabled: true },
  { type: POWERUP_TYPE.RAPID_FIRE, weight: 10, enabled: true },
  { type: POWERUP_TYPE.SCORE_MULTIPLIER, weight: 7, enabled: true },
  { type: POWERUP_TYPE.COIN_MAGNET, weight: 7, enabled: true },
  { type: POWERUP_TYPE.SPEED_BURST, weight: 6, enabled: true },
];

// During bosses, bias toward survivability + DPS.
export const POWERUP_SPAWN_TABLE_DURING_BOSS = [
  { type: POWERUP_TYPE.WEAPON_SYSTEM, weight: 25, enabled: true },
  { type: POWERUP_TYPE.SHIELD, weight: 25, enabled: true },
  { type: POWERUP_TYPE.FUEL_CELL, weight: 20, enabled: true },
  { type: POWERUP_TYPE.SPREAD_SHOT, weight: 15, enabled: true },
  { type: POWERUP_TYPE.RAPID_FIRE, weight: 15, enabled: true },
];

// --- Firebase Default Config (fallback) ---
// If you want to disable Firebase entirely, set DEFAULT_FIREBASE_CONFIG = null.
export const DEFAULT_APP_ID = "my-jetpack-jumper-local";
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkQJHGHZapGD8sKggskwz4kkQRwmr_Kh0",
  authDomain: "jetpack-7ced6.firebaseapp.com",
  projectId: "jetpack-7ced6",
  storageBucket: "jetpack-7ced6.firebasestorage.app",
  messagingSenderId: "406200125563",
  appId: "1:406200125563:web:cf15d74a1ca44c97edb8a0",
};

// Optional: allow injection from the hosting page (e.g. GitHub Pages secrets via a build step)
export function getFirebaseConfig() {
  // If the page defines a config object, prefer it.
  // eslint-disable-next-line no-undef
  const injected = (typeof window !== "undefined" && window.__FIREBASE_CONFIG__) ? window.__FIREBASE_CONFIG__ : null;
  return injected || DEFAULT_FIREBASE_CONFIG;
}

// --- Colors (initialized from p5 instance in main.js) ---
export let
  C_PLAYER,
  C_PLAYER_PROJECTILE,
  C_ENEMY_DRONE,
  C_ENEMY_INTERCEPTOR,
  C_ENEMY_TURRET,
  C_ENEMY_PROJECTILE,
  C_OBSTACLE,
  C_GROUND_DETAIL,
  C_POWERUP_COIN,
  C_POWERUP_FUEL,
  C_POWERUP_SHIELD,
  C_POWERUP_WEAPON,
  C_POWERUP_SPREAD,
  C_POWERUP_RAPID,
  C_POWERUP_MULTIPLIER,
  C_POWERUP_MAGNET,
  C_POWERUP_SPEED,
  C_BOSS_TANK,
  C_BOSS_SHIP,
  C_BOSS_FINAL,
  C_PARTICLE_JET,
  C_PARTICLE_EXPLOSION,
  C_PARTICLE_IMPACT,
  C_PARTICLE_EMBER,
  C_TEXT_MAIN,
  C_TEXT_ACCENT,
  C_TEXT_SCORE,
  C_HUD_BG,
  C_SKY_OVERCAST,
  C_SKY_HORIZON,
  C_BUILDING_DARK,
  C_BUILDING_LIGHT,
  C_RUBBLE_DARK,
  C_RUBBLE_LIGHT,
  C_SMOKE_EFFECT,
  C_FIRE_GLOW_STRONG,
  C_FIRE_GLOW_WEAK,
  C_PILLAR_DARK,
  C_PILLAR_LIGHT,
  C_SKIN_TONE,
  C_MUSTACHE_COLOR,
  C_BLOOD_RED,
  C_BANNER_BG_RED,
  C_BANNER_SYMBOL_BLACK,
  C_BANNER_CIRCLE_WHITE,
  C_VICTORY_TEXT,
  C_VICTORY_SUBTEXT;

export function defineColors(p) {
  // Primary entities
  C_PLAYER = p.color(75, 83, 32);
  C_PLAYER_PROJECTILE = p.color(180, 160, 50);

  C_ENEMY_DRONE = p.color(255, 99, 71);
  C_ENEMY_INTERCEPTOR = p.color(255, 69, 0);
  C_ENEMY_TURRET = p.color(205, 92, 92);
  C_ENEMY_PROJECTILE = p.color(150, 60, 40);

  // World
  C_OBSTACLE = p.color(150, 160, 170);
  C_GROUND_DETAIL = p.color(60, 50, 45);

  // Powerups
  C_POWERUP_COIN = p.color(184, 134, 11);
  C_POWERUP_FUEL = p.color(0, 100, 100);
  C_POWERUP_SHIELD = p.color(40, 120, 50);
  C_POWERUP_WEAPON = p.color(150, 150, 40);
  C_POWERUP_SPREAD = p.color(150, 70, 0);
  C_POWERUP_RAPID = p.color(255, 140, 0);
  C_POWERUP_MULTIPLIER = p.color(200, 100, 0);
  C_POWERUP_MAGNET = p.color(100, 100, 150);
  C_POWERUP_SPEED = p.color(180, 120, 0);

  // Bosses
  C_BOSS_TANK = p.color(75, 83, 32);
  C_BOSS_SHIP = p.color(60, 70, 75);
  C_BOSS_FINAL = p.color(100, 90, 100);

  // Particles
  C_PARTICLE_JET = p.color(180, 80, 0);
  C_PARTICLE_EXPLOSION = [p.color(255, 160, 0), p.color(255, 80, 0), p.color(255, 220, 120)];
  C_PARTICLE_IMPACT = p.color(255, 200, 150);
  C_PARTICLE_EMBER = p.color(255, 120, 30);

  // UI
  C_TEXT_MAIN = p.color(240);
  C_TEXT_ACCENT = p.color(255, 215, 0);
  C_TEXT_SCORE = p.color(255);
  C_HUD_BG = p.color(0, 0, 0, 120);

  // Background palette
  C_SKY_OVERCAST = p.color(45, 55, 65);
  C_SKY_HORIZON = p.color(80, 90, 100);
  C_BUILDING_DARK = p.color(35, 35, 35);
  C_BUILDING_LIGHT = p.color(55, 50, 45);
  C_RUBBLE_DARK = p.color(40, 35, 30);
  C_RUBBLE_LIGHT = p.color(65, 55, 45);
  C_SMOKE_EFFECT = p.color(90, 90, 90, 140);
  C_FIRE_GLOW_STRONG = p.color(255, 140, 0, 200);
  C_FIRE_GLOW_WEAK = p.color(255, 140, 0, 90);

  // Character details
  C_PILLAR_DARK = p.color(70, 70, 75);
  C_PILLAR_LIGHT = p.color(95, 95, 100);
  C_SKIN_TONE = p.color(220, 180, 140);
  C_MUSTACHE_COLOR = p.color(30, 30, 30);
  C_BLOOD_RED = p.color(180, 30, 30);

  // Banner (kept abstract to avoid explicit extremist symbolism)
  C_BANNER_BG_RED = p.color(110, 0, 0);
  C_BANNER_SYMBOL_BLACK = p.color(0);
  C_BANNER_CIRCLE_WHITE = p.color(220);

  // Victory overlay
  C_VICTORY_TEXT = p.color(255, 215, 0);
  C_VICTORY_SUBTEXT = p.color(240, 240, 240);
}

// Backwards-compat: older code called this after defineColors.
export function updateExportedColors() {
  // No-op: defineColors assigns directly to exported lets.
  return true;
}
