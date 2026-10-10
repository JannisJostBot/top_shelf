import { BASE, K } from '../config';
import { STICKS, stickCol } from '../data/sticks';
import { settings } from '../settings';
import { toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { blade } from '../game/physics/motion';
import { G, puck, ref } from '../game/world';
import { view } from './canvas';
import { AMB, SH } from './colors';
import { drawFighter } from './fight';
import { R, blit, line } from './pixels';
import { FACES, REFPAL, REFSET, SPR, crouched, leaned, withNumber } from './sprites';

/** A stick line in the team's style: pixel by pixel, so patterned and animated sticks work. */
function stickLine(p, x0, y0, x1, y1, part) {
  const st = STICKS[settings.sticks[p.team]] || STICKS.wood,
    c = st[part],
    n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    R(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1, stickCol(c, i, n, clock.now));
  }
}
const bladeTape = p => (STICKS[settings.sticks[p.team]] || STICKS.wood).blade || p.look.tape;
function drawStick(p, sx, sy) {
  const side = p.fx < -0.25 ? -1 : 1,
    b = blade(p),
    bx = toS(b.x),
    by = toS(b.y);
  const hx = sx + side * 5,
    hy = sy - 9;
  stickLine(p, hx, hy, bx - Math.round(p.fx * 2), by - 1, 'shaft');
  stickLine(p, hx + 1, hy, bx - Math.round(p.fx * 2) + 1, by - 1, 'edge');
  const tape = bladeTape(p);
  if (Math.abs(p.fx) > 0.5) R(bx - 1, by - 1, 2, 3, tape);
  else R(bx - 1, by, 4, 2, tape);
}
function stars(sx, sy) {
  if (view.sil || !(Math.floor(clock.now * 11) & 1)) return;
  R(sx - 5, sy - 3, 2, 2, AMB);
  R(sx + 4, sy - 4, 2, 2, AMB);
  R(sx, sy - 6, 2, 2, '#ffffff');
}
export function drawSkater(p) {
  if (G.state === 'brawl' && G.br && (p === G.br.a || p === G.br.b) && p.down <= 0) {
    drawFighter(p);
    return;
  }
  const pal = p.pal || kit.PAL[p.team],
    set = FACES[p.look.face] || FACES.eyes,
    sx = toS(p.x),
    sy = toS(p.y);
  if (p.down > 0) {
    // sprawled on the ice, stick dropped beside them
    R(sx - 11, sy, 22, 3, SH);
    stickLine(p, sx - 9, sy + 3, sx + 7, sy + 1, 'shaft');
    R(sx + 7, sy, 3, 2, bladeTape(p));
    blit(set.fallen, pal, sx - 10, sy - 10, p.fallDir < 0);
    stars(p.fallDir < 0 ? sx - 8 : sx + 8, sy - 9);
    return;
  }
  const sp = Math.hypot(p.vx, p.vy),
    mv = sp > 8,
    jy = Math.round(p.jump || 0);
  const sideV = Math.abs(p.fx) > Math.abs(p.fy) + 0.2,
    back = !sideV && p.fy < -0.35;
  // pose from movement: a four-step stride that alternates feet, a hockey stop when braking hard,
  // C-cuts when skating backwards and a crouch (plus a forward lean from the side) when sprinting
  const prev = p._psp === undefined ? sp : p._psp;
  p._psp = sp;
  if (prev - sp > 1.2 && sp > 18) p._stopUntil = clock.now + 0.2;
  const stopping = clock.now < (p._stopUntil || 0),
    backward = mv && (p.vx * p.fx + p.vy * p.fy) / sp < -0.3,
    sprint = sp > BASE * 1.02,
    step = Math.floor(p.anim) & 3;
  let map;
  if (sideV) {
    map = !mv ? set.sideA : stopping ? set.sideStop : step & 1 ? set.sideB : set.sideA;
    if (sprint && !stopping) map = leaned(crouched(map));
  } else {
    const k = back ? 'back' : 'front',
      legs = !mv ? 'A' : stopping ? 'Stop' : backward ? (step & 1 ? 'Vee' : 'A') : ['A', 'B', 'A', 'C'][step];
    map = set[k + legs];
    if (back) map = withNumber(map, p.num);
    if (sprint && !stopping && !backward) map = crouched(map);
  }
  // the stick stays up for a moment after a shot (follow-through), as during a wind-up
  const stickUp = p.stickUp || clock.now < (p.followUntil || 0);
  R(sx - 6, sy, 12, 2, SH);
  R(sx - 4, sy + 2, 8, 1, SH);
  if (stickUp) {
    const side = p.fx < -0.25 ? -1 : 1;
    blit(map, pal, sx - 6, sy - 19 - jy, sideV && p.fx < 0);
    stickLine(p, sx + side * 5, sy - 9 - jy, sx + side * 7, sy - 30 - jy, 'shaft');
    stickLine(p, sx + side * 5 + 1, sy - 9 - jy, sx + side * 7 + 1, sy - 30 - jy, 'edge');
    R(sx + side * 7 - 1, sy - 33 - jy, 3, 4, bladeTape(p));
    return;
  }
  if (back) drawStick(p, sx, sy - jy);
  blit(map, pal, sx - 6, sy - 19 - jy, sideV && p.fx < 0);
  if (!back) drawStick(p, sx, sy - jy);
  if (p.stun > 0) stars(sx, sy - 20);
}
export function drawGoalie(g) {
  const pal = g.pal || kit.PAL[g.team],
    sx = toS(g.x),
    sy = toS(g.y),
    front = g.fy > 0;
  R(sx - 8, sy, 16, 2, SH);
  R(sx - 6, sy + 2, 12, 1, SH);
  const lean = g.saveT > 0 ? g.saveDir * 2 : 0;
  blit(front ? SPR.goalieF : SPR.goalieB, pal, sx - 9 + lean, sy - 19, !front);
  if (g.saveT > 0) {
    const ex = sx + g.saveDir * 11;
    R(ex - 3, sy - 8, 6, 4, '#0b0f1a');
    R(ex - 2, sy - 7, 4, 2, g.saveDir * (front ? 1 : -1) < 0 ? '#c9a46a' : '#f2f4f7');
    R(ex - 3, sy - 3, 6, 3, '#f2f4f7');
  }
  if (front) {
    stickLine(g, sx + 5, sy - 9, sx + 3, sy, 'shaft');
    R(sx - 5, sy + 1, 9, 2, bladeTape(g));
  }
}
export function drawRef() {
  const sx = toS(ref.x),
    sy = toS(ref.y);
  R(sx - 6, sy, 12, 2, SH);
  if (G.state === 'faceoff') {
    blit(REFSET.frontA, REFPAL, sx - 6, sy - 19, false);
    if (puck.z > 0) {
      const px = toS(puck.x) + 3,
        py = toS(puck.y) - Math.round(puck.z * K);
      line(sx - 6, sy - 12, px, py, '#151515');
      line(sx - 6, sy - 11, px, py + 1, '#151515');
    }
    return;
  }
  const mv = Math.hypot(ref.vx, ref.vy) > 8,
    st = mv ? Math.floor(ref.anim) & 1 : 0;
  const sideV = Math.abs(ref.fx) > Math.abs(ref.fy) + 0.2,
    back = !sideV && ref.fy < -0.35;
  const map = sideV
    ? st
      ? REFSET.sideB
      : REFSET.sideA
    : back
      ? st
        ? REFSET.backB
        : REFSET.backA
      : st
        ? REFSET.frontB
        : REFSET.frontA;
  blit(map, REFPAL, sx - 6, sy - 19, sideV && ref.fx < 0);
}
