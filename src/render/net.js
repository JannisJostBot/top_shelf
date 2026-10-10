import { K, NETS } from '../config';
import { clamp, rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { view } from './canvas';
import { SH } from './colors';
import { R, disc, line, pixelAligned } from './pixels';

// The mesh is a small cloth seen from above: the roof and back netting of the goal as a grid of nodes.
// Only the rigid frame is pinned (crossbar row and the two side frames). The back netting hangs free between the
// back corners, so a goal billows it out behind the goal and it sways back. Strings resist stretching but go
// slack when compressed, which is what lets the mesh visibly ripple instead of snapping straight.
const BULGE = 4.5; // how far (world units) the back netting can billow out behind the frame
function makeCloth(n) {
  const C = 14,
    RW = 5,
    front = n.top ? n.y1 : n.y0,
    back = n.top ? n.y0 : n.y1,
    out = n.top ? -1 : 1,
    cl = {
      C,
      RW,
      out,
      nodes: [],
      sx: (n.x1 - n.x0) / (C - 1),
      sy: Math.abs(back - front) / (RW - 1),
      lo: Math.min(front, back) - (out < 0 ? BULGE : 0),
      hi: Math.max(front, back) + (out > 0 ? BULGE : 0),
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
        depth: r / (RW - 1),
        pin: r === 0 || c === 0 || c === C - 1,
      });
    }
  return cl;
}
for (const n of NETS) n.cloth = makeCloth(n);
function satisfy(a, b, L) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy) || 1e-6;
  if (d <= L || (a.pin && b.pin)) return;
  const k = (d - L) / d,
    wa = a.pin ? 0 : b.pin ? 1 : 0.5,
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
      const vx = (d.x - d.px) * 0.92,
        vy = (d.y - d.py) * 0.92;
      d.px = d.x;
      d.py = d.y;
      d.x += vx + (d.rx - d.x) * 0.03;
      d.y += vy + (d.ry - d.y) * 0.03;
    }
    for (let it = 0; it < 3; it++) {
      for (let r = 0; r < cl.RW; r++)
        for (let c = 0; c < C; c++) {
          const i = r * C + c;
          // strings may stretch a little when the netting billows, then pull taut
          if (c < C - 1) satisfy(N[i], N[i + 1], cl.sx * 1.15);
          if (r < cl.RW - 1) satisfy(N[i], N[i + C], cl.sy * 1.6);
        }
      for (const d of N) {
        if (d.pin) continue;
        d.x = clamp(d.x, n.x0 + 0.3, n.x1 - 0.3);
        d.y = clamp(d.y, cl.lo + 0.25, cl.hi - 0.25);
      }
    }
  }
}
/** A puck strike at x. dir 1 pushes the netting outward (shot into the goal), -1 pushes it in (hit from behind). */
export function netHit(n, x, str, dir = 1) {
  const cl = n.cloth;
  for (const d of cl.nodes) {
    if (d.pin) continue;
    const g = Math.exp(-(((d.x - x) / 4.6) ** 2)) * (0.35 + 0.65 * d.depth);
    d.py = d.y - cl.out * dir * str * 1.1 * g;
    d.px = d.x - rnd(-0.25, 0.25) * str * g;
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
  // billowed back netting: fill the fabric between the back bar and the displaced back row
  const barY = cl.out < 0 ? y0 : y1,
    back = (cl.RW - 1) * C;
  for (let c = 0; c < C - 1; c++) {
    const ax = toS(N[back + c].x),
      ay = toS(N[back + c].y),
      bx = toS(N[back + c + 1].x),
      by = toS(N[back + c + 1].y);
    for (let px = Math.min(ax, bx); px <= Math.max(ax, bx); px++) {
      const py = bx === ax ? ay : Math.round(ay + ((by - ay) * (px - ax)) / (bx - ax)),
        ext = (py - barY) * cl.out;
      if (ext > 0) R(px, cl.out < 0 ? py : barY, 1, ext, '#e1e8f0');
    }
  }
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
// The image extends past the back bar so billowed netting fits.
const BULGE_PX = Math.ceil(BULGE * K) + 1;
function meshImage(n, x0, y0, x1, y1) {
  const cl = n.cloth,
    N = cl.nodes,
    oy = cl.out < 0 ? y0 - BULGE_PX : y0;
  if (!cl.img) {
    cl.img = document.createElement('canvas');
    cl.img.width = x1 - x0 + 1;
    cl.img.height = y1 - y0 + 1 + BULGE_PX;
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
    view.ctx.setTransform(1, 0, 0, 1, -x0, -oy);
    drawMesh(n, x0, y0, x1, y1);
    view.ctx = save;
  }
  return { img: cl.img, oy };
}
export function drawNet(n) {
  const x0 = n.x0 * K,
    x1 = n.x1 * K,
    y0 = n.y0 * K,
    y1 = n.y1 * K;
  if (!n.top) R(x0 + 2, y1 + 2, x1 - x0 - 4, 2, SH);
  if (view.ctx.globalAlpha === 1 && pixelAligned(view.ctx) && !view.sil) {
    const m = meshImage(n, x0, y0, x1, y1);
    view.ctx.drawImage(m.img, x0, m.oy);
  } else drawMesh(n, x0, y0, x1, y1);
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
