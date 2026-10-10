import { GB, GT, IH, IW, K, NETS, RR, RX0, RX1, RY0, RY1 } from '../config';
import { lerp } from '../core/math';
import { clock } from '../core/time';
import { STADIUMS } from '../data/stadiums';
import { players } from '../game/players';
import { G, parts, puck, ref } from '../game/world';
import { cinema } from './atmosphere';
import { view } from './canvas';
import { SH } from './colors';
import { iceBuf } from './ice';
import { replayOverlay } from './overlays';
import { R } from './pixels';
import { drawGoalie, drawRef, drawSkater } from './players';
import { puckPixels } from './puck';
import { FAN_ROWS, U32, fanTab } from './stands';
import { settings } from '../settings';

/* ---------- 2.5D replay renderer (Mode 7 floor + raycast boards + billboard sprites) ---------- */
let img3 = null,
  buf3 = null;
const SPC = document.createElement('canvas');
SPC.width = 48;
SPC.height = 56;
const spx = SPC.getContext('2d');
export function insideRinkW(x, y) {
  if (x < RX0 || x > RX1 || y < RY0 || y > RY1) return false;
  const cx = x < RX0 + RR ? RX0 + RR : x > RX1 - RR ? RX1 - RR : null,
    cy = y < RY0 + RR ? RY0 + RR : y > RY1 - RR ? RY1 - RR : null;
  return cx === null || cy === null || Math.hypot(x - cx, y - cy) <= RR;
}
export function upd3D(snap) {
  const A = G.rp && G.rp.angle;
  if (!A || !A.mode7 || !G.lastNet) return;
  const C = G.cam3 || (G.cam3 = { x: 80, y: 128, yaw: 0, h: 8.5 });
  const n = G.lastNet,
    gc = { x: 80, y: n.top ? GT : GB };
  let tx, ty, yaw, h;
  if (A.mode7 === 'chase') {
    const dx = gc.x - puck.x,
      dy = gc.y - puck.y;
    yaw = Math.hypot(dx, dy) < 18 && C.pyaw !== undefined && !snap ? C.pyaw : Math.atan2(dy, dx);
    C.pyaw = yaw;
    tx = puck.x - Math.cos(yaw) * 26;
    ty = puck.y - Math.sin(yaw) * 26;
    h = 8.5;
  } else {
    tx = n.x1 + 7;
    ty = n.top ? GT - 3 : GB + 3;
    yaw = Math.atan2(puck.y - ty, puck.x - tx);
    h = 6.5;
  }
  for (let i = 0; i < 30 && !insideRinkW(tx, ty); i++) {
    tx = lerp(tx, 80, 0.1);
    ty = lerp(ty, 128, 0.1);
  }
  const k = snap ? 1 : 0.09;
  C.x += (tx - C.x) * k;
  C.y += (ty - C.y) * k;
  C.h = h;
  const dyaw = ((yaw - C.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  C.yaw += dyaw * (snap ? 1 : 0.08);
}
function glassTint(c) {
  const r = c & 255,
    g = (c >> 8) & 255,
    b = (c >> 16) & 255;
  return (
    ((255 << 24) |
      (((b * 0.75 + 240 * 0.25) | 0) << 16) |
      (((g * 0.75 + 228 * 0.25) | 0) << 8) |
      ((r * 0.75 + 205 * 0.25) | 0)) >>>
    0
  );
}
export function render3D() {
  const C3 = G.cam3 || { x: 80, y: 128, yaw: 0, h: 8.5 },
    f = view.CW * 0.65,
    cxs = view.CW / 2,
    hor = Math.round(view.CH * 0.4),
    h = C3.h;
  const Fx = Math.cos(C3.yaw),
    Fy = Math.sin(C3.yaw),
    Rx = -Fy,
    Ry = Fx;
  view.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!img3 || img3.width !== view.CW || img3.height !== view.CH) {
    img3 = view.ctx.createImageData(view.CW, view.CH);
    buf3 = img3 && img3.data ? new Uint32Array(img3.data.buffer) : null;
  }
  if (buf3 && fanTab.length) {
    const S = STADIUMS[settings.stadiumKey],
      KICK = U32(S.kick),
      BOARD = U32('#f3f5f8'),
      STAND = U32('#141a2c'),
      SEAT = U32('#0b0f1c'),
      ARENA = U32(S.arena),
      ROOF = U32('#070a14'),
      LIGHT = U32('#fff4d6'),
      roofY = hor - Math.round(view.CH * 0.3),
      hype = G.hype;
    for (let x = 0; x < view.CW; x++) {
      const k = (x - cxs) / f,
        dx = Fx + Rx * k,
        dy = Fy + Ry * k;
      let t = 0.5;
      while (t < 420 && insideRinkW(C3.x + dx * t, C3.y + dy * t)) t += 1.2;
      if (t < 420) {
        let lo = Math.max(0.1, t - 1.2),
          hi = t;
        for (let i = 0; i < 5; i++) {
          const m = (lo + hi) / 2;
          if (insideRinkW(C3.x + dx * m, C3.y + dy * m)) lo = m;
          else hi = m;
        }
        t = hi;
      }
      const wb = hor + (h * f) / t,
        bt = hor + ((h - 4.5) * f) / t,
        gt = hor + ((h - 10) * f) / t,
        kick = wb - (wb - bt) * 0.22;
      let bcol = BOARD;
      const bx = ((C3.x + dx * (t + 1.2)) * K) | 0,
        by = ((C3.y + dy * (t + 1.2)) * K) | 0;
      if (iceBuf && bx >= 0 && by >= 0 && bx < IW && by < IH) bcol = iceBuf[by * IW + bx];
      const ang = C3.yaw + Math.atan(k);
      let u = Math.floor((ang / (2 * Math.PI)) * 512) % 512;
      if (u < 0) u += 512;
      const seat = u >> 2,
        xin = u & 3;
      for (let y = 0; y < view.CH; y++) {
        let col;
        if (y > wb) {
          const tt = (h * f) / (y - hor),
            ix = ((C3.x + dx * tt) * K) | 0,
            iy = ((C3.y + dy * tt) * K) | 0;
          col = iceBuf && ix >= 0 && iy >= 0 && ix < IW && iy < IH ? iceBuf[iy * IW + ix] : ARENA;
        } else if (y >= kick) col = KICK;
        else if (y >= bt) col = bcol;
        else if (y < roofY) col = u % 64 < 3 && y % 26 < 2 ? LIGHT : ROOF;
        else {
          const row = (y / 7) | 0,
            fan = fanTab[seat * FAN_ROWS + (row % FAN_ROWS)],
            bob = hype > 0.05 ? Math.round(Math.sin(clock.now * 11 + fan.ph) * hype * 2) : 0,
            w = y - row * 7 - bob;
          col = y - row * 7 === 6 ? SEAT : STAND;
          if (!fan.empty) {
            if (w >= 0 && w < 2 && xin >= 1 && xin <= 2) col = fan.head;
            else if (w >= 2 && w < 6) col = xin === 3 ? fan.bodyD : fan.body;
          }
          if (y >= gt) col = glassTint(col);
        }
        buf3[y * view.CW + x] = col;
      }
    }
    view.ctx.putImageData(img3, 0, 0);
    const fog = view.ctx.createLinearGradient(0, hor, 0, hor + view.CH * 0.25);
    if (fog) {
      fog.addColorStop(0, 'rgba(10,15,30,.35)');
      fog.addColorStop(1, 'rgba(10,15,30,0)');
      view.ctx.fillStyle = fog;
      view.ctx.fillRect(0, hor, view.CW, view.CH * 0.25);
    }
  }
  const proj = (wx, wy, wz) => {
    const ddx = wx - C3.x,
      ddy = wy - C3.y,
      d = ddx * Fx + ddy * Fy;
    if (d < 0.8) return null;
    const l = ddx * Rx + ddy * Ry;
    return { x: cxs + (l / d) * f, y: hor + ((h - (wz || 0)) * f) / d, s: f / d, d };
  };
  const rel = (e, fn) => {
    const ox = e.x,
      oy = e.y,
      ofx = e.fx,
      ofy = e.fy,
      a = ofx * Fx + ofy * Fy,
      b = ofx * Rx + ofy * Ry;
    e.x = 0;
    e.y = 0;
    e.fx = b;
    e.fy = -a;
    try {
      fn();
    } finally {
      e.x = ox;
      e.y = oy;
      e.fx = ofx;
      e.fy = ofy;
    }
  };
  const billboard = (draw, q) => {
    const sc = q.s / K;
    if (sc > 14) return;
    spx.setTransform(1, 0, 0, 1, 0, 0);
    spx.clearRect(0, 0, 48, 56);
    const save = view.ctx;
    view.ctx = spx;
    view.ctx.setTransform(1, 0, 0, 1, 24, 44);
    try {
      draw();
    } finally {
      view.ctx.setTransform(1, 0, 0, 1, 0, 0);
      view.ctx = save;
    }
    view.ctx.imageSmoothingEnabled = false;
    view.ctx.drawImage(
      SPC,
      Math.round(q.x - 24 * sc),
      Math.round(q.y - 44 * sc),
      Math.round(48 * sc),
      Math.round(56 * sc),
    );
  };
  const items = [];
  for (const p of players) items.push({ e: p, k: p.role, d: (p.x - C3.x) * Fx + (p.y - C3.y) * Fy });
  items.push({ e: ref, k: 'R', d: (ref.x - C3.x) * Fx + (ref.y - C3.y) * Fy });
  items.push({ e: puck, k: 'P', d: (puck.x - C3.x) * Fx + (puck.y - C3.y) * Fy - 0.3 });
  for (const n of NETS) items.push({ e: n, k: 'N', d: (80 - C3.x) * Fx + ((n.y0 + n.y1) / 2 - C3.y) * Fy });
  items.sort((a, b) => b.d - a.d);
  for (const it of items) {
    const e = it.e;
    if (it.k === 'N') {
      drawNet3D(e, proj);
      continue;
    }
    if (it.k === 'P') {
      if (puck.owner && puck.owner.role === 'G') continue;
      const q = proj(puck.x, puck.y, puck.z);
      if (q && q.d > 4)
        billboard(() => {
          R(-2, 2, 5, 1, SH);
          puckPixels(0, 0);
        }, q);
      continue;
    }
    const q = proj(e.x, e.y, 0);
    if (!q) continue;
    if (it.k === 'R') rel(e, () => billboard(drawRef, q));
    else rel(e, () => billboard(() => (e.role === 'G' ? drawGoalie(e) : drawSkater(e)), q));
  }
  for (const p of parts) {
    const q = proj(p.x, p.y, 1);
    if (!q) continue;
    view.ctx.globalAlpha = Math.min(1, p.life * 3);
    view.ctx.fillStyle = p.c;
    const z = Math.max(1, Math.round(q.s * 0.35));
    view.ctx.fillRect(Math.round(q.x), Math.round(q.y - z * 2), z, z);
  }
  view.ctx.globalAlpha = 1;
  cinema();
  replayOverlay();
}
function drawNet3D(n, proj) {
  const front = n.top ? n.y1 : n.y0,
    back = n.top ? n.y0 : n.y1,
    Hn = 4.2;
  const P = [
    [n.x0, front, 0],
    [n.x1, front, 0],
    [n.x0, back, 0],
    [n.x1, back, 0],
    [n.x0, front, Hn],
    [n.x1, front, Hn],
    [n.x0, back, Hn * 0.55],
    [n.x1, back, Hn * 0.55],
  ].map(a => proj(a[0], a[1], a[2]));
  if (P.some(q => !q)) return;
  const [FL, FR, BL, BR, TL, TR, BLt, BRt] = P;
  view.ctx.save();
  view.ctx.setTransform(1, 0, 0, 1, 0, 0);
  const poly = (pts, fill) => {
    view.ctx.beginPath();
    pts.forEach((q, i) => (i ? view.ctx.lineTo(q.x, q.y) : view.ctx.moveTo(q.x, q.y)));
    view.ctx.closePath();
    view.ctx.fillStyle = fill;
    view.ctx.fill();
  };
  view.ctx.globalAlpha = 0.55;
  poly([BLt, BRt, BR, BL], '#e9eef4');
  poly([TL, BLt, BL, FL], '#dfe6ee');
  poly([TR, BRt, BR, FR], '#dfe6ee');
  poly([TL, TR, BRt, BLt], '#f4f7fa');
  view.ctx.globalAlpha = 1;
  view.ctx.strokeStyle = '#a9b9cb';
  view.ctx.lineWidth = Math.max(1, FL.s * 0.08);
  view.ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    const a = i / 6;
    view.ctx.moveTo(lerp(TL.x, TR.x, a), lerp(TL.y, TR.y, a));
    view.ctx.lineTo(lerp(BLt.x, BRt.x, a), lerp(BLt.y, BRt.y, a));
    view.ctx.lineTo(lerp(BL.x, BR.x, a), lerp(BL.y, BR.y, a));
  }
  view.ctx.stroke();
  view.ctx.strokeStyle = '#d8343f';
  view.ctx.lineWidth = Math.max(1.5, FL.s * 0.45);
  view.ctx.beginPath();
  view.ctx.moveTo(FL.x, FL.y);
  view.ctx.lineTo(TL.x, TL.y);
  view.ctx.lineTo(TR.x, TR.y);
  view.ctx.lineTo(FR.x, FR.y);
  view.ctx.moveTo(BL.x, BL.y);
  view.ctx.lineTo(BR.x, BR.y);
  view.ctx.stroke();
  const L = proj(80, back + (n.top ? -2 : 2), Hn + 2.5);
  if (L) {
    const on = view.lamp && view.lamp.n === n && clock.now < view.lamp.until,
      lit = on && Math.floor(clock.now * 6) & 1,
      z = Math.max(2, L.s * 1.2);
    view.ctx.fillStyle = '#1b2030';
    view.ctx.fillRect(L.x - z, L.y - z * 0.6, z * 2, z * 1.2);
    view.ctx.fillStyle = lit ? '#ff3b3b' : on ? '#b52020' : '#4a1818';
    view.ctx.fillRect(L.x - z * 0.8, L.y - z * 0.4, z * 1.6, z * 0.8);
    if (lit) {
      view.ctx.globalAlpha = 0.3;
      view.ctx.fillStyle = '#ff3b3b';
      view.ctx.beginPath();
      view.ctx.arc(L.x, L.y, z * 3, 0, Math.PI * 2);
      view.ctx.fill();
      view.ctx.globalAlpha = 1;
    }
  }
  view.ctx.restore();
}
