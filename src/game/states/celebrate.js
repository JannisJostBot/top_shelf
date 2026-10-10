import { $ } from '../../core/dom';
import { clamp, dist, pick, rnd } from '../../core/math';
import { refAI } from '../ai/referee';
import { confetti } from '../match';
import { faceTo, steer } from '../physics/motion';
import { integrate } from '../physics/step';
import { GK, SK, players } from '../players';
import { startReplay } from '../replay';
import { G, parts } from '../world';
import { input } from '../../input/state';

/* ---------- goal celebrations ---------- */

const CELEB = ['huddle', 'spin', 'sticks', 'train'];
export function startCelebration() {
  const team = G.lastTeam,
    sc = G.lastShooter && G.lastShooter.team === team ? G.lastShooter : SK[team][0];
  G.state = 'celebrate';
  G.timer = 3.4;
  G.bannerT = 1.2;
  G.cel = {
    team,
    scorer: sc,
    meet: { x: clamp(sc.x, 32, 128), y: clamp(sc.y, 44, 212) },
    type: pick(CELEB),
    t: 0,
  };
  $('rpBar').hidden = false;
  $('angleBtn').hidden = true;
  input.sp = input.pp = input.swp = input.sr = false;
}
export function endCelebration() {
  if (G.state !== 'celebrate') return;
  for (const p of players) {
    p.jump = 0;
    p.stickUp = false;
  }
  $('angleBtn').hidden = false;
  startReplay();
}
export function celebrateStep(dt) {
  const c = G.cel;
  c.t += dt;
  const m = c.meet;
  SK[c.team].forEach((p, i) => {
    let tx, ty;
    if (c.type === 'train') {
      const a = c.t * 1.7 - i * 0.75;
      tx = m.x + Math.cos(a) * 22;
      ty = m.y + Math.sin(a) * 14;
    } else {
      const a = i * 2.094 + 0.5;
      tx = m.x + Math.cos(a) * 6.5;
      ty = m.y + Math.sin(a) * 4.5;
    }
    steer(p, clamp(tx, 12, 148), clamp(ty, 14, 242), dt, 1.05, c.type !== 'train');
    const here = dist(p, { x: tx, y: ty }) < 5 || c.type === 'train';
    p.stickUp = here && c.type !== 'spin';
    if (!here) {
      p.jump = 0;
      faceTo(p, tx, ty, 0.3);
      return;
    }
    if (c.type === 'huddle') {
      p.jump = Math.abs(Math.sin(c.t * 9 + i)) * 4;
      faceTo(p, m.x, m.y, 0.4);
    } else if (c.type === 'spin') {
      const D = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ][Math.floor(c.t * 8 + i) % 4];
      p.fx = D[0];
      p.fy = D[1];
      p.jump = Math.abs(Math.sin(c.t * 12 + i * 1.3)) * 3;
    } else if (c.type === 'sticks') {
      p.jump = (Math.floor(c.t * 4 + i) % 2) * 3;
      faceTo(p, m.x, m.y + 30, 0.3);
    } else {
      p.jump = Math.abs(Math.sin(c.t * 10 + i)) * 2;
      faceTo(p, p.x + p.vx, p.y + p.vy, 0.3);
    }
  });
  // the other side glides back toward center ice, heads down
  for (const p of SK[1 - c.team]) {
    steer(p, 80 + (p.slot === 'W' ? -25 : p.slot === 'D' ? 25 : 0), 128, dt, 0.4, true);
    p.jump = 0;
    p.stickUp = false;
  }
  for (const g of GK) {
    g.vx = 0;
    g.vy = 0;
  }
  if (Math.random() < 0.5)
    parts.push({
      x: m.x + rnd(-14, 14),
      y: m.y - rnd(4, 16),
      vx: rnd(-30, 30),
      vy: rnd(-40, 10),
      life: rnd(0.5, 1),
      c: confetti(c.team),
    });
  integrate(dt);
  refAI(dt);
}
