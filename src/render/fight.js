import { clamp, toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { G } from '../game/world';
import { view } from './canvas';
import { AMB, SH, WOOD } from './colors';
import { R, blit, line } from './pixels';
import { FACES } from './sprites';

export function drawLitter() {
  const B = G.br;
  if (!B) return;
  for (const l of B.litter) {
    const x = toS(l.x),
      y = toS(l.y);
    if (l.t === 'g') {
      R(x - 2, y - 1, 5, 4, '#0b0f1a');
      R(x - 1, y, 3, 2, l.c);
    } else {
      line(x - 8, y + 1, x + 6, y - 1, WOOD);
      R(x + 6, y - 2, 3, 2, l.c);
    }
  }
}
export function drawFighter(p) {
  const B = G.br,
    me = p === B.a,
    dir = me ? 1 : -1,
    pal = p.pal || kit.PAL[p.team],
    set = FACES[p.look.face] || FACES.eyes;
  let sx = toS(p.x),
    sy = toS(p.y);
  const jy = Math.round(p.jump || 0);
  if (p.hurtT > 0) sx -= dir * 2;
  R(sx - 6, sy, 12, 2, SH);
  const mv = Math.hypot(p.vx, p.vy) > 8,
    st = mv ? Math.floor(p.anim) & 1 : 0;
  blit(st ? set.sideB : set.sideA, pal, sx - 6, sy - 19 - jy, dir < 0);
  if (p.hurtT > 0) {
    const sv = view.sil;
    view.sil = '#ffffff';
    view.ctx.globalAlpha = 0.55;
    blit(set.sideA, pal, sx - 6, sy - 19 - jy, dir < 0);
    view.ctx.globalAlpha = 1;
    view.sil = sv;
  }
  const jc = typeof pal.J === 'function' ? pal.J(8, 6) : pal.J,
    skin = p.look.skin,
    fist = (x, y) => {
      R(x - 1, y - 1, 5, 5, '#0b0f1a');
      R(x, y, 3, 3, skin);
    };
  const sh = sy - 14 - jy,
    punching = me ? B.me.punchT > 0 : B.opp.punchT > 0,
    winding = !me && (B.opp.st === 'wind' || B.opp.st === 'feint'),
    blocking = me ? B.me.blockT > 0 : B.opp.blockT > 0;
  if (B.phase !== 'fight' && B.phase !== 'end') {
    fist(sx + dir * 5 - 1, sh - 2);
    fist(sx + dir * 3 - 1, sh + 2);
    return;
  }
  if (punching) {
    R(sx + dir * 4, sh, dir * 8, 2, jc);
    fist(sx + dir * 12 - 1, sh - 1);
    fist(sx + dir * 3 - 1, sh + 2);
  } else if (winding) {
    fist(sx - dir * 7 - 1, sh - 3);
    fist(sx + dir * 4 - 1, sh + 1);
    if (Math.floor(clock.now * 12) & 1) {
      R(sx - 1, sy - 31 - jy, 3, 6, '#ff3b3b');
      R(sx - 1, sy - 23 - jy, 3, 2, '#ff3b3b');
    }
  } else if (blocking) {
    fist(sx + dir * 3 - 1, sh - 5);
    fist(sx + dir * 4 - 1, sh - 1);
  } else {
    fist(sx + dir * 5 - 1, sh - 3);
    fist(sx + dir * 3 - 1, sh + 1);
  }
}
export function drawFightHud() {
  const B = G.br;
  if (!B) return;
  const w = Math.floor(view.CW * 0.36),
    h = 5,
    y = 10 + view.topInset; // below the floating scoreboard
  view.ctx.font = '6px "Press Start 2P", monospace';
  view.ctx.textBaseline = 'top';
  R(5, y - 1, w + 4, h + 4, '#0b0f1a');
  R(7, y + 1, Math.round((w * clamp(B.hpA, 0, 100)) / 100), h, kit.TEAMS[0].ui);
  R(view.CW - 9 - w, y - 1, w + 4, h + 4, '#0b0f1a');
  const fb = Math.round((w * clamp(B.hpB, 0, 100)) / 100);
  R(view.CW - 7 - fb, y + 1, fb, h, kit.TEAMS[1].ui);
  R(7, y + h + 3, w, 2, '#0b0f1a');
  R(7, y + h + 3, Math.round((w * B.stam) / 100), 2, AMB);
  view.ctx.fillStyle = '#ffffff';
  view.ctx.textAlign = 'left';
  view.ctx.fillText(B.a.name.slice(0, 9), 6, y + h + 8);
  view.ctx.textAlign = 'right';
  view.ctx.fillText(B.b.name.slice(0, 9), view.CW - 6, y + h + 8);
  view.ctx.textAlign = 'center';
  view.ctx.fillStyle = AMB;
  view.ctx.fillText('VS', view.CW / 2, y);
  view.ctx.textAlign = 'left';
}
