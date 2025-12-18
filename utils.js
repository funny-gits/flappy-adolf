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
 * Fictional WW2-era-style banner: cloth folds, stitching, grommets, neutral emblem.
 * No real-world extremist symbols.
 *
 * Signature kept compatible: drawFauxBanner(x,y,w,h, fillCol?, strokeCol?)
 */
export function drawFauxBanner(x, y, w, h, fillCol, strokeCol) {
  const p = globalThis;
  if (!p || typeof p.push !== "function") return;

  // Defensive defaults (avoid p5 color parser throwing)
  try {
    if (fillCol == null) fillCol = p.color(110, 0, 0);
  } catch { fillCol = "rgb(110,0,0)"; }
  try {
    if (strokeCol == null) strokeCol = p.color(0);
  } catch { strokeCol = "rgb(0,0,0)"; }

  p.push();

  // Base cloth
  p.noStroke();
  p.fill(fillCol);
  p.rect(x, y, w, h, 4);

  // Cloth folds (stable, gentle animation via sin; no random)
  const t = (typeof p.frameCount === "number") ? p.frameCount : 0;
  const wave = Math.sin(t * 0.03 + x * 0.01) * 0.5; // subtle
  const foldCount = 7;
  for (let i = 0; i < foldCount; i++) {
    const u = i / (foldCount - 1);
    const xx = x + u * w;
    const fold = Math.sin(u * Math.PI * 2 + wave) * 0.5 + 0.5;
    const a = 10 + fold * 26;
    p.fill(0, 0, 0, a);
    p.rect(xx, y + 2, 1.5, h - 4);
  }

  // Inner border
  p.noFill();
  p.stroke(strokeCol);
  p.strokeWeight(1.5);
  p.rect(x + 3, y + 3, w - 6, h - 6, 3);

  // Stitching (dotted)
  p.stroke(255, 255, 255, 120);
  p.strokeWeight(1);
  const step = Math.max(6, Math.floor(w / 12));
  for (let xx = x + 6; xx <= x + w - 6; xx += step) {
    p.point(xx, y + 6);
    p.point(xx, y + h - 6);
  }
  const vStep = Math.max(6, Math.floor(h / 10));
  for (let yy = y + 6; yy <= y + h - 6; yy += vStep) {
    p.point(x + 6, yy);
    p.point(x + w - 6, yy);
  }

  // Grommets
  p.noStroke();
  p.fill(220, 220, 220, 160);
  const g = Math.min(w, h) * 0.08;
  p.ellipse(x + g, y + g, g, g);
  p.ellipse(x + w - g, y + g, g, g);
  p.fill(0, 0, 0, 110);
  p.ellipse(x + g, y + g, g * 0.45, g * 0.45);
  p.ellipse(x + w - g, y + g, g * 0.45, g * 0.45);

  // Neutral emblem: circle + 5-point star + chevrons
  const cx = x + w * 0.52;
  const cy = y + h * 0.55;
  const R = Math.min(w, h) * 0.28;

  p.noStroke();
  p.fill(255, 255, 255, 200);
  p.ellipse(cx, cy, R * 2.2, R * 2.2);

  p.fill(strokeCol);
  drawStar(p, cx, cy, R * 0.55, R * 1.05, 5);

  // Chevrons
  p.fill(0, 0, 0, 140);
  p.beginShape();
  p.vertex(cx - R * 0.90, cy + R * 0.15);
  p.vertex(cx,           cy + R * 0.85);
  p.vertex(cx + R * 0.90, cy + R * 0.15);
  p.vertex(cx + R * 0.70, cy + R * 0.05);
  p.vertex(cx,           cy + R * 0.65);
  p.vertex(cx - R * 0.70, cy + R * 0.05);
  p.endShape(p.CLOSE);

  p.pop();
}

function drawStar(p, x, y, r1, r2, n) {
  p.beginShape();
  for (let i = 0; i < n * 2; i++) {
    const ang = (Math.PI * i) / n - Math.PI / 2;
    const r = (i % 2 === 0) ? r2 : r1;
    p.vertex(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
  }
  p.endShape(p.CLOSE);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
