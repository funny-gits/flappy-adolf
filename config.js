// config.js

// --- Game Configuration & Constants ---
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;

export const GROUND_Y_OFFSET = 60;

export const PLAYER_START_X = 160;
export const PLAYER_SIZE = 34;

export const GRAVITY = 0.62;
export const THRUST = -11.2;

export const INITIAL_GAME_SPEED = 5.0;
export const SPEED_RAMP_PER_SECOND = 0.10; // gentle ramp

export const OBSTACLE_SPAWN_MS = 1400;
export const OBSTACLE_GAP_MIN = 160;
export const OBSTACLE_GAP_MAX = 220;
export const OBSTACLE_WIDTH = 70;

export const COIN_SPAWN_CHANCE = 0.55;

export const MAX_HIGH_SCORES = 5;
export const LOCAL_STORAGE_PLAYER_NAME_KEY = "jetpackJumperPlayerName";
export const LOCAL_STORAGE_SCORES_KEY = "jetpackJumperHighScores_v2";

// These were referenced by your old main.js but not exported.
// Keeping them exported avoids future “undefined” surprises if you re-add Firebase later.
export const DEFAULT_APP_ID = "my-jetpack-jumper-local";
export const DEFAULT_FIREBASE_CONFIG = null;

// --- Colors (simple palette; index.html handles page styling) ---
export const COLORS = {
  bgTop: [18, 24, 28],
  bgBottom: [46, 52, 58],
  ground: [32, 38, 44],
  groundDetail: [48, 56, 64],

  player: [230, 230, 230],
  playerAccent: [120, 220, 180],

  obstacle: [120, 140, 160],
  obstacleEdge: [200, 200, 200],

  coin: [240, 210, 90],
  hudText: [235, 235, 235],
  hudShadow: [0, 0, 0],
};
