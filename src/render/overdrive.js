// Overdrive graphics (Setup, off by default): extra effects on top of the normal picture. All of it is
// presentation: it reads the game state and listens to the simulation's events (wired in bindings.js), but never
// changes the match, so a headless run and online play behave the same with it on or off, and each online player
// picks it for themselves. (The one exception, the slow motion around the shot in goal replays, lives in
// game/replay.js and is skipped online, where both screens play the replay together.)
//
// The top-down renderer calls in at fixed points of its frame:
//   odFrozen()          a hit freeze holds the last frame for a few frames (screen only, the game runs on)
//   odFrame()           once per drawn frame: ages the effects, notices goals, stops and dropped gloves
//   odIce(g)            on the ice, under everyone: lasting skate marks and snow, the puck's shadow and trail
//   odReflections(g)    the players mirrored in the ice, broken up by its scratches and grooves
//   odNets(g)           the goal light washing the ice and its spinning beams
//   odBehind / odFront  around each skater: soft shadow, afterimages and speed lines; breath
//   odLights(g, ox, oy) the arena lighting: the frame darkened, then lit by the roof lamps, a follow spot,
//                       the goal light, flares and every glow; players are lit and shaded like the ice
//   odTop(g)            over everyone: net snow, sparks, confetti, flying gear, shockwaves, then the glow layer
//   odStands(g)         over the stands: team banners and camera flashes
//   odLens(g)           goal replays: the frame's edges soft and pixelated, as if out of focus
//   odPost(g)           the whole frame: a short colour split and flash on goals and big hits
// The 3D views add their own extras in mode7.js (ice reflections, haze and light beams, flashes in the crowd).
import { H, IH, IW, K, NETS, RX0, RX1, RY0, RY1, W } from '../config';
import { clamp, rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { STADIUMS } from '../data/stadiums';
import { kit } from '../game/kit';
import { SKATERS, players } from '../game/players';
import { G, puck, ref } from '../game/world';
import { reduceMotion, settings } from '../settings';
import { reflections, viewRect } from './atmosphere';
import { cv, low, view } from './canvas';
import { AMB, SH } from './colors';
import { FAN2D, M } from './stands';
import { R, disc, ellipsePx } from './pixels';
import { drawAgain } from './players';
import { onSettle } from './spray';
import { FLARES, pyroActive } from './pyro';

const on = () => settings.overdrive;
/** a team colour for confetti and banners (main, trim or white) */
const teamCol = (t, i) => {
  const c = kit.TEAMS[t] || kit.TEAMS[0];
  return i % 3 === 0 ? c.main : i % 3 === 1 ? c.trim || '#ffffff' : '#ffffff';
};

/* ---------- timing ---------- */
let lastT = 0,
  dt = 0,
  freezeUntil = 0,
  freezeW = 0,
  chromaUntil = 0,
  chromaLen = 0.3,
  flashUntil = 0,
  prevState = '',
  confettiUntil = 0,
  confettiTeam = 0;

/** Whether this frame keeps showing the last one: the hit freeze. */
export function odFrozen() {
  return on() && clock.now < freezeUntil && view.CW === freezeW;
}
function freeze(s) {
  if (reduceMotion) return;
  freezeUntil = Math.max(freezeUntil, clock.now + s);
  freezeW = view.CW;
}
function split(s) {
  if (reduceMotion) return;
  chromaUntil = clock.now + s;
  chromaLen = s;
}

/* ---------- effects ---------- */
// One list of short-lived effects in world units: k is the kind, t0 the start, life its length in seconds.
const fx = [],
  MAX_FX = 600;
const add = e => {
  if (fx.length < MAX_FX) fx.push(Object.assign({ t0: clock.now, vx: 0, vy: 0 }, e));
};
/** Glows for this frame, in world pixels: drawn last, added together, so bright things bloom. */
const glows = [];
// (`only`: it lights the scene around it, see odLights, but is not drawn as a glow itself)
const glow = (x, y, r, c, a, only = false) => glows.push({ x, y, r, c, a, only });

/* ---------- the lasting marks: snow and grooves, until the resurfacer comes ---------- */
const markC = document.createElement('canvas');
markC.width = IW;
markC.height = IH;
const mctx = markC.getContext('2d');
export function odIceClear() {
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, IW, IH);
  if (grooveC) grooveC.getContext('2d').clearRect(0, 0, grooveC.width, grooveC.height);
}
/** The resurfacer wiped these world points ([x, y, …]). */
export function odIcePolish(pts) {
  mctx.save();
  mctx.globalCompositeOperation = 'destination-out';
  mctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const x = toS(pts[i]),
      y = toS(pts[i + 1]);
    mctx.moveTo(x + 5, y);
    mctx.arc(x, y, 5, 0, Math.PI * 2);
  }
  mctx.fill();
  mctx.restore();
  if (!grooveC) return;
  const gx = grooveC.getContext('2d');
  gx.save();
  gx.globalCompositeOperation = 'destination-out';
  gx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] * K * GF,
      y = pts[i + 1] * K * GF;
    gx.moveTo(x + 5 * K * GF, y);
    gx.arc(x, y, 5 * K * GF, 0, Math.PI * 2);
  }
  gx.fill();
  gx.restore();
}
// The grooves: fine cuts the skates leave in the ice, drawn smooth at four times the world's pixel size and only
// on a full-resolution screen (see odPresent). They build up at random over each period, as play goes on, until
// the resurfacer wipes them: long carved arcs, often a few side by side, and short nicks everywhere.
const GF = 4;
let grooveC = null,
  arcsDue = 0,
  nicksDue = 0;
/** From the groove canvas to the screen canvas, for a frame whose world transform is `m` (turned round with the
 * ice in the reverse-angle replay). */
function grooveMatrix(m) {
  const s = view.ss;
  let t = new DOMMatrix([m.a * s, 0, 0, m.d * s, m.e * s, m.f * s]);
  if (G.state === 'replay' && G.rp && G.rp.angle.flip) t = t.translate(IW, IH).scale(-1, -1);
  return t.scale(1 / GF, 1 / GF);
}
const GROOVE_STATES = new Set(['play', 'faceoff', 'goal', 'celebrate', 'brawl']);
function growGrooves() {
  if (G.demo || view.ss === 1 || !GROOVE_STATES.has(G.state)) return;
  if (!grooveC) {
    grooveC = document.createElement('canvas');
    grooveC.width = IW * GF;
    grooveC.height = IH * GF;
  }
  // about 60 short curved cuts and 1600 tiny nicks over a period: imperfections, not gouges
  const per = Math.max(30, settings.periodLen || 60);
  arcsDue += (60 / per) * dt;
  nicksDue += (1600 / per) * dt;
  const s = grooveC.getContext('2d');
  s.setTransform(K * GF, 0, 0, K * GF, 0, 0);
  s.lineCap = 'round';
  s.strokeStyle = '#8fa3b9';
  for (; arcsDue >= 1; arcsDue--) {
    // a short curved cut, now and then two side by side
    const x = rnd(RX0 + 4, RX1 - 4),
      y = rnd(RY0 + 4, RY1 - 4),
      r = rnd(8, 30),
      a0 = rnd(0, Math.PI * 2),
      len = rnd(2, 7) / r, // 2 to 7 world units along the curve
      cx = x - Math.cos(a0) * r,
      cy = y - Math.sin(a0) * r;
    for (let k = 0, n = 1 + Math.floor(rnd(0, 2)); k < n; k++) {
      s.globalAlpha = rnd(0.15, 0.4);
      s.lineWidth = rnd(0.06, 0.15);
      s.beginPath();
      s.arc(cx, cy, r + k * rnd(0.4, 1.1), a0 + rnd(-0.02, 0.02), a0 + len + rnd(-0.02, 0.02));
      s.stroke();
    }
  }
  for (; nicksDue >= 1; nicksDue--) {
    const x = rnd(RX0 + 2, RX1 - 2),
      y = rnd(RY0 + 2, RY1 - 2),
      a = rnd(0, Math.PI * 2),
      l = rnd(0.4, 1.8);
    s.globalAlpha = rnd(0.1, 0.35);
    s.lineWidth = rnd(0.05, 0.12);
    s.beginPath();
    s.moveTo(x, y);
    s.quadraticCurveTo(
      x + Math.cos(a + 0.3) * l * 0.5,
      y + Math.sin(a + 0.3) * l * 0.5,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l,
    );
    s.stroke();
  }
  s.globalAlpha = 1;
}
const inRink = (x, y, m = 0) => x > RX0 + m && x < RX1 - m && y > RY0 + m && y < RY1 - m;
/** Snow left on the ice where a fleck settles (the stop spray, see spray.js, and the netting's snow): heavier
 * against the boards, where it piles up. */
function settle(x, y) {
  if (!on()) return;
  const boards = !inRink(x, y, 5);
  x = clamp(x, RX0 + 1, RX1 - 1);
  y = clamp(y, RY0 + 1, RY1 - 1);
  mctx.globalAlpha = boards ? 0.5 : 0.22;
  mctx.fillStyle = Math.random() < 0.6 ? '#ffffff' : '#dbe6f2';
  const s = boards ? 2 : 1;
  mctx.fillRect(toS(x), toS(y), s, s);
  mctx.globalAlpha = 1;
}
onSettle(settle);
/* ---------- events from the simulation ---------- */
const nearest = (x, y, list = SKATERS) => {
  let best = null,
    bd = Infinity;
  for (const p of list) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
};
/** A sound effect was played: some of them come with a picture. */
export function odSound(name, o) {
  if (!on() || G.demo) return;
  if (name === 'shot' && puck.hard) shockwave();
  else if (name === 'post') postSparks();
  else if (name === 'hitBig') bigHit(o && o.victim);
  else if (name === 'punch') punch(o && o.victim, o && o.big);
}
// motion smear on a slapshot: the shooter and when it started
const smears = new WeakMap();
function shockwave() {
  const x = puck.x,
    y = puck.y,
    sp = Math.hypot(puck.vx, puck.vy) || 1;
  add({ k: 'wave', x, y, life: 0.28 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd(-0.2, 0.2),
      v = rnd(60, 95);
    add({ k: 'streak', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.12, 0.2), c: '#ffffff' });
  }
  const s = nearest(x, y);
  if (s && Math.hypot(s.x - x, s.y - y) < 10)
    smears.set(s, { t0: clock.now, dx: -puck.vx / sp, dy: -puck.vy / sp });
}
function postSparks() {
  const x = puck.x,
    y = puck.y;
  for (let i = 0; i < 18; i++) {
    const a = rnd(0, Math.PI * 2),
      v = rnd(30, 95);
    add({
      k: 'spark',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: rnd(0.2, 0.5),
      c: i % 3 ? '#ffd36a' : '#ffffff',
    });
  }
  add({ k: 'flash', x, y, life: 0.25, c: '#ffe9a8', r: 22 });
}
function starBurst(x, y, n, big) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      v = big ? rnd(45, 70) : rnd(30, 45);
    add({
      k: 'star',
      x,
      y: y - 6,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.7,
      life: 0.45,
      c: i & 1 ? AMB : '#ffffff',
    });
  }
}
function bigHit(v) {
  const p = v && typeof v.x === 'number' ? v : null;
  if (p) {
    starBurst(p.x, p.y, 10, true);
    add({ k: 'wave', x: p.x, y: p.y, life: 0.3 });
    add({ k: 'flash', x: p.x, y: p.y - 6, life: 0.2, c: '#ffffff', r: 26 });
  }
  freeze(0.05);
  split(0.3);
  if (!reduceMotion) flashUntil = clock.now + 0.12;
}
function punch(v, big) {
  const p = v && typeof v.x === 'number' ? v : null;
  if (!p) return;
  starBurst(p.x, p.y - 4, big ? 7 : 4, big);
  if (!big) return;
  freeze(0.033);
  // the helmet comes off: it spins away and lies on the ice until the fight is over
  const dir = G.br && p === G.br.a ? -1 : 1;
  add({
    k: 'gear',
    type: 'h',
    c: (kit.TEAMS[p.team] && kit.TEAMS[p.team].helm) || '#1a1f33',
    fx: p.x,
    fy: p.y,
    x: p.x + dir * rnd(7, 11),
    y: p.y + rnd(2, 5),
    life: Infinity,
    dur: 0.5,
    spin: dir * rnd(9, 13),
  });
}
/** The netting was hit; a goal (str 1.5) shakes the snow off it. */
export function odNetHit(n, x, str) {
  if (!on() || G.demo || !n) return;
  const back = n.top ? n.y0 : n.y1,
    out = n.top ? -1 : 1,
    count = str >= 1 ? 18 : 5;
  for (let i = 0; i < count; i++)
    add({
      k: 'flake',
      x: x + rnd(-5, 5),
      y: back - out * rnd(0, 3),
      vx: rnd(-10, 10),
      vy: out * rnd(3, 14),
      life: rnd(0.8, 1.6),
      c: Math.random() < 0.7 ? '#ffffff' : '#dbe6f2',
    });
}
/* ---------- per frame ---------- */
const trail = [],
  hist = new WeakMap();
let prevZ = 0;
export function odFrame() {
  glows.length = 0;
  dt = clamp(clock.now - lastT, 0, 0.05);
  lastT = clock.now;
  if (!on()) {
    fx.length = 0;
    trail.length = 0;
    prevState = G.state;
    return;
  }
  // a goal: confetti and streamers from the stands, and a colour split
  if (G.state === 'goal' && prevState !== 'goal' && !G.demo && !G.practice) {
    confettiUntil = clock.now + 2.6;
    confettiTeam = G.lastTeam === 1 ? 1 : 0;
    split(0.4);
  }
  // a replay shows the play before the goal: nothing of the celebration belongs in it
  if (G.state === 'replay' && prevState !== 'replay') fx.length = 0;
  prevState = G.state;
  if (G.state === 'replay' || G.demo) confettiUntil = 0;
  if (clock.now < confettiUntil) {
    for (let i = 0; i < 5; i++) {
      const left = Math.random() < 0.5,
        streamer = Math.random() < 0.15;
      add({
        k: streamer ? 'streamer' : 'conf',
        x: left ? rnd(-10, -2) : W + rnd(2, 10),
        y: rnd(20, H - 20),
        vx: (left ? 1 : -1) * rnd(22, 55),
        vy: rnd(-14, 14),
        life: rnd(1.4, 2.6),
        c: teamCol(confettiTeam, Math.floor(rnd(0, 3))),
        ph: rnd(0, 6.28),
      });
    }
  }
  // gloves and sticks thrown down at the start of a fight spin through the air before they land
  if (G.br && G.br.litter)
    for (const l of G.br.litter) {
      if (l._od) continue;
      l._od = true;
      if (G.state !== 'brawl') continue;
      const f = nearest(l.x, l.y, [G.br.a, G.br.b].filter(Boolean));
      if (!f) continue;
      l._land = clock.now + 0.45;
      add({
        k: 'gear',
        type: l.t,
        c: l.c,
        fx: f.x,
        fy: f.y - 2,
        x: l.x,
        y: l.y,
        life: 0.45,
        dur: 0.45,
        spin: rnd(-14, 14),
      });
    }
  // helmets lie on the ice for the length of the fight
  if (G.state !== 'brawl') for (let i = fx.length - 1; i >= 0; i--) if (fx[i].type === 'h') fx.splice(i, 1);
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i],
      age = clock.now - e.t0;
    if (age > e.life) {
      if (e.k === 'flake') settle(e.x, e.y);
      fx.splice(i, 1);
      continue;
    }
    const drag = e.k === 'conf' || e.k === 'streamer' ? 0.5 : e.k === 'spark' ? 1.5 : 1;
    e.vx *= Math.exp(-drag * dt);
    e.vy *= Math.exp(-drag * dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }
  growGrooves();
  // where everyone was over the last frames (afterimages)
  for (const p of SKATERS) {
    let h = hist.get(p);
    if (!h) hist.set(p, (h = []));
    h.push(p.x, p.y);
    if (h.length > 26) h.splice(0, 2);
  }
  // the puck's path, for its trail
  const last = trail[trail.length - 1],
    free = !puck.owner && G.state !== 'zamboni';
  if (!free || (last && Math.hypot(puck.x - last.x, puck.y - last.y) > 25)) trail.length = 0;
  else {
    const sp = last && dt > 0 ? Math.hypot(puck.x - last.x, puck.y - last.y) / dt : 0;
    trail.push({ x: puck.x, y: puck.y, z: puck.z, sp });
    if (trail.length > 14) trail.shift();
  }
  // a puck that drops back onto the ice lands with a little puff
  if (prevZ > 0.6 && puck.z <= 0 && free) add({ k: 'puff', x: puck.x, y: puck.y, life: 0.35 });
  prevZ = puck.z;
}

/* ---------- on the ice ---------- */
const puckSpeed = () => (trail.length ? trail[trail.length - 1].sp : 0);
/** the trail's colour: white-hot through orange for the classic puck, the special pucks' own rim colour */
function trailCol(sp, i) {
  if (settings.puckKey !== 'classic') return i & 1 ? kit.PS.r : kit.PS.h || kit.PS.r;
  const k = clamp((sp - 60) / 160, 0, 1);
  return k > 0.75 ? '#ffffff' : k > 0.5 ? '#ffe14d' : k > 0.25 ? '#ff9b2f' : '#ff4d2e';
}
export function odIce(g) {
  if (!on()) return;
  g.drawImage(markC, 0, 0);
  // the puck in the air casts a shadow that spreads and fades as it rises
  if (puck.z > 0.3 && !(puck.owner && puck.owner.role === 'G')) {
    const z = puck.z;
    g.globalAlpha = clamp(0.4 - z * 0.03, 0.12, 0.4);
    disc(g, toS(puck.x), toS(puck.y) + 2, Math.round(3 + z * 0.5), Math.round(1 + z * 0.2), '#05070d');
    g.globalAlpha = 1;
  }
  // speed trail
  const n = trail.length,
    sp = puckSpeed();
  if (n > 2 && sp > 70) {
    const len = Math.min(n - 1, Math.round(4 + sp / 25));
    for (let i = n - len; i < n - 1; i++) {
      const a = trail[i],
        b = trail[i + 1],
        k = (i - (n - len)) / len,
        w = 1 + Math.round(k * 2);
      g.globalAlpha = 0.15 + 0.55 * k;
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * K));
      for (let s = 0; s < steps; s++) {
        const t = s / steps,
          x = toS(a.x + (b.x - a.x) * t),
          y = toS(a.y + (b.y - a.y) * t) - Math.round((a.z + (b.z - a.z) * t) * K);
        R(g, x - (w >> 1), y - (w >> 1), w, w, trailCol(sp, i + s));
      }
    }
    g.globalAlpha = 1;
  }
  if (sp > 110 && !puck.owner)
    glow(
      toS(puck.x),
      toS(puck.y) - puck.z * K,
      10 + sp / 25,
      trailCol(sp, 0),
      clamp((sp - 110) / 250, 0.1, 0.28),
    );
}

/* ---------- the goal light ---------- */
export function odNets(g) {
  if (!on()) return;
  for (const n of NETS) {
    const lit = view.lamp && view.lamp.n === n && clock.now < view.lamp.until;
    if (!lit) continue;
    const cx = ((n.x0 + n.x1) / 2) * K,
      ly = n.top ? n.y0 * K - 7 : n.y1 * K + 7,
      pulse = 0.75 + 0.25 * Math.sin(clock.now * 12);
    glow(cx, ly, 70, '#ff3b3b', 0.2 * pulse);
    // the light spinning behind the net throws two beams around
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ff3b3b';
    for (let i = 0; i < 2; i++) {
      const a = clock.now * 6 + i * Math.PI,
        L = 90,
        w = 0.22;
      g.globalAlpha = 0.16;
      g.beginPath();
      g.moveTo(cx, ly);
      g.lineTo(cx + Math.cos(a - w) * L, ly + Math.sin(a - w) * L * 0.6);
      g.lineTo(cx + Math.cos(a + w) * L, ly + Math.sin(a + w) * L * 0.6);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
}

/* ---------- around each skater ---------- */
const STC = document.createElement('canvas');
STC.width = 64;
STC.height = 72;
const stx = STC.getContext('2d');
/** `p` drawn at the origin into the stamp canvas, feet at (32, 52); in one flat colour when `sil` is set. */
function stamp(p, sil) {
  stx.setTransform(1, 0, 0, 1, 0, 0);
  stx.clearRect(0, 0, 64, 72);
  stx.setTransform(1, 0, 0, 1, 32, 52);
  const ox = p.x,
    oy = p.y,
    sv = view.sil;
  p.x = 0;
  p.y = 0;
  view.sil = sil || null;
  try {
    drawAgain(stx, p);
  } finally {
    p.x = ox;
    p.y = oy;
    view.sil = sv;
  }
  stx.setTransform(1, 0, 0, 1, 0, 0);
  return STC;
}
const boosted = p =>
  G.state !== 'replay' && G.mom && G.mom.t > 0 && G.mom.team === p.team && p.role !== 'G' && p.down <= 0;
/** Under the skater: a soft shadow, afterimages while boosted or right after a slapshot, speed lines. */
export function odBehind(g, p) {
  if (!on()) return;
  const sx = toS(p.x),
    sy = toS(p.y);
  g.globalAlpha = 0.16;
  disc(g, sx + 2, sy + 1, 9, 3, '#05070d');
  g.globalAlpha = 1;
  const h = hist.get(p),
    sm = smears.get(p),
    smearing = sm && clock.now - sm.t0 < 0.18;
  if (h && (boosted(p) || smearing)) {
    for (let i = 3; i >= 1; i--) {
      const j = h.length - 2 - i * (smearing ? 2 : 8);
      const x = smearing ? p.x + sm.dx * i * 2.5 : h[j],
        y = smearing ? p.y + sm.dy * i * 2.5 : h[j + 1];
      if (x === undefined || Math.hypot(x - p.x, y - p.y) < 1.5) continue;
      g.globalAlpha = 0.34 - i * 0.08;
      g.drawImage(stamp(p, smearing ? '#ffffff' : '#ffc845'), toS(x) - 32, toS(y) - 52);
    }
    g.globalAlpha = 1;
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 58 && p.down <= 0 && G.state !== 'replay') {
    const ux = -p.vx / sp,
      uy = -p.vy / sp;
    for (let i = 0; i < 3; i++) {
      const d = 11 + ((clock.now * 60 + i * 5) % 8),
        x = Math.round(sx + ux * d + (i - 1) * uy * 5),
        y = Math.round(sy - 9 + uy * d - (i - 1) * ux * 5),
        l = 3 + i;
      g.globalAlpha = 0.4 - i * 0.1;
      for (let s = 0; s < l; s++) R(g, Math.round(x + ux * s), Math.round(y + uy * s), 1, 1, '#ffffff');
    }
    g.globalAlpha = 1;
  }
}
const BREATH_STATES = new Set(['faceoff', 'goal', 'celebrate']);
/** Over the skater: breath in the cold. */
export function odFront(g, p) {
  if (!on()) return;
  const sx = toS(p.x),
    sy = toS(p.y);
  // the marker of your own skater glows, very faintly
  if (p === G.controlled && !G.ai0 && (G.state === 'play' || G.state === 'faceoff')) {
    glow(sx, sy + 1, 14, AMB, 0.08);
    glow(sx, sy - 30, 9, AMB, 0.1);
  }
  if (BREATH_STATES.has(G.state) && p.down <= 0) {
    const ph = (clock.now * 0.6 + (p.num || 0) * 0.37 + p.team * 0.5) % 1;
    if (ph < 0.4) {
      const k = ph / 0.4,
        side = Math.abs(p.fx) > Math.abs(p.fy),
        dx = side ? Math.sign(p.fx) * (3 + k * 5) : 0,
        dy = side ? -k * 3 : Math.sign(p.fy) * (2 + k * 4) - k * 2,
        r = 1 + Math.round(k * 2);
      g.globalAlpha = 0.5 * (1 - k);
      disc(g, Math.round(sx + dx), Math.round(sy - 17 + dy), r, Math.max(1, r - 1), '#eef4fb');
      g.globalAlpha = 1;
    }
  }
  if (boosted(p)) glow(sx, sy - 8, 20, '#ffc845', 0.22, true); // lights the ice around them
}

/* ---------- over everyone ---------- */
/** a small spinning thing seen from above: a glove, a stick or a helmet */
function gearShape(g, type, c) {
  if (type === 'g') {
    R(g, -2, -2, 5, 4, '#0b0f1a');
    R(g, -1, -1, 3, 2, c);
  } else if (type === 's') {
    R(g, -8, 0, 14, 1, '#b07a3c');
    R(g, 6, -1, 3, 2, c);
  } else {
    R(g, -3, -2, 6, 5, '#0b0f1a');
    R(g, -2, -2, 4, 4, c);
    R(g, -2, 1, 4, 1, '#c9d4e2');
  }
}
export function odTop(g) {
  if (!on()) return;
  for (const e of fx) {
    const age = clock.now - e.t0,
      k = e.life === Infinity ? 0 : age / e.life,
      x = toS(e.x),
      y = toS(e.y);
    switch (e.k) {
      case 'flake': {
        g.globalAlpha = 1 - k * k;
        R(g, x, y, 1, 1, e.c);
        break;
      }
      case 'spark':
      case 'streak': {
        g.globalAlpha = 1 - k;
        const tx = Math.round(e.vx * 0.04),
          ty = Math.round(e.vy * 0.04);
        R(g, x, y, 1, 1, e.c);
        R(g, x - tx, y - ty, 1, 1, e.c);
        R(g, x - (tx >> 1), y - (ty >> 1), 1, 1, e.c);
        if (e.k === 'spark') glow(x, y, 6, '#ffc845', 0.3 * (1 - k));
        break;
      }
      case 'star': {
        g.globalAlpha = 1 - k;
        R(g, x - 1, y, 3, 1, e.c);
        R(g, x, y - 1, 1, 3, e.c);
        break;
      }
      case 'flash':
        glow(x, y, e.r, e.c, 0.45 * (1 - k));
        break;
      case 'wave': {
        g.globalAlpha = 1 - k;
        ellipsePx(g, x, y - 2, Math.round(4 + k * 24), Math.round(2 + k * 11), '#ffffff');
        break;
      }
      case 'puff': {
        g.globalAlpha = 0.5 * (1 - k);
        disc(g, x, y + 1, Math.round(2 + k * 5), Math.round(1 + k * 2), '#eef4fb');
        break;
      }
      case 'conf': {
        // falling onto the ice: it flutters, turning its flat side to the camera and back
        const fl = Math.sin(age * 14 + e.ph) > 0;
        g.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
        R(g, x, y, fl ? 2 : 1, fl ? 1 : 2, e.c);
        break;
      }
      case 'streamer': {
        g.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
        const sp = Math.hypot(e.vx, e.vy) || 1,
          ux = -e.vx / sp,
          uy = -e.vy / sp;
        for (let s = 0; s < 9; s++) {
          const w = Math.sin(age * 9 + e.ph + s * 0.8) * 1.5;
          R(g, Math.round(x + ux * s * 1.2 - uy * w), Math.round(y + uy * s * 1.2 + ux * w), 1, 1, e.c);
        }
        break;
      }
      case 'gear': {
        // from the hands to the ice in an arc, spinning, with its shadow on the ice below
        const t = clamp(age / e.dur, 0, 1),
          gx = toS(e.fx + (e.x - e.fx) * t),
          gy = toS(e.fy + (e.y - e.fy) * t),
          z = Math.round(Math.sin(t * Math.PI) * 16);
        g.globalAlpha = 0.3;
        R(g, gx - 3, gy + 1, 6, 2, SH);
        g.globalAlpha = 1;
        g.save();
        g.translate(gx, gy - z);
        g.rotate(e.spin * Math.min(age, e.dur));
        gearShape(g, e.type, e.c);
        g.restore();
        break;
      }
    }
  }
  g.globalAlpha = 1;
  // the glow layer: soft light added on top
  if (glows.length) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of glows) {
      if (l.only) continue;
      const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      gr.addColorStop(0, l.c);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = l.a;
      g.fillStyle = gr;
      g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.restore();
    glows.length = 0;
  }
}

/* ---------- the stands ---------- */
// team banners hanging over the end stands (world units), and camera flashes going off in the crowd
const BANNERS = [24, 62, 98, 136].flatMap((x, i) => [
  { x, y: -M + 1.5, t: i & 1 },
  { x, y: H + M - 6.5, t: 1 - (i & 1) },
]);
const flashes = [];
export function odStands(g) {
  if (!on()) return;
  const v = viewRect();
  if (v.x >= 0 && v.x + v.w <= W && v.y >= 0 && v.y + v.h <= H) return;
  for (const b of BANNERS) {
    const x0 = toS(b.x) - 10,
      y0 = toS(b.y),
      c = kit.TEAMS[b.t];
    for (let c0 = 0; c0 < 20; c0 += 2) {
      const wave = Math.round(Math.sin(clock.now * 3 + c0 * 0.35 + b.x) * 1);
      R(g, x0 + c0, y0 + wave, 2, 9, c.main);
      R(g, x0 + c0, y0 + wave + 6, 2, 1, c.trim || '#ffffff');
    }
    R(g, x0 - 1, y0 - 1, 22, 1, '#9aa6b8'); // the bar it hangs from
  }
  // more flashes the louder the crowd, a burst of them for a goal
  const goal = G.state === 'goal' || G.state === 'celebrate',
    rate = G.practice ? 0 : 0.6 + G.hype * 8 + (goal ? 25 : 0);
  if (Math.random() < rate * dt) {
    const f = FAN2D[Math.floor(rnd(0, FAN2D.length))];
    flashes.push({ x: f.x, y: f.y - 2, t0: clock.now });
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i],
      k = (clock.now - f.t0) / 0.12;
    if (k >= 1) {
      flashes.splice(i, 1);
      continue;
    }
    const x = toS(f.x),
      y = toS(f.y);
    g.globalAlpha = 1 - k;
    R(g, x - 2, y, 5, 1, '#ffffff');
    R(g, x, y - 2, 1, 5, '#ffffff');
    glow(x, y, 9, '#ffffff', 0.35 * (1 - k));
  }
  g.globalAlpha = 1;
}

/* ---------- the whole frame ---------- */
const LC = document.createElement('canvas'),
  lcx = LC.getContext('2d'),
  SC = document.createElement('canvas'),
  scx = SC.getContext('2d');
/** Goal replays: the edges of the frame soft and coarse, as if out of focus, so the eye goes to the middle. */
export function odLens(g) {
  if (!on() || G.state !== 'replay') return;
  // (on the layers of a frame put together at full resolution, odPresent applies it at the right moment)
  if (layered.on) layered.lens = true;
  else lens(g);
}
/** The lens on whatever `g` holds, in blocks of three canvas pixels. */
function lens(g) {
  const w = g.canvas.width,
    h = g.canvas.height,
    b = 3 * (w / view.CW),
    sw = Math.max(1, Math.round(w / b)),
    sh = Math.max(1, Math.round(h / b));
  if (SC.width !== sw || SC.height !== sh) {
    SC.width = sw;
    SC.height = sh;
  }
  if (LC.width !== w || LC.height !== h) {
    LC.width = w;
    LC.height = h;
  }
  scx.imageSmoothingEnabled = true;
  scx.clearRect(0, 0, sw, sh);
  scx.drawImage(g.canvas, 0, 0, w, h, 0, 0, sw, sh);
  lcx.globalCompositeOperation = 'source-over';
  lcx.imageSmoothingEnabled = false;
  lcx.clearRect(0, 0, w, h);
  lcx.drawImage(SC, 0, 0, sw, sh, 0, 0, w, h);
  lcx.globalCompositeOperation = 'destination-in';
  const gr = lcx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.3,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.62,
  );
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,1)');
  lcx.fillStyle = gr;
  lcx.fillRect(0, 0, w, h);
  lcx.globalCompositeOperation = 'source-over';
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(LC, 0, 0);
  g.restore();
}
const TC = document.createElement('canvas'),
  tcx = TC.getContext('2d');
/** After a goal or a big hit: the red channel slips a pixel or two sideways for a moment, and a light flash. */
export function odPost(g) {
  if (!on() || reduceMotion) return;
  const w = g.canvas.width,
    h = g.canvas.height,
    px = w / view.CW;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (clock.now < chromaUntil) {
    const d = ((chromaUntil - clock.now) / chromaLen > 0.5 ? 2 : 1) * px;
    if (TC.width !== w || TC.height !== h) {
      TC.width = w;
      TC.height = h;
    }
    // the red channel on its own, shifted
    tcx.globalCompositeOperation = 'source-over';
    tcx.drawImage(g.canvas, 0, 0);
    tcx.globalCompositeOperation = 'multiply';
    tcx.fillStyle = '#ff0000';
    tcx.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#00ffff';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(TC, d, 0);
    g.globalCompositeOperation = 'source-over';
  }
  if (clock.now < flashUntil) {
    g.globalAlpha = ((flashUntil - clock.now) / 0.12) * 0.12;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
  }
  g.restore();
}

/* ---------- the arena lighting ---------- */
// Each arena hangs its own rig of big lamps over the rink (world units): rows of three, a ring under the dome,
// a staggered pattern under the tent. Between and around the pools the ice falls into shadow, the stands
// darker still.
const RIGS = {
  grid: [28, 80, 132].flatMap(x => [36, 84, 128, 172, 220].map(y => ({ x, y, r: 44 }))),
  ring: [
    { x: 80, y: 128, r: 50 },
    ...[...Array(8)].map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { x: 80 + Math.cos(a) * 50, y: 128 + Math.sin(a) * 88, r: 42 };
    }),
  ],
  stagger: [36, 76, 116, 156, 196, 236].flatMap((y, i) =>
    (i & 1 ? [52, 108] : [24, 80, 136]).map(x => ({ x, y, r: 42 })),
  ),
};
const RIG_OF = { dome: 'ring', tent: 'stagger', neon: 'stagger' };
const AMBIENT = '#59627e', // what the shadows keep: about half the light
  LS = 4; // the light map is drawn at a quarter of the canvas size, then smoothed up
/** the arena's lamp colour (the neon arena's tubes are pink and blue) */
const lampCol = (S, i) =>
  S.roof.light || (S.roof.kind === 'neon' ? (i & 1 ? '#ffb3e6' : '#b3ecff') : '#fff4d6');
const LMC = document.createElement('canvas'),
  lmx = LMC.getContext('2d');
let rig = RIGS.grid;
/** The lighting pass, drawn after the players and particles: `ox`, `oy` are the frame's camera offset. */
export function odLights(g, ox, oy) {
  if (!on()) return;
  const z = view.camZ,
    w = Math.ceil(view.CW / LS),
    h = Math.ceil(view.CH / LS);
  if (LMC.width !== w || LMC.height !== h) {
    LMC.width = w;
    LMC.height = h;
  }
  const S = STADIUMS[settings.stadiumKey];
  rig = RIGS[RIG_OF[S.roof.kind]] || RIGS.grid;
  lmx.globalCompositeOperation = 'source-over';
  lmx.globalAlpha = 1;
  lmx.fillStyle = AMBIENT;
  lmx.fillRect(0, 0, w, h);
  lmx.globalCompositeOperation = 'lighter';
  const X = wx => (wx * K * z + ox) / LS,
    Y = wy => (wy * K * z + oy) / LS,
    // a pool of light: flat in the middle, soft at the edge (x, y, r in light-map pixels)
    light = (x, y, r, col, a, core = 0.4) => {
      if (x + r < 0 || y + r < 0 || x - r > w || y - r > h || r <= 0) return;
      const gr = lmx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(core, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lmx.globalAlpha = Math.min(1, a);
      lmx.fillStyle = gr;
      lmx.fillRect(x - r, y - r, r * 2, r * 2);
    };
  // a goal turns the rig into a light show: the lamps chase in the scorer's colour
  const party = (G.state === 'goal' || G.state === 'celebrate') && !G.practice,
    team = kit.TEAMS[G.lastTeam === 1 ? 1 : 0].main,
    chase = Math.floor(clock.now * 6);
  rig.forEach((l, i) => {
    const col = party && (chase + i) & 1 ? team : lampCol(S, i);
    // broad, overlapping pools: an evenly lit sheet that dims between the lamps and toward the boards
    light(X(l.x), Y(l.y), (l.r * 1.25 * K * z) / LS, col, 0.5, 0.3);
  });
  // the follow spot: on the puck, the scorer after a goal, the two fighters in a fight
  const br = G.state === 'brawl' && G.br,
    spot = br ? br.m : party && G.lastShooter ? G.lastShooter : puck.owner || puck;
  if (spot) light(X(spot.x), Y(spot.y), ((br ? 40 : 30) * K * z) / LS, '#ffffff', br ? 0.35 : 0.2, 0);
  if (pyroActive())
    FLARES.forEach((f, i) =>
      light(
        X(f.x),
        Y(f.y),
        (18 * K * z) / LS,
        '#ff6a3a',
        0.6 + 0.25 * Math.sin(clock.now * 17 + i * 1.7),
        0.1,
      ),
    );
  // everything that glows lights its surroundings too
  for (const l of glows)
    light((l.x * z + ox) / LS, (l.y * z + oy) / LS, (l.r * 1.6 * z) / LS, l.c, l.a * 1.8, 0.1);
  // (on the layers of a frame put together at full resolution, odPresent multiplies it in)
  if (layered.on) {
    layered.light = true;
    return;
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.imageSmoothingEnabled = true;
  g.drawImage(LMC, 0, 0, w, h, 0, 0, w * LS, h * LS);
  g.restore();
}

/* ---------- the frame at full resolution ---------- */
// When the screen canvas is bigger than the game's canvas (view.ss > 1), a top-down frame is drawn in layers:
// the stands and the ice on the game's canvas (low), the reflections at full resolution, everything standing on
// the ice on a second layer and what goes over the lighting on a third. odPresent puts them together, the pixel
// art scaled up crisp and the light map multiplied in between.
const layered = { on: false, refl: false, light: false, lens: false, m: new DOMMatrix() },
  layerC = [2, 3].map(() => document.createElement('canvas'));
/** Starts drawing on layer `n` (2: on the ice, 3: over the lighting); returns the context to go on with. */
export function odLayer(g, n) {
  if (!on() || view.ss === 1) return g;
  const c = layerC[n - 2],
    x = c.getContext('2d');
  if (c.width !== view.CW || c.height !== view.CH) {
    c.width = view.CW;
    c.height = view.CH;
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, view.CW, view.CH);
  x.setTransform(g.getTransform());
  x.imageSmoothingEnabled = false;
  if (n === 2) layered.m = g.getTransform(); // the world's transform, for the grooves
  layered.on = true;
  return x;
}
/** Shows the frame on the screen canvas (view.ss > 1): scaled up, or put together from its layers. */
export function odPresent() {
  const x = cv.getContext('2d'),
    w = cv.width,
    h = cv.height;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.imageSmoothingEnabled = false;
  x.drawImage(low, 0, 0, w, h);
  if (layered.on) {
    // the grooves in the ice, smooth at full resolution
    if (grooveC) {
      x.setTransform(grooveMatrix(layered.m));
      x.imageSmoothingEnabled = true;
      x.globalAlpha = 0.4;
      x.drawImage(grooveC, 0, 0);
      x.globalAlpha = 1;
      x.imageSmoothingEnabled = false;
      x.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (layered.refl) {
      x.globalAlpha = 0.5;
      x.drawImage(RB, 0, 0);
      x.globalAlpha = 1;
    }
    x.drawImage(layerC[0], 0, 0, w, h);
    if (layered.light) {
      x.globalCompositeOperation = 'multiply';
      x.imageSmoothingEnabled = true;
      x.drawImage(
        LMC,
        0,
        0,
        LMC.width,
        LMC.height,
        0,
        0,
        LMC.width * LS * view.ss,
        LMC.height * LS * view.ss,
      );
      x.globalCompositeOperation = 'source-over';
      x.imageSmoothingEnabled = false;
    }
    if (layered.lens) lens(x);
    x.drawImage(layerC[1], 0, 0, w, h);
  }
  layered.on = layered.refl = layered.light = layered.lens = false;
}

/* ---------- reflections in real ice ---------- */
// At full resolution the ice reflections look like the real thing: the mirrored players a little soft, wavering
// gently where the ice is uneven, fading out below the feet, and broken up where the ice is grooved.
const RA = document.createElement('canvas'),
  rax = RA.getContext('2d'),
  RB = document.createElement('canvas'),
  rbx = RB.getContext('2d');
export function odReflections(g) {
  // on a screen canvas no bigger than the game's, the plain reflections
  if (view.ss === 1) {
    reflections(g);
    return;
  }
  const s = view.ss,
    w = view.CW * s,
    h = view.CH * s,
    m = g.getTransform(),
    zs = m.a * s;
  for (const c of [RA, RB])
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  // the mirrored players, at full resolution
  rax.setTransform(1, 0, 0, 1, 0, 0);
  rax.globalCompositeOperation = 'source-over';
  rax.clearRect(0, 0, w, h);
  rax.imageSmoothingEnabled = false;
  rax.setTransform(zs, 0, 0, zs, m.e * s, m.f * s);
  reflections(rax, 1);
  // fading out below the feet
  rax.globalCompositeOperation = 'destination-out';
  const fade = (x, y) => {
    const gr = rax.createLinearGradient(0, y + 2, 0, y + 26);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    rax.fillStyle = gr;
    rax.fillRect(x - 16, y, 32, 30);
  };
  for (const p of players) if (!p.benched) fade(toS(p.x), toS(p.y) + 1);
  fade(toS(ref.x), toS(ref.y) + 1);
  rax.globalCompositeOperation = 'source-over';
  // wavering where the ice is uneven: thin rows shifted by a fraction of a pixel, the same spots every frame
  rbx.setTransform(1, 0, 0, 1, 0, 0);
  rbx.globalCompositeOperation = 'source-over';
  rbx.clearRect(0, 0, w, h);
  rbx.imageSmoothingEnabled = true;
  for (let y = 0; y < h; y += 2) {
    const wy = (y - m.f * s) / zs,
      o = (Math.sin(wy * 0.9 + Math.sin(wy * 0.21) * 2.3) * 0.45 + Math.sin(wy * 2.7) * 0.2) * zs;
    rbx.drawImage(RA, 0, y, w, 2, o, y, w, 2);
  }
  // a little soft, as ice is no perfect mirror
  rax.setTransform(1, 0, 0, 1, 0, 0);
  rax.clearRect(0, 0, w, h);
  rax.filter = `blur(${(0.35 * zs).toFixed(2)}px)`;
  rax.drawImage(RB, 0, 0);
  rax.filter = 'none';
  // broken up where the ice is grooved
  rbx.clearRect(0, 0, w, h);
  rbx.drawImage(RA, 0, 0);
  if (grooveC) {
    rbx.globalCompositeOperation = 'destination-out';
    rbx.setTransform(grooveMatrix(m));
    rbx.drawImage(grooveC, 0, 0);
    rbx.globalCompositeOperation = 'source-over';
  }
  layered.refl = true;
}
