import { H, NETS, RX0, RX1, RY0, RY1, W } from '../../config';
import { clamp, rnd } from '../../core/math';
import { loadBest, saveBest } from '../../core/storage';
import {
  S,
  banner,
  clearFx,
  feed,
  hideBanner,
  iceChew,
  icePolish,
  updCam,
  vib,
  zamEngine,
  zamHorn,
  zoom,
} from '../fx';
import { FG, FH, FW, frost } from '../iceWear';
import { insideRinkW, netPushBody, rinkPush } from '../physics/rink';
import { practiceOver } from '../practice';
import { faceoff } from './faceoff';
import { G, parts } from '../world';
import { input, readStick } from '../../input/state';

const ZCELL = 4,
  ZW = W / ZCELL,
  ZH = H / ZCELL;
const COUNTDOWN = 3; // seconds of 3, 2, 1 before driving starts
// collision size: a little tighter than the drawn machine (about 15 units wide), so it fits through the gap
// between the back of a goal and the end boards (15 units) and can polish the ice behind the nets
const BODY_R = 6, // against the boards
  NET_R = 5; // around the goal frames
const polished = []; // spots the conditioner wiped this step, [x, y, …]
export function startZamboni() {
  clearFx();
  parts.length = 0;
  G.state = 'zamboni';
  // start at the side boards at centre ice, facing up the rink, so there is room to drive off
  G.zam = {
    x: 20,
    y: 150,
    a: 0,
    v: 0,
    t: 25,
    phase: 'count',
    cd: COUNTDOWN, // countdown before driving
    done: new Uint8Array(ZW * ZH),
    total: 0,
    count: 0,
    horn: 0,
  };
  for (let j = 0; j < ZH; j++)
    for (let i = 0; i < ZW; i++) {
      const x = (i + 0.5) * ZCELL,
        y = (j + 0.5) * ZCELL;
      let ok = insideRinkW(x, y) && x > RX0 + 3 && x < RX1 - 3 && y > RY0 + 3 && y < RY1 - 3;
      for (const n of NETS) if (x > n.x0 - 2 && x < n.x1 + 2 && y > n.y0 - 2 && y < n.y1 + 2) ok = false;
      if (ok) G.zam.total++;
      else G.zam.done[j * ZW + i] = 2;
    }
  // the ice is chewed up after a period of hockey
  for (let i = 0; i < frost.length; i++) frost[i] = Math.max(frost[i], 0.7);
  iceChew();
  hideBanner();
  banner('ICE RESURFACING', 'alert', 'Steer with the stick. Polish as much ice as you can.');
  S('tick'); // the first beat of the 3, 2, 1
  G.bannerT = 2.2;
  G.controlled = null;
  zoom(1);
  updCam(0, true);
  if (!G.demo) zamEngine('start');
}
export function stopEngine() {
  zamEngine('stop');
}
export function zamStep(dt) {
  const z = G.zam;
  if (z.phase === 'count') {
    // 3, 2, 1, GO! before the clock starts, so the player is ready to steer
    const before = Math.ceil(z.cd);
    z.cd -= dt;
    input.sp = input.pp = input.swp = input.sr = false;
    if (Math.ceil(z.cd) !== before) S(z.cd <= 0 ? 'go' : 'tick');
    if (z.cd <= 0) z.phase = 'drive';
    return;
  }
  if (z.phase === 'done') {
    z.end -= dt;
    input.sp = input.pp = input.swp = input.sr = false;
    if (z.end <= 0) {
      const pct = z.pct;
      G.zam = null;
      if (G.practice) {
        const b = loadBest();
        practiceOver(z.rating, pct + '% polished · best ' + Math.max(b, pct) + '%');
      } else faceoff();
    }
    return;
  }
  readStick();
  let jx = input.jx,
    jy = input.jy,
    m = Math.hypot(jx, jy);
  if (input.aim) {
    const k = input.keys,
      fwd = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0;
    jx = input.aim.x;
    jy = input.aim.y;
    m = fwd;
  }
  if (m > 0.2 || input.aim) {
    const at = Math.atan2(jx, -jy);
    let da = ((at - z.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    z.a += clamp(da, -2.6 * dt, 2.6 * dt);
  }
  z.v += clamp(m * 38 - z.v, -45 * dt, 30 * dt);
  const hx = Math.sin(z.a),
    hy = -Math.cos(z.a);
  const o = { x: z.x + hx * z.v * dt, y: z.y + hy * z.v * dt, vx: hx * z.v, vy: hy * z.v };
  const hitWall = rinkPush(o, BODY_R, 0) > 0;
  netPushBody(o, NET_R);
  z.x = o.x;
  z.y = o.y;
  // The boards (and nets) guide it rather than stop it: the push took away the motion into the obstacle, so
  // the nose turns toward the way it can still go (along the boards) faster than steering can turn it back,
  // and it scrapes along with a little drag instead of stalling.
  const lostX = hx * z.v - o.vx,
    lostY = hy * z.v - o.vy;
  if (hitWall || lostX * lostX + lostY * lostY > 1e-6) {
    // along the obstacle: perpendicular to the lost motion, on the side the nose already leans to
    let tx = -lostY,
      ty = lostX;
    if (tx * hx + ty * hy < 0) {
      tx = -tx;
      ty = -ty;
    }
    if (tx || ty) {
      const along = Math.atan2(tx, -ty),
        da = ((along - z.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      z.a += clamp(da, -4 * dt, 4 * dt);
    }
    z.v *= 1 - 1.2 * dt;
  }
  // conditioner at the back: lay down fresh ice across a 10-unit strip
  const bx = z.x - hx * 4.5,
    by = z.y - hy * 4.5,
    px = -hy,
    py = hx;
  if (z.v > 3) {
    polished.length = 0;
    for (let k = -6.5; k <= 6.5; k += 1.3) {
      const sx = bx + px * k,
        sy = by + py * k;
      polished.push(sx, sy);
      const fi = clamp(Math.floor(sx / FG), 0, FW - 1) + clamp(Math.floor(sy / FG), 0, FH - 1) * FW;
      frost[fi] = 0;
      const ci = Math.floor(sx / ZCELL),
        cj = Math.floor(sy / ZCELL);
      if (ci >= 0 && cj >= 0 && ci < ZW && cj < ZH && z.done[cj * ZW + ci] === 0) {
        z.done[cj * ZW + ci] = 1;
        z.count++;
      }
    }
    icePolish(polished);
    if (Math.random() < 0.4)
      parts.push({
        x: bx + px * rnd(-5, 5),
        y: by + py * rnd(-5, 5),
        vx: rnd(-6, 6),
        vy: rnd(-6, 6),
        life: rnd(0.2, 0.5),
        c: '#e6f6ff',
      });
  }
  zamEngine('speed', z.v);
  if (input.sp && z.horn <= 0) {
    z.horn = 0.5;
    zamHorn();
  }
  z.horn -= dt;
  z.t -= dt;
  const finish = input.pp;
  input.sp = input.pp = input.swp = input.sr = false;
  if (z.t <= 0 || finish || z.count >= z.total) finishZamboni();
}
function finishZamboni() {
  const z = G.zam;
  z.phase = 'done';
  z.end = 2.8;
  stopEngine();
  const pct = Math.round((z.count / Math.max(1, z.total)) * 100);
  const r = pct >= 92 ? 'SPOTLESS!' : pct >= 80 ? 'GLASS SMOOTH' : pct >= 55 ? 'NOT BAD' : 'BUMPY ICE';
  z.pct = pct;
  z.rating = r;
  banner(
    r,
    pct >= 80 ? 'home' : 'small',
    pct + '% of the ice polished' + (pct >= 80 && !G.practice ? ' · your team skates faster for 20s' : ''),
  );
  G.bannerT = 2.6;
  feed('Ice resurfaced · ' + pct + '% polished' + (pct >= 80 ? ' · speed boost 20s' : ''), 0);
  if (pct >= 80) {
    if (!G.practice) G.mom = { team: 0, t: 20, dur: 20, src: 'ice' };
    S('cheer');
    vib([40, 30, 80]);
  } else S('ooh');
  if (pct > loadBest()) saveBest(pct);
}
