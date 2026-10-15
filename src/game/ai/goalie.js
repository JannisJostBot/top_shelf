import { GB, GT } from '../../config';
import { clamp } from '../../core/math';
import { random, rnd } from '../../core/rng';
import { GK, SK } from '../players';
import { grab, openness, passTo } from '../puck';
import { G, puck } from '../world';
import { settings } from '../../settings';
import { feed, pop, S } from '../fx';
import { cpuSide } from '../online';

export function goalieAI(g, dt) {
  if (g.benched) return;
  const t = g.team,
    gy = t ? GT + 4 : GB - 4;
  g.fx = 0;
  g.fy = t ? 1 : -1;
  if (g.dummy && puck.owner !== g) {
    g.vx = (80 - g.x) * 4;
    g.vy = (gy - g.y) * 6;
    return;
  }
  if (puck.owner === g) {
    g.hold -= dt;
    g.vx *= 0.8;
    g.vy = (gy - g.y) * 6;
    if (g.hold <= 0) {
      let best = null,
        bo = -1;
      for (const m of SK[t]) {
        if (m.down > 0) continue;
        const o = openness(m, t);
        if (o > bo) {
          bo = o;
          best = m;
        }
      }
      if (best) passTo(g, best);
      else g.hold = 0.3;
    }
    return;
  }
  const close = Math.abs(puck.y - gy) < 45;
  let tx = 80 + (puck.x - 80) * (close ? 0.55 : 0.4);
  if (!puck.owner && (t ? puck.vy < -20 : puck.vy > 20)) {
    const tt = (gy - puck.y) / puck.vy;
    if (tt > 0 && tt < 1.2) tx = puck.x + puck.vx * tt;
  }
  tx = clamp(tx, 71, 89);
  const sp = cpuSide(t) ? settings.diff.react : 50;
  g.vx = clamp((tx - g.x) * 8, -sp, sp);
  g.vy = (gy - g.y) * 6;
}
export function goalieCheck() {
  for (const g of GK) {
    if (g.benched || g.cool > 0 || (g.passCd > 0 && puck.lastTeam === g.team)) continue;
    const skill = g.dummy ? 0.45 : (cpuSide(g.team) ? settings.diff.goalie : 0.76) * g.st.glove,
      reach = 6.5 + 3 * skill;
    const dx = puck.x - g.x,
      dy = puck.y - (g.y - 2);
    if (Math.abs(dx) < reach && Math.abs(dy) < 4) {
      const sp = Math.hypot(puck.vx, puck.vy);
      if (puck.gchk === g && sp >= 70) continue;
      puck.gchk = g;
      if (sp < 70 || (puck.lastTeam === g.team && !puck.hard)) {
        grab(g);
        return true;
      }
      let ch =
        skill * (1 - (sp - 150) / 450) +
        (Math.abs(dx) < 2.5 ? 0.22 : 0) -
        (Math.abs(dx) > reach - 2 ? 0.2 : 0);
      ch = clamp(ch, 0.08, 0.96);
      if (random() < ch) {
        const shooter = puck.lastTeam, // noted before the save hands the puck to the goalie's team
          r = random(),
          out = g.team ? 1 : -1,
          side = Math.abs(dx) > 1 ? Math.sign(dx) : random() < 0.5 ? -1 : 1;
        let kind;
        if (r < (sp < 120 ? 0.7 : 0.4)) {
          grab(g);
          kind = 'GLOVE SAVE';
        } else {
          if (r < 0.75) {
            puck.vx = side * rnd(90, 150);
            puck.vy = out * rnd(25, 70);
            kind = 'DEFLECTED';
          } else {
            puck.vy = out * Math.abs(puck.vy) * rnd(0.3, 0.5);
            puck.vx = puck.vx * 0.3 + rnd(-70, 70);
            kind = 'PAD SAVE';
          }
          g.cool = 0.15;
          puck.miss.clear();
          puck.passTo = null;
          puck.hard = false;
          puck.lastTeam = g.team;
          puck.trail.length = 0;
        }
        if (shooter !== g.team) {
          // an opponent's shot stopped: a save, and a shot on goal for the shooting team
          G.stats.saves[g.team]++;
          G.stats.sog[1 - g.team]++;
          feed(kind + ' · ' + '#' + g.num + ' ' + g.name, g.team);
        }
        g.saveT = 0.32;
        g.saveDir = side;
        // how the save looks (render/players.js): the glove, the blocker for a deflection, the butterfly for a pad save
        g.saveKind = kind === 'GLOVE SAVE' ? 'glove' : kind === 'DEFLECTED' ? 'block' : 'pad';
        S('save', { kind: kind === 'GLOVE SAVE' ? 'glove' : kind === 'DEFLECTED' ? 'deflect' : 'pad' });
        if (sp > 200) S('ooh');
        if (sp > 170) pop(g.x, g.y, kind, '#ffffff');
        return true;
      }
    } else if (puck.gchk === g && (Math.abs(dx) > reach + 1.5 || Math.abs(dy) > 6)) puck.gchk = null;
  }
  return false;
}
