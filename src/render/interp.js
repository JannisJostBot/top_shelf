// Render interpolation. The simulation runs in fixed 1/60 s steps, but frames come at the display's own rate
// (and never exactly in step with it), so some frames get two steps and some none, and things moving across the
// screen hop unevenly. Each frame is instead drawn at the positions blended between the last two steps, by how
// far the clock has got into the next one. The blended values only exist while drawing: they are put on the
// objects just before rendering and the simulation's own values are put back right after, so the game itself
// runs exactly as before.
import { G, puck, ref } from '../game/world';
import { players } from '../game/players';
import { cam } from './canvas';

// further than this (world units) in one step is a jump (a face-off reset, a camera cut): drawn as is
const JUMP2 = 20 * 20;

function list() {
  const l = [cam, puck, ref, ...players];
  if (G.zam) l.push(G.zam);
  // the 3D camera is moved by the simulation only in goal replays (elsewhere it is aimed while drawing)
  if (G.cam3 && G.state === 'replay') l.push(G.cam3);
  return l;
}
/** Remembers where everything is before a simulation step. */
export function beforeStep() {
  for (const e of list()) {
    e._ix = e.x;
    e._iy = e.y;
    if (e === puck) e._iz = e.z;
    if (e === G.zam) e._ia = e.a;
    if (e === G.cam3) e._iyaw = e.yaw;
  }
}
let blended = [];
/** Puts the blended positions on for drawing; alpha is how far (0..1) the clock is into the next step. */
export function blendIn(alpha) {
  blended = [];
  for (const e of list()) {
    if (e._ix === undefined) continue;
    const dx = e.x - e._ix,
      dy = e.y - e._iy;
    if (dx * dx + dy * dy > JUMP2) continue;
    const b = { e, x: e.x, y: e.y, z: e.z, a: e.a, yaw: e.yaw };
    blended.push(b);
    e.x = e._ix + dx * alpha;
    e.y = e._iy + dy * alpha;
    if (e === puck && e._iz !== undefined) e.z = e._iz + (e.z - e._iz) * alpha;
    if (e === G.zam && e._ia !== undefined) e.a = e._ia + (e.a - e._ia) * alpha;
    if (e === G.cam3 && e._iyaw !== undefined) {
      const d = ((e.yaw - e._iyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      e.yaw = e.yaw - d * (1 - alpha);
    }
  }
}
/** Puts the simulation's own values back after drawing. */
export function blendOut() {
  for (const b of blended) {
    b.e.x = b.x;
    b.e.y = b.y;
    if (b.e === puck) b.e.z = b.z;
    if (b.e === G.zam) b.e.a = b.a;
    if (b.e === G.cam3) b.e.yaw = b.yaw;
  }
  blended = [];
}
