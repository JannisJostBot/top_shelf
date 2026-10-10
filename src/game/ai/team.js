import { GB, GT } from '../../config';
import { clamp, dist, lerp, rnd } from '../../core/math';
import { startCheck } from '../hits';
import { accelTo, faceTo, steer } from '../physics/motion';
import { GK, SK, live } from '../players';
import { bestMate, passTo, shoot } from '../puck';
import { G, puck } from '../world';
import { settings } from '../../settings';

/* ---------- AI ---------- */
function teamMul(t) {
  if (G.practice && t === 1 && G.practice.opp === 'easy') return 0.55;
  return t === 1 ? settings.diff.spd : G.demo ? 0.94 : 0.95;
}
export function nearest(list, tg) {
  let b = null,
    bd = 1e9;
  for (const p of list) {
    const d = dist(p, tg) + (p.down > 0 ? 200 : 0);
    if (d < bd) {
      bd = d;
      b = p;
    }
  }
  return b;
}
function assign(list, spots, mul, dt) {
  const left = list.slice();
  for (const s of spots) {
    if (!left.length) break;
    const p = nearest(left, s);
    left.splice(left.indexOf(p), 1);
    steer(p, clamp(s.x, 12, 148), clamp(s.y, 14, 242), dt, mul, true);
    if (dist(p, puck) < 45) faceTo(p, puck.x, puck.y, 0.25);
    else if (Math.hypot(p.vx, p.vy) > 8) faceTo(p, p.x + p.vx, p.y + p.vy, 0.2);
  }
  for (const p of left) accelTo(p, 0, 0, dt, 150);
}
function carrierAI(o, t, dt) {
  const dir = t ? 1 : -1,
    aG = t ? GB : GT,
    mul = teamMul(t);
  let near = null,
    nd = 1e9;
  for (const q of SK[1 - t]) {
    if (q.down > 0 || q.benched) continue;
    const d = dist(q, o);
    if (d < nd) {
      nd = d;
      near = q;
    }
  }
  let tx = 80 + o.ai.lane,
    ty = aG - dir * 18;
  if (near && nd < 24 && dir * (near.y - o.y) > -4) tx = o.x + (o.x >= near.x ? 1 : -1) * 30;
  tx = clamp(tx, 16, 144);
  steer(o, tx, ty, dt, mul * 0.97, false);
  faceTo(o, tx, ty, 0.2);
  o.ai.dec -= dt;
  if (o.ai.dec > 0) return;
  o.ai.dec = 0.25;
  const dg = Math.hypot(80 - o.x, aG - o.y),
    ahead = dir * (aG - o.y) > 8 && Math.abs(o.x - 80) < dir * (aG - o.y) * 1.6 + 14;
  if (ahead) {
    const ps = dg < 38 ? 0.75 : dg < 62 ? 0.32 : dg < 85 && nd < 10 ? 0.25 : 0;
    if (Math.random() < ps) {
      const gk = GK[1 - t];
      let off = gk.x > 80 ? -10.5 : 10.5;
      if (Math.abs(gk.x - 80) < 1.5) off = o.x < 80 ? 10.5 : -10.5;
      shoot(
        o,
        80 + off,
        aG + dir * 2,
        rnd(190, 260) * o.st.sht,
        (t === 1 && !G.ai0 ? settings.diff.err : 5) * o.st.acc,
      );
      return;
    }
  }
  const m = bestMate(o, t);
  if (m) {
    if (nd < 11 && Math.random() < 0.45) {
      passTo(o, m);
      return;
    }
    if (dir * (m.y - o.y) > 25 && Math.random() < 0.12) {
      passTo(o, m);
      return;
    }
  }
}
export function teamAI(t, dt) {
  const sk = SK[t].filter(live),
    dir = t ? 1 : -1,
    aG = t ? GB : GT,
    oG = t ? GT : GB,
    mul = teamMul(t);
  const hum = t === 0 && !G.ai0 ? G.controlled : null,
    o = puck.owner;
  // training dummies stand where they were put and just watch the puck
  for (const p of sk)
    if (p.dummy) {
      accelTo(p, 0, 0, dt, 200);
      if (p.down <= 0) faceTo(p, puck.x, puck.y, 0.1);
    }
  const avail = sk.filter(p => p !== hum && p !== o && p.checkT <= 0 && !p.dummy);
  if (!sk.length) return;
  const netSpot = { x: 80 + (puck.x - 80) * 0.3, y: oG + dir * 24 };
  const danger = () => {
    const opps = SK[1 - t].filter(q => q !== o && live(q));
    if (!opps.length) return { x: 80, y: oG + dir * 34 };
    let b = opps[0];
    for (const q of opps) if (Math.abs(q.y - oG) < Math.abs(b.y - oG)) b = q;
    return { x: lerp(b.x, 80, 0.3), y: lerp(b.y, oG, 0.25) };
  };
  if (o && o.team === t) {
    if (o.role === 'S' && o !== hum) carrierAI(o, t, dt);
    let spots;
    if (o.role === 'G')
      spots = [
        { x: 40, y: oG + dir * 50 },
        { x: 120, y: oG + dir * 50 },
        { x: 80, y: 128 },
      ];
    else
      spots = [
        { x: o.x < 80 ? 118 : 42, y: lerp(o.y, aG - dir * 42, 0.65) },
        { x: 80 + (o.x < 80 ? 14 : -14), y: o.y - dir * 34 },
        { x: 80, y: 128 },
      ];
    assign(avail, spots, mul, dt);
  } else if (o) {
    let rest = avail,
      spots;
    if (o.role === 'G') {
      spots = [
        { x: 50, y: 128 + dir * 30 },
        { x: 110, y: 128 + dir * 30 },
        { x: 80, y: 128 - dir * 20 },
      ];
    } else {
      const humChase = hum && sk.every(p => dist(hum, o) <= dist(p, o));
      if (!humChase && avail.length) {
        const ch = nearest(avail, o);
        rest = avail.filter(p => p !== ch);
        const gx = 80 - o.x,
          gy = oG - o.y,
          gl = Math.hypot(gx, gy) || 1;
        steer(ch, o.x + (gx / gl) * 4 + o.vx * 0.15, o.y + (gy / gl) * 4 + o.vy * 0.15, dt, mul, false);
        faceTo(ch, o.x, o.y, 0.3);
        // AI defenders throw the occasional body check
        const rate =
          G.practice && G.practice.opp === 'easy' ? 0 : t === 1 && !G.ai0 ? settings.diff.chk : 0.3;
        if (
          ch.down <= 0 &&
          ch.checkCd <= 0 &&
          o.down <= 0 &&
          o.imm <= 0 &&
          dist(ch, o) < 22 &&
          Math.random() < rate * dt
        )
          startCheck(ch, o);
      }
      spots = [danger(), netSpot, { x: 80, y: 128 }];
    }
    assign(rest, spots, mul, dt);
  } else {
    const pp = { x: puck.x + puck.vx * 0.3, y: puck.y + puck.vy * 0.3 };
    const humChase = hum && hum.down <= 0 && sk.every(p => dist(hum, pp) <= dist(p, pp));
    let rest = avail;
    if (!humChase && avail.length) {
      const ch = nearest(avail, pp);
      rest = avail.filter(p => p !== ch);
      steer(ch, pp.x, pp.y, dt, mul, false);
      faceTo(ch, puck.x, puck.y, 0.3);
    }
    const side = { x: puck.x < 80 ? 118 : 42, y: puck.y };
    const spots =
      dir * (puck.y - 128) > 0 ? [side, { x: 80, y: puck.y - dir * 40 }, netSpot] : [danger(), netSpot, side];
    assign(rest, spots, mul, dt);
  }
}
