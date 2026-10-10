import { GB, GT, IH, IW, K, ND, NETS, RR, RX0, RX1, RY0, RY1 } from '../config';
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
import { replayOverlay } from './overlays';
import { R } from './pixels';
import { drawGoalie, drawRef, drawSkater } from './players';
import { puckPixels } from './puck';
import { FAN_ROWS, FAN_SEATS, U32, fanTab } from './stands';
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
export function insideRinkW(x, y) {
  if (x < RX0 || x > RX1 || y < RY0 || y > RY1) return false;
  const cx = x < RX0 + RR ? RX0 + RR : x > RX1 - RR ? RX1 - RR : null,
    cy = y < RY0 + RR ? RY0 + RR : y > RY1 - RR ? RY1 - RR : null;
  return cx === null || cy === null || Math.hypot(x - cx, y - cy) <= RR;
}
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
  return { tx: side < 0 ? -18 : 178, ty: clamp(fy * 0.6 + 128 * 0.4, 50, 206), h: 17 };
}
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

/** Spectators' heads in the foreground of the fan cam; they jump and wave foam fingers when the crowd is loud. */
function fanHeads() {
  const g = view.ctx,
    n = 6,
    w = view.CW / n;
  for (let i = 0; i < n; i++) {
    const cx = Math.round(w * (i + 0.5) + Math.sin(i * 2.3) * w * 0.2),
      cheer = G.hype > 0.1 || (Math.sin(clock.now * 0.7 + i * 1.9) > 0.92 ? 1 : 0),
      jump = cheer ? Math.round(Math.abs(Math.sin(clock.now * 9 + i)) * w * 0.12) : 0,
      r = Math.round(w * 0.4),
      base = view.CH - Math.round(w * 0.15) - jump;
    g.fillStyle = '#05070d';
    g.fillRect(cx - r * 1.6, base, r * 3.2, view.CH - base); // shoulders
    g.beginPath();
    g.arc(cx, base - r * 0.6, r, 0, Math.PI * 2); // head
    g.fill();
    g.fillStyle = kit.TEAMS[i % 2].main;
    g.fillRect(cx - r, base - r * 1.6, r * 2, Math.round(r * 0.6)); // beanie in the teams' colours
    if (cheer && i % 2 === 0) {
      // a foam finger
      g.fillStyle = kit.TEAMS[0].main;
      g.fillRect(cx + r * 1.2, base - r * 3.4, r * 0.8, r * 2.6);
      g.fillRect(cx + r * 1.35, base - r * 4.4, r * 0.4, r);
    }
  }
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
function glassTint(c) {
  const r = c & 255,
    g = (c >> 8) & 255,
    b = (c >> 16) & 255;
  return (
    ((255 << 24) |
      (((b * 0.75 + 240 * 0.25) | 0) << 16) |
      (((g * 0.75 + 228 * 0.25) | 0) << 8) |
      ((r * 0.75 + 205 * 0.25) | 0)) >>>
    0
  );
}
/** Draws the 3D view from G.cam3. `overlay` adds the REPLAY label and letterbox bars. */
export function render3D(overlay = true) {
  const C3 = G.cam3 || { x: 80, y: 128, yaw: 0, h: 8.5 },
    f = view.CW * 0.65,
    cxs = view.CW / 2,
    hor = Math.round(view.CH * 0.4),
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
      ROOF = U32('#070a14'),
      LIGHT = U32('#fff4d6'),
      roofY = hor - Math.round(view.CH * 0.3),
      hype = G.hype;
    const crowd = crowdTone(),
      // the fan cam sits in the stands: rays first cross the near boards and glass, then the ice
      outside = !insideRinkW(C3.x, C3.y);
    let prevSeat = NaN;
    for (let x = 0; x < view.CW; x++) {
      const k = (x - cxs) / f,
        dx = Fx + Rx * k,
        dy = Fy + Ry * k;
      let t = 0.5,
        tIn = 0;
      if (outside) {
        while (t < 420 && !insideRinkW(C3.x + dx * t, C3.y + dy * t)) t += 1.2;
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
      while (t < 420 && insideRinkW(C3.x + dx * t, C3.y + dy * t)) t += 1.2;
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
      if (iceBuf && bx >= 0 && by >= 0 && bx < IW && by < IH) bcol = iceBuf[by * IW + bx];
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
      for (let r = 0; r <= ROWS; r++)
        rowY[r] = hor + ((h - (ROW_Z0 + r * ROW_DZ)) * f) / (t + ROW_D0 + r * ROW_DD);
      let r = 0;
      for (let y = view.CH - 1; y >= 0; y--) {
        let col;
        if (y > wb) {
          const tt = (h * f) / (y - hor),
            ix = ((C3.x + dx * tt) * K) | 0,
            iy = ((C3.y + dy * tt) * K) | 0;
          col = iceBuf && ix >= 0 && iy >= 0 && ix < IW && iy < IH ? iceBuf[iy * IW + ix] : ARENA;
        } else if (y >= kick) col = KICK;
        else if (y >= bt) col = bcol;
        else {
          while (r < ROWS && y < rowY[r + 1]) r++;
          if (y < rowY[ROWS]) col = u % 64 < 3 && y % 26 < 2 ? LIGHT : ROOF;
          else {
            const top = rowY[r + 1],
              bh = rowY[r] - top,
              fan = fanTab[seat * FAN_ROWS + (r % FAN_ROWS)];
            if (bh < 2 || tiny)
              col = r & 1 ? crowd.dark : crowd.mid; // too far for detail: an even crowd tone
            else {
              const bob = hype > 0.05 ? Math.sin(clock.now * 11 + fan.ph) * hype * 0.18 : 0,
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
        buf3[y * view.CW + x] = col;
      }
    }
    view.ctx.putImageData(img3, 0, 0);
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
      a = ofx * Fx + ofy * Fy,
      b = ofx * Rx + ofy * Ry;
    e.x = 0;
    e.y = 0;
    e.fx = b;
    e.fy = -a;
    try {
      fn();
    } finally {
      e.x = ox;
      e.y = oy;
      e.fx = ofx;
      e.fy = ofy;
    }
  };
  const billboard = (draw, q) => {
    const sc = q.s / K;
    if (sc > 14) return;
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
    view.ctx.drawImage(
      SPC,
      Math.round(q.x - 24 * sc),
      Math.round(q.y - 44 * sc),
      Math.round(48 * sc),
      Math.round(56 * sc),
    );
  };
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
  for (const p of parts) {
    const q = proj(p.x, p.y, 1);
    if (!q) continue;
    view.ctx.globalAlpha = Math.min(1, p.life * 3);
    view.ctx.fillStyle = p.c;
    const z = Math.max(1, Math.round(q.s * 0.35));
    view.ctx.fillRect(Math.round(q.x), Math.round(q.y - z * 2), z, z);
  }
  view.ctx.globalAlpha = 1;
  if (C3.guest) fanHeads();
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
