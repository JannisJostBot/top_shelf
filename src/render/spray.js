// Ice spray: a skater digging in for a hard stop throws up a fan of snow, forward and to the sides, that slows
// and fades within about half a second. Drawn in every graphics mode; overdrive also lets the flecks settle on
// the ice and pile against the boards (see onSettle, used by render/overdrive.js).
import { RX0, RX1, RY0, RY1 } from '../config';
import { clamp, rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { G } from '../game/world';
import { R } from './pixels';

const flecks = [],
  MAX = 300,
  seen = new WeakMap();
let lastT = 0,
  settle = null;
/** `fn(x, y)` is called where each fleck comes to rest (world units). */
export function onSettle(fn) {
  settle = fn;
}
/** Call right after drawing skater `p`: drawSkater notices a hard stop (p._stopUntil), this throws the spray. */
export function noticeStop(p) {
  const until = p._stopUntil;
  if (!until || until === seen.get(p)) return;
  seen.set(p, until);
  if (until > clock.now && G.state !== 'replay' && !G.demo) spray(p);
}
function spray(p) {
  const sp = Math.hypot(p.vx, p.vy) || 1,
    ux = p.vx / sp,
    uy = p.vy / sp;
  for (let i = 0; i < 18 && flecks.length < MAX; i++) {
    const side = rnd(-1, 1),
      v = rnd(18, 45);
    flecks.push({
      x: p.x + ux * 2,
      y: p.y + 0.5,
      vx: ux * v - uy * side * 30,
      vy: uy * v + ux * side * 30,
      t0: clock.now,
      life: rnd(0.3, 0.6),
      c: Math.random() < 0.7 ? '#ffffff' : '#dbe6f2',
      s: i < 5 ? 2 : 1, // a few clumps among the flecks
    });
  }
}
/** Moves and draws the spray (world transform applied). */
export function drawSpray(g) {
  const dt = clamp(clock.now - lastT, 0, 0.05);
  lastT = clock.now;
  if (G.state === 'replay') flecks.length = 0; // the replay shows play from before
  for (let i = flecks.length - 1; i >= 0; i--) {
    const f = flecks[i],
      k = (clock.now - f.t0) / f.life;
    if (k >= 1) {
      if (settle) settle(f.x, f.y);
      flecks.splice(i, 1);
      continue;
    }
    const drag = Math.exp(-4 * dt);
    f.vx *= drag;
    f.vy *= drag;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // the boards stop it
    if (f.x < RX0 + 1 || f.x > RX1 - 1 || f.y < RY0 + 1 || f.y > RY1 - 1) {
      f.x = clamp(f.x, RX0 + 1, RX1 - 1);
      f.y = clamp(f.y, RY0 + 1, RY1 - 1);
      f.vx = f.vy = 0;
    }
    const x = toS(f.x),
      y = toS(f.y);
    g.globalAlpha = 1 - k * k;
    // a blue-grey shade under each fleck, so the snow reads against the white ice
    R(g, x, y + f.s, f.s, 1, '#8ea3bb');
    R(g, x, y, f.s, f.s, f.c);
    if (k < 0.5) {
      const tx = x - Math.round(f.vx * 0.03),
        ty = y - Math.round(f.vy * 0.03);
      R(g, tx, ty + 1, 1, 1, '#a9bbcf');
      R(g, tx, ty, 1, 1, f.c);
    }
  }
  g.globalAlpha = 1;
}
