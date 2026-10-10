import { H, IH, IW, K, RR, RX0, RX1, RY0, RY1, W } from '../config';
import { clamp, rnd, toS } from '../core/math';
import { SKATERS } from './players';

/* ---------- ice wear and the resurfacer minigame ---------- */
export const FG = 2,
  FW = W / FG,
  FH = H / FG,
  frost = new Float32Array(FW * FH);
export const frostC = document.createElement('canvas');
frostC.width = IW;
frostC.height = IH;
export const fctx = frostC.getContext('2d');
export const wetC = document.createElement('canvas');
wetC.width = IW;
wetC.height = IH;
export const wctx = wetC.getContext('2d');
export function frostAt(x, y) {
  const i = clamp(Math.floor(x / FG), 0, FW - 1) + clamp(Math.floor(y / FG), 0, FH - 1) * FW;
  return frost[i];
}
export function rinkPathOn(c) {
  c.beginPath();
  const k = K,
    x0 = RX0 * k,
    y0 = RY0 * k,
    x1 = RX1 * k,
    y1 = RY1 * k,
    r = RR * k;
  c.moveTo(x0 + r, y0);
  c.lineTo(x1 - r, y0);
  c.arc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  c.lineTo(x1, y1 - r);
  c.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  c.lineTo(x0 + r, y1);
  c.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  c.lineTo(x0, y0 + r);
  c.arc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  c.closePath();
}
export function clearIceWear() {
  frost.fill(0);
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, IW, IH);
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.clearRect(0, 0, IW, IH);
}
// skates scuff the ice: frost builds up along the paths people skate
export function scuff(dt) {
  for (const p of SKATERS) {
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 28 || Math.random() > 0.35) continue;
    const i = clamp(Math.floor(p.x / FG), 0, FW - 1) + clamp(Math.floor(p.y / FG), 0, FH - 1) * FW;
    frost[i] = Math.min(1, frost[i] + 0.06);
    fctx.globalAlpha = 0.12;
    fctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#a9b8c8';
    fctx.fillRect(toS(p.x) + rnd(-3, 3), toS(p.y) + rnd(-1, 2), rnd(2, 5) | 0, 1);
  }
  fctx.globalAlpha = 1;
}
