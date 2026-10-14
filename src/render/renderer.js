import { IH, IW, K, NETS } from '../config';
import { drawPyro } from './pyro';
import { camToastOn, directorShot, liveLabel } from './director';
import { settings } from '../settings';
import { drawGoalFx } from './goalFx';
import { rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { puckStyle } from '../data/pucks';
import { frostAt } from '../game/iceWear';
import { frostC, wetC } from './iceWear';
import { kit } from '../game/kit';
import { live, players } from '../game/players';
import { G, parts, puck, ref } from '../game/world';
import { mouse } from '../input/state';
import { touchState } from '../input/touch';
import { SPARK, cinema, iceSheen, reflections, sparkles, spotlights } from './atmosphere';
import { cam, cv, view } from './canvas';
import { AMB } from './colors';
import { drawBubbles, drawFx } from './effects';
import { drawFightHud, drawLitter } from './fight';
import { skateGrooves } from './grooves';
import { ice } from './ice';
import { broadcastCam, render3D, updDemoCam } from './mode7';
import { drawNet } from './net';
import { drawIntro } from './intro';
import {
  drawCtlBase,
  drawCtlTop,
  drawMini,
  drawPossession,
  drawBuffed,
  drawOutlined,
  offscreenPuck,
  replayOverlay,
} from './overlays';
import { R } from './pixels';
import { drawGoalie, drawRef, drawSkater } from './players';
import { drawPuck, puckGround } from './puck';
import {
  odBehind,
  odFrame,
  odFront,
  odFrozen,
  odIce,
  odLens,
  odNets,
  odPost,
  odStands,
  odTop,
} from './overdrive';
import { drawStands, syncFans } from './stands';
import { drawZamHud, drawZamboni } from './zamboni';

// On phones the menu (and the result) show the 3D arena through a window in the program: the view is framed to it.
// On desktop the program stands in front of the arena: the shot is centred in the open space beside it.
// (Measured every half second, not every frame, as it only moves when the layout does.)
let frameAt = -Infinity;
function frameMenuWindow() {
  if (clock.now - frameAt < 0.5) return;
  frameAt = clock.now;
  const c = cv.getBoundingClientRect();
  if (document.body.classList.contains('wide')) {
    const sheet = document.querySelector('#menu:not([hidden]) .prog, #overOv:not([hidden]) .prog');
    view.frame = null;
    if (!sheet || !c.width) return;
    const s = sheet.getBoundingClientRect(),
      left = s.left - c.left,
      right = c.right - s.right,
      k = view.CW / c.width;
    // (when neither side has a useful amount of room, the shot keeps the middle)
    if (Math.max(left, right) > c.width * 0.3)
      view.frame = { cx: (left >= right ? left / 2 : c.width - right / 2) * k };
    return;
  }
  const win = document.querySelector(
    '#menu:not([hidden]) .ppage.home:not([hidden]) .pwin, #overOv:not([hidden]) .pwin',
  );
  if (!win) {
    view.frame = null;
    return;
  }
  const w = win.getBoundingClientRect(),
    k = view.CH / (c.height || 1);
  view.frame = { y0: (w.top - c.top) * k, y1: (w.bottom - c.top) * k };
}
export function render() {
  const g = view.ctx; // the main canvas: everything below draws into it
  // overdrive: a big hit holds the picture for a few frames; the extras need the frame's time and events first
  if (odFrozen()) return;
  odFrame();
  drawFrame(g);
  odPost(g);
}
function drawFrame(g) {
  kit.PS = puckStyle();
  syncFans();
  if (!G.demo && !(G.state === 'over' && G.post)) view.frame = null; // matches use the whole view
  // after the final whistle: b-roll of the arena behind the results card, filmed like the menu background
  if (G.state === 'over' && G.post) {
    frameMenuWindow();
    updDemoCam();
    render3D(g, false);
    return;
  }
  // the arena intro before the opening face-off
  if (G.state === 'intro' && G.intro) {
    drawIntro(g);
    return;
  }
  // behind the main menu the CPU game is filmed with the 3D broadcast cameras
  if (G.demo) {
    frameMenuWindow();
    updDemoCam();
    render3D(g, false);
    return;
  }
  // Watch mode is directed: cuts between top-down and 3D shots (goal replays keep their own angles)
  let liveName = null;
  if (G.watch && settings.watchCam === 'cine' && G.state !== 'replay') {
    const shot = directorShot();
    liveName = shot.name;
    if (shot.kind !== '2d') {
      broadcastCam(shot.kind, shot.fresh);
      render3D(g, false);
      liveLabel(g, liveName);
      return;
    }
    view.camZ = shot.zoom;
  }
  if (G.state === 'replay' && G.rp && G.rp.angle.mode7) {
    render3D(g);
    return;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#0a0f1e';
  g.fillRect(0, 0, view.CW, view.CH);
  let ox = -Math.round(cam.x * K * view.camZ),
    oy = -Math.round(cam.y * K * view.camZ),
    shx = 0,
    shy = 0;
  if (G.shake > 0 && G.state !== 'replay') {
    shx = Math.round(rnd(-3, 3));
    shy = Math.round(rnd(-3, 3));
    ox += shx;
    oy += shy;
  }
  g.setTransform(view.camZ, 0, 0, view.camZ, ox, oy);
  // Sprites sit on the world's pixel grid (toS), which the zoom scales up, while the camera moves by single screen
  // pixels; the two roundings beat against each other, so a sprite moving along with the camera would flick back
  // and forth by up to a zoom step (very visible in slow-motion replays). Each one is nudged, by whole screen
  // pixels, to where its exact position falls on the screen. `at(e, fn)` draws with that nudge.
  const z = view.camZ,
    exX = -cam.x * K * z + shx,
    exY = -cam.y * K * z + shy,
    at = (e, fn) => {
      const dx = Math.round(z * K * e.x + exX) - (z * toS(e.x) + ox),
        dy = Math.round(z * K * e.y + exY) - (z * toS(e.y) + oy);
      if (!dx && !dy) return fn();
      g.translate(dx / z, dy / z);
      fn();
      g.translate(-dx / z, -dy / z);
    };
  drawStands(g);
  odStands(g);
  drawPyro(g);
  if (G.state === 'replay' && G.rp.angle.flip) {
    g.save();
    g.translate(IW, IH);
    g.scale(-1, -1);
    g.drawImage(ice, 0, 0);
    g.restore();
  } else g.drawImage(ice, 0, 0);
  if (!(G.state === 'replay' && G.rp.angle.flip)) {
    g.drawImage(frostC, 0, 0);
    if (G.state === 'zamboni') {
      g.globalAlpha = 0.55 + 0.15 * Math.sin(clock.now * 3);
      g.drawImage(wetC, 0, 0);
      g.globalAlpha = 1;
    }
  }
  const cine = G.state === 'replay',
    // overdrive brings the replay's sheen, reflections and sparkles to live play
    od = settings.overdrive,
    shine = cine || (od && G.state !== 'zamboni');
  odIce(g);
  if (cine) skateGrooves(g);
  if (shine) {
    iceSheen(g);
    reflections(g);
  }
  for (const n of NETS) drawNet(g, n);
  odNets(g);
  const showCtl = !G.ai0 && (G.state === 'play' || G.state === 'faceoff');
  const c = showCtl ? G.controlled : null;
  if (c !== view.lastCtl) {
    if (c && view.lastCtl) view.ctlFlash = 0.45;
    view.lastCtl = c;
  }
  view.ctlFlash = Math.max(0, view.ctlFlash - 1 / 60);
  if (c) at(c, () => drawCtlBase(g, c));
  drawLitter(g);
  if (G.state !== 'zamboni') at(puck.owner || puck, () => puckGround(g)); // the puck is put away while the ice is resurfaced
  const items = G.state === 'zamboni' ? [] : players.filter(live).map(p => ({ y: p.y, p }));
  if (G.state !== 'zamboni') items.push({ y: ref.y, ref: true });
  items.sort((a, b) => a.y - b.y);
  const free = !puck.owner && puck.z <= 0;
  let drawn = puck.z > 0;
  for (const it of items) {
    if (free && !drawn && puck.y < it.y - 2) {
      at(puck, () => drawPuck(g));
      drawn = true;
    }
    if (it.ref) at(ref, () => drawRef(g));
    else {
      const p = it.p;
      // the player, its boost glow and a carried puck move together
      at(p, () => {
        odBehind(g, p);
        if (p.role === 'G') drawGoalie(g, p);
        else if (p === c) drawOutlined(g, p);
        else drawSkater(g, p);
        // (not in replays: they show play from before the boost)
        if (
          G.state !== 'replay' &&
          G.mom &&
          G.mom.t > 0 &&
          G.mom.team === p.team &&
          p.role !== 'G' &&
          p.down <= 0
        )
          drawBuffed(g, p);
        odFront(g, p);
        if (puck.owner === p) {
          drawPuck(g);
          drawn = true;
        }
      });
    }
  }
  if (G.state === 'zamboni') {
    drawn = true;
    if (G.zam2) at(G.zam2, () => drawZamboni(g, G.zam2));
    if (G.zam) at(G.zam, () => drawZamboni(g, G.zam));
    if (G.zam && G.zam.phase === 'drive')
      for (const sp of SPARK) {
        if (frostAt(sp.x, sp.y) > 0) continue;
        const tw = Math.sin(clock.now * sp.sp + sp.ph);
        if (tw > 0.8) {
          const x = toS(sp.x),
            y = toS(sp.y);
          R(g, x, y - 2, 1, 5, '#ffffff');
          R(g, x - 2, y, 5, 1, '#ffffff');
        }
      }
  } else if (!drawn || puck.z > 0) at(puck.owner || puck, () => drawPuck(g));
  else if (!(puck.owner && puck.owner.role === 'G')) at(puck.owner || puck, () => drawPuck(g, 0.5));
  if (c) at(c, () => drawCtlTop(g, c));
  if (puck.owner && puck.owner !== c && G.state !== 'zamboni' && G.state !== 'brawl')
    at(puck.owner, () => drawPossession(g, puck.owner));
  for (const p of parts) {
    const a = Math.min(1, p.life * 3);
    g.globalAlpha = a;
    R(g, toS(p.x), toS(p.y), 2, 2, p.c);
    if (od) {
      // a fading tail behind each particle
      g.globalAlpha = a * 0.45;
      R(g, toS(p.x - p.vx * 0.03), toS(p.y - p.vy * 0.03), 1, 1, p.c);
    }
  }
  g.globalAlpha = 1;
  drawFx(g);
  drawGoalFx(g);
  odTop(g);
  drawBubbles(g);
  if (shine) sparkles(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (cine) cinema(g);
  else if (od) spotlights(g, 0.07); // (fainter in live play than in replays)
  if (G.flash > 0) {
    g.globalAlpha = Math.min(0.22, G.flash * 1.8);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, view.CW, view.CH);
    g.globalAlpha = 1;
  }
  if (G.state === 'play') offscreenPuck(g, ox, oy);
  const aim =
    mouse.on &&
    !touchState.touchUI &&
    !G.ai0 &&
    (G.state === 'play' || G.state === 'faceoff' || G.state === 'zamboni');
  if (aim) {
    // the aim pointer: a small triangle where the mouse has pushed the aim, pointing in the steering direction
    const me = G.state === 'zamboni' && G.zam ? G.zam : G.controlled;
    if (me) {
      const z = view.camZ,
        cx = toS(me.x) * z + ox,
        cy = (toS(me.y) - 8) * z + oy,
        r = 18 * z,
        m = Math.hypot(mouse.vx, mouse.vy) || 1,
        ax = mouse.vx / m,
        ay = mouse.vy / m,
        kx = cx + mouse.vx * r,
        ky = cy + mouse.vy * r,
        tri = s => {
          // tip ahead in the aim direction, the two back corners to either side
          g.beginPath();
          g.moveTo(kx + ax * 2.4 * s, ky + ay * 2.4 * s);
          g.lineTo(kx - ax * 1.4 * s - ay * 2.4 * s, ky - ay * 1.4 * s + ax * 2.4 * s);
          g.lineTo(kx - ax * 1.4 * s + ay * 2.4 * s, ky - ay * 1.4 * s - ax * 2.4 * s);
          g.closePath();
          g.fill();
        };
      g.fillStyle = '#0b0f1a';
      tri(1.55);
      g.fillStyle = AMB;
      tri(1);
    }
  }
  const cur = aim ? 'none' : '';
  if (cv.style.cursor !== cur) cv.style.cursor = cur;
  if (G.state === 'replay') {
    odLens(g);
    replayOverlay(g);
  } else if (G.state === 'brawl') drawFightHud(g);
  else if (G.state === 'zamboni') drawZamHud(g);
  else drawMini(g);
  if (liveName || camToastOn()) liveLabel(g, liveName);
}
