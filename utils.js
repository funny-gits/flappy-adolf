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
export function isClearForSpawn(x, y, w, h, obstacles = [], enemies = [], padding = 16) {
  const rx = x - padding;
  const ry = y - padding;
  const rw = w + padding * 2;
  const rh = h + padding * 2;

  for (const o of obstacles) {
    if (!o) continue;
    if (collideRectRect(rx, ry, rw, rh, o.x, o.y, o.w, o.h)) return false;
  }
  for (const e of enemies) {
    if (!e) continue;
    if (collideRectRect(rx, ry, rw, rh, e.x, e.y, e.w, e.h)) return false;
  }
  return true;
}

