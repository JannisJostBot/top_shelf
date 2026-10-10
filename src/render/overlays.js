import { GB, GT, H, K, W } from '../config';
import { clamp, toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { players } from '../game/players';
import { G, puck } from '../game/world';
import { cam, view } from './canvas';
import { AMB, AMB_D } from './colors';
import { R, disc, ellipsePx } from './pixels';
import { drawSkater } from './players';

export function drawCtlBase(c) {
  const x = toS(c.x),
    y = toS(c.y) + 1;
  view.ctx.globalAlpha = 0.35;
  disc(x, y, 13, 4, AMB);
  view.ctx.globalAlpha = 1;
  ellipsePx(x, y, 13, 5, AMB);
  ellipsePx(x, y, 12, 4, AMB);
  if (view.ctlFlash > 0) {
    const k = 1 - view.ctlFlash / 0.45;
    view.ctx.globalAlpha = view.ctlFlash / 0.45;
    ellipsePx(x, y, 13 + k * 18, 5 + k * 9, AMB);
    view.ctx.globalAlpha = 1;
  }
}
export function drawCtlTop(c) {
  const x = toS(c.x),
    y = toS(c.y),
    bob = Math.floor(clock.now * 4.5) & 1 ? 2 : 0,
    ay = (c.down > 0 ? y - 22 : y - 34) + bob;
  R(x - 7, ay - 1, 15, 1, AMB_D);
  for (let i = 0; i < 7; i++) {
    const hw = 6 - i;
    R(x - hw, ay + i, hw * 2 + 1, 1, AMB);
    R(x - hw - 1, ay + i, 1, 1, AMB_D);
    R(x + hw + 1, ay + i, 1, 1, AMB_D);
  }
  R(x, ay + 7, 1, 1, AMB_D);
  if (G.charging && puck.owner === c) {
    const k = G.charge / 0.7;
    R(x - 12, ay - 8, 25, 5, '#0a0f1e');
    R(x - 11, ay - 7, Math.max(1, Math.round(23 * k)), 3, k > 0.95 ? '#ef4b52' : AMB);
  }
  if (c.checkCd > 0 && c.checkT <= 0) {
    const k = clamp(c.checkCd / 1.4, 0, 1);
    R(x - 8, ay - 4, 17, 2, '#0a0f1e');
    R(x - 8, ay - 4, Math.round(17 * (1 - k)), 2, '#ff5a3c');
  }
}
export function drawOutlined(p) {
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
    view.ctx.save();
    view.ctx.translate(ox, oy);
    drawSkater(p);
    view.ctx.restore();
  }
  view.sil = null;
  drawSkater(p);
}
export function drawMini() {
  const vw = view.CW / K,
    vh = view.CH / K;
  if (vw >= W && vh - G.padWorld >= H) return;
  const m = 0.2,
    mw = Math.round(W * m),
    mh = Math.round(H * m),
    x0 = view.CW - mw - 5,
    y0 = 5 + view.topInset;
  view.ctx.globalAlpha = 0.8;
  R(x0 - 2, y0 - 2, mw + 4, mh + 4, '#0a0f1e');
  view.ctx.globalAlpha = 0.9;
  R(x0, y0, mw, mh, '#d6e3ee');
  view.ctx.globalAlpha = 1;
  R(x0, y0 + Math.round(128 * m), mw, 1, '#d8343f');
  R(x0, y0 + Math.round(96 * m), mw, 1, '#2f6bd8');
  R(x0, y0 + Math.round(160 * m), mw, 1, '#2f6bd8');
  R(x0 + Math.round(67 * m), y0 + Math.round(GT * m) - 1, Math.round(26 * m), 1, '#d8343f');
  R(x0 + Math.round(67 * m), y0 + Math.round(GB * m) + 1, Math.round(26 * m), 1, '#d8343f');
  const vis = vh - G.padWorld,
    rx = x0 + Math.round(Math.max(0, cam.x) * m),
    ry = y0 + Math.round(Math.max(0, cam.y) * m),
    rw = Math.round(Math.min(vw, W) * m),
    rh = Math.round(clamp(Math.min(vis, H - Math.max(0, cam.y)), 4, H) * m);
  view.ctx.globalAlpha = 0.85;
  R(rx, ry, rw, 1, AMB);
  R(rx, ry + rh - 1, rw, 1, AMB);
  R(rx, ry, 1, rh, AMB);
  R(rx + rw - 1, ry, 1, rh, AMB);
  view.ctx.globalAlpha = 1;
  for (const p of players) {
    if (p.benched) continue;
    const c = p === G.controlled && !G.ai0 ? AMB_D : kit.TEAMS[p.team].mini;
    R(x0 + Math.round(p.x * m) - 1, y0 + Math.round(p.y * m) - 1, 3, 3, c);
  }
  R(x0 + Math.round(puck.x * m) - 1, y0 + Math.round(puck.y * m) - 1, 3, 3, kit.PS.dk);
  R(x0 + Math.round(puck.x * m), y0 + Math.round(puck.y * m), 1, 1, kit.PS.r);
}
export function offscreenPuck(ox, oy) {
  const px = toS(puck.x) + ox,
    py = toS(puck.y) + oy,
    M = 8,
    bottom = view.CH - Math.round(G.padWorld * K) - M;
  const top = M + view.topInset;
  if (px >= M && px <= view.CW - M && py >= top && py <= bottom) return;
  const x = clamp(px, M, view.CW - M),
    y = clamp(py, top, Math.max(top, bottom));
  R(x - 3, y - 4, 7, 9, kit.PS.dk);
  R(x - 4, y - 3, 9, 7, kit.PS.dk);
  R(x - 2, y - 3, 5, 7, kit.PS.r);
  R(x - 3, y - 2, 7, 5, kit.PS.r);
  R(x - 1, y - 1, 3, 3, kit.PS.b);
}
export function replayOverlay() {
  view.ctx.globalAlpha = 0.85;
  R(0, 0, view.CW, 7, '#05070d');
  R(0, view.CH - 7, view.CW, 7, '#05070d');
  view.ctx.globalAlpha = 1;
  const blink = Math.floor(clock.now * 2.5) & 1;
  const label = 'REPLAY · ' + G.rp.angle.name;
  view.ctx.font = '7px "Press Start 2P", monospace';
  const tw = Math.ceil((view.ctx.measureText(label) || { width: 90 }).width) + 22,
    y0 = view.CH - 30;
  R(6, y0, tw, 13, 'rgba(5,7,13,.8)');
  if (blink) disc(13, y0 + 6, 3, 3, '#ff3b3b');
  view.ctx.fillStyle = '#ffffff';
  view.ctx.textBaseline = 'middle';
  view.ctx.fillText(label, 19, y0 + 7);
  const k = (G.rp.i - G.rp.i0) / Math.max(1, G.rp.end - G.rp.i0);
  R(6, y0 + 15, tw, 2, '#28365a');
  R(6, y0 + 15, Math.round(tw * clamp(k, 0, 1)), 2, '#ff3b3b');
}
