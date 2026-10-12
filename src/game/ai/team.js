import { GB, GT } from '../../config';
import { clamp, dist, lerp, rnd } from '../../core/math';
import { startCheck } from '../hits';
import { accelTo, faceTo, steer } from '../physics/motion';
import { GK, SK, live } from '../players';
import { bestMate, passTo, shoot } from '../puck';
import { G, puck } from '../world';
import { settings } from '../../settings';
import { cpuSide, ctlOf } from '../online';

/* ---------- AI ---------- */
// a puck carrier standing still this long gets pressed (and double-teamed a bit later)
export const PRESS_AFTER = 0.6,
  DOUBLE_AFTER = 2;
// Defenders are not perfect. A chaser reads the carrier's straight-line skating but needs a moment to notice a
// cut (READ, seconds, by CPU level), and after pressing tight for a while without winning the puck it eases off
// goal-side for about a second to reset, which gives the carrier room to break away.
const READ = { rookie: 0.3, pro: 0.22, allstar: 0.16 },
  // how long a chaser keeps pressing tight before it eases off (scaled by a random 1.4..2.6 s per cycle)
  PRESS_LEN = { rookie: 0.8, pro: 1, allstar: 1.25 },
  TIGHT = 12;
/** Where chaser `ch` thinks carrier `o` is right now: an estimate that follows the carrier with a short delay
 * and extrapolates its (equally delayed) velocity, so straight skating is read well and sharp cuts late. */
export function readCarrier(ch, o, dt) {
  const lag = READ[settings.diffKey] || 0.22;
  let s = ch.seen;
  if (!s || ch.seenOf !== o) s = ch.seen = { x: o.x, y: o.y, vx: o.vx, vy: o.vy };
  ch.seenOf = o;
  const k = Math.min(1, dt / lag);
  s.x += (o.x + o.vx * lag - s.x) * k; // the lag would otherwise leave the estimate trailing behind
  s.y += (o.y + o.vy * lag - s.y) * k;
  s.vx += (o.vx - s.vx) * k;
  s.vy += (o.vy - s.vy) * k;
  return s;
}
/** Runs a chaser's press-and-ease cycle; true while it is easing off. */
export function easingOff(ch, o, dt) {
  if (ch.easeT > 0) {
    ch.easeT -= dt;
    return true;
  }
  if (dist(ch, o) < TIGHT) ch.pressT = (ch.pressT || 0) + dt;
  else ch.pressT = Math.max(0, (ch.pressT || 0) - dt * 0.5);
  if (!ch.pressMax) ch.pressMax = rnd(1.4, 2.6) * (PRESS_LEN[settings.diffKey] || 1) * (1 + 0.25 * catchUp(ch.team));
  if (ch.pressT > ch.pressMax) {
    ch.pressT = 0;
    ch.pressMax = 0;
    ch.easeT = rnd(0.6, 1.0);
    return true;
  }
  return false;
}
// Getting open for a pass. A skater supporting the carrier checks now and then whether a defender stands in the
// passing lane between the carrier and its spot and, if so, slides to the side where the lane is clearest. It is
// a skater's read, not a calculation: it only looks again after a while (and the defenders move meanwhile), it
// judges the spot roughly, and now and then it does not notice at all.
const LANE_OPEN = 9, // a defender this far from the line still leaves it open
  LANE_TRIES = [-20, -13, -7, 7, 13, 20]; // sideways moves it considers
/** How close the nearest defender of team 1 - t is to the passing line from (ax, ay) to (bx, by). */
function laneClearance(ax, ay, bx, by, t) {
  const vx = bx - ax,
    vy = by - ay,
    l2 = vx * vx + vy * vy || 1;
  let c = 99;
  for (const q of SK[1 - t]) {
    if (!live(q) || q.down > 0) continue;
    const u = ((q.x - ax) * vx + (q.y - ay) * vy) / l2;
    if (u < 0.08 || u > 1.05) continue; // behind the passer or past the receiver
    c = Math.min(c, Math.hypot(q.x - (ax + vx * u), q.y - (ay + vy * u)));
  }
  return c;
}
/** The sideways move from spot s that best opens the lane from carrier o (none when it is open already). */
function laneShift(s, o, t) {
  let bs = laneClearance(o.x, o.y, s.x, s.y, t);
  if (bs >= LANE_OPEN) return { x: 0, y: 0 };
  const vx = s.x - o.x,
    vy = s.y - o.y,
    l = Math.hypot(vx, vy) || 1,
    px = -vy / l,
    py = vx / l;
  let best = { x: 0, y: 0 };
  for (const k of LANE_TRIES) {
    const x = clamp(s.x + px * k, 14, 146),
      y = clamp(s.y + py * k, 16, 240),
      c = laneClearance(o.x, o.y, x, y, t) - Math.abs(k) * 0.12; // rather a short move
    if (c > bs) {
      bs = c;
      best = { x: x - s.x, y: y - s.y };
    }
  }
  return best;
}
/**
 * Where supporting skater p heads (its role spot is s) to be open for a pass from carrier o. When the lane to
 * where it is now is blocked, it steps sideways into the open from right there; otherwise it goes on to its spot,
 * moved if the lane to that spot is blocked. Re-read only every half second or so, roughly, and not always.
 */
export function openLane(p, s, o, t, dt) {
  let m = p.lane;
  if (!m || m.of !== o) m = p.lane = { of: o, t: rnd(0.1, 0.5), x: 0, y: 0, here: null };
  m.t -= dt;
  if (m.t <= 0) {
    m.t = rnd(0.45, 0.9);
    if (Math.random() < 0.8) {
      m.here = null;
      m.x = m.y = 0;
      if (laneClearance(o.x, o.y, p.x, p.y, t) < LANE_OPEN) {
        const d = laneShift(p, o, t);
        if (d.x || d.y) m.here = { x: p.x + d.x + rnd(-3, 3), y: p.y + d.y + rnd(-3, 3) };
      }
      if (!m.here) {
        const d = laneShift(s, o, t);
        m.x = d.x ? d.x + rnd(-3, 3) : 0;
        m.y = d.y ? d.y + rnd(-3, 3) : 0;
      }
    }
  }
  return m.here || { x: s.x + m.x, y: s.y + m.y };
}
// Catching up: a computer team two goals behind changes its tactics (presses sooner and longer, shoots from
// further out, its defenceman joins the attack) and digs in a little (a touch faster, sharper with the stick,
// more checks); three or more behind, twice as much. Never your own AI teammates, never in practice.
export function catchUp(t) {
  if (G.practice || G.demo || G.net || (t === 0 && !G.ai0)) return 0;
  const d = G.score[1 - t] - G.score[t];
  return d >= 3 ? 2 : d >= 2 ? 1 : 0;
}
export function teamMul(t) {
  if (G.practice && t === 1 && G.practice.opp === 'easy') return 0.55;
  return (t === 1 && !G.net ? settings.diff.spd : G.demo ? 0.94 : 0.95) * (1 + 0.03 * catchUp(t));
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
function assign(list, spots, mul, dt, adjust) {
  const left = list.slice();
  for (let s of spots) {
    if (!left.length) break;
    const p = nearest(left, s);
    left.splice(left.indexOf(p), 1);
    if (adjust) s = adjust(p, s);
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
    const cu = catchUp(t),
      // behind, it shoots from further out too
      ps = dg < 38 ? 0.75 : dg < 62 ? 0.32 + 0.08 * cu : dg < 85 && nd < 10 ? 0.25 : dg < 90 ? 0.08 * cu : 0;
    if (Math.random() < ps) {
      const gk = GK[1 - t];
      let off = gk.x > 80 ? -10.5 : 10.5;
      if (Math.abs(gk.x - 80) < 1.5) off = o.x < 80 ? 10.5 : -10.5;
      shoot(
        o,
        80 + off,
        aG + dir * 2,
        rnd(190, 260) * o.st.sht,
        (cpuSide(t) ? settings.diff.err : 5) * o.st.acc,
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
  const hum = ctlOf(t),
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
        // the safety skater at centre ice, pushed up to join the attack when behind
        { x: 80, y: lerp(128, aG - dir * 60, 0.45 * catchUp(t)) },
      ];
    // supporting skaters look for an open passing lane to the carrier
    assign(avail, spots, mul, dt, o.role === 'S' ? (p, sp) => openLane(p, sp, o, t, dt) : null);
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
        // a carrier who stands still gets no room: the chaser goes straight for the puck on their stick, and
        // after a while a second skater comes to help (otherwise everyone would just wait it out). Otherwise the
        // chaser goes by its read of the carrier, and now and then eases off goal-side to reset.
        const s = readCarrier(ch, o, dt),
          ease = easingOff(ch, o, dt);
        if (ease) steer(ch, s.x + (gx / gl) * 18, s.y + (gy / gl) * 18, dt, mul * 0.8, false);
        else if (G.holdT > PRESS_AFTER * (1 - 0.3 * catchUp(t))) steer(ch, puck.x, puck.y, dt, mul, false);
        else steer(ch, s.x + (gx / gl) * 4 + s.vx * 0.15, s.y + (gy / gl) * 4 + s.vy * 0.15, dt, mul, false);
        faceTo(ch, o.x, o.y, 0.3);
        if (G.holdT > DOUBLE_AFTER && rest.length) {
          const help = nearest(rest, o);
          rest = rest.filter(p => p !== help);
          steer(help, o.x - (puck.x - o.x), o.y - (puck.y - o.y), dt, mul, false);
          faceTo(help, o.x, o.y, 0.3);
        }
        // AI defenders throw the occasional body check
        const rate =
          G.practice && G.practice.opp === 'easy' ? 0 : cpuSide(t) ? settings.diff.chk : 0.3;
        if (
          !ease &&
          ch.down <= 0 &&
          ch.checkCd <= 0 &&
          o.down <= 0 &&
          o.imm <= 0 &&
          dist(ch, o) < 22 &&
          Math.random() < rate * (G.holdT > PRESS_AFTER ? 2 : 1) * (1 + 0.25 * catchUp(t)) * dt
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
