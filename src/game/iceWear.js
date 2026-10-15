import { H, W } from '../config';
import { clamp } from '../core/math';
import { random } from '../core/rng';
import { iceClear, iceScuff } from './fx';
import { SKATERS } from './players';

/* ---------- ice wear: frost that skates scuff up and the resurfacer clears (drawn by render/iceWear.js) ---------- */
export const FG = 2,
  FW = W / FG,
  FH = H / FG,
  frost = new Float32Array(FW * FH);
export function frostAt(x, y) {
  const i = clamp(Math.floor(x / FG), 0, FW - 1) + clamp(Math.floor(y / FG), 0, FH - 1) * FW;
  return frost[i];
}
export function clearIceWear() {
  frost.fill(0);
  iceClear();
}
// skates scuff the ice: frost builds up along the paths people skate
const marks = [];
export function scuff(dt) {
  marks.length = 0;
  for (const p of SKATERS) {
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 28 || random() > 0.35) continue;
    const i = clamp(Math.floor(p.x / FG), 0, FW - 1) + clamp(Math.floor(p.y / FG), 0, FH - 1) * FW;
    frost[i] = Math.min(1, frost[i] + 0.06);
    marks.push(p.x, p.y);
  }
  if (marks.length) iceScuff(marks);
}
