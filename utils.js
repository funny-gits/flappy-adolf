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

export function isClearForSpawn(candidateRect, existingRects, padding = 0) {
  // candidateRect: {x,y,w,h}
  // existingRects: array of {x,y,w,h}
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

export function drawFauxBanner(x, y, w, h, fillCol, strokeCol) {
  // This intentionally avoids real-world extremist symbols.
  // It's a stylized, fictional “unit banner” with folds + a neutral emblem.
  const p = globalThis;
  if (!p || typeof p.push !== "function") return;

  // Defensive defaults: never pass undefined into p5 color APIs.
  const fallbackFill = (typeof p.color === "function") ? p.color(110, 0, 0) : "#6e0000";
  const fallbackStroke = (typeof p.color === "function") ? p.color(0) : "#000000";
  const safeFill = (fillCol == null) ? fallbackFill : fillCol;
  const safeStroke = (strokeCol == null) ? fallbackStroke : strokeCol;

  p.push();
  p.stroke(safeStroke);
  p.strokeWeight(2);

  // Base cloth
  p.fill(safeFill);
  p.rect(x, y, w, h, 4);

  // Folds / texture (stable; no per-frame randomness)
  p.noStroke();
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const xx = x + t * w;
    const shade = 18 + 22 * Math.sin((t * Math.PI) * 2);
    p.fill(0, 0, 0, 14 + shade * 0.25);
    p.rect(xx - 1, y + 2, 2, h - 4);
  }

  // Inner border
  p.noFill();
  p.stroke(safeStroke);
  p.strokeWeight(1.5);
  p.rect(x + 3, y + 3, w - 6, h - 6, 3);

  // Neutral emblem: shield + chevron + dot (recognisable, not real-world)
  const cx = x + w * 0.5;
  const cy = y + h * 0.52;
  const sw = w * 0.45;
  const sh = h * 0.55;

  p.noStroke();
  p.fill(255, 255, 255, 200);
  p.beginShape();
  p.vertex(cx - sw * 0.5, cy - sh * 0.35);
  p.vertex(cx + sw * 0.5, cy - sh * 0.35);
  p.vertex(cx + sw * 0.35, cy + sh * 0.15);
  p.vertex(cx,           cy + sh * 0.40);
  p.vertex(cx - sw * 0.35, cy + sh * 0.15);
  p.endShape(p.CLOSE);

  p.fill(0, 0, 0, 150);
  p.beginShape();
  p.vertex(cx - sw * 0.32, cy - sh * 0.10);
  p.vertex(cx,             cy + sh * 0.18);
  p.vertex(cx + sw * 0.32, cy - sh * 0.10);
  p.vertex(cx + sw * 0.22, cy - sh * 0.22);
  p.vertex(cx,             cy + sh * 0.02);
  p.vertex(cx - sw * 0.22, cy - sh * 0.22);
  p.endShape(p.CLOSE);

  p.fill(0, 0, 0, 160);
  p.ellipse(cx, cy - sh * 0.22, sw * 0.12, sw * 0.12);

  p.pop();
}


function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
