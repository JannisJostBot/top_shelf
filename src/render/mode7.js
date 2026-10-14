import { GB, GT, IH, IW, K, ND, NETS, RR, RX0, RX1, RY0, RY1 } from '../config';
import { insideRinkW } from '../game/physics/rink';
export { insideRinkW };
import { drawPyro3D } from './pyro';
import { clamp, lerp } from '../core/math';
import { clock } from '../core/time';
import { STADIUMS } from '../data/stadiums';
import { kit } from '../game/kit';
import { players } from '../game/players';
import { G, parts, puck, ref } from '../game/world';
import { cinema } from './atmosphere';
import { view } from './canvas';
import { SH } from './colors';
import { iceBuf } from './ice';
import { puckBadge, replayOverlay } from './overlays';
import { R } from './pixels';
import { drawGoalie, drawRef, drawSkater } from './players';
import { puckPixels } from './puck';
import { FAN_ROWS, FAN_SEATS, U32, fanTab } from './stands';
import { ROOF_H, roofLamps, roofPainter } from './roofs';
import { drawScoreboard } from './scoreboard';
import { columnBuffer, drawGL, gl3dReady } from './gl3d';
import { settings } from '../settings';

/* ---------- 2.5D replay renderer (Mode 7 floor + raycast boards + billboard sprites) ---------- */
// Seating bowl for the 3D replay cameras, in world units: the first row starts just behind the glass and each
// row steps further back and higher. SEAT_W is the width of one fan along the boards.
const ROWS = 18,
  ROW_D0 = 2,
  ROW_DD = 2.2,
  ROW_Z0 = 3,
  ROW_DZ = 1.7,
  SEAT_W = 2.6,
  rowY = new Float32Array(ROWS + 1);
// Average crowd colour (and a darker shade), used where fans are too small to draw individually.
let toneFor = null,
  tone = null;
function crowdTone() {
  if (toneFor !== fanTab) {
    let r = 0,
      g = 0,
      b = 0;
    for (const f of fanTab) {
      const c = f.empty ? U32('#141a2c') : f.body;
      r += c & 255;
      g += (c >> 8) & 255;
      b += (c >> 16) & 255;
    }
    const n = fanTab.length,
      mk = k => ((255 << 24) | (((b / n) * k) << 16) | (((g / n) * k) << 8) | ((r / n) * k)) >>> 0;
    tone = { mid: mk(0.8), dark: mk(0.62) };
    toneFor = fanTab;
  }
  return tone;
}
let img3 = null,
  buf3 = null;
const SPC = document.createElement('canvas');
SPC.width = 48;
SPC.height = 56;
const spx = SPC.getContext('2d');
// Broadcast-style 3D shots. The menu background and the cinematic Watch mode both use them: each shot picks
// its goal and side at the cut and keeps them, and the camera follows a smoothed focus point with capped
// turning and travel speed, so the only sudden changes are the cuts themselves.
const FOCUS_K = 0.035, // how quickly the focus point glides after the puck (per frame)
  MOVE_K = 0.035, // how quickly the camera moves to its spot
  TURN_MAX = 0.012, // radians per frame (about 0.7 rad/s)
  MOVE_MAX = 0.6; // world units per frame (about 36 per second)
const cine = { fx: 80, fy: 128, net: null, side: 1, t0: 0 };
/** Spot for the fan cam: up in the side stands behind the glass, level with the play. */
function fanSpot(side, fy) {
  return { tx: side < 0 ? -12 : 172, ty: clamp(fy * 0.6 + 128 * 0.4, 50, 206), h: 15 };
}
// The fan cam looks across the whole rink at the far stands, about twice as far as the other shots look: with
// the same lens the crowd there shrinks to slivers a few pixels wide. A longer lens (like a fan zooming in)
// shows the fans at the size they have in the other shots.
const GUEST_ZOOM = 1.6;
/** Moves G.cam3 for a shot of the given kind; `snap` starts a new shot (a cut). */
export function broadcastCam(kind, snap) {
  const C = G.cam3 || (G.cam3 = { x: 80, y: 128, yaw: 0, h: 8.5 });
  // a jump of the puck (a face-off after a goal) is also a cut rather than a sweep across the rink
  snap = snap || Math.hypot(puck.x - cine.fx, puck.y - cine.fy) > 70;
  if (snap) {
    cine.fx = puck.x;
    cine.fy = puck.y;
    const attackTop = puck.owner ? puck.owner.team === 0 : puck.y < 128;
    cine.net = NETS[attackTop ? 0 : 1];
    cine.side = puck.x < 80 ? -1 : 1;
    cine.t0 = clock.now;
  } else {
    cine.fx += (puck.x - cine.fx) * FOCUS_K;
    cine.fy += (puck.y - cine.fy) * FOCUS_K;
  }
  const fx = cine.fx,
    fy = cine.fy,
    n = cine.net,
    gy = n.top ? GT : GB;
  let tx, ty, h;
  if (kind === 'chase') {
    // behind the play on the rink's long axis, looking toward this shot's goal
    tx = 80 + (fx - 80) * 0.6;
    ty = fy + (n.top ? 30 : -30);
    h = 8.5;
  } else if (kind === 'orbit') {
    // a slow high orbit around the play
    const a = (clock.now - cine.t0) * 0.25 + (cine.side > 0 ? 0 : Math.PI);
    tx = fx + Math.cos(a) * 34;
    ty = fy + Math.sin(a) * 34;
    h = 12;
  } else if (kind === 'net') {
    // beside this shot's goal at crossbar height, watching the play come in
    tx = cine.side < 0 ? n.x0 - 7 : n.x1 + 7;
    ty = n.top ? GT - 3 : GB + 3;
    h = 6.5;
  } else if (kind === 'guest') {
    // a fan in the stands on the far side from the play, looking over the glass
    ({ tx, ty, h } = fanSpot(-cine.side, fy));
  } else {
    // low at the boards opposite the play, looking across the ice
    tx = cine.side < 0 ? 150 : 10;
    ty = fy;
    h = 5;
  }
  if (kind !== 'guest')
    for (let i = 0; i < 30 && !insideRinkW(tx, ty); i++) {
      tx = lerp(tx, 80, 0.1);
      ty = lerp(ty, 128, 0.1);
    }
  C.guest = kind === 'guest';
  if (snap) {
    C.x = tx;
    C.y = ty;
  } else {
    let mx = (tx - C.x) * MOVE_K,
      my = (ty - C.y) * MOVE_K;
    const m = Math.hypot(mx, my);
    if (m > MOVE_MAX) {
      mx *= MOVE_MAX / m;
      my *= MOVE_MAX / m;
    }
    C.x += mx;
    C.y += my;
  }
  C.h = h;
  // the chase cam looks along the rink toward the goal; the others look at the focus point
  const yaw =
    kind === 'chase' ? Math.atan2(gy - C.y, 80 + (fx - 80) * 0.3 - C.x) : Math.atan2(fy - C.y, fx - C.x);
  const dyaw = ((yaw - C.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  C.yaw += snap ? dyaw : Math.max(-TURN_MAX, Math.min(TURN_MAX, dyaw * 0.06));
}

// behind the main menu: a new 3D shot every few seconds
const DEMO_SHOTS = ['chase', 'orbit', 'net', 'guest', 'boards'],
  SHOT_LEN = 6.5;
let demoShot = -1;
export function updDemoCam() {
  const idx = Math.floor(clock.now / SHOT_LEN) % DEMO_SHOTS.length,
    snap = idx !== demoShot;
  demoShot = idx;
  broadcastCam(DEMO_SHOTS[idx], snap);
}

/** Spectators in the two seat rows just in front of the fan cam: the heads you look over at the bottom of the
 * frame. Their seats are on a fixed grid along the stand (every SEAT_W, all along the stretch in view, not just
 * around the camera), projected like everything else, so they stay put while the camera pans and turns and none
 * pop in at the edges. Seats right beside the lens are left out and nobody grows past a set size, so turning the
 * camera never balloons a head. They jump and wave foam fingers when the crowd is loud. */
const FRONT_ROWS = [
    [6, 0.92], // distance in front of the camera (toward the rink), where the heads sit looking straight ahead
    [9, 0.84], // (share of the screen height, so they line the bottom edge whatever the screen's shape)
  ],
  HEAD_R = 0.4, // head radius, world units
  NEAR_D = 4.5, // closer to the lens than this (straight ahead): left out
  // only the people near you along the row show: from this far along it they fade out, gone FADE later
  ROW_NEAR = 18,
  FADE = 5;
function fanHeads(proj, C3, f, hor) {
  const g = view.ctx,
    toward = C3.x < 80 ? 1 : -1, // the rink side of the camera
    maxR = Math.min(view.CW, view.CH) * 0.1,
    list = [];
  FRONT_ROWS.forEach(([dx, at], row) => {
    const x = C3.x + toward * dx,
      z = C3.h - (dx * (at * view.CH - hor)) / f, // the height that puts these heads at that screen row

      stagger = row ? SEAT_W / 2 : 0;
    for (let k = Math.ceil((C3.y - 120) / SEAT_W); k * SEAT_W <= C3.y + 120; k++) {
      const y = k * SEAT_W + stagger,
        a = 1 - (Math.abs(y - C3.y) - ROW_NEAR) / FADE;
      if (a <= 0) continue;
      const q = proj(x, y, z);
      if (q && q.d >= NEAR_D) list.push({ q, id: k * 2 + row, a: Math.min(1, a) });
    }
  });
  list.sort((a, b) => b.q.d - a.q.d);
  for (const { q, id, a } of list) {
    g.globalAlpha = a;
    const ph = (((id * 2654435761) >>> 0) / 4294967296) % 1,
      cheer = G.hype > 0.1 || Math.sin(clock.now * 0.7 + ph * 12) > 0.92,
      r = Math.max(1, Math.min(maxR, Math.round(q.s * HEAD_R))),
      jump = cheer ? Math.round(Math.abs(Math.sin(clock.now * 9 + ph * 7)) * r * 0.5) : 0,
      cx = Math.round(q.x),
      base = Math.round(q.y) - jump + r; // the shoulders start just under the head
    if (cx < -r * 3 || cx > view.CW + r * 3 || base - r * 3 > view.CH) continue;
    const hy = base - r * 0.6;
    g.fillStyle = '#05070d';
    // rounded shoulders, and the back below them down out of the frame
    g.beginPath();
    g.ellipse(cx, base + r * 1.1, r * 1.8, r * 0.9, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - r * 1.8, base + r * 1.1, r * 3.6, view.CH - base);
    g.beginPath();
    g.arc(cx, hy, r, 0, Math.PI * 2); // head
    g.fill();
    const team = id & 1 ? 1 : 0;
    g.fillStyle = kit.TEAMS[(id >> 1) % 3 === 0 ? 1 - team : team].main;
    g.beginPath();
    g.arc(cx, hy - r * 0.1, r * 1.02, Math.PI, 0); // beanie in the teams' colours
    g.fill();
    if (cheer && ph < 0.35) {
      // a foam finger
      g.fillStyle = kit.TEAMS[team].main;
      g.fillRect(cx + r * 1.2, base - r * 3.4, r * 0.8, r * 2.6);
      g.fillRect(cx + r * 1.35, base - r * 4.4, r * 0.4, r);
    }
  }
  g.globalAlpha = 1;
}
export function upd3D(snap) {
  const A = G.rp && G.rp.angle;
  if (!A || !A.mode7 || !G.lastNet) return;
  const C = G.cam3 || (G.cam3 = { x: 80, y: 128, yaw: 0, h: 8.5 });
  const n = G.lastNet,
    gc = { x: 80, y: n.top ? GT : GB };
  let tx, ty, yaw, h;
  if (A.mode7 === 'chase') {
    const dx = gc.x - puck.x,
      dy = gc.y - puck.y;
    yaw = Math.hypot(dx, dy) < 18 && C.pyaw !== undefined && !snap ? C.pyaw : Math.atan2(dy, dx);
    C.pyaw = yaw;
    tx = puck.x - Math.cos(yaw) * 26;
    ty = puck.y - Math.sin(yaw) * 26;
    h = 8.5;
  } else if (A.mode7 === 'guest') {
    // a fan in the stands beside the goal end, watching over the glass
    ({ tx, ty, h } = fanSpot(puck.x < 80 ? 1 : -1, (n.top ? GT : GB) + (n.top ? 40 : -40)));
    yaw = Math.atan2(puck.y - ty, puck.x - tx);
  } else {
    tx = n.x1 + 7;
    ty = n.top ? GT - 3 : GB + 3;
    yaw = Math.atan2(puck.y - ty, puck.x - tx);
    h = 6.5;
  }
  C.guest = A.mode7 === 'guest';
  for (let i = 0; i < 30 && !C.guest && !insideRinkW(tx, ty); i++) {
    tx = lerp(tx, 80, 0.1);
    ty = lerp(ty, 128, 0.1);
  }
  const k = snap ? 1 : 0.09;
  C.x += (tx - C.x) * k;
  C.y += (ty - C.y) * k;
  C.h = h;
  const dyaw = ((yaw - C.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  C.yaw += dyaw * (snap ? 1 : 0.08);
}
// Ray marching samples, exactly as the march accumulates them (0.5, then +1.2 each step, up to the first one past
// 420), so a march can jump ahead to any sample and still land on the very same values it would have stepped to.
const MARCH = (() => {
  const a = [];
  for (let t = 0.5; ; t += 1.2) {
    a.push(t);
    if (t >= 420) break;
  }
  return a;
})();
const MARCH_END = MARCH.length - 1;
/** Index of the last march sample at or below t (0 if none). */
const sampleAtOrBelow = t => (t <= 0.5 ? 0 : Math.min(MARCH_END, Math.floor((t - 0.5) / 1.2 + 1e-9)));
/** Where a ray from (x, y) along (dx, dy) enters and leaves the rink's bounding box (into spanIn, spanOut). */
// boxSpan's result (kept in two variables rather than a new array for every screen column)
let spanIn = 0,
  spanOut = 0;
function boxSpan(x, y, dx, dy) {
  let lo = -Infinity,
    hi = Infinity;
  spanIn = Infinity;
  spanOut = -Infinity;
  if (dx) {
    const a = (RX0 - x) / dx,
      b = (RX1 - x) / dx;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  } else if (x < RX0 || x > RX1) return;
  if (dy) {
    const a = (RY0 - y) / dy,
      b = (RY1 - y) / dy;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  } else if (y < RY0 || y > RY1) return;
  spanIn = lo;
  spanOut = hi;
}
// how much shorter than the bounding box a ray can be inside the rink: at most the diagonal of a corner square
const CORNER_SLACK = RR * 1.5;
// per-frame caches: floor distance per screen row, and each fan's cheering wave
let rowT = new Float64Array(0),
  roofT = new Float64Array(0),
  roofFoot = new Float64Array(0);
// per column, the screen row where the roof ends (the back wall starts); glares only show on the roof
let roofEdge = new Float32Array(0);
let fanWave = new Float64Array(0),
  fanWaveAt = new Float64Array(0);
/** Halfway between two opaque packed colours. */
const avg32 = (a, b) => ((((a >>> 1) & 0x7f7f7f7f) + ((b >>> 1) & 0x7f7f7f7f)) | 0xff000000) >>> 0;
function glassTint(c) {
  const r = c & 255,
    g = (c >> 8) & 255,
    b = (c >> 16) & 255;
  return (
    // a quarter of the way to a cool white: (3 * c + tint) / 4, in integers (the same values as
    // floor(c * 0.75 + tint * 0.25), since a quarter is exact)
    ((255 << 24) | (((3 * b + 240) >> 2) << 16) | (((3 * g + 228) >> 2) << 8) | ((3 * r + 205) >> 2)) >>> 0
  );
}
/** Small star glares on the roof lamps: a bright core with spikes up, down and sideways (and shorter diagonal
 * ones), sized by distance and twinkling a little. Drawn before the players, so they pass in front. */
function drawGlares(proj, lamps) {
  const g = view.ctx,
    now = clock.now;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const l of lamps) {
    const q = proj(l.x, l.y, ROOF_H);
    if (!q) continue;
    const cx = Math.round(q.x),
      cy = Math.round(q.y);
    if (cx < 0 || cx >= view.CW || cy < 0 || cy >= roofEdge[cx] - 1) continue;
    const core = l.r * q.s;
    if (core < 0.25) continue;
    const tw = 0.8 + 0.2 * Math.sin(now * 3 + l.ph),
      a = Math.min(1, Math.max(0.3, core * 0.8)) * tw,
      L = Math.max(1, Math.min(9, Math.round((core * 3 + 1) * tw))),
      D = Math.floor(L / 2.5);
    g.fillStyle = l.col;
    g.globalAlpha = a;
    g.fillRect(cx, cy, 1, 1);
    for (let i = 1; i <= L; i++) {
      g.globalAlpha = a * Math.pow(1 - i / (L + 1), 1.5);
      g.fillRect(cx - i, cy, 1, 1);
      g.fillRect(cx + i, cy, 1, 1);
      g.fillRect(cx, cy - i, 1, 1);
      g.fillRect(cx, cy + i, 1, 1);
    }
    for (let i = 1; i <= D; i++) {
      g.globalAlpha = a * 0.6 * Math.pow(1 - i / (D + 1), 1.5);
      g.fillRect(cx - i, cy - i, 1, 1);
      g.fillRect(cx + i, cy - i, 1, 1);
      g.fillRect(cx - i, cy + i, 1, 1);
      g.fillRect(cx + i, cy + i, 1, 1);
    }
  }
  g.restore();
}
// a figure is about this many sprite pixels tall; in the menu one taller than this share of the frame fades out
const SPR_H = 24,
  NEAR_FADE = 0.45;
/** Draws the 3D view from G.cam3. `overlay` adds the REPLAY label and letterbox bars. */
export function render3D(overlay = true) {
  const C3 = G.cam3 || { x: 80, y: 128, yaw: 0, h: 8.5 },
    f = view.CW * 0.65 * (C3.guest ? GUEST_ZOOM : 1),
    fr = view.frame,
    cxs = fr && fr.cx != null ? fr.cx : view.CW / 2,
    // the horizon sits two fifths down the canvas, or down the window the 3D view is framed in
    hor = fr && fr.y0 != null ? Math.round(fr.y0 + (fr.y1 - fr.y0) * 0.45) : Math.round(view.CH * 0.4),
    h = C3.h;
  const Fx = Math.cos(C3.yaw),
    Fy = Math.sin(C3.yaw),
    Rx = -Fy,
    Ry = Fx;
  view.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!img3 || img3.width !== view.CW || img3.height !== view.CH) {
    img3 = view.ctx.createImageData(view.CW, view.CH);
    buf3 = img3 && img3.data ? new Uint32Array(img3.data.buffer) : null;
  }
  if (buf3 && fanTab.length) {
    const S = STADIUMS[settings.stadiumKey],
      KICK = U32(S.kick),
      BOARD = U32('#f3f5f8'),
      STAND = U32('#141a2c'),
      SEAT = U32('#0b0f1c'),
      NEARSEAT = U32('#2a3454'), // the fan cam's own seat rows below the near boards
      NEARSEAT2 = U32('#222a45'),
      ARENA = U32(S.arena),
      WALL = U32(S.arena),
      RIBBON = U32(S.kick),
      SUITE = U32('#3a3222'),
      roof = roofPainter(S),
      hype = G.hype;
    const crowd = crowdTone(),
      // the fan cam sits in the stands: rays first cross the near boards and glass, then the ice
      outside = !insideRinkW(C3.x, C3.y);
    if (rowT.length !== view.CH) rowT = new Float64Array(view.CH);
    if (roofEdge.length !== view.CW) roofEdge = new Float32Array(view.CW);
    for (let y = hor + 1; y < view.CH; y++) rowT[y] = (h * f) / (y - hor);
    // the same for the roof above the horizon: distance to the roof plane and how much roof one pixel covers
    if (roofT.length !== view.CH) {
      roofT = new Float64Array(view.CH);
      roofFoot = new Float64Array(view.CH);
    }
    for (let y = 0; y < hor; y++) {
      const tc = ((ROOF_H - h) * f) / (hor - y);
      roofT[y] = tc;
      roofFoot[y] = Math.max(tc / f, (tc * tc) / (f * (ROOF_H - h)));
    }
    if (fanWave.length !== fanTab.length) {
      fanWave = new Float64Array(fanTab.length);
      fanWaveAt = new Float64Array(fanTab.length).fill(NaN);
    }
    const now = clock.now,
      CW = view.CW,
      ib = iceBuf,
      camX = C3.x,
      camY = C3.y;
    /** sin(now * 11 + phase) for fan i, worked out once per frame */
    const wave = i => {
      if (fanWaveAt[i] !== now) {
        fanWaveAt[i] = now;
        fanWave[i] = Math.sin(now * 11 + fanTab[i].ph);
      }
      return fanWave[i];
    };
    // on the GPU when it can: this loop then only works out the per-column data, and a shader colours the pixels
    const useGL = gl3dReady(),
      colData = useGL ? columnBuffer(CW) : null;
    let prevSeat = NaN;
    for (let x = 0; x < CW; x++) {
      const k = (x - cxs) / f,
        dx = Fx + Rx * k,
        dy = Fy + Ry * k;
      // The rink is convex, so along a ray the samples are outside, then inside, then outside again: skipping
      // samples that are certainly before the boards (by the bounding box) gives the same result as stepping.
      boxSpan(C3.x, C3.y, dx, dy);
      const bIn = spanIn,
        bOut = spanOut;
      let n = 0,
        t = 0.5,
        tIn = 0;
      if (outside) {
        // samples before the ray reaches the bounding box are outside the rink
        n = bIn > bOut ? MARCH_END : Math.max(0, sampleAtOrBelow(bIn) - 1);
        while (MARCH[n] < 420 && !insideRinkW(C3.x + dx * MARCH[n], C3.y + dy * MARCH[n])) n++;
        t = MARCH[n];
        let lo = Math.max(0.1, t - 1.2),
          hi = t;
        for (let i = 0; i < 5 && t < 420; i++) {
          const m = (lo + hi) / 2;
          if (insideRinkW(C3.x + dx * m, C3.y + dy * m)) hi = m;
          else lo = m;
        }
        tIn = hi;
      }
      const nearTop = hor + ((h - 4.5) * f) / tIn,
        nearBase = hor + (h * f) / tIn,
        nearGlass = hor + ((h - 10) * f) / tIn,
        nearKick = nearBase - (nearBase - nearTop) * 0.22;
      // samples well before the far side of the bounding box are still inside the rink
      if (bOut - CORNER_SLACK > MARCH[n]) n = Math.max(n, sampleAtOrBelow(bOut - CORNER_SLACK) - 1);
      while (MARCH[n] < 420 && insideRinkW(C3.x + dx * MARCH[n], C3.y + dy * MARCH[n])) n++;
      t = MARCH[n];
      if (t < 420) {
        let lo = Math.max(0.1, t - 1.2),
          hi = t;
        for (let i = 0; i < 5; i++) {
          const m = (lo + hi) / 2;
          if (insideRinkW(C3.x + dx * m, C3.y + dy * m)) lo = m;
          else hi = m;
        }
        t = hi;
      }
      const wb = hor + (h * f) / t,
        bt = hor + ((h - 4.5) * f) / t,
        gt = hor + ((h - 10) * f) / t,
        kick = wb - (wb - bt) * 0.22;
      let bcol = BOARD;
      const bx = ((C3.x + dx * (t + 1.2)) * K) | 0,
        by = ((C3.y + dy * (t + 1.2)) * K) | 0;
      if (ib && bx >= 0 && by >= 0 && bx < IW && by < IH) bcol = ib[by * IW + bx];
      const ang = C3.yaw + Math.atan(k);
      let u = Math.floor((ang / (2 * Math.PI)) * 512) % 512;
      if (u < 0) u += 512;
      // Stands: tiered rows behind the glass, each a step further back and higher, projected with the same
      // perspective as the boards so the crowd stays put as the camera moves. Fans are anchored to where this
      // ray meets the boards, measured around the rink, so they do not slide when the camera pans.
      const hx = C3.x + dx * t,
        hy = C3.y + dy * t,
        around = (Math.atan2((hy - 128) / 124, (hx - 80) / 76) + Math.PI) * 128,
        seatF = around / SEAT_W,
        // seats per screen pixel here; when fans are under ~2.5 px wide they would alias into streaks
        tiny = Math.abs(seatF - prevSeat) > 0.4,
        seat = ((Math.floor(seatF) % FAN_SEATS) + FAN_SEATS) % FAN_SEATS,
        xin = seatF - Math.floor(seatF);
      prevSeat = seatF;
      // the back wall rises from behind the top row to the roof
      const tW = t + ROW_D0 + ROWS * ROW_DD,
        wallTop = hor + ((h - ROOF_H) * f) / tW;
      roofEdge[x] = wallTop;
      if (useGL) {
        colData[x * 4] = t;
        colData[x * 4 + 1] = tIn;
        colData[x * 4 + 2] = seatF;
        colData[x * 4 + 3] = u + (tiny ? 1000 : 0);
        continue;
      }
      for (let r = 0; r <= ROWS; r++)
        rowY[r] = hor + ((h - (ROW_Z0 + r * ROW_DZ)) * f) / (t + ROW_D0 + r * ROW_DD);
      let r = 0;
      for (let y = view.CH - 1; y >= 0; y--) {
        let col;
        if (y > wb) {
          const tt = rowT[y],
            ix = ((camX + dx * tt) * K) | 0,
            iy = ((camY + dy * tt) * K) | 0;
          col = ib && ix >= 0 && iy >= 0 && ix < IW && iy < IH ? ib[iy * IW + ix] : ARENA;
        } else if (y >= kick) col = KICK;
        else if (y >= bt) col = bcol;
        else {
          while (r < ROWS && y < rowY[r + 1]) r++;
          if (y < rowY[ROWS]) {
            if (y < wallTop) {
              // the roof: where this pixel's ray meets the roof plane
              const tc = roofT[y];
              col = roof(camX + dx * tc, camY + dy * tc, roofFoot[y], tc);
            } else {
              // the back wall above the top row: a ribbon board in the arena colour and a row of lit suites
              const z = h - ((y - hor) * tW) / f;
              col = z >= 36 && z < 37.6 ? RIBBON : z >= 40 && z < 44 && u % 8 < 6 ? SUITE : WALL;
            }
          }
          else {
            const top = rowY[r + 1],
              bh = rowY[r] - top,
              fi = seat * FAN_ROWS + (r % FAN_ROWS),
              fan = fanTab[fi];
            if (bh < 2 || tiny) {
              // too far for whole fans: each pixel still shows one fan's colours (softened toward the crowd
              // tone), so the far stands read as a packed crowd instead of flat bands; loud fans pop up
              const shade = r & 1 ? crowd.dark : crowd.mid;
              if (fan.empty) col = shade;
              else {
                const up = hype > 0.05 && wave(fi) > 0.4,
                  head = bh >= 1.5 && (y - top) / bh < 0.32;
                col = avg32(head || up ? fan.head : xin > 0.6 ? fan.bodyD : fan.body, shade);
              }
            } else {
              const bob = hype > 0.05 ? wave(fi) * hype * 0.18 : 0,
                w = (y - top) / bh + bob;
              col = w >= 0.84 ? SEAT : STAND;
              if (!fan.empty) {
                if (w >= 0.02 && w < 0.3 && xin >= 0.32 && xin <= 0.68) col = fan.head;
                else if (w >= 0.3 && w < 0.84 && xin >= 0.14 && xin <= 0.86)
                  col = xin > 0.68 ? fan.bodyD : fan.body;
              }
            }
          }
          if (y >= gt) col = glassTint(col);
        }
        if (outside) {
          // the near boards in front of the fan, and the glass above them over everything behind
          if (y >= nearTop)
            col = y >= nearBase ? ((y >> 2) & 1 ? NEARSEAT : NEARSEAT2) : y >= nearKick ? KICK : BOARD;
          else if (y >= nearGlass) col = glassTint(col);
        }
        buf3[y * CW + x] = col;
      }
    }
    const glc = useGL
      ? drawGL({
          W: CW,
          H: view.CH,
          camX,
          camY,
          h,
          Fx,
          Fy,
          Rx,
          Ry,
          f,
          hor,
          cxs,
          now,
          hype,
          outside,
          iceBuf: ib,
          fanTab,
          roof: S.roof,
          colors: {
            uKick: KICK,
            uBoard: BOARD,
            uStand: STAND,
            uSeat: SEAT,
            uNear1: NEARSEAT,
            uNear2: NEARSEAT2,
            uArena: ARENA,
            uRibbon: RIBBON,
            uSuite: SUITE,
            uMid: crowd.mid,
            uDark: crowd.dark,
          },
        })
      : null;
    if (glc) view.ctx.drawImage(glc, 0, 0);
    else if (!useGL) view.ctx.putImageData(img3, 0, 0);
    const fog = view.ctx.createLinearGradient(0, hor, 0, hor + view.CH * 0.25);
    if (fog) {
      fog.addColorStop(0, 'rgba(10,15,30,.35)');
      fog.addColorStop(1, 'rgba(10,15,30,0)');
      view.ctx.fillStyle = fog;
      view.ctx.fillRect(0, hor, view.CW, view.CH * 0.25);
    }
  }
  const proj = (wx, wy, wz) => {
    const ddx = wx - C3.x,
      ddy = wy - C3.y,
      d = ddx * Fx + ddy * Fy;
    if (d < 0.8) return null;
    const l = ddx * Rx + ddy * Ry;
    return { x: cxs + (l / d) * f, y: hor + ((h - (wz || 0)) * f) / d, s: f / d, d };
  };
  const rel = (e, fn) => {
    const ox = e.x,
      oy = e.y,
      ofx = e.fx,
      ofy = e.fy,
      ovx = e.vx,
      ovy = e.vy,
      a = ofx * Fx + ofy * Fy,
      b = ofx * Rx + ofy * Ry;
    e.x = 0;
    e.y = 0;
    e.fx = b;
    e.fy = -a;
    // velocity turns with the facing so poses that compare the two (skating backwards) stay right
    e.vx = ovx * Rx + ovy * Ry;
    e.vy = -(ovx * Fx + ovy * Fy);
    try {
      fn();
    } finally {
      e.x = ox;
      e.y = oy;
      e.fx = ofx;
      e.fy = ofy;
      e.vx = ovx;
      e.vy = ovy;
    }
  };
  // behind the menu nobody fills the frame: a skater coming that close to the lens fades out before they get there
  const nearFade = fr ? (fr.y0 != null ? fr.y1 - fr.y0 : view.CH) * NEAR_FADE : 0;
  const billboard = (draw, q) => {
    const sc = q.s / K;
    if (sc > 14) return;
    const fade = nearFade ? Math.min(1, (nearFade * 1.3 - SPR_H * sc) / (nearFade * 0.3)) : 1;
    if (fade <= 0) return;
    spx.setTransform(1, 0, 0, 1, 0, 0);
    spx.clearRect(0, 0, 48, 56);
    const save = view.ctx;
    view.ctx = spx;
    view.ctx.setTransform(1, 0, 0, 1, 24, 44);
    try {
      draw();
    } finally {
      view.ctx.setTransform(1, 0, 0, 1, 0, 0);
      view.ctx = save;
    }
    view.ctx.imageSmoothingEnabled = false;
    if (fade < 1) view.ctx.globalAlpha = fade;
    view.ctx.drawImage(
      SPC,
      Math.round(q.x - 24 * sc),
      Math.round(q.y - 44 * sc),
      Math.round(48 * sc),
      Math.round(56 * sc),
    );
    view.ctx.globalAlpha = 1;
  };
  if (buf3 && fanTab.length) {
    drawGlares(proj, roofLamps(STADIUMS[settings.stadiumKey]));
    drawScoreboard(view.ctx, proj, C3);
  }
  drawPyro3D(proj);
  const items = [];
  for (const p of players) items.push({ e: p, k: p.role, d: (p.x - C3.x) * Fx + (p.y - C3.y) * Fy });
  items.push({ e: ref, k: 'R', d: (ref.x - C3.x) * Fx + (ref.y - C3.y) * Fy });
  items.push({ e: puck, k: 'P', d: (puck.x - C3.x) * Fx + (puck.y - C3.y) * Fy - 0.3 });
  // each goal is split into panels and frame pieces, sorted with the players so overlaps come out right
  const cam = makeCam(C3, Fx, Fy, Rx, Ry, cxs, hor, f, h);
  for (const n of NETS)
    for (const part of goalParts(n, cam)) items.push({ k: 'N', d: part.d, draw: part.draw });
  items.sort((a, b) => b.d - a.d);
  for (const it of items) {
    const e = it.e;
    if (it.k === 'N') {
      it.draw();
      continue;
    }
    if (it.k === 'P') {
      if (puck.owner && puck.owner.role === 'G') continue;
      const q = proj(puck.x, puck.y, puck.z);
      if (q && q.d > 4)
        billboard(() => {
          R(-2, 2, 5, 1, SH);
          puckPixels(0, 0);
        }, q);
      continue;
    }
    const q = proj(e.x, e.y, 0);
    if (!q) continue;
    if (it.k === 'R') rel(e, () => billboard(drawRef, q));
    else rel(e, () => billboard(() => (e.role === 'G' ? drawGoalie(e) : drawSkater(e)), q));
  }
  // the puck carrier's badge, scaled with the distance like the sprites
  const o = puck.owner;
  if (o && G.state !== 'zamboni' && G.state !== 'brawl') {
    const q = proj(o.x, o.y, o.down > 0 ? 6 : 13.5);
    if (q && q.d > 3) {
      const sc = clamp(q.s / K, 1, 4);
      view.ctx.setTransform(sc, 0, 0, sc, Math.round(q.x), Math.round(q.y));
      puckBadge(0, Math.floor(clock.now * 4.5) & 1);
      view.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
  for (const p of parts) {
    const q = proj(p.x, p.y, 1);
    if (!q) continue;
    view.ctx.globalAlpha = Math.min(1, p.life * 3);
    view.ctx.fillStyle = p.c;
    const z = Math.max(1, Math.round(q.s * 0.35));
    view.ctx.fillRect(Math.round(q.x), Math.round(q.y - z * 2), z, z);
  }
  view.ctx.globalAlpha = 1;
  if (C3.guest) fanHeads(proj, C3, f, hor);
  cinema();
  if (overlay) replayOverlay();
}
// ---------- goals in 3D ----------
const NEAR = 0.6; // camera-space depth below which geometry is clipped away
/** World-to-camera helpers for the 3D replay: camera space is (l: right, d: forward, z: up). */
function makeCam(C3, Fx, Fy, Rx, Ry, cxs, hor, f, h) {
  const toCam = ([x, y, z]) => {
    const dx = x - C3.x,
      dy = y - C3.y;
    return { l: dx * Rx + dy * Ry, d: dx * Fx + dy * Fy, z };
  };
  const screen = c => ({ x: cxs + (c.l / c.d) * f, y: hor + ((h - c.z) * f) / c.d, s: f / c.d });
  const cut = (a, b) => {
    const t = (NEAR - a.d) / (b.d - a.d);
    return { l: a.l + (b.l - a.l) * t, d: NEAR, z: a.z + (b.z - a.z) * t };
  };
  return {
    depth: w => toCam(w).d,
    /** a world polygon clipped to the near plane, as screen points (empty when fully behind the camera) */
    poly(pts) {
      const c = pts.map(toCam),
        out = [];
      for (let i = 0; i < c.length; i++) {
        const a = c[i],
          b = c[(i + 1) % c.length];
        if (a.d >= NEAR) out.push(a);
        if (a.d >= NEAR !== b.d >= NEAR) out.push(cut(a, b));
      }
      return out.map(screen);
    },
    /** a world line segment clipped to the near plane, as two screen points or null */
    seg(p, q) {
      let a = toCam(p),
        b = toCam(q);
      if (a.d < NEAR && b.d < NEAR) return null;
      if (a.d < NEAR) a = cut(a, b);
      else if (b.d < NEAR) b = cut(b, a);
      return [screen(a), screen(b)];
    },
  };
}
const GOAL_H = 6.5, // crossbar height: about two thirds of a skater
  ROOF = 0.4; // share of the depth covered by the flat roof before the back net slopes down
const mixPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The goal as separately sorted pieces: four mesh panels, the base frame, the posts and the crossbar. */
function goalParts(n, cam) {
  const F = n.top ? n.y1 : n.y0,
    dir = n.top ? -1 : 1,
    B = F + dir * ND,
    M = F + dir * ND * ROOF,
    Ht = GOAL_H * 0.86,
    pFL = [n.x0, F, 0],
    pFR = [n.x1, F, 0],
    tFL = [n.x0, F, GOAL_H],
    tFR = [n.x1, F, GOAL_H],
    mL = [n.x0, M, Ht],
    mR = [n.x1, M, Ht],
    bL = [n.x0, B, 0],
    bR = [n.x1, B, 0];
  const g = () => view.ctx;
  const fillPoly = (pts, col, a) => {
    const q = cam.poly(pts);
    if (q.length < 3) return;
    g().globalAlpha = a;
    g().fillStyle = col;
    g().beginPath();
    q.forEach((p, i) => (i ? g().lineTo(p.x, p.y) : g().moveTo(p.x, p.y)));
    g().closePath();
    g().fill();
    g().globalAlpha = 1;
  };
  const line = (p, q, col, w, a = 1) => {
    const s = cam.seg(p, q);
    if (!s) return;
    g().globalAlpha = a;
    g().strokeStyle = col;
    g().lineWidth = Math.max(1, ((s[0].s + s[1].s) / 2) * w);
    g().lineCap = 'round';
    g().beginPath();
    g().moveTo(s[0].x, s[0].y);
    g().lineTo(s[1].x, s[1].y);
    g().stroke();
    g().globalAlpha = 1;
  };
  // a mesh panel between edges a0-a1 and b0-b1: translucent fabric plus a grid of strings both ways
  const mesh = (a0, a1, b1, b0, cols, rows) => {
    fillPoly([a0, a1, b1, b0], '#eef3f8', 0.45);
    for (let i = 1; i < cols; i++)
      line(mixPt(a0, a1, i / cols), mixPt(b0, b1, i / cols), '#8fa1b5', 0.09, 0.9);
    for (let j = 1; j < rows; j++)
      line(mixPt(a0, b0, j / rows), mixPt(a1, b1, j / rows), '#8fa1b5', 0.09, 0.9);
  };
  const part = (pts, draw) => ({ d: pts.reduce((s, p) => s + cam.depth(p), 0) / pts.length, draw });
  const parts = [
    part([mL, mR, bR, bL], () => mesh(mL, mR, bR, bL, 12, 4)), // back net
    part([tFL, tFR, mR, mL], () => mesh(tFL, tFR, mR, mL, 12, 2)), // roof
    part([pFL, tFL, mL, bL], () => {
      mesh(tFL, mL, bL, pFL, 3, 4); // left side net
    }),
    part([pFR, tFR, mR, bR], () => {
      mesh(tFR, mR, bR, pFR, 3, 4); // right side net
    }),
    part([pFL, bL, bR, pFR], () => {
      // base frame on the ice and the bar holding the back of the roof
      line(pFL, bL, '#e9eef4', 0.35);
      line(bL, bR, '#e9eef4', 0.35);
      line(bR, pFR, '#e9eef4', 0.35);
      line(mL, mR, '#e9eef4', 0.25);
    }),
    part([pFL, tFL], () => {
      line(pFL, tFL, '#8f1f28', 0.75);
      line(pFL, tFL, '#d8343f', 0.5);
    }),
    part([pFR, tFR], () => {
      line(pFR, tFR, '#8f1f28', 0.75);
      line(pFR, tFR, '#d8343f', 0.5);
    }),
    part([tFL, tFR], () => {
      line(tFL, tFR, '#8f1f28', 0.75);
      line(tFL, tFR, '#d8343f', 0.5);
      lamp3D(n, cam, B, dir);
    }),
  ];
  return parts;
}
function lamp3D(n, cam, B, dir) {
  const s = cam.seg([80, B + dir * 2, GOAL_H + 2.5], [80, B + dir * 2, GOAL_H + 2.5]);
  if (!s) return;
  const L = s[0],
    on = view.lamp && view.lamp.n === n && clock.now < view.lamp.until,
    lit = on && Math.floor(clock.now * 6) & 1,
    z = Math.max(2, L.s * 1.2);
  view.ctx.fillStyle = '#1b2030';
  view.ctx.fillRect(L.x - z, L.y - z * 0.6, z * 2, z * 1.2);
  view.ctx.fillStyle = lit ? '#ff3b3b' : on ? '#b52020' : '#4a1818';
  view.ctx.fillRect(L.x - z * 0.8, L.y - z * 0.4, z * 1.6, z * 0.8);
  if (lit) {
    view.ctx.globalAlpha = 0.3;
    view.ctx.fillStyle = '#ff3b3b';
    view.ctx.beginPath();
    view.ctx.arc(L.x, L.y, z * 3, 0, Math.PI * 2);
    view.ctx.fill();
    view.ctx.globalAlpha = 1;
  }
}
