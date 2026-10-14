// After the final whistle, behind the results card: the winners gather at their goalie and celebrate, the
// losers glide back toward their own end. The 3D cameras film it as b-roll (render/renderer.js). The puck is out
// of play by now; it is left at the winners' huddle, which is where the cameras look.
import { clamp, dist } from '../../core/math';
import { GB, GT } from '../../config';
import { faceTo, steer } from '../physics/motion';
import { integrate } from '../physics/step';
import { GK, SK } from '../players';
import { G, puck } from '../world';

export function startPost(winner) {
  const g = GK[winner],
    meet = { x: 80, y: winner ? GT + 26 : GB - 26 }; // just in front of the winners' goalie
  G.post = { winner, meet, t: 0 };
  for (const p of [...SK[0], ...SK[1]]) {
    p.down = Math.min(p.down, 0);
    p.checkT = 0;
  }
  g.vx = g.vy = 0;
  Object.assign(puck, { owner: null, x: meet.x, y: meet.y, z: 0, vx: 0, vy: 0, passTo: null });
}
export function postStep(dt) {
  const P = G.post;
  P.t += dt;
  const w = P.winner,
    m = P.meet;
  SK[w].forEach((p, i) => {
    const a = i * 2.094 + 0.5,
      tx = m.x + Math.cos(a) * 7,
      ty = m.y + Math.sin(a) * 5;
    steer(p, tx, ty, dt, 0.8, true);
    const here = dist(p, { x: tx, y: ty }) < 5;
    p.stickUp = here;
    p.jump = here ? Math.abs(Math.sin(P.t * 8 + i)) * 3.5 : 0;
    faceTo(p, here ? m.x : tx, here ? m.y : ty, 0.3);
  });
  // the losers drift slowly back toward their own end, spread across the ice
  // (team 0 defends the lower goal, team 1 the upper one)
  const own = w ? GB - 50 : GT + 50;
  SK[1 - w].forEach((p, i) => {
    p.jump = 0;
    p.stickUp = false;
    steer(p, clamp(48 + i * 32, 20, 140), own, dt, 0.35, true);
  });
  // the winning goalie joins the huddle a little; the other one stays in the crease
  steer(GK[w], m.x, m.y - (w ? 8 : -8), dt, 0.5, true);
  GK[1 - w].vx = GK[1 - w].vy = 0;
  integrate(dt);
  // the puck stays put at the huddle
  puck.x = m.x;
  puck.y = m.y;
  puck.vx = puck.vy = 0;
}
