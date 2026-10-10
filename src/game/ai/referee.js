import { clamp, lerp } from '../../core/math';
import { accelTo } from '../physics/motion';
import { netPushBody, rinkPush } from '../physics/rink';
import { players } from '../players';
import { G, puck, ref } from '../world';

export function refAI(dt) {
  let tx, ty;
  if (G.state === 'play') {
    const side = puck.x < 80 ? 1 : -1;
    tx = clamp(puck.x + side * 40, 14, 146);
    ty = clamp(puck.y + (puck.y < 128 ? 20 : -20), 20, 236);
  } else {
    tx = puck.x < 80 ? 118 : 42;
    ty = 128;
  }
  let dx = tx - ref.x,
    dy = ty - ref.y,
    d = Math.hypot(dx, dy),
    mx = G.state === 'play' ? 50 : 30;
  let wx = d > 3 ? (dx / d) * Math.min(mx, d * 2.5) : 0,
    wy = d > 3 ? (dy / d) * Math.min(mx, d * 2.5) : 0;
  // keep clear of skaters and the puck
  for (const p of players) {
    const ex = ref.x - p.x,
      ey = ref.y - p.y,
      e = Math.hypot(ex, ey);
    if (e < 12 && e > 0.01) {
      wx += (ex / e) * (12 - e) * 9;
      wy += (ey / e) * (12 - e) * 9;
    }
  }
  {
    const ex = ref.x - puck.x,
      ey = ref.y - puck.y,
      e = Math.hypot(ex, ey);
    if (e < 14 && e > 0.01) {
      wx += (ex / e) * (14 - e) * 10;
      wy += (ey / e) * (14 - e) * 10;
    }
  }
  accelTo(ref, wx, wy, dt, 160);
  ref.x += ref.vx * dt;
  ref.y += ref.vy * dt;
  rinkPush(ref, 3.5, 0.2);
  netPushBody(ref, 3.5);
  const sp = Math.hypot(ref.vx, ref.vy);
  ref.anim += sp * dt * 0.16;
  if (sp > 6) {
    const nx = ref.vx / sp,
      ny = ref.vy / sp;
    ref.fx = lerp(ref.fx, nx, 0.15);
    ref.fy = lerp(ref.fy, ny, 0.15);
    const l = Math.hypot(ref.fx, ref.fy) || 1;
    ref.fx /= l;
    ref.fy /= l;
  }
}
