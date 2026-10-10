import { view } from './canvas';
import { SH } from './colors';

/* ---------- render (canvas pixels) ---------- */

export function R(x, y, w, h, c) {
  if (view.sil) {
    if (c === SH) return;
    c = view.sil;
  }
  view.ctx.fillStyle = c;
  view.ctx.fillRect(x, y, w, h);
}
export function line(x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    R(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, c);
  }
}
export function blit(map, pal, x0, y0, flip) {
  const w = map[0].length;
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      let col = pal[ch];
      if (typeof col === 'function') col = col(r, c);
      R(flip ? x0 + w - 1 - c : x0 + c, y0 + r, 1, 1, col);
    }
  }
}
export function disc(cx, cy, rx, ry, c) {
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(2 * rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    R(cx - (w >> 1), cy + dy, w, 1, c);
  }
}
export function ellipsePx(cx, cy, rx, ry, c) {
  const n = Math.ceil((rx + ry) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.2832;
    R(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1, c);
  }
}
