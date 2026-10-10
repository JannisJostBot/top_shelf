import { K } from '../config';
import { rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { players } from '../game/players';
import { puck, ref } from '../game/world';
import { cam, view } from './canvas';
import { R } from './pixels';
import { drawGoalie, drawRef, drawSkater } from './players';
import { puckPixels } from './puck';

/* ---------- replay cinematics: reflections, ice sheen, sparkles, spotlights, vignette ---------- */
export const SPARK = [...Array(160)].map((_, i) => ({
  x: rnd(10, 150),
  y: rnd(10, 246),
  ph: rnd(0, 6.28),
  sp: rnd(3, 6),
}));
export function viewRect() {
  return { x: cam.x, y: cam.y, w: view.CW / (K * view.camZ), h: view.CH / (K * view.camZ) };
}
export function reflections() {
  view.ctx.save();
  view.ctx.globalAlpha = 0.2;
  for (const p of players) {
    if (p.benched) continue;
    const fy = toS(p.y) + 1;
    view.ctx.save();
    view.ctx.translate(0, 2 * fy);
    view.ctx.scale(1, -1);
    if (p.role === 'G') drawGoalie(p);
    else drawSkater(p);
    view.ctx.restore();
  }
  {
    const fy = toS(ref.y) + 1;
    view.ctx.save();
    view.ctx.translate(0, 2 * fy);
    view.ctx.scale(1, -1);
    drawRef();
    view.ctx.restore();
  }
  if (!(puck.owner && puck.owner.role === 'G')) {
    const fy = toS(puck.y) + 2;
    view.ctx.save();
    view.ctx.translate(0, 2 * fy);
    view.ctx.scale(1, -1);
    puckPixels(toS(puck.x), toS(puck.y) - Math.round(puck.z * K));
    view.ctx.restore();
  }
  view.ctx.restore();
  view.ctx.globalAlpha = 1;
}
export function iceSheen() {
  const v = viewRect(),
    x0 = Math.floor(v.x * K),
    y0 = Math.floor(v.y * K),
    w = Math.ceil(v.w * K),
    h = Math.ceil(v.h * K);
  view.ctx.globalAlpha = 0.07;
  view.ctx.fillStyle = '#ffffff';
  for (let y = y0; y < y0 + h; y += 2) {
    const o = (((y * 0.6 + clock.now * 45) % 110) + 110) % 110;
    for (let x = x0 - 110 + o; x < x0 + w; x += 110) view.ctx.fillRect(Math.round(x), y, 16, 2);
  }
  view.ctx.globalAlpha = 1;
}
export function sparkles() {
  const v = viewRect();
  for (const s of SPARK) {
    if (s.x < v.x || s.x > v.x + v.w || s.y < v.y || s.y > v.y + v.h) continue;
    const tw = Math.sin(clock.now * s.sp + s.ph),
      x = toS(s.x),
      y = toS(s.y);
    if (tw > 0.82) {
      R(x, y - 2, 1, 5, '#ffffff');
      R(x - 2, y, 5, 1, '#ffffff');
    } else if (tw > 0.45) {
      view.ctx.globalAlpha = 0.7;
      R(x, y, 1, 1, '#ffffff');
      view.ctx.globalAlpha = 1;
    }
  }
}
export function cinema() {
  // two arena spotlights drifting over the ice
  view.ctx.save();
  view.ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) {
    const cx = view.CW * (0.5 + 0.34 * Math.sin(clock.now * 0.6 + i * 2.4)),
      cy = view.CH * (0.42 + 0.22 * Math.cos(clock.now * 0.45 + i * 1.7)),
      r = view.CW * 0.5;
    const gr = view.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (gr) {
      gr.addColorStop(0, 'rgba(255,244,214,.16)');
      gr.addColorStop(1, 'rgba(255,244,214,0)');
      view.ctx.fillStyle = gr;
      view.ctx.fillRect(0, 0, view.CW, view.CH);
    }
  }
  view.ctx.restore();
  const vg = view.ctx.createRadialGradient(
    view.CW / 2,
    view.CH / 2,
    Math.min(view.CW, view.CH) * 0.35,
    view.CW / 2,
    view.CH / 2,
    Math.max(view.CW, view.CH) * 0.72,
  );
  if (vg) {
    vg.addColorStop(0, 'rgba(5,8,20,0)');
    vg.addColorStop(1, 'rgba(5,8,20,.55)');
    view.ctx.fillStyle = vg;
    view.ctx.fillRect(0, 0, view.CW, view.CH);
  }
  view.ctx.globalAlpha = 0.06;
  view.ctx.fillStyle = '#000000';
  for (let y = 0; y < view.CH; y += 3) view.ctx.fillRect(0, y, view.CW, 1);
  view.ctx.globalAlpha = 1;
}
