import { K } from '../config';
import { G } from '../game/world';

/* ---------- input ---------- */
/** The first connected controller's stick (written by input/gamepad.js every frame). */
export const pad = { active: false, x: 0, y: 0 };
export const input = {
  aim: null,
  jx: 0,
  jy: 0,
  tx: 0,
  ty: 0,
  touch: false,
  keys: new Set(),
  shootHeld: false,
  sp: false,
  sr: false,
  pp: false,
  swp: false,
};
// Mouse steering works like slither.io-style games: mouse movement pushes a knob around inside a ring
// (vx, vy within the unit circle) and the skater faces the way the knob points. Only the direction counts,
// not where the cursor is relative to the player. During play the pointer is locked to the game, so the
// mouse can never run off the screen.
export const mouse = { sx: 0, sy: 0, on: false, vx: 0, vy: -1 };
const SENS = 1 / 70; // screen pixels of mouse travel to cross the ring's radius
const DEAD = 0.15; // knob this close to the centre keeps the last direction
export function nudgeAim(dx, dy) {
  let x = mouse.vx + dx * SENS,
    y = mouse.vy + dy * SENS;
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  mouse.vx = x;
  mouse.vy = y;
}
let held = { x: 0, y: -1 };
function aimDir() {
  if (!mouse.on || input.touch) return null;
  const m = Math.hypot(mouse.vx, mouse.vy);
  if (m >= DEAD) held = { x: mouse.vx / m, y: mouse.vy / m };
  return held;
}
export function readStick() {
  input.aim = null;
  if (input.touch) {
    input.jx = input.tx;
    input.jy = input.ty;
    return;
  }
  // a controller stick gives analog speed and direction; it takes over from the mouse aim while in use
  if (pad.x || pad.y) {
    input.jx = pad.x;
    input.jy = pad.y;
    return;
  }
  const k = input.keys;
  let x = 0,
    y = 0;
  if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
  if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
  if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
  const a = aimDir();
  if (a) {
    input.aim = { x: a.x, y: a.y };
    const fwd = -y,
      str = x,
      mx = a.x * fwd - a.y * str,
      my = a.y * fwd + a.x * str,
      m = Math.hypot(mx, my);
    const k = m > 1 ? 1 / m : 1;
    input.jx = mx * k;
    input.jy = my * k;
    return;
  }
  const m = Math.hypot(x, y) || 1;
  input.jx = x / m;
  input.jy = y / m;
}
