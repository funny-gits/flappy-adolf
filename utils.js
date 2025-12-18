// utils.js

export function collideRectRect(x, y, w, h, x2, y2, w2, h2) {
  return x + w >= x2 && x <= x2 + w2 && y + h >= y2 && y <= y2 + h2;
}

export function collideRectCircle(rx, ry, rw, rh, cx, cy, diameter, p5Instance) {
  let testX = cx;
  let testY = cy;

  if (cx < rx) testX = rx;
  else if (cx > rx + rw) testX = rx + rw;

  if (cy < ry) testY = ry;
  else if (cy > ry + rh) testY = ry + rh;

  const distance = p5Instance.dist(cx, cy, testX, testY);
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
