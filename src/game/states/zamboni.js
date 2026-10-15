import { H, NETS, RX0, RX1, RY0, RY1, W } from '../../config';
import { clamp, wrapAngle } from '../../core/math';
import { random, rnd } from '../../core/rng';
import { loadBest, saveBest } from '../../core/storage';
import {
  S,
  SKIP,
  banner,
  clearFx,
  feed,
  hideBanner,
  hostOnly,
  iceChew,
  icePolish,
  persp,
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
import { net } from '../online';

const ZCELL = 4,
  ZW = W / ZCELL,
  ZH = H / ZCELL;
const COUNTDOWN = 3; // seconds of 3, 2, 1 before driving starts
// driving: top speed, how wide a strip the conditioner lays down (half width), and the length of a run. Tuned so a
// perfect lawnmower run covers about two thirds of the ice (turning at the ends costs time), a good one half.
export const ZAM = { speed: 55, half: 8, time: 30 };
// Online each player resurfaces their own half (the lower one on their screen) at the same time, and whoever
// polishes the larger share of their half gets the boost. Half the ice in the same 30 s would be easy to finish,
// so the machine is slower and the run shorter: a perfect run still covers about two thirds of a half.
export const ZAM_ONLINE = { speed: 44, half: 8, time: 20 };
const MID = H / 2; // the centre line, which online machines do not cross
// share of the ice (percent) for each rating; GOOD earns the speed boost
const SPOTLESS = 65,
  GOOD = 50,
  FAIR = 30;
// collision size: a little tighter than the drawn machine (about 15 units wide), so it fits through the gap
// between the back of a goal and the end boards (15 units) and can polish the ice behind the nets
const BODY_R = 6, // against the boards
  NET_R = 5; // around the goal frames
const spec = () => (G.net ? ZAM_ONLINE : ZAM);
/** The grid of ice cells to polish: the whole rink, or online one half (`half`: 1 the lower, -1 the upper). */
function grid(half) {
  const done = new Uint8Array(ZW * ZH);
  let total = 0;
  for (let j = 0; j < ZH; j++)
    for (let i = 0; i < ZW; i++) {
      const x = (i + 0.5) * ZCELL,
        y = (j + 0.5) * ZCELL;
      let ok = insideRinkW(x, y) && x > RX0 + 3 && x < RX1 - 3 && y > RY0 + 3 && y < RY1 - 3;
      for (const n of NETS) if (x > n.x0 - 2 && x < n.x1 + 2 && y > n.y0 - 2 && y < n.y1 + 2) ok = false;
      if (half && (y - MID) * half < 0) ok = false;
      if (ok) total++;
      else done[j * ZW + i] = 2;
    }
  return { done, total, count: 0 };
}
const polished = []; // spots the conditioner wiped this step, [x, y, …]
/** Wipes a strip across the back of machine z (at x, y facing a): fresh ice drawn, cells counted. */
function polish(z, x, y, a) {
  const hx = Math.sin(a),
    hy = -Math.cos(a),
    bx = x - hx * 4.5,
    by = y - hy * 4.5,
    px = -hy,
    py = hx,
    half = spec().half;
  polished.length = 0;
  for (let k = -half; k <= half + 1e-9; k += (half * 2) / 10) {
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
  if (random() < 0.4)
    parts.push({
      x: bx + px * rnd(-5, 5),
      y: by + py * rnd(-5, 5),
      vx: rnd(-6, 6),
      vy: rnd(-6, 6),
      life: rnd(0.2, 0.5),
      c: '#e6f6ff',
    });
}
export function startZamboni() {
  clearFx();
  parts.length = 0;
  G.state = 'zamboni';
  const sp = spec();
  // start at the side boards at centre ice, facing up the rink, so there is room to drive off (online: in your
  // own half, with the other player's machine coming the other way in theirs)
  G.zam = Object.assign(
    {
      x: 20,
      y: G.net ? 196 : 150,
      a: 0,
      v: 0,
      t: sp.time,
      phase: 'count',
      cd: COUNTDOWN, // countdown before driving
      horn: 0,
      sent: 0,
    },
    grid(G.net ? 1 : 0),
  );
  G.zam2 = null;
  if (G.net)
    G.zam2 = Object.assign(
      {
        x: W - 20,
        y: H - 196,
        a: Math.PI,
        v: 0,
        tx: W - 20,
        ty: H - 196,
        ta: Math.PI,
        last: null,
        claim: null,
      },
      grid(-1),
    );
  // the ice is chewed up after a period of hockey
  for (let i = 0; i < frost.length; i++) frost[i] = Math.max(frost[i], 0.7);
  // (online each screen runs its own resurfacing, so none of this goes to the other player)
  hostOnly(() => {
    iceChew();
    hideBanner();
    banner(
      'ICE RESURFACING',
      'alert',
      G.net
        ? 'Polish more of your half than ' + net.names[G.net === 'guest' ? 0 : 1] + ' to win the boost.'
        : 'Steer with the stick. Polish as much ice as you can.',
    );
    S('tick'); // the first beat of the 3, 2, 1
  });
  G.bannerT = 2.2;
  G.controlled = null;
  zoom(1);
  updCam(0, true);
  if (!G.demo) zamEngine('start');
}
export function stopEngine() {
  zamEngine('stop');
}
/** The engine goes quiet while the game is paused (on) and comes back on resume, if it is running: from the
 * 3, 2, 1 until this screen's machine has finished. */
export function pauseEngine(on) {
  const z = G.zam;
  if (!G.demo && z && (z.phase === 'count' || z.phase === 'drive')) zamEngine(on ? 'pause' : 'resume');
}
/** Steers machine z by the stick and moves it, guided along the boards (and online the centre line). */
function drive(z, dt) {
  const sp = spec();
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
    let da = wrapAngle(at - z.a);
    z.a += clamp(da, -2.6 * dt, 2.6 * dt);
  }
  z.v += clamp(m * sp.speed - z.v, -45 * dt, 30 * dt);
  const a0 = z.a, // the conditioner wipes where the machine pointed as it moved
    hx = Math.sin(z.a),
    hy = -Math.cos(z.a);
  const o = { x: z.x + hx * z.v * dt, y: z.y + hy * z.v * dt, vx: hx * z.v, vy: hy * z.v };
  let hitWall = rinkPush(o, BODY_R, 0) > 0;
  netPushBody(o, NET_R);
  // online: the centre line is a wall too (the other half is the other player's)
  if (G.net && o.y < MID + BODY_R) {
    o.y = MID + BODY_R;
    if (o.vy < 0) o.vy = 0;
    hitWall = true;
  }
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
        da = wrapAngle(along - z.a);
      z.a += clamp(da, -4 * dt, 4 * dt);
    }
    z.v *= 1 - 1.2 * dt;
  }
  // conditioner at the back: lay down fresh ice across a 10-unit strip
  if (z.v > 3) polish(z, z.x, z.y, a0);
  zamEngine('speed', (z.v * 38) / sp.speed); // the engine note at top speed stays where it was
}
export function zamStep(dt) {
  const z = G.zam;
  if (!z) return;
  if (G.zam2) remoteStep(G.zam2, dt);
  if (z.phase === 'count') {
    // 3, 2, 1, GO! before the clock starts, so the player is ready to steer
    const before = Math.ceil(z.cd);
    z.cd -= dt;
    input.sp = input.pp = input.swp = input.sr = false;
    if (Math.ceil(z.cd) !== before) S(z.cd <= 0 ? 'go' : 'tick');
    if (z.cd <= 0) z.phase = 'drive';
    return;
  }
  if (z.phase === 'wait') {
    // online: done, waiting for the other player's run (and, on the guest, for the host's call)
    input.sp = input.pp = input.swp = input.sr = false;
    z.wait += dt;
    if (G.net === 'host' && (G.zam2.claim || z.wait > 8)) decideOnline();
    return;
  }
  if (z.phase === 'done') {
    z.end -= dt;
    input.sp = input.pp = input.swp = input.sr = false;
    if (z.end <= 0 && G.net === 'host') {
      G.zam = G.zam2 = null;
      faceoff();
    } else if (z.end <= 0 && !G.net) {
      const pct = z.pct;
      G.zam = null;
      if (G.practice) {
        const b = loadBest();
        practiceOver(z.rating, pct + '% polished · best ' + Math.max(b, pct) + '%');
      } else faceoff();
    }
    return;
  }
  drive(z, dt);
  if (input.sp && z.horn <= 0) {
    z.horn = 0.5;
    hostOnly(zamHorn);
    if (G.net && net.send) net.send({ t: 'zh' });
  }
  z.horn -= dt;
  z.t -= dt;
  // online, the other player sees this machine: where it is goes over 20 times a second
  if (G.net && net.send && ++z.sent % 3 === 0) sendPos(z);
  const finish = input.pp;
  input.sp = input.pp = input.swp = input.sr = false;
  if (z.t <= 0 || finish || z.count >= z.total) {
    if (G.net) finishOwn();
    else finishZamboni();
  }
}
function sendPos(z) {
  const r = v => Math.round(v * 100) / 100;
  if (net.send) net.send({ t: 'zp', x: r(z.x), y: r(z.y), a: r(z.a), v: r(z.v), e: r(spec().time - z.t) });
}
function finishZamboni() {
  const z = G.zam;
  z.phase = 'done';
  z.end = 2.8;
  stopEngine();
  const pct = Math.round((z.count / Math.max(1, z.total)) * 100);
  const r =
    pct >= SPOTLESS ? 'SPOTLESS!' : pct >= GOOD ? 'GLASS SMOOTH' : pct >= FAIR ? 'NOT BAD' : 'BUMPY ICE';
  z.pct = pct;
  z.rating = r;
  banner(
    r,
    pct >= GOOD ? 'home' : 'small',
    pct + '% of the ice polished' + (pct >= GOOD && !G.practice ? ' · your team skates faster for 20s' : ''),
  );
  G.bannerT = 2.6;
  feed('Ice resurfaced · ' + pct + '% polished' + (pct >= GOOD ? ' · speed boost 20s' : ''), 0);
  if (pct >= GOOD) {
    if (!G.practice) G.mom = { team: 0, t: 20, dur: 20, src: 'ice' };
    S('cheer');
    vib([40, 30, 80]);
  } else S('ooh');
  if (pct > loadBest()) saveBest(pct);
}

/* ---------- online: two machines, one per half ---------- */
// Each player drives their own machine on their own screen (no network delay in the steering) and streams where it
// is. The other side redraws it from that stream and polishes the ice along its path, which is also how that side
// counts the other's share: a claimed result much larger than the path that arrived is not believed (the path
// itself is checked for speed and for staying in its half). The host makes the call; the guest checks it.
const pctOf = (n, z) => Math.round((n / Math.max(1, z.total)) * 100);
/** Cells the other machine may have polished beyond what its path showed here (samples are 20 a second). */
const slack = z => Math.max(4, Math.round(z.total * 0.04));
/** The other player's machine moves toward its last reported spot. */
function remoteStep(r, dt) {
  const k = 1 - Math.exp(-dt * 14);
  r.x += (r.tx - r.x) * k;
  r.y += (r.ty - r.y) * k;
  const da = wrapAngle(r.ta - r.a);
  r.a += da * k;
  if (r.v > 3 && random() < 0.3)
    parts.push({
      x: r.x + rnd(-4, 4),
      y: r.y + rnd(-4, 4),
      vx: rnd(-6, 6),
      vy: rnd(-6, 6),
      life: 0.3,
      c: '#e6f6ff',
    });
}
/** A position report from the other player's machine, in their view of the rink (their own half lower down). */
export function zamRemote(m) {
  const r = G.zam2;
  if (G.state !== 'zamboni' || !r || r.claim) return;
  const sp = spec();
  // in their own half and on the ice, and no time travel
  if (!(m.y >= MID - 1 && m.y <= RY1 && m.x >= RX0 && m.x <= RX1 && m.e >= 0 && m.e <= sp.time + 1)) return;
  // turned into this screen's view: their half is the upper one here
  let x = W - m.x,
    y = H - m.y;
  const a = m.a + Math.PI,
    last = r.last;
  if (last) {
    if (m.e < last.e) return;
    // no faster than the machine can go (a little slack for timing)
    const d = Math.hypot(x - last.x, y - last.y),
      max = sp.speed * 1.15 * (m.e - last.e) + 3;
    if (d > max) {
      x = last.x + ((x - last.x) / d) * max;
      y = last.y + ((y - last.y) / d) * max;
    }
    // polish along the way since the last report
    if (m.v > 3 && d > 0.05) {
      const n = Math.max(1, Math.ceil(Math.min(d, max) / 2));
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        polish(r, last.x + (x - last.x) * k, last.y + (y - last.y) * k, a);
      }
    }
  }
  r.last = { x, y, e: m.e };
  r.tx = x;
  r.ty = y;
  r.ta = a;
  r.v = m.v;
}
/** The other machine sounded its horn. */
export function zamRemoteHorn() {
  if (G.state === 'zamboni' && G.zam2) zamHorn();
}
/** This player's run is over (time up, all polished or FINISH): report it and wait for the other one. */
function finishOwn() {
  const z = G.zam;
  z.phase = 'wait';
  z.wait = 0;
  z.pct = pctOf(z.count, z);
  stopEngine();
  sendPos(z);
  if (net.send) net.send({ t: 'zd', n: z.count });
  hostOnly(() => {
    banner(z.pct + '% POLISHED', 'small', 'Waiting for ' + net.names[G.net === 'guest' ? 0 : 1] + '…');
  });
  G.bannerT = 0;
  if (G.net === 'host' && G.zam2.claim) decideOnline();
}
/** The other player's run is over: the number of cells they say they polished, checked against their path. */
export function zamRemoteDone(n) {
  const r = G.zam2;
  if (G.state !== 'zamboni' || !r || r.claim || !(n >= 0)) return;
  const believed = Math.min(n, r.count + slack(r), r.total);
  r.claim = { n, believed };
  if (believed < n) net.disputes++;
  if (G.net === 'host' && G.zam.phase === 'wait') decideOnline();
}
/** Host: both runs are in (or the guest's never came): the bigger share of a half wins the boost. */
function decideOnline() {
  const z = G.zam,
    r = G.zam2;
  if (z.phase !== 'wait') return;
  const p = [z.pct, pctOf(r.claim ? r.claim.believed : r.count, r)],
    w = p[0] > p[1] ? 0 : p[1] > p[0] ? 1 : -1;
  z.phase = 'done';
  z.end = 3.2;
  if (w >= 0) G.mom = { team: w, t: 20, dur: 20, src: 'ice' };
  const n = net.names;
  banner(
    persp(v => (w < 0 ? 'DEAD EVEN' : v === w ? 'YOUR ICE WINS' : n[w] + "'S ICE WINS")),
    persp(v => (w < 0 ? 'small' : v === w ? 'home' : 'away')),
    persp(
      v =>
        'You ' + p[v] + '% · ' + n[1 - v] + ' ' + p[1 - v] + '%' + (w < 0 ? ' · no boost' : ' · boost 20s'),
    ),
  );
  G.bannerT = 3;
  feed(
    'Ice resurfaced · ' +
      n[0] +
      ' ' +
      p[0] +
      '%, ' +
      n[1] +
      ' ' +
      p[1] +
      '%' +
      (w >= 0 ? ' · ' + n[w] + ' skates faster for 20s' : ''),
    w,
  );
  S(persp(v => (w < 0 ? 'ooh' : v === w ? 'cheer' : 'ooh')));
  vib(persp(v => (v === w ? [40, 30, 80] : SKIP)));
  // the guest checks the call against what it saw of the host's run and its own (src/net/match.js)
  zamCheck({ p, w, hostN: z.count });
}
let zamCheck = () => {};
/** The network layer's hook for the result (sent to the guest to check). */
export function onZamResult(fn) {
  zamCheck = fn;
}
/** Guest: the host's call, checked against this side's own run and what arrived of the host's path. */
export function zamVerify(res) {
  const z = G.zam,
    r = G.zam2;
  if (G.state !== 'zamboni' || !z || !r) return true;
  z.phase = 'done';
  z.end = 99; // the host ends it
  const mine = pctOf(z.count, z),
    hostBelieved = pctOf(Math.min(res.hostN, r.count + slack(r), r.total), r),
    // here the guest is team 0 and the host team 1; the result is in the host's view
    p = [res.p[1], res.p[0]],
    w = p[0] > p[1] ? 0 : p[1] > p[0] ? 1 : -1,
    hostW = res.w < 0 ? -1 : 1 - res.w;
  return Math.abs(p[0] - mine) <= 1 && p[1] <= hostBelieved + 1 && w === hostW;
}
