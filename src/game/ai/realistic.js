// "Realistic" CPU style: skaters that move and decide more like people. Chosen in Setup; the classic AI in
// team.js is untouched and stays the default.
//
// What makes it feel human:
//  - reaction time: decisions are made a few times a second, not every frame, and pursuit targets lag
//    behind what is happening, so players overshoot and correct like real skaters
//  - skating: heading turns at a limited rate (wider arcs at speed), sharp reversals at speed become a
//    hockey stop, players cruise when nothing is urgent and drift instead of standing perfectly still
//  - positions: centre, wing and defence keep their roles; on offence they spread into lanes and support
//    the carrier, on defence one skater keeps a goal-side gap on the carrier and the others mark a man
//  - the puck carrier follows a lane, curves around defenders, sometimes dekes, looks up before passing
//    and winds up visibly before shooting
import { ACC, BASE, GB, GT } from '../../config';
import { clamp, dist, lerp, rnd } from '../../core/math';
import { clock } from '../../core/time';
import { startCheck } from '../hits';
import { accelTo, faceTo, maxSpd } from '../physics/motion';
import { GK, SK, live } from '../players';
import { bestMate, passTo, shoot } from '../puck';
import { G, puck } from '../world';
import { settings } from '../../settings';
import { cpuSide, ctlOf } from '../online';
import { DOUBLE_AFTER, PRESS_AFTER, catchUp, easingOff, nearest, openLane, readCarrier, teamMul } from './team';

const wrap = a => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

/** Per-skater memory: smoothed target, next decision time, lane and the current plan. */
function brain(p) {
  return (p.rai ??= {
    next: 0,
    sx: p.x,
    sy: p.y,
    lane: rnd(-1, 1),
    side: 0,
    deke: 0,
    dekeDir: 1,
    shotAt: 0,
    shot: null,
    passAt: 0,
    pass: null,
    chaser: false,
    seed: rnd(0, 6.28),
  });
}
/** Seconds between decisions: faster for better CPU teams, a little random every time. */
function reaction(p) {
  const base =
    cpuSide(p.team) ? { rookie: 0.34, pro: 0.26, allstar: 0.2 }[settings.diffKey] || 0.26 : 0.26;
  return base * rnd(0.8, 1.3);
}

/** Skating like a person: limited turning rate, hockey stops on reversals, cruising, soft arrival and drift. */
function skate(p, tx, ty, dt, mul, urgency) {
  if (p.down > 0) {
    accelTo(p, 0, 0, dt, 70);
    return;
  }
  const b = brain(p);
  // pursuit lags behind the real target by about one reaction time
  const k = 1 - Math.exp(-dt / 0.22);
  b.sx += (tx - b.sx) * k;
  b.sy += (ty - b.sy) * k;
  let gx = b.sx,
    gy = b.sy;
  const dx0 = gx - p.x,
    dy0 = gy - p.y;
  if (Math.hypot(dx0, dy0) < 3) {
    // nothing to do: drift around the spot instead of freezing
    gx += Math.sin(clock.now * 0.7 + b.seed) * 2.5;
    gy += Math.cos(clock.now * 0.9 + b.seed) * 1.5;
  }
  const dx = gx - p.x,
    dy = gy - p.y,
    d = Math.hypot(dx, dy) || 1,
    top = maxSpd(p, mul) * urgency,
    sp = Math.hypot(p.vx, p.vy);
  let want = d < 1.5 ? 0 : d < 18 ? top * (d / 18) : top,
    hx = dx / d,
    hy = dy / d;
  if (sp > 6) {
    const cur = Math.atan2(p.vy, p.vx),
      da = wrap(Math.atan2(dy, dx) - cur);
    if (Math.abs(da) > 2.2 && sp > BASE * 0.55) {
      // turning round at speed: dig the edges in and stop first
      accelTo(p, 0, 0, dt, ACC * 1.1);
      return;
    }
    const rate = lerp(9, 3.2, clamp(sp / BASE, 0, 1)) * dt,
      a = cur + clamp(da, -rate, rate);
    hx = Math.cos(a);
    hy = Math.sin(a);
    want *= 1 - Math.min(0.3, Math.abs(da) * 0.22); // a little slower through the turn
  }
  accelTo(p, hx * want, hy * want, dt, d < 1.5 ? 60 : ACC * 0.85);
}
/** Look where you are going, or at the puck when it is close or you are standing. */
function look(p) {
  const sp = Math.hypot(p.vx, p.vy);
  if (dist(p, puck) < 40 || sp < 10) faceTo(p, puck.x, puck.y, 0.15);
  else faceTo(p, p.x + p.vx, p.y + p.vy, 0.15);
}
/** Nudge a spot away from the nearest opponent, so supporting players find open ice. */
function space(s, t) {
  let n = null,
    nd = 1e9;
  for (const q of SK[1 - t])
    if (live(q) && q.down <= 0) {
      const d = dist(q, s);
      if (d < nd) {
        nd = d;
        n = q;
      }
    }
  if (!n || nd > 18) return s;
  const k = (18 - nd) / (nd || 1);
  return { x: s.x + (s.x - n.x) * k * 0.6, y: s.y + (s.y - n.y) * k * 0.6 };
}
const inRink = s => ({ x: clamp(s.x, 12, 148), y: clamp(s.y, 14, 242) });

/* ---------- the puck carrier ---------- */
function carrier(o, t, dt) {
  const b = brain(o),
    dir = t ? 1 : -1,
    aG = t ? GB : GT,
    mul = teamMul(t),
    now = clock.now;
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
  // a shot that is being wound up goes off once the wind-up is done
  if (b.shot) {
    o.stickUp = true;
    accelTo(o, o.vx * 0.9, o.vy * 0.9, dt, 120);
    if (now >= b.shotAt) {
      o.stickUp = false;
      const s = b.shot;
      b.shot = null;
      shoot(o, s.x, s.y, s.v, s.err);
    }
    return;
  }
  if (b.pass) {
    if (now >= b.passAt) {
      const m = b.pass;
      b.pass = null;
      if (live(m) && m.down <= 0) passTo(o, m);
    }
  }
  // follow a lane toward the slot; cut around a defender in front; a quick deke when it is tight
  const progress = clamp(1 - Math.abs(aG - o.y) / 200, 0, 1);
  let tx = 80 + b.lane * 46 * (1 - progress * 0.7),
    ty = aG - dir * 22,
    urgency = 0.85;
  const ahead = near && dir * (near.y - o.y) > -4;
  if (near && ahead && nd < 26) {
    const side = o.x >= near.x ? 1 : -1;
    tx = o.x + side * 28;
    ty = o.y + dir * 18;
  }
  if (!near || !ahead) urgency = 1; // open ice: go
  if (b.deke > now) {
    tx = o.x + b.dekeDir * 30;
    urgency = 1;
  }
  ({ x: tx, y: ty } = inRink({ x: tx, y: ty }));
  skate(o, tx, ty, dt, mul * 0.97, urgency);
  faceTo(o, tx, ty, 0.18);

  if (now < b.next) return;
  b.next = now + reaction(o);
  if (nd < 12 && ahead && Math.random() < 0.3) {
    b.deke = now + 0.35;
    b.dekeDir = o.x >= near.x ? 1 : -1;
  }
  const dg = Math.hypot(80 - o.x, aG - o.y),
    shootingLane = dir * (aG - o.y) > 8 && Math.abs(o.x - 80) < dir * (aG - o.y) * 1.4 + 12;
  if (shootingLane) {
    const cu = catchUp(t),
      // behind, it shoots from further out too
      ps = dg < 36 ? 0.6 : dg < 60 ? 0.22 + 0.08 * cu : dg < 85 ? 0.08 * cu : 0;
    if (Math.random() < ps) {
      const gk = GK[1 - t];
      let off = gk.x > 80 ? -10.5 : 10.5;
      if (Math.abs(gk.x - 80) < 1.5) off = o.x < 80 ? 10.5 : -10.5;
      b.shot = {
        x: 80 + off,
        y: aG + dir * 2,
        v: rnd(190, 260) * o.st.sht,
        err: (cpuSide(t) ? settings.diff.err : 5) * o.st.acc * 1.1,
      };
      b.shotAt = now + rnd(0.16, 0.3); // the wind-up the defence can read
      return;
    }
  }
  const m = bestMate(o, t);
  if (m && !b.pass) {
    const pressured = nd < 12,
      better = dir * (m.y - o.y) > 22;
    if ((pressured && Math.random() < 0.45) || (better && Math.random() < 0.16)) {
      b.pass = m;
      b.passAt = now + rnd(0.08, 0.2); // a look before the pass
    }
  }
}

/* ---------- the team ---------- */
export function teamAIRealistic(t, dt) {
  const sk = SK[t].filter(live),
    dir = t ? 1 : -1,
    aG = t ? GB : GT,
    oG = t ? GT : GB,
    mul = teamMul(t),
    now = clock.now;
  const hum = ctlOf(t),
    o = puck.owner;
  for (const p of sk)
    if (p.dummy) {
      accelTo(p, 0, 0, dt, 200);
      if (p.down <= 0) faceTo(p, puck.x, puck.y, 0.1);
    }
  if (!sk.length) return;
  const avail = sk.filter(p => p !== hum && p !== o && p.checkT <= 0 && !p.dummy);
  for (const p of sk) if (p !== o && p.rai) p.rai.shot = p.rai.pass = null;
  if (o && o !== hum && o.team === t && o.role === 'S') carrier(o, t, dt);
  else if (o && o.rai) o.stickUp = false;

  const roleSpot = (p, s, urgency) => {
    const g = inRink(s);
    skate(p, g.x, g.y, dt, mul, urgency);
    look(p);
  };

  if (o && o.team === t && o.role === 'S') {
    // offence: lanes and support around the carrier
    const side = o.x < 80 ? 1 : -1;
    for (const p of avail) {
      let s;
      // the defenceman hangs back, or pinches in to join the attack when the team is behind
      if (p.slot === 'D') s = { x: 80 - side * 18, y: o.y - dir * (38 - 14 * catchUp(t)) };
      else if (o.slot === 'C' || p.slot === 'C')
        s = { x: 80 + side * (p.slot === 'C' ? 10 : 42), y: lerp(o.y + dir * 22, aG - dir * 34, 0.5) };
      else s = { x: 80 + side * 40, y: o.y + dir * 14 };
      roleSpot(p, openLane(p, space(s, t), o, t, dt), 0.85);
    }
  } else if (o && o.team === t) {
    // our goalie has it: spread out for the outlet
    const spots = { C: { x: 80, y: 128 }, W: { x: 120, y: oG + dir * 50 }, D: { x: 40, y: oG + dir * 50 } };
    for (const p of avail) roleSpot(p, spots[p.slot] || spots.C, 0.8);
  } else if (o) {
    // defence: one skater takes the carrier with a goal-side gap, the others mark a man
    if (o.role === 'G') {
      for (const p of avail)
        roleSpot(p, { x: p.slot === 'W' ? 110 : p.slot === 'D' ? 50 : 80, y: 128 + dir * 25 }, 0.8);
      return;
    }
    const humChase = hum && sk.every(p => dist(hum, o) <= dist(p, o));
    let chaser = null;
    if (!humChase && avail.length) {
      // keep the current chaser unless someone else is clearly better placed
      const cur = avail.find(p => p.rai && p.rai.chaser),
        best = nearest(avail, o);
      chaser = cur && dist(cur, o) < dist(best, o) + 15 ? cur : best;
      for (const p of avail) brain(p).chaser = p === chaser;
      const gx = 80 - o.x,
        gy = oG - o.y,
        gl = Math.hypot(gx, gy) || 1,
        gap = lerp(4, 14, clamp(gl / 140, 0, 1)); // tighter the closer to our net
      // a carrier who stands still gets no room: the gap closes and the chaser goes for the puck itself.
      // Otherwise the chaser goes by its read of the carrier, and now and then eases off goal-side to reset.
      const s = readCarrier(chaser, o, dt),
        ease = easingOff(chaser, o, dt);
      if (ease) skate(chaser, s.x + (gx / gl) * (gap + 16), s.y + (gy / gl) * (gap + 16), dt, mul * 0.8, 1);
      else if (G.holdT > PRESS_AFTER * (1 - 0.3 * catchUp(t))) skate(chaser, puck.x, puck.y, dt, mul, 1);
      else skate(chaser, s.x + (gx / gl) * gap + s.vx * 0.2, s.y + (gy / gl) * gap + s.vy * 0.2, dt, mul, 1);
      faceTo(chaser, o.x, o.y, 0.25);
      const rate = G.practice && G.practice.opp === 'easy' ? 0 : cpuSide(t) ? settings.diff.chk : 0.3;
      if (
        !ease &&
        chaser.down <= 0 &&
        chaser.checkCd <= 0 &&
        o.down <= 0 &&
        o.imm <= 0 &&
        dist(chaser, o) < 20 &&
        Math.random() < rate * (G.holdT > PRESS_AFTER ? 2 : 1) * (1 + 0.25 * catchUp(t)) * dt
      )
        startCheck(chaser, o);
    }
    const marks = SK[1 - t].filter(q => q !== o && live(q));
    // after a while a second skater leaves their man to help against a carrier who is waiting it out
    let helper = null;
    if (chaser && G.holdT > DOUBLE_AFTER) {
      helper = nearest(
        avail.filter(p => p !== chaser),
        o,
      );
      if (helper) {
        skate(helper, o.x - (puck.x - o.x), o.y - (puck.y - o.y), dt, mul, 1);
        faceTo(helper, o.x, o.y, 0.25);
      }
    }
    for (const p of avail) {
      if (p === chaser || p === helper) continue;
      // mark the nearest free opponent from the goal side; without one, cover the front of the net
      let m = null,
        md = 1e9;
      for (const q of marks) {
        const d = dist(p, q);
        if (d < md) {
          md = d;
          m = q;
        }
      }
      if (m) marks.splice(marks.indexOf(m), 1);
      const s = m
        ? { x: lerp(m.x, 80, 0.25), y: m.y + (oG - m.y) * 0.18 + dir * 4 }
        : { x: 80 + (puck.x - 80) * 0.3, y: oG + dir * 24 };
      roleSpot(p, s, md > 40 ? 1 : 0.85);
    }
  } else {
    // loose puck: the nearest skater goes for where it is heading, one supports, one stays back
    const pp = { x: puck.x + puck.vx * 0.4, y: puck.y + puck.vy * 0.4 };
    const humChase = hum && hum.down <= 0 && sk.every(p => dist(hum, pp) <= dist(p, pp));
    let rest = avail;
    if (!humChase && avail.length) {
      const ch = nearest(avail, pp);
      rest = avail.filter(p => p !== ch);
      skate(ch, pp.x, pp.y, dt, mul, 1);
      faceTo(ch, puck.x, puck.y, 0.25);
    }
    const ahead = dir * (puck.y - 128) > 0;
    for (const p of rest) {
      const s =
        p.slot === 'D'
          ? { x: 80, y: ahead ? 128 + dir * 10 : oG + dir * 40 }
          : { x: puck.x < 80 ? 116 : 44, y: puck.y - dir * 18 };
      roleSpot(p, space(s, t), 0.85);
    }
  }
}
