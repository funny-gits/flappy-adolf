// FILE: main.js
// Clean, complete replacement for previously truncated/ellipsized main.js.
// Keeps the same public window API expected by index.html and preserves the overall
// "Jetpack Jumper" vision: jetpack flight, obstacles, enemies, bosses, powerups, and records.

import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import * as Config from "./config.js";
import * as Utils from "./utils.js";

/** @type {import("p5")} */
let p5i = null;

// --- Firebase (optional) ---
let firebaseApp = null;
let auth = null;
let db = null;
let firebaseReady = false;
let firebaseInitError = null;

function getHighscoreCollectionRef() {
  if (!db) return null;
  // Namespace scores per app id so forks don't mix.
  return collection(db, "apps", Config.DEFAULT_APP_ID, "highscores");
}

async function initFirebaseMaybe() {
  const cfg = Config.getFirebaseConfig();
  if (!cfg) {
    firebaseReady = false;
    return;
  }

  try {
    firebaseApp = initializeApp(cfg);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    // Optional custom token via URL: ?token=...
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      await signInWithCustomToken(auth, token);
    } else {
      await signInAnonymously(auth);
    }

    onAuthStateChanged(auth, () => {
      // no-op: presence indicates we're connected.
    });

    firebaseReady = true;
  } catch (e) {
    firebaseInitError = e;
    firebaseReady = false;
    // Fail open: game should still run locally.
    console.warn("Firebase init failed; using local scores fallback.", e);
  }
}

// --- DOM helpers (scoreboard/name overlays live in index.html) ---
function $(id) {
  return document.getElementById(id);
}

// --- Persistent name ---
window.playerName = "";

function normalizeName(name) {
  const n = (name || "").trim().slice(0, 15);
  return n;
}

window.loadPlayerName = function loadPlayerName() {
  try {
    const n = localStorage.getItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY);
    window.playerName = normalizeName(n || "");
  } catch {
    window.playerName = "";
  }
  return window.playerName;
};

window.savePlayerName = function savePlayerName() {
  const input = $("nameInputField");
  const n = normalizeName(input ? input.value : "");
  if (!n) return false;

  window.playerName = n;
  try {
    localStorage.setItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY, n);
  } catch {}
  if (typeof window.showNameInput === "function") window.showNameInput(false);
  return true;
};

window.deletePlayerName = function deletePlayerName() {
  window.playerName = "";
  try {
    localStorage.removeItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY);
  } catch {}
  const input = $("nameInputField");
  if (input) input.value = "";
  return true;
};

// --- High scores (Firebase preferred; local fallback) ---
function loadLocalHighScores() {
  try {
    const raw = localStorage.getItem(Config.LOCAL_STORAGE_HIGHSCORES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.name === "string" && typeof x.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, Config.MAX_HIGH_SCORES);
  } catch {
    return [];
  }
}

function saveLocalHighScore(name, score) {
  const arr = loadLocalHighScores();
  arr.push({ name, score, createdAt: Date.now() });
  arr.sort((a, b) => b.score - a.score);
  const trimmed = arr.slice(0, Config.MAX_HIGH_SCORES);
  try {
    localStorage.setItem(Config.LOCAL_STORAGE_HIGHSCORES_KEY, JSON.stringify(trimmed));
  } catch {}
}

window.loadHighScores = async function loadHighScores() {
  if (!firebaseReady || !db) return loadLocalHighScores();

  try {
    const ref = getHighscoreCollectionRef();
    if (!ref) return loadLocalHighScores();

    const q = query(ref, orderBy("score", "desc"), limit(Config.MAX_HIGH_SCORES));
    const snap = await getDocs(q);
    const res = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d && typeof d.name === "string" && typeof d.score === "number") {
        res.push({ name: d.name, score: d.score, createdAt: d.createdAt?.toMillis?.() ?? null });
      }
    });
    return res;
  } catch (e) {
    console.warn("Failed to load Firestore scores; falling back to local.", e);
    return loadLocalHighScores();
  }
};

window.saveHighScore = async function saveHighScore(name, score) {
  const n = normalizeName(name || window.playerName || "Pilot");
  if (!n || typeof score !== "number") return false;

  // Always keep a local record so users don't lose progress.
  saveLocalHighScore(n, score);

  if (!firebaseReady || !db) return true;

  try {
    const ref = getHighscoreCollectionRef();
    if (!ref) return true;

    await addDoc(ref, {
      name: n,
      score,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn("Failed to save Firestore score; local saved.", e);
    return true;
  }
};

window.displayHighScores = async function displayHighScores() {
  const ul = $("highScoresList");
  if (!ul) return;

  ul.innerHTML = "";
  const scores = await window.loadHighScores();

  if (!scores.length) {
    const li = document.createElement("li");
    li.textContent = "No records yet. Fly a mission!";
    ul.appendChild(li);
    return;
  }

  scores.forEach((s, i) => {
    const li = document.createElement("li");
    const rank = String(i + 1).padStart(2, "0");
    li.textContent = `${rank}. ${s.name} — ${s.score}`;
    ul.appendChild(li);
  });
};

// --- Game state ---
window.currentScreen = "START";
let gamePaused = false;

let player = null;
let obstacles = [];
let enemies = [];
let powerups = [];
let projectiles = [];
let enemyProjectiles = [];
let particles = [];

let score = 0;
let bestRun = 0;
let gameSpeed = Config.INITIAL_GAME_SPEED;

let playerIsFlying = false;
let jetpackFuel = Config.MAX_FUEL;

// powerup state
const effects = {
  weaponUntil: 0,
  spreadUntil: 0,
  rapidUntil: 0,
  multiplierUntil: 0,
  magnetUntil: 0,
  speedUntil: 0,
  shieldCharges: 0,
};

let lastPlayerShotAt = 0;

// spawn timers
let lastObstacleAt = 0;
let obstacleInterval = Config.OBSTACLE_START_INTERVAL;

let lastEnemySpawnAt = 0;
let enemyInterval = Config.ENEMY_START_INTERVAL;

let lastPowerupAt = 0;
let powerupInterval = Config.POWERUP_REGULAR_INTERVAL;

// boss
let boss = null;
let lastBossWaveAt = 0;
let victoryMessageUntil = 0;

// audio (optional)
let bgMusic = null;
let jumpSound = null;
let shootSound = null;
let hitSound = null;

function dtScale() {
  // Convert deltaTime to a 60fps-ish scale.
  return (p5i?.deltaTime ?? 16.666) / (1000 / 60);
}

function now() {
  return p5i ? p5i.millis() : performance.now();
}

// --- Entities ---
class Player {
  constructor() {
    this.w = Config.PLAYER_W;
    this.h = Config.PLAYER_H;
    this.x = Config.PLAYER_START_X;
    this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h - Config.PLAYER_START_Y_OFFSET;
    this.vy = 0;
  }

  update() {
    const s = dtScale();

    if (playerIsFlying && jetpackFuel > 0) {
      jetpackFuel = Math.max(0, jetpackFuel - Config.FUEL_CONSUMPTION_RATE * s);
      this.vy += Config.PLAYER_LIFT * Config.JETPACK_FORCE_MULTIPLIER * 0.12 * s;
      spawnJetParticles();
    } else {
      // recharge only when grounded
      if (this.onGround()) {
        jetpackFuel = Math.min(Config.MAX_FUEL, jetpackFuel + Config.FUEL_RECHARGE_RATE * s);
      }
      this.vy += Config.PLAYER_GRAVITY * s;
    }

    this.y += this.vy * s;

    // clamp in world
    const ground = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
    if (this.y > ground) {
      this.y = ground;
      this.vy = 0;
    }
    if (this.y < 0) {
      this.y = 0;
      this.vy *= -0.2;
    }
  }

  onGround() {
    const ground = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
    return this.y >= ground - 0.5;
  }

  hit() {
    if (effects.shieldCharges > 0) {
      effects.shieldCharges -= 1;
      spawnImpactParticles(this.x + this.w, this.y + this.h / 2);
      return false; // absorbed
    }
    return true; // lethal
  }

  draw() {
    const p = p5i;
    p.push();
    p.noStroke();

    // body
    p.fill(Config.C_PLAYER);
    p.rect(this.x, this.y + this.h * 0.2, this.w, this.h * 0.8, 3);

    // head
    p.fill(Config.C_SKIN_TONE);
    p.ellipse(this.x + this.w / 2, this.y + this.h * 0.2, this.w * 0.9, this.h * 0.7);

    // moustache (iconic, but just a stylized moustache)
    Utils.drawMoustache(
      p,
      this.x + this.w / 2,
      this.y + this.h * 0.25,
      this.w * 0.8,
      this.h * 0.18,
      Config.C_MUSTACHE_COLOR
    );

    // shield indicator
    if (effects.shieldCharges > 0) {
      p.noFill();
      p.stroke(Config.C_POWERUP_SHIELD);
      p.strokeWeight(2);
      p.ellipse(this.x + this.w / 2, this.y + this.h / 2, this.w * 1.8, this.h * 1.8);
    }

    p.pop();
  }
}

class Obstacle {
  constructor(x) {
    this.x = x;
    this.w = 64;
    this.gap = 160;
    const margin = 40;
    const topMax = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.gap - margin;
    this.topH = Math.max(margin, Math.floor((p5i.random() * topMax) + margin));
    this.passed = false;
  }

  update() {
    this.x -= gameSpeed * dtScale();
  }

  isOffscreen() {
    return this.x + this.w < -20;
  }

  collides(pl) {
    const topRect = { x: this.x, y: 0, w: this.w, h: this.topH };
    const bottomY = this.topH + this.gap;
    const bottomRect = { x: this.x, y: bottomY, w: this.w, h: Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - bottomY };

    const hitTop = Utils.rectsIntersect(pl.x, pl.y, pl.w, pl.h, topRect.x, topRect.y, topRect.w, topRect.h);
    const hitBottom = Utils.rectsIntersect(pl.x, pl.y, pl.w, pl.h, bottomRect.x, bottomRect.y, bottomRect.w, bottomRect.h);
    return hitTop || hitBottom;
  }

  scoreIfPassed(pl) {
    if (!this.passed && this.x + this.w < pl.x) {
      this.passed = true;
      return true;
    }
    return false;
  }

  draw() {
    const p = p5i;
    p.push();
    p.noStroke();
    p.fill(Config.C_PILLAR_DARK);
    p.rect(this.x, 0, this.w, this.topH);
    p.rect(this.x, this.topH + this.gap, this.w, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - (this.topH + this.gap));

    // simple highlight
    p.fill(Config.C_PILLAR_LIGHT);
    p.rect(this.x + 6, 0, 8, this.topH);
    p.rect(this.x + 6, this.topH + this.gap, 8, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - (this.topH + this.gap));
    p.pop();
  }
}

class Projectile {
  constructor(x, y, vx, vy, friendly) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = 4;
    this.friendly = friendly;
    this.dead = false;
  }

  update() {
    const s = dtScale();
    this.x += this.vx * s;
    this.y += this.vy * s;

    if (this.x < -50 || this.x > Config.SCREEN_WIDTH + 50 || this.y < -50 || this.y > Config.SCREEN_HEIGHT + 50) {
      this.dead = true;
    }
  }

  draw() {
    const p = p5i;
    p.push();
    p.noStroke();
    p.fill(this.friendly ? Config.C_PLAYER_PROJECTILE : Config.C_ENEMY_PROJECTILE);
    p.circle(this.x, this.y, this.r * 2);
    p.pop();
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.dead = false;
    this.w = (type === Config.ENEMY_TYPE.TURRET) ? 46 : 50;
    this.h = (type === Config.ENEMY_TYPE.TURRET) ? 46 : 40;
    this.hp = (type === Config.ENEMY_TYPE.INTERCEPTOR) ? 2 : 1;

    this.shootCooldown = 900 + Math.random() * 600;
    this.lastShotAt = 0;

    // movement params
    this.baseVy = (Math.random() * 2 - 1) * 0.8;
  }

  color() {
    if (this.type === Config.ENEMY_TYPE.DRONE) return Config.C_ENEMY_DRONE;
    if (this.type === Config.ENEMY_TYPE.INTERCEPTOR) return Config.C_ENEMY_INTERCEPTOR;
    return Config.C_ENEMY_TURRET;
  }

  update() {
    const s = dtScale();
    this.x -= gameSpeed * s;

    if (this.type === Config.ENEMY_TYPE.DRONE) {
      this.y += this.baseVy * s;
      if (this.y < 20 || this.y > Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h - 20) this.baseVy *= -1;
    } else if (this.type === Config.ENEMY_TYPE.INTERCEPTOR) {
      // homes toward player
      const targetY = player ? (player.y + player.h / 2) : this.y;
      const dy = targetY - (this.y + this.h / 2);
      this.y += Utils.clamp(dy * 0.02, -2.4, 2.4) * s;
      this.x -= (gameSpeed * 0.6) * s;
    } else if (this.type === Config.ENEMY_TYPE.TURRET) {
      // stays mostly in place vertically
      this.y = Utils.clamp(this.y, 20, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h - 20);
    }

    this.tryShoot();
    if (this.x + this.w < -80) this.dead = true;
  }

  tryShoot() {
    if (!player) return;
    if (this.type === Config.ENEMY_TYPE.TURRET && this.x > Config.SCREEN_WIDTH - 40) return;

    const t = now();
    if (t - this.lastShotAt < this.shootCooldown) return;

    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;

    const ex = this.x;
    const ey = this.y + this.h / 2;

    const dx = px - ex;
    const dy = py - ey;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 6 + gameSpeed * 0.25;

    enemyProjectiles.push(new Projectile(ex, ey, (dx / len) * speed, (dy / len) * speed, false));
    this.lastShotAt = t;
  }

  hit() {
    this.hp -= 1;
    if (this.hp <= 0) {
      this.dead = true;
      spawnExplosionParticles(this.x + this.w / 2, this.y + this.h / 2);
      score += 10;
    } else {
      spawnImpactParticles(this.x + this.w / 2, this.y + this.h / 2);
    }
  }

  collides(pl) {
    return Utils.rectsIntersect(pl.x, pl.y, pl.w, pl.h, this.x, this.y, this.w, this.h);
  }

  draw() {
    const p = p5i;
    p.push();
    p.noStroke();
    p.fill(this.color());
    p.rect(this.x, this.y, this.w, this.h, 4);

    // small banner accent on drones/interceptors
    if (this.type !== Config.ENEMY_TYPE.TURRET) {
      Utils.drawFauxBanner(
        p,
        this.x + this.w * 0.15,
        this.y + this.h * 0.15,
        this.w * 0.7,
        this.h * 0.7,
        Config.C_BANNER_BG_RED,
        Config.C_BANNER_CIRCLE_WHITE,
        Config.C_BANNER_SYMBOL_BLACK
      );
    }
    p.pop();
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.r = 14;
    this.dead = false;
  }

  color() {
    const t = this.type;
    if (t === Config.POWERUP_TYPE.COIN) return Config.C_POWERUP_COIN;
    if (t === Config.POWERUP_TYPE.FUEL_CELL) return Config.C_POWERUP_FUEL;
    if (t === Config.POWERUP_TYPE.SHIELD) return Config.C_POWERUP_SHIELD;
    if (t === Config.POWERUP_TYPE.WEAPON_SYSTEM) return Config.C_POWERUP_WEAPON;
    if (t === Config.POWERUP_TYPE.SPREAD_SHOT) return Config.C_POWERUP_SPREAD;
    if (t === Config.POWERUP_TYPE.RAPID_FIRE) return Config.C_POWERUP_RAPID;
    if (t === Config.POWERUP_TYPE.SCORE_MULTIPLIER) return Config.C_POWERUP_MULTIPLIER;
    if (t === Config.POWERUP_TYPE.COIN_MAGNET) return Config.C_POWERUP_MAGNET;
    return Config.C_POWERUP_SPEED;
  }

  update() {
    const s = dtScale();
    this.x -= gameSpeed * s;

    // magnet effect pulls pickups toward player
    if (now() < effects.magnetUntil && player) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const dx = px - this.x;
      const dy = py - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 220 && dist > 1) {
        const pull = (220 - dist) / 220;
        this.x += (dx / dist) * pull * 3.2 * s;
        this.y += (dy / dist) * pull * 3.2 * s;
      }
    }

    if (this.x + this.r < -40) this.dead = true;
  }

  collides(pl) {
    return Utils.collideRectCircle(pl.x, pl.y, pl.w, pl.h, this.x, this.y, this.r * 2, p5i);
  }

  apply() {
    const t = now();
    const multActive = t < effects.multiplierUntil;

    switch (this.type) {
      case Config.POWERUP_TYPE.COIN:
        score += multActive ? 10 : 5;
        break;
      case Config.POWERUP_TYPE.FUEL_CELL:
        jetpackFuel = Math.min(Config.MAX_FUEL, jetpackFuel + Config.MAX_FUEL * 0.5);
        break;
      case Config.POWERUP_TYPE.SHIELD:
        effects.shieldCharges = Math.min(5, effects.shieldCharges + 2);
        break;
      case Config.POWERUP_TYPE.WEAPON_SYSTEM:
        effects.weaponUntil = Math.max(effects.weaponUntil, t + Config.WEAPON_SYSTEM_DURATION);
        break;
      case Config.POWERUP_TYPE.SPREAD_SHOT:
        effects.spreadUntil = Math.max(effects.spreadUntil, t + Config.SPREAD_SHOT_DURATION);
        effects.weaponUntil = Math.max(effects.weaponUntil, t + Config.WEAPON_SYSTEM_DURATION / 2);
        break;
      case Config.POWERUP_TYPE.RAPID_FIRE:
        effects.rapidUntil = Math.max(effects.rapidUntil, t + Config.RAPID_FIRE_DURATION);
        effects.weaponUntil = Math.max(effects.weaponUntil, t + Config.WEAPON_SYSTEM_DURATION / 2);
        break;
      case Config.POWERUP_TYPE.SCORE_MULTIPLIER:
        effects.multiplierUntil = Math.max(effects.multiplierUntil, t + Config.SCORE_MULTIPLIER_DURATION);
        break;
      case Config.POWERUP_TYPE.COIN_MAGNET:
        effects.magnetUntil = Math.max(effects.magnetUntil, t + Config.COIN_MAGNET_DURATION);
        break;
      case Config.POWERUP_TYPE.SPEED_BURST:
        effects.speedUntil = Math.max(effects.speedUntil, t + Config.SPEED_BURST_DURATION);
        break;
      default:
        break;
    }

    spawnImpactParticles(this.x, this.y);
  }

  draw() {
    const p = p5i;
    p.push();
    p.noStroke();
    p.fill(this.color());
    p.circle(this.x, this.y, this.r * 2);

    p.fill(0, 0, 0, 60);
    p.circle(this.x, this.y, this.r * 1.1);
    p.pop();
  }
}

class Boss {
  constructor(type) {
    this.type = type;
    this.x = Config.SCREEN_WIDTH + 60;
    this.y = 120;
    this.w = 160;
    this.h = 120;
    this.hpMax = (type === Config.BOSS_TYPE.FINAL) ? 220 : 140;
    this.hp = this.hpMax;

    this.phase = 0;
    this.lastShotAt = 0;
    this.shootCooldown = 550;
  }

  color() {
    if (this.type === Config.BOSS_TYPE.TANK) return Config.C_BOSS_TANK;
    if (this.type === Config.BOSS_TYPE.SHIP) return Config.C_BOSS_SHIP;
    return Config.C_BOSS_FINAL;
  }

  update() {
    const s = dtScale();
    // enter scene then hover
    const targetX = Config.SCREEN_WIDTH - this.w - 40;
    this.x += ((targetX - this.x) * 0.02) * s;

    // track player vertically
    if (player) {
      const ty = Utils.clamp(player.y - this.h / 2, 30, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h - 30);
      this.y += ((ty - this.y) * 0.02) * s;
    }

    this.tryShoot();
  }

  tryShoot() {
    const t = now();
    if (t - this.lastShotAt < this.shootCooldown) return;

    const px = player ? (player.x + player.w / 2) : 0;
    const py = player ? (player.y + player.h / 2) : this.y;

    const bx = this.x;
    const by = this.y + this.h / 2;

    const dx = px - bx;
    const dy = py - by;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 7.5;

    // boss fires a small volley
    enemyProjectiles.push(new Projectile(bx, by, (dx / len) * speed, (dy / len) * speed, false));

    if (this.type !== Config.BOSS_TYPE.TANK) {
      enemyProjectiles.push(new Projectile(bx, by, (dx / len) * speed, (dy / len) * speed + 1.5, false));
      enemyProjectiles.push(new Projectile(bx, by, (dx / len) * speed, (dy / len) * speed - 1.5, false));
    }

    this.lastShotAt = t;
  }

  hit(dmg = 1) {
    this.hp -= dmg;
    spawnImpactParticles(this.x + this.w / 2, this.y + this.h / 2);
    if (this.hp <= 0) {
      spawnExplosionParticles(this.x + this.w / 2, this.y + this.h / 2, 60);
      return true;
    }
    return false;
  }

  collides(pl) {
    return Utils.rectsIntersect(pl.x, pl.y, pl.w, pl.h, this.x, this.y, this.w, this.h);
  }

  draw() {
    const p = p5i;
    p.push();
    p.noStroke();
    p.fill(this.color());
    p.rect(this.x, this.y, this.w, this.h, 10);

    // a cockpit / eye
    p.fill(0, 0, 0, 70);
    p.ellipse(this.x + this.w * 0.25, this.y + this.h * 0.35, this.w * 0.25, this.h * 0.25);

    // HP bar
    const barW = this.w;
    const barH = 10;
    const pct = Utils.clamp(this.hp / this.hpMax, 0, 1);
    p.fill(0, 0, 0, 120);
    p.rect(this.x, this.y - 18, barW, barH, 3);
    p.fill(255, 80, 80);
    p.rect(this.x, this.y - 18, barW * pct, barH, 3);

    p.pop();
  }
}

class Particle {
  constructor(x, y, vx, vy, lifeMs, kind) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.lifeMs = lifeMs;
    this.born = now();
    this.kind = kind;
    this.dead = false;
    this.size = 2 + Math.random() * 4;
  }

  update() {
    const s = dtScale();
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.vy += 0.03 * s;

    if (now() - this.born > this.lifeMs) this.dead = true;
  }

  draw() {
    const p = p5i;
    const age = now() - this.born;
    const a = Utils.clamp(1 - age / this.lifeMs, 0, 1) * 255;

    p.push();
    p.noStroke();
    if (this.kind === "jet") p.fill(p.red(Config.C_PARTICLE_JET), p.green(Config.C_PARTICLE_JET), p.blue(Config.C_PARTICLE_JET), a);
    else if (this.kind === "impact") p.fill(255, 220, 200, a);
    else p.fill(255, 140, 0, a);
    p.circle(this.x, this.y, this.size);
    p.pop();
  }
}

// --- Particles helpers ---
function spawnJetParticles() {
  if (!player) return;
  if (p5i.frameCount % 2 !== 0) return;
  particles.push(new Particle(player.x - 2, player.y + player.h * 0.75, -2 - Math.random() * 2, (Math.random() * 2 - 1) * 0.6, 420, "jet"));
}

function spawnImpactParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push(new Particle(x, y, (Math.random() * 2 - 1) * 2, (Math.random() * 2 - 1) * 2, 420, "impact"));
  }
}

function spawnExplosionParticles(x, y, n = 28) {
  for (let i = 0; i < n; i++) {
    particles.push(new Particle(x, y, (Math.random() * 2 - 1) * 6, (Math.random() * 2 - 1) * 6, 650 + Math.random() * 450, "explosion"));
  }
}

// --- Controls expected by index.html ---
window.setPlayerFlyingState = function setPlayerFlyingState(isFlying) {
  playerIsFlying = !!isFlying;
};

window.stopPlayerFlying = function stopPlayerFlying() {
  playerIsFlying = false;
};

window.triggerJumpSound = function triggerJumpSound() {
  try { if (jumpSound && jumpSound.isLoaded()) jumpSound.play(); } catch {}
};

function canShoot() {
  return now() < effects.weaponUntil;
}

function playerShoot() {
  if (!player) return false;
  if (!canShoot()) return false;

  const t = now();
  const rapid = t < effects.rapidUntil;
  const cooldown = rapid ? Config.PLAYER_SHOOT_COOLDOWN_TIME * 0.35 : Config.PLAYER_SHOOT_COOLDOWN_TIME;
  if (t - lastPlayerShotAt < cooldown) return false;

  lastPlayerShotAt = t;

  const originX = player.x + player.w + 6;
  const originY = player.y + player.h / 2;

  const baseSpeed = 10 + gameSpeed * 0.2;
  const spread = t < effects.spreadUntil;

  if (spread) {
    projectiles.push(new Projectile(originX, originY, baseSpeed, 0, true));
    projectiles.push(new Projectile(originX, originY, baseSpeed, 2.2, true));
    projectiles.push(new Projectile(originX, originY, baseSpeed, -2.2, true));
  } else {
    projectiles.push(new Projectile(originX, originY, baseSpeed, 0, true));
  }

  try { if (shootSound && shootSound.isLoaded()) shootSound.play(); } catch {}

  return true;
}

window.triggerPlayerShoot = function triggerPlayerShoot() {
  playerShoot();
};

// Reset called by index when starting/retrying
window.resetGameValues = function resetGameValues() {
  resetGame();
};

// --- Game lifecycle ---
function resetGame() {
  score = 0;
  gameSpeed = Config.INITIAL_GAME_SPEED;
  obstacles = [];
  enemies = [];
  powerups = [];
  projectiles = [];
  enemyProjectiles = [];
  particles = [];

  player = new Player();
  playerIsFlying = false;
  jetpackFuel = Config.MAX_FUEL;

  effects.weaponUntil = 0;
  effects.spreadUntil = 0;
  effects.rapidUntil = 0;
  effects.multiplierUntil = 0;
  effects.magnetUntil = 0;
  effects.speedUntil = 0;
  effects.shieldCharges = 0;

  lastPlayerShotAt = 0;

  lastObstacleAt = now();
  obstacleInterval = Config.OBSTACLE_START_INTERVAL;

  lastEnemySpawnAt = now();
  enemyInterval = Config.ENEMY_START_INTERVAL;

  lastPowerupAt = now();
  powerupInterval = Config.POWERUP_REGULAR_INTERVAL;

  boss = null;
  lastBossWaveAt = now();
  victoryMessageUntil = 0;

  // ensure UI state matches game
  if (typeof window.showInGameControls === "function") window.showInGameControls(true);
  if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(false);
}

function endGame() {
  window.currentScreen = "GAME_OVER";
  if (typeof window.showInGameControls === "function") window.showInGameControls(false);
  if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(true);

  // save records
  bestRun = Math.max(bestRun, score);
  const n = window.playerName || window.loadPlayerName() || "Pilot";
  window.saveHighScore(n, score).catch(() => {});
}

function currentSpeed() {
  let s = gameSpeed;
  if (now() < effects.speedUntil) s *= 1.5;
  return Math.min(Config.MAX_GAME_SPEED, s);
}

function updateDifficulty() {
  // Gradually scale speed.
  gameSpeed = Math.min(Config.MAX_GAME_SPEED, gameSpeed + Config.GAME_SPEED_INCREMENT * dtScale() * 60);

  // Gradually tighten spawn intervals
  obstacleInterval = Math.max(Config.OBSTACLE_MIN_INTERVAL, obstacleInterval * Config.OBSTACLE_INTERVAL_DECREMENT_FACTOR);
  enemyInterval = Math.max(Config.ENEMY_MIN_INTERVAL, enemyInterval * Config.ENEMY_INTERVAL_DECREMENT_FACTOR);

  const desiredPowerupMin = boss ? Config.POWERUP_BOSS_MIN_INTERVAL : Config.POWERUP_REGULAR_MIN_INTERVAL;
  const desiredPowerupStart = boss ? Config.POWERUP_BOSS_INTERVAL : Config.POWERUP_REGULAR_INTERVAL;
  powerupInterval = Math.max(desiredPowerupMin, Math.min(desiredPowerupStart, powerupInterval * Config.POWERUP_INTERVAL_DECREMENT_FACTOR));
}

function maybeSpawnObstacle() {
  if (boss) return; // no obstacles during boss
  const t = now();
  if (t - lastObstacleAt < obstacleInterval) return;

  obstacles.push(new Obstacle(Config.SCREEN_WIDTH + 40));
  lastObstacleAt = t;
}

function maybeSpawnEnemy() {
  if (boss) return;
  const t = now();
  if (t - lastEnemySpawnAt < enemyInterval) return;

  const type = Utils.weightedChoice(Config.ENEMY_SPAWN_TABLE, () => p5i.random()) || Config.ENEMY_TYPE.DRONE;
  const w = (type === Config.ENEMY_TYPE.TURRET) ? 46 : 50;
  const h = (type === Config.ENEMY_TYPE.TURRET) ? 46 : 40;

  let attempts = 0;
  while (attempts < Config.MAX_ENEMY_SPAWN_ATTEMPTS) {
    const x = Config.SCREEN_WIDTH + p5i.random(10, 60);
    const y = (type === Config.ENEMY_TYPE.TURRET)
      ? p5i.random() < 0.5
        ? 30
        : Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - h - 30
      : p5i.random(40, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - h - 40);

    if (Utils.isClearForSpawn(x, y, w, h, { player, obstacles, enemies, powerups })) {
      enemies.push(new Enemy(x, y, type));
      lastEnemySpawnAt = t;
      return;
    }
    attempts++;
  }
}

function maybeSpawnPowerup() {
  const t = now();
  if (t - lastPowerupAt < powerupInterval) return;

  const table = boss ? Config.POWERUP_SPAWN_TABLE_DURING_BOSS : Config.POWERUP_SPAWN_TABLE;
  const type = Utils.weightedChoice(table, () => p5i.random()) || Config.POWERUP_TYPE.COIN;

  const y = p5i.random(60, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - 90);
  powerups.push(new Powerup(Config.SCREEN_WIDTH + 40, y, type));
  lastPowerupAt = t;
}

function maybeSpawnBoss() {
  if (boss) return;
  const t = now();
  if (t - lastBossWaveAt < Config.BOSS_SPAWN_INTERVAL_MS) return;

  // pick a boss type based on score
  let type = Config.BOSS_TYPE.TANK;
  if (score > 250) type = Config.BOSS_TYPE.SHIP;
  if (score > 700) type = Config.BOSS_TYPE.FINAL;

  boss = new Boss(type);

  // reset pacing for boss-specific powerups
  powerupInterval = Config.POWERUP_BOSS_INTERVAL;
  lastBossWaveAt = t;
}

function handleCollisions() {
  if (!player) return;

  // ground collision ends the run (keeps the "flappy" tension)
  if (player.onGround() && !playerIsFlying && player.y >= Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - player.h - 0.5) {
    // allow standing; don't auto-end
  }

  // obstacle collision
  for (const o of obstacles) {
    if (o.collides(player)) {
      if (player.hit()) return endGame();
    }
  }

  // enemy collision
  for (const e of enemies) {
    if (e.collides(player)) {
      if (player.hit()) return endGame();
      e.dead = true;
      spawnExplosionParticles(e.x + e.w / 2, e.y + e.h / 2, 18);
    }
  }

  // enemy projectile collision
  for (const pr of enemyProjectiles) {
    if (pr.dead) continue;
    if (Utils.collideRectCircle(player.x, player.y, player.w, player.h, pr.x, pr.y, pr.r * 2, p5i)) {
      pr.dead = true;
      spawnImpactParticles(pr.x, pr.y);
      if (player.hit()) return endGame();
    }
  }

  // powerup pickup
  for (const pu of powerups) {
    if (pu.dead) continue;
    if (pu.collides(player)) {
      pu.dead = true;
      pu.apply();
    }
  }

  // player projectile hits enemies/boss
  for (const pr of projectiles) {
    if (pr.dead) continue;

    for (const e of enemies) {
      if (e.dead) continue;
      if (Utils.collideRectCircle(e.x, e.y, e.w, e.h, pr.x, pr.y, pr.r * 2, p5i)) {
        pr.dead = true;
        e.hit();
        break;
      }
    }

    if (!pr.dead && boss) {
      if (Utils.collideRectCircle(boss.x, boss.y, boss.w, boss.h, pr.x, pr.y, pr.r * 2, p5i)) {
        pr.dead = true;
        const killed = boss.hit(1);
        if (killed) {
          boss = null;
          victoryMessageUntil = now() + Config.TEMPORARY_WIN_MESSAGE_DURATION_MS;
          score += 100;
          // resume non-boss pacing
          powerupInterval = Config.POWERUP_REGULAR_INTERVAL;
          lastBossWaveAt = now(); // start cooldown
        }
      }
    }
  }

  // boss collision
  if (boss && boss.collides(player)) {
    if (player.hit()) return endGame();
  }
}

// --- Rendering ---
function drawBackground() {
  const p = p5i;

  // sky gradient-ish
  p.noStroke();
  p.fill(Config.C_SKY_OVERCAST);
  p.rect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
  p.fill(Config.C_SKY_HORIZON);
  p.rect(0, Config.SCREEN_HEIGHT * 0.6, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT * 0.4);

  // ground
  p.fill(Config.C_GROUND_DETAIL);
  p.rect(0, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET, Config.SCREEN_WIDTH, Config.GROUND_Y_OFFSET);
}

function drawHUD() {
  const p = p5i;
  p.push();

  // hud bg
  p.noStroke();
  p.fill(Config.C_HUD_BG);
  p.rect(12, 12, 260, 84, 10);

  p.fill(Config.C_TEXT_SCORE);
  p.textSize(20);
  p.textAlign(p.LEFT, p.TOP);
  p.text(`Score: ${score}`, 24, 22);

  // fuel bar
  const fuelPct = Utils.clamp(jetpackFuel / Config.MAX_FUEL, 0, 1);
  const barX = 24, barY = 54, barW = 200, barH = 14;
  p.fill(0, 0, 0, 120);
  p.rect(barX, barY, barW, barH, 6);
  p.fill(0, 180, 160);
  p.rect(barX, barY, barW * fuelPct, barH, 6);

  // effect indicators
  const t = now();
  const indicators = [];
  if (t < effects.weaponUntil) indicators.push("WEAPON");
  if (t < effects.spreadUntil) indicators.push("SPREAD");
  if (t < effects.rapidUntil) indicators.push("RAPID");
  if (t < effects.multiplierUntil) indicators.push("x2");
  if (t < effects.magnetUntil) indicators.push("MAG");
  if (t < effects.speedUntil) indicators.push("SPD");
  if (effects.shieldCharges > 0) indicators.push(`SHIELD:${effects.shieldCharges}`);

  p.fill(Config.C_TEXT_MAIN);
  p.textSize(12);
  p.text(indicators.join("  "), 24, 74);

  p.pop();
}

function drawVictoryOverlay() {
  const p = p5i;
  const t = now();
  if (t > victoryMessageUntil) return;

  p.push();
  p.noStroke();
  p.fill(0, 0, 0, 140);
  p.rect(0, 0, Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);

  p.fill(Config.C_VICTORY_TEXT);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(42);
  p.text("TARGET DOWN", Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT / 2 - 20);

  p.fill(Config.C_VICTORY_SUBTEXT);
  p.textSize(18);
  p.text("Keep flying. Another wave will come.", Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT / 2 + 22);

  p.pop();
}

// --- Main loop ---
function updateGame() {
  // update speed based on effects
  gameSpeed = currentSpeed();
  updateDifficulty();

  player.update();

  maybeSpawnBoss();
  maybeSpawnObstacle();
  maybeSpawnEnemy();
  maybeSpawnPowerup();

  // update entities
  for (const o of obstacles) o.update();
  for (const e of enemies) e.update();
  for (const pu of powerups) pu.update();
  for (const pr of projectiles) pr.update();
  for (const pr of enemyProjectiles) pr.update();
  for (const pt of particles) pt.update();

  // scoring by passing obstacles
  for (const o of obstacles) {
    if (o.scoreIfPassed(player)) {
      const t = now();
      const mult = t < effects.multiplierUntil ? 2 : 1;
      score += 1 * mult;
    }
  }

  handleCollisions();

  // cleanup
  obstacles = obstacles.filter((o) => !o.isOffscreen());
  enemies = enemies.filter((e) => !e.dead);
  powerups = powerups.filter((p) => !p.dead);
  projectiles = projectiles.filter((p) => !p.dead);
  enemyProjectiles = enemyProjectiles.filter((p) => !p.dead);
  particles = particles.filter((p) => !p.dead);
}

function renderGame() {
  drawBackground();

  for (const o of obstacles) o.draw();
  for (const pu of powerups) pu.draw();
  for (const e of enemies) e.draw();
  if (boss) boss.draw();
  for (const pr of projectiles) pr.draw();
  for (const pr of enemyProjectiles) pr.draw();
  for (const pt of particles) pt.draw();

  player.draw();
  drawHUD();
  drawVictoryOverlay();
}

// --- p5 sketch (instance mode) ---
const sketch = (p) => {
  p.preload = () => {
    // Optional sounds; if assets are missing, do not crash.
    try { bgMusic = p.loadSound("assets/background_music.mp3"); } catch {}
    try { jumpSound = p.loadSound("assets/jump.mp3"); } catch {}
    try { shootSound = p.loadSound("assets/player_projectile.mp3"); } catch {}
    try { hitSound = p.loadSound("assets/object_destroy.mp3"); } catch {}
  };

  p.setup = () => {
    p5i = p;

    const canvas = p.createCanvas(Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
    canvas.parent("game-container");
    p.pixelDensity(1);

    Config.defineColors(p);
    Config.updateExportedColors();

    p.textFont("Oswald");

    // audio config
    try {
      if (bgMusic && bgMusic.isLoaded()) {
        bgMusic.setLoop(true);
        bgMusic.setVolume(0.3);
      }
      if (jumpSound && jumpSound.isLoaded()) jumpSound.setVolume(0.6);
      if (shootSound && shootSound.isLoaded()) shootSound.setVolume(0.5);
      if (hitSound && hitSound.isLoaded()) hitSound.setVolume(0.8);
    } catch {}

    window.loadPlayerName();
    initFirebaseMaybe(); // fire and forget

    // start in menu
    window.currentScreen = "START";
    if (typeof window.showMainMenuButtons === "function") window.showMainMenuButtons(true);
    if (typeof window.showInGameControls === "function") window.showInGameControls(false);
    if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(false);

    resetGame();
  };

  p.draw = () => {
    if (!p5i) return;

    if (window.currentScreen !== "GAME") {
      // Still render a nice idle background
      drawBackground();
      // show a minimal idle frame
      if (player) player.draw();
      drawHUD();
      return;
    }

    if (!gamePaused) {
      updateGame();
    }
    renderGame();
  };

  // keyboard controls
  p.keyPressed = () => {
    if (window.currentScreen !== "GAME") return;

    if (p.key === " " || p.keyCode === 38) {
      playerIsFlying = true;
      window.triggerJumpSound();
    }
    if (p.key === "x" || p.key === "X") {
      playerShoot();
    }
    if (p.key === "p" || p.key === "P") {
      gamePaused = !gamePaused;
    }
  };

  p.keyReleased = () => {
    if (p.key === " " || p.keyCode === 38) {
      playerIsFlying = false;
    }
  };

  p.mousePressed = () => {
    if (window.currentScreen !== "GAME") return;
    // Left click shoot if weapon is active.
    if (p.mouseButton === p.LEFT) playerShoot();
  };
};

new window.p5(sketch);

// Expose pause toggle for debugging / potential UI hooks.
window.togglePause = () => {
  gamePaused = !gamePaused;
  return gamePaused;
};
