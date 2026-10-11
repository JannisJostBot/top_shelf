// Drawn ice wear: frost scuffed up by skates and the resurfacer's fresh water. The wear itself (how much frost
// lies where) is simulated in game/iceWear.js; this draws it onto two canvases that the renderer lays over the ice.
import { IH, IW, K, RR, RX0, RX1, RY0, RY1 } from '../config';
import { rnd, toS } from '../core/math';

export const frostC = document.createElement('canvas');
frostC.width = IW;
frostC.height = IH;
const fctx = frostC.getContext('2d');
export const wetC = document.createElement('canvas');
wetC.width = IW;
wetC.height = IH;
const wctx = wetC.getContext('2d');

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
export function clearIceDrawing() {
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, IW, IH);
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.clearRect(0, 0, IW, IH);
}
/** Skate scuffs at the given world points ([x, y, x, y, …]). */
export function drawScuffs(marks) {
  for (let i = 0; i < marks.length; i += 2) {
    fctx.globalAlpha = 0.12;
    fctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#a9b8c8';
    fctx.fillRect(toS(marks[i]) + rnd(-3, 3), toS(marks[i + 1]) + rnd(-1, 2), rnd(2, 5) | 0, 1);
  }
  fctx.globalAlpha = 1;
}
/** The ice after a period of hockey: a grey haze and skate gouges, short diagonal scratches light and dark. */
export function drawChewedIce() {
  fctx.save();
  rinkPathOn(fctx);
  fctx.clip();
  fctx.globalAlpha = 0.5;
  fctx.fillStyle = '#b9c6d4';
  fctx.fillRect(0, 0, IW, IH);
  for (let k = 0; k < 1800; k++) {
    const x = rnd(0, IW),
      y = rnd(0, IH),
      a = rnd(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI / 2),
      l = rnd(4, 14);
    fctx.globalAlpha = rnd(0.25, 0.6);
    fctx.strokeStyle = Math.random() < 0.55 ? '#ffffff' : '#8fa1b5';
    fctx.lineWidth = 1;
    fctx.beginPath();
    fctx.moveTo(x, y);
    fctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    fctx.stroke();
  }
  fctx.restore();
  fctx.globalAlpha = 1;
}
/** The resurfacer's conditioner at the given world points ([x, y, …]): frost wiped away, fresh water laid down. */
export function drawPolish(pts) {
  fctx.save();
  fctx.globalCompositeOperation = 'destination-out';
  wctx.globalAlpha = 0.3;
  wctx.fillStyle = '#8fd3ff';
  for (let i = 0; i < pts.length; i += 2) {
    const sx = toS(pts[i]),
      sy = toS(pts[i + 1]);
    fctx.beginPath();
    fctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
    fctx.fill();
    wctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  fctx.restore();
  wctx.globalAlpha = 1;
}
