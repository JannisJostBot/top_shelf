import { S } from '../audio/sfx';
import { pick, toS } from '../core/math';
import { clock } from '../core/time';
import { G } from '../game/world';
import { R, ellipsePx } from './pixels';

export const pops = [],
  rings = [];
export function pop(x, y, text, col, big) {
  if (G.demo) return;
  pops.push({ x, y, text, col, big, t0: clock.now });
  if (pops.length > 5) pops.shift();
}
export function ring(x, y, col, size) {
  rings.push({ x, y, col, size: size || 1, t0: clock.now });
}
export function drawFx(g) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i],
      t = clock.now - r.t0;
    if (t > 0.35) {
      rings.splice(i, 1);
      continue;
    }
    const k = t / 0.35;
    g.globalAlpha = 1 - k;
    ellipsePx(
      g,
      toS(r.x),
      toS(r.y) - 4,
      Math.round((6 + k * 22) * r.size),
      Math.round((3 + k * 10) * r.size),
      r.col,
    );
  }
  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i],
      t = clock.now - p.t0;
    if (t > 1.05) {
      pops.splice(i, 1);
      continue;
    }
    const a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.3,
      sx = toS(p.x),
      sy = toS(p.y) - 30 - Math.round(t * 20),
      sz = p.big ? (t < 0.1 ? 14 : 10) : 7;
    g.font = sz + 'px "Press Start 2P", monospace';
    g.globalAlpha = a;
    g.fillStyle = '#0a0f1e';
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [1, 1],
      [2, 2],
    ])
      g.fillText(p.text, sx + dx, sy + dy);
    g.fillStyle = p.col;
    g.fillText(p.text, sx, sy);
  }
  g.globalAlpha = 1;
  g.textAlign = 'left';
}

/* ---------- trash talk bubbles ---------- */
export const bubbles = [],
  CURSES = ['#@%&!', '?&!*#', '$#!%!', '@!#?@!', '*&%$#!', '%@#!!', '&#@*?'];
export function bubble(p, text, delay) {
  bubbles.push({ p, text: text || pick(CURSES), t0: clock.now + (delay || 0), dur: 1.7, played: false });
}
export function drawBubbles(g) {
  g.font = '7px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i],
      t = clock.now - b.t0;
    if (t < 0) continue;
    if (t > b.dur) {
      bubbles.splice(i, 1);
      continue;
    }
    if (!b.played) {
      b.played = true;
      S('grumble', b.p);
    }
    const p = b.p,
      shake = Math.round(Math.sin(clock.now * 45)),
      sx = toS(p.x) + shake,
      sy = toS(p.y) - 28 - Math.round(p.jump || 0) - (t < 0.12 ? Math.round((1 - t / 0.12) * 4) : 0);
    const tw = Math.ceil((g.measureText(b.text) || { width: 40 }).width),
      w = tw + 10,
      h = 13,
      x0 = sx - (w >> 1),
      y0 = sy - h;
    R(g, x0 - 1, y0 + 1, w + 2, h - 2, '#0b0f1a');
    R(g, x0 + 1, y0 - 1, w - 2, h + 2, '#0b0f1a');
    R(g, x0, y0, w, h, '#ffffff');
    R(g, sx - 3, y0 + h, 6, 2, '#0b0f1a');
    R(g, sx - 2, y0 + h, 4, 1, '#ffffff');
    R(g, sx - 1, y0 + h + 2, 3, 2, '#0b0f1a');
    R(g, sx, y0 + h + 1, 1, 1, '#ffffff');
    g.fillStyle = '#d8343f';
    g.fillText(b.text, sx, y0 + h / 2 + 1);
  }
  g.textAlign = 'left';
}
