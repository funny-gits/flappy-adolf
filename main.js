// === Jetpack Shooter with Bosses: Enhanced Version ===

// --- Firebase SDK Imports (now using ES Module syntax) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import * as Config from "./config.js";
import * as Utils from "./utils.js";



// --- Game Configuration & Constants ---
const SCREEN_WIDTH = Config.SCREEN_WIDTH;
const SCREEN_HEIGHT = Config.SCREEN_HEIGHT;
const GROUND_Y_OFFSET = Config.GROUND_Y_OFFSET;
const PLAYER_START_X = Config.PLAYER_START_X;
const PLAYER_START_Y_OFFSET = Config.PLAYER_START_Y_OFFSET;
const JETPACK_FORCE_MULTIPLIER = Config.JETPACK_FORCE_MULTIPLIER;
const MAX_FUEL = 150;
const FUEL_RECHARGE_RATE = 0.4;
const FUEL_CONSUMPTION_RATE = 1.0;
const INITIAL_GAME_SPEED = 4;
const MAX_GAME_SPEED = 20; // Increased max speed
const GAME_SPEED_INCREMENT = 0.0008; // Significantly reduced speed increment for better playability

const POWERUP_DURATION = 8000;
const WEAPON_SYSTEM_DURATION = 12000;
const SPREAD_SHOT_DURATION = 10000; // Duration for spread shot if picked up independently
const RAPID_FIRE_DURATION = 7000; // Added for rapid fire power-up
const SCORE_MULTIPLIER_DURATION = 10000; // Added for score multiplier
const COIN_MAGNET_DURATION = 10000; // Added for coin magnet
const SPEED_BURST_DURATION = 6000; // Added for speed burst

const OBSTACLE_START_INTERVAL = 1400; // Adjusted
const OBSTACLE_MIN_INTERVAL = 600; // Increased min interval to reduce density
const OBSTACLE_INTERVAL_DECREMENT_FACTOR = 0.99;

const POWERUP_REGULAR_INTERVAL = 3200; // More frequent regular powerups
const POWERUP_REGULAR_MIN_INTERVAL = 1800;
const POWERUP_BOSS_INTERVAL = 6000;
const POWERUP_BOSS_MIN_INTERVAL = 3000;
const POWERUP_INTERVAL_DECREMENT_FACTOR = 0.975;

const ENEMY_START_INTERVAL = 4000; // Enemies appear a bit sooner
const ENEMY_MIN_INTERVAL = 2000; // Increased min interval for enemies
const ENEMY_INTERVAL_DECREMENT_FACTOR = 0.985;

const BOSS_SPAWN_INTERVAL_MS = 60000; // Time until next boss spawns after previous is defeated

// --- Scoreboard Constants ---
const MAX_HIGH_SCORES = 5; // How many high scores to display
// LOCAL_STORAGE_KEY is now only for player name, high scores are in Firestore
const LOCAL_STORAGE_PLAYER_NAME_KEY = 'jetpackJumperPlayerName';

// --- Game State Variables ---
let player;
let bgMusic;
let jumpSound;
let playerProjectileSound; // Renamed for clarity
let enemyProjectileSound; // Renamed for clarity
let objectDestroySound;
let deathSound; // death / mission failed sting
let playerProjectiles = [];
let enemyProjectiles = [];
let enemies = [];
let obstacles = [];
let powerups = [];
let particles = [];
let boss = null;
let bossApproaching = false;
let pendingBoss = null;

let activePowerups = {};
let score = 0;
let highScores = []; // Array to store multiple high scores (fetched from Firestore)
let highScore = 0; // This will now be the highest score loaded from Firestore

let coinsCollectedThisRun = 0;
let scoreMultiplier = 1; // Added for score multiplier power-up

let jetpackFuel = MAX_FUEL;
let gameSpeed = INITIAL_GAME_SPEED;
let baseGameSpeed = INITIAL_GAME_SPEED; // Base speed, affected by speed burst
let playerIsFlying = false;
let playerCanShoot = true; // Added for manual shooting cooldown
let playerShootCooldown = 0;
const PLAYER_SHOOT_COOLDOWN_TIME = Config.PLAYER_SHOOT_COOLDOWN_TIME; // Cooldown for manual shooting

window.currentScreen = "START"; // Manages which screen is displayed
let gamePaused = false;
let gameWin = false; // New: Flag for game win condition

let lastObstacleTime = 0;
let lastPowerupTime = 0;
let lastEnemySpawnTime = 0;
let enemySpawnInterval = ENEMY_START_INTERVAL;
let obstacleInterval = OBSTACLE_START_INTERVAL;
let powerupInterval = POWERUP_REGULAR_INTERVAL;

let weaponSystemActive = false;
let weaponSystemTimeLeft = 0; // Renamed for clarity
let currentWeaponMode = "STANDARD"; // 'STANDARD', 'SPREAD'
let weaponSystemShootTimer = 0; // Timer for weapon system auto-fire

let distanceTraveled = 0;
let bossCount = 0;
let bossCycle = 0; // Tracks how many times bosses have been defeated (all 3 unique bosses)
let timeUntilNextBoss = BOSS_SPAWN_INTERVAL_MS; // New: Timer for boss spawning

let gameStartTime = 0; // To track elapsed game time
let gameElapsedTime = 0;

// --- Player Name Variable ---
window.playerName = "Player"; // Default player name, exposed to window

// --- Flag for Scoreboard Display ---
let scoreboardDisplayedAfterGameOver = false;
let deathSoundPlayed = false;

// --- Firebase Variables (Moved to global scope) ---
let db;
let auth;
let userId = "anonymous"; // Default anonymous user ID
let isAuthReady = false; // Flag to ensure Firebase auth is ready before Firestore operations

// --- Firebase Configuration (Moved to global scope) ---
// IMPORTANT: Replace these placeholder values with your actual Firebase project settings.
// You can find these in your Firebase Console under Project settings > Your apps.
const DEFAULT_APP_ID = Config.DEFAULT_APP_ID; // A unique identifier for your app/game (can be anything)
const DEFAULT_FIREBASE_CONFIG = Config.DEFAULT_FIREBASE_CONFIG;

// Determine which config to use: provided by environment or default
const appId = typeof __app_id !== 'undefined' ? __app_id : DEFAULT_APP_ID;
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : DEFAULT_FIREBASE_CONFIG;


// --- Power-up Types Enum ---
const POWERUP_TYPE = Config.POWERUP_TYPE;

// --- Colors ---
let C_PLAYER,
  C_PLAYER_PROJECTILE,
  C_ENEMY_DRONE,
  C_ENEMY_INTERCEPTOR,
  C_ENEMY_TURRET,
  C_ENEMY_PROJECTILE;
let C_OBSTACLE,
  C_GROUND_DETAIL,
  C_POWERUP_COIN,
  C_POWERUP_FUEL,
  C_POWERUP_SHIELD,
  C_POWERUP_WEAPON,
  C_POWERUP_SPREAD,
  C_POWERUP_RAPID, // New
  C_POWERUP_MULTIPLIER, // New
  C_POWERUP_MAGNET, // New
  C_POWERUP_SPEED; // New
let C_BOSS_TANK,
  C_BOSS_SHIP,
  C_BOSS_FINAL,
  C_PARTICLE_JET,
  C_PARTICLE_EXPLOSION,
  C_PARTICLE_IMPACT,
  C_PARTICLE_EMBER; // New
let C_TEXT_MAIN, C_TEXT_ACCENT, C_TEXT_SCORE, C_HUD_BG, C_SKY_TOP, C_SKY_BOTTOM;
let C_DISTANT_PLANET1, C_DISTANT_PLANET2, C_NEBULA;
let C_SKY_OVERCAST, C_SKY_HORIZON, C_BUILDING_DARK, C_BUILDING_LIGHT, C_RUBBLE_DARK, C_RUBBLE_LIGHT, C_SMOKE_EFFECT, C_FIRE_GLOW_STRONG, C_FIRE_GLOW_WEAK; // New background colors
let C_PILLAR_DARK, C_PILLAR_LIGHT; // New
let C_SKIN_TONE, C_MUSTACHE_COLOR; // New for player details
let C_BLOOD_RED; // New
let C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK, C_BANNER_CIRCLE_WHITE; // New for banner

// Global function for drawing faux banner
function drawFauxBanner(x, y, w, h, fillCol, strokeCol) {
  Utils.drawFauxBanner(x, y, w, h, fillCol, strokeCol);
}


function defineColors() {
  // --- PLAYER & PROJECTILES (Player color and gun/helmet kept as requested) ---
  C_PLAYER = color(75, 83, 32); // Olive Drab for uniform
  C_PLAYER_PROJECTILE = color(180, 160, 50); // Muted yellow/orange for tracer fire
  C_ENEMY_DRONE = color(80, 85, 90); // Darker grey for enemy
  C_ENEMY_INTERCEPTOR = color(60, 70, 75); // Even darker, stealthier grey
  C_ENEMY_TURRET = color(90, 85, 80); // Muted brown-grey for turret
  C_ENEMY_PROJECTILE = color(150, 60, 40); // Darker orange-red for enemy fire

  // --- OBSTACLES ---
  C_OBSTACLE = color(150, 160, 170); // Light grey for concrete/rubble
  C_GROUND_DETAIL = color(60, 50, 45); // Dark earthy brown for ground details

  // --- POWER-UPS (Keep distinct for visibility) ---
  C_POWERUP_COIN = color(184, 134, 11); // Darker gold
  C_POWERUP_FUEL = color(0, 100, 100); // Darker teal for fuel
  C_POWERUP_SHIELD = color(40, 120, 50); // Darker green for shield
  C_POWERUP_WEAPON = color(150, 150, 40); // Muted yellow for weapon
  C_POWERUP_SPREAD = color(150, 70, 0); // Muted orange for spread shot
  C_POWERUP_RAPID = color(255, 140, 0); // Darker orange for rapid fire
  C_POWERUP_MULTIPLIER = color(200, 100, 0); // Muted orange for score multiplier
  C_POWERUP_MAGNET = color(100, 100, 150); // Muted blue-grey for magnet
  C_POWERUP_SPEED = color(180, 120, 0); // Muted yellow-orange for speed

  // --- BOSSES ---
  C_BOSS_TANK = color(75, 83, 32); // Olive Drab like player
  C_BOSS_SHIP = color(60, 70, 75); // Dark grey like interceptor
  C_BOSS_FINAL = color(100, 90, 100); // Muted purple-grey for final boss

  // --- PARTICLES ---
  C_PARTICLE_JET = color(180, 80, 0); // Darker orange-red for jet exhaust
  C_PARTICLE_EXPLOSION = [
    color(150, 40, 0), // Muted dark red
    color(120, 80, 0), // Muted dark orange
    color(100, 100, 20), // Muted dark yellow
    color(80, 80, 80), // Dark grey smoke
  ];
  C_PARTICLE_IMPACT = color(100, 100, 100, 180); // Dark grey smoke/dust on impact
  C_PARTICLE_EMBER = color(255, 100, 0, 150); // Glowing embers

  // --- TEXT & HUD ---
  C_TEXT_MAIN = color(220); // Off-white
  C_TEXT_ACCENT = color(180, 160, 50); // Muted yellow/khaki
  C_TEXT_SCORE = color(200, 200, 100); // Light yellow for score
  C_HUD_BG = color(20, 20, 20, 180); // Very dark, semi-transparent HUD background

  // --- BACKGROUND (WW2 Vibes) ---
  C_SKY_OVERCAST = color(60, 70, 80); // Dark, stormy grey
  C_SKY_HORIZON = color(80, 90, 100); // Lighter, hazy grey-blue horizon
  C_BUILDING_DARK = color(35, 35, 35); // Very dark grey for distant buildings
  C_BUILDING_LIGHT = color(55, 50, 45); // Lighter brown-grey for distant buildings
  C_RUBBLE_DARK = color(45, 40, 35); // Dark brown-grey for rubble
  C_RUBBLE_LIGHT = color(65, 60, 55); // Lighter brown-grey for rubble
  C_SMOKE_EFFECT = color(70, 70, 70, 50); // Semi-transparent grey for smoke
  C_FIRE_GLOW_STRONG = color(255, 100, 0, 30); // Strong orange glow for fires
  C_FIRE_GLOW_WEAK = color(200, 150, 0, 20); // Weaker yellow glow for fires

  C_PILLAR_DARK = color(50, 55, 60); // Dark grey for pillars
  C_PILLAR_LIGHT = color(70, 75, 80); // Lighter grey for pillars

  C_SKIN_TONE = color(200, 160, 120); // Skin tone
  C_MUSTACHE_COLOR = color(30, 30, 30); // Mustache color
  C_BLOOD_RED = color(180, 30, 30); // Blood red for game over/damage

  C_BANNER_BG_RED = color(110, 0, 0); // Dark red for banner background
  C_BANNER_SYMBOL_BLACK = color(0); // Black for symbol
  C_BANNER_CIRCLE_WHITE = color(220); // Off-white for circle
}


// Assign preload to the window object for p5.js to find it


// --- Deterministic per-instance RNG (prevents render flicker) ---
// IMPORTANT: Do not call p5 `random()` inside `show()` methods; it causes frame-to-frame flashing.
// We generate instance-specific details once (seeded), then render them deterministically.
function makeRng(seed) {
  let t = (seed >>> 0) || 0x12345678;
  return function() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function rngRange(rng, a, b) { return a + (b - a) * rng(); }
function rngInt(rng, a, b) { return Math.floor(rngRange(rng, a, b + 1)); }
function rngBool(rng, p = 0.5) { return rng() < p; }
function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
window.preload = function() {
  bgMusic = loadSound('assets/background_music.mp3');
  jumpSound = loadSound('assets/jump.mp3');
  playerProjectileSound = loadSound('assets/player_projectile.mp3'); // Renamed
  enemyProjectileSound = loadSound('assets/projectile.mp3'); // Renamed
  objectDestroySound = loadSound('assets/object_destroy.mp3');
  deathSound = loadSound('assets/death.mp3');

  bgMusic.setVolume(0.4);
  bgMusic.setLoop(true);
  jumpSound.setVolume(0.7);
  playerProjectileSound.setVolume(0.6);
  enemyProjectileSound.setVolume(0.6);
  objectDestroySound.setVolume(0.9);
  deathSound.setVolume(0.9);
  jumpSound.setLoop(false);
  playerProjectileSound.setLoop(false);
  enemyProjectileSound.setLoop(false);
  objectDestroySound.setLoop(false);
  deathSound.setLoop(false);
}

// --- Background Element Class ---

class BackgroundElement {
  constructor(x, y, w, h, type, speedFactor, color1, color2 = null) {
    this.initialX = x;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
    this.speedFactor = speedFactor;
    this.color1 = color1;
    this.color2 = color2 || color1;

    // Per-instance seed. Used ONLY for precomputing details (no flicker).
    this.seed = Math.floor(random(1e9));
    this._reseed(this.seed);
    this._buildTypeDetails();
  }

  _reseed(seed) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.noiseOffsetX = rngRange(this.rng, 0, 1000);
    this.noiseOffsetY = rngRange(this.rng, 0, 1000);
    this.wreckRotation = rngRange(this.rng, -0.15, 0.15);
    this.emberPhase = rngRange(this.rng, 0, 1000);
  }

  resetFromRight() {
    // New element instance data
    this._reseed(Math.floor(random(1e9)));
    this.x = SCREEN_WIDTH + rngRange(this.rng, 100, 300);

    // Re-roll dimensions based on type (but deterministically from this.rng)
    if (this.type === 'building') {
      this.h = rngRange(this.rng, SCREEN_HEIGHT * 0.42, SCREEN_HEIGHT * 0.72);
      this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
      this.w = rngRange(this.rng, 90, 170);
    } else if (this.type === 'pillar') {
      this.h = rngRange(this.rng, SCREEN_HEIGHT * 0.28, SCREEN_HEIGHT * 0.60);
      this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
      this.w = rngRange(this.rng, 28, 60);
    } else if (this.type === 'rubble') {
      this.h = rngRange(this.rng, 18, 48);
      this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
      this.w = rngRange(this.rng, 50, 100);
    } else if (this.type === 'static_wreck') {
      this.w = rngRange(this.rng, 80, 125);
      this.h = rngRange(this.rng, 40, 65);
      this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h + rngRange(this.rng, 0, 10);
      this.wreckRotation = rngRange(this.rng, -0.1, 0.1);
    } else if (this.type === 'banner_pole') {
      this.w = rngRange(this.rng, 42, 70);
      this.h = rngRange(this.rng, 70, 115);
      this.y = rngRange(this.rng, SCREEN_HEIGHT * 0.12, SCREEN_HEIGHT * 0.32);
    }

    this._buildTypeDetails();
  }

  update() {
    this.x -= gameSpeed * this.speedFactor * (deltaTime / (1000 / 60));

    if (this.x + this.w < -120) {
      this.resetFromRight();
    }
  }

  _buildTypeDetails() {
    const r = this.rng;

    if (this.type === 'building') {
      // Roof silhouette profile (11 points) and small "broken edge" offsets.
      this.roofProfile = Array.from({ length: 11 }, () => rngRange(r, 0.02, 0.18));
      this.edgeJitterL = rngRange(r, 4, 14);
      this.edgeJitterR = rngRange(r, 4, 14);

      // Window grid
      const cols = rngInt(r, 3, 6);
      const rows = rngInt(r, 5, 11);
      this.windowGrid = { cols, rows, cells: [] };

      for (let ry = 0; ry < rows; ry++) {
        for (let cx = 0; cx < cols; cx++) {
          const u = rngRange(r, 0, 1);
          // 0=dark, 1=lit, 2=broken
          const state = (u < 0.18) ? 2 : (u < 0.55 ? 0 : 1);
          this.windowGrid.cells.push({
            state,
            // per-window crack orientation if broken
            crackA: rngRange(r, -0.8, 0.8),
            crackB: rngRange(r, -0.8, 0.8),
          });
        }
      }

      // Damage patches + crack lines
      const spotCount = rngInt(r, 2, 5);
      this.damageSpots = [];
      for (let i = 0; i < spotCount; i++) {
        const sx = rngRange(r, this.w * 0.08, this.w * 0.78);
        const sy = rngRange(r, this.h * 0.12, this.h * 0.82);
        const sw = rngRange(r, this.w * 0.14, this.w * 0.32);
        const sh = rngRange(r, this.h * 0.10, this.h * 0.22);

        const crackCount = rngInt(r, 1, 3);
        const cracks = [];
        for (let k = 0; k < crackCount; k++) {
          const x1 = sx + rngRange(r, sw * 0.10, sw * 0.35);
          const y1 = sy + rngRange(r, sh * 0.10, sh * 0.35);
          const x2 = sx + sw - rngRange(r, sw * 0.10, sw * 0.35);
          const y2 = sy + sh - rngRange(r, sh * 0.10, sh * 0.35);
          cracks.push({ x1, y1, x2, y2, w: rngRange(r, 1, 2) });
        }
        this.damageSpots.push({
          x: sx, y: sy, w: sw, h: sh,
          alpha: rngRange(r, 50, 110),
          cracks,
        });
      }

      // Optional banner (fictional) + pole attachment
      this.hasBanner = rngBool(r, 0.33);
      if (this.hasBanner) {
        const bw = rngRange(r, this.w * 0.42, this.w * 0.72);
        const bh = rngRange(r, this.h * 0.18, this.h * 0.28);
        const bx = rngRange(r, this.w * 0.12, this.w * 0.22);
        const by = rngRange(r, this.h * 0.10, this.h * 0.24);
        this.banner = { x: bx, y: by, w: bw, h: bh, wavePhase: rngRange(r, 0, TWO_PI) };
      } else {
        this.banner = null;
      }

      // Optional fire / glow (gentle, noise-driven — no flashing)
      this.hasFire = rngBool(r, 0.28);
      if (this.hasFire) {
        this.fire = {
          x: rngRange(r, this.w * 0.25, this.w * 0.75),
          y: -rngRange(r, 10, 28),
          s: rngRange(r, 0.65, 1.15),
          phase: rngRange(r, 0, 1000),
        };
      } else {
        this.fire = null;
      }

      // Embers positions (stable, bob with sine)
      const emberCount = rngInt(r, 3, 7);
      this.embers = Array.from({ length: emberCount }, () => ({
        x: rngRange(r, 0.10, 0.90),
        y: rngRange(r, 0.45, 0.98),
        s: rngRange(r, 2, 5),
        phase: rngRange(r, 0, TWO_PI),
      }));
    }

    if (this.type === 'pillar') {
      // Rivets + stripes + cracks
      const stripeCount = rngInt(r, 1, 3);
      this.pillarStripes = Array.from({ length: stripeCount }, () => ({
        y: rngRange(r, 0.12, 0.88),
        h: rngRange(r, 3, 6),
      }));
      const crackCount = rngInt(r, 1, 3);
      this.pillarCracks = Array.from({ length: crackCount }, () => ({
        x1: rngRange(r, this.w * 0.15, this.w * 0.85),
        y1: rngRange(r, this.h * 0.10, this.h * 0.90),
        x2: rngRange(r, this.w * 0.15, this.w * 0.85),
        y2: rngRange(r, this.h * 0.10, this.h * 0.90),
      }));
      this.pillarRivets = Array.from({ length: rngInt(r, 5, 10) }, () => ({
        x: rngRange(r, this.w * 0.18, this.w * 0.82),
        y: rngRange(r, this.h * 0.12, this.h * 0.88),
        s: rngRange(r, 2.2, 3.8),
      }));
    }

    if (this.type === 'rubble') {
      const blockCount = rngInt(r, 3, 7);
      this.rubbleBlocks = Array.from({ length: blockCount }, () => ({
        x: rngRange(r, 0.05, 0.90),
        y: rngRange(r, 0.30, 0.92),
        w: rngRange(r, 0.10, 0.34),
        h: rngRange(r, 0.18, 0.42),
        shade: rngRange(r, 0.05, 0.25),
      }));

      // silhouette polygon
      const pts = [];
      const pCount = rngInt(r, 5, 8);
      for (let i = 0; i < pCount; i++) {
        const t = i / (pCount - 1);
        pts.push({
          x: t,
          y: rngRange(r, 0.20, 0.75),
        });
      }
      this.rubblePoly = pts;

      const emberCount = rngInt(r, 2, 6);
      this.embers = Array.from({ length: emberCount }, () => ({
        x: rngRange(r, 0.10, 0.90),
        y: rngRange(r, 0.10, 0.80),
        s: rngRange(r, 2, 4),
        phase: rngRange(r, 0, TWO_PI),
      }));
    }

    if (this.type === 'static_wreck') {
      // Stable wreck tint
      this.wreckColor = rngBool(r, 0.5) ? C_ENEMY_DRONE : C_BOSS_TANK;
      this.wheelXs = Array.from({ length: rngInt(r, 4, 6) }, (_, i, arr) => {
        if (arr.length === 1) return 0;
        return -this.w * 0.35 + (this.w * 0.70) * (i / (arr.length - 1));
      });
      this.smokePuffs = Array.from({ length: rngInt(r, 1, 2) }, () => ({
        x: rngRange(r, -0.15, 0.15),
        y: rngRange(r, -0.35, -0.05),
        phase: rngRange(r, 0, 1000),
      }));
    }

    if (this.type === 'banner_pole') {
      this.bannerWavePhase = rngRange(r, 0, TWO_PI);
    }
  }

  show() {
    noStroke();

    if (this.type === 'building') {
      // base block
      fill(this.color1);
      rect(this.x, this.y, this.w, this.h);

      // roof profile
      fill(this.color1);
      beginShape();
      vertex(this.x, this.y);
      for (let i = 0; i <= 10; i++) {
        const stepX = this.x + (this.w / 10) * i;
        const amp = this.roofProfile[i] * this.h;
        const stepY = this.y - noise(this.noiseOffsetX + i * 0.3) * amp;
        vertex(stepX, stepY);
      }
      vertex(this.x + this.w, this.y);
      // stable broken edges
      vertex(this.x + this.w, this.y + this.edgeJitterR);
      vertex(this.x, this.y + this.edgeJitterL);
      endShape(CLOSE);

      // windows
      const g = this.windowGrid;
      const padX = this.w * 0.10;
      const padY = this.h * 0.10;
      const usableW = this.w - padX * 2;
      const usableH = this.h - padY * 1.3;
      const cellW = usableW / g.cols;
      const cellH = usableH / g.rows;

      for (let ry = 0; ry < g.rows; ry++) {
        for (let cx = 0; cx < g.cols; cx++) {
          const idx = ry * g.cols + cx;
          const cell = g.cells[idx];
          const wx = this.x + padX + cx * cellW + cellW * 0.15;
          const wy = this.y + padY + ry * cellH + cellH * 0.18;
          const ww = cellW * 0.70;
          const wh = cellH * 0.62;

          if (cell.state === 1) {
            // lit window: warm, subtle glow
            const glow = 35 + noise(this.noiseOffsetY + idx * 0.3 + frameCount * 0.02) * 55;
            fill(210, 180, 90, glow);
            rect(wx - 2, wy - 2, ww + 4, wh + 4, 2);
            fill(235, 210, 120, 180);
            rect(wx, wy, ww, wh, 2);
          } else if (cell.state === 2) {
            // broken: dark with cracks
            fill(20, 20, 20, 190);
            rect(wx, wy, ww, wh, 2);
            stroke(C_PILLAR_DARK);
            strokeWeight(1);
            line(wx + ww * 0.15, wy + wh * 0.25, wx + ww * 0.85, wy + wh * 0.65);
            line(wx + ww * 0.25, wy + wh * 0.75, wx + ww * 0.70, wy + wh * 0.20);
            noStroke();
          } else {
            // unlit
            fill(0, 0, 0, 120);
            rect(wx, wy, ww, wh, 2);
          }
        }
      }

      // damage patches
      for (const s of this.damageSpots) {
        fill(this.color2.levels[0], this.color2.levels[1], this.color2.levels[2], s.alpha);
        rect(this.x + s.x, this.y + s.y, s.w, s.h, 2);

        stroke(C_PILLAR_DARK);
        for (const c of s.cracks) {
          strokeWeight(c.w);
          line(this.x + c.x1, this.y + c.y1, this.x + c.x2, this.y + c.y2);
        }
        noStroke();
      }

      // fictional banner (optional), with gentle cloth wave
      if (this.banner) {
        push();
        const bw = this.banner.w;
        const bh = this.banner.h;
        const bx = this.x + this.banner.x;
        const by = this.y + this.banner.y;

        // tiny wave without random
        const wave = Math.sin(frameCount * 0.03 + this.banner.wavePhase) * 2;
        translate(0, wave);
        drawFauxBanner(bx, by, bw, bh, C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK);
        pop();
      }

      // fire / glow (optional, gentle)
      if (this.fire) {
        const flick = noise(this.noiseOffsetY + this.fire.phase + frameCount * 0.03); // 0..1
        const gx = this.x + this.fire.x;
        const gy = this.y + this.fire.y;

        // glow layers
        noStroke();
        for (let i = 0; i < 4; i++) {
          const t = i / 3;
          const a = 18 + (1 - t) * (35 + flick * 35);
          fill(C_FIRE_GLOW_WEAK.levels[0], C_FIRE_GLOW_WEAK.levels[1], C_FIRE_GLOW_WEAK.levels[2], a);
          const ew = this.w * (0.25 + t * 0.25) * this.fire.s;
          const eh = this.h * (0.10 + t * 0.10) * this.fire.s;
          ellipse(gx, gy, ew, eh);
        }

        // flame tongues
        for (let i = 0; i < 3; i++) {
          const phase = this.fire.phase + i * 3.1;
          const sway = (noise(phase + frameCount * 0.02) - 0.5) * 10;
          const rise = 10 + noise(phase + frameCount * 0.03) * 16;
          const fw = this.w * 0.09 * (0.9 + flick * 0.5) * this.fire.s;
          const fh = this.h * 0.14 * (0.8 + flick * 0.6) * this.fire.s;

          fill(255, 140, 0, 120);
          ellipse(gx + sway, gy - rise, fw * 1.4, fh * 1.1);
          fill(255, 210, 120, 120);
          ellipse(gx + sway * 0.7, gy - rise - 6, fw * 0.9, fh * 0.85);
        }
      }

      // embers (stable points)
      if (this.embers && this.embers.length) {
        for (const e of this.embers) {
          const px = this.x + e.x * this.w;
          const py = this.y + e.y * this.h;
          const bob = Math.sin(frameCount * 0.05 + e.phase + this.emberPhase) * 2;
          const a = 90 + noise(this.noiseOffsetX + e.x * 10 + frameCount * 0.03) * 140;
          fill(C_PARTICLE_EMBER.levels[0], C_PARTICLE_EMBER.levels[1], C_PARTICLE_EMBER.levels[2], a);
          ellipse(px, py + bob, e.s, e.s);
        }
      }
      return;
    }

    if (this.type === 'pillar') {
      fill(this.color1);
      rect(this.x, this.y, this.w, this.h, 2);

      // stripes
      fill(this.color2);
      for (const s of this.pillarStripes || []) {
        rect(this.x, this.y + this.h * s.y, this.w, s.h, 1);
      }

      // cracks
      stroke(this.color2);
      strokeWeight(1.4);
      for (const c of this.pillarCracks || []) {
        line(this.x + c.x1, this.y + c.y1, this.x + c.x2, this.y + c.y2);
      }
      noStroke();

      // rivets
      fill(0, 0, 0, 60);
      for (const rv of this.pillarRivets || []) {
        ellipse(this.x + rv.x, this.y + rv.y, rv.s, rv.s);
      }
      return;
    }

    if (this.type === 'rubble') {
      // silhouette
      fill(this.color1);
      beginShape();
      vertex(this.x, this.y + this.h);
      for (const pt of this.rubblePoly || []) {
        vertex(this.x + pt.x * this.w, this.y + pt.y * this.h);
      }
      vertex(this.x + this.w, this.y + this.h);
      endShape(CLOSE);

      // blocks
      for (const b of this.rubbleBlocks || []) {
        const shade = b.shade;
        const col = lerpColor(this.color1, color(0), shade);
        fill(col);
        rect(this.x + b.x * this.w, this.y + b.y * this.h, b.w * this.w, b.h * this.h, 2);
      }

      // embers
      if (this.embers && this.embers.length) {
        for (const e of this.embers) {
          const px = this.x + e.x * this.w;
          const py = this.y + e.y * this.h;
          const bob = Math.sin(frameCount * 0.06 + e.phase + this.emberPhase) * 1.5;
          const a = 70 + noise(this.noiseOffsetY + e.x * 10 + frameCount * 0.03) * 120;
          fill(C_PARTICLE_EMBER.levels[0], C_PARTICLE_EMBER.levels[1], C_PARTICLE_EMBER.levels[2], a);
          ellipse(px, py + bob, e.s, e.s);
        }
      }
      return;
    }

    if (this.type === 'static_wreck') {
      push();
      translate(this.x + this.w / 2, this.y + this.h / 2);
      rotate(this.wreckRotation);

      const tankColor = this.wreckColor || C_BOSS_TANK;
      noStroke();
      fill(tankColor);

      // hull
      rect(-this.w / 2, -this.h / 2 + this.h * 0.12, this.w, this.h * 0.70, 3);
      // turret
      rect(-this.w * 0.22, -this.h / 2 - this.h * 0.18, this.w * 0.46, this.h * 0.36, 2);
      // barrel
      rect(this.w * 0.05, -this.h / 2 - this.h * 0.10, this.w * 0.55, this.h * 0.12, 2);

      // tracks
      fill(lerpColor(tankColor, color(0), 0.35));
      rect(-this.w/2, this.h/2 - this.h*0.22, this.w, this.h*0.28, 3);

      // wheels
      fill(lerpColor(tankColor, color(0), 0.25));
      for (const wx of this.wheelXs || []) {
        ellipse(wx, this.h/2 - this.h*0.08, this.w*0.12, this.w*0.12);
      }

      // smoke puffs (subtle)
      for (const sp of this.smokePuffs || []) {
        const flick = noise(sp.phase + frameCount * 0.02);
        fill(C_SMOKE_EFFECT.levels[0], C_SMOKE_EFFECT.levels[1], C_SMOKE_EFFECT.levels[2], 60 + flick * 60);
        ellipse(sp.x * this.w, sp.y * this.h - flick * 8, this.w * 0.22, this.w * 0.16);
      }

      pop();
      return;
    }

    if (this.type === 'banner_pole') {
      fill(C_PILLAR_DARK);
      rect(this.x - 3, this.y - 10, 6, this.h + 20, 1);

      // Wave the cloth a tiny bit so it feels alive, but no flashing.
      push();
      const wave = Math.sin(frameCount * 0.03 + (this.bannerWavePhase || 0)) * 2;
      translate(0, wave);
      drawFauxBanner(this.x, this.y, this.w, this.h, C_BANNER_BG_RED, C_BANNER_SYMBOL_BLACK);
      pop();
      return;
    }
  }
}

let backgroundElements = []; 
let smokeParticles = []; 
let bgOffset1 = 0;


window.setup = function() {
  console.log("p5.js setup() called!");
  let canvas = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);

  // Mobile-friendly: prevent scrolling/zoom on the canvas and support tap controls.
  try {
    if (canvas && canvas.elt) {
      canvas.elt.style.touchAction = "none";
      canvas.elt.addEventListener("pointerdown", onCanvasPointerDown, { passive: false });
      canvas.elt.addEventListener("pointerup", onCanvasPointerUp, { passive: false });
      canvas.elt.addEventListener("pointercancel", onCanvasPointerUp, { passive: false });
      canvas.elt.addEventListener("pointerleave", onCanvasPointerUp, { passive: false });
    }
  } catch (_) {}

  // Expose a user-gesture hook so index.html can resume WebAudio without warnings.
  window.userGestureStartAudio = window.userGestureStartAudio || function () {
    try {
      if (typeof userStartAudio === "function") userStartAudio();
    } catch (_) {}
    try {
      if (bgMusic && bgMusic.isLoaded && bgMusic.isLoaded() && !bgMusic.isPlaying()) {
        bgMusic.setVolume(0.3);
        bgMusic.loop();
      }
    } catch (_) {}
  };

  canvas.parent('game-container');
  // Scale the canvas to fit its container (internal resolution stays fixed)
  try {
    canvas.style('width', '100%');
    canvas.style('height', '100%');
  } catch (_) {}

  pixelDensity(1);
  defineColors();
  textFont('Oswald'); 
  noiseSeed(Date.now()); 
  resetGame();
  window.currentScreen = "START";

  try {
    const app = (firebaseConfig && typeof firebaseConfig === "object" && firebaseConfig.apiKey) ? initializeApp(firebaseConfig) : null;
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        console.log("Firebase: User signed in with UID:", userId);
      } else {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
          if (auth.currentUser) {
            userId = auth.currentUser.uid;
            console.log("Firebase: Signed in. UID:", userId);
          } else {
            console.error("Firebase: auth.currentUser is null after sign-in attempts.");
            userId = crypto.randomUUID(); 
            console.warn("Firebase: Falling back to random UUID for userId:", userId);
          }
        } catch (error) {
          console.error("Firebase: Authentication failed:", error);
          userId = crypto.randomUUID(); 
          console.warn("Firebase: Falling back to random UUID for userId:", userId);
        }
      }
      isAuthReady = true;
      if (typeof window.loadHighScores === 'function') window.loadHighScores();
      if (typeof window.loadPlayerName === 'function') window.loadPlayerName();

      if (typeof window.showNameInput === 'function') {
          window.showNameInput(true); 
      } else {
          console.error("DEBUG: window.showNameInput is not defined!");
      }
    });
  } catch (e) {
      console.error("Firebase initialization error:", e);
      isAuthReady = false; 
      if (typeof window.loadPlayerName === 'function') window.loadPlayerName(); 
       if (typeof window.showNameInput === 'function') window.showNameInput(true);
  }


  if (bgMusic && bgMusic.isLoaded()) {
    bgMusic.loop();
  } else if (bgMusic) {
    bgMusic.onended(() => { if(window.currentScreen === "GAME") bgMusic.loop(); }); 
  }
}


window.resetGameValues = function() {
  console.log("resetGameValues called!");
  player = new Player();
  playerProjectiles = [];
  enemyProjectiles = [];
  obstacles = [];
  powerups = [];
  particles = [];
  enemies = [];
  boss = null;
  bossApproaching = false;
  pendingBoss = null;

  weaponSystemActive = false;
  currentWeaponMode = "STANDARD";
  weaponSystemShootTimer = 0; // Reset weapon system timer
  activePowerups = {};
  scoreMultiplier = 1;

  jetpackFuel = MAX_FUEL;
  gameSpeed = INITIAL_GAME_SPEED;
  baseGameSpeed = INITIAL_GAME_SPEED;
  score = 0;
  coinsCollectedThisRun = 0;
  distanceTraveled = 0;
  bossCount = 0;
  bossCycle = 0; // Reset boss cycle
  if(player) player.shieldCharges = 0; // Ensure shield charges are reset

  timeUntilNextBoss = BOSS_SPAWN_INTERVAL_MS; // Reset boss timer
  obstacleInterval = OBSTACLE_START_INTERVAL;
  powerupInterval = POWERUP_REGULAR_INTERVAL;
  enemySpawnInterval = ENEMY_START_INTERVAL;

  gameStartTime = millis();
  gameElapsedTime = 0;
  
  scoreboardDisplayedAfterGameOver = false;
  deathSoundPlayed = false;
  gameWin = false; // Reset game win flag

  backgroundElements = []; 
  smokeParticles = []; 
  bgOffset1 = 0;

  for (let i = 0; i < 6; i++) { 
      let bX = random(SCREEN_WIDTH * 0.1, SCREEN_WIDTH * 1.8) + i * (SCREEN_WIDTH / 3.5); 
      let bH = random(SCREEN_HEIGHT * 0.4, SCREEN_HEIGHT * 0.7); // Use tighter range
      let bY = SCREEN_HEIGHT - GROUND_Y_OFFSET - bH;
      let bW = random(80, 160); // Use tighter range
      backgroundElements.push(new BackgroundElement(bX, bY, bW, bH, 'building', 0.15, C_BUILDING_DARK, C_BUILDING_LIGHT));
  }

  for (let i = 0; i < 8; i++) { 
      let pX = random(SCREEN_WIDTH * 0.1, SCREEN_WIDTH * 1.5) + i * (SCREEN_WIDTH / 4);
      let pH = random(SCREEN_HEIGHT * 0.25, SCREEN_HEIGHT * 0.55);
      let pY = SCREEN_HEIGHT - GROUND_Y_OFFSET - pH;
      let pW = random(25, 55);
      backgroundElements.push(new BackgroundElement(pX, pY, pW, pH, 'pillar', 0.3, C_PILLAR_DARK, C_PILLAR_LIGHT));
  }
  
  for (let i = 0; i < 4; i++) { 
      let wX = random(SCREEN_WIDTH * 0.2, SCREEN_WIDTH * 1.8) + i * (SCREEN_WIDTH / 2);
      let wW = random(70, 110);
      let wH = random(35, 55);
      let wY = SCREEN_HEIGHT - GROUND_Y_OFFSET - wH + random(0,10); 
      backgroundElements.push(new BackgroundElement(wX, wY, wW, wH, 'static_wreck', 0.35, C_ENEMY_DRONE)); 
  }

  for (let i = 0; i < 20; i++) { 
      let rX = random(SCREEN_WIDTH * 0.05, SCREEN_WIDTH * 1.2) + i * (SCREEN_WIDTH / 6);
      let rH = random(15, 45);
      let rY = SCREEN_HEIGHT - GROUND_Y_OFFSET - rH;
      let rW = random(40, 90);
      backgroundElements.push(new BackgroundElement(rX, rY, rW, rH, 'rubble', 0.5, C_RUBBLE_DARK, C_RUBBLE_LIGHT));
  }
  
  for (let i = 0; i < 2; i++) {
      let bannerX = random(SCREEN_WIDTH * 0.5, SCREEN_WIDTH * 2.0) + i * (SCREEN_WIDTH / 1.5);
      let bannerActualH = random(60,100); 
      let bannerClothY = random(SCREEN_HEIGHT*0.15, SCREEN_HEIGHT*0.4);
      let bannerW = random(40, 60);
      backgroundElements.push(new BackgroundElement(bannerX, bannerClothY, bannerW, bannerActualH, 'banner_pole', 0.25, C_PILLAR_DARK));
  }

  for (let i = 0; i < 15; i++) { 
    smokeParticles.push(new Particle(
        random(SCREEN_WIDTH), random(SCREEN_HEIGHT * 0.05, SCREEN_HEIGHT * 0.4), // Spawn higher for atmospheric
        C_SMOKE_EFFECT, random(70, 160), random(12000, 20000), 
        createVector(random(-0.1, 0.1) * gameSpeed * 0.05, random(-0.08, -0.2)), 
        0.995, 'ellipse' 
    ));
  }
  backgroundElements.sort((a, b) => a.speedFactor - b.speedFactor);
}

function resetGame() {
  resetGameValues();
}

window.setPlayerFlyingState = function(isFlying) {
    playerIsFlying = isFlying;
};

window.triggerJumpSound = function() {
    if (jumpSound && jumpSound.isLoaded()) {
        jumpSound.rate(random(0.9, 1.1));
        jumpSound.play();
    }
};

window.stopPlayerFlying = function() {
    playerIsFlying = false;
};

window.triggerPlayerShoot = function() {
    if (window.currentScreen === "GAME" && playerCanShoot && player) {
        if (currentWeaponMode === "SPREAD") {
            for (let i = -1; i <= 1; i++) {
                playerProjectiles.push(
                    new PlayerProjectile(
                        player.x + player.w,
                        player.y + player.h / 2,
                        i * 0.2 
                    )
                );
            }
        } else {
            playerProjectiles.push(
                new PlayerProjectile(player.x + player.w, player.y + player.h / 2)
            );
        }
        playerShootCooldown = activePowerups[POWERUP_TYPE.RAPID_FIRE] ? PLAYER_SHOOT_COOLDOWN_TIME * 0.4 : PLAYER_SHOOT_COOLDOWN_TIME;
        playerCanShoot = false;
    }
};


window.loadHighScores = function() {
    if (!isAuthReady || !db) {
        console.log("Firestore not ready, delaying loadHighScores.");
        return;
    }
    console.log("loadHighScores called. Current userId:", userId);

    const highScoresCollectionRef = collection(db, `/artifacts/${appId}/public/data/highScores`);
    const q = query(highScoresCollectionRef, limit(100)); 

    onSnapshot(q, (snapshot) => {
        console.log("Firestore: onSnapshot triggered for high scores. Number of documents:", snapshot.size);
        const fetchedScores = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.score !== undefined && data.name && data.userId) { 
                fetchedScores.push(data);
            }
        });

        const uniqueUserHighScores = new Map();
        fetchedScores.forEach(entry => {
            const currentHighest = uniqueUserHighScores.get(entry.userId);
            if (!currentHighest || entry.score > currentHighest.score) {
                uniqueUserHighScores.set(entry.userId, entry);
            }
        });

        let filteredScores = Array.from(uniqueUserHighScores.values());
        filteredScores.sort((a, b) => b.score - a.score); 
        highScores = filteredScores.slice(0, MAX_HIGH_SCORES); 
        
        highScore = highScores.length > 0 ? highScores[0].score : 0; 
        
        console.log("Firestore: High scores updated:", highScores);
        if (typeof window.displayHighScores === 'function') {
            window.displayHighScores(); 
        }
    }, (error) => {
        console.error("Error fetching high scores from Firestore:", error);
    });
};

window.saveHighScore = async function(newScore) {
    if (!isAuthReady || !db || !userId || userId === "anonymous" || userId.startsWith("anonymous_fallback")) { 
        console.warn("Firestore not ready or user not properly authenticated, cannot save high score. UserID:", userId);
        return;
    }

    if (typeof newScore !== 'number' || newScore <= 0) {
        console.warn("Attempted to save invalid score:", newScore);
        return;
    }

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
        const docRef = await addDoc(collection(db, `/artifacts/${appId}/public/data/highScores`), {
            name: window.playerName,
            score: newScore,
            date: formattedDate,
            userId: userId, 
            timestamp: serverTimestamp() 
        });
        console.log("Firestore: Document written with ID: ", docRef.id, "Score:", newScore, "Player:", window.playerName, "UID:", userId);
    } catch (e) {
        console.error("Firestore: Error adding document: ", e);
    }
};

window.displayHighScores = function() {
    console.log("displayHighScores called!");
    const highScoresList = document.getElementById('highScoresList');
    if (!highScoresList) {
        console.warn("highScoresList element not found.");
        return;
    }
    highScoresList.innerHTML = ''; 

    if (highScores.length === 0) {
        highScoresList.innerHTML = '<li>No combat records yet, Soldier!</li>';
        return;
    }

    highScores.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<span class="rank">${index + 1}.</span> <span class="player-name">${entry.name || 'Unknown Pilot'}:</span> <span class="score-value">${entry.score}</span> <span class="score-date">(${(entry.date || 'N/A')})</span>`;
        highScoresList.appendChild(listItem);
    });
};

window.loadPlayerName = function() {
    const storedName = localStorage.getItem(LOCAL_STORAGE_PLAYER_NAME_KEY);
    if (storedName) {
        window.playerName = storedName;
    } else {
        window.playerName = "Recruit"; 
    }
    console.log("Loaded player name:", window.playerName);
};

window.savePlayerName = function(name) {
    if (name && name.trim().length > 0) {
        window.playerName = name.trim();
        localStorage.setItem(LOCAL_STORAGE_PLAYER_NAME_KEY, window.playerName);
        console.log("Player name saved:", window.playerName);
    } else {
        console.log("Attempted to save empty name, keeping current name:", window.playerName);
    }
};

window.deletePlayerName = function() {
    localStorage.removeItem(LOCAL_STORAGE_PLAYER_NAME_KEY);
    window.playerName = "Recruit"; 
    console.log("Player name deleted. Reset to:", window.playerName);
    const nameInputField = document.getElementById('nameInputField');
    if (nameInputField) nameInputField.value = window.playerName;
};


class Player {
  constructor() {
    this.w = 35;
    this.h = 45;
    this.x = PLAYER_START_X;
    this.y = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h - PLAYER_START_Y_OFFSET;
    this.vy = 0;
    this.gravity = 0.55;
    this.lift = -10.5 * JETPACK_FORCE_MULTIPLIER;
    this.onGround = false;

    this.headRadiusX = (this.w * 0.8) / 2;
    this.headRadiusY = (this.h * 0.7) / 2;
    this.headOffsetY = -this.h * 0.2;
    this.shieldCharges = 0;
  }

  update() {
    if (playerIsFlying) {
        jetpackFuel -= FUEL_CONSUMPTION_RATE * (deltaTime / (1000/60)); 
        if (jetpackFuel <= 0) {
            jetpackFuel = 0;
            playerIsFlying = false; 
        }
        this.vy = this.lift; 
        this.onGround = false;
        if (frameCount % 3 === 0) { 
            particles.push(
                new Particle(
                    this.x + this.w * 0.2, 
                    this.y + this.h * 0.9,
                    C_PARTICLE_JET, 
                    random(6, 12), 
                    random(15 * (1000/60), 25 * (1000/60)), 
                    createVector(random(-0.5, 0.5), random(1, 3)), 
                    0.95 
                )
            );
        }
    } else { 
      if (this.onGround) { 
        jetpackFuel = min(MAX_FUEL, jetpackFuel + FUEL_RECHARGE_RATE * (deltaTime / (1000/60))); 
      }
    }

    if (!playerIsFlying || jetpackFuel <= 0) {
      this.vy += this.gravity * (deltaTime / (1000/60)); 
    }

    this.y += this.vy * (deltaTime / (1000/60)); 

    let groundLevel = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h;
    if (this.y >= groundLevel) {
      this.y = groundLevel;
      this.vy = 0; 
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.y < 0) {
      this.y = 0;
      this.vy *= -0.2; 
    }
  }

   show() {
    stroke(20, 30, 40); 
    strokeWeight(2);

    fill(C_PLAYER); 
    rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.8, 3); 

    beginShape();
    vertex(this.x + this.w * 0.1, this.y + this.h * 0.2);
    vertex(this.x + this.w * 0.9, this.y + this.h * 0.2);
    vertex(this.x + this.w, this.y + this.h * 0.4);
    vertex(this.x + this.w * 0.5, this.y + this.h * 0.55); 
    vertex(this.x, this.y + this.h * 0.4);
    endShape(CLOSE);

    fill(C_SKIN_TONE);
    ellipse(this.x + this.w / 2, this.y + this.headOffsetY, this.headRadiusX * 1.8, this.headRadiusY * 1.8);

    fill(C_PLAYER.levels[0] - 10, C_PLAYER.levels[1] - 10, C_PLAYER.levels[2] - 10); 
    rect(this.x + this.w * 0.15, this.y + this.headOffsetY - this.headRadiusY * 1.2, this.w * 0.7, this.headRadiusY * 0.8, 3); 
    beginShape(); 
    vertex(this.x + this.w * 0.1, this.y + this.headOffsetY - this.headRadiusY * 0.4);
    vertex(this.x + this.w * 0.9, this.y + this.headOffsetY - this.headRadiusY * 0.4);
    vertex(this.x + this.w * 0.8, this.y + this.headOffsetY - this.headRadiusY * 0.1);
    vertex(this.x + this.w * 0.2, this.y + this.headOffsetY - this.headRadiusY * 0.1);
    endShape(CLOSE);

    fill(C_MUSTACHE_COLOR);
    ellipse(this.x + this.w / 2, this.y + this.headOffsetY + this.headRadiusY * 0.4, 4, 3);


    fill(40, 45, 50); 
    rect(this.x - 12, this.y + this.h * 0.05, 15, this.h * 0.9, 5); 
    stroke(C_OBSTACLE); 
    strokeWeight(1);
    line(this.x - 12, this.y + this.h * 0.3, this.x + 3, this.y + this.h * 0.3); 
    line(this.x - 12, this.y + this.h * 0.7, this.x + 3, this.y + this.h * 0.7);
    fill(60, 70, 80); 
    ellipse(this.x - 4, this.y + this.h * 0.2, 10, 10);
    ellipse(this.x - 4, this.y + this.h * 0.8, 10, 10);
    noStroke();


    fill(30, 35, 40); 
    rect(this.x + this.w - 5, this.y + this.h * 0.6, 35, 8, 2); 
    rect(this.x + this.w + 10, this.y + this.h * 0.6 + 8, 10, 5, 2); 
    fill(80, 50, 30); 
    rect(this.x + this.w - 10, this.y + this.h * 0.6 - 10, 10, 15, 2); 


    noStroke(); 

    const auraCenterX = this.x + this.w / 2;
    const playerVisualTopY = (this.y + this.headOffsetY) - this.headRadiusY; 
    const playerVisualBottomY = this.y + this.h; 
    const playerVisualHeight = playerVisualBottomY - playerVisualTopY;
    const auraCenterY = playerVisualTopY + playerVisualHeight / 2;

    const auraDiameterX = this.w * 2.2; 
    const auraDiameterY = playerVisualHeight * 1.5; 

    if (weaponSystemActive) {
      let weaponColor = currentWeaponMode === "SPREAD" ? C_POWERUP_SPREAD : color(150, 180, 255, 100); 
      fill( weaponColor.levels[0], weaponColor.levels[1], weaponColor.levels[2], 60 + sin(frameCount * 0.2) * 20 ); 
      ellipse( auraCenterX, auraCenterY, auraDiameterX, auraDiameterY );
    }

    if (this.shieldCharges > 0) {
      fill( C_POWERUP_SHIELD.levels[0], C_POWERUP_SHIELD.levels[1], C_POWERUP_SHIELD.levels[2], 80 + sin(frameCount * 0.15) * 40 ); 
      ellipse( auraCenterX, auraCenterY, auraDiameterX * 1.05, auraDiameterY * 1.05 ); 
    }
  }

  hits(obj) {
    const playerHitboxX = this.x;
    const playerHitboxY = (this.y + this.headOffsetY) - this.headRadiusY; 
    const playerHitboxW = this.w;
    const playerHitboxH = (this.y + this.h) - playerHitboxY; 

    return collideRectRect(
      playerHitboxX, playerHitboxY, playerHitboxW, playerHitboxH,
      obj.x, obj.y, obj.w, obj.h
    );
  }
}
class PlayerProjectile {
  constructor(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.w = 20; 
    this.h = 4;  
    this.baseSpeed = 15 + gameSpeed * 1.2; 
    this.vx = cos(angle) * this.baseSpeed;
    this.vy = sin(angle) * this.baseSpeed;
    this.color = C_PLAYER_PROJECTILE; 
    this.damage = 10; 
    this.angle = angle;

    if (playerProjectileSound && playerProjectileSound.isLoaded()) {
      playerProjectileSound.rate(random(0.9, 1.1));
      playerProjectileSound.play();
    }
  }
  update() {
    this.x += this.vx * (deltaTime / (1000/60)); 
    this.y += this.vy * (deltaTime / (1000/60)); 
  }
  show() {
    push(); 
    translate(this.x, this.y); 
    rotate(this.angle); 
    
    fill(this.color);
    noStroke();
    rect(0, -this.h / 2, this.w, this.h, 1); 
    triangle(this.w, -this.h / 2, this.w, this.h / 2, this.w + 5, 0); 
    
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 100); 
    rect(-5, -this.h / 2, 5, this.h); 

    pop(); 
  }
  offscreen() {
    return ( this.x > width + this.w || this.x < -this.w || this.y < -this.h || this.y > height + this.h );
  }
  hits(target) { 
    return collideRectRect( this.x, this.y - this.h / 2, this.w, this.h, target.x, target.y, target.w, target.h );
  }
}

class EnemyProjectile {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.r = 6; 
    this.speed = 2.5 + gameSpeed * 0.55;
    this.vx = cos(angle) * this.speed;
    this.vy = sin(angle) * this.speed;
    this.color = C_ENEMY_PROJECTILE; 
    this.rotation = random(TWO_PI); 

    if (enemyProjectileSound && enemyProjectileSound.isLoaded()) {
      enemyProjectileSound.rate(random(0.9, 1.1));
      enemyProjectileSound.play();
    }
  }
  update() {
    this.x += this.vx * (deltaTime / (1000/60)); 
    this.y += this.vy * (deltaTime / (1000/60)); 
    this.rotation += 0.1 * (deltaTime / (1000/60)); 
  }
  show() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    fill(this.color);
    stroke( max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30) ); 
    strokeWeight(1.5);
    rect(-this.r, -this.r, this.r * 2, this.r * 2, 2); 
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], 150);
    triangle(-this.r, -this.r, this.r, -this.r, 0, -this.r * 1.5); 
    pop();
  }
  offscreen() {
    return ( this.x < -this.r || this.x > width + this.r || this.y < -this.r || this.y > height + this.r );
  }
  hits(playerRect) { 
    return collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x, this.y, this.r * 2 );
  }
  hitsObstacle(obstacle) { 
    return collideRectCircle( obstacle.x, obstacle.y, obstacle.w, obstacle.h, this.x, this.y, this.r * 2 );
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; 
    this.isDestroyed = false;
    this.droneAngle = random(TWO_PI); 

    if (this.type === "DRONE" || this.type === "INTERCEPTOR") {
      this.w = 50; 
      this.h = 40;
      this.maxHealth = this.type === "INTERCEPTOR" ? 3 : 4;
      this.color = this.type === "INTERCEPTOR" ? C_ENEMY_INTERCEPTOR : C_ENEMY_DRONE;
      this.shootAccuracy = 0.18; 
      this.baseShootCooldown = this.type === "INTERCEPTOR" ? 2200 : 2800; 
      this.movementSpeedFactor = 1.0;
    } else { // TURRET
      this.w = 45;
      this.h = 45;
      this.maxHealth = 6;
      this.color = C_ENEMY_TURRET;
      this.shootAccuracy = 0.1;
      this.baseShootCooldown = 1800;
      this.movementSpeedFactor = 0.6; 
    }
    this.health = this.maxHealth;
    this.shootCooldown = random( this.baseShootCooldown * 0.5, this.baseShootCooldown * 1.5 ); 
  }

  update() {
    if (this.isDestroyed) return; 
    this.x -= gameSpeed * this.movementSpeedFactor * (deltaTime / (1000/60)); 

    if (this.type === "DRONE" || this.type === "INTERCEPTOR") {
      let ySpeed = this.type === "INTERCEPTOR" ? 0.08 : 0.05;
      let yAmplitude = this.type === "INTERCEPTOR" ? 1.3 : 1.0;
      this.y += sin(this.droneAngle + frameCount * ySpeed) * yAmplitude * (deltaTime / (1000/60)); 
      this.y = constrain( this.y, this.h, SCREEN_HEIGHT - GROUND_Y_OFFSET - this.h * 2 ); 
    }

    this.shootCooldown -= deltaTime;
    if (this.shootCooldown <= 0 && this.x < width - 20 && this.x > 20 && player) { 
      let angleToPlayer = atan2( (player.y + player.h / 2) - (this.y + this.h / 2), (player.x + player.w / 2) - (this.x + this.w / 2) );
      let randomOffset = random(-this.shootAccuracy, this.shootAccuracy);
      enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2, this.y + this.h / 2, angleToPlayer + randomOffset ) );
      this.shootCooldown = this.baseShootCooldown / (gameSpeed / INITIAL_GAME_SPEED);
      this.shootCooldown = max(this.baseShootCooldown / 3, this.shootCooldown); 
    }
  }
  show() {
    if (this.isDestroyed) return;
    strokeWeight(2);
    stroke( max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30) );
    fill(this.color);

    if (this.type === "DRONE") {
      rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.6, 2); 
      rect(this.x + this.w * 0.2, this.y, this.w * 0.6, 5); 
      rect(this.x + this.w * 0.2, this.y + this.h - 5, this.w * 0.6, 5); 
      triangle(this.x + this.w, this.y + this.h * 0.2, this.x + this.w, this.y + this.h * 0.8, this.x + this.w + 10, this.y + this.h * 0.5); 
    } else if (this.type === "INTERCEPTOR") {
      beginShape(); 
      vertex(this.x, this.y + this.h * 0.5);
      vertex(this.x + this.w * 0.8, this.y);
      vertex(this.x + this.w, this.y + this.h * 0.5);
      vertex(this.x + this.w * 0.8, this.y + this.h);
      endShape(CLOSE);
      rect(this.x + this.w * 0.3, this.y + this.h * 0.3, this.w * 0.4, this.h * 0.4); 
      fill(100); 
      ellipse(this.x + this.w - 5, this.y + this.h / 2, 8, 20);
    } else { // TURRET
      rect(this.x, this.y + this.h * 0.5, this.w, this.h * 0.5, 3); 
      ellipse(this.x + this.w / 2, this.y + this.h * 0.5, this.w * 0.8, this.h * 0.8); 
      push(); 
      translate(this.x + this.w / 2, this.y + this.h * 0.5);
      if (player) { // Ensure player exists before calculating angle
        rotate(atan2((player.y + player.h / 2) - (this.y + this.h * 0.5), (player.x + player.w / 2) - (this.x + this.w / 2)));
      }
      fill(this.color.levels[0] - 20, this.color.levels[1] - 20, this.color.levels[2] - 20); 
      rect(0, -5, 30, 10, 2); 
      pop();
    }
    noStroke();
    if (this.health < this.maxHealth) {
      fill(C_BLOOD_RED); 
      rect(this.x, this.y - 12, this.w, 6);
      fill(70, 120, 70); 
      rect( this.x, this.y - 12, map(this.health, 0, this.maxHealth, 0, this.w), 6 );
    }
  }
takeDamage(amount) {
    this.health -= amount;
    createExplosion( this.x + this.w / 2, this.y + this.h / 2, 3, C_PARTICLE_IMPACT, 5 * (1000/60), 15 * (1000/60) ); 

    if (this.health <= 0) {
      this.isDestroyed = true;
      score += this.maxHealth * 20 * scoreMultiplier; 

      if (objectDestroySound && objectDestroySound.isLoaded()) {
        objectDestroySound.rate(random(0.9, 1.1));
        objectDestroySound.play();
      }
      createExplosion( this.x + this.w / 2, this.y + this.h / 2, 10 + floor(this.maxHealth * 2), this.color, 5 * (1000/60), 25 * (1000/60) ); 
      
      if (random() < 0.5) {
        powerups.push( new Powerup( this.x + this.w / 2, this.y + this.h / 2, POWERUP_TYPE.COIN ) );
      } else if (random() < 0.15) {
        powerups.push( new Powerup( this.x + this.w / 2, this.y + this.h / 2, POWERUP_TYPE.FUEL_CELL ) );
      }
    }
  }
  offscreen() {
    return this.x < -this.w - 20; 
  }
}


class Obstacle {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    this.color = C_OBSTACLE;
    this.detailColor = lerpColor(this.color, color(0), 0.3);

    // Precompute texture details (NO random in show()).
    this.seed = Math.floor(random(1e9));
    const r = makeRng(this.seed);

    this.cracks = [
      // vertical-ish
      {
        x1: rngRange(r, this.w * 0.15, this.w * 0.85),
        y1: 0,
        x2: rngRange(r, this.w * 0.10, this.w * 0.90),
        y2: this.h,
        w: rngRange(r, 1.0, 1.8),
      },
      // horizontal-ish
      {
        x1: 0,
        y1: rngRange(r, this.h * 0.15, this.h * 0.85),
        x2: this.w,
        y2: rngRange(r, this.h * 0.10, this.h * 0.90),
        w: rngRange(r, 1.0, 1.8),
      },
    ];

    const dotCount = rngInt(r, 3, 7);
    this.stains = Array.from({ length: dotCount }, () => ({
      x: rngRange(r, this.w * 0.08, this.w * 0.92),
      y: rngRange(r, this.h * 0.08, this.h * 0.92),
      s: rngRange(r, 2, 6),
      a: rngRange(r, 40, 90),
    }));

    const chipCount = rngInt(r, 2, 5);
    this.chips = Array.from({ length: chipCount }, () => ({
      corner: rngPick(r, ["tl", "tr", "bl", "br"]),
      dx: rngRange(r, 6, 16),
      dy: rngRange(r, 6, 16),
    }));
  }

  update() {
    this.x -= gameSpeed * (deltaTime / (1000 / 60));
  }

  show() {
    // body
    fill(this.color);
    stroke(this.detailColor);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h, 2);

    // cracks
    stroke(this.detailColor);
    for (const c of this.cracks) {
      strokeWeight(c.w);
      line(this.x + c.x1, this.y + c.y1, this.x + c.x2, this.y + c.y2);
    }
    noStroke();

    // stains / pitting
    for (const d of this.stains) {
      fill(this.detailColor.levels[0], this.detailColor.levels[1], this.detailColor.levels[2], d.a);
      ellipse(this.x + d.x, this.y + d.y, d.s, d.s);
    }

    // edge chips
    fill(this.detailColor.levels[0], this.detailColor.levels[1], this.detailColor.levels[2], 190);
    for (const ch of this.chips) {
      if (ch.corner === "tl") {
        triangle(this.x, this.y, this.x + ch.dx, this.y, this.x, this.y + ch.dy);
      } else if (ch.corner === "tr") {
        triangle(this.x + this.w, this.y, this.x + this.w - ch.dx, this.y, this.x + this.w, this.y + ch.dy);
      } else if (ch.corner === "bl") {
        triangle(this.x, this.y + this.h, this.x + ch.dx, this.y + this.h, this.x, this.y + this.h - ch.dy);
      } else {
        triangle(this.x + this.w, this.y + this.h, this.x + this.w - ch.dx, this.y + this.h, this.x + this.w, this.y + this.h - ch.dy);
      }
    }
  }

  offscreen() {
    return this.x < -this.w;
  }
}

class Powerup
 {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.s = type === POWERUP_TYPE.COIN ? 20 : 30; 
    this.initialY = y; 
    this.bobOffset = random(TWO_PI); 
    this.rotation = random(TWO_PI); 
    this.type = type; 
    switch (type) {
      case POWERUP_TYPE.COIN: this.color = C_POWERUP_COIN; break;
      case POWERUP_TYPE.FUEL_CELL: this.color = C_POWERUP_FUEL; break;
      case POWERUP_TYPE.SHIELD: this.color = C_POWERUP_SHIELD; break;
      case POWERUP_TYPE.WEAPON_SYSTEM: this.color = C_POWERUP_WEAPON; break;
      case POWERUP_TYPE.SPREAD_SHOT: this.color = C_POWERUP_SPREAD; break;
      case POWERUP_TYPE.RAPID_FIRE: this.color = C_POWERUP_RAPID; break;
      case POWERUP_TYPE.SCORE_MULTIPLIER: this.color = C_POWERUP_MULTIPLIER; break;
      case POWERUP_TYPE.COIN_MAGNET: this.color = C_POWERUP_MAGNET; break;
      case POWERUP_TYPE.SPEED_BURST: this.color = C_POWERUP_SPEED; break;
      default: this.color = color(150); 
    }
  }
  update() {
    if (this.type === POWERUP_TYPE.COIN && activePowerups[POWERUP_TYPE.COIN_MAGNET] > 0 && player) {
        let angleToPlayer = atan2(player.y - this.y, player.x - this.x);
        let distance = dist(player.x, player.y, this.x, this.y);
        let magnetForce = map(distance, 0, 200, 5, 0.5, true); 
        this.x += cos(angleToPlayer) * magnetForce * (deltaTime / (1000/60));
        this.y += sin(angleToPlayer) * magnetForce * (deltaTime / (1000/60));
    } else {
        this.x -= gameSpeed * 0.85 * (deltaTime / (1000/60)); 
    }
    this.y = this.initialY + sin(frameCount * 0.08 + this.bobOffset) * 8;
    if ( this.type === POWERUP_TYPE.COIN || this.type === POWERUP_TYPE.SPREAD_SHOT ) this.rotation += 0.08 * (deltaTime / (1000/60));
  }
  show() {
    push();
    translate(this.x + this.s / 2, this.y + this.s / 2); 
    if ( this.type === POWERUP_TYPE.COIN || this.type === POWERUP_TYPE.SPREAD_SHOT ) rotate(this.rotation);
    
    textAlign(CENTER, CENTER);
    textSize(this.s * 0.5);
    
    strokeWeight(2);
    stroke(max(0, red(this.color) - 30), max(0, green(this.color) - 30), max(0, blue(this.color) - 30));
    fill(this.color);

    switch (this.type) {
      case POWERUP_TYPE.COIN:
        ellipse(0, 0, this.s, this.s); 
        noStroke(); 
        fill(lerpColor(this.color, color(255), 0.2)); 
        ellipse(0, 0, this.s * 0.6, this.s * 0.6);
        fill(0, 0, 0, 200); 
        text("$", 0, 1);
        break;
      case POWERUP_TYPE.FUEL_CELL:
        rect(-this.s * 0.3, -this.s * 0.4, this.s * 0.6, this.s * 0.8, 3); 
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        rect(-this.s * 0.2, -this.s * 0.5, this.s * 0.4, this.s * 0.1, 2); 
        fill(0, 0, 0, 200);
        text("F", 0, 1);
        break;
      case POWERUP_TYPE.SHIELD:
        beginShape(); 
        vertex(0, -this.s / 2); vertex(this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, this.s * 0.2);
        vertex(0, this.s / 2); vertex(-this.s * 0.4, this.s * 0.2); vertex(-this.s * 0.4, -this.s * 0.2);
        endShape(CLOSE);
        fill(0, 0, 0, 200);
        text("S", 0, 1);
        break;
      case POWERUP_TYPE.WEAPON_SYSTEM:
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.8, 2); 
        noStroke();
        fill(lerpColor(this.color, color(0), 0.2));
        rect(-this.s * 0.3, -this.s * 0.3, this.s * 0.6, this.s * 0.6, 1); 
        fill(0, 0, 0, 200);
        text("W", 0, 1);
        break;
      case POWERUP_TYPE.SPREAD_SHOT:
        for (let i = -1; i <= 1; i++) rect(i * this.s * 0.25, -this.s * 0.1, this.s * 0.15, this.s * 0.4, 1); 
        fill(0, 0, 0, 200);
        textSize(this.s * 0.25); 
        text("SP", 0, 1);
        break;
      case POWERUP_TYPE.RAPID_FIRE:
        ellipse(0, 0, this.s, this.s); 
        noStroke();
        fill(lerpColor(this.color, color(255), 0.2));
        ellipse(0, 0, this.s * 0.6, this.s * 0.6);
        fill(0, 0, 0, 200);
        text("RF", 0, 1);
        break;
      case POWERUP_TYPE.SCORE_MULTIPLIER:
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.8, 2); 
        noStroke();
        fill(0, 0, 0, 200);
        textSize(this.s * 0.3);
        text("x" + (activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] > 0 ? scoreMultiplier : "?"), 0, 1); 
        break;
      case POWERUP_TYPE.COIN_MAGNET:
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.8, this.s * 0.2, 2); 
        rect(-this.s * 0.4, -this.s * 0.4, this.s * 0.2, this.s * 0.8, 2); 
        rect(this.s * 0.2, -this.s * 0.4, this.s * 0.2, this.s * 0.8, 2); 
        fill(0, 0, 0, 200);
        textSize(this.s * 0.4);
        text("M", 0, 1);
        break;
      case POWERUP_TYPE.SPEED_BURST:
        beginShape();
        vertex(-this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, -this.s * 0.2); vertex(this.s * 0.4, -this.s * 0.4);
        vertex(this.s * 0.6, 0); vertex(this.s * 0.4, this.s * 0.4); vertex(this.s * 0.4, this.s * 0.2);
        vertex(-this.s * 0.4, this.s * 0.2);
        endShape(CLOSE);
        fill(0, 0, 0, 200);
        textSize(this.s * 0.3);
        text(">>", 0, 1);
        break;
      default: 
        ellipse(0, 0, this.s, this.s);
        fill(0, 0, 0, 200);
        text("?", 0, 1);
    }
    pop();
  }
  offscreen() {
    return this.x < -this.s - 20; 
  }
  hits(playerRect) { 
    return collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x + this.s / 2, this.y + this.s / 2, this.s );
  }
}

class Boss {
  constructor(x, y, w, h, r, maxHealth, entrySpeed, targetX, colorVal) {
    this.x = x;
    this.y = y;
    this.w = w; 
    this.h = h; 
    this.r = r; 
    this.maxHealth = maxHealth * (1 + bossCycle * 0.1); // Reduced health scaling per cycle
    this.health = this.maxHealth;
    this.entrySpeed = entrySpeed * (1 + bossCycle * 0.05); // Reduced entry speed scaling
    this.targetX = targetX; 
    this.color = colorVal;
    this.detailColor = lerpColor(this.color, color(0), 0.3);
    this.shootTimer = 1500; 
    this.isActive = false; 
    this.vy = 0; 
    this.gravity = 0.3; 
  }
  updateEntry() { 
    if (this.x > this.targetX) {
      this.x -= this.entrySpeed * (deltaTime / (1000 / 60));
    }
  }
  hasEntered() { 
    return this.x <= this.targetX;
  }
  updateActive() { throw new Error("UpdateActive method must be implemented by subclass"); }
  showActive() { throw new Error("ShowActive method must be implemented by subclass"); }

  update() {
    if (!this.isActive) return; 
    this.updateActive(); 
    
    this.vy += this.gravity * (deltaTime / (1000/60)); 
    this.y += this.vy * (deltaTime / (1000/60)); 
    if (this.r) { 
        this.y = constrain(this.y, this.r, height - GROUND_Y_OFFSET - this.r);
    } else { 
        this.y = constrain(this.y, 0, height - GROUND_Y_OFFSET - this.h);
    }
  }
  show() {
    this.showActive(); 
    let barX = this.x - (this.r || this.w / 2);
    let barY = this.y - (this.r || this.h / 2) - 20; 
    let barW = this.r ? this.r * 2 : this.w;
    let barH = 10;
    fill(C_BLOOD_RED); 
    rect(barX, barY, barW, barH, 2);
    fill(70, 120, 70); 
    rect(barX, barY, map(this.health, 0, this.maxHealth, 0, barW), barH, 2);
    fill(this.detailColor);
    rect(barX - 2, barY, 2, barH);
    rect(barX + barW, barY, 2, barH);
  }
  takeDamage(dmg) {
    if (!this.isActive) return;
    this.health -= dmg;
    let pLast = playerProjectiles[playerProjectiles.length -1];
    let explosionX = pLast ? pLast.x : this.x + random(-20, 20);
    let explosionY = pLast ? pLast.y : this.y + random(-20, 20);
    createExplosion( explosionX, explosionY, 3, C_PARTICLE_IMPACT, 5 * (1000/60), 15 * (1000/60) );
    
    if (this.health <= 0) {
      this.health = 0;
      score += this.maxHealth * 25 * scoreMultiplier; 
    }
  }
  hits(playerRect) { 
    if (!this.isActive) return false;
    if (this.r) { 
      return collideRectCircle( playerRect.x, playerRect.y, playerRect.w, playerRect.h, this.x, this.y, this.r * 2 );
    } else { 
      return collideRectRect( this.x, this.y, this.w, this.h, playerRect.x, playerRect.y, playerRect.w, playerRect.h );
    }
  }
}

class BossTank extends Boss {
  constructor() {
    super( width + 150, SCREEN_HEIGHT - GROUND_Y_OFFSET - 90, 150, 100, null, 100, 2.0, width - 150 - 70, C_BOSS_TANK );
    this.turretAngle = PI; 
  }
  updateActive() {
    if(player) {
        this.turretAngle = lerp( this.turretAngle, atan2( (player.y + player.h / 2) - (this.y + 25), (player.x + player.w / 2) - (this.x + this.w / 2 - 30) ), 0.03 * (deltaTime / (1000/60)) ); 
    }
    this.shootTimer -= deltaTime;
    if (this.shootTimer <= 0) {
      for (let i = -1; i <= 1; i++) {
        enemyProjectiles.push( new EnemyProjectile( this.x + this.w / 2 - 30 + cos(this.turretAngle) * 30, this.y + 25 + sin(this.turretAngle) * 30, this.turretAngle + i * 0.2 ) );
      }
      this.shootTimer = (2500 - bossCycle * 100) / (gameSpeed / INITIAL_GAME_SPEED); 
      this.shootTimer = max(900, this.shootTimer); 
      this.vy = -5; 
    }
  }
  showActive() {
    strokeWeight(3);
    stroke(this.detailColor);
    fill(this.color);
    rect(this.x, this.y, this.w, this.h, 5); 
    fill(this.detailColor);
    rect(this.x, this.y + this.h - 30, this.w, 30, 3); 
    for (let i = 0; i < this.w; i += 20) { 
      rect(this.x + i + 2, this.y + this.h - 28, 15, 26, 2);
    }
    fill(this.color);
    ellipse(this.x + this.w / 2 - 30, this.y + 25, 60, 60); 
    push(); 
    translate(this.x + this.w / 2 - 30, this.y + 25);
    rotate(this.turretAngle);
    fill(this.detailColor);
    rect(20, -10, 50, 20, 3); 
    pop();
    noStroke();
  }
}

class BossShip extends Boss {
  constructor() {
    super( width + 120, 150, null, null, 55, 100, 1.8, width - 55 - 120, C_BOSS_SHIP );
    this.movePatternAngle = random(TWO_PI); 
    this.attackMode = 0; 
    this.modeTimer = 6000 - bossCycle * 500; 
  }
  updateActive() {
    this.y = SCREEN_HEIGHT / 2.5 + sin(this.movePatternAngle) * (SCREEN_HEIGHT / 3);
    this.movePatternAngle += 0.02 / (gameSpeed / INITIAL_GAME_SPEED) * (deltaTime / (1000/60));
    
    this.shootTimer -= deltaTime;
    this.modeTimer -= deltaTime;
    if (this.modeTimer <= 0) { 
      this.attackMode = (this.attackMode + 1) % 2;
      this.modeTimer = random(5000, 8000) - bossCycle * 500;
    }
    if (this.shootTimer <= 0 && player) {
      if (this.attackMode === 0) { 
        let angleToPlayer = atan2( (player.y + player.h / 2) - this.y, (player.x + player.w / 2) - this.x );
        for (let i = -1; i <= 1; i++) enemyProjectiles.push( new EnemyProjectile(this.x, this.y, angleToPlayer + i * 0.15) );
      } else { 
        for (let i = -2; i <= 2; i++) enemyProjectiles.push( new EnemyProjectile(this.x, this.y, PI + i * 0.3) );
      }
      this.shootTimer = (this.attackMode === 0 ? 2000 : 2800 - bossCycle * 150) / (gameSpeed / INITIAL_GAME_SPEED);
      this.shootTimer = max(800, this.shootTimer);
      this.vy = -4; 
    }
  }
  showActive() {
    strokeWeight(3);
    stroke(this.detailColor);
    fill(this.color);
    ellipse(this.x, this.y, this.r * 2.2, this.r * 1.5); 
    beginShape(); vertex(this.x - this.r * 1.2, this.y - this.r * 0.4); vertex(this.x - this.r * 2.0, this.y); vertex(this.x - this.r * 1.2, this.y + this.r * 0.4); endShape(CLOSE);
    beginShape(); vertex(this.x + this.r * 1.2, this.y - this.r * 0.4); vertex(this.x + this.r * 2.0, this.y); vertex(this.x + this.r * 1.2, this.y + this.r * 0.4); endShape(CLOSE);
    fill(this.detailColor); 
    rect(this.x - this.r * 1.8, this.y - 8, 10, 16, 2);
    noStroke();
  }
}

class BossFinal extends Boss {
  constructor() {
    super( width + 150, height / 2, null, null, 65, 100, 1.2, width - 65 - 70, C_BOSS_FINAL );
    this.movePatternAngle = random(TWO_PI);
    this.phase = 0; 
    this.phaseTimer = 18000 - bossCycle * 1000; 
  }
  updateActive() {
    this.x = this.targetX + cos(this.movePatternAngle) * (this.phase === 1 ? 90 : 70);
    this.y = height / 2 + sin(this.movePatternAngle * (this.phase === 2 ? 2.5 : 1.5)) * (height / 2 - this.r - 40);
    this.movePatternAngle += (0.015 + this.phase * 0.005) / (gameSpeed / INITIAL_GAME_SPEED) * (deltaTime / (1000/60));
    
    this.shootTimer -= deltaTime;
    this.phaseTimer -= deltaTime;
    if (this.phaseTimer <= 0 && this.phase < 2) { 
      this.phase++;
      this.phaseTimer = 15000 - this.phase * 2000 - bossCycle * 500;
      createExplosion(this.x, this.y, 30, this.detailColor, 10 * (1000/60), 40 * (1000/60)); 
    }
    if (this.shootTimer <= 0) {
      let numProj = 6 + this.phase * 2 + bossCycle;
      let speedMult = 0.8 + this.phase * 0.1 + bossCycle * 0.05;
      for (let a = 0; a < TWO_PI; a += TWO_PI / numProj) {
        let proj = new EnemyProjectile( this.x, this.y, a + frameCount * 0.01 * (this.phase % 2 === 0 ? 1 : -1) ); 
        proj.speed *= speedMult;
        enemyProjectiles.push(proj);
      }
      this.shootTimer = (3000 - this.phase * 500 - bossCycle * 100) / (gameSpeed / INITIAL_GAME_SPEED);
      this.shootTimer = max(1000 - this.phase * 100, this.shootTimer);
      this.vy = -6; 
    }
  }
  showActive() {
    strokeWeight(4); 
    stroke(this.detailColor);
    fill(this.color);
    rect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2, 5); 
    fill(this.detailColor);
    rect(this.x - this.r * 0.8, this.y - this.r * 1.2, this.r * 1.6, this.r * 0.4, 3); 
    rect(this.x - this.r * 1.2, this.y - this.r * 0.8, this.r * 0.4, this.r * 1.6, 3); 
    for (let i = 0; i < 4; i++) {
      push();
      translate(this.x, this.y);
      rotate(i * HALF_PI); 
      fill(this.color.levels[0] - 20, this.color.levels[1] - 20, this.color.levels[2] - 20); 
      rect(this.r * 0.8, -10, 20, 20, 4); 
      pop();
    }
    noStroke();
  }
}

function updateGameLogic() {
  if (window.currentScreen !== "GAME" || gamePaused) return; 
  
  gameElapsedTime = millis() - gameStartTime;

  let speedBurstFactor = activePowerups[POWERUP_TYPE.SPEED_BURST] > 0 ? 1.5 : 1;
  
  baseGameSpeed = min(MAX_GAME_SPEED / speedBurstFactor, baseGameSpeed + GAME_SPEED_INCREMENT * (deltaTime / (1000 / 60)));
  gameSpeed = baseGameSpeed * speedBurstFactor;


  distanceTraveled += gameSpeed * (deltaTime / (1000 / 60));
  score = floor(distanceTraveled * scoreMultiplier) + coinsCollectedThisRun * 10 * scoreMultiplier; 
  
  if(player) player.update();

  if (!playerCanShoot) {
      playerShootCooldown -= deltaTime;
      if (playerShootCooldown <= 0) playerCanShoot = true;
  }

  // Updated Weapon System Auto-fire with deltaTime
  if (activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0 && player) {
    weaponSystemActive = true;
    let fireIntervalMs = currentWeaponMode === "SPREAD" ? 200 : 133; // Approx 12 and 8 frames at 60fps -> ms
    if (activePowerups[POWERUP_TYPE.RAPID_FIRE]) {
        fireIntervalMs = currentWeaponMode === "SPREAD" ? 100 : 67; // Approx 6 and 4 frames at 60fps -> ms
    }

    weaponSystemShootTimer -= deltaTime;
    if (weaponSystemShootTimer <= 0) {
        if (currentWeaponMode === "SPREAD") {
            for (let i = -1; i <= 1; i++) playerProjectiles.push( new PlayerProjectile( player.x + player.w, player.y + player.h / 2, i * 0.2 ) );
        } else {
            playerProjectiles.push( new PlayerProjectile(player.x + player.w, player.y + player.h / 2) );
        }
        weaponSystemShootTimer = fireIntervalMs; // Reset timer
    }
  } else {
    weaponSystemActive = false;
    // weaponSystemShootTimer = 0; // Optional: reset timer when power-up ends
  }


  if ( millis() - lastObstacleTime > obstacleInterval && !boss && !bossApproaching ) {
    let oW = random(25, 60); let oH = random(40, 180); let oX = width;
    let oYT = random(1); let oY;
    if (oYT < 0.4) oY = 0; 
    else if (oYT < 0.8) oY = height - GROUND_Y_OFFSET - oH; 
    else oY = random(height * 0.15, height - GROUND_Y_OFFSET - oH - 40); 
    obstacles.push(new Obstacle(oX, oY, oW, oH));
    lastObstacleTime = millis();
    obstacleInterval = max( OBSTACLE_MIN_INTERVAL, obstacleInterval * OBSTACLE_INTERVAL_DECREMENT_FACTOR );
  }

  let currentPInterval = boss && boss.isActive ? POWERUP_BOSS_INTERVAL : POWERUP_REGULAR_INTERVAL;
  let currentMinPInterval = boss && boss.isActive ? POWERUP_BOSS_MIN_INTERVAL : POWERUP_REGULAR_MIN_INTERVAL;
  if (millis() - lastPowerupTime > powerupInterval) {
    let pType; let rand = random();
    if (boss && boss.isActive) { 
      if (rand < 0.25) pType = POWERUP_TYPE.WEAPON_SYSTEM;
      else if (rand < 0.5) pType = POWERUP_TYPE.SHIELD;
      else if (rand < 0.7) pType = POWERUP_TYPE.FUEL_CELL;
      else if (rand < 0.85) pType = POWERUP_TYPE.SPREAD_SHOT;
      else pType = POWERUP_TYPE.RAPID_FIRE;
    } else { 
      if (rand < 0.2) pType = POWERUP_TYPE.COIN;
      else if (rand < 0.35) pType = POWERUP_TYPE.FUEL_CELL;
      else if (rand < 0.5) pType = POWERUP_TYPE.SHIELD;
      else if (rand < 0.6) pType = POWERUP_TYPE.WEAPON_SYSTEM;
      else if (rand < 0.7) pType = POWERUP_TYPE.SPREAD_SHOT;
      else if (rand < 0.8) pType = POWERUP_TYPE.RAPID_FIRE;
      else if (rand < 0.87) pType = POWERUP_TYPE.SCORE_MULTIPLIER;
      else if (rand < 0.94) pType = POWERUP_TYPE.COIN_MAGNET;
      else pType = POWERUP_TYPE.SPEED_BURST;
    }
    powerups.push( new Powerup(width, random(60, height - GROUND_Y_OFFSET - 90), pType) );
    lastPowerupTime = millis();
    powerupInterval = max( currentMinPInterval, currentPInterval * POWERUP_INTERVAL_DECREMENT_FACTOR );
  }

  if ( millis() - lastEnemySpawnTime > enemySpawnInterval && !boss && !bossApproaching ) {
    let eTypeRand = random(); let type;
    if (eTypeRand < 0.6) type = "DRONE";
    else if (eTypeRand < 0.85) type = "INTERCEPTOR";
    else type = "TURRET";
    let eY = type === "TURRET" ? (random() < 0.5 ? 30 : SCREEN_HEIGHT - GROUND_Y_OFFSET - 40 - 30) : random(60, height - GROUND_Y_OFFSET - 90);
    enemies.push(new Enemy(width + 30, eY, type));
    lastEnemySpawnTime = millis();
    enemySpawnInterval = max( ENEMY_MIN_INTERVAL, enemySpawnInterval * ENEMY_INTERVAL_DECREMENT_FACTOR );
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    if (player && player.hits(obstacles[i])) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        createExplosion( obstacles[i].x + obstacles[i].w / 2, obstacles[i].y + obstacles[i].h / 2, 10, C_OBSTACLE, 5 * (1000/60), 20 * (1000/60) );
        obstacles.splice(i, 1);
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) );
        break; 
      }
    }
    if (obstacles[i].offscreen()) obstacles.splice(i, 1);
  }
  if (window.currentScreen !== "GAME") return; 

  for (let i = powerups.length - 1; i >= 0; i--) {
    powerups[i].update();
    if (player && powerups[i].hits(player)) {
      activatePowerup(powerups[i].type);
      createExplosion( powerups[i].x + powerups[i].s / 2, powerups[i].y + powerups[i].s / 2, 10, powerups[i].color, 3 * (1000/60), 15 * (1000/60) );
      powerups.splice(i, 1);
    } else if (powerups[i].offscreen()) powerups.splice(i, 1);
  }

  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    let pProj = playerProjectiles[i];
    pProj.update();
    let hitObj = false;
    for (let k = obstacles.length - 1; k >= 0; k--) {
      if (pProj.hits(obstacles[k])) {
        hitObj = true;
        createExplosion( pProj.x + pProj.w / 2, pProj.y, 5, C_PARTICLE_IMPACT, 2 * (1000/60), 8 * (1000/60) );
        break; 
      }
    }
    if (!hitObj) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (!enemies[j].isDestroyed && pProj.hits(enemies[j])) {
          enemies[j].takeDamage(pProj.damage);
          hitObj = true;
          break;
        }
      }
    }
    if (!hitObj && boss && boss.isActive && boss.health > 0) {
      let bH = boss.r ? collideRectCircle(pProj.x, pProj.y - pProj.h / 2, pProj.w, pProj.h, boss.x, boss.y, boss.r * 2) 
                       : collideRectRect(pProj.x, pProj.y - pProj.h / 2, pProj.w, pProj.h, boss.x, boss.y, boss.w, boss.h);
      if (bH) {
        boss.takeDamage(pProj.damage);
        hitObj = true;
      }
    }
    if (hitObj || pProj.offscreen()) {
      if (hitObj && !pProj.offscreen()) createExplosion( pProj.x + pProj.w, pProj.y, 3, C_PLAYER_PROJECTILE, 2 * (1000/60), 8 * (1000/60) );
      playerProjectiles.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    if (e.isDestroyed) { enemies.splice(i, 1); continue; }
    e.update();
    if (player && player.hits(e)) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        e.takeDamage(100); 
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) );
        break;
      }
    }
    if (e.offscreen() && !e.isDestroyed) enemies.splice(i, 1);
  }
  if (window.currentScreen !== "GAME") return;

  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    let eProj = enemyProjectiles[i];
    eProj.update();
    let hitPlayerOrObstacle = false;
    if (player && eProj.hits(player)) {
      if (player.shieldCharges > 0) {
        player.shieldCharges--;
        createExplosion(eProj.x, eProj.y, 8, eProj.color, 3 * (1000/60), 12 * (1000/60));
      } else {
        window.currentScreen = "GAME_OVER";
        if(player) createExplosion( player.x + player.w / 2, player.y + player.h / 2, 30, C_PLAYER, 5 * (1000/60), 40 * (1000/60) );
      }
      hitPlayerOrObstacle = true;
    } else {
      for (let k = obstacles.length - 1; k >= 0; k--) {
        if (eProj.hitsObstacle(obstacles[k])) {
          hitPlayerOrObstacle = true;
          createExplosion(eProj.x, eProj.y, 5, C_PARTICLE_IMPACT, 2 * (1000/60), 8 * (1000/60));
          break;
        }
      }
    }
    if (hitPlayerOrObstacle) {
      enemyProjectiles.splice(i, 1);
      if (window.currentScreen !== "GAME") break; // Break if game over was triggered
    } else if (eProj.offscreen()) enemyProjectiles.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].finished()) particles.splice(i, 1);
  }
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    smokeParticles[i].update();
    if (smokeParticles[i].finished()) {
        smokeParticles.splice(i, 1);
        if (random() < 0.3) { 
             smokeParticles.push(new Particle(
                random(SCREEN_WIDTH), random(SCREEN_HEIGHT * 0.05, SCREEN_HEIGHT * 0.4), // Spawn higher
                C_SMOKE_EFFECT, random(60, 120), random(8000, 15000),
                createVector(random(-0.05, 0.05) * gameSpeed * 0.1, random(-0.08, -0.18)),
                0.99, 'ellipse'
            ));
        }
    }
  }


  if (boss) {
    if (!boss.isActive) {
      boss.updateEntry();
      if (boss.hasEntered()) boss.isActive = true;
    } else {
      boss.update();
      if (boss.health <= 0) {
        createExplosion( boss.x + (boss.r || boss.w / 2), boss.y + (boss.r || boss.h / 2), 50, boss.color, 10 * (1000/60), 60 * (1000/60) );
        boss = null; 
        bossApproaching = false; 
        pendingBoss = null;
        bossCycle++; 
        timeUntilNextBoss = BOSS_SPAWN_INTERVAL_MS; 
        
        // --- Difficulty Adjustment after Boss Defeat ---
        gameSpeed = INITIAL_GAME_SPEED; // Reset game speed to initial after boss defeat
        baseGameSpeed = INITIAL_GAME_SPEED; // Reset base speed too
        obstacleInterval = OBSTACLE_START_INTERVAL; // Reset obstacle interval
        enemySpawnInterval = ENEMY_START_INTERVAL; // Reset enemy interval

        // --- Check for Win Condition ---
        if (bossCycle >= 3) { // After defeating all 3 unique bosses (0, 1, 2)
            gameWin = true;
            window.currentScreen = "GAME_WIN"; // Transition to win screen
        }
      }
    }
  } else if (!bossApproaching && window.currentScreen === "GAME") { // Only spawn boss if game is active
    timeUntilNextBoss -= deltaTime;
    if (timeUntilNextBoss <= 0) {
        bossApproaching = true;
        let bossType = bossCycle % 3; // Cycle through the 3 unique bosses
        if (bossType === 0) pendingBoss = new BossTank();
        else if (bossType === 1) pendingBoss = new BossShip();
        else pendingBoss = new BossFinal();
    }
  } else if (bossApproaching && !boss && enemies.length === 0 && obstacles.length === 0) {
    // This block is for when boss is approaching but not yet active, and screen is clear
    // This logic was causing glitches. The boss should be set when it enters.
    // The `pendingBoss` is already set and updated in `updateBossLogic`'s first `if` block.
    // This `else if` block can be removed or simplified if it's causing issues.
    // For now, let's ensure it doesn't prematurely set `boss`.
    // The `pendingBoss.hasEntered()` check handles the transition to `boss = pendingBoss;`
  }

  for (const type in activePowerups) {
    activePowerups[type] -= deltaTime;
    if (activePowerups[type] <= 0) {
      delete activePowerups[type];
      if (type === POWERUP_TYPE.WEAPON_SYSTEM && !(activePowerups[POWERUP_TYPE.SPREAD_SHOT] > 0 || activePowerups[POWERUP_TYPE.RAPID_FIRE] > 0) ) {
        weaponSystemActive = false; 
        currentWeaponMode = "STANDARD";
      } else if (type === POWERUP_TYPE.SPREAD_SHOT && !(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0) ) {
         currentWeaponMode = "STANDARD"; 
      } else if (type === POWERUP_TYPE.SCORE_MULTIPLIER) {
        scoreMultiplier = 1; 
      }
    }
  }
}

function activatePowerup(type) {
  console.log("Activating powerup:", type);
  switch (type) {
    case POWERUP_TYPE.COIN:
      coinsCollectedThisRun++; 
      break;
    case POWERUP_TYPE.FUEL_CELL:
      jetpackFuel = MAX_FUEL;
      break;
    case POWERUP_TYPE.SHIELD:
      if(player) player.shieldCharges = min(3, player.shieldCharges + 1);
      break;
    case POWERUP_TYPE.COIN_MAGNET:
      activePowerups[POWERUP_TYPE.COIN_MAGNET] = (activePowerups[POWERUP_TYPE.COIN_MAGNET] || 0) + COIN_MAGNET_DURATION;
      break;
    case POWERUP_TYPE.SPEED_BURST:
      activePowerups[POWERUP_TYPE.SPEED_BURST] = (activePowerups[POWERUP_TYPE.SPEED_BURST] || 0) + SPEED_BURST_DURATION;
      break;
    case POWERUP_TYPE.WEAPON_SYSTEM:
      weaponSystemActive = true;
      if (currentWeaponMode !== "SPREAD" && currentWeaponMode !== "RAPID") currentWeaponMode = "STANDARD";
      activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] = (activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] || 0) + WEAPON_SYSTEM_DURATION;
      break;
    case POWERUP_TYPE.SPREAD_SHOT:
      weaponSystemActive = true; 
      currentWeaponMode = "SPREAD";
      activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] = max(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] || 0, SPREAD_SHOT_DURATION); 
      activePowerups[POWERUP_TYPE.SPREAD_SHOT] = (activePowerups[POWERUP_TYPE.SPREAD_SHOT] || 0) + SPREAD_SHOT_DURATION; 
      break;
    case POWERUP_TYPE.RAPID_FIRE:
      weaponSystemActive = true; 
      activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] = max(activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] || 0, RAPID_FIRE_DURATION);
      activePowerups[POWERUP_TYPE.RAPID_FIRE] = (activePowerups[POWERUP_TYPE.RAPID_FIRE] || 0) + RAPID_FIRE_DURATION;
      break;
    case POWERUP_TYPE.SCORE_MULTIPLIER:
      scoreMultiplier *= 2; 
      activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] = (activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] || 0) + SCORE_MULTIPLIER_DURATION;
      break;
  }
}


class Particle {
  constructor(x, y, color, size, lifetime, velocity, drag, shape = 'ellipse') {
    this.x = x;
    this.y = y;
    this.size = size;
    this.initialSize = size;
    this.lifetime = lifetime;
    this.startLifetime = lifetime;
    this.alpha = 255;
    this.shape = shape;

    this.vel = velocity || createVector(random(-1, 1), random(-1, 1));
    this.acc = createVector(0, 0);
    this.drag = drag || 1;

    // Precompute render choices to prevent flicker.
    this.seed = Math.floor(random(1e9));
    const r = makeRng(this.seed);

    if (Array.isArray(color)) {
      this.color = rngPick(r, color);
    } else {
      this.color = color;
    }

    this.rectAspect = (shape === 'rect') ? rngRange(r, 0.65, 1.35) : 1;
    this.rot = (shape === 'rect') ? rngRange(r, -0.35, 0.35) : 0;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.mult(this.drag);
    this.x += this.vel.x * (deltaTime / (1000 / 60));
    this.y += this.vel.y * (deltaTime / (1000 / 60));
    this.acc.mult(0);

    this.lifetime -= deltaTime;
    this.alpha = map(this.lifetime, 0, this.startLifetime, 0, 255);
    this.size = map(this.lifetime, 0, this.startLifetime, 0, this.initialSize);
    if (this.size < 0) this.size = 0;
  }

  show() {
    if (!this.color || !this.color.levels) return;

    noStroke();
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.alpha);

    if (this.shape === 'ellipse') {
      ellipse(this.x, this.y, this.size);
      return;
    }

    // rect
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    rect(-this.size / 2, -this.size / 2, this.size, this.size * this.rectAspect, 1);
    pop();
  }

  finished() {
    return this.lifetime < 0;
  }
}

function createExplosion
(x, y, count, baseColor, minLifetimeMs, maxLifetimeMs) { 
  for (let i = 0; i < count; i++) {
    let angle = random(TWO_PI);
    let speed = random(1, 6); 
    let vel = createVector(cos(angle) * speed, sin(angle) * speed);
    let particleType = random();
    let pColor = Array.isArray(baseColor) ? baseColor[floor(random(baseColor.length))] : baseColor;
    let lifetime = random(minLifetimeMs, maxLifetimeMs);
    let size = random(3,10); 

    if (particleType < 0.7) { 
        particles.push( new Particle( x + random(-5, 5), y + random(-5, 5), pColor, size, lifetime, vel, 0.9 ) );
    } else { 
        let shrapnelColor = lerpColor(pColor || color(100), color(80,80,80), random(0.2,0.6)); 
        particles.push( new Particle( x + random(-5, 5), y + random(-5, 5), shrapnelColor, size * random(0.5, 0.8), lifetime * 0.8, vel.mult(random(1.2, 1.8)), 0.98, 'rect' ) );
    }
  }
}

function drawHUD() {
  fill(C_HUD_BG); noStroke();
  rect(0, 0, width, 50); 

  let fuelBarWidth = map(jetpackFuel, 0, MAX_FUEL, 0, 150);
  fill(C_POWERUP_FUEL); rect(10, 10, fuelBarWidth, 20);
  noFill(); stroke(C_TEXT_MAIN); strokeWeight(2); rect(10, 10, 150, 20);
  noStroke(); fill(C_TEXT_MAIN); textSize(14); textAlign(LEFT, CENTER); text("FUEL", 15, 20);

  fill(C_TEXT_SCORE); textSize(24); textAlign(RIGHT, CENTER); text("SCORE: " + score, width - 20, 25);
  fill(C_TEXT_ACCENT); textSize(18); text("HIGH: " + highScore, width - 20, 40);
  fill(C_TEXT_MAIN); textSize(18); textAlign(LEFT, CENTER); text("PILOT: " + window.playerName, 180, 25);
  let minutes = floor(gameElapsedTime / 60000); let seconds = floor((gameElapsedTime % 60000) / 1000);
  let timerString = nf(minutes, 2) + ':' + nf(seconds, 2);
  fill(C_TEXT_MAIN); textSize(20); textAlign(CENTER, CENTER); text("TIME: " + timerString, width / 2, 25);

  let pX = width / 2 + 80; let pY = 40; let iconSize = 15;

  if(player && player.shieldCharges > 0) {
    fill(C_POWERUP_SHIELD); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("S x" + player.shieldCharges, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25; 
  }
  if (activePowerups[POWERUP_TYPE.WEAPON_SYSTEM] > 0) {
    fill(C_POWERUP_WEAPON); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER);
    let wsText = "W";
    if (currentWeaponMode === "SPREAD") wsText = "W(S)";
    if (activePowerups[POWERUP_TYPE.RAPID_FIRE]) wsText += "(R)";
    text(wsText, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[POWERUP_TYPE.SCORE_MULTIPLIER] > 0) {
    fill(C_POWERUP_MULTIPLIER); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("x" + scoreMultiplier, pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[POWERUP_TYPE.COIN_MAGNET] > 0) {
    fill(C_POWERUP_MAGNET); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text("M", pX + iconSize / 2, pY + iconSize / 2 + 1);
    pX += iconSize + 25;
  }
  if (activePowerups[POWERUP_TYPE.SPEED_BURST] > 0) {
    fill(C_POWERUP_SPEED); rect(pX, pY, iconSize, iconSize, 2);
    fill(C_TEXT_MAIN); textSize(iconSize * 0.7); textAlign(CENTER, CENTER); text(">>", pX + iconSize / 2, pY + iconSize / 2 + 1);
  }
}

function drawBackground() {
  background(C_SKY_OVERCAST); 

  let horizonY = SCREEN_HEIGHT * 0.6;
  let fireGlowHeight = SCREEN_HEIGHT * 0.15;
  for (let y = 0; y < fireGlowHeight; y++) {
    let inter = map(y, 0, fireGlowHeight, 0, 1);
    let c = lerpColor(C_FIRE_GLOW_STRONG, C_SKY_HORIZON, inter);
    fill(c);
    rect(0, horizonY + y, SCREEN_WIDTH, 1);
  }
  fill(C_SKY_HORIZON);
  rect(0, horizonY + fireGlowHeight, SCREEN_WIDTH, SCREEN_HEIGHT * 0.4 - GROUND_Y_OFFSET - fireGlowHeight);


  fill(C_GROUND_DETAIL); 
  rect(0, SCREEN_HEIGHT - GROUND_Y_OFFSET, SCREEN_WIDTH, GROUND_Y_OFFSET);
  fill(C_GROUND_DETAIL.levels[0] + 10, C_GROUND_DETAIL.levels[1] + 10, C_GROUND_DETAIL.levels[2] + 10);
  for(let i = 0; i < SCREEN_WIDTH; i += 20) { 
    rect(i + (frameCount * gameSpeed * 0.5 * (deltaTime / (1000/60))) % 20, SCREEN_HEIGHT - GROUND_Y_OFFSET + 5, 8, 3);
  }

  for (let bgEl of backgroundElements) { 
      bgEl.update(); 
      bgEl.show(); 
  }
  
  for (let sp of smokeParticles) { sp.show(); }

  fill(C_SMOKE_EFFECT.levels[0], C_SMOKE_EFFECT.levels[1], C_SMOKE_EFFECT.levels[2], 25 + sin(frameCount * 0.01 + bgOffset1*0.1) * 10); 
  rect(0, SCREEN_HEIGHT * 0.15, SCREEN_WIDTH, SCREEN_HEIGHT * 0.55); 
  bgOffset1 += gameSpeed * 0.02 * (deltaTime / (1000/60));
  if (bgOffset1 > TWO_PI) bgOffset1 -= TWO_PI;
}


window.draw = function() {
  drawBackground(); 

  if (window.currentScreen === "START") {
    drawStartScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(true);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  } else if (window.currentScreen === "GAME") {
    updateGameLogic(); 
    if(player) player.show();
    for (let o of obstacles) o.show();
    for (let e of enemies) e.show();
    for (let pp of playerProjectiles) pp.show();
    for (let ep of enemyProjectiles) ep.show();
    for (let pu of powerups) pu.show();
    for (let p of particles) p.show(); 
    if (boss) boss.show();
    drawHUD(); 
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(true);
  } else if (window.currentScreen === "GAME_OVER") {

// Play death sting once when entering game over screen.
if (!deathSoundPlayed) {
  deathSoundPlayed = true;
  try { if (bgMusic && bgMusic.isPlaying && bgMusic.isPlaying()) bgMusic.stop(); } catch (_) {}
  try { if (deathSound && deathSound.isLoaded && deathSound.isLoaded()) deathSound.play(); } catch (_) {}
}

    drawGameOverScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(true);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);

    if (!scoreboardDisplayedAfterGameOver) {
      if(typeof window.saveHighScore === 'function') window.saveHighScore(score);
      scoreboardDisplayedAfterGameOver = true; 
    }
  } else if (window.currentScreen === "GAME_WIN") { // New: Win screen
    drawWinScreen();
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(true); // Show game over buttons to allow retry/main menu
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  } else if (window.currentScreen === "SCOREBOARD") {
    if(typeof window.showMainMenuButtons === 'function') window.showMainMenuButtons(false);
    if(typeof window.showGameOverButtons === 'function') window.showGameOverButtons(false);
    if(typeof window.showInGameControls === 'function') window.showInGameControls(false);
  }
}

function drawStartScreen() {
  fill(C_TEXT_MAIN); textAlign(CENTER, CENTER);
  textSize(48); text("FLAPPY ADOLF", width / 2, height / 2 - 120); 
  textSize(20); text("Based on true events when Fuhrer had to poop.", width / 2, height / 2 - 70);

  textSize(18); fill(C_TEXT_ACCENT);
  text("PILOT: " + window.playerName, width / 2, height / 2 + 20);

  fill(C_TEXT_MAIN); textSize(16);
  text("Use [SPACE] or JUMP button for ass thrust", width / 2, height / 2 + 70);
  text("Use [LEFT MOUSE] or SHOOT button to fire", width / 2, height / 2 + 95);
  text("Survive the nasty enemies of the Reich. Get to poop.", width / 2, height / 2 + 120);
}

function drawGameOverScreen() {
  fill(C_BLOOD_RED); textAlign(CENTER, CENTER);
  textSize(64); text("MISSION FAILED", width / 2, height / 2 - 100);
  fill(C_TEXT_MAIN); textSize(36);
  text("SCORE: " + score, width / 2, height / 2 - 30);
  text("HIGH SCORE: " + highScore, width / 2, height / 2 + 20);
}

function drawWinScreen() {
  fill(C_POWERUP_SHIELD); textAlign(CENTER, CENTER);
  textSize(58); text("MISSION ACCOMPLISHED!", width / 2, height / 2 - 100);
  fill(C_TEXT_MAIN); textSize(32);
  text("You made it to the toilet!", width / 2, height / 2 - 30);

  // Draw a simple toilet icon
  fill(C_OBSTACLE); // Toilet bowl color
  rect(width / 2 - 40, height / 2 + 20, 80, 60, 5); // Toilet base
  ellipse(width / 2, height / 2 + 20, 90, 30); // Toilet seat top
  fill(C_TEXT_MAIN); // Water color
  ellipse(width / 2, height / 2 + 45, 50, 30); // Toilet water

  fill(C_TEXT_ACCENT); textSize(20);
  text("Relief achieved!", width / 2, height / 2 + 120);
}

window.keyPressed = function() {
  // --- Handle Spacebar (starts game AND jumps) ---
  if (key === " ") {
    // If the game is not started, spacebar starts it
    if (window.currentScreen === "START") {
      window.currentScreen = "GAME";
      resetGameValues(); // Reset everything for a fresh start (this will hide name input)
      // Call the global function from jetpack_v2.js to set flying state
      setPlayerFlyingState(true);
      // Call the global function to trigger jump sound
      triggerJumpSound();
    }
    // If game is already running, and player wants to jump
    else if (window.currentScreen === "GAME") { // Removed !gameOver
      // Call the global function from jetpack_v2.js to set player flying state
      setPlayerFlyingState(true);
      // Call the global function to trigger jump sound
      triggerJumpSound();
    }
  }

  // --- Handle 'R' Key (resets game if game over or win screen) ---
  if (window.currentScreen === "GAME_OVER" || window.currentScreen === "GAME_WIN") {
    if (key === "r" || key === "R") {
      resetGameValues(); // This will also reset scoreboardDisplayedAfterGameOver and gameWin
      window.currentScreen = "GAME"; // Ensure game is marked as started for the new run
      // Hide scoreboard if it's open
      if (window.showScoreboard) {
          window.showScoreboard(false);
      }
    }
  }
}
// Assign keyReleased to the window object for p5.js to find it
window.keyReleased = function() {
  // Only stop flying if game is active and spacebar was released
  if (window.currentScreen === "GAME" && key === " ") { // Removed !gameOver
    // Call the centralized function to stop player flying
    stopPlayerFlying();
  }
}
window.mousePressed = function() {
  if (window.currentScreen === "GAME" && mouseButton === LEFT && 
      mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    if(typeof window.triggerPlayerShoot === 'function') window.triggerPlayerShoot();
  }
}
function collideRectRect(x, y, w, h, x2, y2, w2, h2) {
  return x + w >= x2 && x <= x2 + w2 && y + h >= y2 && y <= y2 + h2;
}
function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter) {
  let tX = cx;
  let tY = cy;
  if (cx < rx) tX = rx;
  else if (cx > rx + rw) tX = rx + rw;
  if (cy < ry) tY = ry;
  else if (cy > ry + rh) tY = ry + rh;
  return dist(cx, cy, tX, tY) <= diameter / 2;
}


function onCanvasPointerDown(e) {
  // Only handle input when actively in-game.
  if (window.currentScreen !== "GAME") return;
  try { e.preventDefault(); } catch (_) {}
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;

  // Simple scheme:
  // - Tap/hold right side => fly (jetpack)
  // - Tap left side => shoot
  if (x > rect.width * 0.55) {
    setPlayerFlyingState(true);
  } else {
    triggerPlayerShoot();
  }
}

function onCanvasPointerUp(e) {
  if (window.currentScreen !== "GAME") return;
  try { e.preventDefault(); } catch (_) {}
  stopPlayerFlying();
}

