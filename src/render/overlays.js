import { GB, GT, H, K, W } from '../config';
import { STADIUMS } from '../data/stadiums';
import { settings } from '../settings';
import { clamp, toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { players } from '../game/players';
import { G, puck } from '../game/world';
import { cam, view } from './canvas';
import { AMB, AMB_D } from './colors';
import { R, disc, ellipsePx } from './pixels';
import { drawSkater } from './players';

export function drawCtlBase(g, c) {
  const x = toS(c.x),
    y = toS(c.y) + 1;
  g.globalAlpha = 0.35;
  disc(g, x, y, 13, 4, AMB);
  g.globalAlpha = 1;
  ellipsePx(g, x, y, 13, 5, AMB);
  ellipsePx(g, x, y, 12, 4, AMB);
  if (view.ctlFlash > 0) {
    const k = 1 - view.ctlFlash / 0.45;
    g.globalAlpha = view.ctlFlash / 0.45;
    ellipsePx(g, x, y, 13 + k * 18, 5 + k * 9, AMB);
    g.globalAlpha = 1;
  }
}
export function drawCtlTop(g, c) {
  const x = toS(c.x),
    y = toS(c.y),
    bob = Math.floor(clock.now * 4.5) & 1 ? 2 : 0,
    ay = (c.down > 0 ? y - 22 : y - 34) + bob;
  R(g, x - 7, ay - 1, 15, 1, AMB_D);
  for (let i = 0; i < 7; i++) {
    const hw = 6 - i;
    R(g, x - hw, ay + i, hw * 2 + 1, 1, AMB);
    R(g, x - hw - 1, ay + i, 1, 1, AMB_D);
    R(g, x + hw + 1, ay + i, 1, 1, AMB_D);
  }
  R(g, x, ay + 7, 1, 1, AMB_D);
  // carrying the puck: the puck badge sits in the top of the marker arrow, one combined shape
  const has = puck.owner === c,
    up = has ? 6 : 0;
  if (has) puckBadge(g, x, ay - 6, false);
  if (G.charging && has) {
    const k = G.charge / 0.7;
    R(g, x - 12, ay - 8 - up, 25, 5, '#0a0f1e');
    R(g, x - 11, ay - 7 - up, Math.max(1, Math.round(23 * k)), 3, k > 0.95 ? '#ef4b52' : AMB);
  }
  if (c.checkCd > 0 && c.checkT <= 0) {
    const k = clamp(c.checkCd / 1.4, 0, 1);
    R(g, x - 8, ay - 4 - up, 17, 2, '#0a0f1e');
    R(g, x - 8, ay - 4 - up, Math.round(17 * (1 - k)), 2, '#ff5a3c');
  }
}
/** A small puck badge bobbing over the head of whoever carries the puck (any team, CPU or not). */
export function drawPossession(g, p) {
  const x = toS(p.x),
    y = toS(p.y),
    bob = Math.floor(clock.now * 4.5 + 1) & 1 ? 1 : 0,
    by = (p.down > 0 ? y - 22 : y - 33) + bob;
  puckBadge(g, x, by);
}
// the badge: a puck seen from above at an angle (top face, rim and highlight) in a white outline, with a
// pointer under it; W white outline, O dark edge, T top face, t highlight, S side
const BADGE = [
  '...WWWWWWW...',
  '..WOOOOOOOW..',
  '.WOTTtttTTOW.',
  '.WOTTTTTTTOW.',
  '.WOSSSSSSSOW.',
  '..WOOOOOOOW..',
  '...WWWOWWW...',
  '.....WOW.....',
  '......W......',
];
const BADGE_C = { W: '#f2f4f7', O: '#0b0f1a', T: '#3a4258', t: '#8d9ab8', S: '#151a26' };
/** The puck-carrier badge centred on x with its top at y; without `pointer` just the puck. */
export function puckBadge(g, x, y, pointer = true) {
  for (let r = 0; r < (pointer ? BADGE.length : 6); r++)
    for (let c = 0; c < BADGE[r].length; c++) {
      const ch = BADGE[r][c];
      if (ch !== '.') R(g, x - 6 + c, y + r, 1, 1, BADGE_C[ch]);
    }
}
const BOLT = [
  [1, 0, 2],
  [0, 1, 2],
  [0, 2, 3],
  [1, 3, 2],
  [1, 4, 1],
];
/** A skater of the team with a speed buff: a small blinking bolt beside them and streaks behind when moving. */
export function drawBuffed(g, p) {
  const x = toS(p.x),
    y = toS(p.y),
    sp = Math.hypot(p.vx, p.vy);
  if (sp > 12) {
    const ux = -p.vx / sp,
      uy = -p.vy / sp;
    for (let i = 0; i < 3; i++) {
      const d = 9 + i * 4 + ((clock.now * 40 + i * 3) % 4),
        lx = Math.round(x + ux * d + (i - 1) * uy * 4),
        ly = Math.round(y - 8 + uy * d - (i - 1) * ux * 4);
      g.globalAlpha = 0.6 - i * 0.15;
      R(g, lx - 1, ly, 3, 1, i ? '#ffffff' : '#ffc845');
    }
    g.globalAlpha = 1;
  }
  if (Math.floor(clock.now * 3) & 1) return;
  const bx = x + 7,
    by = y - 15;
  for (const [cx, cy, w] of BOLT) {
    R(g, bx + cx - 1, by + cy, w + 2, 1, '#0b0f1a');
  }
  R(g, bx, by - 1, 3, 1, '#0b0f1a');
  R(g, bx, by + 5, 2, 1, '#0b0f1a');
  for (const [cx, cy, w] of BOLT) R(g, bx + cx, by + cy, w, 1, '#ffc845');
}
export function drawOutlined(g, p) {
  view.sil = AMB;
  for (const [ox, oy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ]) {
    g.save();
    g.translate(ox, oy);
    drawSkater(g, p);
    g.restore();
  }
  view.sil = null;
  drawSkater(g, p);
}
export function drawMini(g) {
  const vw = view.CW / K,
    vh = view.CH / K;
  if (vw >= W && vh - G.padWorld >= H) return;
  const m = 0.2,
    mw = Math.round(W * m),
    mh = Math.round(H * m),
    x0 = view.CW - mw - 5,
    y0 = 5 + view.topInset;
  g.globalAlpha = 0.8;
  R(g, x0 - 2, y0 - 2, mw + 4, mh + 4, '#0a0f1e');
  g.globalAlpha = 0.9;
  R(g, x0, y0, mw, mh, '#d6e3ee');
  g.globalAlpha = 1;
  const L = STADIUMS[settings.stadiumKey].lines; // the arena's own line colours
  R(g, x0, y0 + Math.round(128 * m), mw, 1, L.red);
  R(g, x0, y0 + Math.round(96 * m), mw, 1, L.blue);
  R(g, x0, y0 + Math.round(160 * m), mw, 1, L.blue);
  R(g, x0 + Math.round(67 * m), y0 + Math.round(GT * m) - 1, Math.round(26 * m), 1, L.red);
  R(g, x0 + Math.round(67 * m), y0 + Math.round(GB * m) + 1, Math.round(26 * m), 1, L.red);
  const vis = vh - G.padWorld,
    rx = x0 + Math.round(Math.max(0, cam.x) * m),
    ry = y0 + Math.round(Math.max(0, cam.y) * m),
    rw = Math.round(Math.min(vw, W) * m),
    rh = Math.round(clamp(Math.min(vis, H - Math.max(0, cam.y)), 4, H) * m);
  g.globalAlpha = 0.85;
  R(g, rx, ry, rw, 1, AMB);
  R(g, rx, ry + rh - 1, rw, 1, AMB);
  R(g, rx, ry, 1, rh, AMB);
  R(g, rx + rw - 1, ry, 1, rh, AMB);
  g.globalAlpha = 1;
  for (const p of players) {
    if (p.benched) continue;
    const c = p === G.controlled && !G.ai0 ? AMB_D : kit.TEAMS[p.team].mini;
    R(g, x0 + Math.round(p.x * m) - 1, y0 + Math.round(p.y * m) - 1, 3, 3, c);
  }
  R(g, x0 + Math.round(puck.x * m) - 1, y0 + Math.round(puck.y * m) - 1, 3, 3, kit.PS.dk);
  R(g, x0 + Math.round(puck.x * m), y0 + Math.round(puck.y * m), 1, 1, kit.PS.r);
}
export function offscreenPuck(g, ox, oy) {
  const px = toS(puck.x) + ox,
    py = toS(puck.y) + oy,
    M = 8,
    bottom = view.CH - Math.round(G.padWorld * K) - M;
  const top = M + view.topInset;
  if (px >= M && px <= view.CW - M && py >= top && py <= bottom) return;
  const x = clamp(px, M, view.CW - M),
    y = clamp(py, top, Math.max(top, bottom));
  R(g, x - 3, y - 4, 7, 9, kit.PS.dk);
  R(g, x - 4, y - 3, 9, 7, kit.PS.dk);
  R(g, x - 2, y - 3, 5, 7, kit.PS.r);
  R(g, x - 3, y - 2, 7, 5, kit.PS.r);
  R(g, x - 1, y - 1, 3, 3, kit.PS.b);
}
export function replayOverlay(g) {
  g.globalAlpha = 0.85;
  R(g, 0, 0, view.CW, 7, '#05070d');
  R(g, 0, view.CH - 7, view.CW, 7, '#05070d');
  g.globalAlpha = 1;
  const blink = Math.floor(clock.now * 2.5) & 1;
  const label = 'REPLAY · ' + G.rp.angle.name;
  g.font = '7px "Press Start 2P", monospace';
  const tw = Math.ceil((g.measureText(label) || { width: 90 }).width) + 22,
    y0 = view.CH - 30;
  R(g, 6, y0, tw, 13, 'rgba(5,7,13,.8)');
  if (blink) disc(g, 13, y0 + 6, 3, 3, '#ff3b3b');
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.fillText(label, 19, y0 + 7);
  const k = (G.rp.i - G.rp.i0) / Math.max(1, G.rp.end - G.rp.i0);
  R(g, 6, y0 + 15, tw, 2, '#28365a');
  R(g, 6, y0 + 15, Math.round(tw * clamp(k, 0, 1)), 2, '#ff3b3b');
}
