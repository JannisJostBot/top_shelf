import { ACC, BASE, GT } from '../config';
import { clamp, dist, rnd } from '../core/math';
import { catchUp, nearest } from './ai/team';
import { startCheck } from './hits';
import { accelTo, burst, faceTo, maxSpd, reachFactor } from './physics/motion';
import { GK, SK } from './players';
import { openness, passTo, shoot, steal } from './puck';
import { G, puck } from './world';
import { input, mouse, readStick } from '../input/state';
import { settings } from '../settings';
import { hud, pop, S, vib } from './fx';
import { CY } from '../data/colors';

/* ---------- human ---------- */
// share of the stick input taken over by the receiving assist while a pass is on its way
const RECEIVE_ASSIST = 0.18;
export function autoSwitch(dt) {
  G.switchLock -= dt;
  const o = puck.owner;
  if (o && o.team === 0 && o.role === 'S') {
    G.controlled = o;
    return;
  }
  if (puck.passTo && puck.passTo.team === 0) {
    G.controlled = puck.passTo;
    return;
  }
  const cur = G.controlled;
  if ((G.switchLock > 0 || cur.checkT > 0) && cur.down <= 0) return;
  const tg = o ? o : { x: puck.x + puck.vx * 0.25, y: puck.y + puck.vy * 0.25 };
  let best = cur,
    bd = cur.down > 0 ? 1e9 : dist(cur, tg) - 8;
  for (const p of SK[0]) {
    if (p.down > 0 || p.benched) continue;
    const d = dist(p, tg);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  if (best !== cur) {
    cur.checkT = 0;
    G.controlled = best;
    G.switchLock = 0.4;
  }
}
export function humanUpdate(dt) {
  const p = G.controlled;
  if (!p) return;
  readStick();
  let jx = input.jx,
    jy = input.jy;
  // Receiving a pass: control has just jumped to this skater, and the stick is often still held the way the
  // passer was going, which would carry the receiver off the puck's line. While the pass is on its way, the
  // stick input is blended with a pull toward where the puck will cross the receiver's path, and the blade
  // turns to face it. Steering hard away from the pass can still lose it.
  const receiving = puck.passTo === p && !puck.owner && p.down <= 0;
  if (receiving) {
    const vv = puck.vx * puck.vx + puck.vy * puck.vy || 1,
      tc = Math.max(0, ((p.x - puck.x) * puck.vx + (p.y - puck.y) * puck.vy) / vv),
      ix = puck.x + puck.vx * tc - p.x,
      iy = puck.y + puck.vy * tc - p.y,
      il = Math.hypot(ix, iy),
      pull = Math.min(1, il / 6);
    jx = jx * (1 - RECEIVE_ASSIST) + (il ? (ix / il) * pull : 0) * RECEIVE_ASSIST;
    jy = jy * (1 - RECEIVE_ASSIST) + (il ? (iy / il) * pull : 0) * RECEIVE_ASSIST;
  }
  const m = Math.hypot(jx, jy),
    mx = maxSpd(p, 1);
  // trying to skate somewhere (even when pinned against someone or the boards) is not standing still
  p.pushing = m > 0.3;
  if (p.down > 0) {
    accelTo(p, 0, 0, dt, 70);
    input.sp = input.sr = input.pp = false;
    if (input.swp) {
      const n = nearest(
        SK[0].filter(q => q !== p),
        puck,
      );
      if (n) {
        G.controlled = n;
        G.switchLock = 0.6;
      }
    }
    input.swp = false;
    return;
  }
  if (p.checkT <= 0) {
    accelTo(p, jx * mx, jy * mx, dt, m > 0.1 ? (p.boost > 0 ? ACC * 2 : ACC) : 150);
    if (receiving) faceTo(p, puck.x, puck.y, 0.35);
    else if (input.aim) faceTo(p, p.x + input.aim.x, p.y + input.aim.y, 0.45);
    else if (m > 0.2) faceTo(p, p.x + jx, p.y + jy, 0.45);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 38 && m > 0.3 && (p.vx * jx + p.vy * jy) / sp < -0.4 && p.sprayCd <= 0) {
      p.sprayCd = 0.5;
      S('spray');
      burst(p.x, p.y, 7, '#ffffff', 35);
    }
  }
  if (G.ignoreRelease) {
    if (!input.shootHeld) G.ignoreRelease = false;
    input.sr = false;
  }
  if (puck.owner === p) {
    if (input.shootHeld && !G.ignoreRelease) {
      G.charging = true;
      G.charge = Math.min(G.charge + dt, 0.7);
    }
    if (input.sr && G.charging) humanShoot(p);
    else if (input.pp) humanPass(p);
  } else {
    G.charging = false;
    G.charge = 0;
    if (input.sp) poke(p);
    if (input.pp) bodyCheck(p);
    if (input.swp) {
      const others = SK[0].filter(q => q !== p && !q.benched);
      const n = nearest(others, puck.owner || puck);
      if (n) {
        p.checkT = 0;
        G.controlled = n;
        G.switchLock = 0.9;
      }
    }
  }
  input.sp = input.sr = input.pp = input.swp = false;
}
function humanShoot(p) {
  if (G.practice) {
    G.score[1]++;
    hud();
  }
  const c = G.charge / 0.7;
  G.charging = false;
  G.charge = 0;
  const spd = (150 + c * 135) * p.st.sht,
    gk = GK[1];
  if (p.y < 150 && p.fy < 0.35) {
    let off;
    // mouse aim: follow the aim direction to the goal line to pick the spot
    const am = mouse.on && !input.touch && input.aim && input.aim.y < -0.2 ? input.aim : null;
    if (am) off = clamp(p.x + (am.x / -am.y) * (p.y - GT) - 80, -10.5, 10.5);
    else {
      if (Math.abs(input.jx) > 0.3) off = Math.sign(input.jx) * 10.5;
      else off = p.x < 80 ? 10.5 : -10.5;
      if (Math.abs(input.jx) <= 0.3 && Math.abs(gk.x - 80) > 3) off = gk.x > 80 ? -10.5 : 10.5;
    }
    shoot(p, 80 + off, GT - 2, spd, (1.5 + c * 2.5) * p.st.acc);
  } else shoot(p, p.x + p.fx * 100, p.y + p.fy * 100, spd, 0);
}
function humanPass(p) {
  const mates = SK[0].filter(q => q !== p && q.down <= 0 && !q.benched);
  let best = null,
    bs = -1e9;
  const ax = input.aim ? input.aim.x : input.jx,
    ay = input.aim ? input.aim.y : input.jy,
    jm = Math.hypot(ax, ay);
  for (const m of mates) {
    const dx = m.x - p.x,
      dy = m.y - p.y,
      d = Math.hypot(dx, dy) || 1;
    const sc = jm > 0.3 ? (dx * ax + dy * ay) / d / jm : -dy * 0.4 + Math.min(openness(m, 0), 30);
    if (sc > bs) {
      bs = sc;
      best = m;
    }
  }
  if (best) passTo(p, best);
}
// POKE: reach in with aim assist. Only works from the front or side; from behind the puck is out of reach.
function poke(p) {
  if (p.pokeCd > 0) return;
  p.pokeCd = 0.45;
  const c = puck.owner;
  if (c && c.team !== p.team && c.role === 'S') {
    const d = dist(p, c);
    if (d < 20) {
      faceTo(p, c.x, c.y, 1);
      const l = d || 1;
      p.vx += ((c.x - p.x) / l) * 45;
      p.vy += ((c.y - p.y) / l) * 45;
      p.boost = 0.2;
      const reach = reachFactor(p, c);
      if (d < 14 && c.imm <= 0 && reach > 0 && Math.random() < ((0.62 * reach) / c.st.hnd) * p.st.hnd) {
        steal(p, c);
        pop(c.x, c.y, 'STOLEN!', CY);
        vib([18]);
        return;
      }
      p.stun = 0.3;
      S('whiff');
      pop(p.x, p.y, d < 14 && reach === 0 ? 'NO REACH' : 'WHIFF', '#9aa6c4');
      return;
    }
  }
  if (!puck.owner && dist(p, puck) < 22) {
    faceTo(p, puck.x, puck.y, 1);
    const l = dist(p, puck) || 1;
    p.vx += ((puck.x - p.x) / l) * 40;
    p.vy += ((puck.y - p.y) / l) * 40;
  } else {
    p.vx += p.fx * 35;
    p.vy += p.fy * 35;
  }
  p.boost = 0.25;
  S('whiff');
}
// CHECK: charge the carrier and flatten them. With no carrier it dashes toward the puck.
function bodyCheck(p) {
  if (p.checkCd > 0) return;
  const c = puck.owner;
  if (c && c.team !== p.team && c.role === 'S' && c.down <= 0 && dist(p, c) < 32) {
    startCheck(p, c);
    return;
  }
  p.checkCd = 1;
  const tx = puck.owner ? p.x + p.fx : puck.x,
    ty = puck.owner ? p.y + p.fy : puck.y,
    d = Math.hypot(tx - p.x, ty - p.y) || 1;
  p.vx = ((tx - p.x) / d) * BASE * 1.5;
  p.vy = ((ty - p.y) / d) * BASE * 1.5;
  p.boost = 0.35;
  faceTo(p, tx, ty, 1);
  S('dash');
}
// a computer skater's chance per poke, from its steal rate; and how much harder a poke is against a moving carrier
const POKE = 0.35,
  POKE_MOVING = 0.5;
export function steals(dt) {
  const c = puck.owner;
  if (!c || c.role !== 'S' || c.imm > 0) return;
  for (const p of SK[1 - c.team]) {
    p.pokeCd = (p.pokeCd || 0) - dt;
    if (p.stun > 0 || p.cool > 0 || p.down > 0 || p.benched || p.dummy || p.easeT > 0) continue;
    const inReach = dist(p, c) < 7.5;
    // just arrived within reach: the stick needs a moment to get set before the first poke
    if (inReach && !p.inReach) p.pokeCd = Math.max(p.pokeCd, rnd(0.25, 0.5));
    p.inReach = inReach;
    if (inReach) {
      const base =
        G.practice && G.practice.opp === 'easy' && p.team === 1
          ? 0.15
          : G.ai0
            ? 1.1
            : p.team === 1
              ? settings.diff.steal
              : p === G.controlled
                ? settings.diff.ourSteal
                : settings.diff.ourSteal * 0.7;
      const reach = reachFactor(p, c),
        rate = ((base * (reach > 0 ? reach : 0.1) * p.st.hnd) / c.st.hnd) * (1 + 0.15 * catchUp(p.team));
      if (p !== G.controlled || G.ai0) {
        // A computer skater pokes rather than pulling steadily: one try every so often, harder against a carrier
        // skating at speed, and a miss leaves its stick out of position for a moment. So keeping your feet moving
        // gets you away from a defender that keeps up with you.
        if (p.pokeCd > 0) continue;
        p.pokeCd = rnd(0.5, 0.9);
        const moving = Math.hypot(c.vx, c.vy) > 35 ? POKE_MOVING : 1;
        if (Math.random() < Math.min(0.85, rate * POKE * moving)) {
          steal(p, c);
          return;
        }
        p.cool = 0.3;
        continue;
      }
      if (Math.random() < rate * dt) {
        steal(p, c);
        return;
      }
    }
  }
}
