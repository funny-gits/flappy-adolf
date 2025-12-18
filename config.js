// config.js
// Centralized, static tuning parameters for the game.
// Keep this file free of p5.js objects (colors, sounds, etc).

export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;
export const GROUND_Y_OFFSET = 70;

export const PLAYER_START_X = 80;
export const PLAYER_START_Y_OFFSET = 120;

export const GROUND_SLIDE_FRICTION = 0.92;

export const OBSTACLE_SPAWN_INTERVAL = 1900;
export const OBSTACLE_SPAWN_MIN_TIME = 1200;
export const OBSTACLE_SPAWN_MAX_TIME = 2500;

export const ENEMY_SPAWN_INTERVAL = 3100;
export const ENEMY_SPAWN_MIN_TIME = 2000;
export const ENEMY_SPAWN_MAX_TIME = 5200;

export const BOSS_SPAWN_INTERVAL = 20000;
export const BOSS_SPAWN_MIN_TIME = 16000;
export const BOSS_SPAWN_MAX_TIME = 32000;

export const BOSS_MIN_SCORE = 12;
export const ENEMY_MIN_SCORE = 2;

export const POWERUP_SPAWN_INTERVAL = 11000;

export const JETPACK_FORCE_MULTIPLIER = 1.0;

// Player shooting rate limit (ms)
export const PLAYER_SHOOT_COOLDOWN_TIME = 220;

// Hitbox scale factors
export const FIREBALL_HITBOX_SCALE = 0.55;
export const GUNSHOT_HITBOX_SCALE = 0.35;

// Powerups
export const POWERUP_TYPE = Object.freeze({
  RAPID_FIRE: "RAPID_FIRE",
  SHIELD: "SHIELD",
  SPREAD_SHOT: "SPREAD_SHOT",
  HEALTH: "HEALTH",
});

export const POWERUP_DURATION_RAPID_FIRE = 6500;
export const POWERUP_DURATION_SHIELD = 8000;
export const POWERUP_DURATION_SPREAD = 7000;

// Enemy archetypes
export const ENEMY_TYPES = Object.freeze({
  SOLDIER: "SOLDIER",
  TANK: "TANK",
  HELICOPTER: "HELICOPTER",
});

// Boss archetypes
export const BOSS_TYPES = Object.freeze({
  BLIMP: "BLIMP",
  FORTRESS: "FORTRESS",
  MECH: "MECH",
});

// Firebase hosting defaults / fallbacks.
//
// IMPORTANT: On Firebase Hosting, __firebase_config and __app_id are injected globally.
// On GitHub Pages, they are NOT present — so we must supply defaults or disable Firebase.

export const DEFAULT_APP_ID = "default-app-id";
export const DEFAULT_FIREBASE_CONFIG = Object.freeze({
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
});

export function resolveFirebaseConfig() {
  const raw = globalThis.__firebase_config;
  if (!raw) return DEFAULT_FIREBASE_CONFIG;

  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_FIREBASE_CONFIG;
    }
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function resolveAppId() {
  return globalThis.__app_id || DEFAULT_APP_ID;
}

export function resolveInitialAuthToken() {
  return globalThis.__initial_auth_token || null;
}


export function getFirebaseConfig(){
  return DEFAULT_FIREBASE_CONFIG;
}
