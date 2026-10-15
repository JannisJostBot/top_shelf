import { ACC, BASE } from '../../config';
import { dist, lerp } from '../../core/math';
import { rnd } from '../../core/rng';
import { G, parts, puck } from '../world';

export function accelTo(p, dx, dy, dt, acc) {
  let ax = dx - p.vx,
    ay = dy - p.vy;
  const a = Math.hypot(ax, ay),
    lim = (acc || ACC) * dt;
  if (a > lim) {
    ax *= lim / a;
    ay *= lim / a;
  }
  p.vx += ax;
  p.vy += ay;
}
export function maxSpd(p, mul) {
  return (
    BASE *
    mul *
    p.st.spd *
    (G.mom && G.mom.t > 0 && G.mom.team === p.team ? 1.06 : 1) *
    (puck.owner === p ? 0.9 : 1) *
    (p.stun > 0 ? 0.45 : 1) *
    (p.boost > 0 ? 1.45 : 1)
  );
}
export function steer(p, tx, ty, dt, mul, arrive) {
  if (p.down > 0) {
    accelTo(p, 0, 0, dt, 70);
    return;
  }
  const dx = tx - p.x,
    dy = ty - p.y,
    d = Math.hypot(dx, dy),
    mx = maxSpd(p, mul);
  if (d < 1.2) {
    accelTo(p, 0, 0, dt, 160);
    return;
  }
  const s = arrive && d < 14 ? (mx * d) / 14 : mx;
  accelTo(p, (dx / d) * s, (dy / d) * s, dt);
}
export function faceTo(p, x, y, k) {
  if (p.down > 0) return;
  const dx = x - p.x,
    dy = y - p.y,
    d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  const nx = dx / d,
    ny = dy / d;
  p.fx = lerp(p.fx, nx, k);
  p.fy = lerp(p.fy, ny, k);
  const l = Math.hypot(p.fx, p.fy);
  if (l < 0.01) {
    p.fx = nx;
    p.fy = ny;
    return;
  }
  p.fx /= l;
  p.fy /= l;
}
export function blade(p) {
  const side = p.fx < -0.25 ? -1 : 1;
  return { x: p.x + p.fx * 4 + side * 3 * (1 - Math.abs(p.fx)), y: p.y + p.fy * 3 + 0.5 };
}
export function burst(x, y, n, c, s) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-s, s), vy: rnd(-s, s), life: rnd(0.2, 0.45), c });
}
// 1 = attacker is in front of the carrier, 0 = directly behind (stick and puck are out of reach)
export function reachFactor(p, c) {
  const d = dist(p, c) || 1,
    f = (c.fx * (p.x - c.x) + c.fy * (p.y - c.y)) / d;
  return f > 0.25 ? 1 : f > -0.35 ? 0.65 : 0;
}
