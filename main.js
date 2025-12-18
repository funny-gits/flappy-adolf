// main.js (clean rebuild, GitHub Pages safe)

import * as Config from "./config.js";
import * as Utils from "./utils.js";

let p5Instance;

// --- Game state ---
let player;
let obstacles = [];
let coins = [];

let score = 0;
let best = 0;

let gameSpeed = Config.INITIAL_GAME_SPEED;
let lastObstacleSpawnMs = 0;

let isFlying = false;
let startedAtMs = 0;

window.currentScreen = window.currentScreen || "START";
window.playerName = window.playerName || "Recruit";

// --- Minimal “audio” (no autoplay issues): only beep after a user gesture ---
let audioPrimed = false;
function primeAudioOnce() {
  if (audioPrimed) return;
  audioPrimed = true;
  // No autoplay music; keep it silent by default.
}
function playBeep() {
  // Optional: keep silent unless you want a real p5.sound implementation later.
}

// --- LocalStorage scoreboard (replaces Firebase so it can't crash) ---
function loadScores() {
  try {
    const raw = localStorage.getItem(Config.LOCAL_STORAGE_SCORES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}
function saveScores(arr) {
  try {
    localStorage.setItem(Config.LOCAL_STORAGE_SCORES_KEY, JSON.stringify(arr));
  } catch {}
}
function refreshBestFromScores() {
  const scores = loadScores();
  best = scores.length ? Math.max(...scores.map((s) => Number(s.score) || 0)) : 0;
}

// Exposed for index.html
window.displayHighScores = function () {
  const list = document.getElementById("highScoresList");
  if (!list) return;

  const scores = loadScores()
    .slice()
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    .slice(0, Config.MAX_HIGH_SCORES);

  list.innerHTML = "";
  if (!scores.length) {
    const li = document.createElement("li");
    li.textContent = "No records yet. Start a mission.";
    list.appendChild(li);
    return;
  }

  scores.forEach((s, idx) => {
    const li = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `${idx + 1}.`;

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = s.name || "Recruit";

    const val = document.createElement("span");
    val.className = "score-value";
    val.textContent = `${Number(s.score) || 0}`;

    const date = document.createElement("span");
    date.className = "score-date";
    date.textContent = s.date || "";

    li.append(rank, name, val, date);
    list.appendChild(li);
  });
};

window.saveHighScore = function (newScore) {
  const n = Number(newScore);
  if (!Number.isFinite(n) || n <= 0) return;

  const now = new Date();
  const date =
    `${String(now.getDate()).padStart(2, "0")}/` +
    `${String(now.getMonth() + 1).padStart(2, "0")}/` +
    `${now.getFullYear()} ` +
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`;

  const scores = loadScores();
  scores.push({ name: window.playerName || "Recruit", score: Math.floor(n), date });
  saveScores(scores);
  refreshBestFromScores();
};

window.loadPlayerName = function () {
  const stored = localStorage.getItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY);
  window.playerName = stored || "Recruit";
};

window.savePlayerName = function (name) {
  const clean = String(name || "").trim().slice(0, 15);
  if (!clean) return;
  window.playerName = clean;
  try {
    localStorage.setItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY, clean);
  } catch {}
};

window.deletePlayerName = function () {
  try {
    localStorage.removeItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY);
  } catch {}
  window.playerName = "Recruit";
};

// --- Core objects ---
class Player {
  constructor() {
    this.r = Config.PLAYER_SIZE / 2;
    this.x = Config.PLAYER_START_X;
    this.y = Config.SCREEN_HEIGHT * 0.5;
    this.vy = 0;
    this.dead = false;
  }

  update(dt) {
    // Physics
    this.vy += Config.GRAVITY * (dt / (1000 / 60));
    if (isFlying) this.vy += Config.THRUST * (dt / (1000 / 60));
    this.y += this.vy * (dt / (1000 / 60));

    // Bounds
    const groundY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET;
    if (this.y + this.r > groundY) {
      this.y = groundY - this.r;
      this.vy = 0;
      this.dead = true;
    }
    if (this.y - this.r < 0) {
      this.y = this.r;
      this.vy = 0;
    }
  }

  draw() {
    const { player, playerAccent } = Config.COLORS;
    p5Instance.noStroke();
    p5Instance.fill(...player);
    p5Instance.circle(this.x, this.y, this.r * 2);

    p5Instance.fill(...playerAccent);
    p5Instance.circle(this.x + this.r * 0.35, this.y - this.r * 0.2, this.r * 0.35);
  }

  collidesRect(rx, ry, rw, rh) {
    return Utils.collideRectCircle(rx, ry, rw, rh, this.x, this.y, this.r * 2, p5Instance);
  }

  collidesCoin(c) {
    const d = p5Instance.dist(this.x, this.y, c.x, c.y);
    return d <= this.r + c.r;
  }
}

class ObstaclePair {
  constructor(x, gapY, gapH) {
    this.x = x;
    this.w = Config.OBSTACLE_WIDTH;
    this.gapY = gapY;
    this.gapH = gapH;
    this.passed = false;
  }

  update(dt) {
    this.x -= gameSpeed * (dt / (1000 / 60));
  }

  draw() {
    const { obstacle, obstacleEdge } = Config.COLORS;
    const topH = Math.max(0, this.gapY - this.gapH / 2);
    const bottomY = this.gapY + this.gapH / 2;
    const bottomH = (Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET) - bottomY;

    p5Instance.noStroke();
    p5Instance.fill(...obstacle);
    p5Instance.rect(this.x, 0, this.w, topH, 6);
    p5Instance.rect(this.x, bottomY, this.w, bottomH, 6);

    p5Instance.noFill();
    p5Instance.stroke(...obstacleEdge);
    p5Instance.strokeWeight(2);
    p5Instance.rect(this.x + 1, 1, this.w - 2, topH - 2, 6);
    p5Instance.rect(this.x + 1, bottomY + 1, this.w - 2, bottomH - 2, 6);
    p5Instance.noStroke();
  }

  isOffscreen() {
    return this.x + this.w < 0;
  }

  collidesPlayer(pl) {
    const topH = Math.max(0, this.gapY - this.gapH / 2);
    const bottomY = this.gapY + this.gapH / 2;
    const bottomH = (Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET) - bottomY;

    // top rect
    if (pl.collidesRect(this.x, 0, this.w, topH)) return true;
    // bottom rect
    if (pl.collidesRect(this.x, bottomY, this.w, bottomH)) return true;

    return false;
  }
}

class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 10;
    this.taken = false;
  }

  update(dt) {
    this.x -= gameSpeed * (dt / (1000 / 60));
  }

  draw() {
    const { coin } = Config.COLORS;
    p5Instance.noStroke();
    p5Instance.fill(...coin);
    p5Instance.circle(this.x, this.y, this.r * 2);
    p5Instance.fill(255, 255, 255, 120);
    p5Instance.circle(this.x - this.r * 0.25, this.y - this.r * 0.25, this.r * 0.6);
  }

  isOffscreen() {
    return this.x + this.r < 0;
  }
}

// --- Game control functions (called by index.html buttons) ---
function hardReset() {
  player = new Player();
  obstacles = [];
  coins = [];

  score = 0;
  gameSpeed = Config.INITIAL_GAME_SPEED;
  lastObstacleSpawnMs = 0;

  isFlying = false;
  startedAtMs = p5Instance.millis();

  refreshBestFromScores();
}

window.resetGameValues = function () {
  hardReset();
};

window.setPlayerFlyingState = function (v) {
  primeAudioOnce();
  isFlying = Boolean(v);
};

window.stopPlayerFlying = function () {
  isFlying = false;
};

window.triggerJumpSound = function () {
  primeAudioOnce();
  playBeep();
};

window.triggerPlayerShoot = function () {
  // Shooting removed in this rebuild (keeps mechanics tight).
  // Kept as a no-op so your UI button doesn't crash.
  primeAudioOnce();
};

// --- Spawning ---
function spawnObstacle(nowMs) {
  const playableH = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET;
  const gapH = p5Instance.random(Config.OBSTACLE_GAP_MIN, Config.OBSTACLE_GAP_MAX);
  const margin = 80;
  const gapY = p5Instance.random(margin + gapH / 2, playableH - margin - gapH / 2);

  const x = Config.SCREEN_WIDTH + 40;
  obstacles.push(new ObstaclePair(x, gapY, gapH));

  if (p5Instance.random() < Config.COIN_SPAWN_CHANCE) {
    coins.push(new Coin(x + Config.OBSTACLE_WIDTH / 2, gapY));
  }
}

// --- Drawing helpers ---
function drawBackground() {
  const { bgTop, bgBottom, ground, groundDetail } = Config.COLORS;

  // vertical gradient
  for (let y = 0; y < Config.SCREEN_HEIGHT; y += 3) {
    const t = y / Config.SCREEN_HEIGHT;
    const c = [
      p5Instance.lerp(bgTop[0], bgBottom[0], t),
      p5Instance.lerp(bgTop[1], bgBottom[1], t),
      p5Instance.lerp(bgTop[2], bgBottom[2], t),
    ];
    p5Instance.stroke(c[0], c[1], c[2]);
    p5Instance.line(0, y, Config.SCREEN_WIDTH, y);
  }
  p5Instance.noStroke();

  // ground
  const groundY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET;
  p5Instance.fill(...ground);
  p5Instance.rect(0, groundY, Config.SCREEN_WIDTH, Config.GROUND_Y_OFFSET);

  p5Instance.fill(...groundDetail);
  const tick = (p5Instance.frameCount * gameSpeed) % 40;
  for (let x = -40; x < Config.SCREEN_WIDTH + 40; x += 40) {
    p5Instance.rect(x - tick, groundY + 12, 18, 4, 2);
  }
}

function drawHUD() {
  const { hudText, hudShadow } = Config.COLORS;
  p5Instance.textAlign(p5Instance.LEFT, p5Instance.TOP);
  p5Instance.textSize(20);

  const s = `Score: ${score}   Best: ${best}`;
  p5Instance.fill(...hudShadow);
  p5Instance.text(s, 21, 21);
  p5Instance.fill(...hudText);
  p5Instance.text(s, 20, 20);
}

function drawStartScreen() {
  p5Instance.textAlign(p5Instance.CENTER, p5Instance.CENTER);
  p5Instance.textSize(52);
  p5Instance.fill(240);
  p5Instance.text("JETPACK RUN", Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT * 0.35);

  p5Instance.textSize(20);
  p5Instance.fill(220);
  p5Instance.text(
    "Hold SPACE / Jump button to thrust.\nAvoid obstacles, grab coins.",
    Config.SCREEN_WIDTH / 2,
    Config.SCREEN_HEIGHT * 0.48
  );

  p5Instance.textSize(16);
  p5Instance.fill(200);
  p5Instance.text(
    `Codename: ${window.playerName || "Recruit"}`,
    Config.SCREEN_WIDTH / 2,
    Config.SCREEN_HEIGHT * 0.58
  );
}

function drawGameOverScreen() {
  p5Instance.textAlign(p5Instance.CENTER, p5Instance.CENTER);
  p5Instance.textSize(60);
  p5Instance.fill(240, 90, 90);
  p5Instance.text("MISSION FAILED", Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT * 0.38);

  p5Instance.textSize(26);
  p5Instance.fill(235);
  p5Instance.text(`Score: ${score}`, Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT * 0.50);
  p5Instance.text(`Best: ${best}`, Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT * 0.56);

  p5Instance.textSize(16);
  p5Instance.fill(200);
  p5Instance.text("Press R to retry", Config.SCREEN_WIDTH / 2, Config.SCREEN_HEIGHT * 0.66);
}

// --- p5 lifecycle ---
window.preload = function () {
  p5Instance = this;
  // No asset loading in this rebuild.
};

window.setup = function () {
  p5Instance = this;

  const canvas = p5Instance.createCanvas(Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
  canvas.parent("game-container");
  p5Instance.pixelDensity(1);

  window.loadPlayerName();
  hardReset();

  // Let index.html align the control overlay to canvas width
  document.documentElement.style.setProperty("--canvas-max-width", Config.SCREEN_WIDTH + "px");
};

function updateGame(dt) {
  const nowMs = p5Instance.millis();

  // Speed ramp
  const elapsedS = Math.max(0, (nowMs - startedAtMs) / 1000);
  gameSpeed = Config.INITIAL_GAME_SPEED + elapsedS * Config.SPEED_RAMP_PER_SECOND;

  // Spawn obstacles
  if (!lastObstacleSpawnMs || nowMs - lastObstacleSpawnMs >= Config.OBSTACLE_SPAWN_MS) {
    spawnObstacle(nowMs);
    lastObstacleSpawnMs = nowMs;
  }

  // Update entities
  player.update(dt);

  for (const o of obstacles) o.update(dt);
  for (const c of coins) c.update(dt);

  // Collisions + scoring
  for (const o of obstacles) {
    if (o.collidesPlayer(player)) player.dead = true;

    if (!o.passed && o.x + o.w < player.x) {
      o.passed = true;
      score += 1;
    }
  }

  for (const c of coins) {
    if (!c.taken && player.collidesCoin(c)) {
      c.taken = true;
      score += 2;
    }
  }

  // Cleanup
  obstacles = obstacles.filter((o) => !o.isOffscreen());
  coins = coins.filter((c) => !c.taken && !c.isOffscreen());

  // Death => game over
  if (player.dead) {
    window.currentScreen = "GAME_OVER";
    window.saveHighScore(score);
  }
}

window.draw = function () {
  drawBackground();

  if (window.currentScreen === "START") {
    drawStartScreen();
    if (typeof window.showMainMenuButtons === "function") window.showMainMenuButtons(true);
    if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(false);
    if (typeof window.showInGameControls === "function") window.showInGameControls(false);
    return;
  }

  if (window.currentScreen === "GAME") {
    const dt = p5Instance.deltaTime || (1000 / 60);
    updateGame(dt);

    // draw entities
    for (const o of obstacles) o.draw();
    for (const c of coins) c.draw();
    player.draw();

    drawHUD();

    if (typeof window.showMainMenuButtons === "function") window.showMainMenuButtons(false);
    if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(false);
    if (typeof window.showInGameControls === "function") window.showInGameControls(true);
    return;
  }

  if (window.currentScreen === "GAME_OVER") {
    drawGameOverScreen();
    if (typeof window.showMainMenuButtons === "function") window.showMainMenuButtons(false);
    if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(true);
    if (typeof window.showInGameControls === "function") window.showInGameControls(false);
    return;
  }

  if (window.currentScreen === "SCOREBOARD") {
    // index.html shows/hides the modal; we just keep the canvas calm
    if (typeof window.showMainMenuButtons === "function") window.showMainMenuButtons(false);
    if (typeof window.showGameOverButtons === "function") window.showGameOverButtons(false);
    if (typeof window.showInGameControls === "function") window.showInGameControls(false);
  }
};

// Keyboard controls (match index.html expectations)
window.keyPressed = function () {
  if (p5Instance.key === " ") {
    if (window.currentScreen === "START") {
      window.currentScreen = "GAME";
      window.resetGameValues();
      window.setPlayerFlyingState(true);
      window.triggerJumpSound();
    } else if (window.currentScreen === "GAME") {
      window.setPlayerFlyingState(true);
      window.triggerJumpSound();
    }
    return false;
  }

  if (window.currentScreen === "GAME_OVER") {
    if (p5Instance.key === "r" || p5Instance.key === "R") {
      window.currentScreen = "GAME";
      window.resetGameValues();
      return false;
    }
  }
};

window.keyReleased = function () {
  if (window.currentScreen === "GAME" && p5Instance.key === " ") {
    window.stopPlayerFlying();
  }
};
