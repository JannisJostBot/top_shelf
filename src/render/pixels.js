import { view } from './canvas';
import { SH } from './colors';

/* ---------- render (canvas pixels) ---------- */
// Every drawing function takes the 2D context it draws into as its first argument, `g`.

export function R(g, x, y, w, h, c) {
  if (view.sil) {
    if (c === SH) return;
    c = view.sil;
  }
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}
export function line(g, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    R(g, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, c);
  }
}
function blitPixels(g, map, pal, x0, y0, flip) {
  const w = map[0].length;
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      let col = pal[ch];
      if (typeof col === 'function') col = col(r, c);
      R(g, flip ? x0 + w - 1 - c : x0 + c, y0 + r, 1, 1, col);
    }
  }
}

// Sprites are pre-rendered once per (palette, map, flip, silhouette) and stamped with drawImage, which replaces
// hundreds of 1x1 fillRects per character. Only used when the current transform maps pixels 1:1 onto whole
// device pixels (integer scale and offset) at full opacity, so the output is pixel-identical to the per-pixel path.
// Palettes with animated (function) colors are always drawn per pixel.
const spriteCache = new WeakMap();
function cachedSprite(map, pal, flip) {
  let byMap = spriteCache.get(pal);
  if (!byMap) spriteCache.set(pal, (byMap = new Map()));
  let e = byMap.get(map);
  if (!e) {
    let dynamic = false;
    for (const row of map)
      for (const ch of row) if (ch !== '.' && typeof pal[ch] === 'function') dynamic = true;
    e = { dynamic };
    byMap.set(map, e);
  }
  if (e.dynamic) return null;
  const key = (flip ? 'f' : 'n') + (view.sil || '');
  let c = e[key];
  if (!c) {
    c = document.createElement('canvas');
    c.width = map[0].length;
    c.height = map.length;
    blitPixels(c.getContext('2d'), map, pal, 0, 0, flip);
    e[key] = c;
  }
  return c;
}
export function pixelAligned(g) {
  const m = g.getTransform();
  return (
    m.b === 0 &&
    m.c === 0 &&
    m.a === m.d &&
    Number.isInteger(m.a) &&
    Number.isInteger(m.e) &&
    Number.isInteger(m.f) &&
    (m.a === 1 || !g.imageSmoothingEnabled)
  );
}
export function blit(g, map, pal, x0, y0, flip) {
  const c = g.globalAlpha === 1 && pixelAligned(g) && cachedSprite(map, pal, flip);
  if (c) g.drawImage(c, x0, y0);
  else blitPixels(g, map, pal, x0, y0, flip);
}
export function disc(g, cx, cy, rx, ry, c) {
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(2 * rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    R(g, cx - (w >> 1), cy + dy, w, 1, c);
  }
}
export function ellipsePx(g, cx, cy, rx, ry, c) {
  const n = Math.ceil((rx + ry) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.2832;
    R(g, Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1, c);
  }
}
