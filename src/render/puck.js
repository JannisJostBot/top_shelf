import { K } from '../config';
import { toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { G, puck } from '../game/world';
import { view } from './canvas';
import { SH } from './colors';
import { R, disc, ellipsePx } from './pixels';

export function puckPixels(x, y, body, rim, hi) {
  if (body === undefined) {
    body = kit.PS.b;
    rim = kit.PS.r;
    hi = kit.PS.h;
  }
  R(x - 1, y - 3, 3, 1, rim);
  R(x - 2, y - 2, 5, 1, rim);
  R(x - 3, y - 1, 7, 3, rim);
  R(x - 2, y + 2, 5, 1, rim);
  R(x - 2, y - 1, 5, 3, body);
  R(x - 1, y - 2, 3, 1, body);
  R(x - 1, y - 1, 2, 1, hi || '#5a6378');
}
export function puckGround() {
  if (puck.owner && puck.owner.role === 'G') return;
  const x = toS(puck.x),
    y = toS(puck.y) + 1,
    p = 0.5 + 0.5 * Math.sin(clock.now * 7.7),
    carried = !!puck.owner;
  const rx = carried ? 7 : 9 + Math.round(p * 2),
    ry = carried ? 3 : 4 + Math.round(p);
  view.ctx.globalAlpha = carried ? 0.16 : 0.24;
  disc(x, y, rx, ry, kit.PS.r);
  view.ctx.globalAlpha = carried ? 0.5 : 0.65 + 0.35 * p;
  ellipsePx(x, y, rx, ry, kit.PS.r);
  view.ctx.globalAlpha = 1;
}
export function drawPuck(alpha) {
  const x = toS(puck.x),
    gy = toS(puck.y),
    y = gy - Math.round(puck.z * K);
  if (alpha === undefined) {
    const tl = puck.trail.length;
    for (let i = 0; i < tl; i++) {
      const t = puck.trail[i],
        k = (i + 1) / tl;
      if (G.state === 'replay') {
        view.ctx.globalAlpha = 0.12 * k;
        disc(toS(t.x), toS(t.y), 4, 3, kit.PS.r);
      }
      view.ctx.globalAlpha = 0.1 + 0.5 * k;
      R(toS(t.x) - 2, toS(t.y) - 1, 4, 2, kit.PS.r);
    }
    view.ctx.globalAlpha = 1;
    R(x - 2, gy + 3, 5, 1, SH);
  } else view.ctx.globalAlpha = alpha;
  if (kit.PS.a < 1) view.ctx.globalAlpha *= kit.PS.a;
  puckPixels(x, y);
  view.ctx.globalAlpha = 1;
}
