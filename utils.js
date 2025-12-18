// utils.js
// Small, dependency-free helpers used by main.js.
// NOTE: drawFauxBanner assumes p5.js is available on globalThis (window) at runtime.

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
 * Spawn safety check.
 * candidateRect: {x,y,w,h}
 * existingRects: [{x,y,w,h}, ...]
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
 * Fictional "unit banner" rendering.
 * Intentionally avoids real-world extremist symbols (including swastikas).
 * Design goals: recognisable, detailed, consistent (no per-frame random).
 */
export function drawFauxBanner(x, y, w, h, fillCol, strokeCol) {
  const p = globalThis;
  if (!p || typeof p.push !== "function") return;

  // Safe defaults if caller doesn't pass colors
  const cloth = fillCol ?? p.color(110, 0, 0);
  const ink = strokeCol ?? p.color(15, 15, 15);
  const trim = p.color(235, 230, 210, 210);

  p.push();
  p.noStroke();

  // Cloth base
  p.fill(cloth);
  p.rect(x, y, w, h, 4);

  // Cloth folds (stable "texture" using simple gradients)
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const alpha = 18 + Math.floor(22 * Math.sin(t * Math.PI));
    p.fill(0, 0, 0, alpha);
    p.rect(x + t * w, y + 1, 1, h - 2);
  }

  // Edge stitching
  p.stroke(trim);
  p.strokeWeight(1.5);
  p.noFill();
  p.rect(x + 2.5, y + 2.5, w - 5, h - 5, 3);

  // Inner border
  p.stroke(ink);
  p.strokeWeight(1);
  p.rect(x + 6, y + 6, w - 12, h - 12, 2);

  // Emblem: shield + laurel + star (fictional, neutral)
  const cx = x + w * 0.5;
  const cy = y + h * 0.56;

  // Laurel arcs
  p.noFill();
  p.stroke(trim);
  p.strokeWeight(Math.max(1, w * 0.03));
  p.arc(cx - w * 0.16, cy, w * 0.34, h * 0.46, p.PI * 0.15, p.PI * 0.95);
  p.arc(cx + w * 0.16, cy, w * 0.34, h * 0.46, p.PI * 0.05, p.PI * 0.85);

  // Shield shape
  p.noStroke();
  p.fill(255, 255, 255, 200);
  const sw = w * 0.42;
  const sh = h * 0.54;
  p.beginShape();
  p.vertex(cx - sw * 0.5, cy - sh * 0.35);
  p.vertex(cx + sw * 0.5, cy - sh * 0.35);
  p.vertex(cx + sw * 0.35, cy + sh * 0.12);
  p.vertex(cx,             cy + sh * 0.42);
  p.vertex(cx - sw * 0.35, cy + sh * 0.12);
  p.endShape(p.CLOSE);

  // Chevron
  p.fill(0, 0, 0, 150);
  p.beginShape();
  p.vertex(cx - sw * 0.32, cy - sh * 0.10);
  p.vertex(cx,             cy + sh * 0.18);
  p.vertex(cx + sw * 0.32, cy - sh * 0.10);
  p.vertex(cx + sw * 0.22, cy - sh * 0.22);
  p.vertex(cx,             cy + sh * 0.02);
  p.vertex(cx - sw * 0.22, cy - sh * 0.22);
  p.endShape(p.CLOSE);

  // Star (simple 5-point)
  p.fill(0, 0, 0, 170);
  const r1 = Math.max(3, w * 0.06);
  const r2 = r1 * 0.45;
  const starY = cy - sh * 0.24;
  p.beginShape();
  for (let i = 0; i < 10; i++) {
    const ang = -p.HALF_PI + i * (p.TWO_PI / 10);
    const r = (i % 2 === 0) ? r1 : r2;
    p.vertex(cx + Math.cos(ang) * r, starY + Math.sin(ang) * r);
  }
  p.endShape(p.CLOSE);

  p.pop();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
