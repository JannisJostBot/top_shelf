import { random, rnd } from '../../core/rng';
import { PUCKS } from '../../data/pucks';
import { goalieCheck } from '../ai/goalie';
import { frostAt } from '../iceWear';
import { accelTo, blade } from './motion';
import { netPuck, netPushBody, rinkPush } from './rink';
import { SKATERS, players } from '../players';
import { pickupCheck } from '../puck';
import { G, parts, puck } from '../world';
import { settings } from '../../settings';
import { S } from '../fx';

/* ---------- world step ---------- */
export function integrate(dt) {
  for (const p of players) {
    if (p.benched) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.anim += Math.hypot(p.vx, p.vy) * dt * 0.16;
    if (p.role === 'S') {
      rinkPush(p, 3.5, 0.3);
      netPushBody(p, 3.5);
    }
  }
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i],
        b = players[j];
      if (a.benched || b.benched) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        min = a.role === 'G' || b.role === 'G' ? 7.5 : 6.5;
      if (d < min && d > 0.01) {
        const nx = dx / d,
          ny = dy / d,
          push = min - d;
        if (a.role === 'G') {
          b.x += nx * push;
          b.y += ny * push;
        } else if (b.role === 'G') {
          a.x -= nx * push;
          a.y -= ny * push;
        } else {
          a.x -= (nx * push) / 2;
          a.y -= (ny * push) / 2;
          b.x += (nx * push) / 2;
          b.y += (ny * push) / 2;
        }
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const im = rv * 0.5;
          if (a.role !== 'G') {
            a.vx += im * nx;
            a.vy += im * ny;
          }
          if (b.role !== 'G') {
            b.vx -= im * nx;
            b.vy -= im * ny;
          }
        }
      }
    }
  for (const p of SKATERS) {
    if (p.benched) continue;
    rinkPush(p, 3.5, 0);
    netPushBody(p, 3.5);
  }
}
export function updatePuck(dt) {
  const o = puck.owner,
    px = puck.x,
    py = puck.y;
  if (o) {
    if (o.role === 'G') {
      puck.x = o.x + (o.team ? -4 : 4);
      puck.y = o.y - 5;
      puck.vx = puck.vy = 0;
      return;
    }
    const b = blade(o);
    puck.x = b.x + o.fx;
    puck.y = b.y + o.fy;
    puck.vx = o.vx;
    puck.vy = o.vy;
    rinkPush(puck, 1.5, 0);
    netPuck(px, py);
    return;
  }
  const k = Math.exp(-(0.7 + 0.55 * frostAt(puck.x, puck.y)) * dt);
  puck.vx *= k;
  puck.vy *= k;
  const sp = Math.hypot(puck.vx, puck.vy);
  if (sp > 140) {
    puck.trail.push({ x: puck.x, y: puck.y });
    if (puck.trail.length > 5) puck.trail.shift();
  } else puck.trail.length = 0;
  {
    const ps = PUCKS[settings.puckKey];
    if (ps.tr && sp > 70 && random() < Math.min(0.8, sp / 260))
      parts.push({
        x: puck.x + rnd(-1, 1),
        y: puck.y + rnd(-1, 1),
        vx: -puck.vx * 0.12 + rnd(-10, 10),
        vy: -puck.vy * 0.12 + rnd(-10, 10),
        life: rnd(0.18, 0.4),
        c: ps.tr(),
      });
  }
  const n = Math.max(1, Math.ceil((sp * dt) / 1.5));
  for (let i = 0; i < n; i++) {
    const ox = puck.x,
      oy = puck.y;
    puck.x += (puck.vx * dt) / n;
    puck.y += (puck.vy * dt) / n;
    const hit = rinkPush(puck, 1.5, 0.65);
    if (hit > 60 && G.boardCd <= 0) {
      S('board', hit / 220);
      G.boardCd = 0.12;
    }
    if (netPuck(ox, oy)) return;
    if (goalieCheck()) return;
    if (pickupCheck()) return;
  }
}
export function coast(dt) {
  for (const p of players) {
    p.down -= dt;
    accelTo(p, 0, 0, dt, 110);
    if (p.role === 'G') {
      p.vx = 0;
      p.vy = 0;
    }
  }
  integrate(dt);
}
