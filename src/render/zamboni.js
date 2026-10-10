import { toS } from '../core/math';
import { clock } from '../core/time';
import { STADIUMS } from '../data/stadiums';
import { G } from '../game/world';
import { view } from './canvas';
import { R } from './pixels';
import { settings } from '../settings';

export function drawZamboni() {
  const z = G.zam;
  if (!z) return;
  const S = STADIUMS[settings.stadiumKey],
    x = toS(z.x),
    y = toS(z.y);
  view.ctx.save();
  view.ctx.translate(x, y);
  view.ctx.rotate(z.a);
  view.ctx.scale(1.35, 1.35);
  view.ctx.globalAlpha = 0.3;
  view.ctx.fillStyle = '#1e3c6e';
  view.ctx.fillRect(-10, -12, 21, 25);
  view.ctx.globalAlpha = 1;
  const r = (a, b, w, h, c) => {
    view.ctx.fillStyle = c;
    view.ctx.fillRect(a, b, w, h);
  };
  r(-10, -10, 3, 6, '#111');
  r(7, -10, 3, 6, '#111');
  r(-10, 4, 3, 6, '#111');
  r(7, 4, 3, 6, '#111');
  r(-8, -13, 16, 22, '#0b0f1a');
  r(-7, -12, 14, 20, '#eef1f5');
  r(-7, -12, 14, 7, S.lc[0]);
  r(-5, -11, 10, 3, '#9fd7ff');
  r(-2, -8, 4, 3, '#e8b48a');
  r(-6, -3, 12, 9, '#c9d2de');
  for (let k = -2; k < 6; k += 2) r(-6, k, 12, 1, '#aab6c4');
  r(-7, 1, 14, 2, S.kick);
  r(-10, 8, 20, 3, '#3a4258');
  r(-9, 9, 18, 1, '#6b7790');
  if (Math.floor(clock.now * 4) & 1) r(-1, -14, 2, 2, '#ffb000');
  view.ctx.restore();
}
export function drawZamHud() {
  const z = G.zam;
  if (!z) return;
  const pct = z.count / Math.max(1, z.total),
    w = Math.floor(view.CW * 0.5),
    x0 = (view.CW - w) >> 1,
    y = 10;
  R(x0 - 2, y - 2, w + 4, 9, '#0b0f1a');
  R(x0, y, Math.round(w * pct), 5, '#7fe3ff');
  view.ctx.font = '6px "Press Start 2P", monospace';
  view.ctx.textBaseline = 'top';
  view.ctx.textAlign = 'center';
  view.ctx.fillStyle = '#ffffff';
  view.ctx.fillText(
    Math.round(pct * 100) + '% POLISHED · ' + Math.max(0, Math.ceil(z.t)) + 's',
    view.CW / 2,
    y + 10,
  );
  view.ctx.textAlign = 'left';
}
