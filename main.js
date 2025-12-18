// main.js (formerly jetpack_v2.js)

// --- Module Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import * as Config from './config.js';
import * as Utils from './utils.js';

// --- Game State Variables (Many constants are now in Config) ---
let player;
let bgMusic;
let jumpSound;
let playerProjectileSound;
let enemyProjectileSound;
let objectDestroySound;
let playerProjectiles = [], enemyProjectiles = [], enemies = [], obstacles = [], powerups = [], particles = [];
let boss = null, bossApproaching = false, pendingBoss = null;

let activePowerups = {};
let score = 0, highScores = [], highScore = 0;
let coinsCollectedThisRun = 0, scoreMultiplier = 1;
let jetpackFuel = Config.MAX_FUEL; // Use from Config
let gameSpeed = Config.INITIAL_GAME_SPEED; // Use from Config
let baseGameSpeed = Config.INITIAL_GAME_SPEED; // Use from Config
let playerIsFlying = false, playerCanShoot = true, playerShootCooldown = 0;

window.currentScreen = "START";
let gamePaused = false;

let lastObstacleTime = 0, lastPowerupTime = 0, lastEnemySpawnTime = 0;
let enemySpawnInterval = Config.ENEMY_START_INTERVAL; // Use from Config
let obstacleInterval = Config.OBSTACLE_START_INTERVAL; // Use from Config
let powerupInterval = Config.POWERUP_REGULAR_INTERVAL; // Use from Config

let weaponSystemActive = false, weaponSystemTimeLeft = 0, currentWeaponMode = "STANDARD", weaponSystemShootTimer = 0;
let distanceTraveled = 0;
let bossCount = 0;
let bossCycleDefeats = 0;
let timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS; // Use from Config

let gameStartTime = 0, gameElapsedTime = 0;

let temporaryWinMessageActive = false;
let temporaryWinMessageTimer = 0;

let postWinModeActive = false;

window.playerName = "Player";
let scoreboardDisplayedAfterGameOver = false;

// --- Firebase Variables ---
let db, auth, userId = "anonymous", isAuthReady = false;
// Firebase config is now imported from config.js
const appId = typeof __app_id !== "undefined" ? __app_id : Config.DEFAULT_APP_ID;
--- a/main.js
+++ b/main.js
@@
-const firebaseConfig = typeof __firebase_config !== "undefined" ... JSON.parse(__firebase_config) : Config.DEFAULT_FIREBASE_CONFIG;
+let firebaseConfig = Config.DEFAULT_FIREBASE_CONFIG;
+try {
+  // These globals exist on some Firebase hosting environments, but NOT on GitHub Pages.
+  if (typeof window.__firebase_config !== "undefined" && window.__firebase_config) {
+    firebaseConfig = JSON.parse(window.__firebase_config);
+  }
+} catch (e) {
+  console.warn("Firebase: failed to parse __firebase_config, using defaults.", e);
+  firebaseConfig = Config.DEFAULT_FIREBASE_CONFIG;
+}


// --- p5.js Instance Variable ---
// This will hold the p5 instance, useful for passing to module functions that need it.
let p5Instance;


window.preload = function () {
  p5Instance = this; // Capture the p5 instance
  try {
    // Sound loading remains largely the same, ensure paths are correct
    bgMusic = p5Instance.loadSound("assets/background_music.mp3");
    jumpSound = p5Instance.loadSound("assets/jump.mp3");
    playerProjectileSound = p5Instance.loadSound("assets/player_projectile.mp3");
    enemyProjectileSound = p5Instance.loadSound("assets/projectile.mp3");
    objectDestroySound = p5Instance.loadSound("assets/object_destroy.mp3");

    bgMusic.setVolume(0.3);
    bgMusic.setLoop(true);
    jumpSound.setVolume(0.6);
    playerProjectileSound.setVolume(0.5);
    enemyProjectileSound.setVolume(0.5);
    objectDestroySound.setVolume(0.8);
  } catch (e) {
    console.error("Error loading sounds. Using dummy sound objects.", e);
    const dummySound = {
      play: () => {}, setVolume: () => {}, setLoop: () => {},
      isLoaded: () => true, rate: () => {}, onended: () => {},
    };
    bgMusic = jumpSound = playerProjectileSound = enemyProjectileSound = objectDestroySound = dummySound;
  }
};

class BackgroundElement {
  constructor(x, y, w, h, type, speedFactor, color1, color2 = null) {
    this.initialX = x; this.x = x; this.y = y; this.w = w; this.h = h;
    this.type = type; this.speedFactor = speedFactor; this.color1 = color1; this.color2 = color2 || color1;
    this.noiseOffsetX = p5Instance.random(1000); this.noiseOffsetY = p5Instance.random(1000); this.bannerSeed = p5Instance.random(100);
    this.wreckRotation = p5Instance.random(-0.15, 0.15); this.emberTime = 0;
  }
  update() {
    this.x -= gameSpeed * this.speedFactor * (p5Instance.deltaTime / (1000 / 60));
    if (this.x + this.w < -100) {
      this.x = Config.SCREEN_WIDTH + p5Instance.random(100, 300); this.bannerSeed = p5Instance.random(100);
      this.noiseOffsetX = p5Instance.random(1000); this.noiseOffsetY = p5Instance.random(1000);
      if (this.type === 'building') { this.h = p5Instance.random(Config.SCREEN_HEIGHT * 0.4, Config.SCREEN_HEIGHT * 0.7); this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h; this.w = p5Instance.random(80, 160); }
      else if (this.type === 'pillar') { this.h = p5Instance.random(Config.SCREEN_HEIGHT * 0.25, Config.SCREEN_HEIGHT * 0.55); this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h; this.w = p5Instance.random(25, 55); }
      else if (this.type === 'rubble') { this.h = p5Instance.random(15, 45); this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h; this.w = p5Instance.random(40, 90); }
      else if (this.type === 'static_wreck') { this.w = p5Instance.random(70, 110); this.h = p5Instance.random(35, 55); this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h + p5Instance.random(0,10); this.wreckRotation = p5Instance.random(-0.1, 0.1); }
      else if (this.type === 'banner_pole') { this.w = p5Instance.random(40, 60); this.h = p5Instance.random(60, 100); this.y = p5Instance.random(Config.SCREEN_HEIGHT * 0.1, Config.SCREEN_HEIGHT * 0.3); }
    }
  }
  show() { p5Instance.noStroke();
    if (this.type === 'building') {
        p5Instance.fill(this.color1); p5Instance.rect(this.x, this.y, this.w, this.h); p5Instance.fill(this.color1); p5Instance.beginShape(); p5Instance.vertex(this.x, this.y);
        for (let i = 0; i <= 10; i++) { let stepX = this.x + (this.w / 10) * i; let stepY = this.y - p5Instance.noise(this.noiseOffsetX + i * 0.3) * this.h * 0.18; p5Instance.vertex(stepX, stepY); }
        p5Instance.vertex(this.x + this.w, this.y); p5Instance.vertex(this.x + this.w, this.y + p5Instance.random(5,15)); p5Instance.vertex(this.x, this.y + p5Instance.random(5,15)); p5Instance.endShape(p5Instance.CLOSE); p5Instance.fill(this.color2);
        for (let i = 0; i < p5Instance.random(2, 6); i++) { let spotX = this.x + p5Instance.random(this.w * 0.1, this.w * 0.8); let spotY = this.y + p5Instance.random(this.h * 0.1, this.h * 0.8); let spotW = p5Instance.random(this.w * 0.15, this.w * 0.35); let spotH = p5Instance.random(this.h * 0.1, this.h * 0.25); p5Instance.rect(spotX, spotY, spotW, spotH); p5Instance.stroke(Config.C_PILLAR_DARK); p5Instance.strokeWeight(p5Instance.random(1,2)); if(p5Instance.random() < 0.6) p5Instance.line(spotX + p5Instance.random(spotW*0.2), spotY + p5Instance.random(spotH*0.2), spotX + spotW - p5Instance.random(spotW*0.2), spotY + spotH - p5Instance.random(spotH*0.2)); if(p5Instance.random() < 0.4) p5Instance.line(spotX + spotW - p5Instance.random(spotW*0.2), spotY + p5Instance.random(spotH*0.2), spotX + p5Instance.random(spotW*0.2), spotY + spotH - p5Instance.random(spotH*0.2)); p5Instance.noStroke(); }
        if (p5Instance.noise(this.noiseOffsetX + 100) < 0.4) { let glowX = this.x + this.w / 2; let glowY = this.y - p5Instance.random(5,25); let flicker = p5Instance.noise(this.noiseOffsetY + p5Instance.frameCount * 0.05); p5Instance.fill(Config.C_FIRE_GLOW_STRONG.levels[0], Config.C_FIRE_GLOW_STRONG.levels[1], Config.C_FIRE_GLOW_STRONG.levels[2], 30 + flicker * 80); p5Instance.ellipse(glowX, glowY, this.w * (0.4 + flicker * 0.25), this.h * (0.15 + flicker * 0.15)); }
        if (p5Instance.noise(this.bannerSeed) < 0.3) { let bannerW = this.w * 0.25; let bannerH = this.h * 0.4;  let bannerX = this.x + this.w * 0.1 + p5Instance.noise(this.bannerSeed + 10) * (this.w * 0.5 - bannerW); let bannerY = this.y + this.h * 0.1 + p5Instance.noise(this.bannerSeed + 20) * (this.h * 0.4 - bannerH); bannerW = p5Instance.max(20, bannerW); bannerH = p5Instance.max(30, bannerH); Utils.drawFauxBanner(p5Instance, bannerX, bannerY, bannerW, bannerH, Config.C_BANNER_BG_RED, Config.C_BANNER_CIRCLE_WHITE, Config.C_BANNER_SYMBOL_BLACK); } // Pass p5Instance
    } else if (this.type === 'pillar') {
        p5Instance.fill(this.color1); p5Instance.rect(this.x, this.y, this.w, this.h, 2); p5Instance.fill(this.color2); p5Instance.stroke(this.color2); p5Instance.strokeWeight(1.5); p5Instance.line(this.x + this.w * 0.3, this.y + this.h * 0.2, this.x + this.w * 0.7, this.y + this.h * 0.4); p5Instance.line(this.x + this.w * 0.2, this.y + this.h * 0.8, this.x + this.w * 0.8, this.y + this.h * 0.7); p5Instance.noStroke(); for (let i = 0; i < p5Instance.random(1, 3); i++) { p5Instance.rect(this.x, this.y + this.h * (0.2 + i * 0.25), this.w, p5Instance.random(3, 6), 1); }
    } else if (this.type === 'rubble') {
        p5Instance.fill(this.color1); for(let i=0; i< p5Instance.random(2,4); i++){ p5Instance.beginShape(); p5Instance.vertex(this.x + p5Instance.random(-5,5), this.y + this.h + p5Instance.random(-3,3)); p5Instance.vertex(this.x + this.w * 0.2 + p5Instance.random(-5,5), this.y + p5Instance.random(-5,5) + this.h*0.5); p5Instance.vertex(this.x + this.w * 0.5 + p5Instance.random(-5,5), this.y + p5Instance.random(-5,5)); p5Instance.vertex(this.x + this.w * 0.8 + p5Instance.random(-5,5), this.y + p5Instance.random(-5,5) + this.h*0.5); p5Instance.vertex(this.x + this.w + p5Instance.random(-5,5), this.y + this.h + p5Instance.random(-3,3)); p5Instance.endShape(p5Instance.CLOSE); }
        p5Instance.fill(this.color2); for(let i=0; i<p5Instance.random(1,3); i++){ p5Instance.rect(this.x + p5Instance.random(this.w*0.1, this.w*0.3), this.y + p5Instance.random(this.h*0.3, this.h*0.5), p5Instance.random(this.w*0.2, this.w*0.5), p5Instance.random(this.h*0.2, this.h*0.4), 1); }
        if (p5Instance.noise(this.noiseOffsetX + p5Instance.frameCount * 0.02) < 0.3) { p5Instance.fill(Config.C_SMOKE_EFFECT.levels[0], Config.C_SMOKE_EFFECT.levels[1], Config.C_SMOKE_EFFECT.levels[2], 20 + p5Instance.noise(this.noiseOffsetY + p5Instance.frameCount * 0.03) * 30); p5Instance.ellipse(this.x + this.w/2 + p5Instance.random(-5,5), this.y - p5Instance.random(5,10), p5Instance.random(10,20), p5Instance.random(15,25)); }
        this.emberTime += p5Instance.deltaTime; if (this.emberTime > 100) { this.emberTime = 0; if (p5Instance.random() < 0.2) { let emberX = this.x + p5Instance.random(this.w); let emberY = this.y + p5Instance.random(this.h * 0.5, this.h); let emberSize = p5Instance.random(2, 5); let emberAlpha = 100 + p5Instance.noise(this.noiseOffsetX + p5Instance.frameCount * 0.1) * 155; p5Instance.fill(Config.C_PARTICLE_EMBER.levels[0], Config.C_PARTICLE_EMBER.levels[1], Config.C_PARTICLE_EMBER.levels[2], emberAlpha); p5Instance.ellipse(emberX, emberY, emberSize, emberSize); } }
    } else if (this.type === 'static_wreck') {
        p5Instance.push(); p5Instance.translate(this.x + this.w / 2, this.y + this.h / 2); p5Instance.rotate(this.wreckRotation); let tankColor = p5Instance.random() < 0.5 ? Config.C_ENEMY_DRONE : Config.C_BOSS_TANK; p5Instance.fill(tankColor); p5Instance.noStroke(); p5Instance.rect(-this.w / 2, -this.h / 2 + this.h * 0.1, this.w, this.h * 0.7, 2); p5Instance.rect(-this.w * 0.25, -this.h / 2 - this.h * 0.2, this.w * 0.5, this.h * 0.4, 1); p5Instance.rect(0, -this.h / 2 - this.h * 0.1, this.w * 0.55, this.h * 0.15, 1); p5Instance.fill(p5Instance.lerpColor(tankColor, p5Instance.color(0), 0.3)); p5Instance.rect(-this.w/2, this.h/2 - this.h*0.2, this.w, this.h*0.25, 2); for(let i = -this.w/2 + this.w*0.1; i < this.w/2 - this.w*0.1; i += this.w*0.25){ p5Instance.ellipse(i, this.h/2 - this.h*0.075, this.w*0.15, this.w*0.15); } p5Instance.pop();
    } else if (this.type === 'banner_pole') {
        p5Instance.fill(Config.C_PILLAR_DARK); p5Instance.rect(this.x - 3, this.y - 10, 6, this.h + 20, 1); Utils.drawFauxBanner(p5Instance, this.x, this.y, this.w, this.h, Config.C_BANNER_BG_RED, Config.C_BANNER_CIRCLE_WHITE, Config.C_BANNER_SYMBOL_BLACK); // Pass p5Instance
    }
  }
}
let backgroundElements = []; let smokeParticles = []; let bgOffset1 = 0;

window.setup = function () {
  p5Instance = this; // Capture the p5 instance globally for this sketch
  console.log("p5.js setup() called!");
  let canvas = p5Instance.createCanvas(Config.SCREEN_WIDTH, Config.SCREEN_HEIGHT);
  canvas.parent("game-container");
  p5Instance.pixelDensity(1);
  Config.defineColors(p5Instance); // Initialize colors using the p5 instance
  Config.updateExportedColors(); // Ensure exported color variables are updated

  p5Instance.textFont("Oswald");
  p5Instance.noiseSeed(Date.now());
  resetGameValues(); // resetGame needs access to p5Instance for random, etc.
  window.currentScreen = "START";

  document.documentElement.style.setProperty(
    "--canvas-max-width",
    Config.SCREEN_WIDTH + "px"
  );

  try {
    const app = initializeApp(firebaseConfig);
    try {
+    if (!firebaseConfig || typeof firebaseConfig !== "object") {
+      throw new Error("Firebase disabled: missing firebaseConfig options");
+    }
+    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        console.log("Firebase: User signed in with UID:", userId);
      } else {
        try {
          if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
          if (auth.currentUser) {
            userId = auth.currentUser.uid;
            console.log("Firebase: Signed in anonymously/custom. UID:", userId);
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
      if (typeof window.loadHighScores === "function") window.loadHighScores();
      if (typeof window.loadPlayerName === "function") window.loadPlayerName();
    });
  } catch (e) {
    console.error("Firebase initialization error:", e);
    isAuthReady = false;
    if (typeof window.loadPlayerName === "function") window.loadPlayerName();
    if (typeof window.showNameInput === "function") window.showNameInput(true);
  }

  if (bgMusic && bgMusic.isLoaded() && !bgMusic.isPlaying()) {
    bgMusic.loop();
  } else if (bgMusic) {
    bgMusic.onended(() => { if (window.currentScreen === "GAME" && !bgMusic.isPlaying()) bgMusic.loop(); });
  }
};

window.resetGameValues = function () {
  console.log("resetGameValues called!");
  player = new Player(); // Player class will need p5Instance if it uses p5 functions directly
  playerProjectiles = []; enemyProjectiles = []; obstacles = [];
  powerups = []; particles = []; enemies = [];
  boss = null; bossApproaching = false; pendingBoss = null;

  activePowerups = {}; scoreMultiplier = 1;
  jetpackFuel = Config.MAX_FUEL;
  gameSpeed = Config.INITIAL_GAME_SPEED; baseGameSpeed = Config.INITIAL_GAME_SPEED;
  score = 0; coinsCollectedThisRun = 0; distanceTraveled = 0;
  bossCount = 0; bossCycleDefeats = 0;
  if (player) player.shieldCharges = 0;

  timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS;
  obstacleInterval = Config.OBSTACLE_START_INTERVAL;
  powerupInterval = Config.POWERUP_REGULAR_INTERVAL;
  enemySpawnInterval = Config.ENEMY_START_INTERVAL;

  gameStartTime = p5Instance.millis(); gameElapsedTime = 0;
  scoreboardDisplayedAfterGameOver = false;

  postWinModeActive = false;
  temporaryWinMessageActive = false;
  temporaryWinMessageTimer = 0;

  backgroundElements = []; smokeParticles = []; bgOffset1 = 0;
  for (let i = 0; i < 6; i++) { let bX = p5Instance.random(Config.SCREEN_WIDTH*0.1,Config.SCREEN_WIDTH*1.8)+i*(Config.SCREEN_WIDTH/3.5); let bH = p5Instance.random(Config.SCREEN_HEIGHT*0.4,Config.SCREEN_HEIGHT*0.7); let bY = Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET-bH; let bW = p5Instance.random(80,160); backgroundElements.push(new BackgroundElement(bX,bY,bW,bH,'building',0.15,Config.C_BUILDING_DARK,Config.C_BUILDING_LIGHT));}
  for (let i = 0; i < 8; i++) { let pX = p5Instance.random(Config.SCREEN_WIDTH*0.1,Config.SCREEN_WIDTH*1.5)+i*(Config.SCREEN_WIDTH/4); let pH = p5Instance.random(Config.SCREEN_HEIGHT*0.25,Config.SCREEN_HEIGHT*0.55); let pY = Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET-pH; let pW = p5Instance.random(25,55); backgroundElements.push(new BackgroundElement(pX,pY,pW,pH,'pillar',0.3,Config.C_PILLAR_DARK,Config.C_PILLAR_LIGHT));}
  for (let i = 0; i < 4; i++) { let wX = p5Instance.random(Config.SCREEN_WIDTH*0.2,Config.SCREEN_WIDTH*1.8)+i*(Config.SCREEN_WIDTH/2); let wW = p5Instance.random(70,110); let wH = p5Instance.random(35,55); let wY = Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET-wH+p5Instance.random(0,10); backgroundElements.push(new BackgroundElement(wX,wY,wW,wH,'static_wreck',0.35,Config.C_ENEMY_DRONE));}
  for (let i = 0; i < 20; i++) { let rX = p5Instance.random(Config.SCREEN_WIDTH*0.05,Config.SCREEN_WIDTH*1.2)+i*(Config.SCREEN_WIDTH/6); let rH = p5Instance.random(15,45); let rY = Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET-rH; let rW = p5Instance.random(40,90); backgroundElements.push(new BackgroundElement(rX,rY,rW,rH,'rubble',0.5,Config.C_RUBBLE_DARK,Config.C_RUBBLE_LIGHT));}
  for (let i = 0; i < 2; i++) { let bX = p5Instance.random(Config.SCREEN_WIDTH*0.5,Config.SCREEN_WIDTH*2.0)+i*(Config.SCREEN_WIDTH/1.5); let bH = p5Instance.random(60,100); let bY = p5Instance.random(Config.SCREEN_HEIGHT*0.15,Config.SCREEN_HEIGHT*0.4); let bW = p5Instance.random(40,60); backgroundElements.push(new BackgroundElement(bX,bY,bW,bH,'banner_pole',0.25,Config.C_PILLAR_DARK));}
  for (let i = 0; i < 15; i++) { smokeParticles.push(new Particle(p5Instance.random(Config.SCREEN_WIDTH),p5Instance.random(Config.SCREEN_HEIGHT*0.05,Config.SCREEN_HEIGHT*0.4),Config.C_SMOKE_EFFECT,p5Instance.random(70,160),p5Instance.random(12000,20000),p5Instance.createVector(p5Instance.random(-0.1,0.1)*gameSpeed*0.05,p5Instance.random(-0.08,-0.2)),0.995,'ellipse'));}
  backgroundElements.sort((a,b)=>a.speedFactor-b.speedFactor);
};

// Player Control Functions (exposed to window for HTML buttons)
window.setPlayerFlyingState = function (isFlying) {
  if (isFlying) {
    if (jetpackFuel > 0) { playerIsFlying = true; }
    else { playerIsFlying = false; }
  } else {
    playerIsFlying = isFlying;
  }
};
window.triggerJumpSound = function () {
  if (jetpackFuel > 0 && jumpSound && jumpSound.isLoaded()) {
    jumpSound.rate(p5Instance.random(0.9, 1.1));
    jumpSound.play();
  }
};
window.stopPlayerFlying = function () { playerIsFlying = false; };
window.triggerPlayerShoot = function () {
  if (window.currentScreen === "GAME" && playerCanShoot && player) {
    if (currentWeaponMode === "SPREAD") {
      for (let i = -1; i <= 1; i++) { playerProjectiles.push( new PlayerProjectile( player.x + player.w, player.y + player.h / 2, i * 0.2 ) ); }
    } else {
      playerProjectiles.push( new PlayerProjectile(player.x + player.w, player.y + player.h / 2) );
    }
    playerShootCooldown = activePowerups[Config.POWERUP_TYPE.RAPID_FIRE] ? Config.PLAYER_SHOOT_COOLDOWN_TIME * 0.4 : Config.PLAYER_SHOOT_COOLDOWN_TIME;
    playerCanShoot = false;
  }
};

// Firebase High Score & Player Name Functions (exposed to window)
window.loadHighScores = function () {
    if (!isAuthReady || !db) { console.log("Firestore not ready, delaying loadHighScores."); return; }
    const highScoresCollectionRef = collection(db, `/artifacts/${appId}/public/data/highScores`);
    const q = query(highScoresCollectionRef, limit(100)); // Fetch more to allow for per-user filtering
    onSnapshot(q, (snapshot) => {
        const fetchedScores = []; snapshot.forEach((doc) => { const data = doc.data(); if (data.score !== undefined && data.name && data.userId) { fetchedScores.push(data); } });
        const uniqueUserHighScores = new Map(); fetchedScores.forEach(entry => { const currentHighest = uniqueUserHighScores.get(entry.userId); if (!currentHighest || entry.score > currentHighest.score) { uniqueUserHighScores.set(entry.userId, entry); } });
        let filteredScores = Array.from(uniqueUserHighScores.values()); filteredScores.sort((a, b) => b.score - a.score);
        highScores = filteredScores.slice(0, Config.MAX_HIGH_SCORES); highScore = highScores.length > 0 ? highScores[0].score : 0;
        if (typeof window.displayHighScores === 'function') { window.displayHighScores(); }
    }, (error) => { console.error("Error fetching high scores from Firestore:", error); });
};
window.saveHighScore = async function(newScore) {
    if (!isAuthReady || !db || !userId || userId === "anonymous" || userId.startsWith("anonymous_fallback")) { console.warn("Firestore not ready or user not properly authenticated, cannot save high score. UserID:", userId); return; }
    if (typeof newScore !== 'number' || newScore <= 0) { console.warn("Attempted to save invalid score:", newScore); return; }
    const now = new Date(); const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    try { await addDoc(collection(db, `/artifacts/${appId}/public/data/highScores`), { name: window.playerName, score: newScore, date: formattedDate, userId: userId, timestamp: serverTimestamp() }); } catch (e) { console.error("Firestore: Error adding document: ", e); }
};
window.displayHighScores = function() { /* This function is in index.html's script tag */ };
window.loadPlayerName = function() {
    const storedName = localStorage.getItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY); window.playerName = storedName || "Recruit";
    if (isAuthReady && typeof window.showNameInput === 'function') { window.showNameInput(true); }
};
window.savePlayerName = function(name) { if (name && name.trim().length > 0) { window.playerName = name.trim(); localStorage.setItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY, window.playerName); }};
window.deletePlayerName = function() { localStorage.removeItem(Config.LOCAL_STORAGE_PLAYER_NAME_KEY); window.playerName = "Recruit"; const nameInput = document.getElementById('nameInputField'); if (nameInput) nameInput.value = window.playerName; };


// --- Game Object Classes ---
// (Player, PlayerProjectile, EnemyProjectile, Enemy, Obstacle, Powerup, Boss, BossTank, BossShip, BossFinal, Particle)
// These classes will be moved to their own files eventually. For now, they need p5Instance for p5 functions.

class Player {
  constructor() {
    this.w = 30; this.h = 40;
    this.x = Config.PLAYER_START_X;
    this.y = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h - Config.PLAYER_START_Y_OFFSET;
    this.vy = 0; this.gravity = 0.55;
    this.lift = -10.0 * Config.JETPACK_FORCE_MULTIPLIER;
    this.onGround = false;
    this.headRadiusX = (this.w * 0.8) / 2;
    this.headRadiusY = (this.h * 0.7) / 2;
    this.headOffsetY = -this.h * 0.2;
    this.shieldCharges = 0;
  }
  update() {
    if (playerIsFlying && jetpackFuel > 0) {
        jetpackFuel -= Config.FUEL_CONSUMPTION_RATE * (p5Instance.deltaTime / (1000/60));
        if (jetpackFuel <= 0) { jetpackFuel = 0; playerIsFlying = false; }
        if(playerIsFlying){
            this.vy = this.lift; this.onGround = false;
            if (p5Instance.frameCount % 3 === 0) { particles.push(new Particle(this.x + this.w * 0.2, this.y + this.h * 0.9, Config.C_PARTICLE_JET, p5Instance.random(6, 12), p5Instance.random(150, 250), p5Instance.createVector(p5Instance.random(-0.5, 0.5), p5Instance.random(1, 3)), 0.95 )); }
        }
    } else {
      if (this.onGround) { jetpackFuel = p5Instance.min(Config.MAX_FUEL, jetpackFuel + Config.FUEL_RECHARGE_RATE * (p5Instance.deltaTime / (1000/60))); }
    }
    if (!playerIsFlying || jetpackFuel <= 0) { this.vy += this.gravity * (p5Instance.deltaTime / (1000/60)); }
    this.y += this.vy * (p5Instance.deltaTime / (1000/60));
    let groundLevel = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h;
    if (this.y >= groundLevel) { this.y = groundLevel; this.vy = 0; this.onGround = true; }
    else { this.onGround = false; }
    if (this.y < 0) { this.y = 0; this.vy *= -0.2; }
  }
  show() {
    p5Instance.stroke(20,30,40); p5Instance.strokeWeight(2); p5Instance.fill(Config.C_PLAYER); p5Instance.rect(this.x,this.y+this.h*0.2,this.w,this.h*0.8,3);
    p5Instance.beginShape();p5Instance.vertex(this.x+this.w*0.1,this.y+this.h*0.2);p5Instance.vertex(this.x+this.w*0.9,this.y+this.h*0.2);p5Instance.vertex(this.x+this.w,this.y+this.h*0.4);p5Instance.vertex(this.x+this.w*0.5,this.y+this.h*0.55);p5Instance.vertex(this.x,this.y+this.h*0.4);p5Instance.endShape(p5Instance.CLOSE);
    const headActualY = this.y + this.headOffsetY;
    p5Instance.fill(Config.C_SKIN_TONE); p5Instance.ellipse(this.x+this.w/2, headActualY, this.headRadiusX*1.8, this.headRadiusY*1.8);
    p5Instance.fill(Config.C_PLAYER.levels[0]-10,Config.C_PLAYER.levels[1]-10,Config.C_PLAYER.levels[2]-10);p5Instance.rect(this.x+this.w*0.15, headActualY - this.headRadiusY*1.2,this.w*0.7,this.headRadiusY*0.8,3);
    p5Instance.beginShape();p5Instance.vertex(this.x+this.w*0.1,headActualY - this.headRadiusY*0.4);p5Instance.vertex(this.x+this.w*0.9,headActualY - this.headRadiusY*0.4);p5Instance.vertex(this.x+this.w*0.8,headActualY - this.headRadiusY*0.1);p5Instance.vertex(this.x+this.w*0.2,headActualY - this.headRadiusY*0.1);p5Instance.endShape(p5Instance.CLOSE);
    p5Instance.fill(Config.C_MUSTACHE_COLOR);p5Instance.ellipse(this.x+this.w/2,headActualY + this.headRadiusY*0.4,4,3);
    p5Instance.fill(40,45,50);p5Instance.rect(this.x-12,this.y+this.h*0.05,15,this.h*0.9,5);p5Instance.stroke(Config.C_OBSTACLE);p5Instance.strokeWeight(1);p5Instance.line(this.x-12,this.y+this.h*0.3,this.x+3,this.y+this.h*0.3);p5Instance.line(this.x-12,this.y+this.h*0.7,this.x+3,this.y+this.h*0.7);p5Instance.fill(60,70,80);p5Instance.ellipse(this.x-4,this.y+this.h*0.2,10,10);p5Instance.ellipse(this.x-4,this.y+this.h*0.8,10,10);p5Instance.noStroke();
    p5Instance.fill(30,35,40);p5Instance.rect(this.x+this.w-5,this.y+this.h*0.6,35,8,2);p5Instance.rect(this.x+this.w+10,this.y+this.h*0.6+8,10,5,2);p5Instance.fill(80,50,30);p5Instance.rect(this.x+this.w-10,this.y+this.h*0.6-10,10,15,2);p5Instance.noStroke();
    const auraCenterX=this.x+this.w/2; const playerVisualTopY=(this.y+this.headOffsetY)-this.headRadiusY; const playerVisualBottomY=this.y+this.h; const playerVisualHeight=playerVisualBottomY-playerVisualTopY; const auraCenterY=playerVisualTopY+playerVisualHeight/2; const auraDiameterX=this.w*2.2; const auraDiameterY=playerVisualHeight*1.5;
    if(weaponSystemActive){let weaponColor=currentWeaponMode==="SPREAD"?Config.C_POWERUP_SPREAD:p5Instance.color(150,180,255,100);p5Instance.fill(weaponColor.levels[0],weaponColor.levels[1],weaponColor.levels[2],60+p5Instance.sin(p5Instance.frameCount*0.2)*20);p5Instance.ellipse(auraCenterX,auraCenterY,auraDiameterX,auraDiameterY);}
    if(this.shieldCharges>0){p5Instance.fill(Config.C_POWERUP_SHIELD.levels[0],Config.C_POWERUP_SHIELD.levels[1],Config.C_POWERUP_SHIELD.levels[2],80+p5Instance.sin(p5Instance.frameCount*0.15)*40);p5Instance.ellipse(auraCenterX,auraCenterY,auraDiameterX*1.05,auraDiameterY*1.05);}
  }
  hits(obj) { const playerHitboxX=this.x; const playerHitboxY=(this.y+this.headOffsetY)-this.headRadiusY; const playerHitboxW=this.w; const playerHitboxH=(this.y+this.h)-playerHitboxY; return Utils.collideRectRect(playerHitboxX,playerHitboxY,playerHitboxW,playerHitboxH,obj.x,obj.y,obj.w,obj.h); }
}

class PlayerProjectile {
  constructor(x,y,angle=0){this.x=x;this.y=y;this.w=20;this.h=4;this.baseSpeed=15+gameSpeed*1.2;this.vx=p5Instance.cos(angle)*this.baseSpeed;this.vy=p5Instance.sin(angle)*this.baseSpeed;this.color=Config.C_PLAYER_PROJECTILE;this.damage=10;this.angle=angle;if(playerProjectileSound&&playerProjectileSound.isLoaded()){playerProjectileSound.rate(p5Instance.random(0.9,1.1));playerProjectileSound.play();}}
  update(){this.x+=this.vx*(p5Instance.deltaTime/(1000/60));this.y+=this.vy*(p5Instance.deltaTime/(1000/60));}
  show(){p5Instance.push();p5Instance.translate(this.x,this.y);p5Instance.rotate(this.angle);p5Instance.fill(this.color);p5Instance.noStroke();p5Instance.rect(0,-this.h/2,this.w,this.h,1);p5Instance.triangle(this.w,-this.h/2,this.w,this.h/2,this.w+5,0);p5Instance.fill(this.color.levels[0],this.color.levels[1],this.color.levels[2],100);p5Instance.rect(-5,-this.h/2,5,this.h);p5Instance.pop();}
  offscreen(){return(this.x>p5Instance.width+this.w||this.x<-this.w||this.y<-this.h||this.y>p5Instance.height+this.h);}
  hits(target){return Utils.collideRectRect(this.x,this.y-this.h/2,this.w,this.h,target.x,target.y,target.w,target.h);}
}

class EnemyProjectile {
  constructor(x,y,angle){this.x=x;this.y=y;this.r=6;this.speed=2.5+gameSpeed*0.55;this.vx=p5Instance.cos(angle)*this.speed;this.vy=p5Instance.sin(angle)*this.speed;this.color=Config.C_ENEMY_PROJECTILE;this.rotation=p5Instance.random(p5Instance.TWO_PI);if(enemyProjectileSound&&enemyProjectileSound.isLoaded()){enemyProjectileSound.rate(p5Instance.random(0.9,1.1));enemyProjectileSound.play();}}
  update(){this.x+=this.vx*(p5Instance.deltaTime/(1000/60));this.y+=this.vy*(p5Instance.deltaTime/(1000/60));this.rotation+=0.1*(p5Instance.deltaTime/(1000/60));}
  show(){p5Instance.push();p5Instance.translate(this.x,this.y);p5Instance.rotate(this.rotation);p5Instance.fill(this.color);p5Instance.stroke(p5Instance.max(0,p5Instance.red(this.color)-30),p5Instance.max(0,p5Instance.green(this.color)-30),p5Instance.max(0,p5Instance.blue(this.color)-30));p5Instance.strokeWeight(1.5);p5Instance.rect(-this.r,-this.r,this.r*2,this.r*2,2);p5Instance.fill(this.color.levels[0],this.color.levels[1],this.color.levels[2],150);p5Instance.triangle(-this.r,-this.r,this.r,-this.r,0,-this.r*1.5);p5Instance.pop();}
  offscreen(){return(this.x<-this.r||this.x>p5Instance.width+this.r||this.y<-this.r||this.y>p5Instance.height+this.r);}
  hits(playerRect){return Utils.collideRectCircle(playerRect.x,playerRect.y,playerRect.w,playerRect.h,this.x,this.y,this.r*2, p5Instance);}
  hitsObstacle(obstacle){return Utils.collideRectCircle(obstacle.x,obstacle.y,obstacle.w,obstacle.h,this.x,this.y,this.r*2, p5Instance);}
}

class Enemy {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type; this.isDestroyed = false; this.droneAngle = p5Instance.random(p5Instance.TWO_PI);
    this.hasFiredInitialShot = false;
    if (this.type === "DRONE" || this.type === "INTERCEPTOR") {
      this.w = 50; this.h = 40; this.maxHealth = this.type === "INTERCEPTOR" ? 3 : 4;
      this.color = this.type === "INTERCEPTOR" ? Config.C_ENEMY_INTERCEPTOR : Config.C_ENEMY_DRONE;
      this.shootAccuracy = 0.18; this.baseShootCooldown = this.type === "INTERCEPTOR" ? 2200 : 2800; this.movementSpeedFactor = 1.0;
    } else { this.w = 45; this.h = 45; this.maxHealth = 6; this.color = Config.C_ENEMY_TURRET;
      this.shootAccuracy = 0.1; this.baseShootCooldown = 1800; this.movementSpeedFactor = 0.6; }
    this.health = this.maxHealth; this.shootCooldown = p5Instance.random(this.baseShootCooldown*0.5,this.baseShootCooldown*1.5);
  }
  fireShot() {
    if (!player || this.isDestroyed) return;
    let angleToPlayer = p5Instance.atan2((player.y + player.h / 2) - (this.y + this.h / 2), (player.x + player.w / 2) - (this.x + this.w / 2));
    let randomOffset = p5Instance.random(-this.shootAccuracy, this.shootAccuracy);
    enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h / 2, angleToPlayer + randomOffset));
  }
  update() {
    if (this.isDestroyed) return;
    this.x -= gameSpeed * this.movementSpeedFactor * (p5Instance.deltaTime/(1000/60));
    if (this.type === "DRONE" || this.type === "INTERCEPTOR") {
      let ySpeed = this.type === "INTERCEPTOR" ? 0.08 : 0.05; let yAmplitude = this.type === "INTERCEPTOR" ? 1.3 : 1.0;
      this.y += p5Instance.sin(this.droneAngle + p5Instance.frameCount * ySpeed) * yAmplitude * (p5Instance.deltaTime/(1000/60));
      this.y = p5Instance.constrain(this.y, this.h, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h * 1.5);
    }
    if (!this.hasFiredInitialShot && this.x < Config.SCREEN_WIDTH - this.w && this.x > 0 && this.y > 0 && this.y < Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - this.h && player) {
        this.fireShot(); this.hasFiredInitialShot = true;
        this.shootCooldown = (this.baseShootCooldown / (gameSpeed / Config.INITIAL_GAME_SPEED)) * 1.2;
        this.shootCooldown = p5Instance.max(this.baseShootCooldown / 2.5, this.shootCooldown);
    } else {
        this.shootCooldown -= p5Instance.deltaTime;
        if (this.shootCooldown <= 0 && this.x < Config.SCREEN_WIDTH - 20 && this.x > 20 && player) {
            this.fireShot();
            this.shootCooldown = this.baseShootCooldown / (gameSpeed / Config.INITIAL_GAME_SPEED);
            this.shootCooldown = p5Instance.max(this.baseShootCooldown / 3, this.shootCooldown);
        }
    }
  }
  show() { /* ... show logic ... uses p5Instance.fill, p5Instance.rect etc. and Config.C_... colors */
    if(this.isDestroyed)return;p5Instance.strokeWeight(2);p5Instance.stroke(p5Instance.max(0,p5Instance.red(this.color)-30),p5Instance.max(0,p5Instance.green(this.color)-30),p5Instance.max(0,p5Instance.blue(this.color)-30));p5Instance.fill(this.color);
    if(this.type==="DRONE"){p5Instance.rect(this.x,this.y+this.h*0.2,this.w,this.h*0.6,2);p5Instance.rect(this.x+this.w*0.2,this.y,this.w*0.6,5);p5Instance.rect(this.x+this.w*0.2,this.y+this.h-5,this.w*0.6,5);p5Instance.triangle(this.x+this.w,this.y+this.h*0.2,this.x+this.w,this.y+this.h*0.8,this.x+this.w+10,this.y+this.h*0.5);}
    else if(this.type==="INTERCEPTOR"){p5Instance.beginShape();p5Instance.vertex(this.x,this.y+this.h*0.5);p5Instance.vertex(this.x+this.w*0.8,this.y);p5Instance.vertex(this.x+this.w,this.y+this.h*0.5);p5Instance.vertex(this.x+this.w*0.8,this.y+this.h);p5Instance.endShape(p5Instance.CLOSE);p5Instance.rect(this.x+this.w*0.3,this.y+this.h*0.3,this.w*0.4,this.h*0.4);p5Instance.fill(100);p5Instance.ellipse(this.x+this.w-5,this.y+this.h/2,8,20);}
    else{p5Instance.rect(this.x,this.y+this.h*0.5,this.w,this.h*0.5,3);p5Instance.ellipse(this.x+this.w/2,this.y+this.h*0.5,this.w*0.8,this.h*0.8);p5Instance.push();p5Instance.translate(this.x+this.w/2,this.y+this.h*0.5);if(player){p5Instance.rotate(p5Instance.atan2((player.y+player.h/2)-(this.y+this.h*0.5),(player.x+player.w/2)-(this.x+this.w/2)));}p5Instance.fill(this.color.levels[0]-20,this.color.levels[1]-20,this.color.levels[2]-20);p5Instance.rect(0,-5,30,10,2);p5Instance.pop();}
    p5Instance.noStroke();if(this.health<this.maxHealth){p5Instance.fill(Config.C_BLOOD_RED);p5Instance.rect(this.x,this.y-12,this.w,6);p5Instance.fill(70,120,70);p5Instance.rect(this.x,this.y-12,p5Instance.map(this.health,0,this.maxHealth,0,this.w),6);}
  }
  takeDamage(amount) { /* ... takeDamage logic ... uses createExplosion, Config.C_PARTICLE_IMPACT */
    this.health-=amount;createExplosion(this.x+this.w/2,this.y+this.h/2,3,Config.C_PARTICLE_IMPACT,5*(1000/60),15*(1000/60));
    if(this.health<=0){this.isDestroyed=true;score+=this.maxHealth*20*scoreMultiplier;if(objectDestroySound&&objectDestroySound.isLoaded()){objectDestroySound.rate(p5Instance.random(0.9,1.1));objectDestroySound.play();}createExplosion(this.x+this.w/2,this.y+this.h/2,10+p5Instance.floor(this.maxHealth*2),this.color,5*(1000/60),25*(1000/60));if(p5Instance.random()<0.5){powerups.push(new Powerup(this.x+this.w/2,this.y+this.h/2,Config.POWERUP_TYPE.COIN));}else if(p5Instance.random()<0.15){powerups.push(new Powerup(this.x+this.w/2,this.y+this.h/2,Config.POWERUP_TYPE.FUEL_CELL));}}
  }
  offscreen() { return this.x < -this.w - 20; }
}

class Obstacle {
  constructor(x,y,w,h){this.x=x;this.y=y;this.w=w;this.h=h;this.color=Config.C_OBSTACLE;this.detailColor=p5Instance.lerpColor(this.color,p5Instance.color(0),0.3);}
  update(){this.x-=gameSpeed*(p5Instance.deltaTime/(1000/60));}
  show(){ /* ... show logic ... uses p5Instance.fill, p5Instance.rect etc. and Config.C_... colors */
    p5Instance.fill(this.color);p5Instance.stroke(this.detailColor);p5Instance.strokeWeight(2);p5Instance.rect(this.x,this.y,this.w,this.h,2);p5Instance.noStroke();p5Instance.fill(this.detailColor.levels[0],this.detailColor.levels[1],this.detailColor.levels[2],180);p5Instance.stroke(this.detailColor);p5Instance.strokeWeight(1.5);p5Instance.line(this.x+p5Instance.random(this.w*0.1,this.w*0.9),this.y,this.x+p5Instance.random(this.w*0.1,this.w*0.9),this.y+this.h);p5Instance.line(this.x,this.y+p5Instance.random(this.h*0.1,this.h*0.9),this.x+this.w,this.y+p5Instance.random(this.h*0.1,this.h*0.9));p5Instance.noStroke();for(let i=0;i<p5Instance.random(3,7);i++){p5Instance.rect(this.x+p5Instance.random(0,this.w-5),this.y+p5Instance.random(0,this.h-5),p5Instance.random(3,8),p5Instance.random(3,6),1);}p5Instance.fill(this.color.levels[0]-10,this.color.levels[1]-10,this.color.levels[2]-10);p5Instance.triangle(this.x,this.y,this.x+p5Instance.random(5,15),this.y,this.x,this.y+p5Instance.random(5,15));p5Instance.triangle(this.x+this.w,this.y,this.x+this.w-p5Instance.random(5,15),this.y,this.x+this.w,this.y+p5Instance.random(5,15));p5Instance.triangle(this.x,this.y+this.h,this.x+p5Instance.random(5,15),this.y+this.h,this.x,this.y+this.h-p5Instance.random(5,15));p5Instance.triangle(this.x+this.w,this.y+this.h,this.x+this.w-p5Instance.random(5,15),this.y+this.h,this.x+this.w,this.y+this.h-p5Instance.random(5,15));
  }
  offscreen(){return this.x<-this.w;}
}

class Powerup {
  constructor(x,y,type){this.x=x;this.y=y;this.s=type===Config.POWERUP_TYPE.COIN?20:30;this.initialY=y;this.bobOffset=p5Instance.random(p5Instance.TWO_PI);this.rotation=p5Instance.random(p5Instance.TWO_PI);this.type=type;switch(type){case Config.POWERUP_TYPE.COIN:this.color=Config.C_POWERUP_COIN;break;case Config.POWERUP_TYPE.FUEL_CELL:this.color=Config.C_POWERUP_FUEL;break;case Config.POWERUP_TYPE.SHIELD:this.color=Config.C_POWERUP_SHIELD;break;case Config.POWERUP_TYPE.WEAPON_SYSTEM:this.color=Config.C_POWERUP_WEAPON;break;case Config.POWERUP_TYPE.SPREAD_SHOT:this.color=Config.C_POWERUP_SPREAD;break;case Config.POWERUP_TYPE.RAPID_FIRE:this.color=Config.C_POWERUP_RAPID;break;case Config.POWERUP_TYPE.SCORE_MULTIPLIER:this.color=Config.C_POWERUP_MULTIPLIER;break;case Config.POWERUP_TYPE.COIN_MAGNET:this.color=Config.C_POWERUP_MAGNET;break;case Config.POWERUP_TYPE.SPEED_BURST:this.color=Config.C_POWERUP_SPEED;break;default:this.color=p5Instance.color(150);}}
  update(){if(this.type===Config.POWERUP_TYPE.COIN&&activePowerups[Config.POWERUP_TYPE.COIN_MAGNET]>0&&player){let aTP=p5Instance.atan2(player.y-this.y,player.x-this.x);let d=p5Instance.dist(player.x,player.y,this.x,this.y);let mF=p5Instance.map(d,0,200,5,0.5,true);this.x+=p5Instance.cos(aTP)*mF*(p5Instance.deltaTime/(1000/60));this.y+=p5Instance.sin(aTP)*mF*(p5Instance.deltaTime/(1000/60));}else{this.x-=gameSpeed*0.85*(p5Instance.deltaTime/(1000/60));}this.y=this.initialY+p5Instance.sin(p5Instance.frameCount*0.08+this.bobOffset)*8;if(this.type===Config.POWERUP_TYPE.COIN||this.type===Config.POWERUP_TYPE.SPREAD_SHOT)this.rotation+=0.08*(p5Instance.deltaTime/(1000/60));}
  show(){ /* ... show logic ... uses p5Instance.fill, p5Instance.rect etc. and Config.C_... colors */
    p5Instance.push();p5Instance.translate(this.x+this.s/2,this.y+this.s/2);if(this.type===Config.POWERUP_TYPE.COIN||this.type===Config.POWERUP_TYPE.SPREAD_SHOT)p5Instance.rotate(this.rotation);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.textSize(this.s*0.5);p5Instance.strokeWeight(2);p5Instance.stroke(p5Instance.max(0,p5Instance.red(this.color)-30),p5Instance.max(0,p5Instance.green(this.color)-30),p5Instance.max(0,p5Instance.blue(this.color)-30));p5Instance.fill(this.color);
    switch(this.type){case Config.POWERUP_TYPE.COIN:p5Instance.ellipse(0,0,this.s,this.s);p5Instance.noStroke();p5Instance.fill(p5Instance.lerpColor(this.color,p5Instance.color(255),0.2));p5Instance.ellipse(0,0,this.s*0.6,this.s*0.6);p5Instance.fill(0,0,0,200);p5Instance.text("$",0,1);break;
    case Config.POWERUP_TYPE.FUEL_CELL:p5Instance.rect(-this.s*0.3,-this.s*0.4,this.s*0.6,this.s*0.8,3);p5Instance.noStroke();p5Instance.fill(p5Instance.lerpColor(this.color,p5Instance.color(255),0.2));p5Instance.rect(-this.s*0.2,-this.s*0.5,this.s*0.4,this.s*0.1,2);p5Instance.fill(0,0,0,200);p5Instance.text("F",0,1);break;
    case Config.POWERUP_TYPE.SHIELD:p5Instance.beginShape();p5Instance.vertex(0,-this.s/2);p5Instance.vertex(this.s*0.4,-this.s*0.2);p5Instance.vertex(this.s*0.4,this.s*0.2);p5Instance.vertex(0,this.s/2);p5Instance.vertex(-this.s*0.4,this.s*0.2);p5Instance.vertex(-this.s*0.4,-this.s*0.2);p5Instance.endShape(p5Instance.CLOSE);p5Instance.fill(0,0,0,200);p5Instance.text("S",0,1);break;
    case Config.POWERUP_TYPE.WEAPON_SYSTEM:p5Instance.rect(-this.s*0.4,-this.s*0.4,this.s*0.8,this.s*0.8,2);p5Instance.noStroke();p5Instance.fill(p5Instance.lerpColor(this.color,p5Instance.color(0),0.2));p5Instance.rect(-this.s*0.3,-this.s*0.3,this.s*0.6,this.s*0.6,1);p5Instance.fill(0,0,0,200);p5Instance.text("W",0,1);break;
    case Config.POWERUP_TYPE.SPREAD_SHOT:for(let i=-1;i<=1;i++)p5Instance.rect(i*this.s*0.25,-this.s*0.1,this.s*0.15,this.s*0.4,1);p5Instance.fill(0,0,0,200);p5Instance.textSize(this.s*0.25);p5Instance.text("SP",0,1);break;
    case Config.POWERUP_TYPE.RAPID_FIRE:p5Instance.ellipse(0,0,this.s,this.s);p5Instance.noStroke();p5Instance.fill(p5Instance.lerpColor(this.color,p5Instance.color(255),0.2));p5Instance.ellipse(0,0,this.s*0.6,this.s*0.6);p5Instance.fill(0,0,0,200);p5Instance.text("RF",0,1);break;
    case Config.POWERUP_TYPE.SCORE_MULTIPLIER:p5Instance.rect(-this.s*0.4,-this.s*0.4,this.s*0.8,this.s*0.8,2);p5Instance.noStroke();p5Instance.fill(0,0,0,200);p5Instance.textSize(this.s*0.3);p5Instance.text("x"+(activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER]>0?scoreMultiplier:"?"),0,1);break;
    case Config.POWERUP_TYPE.COIN_MAGNET:p5Instance.rect(-this.s*0.4,-this.s*0.4,this.s*0.8,this.s*0.2,2);p5Instance.rect(-this.s*0.4,-this.s*0.4,this.s*0.2,this.s*0.8,2);p5Instance.rect(this.s*0.2,-this.s*0.4,this.s*0.2,this.s*0.8,2);p5Instance.fill(0,0,0,200);p5Instance.textSize(this.s*0.4);p5Instance.text("M",0,1);break;
    case Config.POWERUP_TYPE.SPEED_BURST:p5Instance.beginShape();p5Instance.vertex(-this.s*0.4,-this.s*0.2);p5Instance.vertex(this.s*0.4,-this.s*0.2);p5Instance.vertex(this.s*0.4,-this.s*0.4);p5Instance.vertex(this.s*0.6,0);p5Instance.vertex(this.s*0.4,this.s*0.4);p5Instance.vertex(this.s*0.4,this.s*0.2);p5Instance.vertex(-this.s*0.4,this.s*0.2);p5Instance.endShape(p5Instance.CLOSE);p5Instance.fill(0,0,0,200);p5Instance.textSize(this.s*0.3);p5Instance.text(">>",0,1);break;
    default:p5Instance.ellipse(0,0,this.s,this.s);p5Instance.fill(0,0,0,200);p5Instance.text("?",0,1);}
    p5Instance.pop();
  }
  offscreen(){return this.x<-this.s-20;}
  hits(playerRect){return Utils.collideRectCircle(playerRect.x,playerRect.y,playerRect.w,playerRect.h,this.x+this.s/2,this.y+this.s/2,this.s, p5Instance);}
}

class Boss {
  constructor(x, y, w, h, r, maxHealth, entrySpeed, targetX, colorVal) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.r = r;
    this.maxHealth = maxHealth * (1 + bossCycleDefeats * 0.15);
    this.health = this.maxHealth;
    this.entrySpeed = entrySpeed * (1 + bossCycleDefeats * 0.07);
    this.targetX = targetX; this.color = colorVal; this.detailColor = p5Instance.lerpColor(this.color,p5Instance.color(0),0.3);
    this.shootTimer = 1500; this.isActive = false; this.vy = 0; this.gravity = 0.3;
  }
  updateEntry(){if(this.x>this.targetX){this.x-=this.entrySpeed*(p5Instance.deltaTime/(1000/60));}}
  hasEntered(){return this.x<=this.targetX;}
  updateActive(){throw new Error("UpdateActive method must be implemented by subclass");}
  showActive(){throw new Error("ShowActive method must be implemented by subclass");}
  update(){if(!this.isActive)return;this.updateActive();this.vy+=this.gravity*(p5Instance.deltaTime/(1000/60));this.y+=this.vy*(p5Instance.deltaTime/(1000/60));if(this.r){this.y=p5Instance.constrain(this.y,this.r,p5Instance.height-Config.GROUND_Y_OFFSET-this.r);}else{this.y=p5Instance.constrain(this.y,0,p5Instance.height-Config.GROUND_Y_OFFSET-this.h);}}
  show(){this.showActive();let bX=this.x-(this.r||this.w/2);let bY=this.y-(this.r||this.h/2)-20;let bW=this.r?this.r*2:this.w;let bH=10;p5Instance.fill(Config.C_BLOOD_RED);p5Instance.rect(bX,bY,bW,bH,2);p5Instance.fill(70,120,70);p5Instance.rect(bX,bY,p5Instance.map(this.health,0,this.maxHealth,0,bW),bH,2);p5Instance.fill(this.detailColor);p5Instance.rect(bX-2,bY,2,bH);p5Instance.rect(bX+bW,bY,2,bH);}
  takeDamage(dmg){if(!this.isActive)return;this.health-=dmg;let pL=playerProjectiles[playerProjectiles.length-1];let eX=pL?pL.x:this.x+p5Instance.random(-20,20);let eY=pL?pL.y:this.y+p5Instance.random(-20,20);createExplosion(eX,eY,3,Config.C_PARTICLE_IMPACT,5*(1000/60),15*(1000/60));if(this.health<=0){this.health=0;score+=this.maxHealth*25*scoreMultiplier;}}
  hits(playerRect){if(!this.isActive)return false;if(this.r){return Utils.collideRectCircle(playerRect.x,playerRect.y,playerRect.w,playerRect.h,this.x,this.y,this.r*2, p5Instance);}else{return Utils.collideRectRect(this.x,this.y,this.w,this.h,playerRect.x,playerRect.y,playerRect.w,playerRect.h);}}
}

class BossTank extends Boss {
  constructor(){super(p5Instance.width+150,Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET-90,150,100,null,100,2.0,p5Instance.width-150-70,Config.C_BOSS_TANK);this.turretAngle=p5Instance.PI;}
  updateActive(){if(player){this.turretAngle=p5Instance.lerp(this.turretAngle,p5Instance.atan2((player.y+player.h/2)-(this.y+25),(player.x+player.w/2)-(this.x+this.w/2-30)),0.03*(p5Instance.deltaTime/(1000/60)));}this.shootTimer-=p5Instance.deltaTime;if(this.shootTimer<=0){for(let i=-1;i<=1;i++){enemyProjectiles.push(new EnemyProjectile(this.x+this.w/2-30+p5Instance.cos(this.turretAngle)*30,this.y+25+p5Instance.sin(this.turretAngle)*30,this.turretAngle+i*0.2));}this.shootTimer=(2500-bossCycleDefeats*100)/(gameSpeed/Config.INITIAL_GAME_SPEED);this.shootTimer=p5Instance.max(900,this.shootTimer);this.vy=-5;}}
  showActive(){ /* ... show logic ... */
    p5Instance.strokeWeight(3);p5Instance.stroke(this.detailColor);p5Instance.fill(this.color);p5Instance.rect(this.x,this.y,this.w,this.h,5);p5Instance.fill(this.detailColor);p5Instance.rect(this.x,this.y+this.h-30,this.w,30,3);for(let i=0;i<this.w;i+=20){p5Instance.rect(this.x+i+2,this.y+this.h-28,15,26,2);}p5Instance.fill(this.color);p5Instance.ellipse(this.x+this.w/2-30,this.y+25,60,60);p5Instance.push();p5Instance.translate(this.x+this.w/2-30,this.y+25);if(player){p5Instance.rotate(this.turretAngle);}p5Instance.fill(this.detailColor);p5Instance.rect(20,-10,50,20,3);p5Instance.pop();p5Instance.noStroke();
  }
}
class BossShip extends Boss {
  constructor(){super(p5Instance.width+120,150,null,null,55,100,1.8,p5Instance.width-55-120,Config.C_BOSS_SHIP);this.movePatternAngle=p5Instance.random(p5Instance.TWO_PI);this.attackMode=0;this.modeTimer=6000-bossCycleDefeats*500;}
  updateActive(){this.y=Config.SCREEN_HEIGHT/2.5+p5Instance.sin(this.movePatternAngle)*(Config.SCREEN_HEIGHT/3);this.movePatternAngle+=0.02/(gameSpeed/Config.INITIAL_GAME_SPEED)*(p5Instance.deltaTime/(1000/60));this.shootTimer-=p5Instance.deltaTime;this.modeTimer-=p5Instance.deltaTime;if(this.modeTimer<=0){this.attackMode=(this.attackMode+1)%2;this.modeTimer=p5Instance.random(5000,8000)-bossCycleDefeats*500;}if(this.shootTimer<=0&&player){if(this.attackMode===0){let aTP=p5Instance.atan2((player.y+player.h/2)-this.y,(player.x+player.w/2)-this.x);for(let i=-1;i<=1;i++)enemyProjectiles.push(new EnemyProjectile(this.x,this.y,aTP+i*0.15));}else{for(let i=-2;i<=2;i++)enemyProjectiles.push(new EnemyProjectile(this.x,this.y,p5Instance.PI+i*0.3));}this.shootTimer=(this.attackMode===0?2000:2800-bossCycleDefeats*150)/(gameSpeed/Config.INITIAL_GAME_SPEED);this.shootTimer=p5Instance.max(800,this.shootTimer);this.vy=-4;}}
  showActive(){ /* ... show logic ... */
    p5Instance.strokeWeight(3);p5Instance.stroke(this.detailColor);p5Instance.fill(this.color);p5Instance.ellipse(this.x,this.y,this.r*2.2,this.r*1.5);p5Instance.beginShape();p5Instance.vertex(this.x-this.r*1.2,this.y-this.r*0.4);p5Instance.vertex(this.x-this.r*2.0,this.y);p5Instance.vertex(this.x-this.r*1.2,this.y+this.r*0.4);p5Instance.endShape(p5Instance.CLOSE);p5Instance.beginShape();p5Instance.vertex(this.x+this.r*1.2,this.y-this.r*0.4);p5Instance.vertex(this.x+this.r*2.0,this.y);p5Instance.vertex(this.x+this.r*1.2,this.y+this.r*0.4);p5Instance.endShape(p5Instance.CLOSE);p5Instance.fill(this.detailColor);p5Instance.rect(this.x-this.r*1.8,this.y-8,10,16,2);p5Instance.noStroke();
  }
}
class BossFinal extends Boss {
  constructor(){super(p5Instance.width+150,p5Instance.height/2,null,null,65,100,1.2,p5Instance.width-65-70,Config.C_BOSS_FINAL);this.movePatternAngle=p5Instance.random(p5Instance.TWO_PI);this.phase=0;this.phaseTimer=18000-bossCycleDefeats*1000;}
  updateActive(){this.x=this.targetX+p5Instance.cos(this.movePatternAngle)*(this.phase===1?90:70);this.y=p5Instance.height/2+p5Instance.sin(this.movePatternAngle*(this.phase===2?2.5:1.5))*(p5Instance.height/2-this.r-40);this.movePatternAngle+=(0.015+this.phase*0.005)/(gameSpeed/Config.INITIAL_GAME_SPEED)*(p5Instance.deltaTime/(1000/60));this.shootTimer-=p5Instance.deltaTime;this.phaseTimer-=p5Instance.deltaTime;if(this.phaseTimer<=0&&this.phase<2){this.phase++;this.phaseTimer=15000-this.phase*2000-bossCycleDefeats*500;createExplosion(this.x,this.y,30,this.detailColor,10*(1000/60),40*(1000/60));}if(this.shootTimer<=0){let nP=6+this.phase*2+bossCycleDefeats;let sM=0.8+this.phase*0.1+bossCycleDefeats*0.05;for(let a=0;a<p5Instance.TWO_PI;a+=p5Instance.TWO_PI/nP){let p=new EnemyProjectile(this.x,this.y,a+p5Instance.frameCount*0.01*(this.phase%2===0?1:-1));p.speed*=sM;enemyProjectiles.push(p);}this.shootTimer=(3000-this.phase*500-bossCycleDefeats*100)/(gameSpeed/Config.INITIAL_GAME_SPEED);this.shootTimer=p5Instance.max(1000-this.phase*100,this.shootTimer);this.vy=-6;}}
  showActive(){ /* ... show logic ... */
    p5Instance.strokeWeight(4);p5Instance.stroke(this.detailColor);p5Instance.fill(this.color);p5Instance.rect(this.x-this.r,this.y-this.r,this.r*2,this.r*2,5);p5Instance.fill(this.detailColor);p5Instance.rect(this.x-this.r*0.8,this.y-this.r*1.2,this.r*1.6,this.r*0.4,3);p5Instance.rect(this.x-this.r*1.2,this.y-this.r*0.8,this.r*0.4,this.r*1.6,3);for(let i=0;i<4;i++){p5Instance.push();p5Instance.translate(this.x,this.y);p5Instance.rotate(i*p5Instance.HALF_PI);p5Instance.fill(this.color.levels[0]-20,this.color.levels[1]-20,this.color.levels[2]-20);p5Instance.rect(this.r*0.8,-10,20,20,4);p5Instance.pop();}p5Instance.noStroke();
  }
}

class Particle {
  constructor(x,y,color,size,lifetime,velocity,drag,shape='ellipse'){this.x=x;this.y=y;this.color=color;this.size=size;this.lifetime=lifetime;this.vel=velocity||p5Instance.createVector(p5Instance.random(-1,1),p5Instance.random(-1,1));this.acc=p5Instance.createVector(0,0);this.drag=drag||1;this.alpha=255;this.startLifetime=lifetime;this.shape=shape;this.initialSize=size;}
  applyForce(force){this.acc.add(force);}
  update(){this.vel.add(this.acc);this.vel.mult(this.drag);this.x+=this.vel.x*(p5Instance.deltaTime/(1000/60));this.y+=this.vel.y*(p5Instance.deltaTime/(1000/60));this.acc.mult(0);this.lifetime-=p5Instance.deltaTime;this.alpha=p5Instance.map(this.lifetime,0,this.startLifetime,0,255);this.size=p5Instance.map(this.lifetime,0,this.startLifetime,0,this.initialSize);if(this.size<0)this.size=0;}
  show(){p5Instance.noStroke();let dC=this.color;if(Array.isArray(this.color))dC=this.color[p5Instance.floor(p5Instance.random(this.color.length))];if(dC&&dC.levels){p5Instance.fill(dC.levels[0],dC.levels[1],dC.levels[2],this.alpha);if(this.shape==='ellipse')p5Instance.ellipse(this.x,this.y,this.size);else if(this.shape==='rect')p5Instance.rect(this.x-this.size/2,this.y-this.size/2,this.size,this.size*p5Instance.random(0.5,1.5),1);}}
  finished(){return this.lifetime<0;}
}

// --- Main Game Logic Functions ---
function createExplosion(x,y,count,baseColor,minLifetimeMs,maxLifetimeMs){for(let i=0;i<count;i++){let a=p5Instance.random(p5Instance.TWO_PI);let s=p5Instance.random(1,6);let v=p5Instance.createVector(p5Instance.cos(a)*s,p5Instance.sin(a)*s);let pT=p5Instance.random();let pC=Array.isArray(baseColor)?baseColor[p5Instance.floor(p5Instance.random(baseColor.length))]:baseColor;let l=p5Instance.random(minLifetimeMs,maxLifetimeMs);let sz=p5Instance.random(3,10);if(pT<0.7){particles.push(new Particle(x+p5Instance.random(-5,5),y+p5Instance.random(-5,5),pC,sz,l,v,0.9));}else{let sC=p5Instance.lerpColor(pC||p5Instance.color(100),p5Instance.color(80,80,80),p5Instance.random(0.2,0.6));particles.push(new Particle(x+p5Instance.random(-5,5),y+p5Instance.random(-5,5),sC,sz*p5Instance.random(0.5,0.8),l*0.8,v.mult(p5Instance.random(1.2,1.8)),0.98,'rect'));}}}
+function isClearForSpawn(x, y, w, h) {
+  // Keep spawns from overlapping existing obstacles/enemies.
+  // Uses module-scoped arrays, so it MUST live in main.js (not utils.js).
+  const pad = 16;
+  const rx = x - pad, ry = y - pad, rw = w + pad * 2, rh = h + pad * 2;
+
+  if (Array.isArray(obstacles)) {
+    for (const o of obstacles) {
+      if (!o) continue;
+      if (Utils.collideRectRect(rx, ry, rw, rh, o.x, o.y, o.w, o.h)) return false;
+    }
+  }
+  if (Array.isArray(enemies)) {
+    for (const e of enemies) {
+      if (!e) continue;
+      if (Utils.collideRectRect(rx, ry, rw, rh, e.x, e.y, e.w, e.h)) return false;
+    }
+  }
+  return true;
+}
function updateGameLogic() {
  if (window.currentScreen !== "GAME" || gamePaused) return;
  gameElapsedTime = p5Instance.millis() - gameStartTime;
  let speedBurstFactor = activePowerups[Config.POWERUP_TYPE.SPEED_BURST] > 0 ? 1.5 : 1;

  if (postWinModeActive) {
    baseGameSpeed = p5Instance.min(Config.MAX_GAME_SPEED, baseGameSpeed + Config.GAME_SPEED_INCREMENT * 2.5 * (p5Instance.deltaTime / (1000 / 60)));
    obstacleInterval = p5Instance.max( Config.OBSTACLE_MIN_INTERVAL * 0.7, obstacleInterval * (Config.OBSTACLE_INTERVAL_DECREMENT_FACTOR * 0.95) );
    enemySpawnInterval = p5Instance.max( Config.ENEMY_MIN_INTERVAL * 0.7, enemySpawnInterval * (Config.ENEMY_INTERVAL_DECREMENT_FACTOR * 0.90) );
    powerupInterval = p5Instance.max(Config.POWERUP_REGULAR_MIN_INTERVAL * 0.8, powerupInterval * (Config.POWERUP_INTERVAL_DECREMENT_FACTOR * 0.95) );
  } else {
    baseGameSpeed = p5Instance.min(Config.MAX_GAME_SPEED / speedBurstFactor, baseGameSpeed + Config.GAME_SPEED_INCREMENT * (p5Instance.deltaTime / (1000 / 60)));
    obstacleInterval = p5Instance.max( Config.OBSTACLE_MIN_INTERVAL, obstacleInterval * Config.OBSTACLE_INTERVAL_DECREMENT_FACTOR );
    enemySpawnInterval = p5Instance.max( Config.ENEMY_MIN_INTERVAL, enemySpawnInterval * Config.ENEMY_INTERVAL_DECREMENT_FACTOR );
    powerupInterval = p5Instance.max( Config.POWERUP_REGULAR_MIN_INTERVAL, powerupInterval * Config.POWERUP_INTERVAL_DECREMENT_FACTOR);
  }
  gameSpeed = baseGameSpeed * speedBurstFactor;

  distanceTraveled += gameSpeed * (p5Instance.deltaTime / (1000 / 60));
  score = p5Instance.floor(distanceTraveled * scoreMultiplier) + coinsCollectedThisRun * 10 * scoreMultiplier;
  if(player) player.update();
  if (!playerCanShoot) { playerShootCooldown -= p5Instance.deltaTime; if (playerShootCooldown <= 0) playerCanShoot = true; }
  if (activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM] > 0 && player) {
    weaponSystemActive = true; let fireIntervalMs = currentWeaponMode === "SPREAD" ? 200 : 133;
    if (activePowerups[Config.POWERUP_TYPE.RAPID_FIRE]) { fireIntervalMs = currentWeaponMode === "SPREAD" ? 100 : 67; }
    weaponSystemShootTimer -= p5Instance.deltaTime;
    if (weaponSystemShootTimer <= 0) {
        if (currentWeaponMode === "SPREAD") { for (let i = -1; i <= 1; i++) playerProjectiles.push(new PlayerProjectile(player.x + player.w, player.y + player.h / 2, i * 0.2)); }
        else { playerProjectiles.push(new PlayerProjectile(player.x + player.w, player.y + player.h / 2)); }
        weaponSystemShootTimer = fireIntervalMs;
    }
  } else { weaponSystemActive = false; }

  if (p5Instance.millis() - lastObstacleTime > obstacleInterval && !boss && !bossApproaching) {
    let oW = p5Instance.random(25, 60); let oH = p5Instance.random(40, 180); let oX = Config.SCREEN_WIDTH;
    let oYT = p5Instance.random(1); let oY;
    if (oYT < 0.4) oY = 0; else if (oYT < 0.8) oY = Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - oH; else oY = p5Instance.random(Config.SCREEN_HEIGHT * 0.15, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - oH - 40);
    obstacles.push(new Obstacle(oX, oY, oW, oH));
    lastObstacleTime = p5Instance.millis();
  }

  if (p5Instance.millis() - lastPowerupTime > powerupInterval) {
    let pType; let rand = p5Instance.random();
    if (boss && boss.isActive) { if (rand < 0.25) pType = Config.POWERUP_TYPE.WEAPON_SYSTEM; else if (rand < 0.5) pType = Config.POWERUP_TYPE.SHIELD; else if (rand < 0.7) pType = Config.POWERUP_TYPE.FUEL_CELL; else if (rand < 0.85) pType = Config.POWERUP_TYPE.SPREAD_SHOT; else pType = Config.POWERUP_TYPE.RAPID_FIRE; }
    else { if (rand < 0.2) pType = Config.POWERUP_TYPE.COIN; else if (rand < 0.35) pType = Config.POWERUP_TYPE.FUEL_CELL; else if (rand < 0.5) pType = Config.POWERUP_TYPE.SHIELD; else if (rand < 0.6) pType = Config.POWERUP_TYPE.WEAPON_SYSTEM; else if (rand < 0.7) pType = Config.POWERUP_TYPE.SPREAD_SHOT; else if (rand < 0.8) pType = Config.POWERUP_TYPE.RAPID_FIRE; else if (rand < 0.87) pType = Config.POWERUP_TYPE.SCORE_MULTIPLIER; else if (rand < 0.94) pType = Config.POWERUP_TYPE.COIN_MAGNET; else pType = Config.POWERUP_TYPE.SPEED_BURST; }
    powerups.push(new Powerup(Config.SCREEN_WIDTH, p5Instance.random(60, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - 90), pType));
    lastPowerupTime = p5Instance.millis();
  }

  if (p5Instance.millis() - lastEnemySpawnTime > enemySpawnInterval && !boss && !bossApproaching) {
    let eTypeRand = p5Instance.random(); let type;
    if (eTypeRand < 0.55) type = "DRONE"; else if (eTypeRand < 0.85) type = "INTERCEPTOR"; else type = "TURRET";
    let enemyW, enemyH;
    if (type === "DRONE" || type === "INTERCEPTOR") { enemyW = 50; enemyH = 40; } else { enemyW = 45; enemyH = 45; }
    let attempts = 0; let spawnX, spawnY; let successfullySpawned = false;
    do {
        spawnX = Config.SCREEN_WIDTH + p5Instance.random(10, 30);
        if (type === "TURRET") { spawnY = p5Instance.random() < 0.5 ? 30 : Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - enemyH - 30; }
        else { spawnY = p5Instance.random(enemyH, Config.SCREEN_HEIGHT - Config.GROUND_Y_OFFSET - enemyH * 1.5); }
        attempts++;
        if (isClearForSpawn(spawnX, spawnY, enemyW, enemyH)) {// Use Utils.isClearForSpawn
            enemies.push(new Enemy(spawnX, spawnY, type)); successfullySpawned = true; break;
        }
    } while (attempts < Config.MAX_ENEMY_SPAWN_ATTEMPTS);
    if (successfullySpawned) { lastEnemySpawnTime = p5Instance.millis(); }
  }

  for(let i=obstacles.length-1;i>=0;i--){obstacles[i].update();if(player&&player.hits(obstacles[i])){if(player.shieldCharges>0){player.shieldCharges--;createExplosion(obstacles[i].x+obstacles[i].w/2,obstacles[i].y+obstacles[i].h/2,10,Config.C_OBSTACLE,50,200);obstacles.splice(i,1);}else{window.currentScreen="GAME_OVER";if(player)createExplosion(player.x+player.w/2,player.y+player.h/2,30,Config.C_PLAYER,50,400);break;}}if(obstacles[i].offscreen())obstacles.splice(i,1);}
  if(window.currentScreen!=="GAME")return;
  for(let i=powerups.length-1;i>=0;i--){powerups[i].update();if(player&&powerups[i].hits(player)){activatePowerup(powerups[i].type);createExplosion(powerups[i].x+powerups[i].s/2,powerups[i].y+powerups[i].s/2,10,powerups[i].color,30,150);powerups.splice(i,1);}else if(powerups[i].offscreen())powerups.splice(i,1);}
  for(let i=playerProjectiles.length-1;i>=0;i--){let pP=playerProjectiles[i];pP.update();let hO=false;for(let k=obstacles.length-1;k>=0;k--){if(pP.hits(obstacles[k])){hO=true;createExplosion(pP.x+pP.w/2,pP.y,5,Config.C_PARTICLE_IMPACT,20,80);break;}}if(!hO){for(let j=enemies.length-1;j>=0;j--){if(!enemies[j].isDestroyed&&pP.hits(enemies[j])){enemies[j].takeDamage(pP.damage);hO=true;break;}}}if(!hO&&boss&&boss.isActive&&boss.health>0){let bH=boss.r?Utils.collideRectCircle(pP.x,pP.y-pP.h/2,pP.w,pP.h,boss.x,boss.y,boss.r*2,p5Instance):Utils.collideRectRect(pP.x,pP.y-pP.h/2,pP.w,pP.h,boss.x,boss.y,boss.w,boss.h);if(bH){boss.takeDamage(pP.damage);hO=true;}}if(hO||pP.offscreen()){if(hO&&!pP.offscreen())createExplosion(pP.x+pP.w,pP.y,3,Config.C_PLAYER_PROJECTILE,20,80);playerProjectiles.splice(i,1);}}
  for(let i=enemies.length-1;i>=0;i--){let e=enemies[i];if(e.isDestroyed){enemies.splice(i,1);continue;}e.update();if(player&&player.hits(e)){if(player.shieldCharges>0){player.shieldCharges--;e.takeDamage(100);}else{window.currentScreen="GAME_OVER";if(player)createExplosion(player.x+player.w/2,player.y+player.h/2,30,Config.C_PLAYER,50,400);break;}}if(e.offscreen()&&!e.isDestroyed)enemies.splice(i,1);}
  if(window.currentScreen!=="GAME")return;
  for(let i=enemyProjectiles.length-1;i>=0;i--){let eP=enemyProjectiles[i];eP.update();let hPO=false;if(player&&eP.hits(player)){if(player.shieldCharges>0){player.shieldCharges--;createExplosion(eP.x,eP.y,8,eP.color,30,120);}else{window.currentScreen="GAME_OVER";if(player)createExplosion(player.x+player.w/2,player.y+player.h/2,30,Config.C_PLAYER,50,400);}hPO=true;}else{for(let k=obstacles.length-1;k>=0;k--){if(eP.hitsObstacle(obstacles[k])){hPO=true;createExplosion(eP.x,eP.y,5,Config.C_PARTICLE_IMPACT,20,80);break;}}}if(hPO){enemyProjectiles.splice(i,1);if(window.currentScreen!=="GAME")break;}else if(eP.offscreen())enemyProjectiles.splice(i,1);}
  for(let i=particles.length-1;i>=0;i--){particles[i].update();if(particles[i].finished())particles.splice(i,1);}
  for(let i=smokeParticles.length-1;i>=0;i--){smokeParticles[i].update();if(smokeParticles[i].finished()){smokeParticles.splice(i,1);if(p5Instance.random()<0.3){smokeParticles.push(new Particle(p5Instance.random(Config.SCREEN_WIDTH),p5Instance.random(Config.SCREEN_HEIGHT*0.05,Config.SCREEN_HEIGHT*0.4),Config.C_SMOKE_EFFECT,p5Instance.random(60,120),p5Instance.random(8000,15000),p5Instance.createVector(p5Instance.random(-0.05,0.05)*gameSpeed*0.1,p5Instance.random(-0.08,-0.18)),0.99,'ellipse'));}}}

  if (boss) {
    if (!boss.isActive) { boss.updateEntry(); if (boss.hasEntered()) boss.isActive = true; }
    else {
      boss.update();
      if (boss.health <= 0) {
        createExplosion(boss.x + (boss.r || boss.w / 2), boss.y + (boss.r || boss.h / 2), 50, boss.color, 100, 600);
        boss = null; bossApproaching = false; pendingBoss = null;
        bossCount++; bossCycleDefeats++;
        if (bossCount >= 3 && !postWinModeActive) {
            temporaryWinMessageActive = true; temporaryWinMessageTimer = Config.TEMPORARY_WIN_MESSAGE_DURATION_MS; postWinModeActive = true;
            console.log("POST WIN MODE ACTIVATED! Total bosses defeated:", bossCycleDefeats); bossCount = 0;
        } else if (postWinModeActive) {
            if (bossCount >=3) bossCount = 0;
            console.log("Boss defeated in post-win mode. Total bosses defeated:", bossCycleDefeats, "Current unique boss cycle:", bossCount);
        }
        if (postWinModeActive) { timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS * p5Instance.max(0.4, 0.7 - (bossCycleDefeats - 3) * 0.05) ; }
        else { timeUntilNextBoss = Config.BOSS_SPAWN_INTERVAL_MS; }
      }
    }
  } else if (!bossApproaching && window.currentScreen === "GAME") {
    timeUntilNextBoss -= p5Instance.deltaTime;
    if (timeUntilNextBoss <= 0) {
        bossApproaching = true; let nextBossTypeIndex = bossCycleDefeats % 3;
        if (nextBossTypeIndex === 0) pendingBoss = new BossTank(); else if (nextBossTypeIndex === 1) pendingBoss = new BossShip(); else pendingBoss = new BossFinal();
        console.log("Boss approaching. Type index:", nextBossTypeIndex, "Total defeated:", bossCycleDefeats);
    }
  } else if (bossApproaching && !boss && pendingBoss && enemies.length === 0 && obstacles.length === 0) { boss = pendingBoss; }

  if (temporaryWinMessageActive) { temporaryWinMessageTimer -= p5Instance.deltaTime; if (temporaryWinMessageTimer <= 0) { temporaryWinMessageActive = false; } }
  for(const type in activePowerups){activePowerups[type]-=p5Instance.deltaTime;if(activePowerups[type]<=0){delete activePowerups[type];if(type===Config.POWERUP_TYPE.WEAPON_SYSTEM&&!(activePowerups[Config.POWERUP_TYPE.SPREAD_SHOT]>0||activePowerups[Config.POWERUP_TYPE.RAPID_FIRE]>0)){weaponSystemActive=false;currentWeaponMode="STANDARD";}else if(type===Config.POWERUP_TYPE.SPREAD_SHOT&&!(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]>0)){currentWeaponMode="STANDARD";}else if(type===Config.POWERUP_TYPE.SCORE_MULTIPLIER){scoreMultiplier=1;}}}
}

function activatePowerup(type) { /* ... activatePowerup logic ... uses Config.POWERUP_TYPE and Config durations */
  console.log("Activating powerup:", type);
  switch(type){case Config.POWERUP_TYPE.COIN:coinsCollectedThisRun++;break;case Config.POWERUP_TYPE.FUEL_CELL:jetpackFuel=Config.MAX_FUEL;break;case Config.POWERUP_TYPE.SHIELD:if(player)player.shieldCharges=p5Instance.min(3,player.shieldCharges+1);break;case Config.POWERUP_TYPE.COIN_MAGNET:activePowerups[Config.POWERUP_TYPE.COIN_MAGNET]=(activePowerups[Config.POWERUP_TYPE.COIN_MAGNET]||0)+Config.COIN_MAGNET_DURATION;break;case Config.POWERUP_TYPE.SPEED_BURST:activePowerups[Config.POWERUP_TYPE.SPEED_BURST]=(activePowerups[Config.POWERUP_TYPE.SPEED_BURST]||0)+Config.SPEED_BURST_DURATION;break;case Config.POWERUP_TYPE.WEAPON_SYSTEM:weaponSystemActive=true;if(currentWeaponMode!=="SPREAD"&&currentWeaponMode!=="RAPID")currentWeaponMode="STANDARD";activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]=(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]||0)+Config.WEAPON_SYSTEM_DURATION;break;case Config.POWERUP_TYPE.SPREAD_SHOT:weaponSystemActive=true;currentWeaponMode="SPREAD";activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]=p5Instance.max(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]||0,Config.SPREAD_SHOT_DURATION);activePowerups[Config.POWERUP_TYPE.SPREAD_SHOT]=(activePowerups[Config.POWERUP_TYPE.SPREAD_SHOT]||0)+Config.SPREAD_SHOT_DURATION;break;case Config.POWERUP_TYPE.RAPID_FIRE:weaponSystemActive=true;activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]=p5Instance.max(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]||0,Config.RAPID_FIRE_DURATION);activePowerups[Config.POWERUP_TYPE.RAPID_FIRE]=(activePowerups[Config.POWERUP_TYPE.RAPID_FIRE]||0)+Config.RAPID_FIRE_DURATION;break;case Config.POWERUP_TYPE.SCORE_MULTIPLIER:scoreMultiplier*=2;activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER]=(activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER]||0)+Config.SCORE_MULTIPLIER_DURATION;break;}
}

// --- Drawing Functions ---
function drawHUD() { /* ... HUD drawing logic ... uses p5Instance.fill, p5Instance.rect etc. and Config.C_... colors */
    p5Instance.fill(Config.C_HUD_BG);p5Instance.noStroke();p5Instance.rect(0,0,p5Instance.width,50);
    let fBW=p5Instance.map(jetpackFuel,0,Config.MAX_FUEL,0,150);p5Instance.fill(Config.C_POWERUP_FUEL);p5Instance.rect(10,10,fBW,20);p5Instance.noFill();p5Instance.stroke(Config.C_TEXT_MAIN);p5Instance.strokeWeight(2);p5Instance.rect(10,10,150,20);p5Instance.noStroke();p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(14);p5Instance.textAlign(p5Instance.LEFT,p5Instance.CENTER);p5Instance.text("FUEL",15,20);
    p5Instance.fill(Config.C_TEXT_SCORE);p5Instance.textSize(24);p5Instance.textAlign(p5Instance.RIGHT,p5Instance.CENTER);p5Instance.text("SCORE: "+score,p5Instance.width-20,25);p5Instance.fill(Config.C_TEXT_ACCENT);p5Instance.textSize(18);p5Instance.text("HIGH: "+highScore,p5Instance.width-20,40);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(18);p5Instance.textAlign(p5Instance.LEFT,p5Instance.CENTER);p5Instance.text("PILOT: "+window.playerName,180,25);let m=p5Instance.floor(gameElapsedTime/60000);let s=p5Instance.floor((gameElapsedTime%60000)/1000);let tS=p5Instance.nf(m,2)+':'+p5Instance.nf(s,2);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(20);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.text("TIME: "+tS,p5Instance.width/2,25);
    let pX=p5Instance.width/2+100;let pY=40;let iS=15;
    if(player&&player.shieldCharges>0){p5Instance.fill(Config.C_POWERUP_SHIELD);p5Instance.rect(pX,pY,iS,iS,2);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(iS*0.7);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.text("S x"+player.shieldCharges,pX+iS/2,pY+iS/2+1);pX+=iS+25;}
    if(activePowerups[Config.POWERUP_TYPE.WEAPON_SYSTEM]>0){p5Instance.fill(Config.C_POWERUP_WEAPON);p5Instance.rect(pX,pY,iS,iS,2);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(iS*0.7);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);let wST="W";if(currentWeaponMode==="SPREAD")wST="W(S)";if(activePowerups[Config.POWERUP_TYPE.RAPID_FIRE])wST+="(R)";p5Instance.text(wST,pX+iS/2,pY+iS/2+1);pX+=iS+25;}
    if(activePowerups[Config.POWERUP_TYPE.SCORE_MULTIPLIER]>0){p5Instance.fill(Config.C_POWERUP_MULTIPLIER);p5Instance.rect(pX,pY,iS,iS,2);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(iS*0.7);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.text("x"+scoreMultiplier,pX+iS/2,pY+iS/2+1);pX+=iS+25;}
    if(activePowerups[Config.POWERUP_TYPE.COIN_MAGNET]>0){p5Instance.fill(Config.C_POWERUP_MAGNET);p5Instance.rect(pX,pY,iS,iS,2);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(iS*0.7);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.text("M",pX+iS/2,pY+iS/2+1);pX+=iS+25;}
    if(activePowerups[Config.POWERUP_TYPE.SPEED_BURST]>0){p5Instance.fill(Config.C_POWERUP_SPEED);p5Instance.rect(pX,pY,iS,iS,2);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(iS*0.7);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.text(">>",pX+iS/2,pY+iS/2+1);}
}
function drawBackground() { /* ... background drawing logic ... */
    p5Instance.background(Config.C_SKY_OVERCAST);let hY=Config.SCREEN_HEIGHT*0.6;let fGH=Config.SCREEN_HEIGHT*0.15;for(let y=0;y<fGH;y++){let i=p5Instance.map(y,0,fGH,0,1);let c=p5Instance.lerpColor(Config.C_FIRE_GLOW_STRONG,Config.C_SKY_HORIZON,i);p5Instance.fill(c);p5Instance.rect(0,hY+y,Config.SCREEN_WIDTH,1);}p5Instance.fill(Config.C_SKY_HORIZON);p5Instance.rect(0,hY+fGH,Config.SCREEN_WIDTH,Config.SCREEN_HEIGHT*0.4-Config.GROUND_Y_OFFSET-fGH);
    p5Instance.fill(Config.C_GROUND_DETAIL);p5Instance.rect(0,Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET,Config.SCREEN_WIDTH,Config.GROUND_Y_OFFSET);p5Instance.fill(Config.C_GROUND_DETAIL.levels[0]+10,Config.C_GROUND_DETAIL.levels[1]+10,Config.C_GROUND_DETAIL.levels[2]+10);for(let i=0;i<Config.SCREEN_WIDTH;i+=20){p5Instance.rect(i+(p5Instance.frameCount*gameSpeed*0.5*(p5Instance.deltaTime/(1000/60)))%20,Config.SCREEN_HEIGHT-Config.GROUND_Y_OFFSET+5,8,3);}
    for(let bE of backgroundElements){bE.update();bE.show();}for(let sP of smokeParticles){sP.show();}
    p5Instance.fill(Config.C_SMOKE_EFFECT.levels[0],Config.C_SMOKE_EFFECT.levels[1],Config.C_SMOKE_EFFECT.levels[2],25+p5Instance.sin(p5Instance.frameCount*0.01+bgOffset1*0.1)*10);p5Instance.rect(0,Config.SCREEN_HEIGHT*0.15,Config.SCREEN_WIDTH,Config.SCREEN_HEIGHT*0.55);bgOffset1+=gameSpeed*0.02*(p5Instance.deltaTime/(1000/60));if(bgOffset1>p5Instance.TWO_PI)bgOffset1-=p5Instance.TWO_PI;
}
function drawTemporaryWinMessage() { /* ... temporary win message logic ... */
    if (temporaryWinMessageActive) {
        p5Instance.push();p5Instance.textAlign(p5Instance.CENTER, p5Instance.CENTER);
        p5Instance.fill(Config.C_VICTORY_TEXT);p5Instance.textSize(60);p5Instance.text("VICTORY!",Config.SCREEN_WIDTH/2,Config.SCREEN_HEIGHT/2-60);
        p5Instance.fill(Config.C_VICTORY_SUBTEXT);p5Instance.textSize(30);p5Instance.text("The Reich Marshall is pleased... for now.",Config.SCREEN_WIDTH/2,Config.SCREEN_HEIGHT/2);
        p5Instance.text("Prepare for the next wave!",Config.SCREEN_WIDTH/2,Config.SCREEN_HEIGHT/2+40);
        p5Instance.pop();
    }
}
function drawStartScreen() { /* ... start screen logic ... */
    p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.textSize(48);p5Instance.text("FLAPPY ADOLF",p5Instance.width/2,p5Instance.height/2-140);p5Instance.textSize(20);p5Instance.text("Based on true events when Fuhrer had to poop.",p5Instance.width/2,p5Instance.height/2-90);
    p5Instance.textSize(18);p5Instance.fill(Config.C_TEXT_ACCENT);p5Instance.text("PILOT: "+window.playerName,p5Instance.width/2,p5Instance.height/2+0);p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(16);
    p5Instance.text("Use [SPACE] or JUMP button for ass thrust",p5Instance.width/2,p5Instance.height/2+50);p5Instance.text("Use [LEFT MOUSE] or SHOOT button to fire",p5Instance.width/2,p5Instance.height/2+75);p5Instance.text("Survive the nasty enemies of the Reich. Get to poop.",p5Instance.width/2,p5Instance.height/2+100);
}
function drawGameOverScreen() { /* ... game over screen logic ... */
    p5Instance.fill(Config.C_BLOOD_RED);p5Instance.textAlign(p5Instance.CENTER,p5Instance.CENTER);p5Instance.textSize(64);p5Instance.text("MISSION FAILED",p5Instance.width/2,p5Instance.height/2-100);
    p5Instance.fill(Config.C_TEXT_MAIN);p5Instance.textSize(36);p5Instance.text("SCORE: "+score,p5Instance.width/2,p5Instance.height/2-30);p5Instance.text("HIGH SCORE: "+highScore,p5Instance.width/2,p5Instance.height/2+20);
}

// --- p5.js Draw Loop & Event Handlers ---
window.draw = function () {
  drawBackground();
  if (window.currentScreen === "START") {
    drawStartScreen(); window.showMainMenuButtons(true); window.showGameOverButtons(false); window.showInGameControls(false);
  } else if (window.currentScreen === "GAME") {
    updateGameLogic(); if(player)player.show(); for(let o of obstacles)o.show(); for(let e of enemies)e.show();
    for(let pP of playerProjectiles)pP.show(); for(let eP of enemyProjectiles)eP.show(); for(let pU of powerups)pU.show();
    for(let p of particles)p.show(); if(boss)boss.show();
    if(temporaryWinMessageActive){ drawTemporaryWinMessage(); }
    drawHUD(); window.showMainMenuButtons(false); window.showGameOverButtons(false); window.showInGameControls(true);
  } else if (window.currentScreen === "GAME_OVER") {
    drawGameOverScreen(); window.showMainMenuButtons(false); window.showGameOverButtons(true); window.showInGameControls(false);
    if(!scoreboardDisplayedAfterGameOver){if(typeof window.saveHighScore==='function')window.saveHighScore(score);scoreboardDisplayedAfterGameOver=true;}
  } else if (window.currentScreen === "SCOREBOARD") {
    window.showMainMenuButtons(false); window.showGameOverButtons(false); window.showInGameControls(false);
  }
};

window.keyPressed = function () {
  if (p5Instance.key === " ") {
    if (window.currentScreen === "START") { window.currentScreen = "GAME"; resetGameValues(); setPlayerFlyingState(true); triggerJumpSound(); }
    else if (window.currentScreen === "GAME") { setPlayerFlyingState(true); triggerJumpSound(); }
    return false;
  }
  if (window.currentScreen === "GAME_OVER") {
    if (p5Instance.key === "r" || p5Instance.key === "R") { resetGameValues(); window.currentScreen = "GAME"; if(typeof window.showScoreboard === 'function' && scoreboard.style.display !== 'none')window.showScoreboard(false); }
  }
};
window.keyReleased = function () { if (window.currentScreen === "GAME" && p5Instance.key === " ") stopPlayerFlying(); };
window.mousePressed = function () { if (window.currentScreen === "GAME" && p5Instance.mouseButton === p5Instance.LEFT && p5Instance.mouseX>0 && p5Instance.mouseX<p5Instance.width && p5Instance.mouseY>0 && p5Instance.mouseY<p5Instance.height) { if(typeof window.triggerPlayerShoot==='function')window.triggerPlayerShoot(); }};

// Note: collideRectRect and collideRectCircle are moved to utils.js
// isClearForSpawn is also moved to utils.js (or will be part of enemy spawning logic more directly)

