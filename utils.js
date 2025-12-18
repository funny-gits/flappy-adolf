// FILE: utils.js
// Shared helpers. Clean replacement for previously truncated/ellipsized helpers.

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function rectsIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter, p5) {
  let testX = cx;
  let testY = cy;

  if (cx < rx) testX = rx;
  else if (cx > rx + rw) testX = rx + rw;

  if (cy < ry) testY = ry;
  else if (cy > ry + rh) testY = ry + rh;

  const distance = p5.dist(cx, cy, testX, testY);
  return distance <= diameter / 2;
}

/**
 * Weighted choice helper.
 * Supports entries like:
 *   { type: "DRONE", weight: 55, enabled: true }
 * Returns the chosen `.type` or null if no eligible entries.
 */
export function weightedChoice(table, randFn = Math.random) {
  const items = (table || []).filter((t) => t && (t.enabled ?? true) && (t.weight ?? 0) > 0);
  const total = items.reduce((s, it) => s + it.weight, 0);
  if (!total) return null;

  let r = randFn() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.type;
  }
  return items[items.length - 1].type;
}

/**
 * Spawn safety check: avoid spawning inside/near the player or overlapping existing objects.
 * ctx: { player, obstacles, enemies, powerups }
 */
export function isClearForSpawn(x, y, w, h, ctx = {}, opts = {}) {
  const minDistanceFromPlayer = opts.minDistanceFromPlayer ?? 80;

  const player = ctx.player;
  if (player) {
    const px = player.x ?? player.pos?.x ?? 0;
    const py = player.y ?? player.pos?.y ?? 0;
    const pw = player.w ?? player.width ?? 0;
    const ph = player.h ?? player.height ?? 0;

    // AABB distance heuristic
    const dx = Math.max(0, Math.max(px - (x + w), x - (px + pw)));
    const dy = Math.max(0, Math.max(py - (y + h), y - (py + ph)));
    const dist = Math.hypot(dx, dy);
    if (dist < minDistanceFromPlayer) return false;
  }

  const lists = [
    ...(ctx.obstacles || []),
    ...(ctx.enemies || []),
    ...(ctx.powerups || []),
  ];

  for (const o of lists) {
    if (!o) continue;
    const ox = o.x ?? o.pos?.x;
    const oy = o.y ?? o.pos?.y;
    const ow = o.w ?? o.width ?? (o.r ? o.r * 2 : undefined);
    const oh = o.h ?? o.height ?? (o.r ? o.r * 2 : undefined);

    if (typeof ox !== "number" || typeof oy !== "number" || typeof ow !== "number" || typeof oh !== "number") {
      continue;
    }

    if (rectsIntersect(x, y, w, h, ox, oy, ow, oh)) return false;
  }

  return true;
}

// --- Drawing helpers (kept abstract; no explicit extremist symbolism) ---
export function drawFauxBanner(p, x, y, w, h, C_BG, C_CIRCLE, C_SYMBOL) {
  p.push();
  p.noStroke();
  p.fill(C_BG);
  p.rect(x, y, w, h, 2);
  p.fill(C_CIRCLE);
  p.ellipse(x + w / 2, y + h / 2, w * 0.55, w * 0.55);

  // Abstract symbol: a rotated cross made from rectangles.
  p.fill(C_SYMBOL);
  p.translate(x + w / 2, y + h / 2);
  p.rotate(p.PI / 4);
  const s = w * 0.07;
  p.rect(-s / 2, -s * 3, s, s * 6);
  p.rect(-s * 3, -s / 2, s * 6, s);
  p.pop();
}

export function drawMoustache(p, cx, cy, w, h, color) {
  p.push();
  p.noStroke();
  p.fill(color);
  p.ellipse(cx - w * 0.2, cy, w * 0.55, h);
  p.ellipse(cx + w * 0.2, cy, w * 0.55, h);
  p.pop();
}

export function nowMs(p5) {
  // p5.millis() is relative to sketch start; for gameplay it's fine.
  return p5?.millis ? p5.millis() : Date.now();
}
