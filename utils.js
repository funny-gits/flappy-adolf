// utils.js

// These functions need access to p5's drawing context (e.g., for fill, rect, ellipse, PI, translate, rotate)
// We will pass the p5 instance (often referred to as 'p' or 'sketch') to them when they are called from main.js

export function drawFauxBanner(p, x, y, w, h, C_BANNER_BG_RED, C_BANNER_CIRCLE_WHITE, C_BANNER_SYMBOL_BLACK) {
  p.fill(C_BANNER_BG_RED);
  p.rect(x, y, w, h, 2);
  p.fill(C_BANNER_CIRCLE_WHITE);
  p.ellipse(x + w / 2, y + h / 2, w * 0.55);
  let cx = x + w / 2,
    cy = y + h / 2,
    s = w * 0.07;
  p.fill(C_BANNER_SYMBOL_BLACK);
  p.noStroke();
  p.push();
  p.translate(cx, cy);
  p.rotate(p.PI / 4); // Use p.PI for p5 instance specific constants
  p.rect(-s / 2, -s / 2, s, s);
  let armLength = s * 1.2,
    armWidth = s * 0.8;
  p.rect(-armLength - armWidth / 2 + s / 2, -armWidth / 2, armLength, armWidth);
  p.rect(armWidth / 2 - s / 2, -armLength - armWidth / 2, armWidth, armLength);
  p.rect(armWidth / 2 - s / 2, s / 2, armWidth, armLength);
  p.rect(s / 2, -armWidth / 2, armLength, armWidth);
  p.pop();
}

export function collideRectRect(x, y, w, h, x2, y2, w2, h2) {
  // Simple AABB collision detection
  return x + w >= x2 && x <= x2 + w2 && y + h >= y2 && y <= y2 + h2;
}

export function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter, p5Instance) {
  // p5Instance is needed for dist()
  let testX = cx;
  let testY = cy;

  if (cx < rx) testX = rx; // Left edge
  else if (cx > rx + rw) testX = rx + rw; // Right edge
  if (cy < ry) testY = ry; // Top edge
  else if (cy > ry + rh) testY = ry + rh; // Bottom edge

  let distance = p5Instance.dist(cx, cy, testX, testY);

  return distance <= diameter / 2;
}
// --- Collision / Spawn helpers ---

export function rectsIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Spawn safety check.
 * Ensures a candidate spawn rectangle doesn't overlap player/obstacles/enemies/powerups.
 *
 * ctx: { player, obstacles, enemies, powerups }
 * - Each object may expose {x,y,w,h} OR {pos:{x,y}, w/h} OR {width,height}.
 */
export function isClearForSpawn(x, y, w, h, ctx = {}, opts = {}) {
  const padding = opts.padding ?? 6;
  const minDistanceFromPlayer = opts.minDistanceFromPlayer ?? 70;

  const pxRect = (obj) => {
    if (!obj) return null;
    const ox = (typeof obj.x === "number") ? obj.x : (obj.pos && typeof obj.pos.x === "number" ? obj.pos.x : null);
    const oy = (typeof obj.y === "number") ? obj.y : (obj.pos && typeof obj.pos.y === "number" ? obj.pos.y : null);
    const ow = (typeof obj.w === "number") ? obj.w : (typeof obj.width === "number" ? obj.width : null);
    const oh = (typeof obj.h === "number") ? obj.h : (typeof obj.height === "number" ? obj.height : null);
    if (ox === null || oy === null || ow === null || oh === null) return null;
    return { x: ox, y: oy, w: ow, h: oh };
  };

  // player distance guard (prevents unfair spawns in your face)
  const pr = pxRect(ctx.player);
  if (pr) {
    const cx = x + w / 2, cy = y + h / 2;
    const pcx = pr.x + pr.w / 2, pcy = pr.y + pr.h / 2;
    const dist = Math.hypot(cx - pcx, cy - pcy);
    if (dist < minDistanceFromPlayer) return false;
  }

  const expanded = { x: x - padding, y: y - padding, w: w + padding * 2, h: h + padding * 2 };

  const lists = []
    .concat(ctx.obstacles || [])
    .concat(ctx.enemies || [])
    .concat(ctx.powerups || []);

  for (const o of lists) {
    const r = pxRect(o);
    if (!r) continue;
    if (rectsIntersect(expanded.x, expanded.y, expanded.w, expanded.h, r.x, r.y, r.w, r.h)) return false;
  }

  return true;
}
