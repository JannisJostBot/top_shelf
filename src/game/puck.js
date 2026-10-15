import { clock } from '../core/time';
import { HARD_SHOT } from '../config';
import { clamp, dist } from '../core/math';
import { random, rnd } from '../core/rng';
import { blade, burst } from './physics/motion';
import { SK, SKATERS } from './players';
import { G, parts, puck } from './world';
import { S } from './fx';
import { inputOf, isHuman, seat } from './online';
import { AMB } from '../data/colors';

/* ---------- puck actions ---------- */
export function take(p) {
  puck.owner = p;
  puck.z = 0;
  puck.passTo = null;
  puck.miss.clear();
  puck.gchk = null;
  puck.lastTeam = p.team;
  puck.hard = false;
  p.imm = 0.45;
  p.ai.lane = rnd(-22, 22);
  p.ai.dec = 0.2;
  if (isHuman(p) && inputOf(p.team).shootHeld) seat(p.team).ignoreRelease = true;
  S('tick');
}
function release(p, vx, vy) {
  const b = blade(p);
  puck.owner = null;
  puck.x = b.x;
  puck.y = b.y;
  puck.vx = vx;
  puck.vy = vy;
  puck.age = 0;
  puck.rx = b.x;
  puck.tip = random();
  p.cool = 0.3;
  puck.lastTeam = p.team;
  puck.hard = false;
  puck.miss.clear();
  puck.gchk = null;
  puck.passTo = null;
}
export function shoot(p, tx, ty, spd, err) {
  const b = blade(p);
  tx += rnd(-err, err);
  const dx = tx - b.x,
    dy = ty - b.y,
    d = Math.hypot(dx, dy) || 1;
  release(p, (dx / d) * spd, (dy / d) * spd);
  p.followUntil = clock.now + 0.3; // follow-through pose (visual only)
  puck.hard = spd >= HARD_SHOT;
  S('shot');
  if (d < 90 && !G.demo)
    setTimeout(() => {
      if (G.state === 'play') S('ooh');
    }, 180);
  for (let i = 0; i < 7; i++)
    parts.push({
      x: b.x,
      y: b.y,
      vx: rnd(-30, 30) - (dx / d) * 20,
      vy: rnd(-30, 30) - (dy / d) * 20,
      life: rnd(0.2, 0.4),
      c: '#ffffff',
    });
}
export function passTo(p, m) {
  const from = p.role === 'G' ? { x: p.x, y: p.y } : blade(p);
  const lx = m.x + m.vx * 0.3,
    ly = m.y + m.vy * 0.3,
    dx = lx - from.x,
    dy = ly - from.y,
    d = Math.hypot(dx, dy) || 1,
    s = clamp(d * 1.6 + 70, 110, 185);
  if (p.role === 'G') {
    puck.owner = null;
    puck.x = from.x;
    puck.y = from.y + (p.team ? 5 : -5);
    puck.vx = (dx / d) * s;
    puck.vy = (dy / d) * s;
    puck.age = 0;
    puck.rx = puck.x;
    puck.tip = random();
    puck.lastTeam = p.team;
    puck.miss.clear();
    puck.gchk = null;
    p.passCd = 0.6;
  } else release(p, (dx / d) * s, (dy / d) * s);
  puck.hard = false;
  puck.passTo = m;
  S('pass');
}
export function steal(p, c) {
  take(p);
  c.cool = 0.6;
  c.stun = 0.35;
  S('steal');
  burst(c.x, c.y - 4, 6, AMB, 40);
}
export function openness(m, t) {
  let o = 99;
  for (const q of SK[1 - t]) if (!q.benched) o = Math.min(o, dist(q, m));
  return o;
}
export function bestMate(p, t) {
  const dir = t ? 1 : -1;
  let best = null,
    bs = -1e9;
  for (const m of SK[t]) {
    if (m === p || m.down > 0 || m.benched || m.dummy) continue;
    const d = dist(m, p);
    if (d < 16 || d > 120) continue;
    const op = Math.min(openness(m, t), 30);
    if (op < 11) continue;
    const sc = op + dir * (m.y - p.y) * 0.35;
    if (sc > bs) {
      bs = sc;
      best = m;
    }
  }
  return best;
}
export function grab(g) {
  puck.owner = g;
  g.hold = 0.9;
  puck.vx = puck.vy = 0;
  puck.z = 0;
  puck.passTo = null;
  puck.miss.clear();
  puck.gchk = null;
  puck.hard = false;
  puck.lastTeam = g.team;
  puck.trail.length = 0;
}
// Above this speed a pickup can fail: the skater fumbles the puck and may not try again right away.
const FUMBLE_SPEED = 115;
export function pickupCheck() {
  const sp = Math.hypot(puck.vx, puck.vy);
  // A fumble only rules a skater out while the puck is still fast and close to them. Once it has slowed down
  // (slow pucks are always picked up) or they have moved away, they may go for it again; otherwise a puck that
  // came to rest beside the skaters who fumbled it could not be picked up by anyone.
  if (puck.miss.size)
    for (const p of puck.miss)
      if (sp <= FUMBLE_SPEED || Math.hypot(puck.x - p.x, puck.y - p.y) > 14) puck.miss.delete(p);
  let best = null,
    bd = 1e9;
  for (const p of SKATERS) {
    if (p.cool > 0 || p.down > 0 || p.benched || p.dummy || puck.miss.has(p)) continue;
    const b = blade(p);
    const d = Math.min(Math.hypot(puck.x - b.x, puck.y - b.y), Math.hypot(puck.x - p.x, puck.y - (p.y - 1)));
    const R = p === puck.passTo ? 7 : p.boost > 0 && isHuman(p) ? 7 : 5;
    if (d < R && d < bd) {
      bd = d;
      best = p;
    }
  }
  if (!best) return false;
  if (best !== puck.passTo && sp > FUMBLE_SPEED) {
    const ch = (best.team === puck.lastTeam ? 0.5 : 0.3) * best.st.hnd;
    if (random() > ch) {
      puck.miss.add(best);
      return false;
    }
  }
  take(best);
  return true;
}
