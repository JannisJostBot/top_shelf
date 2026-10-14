import { BASE, K } from '../config';
import { STICKS, stickCol } from '../data/sticks';
import { settings } from '../settings';
import { toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { blade } from '../game/physics/motion';
import { seat1 } from '../game/online';
import { G, puck, ref } from '../game/world';
import { view } from './canvas';
import { AMB, SH } from './colors';
import { drawFighter } from './fight';
import { R, blit, line } from './pixels';
import {
  FACES,
  GPAD,
  REFPAL,
  REFSET,
  SPR,
  STRIDE_SWAY,
  crouched,
  goalieLean,
  leaned,
  swayed,
  withNumber,
} from './sprites';

/** A stick line in the team's style: pixel by pixel, so patterned and animated sticks work. */
function stickLine(p, x0, y0, x1, y1, part) {
  const st = STICKS[settings.sticks[p.team]] || STICKS.wood,
    c = st[part],
    n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    R(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, stickCol(c, i, n, clock.now));
  }
}
const bladeTape = p => (STICKS[settings.sticks[p.team]] || STICKS.wood).blade || p.look.tape;
/** A stick in a team's style at plain pixel coordinates, for the jersey preview: hands at (hx, hy), blade at (bx, by). */
export function pixelStick(team, hx, hy, bx, by, tape, blade = { x: bx - 1, y: by, w: 4 }) {
  const p = { team, look: { tape } };
  stickLine(p, hx, hy, bx, by, 'shaft');
  stickLine(p, hx + 1, hy, bx + 1, by, 'edge');
  R(blade.x, blade.y, blade.w, 2, bladeTape(p));
}
function drawStick(p, sx, sy) {
  const side = p.fx < -0.25 ? -1 : 1,
    b = blade(p),
    bx = toS(b.x),
    by = toS(b.y);
  const hx = sx + side * 5,
    hy = sy - 9;
  stickLine(p, hx, hy, bx - Math.round(p.fx * 2), by - 1, 'shaft');
  stickLine(p, hx + 1, hy, bx - Math.round(p.fx * 2) + 1, by - 1, 'edge');
  const tape = bladeTape(p);
  if (Math.abs(p.fx) > 0.5) R(bx - 1, by - 1, 2, 3, tape);
  else R(bx - 1, by, 4, 2, tape);
}
function stars(sx, sy) {
  if (view.sil || !(Math.floor(clock.now * 11) & 1)) return;
  R(sx - 5, sy - 3, 2, 2, AMB);
  R(sx + 4, sy - 4, 2, 2, AMB);
  R(sx, sy - 6, 2, 2, '#ffffff');
}
export function drawSkater(p) {
  if (G.state === 'brawl' && G.br && (p === G.br.a || p === G.br.b) && p.down <= 0) {
    drawFighter(p);
    return;
  }
  const pal = p.pal || kit.PAL[p.team],
    set = FACES[p.look.face] || FACES.eyes,
    sx = toS(p.x),
    sy = toS(p.y);
  if (p.down > 0) {
    // a fall in three beats: a stumble toward the fall, the sprawl (with a little bounce on landing, sliding
    // with scrape marks while still moving) and, at the end, a crouch back up. `downAge` lets the Guide demos
    // pose it without a clock.
    if (!p._downAt) {
      p._downAt = clock.now;
      p._down0 = p.down;
    }
    const age = p.downAge ?? clock.now - p._downAt,
      dir = p.fallDir < 0 ? -1 : 1,
      // short knockdowns get a shorter crouch so the sprawl still shows
      rise = Math.min(0.3, (p._down0 - 0.14) * 0.35);
    if (age < 0.14) {
      const k = age / 0.14;
      R(sx - 8, sy, 16, 2, SH);
      blit(leaned(set.sideStop), pal, sx - 6 + Math.round(dir * k * 4), sy - 19 + Math.round(k * 4), dir < 0);
      return;
    }
    if (p.down < rise && p.downAge === undefined) {
      R(sx - 6, sy, 12, 2, SH);
      blit(crouched(crouched(set.sideA)), pal, sx - 6, sy - 17, dir < 0);
      drawStick(p, sx, sy);
      return;
    }
    const bounce = age < 0.24 ? 1 : 0,
      sp = Math.hypot(p.vx, p.vy);
    R(sx - 11, sy, 22, 3, SH);
    if (sp > 6 && !view.sil) {
      // scraping along the ice
      const ux = -p.vx / sp,
        uy = -p.vy / sp;
      for (let i = 0; i < 4; i++)
        R(
          Math.round(sx + ux * (12 + i * 3)),
          Math.round(sy + 1 + uy * (12 + i * 3) + (i & 1)),
          2,
          1,
          '#ffffff',
        );
    }
    stickLine(p, sx - 9, sy + 3, sx + 7, sy + 1, 'shaft');
    R(sx + 7, sy, 3, 2, bladeTape(p));
    blit(set.fallen, pal, sx - 10, sy - 12 - bounce, dir < 0);
    stars(dir < 0 ? sx - 8 : sx + 8, sy - 9);
    return;
  }
  p._downAt = 0;
  const sp = Math.hypot(p.vx, p.vy),
    mv = sp > 8,
    jy = Math.round(p.jump || 0);
  const sideV = Math.abs(p.fx) > Math.abs(p.fy) + 0.2,
    back = !sideV && p.fy < -0.35,
    now = clock.now,
    dt = Math.min(0.1, Math.max(0, now - (p._rt ?? now)));
  p._rt = now;
  const prev = p._psp === undefined ? sp : p._psp;
  p._psp = sp;
  if (prev - sp > 1.2 && sp > 18) p._stopUntil = now + 0.2;
  const stopping = now < (p._stopUntil || 0),
    backward = mv && (p.vx * p.fx + p.vy * p.fy) / sp < -0.3,
    sprint = sp > BASE * 1.02;
  // Which part of a skating run this is (all by distance skated, p.anim, so the legs keep pace with the ground):
  // the first strides from slow are short and quick, then long strides, a push every PUSH_ANIM; a skater who is
  // only slowing down (no push) glides on both skates.
  if (!mv || p._run0 === undefined || p.anim < p._run0) p._run0 = mv ? p.anim - START_ANIM : p.anim;
  const run = p.anim - p._run0,
    starting = run < START_ANIM;
  p._coast = !stopping && sp < prev - 0.02 ? (p._coast || 0) + dt : 0;
  const coasting = mv && p._coast > 0.18;
  const startI = Math.floor((run / START_CYCLE) * 4) & 3,
    strideI = (((Math.floor(((run - START_ANIM) / (PUSH_ANIM * 2)) * 12) + 2) % 12) + 12) % 12; // starts on a push
  // a shot from a skater facing sideways: the side-on stance a real slapshot takes, from the front
  const wind = windup(p),
    release = now < (p.followUntil || 0) ? 1 - (p.followUntil - now) / 0.3 : -1;
  if (sideV && (wind >= 0 || release >= 0) && G.state !== 'celebrate' && G.state !== 'post') {
    drawShot(
      p,
      set,
      pal,
      sx,
      sy - jy,
      wind >= 0 ? (wind < 0.34 ? 0 : wind < 0.67 ? 1 : 2) : release < 0.25 ? 3 : release < 0.5 ? 4 : 5,
      p.fx < 0,
    );
    return;
  }
  // a goal celebration from the front or back: arms up, stick held high
  if (!sideV && p.stickUp && (G.state === 'celebrate' || G.state === 'post')) {
    drawCelebration(p, set, pal, sx, sy - jy, back);
    return;
  }
  let map;
  if (sideV) {
    if (!mv || coasting) map = set.sideA;
    else if (stopping) map = set.sideStopLean;
    else if (starting) map = set.sideStart[startI];
    else map = sprint ? crouched(set.sideStride[strideI]) : set.sideStride[strideI];
  } else {
    const k = back ? 'back' : 'front';
    if (!mv || coasting) map = set[k + 'A'];
    else if (stopping) map = set[k + 'Stop'];
    else if (backward) map = set[k + (Math.floor(p.anim) & 1 ? 'Vee' : 'A')];
    else if (starting) map = set[k + 'Start'][startI];
    else map = set[k + 'Stride'][strideI];
    if (back) map = withNumber(map, p.num);
    if (back && mv && !stopping && !backward && !coasting && !starting)
      map = swayed(map, STRIDE_SWAY[strideI]);
    if (mv && !coasting && !stopping && !backward && (starting || sprint)) map = crouched(map);
  }
  // the stick stays up for a moment after a shot (follow-through), as during a wind-up
  const stickUp = p.stickUp || now < (p.followUntil || 0);
  R(sx - 6, sy, 12, 2, SH);
  R(sx - 4, sy + 2, 8, 1, SH);
  if (stickUp) {
    const side = p.fx < -0.25 ? -1 : 1;
    blit(map, pal, sx - 6, sy - 19 - jy, sideV && p.fx < 0);
    stickLine(p, sx + side * 5, sy - 9 - jy, sx + side * 7, sy - 30 - jy, 'shaft');
    stickLine(p, sx + side * 5 + 1, sy - 9 - jy, sx + side * 7 + 1, sy - 30 - jy, 'edge');
    R(sx + side * 7 - 1, sy - 33 - jy, 3, 4, bladeTape(p));
    return;
  }
  if (back) drawStick(p, sx, sy - jy);
  blit(map, pal, sx - 6, sy - 19 - jy, sideV && p.fx < 0);
  if (!back) drawStick(p, sx, sy - jy);
  if (p.stun > 0) stars(sx, sy - 20);
}
// Stride timing in p.anim units (p.anim grows 0.16 per world unit skated, see game/physics/step.js): a push every
// 40 units (a long, gliding stride); the first 33 units from slow are quick, short strides, two per 36 units.
const PUSH_ANIM = 6.4,
  START_ANIM = 5.3,
  START_CYCLE = PUSH_ANIM * 0.9;
/** How far a shot is wound up (0..1), or -1 when it isn't: a human holding Shoot, or the CPU's wind-up. */
function windup(p) {
  if (G.controlled === p && G.charging) return Math.min(1, G.charge / 0.7);
  if (seat1.controlled === p && seat1.charging) return Math.min(1, seat1.charge / 0.7);
  if (p.stickUp && G.state === 'play') {
    if (!p._suAt) p._suAt = clock.now;
    return Math.min(1, (clock.now - p._suAt) / 0.35);
  }
  p._suAt = 0;
  return -1;
}
/** Pixels of a short arm (two-pixel sleeve to a 2x2 glove) with its outline, at sprite coordinates. */
function arm(x0, y0, x1, y1, pal, ox, oy, flip) {
  const px = new Map(),
    put = (x, y, c) => px.set(x + ',' + y, c),
    n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0,
      x = Math.round(x0 + (x1 - x0) * t),
      y = Math.round(y0 + (y1 - y0) * t);
    put(x, y, 'J');
    put(x, y + 1, 'J');
  }
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ])
    put(x1 + dx, y1 + dy, 'G');
  const at = (x, y) => ox + (flip ? 11 - x : x);
  for (const k of px.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (!px.has(x + dx + ',' + (y + dy))) R(at(x + dx, y), oy + y + dy, 1, 1, pal.O);
  }
  for (const [k, c] of px) {
    const [x, y] = k.split(',').map(Number);
    R(at(x, y), oy + y, 1, 1, pal[c]);
  }
}
// The slapshot, side-on to the target (front view, mirrored when shooting left): set, load, top of the backswing,
// downswing, contact, follow-through. Both hands on the stick ([x, y] in sprite pixels), the blade's end, a sway.
const SHOT = [
  {
    hands: [
      [3, 12],
      [6, 13],
    ],
    blade: [10, 19],
    sway: 0,
  },
  {
    hands: [
      [1, 9],
      [3, 11],
    ],
    blade: [-6, 15],
    sway: -1,
  },
  {
    hands: [
      [0, 6],
      [1, 8],
    ],
    blade: [-7, -2],
    sway: -1,
  },
  {
    hands: [
      [2, 10],
      [4, 12],
    ],
    blade: [-2, 19],
    sway: 0,
    smear: true,
  },
  {
    hands: [
      [4, 12],
      [7, 13],
    ],
    blade: [11, 19],
    sway: 1,
  },
  {
    hands: [
      [8, 8],
      [10, 7],
    ],
    blade: [21, 0],
    sway: 1,
  },
];
function drawShot(p, set, pal, sx, sy, i, flip) {
  const k = SHOT[i],
    ox = sx - 6,
    oy = sy - 19,
    X = x => ox + (flip ? 11 - x : x);
  R(sx - 7, sy, 14, 2, SH);
  blit(swayed(set.frontShot, flip ? -k.sway : k.sway), pal, ox, oy, false);
  arm(1 + k.sway, 7, k.hands[0][0] + k.sway, k.hands[0][1], pal, ox, oy, flip);
  arm(10 + k.sway, 7, k.hands[1][0] + k.sway, k.hands[1][1], pal, ox, oy, flip);
  const hx = X(k.hands[0][0] + k.sway),
    hy = oy + k.hands[0][1],
    bx = X(k.blade[0]),
    by = oy + k.blade[1],
    d = Math.hypot(bx - hx, by - hy) || 1;
  stickLine(p, Math.round(hx - ((bx - hx) / d) * 2), Math.round(hy - ((by - hy) / d) * 2), bx, by, 'shaft');
  stickLine(
    p,
    Math.round(hx - ((bx - hx) / d) * 2) + 1,
    Math.round(hy - ((by - hy) / d) * 2),
    bx + 1,
    by,
    'edge',
  );
  const dir = flip ? -1 : 1;
  if (by >= oy + 19) R(Math.min(bx, bx + dir * 3), oy + 19, 4, 1, bladeTape(p));
  else R(bx - (flip ? 1 : 0), by, 2, 2, bladeTape(p));
  if (k.smear && !view.sil)
    for (let j = 1; j < 6; j++)
      R(
        bx - dir * (3 + j),
        Math.round(oy + 19 - j * 2.2 + j * j * 0.25),
        1,
        1,
        j < 3 ? '#ffffff' : '#d6e8f8',
      );
}
/** Arms up and the stick held high, pumping now and then (the jump comes from p.jump). */
function drawCelebration(p, set, pal, sx, sy, back) {
  const ox = sx - 6,
    oy = sy - 19,
    pump = Math.floor(clock.now * 3 + p.num) & 1 ? -1 : 0;
  R(sx - 6, sy, 12, 2, SH);
  const map = back ? withNumber(set.backBare, p.num) : set.frontBare;
  if (back) stickLine(p, ox - 1, oy + 4 + pump, ox - 3, oy - 4 + pump, 'shaft');
  blit(map, pal, ox, oy, false);
  arm(1, 7, -1, 2 + pump, pal, ox, oy, false);
  arm(10, 7, 11, 2 + pump, pal, ox, oy, false);
  if (!back) {
    stickLine(p, ox + 12, oy + 4 + pump, ox + 14, oy - 4 + pump, 'shaft');
    stickLine(p, ox + 13, oy + 4 + pump, ox + 15, oy - 4 + pump, 'edge');
    R(ox + 15, oy - 4 + pump, 1, 2, bladeTape(p));
  }
}
export function drawGoalie(g) {
  const pal = g.pal || kit.PAL[g.team],
    sx = toS(g.x),
    sy = toS(g.y),
    front = g.fy > 0;
  R(sx - 8, sy, 16, 2, SH);
  R(sx - 6, sy + 2, 12, 1, SH);
  const v = front ? 'goalieF' : 'goalieB';
  // a save: the glove rises beside the mask, the blocker punches out, or a low shot is taken in the butterfly
  // (down on the knees, pads flat on the ice in a wide V); the kind comes from the save (game/ai/goalie.js)
  if (g.saveT > 0) {
    const t = 1 - g.saveT / 0.32,
      kind = g.saveKind || 'pad';
    if (kind === 'pad') {
      const map = SPR[v + (t < 0.15 || t > 0.85 ? 'Drop' : 'Fly')];
      blit(map, pal, sx - 9, sy - 19 + (20 - map.length), !front);
      if (front) {
        stickLine(g, sx - 7, sy - 5, sx - 1, sy - 1, 'shaft');
        R(sx - 1, sy, 6, 1, bladeTape(g));
      }
      return;
    }
    const step = t < 0.3 || t > 0.85 ? 1 : 2,
      map = SPR[v + (kind === 'glove' ? 'Glove' : 'Block') + step];
    blit(map, pal, sx - 9 - GPAD, sy - 19, !front);
    if (front) goalieStick(g, sx, sy);
    return;
  }
  // shuffling across the crease (a T-push): the lead pad turns out, both open while the push leg drives, then
  // they close; held open on a fast push. The upper body leans into the movement.
  // (from the speed, not the position: the 3D view draws sprites at a stand-in position)
  const sp = Math.hypot(g.vx, g.vy),
    dt = Math.min(0.1, clock.now - (g._gt || clock.now));
  g._gt = clock.now;
  g._gd = (g._gd || 0) + sp * dt;
  const moving = sp > 6 && Math.abs(g.vx) > 3 && puck.owner !== g;
  let map = SPR[v];
  if (moving) {
    map = SPR[v + (sp > 32 ? 'Open' : ['', 'Half', 'Open', 'Half'][Math.floor(g._gd / 1.6) & 3])];
    // the back view is drawn mirrored, so its lean is mirrored too
    map = goalieLean(map, (g.vx > 0 ? 1 : -1) * (front ? 1 : -1));
  }
  blit(map, pal, sx - 9, sy - 19, !front);
  if (front) goalieStick(g, sx, sy);
}
/** The goalie's stick, in the blocker hand on the left, running down across the pads to the blade on the ice. */
function goalieStick(g, sx, sy) {
  stickLine(g, sx - 6, sy - 9, sx + 3, sy, 'shaft');
  R(sx + 3, sy - 1, 5, 2, bladeTape(g));
}
export function drawRef() {
  const sx = toS(ref.x),
    sy = toS(ref.y);
  R(sx - 6, sy, 12, 2, SH);
  if (G.state === 'faceoff') {
    blit(REFSET.frontA, REFPAL, sx - 6, sy - 19, false);
    if (puck.z > 0) {
      const px = toS(puck.x) + 3,
        py = toS(puck.y) - Math.round(puck.z * K);
      line(sx - 6, sy - 12, px, py, '#151515');
      line(sx - 6, sy - 11, px, py + 1, '#151515');
    }
    return;
  }
  const mv = Math.hypot(ref.vx, ref.vy) > 8,
    st = mv ? Math.floor(ref.anim) & 1 : 0;
  const sideV = Math.abs(ref.fx) > Math.abs(ref.fy) + 0.2,
    back = !sideV && ref.fy < -0.35;
  const map = sideV
    ? st
      ? REFSET.sideB
      : REFSET.sideA
    : back
      ? st
        ? REFSET.backB
        : REFSET.backA
      : st
        ? REFSET.frontB
        : REFSET.frontA;
  blit(map, REFPAL, sx - 6, sy - 19, sideV && ref.fx < 0);
}
