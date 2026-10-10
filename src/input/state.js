import { K } from '../config';
import { G } from '../game/world';
import { cam, view } from '../render/canvas';

/* ---------- input ---------- */
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
// mouse: point to skate and aim; any movement key hands control back to the keyboard
export const mouse = { sx: 0, sy: 0, on: false };
export function mouseWorld() {
  return { x: cam.x + mouse.sx / (K * view.camZ), y: cam.y + mouse.sy / (K * view.camZ) };
}
// The mouse only aims. Keys still skate: with the mouse active, W/S go toward/away from the cursor and A/D strafe.
function aimDir() {
  if (!mouse.on || input.touch) return null;
  const me = G.state === 'zamboni' && G.zam ? G.zam : G.controlled;
  if (!me) return null;
  const w = mouseWorld(),
    dx = w.x - me.x,
    dy = w.y - me.y,
    d = Math.hypot(dx, dy);
  return d < 1.5 ? null : { x: dx / d, y: dy / d };
}
export function readStick() {
  input.aim = null;
  if (input.touch) {
    input.jx = input.tx;
    input.jy = input.ty;
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
    input.aim = a;
    const fwd = -y,
      str = x,
      mx = a.x * fwd - a.y * str,
      my = a.y * fwd + a.x * str,
      m = Math.hypot(mx, my) || 1;
    input.jx = (mx / m) * (fwd || str ? 1 : 0);
    input.jy = (my / m) * (fwd || str ? 1 : 0);
    return;
  }
  const m = Math.hypot(x, y) || 1;
  input.jx = x / m;
  input.jy = y / m;
}
