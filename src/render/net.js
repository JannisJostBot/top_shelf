import { K, NETS } from '../config';
import { clamp, rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { view } from './canvas';
import { SH } from './colors';
import { R, disc, line, pixelAligned } from './pixels';

// The mesh is a small cloth: a grid of nodes pinned to the rigid frame (crossbar, back bar, side posts).
// Interior nodes move with verlet integration and stretch constraints, so a puck strike sends a real ripple.

function makeCloth(n) {
  const C = 14,
    RW = 5,
    front = n.top ? n.y1 : n.y0,
    back = n.top ? n.y0 : n.y1,
    cl = {
      C,
      RW,
      nodes: [],
      sx: (n.x1 - n.x0) / (C - 1),
      sy: Math.abs(back - front) / (RW - 1),
      lo: Math.min(front, back),
      hi: Math.max(front, back),
    };
  for (let r = 0; r < RW; r++)
    for (let c = 0; c < C; c++) {
      const x = n.x0 + ((n.x1 - n.x0) * c) / (C - 1),
        y = front + ((back - front) * r) / (RW - 1);
      cl.nodes.push({
        x,
        y,
        px: x,
        py: y,
        rx: x,
        ry: y,
        pin: r === 0 || r === RW - 1 || c === 0 || c === C - 1,
      });
    }
  return cl;
}
for (const n of NETS) n.cloth = makeCloth(n);
function satisfy(a, b, L) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy) || 1e-6,
    k = (d - L) / d;
  if (a.pin && b.pin) return;
  const wa = a.pin ? 0 : b.pin ? 1 : 0.5,
    wb = b.pin ? 0 : a.pin ? 1 : 0.5;
  a.x += dx * k * wa;
  a.y += dy * k * wa;
  b.x -= dx * k * wb;
  b.y -= dy * k * wb;
}
export function clothStep() {
  for (const n of NETS) {
    const cl = n.cloth,
      N = cl.nodes,
      C = cl.C;
    for (const d of N) {
      if (d.pin) continue;
      const vx = (d.x - d.px) * 0.9,
        vy = (d.y - d.py) * 0.9;
      d.px = d.x;
      d.py = d.y;
      d.x += vx + (d.rx - d.x) * 0.06;
      d.y += vy + (d.ry - d.y) * 0.06;
    }
    for (let it = 0; it < 3; it++) {
      for (let r = 0; r < cl.RW; r++)
        for (let c = 0; c < C; c++) {
          const i = r * C + c;
          if (c < C - 1) satisfy(N[i], N[i + 1], cl.sx);
          if (r < cl.RW - 1) satisfy(N[i], N[i + C], cl.sy);
        }
      for (const d of N) {
        if (d.pin) continue;
        d.x = clamp(d.x, n.x0 + 0.3, n.x1 - 0.3);
        d.y = clamp(d.y, cl.lo + 0.25, cl.hi - 0.25);
      }
    }
  }
}
export function netHit(n, x, str) {
  const out = n.top ? -1 : 1;
  for (const d of n.cloth.nodes) {
    if (d.pin) continue;
    const g = Math.exp(-(((d.x - x) / 3.4) ** 2));
    d.py = d.y - out * str * 1.25 * g;
    d.px = d.x - rnd(-0.15, 0.15) * str * g;
  }
}
export function resetCloth() {
  for (const n of NETS)
    for (const d of n.cloth.nodes) {
      d.x = d.px = d.rx;
      d.y = d.py = d.ry;
    }
}
function drawMesh(n, x0, y0, x1, y1) {
  const cl = n.cloth,
    N = cl.nodes,
    C = cl.C;
  R(x0, y0, x1 - x0, y1 - y0, '#f4f7fa');
  for (let r = 0; r < cl.RW; r++)
    for (let c = 0; c < C; c++) {
      const a = N[r * C + c];
      if (c < C - 1) {
        const b = N[r * C + c + 1];
        line(toS(a.x), toS(a.y), toS(b.x), toS(b.y), '#a9b9cb');
      }
      if (r < cl.RW - 1) {
        const b = N[(r + 1) * C + c];
        line(toS(a.x), toS(a.y), toS(b.x), toS(b.y), '#b9c7d6');
      }
    }
}
// The mesh only changes when a node moves onto a different pixel, so it is cached between ripples.
function meshImage(n, x0, y0, x1, y1) {
  const cl = n.cloth,
    N = cl.nodes;
  if (!cl.img) {
    cl.img = document.createElement('canvas');
    cl.img.width = x1 - x0 + 1;
    cl.img.height = y1 - y0 + 1;
    cl.drawnAt = new Int32Array(N.length * 2).fill(-1);
  }
  let dirty = false;
  for (let i = 0; i < N.length; i++) {
    const sx = toS(N[i].x),
      sy = toS(N[i].y);
    if (cl.drawnAt[2 * i] !== sx || cl.drawnAt[2 * i + 1] !== sy) {
      cl.drawnAt[2 * i] = sx;
      cl.drawnAt[2 * i + 1] = sy;
      dirty = true;
    }
  }
  if (dirty) {
    const save = view.ctx;
    view.ctx = cl.img.getContext('2d');
    view.ctx.setTransform(1, 0, 0, 1, 0, 0);
    view.ctx.clearRect(0, 0, cl.img.width, cl.img.height);
    view.ctx.setTransform(1, 0, 0, 1, -x0, -y0);
    drawMesh(n, x0, y0, x1, y1);
    view.ctx = save;
  }
  return cl.img;
}
export function drawNet(n) {
  const x0 = n.x0 * K,
    x1 = n.x1 * K,
    y0 = n.y0 * K,
    y1 = n.y1 * K;
  if (view.ctx.globalAlpha === 1 && pixelAligned(view.ctx) && !view.sil)
    view.ctx.drawImage(meshImage(n, x0, y0, x1, y1), x0, y0);
  else drawMesh(n, x0, y0, x1, y1);
  const red = '#d8343f',
    redD = '#8f1f28';
  R(x0, y0, 2, y1 - y0, red);
  R(x1 - 2, y0, 2, y1 - y0, red);
  R(x0, n.top ? y0 : y1 - 2, x1 - x0, 2, red);
  if (n.top) {
    R(x0, y1 - 2, 3, 2, redD);
    R(x1 - 3, y1 - 2, 3, 2, redD);
  } else {
    R(x0, y0, 3, 2, redD);
    R(x1 - 3, y0, 3, 2, redD);
    R(x0 + 2, y1 + 2, x1 - x0 - 4, 2, SH);
  }
  // goal lamp behind the net
  const cx = (x0 + x1) >> 1,
    ly = n.top ? y0 - 9 : y1 + 5,
    on = view.lamp && view.lamp.n === n && clock.now < view.lamp.until,
    lit = on && Math.floor(clock.now * 6) & 1;
  R(cx - 5, ly, 10, 5, '#1b2030');
  R(cx - 4, ly + 1, 8, 3, lit ? '#ff3b3b' : on ? '#b52020' : '#4a1818');
  if (lit) {
    view.ctx.globalAlpha = 0.28;
    disc(cx, ly + 2, 12, 6, '#ff3b3b');
    view.ctx.globalAlpha = 1;
  }
}
