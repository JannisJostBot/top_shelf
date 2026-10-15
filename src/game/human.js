import { ACC, BASE, GT, H, W } from '../config';
import { clamp, dist } from '../core/math';
import { random, rnd } from '../core/rng';
import { catchUp, nearest } from './ai/team';
import { startCheck } from './hits';
import { accelTo, burst, faceTo, maxSpd, reachFactor } from './physics/motion';
import { GK, SK } from './players';
import { openness, passTo, shoot, steal } from './puck';
import { G, puck } from './world';
import { mouse, readStick } from '../input/state';
import { settings } from '../settings';
import { hud, pop, S } from './fx';
import { CY } from '../data/colors';
import { DIFF } from '../data/difficulty';
import { cpuSide, inputOf, isHuman, seat } from './online';
import { feel } from './hits';

/* ---------- human ---------- */
// share of the stick input taken over by the receiving assist while a pass is on its way
const RECEIVE_ASSIST = 0.18;
// Team 0's seat is G itself (G.controlled, G.charge, …); online, team 1's is seat1 (game/online.js).
export function autoSwitch(dt, t = 0) {
  const s = seat(t);
  s.switchLock -= dt;
  const o = puck.owner;
  if (o && o.team === t && o.role === 'S') {
    s.controlled = o;
    return;
  }
  if (puck.passTo && puck.passTo.team === t) {
    s.controlled = puck.passTo;
    return;
  }
  const cur = s.controlled;
  if ((s.switchLock > 0 || cur.checkT > 0) && cur.down <= 0) return;
  const tg = o ? o : { x: puck.x + puck.vx * 0.25, y: puck.y + puck.vy * 0.25 };
  let best = cur,
    bd = cur.down > 0 ? 1e9 : dist(cur, tg) - 8;
  for (const p of SK[t]) {
    if (p.down > 0 || p.benched) continue;
    const d = dist(p, tg);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  if (best !== cur) {
    cur.checkT = 0;
    s.controlled = best;
    s.switchLock = 0.4;
  }
}
export function humanUpdate(dt, t = 0) {
  const s = seat(t),
    input = inputOf(t),
    p = s.controlled;
  if (!p) return;
  // (the other player's stick arrives over the network, already read)
  if (t === 0) readStick();
  const { jx, jy, receiving } = stickOf(p, input),
    m = Math.hypot(jx, jy);
  // trying to skate somewhere (even when pinned against someone or the boards) is not standing still
  p.pushing = m > 0.3;
  if (p.down > 0) {
    accelTo(p, 0, 0, dt, 70);
    input.sp = input.sr = input.pp = false;
    if (input.swp) {
      const n = nearest(
        SK[t].filter(q => q !== p),
        puck,
      );
      if (n) {
        s.controlled = n;
        s.switchLock = 0.6;
      }
    }
    input.swp = false;
    return;
  }
  if (p.checkT <= 0) {
    skate(p, jx, jy, input.aim, receiving, dt);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 38 && m > 0.3 && (p.vx * jx + p.vy * jy) / sp < -0.4 && p.sprayCd <= 0) {
      p.sprayCd = 0.5;
      S('spray');
      burst(p.x, p.y, 7, '#ffffff', 35);
    }
  }
  if (s.ignoreRelease) {
    if (!input.shootHeld) s.ignoreRelease = false;
    input.sr = false;
  }
  if (puck.owner === p) {
    if (input.shootHeld && !s.ignoreRelease) {
      s.charging = true;
      s.charge = Math.min(s.charge + dt, 0.7);
    }
    if (input.sr && s.charging) humanShoot(s, input, p);
    else if (input.pp) humanPass(input, p);
  } else {
    s.charging = false;
    s.charge = 0;
    if (input.sp) poke(p);
    if (input.pp) bodyCheck(p);
    if (input.swp) {
      const others = SK[t].filter(q => q !== p && !q.benched);
      const n = nearest(others, puck.owner || puck);
      if (n) {
        p.checkT = 0;
        s.controlled = n;
        s.switchLock = 0.9;
      }
    }
  }
  input.sp = input.sr = input.pp = input.swp = false;
}
/**
 * The stick as it steers skater p. Receiving a pass: control has just jumped to this skater, and the stick is
 * often still held the way the passer was going, which would carry the receiver off the puck's line. While the
 * pass is on its way, the stick input is blended with a pull toward where the puck will cross the receiver's
 * path (and the blade turns to face it, see skate()). Steering hard away from the pass can still lose it.
 */
export function stickOf(p, input) {
  let jx = input.jx,
    jy = input.jy;
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
  return { jx, jy, receiving };
}
/** A human skater's skating for one step: speed toward the stick, blade toward the aim, the stick or the pass.
 * (The online guest predicts its own skater with this too, see net/predict.js.) */
export function skate(p, jx, jy, aim, receiving, dt) {
  const m = Math.hypot(jx, jy),
    mx = maxSpd(p, 1);
  accelTo(p, jx * mx, jy * mx, dt, m > 0.1 ? (p.boost > 0 ? ACC * 2 : ACC) : 150);
  if (receiving) faceTo(p, puck.x, puck.y, 0.35);
  else if (aim) faceTo(p, p.x + aim.x, p.y + aim.y, 0.45);
  else if (m > 0.2) faceTo(p, p.x + jx, p.y + jy, 0.45);
}
// Shots and passes are worked out as if attacking upwards; team 1 attacks downwards, so for it everything is
// turned half a turn (the rink is the same both ways) on the way in and back on the way out.
function humanShoot(s, input, p) {
  if (G.practice) {
    G.score[1]++;
    hud();
  }
  const c = s.charge / 0.7;
  s.charging = false;
  s.charge = 0;
  const spd = (150 + c * 135) * p.st.sht,
    gk = GK[1 - p.team],
    m = p.team ? -1 : 1,
    px = p.team ? W - p.x : p.x,
    py = p.team ? H - p.y : p.y,
    gx = p.team ? W - gk.x : gk.x,
    jx = input.jx * m;
  if (py < 150 && p.fy * m < 0.35) {
    let off;
    // mouse aim: follow the aim direction to the goal line to pick the spot
    const mouseAim = p.team ? input.mouseAim : mouse.on && !input.touch,
      aim = input.aim && { x: input.aim.x * m, y: input.aim.y * m },
      am = mouseAim && aim && aim.y < -0.2 ? aim : null;
    if (am) off = clamp(px + (am.x / -am.y) * (py - GT) - 80, -10.5, 10.5);
    else {
      if (Math.abs(jx) > 0.3) off = Math.sign(jx) * 10.5;
      else off = px < 80 ? 10.5 : -10.5;
      if (Math.abs(jx) <= 0.3 && Math.abs(gx - 80) > 3) off = gx > 80 ? -10.5 : 10.5;
    }
    const tx = 80 + off,
      ty = GT - 2;
    shoot(p, p.team ? W - tx : tx, p.team ? H - ty : ty, spd, (1.5 + c * 2.5) * p.st.acc);
  } else shoot(p, p.x + p.fx * 100, p.y + p.fy * 100, spd, 0);
}
function humanPass(input, p) {
  const t = p.team,
    up = t ? -1 : 1, // up the ice is -y for team 0, +y for team 1
    mates = SK[t].filter(q => q !== p && q.down <= 0 && !q.benched);
  let best = null,
    bs = -1e9;
  const ax = input.aim ? input.aim.x : input.jx,
    ay = input.aim ? input.aim.y : input.jy,
    jm = Math.hypot(ax, ay);
  for (const m of mates) {
    const dx = m.x - p.x,
      dy = m.y - p.y,
      d = Math.hypot(dx, dy) || 1;
    const sc = jm > 0.3 ? (dx * ax + dy * ay) / d / jm : -dy * 0.4 * up + Math.min(openness(m, t), 30);
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
      if (d < 14 && c.imm <= 0 && reach > 0 && random() < ((0.62 * reach) / c.st.hnd) * p.st.hnd) {
        steal(p, c);
        pop(c.x, c.y, 'STOLEN!', CY);
        feel(p, [18]);
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
      // online both teams play by the same numbers (Pro's), whatever the host's CPU level is
      const our = G.net ? DIFF.pro.ourSteal : settings.diff.ourSteal,
        base =
          G.practice && G.practice.opp === 'easy' && p.team === 1
            ? 0.15
            : G.ai0
              ? 1.1
              : cpuSide(p.team)
                ? settings.diff.steal
                : isHuman(p)
                  ? our
                  : our * 0.7;
      const reach = reachFactor(p, c),
        rate = ((base * (reach > 0 ? reach : 0.1) * p.st.hnd) / c.st.hnd) * (1 + 0.15 * catchUp(p.team));
      if (!isHuman(p)) {
        // A computer skater pokes rather than pulling steadily: one try every so often, harder against a carrier
        // skating at speed, and a miss leaves its stick out of position for a moment. So keeping your feet moving
        // gets you away from a defender that keeps up with you.
        if (p.pokeCd > 0) continue;
        p.pokeCd = rnd(0.5, 0.9);
        const moving = Math.hypot(c.vx, c.vy) > 35 ? POKE_MOVING : 1;
        if (random() < Math.min(0.85, rate * POKE * moving)) {
          steal(p, c);
          return;
        }
        p.cool = 0.3;
        continue;
      }
      if (random() < rate * dt) {
        steal(p, c);
        return;
      }
    }
  }
}
