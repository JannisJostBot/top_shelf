import { clamp, toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { G } from '../game/world';
import { view } from './canvas';
import { AMB, SH, WOOD } from './colors';
import { R, blit, line } from './pixels';
import { FACES } from './sprites';

export function drawLitter(g) {
  const B = G.br;
  if (!B) return;
  for (const l of B.litter) {
    const x = toS(l.x),
      y = toS(l.y);
    if (l.t === 'g') {
      R(g, x - 2, y - 1, 5, 4, '#0b0f1a');
      R(g, x - 1, y, 3, 2, l.c);
    } else {
      line(g, x - 8, y + 1, x + 6, y - 1, WOOD);
      R(g, x + 6, y - 2, 3, 2, l.c);
    }
  }
}
// The gloves are on the ice (see drawLitter), so the fighters' hands are bare: their palette with skin for the
// glove colour, made once per palette so the sprite cache can reuse it.
const bare = new WeakMap();
function barePal(p) {
  const base = p.pal || kit.PAL[p.team];
  let b = bare.get(base);
  if (!b) bare.set(base, (b = Object.assign({}, base, { G: p.look.skin })));
  return b;
}
export function drawFighter(g, p) {
  const B = G.br,
    me = p === B.a,
    dir = me ? 1 : -1,
    pal = barePal(p),
    set = FACES[p.look.face] || FACES.eyes;
  let sx = toS(p.x),
    sy = toS(p.y);
  const jy = Math.round(p.jump || 0);
  if (p.hurtT > 0) sx -= dir * 2;
  R(g, sx - 6, sy, 12, 2, SH);
  const mv = Math.hypot(p.vx, p.vy) > 8,
    st = mv ? Math.floor(p.anim) & 1 : 0;
  blit(g, st ? set.sideB : set.sideA, pal, sx - 6, sy - 19 - jy, dir < 0);
  if (p.hurtT > 0) {
    const sv = view.sil;
    view.sil = '#ffffff';
    g.globalAlpha = 0.55;
    blit(g, set.sideA, pal, sx - 6, sy - 19 - jy, dir < 0);
    g.globalAlpha = 1;
    view.sil = sv;
  }
  const jc = typeof pal.J === 'function' ? pal.J(8, 6) : pal.J,
    skin = p.look.skin,
    fist = (x, y) => {
      R(g, x - 1, y - 1, 5, 5, '#0b0f1a');
      R(g, x, y, 3, 3, skin);
    };
  // (against the CPU only its side winds up; between two players both do)
  const f = me ? B.me : B.opp,
    sh = sy - 14 - jy,
    punching = f.punchT > 0,
    winding = f.st === 'wind' || f.st === 'feint',
    blocking = f.blockT > 0;
  if (B.phase !== 'fight' && B.phase !== 'end') {
    fist(sx + dir * 5 - 1, sh - 2);
    fist(sx + dir * 3 - 1, sh + 2);
    return;
  }
  if (punching) {
    R(g, sx + dir * 4, sh, dir * 8, 2, jc);
    fist(sx + dir * 12 - 1, sh - 1);
    fist(sx + dir * 3 - 1, sh + 2);
  } else if (winding) {
    fist(sx - dir * 7 - 1, sh - 3);
    fist(sx + dir * 4 - 1, sh + 1);
    if (Math.floor(clock.now * 12) & 1) {
      R(g, sx - 1, sy - 31 - jy, 3, 6, '#ff3b3b');
      R(g, sx - 1, sy - 23 - jy, 3, 2, '#ff3b3b');
    }
  } else if (blocking) {
    fist(sx + dir * 3 - 1, sh - 5);
    fist(sx + dir * 4 - 1, sh - 1);
  } else {
    fist(sx + dir * 5 - 1, sh - 3);
    fist(sx + dir * 3 - 1, sh + 1);
  }
}
export function drawFightHud(g) {
  const B = G.br;
  if (!B) return;
  const w = Math.floor(view.CW * 0.36),
    h = 5,
    y = 10 + view.topInset; // below the floating scoreboard
  g.font = '6px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  R(g, 5, y - 1, w + 4, h + 4, '#0b0f1a');
  R(g, 7, y + 1, Math.round((w * clamp(B.hpA, 0, 100)) / 100), h, kit.TEAMS[0].ui);
  R(g, view.CW - 9 - w, y - 1, w + 4, h + 4, '#0b0f1a');
  const fb = Math.round((w * clamp(B.hpB, 0, 100)) / 100);
  R(g, view.CW - 7 - fb, y + 1, fb, h, kit.TEAMS[1].ui);
  R(g, 7, y + h + 3, w, 2, '#0b0f1a');
  R(g, 7, y + h + 3, Math.round((w * B.stam) / 100), 2, AMB);
  // the names and VS sit on dark plates, so they read over the white ice and the referee
  const label = (text, x, yy, align, c) => {
    const tw = Math.ceil(g.measureText(text).width),
      lx = align === 'left' ? x : align === 'right' ? x - tw : Math.round(x - tw / 2);
    R(g, lx - 2, yy - 2, tw + 4, 10, '#0b0f1a');
    g.textAlign = align;
    g.fillStyle = c;
    g.fillText(text, x, yy);
  };
  label(B.a.name.slice(0, 9), 7, y + h + 8, 'left', '#ffffff');
  label(B.b.name.slice(0, 9), view.CW - 7, y + h + 8, 'right', '#ffffff');
  label('VS', view.CW / 2, y, 'center', AMB);
  g.textAlign = 'left';
}
