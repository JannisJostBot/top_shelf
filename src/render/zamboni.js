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
  const r = (a, b, w, h, c) => {
    view.ctx.fillStyle = c;
    view.ctx.fillRect(a, b, w, h);
  };
  const t = clock.now,
    moving = z.v > 3;
  // Top-down view, front of the machine is -y. Snow tank up front, driver and water tank in the middle,
  // conditioner with its trailing towel at the back.
  // fresh water laid down behind the conditioner
  if (moving) {
    view.ctx.globalAlpha = 0.32;
    r(-10, 15, 20, 4, '#9fd7ff');
    view.ctx.globalAlpha = 0.18;
    r(-10, 19, 20, 3, '#c9ecff');
  }
  view.ctx.globalAlpha = 0.28;
  r(-9, -12, 21, 27, '#1e3c6e');
  view.ctx.globalAlpha = 1;
  // tyres with tread
  for (const [tx, ty] of [
    [-11, -10],
    [8, -10],
    [-11, 3],
    [8, 3],
  ]) {
    r(tx, ty, 3, 7, '#14161c');
    const off = moving ? Math.floor(t * 12) % 3 : 0;
    for (let k = off; k < 7; k += 3) r(tx, ty + k, 3, 1, '#323846');
  }
  // chassis and team-coloured body with a stripe in the arena colour
  r(-9, -14, 18, 26, '#0b0f1a');
  r(-8, -13, 16, 24, S.lc[0]);
  r(-8, -1, 16, 2, S.kick);
  r(-8, 9, 16, 2, S.kick);
  // snow tank: ribbed lid, lit from the left
  r(-7, -12, 14, 10, '#e9edf2');
  r(-7, -12, 14, 1, '#ffffff');
  r(-7, -12, 1, 10, '#ffffff');
  r(3, -11, 4, 9, '#d3dae3');
  for (let k = -10; k <= -4; k += 2) r(-6, k, 12, 1, '#c3ccd8');
  // auger intake across the nose and headlights
  r(-6, -14, 12, 1, '#3a4258');
  r(-8, -14, 2, 1, '#fff6c2');
  r(6, -14, 2, 1, '#fff6c2');
  // driver seat on the left: wheel, driver in an arena jacket, cap
  r(-7, 1, 7, 7, '#1b2030');
  r(-6, 6, 5, 2, '#2a3140');
  r(-6, 0, 5, 1, '#0b0f1a');
  r(-6, 3, 5, 3, S.kick);
  r(-5, 2, 3, 2, '#e8b48a');
  r(-5, 2, 3, 1, S.lc[0]);
  // water tank on the right with a highlight
  r(1, 1, 6, 7, '#8fb0cc');
  r(1, 1, 1, 7, '#c4d6e6');
  r(2, 3, 4, 1, '#6f90ad');
  // rotating amber beacon on the roof
  const on = Math.floor(t * 5) & 1;
  r(3, -2, 2, 2, on ? '#ffb000' : '#8a5a00');
  if (on) {
    view.ctx.globalAlpha = 0.35;
    r(2, -3, 4, 4, '#ffd36a');
    view.ctx.globalAlpha = 1;
  }
  // conditioner: wide steel board with the towel flapping behind it
  r(-11, 11, 22, 3, '#3a4258');
  r(-10, 12, 20, 1, '#6b7790');
  for (let k = -10; k < 10; k += 2) {
    const flap = moving && Math.sin(t * 14 + k * 0.9) > 0.2 ? 1 : 0;
    r(k, 14, 2, 1 + flap, '#e8eef5');
  }
  view.ctx.restore();
}
export function drawZamHud() {
  const z = G.zam;
  if (!z) return;
  if (z.phase === 'count') drawCountdown(z.cd, 0);
  else if (z.phase === 'drive' && z.t > 25 - 0.7) drawCountdown(0, (25 - z.t) / 0.7);
  const pct = z.count / Math.max(1, z.total),
    w = Math.floor(view.CW * 0.5),
    x0 = (view.CW - w) >> 1,
    y = 10 + view.topInset; // below the floating scoreboard
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

/** Big 3, 2, 1, GO! in the middle of the screen: each number pops in large and settles. */
function drawCountdown(count, goAge) {
  const g = view.ctx,
    n = Math.ceil(count),
    label = n > 0 ? String(n) : 'GO!',
    k = n > 0 ? 1 - (count - (n - 1)) : goAge, // 0..1 through this number's second (or GO!'s moment)
    pop = k < 0.18 ? 1 + (1 - k / 0.18) * 1.2 : 1,
    size = Math.round(Math.min(view.CW, view.CH) * (n > 0 ? 0.32 : 0.2) * pop),
    x = view.CW / 2,
    y = view.CH * 0.5;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = size + 'px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.globalAlpha = Math.max(0, k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1);
  g.fillStyle = '#0b0f1a';
  g.fillText(label, x + 4, y + 5);
  g.fillStyle = n > 0 ? '#ffc845' : '#4fd38a';
  g.fillText(label, x, y);
  g.restore();
}
