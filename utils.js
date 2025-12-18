// FILE: utils.js
// Utility helpers for flappy-adolf / Jetpack Jumper.
// Goal: stable visuals (no per-frame random flicker) + safe drawing helpers.

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function collideRectRect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 &&
         x1 + w1 > x2 &&
         y1 < y2 + h2 &&
         y1 + h1 > y2;
}

export function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter) {
  const radius = diameter / 2;
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= (radius * radius);
}

/**
 * Deterministic RNG (Mulberry32).
 * Use this for procedural detail generation so things don't flicker every frame.
 */
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x12345678;
  function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    float: () => next(),
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: (arr) => (arr && arr.length ? arr[Math.floor(next() * arr.length)] : undefined),
  };
}

/**
 * Spawn safety helper: checks a candidate rect doesn't overlap existing rects.
 * candidateRect: {x,y,w,h}; existingRects: [{x,y,w,h}]
 */
export function isClearForSpawn(candidateRect, existingRects, padding = 0) {
  if (!candidateRect || !existingRects || !Array.isArray(existingRects)) return true;
  const cx = candidateRect.x - padding;
  const cy = candidateRect.y - padding;
  const cw = candidateRect.w + padding * 2;
  const ch = candidateRect.h + padding * 2;
  for (const r of existingRects) {
    if (!r) continue;
    if (collideRectRect(cx, cy, cw, ch, r.x, r.y, r.w, r.h)) return false;
  }
  return true;
}

/**
 * Fictional “unit banner” (no real-world extremist symbols).
 * fillCol/strokeCol may be undefined from old call sites; we guard with defaults.
 */
export function drawFauxBanner(x, y, w, h, fillCol, strokeCol) {
  const p = globalThis;
  if (!p || typeof p.push !== "function") return;

  // Defensive defaults (avoid p5 color exceptions)
  if (fillCol == null) {
    try { fillCol = p.color(110, 0, 0); } catch { fillCol = "rgb(110,0,0)"; }
  }
  if (strokeCol == null) {
    try { strokeCol = p.color(0); } catch { strokeCol = "rgb(0,0,0)"; }
  }

  p.push();

  // cloth base with subtle shading
  p.noStroke();
  p.fill(fillCol);
  p.rect(x, y, w, h, 4);

  // folds (stable: uses sin-based shading)
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const xx = x + t * w;
    const shade = 16 + 18 * Math.sin(t * Math.PI * 2);
    p.fill(0, 0, 0, shade);
    p.rect(xx - 1, y + 2, 2, h - 4);
  }

  // border + stitching
  p.noFill();
  p.stroke(strokeCol);
  p.strokeWeight(1.8);
  p.rect(x + 2.5, y + 2.5, w - 5, h - 5, 3);

  p.stroke(255, 255, 255, 70);
  p.strokeWeight(1);
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    p.point(x + 5 + t * (w - 10), y + 5);
    p.point(x + 5 + t * (w - 10), y + h - 5);
  }

  // emblem: shield + chevron + star (fictional, recognisable)
  const cx = x + w * 0.5;
  const cy = y + h * 0.55;
  const sw = w * 0.45;
  const sh = h * 0.55;

  p.noStroke();
  p.fill(255, 255, 255, 210);
  p.beginShape();
  p.vertex(cx - sw * 0.5, cy - sh * 0.35);
  p.vertex(cx + sw * 0.5, cy - sh * 0.35);
  p.vertex(cx + sw * 0.35, cy + sh * 0.15);
  p.vertex(cx,            cy + sh * 0.42);
  p.vertex(cx - sw * 0.35, cy + sh * 0.15);
  p.endShape(p.CLOSE);

  p.fill(0, 0, 0, 150);
  p.beginShape();
  p.vertex(cx - sw * 0.32, cy - sh * 0.12);
  p.vertex(cx,             cy + sh * 0.18);
  p.vertex(cx + sw * 0.32, cy - sh * 0.12);
  p.vertex(cx + sw * 0.22, cy - sh * 0.25);
  p.vertex(cx,             cy + sh * 0.02);
  p.vertex(cx - sw * 0.22, cy - sh * 0.25);
  p.endShape(p.CLOSE);

  p.fill(0, 0, 0, 160);
  drawStar(p, cx, cy - sh * 0.24, sw * 0.12, 5);

  p.pop();
}

function drawStar(p, cx, cy, r, points) {
  const step = Math.PI / points;
  p.beginShape();
  for (let i = 0; i < points * 2; i++) {
    const rr = (i % 2 === 0) ? r : r * 0.45;
    const a = i * step - Math.PI / 2;
    p.vertex(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.endShape(p.CLOSE);
}
