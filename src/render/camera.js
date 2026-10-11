import { GB, GT, H, K, W } from '../config';
import { $ } from '../core/dom';
import { clamp, lerp } from '../core/math';
import { G, puck } from '../game/world';
import { pad } from '../input/touch';
import { cam, cv, view } from './canvas';
import { M } from './stands';
import { settings } from '../settings';

/* ---------- camera (keeps the action above the floating controls) ---------- */
export function updCam(dt, snap) {
  const vw = view.CW / (K * view.camZ),
    vh = view.CH / (K * view.camZ),
    vis = Math.max(30, vh - G.padWorld / view.camZ);
  let tx = puck.x + puck.vx * 0.25,
    ty = puck.y + puck.vy * 0.25;
  if (G.state === 'celebrate' && G.cel) {
    tx = G.cel.meet.x;
    ty = G.cel.meet.y;
  }
  if (G.state === 'brawl' && G.br) {
    tx = G.br.m.x;
    ty = G.br.m.y - 4;
  }
  if (G.state === 'zamboni' && G.zam) {
    tx = G.zam.x;
    ty = G.zam.y;
  }
  if (G.state === 'replay' && G.rp.angle.goal && G.lastNet) {
    let gx = 80,
      gy = G.lastNet.top ? GT + 14 : GB - 14;
    if (G.rp.angle.flip) {
      gx = W - gx;
      gy = H - gy;
    }
    tx = lerp(gx, puck.x, 0.25);
    ty = lerp(gy, puck.y, 0.25);
  }
  if (G.controlled && !G.ai0 && G.state !== 'replay') {
    tx = lerp(tx, G.controlled.x, 0.3);
    ty = lerp(ty, G.controlled.y, 0.3);
  }
  if (puck.owner && G.state !== 'replay') ty += puck.owner.team === 0 ? -14 : 14;
  if (G.state === 'replay' && G.rp.angle.puck) {
    tx = puck.x;
    ty = puck.y;
  }
  const cx = vw >= W + 2 * M ? (W - vw) / 2 : clamp(tx - vw / 2, -M, W - vw + M);
  const cy = vis >= H + 2 * M ? (H - vis) / 2 : clamp(ty - vis / 2, -M, H - vis + M);
  const k = snap ? 1 : 1 - Math.exp(-(G.state === 'replay' && G.rp.angle.puck ? 14 : 5) * dt);
  cam.x += (cx - cam.x) * k;
  cam.y += (cy - cam.y) * k;
}

/* ---------- sizing & loop ---------- */
const stage = $('stage');
export function fit() {
  const r = stage.getBoundingClientRect();
  if (r.width < 20 || r.height < 20) return;
  // close follows the play, wide shows the rink from board to board, arena adds the stands on both sides
  const nw = (settings.viewMode === 'close' ? 112 : settings.viewMode === 'arena' ? W + 2 * M : W) * K,
    nh = clamp(Math.round((nw * r.height) / r.width), 64, 1200);
  if (nw !== view.CW || nh !== view.CH) {
    view.CW = nw;
    view.CH = nh;
    cv.width = view.CW;
    cv.height = view.CH;
    view.ctx = cv.getContext('2d');
    view.ctx.imageSmoothingEnabled = false;
  }
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
  G.padWorld = pad.hidden ? 0 : (pad.offsetHeight * (view.CW / r.width)) / K;
  const hud = $('hud');
  view.topInset = hud ? Math.round((hud.offsetTop + hud.offsetHeight) * (view.CW / r.width)) : 0;
  updCam(0, true);
}
export function initCamera() {
  addEventListener('resize', fit);
  new ResizeObserver(fit).observe(stage);
}
