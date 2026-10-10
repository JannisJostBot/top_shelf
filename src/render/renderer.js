import { IH, IW, K, NETS } from '../config';
import { directorShot, liveLabel } from './director';
import { drawGoalFx } from './goalFx';
import { rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { puckStyle } from '../data/pucks';
import { frostAt, frostC, wetC } from '../game/iceWear';
import { kit } from '../game/kit';
import { live, players } from '../game/players';
import { G, parts, puck, ref } from '../game/world';
import { mouse } from '../input/state';
import { touchState } from '../input/touch';
import { SPARK, cinema, iceSheen, reflections, sparkles } from './atmosphere';
import { cam, cv, view } from './canvas';
import { AMB } from './colors';
import { drawBubbles, drawFx } from './effects';
import { drawFightHud, drawLitter } from './fight';
import { skateGrooves } from './grooves';
import { ice } from './ice';
import { broadcastCam, render3D, updDemoCam } from './mode7';
import { drawNet } from './net';
import { drawCtlBase, drawCtlTop, drawMini, drawOutlined, offscreenPuck, replayOverlay } from './overlays';
import { R } from './pixels';
import { drawGoalie, drawRef, drawSkater } from './players';
import { drawPuck, puckGround } from './puck';
import { drawStands } from './stands';
import { drawZamHud, drawZamboni } from './zamboni';

export function render() {
  kit.PS = puckStyle();
  // behind the main menu the CPU game is filmed with the 3D broadcast cameras
  if (G.demo) {
    updDemoCam();
    render3D(false);
    return;
  }
  // Watch mode is directed: cuts between top-down and 3D shots (goal replays keep their own angles)
  let liveName = null;
  if (G.watch && G.state !== 'replay') {
    const shot = directorShot();
    liveName = shot.name;
    if (shot.kind !== '2d') {
      broadcastCam(shot.kind, shot.fresh);
      render3D(false);
      liveLabel(liveName);
      return;
    }
    view.camZ = shot.zoom;
  }
  if (G.state === 'replay' && G.rp && G.rp.angle.mode7) {
    render3D();
    return;
  }
  view.ctx.setTransform(1, 0, 0, 1, 0, 0);
  view.ctx.fillStyle = '#0a0f1e';
  view.ctx.fillRect(0, 0, view.CW, view.CH);
  let ox = -Math.round(cam.x * K * view.camZ),
    oy = -Math.round(cam.y * K * view.camZ);
  if (G.shake > 0 && G.state !== 'replay') {
    ox += Math.round(rnd(-3, 3));
    oy += Math.round(rnd(-3, 3));
  }
  view.ctx.setTransform(view.camZ, 0, 0, view.camZ, ox, oy);
  drawStands();
  if (G.state === 'replay' && G.rp.angle.flip) {
    view.ctx.save();
    view.ctx.translate(IW, IH);
    view.ctx.scale(-1, -1);
    view.ctx.drawImage(ice, 0, 0);
    view.ctx.restore();
  } else view.ctx.drawImage(ice, 0, 0);
  if (!(G.state === 'replay' && G.rp.angle.flip)) {
    view.ctx.drawImage(frostC, 0, 0);
    if (G.state === 'zamboni') {
      view.ctx.globalAlpha = 0.55 + 0.15 * Math.sin(clock.now * 3);
      view.ctx.drawImage(wetC, 0, 0);
      view.ctx.globalAlpha = 1;
    }
  }
  const cine = G.state === 'replay';
  if (cine) {
    skateGrooves();
    iceSheen();
    reflections();
  }
  for (const n of NETS) drawNet(n);
  const showCtl = !G.ai0 && (G.state === 'play' || G.state === 'faceoff');
  const c = showCtl ? G.controlled : null;
  if (c !== view.lastCtl) {
    if (c && view.lastCtl) view.ctlFlash = 0.45;
    view.lastCtl = c;
  }
  view.ctlFlash = Math.max(0, view.ctlFlash - 1 / 60);
  if (c) drawCtlBase(c);
  drawLitter();
  puckGround();
  const items = G.state === 'zamboni' ? [] : players.filter(live).map(p => ({ y: p.y, p }));
  if (G.state !== 'zamboni') items.push({ y: ref.y, ref: true });
  items.sort((a, b) => a.y - b.y);
  const free = !puck.owner && puck.z <= 0;
  let drawn = puck.z > 0;
  for (const it of items) {
    if (free && !drawn && puck.y < it.y - 2) {
      drawPuck();
      drawn = true;
    }
    if (it.ref) drawRef();
    else {
      const p = it.p;
      if (p.role === 'G') drawGoalie(p);
      else if (p === c) drawOutlined(p);
      else drawSkater(p);
      if (puck.owner === p) {
        drawPuck();
        drawn = true;
      }
    }
  }
  if (G.state === 'zamboni') {
    drawn = true;
    drawZamboni();
    if (G.zam && G.zam.phase === 'drive')
      for (const sp of SPARK) {
        if (frostAt(sp.x, sp.y) > 0) continue;
        const tw = Math.sin(clock.now * sp.sp + sp.ph);
        if (tw > 0.8) {
          const x = toS(sp.x),
            y = toS(sp.y);
          R(x, y - 2, 1, 5, '#ffffff');
          R(x - 2, y, 5, 1, '#ffffff');
        }
      }
  } else if (!drawn || puck.z > 0) drawPuck();
  else if (!(puck.owner && puck.owner.role === 'G')) drawPuck(0.5);
  if (c) drawCtlTop(c);
  for (const p of parts) {
    view.ctx.globalAlpha = Math.min(1, p.life * 3);
    R(toS(p.x), toS(p.y), 2, 2, p.c);
  }
  view.ctx.globalAlpha = 1;
  drawFx();
  drawGoalFx();
  drawBubbles();
  if (cine) sparkles();
  view.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (cine) cinema();
  if (G.flash > 0) {
    view.ctx.globalAlpha = Math.min(0.22, G.flash * 1.8);
    view.ctx.fillStyle = '#ffffff';
    view.ctx.fillRect(0, 0, view.CW, view.CH);
    view.ctx.globalAlpha = 1;
  }
  if (G.state === 'play') offscreenPuck(ox, oy);
  const aim =
    mouse.on &&
    !touchState.touchUI &&
    !G.ai0 &&
    (G.state === 'play' || G.state === 'faceoff' || G.state === 'zamboni');
  if (aim) {
    const x = Math.round(mouse.sx),
      y = Math.round(mouse.sy);
    for (const [dx, dy, w, h] of [
      [-6, -1, 4, 3],
      [3, -1, 4, 3],
      [-1, -6, 3, 4],
      [-1, 3, 3, 4],
    ])
      R(x + dx, y + dy, w, h, '#0b0f1a');
    R(x - 5, y, 3, 1, AMB);
    R(x + 3, y, 3, 1, AMB);
    R(x, y - 5, 1, 3, AMB);
    R(x, y + 3, 1, 3, AMB);
    R(x, y, 1, 1, '#ffffff');
  }
  const cur = aim ? 'none' : '';
  if (cv.style.cursor !== cur) cv.style.cursor = cur;
  if (G.state === 'replay') replayOverlay();
  else if (G.state === 'brawl') drawFightHud();
  else if (G.state === 'zamboni') drawZamHud();
  else drawMini();
  if (liveName) liveLabel(liveName);
}
